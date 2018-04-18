// Facebook authentication module

const db = require('./database');
const crypto = require('crypto');
const https = require('https');

const settings = require('./settings.json');


const encryptUserID = (user_id) => {
  const iv = crypto.randomBytes(16);

  const key = settings.db_crypto;
  const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
  const iv_string = iv.toString('hex');

  let encrypted = cipher.update(user_id, 'utf8', 'hex');
  encrypted += cipher.final('hex');

  const token = `FB${iv_string}${encrypted}`;
  return token;
};

const decryptUserID = (user_id) => {
  const iv = new Buffer(user_id.slice(2, 34), 'hex');

  const key = settings.db_crypto;
  const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
  const ct = user_id.slice(34);

  let decrypted = decipher.update(ct, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
};

// *****************************************************************************
// Check if an FB account is already registered in DB
// *****************************************************************************
const isFBAccountRegistered = (account, callback) => {
  const token = encryptUserID(account);

  console.log(`Looking for token ${account}/${token}`);

  console.log(`Token decrypt: ${decryptUserID(token)}`);


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
const registerWithFB = (user_id, user_name, callback) => {
  const token = encryptUserID(user_id);

  let sql = '';
  sql += `INSERT INTO user_account(username, account_link, access_token, signup_date) `;
  sql += `VALUES('${user_name}', '${token}', NULL, CURRENT_TIMESTAMP)`;

  db.query(sql, (error, results) => {
    let value = results.length > 0;
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
      console.log(body);

      const response = JSON.parse(body);

      console.log(response.data.app_id);
      console.log(response.data.user_id);
      console.log(response.data.is_valid);

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

  login: (user_id, auth_token, callback) => {
    // verify from Facebook that this is a valid access token for this user
    isValidFBToken(auth_token, user_id, (valid) => {
      if (valid) {
        isFBAccountRegistered(user_id, (error, exists) => {
          if (error) {
            throw error;
          }

          if (exists) {
            // TODO: get access token
            callback(false, {message: "OK"});
          } else {
            callback(true, {message: "Account doesn't exist"});
          }
        });

      } else {
        callback(true, {message: "Invalid access token"});
      }
    });
  },

  register: (user_id, auth_token, user_name, callback) => {
    // first check for valid FB token
    isValidFBToken(auth_token, user_id, (valid) => {
      if (valid) {
        // check if the account already exists
        isFBAccountRegistered(user_id, (error, exists) => {
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
                registerWithFB(user_id, user_name, (error, result) => {
                  if (error) {
                    throw error;
                  }

                  // TODO: autologin and return access token
                  callback(false, {message: "OK"});
                });
              } else {
                callback(true, {message: "Username already exists"});
              }
            });

          } else {
            callback(true, {message: "Account already exists"});
          }
        });
      } else {
        callback(true, {message: "Invalid access token"});
      }
    });
  }

};