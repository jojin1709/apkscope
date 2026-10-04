'use client';
import {useState,useMemo,useEffect,useRef} from 'react';
import {useUI} from '../components/Providers';
import {AppDetailPanel} from '../components/AppDetail';
import type {App,AppDetail,BrowseItem,Suggest,Version} from '../lib/types';

type Sort='relevance'|'version'|'name';
const PAGE_SIZE=8;
const PKG_RE=/^[a-zA-Z]\w*(\.\w+)+$/;
const SOURCE_LIST=['APKMirror','Google Play','Aptoide','APKCombo','TapTap','F-Droid'];
const POPULAR=['WhatsApp','Instagram','Telegram','Spotify','PayPal','Minecraft','Termux','F-Droid'];

const CATS=[
  {k:'trending',l:'🔥 Trending'},
  {k:'games',l:'🎮 Games'},
  {k:'social',l:'💬 Social'},
  {k:'tools',l:'🛠 Tools'},
  {k:'productivity',l:'📈 Productivity'},
  {k:'photography',l:'📷 Photos'},
  {k:'music-and-audio',l:'🎵 Music'},
  {k:'video-players',l:'🎬 Video'},
  {k:'communication',l:'✉️ Communication'},
  {k:'entertainment',l:'🎭 Fun'}
];

// Curated Spotlight Apps for App Store / Play Store feel
const SPOTLIGHT_APPS=[
  {
    name:'Telegram',
    pkg:'org.telegram.messenger',
    dev:'Telegram FZ-LLC',
    rating:'4.8',
    icon:'https://play-lh.googleusercontent.com/ZU9AnVdpVguAPrwnhOTaAhBaNdutvdaZ3nhPqdaRJ46ZiSaTueFuVuNq0XOBC3qDEg=s96'
  },
  {
    name:'Spotify: Music and Podcasts',
    pkg:'com.spotify.music',
    dev:'Spotify AB',
    rating:'4.4',
    icon:'https://play-lh.googleusercontent.com/cShys-AmJ93dB0SV8kE6Fl5eSaf4-qMMZdwEDIE5VFlKMisdxng-mX7n4mQ0vNoxCQ=s96'
  },
  {
    name:'Signal Private Messenger',
    pkg:'org.thoughtcrime.securesms',
    dev:'Signal Foundation',
    rating:'4.7',
    icon:'https://play-lh.googleusercontent.com/iLdQY2_pQ9LgI_k8sH7wH9d2Xb2m7Xk6Z5=s96'
  },
  {
    name:'Termux',
    pkg:'com.termux',
    dev:'Fredrik Fornwall',
    rating:'4.6',
    icon:'https://play-lh.googleusercontent.com/w1u0i8kL9k4D5X=s96'
  }
];

const isImg=(s?:string)=>!!s&&/^https?:\/\//.test(s);

function verKey(v:string){
  const p=(v||'').match(/\d+/g);
  return p?p.map(n=>n.padStart(9,'0')).join(''):'';
}

type Recent={name:string;pkg:string;icon:string};

