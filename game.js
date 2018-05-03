const db = require('./database');

module.exports = {
  getGameInfo: (game_id) => {
    return new Promise((resolve, reject) => {
      let sql = `SELECT name, description, start_time, end_time `;
      sql += `FROM game WHERE id='${game_id}'`;

      db.query(sql).then((results) => {
        if (results.length !== 1) {
          reject(`getGameInfo game id not found`);
        } else {
          resolve(results);
        }
      }).catch((error) => {
        reject(error);
      });
    });
  },

  getStockList: (market_id) => {
    return new Promise((resolve, reject) => {
      let sql = `SELECT symbol, full_name, price, variety, update_date `;
      sql += `FROM stock WHERE market_id='${market_id}'`;

      db.query(sql).then((results) => {
        resolve(results);
      }).catch((error) => {
        reject(error);
      });
    });
  },

  getLeaderboard: (game_id) => {
    return new Promise((resolve, reject) => {

    });
  },
};