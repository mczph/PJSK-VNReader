import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeStory, mediaPaths,moviePath } from '../server/story.js';
import { sampleCurve } from '../src/cubism-curves.js';
test('unit opening movie uses the real filename inside the opening bundle',()=>{assert.equal(moviePath('school_refusal_opening'),'movie/school_refusal_opening/school_refusal.mp4');assert.equal(moviePath('event_movie'),'scenario/movie/event_movie/event_movie.mp4');});
test('fullscreen narration is an independent voiced checkpoint and keeps its background',()=>{
 const raw={ScenarioId:'intro',FirstBackground:'opening',SpecialEffectData:[{EffectType:38},{EffectType:24,StringVal:'first',StringValSub:'voice1',Duration:.1},{EffectType:24,StringVal:'second',StringValSub:'voice2'},{EffectType:39},{EffectType:7,StringVal:'room'}],TalkData:[{Body:'dialogue'}],Snippets:[...Array.from({length:5},(_,i)=>({Action:6,ReferenceIndex:i,ProgressBehavior:1})),{Action:1,ReferenceIndex:0}]};
 const s=normalizeStory(raw);assert.equal(s.lines.length,3);assert.equal(s.lines[0].kind,'fullscreen');assert.equal(s.lines[0].voices[0].VoiceId,'voice1');assert.equal(s.lines[1].text,'second');assert.equal(s.lines[0].scene.textScreen,true);assert.equal(s.lines[2].scene.textScreen,false);assert.equal(s.lines[0].background,'opening');assert.ok(mediaPaths(s).includes('scenario/background/opening/opening.webp'));assert.ok(mediaPaths(s).includes('sound/scenario/voice/intro/voice2.mp3'));
});
test('narration after FullScreenTextHide does not keep the ordinary dialogue hidden',()=>{
 const s=normalizeStory({ScenarioId:'intro',SpecialEffectData:[{EffectType:38},{EffectType:24,StringVal:'first'},{EffectType:39},{EffectType:24,StringVal:'on black'}],Snippets:[...Array.from({length:4},(_,i)=>({Action:6,ReferenceIndex:i})),{Action:1,ReferenceIndex:0}],TalkData:[{Body:'dialogue'}]});
 assert.equal(s.lines[1].scene.textScreen,false);assert.equal(s.lines[1].kind,'fullscreen');assert.equal(s.lines[2].scene.fullText,'');assert.equal(s.lines[2].scene.textScreen,false);
});
test('initial backgrounds and intermediate BGM are cached and silence does not request an audio file',()=>{
 const s=normalizeStory({ScenarioId:'media',FirstBackground:'first',FirstBgm:'bgm00000',SpecialEffectData:[{EffectType:7,StringVal:'second'}],SoundData:[{Bgm:'middle',PlayMode:0},{Bgm:'bgm00000',PlayMode:0}],Snippets:[{Action:6,ReferenceIndex:0},{Action:7,ReferenceIndex:0},{Action:7,ReferenceIndex:1},{Action:1,ReferenceIndex:0}],TalkData:[{Body:'talk'}]});
 const paths=mediaPaths(s);assert.ok(paths.includes('scenario/background/first/first.webp'));assert.ok(paths.includes('sound/scenario/bgm/middle/middle.mp3'));assert.ok(!paths.some(p=>p.includes('bgm00000')));assert.equal(s.lines[0].bgm,'');
});
test('motion on a hidden character updates the cast without making the character reappear',()=>{
 const s=normalizeStory({FirstLayout:[{Character2dId:5,CostumeType:'minori',PositionSide:4}],LayoutData:[{Type:3,Character2dId:5},{Type:0,Character2dId:5,FacialName:'smile'}],Snippets:[{Action:2,ReferenceIndex:0},{Action:4,ReferenceIndex:1},{Action:1,ReferenceIndex:0}],TalkData:[{Body:'offstage'}]});assert.equal(Object.keys(s.lines[0].scene.actors).length,0);assert.equal(s.lines[0].scene.cast[5].facial,'smile');
});
test('jump targets preserve accumulated background and BGM state',()=>{
 const raw={ScenarioId:'example',FirstBackground:'bg1',FirstBgm:'song1',Snippets:[{Action:1,ReferenceIndex:0},{Action:6,ReferenceIndex:0},{Action:7,ReferenceIndex:0},{Action:1,ReferenceIndex:1}],TalkData:[{Body:'first',WindowDisplayName:'A',Voices:[{VoiceId:'voice1'}]},{Body:'second',WindowDisplayName:'B'}],SpecialEffectData:[{EffectType:7,StringVal:'caption',StringValSub:'bg2'}],SoundData:[{PlayMode:1,Bgm:'song2'}]};
 const story=normalizeStory(raw);assert.equal(story.lines[0].background,'bg1');assert.equal(story.lines[1].background,'bg2');assert.equal(story.lines[1].bgm,'song2');assert.ok(mediaPaths(story).includes('sound/scenario/voice/example/voice1.mp3'));
});
test('repeated media is downloaded once and empty scripts fail clearly',()=>{
 const story={scenarioId:'sample',lines:Array(3).fill({background:'bg',bgm:'song',voices:[]})};assert.equal(mediaPaths(story).length,2);assert.throws(()=>normalizeStory({Snippets:[]}));
});
test('snapshots restore actors, facial expressions, camera and persistent effects across jumps',()=>{
 const raw={ScenarioId:'restore',FirstLayout:[{Character2dId:5,CostumeType:'minori',PositionSide:3,MotionName:'idle',FacialName:'normal'}],Snippets:[{Action:1,ReferenceIndex:0},{Action:6,ReferenceIndex:0},{Action:6,ReferenceIndex:1},{Action:1,ReferenceIndex:1},{Action:2,ReferenceIndex:0},{Action:1,ReferenceIndex:2}],TalkData:[{Body:'A'},{Body:'B',Motions:[{Character2dId:5,FacialName:'smile'}]},{Body:'C'}],SpecialEffectData:[{EffectType:43,StringVal:'1.4'},{EffectType:15,StringValSub:'kirakira_01'}],LayoutData:[{Character2dId:5,Type:3}]};
 const s=normalizeStory(raw);assert.equal(s.lines[0].scene.actors[5].side,3);assert.equal(s.lines[1].before.actors[5].facial,'normal');assert.equal(s.lines[1].scene.actors[5].facial,'smile');assert.equal(s.lines[1].scene.camera.zoom,1.4);assert.equal(s.lines[2].scene.particles,'kirakira_01');assert.equal(Object.keys(s.lines[2].scene.actors).length,0);assert.ok(s.models[0].facials.includes('smile'));assert.equal(s.lines[1].events[0].data.EffectType,43);
});
test('motion3 sampler evaluates linear, Bezier and stepped curves',()=>{
 assert.equal(sampleCurve([0,0,0,1,1],.5),.5);assert.equal(sampleCurve([0,0,2,1,1],.5),0);assert.equal(sampleCurve([0,0,3,1,1],.5),1);assert.ok(Math.abs(sampleCurve([0,0,1,.3,.3,.7,.7,1,1],.5)-.5)<.001);assert.equal(sampleCurve([0,0,0,1,1],9),1);
});
test('reappearing characters retain costumes, and expression actions do not change position',()=>{
 const raw={ScenarioId:'return',FirstLayout:[{Character2dId:5,CostumeType:'minori',PositionSide:4}],Snippets:[{Action:2,ReferenceIndex:0},{Action:1,ReferenceIndex:0},{Action:2,ReferenceIndex:1},{Action:2,ReferenceIndex:2},{Action:1,ReferenceIndex:1}],LayoutData:[{Type:3,Character2dId:5},{Type:2,Character2dId:5,CostumeType:'',SideTo:4},{Type:0,Character2dId:5,SideTo:3,MotionName:'nod'}],TalkData:[{Body:'offstage'},{Body:'returned'}]};
 const s=normalizeStory(raw);assert.equal(Object.keys(s.lines[0].scene.actors).length,0);assert.equal(s.lines[1].scene.actors[5].costume,'minori');assert.equal(s.lines[1].scene.actors[5].side,4);assert.ok(s.models[0].motions.includes('nod'));
});
