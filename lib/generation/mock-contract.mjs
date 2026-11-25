import {createHash} from 'node:crypto';

// Test-only prices. These are not estimates of external provider costs.
export const MOCK_MODELS=Object.freeze([
 Object.freeze({id:'mock-image-v1',label:'Mock image',kind:'mock-image',credits:25}),
 Object.freeze({id:'mock-video-v1',label:'Mock video',kind:'mock-video',credits:100})
]);
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export function prepareMockGeneration({requestKey,modelId,prompt,projectId=null,simulateFailure=false}){
 if(typeof requestKey!=='string'||!UUID.test(requestKey))throw new Error('Invalid request identifier');
 const model=MOCK_MODELS.find(m=>m.id===modelId);
 if(!model)throw new Error('Only local mock models are available');
 if(typeof prompt!=='string')throw new Error('Prompt must be text');
 const description=prompt.trim();
 if(description.length<5||description.length>500||Buffer.byteLength(description,'utf8')>1800)
  throw new Error('Prompt length must be 5 to 500 characters');
 if(projectId==='')projectId=null;
 if(projectId!==null&&(typeof projectId!=='string'||!UUID.test(projectId)))
  throw new Error('Invalid project identifier');
 if(typeof simulateFailure!=='boolean')throw new Error('Invalid failure simulation flag');
 const promptHash=createHash('sha256')
   .update(JSON.stringify([model.id,description,projectId,simulateFailure]))
   .digest('hex');
 return Object.freeze({requestKey,modelId:model.id,promptHash,projectId,simulateFailure,kind:model.kind,credits:model.credits});
}
