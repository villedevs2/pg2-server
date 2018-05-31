const express = require('express');
const formidable = require('formidable');
const util = require('util');
const fs = require('fs');
const facebook = require('./facebook');
const user = require('./user');
const game = require('./game');
const admin = require('./admin');

const settings = require('./settings.json');

console.log(settings.upload_path);

const app = express();
app.use(require('json-middleware').middleware());

const admin_app = express();
admin_app.use(require('json-middleware').middleware());

const activate_app = express();
activate_app.use(require('json-middleware').middleware());


// static GET on /uploads: serve images
//app.use('/uploads', express.static(__dirname + settings.upload_path));


const writeJSON = (response, json) => {
  response.writeHead(200, {'Content-Type': 'text/json'});
  response.write(JSON.stringify(json));
  response.end();
};


const mapPost = (express_app, path, callback) => {
  express_app.post(path, (request, response) => {
    const form = new formidable.IncomingForm();

    form.parse(request, async (error, fields, files) => {
      let results;
      try {
        results = await callback(fields);
        results.error = false;
      } catch (error) {
        results = {};
        results.message = error.message;
        results.error = true;
      }
      writeJSON(response, results);
    });
  });
};

mapPost(app, '/user/login', user.loginWithEmail);        // tested
mapPost(app, '/user/register', user.registerWithEmail);  // tested
mapPost(app, '/user/fblogin', facebook.login);
mapPost(app, '/user/fbregister', facebook.register);
//mapPost(app, '/userinfo', user.getInfo);    // TODO: rename?
mapPost(app, '/user/publicprofile', user.getUserPublicProfile);       // tested
mapPost(app, '/user/privateprofile', user.getUserPrivateProfile);     // tested
mapPost(app, '/user/follow', user.followUser);                        // tested
mapPost(app, '/user/unfollow', user.unfollowUser);                    // tested
mapPost(app, '/user/isfollowed', user.isUserFollowed);                // tested
mapPost(app, '/user/messages', user.getUserMessageList);
mapPost(app, '/user/readmessage', user.readUserMessage);              // tested
mapPost(app, '/user/sendmessage', user.sendUserMessage);              // tested

mapPost(app, '/game/privateinfo', game.getPrivateGameInfo);
mapPost(app, '/game/publicinfo', game.getPublicGameInfo);    // TODO: replace with list public games?
mapPost(app, '/game/stocklist', game.getStockList);
mapPost(app, '/game/buystock', game.buyStock);
mapPost(app, '/game/sellstock', game.sellStock);
mapPost(app, '/game/join', game.joinGame);
mapPost(app, '/game/leaderboard', game.getLeaderboard);
mapPost(app, '/game/buyhistory', user.getBuyHistory);
mapPost(app, '/game/sellhistory', user.getSellHistory);
mapPost(app, '/game/funds', game.getUserFunds);
mapPost(app, '/game/stock', game.getUserStock);

mapPost(admin_app, '/admin/userlist', admin.getUserList);
mapPost(admin_app, '/admin/gamelist', admin.getGameList);



activate_app.get('/activate', async (request, response) => {
  const token = request.query.token;

  try {
    if (token === undefined) {
      throw new Error("Invalid parameters");
    }

    const result = await user.activateUser(token);

    // TODO: show success page
    writeJSON(response, {error: false, result: result});
  } catch (error) {
    // TODO: show error page
    writeJSON(response, {error: true, message: error.message});
  }
});



