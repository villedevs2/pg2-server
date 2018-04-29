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

module.exports = {
  // Gracefully shutdown the connection pool
  shutdown: () => {
    pool.end((error) => {
      console.log(error);
    });
  },

  // Simple SQL query
  query: (query_string) => {
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
  },
  // Transaction of multiple queries. All must succeed for commit.
  transaction: (query_strings) => {
    return new Promise((resolve, reject) => {
      pool.getConnection((error, connection) => {
        if (error) {
          reject(error);
        }

        connection.beginTransaction((error) => {
          if (error) {
            reject(error);
          }

          transaction_fail = false;
          transaction_results = '';
          query_strings.forEach((query_string) => {
            connection.query(query_string, (error, results) => {
              if (error || results.length <= 0) {
                console.log(error);
                transaction_results += results;
                connection.rollback(() => {
                  throw error;
                  transaction_fail = true;
                });
              }
            });
          });

          if (!transaction_fail) {
            connection.commit((error) => {
              if (error) {
                connection.rollback(() => {
                  reject(error);
                })
              }
              connection.release();
              resolve(transaction_results);
            });
          } else {
            reject("Transaction failed");
          }
        });

      });
    });
  }
};
