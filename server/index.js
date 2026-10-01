import express from 'express';
import {fileURLToPath} from 'node:url';
import {personalEntries} from './personal.js';
import {storyCharacters} from './characters.js';
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import {AsyncLocalStorage} from 'node:async_hooks';
import {createResourceStore} from './resource-store.js';
import { normalizeStory, mediaPaths } from './story.js';
import { prepareModels } from './live2d.js';
import { prepareEffects } from './effects.js';
import { createAssetLoader,assetBucket } from './resources.js';
import {unitBgmPath} from './unit-bgm.js';
export async function createResourceServer({cacheDir=path.resolve('.cache'),distDir=path.resolve('dist'),fetchImpl=globalThis.fetch}={}){
const app = express(), root = path.resolve(cacheDir);
await fs.mkdir(root,{recursive:true});
const regions = {jp:'sekai-master-db-diff',cn:'sekai-master-db-cn-diff',en:'sekai-master-db-en-diff',tw:'sekai-master-db-tc-diff',kr:'sekai-master-db-kr-diff'};
const bucket = assetBucket;
const inflight = new Map(), jobs = new Map(), catalogues = new Map(),personals=new Map();
const owners=new AsyncLocalStorage(),store=await createResourceStore(root);
let cleaning=false,activeLoads=0;
const hash = s => crypto.createHash('sha256').update(s).digest('hex');
async function download(url,refresh=false){if(cleaning)throw new Error('资源正在清理，请稍后重试');activeLoads++;try{return await loadResource(url,refresh);}finally{activeLoads--;}}
async function loadResource(url,refresh=false) {
  if(cleaning)throw new Error('资源正在清理，请稍后重试');
  const file = path.join(root,hash(url));
  if (!refresh) {try {const data=await fs.readFile(file);await store.record(url,data.length,owners.getStore());return data;} catch(e){if(e.code!=='ENOENT')throw e;}}
  if (inflight.has(url)){const data=await inflight.get(url);await store.record(url,data.length,owners.getStore());return data;}
  const promise = (async()=>{
    const response = await fetchImpl(url,{signal:AbortSignal.timeout(45000)});
    if (!response.ok) throw Object.assign(new Error(`资源请求失败（${response.status}）：${url}`),{status:response.status});
    const data = Buffer.from(await response.arrayBuffer());
    await fs.writeFile(file+'.tmp',data); await fs.rename(file+'.tmp',file); return data;
  })();
  inflight.set(url,promise);
  try {const data=await promise;await store.record(url,data.length,owners.getStore());return data;} finally {inflight.delete(url);}
}
const assetLoader=await createAssetLoader(download,root);
const getAsset=async(region,p)=>{const result=await assetLoader(region,p);await store.record(result.sourceUrl,result.data.length,owners.getStore());return result;};
app.use(express.json({limit:'1mb'}));
const mainArtwork=unit=>unit==='piapro'?'piapro-story-chapter':'main_'+({light_sound:'lightsound',school_refusal:'schoolrefusal',theme_park:'themepark'}[unit] || unit);
const unitNames={light_sound:'Leo/need',idol:'MORE MORE JUMP!',street:'Vivid BAD SQUAD',theme_park:'Wonderlands × Showtime',school_refusal:'25时，在Nightcord。',piapro:'VIRTUAL SINGER'};
async function catalogue(region,refresh=false) {
  if (catalogues.has(region) && !refresh) return catalogues.get(region);
  const base = `https://sekai-world.github.io/${regions[region]}/`;
  const [units,events,eventNames] = await Promise.all(['unitStories','eventStories','events'].map(async name=>JSON.parse((await download(base+name+'.json',refresh)).toString())));
  const names=new Map(eventNames.map(e=>[e.id,e.name]));
  const entries = [];
  for (const u of units) for (const c of u.chapters) for (const e of c.episodes) entries.push({id:`main-${u.unit}-${c.chapterNo}-${e.episodeNo}`,type:'main',unit:u.unit,chapter:unitNames[u.unit] || u.unit,chapterNo:c.chapterNo,chapterTitle:c.title,title:e.title,episode:e.episodeNo,scenarioId:e.scenarioId,poster:`story/background/${mainArtwork(u.unit)}/background.webp`,posterTitle:`story/title_image/${mainArtwork(u.unit)}/story_title_image.webp`,path:`scenario/unitstory/${c.assetbundleName}/${e.scenarioId}.asset`,cover:`story/episode_image/${c.assetbundleName}/${e.assetbundleName}.webp`});
  for (const c of events) for (const e of c.eventStoryEpisodes || []) entries.push({id:`event-${c.eventId}-${e.episodeNo}`,type:'event',unit:'event',eventId:c.eventId,eventName:names.get(c.eventId),chapter:names.get(c.eventId) || `EVENT ${String(c.eventId).padStart(3,'0')}`,title:e.title,episode:e.episodeNo,scenarioId:e.scenarioId,poster:`event_story/${c.assetbundleName}/screen_image/story_bg.webp`,posterTitle:`event_story/${c.assetbundleName}/screen_image/story_title.webp`,path:`event_story/${c.assetbundleName}/scenario/${e.scenarioId}.asset`,cover:`event_story/${c.assetbundleName}/episode_image/${e.assetbundleName}.webp`});
  catalogues.set(region,entries); return entries;
}
async function personalCatalogue(region,refresh=false){if(personals.has(region)&&!refresh)return personals.get(region);const base='https://sekai-world.github.io/'+regions[region]+'/';const [characters,profiles,cards,episodes]=await Promise.all(['gameCharacters','characterProfiles','cards','cardEpisodes'].map(async name=>JSON.parse((await download(base+name+'.json',refresh)).toString())));const entries=personalEntries({characters,profiles,cards,episodes},region);personals.set(region,entries);return entries;}
app.use((req,res,next)=>{if(req.query.region && !regions[req.query.region]) return res.status(400).json({error:'不支持的服务器'});next();});
app.get('/api/catalog',async(req,res)=>{try {res.json(await (req.query.type==='personal'?personalCatalogue:catalogue)(req.query.region || 'jp',req.query.refresh === '1'));}catch(e){res.status(502).json({error:e.message});}});
const casts=new Map();
async function castFor(entry,region){const key=region+':'+entry.id;if(casts.has(key))return casts.get(key);const base=`https://sekai-world.github.io/${regions[region]}/`;const pending=(async()=>{const [raw,people,models]=await Promise.all([download(bucket(region)+entry.path).then(b=>JSON.parse(b.toString())),...['gameCharacters','character2ds'].map(n=>download(base+n+'.json').then(b=>JSON.parse(b.toString())))]);const characters=storyCharacters(raw,people,models);return {characters,total:normalizeStory(raw).lines.length};})();casts.set(key,pending);try{return await pending;}catch(e){casts.delete(key);throw e;}}
app.get('/api/cast/:id',async(req,res)=>{try{const region=req.query.region || 'jp',entry=(await (/^(profile|card)-/.test(req.params.id)?personalCatalogue:catalogue)(region)).find(e=>e.id===req.params.id);if(!entry)return res.status(404).json({error:'章节不存在'});res.json(await castFor(entry,region));}catch(e){res.status(502).json({error:e.message});}});
app.get('/api/runtime/cubism',async(req,res)=>{
  try{res.type('js').send(await download('https://cubism.live2d.com/sdk-web/cubismcore/live2dcubismcore.min.js'));}catch(e){res.status(502).send(e.message);}
});
app.get('/assets/:region/*asset',async(req,res)=>{
  const r=req.params.region, p=req.params.asset.join('/');
  if((!regions[r] && r!=='live2d') || p.includes('..') || !/^[\w/.-]+$/.test(p)) return res.sendStatus(400);
  try {const result=r==='live2d'?{data:await download('https://storage.sekai.best/sekai-live2d-assets/'+p),sourceRegion:r}:await getAsset(r,p);res.type(path.extname(p) === '.asset' ? 'json' : path.extname(p) || 'bin').set('Cache-Control','public, max-age=86400').set('X-Sekai-Resource-Region',result.sourceRegion);
    if(/\.(mp3|wav|ogg|mp4)$/.test(p)){res.set('Accept-Ranges','bytes');const match=/^bytes=(\d*)-(\d*)$/.exec(req.headers.range || '');if(match){const size=result.data.length,start=match[1]?Number(match[1]):Math.max(0,size-Number(match[2])),end=match[1]?(match[2]?Math.min(size-1,Number(match[2])):size-1):size-1;if(start>=size||start>end)return res.status(416).set('Content-Range',`bytes */${size}`).end();return res.status(206).set('Content-Range',`bytes ${start}-${end}/${size}`).send(result.data.subarray(start,end+1));}}
    res.send(result.data);
  }catch(e){res.status(502).send(e.message);}
});
async function prepare(entry,region,retain=false){
    if(cleaning)throw new Error('资源正在清理，请稍后重试');
    const key=region+':'+entry.id;
    if(!jobs.has(key) || jobs.get(key).error || (jobs.get(key).status==='ready' && (jobs.get(key).missing.length || jobs.get(key).warnings.length))) {
      const job={done:0,total:0,status:'script',missing:[],warnings:[]};jobs.set(key,job);
      const pending=owners.run(key,async()=>{
        const story=normalizeStory(JSON.parse((await download(bucket(region)+entry.path)).toString()));
        story.voiceType=entry.personalType==='card'?'card':'scenario';
        const {characters}=await castFor(entry,region).catch(()=>({characters:[]}));
        job.story={...story,entry,region,characters}; const paths=[...new Set([...mediaPaths(story),entry.type==='main'&&unitBgmPath(entry.unit),entry.cover,entry.poster,entry.posterTitle,...characters.map(c=>c.avatar)].filter(Boolean))];job.total=paths.length;job.status='media';
        let cursor=0;
        await Promise.all(Array.from({length:4},async()=>{while(cursor<paths.length){const p=paths[cursor++];try{await getAsset(region,p);}catch{job.missing.push(p);}job.done++;}}));
        job.status='models';
        try{await download('https://cubism.live2d.com/sdk-web/cubismcore/live2dcubismcore.min.js');}catch(e){job.warnings.push('Live2D 运行库：'+e.message);}
        try{job.story.live2d=await prepareModels(story,download,{add:n=>{job.total+=n;},done:()=>{job.done++;},warning:s=>job.warnings.push(s)});}catch(e){job.warnings.push('Live2D 目录加载失败：'+e.message);job.story.live2d=[];}
        job.status='effects';job.story.effectAssets=await prepareEffects(story,region,download,{add:n=>{job.total+=n;},done:()=>{job.done++;},warning:s=>job.warnings.push(s)},getAsset);
        await store.flush();
        job.status='ready';
      }).catch(e=>{job.error=e.message;job.status='error';});job.pending=pending;
    }
    if(retain)jobs.get(key).reader=true;
    return {key,job:jobs.get(key)};
}
app.post('/api/prepare/:id',async(req,res)=>{
  try {const region=req.query.region || 'jp',entry=(await (/^(profile|card)-/.test(req.params.id)?personalCatalogue:catalogue)(region)).find(e=>e.id===req.params.id);if(!entry)return res.status(404).json({error:'章节不存在'});const {key}=await prepare(entry,region,true);res.json({key});
  }catch(e){res.status(502).json({error:e.message});}
});
app.get('/api/jobs/:key',(req,res)=>{const j=jobs.get(req.params.key);if(!j)return res.sendStatus(404);res.json(j);});
const queueFile=path.join(root,'download-queue.json');let queue=[],paused=true,running=false,queueWriter=Promise.resolve();
try{queue=JSON.parse(await fs.readFile(queueFile,'utf8')).map(t=>({...t,status:['downloading','queued'].includes(t.status)?'queued':t.status}));}catch{}
const saveQueue=()=>queueWriter=queueWriter.catch(()=>{}).then(async()=>{await fs.writeFile(queueFile+'.tmp',JSON.stringify(queue));await fs.rename(queueFile+'.tmp',queueFile);});
async function runQueue(){if(running||paused)return;running=true;try{while(!paused){const task=queue.find(t=>t.status==='queued');if(!task)break;task.status='downloading';delete task.error;await saveQueue();try{const {job}=await prepare(task.entry,task.region);await job.pending;if(job.error)throw new Error(job.error);task.status=job.missing.length||job.warnings.length?'partial':'complete';task.missing=job.missing.length;task.warnings=job.warnings;task.finished=Date.now();}catch(e){task.status='failed';task.error=e.message;}const job=jobs.get(task.key);if(job&&!job.reader)jobs.delete(task.key);await saveQueue();}}catch(e){paused=true;console.error('下载队列保存失败：'+e.message);}finally{running=false;}}
app.get('/api/downloads',(req,res)=>res.json({paused,running,tasks:queue.map(t=>{const job=jobs.get(t.key);return {...t,done:job?.done || 0,total:job?.total || 0,phase:job?.status};})}));
app.post('/api/downloads',async(req,res)=>{try{const {region='jp',ids}=req.body || {};if(!regions[region]||!Array.isArray(ids)||!ids.length||ids.length>500)return res.status(400).json({error:'每批请选择 1–500 个章节'});const needsPersonal=ids.some(id=>/^(profile|card)-/.test(id));const entries=[...await catalogue(region),...(needsPersonal?await personalCatalogue(region):[])];const byId=new Map(entries.map(e=>[e.id,e]));if(ids.some(id=>!byId.has(id)))return res.status(400).json({error:'章节不存在'});for(const id of new Set(ids)){const key=region+':'+id,old=queue.find(t=>t.key===key);if(old&&['queued','downloading','complete'].includes(old.status))continue;if(old)queue.splice(queue.indexOf(old),1);queue.push({key,region,entry:byId.get(id),status:'queued',created:Date.now()});}await saveQueue();paused=false;void runQueue();res.json({added:true});}catch(e){res.status(502).json({error:e.message});}});
app.post('/api/downloads/:action',async(req,res)=>{const action=req.params.action;if(action==='pause')paused=true;else if(action==='resume'){paused=false;for(const t of queue)if(['failed','partial'].includes(t.status))t.status='queued';}else if(action==='clear'){for(const t of queue)if(t.status==='queued')t.status='cancelled';}else return res.status(400).json({error:'未知队列操作'});await saveQueue();if(!paused)void runQueue();res.json({ok:true});});
app.get('/api/resources',async(req,res)=>{try{res.json(await store.list());}catch(e){res.status(500).json({error:e.message});}});
app.post('/api/resources/clear',async(req,res)=>{if(req.body?.confirm!=='clear-cache')return res.status(400).json({error:'请确认清空缓存'});if(cleaning||running||activeLoads||inflight.size||[...jobs.values()].some(j=>!['ready','error'].includes(j.status)))return res.status(409).json({error:'请暂停下载队列，并等待当前章节下载完成后清空缓存'});cleaning=true;try{paused=true;await queueWriter;const result=await store.clear();await assetLoader.clear();jobs.clear();casts.clear();catalogues.clear();personals.clear();for(const task of queue)task.status=task.status==='queued'?'cancelled':['complete','partial','removed'].includes(task.status)?'removed':task.status;await saveQueue();res.json(result);}catch(e){res.status(500).json({error:e.message});}finally{cleaning=false;}});
app.post('/api/resources/delete',async(req,res)=>{if(cleaning||activeLoads||inflight.size||[...jobs.values()].some(j=>!['ready','error'].includes(j.status)))return res.status(409).json({error:'下载正在进行，请暂停队列并等待当前章节结束后清理'});cleaning=true;try{const result=await store.remove(req.body?.keys);for(const key of result.owners){jobs.delete(key);const task=queue.find(t=>t.key===key);if(task)task.status='removed';}casts.clear();catalogues.clear();personals.clear();await saveQueue();res.json(result);}catch(e){res.status(400).json({error:e.message});}finally{cleaning=false;}});
app.use(express.static(distDir));
app.get('/{*path}',(req,res)=>res.sendFile(path.join(distDir,'index.html')));
return {app,root};
}
export async function startResourceServer({port=3001,...options}={}){const service=await createResourceServer(options);const server=await new Promise((resolve,reject)=>{const instance=service.app.listen(port,'127.0.0.1',()=>resolve(instance));instance.once('error',reject);});return {...service,server,url:'http://127.0.0.1:'+server.address().port};}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){const {url}=await startResourceServer();console.log('SEKAI resource service: '+url);}
