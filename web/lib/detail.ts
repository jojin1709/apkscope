import {fetchText,PKG_RE,through,cached} from './core';
import {aptoideByPackage,aptoideByName,aptoideVersions} from './aptoide';
import {apkcomboResolve,apkcomboVersions,apkcomboR2} from './apkcombo';
import type {App,AppDetail,Version} from './types';

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
        download:`https://f-droid.org/repo/${pkg}_${Number(p.versionCode)}.apk`,
        page:`https://f-droid.org/en/packages/${encodeURIComponent(pkg)}/`
      });
    }
  }catch{}
  return out;
}

const GITHUB_PKG_MAP: Record<string, string> = {
  'com.termux': 'termux/termux-app',
  'org.schabi.newpipe': 'TeamNewPipe/NewPipe',
  'pan.alexander.tordnscrypt': 'Gedsh/InviZible-Pro',
  'com.beemdevelopment.aegis': 'beemdevelopment/Aegis',
  'eu.faircode.netguard': 'M66B/NetGuard',
  'org.adaway': 'AdAway/AdAway',
  'app.revanced.manager.flutter': 'ReVanced/revanced-manager',
  'com.aurora.store': 'whyorean/AuroraStore',
  'eu.kanade.tachiyomi': 'mihonapp/mihon',
  'org.briarproject.briar.android': 'briar/briar',
  'com.fsck.k9': 'thunderbird/thunderbird-android',
  'org.videolan.vlc': 'videolan/vlc-android'
};

async function githubVersions(pkg: string): Promise<Version[]> {
  const repo = GITHUB_PKG_MAP[pkg];
  if (!repo) return [];
  try {
    const txt = await fetchText(`https://api.github.com/repos/${repo}/releases?per_page=4`, {
      extra: { 'User-Agent': 'APKScope-Client' }
    });
    if (!txt) return [];
    const rels = JSON.parse(txt);
    if (!Array.isArray(rels)) return [];
    const out: Version[] = [];
    for (const rel of rels) {
      const assets = Array.isArray(rel?.assets) ? rel.assets : [];
      const apk = assets.find((a: { name?: string }) => (a.name || '').toLowerCase().endsWith('.apk'));
      if (apk) {
        out.push({
          version: rel.tag_name || 'Release',
          size: apk.size || 0,
          md5: '',
          date: rel.published_at ? rel.published_at.slice(0, 10) : '',
          src: 'GitHub Releases',
          download: apk.browser_download_url,
          page: rel.html_url
        });
      }
    }
    return out;
  } catch {
    return [];
  }
}

async function izzyVersions(pkg: string): Promise<Version[]> {
  try {
    const txt = await fetchText(`https://apt.izzysoft.de/fdroid/api/v1/packages/${encodeURIComponent(pkg)}`, {
      extra: { 'User-Agent': 'APKScope-Izzy-Client' }
    });
    if (!txt) return [];
    const data = JSON.parse(txt);
    const packages = Array.isArray(data?.packages) ? data.packages : [];
    const out: Version[] = [];
    for (const p of packages.slice(0, 5)) {
      const apkName = p.apkName || `${pkg}_${p.versionCode}.apk`;
      out.push({
        version: p.versionName || String(p.versionCode),
        size: 0,
        md5: p.hash || '',
        date: '',
        src: 'IzzyOnDroid',
        download: `https://apt.izzysoft.de/fdroid/repo/${apkName}`,
        page: `https://apt.izzysoft.de/fdroid/index/apk/${encodeURIComponent(pkg)}`
      });
    }
    return out;
  } catch {
    return [];
  }
}

export async function getVersions(pkg:string,name?:string):Promise<Version[]>{
  if(!PKG_RE.test(pkg))return[];
  const [apt,fd,apkcRaw,gh,izzy]=await Promise.all([
    aptoideVersions(pkg,name),
    fdroidVersions(pkg),
    apkcomboVersions(pkg,name||''),
    githubVersions(pkg),
    izzyVersions(pkg)
  ]);
  await Promise.all(apkcRaw.slice(0,3).map(async v=>{
    if(v.page){
      const r2=await apkcomboR2(v.page);
      if(r2)v.download=r2;
    }
  }));
  const apkc:Version[]=apkcRaw.map(v=>({
    version:v.version,size:0,md5:'',date:v.date,src:'APKCombo',page:v.page,download:v.download
  }));

  // Add Official Store & Mirror Releases so users have immediate access to all mirrors
  const mirrorReleases:Version[]=[
    {
      version:'Latest Official Store Release',
      size:0,
      md5:'',
      date:new Date().toISOString().slice(0,10),
      src:'Google Play',
      page:`https://play.google.com/store/apps/details?id=${encodeURIComponent(pkg)}`
    },
    {
      version:'Verified Mirror Build',
      size:0,
      md5:'',
      date:'',
      src:'APKMirror',
      page:`https://www.apkmirror.com/?post_type=app_release&searchtype=apk&s=${encodeURIComponent(pkg)}`
    },
    {
      version:'TapTap Android Build',
      size:0,
      md5:'',
      date:'',
      src:'TapTap',
      page:`https://www.taptap.io/search/${encodeURIComponent(pkg)}`
    },
    {
      version:'Uptodown Rollback Archive',
      size:0,
      md5:'',
      date:'',
      src:'Uptodown',
      page:`https://en.uptodown.com/android/search/${encodeURIComponent(pkg)}`
    }
  ];

  // If F-Droid didn't have specific version codes, add F-Droid repository link
  if(!fd.length){
    mirrorReleases.push({
      version:'F-Droid Repository Listing',
      size:0,
      md5:'',
      date:'',
      src:'F-Droid',
      page:`https://f-droid.org/en/packages/${encodeURIComponent(pkg)}/`
    });
  }

  const seen=new Set<string>();
  const versions:Version[]=[];
  for(const v of [...gh,...izzy,...apt,...fd,...apkc,...mirrorReleases]){
    const key=`${v.src}-${v.version}`;
    if(seen.has(key))continue;
    seen.add(key);
    if(v.download)v.download=through(v.download);
    versions.push(v);
  }

  versions.sort((a,b)=>{
    const da=a.date||'',db=b.date||'';
    if(da&&db&&da!==db)return db<da?-1:1;
    if(da&&!db)return -1;
    if(!da&&db)return 1;
    return 0;
  });
  return versions;
}

