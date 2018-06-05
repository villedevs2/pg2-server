// User management module

const db = require('./database');
const crypto = require('crypto');
const validator = require('validator');
const fs = require('fs');

const jsdom = require('jsdom');
const { JSDOM } = jsdom;

const settings = require('./settings.json');


const ACCESS_TOKEN_VERSION = 0x0001;
const ACCESS_TOKEN_ID = 'PGTOKEN';

const ACTIVATION_TOKEN_VERSION = 0x0001;
const ACTIVATION_TOKEN_ID = 'PGACTIV';



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

const doesUserExist = (user_id) => {
  return new Promise(async (resolve, reject) => {
    try {
      let sql = `SELECT id FROM user_account WHERE id='${user_id}'`;
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

const makeAvatarUrl = (user_id) => {
  const hash = crypto.createHash('sha256');
  hash.update(`${user_id}.${settings.db_avatar_image_salt}`);
  return `avatar-${hash.digest('hex')}.webp`;
}

const getUserIDWithEmail = (email) => {
  return new Promise(async (resolve, reject) => {
    let sql = `SELECT id FROM user_account WHERE email='${email}'`;

    try {
      const results = await db.query(sql);
      if (results.length !== 1) {
        throw new Error("GETUSERIDWITHEMAIL_NOT_FOUND");
      }
      resolve(results[0].id);
    } catch (error) {
      reject(error);
    }

  });
};

const isUserFollowed = (params) => {
  return new Promise(async (resolve, reject) => {
    try {
      const followed_user_id = params.followed_id;
      const access_token = params.token;

      if (followed_user_id === undefined || access_token === undefined) {
        throw new Error("INVALID_PARAMETERS");
      }

      const user_id = validateAccessToken(access_token);

      let sql = `SELECT * FROM user_follow WHERE user_id='${user_id}' AND followed_id='${followed_user_id}'`;

      const result = await db.query(sql);
      resolve({followed: result.length === 1});
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

const countUserFollowing = (user_id) => {
  return new Promise(async (resolve, reject) => {
    let sql = `SELECT COUNT(user_id) AS 'following' FROM user_follow WHERE user_id='${user_id}'`;

    try {
      const result = await db.query(sql);
      let following = 0;
      if (result.length === 1) {
        following = result[0].following;
      }
      resolve(following);
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

  if (version !== ACCESS_TOKEN_VERSION || token_id !== ACCESS_TOKEN_ID) {
    throw new Error("INVALID_ACCESS_TOKEN");
  }

  return user_id;
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


const generateActivationToken = (email) => {
  const header_buffer = Buffer(20);
  header_buffer.writeUInt16BE(ACTIVATION_TOKEN_VERSION, 0);
  header_buffer.write(ACTIVATION_TOKEN_ID, 2, 'utf8');

  const random_buffer = crypto.randomBytes(11).toString('hex');
  header_buffer.write(random_buffer, 9);

  const email_buffer = Buffer.from(email);

  const buffer = Buffer.concat([header_buffer, email_buffer]);

  // encrypt it
  const iv = crypto.randomBytes(16);
  const key = settings.activation_token_key;
  const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
  const iv_string = iv.toString('hex');

  let encrypted = cipher.update(buffer, 'utf8', 'hex');
  encrypted += cipher.final('hex');

  return `${iv_string}${encrypted}`;
};

const validateActivationToken = (token) => {
  const iv = new Buffer(token.slice(0, 32), 'hex');
  const key = settings.activation_token_key;
  const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
  const ct = token.slice(32);


  let decrypted = decipher.update(ct, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  const buffer = Buffer.from(decrypted);

  const version = buffer.readUInt16BE(0);
  const token_id = buffer.slice(2, 9).toString('utf8');
  const email = buffer.slice(20);

  return {
    valid: (version === ACTIVATION_TOKEN_VERSION && token_id === ACTIVATION_TOKEN_ID),
    email: email,
  };
};

const sendActivationMail = (email, username) => {
  return new Promise(async (resolve, reject) => {
    try {
      const token = generateActivationToken(email);

      const activation_url = `${settings.activation_url}?token=${token}`;

      const mail_title = settings.activation_mail_title;
      const mail_template = fs.readFileSync(settings.activation_mail_template, 'utf8');

      //console.log(mail_template);

      const dom = new JSDOM(mail_template);

      // fill in username
      const username_element = dom.window.document.querySelector('#username');
      if (username_element !== undefined) {
        username_element.innerHTML = `${username}`;
      }

      // fill in activation token
      const token_element = dom.window.document.querySelector('#activation_link');
      if (token_element !== undefined) {
        token_element.setAttribute('href', activation_url);
      }

      const final_html = dom.serialize();

      console.log(final_html);

      // TODO: set up Amazon SES??
      // TODO: send via mail

      resolve('OK');
    } catch (error) {
      reject(error);
    }
  });
};


const isUserSuspended = (user_id) => {
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
};

const isUserActivated = (user_id) => {
  return new Promise(async (resolve, reject) => {
    let sql = `
        SELECT IF(account_status = 'active', true, false) AS 'activated'
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
};

const activateUser = (token) => {
  return new Promise(async (resolve, reject) => {
    try {
      const token_info = validateActivationToken(token);

      if (!token_info.valid) {
        throw new Error("ACTIVATEUSER_INVALID_TOKEN");
      }

      const user_id = await getUserIDWithEmail(token_info.email);

      let sql = `UPDATE user_account SET account_status = 'active' WHERE id='${user_id}'`;

      const result = await db.query(sql);
      if (result.affectedRows !== 1) {
        throw new Error("ACTIVATEUSER_FAIL");
      }
      resolve('OK');
    } catch (error) {
      reject(error);
    }
  });
};

const commonRegister = (user_id) => {
  return new Promise(async (resolve, reject) => {
    try {
      const url = makeAvatarUrl(user_id);

      // make default avatar image
      // TODO

      // upload to S3
      // TODO

      // update image url to DB
      let sql = `UPDATE user_account SET image='${url}' WHERE id='${user_id}'`;

      const result = await db.query(sql);
      if (result.affectedRows !== 1) {
        throw new Error("AVATAR_UPDATE_FAIL");
      }
      resolve();
    } catch (error) {
      reject(error);
    }
  });
};

const commonLogin = (user_id) => {
  return new Promise(async (resolve, reject) => {
    try {
      // check if account is activated
      const account_active = await isUserActivated(user_id);
      if (!account_active) {
        throw new Error("COMMONLOGIN_ACCOUNT_INACTIVE");
      }

      // check for account suspension
      const account_suspended = await isUserSuspended(user_id);
      if (account_suspended) {
        throw new Error("COMMONLOGIN_ACCOUNT_SUSPENDED");
      }

      // try to update the access token
      const access_token = generateAccessToken(user_id);
      const update_ok = await updateAccessToken(user_id, access_token);
      if (!update_ok) {
        throw new Error("COMMONLOGIN_ACCESS_TOKEN");
      }

      // all ok!
      resolve({token: access_token});
    } catch (error) {
      reject(error);
    }
  });
};


const suspendUser = (user_id, duration) => {
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
};

const banUser = (user_id) => {
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
};

const unbanUser = (user_id) => {
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
};


// internal, don't export
const getActivePremium = (user_id) => {
  return new Promise(async (resolve, reject) => {
    try {
      let sql = `
        SELECT id FROM user_premium WHERE user_id='${user_id}' AND
        IF(CURRENT_TIME >= start_time, true, false) AND
        IF(CURRENT_TIME < end_time, true, false)`;

      const results = await db.query(sql);
      if (results.length === 0) {
        resolve({active: false});
      } else {
        let end_sql = `
          SELECT DATE_FORMAT(MAX(end_time), "%Y-%m-%d %H:%i:%s") as 'end_time' FROM user_premium
          WHERE user_id='${user_id}' AND IF(CURRENT_TIME < end_time, true, false)`;

        const results = await db.query(end_sql);
        if (results.length !== 1) {
          resolve({active: false});
        } else {
          resolve({active: true, end_time: results[0].end_time});
        }
      }
    } catch (error) {
      reject(error);
    }
  });
};


const addPremium = (user_id, num_days) => {
  return new Promise(async (resolve, reject) => {
    try {
      /*
      // check if user already has premium active
      const has_premium = await user.hasPremium(user_id);

      const hours = num_days * 24;

      let sql;
      if (has_premium) {
        // add more time to existing premium
        sql = `
            UPDATE user_account
            SET premium_end=DATE_ADD(premium_end, INTERVAL '${hours}' HOUR)
            WHERE id='${user_id}'`;
      } else {
        // start new premium
        sql = `
            UPDATE user_account
            SET premium_end=DATE_ADD(CURRENT_TIMESTAMP, INTERVAL '${hours}' HOUR)
            WHERE id='${user_id}'`;
      }

      const result = await db.query(sql);
      if (result.affectedRows !== 1) {
        throw new Error("ADDPREMIUM_FAIL");
      }*/

      let sql;
      const hours = num_days * 24;

      // check for active premium
      const premium = await getActivePremium(user_id);
      console.log(premium);
      if (!premium.active) {
        // start new premium from current time
        sql = `
          INSERT INTO user_premium(user_id, start_time, end_time)
          VALUES('${user_id}', CURRENT_TIMESTAMP, DATE_ADD(CURRENT_TIMESTAMP, INTERVAL '${hours}' HOUR))`;
      } else {
        // extend premium from the end of latest
        sql = `
          INSERT INTO user_premium(user_id, start_time, end_time)
          VALUES('${user_id}', '${premium.end_time}', DATE_ADD('${premium.end_time}', INTERVAL '${hours}' HOUR))`;
      }
      console.log(sql);

      const result = await db.query(sql);
      if (result.affectedRows !== 1) {
        throw new Error("ADD_PREMIUM_FAIL");
      }

      resolve({message: 'OK'});
    } catch (error) {
      reject(error);
    }
  });
};

// TODO: REMOVE
const addUserPremium = (params) => {
  return new Promise(async (resolve, reject) => {
    try {
      const user_id = params.user_id;
      const num_days = params.num_days;

      const result = await addPremium(user_id, num_days);

      resolve(result);
    } catch (error) {
      reject(error);
    }
  });
};

const hasPremium = (params) => {
  return new Promise(async (resolve, reject) => {
    /*
    let sql = `
        SELECT IF(CURRENT_TIMESTAMP < premium_end, true, false) AS 'premium'
        FROM user_account WHERE id='${user_id}'`;

    try {
      const result = await db.query(sql);
      if (result.length !== 1) {
        throw new Error("HASPREMIUM_NOT_FOUND");
      }
      resolve(result[0].premium);
    } catch (error) {
      reject(error);
    }*/

    try {
      const access_token = params.token;
      if (access_token === undefined) {
        throw new Error("INVALID_PARAMETERS");
      }

      const user_id = validateAccessToken(access_token);

      const premium = await getActivePremium(user_id);

      resolve(premium);
    } catch (error) {
      reject(error);
    }
  });
};

const listPremiums = (params) => {
  return new Promise(async (resolve, reject) => {
    try {
      const access_token = params.token;
      if (access_token === undefined) {
        throw new Error("INVALID_PARAMETERS");
      }

      const user_id = validateAccessToken(access_token);

      let sql = `SELECT start_time, end_time FROM user_premium WHERE user_id='${user_id}'`;

      const results = await db.query(sql);
      resolve(results);
    } catch (error) {
      reject(error);
    }
  });
};


const getAllUsers = () => {
  return new Promise(async (resolve, reject) => {
    let sql = `SELECT id, username, account_link, email, signup_date FROM user_account`;

    try {
      const result = await db.query(sql);
      resolve(result);
    } catch (error) {
      reject(error);
    }
  });
};

const getUserGames = (user_id) => {
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
};

// ***************************************************************************
// Gets info for a user with User ID and Access Token
// ***************************************************************************
// TODO: rename?
const getInfo = (user_id, access_token) => {
  return new Promise(async (resolve, reject) => {
    try {
      const access_token = params.token;
      if (access_token === undefined) {
        throw new Error("INVALID_PARAMETERS");
      }

      const user_id = validateAccessToken(access_token);

      let sql = `
        SELECT username, access_token, signup_date, image
        FROM user_account WHERE id='${user_id}'`;

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
};


// *****************************************************************************
// Get publicly available info for a user. Does not require token.
// *****************************************************************************
const getUserPublicProfile = (params) => {
  return new Promise(async (resolve, reject) => {
    try {
      const user_id = params.user_id;
      if (user_id === undefined) {
        throw new Error("INVALID_PARAMETERS");
      }

      const num_followers = await countUserFollowers(user_id);
      const num_following = await countUserFollowing(user_id);

      let sql = `SELECT username, signup_date, image FROM user_account WHERE id='${user_id}'`;
      const results = await db.query(sql);

      if (results.length !== 1) {
        throw new Error('GETUSERPUBLICINFO_NOT_FOUND');
      }

      results[0].num_followers = num_followers;
      results[0].num_following = num_following;

      resolve(results[0]);
    } catch (error) {
      reject(error);
    }
  });
};


const getUserPrivateProfile = (params) => {
  return new Promise(async (resolve, reject) => {
    try {
      const access_token = params.token;
      if (access_token === undefined) {
        throw new Error("INVALID_PARAMETERS");
      }

      const user_id = validateAccessToken(access_token);

      const num_followers = await countUserFollowers(user_id);
      const followers_list = await getFollowerList(user_id);
      const following_list = await getFollowingList(user_id);

      let sql = `
        SELECT username, signup_date, image
        FROM user_account WHERE id='${user_id}'`;

      const results = await db.query(sql);
      if (results.length !== 1) {
        throw new Error("GETINFO_NOT_FOUND");
      }

      results[0].num_followers = num_followers;
      results[0].followers = followers_list;
      results[0].following = following_list;

      resolve(results[0]);
    } catch (error) {
      reject(error);
    }
  });
};



// *****************************************************************************
// Follow a user
// *****************************************************************************
const followUser = (params) => {
  return new Promise(async (resolve, reject) => {
    try {
      const followed_user_id = params.followed_id;
      const access_token = params.token;

      if (followed_user_id === undefined || access_token === undefined) {
        throw new Error("INVALID_PARAMETERS");
      }

      const user_id = validateAccessToken(access_token);

      if (user_id === followed_user_id) {
        throw new Error('FOLLOW_USER_SELF');
      }

      let sql = `INSERT INTO user_follow(user_id, followed_id) VALUES('${user_id}', '${followed_user_id}')`;

      const result = await db.query(sql);
      if (result.affectedRows !== 1) {
        throw new Error('FOLLOW_USER_RESULT');
      }
      resolve({message: 'OK'});
    } catch (error) {
      reject(error);
    }
  });
};

// *****************************************************************************
// Unfollow a user
// *****************************************************************************
const unfollowUser = (params) => {
  return new Promise(async (resolve, reject) => {
    try {
      const followed_user_id = params.followed_id;
      const access_token = params.token;

      if (followed_user_id === undefined || access_token === undefined) {
        throw new Error("INVALID_PARAMETERS");
      }

      const user_id = validateAccessToken(access_token);

      let sql = `DELETE FROM user_follow WHERE user_id='${user_id}' AND followed_id='${followed_user_id}'`;

      const result = await db.query(sql);
      if (result.affectedRows !== 1) {
        throw new Error('UNFOLLOW_USER_RESULT');
      }
      resolve({message: 'OK'});
    } catch (error) {
      reject(error);
    }
  });
};

// *****************************************************************************
// Get a list of followers for a user
// *****************************************************************************
const getFollowerList = (user_id) => {
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
      reject(error);
    }
  });
};

// *****************************************************************************
// Get a list of followed users for a user
// *****************************************************************************
const getFollowingList = (user_id) => {
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
      reject(error);
    }
  });
};


const sendMessage = (recipient_id, sender_id, message) => {
  return new Promise(async (resolve, reject) => {
    try {
      // can't send messages to self
      if (recipient_id == sender_id) {
        throw new Error("RECIPIENT_IS_SELF");
      }

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

      const recipient_exists = await doesUserExist(recipient_id);
      if (!recipient_exists) {
        throw new Error("RECIPIENT_NOT_FOUND");
      }

      let sql = `
          INSERT INTO user_message(user_id, sender_id, title, message)
          VALUES('${recipient_id}', ${sender_id}, '${title_sane}', '${message_sane}')`;

      const result = await db.query(sql);
      if (result.affectedRows !== 1) {
        throw new Error('SENDUSERMESSAGE_FAIL');
      }
      resolve('OK');
    } catch (error) {
      reject(error);
    }
  });
};

const sendUserMessage = (params) => {
  return new Promise(async (resolve, reject) => {
    try {
      const recipient_id = params.user_id;
      const message_title = params.message_title;
      const message_body = params.message_body;
      const access_token = params.token;

      if (recipient_id === undefined || message_title === undefined ||
          message_body === undefined || access_token === undefined) {
        throw new Error("INVALID_PARAMETERS");
      }

      const user_id = validateAccessToken(access_token);

      await sendMessage(recipient_id, user_id, {title: message_title, message: message_body});
      resolve({message: 'OK'});
    } catch (error) {
      reject(error);
    }
  });
};


const getUserMessageList = (params) => {
  return new Promise(async (resolve, reject) => {
    try {
      const access_token = params.token;
      if (access_token === undefined) {
        throw new Error("INVALID_PARAMETERS");
      }

      const user_id = validateAccessToken(access_token);

      let sql = `
        SELECT sender_id, title, message_read FROM user_message WHERE user_id='${user_id}'`;

      const results = await db.query(sql);
      resolve(results);
    } catch (error) {
      reject(error);
    }
  });
};

const readUserMessage = (params) => {
  return new Promise(async (resolve, reject) => {
    try {
      const message_id = params.message_id;
      const access_token = params.token;
      if (access_token === undefined || message_id === undefined) {
        throw new Error("INVALID_PARAMETERS");
      }

      const user_id = validateAccessToken(access_token);

      let sql = `
        SELECT sender_id, title, message_read, message
        FROM user_message WHERE id='${message_id}' AND user_id='${user_id}'`;

      const result = await db.query(sql);

      // mark as read, if it's not already
      if (result.length === 1) {
        if (result[0].message_read === 0) {
          let update_sql = `
            UPDATE user_message SET message_read='1' WHERE id='${message_id}' AND user_id='${user_id}'`;

          // TODO: no need to await?
          await db.query(update_sql);
        }
      }

      resolve(result);
    } catch (error) {
      reject(error);
    }
  });
};




// *****************************************************************************
// Gets the funds of a given user/game
// *****************************************************************************
const getUserFunds = (user_id, game_id) => {
  return new Promise(async (resolve, reject) => {
    try {
      let sql = `SELECT funds FROM user_game WHERE user_id='${user_id}' AND game_id='${game_id}'`;

      const results = await db.query(sql);
      let funds = null;
      if (results.length === 1) {
        funds = results[0].funds;
      }
      resolve(funds);
    } catch (error) {
      reject(error);
    }
  });
};


// *****************************************************************************
// Get the amount of given stock for user/game
// *****************************************************************************
// TODO: make different version for external access
const getUserStock = (user_id, game_id, stock_id) => {
  return new Promise(async (resolve, reject) => {
    try {
      let sql = `
        SELECT buy_sum-sell_sum AS 'assets'
        FROM(
        SELECT user_id, stock_id, SUM(buy) AS buy_sum, SUM(sell) AS sell_sum
        FROM(
        SELECT user_id, stock_id, amount AS 'buy', 0 AS 'sell'
        FROM stock_event
        WHERE transaction_type='B' AND game_id='${game_id}' AND user_id='${user_id}' AND stock_id='${stock_id}'
        UNION ALL
        SELECT user_id, stock_id, 0 AS 'buy', amount AS 'sell'
        FROM stock_event
        WHERE transaction_type='S' AND game_id='${game_id}' AND user_id='${user_id}' AND stock_id='${stock_id}'
        ) AS summed
        GROUP BY user_id, stock_id
        ) AS final, stock
        WHERE final.stock_id=stock.id `;

      const results = await db.query(sql);
      let stock = null;
      if (results.length === 1) {
        stock = results[0].assets;
      }
      resolve(stock);
    } catch (error) {
      reject(error);
    }
  });
};


// *****************************************************************************
// Try to login with email/password
// *****************************************************************************
const loginWithEmail = (params) => {
  return new Promise(async (resolve, reject) => {
    try {
      const email = params.email;
      const password = params.password;

      if (email === undefined || password === undefined) {
        throw new Error("EMLOGIN_INVALID_PARAMETERS");
      }

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

      const login_ok = await commonLogin(user_id);
      resolve(login_ok);
    } catch (error) {
      reject(error);
    }
  });
};

// *****************************************************************************
// Try to register with email
// *****************************************************************************
const registerWithEmail = (params) => {
  return new Promise(async (resolve, reject) => {
    try {
      const email = params.email;
      const password = params.password;
      const username = params.username;

      if (email === undefined || password === undefined || username === undefined) {
        throw new Error("EMREGISTER_INVALID_PARAMETERS");
      }

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
      let sql = `
          INSERT INTO user_account(username, pass, email, access_token, signup_date)
          VALUES('${username}', '${hashed_pw}', '${email}', NULL, CURRENT_TIMESTAMP)`;

      const results = await db.query(sql);

      if (results.affectedRows !== 1) {
        throw new Error("EMREGISTER_REG_FAIL");
      }

      const user_id = await getUserIDWithEmail(email);
      if (user_id === null) {
        throw new Error("EMREGISTER_ERROR");
      }
      await commonRegister(user_id);

      // get user id for the new account
      /*
      const user_id = await getUserIDWithEmail(email);
      if (user_id === null) {
        throw new Error("EMREGISTER_FAIL");
      }

      const login_ok = await commonLogin(user_id);
      */

      // can't login until account is activated

      await sendActivationMail(email, username);

      resolve({message: 'OK' });
    } catch (error) {
      reject(error);
    }
  });
};

const editUserName = (user_id, new_username) => {
  return new Promise(async (resolve, reject) => {
    try {
      // validate username
      const valid_username = username_regex.exec(new_username) !== null;
      if (!valid_username) {
        throw new Error("EDITUSERNAME_INVALID_USERNAME");
      }

      const exists = await doesUsernameExist(new_username);
      console.log(exists);
      if (exists) {
        throw new Error("EDITUSERNAME_USERNAME_EXISTS");
      }

      let sql = `UPDATE user_account SET username='${new_username}' WHERE id='${user_id}'`;

      const result = await db.query(sql);
      if (result.affectedRows !== 1) {
        throw new Error("EDITUSERNAME_FAIL");
      }
      resolve('OK');
    } catch (error) {
      reject(error);
    }
  });
};


// Get a list of avatar options available to user
const getAvatarOptions = (user_id) => {
  return new Promise(async (resolve, reject) => {
    // TODO
  });
};


    // Make new avatar for user. Upload it to S3.
const setUserAvatar = (user_id, avatar) => {
  return new Promise(async (resolve, reject) => {
    // TODO
  });
};

const awardUserReward = (user_id, reward_id) => {
  return new Promise(async (resolve, reject) => {
    try {
      let sql = `
        INSERT INTO user_reward(user_id, reward_id, award_time)
        VALUES('${user_id}', '${reward_id}', CURRENT_TIMESTAMP)`;

      const result = await db.query(sql);
      if (result.affectedRows !== 1) {
        throw new Error("AWARD_REWARD_FAIL");
      }
      resolve({message: 'OK'});
    } catch (error) {
      reject(error);
    }
  });
};



const getUserRewards = (params) => {
  return new Promise(async (resolve, reject) => {
    try {
      const access_token = params.token;
      if (access_token === undefined) {
        throw new Error("INVALID_PARAMETERS");
      }

      const user_id = validateAccessToken(access_token);

      let sql = `
        SELECT r.name, r.description, r.image, ur.award_time
        FROM reward AS r, user_reward AS ur WHERE ur.reward_id=r.id AND ur.user_id='${user_id}'`;

      const results = await db.query(sql);
      resolve(results);
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

  activateUser: activateUser,
  suspendUser: suspendUser,
  banUser: banUser,
  unbanUser: unbanUser,
  isUserSuspended: isUserSuspended,
  isUserActivated: isUserActivated,
  addPremium: addPremium,
  hasPremium: hasPremium,
  listPremiums: listPremiums,
  getAllUsers: getAllUsers,
  getUserGames: getUserGames,
  getInfo: getInfo,
  getUserPublicProfile: getUserPublicProfile,
  getUserPrivateProfile: getUserPrivateProfile,
  followUser: followUser,
  unfollowUser: unfollowUser,
  isUserFollowed: isUserFollowed,
  getFollowerList: getFollowerList,
  getFollowingList: getFollowingList,
  sendUserMessage: sendUserMessage,
  getUserMessageList: getUserMessageList,
  readUserMessage: readUserMessage,
  getUserFunds: getUserFunds,
  getUserStock: getUserStock,
  commonLogin: commonLogin,
  commonRegister: commonRegister,
  loginWithEmail: loginWithEmail,
  registerWithEmail: registerWithEmail,
  editUserName: editUserName,
  getAvatarOptions: getAvatarOptions,
  setUserAvatar: setUserAvatar,
  getUserRewards: getUserRewards,

  // TODO REMOVE ME
  addUserPremium: addUserPremium,
};

