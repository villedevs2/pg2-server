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
  // ***************************************************************************
  // Gets information about the given game
  // ***************************************************************************
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

  // ***************************************************************************
  // Gets the list of stock for the given market
  // ***************************************************************************
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

  // ***************************************************************************
  // Get the leaderboard for the given game
  // ***************************************************************************
  getLeaderboard: (game_id) => {
    return new Promise(async (resolve, reject) => {
      let sql = ``;
      sql += `SELECT u.username, u.image, SUM(assets) AS 'net_worth' `;
      sql += `FROM( `;
      sql += `SELECT user_id, stock.full_name, (buy_sum-sell_sum)*stock.price AS 'assets' `;
      sql += `FROM( `;
      sql += `SELECT user_id, stock_id, SUM(buy) AS buy_sum, SUM(sell) AS sell_sum `;
      sql += `FROM( `;
      sql += `SELECT user_id, stock_id, amount AS 'buy', 0 AS 'sell' `;
      sql += `FROM stock_event `;
      sql += `WHERE transaction_type='B' AND game_id='${game_id}' `;
      sql += `UNION ALL `;
      sql += `SELECT user_id, stock_id, 0 AS 'buy', amount AS 'sell' `;
      sql += `FROM stock_event `;
      sql += `WHERE transaction_type='S' AND game_id='${game_id}' `;
      sql += `) AS summed `;
      sql += `GROUP BY user_id, stock_id `;
      sql += `) AS final, stock `;
      sql += `WHERE final.stock_id=stock.id `;
      sql += `) AS a, user_account AS u `;
      sql += `WHERE u.id=user_id `;
      sql += `GROUP BY user_id `;

      try {
        const results = await db.query(sql);
        resolve(results);
      } catch (error) {
        reject(error);
      }
    });
  },

  // ***************************************************************************
  // Returns true if user has joined the given game
  // ***************************************************************************
  hasPlayerJoinedGame: (user_id, game_id) => {
    return new Promise(async (resolve, reject) => {
      let sql = `SELECT * FROM user_game WHERE user_id='${user_id}' AND game_id='${game_id}'`;

      try {
        const results = await db.query(sql);
        resolve(results.length === 1);
      } catch (error) {
        reject(error);
      }
    });
  },

  // ***************************************************************************
  // Attempts to add the given user to the given game
  // ***************************************************************************
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

  // ***************************************************************************
  // Attempts to buy stock with given user
  // ***************************************************************************
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

  // ***************************************************************************
  // Attempts to sell stock with given user
  // ***************************************************************************
  sellStock: (game_id, user_id, stock_id, amount) => {
    return new Promise(async (resolve, reject) => {
      try {
        const stock_price = await getStockPrice(stock_id);

        const user_stock = await user.getUserStock(user_id, game_id, stock_id);

        console.log(`user stock = ${user_stock}`);

        if (user_stock < amount) {
          throw "Not enough stock";
        }

        const rewarded_funds = Number(amount) * Number(stock_price);

        // start sell transaction
        let stock_sql = `INSERT INTO stock_event(user_id, stock_id, game_id, amount, transaction_type, unit_price) `;
        stock_sql += `VALUES('${user_id}', '${stock_id}', '${game_id}', '${amount}', 'S', '${stock_price}')`;

        let funds_sql = `UPDATE user_game SET funds=funds+'${rewarded_funds}' WHERE user_id='${user_id}' AND game_id='${game_id}'`;

        const results = await db.transaction(stock_sql, funds_sql, 1, 1);

        resolve(results);
      } catch (error) {
        reject(error);
      }
    });
  }
};