import {NextRequest,NextResponse} from 'next/server';
import {getAppDetail,getVersions} from '../../../lib/detail';
import {rateLimit,clientIp} from '../../../lib/ratelimit';

export const runtime='edge';

export async function GET(req:NextRequest){
  const pkg=req.nextUrl.searchParams.get('pkg')?.trim()||'';
  const name=req.nextUrl.searchParams.get('name')?.trim()||'';
  if(!pkg&&!name)return NextResponse.json({error:'pkg or name is required'},{status:400});
  const rl=rateLimit(`app:${clientIp(req.headers)}`,30,60000);
  if(!rl.ok)return NextResponse.json({error:'rate_limited'},{status:429,headers:{'retry-after':String(rl.retryAfter)}});
  const [app,versions]=await Promise.all([getAppDetail(pkg,name),getVersions(pkg,name)]);
  return NextResponse.json({app,versions},{headers:{'cache-control':'public, s-maxage=600, stale-while-revalidate=1800'}});
}
