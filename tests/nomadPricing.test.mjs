import test from 'node:test';
import assert from 'node:assert/strict';
import {quoteGeneration,validatePaidPack} from '../lib/commerce/pricing.mjs';
test('60% target contribution margin before unmodeled expenses',()=>{
  assert.deepEqual(quoteGeneration({providerCostCents:80,overheadCents:20}),{credits:250,estimatedCostCents:100});
});
test('rounds retail credits upward',()=>assert.equal(quoteGeneration({providerCostCents:1}).credits,3));
test('rejects missing, zero, fractional, excessive or invalid costs',()=>{
  for(const providerCostCents of [undefined,0,-1,1.2,Infinity,100000001])
    assert.throws(()=>quoteGeneration({providerCostCents}));
  assert.throws(()=>quoteGeneration({providerCostCents:10,marginBps:10000}));
});
test('validates paid pack against trusted catalog',()=>{
  const valid={packId:'starter',amountTotal:2900,currency:'usd',paymentStatus:'paid'};
  assert.equal(validatePaidPack(valid).credits,2900);
  for(const bad of [{amountTotal:1},{paymentStatus:'unpaid'},{currency:'eur'},{packId:'unknown'}])
    assert.throws(()=>validatePaidPack({...valid,...bad}));
});
