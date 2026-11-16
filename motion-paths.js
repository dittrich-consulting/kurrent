import {validAttachmentData} from './motion-attachments.js';
// Guesses follow the skeleton, not the font outline's winding order.
// Crossings cannot reveal the historical ductus; every generated path needs review.
export function inferMotions(points) {
  const nodes = new Map(points.map(([x,y]) => [`${x},${y}`, {p:[x,y],adj:[]} ]));
  for (const n of nodes.values()) {
    const [x,y]=n.p;
    for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){
      if(!dx&&!dy)continue;
      const other=nodes.get(`${x+dx},${y+dy}`);if(!other)continue;
      // Diagonals across an existing right-angle connection create false branches.
      if(dx&&dy&&(nodes.has(`${x+dx},${y}`)||nodes.has(`${x},${y+dy}`)))continue;
      n.adj.push(other);
    }
  }
  const seen=new Set(),components=[];
  for(const n of nodes.values())if(!seen.has(n)){
    const c=[n];seen.add(n);for(let i=0;i<c.length;i++)for(const a of c[i].adj)if(!seen.has(a)){seen.add(a);c.push(a);}components.push(c);
  }
  components.sort((a,b)=>b.length-a.length||a[0].p[0]-b[0].p[0]);
  const edge=(a,b)=>{const ak=a.p.join(','),bk=b.p.join(',');return ak<bk?ak+'|'+bk:bk+'|'+ak;};
  return components.map(c=>{
    const xs=c.map(n=>n.p[0]),ys=c.map(n=>n.p[1]);
    const vertical=Math.max(...xs)-Math.min(...xs)<.45*(Math.max(...ys)-Math.min(...ys));
    const ends=c.filter(n=>n.adj.length===1),candidates=ends.length?ends:c;
    candidates.sort((a,b)=>vertical?a.p[1]-b.p[1]||a.p[0]-b.p[0]:a.p[0]-b.p[0]||b.p[1]-a.p[1]);
    let at=candidates[0],previous=null;const path=[at.p],used=new Set();
    const total=c.reduce((s,n)=>s+n.adj.length,0)/2;
    while(used.size<total){
      const choices=at.adj.filter(n=>!used.has(edge(at,n)));
      if(choices.length){
        // Prefer continuing the incoming tangent rather than turning at a crossing.
        const direction=previous?[at.p[0]-previous.p[0],at.p[1]-previous.p[1]]:vertical?[0,1]:[1,0];
        const cost=n=>{const dx=n.p[0]-at.p[0],dy=n.p[1]-at.p[1];return (dx*direction[0]+dy*direction[1])/Math.hypot(dx,dy);};
        choices.sort((a,b)=>cost(b)-cost(a));const to=choices[0];used.add(edge(at,to));previous=at;at=to;path.push(at.p);
      }else{
        // Retrace an existing connection to the nearest unvisited branch, without a pen lift.
        const queue=[at],parents=new Map([[at,null]]);let target=null;
        for(let i=0;i<queue.length;i++){const n=queue[i];if(n.adj.some(a=>!used.has(edge(n,a)))){target=n;break;}for(const a of n.adj)if(!parents.has(a)){parents.set(a,n);queue.push(a);}}
        if(!target)break;const back=[];for(let n=target;n!==at;n=parents.get(n))back.push(n);
        for(const n of back.reverse()){previous=at;at=n;path.push(n.p);}
      }
    }
    return path.map(([x,y])=>[82.4+x*2.7,34.8+y*2.7]);
  });
}

export function validMotion(entry){
  if(!entry||!validAttachmentData(entry))return false;
  if(entry?.guideCorners!==undefined&&(!Array.isArray(entry.guides)||!Array.isArray(entry.guideCorners)||entry.guideCorners.length!==entry.guides.length||!entry.guideCorners.every((c,i)=>Array.isArray(c)&&c.length===entry.guides[i]?.length&&c.every(v=>typeof v==='boolean'))))return false;
  if(entry?.guides!==undefined){
    if(!Array.isArray(entry.guides)||entry.guides.length!==entry.strokes?.length||typeof entry.fontFit!=='boolean'||entry.curveVersion!==1)return false;
    if(!validMotion({confirmed:true,updated:'guide',strokes:entry.guides}))return false;
  }
  return entry&&entry.confirmed===true&&typeof entry.updated==='string'&&Array.isArray(entry.strokes)&&entry.strokes.length>0&&entry.strokes.length<=100&&entry.strokes.every(s=>Array.isArray(s)&&s.length>0&&s.length<=20000&&s.every(p=>Array.isArray(p)&&p.length===2&&p.every(Number.isFinite)&&p[0]>=0&&p[0]<=640&&p[1]>=0&&p[1]<=480));
}

// Timeline includes visible pauses at pen lifts. Playback speed is independent of sampling density.
export function timeline(strokes){
  const events=[];let time=0;
  strokes.forEach((stroke,index)=>{if(index)time+=35;events.push({point:stroke[0],time,stroke:index,start:true});for(let i=1;i<stroke.length;i++){time+=Math.hypot(stroke[i][0]-stroke[i-1][0],stroke[i][1]-stroke[i-1][1]);events.push({point:stroke[i],time,stroke:index,start:false});}});
  return {events,duration:Math.max(time,1)};
}
