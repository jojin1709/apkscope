import {NextRequest,NextResponse} from 'next/server';
export const runtime='edge';
function esc(s:string){return s.replace(/[&<>\"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'}[m]!))}
export async function GET(req:NextRequest){const q=req.nextUrl.searchParams.get('q')?.trim();if(!q)return NextResponse.json({results:[]});
  // No-key discovery: use public HTML search pages as a best-effort provider index.
  // If a provider blocks server-side retrieval, the UI falls back to its source search URL.
  const providers=[
    {name:'APKMirror',url:`https://www.apkmirror.com/?post_type=app_release&searchtype=apk&s=${encodeURIComponent(q)}`},
    {name:'APKPure',url:`https://apkpure.com/search?q=${encodeURIComponent(q)}`}
  ];
  const results:any[]=[];
  try{
    const target=providers[0].url;
    const r=await fetch(target,{headers:{'user-agent':'Mozilla/5.0 APKScope/1.0'},redirect:'follow',cache:'no-store'});
    if(r.ok){const html=await r.text();const re=/<a[^>]+href=[\"'](https:\/\/www\.apkmirror\.com\/apk\/[^\"']+)[\"'][^>]*>([\s\S]*?)<\/a>/gi;let m;const seen=new Set<string>();while((m=re.exec(html))&&results.length<8){const url=m[1];const title=m[2].replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').trim();if(!seen.has(url)&&title&&title.length>2){seen.add(url);results.push({name:esc(title).replace(/&#39;/g,"'"),packageName:'Open source page for metadata',version:'See source',source:'APKMirror',category:['Android'],icon:'◈',sourcePage:url,variants:[]});}}}
  }catch{}
  if(!results.length)results.push({name:q,packageName:'Search supported providers',version:'—',source:'Provider search',category:['Android'],icon:'◈',sourcePage:providers[0].url,variants:[]});
  return NextResponse.json({results});
}
