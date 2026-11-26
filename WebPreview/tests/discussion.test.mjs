import {test} from 'node:test';import assert from 'node:assert/strict';import {makeRoom,join,command,advance} from '../server/game.mjs';
test('discussion ends early only when all four participants agree',()=>{
  const room=makeRoom('ABC234','a','甲',100000);for(const token of ['b','c','d'])join(room,token,token,100000);
  for(const token of ['a','b','c','d'])command(room,token,{type:'ready',ready:true},100000);command(room,'a',{type:'start'},100000);advance(room,108000);assert.equal(room.phase,'debate');
  for(const token of ['a','b','c'])command(room,token,{type:'discussionReady'},108100);assert.equal(room.phase,'debate');
  command(room,'d',{type:'discussionReady'},108200);assert.equal(room.phase,'vote');assert.equal(room.deadline,126200);
});
test('a solo player can skip waiting with bots while retaining a full vote window',()=>{
  const room=makeRoom('ABC234','a','甲',100000);command(room,'a',{type:'practice'},100000);command(room,'a',{type:'ready',ready:true},100000);command(room,'a',{type:'start'},100000);advance(room,108000);
  command(room,'a',{type:'discussionReady'},108500);assert.equal(room.phase,'vote');assert.equal(room.deadline,126500);assert.equal(Object.keys(room.votes).length,3);
});
