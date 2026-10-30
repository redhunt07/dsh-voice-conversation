const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const React=require('react');
const Renderer=require('react-test-renderer');
const {act}=Renderer;
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
let exported,api;
const watchers=new Set();
let lifecycle={running:false,pendingSubmissions:[],lastAgentError:null,promptError:null};
let legacy={nodes:[],partial:null,turnEnds:new Map()};
let status=new Map();
const emit=()=>watchers.forEach(f=>f());
function hook(read){return selector=>selector(React.useSyncExternalStore(f=>{watchers.add(f);return()=>watchers.delete(f)},read));}
let initCount=0,recordings=0,sttCalls=0,ttsCalls=0,cancels=0,submissions=0,audioPlays=0,ttsMode='ok';
let pendingTts;
const mic={init:async()=>{initCount++},teardown(){},startRecording(){recordings++},stopRecording(){},startMonitoring(){},stopMonitoring(){},hasSamples:()=>true,snapshotWavBytes:()=>new Uint8Array(5000)};
class FakeAudio {
 constructor(){this.listeners=new Map();this.duration=.01;this.mode='ended';}
 addEventListener(name,f){if(!this.listeners.has(name))this.listeners.set(name,new Set());this.listeners.get(name).add(f)}
 removeEventListener(name,f){this.listeners.get(name)?.delete(f)}
 dispatch(name){for(const f of [...(this.listeners.get(name)||[])])f()}
 play(){this.paused=false;this.ended=false;audioPlays++;if(this.mode==='ended')setTimeout(()=>(this.ended=true,this.dispatch('ended')),5);return Promise.resolve()}
 pause(){}
}
const audio=new FakeAudio();
const ctx={console:{log(){},warn(){},error(){},table(){}},performance:{now:()=>Date.now()},setTimeout,clearTimeout,setInterval,clearInterval,AbortController,Uint8Array,Float32Array,Int16Array,ArrayBuffer,DataView,
 requestAnimationFrame:()=>1,cancelAnimationFrame(){},
 URL:{createObjectURL:()=>`blob:${Math.random()}`,revokeObjectURL(){}},
 document:{body:{},querySelectorAll:()=>[]},MutationObserver:class{observe(){}disconnect(){}},
 __fakeMic:mic,
 fetch:async(url)=>{
  if(url.endsWith('/transcribe')){sttCalls++;return {ok:true,json:async()=>({text:'Comando '+sttCalls})}}
  if(url.endsWith('/speak')){
   ttsCalls++;
   if(ttsMode==='failure')return {ok:false,status:503,json:async()=>({error:'TTS test error'})};
   if(ttsMode==='deferred')await new Promise(r=>pendingTts=r);
   return {ok:true,blob:async()=>({audio:true})};
  }
  return {ok:true,json:async()=>({ok:true})};
 },window:{__ModuleLoader__:{load:({factory})=>{exported=factory(name=>{if(name==='react')return React;throw Error('Unexpected import '+name)})}}}};
