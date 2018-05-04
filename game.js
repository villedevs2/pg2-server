const db = require('./database');

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
};