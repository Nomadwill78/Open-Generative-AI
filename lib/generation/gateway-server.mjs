import {prepareMockGeneration} from './mock-contract.mjs';

// Strictly the branch-scoped isolated Supabase test project; no privileged Vercel key.
export function mockGatewayEnabled(){
 return process.env.NOMAD_MOCK_GENERATION_ENABLED==='true'
  && process.env.VERCEL_ENV==='preview'
  && process.env.NOMAD_MOCK_DATABASE_REF==='srybidmpvzgddjvcxugz'
  && Boolean(process.env.NOMAD_SUPABASE_URL&&process.env.NOMAD_SUPABASE_PUBLISHABLE_KEY);
}
function configuration(){
 if(!mockGatewayEnabled())throw new Error('Mock generation gateway disabled');
 const parsed=new URL(process.env.NOMAD_SUPABASE_URL);
 if(parsed.protocol!=='https:'||
    parsed.hostname!=='srybidmpvzgddjvcxugz.supabase.co'||
    parsed.pathname!=='/'||parsed.username||parsed.password||parsed.search||parsed.hash)
   throw new Error('Isolated mock database origin mismatch');
 const key=process.env.NOMAD_SUPABASE_PUBLISHABLE_KEY;
 if(typeof key!=='string'||!key||key.startsWith('sb_secret_'))
   throw new Error('Invalid public client configuration');
 return {url:parsed.origin,key};
}
export async function runMockGeneration(accessToken,input){
 if(typeof accessToken!=='string'||accessToken.length<20||
    accessToken.length>5000)throw new Error('Invalid authenticated session');
 const prepared=prepareMockGeneration(input);
 const {url,key}=configuration();
 const response=await fetch(url+'/functions/v1/nomad-mock-generation',{
  method:'POST',
  headers:{'Content-Type':'application/json',apikey:key,Authorization:'Bearer '+accessToken},
  body:JSON.stringify({
   requestKey:prepared.requestKey,modelId:prepared.modelId,
   prompt:input.prompt,projectId:prepared.projectId,
   simulateFailure:prepared.simulateFailure
  }),
  redirect:'error',cache:'no-store',signal:AbortSignal.timeout(20000)
 });
 if(!response.ok){
  if(response.status===429)throw new Error('Mock request rate or concurrency limit reached');
  if(response.status===402)throw new Error('Insufficient sandbox credits');
  if(response.status===409)throw new Error('Request ID already used');
  if(response.status===401||response.status===403)throw new Error('Customer session rejected');
  throw new Error('Isolated mock generation unavailable');
 }
 const result=await response.json();
 if(!result||!['succeeded','failed','reserved'].includes(result.status)||
    typeof result.available!=='number'||result.available<0)
   throw new Error('Invalid mock gateway response');
 return result;
}
