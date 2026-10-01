export function storyCharacters(raw,people,models){
 const byModel=new Map(models.map(c=>[c.id,c])),byId=new Map(people.map(c=>[c.id,c])),names=new Map();
 for(const t of raw.TalkData || [])for(const c of [...(t.TalkCharacters || []),...(t.Voices || [])])if(c.Character2dId)names.set(c.Character2dId,t.WindowDisplayName);
 const ids=new Set([...(raw.AppearCharacters || []).map(c=>c.Character2dId),...names.keys()]),result=new Map();
 for(const id of ids){const model=byModel.get(id),person=model?.characterType==='game_character'?byId.get(model.characterId):null;if(!person||!Number.isInteger(person.id)||person.id<1||person.id>26)continue;const key=`character:${person.id}`,name=[person.firstName,person.givenName].filter(Boolean).join('');if(!name)continue;
  if(!result.has(key))result.set(key,{id:key,characterId:person.id,character2dIds:[],name,unit:person.unit,avatar:characterAvatar(person.id)});result.get(key).character2dIds.push(id);
 }
 return [...result.values()];
}
export const characterAvatar=id=>`character/character_sd_l/chr_sp_${id}.webp`;
