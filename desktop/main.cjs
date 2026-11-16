const {app,BrowserWindow,Menu,protocol,ipcMain,dialog,shell,session,systemPreferences}=require('electron');
const {readFileSync,writeFileSync,mkdirSync,existsSync,renameSync}=require('node:fs');
const path=require('node:path');
const {localURL,serverOrigin,assetPath,externalURL}=require('./security.cjs');
const {LocalStore}=require('../desktop-dist/local-store.cjs');
const {LocalVoice}=require('../desktop-dist/local-voice.cjs');
const updateConfig=require('./update-config.json');
const testMode=process.argv.includes('--planner-smoke');
if(testMode){const dir=process.env.PLANNER_SMOKE_DIRECTORY;if(!dir||!path.isAbsolute(dir))throw new Error('Smoke test needs its own absolute data directory.');app.setPath('userData',dir);}
app.setName('Планер');
protocol.registerSchemesAsPrivileged([{scheme:'planner',privileges:{standard:true,secure:true,supportFetchAPI:true,corsEnabled:true,stream:true}}]);
let window=null,localStore=null,quitting=false,config={url:null,mode:'local'};
const localWindows=new Set();
let nativeBridge=null,localVoice=null;
function updateFeed(){return 'https://github.com/'+updateConfig.repository+'/releases/latest/download/appcast-'+process.arch+'.xml';}
function checkUpdates(){if(!app.isPackaged){void dialog.showMessageBox({message:'Обновления доступны в установленной версии приложения.'});return;}try{nativeBridge.checkUpdates();}catch(error){void dialog.showMessageBox({type:'warning',message:'Не удалось проверить обновления',detail:error.message});}}
const renderer=path.join(__dirname,'../desktop-dist/renderer');
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.woff2':'font/woff2','.png':'image/png','.svg':'image/svg+xml','.webmanifest':'application/manifest+json'};
function configFile(){return path.join(app.getPath('userData'),'connection.json');}
function saveConfig(next){const file=configFile();writeFileSync(file+'.tmp',JSON.stringify(next),{mode:0o600});renameSync(file+'.tmp',file);config=next;}
function trusted(event){return localWindows.has(event.sender.id)&&event.senderFrame===event.sender.mainFrame&&localURL(event.senderFrame.url);}
function requireLocal(event){if(!trusted(event))throw new Error('Этот вызов доступен только локальному планеру.');}
function command(name){if(window&&!window.isDestroyed())void window.webContents.executeJavaScript('window.dispatchEvent(new Event('+JSON.stringify('planner:'+name)+'))').catch(()=>{});}
function openLocal(connection=false){
 if(!connection)saveConfig({...config,mode:'local'});
 const url='planner://app/'+(connection?'connection'+(connection==='voice'?'#voice':''):'');
 if(window&&!window.isDestroyed()&&localWindows.has(window.webContents.id)){
  if(window.webContents.getURL()!==url)void window.webContents.loadURL(url).catch(()=>{});
  window.show();window.focus();return;
 }
 createWindow('local',connection);
}
async function goBack(){
 if(!window||window.isDestroyed())return;
 if(localWindows.has(window.webContents.id)&&await window.webContents.executeJavaScript("(()=>{const d=document.querySelector('dialog[open]');if(!d)return false;d.dispatchEvent(new Event('cancel',{cancelable:true}));return true;})()").catch(()=>false))return;
 const history=window.webContents.navigationHistory;
 if(history.canGoBack()){history.goBack();return;}
 if(config.mode==='server'&&config.url)createWindow('server');else openLocal();
}
function menu(){Menu.setApplicationMenu(Menu.buildFromTemplate([
 {label:'Планер',submenu:[{role:'about',label:'О Планере'},{label:'Проверить обновления…',click:checkUpdates},{type:'separator'},{label:'Настройки приложения…',accelerator:'CmdOrCtrl+,',click:()=>openLocal(true)},{label:'Открыть локальный план',click:()=>openLocal()},{label:'Открыть подключённый сервер',enabled:!!config.url,click:()=>{saveConfig({...config,mode:'server'});createWindow('server');}},{type:'separator'},{label:'Показать папку данных',click:()=>shell.openPath(path.join(app.getPath('userData'),'plan'))},{type:'separator'},{role:'hide',label:'Скрыть Планер'},{role:'hideOthers',label:'Скрыть остальные'},{role:'unhide',label:'Показать все'},{type:'separator'},{role:'quit',label:'Завершить Планер'}]},
 {label:'Файл',submenu:[{label:'Новое дело',accelerator:'CmdOrCtrl+N',click:()=>command('new-task')},{label:'Поиск',accelerator:'CmdOrCtrl+K',click:()=>command('search')},{type:'separator'},{role:'close',label:'Закрыть окно'}]},
 {label:'Правка',submenu:[{role:'undo',label:'Отменить'},{role:'redo',label:'Повторить'},{type:'separator'},{role:'cut',label:'Вырезать'},{role:'copy',label:'Скопировать'},{role:'paste',label:'Вставить'},{role:'selectAll',label:'Выбрать всё'}]},
 {label:'Вид',submenu:[{role:'reload',label:'Обновить'},{role:'resetZoom',label:'Исходный масштаб'},{role:'zoomIn',label:'Увеличить'},{role:'zoomOut',label:'Уменьшить'},{type:'separator'},{role:'togglefullscreen',label:'На весь экран'}]},
 {label:'Окно',submenu:[{role:'minimize',label:'Свернуть'},{role:'zoom',label:'Изменить размер'},{role:'front',label:'Все окна на передний план'}]}
 ]));}
