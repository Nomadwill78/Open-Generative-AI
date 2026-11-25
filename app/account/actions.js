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

export async function reconcileTestPayment(form){
 const customer=await currentCustomer();
 if(!customer)redirect('/account?notice=login');
 const id=String(form.get('session_id')||'');
 if(id.length>200||!/^cs_test_[A-Za-z0-9]+$/.test(id))redirect('/account?notice=payment-error');
 try{
 const {stripeTestRequest,validateTestSession}=await import('../../lib/commerce/stripe-test.mjs');
 const session=await stripeTestRequest('/checkout/sessions/'+encodeURIComponent(id));
 const {user,pack,sessionId}=validateTestSession(session,id);
 if(user!==customer.user.id)throw new Error('Wrong owner');
 const origin=new URL(process.env.NOMAD_SUPABASE_URL);
 if(origin.protocol!=='https:'||!origin.hostname.endsWith('.supabase.co')||origin.origin!==process.env.NOMAD_SUPABASE_URL)throw new Error('Invalid database URL');
 const key=process.env.NOMAD_SUPABASE_SERVICE_ROLE_KEY;
 if(!key||key.startsWith('sb_publishable_'))throw new Error('Invalid privileged key');
 const headers={apikey:key,'Content-Type':'application/json'};
 if(!key.startsWith('sb_secret_'))headers.Authorization='Bearer '+key;
 const result=await fetch(origin.origin+'/rest/v1/rpc/nomad_fulfill_test_purchase',{method:'POST',headers,body:JSON.stringify({p_event:null,p_session:sessionId,p_user:user,p_pack:pack.id,p_amount:pack.cents,p_currency:'usd'}),cache:'no-store',redirect:'error',signal:AbortSignal.timeout(12000)});
 if(!result.ok)throw new Error('Reconciliation failed');
 }catch{redirect('/account?notice=payment-error');}
 redirect('/account?notice=payment-confirmed');
}
