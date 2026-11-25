const CACHE='mochang-pages-v6-art-assets';
const ASSETS=['./','./index.html','./cloud.js?v=art1','./manifest.webmanifest','./icon.svg','./icon-192.png','./icon-512.png'];
const root=self.registration.scope;
const url=path=>new URL(path,root).href;
self.addEventListener('install',event=>{
 event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(ASSETS.map(url))).then(()=>self.skipWaiting()));
});
self.addEventListener('activate',event=>{
 event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('mochang-pages-')&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));
});
self.addEventListener('fetch',event=>{
 const request=event.request;
 const requested=new URL(request.url);
 if(request.method!=='GET'||requested.origin!==location.origin||!requested.pathname.startsWith(new URL(root).pathname))return;
 if(request.mode==='navigate'){
  event.respondWith(fetch(request).then(response=>{if(response.ok){const copy=response.clone();caches.open(CACHE).then(c=>c.put(url('./index.html'),copy))}return response}).catch(()=>caches.match(url('./index.html'))));return;
 }
 event.respondWith(caches.match(request).then(cached=>cached||fetch(request).then(response=>{if(response.ok){const copy=response.clone();caches.open(CACHE).then(c=>c.put(request,copy))}return response})));
});