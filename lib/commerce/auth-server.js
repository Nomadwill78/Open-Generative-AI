import { cookies } from 'next/headers';
const cookieName='nomad_access';
function config(){
 const url=process.env.NOMAD_SUPABASE_URL;
 const key=process.env.NOMAD_SUPABASE_PUBLISHABLE_KEY;
 if(!url||!key) throw new Error('Account service is not configured');
 const parsed=new URL(url);
 if(parsed.protocol!=='https:'||!parsed.hostname.endsWith('.supabase.co')||parsed.pathname!=='/'||parsed.username||parsed.password||parsed.search||parsed.hash) throw new Error('Invalid account service configuration');
 return {url:parsed.origin,key};
}
export async function supabaseRequest(path,{token,method='GET',body}={}){
 const {url,key}=config();
 const headers={apikey:key,'Content-Type':'application/json'};
 if(token) headers.Authorization='Bearer '+token;
 const response=await fetch(url+path,{method,headers,body:body===undefined?undefined:JSON.stringify(body),cache:'no-store',redirect:'error',signal:AbortSignal.timeout(12000)});
 if(!response.ok) throw new Error('Account request rejected');
 const raw=await response.text();
 return raw ? JSON.parse(raw) : null;
}
export async function currentCustomer(){
 const token=(await cookies()).get(cookieName)?.value;
 if(!token)return null;
 try{
  const user=await supabaseRequest('/auth/v1/user',{token});
  if(!user?.id||user.is_anonymous||!user.email_confirmed_at)return null;
  return {user,token};
 }catch{return null;}
}
export async function saveAccessToken(session){
 if(typeof session?.access_token!=='string'||!Number.isFinite(session.expires_in)||session.expires_in<=0)throw new Error('Invalid session');
 (await cookies()).set(cookieName,session.access_token,{httpOnly:true,secure:process.env.NODE_ENV==='production',sameSite:'lax',path:'/',maxAge:Math.min(3600,Math.floor(session.expires_in))});
}
export async function clearAccessToken(){(await cookies()).delete(cookieName);}
