import {CHARACTERS} from './matcher.js';
import {validMotion} from './motion-paths.js';
export const LABELS={unreviewed:'Not reviewed yet',acceptable:'Acceptable variation',recognizable:'Recognizable, poorly formed',wrong:'Wrong structure'};
const finite=n=>typeof n==='number'&&Number.isFinite(n);
export function validateSample(s){
 if(!s||typeof s.id!=='string'||s.id.length<1||s.id.length>128||!CHARACTERS.includes(s.char)||!Object.hasOwn(LABELS,s.label)||typeof s.notes!=='string'||s.notes.length>2000||![s.created,s.updated].every(t=>typeof t==='string'&&Number.isFinite(Date.parse(t))))return false;
 if(!s.canvas||![s.canvas.width,s.canvas.height].every(n=>finite(n)&&n>=1&&n<=100000)||!Array.isArray(s.strokes)||!s.strokes.length||s.strokes.length>100)return false;
 let count=0;for(const stroke of s.strokes){if(!Array.isArray(stroke)||!stroke.length)return false;count+=stroke.length;if(count>100000||!stroke.every(p=>Array.isArray(p)&&p.length===2&&p.every(n=>finite(n)&&Math.abs(n)<=1000000)))return false;}
 if(typeof s.visible!=='boolean'||!s.corrections||typeof s.corrections.rotation!=='boolean'||typeof s.corrections.skew!=='boolean'||!['mouse','touch','pen','unknown'].includes(s.input))return false;
 if(s.reference!==null&&!validMotion(s.reference))return false;
 if(s.result!==null&&(!s.result||!finite(s.result.score)||s.result.score<0||s.result.score>10))return false;
 return true;
}
export function parseDataset(data){
 if(data?.format!=='kurrent-training-dataset'||data.version!==1||!Array.isArray(data.samples)||data.samples.length>10000||!data.samples.every(validateSample))throw Error('Choose an unmodified Kurrent training dataset export.');
 return data.samples;
}
export function mergeSamples(existing,incoming){
 const map=new Map(existing.map(s=>[s.id,s]));let added=0,updated=0;
 for(const sample of incoming){const old=map.get(sample.id);if(!old){map.set(sample.id,structuredClone(sample));added++;}else if(Date.parse(sample.updated)>Date.parse(old.updated)){map.set(sample.id,structuredClone(sample));updated++;}}
 return {samples:[...map.values()],added,updated};
}
export function createDatasetStore(){
 const ready=new Promise((resolve,reject)=>{const request=indexedDB.open('kurrent-training-dataset',1);request.onupgradeneeded=()=>request.result.createObjectStore('samples',{keyPath:'id'});request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(Error('Training dataset storage is unavailable.'));});
 ready.catch(()=>{});
 async function all(){const db=await ready;return new Promise((resolve,reject)=>{const tx=db.transaction('samples','readonly'),r=tx.objectStore('samples').getAll();r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});}
 async function write(samples){const db=await ready;return new Promise((resolve,reject)=>{const tx=db.transaction('samples','readwrite');for(const s of samples)tx.objectStore('samples').put(s);tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error||Error('Could not save dataset.'));tx.onabort=()=>reject(tx.error||Error('Dataset storage is full or unavailable.'));});}
 let queue=Promise.resolve();
 function serial(fn){const result=queue.then(fn);queue=result.catch(()=>{});return result;}
 return {all,
  save(sample,{preserveReview=false}={}){return serial(async()=>{if(!validateSample(sample))throw Error('This drawing cannot be stored as a training sample.');const existing=(await all()).find(s=>s.id===sample.id);if(existing&&preserveReview)sample={...sample,label:existing.label,notes:existing.notes,created:existing.created};await write([sample]);return sample;});},
  merge(samples){return serial(async()=>{const existing=await all(),result=mergeSamples(existing,samples);await write(result.samples);return result;});}
 };
}
