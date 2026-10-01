import {net} from 'electron';
import {startResourceServer} from '../server/index.js';
try{const {server,url}=await startResourceServer({port:0,cacheDir:process.argv[2],distDir:process.argv[3],fetchImpl:(url,options)=>net.fetch(url,options)});process.parentPort.postMessage({type:'ready',url});process.parentPort.on('message',({data})=>{if(data?.type==='shutdown')server.close(()=>process.exit(0));});}catch(e){process.parentPort.postMessage({type:'error',message:e.message});process.exit(1);}
