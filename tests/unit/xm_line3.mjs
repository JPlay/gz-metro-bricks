// 厦门地铁 3 号线数据检查（不开浏览器）：node tests/unit/xm_line3.mjs
// 1. 运营段 21 站、站序（厦门火车站 → 蔡厝）；2. 站 code 全网唯一（不和广州 / 福州 / 厦门 1、2 号线撞）；
// 3. 四个换乘站复用 1、2 号线原 code，注册后 lines 含 3，xmTransfers 两个方向都能报出对方线；x 里不再重复写 3；
// 4. 不做的：6 号线、南延段、翔安机场段不在 XM_LINES 里；洪坑现已换乘 4 号线；
// 5. 3 号线所有报站片段（普通话 / 闽南语 / 英语）都有 MP3 且登记在 assets/audio/manifest.json。
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const X = await import(path.join(root, 'js/data/xm-lines.js'));
const G = await import(path.join(root, 'js/data/lines.js'));
const F = await import(path.join(root, 'js/data/fz-lines.js'));
const { allJobs, xmDepartSegs, arriveSegs, welcomeSegs, xmPlatformSegs } = await import(path.join(root, 'js/data/phrases.js'));
const fails = [];
const ok = (name, v, info) => { console.log((v ? 'PASS ' : 'FAIL ') + name + (info !== undefined && !v ? ' ' + JSON.stringify(info) : '')); if (!v) fails.push(name); };

