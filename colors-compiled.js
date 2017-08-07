"use strict";

var _slicedToArray = function () { function sliceIterator(arr, i) { var _arr = []; var _n = true; var _d = false; var _e = undefined; try { for (var _i = arr[Symbol.iterator](), _s; !(_n = (_s = _i.next()).done); _n = true) { _arr.push(_s.value); if (i && _arr.length === i) break; } } catch (err) { _d = true; _e = err; } finally { try { if (!_n && _i["return"]) _i["return"](); } finally { if (_d) throw _e; } } return _arr; } return function (arr, i) { if (Array.isArray(arr)) { return arr; } else if (Symbol.iterator in Object(arr)) { return sliceIterator(arr, i); } else { throw new TypeError("Invalid attempt to destructure non-iterable instance"); } }; }();

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _toConsumableArray(arr) { if (Array.isArray(arr)) { for (var i = 0, arr2 = Array(arr.length); i < arr.length; i++) { arr2[i] = arr[i]; } return arr2; } else { return Array.from(arr); } }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var widthInput = document.querySelector('[data-js="width"]');
var heightInput = document.querySelector('[data-js="height"]');
var paintersQty = document.querySelector('[data-js="painters"]');
var selectionMode = document.querySelector('[data-js="selectionMode"]');
var colorComparison = document.querySelector('[data-js="colorComparison"]');
var seedMode = document.querySelector('[data-js="seedMode"]');
var seedQty = document.querySelector('[data-js="seedQty"]');
var seedColor = document.querySelector('[data-js="seedColor"]');
var seedPos = document.querySelector('[data-js="seedPos"]');

var startBtn = document.querySelector('[data-js="start"]');
var saveImageBtn = document.querySelector('[data-js="download"]');

var canvas = document.querySelector('[data-js="canvas"]');
var ctx = canvas.getContext('2d');

var paintingNum = 0;

var colorDepth = void 0;
var colorSkip = void 0;

var colors = [];
var labColors = [];
var anchors = [];

var width = void 0;
var height = void 0;

var painters = [];

saveImageBtn.addEventListener('click', DownloadImage);
startBtn.addEventListener('click', Start);
seedMode.addEventListener('change', AddModeClass);
document.body.addEventListener('keypress', KbStart);

var Color = function () {
  function Color(r, g, b) {
    _classCallCheck(this, Color);

    this.r = Math.round(r);
    this.g = Math.round(g);
    this.b = Math.round(b);
  }

  _createClass(Color, [{
    key: 'toStyle',
    value: function toStyle() {
      return 'rgb(' + this.r + ', ' + this.g + ', ' + this.b + ')';
    }
  }, {
    key: 'distanceSqrFrom',
    value: function distanceSqrFrom(color) {
      return Math.pow(color.r - this.r, 2) + Math.pow(color.g - this.g, 2) + Math.pow(color.b - this.b, 2);
    }

    //Based on http://www.easyrgb.com/en/math.php
    //Goes from RGB to XYZ to LAB

  }, {
    key: 'toColorLAB',
    value: function toColorLAB() {
      var rgb = [this.r, this.g, this.b].map(function (c) {
        var color = c / 255;
        color = color > 0.04045 ? Math.pow((color + 0.055) / 1.055, 2.4) : color / 12.92;
        return color * 100;
      });

      var _rgb = _slicedToArray(rgb, 3),
          xyzR = _rgb[0],
          xyzG = _rgb[1],
          xyzB = _rgb[2];

      var x = (xyzR * 0.4124 + xyzG * 0.3576 + xyzB * 0.1805) * 0.95047;
      var y = (xyzR * 0.2126 + xyzG * 0.7152 + xyzB * 0.0722) * 1;
      var z = (xyzR * 0.0193 + xyzG * 0.1192 + xyzB * 0.9505) * 1.08883;

      var labxyz = [x, y, z].map(function (c) {
        var color = c / 100;
        return color > 0.008856 ? Math.pow(color, 1 / 3) : color * 7.787 + 16 / 116;
      });

      var _labxyz = _slicedToArray(labxyz, 3),
          labX = _labxyz[0],
          labY = _labxyz[1],
          labZ = _labxyz[2];

      var l = labY * 116 - 16;
      var a = (labX - labY) * 500;
      var b = (labY - labZ) * 200;

      return new ColorLAB(l, a, b);
    }
  }]);

  return Color;
}();

