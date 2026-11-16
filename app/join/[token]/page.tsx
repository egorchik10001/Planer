import {getUser} from '../../auth';
import {invitation} from '../../../lib/spaces';
import Join from './Join';
export const dynamic='force-dynamic';
export default async function InvitePage({params}:{params:Promise<{token:string}>}){const {token}=await params,invite=await invitation(token),user=await getUser();return <main className="invite-page"><a className="auth-wordmark" href="/">планер</a>{invite?<><h1>Вместе в «{invite.name}»</h1><p>В этом пространстве участники видят и редактируют общие задачи и проекты. Твой личный план остаётся в «Личном».</p>{user?<Join token={token} userId={user.userId}/>:<a className="button primary" href={'/login?next='+encodeURIComponent('/join/'+token)}>Войти или создать аккаунт</a>}</>:<><h1>Ссылка больше не действует</h1><p>Попроси владельца пространства создать новое приглашение.</p><a className="button secondary" href="/">К своему плану</a></>}</main>;}
