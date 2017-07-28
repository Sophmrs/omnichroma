'using strict';
/*jshint esversion: 6 */

const widthInput = document.querySelector('[data-js="width"]');
const heightInput = document.querySelector('[data-js="height"]');
const colorMethod = document.querySelector('[data-js="method"]');
const paintersQty = document.querySelector('[data-js="painters"]');
const seedMode = document.querySelector('[data-js="seedMode"]');
const seedQty = document.querySelector('[data-js="seedQty"]');
const seedColor = document.querySelector('[data-js="seedColor"]');
const seedPos = document.querySelector('[data-js="seedPos"]');

const randInputs = document.querySelectorAll('.rand');
const pickInputs = document.querySelectorAll('.rand');

const startBtn = document.querySelector('[data-js="start"]');
const saveImageBtn = document.querySelector('[data-js="download"]');

const canvas = document.querySelector('[data-js="canvas"]');
const ctx = canvas.getContext('2d');

let paintingNum = 0;

let colorCount;
let colorMult;

let colors = [];
let anchors = [];

let width;
let height;

const painters = [];

saveImageBtn.addEventListener('click', DownloadImage);
startBtn.addEventListener('click', Start);
seedMode.addEventListener('change', AddModeClass);
document.body.addEventListener('keypress', KbStart);

class Color {
  constructor(r, g, b) {
    this.r = r;
    this.g = g;
    this.b = b;
  }

  toStyle() {
    return `rgb(${this.r}, ${this.g}, ${this.b})`;
  }

  distanceSqrFrom(color) {
    return (color.r - this.r) ** 2 + (color.g - this.g) ** 2 + (color.b - this.b) ** 2;
  }
}

class Pos {
  constructor(x, y) {
    this.x = x;
    this.y = y;
  }
}

class Anchor {
  constructor(pos, color) {
    this.pos = pos;
    this.color = color;
  }

  getAvailableNeighbours() {
    const minX = Math.max(0, this.pos.x - 1);
    const maxX = Math.min(ctx.canvas.width - 1, this.pos.x + 1);
    const minY = Math.max(0, this.pos.y - 1);
    const maxY = Math.min(ctx.canvas.height - 1, this.pos.y + 1);

    const width = maxX - minX + 1;
    const height = maxY - minY + 1;

    const imgData = ctx.getImageData(minX, minY, width, height);

    let curPos = new Pos(minX, minY);
    const availablePositions = [];

    //Image data is a sequential array with the format rgba, if a is set the position is occupied
    for (let i = 3; i < width * height * 4; i += 4) {
      if (imgData.data[i] === 0)
        availablePositions.push(curPos);

      const newPos = new Pos(curPos.x, curPos.y);
      newPos.x++;
      if (newPos.x > maxX) {
        newPos.x = minX;
        newPos.y++;
      }
      curPos = newPos;
    }
    return availablePositions;
  }

  //Almost same as above, but returns early
  hasAvailableNeighbours() {
    const minX = Math.max(0, this.pos.x - 1);
    const maxX = Math.min(ctx.canvas.width - 1, this.pos.x + 1);
    const minY = Math.max(0, this.pos.y - 1);
    const maxY = Math.min(ctx.canvas.height - 1, this.pos.y + 1);

    const width = maxX - minX + 1;
    const height = maxY - minY + 1;

    const imgData = ctx.getImageData(minX, minY, width, height);

    let curPos = new Pos(minX, minY);

    for (let i = 3; i < width * height * 4; i += 4) {
      if (imgData.data[i] === 0)
        return true;

      const newPos = new Pos(curPos.x, curPos.y);
      newPos.x++;
      if (newPos.x > maxX) {
        newPos.x = minX;
        newPos.y++;
      }
      curPos = newPos;
    }
    return false;
  }

}

class Painter {
  constructor() {
    this.isPainting = false;
    this.animationFrame = null;
  }

  Draw() {
    if (anchors.length > 0) {
      let anchor;
      let canUseAnchor = false;

      do {
        if (anchors.length === 0) {
          console.count(`Painter finished drawing painting ${paintingNum}!`);
          this.isPainting = false;
          return;
        }
        const idx = anchors.indexOf(PickRandom(anchors));
        anchor = anchors.splice(idx, 1)[0];
        canUseAnchor = anchor.hasAvailableNeighbours();
      } while (!canUseAnchor);

      const availablePos = anchor.getAvailableNeighbours();
      const pos = PickRandom(availablePos);
      const color = PickClosestColor(anchor.color);

      ctx.fillStyle = color.toStyle();
      ctx.fillRect(pos.x, pos.y, 1, 1);

      const newAnchor = new Anchor(pos, color);
      if (newAnchor.hasAvailableNeighbours()) {
        anchors.push(newAnchor);
      }

      //Add anchor back if it still has available neighbours
      if (anchor.hasAvailableNeighbours()) {
        anchors.push(anchor);
      }
      if (this.isPainting)
        this.animationFrame = requestAnimationFrame(() => this.Draw());
    } else {
      console.count(`Painter finished drawing painting ${paintingNum}!`);
      this.isPainting = false;
      return;
    }
  }

