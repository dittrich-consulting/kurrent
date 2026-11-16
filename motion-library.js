import {CHARACTERS} from './matcher.js';
import {validMotion} from './motion-paths.js';
import bundled from './confirmed-motions.js';
export function createMotionLibrary(){
 const key='kurrent-motions-v1';let library=structuredClone(bundled);
 try{const data=JSON.parse(localStorage.getItem(key)||'{}');for(const c of CHARACTERS)if(validMotion(data?.[c]))library[c]=data[c];}catch{}
 return {exportData:()=>structuredClone(library),validateData:data=>data===undefined||(data&&typeof data==='object'&&!Array.isArray(data)&&Object.entries(data).every(([c,e])=>CHARACTERS.includes(c)&&validMotion(e))),
 importData(data){if(!data)return;const next={...library};for(const[c,e]of Object.entries(data))if(!next[c]||e.updated>next[c].updated)next[c]=structuredClone(e);localStorage.setItem(key,JSON.stringify(next));library=next;}};
}
