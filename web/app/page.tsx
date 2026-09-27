'use client';
import {useState,useMemo,useEffect} from 'react';

type Variant={label:string;architecture:string;android:string;dpi:string;format:string;download:string};
type App={
  name:string;
  packageName:string;
  version:string;
  source:string;
  category:string[];
  variants:Variant[];
  sourcePage:string;
  playUrl?:string;
  icon:string;
  download?:string;
  size?:number;
  md5?:string;
  rank?:string;
  store?:string;
  signer?:string;
};

const suggestions=['WhatsApp','Instagram','Telegram','Shop Apotheke','PayPal','Netflix'];
const SOURCE_LIST=['APKMirror','Google Play','Aptoide','TapTap'];
type Sort='relevance'|'version'|'name';
type Version={version:string;size:number;md5:string;date:string;src:string;download:string};
const PKG_RE=/^[a-zA-Z]\w*(\.\w+)+$/;

function makeFallback(q:string):App[]{
  const x=q.trim();
  if(!x)return[];
  return[{name:x,packageName:'Search across supported sources',version:'—',source:'Provider search',category:['Android'],icon:'',sourcePage:`https://www.apkmirror.com/?post_type=app_release&searchtype=apk&s=${encodeURIComponent(x)}`,variants:[]}];
}

function fmtSize(n?:number){
  if(!n)return '';
  const mb=n/1048576;
  return mb>=1?`${mb.toFixed(1)} MB`:`${Math.max(1,Math.round(n/1024))} KB`;
}

function verKey(v:string){
  const p=(v||'').match(/\d+/g);
  return p?p.map(n=>n.padStart(9,'0')).join(''):'';
}

const isImg=(s:string)=>/^https?:\/\//.test(s);

