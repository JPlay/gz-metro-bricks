// 福州内河 3A（光明港东段 → 魁岐九门闸 + 闽江远景 + D 线，PLAN-3 v2 §3 / §5 / §8 小美定稿）：数据 / 逻辑检查
import * as R from '../../js/data/fz-river.js';
import fs from 'node:fs';
import { execSync } from 'node:child_process';
import { fzBoatJobs, fzBoatDepartSegs } from '../../js/data/phrases.js';
const fails = [];
function ok(n, v, info) { console.log(`${v ? 'PASS' : 'FAIL'} ${n}${!v && info !== undefined ? ' ' + JSON.stringify(info) : ''}`); if (!v) fails.push(n); }
R.useNet('e');
const F = R.FZR, A3 = F.a3, P = id => R.PIERS.find(p => p.id === id), J = JSON.stringify;
const fsrc = fs.readFileSync(new URL('../../js/world/fzRiver.js', import.meta.url), 'utf8');
ok('3A data present (a3: gmALen / gate / mj)', A3 && A3.gmALen > 500 && A3.gate && A3.mj);
// ---- 河道：光明港东段接在 1B 光明港后面，1:5；新中线最小弯半径 ≥ 25 m ----
const gm = R.RIVERS.gm.line, addLen = gm.len - A3.gmALen;
ok(`光明港东段 ${addLen.toFixed(0)} m (1:5 of ~3 km real; plan 500–600 m, ≤ 700)`, addLen >= 480 && addLen <= 700, addLen);
{ // 两种量法：① gen_e.py 的口径（中线顶点三点外接圆，接缝前 40 m 起）；② 沿中线 6 m 窗口的转角（R = 6 / Δθ，对折线更严）
  const c = F.rivers.gm.p, pts = []; for (let i = 0; i < c.length; i += 2) { const pr = gm.project(c[i], c[i + 1]); if (pr.s >= A3.gmALen - 40) pts.push([c[i], c[i + 1]]); }
  let r1 = 1e9; for (let i = 1; i < pts.length - 1; i++) { const [a, b, d] = [pts[i - 1], pts[i], pts[i + 1]], A = Math.hypot(b[0] - a[0], b[1] - a[1]), Bq = Math.hypot(d[0] - b[0], d[1] - b[1]), C = Math.hypot(d[0] - a[0], d[1] - a[1]), s = (A + Bq + C) / 2, ar = Math.sqrt(Math.max(0, s * (s - A) * (s - Bq) * (s - C))); if (ar > 1e-6) r1 = Math.min(r1, A * Bq * C / (4 * ar)); }
  let r2 = 1e9, at = 0; for (let s = A3.gmALen - 30; s <= gm.len - 6; s += 1) { const a = gm.at(s), b = gm.at(s + 6); let d = Math.atan2(b.tx, b.tz) - Math.atan2(a.tx, a.tz); d -= 2 * Math.PI * Math.round(d / (2 * Math.PI)); const r = 6 / Math.max(1e-9, Math.abs(d)); if (r < r2) { r2 = r; at = s; } }
  console.log(`INFO 3A centreline min bend radius: vertices ${r1.toFixed(1)} m, 6 m window ${r2.toFixed(1)} m at gm s ${at}`);
  ok(`new centreline min bend radius ≥ 25 m (vertices ${r1.toFixed(1)}, 6 m window ${r2.toFixed(1)})`, r1 >= 25 && r2 >= 25, { r1, r2, at }); }
