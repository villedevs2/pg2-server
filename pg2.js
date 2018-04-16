const express = require('express');
const formidable = require('formidable');
const util = require('util');
const fs = require('fs');
const https = require('https');
const db = require('./database');

const crypto = require('crypto');

const settings = require('./settings.json');

console.log(settings.upload_path);

const app = express();

app.use(require('json-middleware').middleware());


// static GET on /uploads: serve images
app.use('/uploads', express.static(__dirname + settings.upload_path));

// GET on root: send form
app.get('/', (req, res) => {
  res.writeHead(200, {'Content-Type': 'text/html'});
  res.write('<form action="upload" method="post" enctype="multipart/form-data">');
  res.write('<input type="file" name="filetoupload"><br>');
  res.write('<input type="submit">');
  res.write('</form>');
  return res.end();
});

app.get('/leaderboard', (req, res) => {
  db.query("SELECT * FROM user_account", (error, results) => {
    if (error) {
      res.writeHead(400, {'Content-Type': 'text/html'});
      return res.end();
    } else {
      res.writeHead(200, {'Content-Type': 'text/html'});
      results.forEach((item) => {
        //res.write(item.id);
        const name = item.username;
        const funds = parseInt(item.funds);

        res.write(`<p>${name}, ${funds}</p>`);

        //console.log(item.username);
      });
      return res.end();
    }
  });
});


const writeJSON = (res, json) => {
  res.writeHead(200, {'Content-Type': 'text/json'});
  res.write(JSON.stringify(json));
  res.end();
};



// POST on /login
app.post('/login', (req, res) => {

  const form = formidable.IncomingForm();
  form.parse(req, (error, fields, files) => {
    const username = fields.username;
    const password = fields.password;

    console.log(fields);
    console.log(username);
    console.log(password);

    const json = {
      username: username,
      password: password
    };

    res.writeHead(200, {'Content-Type': 'text/json'});
    res.write(JSON.stringify(json));
    return res.end();
  });

});

const doesUsernameExist = (username, callback) => {
  db.query(`SELECT id FROM user_account WHERE username='${username}'`, (error, results) => {
    let value = results.length > 0;
    callback(error, value);
  });
};

// POST on /register
app.post('/register', (req, res) => {
  const form = formidable.IncomingForm();

  form.parse(req, (error, fields, files) => {
    const username = fields.username;
    const password = fields.password;
    const email = fields.email;
    const referrer_code = fields.referrer_code;

    // check if the username already exists
    doesUsernameExist(username, (error, value) => {
      if (error) {
        console.log(`Error: ${error}`);
        writeJSON(res, { error: true, message: 'Database error'});
      } else {

        if (value) {
          // username exists
          writeJSON(res, { error: true, message: 'Username already exists'});
        } else {
          // nope, doesn't exist

          // TODO: validate email, username
          // TODO: salt/encrypt password
          // TODO: validate referrer code if it exists

          writeJSON(res, { error: false, message: 'Registering complete'});
        }
      }
    });
  });

});

// *****************************************************************************
// Check if an FB account is already registered in DB
// *****************************************************************************
const doesFBAccountExist = (account, callback) => {
  const cipher = crypto.createCipher('aes-256-ctr', settings.db_crypto);
  let token = `FB${cipher.update(account, 'utf8', 'hex')}`;

  console.log(`Looking for token ${account}/${token}`);

  db.query(`SELECT id FROM user_account WHERE account_link='${token}'`, (error, results) => {
    let value = results.length > 0;
    callback(error, value);
  });
};

// *****************************************************************************
// Validate an FB access token with FB
// *****************************************************************************
const isValidFBToken = (token, user_id, callback) => {
  const fbUrl = `https://graph.facebook.com/debug_token`;

  const inputToken = `input_token=${token}`;
  const accessToken = `access_token=${settings.fb_appid}|${settings.fb_apps}`;

  https.get(`${fbUrl}?${inputToken}&${accessToken}`, (res) => {
    let body = '';
    res.on('data', (data) => {
      body += data;
    });
    res.on('end', () => {
      console.log(body);

      const response = JSON.parse(body);

      console.log(response.data.app_id);
      console.log(response.data.user_id);
      console.log(response.data.is_valid);

      if (response.data.app_id === settings.fb_appid &&
          response.data.user_id === user_id &&
          response.data.is_valid === true) {
        callback(true);
      } else {
        callback(false);
      }
    });
  });
};

// *****************************************************************************
// POST on /fblogin: login via facebook
// *****************************************************************************
app.post('/fblogin', (req, res) => {
  const form = new formidable.IncomingForm();

  form.parse(req, (err, fields, files) => {
    const user_id = fields.user_id;
    const auth_token = fields.auth_token;
    console.log(`user id = ${user_id}`);
    console.log(`auth token = ${auth_token}`);

    // verify from Facebook that this is a valid access token for this user
    isValidFBToken(auth_token, user_id, (valid) => {
      if (valid) {
        doesFBAccountExist(user_id, (error, exists) => {
          if (error) {
            throw error;
          }

          if (exists) {
            // TODO: get access token

            writeJSON(res, {message: "OK", error: false});
          } else {
            writeJSON(res, {message: "Account doesn't exist", error: true});
          }
        });

      } else {
        writeJSON(res, {message: "Invalid access token!", error: true});
      }
    });
  });
});

// *****************************************************************************
// POST on /fbregister: register via facebook
// *****************************************************************************
app.post('/fbregister', (reg, res) => {
  const form = new formidable.IncomingForm();

  form.parse(req, (err, fields, files) => {
    const user_id = fields.user_id;
    const auth_token = fields.auth_token;
    const user_name = fields.user_name;

    // TODO: more info

    // first check for valid FB token
    isValidFBToken(auth_token, user_id, (valid) => {
      if (valid) {
        // check if the account already exists
        doesFBAccountExist(user_id, (error, exists) => {
          if (error) {
            throw error;
          }

          // if not, try to register
          if (!exists) {
            registerWithFB(user_id, user_name, (error, result) => {
              if (error) {
                throw error;
              }


            });
          } else {
            writeJSON(res, {message: "Account already exists", error: true});
          }
        });
      } else {
        writeJSON(res, {message: "Invalid access token", error: true});
      }
    });
  });
});




// *****************************************************************************
// POST on /upload: send image files
// *****************************************************************************
app.post('/upload', (req, res) => {
  const form = new formidable.IncomingForm();

  // error reporter
  const reportError = (res, error) => {
    res.writeHead(400, {'Content-Type': 'text/html'});
    res.write(error);
    res.end();
  };

  // parse incoming files
  form.parse(req, (err, fields, files) => {
    if (files.filetoupload === undefined) {
      reportError(res, 'Invalid image file');
    } else {
      if (files.filetoupload.type === 'image/jpeg' ||
          files.filetoupload.type === 'image/png') {

        // copy to server with new name
        fs.rename(files.filetoupload.path, 'uploads/' + files.filetoupload.name,
            (error) => {
              if (error) {
                throw error;
              }


              // OK response to client

              res.writeHead(200, {'Content-Type': 'text/html'});
              res.write(util.inspect({fields: fields, files: files}));
              res.write(`<img src="uploads/${files.filetoupload.name}">`);
              res.end();

            });
      } else {
        reportError(res, 'Unsupported image type');
      }
    }
  });
});

app.listen(3000, () => {
  console.log('HTTP server started at 3000');
});
