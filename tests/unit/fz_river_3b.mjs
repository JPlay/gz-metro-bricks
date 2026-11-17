// 福州内河 3B（晋安河北段 → 琴亭湖 + 凤坂河，PLAN-3 v2 §3 / §8 小美定稿；只走路）：数据 / 逻辑检查
import * as R from '../../js/data/fz-river.js';
import fs from 'node:fs';
import { execSync } from 'node:child_process';
const fails = [];
function ok(n, v, info) { console.log(`${v ? 'PASS' : 'FAIL'} ${n}${!v && info !== undefined ? ' ' + JSON.stringify(info) : ''}`); if (!v) fails.push(n); }
R.useNet('e');
const F = R.FZR, B3 = F.b3, J = JSON.stringify, RV = R.RIVERS;
const fsrc = fs.readFileSync(new URL('../../js/world/fzRiver.js', import.meta.url), 'utf8'), nsrc = fs.readFileSync(new URL('../../js/world/fzNight.js', import.meta.url), 'utf8');
ok('3B data present (b3: jnLen / fbLen / lake / signs / lamps)', B3 && B3.jnLen > 300 && B3.fbLen > 300 && B3.lake && B3.signs.length === 2 && B3.lamps.length >= 6);
ok('rivers: ja, gm, then jn (晋安河北段) + fb (凤坂河)', Object.keys(RV).join() === 'ja,gm,jn,fb');
ok('jn same width as 晋安河 (hw/band), fb 12/22, names', F.rivers.jn.hw === F.rivers.ja.hw && F.rivers.jn.band === F.rivers.ja.band && F.rivers.fb.hw === 12 && F.rivers.fb.band === 22 && F.rivers.fb.zh === '凤坂河' && F.rivers.fb.en === 'Fengban River' && F.rivers.jn.zh === F.rivers.ja.zh);
console.log(`INFO jn ${RV.jn.line.len.toFixed(1)} m, fb ${RV.fb.line.len.toFixed(1)} m, lake ring ${B3.lake.ring.length / 2} pts`);
// 弯半径：顶点三点外接圆 + 6 m 窗口
for (const id of ['jn', 'fb']) { const L = RV[id].line, c = F.rivers[id].p, pts = []; for (let i = 0; i < c.length; i += 2) pts.push([c[i], c[i + 1]]);
  let r1 = 1e9; for (let i = 1; i < pts.length - 1; i++) { const [a, b, d] = [pts[i - 1], pts[i], pts[i + 1]], A = Math.hypot(b[0] - a[0], b[1] - a[1]), Bq = Math.hypot(d[0] - b[0], d[1] - b[1]), C = Math.hypot(d[0] - a[0], d[1] - a[1]), s = (A + Bq + C) / 2, ar = Math.sqrt(Math.max(0, s * (s - A) * (s - Bq) * (s - C))); if (ar > 1e-6) r1 = Math.min(r1, A * Bq * C / (4 * ar)); }
  let r2 = 1e9, at = 0; for (let s = 0; s <= L.len - 6; s += 1) { const a = L.at(s), b = L.at(s + 6); let d = Math.atan2(b.tx, b.tz) - Math.atan2(a.tx, a.tz); d -= 2 * Math.PI * Math.round(d / (2 * Math.PI)); const r = 6 / Math.max(1e-9, Math.abs(d)); if (r < r2) { r2 = r; at = s; } }
  ok(`${id} min bend radius ≥ 25 m (vertices ${r1.toFixed(1)}, 6 m window ${r2.toFixed(1)} at s ${at})`, r1 >= 25 && r2 >= 25, { r1, r2, at }); }
// 接口：jn 末点 = ja 起点，切向连续；jn 头伸进湖
{ const jn = F.rivers.jn.p, ja = F.rivers.ja.p, n = jn.length, e = RV.jn.line.at(RV.jn.line.len), s0 = RV.ja.line.at(0);
  ok('jn ends exactly at the 晋安河 start (seamless)', jn[n - 2] === ja[0] && jn[n - 1] === ja[1]);
  const da = Math.abs(Math.atan2(e.tx, e.tz) - Math.atan2(s0.tx, s0.tz)); ok(`jn → ja tangent continuous (${(da * 180 / Math.PI).toFixed(1)}°)`, da < 8 * Math.PI / 180, da);
  const h = RV.jn.line.at(0); ok('jn head is inside 琴亭湖 water', R.isWater(h.x, h.z) && R.inPoly(h.x, h.z, B3.lake.ring)); }
