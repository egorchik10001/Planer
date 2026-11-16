import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
test('offline documents stay in their account and selected space',async()=>{
 const listeners=new Map(),stores=new Map();let offline=false,delayed=null;
 const caches={async open(name){if(!stores.has(name))stores.set(name,new Map());const store=stores.get(name);return{async put(key,r){store.set(String(key),r.clone());},async match(key){return store.get(String(key))?.clone();},async delete(key){return store.delete(String(key));}};},async keys(){return[...stores.keys()];},async delete(name){return stores.delete(name);}};
 const fetch=async input=>{if(delayed)await delayed;if(offline)throw Error('offline');const u=new URL(typeof input==='object'&&input.url?input.url:String(input));return new Response((u.searchParams.get('user')||'none')+'|'+(u.searchParams.get('space')||'personal'));};
 vm.runInNewContext(await readFile(new URL('../public/sw.js',import.meta.url),'utf8'),{URL,Response,Promise,fetch,caches,self:{location:{origin:'https://planner.test'},skipWaiting(){},clients:{claim(){}},addEventListener(type,fn){listeners.set(type,fn);}}});
 async function message(data){const waits=[];listeners.get('message')({data,waitUntil(p){waits.push(p);}});await Promise.all(waits);}
 async function navigate(path){let response;listeners.get('fetch')({request:{url:'https://planner.test'+path,method:'GET',mode:'navigate'},respondWith(p){response=p;}});return response;}
 await message({type:'SESSION',actorId:'alice'});
 await message({type:'CACHE',actorId:'alice',urls:[],documentUrl:'https://planner.test/'});
 await message({type:'CACHE',actorId:'alice',urls:[],documentUrl:'https://planner.test/?space=team-a'});
 offline=true;
 assert.equal(await(await navigate('/')).text(),'alice|personal');
 assert.equal(await(await navigate('/?space=team-a')).text(),'alice|team-a');
 assert.equal((await navigate('/?space=team-b')).status,503);
 await message({type:'SESSION',actorId:'bob'});
 assert.equal((await navigate('/')).status,503);
 offline=false;await message({type:'CACHE',actorId:'bob',urls:[],documentUrl:'https://planner.test/'});
 // A late message from an old tab cannot select Alice as the active account.
 await message({type:'CACHE',actorId:'alice',urls:[],documentUrl:'https://planner.test/?space=team-a'});
 offline=true;
 assert.equal(await(await navigate('/')).text(),'bob|personal');
 assert.equal((await navigate('/?user=alice&space=team-a')).status,503);
 assert.equal((await navigate('/?space=team-a')).status,503);
 await message({type:'SESSION',actorId:null});
 assert.equal((await navigate('/')).status,503);
 offline=false;await message({type:'SESSION',actorId:'alice'});let release;delayed=new Promise(resolve=>{release=resolve;});const late=message({type:'CACHE',actorId:'alice',urls:[],documentUrl:'https://planner.test/'});await new Promise(resolve=>setImmediate(resolve));await message({type:'SESSION',actorId:null});release();await late;delayed=null;offline=true;assert.equal((await navigate('/')).status,503);
});
