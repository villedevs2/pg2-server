const express = require('express');
const formidable = require('formidable');
const util = require('util');
const fs = require('fs');
const db = require('./database');

const settings = require('./settings.json');

console.log(settings.upload_path);

const app = express();


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

// POST on /upload: send image files
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
  console.log('Listening to port 3000');
});
