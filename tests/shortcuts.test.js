import test from 'node:test';
import assert from 'node:assert/strict';
import {shortcutAction} from '../src/shortcuts.js';
const key=(key,extra={})=>shortcutAction({key,...extra});
test('reader shortcuts support playback, menus, quick slots and modifiers',()=>{
 for(const [input,action] of [['a','auto'],['K','skip'],['s','quickSave'],['F5','quickSave'],['F9','quickLoad'],['l','load'],['b','log'],['Backspace','log'],['j','jump'],['v','voice'],['h','hide'],['Escape','settings'],['f','fullscreen'],['ArrowRight','next'],['Control','holdSkip']])assert.equal(key(input),action,input);
 assert.equal(key('S',{shiftKey:true}),'save');assert.equal(key('s',{ctrlKey:true}),null);
});
test('typing, composition, held toggle keys and native focused buttons are protected',()=>{
 assert.equal(key('a',{target:{closest:selector=>selector.startsWith('input')?{}:null}}),null);
 assert.equal(key('a',{isComposing:true}),null);assert.equal(key('a',{altKey:true}),null);assert.equal(key('a',{metaKey:true}),null);
 assert.equal(key('a',{repeat:true}),null);assert.equal(key('F5',{repeat:true}),null);assert.equal(key('ArrowRight',{repeat:true}),'next');
 assert.equal(key('Enter',{target:{closest:selector=>selector==='button,a,summary'?{}:null}}),null);
 assert.equal(key(' ',{defaultPrevented:true}),null);
});