var ColorLAB = function () {
  function ColorLAB(l, a, b) {
    _classCallCheck(this, ColorLAB);

    this.l = l;
    this.a = a;
    this.b = b;
  }

  // Based on https://github.com/THEjoezack/ColorMine/blob/master/ColorMine/ColorSpaces/Comparisons/Cie94Comparison.cs


  _createClass(ColorLAB, [{
    key: 'deltaESqrFrom',
    value: function deltaESqrFrom(labColor) {
      var k1 = .045;
      var k2 = .015;

      var dL = this.l - labColor.l;
      var dA = this.a - labColor.a;
      var dB = this.b - labColor.b;

      var c1 = Math.sqrt(Math.pow(this.a, 2) + Math.pow(this.b, 2));
      var c2 = Math.sqrt(Math.pow(labColor.a, 2) + Math.pow(labColor.b, 2));
      var dC = c1 - c2;

      var dH = Math.sqrt(Math.max(Math.pow(dA, 2) + Math.pow(dB, 2) - Math.pow(dC, 2), 0));

      var sC = 1 + k1 * c1;
      var sH = 1 + k2 * c1;

      var l = dL;
      var c = dC / sC;
      var h = dH / sH;

      var dESqr = Math.pow(l, 2) + Math.pow(c, 2) + Math.pow(h, 2);
      return dESqr < 0 ? 0 : dESqr;
    }
  }]);

  return ColorLAB;
}();

var Pos = function Pos(x, y) {
  _classCallCheck(this, Pos);

  this.x = x;
  this.y = y;
};

var Anchor = function () {
  function Anchor(pos, color) {
    _classCallCheck(this, Anchor);

    this.pos = pos;
    this.color = color;
  }

  _createClass(Anchor, [{
    key: 'getAvailableNeighbours',
    value: function getAvailableNeighbours() {
      var minX = Math.max(0, this.pos.x - 1);
      var maxX = Math.min(ctx.canvas.width - 1, this.pos.x + 1);
      var minY = Math.max(0, this.pos.y - 1);
      var maxY = Math.min(ctx.canvas.height - 1, this.pos.y + 1);

      var width = maxX - minX + 1;
      var height = maxY - minY + 1;

      var imgData = ctx.getImageData(minX, minY, width, height);

      var curPos = new Pos(minX, minY);
      var availablePositions = [];

      //Image data is a sequential array with the format rgba, if alpha is set the position is occupied
      for (var i = 3; i < width * height * 4; i += 4) {
        if (imgData.data[i] === 0) availablePositions.push(curPos);

        var newPos = new Pos(curPos.x, curPos.y);
        newPos.x++;
        if (newPos.x > maxX) {
          newPos.x = minX;
          newPos.y++;
        }
        curPos = newPos;
      }
      return availablePositions;
    }
  }, {
    key: 'hasAvailableNeighbours',
    value: function hasAvailableNeighbours() {
      var minX = Math.max(0, this.pos.x - 1);
      var maxX = Math.min(ctx.canvas.width - 1, this.pos.x + 1);
      var minY = Math.max(0, this.pos.y - 1);
      var maxY = Math.min(ctx.canvas.height - 1, this.pos.y + 1);

      var width = maxX - minX + 1;
      var height = maxY - minY + 1;

      var imgData = ctx.getImageData(minX, minY, width, height);

      for (var i = 3; i < width * height * 4; i += 4) {
        if (imgData.data[i] === 0) return true;
      }
      return false;
    }
  }]);

  return Anchor;
}();

var Painter = function () {
  function Painter() {
    _classCallCheck(this, Painter);

    this.isPainting = false;
    this.animationFrame = null;
  }

  _createClass(Painter, [{
    key: 'Draw',
    value: function Draw() {
      var _this = this;

      if (anchors.length > 0) {
        var anchor = void 0;
        var canUseAnchor = false;

        do {
          if (anchors.length === 0) {
            this.StopDrawing();
            var anyPainterActive = painters.some(function (p) {
              return p.isPainting;
            });
            if (!anyPainterActive) console.log('All painters finished for painting ' + paintingNum);
            return;
          }

          var idx = void 0;
          if (selectionMode.value === 'random') idx = anchors.indexOf(PickRandom(anchors));else if (selectionMode.value === 'worm') idx = anchors.length - 1;else if (selectionMode.value === 'root') idx = 0;

          anchor = anchors.splice(idx, 1)[0];
          canUseAnchor = anchor.hasAvailableNeighbours();
        } while (!canUseAnchor);

        var availablePos = anchor.getAvailableNeighbours();
        var pos = PickRandom(availablePos);
        var color = PickClosestColor(anchor.color);

        var newAnchor = new Anchor(pos, color);
        if (newAnchor.hasAvailableNeighbours()) {
          anchors.push(newAnchor);
        }

        ctx.fillStyle = color.toStyle();
        ctx.fillRect(pos.x, pos.y, 1, 1);

        //Add anchor back if it still has available neighbours
        if (anchor.hasAvailableNeighbours()) {
          anchors.push(anchor);
        }
        if (this.isPainting && (colors.length > 0 || anchors.length > 0)) this.animationFrame = requestAnimationFrame(function () {
          return _this.Draw();
        });
      } else {
        this.StopDrawing();
        var _anyPainterActive = painters.some(function (p) {
          return p.isPainting;
        });
        if (!_anyPainterActive) console.log('All painters finished for painting ' + paintingNum);
        return;
      }
    }
  }, {
    key: 'StopDrawing',
    value: function StopDrawing() {
      this.isPainting = false;
      cancelAnimationFrame(this.animationFrame);
      this.animationFrame = null;
    }
  }, {
    key: 'StartDrawing',
    value: function StartDrawing() {
      var _this2 = this;

      this.isPainting = true;
      this.animationFrame = requestAnimationFrame(function () {
        return _this2.Draw();
      });
    }
  }]);

  return Painter;
}();

