import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {normalizeStory} from '../server/story.js';
const base='http://127.0.0.1:3001',entry={id:'test-reader',title:'演出与语音等待测试',chapter:'测试',type:'main'};
const fixture={...normalizeStory({ScenarioId:'fixture',FirstBackground:'bg_a002201',SpecialEffectData:[{EffectType:24,StringVal:'开场文字。',StringValSub:'voice',Duration:.01},{EffectType:39}],TalkData:[{WindowDisplayName:'角色A',Body:'第一句对白。',TalkCharacters:[{Character2dId:5}]},{WindowDisplayName:'角色B',Body:'下一句对白。'}],Snippets:[{Action:6,ReferenceIndex:0,ProgressBehavior:1},{Action:6,ReferenceIndex:1,ProgressBehavior:1},{Action:1,ReferenceIndex:0},{Action:1,ReferenceIndex:1}]}),entry,region:'jp',live2d:[]};
// Real HTMLAudioElement playback: a three-second PCM WAV, not a mocked ended promise.
const rate=8000,bytes=rate*3*2,wav=Buffer.alloc(44+bytes);wav.write('RIFF');wav.writeUInt32LE(36+bytes,4);wav.write('WAVEfmt ',8);wav.writeUInt32LE(16,16);wav.writeUInt16LE(1,20);wav.writeUInt16LE(1,22);wav.writeUInt32LE(rate,24);wav.writeUInt32LE(rate*2,28);wav.writeUInt16LE(2,32);wav.writeUInt16LE(16,34);wav.write('data',36);wav.writeUInt32LE(bytes,40);
const browser=await chromium.launch();try{
 const page=await browser.newPage({viewport:{width:1440,height:900}}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(entry=>{if(!localStorage.getItem('sekai.resume')){localStorage.setItem('sekai.resume',JSON.stringify({entry,region:'jp',index:0}));localStorage.setItem('sekai.settings',JSON.stringify({region:'jp',speed:10,autoDelay:500,bgm:0,voice:0,se:0,font:24,live2d:false,punctuationDelay:0}));}},{...entry});
 await page.route('**/api/prepare/**',route=>route.fulfill({json:{key:'test'}}));await page.route('**/api/jobs/**',route=>route.fulfill({json:{status:'ready',done:1,total:1,missing:[],story:fixture}}));
 await page.route('**/sound/scenario/voice/fixture/voice.mp3',route=>route.fulfill({body:wav,contentType:'audio/wav'}));
 await page.goto(base);await page.getByRole('button',{name:'继续故事',exact:true}).click();await page.waitForFunction(()=>document.querySelector('.fullscreen-text')?.textContent==='开场文字。');
 assert.equal(await page.locator('.dialogue').count(),0);assert.notEqual(await page.locator('.stage-background').evaluate(el=>getComputedStyle(el).backgroundImage),'none');
 await page.getByRole('button',{name:'自动',exact:true}).click();await page.waitForTimeout(900);assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('sekai.resume')).index),0,'voice is still playing, no automatic advance');
 await page.getByRole('button',{name:'阅读设置',exact:true}).click();await page.waitForTimeout(2400);assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('sekai.resume')).index),0,'menu pauses voice and auto timer');
 await page.getByRole('combobox',{name:'对白字体',exact:true}).selectOption('serif');await page.getByRole('combobox',{name:'角色',exact:true}).selectOption('5');await page.getByRole('textbox',{name:'角色主题色',exact:true}).fill('#ff77bb').catch(async()=>{await page.locator('input[type=color]').evaluate(el=>{el.value='#ff77bb';el.dispatchEvent(new Event('input',{bubbles:true}));el.dispatchEvent(new Event('change',{bubbles:true}));});});
 await page.getByRole('button',{name:'关闭',exact:true}).click();
 await page.waitForFunction(()=>JSON.parse(localStorage.getItem('sekai.resume')).index===1,{},{timeout:10000});await page.getByRole('button',{name:'自动',exact:true}).click();await page.locator('.dialogue').waitFor();
 assert.equal(await page.locator('.vn-screen').evaluate(el=>getComputedStyle(el).getPropertyValue('--speaker-color')),'#ff77bb');assert.match(await page.locator('.dialogue-body').evaluate(el=>getComputedStyle(el).fontFamily),/serif/);
 await page.getByRole('button',{name:'全屏',exact:true}).click();await page.waitForFunction(()=>document.fullscreenElement?.classList.contains('app'));assert.equal(await page.evaluate(()=>document.fullscreenElement?.classList.contains('app')),true);
 await page.getByRole('button',{name:'存档',exact:true}).click();assert.equal(await page.locator('.modal').isVisible(),true);assert.equal(await page.locator('.modal').evaluate(el=>document.fullscreenElement.contains(el)),true);await page.getByRole('button',{name:'关闭',exact:true}).click();
 await page.getByRole('button',{name:'Backlog',exact:true}).click();assert.equal(await page.locator('.log-list article').count(),2);assert.equal(await page.getByRole('button',{name:'回到第 3 句',exact:true}).count(),0);await page.getByRole('button',{name:'回到第 1 句',exact:true}).click();
 await page.getByRole('button',{name:'阅读设置',exact:true}).click();await page.getByLabel('导入自定义字体',{exact:true}).setInputFiles('C:/Windows/Fonts/arial.ttf');await page.waitForFunction(()=>JSON.parse(localStorage.getItem('sekai.settings')).fontFamily==='custom');await page.getByRole('button',{name:'关闭',exact:true}).click();
 await page.screenshot({path:'artifacts/fullscreen-text.png'});await page.reload();await page.getByRole('button',{name:'继续故事',exact:true}).click();await page.waitForFunction(()=>[...document.fonts].some(f=>f.family==='SekaiCustomFont'&&f.status==='loaded'));assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('sekai.settings')).fontFamily),'custom');
 await page.setViewportSize({width:390,height:844});await page.screenshot({path:'artifacts/reader-mobile.png'});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 assert.deepEqual(errors,[]);console.log('Full-screen text, real voice completion, menu pause, fullscreen save controls, read-only backlog, character color, font import/persistence and mobile passed');
}finally{await browser.close();}
