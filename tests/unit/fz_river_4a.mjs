// 福州内河 4A（光明港西段 → 新港闸，PLAN-4 v2 小美 11-19 13:50 定稿；只走路）：数据 / 逻辑检查
import * as R from '../../js/data/fz-river.js';
import fs from 'node:fs';
import { execSync } from 'node:child_process';
const fails = [];
function ok(n, v, info) { console.log(`${v ? 'PASS' : 'FAIL'} ${n}${!v && info !== undefined ? ' ' + JSON.stringify(info) : ''}`); if (!v) fails.push(n); }
R.useNet('e');
const F = R.FZR, A4 = F.a4, J = JSON.stringify, RV = R.RIVERS;
const fsrc = fs.readFileSync(new URL('../../js/world/fzRiver.js', import.meta.url), 'utf8'), nsrc = fs.readFileSync(new URL('../../js/world/fzNight.js', import.meta.url), 'utf8');
ok('4A data present (a4: gwLen / gate / xg / sign)', A4 && A4.gwLen > 40 && A4.gwLen < 80 && A4.gate && A4.xg && A4.sign);
ok('rivers include gw after ja,gm,jn,fb', Object.keys(RV).join() === 'ja,gm,jn,fb,gw' && RV.gw.zh === '光明港' && F.rivers.gw.hw === F.rivers.gm.hw);
console.log(`INFO gw ${RV.gw.line.len.toFixed(1)} m, gate (${A4.gate.x}, ${A4.gate.z}), yz moved ${A4.yz.moved}`);
// 接缝：gw 起点 = 已建 gm 西头，切向连续（gw 往西，和 gm 起点切向相反）
{ const gw = F.rivers.gw.p, gm = F.rivers.gm.p, s0 = RV.gw.line.at(0), g0 = RV.gm.line.at(0);
  ok('gw starts exactly at the existing 光明港 west end', gw[0] === gm[0] && gw[1] === gm[1] && s0.x === g0.x && s0.z === g0.z);
  const da = Math.abs(Math.abs(Math.atan2(s0.tx, s0.tz) - Math.atan2(g0.tx, g0.tz)) - Math.PI);
  ok(`gw ← gm tangent is opposite / continuous (${(da * 180 / Math.PI).toFixed(1)}° from 180)`, da < 12 * Math.PI / 180, da);
}
// 弯半径
{ const L = RV.gw.line, c = F.rivers.gw.p, pts = []; for (let i = 0; i < c.length; i += 2) pts.push([c[i], c[i + 1]]);
  let r1 = 1e9; for (let i = 1; i < pts.length - 1; i++) { const [a, b, d] = [pts[i - 1], pts[i], pts[i + 1]], A = Math.hypot(b[0] - a[0], b[1] - a[1]), Bq = Math.hypot(d[0] - b[0], d[1] - a[1] ? d[1] - b[1] : d[1] - b[1]), C = Math.hypot(d[0] - a[0], d[1] - a[1]), s = (A + Bq + C) / 2, ar = Math.sqrt(Math.max(0, s * (s - A) * (s - Bq) * (s - C))); if (ar > 1e-6) r1 = Math.min(r1, A * Bq * C / (4 * ar)); }
  let r2 = 1e9, at = 0; for (let s = 0; s <= L.len - 6; s += 1) { const a = L.at(s), b = L.at(Math.min(L.len, s + 6)); let d = Math.atan2(b.tx, b.tz) - Math.atan2(a.tx, a.tz); d -= 2 * Math.PI * Math.round(d / (2 * Math.PI)); const r = 6 / Math.max(1e-9, Math.abs(d)); if (r < r2) { r2 = r; at = s; } }
  ok(`gw min bend radius ≥ 25 m (vertices ${r1 === 1e9 ? 'n/a' : r1.toFixed(1)}, 6 m window ${r2.toFixed(1)})`, (r1 === 1e9 || r1 >= 25) && r2 >= 25, { r1, r2, at }); }
