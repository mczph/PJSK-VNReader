import React,{useEffect,useRef,useState} from 'react';
import {updateScene,soundEffectPath,moviePath} from '../server/story.js';
import {sampleCurve} from './cubism-curves.js';
import {runSnippets} from './snippet-timeline';
import {audioContext} from './audio';

let sdkPromise;
async function sdk(){
 if(!sdkPromise)sdkPromise=(async()=>{
  if(!window.Live2DCubismCore)await new Promise((resolve,reject)=>{const s=document.createElement('script');s.src='/api/runtime/cubism';s.onload=resolve;s.onerror=()=>reject(new Error('Cubism 运行库下载失败'));document.head.appendChild(s);});
  const PIXI=await import('pixi.js');window.PIXI=PIXI;
  const {Live2DModel,Cubism4ModelSettings}=await import('pixi-live2d-display/cubism4');return {PIXI,Live2DModel,Cubism4ModelSettings};
 })().catch(e=>{sdkPromise=null;throw e;});return sdkPromise;
}
const pos={1:-.3,2:-.1,3:.28,4:.5,6:1.1,7:.72,9:.28,10:.5,12:.72};
const empty={actors:{},camera:{x:0,y:0,zoom:1}};
const url=(r,p)=>`/assets/${r}/${p}`;
const profiles={eco:{fps:30,resolution:1},balanced:{fps:60,resolution:1.5},quality:{fps:60,resolution:2}};
export default function StoryStage({story,line,index,restore,skip,paused,settings,voicesRef,onBusy,onWarning,onSceneChange,textVisible=0}){
 const host=useRef(null),cover=useRef(null),world=useRef(null),video=useRef(null),movieDone=useRef(false),runtime=useRef(null),pausedRef=useRef(paused),settingsRef=useRef(settings),sceneRef=useRef(line.scene || empty),runRef=useRef(null);
 const [loaded,setLoaded]=useState(null),[scene,setScene]=useState(line.before || empty),[movie,setMovie]=useState(''),[loading,setLoading]=useState('准备角色…'),[telop,setTelop]=useState(''),[shake,setShake]=useState('');
 const ready=loaded?.story===story && loaded?.enabled===settings.live2d;
 pausedRef.current=paused;settingsRef.current=settings;
 function show(s){sceneRef.current=s;setScene(structuredClone(s));onSceneChange?.({bgm:s.bgm || '',volume:s.bgmVolume ?? 1,duration:s.bgmDuration || 0});}
 function position(model,actor){
  const app=runtime.current?.app;if(!app)return;
  const h=app.screen.height,w=app.screen.width;
  // Full model is about 1.9 stage heights: matches the game's waist-up framing.
  const scale=h*1.9/model.internalModel.height*(sceneRef.current.modelMode===3?.83:1);
  model.scale.set(scale);model.anchor.set(.5,.5);
  model.position.set(w*(pos[actor.side] ?? .5)+(actor.offset || 0)*w/1920,h*.91+([9,10,12].includes(actor.side)?h:0));
 }
 function paint(s,instant=false){
  const rt=runtime.current;if(!rt)return;
  for(const item of rt.models.values()){
   const actor=Object.values(s.actors).find(a=>a.costume===item.costume);
   item.model.visible=!!actor;
   if(!actor)continue;position(item.model,actor);item.model.alpha=1;item.model.zIndex=10-(actor.depth || 0);item.model.tint=s.ambient==='night'?0xa9b8eb:s.ambient==='evening'?0xffd8ab:0xffffff;
   applyPose(item,actor,instant);
  }
 }
 function applyPose(item,actor,instant=false){
  const model=item.model,defs=item.manifest.FileReferences.Motions;
  if(actor.motion && (item.motion!==actor.motion || instant || item.frozenMotion)){
   item.motion=actor.motion;
   item.frozenMotion=instant;
   const i=defs.Motion.findIndex(m=>m.Name===actor.motion);
   if(i>=0){if(instant){model.internalModel.motionManager.stopAllMotions();const motion=item.motionData.get(actor.motion);if(motion)for(const curve of motion.Curves || [])if(curve.Target==='Parameter')model.internalModel.coreModel.setParameterValueById(curve.Id,sampleCurve(curve.Segments,motion.Meta.Duration));}else model.motion('Motion',i,3).catch(()=>{});}
  }
  if(actor.facial && (item.facial!==actor.facial || instant)){item.facial=actor.facial;item.faceStart=instant?-Infinity:performance.now();}
 }
 useEffect(()=>{
  let cancelled=false;setLoaded(null);onBusy(true);const localModels=[];
  (async()=>{
   if(settings.live2d===false){setLoading('');setLoaded({story,enabled:settings.live2d});return;}
   const {PIXI,Live2DModel,Cubism4ModelSettings}=await sdk();if(cancelled)return;
   const profile=profiles[settingsRef.current.performance] || profiles.balanced;
   const app=new PIXI.Application({backgroundAlpha:0,antialias:true,resizeTo:host.current,resolution:Math.min(window.devicePixelRatio || 1,profile.resolution),autoDensity:true});
   app.ticker.maxFPS=profile.fps;
   const rt={app,models:new Map(),pending:new Map(),audio:null,sources:new WeakMap(),se:new Map()};runtime.current=rt;app.stage.sortableChildren=true;host.current.appendChild(app.view);
   app.ticker.add(()=>{for(const {model} of rt.models.values())if(model.visible)model.update(app.ticker.deltaMS);},null,PIXI.UPDATE_PRIORITY.HIGH);
   const observer=new ResizeObserver(()=>{if(!cancelled){app.resize();paint(sceneRef.current,true);}});observer.observe(host.current);rt.observer=observer;
   rt.ensureModel=costume=>{
    if(rt.pending.has(costume))return rt.pending.get(costume);
    if(cancelled || rt.models.has(costume))return Promise.resolve();
    const definition=story.live2d?.find(d=>d.costume===costume);if(!definition)return Promise.resolve();
    const pending=(async()=>{
    setLoading(`载入出场角色 ${definition.id}`);
    try{
     const modelSettings=new Cubism4ModelSettings({...definition.manifest,url:location.origin+'/model.model3.json'});
     // The library's legacy URL resolver drops the host for custom desktop schemes.
     modelSettings.resolveURL=p=>new URL(p,modelSettings.url).href;
     const model=await Live2DModel.from(modelSettings,{autoUpdate:false,autoInteract:false,autoHitTest:false,autoFocus:false,motionPreload:'NONE'});
     if(cancelled){model.destroy({texture:true,baseTexture:true});return;}
     const item={...definition,model,motionData:new Map(),motion:'',facial:'',faceStart:0};localModels.push(model);rt.models.set(item.costume,item);model.visible=false;app.stage.addChild(model);
     await Promise.all([...definition.manifest.FileReferences.Motions.Motion,...definition.manifest.FileReferences.Motions.Expression].map(async m=>{try{const r=await fetch(m.File);if(r.ok)item.motionData.set(m.Name,await r.json());}catch{}}));
     model.internalModel.on('afterMotionUpdate',()=>{if(item.frozenMotion){const motion=item.motionData.get(item.motion);if(motion)for(const curve of motion.Curves || [])if(curve.Target==='Parameter')model.internalModel.coreModel.setParameterValueById(curve.Id,sampleCurve(curve.Segments,motion.Meta.Duration));}});
     model.internalModel.on('beforeModelUpdate',()=>{
      const core=model.internalModel.coreModel,face=item.motionData.get(item.facial);
      if(face){const t=Math.min(face.Meta.Duration,(performance.now()-item.faceStart)/1000);for(const c of face.Curves || [])if(c.Target==='Parameter')core.setParameterValueById(c.Id,sampleCurve(c.Segments,t));}
      const voice=(voicesRef.current || []).find(a=>a.dataset.character===String(item.id)&&!a.paused&&!a.ended);
      let mouth=0;
      if(voice){
       try{if(!rt.audio){const ctx=audioContext();if(!ctx||ctx.state!=='running')return;rt.audio={ctx};}if(!rt.sources.has(voice)){const source=rt.audio.ctx.createMediaElementSource(voice),analyser=rt.audio.ctx.createAnalyser();analyser.fftSize=256;source.connect(analyser);analyser.connect(rt.audio.ctx.destination);rt.sources.set(voice,{analyser,buffer:new Uint8Array(analyser.fftSize)});}
        const {analyser,buffer}=rt.sources.get(voice);analyser.getByteTimeDomainData(buffer);mouth=Math.min(1,Math.sqrt(buffer.reduce((n,v)=>n+(v-128)**2,0)/buffer.length)/24);
       }catch{}
      }
      core.setParameterValueById('ParamMouthOpenY',mouth);
     });
    }catch(e){if(!cancelled)onWarning(`角色 ${definition.costume} 加载失败：${e.message}`);}
    if(!cancelled){host.current.dataset.models=String(rt.models.size);setLoading('');}
    })();rt.pending.set(costume,pending);return pending;
   };
   await Promise.all(Object.values(line.before?.actors || {}).map(a=>rt.ensureModel(a.costume)));
   if(pausedRef.current)app.ticker.stop();
   if(!cancelled){host.current.dataset.models=String(rt.models.size);setLoading('');setLoaded({story,enabled:settings.live2d});}
  })().catch(e=>{if(!cancelled){setLoading('');onWarning(e.message);setLoaded({story,enabled:settings.live2d});}});
  return()=>{cancelled=true;runRef.current?.abort();const rt=runtime.current;if(rt){rt.observer?.disconnect();rt.se.forEach(a=>a.pause());localModels.forEach(m=>m.destroy({texture:true,baseTexture:true}));rt.app.destroy(true,{children:true,texture:true,baseTexture:true});runtime.current=null;}};
 },[story,settings.live2d]);
 useEffect(()=>{const rt=runtime.current;if(rt){if(paused)rt.app.ticker.stop();else rt.app.ticker.start();rt.se.forEach(a=>{if(paused)a.pause();else if(a.loop)a.play().catch(()=>{});});}if(video.current){if(paused)video.current.pause();else video.current.play().catch(()=>{});}},[paused,ready]);
 useEffect(()=>{const rt=runtime.current;if(!rt)return;const profile=profiles[settings.performance] || profiles.balanced;rt.app.ticker.maxFPS=profile.fps;rt.app.renderer.resolution=Math.min(window.devicePixelRatio || 1,profile.resolution);rt.app.resize();host.current.dataset.fps=String(profile.fps);host.current.dataset.resolution=String(rt.app.renderer.resolution);},[settings.performance,ready]);
 useEffect(()=>{
  if(!ready)return;
  runRef.current?.abort();const controller=new AbortController();runRef.current=controller;const {signal}=controller;
  const animations=new Set(),sounds=new Set();setMovie('');setTelop('');setShake('');onBusy(true);
  function tween(duration,fn){return new Promise(resolve=>{let last=performance.now(),elapsed=0;function step(now){if(signal.aborted){resolve();return;}const delta=Math.min(100,now-last);last=now;if(!pausedRef.current)elapsed+=delta;const p=Math.min(1,elapsed/Math.max(1,duration));fn(p);if(p<1)requestAnimationFrame(step);else resolve();}requestAnimationFrame(step);});}
  const wait=ms=>tween(ms,()=>{});
  async function effect(d){
   const type=d.EffectType,ms=Math.max(0,(d.Duration || 0)*1000);const s=sceneRef.current;
   if([1,2,3,4,20,21,29,30,31,32,33,34,35,36,40,41].includes(type)&&cover.current){
    const incoming=[1,3,20,29,31,33,35,40].includes(type),white=[3,4,20,21,40,41].includes(type),wipe=type>=29&&type<=36;
    cover.current.style.background=white?'white':'black';cover.current.style.clipPath='none';
    await tween(ms,p=>{cover.current.style.opacity=wipe?'1':String(incoming?1-p:p);if(wipe){const a=(incoming?p:1-p)*100;cover.current.style.clipPath=type<=30?`inset(0 0 0 ${a}%)`:type<=32?`inset(0 ${a}% 0 0)`:type<=34?`inset(${a}% 0 0 0)`:`inset(0 0 ${a}% 0)`;}});
    if(!signal.aborted){cover.current.style.clipPath='none';cover.current.style.opacity=incoming?'0':'1';}
   }else if(type===5 || type===6){setShake(type===5?'world':'dialogue');await wait(ms || 600);if(!signal.aborted)setShake('');}
   else if(type===25 || type===26)setShake('');
   else if(type===8 || type===18){setTelop(d.StringVal);await wait(ms || 1500);if(!signal.aborted)setTelop('');}
   else if(type===19){movieDone.current=false;setMovie(url(story.region,moviePath(d.StringVal)));await new Promise(resolve=>{const tick=setInterval(()=>{if(signal.aborted || movieDone.current || video.current?.ended || video.current?.error){clearInterval(tick);resolve();}},100);signal.addEventListener('abort',()=>{clearInterval(tick);resolve();},{once:true});});if(!signal.aborted)setMovie('');}
   else {updateScene(s,{kind:'effect',data:d});show(s);paint(s);if(type!==24&&ms)await wait(ms);}
   if(!signal.aborted){updateScene(s,{kind:'effect',data:d});show(s);paint(s);}
  }
  function sound(d){const rt=runtime.current;if(!d.Se)return Promise.resolve();const key=d.Se;if(d.PlayMode===3){rt?.se.get(key)?.pause();rt?.se.delete(key);return Promise.resolve();}const a=new Audio(url(story.region,soundEffectPath(d)));a.volume=Math.min(1,(settingsRef.current.se ?? 70)/100*(d.Volume ?? 1));a.loop=d.PlayMode===2;sounds.add(a);if(a.loop)rt?.se.set(key,a);return a.play().catch(()=>{});}
  async function layout(d){const rt=runtime.current;const s=sceneRef.current,old=s.actors[d.Character2dId],item=rt?.models.get(d.CostumeType || old?.costume || s.cast?.[d.Character2dId]?.costume);updateScene(s,{kind:'layout',data:d});show(s);
   if(!item){paint(s);return;}const model=item.model,to=s.actors[d.Character2dId];
   if(d.Type===3){await tween(250,p=>model.alpha=1-p);if(!signal.aborted)model.visible=false;return;}
   if(!to){model.visible=false;return;}
   const from=old?{x:model.x,y:model.y}:null;model.visible=true;position(model,to);const dest={x:model.x,y:model.y};if(!from && d.SideFrom){position(model,{...to,side:d.SideFrom,offset:d.SideFromOffsetX});}const start=from || {x:model.x,y:model.y};applyPose(item,to);
   const duration=d.Type===0?0:[900,500,250][d.MoveSpeedType ?? 1];await tween(duration,p=>{model.x=start.x+(dest.x-start.x)*p;model.y=start.y+(dest.y-start.y)*p;model.alpha=d.Type===2?p:1;});
  }
  (async()=>{
   const rt=runtime.current,costumes=new Set([...Object.values(line.before?.actors || {}),...Object.values(line.scene?.actors || {})].map(a=>a.costume));
   for(const event of line.events || [])if(event.kind==='layout'){const d=event.data;costumes.add(d.CostumeType || line.scene?.cast?.[d.Character2dId]?.costume);}
   await Promise.all([...costumes].filter(Boolean).map(c=>rt?.ensureModel(c)));
   if(signal.aborted)return;
   const instant=restore || skip || settingsRef.current.effects===false;
   if(instant){show(structuredClone(line.scene));paint(sceneRef.current,true);if(cover.current){cover.current.style.opacity=sceneRef.current.cover?'1':'0';cover.current.style.background=sceneRef.current.cover || 'black';}return;}
   show(structuredClone(line.before));paint(sceneRef.current);
   if(cover.current){cover.current.style.clipPath='none';cover.current.style.opacity=sceneRef.current.cover?'1':'0';cover.current.style.background=sceneRef.current.cover || 'black';}
   await runSnippets(line.events || [],{signal,wait,run:event=>{
    if(event.kind==='effect')return effect(event.data);
    if(event.kind==='layout')return layout(event.data);
    if(event.kind==='sound'){updateScene(sceneRef.current,event);show(sceneRef.current);return sound(event.data);}
    updateScene(sceneRef.current,event);show(sceneRef.current);paint(sceneRef.current);
   }});
   if(!signal.aborted){show(structuredClone(line.scene));paint(sceneRef.current);if(cover.current){cover.current.style.opacity=sceneRef.current.cover?'1':'0';cover.current.style.background=sceneRef.current.cover || 'black';cover.current.style.clipPath='none';}}
  })().catch(e=>{if(!signal.aborted)onWarning('演出执行失败：'+e.message);}).finally(()=>{if(!signal.aborted)onBusy(false);});
  return()=>{controller.abort();animations.forEach(a=>a.cancel());sounds.forEach(a=>{if(!a.loop)a.pause();});};
 },[ready,line,index,restore,skip,settings.effects]);
 const camera=scene.camera || empty.camera;
 return <div className="story-stage" data-ready={ready} data-paused={paused} data-actors={Object.keys(scene.actors || {}).length} data-background={scene.background} data-shake={shake} data-memory={scene.memory} data-camera={scene.camera?.zoom} data-particles={scene.particles}>
  <div className="stage-visual-frame"><div ref={world} className={'stage-world '+(shake==='world'?'shaking':'')} style={{transform:`translate(${camera.x*100}%,${camera.y*100}%) scale(${camera.zoom})`,transition:`transform ${restore||skip?0:(camera.duration || 0.6)}s`,filter:scene.memory?'sepia(.55)':undefined}}>
   <div className="stage-background" style={{backgroundImage:scene.background?`url("${url(story.region,`scenario/background/${scene.background}/${scene.background}.webp`)}")`:undefined,filter:scene.textScreen?'blur(6px) brightness(.6)':scene.blur?'blur(6px)':undefined}}/>
   <div className="live2d-host" ref={host}/>
   {scene.particles&&<div className={'scenario-particles '+(/kirakira/.test(scene.particles)?'sparkles':/line/.test(scene.particles)?'speed-lines':/light/.test(scene.particles)?'light-rays':'dim-overlay')} aria-hidden="true">{Array.from({length:24},(_,i)=><i key={i} style={{'--i':i,left:((i*37)%100)+'%',top:((i*23)%100)+'%',animationDelay:-i*.19+'s',backgroundImage:story.effectAssets?.[scene.particles]?.textures?.[0]?`url("${story.effectAssets[scene.particles].textures[0]}")`:undefined}}/>)}</div>}
  </div>
  </div>
  <div ref={cover} className="stage-cover"/>
  {scene.fullText&&<div className="fullscreen-text" style={{fontFamily:'var(--novel-font)',fontSize:settings.font}}>{line.kind==='fullscreen'?scene.fullText?.replace(/<[^>]+>/g,'').slice(0,textVisible):scene.fullText}</div>}
  {telop&&<div className="stage-telop">{telop}</div>}
  {movie&&<video className="stage-movie" ref={video} src={movie} autoPlay playsInline controls onEnded={()=>{movieDone.current=true;}} onError={()=>{movieDone.current=true;setMovie('');onWarning('章节视频不可用，继续播放剧情。');}}/>}
  {loading&&<div className="stage-loading">{loading}</div>}
 </div>;
}
