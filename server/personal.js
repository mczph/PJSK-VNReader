export function personalEntries({characters,profiles,cards,episodes},region){
 const people=new Map(characters.map(c=>[c.id,c])),members=new Map(cards.map(c=>[c.id,c]));
 const info=id=>{const c=people.get(id) || {};return {characterId:id,characterName:[c.firstName,c.givenName].filter(Boolean).join('') || `角色 ${id}`,unit:c.unit || 'piapro'};};
 const entries=[];
 for(const p of profiles){if(!p.scenarioId)continue;const character=info(p.characterId),card=cards.find(c=>c.characterId===p.characterId),cover=card?`character/member/${card.assetbundleName}/card_normal.webp`:'';entries.push({...character,id:`profile-${p.characterId}`,type:'personal',personalType:'profile',groupId:`profile-${p.characterId}`,chapter:`${character.characterName} · 角色介绍`,title:'角色介绍',episode:1,scenarioId:p.scenarioId,path:`scenario/profile/${p.scenarioId}.asset`,cover,poster:cover});}
 for(const e of episodes){const c=members.get(e.cardId);if(!c||!e.scenarioId)continue;const character=info(c.characterId),bundle=e.assetbundleName || c.assetbundleName,cover=`character/member/${c.assetbundleName}/card_normal.webp`;
 entries.push({...character,id:`card-${e.id}`,cardId:c.id,type:'personal',personalType:'card',groupId:`card-${c.id}`,chapter:c.prefix || `卡片 ${c.id}`,title:e.title || (e.cardEpisodePartType==='first_part'?'前篇':'后篇'),episode:e.cardEpisodePartType==='first_part'?1:2,scenarioId:e.scenarioId,path:`character/${region==='en'?'member_scenario':'member'}/${bundle}/${e.scenarioId}.asset`,cover:`character/member_small/${c.assetbundleName}/card_normal.webp`,poster:cover});
 }
 return entries;
}
