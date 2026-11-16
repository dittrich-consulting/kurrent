import {sampleCurve} from './motion-curves.js';
import {resolveAttachments} from './motion-attachments.js';
import {createMotionLibrary} from './motion-library.js';
import {thin,CHARACTERS,choose} from './matcher.js';
const $=id=>document.getElementById(id),KEY='kurrent-studio-v1';
const validAttempt=h=>h&&CHARACTERS.includes(h.char)&&['score','error','rotation','skew','widthRatio'].every(k=>Number.isFinite(h[k]))&&h.score>=0&&h.score<=10&&typeof h.visible==='boolean'&&typeof h.date==='string';
let saved={};try{saved=JSON.parse(localStorage.getItem(KEY)||'{}');if(!saved||typeof saved!=='object')saved={};}catch{$('storageMessage').textContent='Saved progress could not be read. Export new attempts to keep a backup.';}
let history=Array.isArray(saved.history)?saved.history.filter(validAttempt):[];
let settings={mode:'adaptive',set:'all',visible:true,enabled:[...CHARACTERS],...saved.settings};
if(!['adaptive','frequency','random'].includes(settings.mode))settings.mode='adaptive';
if(!['all','upper','lower'].includes(settings.set))settings.set='all';
if(!Array.isArray(settings.enabled))settings.enabled=[...CHARACTERS];
settings.enabled=settings.enabled.filter(c=>CHARACTERS.includes(c));if(!settings.enabled.length)settings.enabled=[...CHARACTERS];
let current='',attemptVisible=settings.visible,strokes=[],active=null,graded=false,busy=false,referencePoints=[],worker=null;
const draw=$('drawing'),ctx=draw.getContext('2d');
const label=c=>c==='s-round'?'s rund (s)':c==='s'?'s scharf (ſ)':c;
const mean=(a,k)=>a.length?a.reduce((s,h)=>s+h[k],0)/a.length:0;
const signed=(n,unit='°')=>(n>0?'+':'')+n.toFixed(1)+unit;
function persist(){try{localStorage.setItem(KEY,JSON.stringify({version:1,history,settings}));}catch{$('storageMessage').textContent='Browser storage is unavailable or full. Export progress to keep a backup.';}}
function enabled(){return CHARACTERS.filter(c=>settings.enabled.includes(c)&&(settings.set==='all'||(settings.set==='lower'?c===c.toLowerCase():c===c.toUpperCase())));}
function visible(){ $('reference').hidden=!settings.visible;$('hiddenNote').hidden=settings.visible;$('visibility').textContent='Reference: '+(settings.visible?'visible':'hidden');$('visibility').setAttribute('aria-pressed',settings.visible);}
function extract(canvas){const w=canvas.width,h=canvas.height,data=canvas.getContext('2d').getImageData(0,0,w,h).data,a=new Uint8Array(w*h);for(let i=0;i<a.length;i++)a[i]=data[i*4+3]>100&&data[i*4]<180?1:0;const s=thin(a,w,h),p=[];for(let y=0;y<h;y++)for(let x=0;x<w;x++)if(s[y*w+x])p.push([x,y]);return p;}
function glyph(){
 const c=$('reference'),g=c.getContext('2d'),text=current==='s-round'?'$':current==='tz'?'ú':current;
 g.clearRect(0,0,c.width,c.height);g.font='270px Kurrent';g.fillStyle='#263d39';
 let m=g.measureText(text),w=m.actualBoundingBoxLeft+m.actualBoundingBoxRight,h=m.actualBoundingBoxAscent+m.actualBoundingBoxDescent;
 const fit=Math.min(1,(c.width-50)/w,(c.height-50)/h);g.font=(270*fit)+'px Kurrent';m=g.measureText(text);w=m.actualBoundingBoxLeft+m.actualBoundingBoxRight;h=m.actualBoundingBoxAscent+m.actualBoundingBoxDescent;
 g.fillText(text,(c.width-w)/2+m.actualBoundingBoxLeft,(c.height-h)/2+m.actualBoundingBoxAscent);
 const small=document.createElement('canvas');small.width=176;small.height=152;small.getContext('2d').drawImage(c,0,0,176,152);referencePoints=extract(small);
 $('letterName').textContent=label(current)+' · '+(current===current.toLowerCase()?'lowercase':'uppercase');visible();
}
function redraw(){
 ctx.clearRect(0,0,draw.width,draw.height);ctx.lineWidth=4;ctx.lineCap='round';ctx.lineJoin='round';ctx.strokeStyle='#294f47';ctx.fillStyle='#294f47';
 for(const stroke of strokes){if(stroke.length===1){ctx.beginPath();ctx.arc(...stroke[0],2,0,Math.PI*2);ctx.fill();}else{ctx.beginPath();ctx.moveTo(...stroke[0]);for(const p of stroke.slice(1))ctx.lineTo(...p);ctx.stroke();}}
 $('drawHint').hidden=strokes.length>0;$('check').disabled=!strokes.length||busy;$('undo').disabled=graded||busy||!strokes.length;$('clear').disabled=busy;
}
function reset(){strokes=[];active=null;graded=false;attemptVisible=settings.visible;$('feedback').hidden=true;$('next').hidden=true;$('check').hidden=false;redraw();}
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
$('undo').onclick=()=>{if(!graded&&!busy){strokes.pop();redraw();}};
$('clear').onclick=()=>{if(!busy)reset();};$('next').onclick=()=>next();
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
function overlay(r){const c=$('overlay'),g=c.getContext('2d');g.clearRect(0,0,c.width,c.height);for(const [points,color]of [[r.reference,'#bb854bb0'],[r.aligned,'#206e76b0']]){g.fillStyle=color;for(const [x,y]of points){g.beginPath();g.arc(x*2.25+24,y*2.05+10,1.65,0,Math.PI*2);g.fill();}}}
function span(ps){let minX=Infinity,minY=Infinity,maxX=-Infinity,maxY=-Infinity;for(const[x,y]of ps){minX=Math.min(minX,x);minY=Math.min(minY,y);maxX=Math.max(maxX,x);maxY=Math.max(maxY,y);}return Math.max(maxX-minX,maxY-minY);}
function showResult(r,drawing){
 const prior=history.filter(h=>h.char===current&&h.visible===attemptVisible).slice(-10),wrap=$('referenceWrap');
 const refScale=Math.min(wrap.clientWidth/440,wrap.clientHeight/380),sizeRatio=span(drawing)*draw.getBoundingClientRect().width/192/(span(referencePoints)*2.5*refScale);
 history.push({char:current,score:r.score,error:r.error,rotation:r.rotation,skew:r.skew,widthRatio:r.widthRatio,sizeRatio,structure:r.structure||null,visible:attemptVisible,date:new Date().toISOString()});persist();graded=true;redraw();
 $('feedback').hidden=false;$('next').hidden=false;$('check').hidden=true;$('score').textContent=r.score.toFixed(1);
 $('comparison').textContent=prior.length?`${signed(r.score-mean(prior,'score'),' points')} versus your previous ${prior.length} ${attemptVisible?'visible-reference':'memory'} attempts at ${label(current)}. Rotation changed ${signed(r.rotation-mean(prior,'rotation'))}; skew changed ${signed(r.skew-mean(prior,'skew'))}; width changed ${signed((r.widthRatio-mean(prior,'widthRatio'))*100,' percentage points')}.`:'Your first '+(attemptVisible?'visible-reference':'memory')+' attempt at '+label(current)+'. A baseline for next time.';
 $('deviations').textContent=`Before alignment: rotation ${signed(r.rotation)}, skew ${signed(r.skew)}, width ${Math.round(r.widthRatio*100)}% of reference proportions, overall size ${Math.round(sizeRatio*100)}% of the displayed exemplar. Remaining shape error: ${r.error.toFixed(2)} px.`;
 const feature=r.structure;
 $('structureFeedback').textContent=feature?('Structure feedback (experimental): '+feature.messages.join('; ')+'. Corners '+feature.drawingCorners+'/'+feature.referenceCorners+'; loops '+feature.drawingLoops+'/'+feature.referenceLoops+' (drawn/reference). The visual score above is unchanged.'):'Structure feedback needs a saved, confirmed motion for this letter. Import a desktop progress file containing confirmed motions to enable it.';
 const previous=prior.filter(h=>h.structure?.version===1);
 if(feature&&previous.length){const old=previous.at(-1).structure;$('structureFeedback').textContent+=' Compared with your last assessed attempt: missing corners '+(feature.missingCorners-old.missingCorners)+'; missing loops '+(feature.missingLoops-old.missingLoops)+'; reversed strokes '+(feature.reversedStrokes-old.reversedStrokes)+'.';}
 overlay(r);stats();
}
$('check').onclick=()=>{
 if(!strokes.length||busy||active)return;busy=true;for(const id of ['mode','set','visibility','lettersToggle','allLetters'])$(id).disabled=true;redraw();$('check').textContent='Aligning…';
 const small=document.createElement('canvas');small.width=192;small.height=126;small.getContext('2d').drawImage(draw,0,0,192,126);const drawing=extract(small);
 let timer;
 function done(){clearTimeout(timer);worker?.terminate();worker=null;busy=false;for(const id of ['mode','set','visibility','lettersToggle','allLetters'])$(id).disabled=false;$('check').textContent='Check drawing →';redraw();}
 function fail(message){done();$('storageMessage').textContent=message;}
 try{worker=new Worker('./worker.js',{type:'module'});timer=setTimeout(()=>fail('Comparison took too long. Please try again.'),30000);
 worker.onerror=()=>fail('Comparison could not run. Reload the app and try again.');
 worker.onmessage=({data})=>{if(data.error){fail(data.error);return;}done();showResult(data.result,drawing);};const entry=motionEditor.exportData()[current];let motion=null;
 if(entry?.confirmed){const guides=entry.guides?resolveAttachments(entry.guides,entry.guideCorners||[],entry.strokeIds||[],entry.pointIds||[],entry.attachments||[]):null;
 motion=(guides?guides.map((p,i)=>sampleCurve(p,entry.guideCorners?.[i])):entry.strokes).map(p=>p.map(([x,y])=>[(x-82.4)/2.7,(y-34.8)/2.7]));}
 worker.postMessage({reference:referencePoints,drawing,motion,strokes:strokes.map(p=>p.map(([x,y])=>[x*192/draw.width,y*126/draw.height]))});
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
try{await document.fonts.load('270px Kurrent');if(!document.fonts.check('270px Kurrent'))throw Error();renderLetters();stats();next();}catch{$('storageMessage').textContent='The Kurrent font could not load. Reconnect, reopen the app and wait for offline setup.';$('check').disabled=true;}
