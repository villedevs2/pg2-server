const db = require('./database');
const kauppalehti = require('./kauppalehti-parser');
const alphavantage = require('./alpha-vantage');

const getMarketID = (market, callback) => {
  let sql = `SELECT id FROM stock_market WHERE shortname='${market}'`;

  db.query(sql, (error, results) => {
    if (results.length === 1) {
      const id = results[0].id;
      callback(error, id);
    }
  });
};

/*
const xhelUrl = 'https://beta.kauppalehti.fi/porssi/kurssit/XHEL';

kauppalehti.fetchStockData(xhelUrl, 'XHEL', (results) => {
  console.log(results);
});
*/

const isStockInDB = (symbol, market_id, callback) => {
  let sql = `SELECT id FROM stock WHERE symbol='${symbol}' AND market_id='${market_id}'`;

  db.query(sql, (error, results) => {
    callback(error, results.length === 1);
  });
};

const insertStockToDatabase = (stock, callback) => {
  let sql = `INSERT INTO stock(market_id, symbol, full_name, price, variety, update_date)`;
  sql += `VALUES('${stock.market_id}', '${stock.symbol}', '${stock.fullname}', '${stock.price}', '${stock.change}', CURRENT_TIMESTAMP)`;

  db.query(sql, (error, results) => {
    // this operation should affect exactly one row if it succeeds
    callback(error, results.affectedRows === 1);
  });
};

const updateStockInDatabase = (stock, callback) => {
  let sql = `UPDATE stock `;
  sql += `SET price='${stock.price}', variety='${stock.change}', update_date=CURRENT_TIMESTAMP `;
  sql += `WHERE symbol='${stock.symbol}' AND market_id='${stock.market_id}'`;

  db.query(sql, (error, results) => {
    // this operation should affect exactly one row if it succeeds
    callback(error, results.affectedRows === 1);
  });
};



const updateStockEntry = (stock) => {
  return new Promise((resolve, reject) => {
    const symbol = stock.symbol;
    const market_id = stock.market_id;

    isStockInDB(symbol, market_id, (error, result) => {
      if (result === true) {
        console.log(`${symbol} exists in database. Updating.`);
        updateStockInDatabase(stock, (error, result) => {
          if (error || !result) {
            reject('Database error on update.');
          } else {
            resolve();
          }
        });
      } else {
        console.log(`Adding new entry ${symbol}`);
        insertStockToDatabase(stock, (error, result) => {
          if (error || !result) {
            reject('Database error on insert');
          } else {
            resolve();
          }
        });
      }
    });

  });
};

getMarketID('XHEL', (error, id) => {
  const url = 'https://beta.kauppalehti.fi/porssi/kurssit/XHEL';
  kauppalehti.fetchStockData(url, id, (results) => {
    let entries = [];

    // insert promises
    results.forEach((result) => {
      entries.push(updateStockEntry(result));
    });

    // execute all
    Promise.all(entries).then((res) => {
      console.log('donetski');
      db.shutdown();
    }).catch((error) => {
      console.log(`promise error ${error}`);
    });
  });
});


/*
const updateStockList = (stock_list) => {
  stock_list.forEach((stock) => {
    const symbol = stock.symbol;
    const market_id = stock.market_id;

    isStockInDB(symbol, market_id, (error, result) => {
      console.log(`${symbol} in db ${result}`);
      if (result === true) {
        console.log(`${symbol} exists in database. Updating.`);
        updateStockInDatabase(stock, (error, result) => {
          if (error || !result) {
            console.log('Database error on update.');
          }
        });
      } else {
        console.log(`Adding new entry ${symbol}`);
        insertStockToDatabase(stock, (error, result) => {
          if (error || !result) {
            console.log('Database error on insert');
          }
        });
      }
    });
  });
  console.log('doneski');
};

const baseUrl = 'https://beta.kauppalehti.fi/porssi/kurssit/';


getMarketID('XHEL', (error, id) => {
  const url = 'https://beta.kauppalehti.fi/porssi/kurssit/XHEL';
  kauppalehti.fetchStockData(url, id, (results) => {
    //console.log(results);
    updateStockList(results);
  });
});
*/
/*
const fnfiUrl = 'https://beta.kauppalehti.fi/porssi/kurssit/FNFI';

kauppalehti.fetchStockData(fnfiUrl, 'FNFI', (results) => {
  console.log(results);
});
*/