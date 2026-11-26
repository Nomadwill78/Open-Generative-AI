import Link from 'next/link';
import {REAL_PROVIDER_PRICE_PROPOSALS,REAL_PROVIDER_USAGE_ENABLED} from '../../lib/generation/provider-credit-proposals.mjs';
export const metadata={title:'Provider Credit Pricing Review | Nomad Creative Studio'};
export default function ProviderPricing(){
 const categories=[['image','Image generation'],['video','Video generation']];
 return <main className="min-h-screen bg-[#101113] px-6 py-12 text-white">
  <div className="mx-auto max-w-6xl space-y-8">
   <p className="tracking-widest text-[#D4AF37]">NOMAD CREATIVE STUDIO</p>
   <h1 className="text-3xl font-semibold">Provider credit pricing review</h1>
   <div role="status" className="rounded border border-yellow-600/70 p-4">
     These are November 25, 2026 pricing proposals, <strong>not approved for billing or enabled.</strong>
     Real AI generation is {REAL_PROVIDER_USAGE_ENABLED?'enabled':'disabled'}. No paid provider is connected.
   </div>
   <p className="text-white/70">For pricing comparisons only: one customer credit is valued at $0.01 from the draft credit packs. Supplier prices are public list estimates, not quotes for your account. Individual image prompt inputs, video resolution, retries, storage, delivery, tax and payment processing can change actual cost.</p>
   {categories.map(([category,title])=><section key={category} className="space-y-3">
     <h2 className="text-2xl font-semibold">{title}</h2>
     <div className="overflow-x-auto rounded border border-white/20"><table className="w-full text-left text-sm">
       <thead className="border-b border-white/20 text-[#D4AF37]"><tr><th className="p-3">Provider / output</th><th className="p-3">Nomad credits</th><th className="p-3">Customer value</th><th className="p-3">Supplier baseline</th><th className="p-3">Terms</th></tr></thead>
       <tbody>{REAL_PROVIDER_PRICE_PROPOSALS.filter(p=>p.category===category).map(p=><tr key={p.id} className="border-b border-white/10">
         <td className="p-3"><strong>{p.provider}</strong><p className="text-white/60">{p.label}</p></td>
         <td className="p-3">{p.credits}</td>
         <td className="p-3">${p.retailUsd.toFixed(2)}</td>
         <td className="p-3">${p.supplierListUsd.toFixed(4)}</td>
         <td className="p-3"><a className="underline" href={p.source} target="_blank" rel="noreferrer">Source</a></td>
       </tr>)}</tbody>
     </table></div>
   </section>)}
   <p className="text-white/70">These prices preserve at least a 6:1 customer-revenue to listed-supplier-cost ratio before operating costs. Supplier billing must be re-quoted and independently capped before a paid pilot. Approval of a credit price does not authorize any provider spend.</p>
   <Link href="/mock-studio" className="inline-block underline text-[#D4AF37]">Back to mock lab</Link>
  </div>
 </main>;
}
