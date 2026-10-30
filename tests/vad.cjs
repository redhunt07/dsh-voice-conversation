const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const source=fs.readFileSync(require('node:path').join(__dirname,'../src/client.js'),'utf8');
const begin=source.indexOf('    function createVad(onSilenceStop) {');
const end=source.indexOf('    /**',begin);
let clock=1;
const ctx={performance:{now:()=>clock},console:{log(){}},MIN_SPEECH_MS:250,SILENCE_MS:1700,MAX_RECORD_MS:120000,VAD_MIN_RMS:.008,currentAdaptiveSpeechRms:()=>.02};
vm.createContext(ctx);vm.runInContext(source.slice(begin,end),ctx);
function run(seq){let fired=0;const vad=ctx.createVad(()=>fired++);vad.reset();for(const [duration,energy] of seq){for(let t=0;t<duration;t+=20){clock+=20;vad.feed(energy)}}return fired}
assert.equal(run([[10000,.002]]),0,'ambient silence must not send');
assert.equal(run([[150,.04],[2500,.002]]),0,'a brief noise must not send');
assert.equal(run([[1000,.04],[1000,.002],[1000,.04],[1000,.002]]),0,'a short natural pause must not split the command');
assert.equal(run([[1000,.04],[1800,.002],[3000,.002]]),1,'a completed utterance must send exactly once');
assert.equal(run([[500,.04],[1800,.002]]),1,'the next listening cycle must also send');
assert.ok(source.includes('inputActions.submit()'),'the loop must submit, not only fill a draft');
console.log('VAD: 5 behavioral checks passed; auto-submit call present.');
