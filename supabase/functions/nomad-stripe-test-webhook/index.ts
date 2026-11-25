// Public HTTP receiver; no authentication tokens are accepted from the caller.
// Every Stripe event is verified against the secret in Supabase Vault by a restricted RPC.
const reply=(status)=>new Response(null,{status,headers:{'Cache-Control':'no-store'}});
Deno.serve(async (request)=>{
 if(request.method!=='POST')return reply(405);
 const signature=request.headers.get('stripe-signature');
 if(!signature||signature.length>8192)return reply(400);
 const length=Number(request.headers.get('content-length')||'0');
 if(length>256000)return reply(413);
 let raw;
 try{raw=await request.text();}catch{return reply(400);}
 if(new TextEncoder().encode(raw).byteLength>256000)return reply(413);
 const base=Deno.env.get('SUPABASE_URL');
 const key=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')||Deno.env.get('SUPABASE_SECRET_KEY');
 if(!base||!key)return reply(503);
 const headers={'Content-Type':'application/json',apikey:key};
 if(!key.startsWith('sb_secret_'))headers.Authorization='Bearer '+key;
 try{
  const result=await fetch(base+'/rest/v1/rpc/nomad_accept_signed_test_webhook',{
   method:'POST',headers,body:JSON.stringify({p_payload:raw,p_signature:signature}),
   signal:AbortSignal.timeout(12000),redirect:'error'
  });
  if(result.ok)return reply(204);
  // A rejected signature or unsigned session is invalid; otherwise enable Stripe retries.
  const err=await result.json().catch(()=>({}));
  if(err.code==='P0001'&&/signature|envelope|Live events|Invalid paid test checkout|Multiple timestamps/.test(err.message||''))return reply(400);
  return reply(503);
 }catch{return reply(503);}
});