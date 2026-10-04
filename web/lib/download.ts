export type Progress={loaded:number;total:number;pct:number};

function filenameFrom(headers:Headers,url:string):string{
  const cd=headers.get('content-disposition')||'';
  const m=cd.match(/filename="?([^";]+)"?/i);
  if(m&&m[1])return m[1].trim();
  try{
    const path=new URL(url).pathname.split('/').pop()||'';
    const base=decodeURIComponent(path).replace(/[^\w.\- ]/g,'_');
    if(/\.apk$/i.test(base))return base;
    if(base)return base.split('.')[0]+'.apk';
  }catch{}
  return 'app.apk';
}

function triggerDirectDownload(url:string,name:string){
  try{
    const a=document.createElement('a');
    a.href=url;
    a.download=name;
    a.target='_blank';
    a.rel='noopener noreferrer';
    document.body.appendChild(a);
    a.click();
    a.remove();
  }catch{}
}

export async function downloadWithProgress(url:string,onProgress:(p:Progress)=>void,signal?:AbortSignal):Promise<'done'|'cancelled'>{
  try{
    const res=await fetch(url,{signal,referrerPolicy:'no-referrer'});
    if(!res.ok)throw new Error(`Download failed (${res.status})`);
    const total=Number(res.headers.get('content-length'))||0;
    const name=filenameFrom(res.headers,url);

    // If file is over 120MB, stream directly to browser download to prevent RAM exhaustion on mobile
    if(total>120*1048576){
      triggerDirectDownload(url,name);
      onProgress({loaded:total,total,pct:100});
      return 'done';
    }

    if(!res.body){
      const buf=await res.arrayBuffer();
      saveBlob(new Blob([buf]),name);
      onProgress({loaded:buf.byteLength,total:buf.byteLength,pct:100});
      return 'done';
    }
    const reader=res.body.getReader();
    const chunks:Uint8Array[]=[];
    let loaded=0;
    for(;;){
      const {done,value}=await reader.read();
      if(done)break;
      if(value){
        chunks.push(value);
        loaded+=value.length;
        onProgress({loaded,total,pct:total?Math.min(99,Math.floor(loaded/total*100)):0});
      }
    }
    const blob=new Blob(chunks as BlobPart[],{type:'application/vnd.android.package-archive'});
    saveBlob(blob,name);
    onProgress({loaded,total:total||loaded,pct:100});
    return 'done';
  }catch(e){
    triggerDirectDownload(url,'app.apk');
    throw e;
  }
}

function saveBlob(blob:Blob,name:string){
  const href=URL.createObjectURL(blob);
  const a=document.createElement('a');
  a.href=href;
  a.download=name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(()=>URL.revokeObjectURL(href),60000);
}
