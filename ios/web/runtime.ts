import {LocalPlan, emptyLocalPlan, validState, LOCAL_USER, type State, type Wire} from '../../lib/local-plan';

import {native,base64,fromBase64} from './device-bridge';

function json(body: unknown, status=200) {
  return new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/json'}});
}

export async function installLocalRequests() {
  let recovered=false;
  const payload=await native<string|null>('readPlan');
  let state:State;
  try{state=payload===null?emptyLocalPlan():validState(JSON.parse(payload));}
  catch{
    const previous=await native<string|null>('readPreviousPlan');
    if(previous===null)throw Error('Не удалось прочитать сохранённый план.');
    state=validState(JSON.parse(previous));
    await native('recoverPlan');
    recovered=true;
  }
  const fileKeys=new Set(await native<string[]>('listAttachments'));
  let writes:Promise<unknown>=Promise.resolve();
  const originalFetch=window.fetch.bind(window);
  window.fetch=async(input,init)=>{
    const url=new URL(input instanceof Request?input.url:String(input),location.href);
    if (url.protocol!==location.protocol||url.host!==location.host||!url.pathname.startsWith('/api/')) return originalFetch(input,init);
    const request=input instanceof Request?input:new Request(url.href,init);
    if (url.searchParams.get('user')!==LOCAL_USER||url.searchParams.has('space')) {
      return json({error:'Неверный локальный аккаунт.'},401);
    }
    if(url.pathname==='/api/integrations')return json({voice:await native<boolean>('voiceReady'),telegram:false,backgroundReminders:false});
    if(url.pathname==='/api/attachments'&&request.method==='GET'){
      const key=url.searchParams.get('key')??'';
      const attachment=state.entities.flatMap(entity=>entity.kind==='task'&&'attachments' in entity.data?entity.data.attachments:[]).find(file=>file.key===key);
      if(!attachment||!fileKeys.has(key))return json({error:'Файл не найден.'},404);
      try{return new Response(fromBase64(await native<string>('readAttachment',{id:key.slice(LOCAL_USER.length+1)})),{headers:{'Content-Type':attachment.type}});}
      catch{return json({error:'Не удалось прочитать вложение.'},404);}
    }
    const wire:Wire={url:'planner://app'+url.pathname+url.search,method:request.method};
    if(request.method!=='GET'){
      if(request.headers.get('content-type')?.startsWith('multipart/form-data')){
        const file=(await request.formData()).get('file');
        if(file instanceof File&&file.size<=10*1024*1024)wire.file={name:file.name,type:file.type,bytes:new Uint8Array(await file.arrayBuffer())};
      }else wire.body=await request.text();
    }
    const operation=writes.then(async()=>{
      const next:{plan?:State;file?:{key:string;bytes:Uint8Array}}={};
      const engine=new LocalPlan(()=>structuredClone(state),plan=>{next.plan=plan;},{
        has:key=>fileKeys.has(key),
        put:(key,bytes)=>{next.file={key,bytes};},
        get:()=>null
      });
      const {body,status}=engine.request(wire);
      if(status<300){
        try{
          if(next.file){
            const {key,bytes}=next.file;
            await native('writeAttachment',{id:key.slice(LOCAL_USER.length+1),data:base64(bytes)});
            fileKeys.add(key);
          }
          if(next.plan){await native('writePlan',{data:JSON.stringify(next.plan)});state=next.plan;}
        }catch{return json({error:'Не удалось сохранить изменения на iPhone. Проверь место в хранилище.'},507);}
      }
      return json(body,status);
    });
    writes=operation.catch(()=>{});
    return operation;
  };
  return recovered;
}
