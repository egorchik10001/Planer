import {getUser} from '../../../auth';
import {getAuth} from '../../../../lib/auth';
export const dynamic='force-dynamic';
export async function GET(request:Request){return getAuth().handler(request);}
export async function POST(request:Request){if(new URL(request.url).pathname.endsWith('/sign-out')&&!await getUser(request))return new Response(null,{status:401});return getAuth().handler(request);}
