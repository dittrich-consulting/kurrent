import {curveSegments} from './motion-curves.js';
const dist=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1]);
export function pointAlong(path,fraction){
 const lengths=path.slice(1).map((p,i)=>dist(p,path[i])),total=lengths.reduce((a,b)=>a+b,0);let remaining=total*fraction;
 for(let i=0;i<lengths.length;i++){if(remaining<=lengths[i]){const t=lengths[i]?remaining/lengths[i]:0;return path[i].map((v,k)=>v+(path[i+1][k]-v)*t);}remaining-=lengths[i];}return path.at(-1)?.slice();
}
export function projectToPath(point,path){
 let total=0,travelled=0,best={distance:Infinity,fraction:0};const lengths=path.slice(1).map((p,i)=>dist(p,path[i]));total=lengths.reduce((a,b)=>a+b,0);
 for(let i=0;i<lengths.length;i++){const a=path[i],b=path[i+1],dx=b[0]-a[0],dy=b[1]-a[1],t=Math.max(0,Math.min(1,((point[0]-a[0])*dx+(point[1]-a[1])*dy)/(dx*dx+dy*dy||1))),p=[a[0]+t*dx,a[1]+t*dy],d=dist(point,p);if(d<best.distance)best={distance:d,fraction:total?(travelled+t*lengths[i])/total:0,point:p};travelled+=lengths[i];}return best;
}
export function canAttach(links,source,target){
 if(source===target)return false;const seen=new Set(),queue=[target];for(const id of queue){if(id===source)return false;if(seen.has(id))continue;seen.add(id);for(const l of links)if(l.source===id)queue.push(l.target);}return true;
}
export function splitAttachmentSegment(links,target,from,to,inserted,split){
 return links.map(l=>{
  if(l.kind!=='segment'||l.target!==target||l.from!==from||l.to!==to)return l;
  return l.fraction<=split?{...l,to:inserted,fraction:split?l.fraction/split:0}:{...l,from:inserted,fraction:split<1?(l.fraction-split)/(1-split):1};
 });
}
// Sliding changes only the reference segment and its arc-length percentage.
// Exact point-to-point attachments stay pinned until explicitly unattached.
export function slideAttachment(link,position,guides,corners,strokeIds,pointIds){
 if(link.kind!=='segment')return link;
 const i=strokeIds.indexOf(link.target);if(i<0)return link;let best=null;
 curveSegments(guides[i],corners[i]).forEach((path,k)=>{const hit=projectToPath(position,path);if(!best||hit.distance<best.distance)best={...hit,index:k};});
 return best?{...link,from:pointIds[i][best.index],to:pointIds[i][best.index+1],fraction:best.fraction}:link;
}
// Persistent IDs keep relationships stable when strokes are reordered or points move.
export function resolveAttachments(guides,corners,strokeIds,pointIds,links){
 const result=structuredClone(guides),done=new Set(),active=new Set();
 function resolve(i){if(done.has(i))return;if(active.has(i))throw Error('Circular endpoint attachment');active.add(i);
  for(const l of links.filter(l=>l.source===strokeIds[i])){const target=strokeIds.indexOf(l.target);if(target<0)continue;resolve(target);let p;
   if(l.kind==='point'){const k=pointIds[target].indexOf(l.point);if(k>=0)p=result[target][k];}
   else{const k=pointIds[target].indexOf(l.from);if(k>=0&&pointIds[target][k+1]===l.to){const path=curveSegments(result[target],corners[target])[k];if(path)p=pointAlong(path,l.fraction);}}
   if(p&&result[i].length)result[i][l.end==='start'?0:result[i].length-1]=p.slice();
  }active.delete(i);done.add(i);
 }for(let i=0;i<result.length;i++)resolve(i);return result;
}
export function validAttachmentData(entry){
 const {guides,strokeIds,pointIds,attachments}=entry;if(strokeIds===undefined&&pointIds===undefined&&attachments===undefined)return true;
 if(!Array.isArray(guides)||!Array.isArray(strokeIds)||strokeIds.length!==guides.length||!strokeIds.every(s=>typeof s==='string'&&s.length>0&&s.length<100)||new Set(strokeIds).size!==strokeIds.length||!Array.isArray(pointIds)||pointIds.length!==guides.length||!pointIds.every((ids,i)=>Array.isArray(ids)&&ids.length===guides[i]?.length&&ids.every(s=>typeof s==='string'&&s.length>0&&s.length<100)&&new Set(ids).size===ids.length)||!Array.isArray(attachments)||attachments.length>guides.length*2)return false;
 const ends=new Set(),accepted=[];
 for(const l of attachments){if(!l||!strokeIds.includes(l.source)||!strokeIds.includes(l.target)||!['start','end'].includes(l.end)||ends.has(l.source+':'+l.end)||!canAttach(accepted,l.source,l.target))return false;ends.add(l.source+':'+l.end);
  const i=strokeIds.indexOf(l.target);if(l.kind==='point'){if(!pointIds[i].includes(l.point))return false;}
  else if(l.kind==='segment'){const k=pointIds[i].indexOf(l.from);if(k<0||pointIds[i][k+1]!==l.to||!Number.isFinite(l.fraction)||l.fraction<0||l.fraction>1)return false;}
  else return false;accepted.push(l);
 }return true;
}
