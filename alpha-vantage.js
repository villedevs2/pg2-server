const https = require('https');
const settings = require('./settings.json');

const apiUrl = 'https://www.alphavantage.co/query?';

const parseStockData = (json, market) => {
  const stock = json['Stock Quotes'];

  const stock_entries = [];

  stock.forEach((item) => {
    let stock_entry = {
      symbol: item['1. symbol'],
      price: item['2. price'],
      volume: item['3. volume']
    };

    stock_entries.push(stock_entry);
  });

  return stock_entries;
};

module.exports = {
  fetchStockData: (companies, market, callback) => {
    let symbols_list = '';
    for (let i=0; i < companies.length; i++) {
      symbols_list += companies[i].symbol;
      if (i !== companies.length-1) {
        symbols_list += ',';
      }
    }

    https.get(`${apiUrl}function=BATCH_STOCK_QUOTES&symbols=${symbols_list}&apikey=${settings.alphavantage_apikey}`, (res) => {
      let body = '';
      res.on('data', (data) => {
        body += data;
      });
      res.on('end', () => {
        const stock_entries = parseStockData(JSON.parse(body), market);

        stock_entries.forEach((stock, index) => {
          for (let j=0; j < companies.length; j++) {
            if (companies[j].symbol === stock.symbol) {
              stock_entries[index]['company'] = companies[j].name;
              break;
            }
          }
        });

        callback(stock_entries);
      });
    });
  },


  fetchCurrencyData: (currency, currency_name, to_currency, callback) => {
    https.get(`${apiUrl}function=CURRENCY_EXCHANGE_RATE&from_currency=${currency}&to_currency=${to_currency}&apikey=${settings.alphavantage_apikey}`, (res) => {
      let body = '';
      res.on('data', (data) => {
        body += data;
      });
      res.on('end', () => {
        let json = JSON.parse(body);
        console.log(json);

        const price = json['Realtime Currency Exchange Rate']['5. Exchange Rate'];

        let currency_entry = {
          symbol: currency,
          currency: currency_name,
          price: price,
        };

        callback(currency_entry);
      });
    });
  },


  
};