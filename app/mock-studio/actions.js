'use server';
import {redirect} from 'next/navigation';
import {randomUUID} from 'node:crypto';
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
  outcome=await runMockGeneration(customer.token,{
   requestKey,modelId,prompt,projectId,simulateFailure
  });
 }catch(error){
  if(error instanceof Error&&/rate or concurrency limit/.test(error.message))redirect('/mock-studio?notice=limited');
  redirect('/mock-studio?notice=error');
 }
 if(!outcome?.id||!['succeeded','failed','reserved'].includes(outcome.status))
  redirect('/mock-studio?notice=error');
 redirect('/mock-studio?notice='+encodeURIComponent(outcome.status));
}

/**
 * Runs the real signed-in Preview request path 6 times with unique mock image IDs.
 * The database should permit 5 reservations in one UTC minute and reject #6.
 * Only synthetic credits are deducted (5 x 25 = 125) on a clean test window.
 * This can only be invoked from an authenticated browser form on the mock Preview.
 */
export async function runSignedInRateLimitCheck(){
 if(!mockGatewayEnabled())redirect('/mock-studio?notice=disabled');
 const customer=await currentCustomer();
 if(!customer)redirect('/account?notice=login');
 // Five calls typically complete in a few seconds. Don't straddle a fixed minute bucket.
 const now=new Date();
 if(now.getUTCSeconds()>=35)redirect('/mock-studio?notice=rate_check_window');
 let passed=0,limited=0,other=0;
 for(let i=0;i<6;i++){
  try{
   const res=await runMockGeneration(customer.token,{
    requestKey:randomUUID(),
    modelId:'mock-image-v1',
    prompt:'Authenticated sandbox rate-limit acceptance check, local mock only',
    projectId:null,
    simulateFailure:false
   });
   if(res.status==='succeeded')passed++;
   else other++;
  }catch(error){
   if(error instanceof Error&&/rate or concurrency limit/.test(error.message))limited++;
   else other++;
  }
 }
 if(passed===5&&limited===1&&other===0)
  redirect('/mock-studio?notice=rate_check_pass');
 redirect('/mock-studio?notice=rate_check_partial&passed='+passed+'&limited='+limited);
}
