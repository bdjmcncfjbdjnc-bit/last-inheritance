import {createServer} from 'node:http';
import {readFileSync,existsSync,statSync,mkdirSync} from 'node:fs';
import path from 'node:path';
import worker from '../server/worker.mjs';
import {LocalD1} from './sqlite-adapter.mjs';
const port=Number(process.env.PORT||8791),root=path.resolve('dist/client');
mkdirSync('outputs',{recursive:true});
const DB=new LocalD1(process.env.DB_FILE||'outputs/preview.sqlite');
if(!DB.db.prepare("SELECT name FROM sqlite_master WHERE name='inheritance_rooms'").get())DB.exec(readFileSync('drizzle/0000_rooms.sql','utf8'));
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json','.png':'image/png','.ico':'image/x-icon','.wasm':'application/wasm'};
const server=createServer(async(req,res)=>{
  try{
    const url=new URL(req.url,'http://127.0.0.1:'+port);
    if(url.pathname.startsWith('/api/')){
      const chunks=[];let size=0;for await(const chunk of req){size+=chunk.length;if(size>16384){res.writeHead(413);res.end();return;}chunks.push(chunk);}
      const body=Buffer.concat(chunks);const request=new Request(url,{method:req.method,headers:req.headers,...(body.length?{body}:{})});
      const response=await worker.fetch(request,{DB},{});res.writeHead(response.status,Object.fromEntries(response.headers));res.end(Buffer.from(await response.arrayBuffer()));return;
    }
    const file=path.resolve(root,'.'+decodeURIComponent(url.pathname==='/'?'/index.html':url.pathname));
    if(!file.startsWith(root+path.sep)||!existsSync(file)||!statSync(file).isFile()){res.writeHead(404);res.end('Not found');return;}
    res.writeHead(200,{'Content-Type':mime[path.extname(file)]||'application/octet-stream','Cache-Control':'no-cache'});res.end(readFileSync(file));
  }catch(error){console.error('Preview request failed',error.message);res.writeHead(500);res.end('Server error');}
});
server.listen(port,'127.0.0.1',()=>console.log('Local: http://127.0.0.1:'+port));
process.on('SIGINT',()=>server.close(()=>{DB.close();process.exit();}));
