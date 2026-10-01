import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
export const resourceKey=url=>crypto.createHash('sha256').update(url).digest('hex');
export async function createResourceStore(root){
 const file=path.join(root,'resource-index.json');let records={},writing=Promise.resolve(),timer;
 try{records=JSON.parse(await fs.readFile(file,'utf8'));}catch{}
 const persist=()=>writing=writing.catch(()=>{}).then(async()=>{await fs.writeFile(file+'.tmp',JSON.stringify(records));await fs.rename(file+'.tmp',file);});
 function flush(){clearTimeout(timer);timer=undefined;return persist();}
 function record(url,size,owner){const key=resourceKey(url),previous=records[key];records[key]={url,size,updated:previous?.updated || Date.now(),owners:[...new Set([...(previous?.owners || []),...(owner?[owner]:[])])]};if((!previous||previous.size!==size||(owner&&!previous.owners?.includes(owner)))&&!timer)timer=setTimeout(()=>{timer=undefined;persist().catch(e=>console.error('资源索引保存失败：'+e.message));},100);}
 async function list(){const entries=await fs.readdir(root,{withFileTypes:true}),items=[];for(const e of entries){if(!e.isFile()||!/^([a-f0-9]{64})$/.test(e.name))continue;try{const stat=await fs.stat(path.join(root,e.name)),r=records[e.name];items.push({key:e.name,url:r?.url || '',size:stat.size,updated:r?.updated || stat.mtimeMs,owners:r?.owners || [],kind:!r?'legacy':/live2d|\.moc3|\.model3|\.motion3/.test(r.url)?'live2d':/\.(mp3|wav|ogg)$/.test(r.url)?'audio':/\.(webp|png|jpg)$/.test(r.url)?'image':/\.mp4$/.test(r.url)?'video':/\.asset$/.test(r.url)?'script':'metadata'});}catch{}}
 return {items,bytes:items.reduce((s,i)=>s+i.size,0),count:items.length};}
 async function remove(keys){if(!Array.isArray(keys)||keys.length>10000||keys.some(k=>!/^[a-f0-9]{64}$/.test(k)))throw new Error('无效资源标识');const owners=new Set();let bytes=0,count=0;for(const key of new Set(keys)){const target=path.resolve(root,key);if(path.dirname(target)!==path.resolve(root))throw new Error('无效缓存路径');try{const stat=await fs.lstat(target);if(!stat.isFile())continue;await fs.unlink(target);bytes+=stat.size;count++;for(const o of records[key]?.owners || [])owners.add(o);delete records[key];}catch(e){if(e.code!=='ENOENT')throw e;}}await persist();return {bytes,count,owners:[...owners]};}
 async function clear(){await flush();const {items}=await list();let bytes=0,count=0;const owners=new Set();for(let n=0;n<items.length;n+=10000){const result=await remove(items.slice(n,n+10000).map(i=>i.key));bytes+=result.bytes;count+=result.count;result.owners.forEach(o=>owners.add(o));}records={};await flush();for(const e of await fs.readdir(root)){if(!/^[a-f0-9]{64}\.tmp$/.test(e))continue;const target=path.resolve(root,e);if(path.dirname(target)!==path.resolve(root))throw new Error('无效缓存路径');const stat=await fs.lstat(target);if(stat.isFile()){await fs.unlink(target);bytes+=stat.size;count++;}}return {bytes,count,owners:[...owners]};}
 return {record,list,remove,flush,clear};
}
