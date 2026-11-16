import {existsSync,mkdirSync,readFileSync,writeFileSync,copyFileSync,openSync,closeSync} from 'node:fs';
import {resolve,join} from 'node:path';
import {spawn} from 'node:child_process';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('..',import.meta.url)),base=resolve(root,'desktop-native/local-src');
const sources=[
 {name:'cmake',url:'https://github.com/Kitware/CMake/releases/download/v4.5.0/cmake-4.5.0-macos-universal.tar.gz',hash:'a645d69fd21e521759cc0c64e7c60462d43faf0c7214ac05f75c80f7c5037dde'},
 {name:'whisper',url:'https://codeload.github.com/ggml-org/whisper.cpp/tar.gz/aba02defd6bb6ff5de63721c21e3456645c153e2',hash:'bcfdb3c3cbe74171067bee2d070acfd7f0dd147ea972a56cd98dd2a01ad3f332'},
 {name:'llama',url:'https://codeload.github.com/ggml-org/llama.cpp/tar.gz/8bfd64b5ac8638aa14467a7a9b337a6f7f8e054c',hash:'10ea351b69ee2a04b109aace943d3b77feb2f23ac3c70c5d4d2a58e3d1590896'}
];
function run(binary,args,log){return new Promise((resolve,reject)=>{const fd=openSync(log,'a'),child=spawn(binary,args,{cwd:root,stdio:['ignore',fd,fd]});child.on('error',e=>{closeSync(fd);reject(e);});child.on('close',code=>{closeSync(fd);if(code===0)resolve();else reject(Error('Local engine build failed: '+readFileSync(log,'utf8').slice(-5000)));});});}
let prepared;
async function prepare(){
 mkdirSync(base,{recursive:true});for(const source of sources){
  const archive=join(base,source.name+'.tar.gz'),directory=join(base,source.name);if(!existsSync(archive)){const r=await fetch(source.url);if(!r.ok)throw Error('Cannot download '+source.name);writeFileSync(archive,Buffer.from(await r.arrayBuffer()));}
  if(createHash('sha256').update(readFileSync(archive)).digest('hex')!==source.hash)throw Error('Source checksum mismatch: '+source.name);
  if(!existsSync(join(directory,'.verified-source'))){mkdirSync(directory,{recursive:true});await run('/usr/bin/tar',['-xf',archive,'--strip-components=1','-C',directory],join(base,'extract.log'));writeFileSync(join(directory,'.verified-source'),source.hash);}
 }
}
export async function buildLocalEngines(arch=process.arch){
 if(!['arm64','x64'].includes(arch))throw Error('Unsupported Mac architecture '+arch);
 await(prepared||=prepare());const output=resolve(root,'desktop-native/engines',arch);mkdirSync(output,{recursive:true});
 const cmake=join(base,'cmake/CMake.app/Contents/bin/cmake');
 for(const [name,target] of [['whisper','whisper-cli'],['llama','llama-completion']]){
  const signature=sources.find(s=>s.name===name).hash+'-'+arch+'-static-v1';if(existsSync(join(output,target))&&existsSync(join(output,target+'.build'))&&readFileSync(join(output,target+'.build'),'utf8')===signature)continue;
  const build=join(base,`build-${name}-${arch}`),log=join(base,`build-${name}-${arch}.log`),args=['-S',join(base,name),'-B',build,'-DCMAKE_BUILD_TYPE=Release','-DCMAKE_OSX_DEPLOYMENT_TARGET=12.0','-DCMAKE_POLICY_VERSION_MINIMUM=3.5','-DCMAKE_OSX_ARCHITECTURES='+(arch==='x64'?'x86_64':'arm64'),'-DBUILD_SHARED_LIBS=OFF','-DGGML_NATIVE=OFF','-DGGML_OPENMP=OFF','-DGGML_METAL=ON','-DGGML_METAL_EMBED_LIBRARY=ON','-DGGML_BACKEND_DL=OFF','-DGGML_CCACHE=OFF'];
  if(name==='whisper')args.push('-DWHISPER_BUILD_TESTS=OFF','-DWHISPER_BUILD_SERVER=OFF','-DWHISPER_BUILD_EXAMPLES=ON','-DWHISPER_CURL=OFF');
  else args.push('-DLLAMA_BUILD_TESTS=OFF','-DLLAMA_BUILD_EXAMPLES=OFF','-DLLAMA_BUILD_TOOLS=ON','-DLLAMA_BUILD_SERVER=OFF','-DLLAMA_BUILD_APP=OFF','-DLLAMA_OPENSSL=OFF','-DLLAMA_SUBPROCESS=OFF');
  console.log('Building local '+name+' for '+arch);await run(cmake,args,log);await run(cmake,['--build',build,'--config','Release','--target',target,'-j','4'],log);
  copyFileSync(join(build,'bin',target),join(output,target));writeFileSync(join(output,target+'.build'),signature);
 }
}
if(process.argv[1]===fileURLToPath(import.meta.url))await buildLocalEngines(process.argv[2]||process.arch);
