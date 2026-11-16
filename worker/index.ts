import handler from 'vinext/server/fetch-handler';
import {pollTelegram} from '../lib/telegram';
export default {fetch(request:Request,env:Cloudflare.Env,ctx:ExecutionContext){return handler.fetch(request,env,ctx);},scheduled(_event:ScheduledController,_env:Cloudflare.Env,ctx:ExecutionContext){ctx.waitUntil((async()=>{for(let i=0;i<10;i++){const result=await pollTelegram('system');if(!result.processed)break;}})());}};
