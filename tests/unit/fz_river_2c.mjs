// 福州内河 2C（白马河下段 + 上海西码头 + 宁化 A 口 + C 线，PLAN-2C 定稿 v2）：小美六条定稿 + 硬规则的数据 / 逻辑检查
import * as R from '../../js/data/fz-river.js';
import fs from 'node:fs';
import { FZ_EXITS, FZ_EXIT_TABLE } from '../../js/data/fz-exits.js';
import { fzBoatJobs, fzBoatArriveSegs, fzBoatDepartSegs } from '../../js/data/phrases.js';
const fails = [];
function ok(n, v, info) { console.log(`${v ? 'PASS' : 'FAIL'} ${n}${!v && info !== undefined ? ' ' + JSON.stringify(info) : ''}`); if (!v) fails.push(n); }
R.useNet('a');
const F = R.FZR, P = id => R.PIERS.find(p => p.id === id);
// ① A 线不动；C 线另开，和 A 线共用西水关码头、各自泊位
ok('route A unchanged: xihu → xsg → lmh → smc, current route after useNet = A', R.ROUTE_ID === 'A' && R.STOPS.map(s => s.id).join() === 'xihu,xsg,lmh,smc');
ok('routes in net a: A + C', Object.keys(R.ROUTES).join() === 'A,C', Object.keys(R.ROUTES));
const C = R.ROUTES.C;
ok('route C: xsgc (西水关, C berth) → shw (上海西码头), red canopy (same boat model)', C.stops.map(s => s.id).join() === 'xsgc,shw' && C.route.canopy === 'red', C.stops.map(s => s.id));
const xsg = P('xsg'), xsgc = P('xsgc'), shw = P('shw');
ok('xsgc shares 西水关码头 (same zh/en, same sign, shared = xsg)', xsgc.shared === 'xsg' && xsgc.zh === xsg.zh && xsgc.en === xsg.en && JSON.stringify(xsgc.sign) === JSON.stringify(xsg.sign));
const dB = Math.hypot(xsgc.berth[0] - xsg.berth[0], xsgc.berth[1] - xsg.berth[1]);
ok(`C berth is its own berth (${dB.toFixed(1)} m from the A berth, ≥ 12 m = boat + gap)`, dB >= 12, dB);
ok('xsgc deck (栈道) + rail + deck in dry list', xsgc.deck && xsgc.deck.i.length >= 3 && xsgc.rail.length >= 2 && F.dry.length > 16);
{ // 栈道是干地、在 A 浮码头和 C 泊位之间连起来（沿岸走 0.5 m 一步全是干地）
  const ring = xsgc.deckRing, inside = (x, z) => R.inPoly(x, z, ring);
  const okPts = [[xsgc.berth[0] + xsgc.n[0] * 1.6, xsgc.berth[1] + xsgc.n[1] * 1.6]].every(([x, z]) => R.isDry(x, z));
  ok('deck next to the C berth is dry (plank lands on it)', okPts && inside(xsgc.berth[0] + xsgc.n[0] * 1.6, xsgc.berth[1] + xsgc.n[1] * 1.6)); }
{ // 栈道不能压在 1A 西岸水埠头石阶（bm_e）上：石阶（沿岸 ±4.2 m、离墙 0–1.4 m）里没有一点是栈道；石阶旁边留 ≥ 0.9 m 的走道
  const st = F.steps.find(q => q.id === 'bm_e'), ring = xsgc.deckRing, Pp = (a, b) => [st.x + st.t[0] * a - st.n[0] * b, st.z + st.t[1] * a - st.n[1] * b];
  let over = 0; for (let a = -4.2; a <= 4.2; a += 0.2) for (let b = 0.02; b <= 1.38; b += 0.12) { const [x, z] = Pp(a, b); if (R.inPoly(x, z, ring)) over++; }
  const L = R.RIVERS.bm.line; let walk = true; for (let s = st.s - 4.2; s <= st.s + 4.2; s += 0.2) for (const l of [7.7, 8.0, 8.3]) { const q = L.at(s, l); if (!R.inPoly(q.x, q.z, ring)) walk = false; }
  ok('xsgc deck clears the 1A bm_e water stair (no overlap) and keeps a walkway beside it (lat 7.7–8.3)', over === 0 && walk, { over, walk }); }
