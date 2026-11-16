import {compare} from './matcher.js';
import {compareStructure} from './structure.js';
self.onmessage=({data})=>{try{const result=compare(data.reference,data.drawing);
if(data.motion)result.structure=compareStructure(data.motion,data.strokes,data.reference,data.drawing,result.params);
self.postMessage({result});}catch(e){self.postMessage({error:e.message});}};
