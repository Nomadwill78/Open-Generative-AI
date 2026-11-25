import {createHmac,timingSafeEqual} from 'node:crypto';
import {CREDIT_PACKS,validatePaidPack} from './pricing.mjs';
export function verifyStripeSignature(raw,header,secret,now=Math.floor(Date.now()/1000)){
 if(!Buffer.isBuffer(raw)||typeof header!=='string'||header.length>8192||typeof secret!=='string'||!secret.startsWith('whsec_'))return false;
 const fields=header.split(',').map(part=>part.trim().split('='));
 const stamps=fields.filter(([k])=>k==='t');
 if(stamps.length!==1||!/^\d{1,12}$/.test(stamps[0][1]||''))return false;
 const stamp=stamps[0][1];
 if(Math.abs(now-Number(stamp))>300)return false;
 const expected=createHmac('sha256',secret).update(stamp+'.').update(raw).digest();
 return fields.filter(([k,v])=>k==='v1'&&/^[a-f0-9]{64}$/i.test(v||'')).some(([,v])=>timingSafeEqual(expected,Buffer.from(v,'hex')));
}
export function validateTestSession(session,eventSessionId){
 if(!session||session.id!==eventSessionId||!/^cs_test_[A-Za-z0-9]+$/.test(session.id)||session.livemode!==false||session.mode!=='payment'||session.status!=='complete'||session.metadata?.product!=='nomad-creative-studio')throw new Error('Invalid test checkout');
 const user=session.metadata?.user_id;
 if(typeof user!=='string'||! /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(user)||session.client_reference_id!==user)throw new Error('Invalid customer binding');
 const pack=validatePaidPack({packId:session.metadata.pack_id,amountTotal:session.amount_total,currency:session.currency,paymentStatus:session.payment_status});
 return {user,pack,sessionId:session.id};
}
export function testCheckoutEnabled(){
 return process.env.NOMAD_STRIPE_TEST_ENABLED==='true'&&/^(sk|rk)_test_/.test(process.env.NOMAD_STRIPE_TEST_KEY||'')&&(process.env.NOMAD_STRIPE_WEBHOOK_SECRET||'').startsWith('whsec_')&&Boolean(process.env.NOMAD_CHECKOUT_ORIGIN&&process.env.NOMAD_SUPABASE_URL&&process.env.NOMAD_SUPABASE_SERVICE_ROLE_KEY);
}
export async function stripeTestRequest(path,{form,idempotencyKey}={}){
 if(!testCheckoutEnabled())throw new Error('Test checkout disabled');
 const headers={Authorization:'Bearer '+process.env.NOMAD_STRIPE_TEST_KEY};
 if(form)headers['Content-Type']='application/x-www-form-urlencoded';
 if(idempotencyKey)headers['Idempotency-Key']=idempotencyKey;
 const r=await fetch('https://api.stripe.com/v1'+path,{method:form?'POST':'GET',headers,body:form,cache:'no-store',redirect:'error',signal:AbortSignal.timeout(15000)});
 if(!r.ok)throw new Error('Stripe test request failed');
 return r.json();
}
export function checkoutForm(packId,user,origin){
 const pack=CREDIT_PACKS.find(p=>p.id===packId);
 if(!pack)throw new Error('Unknown pack');
 const base=new URL(origin);
 if(base.protocol!=='https:'||base.origin!==origin||base.username||base.password)throw new Error('Invalid checkout origin');
 return new URLSearchParams({
 mode:'payment','payment_method_types[0]':'card',
 'line_items[0][price_data][currency]':'usd',
 'line_items[0][price_data][unit_amount]':String(pack.cents),
 'line_items[0][price_data][product_data][name]':'Nomad Creative Studio '+pack.id+' test credits',
 'line_items[0][quantity]':'1',
 'adaptive_pricing[enabled]':'false',
 client_reference_id:user.id,
 'metadata[product]':'nomad-creative-studio','metadata[user_id]':user.id,'metadata[pack_id]':pack.id,
 success_url:origin+'/account?notice=payment-pending',cancel_url:origin+'/commerce'
 });
}
