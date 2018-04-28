const db = require('./database');
const kauppalehti = require('./kauppalehti-parser');
const alphavantage = require('./alpha-vantage');

const getMarketID = (market, url) => {
  return new Promise((resolve, reject) => {
    let sql = `SELECT id FROM stock_market WHERE shortname='${market}'`;

    db.query(sql, (error, results) => {
      if (error) {
        reject(`getMarketID database error`);
      } else if (results.length !== 1) {
        reject(`getMarketID not found`);
      } else {
        resolve({id: results[0].id, url: url});
      }
    });
  });
};

const isStockInDB = (symbol, market_id) => {
  return new Promise((resolve, reject) => {
    let sql = `SELECT id FROM stock WHERE symbol='${symbol}' AND market_id='${market_id}'`;

    db.query(sql, (error, results) => {
      if (error) {
        reject(`isStockInDB database error`);
      } else {
        resolve(results.length === 1);
      }
    });

  });
};

const insertStockToDatabase = (stock) => {
  return new Promise((resolve, reject) => {
    let sql = `INSERT INTO stock(market_id, symbol, full_name, price, variety, update_date)`;
    sql += `VALUES('${stock.market_id}', '${stock.symbol}', '${stock.fullname}', '${stock.price}', '${stock.change}', CURRENT_TIMESTAMP)`;

    db.query(sql, (error, results) => {
      if (error) {
        reject(`insertStockToDatabase database error`);
      } else {
        // this operation should affect exactly one row if it succeeds
        resolve(results.affectedRows === 1);
      }
    });
  });
};

const updateStockInDatabase = (stock) =>  {
  return new Promise((resolve, reject) => {
    let sql = `UPDATE stock `;
    sql += `SET price='${stock.price}', variety='${stock.change}', update_date=CURRENT_TIMESTAMP `;
    sql += `WHERE symbol='${stock.symbol}' AND market_id='${stock.market_id}'`;

    db.query(sql, (error, results) => {
      if (error) {
        reject(`updateStockInDatabase database error`);
      } else {
        // this operation should affect exactly one row if it succeeds
        resolve(results.affectedRows === 1);
      }
    });
  });
};



const updateStockEntry = (stock) => {
  return new Promise((resolve, reject) => {
    const symbol = stock.symbol;
    const market_id = stock.market_id;

    isStockInDB(symbol, market_id).then((result) => {
      if (result === true) {
        console.log(`${symbol} exists in database. Updating.`);
        updateStockInDatabase(stock).then((res) => {
          resolve();
        }).catch((error) => {
          reject('Database error on update');
        });
      } else {
        console.log(`Adding new entry ${symbol}`);
        insertStockToDatabase(stock).then((res) => {
          resolve();
        }).catch((error) => {
          reject('Database error on insert');
        });
      }
    }).catch((error) => {
      console.log(error);
    });

  });
};

/*
getMarketID('XHEL', 'https://beta.kauppalehti.fi/porssi/kurssit/XHEL').then((market_id) => {
  kauppalehti.fetchStockData(market_id.url, market_id.id).then((results)  => {
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
  }).catch((error) => {
    console.log(error);
  });
});
*/

let markets = [
    getMarketID('XHEL', 'https://beta.kauppalehti.fi/porssi/kurssit/XHEL'),
    getMarketID('FNFI', 'https://beta.kauppalehti.fi/porssi/kurssit/FNFI'),
];

Promise.all(markets).then((results) => {
  //console.log(results);

  let stocks = [];
  results.forEach((market_result) => {
    stocks.push(kauppalehti.fetchStockData(market_result.url, market_result.id));
  });

  Promise.all(stocks).then((market_lists) => {
    let stock_entries = [];

    market_lists.forEach((market_list) => {
      //console.log(res);
      market_list.forEach((stock_item) => {
        //console.log(stock_item);
        stock_entries.push(stock_item);
      });
    });

    //console.log(stock_entries);

    let update_entries = [];

    // insert promises
    stock_entries.forEach((result) => {
      update_entries.push(updateStockEntry(result));
    });

    // execute all
    Promise.all(update_entries).then((res) => {
      console.log('donetski');
      db.shutdown();
    }).catch((error) => {
      console.log(`promise error ${error}`);
    });

  }).catch((error) => {
    console.log(error);
  });

}).catch((error) => {
  console.log(error);
});