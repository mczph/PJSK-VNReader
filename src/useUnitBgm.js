import {useEffect,useRef} from 'react';
import {unitBgmPath} from '../server/unit-bgm.js';

export default function useUnitBgm(unit,region,volume,paused){
 useMenuBgm(unitBgmPath(unit),region,volume,paused);
}

export function useMenuBgm(path,region,volume,paused){
 const sound=useRef(null),blocked=useRef(paused),level=useRef(volume);
 blocked.current=paused;level.current=volume;
 useEffect(()=>{
  if(!path)return;
  const audio=new Audio(`/assets/${region}/${path}`);sound.current=audio;
  audio.loop=true;audio.volume=Math.max(0,Math.min(1,level.current/100));
  const play=()=>{if(!blocked.current&&audio.paused)audio.play().catch(()=>{});};
  play();window.addEventListener('pointerdown',play);window.addEventListener('keydown',play);
  return()=>{window.removeEventListener('pointerdown',play);window.removeEventListener('keydown',play);audio.pause();audio.removeAttribute('src');audio.load();if(sound.current===audio)sound.current=null;};
 },[path,region]);
 useEffect(()=>{const audio=sound.current;if(!audio)return;audio.volume=Math.max(0,Math.min(1,volume/100));if(paused)audio.pause();else audio.play().catch(()=>{});},[volume,paused,path,region]);
}
