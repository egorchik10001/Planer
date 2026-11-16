import SignIn from './SignIn';
import {getUser} from '../auth';
import {redirect} from 'next/navigation';
export const dynamic='force-dynamic';
export default async function Login({searchParams}:{searchParams:Promise<{next?:string}>}){const {next}=await searchParams;const to=next&&/^\/join\/[a-f0-9]{64}$/.test(next)?next:'/';if(await getUser())redirect(to);return <SignIn next={to}/>;}
