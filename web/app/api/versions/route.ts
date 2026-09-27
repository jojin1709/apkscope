import {NextRequest,NextResponse} from 'next/server';
export const runtime='edge';

const UA='Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';
const WORKER=(process.env.WORKER_URL||'https://apkscope-resolver.apkscope.workers.dev').replace(/\/+$/,'');
const APTOIDE_KEY=process.env.APTOIDE_API_KEY||'82c70dbc-936c-4657-8add-31f7db491878';
const PKG_RE=/^[a-zA-Z]\w*(\.\w+)+$/;

type Version={
  version:string;
  size:number;
  md5:string;
  date:string;
  src:string;
  download:string;
};

function through(url:string){
  return `${WORKER}/download?url=${encodeURIComponent(url)}`;
}

async function fetchText(url:string):Promise<string>{
  const attempt=async(target:string)=>{
    try{
      const r=await fetch(target,{
        headers:{'user-agent':UA,accept:'application/json,*/*;q=0.8','accept-language':'en-US,en;q=0.9'},
        redirect:'follow',
        cache:'no-store'
      });
      if(!r.ok)return '';
      return await r.text();
    }catch{
      return '';
    }
  };
  const direct=await attempt(url);
  if(direct)return direct;
  return attempt(`${WORKER}/proxy?url=${encodeURIComponent(url)}`);
}

async function aptoideVersions(pkg:string):Promise<Version[]>{
  const url=`https://ws75.aptoide.com/api/7/app/get/package_name=${encodeURIComponent(pkg)}?api_key=${APTOIDE_KEY}`;
  const txt=await fetchText(url);
  const out:Version[]=[];
  const data:Version[]=[];
  const codes:number[]=[];
  if(!txt)return out;
  try{
    const json=JSON.parse(txt);
    const list=json?.nodes?.versions?.list;
    if(!Array.isArray(list))return out;
    for(const it of list){
      const f=it?.file;
      const store=it?.store?.name;
      const vercode=f?.vercode;
      const md5=f?.md5sum;
      const id=it?.id;
      if(!store||!vercode||!md5||!id)continue;
      data.push({
        version:typeof f.vername==='string'?f.vername:String(vercode),
        size:Number(f.filesize)||0,
        md5:String(md5),
        date:typeof f.added==='string'?f.added:'',
        src:'Aptoide',
        download:`https://pool.apk.aptoide.com/${store}/${pkg.replace(/\./g,'-')}-${vercode}-${id}-${md5}.apk`
      });
      codes.push(Number(vercode));
    }
    const order=data.map((_,i)=>i).sort((a,b)=>codes[b]-codes[a]);
    for(const i of order)out.push(data[i]);
  }catch{}
  return out;
}

async function fdroidVersions(pkg:string):Promise<Version[]>{
  const txt=await fetchText(`https://f-droid.org/api/v1/packages/${encodeURIComponent(pkg)}`);
  const out:Version[]=[];
  if(!txt)return out;
  try{
    const data=JSON.parse(txt);
    const packages=Array.isArray(data?.packages)?data.packages:[];
    const sorted=packages
      .filter((p:{versionCode?:unknown})=>Number(p.versionCode)>0)
      .sort((a:{versionCode:number},b:{versionCode:number})=>Number(b.versionCode)-Number(a.versionCode))
      .slice(0,10);
    for(const p of sorted){
      out.push({
        version:typeof p.versionName==='string'?p.versionName:String(p.versionCode),
        size:0,
        md5:'',
        date:'',
        src:'F-Droid',
        download:`https://f-droid.org/repo/${pkg}_${Number(p.versionCode)}.apk`
      });
    }
  }catch{}
  return out;
}

export async function GET(req:NextRequest){
  const pkg=req.nextUrl.searchParams.get('pkg')?.trim();
  if(!pkg||!PKG_RE.test(pkg))return NextResponse.json({versions:[]});
  const [apt,fd]=await Promise.all([aptoideVersions(pkg),fdroidVersions(pkg)]);
  const seen=new Set<string>();
  const versions:Version[]=[];
  for(const v of [...apt,...fd]){
    if(!v.version||seen.has(v.version))continue;
    seen.add(v.version);
    v.download=through(v.download);
    versions.push(v);
  }
  return NextResponse.json({versions});
}
