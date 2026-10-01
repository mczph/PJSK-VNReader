import {chromium} from '@playwright/test';
import fs from 'node:fs/promises';
const base='https://storage.sekai.best/sekai-jp-assets/';
const browser=await chromium.launch();
try{
 const page=await browser.newPage(),results=[];
 const events=await(await fetch('https://sekai-world.github.io/sekai-master-db-diff/eventStories.json')).json();
 const paths=['scenario/background/bg_a002201/bg_a002201','story/background/main_idol/background',`event_story/${events[0].assetbundleName}/screen_image/story_bg`,'character/member/res001_no001/card_normal','character/member_small/res001_no001/card_normal','character/character_sd_l/chr_sp_1'];
 for(const path of paths){
  const images=[];
  for(const ext of ['png','webp']){const response=await fetch(base+path+'.'+ext);if(!response.ok){images.push({ext,status:response.status});continue;}const bytes=Buffer.from(await response.arrayBuffer());images.push({ext,bytes:bytes.length,data:`data:image/${ext};base64,${bytes.toString('base64')}`});}
  const decoded=await page.evaluate(async images=>{const all=[];for(const image of images){if(!image.data){all.push(image);continue;}const img=new Image();img.src=image.data;await img.decode();const canvas=document.createElement('canvas');canvas.width=img.naturalWidth;canvas.height=img.naturalHeight;const ctx=canvas.getContext('2d');ctx.drawImage(img,0,0);all.push({ext:image.ext,bytes:image.bytes,width:canvas.width,height:canvas.height,pixels:ctx.getImageData(0,0,canvas.width,canvas.height).data});}let differences=null;if(all.length===2&&all[0].pixels&&all[1].pixels&&all[0].width===all[1].width&&all[0].height===all[1].height){differences=0;for(let i=0;i<all[0].pixels.length;i++)if(all[0].pixels[i]!==all[1].pixels[i])differences++;}return {images:all.map(({pixels,...info})=>info),differentChannels:differences};},images);
  results.push({path,...decoded});
 }
 const list=await(await fetch('https://storage.sekai.best/sekai-live2d-assets/live2d/model_list.json')).json();const item=list.find(m=>m.modelBase==='ichika') || list.find(m=>/ichika/.test(m.modelBase)) || list[0];
 const modelBase='https://storage.sekai.best/sekai-live2d-assets/live2d/model/'+item.modelPath+'/';const manifest=await(await fetch(modelBase+item.modelFile)).json();
 const texture=manifest.FileReferences.Textures[0],response=await fetch(modelBase+texture),bytes=Buffer.from(await response.arrayBuffer());
 const size=await page.evaluate(async data=>{const image=new Image();image.src=data;await image.decode();return {width:image.naturalWidth,height:image.naturalHeight};},'data:image/png;base64,'+bytes.toString('base64'));
 results.push({live2d:item.modelBase,texture,bytes:bytes.length,...size});
 await fs.mkdir('artifacts',{recursive:true});await fs.writeFile('artifacts/image-quality-audit.json',JSON.stringify(results,null,2));console.log(JSON.stringify(results,null,2));
}finally{await browser.close();}
