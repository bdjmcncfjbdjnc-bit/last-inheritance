import {test} from 'node:test';import assert from 'node:assert/strict';
import {makeRoom,join,command,advance} from '../server/game.mjs';
import worker from '../server/worker.mjs';import {LocalD1} from '../scripts/sqlite-adapter.mjs';import {readFileSync} from 'node:fs';
test('late actions and votes from a previous night cannot change this night',()=>{
  const r=makeRoom('ABC234','a','甲',100000);for(const token of ['b','c','d'])join(r,token,token,100000);
  for(const p of r.players)command(r,p.token,{type:'ready',ready:true},100001);
  command(r,'a',{type:'start'},100002);
  assert.throws(()=>command(r,'a',{type:'action',kind:'steal',round:0},105100),/已经结束/);assert.equal(r.players[0].coins,5);
  command(r,'a',{type:'action',kind:'steal',round:1},105101);assert.equal(r.players[0].coins,6);
  advance(r,143002);assert.equal(r.phase,'vote');assert.throws(()=>command(r,'a',{type:'vote',target:1,round:0},143003),/已经结束/);assert.deepEqual(r.votes,{});
});
test('valid JSON with a non-object body returns a client error',async()=>{
  const DB=new LocalD1();DB.exec(readFileSync(new URL('../drizzle/0000_rooms.sql',import.meta.url),'utf8'));
  try{for(const body of ['null','[]','42','"hello"']){
    const response=await worker.fetch(new Request('https://game.test/api/rooms',{method:'POST',headers:{'X-Player-Token':crypto.randomUUID(),'Content-Type':'application/json'},body}),{DB},{});assert.equal(response.status,400);
  }}finally{DB.close();}
});
