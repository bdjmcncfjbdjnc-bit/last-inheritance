import {mkdirSync,copyFileSync,readFileSync,writeFileSync,existsSync,readdirSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {createHash} from 'node:crypto';
const root=path.resolve(fileURLToPath(new URL('..',import.meta.url)));
for(const dir of ['dist/server','dist/.openai','dist/client'])mkdirSync(path.join(root,dir),{recursive:true});
const domain=readFileSync(path.join(root,'server/game.mjs'),'utf8').replaceAll('export ','');
const worker=readFileSync(path.join(root,'server/worker.mjs'),'utf8').replace(/^import .*\n/,'').replace('export async function api','async function api');
writeFileSync(path.join(root,'dist/server/index.js'),domain+'\n'+worker);
// Optional Sites metadata belongs to the deployer's own account.
if(existsSync(path.join(root,'.openai/hosting.json')))copyFileSync(path.join(root,'.openai/hosting.json'),path.join(root,'dist/.openai/hosting.json'));
const versions={};
for(const file of ['app.js','style.css','layout.css']){
  const data=readFileSync(path.join(root,'client',file));const extension=path.extname(file);
  const version=file.slice(0,-extension.length)+'.'+createHash('sha256').update(data).digest('hex').slice(0,12)+extension;
  writeFileSync(path.join(root,'dist/client',version),data);versions[file]=version;
  copyFileSync(path.join(root,'client',file),path.join(root,'dist/client',file));
}
const binaries=readdirSync(path.join(root,'dist/client/Build'));
const parts=binaries.filter(name=>name.includes('.data.unityweb.part')).sort((a,b)=>Number(a.split('.part')[1])-Number(b.split('.part')[1]));
if(parts.length<1)throw new Error('Unity data chunks are missing');
let page=readFileSync(path.join(root,'client/index.template.html'),'utf8');
for(const [file,version] of Object.entries(versions))page=page.replaceAll('/'+file,'/'+version);
for(const [key,value] of Object.entries({'__DATA_PARTS__':JSON.stringify(parts),'__LOADER__':binaries.find(name=>name.endsWith('.loader.js')),'__FRAMEWORK__':binaries.find(name=>name.includes('.framework.js')),'__WASM__':binaries.find(name=>name.includes('.wasm'))}))page=page.replaceAll(key,value);
writeFileSync(path.join(root,'dist/client/index.html'),page);
const config={name:'last-inheritance',main:'index.js',compatibility_date:'2026-06-01',assets:{directory:'../client',binding:'ASSETS'},d1_databases:[{binding:'DB',database_name:'inheritance-rooms',database_id:'00000000-0000-4000-8000-000000000000'}]};
writeFileSync(path.join(root,'dist/server/wrangler.json'),JSON.stringify(config,null,2));
// Unity exports its generated entrypoint and binary files into the client directory.
if(!existsSync(path.join(root,'dist/client/index.html')))throw new Error('Export the Unity browser build before packaging');
console.log('Browser game + authoritative room server packaged');
