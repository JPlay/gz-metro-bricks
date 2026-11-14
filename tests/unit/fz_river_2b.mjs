// 福州内河 2B（东西河东段 + 市民服务中心码头 + 水部 C 步道 + 两座桥下步道）：小美 2B 定稿五条的数据检查 + 过桥篷顶净空读数
import * as R from '../../js/data/fz-river.js';
import { FZ_EXITS, FZ_EXIT_TABLE } from '../../js/data/fz-exits.js';
import { fzBoatJobs, fzBoatArriveSegs } from '../../js/data/phrases.js';
const fails = [];
function ok(n, v, info) { console.log(`${v ? 'PASS' : 'FAIL'} ${n}${!v && info !== undefined ? ' ' + JSON.stringify(info) : ''}`); if (!v) fails.push(n); }
R.useNet('a');
const F = R.FZR, NEW = ['五一中路', '海底支路', '广达路', '八一七中路', '乌山支路'];
const nb = R.BRIDGES.filter(b => NEW.includes(b.name));
ok('five 2B bridges on 东西河, plate = road name only (1A style)', nb.length === 5 && nb.every(b => b.river === 'dx' && b.plate === b.name && b.kind === 'road'), nb.map(b => [b.name, b.plate, b.kind]));
ok('under-bridge walkways only at 五一中路 / 八一七中路, north bank', (F.unders || []).map(u => u.name).sort().join() === ['五一中路', '八一七中路'].sort().join() && F.unders.every(u => u.n[1] > 0), F.unders);
ok('under walkway headroom ≥ 2.0 m (bridge soffit −0.4)', F.unders.every(u => R.FLAT_SOFFIT - u.y >= 2.0), F.unders.map(u => R.FLAT_SOFFIT - u.y));
ok('under walkway leaves the boat lane (hw − w ≥ beam/2 + 2)', F.unders.every(u => F.rivers.dx.hw - u.w >= R.BOAT.beam / 2 + 2));
const smc = R.PIERS.find(p => p.id === 'smc');
ok('市民服务中心码头 / Civic Center Pier on the north bank of 东西河', smc && smc.zh === '市民服务中心码头' && smc.en === 'Civic Center Pier' && smc.river === 'dx' && smc.n[1] > 0, smc);
ok('route A stops xihu → xsg → lmh → smc (terminus)', R.STOPS.map(s => s.id).join() === 'xihu,xsg,lmh,smc');
{ const f = R.runTime(0, 3), b = R.runTime(3, 0);
  console.log(`INFO route A len ${R.ROUTE.line.len.toFixed(0)} m; one-way 西湖→市民服务中心 ${f.secs} s (${(f.secs / 60).toFixed(1)} min), back ${b.secs} s; legs ${f.legs.map(l => `${l.from}→${l.to} ${l.secs}s`).join(', ')}`);
  ok(`route A one-way ≤ 8 min both ways (${f.secs} / ${b.secs} s)`, f.secs <= 480 && b.secs <= 480, [f.secs, b.secs]); }
const cr = R.clearanceReport(0.25), per = Object.values(cr.per);
ok(`canopy clears every bridge ≥ ${R.CLEAR_MIN} m (min ${cr.min.toFixed(3)})`, cr.ok);
for (const nm of NEW) { const x = per.find(p => p.name === nm); ok(`clearance at ${nm}: ${x ? x.gap.toFixed(2) + ' m' : 'not passed'}`, x && x.gap >= R.CLEAR_MIN, x); }
const K = R.KIOSKS.fzsb;
ok('水部 C kiosk in net a, pier smc', K && R.netOfKiosk('fzsb') === 'a' && K.pier === 'smc' && K.n === 'C', K);
ok('fz-exits: 水部 C attr fzriver, to 东西河 / 市民服务中心码头, unverified', FZ_EXITS.fzsb && FZ_EXITS.fzsb.n === 'C' && FZ_EXITS.fzsb.attr === 'fzriver' && FZ_EXITS.fzsb.to.includes('市民服务中心码头') && FZ_EXITS.fzsb.verified === false && FZ_EXIT_TABLE.fzsb);
ok(`walk kiosk → pier stairs ${F.sbwWalk} m ≤ 120`, F.sbwWalk > 90 && F.sbwWalk <= 120);
const sbw = F.roads.find(r => r.id === 'sbw');
ok('walkway: stone rails both sides, no ground guidance', sbw && sbw.walk && sbw.rails.length === 2 && !('arrow' in sbw) && !('guide' in sbw));
const tr = F.trees.filter(t => t[5] === 'sbw');
ok(`banyans along the walkway (${tr.length})`, tr.length >= 10);
const inPoly = (x, z, p) => { let c = false; for (let i = 0, j = p.length / 2 - 1; i < p.length / 2; j = i++) { const xi = p[2 * i], zi = p[2 * i + 1], xj = p[2 * j], zj = p[2 * j + 1]; if ((zi > z) !== (zj > z) && x < (xj - xi) * (z - zi) / (zj - zi) + xi) c = !c; } return c; };
const hb = F.houses.filter(h => Math.abs(h.x - K.x) < 12 + h.w && h.z > K.z - 2 && h.z < K.z + 14 || inPoly(h.x, h.z, sbw.poly));
ok('no house on the walkway or in front of the 水部 kiosk', !hb.length, hb);
// 1A 已验收的街景不动：主干上的房子 / 树一个都不少、一个没挪
{ const { execSync } = await import('node:child_process'); const src = execSync('git show 9163f8b:js/data/fz-river-data.js', { maxBuffer: 1 << 26 }).toString();   // 2A 上线版（main 9163f8b）
  const A = JSON.parse(src.replace(/^[^]*?export const FZR = /, '').replace(/;\s*$/, ''));
  const hs = new Set(F.houses.map(h => JSON.stringify(h))), ts = new Set(F.trees.map(t => JSON.stringify(t)));
  ok(`1A houses unchanged (${A.houses.length})`, A.houses.every(h => hs.has(JSON.stringify(h))));
  ok(`1A trees unchanged (${A.trees.length})`, A.trees.every(t => ts.has(JSON.stringify(t))));
  ok('1A piers unchanged', ['xihu', 'xsg', 'lmh'].every(id => JSON.stringify(A.piers.find(p => p.id === id)) === JSON.stringify(R.PIERS.find(p => p.id === id)))); }
const ids = fzBoatJobs().map(j => j.id);
ok('announcements: 开往市民服务中心码头 / next smc / 终点 arrive', ['depart.smc', 'next.smc', 'arrive.smc.end', 'arrive.lmh'].every(k => ids.includes(`voice.fz.boat.${k}.zh`) && ids.includes(`voice.fz.boat.${k}.en`)));
const end = fzBoatArriveSegs('smc', true);
ok('terminus arrive: 市民服务中心码头到了，这里是本线终点', end[0].text.startsWith('市民服务中心码头到了') && end[0].text.includes('终点') && end[1].text.includes('Civic Center Pier'), end);
console.log(fails.length ? `\n${fails.length} FAILED: ${fails.join(', ')}` : '\nALL PASS');
process.exit(fails.length ? 1 : 0);
