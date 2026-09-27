const buckets=new Map<string,number[]>();

export function clientIp(headers:Headers):string{
  const fwd=headers.get('x-forwarded-for');
  if(fwd)return fwd.split(',')[0].trim();
  const real=headers.get('x-real-ip');
  if(real)return real;
  return 'anon';
}

export function rateLimit(key:string,limit:number,windowMs:number):{ok:boolean;retryAfter:number}{
  const now=Date.now();
  const list=(buckets.get(key)||[]).filter(t=>now-t<windowMs);
  if(buckets.size>2000)buckets.clear();
  if(list.length>=limit){
    const retryAfter=Math.max(1,Math.ceil((list[0]+windowMs-now)/1000));
    buckets.set(key,list);
    return {ok:false,retryAfter};
  }
  list.push(now);
  buckets.set(key,list);
  return {ok:true,retryAfter:0};
}
