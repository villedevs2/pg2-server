const https = require('https');

const jsdom = require('jsdom');
const { JSDOM } = jsdom;


const parseStockData = (html, market) => {
  const dom = new JSDOM(html);
  const script_elements = dom.window.document.querySelectorAll('script');

  let json = null;

  const stock_entries = [];

  for (let el=0; el < script_elements.length; el++) {
    const text = script_elements[el].textContent;
    const find = `"shares":`;
    let start = text.indexOf(find);
    if (start >= 0) {
      start += find.length;
      let brack_count = 0;
      let sliced = '';
      // count open and closed brackets until we're done
      for (let i=start; i < text.length; i++) {
        const char = text[i];
        if (char === '[') {
          brack_count++;
        } else if (char === ']') {
          brack_count--;
        }

        sliced += text[i];

        if (brack_count === 0)
          break;
      }

      json = JSON.parse(sliced);
      break;
    }
  }

  if (json !== null) {
    json.forEach((item) => {

      //insRef: 914,
      // company: 39838,
      // name: 'Ålandsbanken B',
      // symbol: 'ALBBV',
      // isin: 'FI0009001127',
      // tradeCurrency: 'EUR',
      // lastPrice: 13.45,
      // turnover: 43304.65,
      // quantity: 3210,
      // internalTurnover: 10125,
      // internalQuantity: 750,
      // dateTime: '2018-04-23T16:00:00Z',
      // openPrice: 13.25,'
      // bidPrice: 13.45,
      // askPrice: 13.5,
      // dayLowPrice: 13.25,
      // dayHighPrice: 13.5,
      // closePrice: 13.45,
      // closeDateTime: '2018-04-23T16:00:00Z',
      // changePercent: -2.5362318840579814,'
      // changePercent1m: -7.876712328767126,'
      // tickSize: 2,
      // sectorindex: 323915,
      // quoteShares:
      // marketValue: 211333857.85

      const symbol = item.symbol;
      const name = item.name;
      const price = item.closePrice;
      const change = item.changePercent;

      //console.log(`sym: ${symbol}, name: ${name}, price: ${price}, %: ${change}`);

      // everything must be non-null
      if (name !== null && price !== null && change !== null) {
        // price must be non-zero
        if (price > 0) {
          let stock_entry = {
            symbol: symbol,
            fullname: name,
            price: price,
            change: change,
            listname: market
          };

          stock_entries.push(stock_entry);
        }
      }
    });
  }

  return stock_entries;
};

module.exports = {
  fetchStockData: (market) => {
    const url = `https://beta.kauppalehti.fi/porssi/kurssit/${market}`;
    return new Promise((resolve, reject) => {
      https.get(url, (res) => {
        let body = '';
        res.on('data', (data) => {
          body += data;
        });
        res.on('end', () => {
          //console.log(body);
          const stock_entries = parseStockData(body, market);
          //console.log(stock_entries);
          resolve(stock_entries);
        });
      });
    });

  }
};




