const db = require('./database');
const user = require('./user');

const settings = require('./settings.json');

const getStockPrice = (stock_id) => {
  return new Promise(async (resolve, reject) => {
    let sql = `SELECT price FROM stock WHERE id='${stock_id}'`;

    try {
      const results = await db.query(sql);
      if (results.length !== 1) {
        throw new Error("GETSTOCKPRICE_NOT_FOUND");
      }
      resolve(results[0].price);
    } catch (error) {
      reject(error);
    }
  });
};

const getGameInfo = (game_id) => {
  return new Promise(async (resolve, reject) => {
    let sql = `SELECT base_funds, private, pass, start_time, end_time, closed FROM game WHERE id='${game_id}'`;

    try {
      const results = await db.query(sql);
      if (results.length !== 1) {
        throw new Error("GETGAMEINFO_NOT_FOUND");
      }
      resolve(results[0]);
    } catch (error) {
      reject(error);
    }
  });
};

const getGameID = (game_name) => {
  return new Promise(async (resolve, reject) => {
    let sql = `SELECT id FROM game WHERE name='${game_name}'`;

    try {
      const result = await db.query(sql);
      if (result.length !== 1) {
        throw new Error("GETGAMEID_NOT_FOUND");
      }
      resolve(result[0].id);
    } catch (error) {
      reject(error);
    }
  });
};

const isGameActive = (game_id) => {
  return new Promise(async (resolve, reject) => {
    let sql = `
      SELECT (IF(CURRENT_TIMESTAMP >= start_time, true, false) AND IF(CURRENT_TIMESTAMP < end_time, true, false)) AS 'active'
      FROM game WHERE id='${game_id}'`;

    try {
      const result = await db.query(sql);
      if (result.length !== 1) {
        throw new Error("ISGAMEACTIVE_NOT_FOUND");
      }
      resolve(result[0].active);
    } catch (error) {
      reject(error);
    }
  });
};

const isGameClosed = (game_id) => {
  return new Promise(async (resolve, reject) => {
    let sql = `SELECT IF(closed != 0, true, false) AS 'closed' FROM game WHERE id='${game_id}'`;

    try {
      const result = await db.query(sql);
      if (result.length !== 1) {
        throw new Error("ISGAMECLOSED_NOT_FOUND");
      }
      resolve(result[0].closed);
    } catch (error) {
      reject(error);
    }
  });
};

const isTradingOpen = (game_id) => {
  return new Promise(async (resolve, reject) => {
    let sql = `
      SELECT (
      IF(WEEKDAY(CURRENT_DATE) >= 1, true, false) AND
      IF(WEEKDAY(CURRENT_DATE) <= 5, true, false) AND
      IF(CURRENT_TIME >= m.open_hour, true, false) AND
      IF(CURRENT_TIME <= m.close_hour, true, false)
      ) AS 'trading_open'
      FROM stock_market AS m, game AS g
      WHERE g.market_id=m.id AND g.id='${game_id}'`;

    try {
      const result = await db.query(sql);
      if (result.length !== 1) {
        throw new Error("ISTRADINGOPEN_NOT_FOUND");
      }
      resolve(result[0].trading_open);
    } catch (error) {
      reject(error);
    }
  });
};

// ***************************************************************************
// Returns true if user has joined the given game
// ***************************************************************************
const hasPlayerJoinedGame = (user_id, game_id) => {
  return new Promise(async (resolve, reject) => {
    let sql = `SELECT * FROM user_game WHERE user_id='${user_id}' AND game_id='${game_id}'`;

    try {
      const results = await db.query(sql);
      resolve(results.length === 1);
    } catch (error) {
      reject(error);
    }
  });
};

const hashGamePassword = (password) => {
  const hash = crypto.createHash('sha256');
  hash.update(`${password}.${settings.db_gamepass_salt}`);
  return hash.digest('hex');
};



