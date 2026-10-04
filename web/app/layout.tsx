import './globals.css';
import type {Metadata,Viewport} from 'next';
import {Providers} from '../components/Providers';
import {TopBar,Footer} from '../components/Chrome';
import {SWRegister} from '../components/SWRegister';

const SITE='https://apkscope.vercel.app';

export const metadata:Metadata={
  metadataBase:new URL(SITE),
  title:{default:'APKScope — Android App Finder for Security Research',template:'%s | APKScope'},
  description:'Search Android apps across APKMirror, Google Play, Aptoide, APKCombo and TapTap. Get package names, versions, checksums, signers and direct APK downloads — no login.',
  applicationName:'APKScope',
  keywords:['apk','android','download','apkmirror','aptoide','apkpure','security research','reverse engineering','package name'],
  openGraph:{
    type:'website',
    siteName:'APKScope',
    title:'APKScope — Android App Finder for Security Research',
    description:'Find Android app builds, versions, checksums and direct download links without login.',
    images:[{url:'/icon-512.png',width:512,height:512,alt:'APKScope'}]
  },
  twitter:{
    card:'summary',
    title:'APKScope — Android App Finder for Security Research',
    description:'Find Android app builds, versions, checksums and direct download links without login.',
    images:['/icon-512.png']
  },
  appleWebApp:{capable:true,title:'APKScope'},
  icons:{
    icon:[
      {url:'/favicon.ico',sizes:'any'},
      {url:'/favicon.svg',type:'image/svg+xml'},
      {url:'/icon-192.png',sizes:'192x192',type:'image/png'},
      {url:'/icon-512.png',sizes:'512x512',type:'image/png'}
    ],
    apple:[
      {url:'/apple-icon.png',sizes:'180x180',type:'image/png'}
    ]
  }
};

export const viewport:Viewport={
  themeColor:[
    {media:'(prefers-color-scheme: light)',color:'#f5f8fc'},
    {media:'(prefers-color-scheme: dark)',color:'#0f1520'}
  ]
};

const themeInit=`try{var p=new URLSearchParams(location.search).get('theme');var t=(p==='dark'||p==='light')?p:(localStorage.getItem('apkscope:theme')||(window.matchMedia&&window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'));document.documentElement.dataset.theme=t}catch(e){}`;

export default function RootLayout({children}:{children:React.ReactNode}){
  return <html lang="en" suppressHydrationWarning>
    <body>
      <script dangerouslySetInnerHTML={{__html:themeInit}}/>
      <Providers>
        <TopBar/>
        {children}
        <Footer/>
      </Providers>
      <SWRegister/>
    </body>
  </html>;
}

