export const UA='Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';
export const WORKER=(process.env.WORKER_URL||'https://apkscope-resolver.apkscope.workers.dev').replace(/\/+$/,'');
export const APTOIDE_KEY=process.env.APTOIDE_API_KEY||'82c70dbc-936c-4657-8add-31f7db491878';
export const PKG_RE=/^[a-zA-Z]\w*(\.\w+)+$/;
export const TAP_UA='V=1&PN=WebAppIntl2&LANG=en_US&VN_CODE=116&LOC=CN&PLT=Android&DS=Android&UID=37c663ad-2b80-4f3a-a2eb-0dd5edd848a1&VN=0.1.0&OS=Android&OSV=15&VID=640552280';

export function through(url:string){
  return `${WORKER}/download?url=${encodeURIComponent(url)}`;
}

export function decode(s:string):string{
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

export function unjson(s:string):string{
  return s.replace(/\\u([0-9a-f]{4})/gi,(_,h:string)=>String.fromCharCode(parseInt(h,16)))
    .replace(/\\"/g,'"')
    .replace(/\\\\/g,'\\');
}

type FetchOpts={timeout?:number;extra?:Record<string,string>};

export async function fetchText(url:string,opts:FetchOpts={}):Promise<string>{
  const {timeout=8000,extra={}}=opts;
  const attempt=async(target:string)=>{
    const ctl=new AbortController();
    const timer=setTimeout(()=>ctl.abort(),timeout);
    try{
      const r=await fetch(target,{
        headers:{
          'user-agent':UA,
          accept:'text/html,application/xhtml+xml,application/xml;q=0.9,application/json,*/*;q=0.8',
          'accept-language':'en-US,en;q=0.9',
          ...extra
        },
        redirect:'follow',
        cache:'no-store',
        signal:ctl.signal
      });
      if(!r.ok)return '';
      const body=await r.text();
      return /Just a moment|cf-browser-verification|challenge-platform|Enable JavaScript and cookies/i.test(body)?'':body;
    }catch{
      return '';
    }finally{
      clearTimeout(timer);
    }
  };
  const direct=await attempt(url);
  if(direct)return direct;
  return attempt(`${WORKER}/proxy?url=${encodeURIComponent(url)}`);
}

const store=new Map<string,{v:unknown;exp:number}>();
const MAX_ENTRIES=500;

export function cacheGet<T>(key:string):T|undefined{
  const e=store.get(key);
  if(!e)return undefined;
  if(e.exp<Date.now()){store.delete(key);return undefined}
  return e.v as T;
}

export function cacheSet<T>(key:string,value:T,ttlMs:number){
  if(store.size>=MAX_ENTRIES){
    const oldest=store.keys().next().value;
    if(oldest!==undefined)store.delete(oldest);
  }
  store.set(key,{v:value,exp:Date.now()+ttlMs});
}

export function cached<T>(key:string,ttlMs:number,fn:()=>Promise<T>):Promise<T>{
  const hit=cacheGet<T>(key);
  if(hit!==undefined)return Promise.resolve(hit);
  return fn().then(v=>{
    if(v!==undefined&&v!==null)cacheSet(key,v,ttlMs);
    return v;
  });
}

export function versionFromSlug(slug:string):string{
  const m=slug.match(/-(\d+(?:-\d+)+(?:[a-z]\d*)?)-release$/i);
  return m?m[1].replace(/-/g,'.'):'';
}

export function iconUrl(s:string):string{
  return s?s.replace(/=s\d+.*$/,'')+'=s96':'';
}
