import React from 'react';
import Connection from './DesktopSettings';
import {createRoot} from 'react-dom/client';
import Planner from '../../app/Planner';
import '../../app/globals.css';
import './mac.css';

declare global{interface Window{plannerDesktop:{request:(request:any)=>Promise<{status:number;body:any}>;connection:()=>Promise<{url:string|null;version:string;voice:boolean;repository:string;updates:boolean}>;connect:(url:string)=>Promise<{error?:string}>;openLocal:()=>Promise<void>;openConnection:(section?:string)=>Promise<void>;saveVoiceKey:(key:string)=>Promise<void>;removeVoiceKey:()=>Promise<void>;checkUpdates:()=>Promise<void>;onCommand:(callback:(name:string)=>void)=>()=>void}}}
const native=window.plannerDesktop;
if(!native)throw new Error('Запустите планер через Mac-приложение.');
const originalFetch=window.fetch.bind(window);
window.fetch=async(input:RequestInfo|URL,init?:RequestInit)=>{
 const request=input instanceof Request?input:new Request(new URL(String(input),location.href),init);
 const url=new URL(request.url);if(url.protocol!=='planner:'||url.hostname!=='app'||!url.pathname.startsWith('/api/'))return originalFetch(input,init);
 const wire:any={url:request.url,method:request.method};
 if(request.method!=='GET'){
  if(request.headers.get('content-type')?.startsWith('multipart/form-data')){const form=await request.formData(),file=form.get('file')||form.get('audio');if(file instanceof File)wire.file={name:file.name,type:file.type,bytes:new Uint8Array(await file.arrayBuffer())};wire.capturedAt=form.get('capturedAt');}
  else wire.body=await request.text();
 }
 const result=await native.request(wire);return new Response(JSON.stringify(result.body),{status:result.status,headers:{'Content-Type':'application/json'}});
};
class Boundary extends React.Component<{children:React.ReactNode},{error:boolean}>{state={error:false};static getDerivedStateFromError(){return{error:true};}render(){return this.state.error?<main className="mac-connection"><h1>Не удалось открыть план</h1><p>Данные на Mac сохранены. Попробуй перезапустить приложение.</p><button className="button primary" onClick={()=>location.reload()}>Открыть заново</button></main>:this.props.children;}}
const connection=location.pathname==='/connection';
createRoot(document.getElementById('root')!).render(<Boundary>{connection?<Connection/>:<Planner owner="mac-local:mac-local" email="Личный план на этом Mac" spaceId={null} spaces={[]} currentUserId="mac-local" localMode onVoiceSettings={()=>void native.openConnection('voice')} onConnect={()=>void native.openConnection()}/>}</Boundary>);
native.onCommand(name=>window.dispatchEvent(new Event('planner:'+name)));
