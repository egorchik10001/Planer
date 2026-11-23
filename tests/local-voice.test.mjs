import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync,writeFileSync,readFileSync,existsSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import {pcmSpeechData} from '../desktop/wav.ts';
import {installBackGesture} from '../lib/back-gesture.ts';
const {ModelManager}=createRequire(import.meta.url)('../desktop-dist/model-manager.cjs');
const {exactTimeEvidence,groundSpokenDates}=createRequire(import.meta.url)('../desktop-dist/local-voice.cjs');
const bytes=Buffer.from('verified local model'),model={id:'test',name:'Test',file:'test.bin',bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex'),url:'https://example.test/model'};
function setup(t,fetcher){const dir=mkdtempSync(join(tmpdir(),'planner-model-test-'));t.after(()=>rmSync(dir,{recursive:true,force:true}));return new ModelManager(dir,[model],fetcher);}
test('resume verifies the completed file before making the model ready',async t=>{
 const manager=setup(t,async(_url,init)=>{assert.equal(init.headers.Range,'bytes=8-');return new Response(bytes.subarray(8),{status:206,headers:{'content-range':`bytes 8-${bytes.length-1}/${bytes.length}`}});});writeFileSync(manager.path('test')+'.part',bytes.subarray(0,8));
 await manager.verifyExisting();assert.equal(manager.ready(),false);await manager.start();assert.equal(manager.ready(),true);assert.deepEqual(readFileSync(manager.path('test')),bytes);assert.equal(existsSync(manager.path('test')+'.part'),false);
});
test('a server ignoring Range restarts safely and a wrong digest never becomes ready',async t=>{
 const manager=setup(t,async()=>new Response(bytes));writeFileSync(manager.path('test')+'.part',bytes.subarray(0,8));await manager.start();assert.equal(manager.ready(),true);
 const corrupt=setup(t,async()=>new Response(Buffer.alloc(bytes.length,1)));await corrupt.start();assert.equal(corrupt.ready(),false);assert.equal(corrupt.status().stage,'error');assert.equal(existsSync(corrupt.path('test')),false);assert.equal(existsSync(corrupt.path('test')+'.part'),false);
});
test('pause keeps resumable bytes and rejects a mismatching Content-Range',async t=>{
 const manager=setup(t,async(_url,init)=>new Promise((_resolve,reject)=>{init.signal.addEventListener('abort',()=>reject(init.signal.reason),{once:true});}));writeFileSync(manager.path('test')+'.part',bytes.subarray(0,8));const running=manager.start();manager.pause();await running;assert.equal(manager.status().stage,'paused');assert.equal(readFileSync(manager.path('test')+'.part').length,8);
 const bad=setup(t,async()=>new Response(bytes,{status:206,headers:{'content-range':'bytes 2-9/20'}}));writeFileSync(bad.path('test')+'.part',bytes.subarray(0,8));await bad.start();assert.equal(bad.ready(),false);assert.equal(bad.status().stage,'error');
});
test('existing models are checked by size and digest, never just by filename',async t=>{
 let calls=0;const manager=setup(t,async()=>{calls++;return new Response(bytes);});writeFileSync(manager.path('test'),Buffer.alloc(bytes.length));await manager.verifyExisting();assert.equal(manager.ready(),false);await manager.start();assert.equal(calls,1);const again=new ModelManager(manager.directory,[model],()=>{throw Error('offline');});await again.verifyExisting();assert.equal(again.ready(),true);
});
test('WAV parser accepts metadata chunks, rejects stereo, truncation and non-WAV',()=>{
 const pcm=Buffer.alloc(3200,20),wav=Buffer.alloc(56+pcm.length);wav.write('RIFF');wav.writeUInt32LE(wav.length-8,4);wav.write('WAVE',8);wav.write('JUNK',12);wav.writeUInt32LE(4,16);wav.write('fmt ',24);wav.writeUInt32LE(16,28);wav.writeUInt16LE(1,32);wav.writeUInt16LE(1,34);wav.writeUInt32LE(16000,36);wav.writeUInt16LE(16,46);wav.write('data',48);wav.writeUInt32LE(pcm.length,52);pcm.copy(wav,56);assert.deepEqual(pcmSpeechData(wav),pcm);const stereo=Buffer.from(wav);stereo.writeUInt16LE(2,34);assert.throws(()=>pcmSpeechData(stereo));assert.throws(()=>pcmSpeechData(wav.subarray(0,60)));assert.throws(()=>pcmSpeechData(Buffer.from('not audio')));
});
test('back gesture ignores vertical/forward scroll and inputs, and triggers only once per gesture',()=>{
 const target=new EventTarget();let calls=0;const stop=installBackGesture(target,()=>calls++);
 const wheel=(x,y=0,input=false)=>{const e=new Event('wheel',{cancelable:true});Object.assign(e,{deltaX:x,deltaY:y,deltaMode:0});if(input)Object.defineProperty(e,'target',{value:{closest:()=>true}});target.dispatchEvent(e);};
 wheel(-200,200);wheel(200);wheel(-200,0,true);assert.equal(calls,0);wheel(-70);wheel(-70);wheel(-200);assert.equal(calls,1);stop();wheel(-200);assert.equal(calls,1);
});
test('vague parts of the day cannot invent a precise clock time',()=>{
 for(const phrase of ['утром','завтра вечером','после обеда','на неделе'])assert.equal(exactTimeEvidence(phrase,phrase),false);
 for(const phrase of ['в 10 утра','в десять утра','15:30','в 15','в полдень'])assert.equal(exactTimeEvidence(phrase,phrase),true);
 assert.equal(exactTimeEvidence('Завтра утром','в 10 утра'),false);
});
test('day and deadline are grounded separately across tasks and calendar boundaries',()=>{
 const tasks=[{title:'Забрать посылку',date:null,dueDate:null},{title:'Отправить макет',date:'2025-12-31',dueDate:'2025-12-31'}];
 groundSpokenDates('Завтра утром забрать посылку. К пятнице отправить макет.',tasks,'2025-12-31');
 assert.equal(tasks[0].date,'2026-01-01');assert.equal(tasks[1].date,null);assert.equal(tasks[1].dueDate,'2026-01-02');
 groundSpokenDates('В четверг отправить макет к субботе.',[tasks[1]],'2025-12-31');
 assert.equal(tasks[1].date,'2026-01-01');assert.equal(tasks[1].dueDate,'2026-01-03');
});
