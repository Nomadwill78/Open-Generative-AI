// Research-backed pricing proposal, November 25, 2026.
// READ-ONLY. This catalog cannot initiate a provider request or debit credits.
// Synthetic welcome credits and mock-generation prices are completely separate.
export const CUSTOMER_USD_PER_CREDIT=0.01;
export const REAL_PROVIDER_USAGE_ENABLED=false;
const price=(id,provider,model,category,label,credits,supplierListUsd,unit,source)=>Object.freeze({
 id,provider,model,category,label,credits,supplierListUsd,unit,source,
 retailUsd:Number((credits*CUSTOMER_USD_PER_CREDIT).toFixed(2)),
 approvedForBilling:false
});
export const REAL_PROVIDER_PRICE_PROPOSALS=Object.freeze([
 price('image-gemini-lite-1k','Google','gemini-3.1-flash-lite-image','image','Standard image, 1K',25,0.0336,'1 image at 1024px','https://ai.google.dev/gemini-api/docs/pricing'),
 price('image-gemini-flash-1k','Google','gemini-3.1-flash-image','image','Enhanced image, 1K',45,0.067,'1 image at 1024px','https://ai.google.dev/gemini-api/docs/pricing'),
 price('image-gemini-flash-2k','Google','gemini-3.1-flash-image','image','Enhanced image, 2K',65,0.101,'1 image at 2048px','https://ai.google.dev/gemini-api/docs/pricing'),
 price('image-gemini-flash-4k','Google','gemini-3.1-flash-image','image','Enhanced image, 4K',100,0.151,'1 image at 4096px','https://ai.google.dev/gemini-api/docs/pricing'),
 price('video-fal-h3-turbo-5s','fal','minimax/h3-max-turbo/text-to-video','video','Budget video, 5 seconds',50,0.075,'5 seconds, listed fal rate','https://fal.ai/pricing'),
 price('video-fal-h3-turbo-10s','fal','minimax/h3-max-turbo/text-to-video','video','Budget video, 10 seconds',100,0.15,'10 seconds, listed fal rate','https://fal.ai/pricing'),
 price('video-runway-turbo-5s','Runway','gen4_turbo','video','Studio video, 5 seconds',150,0.25,'5 seconds','https://dev.runwayml.com/pricing'),
 price('video-runway-turbo-10s','Runway','gen4_turbo','video','Studio video, 10 seconds',300,0.50,'10 seconds','https://dev.runwayml.com/pricing'),
 price('video-runway-premium-5s','Runway','gen4.5','video','Premium video, 5 seconds',400,0.60,'5 seconds','https://dev.runwayml.com/pricing'),
 price('video-runway-premium-10s','Runway','gen4.5','video','Premium video, 10 seconds',800,1.20,'10 seconds','https://dev.runwayml.com/pricing'),
 price('video-runway-kling-audio-5s','Runway','kling3.0_pro','video','Premium video + audio, 5 seconds',550,0.85,'5 seconds with audio','https://dev.runwayml.com/pricing')
]);
export function quoteProviderProposal(id){
 const p=REAL_PROVIDER_PRICE_PROPOSALS.find(x=>x.id===id);
 if(!p)throw new Error('Unknown or unapproved provider tier');
 if(p.credits*CUSTOMER_USD_PER_CREDIT < p.supplierListUsd*6)
  throw new Error('Proposed retail credits below 6x supplier baseline');
 return p;
}
