const pool = require('../dbconfig/dbconfig')


module.exports = (server) => {
  if (server === null) {
    throw new Error("server should be an express instance");
  }

  server.post("/tokens/addToken", async (req, res) => {
    var token = req.body.token;
    var transactions = req.body.transactions;
    if (token && transactions) {
      const results = await addToken(token, transactions);
      if (results && results.length > 0) {
        return res.json({ token: token });
      } else {
        return res.json({ message: "Token already exists with address " + token });
      }
    } else {
      return res.json({ message: "Token is missing!" });
    }
  });

  async function addToken(token, transactions) {
    try {
      const results = await pool.query(`INSERT INTO tokens (token, transactions) VALUES ("${token}", "${transactions}");`)
      return results
    }catch(e){
      console.error(e)
    }
  }
};
