// Facebook authentication module

const db = require('./database');
const crypto = require('crypto');

const settings = require('./settings.json');


const encryptUserID = (user_id) => {
  const cipher = crypto.createCipher('aes-256-ctr', settings.db_crypto);
  const token = `FB${cipher.update(user_id, 'utf8', 'hex')}`;
  return token;
};

const decryptUserID = (user_id) => {
  const cipher = crypto.createCipher('aes-256-ctr', settings.db_crypto);
  const ct = user_id.slice(2);
  return cipher.update(ct, 'utf8', 'hex');
};

// *****************************************************************************
// Check if an FB account is already registered in DB
// *****************************************************************************
const isFBAccountRegistered = (account, callback) => {
  const token = encryptUserID(account);

  console.log(`Looking for token ${account}/${token}`);

  db.query(`SELECT id FROM user_account WHERE account_link='${token}'`, (error, results) => {
    let value = results.length > 0;
    callback(error, value);
  });
};

// *****************************************************************************
// Register a new user using Facebook
// *****************************************************************************
const registerWithFB = (user_id, user_name, callback) => {
  const token = encryptUserID(user_id);

  db.query(`INSERT INTO user_account(username, account_link, access_token, signup_date)
  VALUES('${user_name}', '${token}', NULL, CURRENT_TIMESTAMP`, (error, results) => {
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
            registerWithFB(user_id, user_name, (error, result) => {
              if (error) {
                throw error;
              }

              // TODO: autologin and return access token
              callback(false, {message: "OK"});
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