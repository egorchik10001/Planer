import {transcribeWithKey,interpretWithKey} from '../lib/assistant-core';
import type {Entity} from '../lib/planner';
export async function desktopAssistant(input:{body?:string;capturedAt?:string;file?:{name:string;type:string;bytes:Uint8Array}},entities:Entity[],key:string,fetcher:typeof fetch=fetch){
 try{
  if(!key)throw new Error('Подключите умный голос в настройках приложения. Запись остаётся на этом Mac.');
  let text='',image:string|undefined,capturedAt:unknown;
  if(input.file){
   const file=input.file;if(!(file.bytes instanceof Uint8Array)||file.bytes.byteLength>20*1024*1024||!['audio/webm','audio/webm;codecs=opus','audio/mp4','audio/mpeg','audio/wav','audio/x-wav','audio/ogg'].includes(file.type))throw new Error('Выберите аудиозапись до 20 МБ.');
   capturedAt=input.capturedAt;text=await transcribeWithKey(new File([file.bytes as BlobPart],file.name,{type:file.type}),key,'gpt-transcribe',fetcher);
  }else{
   if(!input.body||Buffer.byteLength(input.body)>8*1024*1024)throw new Error('Слишком большое сообщение.');
   const data=JSON.parse(input.body);text=typeof data.text==='string'?data.text:'';capturedAt=data.capturedAt;
   if(typeof data.image==='string'&&/^data:image\/(png|jpeg|webp);base64,/.test(data.image)&&data.image.length<8*1024*1024)image=data.image;
  }
  const time=typeof capturedAt==='string'?Date.parse(capturedAt):NaN;if(capturedAt&&(!Number.isFinite(time)||time>Date.now()+60000))throw new Error('Не удалось определить дату записи.');
  if(!text.trim()&&!image)throw new Error('Расскажите, что нужно сделать.');
  return{status:200,body:{result:await interpretWithKey(entities,text,image,Number.isFinite(time)?new Date(time):undefined,key,'gpt-4o-mini',fetcher),sourceText:text}};
 }catch(error){return{status:422,body:{error:error instanceof Error?error.message:'Не удалось разобрать запись. Она сохранена на Mac.'}};}
}
