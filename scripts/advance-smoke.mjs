import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
import express from 'express';
import {normalizeStory} from '../server/story.js';
const entry={id:'advance-fixture',type:'main',chapter:'测试',title:'文字推进与末句回归'};
const raw={ScenarioId:'advance',SpecialEffectData:[{EffectType:24,StringVal:'开场文字需要先全部显示，再次点击才进入下一句。',StringValSub:'intro'},{EffectType:39},{EffectType:43,StringVal:'1.4',Duration:6},{EffectType:8,StringVal:'等待六秒的场景标题',Duration:6},{EffectType:2,Duration:6}],LayoutData:[{Character2dId:1,Type:2,SideTo:7,MotionName:'pose'}],TalkData:[{WindowDisplayName:'一歌',Body:'这是一段缓慢显示的对白，第一次点击补全文字，第二次点击快速跳转。',Voices:[{VoiceId:'talk'}]},{WindowDisplayName:'一歌',Body:'这是有配音的最后一句，用来检查退出后不会重复播放。',Voices:[{VoiceId:'last'}]}],Snippets:[{Action:6,ReferenceIndex:0},{Action:6,ReferenceIndex:1},{Action:6,ReferenceIndex:2,ProgressBehavior:1},{Action:2,ReferenceIndex:0,Delay:6},{Action:1,ReferenceIndex:0},{Action:6,ReferenceIndex:3,ProgressBehavior:1},{Action:1,ReferenceIndex:1},{Action:6,ReferenceIndex:4,ProgressBehavior:1}]};
const fixture={...normalizeStory(raw),entry,region:'jp',live2d:[]};let current=fixture;
const rate=8000,bytes=rate*12*2,wav=Buffer.alloc(44+bytes);wav.write('RIFF');wav.writeUInt32LE(36+bytes,4);wav.write('WAVEfmt ',8);wav.writeUInt32LE(16,16);wav.writeUInt16LE(1,20);wav.writeUInt16LE(1,22);wav.writeUInt32LE(rate,24);wav.writeUInt32LE(rate*2,28);wav.writeUInt16LE(2,32);wav.writeUInt16LE(16,34);wav.write('data',36);wav.writeUInt32LE(bytes,40);
const app=express();app.get('/api/catalog',(_req,res)=>res.json([]));app.post('/api/prepare/:id',(_req,res)=>res.json({key:'fixture'}));app.get('/api/jobs/:key',(_req,res)=>res.json({status:'ready',missing:[],story:current}));app.get('/assets/jp/*asset',(req,res)=>req.path.endsWith('.mp3')?res.type('wav').send(wav):res.status(404).end());app.use(express.static('dist'));
const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));const browser=await chromium.launch();
try{
 const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(entry=>{localStorage.setItem('sekai.resume',JSON.stringify({entry,index:0,region:'jp'}));localStorage.setItem('sekai.settings',JSON.stringify({speed:150,punctuationDelay:0,live2d:false,bgm:0,voice:60}));window.sounds=[];const Original=window.Audio;window.Audio=function(...args){const audio=new Original(...args);audio.testSource=args[0];audio.testPlays=0;const play=audio.play.bind(audio);audio.play=()=>{audio.testPlays++;return play();};window.sounds.push(audio);return audio;};window.Audio.prototype=Original.prototype;window.testHidden=false;Object.defineProperty(document,'hidden',{get:()=>window.testHidden});},entry);
 await page.goto(`http://127.0.0.1:${server.address().port}`);await page.getByRole('button',{name:'继续故事',exact:true}).click();
 const audioPlaying=async name=>page.waitForFunction(name=>window.sounds.some(a=>a.testSource.endsWith('/'+name+'.mp3')&&!a.paused&&a.currentTime>.05),name);
 const position=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('sekai.resume')).index);
 await audioPlaying('intro');await page.locator('.scene-click').click({position:{x:300,y:180}});
 assert.equal(await position(),0);assert.equal(await page.locator('.fullscreen-text').textContent(),fixture.lines[0].text);await audioPlaying('intro');
 await page.waitForTimeout(250);assert.equal(await page.locator('.fullscreen-text').textContent(),fixture.lines[0].text,'typewriter never hides revealed text again');
 const firstStart=Date.now();await page.locator('.scene-click').click({position:{x:300,y:180}});await page.locator('.dialogue').waitFor();assert.equal(await position(),1);assert.ok(Date.now()-firstStart<1500,'six-second transition and layout delays were skipped');
 assert.equal(await page.locator('.story-stage').getAttribute('data-actors'),'1');assert.equal(await page.locator('.story-stage').getAttribute('data-camera'),'1.4');
 assert.equal(await page.evaluate(()=>window.sounds.find(a=>a.testSource.endsWith('/intro.mp3')).paused),true);
 await audioPlaying('talk');await page.keyboard.press('Space');assert.equal(await position(),1);assert.ok((await page.locator('.dialogue-body').textContent()).includes(fixture.lines[1].text));await audioPlaying('talk');
 const nextStart=Date.now();await page.keyboard.press('Space');await audioPlaying('last');assert.equal(await position(),2);assert.ok(Date.now()-nextStart<1500,'next dialogue does not wait six seconds for telop');
 await page.locator('.dialogue-body').click();assert.equal(await position(),2);await audioPlaying('last');
 const playCount=await page.evaluate(()=>window.sounds.find(a=>a.testSource.endsWith('/last.mp3')).testPlays);
 await page.locator('.dialogue-body').click();await page.getByRole('button',{name:'返回章节选择',exact:true}).waitFor();
 assert.equal(await page.evaluate(()=>window.sounds.filter(a=>a.testSource.endsWith('/last.mp3')).length),1,'outro never recreates last voice');
 await page.getByRole('button',{name:'返回章节选择',exact:true}).click();
 await page.evaluate(()=>{window.testHidden=true;document.dispatchEvent(new Event('visibilitychange'));});await page.evaluate(()=>{window.testHidden=false;document.dispatchEvent(new Event('visibilitychange'));});
 await page.getByRole('button',{name:'返回主界面',exact:true}).click();await page.locator('.title-brand').click();await page.waitForTimeout(250);
 const voiceState=await page.evaluate(()=>window.sounds.filter(a=>a.testSource.includes('/voice/')).map(a=>({paused:a.paused,src:a.getAttribute('src'),resume:a.dataset.resumeAfterMenu,plays:a.testPlays,source:a.testSource})));
 assert.ok(voiceState.every(a=>a.paused&&a.src===null&&a.resume==='false'));assert.equal(voiceState.find(a=>a.source.endsWith('/last.mp3')).plays,playCount,'leaving and background restore never replay voice');
 // Also finish a chapter without an outro and leave through its end dialog.
 current={...fixture,outro:[]};await page.getByRole('button',{name:'继续故事',exact:true}).click();await page.locator('.dialogue').waitFor();await page.locator('.dialogue-body').click();await page.locator('.dialogue-body').click();await page.getByRole('button',{name:'返回章节选择',exact:true}).click();
 await page.waitForTimeout(100);assert.equal(await page.evaluate(()=>window.sounds.filter(a=>a.testSource.includes('/voice/')).every(a=>a.paused&&a.dataset.resumeAfterMenu==='false')),true);
 assert.deepEqual(errors,[]);console.log(JSON.stringify({twoStepNarration:true,twoStepDialogueAndSpace:true,firstClickKeepsVoice:true,nextClickStopsVoice:true,sixSecondAnimationsSkipped:true,sceneAndActorsPreserved:true,outroDoesNotReplay:true,exitClearsVoice:true,backgroundNeverRestartsVoice:true,noOutroExit:true}));
}finally{await browser.close();await new Promise(r=>server.close(r));}
