import test from 'node:test';
import assert from 'node:assert/strict';
import {REAL_PROVIDER_USAGE_ENABLED,CUSTOMER_USD_PER_CREDIT,
  REAL_PROVIDER_PRICE_PROPOSALS,quoteProviderProposal} from '../lib/generation/provider-credit-proposals.mjs';
test('Paid generation is hard-disabled and provider prices remain review-only',()=>{
 assert.equal(REAL_PROVIDER_USAGE_ENABLED,false);
 assert.equal(CUSTOMER_USD_PER_CREDIT,0.01);
 assert.ok(REAL_PROVIDER_PRICE_PROPOSALS.length>=9);
 for(const p of REAL_PROVIDER_PRICE_PROPOSALS){
  assert.equal(p.approvedForBilling,false);
  assert.ok(p.credits>0);
  assert.ok(p.credits*CUSTOMER_USD_PER_CREDIT+1e-9>=6*p.supplierListUsd,
    `Unprofitable baseline in ${p.id}`);
  assert.equal(quoteProviderProposal(p.id),p);
  assert.match(p.source,/^https:\/\//);
 }
 assert.throws(()=>quoteProviderProposal('free-anything'),/Unknown/);
});
test('Image and video tiers are distinct from synthetic mock models',()=>{
 assert.deepEqual(REAL_PROVIDER_PRICE_PROPOSALS.filter(x=>x.category==='image').map(x=>x.credits),[25,45,65,100]);
 assert.equal(quoteProviderProposal('video-fal-h3-turbo-5s').credits,50);
 assert.equal(quoteProviderProposal('video-runway-turbo-5s').credits,150);
 assert.equal(quoteProviderProposal('video-runway-premium-5s').credits,400);
 assert.equal(quoteProviderProposal('video-runway-kling-audio-5s').credits,550);
});
