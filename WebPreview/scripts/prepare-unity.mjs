import {readFileSync,writeFileSync,existsSync,unlinkSync,readdirSync} from 'node:fs';
const build='dist/client/Build',data='client.data.unityweb',parts=[];
if(existsSync(build+'/'+data)){
 const raw=readFileSync(build+'/'+data);
 for(let start=0,index=0;start<raw.length;start+=20*1024*1024,index++){const name=data+'.part'+index;writeFileSync(build+'/'+name,raw.subarray(start,start+20*1024*1024));parts.push(name);}
 unlinkSync(build+'/'+data);
}else parts.push(...readdirSync(build).filter(n=>n.startsWith(data+'.part')).sort());
if(!parts.length)throw new Error('Unity binary data missing');
let html=readFileSync('../Tools/browser-preview.html','utf8');
for(const [key,value]of Object.entries({'__LOADER__':'client.loader.js','__DATA_PARTS__':JSON.stringify(parts),'__FRAMEWORK__':'client.framework.js.unityweb','__WASM__':'client.wasm.unityweb'}))html=html.replaceAll(key,value);
writeFileSync('dist/client/index.html',html);
writeFileSync('dist/client/preview-version.json',JSON.stringify({version:'multiplayer-04',scope:'eight-rounds-four-players'}));
console.log('Unity client entrypoint ready');
