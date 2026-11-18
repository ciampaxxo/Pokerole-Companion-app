// Master Pokérole — funzionamento offline e aggiornamenti automatici
const CACHE='master-pokerole';
const FILES=['./','index.html','diario.html','manifest.webmanifest','diario.webmanifest','icon-192.png','icon-512.png','icon-maskable.png','apple-touch-icon.png'];
self.addEventListener('install',e=>{e.waitUntil(caches.open(CACHE).then(c=>c.addAll(FILES.map(f=>new Request(f,{cache:'reload'})))).then(()=>self.skipWaiting()))});
self.addEventListener('activate',e=>{e.waitUntil(self.clients.claim())});
const sig=r=>r&&(r.headers.get('etag')||r.headers.get('last-modified')||r.headers.get('content-length'));
self.addEventListener('fetch',e=>{
  const req=e.request;if(req.method!=='GET'||new URL(req.url).origin!==location.origin)return;
  const u=new URL(req.url);if(u.pathname.endsWith('/diario.json'))return; // sempre dalla rete: lo legge la pagina
  const nav=req.mode==='navigate';const key=nav?new URL(u.pathname.endsWith('/index.html')?'./':u.pathname,location.href).href:req;
  e.respondWith(caches.open(CACHE).then(async c=>{
    const cached=await c.match(key,{ignoreSearch:true});
    const net=fetch(nav?key:req.url,{cache:'no-cache'}).then(async r=>{
      if(r&&r.ok){const changed=cached&&sig(cached)!==sig(r);await c.put(key,r.clone());
        if(changed&&nav){(await self.clients.matchAll()).forEach(cl=>cl.postMessage('aggiornata'))}}
      return r}).catch(()=>null);
    if(cached){e.waitUntil(net);return cached}
    return (await net)||new Response('Offline',{status:503});
  }));
});
// versione c496017250
