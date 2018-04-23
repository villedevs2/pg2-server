// Facebook authentication module


const crypto = require('crypto');
const https = require('https');

const db = require('./database');
const user = require('./user');

const settings = require('./settings.json');

// *****************************************************************************
// Hash a FB account ID
// *****************************************************************************
const hashFBAccount = (fb_account) => {
  const hash = crypto.createHash('sha256');
  hash.update(fb_account);
  const digest = `FB${hash.digest('hex')}`;
  return digest;
};

// *****************************************************************************
// Get a user ID for a given FB account
// *****************************************************************************
const getUserID = (fb_account, callback) => {
  const token = hashFBAccount(fb_account);

  console.log(token);

  let sql = `SELECT id FROM user_account WHERE account_link='${token}'`;

  db.query(sql, (error, results) => {
    let value = null;
    if (results.length > 0) {
      value = results[0].id;
    }
    callback(error, value);
  });
};

// *****************************************************************************
// Check if an FB account is already registered in DB
// *****************************************************************************
const isFBAccountRegistered = (fb_account, callback) => {
  const token = hashFBAccount(fb_account);

  let sql = `SELECT id FROM user_account WHERE account_link='${token}'`;

  db.query(sql, (error, results) => {
    let value = results.length > 0;
    callback(error, value);
  });
};

// *****************************************************************************
// Check if the username is already registered
// *****************************************************************************
const isUsernameRegistered = (username, callback) => {
  let sql = `SELECT id FROM user_account WHERE username='${username}'`;

  db.query(sql, (error, results) => {
    let value = results.length > 0;
    callback(error, value);
  });
};

// *****************************************************************************
// Register a new user using Facebook
// *****************************************************************************
const registerWithFB = (fb_account, user_name, callback) => {
  const token = hashFBAccount(fb_account);

  let sql = '';
  sql += `INSERT INTO user_account(username, account_link, access_token, signup_date) `;
  sql += `VALUES('${user_name}', '${token}', NULL, CURRENT_TIMESTAMP)`;

  db.query(sql, (error, results) => {
    let value = results.affectedRows === 1;
    callback(error, value);
  });
};

// *****************************************************************************
// Validate an FB access token with FB
// *****************************************************************************
const isValidFBToken = (token, user_id, callback) => {
  const fbUrl = `https://graph.facebook.com/debug_token`;

  const inputToken = `input_token=${token}`;
  const accessToken = `access_token=${settings.fb_appid}|${settings.fb_apps}`;

  https.get(`${fbUrl}?${inputToken}&${accessToken}`, (res) => {
    let body = '';
    res.on('data', (data) => {
      body += data;
    });
    res.on('end', () => {
      const response = JSON.parse(body);

      if (response.data.app_id === settings.fb_appid &&
          response.data.user_id === user_id &&
          response.data.is_valid === true) {
        callback(true);
      } else {
        callback(false);
      }
    });
  });
};


module.exports = {

  login: (fb_account, auth_token, callback) => {
    // verify from Facebook that this is a valid access token for this user
    isValidFBToken(auth_token, fb_account, (valid) => {
      if (valid) {
        isFBAccountRegistered(fb_account, (error, exists) => {
          if (error) {
            throw error;
          }

          // if account exists, try to login
          if (exists) {
            getUserID(fb_account, (error, user_id) => {
              if (user_id !== null) {
                const access_token = user.generateAccessToken();

                user.updateAccessToken(user_id, access_token, (error, response) => {
                  if (!error && response) {
                    callback({error: false, message: "OK", user_id: user_id, token: access_token});
                  } else {
                    callback({error: true, message: "Cannot update access token"});
                  }
                });

              } else {
                callback({error: true, message: "User ID not found"});
              }
            });
          } else {
            callback({error: true, message: "Account doesn't exist"});
          }
        });

      } else {
        callback({error: true, message: "Invalid access token"});
      }
    });
  },

  register: (fb_account, auth_token, user_name, callback) => {
    // first check for valid FB token
    isValidFBToken(auth_token, fb_account, (valid) => {
      if (valid) {
        // check if the account already exists
        isFBAccountRegistered(fb_account, (error, exists) => {
          if (error) {
            throw error;
          }

          // if not, try to register
          if (!exists) {

            // check if the username already exists
            isUsernameRegistered(user_name, (error, username_exists) => {
              if (error) {
                throw error;
              }

              // if not, try to register
              if (!username_exists) {
                registerWithFB(fb_account, user_name, (error, result) => {
                  if (error) {
                    throw error;
                  }

                  // if registering worked, try to login
                  if (result) {
                    getUserID(fb_account, (error, user_id) => {
                      if (user_id !== null) {
                        const access_token = user.generateAccessToken();

                        user.updateAccessToken(user_id, access_token, (error, response) => {
                          if (!error && response) {
                            callback({error: false, message: "OK", user_id: user_id, token: access_token});
                          } else {
                            callback({error: true, message: "Cannot update access token"});
                          }
                        });

                      } else {
                        callback({error: true, message: "User ID not found"});
                      }
                    });
                  } else {
                    callback({error: true, message: "Registering failed"});
                  }
                });

              } else {
                callback({error: true, message: "Username already exists"});
              }
            });

          } else {
            callback({error: true, message: "Account already exists"});
          }
        });
      } else {
        callback({error: true, message: "Invalid access token"});
      }
    });
  }

};