vm.createContext(ctx);
let code=fs.readFileSync(process.env.VOICE_CLIENT_PATH || require('node:path').join(__dirname,'../src/client.js'),'utf8');
code=code.replace('var stateLabels = {',"if(props.__capture)props.__capture({stopAndSend,interruptThinking,interruptPlayback,currentTurnRef,beginListening,observeVoiceTurn});\n      var stateLabels = {");
code=code.replace('exports.apply = apply','createPersistentMicCapture=function(){return globalThis.__fakeMic}; exports.__test={VoiceModeView,useVoiceSessionSnapshot,playVoiceAudio,pickVoiceForText}; exports.apply = apply');
vm.runInContext(code,ctx);
const props={sessionId:'test',useSession:hook(()=>lifecycle),useChat:hook(()=>({legacy})),useSessionStatus:hook(()=>status),inputActions:{setDraft(){},submit(){submissions++;lifecycle={...lifecycle,running:true};emit()}},cancelSession:async()=>{cancels++},audioGraph:{el:audio,ctx:{state:'running'}},__capture:value=>{api=value},onExit(){}};
// Cache the full Chat snapshot exactly as the actual observable does.
let chat={legacy};props.useChat=hook(()=>chat);
function publish(life,chatLegacy){if(life)lifecycle={...lifecycle,...life};if(chatLegacy){legacy={...legacy,...chatLegacy};chat={legacy}}emit()}
function Harness(){const session=exported.__test.useVoiceSessionSnapshot(props);return React.createElement(exported.__test.VoiceModeView,{...props,session})}
let renderer;
function statusText(){return JSON.stringify(renderer.toJSON())}
async function submit(){await act(async()=>{await api.stopAndSend();await sleep(1)});assert.equal(renderer.root.findByProps({'aria-label':'Conversazione vocale continua'}).props['data-voice-state'],'thinking')}
async function complete(turn,seq){await act(async()=>{publish({running:false},{nodes:[...legacy.nodes,{kind:'assistant',seq,messageId:'m'+seq,turn,blocks:[{kind:'text',text:'Risposta '+turn}]}],partial:null,turnEnds:new Map([...legacy.turnEnds,[turn,seq+1]])});await sleep(25)})}
(async()=>{
 await act(async()=>{renderer=Renderer.create(React.createElement(Harness));await sleep(2)});
 assert.equal(initCount,1);assert.equal(recordings,1);assert.ok(statusText().includes('Ti ascolto'));
 await submit();
 await act(async()=>{publish(null,{nodes:[{kind:'assistant',seq:1,messageId:'progress',turn:1,blocks:[{kind:'text',text:'Sto lavorando'}]}]});await sleep(1)});
 assert.equal(ttsCalls,0,'Do not narrate an intermediate tool step before the turn completes');
 await complete(1,2);assert.ok(statusText().includes('Ti ascolto'));assert.equal(recordings,2);
 await submit();await complete(2,3);assert.ok(statusText().includes('Ti ascolto'));assert.equal(recordings,3);assert.equal(initCount,1);
 ttsMode='failure';await submit();await complete(3,4);assert.equal(recordings,4,'TTS failure must restart capture');
 ttsMode='deferred';await submit();
 await act(async()=>{publish({running:false},{nodes:[...legacy.nodes,{kind:'assistant',seq:5,messageId:'m5',turn:4,blocks:[{kind:'text',text:'Interrupted'}]}]});await sleep(1)});
 const beforeInterrupt=audioPlays;
 await act(async()=>{api.interruptThinking(api.currentTurnRef.current);await sleep(1);pendingTts();await sleep(10)});
 assert.equal(cancels,1);assert.equal(audioPlays,beforeInterrupt,'An interrupted synthesis must never play late');assert.ok(statusText().includes('Ti ascolto'));assert.equal(recordings,5);
 ttsMode='ok';await submit();await act(async()=>{publish({running:false,lastAgentError:'Failure for regression test'});await sleep(400)});assert.equal(recordings,6,'An errored turn with no assistant text must not leave the loop waiting');
 // Lifecycle idle can arrive long before the final durable chat event.
 publish({lastAgentError:null});
 await submit();
 await act(async()=>{publish({running:false});await sleep(650)});
 assert.ok(statusText().includes('Elaboro'),'Do not drop a delayed chat reply after 350ms');
 const beforeDelayed=ttsCalls;await complete(6,10);assert.equal(ttsCalls,beforeDelayed+1);assert.ok(statusText().includes('Ti ascolto'));
 // A completed turn remains authoritative even with a stale running/partial snapshot.
 await submit();const beforeStale=ttsCalls;
 await act(async()=>{publish({running:true},{nodes:[...legacy.nodes,{kind:'assistant',seq:11,messageId:'m11',turn:7,blocks:[{kind:'text',text:'Risposta completa'}]}],partial:{turn:7,blocks:[]},turnEnds:new Map([...legacy.turnEnds,[7,12]])});await sleep(30)});
 assert.equal(ttsCalls,beforeStale+1,'Durable completion must clear a stale partial/running wait');assert.ok(statusText().includes('Ti ascolto'));
 publish({running:false},{partial:null});
 // Pending approval continuation retains the SAME DSH turn number.
 await submit();
 await act(async()=>{publish(null,{nodes:[...legacy.nodes,{kind:'assistant',seq:13,messageId:'before-approval',turn:8,blocks:[{kind:'text',text:'Serve conferma'}]}]});status=new Map([['test',{pendingInteraction:{kind:'approval'}}]]);emit();await sleep(550)});
 const beforeContinuation=ttsCalls;
 await act(async()=>{status=new Map();emit();await sleep(5)});
 await complete(8,14);assert.equal(ttsCalls,beforeContinuation+1,'Read the reply after an approval within the same session turn');assert.ok(statusText().includes('Ti ascolto'));
 // Pending resolution and final text may arrive in the same render.
 await submit();
 await act(async()=>{publish(null,{nodes:[...legacy.nodes,{kind:'assistant',seq:15,messageId:'pending-again',turn:9,blocks:[{kind:'text',text:'Una conferma'}]}]});status=new Map([['test',{pendingInteraction:{kind:'approval'}}]]);emit();await sleep(550)});
 const beforeSameRender=ttsCalls;
 await act(async()=>{status=new Map();publish({running:false},{nodes:[...legacy.nodes,{kind:'assistant',seq:16,messageId:'resumed-final',turn:9,blocks:[{kind:'text',text:'Confermato, ho finito.'}]}],turnEnds:new Map([...legacy.turnEnds,[9,17]])});await sleep(30)});
 assert.equal(ttsCalls,beforeSameRender+1,'Do not swallow the reply delivered together with approval resolution');assert.ok(statusText().includes('Ti ascolto'));
 // A void/no-op submit can never strand the loop without lifecycle events.
 const originalSubmit=props.inputActions.submit;props.inputActions.submit=()=>{};
 await submit();api.currentTurnRef.current.createdAt-=9000;
 await act(async()=>{api.observeVoiceTurn(lifecycle);await sleep(1050)});
 assert.ok(statusText().includes('Ti ascolto'),'No-op submission must recover');props.inputActions.submit=originalSubmit;
 // Native media events queued by the previous src must not silence this reply.
 class NativeEventAudio extends FakeAudio {
  set src(value){this._src=value;setTimeout(()=>{this.dispatch('abort');this.dispatch('pause')},1)}
  get src(){return this._src}
  play(){this.paused=false;this.ended=false;setTimeout(()=>{this.ended=true;this.dispatch('ended')},25);return Promise.resolve()}
  pause(){this.paused=true}
 }
 const queued=new NativeEventAudio();const start=Date.now();const played=await exported.__test.playVoiceAudio(queued,'blob:next',100);
 assert.equal(played.reason,'ended');assert.ok(Date.now()-start>=20,'Old source abort/pause must not terminate new playback');
 const rejected=new NativeEventAudio();rejected.play=()=>Promise.reject(Object.assign(Error('blocked'),{name:'NotAllowedError'}));
 assert.equal((await exported.__test.playVoiceAudio(rejected,'blob:blocked',100)).reason,'NotAllowedError','Report blocked autoplay rather than claiming it played');
 const missingEnd=new FakeAudio();missingEnd.mode='none';await exported.__test.playVoiceAudio(missingEnd,'blob:test',15);
 assert.equal(exported.__test.pickVoiceForText('Ciao! Certo, posso aiutarti con questa risposta.'),'it-IT-ElsaNeural');
 assert.equal(exported.__test.pickVoiceForText('Va bene.'),'it-IT-ElsaNeural');
 assert.equal(exported.__test.pickVoiceForText('Hello, I can help you with your request.'),'en-US-AriaNeural');
 await act(async()=>renderer.unmount());
 console.log(JSON.stringify({passed:true,submissions,sttCalls,ttsCalls,recordingCycles:recordings,microphoneInitializations:initCount,checks:['two consecutive replies return to listening','intermediate text not spoken','TTS failure recovers','barge-in ignores late synthesis','empty errored turn recovers','missing media end event times out','one microphone initialization','delayed final chat event','stale running/partial with durable completion','same-turn approval continuation','approval and final reply in the same render','no-op submission recovery','queued abort/pause media events ignored','autoplay failure reported','Italian voice in alternate mode']},null,2));
})().catch(error=>{console.error(error);process.exitCode=1;process.exit(1)});
