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

export function AppDetailPanel({app,versions,verLoading,detail,detailLoading,onBack}:Props){
  const {t}=useUI();
  const [prog,setProg]=useState<Progress|null>(null);
  const [rowBusy,setRowBusy]=useState<string>('');
  const [err,setErr]=useState('');
  const [copied,setCopied]=useState('');
  const [qrOpen,setQrOpen]=useState(false);
  const [qrData,setQrData]=useState('');
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  },[app.packageName]);

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
      const data=await toDataURL(url,{width:260,margin:1,color:{dark:'#10213a',light:'#ffffff'}});
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

  return <section className="panel detail">
    {onBack&&<a className="backlink" href="/">{t('backToSearch')}</a>}
    <div className="detailtop">
      <div className="bigicon">{isImg(app.icon)?<img src={app.icon} alt=""/>:app.name.slice(0,1).toUpperCase()}</div>
      <div className="detailmain">
        <h2>{app.name} <span className="badge">☁ Android</span></h2>
        <div className="package" title={app.packageName}>
          {app.packageName}
          {pkgOK&&<button className="mini" onClick={()=>copy(app.packageName,'pkg')} title={t('copy')}>
            {copied==='pkg'?t('copied'):'⧉'}
          </button>}
        </div>
        {signer&&<div className="package signer">{t('signedBy')} {signer}</div>}
        <div className="tagrow">
          {(detail?.category?app.category.concat(detail.category):app.category).map((x,i)=><span className="tag" key={`${x}-${i}`}>{x}</span>)}
          {rank&&<span className="tag trust">🛡 {rank}</span>}
          {store&&<span className="tag store">Store: {store}</span>}
          {detail?.rating?<span className="tag">★ {detail.rating.toFixed(1)}</span>:null}
          {detail?.downloads?<span className="tag">{detail.downloads} {t('downloads').toLowerCase()}</span>:null}
        </div>
      </div>
      <div className="detailaction">
        {showDownload&&<button className="dlbtn" disabled={!!prog} onClick={()=>start(downloadUrl)}>
          {prog?`${prog.pct}% · ${fmtSize(prog.loaded)}${prog.total?` / ${fmtSize(prog.total)}`:''}`:`${t('downloadApk')}${downloadSize?` (${fmtSize(downloadSize)})`:''}`}
        </button>}
        {!showDownload&&detailLoading&&<span className="badge">…</span>}
        {pkgOK&&<button className="chip actionchip" onClick={openQr}>▣ {t('qr')}</button>}
        {appPage&&<a className="primary" href={appPage}>{t('appPage')}</a>}
        {app.sourcePage&&<a className="chip actionchip" href={app.sourcePage} target="_blank" rel="noreferrer">{t('openOn')} {app.source} ↗</a>}
        {app.playUrl&&app.playUrl!==app.sourcePage&&<a className="chip actionchip" href={app.playUrl} target="_blank" rel="noreferrer">{t('playStore')}</a>}
      </div>
    </div>

    {err&&<div className="notice err">{err} — <a href={downloadUrl||'#'}>retry direct link</a></div>}
    {prog&&<div className="dlprogress" role="status">
      <div className="dlprogressfill" style={{width:`${prog.pct}%`}}/>
      <span className="dlprogresstext">{t('downloading')} {fmtSize(prog.loaded)}{prog.total?` / ${fmtSize(prog.total)}`:''} · {prog.pct}%</span>
      <button className="mini" onClick={cancel}>{t('cancel')}</button>
    </div>}

    <div className="tabs"><div className="tab active">{t('downloadVersions')}</div>
      {appPage&&<a className="tab" href={appPage}>{t('appPage')}</a>}
    </div>

    {shots.length>0&&<div className="shots">
      <div className="shotstrip">{shots.map((s,i)=><img key={i} src={s} alt="" loading="lazy"/>)}</div>
    </div>}

    {(desc||change)&&<div className="aboutbox">
      {change&&<div className="whatsnew"><strong>{t('whatsNew')}</strong><p>{change.slice(0,600)}</p></div>}
      {desc&&<div className="desc"><strong>{t('description')}</strong><p>{desc.slice(0,700)}{desc.length>700?'…':''}</p></div>}
      <div className="metagrid">
        {detail?.developer&&<span><b>{t('developer')}:</b> {detail.developer}</span>}
        {detail?.updated&&<span><b>{t('updated')}:</b> {detail.updated.slice(0,10)}</span>}
        {md5&&<span><b>MD5:</b> <a href={vtLink(md5)} target="_blank" rel="noreferrer" title={t('virusTotal')}>{md5.slice(0,16)}… {t('virusTotal')} ↗</a></span>}
        {signer&&<span><b>{t('trust')}:</b> 🛡 {signer}</span>}
      </div>
    </div>}

    <div style={{display:'flex',alignItems:'center'}}>
      <div>
        <h3 style={{margin:'0 0 4px'}}>{t('allVersions')}</h3>
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
          <span className="md5" title={v.md5}>{v.md5?<a href={vtLink(v.md5)} target="_blank" rel="noreferrer">{v.md5.slice(0,12)}…</a>:'—'}</span>
          <span className="android">{v.date?v.date.slice(0,10):'—'}</span>
          <span className="type">{v.src}</span>
          <button className="download dl" disabled={!!prog} onClick={()=>start(v.download,v.version)}>
            {busy?`${pct}%`:'↓ '+t('colDownload')}
          </button>
        </div>;
      })}
      {!verLoading&&!versions.length&&<div className="variant">
        <span>{app.version==='—'?'—':app.version}</span>
        <span>{fmtSize(app.size)||'—'}</span>
        <span className="md5" title={app.md5||''}>{app.md5?<a href={vtLink(app.md5)} target="_blank" rel="noreferrer">{app.md5.slice(0,12)}…</a>:'—'}</span>
        <span className="android">—</span>
        <span className="type">{app.source}</span>
        {app.download
          ? <button className="download dl" disabled={!!prog} onClick={()=>start(app.download!,app.version)}>{t('colDownload')}</button>
          : <a className="download" href={app.sourcePage} target="_blank" rel="noreferrer">↗</a>}
      </div>}
    </div>

    {!app.download&&!versions.length&&!detailLoading&&<div className="empty" style={{padding:'26px 18px'}}>{t('noFile')}</div>}

    <div className="version">
      <div className="versionhead"><strong>{t('browseReleases')}</strong><span className="source">{t('externalSource')}</span></div>
      <div style={{padding:14,color:'var(--muted)',fontSize:13,display:'flex',gap:14,flexWrap:'wrap'}}>
        <a href={app.sourcePage} target="_blank" rel="noreferrer">{t('browseReleases')} — {app.source}</a>
        {app.playUrl&&app.playUrl!==app.sourcePage&&<a href={app.playUrl} target="_blank" rel="noreferrer">{t('playListing')}</a>}
        {pkgOK&&<a href={origin+appPage}>{t('appPage')}</a>}
      </div>
    </div>

    {qrOpen&&<div className="modal" onClick={()=>setQrOpen(false)}>
      <div className="modalbox" onClick={e=>e.stopPropagation()}>
        <div className="modalhead"><strong>{t('qrTitle')}</strong><button className="mini" onClick={()=>setQrOpen(false)}>✕</button></div>
        {qrData?<img className="qrimg" src={qrData} alt="QR code"/>:<div className="empty">{t('searching')}</div>}
        <p className="qrhint">{t('qrHint')}</p>
        <p className="qrhint" style={{wordBreak:'break-all'}}>{downloadUrl?'APK download link':origin+appPage}</p>
      </div>
    </div>}
  </section>;
}
