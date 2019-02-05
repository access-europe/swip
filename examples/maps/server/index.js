//import mergeImages from 'merge-images';
const mergeImages = require("merge-images");
const { createCanvas, Canvas } = require('canvas');
const { Image } = require('canvas');

const express = require('express');
const app = express();
const server = require('http').Server(app);
const io = require('socket.io')(server);
const swip = require('../../../src/server/index.js');
var request = require('request');

var mapImg = { img: '', width: 1920, height: 1080 };
var mapMoveTranslation = { x: 0, y: 0 };
var currentMapMoveTranslation = { x: 0, y: 0 };

app.use(express.static(__dirname + './../static'));
app.use('/proxy', function(req, res) {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
  var url = req.url.replace('/?url=','');
  req.pipe(request(url)).pipe(res);
});
app.get("/mapImg", function (req, res) {
  res.status(200).send(mapImg);
});

swip(io, {
  cluster: {
    events: {
      update: (cluster) => {
        const clients = cluster.clients;

        return {
        };
      },
      merge: (cluster1, cluster2, transform) => ({
        backgroundColor: { $set: cluster1.data.backgroundColor },
      }),
    },
    init: () => ({ backgroundColor: getRandomColor() }),
  },

  client: {
    init: () => ({}),
    events: {
      moveMap: ({ cluster, client }, { translation }) => {
        currentMapMoveTranslation.x = translation.x;
        currentMapMoveTranslation.y = translation.y;
        //console.log("moveMap");
        return {
          cluster: {
            data: { translation: { $set: getFinalMapTranslation() } },
          },
        };
      },
      moveMapEnd: ({ cluster, client }, { }) => {
        mapMoveTranslation.x += currentMapMoveTranslation.x;
        mapMoveTranslation.y += currentMapMoveTranslation.y;
        currentMapMoveTranslation = { x: 0, y: 0 };
        //console.log("moveMapEnd: " + JSON.stringify(getFinalMapTranslation()));
        return {
          cluster: {
            data: { translation: { $set: getFinalMapTranslation() } },
          },
        };
      },
      zoomMap: ({ cluster, client }, { zoom }) => {
        return {
          cluster: {
            data: { zoom: { $set: zoom } },
          },
        };
      },
      zoomMapEnd: ({ cluster, client }, { }) => {
        //console.log(console.log("zoomMapEnd"));
        return {
          cluster: {
            data: { },
          },
        };
      },
    },
  },
});

function getFinalMapTranslation() {
  return { x: mapMoveTranslation.x + currentMapMoveTranslation.x,
           y: mapMoveTranslation.y + currentMapMoveTranslation.y };
}

function getRandomColor () {
  const colors = ['#f16745', '#ffc65d', '#7bc8a4', '#4cc3d9', '#93648d'];
  return colors[Math.floor(Math.random() * colors.length)];
}

function latlon_to_tile(lat, lon, zoom) {
  var m = Math.pow(2, zoom);
  var lat_rad = lat * Math.PI / 180;
  return [Math.floor((lon + 180) / 360 * m), Math.floor((1 - Math.log(Math.tan(lat_rad) + 1 / Math.cos(lat_rad)) / Math.PI) / 2 * m)];
}

function getMapImgUrls(width, height, zoom) {
  var mapTilesImgs = [];
  let latitude = 51.485891900000006;
  let longitude = 6.8653518;
  let coords = latlon_to_tile(latitude, longitude, zoom);
  let rowsCount = Math.ceil(height / 256.0);
  let colsCount = Math.ceil(width / 256.0);

  console.log("Getting map's tiles");
  for (var i = 0; i < colsCount; ++i) {
    for (var j = 0; j < rowsCount; ++j) {
      let imgUrl = { src: 'http://172.21.2.54:3000/proxy?url=https://a.tile.openstreetmap.org/' + zoom + '/' + (coords[0] + i) + '/' + (coords[1] + j) + '.png',
                     x: i * 256,
                     y: j * 256 };
      mapTilesImgs.push(imgUrl);
    }
  }

  return { imgs: mapTilesImgs, rows: rowsCount, cols: colsCount };
}

server.listen(3000);

let map = getMapImgUrls(mapImg.width, mapImg.height, 17);
mergeImages(map.imgs, { quality: 0.9, format: 'image/jpeg', width: mapImg.width, height: mapImg.height, Canvas: createCanvas, Image: Image })
  .then(b64 => { mapImg.img = b64; })
  .catch(err => { console.log("couldn't load the image:" + err) });

console.log('started server: http://localhost:3000');