export default function Home(){
  const [q,setQ]=useState('');
  const [results,setResults]=useState<App[]>([]);
  const [selected,setSelected]=useState<App|null>(null);
  const [loading,setLoading]=useState(false);
  const [checked,setChecked]=useState<Record<string,boolean>>({APKMirror:true,'Google Play':true,Aptoide:true,TapTap:true});
  const [sort,setSort]=useState<Sort>('relevance');
  const [versions,setVersions]=useState<Version[]>([]);
  const [verLoading,setVerLoading]=useState(false);

  async function runSearch(value:string){
    if(!value)return;
    setLoading(true);
    setSelected(null);
    try{
      const r=await fetch(`/api/search?q=${encodeURIComponent(value)}`);
      const data=await r.json();
      const apps:Array<App>=data.results?.length?data.results:makeFallback(value);
      setResults(apps);
      setSelected(apps[0]||null);
    }catch{
      const apps=makeFallback(value);
      setResults(apps);
      setSelected(apps[0]||null);
    }finally{
      setLoading(false);
      try{history.replaceState(null,'',`?q=${encodeURIComponent(value)}`)}catch{}
    }
  }

  function search(){runSearch(q.trim())}

  function choose(x:string){
    setQ(x);
    runSearch(x);
  }

  useEffect(()=>{
    const p=new URLSearchParams(window.location.search).get('q');
    if(p){setQ(p);runSearch(p)}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  },[]);

  useEffect(()=>{
    const s=selected;
    setVersions([]);
    if(!s||!PKG_RE.test(s.packageName)){setVerLoading(false);return}
    let cancel=false;
    setVerLoading(true);
    fetch(`/api/versions?pkg=${encodeURIComponent(s.packageName)}`)
      .then(r=>r.json())
      .then(d=>{if(!cancel){setVersions(Array.isArray(d.versions)?d.versions:[]);setVerLoading(false)}})
      .catch(()=>{if(!cancel)setVerLoading(false)});
    return()=>{cancel=true};
  },[selected]);

  const counts=useMemo(()=>{
    const c:Record<string,number>={};
    results.forEach(r=>{c[r.source]=(c[r.source]||0)+1});
    return c;
  },[results]);

  const allOn=SOURCE_LIST.every(s=>checked[s]);

  const shown=useMemo(()=>{
    let list=results.filter(r=>r.source==='Provider search'||checked[r.source]!==false);
    if(sort==='name')list=[...list].sort((a,b)=>a.name.localeCompare(b.name));
    else if(sort==='version')list=[...list].sort((a,b)=>verKey(b.version).localeCompare(verKey(a.version)));
    return list;
  },[results,checked,sort]);

  return <div className="shell">
    <header className="nav">
      <div className="logo">APK<span>Scope</span></div>
      <nav className="navlinks"><a href="#apps">Apps</a><a href="#sources">Sources</a><a href="#tools">Tools</a><a href="#about">About</a></nav>
      <div className="navright"><span className="pill">⚡ No Login&nbsp; • &nbsp;Free&nbsp; • &nbsp;For Researchers</span></div>
    </header>

    <section className="hero">
      <div>
        <h1>Find Android Apps for <span>Security Research</span></h1>
        <p>Search apps across APKMirror, Google Play and Aptoide. Get package names, versions, sizes, signing details and direct download links — no login, no account.</p>
        <div className="search">
          <span style={{padding:'16px 0 16px 14px',color:'#64748b'}}>⌕</span>
          <input value={q} onChange={e=>setQ(e.target.value)} onKeyDown={e=>{if(e.key==='Enter')search()}} placeholder="Search apps, package names..."/>
          <button id="searchBtn" onClick={search}>{loading?'Searching…':'Search'}</button>
        </div>
        <div className="chips">
          <span style={{fontSize:13,color:'#64748b',padding:'7px 2px'}}>Popular:</span>
          {suggestions.map(x=><button className="chip" key={x} onClick={()=>choose(x)}>{x}</button>)}
        </div>
      </div>
      <div className="benefits">
        <div className="benefit"><div className="icon">⌕</div><strong>Multiple Sources</strong><span>APKMirror, Google Play and Aptoide</span></div>
        <div className="benefit"><div className="icon">ϟ</div><strong>Exact Versions</strong><span>Version, size, checksum and signer per build</span></div>
        <div className="benefit"><div className="icon">✓</div><strong>No Login</strong><span>Search and download without an account</span></div>
      </div>
    </section>

    <main className="content" id="apps">
      <aside className="panel filters">
        <div className="filtertitle">Sources⌄</div>
        <div className="check">
          <input type="checkbox" checked={allOn} onChange={e=>{const v=e.target.checked;setChecked({APKMirror:v,'Google Play':v,Aptoide:v,TapTap:v})}}/>
          All Sources <span style={{marginLeft:'auto'}}>{results.length}</span>
        </div>
        {SOURCE_LIST.map(s=><div className="check" key={s}>
          <input type="checkbox" checked={checked[s]!==false} onChange={e=>setChecked(c=>({...c,[s]:e.target.checked}))}/>
          {s} <span style={{marginLeft:'auto'}}>{counts[s]||0}</span>
        </div>)}
        <div className="filtergroup">
          <div className="filtertitle">Platform⌄</div>
          <div className="check"><input type="checkbox" defaultChecked readOnly/> Android</div>
          <div className="check" style={{opacity:.55}} title="iOS builds are not tracked"><input type="checkbox" disabled/> iOS <span style={{marginLeft:'auto',fontSize:12}}>n/a</span></div>
        </div>
        <div className="filtergroup">
          <div className="filtertitle">Sort By</div>
          <div className="check"><input type="radio" name="s" checked={sort==='relevance'} onChange={()=>setSort('relevance')}/> Relevance</div>
          <div className="check"><input type="radio" name="s" checked={sort==='version'} onChange={()=>setSort('version')}/> Latest Version</div>
          <div className="check"><input type="radio" name="s" checked={sort==='name'} onChange={()=>setSort('name')}/> Name (A-Z)</div>
        </div>
      </aside>

      <section className="panel results">
        <div className="resultshead">
          <strong>Search results for “{q || '…'}”</strong>
          <span style={{fontSize:12,color:'#64748b'}}>{shown.length} result{shown.length!==1?'s':''}</span>
        </div>
        {shown.map((a,i)=><div className={`resultcard ${selected===a?'active':''}`} key={i} onClick={()=>setSelected(a)}>
          <div className="appicon">{isImg(a.icon)?<img src={a.icon} alt="" loading="lazy"/>:a.name.slice(0,1).toUpperCase()}</div>
          <div className="resultmeta">
            <strong>{a.name}</strong>
            <small>{a.packageName}</small>
            <div className="badges">
              <span className="badge">{a.version==='—'?'Latest':a.version}</span>
              <span className="badge">☁ Android</span>
              {a.download&&<span className="badge dl">↓ APK</span>}
            </div>
          </div>
          <span className="arrow">›</span>
        </div>)}
        {loading&&<div className="empty">Searching sources…</div>}
        {!loading&&!shown.length&&<div className="empty">{results.length?'No results match the selected filters.':'Search for an app to see sources, versions and package names.'}</div>}
        <div className="notice">Every “↓ Download” button streams the APK through APKScope’s own resolver — the file downloads straight to your device and no other site opens. “Open” buttons visit the original listing. Always verify the package name, signature and checksum before installing.</div>
      </section>

      <section className="panel detail">
        {!selected&&!loading&&<div className="empty">Search or select a result to view versions, package details and download links.</div>}
        {selected&&<>
          <div className="detailtop">
            <div className="bigicon">{isImg(selected.icon)?<img src={selected.icon} alt=""/>:selected.name.slice(0,1).toUpperCase()}</div>
            <div>
              <h2>{selected.name} <span className="badge">☁ Android</span></h2>
              <div className="package">{selected.packageName}</div>
              {selected.signer&&<div className="package" style={{fontSize:12,marginTop:3}}>Signed by {selected.signer}</div>}
              <div className="tagrow">
                {selected.category.map(x=><span className="tag" key={x}>{x}</span>)}
                {selected.rank&&<span className="tag" style={{background:'#e8fff3',color:'#087443'}}>🛡 {selected.rank}</span>}
                {selected.store&&<span className="tag" style={{background:'#fff8e8',color:'#765b12'}}>Store: {selected.store}</span>}
              </div>
            </div>
            <div className="detailaction" style={{display:'flex',gap:10,alignItems:'center',flexWrap:'wrap'}}>
              {selected.download&&<a className="dlbtn" href={selected.download}>↓ Download APK{selected.size?` (${fmtSize(selected.size)})`:''}</a>}
              {selected.sourcePage&&<a className="primary" href={selected.sourcePage} target="_blank" rel="noreferrer">Open on {selected.source} ↗</a>}
              {selected.playUrl&&selected.playUrl!==selected.sourcePage&&<a className="chip" style={{padding:'12px 18px'}} href={selected.playUrl} target="_blank" rel="noreferrer">▶ Play Store</a>}
            </div>
          </div>

          <div className="tabs"><div className="tab active">Download &amp; Versions</div></div>

          <div style={{display:'flex',alignItems:'center'}}>
            <div>
              <h3 style={{margin:'0 0 4px'}}>All Versions</h3>
              <div style={{fontSize:12,color:'#64748b'}}>Every available build with size, checksum and release date.</div>
            </div>
          </div>

          <div className="version">
            <div className="versionhead">
              <strong>{versions[0]?.version||(selected.version==='—'?'Latest':selected.version)}</strong>
              <span className="latest">{verLoading?'Loading versions…':versions.length>1?`★ ${versions.length} versions`:versions.length===1?'★ 1 version':'★ Latest'}</span>
              <span className="source">{selected.store||selected.source}</span>
            </div>
            <div className="variant head">
              <span>Version</span><span>Size</span><span className="md5">MD5</span><span className="android">Date</span><span className="type">Source</span><span>Download</span>
            </div>
            {!verLoading&&versions.map((v,i)=><div className="variant" key={`${v.version}-${i}`}>
              <span>{v.version}</span>
              <span>{fmtSize(v.size)||'—'}</span>
              <span className="md5" title={v.md5}>{v.md5?`${v.md5.slice(0,12)}…`:'—'}</span>
              <span className="android">{v.date?v.date.slice(0,10):'—'}</span>
              <span className="type">{v.src}</span>
              <a className="download dl" href={v.download}>↓ Download</a>
            </div>)}
            {!verLoading&&!versions.length&&<div className="variant">
              <span>{selected.version==='—'?'—':selected.version}</span>
              <span>{fmtSize(selected.size)||'—'}</span>
              <span className="md5" title={selected.md5||''}>{selected.md5?`${selected.md5.slice(0,12)}…`:'—'}</span>
              <span className="android">—</span>
              <span className="type">{selected.source}</span>
              {selected.download
                ? <a className="download dl" href={selected.download}>↓ Download</a>
                : <a className="download" href={selected.sourcePage} target="_blank" rel="noreferrer">Open ↗</a>}
            </div>}
          </div>

          {!selected.download&&!versions.length&&<div className="empty" style={{padding:'26px 18px'}}>No direct file link for this app — open the source page to choose a release.</div>}

          <div className="version">
            <div className="versionhead"><strong>Browse releases</strong><span className="source">External source ↗</span></div>
            <div style={{padding:14,color:'#64748b',fontSize:13,display:'flex',gap:14,flexWrap:'wrap'}}>
              <a href={selected.sourcePage} target="_blank" rel="noreferrer">All releases on {selected.source}</a>
              {selected.playUrl&&selected.playUrl!==selected.sourcePage&&<a href={selected.playUrl} target="_blank" rel="noreferrer">Google Play listing</a>}
            </div>
          </div>
        </>}
      </section>
    </main>

    <footer className="footer">APKScope is a source-discovery interface. It does not host or redistribute APK files. Always verify the source, package name, signing information and compatibility before installing software.</footer>
  </div>;
}
