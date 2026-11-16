import {build} from 'vite';
import {buildNative} from './build-native.mjs';
import {buildLocalEngines} from './build-local-engines.mjs';
import {build as bundle} from 'esbuild';
import react from '@vitejs/plugin-react';
import {copyFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('..',import.meta.url));
await build({configFile:false,root:resolve(root,'desktop/renderer'),publicDir:resolve(root,'public'),plugins:[react()],define:{'process.env.NODE_ENV':'"production"'},build:{outDir:resolve(root,'desktop-dist/renderer'),emptyOutDir:true,sourcemap:false}});
await bundle({entryPoints:{'local-store':resolve(root,'desktop/local-store.ts'),'assistant':resolve(root,'desktop/assistant.ts'),'local-voice':resolve(root,'desktop/local-voice.ts'),'model-manager':resolve(root,'desktop/model-manager.ts')},outdir:resolve(root,'desktop-dist'),outExtension:{'.js':'.cjs'},bundle:true,platform:'node',target:'node22',format:'cjs'});

copyFileSync(resolve(root,'THIRD-PARTY-NOTICES.txt'),resolve(root,'desktop-dist/renderer/THIRD-PARTY-NOTICES.txt'));

await buildNative();

await buildLocalEngines();
