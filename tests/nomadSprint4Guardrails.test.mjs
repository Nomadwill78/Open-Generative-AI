import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {randomUUID} from 'node:crypto';
import {runMockGeneration} from '../lib/generation/gateway-server.mjs';
const read=(f)=>readFileSync(new URL(f,import.meta.url),'utf8');
const sql=read('../db/generation/sprint-04-guardrails.sql');
const edge=read('../supabase/functions/nomad-mock-generation/index.ts');

test('Database enforces per-account fixed rate buckets and concurrent job caps',()=>{
 assert.match(sql,/bucket='minute'.*requests/s);
 assert.match(sql,/requests from nomad_ops\.mock_rate_windows[\s\S]*?>=5/);
 assert.match(sql,/bucket='hour'[\s\S]*?>=30/);
 assert.match(sql,/bucket='day'[\s\S]*?>=100/);
 assert.match(sql,/status='reserved'[\s\S]*?\)\s*>=\s*2/);
 assert.match(sql,/status='reserved'[\s\S]*?\)\s*>=\s*20/);
 assert.match(sql,/pg_advisory_xact_lock\(604,4\)/);
 assert.match(sql,/return jsonb_build_object\('id',v_job\.id,'status',v_job\.status/);
});
test('Monitoring retains warnings privately and applies per-event idempotency',()=>{
 assert.match(sql,/create schema if not exists nomad_ops/);
 assert.match(sql,/alter table nomad_ops\.alerts enable row level security/);
 assert.match(sql,/unique\(user_id,request_key,kind\)/);
 assert.match(sql,/revoke all on function public\.nomad_mock_record_guardrail/);
 assert.match(sql,/mock_global_capacity|Mock global capacity exceeded/);
 assert.match(sql,/nomad_mock_scan_alerts/);
 assert.match(read('../db/generation/sprint-04-monitor-cron.sql'),/\*\/5 \* \* \* \*/);
});
test('Edge uses only authenticated mock provider and returns 429 on limits',()=>{
 assert.match(edge,/auth\/v1\/user/);
 assert.match(edge,/email_confirmed_at/);
 assert.match(edge,/PROJECT_REF='srybidmpvzgddjvcxugz'/);
 assert.match(edge,/nomad_mock_record_guardrail/);
 assert.match(edge,/status===429/);
 assert.match(edge,/Retry-After/);
 assert.doesNotMatch(edge,/api\.openai\.com|api\.runwayml\.com|generativelanguage\.googleapis\.com/);
});
test('Server forwards 429 as a limit error without new supplier requests',async()=>{
 const originalFetch=globalThis.fetch;
 const old=Object.fromEntries(['NOMAD_MOCK_GENERATION_ENABLED','NOMAD_MOCK_DATABASE_REF','NOMAD_SUPABASE_URL','NOMAD_SUPABASE_PUBLISHABLE_KEY','VERCEL_ENV'].map(k=>[k,process.env[k]]));
 Object.assign(process.env,{
  NOMAD_MOCK_GENERATION_ENABLED:'true',
  NOMAD_MOCK_DATABASE_REF:'srybidmpvzgddjvcxugz',
  NOMAD_SUPABASE_URL:'https://srybidmpvzgddjvcxugz.supabase.co',
  NOMAD_SUPABASE_PUBLISHABLE_KEY:'sb_publishable_fixture',
  VERCEL_ENV:'preview'
 });
 let called=0;
 globalThis.fetch=async()=>{called++;return {ok:false,status:429};};
 try{
  await assert.rejects(runMockGeneration('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.fixture.fixture',{
   requestKey:randomUUID(),modelId:'mock-image-v1',prompt:'A minimal product photo'
  }),/rate or concurrency limit/);
  assert.equal(called,1);
 }finally{
  globalThis.fetch=originalFetch;
  for(const [key,value] of Object.entries(old))if(value===undefined)delete process.env[key];else process.env[key]=value;
 }
});
