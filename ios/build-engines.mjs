import {readFileSync,writeFileSync,mkdirSync,existsSync,readdirSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';

const root=fileURLToPath(new URL('.',import.meta.url));
const targets=process.argv.slice(2);
if(!targets.length||!targets.every(value=>['iphoneos','iphonesimulator','macosx'].includes(value)))throw Error('Choose iphoneos, iphonesimulator or macosx.');
const source=join(root,'generated','sources');
mkdirSync(source,{recursive:true});
const pins=[
  ['llama','ggml-org/llama.cpp','8bfd64b5ac8638aa14467a7a9b337a6f7f8e054c','10ea351b69ee2a04b109aace943d3b77feb2f23ac3c70c5d4d2a58e3d1590896'],
  ['whisper','ggml-org/whisper.cpp','aba02defd6bb6ff5de63721c21e3456645c153e2','bcfdb3c3cbe74171067bee2d070acfd7f0dd147ea972a56cd98dd2a01ad3f332']
];
function run(binary,args) {
  const r=spawnSync(binary,args,{stdio:'inherit'});
  if(r.status!==0)throw(r.error??Error(binary+' failed with status '+r.status));
}

for(const [name,repo,revision,digest] of pins){
  const archive=join(source,name+'.tar.gz');
  const dir=join(source,name);
  const stamp=join(dir,'.planner-source');
  if(existsSync(stamp)&&readFileSync(stamp,'utf8')===digest)continue;
  if(!existsSync(archive))run('curl',['--fail','--location','--retry','3','--output',archive,`https://codeload.github.com/${repo}/tar.gz/${revision}`]);
  if(createHash('sha256').update(readFileSync(archive)).digest('hex')!==digest)throw Error('Checksum mismatch for '+name);
  mkdirSync(dir,{recursive:true});
  run('tar',['-xf',archive,'--strip-components=1','-C',dir]);
  writeFileSync(stamp,digest);
}

for(const sdk of targets){
  const build=join(root,'generated','build-'+sdk);
  const lib=join(root,'generated','lib',sdk);
  mkdirSync(lib,{recursive:true});
  const architecture=sdk==='iphoneos'?'arm64':process.arch==='x64'?'x86_64':'arm64';
  const args=['-S',join(root,'engines'),'-B',build,'-G','Unix Makefiles','-DCMAKE_BUILD_TYPE=Release','-DCMAKE_POLICY_VERSION_MINIMUM=3.5','-DENGINE_SOURCES='+source,'-DCMAKE_OSX_ARCHITECTURES='+architecture,'-DGGML_METAL='+(sdk==='iphonesimulator'?'OFF':'ON')];
  if(sdk!=='macosx'){
    args.push('-DCMAKE_SYSTEM_NAME=iOS','-DCMAKE_OSX_SYSROOT='+sdk,'-DCMAKE_OSX_DEPLOYMENT_TARGET=17.0','-DCMAKE_TRY_COMPILE_TARGET_TYPE=STATIC_LIBRARY');
  }
  run('cmake',args);
  run('cmake',['--build',build,'--target','PlannerVoice','-j','4']);
  const archives=readdirSync(build,{recursive:true}).filter(name=>/\/lib(?:llama|whisper|ggml[-\w]*)\.a$/.test('/'+name)||name==='libPlannerVoice.a').map(name=>resolve(build,name));
  if(archives.length<5)throw Error('Native voice archives were not built.');
  run('xcrun',['libtool','-static','-o',join(lib,'libPlannerVoice.a'),...archives]);
}
