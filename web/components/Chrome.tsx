'use client';
import {useUI} from './Providers';

export function TopBar(){
  const {t,theme,toggleTheme,lang,setLang}=useUI();
  return <header className="nav">
    <a href="/" className="logo">APK<span>Scope</span></a>
    <nav className="navlinks">
      <a href="/#apps">{t('apps')}</a>
      <a href="/#sources">{t('sources')}</a>
      <a href="/#tools">{t('tools')}</a>
      <a href="/#about">{t('about')}</a>
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
  </header>;
}

export function Footer(){
  const {t}=useUI();
  return <footer className="footer" id="about">{t('footer')}</footer>;
}
