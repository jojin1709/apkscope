import {NextRequest,NextResponse} from 'next/server';
import {searchSources,resolveDownloads,searchCacheKey,RESOLVE_CAP} from '../../../lib/search';
import {cacheGet,cacheSet} from '../../../lib/core';
import {rateLimit,clientIp} from '../../../lib/ratelimit';
import type {App} from '../../../lib/types';

export const runtime='edge';
const TTL=600000;

export async function GET(req:NextRequest){
  const q=req.nextUrl.searchParams.get('q')?.trim();
  if(!q)return NextResponse.json({results:[]});
  const rl=rateLimit(`search:${clientIp(req.headers)}`,15,60000);
  if(!rl.ok)return NextResponse.json({error:'rate_limited'},{status:429,headers:{'retry-after':String(rl.retryAfter)}});
  const key=searchCacheKey(q);
  let results=cacheGet<App[]>(key);
  let dbg:Record<string,string>|undefined;
  if(!results){
    results=await searchSources(q);
    if(!results.length){
      results.push({
        name:q,
        packageName:'Search supported providers',
        version:'—',
        source:'Provider search',
        category:['Android'],
        icon:'',
        sourcePage:`https://www.apkmirror.com/?post_type=app_release&searchtype=apk&s=${encodeURIComponent(q)}`,
        variants:[]
      });
    }else{
      dbg=await resolveDownloads(results,RESOLVE_CAP);
    }
    cacheSet(key,results,TTL);
  }
  const body:Record<string,unknown>={results};
  if(dbg&&process.env.NODE_ENV!=='production')body._dbg=dbg;
  return NextResponse.json(body,{headers:{'cache-control':'public, s-maxage=60, stale-while-revalidate=300'}});
}