function Init() {
  width = +widthInput.value;
  height = +heightInput.value;

  canvas.width = width;
  canvas.height = height;

  //Bits of colors per channel
  colorDepth = Math.pow(2, (Math.log2(width) + Math.log2(height)) / 3);
  //Used to fill the color array with the necessary colors
  colorSkip = 256 / colorDepth;

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  //Trigger transition
  setTimeout(function () {
    canvas.style.width = width + 'px';
    canvas.style.height = height + 'px';
  }, 0);

  AddModeClass();
}
Init();

function Start() {
  Init();

  paintingNum++;

  colors = [];
  labColors = [];
  anchors = [];

  //Set all colors
  for (var _i2 = 0; _i2 < colorDepth; _i2++) {
    for (var j = 0; j < colorDepth; j++) {
      for (var k = 0; k < colorDepth; k++) {
        colors.push(new Color(colorSkip * _i2, colorSkip * j, colorSkip * k));
        labColors.push(colors[colors.length - 1].toColorLAB());
      }
    }
  }

  while (painters.length > 0) {
    painters.pop().StopDrawing();
  }

  //Seeds with initial anchors
  if (seedMode.value === 'random') {
    if (seedQty.value < 1) seedQty.value = 1;
    for (var i = 0; i < seedQty.value; i++) {
      var randPos = void 0;
      var canUsePos = false;
      do {
        randPos = new Pos(Math.floor(Math.random() * width), Math.floor(Math.random() * height));
        var posAlpha = ctx.getImageData(randPos.x, randPos.y, 1, 1).data[3];
        if (posAlpha === 0) canUsePos = true;
      } while (!canUsePos);
      var randColor = colors.splice(Math.floor(Math.random() * colors.length), 1)[0];
      anchors.push(new Anchor(randPos, randColor));
      ctx.fillStyle = anchors[i].color.toStyle();
      ctx.fillRect(anchors[i].pos.x, anchors[i].pos.y, 1, 1);
    }
  } else if (seedMode.value === 'pick') {
    var anchorPos = void 0;
    switch (seedPos.value) {
      case 'tl':
        anchorPos = new Pos(0, 0);
        break;
      case 'tc':
        anchorPos = new Pos(Math.floor(width / 2), 0);
        break;
      case 'tr':
        anchorPos = new Pos(width - 1, 0);
        break;
      case 'cl':
        anchorPos = new Pos(0, Math.floor(height / 2));
        break;
      case 'cc':
        anchorPos = new Pos(Math.floor(width / 2), Math.floor(height / 2));
        break;
      case 'cr':
        anchorPos = new Pos(width - 1, Math.floor(height / 2));
        break;
      case 'bl':
        anchorPos = new Pos(0, height - 1);
        break;
      case 'bc':
        anchorPos = new Pos(Math.floor(width / 2), height - 1);
        break;
      case 'br':
        anchorPos = new Pos(width - 1, height - 1);
        break;
    }
    //Gets each component in hex
    var hexColors = /#([a-f0-9]{2})([a-f0-9]{2})([a-f0-9]{2})/i.exec(seedColor.value).slice(1, 4);
    //Converts to decimal components
    var rgb = hexColors.map(function (c) {
      return +('0x' + c);
    });
    var anchorColor = PickClosestColor(new (Function.prototype.bind.apply(Color, [null].concat(_toConsumableArray(rgb))))());
    anchors.push(new Anchor(anchorPos, anchorColor));
    ctx.fillStyle = anchors[0].color.toStyle();
    ctx.fillRect(anchors[0].pos.x, anchors[0].pos.y, 1, 1);
  }

  if (paintersQty.value <= 0) paintersQty.value = 1;
  for (var _i3 = 0; _i3 < paintersQty.value; _i3++) {
    var painter = new Painter();
    painter.StartDrawing();
    painters.push(painter);
  }

  console.log('Painting ' + paintingNum + ' started with ' + paintersQty.value + ' painters');
}

function AddModeClass() {
  seedMode.parentElement.className = '';
  seedMode.parentElement.classList.add(seedMode.value + '-active');
}

function KbStart(e) {
  if (e.keyCode === 13) Start();
}

function PickClosestColor(color) {
  var minDist = Infinity;
  var curIdx = null;
  var labColor = void 0;

  var labCompare = colorComparison.value === 'lab';
  if (labCompare) labColor = color.toColorLAB();
  for (var i = 0; i < colors.length; i++) {
    var dist = void 0;
    if (labCompare) {
      dist = labColor.deltaESqrFrom(labColors[i]);
    } else {
      dist = color.distanceSqrFrom(colors[i]);
    }
    if (dist < minDist) {
      minDist = dist;
      curIdx = i;
    }
  }
  labColors.splice(curIdx, 1);
  return colors.splice(curIdx, 1)[0];
}

function PickRandom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function DownloadImage() {
  var dataUrl = canvas.toDataURL('image/png');
  this.href = dataUrl;
}
