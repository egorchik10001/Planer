const {readFileSync,writeFileSync}=require('node:fs');
const {join}=require('node:path');
const {spawnSync}=require('node:child_process');
module.exports=async context=>{
 const config=JSON.parse(readFileSync(join(context.packager.projectDir,'desktop/update-config.json'),'utf8'));
 const plist=join(context.appOutDir,'Планер.app/Contents/Info.plist');
 const values={SUPublicEDKey:config.publicKey,SUFeedURL:`https://github.com/${config.repository}/releases/latest/download/appcast-${context.arch===1?'x64':'arm64'}.xml`};
 for(const [key,value] of Object.entries(values)){
  const result=spawnSync('/usr/libexec/PlistBuddy',['-c',`Add :${key} string ${value}`,plist],{encoding:'utf8'});if(result.status!==0)throw Error('Не удалось добавить '+key+' в Info.plist.');
 }
 for(const [key,value] of Object.entries({SUEnableAutomaticChecks:'true',SUAutomaticallyUpdate:'false',SUVerifyUpdateBeforeExtraction:'true',SURequireSignedFeed:'true'})){
  const result=spawnSync('/usr/libexec/PlistBuddy',['-c',`Add :${key} bool ${value}`,plist],{encoding:'utf8'});if(result.status!==0)throw Error('Не удалось настроить Sparkle.');
 }
};
