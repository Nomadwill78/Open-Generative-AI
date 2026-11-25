'use server';
import {randomUUID} from 'node:crypto';
import {redirect} from 'next/navigation';
import {currentCustomer} from '../../lib/commerce/auth-server';
import {checkoutForm,stripeTestRequest,testCheckoutEnabled} from '../../lib/commerce/stripe-test.mjs';
export async function checkout(form){
 if(!testCheckoutEnabled())redirect('/commerce?notice=disabled');
 const customer=await currentCustomer();
 if(!customer)redirect('/account?notice=login');
 let destination;
 try{
 const session=await stripeTestRequest('/checkout/sessions',{form:checkoutForm(String(form.get('pack')||''),customer.user,process.env.NOMAD_CHECKOUT_ORIGIN),idempotencyKey:randomUUID()});
 if(session.livemode!==false||!session.id?.startsWith('cs_test_'))throw new Error('Not test mode');
 const url=new URL(session.url);
 if(url.protocol!=='https:'||url.hostname!=='checkout.stripe.com'||url.username||url.password)throw new Error('Invalid checkout URL');
 destination=url.href;
 }catch{redirect('/commerce?notice=checkout-error');}
 redirect(destination);
}
