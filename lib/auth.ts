import {betterAuth} from 'better-auth/minimal';
import {drizzleAdapter} from '@better-auth/drizzle-adapter';
import {env} from 'cloudflare:workers';
import {getDb} from '../db';
import * as schema from '../db/schema';
export function getAuth(){
 if(!env.BETTER_AUTH_SECRET||!env.BETTER_AUTH_URL)throw new Error('Настройте адрес приложения и секрет аккаунтов перед запуском.');
 return betterAuth({secret:env.BETTER_AUTH_SECRET,baseURL:env.BETTER_AUTH_URL,database:drizzleAdapter(getDb(),{provider:'sqlite',schema,transaction:false}),emailAndPassword:{enabled:true,minPasswordLength:12,maxPasswordLength:128},session:{expiresIn:60*60*24*30,updateAge:60*60*24},rateLimit:{enabled:true,storage:'database',window:60,max:60,customRules:{'/sign-in/email':{window:60,max:10},'/sign-up/email':{window:60,max:5}}},advanced:{ipAddress:{ipAddressHeaders:['cf-connecting-ip']}}});
}