// ---- D 线：白篷，光明港码头（D 泊位，共用码头和木牌）⇄ 魁岐停靠点；站序 + 终点掉头 ----
ok('routes in net e: B + D', Object.keys(R.ROUTES).join() === 'B,D', Object.keys(R.ROUTES));
const D = R.ROUTES.D, gmg = P('gmg'), gmgD = P('gmgD'), kq = P('kq');
ok('route D: gmgD (光明港码头, D berth) → kq (魁岐停靠点), white canopy (same boat model)', D.stops.map(s => s.id).join() === 'gmgD,kq' && D.route.canopy === 'white', D.stops.map(s => s.id));
ok('route B unchanged: wq → fx → dmn → hk → gmg', R.ROUTES.B.stops.map(s => s.id).join() === 'wq,fx,dmn,hk,gmg');
ok('gmgD shares 光明港码头 (same zh/en, same sign, shared = gmg, own deck + rail)', gmgD.shared === 'gmg' && gmgD.zh === gmg.zh && gmgD.en === gmg.en && J(gmgD.sign) === J(gmg.sign) && gmgD.deck && gmgD.deck.i.length >= 3 && gmgD.rail.length >= 2);
{ const dB = Math.hypot(gmgD.berth[0] - gmg.berth[0], gmgD.berth[1] - gmg.berth[1]);
  ok(`D berth is its own berth (${dB.toFixed(1)} m from the B berth, ≥ 12 m = boat + gap)`, dB >= 12, dB);
  ok('deck next to the D berth is dry (plank lands on it) and inside the deck ring', R.isDry(gmgD.berth[0] + gmgD.n[0] * 1.6, gmgD.berth[1] + gmgD.n[1] * 1.6) && R.inPoly(gmgD.berth[0] + gmgD.n[0] * 1.6, gmgD.berth[1] + gmgD.n[1] * 1.6, gmgD.deckRing)); }
{ const pB = R.ROUTES.B.route.line.at(R.ROUTES.B.stops[4].s), pD = D.route.line.at(D.stops[0].s);
  ok(`B boat at 光明港 and D boat at its berth do not overlap (${Math.hypot(pB.x - pD.x, pB.z - pD.z).toFixed(1)} m apart)`, Math.hypot(pB.x - pD.x, pB.z - pD.z) > R.BOAT.len + 1); }
ok('pierNext(gmg, B) = 河口; pierNext(gmgD, D) = 魁岐停靠点; pierNext(kq) = 光明港 D berth', R.pierNext('gmg', 'B').map(p => p.id).join() === 'hk' && R.pierNext('gmgD', 'D').map(p => p.id).join() === 'kq' && R.pierNext('kq').map(p => p.id).join() === 'gmgD');
ok('routesOfPier: gmg → B, gmgD → D, kq → D', R.routesOfPier('gmg').join() === 'B' && R.routesOfPier('gmgD').join() === 'D' && R.routesOfPier('kq').join() === 'D');
R.withRoute('D', () => {
  const f = R.runTime(0, 1), b = R.runTime(1, 0);
  console.log(`INFO route D len ${R.ROUTE.line.len.toFixed(1)} m; one-way 光明港→魁岐 ${f.secs} s (${(f.secs / 60).toFixed(2)} min), back ${b.secs} s; vmax ${f.legs[0].vmax}`);
  ok(`route D one-way ≤ 8 min both ways (${f.secs} / ${b.secs} s)`, f.secs <= 480 && b.secs <= 480 && f.secs > 60, [f.secs, b.secs]);
  ok('stop order 光明港码头 → 魁岐停靠点, ascending along the route, on the berth line', R.STOPS.map(s => s.pier.zh).join() === '光明港码头,魁岐停靠点' && R.STOPS[1].s > R.STOPS[0].s && R.STOPS.every(s => s.d < 0.05));
  ok('terminus turnaround: docked at 魁岐 (dir +1) next = 光明港; docked at 光明港 (dir −1) next = 魁岐', R.nextStop(1, 1) === 0 && R.nextStop(0, -1) === 1);
  ok('zones: cruise 3.5, open water 5.5, bridge 3.5, pier 3.5', R.ROUTE.zones.cruise === 3.5 && R.ROUTE.zones.vFast === 5.5 && R.ROUTE.zones.vBridge === 3.5 && R.ROUTE.zones.vPier === 3.5);
  let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  for (const [tag, dtf] of [['1/60', () => 1 / 60], ['0.25', () => 0.25], ['jitter', () => 0.004 + rnd() * 0.246]]) {
    let aMax = 0, dMax = 0, stuck = 0;
    for (const [i0, i1] of [[0, 1], [1, 0]]) { const bb = { s: R.STOPS[i0].s, v: 0, dir: Math.sign(i1 - i0), target: i1, phase: 'go', lk: null }; let t = 0, done = false;
      while (t < 900) { const dt = dtf(), v0 = bb.v; done = R.boatStep(bb, dt); t += dt; const a = (bb.v - v0) / dt; if (a > aMax) aMax = a; if (-a > dMax) dMax = -a; if (done) break; }
      if (!done || bb.v > 1e-9 || Math.abs(bb.s - R.STOPS[i1].s) > 0.6) stuck++; }
    ok(`D dt ${tag}: accel ≤ 0.5, decel ≤ 1.0 m/s², both legs arrive at v 0 (turns back at both ends)`, aMax <= 0.5 + 1e-9 && dMax <= 1.0 + 1e-9 && !stuck, { aMax, dMax, stuck });
  }
  const bad = []; for (let s = R.STOPS[0].s; s <= R.STOPS[1].s; s += 0.5) for (const q of R.hullPts(s, 0.1)) if (!R.isWater(q.x, q.z) && !R.isDry(q.x, q.z)) bad.push([+s.toFixed(1), +q.x.toFixed(1), +q.z.toFixed(1)]);
  ok('D hull stays on the water all the way', bad.length === 0, bad.slice(0, 6));
  // 桥：净空 ≥ 0.25 m；船上同时看得见 ≤ 2 座
  const cr = R.clearanceReport(0.25);
  console.log('INFO D clearance ' + Object.entries(cr.per).map(([id, x]) => `${id} ${x.name || x.kind} ${x.gap.toFixed(3)}`).join(', '));
  ok(`D canopy clears every bridge it passes ≥ 0.25 m (min ${cr.min.toFixed(3)}; passes ${Object.keys(cr.per).join(',')})`, cr.ok && cr.min >= 0.25 && Object.keys(cr.per).includes('gm4'), cr.per);
  const vb = [], hist = {}; for (const dir of [1, -1]) for (let s = 0; s <= R.ROUTE.line.len; s += 2) { const v = R.bridgesInView(s, dir); hist[v.length] = (hist[v.length] || 0) + 1; if (v.length > 2) vb.push([dir, s, v]); }
  console.log(`INFO D bridges in view histogram ${J(hist)}`);
  ok('D: ≤ 2 bridges in view from the seated boat, every 2 m, both directions', !vb.length, vb.slice(0, 4));
});
// ---- 桥：只放 OSM 有名字的路桥（福光南路），过船平桥 ----
{ const b3 = R.BRIDGES.filter(b => b.a3);
  ok('3A bridges: only OSM-named road bridge 福光南路 (flat road bridge, no plate — same as the 1B road bridges), east of 光明港码头', b3.map(b => b.name).join() === '福光南路' && b3.every(b => b.kind === 'road' && !b.plate && b.s > A3.gmALen) && J(A3.bridges) === J(b3.map(b => b.id)), b3.map(b => [b.id, b.name, b.kind]));
  ok('3A bridge spans water, both ends on land', b3.every(b => R.isWater(b.x, b.z) && [-1, 1].every(sg => R.isLand(b.x + b.n[0] * sg * (b.hw + 2.5), b.z + b.n[1] * sg * (b.hw + 2.5))))); }
