const copy = value => structuredClone(value);
export function moviePath(name){const opening=name.includes('opening');return `${opening?'movie':'scenario/movie'}/${name}/${opening?name.replace(/_opening$/,''):name}.mp4`;}
export function soundEffectPath(sound) {
  if (!sound.Se) return '';
  if (sound.Se.startsWith('se_event')) return `event_story/${sound.Se.split('_').slice(1,-1).join('_')}/${sound.SeBundleName || 'scenario_se'}/${sound.Se}.mp3`;
  const pack=/^se\d{5}$/.test(sound.Se) && Number(sound.Se.slice(2))<=528 ? 'se_pack00001' : 'se_pack00001_b';
  return `sound/scenario/se/${sound.SeBundleName || pack}/${sound.Se}.mp3`;
}
export function updateScene(scene,event) {
  const d=event.data;
  if(event.kind==='layout') {
    scene.cast ||= {};
    const key=String(d.Character2dId),old=scene.actors[key] || scene.cast[key] || {};
    if(d.Type===3){scene.cast[key]=copy(old);delete scene.actors[key];}
    else {const motionOnly=[0,6].includes(d.Type);const actor={...old,id:d.Character2dId,costume:d.CostumeType || old.costume,side:motionOnly?(old.side || 4):(d.SideTo || old.side || 4),offset:motionOnly?(old.offset || 0):(d.SideToOffsetX ?? old.offset ?? 0),motion:d.MotionName || old.motion,facial:d.FacialName || old.facial,depth:d.DepthType ?? old.depth ?? 0};scene.cast[key]=copy(actor);if(!motionOnly||scene.actors[key])scene.actors[key]=actor;}
  }
  if(event.kind==='motion') for(const m of d.Motions || []) {
    const actor=scene.actors[m.Character2dId];if(actor){if(m.MotionName)actor.motion=m.MotionName;if(m.FacialName)actor.facial=m.FacialName;}
  }
  if(event.kind==='sound') {
    if([0,1].includes(d.PlayMode) && d.Bgm){scene.bgm=d.Bgm==='bgm00000'?'':d.Bgm;scene.bgmVolume=d.Volume ?? 1;scene.bgmDuration=d.Duration || 0;}
    if(d.PlayMode===4)scene.bgmVolume=d.Volume;
  }
  if(event.kind==='mode')scene.modelMode=d.CharacterLayoutMode;
  if(event.kind!=='effect')return;
  const v=d.StringValSub || d.StringVal || '';
  switch(d.EffectType){
    case 1:case 3:case 20:case 40:case 29:case 31:case 33:case 35:scene.cover=null;break;
    case 2:case 30:case 32:case 34:case 36:scene.cover='black';break;
    case 4:case 21:case 41:scene.cover='white';break;
    case 7:case 17:scene.background=v;break;
    case 8:case 18:scene.place=d.StringVal;break;
    case 9:case 27:scene.memory=true;break;
    case 10:case 28:scene.memory=false;break;
    case 11:scene.still=v;break;
    case 12:scene.ambient='normal';break;
    case 13:scene.ambient='evening';break;
    case 14:scene.ambient='night';break;
    case 15:scene.particles=v;break;
    case 16:scene.particles='';break;
    case 22:if(scene.actors[d.IntVal])scene.actors[d.IntVal].shader=d.StringVal;break;
    case 24:scene.fullText=d.StringVal;break;
    case 38:scene.textScreen=true;break;
    case 39:scene.textScreen=false;scene.fullText='';break;
    case 42:{const [x,y]=String(d.StringVal).split(',').map(Number);scene.camera={...scene.camera,x:x||0,y:y||0,duration:d.Duration || 0};break;}
    case 43:scene.camera={...scene.camera,zoom:Number(d.StringVal)||1,duration:d.Duration || 0};break;
    case 44:scene.blur=String(d.StringVal).toLowerCase()==='true';break;
  }
}
export function normalizeStory(raw) {
  const scene={background:raw.FirstBackground || '',bgm:raw.FirstBgm==='bgm00000'?'':raw.FirstBgm || '',bgmVolume:1,actors:{},modelMode:raw.FirstCharacterLayoutMode || 0,ambient:'normal',memory:false,particles:'',cover:null,camera:{x:0,y:0,zoom:1},blur:false,place:'',fullText:'',textScreen:false};
  const lines=[], models=new Map();let pending=[],before=copy(scene);
  for(const c of raw.AppearCharacters || [])models.set(c.CostumeType,{costume:c.CostumeType,id:c.Character2dId,motions:new Set(),facials:new Set()});
  function remember(){for(const actor of Object.values(scene.actors)){if(!actor.costume)continue;if(!models.has(actor.costume))models.set(actor.costume,{costume:actor.costume,id:actor.id,motions:new Set(),facials:new Set()});const model=models.get(actor.costume);if(actor.motion)model.motions.add(actor.motion);if(actor.facial)model.facials.add(actor.facial);}}
  function push(kind,data,snippet={}) {if(!data)return;const event={kind,data:copy(data),delay:snippet.Delay || 0,wait:snippet.ProgressBehavior===1};pending.push(event);updateScene(scene,event);remember();}
  for(const l of raw.FirstLayout || [])push('layout',{...l,Type:2,SideTo:l.PositionSide,SideToOffsetX:l.OffsetX});
  const initial=copy(scene);
  for (const snippet of raw.Snippets || []) {
    const i=snippet.ReferenceIndex;
    if([2,4].includes(snippet.Action))push('layout',raw.LayoutData?.[i],snippet);
    if(snippet.Action===6){
      const effect=raw.SpecialEffectData?.[i];push('effect',effect,snippet);
      if(effect?.EffectType===24){
        lines.push({kind:'fullscreen',speaker:'旁白',text:effect.StringVal || '',background:scene.background,bgm:scene.bgm,voices:effect.StringValSub?[{VoiceId:effect.StringValSub}]:[],characters:[],before,scene:copy(scene),events:pending,snippetIndex:snippet.Index});
        pending=[];before=copy(scene);
      }
    }
    if(snippet.Action===7)push('sound',raw.SoundData?.[i],snippet);
    if(snippet.Action===8)push('mode',raw.ScenarioSnippetCharacterLayoutModes?.[i],snippet);
    if(snippet.Action!==1)continue;
    const talk=raw.TalkData?.[i];if(!talk)continue;
    if(talk.RequirePlayEffect)push('effect',raw.SpecialEffectData?.[talk.EffectReferenceIdx]);
    if(talk.RequirePlaySound)push('sound',raw.SoundData?.[talk.SoundReferenceIdx]);
    scene.fullText='';
    push('motion',{Motions:talk.Motions || []},{Delay:snippet.Delay,ProgressBehavior:1});
    lines.push({speaker:talk.WindowDisplayName || '旁白',text:talk.Body || '',background:scene.background,bgm:scene.bgm,voices:talk.Voices || [],characters:talk.TalkCharacters || [],before,scene:copy(scene),events:pending,snippetIndex:snippet.Index});
    pending=[];before=copy(scene);
  }
  if(!lines.length)throw new Error('该脚本没有可读取的对白');
  return {version:2,scenarioId:raw.ScenarioId,initial,lines,outro:pending,finalScene:copy(scene),models:[...models.values()].filter(m=>m.costume).map(m=>({...m,motions:[...m.motions],facials:[...m.facials]})),unsupported:[...new Set((raw.Snippets || []).filter(s=>[3,5].includes(s.Action)).map(s=>s.Action))]};
}
export function voicePath(story,id){return `sound/${story.voiceType==='card'?'card_':''}scenario/voice/${story.scenarioId}/${id}.mp3`;}
export function mediaPaths(story) {
  const paths=new Set();
  for(const scene of [story.initial,...story.lines.map(l=>l.before),story.finalScene].filter(Boolean)){if(scene.background)paths.add(`scenario/background/${scene.background}/${scene.background}.webp`);if(scene.bgm)paths.add(`sound/scenario/bgm/${scene.bgm}/${scene.bgm}.mp3`);}
  for(const line of story.lines) {
    if(line.background)paths.add(`scenario/background/${line.background}/${line.background}.webp`);
    if(line.bgm)paths.add(`sound/scenario/bgm/${line.bgm}/${line.bgm}.mp3`);
    for(const v of line.voices)if(v.VoiceId)paths.add(voicePath(story,v.VoiceId));
  }
  for(const event of [...story.lines.flatMap(l=>l.events || []),...(story.outro || [])]) {
    if(event.kind==='sound'&&event.data.Bgm&&event.data.Bgm!=='bgm00000'){const bgm=event.data.Bgm;paths.add(`sound/scenario/bgm/${bgm}/${bgm}.mp3`);}
    if(event.kind==='effect'&&[7,17].includes(event.data.EffectType)){const bg=event.data.StringValSub || event.data.StringVal;if(bg)paths.add(`scenario/background/${bg}/${bg}.webp`);}
    if(event.kind==='sound'&&event.data.Se)paths.add(soundEffectPath(event.data));
    if(event.kind==='effect'&&event.data.EffectType===19)paths.add(moviePath(event.data.StringVal));
    if(event.kind==='effect'&&event.data.EffectType===24&&event.data.StringValSub)paths.add(voicePath(story,event.data.StringValSub));
  }
  return [...paths];
}