export default function Home(){
  const {t}=useUI();
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
        history.replaceState(null,'',`?q=${encodeURIComponent(query)}${selectedPkg?`&pkg=${encodeURIComponent(selectedPkg)}`:''}`);
      }catch{}
    }
  }

  function search(){runSearch(q)}

  function clearQuery(){
    setQ('');
    setSugs([]);
    setSugOpen(false);
    try{history.replaceState(null,'',location.pathname)}catch{}
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
    if(cat===k){
      setCat('');
      setBrowse([]);
      try{history.replaceState(null,'',location.pathname)}catch{}
      return;
    }
    setCat(k);
    setCatLabel(label);
    setBrowseLoading(true);
    setSelected(null);
    setDetail(null);
    setVisible(PAGE_SIZE);
    setQ('');
    try{history.replaceState(null,'',location.pathname)}catch{}
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

  // Is store discovery active (no search query & no category filter)
  const isStoreDiscovery=!q&&!cat&&results.length===0;

  return <div className="shell">
    {/* SPOTLIGHT HERO & STORE SEARCH */}
    <section className="store-hero">
      {/* App Store Spotlight Featured Banner */}
      <div className="spotlight-banner">
        <div className="spotlight-left">
          <div className="spotlight-tag">
            <span style={{fontSize:12}}>⚡</span>
            <span>Verified Android Discovery</span>
          </div>
          <h1 className="spotlight-title">
            {t('heroTitle')} <span>{t('heroTitleSpan')}</span>
          </h1>
          <p className="spotlight-sub">
            {t('heroSub')}
          </p>
        </div>

        {/* Spotlight Featured Quick Apps */}
        <div className="spotlight-cards">
          {SPOTLIGHT_APPS.map(item=>(
            <div
              key={item.pkg}
              className="spotlight-app"
              onClick={()=>openDirectPkg(item.pkg,item.name)}
              title={`View ${item.name}`}
            >
              <div className="spotlight-icon">
                {isImg(item.icon)?<img src={item.icon} alt={item.name}/>:item.name.slice(0,1)}
              </div>
              <div className="spotlight-meta">
                <div className="spotlight-name">{item.name}</div>
                <div className="spotlight-dev">{item.dev}</div>
                <div className="spotlight-stat">
                  <span style={{color:'var(--amber-text)',fontWeight:700}}>★ {item.rating}</span>
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
            <span className="sugname">{s.name}</span>
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
        <span className="chip-label">🕑 {t('recentTitle')}:</span>
        {recent.map(r=><a className="store-chip" key={r.pkg} href={`/app/${encodeURIComponent(r.pkg)}?n=${encodeURIComponent(r.name)}`}>
          {isImg(r.icon)?<img src={r.icon} alt="" style={{width:16,height:16,borderRadius:'50%'}}/>:null}
          {r.name}
        </a>)}
      </div>}
    </section>

    {/* BROWSE CATEGORIES SELECTOR PILLS */}
    <section className="cat-rail-wrap" id="sources">
      <div className="cat-pills">
        {CATS.map(c=><button
          className={`cat-pill ${cat===c.k?'on':''}`}
          key={c.k}
          onClick={()=>openCat(c.k,c.l)}
        >
          {c.l}
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
                <span>🔥</span>
                <span>{t('trendTitle')}</span>
                <span className="section-sub">— {t('trendSub')}</span>
              </h3>
            </div>
            <div className="apps-rail">
              {trending.map(x=><div
                className="app-card-rail"
                key={x.packageName}
                onClick={()=>choose(x.name)}
                title={`Explore ${x.name}`}
              >
                <div className="app-icon-rail">
                  <img src={isImg(x.icon)?x.icon:''} alt="" loading="lazy" onError={e=>{e.currentTarget.style.display='none'}}/>
                </div>
                <div className="app-name-rail">{x.name}</div>
                {x.rating&&<div className="app-rating-rail">★ {x.rating}</div>}
                <button className="app-get-rail">GET</button>
              </div>)}
            </div>
          </section>
        )}

        {/* Section 2: Top Charts Grid (1, 2, 3...) */}
        <section className="store-section" id="tools">
          <div className="section-header">
            <h3>
              <span>🏆</span>
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
                <div className="chart-rank">#{idx+1}</div>
                <div className="chart-icon">
                  <img src={isImg(item.icon)?item.icon:''} alt="" loading="lazy"/>
                </div>
                <div className="chart-meta">
                  <div className="chart-title">{item.name}</div>
                  <div className="chart-dev">{'dev' in item?item.dev:item.packageName}</div>
                  <div className="chart-rating">★ {'rating' in item?item.rating:'4.6'} • Free</div>
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
              <span>⚡ {t('directOnly')}</span>
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
                <strong>{b.name}</strong>
                <small>{b.packageName}</small>
                <div className="badges">
                  {b.rating&&<span className="badge">★ {b.rating}</span>}
                  {b.downloads&&<span className="badge">↓ {b.downloads}</span>}
                  <span className="badge">☁ Android</span>
                  <span className="badge">APKCombo</span>
                </div>
              </div>
              <span className="arrow">›</span>
            </div>)
          ):shown.slice(0,visible).map((a,i)=><div className={`resultcard ${selected===a?'active':''}`} key={`${a.packageName}-${i}`} onClick={()=>pickApp(a)}>
            <div className="appicon">{isImg(a.icon)?<img src={a.icon} alt="" loading="lazy"/>:a.name.slice(0,1).toUpperCase()}</div>
            <div className="resultmeta">
              <strong>{a.name}</strong>
              <small>{a.packageName}</small>
              <div className="badges">
                <span className="badge">{a.version==='—'?'Latest':a.version}</span>
                <span className="badge">☁ Android</span>
                <span className="badge srcbadge">{a.source}</span>
                {a.download&&<span className="badge dl">✓ APK</span>}
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
  </div>;
}