// 闸：3 孔，南 2 北 1，只看不过船，颜色同九门闸
{ const G = A4.gate;
  ok('新港闸: 3 bays, bayW 南 2 窄 + 北 1 宽, same c2Sluice + 浅灰石材 as 九门闸', G.bays === 3 && G.bayW.join() === '10,10,20' && G.hw === F.rivers.gm.hw && /this\.c2Sluice\(G, '新港闸'\)/.test(fsrc) && /const PIER = '#A39C8E'/.test(fsrc) && /S\.bayW/.test(fsrc));
  ok('gate: n points north (south_first), people cannot walk onto it (colGateBlock)', G.n[1] > 0 && G.block.length === 4 && /colGateBlock/.test(fsrc));
  ok('sign: 新港闸 / Xingang Sluice, wood board (stopOnly, no line / next stop)', A4.sign.zh === '新港闸' && A4.sign.en === 'Xingang Sluice' && A4.sign.stopOnly === true && /A4\.sign/.test(fsrc));
  ok('sign plinth is dark-grey stone (not a black cube)', /hex\('#6A7076'\)/.test(fsrc) && /hex\('#8A9096'\)/.test(fsrc) && !/hex\('#4D4F52'\)/.test(fsrc));
  { const sg = A4.sign, G = A4.gate, bx = sg.x - G.n[0] * 3.2 + G.t[0] * 2.0, bz = sg.z - G.n[1] * 3.2 + G.t[1] * 2.0;
    ok('bench is ≥ 3.5 m from the 新港闸 sign and on land', Math.hypot(sg.x - bx, sg.z - bz) >= 3.5 && R.isLand(bx, bz) && !R.isWater(bx, bz) && /sg\.x - n\[0\] \* 3\.2/.test(fsrc), { dist: Math.hypot(sg.x - bx, sg.z - bz), bx, bz }); }
  const mid = G.block.reduce((a, q) => [a[0] + q[0] / 4, a[1] + q[1] / 4], [0, 0]);
  ok('gate sits at the west end of gw, front view is east of the gate looking west', Math.hypot(mid[0] - G.x, mid[1] - G.z) < 5 && (G.view[0] - G.x) * G.t[0] + (G.view[1] - G.z) * G.t[1] < 0); }
