import {NextRequest,NextResponse} from 'next/server';
export const runtime='edge';

const UA='Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';
const MAX=8;

type Item={
  name:string;
  packageName:string;
  version:string;
  source:string;
  category:string[];
  icon:string;
  sourcePage:string;
  playUrl?:string;
  download?:string;
  size?:number;
  md5?:string;
  rank?:string;
  store?:string;
  signer?:string;
  variants:{label:string;architecture:string;android:string;dpi:string;format:string;download:string}[];
};

type Aptoide={
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

function decode(s:string):string{
  return s
    .replace(/&#x([0-9a-f]+);/gi,(_,h:string)=>String.fromCharCode(parseInt(h,16)))
    .replace(/&#(\d+);/g,(_,d:string)=>String.fromCharCode(Number(d)))
    .replace(/&nbsp;/g,' ')
    .replace(/&quot;/g,'"')
    .replace(/&apos;/g,"'")
    .replace(/&#39;/g,"'")
    .replace(/&lt;/g,'<')
    .replace(/&gt;/g,'>')
    .replace(/&amp;/g,'&')
    .replace(/\s+/g,' ')
    .trim();
}

function versionFromSlug(slug:string):string{
  const m=slug.match(/-(\d+(?:-\d+)+(?:[a-z]\d*)?)-release$/i);
  return m?m[1].replace(/-/g,'.'):'';
}

async function fetchText(url:string):Promise<string>{
  const r=await fetch(url,{
    headers:{
      'user-agent':UA,
      accept:'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'accept-language':'en-US,en;q=0.9'
    },
    redirect:'follow',
    cache:'no-store'
  });
  if(!r.ok)return '';
  const html=await r.text();
  return /Just a moment|cf-browser-verification|challenge-platform/i.test(html)?'':html;
}

function searchApkmirror(q:string){
  const url=`https://www.apkmirror.com/?post_type=app_release&searchtype=apk&s=${encodeURIComponent(q)}`;
  return fetchText(url).then(html=>{
    const items:{name:string;sourcePage:string;version:string;developer:string;icon:string}[]=[];
    if(!html)return items;
    const regionStart=html.indexOf('<div class="appRow"');
    if(regionStart<0)return items;
    let regionEnd=html.indexOf('<div class="listWidget',regionStart);
    if(regionEnd<0)regionEnd=html.length;
    const region=html.slice(regionStart,regionEnd);
    const seen=new Set<string>();
    const rowRe=/<h5[^>]*class="[^"]*appRowTitle[^"]*"[^>]*>([\s\S]*?)<\/h5>/g;
    let prevEnd=0;
    let m:RegExpExecArray|null;
    while((m=rowRe.exec(region))&&items.length<MAX){
      const start=prevEnd;
      prevEnd=m.index;
      const link=m[1].match(/<a[^>]+href=["'](\/apk\/[^"'#]+)["'][^>]*>([\s\S]*?)<\/a>/);
      if(!link)continue;
      const path=link[1];
      const parts=path.split('/').filter(Boolean);
      if(parts.length!==4||!path.endsWith('/'))continue;
      const name=decode(link[2].replace(/<[^>]+>/g,' '));
      if(name.length<2||name.length>80)continue;
      const appKey=`${parts[1]}/${parts[2]}`;
      if(seen.has(appKey))continue;
      const before=region.slice(start,m.index);
      const after=region.slice(m.index,Math.min(region.length,m.index+900));
      const dev=after.match(/class="byDeveloper[^"]*"[^>]*>([\s\S]*?)<\/a>/);
      let icon='';
      let fallback='';
      const imgRe=/<img[^>]+>/g;
      let im:RegExpExecArray|null;
      while((im=imgRe.exec(before))){
        const tag=im[0];
        const src=tag.match(/src="([^"]+)"/);
        if(!src||!/ap_resize|wp-content\/uploads/.test(src[1]))continue;
        const alt=tag.match(/alt="([^"]*)"/);
        const real=src[1].match(/[?&]src=([^&]+)/);
        const direct=real?decodeURIComponent(real[1]):src[1];
        if(alt&&decode(alt[1])===name){icon=direct;break}
        fallback=direct;
      }
      if(!icon)icon=fallback;
      seen.add(appKey);
      items.push({
        name,
        sourcePage:`https://www.apkmirror.com${path}`,
        version:versionFromSlug(parts[3]),
        developer:dev?decode(dev[1].replace(/<[^>]+>/g,' ')).replace(/^by\s+/i,''):'',
        icon
      });
    }
    return items;
  });
}

function unjson(s:string):string{
  return s.replace(/\\u([0-9a-f]{4})/gi,(_,h:string)=>String.fromCharCode(parseInt(h,16)))
    .replace(/\\"/g,'"')
    .replace(/\\\\/g,'\\');
}

function iconUrl(s:string):string{
  return s?s.replace(/=s\d+.*$/,'')+'=s96':'';
}

function searchPlay(q:string){
  const url=`https://play.google.com/store/search?q=${encodeURIComponent(q)}&c=apps&hl=en&gl=US`;
  return fetchText(url).then(html=>{
    const items:{name:string;packageName:string;playUrl:string;icon:string}[]=[];
    if(!html)return items;
    const seen=new Set<string>();
    const push=(pkg:string,name:string,icon:string)=>{
      if(seen.has(pkg)||!name||name.length<2)return;
      seen.add(pkg);
      items.push({name,packageName:pkg,playUrl:`https://play.google.com/store/apps/details?id=${encodeURIComponent(pkg)}&hl=en`,icon:iconUrl(icon)});
    };
    const cardRe=/<a href="\/store\/apps\/details\?id=([a-zA-Z0-9._]+)" aria-label="([^"]*)" class="Qfxief"/g;
    let m:RegExpExecArray|null;
    while((m=cardRe.exec(html))){
      const win=html.slice(m.index,m.index+3000);
      const icon=win.match(/https:\/\/play-lh\.googleusercontent\.com\/[A-Za-z0-9_-]+/);
      push(m[1],decode(unjson(m[2])),icon?icon[0]:'');
    }
    const blobRe=/\[\["([a-z][a-z0-9_]*(?:\.[a-z0-9_]+)+)",\d+\],[\s\S]{0,6000}?\],"([^"]{1,90})",\["\d/gi;
    while((m=blobRe.exec(html))&&items.length<14){
      const win=html.slice(m.index,m.index+4000);
      const icon=win.match(/https:\/\/play-lh\.googleusercontent\.com\/[A-Za-z0-9_-]+/);
      push(m[1],decode(unjson(m[2])),icon?icon[0]:'');
    }
    return items;
  });
}

