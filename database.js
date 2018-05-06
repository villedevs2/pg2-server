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
  transaction: (query1, query2, affect1, affect2) => {
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
  },
}
/*
  transaction: (query_strings) => {
    return new Promise((resolve, reject) => {
      pool.getConnection((error, connection) => {
        if (error) {
          reject(error);
        }

        try {
          connection.beginTransaction((error) => {
            if (error) {
              throw error;
            }

            let transaction_results = [];
            let transaction_fail = false;
            for (let i=0; i < query_strings.length; i++) {
              connection.query(query_strings[i], (error, results) => {
                if (error || results === undefined || results.length <= 0) {
                  transaction_fail = true;
                }
                console.log(results);
                transaction_results.push(results);
              });
            }

            transaction_results.forEach((result) => {
              console.log(result);
              if (result === undefined || result.affectedRows === 0) {
                transaction_fail = true;
              }
            });

            console.log(transaction_fail);

            if (transaction_fail) {
              connection.rollback(() => {
                throw new Error("Transaction fail");
              });
            }

            console.log(transaction_results);
            connection.commit((error) => {
              if (error) {
                connection.rollback(() => {
                  throw new Error("Transaction error");
                });
              }
              connection.release();
              resolve(transaction_results);
            });
          });
        } catch(error) {
          console.log("transaction error");
          reject(error);
        }

      });
    });
  }
};
*/