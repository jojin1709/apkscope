import {deflateSync} from 'node:zlib';
import {writeFileSync,mkdirSync} from 'node:fs';
import {dirname,join} from 'node:path';
import {fileURLToPath} from 'node:url';

const __dirname=dirname(fileURLToPath(import.meta.url));
const root=join(__dirname,'..');

const CRC_TABLE=(()=>{
  const t=new Uint32Array(256);
  for(let n=0;n<256;n++){
    let c=n;
    for(let k=0;k<8;k++)c=c&1?0xedb88320^(c>>>1):c>>>1;
    t[n]=c>>>0;
  }
  return t;
})();

function crc32(buf){
  let c=0xffffffff;
  for(let i=0;i<buf.length;i++)c=CRC_TABLE[(c^buf[i])&0xff]^(c>>>8);
  return (c^0xffffffff)>>>0;
}

function chunk(type,data){
  const len=Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const t=Buffer.from(type,'ascii');
  const crcBuf=Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([t,data])));
  return Buffer.concat([len,t,data,crcBuf]);
}

function encodePNG(w,h,rgba){
  const raw=Buffer.alloc((w*4+1)*h);
  for(let y=0;y<h;y++){
    raw[y*(w*4+1)]=0;
    rgba.copy(raw,y*(w*4+1)+1,y*w*4,(y+1)*w*4);
  }
  const ihdr=Buffer.alloc(13);
  ihdr.writeUInt32BE(w,0);
  ihdr.writeUInt32BE(h,4);
  ihdr[8]=8;ihdr[9]=6;ihdr[10]=0;ihdr[11]=0;ihdr[12]=0;
  return Buffer.concat([
    Buffer.from([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a]),
    chunk('IHDR',ihdr),
    chunk('IDAT',deflateSync(raw,{level:9})),
    chunk('IEND',Buffer.alloc(0))
  ]);
}

const clamp=(x,a,b)=>x<a?a:x>b?b:x;
const smooth=(edge0,edge1,x)=>{
  const t=clamp((x-edge0)/(edge1-edge0),0,1);
  return t*t*(3-2*t);
};

function isInsideTriangle(px, py, x1, y1, x2, y2, x3, y3) {
  const d1 = (px - x2) * (y1 - y2) - (x1 - x2) * (py - y2);
  const d2 = (px - x3) * (y2 - y3) - (x2 - x3) * (py - y3);
  const d3 = (px - x1) * (y3 - y1) - (x3 - x1) * (py - y1);
  const hasNeg = (d1 < 0) || (d2 < 0) || (d3 < 0);
  const hasPos = (d1 > 0) || (d2 > 0) || (d3 > 0);
  return !(hasNeg && hasPos);
}

function distToSegment(px, py, x1, y1, x2, y2) {
  const l2 = (x2 - x1) ** 2 + (y2 - y1) ** 2;
  if (l2 === 0) return Math.hypot(px - x1, py - y1);
  let t = ((px - x1) * (x2 - x1) + (py - y1) * (y2 - y1)) / l2;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (x1 + t * (x2 - x1)), py - (y1 + t * (y2 - y1)));
}

