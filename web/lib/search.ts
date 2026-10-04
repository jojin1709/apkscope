import {PKG_RE,decode,unjson,fetchText,iconUrl,versionFromSlug,through,UA,TAP_UA,cached} from './core';
import {aptoideSearch,aptoideByPackage,aptoideByName,type Aptoide} from './aptoide';
import {apkcomboSearch,apkcomboResolve,type ApkComboResult} from './apkcombo';
import type {App} from './types';

export const RESOLVE_CAP=16;
export const RESULT_CAP=45;

type ApkMirror={name:string;sourcePage:string;version:string;developer:string;icon:string};
type Play={name:string;packageName:string;playUrl:string;icon:string};
type Tap={name:string;packageName:string;icon:string;sourcePage:string;playUrl?:string};
export type FDroidItem={name:string;packageName:string;icon:string;sourcePage:string};

export function makeFallback(q:string):App[]{
  const x=q.trim();
  if(!x)return[];
  return[{name:x,packageName:'Search across supported sources',version:'—',source:'Provider search',category:['Android'],icon:'',sourcePage:`https://www.apkmirror.com/?post_type=app_release&searchtype=apk&s=${encodeURIComponent(x)}`,variants:[]}];
}

export function searchApkmirror(q:string,limit=14):Promise<ApkMirror[]>{
  const url=`https://www.apkmirror.com/?post_type=app_release&searchtype=apk&s=${encodeURIComponent(q)}`;
  return fetchText(url).then(html=>{
    const items:ApkMirror[]=[];
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
    while((m=rowRe.exec(region))&&items.length<limit){
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

export function searchPlay(q:string,limit=14):Promise<Play[]>{
  const url=`https://play.google.com/store/search?q=${encodeURIComponent(q)}&c=apps&hl=en&gl=US`;
  return fetchText(url).then(html=>{
    const items:Play[]=[];
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
    while((m=blobRe.exec(html))&&items.length<limit){
      const win=html.slice(m.index,m.index+4000);
      const icon=win.match(/https:\/\/play-lh\.googleusercontent\.com\/[A-Za-z0-9_-]+/);
      push(m[1],decode(unjson(m[2])),icon?icon[0]:'');
    }
    return items;
  });
}

export function searchTapTap(q:string):Promise<Tap[]>{
  const url=`https://www.taptap.io/webapiv2/i/search/v2/app-by-kw?kw=${encodeURIComponent(q)}&X-UA=${encodeURIComponent(TAP_UA)}`;
  return fetchText(url,{extra:{referer:'https://www.taptap.io/'}}).then(txt=>{
    const items:Tap[]=[];
    if(!txt)return items;
    try{
      const data=JSON.parse(txt);
      const list=data?.data?.list;
      if(!Array.isArray(list))return items;
      const seen=new Set<string>();
      for(const it of list){
        const app=it?.type==='app'?it.app:null;
        const pkg=app?.identifier;
        if(typeof pkg!=='string'||seen.has(pkg))continue;
        seen.add(pkg);
        items.push({
          name:typeof app.title==='string'?app.title:pkg,
          packageName:pkg,
          icon:app.icon?.url||'',
          sourcePage:`https://www.taptap.io/app/${app.id}`,
          playUrl:typeof app.uri?.google==='string'&&app.uri.google?app.uri.google:undefined
        });
        if(items.length>=8)break;
      }
    }catch{}
    return items;
  });
}

export async function searchFDroid(q:string,limit=10):Promise<FDroidItem[]>{
  try{
    const url=`https://search.f-droid.org/?q=${encodeURIComponent(q)}&lang=en`;
    const html=await fetchText(url);
    if(!html)return[];
    const items:FDroidItem[]=[];
    const seen=new Set<string>();
    const re=/<a class="package-header"[^>]*href="https:\/\/f-droid\.org\/[a-z_-]+\/packages\/([a-zA-Z0-9._]+)"[^>]*>([\s\S]*?)<\/a>/gi;
    let m:RegExpExecArray|null;
    while((m=re.exec(html))&&items.length<limit){
      const pkg=m[1];
      if(seen.has(pkg))continue;
      seen.add(pkg);
      const body=m[2];
      const nameMatch=body.match(/<h4 class="package-name">([\s\S]*?)<\/h4>/);
      const name=nameMatch?nameMatch[1].trim():pkg;
      const iconMatch=body.match(/<img class="package-icon"[^>]*src="([^"]+)"/);
      const icon=iconMatch?iconMatch[1]:'';
      items.push({
        name,
        packageName:pkg,
        icon:icon.startsWith('http')?icon:`https://f-droid.org${icon}`,
        sourcePage:`https://f-droid.org/en/packages/${pkg}/`
      });
    }
    return items;
  }catch{
    return[];
  }
}

export async function fDroidLatest(pkg:string):Promise<{download:string;version:string}|null>{
  const txt=await fetchText(`https://f-droid.org/api/v1/packages/${encodeURIComponent(pkg)}`);
  if(!txt)return null;
  try{
    const data=JSON.parse(txt);
    const suggested=Number(data?.suggestedVersionCode);
    const packages=Array.isArray(data?.packages)?data.packages:[];
    const match=packages.find((p:{versionCode:number})=>Number(p.versionCode)===suggested)||packages[0];
    if(!match)return null;
    return{
      download:`https://f-droid.org/repo/${pkg}_${Number(match.versionCode)}.apk`,
      version:typeof match.versionName==='string'?match.versionName:''
    };
  }catch{}
  return null;
}

const norm=(s:string)=>s.toLowerCase().replace(/[^a-z0-9]/g,'');
const base=(s:string)=>{
  let out=s;
  for(let i=0;i<3;i++){
    const n=out.replace(/\s+\d+(\.\d+)+\s*(beta|alpha)?$/i,'').replace(/\s+(beta|alpha|hotfix)(\s*\d+(\.\d+)*)?$/i,'');
    if(n===out)break;
    out=n;
  }
  return norm(out);
};

export function buildResults(
  apk:ApkMirror[],
  play:Play[],
  apt:Aptoide[],
  comb:ApkComboResult[],
  tap:Tap[],
  fdr:FDroidItem[]=[]
):App[]{
  const playByTitle=new Map(play.map(p=>[norm(p.name),p]));
  const playByBase=new Map(play.map(p=>[base(p.name),p]));
  const aptByPkg=new Map(apt.map(a=>[a.packageName,a]));
  const aptByName=new Map(apt.map(a=>[norm(a.name),a]));
  const usedPerSource=new Set<string>();
  const results:App[]=[];

  const push=(item:App,pkg?:string,nameKey?:string)=>{
    const pk=(pkg&&PKG_RE.test(pkg))?pkg:'';
    const nk=nameKey||norm(item.name);
    const key=`${item.source}:${pk||nk}`;
    if(usedPerSource.has(key))return;
    usedPerSource.add(key);
    results.push(item);
  };

  const enrich=(target:App,pkg?:string,nameKey?:string)=>{
    const a=(pkg?aptByPkg.get(pkg):undefined)||(nameKey?aptByName.get(nameKey):undefined);
    if(!a)return;
    if(!target.version||target.version==='—'||target.version==='See source')target.version=a.version||target.version;
    if(a.download&&!target.download)target.download=a.download;
    if(a.size&&!target.size)target.size=a.size;
    if(a.md5&&!target.md5)target.md5=a.md5;
    if(a.rank&&!target.rank)target.rank=a.rank;
    if(a.store&&!target.store)target.store=a.store;
    if(a.signer&&!target.signer)target.signer=a.signer;
  };

  for(const a of apk){
    const p=playByTitle.get(norm(a.name))||playByBase.get(base(a.name));
    const pkg=p?p.packageName:'';
    const item:App={
      name:a.name,
      packageName:pkg||(a.developer?`by ${a.developer}`:'Package name on source page'),
      version:a.version||'See source',
      source:'APKMirror',
      category:['Android'],
      icon:p&&p.icon?p.icon:a.icon,
      sourcePage:a.sourcePage,
      playUrl:p?p.playUrl:undefined,
      variants:[]
    };
    enrich(item,pkg,norm(a.name));
    push(item,pkg,norm(a.name));
  }

  for(const p of play){
    const item:App={
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
    enrich(item,p.packageName,norm(p.name));
    push(item,p.packageName,norm(p.name));
  }

  for(const a of apt){
    if(!a.download)continue;
    const item:App={
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
    };
    push(item,a.packageName,norm(a.name));
  }

  for(const c of comb){
    const item:App={
      name:c.name,
      packageName:c.packageName,
      version:'—',
      source:'APKCombo',
      category:[c.category||'Android'],
      icon:c.icon,
      sourcePage:c.sourcePage,
      variants:[]
    };
    enrich(item,c.packageName,norm(c.name));
    push(item,c.packageName,norm(c.name));
  }

  for(const t of tap){
    const item:App={
      name:t.name,
      packageName:t.packageName,
      version:'—',
      source:'TapTap',
      category:['Android'],
      icon:t.icon,
      sourcePage:t.sourcePage,
      playUrl:t.playUrl,
      variants:[]
    };
    enrich(item,t.packageName,norm(t.name));
    push(item,t.packageName,norm(t.name));
  }

  for(const f of fdr){
    const item:App={
      name:f.name,
      packageName:f.packageName,
      version:'—',
      source:'F-Droid',
      category:['Open Source','F-Droid'],
      icon:f.icon,
      sourcePage:f.sourcePage,
      variants:[]
    };
    enrich(item,f.packageName,norm(f.name));
    push(item,f.packageName,norm(f.name));
  }

  // Ensure APKMirror mirror entries are accessible for top discovered packages if direct scraper hit challenge
  if(!apk.length && results.length>0){
    const topCandidates = results.filter(r=>PKG_RE.test(r.packageName)).slice(0,3);
    for(const top of topCandidates){
      results.push({
        name:`${top.name} (APKMirror)`,
        packageName:top.packageName,
        version:'Mirror Release',
        source:'APKMirror',
        category:top.category,
        icon:top.icon,
        sourcePage:`https://www.apkmirror.com/?post_type=app_release&searchtype=apk&s=${encodeURIComponent(top.packageName)}`,
        playUrl:top.playUrl,
        variants:[]
      });
    }
  }

  return results.slice(0,RESULT_CAP);
}

function fillFrom(target:App,src:{version?:string;size?:number;md5?:string;rank?:string;store?:string;signer?:string}){
  if(!target.version||target.version==='—'||target.version==='See source')target.version=src.version||target.version;
  if(src.size&&!target.size)target.size=src.size;
  if(src.md5&&!target.md5)target.md5=src.md5;
  if(src.rank&&!target.rank)target.rank=src.rank;
  if(src.store&&!target.store)target.store=src.store;
  if(src.signer&&!target.signer)target.signer=src.signer;
}

export async function resolveOne(target:App):Promise<string>{
  if(target.download)return 'has';
  if(!PKG_RE.test(target.packageName))return 'skip';
  const pkg=target.packageName;
  const apt=await aptoideByPackage(pkg);
  if(apt?.download){
    fillFrom(target,apt);
    target.download=apt.download;
    return 'apt-exact';
  }
  if(target.name){
    const byName=await aptoideByName(target.name);
    if(byName?.download&&norm(byName.name)===norm(target.name)){
      fillFrom(target,byName);
      target.download=byName.download;
      return 'apt-name';
    }
  }
  const fd=await fDroidLatest(pkg);
  if(fd){
    if(!target.version||target.version==='—')target.version=fd.version||target.version;
    target.download=fd.download;
    return 'fdroid';
  }
  const apkc=await apkcomboResolve(target.name,pkg);
  if(apkc?.download){
    fillFrom(target,{version:apkc.version,size:apkc.size});
    target.download=apkc.download;
    return 'apkcombo';
  }
  return 'none';
}

export async function resolveDownloads(results:App[],cap=RESOLVE_CAP):Promise<Record<string,string>>{
  const pending=results.filter(r=>!r.download&&PKG_RE.test(r.packageName)).slice(0,cap);
  const dbg:Record<string,string>={};
  await Promise.all(pending.map(async it=>{
    const how=await resolveOne(it);
    dbg[it.packageName]=how;
  }));
  for(const r of results){
    if(r.download&&!r.download.includes('/download?url='))r.download=through(r.download);
  }
  return dbg;
}

export async function searchSources(q:string):Promise<App[]>{
  const [apk,play,apt,comb,tap,fdr]=await Promise.all([
    searchApkmirror(q),
    searchPlay(q),
    aptoideSearch(q,14),
    apkcomboSearch(q,12),
    searchTapTap(q),
    searchFDroid(q,10)
  ]);
  return buildResults(apk,play,apt,comb,tap,fdr);
}

export const searchCacheKey=(q:string)=>`search:${q.toLowerCase().trim()}`;
export {cached};
export type {App};
