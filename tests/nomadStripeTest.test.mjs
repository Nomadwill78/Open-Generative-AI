import test from 'node:test';
import assert from 'node:assert/strict';
import {createHmac} from 'node:crypto';
import {verifyStripeSignature,validateTestSession,checkoutForm} from '../lib/commerce/stripe-test.mjs';
const secret='whsec_fixture';const now=1700000000;const raw=Buffer.from('{"id":"evt_fixture"}');
const sig=(t,b=raw)=>'t='+t+',v1='+createHmac('sha256',secret).update(t+'.').update(b).digest('hex');
test('signature requires exact bytes and recent timestamp',()=>{
 assert.equal(verifyStripeSignature(raw,sig(now),secret,now),true);
 assert.equal(verifyStripeSignature(Buffer.from('tampered'),sig(now),secret,now),false);
 assert.equal(verifyStripeSignature(raw,sig(now-301),secret,now),false);
 assert.equal(verifyStripeSignature(raw,sig(now+301),secret,now),false);
 assert.equal(verifyStripeSignature(raw,'t='+now+',v1=wrong',secret,now),false);
});
const user='00000000-0000-4000-8000-000000000001';
const session={id:'cs_test_fixture',livemode:false,mode:'payment',status:'complete',client_reference_id:user,metadata:{product:'nomad-creative-studio',user_id:user,pack_id:'starter'},amount_total:2900,currency:'usd',payment_status:'paid'};
test('rejects live, wrong price, unpaid, mismatched customer or session',()=>{
 assert.equal(validateTestSession(session,session.id).pack.credits,2900);
 for(const patch of [{livemode:true},{amount_total:1},{payment_status:'unpaid'},{client_reference_id:'other'},{mode:'subscription'}])assert.throws(()=>validateTestSession({...session,...patch},session.id));
 assert.throws(()=>validateTestSession(session,'cs_test_other'));
});
test('checkout uses fixed catalog and return origin',()=>{
 const f=checkoutForm('starter',{id:user},'https://example.com');
 assert.equal(f.get('line_items[0][price_data][unit_amount]'),'2900');
 assert.equal(f.get('metadata[user_id]'),user);
 assert.throws(()=>checkoutForm('unknown',{id:user},'https://example.com'));
 assert.throws(()=>checkoutForm('starter',{id:user},'http://example.com'));
});
