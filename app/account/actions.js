'use server';
import { redirect } from 'next/navigation';
import {supabaseRequest,currentCustomer,saveAccessToken,clearAccessToken} from '../../lib/commerce/auth-server';
function credentials(form){
 const email=String(form.get('email')||'').trim();
 const password=String(form.get('password')||'');
 if(email.length>254||!email.includes('@')||password.length<12||password.length>128)throw new Error('Invalid credentials');
 return {email,password};
}
export async function register(form){
 try{await supabaseRequest('/auth/v1/signup',{method:'POST',body:credentials(form)});}
 catch{redirect('/account?notice=registration');}
 redirect('/account?notice=registration');
}
export async function login(form){
 try{
  const session=await supabaseRequest('/auth/v1/token?grant_type=password',{method:'POST',body:credentials(form)});
  const user=await supabaseRequest('/auth/v1/user',{token:session.access_token});
  if(!user?.id||user.is_anonymous||!user.email_confirmed_at)throw new Error('Unverified user');
  await saveAccessToken(session);
 }catch{redirect('/account?notice=login');}
 redirect('/account');
}
export async function logout(){
 const customer=await currentCustomer();
 if(customer){try{await supabaseRequest('/auth/v1/logout?scope=local',{token:customer.token,method:'POST'});}catch{}}
 await clearAccessToken();
 redirect('/account');
}
export async function createProject(form){
 const customer=await currentCustomer();
 if(!customer)redirect('/account?notice=login');
 const title=String(form.get('title')||'').trim();
 const studio=String(form.get('studio')||'');
 if(!title||title.length>160||!['image','video','cinema','audio','marketing','lipsync'].includes(studio))redirect('/account?notice=project');
 try{await supabaseRequest('/rest/v1/nomad_projects',{token:customer.token,method:'POST',body:{user_id:customer.user.id,title,studio}});}
 catch{redirect('/account?notice=project');}
 redirect('/account');
}
