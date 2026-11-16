// Centerline-based comparison. Coordinates and errors use a 112 x 112 grid.
export const GRID=112;
export function thin(input,w,h){
 const a=Uint8Array.from(input);let changed=true,rounds=0;
 while(changed&&rounds++<100){changed=false;for(let pass=0;pass<2;pass++){
 const remove=[];
 for(let y=1;y<h-1;y++)for(let x=1;x<w-1;x++){let i=y*w+x;if(!a[i])continue;
 const p=[a[i-w],a[i-w+1],a[i+1],a[i+w+1],a[i+w],a[i+w-1],a[i-1],a[i-w-1]];
 const n=p.reduce((s,v)=>s+v,0);if(n<2||n>6)continue;let t=0;for(let k=0;k<8;k++)if(!p[k]&&p[(k+1)%8])t++;if(t!==1)continue;
 if(pass===0?(p[0]*p[2]*p[4]||p[2]*p[4]*p[6]):(p[0]*p[2]*p[6]||p[0]*p[4]*p[6]))continue;remove.push(i);
 }for(const i of remove)a[i]=0;if(remove.length)changed=true;
 }}return a;
}
export function normalize(points){
 if(!points.length)throw Error('Empty shape');
 const xs=points.map(p=>p[0]),ys=points.map(p=>p[1]);const minX=Math.min(...xs),maxX=Math.max(...xs),minY=Math.min(...ys),maxY=Math.max(...ys);
 const span=Math.max(maxX-minX,maxY-minY);if(span<2)throw Error('Please draw a larger letter.');
 const cx=(minX+maxX)/2,cy=(minY+maxY)/2,s=76/span;
 return {points:points.map(([x,y])=>[(x-cx)*s+56,(y-cy)*s+56]),span,width:maxX-minX,height:maxY-minY};
}
function field(points){
 const n=GRID,a=new Float32Array(n*n).fill(1000);
 for(const [x,y]of points){let ix=Math.round(x),iy=Math.round(y);if(ix>=0&&ix<n&&iy>=0&&iy<n)a[iy*n+ix]=0;}
 for(let y=0;y<n;y++)for(let x=0;x<n;x++){let i=y*n+x,v=a[i];if(x)v=Math.min(v,a[i-1]+1);if(y)v=Math.min(v,a[i-n]+1);if(x&&y)v=Math.min(v,a[i-n-1]+Math.SQRT2);if(y&&x<n-1)v=Math.min(v,a[i-n+1]+Math.SQRT2);a[i]=v;}
 for(let y=n-1;y>=0;y--)for(let x=n-1;x>=0;x--){let i=y*n+x,v=a[i];if(x<n-1)v=Math.min(v,a[i+1]+1);if(y<n-1)v=Math.min(v,a[i+n]+1);if(x<n-1&&y<n-1)v=Math.min(v,a[i+n+1]+Math.SQRT2);if(x&&y<n-1)v=Math.min(v,a[i+n-1]+Math.SQRT2);a[i]=v;}return a;
}
export function transform(points,p){const [angle,sx,sy,shear,tx,ty]=p,c=Math.cos(angle),s=Math.sin(angle);return points.map(([x,y])=>{x-=56;y-=56;const u=sx*x+shear*y,v=sy*y;return [56+c*u-s*v+tx,56+s*u+c*v+ty];});}
function distance(points,f){let sum=0,tail=0;for(const[x,y]of points){const ix=Math.round(x),iy=Math.round(y);const d=ix<0||iy<0||ix>=GRID||iy>=GRID?30:f[iy*GRID+ix];sum+=d;tail+=d*d;}return .75*sum/points.length+.25*Math.sqrt(tail/points.length);}
export function compare(reference,drawing){
 const r=normalize(reference),d=normalize(drawing),rf=field(r.points);
 const objective=p=>{const q=transform(d.points,p);return (distance(q,rf)+distance(r.points,field(q)))/2;};
 let best=[0,1,1,0,0,0],loss=objective(best);
 // Multiple orientations reduce dependence on the first local minimum.
 for(const angle of [-.32,0,.32]){let p=[angle,1,1,0,0,0],value=objective(p);
 for(const scale of [1,.5,.25])for(let iter=0;iter<5;iter++){let improved=false;
 for(let k=0;k<6;k++)for(const dir of [-1,1]){const q=p.slice();q[k]+=dir*[.12,.13,.13,.14,3,3][k]*scale;
 if(Math.abs(q[0])>.43634||q[1]<.65||q[1]>1.5||q[2]<.65||q[2]>1.5||Math.abs(q[3])>.45||Math.abs(q[4])>9||Math.abs(q[5])>9)continue;
 const v=objective(q);if(v<value-1e-5){value=v;p=q;improved=true;}}
 if(!improved)break;}
 if(value<loss){best=p;loss=value;}}
 const score=Math.max(0,Math.min(10,10*Math.exp(-Math.pow(loss/6,1.25))));
 return {score:Math.round(score*10)/10,error:loss,rotation:-best[0]*180/Math.PI,skew:Math.atan(best[3]/best[2])*180/Math.PI,widthRatio:best[2]/best[1],reference:r.points,aligned:transform(d.points,best),params:best};
}
export const CHARACTERS=[...'abcdefghijklmnopqr','s-round',...'stuvwxyzäöüßABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÜ','tz'];
const weights={e:17.4,n:9.8,i:7.6,s:7.3,r:7,t:6.2,a:6.5,d:5.1,h:4.8,u:4.3,l:3.4,c:3.1,g:3,m:2.5,o:2.5,b:1.9,w:1.9,f:1.7,k:1.2,z:1.1,p:.8,v:.7,'ü':.65,'ä':.55,'ö':.3,'ß':.3,j:.27,y:.04,x:.03,q:.02};
export function choose(chars,mode,history,rng=Math.random){
 if(!chars.length)throw Error('Enable at least one letter.');
 const ws=chars.map(c=>{if(mode==='random')return 1;if(mode==='frequency')return Math.max(.08,weights[c==='s-round'?'s':c==='tz'?'z':c.toLowerCase()]||.08);
 const hs=history.filter(h=>h.char===c),recent=hs.slice(-6),mean=recent.reduce((s,h)=>s+h.score,0)/(recent.length||1),ago=hs.length?history.length-1-history.lastIndexOf(hs.at(-1)):30;
 return (hs.length?1+Math.pow((10-mean)/2,2):12)*(1+Math.min(ago,30)/60);});
 let x=rng()*ws.reduce((a,b)=>a+b,0);return chars.find((_,i)=>(x-=ws[i])<0)||chars.at(-1);
}
