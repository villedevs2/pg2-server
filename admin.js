const game = require('./game');
const user = require('./user');
const crypto = require('crypto');
const db = require('./database');

const settings = require('./settings.json');

const ADMIN_TOKEN_VERSION = 0x0001;
const ADMIN_TOKEN_ID = 'ADMIN';

const generateAdminToken = () => {
  const header_buffer = Buffer(7);
  header_buffer.writeUInt16BE(ADMIN_TOKEN_VERSION, 0);
  header_buffer.write(ADMIN_TOKEN_ID, 2, 'utf8');

  const random_buffer = crypto.randomBytes(9);

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

const validateAdminToken = (token) => {
  const iv = new Buffer(token.slice(0, 32), 'hex');
  const key = settings.admin_token_key;
  const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
  const ct = token.slice(32, 64);

  // decrypt it
  let decrypted = decipher.update(ct, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  const buffer = Buffer.from(decrypted);

  const version = buffer.readUInt16BE(0);
  const token_id = buffer.slice(2, 7).toString('utf8');

  return (version === ADMIN_TOKEN_VERSION && token_id === ADMIN_TOKEN_ID);
};



const getUserList = (admin_token) => {
  return new Promise(async (resolve, reject) => {
    try {
      const valid_token = validateAdminToken(admin_token);
      if (!valid_token) {
        throw new Error("GETUSERLIST_INVALID_TOKEN");
      }

      const result = await user.getAllUsers();
      resolve(result);
    } catch (error) {
      reject(error);
    }
  });
};

const getGameList = (admin_token) => {
  return new Promise(async (resolve, reject) => {
    try {
      const valid_token = validateAdminToken(admin_token);
      if (!valid_token) {
        throw new Error("GETGAMELIST_INVALID_TOKEN");
      }

      const result = await game.getAllGames();
    } catch (error) {
      reject(error);
    }
  });
};


module.exports = {
  getUserList: getUserList,
  getGameList: getGameList,
};