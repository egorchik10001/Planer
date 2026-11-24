import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {resolve,join} from 'node:path';
const {localURL,serverOrigin,assetPath,externalURL}=createRequire(import.meta.url)('../desktop/security.cjs');
test('remote server requires explicit HTTPS origin',()=>{
 assert.equal(serverOrigin(' https://planner.example.com/ '),'https://planner.example.com');
 for(const u of ['http://planner.example.com','file:///etc/passwd','javascript:alert(1)','https://user:pass@planner.example.com','https://planner.example.com/login','https://planner.example.com/?token=secret'])assert.throws(()=>serverOrigin(u));
});
test('native bridge and asset paths stay in the local app',()=>{
 assert.equal(localURL('planner://app/'),true);assert.equal(localURL('https://app/'),false);assert.equal(localURL('planner://evil/'),false);assert.equal(localURL('planner://app.evil/'),false);
 const root=resolve('bundle','ui');
 assert.equal(assetPath(root,'planner://app/'),join(root,'index.html'));assert.equal(assetPath(root,'planner://app/assets/app.js'),join(root,'assets','app.js'));
 assert.equal(assetPath(root,'planner://app/%2e%2e%2fsecret'),null);assert.equal(assetPath(root,'planner://app/%00secret'),null);assert.equal(assetPath(root,'https://evil/'),null);
 for(const u of ['file:///etc/passwd','javascript:alert(1)','data:text/html,test'])assert.equal(externalURL(u),false);
});
