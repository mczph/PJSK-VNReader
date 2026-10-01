import {app,BrowserWindow,utilityProcess,protocol,net,ipcMain,dialog,shell,Menu} from 'electron';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const here=path.dirname(fileURLToPath(import.meta.url));
protocol.registerSchemesAsPrivileged([{scheme:'sekai',privileges:{standard:true,secure:true,supportFetchAPI:true,corsEnabled:true,stream:true}}]);
if(process.env.SEKAI_USER_DATA)app.setPath('userData',path.resolve(process.env.SEKAI_USER_DATA));
const proxy=process.env.HTTPS_PROXY || process.env.HTTP_PROXY;if(proxy){app.commandLine.appendSwitch('proxy-server',proxy);app.commandLine.appendSwitch('proxy-bypass-list','localhost;127.0.0.1;[::1]');}
const keys=new Set(['sekai.settings','sekai.saves','sekai.resume','sekai.progress','sekai.history']);let state={},writer=Promise.resolve(),window,worker,closing=false;
if(!app.requestSingleInstanceLock())app.quit();else app.whenReady().then(async()=>{
 app.on('second-instance',()=>{if(window){if(window.isMinimized())window.restore();window.focus();}});
 const dataDir=app.getPath('userData'),stateFile=path.join(dataDir,'reader-state.json'),cacheDir=app.isPackaged?path.join(dataDir,'cache'):path.resolve(here,'../.cache');await fs.mkdir(dataDir,{recursive:true});
 try{state=JSON.parse(await fs.readFile(stateFile,'utf8'));}catch{}
 const validSender=e=>{if(!e.senderFrame?.url.startsWith('sekai://app/'))throw new Error('Unsupported caller');};
 const persist=()=>writer=writer.catch(()=>{}).then(async()=>{await fs.writeFile(stateFile+'.tmp',JSON.stringify(state));await fs.rename(stateFile+'.tmp',stateFile);});
 ipcMain.on('sekai:state',e=>{validSender(e);e.returnValue=state;});
 ipcMain.handle('sekai:write-state',async(e,key,value)=>{validSender(e);if(!keys.has(key)||JSON.stringify(value).length>8*1024*1024)throw new Error('Unsupported state');state[key]=value;await persist();});
 ipcMain.handle('sekai:info',async e=>{validSender(e);let bytes=0,files=0;for(const item of await fs.readdir(cacheDir,{withFileTypes:true})){if(!item.isFile())continue;const s=await fs.stat(path.join(cacheDir,item.name));bytes+=s.size;files++;}return {version:app.getVersion(),dataDir,cacheDir,bytes,files,gpu:app.getGPUFeatureStatus()};});
 ipcMain.handle('sekai:open-data',e=>{validSender(e);return shell.openPath(dataDir);});
 ipcMain.handle('sekai:clear-http-cache',async e=>{validSender(e);await window.webContents.session.clearCache();});
 ipcMain.handle('sekai:window', (e,action)=>{validSender(e);if(action==='minimize')window?.minimize();else if(action==='restore'){window?.restore();window?.focus();}else if(action==='close')window?.close();else if(action==='fullscreen')window?.setFullScreen(true);else if(action==='windowed')window?.setFullScreen(false);else if(action==='toggle-fullscreen')window?.setFullScreen(!window.isFullScreen());else if(action==='fullscreen-state')return window?.isFullScreen() || false;else throw new Error('Unsupported window action');});
 ipcMain.handle('sekai:export',async e=>{validSender(e);const {canceled,filePath}=await dialog.showSaveDialog(window,{defaultPath:'SEKAI-NOVEL-saves.json',filters:[{name:'存档备份',extensions:['json']}]});if(canceled)return false;await fs.writeFile(filePath,JSON.stringify({format:'sekai-novel',version:1,state},null,2));return true;});
 ipcMain.handle('sekai:import',async e=>{validSender(e);const {canceled,filePaths}=await dialog.showOpenDialog(window,{properties:['openFile'],filters:[{name:'存档备份',extensions:['json']}]});if(canceled)return false;const data=await fs.readFile(filePaths[0],'utf8');if(data.length>8*1024*1024)throw new Error('备份文件过大');const backup=JSON.parse(data);if(backup.format!=='sekai-novel'||!backup.state||typeof backup.state!=='object')throw new Error('无法识别该存档备份');for(const key of keys)if(backup.state[key]!==undefined)state[key]=backup.state[key];await persist();return true;});
 try{
  worker=utilityProcess.fork(path.join(here,'service.mjs'),[cacheDir,path.join(here,'../dist')],{serviceName:'SEKAI resource service',stdio:'pipe'});worker.stderr?.on('data',data=>console.error(data.toString()));
  const url=await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(new Error('资源服务启动超时')),20000);worker.on('message',m=>{if(m.type==='ready'){clearTimeout(timer);resolve(m.url);}if(m.type==='error'){clearTimeout(timer);reject(new Error(m.message));}});worker.once('exit',code=>{clearTimeout(timer);reject(new Error('资源服务退出：'+code));});});
  console.log('Desktop resource service: '+url);
  protocol.handle('sekai',async request=>{const source=new URL(request.url);if(source.hostname!=='app')return new Response('Not found',{status:404});const body=['GET','HEAD'].includes(request.method)?undefined:await request.arrayBuffer();return fetch(url+source.pathname+source.search,{method:request.method,headers:request.headers,body:body?.byteLength?body:undefined});});
  window=new BrowserWindow({width:1440,height:900,minWidth:960,minHeight:640,title:'SEKAI NOVEL',icon:path.join(here,'assets/icon.png'),backgroundColor:'#091423',show:false,autoHideMenuBar:true,webPreferences:{preload:path.join(here,'preload.cjs'),contextIsolation:true,nodeIntegration:false,sandbox:true,backgroundThrottling:true}});
  for(const event of ['minimize','hide'])window.on(event,()=>window.webContents.send('sekai:background',true));
  for(const event of ['restore','show'])window.on(event,()=>window.webContents.send('sekai:background',false));
  window.webContents.setWindowOpenHandler(({url})=>{if(['https://sekai.best','https://github.com'].includes(new URL(url).origin))shell.openExternal(url);return {action:'deny'};});window.webContents.on('will-navigate',(e,url)=>{if(!url.startsWith('sekai://app/'))e.preventDefault();});window.webContents.session.setPermissionRequestHandler((contents,permission,callback)=>callback(false));
  Menu.setApplicationMenu(Menu.buildFromTemplate([{label:'程序',submenu:[{label:'打开数据目录',click:()=>shell.openPath(dataDir)},{type:'separator'},{role:'quit',label:'退出'}]},{label:'窗口',submenu:[{role:'togglefullscreen',label:'全屏',accelerator:'F11'},{role:'minimize',label:'最小化'},...(!app.isPackaged?[{role:'toggleDevTools',label:'开发工具'}]:[])]}]));
  window.once('ready-to-show',()=>window.show());await window.loadURL('sekai://app/');
  worker.on('exit',code=>{if(!closing){dialog.showErrorBox('资源服务已停止','请重新启动程序。退出码：'+code);app.quit();}});
 }catch(e){console.error(e);dialog.showErrorBox('SEKAI NOVEL 启动失败',e.message);app.quit();}
 app.on('before-quit',e=>{if(closing)return;e.preventDefault();closing=true;writer.catch(()=>{}).finally(()=>{worker?.postMessage({type:'shutdown'});worker?.kill();app.quit();});});app.on('window-all-closed',()=>app.quit());
}).catch(error=>{dialog.showErrorBox('SEKAI NOVEL 启动失败',error.message);app.quit();});
