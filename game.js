const db = require('./database');
const user = require('./user');

const getStockPrice = (stock_id) => {
  return new Promise(async (resolve, reject) => {
    let sql = `SELECT price FROM stock WHERE id='${stock_id}'`;

    try {
      const results = await db.query(sql);
      if (results.length !== 1) {
        throw "getStockPrice: stock not found";
      }
      resolve(results[0].price);
    } catch (error) {
      reject(error);
    }
  });
};

const getGameInfo = (game_id) => {
  return new Promise(async (resolve, reject) => {
    let sql = `SELECT base_funds, private, pass, start_time, end_time FROM game WHERE id='${game_id}'`;

    try {
      const results = await db.query(sql);
      if (results.length !== 1) {
        throw "getGameInfo: game not found";
      }
      resolve(results[0]);
    } catch (error) {
      reject(error);
    }
  });
};



module.exports = {
  getGameInfo: (game_id) => {
    return new Promise(async (resolve, reject) => {
      let sql = `SELECT name, description, start_time, end_time `;
      sql += `FROM game WHERE id='${game_id}'`;

      try {
        const results = await db.query(sql);
        if (results.length !== 1) {
          throw "getGameInfo game id not found";
        }
        resolve(results);
      } catch (error) {
        reject(error);
      }
    });
  },

  getStockList: (market_id) => {
    return new Promise(async (resolve, reject) => {
      let sql = `SELECT symbol, full_name, price, variety, update_date `;
      sql += `FROM stock WHERE market_id='${market_id}'`;

      try {
        const results = await db.query(sql);
        resolve(results);
      } catch (error) {
        reject(error);
      }
    });
  },

  getLeaderboard: (game_id) => {
    return new Promise((resolve, reject) => {

    });
  },

  joinGame: (game_id, user_id) => {
    return new Promise(async (resolve, reject) => {
      try {
        const game_info = await getGameInfo(game_id);

        // TODO: check password if private game
        // TODO: check if game is active (start_time, end_time)

        let sql = `INSERT INTO user_game(user_id, game_id, funds) `;
        sql += `VALUES('${user_id}', '${game_id}', '${game_info.base_funds}')`;

        const results = await db.query(sql);
        resolve('OK');
      } catch (error) {
        reject(error);
      }
    });
  },

  buyStock: (game_id, user_id, stock_id, amount) => {
    return new Promise(async (resolve, reject) => {

      try {
        const stock_price = await getStockPrice(stock_id);
        const user_funds = await user.getUserFunds(user_id, game_id);

        const needed_funds = Number(amount) * Number(stock_price);
        if (needed_funds > user_funds) {
          throw "Not enough funds";
        }

        // start buy transaction
        let stock_sql = `INSERT INTO stock_event(user_id, stock_id, game_id, amount, transaction_type, unit_price) `;
        stock_sql += `VALUES('${user_id}', '${stock_id}', '${game_id}', '${amount}', 'B', '${stock_price}')`;

        let funds_sql = `UPDATE user_game SET funds=funds-'${needed_funds}' WHERE user_id='${user_id}' AND game_id='${game_id}'`;

        const results = await db.transaction(stock_sql, funds_sql, 1, 1);

        resolve(results);
      } catch (error) {
        reject(error);
      }

    });
  },
};