import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {MOCK_MODELS,prepareMockGeneration} from '../lib/generation/mock-contract.mjs';
import {generateLocalMock} from '../lib/generation/mock-provider.mjs';
import {mockGatewayEnabled,runMockGeneration} from '../lib/generation/gateway-server.mjs';

const sample=()=>({requestKey:randomUUID(),modelId:'mock-image-v1',prompt:'A sample studio portrait',projectId:null,simulateFailure:false});
const configKeys=['NOMAD_MOCK_GENERATION_ENABLED','NOMAD_MOCK_DATABASE_REF','NOMAD_SUPABASE_URL','NOMAD_SUPABASE_PUBLISHABLE_KEY','VERCEL_ENV'];
function withEnv(entries,callback){
 const prior=Object.fromEntries(configKeys.map(k=>[k,process.env[k]]));
 Object.assign(process.env,entries);
 return Promise.resolve().then(callback).finally(()=>{
  for(const [key,value] of Object.entries(prior))
   if(value===undefined)delete process.env[key];else process.env[key]=value;
 });
}
const config={
 NOMAD_MOCK_GENERATION_ENABLED:'true',
 NOMAD_MOCK_DATABASE_REF:'srybidmpvzgddjvcxugz',
 NOMAD_SUPABASE_URL:'https://srybidmpvzgddjvcxugz.supabase.co',
 NOMAD_SUPABASE_PUBLISHABLE_KEY:'sb_publishable_test_fixture',
 VERCEL_ENV:'preview'
};
test('Only fixed-cost local mock models can be requested',()=>{
 assert.deepEqual(MOCK_MODELS.map(m=>[m.id,m.credits]),[['mock-image-v1',25],['mock-video-v1',100]]);
 assert.throws(()=>prepareMockGeneration({...sample(),modelId:'paid-provider'}),/mock/);
 assert.throws(()=>prepareMockGeneration({...sample(),prompt:'no'}),/length/);
 assert.throws(()=>prepareMockGeneration({...sample(),projectId:'other-account'}),/project/);
 assert.throws(()=>prepareMockGeneration({...sample(),requestKey:'not-a-uuid'}),/identifier/);
});
test('Request fingerprint binds model, prompt, project and failure flag',()=>{
 const base=sample();const initial=prepareMockGeneration(base);
 assert.equal(initial.promptHash,prepareMockGeneration(base).promptHash);
 for(const change of [
  {prompt:'A different portrait'}, {modelId:'mock-video-v1'},
  {projectId:randomUUID()}, {simulateFailure:true}
 ])assert.notEqual(prepareMockGeneration({...base,...change}).promptHash,initial.promptHash);
});
test('Local mock provider is deterministic, never sends media or paid API calls',async()=>{
 const request=prepareMockGeneration(sample());
 const a=await generateLocalMock(request);
 assert.deepEqual(a,await generateLocalMock(request));
 assert.equal(a.provider,'local-mock');assert.equal(a.kind,'mock-image');
 assert.match(a.message,/No image was generated/);
 assert.equal(Object.hasOwn(a,'url'),false);
 await assert.rejects(generateLocalMock({...request,simulateFailure:true}),/Simulated/);
});
test('Gateway requires isolated project, opt-in flag and Preview environment',async()=>{
 await withEnv(config,async()=>{
  assert.equal(mockGatewayEnabled(),true);
  process.env.VERCEL_ENV='production';
  assert.equal(mockGatewayEnabled(),false);
  process.env.VERCEL_ENV='preview';
  process.env.NOMAD_MOCK_DATABASE_REF='raqcqstsqphemgldkwbv';
  assert.equal(mockGatewayEnabled(),false);
  process.env.NOMAD_MOCK_DATABASE_REF='srybidmpvzgddjvcxugz';
  process.env.NOMAD_MOCK_GENERATION_ENABLED='false';
  assert.equal(mockGatewayEnabled(),false);
 });
});
test('Authenticated gateway forwards only a user JWT to isolated Edge, never privileged keys',async()=>{
 await withEnv(config,async()=>{
  const originalFetch=globalThis.fetch;const requests=[];
  const token='eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.mock.mock';
  globalThis.fetch=async(url,{method,headers,body,redirect,cache})=>{
   const data=JSON.parse(body);requests.push({url,method,headers,data,redirect,cache});
   assert.equal(url,'https://srybidmpvzgddjvcxugz.supabase.co/functions/v1/nomad-mock-generation');
   assert.equal(headers.Authorization,'Bearer '+token);
   assert.equal(headers.apikey,config.NOMAD_SUPABASE_PUBLISHABLE_KEY);
   assert.equal(headers['Content-Type'],'application/json');
   assert.equal(Object.hasOwn(data,'userId'),false);
   assert.equal(Object.hasOwn(data,'credits'),false);
   assert.equal(Object.hasOwn(data,'promptHash'),false);
   assert.equal(data.modelId,'mock-image-v1');
   return {ok:true,status:200,json:async()=>({id:randomUUID(),status:'succeeded',credits:25,available:475,output:{provider:'local-mock',kind:'mock-image'}})};
  };
  try{
   const result=await runMockGeneration(token,sample());
   assert.equal(result.status,'succeeded');
   assert.equal(result.available,475);
   assert.equal(requests.length,1);
   await assert.rejects(runMockGeneration(token,{...sample(),modelId:'paid-model'}),/mock/);
   assert.equal(requests.length,1);
   process.env.NOMAD_SUPABASE_URL='https://raqcqstsqphemgldkwbv.supabase.co';
   await assert.rejects(runMockGeneration(token,sample()),/origin mismatch/);
   assert.equal(requests.length,1);
  }finally{globalThis.fetch=originalFetch;}
 });
});
test('Edge handler verifies Auth and uses only local-mock models',()=>{
 const edge=readFileSync(new URL('../supabase/functions/nomad-mock-generation/index.ts',import.meta.url),'utf8');
 assert.match(edge,/auth\/v1\/user/);
 assert.match(edge,/email_confirmed_at/);
 assert.match(edge,/nomad_reserve_mock_generation/);
 assert.match(edge,/nomad_settle_mock_generation/);
 assert.match(edge,/nomad_seed_sandbox_wallet/);
 assert.match(edge,/PROJECT_REF='srybidmpvzgddjvcxugz'/);
 assert.doesNotMatch(edge,/api\.openai\.com|api\.runwayml\.com|api\.elevenlabs\.io|api\.suno\.com/);
});
