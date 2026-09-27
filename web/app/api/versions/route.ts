import {NextRequest,NextResponse} from 'next/server';
import {getVersions} from '../../../lib/detail';
import {cached} from '../../../lib/core';
import {rateLimit,clientIp} from '../../../lib/ratelimit';

export const runtime='edge';

export async function GET(req:NextRequest){
  const pkg=req.nextUrl.searchParams.get('pkg')?.trim();
  const name=req.nextUrl.searchParams.get('name')?.trim()||undefined;
  if(!pkg)return NextResponse.json({versions:[]});
  const rl=rateLimit(`ver:${clientIp(req.headers)}`,30,60000);
  if(!rl.ok)return NextResponse.json({error:'rate_limited'},{status:429,headers:{'retry-after':String(rl.retryAfter)}});
  const versions=await cached(`ver:${pkg}:${name||''}`,600000,()=>getVersions(pkg,name));
  return NextResponse.json({versions},{headers:{'cache-control':'public, s-maxage=600, stale-while-revalidate=1800'}});
}
