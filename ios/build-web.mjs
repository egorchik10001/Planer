import { build } from 'vite';
import {build as bundle} from 'esbuild';
import react from '@vitejs/plugin-react';
import {fileURLToPath} from 'node:url';
import {copyFileSync} from 'node:fs';

const path=value=>fileURLToPath(new URL(value,import.meta.url));
const output=path('./generated/web');
await build({
  configFile:false,
  root:path('./web'),
  publicDir:path('../public'),
  plugins:[react()],
  define:{'process.env.NODE_ENV':'"production"'},
  build:{outDir:output,emptyOutDir:true,target:'safari17'}
});
copyFileSync(path('../desktop/local-models.json'),path('./generated/local-models.json'));
copyFileSync(path('../THIRD-PARTY-NOTICES.txt'),path('./generated/web/THIRD-PARTY-NOTICES.txt'));

await bundle({entryPoints:[path('./web/device-bridge.ts')],outfile:path('./generated/device-bridge.js'),bundle:true,format:'iife',target:'safari17'});
