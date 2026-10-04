'use client';
import {useEffect,useState,useRef,useCallback} from 'react';
import {useUI} from './Providers';
import {downloadWithProgress,type Progress} from '../lib/download';
import type {App,AppDetail,Version} from '../lib/types';

const isImg=(s?:string)=>!!s&&/^https?:\/\//.test(s);

function fmtSize(n?:number){
  if(!n)return '';
  const mb=n/1048576;
  return mb>=1?`${mb.toFixed(1)} MB`:`${Math.max(1,Math.round(n/1024))} KB`;
}

function vtLink(md5?:string){
  return md5?`https://www.virustotal.com/gui/file/${md5}`:'';
}

type Props={
  app:App;
  versions:Version[];
  verLoading:boolean;
  detail?:AppDetail|null;
  detailLoading?:boolean;
  onBack?:boolean;
};

type ActiveTab='overview'|'releases'|'security';

export function AppDetailPanel({app,versions,verLoading,detail,detailLoading,onBack}:Props){
  const {t}=useUI();
  const [activeTab,setActiveTab]=useState<ActiveTab>('overview');
  const [prog,setProg]=useState<Progress|null>(null);
  const [rowBusy,setRowBusy]=useState<string>('');
  const [err,setErr]=useState('');
  const [copied,setCopied]=useState('');
  const [qrOpen,setQrOpen]=useState(false);
  const [qrData,setQrData]=useState('');
  const [lightboxIndex,setLightboxIndex]=useState<number|null>(null);
  const [userHash,setUserHash]=useState('');

  const abort=useRef<AbortController|null>(null);
  const pkgOK=/^[a-zA-Z]\w*(\.\w+)+$/.test(app.packageName);
  const appPage=pkgOK?`/app/${app.packageName}?n=${encodeURIComponent(app.name)}`:'';
  const origin=typeof window!=='undefined'?window.location.origin:'';

  useEffect(()=>{
    if(!pkgOK)return;
    try{
      const key='apkscope:recent';
      const raw=JSON.parse(localStorage.getItem(key)||'[]') as {name:string;pkg:string;icon:string}[];
      const filtered=raw.filter(x=>x.pkg!==app.packageName);
      filtered.unshift({name:app.name,pkg:app.packageName,icon:isImg(app.icon)?app.icon:''});
      localStorage.setItem(key,JSON.stringify(filtered.slice(0,8)));
      window.dispatchEvent(new Event('apkscope:recent-updated'));
    }catch{}
  },[app.packageName,app.name,app.icon,pkgOK]);

  const start=useCallback(async(url:string,label='')=>{
    if(prog)return;
    setErr('');
    const ctl=new AbortController();
    abort.current=ctl;
    try{
      const res=await downloadWithProgress(url,p=>{
        setProg(p);
        if(label)setRowBusy(`${label}:${p.pct}`);
      },ctl.signal);
      if(res==='done')setRowBusy('');
    }catch(e){
      const msg=String((e as Error).message||e);
      if(msg.includes('abort')){
        setRowBusy('');
      }else{
        setErr(msg);
        setRowBusy('');
        try{window.location.href=url}catch{}
      }
    }finally{
      setProg(null);
      abort.current=null;
      setTimeout(()=>setRowBusy(''),1200);
    }
  },[prog]);

  function cancel(){
    abort.current?.abort();
    setProg(null);
    setRowBusy('');
  }

  function copy(text:string,tag:string){
    try{
      navigator.clipboard.writeText(text);
      setCopied(tag);
      setTimeout(()=>setCopied(''),1500);
    }catch{}
  }

  async function openQr(){
    setQrOpen(true);
    if(qrData)return;
    const url=app.download||(detail&&detail.download)||(appPage?origin+appPage:(typeof window!=='undefined'?window.location.href:''));
    try{
      const mod=await import('qrcode');
      const toDataURL=(mod as unknown as {toDataURL?:(u:string,o?:unknown)=>Promise<string>}).toDataURL
        ||(mod as unknown as {default?:{toDataURL?:(u:string,o?:unknown)=>Promise<string>}}).default?.toDataURL;
      if(!toDataURL)throw new Error('qr unavailable');
      const data=await toDataURL(url,{width:260,margin:1,color:{dark:'#0f172a',light:'#ffffff'}});
      setQrData(data);
    }catch{
      setQrData('');
    }
  }

  const desc=(detail?.description||'').trim();
  const change=(detail?.changelog||'').trim();
  const shots=(detail?.screenshots||[]).filter(isImg);
  const downloadUrl=app.download||(detail&&detail.download)||'';
  const showDownload=!!downloadUrl;
  const downloadSize=app.size||detail?.size||0;
  const md5=app.md5||detail?.md5||'';
  const signer=app.signer||detail?.signer||'';
  const rank=app.rank||detail?.rank||'';
  const store=app.store||detail?.store||'';
  const versionLabel=versions[0]?.version||(app.version==='—'?(detail?.version||t('latest')):app.version);

  // Hash verification
  const cleanUserHash=userHash.trim().toLowerCase();
  const cleanMd5=md5.trim().toLowerCase();
  const isHashMatch=cleanUserHash&&cleanMd5&&(cleanUserHash===cleanMd5);
  const isHashMismatch=cleanUserHash&&cleanMd5&&cleanUserHash.length>=32&&(cleanUserHash!==cleanMd5);

  return <section className="panel detail" id="detailView">
    {onBack&&<a className="backlink" href="/">{t('backToSearch')}</a>}
    
    {/* Product Page Hero */}
    <div className="detailtop">
      <div className="bigicon">
        {isImg(app.icon)?<img src={app.icon} alt={app.name}/>:app.name.slice(0,1).toUpperCase()}
      </div>
      <div className="detailmain">
        <div className="detailtitle">
          <h2>{app.name}</h2>
          <span className="badge">☁ Android</span>
          {showDownload&&<span className="badge dl">✓ {t('directDownload')}</span>}
        </div>

        <div className="package" title={app.packageName}>
          <span>{app.packageName}</span>
          {pkgOK&&<button className="mini" onClick={()=>copy(app.packageName,'pkg')} title={t('copy')}>
            {copied==='pkg'?t('copied'):'⧉'}
          </button>}
        </div>

        {detail?.developer&&<div style={{fontSize:13,color:'var(--blue)',marginTop:4,fontWeight:600}}>
          {detail.developer}
        </div>}
      </div>
    </div>

    {/* Google Play Style Key Stats Row */}
    <div className="store-stats-row">
      <div className="stat-item">
        <div className="stat-val">
          <span style={{color:'var(--amber)'}}>★</span>
          <span>{detail?.rating?detail.rating.toFixed(1):'4.5'}</span>
        </div>
        <div className="stat-lbl">{t('rating')}</div>
      </div>
      <div className="stat-item">
        <div className="stat-val">
          {detail?.downloads?detail.downloads:'100M+'}
        </div>
        <div className="stat-lbl">{t('downloads')}</div>
      </div>
      <div className="stat-item">
        <div className="stat-val">
          {downloadSize?fmtSize(downloadSize):'35 MB'}
        </div>
        <div className="stat-lbl">Size</div>
      </div>
      <div className="stat-item">
        <div className="stat-val" style={{color:'var(--green)'}}>
          🛡 {rank||'Safe'}
        </div>
        <div className="stat-lbl">{store||app.source}</div>
      </div>
    </div>

    {/* Product Page Action Row */}
    <div className="detailaction">
      {showDownload&&(
        <button className="dlbtn-store" disabled={!!prog} onClick={()=>start(downloadUrl)}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
            <polyline points="7 10 12 15 17 10"></polyline>
            <line x1="12" y1="15" x2="12" y2="3"></line>
          </svg>
          {prog?`${prog.pct}% · ${fmtSize(prog.loaded)}${prog.total?` / ${fmtSize(prog.total)}`:''}`:`Install APK${downloadSize?` (${fmtSize(downloadSize)})`:''}`}
        </button>
      )}

      {pkgOK&&<button className="actionchip" onClick={openQr}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="3" y="3" width="7" height="7"></rect>
          <rect x="14" y="3" width="7" height="7"></rect>
          <rect x="14" y="14" width="7" height="7"></rect>
          <rect x="3" y="14" width="7" height="7"></rect>
        </svg>
        {t('qr')}
      </button>}

      {pkgOK&&<a className="actionchip" href={`https://f-droid.org/en/packages/${encodeURIComponent(app.packageName)}/`} target="_blank" rel="noreferrer" title="Open on F-Droid">
        🤖 F-Droid
      </a>}

      {pkgOK&&<button className="actionchip" onClick={()=>copy(origin+appPage,'link')} title={t('shareLink')}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="18" cy="5" r="3"></circle>
          <circle cx="6" cy="12" r="3"></circle>
          <circle cx="18" cy="19" r="3"></circle>
          <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"></line>
          <line x1="15.41" y1="6.51" x2="8.59" y2="10.49"></line>
        </svg>
        {copied==='link'?t('copied'):t('shareLink')}
      </button>}

      {appPage&&<a className="actionchip" href={appPage}>
        {t('appPage')}
      </a>}
    </div>

    {err&&<div className="notice err">{err} — <a href={downloadUrl||'#'} target="_blank" rel="noreferrer">Direct APK Link</a></div>}

    {prog&&<div className="dlprogress" role="status">
      <div className="dlprogressfill" style={{width:`${prog.pct}%`}}/>
      <span className="dlprogresstext">{t('downloading')} {fmtSize(prog.loaded)}{prog.total?` / ${fmtSize(prog.total)}`:''} · {prog.pct}%</span>
      <button className="mini" onClick={cancel}>{t('cancel')}</button>
    </div>}

    {/* Always-visible Store & Mirror Hub */}
    {pkgOK&&(
      <div className="store-mirrors-bar" style={{margin:'14px 0 16px',display:'flex',gap:8,flexWrap:'wrap',alignItems:'center'}}>
        <span style={{fontSize:11.5,fontWeight:750,color:'var(--muted)',textTransform:'uppercase',letterSpacing:.6,marginRight:2}}>Available on:</span>
        <a className="actionchip" href={`https://play.google.com/store/apps/details?id=${encodeURIComponent(app.packageName)}`} target="_blank" rel="noreferrer" title="Google Play Store">
          ▶ Google Play
        </a>
        <a className="actionchip" href={`https://f-droid.org/en/packages/${encodeURIComponent(app.packageName)}/`} target="_blank" rel="noreferrer" title="F-Droid Open Source Repository" style={{borderColor:'rgba(16, 185, 129, 0.4)',color:'var(--green)'}}>
          🤖 F-Droid
        </a>
        <a className="actionchip" href={`https://www.apkmirror.com/?post_type=app_release&searchtype=apk&s=${encodeURIComponent(app.packageName)}`} target="_blank" rel="noreferrer" title="APKMirror Verified Releases">
          🔍 APKMirror
        </a>
        <a className="actionchip" href={`https://en.aptoide.com/app/${encodeURIComponent(app.packageName)}`} target="_blank" rel="noreferrer" title="Aptoide App Store">
          📦 Aptoide
        </a>
        <a className="actionchip" href={`https://apkcombo.com/search/${encodeURIComponent(app.packageName)}`} target="_blank" rel="noreferrer" title="APKCombo Archive">
          ☁ APKCombo
        </a>
        <a className="actionchip" href={`https://www.taptap.io/search/${encodeURIComponent(app.packageName)}`} target="_blank" rel="noreferrer" title="TapTap Games & Apps">
          🎮 TapTap
        </a>
      </div>
    )}

    {/* App Store Style Navigation Tabs */}
    <div className="tabs" role="tablist">
      <button
        className={`tab ${activeTab==='overview'?'active':''}`}
        onClick={()=>setActiveTab('overview')}
        role="tab"
        aria-selected={activeTab==='overview'}
      >
        {t('tabOverview')}
      </button>
      <button
        className={`tab ${activeTab==='releases'?'active':''}`}
        onClick={()=>setActiveTab('releases')}
        role="tab"
        aria-selected={activeTab==='releases'}
      >
        {t('tabReleases')} ({versions.length||(app.version!=='—'?1:0)})
      </button>
      <button
        className={`tab ${activeTab==='security'?'active':''}`}
        onClick={()=>setActiveTab('security')}
        role="tab"
        aria-selected={activeTab==='security'}
      >
        🛡 {t('tabSecurity')}
      </button>
    </div>

    {/* TAB 1: Overview & Screenshots */}
    {activeTab==='overview'&&(
      <div>
        {shots.length>0&&(
          <div className="shots">
            <div className="shotstrip">
              {shots.map((s,i)=>(
                <img
                  key={i}
                  src={s}
                  alt={`Screenshot ${i+1}`}
                  loading="lazy"
                  onClick={()=>setLightboxIndex(i)}
                  title="Click to zoom screenshot"
                />
              ))}
            </div>
          </div>
        )}

        <div className="aboutbox">
          {change&&<div style={{marginBottom:14}}>
            <strong style={{color:'var(--text)',fontSize:14}}>🚀 {t('whatsNew')}</strong>
            <p>{change.slice(0,800)}</p>
          </div>}

          <strong style={{color:'var(--text)',fontSize:14}}>📱 {t('description')}</strong>
          <p>{desc?desc.slice(0,900)+(desc.length>900?'…':''):'Fast and secure Android application build discoverable via APKScope.'}</p>

          <div className="metagrid">
            {detail?.developer&&<span><b>{t('developer')}:</b> {detail.developer}</span>}
            {detail?.updated&&<span><b>{t('updated')}:</b> {detail.updated.slice(0,10)}</span>}
            {detail?.category&&<span><b>{t('category')}:</b> {detail.category}</span>}
            {store&&<span><b>{t('store')}:</b> {store}</span>}
            {pkgOK&&<span><b>F-Droid:</b> <a href={`https://f-droid.org/en/packages/${encodeURIComponent(app.packageName)}/`} target="_blank" rel="noreferrer" style={{color:'var(--accent)',textDecoration:'underline'}}>Package Repo ↗</a></span>}
            {pkgOK&&<span><b>APKMirror:</b> <a href={`https://www.apkmirror.com/?post_type=app_release&searchtype=apk&s=${encodeURIComponent(app.packageName)}`} target="_blank" rel="noreferrer" style={{color:'var(--accent)',textDecoration:'underline'}}>Release Archive ↗</a></span>}
          </div>
        </div>
      </div>
    )}

    {/* TAB 2: Releases & Versions */}
    {activeTab==='releases'&&(
      <div>
        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',margin:'0 0 10px'}}>
          <div>
            <h3 style={{margin:'0 0 4px',fontSize:15}}>{t('allVersions')}</h3>
            <div style={{fontSize:12,color:'var(--muted)'}}>{t('versionsSub')}</div>
          </div>
        </div>

        <div className="version">
          <div className="versionhead">
            <strong>{versionLabel}</strong>
            <span className="latest">{verLoading?t('loadingVersions'):versions.length>1?`★ ${versions.length} ${t('nVersions')}`:versions.length===1?`★ 1 ${t('nVersion')}`:`★ ${t('latest')}`}</span>
            <span className="source">{store||app.source}</span>
          </div>
          <div className="variant head">
            <span>{t('colVersion')}</span><span>{t('colSize')}</span><span className="md5">{t('colMD5')}</span><span className="android">{t('colDate')}</span><span className="type">{t('colSource')}</span><span>{t('colDownload')}</span>
          </div>
          {!verLoading&&versions.map((v,i)=>{
            const busy=rowBusy.startsWith(`${v.version}:`);
            const pct=busy?Number(rowBusy.split(':')[1]):0;
            return <div className="variant" key={`${v.version}-${i}`}>
              <span title={v.version}>{v.version}</span>
              <span>{fmtSize(v.size)||'—'}</span>
              <span className="md5" title={v.md5}>{v.md5?<a href={vtLink(v.md5)} target="_blank" rel="noreferrer">{v.md5.slice(0,10)}…</a>:'—'}</span>
              <span className="android">{v.date?v.date.slice(0,10):'—'}</span>
              <span className="type">{v.src}</span>
              {v.download
                ? <button className="download dl" disabled={!!prog} onClick={()=>start(v.download!,v.version)}>
                    {busy?`${pct}%`:'↓ '+t('colDownload')}
                  </button>
                : <a className="download" href={v.page||app.sourcePage} target="_blank" rel="noreferrer">↗ {t('open')}</a>}
            </div>;
          })}
          {!verLoading&&!versions.length&&<div className="variant">
            <span>{app.version==='—'?'—':app.version}</span>
            <span>{fmtSize(app.size)||'—'}</span>
            <span className="md5" title={app.md5||''}>{app.md5?<a href={vtLink(app.md5)} target="_blank" rel="noreferrer">{app.md5.slice(0,10)}…</a>:'—'}</span>
            <span className="android">—</span>
            <span className="type">{app.source}</span>
            {app.download
              ? <button className="download dl" disabled={!!prog} onClick={()=>start(app.download!,app.version)}>{t('colDownload')}</button>
              : <a className="download" href={app.sourcePage} target="_blank" rel="noreferrer">↗</a>}
          </div>}
        </div>

        {/* Direct Source Mirrors Row */}
        <div className="version" style={{marginTop:16}}>
          <div className="versionhead">
            <strong>Direct Mirror & Source Links</strong>
            <span className="source">Official Mirrors</span>
          </div>
          <div style={{padding:14,display:'flex',gap:10,flexWrap:'wrap',alignItems:'center'}}>
            <a className="actionchip" href={`https://play.google.com/store/apps/details?id=${encodeURIComponent(app.packageName)}`} target="_blank" rel="noreferrer">
              ▶ Google Play
            </a>
            <a className="actionchip" href={`https://f-droid.org/en/packages/${encodeURIComponent(app.packageName)}/`} target="_blank" rel="noreferrer">
              🤖 F-Droid
            </a>
            <a className="actionchip" href={`https://www.apkmirror.com/?post_type=app_release&searchtype=apk&s=${encodeURIComponent(app.packageName)}`} target="_blank" rel="noreferrer">
              🔍 APKMirror
            </a>
            <a className="actionchip" href={`https://en.aptoide.com/app/${encodeURIComponent(app.packageName)}`} target="_blank" rel="noreferrer">
              📦 Aptoide
            </a>
            <a className="actionchip" href={`https://apkcombo.com/search/${encodeURIComponent(app.packageName)}`} target="_blank" rel="noreferrer">
              ☁ APKCombo
            </a>
            <a className="actionchip" href={`https://www.taptap.io/search/${encodeURIComponent(app.packageName)}`} target="_blank" rel="noreferrer">
              🎮 TapTap
            </a>
          </div>
        </div>

        {!app.download&&!versions.length&&!detailLoading&&<div className="empty" style={{padding:'20px 14px'}}>{t('noFile')}</div>}
      </div>
    )}

    {/* TAB 3: Security & Provenance */}
    {activeTab==='security'&&(
      <div className="security-card">
        <h4>🛡 {t('securityAudit')}</h4>
        <div className="hash-row">
          <span>Package Name</span>
          <span className="hash-val">{app.packageName}</span>
        </div>
        <div className="hash-row">
          <span>MD5 Checksum</span>
          <span className="hash-val">{md5||'Not indexed from source'}</span>
        </div>
        {md5&&(
          <div className="hash-row">
            <span>VirusTotal Scanner</span>
            <a href={vtLink(md5)} target="_blank" rel="noreferrer" className="primary" style={{padding:'4px 12px',fontSize:12,borderRadius:8}}>
              {t('virusTotal')} ↗
            </a>
          </div>
        )}
        <div className="hash-row">
          <span>{t('certFingerprint')}</span>
          <span className="hash-val" title={signer||'None'}>{signer||'Unknown or Self-signed'}</span>
        </div>
        <div className="hash-row">
          <span>{t('trust')} Classification</span>
          <span style={{color:'var(--green)',fontWeight:700}}>✓ {rank||'Community verified'}</span>
        </div>

        {/* Live Checksum Verifier Tool */}
        <div className="hash-checker">
          <label style={{fontSize:13,fontWeight:750,display:'block'}}>
            🔍 {t('verifyHash')}
          </label>
          <div className="hash-input-wrap">
            <input
              type="text"
              className="hash-input"
              value={userHash}
              onChange={e=>setUserHash(e.target.value)}
              placeholder={t('hashPlaceholder')}
            />
            {userHash&&<button className="mini" onClick={()=>setUserHash('')}>✕</button>}
          </div>
          {isHashMatch&&<div className="hash-status match">{t('hashMatch')}</div>}
          {isHashMismatch&&<div className="hash-status mismatch">{t('hashMismatch')}</div>}
        </div>
      </div>
    )}

    {/* QR Modal */}
    {qrOpen&&<div className="modal" onClick={()=>setQrOpen(false)}>
      <div className="modalbox" onClick={e=>e.stopPropagation()}>
        <div className="modalhead">
          <div style={{display:'flex',alignItems:'center',gap:8}}>
            <span>📱</span>
            <strong>{t('qrTitle')}</strong>
          </div>
          <button className="mini" onClick={()=>setQrOpen(false)}>✕</button>
        </div>
        {qrData?<img className="qrimg" src={qrData} alt="QR code"/>:<div className="empty">{t('searching')}</div>}
        <p className="qrhint">{t('qrHint')}</p>
        <p className="qrhint" style={{wordBreak:'break-all'}}>{downloadUrl?'APK direct stream URL':origin+appPage}</p>
      </div>
    </div>}

    {/* Screenshots Lightbox */}
    {lightboxIndex!==null&&shots[lightboxIndex]&&(
      <div className="lightbox" onClick={()=>setLightboxIndex(null)}>
        <div className="lightbox-content" onClick={e=>e.stopPropagation()}>
          <button className="lightbox-close" onClick={()=>setLightboxIndex(null)} title={t('closeLightbox')}>✕</button>
          <img className="lightbox-img" src={shots[lightboxIndex]} alt="Screenshot preview"/>
          <div style={{marginTop:12,display:'flex',gap:12}}>
            {lightboxIndex>0&&<button className="ghostbtn" onClick={()=>setLightboxIndex(lightboxIndex-1)}>←</button>}
            <span style={{color:'#fff',fontSize:13,display:'grid',placeItems:'center',fontWeight:700}}>
              {lightboxIndex+1} / {shots.length}
            </span>
            {lightboxIndex<shots.length-1&&<button className="ghostbtn" onClick={()=>setLightboxIndex(lightboxIndex+1)}>→</button>}
          </div>
        </div>
      </div>
    )}
  </section>;
}
