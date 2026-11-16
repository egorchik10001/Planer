import {getUser,getPlannerContext} from './auth';
import {listSpaces} from '../lib/spaces';
import {redirect} from 'next/navigation';
import Planner from './Planner';
export const dynamic='force-dynamic';
export default async function Home({searchParams}:{searchParams:Promise<{space?:string;user?:string}>}){const user=await getUser();if(!user)redirect('/login');const {space,user:expectedUser}=await searchParams;if(expectedUser&&expectedUser!==user.userId)redirect('/login');const context=await getPlannerContext(new Request('https://planner.local/'+(space?'?space='+encodeURIComponent(space):'')));if(!context)redirect('/');const spaces=await listSpaces(user.userId);return <Planner owner={user.userId+':'+context.userId} email={user.email} spaceId={space||null} spaces={spaces as any} currentUserId={user.userId}/>;}
