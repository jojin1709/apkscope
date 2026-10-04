'use client';
import {useState,useMemo,useEffect,useRef} from 'react';
import {useUI} from '../components/Providers';
import {AppDetailPanel} from '../components/AppDetail';
import type {App,AppDetail,BrowseItem,Suggest,Version} from '../lib/types';

type Sort='relevance'|'version'|'name';
const PAGE_SIZE=8;
const PKG_RE=/^[a-zA-Z]\w*(\.\w+)+$/;
const SOURCE_LIST=['APKMirror','Google Play','Aptoide','APKCombo','TapTap'];
const POPULAR=['WhatsApp','Instagram','Telegram','PayPal','Netflix','Minecraft'];
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

  // Close suggestions when clicking outside
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
    // Mobile smooth scroll
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

  // Sync selected app when filters change
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

  return <div className="shell">
    <section className="hero">
      <div>
        <h1>{t('heroTitle')} <span>{t('heroTitleSpan')}</span></h1>
        <p>{t('heroSub')}</p>
        <div className="searchwrap" ref={searchWrapRef}>
          <div className="search">
            <span className="search-icon">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8"></circle>
                <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
              </svg>
            </span>
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
            <button id="searchBtn" onClick={search}>
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

        <div className="chips">
          <span style={{fontSize:12.5,color:'var(--muted)',fontWeight:600}}>{t('popular')}</span>
          {POPULAR.map(x=><button className="chip" key={x} onClick={()=>choose(x)}>{x}</button>)}
        </div>

        {recent.length>0&&!q&&!cat&&<div className="recentrow">
          <span className="recentlabel">🕑 {t('recentTitle')}</span>
          {recent.map(r=><a className="recentchip" key={r.pkg} href={`/app/${encodeURIComponent(r.pkg)}?n=${encodeURIComponent(r.name)}`}>
            {isImg(r.icon)?<img src={r.icon} alt=""/>:null}{r.name}
          </a>)}
        </div>}
      </div>

      <div className="benefits">
        <div className="benefit">
          <div className="icon">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="2" y="3" width="20" height="14" rx="2" ry="2"></rect>
              <line x1="8" y1="21" x2="16" y2="21"></line>
              <line x1="12" y1="17" x2="12" y2="21"></line>
            </svg>
          </div>
          <strong>{t('ben1')}</strong>
          <span>{t('ben1d')}</span>
        </div>
        <div className="benefit">
          <div className="icon">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
            </svg>
          </div>
          <strong>{t('ben2')}</strong>
          <span>{t('ben2d')}</span>
        </div>
        <div className="benefit">
          <div className="icon">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
              <polyline points="22 4 12 14.01 9 11.01"></polyline>
            </svg>
          </div>
          <strong>{t('ben3')}</strong>
          <span>{t('ben3d')}</span>
        </div>
      </div>
    </section>

    <section className="browsebar" id="sources">
      <div className="striphead"><strong>{t('catTitle')}</strong><span>{t('catSub')}</span></div>
      <div className="catchips">
        {CATS.map(c=><button className={`catchip ${cat===c.k?'on':''}`} key={c.k} onClick={()=>openCat(c.k,c.l)}>{c.l}</button>)}
      </div>
    </section>

    {!q&&!cat&&trending.length>0&&<section className="strip">
      <div className="striphead"><strong>{t('trendTitle')}</strong><span>{t('trendSub')}</span></div>
      <div className="striprail">
        {trending.map(x=><a className="trendcard" key={x.packageName} href={`/app/${encodeURIComponent(x.packageName)}?n=${encodeURIComponent(x.name)}`}>
          <img src={isImg(x.icon)?x.icon:''} alt="" loading="lazy" onError={e=>{e.currentTarget.classList.add('noimg')}}/>
          <span className="trendname">{x.name}</span>
          {x.rating&&<span className="trendrating">★ {x.rating}</span>}
        </a>)}
      </div>
    </section>}

    <main className="content" id="apps">
      {/* Filters Sidebar */}
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
          <label className="check" style={{fontWeight:650,color:'var(--blue)'}}>
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

      {/* Results Center Column */}
      <section className="panel results" id="tools">
        <div className="resultshead">
          <strong>{cat?`${t('catTitle')}: ${catLabel}`:`${t('resultsFor')} “${q||'…'}”`}</strong>
          <span style={{fontSize:12,color:'var(--muted)'}}>{listLen} {listLen===1?t('result'):t('results')}</span>
        </div>

        {cat&&<div className="catchip on" style={{cursor:'pointer',marginBottom:10,display:'inline-block'}} onClick={()=>openCat(cat,catLabel)}>✕ {catLabel}</div>}

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
              {a.download&&<span className="badge dl">↓ APK</span>}
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

      {/* Detail Right Column */}
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
  </div>;
}
