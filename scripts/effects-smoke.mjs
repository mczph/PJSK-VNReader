import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
import {normalizeStory} from '../server/story.js';
const base='http://127.0.0.1:3001';
await fetch(base+'/api/prepare/main-idol-1-2?region=jp',{method:'POST'});
let original;for(let i=0;i<300;i++){const j=await(await fetch(base+'/api/jobs/jp%3Amain-idol-1-2')).json();if(j.status==='ready'){original=j.story;break;}await new Promise(r=>setTimeout(r,400));}assert.ok(original);
const first=original.live2d[0],pose=first.manifest.FileReferences.Motions.Motion[0].Name,face=first.manifest.FileReferences.Motions.Expression[0].Name;
const raw={ScenarioId:original.scenarioId,FirstBackground:'bg_a002201',FirstLayout:[{Character2dId:5,CostumeType:first.costume,PositionSide:4,MotionName:pose,FacialName:face}],TalkData:[{WindowDisplayName:'みのり',Body:'初始场景'},{WindowDisplayName:'みのり',Body:'转场、回忆、镜头与粒子效果'},{WindowDisplayName:'みのり',Body:'恢复正常场景'}],SpecialEffectData:[{EffectType:2,Duration:.2},{EffectType:7,StringVal:'bg_b000601'},{EffectType:1,Duration:.2},{EffectType:27},{EffectType:43,StringVal:'1.15',Duration:.1},{EffectType:15,StringVal:'kirakira_01'},{EffectType:8,StringVal:'演出测试',Duration:.2},{EffectType:5,Duration:.3},{EffectType:28},{EffectType:16},{EffectType:43,StringVal:'1',Duration:.1}],Snippets:[{Action:1,ReferenceIndex:0},...Array.from({length:8},(_,i)=>({Action:6,ReferenceIndex:i,ProgressBehavior:1})),{Action:1,ReferenceIndex:1},...Array.from({length:3},(_,i)=>({Action:6,ReferenceIndex:i+8,ProgressBehavior:1})),{Action:1,ReferenceIndex:2}]};
raw.SpecialEffectData.push({EffectType:2,Duration:.2});raw.Snippets.push({Action:6,ReferenceIndex:11,ProgressBehavior:1});
// A slower Now fade-out must finish before the subsequent Wait background/in.
raw.SpecialEffectData[0].Duration=.6;raw.Snippets[1].ProgressBehavior=0;
const fixture={...normalizeStory(raw),entry:original.entry,region:'jp',live2d:[first],effectAssets:{kirakira_01:{textures:['/assets/jp/scenario/effect/kirakira_01/tex_kirakira_01.webp']}}};
const b=await chromium.launch();try{
const p=await b.newPage({viewport:{width:1440,height:1000}});const errors=[];p.on('pageerror',e=>errors.push(e.message));
await p.addInitScript(({entry})=>{localStorage.setItem('sekai.resume',JSON.stringify({entry,region:'jp',index:0}));localStorage.setItem('sekai.settings',JSON.stringify({region:'jp',theme:'dark',speed:10,autoDelay:500,bgm:0,voice:0,se:0,font:24}));},{entry:original.entry});
await p.route('**/api/jobs/**',route=>route.fulfill({json:{status:'ready',done:1,total:1,missing:[],warnings:[],story:fixture}}));
await p.goto(base);await p.locator('.hero-actions button').nth(1).click();await p.locator('.dialogue').waitFor({timeout:60000});
await p.waitForFunction(()=>document.querySelector('.dialogue-body')?.textContent.includes('初始场景'));
await p.getByRole('button',{name:'下一句',exact:true}).last().click();
await p.waitForFunction(()=>document.querySelector('.story-stage')?.dataset.memory==='true');await p.locator('.dialogue').waitFor();
assert.equal(await p.locator('.story-stage').getAttribute('data-camera'),'1.15');assert.equal(await p.locator('.story-stage').getAttribute('data-particles'),'kirakira_01');assert.equal(await p.locator('.story-stage').getAttribute('data-background'),'bg_b000601');
assert.equal(await p.locator('.stage-cover').evaluate(el=>el.style.opacity),'0','a previous slow fade-out cannot cover the new scene');
await p.screenshot({path:'artifacts/effects-dark.png',fullPage:true});
await p.getByRole('button',{name:'跳转',exact:true}).click();await p.locator('.jump-list>button').nth(2).click();await p.locator('.dialogue').waitFor();assert.equal(await p.locator('.story-stage').getAttribute('data-memory'),'false');assert.equal(await p.locator('.story-stage').getAttribute('data-camera'),'1');
await p.getByRole('button',{name:'跳转',exact:true}).click();await p.locator('.jump-list>button').nth(2).click();assert.ok(await p.locator('.dialogue').isVisible(),'clicking current line does not block playback');
assert.deepEqual(errors,[]);console.log('Effect playback, snapshot restoration and same-line jump passed');
await p.waitForFunction(()=>document.querySelector('.dialogue-body')?.textContent.includes('恢复正常场景'));await p.getByRole('button',{name:'下一句',exact:true}).last().click();await p.locator('.modal').waitFor();assert.equal(await p.locator('.stage-cover').evaluate(el=>el.style.opacity),'1');console.log('Chapter outro plays before the completion menu');
}finally{await b.close();}
