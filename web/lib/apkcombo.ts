import {fetchText,decode,cached,PKG_RE} from './core';
import type {BrowseItem} from './types';

const BASE='https://apkcombo.com';
const UA_HDR={'user-agent':'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36','accept-language':'en-US,en;q=0.9'};

export type ApkComboResult={
  name:string;
  packageName:string;
  icon:string;
  sourcePage:string;
  author:string;
  category:string;
  rating:string;
  downloads:string;
};

export type ApkComboResolved={
  download?:string;
  version:string;
  size:number;
  description:string;
  screenshots:string[];
  category:string;
  developer:string;
  sourcePage:string;
};

function pkgFromHref(href:string):string{
  const parts=href.split('/').filter(Boolean);
  const last=parts[parts.length-1]||'';
  return /^[a-zA-Z]\w*(\.\w+)+$/.test(last)?last:'';
}

function parseItems(html:string,limit=14):ApkComboResult[]{
  const items:ApkComboResult[]=[];
  const re=/<a class="l_item" href="([^"]+)" title="([^"]*)">([\s\S]{0,1200}?)<\/a>/g;
  const seen=new Set<string>();
  let m:RegExpExecArray|null;
  while((m=re.exec(html))&&items.length<limit){
    const href=m[1];
    const body=m[3];
    const pkg=pkgFromHref(href);
    if(!pkg||seen.has(pkg))continue;
    seen.add(pkg);
    const name=(body.match(/<span class="name">([^<]+)<\/span>/)||[])[1]||decode(m[2]).replace(/\s+APK$/,'');
    const authorRaw=(body.match(/<span class="author">([^<]+)<\/span>/)||[])[1]||'';
    const authorCat=decode(authorRaw);
    const sep=authorCat.indexOf('·');
    const author=sep>=0?authorCat.slice(0,sep).trim():authorCat;
    const category=sep>=0?authorCat.slice(sep+1).trim():'';
    const icon=(body.match(/data-src="([^"]+)"/)||[])[1]||'';
    const stats=decode((body.match(/<span class="description">([\s\S]*?)<\/span>/)||[])[1]||'').replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').trim();
    const rating=(stats.match(/(\d+(?:\.\d+)?)\s*★/)||[])[1]||'';
    const downloads=(stats.match(/([0-9.]+\s*[BKM]\+?)/i)||[])[1]||'';
    if(!name)continue;
    items.push({
      name,
      packageName:pkg,
      icon:icon.replace(/=s\d+.*$/,'=s96'),
      sourcePage:BASE+href,
      author,
      category,
      rating,
      downloads
    });
  }
  return items;
}

export async function apkcomboSearch(q:string,limit=12):Promise<ApkComboResult[]>{
  const key=`apkc:search:${q}:${limit}`;
  return cached(key,600000,async()=>{
    const html=await fetchText(`${BASE}/en/search?q=${encodeURIComponent(q)}`,{extra:UA_HDR});
    if(!html)return [];
    return parseItems(html,limit);
  });
}

const CAT_SLUGS=new Set(['tools','social','productivity','photography','video-players','entertainment','communication','business','lifestyle','music-and-audio','personalization','health-and-fitness','education','shopping','news-and-magazines','food-and-drink','travel-and-local','sports','dating','comics','art-and-design','maps-and-navigation','weather','books-and-reference','medical','beauty','house-and-home','parenting','auto-and-vehicles','libraries-and-demo','events']);

export function validCat(slug:string):boolean{
  return slug==='trending'||slug==='games'||CAT_SLUGS.has(slug);
}

function catUrl(slug:string):string{
  if(slug==='trending')return `${BASE}/category/app/hot/`;
  if(slug==='games')return `${BASE}/category/game/hot/`;
  return `${BASE}/category/${slug}/top-popular/`;
}

export async function apkcomboBrowse(slug:string):Promise<BrowseItem[]>{
  const key=`apkc:browse:${slug}`;
  return cached(key,900000,async()=>{
    if(!validCat(slug))return[];
    const html=await fetchText(catUrl(slug),{extra:UA_HDR});
    if(!html)return[];
    return parseItems(html,20).map(it=>({
      name:it.name,
      packageName:it.packageName,
      icon:it.icon,
      sourcePage:it.sourcePage,
      rating:it.rating?`${it.rating} ★`:undefined,
      downloads:it.downloads||undefined
    }));
  });
}

async function r2FromDownloadPage(pagePath:string):Promise<string|''>{
  const html=await fetchText(`${BASE}${pagePath}/download/apk`,{extra:UA_HDR});
  if(!html)return '';
  const m=html.match(/href="(\/r2\?u=[^"]+)"/);
  if(!m)return '';
  return BASE+m[1];
}

export async function apkcomboR2(pageUrl:string):Promise<string|''>{
  const html=await fetchText(pageUrl,{extra:UA_HDR});
  if(!html)return '';
  const m=html.match(/href="(\/r2\?u=[^"]+)"/);
  return m?BASE+m[1]:'';
}

export type ApkcVersion={version:string;date:string;page:string;download?:string};

