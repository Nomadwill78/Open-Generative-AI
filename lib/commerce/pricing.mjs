// Candidate pricing only; no provider rates are assumed or live checkout enabled.
export const CREDIT_PACKS = Object.freeze([
  Object.freeze({id:'starter',cents:2900,credits:2900}),
  Object.freeze({id:'professional',cents:7900,credits:7900}),
  Object.freeze({id:'agency',cents:19900,credits:19900})
]);
export function quoteGeneration({providerCostCents,overheadCents=0,marginBps=6000}) {
  for (const n of [providerCostCents,overheadCents,marginBps]) {
    if (!Number.isSafeInteger(n) || n<0) throw new TypeError('Expected nonnegative integer');
  }
  if (providerCostCents===0 || marginBps>=10000 || providerCostCents+overheadCents>100000000)
    throw new RangeError('Invalid cost or margin');
  // One credit represents one US cent of candidate retail price.
  const cost=BigInt(providerCostCents)+BigInt(overheadCents);
  const denominator=BigInt(10000-marginBps);
  const credits=Number((cost*10000n+denominator-1n)/denominator);
  if (credits>1000000000) throw new RangeError('Quote exceeds limit');
  return {credits,estimatedCostCents:Number(cost)};
}
export function validatePaidPack({packId,amountTotal,currency,paymentStatus}) {
  const pack=CREDIT_PACKS.find(p=>p.id===packId);
  if (!pack || amountTotal!==pack.cents || currency!=='usd' || paymentStatus!=='paid')
    throw new Error('Payment does not match catalog');
  return pack;
}
