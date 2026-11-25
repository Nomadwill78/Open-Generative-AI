import Link from 'next/link';
import {randomUUID} from 'node:crypto';
import {currentCustomer,supabaseRequest} from '../../lib/commerce/auth-server';
import {mockGatewayEnabled} from '../../lib/generation/gateway-server.mjs';
import {MOCK_MODELS} from '../../lib/generation/mock-contract.mjs';
import {generateMock} from './actions';
export const dynamic='force-dynamic';
export const metadata={title:'Mock Generation | Nomad Creative Studio'};
const field='w-full rounded border border-white/25 bg-[#202124] p-3';
const button='rounded bg-[#D4AF37] px-5 py-3 font-semibold text-black disabled:opacity-50';
export default async function MockStudio({searchParams}){
 const notice=(await searchParams)?.notice;
 const customer=await currentCustomer();
 const enabled=mockGatewayEnabled();
 let jobs=[],balance=null,projects=[],unavailable=false;
 if(customer){
  try{
   const id=encodeURIComponent(customer.user.id);
   const [j,w,p]=await Promise.all([
    supabaseRequest('/rest/v1/nomad_generation_jobs?select=id,model_id,status,reserved_credits,output_json,created_at&user_id=eq.'+id+'&order=created_at.desc&limit=20',{token:customer.token}),
    supabaseRequest('/rest/v1/nomad_wallets?select=available&user_id=eq.'+id,{token:customer.token}),
    supabaseRequest('/rest/v1/nomad_projects?select=id,title&user_id=eq.'+id+'&order=created_at.desc&limit=30',{token:customer.token})
   ]);
   jobs=j;balance=w?.[0]?.available??0;projects=p;
  }catch{unavailable=true;}
 }
 return <main className="min-h-screen bg-[#101113] px-6 py-12 text-white">
  <div className="mx-auto max-w-4xl space-y-8">
   <p className="tracking-widest text-[#D4AF37]">NOMAD CREATIVE STUDIO</p>
   <h1 className="text-3xl font-bold">Mock Generation Lab</h1>
   <p className="text-white/70">Sandbox only. No real image, video, or paid provider is invoked. Credits are synthetic test credits.</p>
   <p className="text-white/70">A verified sandbox account receives 500 synthetic credits after email confirmation. Refresh your page to see your balance. These credits cannot be used for real AI services.</p>
   <nav className="flex gap-5"><Link href="/account" className="underline">Account</Link><Link href="/commerce" className="underline">Test credit packs</Link></nav>
   {!enabled&&<p role="alert" className="rounded border border-yellow-600/60 p-4">Mock generation is disabled until this development branch has been approved and configured in a separate preview environment.</p>}
   {notice==='succeeded'&&<p role="status">Mock generation succeeded and reserved credits were settled.</p>}
   {notice==='failed'&&<p role="status">Simulated failure. Reserved credits were released.</p>}
   {notice==='error'&&<p role="alert">Generation could not be completed. No paid provider was contacted. Check your credits or try again.</p>}
   {notice==='disabled'&&<p role="alert">The isolated mock gateway is not enabled.</p>}
   {!customer?<p><Link href="/account" className="underline">Sign in to continue.</Link></p>:<>
    <div className="rounded-xl border border-white/20 p-5">
      <p className="text-white/70">Available sandbox credits</p>
      <p className="text-3xl text-[#D4AF37]">{balance===null?'Unavailable':balance.toLocaleString('en-US')}</p>
    </div>
    <form action={generateMock} className="space-y-4 rounded-xl border border-white/20 p-5">
      <h2 className="text-xl font-semibold">New simulated generation</h2>
      <input type="hidden" name="request_key" value={randomUUID()}/>
      <label className="block">Model
        <select name="model" className={field}>{MOCK_MODELS.map(m=><option value={m.id} key={m.id}>{m.label} | {m.credits} test credits</option>)}</select>
      </label>
      <label className="block">Prompt (not sent to any external provider)
        <textarea name="prompt" className={field} rows={4} minLength={5} maxLength={500} required placeholder="Describe a sample image or video"/>
      </label>
      <label className="block">Project (optional)
        <select name="project" className={field}><option value="">No project</option>{projects.map(p=><option key={p.id} value={p.id}>{p.title}</option>)}</select>
      </label>
      <label className="flex gap-2 items-center"><input type="checkbox" name="simulate_failure"/> Simulate provider failure and automatic refund</label>
      <button disabled={!enabled||unavailable} className={button}>Run local mock</button>
    </form>
    {unavailable?<p role="alert">The development database is not configured for this page.</p>:
    <section className="space-y-3">
      <h2 className="text-xl font-semibold">Recent mock jobs</h2>
      {jobs.filter(j=>j.model_id?.startsWith('mock-')).length===0?<p>No mock jobs yet.</p>:
      <ul className="space-y-3">{jobs.filter(j=>j.model_id?.startsWith('mock-')).map(j=><li key={j.id} className="rounded border border-white/20 p-4">
        <p className="font-semibold">{j.model_id} · {j.status}</p>
        <p className="text-white/70">{j.reserved_credits} test credits · {new Date(j.created_at).toLocaleString('en-US')}</p>
        {j.output_json?.message&&<p className="text-[#D4AF37]">{j.output_json.message}</p>}
      </li>)}</ul>}
    </section>}
   </>}
  </div>
 </main>;
}