// 码头牌：西水关一块牌两行（A线 / C线，各自下一站）；上海西：C 线，下一站 西水关
ok('pierNext(xsg) on A = 西湖 / 黎明湖; pierNext(xsgc, C) = 上海西; pierNext(shw) = 西水关', R.pierNext('xsg').map(p => p.id).join() === 'xihu,lmh' && R.pierNext('xsgc', 'C').map(p => p.id).join() === 'shw' && R.pierNext('shw').map(p => p.id).join() === 'xsgc');
ok('routesOfPier: xsg → A, xsgc → C, shw → C', R.routesOfPier('xsg').join() === 'A' && R.routesOfPier('xsgc').join() === 'C' && R.routesOfPier('shw').join() === 'C');
{ const fsrc = fs.readFileSync(new URL('../../js/world/fzRiver.js', import.meta.url), 'utf8'), body = fsrc.slice(fsrc.indexOf('  pierSign(p) {'), fsrc.indexOf('  /* ---------- 2C：西水关'));
  ok('pier sign: grey stone base + wood board, zh + en name, one row per line (line badge + next stop), shared C berth folded into the 西水关 sign, no arrows / map',
    /深灰石座/.test(body) && /木牌/.test(body) && /fit\(p\.zh/.test(body) && /fit\(p\.en/.test(body) && /q\.shared === p\.id/.test(body) && /routesOfPier\(id\)/.test(body) && /rid \+ '线'/.test(body) && !/arrow|moveTo|lineTo/.test(body));
  ok('C line colour green on badge / HUD', /C: '#2F7D4A'/.test(fsrc) && /LINE_COLOR\[rid\]/.test(body)); }
// ② 终点：上海西码头 / Shanghai West Pier；到站多一句换乘
ok('terminal pier 「上海西码头」 / "Shanghai West Pier" (west bank)', shw.zh === '上海西码头' && shw.en === 'Shanghai West Pier' && shw.side === 1);
const arr = fzBoatArriveSegs('shw', true);
ok('arrive shw: 终点 + 「换乘地铁宁化站，请从 A 口出站」 (zh + en)', arr.length === 4 && arr[0].text.startsWith('上海西码头到了') && arr[2].text === '换乘地铁宁化站，请从 A 口出站。' && arr[3].text.includes('Ninghua') && arr[3].text.includes('Exit A'), arr.map(a => a.text));
const ids = fzBoatJobs().map(j => j.id), need = ['c.depart.shw', 'c.depart.xsgc', 'next.shw', 'arrive.shw.end', 'arrive.xsgc.end', 'xfer.shw'];
ok('C announcements in the TTS jobs (zh + en): ' + need.join(', '), need.every(k => ids.includes(`voice.fz.boat.${k}.zh`) && ids.includes(`voice.fz.boat.${k}.en`)));
ok('C depart: 欢迎乘坐内河游船C线，本船开往上海西码头 + 下一站 (next xsgc uses the 西水关 recording)', fzBoatDepartSegs('shw', 'shw', 'C')[0].text.includes('C线') && fzBoatDepartSegs('xsgc', 'xsgc', 'C')[2].id === 'voice.fz.boat.next.xsg.zh');
{ const man = JSON.parse(fs.readFileSync(new URL('../../assets/audio/manifest.json', import.meta.url), 'utf8')), have = new Set(man.assets.map(a => a.id));
  const miss = need.flatMap(k => ['zh', 'en'].map(l => `voice.fz.boat.${k}.${l}`)).filter(id => !have.has(id) && !fs.existsSync(new URL('../../assets/audio/voice/' + id.slice(6).replace(/\./g, '-') + '.mp3', import.meta.url)));
  ok('C voice files generated (existing TTS pipeline)', !miss.length, miss); }
// ③ 河口不设下船点：C 线到上海西为止；彬德水闸 + 闽江靠江滨西大道下穿步行到
ok('no stop beyond 上海西 (C ends at shw; no pier near the mouth)', R.PIERS.every(p => p.river !== 'bm' || p.s <= shw.s + 1));
const U = F.undersC || [], c2 = F.c2;
ok('under-walks 2C: 工业路 + 江滨西大道 (west bank, separate from 2B unders)', U.map(u => u.name).join() === '工业路,江滨西大道' && U.every(u => u.side === 1) && F.unders.length === 2);
ok('彬德水闸 + viewpoint south of the 江滨西大道 under-walk, 闽江 beyond', c2.sluice.s > U[1].s + U[1].flat + U[1].run && c2.sluice.bays === 3 && R.isLand(...c2.sluice.view) && c2.mj.water.i.length > 0 && c2.mj.lv < R.WY);
// ④ 桥
const B = id => R.BRIDGES.find(b => b.id === id), b2c = R.BRIDGES.filter(b => b.c2);
ok('2C bridges: 斗池路 / 交通西路 / 工业路 / 单拱平桥(无牌) / 无名路桥 / 同德路 / 彬德桥 / 江滨西大道', b2c.map(b => b.name || '-').join() === '斗池路,交通西路,工业路,-,-,同德路,彬德桥,江滨西大道', b2c.map(b => b.name));
ok('彬德桥: heritage stone footbridge with plate', B('bm18').kind === 'bingde' && B('bm18').plate === '彬德桥' && B('bm18').w < 4);
ok('s≈5000 bridge: ordinary single-arch flat bridge, no plate', B('bm15').kind === 'sarch' && !B('bm15').plate && !B('bm15').name && R.humpRise(B('bm15')) === 0);
ok('omitted: 浦西 / 三迪 / 宁化 / 双洲 / 上海西纳凉点桥', !R.BRIDGES.some(b => /浦西|三迪|宁化|双洲|纳凉/.test((b.name || '') + (b.plate || ''))));
// ⑤ 宁化 A → 上海西码头：不过桥，步道（榕树 + 石栏，无地面指引）
const K = R.KIOSKS.fznh;
ok('宁化 A kiosk in net a, pier shw', K && R.netOfKiosk('fznh') === 'a' && K.n === 'A' && K.pier === 'shw');
ok('fz-exits: 宁化 A attr fzriver, to 白马河 / 上海西码头, unverified', FZ_EXITS.fznh && FZ_EXITS.fznh.n === 'A' && FZ_EXITS.fznh.attr === 'fzriver' && FZ_EXITS.fznh.to.includes('上海西码头') && FZ_EXITS.fznh.verified === false && FZ_EXIT_TABLE.fznh);
{ const L = R.RIVERS.bm.line, kp = L.project(K.x, K.z), sp = L.project(...shw.sign);
  ok(`kiosk and pier on the same (west) bank — no bridge crossing (lat ${kp.lat.toFixed(1)} / ${sp.lat.toFixed(1)})`, kp.lat * sp.lat > 0 && Math.sign(kp.lat) === Math.sign(L.project(shw.x, shw.z).lat));
  // 亭 → 台阶顶直线上不经过水面
  let wet = 0; for (let t = 0; t <= 1; t += 0.01) { const x = K.x + (shw.sign[0] - K.x) * t, z = K.z + 1.5 + (shw.sign[1] - K.z - 1.5) * t; if (R.isWater(x, z)) wet++; }
  ok('kiosk → pier line never crosses water', wet === 0, wet); }
ok(`walk 宁化 A → pier stairs ${c2.nhWalk} m ≤ 120`, c2.nhWalk > 20 && c2.nhWalk <= 120);
const nhw = F.roads.find(r => r.id === 'nhw');
ok('宁化步道: walk, stone rails both sides, no ground guidance', nhw && nhw.walk && nhw.rails.length === 2 && !('arrow' in nhw) && !('guide' in nhw));
ok(`banyans along 宁化步道 (${F.trees.filter(t => t[5] === 'nhw').length}, upright)`, F.trees.filter(t => t[5] === 'nhw').length >= 4 && F.trees.filter(t => t[5] === 'nhw').every(t => t[6] === 1));
// ⑥ 单程 ≤ 8 min（约 4.8 min）+ 加减速 + 净空
R.withRoute('C', () => {
  const f = R.runTime(0, 1), b = R.runTime(1, 0);
  console.log(`INFO route C len ${R.ROUTE.line.len.toFixed(1)} m; one-way 西水关→上海西 ${f.secs} s (${(f.secs / 60).toFixed(2)} min), back ${b.secs} s; vmax ${f.legs[0].vmax}`);
  ok(`route C one-way ≤ 8 min both ways (${f.secs} / ${b.secs} s)`, f.secs <= 480 && b.secs <= 480, [f.secs, b.secs]);
  ok(`route C one-way ≈ 4.8 min (4.0–5.6)`, f.secs >= 240 && f.secs <= 336 && b.secs >= 240 && b.secs <= 336, [f.secs, b.secs]);
  const cr = R.clearanceReport(0.25), per = Object.values(cr.per);
  console.log('INFO C clearance ' + Object.entries(cr.per).map(([id, x]) => `${id} ${x.name || x.kind} ${x.gap.toFixed(3)}`).join(', '));
  const want = R.BRIDGES.filter(b => b.river === 'bm' && b.s > R.PIERS.find(p => p.id === 'xsgc').s - 6 && b.s < R.PIERS.find(p => p.id === 'shw').s).map(b => b.id).sort().join();
  ok(`C canopy clears every bridge it passes ≥ ${R.CLEAR_MIN} m (min ${cr.min.toFixed(3)}; ${per.length} bridges)`, cr.ok && Object.keys(cr.per).sort().join() === want, [want, Object.keys(cr.per)]);
  // 加 / 减速：两段（去 / 回）× 四种帧长（含抖动）
  let seed = 11; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  for (const [tag, dtf] of [['1/60', () => 1 / 60], ['0.05', () => 0.05], ['0.25', () => 0.25], ['jitter', () => 0.004 + rnd() * 0.246]]) {
    let aMax = 0, dMax = 0, stuck = 0;
    for (const [i0, i1] of [[0, 1], [1, 0]]) { const b = { s: R.STOPS[i0].s, v: 0, dir: Math.sign(i1 - i0), target: i1, phase: 'go', lk: null }; let t = 0, done = false;
      while (t < 900) { const dt = dtf(), v0 = b.v; done = R.boatStep(b, dt); t += dt; const a = (b.v - v0) / dt; if (a > aMax) aMax = a; if (-a > dMax) dMax = -a; if (done) break; }
      if (!done || b.v > 1e-9 || Math.abs(b.s - R.STOPS[i1].s) > 0.6) stuck++; }
    ok(`C dt ${tag}: accel ≤ 0.5 (${aMax.toFixed(3)}), decel ≤ 1.0 (${dMax.toFixed(3)}) m/s², both legs arrive at v 0`, aMax <= 0.5 + 1e-9 && dMax <= 1.0 + 1e-9 && !stuck, { aMax, dMax, stuck });
  }
  // 船体（缩进 0.1 m）全程在水面 / 干地（栈道）上；不压到停在西水关的 A 船
  const bad = []; for (let s = R.STOPS[0].s; s <= R.STOPS[1].s; s += 0.5) for (const q of R.hullPts(s, 0.1)) if (!R.isWater(q.x, q.z) && !R.isDry(q.x, q.z)) bad.push([+s.toFixed(1), +q.x.toFixed(1), +q.z.toFixed(1)]);
  ok('C hull stays on the water all the way', bad.length === 0, bad.slice(0, 6));
});
{ const A = R.ROUTES.A.route.line, sx = R.ROUTES.A.stops[1].s, pA = A.at(sx), pC = R.ROUTES.C.route.line.at(R.ROUTES.C.stops[0].s);
  ok(`A boat at 西水关 and C boat at its berth do not overlap (${Math.hypot(pA.x - pC.x, pA.z - pC.z).toFixed(1)} m apart)`, Math.hypot(pA.x - pC.x, pA.z - pC.z) > R.BOAT.len + 1); }
// 硬规则：桥下步道阶顶的岸墙栏杆开口（UGAPS，和缺口重叠 ≥ 40% 的 2 m 段都开口）—— 阶顶那 1.9 m（a ∈ f+r−1.9 … f+r）里岸墙栏杆让出 ≥ 1.0 m 连续开口
{ const bad = [], open = [];
  for (const u of U) for (const e of [-1, 1]) {
    const loc = (x, z) => { const dx = x - u.x, dz = z - u.z; return [(dx * u.t[0] + dz * u.t[1]) * e, dx * u.n[0] + dz * u.n[1]]; };
    const rails = F.wall.filter(w => w[4] === 0).map(w => [loc(w[0], w[1]), loc(w[2], w[3])]).filter(([[, b0], [, b1]]) => Math.abs(b0) < 1.5 && Math.abs(b1) < 1.5);
    let run = 0, best = 0;
    for (let a = u.flat + u.run - 1.9; a <= u.flat + u.run + 1e-6; a += 0.05) { const blocked = rails.some(([[a0], [a1]]) => a >= Math.min(a0, a1) && a <= Math.max(a0, a1)); run = blocked ? 0 : run + 0.05; best = Math.max(best, run); }
    open.push([u.id, e, +best.toFixed(2)]); if (best < 1.0) bad.push([u.id, e, best]);
  }
  console.log('INFO 2C under-walk stair-top openings (m) ' + JSON.stringify(open));
  ok('2C under-walk stair tops open in the bank railing (UGAPS, ≥ 1.0 m clear)', bad.length === 0, bad); }
ok('under-walk headroom ≥ 2.0 m and leaves the boat lane', U.every(u => R.FLAT_SOFFIT - u.y >= 2.0 && F.rivers.bm.hw - u.w >= R.BOAT.beam / 2 + 2));
// 数据差分：main（9e97cbc）里的 1A / 2A / 2B 一样不动（只多出 2C 的）
{ const { execSync } = await import('node:child_process'); const src = execSync('git show 9e97cbc:js/data/fz-river-data.js', { maxBuffer: 1 << 26 }).toString();
  const M = JSON.parse(src.replace(/^[^]*?export const FZR = /, '').replace(/;\s*$/, '')), J = JSON.stringify;
  const has = (arr, o) => { const S = new Set(arr.map(x => J(x))); return o.filter(x => !S.has(J(x))); };
  ok(`main houses unchanged (${M.houses.length})`, !has(F.houses, M.houses).length, has(F.houses, M.houses).slice(0, 3));
  ok(`main trees unchanged (${M.trees.length})`, !has(F.trees, M.trees).length, has(F.trees, M.trees).slice(0, 3));
  ok('main piers / bridges / steps / unders / roads / dry unchanged', ['piers', 'bridges', 'steps', 'unders', 'roads', 'dry'].every(k => !has(F[k], M[k]).length));
  ok('main route A / lock / lake / sfqx / sbwPark identical', ['route', 'lock', 'lake', 'lakeBox', 'sfqx', 'sbwPark', 'lakeFar', 'lakeShore'].every(k => J(M[k]) === J(F[k])));
  const Nraw = JSON.parse(fs.readFileSync(new URL('../../js/data/fz-river-data.js', import.meta.url), 'utf8').replace(/^[^]*?export const FZR = /, '').replace(/;\s*$/, ''));   // 未经 cutPierGaps 切过的原始岸墙
  const goneW = has(Nraw.wall, M.wall);
  ok(`main bank walls unchanged except the old 白马河 end cap (${goneW.length} removed)`, goneW.length <= 1 && goneW.every(w => w[4] === 2 && w[1] < -540), goneW);
  const cellZ = k => (+k.split(',')[1] + 1) * F.cell;
  const chL = Object.keys(M.land).filter(k => J(M.land[k]) !== J(F.land[k])), chW = Object.keys(M.water).filter(k => J(M.water[k]) !== J(F.water[k]));
  ok(`main land / water cells unchanged outside 2C (changed only at the 2C junction: land ${chL.join(' ')}, water ${chW.join(' ')})`, [...chL, ...chW].every(k => cellZ(k) <= -540), [chL, chW]);
  ok('白马河 centreline: main points kept as prefix', J(F.rivers.bm.p.slice(0, M.rivers.bm.p.length)) === J(M.rivers.bm.p) && J(F.rivers.dx) === J(M.rivers.dx) && J(F.rivers.at) === J(M.rivers.at)); }
console.log(fails.length ? `\n${fails.length} FAILED: ${fails.join(', ')}` : '\nALL PASS');
process.exit(fails.length ? 1 : 0);
