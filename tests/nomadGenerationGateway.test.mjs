import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {MOCK_MODELS,prepareMockGeneration} from '../lib/generation/mock-contract.mjs';
import {generateLocalMock} from '../lib/generation/mock-provider.mjs';
import {mockGatewayEnabled,runMockGeneration,mockRpc} from '../lib/generation/gateway-server.mjs';

const sample=()=>({requestKey:randomUUID(),modelId:'mock-image-v1',prompt:'A sample studio portrait',projectId:null,simulateFailure:false});
test('Only fixed-price local mock models are offered',()=>{
 assert.deepEqual(MOCK_MODELS.map(m=>[m.id,m.credits]),[['mock-image-v1',25],['mock-video-v1',100]]);
 assert.equal(MOCK_MODELS.every(m=>m.id.startsWith('mock-')),true);
 assert.throws(()=>prepareMockGeneration({...sample(),modelId:'provider-paid-model'}),/mock/);
 assert.throws(()=>prepareMockGeneration({...sample(),prompt:'hi'}),/length/);
 assert.throws(()=>prepareMockGeneration({...sample(),projectId:'other-user'}),/project/);
 assert.throws(()=>prepareMockGeneration({...sample(),requestKey:'not-a-uuid'}),/identifier/);
});
test('Request fingerprint binds model, prompt, project and failure flag',()=>{
 const base=sample();
 const same=prepareMockGeneration(base);
 assert.equal(same.promptHash,prepareMockGeneration(base).promptHash);
 for(const patch of [
  {prompt:'a different sample portrait'},
  {modelId:'mock-video-v1'},
  {projectId:randomUUID()},
  {simulateFailure:true}
 ])assert.notEqual(prepareMockGeneration({...base,...patch}).promptHash,same.promptHash);
 assert.equal(same.promptHash.length,64);
});
test('Mock provider is deterministic, has no external artifact URL and can fail safely',async()=>{
 const request=prepareMockGeneration(sample());
 const a=await generateLocalMock(request),b=await generateLocalMock(request);
 assert.deepEqual(a,b);
 assert.equal(a.provider,'local-mock');
 assert.equal(a.kind,'mock-image');
 assert.match(a.message,/No image was generated/);
 assert.equal(Object.hasOwn(a,'url'),false);
 await assert.rejects(generateLocalMock({...request,simulateFailure:true}),/Simulated/);
});
test('Gateway is opt-in and cannot be enabled for production',()=>{
 const backup={...process.env};
 try{
  process.env.NOMAD_MOCK_GENERATION_ENABLED='true';
  process.env.NOMAD_STRIPE_TEST_ENABLED='true';
  process.env.NOMAD_SUPABASE_URL='https://fixture.supabase.co';
  process.env.NOMAD_SUPABASE_SERVICE_ROLE_KEY='sb_secret_test_fixture';
  process.env.VERCEL_ENV='production';
  assert.equal(mockGatewayEnabled(),false);
  process.env.VERCEL_ENV='preview';
  assert.equal(mockGatewayEnabled(),true);
  process.env.NOMAD_MOCK_GENERATION_ENABLED='false';
  assert.equal(mockGatewayEnabled(),false);
 }finally{for(const k of ['NOMAD_MOCK_GENERATION_ENABLED','NOMAD_STRIPE_TEST_ENABLED','NOMAD_SUPABASE_URL','NOMAD_SUPABASE_SERVICE_ROLE_KEY','VERCEL_ENV']){if(Object.hasOwn(backup,k))process.env[k]=backup[k];else delete process.env[k];}}
});
test('Server gateway reserves, settles and refunds mock credits without calling paid providers',async()=>{
 const originalFetch=globalThis.fetch;
 const original={};
 for(const k of ['NOMAD_MOCK_GENERATION_ENABLED','NOMAD_STRIPE_TEST_ENABLED','NOMAD_SUPABASE_URL','NOMAD_SUPABASE_SERVICE_ROLE_KEY','VERCEL_ENV']){
  original[k]=process.env[k];
 }
 Object.assign(process.env,{
  NOMAD_MOCK_GENERATION_ENABLED:'true',NOMAD_STRIPE_TEST_ENABLED:'true',
  NOMAD_SUPABASE_URL:'https://fixture.supabase.co',
  NOMAD_SUPABASE_SERVICE_ROLE_KEY:'sb_secret_fixture',
  VERCEL_ENV:'preview'
 });
 const calls=[],jobs=new Map();let available=500;
 globalThis.fetch=async(url,{body,method,headers})=>{
  assert.match(url,/^https:\/\/fixture\.supabase\.co\/rest\/v1\/rpc\/nomad_/);
  assert.equal(method,'POST');
  assert.equal(headers.apikey,'sb_secret_fixture');
  assert.equal(headers.Authorization,undefined);
  const op=url.split('/').at(-1);
  const p=JSON.parse(body);calls.push({op,...p});
  let data;
  if(op==='nomad_recover_stale_mock_generations')data=0;
  else if(op==='nomad_reserve_mock_generation'){
   let job=jobs.get(p.p_request);
   if(!job){
    const cost=p.p_model==='mock-image-v1'?25:100;
    assert.ok(available>=cost);
    available-=cost;
    job={id:randomUUID(),status:'reserved',credits:cost,available,output:null,hash:p.p_prompt_hash};
    jobs.set(p.p_request,job);
   }else assert.equal(job.hash,p.p_prompt_hash);
   data={...job,available};
  }else if(op==='nomad_settle_mock_generation'){
   const job=jobs.get(p.p_request);
   assert.ok(job);
   if(job.status==='reserved'){
    if(p.p_succeeded){job.status='succeeded';job.output=p.p_output;}
    else {job.status='failed';available+=job.credits;}
   }
   data={...job,available};
  }else throw new Error('Unrecognized RPC');
  return {ok:true,json:async()=>data};
 };
 try{
  const user=randomUUID();
  const first=sample();
  let result=await runMockGeneration(user,first);
  assert.equal(result.status,'succeeded');
  assert.equal(result.available,475);
  assert.equal(result.output.provider,'local-mock');
  result=await runMockGeneration(user,first);
  assert.equal(result.status,'succeeded');
  assert.equal(result.available,475);
  assert.equal(calls.filter(c=>c.op==='nomad_settle_mock_generation').length,1);
  const second={...sample(),modelId:'mock-video-v1',simulateFailure:true};
  result=await runMockGeneration(user,second);
  assert.equal(result.status,'failed');
  assert.equal(result.available,475);
  assert.equal(calls.filter(c=>c.op==='nomad_settle_mock_generation'&&c.p_succeeded===false).length,1);
  assert.equal(calls.filter(c=>c.op==='nomad_reserve_mock_generation').length,3);
  assert.equal(calls.every(c=>c.p_user===user),true);
  await assert.rejects(mockRpc('arbitrary_rpc',{}),/Unknown/);
  const networkCalls=calls.length;
  await assert.rejects(runMockGeneration(user,{...sample(),modelId:'expensive-paid-model'}),/mock/);
  assert.equal(calls.length,networkCalls);
 }finally{
  globalThis.fetch=originalFetch;
  for(const k of Object.keys(original)){if(original[k]===undefined)delete process.env[k];else process.env[k]=original[k];}
 }
});
