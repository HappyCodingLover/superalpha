import React from "react";
import Router from "next/router";
import { Row, Col, Form, FormGroup, Label, Input, Button } from "reactstrap";
import Layout from "../components/Layout";
import Session from "../utils/session";
import Web3 from "web3";
import axios from 'axios';

export default class extends React.Component {
  static async getInitialProps({ req, res }) {
    let props = {
      session: "",
    };

    if (req && req.session) {
      props.session = req.session;
    } else {
      props.session = await Session.getSession();
    }

    if (!props.session || !props.session.loggedin) {
      if (req) {
        res.redirect("/login");
      } else {
        Router.push("/login");
      }
    }

    return props;
  }

  constructor(props) {
    super(props);
    this.state = {
      name: "",
      address: "",
      message: null,
      messageStyle: null,
      lastBlock: null,
      contractAddress: null,
      transactions: 0,
      etherscanApiKey: "J9QMPHZH981IJX2DP2TRU3U37S8XNWHAXC",
      isStart: false,
      isAnalysingTxs: false,
      isAddingToDB: false,
      getDataInterval: null,
    };
  }

  getData = async () => {
    const web3 = new Web3(
      "https://mainnet.infura.io/v3/6e992ba53f254e0c8cfada72a4dc68b5"
    );
    await window.ethereum.enable();

    let newTokenInfo;
    const lastBlockNumber = await web3.eth.getBlockNumber();
    console.log("lastBlockNumber: ", lastBlockNumber);
    if (this.state.lastBlock === lastBlockNumber) {
      // skip this same block
    } else {
      // new block mined
      this.setState({ lastBlock: lastBlockNumber });
      const block = await web3.eth.getBlock(lastBlockNumber);
      this.setState({ isAnalysingTxs: true });
      for (const tx of block.transactions) {
        // testTx.forEach(async (tx) => {
        const txReceipt = await web3.eth.getTransactionReceipt(tx);
        if (txReceipt && txReceipt.contractAddress !== null) {
          console.log(
            "new token found.\n__contractAddress: ",
            txReceipt.contractAddress
          );
          this.setState({ contractAddress: txReceipt.contractAddress });
          try {
            const abi = await axios.get(
              `https://api.etherscan.io/api?module=contract&action=getabi&address=${txReceipt.contractAddress}&apikey=${this.state.etherscanApiKey}`
            );
            console.log("__abi", abi);
            if (abi.data.result === "Contract source code not verified") {
              newTokenInfo = {
                contractAddress: txReceipt.contractAddress,
                transactions: [{ hash: tx }],
              };
              console.log("__token: no transactions yet.\nadding to DB");
              let data = {
                token: txReceipt.contractAddress,
                transactions: 1,
              };
              this.setState({ transactions: 1, isAnalysingTxs: false });
              this.apiCall(data);
            } else {
              const wEthContract = new web3.eth.Contract(
                JSON.parse(abi.data.result),
                txReceipt.contractAddress
              );
              const allEthTransferEvents = await wEthContract.getPastEvents(
                "Transfer",
                lastBlocksTaken,
                "latest"
              );
              console.log("__allEthTransferEvents", allEthTransferEvents);
              newTokenInfo = {
                contractAddress: txReceipt.contractAddress,
                transactions: allEthTransferEvents,
              };
              this.setState({ transactions: allEthTransferEvents.length });

              console.log("__token: no transactions yet.\nadding to DB");
              let data = {
                token: txReceipt.contractAddress,
                transactions: allEthTransferEvents.length,
              };
              this.setState({ isAnalysingTxs: false });
              this.apiCall(data);
            }
          } catch (error) {
            console.error("__err_get_token_abi", error);
          }
        } else {
        }
      }
    }

  };

  apiCall = (data) => {
    this.setState({ isAddingToDB: true });
    fetch("tokens/addToken", {
      method: "POST",
      body: JSON.stringify(data),
      headers: {
        "Content-Type": "application/json",
      },
    })
      .then((res) => res.json())
      .then((response) => {
        if (response.token) {
          console.log("__success", response.token);
        } else if (response.message) {
          this.setState({
            message: response.message,
          });
        } else {
          this.setState({
            message: "Unknown Error!",
          });
        }
        this.setState({ isAddingToDB: false });
      })
      .catch((error) => {
        console.error("Error:", error);
        this.setState({
          message: "Request Failed!",
          isAddingToDB: false,
        });
      });
  };

  render() {
    const {
      isStart,
      lastBlock,
      contractAddress,
      transactions,
      isAnalysingTxs,
      isAddingToDB,
    } = this.state;
    const alert =
      this.state.message === null ? (
        <div />
      ) : (
        <div className={`alert ${this.state.messageStyle}`} role="alert">
          {this.state.message}
        </div>
      );

    if (this.props.session.loggedin) {
      return (
        <Layout {...this.props}>
          <Row className="text-center">
            <Col>
              <h1 className="display-2">ERC20 Tokens Tracker</h1>
            </Col>
          </Row>
          <Row>
            <Button
              color="primary"
              onClick={() => {
                this.setState({ isStart: true });
                const getDataInterval = setInterval(this.getData, 5000);
                this.setState({ getDataInterval: getDataInterval });
              }}
              disabled={isStart}
            >
              Start
            </Button>
            <Button
              color="warning"
              onClick={() => {
                this.setState({ isStart: false });
                clearInterval(this.state.getDataInterval);
              }}
              disabled={!isStart}
            >
              Stop
            </Button>
          </Row>
          <Row>
            <h3>
              {isStart
                ? "Fetching..."
                : !isStart
                ? "Ready"
                : isAnalysingTxs
                ? "Analysing transactions"
                : isAddingToDB
                ? "Adding to DB"
                : !isStart && !isAnalysingTxs && !isAddingToDB && "Added to DB"}
            </h3>
          </Row>
          <Row>
            <Col>
              <h4>
                Last Block:{" "}
                {lastBlock !== null
                  ? lastBlock
                  : isStart
                  ? "Fetching..."
                  : "Ready"}
              </h4>
            </Col>
            <Col>
              <h4>New Token: {contractAddress}</h4>
            </Col>
            <Col>
              <h4>
                Transactions:{" "}
                {isStart && isAnalysingTxs
                  ? "Analysing Transactions"
                  : isAddingToDB
                  ? "Adding to DB"
                  : transactions}
              </h4>
            </Col>
          </Row>
        </Layout>
      );
    } else {
      return (
        <Layout {...this.props}>
          <div />
        </Layout>
      );
    }
  }
}