/*

// *****************************************************************************
// POST /login: login with email/password
// *****************************************************************************
app.post('/login', (request, response) => {

  const form = formidable.IncomingForm();
  form.parse(request, async (error, fields, files) => {
    const email = fields.email;
    const password = fields.password;

    try {
      const results = await user.loginWithEmail(email, password);

      writeJSON(response, {error: false, result: results});
    } catch (error) {
      writeJSON(response, {error: true, message: error.message});
    }
  });

});

// *****************************************************************************
// POST /register: register with email/password/username
// *****************************************************************************
app.post('/register', (request, response) => {
  const form = formidable.IncomingForm();

  form.parse(request, async (error, fields, files) => {
    const username = fields.username;
    const password = fields.password;
    const email = fields.email;

    try {
      const results = await user.registerWithEmail(email, password, username);

      writeJSON(response, {error: false, result: results});
    } catch (error) {
      writeJSON(response, {error: true, message: error.message});
    }

  });

});

app.get('/activate', async (request, response) => {
  const token = request.query.token;

  try {
    if (token === undefined) {
      throw new Error("Invalid parameters");
    }

    const result = await user.activateUser(token);

    // TODO: show success page
    writeJSON(response, {error: false, result: result});
  } catch (error) {
    // TODO: show error page
    writeJSON(response, {error: true, message: error.message});
  }
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
      result_json = {error: true, message: error.message};
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
        throw new Error("Invalid parameters");
      }

      const reg_result = await facebook.register(fb_account, auth_token, user_name);

      result_json = {error: false, result: reg_result};
    } catch (error) {
      result_json = {error: true, message: error.message};
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
        throw new Error("Invalid parameters");
      }

      const token_info = user.validateAccessToken(access_token);
      if (token_info.valid !== true) {
        throw new Error("Invalid access token");
      }

      const user_info = await user.getInfo(token_info.user_id, access_token);

      result_json = {error: false, info: user_info};
    } catch (error) {
      result_json = {error: true, message: error.message};
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
        throw new Error("Invalid parameters");
      }

      const game_info = await game.getGameInfo(game_id);

      result_json = {error: false, info: game_info};
    } catch (error) {
      result_json = {error: true, message: error.message};
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
    const game_id = fields.game_id;

    let result_json;
    try {
      if (market_id === undefined) {
        throw new Error("Invalid parameters");
      }

      const stock_list = await game.getStockList(game_id);

      result_json = {error: false, stock_list: stock_list};
    } catch (error) {
      result_json = {error: true, message: error.message};
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
        throw new Error("Invalid parameters");
      }

      const token_info = user.validateAccessToken(access_token);
      if (!token_info.valid) {
        throw new Error("Invalid access token");
      }

      const results = await game.buyStock(game_id, token_info.user_id, stock_id, amount);

      result_json = {error: false, message: 'OK'};
    } catch (error) {
      result_json = {error: true, message: error.message};
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
        throw new Error("Invalid parameters");
      }

      const token_info = user.validateAccessToken(access_token);
      if (!token_info.valid) {
        throw new Error("Invalid access token");
      }

      const results = await game.sellStock(game_id, token_info.user_id, stock_id, amount);

      result_json = {error: false, message: 'OK'};
    } catch (error) {
      result_json = {error : true, message: error.message};
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
      result_json = {error: true, message: error.message};
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
        throw new Error("User has not joined this game");
      }

      const results = await game.getLeaderboard(game_id);

      result_json = {error: false, results: results};
    } catch (error) {
      result_json = {error: true, message: error.message};
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
        throw new Error("User has not joined this game");
      }

      const results = await user.getBuyHistory(token_info.user_id, game_id);

      result_json = {error: false, results: results};
    } catch (error) {
      result_json = {error: true, message: error.message};
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
        throw new Error("User has not joined this game");
      }

      const results = await user.getSellHistory(token_info.user_id, game_id);

      result_json = {error: false, results: results};
    } catch (error) {
      result_json = {error: true, message: error.message};
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
      result_json = {error: true, message: error.message};
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
      result_json = {error: true, message: error.message};
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
      result_json = {error: true, message: error.message};
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
      result_json = {error: true, message: error.message};
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
      result_json = {error: true, message: error.message};
    }

    writeJSON(response, result_json);
  });
});



// TODO: just for testing, remove
app.post('/sendusermsg_tst', (request, response) => {
  const form = new formidable.IncomingForm();

  form.parse(request, async (error, fields, files) => {
    const user_id = fields.user_id;
    const message_body = fields.message_body;
    const message_title = fields.message_title;

    let result_json;
    try {
      if (user_id === undefined || message_body === undefined || message_title === undefined) {
        throw new Error("Invalid parameters");
      }

      let message = {
        title: message_title,
        message: message_body,
      };

      const result = await user.sendUserMessage(user_id, null, message);

      result_json = {error: false, result: result};
    } catch (error) {
      result_json = {error: true, message: error.message};
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
*/

app.listen(3000, () => {
  console.log('HTTP server started at 3000');
});

admin_app.listen(3333, () => {
  console.log('Admin server started at 3333');
});

activate_app.listen(3666, () => {
  console.log('Activation server started at 3666');
});