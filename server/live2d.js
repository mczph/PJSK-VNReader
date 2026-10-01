const base='https://storage.sekai.best/sekai-live2d-assets/';
export async function prepareModels(story,download,progress) {
  const list=JSON.parse((await download(base+'live2d/model_list.json')).toString()),result=[];
  async function get(p){try{return {path:p,data:await download(base+p)};}catch(e){if(p===p.toLowerCase())throw e;return {path:p.toLowerCase(),data:await download(base+p.toLowerCase())};}}
  for(const used of story.models){
    const item=list.find(m=>m.modelBase===used.costume);
    if(!item){progress.warning(`模型不存在：${used.costume}`);continue;}
    try{
      const dir=`live2d/model/${item.modelPath}/`;
      const source=await get(dir+item.modelFile),manifest=JSON.parse(source.data.toString());
      const refs=manifest.FileReferences,paths=[refs.Moc,...refs.Textures,refs.Physics].filter(Boolean),resolved={};
      for(const p of paths){progress.add(1);let file;try{file=await get(dir+p);}catch(e){if(!p.endsWith('.moc3'))throw e;file=await get(dir+p+'.bytes');}resolved[p]='/assets/live2d/'+file.path;progress.done();}
      refs.Moc=resolved[refs.Moc];refs.Textures=refs.Textures.map(p=>resolved[p]);if(refs.Physics)refs.Physics=resolved[refs.Physics];
      let motionDir='';const parent=item.modelPath.split('/').slice(0,-1).join('/');let name=item.modelBase;
      while(name){const candidate=`live2d/motion/${parent}/${name}_motion_base/`;try{await get(candidate+'BuildMotionData.json');motionDir=candidate;break;}catch{name=name.includes('_')?name.split('_').slice(0,-1).join('_'):'';}}
      refs.Motions={Motion:[],Expression:[]};delete refs.Expressions;
      for(const [group,names,type] of [['Motion',used.motions,'motion'],['Expression',used.facials,'facial']])for(const name of names){
        progress.add(1);
        try{let file;const clean=name.replace(/-additional$/,'');try{if(!motionDir)throw new Error('base');file=await get(`${motionDir}${type}/${clean}.motion3.json`);}catch{file=await get(`${dir}motions/${clean}.motion3.json`);}
          refs.Motions[group].push({Name:name,File:'/assets/live2d/'+file.path,FadeInTime:0.15,FadeOutTime:0.15});
        }catch{progress.warning(`动作缺失：${used.costume}/${name}`);}finally{progress.done();}
      }
      manifest.Groups=manifest.Groups || [];for(const g of manifest.Groups){if(g.Name==='EyeBlink'&&!g.Ids.length)g.Ids=['ParamEyeLOpen','ParamEyeROpen'];if(g.Name==='LipSync'&&!g.Ids.length)g.Ids=['ParamMouthOpenY'];}
      result.push({...used,manifest});
    }catch(e){progress.warning(`模型加载失败：${used.costume}（${e.message}）`);}
  }
  return result;
}
