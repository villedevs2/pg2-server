// User management module

const db = require('./database');
const crypto = require('crypto');
const validator = require('validator');

const settings = require('./settings.json');


const ACCESS_TOKEN_VERSION = 0x0001;
const ACCESS_TOKEN_ID = 'PGTOKEN';


// regex for username:
// 3-15 characters
// Allowed characters
// A-Ö a-ö 0-9 _ -
const username_regex = new RegExp("^[A-Za-z0-9_\-ÄÅÖäåö]{3,15}$");


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

const getAccountStatus = (user_id) => {
  return new Promise(async (resolve, reject) => {
    let sql = `SELECT account_status FROM user_account WHERE user_id='${user_id}'`;

    try {
      const result = await db.query(sql);
      if (result.length !== 1) {
        throw new Error("GETACCOUNTSTATUS_NOT_FOUND")
      }
      resolve(result[0].account_status);
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

const getUserIDWithEmail = (email) => {
  return new Promise(async (resolve, reject) => {
    let sql = `SELECT id FROM user_account WHERE email='${email}'`;

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

// *****************************************************************************
// Count the amount of followers a user has
// *****************************************************************************
const countUserFollowers = (user_id) => {
  return new Promise(async (resolve, reject) => {
    let sql = `SELECT COUNT(followed_id) AS 'followers' FROM user_follow WHERE followed_id='${user_id}'`;

    try {
      const result = await db.query(sql);
      let followers = 0;
      if (result.length === 1) {
        followers = result[0].followers;
      }
      resolve(followers);
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
  const key = settings.access_token_key;
  const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
  const iv_string = iv.toString('hex');

  let encrypted = cipher.update(buffer, 'utf8', 'hex');
  encrypted += cipher.final('hex');

  return `${iv_string}${encrypted}`;
};

const validateAccessToken = (token) => {
  const iv = new Buffer(token.slice(0, 32), 'hex');
  const key = settings.access_token_key;
  const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
  const ct = token.slice(32, 128);

  // decrypt it
  let decrypted = decipher.update(ct, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  const buffer = Buffer.from(decrypted);

  const version = buffer.readUInt16BE(0);
  const token_id = buffer.slice(2, 9).toString('utf8');
  const user_id = buffer.readUInt32BE(9);

  return {
    valid: (version === ACCESS_TOKEN_VERSION && token_id === ACCESS_TOKEN_ID),
    user_id: user_id,
  };
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

  suspendUser: (user_id, duration) => {
    return new Promise(async (resolve, reject) => {
      let sql = `
        UPDATE user_account SET suspend_end=CURRENT_TIMESTAMP+'${duration}'
        WHERE id='${user_id}'`;

      try {
        const result = await db.query(sql);
        if (result.affectedRows !== 1) {
          throw new Error("SUSPENDUSER_FAIL");
        }
        resolve('OK');
      } catch (error) {
        reject(error);
      }
    });
  },

  banUser: (user_id) => {
    return new Promise(async (resolve, reject) => {
      let sql = `UPDATE user_account SET suspend_end=DATE('9999-12-31') WHERE id='${user_id}'`;

      try {
        const result = await db.query(sql);
        if (result.affectedRows !== 1) {
          throw new Error("BANUSER_FAIL");
        }
        resolve('OK');
      } catch (error) {
        reject(error);
      }
    });
  },

  unbanUser: (user_id) => {
    return new Promise(async (resolve, reject) => {
      let sql = `UPDATE user_account SET suspend_end=NULL WHERE id='${user_id}'`;

      try {
        const result = await db.query(sql);
        if (result.affectedRows !== 1) {
          throw new Error("UNBANUSER_FAIL");
        }
        resolve('OK');
      } catch (error) {
        reject(error);
      }
    });
  },

  isUserSuspended: (user_id) => {
    return new Promise(async (resolve, reject) => {
      let sql = `
        SELECT IF(CURRENT_TIMESTAMP < suspend_end, true, false) AS 'suspended'
        FROM user_account WHERE id='${user_id}'`;

      try {
        const result = await db.query(sql);
        if (result.length !== 1) {
          throw new Error("ISUSERSUSPENDED_NOT_FOUND");
        }
        resolve(result[0].suspended);
      } catch (error) {
        reject(error);
      }
    });
  },

  isUserActivated: (user_id) => {
    return new Promise(async (resolve, reject) => {
      let sql = `
        SELECT IF(account_status == 'active', true, false) AS 'activated'
        FROM user_account WHERE id='${user_id}'`;

      try {
        const result = await db.query(sql);
        if (result.length !== 1) {
          throw new Error("ISUSERACTIVATED_NOT_FOUND");
        }
        resolve(result[0].activated);
      } catch (error) {
        reject(error);
      }
    });
  },


  getAllUsers: () => {
    return new Promise(async (resolve, reject) => {
      let sql = `SELECT id, username, account_link, email, signup_date FROM user_account`;

      try {
        const result = await db.query(sql);
        resolve(result);
      } catch (error) {
        reject(error);
      }
    });
  },


  getUserGames: (user_id) => {
    return new Promise(async (resolve, reject) => {
      let sql = `
        SELECT g.id, g.game_type, g.name, g.description, g.start_time, g.end_time
        FROM game AS g, user_game AS ug
        WHERE g.id=ug.game_id AND ug.user_id='${user_id}'`;

      try {
        const result = await db.query(sql);
        resolve(result);
      } catch (error) {
        reject(error);
      }
    });
  },



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
          throw new Error("GETINFO_NOT_FOUND");
        }
        if (results[0].access_token !== access_token) {
          throw new Error("GETINFO_ACCESS_TOKEN");
        }

        resolve(results);
      } catch (error) {
        reject(error);
      }

    });
  },

  // ***************************************************************************
  // Get publicly available info for a user. Does not require token.
  getUserPublicInfo: (user_id) => {
    return new Promise(async (resolve, reject) => {
      try {
        const followers = await countUserFollowers(user_id);

        let sql = `SELECT username, signup_date, image FROM user_account WHERE id='${user_id}'`;
        const results = await db.query(sql);

        if (results.length !== 1) {
          throw new Error('GETUSERPUBLICINFO_NOT_FOUND');
        }

        results[0].followers = followers;

        resolve(results[0]);
      } catch (error) {
        console.log(error);
        reject('FAIL');
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
          throw new Error('FOLLOW_USER_SELF');
        }

        const result = await db.query(sql);
        if (result.affectedRows !== 1) {
          throw new Error('FOLLOW_USER_RESULT');
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
          throw new Error('UNFOLLOW_USER_RESULT');
        }
        resolve('OK');
      } catch (error) {
        console.log(error);
        reject('DATABASE_FAIL');
      }
    });
  },

  // ***************************************************************************
  // Get a list of followers for a user
  // ***************************************************************************
  getFollowerList: (user_id) => {
    return new Promise(async (resolve, reject) => {
      let sql = `
        SELECT u.id, u.username, u.image, f.follow_date
        FROM user_account AS u, user_follow AS f
        WHERE f.followed_id='${user_id}' AND f.user_id=u.id`;

      // TODO: sort by follow date

      try {
        const results = await db.query(sql);
        resolve(results);
      } catch (error) {
        console.log(error);
        reject('DATABASE_FAIL');
      }
    });
  },

  // ***************************************************************************
  // Get a list of followed users for a user
  // ***************************************************************************
  getFollowingList: (user_id) => {
    return new Promise(async (resolve, reject) => {
      let sql = `
        SELECT u.id, u.username, u.image, f.follow_date
        FROM user_account AS u, user_follow AS f
        WHERE f.user_id='${user_id}' AND f.followed_id=u.id`;

      // TODO: sort by follow date

      try {
        const results = await db.query(sql);
        resolve(results);
      } catch (error) {
        console.log(error);
        reject('DATABASE_FAIL');
      }
    });
  },


  sendUserMessage: (user_id, sender_id, message) => {
    return new Promise(async (resolve, reject) => {
      try {
        // validate message contents
        let message_sane = validator.escape(message.message);
        message_sane = validator.stripLow(message_sane, true);

        // validate message title
        let title_sane = validator.escape(message.title);
        title_sane = validator.stripLow(title_sane, true);

        if (sender_id === null) {
          sender_id = 'NULL';
        } else {
          sender_id = `'${sender_id}'`;
        }


        let sql = `
          INSERT INTO user_message(user_id, sender_id, title, message)
          VALUES('${user_id}', ${sender_id}, '${title_sane}', '${message_sane}')`;

        const result = await db.query(sql);
        if (result.affectedRows !== 1) {
          throw new Error('SENDUSERMESSAGE_FAIL');
        }
        resolve('OK');
      } catch (error) {
        console.log(error);
        reject('DATABASE_FAIL');
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
          throw new Error("GETUSERFUNDS_NOT_FOUND");
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
          throw new Error("GETUSERSTOCK_NOT_FOUND");
        }
        resolve(results[0].assets);
      } catch (error) {
        reject(error);
      }
    });
  },

  commonLogin: (user_id) => {
    return new Promise(async (resolve, reject) => {
      try {
        // check if account is activated
        const account_active = await
        user.isUserActivated(user_id);
        if (!account_active) {
          throw new Error("COMMONLOGIN_ACCOUNT_INACTIVE");
        }

        // check for account suspension
        const account_suspended = await
        user.isUserSuspended(user_id);
        if (account_suspended) {
          throw new Error("COMMONLOGIN_ACCOUNT_SUSPENDED");
        }

        // try to update the access token
        const access_token = generateAccessToken(user_id);
        const update_ok = await
        updateAccessToken(user_id, access_token);
        if (!update_ok) {
          throw new Error("COMMONLOGIN_ACCESS_TOKEN");
        }

        // all ok!
        resolve({token: access_token});
      } catch (error) {
        reject(error);
      }
    });
  },

  // ***************************************************************************
  // Try to login with email/password
  // ***************************************************************************
  loginWithEmail: (email, password) => {
    return new Promise(async (resolve, reject) => {
      try {
        const valid_email = validator.isEmail(email);
        if (!valid_email) {
          throw new Error("EMLOGIN_INVALID_EMAIL");
        }

        const email_exists = await doesEmailExist(email);
        if (!email_exists) {
          throw new Error("EMLOGIN_EMAIL_NOT_FOUND");
        }

        let sql = `SELECT id, pass FROM user_account WHERE email='${email}'`;

        const results = await db.query(sql);
        if (results.length !== 1) {
          throw new Error("EMLOGIN_FAIL");
        }

        const hashed_pw = hashPassword(password);
        if (results[0].pass !== hashed_pw) {
          throw new Error("EMLOGIN_WRONG_PASS");
        }

        // get user id for the new account
        const user_id = results[0].id;
        if (user_id === null) {
          throw new Error("EMLOGIN_USER_ID")
        }

        const login_ok = await user.commonLogin(user_id);
        resolve(login_ok);
      } catch (error) {
        reject(error);
      }
    });
  },

  // ***************************************************************************
  // Try to register with email
  // ***************************************************************************
  registerWithEmail: (email, password, username) => {
    return new Promise(async (resolve, reject) => {
      try {
        // validate username
        const valid_username = username_regex.exec(username) !== null;
        if (!valid_username) {
          throw new Error("EMREGISTER_INVALID_USERNAME");
        }

        const exists = await doesUsernameExist(username);
        console.log(exists);
        if (exists) {
          throw new Error("EMREGISTER_USERNAME_EXISTS");
        }

        const valid_email = validator.isEmail(email);
        if (!valid_email) {
          throw new Error("EMREGISTER_INVALID_EMAIL");
        }

        const email_exists = await doesEmailExist(email);
        if (email_exists) {
          throw new Error("EMREGISTER_EMAIL_EXISTS");
        }

        if (password.length < 8) {
          throw new Error("EMREGISTER_PASSWORD_LENGTH");
        }

        const hashed_pw = hashPassword(password);

        // TODO: encrypt email?
        let sql = '';
        sql += `INSERT INTO user_account(username, pass, email, access_token, signup_date) `;
        sql += `VALUES('${username}', '${hashed_pw}', '${email}', NULL, CURRENT_TIMESTAMP)`;

        const results = await db.query(sql);

        if (results.affectedRows !== 1) {
          throw new Error("EMREGISTER_REG_FAIL");
        }

        // get user id for the new account
        const user_id = await getUserIDWithEmail(email);
        if (user_id === null) {
          throw new Error("EMREGISTER_FAIL");
        }

        const login_ok = await user.commonLogin(user_id);
        resolve(login_ok);
      } catch (error) {
        reject(error);
      }
    });
  },


  // Get a list of avatar options available to user
  getAvatarOptions: (user_id) => {
    return new Promise(async (resolve, reject) => {
      // TODO
    });
  },


  // Make new avatar for user. Upload it to S3.
  setUserAvatar: (user_id, avatar) => {
    return new Promise(async (resolve, reject) => {
      // TODO
    });
  },


};

