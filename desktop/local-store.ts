import {mkdirSync,readFileSync,writeFileSync,renameSync,existsSync,openSync,closeSync,fsyncSync,copyFileSync,readdirSync,unlinkSync} from 'node:fs';
import {join} from 'node:path';
import {randomUUID} from 'node:crypto';
import {defaultProjects,defaultPreferences,nextTask,dateKey,type Entity,type Mutation,type Task} from '../lib/planner';
import {taskSchema,projectSchema,settingsSchema,mutationSchema} from '../lib/validation';

const USER='mac-local',MAX_FILE=10*1024*1024;
type Change={id:string;entityId:string;at:string;source:string;before:any;after:any};
type State={format:1;entities:Entity[];receipts:string[];history:Change[]};
type Wire={url:string;method?:string;body?:string;file?:{name:string;type:string;bytes:Uint8Array}};
const schema=(kind:string)=>kind==='task'?taskSchema:kind==='project'?projectSchema:settingsSchema;
const json=(body:unknown,status=200)=>({status,body});
const equal=(a:unknown,b:unknown)=>JSON.stringify(a)===JSON.stringify(b);
function validState(raw:any):State{
 if(raw?.format!==1||!Array.isArray(raw.entities)||!Array.isArray(raw.receipts)||!Array.isArray(raw.history))throw new Error('Неверный формат локальной базы.');
 const ids=new Set();
 for(const e of raw.entities){if(!['task','project','settings'].includes(e.kind)||!Number.isSafeInteger(e.version)||e.version<1||typeof e.updatedAt!=='string'||e.id!==e.data?.id||ids.has(e.id))throw new Error('Повреждена запись локального плана.');schema(e.kind).parse(e.data);ids.add(e.id);}
 if(raw.receipts.some((r:any)=>typeof r!=='string')||raw.history.some((h:any)=>typeof h.id!=='string'||typeof h.entityId!=='string'||typeof h.at!=='string'))throw new Error('Повреждена история локального плана.');
 return raw;
}
export class LocalStore{
 readonly file:string;readonly files:string;recovered=false;
 constructor(readonly directory:string){
  mkdirSync(directory,{recursive:true,mode:0o700});this.file=join(directory,'planner.json');this.files=join(directory,'files');mkdirSync(this.files,{recursive:true,mode:0o700});
  if(existsSync(this.file)){try{this.read();}catch(error){const previous=this.file+'.previous';if(!existsSync(previous))throw error;validState(JSON.parse(readFileSync(previous,'utf8')));copyFileSync(this.file,this.file+'.damaged-'+Date.now());copyFileSync(previous,this.file);this.recovered=true;}}
  else{const at=new Date().toISOString();this.save({format:1,entities:[...defaultProjects.map(p=>({id:p.id,kind:'project' as const,data:p,version:1,updatedAt:at})),{id:'preferences',kind:'settings',data:{...defaultPreferences,timezone:Intl.DateTimeFormat().resolvedOptions().timeZone},version:1,updatedAt:at}],receipts:[],history:[]});}
 }
 read():State{return validState(JSON.parse(readFileSync(this.file,'utf8')));}
 save(state:State){
  const data=JSON.stringify(state);if(Buffer.byteLength(data)>100*1024*1024)throw new Error('Локальная база превышает 100 МБ. Сохраните резервную копию.');
  if(existsSync(this.file)){
   copyFileSync(this.file,this.file+'.previous');
   const backups=join(this.directory,'backups');mkdirSync(backups,{recursive:true,mode:0o700});const name=new Date().toISOString().slice(0,10)+'.json';if(!existsSync(join(backups,name)))copyFileSync(this.file,join(backups,name));
   for(const old of readdirSync(backups).filter(p=>/^\d{4}-\d{2}-\d{2}\.json$/.test(p)).sort().slice(0,-7))unlinkSync(join(backups,old));
  }
  const temp=this.file+'.tmp';const fd=openSync(temp,'w',0o600);try{writeFileSync(fd,data);fsyncSync(fd);}finally{closeSync(fd);}renameSync(temp,this.file);
 }
 private apply(state:State,op:Mutation,skipRepeat=false):any{
  if(state.receipts.includes(op.opId))return {accepted:true};
  const current=state.entities.find(e=>e.id===op.id),before:any=current?.data||{};
  if(current&&current.kind!==op.kind)throw new Error('Нельзя изменить тип записи.');
  const fields=current&&current.version!==op.baseVersion?Object.keys(op.changes).filter(k=>!equal(before[k],op.before[k])&&!equal(before[k],op.changes[k])):[];
  if(fields.length||(!current&&op.baseVersion>0))return {accepted:false,conflict:{opId:op.opId,id:op.id,fields:fields.length?fields:['record'],current:current||null}};
  const after:any=schema(op.kind).parse({...before,...op.changes,id:op.id});
  if(op.kind==='task'){
   if(after.projectId&&!state.entities.some(e=>e.id===after.projectId&&e.kind==='project'&&!(e.data as any).deletedAt))throw new Error('Выберите существующий проект.');
   if(after.assigneeIds.some((id:string)=>id!==USER))throw new Error('В локальном плане можно назначить задачу только себе.');
   if(after.attachments.some((a:any)=>!this.attachmentPath(a.key)||!existsSync(this.attachmentPath(a.key)!)))throw new Error('Файл вложения не найден на этом Mac.');
  }
  const at=new Date().toISOString(),entity={id:op.id,kind:op.kind,data:after,version:(current?.version||0)+1,updatedAt:at};
  state.entities=state.entities.filter(e=>e.id!==op.id).concat(entity);
  state.receipts.push(op.opId);state.history.push({id:op.opId,entityId:op.id,at,source:op.source,before:current?before:null,after});
  const old=state.history.filter(h=>h.entityId===op.id).slice(0,-100);if(old.length){const ids=new Set(old.map(h=>h.id));state.history=state.history.filter(h=>!ids.has(h.id));}
  if(!skipRepeat&&op.kind==='task'&&after.status==='done'&&before.status!=='done'){
   const prefs:any=state.entities.find(e=>e.kind==='settings')?.data||defaultPreferences,next=nextTask(after,dateKey(new Date(),prefs.timezone));
   if(next&&!state.entities.some(e=>e.id===next.id))this.apply(state,{opId:randomUUID(),id:next.id,kind:'task',changes:next as any,before:{},baseVersion:0,source:op.source});
  }
  return {accepted:true};
 }
 attachmentPath(key:string){return /^mac-local\/[0-9a-f-]{36}$/.test(key)?join(this.files,key.slice(USER.length+1)):null;}
 attachment(key:string){const path=this.attachmentPath(key);if(!path||!existsSync(path))return null;return readFileSync(path);}
 request(input:Wire):{status:number;body:any}{
  try{
   if(typeof input?.url!=='string'||input.url.length>2048)return json({error:'Неверный запрос.'},400);
   const url=new URL(input.url,'planner://app'),method=input.method||'GET';if(url.protocol!=='planner:'||url.hostname!=='app')return json({error:'Неверный источник.'},403);
   if(url.searchParams.has('space')||url.searchParams.get('user')!==USER)return json({error:'Неверный локальный аккаунт.'},401);
   if(input.body&&Buffer.byteLength(input.body)>6*1024*1024)return json({error:'Слишком большой запрос.'},413);
   const path=url.pathname;
   if(path==='/api/integrations'&&method==='GET')return json({voice:false,telegram:false,backgroundReminders:false});
   if(path==='/api/attachments'&&method==='POST'){
    const f=input.file;if(!f||typeof f.name!=='string'||f.name.length>200||!['image/png','image/jpeg','image/webp','application/pdf','text/plain'].includes(f.type)||!(f.bytes instanceof Uint8Array)||f.bytes.byteLength>MAX_FILE)return json({error:'Поддерживаются изображения, PDF и текст до 10 МБ.'},400);
    const key=USER+'/'+randomUUID();writeFileSync(this.attachmentPath(key)!,f.bytes,{flag:'wx',mode:0o600});return json({key,name:f.name,type:f.type});
   }
   if(path==='/api/attachments'&&method==='GET'){
    const bytes=this.attachment(url.searchParams.get('key')||'');return bytes?{status:200,body:{bytes:new Uint8Array(bytes)}}:json({error:'Файл не найден.'},404);
   }
   const state=this.read(),body=input.body?JSON.parse(input.body):{};
   if(path==='/api/sync'&&method==='GET')return json({entities:state.entities,members:[{id:USER,name:'Я',email:'На этом Mac',role:'owner'}]});
   if(path==='/api/sync'&&method==='POST'){
    if(!Array.isArray(body.operations)||body.operations.length>100)return json({error:'Неверная очередь.'},400);
    const operations=body.operations.map((op:any)=>mutationSchema.parse(op)),accepted:string[]=[],conflicts:any[]=[],rejected:any[]=[];
    for(const op of operations){try{const candidate=structuredClone(state),r=this.apply(candidate,op);if(r.accepted){Object.assign(state,candidate);accepted.push(op.opId);}else conflicts.push(r.conflict);}catch(e){rejected.push({opId:op.opId,id:op.id,error:e instanceof Error&&!e.message.startsWith('[')?e.message:'Проверьте поля дела.'});}}
    if(accepted.length)this.save(state);return json({entities:state.entities,members:[{id:USER,name:'Я',email:'На этом Mac',role:'owner'}],accepted,conflicts,rejected});
   }
   if(path==='/api/history'&&method==='GET')return json({history:state.history.filter(h=>h.entityId===url.searchParams.get('id')).reverse()});
   if(path==='/api/history'&&method==='POST'){
    const h=state.history.find(h=>h.id===body.historyId&&h.entityId===body.id),current=state.entities.find(e=>e.id===body.id);
    if(!h?.before||!current)throw new Error('Это изменение нельзя восстановить.');
    const changes:Record<string,unknown>={},before:Record<string,unknown>={};for(const k of Object.keys(h.before))if(k!=='id'&&k!=='createdAt'&&!equal(h.before[k],h.after[k])){
     if(!equal((current.data as any)[k],h.after[k]))throw new Error('Это поле изменилось позже. Откройте задачу и выберите значение.');changes[k]=h.before[k];before[k]=(current.data as any)[k];
    }
    const result=this.apply(state,{opId:randomUUID(),id:current.id,kind:current.kind,changes,before,baseVersion:current.version,source:'restore'});if(result.accepted)this.save(state);return json(result);
   }
   if(path==='/api/import'&&method==='POST'){
    if(body.format!=='planner-export-v1'||!Array.isArray(body.entities)||body.entities.length>1000)throw new Error('Выберите экспорт планера до 1000 записей.');
    if(body.queue?.length)throw new Error('В копии есть несохранённые изменения. Сначала дождитесь сохранения исходного плана.');
    const records=[...body.entities.filter((e:any)=>e.kind==='project').map((e:any)=>({kind:'project' as const,data:projectSchema.parse(e.data)})),...body.entities.filter((e:any)=>e.kind==='task').map((e:any)=>({kind:'task' as const,data:taskSchema.parse({...e.data,assigneeIds:[],attachments:[]})}))];
    const projects=new Map(state.entities.filter(e=>e.kind==='project').map(e=>[e.id,e.data as any]));for(const e of records)if(e.kind==='project'&&!projects.has(e.data.id))projects.set(e.data.id,e.data);
    if(records.some(e=>e.kind==='task'&&e.data.projectId&&(!projects.has(e.data.projectId)||projects.get(e.data.projectId).deletedAt)))throw new Error('В копии не хватает действующего проекта.');
    let imported=0,skipped=0;for(const e of records){if(state.entities.some(x=>x.id===e.data.id)){skipped++;continue;}const r=this.apply(state,{opId:randomUUID(),id:e.data.id,kind:e.kind,changes:e.data,before:{},baseVersion:0,source:'manual'},true);if(r.accepted)imported++;}if(imported)this.save(state);return json({imported,skipped});
   }
   return json({error:'Для этой функции подключите сервер через меню «Планер → Синхронизация».'},503);
  }catch(error){return json({error:error instanceof Error&&!error.message.startsWith('[')?error.message:'Не удалось проверить данные. Правки остаются в очереди.'},422);}
 }
}
