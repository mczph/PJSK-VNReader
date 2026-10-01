// A Wait snippet starts a new batch; following Now snippets run with it.
// Starting the next batch waits for every operation in the previous batch.
export function groupSnippets(events){const groups=[];for(const event of events){if(event.wait||!groups.length)groups.push([]);groups.at(-1).push(event);}return groups;}
export async function runSnippets(events,{run,wait,signal}){
 for(const group of groupSnippets(events)){
  if(signal.aborted)return;
  await Promise.all(group.map(async event=>{if(event.delay)await wait(event.delay*1000);if(!signal.aborted)await run(event);}));
 }
}
