// User management module

const db = require('./database');
const crypto = require('crypto');
const email_validator = require('email-validator');

const settings = require('./settings.json');


const ACCESS_TOKEN_VERSION = 0x0001;
const ACCESS_TOKEN_ID = 'PGTOKEN';


const doesUsernameExist = (username) => {
  return new Promise(async (resolve, reject) => {
    let sql = `SELECT id FROM user_account WHERE username='${username}'`;

    try {
      const results = await db.query(sql);
      resolve(results.length === 1);
    } catch (error) {
      reject(error);
    }
  });
};

const doesEmailExist = (email) => {
  return new Promise(async (resolve, reject) => {
    let sql = `SELECT id FROM user_account WHERE email='${email}'`;

    try {
      const results = await db.query(sql);
      resolve(results.length === 1);
    } catch (error) {
      reject(error);
    }
  });
};

const hashPassword = (password) => {
  const hash = crypto.createHash('sha256');
  hash.update(`${password}.${settings.db_pass_salt}`);
  return hash.digest('hex');
};

const getUserIDWithUsername = (username) => {
  return new Promise(async (resolve, reject) => {
    let sql = `SELECT id FROM user_account WHERE username='${username}'`;

    try {
      const results = await db.query(sql);
      let value = null;
      if (results.length > 0) {
        value = results[0].id;
      }
      resolve(value);
    } catch (error) {
      reject(error);
    }

  });
};

const isUserFollowed = (user_id, followed_user_id) => {
  return new Promise(async (resolve, reject) => {
    let sql = `SELECT * FROM user_follow WHERE user_id='${user_id}' AND followed_id='${followed_user_id}'`;

    try {
      const result = await db.query(sql);
      resolve(result.length === 1);
    } catch (error) {
      reject(error);
    }

  });
};

const generateAccessToken = (user_id) => {
  const header_buffer = Buffer(13);
  header_buffer.writeUInt16BE(ACCESS_TOKEN_VERSION, 0);
  header_buffer.write(ACCESS_TOKEN_ID, 2, 'utf8');
  header_buffer.writeUInt32BE(user_id, 9);

  const random_buffer = crypto.randomBytes(19);

  const buffer = Buffer.concat([header_buffer, random_buffer]);

  // encrypt it
  const iv = crypto.randomBytes(16);
  const key = settings.db_crypto;
  const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
  const iv_string = iv.toString('hex');

  let encrypted = cipher.update(buffer, 'utf8', 'hex');
  encrypted += cipher.final('hex');

  return `${iv_string}${encrypted}`;
};

