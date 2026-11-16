const {contextBridge,ipcRenderer}=require('electron');
if(location.protocol==='planner:'&&location.hostname==='app'){
 contextBridge.exposeInMainWorld('plannerDesktop',{
  request:request=>ipcRenderer.invoke('planner:request',request),
  connection:()=>ipcRenderer.invoke('planner:connection'),
  connect:url=>ipcRenderer.invoke('planner:connect',url),
  openLocal:()=>ipcRenderer.invoke('planner:local'),
  openConnection:section=>ipcRenderer.invoke('planner:open-connection',section),
  goBack:()=>ipcRenderer.invoke('planner:back'),
  localVoiceStatus:()=>ipcRenderer.invoke('planner:local-voice-status'),
  prepareLocalVoice:()=>ipcRenderer.invoke('planner:local-voice-prepare'),
  pauseLocalVoice:()=>ipcRenderer.invoke('planner:local-voice-pause'),
  checkUpdates:()=>ipcRenderer.invoke('planner:updates'),
  onCommand:callback=>{const handle=(_event,name)=>callback(name);ipcRenderer.on('planner:command',handle);return()=>ipcRenderer.removeListener('planner:command',handle);}
 });
}
