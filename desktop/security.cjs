const path=require('node:path');
function localURL(value){try{const u=new URL(value);return u.protocol==='planner:'&&u.hostname==='app'&&!u.username&&!u.password&&!u.port;}catch{return false;}}
function serverOrigin(value){const u=new URL(String(value).trim());if(u.protocol!=='https:'||!u.hostname||u.username||u.password||u.search||u.hash||!['','/'].includes(u.pathname))throw new Error('Введите HTTPS-адрес сервера планера без пути, логина и пароля.');return u.origin;}
function assetPath(root,value){if(!localURL(value))return null;try{let p=decodeURIComponent(new URL(value).pathname);if(p.includes('\0'))return null;if(p==='/'||p==='/connection')p='/index.html';const result=path.resolve(root,'.'+p);return result.startsWith(path.resolve(root)+path.sep)?result:null;}catch{return null;}}
function externalURL(value){try{const u=new URL(value);return ['https:','http:','mailto:','tg:'].includes(u.protocol)&&!u.username&&!u.password;}catch{return false;}}
module.exports={localURL,serverOrigin,assetPath,externalURL};
