import {sampleCurve} from './motion-curves.js';
import {resolveAttachments} from './motion-attachments.js';
import {createMotionLibrary} from './motion-library.js';
import {thin,CHARACTERS,choose} from './matcher.js';
const $=id=>document.getElementById(id),KEY='kurrent-studio-v1';
const validAttempt=h=>h&&CHARACTERS.includes(h.char)&&['score','error','rotation','skew','widthRatio'].every(k=>Number.isFinite(h[k]))&&h.score>=0&&h.score<=10&&typeof h.visible==='boolean'&&typeof h.date==='string';
let saved={};try{saved=JSON.parse(localStorage.getItem(KEY)||'{}');if(!saved||typeof saved!=='object')saved={};}catch{$('storageMessage').textContent='Saved progress could not be read. Export new attempts to keep a backup.';}
let history=Array.isArray(saved.history)?saved.history.filter(validAttempt):[];
let settings={rotationCorrection:false,skewCorrection:false,mode:'adaptive',set:'all',visible:true,enabled:[...CHARACTERS],...saved.settings};
if(!['adaptive','frequency','random'].includes(settings.mode))settings.mode='adaptive';
if(!['all','upper','lower'].includes(settings.set))settings.set='all';
if(!Array.isArray(settings.enabled))settings.enabled=[...CHARACTERS];
settings.enabled=settings.enabled.filter(c=>CHARACTERS.includes(c));if(!settings.enabled.length)settings.enabled=[...CHARACTERS];
settings.rotationCorrection=settings.rotationCorrection===true;settings.skewCorrection=settings.skewCorrection===true;
let referenceZoom=1,referenceBitmap=null;
let current='',attemptVisible=settings.visible,strokes=[],active=null,graded=false,busy=false,referencePoints=[],worker=null;
const draw=$('drawing'),ctx=draw.getContext('2d');
const label=c=>c==='s-round'?'s rund (s)':c==='s'?'s scharf (ſ)':c;
const mean=(a,k)=>a.length?a.reduce((s,h)=>s+h[k],0)/a.length:0;
const signed=(n,unit='°')=>(n>0?'+':'')+n.toFixed(1)+unit;
function persist(){try{localStorage.setItem(KEY,JSON.stringify({version:1,history,settings}));}catch{$('storageMessage').textContent='Browser storage is unavailable or full. Export progress to keep a backup.';}}
function enabled(){return CHARACTERS.filter(c=>settings.enabled.includes(c)&&(settings.set==='all'||(settings.set==='lower'?c===c.toLowerCase():c===c.toUpperCase())));}
function visible(){ $('reference').hidden=!settings.visible;$('referenceToggle').setAttribute('aria-pressed',String(settings.visible));$('hiddenNote').hidden=settings.visible;$('visibility').textContent='Reference: '+(settings.visible?'visible':'hidden');$('visibility').setAttribute('aria-pressed',settings.visible);}
function extract(canvas){const w=canvas.width,h=canvas.height,data=canvas.getContext('2d').getImageData(0,0,w,h).data,a=new Uint8Array(w*h);for(let i=0;i<a.length;i++)a[i]=data[i*4+3]>100&&data[i*4]<180?1:0;const s=thin(a,w,h),p=[];for(let y=0;y<h;y++)for(let x=0;x<w;x++)if(s[y*w+x])p.push([x,y]);return p;}
function glyph(){
 const c=$('reference'),g=c.getContext('2d'),text=current==='s-round'?'$':current==='tz'?'ú':current;
 g.clearRect(0,0,c.width,c.height);g.font='270px Kurrent';g.fillStyle='#263d39';
 let m=g.measureText(text),w=m.actualBoundingBoxLeft+m.actualBoundingBoxRight,h=m.actualBoundingBoxAscent+m.actualBoundingBoxDescent;
 const fit=Math.min(1,(c.width-50)/w,(c.height-50)/h);g.font=(270*fit)+'px Kurrent';m=g.measureText(text);w=m.actualBoundingBoxLeft+m.actualBoundingBoxRight;h=m.actualBoundingBoxAscent+m.actualBoundingBoxDescent;
 g.fillText(text,(c.width-w)/2+m.actualBoundingBoxLeft,(c.height-h)/2+m.actualBoundingBoxAscent);
 const small=document.createElement('canvas');small.width=176;small.height=152;small.getContext('2d').drawImage(c,0,0,176,152);referencePoints=extract(small);
 referenceBitmap=null;if(referencePoints.length){const bitmap=document.createElement('canvas');bitmap.width=c.width;bitmap.height=c.height;const bg=bitmap.getContext('2d');bg.drawImage(c,0,0);bg.globalCompositeOperation='source-in';bg.fillStyle='#999999';bg.fillRect(0,0,bitmap.width,bitmap.height);const xs=referencePoints.map(p=>p[0]),ys=referencePoints.map(p=>p[1]),minX=Math.min(...xs),maxX=Math.max(...xs),minY=Math.min(...ys),maxY=Math.max(...ys),unit=76/Math.max(maxX-minX,maxY-minY);referenceBitmap={canvas:bitmap,unit:unit/2.5,offset:[56-((minX+maxX)/2+.5)*unit,56-((minY+maxY)/2+.5)*unit]};}
 
 if(referencePoints.length){const snapshot=document.createElement('canvas');snapshot.width=c.width;snapshot.height=c.height;snapshot.getContext('2d').drawImage(c,0,0);const xs=referencePoints.map(p=>p[0]),ys=referencePoints.map(p=>p[1]),x=Math.min(...xs)*2.5-6,y=Math.min(...ys)*2.5-6,w=(Math.max(...xs)-Math.min(...xs))*2.5+12,h=(Math.max(...ys)-Math.min(...ys))*2.5+12;referenceZoom=Math.min((c.width-24)/w,(c.height-24)/h);g.clearRect(0,0,c.width,c.height);g.drawImage(snapshot,x,y,w,h,(c.width-w*referenceZoom)/2,(c.height-h*referenceZoom)/2,w*referenceZoom,h*referenceZoom);}
 $('letterName').textContent=label(current)+' · '+(current===current.toLowerCase()?'lowercase':'uppercase');visible();
}
function redraw(){
 draw.style.visibility=graded?'hidden':'visible';$('overlay').hidden=!graded;$('resultLegend').hidden=!graded;

 ctx.clearRect(0,0,draw.width,draw.height);ctx.lineWidth=4;ctx.lineCap='round';ctx.lineJoin='round';ctx.strokeStyle='#294f47';ctx.fillStyle='#294f47';
 for(const stroke of strokes){if(stroke.length===1){ctx.beginPath();ctx.arc(...stroke[0],2,0,Math.PI*2);ctx.fill();}else{ctx.beginPath();ctx.moveTo(...stroke[0]);for(const p of stroke.slice(1))ctx.lineTo(...p);ctx.stroke();}}
 $('drawHint').hidden=graded||strokes.length>0;$('clear').disabled=busy;$('next').disabled=busy||!!active||(!graded&&!strokes.length)||!current;
}
function reset(){ $('score').textContent='—';
strokes=[];active=null;graded=false;attemptVisible=settings.visible;$('feedback').hidden=true;$('next').hidden=false;redraw();}
function next(char){
 if(busy)return;const chars=enabled();reset();
 if(!chars.length){current='';$('reference').getContext('2d').clearRect(0,0,440,380);$('letterName').textContent='No letters enabled';$('storageMessage').textContent='Enable at least one letter in the selected letter set.';return;}
 if($('storageMessage').textContent==='Enable at least one letter in the selected letter set.')$('storageMessage').textContent='';
 current=char||choose(chars,settings.mode,history);glyph();if(char)document.querySelector('.studio').scrollIntoView({block:'start'});
}
function point(e){const r=draw.getBoundingClientRect();return [(e.clientX-r.left)*draw.width/r.width,(e.clientY-r.top)*draw.height/r.height];}
draw.addEventListener('pointerdown',e=>{if(!current||graded||busy||active||e.button!==0)return;e.preventDefault();draw.setPointerCapture(e.pointerId);active={id:e.pointerId,stroke:[point(e)]};strokes.push(active.stroke);redraw();});
draw.addEventListener('pointermove',e=>{if(!active||active.id!==e.pointerId)return;const es=e.getCoalescedEvents?.();for(const p of es?.length?es:[e])active.stroke.push(point(p));redraw();});
function end(e){if(active?.id===e.pointerId){if(e.type==='pointerup')active.stroke.push(point(e));else if(e.type==='pointercancel')strokes.pop();active=null;redraw();}}
for(const type of ['pointerup','pointercancel','lostpointercapture'])draw.addEventListener(type,end);

