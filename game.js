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
          let info = {
            error: false,
            name: results[0].name,
            description: results[0].description,
            start_time: results[0].start_time,
            end_time: results[0].end_time
          };

          resolve(info);
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
};