export const RULES = Object.freeze({ rounds: 8, coins: 5, bank: 64, countdown: 5000, dark: 3000, debate: 35000, vote: 18000, result: 10000, stale: 45000 });
export class GameError extends Error { constructor(message, status = 400) { super(message); this.status = status; } }
const fail = (condition, message, status) => { if (condition) throw new GameError(message, status); };
const cleanName = value => String(value || '').replace(/[<>\x00-\x1f]/g, '').trim().slice(0, 12) || '无名来客';
const event = (room, text, now) => { room.messages.push({id: ++room.serial, text, at: now, seat: -1}); room.messages = room.messages.slice(-70); };
export function makeRoom(code, token, name, now = Date.now()) {
  return { code, version: 0, phase: 'lobby', round: 0, bank: RULES.bank, deadline: 0, serial: 0, host: 0, created: now, updated: now,
    players: [{seat: 0, token, name: cleanName(name), coins: RULES.coins, ready: false, seen: now, bot: false}], actions: [], votes: {}, result: null, history: [], messages: [], practice: false, requests: [] };
}
export function playerFor(room, token) { const p = room.players.find(p => p.token === token); fail(!p, '座位已失效，请重新进入房间', 401); return p; }
function beginNight(room, now) {
  room.round++; room.phase = 'countdown'; room.deadline = now + RULES.countdown; room.actions = []; room.votes = {}; room.result = null;
  room.discussReady={};
  room.botPlan = room.players.filter(p=>p.bot).map(p=>({seat:p.seat, kind:Math.random()<0.48?'steal':Math.random()<0.8?'knock':'wait', delay:250+Math.floor(Math.random()*2450)}));
  event(room, `第 ${room.round} 夜。把手放回桌上，灯即将熄灭。`, now);
}
function settle(room, now) {
  const before = room.players.map(p=>p.coins);
  const stolen = room.actions.filter(a=>a.kind==='steal');
  const judgements = room.players.map(p => {
    const target = room.votes[p.seat];
    return { seat:p.seat, target: Number.isInteger(target)?target:-1, correct: Number.isInteger(target)&&stolen.some(a=>a.seat===target) };
  });
  const caught = [...new Set(judgements.filter(j=>j.correct).map(j=>j.target))];
  for (const seat of caught) { const p=room.players.find(p=>p.seat===seat); const fine=Math.min(2,p.coins); p.coins-=fine; room.bank+=fine; }
  for (const j of judgements) { if(j.target<0) continue; const p=room.players.find(p=>p.seat===j.seat); if(j.correct&&room.bank>0){p.coins++;room.bank--;} else if(!j.correct&&p.coins>0){p.coins--;room.bank++;} }
  room.result = { round:room.round, stolen:stolen.length, caught, judgements, changes:room.players.map((p,i)=>({seat:p.seat,delta:p.coins-before[i]})) };
  room.history.push({round:room.round, actions:structuredClone(room.actions), result:structuredClone(room.result)});
  room.phase='result'; room.deadline=now+RULES.result;
  event(room, `第 ${room.round} 夜结算，${caught.length} 人被抓住。`, now);
}
export function advance(room, now = Date.now()) {
  const host=room.players.find(p=>p.seat===room.host);
  if(!host||(!host.bot&&now-host.seen>RULES.stale)){
    const replacement=room.players.filter(p=>!p.bot&&now-p.seen<=RULES.stale).sort((a,b)=>a.seat-b.seat)[0];
    if(replacement)room.host=replacement.seat;
  }
  if (room.phase==='lobby'||room.phase==='finished') return room;
  for(let limit=0;limit<8;limit++) {
    if(room.phase==='countdown'&&now>=room.deadline) {room.phase='dark';room.darkStart=room.deadline;room.deadline+=RULES.dark;}
    if(room.phase==='dark') {
      for(const plan of room.botPlan||[]) if(plan.kind!=='wait'&&now>=room.darkStart+plan.delay&&!room.actions.some(a=>a.seat===plan.seat)) takeAction(room,plan.seat,plan.kind,room.darkStart+plan.delay);
      if(now>=room.deadline) {
        room.phase='debate';room.deadline+=RULES.debate;event(room,`灯亮了。桌上少了 ${room.actions.filter(a=>a.kind==='steal').length} 枚钱。`,room.darkStart+RULES.dark);
        for(const p of room.players.filter(p=>p.bot)) {
          const a=room.actions.find(a=>a.seat===p.seat);
          const timing=a?(a.at-room.darkStart<1000?'刚灭灯':a.at-room.darkStart<2000?'中间那会儿':'快亮灯的时候'):'刚灭灯';
          const text=a?Math.random()<.25?'我一直没动。':`我${Math.random()<.2?'刚灭灯':timing}敲了一下桌子，没拿钱。`:'我没动，你们可以互相问问。';
          room.messages.push({id:++room.serial,seat:p.seat,text,at:room.darkStart+RULES.dark});
        }
        room.messages=room.messages.slice(-70);
      } else break;
    }
    if(room.phase==='debate') {
      room.discussReady ||= {};
      for(const p of room.players.filter(p=>p.bot))room.discussReady[p.seat]=true;
      if(now>=room.deadline||room.players.every(p=>room.discussReady[p.seat])){room.phase='vote';room.deadline=now>=room.deadline?room.deadline+RULES.vote:now+RULES.vote;}
    }
    if(room.phase==='vote') {
      for(const p of room.players.filter(p=>p.bot)) if(!(p.seat in room.votes)) {
        const heard=room.actions.filter(a=>a.seat!==p.seat);
        room.votes[p.seat]=heard.length&&Math.random()<0.62?heard[Math.floor(Math.random()*heard.length)].seat:-1;
      }
      if(now>=room.deadline||room.players.every(p=>p.seat in room.votes)) {const at=now>=room.deadline?room.deadline:now;settle(room,at);} else break;
    }
    if(room.phase==='result'&&now>=room.deadline) {
      if(room.round>=RULES.rounds||room.bank===0){room.phase='finished';room.deadline=0;event(room,'遗嘱宣读完毕，钱最多的人继承旧宅。',now);break;}
      beginNight(room,room.deadline);
    } else break;
  }
  return room;
}
function takeAction(room, seat, kind, now) {
  fail(room.actions.some(a=>a.seat===seat),'这一夜只能行动一次');
  fail(!['steal','knock'].includes(kind),'无效动作');
  const p=room.players.find(p=>p.seat===seat);
  if(kind==='steal'){fail(room.bank<=0,'桌上已经没有钱了');p.coins++;room.bank--;}
  room.actions.push({id:++room.serial,seat,kind,at:now});
}
export function command(room, token, input, now = Date.now()) {
  advance(room,now);
  const me=playerFor(room,token);me.seen=now;
  const requestId=String(input.requestId||'').slice(0,80);
  if(requestId&&room.requests.some(r=>r.token===token&&r.id===requestId))return room;
  if(['action','vote','discussionReady'].includes(input.type)&&Number.isInteger(input.round))fail(input.round!==room.round,'这一夜已经结束，请按当前回合操作');
  switch(input.type) {
    case 'heartbeat': break;
    case 'voice': me.voice=!!input.enabled;me.voiceEpoch=String(input.epoch||'').slice(0,40);break;
    case 'ready': fail(room.phase!=='lobby','对局已经开始');me.ready=!!input.ready;break;
    case 'kick':
      fail(room.phase!=='lobby'||room.host!==me.seat,'只有房主可在开局前调整座位');
      fail(!Number.isInteger(input.target)||input.target===me.seat||!room.players.some(p=>p.seat===input.target),'请选择其他座位');
      room.players=room.players.filter(p=>p.seat!==input.target);room.signals=(room.signals||[]).filter(s=>s.from!==input.target&&s.to!==input.target);break;
    case 'practice':
      fail(me.seat!==room.host||room.phase!=='lobby','只有房主可以在开局前添加陪练');
      for(let seat=0;seat<4;seat++)if(!room.players.some(p=>p.seat===seat))room.players.push({seat,token:'bot-'+seat,name:['','长女·陪练','叔父·陪练','幼子·陪练'][seat]||'陪练',coins:RULES.coins,ready:true,seen:now,bot:true});
      room.practice=true;break;
    case 'start':
      fail(me.seat!==room.host,'只有房主可以开始');fail(room.phase!=='lobby','已经开局');
      fail(room.players.length!==4||room.players.some(p=>!p.ready||(!p.bot&&now-p.seen>RULES.stale)),'需要四个座位全部准备');
      beginNight(room,now);break;
    case 'action': fail(room.phase!=='dark','只有熄灯的三秒可以行动');takeAction(room,me.seat,input.kind,now);break;
    case 'vote':
      fail(room.phase!=='vote','还没到指认阶段');fail(me.seat in room.votes,'指认已锁定');
      fail(!Number.isInteger(input.target)||input.target===me.seat||(input.target!==-1&&!room.players.some(p=>p.seat===input.target)),'请选择其他人或放弃指认');room.votes[me.seat]=input.target;advance(room,now);break;
    case 'discussionReady':
      fail(room.phase!=='debate','现在不在讨论阶段');room.discussReady ||= {};room.discussReady[me.seat]=true;advance(room,now);break;
    case 'chat': {
      fail(room.phase==='dark','黑灯时请听声音');
      const text=String(input.text||'').trim().replace(/[\x00-\x1f]/g,'').slice(0,160);fail(!text,'不能发送空消息');fail(now-(me.lastChat||0)<800,'稍等片刻再说');me.lastChat=now;
      room.messages.push({id:++room.serial,seat:me.seat,text,at:now});room.messages=room.messages.slice(-70);break;
    }
    case 'rematch':
      fail(me.seat!==room.host||room.phase!=='finished','房主可在整局结束后重新开始');
      room.phase='lobby';room.round=0;room.bank=RULES.bank;room.deadline=0;room.actions=[];room.votes={};room.result=null;room.history=[];room.messages=[];room.discussReady={};
      room.players.forEach(p=>{p.coins=RULES.coins;p.ready=p.bot;});event(room,'新遗嘱已放上桌。请重新准备。',now);break;
    case 'leave':
      fail(room.phase!=='lobby'&&room.phase!=='finished','对局中离席将保留座位，可用同一浏览器重连');
      room.players=room.players.filter(p=>p.seat!==me.seat);if(room.host===me.seat)room.host=room.players.filter(p=>!p.bot).sort((a,b)=>a.seat-b.seat)[0]?.seat??-1;break;
    default: throw new GameError('未知操作');
  }
  if(requestId){room.requests.push({token,id:requestId});room.requests=room.requests.slice(-100);}
  room.updated=now;return room;
}
export function join(room, token, name, now = Date.now()) {
  if(room.players.some(p=>p.token===token)){playerFor(room,token).seen=now;return room;}
  fail(room.phase!=='lobby','已经开局，只能用原浏览器重连');fail(room.players.length>=4,'房间已满');
  const seat=[0,1,2,3].find(n=>!room.players.some(p=>p.seat===n));
  room.players.push({seat,token,name:cleanName(name),coins:RULES.coins,ready:false,seen:now,bot:false});
  if(room.host<0)room.host=seat;return room;
}
export function view(room, token, now = Date.now()) {
  const me=playerFor(room,token);
  const open=['debate','vote','result','finished'].includes(room.phase);
  const finished=room.phase==='finished';
  const privateAction=room.actions.find(a=>a.seat===me.seat);
  return {code:room.code,version:room.version,serverNow:now,phase:room.phase,round:room.round,maxRounds:RULES.rounds,deadline:room.deadline,darkStart:room.darkStart||0,host:room.host,me:me.seat,bank:open||room.phase==='lobby'||room.phase==='countdown'?room.bank:null,practice:room.practice,
    players:room.players.map(p=>({seat:p.seat,name:p.name,ready:p.ready,bot:p.bot,online:p.bot||now-p.seen<RULES.stale,voice:!!p.voice,voiceEpoch:p.voiceEpoch||'',coins:p.seat===me.seat||finished?p.coins:null})),
    ownAction:privateAction?{kind:privateAction.kind,at:privateAction.at}:null,
    pulses:room.actions.map(a=>({id:a.id,seat:a.seat,at:a.at})),
    missing:open?room.actions.filter(a=>a.kind==='steal').length:null,
    voted:me.seat in room.votes,voteCount:Object.keys(room.votes).length,myVote:room.votes[me.seat]??null,
    discussReady:!!room.discussReady?.[me.seat],discussReadyCount:Object.keys(room.discussReady||{}).length,
    result:room.phase==='result'||finished?room.result:null,history:finished?room.history:null,
    messages:room.messages.map(m=>({...m})), winners:finished?room.players.filter(p=>p.coins===Math.max(...room.players.map(p=>p.coins))).map(p=>p.seat):[] };
}
