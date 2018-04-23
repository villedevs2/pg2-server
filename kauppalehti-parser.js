const https = require('https');

const jsdom = require('jsdom');
const { JSDOM } = jsdom;


const trimStockURL = (url) => {
  const index = url.lastIndexOf('/');
  if (index >= 0) {
    return url.substr(index + 1);
  } else {
    return url;
  }
};


const parseStockData = (html, market) => {
  const dom = new JSDOM(html);
  const script_elements = dom.window.document.querySelectorAll('script');

  let json = null;

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

  console.log(json);

  const stock_entries = [];
/*
  a_elements.forEach((a_ele) => {
    let stock_link = false;
    let href = null;

    for (let a_attr=0; a_attr < a_ele.attributes.length; a_attr++) {
      const attr_name = a_ele.attributes[a_attr].name;
      const attr_value = a_ele.attributes[a_attr].value;

      if (attr_name === 'class' && attr_value.includes('stock-link')) {
        stock_link = true;
      } else if (attr_name === 'href') {
        href = attr_value;
      }
    }

    if (stock_link) {
      // get symbol from stock URL
      const symbol = trimStockURL(href);

      // there should be 3 DIV nodes here
      if (a_ele.childNodes.length >= 3) {
        const stock_data = {
          company: null,
          price: null,
          change: null
        };

        // first DIV should contain H5-element, which should contain a SPAN element containing the company name
        const company_h5 = a_ele.childNodes[0].querySelectorAll('h5');
        if (company_h5.length > 0) {
          const company_span = company_h5[0].querySelectorAll('span');
          if (company_span.length > 0) {
            let company_name = company_span[0].textContent;
            stock_data.company = company_name;
          }
        }

        // second DIV should contain a SPAN with the stock price
        const price_span = a_ele.childNodes[1].querySelectorAll('span');
        if (price_span.length > 0) {
          let price = price_span[0].textContent;

          // replace commas with periods
          price = price.replace(/,/g, '.');
          price = parseFloat(price);
          stock_data.price = price;
        }

        // third DIV should contain a SPAN with the change percent
        const change_span = a_ele.childNodes[2].querySelectorAll('span');
        if (change_span.length > 0) {
          let change = change_span[0].textContent;

          // replace commas with periods
          change = change.replace(/,/g, '.');
          change = parseFloat(change);
          stock_data.change = change;
        }

        console.log(stock_data.company);
        console.log(stock_data.price);
        console.log(stock_data.change);

        // everything must be non-null
        if (stock_data.company !== null && stock_data.price !== null && stock_data.change !== null) {
          // price must be non-zero
          if (stock_data.price > 0) {
            let stock_entry = {
              symbol: symbol,
              company: stock_data.company,
              price: stock_data.price,
              change: stock_data.change,
              market: market
            };

            stock_entries.push(stock_entry);
          }
        }
      }
    }

  });
*/
  return stock_entries;
};

module.exports = {
  fetchStockData: (url, market, callback) => {
    https.get(url, (res) => {
      let body = '';
      res.on('data', (data) => {
        body += data;
      });
      res.on('end', () => {
        ///console.log(body);
        const stock_entries = parseStockData(body, market);
        console.log(stock_entries);
        callback(stock_entries);
      });
    });
  }
};




