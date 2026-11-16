import {mkdirSync,existsSync,statSync,renameSync,unlinkSync,createReadStream,createWriteStream} from 'node:fs';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import {Readable,Transform} from 'node:stream';
import {pipeline} from 'node:stream/promises';
import manifest from './local-models.json';
type Model={id:string;name:string;file:string;bytes:number;sha256:string;url:string};
export async function digestFile(path:string){const hash=createHash('sha256');for await(const chunk of createReadStream(path))hash.update(chunk);return hash.digest('hex');}
export class ModelManager{
 private verified=new Set<string>();private controller:AbortController|null=null;private task:Promise<void>|null=null;
 private stage='missing';private error='';private current='';private progress=0;
 constructor(readonly directory:string,readonly models:Model[]=manifest,private fetcher:typeof fetch=fetch){mkdirSync(directory,{recursive:true,mode:0o700});}
 path(id:string){const model=this.models.find(m=>m.id===id);if(!model)throw Error('Неизвестная модель.');return join(this.directory,model.file);}
 ready(){return this.models.every(m=>this.verified.has(m.id));}
 status(){const total=this.models.reduce((n,m)=>n+m.bytes,0);let downloaded=0;for(const m of this.models){const p=this.path(m.id),part=p+'.part';downloaded+=this.verified.has(m.id)?m.bytes:existsSync(part)?Math.min(statSync(part).size,m.bytes):0;}
  return{ready:this.ready(),stage:this.ready()?'ready':this.stage,error:this.error,current:this.current,downloaded,total,percent:Math.min(100,Math.floor(downloaded/total*100)),models:this.models.map(m=>({id:m.id,name:m.name,bytes:m.bytes,ready:this.verified.has(m.id)}))};}
 async verifyExisting(){this.stage='checking';try{for(const m of this.models){const p=this.path(m.id);if(existsSync(p)&&statSync(p).size===m.bytes&&await digestFile(p)===m.sha256)this.verified.add(m.id);}this.stage=this.ready()?'ready':'missing';}catch{this.stage='error';this.error='Не удалось проверить модели. Освободите место на диске и повторите подготовку.';}}
 start(){if(this.task)return this.task;this.controller=new AbortController();this.error='';this.task=this.downloadAll(this.controller.signal).catch(error=>{this.stage=this.controller?.signal.aborted?'paused':'error';this.error=this.stage==='paused'?'Загрузка приостановлена. Можно продолжить позже.':error instanceof Error?error.message:'Не удалось скачать модели.';}).finally(()=>{this.task=null;this.controller=null;});return this.task;}
 pause(){this.controller?.abort();}
 private async downloadAll(signal:AbortSignal){
  for(const model of this.models){if(this.verified.has(model.id))continue;signal.throwIfAborted();this.stage='downloading';this.current=model.name;
   const file=this.path(model.id),part=file+'.part';let offset=existsSync(part)?statSync(part).size:0;if(offset>model.bytes){unlinkSync(part);offset=0;}
   if(offset<model.bytes){
    const r=await this.fetcher(model.url,{headers:offset?{Range:`bytes=${offset}-`}:{},signal});
    if(!r.ok||!r.body)throw Error('Не удалось скачать «'+model.name+'». Проверьте интернет и повторите.');
    if(offset&&r.status===206){if(!r.headers.get('content-range')?.startsWith('bytes '+offset+'-'))throw Error('Сервер не смог продолжить загрузку. Повторите позже.');}else offset=0;
    let received=offset;const limit=new Transform({transform(chunk,encoding,callback){received+=chunk.length;if(received>model.bytes)callback(Error('Размер модели не совпал.'));else callback(null,chunk);}});
    await pipeline(Readable.fromWeb(r.body as any),limit,createWriteStream(part,{flags:offset?'a':'w',mode:0o600}),{signal});
   }
   this.stage='checking';if(!existsSync(part)||statSync(part).size!==model.bytes||await digestFile(part)!==model.sha256){if(existsSync(part))unlinkSync(part);throw Error('Проверка модели «'+model.name+'» не прошла. Нажмите «Повторить».');}
   signal.throwIfAborted();renameSync(part,file);this.verified.add(model.id);
  }
  this.stage='ready';this.current='';
 }
}
