import React, { useEffect, useRef, useState, useMemo } from 'react';
import { createRoot } from 'react-dom/client';
import { BookOpen, Home, Settings, Save, Play, ArrowRight, ChevronLeft, ChevronRight, Search, Download, X, Volume2, List, FastForward, Maximize, Sparkles, Check, RotateCcw, Moon, Sun } from 'lucide-react';
import ChapterLibrary from './ChapterLibrary';
import NovelPlayer from './NovelPlayer';
import ReaderAppearance,{restoreFont} from './ReaderAppearance';
import Backlog from './Backlog';
import GameHome from './GameHome';
import SaveGrid,{SaveScreen} from './SaveGrid';
import {titleBgmPath} from '../server/unit-bgm.js';
import ResourceManager from './ResourceManager';
import {unlockAudio,disposeAudio} from './audio';
import {useMenuBgm} from './useUnitBgm';
import {shortcutAction} from './shortcuts';
import ThemeSettings from './ThemeSettings';
import GameSettings from './GameSettings';
import {voicePath} from '../server/story.js';
import './style.css';
import './enhancements.css';
import './visual-novel.css';
import './game-system.css';
import './story-menus.css';
import './resource-manager.css';
import './transitions.css';
import './cast-avatars.css';
import './presentation.css';

const units = {all:'全部组合',light_sound:'Leo/need',idol:'MORE MORE JUMP!',street:'Vivid BAD SQUAD',theme_park:'Wonderlands × Showtime',school_refusal:'25时，在Nightcord。',piapro:'VIRTUAL SINGER'};
const defaults={region:'jp',speed:35,autoDelay:2500,bgm:45,voice:80,se:70,font:24,theme:'light',live2d:true,effects:true,performance:'balanced',interruptVoice:true,rightClick:'hide',dialogueOpacity:78,fontFamily:'sans',characterColors:{},lineDelay:0,punctuationDelay:120,screenFit:'contain'};
function read(key,fallback){if(window.sekaiDesktop?.initialState?.[key]!==undefined)return window.sekaiDesktop.initialState[key];try{return JSON.parse(localStorage.getItem(key)) ?? fallback;}catch{return fallback;}}
function useStored(key,fallback){const [value,setValue]=useState(()=>{const saved=read(key,fallback);return key==='sekai.settings'?{...fallback,...saved}:saved;});useEffect(()=>{localStorage.setItem(key,JSON.stringify(value));window.sekaiDesktop?.writeState(key,value).catch(()=>{});},[key,value]);return [value,setValue];}
async function api(url,options){const r=await fetch(url,options);const data=await r.json();if(!r.ok)throw new Error(data.error || '请求失败');return data;}
const asset=(r,p)=>`/assets/${r}/${p}`;
function App(){
 const [page,setPage]=useState('home'),[settings,setSettings]=useStored('sekai.settings',defaults),[saves,setSaves]=useStored('sekai.saves',{}),[resume,setResume]=useStored('sekai.resume',null),[readProgress,setReadProgress]=useStored('sekai.progress',{});
 const [catalog,setCatalog]=useState([]),[loading,setLoading]=useState(false),[error,setError]=useState(''),[type,setType]=useState('main'),[unit,setUnit]=useState('all'),[search,setSearch]=useState(''),[limit,setLimit]=useState(24);
 const [story,setStory]=useState(null),[index,setIndex]=useState(0),[download,setDownload]=useState(null),[modal,setModal]=useState(null),[auto,setAuto]=useState(false),[skip,setSkip]=useState(false),[visible,setVisible]=useState(0),[hidden,setHidden]=useState(false),[notice,setNotice]=useState('');
 const bgmRef=useRef(null),voicesRef=useRef([]),requestRef=useRef(0),voiceEnded=useRef(true),catalogRequestRef=useRef(0),modalRef=useRef(modal);
 const [documentBackground,setDocumentBackground]=useState(document.hidden),[nativeBackground,setNativeBackground]=useState(false);
 const background=documentBackground || nativeBackground;
 const [libraryMusic,setLibraryMusic]=useState(titleBgmPath);
 const libraryState=useRef({});
 const menuMusic=page==='player'?'':page==='chapters'?libraryMusic:titleBgmPath;
 useMenuBgm(menuMusic,settings.region,settings.bgm*(['settings','resources'].includes(page)?.4:1),background || !!download || (page==='player'&&!!modal));
 const heldSkip=useRef({active:false,previous:false});
 const fullyRevealed=useRef(null);
 useEffect(()=>{const update=()=>setDocumentBackground(document.hidden);document.addEventListener('visibilitychange',update);const unsubscribe=window.sekaiDesktop?.onBackground(setNativeBackground);return()=>{document.removeEventListener('visibilitychange',update);unsubscribe?.();};},[]);
 modalRef.current=modal || background;
 const [sceneAudio,setSceneAudio]=useState({bgm:'',volume:1,duration:0});
 const updateSceneAudio=useRef(null);updateSceneAudio.current=state=>setSceneAudio(old=>old.bgm===state.bgm&&old.volume===state.volume&&old.duration===state.duration?old:state);
 const [history,setHistory]=useStored('sekai.history',{});
 useEffect(()=>{restoreFont();},[]);
 const [stageBusy,setStageBusy]=useState(true),[restore,setRestore]=useState(false),[ending,setEnding]=useState(false);
 useEffect(()=>{const media=matchMedia('(prefers-color-scheme: dark)');const update=()=>{document.documentElement.dataset.theme=settings.theme==='system'?(media.matches?'dark':'light'):(settings.theme || 'light');};update();media.addEventListener('change',update);return()=>media.removeEventListener('change',update);},[settings.theme]);
 const outroLine=useMemo(()=>story?{...story.lines.at(-1),before:story.lines.at(-1).scene,scene:story.finalScene || story.lines.at(-1).scene,events:story.outro || [],text:'',voices:[]}:null,[story]);
 const line=ending?outroLine:story?.lines[index], text=(line?.text || '').replace(/<[^>]+>/g,'');
 useEffect(()=>{if(ending&&!stageBusy){setAuto(false);setSkip(false);setModal('end');}},[ending,stageBusy]);
 async function loadCatalog(refresh=false){const request=++catalogRequestRef.current;setLoading(true);setError('');try{const result=await api(`/api/catalog?region=${settings.region}${type==='personal'?'&type=personal':''}${refresh?'&refresh=1':''}`);if(request===catalogRequestRef.current)setCatalog(result);}catch(e){if(request===catalogRequestRef.current)setError(e.message+'，请检查网络后重试。');}finally{if(request===catalogRequestRef.current)setLoading(false);}}
 useEffect(()=>{setCatalog([]);loadCatalog();},[settings.region,type==='personal']);
 useEffect(()=>{setLimit(24);},[type,unit,search]);
 useEffect(()=>{if(!notice)return;const t=setTimeout(()=>setNotice(''),3500);return()=>clearTimeout(t);},[notice]);
 async function openStory(entry,position=0,region=settings.region){
  const request=++requestRef.current;setEnding(false);setError('');setDownload({status:'script',done:0,total:0,title:entry.title});setAuto(false);setSkip(false);
  try{const {key}=await api(`/api/prepare/${entry.id}?region=${region}`,{method:'POST'});
   while(request===requestRef.current){const job=await api(`/api/jobs/${encodeURIComponent(key)}`);if(job.error)throw new Error(job.error);setDownload({...job,title:entry.title});
    if(job.status==='ready'){setStageBusy(true);setRestore(position>0);setStory(job.story);setIndex(Math.min(position,job.story.lines.length-1));setPage('player');setModal(null);setHidden(false);setDownload(null);if(job.missing.length)setNotice(`${job.missing.length} 个音画资源未下载成功，可继续阅读。重新打开章节会重试。`);return;}
    await new Promise(r=>setTimeout(r,400));
   }
  }catch(e){if(request===requestRef.current){setDownload(null);setError(e.message);setNotice(e.message);}}
 }
 function continueStory(save=resume){if(save)openStory(save.entry,save.index,save.region);else{setPage('chapters');setNotice('选择一段故事，开始阅读。');}}
 function snapshot(){return {entry:story.entry,region:story.region,index,date:new Date().toISOString(),speaker:line.speaker,text,background:line.scene?.background || ''};}
 function store(slot){setSaves(s=>({...s,[slot]:snapshot()}));setNotice('已保存至存档 '+slot);}
 function go(n,animate=false){stopVoice();const target=Math.max(0,Math.min(story.lines.length-1,n));if(target===index&&!ending){setHidden(false);return;}fullyRevealed.current=null;setVisible(0);setEnding(false);setRestore(!animate);setStageBusy(true);setIndex(target);setHidden(false);}
 function stopVoice(){voicesRef.current.forEach(a=>{a.pause();a.dataset.resumeAfterMenu='false';});voiceEnded.current=true;}
 function markCurrentRead(force=false){if(!story||(!force&&stageBusy)||ending)return;const key=story.region+':'+story.entry.id;setHistory(h=>({...h,[key]:[...new Set([...(h[key] || []),index])].sort((a,b)=>a-b)}));}
 function next(manual=true){
  manual=manual!==false;
  if(page!=='player'||!story)return;
  if(ending){if(manual&&stageBusy)setRestore(true);return;}
  if(!manual&&stageBusy&&!skip)return;
  if(manual&&hidden){setHidden(false);return;}
  if(manual&&fullyRevealed.current!==line&&visible<text.length){
   fullyRevealed.current=line;setVisible(text.length);
   if(stageBusy)setRestore(true);
   return;
  }
  stopVoice();markCurrentRead(manual);
  if(index<story.lines.length-1)go(index+1,!manual);
  else if(story.outro?.length){setRestore(manual);setStageBusy(true);setEnding(true);}
  else{setAuto(false);setSkip(false);setModal('end');}
 }
 function markChapter(entry,read,total){const key=settings.region+':'+entry.id;setReadProgress(p=>({...p,[key]:{...p[key],markedRead:read,total:total || p[key]?.total || 0}}));if(!read)setHistory(h=>{const next={...h};delete next[key];return next;});}
 useEffect(()=>{if(page!=='player'||!story)return;setResume(snapshot());setReadProgress(p=>({...p,[story.region+':'+story.entry.id]:{...p[story.region+':'+story.entry.id],index,total:story.lines.length}}));},[page,story,index]);
 useEffect(()=>{
  if(page!=='player'||!line)return;
  if(fullyRevealed.current===line){setVisible(text.length);return;}
  setVisible(0);if(stageBusy)return;
  let cursor=0,t;const tick=()=>{
   if(fullyRevealed.current===line){setVisible(text.length);return;}
   if(modalRef.current){t=setTimeout(tick,50);return;}
   if(settings.speed===0){setVisible(text.length);return;}
   cursor++;setVisible(v=>Math.max(v,cursor));
   if(cursor<text.length)t=setTimeout(tick,settings.speed+(/[，。！？、,.!?…]/.test(text[cursor-1])?(settings.punctuationDelay ?? 120):0));
  };t=setTimeout(tick,settings.lineDelay ?? 0);return()=>clearTimeout(t);
 },[page,line,settings.speed,settings.punctuationDelay,settings.lineDelay,stageBusy]);
 useEffect(()=>{if(page!=='player'||modal||background||hidden||(!auto&&!skip)||!line||(stageBusy&&!skip))return;let readyAt=null;const t=setInterval(()=>{if(skip){next(false);return;}if(visible>=text.length&&voiceEnded.current){readyAt ??= performance.now();if(performance.now()-readyAt>=settings.autoDelay)next(false);}else readyAt=null;},50);return()=>clearInterval(t);},[auto,skip,page,index,visible,modal,background,hidden,settings.autoDelay,stageBusy]);
 useEffect(()=>{if(page!=='player'||!story||stageBusy||ending||visible<text.length)return;const key=story.region+':'+story.entry.id;setHistory(h=>({...h,[key]:[...new Set([...(h[key] || []),index])].sort((a,b)=>a-b)}));},[page,story,index,stageBusy,ending,visible,text.length]);
 useEffect(()=>{const sounds=[bgmRef.current,...voicesRef.current].filter(Boolean);if(page!=='player'){sounds.forEach(a=>{a.dataset.resumeAfterMenu='false';a.pause();});return;}if(modal || background){sounds.forEach(a=>{if(!a.paused)a.dataset.resumeAfterMenu='true';a.pause();});}else sounds.forEach(a=>{if(a.dataset.resumeAfterMenu==='true'&&!a.ended){a.dataset.resumeAfterMenu='false';a.play().catch(()=>{});}});},[page,modal,background]);
 useEffect(()=>{
  if(!line||page!=='player'||stageBusy||ending)return;
  let active=true;const finish=[];
  const voices=skip?[]:(line.voices || []).map(v=>{const a=new Audio(asset(story.region,voicePath(story,v.VoiceId)));a.dataset.character=String(v.Character2dId);a.dataset.baseVolume=String(v.Volume ?? 1);a.volume=Math.min(1,settings.voice/100*(v.Volume ?? 1));return a;});
  voicesRef.current=voices;voiceEnded.current=!voices.length;
  Promise.all(voices.map(a=>new Promise(resolve=>{finish.push(resolve);a.onended=resolve;a.onerror=resolve;if(modalRef.current)a.dataset.resumeAfterMenu='true';else a.play().catch(e=>{if(!active){resolve();return;}if(e.name==='NotAllowedError'){a.dataset.resumeAfterMenu='true';setNotice('浏览器暂停了声音，点击画面恢复配音。');}else{setNotice('配音加载失败，可点击配音重试。');resolve();}});}))).then(()=>{if(active)voiceEnded.current=true;});
  return()=>{active=false;voices.forEach(disposeAudio);finish.forEach(resolve=>resolve());if(voicesRef.current===voices)voicesRef.current=[];};
 },[line,page,skip,stageBusy,ending]);
 useEffect(()=>{bgmRef.current?.pause();if(page!=='player'||!sceneAudio.bgm){bgmRef.current=null;return;}const a=new Audio(asset(story.region,`sound/scenario/bgm/${sceneAudio.bgm}/${sceneAudio.bgm}.mp3`));a.loop=true;a.volume=settings.bgm/100*sceneAudio.volume;bgmRef.current=a;a.play().catch(()=>setNotice('点击重播配音或下一句可恢复声音。'));return()=>a.pause();},[sceneAudio.bgm,story?.region,page]);
 useEffect(()=>{if(bgmRef.current)bgmRef.current.volume=Math.min(1,settings.bgm/100*sceneAudio.volume);voicesRef.current.forEach(a=>a.volume=Math.min(1,settings.voice/100*Number(a.dataset.baseVolume || 1)));},[settings.bgm,settings.voice,sceneAudio.volume]);
 useEffect(()=>{
  function key(e){
   if(download||background)return;
   const action=shortcutAction(e);if(!action)return;
   if(action==='fullscreen'){e.preventDefault();full();return;}
   if(page!=='player')return;
   if(modal){e.preventDefault();if(action==='settings')setModal(null);return;}
   e.preventDefault();unlockAudio();
   if(action==='holdSkip'){if(!heldSkip.current.active)heldSkip.current={active:true,previous:skip};setAuto(false);setSkip(true);return;}
   if(action==='next'){if(hidden)setHidden(false);else next();}
   else if(action==='previous')go(index-1);
   else if(action==='auto'){heldSkip.current.active=false;setSkip(false);setAuto(v=>!v);}
   else if(action==='skip'){heldSkip.current.active=false;setAuto(false);setSkip(v=>!v);}
   else if(action==='hide')setHidden(v=>!v);
   else if(action==='quickSave')store('快速');
   else if(action==='quickLoad'){const saved=saves['快速'];if(saved)continueStory(saved);else setNotice('还没有快速存档，请按 S 或 F5 保存。');}
   else if(action==='voice')voicesRef.current.forEach(a=>{a.currentTime=0;a.play().catch(()=>{});});
   else if(['save','load','log','jump','settings'].includes(action)){heldSkip.current.active=false;setAuto(false);setSkip(false);setModal(action);}
  }
  function up(e){if(e.key==='Control'&&heldSkip.current.active){const previous=heldSkip.current.previous;heldSkip.current.active=false;setSkip(previous);}}
  function blur(){heldSkip.current.active=false;setSkip(false);}
  window.addEventListener('keydown',key);window.addEventListener('keyup',up);window.addEventListener('blur',blur);
  return()=>{window.removeEventListener('keydown',key);window.removeEventListener('keyup',up);window.removeEventListener('blur',blur);};
 });
 const filtered=catalog.filter(e=>e.type===type && (type==='event'||unit==='all'||e.unit===unit) && `${e.title} ${e.chapter} ${units[e.unit] || ''}`.toLowerCase().includes(search.toLowerCase()));
 const featured=catalog.filter(e=>e.type==='main'&&e.episode===2).slice(0,5);
 function nav(p){if(page==='player'){stopVoice();voicesRef.current.forEach(disposeAudio);voicesRef.current=[];if(bgmRef.current){bgmRef.current.dataset.resumeAfterMenu='false';bgmRef.current.pause();}setModal(null);setEnding(false);}heldSkip.current.active=false;setAuto(false);setSkip(false);setPage(p);}
 async function full(){try{if(window.sekaiDesktop?.toggleFullscreen){if(document.fullscreenElement)await document.exitFullscreen();await window.sekaiDesktop.toggleFullscreen();}else if(document.fullscreenElement)await document.exitFullscreen();else await (document.querySelector('.app') || document.documentElement).requestFullscreen();}catch{setNotice('无法切换全屏，请重试或使用 F11');}}
 return <div className={'app '+(page==='player'?'reading':'')} onPointerDown={()=>{unlockAudio();if(page==='player'&&!modal)voicesRef.current.forEach(a=>{if(a.dataset.resumeAfterMenu==='true'&&a.paused&&!a.ended){a.dataset.resumeAfterMenu='false';a.play().catch(()=>{});}});if(page==='player'&&!modal&&bgmRef.current?.paused)bgmRef.current.play().catch(()=>{});}}>
 {page!=='player'&&<><aside className="sidebar"><a className="logo" onClick={()=>nav('home')}><span className="logo-mark">S<span>✦</span></span><b>SEKAI<span>NOVEL</span></b></a><div className="side-label">YOUR STORY, YOUR SEKAI</div><nav>{[[Home,'home','主界面'],[BookOpen,'chapters','章节选择'],[Save,'saves','我的存档'],[Settings,'settings','设置']].map(([Icon,p,label])=><button key={p} className={page===p?'active':''} onClick={()=>nav(p)}><Icon size={19}/>{label}{page===p&&<span className="nav-dot"/>}</button>)}</nav><div className="side-bottom"><div className="small-star">✦</div><p>每一个「想要」，<br/>都通向一个新的世界。</p><small>UNOFFICIAL FAN PROJECT<br/>VERSION 0.1.0</small></div></aside><main key={page} className="screen-enter"><header><div><span className="eyebrow">PROJECT SEKAI · VISUAL NOVEL</span><p>{page==='home'?'世界的另一页，等你翻开。':{chapters:'寻找属于你的那一段故事。',saves:'让故事，停在你喜欢的那一刻。',settings:'以你喜欢的节奏，阅读世界。'}[page]}</p></div><div className="header-right"><button className="icon-button" aria-label="切换暗色模式" onClick={()=>setSettings(s=>({...s,theme:document.documentElement.dataset.theme==='dark'?'light':'dark'}))}>{settings.theme==='dark'?<Sun size={18}/>:<Moon size={18}/>}</button><span className="status-dot"/> {settings.region.toUpperCase()} SERVER <button className="icon-button" onClick={()=>nav('settings')} aria-label="设置"><Settings size={19}/></button></div></header>
 {error&&<div className="error">{error}<button onClick={()=>loadCatalog()}>重试</button></div>}
 {page==='home'&&<GameHome resume={resume} nav={nav} continueStory={continueStory} full={full}/>}
 {page==='resources'&&<ResourceManager region={settings.region} onHome={()=>nav('home')}/>}
 {page==='chapters'&&<ChapterLibrary onMusicChange={setLibraryMusic} retainedState={libraryState.current} bgmVolume={settings.bgm} audioPaused={background || !!download || !!modal} catalog={catalog} region={settings.region} units={units} type={type} setType={setType} unit={unit} setUnit={setUnit} search={search} setSearch={setSearch} loading={loading} refresh={()=>loadCatalog(true)} progress={readProgress} history={history} onMarkRead={markChapter} onHome={()=>nav('home')} openStory={openStory}/>}
 {page==='settings'&&<GameSettings settings={settings} setSettings={setSettings} defaults={defaults} story={story} full={full} onClose={()=>nav('home')}/>}
 {page==='saves'&&<SaveScreen saves={saves} onHome={()=>nav('home')} onLoad={continueStory} onDelete={slot=>setSaves(s=>{const n={...s};delete n[slot];return n;})}/> }
 <footer><span>SEKAI NOVEL</span><p>非官方同人阅读器 · 游戏素材 © SEGA / Colorful Palette / Crypton</p><a href="https://sekai.best" target="_blank" rel="noreferrer">RESOURCE BY SEKAI.BEST ↗</a></footer></main></>}
 {page==='player'&&story&&<NovelPlayer story={story} line={line} index={index} settings={settings} setSettings={setSettings} read={!!history[story.region+':'+story.entry.id]?.includes(index)} visible={visible} text={text} hidden={hidden} setHidden={setHidden} auto={auto} setAuto={setAuto} skip={skip} setSkip={setSkip} go={go} next={next} modal={modal} background={background} setModal={setModal} nav={nav} full={full} voicesRef={voicesRef} onSceneChange={state=>updateSceneAudio.current(state)} onBusy={setStageBusy} onWarning={setNotice} busy={stageBusy} restore={restore}/>}
 {modal&&<div className="overlay"><div className={'modal '+(modal==='settings'?'options-modal':modal==='log'?'backlog-modal':'')}><button className="modal-close icon-button" onClick={()=>setModal(null)} aria-label="关闭"><X/></button><h2>{{save:'保存这一刻',load:'读取存档',log:'Backlog · 对白记录',jump:'剧情跳转',settings:'阅读设置',end:'这一段故事，已读完。'}[modal]}</h2>{modal==='settings'&&<GameSettings settings={settings} setSettings={setSettings} defaults={defaults} story={story} compact full={full} onHome={()=>{setModal(null);nav('home');}} onClose={()=>setModal(null)} onSave={()=>setModal('save')} onLoad={()=>setModal('load')}/>}{['save','load'].includes(modal)&&<SaveGrid saves={saves} onSave={modal==='save'?store:null} onLoad={continueStory}/ >}{modal==='log'&&<Backlog story={story} indices={(history[story.region+':'+story.entry.id] || []).filter(i=>i<story.lines.length)} index={index} settings={settings} onWarning={setNotice} onJump={i=>{go(i);setModal(null);}}/>}{modal==='jump'&&<div className="jump-list"><p>选择对白跳转；未读内容会直接显示。</p>{story.lines.map((l,i)=><button key={i} className={i===index?'current':''} onClick={()=>{go(i);setModal(null);}}><small>{String(i+1).padStart(3,'0')} · {l.speaker}</small><p>{l.text.replace(/<[^>]+>/g,'')}</p></button>)}</div>}{modal==='end'&&<><p>将这份思念带到下一页。</p><button className="primary" onClick={()=>{setModal(null);nav('chapters');}}>返回章节选择<ArrowRight size={18}/></button></>}</div></div>}
 {download&&<div className="overlay"><div className="modal download-modal"><span className="eyebrow">PREPARING YOUR STORY</span><h2>正在打开世界<span className="title-dot">.</span></h2><p>{download.title}</p><div className="download-icon"><Download size={30}/></div><div className="progress-track"><div style={{width:download.total?download.done/download.total*100+'%':'8%'}}/></div><p>{download.status==='models'?`Live2D ${download.done} / ${download.total}`:download.status==='effects'?`Effects ${download.done} / ${download.total}`:download.status==='script'?'正在下载剧情脚本…':`缓存背景与音频 ${download.done} / ${download.total}`}</p><small>下载完成后自动进入 · 已缓存资源下次直接读取</small><button className="secondary" onClick={()=>{requestRef.current++;setDownload(null);}}>取消进入</button></div></div>}
 {notice&&<div className="toast">{notice}</div>}
 </div>;
}
createRoot(document.getElementById('root')).render(<App/>);
