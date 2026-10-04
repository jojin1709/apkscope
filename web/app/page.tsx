'use client';
import {useState,useMemo,useEffect,useRef} from 'react';
import {useUI} from '../components/Providers';
import {AppDetailPanel} from '../components/AppDetail';
import type {App,AppDetail,BrowseItem,Suggest,Version} from '../lib/types';
import {
  IconFlame,IconGame,IconChat,IconWrench,IconChart,IconCamera,IconMusic,IconVideo,
  IconMail,IconSparkles,IconShield,IconStar,IconClock,IconTrophy,IconBolt,
  IconGooglePlay,IconFDroid,IconApkMirror,IconAptoide,IconApkCombo,IconTapTap
} from '../components/Icons';

type Sort='relevance'|'version'|'name';
const PAGE_SIZE=8;
const PKG_RE=/^[a-zA-Z]\w*(\.\w+)+$/;
const SOURCE_LIST=['APKMirror','Google Play','Aptoide','APKCombo','TapTap','F-Droid'];
const POPULAR=['WhatsApp','Instagram','Telegram','Spotify','PayPal','Minecraft','Termux','Signal','F-Droid'];

const CATS=[
  {k:'trending',l:'Trending',icon:'flame'},
  {k:'games',l:'Games',icon:'game'},
  {k:'social',l:'Social',icon:'chat'},
  {k:'tools',l:'Tools',icon:'wrench'},
  {k:'productivity',l:'Productivity',icon:'chart'},
  {k:'photography',l:'Photos',icon:'camera'},
  {k:'music-and-audio',l:'Music',icon:'music'},
  {k:'video-players',l:'Video',icon:'video'},
  {k:'communication',l:'Communication',icon:'mail'},
  {k:'entertainment',l:'Entertainment',icon:'sparkles'}
];

function getCatIcon(iconName:string){
  switch(iconName){
    case 'flame':return <IconFlame size={14} color="#f97316"/>;
    case 'game':return <IconGame size={14} color="#a855f7"/>;
    case 'chat':return <IconChat size={14} color="#3b82f6"/>;
    case 'wrench':return <IconWrench size={14} color="#64748b"/>;
    case 'chart':return <IconChart size={14} color="#10b981"/>;
    case 'camera':return <IconCamera size={14} color="#ec4899"/>;
    case 'music':return <IconMusic size={14} color="#8b5cf6"/>;
    case 'video':return <IconVideo size={14} color="#ef4444"/>;
    case 'mail':return <IconMail size={14} color="#06b6d4"/>;
    case 'sparkles':return <IconSparkles size={14} color="#eab308"/>;
    default:return <IconFlame size={14}/>;
  }
}

// Curated Crisp Vector Brand Icons that never break or 404
const SPOTLIGHT_APPS=[
  {
    name:'Telegram',
    pkg:'org.telegram.messenger',
    dev:'Telegram FZ-LLC',
    rating:'4.8',
    icon:'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><defs><linearGradient id="tg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="%232AABEE"/><stop offset="1" stop-color="%23229ED9"/></linearGradient></defs><rect width="100" height="100" rx="22" fill="url(%23tg)"/><path d="M22 49l52-22c2.4-1 5 1.2 4.2 3.8L69 77c-.6 2.3-3.3 3.3-5.2 2L49 67l-7 7c-1 1-2.7.5-3-1l-3-15L71 36 33 55 22 49z" fill="%23fff"/></svg>'
  },
  {
    name:'Spotify: Music and Podcasts',
    pkg:'com.spotify.music',
    dev:'Spotify AB',
    rating:'4.4',
    icon:'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" rx="22" fill="%231ED760"/><path d="M26 40c18-5 38-3 51 5 2 1 2 4 1 6-1 2-4 2-6 1-11-7-30-8-46-4-3 1-5-1-6-3-1-3 1-5 4-5zm-2 15c15-4 34-3 46 4 2 1 3 4 1 6-1 2-4 3-6 1-10-6-27-7-40-3-2 1-5-1-6-3-1-2 1-5 3-5zm1 14c13-4 28-2 38 4 2 1 2 4 1 5-1 2-4 2-5 1-9-5-22-6-33-3-2 1-4-1-5-3-1-2 1-4 3-4z" fill="%23000"/></svg>'
  },
  {
    name:'Signal Private Messenger',
    pkg:'org.thoughtcrime.securesms',
    dev:'Signal Foundation',
    rating:'4.7',
    icon:'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" rx="22" fill="%233A76F0"/><path d="M50 20c-17 0-30 13-30 29 0 7 3 14 7 19l-4 11c-1 2 1 4 3 3l12-5c4 1 8 1 12 1 17 0 30-13 30-29S67 20 50 20zm0 8c12 0 22 9 22 21s-10 21-22 21c-3 0-6 0-9-1l-7 3 2-7c-4-4-6-9-6-16 0-12 10-21 22-21z" fill="%23fff"/></svg>'
  },
  {
    name:'Termux',
    pkg:'com.termux',
    dev:'Fredrik Fornwall',
    rating:'4.6',
    icon:'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" rx="22" fill="%230f172a"/><path d="M25 35l18 15-18 15v-8l8-7-8-7zm22 26h28v6H47z" fill="%2310b981"/></svg>'
  }
];

const isImg=(s?:string)=>!!s&&/^(https?:\/\/|data:image\/)/.test(s);

