let context;
export function audioContext(){try{context ||= new (window.AudioContext || window.webkitAudioContext)();return context;}catch{return null;}}
// Called during a real pointer gesture, before asynchronous chapter loading.
export function unlockAudio(){const ctx=audioContext();if(ctx?.state==='suspended')ctx.resume().catch(()=>{});}
export function disposeAudio(audio){
 audio.dataset.resumeAfterMenu='false';audio.onended=null;audio.onerror=null;
 audio.pause();audio.removeAttribute('src');audio.load();
}
