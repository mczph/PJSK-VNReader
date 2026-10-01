// Original SEKAI themes used in each unit's main story. Virtual Singer's
// opening uses bgm00018 rather than one of the five SEKAI area themes.
export const unitBgm={light_sound:'bgm_area00001',idol:'bgm_area00002',street:'bgm_area00003',theme_park:'bgm_area00004',school_refusal:'bgm_area00005',piapro:'bgm00018'};
export function unitBgmPath(unit){const name=unitBgm[unit];return name?`sound/scenario/bgm/${name}/${name}.mp3`:'';}
export const titleBgmPath='sound/scenario/bgm/bgm00018/bgm00018.mp3';
export function storyBgmPath(name){return name?`sound/scenario/bgm/${name}/${name}.mp3`:titleBgmPath;}
