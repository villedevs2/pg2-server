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

// Private info about a game. User needs to have joined to access this info.
const getPrivateGameInfo = (params) => {
  return new Promise(async (resolve, reject) => {
    try {
      const game_id = params.game_id;
      const access_token = params.token;

      if (game_id === undefined || access_token === undefined) {
        throw new Error("INVALID_PARAMETERS");
      }

      const user_id = user.validateAccessToken(access_token);

      const has_joined = await hasPlayerJoinedGame(user_id, game_id);
      if (!has_joined) {
        throw new Error("PLAYER_NOT_JOINED");
      }

      let sql = `
        SELECT base_funds, private, pass, start_time, end_time, closed, per_trade_fee, per_stock_fee
        FROM game WHERE id='${game_id}'`;

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

// for internal use, don't export
const getGameInfo = (game_id) => {
  return new Promise(async (resolve, reject) => {
    try {
      let sql = `
        SELECT game_type, closed, pass, base_funds, start_time, end_time, per_trade_fee, per_stock_fee
        FROM game WHERE id='${game_id}'`;
      const result = await db.query(sql);
      if (result.length !== 1) {
        throw new Error("GAME_NOT_FOUND");
      }
      resolve(result[0]);
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
// TODO: rename to user?
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



const getPublicGameList = () => {
  return new Promise(async (resolve, reject) => {
    try {
      // TODO: only show active ones

      let sql = `
        SELECT id, name, description, game_type, start_time, end_time
        FROM game WHERE game_type='open' OR game_type='season' OR game_type='promotion'`;

      const results = await db.query(sql);
      resolve(results);
    } catch (error) {
      reject(error);
    }
  });
};

const getUserJoinedGames = (params) => {
  return new Promise(async (resolve, reject) => {
    try {
      const access_token = params.token;
      if (access_token === undefined) {
        throw new Error("INVALID_PARAMETERS");
      }

      // TODO: only show active ones (not end of season)

      const user_id = user.validateAccessToken(access_token);

      let sql = `
        SELECT g.id, g.name, g.description, g.game_type, g.start_time, g.end_time
        FROM game AS g, user_game AS ug WHERE ug.game_id=g.id AND ug.user_id='${user_id}'`;

      const results = await db.query(sql);
      resolve(results);
    } catch (error) {
      reject(error);
    }
  });
};


const getUserOwnedGames = (params) => {
  return new Promise(async (resolve, reject) => {
    try {
      const access_token = params.token;
      if (access_token === undefined) {
        throw new Error("INVALID_PARAMETERS");
      }

      const user_id = user.validateAccessToken(access_token);

      let sql = `
        SELECT id, name, description, start_time, end_time
        FROM game WHERE owner_id='${user_id}'`;

      const results = await db.query(sql);
      resolve(results);
    } catch (error) {
      reject(error);
    }
  });
};



// ***************************************************************************
// Gets the list of stock for the given game
// ***************************************************************************
const getStockList = (params) => {
  return new Promise(async (resolve, reject) => {
    try {
      const game_id = params.game_id;

      if (game_id === undefined) {
        throw new Error("INVALID_PARAMETERS");
      }

      let sql = `
        SELECT
        s.symbol AS 'symbol',
        s.full_name AS 'full_name',
        s.price AS 'price',
        s.variety AS 'variety',
        s.update_date AS 'update_date'
        FROM stock AS s, game AS g WHERE s.market_id=g.market_id AND g.id='${game_id}'`;

      const results = await db.query(sql);
      resolve({stock_list: results});
    } catch (error) {
      reject(error);
    }
  });
};

const getStockRisers = (game_id, amount) => {
  return new Promise(async (resolve, reject) => {
    if (amount === null) {
      amount = 5;
    }

    let sql = `
        SELECT
        s.symbol AS 'symbol',
        s.full_name AS 'full_name',
        s.price AS 'price',
        s.variety AS 'variety',
        s.update_date AS 'update_date'
        FROM stock AS s, game AS g WHERE s.market_id=g.market_id AND g.id='${game_id}'
        ORDER BY s.variety LIMIT '${amount}'`;

    try {
      const results = await db.query(sql);
      resolve(results);
    } catch (error) {
      reject(error);
    }
  });
};

const getStockFallers = (game_id, amount) => {
  return new Promise(async (resolve, reject) => {
    if (amount === null) {
      amount = 5;
    }

    let sql = `
        SELECT
        s.symbol AS 'symbol',
        s.full_name AS 'full_name',
        s.price AS 'price',
        s.variety AS 'variety',
        s.update_date AS 'update_date'
        FROM stock AS s, game AS g WHERE s.market_id=g.market_id AND g.id='${game_id}'
        ORDER BY s.variety DESC LIMIT '${amount}'`;

    try {
      const results = await db.query(sql);
      resolve(results);
    } catch (error) {
      reject(error);
    }
  });
};

// ***************************************************************************
// Get the leaderboard for the given game
// ***************************************************************************
const getLeaderboard =(params) => {
  return new Promise(async (resolve, reject) => {


    try {
      const game_id = params.game_id;
      const access_token = params.token;
      let start = params.start;
      let amount = params.amount;

      if (game_id === undefined || access_token === undefined) {
        throw new Error("GETLEADERBOARD_INVALID_PARAMS");
      }

      if (start === undefined) {
        start = 0;
      }
      if (amount === undefined) {
        amount = 15;
      }

      const user_id = user.validateAccessToken(access_token);

      // user needs to be part of this game to view leaderboard
      const joined_game = await hasPlayerJoinedGame(user_id, game_id);
      if (!joined_game) {
        throw new Error("GETLEADERBOARD_NOT_JOINED");
      }

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

      const results = await db.query(sql);
      resolve(results);
    } catch (error) {
      reject(error);
    }
  });
};


// ***************************************************************************
// Attempts to add the given user to the given game
// ***************************************************************************
const joinGame = (params) => {
  return new Promise(async (resolve, reject) => {
    try {
      const game_id = params.game_id;
      const access_token = params.token;

      if (game_id === undefined || access_token === undefined) {
        throw new Error("INVALID_PARAMETERS");
      }

      const user_id = user.validateAccessToken(access_token);

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
      resolve({message: 'OK'});
    } catch (error) {
      reject(error);
    }
  });
};


// Create open game: no owner, no duration, no password
const createOpenGame = (name, description, base_funds, market_id) => {
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
};


// Create seasonal game: no owner, no password, fixed duration
const createSeasonalGame = (name, description, base_funds, market_id, start_time, end_time) => {
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
};


// Create private game: owner, password, no duration
const createPrivateGame = (owner_id, password, name, description, base_funds, market_id) => {
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
};


const setGameClosed = (game_id, closed) => {
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
};


const editGameDescription = (game_id, new_description) => {
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
};

const editGameName = (game_id, new_name) => {
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
};

const editGameStartTime = (game_id, start_time) => {
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
};

const editGameEndTime = (game_id, end_time) => {
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
};


// ***************************************************************************
// Attempts to buy stock with given user
// ***************************************************************************
const buyStock = (params) => {
  return new Promise(async (resolve, reject) => {
    try {
      const game_id = params.game_id;
      const amount = params.amount;
      const stock_id = params.stock_id;
      const access_token = params.token;

      if (amount === undefined || stock_id === undefined || game_id === undefined || access_token === undefined) {
        throw new Error("INVALID_PARAMETERS");
      }

      const user_id = user.validateAccessToken(access_token);

      const game_info = await getGameInfo(game_id);

      // calculate game-specific fees for this trade
      const fees = game_info.per_trade_fee + (game_info.per_stock_fee * amount);

      const stock_price = await getStockPrice(stock_id);
      const user_funds = await user.getUserFunds(user_id, game_id);

      const needed_funds = (Number(amount) * Number(stock_price)) + Number(fees);
      if (needed_funds > user_funds) {
        throw new Error("BUYSTOCK_NOT_ENOUGH");
      }



      // TODO: only allow buying when stock market is open?
      // TODO: only allow buying when game is active (start_time, end_time)
      // TODO: check trading hours

      const game_closed = await isGameClosed(game_id);
      if (game_closed) {
        throw new Error("BUYSTOCK_GAME_CLOSED");
      }

      const joined_game = await hasPlayerJoinedGame(user_id, game_id);
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

      await db.transaction(stock_sql, funds_sql, 1, 1);

      resolve({message: 'OK'});
    } catch (error) {
      reject(error);
    }
  });
};


// ***************************************************************************
// Attempts to sell stock with given user
// ***************************************************************************
const sellStock = (params) => {
  return new Promise(async (resolve, reject) => {
    try {
      const amount = params.amount;
      const stock_id = params.stock_id;
      const game_id = params.game_id;
      const access_token = params.token;

      if (amount === undefined || stock_id === undefined || game_id === undefined || access_token === undefined) {
        throw new Error("INVALID_PARAMETERS");
      }

      const user_id = user.validateAccessToken(access_token);

      const stock_price = await getStockPrice(stock_id);
      const user_stock = await user.getUserStock(user_id, game_id, stock_id);

      if (user_stock < amount) {
        throw new Error("SELLSTOCK_NOT_ENOUGH");
      }

      const game_info = await getGameInfo(game_id);


      // TODO: only allow selling when stock market is open?
      // TODO: only allow selling when game is active (start_time, end_time)
      // TODO: check trading hours

      const game_closed = await isGameClosed(game_id);
      if (game_closed) {
        throw new Error("SELLSTOCK_GAME_CLOSED");
      }

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

      // calculate game-specific fees for this trade
      const fees = Number(game_info.per_trade_fee + (game_info.per_stock_fee * amount));

      // Include fees into rewarded funds. This can go negative.
      const rewarded_funds = (Number(amount) * Number(stock_price)) - fees;
      const user_funds = Number(await user.getUserFunds(user_id, game_id));

      // check if we are going negative after fees
      if ((user_funds + rewarded_funds) < 0) {
        throw new Error("SELLSTOCK_NOT_ENOUGH_FUNDS");
      }

      // start sell transaction
      let stock_sql = `
          INSERT INTO stock_event(user_id, stock_id, game_id, amount, transaction_type, unit_price)
          VALUES('${user_id}', '${stock_id}', '${game_id}', '${amount}', 'S', '${stock_price}')`;

      let funds_sql = `UPDATE user_game SET funds=funds+'${rewarded_funds}' WHERE user_id='${user_id}' AND game_id='${game_id}'`;

      await db.transaction(stock_sql, funds_sql, 1, 1);

      resolve({message: 'OK'});
    } catch (error) {
      reject(error);
    }
  });
};


const getAllGames = () => {
  return new Promise(async (resolve, reject) => {
    try {
      let sql = `SELECT * FROM game`;

      const results = await db.query(sql);
      resolve(results);
    } catch (error) {
      reject(error);
    }
  });
};



module.exports = {
  getPrivateGameInfo: getPrivateGameInfo,
  getPublicGameList: getPublicGameList,
  getUserJoinedGames: getUserJoinedGames,
  getUserOwnedGames: getUserOwnedGames,
  getStockList: getStockList,
  getStockRisers: getStockRisers,
  getStockFallers: getStockFallers,
  getLeaderboard: getLeaderboard,
  joinGame: joinGame,
  hasPlayerJoinedGame: hasPlayerJoinedGame,
  createOpenGame: createOpenGame,
  createSeasonalGame: createSeasonalGame,
  createPrivateGame: createPrivateGame,
  setGameClosed: setGameClosed,
  editGameDescription: editGameDescription,
  editGameName: editGameName,
  editGameStartTime: editGameStartTime,
  editGameEndTime: editGameEndTime,
  buyStock: buyStock,
  sellStock: sellStock,
  getAllGames: getAllGames,
};