function verKey(v:string){
  const p=(v||'').match(/\d+/g);
  return p?p.map(n=>n.padStart(9,'0')).join(''):'';
}

function cleanTitle(s?:string):string{
  if(!s)return '';
  return s
    .replace(/&amp;/g,'&')
    .replace(/&quot;/g,'"')
    .replace(/&#39;/g,"'")
    .replace(/&apos;/g,"'")
    .replace(/&lt;/g,'<')
    .replace(/&gt;/g,'>')
    .replace(/&#(\d+);/g,(_,n)=>String.fromCharCode(Number(n)))
    .trim();
}

type Recent={name:string;pkg:string;icon:string};

export default function Home(){
  const {t}=useUI();
  const [navTab,setNavTab]=useState<'apps'|'sources'|'tools'>('apps');
  const [q,setQ]=useState('');
  const [results,setResults]=useState<App[]>([]);
  const [selected,setSelected]=useState<App|null>(null);
  const [loading,setLoading]=useState(false);
  const [checked,setChecked]=useState<Record<string,boolean>>(()=>Object.fromEntries(SOURCE_LIST.map(s=>[s,true])));
  const [directOnly,setDirectOnly]=useState(false);
  const [sort,setSort]=useState<Sort>('relevance');
  const [versions,setVersions]=useState<Version[]>([]);
  const [verLoading,setVerLoading]=useState(false);
  const [detail,setDetail]=useState<AppDetail|null>(null);
  const [detailLoading,setDetailLoading]=useState(false);
  const [visible,setVisible]=useState(PAGE_SIZE);
  const [sugs,setSugs]=useState<Suggest[]>([]);
  const [sugOpen,setSugOpen]=useState(false);
  const [sugIndex,setSugIndex]=useState(-1);
  const [cat,setCat]=useState('');
  const [catLabel,setCatLabel]=useState('');
  const [browse,setBrowse]=useState<BrowseItem[]>([]);
  const [browseLoading,setBrowseLoading]=useState(false);
  const [trending,setTrending]=useState<BrowseItem[]>([]);
  const [recent,setRecent]=useState<Recent[]>([]);
  const [error,setError]=useState('');

  // Tools state
  const [toolHashInput,setToolHashInput]=useState('');
  const [vtHashInput,setVtHashInput]=useState('');
  const [workerPingResult,setWorkerPingResult]=useState<string>('');
  const [workerPingLoading,setWorkerPingLoading]=useState(false);

  // Accordion state
  const [openSources,setOpenSources]=useState(true);
  const [openPlatform,setOpenPlatform]=useState(true);
  const [openSort,setOpenSort]=useState(true);

  const searchWrapRef=useRef<HTMLDivElement|null>(null);
  const sugTimer=useRef<ReturnType<typeof setTimeout>|null>(null);
  const resolvedRef=useRef<Set<string>>(new Set());

  function loadRecent(){
    try{
      const raw=JSON.parse(localStorage.getItem('apkscope:recent')||'[]');
      setRecent(Array.isArray(raw)?raw.slice(0,8):[]);
    }catch{}
  }

  useEffect(()=>{
    const syncHash=()=>{
      const h=window.location.hash.replace('#','');
      if(h==='sources'||h==='tools'||h==='apps'){
        setNavTab(h as 'apps'|'sources'|'tools');
      }
    };
    syncHash();
    window.addEventListener('hashchange',syncHash);
    const onNav=(e:Event)=>{
      const custom=e as CustomEvent<string>;
      if(custom.detail==='sources'||custom.detail==='tools'||custom.detail==='apps'){
        setNavTab(custom.detail as 'apps'|'sources'|'tools');
      }
    };
    window.addEventListener('apkscope:tab',onNav);
    return ()=>{
      window.removeEventListener('hashchange',syncHash);
      window.removeEventListener('apkscope:tab',onNav);
    };
  },[]);

  useEffect(()=>{
    function onDocClick(e:MouseEvent){
      if(searchWrapRef.current&&!searchWrapRef.current.contains(e.target as Node)){
        setSugOpen(false);
      }
    }
    document.addEventListener('mousedown',onDocClick);
    return ()=>document.removeEventListener('mousedown',onDocClick);
  },[]);

  async function runSearch(value:string,selectedPkg?:string){
    const query=value.trim();
    if(!query)return;
    setNavTab('apps');
    setLoading(true);
    setError('');
    setSelected(null);
    setDetail(null);
    setVisible(PAGE_SIZE);
    setCat('');
    setSugOpen(false);
    resolvedRef.current=new Set();
    try{
      const cacheKey=`apkscope:q:${query.toLowerCase()}`;
      let apps:App[]|null=null;
      try{
        const raw=sessionStorage.getItem(cacheKey);
        if(raw){
          const parsed=JSON.parse(raw);
          if(parsed&&Date.now()-parsed.ts<1800000&&Array.isArray(parsed.results))apps=parsed.results;
        }
      }catch{}
      if(!apps){
        const r=await fetch(`/api/search?q=${encodeURIComponent(query)}`);
        if(r.status===429){
          setError(t('rateLimited'));
          apps=[];
        }else{
          const data=await r.json();
          apps=Array.isArray(data.results)&&data.results.length?data.results:[];
          try{sessionStorage.setItem(cacheKey,JSON.stringify({ts:Date.now(),results:apps}))}catch{}
        }
      }
      const found:App[]=apps||[];
      setResults(found);
      if(found.length&&found[0].packageName!=='Search supported providers'){
        const match=selectedPkg?found.find(f=>f.packageName===selectedPkg):found[0];
        setSelected(match||found[0]);
      }
    }catch{
      setResults([]);
      setError(t('rateLimited'));
    }finally{
      setLoading(false);
      try{
        history.replaceState(null,'',`#apps?q=${encodeURIComponent(query)}${selectedPkg?`&pkg=${encodeURIComponent(selectedPkg)}`:''}`);
      }catch{}
    }
  }

  function search(){runSearch(q)}

  function clearQuery(){
    setQ('');
    setSugs([]);
    setSugOpen(false);
    try{history.replaceState(null,'',location.pathname+'#apps')}catch{}
  }

  function choose(x:string){
    setQ(x);
    setSugOpen(false);
    setSugIndex(-1);
    runSearch(x);
  }

  function onQuery(v:string){
    setQ(v);
    setSugIndex(-1);
    if(sugTimer.current)clearTimeout(sugTimer.current);
    const trimmed=v.trim();
    if(trimmed.length<2){
      setSugs([]);
      setSugOpen(false);
      return;
    }
    sugTimer.current=setTimeout(async()=>{
      try{
        const r=await fetch(`/api/suggest?q=${encodeURIComponent(trimmed)}`);
        if(!r.ok)return;
        const d=await r.json();
        setSugs(Array.isArray(d.suggestions)?d.suggestions:[]);
        setSugOpen(true);
      }catch{}
    },280);
  }

  async function openCat(k:string,label:string){
    setNavTab('apps');
    if(cat===k){
      setCat('');
      setBrowse([]);
      try{history.replaceState(null,'',location.pathname+'#apps')}catch{}
      return;
    }
    setCat(k);
    setCatLabel(label);
    setBrowseLoading(true);
    setSelected(null);
    setDetail(null);
    setVisible(PAGE_SIZE);
    setQ('');
    try{history.replaceState(null,'',location.pathname+'#apps')}catch{}
    try{
      const r=await fetch(`/api/browse?cat=${encodeURIComponent(k)}`);
      const d=await r.json();
      setBrowse(Array.isArray(d.items)?d.items:[]);
    }catch{
      setBrowse([]);
    }finally{
      setBrowseLoading(false);
    }
  }

  function pickApp(item:App){
    setSelected(item);
    try{
      const u=new URL(window.location.href);
      u.searchParams.set('pkg',item.packageName);
      history.replaceState(null,'',u.toString());
    }catch{}
    if(typeof window!=='undefined'&&window.innerWidth<=780){
      setTimeout(()=>{
        document.getElementById('detailView')?.scrollIntoView({behavior:'smooth'});
      },100);
    }
  }

  function pickBrowse(b:BrowseItem){
    const app:App={
      name:b.name,
      packageName:b.packageName,
      version:'—',
      source:'APKCombo',
      category:['Android'],
      icon:b.icon,
      sourcePage:b.sourcePage,
      variants:[]
    };
    pickApp(app);
  }

  function openDirectPkg(pkg:string,name:string){
    choose(name||pkg);
  }

  async function testWorkerLatency(){
    setWorkerPingLoading(true);
    setWorkerPingResult('');
    const start=Date.now();
    try{
      const r=await fetch('https://apkscope-resolver.apkscope.workers.dev/download?url=https%3A%2F%2Ff-droid.org%2Frepo%2Findex.xml',{
        method:'HEAD',
        cache:'no-store'
      });
      const ms=Date.now()-start;
      setWorkerPingResult(`${ms} ms · Response HTTP ${r.status} (Online)`);
    }catch{
      const ms=Date.now()-start;
      setWorkerPingResult(`${ms} ms · Direct Edge Accessible`);
    }finally{
      setWorkerPingLoading(false);
    }
  }

  useEffect(()=>{
    const sp=new URLSearchParams(window.location.search);
    const p=sp.get('q');
    const pkg=sp.get('pkg');
    if(p){setQ(p);runSearch(p,pkg||undefined)}
    loadRecent();
    const updater=()=>loadRecent();
    window.addEventListener('apkscope:recent-updated',updater);
    fetch('/api/browse?cat=trending').then(r=>r.json()).then(d=>{
      if(Array.isArray(d.items))setTrending(d.items);
    }).catch(()=>{});
    return()=>window.removeEventListener('apkscope:recent-updated',updater);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  },[]);

  useEffect(()=>{
    const s=selected;
    setVersions([]);
    setDetail(null);
    if(!s||!PKG_RE.test(s.packageName)){setVerLoading(false);setDetailLoading(false);return}
    let cancel=false;
    setVerLoading(true);
    setDetailLoading(true);
    fetch(`/api/app?pkg=${encodeURIComponent(s.packageName)}&name=${encodeURIComponent(s.name)}`)
      .then(r=>r.json())
      .then(d=>{
        if(cancel)return;
        setVersions(Array.isArray(d.versions)?d.versions:[]);
        setDetail(d.app||null);
        setVerLoading(false);
        setDetailLoading(false);
      })
      .catch(()=>{
        if(cancel)return;
        setVerLoading(false);
        setDetailLoading(false);
      });
    return()=>{cancel=true};
  },[selected]);

  const counts=useMemo(()=>{
    const c:Record<string,number>={};
    results.forEach(r=>{c[r.source]=(c[r.source]||0)+1});
    return c;
  },[results]);

  const shown=useMemo(()=>{
    let list=results.filter(r=>r.source==='Provider search'||checked[r.source]!==false);
    if(directOnly)list=list.filter(r=>!!r.download);
    if(sort==='name')list=[...list].sort((a,b)=>a.name.localeCompare(b.name));
    else if(sort==='version')list=[...list].sort((a,b)=>verKey(b.version).localeCompare(verKey(a.version)));
    return list;
  },[results,checked,directOnly,sort]);

  useEffect(()=>{
    if(selected&&!cat&&shown.length>0){
      const exists=shown.some(a=>a.packageName===selected.packageName);
      if(!exists)setSelected(shown[0]);
    }
  },[shown,selected,cat]);

  const listLen=cat?browse.length:shown.length;
  const hasMore=listLen>visible;

  useEffect(()=>{
    if(cat)return;
    const slice=shown.slice(0,visible);
    const need=slice.filter(a=>!a.download&&PKG_RE.test(a.packageName)&&!resolvedRef.current.has(a.packageName));
    if(!need.length)return;
    const timer=setTimeout(async()=>{
      need.forEach(a=>resolvedRef.current.add(a.packageName));
      try{
        const payload=JSON.stringify(need.map(a=>({p:a.packageName,n:a.name})));
        const r=await fetch(`/api/resolve?items=${encodeURIComponent(payload)}`);
        if(!r.ok)return;
        const d=await r.json();
        const map=d.map||{};
        setResults(rs=>rs.map(item=>{
          const m=map[item.packageName];
          if(!m||!m.download)return item;
          return{
            ...item,
            download:m.download,
            size:item.size||m.size||0,
            md5:item.md5||m.md5||'',
            signer:item.signer||m.signer||'',
            rank:item.rank||m.rank||'',
            store:item.store||m.store||'',
            version:(!item.version||item.version==='—'||item.version==='See source')&&m.version?m.version:item.version
          };
        }));
      }catch{}
    },400);
    return()=>clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  },[visible,cat,shown.length,results]);

  const allOn=SOURCE_LIST.every(s=>checked[s]);
  const isStoreDiscovery=!q&&!cat&&results.length===0;

  return <div className="shell">
    {/* VIEW 1: SOURCES DIRECTORY (When Sources tab is selected) */}
    {navTab==='sources'&&(
      <main className="content-sources" id="sources">
        <div className="directory-header">
          <div className="spotlight-tag" style={{margin:'0 auto 12px'}}>
            <IconShield size={13} color="var(--blue)"/>
            <span>Multi-Source Ecosystem</span>
          </div>
          <h1 className="directory-title">Store & Mirror Directory</h1>
          <p className="directory-sub">
            APKScope aggregates six independent Android application repositories with cryptographic verification, direct stream proxying, and historical release tracking.
          </p>
        </div>

        <div className="sources-directory-grid">
          <div className="source-dir-card">
            <div className="source-dir-head">
              <div className="source-dir-icon"><IconGooglePlay size={28}/></div>
              <div>
                <h3>Google Play Store</h3>
                <span className="source-dir-badge">Official Ecosystem</span>
              </div>
            </div>
            <p className="source-dir-desc">
              The primary Android ecosystem index. APKScope queries verified metadata, developer certificates, and version listings.
            </p>
            <div className="source-dir-meta">
              <span>Verified Developer Signatures</span>
              <span>arm64-v8a • armeabi-v7a • x86_64</span>
            </div>
            <div className="source-dir-actions">
              <button className="primary" onClick={()=>choose('WhatsApp')}>Search Play Apps</button>
              <a className="ghostbtn" href="https://play.google.com/store/apps" target="_blank" rel="noreferrer">Official Site</a>
            </div>
          </div>

          <div className="source-dir-card">
            <div className="source-dir-head">
              <div className="source-dir-icon"><IconFDroid size={28}/></div>
              <div>
                <h3>F-Droid Repository</h3>
                <span className="source-dir-badge" style={{color:'var(--green)'}}>Free & Open Source</span>
              </div>
            </div>
            <p className="source-dir-desc">
              Community repository of Free and Open Source Android software. Direct .apk downloads built and verified from source repositories.
            </p>
            <div className="source-dir-meta">
              <span>Reproducible Builds</span>
              <span>Zero Proprietary Trackers</span>
            </div>
            <div className="source-dir-actions">
              <button className="primary" onClick={()=>choose('Termux')}>Browse F-Droid Builds</button>
              <a className="ghostbtn" href="https://f-droid.org" target="_blank" rel="noreferrer">Official Site</a>
            </div>
          </div>

          <div className="source-dir-card">
            <div className="source-dir-head">
              <div className="source-dir-icon"><IconApkMirror size={28}/></div>
              <div>
                <h3>APKMirror</h3>
                <span className="source-dir-badge">Cryptographic Archive</span>
              </div>
            </div>
            <p className="source-dir-desc">
              High-security release archive. Every APK is verified against the publisher certificate signature before indexing.
            </p>
            <div className="source-dir-meta">
              <span>Historical Version Rollbacks</span>
              <span>DPI & Architecture Splits</span>
            </div>
            <div className="source-dir-actions">
              <button className="primary" onClick={()=>choose('Telegram')}>Search APKMirror</button>
              <a className="ghostbtn" href="https://www.apkmirror.com" target="_blank" rel="noreferrer">Official Site</a>
            </div>
          </div>

          <div className="source-dir-card">
            <div className="source-dir-head">
              <div className="source-dir-icon"><IconAptoide size={28}/></div>
              <div>
                <h3>Aptoide Marketplace</h3>
                <span className="source-dir-badge">Decentralized Mirror</span>
              </div>
            </div>
            <p className="source-dir-desc">
              Decentralized application repository with over 1 million packages. High-speed direct streaming APK binaries.
            </p>
            <div className="source-dir-meta">
              <span>Instant Worker Stream</span>
              <span>Community Malware Scans</span>
            </div>
            <div className="source-dir-actions">
              <button className="primary" onClick={()=>choose('Spotify')}>Search Aptoide</button>
              <a className="ghostbtn" href="https://en.aptoide.com" target="_blank" rel="noreferrer">Official Site</a>
            </div>
          </div>

          <div className="source-dir-card">
            <div className="source-dir-head">
              <div className="source-dir-icon"><IconApkCombo size={28}/></div>
              <div>
                <h3>APKCombo</h3>
                <span className="source-dir-badge">Global Binary Index</span>
              </div>
            </div>
            <p className="source-dir-desc">
              Worldwide Android application releases, multi-regional variants, OBB archives, and split-APK package resolver.
            </p>
            <div className="source-dir-meta">
              <span>Regional Releases</span>
              <span>Direct R2 Storage Stream</span>
            </div>
            <div className="source-dir-actions">
              <button className="primary" onClick={()=>choose('Instagram')}>Search APKCombo</button>
              <a className="ghostbtn" href="https://apkcombo.com" target="_blank" rel="noreferrer">Official Site</a>
            </div>
          </div>

          <div className="source-dir-card">
            <div className="source-dir-head">
              <div className="source-dir-icon"><IconTapTap size={28}/></div>
              <div>
                <h3>TapTap Games</h3>
                <span className="source-dir-badge">Gaming & Developer Builds</span>
              </div>
            </div>
            <p className="source-dir-desc">
              International platform for mobile gaming builds, pre-registrations, beta test channels, and developer releases.
            </p>
            <div className="source-dir-meta">
              <span>Global & Asian Gaming Releases</span>
              <span>Developer Test Channels</span>
            </div>
            <div className="source-dir-actions">
              <button className="primary" onClick={()=>choose('PUBG')}>Search TapTap</button>
              <a className="ghostbtn" href="https://www.taptap.io" target="_blank" rel="noreferrer">Official Site</a>
            </div>
          </div>
        </div>
      </main>
    )}

    {/* VIEW 2: TOOLS & SECURITY WORKBENCH (When Tools tab is selected) */}
    {navTab==='tools'&&(
      <main className="content-tools" id="tools">
        <div className="directory-header">
          <div className="spotlight-tag" style={{margin:'0 auto 12px'}}>
            <IconShield size={13} color="var(--blue)"/>
            <span>Research & Audit Workbench</span>
          </div>
          <h1 className="directory-title">Security & Analysis Tools</h1>
          <p className="directory-sub">
            Cryptographic tools, signature inspectors, and live resolver telemetry for Android application audit and security research.
          </p>
        </div>

        <div className="tools-directory-grid">
          <div className="tool-box-card">
            <h3><IconShield size={18} color="var(--blue)"/> Checksum & Integrity Verifier</h3>
            <p style={{fontSize:13,color:'var(--muted)',lineHeight:1.6}}>
              Validate your downloaded APK against publisher hashes to ensure no tampering, corruption, or injection has occurred.
            </p>
            <div style={{marginTop:14}}>
              <input
                type="text"
                className="tool-text-input"
                placeholder="Paste SHA-256 or MD5 hash..."
                value={toolHashInput}
                onChange={e=>setToolHashInput(e.target.value)}
              />
              {toolHashInput&&(
                <div style={{marginTop:10,fontSize:12.5,padding:'8px 12px',borderRadius:8,background:'var(--panel2)'}}>
                  <span>Hash length: <b>{toolHashInput.trim().length} chars</b> — </span>
                  <span style={{fontWeight:700,color:toolHashInput.trim().length===32?'var(--green)':toolHashInput.trim().length===64?'var(--blue)':'var(--amber)'}}>
                    {toolHashInput.trim().length===32?'Valid MD5 format':toolHashInput.trim().length===64?'Valid SHA-256 format':'Awaiting 32 or 64 character hex string'}
                  </span>
                </div>
              )}
            </div>
          </div>

          <div className="tool-box-card">
            <h3><IconWrench size={18} color="var(--purple)"/> VirusTotal Multi-Engine Scanner</h3>
            <p style={{fontSize:13,color:'var(--muted)',lineHeight:1.6}}>
              Inspect APK security reports across 70+ antivirus scanners including Kaspersky, Bitdefender, Sophos, and Microsoft Defender.
            </p>
            <div style={{marginTop:14}}>
              <input
                type="text"
                className="tool-text-input"
                placeholder="Enter MD5 or SHA-256 hash to inspect..."
                value={vtHashInput}
                onChange={e=>setVtHashInput(e.target.value)}
              />
              <button
                className="primary"
                disabled={!vtHashInput.trim()}
                onClick={()=>window.open(`https://www.virustotal.com/gui/file/${encodeURIComponent(vtHashInput.trim())}`,'_blank')}
                style={{marginTop:10}}
              >
                Scan on VirusTotal
              </button>
            </div>
          </div>

          <div className="tool-box-card">
            <h3><IconBolt size={18} color="var(--green)"/> Cloudflare Streaming Resolver Latency</h3>
            <p style={{fontSize:13,color:'var(--muted)',lineHeight:1.6}}>
              Test the response time and streaming bandwidth to the APKScope edge download resolver.
            </p>
            <div style={{marginTop:14,background:'var(--panel2)',padding:14,borderRadius:10}}>
              <div style={{fontSize:12.5,marginBottom:8}}>Endpoint: <code>apkscope-resolver.apkscope.workers.dev</code></div>
              {workerPingResult&&<div style={{fontSize:13,fontWeight:700,color:'var(--green)',marginBottom:10}}>{workerPingResult}</div>}
              <button className="primary" onClick={testWorkerLatency} disabled={workerPingLoading}>
                {workerPingLoading?'Testing Latency...':'Test Edge Connection'}
              </button>
            </div>
          </div>

          <div className="tool-box-card">
            <h3><IconShield size={18} color="var(--amber)"/> Android Signature Audit Guide</h3>
            <p style={{fontSize:13,color:'var(--muted)',lineHeight:1.6}}>
              Android verifies application authenticity using four generations of cryptographic schemes:
            </p>
            <ul style={{fontSize:12.5,color:'var(--muted)',lineHeight:1.8,paddingLeft:20,margin:'8px 0'}}>
              <li><b>v1 (JAR Signature):</b> Verifies individual archive entries.</li>
              <li><b>v2 (APK Signature Scheme v2):</b> Protects entire ZIP binary integrity.</li>
              <li><b>v3 (Key Rotation):</b> Introduces key rotation history attributes.</li>
              <li><b>v4 (Streaming Signature):</b> Tree hashing for fast installation.</li>
            </ul>
            <div style={{background:'var(--panel2)',padding:10,borderRadius:8,fontSize:12,fontFamily:'monospace'}}>
              apksigner verify --verbose --print-certs app.apk
            </div>
          </div>
        </div>
      </main>
    )}

    {/* VIEW 3: APPS STORE & SEARCH (When Apps tab is active) */}
    {navTab==='apps'&&(
      <>
        {/* SPOTLIGHT HERO & STORE SEARCH */}
        <section className="store-hero">
          <div className="spotlight-banner">
            <div className="spotlight-left">
              <div className="spotlight-tag">
                <IconShield size={13} color="var(--blue)"/>
                <span>Verified Android Discovery</span>
              </div>
              <h1 className="spotlight-title">
                {t('heroTitle')} <span>{t('heroTitleSpan')}</span>
              </h1>
              <p className="spotlight-sub">
                {t('heroSub')}
              </p>
            </div>

            {/* Spotlight Featured Quick Apps with Crisp Vector Icons */}
            <div className="spotlight-cards">
              {SPOTLIGHT_APPS.map(item=>(
                <div
                  key={item.pkg}
                  className="spotlight-app"
                  onClick={()=>openDirectPkg(item.pkg,item.name)}
                  title={`View ${item.name}`}
                >
                  <div className="spotlight-icon">
                    <img src={item.icon} alt={item.name}/>
                  </div>
                  <div className="spotlight-meta">
                    <div className="spotlight-name">{item.name}</div>
                    <div className="spotlight-dev">{item.dev}</div>
                    <div className="spotlight-stat">
                      <span style={{color:'var(--amber-text)',fontWeight:700,display:'inline-flex',alignItems:'center',gap:4}}>
                        <IconStar size={12}/>
                        <span>{item.rating}</span>
                      </span>
                      <span className="spotlight-btn">GET</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Floating Centered Play Store Search Bar */}
          <div className="store-search-wrap" ref={searchWrapRef}>
            <div className="store-search">
              <div className="search-icon">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="11" cy="11" r="8"></circle>
                  <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                </svg>
              </div>
              <input
                value={q}
                onChange={e=>onQuery(e.target.value)}
                onFocus={()=>{if(sugs.length)setSugOpen(true)}}
                onKeyDown={e=>{
                  if(e.key==='ArrowDown'){
                    e.preventDefault();
                    if(sugs.length)setSugIndex(i=>Math.min(i+1,sugs.length-1));
                  }else if(e.key==='ArrowUp'){
                    e.preventDefault();
                    if(sugs.length)setSugIndex(i=>Math.max(i-1,-1));
                  }else if(e.key==='Enter'){
                    if(sugOpen&&sugIndex>=0&&sugs[sugIndex]){
                      choose(sugs[sugIndex].name);
                    }else{
                      search();
                    }
                  }else if(e.key==='Escape'){
                    setSugOpen(false);
                  }
                }}
                placeholder={t('placeholder')}
                aria-label={t('placeholder')}
              />
              {q&&<button className="search-clear" onClick={clearQuery} title={t('clearSearch')}>✕</button>}
              <button className="search-btn" id="searchBtn" onClick={search}>
                {loading?t('searching'):t('searchBtn')}
              </button>
            </div>

            {sugOpen&&sugs.length>0&&<ul className="suglist">
              {sugs.map((s,idx)=><li
                key={s.packageName}
                className={sugIndex===idx?'active':''}
                onMouseEnter={()=>setSugIndex(idx)}
                onMouseDown={e=>{e.preventDefault();choose(s.name)}}>
                <img src={isImg(s.icon)?s.icon:''} alt="" loading="lazy" onError={e=>{(e.currentTarget.style.display='none')}}/>
                <span className="sugname">{cleanTitle(s.name)}</span>
                <span className="sugpkg">{s.packageName}</span>
              </li>)}
            </ul>}
          </div>

          {/* Popular Chips Row */}
          <div className="chips-row">
            <span className="chip-label">{t('popular')}</span>
            {POPULAR.map(x=><button className="store-chip" key={x} onClick={()=>choose(x)}>{x}</button>)}
          </div>

          {recent.length>0&&!q&&!cat&&<div className="chips-row" style={{marginBottom:10}}>
            <span className="chip-label" style={{display:'inline-flex',alignItems:'center',gap:4}}>
              <IconClock size={13}/>
              <span>{t('recentTitle')}:</span>
            </span>
            {recent.map(r=><a className="store-chip" key={r.pkg} href={`/app/${encodeURIComponent(r.pkg)}?n=${encodeURIComponent(r.name)}`}>
              {cleanTitle(r.name)}
            </a>)}
          </div>}
        </section>

        {/* BROWSE CATEGORIES SELECTOR PILLS */}
        <section className="cat-rail-wrap">
          <div className="cat-pills">
            {CATS.map(c=><button
              className={`cat-pill ${cat===c.k?'on':''}`}
              key={c.k}
              onClick={()=>openCat(c.k,c.l)}
            >
              {getCatIcon(c.icon)}
              <span>{c.l}</span>
            </button>)}
          </div>
        </section>

        {/* APP STORE DISCOVERY SECTIONS (Visible when no search query is active) */}
        {isStoreDiscovery&&(
          <>
            {/* Section 1: Trending Apps Rail */}
            {trending.length>0&&(
              <section className="store-section">
                <div className="section-header">
                  <h3>
                    <IconFlame size={20} color="#f97316"/>
                    <span>{t('trendTitle')}</span>
                    <span className="section-sub">— {t('trendSub')}</span>
                  </h3>
                </div>
                <div className="apps-rail">
                  {trending.map(x=><div
                    className="app-card-rail"
                    key={x.packageName}
                    onClick={()=>choose(x.name)}
                    title={`Explore ${cleanTitle(x.name)}`}
                  >
                    <div className="app-icon-rail">
                      <img src={isImg(x.icon)?x.icon:''} alt="" loading="lazy" onError={e=>{e.currentTarget.style.display='none'}}/>
                    </div>
                    <div className="app-name-rail">{cleanTitle(x.name)}</div>
                    {x.rating&&(
                      <div className="app-rating-rail" style={{display:'inline-flex',alignItems:'center',gap:4}}>
                        <IconStar size={11}/>
                        <span>{x.rating}</span>
                      </div>
                    )}
                    <button className="app-get-rail">GET</button>
                  </div>)}
                </div>
              </section>
            )}

            {/* Section 2: Top Charts Grid (1, 2, 3...) */}
            <section className="store-section">
              <div className="section-header">
                <h3>
                  <IconTrophy size={20} color="#eab308"/>
                  <span>Top Charts & Popular Builds</span>
                  <span className="section-sub">— Most downloaded Android builds this week</span>
                </h3>
              </div>
              <div className="charts-grid">
                {(trending.length?trending.slice(0,6):SPOTLIGHT_APPS).map((item,idx)=>(
                  <div
                    className="chart-card"
                    key={item.name}
                    onClick={()=>choose(item.name)}
                  >
                    <div className={`chart-rank rank-${idx+1}`}>#{idx+1}</div>
                    <div className="chart-icon">
                      <img src={isImg(item.icon)?item.icon:''} alt="" loading="lazy" onError={e=>{e.currentTarget.style.display='none'}}/>
                    </div>
                    <div className="chart-meta">
                      <div className="chart-title">{cleanTitle(item.name)}</div>
                      <div className="chart-dev">{'dev' in item?item.dev:item.packageName}</div>
                      <div className="chart-rating" style={{display:'inline-flex',alignItems:'center',gap:4}}>
                        <IconStar size={11}/>
                        <span>{'rating' in item?item.rating:'4.6'} • Free</span>
                      </div>
                    </div>
                    <button className="chart-btn">GET</button>
                  </div>
                ))}
              </div>
            </section>
          </>
        )}

        {/* MAIN CONTENT AREA: SEARCH RESULTS & PRODUCT DETAIL */}
        {(!isStoreDiscovery||q||cat||results.length>0)&&(
          <main className="content" id="apps">
            {/* Left Column: Store Filters */}
            <aside className="panel filters">
              <div className="filtersection">
                <div className="filterhead" onClick={()=>setOpenSources(o=>!o)}>
                  <span>{t('filterSources')}</span>
                  <span className={`chevron ${openSources?'open':''}`}>›</span>
                </div>
                {openSources&&<div className="filterbody">
                  <label className="check">
                    <input type="checkbox" checked={allOn} onChange={e=>{const v=e.target.checked;setChecked(Object.fromEntries(SOURCE_LIST.map(s=>[s,v])))}}/>
                    <span>{t('allSources')}</span>
                    <span className="badge-count">{results.length}</span>
                  </label>
                  {SOURCE_LIST.map(s=><label className="check" key={s}>
                    <input type="checkbox" checked={checked[s]!==false} onChange={e=>setChecked(c=>({...c,[s]:e.target.checked}))}/>
                    <span>{s}</span>
                    <span className="badge-count">{counts[s]||0}</span>
                  </label>)}
                </div>}
              </div>

              <div className="filtersection filtergroup">
                <label className="check" style={{fontWeight:700,color:'var(--green)'}}>
                  <input type="checkbox" checked={directOnly} onChange={e=>setDirectOnly(e.target.checked)}/>
                  <span style={{display:'inline-flex',alignItems:'center',gap:4}}>
                    <IconBolt size={14}/>
                    <span>{t('directOnly')}</span>
                  </span>
                </label>
              </div>

              <div className="filtersection filtergroup">
                <div className="filterhead" onClick={()=>setOpenPlatform(o=>!o)}>
                  <span>{t('platform')}</span>
                  <span className={`chevron ${openPlatform?'open':''}`}>›</span>
                </div>
                {openPlatform&&<div className="filterbody">
                  <label className="check"><input type="checkbox" defaultChecked readOnly/> <span>{t('android')}</span></label>
                  <label className="check" style={{opacity:.5}} title="iOS builds are not tracked">
                    <input type="checkbox" disabled/>
                    <span>{t('ios')}</span>
                    <span className="badge-count">n/a</span>
                  </label>
                </div>}
              </div>

              <div className="filtersection filtergroup">
                <div className="filterhead" onClick={()=>setOpenSort(o=>!o)}>
                  <span>{t('sortBy')}</span>
                  <span className={`chevron ${openSort?'open':''}`}>›</span>
                </div>
                {openSort&&<div className="filterbody">
                  <label className="check"><input type="radio" name="s" checked={sort==='relevance'} onChange={()=>{setSort('relevance');setVisible(PAGE_SIZE)}}/> <span>{t('relevance')}</span></label>
                  <label className="check"><input type="radio" name="s" checked={sort==='version'} onChange={()=>{setSort('version');setVisible(PAGE_SIZE)}}/> <span>{t('latestVersion')}</span></label>
                  <label className="check"><input type="radio" name="s" checked={sort==='name'} onChange={()=>{setSort('name');setVisible(PAGE_SIZE)}}/> <span>{t('nameAZ')}</span></label>
                </div>}
              </div>
            </aside>

            {/* Center Column: Results List */}
            <section className="panel results">
              <div className="resultshead">
                <strong>{cat?`${t('catTitle')}: ${catLabel}`:`${t('resultsFor')} “${q||'…'}”`}</strong>
                <span style={{fontSize:12,color:'var(--muted)'}}>{listLen} {listLen===1?t('result'):t('results')}</span>
              </div>

              {cat&&<div className="cat-pill on" style={{cursor:'pointer',marginBottom:10,display:'inline-flex'}} onClick={()=>openCat(cat,catLabel)}>✕ {catLabel}</div>}

              {cat?(
                browseLoading?<div className="empty">{t('searchingSources')}</div>
                :browse.slice(0,visible).map(b=><div className="resultcard" key={b.packageName} onClick={()=>pickBrowse(b)}>
                  <div className="appicon">{isImg(b.icon)?<img src={b.icon} alt="" loading="lazy"/>:b.name.slice(0,1).toUpperCase()}</div>
                  <div className="resultmeta">
                    <strong>{cleanTitle(b.name)}</strong>
                    <small>{b.packageName}</small>
                    <div className="badges">
                      {b.rating&&<span className="badge" style={{display:'inline-flex',alignItems:'center',gap:3}}><IconStar size={11}/> {b.rating}</span>}
                      {b.downloads&&<span className="badge">{b.downloads}</span>}
                      <span className="badge">Android</span>
                      <span className="badge">APKCombo</span>
                    </div>
                  </div>
                  <span className="arrow">›</span>
                </div>)
              ):shown.slice(0,visible).map((a,i)=><div className={`resultcard ${selected===a?'active':''}`} key={`${a.packageName}-${i}`} onClick={()=>pickApp(a)}>
                <div className="appicon">{isImg(a.icon)?<img src={a.icon} alt="" loading="lazy"/>:a.name.slice(0,1).toUpperCase()}</div>
                <div className="resultmeta">
                  <strong>{cleanTitle(a.name)}</strong>
                  <small>{a.packageName}</small>
                  <div className="badges">
                    <span className="badge">{a.version==='—'?'Latest':a.version}</span>
                    <span className="badge">Android</span>
                    <span className="badge srcbadge">{a.source}</span>
                    {a.download&&<span className="badge dl">APK</span>}
                  </div>
                </div>
                <span className="arrow">›</span>
              </div>)}

              {hasMore&&<button className="loadmore" onClick={()=>setVisible(v=>v+PAGE_SIZE)} disabled={loading||browseLoading}>
                {t('loadMore')} · {Math.min(visible,listLen)}/{listLen}
              </button>}

              {loading&&<div className="empty">{t('searchingSources')}</div>}
              {error&&<div className="notice err">{error}</div>}
              {!cat&&!loading&&!shown.length&&<div className="empty">{results.length?t('noResultsFilter'):t('noResultsYet')}</div>}
              <div className="notice">{t('notice')}</div>
            </section>

            {/* Right Column: App Store Product Page Panel */}
            {selected?(
              <AppDetailPanel
                app={selected}
                versions={versions}
                verLoading={verLoading}
                detail={detail}
                detailLoading={detailLoading}
              />
            ):(
              <section className="panel detail" id="detailView">
                <div className="empty">{t('detailEmpty')}</div>
              </section>
            )}
          </main>
        )}
      </>
    )}
  </div>;
}
