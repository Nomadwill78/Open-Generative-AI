import Link from 'next/link';
import { CREDIT_PACKS } from '../../lib/commerce/pricing.mjs';

export const metadata = {title:'Plans | Nomad Creative Studio'};
export default function CommercePreview() {
  return (
    <main className="min-h-screen bg-[#101113] text-white px-6 py-16">
      <div className="mx-auto max-w-5xl">
        <p className="text-sm font-semibold tracking-widest text-[#D4AF37]">NOMAD CREATIVE STUDIO</p>
        <h1 className="mt-5 text-4xl font-bold">Create with confidence.</h1>
        <p className="mt-4 max-w-2xl text-white/70">Explore our proposed prepaid credit packages for professional multimedia production. Pricing is provisional. Purchases and managed generation are not enabled.</p>
        <div className="mt-10 grid gap-5 md:grid-cols-3">
          {CREDIT_PACKS.map(pack=>(
            <section key={pack.id} className="rounded-xl border border-white/15 bg-[#1D1E21] p-6">
              <h2 className="text-xl font-semibold capitalize">{pack.id}</h2>
              <p className="mt-4 text-3xl font-bold text-[#D4AF37]">${(pack.cents/100).toFixed(0)}</p>
              <p className="mt-3">{pack.credits.toLocaleString('en-US')} proposed credits</p>
              <button disabled className="mt-6 w-full rounded-lg border border-white/20 p-3 text-white/60 cursor-not-allowed">Checkout not enabled</button>
            </section>
          ))}
        </div>
        <Link className="mt-10 inline-block underline text-[#D4AF37]" href="/studio">Return to private studio</Link>
      </div>
    </main>
  );
}