const EXPECT = ['厦门火车站', '湖滨东路', '体育中心', '人才中心', '湖里公园', '华荣路', '火炬园', '小东山', '安兜', '坂尚', '湖里创新园', '五缘湾', '国际博览中心', '东界', '洪坑', '林前', '鼓锣', '翔安市民公园', '浦边', '后村', '蔡厝'];
const L3 = X.XM_LINES[3];
ok('line3 exists', !!L3);
ok('21 stations', L3.stations.length === 21, L3.stations.length);
ok('station order 厦门火车站→蔡厝', JSON.stringify(L3.stations.map(c => X.XM_STATIONS[c].zh)) === JSON.stringify(EXPECT), L3.stations.map(c => X.XM_STATIONS[c].zh));
ok('dirs: +1 往蔡厝, -1 往厦门火车站', L3.dirs.ccuo.step === 1 && L3.dirs.ccuo.zh === '蔡厝' && L3.dirs.xmhc.step === -1 && L3.dirs.xmhc.zh === '厦门火车站');
ok('colour 云天青 + mark 白鹭', /^#[0-9A-F]{6}$/i.test(L3.color) && L3.mark === '白鹭' && X.XM_L3 === L3.color);
ok('line3 codes unique within line', new Set(L3.stations).size === 21);
const shared = { hbd: 1, hjy: 1, tyz: 2, wyw: 2 };
const own = L3.stations.filter(c => !shared[c]);
const gz = new Set(Object.keys(G.STATIONS)), fz = new Set(Object.keys(F.FZ_STATIONS));
ok('new codes do not collide with Guangzhou / Fuzhou', own.every(c => !gz.has(c) && !fz.has(c)), own.filter(c => gz.has(c) || fz.has(c)));
ok('new codes only on line 3 (no silent reuse of a Line 1/2 code)', own.every(c => JSON.stringify(X.XM_STATIONS[c].lines) === (c === 'hkg' ? '[3,4]' : '[3]')), own.filter(c => JSON.stringify(X.XM_STATIONS[c].lines) !== (c === 'hkg' ? '[3,4]' : '[3]')));
ok('后村 is not hcu (何厝)', X.XM_STATIONS.hcu.zh === '何厝' && L3.stations.includes('hcun') && X.XM_STATIONS.hcun.zh === '后村');
ok('dir keys unique across XM lines', (() => { const k = Object.values(X.XM_LINES).flatMap(L => Object.keys(L.dirs)); return new Set(k).size === k.length; })());
for (const [c, other] of Object.entries(shared)) {
  const s = X.XM_STATIONS[c];
  ok(`${c} ${s.zh}: lines [${other},3]`, JSON.stringify(s.lines) === JSON.stringify([other, 3]), s.lines);
  ok(`${c}: xmTransfers from line ${other} includes 3`, X.xmTransfers(c, other).includes(3), X.xmTransfers(c, other));
  ok(`${c}: xmTransfers from line 3 includes ${other}`, X.xmTransfers(c, 3).includes(other), X.xmTransfers(c, 3));
  ok(`${c}: no duplicate transfer`, new Set(X.xmTransfers(c, 3)).size === X.xmTransfers(c, 3).length && !s.x.includes(3));
}
ok('xmhc theme timetravel (only feature station)', X.XM_STATIONS.xmhc.theme === 'timetravel' && own.filter(c => X.XM_STATIONS[c].theme).join() === 'xmhc');
ok('洪坑 reuses code for Line 4', JSON.stringify(X.XM_STATIONS.hkg.lines) === '[3,4]' && !X.XM_STATIONS.hkg.x.includes(4));
ok('no Line 6 built', !X.XM_LINES[6]);
ok('no south extension / airport stations', !Object.values(X.XM_STATIONS).some(s => /沙坡尾|厦门大学|白城|曾厝垵|上李|翔安机场|蔡厝南|阳塘|双沪|空港|机场西/.test(s.zh)));
// 报站：普通话 → 闽南语 → 英语；文字
const dep = xmDepartSegs(3, 'hbd', 'ccuo', 1, true);
ok('depart xmhc→hbd: zh/nan/en order', dep.map(s => s.lang).join() === 'zh,nan,en,zh,nan,en', dep.map(s => s.id));
ok('next 湖滨东路 on line 3 says 可换乘1号线', dep.some(s => s.id === 'voice.next.hbd3.zh' && s.text === '下一站，湖滨东路，可换乘1号线。'));
ok('next 湖滨东路 on line 1 says 可换乘3号线', xmDepartSegs(1, 'hbd', 'zhl', 1, false).some(s => s.id === 'voice.next.hbd1.zh' && s.text.includes('可换乘3号线')));
ok('terminal 蔡厝', xmDepartSegs(3, 'ccuo', 'ccuo', 1, false).some(s => s.id === 'voice.terminal.xmccuo.zh'));
ok('next 洪坑 says 可换乘4号线', xmDepartSegs(3, 'hkg', 'ccuo', 1, false).some(s => s.id === 'voice.next.hkg3.zh' && s.text.includes('可换乘4号线')));
// 音频齐全
const man = JSON.parse(fs.readFileSync(path.join(root, 'assets/audio/manifest.json'), 'utf8'));
const have = new Map(man.assets.filter(a => a.group === 'voice').map(a => [a.id, a]));
const jobs = allJobs(), byId = new Map(jobs.map(j => [j.id, j]));
const need = new Set();
const add = segs => segs.forEach(s => need.add(s.id));
for (const dir of Object.keys(L3.dirs)) { add(xmPlatformSegs(3, dir, 1)); add(xmPlatformSegs(3, dir, 2)); }
L3.stations.forEach((c, i) => { add(arriveSegs(c)); add(welcomeSegs(c)); for (const step of [1, -1]) { const nx = X.xmNext(3, c, step); if (nx) add(xmDepartSegs(3, nx, X.xmDirFor(3, step), step, true)); } });
for (const [c, other] of Object.entries(shared)) for (const step of [1, -1]) { const prev = X.xmNext(other, c, -step); if (prev) add(xmDepartSegs(other, c, X.xmDirFor(other, step), step, false)); }
const miss = [...need].filter(id => !have.has(id) || !fs.existsSync(path.join(root, 'assets/audio', have.get(id).file)));
ok(`all ${need.size} Line 3 announcement clips exist (zh / nan / en)`, miss.length === 0, miss);
ok('every needed clip is a known job', [...need].every(id => byId.has(id)));
ok('langs for line 3 clips are zh / nan / en only', [...need].every(id => /\.(zh|nan|en)$/.test(id)));
console.log(fails.length ? `XM_LINE3_DATA FAIL ${fails.length}` : 'XM_LINE3_DATA PASS');
process.exit(fails.length ? 1 : 0);