// 六一中路桥
{ const b = R.BRIDGES.find(q => q.name === '六一中路' && q.river === 'gw');
  ok('六一中路: only OSM-named road bridge on gw, dark-grey a3Deck, east of the gate', b && b.kind === 'road' && !b.plate && b.s < A4.gate.s - b.w / 2 && A4.bridges.includes(b.id) && /FZR\.a4 && \(FZR\.a4\.bridges/.test(fsrc));
  ok('六一中路 spans water, both ends on land', b && R.isWater(b.x, b.z) && [-1, 1].every(sg => R.isLand(b.x + b.n[0] * sg * (b.hw + 2.5), b.z + b.n[1] * sg * (b.hw + 2.5)))); }
// 闸西新港河远景：封闭水面、有堤岸，不进可走范围
{ const X = A4.xg, c = X.water;
  ok('新港河 far water: higher than 光明港 (≈1 m), same colour family, has shore walls', X.lv > F.WY && X.shore.length >= 8 && c && c.p.length >= 6);
  const cx = X.o[0] + X.t[0] * 22, cz = X.o[1] + X.t[1] * 22;
  ok('far water is not walkable (isWater false in the basin; skirt dug out)', !R.isWater(cx, cz) && A4.far.length >= 12);
  ok('a4Day draws a packed ring of houses + tree crowns around the basin (no sky gap)', /a4Day\(\)/.test(fsrc) && /A4\.far/.test(fsrc) && /P\.box\(cx, h \/ 2, cz/.test(fsrc)); }
// 瀛洲河口：可走水面往南伸，圆头合拢
{ const Y = A4.yz, p0 = Y.c, mid = [Y.c[0] + Y.d[0] * (Y.len * 0.55), Y.c[1] + Y.d[1] * (Y.len * 0.55)], p1 = [Y.c[0] + Y.d[0] * (Y.len - Y.hw * 0.4), Y.c[1] + Y.d[1] * (Y.len - Y.hw * 0.4)], tip = [Y.c[0] + Y.d[0] * (Y.len + 2), Y.c[1] + Y.d[1] * (Y.len + 2)];
  ok('瀛洲河 mouth: a stem of water leaving the south bank, closed at the rounded tip', Y.hw >= 6 && Y.len >= 16 && R.isWater(p0[0] + Y.d[0] * 2, p0[1] + Y.d[1] * 2) && R.isWater(mid[0], mid[1]) && R.isWater(p1[0], p1[1]) && R.isLand(...tip));
  const left = [mid[0] - Y.d[1] * (Y.hw + 3.5), mid[1] + Y.d[0] * (Y.hw + 3.5)], right = [mid[0] + Y.d[1] * (Y.hw + 3.5), mid[1] - Y.d[0] * (Y.hw + 3.5)];
  ok('mouth banks exist on both sides (revetments turn in, not just a gap in the bank)', R.isLand(...left) && R.isLand(...right), { left, right, mid });
  ok('瀛洲河 / Yingzhou River stone sign on land', A4.signs.some(s => s.lines.join('/') === '瀛洲河/Yingzhou River' && R.isLand(s.x, s.z))); }
// 夜里 draw ≤ 昼：g4day 只白天
{ const ld = fsrc.slice(fsrc.indexOf('  lodNow(force) {'), fsrc.indexOf('  refreshTilesIfTurned() {'));
  ok('g4day (gw glints + far houses): day-only group, off whenever nightLod', /if \(FZR\.a4\) \{ this\.a4Day\(\); k\.group\('g4day'\); \}/.test(fsrc) && /gn\.g4day\) \{ const on = !this\.nightLod/.test(ld));
  ok('g4day skips tileCull (stable day count)', /g4day\.getChildMeshes\(\)/.test(fsrc) && /noTileCull: true/.test(fsrc));
  ok('gw glints not in the always-on water loop', /FZR\.a4 && id === 'gw'/.test(fsrc));
  ok('no PointLight / ShadowGenerator in a4Static / a4Day / c2Sluice', !/a4Static[\s\S]{0,2500}(PointLight|ShadowGenerator)/.test(fsrc) && !/a4Day[\s\S]{0,2000}(PointLight|ShadowGenerator)/.test(fsrc)); }
// 只走路：航线 / 码头 / 出口不动
ok('walk only: routes B + D unchanged, no new piers / kiosks', Object.keys(R.ROUTES).join() === 'B,D' && !R.PIERS.some(p => p.a4) && !Object.values(R.KIOSKS).some(k => k.a4));
ok('night lights auto-generated from RIVERS / BRIDGES (gw / 六一中路 covered)', /RIVERS/.test(nsrc) && /BRIDGES/.test(nsrc));
ok('night: skip bridge water reflection next to a sluice (the orange tube in the 新港闸 forebay)', /nearSluice/.test(nsrc) && /g\.hw \|\| 20/.test(nsrc));
ok('night: sluice light strips sit on pier caps + eaves (c2 / a3 / a4), not in the bays', /FZR\.a4 && FZR\.a4\.gate/.test(nsrc) && /PT \+ 0\.30/.test(nsrc) && /启闭房/.test(nsrc));
// 落水回岸
{ const bad = []; const L = RV.gw.line; for (let s = 3; s < L.len - 3; s += 6) for (const l of [-4, 0, 4]) { const p = L.at(s, l); if (!R.isWater(p.x, p.z)) continue; const c = R.shoreFor(p.x, p.z); if (!c || !R.isLand(c.x, c.z)) bad.push([s, l, p.x, p.z]); }
  ok('fall in on gw → shoreFor lands on the bank (not back to the platform)', !bad.length, bad.slice(0, 5)); }
// 数据差分：main 7b0e148（3B 已上线）已建部分不动
{ const O = JSON.parse(execSync('git show 7b0e148:js/data/fz-river-data-e.js', { maxBuffer: 1 << 26 }).toString().replace(/^[^]*?export const FZR_E = /, '').replace(/;\s*$/, ''));
  const NE = JSON.parse(fs.readFileSync(new URL('../../js/data/fz-river-data-e.js', import.meta.url), 'utf8').replace(/^[^]*?export const FZR_E = /, '').replace(/;\s*$/, ''));
  const pre = (a, b) => J(b.slice(0, a.length)) === J(a);
  ok('unchanged: id/K/Kgm/WY/cell/lakeFar/lakeShore/steps/kiosks/sfqx/spacing/route/routes/a3/b3/piers', ['id', 'K', 'Kgm', 'WY', 'cell', 'lakeFar', 'lakeShore', 'steps', 'kiosks', 'sfqx', 'spacing', 'route', 'routes', 'a3', 'b3', 'piers'].every(k => J(O[k]) === J(NE[k])), ['id', 'K', 'Kgm', 'WY', 'cell', 'lakeFar', 'lakeShore', 'steps', 'kiosks', 'sfqx', 'spacing', 'route', 'routes', 'a3', 'b3', 'piers'].filter(k => J(O[k]) !== J(NE[k])));
  ok('ja / gm / jn / fb rivers identical (gw is new)', J(O.rivers.ja) === J(NE.rivers.ja) && J(O.rivers.gm) === J(NE.rivers.gm) && J(O.rivers.jn) === J(NE.rivers.jn) && J(O.rivers.fb) === J(NE.rivers.fb) && !O.rivers.gw && NE.rivers.gw);
  ok('bridges / roads / dry: old entries an exact prefix (4A appended 六一中路)', ['bridges', 'roads', 'dry'].every(k => pre(O[k], NE[k])));
  const hc = O.houses.map((h, i) => J(h) !== J(NE.houses[i]) ? i : -1).filter(i => i >= 0);
  ok(`old houses unchanged except new 4A gone flags (${(A4.gone.houses || []).join(',') || 'none'})`, !hc.length || (J(hc) === J(A4.gone.houses || []) && hc.every(i => NE.houses[i].gone === '4A')), hc);
  const tc = O.trees.map((t, i) => J(t) !== J(NE.trees[i]) ? i : -1).filter(i => i >= 0);
  ok(`old trees unchanged (${tc.join(',') || 'none'})`, !tc.length || (J(tc) === J(A4.gone.trees || []) && tc.every(i => NE.trees[i][5] === 'gone')), tc);
  const near = (k) => { const [cx, cz] = k.split(',').map(Number), x = (cx + 0.5) * NE.cell, z = (cz + 0.5) * NE.cell; return RV.gw.line.project(x, z).d < NE.cell * 0.75 + 40 || Math.hypot(x - A4.gate.x, z - A4.gate.z) < 80 || Math.hypot(x - A4.yz.c[0], z - A4.yz.c[1]) < 50; };
  const area = c => { let t = 0; for (let i = 0; i < c.i.length; i += 3) { const [a, b, d] = [c.i[i], c.i[i + 1], c.i[i + 2]].map(k => [c.p[2 * k], c.p[2 * k + 1]]); t += Math.abs((b[0] - a[0]) * (d[1] - a[1]) - (d[0] - a[0]) * (b[1] - a[1])) / 2; } return t; };
  for (const c of ['land', 'water']) { const ch = Object.keys(O[c]).filter(k => J(O[c][k]) !== J(NE[c][k])), far = ch.filter(k => !near(k)), big = far.filter(k => !NE[c][k] || Math.abs(area(O[c][k]) - area(NE[c][k])) > 0.5);
    console.log(`INFO ${c} cells changed ${ch.join(' ')}; away from 4A only re-triangulated (|Δarea| ≤ 0.5 m²): ${far.join(' ') || '-'}`);
    ok(`${c} cells: old cells changed only next to 4A (others same area ±0.5 m²)`, !big.length, big); }
}
console.log(fails.length ? `\n${fails.length} FAILED: ${fails.join(', ')}` : '\nALL PASS');
process.exit(fails.length ? 1 : 0);
