// User management module

const db = require('./database');
const crypto = require('crypto');

const settings = require('./settings.json');


const ACCESS_TOKEN_VERSION = 0x0001;
const ACCESS_TOKEN_ID = 'PGTOKEN';



module.exports = {
  // *****************************************************************************
  // Generate a new access token
  // *****************************************************************************
  generateAccessToken: () => {
    const header_buffer = Buffer(9);
    header_buffer.writeUInt16BE(ACCESS_TOKEN_VERSION, 0);
    header_buffer.write(ACCESS_TOKEN_ID, 2, 'utf8');

    const random_buffer = crypto.randomBytes(23);

    const buffer = Buffer.concat([header_buffer, random_buffer]);

    // encrypt it
    const iv = crypto.randomBytes(16);
    const key = settings.db_crypto;
    const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
    const iv_string = iv.toString('hex');

    let encrypted = cipher.update(buffer, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    return `${iv_string}${encrypted}`;
  },

  // *****************************************************************************
  // Check whether this a valid access token
  // *****************************************************************************
  validateAccessToken: (token) => {
    const iv = new Buffer(token.slice(0, 32), 'hex');
    const key = settings.db_crypto;
    const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
    const ct = token.slice(32);

    // decrypt it
    let decrypted = decipher.update(ct, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    const buffer = Buffer.from(decrypted);

    const version = buffer.readUInt16BE(0);
    const tokid = buffer.slice(2, 9).toString('utf8');

    return (version === ACCESS_TOKEN_VERSION && tokid === ACCESS_TOKEN_ID);
  },

  // *****************************************************************************
  // Update the access token for a given user ID
  // *****************************************************************************
  updateAccessToken: (user_id, access_token, callback) => {
    let sql = `UPDATE user_account SET access_token='${access_token}' WHERE id='${user_id}'`;

    db.query(sql, (error, results) => {
      let value = results.changedRows === 1;
      callback(error, value);
    });
  },
};
