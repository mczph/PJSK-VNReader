import {chromium} from '@playwright/test';
import {spawn} from 'node:child_process';
import electron from 'electron';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import path from 'node:path';
const dataDir=path.resolve(process.env.SEKAI_TEST_DATA_DIR || 'artifacts/desktop-cdp-data');
const executable=process.env.SEKAI_TEST_EXE || electron,env={...process.env,SEKAI_USER_DATA:dataDir};delete env.ELECTRON_RUN_AS_NODE;
await fs.mkdir(dataDir,{recursive:true});
async function launch(){
 const child=spawn(executable,[...(process.env.SEKAI_TEST_EXE?[]:['.']),'--remote-debugging-port=9237'],{env,stdio:['ignore','pipe','pipe']});
 child.stderr.on('data',b=>process.stderr.write(b));child.stdout.on('data',b=>process.stdout.write(b));
 for(let n=0;n<150;n++){
  try{const browser=await chromium.connectOverCDP('http://127.0.0.1:9237');const page=browser.contexts()[0].pages()[0];if(page){await page.locator('.title-menu').waitFor({timeout:30000});return {browser,page,child};}await browser.close();}catch{}
  await new Promise(r=>setTimeout(r,200));
 }
 throw new Error('Desktop did not start');
}
async function close(app){if(!app.page.isClosed())await app.page.evaluate(()=>window.close());await new Promise(r=>setTimeout(r,1000));await app.browser.close();}
let app=await launch();
try{
 const {page}=app;assert.equal(await page.evaluate(()=>location.origin),'sekai://app');assert.equal(await page.evaluate(()=>typeof window.require),'undefined');
 const info=await page.evaluate(()=>window.sekaiDesktop.getInfo());
 await page.getByRole('button',{name:'全屏',exact:true}).click();await page.waitForFunction(()=>window.sekaiDesktop.isFullscreen());await page.getByRole('button',{name:'全屏',exact:true}).click();await page.waitForFunction(async()=>!await window.sekaiDesktop.isFullscreen());
 await page.getByRole('button',{name:'设置',exact:true}).click();assert.equal(await page.locator('.options-column').count(),4);
 assert.equal(await page.getByRole('button',{name:'退出游戏',exact:true}).count(),1);
 await page.getByRole('button',{name:'全屏模式',exact:true}).click();await page.getByRole('button',{name:'窗口模式',exact:true}).click();
 await page.getByRole('button',{name:'返回主界面',exact:true}).click();
 if(process.env.SEKAI_TEST_EXE)assert.equal(info.cacheDir,path.join(dataDir,'cache'));
 await page.evaluate(()=>window.sekaiDesktop.writeState('sekai.settings',{region:'jp',theme:'dark',performance:'eco',speed:0}));
 await page.evaluate(()=>window.sekaiDesktop.writeState('sekai.saves',{desktopTest:{text:'持久化测试'}}));
 await page.evaluate(()=>window.sekaiDesktop.writeState('sekai.progress',{'jp:desktopTest':{markedRead:true,total:3}}));
 await page.screenshot({path:'artifacts/desktop-home.png'});await close(app);app=await launch();const next=app.page;
 assert.equal(await next.evaluate(()=>window.sekaiDesktop.initialState['sekai.saves'].desktopTest.text),'持久化测试');
 assert.equal(await next.evaluate(()=>window.sekaiDesktop.initialState['sekai.progress']['jp:desktopTest'].markedRead),true);
 const errors=[];next.on('pageerror',e=>errors.push(e.message));next.on('console',m=>{if(m.type()==='error'||m.type()==='warning')console.log(m.text());});
 await app.browser.contexts()[0].addInitScript(()=>{
  window.__draws=0;for(const proto of [WebGLRenderingContext.prototype,WebGL2RenderingContext.prototype]){const draw=proto.drawElements;proto.drawElements=function(...args){window.__draws++;return draw.apply(this,args);};}
  const Original=window.Audio;window.__sounds=[];window.Audio=function(...args){const a=new Original(...args);window.__sounds.push(a);return a;};window.Audio.prototype=Original.prototype;
 });
 await next.reload();await next.locator('.title-menu').waitFor();
 await next.locator('.title-brand').click();await next.waitForFunction(()=>window.__sounds.some(a=>a.src.includes('bgm00018')&&!a.paused&&a.currentTime>.1),null,{timeout:45000});
 await next.evaluate(()=>window.sekaiDesktop.minimize());await next.waitForFunction(()=>window.__sounds.every(a=>a.paused));await next.evaluate(()=>window.sekaiDesktop.restore());await next.waitForFunction(()=>window.__sounds.some(a=>a.src.includes('bgm00018')&&!a.paused));
 const catalog=await next.evaluate(async()=>{const r=await fetch('/api/catalog?region=jp&type=personal&refresh=1');return r.json();});assert.ok(catalog.length>100,JSON.stringify(catalog));
 await next.getByRole('button',{name:'开始阅读',exact:false}).click();
 await next.locator('.unit-filters').getByRole('button',{name:'MORE MORE JUMP!',exact:true}).click();
 await next.waitForFunction(()=>window.__sounds.some(a=>a.src.includes('bgm_area00002')&&!a.paused&&a.currentTime>.1),null,{timeout:45000});
 await next.evaluate(()=>window.sekaiDesktop.minimize());await next.waitForFunction(()=>window.__sounds.every(a=>a.paused));
 await next.evaluate(()=>window.sekaiDesktop.restore());await next.waitForFunction(()=>window.__sounds.some(a=>a.src.includes('bgm_area00002')&&!a.paused));
 await next.getByRole('button',{name:'个人剧情',exact:true}).click();await next.waitForFunction(()=>window.__sounds.every(a=>a.paused));
 await next.getByLabel('剧情角色').selectOption('1');await next.waitForFunction(()=>document.querySelectorAll('.episode-row').length===2);
 await next.waitForFunction(()=>{const i=document.querySelector('.poster-image');return i?.complete&&i.naturalWidth>300;});await next.screenshot({path:'artifacts/desktop-personal.png'});
 await next.locator('.episode-row').first().click();await next.locator('.dialogue').waitFor({timeout:150000});
 await next.waitForFunction(()=>window.__draws>0&&window.__sounds.some(a=>!a.paused&&a.currentTime>.1),null,{timeout:20000}).catch(async error=>{console.log(await next.evaluate(()=>({draws:window.__draws,models:document.querySelector('.live2d-host')?.dataset.models,paused:document.hidden,sounds:window.__sounds?.map(a=>({src:a.src,paused:a.paused,time:a.currentTime,error:a.error?.message})),text:document.body.innerText.slice(-800)})));throw error;});
 assert.equal(await next.locator('.live2d-host').getAttribute('data-fps'),'30');
 await next.keyboard.press('a');assert.equal(await next.getByRole('button',{name:'自动',exact:true}).evaluate(e=>e.classList.contains('on')),true);await next.keyboard.press('a');
 await next.keyboard.press('Shift+S');await next.getByRole('heading',{name:'保存这一刻',exact:true}).waitFor();await next.keyboard.press('Escape');await next.keyboard.press('F5');await next.waitForFunction(()=>JSON.parse(localStorage.getItem('sekai.saves'))?.['快速']);
 await next.keyboard.press('b');await next.locator('.backlog-modal').waitFor();await next.keyboard.press('Escape');
 await next.screenshot({path:'artifacts/desktop-player.png'});
 await next.getByRole('button',{name:'全屏',exact:true}).click();await next.waitForFunction(()=>window.sekaiDesktop.isFullscreen());await next.getByRole('button',{name:'全屏',exact:true}).click();await next.waitForFunction(async()=>!await window.sekaiDesktop.isFullscreen());
 await next.evaluate(()=>window.sekaiDesktop.minimize());
 await next.waitForFunction(()=>document.querySelector('.story-stage')?.dataset.paused==='true',null,{polling:100});const draws=await next.evaluate(()=>window.__draws);
 await new Promise(r=>setTimeout(r,500));assert.equal(await next.evaluate(()=>window.__draws),draws,'minimized application stops rendering');
 assert.equal(await next.evaluate(()=>window.__sounds.filter(a=>!a.ended).every(a=>a.paused)),true);
 await next.evaluate(()=>window.sekaiDesktop.restore());await next.waitForFunction(()=>document.querySelector('.story-stage')?.dataset.paused==='false');
 await next.waitForFunction(n=>window.__draws>n,draws);assert.deepEqual(errors,[]);
 await next.getByRole('button',{name:'返回主界面',exact:true}).click();await next.getByRole('button',{name:'资源管理',exact:true}).click();
 await next.getByLabel('下载剧情类型').selectOption('personal');await next.waitForFunction(()=>document.querySelector('.download-chapter')?.textContent.includes('角色介绍'));
 const cardIndex=catalog.findIndex(e=>e.id==='card-1');assert.ok(cardIndex>=0&&cardIndex<500);await next.locator('.download-chapter').nth(cardIndex).locator('input').check();await next.getByRole('button',{name:'下载所选 1 章',exact:true}).click();
 await next.waitForFunction(()=>[...document.querySelectorAll('.queue-item')].some(e=>e.textContent.includes('已缓存')),null,{timeout:120000});
 const resources=await next.evaluate(async()=>{const r=await fetch('/api/resources');return r.json();});assert.ok(resources.bytes>0);assert.ok(resources.items.some(i=>i.owners.includes('jp:card-1')));
 await next.screenshot({path:'artifacts/desktop-resource-queue.png'});assert.deepEqual(errors,[]);
 if(process.env.SEKAI_TEST_CLEAR==='1'){await next.getByRole('button',{name:'资源文件',exact:true}).click();await next.getByRole('button',{name:'一键清空缓存',exact:true}).click();await next.getByRole('button',{name:'确认清空缓存',exact:true}).click();await next.waitForFunction(()=>document.querySelector('.resource-summary')?.textContent.includes('0 个文件'));assert.equal(await next.evaluate(()=>JSON.parse(localStorage.getItem('sekai.saves')).desktopTest.text),'持久化测试');assert.equal(await next.evaluate(()=>JSON.parse(localStorage.getItem('sekai.progress'))['jp:desktopTest'].markedRead),true);}
 console.log(JSON.stringify({desktop:true,packaged:!!process.env.SEKAI_TEST_EXE,persistentState:true,personalEntries:catalog.length,gpu:info.gpu.webgl,realVoice:true,homeBgm:true,shortcuts:true,unitBgm:true,unitBgmPausedOnMinimize:true,renderPausedOnMinimize:true,resourceQueue:true,resourceFiles:resources.count}));
}finally{await close(app);}