async function playMeta(pkg:string):Promise<{name:string;icon:string;description:string;playUrl:string}>{
  return cached(`play:meta:${pkg}`,600000,async()=>{
    const html=await fetchText(`https://play.google.com/store/apps/details?id=${encodeURIComponent(pkg)}&hl=en&gl=US`);
    const out={name:'',icon:'',description:'',playUrl:`https://play.google.com/store/apps/details?id=${encodeURIComponent(pkg)}&hl=en`};
    if(!html)return out;
    const title=(html.match(/<meta property="og:title" content="([^"]+)"/)||[])[1]||'';
    const icon=(html.match(/<meta property="og:image" content="([^"]+)"/)||[])[1]||'';
    const desc=(html.match(/<meta property="og:description" content="([^"]+)"/)||[])[1]||'';
    if(title)out.name=title.replace(/\s+-\s+Apps on Google Play$/,'').replace(/\s+–\s+Apps on Google Play$/,'');
    if(icon)out.icon=icon.replace(/=s\d+.*$/,'')+'=s96';
    if(desc)out.description=decodeEntities(desc);
    return out;
  });
}

function decodeEntities(s:string):string{
  return s.replace(/&#(\d+);/g,(_,d:string)=>String.fromCharCode(Number(d)))
    .replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"').trim();
}

export async function getAppDetail(pkg:string,name=''):Promise<AppDetail>{
  const blank:AppDetail={
    pkg,name,icon:'',version:'',size:0,md5:'',signer:'',rank:'',store:'',
    description:'',changelog:'',screenshots:[],category:'',developer:'',
    rating:0,downloads:'',updated:'',
    sourcePage:pkg?`https://play.google.com/store/apps/details?id=${encodeURIComponent(pkg)}`:''
  };
  if(pkg&&!PKG_RE.test(pkg))return blank;
  let aptFull=pkg?await aptoideByPackage(pkg):null;
  if(!aptFull&&name)aptFull=await aptoideByName(name);
  const needApkc=!aptFull||!aptFull.download||!aptFull.description||!aptFull.screenshots.length;
  const apkc=needApkc&&name?await apkcomboResolve(name,pkg||name):null;
  const d:AppDetail={...blank};
  if(aptFull){
    d.pkg=aptFull.pkg||d.pkg;
    d.name=aptFull.name||d.name;
    d.icon=aptFull.icon||d.icon;
    d.version=aptFull.version||d.version;
    d.size=aptFull.size||d.size;
    d.md5=aptFull.md5||d.md5;
    d.signer=aptFull.signer;
    d.rank=aptFull.rank;
    d.store=aptFull.store;
    d.description=aptFull.description||d.description;
    d.changelog=aptFull.changelog||d.changelog;
    d.screenshots=aptFull.screenshots.length?aptFull.screenshots:d.screenshots;
    d.developer=aptFull.developer||d.developer;
    d.rating=aptFull.rating||d.rating;
    d.downloads=aptFull.downloads||d.downloads;
    d.updated=aptFull.updated||d.updated;
    if(aptFull.download)d.download=through(aptFull.download);
    d.sourcePage=`https://en.aptoide.com/app/${encodeURIComponent(d.pkg)}`;
    d.store2='Aptoide';
  }
  if(apkc){
    if(!d.name)d.name=name||apkc.developer||d.name;
    if(!d.version)d.version=apkc.version;
    if(!d.size)d.size=apkc.size;
    if(!d.description)d.description=apkc.description;
    if(!d.screenshots.length)d.screenshots=apkc.screenshots;
    if(!d.category)d.category=apkc.category;
    if(!d.developer)d.developer=apkc.developer;
    if(apkc.download&&!d.download)d.download=through(apkc.download);
    if(apkc.sourcePage){d.sourcePage=apkc.sourcePage;d.store2='APKCombo'}
    if(!d.icon&&d.screenshots.length)d.icon='';
  }
  if(pkg&&(!d.name||!d.icon||!d.description)){
    const pm=await playMeta(pkg);
    if(!d.name&&pm.name)d.name=pm.name;
    if(!d.icon&&pm.icon)d.icon=pm.icon;
    if(!d.description&&pm.description)d.description=pm.description;
    if(!d.sourcePage)d.sourcePage=pm.playUrl;
  }
  if(!d.name&&name)d.name=name;
  return d;
}
