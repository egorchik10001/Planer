const {contextBridge,ipcRenderer}=require('electron');
if(location.protocol==='planner:'&&location.hostname==='app'){
 contextBridge.exposeInMainWorld('plannerDesktop',{
  request:request=>ipcRenderer.invoke('planner:request',request),
  connection:()=>ipcRenderer.invoke('planner:connection'),
  connect:url=>ipcRenderer.invoke('planner:connect',url),
  openLocal:()=>ipcRenderer.invoke('planner:local'),
  openConnection:section=>ipcRenderer.invoke('planner:open-connection',section),
  saveVoiceKey:key=>ipcRenderer.invoke('planner:voice-save',key),
  removeVoiceKey:()=>ipcRenderer.invoke('planner:voice-remove'),
  checkUpdates:()=>ipcRenderer.invoke('planner:updates'),
  onCommand:callback=>{const handle=(_event,name)=>callback(name);ipcRenderer.on('planner:command',handle);return()=>ipcRenderer.removeListener('planner:command',handle);}
 });
}
