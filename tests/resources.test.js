import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {createAssetLoader,assetBucket} from '../server/resources.js';
import {runSnippets,groupSnippets} from '../src/snippet-timeline.js';
import {prepareEffects} from '../server/effects.js';
test('regional particle listing falls back to the shared textures',async()=>{
 const requested=[];const download=async url=>{if(url.includes('sekai-cn-assets'))throw new Error('Missing region listing');return Buffer.from('<ListBucketResult><Contents><Key>scenario/effect/sparkle/tex.webp</Key></Contents></ListBucketResult>');};
 const story={lines:[{events:[{kind:'effect',data:{EffectType:15,StringVal:'sparkle'}}]}],outro:[]};const warnings=[];
 const effects=await prepareEffects(story,'cn',download,{add:()=>{},done:()=>{},warning:s=>warnings.push(s)},async(r,p)=>requested.push([r,p]));assert.deepEqual(requested,[['cn','scenario/effect/sparkle/tex.webp']]);assert.deepEqual(effects.sparkle.textures,['/assets/cn/scenario/effect/sparkle/tex.webp']);assert.deepEqual(warnings,[]);
});
test('media fallback preserves regional scripts and remembers source on restart',async()=>{
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'sekai-resource-test-'));const calls=[];
 try{const download=async url=>{calls.push(url);if(url.startsWith(assetBucket('cn')))throw Object.assign(new Error('missing'),{status:404});return Buffer.from('shared');};
 const loader=await createAssetLoader(download,root);const results=await Promise.all([loader('cn','scenario/background/test/test.webp'),loader('cn','scenario/background/test/test.webp')]);assert.equal(calls.length,2);assert.equal(results[0].sourceRegion,'jp');assert.equal(results[1].data.toString(),'shared');
 calls.length=0;const restarted=await createAssetLoader(download,root);await restarted('cn','scenario/background/test/test.webp');assert.deepEqual(calls,[assetBucket('jp')+'scenario/background/test/test.webp']);
 await assert.rejects(()=>loader('cn','scenario/unitstory/test/test.asset'),/missing/);assert.ok(!calls.includes(assetBucket('jp')+'scenario/unitstory/test/test.asset'));
 }finally{await fs.rm(root,{recursive:true,force:true});}
});
test('timeline joins Now snippets to the preceding Wait group',async()=>{
 const events=[{name:'out',wait:false},{name:'clear',wait:true},{name:'clear2',wait:false},{name:'background',wait:true},{name:'in',wait:true}];
 assert.deepEqual(groupSnippets(events).map(g=>g.map(e=>e.name)),[['out'],['clear','clear2'],['background'],['in']]);
 const order=[];await runSnippets(events,{signal:new AbortController().signal,wait:async()=>{},run:async e=>{order.push('start:'+e.name);if(e.name==='out')await new Promise(r=>setTimeout(r,25));order.push('end:'+e.name);}});
 assert.ok(order.indexOf('end:out')<order.indexOf('start:background'));assert.ok(order.indexOf('end:background')<order.indexOf('start:in'));
});
