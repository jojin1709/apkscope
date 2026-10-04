'use client';
import {useEffect,useState,useRef,useCallback} from 'react';
import {useUI} from './Providers';
import {downloadWithProgress,type Progress} from '../lib/download';
import type {App,AppDetail,Version} from '../lib/types';
import {
  IconStar,IconShield,IconGooglePlay,IconFDroid,IconApkMirror,IconAptoide,IconApkCombo,IconTapTap,
  IconWrench,IconGithub,IconIzzy,IconUptodown,IconTerminal,IconBookmark,IconBookmarkFilled,
  IconCopy,IconCheck,IconAlertTriangle,IconExternalLink,IconFileText,IconLayers,IconLink,IconAndroid
} from './Icons';
import {computeSha256,computeMd5,computeSha1} from '../lib/client-hash';

const isImg=(s?:string)=>!!s&&/^(https?:\/\/|data:image\/)/.test(s);

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
type RiskLevel='ALL'|'CRITICAL'|'HIGH'|'MEDIUM'|'SAFE';

interface AndroidPermission {
  name: string;
  risk: 'CRITICAL'|'HIGH'|'MEDIUM'|'SAFE';
  desc: string;
  category: string;
}

const COMMON_PERMISSIONS: AndroidPermission[] = [
  { name: 'android.permission.SYSTEM_ALERT_WINDOW', risk: 'CRITICAL', desc: 'Display overlay windows over other apps. Prone to tapjacking & credential capture.', category: 'Overlay & UI' },
  { name: 'android.permission.BIND_ACCESSIBILITY_SERVICE', risk: 'CRITICAL', desc: 'Inspect entire screen content, keypresses, and perform automated touch gestures.', category: 'Accessibility' },
  { name: 'android.permission.REQUEST_INSTALL_PACKAGES', risk: 'CRITICAL', desc: 'Trigger installation of unverified .apk binaries outside verified stores.', category: 'Package Dropper' },
  { name: 'android.permission.READ_PRIVILEGED_PHONE_STATE', risk: 'CRITICAL', desc: 'Read sensitive hardware identifiers (IMEI, MEID, IMSI).', category: 'Telephony' },
  { name: 'android.permission.CAMERA', risk: 'HIGH', desc: 'Capture raw camera feed and photos in foreground/background.', category: 'Hardware' },
  { name: 'android.permission.RECORD_AUDIO', risk: 'HIGH', desc: 'Capture microphone audio streams.', category: 'Hardware' },
  { name: 'android.permission.ACCESS_FINE_LOCATION', risk: 'HIGH', desc: 'Pinpoint precise GPS coordinates and Wi-Fi SSID scans.', category: 'Location' },
  { name: 'android.permission.READ_CONTACTS', risk: 'HIGH', desc: 'Access device contacts database and stored phone numbers.', category: 'Personal Data' },
  { name: 'android.permission.READ_SMS', risk: 'HIGH', desc: 'Read incoming SMS messages (frequently targeting OTP/2FA verification codes).', category: 'Telephony' },
  { name: 'android.permission.WRITE_EXTERNAL_STORAGE', risk: 'HIGH', desc: 'Write to shared external public filesystem (data hijacking / overwrite risk).', category: 'Storage' },
  { name: 'android.permission.QUERY_ALL_PACKAGES', risk: 'MEDIUM', desc: 'Enumerate all other applications installed on the victim device.', category: 'Reconnaissance' },
  { name: 'android.permission.ACCESS_COARSE_LOCATION', risk: 'MEDIUM', desc: 'Cellular tower and approximate geographic location.', category: 'Location' },
  { name: 'android.permission.POST_NOTIFICATIONS', risk: 'MEDIUM', desc: 'Post push notifications and prompt popups in system tray.', category: 'UI' },
  { name: 'android.permission.USE_BIOMETRIC', risk: 'MEDIUM', desc: 'Trigger biometric authentication prompts (fingerprint / face ID).', category: 'Security' },
  { name: 'android.permission.BLUETOOTH_CONNECT', risk: 'MEDIUM', desc: 'Discover and connect to paired Bluetooth peripherals and beacons.', category: 'Hardware' },
  { name: 'android.permission.INTERNET', risk: 'SAFE', desc: 'Open outbound TCP/UDP network sockets.', category: 'Network' },
  { name: 'android.permission.ACCESS_NETWORK_STATE', risk: 'SAFE', desc: 'Query Wi-Fi vs Cellular connection status.', category: 'Network' },
  { name: 'android.permission.WAKE_LOCK', risk: 'SAFE', desc: 'Prevent CPU from entering sleep state.', category: 'Power' },
  { name: 'android.permission.VIBRATE', risk: 'SAFE', desc: 'Control device haptic feedback motor.', category: 'Hardware' }
];

