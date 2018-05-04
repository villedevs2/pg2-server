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
const getUserID = (fb_account) => {
  return new Promise((resolve, reject) => {
    const token = hashFBAccount(fb_account);

    console.log(token);

    let sql = `SELECT id FROM user_account WHERE account_link='${token}'`;

    db.query(sql).then((results) => {
      let value = null;
      if (results.length > 0) {
        value = results[0].id;
      }
      resolve(value);
    }).catch((error) => {
      reject(error);
    });

  });
};

// *****************************************************************************
// Check if an FB account is already registered in DB
// *****************************************************************************
const isFBAccountRegistered = (fb_account) => {
  return new Promise((resolve, reject) => {
    const token = hashFBAccount(fb_account);

    let sql = `SELECT id FROM user_account WHERE account_link='${token}'`;

    db.query(sql).then((results) => {
      let value = results.length > 0;
      resolve(value);
    }).catch((error) => {
      reject(error);
    });

  });
};

// *****************************************************************************
// Check if the username is already registered
// *****************************************************************************
const isUsernameRegistered = (username) => {
  return new Promise((resolve, reject) => {
    let sql = `SELECT id FROM user_account WHERE username='${username}'`;

    db.query(sql).then((results) => {
      let value = results.length > 0;
      resolve(value);
    }).catch((error) => {
      reject(error);
    });

  });
};

// *****************************************************************************
// Register a new user using Facebook
// *****************************************************************************
const registerWithFB = (fb_account, user_name) => {
  return new Promise((resolve, reject) => {
    const token = hashFBAccount(fb_account);

    let sql = '';
    sql += `INSERT INTO user_account(username, account_link, access_token, signup_date) `;
    sql += `VALUES('${user_name}', '${token}', NULL, CURRENT_TIMESTAMP)`;

    db.query(sql).then((results) => {
      let value = results.affectedRows === 1;
      resolve(value);
    }).catch((error) => {
      reject(error);
    });

  });
};

// *****************************************************************************
// Validate an FB access token with FB
// *****************************************************************************
const isValidFBToken = (token, user_id) => {
  return new Promise((resolve, reject) => {
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
          resolve(true);
        } else {
          resolve(false);
        }
      });
    });

  });
};


module.exports = {

  login: (fb_account, auth_token) => {
    return new Promise(async (resolve, reject) => {

      try {
        const token_valid = await isValidFBToken(auth_token, fb_account);
        if (!token_valid) {
          throw "Invalid access token";
        }

        const account_exists = await isFBAccountRegistered(fb_account);
        if (!account_exists) {
          throw "Account doesn't exist";
        }

        const user_id = await getUserID(fb_account);
        if (user_id === null) {
          throw "User ID not found";
        }

        const access_token = user.generateAccessToken(user_id);

        const update_ok = await user.updateAccessToken(user_id, access_token);
        if (!update_ok) {
          throw "Cannot update access token";
        }

        resolve({token: access_token});
      } catch (error) {
        reject(error);
      }

      /*
      // verify from Facebook that this is a valid access token for this user
      isValidFBToken(auth_token, fb_account).then((valid) => {
        if (!valid) {
          reject("Invalid access token");
        }

        isFBAccountRegistered(fb_account).then((exists) => {
          // if account exists, try to login
          if (!exists) {
            reject("Account doesn't exist");
          }

          getUserID(fb_account).then((user_id) => {
            if (user_id === null) {
              reject("User ID not found");
            }

            const access_token = user.generateAccessToken();

            user.updateAccessToken(user_id, access_token).then((response) => {
              if (response) {
                resolve({user_id: user_id, token: access_token});
              } else {
                reject("Cannot update access token");
              }
            }).catch((error) => {
              reject(error);
            });

          }).catch((error) => {
            reject(error);
          });

        }).catch((error) => {
          reject(error);
        });

      }).catch((error) => {
        reject(error);
      });
      */

    });
  },

  register: (fb_account, auth_token, user_name) => {
    return new Promise(async (resolve, reject) => {
      try {
        // first check for valid FB token
        const token_valid = await isValidFBToken(auth_token, fb_account);
        if (!token_valid) {
          throw "Invalid access token";
        }
        // check if the account already exists
        const account_exists = await isFBAccountRegistered(fb_account);
        if (account_exists) {
          throw "Account already exists";
        }
        // check if the username already exists
        const username_exists = await isUsernameRegistered(user_name);
        if (username_exists) {
          throw "Username already exists";
        }
        // try register
        const reg_ok = await registerWithFB(fb_account, user_name);
        if (!reg_ok) {
          throw "Registering failed"
        }
        // get user id for the new account
        const user_id = await getUserID(fb_account);
        if (user_id === null) {
          throw "User ID not found";
        }

        // try to update the access token
        const access_token = user.generateAccessToken(user_id);
        const update_ok = await user.updateAccessToken(user_id, access_token);
        if (!update_ok) {
          throw "Cannot update access token";
        }

        // all ok!
        resolve({token: access_token});
      } catch (error) {
        reject(error);
      }

/*
      // first check for valid FB token
      isValidFBToken(auth_token, fb_account).then((valid) => {
        if (!valid) {
          reject("Invalid access token");
        }

        // check if the account already exists
        isFBAccountRegistered(fb_account).then((exists) => {
          // if not, try to register
          if (exists) {
            reject("Account already exists");
          }

          // check if the username already exists
          isUsernameRegistered(user_name).then((username_exists) => {
            // if not, try to register
            if (username_exists) {
              reject("Username already exists");
            }

            registerWithFB(fb_account, user_name).then((result) => {
              // if registering worked, try to login
              if (!result) {
                reject("Registering failed");
              }

              getUserID(fb_account).then((user_id) => {
                if (user_id === null) {
                  reject("User ID not found");
                }

                const access_token = user.generateAccessToken();
                user.updateAccessToken(user_id, access_token).then((response) => {
                  if (response) {
                    resolve({user_id: user_id, token: access_token});
                  } else {
                    reject("Cannot update access token");
                  }
                }).catch((error) => {
                  reject(error);
                });

              }).catch((error) => {
                reject(error);
              });

            }).catch((error) => {
              reject(error);
            });

          }).catch((error) => {
            reject(error);
          });

        }).catch((error) => {
          reject(error);
        });

      }).catch((error) => {
        reject(error);
      });
*/
    });
  },
};