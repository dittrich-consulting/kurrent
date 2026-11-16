const CACHE='kurrent-practice-0a77523a482e';
const ASSETS=["./","index.html","app.js","pwa.js","style.css","matcher.js","worker.js","structure.js","motion-curves.js","motion-attachments.js","motion-paths.js","motion-library.js","confirmed-motions.js","18thCtrKurTxt.ttf","manifest.webmanifest","icon-192.png","icon-512.png"];
const urls=ASSETS.map(p=>new URL(p,self.registration.scope).href);
self.addEventListener('install',e=>e.waitUntil((async()=>{const cache=await caches.open(CACHE);try{await cache.addAll(urls);}catch(error){await caches.delete(CACHE);throw error;}})()));
self.addEventListener('activate',e=>e.waitUntil((async()=>{for(const key of await caches.keys())if(key.startsWith('kurrent-practice-')&&key!==CACHE)await caches.delete(key);await self.clients.claim();})()));
self.addEventListener('message',e=>{if(e.data==='ACTIVATE')self.skipWaiting();});
self.addEventListener('fetch',e=>{
 if(e.request.method!=='GET'||new URL(e.request.url).origin!==self.location.origin)return;
 e.respondWith((async()=>{const cache=await caches.open(CACHE);const cached=await cache.match(e.request,{ignoreSearch:true});if(cached)return cached;
  try{return await fetch(e.request);}catch(error){if(e.request.mode==='navigate'){const shell=await cache.match(new URL('./',self.registration.scope).href);if(shell)return shell;}throw error;}
 })());
});
