import {mkdirSync,readFileSync,writeFileSync,renameSync,existsSync,openSync,closeSync,fsyncSync,copyFileSync,readdirSync,unlinkSync} from 'node:fs';
import {join} from 'node:path';
import {LocalPlan,emptyLocalPlan,validState,LOCAL_USER as USER,type State,type Wire} from '../lib/local-plan';

export class LocalStore{
 private readonly plan = new LocalPlan(
  () => this.read(),
  state => this.save(state),
  {
   has: key => { const file = this.attachmentPath(key); return !!file && existsSync(file); },
   put: (key, bytes) => writeFileSync(this.attachmentPath(key)!, bytes, {flag:'wx',mode:0o600}),
   get: key => this.attachment(key)
  }
 );
 readonly file:string;readonly files:string;recovered=false;
 constructor(readonly directory:string){
  mkdirSync(directory,{recursive:true,mode:0o700});this.file=join(directory,'planner.json');this.files=join(directory,'files');mkdirSync(this.files,{recursive:true,mode:0o700});
  if(existsSync(this.file)){try{this.read();}catch(error){const previous=this.file+'.previous';if(!existsSync(previous))throw error;validState(JSON.parse(readFileSync(previous,'utf8')));copyFileSync(this.file,this.file+'.damaged-'+Date.now());copyFileSync(previous,this.file);this.recovered=true;}}
  else this.save(emptyLocalPlan());
 }
 read():State{return validState(JSON.parse(readFileSync(this.file,'utf8')));}
 save(state:State){
  const data=JSON.stringify(state);if(Buffer.byteLength(data)>100*1024*1024)throw new Error('Локальная база превышает 100 МБ. Сохраните резервную копию.');
  if(existsSync(this.file)){
   copyFileSync(this.file,this.file+'.previous');
   const backups=join(this.directory,'backups');mkdirSync(backups,{recursive:true,mode:0o700});const name=new Date().toISOString().slice(0,10)+'.json';if(!existsSync(join(backups,name)))copyFileSync(this.file,join(backups,name));
   for(const old of readdirSync(backups).filter(p=>/^\d{4}-\d{2}-\d{2}\.json$/.test(p)).sort().slice(0,-7))unlinkSync(join(backups,old));
  }
  const temp=this.file+'.tmp';const fd=openSync(temp,'w',0o600);try{writeFileSync(fd,data);fsyncSync(fd);}finally{closeSync(fd);}renameSync(temp,this.file);
 }
 attachmentPath(key:string){return /^mac-local\/[0-9a-f-]{36}$/.test(key)?join(this.files,key.slice(USER.length+1)):null;}
 attachment(key:string){const path=this.attachmentPath(key);if(!path||!existsSync(path))return null;return readFileSync(path);}
 request(input:Wire){return this.plan.request(input);}
}
