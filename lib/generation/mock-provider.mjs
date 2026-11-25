import {createHash} from 'node:crypto';

// This module MUST NEVER call any external model, network service, or paid provider.
// It returns metadata only, clearly marked as a simulated artifact.
export async function generateLocalMock(prepared){
 if(!prepared||!['mock-image','mock-video'].includes(prepared.kind))
  throw new Error('Invalid mock provider request');
 if(prepared.simulateFailure)throw new Error('Simulated provider failure');
 const fingerprint=createHash('sha256')
  .update(prepared.requestKey+':'+prepared.promptHash+':local-mock')
  .digest('hex').slice(0,24);
 return Object.freeze({
  provider:'local-mock',
  kind:prepared.kind,
  artifact_id:'mock-'+fingerprint,
  message:prepared.kind==='mock-image'
   ?'Simulated image request only. No image was generated.'
   :'Simulated video request only. No video was generated.'
 });
}
