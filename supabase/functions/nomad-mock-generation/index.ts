// Nomad Creative Studio Sprint 3: dedicated, authenticated zero-cost mock gateway.
// Deploy ONLY to project srybidmpvzgddjvcxugz. Never wire real supplier credentials.
const PROJECT_REF='srybidmpvzgddjvcxugz';
const USER_ID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const REQUEST_ID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MODELS={'mock-image-v1':{kind:'mock-image',credits:25},
              'mock-video-v1':{kind:'mock-video',credits:100}};
const respond=(status,data)=>new Response(JSON.stringify(data),{
 status,headers:{'Content-Type':'application/json','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}
});
async function sha256(text){
 const input=new TextEncoder().encode(text);
 const output=await crypto.subtle.digest('SHA-256',input);
 return [...new Uint8Array(output)].map(n=>n.toString(16).padStart(2,'0')).join('');
}
function prepare(value){
 if(!value||typeof value!=='object'||Array.isArray(value))throw new Error('Invalid request');
 const {requestKey,modelId,prompt}=value;
 const model=typeof modelId==='string'?MODELS[modelId]:null;
 if(!model)throw new Error('Unrecognized mock model');
 if(typeof requestKey!=='string'||!REQUEST_ID.test(requestKey))throw new Error('Invalid request ID');
 if(typeof prompt!=='string')throw new Error('Prompt must be text');
 const description=prompt.trim();
 if(description.length<5||description.length>500||
    new TextEncoder().encode(description).byteLength>1800)throw new Error('Prompt length invalid');
 const projectId=value.projectId===''?null:value.projectId??null;
 if(projectId!==null&&(typeof projectId!=='string'||!USER_ID.test(projectId)))
   throw new Error('Invalid project');
 const simulateFailure=value.simulateFailure===undefined?false:value.simulateFailure;
 if(typeof simulateFailure!=='boolean')throw new Error('Invalid simulation');
 return {requestKey,modelId,description,projectId,simulateFailure,model};
}
Deno.serve(async request=>{
 if(request.method!=='POST')return respond(405,{error:'POST required'});
 const url=Deno.env.get('SUPABASE_URL');
 const anon=Deno.env.get('SUPABASE_ANON_KEY');
 const service=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
 if(!url||!anon||!service||new URL(url).hostname!==PROJECT_REF+'.supabase.co')
   return respond(503,{error:'Isolated mock service not configured'});
 const authorization=request.headers.get('authorization')||'';
 if(!/^Bearer [A-Za-z0-9._-]+$/.test(authorization))
   return respond(401,{error:'Authenticated session required'});
 // Always verify the user session with Auth. Never accept a user ID from the request.
 let user;
 try{
   const r=await fetch(url+'/auth/v1/user',{
     headers:{apikey:anon,Authorization:authorization},
     signal:AbortSignal.timeout(10000),redirect:'error'
   });
   if(!r.ok)return respond(401,{error:'Invalid session'});
   user=await r.json();
 }catch{return respond(503,{error:'Authentication unavailable'});}
 if(!user?.id||!USER_ID.test(user.id)||user.is_anonymous||
    !user.email_confirmed_at)return respond(403,{error:'Verified account required'});
 let payload;
 try{
  const size=Number(request.headers.get('content-length')||'0');
  if(size>8000)return respond(413,{error:'Request too large'});
  const raw=await request.text();
  if(new TextEncoder().encode(raw).byteLength>8000)
    return respond(413,{error:'Request too large'});
  payload=prepare(JSON.parse(raw));
 }catch{return respond(400,{error:'Invalid mock generation request'});}
 const userId=user.id;
 const headers={apikey:service,'Content-Type':'application/json'};
 if(!service.startsWith('sb_secret_'))headers.Authorization='Bearer '+service;
 async function rpc(name,args){
  if(!['nomad_seed_sandbox_wallet','nomad_recover_stale_mock_generations',
    'nomad_reserve_mock_generation','nomad_settle_mock_generation'].includes(name))
    throw new Error('Invalid operation');
  const r=await fetch(url+'/rest/v1/rpc/'+name,{
    method:'POST',headers,body:JSON.stringify(args),redirect:'error',
    signal:AbortSignal.timeout(10000)
  });
  if(!r.ok){
    const e=await r.json().catch(()=>({}));
    if(/Insufficient credits/i.test(e.message||''))throw new Error('insufficient_credits');
    if(/Idempotency conflict/i.test(e.message||''))throw new Error('idempotency_conflict');
    if(/Project does not belong/i.test(e.message||''))throw new Error('invalid_project');
    throw new Error('database_operation_rejected');
  }
  return r.json();
 }
 try{
  const hash=await sha256(JSON.stringify([
    payload.modelId,payload.description,payload.projectId,payload.simulateFailure
  ]));
  await rpc('nomad_seed_sandbox_wallet',{p_user:userId});
  await rpc('nomad_recover_stale_mock_generations',{p_user:userId});
  const job=await rpc('nomad_reserve_mock_generation',{
    p_user:userId,p_request:payload.requestKey,p_model:payload.modelId,
    p_prompt_hash:hash,p_project:payload.projectId
  });
  if(!job||!['reserved','succeeded','failed'].includes(job.status))
    throw new Error('invalid_database_response');
  if(job.status!=='reserved')return respond(200,job);
  if(payload.simulateFailure){
    const refunded=await rpc('nomad_settle_mock_generation',{
      p_user:userId,p_request:payload.requestKey,p_succeeded:false,p_output:null
    });
    return respond(200,refunded);
  }
  // No network, model SDKs, files, or supplier usage. Pure deterministic fixture.
  const fingerprint=(await sha256(payload.requestKey+':'+hash+':local-mock')).slice(0,24);
  const output={
    provider:'local-mock',kind:payload.model.kind,
    artifact_id:'mock-'+fingerprint,
    message:payload.model.kind==='mock-image'
     ?'Simulated image request only. No image was generated.'
     :'Simulated video request only. No video was generated.'
  };
  const settled=await rpc('nomad_settle_mock_generation',{
    p_user:userId,p_request:payload.requestKey,p_succeeded:true,p_output:output
  });
  return respond(200,settled);
 }catch(e){
  const code=e instanceof Error?e.message:'unknown';
  if(code==='insufficient_credits')return respond(402,{error:'Insufficient test credits'});
  if(code==='idempotency_conflict')return respond(409,{error:'Request ID already used'});
  if(code==='invalid_project')return respond(403,{error:'Invalid project ownership'});
  return respond(503,{error:'Mock generation temporarily unavailable'});
 }
});
