import {writeFileSync,mkdirSync} from 'node:fs';import assert from 'node:assert/strict';
const base=process.env.GAME_URL||'http://127.0.0.1:8798';
const duration=Number(process.env.SOAK_MS||7200000),started=Date.now(),until=started+duration;
const sessions=Array.from({length:4},(_,seat)=>({seat,token:crypto.randomUUID(),state:null,acted:'',voted:'',lastSeenVersion:0}));
const summary={started:new Date(started).toISOString(),base,durationMs:duration,requests:0,retries:0,errors:[],games:0,rounds:0,reconnects:0,privateChecks:0,duplicateChecks:0,lastPhase:'',status:'running'};
mkdirSync('outputs',{recursive:true});
const reportFile=process.env.REPORT_FILE||'outputs/soak-report.json';
const save=()=>writeFileSync(reportFile,JSON.stringify({...summary,elapsedMs:Date.now()-started,updated:new Date().toISOString()},null,2));
let code;
async function call(p,path,body,expect=200){
  const response=await fetch(base+path,{method:body?'POST':'GET',headers:{'X-Player-Token':p.token,'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(10000)});summary.requests++;
  const data=await response.json();if(response.status!==expect)throw new Error(path+' returned '+response.status+': '+data.error);
  if(data.players){
    assert.equal(data.me,p.seat);assert.ok(data.version>=p.lastSeenVersion,'State version regressed');p.lastSeenVersion=data.version;
    if(data.phase!=='finished')assert.ok(data.players.every(other=>other.seat===p.seat||other.coins===null),'Private coin leak');
    assert.ok((data.pulses||[]).every(event=>!('kind' in event)),'Action kind leak');
    summary.privateChecks++;p.state=data;
  }return data;
}
async function cmd(p,type,extra={}){return call(p,'/api/rooms/'+code+'/command',{type,requestId:crypto.randomUUID(),...extra});}
async function main(){
  const made=await call(sessions[0],'/api/rooms',{name:'长测甲'},201);code=made.code;summary.room=code;
  // Ordered joins ensure seat identity for the test; preparation and every action run concurrently.
  for(let i=1;i<4;i++)await call(sessions[i],'/api/rooms/'+code+'/join',{name:'长测'+['甲','乙','丙','丁'][i]});
  await Promise.all(sessions.map(p=>cmd(p,'ready',{ready:true})));await cmd(sessions[0],'start');
  let lastRoundKey='',lastReconnect=Date.now();
  while(Date.now()<until){
    const views=await Promise.all(sessions.map(p=>call(p,'/api/rooms/'+code)));
    const host=views[0];summary.lastPhase=host.phase;summary.lastRound=host.round;
    const key=summary.games+':'+host.round;
    if(host.phase==='dark'){
      await Promise.all(sessions.map(async p=>{
        if(p.acted===key)return;p.acted=key;
        if(p.seat===3)return;const requestId=crypto.randomUUID();
        const body={type:'action',kind:p.seat===1?'knock':'steal',requestId};
        try{await call(p,'/api/rooms/'+code+'/command',body);await call(p,'/api/rooms/'+code+'/command',body);summary.duplicateChecks++;}
        catch(error){if(!/只有熄灯/.test(error.message))throw error;}
      }));
    }
    if(host.phase==='vote')await Promise.all(sessions.map(async p=>{if(p.voted===key)return;p.voted=key;await cmd(p,'vote',{target:p.seat===0?2:p.seat===1?0:p.seat===2?1:-1});}));
    if(host.phase==='result'&&key!==lastRoundKey){summary.rounds++;lastRoundKey=key;const results=await Promise.all(sessions.map(p=>call(p,'/api/rooms/'+code)));assert.ok(results.every(v=>JSON.stringify(v.result)===JSON.stringify(results[0].result)),'Settlement mismatch');}
    if(host.phase==='finished'){
      assert.equal(host.players.reduce((sum,p)=>sum+p.coins,0)+host.bank,84,'Money is not conserved');assert.equal(host.history.length,8);
      summary.games++;await cmd(sessions[0],'rematch');sessions.forEach(p=>{p.acted='';p.voted='';});
      await Promise.all(sessions.map(p=>cmd(p,'ready',{ready:true})));await cmd(sessions[0],'start');
    }
    if(Date.now()-lastReconnect>90000){const player=sessions[2];await call(player,'/api/rooms/'+code+'/join',{name:'刷新后仍为原座位'});summary.reconnects++;lastReconnect=Date.now();}
    save();await new Promise(resolve=>setTimeout(resolve,host.phase==='dark'||host.phase==='countdown'?170:800));
  }
  summary.status='passed';summary.finished=new Date().toISOString();save();console.log(JSON.stringify(summary));
}
main().catch(error=>{summary.status='failed';summary.errors.push({at:new Date().toISOString(),message:error.stack});save();console.error(error.stack);process.exitCode=1;});
