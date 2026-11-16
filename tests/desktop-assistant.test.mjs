import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {defaultProjects,defaultPreferences} from '../lib/planner.ts';
const {desktopAssistant}=createRequire(import.meta.url)('../desktop-dist/assistant.cjs');
const entities=[...defaultProjects.map(data=>({id:data.id,kind:'project',data,version:1,updatedAt:new Date().toISOString()})),{id:'preferences',kind:'settings',data:defaultPreferences,version:1,updatedAt:new Date().toISOString()}];
const result={kind:'create',message:'Два дела',tasks:[{title:'Забрать посылку',notes:'Утром',projectId:'personal',date:'2026-11-17',time:null,dueDate:null,repeat:'none',subtasks:[]},{title:'Отправить макет',notes:'',projectId:'site',date:null,time:null,dueDate:'2026-11-20',repeat:'none',subtasks:['Проверить мобильную версию']}],changes:[],taskIds:[]};
test('audio is transcribed and interpreted with recording date and project context',async()=>{
 const calls=[];const fetcher=async(url,init)=>{calls.push({url,init});if(url.endsWith('/transcriptions'))return Response.json({text:'Короче, завтра утром надо забрать посылку и к пятнице отправить макет.'});return Response.json({output:[{content:[{type:'output_text',text:JSON.stringify(result)}]}]});};
 const response=await desktopAssistant({file:{name:'voice.webm',type:'audio/webm;codecs=opus',bytes:new Uint8Array([1,2,3])},capturedAt:'2026-11-16T03:00:00Z'},entities,'test-key',fetcher);
 assert.equal(response.status,200);assert.equal(calls.length,2);assert.equal(calls[0].init.body.get('model'),'gpt-transcribe');assert.equal(response.body.result.tasks[0].title,'Забрать посылку');assert.equal(response.body.result.tasks[0].time,null);assert.equal(response.body.result.tasks[1].projectId,'site');
 const body=JSON.parse(calls[1].init.body);assert.equal(body.store,false);assert.equal(body.text.format.type,'json_schema');assert.ok(body.instructions.includes('2026-11-16'));assert.ok(body.instructions.includes('Личное'));assert.ok(!JSON.stringify(response.body).includes('test-key'));
});
test('missing key, unreadable speech and quota errors preserve the recording and hide secrets',async()=>{
 let called=false;const fail=async()=>{called=true;throw Error('Should not request');};let response=await desktopAssistant({body:'{"text":"Завтра позвонить"}'},entities,'',fail);assert.equal(response.status,422);assert.equal(called,false);
 response=await desktopAssistant({file:{name:'voice.webm',type:'audio/webm',bytes:new Uint8Array([1])}},entities,'test-key',async()=>Response.json({text:''}));assert.equal(response.status,422);assert.ok(response.body.error.includes('Речь не распознана'));
 response=await desktopAssistant({body:'{"text":"Завтра позвонить"}'},entities,'test-key',async()=>new Response('no quota',{status:429}));assert.equal(response.status,422);assert.ok(response.body.error.includes('Лимит API'));assert.ok(!response.body.error.includes('test-key'));
});
test('unknown projects are removed and unknown target tasks rejected',async()=>{
 const bad=structuredClone(result);bad.tasks[0].projectId='invented';const fetcher=async()=>Response.json({output:[{content:[{type:'output_text',text:JSON.stringify(bad)}]}]});
 let response=await desktopAssistant({body:'{"text":"Перенести задачи"}'},entities,'test-key',fetcher);assert.equal(response.body.result.tasks[0].projectId,null);
 bad.kind='update';bad.changes=[{id:'unknown-task',title:null,date:'2026-11-17',projectId:null,time:null,status:null}];response=await desktopAssistant({body:'{"text":"Перенести задачу"}'},entities,'test-key',fetcher);assert.equal(response.status,422);
});
