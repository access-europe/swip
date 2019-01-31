var alreadyDrawn = false;
var drawnTimes = 0;

/* eslint-disable */
(function () {
  'use strict';

  var socket = io.connect();

  swip.init({ socket: socket, container: document.getElementById('root'), type: 'canvas' }, function (client) {
    var converter = client.converter;
    var stage = client.stage;
    var ctx = stage.getContext('2d');

    var counter = 0;
    var blobs = [];
    var activeBlobs = [];
    var clickedBlobs = [];

    client.onDragStart(function (evt) {
      evt.position.forEach(function (pos) {
        for (var i = 0; i < blobs.length; i++) {
          if (touchInRadius(pos.x, pos.y, blobs[i].x, blobs[i].y, blobs[i].size * 2)) {
            clickedBlobs.push(blobs.splice(i, 1)[0]);
          }
        }
      });
      if (clickedBlobs.length > 0) {
        client.emit('updateBlobs', { blobs: blobs });
      }

      if (clickedBlobs == false) {
        evt.position.forEach(function (pos) {
          activeBlobs.push({
            x: pos.x,
            y: pos.y,
            speedX: 0,
            speedY: 0,
            size: converter.toAbsPixel(15)
          });
        });
      }
    });

    client.onDragMove(function (evt) {
      if (clickedBlobs.length > 0) {
        if (counter >= 3) {
          evt.position.forEach(function (pos) {
            for (var i = 0; i < clickedBlobs.length; i++) {
              if (touchInRadius(pos.x, pos.y, clickedBlobs[i].x, clickedBlobs[i].y, clickedBlobs[i].size * 10)) {
                clickedBlobs[i].x = pos.x;
                clickedBlobs[i].y = pos.y;
              }
            }
          });
          counter = 0;
        }
        counter++;
      } else {
        evt.position.forEach(function (pos) {
          for (var i = 0; i < activeBlobs.length; i++) {
            if (touchInRadius(pos.x, pos.y, activeBlobs[i].x, activeBlobs[i].y, activeBlobs[i].size)) {
              activeBlobs.splice(i, 1);
              i--;
            }
          }
        });
      }
    });

    client.onDragEnd(function (evt) {
      if (clickedBlobs == false) {
        evt.position.forEach(function (pos) {
          var emitBlobs = [];
          for (var i = 0; i < activeBlobs.length; i++) {
            if (touchInRadius(pos.x, pos.y, activeBlobs[i].x, activeBlobs[i].y, activeBlobs[i].size)) {
              emitBlobs.push(activeBlobs[i]);
              activeBlobs.splice(i, 1);
              i--;
            }
          }
          if (emitBlobs) {
            client.emit('addBlobs', { blobs: emitBlobs });
          }
        });
      } else {
        evt.position.forEach(function (pos) {
          var emitBlobs = [];
          for (var i = 0; i < clickedBlobs.length; i++) {
            var startX = clickedBlobs[i].x;
            var startY = clickedBlobs[i].y;

            if (touchInRadius(pos.x, pos.y, clickedBlobs[i].x, clickedBlobs[i].y, clickedBlobs[i].size * 40)) {
              clickedBlobs[i].x = pos.x;
              clickedBlobs[i].y = pos.y;
              clickedBlobs[i].speedX = (pos.x - startX) / 2;
              clickedBlobs[i].speedY = (pos.y - startY) / 2;
              emitBlobs.push(clickedBlobs.splice(i, 1)[0]);
              i--;
            }
          }
          client.emit('addBlobs', { blobs: emitBlobs });
        });
      }
    });

    client.onUpdate(function (evt) {
      var updatedBlobs = evt.cluster.data.blobs;
      blobs = updatedBlobs;

      ctx.save();

      applyTransform(ctx, converter, evt.client.transform);

      /*if (!alreadyDrawn) { 
        drawBackground(ctx, evt);
        alreadyDrawn = true;
      }*/
      drawBackground(ctx, evt);
      drawMaps(ctx, evt);
      drawOpenings(ctx, evt.client);
      //increaseActiveBlobSize(activeBlobs, converter);
      //drawBlobs(ctx, activeBlobs, clickedBlobs, updatedBlobs);

      //if (!alreadyDrawn) { 
      //drawMaps(ctx, evt);
      //  if (drawnTimes > 100)
      //    alreadyDrawn = true;
      //  drawnTimes++;
      //}

      ctx.restore();
    });
  });

  function drawBackground(ctx, evt) {
    ctx.save();

    ctx.fillStyle = evt.cluster.data.backgroundColor;
    ctx.fillRect(evt.client.transform.x, evt.client.transform.y, evt.client.size.width, evt.client.size.height);

    ctx.restore();
  }

  function applyTransform(ctx, converter, transform) {
    ctx.translate(-converter.toDevicePixel(transform.x), -converter.toDevicePixel(transform.y));
    ctx.scale(converter.toDevicePixel(1), converter.toDevicePixel(1));
  }

  function increaseActiveBlobSize(activeBlobs, converter) {
    if (activeBlobs) {
      for (var i = 0; i < activeBlobs.length; i++) {
        if (activeBlobs[i].size < converter.toAbsPixel(100)) {
          activeBlobs[i].size += 1;
        }
      }
    }
  }

  function latlon_to_tile(lat, lon, zoom) {
    var m = Math.pow(2, zoom);
    var lat_rad = lat * Math.PI / 180;
    return [Math.floor((lon + 180) / 360 * m), Math.floor((1 - Math.log(Math.tan(lat_rad) + 1 / Math.cos(lat_rad)) / Math.PI) / 2 * m)];
  }

  /*var imageCollector = function(expectedCount, completeCb) {
    var receivedCount;
    return function() {
      if (++receivedCount == expectedcount) {
        completeCb();
      }
    };
  }();*/

  var mapCanvas = document.createElement('canvas');
  var mapCtx = mapCanvas.getContext('2d');
  var mapImg = new Image();
  var mapTilesImgs = [];
  var storedData = {
    zoom: undefined,
    lat: undefined,
    lon: undefined
  }
  var storedMapSize = {
    width: 0,
    height: 0
  }
  function getMapTileImg(width, height, zoom) {
    mapTilesImgs = [];
    let latitude = 51.485891900000006;
    let longitude = 6.8653518;
    let coords = latlon_to_tile(latitude, longitude, zoom);
    let rowsCount = Math.ceil(height / 256.0);
    let colsCount = Math.ceil(width / 256.0);

    //let expectedCanvasSize = { width: 500 * colsCount, height: 500 * rowsCount };
    //if (mapCtx.canvas.width != expectedCanvasSize.width || mapCtx.canvas.height != expectedCanvasSize.height || storedData.zoom != zoom ||
    //    storedData.lat != latitude || storedData.lon != longitude) {
    //  mapCtx.canvas.width = expectedCanvasSize.width;
    //  mapCtx.canvas.height = expectedCanvasSize.height;
      storedData = { 'zoom': zoom, 'lat': latitude, 'lon': longitude };

      /*mapTilesImgs = new Array(colsCount);
      for (var i = 0; i < colsCount; ++i) {
        mapTilesImgs[i] = new Array(rowsCount);
      }*/

      //mapTilesCtx.clearRect(0, 0, mapTilesCanvas.width, mapTilesCanvas.height);

      console.log("Getting map's tiles");
      for (var i = 0; i < colsCount; ++i) {
        mapTilesImgs.push([]);
        for (var j = 0; j < rowsCount; ++j) {
          var img = new Image();
          img.crossOrigin = "Anonymous";
          img.onload = () => { 
            //mapTilesImgs[i][j] = this;
            //mapTilesCtx.drawImage(img, 0, 0, 256, 256, i * 256, j * 256, 256, 256);
          }
          img.src = 'http://172.21.2.54:3000/proxy?url=https://a.tile.openstreetmap.org/' + zoom + '/' + (coords[0] + i) + '/' + (coords[1] + j) + '.png';
          /*img.src = "http://maps.google.com/maps/api/staticmap?sensor=false&center=" + latitude + "," +
            longitude + "&zoom=" + zoom + "&size=" + 512 + "x" + 512 + "&markers=color:blue|label:U|" + latitude + ',' + 
            longitude + "&key=AIzaSyAhNhrDn8v6qEJpQUO1S_DYuCp_V3f5bJw&callback=mapsAPILoaded";*/
          mapTilesImgs[i].push(img);
        }
      }
    //}*/

    /*if (mapImg.width != width || mapImg.height != height || storedData.zoom != zoom || storedData.lat != latitude || storedData.lon != longitude) {
      //mapCtx.canvas.width = width;
      //mapCtx.canvas.height = height;
      storedData = { 'zoom': zoom, 'lat': latitude, 'lon': longitude };
      mapImg.width = width;
      mapImg.height = height;

      //mapCtx.clearRect(0, 0, mapCanvas.width, mapCanvas.height);

      console.log("PIOTR!");
      var google_tile = "http://maps.google.com/maps/api/staticmap?sensor=false&center=" + latitude + "," +
        longitude + "&zoom=" + zoom + "&size=" + width + "x" + height + "&markers=color:blue|label:U|" + latitude + ',' + 
        longitude + "&key=AIzaSyAhNhrDn8v6qEJpQUO1S_DYuCp_V3f5bJw&callback=mapsAPILoaded";

      mapImg.src = google_tile;
      
      mapImg.onload = function() {
        console.log(this.width + "x" + this.height);
      }
    }*/

    return mapTilesImgs;
  }

  var img = new Image;
  //img.src = 'https://www.petmd.com/sites/default/files/over-active-dog-211592482.jpg';
  img.src = 'https://hdwallsource.com/img/2014/7/desktop-images-15066-15533-hd-wallpapers.jpg';
  var storedSize = { width: 0, height: 0 };
  function drawMaps(ctx, evt) {
    ctx.save();

    let totalWidth = 0;
    for (var i = 0; i < evt.cluster.clients.length; i++) {
      totalWidth += evt.cluster.clients[i].size.width;
    }
    let maxHeight = Math.max(...evt.cluster.clients.map(client => client.size.height));

    if (totalWidth != storedSize.width || maxHeight != storedSize.height) {
      mapImg = getMapTileImg(totalWidth, maxHeight, 4);
      
      storedSize.width = totalWidth;
      storedSize.height = maxHeight;
    }
    
    //img.src = mapImgCanvas.toDataURL();
    //ctx.drawImage(mapImg, 0, 0, 1920, 1080, 0, 0, totalWidth, maxHeight);

    for (var i = 0; i < mapTilesImgs.length; ++i) {
      for (var j = 0; j < mapTilesImgs[i].length; ++j) {
        ctx.drawImage(mapTilesImgs[i][j], 0, 0, 256, 256, i * 256, j * 256, 256, 256);
      }
    }

    //ctx.drawImage(mapImg, 0, 0, 1920, 1080, 0, 0, 1000, 1080);
    //ctx.drawImage(img, 0, 0, 590, 428, 0, 0, 360, 500);
    //ctx.drawImage(img, 0, 0, 1920, 1080, 0, 0, totalWidth, maxHeight);
    //ctx.drawImage(img, 0, 0, 590, 428, 0, 0, totalWidth, maxHeight);
    ctx.restore();

    /*ctx.beginPath();
    ctx.arc(620, 10, 5, 0, 2 * Math.PI, false);
    ctx.fillStyle = '#FFFFFF';
    ctx.fill();*/
  }

  function drawBlobs(ctx, activeBlobs, clickedBlobs, updatedBlobs) {
    ctx.shadowBlur = 0;

    ctx.save();

    activeBlobs.forEach(function (blob) {
      ctx.beginPath();
      ctx.arc(blob.x, blob.y, blob.size, 0, 2 * Math.PI, false);
      ctx.fillStyle = '#FFFFFF';
      ctx.fill();
    });

    clickedBlobs.forEach(function (blob) {
      ctx.beginPath();
      ctx.arc(blob.x, blob.y, blob.size, 0, 2 * Math.PI, false);
      ctx.fillStyle = '#FFFFFF';
      ctx.fill();
    });

    updatedBlobs.forEach(function (blob) {
      ctx.beginPath();
      ctx.arc(blob.x, blob.y, blob.size, 0, 2 * Math.PI, false);
      ctx.fillStyle = '#FFFFFF';
      ctx.fill();
    });

    ctx.restore();
  }

  function touchInRadius(posX, posY, blobX, blobY, blobsSize) {
    var inRadius = false;

    if ((posX < (blobX + blobsSize) && posX > (blobX - blobsSize)) &&
      (posY < (blobY + blobsSize) && posY > (blobY - blobsSize))) {
      inRadius = true;
    }

    return inRadius;
  }

  function drawOpenings(ctx, client) {
    var openings = client.openings;
    var transformX = client.transform.x;
    var transformY = client.transform.y;
    var width = client.size.width;
    var height = client.size.height;

    ctx.lineWidth = 5;
    ctx.shadowBlur = 5;

    openings.left.forEach(function (wall) {
      ctx.strokeStyle = "#ff9e00";
      ctx.shadowColor = "#ff9e00";

      ctx.beginPath();
      ctx.moveTo(transformX, wall.start + transformY);
      ctx.lineTo(transformX, wall.end + transformY);
      ctx.stroke();
    });

    openings.top.forEach(function (wall) {
      ctx.strokeStyle = "#0084FF";
      ctx.shadowColor = "#0084FF";

      ctx.beginPath();
      ctx.moveTo(wall.start + transformX, transformY);
      ctx.lineTo(wall.end + transformX, transformY);
      ctx.stroke();
    });

    openings.right.forEach(function (wall) {
      ctx.strokeStyle = "#0084FF";
      ctx.shadowColor = "#0084FF";

      ctx.beginPath();
      ctx.moveTo(width + transformX, wall.start + transformY);
      ctx.lineTo(width + transformX, wall.end + transformY);
      ctx.stroke();
    });

    openings.bottom.forEach(function (wall) {
      ctx.strokeStyle = "#ff9e00";
      ctx.shadowColor = "#ff9e00";

      ctx.beginPath();
      ctx.moveTo(wall.start + transformX, height + transformY);
      ctx.lineTo(wall.end + transformX, height + transformY);
      ctx.stroke();
    });
  }
}());