// ---- 码头 / 停靠点木牌（小美 3A ③）----
ok('kq 「魁岐停靠点 / Kuiqi Stop」, 游戏增设 note, stopOnly sign (no line / next rows)', kq.zh === '魁岐停靠点' && kq.en === 'Kuiqi Stop' && kq.stopOnly === true && /游戏增设/.test(kq.note) && kq.side === 1 && kq.sign && R.isLand(...kq.sign));
{ const body = fsrc.slice(fsrc.indexOf('  pierSign(p) {'), fsrc.indexOf('  /* ---------- 2C：西水关'));
  const so = body.slice(body.indexOf('if (p.stopOnly)'), body.indexOf('return; }', body.indexOf('if (p.stopOnly)')) + 9);
  ok('kq sign paints only zh + en (stopOnly branch returns before line badge / 下一站 rows)', /if \(p\.stopOnly\) \{ fit\(p\.zh, [^;]+\); fit\(p\.en, [^;]+\); return; \}/.test(body) && !/下一站|线'|Next/.test(so) && body.indexOf('if (p.stopOnly)') < body.indexOf("rid + '线'"));
  ok('gmg sign: two rows B线 / D线 (shared D berth folded into the sign)', /q\.shared === p\.id/.test(body) && R.routesOfPier('gmg').concat(R.routesOfPier('gmgD')).join() === 'B,D');
  ok('D line colour on badge / HUD', /D: '#7A4E9C'/.test(fsrc) && R.LINE_COLORS.D === '#7A4E9C' && D.route.color === '#7A4E9C'); }
ok('kq stair mouth open in the bank railing', (() => { const loc = (x, z) => { const dx = x - kq.x, dz = z - kq.z; return [dx * kq.t[0] + dz * kq.t[1], dx * kq.n[0] + dz * kq.n[1]]; }; for (const w of F.wall) { if (w[4] !== 0) continue; for (let k = 1; k < 20; k++) { const t = k / 20, [a, b] = loc(w[0] + (w[2] - w[0]) * t, w[1] + (w[3] - w[1]) * t); if (a > -10.15 && a < -8.35 && Math.abs(b) < 0.95) return false; } } return true; })());
// ---- D 线报站（现有 TTS 流程）----
{ const ids = fzBoatJobs().map(j => j.id), need = ['d.depart.kq', 'd.depart.gmgD', 'next.kq', 'arrive.kq.end', 'arrive.gmgD.end'];
  ok('D announcements in the TTS jobs (zh + en): ' + need.join(', '), need.every(k => ids.includes(`voice.fz.boat.${k}.zh`) && ids.includes(`voice.fz.boat.${k}.en`)), need.filter(k => !ids.includes(`voice.fz.boat.${k}.zh`)));
  ok('D depart: 欢迎乘坐内河游船D线，本船开往魁岐停靠点; next 光明港 uses the gmg recording', fzBoatDepartSegs('kq', 'kq', 'D')[0].text.includes('D线') && fzBoatDepartSegs('kq', 'kq', 'D')[0].text.includes('魁岐停靠点') && fzBoatDepartSegs('gmgD', 'gmgD', 'D')[2].id === 'voice.fz.boat.next.gmg.zh');
  const miss = need.flatMap(k => ['zh', 'en'].map(l => `voice.fz.boat.${k}.${l}`)).filter(id => !fs.existsSync(new URL('../../assets/audio/voice/' + id.slice(6).replace(/\./g, '-') + '.mp3', import.meta.url)));
  ok('D voice files generated (existing TTS pipeline)', !miss.length, miss); }
// ---- 九门闸：只看、不过船、人上不去（小美 3A ②）----
{ const G = A3.gate, L = (x, z) => { const dx = x - G.x, dz = z - G.z; return [dx * G.t[0] + dz * G.t[1], dx * G.n[0] + dz * G.n[1]]; }, blk = G.block;
  ok('九门闸: 9 bays across the full channel, at the end of 光明港 (s = len − 4.5), stone sluice (same build as 彬德水闸)', G.bays === 9 && Math.abs(G.s - (gm.len - 4.5)) < 0.05 && G.hw === F.rivers.gm.hw && /this\.c2Sluice\(G, '魁岐九门闸'\)/.test(fsrc));
  const lb = blk.map(([x, z]) => L(x, z)), a0 = Math.min(...lb.map(q => q[0])), a1 = Math.max(...lb.map(q => q[0])), b0 = Math.min(...lb.map(q => q[1])), b1 = Math.max(...lb.map(q => q[1]));
  ok(`gate block footprint covers every pier / gate / hoist house / work bridge (a ${a0.toFixed(1)}…${a1.toFixed(1)}, b ±${b1.toFixed(1)}) and reaches into both banks`, a0 <= -2.9 && a1 >= 2.7 && b0 <= -(G.hw + 1.0) && b1 >= G.hw + 1.0 && R.isLand(...[G.x + G.n[0] * (G.hw + 1.0), G.z + G.n[1] * (G.hw + 1.0)]) || R.isLand(...[G.x - G.n[0] * (G.hw + 1.0), G.z - G.n[1] * (G.hw + 1.0)]), { a0, a1, b0, b1 });
  ok('gate block is a tall invisible collider (colGateBlock, 16 m) built in a3Static', /k\.col\(cx, 3, cz, lb, 16, la, \{ ry: yawOf\(G\.t\[0\], G\.t\[1\]\), name: 'colGateBlock' \}\)/.test(fsrc));
  // 闸上游 60 m 内没有码头 / 船线终点：船不会开到闸边
  ok('no pier / route reaches the gate (D ends ≥ 50 m upstream)', R.PIERS.every(p => p.river !== 'gm' || p.s < G.s - 50) && R.withRoute('D', () => { const e = R.ROUTE.line.at(R.ROUTE.line.len); return gm.project(e.x, e.z).s < G.s - 50; }));
  // 闸头两岸：岸墙到口门（flag 4）为止，旁边都是栏杆（flag 0），没有缺口可下水 / 上闸
  const near = F.wall.filter(w => { const [a, b] = L((w[0] + w[2]) / 2, (w[1] + w[3]) / 2); return a > -25 && a < 6 && Math.abs(b) < G.hw + 3; });
  ok('bank walls next to the gate are rails (no gap) and the mouth is a 口门 cap (flag 4)', near.length > 2 && near.every(w => w[4] === 0 || w[4] === 4) && near.some(w => w[4] === 4), near.map(w => w[4]));
  { const [va, vb] = L(...G.view), ang = [-G.hw, G.hw].map(b => Math.atan2(b - vb, -va)), fov = Math.abs(ang[1] - ang[0]) * 180 / Math.PI;   // 小美 11-17：观景处在闸上游 20–40 m 岸边，正面看九孔（水平张角 ≤ 80°，一屏装得下）
    ok(`viewpoint (lookout bench) on land, 20–40 m upstream of the gate facing all nine bays (a ${va.toFixed(1)}, span ${fov.toFixed(0)}°), outside the block; 闽江取景点 mjView beside the gate`, R.isLand(...G.view) && !R.inPoly(G.view[0], G.view[1], blk.flat()) && va <= -20 && va >= -40 && fov <= 80 && G.mjView && R.isLand(...G.mjView) && Math.abs(L(...G.mjView)[0]) < 8, { va, vb, fov }); }
  // 落水 → 回到岸上：闸边、闸上游掉下去都回到岸地（不在闸块里、不回站台）
  const tries = [[-6, 0], [-6, G.hw - 2], [-6, -(G.hw - 2)], [-30, 10], [-62, 15], [-200, 0]].map(([a, b]) => [G.x + G.t[0] * a + G.n[0] * b, G.z + G.t[1] * a + G.n[1] * b]);
  const res = tries.map(([x, z]) => { const s = R.shoreFor(x, z); return s && R.isLand(s.x, s.z) && !R.inPoly(s.x, s.z, blk.flat()) && !R.isDry(s.x, s.z) ? 1 : 0; });
  ok('fall-in anywhere in 3A water → 回到岸上 lands on bank land, never in the gate block / on a pontoon', res.every(Boolean), res); }
// ---- 闽江远景 ----
{ const M = A3.mj;
  ok('闽江 water beyond the gate, 0.6 m below the river, same colour (no seam), shore wall + stone rails', M.water.i.length >= 6 && Math.abs(M.lv - (R.WY - 0.6)) < 1e-6 && M.shore.length >= 1 && M.rail.length >= 2 && /c = hex\('#2F6670'\)/.test(fsrc.slice(fsrc.indexOf('  a3Static() {'), fsrc.indexOf('  a3Day() {'))));
  const c = M.water.p; let inRegion = 0; for (let i = 0; i < c.length; i += 2) if (R.isLand(c[i], c[i + 1])) inRegion++;
  ok('闽江 is view-only (outside the walkable land; boundary closes the mouth)', F.bound.length > 4 && R.inPoly(M.o[0] + M.t[0] * 100, M.o[1] + M.t[1] * 100, F.bound.flat()) === false); }
// ---- 夜里 ≤ 白天（小美 3A ④）+ tileCull ----
{ const ld = fsrc.slice(fsrc.indexOf('  lodNow(force) {'), fsrc.indexOf('  refreshTilesIfTurned() {'));
  ok('g3day (3A glints + 闽江 far bank) is a day-only group: off whenever nightLod, on only near 光明港 east', /if \(FZR\.a3\) \{ this\.a3Day\(\); k\.group\('g3day'\); \}/.test(fsrc) && /gn\.g3day\) \{ const on = !this\.nightLod && p\.x > FZR\.a3\.x0 - 60;/.test(ld));
  ok('g3day meshes skip tileCull and per-mesh frustum culling (stable day count, so night ≤ day)', /noTileCull: true \}\); m\.alwaysSelectAsActiveMesh = true;/.test(fsrc) && /m\.metadata\.noTileCull/.test(fs.readFileSync(new URL('../../js/world/tileCull.js', import.meta.url), 'utf8')));
  ok('1B glints unchanged (gm glints in rest stop at gmALen; 3A glints only in g3day)', /id === 'gm' && FZR\.a3 \? FZR\.a3\.gmALen/.test(fsrc) && /!\(id === 'gm' && FZR\.a3\)/.test(fsrc));
  ok('3A static (gate, 闽江 water / walls / rails) in g0 buckets — drawn before k.group(\'g0\'), tile-culled', fsrc.indexOf('if (FZR.a3) this.a3Static();') > 0 && fsrc.indexOf('if (FZR.a3) this.a3Static();') < fsrc.indexOf("k.group('g0')")); }
