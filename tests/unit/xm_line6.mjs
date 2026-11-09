// 厦门 6 号线：试乘运营段 角江路—华侨大学（陈井跳停不建）/ 复用换乘 code / 模板 / 三语录音及既有线报站回归。
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
const L = X.XM_LINES[6];
const expected = ['角江路','角美中心','文圃路','角海路','角美东','一农','林埭','鼎美','马銮中心','西滨','碑头','杏滨','内茂','董任','官任','杏林湾','华侨大学'];
ok('seventeen stations 角江路 → 华侨大学', L.stations.length === 17 && JSON.stringify(L.stations.map(c=>X.XM_STATIONS[c].zh)) === JSON.stringify(expected), L.stations.map(c=>X.XM_STATIONS[c].zh));
ok('unique station codes', new Set(L.stations).size === 17);
ok('角美 stations included (角美中心 / 角美东)', L.stations.includes('jmzx') && L.stations.includes('jmdo') && X.XM_STATIONS.jmdo.zh === '角美东' && X.XM_STATIONS.jmd.zh === '集美大道');
ok('陈井 not built (trains pass, no stop)', !Object.values(X.XM_STATIONS).some(s=>s.zh.includes('陈井')) && L.stations.indexOf('xbin') === L.stations.indexOf('mlz') + 1);
ok('no unopened stations beyond operating segment', !Object.values(X.XM_STATIONS).some(s=>/龙江明珠|石美|孙厝|嘉庚体育馆|凤林|集美岛/.test(s.zh)));
ok('official English names', X.XM_STATIONS.jjl.en === 'Jiaojiang Road' && X.XM_STATIONS.jmzx.en === 'Jiaomei Center' && X.XM_STATIONS.hqdx.en === 'Huaqiao University' && X.XM_STATIONS.xlw.en === 'Xinglinwan');
ok('马銮 spelled 銮 (not 鑫)', X.XM_STATIONS.mlz.zh === '马\u92ae中心');
ok('terminus directions', L.dirs.hqdx.step === 1 && L.dirs.jjl.step === -1 && X.xmIsTerminal(6,'hqdx',1) && X.xmIsTerminal(6,'jjl',-1));
ok('official purple distinct from all other lines', L.color === X.XM_L6 && L.color === '#93328E' && Object.values(X.XM_LINES).filter(l=>l.id!==6).every(l=>l.color.toUpperCase()!==L.color));
const own = L.stations.filter(c=>!['dme','mlz','grn'].includes(c));
ok('三角梅 white-wall template, no feature station', L.theme === 'xm6' && L.mark === '三角梅' && own.every(c=>!X.XM_STATIONS[c].theme));
ok('new codes unique across networks and lines', own.every(c=>!G[c] && !F[c] && JSON.stringify(X.XM_STATIONS[c].lines)==='[6]'), own.filter(c=>G[c]||F[c]));
ok('dir keys unique', (()=>{const k=Object.values(X.XM_LINES).flatMap(l=>Object.keys(l.dirs));return k.length===new Set(k).size;})());
ok('no x:[6] placeholders left / 马銮中心 no planned Line 4 / 官浔 not Line 6', Object.values(X.XM_STATIONS).every(s=>!s.x.includes(6)) && !X.XM_STATIONS.mlz.x.includes(4) && JSON.stringify(X.XM_STATIONS.gxn.lines)==='[4]' && !X.XM_STATIONS.gxn.x.length);
ok('官浔 next says no transfer to Line 6', xmDepartSegs(4,'gxn','qwu',1,false).some(s=>s.id==='voice.next.gxn.zh' && s.text==='下一站，官浔。'));
for (const [c, other] of [['dme',2],['mlz',2],['grn',1]]) {
 const s=X.XM_STATIONS[c];
 ok(`${c}: reuse shared station / two platforms`, JSON.stringify(s.lines)===JSON.stringify([other,6]));
 ok(`${c}: bidirectional transfers / no placeholder duplicate`, JSON.stringify(X.xmTransfers(c,other))==='[6]' && JSON.stringify(X.xmTransfers(c,6))===JSON.stringify([other]) && !s.x.length);
 for (const [line,to] of [[other,6],[6,other]]) for (const step of [1,-1]) {
  const segs=xmDepartSegs(line,c,X.xmDirFor(line,step),step,false);
  ok(`${c}: line ${line} step ${step} next ID suffix and 可换乘${to}号线`, segs.some(s=>s.id===`voice.next.${c}${line}.zh` && s.text.includes(`可换乘${to}号线`)) && segs.some(s=>s.id===`voice.next.${c}${line}.en` && s.text.includes(`Line ${to}`)));
 }
}
ok('announcement order Mandarin → Minnan → English', xmDepartSegs(6,'wpl','hqdx',1,false).map(s=>s.lang).join()==='zh,nan,en');
for (const [code,dir] of [['hqdx','hqdx'],['jjl','jjl']]) ok(`terminal ${code} uses terminal.*, not next.*`, xmDepartSegs(6,code,dir,X.xmDirStep(6,dir),false).every(s=>s.id.startsWith('voice.terminal.xm'+code+'.')));
const metro=fs.readFileSync(path.join(root,'js/world/xmMetro.js'),'utf8'), train=fs.readFileSync(path.join(root,'js/world/train.js'),'utf8'), netmap=fs.readFileSync(path.join(root,'js/ui/netmap.js'),'utf8'), rmap=fs.readFileSync(path.join(root,'js/world/routemap.js'),'utf8');
ok('xm6 purple bougainvillea geometry theme', /xm6:.*dado: '#93328E'.*badge: 'bougainvillea'/.test(metro) && metro.includes('function bougainvilleaPaint()') && metro.includes("kind === 'bougainvillea' ? bougainvilleaPaint()"));
ok('train body and stripe', train.includes("xm6: '#F7F0F7'") && train.includes("xm6: '#93328E'"));
ok('routemap no Line 6 placeholder', !/6: \{ zh: '6号线'/.test(rmap));
ok('netmap Line 6 + existing nudges retained', netmap.includes('6号线 紫色') && netmap.includes("if (a.code === 'sdy' && !portrait) iy -= 42;") && netmap.includes('l3alt = !l3alt') && netmap.includes("if (c === 'xmnb') {") && netmap.includes("if (c === 'qwu' && portrait)"));
for (const portrait of [false,true]) {
 const svg=xmNetworkSVG('hqdx',{portrait});
 ok(`netmap ${portrait?'portrait':'landscape'}: all lines / finite coordinates / Line 6 labels`, !/NaN|undefined|Infinity/.test(svg) && Object.values(X.XM_LINES).every(l=>svg.includes(`stroke="${l.color}"`)) && expected.every(z=>svg.includes(`>${z.length>4?z.slice(0,4):z}</text>`)));
}
const man=JSON.parse(fs.readFileSync(path.join(root,'assets/audio/manifest.json'),'utf8')), have=new Map(man.assets.map(a=>[a.id,a])), jobs=new Map(allJobs().map(j=>[j.id,j])), need=new Set();
const add=ss=>ss.forEach(s=>need.add(s.id));
for (const dir of Object.keys(L.dirs)) {add(xmPlatformSegs(6,dir,1));add(xmPlatformSegs(6,dir,2));}
for(const c of L.stations) {add(arriveSegs(c));add(welcomeSegs(c));for(const step of [1,-1]) {const next=X.xmNext(6,c,step);if(next)add(xmDepartSegs(6,next,X.xmDirFor(6,step),step,true));}}
for(const [c,line] of [['dme',2],['mlz',2],['grn',1]]) for(const step of [1,-1]) add(xmDepartSegs(line,c,X.xmDirFor(line,step),step,false));
add(xmDepartSegs(4,'gxn','qwu',1,false));
const missing=[...need].filter(id=>!have.has(id) || !fs.existsSync(path.join(root,'assets/audio',have.get(id).file)));
ok(`all ${need.size} required clips exist`,!missing.length,missing);
ok('all clips registered with exact text / correct languages', [...need].every(id=>jobs.has(id) && have.get(id)?.text===jobs.get(id).text && /\.(zh|nan|en)$/.test(id)), [...need].filter(id=>!(jobs.has(id) && have.get(id)?.text===jobs.get(id).text)));
for(const suffix of ['grn1','dme2']) for(const lang of ['zh','nan','en']) {const a=have.get(`voice.next.${suffix}.${lang}`);ok(`${suffix}.${lang} renamed old-line clip exists`,!!a&&fs.existsSync(path.join(root,'assets/audio',a.file)));}
ok('old unsuffixed next clips gone', ['grn','dme','mlz'].every(c=>['zh','nan','en'].every(l=>!have.has(`voice.next.${c}.${l}`) && !fs.existsSync(path.join(root,`assets/audio/voice/next-${c}-${l}.mp3`)))));
console.log(fails.length?'XM_LINE6_DATA FAIL '+fails.length:'XM_LINE6_DATA PASS');
process.exit(fails.length?1:0);
