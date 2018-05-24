const sharp = require('sharp');
const {createCanvas, loadImage} = require('canvas');


const avatar = {
  width: 220,
  height: 220,
};

const base = {
  x: 10,
  y: 10,
};

const frame = {
  x: 0,
  y: 0,
};

const badge = {
  x: 10,
  y: 10,
};


const makeAvatar = async () => {
  const canvas = createCanvas(avatar.width, avatar.height);
  const context = canvas.getContext('2d');

  try {
    const base_image = await loadImage('imagestack/avatar_test_base.png');
    const frame_image = await loadImage('imagestack/avatar_test_frame.png');
    const badge_image = await loadImage('imagestack/avatar_test_badge.png');

    context.drawImage(base_image, base.x, base.y);
    context.drawImage(frame_image, frame.x, frame.y);
    context.drawImage(badge_image, badge.x, badge.y);

    sharp(canvas.toBuffer())
    .toFormat(sharp.format.webp)
    .toFile('output.webp', (error, info) => {
      if (error !== null) {
        console.log(error);
      }
      //console.log(info);
    });
  } catch (error) {
    console.log(error);
  }
};

makeAvatar();



/*
  sharp('imagestack/avatar_test_base.png')
    .resize(400, 400)
    .toFile('output.jpg', (error, info) => {
      console.log(error);
     console.log(info);
  });
*/