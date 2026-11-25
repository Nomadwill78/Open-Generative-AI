import Link from 'next/link';
import {currentCustomer,supabaseRequest} from '../../lib/commerce/auth-server';
import {register,login,logout,createProject} from './actions';
export const dynamic='force-dynamic';
export const metadata={title:'Account | Nomad Creative Studio'};
const field='w-full rounded border border-white/25 bg-[#202124] p-3';
const button='rounded bg-[#D4AF37] px-5 py-3 font-semibold text-black';
export default async function Account({searchParams}){
 const notice=(await searchParams)?.notice;
 const customer=await currentCustomer();
 let projects=[],balance=null,failed=false;
 if(customer){
  try{
   const id=encodeURIComponent(customer.user.id);
   const [p,w]=await Promise.all([
    supabaseRequest('/rest/v1/nomad_projects?select=id,title,studio&user_id=eq.'+id+'&order=created_at.desc&limit=100',{token:customer.token}),
    supabaseRequest('/rest/v1/nomad_wallets?select=available&user_id=eq.'+id,{token:customer.token})
   ]);
   projects=p;balance=w[0]?.available??0;
  }catch{failed=true;}
 }
 return <main className="min-h-screen bg-[#101113] px-6 py-12 text-white">
 <div className="mx-auto max-w-4xl space-y-6">
 <p className="tracking-widest text-[#D4AF37]">NOMAD CREATIVE STUDIO</p>
 <h1 className="text-3xl font-bold">{customer?'Your creative workspace':'Customer account'}</h1>
 <p className="text-white/70">Protected test environment. Purchases and managed generation are disabled.</p>
 {notice==='registration'&&<p role="status">If registration is available, check your email for verification before signing in.</p>}
 {notice==='login'&&<p role="alert">Unable to sign in. Verify your email and credentials, or try again later.</p>}
 {notice==='project'&&<p role="alert">Unable to create project. Check the title and try again.</p>}
 {!customer?<form className="max-w-md space-y-4">
 <label className="block">Email<input className={field} name="email" type="email" required maxLength={254} autoComplete="email"/></label>
 <label className="block">Password (12 characters minimum)<input className={field} name="password" type="password" required minLength={12} maxLength={128} autoComplete="current-password"/></label>
 <div className="flex flex-wrap gap-3"><button className={button} formAction={login}>Sign in</button><button className={button} formAction={register}>Register</button></div>
 </form>:<>
 <p>{customer.user.email}</p><form action={logout}><button className="underline">Sign out</button></form>
 <section className="rounded-xl border border-white/20 p-6"><h2>Available credits</h2><p className="text-4xl text-[#D4AF37]">{balance===null?'Unavailable':String(balance)}</p><Link href="/commerce" className="underline">View proposed credit packs</Link></section>
 {failed?<p role="alert">Account data unavailable. Try again later.</p>:<section className="space-y-4"><h2 className="text-xl font-bold">Projects</h2>
 <form action={createProject} className="space-y-3"><label className="block">Project title<input name="title" className={field} required maxLength={160}/></label>
 <label className="block">Studio<select name="studio" className={field}>{['image','video','cinema','audio','marketing','lipsync'].map(s=><option key={s}>{s}</option>)}</select></label><button className={button}>Create project</button></form>
 {projects.length===0?<p>No projects yet.</p>:<ul>{projects.map(p=><li key={p.id} className="border-b border-white/15 py-3">{p.title} ({p.studio})</li>)}</ul>}</section>}
 </>}
 </div></main>;
}