function createWindow(mode='local',connection=false){
 const old=window,isLocal=mode!=='server';
 const win=new BrowserWindow({width:1440,height:940,minWidth:540,minHeight:420,title:'Планер',backgroundColor:'#e9ebdf',show:false,webPreferences:{...(isLocal?{preload:path.join(__dirname,'preload.cjs')}:{ }),partition:isLocal?'persist:planner-local':'persist:planner-server',nodeIntegration:false,contextIsolation:true,sandbox:true,webSecurity:true,allowRunningInsecureContent:false}});
 window=win;const contentsId=win.webContents.id;if(isLocal)localWindows.add(contentsId);
 const initial=isLocal?'planner://app/'+(connection?'connection'+(connection==='voice'?'#voice':''):''):config.url;
 const allowed=url=>isLocal?localURL(url):(()=>{try{return new URL(url).origin===config.url;}catch{return false;}})();
 win.webContents.setWindowOpenHandler(({url})=>{
  if(isLocal&&localURL(url)&&new URL(url).pathname==='/api/attachments'){win.webContents.downloadURL(url);return{action:'deny'};}
  if(!isLocal&&allowed(url)&&new URL(url).pathname==='/api/attachments'){win.webContents.downloadURL(url);return{action:'deny'};}
  if(externalURL(url))void shell.openExternal(url);return{action:'deny'};
 });
 win.webContents.on('will-navigate',(event,url)=>{if(!allowed(url)){event.preventDefault();if(externalURL(url))void shell.openExternal(url);}});
 win.webContents.on('will-redirect',(event,url)=>{if(!allowed(url))event.preventDefault();});
 win.webContents.on('will-attach-webview',event=>event.preventDefault());
 win.on('swipe',(_event,direction)=>{if(direction==='right')goBack();});
 win.on('app-command',(_event,command)=>{if(command==='browser-backward')goBack();});
 win.webContents.on('before-input-event',(event,input)=>{if((input.meta||input.control)&&input.type==='keyDown'&&(input.key==='['||input.code==='BracketLeft')){event.preventDefault();void goBack();}});
 win.webContents.on('did-fail-load',(_event,code,_description,_url,isMainFrame)=>{if(isMainFrame&&code!==-3&&!isLocal&&!testMode){win.show();void dialog.showMessageBox(win,{type:'warning',message:'Не удалось открыть сервер',detail:'Проверьте подключение к интернету и адрес сервера. Локальные задачи остаются на этом Mac.',buttons:['Открыть локальный план','Повторить'],defaultId:0,cancelId:0}).then(result=>{if(result.response===0)openLocal();else void win.loadURL(initial).catch(()=>{});});}});
 win.on('close',event=>{if(!quitting&&!testMode&&window===win){event.preventDefault();win.hide();}});
 win.on('closed',()=>localWindows.delete(contentsId));
 win.once('ready-to-show',()=>{if(!testMode)win.show();if(old&&!old.isDestroyed())old.destroy();});
 void win.loadURL(initial).catch(()=>{});menu();return win;
}
function configurePermissions(partition){
 const ses=session.fromPartition(partition);
 const allowed=url=>{if(partition.endsWith('local'))return localURL(url);try{return new URL(url).origin===config.url;}catch{return false;}};
 ses.setPermissionCheckHandler((_webContents,permission,origin,details)=>allowed(details?.requestingUrl||origin)&&['media','notifications'].includes(permission));
 ses.setPermissionRequestHandler(async(contents,permission,callback,details)=>{
  if(!allowed(details.requestingUrl||contents.getURL())){callback(false);return;}
  if(permission==='media'){
   if(details.mediaTypes?.some(type=>type!=='audio')){callback(false);return;}
   callback(await systemPreferences.askForMediaAccess('microphone'));return;
  }
  if(permission==='notifications'){
   const response=await dialog.showMessageBox({type:'question',message:'Разрешить напоминания Планера?',detail:'Уведомления о запланированных делах появятся на этом Mac.',buttons:['Разрешить','Позже'],defaultId:0,cancelId:1});callback(response.response===0);return;
  }
  callback(false);
 });
 ses.on('will-download',(_event,item)=>{if(testMode)item.setSavePath(path.join(app.getPath('userData'),path.basename(item.getFilename())));});
}
if(!testMode&&!app.requestSingleInstanceLock())app.quit();
else{
 app.on('second-instance',()=>{if(window){window.show();window.focus();}});
 app.on('before-quit',()=>{quitting=true;localVoice?.stop();});
 app.on('activate',()=>{if(window&&!window.isDestroyed())window.show();else if(localStore)createWindow(config.mode);});
 app.whenReady().then(async()=>{
  mkdirSync(app.getPath('userData'),{recursive:true,mode:0o700});
  try{if(existsSync(configFile())){const c=JSON.parse(readFileSync(configFile(),'utf8'));config={url:c.url?serverOrigin(c.url):null,mode:c.mode==='server'&&c.url?'server':'local'};}}catch{config={url:null,mode:'local'};}
  localStore=new LocalStore(path.join(app.getPath('userData'),'plan'));
  nativeBridge=require(app.isPackaged?path.join(process.resourcesPath,'planner-native.node'):path.join(__dirname,'../desktop-native/planner-native.node'));
  localVoice=new LocalVoice(path.join(app.getPath('userData'),'voice'),app.isPackaged?path.join(process.resourcesPath,'engines'):path.join(__dirname,'../desktop-native/engines',process.arch));
  session.fromPartition('persist:planner-local').protocol.handle('planner',async request=>{
   if(!localURL(request.url))return new Response(null,{status:403});
   const url=new URL(request.url);
   if(url.pathname==='/api/attachments'&&request.method==='GET'){
    if(url.searchParams.get('user')!=='mac-local')return new Response(null,{status:401});const key=url.searchParams.get('key')||'',bytes=localStore.attachment(key);if(!bytes)return new Response(null,{status:404});
    const attachment=localStore.read().entities.flatMap(e=>e.kind==='task'?e.data.attachments:[]).find(a=>a.key===key),name=attachment?.name||'вложение';
    return new Response(bytes,{headers:{'Content-Type':attachment?.type||'application/octet-stream','Content-Disposition':"attachment; filename*=UTF-8''"+encodeURIComponent(name),'X-Content-Type-Options':'nosniff','Cache-Control':'no-store'}});
   }
   const file=assetPath(renderer,request.url);if(!file)return new Response(null,{status:404});
   try{return new Response(readFileSync(file),{headers:{'Content-Type':mime[path.extname(file)]||'application/octet-stream','X-Content-Type-Options':'nosniff','Cache-Control':'no-cache'}});}catch{return new Response(null,{status:404});}
  });
  ipcMain.handle('planner:request',async(event,request)=>{requireLocal(event);
   try{const url=new URL(request?.url,'planner://app');if(!localURL(url.href)||url.searchParams.get('user')!=='mac-local'||url.searchParams.has('space'))return{status:401,body:{error:'Неверный локальный аккаунт.'}};
    if(url.pathname==='/api/integrations')return{status:200,body:{voice:localVoice.models.ready(),telegram:false,backgroundReminders:false}};
    if(url.pathname==='/api/assistant'&&request.method==='POST')return localVoice.handle(request,localStore.read().entities);
    return localStore.request(request);
   }catch{return{status:422,body:{error:'Не удалось обработать запрос. Проверьте настройки приложения.'}};}
  });
  ipcMain.handle('planner:connection',event=>{requireLocal(event);return{url:config.url,version:app.getVersion(),voice:localVoice.models.ready(),repository:updateConfig.repository,updates:app.isPackaged};});
  ipcMain.handle('planner:connect',(event,value)=>{requireLocal(event);try{const url=serverOrigin(value);saveConfig({url,mode:'server'});setImmediate(()=>createWindow('server'));return{};}catch(error){return{error:error.message};}});
  ipcMain.handle('planner:local',event=>{requireLocal(event);setImmediate(()=>openLocal());});
  ipcMain.handle('planner:open-connection',(event,section)=>{requireLocal(event);setImmediate(()=>openLocal(section==='voice'?'voice':true));});
  ipcMain.handle('planner:back',event=>{requireLocal(event);setImmediate(goBack);});
  ipcMain.handle('planner:local-voice-status',event=>{requireLocal(event);return localVoice.models.status();});
  ipcMain.handle('planner:local-voice-prepare',async event=>{requireLocal(event);if(testMode)throw Error('Model downloads disabled in UI tests');return localVoice.setup();});
  ipcMain.handle('planner:local-voice-pause',event=>{requireLocal(event);localVoice.models.pause();});
  ipcMain.handle('planner:updates',event=>{requireLocal(event);checkUpdates();});
  configurePermissions('persist:planner-local');configurePermissions('persist:planner-server');
  app.setAboutPanelOptions({applicationName:'Планер',applicationVersion:app.getVersion(),copyright:'Личный планер · локальные данные и свой сервер'});
  if(app.isPackaged)try{nativeBridge.startUpdates(updateFeed());}catch(error){console.warn('Updater initialization failed:',error.message);}
  const win=createWindow(testMode?'local':config.mode);
  if(localStore.recovered&&!testMode)void dialog.showMessageBox(win,{type:'warning',message:'План восстановлен из предыдущей копии',detail:'Повреждённый файл сохранён в папке данных. Проверьте последние изменения.',buttons:['Понятно']});
  if(testMode){try{await require('./smoke.cjs')({app,win,localStore,createWindow,root:path.join(__dirname,'..')});app.exit(0);}catch(error){console.error(error);app.exit(1);}}
 }).catch(error=>{if(testMode)console.error(error);else dialog.showErrorBox('Не удалось открыть Планер',error.message+'\nИсходные данные не удалены.');app.exit(1);});
}
