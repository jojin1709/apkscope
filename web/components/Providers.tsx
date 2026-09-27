'use client';
import {createContext,useContext,useState,useEffect,useCallback} from 'react';
import {translate,type Lang,type Dict} from '../lib/i18n';

type Theme='light'|'dark';
type UIState={
  theme:Theme;
  toggleTheme:()=>void;
  lang:Lang;
  setLang:(l:Lang)=>void;
  t:(k:Dict)=>string;
};

const Ctx=createContext<UIState>({
  theme:'light',
  toggleTheme:()=>{},
  lang:'en',
  setLang:()=>{},
  t:k=>translate('en',k)
});

export function useUI(){return useContext(Ctx)}

const THEME_KEY='apkscope:theme';
const LANG_KEY='apkscope:lang';

export function Providers({children}:{children:React.ReactNode}){
  const [theme,setTheme]=useState<Theme>('light');
  const [lang,setLangState]=useState<Lang>('en');

  useEffect(()=>{
    try{
      const saved=localStorage.getItem(THEME_KEY)as Theme|null;
      const prefers=window.matchMedia&&window.matchMedia('(prefers-color-scheme: dark)').matches;
      const t=saved||(prefers?'dark':'light');
      setTheme(t);
      document.documentElement.dataset.theme=t;
      const l=localStorage.getItem(LANG_KEY)as Lang|null;
      if(l==='hi'||l==='en')setLangState(l);
    }catch{}
  },[]);

  const applyTheme=useCallback((t:Theme)=>{
    setTheme(t);
    document.documentElement.dataset.theme=t;
    try{localStorage.setItem(THEME_KEY,t)}catch{}
  },[]);

  const setLang=useCallback((l:Lang)=>{
    setLangState(l);
    try{localStorage.setItem(LANG_KEY,l)}catch{}
  },[]);

  const toggleTheme=useCallback(()=>setTheme(t=>{
    const n=t==='dark'?'light':'dark';
    document.documentElement.dataset.theme=n;
    try{localStorage.setItem(THEME_KEY,n)}catch{}
    return n;
  }),[]);

  const t=useCallback((k:Dict)=>translate(lang,k),[lang]);

  return <Ctx.Provider value={{theme,toggleTheme,lang,setLang,t}}>{children}</Ctx.Provider>;
}
