'use client';
import {useState,useEffect} from 'react';
import {useUI} from './Providers';

export function TopBar(){
  const {t,theme,toggleTheme,lang,setLang}=useUI();
  const [aboutOpen,setAboutOpen]=useState(false);
  const [activeHash,setActiveHash]=useState('');

  useEffect(()=>{
    const handleHash=()=>setActiveHash(window.location.hash);
    handleHash();
    window.addEventListener('hashchange',handleHash);
    return ()=>window.removeEventListener('hashchange',handleHash);
  },[]);

  function scrollTo(id:string){
    const el=document.getElementById(id);
    if(el){
      el.scrollIntoView({behavior:'smooth'});
      try{history.replaceState(null,'',`#${id}`)}catch{}
      setActiveHash(`#${id}`);
    }
  }

  return <>
    <header className="nav">
      <a href="/" className="logo">
        APK<span>Scope</span>
        <span className="logo-badge">Research</span>
      </a>
      <nav className="navlinks">
        <a
          href="/#apps"
          className={activeHash==='#apps'||!activeHash?'active':''}
          onClick={e=>{e.preventDefault();scrollTo('apps')}}
        >
          {t('apps')}
        </a>
        <a
          href="/#sources"
          className={activeHash==='#sources'?'active':''}
          onClick={e=>{e.preventDefault();scrollTo('sources')}}
        >
          {t('sources')}
        </a>
        <a
          href="/#detailView"
          className={activeHash==='#detailView'?'active':''}
          onClick={e=>{e.preventDefault();scrollTo('detailView')}}
        >
          {t('tools')}
        </a>
        <button
          className="ghostbtn"
          style={{border:'none',background:'transparent',cursor:'pointer',fontSize:14,fontWeight:600}}
          onClick={()=>setAboutOpen(true)}
        >
          {t('about')}
        </button>
      </nav>
      <div className="navright">
        <button className="ghostbtn" onClick={()=>setLang(lang==='en'?'hi':'en')} title={t('language')}>
          {lang==='en'?'EN':'हिं'}
        </button>
        <button className="ghostbtn" onClick={toggleTheme} title={t('theme')} aria-label={t('theme')}>
          {theme==='dark'?'☀':'☾'}
        </button>
        <span className="pill">{t('pill')}</span>
      </div>
    </header>

    {aboutOpen&&(
      <div className="modal" onClick={()=>setAboutOpen(false)}>
        <div className="modalbox" onClick={e=>e.stopPropagation()} style={{textAlign:'left'}}>
          <div className="modalhead">
            <strong>{t('aboutTitle')}</strong>
            <button className="mini" onClick={()=>setAboutOpen(false)}>✕</button>
          </div>
          <p style={{fontSize:13,lineHeight:1.6,color:'var(--muted)',margin:'0 0 14px'}}>
            {t('aboutDescription')}
          </p>
          <div style={{background:'var(--panel2)',padding:12,borderRadius:10,border:'1px solid var(--line)',fontSize:12}}>
            <div><b>Sources:</b> APKMirror, Google Play, Aptoide, APKCombo, TapTap</div>
            <div style={{marginTop:4}}><b>Downloads:</b> Direct streaming via Cloudflare Worker proxy</div>
            <div style={{marginTop:4}}><b>Verification:</b> Real MD5 / SHA-256 signatures & VirusTotal integration</div>
          </div>
          <div style={{marginTop:16,textAlign:'right'}}>
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
    <div style={{maxWidth:1520,margin:'0 auto'}}>
      {t('footer')}
    </div>
  </footer>;
}
