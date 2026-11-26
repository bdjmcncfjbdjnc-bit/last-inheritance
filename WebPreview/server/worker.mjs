import {makeRoom, command, advance, view, join, playerFor, GameError} from './game.mjs';
const json=(body,status=200)=>Response.json(body,{status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
const codePattern=/^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{6}$/;
const tokenPattern=/^[a-f0-9-]{36,80}$/i;
const randomCode=()=>Array.from(crypto.getRandomValues(new Uint8Array(6)),v=>'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[v%32]).join('');
export async function api(request, env, now=Date.now()) {
  try {
    const url=new URL(request.url);
    if(url.pathname==='/api/health')return json({ok:true,version:'0.4.0',clock:now});
    if(!env.DB)throw new GameError('房间服务暂不可用',503);
    const db=env.DB.withSession?env.DB.withSession('first-primary'):env.DB;
    const parts=url.pathname.split('/').filter(Boolean);
    const token=request.headers.get('X-Player-Token')||'';
    if(!tokenPattern.test(token))throw new GameError('请重新进入房间',401);
    const readBody=async()=>{
      if(Number(request.headers.get('Content-Length')||0)>8192)throw new GameError('消息过长',413);
      const text=await request.text();if(text.length>8192)throw new GameError('消息过长',413);
      try{const value=JSON.parse(text);if(!value||typeof value!=='object'||Array.isArray(value))throw new Error();return value;}catch{throw new GameError('请求格式无效');}
    };
    if(url.pathname==='/api/rooms'&&request.method==='POST') {
      const body=await readBody();
      // A visitor can own only a few recently active rooms. Expired rows are bounded by expiry indexes.
      const owned=await db.prepare('SELECT COUNT(*) AS n FROM inheritance_rooms WHERE owner = ? AND expires > ?').bind(token,now).first();
      if(owned.n>=5)throw new GameError('已创建多个房间，请先使用已有房间',429);
      for(let attempt=0;attempt<5;attempt++) {
        const code=randomCode(),room=makeRoom(code,token,body.name,now);
        const inserted=await db.prepare('INSERT OR IGNORE INTO inheritance_rooms(code,owner,state,version,expires) VALUES (?,?,?,0,?)').bind(code,token,JSON.stringify(room),now+6*3600000).run();
        if(inserted.meta.changes)return json(view(room,token,now),201);
      }
      throw new GameError('房间创建繁忙，请重试',503);
    }
    const code=parts[2];
    if(parts[0]!=='api'||parts[1]!=='rooms'||!codePattern.test(code||''))throw new GameError('房间不存在',404);
    for(let retry=0;retry<10;retry++) {
      const row=await db.prepare('SELECT state,version,expires FROM inheritance_rooms WHERE code = ?').bind(code).first();
      if(!row||row.expires<now)throw new GameError('房间不存在或已过期',404);
      const room=JSON.parse(row.state);const before=JSON.stringify(room);
      if(parts[3]==='join'&&request.method==='POST') {
        const input=await readBody();
        join(room,token,input.name,now);advance(room,now);
      } else {
        const me=playerFor(room,token);
        advance(room,now);
        if(request.method==='GET'&&parts.length===3) {
          if(now-me.seen>=5000)me.seen=now;
        } else if(request.method==='POST'&&parts[3]==='command') {
          const input=await readBody();command(room,token,input,now);
        } else if(parts[3]==='signals'&&request.method==='POST') {
          const input=await readBody();
          if(!room.players.some(p=>p.seat===input.to)||input.to===me.seat)throw new GameError('无效的语音座位');
          if(!['offer','answer','ice','hangup'].includes(input.kind))throw new GameError('无效语音信令');
          room.signals=(room.signals||[]).filter(s=>now-s.at<30000).slice(-60);
          room.signals.push({id:++room.serial,from:me.seat,to:input.to,kind:input.kind,data:input.data,at:now});
        } else throw new GameError('接口不存在',404);
      }
      if(before===JSON.stringify(room))return json({...view(room,token,now),signals:(room.signals||[]).filter(s=>s.to===playerFor(room,token).seat&&now-s.at<30000)});
      room.version=row.version+1;room.updated=now;
      const saved=await db.prepare('UPDATE inheritance_rooms SET state = ?,version = ?,expires = ? WHERE code = ? AND version = ?').bind(JSON.stringify(room),room.version,now+6*3600000,code,row.version).run();
      if(saved.meta.changes){
        // Leave may remove the requesting seat. Do not leak the remaining private room state.
        if(!room.players.some(p=>p.token===token))return json({left:true});
        return json({...view(room,token,now),signals:(room.signals||[]).filter(s=>s.to===playerFor(room,token).seat&&now-s.at<30000)});
      }
      // Request bodies are cached by the wrapper below, allowing safe compare-and-swap retries.
    }
    throw new GameError('多人操作繁忙，请稍后重试',409);
  }catch(error){
    if(error instanceof GameError)return json({error:error.message},error.status);
    console.error('Room API error',String(error?.stack||error));return json({error:'房间服务暂时中断，请重试'},503);
  }
}
export default { async fetch(request,env,ctx){
  const url=new URL(request.url);
  if(url.pathname.startsWith('/api/')) {
    // Cache small bodies once so a CAS collision never consumes an already-read stream.
    let body;
    if(request.method==='POST') {body=await request.text();if(body.length>8192)return json({error:'消息过长'},413);}
    const replay={url:request.url,method:request.method,headers:request.headers,text:async()=>body||''};
    return api(replay,env);
  }
  if(env.ASSETS)return env.ASSETS.fetch(request);
  return new Response('Not found',{status:404});
}};
