import type {MetadataRoute} from 'next';

export default function manifest():MetadataRoute.Manifest{
  return{
    name:'APKScope — Android App Finder',
    short_name:'APKScope',
    description:'Search Android apps across multiple sources and download APKs directly — package names, versions, checksums and signers.',
    start_url:'/',
    scope:'/',
    display:'standalone',
    orientation:'any',
    background_color:'#f5f8fc',
    theme_color:'#1677ff',
    lang:'en',
    categories:['utilities','productivity','developer'],
    icons:[
      {src:'/icon-192.png',sizes:'192x192',type:'image/png'},
      {src:'/icon-512.png',sizes:'512x512',type:'image/png'},
      {src:'/icon-512.png',sizes:'512x512',type:'image/png',purpose:'maskable'}
    ]
  };
}
