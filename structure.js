import {transform} from './matcher.js';
import {curveKnots} from './motion-curves.js';

const dist=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1]);
const length=p=>p.slice(1).reduce((n,q,i)=>n+dist(q,p[i]),0);
function resample(path,step=2){
  if(path.length<2)return path.map(p=>p.slice());
  const out=[path[0].slice()];let remaining=step;
  for(let i=1;i<path.length;i++){let a=path[i-1],b=path[i],d=dist(a,b);
    while(d>=remaining&&d>0){a=a.map((v,k)=>v+(b[k]-v)*remaining/d);out.push(a);d=dist(a,b);remaining=step;}
    remaining-=d;
  }if(dist(out.at(-1),path.at(-1))>.01)out.push(path.at(-1).slice());return out;
}
function area(path){return path.reduce((a,p,i)=>{const q=path[(i+1)%path.length];return a+p[0]*q[1]-q[0]*p[1];},0)/2;}
export function features(strokes){
  const corners=[],loops=[],joins=[];
  for(const [stroke,raw] of strokes.entries()){
    const p=resample(raw,Math.max(2,length(raw)/400)),knots=curveKnots(p,2);
    for(let i=1;i<knots.length-1;i++){
      const a=knots[i-1],b=knots[i],c=knots[i+1],u=dist(a,b),v=dist(b,c);
      const angle=Math.acos(Math.max(-1,Math.min(1,((b[0]-a[0])*(c[0]-b[0])+(b[1]-a[1])*(c[1]-b[1]))/(u*v||1))));
      if(u>=3&&v>=3&&angle>Math.PI*.30)corners.push({point:b,angle,stroke});
    }
    // A close return with meaningful enclosed area is a loop, including a small pen gap.
    const candidates=[];
    for(let i=0;i<p.length;i++)for(let j=i+8;j<p.length;j++)if(dist(p[i],p[j])<=3){
      const section=p.slice(i,j+1),a=area(section);if(Math.abs(a)<12)continue;
      candidates.push({point:[section.reduce((n,q)=>n+q[0],0)/section.length,section.reduce((n,q)=>n+q[1],0)/section.length],area:Math.abs(a),direction:Math.sign(a),stroke,start:i,end:j,gap:dist(p[i],p[j])});
    }
    candidates.sort((a,b)=>a.gap-b.gap);
    const accepted=[];for(const c of candidates)if(!accepted.some(l=>Math.max(l.start,c.start)<Math.min(l.end,c.end)))accepted.push(c);
    loops.push(...accepted);
  }
  const sampled=strokes.map(p=>resample(p,Math.max(2,length(p)/400)));
  sampled.forEach((p,i)=>{if(!p.length)return;for(const endpoint of [p[0],p.at(-1)]){
    if(sampled.some((q,j)=>j!==i&&q.some(v=>dist(v,endpoint)<=3))&&!joins.some(v=>dist(v.point,endpoint)<=3))joins.push({point:endpoint});
  }});
  return {corners,loops,joins};
}
function match(a,b,cost,limit){
  const candidates=a.flatMap((x,i)=>b.map((y,j)=>({i,j,cost:cost(x,y)}))).sort((x,y)=>x.cost-y.cost),usedA=new Set(),usedB=new Set(),pairs=[];
  for(const c of candidates)if(c.cost<=limit&&!usedA.has(c.i)&&!usedB.has(c.j)){pairs.push([a[c.i],b[c.j]]);usedA.add(c.i);usedB.add(c.j);}return pairs;
}
function normalized(strokes,bounds){
  const xs=bounds.map(p=>p[0]),ys=bounds.map(p=>p[1]),x=Math.min(...xs),y=Math.min(...ys),w=Math.max(...xs)-x,h=Math.max(...ys)-y,s=76/Math.max(w,h,1);
  return strokes.map(p=>p.map(q=>[(q[0]-x-w/2)*s+56,(q[1]-y-h/2)*s+56]));
}
export function compareStructure(referenceStrokes,drawingStrokes,referencePixels,drawingPixels,params){
  const ref=normalized(referenceStrokes,referencePixels),draw=normalized(drawingStrokes,drawingPixels).map(p=>transform(p,params));
  const r=features(ref),d=features(draw),cp=match(r.corners,d.corners,(a,b)=>dist(a.point,b.point),12),lp=match(r.loops,d.loops,(a,b)=>dist(a.point,b.point),16);
  const pathCost=(a,b,reverse=false)=>{const x=resample(a,Math.max(length(a)/30,.1)),y=resample(reverse?b.slice().reverse():b,Math.max(length(b)/30,.1));let n=0;for(let i=0;i<20;i++)n+=dist(x[Math.round(i*(x.length-1)/19)],y[Math.round(i*(y.length-1)/19)]);return n/20;};
  const rp=ref.map((path,index)=>({path,index})),dp=draw.map((path,index)=>({path,index}));
  const pairs=match(rp,dp,(a,b)=>Math.min(pathCost(a.path,b.path),pathCost(a.path,b.path,true)),18);
  const reversed=pairs.filter(([a,b])=>length(a.path)>8&&pathCost(a.path,b.path,true)+3<pathCost(a.path,b.path)).length;
  const orderErrors=pairs.filter(([a,b])=>a.index!==b.index).length;
  const result={version:1,referenceCorners:r.corners.length,drawingCorners:d.corners.length,missingCorners:r.corners.length-cp.length,extraCorners:d.corners.length-cp.length,cornerAngleError:cp.length?cp.reduce((n,[a,b])=>n+Math.abs(a.angle-b.angle)*180/Math.PI,0)/cp.length:null,referenceLoops:r.loops.length,drawingLoops:d.loops.length,missingLoops:r.loops.length-lp.length,extraLoops:d.loops.length-lp.length,loopDirectionErrors:lp.filter(([a,b])=>a.direction!==b.direction).length,loopSizeError:lp.length?lp.reduce((n,[a,b])=>n+Math.abs(Math.log(b.area/a.area)),0)/lp.length:null,referenceStrokes:ref.length,drawingStrokes:draw.length,matchedStrokes:pairs.length,reversedStrokes:reversed,orderErrors};
  const jp=match(r.joins,d.joins,(a,b)=>dist(a.point,b.point),10);
  result.missingJoins=r.joins.length-jp.length;result.extraJoins=d.joins.length-jp.length;
  const messages=[];
  if(result.missingCorners)messages.push(`${result.missingCorners} expected sharp corner(s) missing or too rounded`);
  if(result.extraCorners)messages.push(`${result.extraCorners} extra sharp turn(s)`);
  if(result.missingLoops)messages.push(`${result.missingLoops} expected loop(s) missing or misplaced`);
  if(result.extraLoops)messages.push(`${result.extraLoops} extra loop(s)`);
  if(result.missingJoins)messages.push(`${result.missingJoins} expected stroke join(s) missing or misplaced`);
  if(result.extraJoins)messages.push(`${result.extraJoins} extra stroke join(s)`);
  if(result.loopDirectionErrors)messages.push(`${result.loopDirectionErrors} loop(s) traversed in the opposite direction`);
  if(result.loopSizeError>.4)messages.push('Loop sizes differ from the reference');
  if(result.cornerAngleError>25)messages.push('Corner angles differ from the reference');
  if(reversed)messages.push(`${reversed} matched stroke(s) drawn backwards`);
  if(orderErrors)messages.push('Matched strokes occur in a different order');
  if(ref.length!==draw.length)messages.push(`Stroke count: ${draw.length}; reference: ${ref.length}`);
  if(pairs.length<Math.min(ref.length,draw.length))messages.push('Some strokes could not be matched reliably');
  result.messages=messages.length?messages:['Detected corners, loops and stroke directions agree with the reference'];return result;
}
