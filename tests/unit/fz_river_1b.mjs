// 福州内河 1B（晋安河 1:3 + 光明港 1:4；游船 B 线白篷 温泉公园—福新问渡—东门停靠点—河口—光明港）：河网数据 / 船体在水里 / 篷顶过桥净空 / 出口接入 / 码头牌 / 报站（普通话 + 英语）。
import * as R from '../../js/data/fz-river.js';
import { FZ_EXITS, FZ_EXIT_TABLE } from '../../js/data/fz-exits.js';
import { RIVER_HAZE, Haze, hazeAmount, FOGMODE_NONE, FOGMODE_LINEAR } from '../../js/game/haze.js';
import fs from 'node:fs';
import { allJobs, fzBoatDepartSegs, fzBoatArriveSegs, fzBoatJobs } from '../../js/data/phrases.js';
const fails = [];
function ok(n, v, info) { console.log(`${v ? 'PASS' : 'FAIL'} ${n}${!v && info !== undefined ? ' ' + JSON.stringify(info) : ''}`); if (!v) fails.push(n); }
// ---- 河网切换 ----
ok('kiosk → net: 斗门/东门/光明港 = e, 西门/西洋 = a', ['fzdm', 'fzdmn', 'fzgmg'].every(c => R.netOfKiosk(c) === 'e') && ['fzxm', 'fzxiy'].every(c => R.netOfKiosk(c) === 'a'));
const lenA = R.ROUTE.line.len;
R.useNet('e');
ok('useNet(e) swaps live bindings', R.NET === 'e' && R.FZR.id === 'e' && R.ROUTE.id === 'B' && R.ROUTE.line.len !== lenA);
const F = R.FZR;
// ---- 数据 ----
ok('two rivers ja/gm (晋安河 / 光明港)', Object.keys(R.RIVERS).join() === 'ja,gm' && R.RIVERS.ja.zh === '晋安河' && R.RIVERS.gm.zh === '光明港');
ok('compression 晋安河 1:4, 光明港 1:5 (小美)', F.K === 4 && F.Kgm === 5);
ok('same water level as 1A', F.WY === -3);
ok('land + water meshes present', Object.keys(F.land).length > 30 && Object.keys(F.water).length > 30);
// 晋安河口接光明港：晋安河中线末点在光明港水面里
{ const L = R.RIVERS.ja.line, e = L.at(L.len); ok('晋安河 mouth joins 光明港 water', R.isWater(e.x, e.z) && R.RIVERS.gm.line.project(e.x, e.z).d < 3); }
ok('13 bridges (OSM, twins merged; 温泉公园步行桥 + 文博路 dropped)', R.BRIDGES.length === 13, R.BRIDGES.map(b => b.name || b.id));
ok('dropped bridges recorded with reason', F.spacing.dropped.length === 2 && F.spacing.dropped.some(d => d.kind === 'foot') && F.spacing.dropped.some(d => d.name === '文博路') && F.spacing.dropped.every(d => d.why));
const named = R.BRIDGES.filter(b => b.name).map(b => b.name);
ok('named bridges 温泉公园路/六一北路/塔头路/国货东路/北光明港路/长乐南路/连江中路/前横南路', ['温泉公园路', '六一北路', '塔头路', '国货东路', '北光明港路', '长乐南路', '连江中路', '前横南路'].every(n => named.includes(n)), named);
ok('unnamed bridges have no plate (⑧)', R.BRIDGES.filter(b => !b.name).every(b => !b.plate));
ok('no arch bridge on route B (flat bridges only)', R.BRIDGES.every(b => !['arch', 'hump'].includes(b.kind)));
ok('bridge ids unique', new Set(R.BRIDGES.map(b => b.id)).size === R.BRIDGES.length);
ok('every bridge spans water', R.BRIDGES.every(b => R.isWater(b.x, b.z)), R.BRIDGES.filter(b => !R.isWater(b.x, b.z)).map(b => b.id));
const endsLand = b => [-1, 1].every(sg => R.isLand(b.x + b.n[0] * sg * (b.hw + 2.5), b.z + b.n[1] * sg * (b.hw + 2.5)));
ok('both bridge ends on land (walkable both ways)', R.BRIDGES.every(endsLand), R.BRIDGES.filter(b => !endsLand(b)).map(b => b.id));
ok('flat bridge soffit ≥ water + 2.6 m', R.FLAT_SOFFIT - R.WY >= 2.6 - 1e-9);
let shoreBad = 0; for (const k in R.RIVERS) { const L = R.RIVERS[k].line; for (let s = 5; s < L.len - 5; s += 10) { const a = L.at(s); if (!R.isWater(a.x, a.z)) continue; const sh = R.shoreFor(a.x, a.z); if (!sh || !R.isLand(sh.x, sh.z) || Math.hypot(sh.x - a.x, sh.z - a.z) > 30) shoreBad++; } }
ok('shoreFor finds land from every river point (fall-in return)', shoreBad === 0, shoreBad);
ok('three water steps (水埠头) marked dry', F.steps.length === 3 && F.steps.every(s => R.isDry(s.x - s.n[0] * 0.7, s.z - s.n[1] * 0.7)));
// ---- 航线 / 码头 ----
ok('route B: 温泉公园 → 福新问渡 → 东门停靠点 → 河口 → 光明港', R.STOPS.map(s => s.id).join() === 'wq,fx,dmn,hk,gmg' && R.STOPS.map(s => s.pier.zh).join() === '温泉公园码头,福新问渡码头,东门停靠点,河口码头,光明港码头');
ok('white canopy', R.ROUTE.canopy === 'white');
ok('stops ascending along route & on the berth line', R.STOPS.every((s, i) => i === 0 || s.s > R.STOPS[i - 1].s) && R.STOPS.every(s => s.d < 0.5) && R.STOPS[4].s <= R.ROUTE.line.len);
let hullOut = 0; for (let s = 0; s <= R.ROUTE.line.len; s += 0.5) for (const { x, z } of R.hullPts(s)) if (!R.isWater(x, z) && !R.isDry(x, z)) { hullOut++; break; }
ok('boat hull stays inside water along whole route', hullOut === 0, hullOut);
const cr = R.clearanceReport(0.25);
ok(`canopy never clips a bridge (min clearance ${cr.min.toFixed(3)} ≥ ${R.CLEAR_MIN})`, cr.ok && cr.min >= R.CLEAR_MIN, cr.per);
{ const on = R.BRIDGES.filter(b => { const pr = R.ROUTE.line.project(b.x, b.z); return pr.d < b.hw && pr.s > R.STOPS[0].s && pr.s < R.STOPS[R.STOPS.length - 1].s; }).map(b => b.id);
  ok(`route passes under every bridge between 温泉公园 and 光明港 (${on.length}; 温泉公园路 is north of the first pier)`, on.length === R.BRIDGES.length - 1 && on.every(id => cr.per[id]), { on, crossed: Object.keys(cr.per) }); }
