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
  query: (query_string, callback) => {
    pool.getConnection((error, connection) => {
      if (error) {
        console.log(error);
        return callback(error);
      }
      connection.query(query_string, (error, results) => {
        connection.release();
        if (error) {
          console.log(error);
          return callback(error);
        }
        callback(null, results);
      });
    });
  },
  // Transaction of multiple queries. All must succeed for commit.
  transaction: (query_strings, callback) => {
    pool.getConnection((error, connection) => {
      if (error) {
        console.log(error);
        return callback(error);
      }

      connection.beginTransaction((error) => {
        if (error) {
          throw error;
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
                throw error;
              })
            }
            connection.release();
            callback(null, transaction_results);
          });
        } else {
          return callback("Transaction failed");
        }
      });
    });
  }
};
