import { getPlannerContext } from '../../auth';
import { interpret,transcribe } from '../../../lib/assistant';
export const dynamic='force-dynamic';
export async function POST(request:Request){const user=await getPlannerContext(request);if(!user)return Response.json({error:'Войдите в аккаунт.'},{status:401});if(request.headers.get('origin')&&request.headers.get('origin')!==new URL(request.url).origin)return new Response(null,{status:403});try{let text='',image:string|undefined,capturedAt:unknown;
  if(request.headers.get('content-type')?.includes('multipart/form-data')){const data=await request.formData(),file=data.get('audio');if(!(file instanceof File))throw new Error('Запись не найдена.');capturedAt=data.get('capturedAt');text=await transcribe(file);}else{const data:any=await request.json();text=typeof data.text==='string'?data.text:'';capturedAt=data.capturedAt;image=typeof data.image==='string'&&/^data:image\/(png|jpeg|webp);base64,/.test(data.image)&&data.image.length<8*1024*1024?data.image:undefined;}
  const timestamp=typeof capturedAt==='string'?Date.parse(capturedAt):NaN;
  if(capturedAt&&(!Number.isFinite(timestamp)||timestamp>Date.now()+60000))throw new Error('Не удалось определить дату записи.');
  if(!text.trim()&&!image)throw new Error('Расскажите, что нужно сделать.');return Response.json({result:await interpret(user.userId,text,image,Number.isFinite(timestamp)?new Date(timestamp):undefined),sourceText:text},{headers:{'Cache-Control':'no-store'}});
}catch(e){return Response.json({error:e instanceof Error?e.message:'Не удалось разобрать сообщение.'},{status:422});}}
