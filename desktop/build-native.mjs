import {existsSync,mkdirSync,readFileSync,writeFileSync,cpSync} from 'node:fs';
import {resolve,join} from 'node:path';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('..',import.meta.url));
export async function buildNative(){
 if(process.platform!=='darwin')throw Error('Mac-приложение собирается на macOS.');
 const vendor=resolve(root,'desktop-native/vendor'),archive=join(vendor,'Sparkle-2.10.1.tar.xz'),framework=join(vendor,'Sparkle.framework');mkdirSync(vendor,{recursive:true});
 if(!existsSync(framework)){
  if(!existsSync(archive)){const response=await fetch('https://github.com/sparkle-project/Sparkle/releases/download/2.10.1/Sparkle-2.10.1.tar.xz');if(!response.ok)throw Error('Не удалось скачать Sparkle.');writeFileSync(archive,Buffer.from(await response.arrayBuffer()));}
  if(createHash('sha256').update(readFileSync(archive)).digest('hex')!=='1a856d2a9edb8e628de88121d7be04cf0e2167f8641650b78fca00b14244cf27')throw Error('Контрольная сумма Sparkle не совпала.');
  const result=spawnSync('/usr/bin/tar',['-xf',archive,'-C',vendor],{stdio:'inherit'});if(result.status!==0)throw Error('Не удалось распаковать Sparkle.');
 }
 const output=resolve(root,'desktop-native/planner-native.node');
 const result=spawnSync('/usr/bin/clang++',['-std=c++17','-fobjc-arc','-bundle','-undefined','dynamic_lookup','-arch','arm64','-arch','x86_64','-mmacosx-version-min=12.0','-I',resolve(root,'node_modules/node-api-headers/include'),'-F',vendor,'-framework','Cocoa','-framework','Security','-framework','Sparkle','-Wl,-rpath,@loader_path/../Frameworks',resolve(root,'desktop/native/planner-native.mm'),'-o',output],{stdio:'inherit'});
 if(result.status!==0)throw Error('Не удалось собрать native-модуль Mac.');
 // Development Electron also finds the framework beside the resource directory.
 mkdirSync(resolve(root,'Frameworks'),{recursive:true});cpSync(framework,resolve(root,'Frameworks/Sparkle.framework'),{recursive:true,dereference:false,preserveTimestamps:true});
}
