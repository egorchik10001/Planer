import {readFileSync,writeFileSync,existsSync,statSync} from 'node:fs';
import {resolve,join} from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
const root=fileURLToPath(new URL('..',import.meta.url)),config=JSON.parse(readFileSync(join(root,'desktop/update-config.json'),'utf8')),version=JSON.parse(readFileSync(join(root,'package.json'),'utf8')).version;
if(!/^\d+\.\d+\.\d+$/.test(version)||!/^[-\w]+\/[-.\w]+$/.test(config.repository))throw Error('Проверьте версию и репозиторий.');
const tool=join(root,'desktop-native/vendor/bin/sign_update'),release=join(root,'release');
function sign(args){const r=spawnSync(tool,['--account',config.keychainAccount,...args],{encoding:'utf8'});if(r.status!==0)throw Error('Не удалось подписать выпуск. Проверьте доступ к собственному ключу Sparkle в Связке ключей.');return r.stdout.trim();}
const sums=[];let count=0;
for(const arch of ['arm64','x64']){
 const name=`Planner-${version}-mac-${arch}.zip`,file=join(release,name);if(!existsSync(file))continue;
 const signature=sign(['-p',file]);sign(['--verify',file,signature]);const feed=join(release,`appcast-${arch}.xml`);
 writeFileSync(feed,`<?xml version="1.0" encoding="utf-8"?>
<rss version="2.0" xmlns:sparkle="http://www.andymatuschak.org/xml-namespaces/sparkle"><channel><title>Планер для Mac</title><item>
<title>Планер ${version}</title><pubDate>${new Date().toUTCString()}</pubDate><sparkle:version>${version}</sparkle:version><sparkle:shortVersionString>${version}</sparkle:shortVersionString><sparkle:minimumSystemVersion>12.0.0</sparkle:minimumSystemVersion>
<description>Обновление личного планера. Задачи и локальные настройки сохраняются.</description>
<enclosure url="https://github.com/${config.repository}/releases/download/v${version}/${name}" sparkle:edSignature="${signature}" length="${statSync(file).size}" type="application/octet-stream" sparkle:os="macos"/>
</item></channel></rss>`);
 sign([feed]);sign(['--verify',feed]);sums.push(createHash('sha256').update(readFileSync(file)).digest('hex')+'  '+name);count++;
 const dmg=`Planner-${version}-mac-${arch}.dmg`;if(existsSync(join(release,dmg)))sums.push(createHash('sha256').update(readFileSync(join(release,dmg))).digest('hex')+'  '+dmg);
 console.log('Проверены подписи архива и '+`appcast-${arch}.xml`);
}
if(!count)throw Error('Сначала соберите ZIP приложения.');writeFileSync(join(release,'SHA256SUMS.txt'),sums.join('\n')+'\n');
