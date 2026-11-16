import { getPlannerContext } from '../../auth';
import { snapshot,applyMutation } from '../../../lib/store';
import {listMembers} from '../../../lib/spaces';
import { mutationSchema } from '../../../lib/validation';
export const dynamic='force-dynamic';
const json=(value:unknown,status=200)=>Response.json(value,{status,headers:{'Cache-Control':'no-store'}});
export async function GET(request:Request){const u=await getPlannerContext(request);if(!u)return json({error:'Войдите в аккаунт.'},401);try{return json({entities:await snapshot(u.userId),members:u.spaceId?await listMembers(u.spaceId):[]});}catch{return json({error:'Не удалось загрузить план. Повторите подключение.'},503);}}
export async function POST(request:Request){const u=await getPlannerContext(request);if(!u)return json({error:'Войдите в аккаунт.'},401);if(request.headers.get('origin')&&request.headers.get('origin')!==new URL(request.url).origin)return json({error:'Неверный источник запроса.'},403);
 try{const body:any=await request.json();if(!Array.isArray(body.operations)||body.operations.length>100)return json({error:'Некорректный набор изменений.'},400);const accepted:string[]=[],conflicts:unknown[]=[],rejected:unknown[]=[];
  for(const raw of body.operations){const parsed=mutationSchema.safeParse(raw);if(!parsed.success)return json({error:'Некорректная запись в очереди изменений.'},400);const op=parsed.data;try{const r=await applyMutation(u.userId,op);if(r.accepted)accepted.push(op.opId);else conflicts.push(r.conflict);}catch(e){rejected.push({opId:op.opId,id:op.id,error:e instanceof Error&&!e.message.startsWith('[')?e.message:'Проверьте поля дела и сохраните ещё раз.'});}}
  return json({accepted,conflicts,rejected,entities:await snapshot(u.userId),members:u.spaceId?await listMembers(u.spaceId):[]});
 }catch{return json({error:'Не удалось обработать изменения. Очередь остаётся на устройстве.'},503);}
}
