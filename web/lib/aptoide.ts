import {APTOIDE_KEY,PKG_RE,fetchText,through,cached} from './core';

export type Aptoide={
  name:string;
  packageName:string;
  version:string;
  size:number;
  icon:string;
  download:string;
  md5:string;
  rank:string;
  store:string;
  signer:string;
};

export type AptoideDetail={
  pkg:string;
  name:string;
  icon:string;
  version:string;
  size:number;
  md5:string;
  signer:string;
  rank:string;
  store:string;
  download?:string;
  description:string;
  changelog:string;
  screenshots:string[];
  developer:string;
  rating:number;
  downloads:string;
  updated:string;
};

const aptGet=(pkg:string)=>`https://ws75.aptoide.com/api/7/app/get/package_name=${encodeURIComponent(pkg)}?api_key=${APTOIDE_KEY}`;

export async function aptoideSearch(q:string,limit=12):Promise<Aptoide[]>{
  const txt=await fetchText(`https://ws75.aptoide.com/api/7/apps/search?query=${encodeURIComponent(q)}&limit=${limit}&api_key=${APTOIDE_KEY}`);
  const items:Aptoide[]=[];
  if(!txt)return items;
  try{
    const data=JSON.parse(txt);
    const list=data?.datalist?.list;
    if(!Array.isArray(list))return items;
    const seen=new Set<string>();
    for(const it of list){
      const pkg=it?.package;
      const download=it?.file?.path;
      if(typeof pkg!=='string'||seen.has(pkg))continue;
      seen.add(pkg);
      items.push({
        name:typeof it.name==='string'?it.name:pkg,
        packageName:pkg,
        version:typeof it.file?.vername==='string'?it.file.vername:'',
        size:Number(it.file?.filesize)||Number(it.size)||0,
        icon:typeof it.icon==='string'?it.icon:'',
        download:typeof download==='string'?download:'',
        md5:typeof it.file?.md5sum==='string'?it.file.md5sum:'',
        rank:typeof it.file?.malware?.rank==='string'?it.file.malware.rank:'',
        store:typeof it.store?.name==='string'?it.store.name:'',
        signer:typeof it.file?.signature?.owner==='string'?it.file.signature.owner:''
      });
      if(items.length>=limit)break;
    }
  }catch{}
  return items;
}

function num(v:unknown):number{return typeof v==='number'?v:Number(v)||0}

export async function aptoideByPackage(pkg:string):Promise<AptoideDetail|null>{
  if(!PKG_RE.test(pkg))return null;
  const key=`apt:app:${pkg}`;
  return cached(key,600000,async()=>{
    const txt=await fetchText(aptGet(pkg));
    if(!txt)return null;
    try{
      const data=JSON.parse(txt);
      const d=data?.nodes?.meta?.data;
      const f=d?.file;
      if(d?.package!==pkg||typeof f?.path!=='string')return null;
      const media=d?.media||{};
      const shots=Array.isArray(media.screenshots)?media.screenshots:(Array.isArray(media.gallery)?media.gallery:[]);
      return{
        pkg,
        name:typeof d.name==='string'?d.name:pkg,
        icon:typeof d.icon==='string'?d.icon:'',
        version:typeof f.vername==='string'?f.vername:'',
        size:num(f.filesize),
        md5:typeof f.md5sum==='string'?f.md5sum:'',
        signer:typeof f.signature?.owner==='string'?f.signature.owner:'',
        rank:typeof f.malware?.rank==='string'?f.malware.rank:'',
        store:typeof d.store?.name==='string'?d.store.name:'',
        download:f.path,
        description:typeof media.description==='string'?media.description:'',
        changelog:typeof media.news==='string'?media.news.replace(/\r/g,'').trim():'',
        screenshots:shots.map((s:{url?:string})=>s&&typeof s.url==='string'?s.url:'').filter(Boolean).slice(0,12),
        developer:typeof d.developer?.name==='string'?d.developer.name:'',
        rating:num(d.stats?.rating?.avg),
        downloads:num(d.stats?.pdownloads)>0?fmtCount(num(d.stats?.pdownloads)):'',
        updated:typeof d.updated==='string'?d.updated:(typeof d.modified==='string'?d.modified:'')
      };
    }catch{}
    return null;
  });
}

function fmtCount(n:number):string{
  if(n>=1e9)return(n/1e9).toFixed(n>=1e10?0:1).replace(/\.0$/,'')+' B+';
  if(n>=1e6)return(n/1e6).toFixed(n>=1e7?0:1).replace(/\.0$/,'')+' M+';
  if(n>=1e3)return(n/1e3).toFixed(n>=1e4?0:1).replace(/\.0$/,'')+' K+';
  return String(n);
}

export async function aptoideByName(name:string):Promise<AptoideDetail|null>{
  const norm=(s:string)=>s.toLowerCase().replace(/[^a-z0-9]/g,'');
  const target=norm(name);
  if(!target)return null;
  const list=await aptoideSearch(name,8);
  const exact=list.find(a=>norm(a.name)===target&&a.packageName);
  const fallback=list.find(a=>a.packageName&&a.download);
  const match=exact||fallback;
  if(!match)return null;
  return aptoideByPackage(match.packageName);
}

export async function aptoideVersions(pkg:string,name?:string):Promise<import('./types').Version[]>{
  const key=`apt:ver:${pkg}:${name||''}`;
  return cached(key,600000,async()=>{
    let detail=await aptoideByPackage(pkg);
    if(!detail&&name)detail=await aptoideByName(name);
    if(!detail)return [];
    const txt=await fetchText(aptGet(detail.pkg));
    const out:import('./types').Version[]=[];
    if(!txt)return out;
    try{
      const json=JSON.parse(txt);
      const list=json?.nodes?.versions?.list;
      if(!Array.isArray(list))return out;
      const rows:{v:import('./types').Version;code:number}[]=[];
      for(const it of list){
        const f=it?.file;
        const store=it?.store?.name;
        const vercode=f?.vercode;
        const md5=f?.md5sum;
        const id=it?.id;
        if(!store||!vercode||!md5||!id)continue;
        rows.push({
          v:{
            version:typeof f.vername==='string'?f.vername:String(vercode),
            size:num(f.filesize),
            md5:String(md5),
            date:typeof f.added==='string'?f.added:'',
            src:'Aptoide',
            download:`https://pool.apk.aptoide.com/${store}/${detail.pkg.replace(/\./g,'-')}-${vercode}-${id}-${md5}.apk`
          },
          code:Number(vercode)
        });
      }
      rows.sort((a,b)=>b.code-a.code);
      for(const r of rows)out.push(r.v);
    }catch{}
    return out;
  });
}
