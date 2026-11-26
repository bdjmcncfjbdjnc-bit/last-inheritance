import {test} from 'node:test';import assert from 'node:assert/strict';import {makeRoom,join,command,advance,view,RULES} from '../server/game.mjs';
import worker from '../server/worker.mjs';import {LocalD1} from '../scripts/sqlite-adapter.mjs';import {readFileSync} from 'node:fs';
test('a disconnected host migrates without blocking the remaining lobby',()=>{const r=makeRoom('ABC234','a','甲',100000);join(r,'b','乙',100000);r.players[1].seen=150000;advance(r,150001);assert.equal(r.host,1);command(r,'b',{type:'kick',target:0},150002);assert.equal(r.players.length,1);join(r,'c','丙',150003);assert.equal(r.players.find(p=>p.token==='c').seat,0);assert.throws(()=>command(r,'c',{type:'kick',target:1},150004),/房主/);});
test('practice seats can be replaced before the game starts',()=>{const r=makeRoom('ABC234','a','甲',100000);command(r,'a',{type:'practice'},100001);assert.equal(r.players.length,4);command(r,'a',{type:'kick',target:2},100002);join(r,'b','乙',100003);assert.equal(r.players.find(p=>p.token==='b').seat,2);});
test('voice signaling reaches only the intended authenticated seat',async()=>{
  const DB=new LocalD1();DB.exec(readFileSync(new URL('../drizzle/0000_rooms.sql',import.meta.url),'utf8'));
  const tokens=Array.from({length:4},()=>crypto.randomUUID());
  async function req(path,seat,body){const response=await worker.fetch(new Request('https://game.test'+path,{method:body?'POST':'GET',headers:{'X-Player-Token':tokens[seat],'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined}),{DB},{});return {status:response.status,data:await response.json()};}
  try{
    const created=await req('/api/rooms',0,{name:'甲'}),base='/api/rooms/'+created.data.code;
    for(let seat=1;seat<4;seat++)await req(base+'/join',seat,{name:'座位'+seat});
    const signal=await req(base+'/signals',0,{to:1,kind:'offer',data:{epoch:'test',description:{type:'offer',sdp:'test-sdp'}}});assert.equal(signal.status,200);
    const receiver=await req(base,1);assert.equal(receiver.data.signals.length,1);
    assert.equal((await req(base,2)).data.signals.length,0);assert.equal((await req(base,3)).data.signals.length,0);
    assert.equal((await req(base+'/signals',0,{to:0,kind:'offer'})).status,400);
    assert.equal((await req(base+'/signals',0,{to:1,kind:'invalid'})).status,400);
    const outsider=new Request('https://game.test'+base,{headers:{'X-Player-Token':crypto.randomUUID()}});assert.equal((await worker.fetch(outsider,{DB},{})).status,401);
  }finally{DB.close();}
});
