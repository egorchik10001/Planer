import { env } from 'cloudflare:workers';
import { getPlannerContext } from '../../auth';
export const dynamic='force-dynamic';
export async function GET(request:Request){const u=await getPlannerContext(request);if(!u)return Response.json({error:'Войдите в аккаунт.'},{status:401});return Response.json({voice:!!env.OPENAI_API_KEY,telegram:!u.spaceId&&!!env.TELEGRAM_BOT_TOKEN,backgroundReminders:false},{headers:{'Cache-Control':'no-store'}});}