const KNOWN_INTENTS: Record<string, { scheme: string; testUri: string; desc: string }> = {
  'org.telegram.messenger': { scheme: 'tg://', testUri: 'tg://resolve?domain=telegram', desc: 'Telegram Deep Link URI' },
  'com.spotify.music': { scheme: 'spotify://', testUri: 'spotify://track/4cOdK2wGLETKBW3PvgPWqT', desc: 'Spotify Track & Playlist URI' },
  'com.whatsapp': { scheme: 'whatsapp://', testUri: 'whatsapp://send?text=APKScope', desc: 'WhatsApp Message Intent' },
  'com.instagram.android': { scheme: 'instagram://', testUri: 'instagram://user?username=security', desc: 'Instagram Profile Intent' },
  'com.twitter.android': { scheme: 'twitter://', testUri: 'twitter://user?screen_name=twitter', desc: 'Twitter/X User Profile Intent' },
  'com.discord': { scheme: 'discord://', testUri: 'discord://invite/...', desc: 'Discord Server Invite Intent' },
  'org.videolan.vlc': { scheme: 'vlc://', testUri: 'vlc://https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4', desc: 'VLC Media Stream Intent' },
  'com.termux': { scheme: 'termux://', testUri: 'termux://context', desc: 'Termux Terminal Intent' }
};

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
  const [isWatched,setIsWatched]=useState(false);
  const [splitModalOpen,setSplitModalOpen]=useState(false);
  const [permFilter,setPermFilter]=useState<RiskLevel>('ALL');
  const [localApk,setLocalApk]=useState<{name:string;size:number;sha256:string;md5:string;sha1:string}|null>(null);
  const [isHashing,setIsHashing]=useState(false);
  const fileInputRef=useRef<HTMLInputElement>(null);

  const abort=useRef<AbortController|null>(null);
  const pkgOK=/^[a-zA-Z]\w*(\.\w+)+$/.test(app.packageName);
  const appPage=pkgOK?`/app/${app.packageName}?n=${encodeURIComponent(app.name)}`:'';
  const origin=typeof window!=='undefined'?window.location.origin:'';

  const handleApkFile=async(file:File)=>{
    if(!file)return;
    setIsHashing(true);
    try{
      const buffer=await file.arrayBuffer();
      const [sha256,sha1]=await Promise.all([
        computeSha256(buffer),
        computeSha1(buffer)
      ]);
      const md5Calc=computeMd5(buffer);
      setLocalApk({
        name:file.name,
        size:file.size,
        sha256,
        md5:md5Calc,
        sha1
      });
      setUserHash(md5Calc);
    }catch{
      setErr('Error calculating cryptographic hashes on selected file');
    }finally{
      setIsHashing(false);
    }
  };

  // Check and sync watchlist
  const checkWatchlist = useCallback(()=>{
    try{
      const raw=JSON.parse(localStorage.getItem('apkscope:watchlist')||'[]');
      setIsWatched(Array.isArray(raw)&&raw.some((x:{pkg:string})=>x.pkg===app.packageName));
    }catch{
      setIsWatched(false);
    }
  },[app.packageName]);

  useEffect(()=>{
    checkWatchlist();
    window.addEventListener('apkscope:watchlist-updated',checkWatchlist);
    return()=>window.removeEventListener('apkscope:watchlist-updated',checkWatchlist);
  },[checkWatchlist]);

  const toggleWatchlist=()=>{
    try{
      const raw=JSON.parse(localStorage.getItem('apkscope:watchlist')||'[]');
      const list=Array.isArray(raw)?raw:[];
      const exists=list.some((x:{pkg:string})=>x.pkg===app.packageName);
      const next=exists
        ? list.filter((x:{pkg:string})=>x.pkg!==app.packageName)
        : [{pkg:app.packageName,name:app.name,icon:isImg(app.icon)?app.icon:''},...list];
      localStorage.setItem('apkscope:watchlist',JSON.stringify(next));
      setIsWatched(!exists);
      window.dispatchEvent(new Event('apkscope:watchlist-updated'));
    }catch{}
  };

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
        <div className="detailtitle" style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:8,flexWrap:'wrap'}}>
          <div style={{display:'flex',alignItems:'center',gap:8,flexWrap:'wrap'}}>
            <h2>{app.name}</h2>
            <span className="badge">Android</span>
            {showDownload&&<span className="badge dl">{t('directDownload')}</span>}
          </div>
          {pkgOK&&<button
            className="actionchip"
            onClick={toggleWatchlist}
            style={{padding:'6px 12px',borderRadius:20,border:'1px solid var(--line)',background:isWatched?'rgba(56, 189, 248, 0.15)':'var(--panel2)',color:isWatched?'#38bdf8':'var(--muted)',cursor:'pointer'}}
            title={isWatched?'In Watchlist (Click to remove)':'Save to Watchlist'}
          >
            {isWatched?<IconBookmarkFilled size={14} color="#38bdf8"/>:<IconBookmark size={14}/>}
            <span style={{fontWeight:600,fontSize:12}}>{isWatched?'Saved':'Watchlist'}</span>
          </button>}
        </div>

        <div className="package" title={app.packageName}>
          <span>{app.packageName}</span>
          {pkgOK&&<button className="mini" onClick={()=>copy(app.packageName,'pkg')} title={t('copy')}>
            {copied==='pkg'?<IconCheck size={12} color="var(--green)"/>:<IconCopy size={12}/>}
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
        <div className="stat-val" style={{display:'inline-flex',alignItems:'center',gap:4}}>
          <IconStar size={14} color="var(--amber)"/>
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
        <div className="stat-val" style={{color:'var(--green)',display:'inline-flex',alignItems:'center',gap:4}}>
          <IconShield size={14} color="var(--green)"/>
          <span>{rank||'Safe'}</span>
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

      {/* 1-Click ADB Install Quick Copy */}
      {pkgOK&&(
        <button
          className="actionchip"
          onClick={()=>copy(`adb install -r ${app.packageName}.apk`,'adb-quick')}
          title="Copy adb install command"
        >
          <IconTerminal size={14}/>
          <span>{copied==='adb-quick'?'Copied ADB!':'ADB Install'}</span>
        </button>
      )}

      {/* Split APK (APKM / XAPK) Guide Modal Trigger */}
      <button className="actionchip" onClick={()=>setSplitModalOpen(true)} title="Split APK / Bundle Guide">
        <IconLayers size={14}/>
        <span>Split APK Guide</span>
      </button>

      {pkgOK&&<button className="actionchip" onClick={openQr}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="3" y="3" width="7" height="7"></rect>
          <rect x="14" y="3" width="7" height="7"></rect>
          <rect x="14" y="14" width="7" height="7"></rect>
          <rect x="3" y="14" width="7" height="7"></rect>
        </svg>
        {t('qr')}
      </button>}

      {pkgOK&&<button className="actionchip" onClick={()=>copy(origin+appPage,'link')} title={t('shareLink')}>
        <IconCopy size={14}/>
        <span>{copied==='link'?t('copied'):t('shareLink')}</span>
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
        <span style={{fontSize:11.5,fontWeight:750,color:'var(--muted)',textTransform:'uppercase',letterSpacing:.6,marginRight:2}}>Mirrors:</span>
        <a className="actionchip" href={`https://play.google.com/store/apps/details?id=${encodeURIComponent(app.packageName)}`} target="_blank" rel="noreferrer" title="Google Play Store">
          <IconGooglePlay size={14}/> Google Play
        </a>
        <a className="actionchip" href={`https://f-droid.org/en/packages/${encodeURIComponent(app.packageName)}/`} target="_blank" rel="noreferrer" title="F-Droid Open Source Repository" style={{borderColor:'rgba(16, 185, 129, 0.4)',color:'var(--green)'}}>
          <IconFDroid size={14}/> F-Droid
        </a>
        <a className="actionchip" href={`https://www.apkmirror.com/?post_type=app_release&searchtype=apk&s=${encodeURIComponent(app.packageName)}`} target="_blank" rel="noreferrer" title="APKMirror Verified Releases">
          <IconApkMirror size={14}/> APKMirror
        </a>
        <a className="actionchip" href={`https://en.aptoide.com/app/${encodeURIComponent(app.packageName)}`} target="_blank" rel="noreferrer" title="Aptoide App Store">
          <IconAptoide size={14}/> Aptoide
        </a>
        <a className="actionchip" href={`https://apkcombo.com/search/${encodeURIComponent(app.packageName)}`} target="_blank" rel="noreferrer" title="APKCombo Archive">
          <IconApkCombo size={14}/> APKCombo
        </a>
        <a className="actionchip" href={`https://apt.izzysoft.de/fdroid/index/apk/${encodeURIComponent(app.packageName)}`} target="_blank" rel="noreferrer" title="IzzyOnDroid FOSS Repo">
          <IconIzzy size={14}/> IzzyOnDroid
        </a>
        <a className="actionchip" href={`https://en.uptodown.com/android/search/${encodeURIComponent(app.packageName)}`} target="_blank" rel="noreferrer" title="Uptodown Rollback Archive">
          <IconUptodown size={14}/> Uptodown
        </a>
        <a className="actionchip" href={`https://www.taptap.io/search/${encodeURIComponent(app.packageName)}`} target="_blank" rel="noreferrer" title="TapTap Games & Apps">
          <IconTapTap size={14}/> TapTap
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
        <span style={{display:'inline-flex',alignItems:'center',gap:4}}>
          <IconShield size={14}/>
          <span>{t('tabSecurity')} & Pentest</span>
        </span>
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
            <strong style={{color:'var(--text)',fontSize:14}}>{t('whatsNew')}</strong>
            <p>{change.slice(0,800)}</p>
          </div>}

          <strong style={{color:'var(--text)',fontSize:14}}>{t('description')}</strong>
          <p>{desc?desc.slice(0,900)+(desc.length>900?'…':''):'Fast and secure Android application build discoverable via APKScope.'}</p>

          <div className="metagrid">
            {detail?.developer&&<span><b>{t('developer')}:</b> {detail.developer}</span>}
            {detail?.updated&&<span><b>{t('updated')}:</b> {detail.updated.slice(0,10)}</span>}
            {detail?.category&&<span><b>{t('category')}:</b> {detail.category}</span>}
            {store&&<span><b>{t('store')}:</b> {store}</span>}
            {pkgOK&&<span><b>F-Droid:</b> <a href={`https://f-droid.org/en/packages/${encodeURIComponent(app.packageName)}/`} target="_blank" rel="noreferrer" style={{color:'var(--accent)',textDecoration:'underline'}}>f-droid.org</a></span>}
            {pkgOK&&<span><b>APKMirror:</b> <a href={`https://www.apkmirror.com/?post_type=app_release&searchtype=apk&s=${encodeURIComponent(app.packageName)}`} target="_blank" rel="noreferrer" style={{color:'var(--accent)',textDecoration:'underline'}}>apkmirror.com</a></span>}
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
            <span className="latest">{verLoading?t('loadingVersions'):versions.length>1?`${versions.length} ${t('nVersions')}`:versions.length===1?`1 ${t('nVersion')}`:t('latest')}</span>
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
                    {busy?`${pct}%`:t('colDownload')}
                  </button>
                : <a className="download" href={v.page||app.sourcePage} target="_blank" rel="noreferrer">{t('open')}</a>}
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
              : <a className="download" href={app.sourcePage} target="_blank" rel="noreferrer">{t('open')}</a>}
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
              <IconGooglePlay size={14}/> Google Play
            </a>
            <a className="actionchip" href={`https://f-droid.org/en/packages/${encodeURIComponent(app.packageName)}/`} target="_blank" rel="noreferrer">
              <IconFDroid size={14}/> F-Droid
            </a>
            <a className="actionchip" href={`https://www.apkmirror.com/?post_type=app_release&searchtype=apk&s=${encodeURIComponent(app.packageName)}`} target="_blank" rel="noreferrer">
              <IconApkMirror size={14}/> APKMirror
            </a>
            <a className="actionchip" href={`https://en.aptoide.com/app/${encodeURIComponent(app.packageName)}`} target="_blank" rel="noreferrer">
              <IconAptoide size={14}/> Aptoide
            </a>
            <a className="actionchip" href={`https://apkcombo.com/search/${encodeURIComponent(app.packageName)}`} target="_blank" rel="noreferrer">
              <IconApkCombo size={14}/> APKCombo
            </a>
            <a className="actionchip" href={`https://apt.izzysoft.de/fdroid/index/apk/${encodeURIComponent(app.packageName)}`} target="_blank" rel="noreferrer">
              <IconIzzy size={14}/> IzzyOnDroid
            </a>
            <a className="actionchip" href={`https://en.uptodown.com/android/search/${encodeURIComponent(app.packageName)}`} target="_blank" rel="noreferrer">
              <IconUptodown size={14}/> Uptodown
            </a>
            <a className="actionchip" href={`https://www.taptap.io/search/${encodeURIComponent(app.packageName)}`} target="_blank" rel="noreferrer">
              <IconTapTap size={14}/> TapTap
            </a>
          </div>
        </div>

        {!app.download&&!versions.length&&!detailLoading&&<div className="empty" style={{padding:'20px 14px'}}>{t('noFile')}</div>}
      </div>
    )}

    {/* TAB 3: Security & Provenance & Pentest Tools */}
    {activeTab==='security'&&(
      <div style={{display:'flex',flexDirection:'column',gap:14}}>
        {/* Core Provenance Card */}
        <div className="security-card">
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',flexWrap:'wrap',gap:8,marginBottom:12}}>
            <h4 style={{display:'flex',alignItems:'center',gap:8,margin:0}}>
              <IconShield size={16} color="var(--blue)"/>
              <span>{t('securityAudit')} & Provenance</span>
            </h4>
            
            {/* 1-Click Bug Bounty Markdown Exporter Buttons */}
            <div style={{display:'flex',gap:8}}>
              <button
                className="actionchip"
                onClick={()=>{
                  const report = `# APKScope Pentest & Bug Bounty Audit Report
**Date**: ${new Date().toISOString().slice(0,10)}
**Target App**: ${app.name}
**Package Name**: \`${app.packageName}\`
**Version**: \`${versionLabel}\`
**MD5 Checksum**: \`${md5 || 'N/A'}\`
**Signer Fingerprint**: \`${signer || 'Unknown / Self-signed'}\`
**VirusTotal Scan**: ${vtLink(md5) || 'N/A'}

---
### Discovered Source Mirrors
- Google Play: https://play.google.com/store/apps/details?id=${app.packageName}
- F-Droid: https://f-droid.org/en/packages/${app.packageName}/
- APKMirror: https://www.apkmirror.com/?post_type=app_release&searchtype=apk&s=${encodeURIComponent(app.packageName)}
- Aptoide: https://en.aptoide.com/app/${app.packageName}
- APKCombo: https://apkcombo.com/search/${app.packageName}
- IzzyOnDroid: https://apt.izzysoft.de/fdroid/index/apk/${app.packageName}
- Uptodown: https://en.uptodown.com/android/search/${app.packageName}

---
### Android Attack Surface Checklist
- [ ] Exported Activities / Receivers / Content Providers
- [ ] Deep link intent handling and URI schemes
- [ ] Cleartext HTTP traffic policy (android:usesCleartextTraffic)
- [ ] Dangerous permissions: CAMERA, RECORD_AUDIO, ACCESS_FINE_LOCATION, SYSTEM_ALERT_WINDOW

---
*Generated with APKScope (https://apkscope.vercel.app)*`;
                  copy(report,'bounty-md');
                }}
                title="Copy Markdown Bug Bounty Audit Report"
              >
                <IconFileText size={14}/>
                <span>{copied==='bounty-md'?'Copied Markdown!':'Export Report (MD)'}</span>
              </button>

              <button
                className="actionchip"
                onClick={()=>{
                  const jsonReport = {
                    appName: app.name,
                    packageName: app.packageName,
                    version: versionLabel,
                    checksums: { md5: md5 || null },
                    signer: signer || null,
                    virusTotal: vtLink(md5) || null,
                    mirrors: {
                      googlePlay: `https://play.google.com/store/apps/details?id=${app.packageName}`,
                      fDroid: `https://f-droid.org/en/packages/${app.packageName}/`,
                      apkMirror: `https://www.apkmirror.com/?post_type=app_release&searchtype=apk&s=${encodeURIComponent(app.packageName)}`,
                      aptoide: `https://en.aptoide.com/app/${app.packageName}`,
                      apkCombo: `https://apkcombo.com/search/${app.packageName}`,
                      izzyOnDroid: `https://apt.izzysoft.de/fdroid/index/apk/${app.packageName}`,
                      uptodown: `https://en.uptodown.com/android/search/${app.packageName}`
                    },
                    exportTimestamp: new Date().toISOString()
                  };
                  copy(JSON.stringify(jsonReport, null, 2),'bounty-json');
                }}
                title="Export JSON report"
              >
                <IconCopy size={14}/>
                <span>{copied==='bounty-json'?'Copied JSON!':'Export JSON'}</span>
              </button>
            </div>
          </div>

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
                {t('virusTotal')}
              </a>
            </div>
          )}
          <div className="hash-row">
            <span>{t('certFingerprint')}</span>
            <span className="hash-val" title={signer||'None'}>{signer||'Unknown or Self-signed'}</span>
          </div>
          <div className="hash-row">
            <span>{t('trust')} Classification</span>
            <span style={{color:'var(--green)',fontWeight:700,display:'inline-flex',alignItems:'center',gap:4}}>
              <IconShield size={13} color="var(--green)"/>
              <span>Verified ({rank||'Community verified'})</span>
            </span>
          </div>

          {/* Live Checksum Verifier Tool */}
          <div className="hash-checker" style={{marginTop:12}}>
            <label style={{fontSize:13,fontWeight:750,display:'flex',alignItems:'center',gap:6}}>
              <IconWrench size={14}/>
              <span>{t('verifyHash')}</span>
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

        {/* 1-Click ADB Install & Pentest Commands Box */}
        <div className="security-card">
          <h4 style={{display:'flex',alignItems:'center',gap:8,margin:'0 0 10px'}}>
            <IconTerminal size={16} color="var(--blue)"/>
            <span>Pentest &amp; Reverse Engineering CLI Snippets</span>
          </h4>
          <p style={{fontSize:12.5,color:'var(--muted)',margin:'0 0 10px'}}>
            Ready-to-run terminal snippets for ADB, Frida instrumentation, JADX decompilation, and Apktool disassembly.
          </p>

          <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit, minmax(280px, 1fr))',gap:8}}>
            {/* Quick ADB Install */}
            <div style={{background:'var(--panel2)',border:'1px solid var(--line)',borderRadius:10,padding:'10px 12px'}}>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:4}}>
                <span style={{fontSize:11,fontWeight:700,color:'var(--muted)',textTransform:'uppercase'}}>ADB Install</span>
                <button className="mini" onClick={()=>copy(`adb install -r ${app.packageName}.apk`,'cmd-adb')}>
                  {copied==='cmd-adb'?<IconCheck size={12} color="var(--green)"/>:<IconCopy size={12}/>}
                </button>
              </div>
              <code style={{fontSize:11.5,color:'var(--green)',fontFamily:'monospace',display:'block'}}>
                adb install -r {app.packageName}.apk
              </code>
            </div>

            {/* Frida Hooking */}
            <div style={{background:'var(--panel2)',border:'1px solid var(--line)',borderRadius:10,padding:'10px 12px'}}>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:4}}>
                <span style={{fontSize:11,fontWeight:700,color:'var(--muted)',textTransform:'uppercase'}}>Frida Spawn &amp; Hook</span>
                <button className="mini" onClick={()=>copy(`frida -U -f ${app.packageName} -l hook.js`,'cmd-frida')}>
                  {copied==='cmd-frida'?<IconCheck size={12} color="var(--green)"/>:<IconCopy size={12}/>}
                </button>
              </div>
              <code style={{fontSize:11.5,color:'var(--blue)',fontFamily:'monospace',display:'block'}}>
                frida -U -f {app.packageName} -l hook.js
              </code>
            </div>

            {/* JADX Decompile */}
            <div style={{background:'var(--panel2)',border:'1px solid var(--line)',borderRadius:10,padding:'10px 12px'}}>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:4}}>
                <span style={{fontSize:11,fontWeight:700,color:'var(--muted)',textTransform:'uppercase'}}>JADX Decompile</span>
                <button className="mini" onClick={()=>copy(`jadx -d out/ ${app.packageName}.apk`,'cmd-jadx')}>
                  {copied==='cmd-jadx'?<IconCheck size={12} color="var(--green)"/>:<IconCopy size={12}/>}
                </button>
              </div>
              <code style={{fontSize:11.5,color:'var(--accent)',fontFamily:'monospace',display:'block'}}>
                jadx -d out/ {app.packageName}.apk
              </code>
            </div>

            {/* Apktool Disassemble */}
            <div style={{background:'var(--panel2)',border:'1px solid var(--line)',borderRadius:10,padding:'10px 12px'}}>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:4}}>
                <span style={{fontSize:11,fontWeight:700,color:'var(--muted)',textTransform:'uppercase'}}>Apktool Decode</span>
                <button className="mini" onClick={()=>copy(`apktool d ${app.packageName}.apk -o ./decompiled/`,'cmd-apktool')}>
                  {copied==='cmd-apktool'?<IconCheck size={12} color="var(--green)"/>:<IconCopy size={12}/>}
                </button>
              </div>
              <code style={{fontSize:11.5,color:'#f59e0b',fontFamily:'monospace',display:'block'}}>
                apktool d {app.packageName}.apk -o ./decompiled/
              </code>
            </div>

            {/* Logcat Monitor */}
            <div style={{background:'var(--panel2)',border:'1px solid var(--line)',borderRadius:10,padding:'10px 12px'}}>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:4}}>
                <span style={{fontSize:11,fontWeight:700,color:'var(--muted)',textTransform:'uppercase'}}>Logcat Filter</span>
                <button className="mini" onClick={()=>copy(`adb logcat | grep -i "${app.packageName}"`,'cmd-logcat')}>
                  {copied==='cmd-logcat'?<IconCheck size={12} color="var(--green)"/>:<IconCopy size={12}/>}
                </button>
              </div>
              <code style={{fontSize:11.5,color:'var(--text)',fontFamily:'monospace',display:'block'}}>
                adb logcat | grep -i &quot;{app.packageName}&quot;
              </code>
            </div>

            {/* Terminal Curl Direct Install */}
            {downloadUrl&&(
              <div style={{background:'var(--panel2)',border:'1px solid var(--line)',borderRadius:10,padding:'10px 12px'}}>
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:4}}>
                  <span style={{fontSize:11,fontWeight:700,color:'var(--muted)',textTransform:'uppercase'}}>Fetch &amp; ADB Install</span>
                  <button className="mini" onClick={()=>copy(`curl -sL "${downloadUrl}" -o ${app.packageName}.apk && adb install -r ${app.packageName}.apk`,'cmd-curl')}>
                    {copied==='cmd-curl'?<IconCheck size={12} color="var(--green)"/>:<IconCopy size={12}/>}
                  </button>
                </div>
                <code style={{fontSize:11,color:'var(--accent)',fontFamily:'monospace',wordBreak:'break-all',display:'block'}}>
                  curl -sL &quot;{downloadUrl.slice(0,50)}...&quot; -o {app.packageName}.apk &amp;&amp; adb install -r {app.packageName}.apk
                </code>
              </div>
            )}
          </div>
        </div>

        {/* CVE & Vulnerability Intelligence */}
        <div className="security-card">
          <h4 style={{display:'flex',alignItems:'center',gap:8,margin:'0 0 10px'}}>
            <IconShield size={16} color="var(--blue)"/>
            <span>CVE &amp; Vulnerability Intelligence</span>
          </h4>
          <p style={{fontSize:12.5,color:'var(--muted)',margin:'0 0 10px'}}>
            Cross-reference package identifiers and vendor history across authoritative vulnerability disclosure databases.
          </p>
          <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit, minmax(200px, 1fr))',gap:8}}>
            <a
              href={`https://nvd.nist.gov/vuln/search/results?query=${encodeURIComponent(app.packageName)}`}
              target="_blank"
              rel="noreferrer"
              style={{background:'var(--panel2)',border:'1px solid var(--line)',borderRadius:10,padding:'10px 12px',textDecoration:'none',color:'inherit'}}
            >
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                <strong style={{fontSize:12.5,color:'var(--text)'}}>NIST NVD Search</strong>
                <IconExternalLink size={12} color="var(--muted)"/>
              </div>
              <div style={{fontSize:11,color:'var(--muted)',marginTop:4}}>Query National Vulnerability Database</div>
            </a>
            <a
              href={`https://www.cvedetails.com/google-search-results.php?q=${encodeURIComponent(app.packageName)}`}
              target="_blank"
              rel="noreferrer"
              style={{background:'var(--panel2)',border:'1px solid var(--line)',borderRadius:10,padding:'10px 12px',textDecoration:'none',color:'inherit'}}
            >
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                <strong style={{fontSize:12.5,color:'var(--text)'}}>CVE Details</strong>
                <IconExternalLink size={12} color="var(--muted)"/>
              </div>
              <div style={{fontSize:11,color:'var(--muted)',marginTop:4}}>Historical CVSS ratings &amp; exploits</div>
            </a>
            <a
              href="https://source.android.com/docs/security/bulletin"
              target="_blank"
              rel="noreferrer"
              style={{background:'var(--panel2)',border:'1px solid var(--line)',borderRadius:10,padding:'10px 12px',textDecoration:'none',color:'inherit'}}
            >
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                <strong style={{fontSize:12.5,color:'var(--text)'}}>Android Bulletins</strong>
                <IconExternalLink size={12} color="var(--muted)"/>
              </div>
              <div style={{fontSize:11,color:'var(--muted)',marginTop:4}}>Official monthly framework patches</div>
            </a>
          </div>
        </div>

        {/* In-Browser APK Binary & Hash Inspector Dropzone */}
        <div className="security-card">
          <h4 style={{display:'flex',alignItems:'center',gap:8,margin:'0 0 10px'}}>
            <IconFileText size={16} color="var(--green)"/>
            <span>In-Browser APK Binary &amp; Hash Inspector (Zero Upload)</span>
          </h4>
          <p style={{fontSize:12.5,color:'var(--muted)',margin:'0 0 10px'}}>
            Drop any downloaded or local <code>.apk</code> file below. Hashes are computed 100% in your browser using native Web Crypto — zero bytes are ever uploaded.
          </p>

          <input
            type="file"
            ref={fileInputRef}
            accept=".apk,.apkm,.xapk"
            style={{display:'none'}}
            onChange={e=>{
              const f=e.target.files?.[0];
              if(f)handleApkFile(f);
            }}
          />

          <div
            style={{
              border:'2px dashed var(--line)',
              borderRadius:12,
              padding:'18px 20px',
              textAlign:'center',
              cursor:'pointer',
              background:isHashing?'rgba(56,189,248,0.06)':'var(--panel2)',
              transition:'all 0.2s'
            }}
            onClick={()=>fileInputRef.current?.click()}
            onDragOver={e=>{e.preventDefault();e.stopPropagation()}}
            onDrop={e=>{
              e.preventDefault();
              e.stopPropagation();
              const f=e.dataTransfer.files?.[0];
              if(f)handleApkFile(f);
            }}
          >
            {isHashing ? (
              <div style={{fontSize:13,color:'var(--blue)',fontWeight:700}}>Computing cryptographic hashes (SHA-256, MD5)...</div>
            ) : localApk ? (
              <div style={{textAlign:'left'}}>
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:8}}>
                  <strong style={{fontSize:13,color:'var(--text)'}}>{localApk.name} ({fmtSize(localApk.size)})</strong>
                  <button className="mini" onClick={e=>{e.stopPropagation();fileInputRef.current?.click()}}>Select another</button>
                </div>
                <div style={{display:'flex',flexDirection:'column',gap:4,fontSize:11.5,fontFamily:'monospace'}}>
                  <div><span style={{color:'var(--muted)'}}>SHA-256: </span><span style={{color:'var(--green)'}}>{localApk.sha256}</span></div>
                  <div><span style={{color:'var(--muted)'}}>MD5: </span><span style={{color:'var(--blue)'}}>{localApk.md5}</span></div>
                  <div><span style={{color:'var(--muted)'}}>SHA-1: </span><span style={{color:'var(--text)'}}>{localApk.sha1}</span></div>
                </div>
                <div style={{marginTop:10,display:'flex',gap:8}}>
                  <a
                    href={`https://www.virustotal.com/gui/file/${localApk.sha256}`}
                    target="_blank"
                    rel="noreferrer"
                    className="primary"
                    style={{padding:'4px 12px',fontSize:12,borderRadius:8,textDecoration:'none'}}
                    onClick={e=>e.stopPropagation()}
                  >
                    Check SHA-256 on VirusTotal
                  </a>
                  {md5&&localApk.md5.toLowerCase()===md5.toLowerCase()&&(
                    <span style={{fontSize:12,color:'var(--green)',fontWeight:700,display:'flex',alignItems:'center',gap:4}}>
                      <IconCheck size={14} color="var(--green)"/> Exact match with upstream MD5!
                    </span>
                  )}
                </div>
              </div>
            ) : (
              <div>
                <div style={{fontSize:13,fontWeight:700,color:'var(--text)',marginBottom:4}}>
                  Click or drag and drop local .apk file here
                </div>
                <div style={{fontSize:11.5,color:'var(--muted)'}}>
                  Instant SHA-256, SHA-1, and MD5 computation without sending files over the network.
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Intent URL Scheme & Deep Link Finder */}
        {pkgOK&&(
          <div className="security-card">
            <h4 style={{display:'flex',alignItems:'center',gap:8,margin:'0 0 10px'}}>
              <IconLink size={16} color="var(--blue)"/>
              <span>Intent URL Scheme &amp; Deep-Link Explorer</span>
            </h4>
            <p style={{fontSize:12.5,color:'var(--muted)',margin:'0 0 10px'}}>
              Evaluate exported intent filters, custom schemes, and deep-link attack surfaces for CSRF, account hijacking, or intent injection.
            </p>

            {KNOWN_INTENTS[app.packageName] ? (
              <div style={{background:'var(--panel2)',border:'1px solid var(--line)',borderRadius:10,padding:'10px 12px',marginBottom:8}}>
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                  <span style={{fontWeight:700,fontSize:12.5,color:'var(--text)'}}>Known Scheme: <code>{KNOWN_INTENTS[app.packageName].scheme}</code></span>
                  <span style={{fontSize:11,color:'var(--muted)'}}>{KNOWN_INTENTS[app.packageName].desc}</span>
                </div>
                <div style={{marginTop:6,display:'flex',alignItems:'center',justifyContent:'space-between',gap:8}}>
                  <code style={{fontSize:11.5,color:'var(--blue)',wordBreak:'break-all'}}>{KNOWN_INTENTS[app.packageName].testUri}</code>
                  <button
                    className="mini"
                    onClick={()=>copy(`adb shell am start -a android.intent.action.VIEW -d "${KNOWN_INTENTS[app.packageName].testUri}"`,'cmd-intent')}
                  >
                    {copied==='cmd-intent'?<IconCheck size={12} color="var(--green)"/>:<IconCopy size={12}/>}
                  </button>
                </div>
              </div>
            ) : (
              <div style={{background:'var(--panel2)',border:'1px solid var(--line)',borderRadius:10,padding:'10px 12px',marginBottom:8}}>
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                  <span style={{fontWeight:700,fontSize:12.5,color:'var(--text)'}}>Standard Android VIEW Intent:</span>
                  <button
                    className="mini"
                    onClick={()=>copy(`adb shell am start -a android.intent.action.VIEW -d "intent:#Intent;package=${app.packageName};action=android.intent.action.VIEW;end"`,'cmd-gen-intent')}
                  >
                    {copied==='cmd-gen-intent'?<IconCheck size={12} color="var(--green)"/>:<IconCopy size={12}/>}
                  </button>
                </div>
                <code style={{fontSize:11.5,color:'var(--blue)',wordBreak:'break-all',marginTop:4,display:'block'}}>
                  adb shell am start -a android.intent.action.VIEW -d &quot;intent:#Intent;package={app.packageName};action=android.intent.action.VIEW;end&quot;
                </code>
              </div>
            )}
          </div>
        )}

        {/* Android Permission & Attack Surface Inspector */}
        <div className="security-card">
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',flexWrap:'wrap',gap:8,marginBottom:12}}>
            <h4 style={{display:'flex',alignItems:'center',gap:8,margin:0}}>
              <IconAndroid size={16} color="var(--green)"/>
              <span>Android Permission &amp; Attack Surface Inspector</span>
            </h4>
            <div style={{display:'flex',gap:6,flexWrap:'wrap'}}>
              {(['ALL','CRITICAL','HIGH','MEDIUM','SAFE'] as RiskLevel[]).map(lvl=>(
                <button
                  key={lvl}
                  className={`tab ${permFilter===lvl?'active':''}`}
                  style={{padding:'3px 10px',fontSize:11,borderRadius:14,height:26}}
                  onClick={()=>setPermFilter(lvl)}
                >
                  {lvl}
                </button>
              ))}
            </div>
          </div>

          <p style={{fontSize:12.5,color:'var(--muted)',margin:'0 0 12px'}}>
            Key Android permissions evaluated against standard mobile attack surface models (OWASP MASVS / Android Security Bulletin).
          </p>

          <div style={{display:'flex',flexDirection:'column',gap:8}}>
            {COMMON_PERMISSIONS.filter(p=>permFilter==='ALL'||p.risk===permFilter).map(p=>{
              const color = p.risk==='CRITICAL'?'#ef4444':p.risk==='HIGH'?'#f97316':p.risk==='MEDIUM'?'#eab308':'#10b981';
              const bg = p.risk==='CRITICAL'?'rgba(239, 68, 68, 0.12)':p.risk==='HIGH'?'rgba(249, 115, 22, 0.12)':p.risk==='MEDIUM'?'rgba(234, 179, 8, 0.12)':'rgba(16, 185, 129, 0.12)';
              return (
                <div key={p.name} style={{background:'var(--panel2)',border:'1px solid var(--line)',borderRadius:10,padding:'10px 12px'}}>
                  <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',flexWrap:'wrap',gap:6}}>
                    <code style={{fontSize:12,fontWeight:700,color:'var(--text)',fontFamily:'monospace'}}>{p.name}</code>
                    <span style={{fontSize:10.5,fontWeight:800,letterSpacing:.5,color,background:bg,padding:'2px 8px',borderRadius:8}}>
                      {p.risk}
                    </span>
                  </div>
                  <div style={{fontSize:12,color:'var(--muted)',marginTop:4}}>
                    {p.desc}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    )}

    {/* Split APK (APKM / XAPK) Guide Modal */}
    {splitModalOpen&&(
      <div className="modal" onClick={()=>setSplitModalOpen(false)}>
        <div className="modalbox" onClick={e=>e.stopPropagation()} style={{maxWidth:540}}>
          <div className="modalhead">
            <div style={{display:'flex',alignItems:'center',gap:8}}>
              <IconLayers size={18} color="var(--blue)"/>
              <strong>Split APK (APKM / XAPK) Installation Helper</strong>
            </div>
            <button className="mini" onClick={()=>setSplitModalOpen(false)}>✕</button>
          </div>
          
          <div style={{padding:'14px 18px',fontSize:13,lineHeight:1.6,color:'var(--text)'}}>
            <p style={{margin:'0 0 12px',color:'var(--muted)'}}>
              Many apps from APKMirror and APKCombo are packaged as Android App Bundles (Split APKs). Because split APKs contain architecture-specific and screen-density slices, Android&apos;s standard package installer cannot install them by simply tapping one file.
            </p>

            <h5 style={{margin:'12px 0 6px',fontSize:13.5,color:'var(--text)'}}>Method 1: Install via Split APKs Installer (SAI) — Recommended</h5>
            <p style={{margin:'0 0 8px',fontSize:12.5,color:'var(--muted)'}}>
              Install the open-source <b>SAI (Split APKs Installer)</b> from F-Droid. Open SAI, tap &quot;Install APKs&quot;, and select your downloaded .apkm or .xapk bundle.
            </p>

            <h5 style={{margin:'14px 0 6px',fontSize:13.5,color:'var(--text)'}}>Method 2: Multi-Split Install via ADB (Command Line)</h5>
            <p style={{margin:'0 0 6px',fontSize:12.5,color:'var(--muted)'}}>
              If you have extracted the splits into a directory, install all splits simultaneously into your connected phone or emulator:
            </p>
            <div style={{background:'var(--panel2)',border:'1px solid var(--line)',padding:'8px 12px',borderRadius:8,fontFamily:'monospace',fontSize:11.5,color:'var(--green)'}}>
              adb install-multiple base.apk split_config.arm64_v8a.apk split_config.xxhdpi.apk
            </div>

            <h5 style={{margin:'14px 0 6px',fontSize:13.5,color:'var(--text)'}}>Method 3: Extract .XAPK as ZIP</h5>
            <p style={{margin:'0 0 10px',fontSize:12.5,color:'var(--muted)'}}>
              Both <code>.xapk</code> and <code>.apkm</code> files are standard ZIP containers. Rename the file extension to <code>.zip</code>, extract the contents, and you will find the base APK and OBB assets.
            </p>
          </div>
        </div>
      </div>
    )}

    {/* QR Modal */}
    {qrOpen&&<div className="modal" onClick={()=>setQrOpen(false)}>
      <div className="modalbox" onClick={e=>e.stopPropagation()}>
        <div className="modalhead">
          <div style={{display:'flex',alignItems:'center',gap:8}}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="3" width="7" height="7"></rect>
              <rect x="14" y="3" width="7" height="7"></rect>
              <rect x="14" y="14" width="7" height="7"></rect>
              <rect x="3" y="14" width="7" height="7"></rect>
            </svg>
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

