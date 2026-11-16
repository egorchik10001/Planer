import {env} from 'cloudflare:workers';
import {snapshot} from './store';
import {transcribeWithKey,interpretWithKey} from './assistant-core';
export async function transcribe(file:File){return transcribeWithKey(file,env.OPENAI_API_KEY||'',env.PLANNER_AUDIO_MODEL);}
export async function interpret(owner:string,text:string,image?:string,asOf?:Date){return interpretWithKey(await snapshot(owner),text,image,asOf,env.OPENAI_API_KEY||'',env.PLANNER_AI_MODEL);}
