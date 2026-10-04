'use client';
import {useState,useEffect} from 'react';
import {useUI} from './Providers';
import {IconSun,IconMoon,IconShield,IconWrench} from './Icons';

export function TopBar(){
  const {t,theme,toggleTheme,lang,setLang}=useUI();
  const [aboutOpen,setAboutOpen]=useState(false);
  const [activeHash,setActiveHash]=useState('apps');

  useEffect(()=>{
    const handleHash=()=>{
      const h=window.location.hash.replace('#','');
      setActiveHash(h||'apps');
    };
    handleHash();
    window.addEventListener('hashchange',handleHash);
    const onTab=(e:Event)=>{
      const custom=e as CustomEvent<string>;
      if(custom.detail)setActiveHash(custom.detail);
    };
    window.addEventListener('apkscope:tab',onTab);
    return ()=>{
      window.removeEventListener('hashchange',handleHash);
      window.removeEventListener('apkscope:tab',onTab);
    };
  },[]);

  function switchNav(id:string){
    setActiveHash(id);
    try{history.pushState(null,'',`#${id}`)}catch{}
    window.dispatchEvent(new CustomEvent('apkscope:tab',{detail:id}));
    const el=document.getElementById(id);
    if(el){
      el.scrollIntoView({behavior:'smooth'});
    }
  }

  return <>
    <header className="nav">
      <a href="/#apps" className="logo" onClick={e=>{e.preventDefault();switchNav('apps')}}>
        <div className="logo-icon">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
            <path d="M4 4.5C4 3.67 4.9 3.17 5.6 3.6L19.4 11.1C20.1 11.5 20.1 12.5 19.4 12.9L5.6 20.4C4.9 20.8 4 20.3 4 19.5V4.5Z" fill="url(#storeGrad)"/>
            <defs>
              <linearGradient id="storeGrad" x1="4" y1="3" x2="20" y2="21" gradientUnits="userSpaceOnUse">
                <stop stopColor="#3b82f6"/>
                <stop offset="0.5" stopColor="#06b6d4"/>
                <stop offset="1" stopColor="#10b981"/>
              </linearGradient>
            </defs>
          </svg>
        </div>
        <div className="logo-text">
          APK<span>Scope</span>
        </div>
        <span className="logo-badge">Store</span>
      </a>

      <nav className="navlinks">
        <button
          className={`navlink ${activeHash==='apps'?'active':''}`}
          onClick={()=>switchNav('apps')}
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
            <rect x="3" y="3" width="7" height="7" rx="1.5"></rect>
            <rect x="14" y="3" width="7" height="7" rx="1.5"></rect>
            <rect x="14" y="14" width="7" height="7" rx="1.5"></rect>
            <rect x="3" y="14" width="7" height="7" rx="1.5"></rect>
          </svg>
          {t('apps')}
        </button>
        <button
          className={`navlink ${activeHash==='sources'?'active':''}`}
          onClick={()=>switchNav('sources')}
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
            <circle cx="12" cy="12" r="10"></circle>
            <polygon points="12 6 12 12 16 14"></polygon>
          </svg>
          {t('sources')}
        </button>
        <button
          className={`navlink ${activeHash==='tools'?'active':''}`}
          onClick={()=>switchNav('tools')}
        >
          <IconWrench size={15}/>
          {t('tools')}
        </button>
        <button
          className="navlink navbtn"
          onClick={()=>setAboutOpen(true)}
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
            <circle cx="12" cy="12" r="10"></circle>
            <line x1="12" y1="16" x2="12" y2="12"></line>
            <line x1="12" y1="8" x2="12.01" y2="8"></line>
          </svg>
          {t('about')}
        </button>
      </nav>

      <div className="navright">
        <button className="ghostbtn" onClick={()=>setLang(lang==='en'?'hi':'en')} title={t('language')}>
          {lang==='en'?'EN':'हिं'}
        </button>
        <button className="ghostbtn" onClick={toggleTheme} title={t('theme')} aria-label={t('theme')}>
          {theme==='dark'?<IconSun size={15}/>:<IconMoon size={15}/>}
        </button>
        <span className="pill">
          <span className="pill-dot"></span>
          {t('pill')}
        </span>
      </div>
    </header>

    {aboutOpen&&(
      <div className="modal" onClick={()=>setAboutOpen(false)}>
        <div className="modalbox" onClick={e=>e.stopPropagation()} style={{textAlign:'left',maxWidth:520}}>
          <div className="modalhead">
            <div style={{display:'flex',alignItems:'center',gap:8}}>
              <IconShield size={22} color="var(--blue)"/>
              <strong>{t('aboutTitle')}</strong>
            </div>
            <button className="mini" onClick={()=>setAboutOpen(false)}>✕</button>
          </div>
          <p style={{fontSize:13,lineHeight:1.6,color:'var(--muted)',margin:'0 0 14px'}}>
            {t('aboutDescription')}
          </p>

          {/* Developer Card */}
          <div style={{background:'var(--panel2)',padding:'12px 14px',borderRadius:12,border:'1px solid var(--line)',marginBottom:12,display:'flex',justifyContent:'space-between',alignItems:'center',flexWrap:'wrap',gap:10}}>
            <div>
              <div style={{fontSize:11,fontWeight:750,color:'var(--muted)',textTransform:'uppercase',letterSpacing:.5}}>Developer & Security Researcher</div>
              <div style={{fontSize:15,fontWeight:800,color:'var(--text)',marginTop:2}}>JOJIN JOHN</div>
            </div>
            <a
              href="https://www.linkedin.com/in/jojin-john/"
              target="_blank"
              rel="noreferrer"
              className="actionchip"
              style={{background:'rgba(37,99,235,0.15)',borderColor:'rgba(37,99,235,0.35)',color:'#60a5fa',fontWeight:700,padding:'6px 12px',borderRadius:20,fontSize:12.5}}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" style={{marginRight:2}}>
                <path d="M19 3a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h14m-.5 15.5v-5.3a3.26 3.26 0 0 0-3.26-3.26c-.85 0-1.84.52-2.28 1.3v-1.11h-2.79v8.37h2.79v-4.93c0-.77.62-1.4 1.39-1.4a1.4 1.4 0 0 1 1.4 1.4v4.93h2.75M6.46 10.9v8.37H9.2V10.9H6.46M7.83 6.2a1.67 1.67 0 0 0-1.67 1.67c0 .92.75 1.67 1.67 1.67s1.67-.75 1.67-1.67c0-.92-.75-1.67-1.67-1.67Z"/>
              </svg>
              LinkedIn Profile
            </a>
          </div>

          <div style={{background:'var(--panel2)',padding:14,borderRadius:12,border:'1px solid var(--line)',fontSize:12.5,lineHeight:1.6}}>
            <div><b>Multi-Store Discovery:</b> Searches GitHub Releases (FOSS), IzzyOnDroid, Uptodown, Google Play, F-Droid, APKMirror, Aptoide, APKCombo, and TapTap in parallel.</div>
            <div style={{marginTop:6}}><b>Direct Stream:</b> Downloads stream through an allowlisted Cloudflare Worker proxy directly from official servers.</div>
            <div style={{marginTop:6}}><b>Security &amp; Pentest:</b> Android permission attack surface evaluation, ADB 1-click install commands, and Bug Bounty Markdown exporter.</div>
            <div style={{marginTop:6}}><b>Zero Account:</b> No login, no telemetry, no tracking, completely private.</div>
          </div>
          <div style={{marginTop:18,textAlign:'right'}}>
            <button className="primary" onClick={()=>setAboutOpen(false)}>{t('close')}</button>
          </div>
        </div>
      </div>
    )}
  </>;
}

export function Footer(){
  const {t}=useUI();
  return <footer className="footer" id="about">
    <div style={{maxWidth:1520,margin:'0 auto',display:'flex',justifyContent:'space-between',alignItems:'center',flexWrap:'wrap',gap:12}}>
      <div>{t('footer')}</div>
      <div style={{fontSize:12,color:'var(--muted)',display:'flex',alignItems:'center',gap:8,flexWrap:'wrap'}}>
        <span>APKScope • Android Security Discovery</span>
        <span>•</span>
        <span>
          Developed by{' '}
          <a
            href="https://www.linkedin.com/in/jojin-john/"
            target="_blank"
            rel="noreferrer"
            style={{color:'var(--accent)',fontWeight:750,textDecoration:'underline'}}
          >
            JOJIN JOHN
          </a>
        </span>
      </div>
    </div>
  </footer>;
}

