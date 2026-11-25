import {prepareMockGeneration} from './mock-contract.mjs';
import {generateLocalMock} from './mock-provider.mjs';

export function mockGatewayEnabled(){
 return process.env.NOMAD_MOCK_GENERATION_ENABLED==='true'
  && process.env.NOMAD_STRIPE_TEST_ENABLED==='true'
  && process.env.VERCEL_ENV!=='production'
  && Boolean(process.env.NOMAD_SUPABASE_URL&&process.env.NOMAD_SUPABASE_SERVICE_ROLE_KEY);
}
function configuration(){
 if(!mockGatewayEnabled())throw new Error('Mock generation gateway disabled');
 const url=new URL(process.env.NOMAD_SUPABASE_URL);
 if(url.protocol!=='https:'||!url.hostname.endsWith('.supabase.co')||
   url.pathname!=='/'||url.username||url.password||url.search||url.hash)
   throw new Error('Invalid database configuration');
 const key=process.env.NOMAD_SUPABASE_SERVICE_ROLE_KEY;
 if(!key||key.startsWith('sb_publishable_'))throw new Error('Invalid privileged credentials');
 return {url:url.origin,key};
}
export async function mockRpc(name,payload){
 if(!['nomad_reserve_mock_generation','nomad_settle_mock_generation',
       'nomad_recover_stale_mock_generations'].includes(name))
   throw new Error('Unknown generation operation');
 const {url,key}=configuration();
 const headers={apikey:key,'Content-Type':'application/json'};
 if(!key.startsWith('sb_secret_'))headers.Authorization='Bearer '+key;
 const response=await fetch(url+'/rest/v1/rpc/'+name,{
  method:'POST',headers,body:JSON.stringify(payload),
  redirect:'error',cache:'no-store',signal:AbortSignal.timeout(12000)
 });
 if(!response.ok)throw new Error('Secure generation operation failed');
 return response.json();
}
export async function runMockGeneration(userId,input){
 if(typeof userId!=='string'||!UUID_USER.test(userId))throw new Error('Invalid authenticated user');
 const request=prepareMockGeneration(input);
 await mockRpc('nomad_recover_stale_mock_generations',{p_user:userId});
 const reserved=await mockRpc('nomad_reserve_mock_generation',{
   p_user:userId,p_request:request.requestKey,p_model:request.modelId,
   p_prompt_hash:request.promptHash,p_project:request.projectId
 });
 if(!reserved||typeof reserved!=='object'||!['reserved','succeeded','failed'].includes(reserved.status))
   throw new Error('Invalid reservation response');
 if(reserved.status!=='reserved')return reserved;
 let artifact;
 try{
  artifact=await generateLocalMock(request);
 }catch{
  return mockRpc('nomad_settle_mock_generation',{
    p_user:userId,p_request:request.requestKey,p_succeeded:false,p_output:null
  });
 }
 // A mock settlement is idempotent even if the original response is lost.
 return mockRpc('nomad_settle_mock_generation',{
   p_user:userId,p_request:request.requestKey,p_succeeded:true,p_output:artifact
 });
}
const UUID_USER=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