// 凤坂河口：落在光明港水面，离前横南路桥够远
{ const e = RV.fb.line.at(RV.fb.line.len), pr = RV.gm.line.project(e.x, e.z), gm3 = R.BRIDGES.find(b => b.name === '前横南路');
  ok('fb mouth opens into 光明港 water', R.isWater(e.x, e.z) && pr.d < F.rivers.gm.hw + 1 && B3.fbMouth.moved === -14, pr);
  ok(`fb channel clear of the 前横南路 deck (${(gm3.s - pr.s).toFixed(1)} m)`, gm3.s - pr.s >= F.rivers.fb.hw + gm3.w / 2 + 6, gm3.s - pr.s); }
// 桥：只放 OSM 有名的路桥，深灰路面
{ const b3 = R.BRIDGES.filter(b => b.b3), want = { jn: '农信路,北二环,华林路', fb: '福马路,前屿西路,连洋路,连凤路,远洋路' };
  ok('3B bridges: only OSM-named road bridges (jn 3 + fb 5), ids jn1–3 / fb1–5', ['jn', 'fb'].every(r => b3.filter(b => b.river === r).map(b => b.name).join() === want[r]) && b3.every(b => b.kind === 'road' && !b.plate) && J(B3.bridges) === J(b3.map(b => b.id)), b3.map(b => [b.id, b.name]));
  ok('3B bridges span water, both ends on land', b3.every(b => R.isWater(b.x, b.z) && [-1, 1].every(sg => R.isLand(b.x + b.n[0] * sg * (b.hw + 2.5), b.z + b.n[1] * sg * (b.hw + 2.5)))));
  const gaps = []; for (const r of ['jn', 'fb']) { const bs = b3.filter(b => b.river === r).sort((a, c) => a.s - c.s); for (let i = 1; i < bs.length; i++) gaps.push(bs[i].s - bs[i].w / 2 - (bs[i - 1].s + bs[i - 1].w / 2)); }
  ok(`deck gaps between neighbouring bridges ≥ 10 m (min ${Math.min(...gaps).toFixed(1)})`, Math.min(...gaps) >= 10, gaps);
  const f5 = b3.find(b => b.id === 'fb5'); ok('远洋路 deck edge ≥ 8 m from the 光明港 bank', RV.fb.line.len - (f5.s + f5.w / 2) >= 8 + F.rivers.gm.hw - F.rivers.gm.hw, RV.fb.line.len - (f5.s + f5.w / 2));
  ok('3B road decks: same dark-grey a3Deck (no asphalt bucket)', /\|\| b\.b3\)\) this\.a3Deck\(b, F, w, half\)/.test(fsrc));
  const st = fsrc.slice(fsrc.indexOf('if (r.b3) {'), fsrc.indexOf('if (r.b3) {') + 900);
  ok('3B road stubs: dark granite #4E5155 + double yellow + white edges', /#4E5155/.test(st) && /E2B53A/.test(st) && !/asphalt/.test(st));
  ok('every 3B bridge has road stubs on both ends', b3.every(b => F.roads.filter(r => r.b3 && r.stub && r.name === b.name).length >= 2), b3.map(b => [b.name, F.roads.filter(r => r.b3 && r.name === b.name).length])); }