const validateAccessToken = (token) => {
  const iv = new Buffer(token.slice(0, 32), 'hex');
  const key = settings.db_crypto;
  const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
  const ct = token.slice(32, 128);

  // decrypt it
  let decrypted = decipher.update(ct, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  const buffer = Buffer.from(decrypted);

  const version = buffer.readUInt16BE(0);
  const token_id = buffer.slice(2, 9).toString('utf8');
  const user_id = buffer.readUInt32BE(9);

  const result = {
    valid: (version === ACCESS_TOKEN_VERSION && token_id === ACCESS_TOKEN_ID),
    user_id: user_id,
  };

  return result;
};

const updateAccessToken = (user_id, access_token) => {
  return new Promise(async (resolve, reject) => {
    let sql = `UPDATE user_account SET access_token='${access_token}' WHERE id='${user_id}'`;

    try {
      const results = await db.query(sql);
      resolve(results.changedRows === 1);
    } catch (error) {
      reject(error);
    }
  });

};


module.exports = {
  // ***************************************************************************
  // Generate a new access token
  // ***************************************************************************
  generateAccessToken: generateAccessToken,

  // ***************************************************************************
  // Check whether this a valid access token
  // ***************************************************************************
  validateAccessToken: validateAccessToken,

  // ***************************************************************************
  // Update the access token for a given user ID
  // ***************************************************************************
  updateAccessToken: updateAccessToken,

  // ***************************************************************************
  // Gets info for a user with User ID and Access Token
  // ***************************************************************************
  getInfo: (user_id, access_token) => {
    return new Promise(async (resolve, reject) => {
      let sql = `SELECT username, access_token, signup_date, image `;
      sql +=    `FROM user_account WHERE id='${user_id}'`;

      try {
        const results = await db.query(sql);
        if (results.length !== 1) {
          throw "User not found";
        }
        if (results[0].access_token !== access_token) {
          throw "Wrong access token";
        }

        resolve(results);
      } catch (error) {
        reject(error);
      }

    });
  },

  // ***************************************************************************
  // Follow a user
  // ***************************************************************************
  followUser: (user_id, followed_user_id) => {
    return new Promise(async (resolve, reject) => {
      let sql = `INSERT INTO user_follow(user_id, followed_id) VALUES('${user_id}', '${followed_user_id}')`;

      try {
        if (user_id === followed_user_id) {
          reject('FOLLOW_USER_SELF');
        }

        const result = await db.query(sql);
        if (result.affectedRows !== 1) {
          reject('FOLLOW_USER_RESULT');
        }
        resolve('OK');
      } catch (error) {
        console.log(error);
        reject('DATABASE_FAIL');
      }
    });
  },

  // ***************************************************************************
  // Unfollow a user
  // ***************************************************************************
  unfollowUser: (user_id, followed_user_id) => {
    return new Promise(async (resolve, reject) => {
      let sql = `DELETE FROM user_follow WHERE user_id='${user_id}' AND followed_id='${followed_user_id}'`;

      try {
        const result = await db.query(sql);
        if (result.affectedRows !== 1) {
          reject('UNFOLLOW_USER_RESULT');
        }
        resolve('OK');
      } catch (error) {
        console.log(error);
        reject('DATABASE_FAIL');
      }
    });
  },

  // ***************************************************************************
  // Count the number of followers for a user
  // ***************************************************************************
  countUserFollowers: (user_id) => {
    return new Promise(async (resolve, reject) => {
      let sql = `SELECT COUNT(followed_id) AS 'followers' FROM user_follow WHERE followed_id='${user_id}'`;

      try {
        const result = await db.query(sql);
        resolve(result);
      } catch (error) {
        reject(error);
      }
    });
  },

  // ***************************************************************************
  // Gets the funds of a given user/game
  // ***************************************************************************
  getUserFunds: (user_id, game_id) => {
    return new Promise(async (resolve, reject) => {
      let sql = `SELECT funds FROM user_game WHERE user_id='${user_id}' AND game_id='${game_id}'`;

      try {
        const results = await db.query(sql);
        if (results.length !== 1) {
          throw "getUserFunds: can't fetch funds";
        }
        resolve(results[0].funds);
      } catch (error) {
        reject(error);
      }
    });
  },

  // ***************************************************************************
  // Get the buy history for user/game
  // ***************************************************************************
  getBuyHistory: (user_id, game_id) => {
    return new Promise(async (resolve, reject) => {
      /*
      let sql = ``;
      sql += `SELECT s.symbol, s.full_name, amount, unit_price, DATE_FORMAT(transaction_time, '%d.%m.%Y %k:%i:%s') AS 'tst' `;
      sql += `FROM stock_event, stock AS s `;
      sql += `WHERE transaction_type='B' AND s.id=stock_id AND user_id='${user_id}' AND game_id='${game_id}' `;
      sql += `ORDER BY tst DESC`;
      */

      let sql = ` 
        SELECT s.symbol, s.full_name, amount, unit_price, DATE_FORMAT(transaction_time, '%d.%m.%Y %k:%i:%s') AS 'tst'
        FROM stock_event, stock AS s
        WHERE transaction_type='B' AND s.id=stock_id AND user_id='${user_id}' AND game_id='${game_id}'
        ORDER BY tst DESC`;

      try {
        const results = await db.query(sql);
        resolve(results);
      } catch (error) {
        reject(error);
      }
    });
  },

  // ***************************************************************************
  // Get the sell history for user/game
  // ***************************************************************************
  getSellHistory: (user_id, game_id) => {
    return new Promise(async (resolve, reject) => {
      let sql = `
        SELECT s.symbol, s.full_name, amount, unit_price, DATE_FORMAT(transaction_time, '%d.%m.%Y %k:%i:%s') AS 'tst'
        FROM stock_event, stock AS s
        WHERE transaction_type='S' AND s.id=stock_id AND user_id='${user_id}' AND game_id='${game_id}'
        ORDER BY tst DESC`;

      try {
        const results = await db.query(sql);
        resolve(results);
      } catch (error) {
        reject(error);
      }
    });
  },


  // ***************************************************************************
  // Get the amount of given stock for user/game
  // ***************************************************************************
  getUserStock: (user_id, game_id, stock_id) => {
    return new Promise(async (resolve, reject) => {
      let sql = ``;
      sql += `SELECT buy_sum-sell_sum AS 'assets' `;
      sql += `FROM( `;
      sql += `SELECT user_id, stock_id, SUM(buy) AS buy_sum, SUM(sell) AS sell_sum `;
      sql += `FROM( `;
      sql += `SELECT user_id, stock_id, amount AS 'buy', 0 AS 'sell' `;
      sql += `FROM stock_event `;
      sql += `WHERE transaction_type='B' AND game_id='${game_id}' AND user_id='${user_id}' AND stock_id='${stock_id}' `;
      sql += `UNION ALL `;
      sql += `SELECT user_id, stock_id, 0 AS 'buy', amount AS 'sell' `;
      sql += `FROM stock_event `;
      sql += `WHERE transaction_type='S' AND game_id='${game_id}' AND user_id='${user_id}' AND stock_id='${stock_id}' `;
      sql += `) AS summed `;
      sql += `GROUP BY user_id, stock_id `;
      sql += `) AS final, stock `;
      sql += `WHERE final.stock_id=stock.id `;

      try {
        const results = await db.query(sql);
        if (results.length !== 1) {
          throw "getUserStock: can't find stock";
        }
        resolve(results[0].assets);
      } catch (error) {
        reject(error);
      }
    });
  },

  // ***************************************************************************
  // Try to login with username/password
  // ***************************************************************************
  loginWithPass: (username, password) => {
    return new Promise(async (resolve, reject) => {
      try {
        const exists = await doesUsernameExist(username);
        if (!exists) {
          throw "Username does not exist";
        }

        let sql = `SELECT id, pass FROM user_account WHERE username='${username}'`;

        const results = await db.query(sql);
        if (results.length !== 1) {
          throw "Database error in login";
        }

        const hashed_pw = hashPassword(password);
        if (results[0].pass !== hashed_pw) {
          throw "Wrong password";
        }

        // get user id for the new account
        const user_id = results[0].id;
        if (user_id === null) {
          throw "User ID not found";
        }

        // try to update the access token
        const access_token = generateAccessToken(user_id);
        const update_ok = await updateAccessToken(user_id, access_token);
        if (!update_ok) {
          throw "Cannot update access token";
        }

        // all ok!
        resolve({token: access_token});
      } catch (error) {
        reject(error);
      }
    });
  },

  // ***************************************************************************
  // Try to register with username/password/email
  // ***************************************************************************
  registerWithPass: (username, password, email) => {
    return new Promise(async (resolve, reject) => {
      try {
        const exists = await doesUsernameExist(username);
        if (exists) {
          throw "Username already in use";
        }

        const valid_email = email_validator.validate(email);
        if (!valid_email) {
          throw "Invalid E-mail address";
        }

        const email_exists = await doesEmailExist(email);
        if (email_exists) {
          throw "E-mail address already in use";
        }

        const hashed_pw = hashPassword(password);

        // TODO: encrypt email?
        let sql = '';
        sql += `INSERT INTO user_account(username, pass, email, access_token, signup_date) `;
        sql += `VALUES('${username}', '${hashed_pw}', '${email}', NULL, CURRENT_TIMESTAMP)`;

        const results = await db.query(sql);

        if (results.affectedRows !== 1) {
          throw "Registering failed";
        }

        // get user id for the new account
        const user_id = await getUserIDWithUsername(username);
        if (user_id === null) {
          throw "User ID not found";
        }

        // try to update the access token
        const access_token = generateAccessToken(user_id);
        const update_ok = await updateAccessToken(user_id, access_token);
        if (!update_ok) {
          throw "Cannot update access token";
        }

        // all ok!
        resolve({token: access_token});
      } catch (error) {
        reject(error);
      }
    });
  },

};

