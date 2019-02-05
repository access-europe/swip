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

    var touchStartPos = { x: 0, y: 0 };
    var zooming = false;
    var zoom = 1.0;
    //var currentZoom = 0.0;
    var prevPinchDist = 0;
    var ignoreNextTouchEnd = false;

    var mapImg = undefined;

    fetch('http://172.21.2.54:3000/mapImg')
      .then(response => response.json())
      .then(data => { console.log(data); mapImg = data; });

    client.onDragStart(function (evt) {
      touchStartPos = evt.position;
      if (evt.originalEvent.touches.length === 2) {
        prevPinchDist = Math.hypot(evt.originalEvent.touches[0].pageX - evt.originalEvent.touches[1].pageX, 
                                   evt.originalEvent.touches[0].pageY - evt.originalEvent.touches[1].pageY);
        //alert(JSON.stringify(evt.position));
        zooming = true;
      }
    });

    client.onDragMove(function (evt) {
      if (ignoreNextTouchEnd)
        return;

      if (!zooming && evt.position.length === 1) {
        let translation = { x: evt.position[0].x - touchStartPos[0].x, 
                            y: evt.position[0].y - touchStartPos[0].y};

        client.emit('moveMap', { translation: translation });
      } else if (zooming) {
        let currentPinchDist = Math.hypot(evt.originalEvent.touches[0].pageX - evt.originalEvent.touches[1].pageX, 
                                          evt.originalEvent.touches[0].pageY - evt.originalEvent.touches[1].pageY);
        zoom += (currentPinchDist - prevPinchDist) / 800;
        prevPinchDist = currentPinchDist;
        client.emit('zoomMap', { zoom: zoom });
      }
    });

    client.onDragEnd(function (evt) {
      if (ignoreNextTouchEnd)
        return;

      if (!zooming && evt.position.length === 1) {
        client.emit('moveMapEnd', { });
      } else if (zooming) {
        zooming = false;
        client.emit('zoomMapEnd', { });
        ignoreNextTouchEnd = true;
        setTimeout(() => {
          ignoreNextTouchEnd = false;
        }, 200);
      }
    });

    client.onUpdate(function (evt) {
      ctx.save();

      applyTransform(ctx, converter, evt.client.transform);

      drawBackground(ctx, evt);
      if (mapImg) {
        drawMaps(ctx, evt, touchStartPos, mapImg);
      }

      drawOpenings(ctx, evt.client);

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

  function drawMaps(ctx, evt, touchStartPos, mapImg) {
    ctx.save();

    let minX = 0;
    let minY = 0;
    evt.cluster.clients.forEach((client) => {
      if (client.transform.x < minX)
        minX = client.transform.x;
      if (client.transform.y < minY)
        minY = client.transform.y;
    });

    let translation = evt.cluster.data.translation ? evt.cluster.data.translation : { x: 0, y: 0 };
    let zoom = evt.cluster.data.zoom ? evt.cluster.data.zoom : 1.0;

    /*let mapImgCenter = { x: touchStartPos.x, y: touchStartPos.y };
    let zoomMapImgCenter = { x: touchStartPos.x * zoom, y: touchStartPos.y * zoom };
    
    let zoomTranslation = { x: zoomMapImgCenter.x - mapImgCenter.x, y: zoomMapImgCenter.y - mapImgCenter.y };*/

    //if (touchStartPos.x != 0 && touchStartPos.y != 0) {
      //alert("mapImgCenter: " + JSON.stringify(mapImgCenter));
      //alert("zoomMapImgCenter: " + JSON.stringify(zoomMapImgCenter));
      //alert("zoomTranslation: " + JSON.stringify(zoomTranslation));
    //}

    let mapImgCenter = { x: mapImg.width / 2, y: mapImg.height / 2 };
    let zoomMapImgCenter = { x: mapImg.width * zoom / 2, y: mapImg.height * zoom / 2 };
    let zoomTranslation = { x: zoomMapImgCenter.x - mapImgCenter.x, y: zoomMapImgCenter.y - mapImgCenter.y };

    let img = new Image();
    img.src = mapImg.img;
    ctx.drawImage(img, 0, 0, mapImg.width, mapImg.height, minX + translation.x - zoomTranslation.x, 
                  minY + translation.y - zoomTranslation.y, mapImg.width * zoom, mapImg.height * zoom);

    ctx.restore();
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