  StopDrawing() {
    this.isPainting = false;
    cancelAnimationFrame(this.animationFrame);
    this.animationFrame = null;
  }

  StartDrawing() {
    this.isPainting = true;
    this.animationFrame = requestAnimationFrame(() => this.Draw());
  }
}

function Init() {
  width = widthInput.value;
  height = heightInput.value;

  canvas.width = width;
  canvas.height = height;

  //Number of colors per channel
  colorCount = 2 ** ((Math.log2(width) + Math.log2(height)) / 3);
  colorMult = Math.max(Math.ceil(256 / colorCount), 1);

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  //Trigger transition
  setTimeout(() => {
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
  }, 0);

  AddModeClass();
}
Init();

function Start() {
  Init();

  paintingNum++;

  colors = [];
  anchors = [];

  //Set all colors
  for (let i = 0; i < colorCount; i++) {
    for (let j = 0; j < colorCount; j++) {
      for (let k = 0; k < colorCount; k++) {
        colors.push(new Color(colorMult * i, colorMult * j, colorMult * k));
      }
    }
  }

  while (painters.length > 0) {
    painters.pop().StopDrawing();
  }

  //Seeds with initial anchors
  if (seedMode.value === 'random') {
    if (seedQty.value < 1)
      seedQty.value = 1;
    for (var i = 0; i < seedQty.value; i++) {
      let randPos;
      let canUsePos = false;
      do {
        randPos = new Pos(Math.floor(Math.random() * width), Math.floor(Math.random() * height));
        const posAlpha = ctx.getImageData(randPos.x, randPos.y, 1, 1).data[3];
        if (posAlpha === 0)
          canUsePos = true;
      } while (!canUsePos);
      const randColor = colors.splice(Math.floor(Math.random() * colors.length), 1)[0];
      anchors.push(new Anchor(randPos, randColor));
      ctx.fillStyle = anchors[i].color.toStyle();
      ctx.fillRect(anchors[i].pos.x, anchors[i].pos.y, 1, 1);
    }
  } else if (seedMode.value === 'pick') {
    let anchorPos;
    switch(seedPos.value)
    {
      case 'tl':
        anchorPos = new Pos(0,0);
        break;
      case 'tc':
        anchorPos = new Pos(width/2,0);
        break;
      case 'tr':
        anchorPos = new Pos(width,0);
        break;
      case 'cl':
        anchorPos = new Pos(0,height/2);
        break;
      case 'cc':
        anchorPos = new Pos(width/2,height/2);
        break;
      case 'cr':
        anchorPos = new Pos(width,height/2);
        break;
      case 'bl':
        anchorPos = new Pos(0,height);
        break;
      case 'bc':
        anchorPos = new Pos(width/2,height);
        break;
      case 'br':
        anchorPos = new Pos(width,height);
        break;
    }
    //Gets each component in hex
    const hexColors = /#([a-f0-9]{2})([a-f0-9]{2})([a-f0-9]{2})/i.exec(seedColor.value).slice(1, 4);
    //Converts to decimal components
    const [r, g, b] = hexColors.map((c) => +(`0x${c}`));
    const anchorColor = PickClosestColor(new Color(r, g, b));
    anchors.push(new Anchor(anchorPos, anchorColor));
    ctx.fillStyle = anchors[0].color.toStyle();
    ctx.fillRect(anchors[0].pos.x, anchors[0].pos.y, 1, 1);
  }

  if (paintersQty.value <= 0)
    paintersQty.value = 1;
  for (let i = 0; i < paintersQty.value; i++) {
    const painter = new Painter();
    painter.StartDrawing();
    painters.push(painter);
  }
}

function AddModeClass(){
  seedMode.parentElement.className = '';
  seedMode.parentElement.classList.add(`${seedMode.value}-active`);
}

function KbStart(e) {
  if (e.keyCode === 13)
    Start();
}

function PickClosestColor(color) {
  let minDist = Infinity;
  let curColor = null;
  for (let i = 0; i < colors.length; i++) {
    const dist = color.distanceSqrFrom(colors[i]);
    if (dist < minDist) {
      minDist = dist;
      curColor = i;
    }
  }
  return colors.splice(curColor, 1)[0];
}

function IndexOfColor(color) {
  for (let i = 0; i < colors.length; i++) {
    if (colors[i].r === color.r &&
      colors[i].g === color.g &&
      colors[i].b === color.b) {
      return i;
    }
  }
  return null;
}

function PickRandom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function DownloadImage() {
  const dataUrl = canvas.toDataURL('image/png');
  this.href = dataUrl;
}