const MONTHS:Record<string,string>={Jan:'01',Feb:'02',Mar:'03',Apr:'04',May:'05',Jun:'06',Jul:'07',Aug:'08',Sep:'09',Oct:'10',Nov:'11',Dec:'12'};

export async function apkcomboVersions(pkg:string,name=''):Promise<ApkcVersion[]>{
  const key=`apkc:vers:${pkg||name}`;
  return cached(key,900000,async()=>{
    let appUrl='';
    if(pkg&&PKG_RE.test(pkg)){
      const html=await fetchText(`${BASE}/en/${encodeURIComponent(pkg)}`,{extra:UA_HDR});
      if(html){
        const c=(html.match(/<link rel="canonical" href="([^"]+)"/)||[])[1]||'';
        if(c&&c.includes(`/${pkg}/`))appUrl=c;
      }
    }
    if(!appUrl){
      let list=await apkcomboSearch(pkg||name,10);
      let page=list.find(it=>pkg&&it.packageName===pkg);
      if(!page){
        list=await apkcomboSearch(name||pkg,10);
        page=list.find(it=>pkg&&it.packageName===pkg)||list.find(it=>norm(it.name)===norm(name));
      }
      if(!page)return [];
      appUrl=page.sourcePage;
    }
    const html=await fetchText(`${appUrl.replace(/\/+$/,'')}/versions`,{extra:UA_HDR});
    if(!html)return [];
    const out:ApkcVersion[]=[];
    const re=/<a class="ver-item" href="([^"]+)"[\s\S]{0,1400}?<\/a>/g;
    let m:RegExpExecArray|null;
    while((m=re.exec(html))&&out.length<10){
      const href=m[1];
      const seg=href.split('/').filter(Boolean).pop()||'';
      const stripped=seg.replace(/-apk$/i,'');
      const di=stripped.search(/\d/);
      if(di<0)continue;
      const ver=stripped.slice(di);
      if(!ver||out.some(v=>v.version===ver))continue;
      let date='';
      const dm=m[0].match(/<div class="description">([^<]+)<\/div>/);
      if(dm){
        const mm=dm[1].match(/([A-Za-z]{3})\s+(\d{1,2}),\s+(\d{4})/);
        if(mm&&MONTHS[mm[1]])date=`${mm[3]}-${MONTHS[mm[1]]}-${mm[2].padStart(2,'0')}`;
      }
      out.push({version:ver,date,page:BASE+href});
    }
    return out;
  });
}

export async function apkcomboResolve(name:string,pkg:string):Promise<ApkComboResolved|null>{
  const key=`apkc:res:${pkg}`;
  return cached(key,900000,async()=>{
    const q=pkg||name;
    let list=await apkcomboSearch(q,10);
    let page=list.find(it=>pkg&&it.packageName===pkg);
    if(!page){
      list=await apkcomboSearch(name||pkg,10);
      page=list.find(it=>pkg&&it.packageName===pkg)||list.find(it=>norm(it.name)===norm(name));
    }
    if(!page)return null;
    const href=page.sourcePage.replace(BASE,'');
    const appHtml=await fetchText(BASE+href,{extra:UA_HDR});
    let version='';
    let size=0;
    let description='';
    let updated='';
    let developer=page.author;
    if(appHtml){
      const meta=(appHtml.match(/<meta name="description" content="([^"]+)"/)||[])[1]||'';
      const dec=decode(meta);
      const vm=dec.match(/APK\s+([0-9][\w.\-]*)\s+-\s+([\d.]+\s*[KMG]B)/i);
      if(vm){version=vm[1];size=parseSize(vm[2])}
      const um=dec.match(/Updated:\s*([0-9]{4}-[0-9]{2}|[A-Za-z]+\s+[0-9]{4})/);
      if(um)updated=um[1];
      const dmm=dec.match(/-\s+([^-\n]+?)\s+-\s+(?:Free|Paid)\s+App/i);
      if(dmm)developer=dmm[1].trim();
      const cat=(appHtml.match(/href="\/category\/[^"]+">\s*([^<]+)<\/a>/)||[])[1]||'';
      description=dec;
      const shots=[...appHtml.matchAll(/data-href="(https:\/\/play-lh\.googleusercontent\.com\/[^"]+)"/g)].map(x=>x[1].replace(/=w\d+.*/,'=w800'));
      const download=await r2FromDownloadPage(href);
      return{
        download:download||undefined,
        version,
        size,
        description:description.replace(/^Download\s+[^ ]+\s+APK[^-]*-\s*/,''),
        screenshots:[...new Set(shots)].slice(0,12),
        category:decode(cat||page.category),
        developer,
        sourcePage:BASE+href
      };
    }
    const download=await r2FromDownloadPage(href);
    if(!download)return null;
    return{download,version,size,description:'',screenshots:[],category:page.category,developer,sourcePage:BASE+href};
  });
}

function parseSize(s:string):number{
  const m=s.match(/([\d.]+)\s*([KMG])B/i);
  if(!m)return 0;
  const n=parseFloat(m[1]);
  const unit=m[2].toUpperCase();
  return Math.round(n*(unit==='G'?1073741824:unit==='M'?1048576:1024));
}

const norm=(s:string)=>s.toLowerCase().replace(/[^a-z0-9]/g,'');
