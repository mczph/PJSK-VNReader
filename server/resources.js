import fs from 'node:fs/promises';
import path from 'node:path';
export const assetBucket=r=>`https://storage.sekai.best/sekai-${r==='tw'?'tc':r}-assets/`;
const isMedia=p=>/\.(webp|png|jpe?g|mp3|wav|ogg|mp4)$/i.test(p);
// Keep the selected region's script and localization. Only missing media may
// use the shared Japanese game assets, which include the original voice tracks.
export async function createAssetLoader(download,root){
 const indexPath=path.join(root,'resource-sources.json');let sources={};
 try{sources=JSON.parse(await fs.readFile(indexPath,'utf8'));}catch{}
 const pending=new Map();let writing=Promise.resolve();
 function persist(){writing=writing.catch(()=>{}).then(async()=>{await fs.writeFile(indexPath+'.tmp',JSON.stringify(sources));await fs.rename(indexPath+'.tmp',indexPath);});return writing;}
 async function load(region,p){
  const requested=assetBucket(region)+p,known=sources[requested];
  if(known){try{return {data:await download(known),sourceUrl:known,sourceRegion:known.startsWith(assetBucket('jp'))?'jp':region};}catch{delete sources[requested];}}
  try{return {data:await download(requested),sourceUrl:requested,sourceRegion:region};}
  catch(e){if(region==='jp'||!isMedia(p)||![403,404].includes(e.status))throw e;}
  const source=assetBucket('jp')+p,data=await download(source);sources[requested]=source;await persist();return {data,sourceUrl:source,sourceRegion:'jp'};
 }
 const loader=(region,p)=>{const key=region+':'+p;if(pending.has(key))return pending.get(key);const task=load(region,p).finally(()=>pending.delete(key));pending.set(key,task);return task;};
 loader.clear=async()=>{await writing.catch(()=>{});sources={};await persist();};return loader;
}