module.exports = {
  // ***************************************************************************
  // Gets information about the given game
  // ***************************************************************************
  getPublicGameInfo: (game_id) => {
    return new Promise(async (resolve, reject) => {
      let sql = `
        SELECT name, description, start_time, end_time
        FROM game WHERE id='${game_id}'`;

      try {
        const results = await db.query(sql);
        if (results.length !== 1) {
          throw new Error("GETGAMEINFO_NOT_FOUND");
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
  getLeaderboard: (game_id, start, amount) => {
    return new Promise(async (resolve, reject) => {
      let sql = `
        SELECT u.username, u.image, SUM(assets) AS 'net_worth'
        FROM(
        SELECT user_id, stock.full_name, (buy_sum-sell_sum)*stock.price AS 'assets'
        FROM(
        SELECT user_id, stock_id, SUM(buy) AS 'buy_sum', SUM(sell) AS 'sell_sum'
        FROM(
        SELECT user_id, stock_id, amount AS 'buy', 0 AS 'sell'
        FROM stock_event
        WHERE transaction_type='B' AND game_id='${game_id}'
        UNION ALL
        SELECT user_id, stock_id, 0 AS 'buy', amount AS 'sell'
        FROM stock_event
        WHERE transaction_type='S' AND game_id='${game_id}'
        ) AS summed
        GROUP BY user_id, stock_id
        ) AS final, stock
        WHERE final.stock_id=stock.id
        ) AS a, user_account AS u
        WHERE u.id=user_id 
        GROUP BY user_id 
        LIMIT '${start}', '${amount}'`;

      try {
        const results = await db.query(sql);
        resolve(results);
      } catch (error) {
        reject(error);
      }
    });
  },

  // ***************************************************************************
  // Attempts to add the given user to the given game
  // ***************************************************************************
  joinGame: (game_id, user_id, password) => {
    return new Promise(async (resolve, reject) => {
      try {
        const game_info = await getGameInfo(game_id);

        if (game_info.closed) {
          throw new Error("JOINGAME_CLOSED");
        }

        switch (game_info.game_type) {
          case 'private': {
            // check password for private games
            const hashed_pw = hashGamePassword(password);
            if (game_info.pass !== hashed_pw) {
              throw new Error("JOINGAME_WRONG_PASS");
            }
            break;
          }
          case 'season': {
            // check active time for seasonal games
            const game_active = await isGameActive(game_id);
            if (!game_active) {
              throw new Error("JOINGAME_NOT_ACTIVE");
            }
            break;
          }
        }

        let sql = `
          INSERT INTO user_game(user_id, game_id, funds) 
          VALUES('${user_id}', '${game_id}', '${game_info.base_funds}')`;

        const results = await db.query(sql);
        resolve('OK');
      } catch (error) {
        reject(error);
      }
    });
  },


  // Create open game: no owner, no duration, no password
  createOpenGame: (name, description, base_funds, market_id) => {
    return new Promise(async (resolve, reject) => {
      try {
        let sql = `
          INSERT INTO
          game(owner_id, market_id, pass, game_type, name, description, base_funds, start_time, end_time)
          VALUES(NULL, '${market_id}', NULL, 'open', '${name}', '${description}', '${base_funds}', NULL, NULL)`;

        const result = await db.query(sql);
        if (result.affectedRows !== 1) {
          throw new Error("CREATEOPENGAME_FAIL");
        }

        // return new game id
        const new_game_id = await getGameID(name);
        resolve(new_game_id);
      } catch (error) {
        reject(error);
      }
    });
  },

  // Create seasonal game: no owner, no password, fixed duration
  createSeasonalGame: (name, description, base_funds, market_id, start_time, end_time) => {
    return new Promise(async (resolve, reject) => {
      try {
        let sql = `
          INSERT INTO
          game(owner_id, market_id, pass, game_type, name, description, base_funds, start_time, end_time)
          VALUES(NULL, '${market_id}', NULL, 'season', '${name}', '${description}', '${base_funds}', ${start_time}', '${end_time}')`;

        const result = await db.query(sql);
        if (result.affectedRows !== 1){
          throw new Error("CREATESEASONALGAME_FAIL");
        }

        // return new game id
        const new_game_id = await getGameID(name);
        resolve(new_game_id);
      } catch (error) {
        reject(error);
      }
    });
  },

  // Create private game: owner, password, no duration
  createPrivateGame: (owner_id, password, name, description, base_funds, market_id) => {
    return new Promise(async (resolve, reject) => {
      try {
        const hashed_pw = hashGamePassword(password);

        let sql = `
          INSERT INTO
          game(owner_id, market_id, pass, game_type, name, description, start_time, end_time)
          VALUES('${owner_id}', '${market_id}', ${hashed_pw}', 'private', '${name}', '${description}', '${base_funds}', NULL, NULL)`;

        const result = await db.query(sql);
        if (result.affectedRows !== 1) {
          throw new Error("CREATEPRIVATEGAME_FAIL");
        }

        // return new game id
        const new_game_id = await getGameID(name);
        resolve(new_game_id);
      } catch (error) {
        reject(error);
      }
    })
  },

  setGameClosed: (game_id, closed) => {
    return new Promise(async (resolve, reject) => {
      try {
        let cn = closed ? 1 : 0;
        let sql = `UPDATE game SET closed='${cn}' WHERE id='${game_id}'`;

        const result = await db.query(sql);
        if (result.affectedRows !== 1) {
          throw new Error("CLOSEGAME_FAIL");
        }
        resolve('OK');
      } catch (error) {
        reject(error);
      }
    });
  },

  editGameDescription: (game_id, new_description) => {
    return new Promise(async (resolve, reject) => {
      try {
        let sql = `UPDATE game SET description='${new_description}' WHERE id='${game_id}'`;

        const result = await db.query(sql);
        if (result.affectedRows !== 1) {
          throw new Error("EDITGAMEDESCRIPTION_FAIL");
        }
        resolve('OK');
      } catch (error) {
        reject(error);
      }
    });
  },

  editGameName: (game_id, new_name) => {
    return new Promise(async (resolve, reject) => {
      try {
        let sql = `UPDATE game SET name='${new_name}' WHERE id='${game_id}'`;

        const result = await db.query(sql);
        if (result.affectedRows !== 1) {
          throw new Error("EDITGAMENAME_FAIL");
        }
        resolve('OK');
      } catch (error) {
        reject(error);
      }
    });
  },

  editGameStartTime: (game_id, start_time) => {
    return new Promise(async (resolve, reject) => {
      try {
        let sql = `UPDATE game SET start_time='${start_time}' WHERE id='${game_id}'`;

        const result = await db.query(sql);
        if (result.affectedRows !== 1) {
          throw new Error("EDITGAMESTARTTIME_FAIL");
        }
        resolve('OK');
      } catch (error) {
        reject(error);
      }
    });
  },

  editGameEndTime: (game_id, end_time) => {
    return new Promise(async (resolve, reject) => {
      try {
        let sql = `UPDATE game SET end_time='${end_time}' WHERE id='${game_id}'`;

        const result = await db.query(sql);
        if (result.affectedRows !== 1) {
          throw new Error("EDITGAMEENDTIME_FAIL");
        }
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
          throw new Error("BUYSTOCK_NOT_ENOUGH");
        }

        const game_info = await getGameInfo(game_id);

        // TODO: only allow buying when stock market is open?
        // TODO: only allow buying when game is active (start_time, end_time)

        const game_closed = await isGameClosed(game_id);
        if (game_closed) {
          throw new Error("BUYSTOCK_GAME_CLOSED");
        }

        const joined_game = await hasPlayerJoinedGame(token_info.user_id, game_id);
        if (!joined_game) {
          throw new Error("BUYSTOCK_NOT_JOINED");
        }

        if (game_info.game_type === 'season') {
          const game_active = await isGameActive(game_id);
          if (!game_active) {
            throw new Error("BUYSTOCK_GAME_INACTIVE");
          }
        }

        // start buy transaction
        let stock_sql = `
          INSERT INTO stock_event(user_id, stock_id, game_id, amount, transaction_type, unit_price)
          VALUES('${user_id}', '${stock_id}', '${game_id}', '${amount}', 'B', '${stock_price}')`;

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

        if (user_stock < amount) {
          throw new Error("SELLSTOCK_NOT_ENOUGH");
        }

        const game_info = await getGameInfo(game_id);

        // TODO: only allow selling when stock market is open?
        // TODO: only allow selling when game is active (start_time, end_time)

        const joined_game = await hasPlayerJoinedGame(user_id, game_id);
        if (!joined_game) {
          throw new Error("SELLSTOCK_NOT_JOINED");
        }

        if (game_info.game_type === 'season') {
          const game_active = await isGameActive(game_id);
          if (!game_active) {
            throw new Error("SELLSTOCK_GAME_INACTIVE");
          }
        }

        const rewarded_funds = Number(amount) * Number(stock_price);

        // start sell transaction
        let stock_sql = `
          INSERT INTO stock_event(user_id, stock_id, game_id, amount, transaction_type, unit_price)
          VALUES('${user_id}', '${stock_id}', '${game_id}', '${amount}', 'S', '${stock_price}')`;

        let funds_sql = `UPDATE user_game SET funds=funds+'${rewarded_funds}' WHERE user_id='${user_id}' AND game_id='${game_id}'`;

        const results = await db.transaction(stock_sql, funds_sql, 1, 1);

        resolve(results);
      } catch (error) {
        reject(error);
      }
    });
  },


  getAllGames: () => {
    return new Promise(async (resolve, reject) => {
      try {
        let sql = `SELECT * FROM game`;

        const results = await db.query(sql);
        resolve(results);
      } catch (error) {
        reject(error);
      }
    });
  },
};