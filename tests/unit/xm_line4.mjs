// 厦门 4 号线：运营段 / 复用换乘 code / 模板 / 三语录音及既有线报站回归。
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as X from '../../js/data/xm-lines.js';
import { xmNetworkSVG } from '../../js/ui/netmap.js';
import { STATIONS as G } from '../../js/data/lines.js';
import { FZ_STATIONS as F } from '../../js/data/fz-lines.js';
import { allJobs, xmDepartSegs, arriveSegs, welcomeSegs, xmPlatformSegs } from '../../js/data/phrases.js';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const fails = [];
function ok(n, v, info) { console.log(`${v?'PASS':'FAIL'} ${n}${!v&&info?' '+JSON.stringify(info):''}`); if (!v) fails.push(n); }
const L = X.XM_LINES[4], expected = ['集美软件园北','后溪','厦门北站','官浔','丙洲','城场','洪坑','前浯'];
ok('eight stations west→east', L.stations.length === 8 && JSON.stringify(L.stations.map(c=>X.XM_STATIONS[c].zh)) === JSON.stringify(expected));
ok('unique station codes', new Set(L.stations).size === 8);
ok('qianwu correct character and English', X.XM_STATIONS.qwu.zh === '前\u6d6f' && X.XM_STATIONS.qwu.en === 'Qianwu');
ok('temporary terminus directions', L.dirs.qwu.step === 1 && L.dirs.jsrb.step === -1 && X.xmIsTerminal(4,'qwu',1) && X.xmIsTerminal(4,'jsrb',-1));
ok('no unopened stops / Line 6 not via 官浔', JSON.stringify(X.XM_STATIONS.gxn.lines) === '[4]' && !X.XM_STATIONS.gxn.x.includes(6) && !Object.values(X.XM_STATIONS).some(s=>/西岩|前浔|洞庭|机场西|翔安机场/.test(s.zh)));
ok('official red distinct from Line 1 orange-red', L.color === X.XM_L4 && L.color === '#FF0000' && X.XM_L1 === '#F2711C');
ok('white dolphin standard template, no feature station', L.theme === 'xm4' && L.mark === '白海豚' && L.stations.filter(c=>!['xmnb','hkg'].includes(c)).every(c=>!X.XM_STATIONS[c].theme));
const own = L.stations.filter(c=>!['xmnb','hkg'].includes(c));
ok('new codes unique across networks and lines', own.every(c=>!G[c] && !F[c] && JSON.stringify(X.XM_STATIONS[c].lines)==='[4]'));
ok('后村/何厝 unchanged', X.XM_STATIONS.hcun.zh === '后村' && X.XM_STATIONS.hcu.zh === '何厝');
ok('dir keys unique', (()=>{const k=Object.values(X.XM_LINES).flatMap(l=>Object.keys(l.dirs));return k.length===new Set(k).size;})());
for (const [c, other] of [['xmnb',1],['hkg',3]]) {
 const s=X.XM_STATIONS[c];
 ok(`${c}: reuse shared station / two platforms`, JSON.stringify(s.lines)===JSON.stringify([other,4]));
 ok(`${c}: bidirectional transfers / no placeholder duplicate`, JSON.stringify(X.xmTransfers(c,other))==='[4]' && JSON.stringify(X.xmTransfers(c,4))===JSON.stringify([other]) && !s.x.includes(4));
 for (const [line,to] of [[other,4],[4,other]]) {
  const segs=xmDepartSegs(line,c,X.xmDirFor(line,1),1,false);
  ok(`${c}: next ID suffix ${line} and correct transfer`,segs.some(s=>s.id===`voice.next.${c}${line}.zh` && s.text.includes(`可换乘${to}号线`)));
 }
}
for (const [code,dir] of [['qwu','qwu'],['jsrb','jsrb']]) ok(`terminal ${code} uses terminal.*, not next.*`, xmDepartSegs(4,code,dir,X.xmDirStep(4,dir),false).every(s=>s.id.startsWith('voice.terminal.xm'+code+'.')));
const metro=fs.readFileSync(path.join(root,'js/world/xmMetro.js'),'utf8'), train=fs.readFileSync(path.join(root,'js/world/train.js'),'utf8'), netmap=fs.readFileSync(path.join(root,'js/ui/netmap.js'),'utf8');
ok('xm4 red dolphin geometry theme', /xm4:.*dado: '#FF0000'.*badge: 'dolphin'/.test(metro) && metro.includes('function dolphinPaint()'));
ok('train body and stripe', train.includes("xm4: '#FFF1F1'") && train.includes("xm4: '#FF0000'"));
ok('netmap Line 4 + Line 3 nudge retained', netmap.includes('4号线 红色') && netmap.includes("if (a.code === 'sdy' && !portrait) iy -= 42;") && netmap.includes('l3alt = !l3alt'));
for (const portrait of [false,true]) {
 const svg=xmNetworkSVG('qwu',{portrait});
 ok(`netmap ${portrait?'portrait':'landscape'}: all lines / finite coordinates / full north terminus`, !/NaN|undefined/.test(svg) && Object.values(X.XM_LINES).every(l=>svg.includes(`stroke="${l.color}"`)) && svg.includes('集美软件园北') && svg.includes('>前浯</text>'));
}
const man=JSON.parse(fs.readFileSync(path.join(root,'assets/audio/manifest.json'),'utf8')), have=new Map(man.assets.map(a=>[a.id,a])), jobs=new Map(allJobs().map(j=>[j.id,j])), need=new Set();
const add=ss=>ss.forEach(s=>need.add(s.id));
for (const dir of Object.keys(L.dirs)) {add(xmPlatformSegs(4,dir,1));add(xmPlatformSegs(4,dir,2));}
for(const c of L.stations) {add(arriveSegs(c));add(welcomeSegs(c));for(const step of [1,-1]) {const next=X.xmNext(4,c,step);if(next)add(xmDepartSegs(4,next,X.xmDirFor(4,step),step,true));}}
for(const [c,line] of [['xmnb',1],['hkg',3]]) for(const step of [1,-1]) add(xmDepartSegs(line,c,X.xmDirFor(line,step),step,false));
const missing=[...need].filter(id=>!have.has(id) || !fs.existsSync(path.join(root,'assets/audio',have.get(id).file)));
ok(`all ${need.size} required clips exist`,!missing.length,missing);
ok('all clips registered with exact text / correct languages', [...need].every(id=>jobs.has(id) && have.get(id)?.text===jobs.get(id).text && /\.(zh|nan|en)$/.test(id)));
for(const suffix of ['xmnb1','hkg3']) for(const lang of ['zh','nan','en']) {const a=have.get(`voice.next.${suffix}.${lang}`);ok(`${suffix}.${lang} renamed old-line clip exists`,!!a&&fs.existsSync(path.join(root,'assets/audio',a.file)));}
console.log(fails.length?'XM_LINE4_DATA FAIL '+fails.length:'XM_LINE4_DATA PASS');
process.exit(fails.length?1:0);
