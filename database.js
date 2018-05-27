// Database management module

const mysql = require('mysql');

const settings = require('./settings.json');

const pool = mysql.createPool({
  host: settings.db_host,
  user: settings.db_user,
  password: settings.db_pass,
  database: settings.db_base,
  port: 3306
});


// Gracefully shutdown the connection pool
const shutdown = () => {
  pool.end((error) => {
    console.log(error);
  });
};


// Simple SQL query
const query = (query_string) => {
  return new Promise((resolve, reject) => {
    pool.getConnection((error, connection) => {
      if (error) {
        reject(error);
      }
      connection.query(query_string, (error, results) => {
        connection.release();

        if (error) {
          reject(error);
        }

        resolve(results);
      });
    });
  });
};


// Transaction of multiple queries. All must succeed for commit.
const transaction = (query1, query2, affect1, affect2) => {
  return new Promise((resolve, reject) => {
    pool.getConnection((error, connection) => {
      if (error) {
        reject(error);
      }

      connection.beginTransaction((error) => {
        connection.query(query1, (error1, results1) => {
          connection.query(query2, (error2, results2) => {
            if (error1 || error2 ||
                results1 === undefined || results2 === undefined ||
                results1.affectedRows !== affect1 || results2.affectedRows !== affect2) {
              connection.rollback(() => {
                reject("Transaction fail");
              });
            }

            connection.commit((error) => {
              if (error) {
                connection.rollback(() => {
                  reject("Transaction fail");
                });
              }
              connection.release();
              resolve("OK");
            });
          });
        })
      });
    });
  });
};


module.exports = {
  shutdown: shutdown,
  query: query,
  transaction: transaction,
}
