const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
let exported; const effects=[]; let mutationCallback; let clicks=0; const row={closest:()=>null,getClientRects:()=>[{}],querySelector:(selector)=>{assert.ok(selector.includes("data-disclosure-row"));return {click(){clicks++}}}};
const React={useState:(v)=>[typeof v==='function'?v():v,()=>{}],useRef:(v)=>({current:v}),useEffect:(f)=>effects.push(f),useLayoutEffect:()=>{},useMemo:(f)=>f(),useCallback:(f)=>f,createElement:(type,props,...children)=>({type,props:props||{},children})};
const context={console,performance:{now:()=>1},setTimeout,clearTimeout,requestAnimationFrame:(f)=>f(),document:{body:{},querySelectorAll:()=>[row]},MutationObserver:class{constructor(f){mutationCallback=f}observe(){}disconnect(){}},window:{__ModuleLoader__:{load:({factory})=>{exported=factory(name=>{if(name==='react')return React;throw Error('Unexpected module '+name)})}}}};
vm.createContext(context);
let code=fs.readFileSync(require('node:path').join(__dirname,'../src/client.js'),'utf8');
code=code.replace('exports.apply = apply','exports.__test = {VoiceModeView}; exports.apply = apply');
vm.runInContext(code,context);
const dock=exported.__test.VoiceModeView({session:{pending:[]},sessionId:'layout-test',onExit(){}});
assert.equal(dock.props.role,'region');assert.equal(dock.props['aria-label'],'Conversazione vocale continua');assert.equal(dock.props.style.position,'relative');
const text=JSON.stringify(dock);assert.ok(text.includes('Pausa 1,7 s'));assert.ok(text.includes('Impostazioni voce'));assert.ok(text.includes('Chiudi conversazione vocale'));assert.ok(!text.includes('"position":"fixed"'));
console.log('Actual voice component render: inline dock, status, settings and stop controls; no fullscreen overlay.');

const expandEffect=effects.find(f=>f.toString().includes("new MutationObserver"));assert.ok(expandEffect);const cleanup=expandEffect();assert.equal(clicks,1);mutationCallback();assert.equal(clicks,1,"A manual collapse must not be immediately undone");cleanup();console.log("Native role-button Think expansion opens once and preserves manual collapse.");