// 船不碰岸：船体外扩 0.3 m 的轮廓也全在水面（或浮码头）上
let bankTouch = 0; for (let s = 0; s <= R.ROUTE.line.len; s += 0.5) for (const { x, z } of R.hullPts(s, -0.3)) if (!R.isWater(x, z) && !R.isDry(x, z)) { bankTouch++; break; }
ok('bank clearance ≥ 0.3 m along whole route', bankTouch === 0, bankTouch);
// ---- 速度分区（小美）：晋安河 3.5（同 A 线）；过桥 / 进出码头 3.5；只有光明港开阔段 5.5，平滑加减速 ----
{ const Z = R.ROUTE.zones, cap = R.SPEED_CAP, n = cap.length;
  ok('zones: cruise 3.5, 光明港 5.5, bridge 3.5, pier 3.5', Z && Z.cruise === 3.5 && Z.vFast === 5.5 && Z.vBridge === 3.5 && Z.vPier === 3.5 && Z.pierZone >= 40, Z);
  // 光明港段起点在河口转弯之后（船已在光明港中线附近）
  const p0 = R.routePose(Z.fast[0]), gm = R.RIVERS.gm.line.project(p0.x, p0.z);
  ok('fast zone starts in 光明港 (after the 河口 turn)', gm.d < R.RIVERS.gm.hw && R.STOPS.find(s => s.id === 'hk').s < Z.fast[0], { d: gm.d, fast: Z.fast });
  const inJa = [...Array(Math.floor(Z.fast[0])).keys()];
  ok('晋安河 never faster than 3.5', inJa.every(i => cap[i] <= 3.5 + 1e-9), Math.max(...inJa.map(i => cap[i])));
  ok('never faster than 5.5 anywhere', cap.every(v => v <= 5.5 + 1e-9));
  ok('光明港 open water reaches 5.5', cap.some((v, i) => i > Z.fast[0] && v >= 5.5 - 1e-9));
  let bridgeBad = []; for (let i = 0; i < n; i++) { const q = R.routePose(i); for (const b of R.BRIDGES) { const { u, v } = R.bridgeLocal(b, q.x, q.z); if (Math.abs(u) < b.w / 2 + 10 && Math.abs(v) < b.half + 2 && cap[i] > 3.5 + 1e-9) bridgeBad.push([b.id, i]); } }
  ok('under / near every bridge ≤ 3.5', !bridgeBad.length, bridgeBad.slice(0, 5));
  const pierBad = R.STOPS.flatMap(st => [...Array(n).keys()].filter(i => Math.abs(i - st.s) < Z.pierZone && cap[i] > 3.5 + 1e-9).map(i => [st.id, i]));
  ok('approaching / leaving every pier ≤ 3.5', !pierBad.length, pierBad.slice(0, 5));
  ok('smooth: cap change per metre within ACC (v² step ≤ 2·ACC)', cap.every((v, i) => i === 0 || Math.abs(v * v - cap[i - 1] ** 2) <= 2 * R.ACC + 1e-6));
}
// 单程时间：用 fzBoat 每帧调用的同一个 goStep 积分（dt 1/60），起点坐下 3 s + 中途站各停 10 s
{ const f = R.runTime(0, 4), b = R.runTime(4, 0);
  console.log(`INFO route B len ${R.ROUTE.line.len.toFixed(0)} m; one-way 温泉公园→光明港 ${f.secs} s (${(f.secs / 60).toFixed(1)} min), back ${b.secs} s; legs ${f.legs.map(l => `${l.from}→${l.to} ${l.secs}s vmax ${l.vmax}`).join(', ')}`);
  ok('only the 光明港 leg (河口→光明港) goes above 3.5', f.legs.every(l => (l.to === 'gmg') === (l.vmax > 3.5 + 1e-6)), f.legs);
  ok(`route B one-way ≤ 480 s both directions (${f.secs} / ${b.secs})`, f.secs <= 480 && b.secs <= 480, [f.secs, b.secs]);
  ok('middle stop 9 s, start dwell 3 s', R.BOAT_STAY === 9 && R.BOAT_DWELL === 3);
}
// 码头间距：浮码头不压桥
// ---- 压缩后的间距（小美）：桥不挤、码头不贴桥 ----
{ const S = F.spacing;
  ok('spacing rules: bridge edge gap 20 m, pier edge 8 m, pier berth ↔ bridge centre 25 m', S.bridgeGap === 20 && S.pierGapEdge === 8 && S.pierGapCentre === 25);
  const tight = []; for (const k of ['ja', 'gm']) { const bs = R.BRIDGES.filter(b => b.river === k).sort((a, b) => a.s - b.s); for (let i = 1; i < bs.length; i++) { const g = (bs[i].s - bs[i].w / 2) - (bs[i - 1].s + bs[i - 1].w / 2); if (g < S.bridgeGap) tight.push([bs[i - 1].id, bs[i].id, +g.toFixed(1)]); } }
  ok('no two bridges crammed together (deck edge gap ≥ 20 m)', !tight.length, tight);
  // 码头沿河占 [s-10.2（台阶口）, s+8.4（浮码头尾）]，泊位 s+2.4
  const pierHit = p => R.BRIDGES.filter(b => b.river === p.river && (Math.min(p.s + 8.4, b.s + b.w / 2) - Math.max(p.s - 10.2, b.s - b.w / 2) > -S.pierGapEdge || Math.abs(p.s + 2.4 - b.s) < S.pierGapCentre)).map(b => b.id);
  ok('no bridge too close to a pier (footprint ≥ 8 m from deck, berth ≥ 25 m from bridge centre)', R.PIERS.every(p => !pierHit(p).length), R.PIERS.map(p => [p.id, pierHit(p)]));
  const mv = S.pierMoves; console.log('INFO pier moves (game m, + = downstream):', JSON.stringify(mv));
  ok('pier moves recorded and each ≤ 40 m', ['wq', 'fx', 'dmn', 'hk', 'gmg'].every(id => typeof mv[id] === 'number' && Math.abs(mv[id]) <= 40), mv);
  ok('consecutive stops ≥ 60 m apart', R.STOPS.every((s, i) => i === 0 || s.s - R.STOPS[i - 1].s >= 60), R.STOPS.map(s => s.s));
}
// ---- 坐船视角：任何时刻最多看得见两座桥（视锥 + 驳岸挡视线；不算桥挡桥 / 房子树挡 → 偏保守） ----
{ const bad = [], hist = {}; for (const dir of [1, -1]) for (let s = 0; s <= R.ROUTE.line.len; s += 2) { const v = R.bridgesInView(s, dir); hist[v.length] = (hist[v.length] || 0) + 1; if (v.length > 2) bad.push([dir, s, v]); }
  console.log(`INFO bridges in view (seated, ${R.VIEW.dist} m, 16:9) histogram: ${JSON.stringify(hist)}`);
  ok('≤ 2 bridges in view from the seated boat, every 2 m, both directions', !bad.length, bad.slice(0, 6));
  ok('view check is live (sees ≥ 1 bridge most of the time, 2 somewhere)', (hist[2] || 0) > 0 && (hist[0] || 0) < (hist[1] || 0));
}
ok('pier signs: zh + English + B线 next stops', R.PIERS.every(p => R.pierNext(p.id).length >= 1) && R.pierNext('dmn').map(p => p.id).join() === 'fx,hk' && R.pierNext('wq').map(p => p.id).join() === 'fx');
ok('东门 game-only stop is not named 码头 (sign must not look like a real pier)', R.PIER.dmn.zh === '东门停靠点' && !/Pier/.test(R.PIER.dmn.en) && /游戏增设/.test(R.PIER.dmn.note || ''));
ok('real piers keep 码头 / Pier', ['wq', 'fx', 'hk', 'gmg'].every(id => R.PIER[id].zh.endsWith('码头') && /Pier$/.test(R.PIER[id].en)));
// ---- 出口 ----
const ex = { fzdm: ['C', 1, '温泉公园码头'], fzdmn: ['C', 4, '东门停靠点（内河游船）'], fzgmg: ['D', 4, '光明港码头'] };
for (const [c, [n, line, to]] of Object.entries(ex)) {
  const e = FZ_EXITS[c];
  ok(`${c} ${n} → river (attr fzriver, line ${line})`, e && e.n === n && e.attr === 'fzriver' && e.line === line && e.to.includes(to) && e.verified === false, e);
  ok(`${c} exit table lists ${n}`, (FZ_EXIT_TABLE[c] || []).some(r => r[0] === n));
  const K = R.KIOSKS[c], P = K && R.PIER[K.pier];
  ok(`${c} kiosk on land with walkable front, ≤ 120 m to its pier`, K && K.n === n && R.isLand(K.x, K.z + 3) && R.isLand(K.x, K.z + 0.5) && P && Math.hypot(K.x - P.sign[0], K.z - P.sign[1]) <= 120, K);
  ok(`${c} kiosk stair hole cut out of the land`, K && !R.isLand(K.x, K.z - 4.5));
}
ok('斗门 C → 温泉公园, 东门 C → 东门停靠点, 光明港 D → 光明港码头', R.KIOSKS.fzdm.pier === 'wq' && R.KIOSKS.fzdmn.pier === 'dmn' && R.KIOSKS.fzgmg.pier === 'gmg');
// ---- 报站 ----
const jobs = fzBoatJobs(), ids = jobs.map(j => j.id);
ok('B line jobs present (zh + en only)', ['wq', 'fx', 'dmn', 'hk', 'gmg'].every(id => ids.includes(`voice.fz.boat.arrive.${id}${['wq', 'gmg'].includes(id) ? '.end' : ''}.zh`) && ids.includes(`voice.fz.boat.next.${id}.en`)) && ids.includes('voice.fz.boat.b.depart.gmg.zh') && ids.includes('voice.fz.boat.b.depart.wq.en') && ids.every(id => /\.(zh|en)$/.test(id)), ids.filter(i => /b\.|wq|gmg/.test(i)));
ok('A line ids unchanged', ids.includes('voice.fz.boat.depart.lmh.zh') && ids.includes('voice.fz.boat.depart.xihu.en'));
ok('allJobs includes every boat job', (() => { const all = new Set(allJobs().map(j => j.id)); return ids.every(id => all.has(id)); })());
const dep = fzBoatDepartSegs('gmg', 'fx', 'B'), txt = a => a.map(x => x.text).join(' ');
ok('B depart: 内河游船B线 + 开往光明港码头 + 下一站 + English', /内河游船B线/.test(txt(dep)) && /光明港码头/.test(txt(dep)) && /福新问渡码头/.test(txt(dep)) && /Line B/.test(txt(dep)) && /Fuxin Wendu Pier/.test(txt(dep)) && dep[0].id === 'voice.fz.boat.b.depart.gmg.zh');
ok('B arrive at 东门停靠点 / terminal 光明港', /东门停靠点到了/.test(txt(fzBoatArriveSegs('dmn', false))) && /终点/.test(txt(fzBoatArriveSegs('gmg', true))));
// ---- 预算粗估：常开几何别比 1A 多太多 ----
R.useNet('a'); const A = R.FZR; R.useNet('e');
const tris = T => Object.values(T).reduce((a, c) => a + c.i.length / 3, 0);
ok(`always-on ground+water tris ≤ 1.6 × 1A (${tris(F.land) + tris(F.water)} vs ${tris(A.land) + tris(A.water)})`, tris(F.land) + tris(F.water) <= 1.6 * (tris(A.land) + tris(A.water)));
ok(`houses ≤ 1A × 1.3 (${F.houses.length} vs ${A.houses.length})`, F.houses.length <= A.houses.length * 1.3);
R.useNet('a');
ok('useNet(a) restores 1A', R.NET === 'a' && R.STOPS.map(s => s.id).join() === 'xihu,xsg,lmh' && R.ROUTE.line.len === lenA);
// ---- 河面水汽远景（只在 1B）----
{ const H = RIVER_HAZE.e;
  ok('haze: 1B only, linear 200 → 350 m, far clip 380 m', H && !RIVER_HAZE.a && H.start === 200 && H.end === 350 && H.maxZ === 380);
  ok('haze colour ≈ sky horizon (sky.jpg horizon 0.58/0.77/0.96, clearColor 0.62/0.78/0.92)', H.color.every((c, i) => Math.abs(c - [0.59, 0.775, 0.94][i]) < 0.04), H.color);
  ok('near view keeps colours: zero haze ≤ 200 m (banyans / bridges / buildings < 150 m untouched)', [0, 50, 150, 199, 200].every(d => hazeAmount(H, d) === 0));
  ok('half haze at 275 m, fully blended at ≥ 350 m', Math.abs(hazeAmount(H, 275) - 0.5) < 1e-9 && hazeAmount(H, 350) === 1 && hazeAmount(H, 420) === 1);
  // 进出还原：模拟 main.js 的场景（隧道雾参数 25 / 85、暗色，户外 fogMode NONE）+ 相机 maxZ 420
  const scene = { fogMode: FOGMODE_NONE, fogStart: 25, fogEnd: 85, fogColor: { r: 0.08, g: 0.09, b: 0.11 } }, cam = { maxZ: 420 };
  const before = JSON.stringify([scene, cam]);
  const hz = new Haze(scene, cam, H); hz.apply();
  ok('enter 1B: fog linear 200/350 with haze colour, maxZ 380', scene.fogMode === FOGMODE_LINEAR && scene.fogStart === 200 && scene.fogEnd === 350 && scene.fogColor.r === H.color[0] && scene.fogColor.b === H.color[2] && cam.maxZ === 380);
  scene.fogMode = FOGMODE_NONE; scene.fogStart = 25; hz.reassert();   // 别处（onTunnel(false)）关掉了 → 每帧写回
  ok('reassert after something else turned fog off', scene.fogMode === FOGMODE_LINEAR && scene.fogStart === 200);
  hz.apply();   // 重复 apply 不覆盖最初保存的值
  hz.restore();
  ok('leave 1B: fog mode / start / end / colour and camera maxZ restored exactly', JSON.stringify([scene, cam]) === before, [scene, cam]);
  hz.restore(); ok('restore twice is harmless', JSON.stringify([scene, cam]) === before);
  const src = fs.readFileSync(new URL('../../js/world/fzRiver.js', import.meta.url), 'utf8'), rnd = fs.readFileSync(new URL('../../js/core/render.js', import.meta.url), 'utf8');
  ok('fzRiver wires haze: apply in after() for nets with RIVER_HAZE, reassert above tunnels, restore in dispose()', /RIVER_HAZE\[this\.net\]\)\s*\{\s*this\.haze = new Haze\(this\.scene, this\.scene\.activeCamera/.test(src) && /this\.haze && p\.y > -50\) this\.haze\.reassert\(\)/.test(src) && /dispose\(\) \{ if \(this\.haze\) \{ this\.haze\.restore\(\)/.test(src));
  ok('sky dome ignores fog (not flattened)', /sm\.fogEnabled = false/.test(rnd) && /sky\.applyFog = false/.test(rnd));
}
// ---- 小美 1A 验收同款问题（1B 一并修）----
{ // 坐船视角篷顶 ≤ 1/5 屏高：按 player.js 镜头公式（第一人称眼 = 甲板 + 1.1、往前 0.12；第三人称 target = 脚 + camT、往后 camDist）在屏幕中线打射线，
  // 落在篷檐 / 篷底平面（篷长 ±(L+0.15)）里的行数占比。四排座位 × 前后（按行进方向）× 两种视角 × 大人 / 小孩
  const Bt = R.BOAT, D = Bt.deck, RUe = Bt.roofUnder - 0.08, Lc = Bt.canopyHalfLen + 0.15;
  const cover = (ey, ez, pitch, fov, NR = 1000) => { let n = 0; const t = Math.tan(fov / 2);
    for (let i = 0; i < NR; i++) { const v = (1 - 2 * (i + 0.5) / NR) * t, dy = v * Math.cos(pitch) - Math.sin(pitch), dz = v * Math.sin(pitch) + Math.cos(pitch);
      if (dy <= 0) continue; const k = (RUe - ey) / dy; if (k <= 0) continue; const z = ez + dz * k; if (z >= -Lc && z <= Lc) n++; }
    return n / NR; };
  const rows = []; let worst = 0;
  for (const lz of Bt.rows) for (const fwd of [1, -1]) for (const hip of [0.86, 0.6]) {   // fwd = 行进方向（船头 +1 / 船尾 −1）
    const rel = lz * fwd, rear = rel < 0;   // 座位在行进方向上的位置（负 = 后半排）
    const p1 = R.seatAim('first', rear), p3 = R.seatAim('third', rear);
    const f = cover(D + 1.1, rel + 0.12, p1, 1.0);
    const ty = D + 0.55 - hip + 0.8, cy = ty + Math.sin(p3) * 1.7, cz = rel - Math.cos(p3) * 1.7, t3 = cover(cy, cz, p3, 0.92);
    rows.push([lz, fwd, hip, +f.toFixed(3), +t3.toFixed(3)]); worst = Math.max(worst, f, t3);
  }
  ok(`seated boat view: canopy ≤ 20% of screen height for every row / direction / view / adult+kid (worst ${(worst * 100).toFixed(1)}%)`, worst <= 0.2, rows);
  ok('boat camera aims lower only for the rear half (front rows look almost level)', R.seatAim('first', false) <= 0.12 && R.seatAim('first', true) > R.seatAim('first', false) && R.seatAim('third', true) <= 0.28);
  ok(`canopy still clears every 1B bridge by ≥ ${R.CLEAR_MIN} m after raising it to ${Bt.top}`, R.clearanceReport(0.25).ok && R.clearanceReport(0.25).min >= R.CLEAR_MIN, R.clearanceReport(0.25).min);
  const bsrc = fs.readFileSync(new URL('../../js/game/fzBoat.js', import.meta.url), 'utf8');
  ok('boat lanterns hang on a cord from the eave (no floating lantern), and sit at the eave corners, not dead ahead', /吊绳/.test(bsrc) && /lx = sx \* \(W - 0\.2\)/.test(bsrc) && !/P\.ellipsoid\(0, RU/.test(bsrc));
  ok('boat seats re-aim the camera when the boat turns round at a terminal (if the player has not moved it)', /_aim\.rear !== rear && Math\.abs\(pl\.pitch - this\._aim\.pitch\) < 0\.015\) pl\.pitch = ss\.aim\(pl\.view\)/.test(bsrc));
  // 码头牌英文：当前站 + 下一站都用码头自己的英文全名（和报站同一个字符串，不再去掉 Pier / Boat Stop）
  const fsrc = fs.readFileSync(new URL('../../js/world/fzRiver.js', import.meta.url), 'utf8');
  ok('pier sign English = each pier\'s own full English name (current + next), same strings as announcements', /fit\(p\.en,/.test(fsrc) && /'Next: ' \+ nx\.map\(q => q\.en\)\.join/.test(fsrc) && !/replace\(\/ \(Pier\|Boat Stop\)/.test(fsrc));
  R.useNet('e');
  const ann = R.STOPS.map(st => fzBoatArriveSegs(st.id, false, 'B').map(x => x.en || x.text || '').join(' ')).join(' | ');
  ok('announcements use the same English pier names as the signs', R.STOPS.every(st => JSON.stringify(fzBoatArriveSegs(st.id, false, 'B')).includes(st.pier.en)), ann.slice(0, 300));
  // 左上角牌：岸上「福州内河」、船上「B线 · 下一站码头」
  ok('HUD plate in river area: shore 「福州内河」, on boat 「B线 · <next pier>」 (not metro station names)', /zh: '福州内河'/.test(fsrc) && /zh: `\$\{id\}线 · \$\{n\.pier\.zh\}`/.test(fsrc) && /cm\.street\.riverHud \? cm\.street\.riverHud\(player\)/.test(fs.readFileSync(new URL('../../js/main.js', import.meta.url), 'utf8')));
  // 下一站逻辑（和 fzBoat.nextStop 同一公式）：停在码头 = 按方向下一个，终点掉头后指回去
  const nextOf = (phase, i, dir, target) => phase === 'go' ? R.STOPS[target] : R.STOPS[i + dir] || R.STOPS[i - dir];
  ok('next pier: docked at 温泉公园 (dir +1) → 福新问渡; at 光明港 after turning (dir −1) → 河口; sailing → target', nextOf('dock', 0, 1).id === 'fx' && nextOf('dock', 4, -1).id === 'hk' && nextOf('go', 1, 1, 2).id === 'dmn' && nextOf('dock', 4, 1).id === 'hk');
}
console.log(fails.length ? `\n${fails.length} FAILED: ${fails.join(', ')}` : '\nALL PASS');
process.exit(fails.length ? 1 : 0);
