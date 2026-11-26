import {test} from 'node:test';import assert from 'node:assert/strict';
import {makeRoom,command} from '../server/game.mjs';
test('a rematch clears previous testimony and discussion readiness',()=>{
  const room=makeRoom('ABC234','owner','甲',100000);room.phase='finished';room.round=8;
  room.messages=[{seat:0,text:'上一局的证词',id:1}];room.discussReady={0:true};room.players[0].coins=12;
  command(room,'owner',{type:'rematch'},100001);
  assert.equal(room.phase,'lobby');assert.equal(room.players[0].coins,5);assert.equal(room.messages.length,1);assert.ok(!room.messages.some(m=>m.text==='上一局的证词'));assert.deepEqual(room.discussReady,{});
});
