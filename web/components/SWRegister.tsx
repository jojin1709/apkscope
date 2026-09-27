'use client';
import {useEffect} from 'react';

export function SWRegister(){
  useEffect(()=>{
    if(process.env.NODE_ENV!=='production')return;
    if(!('serviceWorker' in navigator))return;
    const reg=()=>{navigator.serviceWorker.register('/sw.js').catch(()=>{})};
    if(document.readyState==='complete')reg();
    else window.addEventListener('load',reg,{once:true});
    return()=>window.removeEventListener('load',reg);
  },[]);
  return null;
}
