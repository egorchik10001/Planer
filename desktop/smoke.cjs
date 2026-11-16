const assert=require('node:assert/strict');
const {writeFileSync}=require('node:fs');
const path=require('node:path');
const {setTimeout:delay}=require('node:timers/promises');
module.exports=async({app,win,localStore,createWindow})=>{
 const errors=[];win.webContents.on('console-message',event=>{if(event.level==='error')errors.push(event.message);});
 const timeout=setTimeout(()=>{console.error('Desktop smoke timed out',win.webContents.getURL());app.exit(1);},45000);
 console.log('Desktop smoke: waiting for first local render');
 const js=code=>win.webContents.executeJavaScript(code,true);
 async function until(check){for(let i=0;i<120;i++){if(await check())return;await delay(100);}throw new Error('Timed out waiting for desktop UI.');}
 await until(()=>js("document.body.innerText.includes('Сохранено на Mac')"));
 assert.equal(await js("typeof require"),'undefined');assert.equal(await js("typeof process"),'undefined');
 assert.equal(await js("location.protocol"),'planner:');assert.ok(await js("document.fonts.check('16px Onest')"));
 const title='Проверить Mac-версию';
 await js("Object.defineProperty(navigator,'onLine',{get:()=>false,configurable:true});window.dispatchEvent(new Event('offline'))");
 await js(`(()=>{const input=document.querySelector('.quick-form input');if(!input)throw Error('No quick add');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(input,${JSON.stringify(title)});input.dispatchEvent(new Event('input',{bubbles:true}));})()`);
 await delay(100);await js("document.querySelector('.quick-form').requestSubmit()");
 await until(async()=>localStore.read().entities.some(e=>e.data.title===title));
 const task=localStore.read().entities.find(e=>e.data.title===title);assert.ok(task);
 await until(()=>js("document.body.innerText.includes('Сохранено на Mac')"));
 await js("delete navigator.onLine;window.dispatchEvent(new Event('online'))");
 const base=localStore.read().entities.find(e=>e.kind==='settings').data;const day=new Intl.DateTimeFormat('en-CA',{timeZone:base.timezone,year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
 // Additional tasks exercise the second weekly row, time sorting and local IPC persistence.
 for(let i=0;i<4;i++){
  const data={...task.data,id:crypto.randomUUID(),title:'Дело '+(i+1),date:day,time:['18:00','08:00','12:00',null][i],order:i};
  const response=localStore.request({url:'/api/sync?user=mac-local',method:'POST',body:JSON.stringify({operations:[{opId:crypto.randomUUID(),id:data.id,kind:'task',changes:data,before:{},baseVersion:0,source:'manual'}]})});assert.equal(response.status,200);
 }
 win.reload();await until(()=>js("document.body.innerText.includes('Сохранено на Mac')&&document.body.innerText.includes('Проверить Mac-версию')"));
 await js("[...document.querySelectorAll('.sidebar nav button')].find(b=>b.innerText.includes('Неделя')).click()");
 await delay(300);
 const layout=await js("(()=>{const cards=[...document.querySelectorAll('.week-cards .task-card')];return {count:cards.length,top:cards.map(c=>c.getBoundingClientRect().top),text:cards.map(c=>c.innerText)};})()");
 assert.equal(layout.count,5);assert.ok(new Set(layout.top.map(Math.round)).size>=2,'week cards wrap');assert.ok(layout.text[0].includes('08:00'));assert.ok(layout.text[1].includes('12:00'));assert.ok(layout.text[2].includes('18:00'));
 const points=await js(`(()=>{const card=document.querySelector('[data-task-id="${task.id}"] .card-main').getBoundingClientRect();const rows=[...document.querySelectorAll('.week-day')];const target=rows[1].querySelector('.week-cards').getBoundingClientRect();return{start:{x:Math.round(card.left+40),y:Math.round(card.top+12)},end:{x:Math.round(target.left+60),y:Math.round(target.top+25)},date:rows[1].dataset.drop.slice(5)};})()`);
 win.webContents.sendInputEvent({type:'mouseMove',...points.start});win.webContents.sendInputEvent({type:'mouseDown',button:'left',clickCount:1,...points.start});await delay(240);
 assert.ok(await js("!!document.querySelector('.task-drag-preview')"),'hold anywhere picks up task');
 win.webContents.sendInputEvent({type:'mouseMove',...points.end});await delay(80);win.webContents.sendInputEvent({type:'mouseUp',button:'left',clickCount:1,...points.end});
 await until(()=>localStore.read().entities.find(e=>e.id===task.id).data.date===points.date);await delay(300);assert.equal(await js("!!document.querySelector('.task-drag-preview')"),false);assert.equal(await js("!!document.querySelector('.task-dialog[open]')"),false);
 const unchanged=JSON.stringify(localStore.read().entities),source=await js("(()=>{const r=document.querySelector('.week-cards .card-main').getBoundingClientRect();return{x:Math.round(r.left+20),y:Math.round(r.top+12)}})()");
 win.webContents.sendInputEvent({type:'mouseDown',button:'left',clickCount:1,...source});await delay(240);win.webContents.sendInputEvent({type:'keyDown',keyCode:'Escape'});win.webContents.sendInputEvent({type:'keyUp',keyCode:'Escape'});win.webContents.sendInputEvent({type:'mouseUp',button:'left',clickCount:1,...source});await delay(350);assert.equal(JSON.stringify(localStore.read().entities),unchanged,'Escape cancels without writes');
 await delay(300);writeFileSync(path.join(app.getPath('userData'),'desktop-week.png'),(await win.webContents.capturePage()).toPNG());
 await js("document.querySelector('.week-cards .card-main').click()");await until(()=>js("!!document.querySelector('.task-dialog[open]')"));
 await js("document.querySelector('.task-dialog .icon-button[aria-label=\"Закрыть\"]').click()");
 win.webContents.send('planner:command','new-task');await until(()=>js("document.body.innerText.includes('Новое дело')"));await js("document.querySelector('.task-dialog .icon-button[aria-label=\"Закрыть\"]').click()");
 await js("window.plannerDesktop.openConnection()");await delay(800);
 // Recreate after the connection transition to prove on-disk data survived a fresh renderer.
 const reopened=createWindow('local');await delay(1000);assert.ok(localStore.read().entities.some(e=>e.data.title===title));await reopened.webContents.executeJavaScript("[...document.querySelectorAll('.sidebar nav button')].find(b=>b.innerText.includes('\u0412\u0445\u043e\u0434\u044f\u0449\u0438\u0435')).click()");await delay(150);assert.ok((await reopened.webContents.executeJavaScript('document.body.innerText')).includes(title));
 clearTimeout(timeout);assert.deepEqual(errors,[]);console.log('Desktop smoke passed: offline save, restart, week layout, full-card pointer drag, Escape, editor, menu, sandbox.');
};
