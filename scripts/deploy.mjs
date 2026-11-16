import {readFileSync} from 'node:fs';
import {dirname} from 'node:path';
import {spawnSync} from 'node:child_process';
const config=JSON.parse(readFileSync(new URL('../wrangler.jsonc',import.meta.url),'utf8'));
if(config.d1_databases?.some(d=>d.database_id==='00000000-0000-4000-8000-000000000000')){
 process.stderr.write('Deployment is not configured. First create D1 in your Cloudflare account and set its database_id in wrangler.jsonc. No remote changes were made.\n');process.exit(1);
}
const node=process.execPath;
function run(args){const r=spawnSync(node,args,{stdio:'inherit',env:{...process.env,PATH:dirname(node)+':'+process.env.PATH}});if(r.error)throw r.error;if(r.status!==0)process.exit(r.status||1);}
run(['node_modules/typescript/bin/tsc','--noEmit']);
run(['node_modules/vinext/dist/cli.js','build']);
run(['node_modules/wrangler/bin/wrangler.js','d1','migrations','apply','DB','--remote','--config','wrangler.jsonc']);
run(['node_modules/wrangler/bin/wrangler.js','deploy','--config','dist/server/wrangler.json']);
