import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync,readFileSync,writeFileSync,existsSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {createRequire} from 'node:module';
import {makeTask} from '../lib/planner.ts';
const {LocalStore}=createRequire(import.meta.url)('../desktop-dist/local-store.cjs');
function fixture(t){const dir=mkdtempSync(join(tmpdir(),'planner-desktop-store-'));t.after(()=>rmSync(dir,{recursive:true,force:true}));return {dir,store:new LocalStore(dir)};}
function request(store,path='/api/sync',body){return store.request({url:path+(path.includes('?')?'&':'?')+'user=mac-local',method:body?'POST':'GET',body:body?JSON.stringify(body):undefined});}
function op(task,changes=task,version=0,before={}){return{opId:crypto.randomUUID(),id:task.id,kind:'task',changes,before,baseVersion:version,source:'manual'};}
test('persists edits, prevents duplicate writes, preserves conflicts, history and repeat',t=>{
 const {store,dir}=fixture(t),task=makeTask('Первое дело',{projectId:'home',date:'2026-11-16',repeat:'daily'}),create=op(task);
 let r=request(store,'/api/sync',{operations:[create]});assert.equal(r.status,200);assert.deepEqual(r.body.accepted,[create.opId]);
 r=request(store,'/api/sync',{operations:[create]});assert.equal(r.body.entities.filter(e=>e.id===task.id).length,1);assert.equal(r.body.entities.find(e=>e.id===task.id).version,1);
 const changed=op(task,{title:'Новое название'},1,{title:task.title});request(store,'/api/sync',{operations:[changed]});
 const stale=op(task,{title:'Старое окно'},1,{title:task.title});r=request(store,'/api/sync',{operations:[stale]});assert.equal(r.body.conflicts.length,1);assert.equal(r.body.entities.find(e=>e.id===task.id).data.title,'Новое название');
 let reopened=new LocalStore(dir);assert.equal(request(reopened).body.entities.find(e=>e.id===task.id).data.title,'Новое название');
 assert.equal(request(reopened,'/api/history?id='+task.id).body.history.length,2);
 r=request(reopened,'/api/history',{id:task.id,historyId:changed.opId});assert.equal(r.body.accepted,true);assert.equal(request(reopened).body.entities.find(e=>e.id===task.id).data.title,task.title);
 request(reopened,'/api/sync',{operations:[op(task,{status:'done',completedAt:new Date().toISOString()},3,{status:'todo',completedAt:null})]});
 const repeated=request(reopened).body.entities.filter(e=>e.kind==='task'&&e.data.status!=='done');assert.equal(repeated.length,1);assert.equal(repeated[0].data.seriesId,task.id);assert.ok(existsSync(join(dir,'planner.json.previous')));
});
test('invalid edits and failed disk save never acknowledge operations',t=>{
 const {store}=fixture(t),task=makeTask('Задача'),create=op(task);const original=store.save.bind(store);store.save=()=>{throw new Error('Disk full');};
 let r=request(store,'/api/sync',{operations:[create]});assert.notEqual(r.status,200);assert.equal(request(store).body.entities.some(e=>e.id===task.id),false);
 store.save=original;r=request(store,'/api/sync',{operations:[create]});assert.deepEqual(r.body.accepted,[create.opId]);
 r=request(store,'/api/sync',{operations:[op(task,{title:''},1,{title:task.title})]});assert.equal(r.body.rejected.length,1);assert.equal(request(store).body.entities.find(e=>e.id===task.id).data.title,task.title);
 assert.equal(store.request({url:'/api/sync?user=other'}).status,401);assert.equal(store.request({url:'https://evil.example/api/sync?user=mac-local'}).status,403);
});
test('imports validate before saving, do not overwrite, and strip foreign attachments',t=>{
 const {store}=fixture(t),task=makeTask('Импорт',{attachments:[{key:'someone/file',name:'a.txt',type:'text/plain'}]});
 const body={format:'planner-export-v1',entities:[{kind:'task',data:task}],queue:[]};let r=request(store,'/api/import',body);assert.equal(r.body.imported,1);assert.deepEqual(request(store).body.entities.find(e=>e.id===task.id).data.attachments,[]);
 body.entities[0].data.title='Другое';r=request(store,'/api/import',body);assert.equal(r.body.skipped,1);assert.equal(request(store).body.entities.find(e=>e.id===task.id).data.title,'Импорт');
 const bad=makeTask('Без проекта',{projectId:'missing'}),newTask=makeTask('Не должен попасть');r=request(store,'/api/import',{format:'planner-export-v1',entities:[{kind:'task',data:newTask},{kind:'task',data:bad}]});assert.notEqual(r.status,200);assert.equal(request(store).body.entities.some(e=>e.id===newTask.id),false);
});
test('attachments are local, bounded and cannot escape the data directory',t=>{
 const {store}=fixture(t),bytes=new TextEncoder().encode('Локальное вложение');let r=store.request({url:'/api/attachments?user=mac-local',method:'POST',file:{name:'заметка.txt',type:'text/plain',bytes}});assert.equal(r.status,200);
 const key=r.body.key;assert.equal(store.attachment(key).toString(),'Локальное вложение');assert.equal(store.attachment('mac-local/../../package.json'),null);assert.equal(store.attachment('other/'+crypto.randomUUID()),null);
 r=store.request({url:'/api/attachments?user=mac-local',method:'POST',file:{name:'a.html',type:'text/html',bytes}});assert.equal(r.status,400);
});
test('corrupt primary recovers previous data without deleting damaged file',t=>{
 const {store,dir}=fixture(t);request(store,'/api/sync',{operations:[op(makeTask('Первая'))]});request(store,'/api/sync',{operations:[op(makeTask('Вторая'))]});
 const previous=readFileSync(join(dir,'planner.json.previous'),'utf8');writeFileSync(join(dir,'planner.json'),'{broken');const recovered=new LocalStore(dir);assert.equal(recovered.recovered,true);assert.equal(readFileSync(join(dir,'planner.json'),'utf8'),previous);assert.ok(recovered.read().entities.some(e=>e.data.title==='Первая'));
});
