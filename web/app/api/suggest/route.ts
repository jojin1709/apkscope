import {NextRequest,NextResponse} from 'next/server';
import {aptoideSearch} from '../../../lib/aptoide';
import {cached} from '../../../lib/core';
import {rateLimit,clientIp} from '../../../lib/ratelimit';
import type {Suggest} from '../../../lib/types';

export const runtime='edge';

export async function GET(req:NextRequest){
  const q=req.nextUrl.searchParams.get('q')?.trim();
  if(!q||q.length<2)return NextResponse.json({suggestions:[]});
  const rl=rateLimit(`suggest:${clientIp(req.headers)}`,60,60000);
  if(!rl.ok)return NextResponse.json({error:'rate_limited'},{status:429,headers:{'retry-after':String(rl.retryAfter)}});
  const items=await cached(`suggest:${q.toLowerCase()}`,600000,async()=>{
    const list=await aptoideSearch(q,6);
    return list.map((a):Suggest=>({name:a.name,packageName:a.packageName,icon:a.icon,version:a.version}));
  });
  return NextResponse.json({suggestions:items},{headers:{'cache-control':'public, s-maxage=600, stale-while-revalidate=1800'}});
}
