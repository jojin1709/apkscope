const CACHE='apkscope-shell-v1';

self.addEventListener('install',()=>{self.skipWaiting()});
self.addEventListener('activate',e=>{
  e.waitUntil((async()=>{
    const keys=await caches.keys();
    await Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch',e=>{
  const req=e.request;
  if(req.method!=='GET')return;
  let url;
  try{url=new URL(req.url)}catch{return}
  if(url.origin!==location.origin)return;
  if(url.pathname.startsWith('/api/'))return;

  if(url.pathname.startsWith('/_next/static/')){
    e.respondWith((async()=>{
      const c=await caches.open(CACHE);
      const hit=await c.match(req);
      if(hit)return hit;
      const res=await fetch(req);
      if(res.ok)c.put(req,res.clone());
      return res;
    })());
    return;
  }

  if(req.mode==='navigate'){
    e.respondWith((async()=>{
      try{
        const res=await fetch(req);
        const c=await caches.open(CACHE);
        c.put('/',res.clone());
        return res;
      }catch{
        const c=await caches.open(CACHE);
        return (await c.match('/'))||(await c.match(req))||Response.error();
      }
    })());
  }
});