// 夜灯：fzNight 按 RIVERS / BRIDGES / PIERS 自动生成，3A 段也有
{ const N = fs.readFileSync(new URL('../../js/world/fzNight.js', import.meta.url), 'utf8');
  ok('night lights auto-generated along every river / bridge / pier (3A covered, no per-batch list)', /RIVERS/.test(N) && /BRIDGES/.test(N) && /PIERS/.test(N) && gm.len > A3.gmALen); }
// ---- 房子：3A 新楼四面贴立面、不挡码头牌 / 闸 ----
{ const H = F.houses.filter(h => h.a3);
  ok(`3A houses (${H.length}) all with façades on four sides (back: true)`, H.length >= 10 && H.every(h => h.back === true));
  ok('3A houses keep clear of the gate block, lookout and kq sign', H.every(h => Math.hypot(h.x - A3.gate.mjView[0], h.z - A3.gate.mjView[1]) > 14 && Math.hypot(h.x - A3.gate.view[0], h.z - A3.gate.view[1]) > 14 && Math.hypot(h.x - kq.sign[0], h.z - kq.sign[1]) > 10)); }
// ---- 数据差分：main b54b446 的 1B（e 网）已建部分不动 ----
{ const src = execSync('git show b54b446:js/data/fz-river-data-e.js', { maxBuffer: 1 << 26 }).toString();
  const O = JSON.parse(src.replace(/^[^]*?export const FZR_E = /, '').replace(/;\s*$/, ''));
  const pre = (a, b) => J(b.slice(0, a.length)) === J(a);
  // 3B 在 3A 之后又接了晋安河北段 / 凤坂河（会动接口处的格子 / 岸墙，凤坂河口的两栋 1B 楼打 gone）：3A 自己的差分拿 3A 合入时的数据（main 6b44e7e）比；3B 的差分在 fz_river_3b.mjs
  const F = R.FZR.b3 ? JSON.parse(execSync('git show 6b44e7e:js/data/fz-river-data-e.js', { maxBuffer: 1 << 26 }).toString().replace(/^[^]*?export const FZR_E = /, '').replace(/;\s*$/, '')) : R.FZR;
  ok('unchanged keys: id/K/Kgm/WY/cell/lakeFar/lakeShore/steps/kiosks/sfqx/spacing/route (B)', ['id', 'K', 'Kgm', 'WY', 'cell', 'lakeFar', 'lakeShore', 'steps', 'kiosks', 'sfqx', 'spacing', 'route'].every(k => J(O[k]) === J(F[k])));
  ok('晋安河 identical; 光明港 1B centreline is an exact prefix (only extended)', J(O.rivers.ja) === J(F.rivers.ja) && pre(O.rivers.gm.p, F.rivers.gm.p) && O.rivers.gm.hw === F.rivers.gm.hw && O.rivers.gm.band === F.rivers.gm.band);
  ok('1B houses / trees / piers / bridges / roads / dry unchanged (3A only appended)', ['houses', 'trees', 'piers', 'bridges', 'roads', 'dry'].every(k => pre(O[k], F[k])), ['houses', 'trees', 'piers', 'bridges', 'roads', 'dry'].filter(k => !pre(O[k], F[k])));
  const jx = A3.x0 - 30;   // 接缝：1B 光明港东头（x ≈ 1110）往西 30 m 以内
  for (const c of ['land', 'water']) { const ch = Object.keys(O[c]).filter(k => J(O[c][k]) !== J(F[c][k])), far = ch.filter(k => (Number(k.split(',')[0]) + 1) * F.cell < jx);
    ok(`${c} cells: old cells changed only at the junction (${ch.join(' ')})`, far.length === 0 && ch.length <= 4, ch); }
  const NE = R.FZR.b3 ? F : JSON.parse(fs.readFileSync(new URL('../../js/data/fz-river-data-e.js', import.meta.url), 'utf8').replace(/^[^]*?export const FZR_E = /, '').replace(/;\s*$/, ''));   // 生成的原始数据（运行时会在码头台阶口切岸墙，不能拿 R.FZR.wall 比）
  const NS = new Set(NE.wall.map(w => J(w))), lost = O.wall.filter(w => !NS.has(J(w)));
  ok(`walls: only ${lost.length} old segments replaced, all at the junction (old 光明港 end cap)`, lost.length <= 6 && lost.every(w => Math.min(w[0], w[2]) > jx), lost); }