// 琴亭湖
{ const L = B3.lake, c = L.c; ok('琴亭湖 / Qinting Lake: centre is water, ring ≥ 40 pts', L.zh === '琴亭湖' && L.en === 'Qinting Lake' && R.isWater(c[0], c[1]) && L.ring.length >= 80);
  const bad = []; for (let i = 0; i < L.ring.length; i += 8) { const x = L.ring[i], z = L.ring[i + 1], dx = x - c[0], dz = z - c[1], d = Math.hypot(dx, dz); if (!R.isLand(x + dx / d * 4, z + dz / d * 4) && !R.isWater(x + dx / d * 4, z + dz / d * 4)) bad.push([x, z]); }
  ok('lake ring: 4 m outside is a walkable bank (or another channel)', !bad.length, bad.slice(0, 4));
  const lb = B3.lamps.filter(l => !R.isLand(l[0], l[1]) || !R.isLand(l[4], l[5])); ok(`lake lamps (${B3.lamps.length}) + benches on land`, !lb.length, lb.slice(0, 3));
  ok('lake lamps drawn in det cells (no new draw), night halo + ground pool + lake streak in fzNight', /lakeLamps\(\) \{\s*for \(const \[x, z, fx, fz, bx, bz\] of FZR\.b3\.lamps\) this\.det\(/.test(fsrc) && /FZR\.b3/.test(nsrc));
  ok('park skirt painted grass (inQ)', /inQ\(x, z\)/.test(fsrc)); }
// 夜里 draw 不超过白天：3B 水面亮纹单独一组 g3bday，只白天 + 人在 3B 一带开，夜里关掉腾出夜灯那一个 draw
{ const ld = fsrc.slice(fsrc.indexOf('  lodNow(force) {'), fsrc.indexOf('  refreshTilesIfTurned() {'));
  ok('g3bday (jn / fb / lake glints): day-only group, off whenever nightLod, on only inside the two 3B zones', /if \(FZR\.b3\) \{ this\.b3Day\(\); k\.group\('g3bday'\); \}/.test(fsrc) && /gn\.g3bday\) \{ const on = !this\.nightLod && FZR\.b3\.zone\.some/.test(ld) && B3.zone.length === 2);
  ok('g3bday skips tileCull / frustum culling (stable day count)', /g3bday\.getChildMeshes\(\)\) \{ m\.metadata = Object\.assign\(\{\}, m\.metadata, \{ noTileCull: true \}\); m\.alwaysSelectAsActiveMesh = true;/.test(fsrc));
  ok('jn / fb glints not in the always-on water (rest) loop', /if \(FZR\.b3 && \(id === 'jn' \|\| id === 'fb'\)\) continue;/.test(fsrc)); }
// 牌子
{ const s = B3.signs; ok('signs: 琴亭湖 / Qinting Lake + 凤坂河 / Fengban River, on land', s.map(q => q.lines.join('/')).join() === '琴亭湖/Qinting Lake,凤坂河/Fengban River' && s.every(q => R.isLand(q.x, q.z)));
  ok('signs drawn in b3Static before g0 group', fsrc.indexOf('if (FZR.b3) this.b3Static();') > 0 && fsrc.indexOf('if (FZR.b3) this.b3Static();') < fsrc.indexOf("k.group('g0')")); }
// 房子 / 树
{ const H = F.houses.filter(h => h.b3), wet = H.filter(h => R.isWater(h.x, h.z));
  ok(`3B houses (${H.length}) façades on four sides, none in water`, H.length >= 10 && H.every(h => h.back === true) && !wet.length, wet.length);
  const T = F.trees.filter(t => t[5] === 'lake' || ((t[5] === 'jn' || t[5] === 'fb'))), tw = T.filter(t => R.isWater(t[0], t[1]));
  ok(`3B trees (${T.length}) none in water; lake trees are willows ('lake')`, T.length >= 20 && !tw.length, tw.slice(0, 3));
  ok('gone flags: 1B houses / trees under the fb mouth skipped at runtime', /if \(h\.gone\) continue;/.test(fsrc) && /if \(h\.gone\) return;/.test(fsrc) && J(B3.gone.houses) !== '[]'); }
// 北头封口 + 落水
{ const caps = F.wall.filter(w => w[4] === 2), h = RV.fb.line.at(0); ok('fb north end: culvert cap (flag 2)', caps.some(w => Math.hypot((w[0] + w[2]) / 2 - h.x, (w[1] + w[3]) / 2 - h.z) < F.rivers.fb.hw + 2), caps.length);
  const bad = []; for (const id of ['jn', 'fb']) { const L = RV[id].line; for (let s = 5; s < L.len - 5; s += 15) for (const l of [-4, 0, 4]) { const p = L.at(s, l); if (!R.isWater(p.x, p.z)) continue; const c = R.shoreFor(p.x, p.z); if (!c || !R.isLand(c.x, c.z)) bad.push([id, s, l]); } }
  for (let i = 0; i < B3.lake.ring.length; i += 10) { const x = B3.lake.ring[i] * 0.8 + B3.lake.c[0] * 0.2, z = B3.lake.ring[i + 1] * 0.8 + B3.lake.c[1] * 0.2; if (!R.isWater(x, z)) continue; const c = R.shoreFor(x, z); if (!c || !R.isLand(c.x, c.z)) bad.push(['lake', x, z]); }
  ok('fall in anywhere on jn / fb / lake → shoreFor lands on the bank', !bad.length, bad.slice(0, 5)); }
// 只走路：线路 / 码头 / 出口不动
ok('walk only: routes B + D unchanged, no new piers / kiosks', Object.keys(R.ROUTES).join() === 'B,D' && !R.PIERS.some(p => p.b3) && !Object.values(R.KIOSKS).some(k => k.b3));
ok('night lights auto-generated from RIVERS / BRIDGES (jn / fb covered)', /RIVERS/.test(nsrc) && /BRIDGES/.test(nsrc));
// 数据差分：main 6b44e7e（3A 上线）已建部分不动
{ const O = JSON.parse(execSync('git show 6b44e7e:js/data/fz-river-data-e.js', { maxBuffer: 1 << 26 }).toString().replace(/^[^]*?export const FZR_E = /, '').replace(/;\s*$/, ''));
  const NE = JSON.parse(fs.readFileSync(new URL('../../js/data/fz-river-data-e.js', import.meta.url), 'utf8').replace(/^[^]*?export const FZR_E = /, '').replace(/;\s*$/, ''));
  const pre = (a, b) => J(b.slice(0, a.length)) === J(a), strip = (h) => { const c = { ...h }; delete c.gone; return c; };
  ok('unchanged: id/K/Kgm/WY/cell/lakeFar/lakeShore/steps/kiosks/sfqx/spacing/route/routes/a3/piers', ['id', 'K', 'Kgm', 'WY', 'cell', 'lakeFar', 'lakeShore', 'steps', 'kiosks', 'sfqx', 'spacing', 'route', 'routes', 'a3', 'piers'].every(k => J(O[k]) === J(NE[k])), ['id', 'K', 'Kgm', 'WY', 'cell', 'lakeFar', 'lakeShore', 'steps', 'kiosks', 'sfqx', 'spacing', 'route', 'routes', 'a3', 'piers'].filter(k => J(O[k]) !== J(NE[k])));
  ok('ja / gm rivers identical', J(O.rivers.ja) === J(NE.rivers.ja) && J(O.rivers.gm) === J(NE.rivers.gm));
  ok('bridges / roads / dry: old entries an exact prefix (3B appended)', ['bridges', 'roads', 'dry'].every(k => pre(O[k], NE[k])));
  const hc = O.houses.map((h, i) => J(h) !== J(strip(NE.houses[i])) ? i : -1).filter(i => i >= 0), hg = NE.houses.slice(0, O.houses.length).map((h, i) => h.gone ? i : -1).filter(i => i >= 0);
  ok(`old houses unchanged except gone flags (${hg.join(',')})`, !hc.length && J(hg) === J(B3.gone.houses), hc);
  const tc = O.trees.map((t, i) => J(t) !== J(NE.trees[i]) ? i : -1).filter(i => i >= 0);
  ok(`old trees unchanged except kind 'gone' (${tc.join(',')})`, J(tc) === J(B3.gone.trees) && tc.every(i => NE.trees[i][5] === 'gone'), tc);
  const near = (k) => { const [cx, cz] = k.split(',').map(Number), x = (cx + 0.5) * NE.cell, z = (cz + 0.5) * NE.cell; return [RV.jn.line, RV.fb.line].some(L => L.project(x, z).d < NE.cell * 0.75 + 30) || Math.hypot(x - B3.lake.c[0], z - B3.lake.c[1]) < 160; };
  const area = c => { let t = 0; for (let i = 0; i < c.i.length; i += 3) { const [a, b, d] = [c.i[i], c.i[i + 1], c.i[i + 2]].map(k => [c.p[2 * k], c.p[2 * k + 1]]); t += Math.abs((b[0] - a[0]) * (d[1] - a[1]) - (d[0] - a[0]) * (b[1] - a[1])) / 2; } return t; };
  for (const c of ['land', 'water']) { const ch = Object.keys(O[c]).filter(k => J(O[c][k]) !== J(NE[c][k])), far = ch.filter(k => !near(k)), big = far.filter(k => !NE[c][k] || Math.abs(area(O[c][k]) - area(NE[c][k])) > 0.5);
    console.log(`INFO ${c} cells changed ${ch.join(' ')}; away from the new channels only re-triangulated / collinear-vertex cleanup (|Δarea| ≤ 0.5 m²): ${far.join(' ') || '-'}`);
    ok(`${c} cells: old cells changed only next to the new channels (others same area ±0.5 m²)`, !big.length, big); }
  const ja0 = RV.ja.line.at(0), fbm = RV.fb.line.at(RV.fb.line.len), atJ = w => [[ja0.x, ja0.z], [fbm.x, fbm.z]].some(q => Math.hypot((w[0] + w[2]) / 2 - q[0], (w[1] + w[3]) / 2 - q[1]) < 80);
  const NS = new Set(NE.wall.map(w => J(w))), lost = O.wall.filter(w => !NS.has(J(w))), lf = lost.filter(w => !atJ(w));
  ok(`walls: ${lost.length} old segments replaced, all within 80 m of the two junctions`, !lf.length, lf.slice(0, 4));
  const g0 = lost.filter(w => w[4] === 1 && !(Math.hypot((w[0] + w[2]) / 2 - fbm.x, (w[1] + w[3]) / 2 - fbm.z) < 30)), gm = g0.filter(w => !NE.wall.some(v => v[4] === 1 && Math.hypot(v[0] - w[0], v[1] - w[1]) < 0.6 && Math.hypot(v[2] - w[2], v[3] - w[3]) < 0.6));
  ok(`old stair / pier gaps in replaced walls kept (±0.6 m): ${g0.length - gm.length}/${g0.length}`, !gm.length, gm); }
console.log(fails.length ? `\n${fails.length} FAILED: ${fails.join(', ')}` : '\nALL PASS');
process.exit(fails.length ? 1 : 0);
