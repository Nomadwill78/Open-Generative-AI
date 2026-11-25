import {verifyStripeSignature,validateTestSession,stripeTestRequest,testCheckoutEnabled} from '../../../../../lib/commerce/stripe-test.mjs';
export const runtime='nodejs';
export const dynamic='force-dynamic';
const response=(status)=>new Response(null,{status,headers:{'Cache-Control':'no-store'}});
export async function POST(request){
 if(!testCheckoutEnabled())return response(503);
 const reader=request.body?.getReader();
 if(!reader)return response(400);
 let raw;
 try{
  const chunks=[];let size=0;
  while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>256000){await reader.cancel();return response(413);}chunks.push(Buffer.from(value));}
  raw=Buffer.concat(chunks);
 }catch{return response(400);}
 if(!verifyStripeSignature(raw,request.headers.get('stripe-signature'),process.env.NOMAD_STRIPE_WEBHOOK_SECRET))return response(400);
 let event;
 try{event=JSON.parse(raw.toString('utf8'));}catch{return response(400);}
 if(event.livemode!==false)return response(400);
 if(!['checkout.session.completed','checkout.session.async_payment_succeeded'].includes(event.type))return response(204);
 const id=event.data?.object?.id;
 if(!/^evt_[A-Za-z0-9]+$/.test(event.id||'')||!/^cs_test_[A-Za-z0-9]+$/.test(id||''))return response(400);
 try{
 const session=await stripeTestRequest('/checkout/sessions/'+encodeURIComponent(id));
 if(session.metadata?.product!=='nomad-creative-studio')return response(204);
 if(session.payment_status!=='paid')return response(204);
 const {user,pack,sessionId}=validateTestSession(session,id);
 const origin=new URL(process.env.NOMAD_SUPABASE_URL);
 if(origin.protocol!=='https:'||!origin.hostname.endsWith('.supabase.co')||origin.origin!==process.env.NOMAD_SUPABASE_URL)throw new Error('Invalid database URL');
 const key=process.env.NOMAD_SUPABASE_SERVICE_ROLE_KEY;
 if(!key||key.startsWith('sb_publishable_'))throw new Error('Invalid privileged key');
 const headers={apikey:key,'Content-Type':'application/json'};
 if(!key.startsWith('sb_secret_'))headers.Authorization='Bearer '+key;
 const result=await fetch(origin.origin+'/rest/v1/rpc/nomad_fulfill_test_purchase',{method:'POST',headers,body:JSON.stringify({p_event:event.id,p_session:sessionId,p_user:user,p_pack:pack.id,p_amount:pack.cents,p_currency:'usd'}),cache:'no-store',redirect:'error',signal:AbortSignal.timeout(12000)});
 if(!result.ok)throw new Error('Fulfillment failed');
 return response(204);
 }catch{return response(500);}
}