$('clear').onclick=()=>{if(!busy)reset();};$('next').onclick=()=>{if(busy||active)return;if(graded)next();else checkDrawing();};
$('visibility').onclick=()=>{settings.visible=!settings.visible;if(settings.visible)attemptVisible=true;visible();persist();};
for(const id of ['mode','set']){$(id).value=settings[id];$(id).onchange=()=>{settings[id]=$(id).value;persist();stats();next();};}
function renderLetters(){
 $('letters').replaceChildren();for(const c of CHARACTERS){const b=document.createElement('button');b.textContent=label(c);b.setAttribute('aria-pressed',settings.enabled.includes(c));
 b.onclick=()=>{if(busy)return;if(settings.enabled.includes(c)){if(settings.enabled.length===1)return;settings.enabled=settings.enabled.filter(x=>x!==c);}else settings.enabled.push(c);persist();renderLetters();stats();if(!enabled().includes(current))next();};$('letters').append(b);}
}
$('lettersToggle').onclick=()=>{$('lettersPanel').hidden=!$('lettersPanel').hidden;};
$('allLetters').onclick=()=>{settings.enabled=[...CHARACTERS];persist();renderLetters();stats();if(!current)next();};
function stats(){
 const chars=enabled(),hs=history.filter(h=>chars.includes(h.char));
 $('attemptCount').textContent=hs.length;$('average').textContent=hs.length?mean(hs,'score').toFixed(1):'—';$('recent').textContent=hs.length?mean(hs.slice(-10),'score').toFixed(1):'—';
 const practiced=chars.filter(c=>hs.some(h=>h.char===c));practiced.sort((a,b)=>mean(hs.filter(h=>h.char===a).slice(-6),'score')-mean(hs.filter(h=>h.char===b).slice(-6),'score'));$('weakest').textContent=label(practiced[0]||'—');
 $('habits').textContent=hs.length?`Your last ${Math.min(20,hs.length)} attempts: average rotation ${signed(mean(hs.slice(-20),'rotation'))}, skew ${signed(mean(hs.slice(-20),'skew'))}, relative width ${Math.round(mean(hs.slice(-20),'widthRatio')*100)}%. These estimates describe recurring deviations; the scoring baseline stays fixed.`:'Your handwriting patterns will appear after your first attempt.';
 $('stats').replaceChildren();for(const c of chars){const a=hs.filter(h=>h.char===c),tr=document.createElement('tr'),td=document.createElement('td'),b=document.createElement('button');b.textContent=label(c);b.title='Practise '+label(c);b.onclick=()=>next(c);td.append(b);tr.append(td);
 const size=a.filter(h=>Number.isFinite(h.sizeRatio)),structured=a.filter(h=>h.structure?.version===1);
 if(structured.length){const f=structured.at(-1).structure;tr.title='Latest structure assessment: '+f.missingCorners+' missing corners, '+f.missingLoops+' missing loops, '+f.reversedStrokes+' reversed strokes';}
 for(const text of [a.length,a.length?mean(a,'score').toFixed(1):'—',a.length?mean(a.slice(-6),'score').toFixed(1):'—',a.length?signed(mean(a,'rotation')):'—',a.length?signed(mean(a,'skew')):'—',a.length?Math.round(mean(a,'widthRatio')*100)+'%':'—',size.length?Math.round(mean(size,'sizeRatio')*100)+'%':'—',a.length?mean(a,'error').toFixed(2):'—',structured.length?structured.at(-1).structure.missingCorners:'—',structured.length?structured.at(-1).structure.missingLoops:'—',structured.length?structured.at(-1).structure.reversedStrokes:'—']){const cell=document.createElement('td');cell.textContent=text;tr.append(cell);}$('stats').append(tr);}
}
function overlay(r){
 const c=$('overlay'),g=c.getContext('2d'),points=[...r.reference,...r.aligned],xs=points.map(p=>p[0]),ys=points.map(p=>p[1]);
 const minX=Math.min(...xs),maxX=Math.max(...xs),minY=Math.min(...ys),maxY=Math.max(...ys),scale=Math.min((c.width-90)/Math.max(1,maxX-minX),(c.height-90)/Math.max(1,maxY-minY)),cx=(minX+maxX)/2,cy=(minY+maxY)/2;
 g.clearRect(0,0,c.width,c.height);
 if(referenceBitmap){const {canvas,unit,offset}=referenceBitmap;g.save();g.globalAlpha=.5;g.setTransform(scale*unit,0,0,scale*unit,(offset[0]-cx)*scale+c.width/2,(offset[1]-cy)*scale+c.height/2);g.drawImage(canvas,0,0);g.restore();}
 for(const [ps,color] of [[r.reference,'#bb854bb0'],[r.aligned,'#206e76b0']]){g.fillStyle=color;for(const [x,y] of ps){g.beginPath();g.arc((x-cx)*scale+c.width/2,(y-cy)*scale+c.height/2,Math.max(2,scale*.7),0,Math.PI*2);g.fill();}}
}
function span(ps){let minX=Infinity,minY=Infinity,maxX=-Infinity,maxY=-Infinity;for(const[x,y]of ps){minX=Math.min(minX,x);minY=Math.min(minY,y);maxX=Math.max(maxX,x);maxY=Math.max(maxY,y);}return Math.max(maxX-minX,maxY-minY);}
function showResult(r,drawing){
 const prior=history.filter(h=>h.char===current&&h.visible===attemptVisible&&(h.corrections?.rotation??true)===settings.rotationCorrection&&(h.corrections?.skew??true)===settings.skewCorrection).slice(-10),wrap=$('referenceWrap');
 const refScale=Math.min(wrap.clientWidth/440,wrap.clientHeight/380)*referenceZoom,sizeRatio=span(drawing)*draw.getBoundingClientRect().width/192/(span(referencePoints)*2.5*refScale);
 history.push({char:current,score:r.score,error:r.error,rotation:r.rotation,skew:r.skew,widthRatio:r.widthRatio,sizeRatio,corrections:{rotation:settings.rotationCorrection,skew:settings.skewCorrection},structure:r.structure||null,visible:attemptVisible,date:new Date().toISOString()});persist();graded=true;redraw();
 $('feedback').hidden=false;$('next').hidden=false;$('score').textContent=r.score.toFixed(1);
 $('comparison').textContent=prior.length?`${signed(r.score-mean(prior,'score'),' points')} versus your previous ${prior.length} ${attemptVisible?'visible-reference':'memory'} attempts at ${label(current)}. Rotation changed ${signed(r.rotation-mean(prior,'rotation'))}; skew changed ${signed(r.skew-mean(prior,'skew'))}; width changed ${signed((r.widthRatio-mean(prior,'widthRatio'))*100,' percentage points')}.`:'Your first '+(attemptVisible?'visible-reference':'memory')+' attempt at '+label(current)+'. A baseline for next time.';
 $('deviations').textContent=`Before alignment: rotation ${signed(r.rotation)}, skew ${signed(r.skew)}, width ${Math.round(r.widthRatio*100)}% of reference proportions, overall size ${Math.round(sizeRatio*100)}% of the displayed exemplar. Remaining shape error: ${r.error.toFixed(2)} px.`;
 const feature=r.structure;
 $('structureFeedback').textContent=feature?('Structure feedback (experimental): '+feature.messages.join('; ')+'. Corners '+feature.drawingCorners+'/'+feature.referenceCorners+'; loops '+feature.drawingLoops+'/'+feature.referenceLoops+' (drawn/reference). The visual score above is unchanged.'):'Structure feedback needs a saved, confirmed motion for this letter. Import a desktop progress file containing confirmed motions to enable it.';
 const previous=prior.filter(h=>h.structure?.version===1);
 if(feature&&previous.length){const old=previous.at(-1).structure;$('structureFeedback').textContent+=' Compared with your last assessed attempt: missing corners '+(feature.missingCorners-old.missingCorners)+'; missing loops '+(feature.missingLoops-old.missingLoops)+'; reversed strokes '+(feature.reversedStrokes-old.reversedStrokes)+'.';}
 overlay(r);stats();
}
function checkDrawing(){
 if(!strokes.length||busy||active)return;busy=true;for(const id of ['mode','set','visibility','lettersToggle','allLetters','rotationCorrection','skewCorrection'])$(id).disabled=true;redraw();$('next').textContent='…';
 const small=document.createElement('canvas');small.width=192;small.height=216;small.getContext('2d').drawImage(draw,0,0,small.width,small.height);const drawing=extract(small);
 let timer;
 function done(){clearTimeout(timer);worker?.terminate();worker=null;busy=false;for(const id of ['mode','set','visibility','lettersToggle','allLetters','rotationCorrection','skewCorrection'])$(id).disabled=false;$('next').textContent='next';redraw();}
 function fail(message){done();$('storageMessage').textContent=message;}
 try{worker=new Worker('./worker.js',{type:'module'});timer=setTimeout(()=>fail('Comparison took too long. Please try again.'),30000);
 worker.onerror=()=>fail('Comparison could not run. Reload the app and try again.');
 worker.onmessage=({data})=>{if(data.error){fail(data.error);return;}done();showResult(data.result,drawing);};const entry=motionEditor.exportData()[current];let motion=null;
 if(entry?.confirmed){const guides=entry.guides?resolveAttachments(entry.guides,entry.guideCorners||[],entry.strokeIds||[],entry.pointIds||[],entry.attachments||[]):null;
 motion=(guides?guides.map((p,i)=>sampleCurve(p,entry.guideCorners?.[i])):entry.strokes).map(p=>p.map(([x,y])=>[(x-82.4)/2.7,(y-34.8)/2.7]));}
 worker.postMessage({reference:referencePoints,drawing,motion,corrections:{rotation:settings.rotationCorrection,skew:settings.skewCorrection},strokes:strokes.map(p=>p.map(([x,y])=>[x*192/draw.width,y*216/draw.height]))});
 }catch{fail('Comparison could not start. Reload the app and try again.');}
};
$('export').onclick=()=>{const blob=new Blob([JSON.stringify({version:1,settings,history,motions:motionEditor.exportData()},null,2)],{type:'application/json'}),a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='kurrent-progress-'+new Date().toISOString().slice(0,10)+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);};
$('import').onchange=async e=>{const f=e.target.files[0];if(!f)return;try{const v=JSON.parse(await f.text());if(v.version!==1||!Array.isArray(v.history)||v.history.length>100000||!v.history.every(validAttempt)||!motionEditor.validateData(v.motions))throw Error('Invalid progress file');motionEditor.importData(v.motions);const ids=new Set(history.map(h=>JSON.stringify(h)));for(const h of v.history)if(!ids.has(JSON.stringify(h))){history.push(h);ids.add(JSON.stringify(h));}history.sort((a,b)=>a.date.localeCompare(b.date));persist();stats();$('storageMessage').textContent='Progress imported and merged; duplicate attempts skipped.';}catch{$('storageMessage').textContent='Could not import: choose an unmodified Kurrent progress export.';}e.target.value='';};
function motionReference(c){
 const canvas=document.createElement('canvas');canvas.width=440;canvas.height=380;
 const g=canvas.getContext('2d'),text=c==='s-round'?'$':c==='tz'?'ú':c;g.font='270px Kurrent';g.fillStyle='#263d39';
 let m=g.measureText(text),w=m.actualBoundingBoxLeft+m.actualBoundingBoxRight,h=m.actualBoundingBoxAscent+m.actualBoundingBoxDescent;
 const fit=Math.min(1,390/w,330/h);g.font=(270*fit)+'px Kurrent';m=g.measureText(text);w=m.actualBoundingBoxLeft+m.actualBoundingBoxRight;h=m.actualBoundingBoxAscent+m.actualBoundingBoxDescent;
 g.fillText(text,(440-w)/2+m.actualBoundingBoxLeft,(380-h)/2+m.actualBoundingBoxAscent);
 const small=document.createElement('canvas');small.width=176;small.height=152;small.getContext('2d').drawImage(canvas,0,0,176,152);
 return {canvas,points:extract(small)};
}
const motionEditor=createMotionLibrary();
try{await document.fonts.load('270px Kurrent');if(!document.fonts.check('270px Kurrent'))throw Error();renderLetters();stats();next();}catch{$('storageMessage').textContent='The Kurrent font could not load. Reconnect, reopen the app and wait for offline setup.';$('next').disabled=true;}

const menu=$('practiceMenu'),menuToggle=$('menuToggle');
for(const key of ['rotationCorrection','skewCorrection']){$(key).checked=settings[key];$(key).onchange=()=>{settings[key]=$(key).checked;persist();};}
$('referenceToggle').onclick=()=>{if(!busy)$('visibility').click();};
menuToggle.onclick=()=>{menu.hidden=!menu.hidden;menuToggle.setAttribute('aria-expanded',String(!menu.hidden));};
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!menu.hidden){menu.hidden=true;menuToggle.setAttribute('aria-expanded','false');menuToggle.focus();}});
$('notebookToggle').onclick=()=>{const notebook=$('notebook');notebook.hidden=!notebook.hidden;$('notebookToggle').textContent=notebook.hidden?'Show statistics':'Hide statistics';$('notebookToggle').setAttribute('aria-expanded',String(!notebook.hidden));if(!notebook.hidden){menu.hidden=true;menuToggle.setAttribute('aria-expanded','false');notebook.scrollIntoView({block:'start'});}};
