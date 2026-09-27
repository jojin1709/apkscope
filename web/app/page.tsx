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
  const [sort,setSort]=useState<Sort>('relevance');
  const [versions,setVersions]=useState<Version[]>([]);
  const [verLoading,setVerLoading]=useState(false);
  const [detail,setDetail]=useState<AppDetail|null>(null);
  const [detailLoading,setDetailLoading]=useState(false);
  const [visible,setVisible]=useState(PAGE_SIZE);
  const [sugs,setSugs]=useState<Suggest[]>([]);
  const [sugOpen,setSugOpen]=useState(false);
  const [cat,setCat]=useState('');
  const [catLabel,setCatLabel]=useState('');
  const [browse,setBrowse]=useState<BrowseItem[]>([]);
  const [browseLoading,setBrowseLoading]=useState(false);
  const [trending,setTrending]=useState<BrowseItem[]>([]);
  const [recent,setRecent]=useState<Recent[]>([]);
  const [error,setError]=useState('');
  const sugTimer=useRef<ReturnType<typeof setTimeout>|null>(null);
  const resolvedRef=useRef<Set<string>>(new Set());

  function loadRecent(){
    try{
      const raw=JSON.parse(localStorage.getItem('apkscope:recent')||'[]');
      setRecent(Array.isArray(raw)?raw.slice(0,8):[]);
    }catch{}
  }

  async function runSearch(value:string){
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
      if(found.length&&found[0].packageName!=='Search supported providers')setSelected(found[0]);
    }catch{
      setResults([]);
      setError(t('rateLimited'));
    }finally{
      setLoading(false);
      try{history.replaceState(null,'',`?q=${encodeURIComponent(query)}`)}catch{}
    }
  }

  function search(){runSearch(q)}

  function choose(x:string){
    setQ(x);
    setSugOpen(false);
    runSearch(x);
  }

  function onQuery(v:string){
    setQ(v);
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
    },300);
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

  function pickBrowse(b:BrowseItem){
    setSelected({
      name:b.name,
      packageName:b.packageName,
      version:'—',
      source:'APKCombo',
      category:['Android'],
      icon:b.icon,
      sourcePage:b.sourcePage,
      variants:[]
    });
    setDetail(null);
    setVersions([]);
  }

  useEffect(()=>{
    const p=new URLSearchParams(window.location.search).get('q');
    if(p){setQ(p);runSearch(p)}
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
    if(sort==='name')list=[...list].sort((a,b)=>a.name.localeCompare(b.name));
    else if(sort==='version')list=[...list].sort((a,b)=>verKey(b.version).localeCompare(verKey(a.version)));
    return list;
  },[results,checked,sort]);

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
          return{...item,download:m.download,
            size:item.size||m.size||0,
            md5:item.md5||m.md5||'',
            signer:item.signer||m.signer||'',
            rank:item.rank||m.rank||'',
            store:item.store||m.store||'',
            version:(!item.version||item.version==='—'||item.version==='See source')&&m.version?m.version:item.version};
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
        <div className="searchwrap">
          <div className="search">
            <span style={{padding:'16px 0 16px 14px',color:'var(--muted)'}}>⌕</span>
            <input
              value={q}
              onChange={e=>onQuery(e.target.value)}
              onFocus={()=>{if(sugs.length)setSugOpen(true)}}
              onKeyDown={e=>{
                if(e.key==='Enter'){
                  if(sugOpen&&sugs.length&&q.trim().length>=2)choose(sugs[0].name);
                  else search();
                }
                if(e.key==='Escape')setSugOpen(false);
              }}
              placeholder={t('placeholder')}
              aria-label={t('placeholder')}
            />
            <button id="searchBtn" onClick={search}>{loading?t('searching'):t('searchBtn')}</button>
          </div>
          {sugOpen&&sugs.length>0&&<ul className="suglist">
            {sugs.map(s=><li key={s.packageName}
              onMouseDown={e=>{e.preventDefault();choose(s.name)}}>
              <img src={isImg(s.icon)?s.icon:''} alt="" loading="lazy" onError={e=>{(e.currentTarget.style.display='none')}}/>
              <span className="sugname">{s.name}</span>
              <span className="sugpkg">{s.packageName}</span>
            </li>)}
          </ul>}
        </div>
        <div className="chips">
          <span style={{fontSize:13,color:'var(--muted)',padding:'7px 2px'}}>{t('popular')}</span>
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
        <div className="benefit"><div className="icon">⌕</div><strong>{t('ben1')}</strong><span>{t('ben1d')}</span></div>
        <div className="benefit"><div className="icon">ϟ</div><strong>{t('ben2')}</strong><span>{t('ben2d')}</span></div>
        <div className="benefit"><div className="icon">✓</div><strong>{t('ben3')}</strong><span>{t('ben3d')}</span></div>
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
      <aside className="panel filters">
        <div className="filtertitle">{t('filterSources')}</div>
        <div className="check">
          <input type="checkbox" checked={allOn} onChange={e=>{const v=e.target.checked;setChecked(Object.fromEntries(SOURCE_LIST.map(s=>[s,v])))}}/>
          {t('allSources')} <span style={{marginLeft:'auto'}}>{results.length}</span>
        </div>
        {SOURCE_LIST.map(s=><div className="check" key={s}>
          <input type="checkbox" checked={checked[s]!==false} onChange={e=>setChecked(c=>({...c,[s]:e.target.checked}))}/>
          {s} <span style={{marginLeft:'auto'}}>{counts[s]||0}</span>
        </div>)}
        <div className="filtergroup">
          <div className="filtertitle">{t('platform')}</div>
          <div className="check"><input type="checkbox" defaultChecked readOnly/> {t('android')}</div>
          <div className="check" style={{opacity:.55}} title="iOS builds are not tracked"><input type="checkbox" disabled/> {t('ios')} <span style={{marginLeft:'auto',fontSize:12}}>n/a</span></div>
        </div>
        <div className="filtergroup">
          <div className="filtertitle">{t('sortBy')}</div>
          <div className="check"><input type="radio" name="s" checked={sort==='relevance'} onChange={()=>{setSort('relevance');setVisible(PAGE_SIZE)}}/> {t('relevance')}</div>
          <div className="check"><input type="radio" name="s" checked={sort==='version'} onChange={()=>{setSort('version');setVisible(PAGE_SIZE)}}/> {t('latestVersion')}</div>
          <div className="check"><input type="radio" name="s" checked={sort==='name'} onChange={()=>{setSort('name');setVisible(PAGE_SIZE)}}/> {t('nameAZ')}</div>
        </div>
      </aside>

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
        ):shown.slice(0,visible).map((a,i)=><div className={`resultcard ${selected===a?'active':''}`} key={`${a.packageName}-${i}`} onClick={()=>setSelected(a)}>
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

      {selected?(
        <AppDetailPanel
          app={selected}
          versions={versions}
          verLoading={verLoading}
          detail={detail}
          detailLoading={detailLoading}
        />
      ):(
        <section className="panel detail">
          <div className="empty">{t('detailEmpty')}</div>
        </section>
      )}
    </main>
  </div>;
}
