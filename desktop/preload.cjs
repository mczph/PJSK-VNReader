const {contextBridge,ipcRenderer}=require('electron');
contextBridge.exposeInMainWorld('sekaiDesktop',{
 initialState:ipcRenderer.sendSync('sekai:state'),
 writeState:(key,value)=>ipcRenderer.invoke('sekai:write-state',key,value),
 getInfo:()=>ipcRenderer.invoke('sekai:info'),
 onBackground:callback=>{const listener=(_,paused)=>callback(!!paused);ipcRenderer.on('sekai:background',listener);return()=>ipcRenderer.removeListener('sekai:background',listener);},
 setFullscreen:value=>ipcRenderer.invoke('sekai:window',value?'fullscreen':'windowed'),
 toggleFullscreen:()=>ipcRenderer.invoke('sekai:window','toggle-fullscreen'),
 isFullscreen:()=>ipcRenderer.invoke('sekai:window','fullscreen-state'),
 quit:()=>ipcRenderer.invoke('sekai:window','close'),
 minimize:()=>ipcRenderer.invoke('sekai:window','minimize'),
 restore:()=>ipcRenderer.invoke('sekai:window','restore'),
 openDataFolder:()=>ipcRenderer.invoke('sekai:open-data'),
 clearHttpCache:()=>ipcRenderer.invoke('sekai:clear-http-cache'),
 exportSaves:()=>ipcRenderer.invoke('sekai:export'),
 importSaves:()=>ipcRenderer.invoke('sekai:import')
});
