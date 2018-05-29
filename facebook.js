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
  return `FB${hash.digest('hex')}`;
};

// *****************************************************************************
// Get a user ID for a given FB account
// *****************************************************************************
const getUserID = (fb_account) => {
  return new Promise(async (resolve, reject) => {
    const token = hashFBAccount(fb_account);

    console.log(token);

    let sql = `SELECT id FROM user_account WHERE account_link='${token}'`;

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

// *****************************************************************************
// Check if an FB account is already registered in DB
// *****************************************************************************
const isFBAccountRegistered = (fb_account) => {
  return new Promise(async (resolve, reject) => {
    const token = hashFBAccount(fb_account);

    let sql = `SELECT id FROM user_account WHERE account_link='${token}'`;

    try {
      const results = await db.query(sql);
      resolve(results.length > 0);
    } catch (error) {
      reject(error);
    }

  });
};

// *****************************************************************************
// Check if the username is already registered
// *****************************************************************************
const isUsernameRegistered = (username) => {
  return new Promise(async (resolve, reject) => {
    let sql = `SELECT id FROM user_account WHERE username='${username}'`;

    try {
      const results = await db.query(sql);
      resolve(results.length > 0);
    } catch (error) {
      reject(error);
    }

  });
};

// *****************************************************************************
// Register a new user using Facebook
// *****************************************************************************
const registerWithFB = (fb_account, user_name) => {
  return new Promise(async (resolve, reject) => {
    const token = hashFBAccount(fb_account);

    let sql = `
      INSERT INTO user_account(username, account_link, account_status, access_token, signup_date)
      VALUES('${user_name}', '${token}', 'active', NULL, CURRENT_TIMESTAMP)`;

    try {
      const results = await db.query(sql);
      resolve(results.affectedRows === 1);
    } catch (error) {
      reject(error);
    }

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


const login = (params) => {
  return new Promise(async (resolve, reject) => {

    try {
      const fb_account = params.fb_account;
      const auth_token = params.auth_token;

      if (fb_account === undefined || auth_token === undefined) {
        throw new Error("FBLOGIN_INVALID_PARAMETERS");
      }

      const token_valid = await isValidFBToken(auth_token, fb_account);
      if (!token_valid) {
        throw new Error("FBLOGIN_INVALID_TOKEN");
      }

      const account_exists = await isFBAccountRegistered(fb_account);
      if (!account_exists) {
        throw new Error("FBLOGIN_ACCOUNT_NOT_FOUND");
      }

      const user_id = await getUserID(fb_account);
      if (user_id === null) {
        throw new Error("FBLOGIN_USER_ID_NOT_FOUND");
      }

      const login_ok = await user.commonLogin(user_id);
      resolve(login_ok);
    } catch (error) {
      reject(error);
    }
  });
};


const register = (fb_account, auth_token, user_name) => {
  return new Promise(async (resolve, reject) => {
    try {
      const fb_account = params.fb_account;
      const auth_token = params.auth_token;
      const user_name = params.user_name;

      if (fb_account === undefined || auth_token === undefined || user_name === undefined) {
        throw new Error("FBREGISTER_INVALID_PARAMETERS");
      }

      // first check for valid FB token
      const token_valid = await isValidFBToken(auth_token, fb_account);
      if (!token_valid) {
        throw new Error("FBREGISTER_INVALID_TOKEN");
      }
      // check if the account already exists
      const account_exists = await isFBAccountRegistered(fb_account);
      if (account_exists) {
        throw new Error("FBREGISTER_ACCOUNT_EXISTS");
      }
      // check if the username already exists
      const username_exists = await isUsernameRegistered(user_name);
      if (username_exists) {
        throw new Error("FBREGISTER_USERNAME_EXISTS");
      }
      // try register
      const reg_ok = await registerWithFB(fb_account, user_name);
      if (!reg_ok) {
        throw new Error("FBREGISTER_REG_FAIL");
      }

      // get user id for the new account
      const user_id = await getUserID(fb_account);
      if (user_id === null) {
        throw new Error("FBREGISTER_USER_ID_NOT_FOUND");
      }

      await user.commonRegister(user_id);

      const login_ok = await user.commonLogin(user_id);
      resolve(login_ok);
    } catch (error) {
      reject(error);
    }
  });
};




module.exports = {
  login: login,
  register: register,
};