const $=id=>document.getElementById(id);
const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const show=(id,visible)=>{$(id).hidden=!visible;};
const markups=new Map();
const setMarkup=(id,markup)=>{
  if(markups.get(id)===markup)return;
  const element=$(id),template=document.createElement('template');template.innerHTML=markup;
  const before=[...element.children],after=[...template.content.children];
  const key=node=>node.id||node.dataset.action||node.dataset.target||'';
  const preserve=(id==='actionbar'||id==='targets')&&before.length===after.length&&before.length>0&&before.every((node,i)=>node.tagName==='BUTTON'&&after[i].tagName==='BUTTON'&&key(node)===key(after[i]));
  if(preserve){
    before.forEach((node,i)=>{
      const next=after[i];
      for(const attribute of [...node.attributes])if(!next.hasAttribute(attribute.name))node.removeAttribute(attribute.name);
      for(const attribute of [...next.attributes])if(node.getAttribute(attribute.name)!==attribute.value)node.setAttribute(attribute.name,attribute.value);
      if(node.innerHTML!==next.innerHTML)node.innerHTML=next.innerHTML;
    });
  }else element.replaceChildren(template.content);
  markups.set(id,markup);
};
let token=sessionStorage.getItem('inheritance-token');
if(!token){token=crypto.randomUUID()+'-'+crypto.randomUUID();sessionStorage.setItem('inheritance-token',token);}
let state=null,roomCode='',generation=0,offset=0,lastContact=0,latency=0,selected=-1,busyAction=false,busyVote=false,recallOpen=false,toastTimer,scene=null,sceneReady=false,lastUnity='',muted=false,audioContext=null,lastRound=0,lastPhase='',resultDismissed=false;
const heard=new Set(),pulseMemory=[];
const params=new URLSearchParams(location.search),invite=(params.get('room')||'').toUpperCase();
const localVoiceTest=location.hostname==='127.0.0.1'&&params.get('testVoice')==='1';
$('name').value=localStorage.getItem('inheritance-name')||'来客';$('room-input').value=invite;
show('rejoin-row',!!sessionStorage.getItem('inheritance-room'));
const names=seat=>state?.players.find(p=>p.seat===seat)?.name||'来客';
const relative=seat=>(seat-state.me+4)%4;
const direction=seat=>['你面前','左侧','对面','右侧'][relative(seat)];
function toast(text){$('toast').textContent=text;show('toast',true);clearTimeout(toastTimer);toastTimer=setTimeout(()=>show('toast',false),4200);}
function unlockAudio(){if(!audioContext)audioContext=new(window.AudioContext||window.webkitAudioContext)();if(audioContext.state==='suspended')audioContext.resume().catch(()=>{});}
document.addEventListener('pointerdown',unlockAudio,{once:true});
function sound(type='move',seat=-1){
  if(muted||!audioContext||audioContext.state!=='running')return;
  const ctx=audioContext,at=ctx.currentTime,pan=ctx.createStereoPanner();
  pan.pan.value=seat<0?0:[0,-.85,0,.85][relative(seat)];pan.connect(ctx.destination);
  if(type==='move'){
    // The exact same synthesis is used for theft and knock. Only direction and timing differ.
    const length=Math.floor(ctx.sampleRate*.21),buffer=ctx.createBuffer(1,length,ctx.sampleRate),data=buffer.getChannelData(0);
    for(let i=0;i<length;i++)data[i]=(Math.random()*2-1)*Math.exp(-i/(ctx.sampleRate*.045))*.17;
    const source=ctx.createBufferSource();source.buffer=buffer;
    const filter=ctx.createBiquadFilter();filter.type='bandpass';filter.frequency.value=seat>=0&&relative(seat)===2?1500:2300;filter.Q.value=.7;
    source.connect(filter);filter.connect(pan);source.start(at);
    for(const [delay,hz] of [[0,1150],[.055,1770]]){const oscillator=ctx.createOscillator(),gain=ctx.createGain();oscillator.type='sine';oscillator.frequency.value=hz;gain.gain.setValueAtTime(.09,at+delay);gain.gain.exponentialRampToValueAtTime(.0001,at+delay+.13);oscillator.connect(gain);gain.connect(pan);oscillator.start(at+delay);oscillator.stop(at+delay+.14);}
  }else{const o=ctx.createOscillator(),g=ctx.createGain();o.type=type==='lights'?'triangle':'sine';o.frequency.setValueAtTime(type==='lights'?90:440,at);o.frequency.exponentialRampToValueAtTime(type==='lights'?35:220,at+.2);g.gain.setValueAtTime(.15,at);g.gain.exponentialRampToValueAtTime(.0001,at+.3);o.connect(g);g.connect(pan);o.start(at);o.stop(at+.31);}
}
async function request(path,body){
  const start=Date.now();const abort=new AbortController(),timeout=setTimeout(()=>abort.abort(),9000);
  try{
    const response=await fetch(path,{method:body?'POST':'GET',headers:{'X-Player-Token':token,...(body?{'Content-Type':'application/json'}:{})},body:body?JSON.stringify(body):undefined,cache:'no-store',signal:abort.signal});
    let data;try{data=await response.json();}catch{throw new Error('房间服务没有返回有效数据');}
    if(!response.ok){const error=new Error(data.error||'请求失败');error.status=response.status;throw error;}
    latency=Date.now()-start;if(data.serverNow){const sample=data.serverNow-(start+Date.now())/2;offset=lastContact?offset*.3+sample*.7:sample;}lastContact=Date.now();
    return data;
  }finally{clearTimeout(timeout);}
}
function accept(data){
  if(state&&data.code===state.code&&data.version<state.version)return;
  const changedRound=!state||state.round!==data.round||state.code!==data.code;
  state=data;
  if(changedRound){selected=-1;busyAction=false;busyVote=false;heard.clear();pulseMemory.length=0;resultDismissed=false;recallOpen=false;}
  sessionStorage.setItem('inheritance-room',data.code);
  for(const pulse of state.pulses||[]){if(heard.has(pulse.id))continue;heard.add(pulse.id);pulseMemory.push(pulse);
    // Old events on refresh remain available as notes, but are never replayed as fresh sounds.
    if(Date.now()+offset-pulse.at<1300){sound('move',pulse.seat);showSoundMark(pulse.seat);}
  }
  render();if(voiceStream)syncVoice().catch(()=>{});
}
async function send(type,extra={}){
  if(!roomCode)return;
  const targetRoom=roomCode;
  const body={type,round:state?.round,requestId:crypto.randomUUID(),...extra};
  const data=await request('/api/rooms/'+targetRoom+'/command',body);if(!data.left&&roomCode===targetRoom)accept(data);return data;
}
async function connect(mode){
  unlockAudio();const name=$('name').value.trim()||'来客';localStorage.setItem('inheritance-name',name);
  const buttons=['create-room','practice-room','join-room','rejoin-room'];buttons.forEach(id=>$(id).disabled=true);
  try{
    let data;
    if(mode==='create'||mode==='practice')data=await request('/api/rooms',{name});
    else{const code=mode==='rejoin'?sessionStorage.getItem('inheritance-room'):$('room-input').value.toUpperCase().trim();if(!/^[A-Z2-9]{6}$/.test(code||''))throw new Error('请输入六位房间码');data=await request('/api/rooms/'+code+'/join',{name});}
    roomCode=data.code;state=null;lastContact=Date.now();accept(data);show('loading',false);poll(++generation);
    if(data.players.find(p=>p.seat===data.me)?.voice&&!voiceStream)await send('voice',{enabled:false});
    if(mode==='practice'){await send('practice');await send('ready',{ready:true});await send('start');}
  }catch(error){toast(error.message);if(error.status===401||error.status===404){sessionStorage.removeItem('inheritance-room');show('rejoin-row',false);}}
  finally{buttons.forEach(id=>$(id).disabled=false);}
}
async function poll(myGeneration){
  while(myGeneration===generation&&roomCode){
    try{const data=await request('/api/rooms/'+roomCode);if(myGeneration!==generation)break;accept(data);}
    catch(error){if(myGeneration!==generation)break;if(error.status===401||error.status===404){toast(error.message);exitRoom(false);break;}renderConnection();}
    const delay=['dark','countdown'].includes(effectivePhase())?180:state?.phase==='lobby'?1000:550;
    await new Promise(resolve=>setTimeout(resolve,delay));
  }
}
function effectivePhase(){
  if(!state)return '';
  const now=Date.now()+offset;
  if(state.phase==='countdown'&&now>=state.deadline)return now<state.deadline+3000?'dark':'debate';
  if(state.phase==='dark'&&now>=state.deadline)return 'debate';
  return state.phase;
}
function clock(){
  if(!state)return;
  renderConnection();const phase=effectivePhase(),now=Date.now()+offset;
  let deadline=state.deadline;
  if(state.phase==='countdown'&&phase==='dark')deadline+=3000;
  if((state.phase==='dark'||state.phase==='countdown')&&phase==='debate')deadline+=state.phase==='countdown'?38000:35000;
  const left=Math.max(0,(deadline-now)/1000);
  $('phase-time').textContent=phase==='lobby'||phase==='finished'?'':phase==='debate'?'少了 '+(state.missing??'?')+' 枚 · 讨论 '+Math.ceil(left)+' 秒':(phase==='dark'?left.toFixed(1):Math.ceil(left))+' 秒';
  if(phase!==lastPhase){lastPhase=phase;if(phase==='dark'){$('chat-text').blur();$('game').focus();}render();if(['dark','debate'].includes(phase))sound('lights');}
  if(phase==='dark'&&!state.ownAction)$('notice-title').textContent=left.toFixed(1);
  if(state.phase==='result')$('next-round').textContent=Math.ceil(left)+' 秒后继续';
  updateScene(phase);
}
function renderConnection(){
  const stale=state&&Date.now()-lastContact>3500;
  document.body.classList.toggle('disconnected',!!stale);$('connection').classList.toggle('offline',!!stale);
  $('connection').textContent=!state?'尚未入席':stale?'连接中断，正在重连':latency>700?'网络较慢 · '+latency+' ms':'已入席 · '+latency+' ms';
}
function render(){
  const active=!!state,phase=effectivePhase(),lobby=phase==='lobby',finished=phase==='finished';
  document.body.dataset.phase=phase;document.body.classList.toggle('dark',phase==='dark');show('entry',!active);show('lobby',active&&lobby);show('phasebar',active&&!lobby);show('my-coins',active);show('mic',active);show('chat',active&&!lobby&&!finished);
  $('room-tag').textContent=active?state.code:'';if(!active){show('targets',false);show('actionbar',false);show('notice',false);show('recall',false);show('results',false);show('action-hint',false);return;}
  const me=state.players.find(p=>p.seat===state.me);$('my-coins').textContent='私房钱 '+me.coins;
  $('round-label').textContent='第 '+state.round+' 夜 / 共 '+state.maxRounds+' 夜';
  $('phase-title').textContent={countdown:'把手放回桌边',dark:'灯灭了',debate:'谁动了手？',vote:'指认，或保持沉默',result:'遗嘱记下一笔',finished:'分家已定'}[phase]||'';
  if(lobby)renderLobby();
  const previous=lastRound;lastRound=state.round;
  show('notice',!lobby&&!finished&&['countdown','dark'].includes(phase));
  if(phase==='countdown'){$('notice-title').textContent='灯即将熄灭';$('notice-copy').textContent='听清方向，记住时间。每夜只能行动一次。';}
  if(phase==='dark'){$('notice-title').textContent=state.ownAction?'手已收回':'';$('notice-copy').textContent=state.ownAction?(state.ownAction.kind==='steal'?'你拿走了一枚钱。':'你敲了一下桌子。'):'Q 偷钱 · E 敲桌 · 不操作就是不动';}
  if(phase==='debate'){$('notice-title').textContent=state.missing===null?'正在清点桌面':'桌上少了 '+state.missing+' 枚';$('notice-copy').textContent='你听见的是偷钱，还是故意弄出的响声？';}
  const canTarget=phase==='vote'&&!state.voted;
  const nameplates=['countdown','debate','vote'].includes(phase);show('targets',nameplates);
  if(nameplates)setMarkup('targets',[1,2,3].map(rel=>{
    const seat=(state.me+rel)%4,p=state.players.find(p=>p.seat===seat);
    const detail=phase==='vote'?(state.voted?' · 已锁定':' · 选择指认'):(!p?.online?' · 离线':p?.voice?' · 语音已开':'');
    return '<button data-target="'+seat+'" class="'+(phase!=='vote'?'nameplate ':selected===seat?'selected':'')+'" '+(!canTarget?'disabled':'')+'>'+escape(names(seat))+'<div class="target-detail">'+['','左手边','正对面','右手边'][rel]+detail+'</div></button>';
  }).join(''));
  show('actionbar',!lobby&&!finished&&['dark','vote','debate'].includes(phase));show('action-hint',!lobby&&!finished&&['dark','vote','debate'].includes(phase));
  if(phase==='dark'){setMarkup('actionbar','<button data-action="steal" class="primary" '+(state.ownAction||busyAction?'disabled':'')+'><kbd>Q</kbd> 偷一枚<small>钱进你的口袋</small></button><button data-action="knock" '+(state.ownAction||busyAction?'disabled':'')+'><kbd>E</kbd> 敲一下<small>制造相同动静</small></button>');$('action-hint').textContent=state.ownAction?'本夜行动已锁定':'什么都不按就是不动，别急着暴露自己。';}
  if(phase==='debate'){
    setMarkup('actionbar','<button id="talk-toggle" class="quiet">说说你的证词<small>听完解释，再决定指认谁</small></button><button id="discussion-ready" '+(state.discussReady?'disabled':'')+'>'+(state.discussReady?'等其他人说完':'我说完了')+'<small>'+state.discussReadyCount+' / 4 人准备指认</small></button>');
    $('action-hint').textContent='四人都说完可提前指认，也可以继续讨论到时间结束。';
  }
  if(phase==='vote'){setMarkup('actionbar',state.voted?'<button disabled>指认已锁定<small>'+state.voteCount+' / 4 人已提交</small></button>':'<button id="vote-confirm" '+(selected<0||busyVote?'disabled':'')+'>指认 '+(selected<0?'一位来客':escape(names(selected)))+'<small>猜中 +1，猜错 −1</small></button><button id="vote-pass" '+(busyVote?'disabled':'')+'>保持沉默<small>本夜不指认</small></button>');$('action-hint').textContent=state.voted?'等所有人锁定后，一起揭晓。':'选择一人后，按指认按钮锁定。';}
  show('recall-toggle',['debate','vote','result'].includes(phase));show('recall',recallOpen&&['debate','vote','result'].includes(phase));renderRecall();renderChat();
  show('result-open',['result','finished'].includes(phase));
  if(phase==='result'||finished){renderResult(finished);show('results',!resultDismissed);}else{show('results',false);resultDismissed=false;}
  updateScene(phase);
}
function renderLobby(){
  $('lobby-code').textContent=state.code;
  setMarkup('seat-list',[0,1,2,3].map(seat=>{
    const p=state.players.find(p=>p.seat===seat);
    const remove=p&&state.me===state.host&&seat!==state.me?'<button class="small quiet seat-remove" data-kick="'+seat+'">腾出座位</button>':'';
    return '<div class="seat-card '+(seat===state.me?'mine':'')+'"><div class="seat-number">座位 '+(seat+1)+(seat===state.host?' · 房主':'')+'</div><div class="seat-name">'+(p?escape(p.name)+(seat===state.me?' · 你':''):'空着的椅子')+'</div><div class="seat-state '+(!p||!p.ready?'wait':'')+'">'+(!p?'等待入席':!p.online?'暂时离线':p.ready?'已准备':'尚未准备')+'</div>'+remove+'</div>';
  }).join(''));
  const me=state.players.find(p=>p.seat===state.me);$('ready').textContent=me.ready?'取消准备':'准备好了';show('start',state.host===state.me);show('add-bots',state.host===state.me&&state.players.length<4);$('start').disabled=state.players.length!==4||state.players.some(p=>!p.ready||!p.online);
}
let lastMessageIds='';
function renderChat(){
  const key=state.code+':'+state.messages.map(m=>m.id).join(',');if(key===lastMessageIds)return;lastMessageIds=key;
  const log=$('chat-log'),nearBottom=log.scrollHeight-log.scrollTop-log.clientHeight<70;
  log.innerHTML=state.messages.map(m=>m.seat<0?'<p class="system">'+escape(m.text)+'</p>':'<p><b>'+escape(names(m.seat))+'　</b>'+escape(m.text)+'</p>').join('');
  if(nearBottom)log.scrollTop=log.scrollHeight;
}
function renderRecall(){
  const events=pulseMemory.filter(p=>p.seat!==state.me).sort((a,b)=>a.at-b.at);
  $('recall-log').innerHTML=events.length?events.map(p=>{const time=(p.at-state.darkStart)/1000;const period=time<1?'刚熄灯':time<2?'黑灯中段':'快亮灯时';return '<div>'+direction(p.seat)+' · '+period+'</div>';}).join(''):'你没有记下别人的动静。';
}
function renderResult(finished){
  $('result-label').textContent=finished?'遗嘱最后一页':'第 '+state.round+' 夜 · 指认结果';
  $('result-title').textContent=finished?state.winners.map(names).join('、')+' 继承旧宅':'灯照出了谁的破绽';
  $('result-description').textContent=finished?'私房钱已公开。钱最多的人获胜，并列时共同继承。':'本夜共偷走 '+(state.result?.stolen??0)+' 枚，抓住 '+(state.result?.caught?.length??0)+' 人。同一人被多人抓住，只罚一次。';
  setMarkup('result-list',state.players.map(p=>{
    if(finished)return '<div class="result-card"><h3>'+escape(p.name)+(p.seat===state.me?' · 你':'')+'</h3><div class="rank">'+p.coins+' 枚</div><p>'+ (state.winners.includes(p.seat)?'继承人':'遗嘱上的来客')+'</p></div>';
    const j=state.result?.judgements.find(j=>j.seat===p.seat),change=state.result?.changes.find(c=>c.seat===p.seat)?.delta||0;
    return '<div class="result-card"><h3>'+escape(p.name)+(p.seat===state.me?' · 你':'')+'</h3><p>'+(!j||j.target<0?'保持了沉默':'指认 '+escape(names(j.target)))+'</p><p class="'+(j?.target<0?'':j?.correct?'right':'wrong')+'">'+(j?.target<0?'不奖不罚':j?.correct?'抓对了 · 奖励 1 枚':'猜错了 · 赔付 1 枚')+'</p>'+(state.result?.caught.includes(p.seat)?'<p class="wrong">被抓住偷钱 · 已扣退赔款</p>':'')+'<p>本次结算 '+(change>0?'+':'')+change+' 枚</p></div>';
  }).join(''));
  show('rematch',finished&&state.host===state.me);show('result-leave',finished);show('score-review',finished);show('next-round',!finished);
  if(finished)setMarkup('score-review',(state.history||[]).map(h=>'<details><summary>第 '+h.round+' 夜的真实动作</summary>'+h.actions.map(a=>escape(names(a.seat))+' '+(a.kind==='steal'?'偷钱':'敲桌')).join(' · ')+'</details>').join(''));
}
function updateScene(phase){
  if(!sceneReady||!state)return;
  const payload={phase,me:state.me,selected,coins:state.players.find(p=>p.seat===state.me)?.coins||0,bank:state.bank??-1,players:state.players.map(p=>({seat:p.seat,name:p.name,online:p.online}))};
  const value=JSON.stringify(payload);if(value===lastUnity)return;lastUnity=value;
  scene.SendMessage('TableSession','ApplyState',value);
}
function showSoundMark(seat){if(!state||seat===state.me)return;const mark=document.createElement('div');mark.className='soundmark';mark.style.left=({1:'19%',2:'50%',3:'81%'})[relative(seat)];document.body.append(mark);setTimeout(()=>mark.remove(),650);}
async function act(kind){
  if(effectivePhase()!=='dark'||busyAction||state.ownAction||Date.now()-lastContact>3500)return;
  busyAction=true;render();if(sceneReady)scene.SendMessage('TableSession','PerformAction',kind);
  try{await send('action',{kind});}catch(error){toast(error.message);}finally{busyAction=false;render();}
}
async function vote(target){if(busyVote||state.voted)return;busyVote=true;render();try{await send('vote',{target});}catch(error){toast(error.message);}finally{busyVote=false;render();}}
async function chat(text){if(!state)return;try{await send('chat',{text});$('chat-text').value='';}catch(error){toast(error.message);}}
function exitRoom(notify=true){if(notify&&roomCode)send('leave').catch(()=>{});stopVoice();generation++;roomCode='';state=null;sessionStorage.removeItem('inheritance-room');show('rejoin-row',false);document.body.classList.remove('dark','disconnected');render();renderConnection();}
window.InheritanceSelect=relativeSeat=>{if(!state||effectivePhase()!=='vote'||state.voted)return;selected=(state.me+Number(relativeSeat))%4;render();};
window.InheritanceAction=act;
$('create-room').onclick=()=>connect('create');$('practice-room').onclick=()=>connect('practice');$('join-room').onclick=()=>connect('join');$('rejoin-room').onclick=()=>connect('rejoin');
$('room-input').addEventListener('keydown',event=>{if(event.key==='Enter')connect('join');});
$('ready').onclick=()=>send('ready',{ready:!state.players.find(p=>p.seat===state.me).ready}).catch(e=>toast(e.message));$('start').onclick=()=>send('start').catch(e=>toast(e.message));$('add-bots').onclick=()=>send('practice').catch(e=>toast(e.message));$('leave').onclick=()=>exitRoom();$('result-leave').onclick=()=>exitRoom();$('rematch').onclick=()=>{resultDismissed=false;send('rematch').catch(e=>toast(e.message));};
$('copy-invite').onclick=async()=>{const url=new URL(location.href);url.search='?room='+state.code;try{await navigator.clipboard.writeText(url.href);toast('邀请链接已复制，发给另外三人即可');}catch{toast('房间码 '+state.code+'，复制当前网址并发送给朋友');}};
$('targets').addEventListener('click',event=>{const button=event.target.closest('[data-target]');if(button&&!button.disabled){selected=Number(button.dataset.target);render();}});
$('seat-list').addEventListener('click',event=>{const button=event.target.closest('[data-kick]');if(button)send('kick',{target:Number(button.dataset.kick)}).catch(error=>toast(error.message));});
$('actionbar').addEventListener('click',event=>{const button=event.target.closest('button');if(!button||button.disabled)return;if(button.dataset.action)act(button.dataset.action);if(button.id==='vote-confirm')vote(selected);if(button.id==='vote-pass')vote(-1);if(button.id==='discussion-ready')send('discussionReady').catch(error=>toast(error.message));if(button.id==='talk-toggle'){$('chat-body').hidden=false;$('chat-text').focus();}});
$('chat-form').onsubmit=event=>{event.preventDefault();chat($('chat-text').value);};$('quick-chat').onclick=event=>{const button=event.target.closest('[data-say]');if(button)chat(button.dataset.say);};$('chat-collapse').onclick=()=>{$('chat-body').hidden=!$('chat-body').hidden;$('chat-collapse').textContent=$('chat-body').hidden?'展开':'收起';};
$('help-open').onclick=()=>show('help',true);$('help-close').onclick=()=>show('help',false);$('sound-toggle').onclick=()=>{unlockAudio();muted=!muted;$('sound-toggle').textContent='声音 '+(muted?'关':'开');};$('recall-toggle').onclick=()=>{recallOpen=!recallOpen;render();};$('result-close').onclick=()=>{resultDismissed=true;show('results',false);};$('result-open').onclick=()=>{resultDismissed=false;show('results',true);};
$('fullscreen').onclick=()=>{if(document.fullscreenElement)document.exitFullscreen();else document.documentElement.requestFullscreen().catch(()=>toast('浏览器未允许全屏'));};
// Scene load is independent of the room connection, so a slow texture download never drops a seat.
async function loadScene(){
  const config=window.BUILD_CONFIG,progress=$('progress');
  try{
    const buffers=[];for(let i=0;i<config.parts.length;i++){$('status').textContent='正在下载饭厅 '+(i+1)+' / '+config.parts.length;const response=await fetch('Build/'+config.parts[i]);if(!response.ok)throw new Error('场景下载失败 '+response.status);buffers.push(await response.arrayBuffer());progress.value=(i+1)/config.parts.length*.55;}
    $('status').textContent='正在点亮饭厅';const data=await new Response(new Blob(buffers).stream().pipeThrough(new DecompressionStream('gzip'))).blob(),dataUrl=URL.createObjectURL(data);
    try{scene=await createUnityInstance($('game'),{dataUrl,frameworkUrl:config.framework,codeUrl:config.wasm,streamingAssetsUrl:'StreamingAssets',companyName:'Independent Prototype',productName:'Last Inheritance',productVersion:'0.4.0',showBanner:(message,type)=>{if(type==='error')console.error(message);}},value=>{progress.value=.55+value*.45;$('status').textContent='正在点亮饭厅 '+Math.round(value*100)+'%';});sceneReady=true;show('loading',false);updateScene(effectivePhase());}
    finally{URL.revokeObjectURL(dataUrl);}
  }catch(error){console.error(error);document.body.classList.add('scene-failed');$('status').textContent='三维场景未能载入';$('loader-error').textContent='可以重试载入，也可以先进入房间完成规则试玩。'+error.message;show('loader-error',true);show('retry-load',true);}
}
$('game').addEventListener('contextmenu',event=>event.preventDefault());$('skip-load').onclick=()=>show('loading',false);$('retry-load').onclick=()=>location.reload();
document.addEventListener('keydown',event=>{
  if(event.key==='Escape'){show('help',false);show('results',false);resultDismissed=true;return;}
  if(event.target.closest('input,textarea')||!$('help').hidden||event.repeat)return;
  if(event.key.toLowerCase()==='q'){event.preventDefault();unlockAudio();act('steal');}
  if(event.key.toLowerCase()==='e'){event.preventDefault();unlockAudio();act('knock');}
});
let voiceStream=null;
window.addEventListener('pagehide',()=>{
  if(!roomCode||!voiceStream)return;
  fetch('/api/rooms/'+roomCode+'/command',{method:'POST',headers:{'X-Player-Token':token,'Content-Type':'application/json'},body:JSON.stringify({type:'voice',enabled:false,requestId:crypto.randomUUID()}),keepalive:true}).catch(()=>{});
  stopVoice();
});
const peers=new Map(),voiceSignals=new Set();let voiceEpoch='',voiceSyncing=false;
async function signal(to,kind,data){if(!roomCode||!voiceStream)return;const code=roomCode;const result=await request('/api/rooms/'+code+'/signals',{to,kind,data});if(code===roomCode)accept(result);}
function closePeer(seat){const peer=peers.get(seat);peer?.pc.close();peer?.audio.remove();peers.delete(seat);}
function voicePeer(seat,epoch){
  const old=peers.get(seat);if(old&&old.epoch===epoch)return old;closePeer(seat);
  const pc=new RTCPeerConnection({iceServers:[{urls:'stun:stun.cloudflare.com:3478'},{urls:'stun:stun.l.google.com:19302'}]});
  const audio=document.createElement('audio');audio.autoplay=true;$('remote-audio').append(audio);
  const peer={pc,audio,epoch,ice:[],created:Date.now()};peers.set(seat,peer);
  voiceStream.getTracks().forEach(track=>pc.addTrack(track,voiceStream));
  pc.ontrack=event=>{audio.srcObject=event.streams[0];audio.play().catch(()=>{});};
  pc.onicecandidate=event=>{if(event.candidate)signal(seat,'ice',{epoch,candidate:event.candidate.toJSON()}).catch(()=>{});};
  pc.onconnectionstatechange=()=>{if(pc.connectionState==='failed')toast('语音直连失败，桌边文字聊天仍可用');};
  return peer;
}
function stopVoice(){for(const seat of peers.keys())closePeer(seat);voiceStream?.getTracks().forEach(track=>track.stop());voiceStream=null;voiceSignals.clear();$('mic').classList.remove('active');$('mic').textContent='开启语音';}
async function syncVoice(){
  if(!state||!voiceStream||voiceSyncing)return;voiceSyncing=true;
  try{
    for(const seat of peers.keys()){const p=state.players.find(p=>p.seat===seat);if(!p?.voice||!p.online)closePeer(seat);}
    for(const item of [...(state.signals||[])].sort((a,b)=>(a.kind==='ice')-(b.kind==='ice'))){
      if(voiceSignals.has(item.id))continue;voiceSignals.add(item.id);
      const other=state.players.find(p=>p.seat===item.from);if(!other?.voice||!item.data?.epoch||!item.data.epoch.includes(voiceEpoch)||!item.data.epoch.includes(other.voiceEpoch))continue;
      if(item.kind==='offer'){
        const peer=voicePeer(item.from,item.data.epoch);await peer.pc.setRemoteDescription(item.data.description);
        for(const candidate of peer.ice)await peer.pc.addIceCandidate(candidate);peer.ice=[];
        const answer=await peer.pc.createAnswer();await peer.pc.setLocalDescription(answer);await signal(item.from,'answer',{epoch:peer.epoch,description:answer});
      }else{
        const peer=peers.get(item.from);if(!peer||peer.epoch!==item.data.epoch){if(item.kind==='ice')voiceSignals.delete(item.id);continue;}
        if(item.kind==='answer'){await peer.pc.setRemoteDescription(item.data.description);for(const candidate of peer.ice)await peer.pc.addIceCandidate(candidate);peer.ice=[];}
        if(item.kind==='ice'){if(peer.pc.remoteDescription)await peer.pc.addIceCandidate(item.data.candidate);else peer.ice.push(item.data.candidate);}
      }
    }
    for(const p of state.players.filter(p=>p.seat>state.me&&p.voice&&p.online&&!p.bot)){
      const epoch=voiceEpoch+'-'+p.voiceEpoch,old=peers.get(p.seat);
      if(old&&old.epoch===epoch&&(Date.now()-old.created<20000||old.pc.connectionState==='connected'))continue;
      closePeer(p.seat);const peer=voicePeer(p.seat,epoch);const offer=await peer.pc.createOffer();await peer.pc.setLocalDescription(offer);await signal(p.seat,'offer',{epoch,description:offer});
    }
  }finally{voiceSyncing=false;}
}
$('mic').onclick=async()=>{
  if(voiceStream){stopVoice();send('voice',{enabled:false}).catch(()=>{});return;}
  if(!localVoiceTest&&!navigator.mediaDevices?.getUserMedia){toast('当前浏览器不支持麦克风，请使用电脑 Chrome 或 Edge');return;}
  $('mic').disabled=true;
  try{
    if(localVoiceTest){unlockAudio();const source=audioContext.createOscillator(),gain=audioContext.createGain(),destination=audioContext.createMediaStreamDestination();source.frequency.value=440;gain.gain.value=.001;source.connect(gain);gain.connect(destination);source.start();voiceStream=destination.stream;voiceStream.getTracks()[0].addEventListener('ended',()=>source.stop(),{once:true});}
    else voiceStream=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true},video:false});
    voiceEpoch=crypto.randomUUID();$('mic').classList.add('active');$('mic').textContent='语音已开 · 点击关闭';await send('voice',{enabled:true,epoch:voiceEpoch});toast(localVoiceTest?'正在用合成音测试语音链路，未访问麦克风。':'语音已开启。若无法直连，仍可使用文字聊天。');await syncVoice();
  }
  catch(error){stopVoice();toast(error.name==='NotAllowedError'?'麦克风未获授权，文字聊天仍可用':'语音开启失败，请检查麦克风');}
  finally{$('mic').disabled=false;}
};
setInterval(async()=>{
  if(!voiceStream)return;
  let connected=0,receiving=0;
  for(const peer of peers.values())if(peer.pc.connectionState==='connected'){
    connected++;try{const stats=await peer.pc.getStats();stats.forEach(report=>{if(report.type==='inbound-rtp'&&report.kind==='audio'&&report.bytesReceived>0)receiving++;});}catch{}
  }
  $('mic').textContent=localVoiceTest?'语音 '+connected+' 人 · 收音 '+receiving+' 人':'语音 '+connected+' 人 · 关闭';
},1500);
setInterval(clock,100);render();if(localVoiceTest&&params.get('lite')==='1')show('loading',false);else loadScene();