function draw(size) {
  const buf = Buffer.alloc(size * size * 4);
  const S = size;
  const cx = S * 0.5, cy = S * 0.5;
  const R_outer = S * 0.35;
  const outer_thick = S * 0.045;
  const R_inner = S * 0.22;
  const inner_thick = S * 0.02;
  const R_dot = S * 0.045;
  const aa = Math.max(1.0, S / 256);

  // Play triangle vertices
  const tx1 = S * 0.40, ty1 = S * 0.32;
  const tx2 = S * 0.69, ty2 = S * 0.50;
  const tx3 = S * 0.40, ty3 = S * 0.68;

  // Squircle corner radius
  const cornerR = S * 0.22;

  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const px = x + 0.5, py = y + 0.5;

      // Squircle background mask
      const qx = Math.abs(px - cx) - (cx - cornerR);
      const qy = Math.abs(py - cy) - (cy - cornerR);
      const boxDist = (qx > 0 && qy > 0) ? Math.hypot(qx, qy) - cornerR : Math.max(qx, qy) - cornerR;
      const bgAlpha = smooth(aa, -aa, boxDist);

      if (bgAlpha <= 0) {
        continue;
      }

      // Base background color #0c1222
      let r = 0x0c, g = 0x12, b = 0x22;

      // Gradient factors (from top-left #60a5fa to bottom-right #34d399)
      const gradT = clamp(((px - cx) + (py - cy) + S * 0.5) / S, 0, 1);
      // #60a5fa (96, 165, 250) -> #38bdf8 (56, 189, 248) -> #34d399 (52, 211, 153)
      let grR = Math.round(96 + (52 - 96) * gradT);
      let grG = Math.round(165 + (211 - 165) * gradT);
      let grB = Math.round(250 + (153 - 250) * gradT);

      const dCenter = Math.hypot(px - cx, py - cy);

      // 1. Outer aperture ring
      const outerDist = Math.abs(dCenter - R_outer) - (outer_thick * 0.5);
      const outerAlpha = smooth(aa, -aa, outerDist);

      // 2. Inner dashed reticle ring
      const innerDist = Math.abs(dCenter - R_inner) - (inner_thick * 0.5);
      const angle = Math.atan2(py - cy, px - cx);
      const dash = Math.sin(angle * 12);
      const innerAlpha = (dash > -0.2) ? smooth(aa, -aa, innerDist) : 0;

      // 3. Play triangle
      const inTri = isInsideTriangle(px, py, tx1, ty1, tx2, ty2, tx3, ty3);
      const edgeDist = Math.min(
        distToSegment(px, py, tx1, ty1, tx2, ty2),
        distToSegment(px, py, tx2, ty2, tx3, ty3),
        distToSegment(px, py, tx3, ty3, tx1, ty1)
      );
      const triDist = inTri ? -edgeDist : edgeDist;
      const triAlpha = smooth(aa, -aa, triDist);

      // 4. Center focus dot
      const dotDist = dCenter - R_dot;
      const dotAlpha = smooth(aa, -aa, dotDist);

      // Composite elements
      if (innerAlpha > 0) {
        // Subtle slate #334155
        r = Math.round(r + (0x33 - r) * innerAlpha * 0.7);
        g = Math.round(g + (0x41 - g) * innerAlpha * 0.7);
        b = Math.round(b + (0x55 - b) * innerAlpha * 0.7);
      }

      if (outerAlpha > 0) {
        r = Math.round(r + (grR - r) * outerAlpha);
        g = Math.round(g + (grG - g) * outerAlpha);
        b = Math.round(b + (grB - b) * outerAlpha);
      }

      if (triAlpha > 0) {
        r = Math.round(r + (grR - r) * triAlpha);
        g = Math.round(g + (grG - g) * triAlpha);
        b = Math.round(b + (grB - b) * triAlpha);
      }

      if (dotAlpha > 0) {
        r = Math.round(r + (255 - r) * dotAlpha);
        g = Math.round(g + (255 - g) * dotAlpha);
        b = Math.round(b + (255 - b) * dotAlpha);
      }

      const i = (y * S + x) * 4;
      buf[i] = r;
      buf[i + 1] = g;
      buf[i + 2] = b;
      buf[i + 3] = Math.round(bgAlpha * 255);
    }
  }
  return encodePNG(S, S, buf);
}


function createIco(pngBuf, size) {
  const icoHeader = Buffer.alloc(6);
  icoHeader.writeUInt16LE(0, 0); // reserved
  icoHeader.writeUInt16LE(1, 2); // ICO type 1
  icoHeader.writeUInt16LE(1, 4); // 1 image

  const dirEntry = Buffer.alloc(16);
  dirEntry.writeUInt8(size >= 256 ? 0 : size, 0); // width
  dirEntry.writeUInt8(size >= 256 ? 0 : size, 1); // height
  dirEntry.writeUInt8(0, 2); // colors
  dirEntry.writeUInt8(0, 3); // reserved
  dirEntry.writeUInt16LE(1, 4); // color planes
  dirEntry.writeUInt16LE(32, 6); // bits per pixel
  dirEntry.writeUInt32LE(pngBuf.length, 8); // size of image data
  dirEntry.writeUInt32LE(22, 12); // offset (6 + 16)

  return Buffer.concat([icoHeader, dirEntry, pngBuf]);
}

const targets=[
  [join(root,'public','icon-192.png'),192],
  [join(root,'public','icon-512.png'),512],
  [join(root,'app','icon.png'),512],
  [join(root,'app','apple-icon.png'),180]
];

for(const [path,size] of targets){
  mkdirSync(dirname(path),{recursive:true});
  writeFileSync(path,draw(size));
  console.log('wrote',path,size+'x'+size);
}

// Generate favicon.ico (32x32)
const png32 = draw(32);
const icoBuf = createIco(png32, 32);
const icoPublic = join(root, 'public', 'favicon.ico');
const icoApp = join(root, 'app', 'favicon.ico');
writeFileSync(icoPublic, icoBuf);
writeFileSync(icoApp, icoBuf);
console.log('wrote', icoPublic, '32x32 ICO');
console.log('wrote', icoApp, '32x32 ICO');
