const db = require('./database');
const kauppalehti = require('./kauppalehti-parser');
const alphavantage = require('./alpha-vantage');

const getMarketID = (market) => {
  return new Promise(async (resolve, reject) => {
    let sql = `SELECT id FROM stock_market WHERE shortname='${market}'`;

    try {
      const results = await db.query(sql);
      if (results.length !== 1) {
        throw new Error("getMarketID not found");
      }
      resolve(results[0].id);
    } catch (error) {
      reject(error);
    }
  });
};

const isStockInDB = (symbol, market_id) => {
  return new Promise(async (resolve, reject) => {
    let sql = `SELECT id FROM stock WHERE symbol='${symbol}' AND market_id='${market_id}'`;

    try {
      const results = await db.query(sql);
      resolve(results.length === 1);
    } catch (error) {
      reject(error);
    }
  });
};

const insertStockToDatabase = (stock, market_id) => {
  return new Promise(async (resolve, reject) => {
    let sql = `
      INSERT INTO stock(market_id, symbol, full_name, list_name, price, variety, update_date)
      VALUES('${market_id}', '${stock.symbol}', '${stock.fullname}', '${stock.listname}', '${stock.price}', '${stock.change}', CURRENT_TIMESTAMP)`;

    try {
      const results = await db.query(sql);
      // this operation should affect exactly one row if it succeeds
      if (results.affectedRows !== 1) {
        throw new Error("insertStockToDatabase fail");
      }
      resolve('OK');
    } catch (error) {
      reject(error);
    }
  });
};

const updateStockInDatabase = (stock, market_id) =>  {
  return new Promise(async (resolve, reject) => {
    let sql = `
      UPDATE stock
      SET price='${stock.price}', variety='${stock.change}', update_date=CURRENT_TIMESTAMP
      WHERE symbol='${stock.symbol}' AND market_id='${market_id}'`;

    try {
      const results = await db.query(sql);
      // this operation should affect exactly one row if it succeeds
      if (results.affectedRows !== 1) {
        throw new Error("updateStockInDatabase fail");
      }
      resolve('OK');
    } catch (error) {
      reject(error);
    }
  });
};



const updateStockEntry = (stock, market_id) => {
  return new Promise(async (resolve, reject) => {
    const symbol = stock.symbol;

    try {
      const isInDB = await isStockInDB(symbol, market_id);
      if (isInDB) {
        console.log(`${symbol} exists in database. Updating.`);
        await updateStockInDatabase(stock, market_id);
        resolve('OK');
      } else {
        console.log(`Adding new entry ${symbol}`);
        await insertStockToDatabase(stock, market_id);
        resolve('OK');
      }
    } catch (error) {
      console.log(error);
      reject(error);
    }

  });
};


const updateOMXH = async () => {
  try {
    const market_id = await getMarketID('OMXH');

    let stocks = [];
    stocks.push(kauppalehti.fetchStockData('https://beta.kauppalehti.fi/porssi/kurssit/XHEL', 'XHEL'));
    stocks.push(kauppalehti.fetchStockData('https://beta.kauppalehti.fi/porssi/kurssit/FNFI', 'FNFI'));

    const market_lists = await Promise.all(stocks);

    let stock_entries = [];

    // get all stock entries
    market_lists.forEach((market_list) => {
      market_list.forEach((stock_item) => {
        stock_entries.push(stock_item);
      });
    });

    let update_entries = [];

    // insert promises
    stock_entries.forEach((result) => {
      update_entries.push(updateStockEntry(result, market_id));
    });

    // execute all
    await Promise.all(update_entries);
    console.log('donetski');
    db.shutdown();

  } catch (error) {
    console.log(error);
  }
};

updateOMXH();