// ---- 3A 小美：D 船和 B 船分得开：白篷 + 蓝绿垂边 + 两头「D」牌（同一张漆面网格，不加 draw） ----
{ const bsrc = fs.readFileSync(new URL('../../js/game/fzBoat.js', import.meta.url), 'utf8'), i0 = bsrc.indexOf('小「D」牌'), blk = bsrc.slice(i0, bsrc.indexOf('// 碰撞：', i0));
  ok('D boat: white canopy, teal trim (B keeps white + red trim), D plates on both ends merged into the boat paint mesh (no new mesh / texture)', bsrc.includes("trim = hex(this.rid === 'D' ? '#1F8A8A' : this.variant === 'white' ? '#B3261E'") && blk.includes('P.box(0, py, z0') && blk.includes('for (const e of [-1, 1])') && !/MeshBuilder|new B\.|DynamicTexture|Material/.test(blk), blk.length); }
// ---- 小美 11-17 视觉 4 项：闽江对岸（170 m，雾前）地面 + 堤岸 + 蓝灰楼；3A 路桥沥青 + 标线；e 网树干法线；都在已有网格里（不加 draw） ----
{ const a3d = fsrc.slice(fsrc.indexOf('  a3Day() {'), fsrc.indexOf('/** 水埠头')), dk = fsrc.slice(fsrc.indexOf('  a3Deck(b, F, w, half) {'), fsrc.indexOf('  /** 3A 白天才画的一组'));
  ok('闽江 far bank at 170 m (inside the 200 m haze start): ground strip + embankment, bluish-grey buildings (no #D9D2C4 / #E3D9C6 whites), solid only', A3.mj.far[0] === 170 && /对岸地面/.test(a3d) && /堤岸/.test(a3d) && !/#D9D2C4|#E3D9C6/.test(a3d) && !/metal|atlas|MeshBuilder/.test(a3d));
  ok('3A road bridges (福光南路): dark-grey deck on granite + white dashes / edge lines + double yellow on kit.solid, no asphalt bucket', A3.bridges.includes('gm4') && /GR\.box\(cx, (?:y0 \+ )?0\.008, cz, 2 \* W2, 0\.012, L, hex\('#4E5155'\)/.test(dk) && /E2B53A/.test(dk) && !/asphalt|metal|MeshBuilder/.test(dk));
  ok('e-net banyan trunks: tapered-side normals recomputed (no sky-facing normals → brown, not pinkish white)', /if \(FZR\.id === 'e'\) trunkNormals\(P, tv0, ta, tb, 0\.5 \* s, 0\.225 \* s\)/.test(fsrc));
  const segd = (p, a, b) => { const vx = b[0] - a[0], vz = b[1] - a[1], t = Math.max(0, Math.min(1, ((p[0] - a[0]) * vx + (p[1] - a[1]) * vz) / (vx * vx + vz * vz))); return Math.hypot(p[0] - a[0] - vx * t, p[1] - a[1] - vz * t); }, G = A3.gate;
  const blk = F.trees.filter(t => [-1, 0, 1].some(e => segd([t[0], t[1]], G.view, [G.x + G.n[0] * e * G.hw, G.z + G.n[1] * e * G.hw]) < 2.5));
  ok('no banyan in the lookout → gate sight lines (both ends + centre, 2.5 m)', !blk.length, blk.map(t => t.slice(0, 2))); }
console.log(fails.length ? `\n${fails.length} FAILED: ${fails.join(', ')}` : '\nALL PASS');
process.exit(fails.length ? 1 : 0);
