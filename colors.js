'using strict';
/*jshint esversion: 6 */

const widthInput = document.querySelector('[data-js="width"]');
const heightInput = document.querySelector('[data-js="height"]');
const avgRange = document.querySelector('[data-js="avgRange"]');
const paintersQty = document.querySelector('[data-js="painters"]');
const selectionMode = document.querySelector('[data-js="selectionMode"]');
const colorComparison = document.querySelector('[data-js="colorComparison"]');
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

let colorDepth;
let colorSkip;

let colors = [];
let labColors = [];
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
    this.r = Math.round(r);
    this.g = Math.round(g);
    this.b = Math.round(b);
  }

  toStyle() {
    return `rgb(${this.r}, ${this.g}, ${this.b})`;
  }

  distanceSqrFrom(color) {
    return (color.r - this.r) ** 2 + (color.g - this.g) ** 2 + (color.b - this.b) ** 2;
  }

  //Based on http://www.easyrgb.com/en/math.php
  //Goes from RGB to XYZ to LAB
  toColorLAB(){
    const rgb = [this.r, this.g, this.b].map((c) => {
      let color = c / 255;
      color = color > 0.04045 ? ((color + 0.055) / 1.055) ** 2.4 : color / 12.92;
      return color * 100;
    });
    const [xyzR,xyzG,xyzB] = rgb;
    const x = (xyzR * 0.4124 + xyzG * 0.3576 + xyzB * 0.1805) * 0.95047;
    const y = (xyzR * 0.2126 + xyzG * 0.7152 + xyzB * 0.0722) * 1;
    const z = (xyzR * 0.0193 + xyzG * 0.1192 + xyzB * 0.9505) * 1.08883;
 
    const labxyz = [x,y,z].map((c)=>{
      let color = c/100;
      return color > 0.008856 ? color ** (1/3) : (color * 7.787) + (16 /116);
    });
 
    const [labX, labY, labZ] = labxyz;
    const l = (labY * 116) - 16;
    const a = (labX - labY) * 500;
    const b = (labY - labZ) * 200;
 
    return new ColorLAB(l,a,b);
  }
}

class ColorLAB{
  constructor(l,a,b){
    this.l = l;
    this.a = a;
    this.b = b;
  }
 
  // Based on https://github.com/THEjoezack/ColorMine/blob/master/ColorMine/ColorSpaces/Comparisons/Cie94Comparison.cs
  deltaEFrom(labColor){
    const k1 = .045;
    const k2 = .015;
 
    const dL = this.l - labColor.l;
    const dA = this.a - labColor.a;
    const dB = this.b - labColor.b;
 
    const c1 = Math.sqrt(this.a ** 2 + this.b ** 2);
    const c2 = Math.sqrt(labColor.a ** 2 + labColor.b ** 2);
    const dC = c1 - c2;
 
    const dH = Math.sqrt(Math.max(dA ** 2 + dB ** 2 - dC ** 2, 0));
 
    const sC = 1 + k1 * c1;
    const sH = 1 + k2 * c1;
 
    const l = dL;
    const c = dC / sC;
    const h = dH / sH;
 
    const dESqr = l ** 2 + c ** 2 + h ** 2;
    return dESqr < 0 ? 0 : Math.sqrt(dESqr);
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

  hasAvailableNeighbours() {
    const minX = Math.max(0, this.pos.x - 1);
    const maxX = Math.min(ctx.canvas.width - 1, this.pos.x + 1);
    const minY = Math.max(0, this.pos.y - 1);
    const maxY = Math.min(ctx.canvas.height - 1, this.pos.y + 1);

    const width = maxX - minX + 1;
    const height = maxY - minY + 1;

    const imgData = ctx.getImageData(minX, minY, width, height);

    for (let i = 3; i < width * height * 4; i += 4) {
      if (imgData.data[i] === 0)
        return true;
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

        let idx;
        if(selectionMode.value === 'random')
          idx = anchors.indexOf(PickRandom(anchors));
        else if(selectionMode.value === 'worm')
          idx = anchors.length - 1;
        else if(selectionMode.value === 'root')
          idx = 0;

        anchor = anchors.splice(idx, 1)[0];
        canUseAnchor = anchor.hasAvailableNeighbours();
      } while (!canUseAnchor);

      const availablePos = anchor.getAvailableNeighbours();
      const pos = PickRandom(availablePos);
      const color =  PickClosestColor(anchor.color);

      const newAnchor = new Anchor(pos, color);
      if (newAnchor.hasAvailableNeighbours()) {
        anchors.push(newAnchor);
      }

      ctx.fillStyle = color.toStyle();
      ctx.fillRect(pos.x, pos.y, 1, 1);

      //Add anchor back if it still has available neighbours
      if (anchor.hasAvailableNeighbours()) {
        anchors.push(anchor);
      }
      if (this.isPainting && colors.length > 0)
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

  //Bits of colors per channel
  colorDepth = 2 ** ((Math.log2(width) + Math.log2(height)) / 3);
  //Used to fill the color array with the necessary colors
  colorSkip = 256 / colorDepth;

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
  labColors = [];
  anchors = [];

  //Set all colors
  for (let i = 0; i < colorDepth; i++) {
    for (let j = 0; j < colorDepth; j++) {
      for (let k = 0; k < colorDepth; k++) {
        colors.push(new Color(colorSkip * i, colorSkip * j, colorSkip * k));
        labColors.push(colors[colors.length-1].toColorLAB());
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
  let labColor;

  const labCompare = (colorComparison.value === 'lab');
  if(labCompare)
     labColor = color.toColorLAB();
  for (let i = 0; i < colors.length; i++) {
    let dist;
    if(labCompare) {
      dist = labColor.deltaEFrom(labColors[i]);
    }
    else{
      dist = color.distanceSqrFrom(colors[i]);
    }
    if (dist < minDist) {
      minDist = dist;
      curColor = i;
    }
  }
  labColors.splice(curColor, 1);
  return colors.splice(curColor, 1)[0];
}

function PickRandom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function DownloadImage() {
  const dataUrl = canvas.toDataURL('image/png');
  this.href = dataUrl;
}