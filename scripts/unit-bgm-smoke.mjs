import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
import express from 'express';
import {unitBgm,unitBgmPath} from '../server/unit-bgm.js';
const app=express(),catalog=Object.keys(unitBgm).map((unit,i)=>({id:`main-${unit}-1-1`,type:'main',unit,chapter:unit,title:`Story ${i}`,chapterNo:1,episode:1,cover:'blank.png'}));
app.get('/api/catalog',(_req,res)=>res.json(catalog));
app.get('/api/cast/:id',(_req,res)=>res.json({characters:[],total:1}));
app.post('/api/prepare/:id',(_req,res)=>res.json({key:'preparing'}));app.get('/api/jobs/:key',(_req,res)=>res.json({status:'script',done:0,total:0}));
app.use('/assets/jp',(_req,res)=>res.status(404).end());app.use(express.static('dist'));
const server=app.listen(0,'127.0.0.1');await new Promise(resolve=>server.once('listening',resolve));
const browser=await chromium.launch();
try{
 const page=await browser.newPage();await page.addInitScript(()=>{
  localStorage.setItem('sekai.settings',JSON.stringify({bgm:23}));window.testAudio=[];window.testHidden=false;
  Object.defineProperty(document,'hidden',{get:()=>window.testHidden});
  window.Audio=class{constructor(src){this.src=src;this.paused=true;this.plays=0;this.released=false;window.testAudio.push(this);}play(){this.plays++;this.paused=false;return Promise.resolve();}pause(){this.paused=true;}removeAttribute(name){if(name==='src')this.src='';}load(){this.released=true;}};
 });
 await page.goto(`http://127.0.0.1:${server.address().port}`);await page.getByRole('button',{name:'开始阅读',exact:true}).click();
 const check=async unit=>{await page.waitForFunction(path=>window.testAudio.at(-1)?.src.endsWith(path),unitBgmPath(unit));const state=await page.evaluate(()=>window.testAudio.map(a=>({src:a.src,paused:a.paused,released:a.released,volume:a.volume,loop:a.loop})));assert.equal(state.at(-1).paused,false);assert.equal(state.at(-1).volume,.23);assert.equal(state.at(-1).loop,true);assert.ok(state.slice(0,-1).every(a=>a.paused&&a.released));};
 await check('light_sound');
 // With "all units" selected, clicking a directory also changes its music.
 await page.locator('.story-directory button').filter({hasText:'MORE MORE JUMP!'}).click();await check('idol');
 for(const [unit,name] of [['street','Vivid BAD SQUAD'],['theme_park','Wonderlands × Showtime'],['school_refusal','25时，在Nightcord。'],['piapro','VIRTUAL SINGER']]){await page.locator('.unit-filters').getByRole('button',{name,exact:true}).click();await check(unit);}
 await page.evaluate(()=>{window.testHidden=true;document.dispatchEvent(new Event('visibilitychange'));});await page.waitForFunction(()=>window.testAudio.at(-1).paused);
 await page.evaluate(()=>{window.testHidden=false;document.dispatchEvent(new Event('visibilitychange'));});await page.waitForFunction(()=>!window.testAudio.at(-1).paused);
 await page.locator('.episode-row').first().click();await page.waitForFunction(()=>window.testAudio.at(-1).paused);
 await page.getByRole('button',{name:'取消进入',exact:true}).click();await page.waitForFunction(()=>!window.testAudio.at(-1).paused);
 await page.getByRole('button',{name:'活动剧情',exact:true}).click();await page.waitForFunction(()=>window.testAudio.every(a=>a.paused&&a.released));
 await page.getByRole('button',{name:'主线剧情',exact:true}).click();await check('piapro');await page.getByRole('button',{name:'返回主界面',exact:true}).click();await page.waitForFunction(()=>window.testAudio.slice(0,-1).every(a=>a.paused&&a.released)&&!window.testAudio.at(-1).paused);
 console.log(JSON.stringify({allSixThemes:true,directorySwitch:true,loop:true,volume:true,backgroundPauseResume:true,downloadPauseAndCancelResume:true,leaveStopsAndReleases:true}));
}finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
