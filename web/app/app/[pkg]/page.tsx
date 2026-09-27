import type {Metadata} from 'next';
import {getAppDetail,getVersions} from '../../../lib/detail';
import {AppDetailPanel} from '../../../components/AppDetail';
import type {App} from '../../../lib/types';

const PKG_RE=/^[a-zA-Z]\w*(\.\w+)+$/;
const SITE='https://apkscope.vercel.app';

type Props={params:Promise<{pkg:string}>;searchParams:Promise<{n?:string}>};

function fmtSize(n?:number){
  if(!n)return '';
  const mb=n/1048576;
  return mb>=1?`${mb.toFixed(1)} MB`:`${Math.max(1,Math.round(n/1024))} KB`;
}

export async function generateMetadata({params,searchParams}:Props):Promise<Metadata>{
  const {pkg}=await params;
  const {n=''}=await searchParams;
  if(!PKG_RE.test(pkg))return{title:'APKScope — Android App Finder'};
  const app=await getAppDetail(pkg,typeof n==='string'?n:'');
  const name=app.name||pkg;
  const title=`${name} (${pkg}) — APK download | APKScope`;
  const bits=[`Download ${name}`];
  if(app.version)bits.push(`version ${app.version}`);
  if(app.size)bits.push(fmtSize(app.size));
  bits.push(`package ${pkg}, checksum, signer and version history`);
  const description=bits.join(' · ');
  return{
    title,
    description,
    alternates:{canonical:`${SITE}/app/${pkg}`},
    openGraph:{title,description,images:app.icon?[{url:app.icon,width:96,height:96}]:undefined,siteName:'APKScope',type:'website'},
    twitter:{card:'summary',title,description,images:app.icon?[app.icon]:undefined}
  };
}

export default async function AppPage({params,searchParams}:Props){
  const {pkg}=await params;
  const {n=''}=await searchParams;
  const name=typeof n==='string'?n:'';
  if(!PKG_RE.test(pkg)){
    return <div className="shell"><main style={{maxWidth:820,margin:'60px auto',padding:'0 16px'}}>
      <section className="panel detail"><div className="empty">App not found</div>
      <div style={{textAlign:'center',paddingBottom:24}}><a className="primary" href="/">← Back to search</a></div></section>
    </main></div>;
  }
  const [detail,versions]=await Promise.all([getAppDetail(pkg,name),getVersions(pkg,name)]);
  const view:App={
    name:detail.name||name||pkg,
    packageName:pkg,
    version:detail.version||'—',
    source:detail.store2||'Google Play',
    category:[detail.category||'Android'],
    icon:detail.icon,
    sourcePage:detail.sourcePage||`https://play.google.com/store/apps/details?id=${encodeURIComponent(pkg)}`,
    playUrl:`https://play.google.com/store/apps/details?id=${encodeURIComponent(pkg)}&hl=en`,
    download:detail.download,
    size:detail.size,
    md5:detail.md5,
    signer:detail.signer,
    rank:detail.rank,
    store:detail.store,
    variants:[]
  };
  return <div className="shell">
    <main className="appwrap">
      <AppDetailPanel app={view} versions={versions} verLoading={false} detail={detail} onBack/>
    </main>
  </div>;
}
