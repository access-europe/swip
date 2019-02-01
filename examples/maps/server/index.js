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
        blobs: { $set: getNewParticleDist(cluster1, cluster2, transform) },
        backgroundColor: { $set: cluster1.data.backgroundColor },
      }),
    },
    init: () => ({ blobs: [], backgroundColor: getRandomColor() }),
  },

  client: {
    init: () => ({}),
    events: {
      addBlobs: ({ cluster, client }, { blobs }) => {
        return {
          cluster: {
            data: { blobs: { $push: blobs } },
          },
        };
      },
      updateBlobs: ({ cluster, client }, { blobs }) => {
        return {
          cluster: {
            data: { blobs: { $set: blobs } },
          },
        };
      },
    },
  },
});

function isParticleInClient (particle, client) {
  const leftSide = client.transform.x;
  const rightSide = (client.transform.x + client.size.width);
  const topSide = client.transform.y;
  const bottomSide = (client.transform.y + client.size.height);

  if (particle.x < rightSide && particle.x > leftSide && particle.y > topSide && particle.y < bottomSide) {
    return true;
  }

  return false;
}

function isWallOpenAtPosition (transform, openings, particlePos) {
  return openings.some((opening) => (
    particlePos >= (opening.start + transform) && particlePos <= (opening.end + transform)
  ));
}

function getNewParticleDist (cluster1, cluster2, transform) {
  cluster2.clients.forEach((client) => {
    for (let i = 0; i < cluster2.data.blobs.length; i++) {
      if (isParticleInClient(cluster2.data.blobs[i], client)) {
        cluster2.data.blobs[i].x += transform.x;
        cluster2.data.blobs[i].y += transform.y;
      }
    }
  });

  return cluster1.data.blobs.concat(cluster2.data.blobs);
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

  //storedData = { 'zoom': zoom, 'lat': latitude, 'lon': longitude };

  console.log("Getting map's tiles");
  for (var i = 0; i < colsCount; ++i) {
    for (var j = 0; j < rowsCount; ++j) {
      let imgUrl = { src: 'http://172.21.2.54:3000/proxy?url=https://a.tile.openstreetmap.org/' + zoom + '/' + (coords[0] + i) + '/' + (coords[1] + j) + '.png',
                     x: i * 256,
                     y: j * 256 };
      mapTilesImgs.push(imgUrl);
    }
  }

  //console.log("imgs: " + JSON.stringify(mapTilesImgs));
  return { imgs: mapTilesImgs, rows: rowsCount, cols: colsCount };
}

server.listen(3000);

let map = getMapImgUrls(mapImg.width, mapImg.height, 17);
mergeImages(map.imgs, { quality: 0.9, format: 'image/jpeg', width: mapImg.width, height: mapImg.height, Canvas: createCanvas, Image: Image })
  .then(b64 => { mapImg.img = b64; })
  .catch(err => { console.log("couldn't load the image:" + err) });



// eslint-disable-next-line no-console
console.log('started server: http://localhost:3000');
