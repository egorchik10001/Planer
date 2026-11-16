const CACHE='planner-shell-v3',DOCUMENTS='planner-documents-v1',META='planner-session-v1';
let sessionEpoch=0,stateWrites=Promise.resolve();
function writeActive(user,epoch){stateWrites=stateWrites.then(async()=>{if(epoch!==sessionEpoch)return;await(await caches.open(META)).put(activeKey,new Response(user||'signed-out'));});return stateWrites;}
const activeKey=new URL('/__planner_active_user__',self.location.origin).href;
async function activeUser(){const r=await(await caches.open(META)).match(activeKey);return r?r.text():null;}
function documentKey(url,user){const key=new URL('/__planner_offline_document__',self.location.origin);key.searchParams.set('user',user);key.searchParams.set('space',url.searchParams.get('space')||'');return key.href;}
self.addEventListener('install',()=>self.skipWaiting());
self.addEventListener('activate',e=>e.waitUntil(Promise.all([self.clients.claim(),caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('planner-shell-')&&k!==CACHE).map(k=>caches.delete(k))))])));
self.addEventListener('message',event=>{
 const d=event.data;
 if(d?.type==='SESSION'){const epoch=++sessionEpoch;event.waitUntil((async()=>{await writeActive(d.actorId,epoch);await caches.delete(DOCUMENTS);})());return;}
 if(d?.type!=='CACHE'||typeof d.actorId!=='string')return;
 const epoch=sessionEpoch;event.waitUntil((async()=>{const assets=await caches.open(CACHE);for(const input of d.urls||[]){const u=new URL(input,self.location.origin);if(u.origin===self.location.origin&&/\.(js|css|woff2|svg|png)$/.test(u.pathname))try{const r=await fetch(u);if(r.ok)await assets.put(u,r);}catch{}}
 const url=new URL(d.documentUrl,self.location.origin);if(url.origin!==self.location.origin||url.pathname!=='/')return;
 const requestUrl=new URL(url);requestUrl.searchParams.set('user',d.actorId);
 try{const r=await fetch(requestUrl,{cache:'no-store'});if(!r.ok||r.redirected||epoch!==sessionEpoch)return;const active=await activeUser();if(epoch!==sessionEpoch||(active&&active!==d.actorId))return;const docs=await caches.open(DOCUMENTS),key=documentKey(url,d.actorId);await docs.put(key,r);if(epoch!==sessionEpoch){await docs.delete(key);return;}if(!active)await writeActive(d.actorId,epoch);}catch{}
 })());
});
self.addEventListener('fetch',event=>{
 const u=new URL(event.request.url);if(event.request.method!=='GET'||u.origin!==self.location.origin||u.pathname.startsWith('/api/')||u.pathname==='/login'||u.pathname.startsWith('/join/')||u.searchParams.has('_rsc'))return;
 if(event.request.mode==='navigate'&&u.pathname==='/'){event.respondWith(fetch(event.request).catch(async()=>{const user=await activeUser();if(user&&(!u.searchParams.has('user')||u.searchParams.get('user')===user)){const cached=await(await caches.open(DOCUMENTS)).match(documentKey(u,user));if(cached)return cached;}return new Response('Этот план ещё не загружен для работы без сети. Откройте его после подключения.',{status:503,headers:{'Content-Type':'text/plain;charset=utf-8'}});}));return;}
 if(/\.(js|css|woff2|svg|png)$/.test(u.pathname))event.respondWith(caches.open(CACHE).then(async c=>await c.match(event.request)||fetch(event.request).then(async r=>{if(r.ok)await c.put(event.request,r.clone());return r;})));
});
