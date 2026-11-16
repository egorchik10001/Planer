import assert from 'node:assert/strict';
import {makeTask} from '../lib/planner.ts';
const base=process.env.TEST_URL||'http://127.0.0.1:5174';
class Browser{
 cookies=new Map();
 async call(path,body){const r=await fetch(base+path,{method:body===undefined?'GET':'POST',headers:{Origin:base,...(this.id?{'X-Planner-User':this.id}:{}),Cookie:[...this.cookies].map(([k,v])=>k+'='+v).join(';'),...(body===undefined?{}:{'Content-Type':'application/json'})},body:body===undefined?undefined:JSON.stringify(body)});for(const c of r.headers.getSetCookie()){const kv=c.split(';')[0],at=kv.indexOf('=');this.cookies.set(kv.slice(0,at),kv.slice(at+1));}const d=await r.json().catch(()=>null);return{r,d};}
 async upload(path,file){const form=new FormData();form.append('file',file);const r=await fetch(base+path,{method:'POST',headers:{Origin:base,...(this.id?{'X-Planner-User':this.id}:{}),Cookie:[...this.cookies].map(([k,v])=>k+'='+v).join(';')},body:form});return{r,d:await r.json()};}
}
const a=new Browser(),b=new Browser(),c=new Browser(),a2=new Browser();const suffix=crypto.randomUUID();
const password='Local-QA-Only!2026-'+suffix;
const email='alice.'+suffix+'@example.test';
for(const [client,name,mail] of [[a,'Алиса',email],[b,'Борис','boris.'+suffix+'@example.test'],[c,'Вера','vera.'+suffix+'@example.test']]){const {r,d}=await client.call('/api/auth/sign-up/email',{name,email:mail,password});assert.equal(r.status,200,JSON.stringify(d));client.id=d.user.id;}
console.log('PASS separate email/password accounts');
const op=(task,before={},baseVersion=0)=>({opId:crypto.randomUUID(),id:task.id,kind:'task',changes:task,before,baseVersion,source:'manual'});
const privateTask=makeTask('Личное дело Алисы');assert.equal((await a.call('/api/sync',{operations:[op(privateTask)]})).d.accepted.length,1);
assert(!(await b.call('/api/sync')).d.entities.some(e=>e.id===privateTask.id));
assert.equal((await a2.call('/api/auth/sign-in/email',{email,password})).r.status,200);a2.id=a.id;assert((await a2.call('/api/sync')).d.entities.some(e=>e.id===privateTask.id));
console.log('PASS private isolation and same account on another device');
const space=(await a.call('/api/spaces',{action:'create',name:'Команда QA'})).d.id;assert(space);const path='/api/sync?space='+space;
assert.equal((await b.call(path)).r.status,401);assert.equal((await b.call('/api/spaces',{action:'invite',spaceId:space})).r.status,403);
const shared=makeTask('Общее дело',{projectId:'general'});await a.call(path);assert.equal((await a.call(path,{operations:[op(shared)]})).d.accepted.length,1);
const invite=(await a.call('/api/spaces',{action:'invite',spaceId:space})).d.url;const token=invite.split('/').at(-1);assert.equal((await b.call('/api/invitations',{token})).r.status,200);assert.equal((await c.call('/api/invitations',{token})).r.status,410);
const initial=(await b.call(path)).d;assert(initial.entities.some(e=>e.id===shared.id));assert(!initial.entities.some(e=>e.id===privateTask.id));assert(!(await b.call('/api/sync')).d.entities.some(e=>e.id===shared.id));
console.log('PASS one-use invite, team access, personal/team separation');
let task=(await b.call(path)).d.entities.find(e=>e.id===shared.id);const edited={opId:crypto.randomUUID(),id:shared.id,kind:'task',changes:{title:'Проверено Борисом',assigneeIds:[a.id,b.id]},before:{title:task.data.title,assigneeIds:[]},baseVersion:task.version,source:'manual'};assert.equal((await b.call(path,{operations:[edited]})).d.accepted.length,1);assert.equal((await a.call(path)).d.entities.find(e=>e.id===shared.id).data.title,'Проверено Борисом');
task=(await b.call(path)).d.entities.find(e=>e.id===shared.id);const bad={...edited,opId:crypto.randomUUID(),changes:{assigneeIds:[c.id]},before:{assigneeIds:task.data.assigneeIds},baseVersion:task.version};assert.equal((await b.call(path,{operations:[bad]})).d.rejected.length,1);
console.log('PASS collaborative edits and assignments only to members');
const ownFile=(await a.upload('/api/attachments',new File(['private'],'note.txt',{type:'text/plain'}))).d;
assert.equal((await b.call('/api/attachments?space='+space+'&key='+encodeURIComponent(ownFile.key))).r.status,404);
const sharedFile=(await a.upload('/api/attachments?space='+space,new File(['team'],'team.txt',{type:'text/plain'}))).d;
assert.equal((await b.call('/api/attachments?space='+space+'&key='+encodeURIComponent(sharedFile.key))).r.status,200);
assert.equal((await c.call('/api/attachments?space='+space+'&key='+encodeURIComponent(sharedFile.key))).r.status,401);
const unused=(await a.call('/api/spaces',{action:'invite',spaceId:space})).d.url;const invites=(await a.call('/api/spaces?space='+space)).d.invites;await a.call('/api/spaces',{action:'revoke',spaceId:space,id:invites[0].id});assert.equal((await c.call('/api/invitations',{token:unused.split('/').at(-1)})).r.status,410);
assert.equal((await b.call('/api/spaces',{action:'remove',spaceId:space,userId:a.id})).r.status,403);assert.equal((await a.call('/api/spaces',{action:'remove',spaceId:space,userId:b.id})).r.status,200);assert.equal((await b.call(path)).r.status,401);assert.equal((await b.call(path,{operations:[op(makeTask('Запрещено'))]})).r.status,401);
console.log('PASS file isolation, invitation revocation, member removal');
const forged=await fetch(base+'/api/sync',{headers:{'oai-authenticated-user-id':a.id,'oai-authenticated-user-email':email}});assert.equal(forged.status,401);
assert.equal((await a2.call('/api/auth/sign-out',{})).r.status,200);assert.equal((await a2.call('/api/sync')).r.status,401);assert.equal((await a.call('/api/sync')).r.status,200);
const stale=new Browser();stale.cookies=new Map(c.cookies);stale.id=a.id;assert.equal((await stale.call('/api/sync')).r.status,401);assert.equal((await stale.call('/api/sync',{operations:[op(makeTask('Не должно попасть в чужой аккаунт'))]})).r.status,401);assert.equal((await stale.call('/api/spaces',{action:'create',name:'Чужое'})).r.status,401);assert.equal((await stale.call('/api/auth/sign-out',{})).r.status,401);assert.equal((await c.call('/api/sync')).r.status,200);
console.log('PASS forged headers, independent sessions and stale account tab rejected');
console.log('All multiuser scenarios passed. Synthetic data is local only.');
