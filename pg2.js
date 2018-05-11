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


const writeJSON = (res, json) => {
  res.writeHead(200, {'Content-Type': 'text/json'});
  res.write(JSON.stringify(json));
  res.end();
};



// *****************************************************************************
// POST /login: login with username/password
// *****************************************************************************
app.post('/login', (request, response) => {

  const form = formidable.IncomingForm();
  form.parse(request, async (error, fields, files) => {
    const username = fields.username;
    const password = fields.password;

    try {
      const results = await user.loginWithPass(username, password);

      writeJSON(response, {error: false, result: results});
    } catch (error) {
      writeJSON(response, {error: true, message: error});
    }
  });

});

// *****************************************************************************
// POST /register: register with username/password/email
// *****************************************************************************
app.post('/register', (request, response) => {
  const form = formidable.IncomingForm();

  form.parse(request, async (error, fields, files) => {
    const username = fields.username;
    const password = fields.password;
    const email = fields.email;

    try {
      const results = await user.registerWithPass(username, password, email);

      writeJSON(response, {error: false, result: results});
    } catch (error) {
      writeJSON(response, {error: true, message: error});
    }

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


// *****************************************************************************
// POST /stocklist: get stock list
// *****************************************************************************
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
// POST /buystock: try to buy stock
// *****************************************************************************
app.post('/buystock', (request, response) => {
  const form = new formidable.IncomingForm();

  form.parse(request, async (error, fields, files) => {
    const amount = fields.amount;
    const stock_id = fields.stock_id;
    const game_id = fields.game_id;
    const access_token = fields.token;

    let result_json;
    try {
      if (amount === undefined || stock_id === undefined || game_id === undefined || access_token === undefined) {
        throw "Invalid parameters";
      }

      const token_info = user.validateAccessToken(access_token);
      if (!token_info.valid) {
        throw "Invalid access token";
      }

      const joined_game = await game.hasPlayerJoinedGame(token_info.user_id, game_id);
      if (!joined_game) {
        throw "User has not joined this game";
      }

      // TODO: only allow buying when stock market is open?
      // TODO: only allow buying when game is active (start_time, end_time)

      const results = await game.buyStock(game_id, token_info.user_id, stock_id, amount);

      result_json = {error: false, message: 'OK'};
    } catch (error) {
      result_json = {error: true, message: error};
    }

    writeJSON(response, result_json);
  });
});


// *****************************************************************************
// POST /sellstock: Sell stock
// *****************************************************************************
app.post('/sellstock', (request, response) => {
  const form = new formidable.IncomingForm();

  form.parse(request, async (error, fields, files) => {
    const amount = fields.amount;
    const stock_id = fields.stock_id;
    const game_id = fields.game_id;
    const access_token = fields.token;

    let result_json;
    try {
      if (amount === undefined || stock_id === undefined || game_id === undefined || access_token === undefined) {
        throw "Invalid parameters";
      }

      const token_info = user.validateAccessToken(access_token);
      if (!token_info.valid) {
        throw "Invalid access token";
      }

      const joined_game = await game.hasPlayerJoinedGame(token_info.user_id, game_id);
      if (!joined_game) {
        throw "User has not joined this game";
      }

      // TODO: only allow selling when stock market is open?
      // TODO: only allow selling when game is active (start_time, end_time)

      const results = await game.sellStock(game_id, token_info.user_id, stock_id, amount);

      result_json = {error: false, message: 'OK'};
    } catch (error) {
      result_json = {error : true, message: error};
    }

    writeJSON(response, result_json);
  });
});


// *****************************************************************************
// POST /joingame: Try to join a game
// *****************************************************************************
app.post('/joingame', (request, response) => {
  const form = new formidable.IncomingForm();

  form.parse(request, async (error, fields, files) => {
    const game_id = fields.game_id;
    const access_token = fields.token;

    let result_json;
    try {
      if (game_id === undefined || access_token === undefined) {
        throw new Error("Invalid parameters");
      }

      const token_info = user.validateAccessToken(access_token);
      if (!token_info.valid) {
        throw new Error("Invalid access token");
      }

      const result = await game.joinGame(game_id, token_info.user_id);

      result_json = {error: false, message: 'OK'};
    } catch (error) {
      result_json = {error: true, message: error};
    }

    writeJSON(response, result_json);
  });
});

// *****************************************************************************
// POST /leaderboard: Get the leaderboard for the given game
// *****************************************************************************
app.post('/leaderboard', (request, response) => {
  const form = new formidable.IncomingForm();

  form.parse(request, async (error, fields, files) => {
    const game_id = fields.game_id;
    const access_token = fields.token;

    let result_json;
    try {
      if (game_id === undefined || access_token === undefined) {
        throw new Error("Invalid parameters");
      }

      const token_info = user.validateAccessToken(access_token);
      if (!token_info.valid) {
        throw new Error("Invalid access token");
      }

      // user needs to be part of this game to view leaderboard
      const joined_game = await game.hasPlayerJoinedGame(token_info.user_id, game_id);
      if (!joined_game) {
        throw "User has not joined this game";
      }

      const results = await game.getLeaderboard(game_id);

      result_json = {error: false, results: results};
    } catch (error) {
      result_json = {error: true, message: error};
    }

    writeJSON(response, result_json);
  });
});


// *****************************************************************************
// POST /buyhistory: Get buy history for user/game
// *****************************************************************************
app.post('/buyhistory', (request, response) => {
  const form = new formidable.IncomingForm();

  form.parse(request, async (error, fields, files) => {
    const game_id = fields.game_id;
    const access_token = fields.token;

    let result_json;
    try {
      if (game_id === undefined || access_token === undefined) {
        throw new Error("Invalid parameters");
      }

      const token_info = user.validateAccessToken(access_token);
      if (!token_info.valid) {
        throw new Error("Invalid access token");
      }

      // user needs to have joined this game
      const joined_game = await game.hasPlayerJoinedGame(token_info.user_id, game_id);
      if (!joined_game) {
        throw "User has not joined this game";
      }

      const results = await user.getBuyHistory(token_info.user_id, game_id);

      result_json = {error: false, results: results};
    } catch (error) {
      result_json = {error: true, message: error};
    }

    writeJSON(response, result_json);
  });
});


// *****************************************************************************
// POST /sellhistory: Get buy history for user/game
// *****************************************************************************
app.post('/sellhistory', (request, response) => {
  const form = new formidable.IncomingForm();

  form.parse(request, async (error, fields, files) => {
    const game_id = fields.game_id;
    const access_token = fields.token;

    let result_json;
    try {
      if (game_id === undefined || access_token === undefined) {
        throw new Error("Invalid parameters");
      }

      const token_info = user.validateAccessToken(access_token);
      if (!token_info.valid) {
        throw new Error("Invalid access token");
      }

      // user needs to have joined this game
      const joined_game = await game.hasPlayerJoinedGame(token_info.user_id, game_id);
      if (!joined_game) {
        throw "User has not joined this game";
      }

      const results = await user.getSellHistory(token_info.user_id, game_id);

      result_json = {error: false, results: results};
    } catch (error) {
      result_json = {error: true, message: error};
    }

    writeJSON(response, result_json);
  });
});


// *****************************************************************************
// POST /followuser: Follow a user
// *****************************************************************************
app.post('/followuser', (request, response) => {
  const form = new formidable.IncomingForm();

  form.parse(request, async (error, fields, files) => {
    const followed_id = fields.followed_id;
    const access_token = fields.token;

    let result_json;
    try {
      if (followed_id === undefined) {
        throw new Error("Invalid parameters");
      }

      const token_info = user.validateAccessToken(access_token);
      if (!token_info.valid) {
        throw new Error("Invalid access token");
      }

      const result = await user.followUser(token_info.user_id, followed_id);

      result_json = {error: false, result: result};
    } catch (error) {
      result_json = {error: true, message: error};
    }

    writeJSON(response, result_json);
  });
});


// *****************************************************************************
// POST /unfollowuser: Unfollow a usr
// *****************************************************************************
app.post('/unfollowuser', (request, response) => {
  const form = new formidable.IncomingForm();

  form.parse(request, async (error, fields, files) => {
    const followed_id = fields.followed_id;
    const access_token = fields.token;

    let result_json;
    try {
      if (followed_id === undefined) {
        throw new Error("Invalid parameters");
      }

      const token_info = user.validateAccessToken(access_token);
      if (!token_info.valid) {
        throw new Error("Invalid access token");
      }

      const result = await user.unfollowUser(token_info.user_id, followed_id);

      result_json = {error: false, result: result};
    } catch (error) {
      result_json = {error: true, message: error};
    }

    writeJSON(response, result_json);
  });
});


app.post('/userpublicinfo', (request, response) => {
  const form = new formidable.IncomingForm();

  form.parse(request, async (error, fields, files) => {
    const user_id = fields.user_id;

    let result_json;
    try {
      if (user_id === undefined) {
        throw new Error("Invalid parameters");
      }

      const results = await user.getUserPublicInfo(user_id);

      result_json = {error: false, results: results};
    } catch (error) {
      result_json = {error: true, message: error};
    }

    writeJSON(response, result_json);
  });
});


app.post('/followerlist', (request, response) => {
  const form = new formidable.IncomingForm();

  form.parse(request, async (error, fields, files) => {
    const access_token = fields.token;

    let result_json;
    try {
      if (access_token === undefined) {
        throw new Error("Invalid parameters");
      }

      const token_info = user.validateAccessToken(access_token);
      if (!token_info.valid) {
        throw new Error("Invalid access token");
      }

      const results = await user.getFollowerList(token_info.user_id);

      result_json = {error: false, results: results};
    } catch (error) {
      result_json = {error: true, message: error};
    }

    writeJSON(response, result_json);
  });
});


app.post('/followinglist', (request, response) => {
  const form = new formidable.IncomingForm();

  form.parse(request, async (error, fields, files) => {
    const access_token = fields.token;

    let result_json;
    try {
      if (access_token === undefined) {
        throw new Error("Invalid parameters");
      }

      const token_info = user.validateAccessToken(access_token);
      if (!token_info.valid) {
        throw new Error("Invalid access token");
      }

      const results = await user.getFollowingList(token_info.user_id);

      result_json = {error: false, results: results};
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
