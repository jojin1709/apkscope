import {NextRequest,NextResponse} from 'next/server';
import {resolveOne} from '../../../lib/search';
import {through,PKG_RE} from '../../../lib/core';
import {rateLimit,clientIp} from '../../../lib/ratelimit';
import type {App,ResolveMap} from '../../../lib/types';

export const runtime='edge';

type Req={p?:string;n?:string};

export async function GET(req:NextRequest){
  const raw=req.nextUrl.searchParams.get('items')||'';
  const rl=rateLimit(`resolve:${clientIp(req.headers)}`,40,60000);
  if(!rl.ok)return NextResponse.json({error:'rate_limited'},{status:429,headers:{'retry-after':String(rl.retryAfter)}});
  let items:Req[]=[];
  try{
    const parsed=JSON.parse(raw);
    if(Array.isArray(parsed))items=parsed.slice(0,12);
  }catch{}
  const map:ResolveMap={};
  await Promise.all(items.map(async it=>{
    const pkg=typeof it.p==='string'?it.p:'';
    const name=typeof it.n==='string'?it.n:'';
    if(!pkg||!PKG_RE.test(pkg)||map[pkg])return;
    const target:App={
      name:name||pkg,packageName:pkg,version:'—',source:'Resolver',
      category:['Android'],icon:'',sourcePage:'',variants:[]
    };
    const how=await resolveOne(target);
    if(how!=='none'&&how!=='skip'&&target.download){
      map[pkg]={
        download:through(target.download),
        size:target.size||0,
        md5:target.md5||'',
        version:target.version&&target.version!=='—'?target.version:'',
        signer:target.signer||'',
        rank:target.rank||'',
        store:target.store||''
      };
    }
  }));
  return NextResponse.json({map},{headers:{'cache-control':'public, s-maxage=300'}});
}
