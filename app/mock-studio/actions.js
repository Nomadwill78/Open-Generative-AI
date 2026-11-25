'use server';
import {randomUUID} from 'node:crypto';
import {redirect} from 'next/navigation';
import {currentCustomer} from '../../lib/commerce/auth-server';
import {runMockGeneration,mockGatewayEnabled} from '../../lib/generation/gateway-server.mjs';

export async function generateMock(form){
 if(!mockGatewayEnabled())redirect('/mock-studio?notice=disabled');
 const customer=await currentCustomer();
 if(!customer)redirect('/account?notice=login');
 const requestKey=String(form.get('request_key')||'');
 const modelId=String(form.get('model')||'');
 const prompt=String(form.get('prompt')||'');
 const projectId=String(form.get('project')||'')||null;
 const simulateFailure=form.get('simulate_failure')==='on';
 let outcome;
 try{
  outcome=await runMockGeneration(customer.user.id,{
   requestKey,modelId,prompt,projectId,simulateFailure
  });
 }catch{
  redirect('/mock-studio?notice=error');
 }
 if(!outcome?.id||!['succeeded','failed','reserved'].includes(outcome.status))
  redirect('/mock-studio?notice=error');
 redirect('/mock-studio?notice='+encodeURIComponent(outcome.status));
}
