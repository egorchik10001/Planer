'use client';
import { useCallback,useEffect,useRef,useState } from 'react';
import { defaultPreferences,type Entity,type Mutation,type Conflict,type Task,type Project,type Preferences } from './planner';
import {apiPath} from './api-path';
import { appendOutbox,outboxPrefix,readOutbox,removeOutbox } from './outbox';
type Rejection={opId:string;id:string;error:string;current:Entity|null};
function combine(a:Entity[],b:Entity[]){const map=new Map(a.map(e=>[e.id,e]));for(const e of b)if(!map.has(e.id)||map.get(e.id)!.version<=e.version)map.set(e.id,e);return[...map.values()];}
function project(base:Entity[],queue:Mutation[]){const map=new Map(base.map(e=>[e.id,e]));for(const op of queue){const e=map.get(op.id);map.set(op.id,{id:op.id,kind:op.kind,data:{...e?.data,...op.changes} as Entity['data'],version:e?.version||0,updatedAt:e?.updatedAt||new Date().toISOString()});}return[...map.values()];}
export function usePlanner(owner:string,spaceId:string|null,actorId:string,localMode=false){
 const key='planner-v1:'+owner;
 const [members,setMembers]=useState<{id:string;name:string;email:string;role:string}[]>([]),[entities,setEntities]=useState<Entity[]>([]),[queue,setQueue]=useState<Mutation[]>([]),[ready,setReady]=useState(false),[syncState,setSyncState]=useState('loading'),[error,setError]=useState(''),[conflictList,setConflicts]=useState<Conflict[]>([]),[rejected,setRejected]=useState<Rejection[]>([]);
 const base=useRef<Entity[]>([]),local=useRef<Entity[]>([]),busy=useRef(false),alive=useRef(true),conflicts=useRef<Conflict[]>([]),rejections=useRef<Rejection[]>([]);
 const accountValid=useRef(true);
 function freeze(){accountValid.current=false;base.current=[];local.current=[];setEntities([]);setMembers([]);setSyncState('auth');setError('Аккаунт изменился. Обновите страницу. Неотправленные правки остаются в прежнем аккаунте.');}
 const refresh=useCallback(()=>{const pending=readOutbox(localStorage,owner),next=project(base.current,pending);local.current=next;setEntities(next);setQueue(pending);try{localStorage.setItem(key,JSON.stringify({format:2,entities:base.current}));}catch{setError('Не хватает места для локальной копии. Скачайте план в настройках.');}return pending;},[key,owner]);
 const flush=useCallback(async()=>{
  if(busy.current||!alive.current||!accountValid.current)return;if(!localMode&&!navigator.onLine){setSyncState('offline');return;}busy.current=true;setSyncState('syncing');
  try{const blocked=new Set([...conflicts.current,...rejections.current].map(v=>v.opId));const sent=readOutbox(localStorage,owner).filter(o=>!blocked.has(o.opId)).slice(0,50);
   const r=await fetch(apiPath('/api/sync',spaceId,actorId),sent.length?{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({operations:sent})}:{cache:'no-store'});
   if(r.status===401){freeze();return;}
   const data:any=await r.json();if(!r.ok)throw new Error(data.error||'Нет связи с сервером.');if(!alive.current||!accountValid.current)return;localStorage.setItem('planner-active-user',actorId);
   setMembers(data.members||[]);removeOutbox(localStorage,owner,data.accepted||[]);base.current=combine(base.current,data.entities);const pending=refresh(),ids=new Set(pending.map(p=>p.opId)),sentIds=new Set(sent.map(p=>p.opId));
   conflicts.current=[...conflicts.current.filter(c=>!sentIds.has(c.opId)),...(data.conflicts||[])].filter(c=>ids.has(c.opId)).map(c=>({...c,current:base.current.find(e=>e.id===c.id)||null}));
   rejections.current=[...rejections.current.filter(c=>!sentIds.has(c.opId)),...(data.rejected||[])].filter(c=>ids.has(c.opId)).map(c=>({...c,current:base.current.find(e=>e.id===c.id)||null}));
   setConflicts([...conflicts.current]);setRejected([...rejections.current]);setError('');setSyncState(conflicts.current.length||rejections.current.length?'conflict':pending.length?'pending':'synced');
  }catch(e){if(alive.current){setError(e instanceof Error?e.message:'Не удалось синхронизировать.');setSyncState(localMode||navigator.onLine?'error':'offline');}}finally{busy.current=false;}
 },[owner,spaceId,actorId,refresh,localMode]);
 useEffect(()=>{alive.current=true;accountValid.current=true;try{const activeUser=localStorage.getItem('planner-active-user');if(activeUser&&activeUser!==actorId&&!navigator.onLine){freeze();setReady(true);return()=>{alive.current=false;};}const cached=JSON.parse(localStorage.getItem(key)||'null');if(Array.isArray(cached?.entities))base.current=cached.entities.filter((e:Entity)=>e.version>0);if(cached?.format!==2&&Array.isArray(cached?.queue))for(const op of cached.queue)appendOutbox(localStorage,owner,op);refresh();}catch{setError('Не удалось прочитать локальную копию. Не очищайте хранилище до восстановления связи.');}setReady(true);void flush();
  const online=()=>void flush(),offline=()=>{if(!localMode)setSyncState('offline');},visible=()=>{if(!document.hidden)void flush();};
  const storage=(e:StorageEvent)=>{if(e.key==='planner-active-user'&&e.newValue!==actorId){freeze();return;}if(!accountValid.current)return;if(!e.key||(!e.key.startsWith(outboxPrefix(owner))&&e.key!==key))return;if(e.key===key&&e.newValue)try{const c=JSON.parse(e.newValue);if(Array.isArray(c.entities))base.current=combine(base.current,c.entities);}catch{}const pending=readOutbox(localStorage,owner);local.current=project(base.current,pending);setEntities([...local.current]);setQueue(pending);};
  const timer=setInterval(flush,12000);window.addEventListener('online',online);window.addEventListener('offline',offline);window.addEventListener('storage',storage);document.addEventListener('visibilitychange',visible);
  return()=>{alive.current=false;clearInterval(timer);window.removeEventListener('online',online);window.removeEventListener('offline',offline);window.removeEventListener('storage',storage);document.removeEventListener('visibilitychange',visible);};
 },[key,owner,refresh,flush]);
 useEffect(()=>{if(!ready||!queue.some(o=>![...conflictList,...rejected].some(c=>c.opId===o.opId)))return;const t=setTimeout(flush,350);return()=>clearTimeout(t);},[queue,ready,flush,conflictList,rejected]);
 function mutate(kind:Entity['kind'],id:string,changes:Record<string,unknown>,source:Mutation['source']='manual',expected?:{data:any;version:number}){
  if(!accountValid.current)throw new Error('Аккаунт изменился. Обновите страницу.');
  const current=local.current.find(e=>e.id===id),before:Record<string,unknown>={};for(const field of Object.keys(changes))before[field]=expected?expected.data[field]:(current?.data as any)?.[field];
  const failedIds=new Set(rejections.current.filter(r=>r.id===id).map(r=>r.opId)),failed=readOutbox(localStorage,owner).filter(o=>failedIds.has(o.opId));
  const combinedChanges=Object.assign({},...failed.map(o=>o.changes),changes),combinedBefore={...before};for(const op of [...failed].reverse())Object.assign(combinedBefore,op.before);
  const op:Mutation={opId:crypto.randomUUID(),id,kind,changes:combinedChanges,before:combinedBefore,baseVersion:failed[0]?.baseVersion??expected?.version??current?.version??0,source};
  appendOutbox(localStorage,owner,op);removeOutbox(localStorage,owner,[...failedIds]);rejections.current=rejections.current.filter(r=>!failedIds.has(r.opId));setRejected([...rejections.current]);refresh();setSyncState(localMode||navigator.onLine?'pending':'offline');return op;
 }
 function resolve(opId:string,useMine:boolean){const c=conflicts.current.find(x=>x.opId===opId),op=readOutbox(localStorage,owner).find(x=>x.opId===opId);if(!c||!op)return;
  if(useMine){const before:Record<string,unknown>={};for(const field of Object.keys(op.changes))before[field]=(c.current?.data as any)?.[field];appendOutbox(localStorage,owner,{...op,opId:crypto.randomUUID(),baseVersion:c.current?.version||0,before});}
  removeOutbox(localStorage,owner,[opId]);conflicts.current=conflicts.current.filter(x=>x.opId!==opId);setConflicts([...conflicts.current]);refresh();setSyncState('pending');setTimeout(flush,0);
 }
 function discard(opId:string){const op=readOutbox(localStorage,owner).find(o=>o.opId===opId);if(!op)return;removeOutbox(localStorage,owner,[opId]);rejections.current=rejections.current.filter(r=>r.opId!==opId);setRejected([...rejections.current]);refresh();setTimeout(flush,0);}
 function retry(opId:string){rejections.current=rejections.current.filter(r=>r.opId!==opId);setRejected([...rejections.current]);setTimeout(flush,0);}
 return{members,entities,tasks:entities.filter(e=>e.kind==='task').map(e=>e.data as Task),projects:entities.filter(e=>e.kind==='project').map(e=>e.data as Project).filter(p=>!p.deletedAt).sort((a,b)=>{const order=['site','personal','home'];return(order.indexOf(a.id)<0?99:order.indexOf(a.id))-(order.indexOf(b.id)<0?99:order.indexOf(b.id))||a.name.localeCompare(b.name,'ru');}),prefs:(entities.find(e=>e.kind==='settings')?.data as Preferences)||defaultPreferences,mutate,flush,ready,syncState,error,queue,conflictList,rejected,resolve,discard,retry};
}
