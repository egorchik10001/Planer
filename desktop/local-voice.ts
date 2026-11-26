import {mkdirSync,mkdtempSync,writeFileSync,readFileSync,rmSync} from 'node:fs';
import {join} from 'node:path';
import {spawn} from 'node:child_process';
import {ModelManager} from './model-manager';
import type {Entity} from '../lib/planner';
import {localSchema,prepareLocalVoice} from '../lib/local-assistant';
import {pcmSpeechData} from './wav';
export {groundSpokenDates} from '../lib/voice-dates';
export {exactTimeEvidence} from '../lib/local-assistant';
type Input={body?:string;capturedAt?:string;file?:{name:string;type:string;bytes:Uint8Array}};
export class LocalVoice{
 readonly models:ModelManager;private busy=false;private child:ReturnType<typeof spawn>|null=null;
 readonly initialized:Promise<void>;
 constructor(readonly directory:string,readonly engines:string){this.models=new ModelManager(join(directory,'models'));mkdirSync(join(directory,'jobs'),{recursive:true,mode:0o700});this.initialized=this.models.verifyExisting();}
 async setup(){await this.initialized;void this.models.start();return this.models.status();}
 stop(){this.models.pause();this.child?.kill('SIGKILL');}
 private run(binary:string,args:string[],timeout=process.platform==='win32'?360000:180000):Promise<string>{return new Promise((resolve,reject)=>{
  const executable=process.platform==='win32'?binary+'.exe':binary;
  const smoke=process.argv.includes('--planner-smoke')&&process.env.PLANNER_SMOKE_VOICE_WAV;
  const child=spawn(join(this.engines,executable),args,{stdio:['ignore','pipe','pipe'],windowsHide:true});this.child=child;let stdout='',stderr='';let timedOut=false;
  if(smoke)console.log('Starting '+executable);
  const timer=setTimeout(()=>{timedOut=true;child.kill('SIGTERM');setTimeout(()=>child.kill('SIGKILL'),1500).unref();},timeout);
  child.stdout?.setEncoding('utf8');
  child.stdout?.on('data',chunk=>{stdout+=chunk.toString();if(stdout.length>1024*1024)child.kill('SIGTERM');});child.stderr?.on('data',chunk=>{stderr=(stderr+chunk.toString()).slice(-2000);});
  child.on('error',error=>{if(smoke)console.error(error.message);clearTimeout(timer);this.child=null;reject(Error('Не удалось запустить локальную модель. Переустановите последнюю версию планера.'));});
  child.on('close',code=>{
   if(smoke)console.log(executable+' exit code '+code+(code===0?'':': '+stderr));
   clearTimeout(timer);this.child=null;
   if(code===0){resolve(stdout);return;}
   if(process.platform==='win32'&&code!==null&&(code>>>0)===0xc000001d){
    reject(Error('Для локального разбора голоса на Windows нужен процессор с AVX2. Исходная запись сохранена.'));return;
   }
   reject(Error(timedOut?'Разбор занял слишком много времени. Попробуйте более короткую запись.':'Локальная модель не смогла обработать запись. Повторите попытку; исходная заметка сохранена.'));
  });
 });}
 async handle(input:Input,entities:Entity[]){
  if(this.busy)return{status:409,body:{error:'Дождитесь разбора предыдущей записи.'}};
  this.busy=true;let job='';
  try{
   await this.initialized;if(!this.models.ready())throw Error('Подготовьте голос в настройках приложения. Запись сохранена, API-ключ не нужен.');
   job=mkdtempSync(join(this.directory,'jobs','voice-'));let text='',capturedAt:unknown;
   if(input.file){
    const bytes=input.file.bytes;if(!(bytes instanceof Uint8Array)||bytes.byteLength<44||bytes.byteLength>16*1024*1024)throw Error('Запишите сообщение до трёх минут.');
    const audio=Buffer.from(bytes),pcm=pcmSpeechData(bytes);
    let energy=0,count=0;for(let i=0;i+1<pcm.length;i+=2){const n=pcm.readInt16LE(i)/32768;energy+=n*n;count++;}if(!count||Math.sqrt(energy/count)<.001)throw Error('В записи не слышно речи. Попробуйте записать ближе к микрофону.');
    const file=join(job,'speech.wav');writeFileSync(file,audio,{mode:0o600});capturedAt=input.capturedAt;
    await this.run('whisper-cli',['-m',this.models.path('speech'),'-f',file,'-l','ru','-t','4','-nt','-np','-oj','-of',join(job,'transcript')]);
    const transcript=JSON.parse(readFileSync(join(job,'transcript.json'),'utf8'));text=transcript.transcription?.map((s:any)=>s.text).join(' ').trim()||'';
   }else{
    if(!input.body||Buffer.byteLength(input.body)>30000)throw Error('Напишите сообщение до 20 тысяч символов.');const data=JSON.parse(input.body);if(data.image)throw Error('Локальный разбор скриншотов пока недоступен. Запишите голосом или напишите текст.');text=typeof data.text==='string'?data.text:'';capturedAt=data.capturedAt;
   }
   const draft=prepareLocalVoice(text,capturedAt,entities);
   writeFileSync(join(job,'prompt.txt'),draft.prompt,{mode:0o600});writeFileSync(join(job,'schema.json'),JSON.stringify(localSchema),{mode:0o600});
   const generated=await this.run('llama-completion',['-m',this.models.path('planner'),'-f',join(job,'prompt.txt'),'-jf',join(job,'schema.json'),'-n','1200','-c','8192','-t','4','-ngl',process.platform==='win32'?'0':'99','--temp','0','-no-cnv','--no-display-prompt','--log-verbosity','0','--offline']);
   return {status:200,body:draft.parse(generated)};
  }catch(error){return{status:422,body:{error:error instanceof Error&&!error.message.startsWith('[')?error.message:'Локальная модель предложила неточные поля. Уточните сообщение; запись сохранена.'}};}
  finally{this.busy=false;if(job)rmSync(job,{recursive:true,force:true});}
 }
}
