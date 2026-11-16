const distance=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1]);
const clamp=p=>[Math.max(0,Math.min(640,p[0])),Math.max(0,Math.min(480,p[1]))];
function segmentDistance(p,a,b){const dx=b[0]-a[0],dy=b[1]-a[1],t=Math.max(0,Math.min(1,((p[0]-a[0])*dx+(p[1]-a[1])*dy)/(dx*dx+dy*dy||1)));return distance(p,[a[0]+t*dx,a[1]+t*dy]);}
// Ramer–Douglas–Peucker reduction creates a manageable set of spline knots.
export function curveKnots(points,tolerance=6){
  if(points.length<3)return points.map(p=>p.slice());
  const keep=new Set([0,points.length-1]),stack=[[0,points.length-1]];
  while(stack.length){const[a,b]=stack.pop();let max=tolerance,index=-1;for(let i=a+1;i<b;i++){const d=segmentDistance(points[i],points[a],points[b]);if(d>max){max=d;index=i;}}if(index>=0){keep.add(index);stack.push([a,index],[index,b]);}}
  return [...keep].sort((a,b)=>a-b).map(i=>points[i].slice());
}
// Interpolating Catmull–Rom splines expressed as cubic Bezier segments.
// Limiting the tangent length prevents large overshoots around tightly spaced knots.
export function curveSegments(knots,corners=[]){
  const segments=[];
  for(let i=0;i<knots.length-1;i++){
    const p0=knots[Math.max(0,i-1)],p1=knots[i],p2=knots[i+1],p3=knots[Math.min(knots.length-1,i+2)],limit=distance(p1,p2)*.45;
    const control=(p,a,b,sign)=>{const v=[(b[0]-a[0])/6,(b[1]-a[1])/6],s=Math.min(1,limit/(Math.hypot(...v)||1));return[p[0]+sign*v[0]*s,p[1]+sign*v[1]*s];};
    // Corner knots break tangent continuity without introducing a pen lift.
    const a=corners[i]?[p1[0]+(p2[0]-p1[0])/3,p1[1]+(p2[1]-p1[1])/3]:control(p1,p0,p2,1);
    const b=corners[i+1]?[p2[0]+(p1[0]-p2[0])/3,p2[1]+(p1[1]-p2[1])/3]:control(p2,p1,p3,-1),steps=Math.max(4,Math.ceil((distance(p1,a)+distance(a,b)+distance(b,p2))/2));
    const out=[p1.slice()];for(let j=1;j<=steps;j++){const t=j/steps,u=1-t;out.push(clamp([u*u*u*p1[0]+3*u*u*t*a[0]+3*u*t*t*b[0]+t*t*t*p2[0],u*u*u*p1[1]+3*u*u*t*a[1]+3*u*t*t*b[1]+t*t*t*p2[1]]));}
    segments.push(out);
  }return segments;
}
export function sampleCurve(knots,corners=[]){
  if(knots.length<2)return knots.map(p=>p.slice());
  return curveSegments(knots,corners).flatMap((p,i)=>i?p.slice(1):p);
}
export function referenceGraph(referencePaths){
  const nodes=new Map(),key=p=>p.map(v=>v.toFixed(3)).join(',');
  for(const path of referencePaths){let previous=null;for(const p of path){const id=key(p);if(!nodes.has(id))nodes.set(id,{p,adj:new Set()});const n=nodes.get(id);if(previous&&previous!==n){previous.adj.add(n);n.adj.add(previous);}previous=n;}}
  return [...nodes.values()];
}
// Guides determine traversal order. Returned coordinates belong to the reference graph.
// Each bridge stays on the graph and favors the nearby guide rather than a shortcut at a crossing.
export function fitGuide(guide,graph){
  if(!guide.length||!graph.length)return [];
  const nearest=p=>graph.reduce((a,b)=>distance(p,a.p)<=distance(p,b.p)?a:b);
  const samples=[guide[0]];let last=guide[0];for(let i=1;i<guide.length-1;i++)if(distance(last,guide[i])>=7){samples.push(guide[i]);last=guide[i];}if(guide.length>1)samples.push(guide.at(-1));
  let at=nearest(samples[0]);const result=[at.p.slice()];let skipped=0;
  for(let i=1;i<samples.length;i++){
    const goal=nearest(samples[i]);if(at===goal)continue;
    const costs=new Map([[at,0]]),parents=new Map(),open=new Set([at]);
    while(open.size){let n=null;for(const q of open)if(!n||costs.get(q)<costs.get(n))n=q;open.delete(n);if(n===goal)break;
      for(const next of n.adj){const penalty=segmentDistance(next.p,samples[i-1],samples[i]);const cost=costs.get(n)+distance(n.p,next.p)*(1+penalty/5);if(cost<(costs.get(next)??Infinity)){costs.set(next,cost);parents.set(next,n);open.add(next);}}
    }
    if(!costs.has(goal)){skipped++;continue;} // Detached components require a separate stroke, never a teleport.
    const bridge=[];for(let n=goal;n!==at;n=parents.get(n))bridge.push(n.p.slice());result.push(...bridge.reverse());at=goal;
  }
  result.skippedSegments=skipped;return result;
}
