export async function prepareEffects(story,region,download,progress,getAsset){
 const effects={},events=[...story.lines.flatMap(l=>l.events),...story.outro];
 const names=[...new Set(events.filter(e=>e.kind==='effect'&&e.data.EffectType===15).map(e=>e.data.StringValSub || e.data.StringVal).filter(Boolean))];
 for(const value of names){const name=value.split('/').filter(Boolean).at(-1);if(!/^[\w-]+$/.test(name))continue;
  try{const bucket=`https://storage.sekai.best/sekai-${region==='tw'?'tc':region}-assets/`,prefix=`scenario/effect/${name}/`;
   let xml='';try{xml=(await download(bucket+'?list-type=2&prefix='+encodeURIComponent(prefix))).toString();}catch(e){if(region==='jp')throw e;}
   const extract=text=>[...text.matchAll(/<Key>([^<]+)<\/Key>/g)].map(m=>m[1]).filter(p=>p.endsWith('.webp'));
   let paths=extract(xml);if(!paths.length&&region!=='jp'){xml=(await download('https://storage.sekai.best/sekai-jp-assets/?list-type=2&prefix='+encodeURIComponent(prefix))).toString();paths=extract(xml);}
   const files=[];for(const p of paths){progress.add(1);try{if(getAsset)await getAsset(region,p);else await download(bucket+p);files.push(`/assets/${region}/${p}`);}catch{progress.warning('特效纹理缺失：'+p);}finally{progress.done();}}
   effects[value]={name,textures:files};
  }catch{progress.warning('特效纹理目录不可用：'+name);}
 }
 return effects;
}
