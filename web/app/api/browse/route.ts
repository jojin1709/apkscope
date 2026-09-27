import {NextRequest,NextResponse} from 'next/server';
import {apkcomboBrowse,validCat} from '../../../lib/apkcombo';
import {rateLimit,clientIp} from '../../../lib/ratelimit';

export const runtime='edge';

export async function GET(req:NextRequest){
  const cat=req.nextUrl.searchParams.get('cat')?.trim().toLowerCase()||'';
  if(!validCat(cat))return NextResponse.json({error:'unknown category'},{status:400});
  const rl=rateLimit(`browse:${clientIp(req.headers)}`,30,60000);
  if(!rl.ok)return NextResponse.json({error:'rate_limited'},{status:429,headers:{'retry-after':String(rl.retryAfter)}});
  const items=await apkcomboBrowse(cat);
  return NextResponse.json({cat,items},{headers:{'cache-control':'public, s-maxage=900, stale-while-revalidate=3600'}});
}