function searchAptoide(q:string){
  const url=`https://ws75.aptoide.com/api/7/apps/search?query=${encodeURIComponent(q)}&limit=12`;
  return fetchText(url).then(txt=>{
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
        if(typeof pkg!=='string'||typeof download!=='string'||seen.has(pkg))continue;
        seen.add(pkg);
        items.push({
          name:typeof it.name==='string'?it.name:pkg,
          packageName:pkg,
          version:typeof it.file?.vername==='string'?it.file.vername:'',
          size:Number(it.file?.filesize)||Number(it.size)||0,
          icon:typeof it.icon==='string'?it.icon:'',
          download,
          md5:typeof it.file?.md5sum==='string'?it.file.md5sum:'',
          rank:typeof it.file?.malware?.rank==='string'?it.file.malware.rank:'',
          store:typeof it.store?.name==='string'?it.store.name:'',
          signer:typeof it.file?.signature?.owner==='string'?it.file.signature.owner:''
        });
        if(items.length>=12)break;
      }
    }catch{}
    return items;
  });
}

function buildResults(apk:{name:string;sourcePage:string;version:string;developer:string;icon:string}[],play:{name:string;packageName:string;playUrl:string;icon:string}[],apt:Aptoide[]):Item[]{
  const norm=(s:string)=>s.toLowerCase().replace(/[^a-z0-9]/g,'');
  const base=(s:string)=>norm(s.replace(/\s+\d+(\.\d+)+$/,''));
  const playByTitle=new Map(play.map(p=>[norm(p.name),p]));
  const playByBase=new Map(play.map(p=>[base(p.name),p]));
  const aptByPkg=new Map(apt.map(a=>[a.packageName,a]));
  const used=new Set<string>();
  const results:Item[]=[];
  const enrich=(target:Item,pkg?:string)=>{
    const a=pkg?aptByPkg.get(pkg):undefined;
    if(!a)return;
    if(!target.version||target.version==='—'||target.version==='See source')target.version=a.version||target.version;
    if(a.download)target.download=a.download;
    if(a.size)target.size=a.size;
    if(a.md5)target.md5=a.md5;
    if(a.rank)target.rank=a.rank;
    if(a.store)target.store=a.store;
    if(a.signer)target.signer=a.signer;
  };
  for(const a of apk){
    const p=playByTitle.get(norm(a.name))||playByBase.get(base(a.name));
    if(p)used.add(p.packageName);
    const item:Item={
      name:a.name,
      packageName:p?p.packageName:(a.developer?`by ${a.developer}`:'Package name on source page'),
      version:a.version||'See source',
      source:'APKMirror',
      category:['Android'],
      icon:p&&p.icon?p.icon:a.icon,
      sourcePage:a.sourcePage,
      playUrl:p?p.playUrl:undefined,
      variants:[]
    };
    enrich(item,p?.packageName);
    results.push(item);
  }
  for(const p of play){
    if(used.has(p.packageName))continue;
    if(results.length>=12)break;
    const item:Item={
      name:p.name,
      packageName:p.packageName,
      version:'—',
      source:'Google Play',
      category:['Android'],
      icon:p.icon,
      sourcePage:p.playUrl,
      playUrl:p.playUrl,
      variants:[]
    };
    enrich(item,p.packageName);
    results.push(item);
  }
  for(const a of apt){
    if(used.has(a.packageName))continue;
    if(results.length>=14)break;
    used.add(a.packageName);
    results.push({
      name:a.name,
      packageName:a.packageName,
      version:a.version||'—',
      source:'Aptoide',
      category:['Android'],
      icon:a.icon,
      sourcePage:`https://en.aptoide.com/search?query=${encodeURIComponent(a.packageName)}`,
      download:a.download,
      size:a.size,
      md5:a.md5,
      rank:a.rank,
      store:a.store,
      signer:a.signer,
      variants:[]
    });
  }
  return results;
}

export async function GET(req:NextRequest){
  const q=req.nextUrl.searchParams.get('q')?.trim();
  if(!q)return NextResponse.json({results:[]});
  const [apk,play,apt]=await Promise.all([searchApkmirror(q),searchPlay(q),searchAptoide(q)]);
  const results=buildResults(apk,play,apt);
  if(!results.length){
    results.push({
      name:q,
      packageName:'Search supported providers',
      version:'—',
      source:'Provider search',
      category:['Android'],
      icon:'',
      sourcePage:`https://www.apkmirror.com/?post_type=app_release&searchtype=apk&s=${encodeURIComponent(q)}`,
      variants:[]
    });
  }
  return NextResponse.json({results});
}
