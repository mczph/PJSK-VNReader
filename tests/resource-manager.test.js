import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {createResourceStore,resourceKey} from '../server/resource-store.js';
import {startResourceServer} from '../server/index.js';
test('batch downloads deduplicate shared assets, survive restart, and invalidate affected chapters after cleanup',async()=>{
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'sekai-manager-')),calls=new Map();let service;
 const units=[{unit:'idol',chapters:[{chapterNo:1,title:'Test',assetbundleName:'test',episodes:[1,2].map(n=>({episodeNo:n,title:'Chapter '+n,scenarioId:'test'+n,assetbundleName:'ep'+n}))}]}];
 const mock=async url=>{calls.set(url,(calls.get(url)||0)+1);if(url.endsWith('unitStories.json'))return Response.json(units);if(url.endsWith('eventStories.json')||url.endsWith('events.json')||url.endsWith('model_list.json'))return Response.json([]);if(url.endsWith('.asset'))return Response.json({ScenarioId:url.includes('test1')?'test1':'test2',FirstBackground:'shared',TalkData:[{Body:'Test'}],Snippets:[{Action:1,ReferenceIndex:0}]});await new Promise(r=>setTimeout(r,5));return new Response('media');};
 const request=async(p,body)=>{const response=await fetch(service.url+p,body===undefined?undefined:{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});return {status:response.status,data:await response.json()};};
 try{
 service=await startResourceServer({port:0,cacheDir:root,fetchImpl:mock});
 assert.equal((await request('/api/downloads',{region:'jp',ids:['missing']})).status,400);
 assert.equal((await request('/api/catalog')).data[0].chapter,'MORE MORE JUMP!');
 await request('/api/downloads',{region:'jp',ids:['main-idol-1-1','main-idol-1-2','main-idol-1-1']});
 await request('/api/downloads/pause',{});
 for(let n=0;n<200;n++){const state=(await request('/api/downloads')).data;if(!state.running)break;await new Promise(r=>setTimeout(r,10));}
 const paused=(await request('/api/downloads')).data;assert.equal(paused.paused,true);assert.equal(paused.tasks.filter(t=>t.status==='queued').length,1);
 await new Promise(r=>service.server.close(r));service=await startResourceServer({port:0,cacheDir:root,fetchImpl:mock});
 assert.equal((await request('/api/downloads')).data.tasks.filter(t=>t.status==='queued').length,1);await request('/api/downloads/resume',{});
 let q;for(let n=0;n<200;n++){q=(await request('/api/downloads')).data;if(q.tasks.every(t=>t.status==='complete'))break;await new Promise(r=>setTimeout(r,10));}assert.equal(q.tasks.length,2);assert.ok(q.tasks.every(t=>t.status==='complete'),JSON.stringify(q));
 const list=(await request('/api/resources')).data,shared=list.items.find(i=>i.url.includes('/background/shared/'));assert.equal(shared.owners.length,2);assert.equal(calls.get(shared.url),1);assert.ok(list.bytes>0);
 assert.equal((await request('/api/resources/delete',{keys:['../../outside']})).status,400);
 const removed=await request('/api/resources/delete',{keys:[shared.key]});assert.equal(removed.data.count,1);assert.equal(removed.data.owners.length,2);assert.ok((await request('/api/downloads')).data.tasks.every(t=>t.status==='removed'));
 await new Promise(r=>service.server.close(r));service=await startResourceServer({port:0,cacheDir:root,fetchImpl:mock});
 assert.equal((await request('/api/downloads')).data.paused,true);
 await request('/api/downloads',{region:'jp',ids:['main-idol-1-1']});for(let n=0;n<200;n++){q=(await request('/api/downloads')).data;if(q.tasks.find(t=>t.key==='jp:main-idol-1-1')?.status==='complete')break;await new Promise(r=>setTimeout(r,10));}assert.equal(calls.get(shared.url),2);
 const store=await createResourceStore(root),key=resourceKey('https://example.test/legacy');await fs.writeFile(path.join(root,key),'legacy');assert.equal((await store.list()).items.find(i=>i.key===key).kind,'legacy');
 await new Promise(r=>service.server.close(r));service=await startResourceServer({port:0,cacheDir:root,fetchImpl:async()=>{throw new Error('offline');}});
 const prepared=await request('/api/prepare/main-idol-1-1',{ });assert.equal(prepared.status,200);let job;for(let n=0;n<200;n++){job=(await request('/api/jobs/'+encodeURIComponent(prepared.data.key))).data;if(['ready','error'].includes(job.status))break;await new Promise(r=>setTimeout(r,10));}assert.equal(job.status,'ready');assert.deepEqual(job.missing,[]);assert.deepEqual(job.warnings,[]);
 await fs.writeFile(path.join(root,'reader-state.json'),'keep-reading-state');await fs.writeFile(path.join(root,key+'.tmp'),'interrupted download');assert.equal((await request('/api/resources/clear',{})).status,400);assert.ok((await request('/api/resources')).data.count>0);
 assert.equal((await request('/api/resources/clear',{confirm:'clear-cache'})).status,200);assert.equal((await request('/api/resources')).data.count,0);assert.equal(await fs.readFile(path.join(root,'reader-state.json'),'utf8'),'keep-reading-state');await assert.rejects(fs.stat(path.join(root,key+'.tmp')));assert.ok((await request('/api/downloads')).data.tasks.every(t=>!['queued','complete','downloading'].includes(t.status)));
 }finally{if(service)await new Promise(r=>service.server.close(r));if(path.dirname(path.resolve(root))===path.resolve(os.tmpdir())&&path.basename(root).startsWith('sekai-manager-'))await fs.rm(root,{recursive:true,force:true});}
});
