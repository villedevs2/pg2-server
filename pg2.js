const express = require('express');
const formidable = require('formidable');
const util = require('util');
const fs = require('fs');
const https = require('https');
const db = require('./database');
const facebook = require('./facebook');
const user = require('./user');
const game = require('./game');

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

const doesUsernameExist = (username) => {
  return new Promise((resolve, reject) => {
    db.query(`SELECT id FROM user_account WHERE username='${username}'`, (error, results) => {
      if (error) {
        reject(error);
      }

      let value = results.length > 0;
      resolve(value);
    });
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
    doesUsernameExist(username).then((value) => {
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
    }).catch((error) => {
      writeJSON(res, {error: true, message: error});
    });
  });

});

// *****************************************************************************
// POST on /fblogin: login via facebook
// *****************************************************************************
app.post('/fblogin', (request, response) => {
  const form = new formidable.IncomingForm();

  form.parse(request, async (error, fields, files) => {
    const fb_account = fields.fb_account;
    const auth_token = fields.auth_token;
    console.log(`fb account = ${fb_account}`);
    console.log(`auth token = ${auth_token}`);

    let result_json;
    try {
      const login_result = await facebook.login(fb_account, auth_token);

      result_json = {error: false, result: login_result};
    } catch (error) {
      result_json = {error: true, message: error};
    }

    writeJSON(response, result_json);
  });
});

// *****************************************************************************
// POST on /fbregister: register via facebook
// *****************************************************************************
app.post('/fbregister', (request, response) => {
  const form = new formidable.IncomingForm();

  form.parse(request, async (error, fields, files) => {
    const fb_account = fields.fb_account;
    const auth_token = fields.auth_token;
    const user_name = fields.user_name;

    // TODO: more info?

    let result_json;
    try {
      if (fb_account === undefined || auth_token === undefined || user_name === undefined) {
        throw "Invalid parameters";
      }

      const reg_result = await facebook.register(fb_account, auth_token, user_name);

      result_json = {error: false, result: reg_result};
    } catch (error) {
      result_json = {error: true, message: error};
    }

    writeJSON(response, result_json);
  });
});

// *****************************************************************************
// POST on /userinfo: get user information
// *****************************************************************************
app.post('/userinfo', (request, response) => {
  const form = new formidable.IncomingForm();

  form.parse(request, async (error, fields, files) => {
    const access_token = fields.token;

    let result_json;
    try {
      if (access_token === undefined) {
        throw "Invalid parameters";
      }

      const token_info = user.validateAccessToken(access_token);
      if (token_info.valid !== true) {
        throw "Invalid access token";
      }

      const user_info = await user.getInfo(token_info.user_id, access_token);

      result_json = {error: false, info: user_info};
    } catch (error) {
      result_json = {error: true, message: error};
    }

    writeJSON(response, result_json);
  });
});

// *****************************************************************************
// POST /gameinfo
// *****************************************************************************
app.post('/gameinfo', (request, response) => {
  const form = new formidable.IncomingForm();

  form.parse(request, async (error, fields, files) => {
    const game_id = fields.game_id;

    let result_json;
    try {
      if (game_id === undefined) {
        throw "Invalid parameters";
      }

      const game_info = await game.getGameInfo(game_id);

      result_json = {error: false, info: game_info};
    } catch (error) {
      result_json = {error: true, message: error};
    }

    writeJSON(response, result_json);
  });
});


app.post('/stocklist', (request, response) => {
  const form = new formidable.IncomingForm();

  form.parse(request, async (error, fields, files) => {
    const market_id = fields.market_id;

    let result_json;
    try {
      if (market_id === undefined) {
        throw "Invalid parameters";
      }

      const stock_list = await game.getStockList(market_id);

      result_json = {error: false, stock_list: stock_list};
    } catch (error) {
      result_json = {error: true, message: error};
    }

    writeJSON(response, result_json);
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
