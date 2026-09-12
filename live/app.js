/* ECHOES OF LIGHT: local, dependency-free interactive Kerr renderer. */
(() => {
'use strict';
const $=id=>document.getElementById(id),canvas=$('cosmos');
$('controls-toggle').addEventListener('click',()=>{const collapsed=document.body.classList.toggle('controls-hidden');$('controls-toggle').setAttribute('aria-expanded',String(!collapsed));});
$('fullscreen').addEventListener('click',()=>{if(document.fullscreenElement)document.exitFullscreen();else document.documentElement.requestFullscreen().catch(()=>{});});
$('about-open').addEventListener('click',()=>$('about').showModal());$('about-close').addEventListener('click',()=>$('about').close());
const gl=canvas.getContext('webgl2',{alpha:false,antialias:false,preserveDrawingBuffer:true,powerPreference:'high-performance'});
if(!gl||!gl.getExtension('EXT_color_buffer_float')){
 $('loading').textContent='This live renderer requires WebGL 2 with floating-point color buffers. The 6K still remains available under “Study & source”.';return;
}
const defaults={elevation:15,azimuth:0,roll:13,width:55,time:0,speed:1800,exposure:0,bloom:20,quality:'balanced',spectrum:'euv',mode:0,highlight:false};
const state={...defaults,playing:!matchMedia('(prefers-reduced-motion: reduce)').matches};
let transfer=null,light=null,spectra={},profile,lastFrame=performance.now(),frameCount=0,fpsStamp=lastFrame;
let dragging=false,probe=null,traceCount=0,traceMs=0,lastMode='',tourStart=null;
const rad=d=>d*Math.PI/180,clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
function shader(type,src){const s=gl.createShader(type);gl.shaderSource(s,src);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(s));return s;}
function program(src){const p=gl.createProgram();gl.attachShader(p,shader(gl.VERTEX_SHADER,ECHO_SHADERS.vertex));gl.attachShader(p,shader(gl.FRAGMENT_SHADER,src));gl.linkProgram(p);if(!gl.getProgramParameter(p,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(p));return {p,loc:new Map()};}
function uniform(p,name,value){let u=p.loc.get(name);if(u===undefined){u=gl.getUniformLocation(p.p,name);p.loc.set(name,u);}if(Array.isArray(value))gl.uniform2fv(u,value);else gl.uniform1f(u,value);}
function integer(p,name,value){let u=p.loc.get(name);if(u===undefined){u=gl.getUniformLocation(p.p,name);p.loc.set(name,u);}gl.uniform1i(u,value);}
function texture(w,h,data=null,half=false){const t=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,t);gl.texImage2D(gl.TEXTURE_2D,0,half?gl.RGBA16F:gl.RGBA32F,w,h,0,gl.RGBA,gl.FLOAT,data);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,half?gl.LINEAR:gl.NEAREST);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,half?gl.LINEAR:gl.NEAREST);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);return t;}
function target(w,h,count=1,half=false){const f=gl.createFramebuffer(),tex=[];gl.bindFramebuffer(gl.FRAMEBUFFER,f);for(let k=0;k<count;k++){tex.push(texture(w,h,null,half));gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0+k,gl.TEXTURE_2D,tex[k],0);}gl.drawBuffers(tex.map((_,k)=>gl.COLOR_ATTACHMENT0+k));if(gl.checkFramebufferStatus(gl.FRAMEBUFFER)!==gl.FRAMEBUFFER_COMPLETE)throw Error('Floating-point framebuffer is incomplete');return {f,tex,w,h};}
function free(t){if(!t)return;gl.deleteFramebuffer(t.f);t.tex.forEach(x=>gl.deleteTexture(x));}
function bind(p,name,t,unit){gl.activeTexture(gl.TEXTURE0+unit);gl.bindTexture(gl.TEXTURE_2D,t);integer(p,name,unit);}
let traceProgram,shadeProgram,postProgram;
try{
 traceProgram=program(ECHO_SHADERS.trace);shadeProgram=program(ECHO_SHADERS.shade);postProgram=program(ECHO_SHADERS.post);
 const a=new Float32Array(4096*4);ECHO_SPECTRA.profile.forEach((v,i)=>a[i*4]=v);profile=texture(4096,1,a);
 for(const name of ['euv','visible']){const a=new Float32Array(2048*4);for(let k=0;k<2048;k++)for(let c=0;c<3;c++)a[k*4+c]=ECHO_SPECTRA[name][k*3+c];spectra[name]=texture(2048,1,a);}
}catch(e){$('loading').textContent='Renderer could not start: '+e.message;console.error(e);return;}
function setUI(){
 for(const id of ['elevation','azimuth','roll','exposure','bloom','speed','quality','spectrum','mode'])$(id).value=state[id];
 $('elevation-value').textContent=state.elevation.toFixed(1)+'°';$('azimuth-value').textContent=state.azimuth.toFixed(0)+'°';$('roll-value').textContent=state.roll.toFixed(0)+'°';$('exposure-value').textContent=(state.exposure>=0?'+':'')+state.exposure.toFixed(1)+' EV';
 $('bloom-value').textContent=Math.round(state.bloom)+'%';$('highlight').checked=state.highlight;
 $('pause').textContent=state.playing?'Ⅱ Pause':'▶ Play';$('pause').setAttribute('aria-pressed',String(!state.playing));
 $('band').textContent=state.spectrum==='euv'?'EUV · FALSE COLOR':'VISIBLE SPECTRUM';
 $('compression').textContent=state.speed===1?'Real time':`1 second = ${state.speed/60} min`;
 $('timeline').value=state.time/3600;$('time-value').textContent=(state.time>=0?'+':'−')+Math.abs(state.time/3600).toFixed(2)+' h';
 $('view-value').textContent=`${state.width.toFixed(1)} rg field`;
}
function invalidate(keepTour=false){if(!keepTour&&tourStart!==null){tourStart=null;$('tour').textContent='Guided orbit';}probe=null;$('probe').hidden=true;}
function resize(){const rect=canvas.getBoundingClientRect();const dpr=Math.min(devicePixelRatio,1.5);const w=Math.round(rect.width*dpr),h=Math.round(rect.height*dpr);if(canvas.width!==w||canvas.height!==h){canvas.width=w;canvas.height=h;invalidate();}}
new ResizeObserver(resize).observe(canvas);resize();
function rayMap(){
 // Keep the chosen spatial and integration precision during all camera motion.
 const maxWidth=({fast:560,balanced:1000,fine:1600}[state.quality]);
 const w=Math.min(canvas.width,maxWidth),h=Math.max(1,Math.round(w*canvas.height/canvas.width));
 // Kerr axisymmetry lets azimuth changes reuse the exact transfer map.
 const mode=`${w},${h},${state.elevation},${state.width},${state.roll}`;
 if(lastMode===mode)return;
 if(!transfer||transfer.w!==w||transfer.h!==h){free(transfer);free(light);transfer=target(w,h,2);light=target(w,h,1,true);}
 const start=performance.now();gl.bindFramebuffer(gl.FRAMEBUFFER,transfer.f);gl.viewport(0,0,w,h);gl.useProgram(traceProgram.p);
 uniform(traceProgram,'uSize',[w,h]);uniform(traceProgram,'uWidth',state.width);uniform(traceProgram,'uInclination',rad(90-state.elevation));uniform(traceProgram,'uRoll',rad(state.roll));uniform(traceProgram,'uStep',.028);
 gl.drawArrays(gl.TRIANGLES,0,3);traceCount++;traceMs=performance.now()-start;lastMode=mode;
 $('resolution').textContent=`${w} × ${h} rays`;$('loading').hidden=true;
}
function draw(){
 gl.bindFramebuffer(gl.FRAMEBUFFER,light.f);gl.viewport(0,0,light.w,light.h);gl.useProgram(shadeProgram.p);
 bind(shadeProgram,'uHit',transfer.tex[0],0);bind(shadeProgram,'uPath',transfer.tex[1],1);bind(shadeProgram,'uProfile',profile,2);bind(shadeProgram,'uSpectrum',spectra[state.spectrum],3);
 uniform(shadeProgram,'uTime',state.time/492.563989396);uniform(shadeProgram,'uAzimuth',rad(state.azimuth));uniform(shadeProgram,'uHighlight',state.highlight?1:0);integer(shadeProgram,'uMode',state.mode);gl.drawArrays(gl.TRIANGLES,0,3);
 gl.bindFramebuffer(gl.FRAMEBUFFER,null);gl.viewport(0,0,canvas.width,canvas.height);gl.useProgram(postProgram.p);bind(postProgram,'uColor',light.tex[0],0);
 uniform(postProgram,'uSize',[light.w,light.h]);uniform(postProgram,'uExposure',1.25*Math.pow(2,state.exposure));uniform(postProgram,'uBloom',state.mode>2?0:state.bloom/100);gl.drawArrays(gl.TRIANGLES,0,3);
}
function frame(now){
 if(document.hidden){lastFrame=now;requestAnimationFrame(frame);return;}
 const dt=(now-lastFrame)/1000;lastFrame=now;
 if(state.playing){state.time+=dt*state.speed;if(state.time/3600>+$('timeline').max)$('timeline').max=Math.ceil(state.time/86400)*24; $('timeline').value=state.time/3600;}
 if(tourStart!==null){
  const t=(now-tourStart)/1000,keys=[[0,18,0,65,10],[12,6,22,47,13],[26,-12,42,35,13],[40,15,70,24,13]];
  if(t>=40){[state.elevation,state.azimuth,state.width,state.roll]=keys[3].slice(1);invalidate(true);tourStart=null;$('tour').textContent='Guided orbit';}
  else{let j=0;while(j<2&&t>keys[j+1][0])j++;const a=keys[j],b=keys[j+1];let f=clamp((t-a[0])/(b[0]-a[0]),0,1);f=f*f*(3-2*f);
   [state.elevation,state.azimuth,state.width,state.roll]=a.slice(1).map((x,k)=>x+(b[k+1]-x)*f);invalidate(true);}
 }
 rayMap();draw();frameCount++;
 if(now-fpsStamp>750){$('fps').textContent=Math.round(frameCount*1000/(now-fpsStamp))+' fps';fpsStamp=now;frameCount=0;setUI();updateProbe();$('renderer-state').textContent=`GPU Kerr · ${traceCount} camera passes`;
 }
 requestAnimationFrame(frame);
}
document.addEventListener('visibilitychange',()=>{lastFrame=performance.now();});
function inspect(clientX,clientY){
 const rect=canvas.getBoundingClientRect(),x=clamp(Math.floor((clientX-rect.left)/rect.width*transfer.w),0,transfer.w-1),y=clamp(Math.floor((1-(clientY-rect.top)/rect.height)*transfer.h),0,transfer.h-1);
 const hit=new Float32Array(4),path=new Float32Array(4);gl.bindFramebuffer(gl.FRAMEBUFFER,transfer.f);gl.readBuffer(gl.COLOR_ATTACHMENT0);gl.readPixels(x,y,1,1,gl.RGBA,gl.FLOAT,hit);gl.readBuffer(gl.COLOR_ATTACHMENT1);gl.readPixels(x,y,1,1,gl.RGBA,gl.FLOAT,path);gl.readBuffer(gl.COLOR_ATTACHMENT0);gl.bindFramebuffer(gl.FRAMEBUFFER,null);
 probe={hit,path};$('probe').hidden=false;updateProbe();
}
function updateProbe(){if(!probe)return;const {hit:h,path:p}=probe;
 $('probe').dataset.ray=JSON.stringify({r:h[0],phi:h[1],delay:h[2],g:h[3],status:p[0],order:p[1]});
 if(p[0]===1){$('probe-title').textContent=p[1]===0?'Direct disk image':`Echo · ${Math.round(p[1])} prior equatorial crossing${p[1]>1?'s':''}`;$('probe-data').textContent=`r = ${h[0].toFixed(3)} rg  ·  g = ${h[3].toFixed(4)}  ·  emission coordinate ${((h[2]*492.563989396+state.time)/3600).toFixed(2)} h`;}
 else{$('probe-title').textContent=p[0]===0?'Captured ray':p[0]===2?'Lensed background':'Unresolved at this precision';$('probe-data').textContent=p[0]===0?'This ray reaches the dark horizon.':p[0]===2?'The ray escapes to the synthetic background sphere.':'Try Fine quality or move slightly away from this pixel.';}
}
const pointers=new Map();let down=null,pinch=0;
canvas.addEventListener('pointerdown',e=>{canvas.focus();canvas.setPointerCapture(e.pointerId);pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});down={x:e.clientX,y:e.clientY,time:performance.now()};dragging=true;pinch=0;});
canvas.addEventListener('pointermove',e=>{
 if(!pointers.has(e.pointerId))return;const old=pointers.get(e.pointerId);pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});
 if(pointers.size===2){const [a,b]=[...pointers.values()];const distance=Math.hypot(a.x-b.x,a.y-b.y);if(pinch)state.width=clamp(state.width*pinch/distance,10,100);pinch=distance;invalidate();}
 else{state.azimuth=(state.azimuth+(e.clientX-old.x)*.25+360)%360;state.elevation=clamp(state.elevation+(e.clientY-old.y)*.16,-85,85);invalidate();}setUI();
});
function release(e){if(!pointers.has(e.pointerId))return;pointers.delete(e.pointerId);dragging=pointers.size>0;if(down&&Math.hypot(e.clientX-down.x,e.clientY-down.y)<4&&performance.now()-down.time<450)inspect(e.clientX,e.clientY);down=null;}
canvas.addEventListener('pointerup',release);canvas.addEventListener('pointercancel',e=>{pointers.delete(e.pointerId);dragging=false;down=null;});
canvas.addEventListener('wheel',e=>{e.preventDefault();state.width=clamp(state.width*Math.exp(e.deltaY*.0012),10,100);invalidate();setUI();},{passive:false});
canvas.addEventListener('dblclick',()=>{state.width=24;invalidate();setUI();});
for(const id of ['elevation','roll'])$(id).addEventListener('input',e=>{state[id]=+e.target.value;invalidate();setUI();});
$('azimuth').addEventListener('input',e=>{state.azimuth=+e.target.value;if(tourStart!==null){tourStart=null;$('tour').textContent='Guided orbit';invalidate();}setUI();});
for(const id of ['exposure','bloom','speed'])$(id).addEventListener('input',e=>{state[id]=+e.target.value;setUI();});
$('quality').addEventListener('change',e=>{state.quality=e.target.value;});
$('spectrum').addEventListener('change',e=>{state.spectrum=e.target.value;setUI();});
$('mode').addEventListener('change',e=>{state.mode=+e.target.value;});
$('highlight').addEventListener('change',e=>{state.highlight=e.target.checked;});
$('timeline').addEventListener('input',e=>{state.playing=false;state.time=+e.target.value*3600;setUI();});
$('pause').addEventListener('click',()=>{state.playing=!state.playing;lastFrame=performance.now();setUI();});
function reset(){Object.assign(state,defaults);$('timeline').max=48;probe=null;invalidate();setUI();}
$('reset').addEventListener('click',reset);
$('tour').addEventListener('click',()=>{if(tourStart!==null){tourStart=null;$('tour').textContent='Guided orbit';}else{tourStart=performance.now();state.elevation=18;state.azimuth=0;state.width=65;state.roll=10;state.playing=true;$('tour').textContent='Stop guided orbit';invalidate(true);}setUI();});
for(const [id,elevation,roll,width] of [['wide',15,13,65],['underside',-12,13,35],['face',75,0,40],['echo',15,13,16]])$(id).addEventListener('click',()=>{state.elevation=elevation;state.roll=roll;state.width=width;invalidate();setUI();});
$('zoom-in').addEventListener('click',()=>{state.width=clamp(state.width*.82,10,100);invalidate();setUI();});
$('zoom-out').addEventListener('click',()=>{state.width=clamp(state.width/ .82,10,100);invalidate();setUI();});
$('snapshot').addEventListener('click',()=>{draw();canvas.toBlob(blob=>{if(!blob)return;const a=document.createElement('a');const url=URL.createObjectURL(blob);a.href=url;a.download='echoes-of-light-live.png';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);},'image/png');});
$('probe-close').addEventListener('click',()=>{probe=null;$('probe').hidden=true;});
document.addEventListener('keydown',e=>{
 if(['INPUT','SELECT','TEXTAREA'].includes(document.activeElement.tagName)||$('about').open)return;
 if(e.code==='Space'){e.preventDefault();$('pause').click();}
 else if(e.key.toLowerCase()==='r')reset();
 else if(e.key.toLowerCase()==='h')$('controls-toggle').click();
 else if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','+','-','='].includes(e.key)){
  e.preventDefault();if(e.key==='ArrowUp')state.elevation=clamp(state.elevation+3,-85,85);if(e.key==='ArrowDown')state.elevation=clamp(state.elevation-3,-85,85);if(e.key==='ArrowLeft')state.azimuth=(state.azimuth-5+360)%360;if(e.key==='ArrowRight')state.azimuth=(state.azimuth+5)%360;if(e.key==='+'||e.key==='=')state.width=clamp(state.width*.9,10,100);if(e.key==='-')state.width=clamp(state.width/ .9,10,100);invalidate();setUI();
 }
});
canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();$('loading').hidden=false;$('loading').textContent='Graphics context paused. Reload to resume the live renderer.';});
setUI();requestAnimationFrame(frame);
})();
