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

function draw(size){
  const buf=Buffer.alloc(size*size*4);
  const S=size;
  const cx=S*0.44,cy=S*0.44;
  const R=S*0.245;
  const thick=S*0.072;
  const half=thick/2;
  const hx1=cx+R*0.7071,hy1=cy+R*0.7071;
  const hx2=S*0.79,hy2=S*0.79;
  const aa=Math.max(1.2,S/256);

  for(let y=0;y<S;y++){
    for(let x=0;x<S;x++){
      const px=x+0.5,py=y+0.5;
      // background gradient
      const g=clamp((px/S)*0.55+(py/S)*0.45,0,1);
      const r0=0x16,g0=0x77,b0=0xff;
      const r1=0x0b,g1=0x5b,b1=0xd3;
      let R0=Math.round(r0+(r1-r0)*g);
      let G0=Math.round(g0+(g1-g0)*g);
      let B0=Math.round(b0+(b1-b0)*g);

      // magnifier ring
      const dx=px-cx,dy=py-cy;
      const dist=Math.sqrt(dx*dx+dy*dy);
      const ringD=Math.abs(dist-R)-half;
      const ringA=smooth(aa,-aa,ringD);

      // handle capsule
      const ex=hx2-hx1,ey=hy2-hy1;
      const len2=ex*ex+ey*ey;
      let t=((px-hx1)*ex+(py-hy1)*ey)/len2;
      t=clamp(t,0,1);
      const qx=hx1+ex*t-px,qy=hy1+ey*t-py;
      const seg=Math.sqrt(qx*qx+qy*qy)-half;
      const segA=smooth(aa,-aa,seg);

      const white=Math.max(ringA,segA);
      if(white>0){
        R0=Math.round(R0+(255-R0)*white);
        G0=Math.round(G0+(255-G0)*white);
        B0=Math.round(B0+(255-B0)*white);
      }
      const i=(y*S+x)*4;
      buf[i]=R0;buf[i+1]=G0;buf[i+2]=B0;buf[i+3]=255;
    }
  }
  return encodePNG(S,S,buf);
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
