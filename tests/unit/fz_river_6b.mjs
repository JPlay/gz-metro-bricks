// 福州内河 6B（湖前河西段 北浪路以西 → 官方 s=0 铁路桥南，PLAN-6B v2 小美 11-20 16:58 定稿；只走路）
import * as R from '../../js/data/fz-river.js';
import fs from 'node:fs';
const fails = [];
function ok(n, v, info) { console.log(`${v ? 'PASS' : 'FAIL'} ${n}${!v && info !== undefined ? ' ' + JSON.stringify(info) : ''}`); if (!v) fails.push(n); }
R.useNet('e');
const F = R.FZR, A6 = F.a6, A6B = F.a6b, RV = R.RIVERS;
const fsrc = fs.readFileSync(new URL('../../js/world/fzRiver.js', import.meta.url), 'utf8');
const nsrc = fs.readFileSync(new URL('../../js/world/fzNight.js', import.meta.url), 'utf8');
const src = fsrc + nsrc;

ok('6B data present (a6b: westLen / 5 bridges / rails / 4 cams)', !!(A6B && A6B.westLen > 350 && (A6B.bridges || []).length === 5 && (A6B.rails || []).length === 2 && A6B.cams && A6B.cams.seam && A6B.cams.fufei && A6B.cams.rail && A6B.cams.triple));

// 1) 范围正好官方 s=0 → 1516.22，不接 way 957264426
{ const O = A6B.official || {};
  ok('official range is exactly s=0 → 1516.22 (real 1516.22 m)', O.start === 0 && O.end === 1516.22 && Math.abs((O.real || 0) - 1516.22) < 0.01, O);
  ok('game west length is on the 1:4 budget (official.game matches westLen, ≥ 360 m; join blend may be slightly under 379)', A6B.westLen >= 360 && Math.abs((O.game || 0) - A6B.westLen) < 0.05 && RV.hq.line.len > A6.hqLen + 350, { westLen: A6B.westLen, game: O.game, hq: RV.hq.line.len, hqLen: A6.hqLen });
  ok('does not connect way 957264426', /不接 957264426/.test(A6B.note || '') && !/957264426/.test(JSON.stringify(F.rivers.hq)) && O.end === 1516.22 && O.start === 0);
}

// 与 6A 在官方 s=1516.22 / 游戏 s≈A6.hqLen 相接；6A 东段不动
{ const L = RV.hq.line, join = L.at(A6.hqLen);
  ok('joins 6A near the old west end (game ≈ 36.03, 645.97)', Math.hypot(join.x - 36.03, join.z - 645.97) < 8, { join: [join.x, join.z], s: A6.hqLen });
  const hq1 = R.BRIDGES.find(b => b.id === 'hq1'), hq2 = R.BRIDGES.find(b => b.id === 'hq2');
  ok('6A 北二环 / 北浪路 / 茶园闸 stay put', hq1 && hq1.w === 30 && hq1.tall && Math.hypot(hq1.x - 118.1, hq1.z - 627.63) < 0.05 && hq2 && hq2.w === 14 && !hq2.tall && Math.hypot(hq2.x - 44.62, hq2.z - 642.28) < 0.05 && A6.gate && A6.camMouth && (A6.bridges || []).join() === 'hq1,hq2');
}

// 弯半径 ≥ 25 m（全线，含西段）
{ const L = RV.hq.line, c = F.rivers.hq.p, pts = [];
  for (let i = 0; i < c.length; i += 2) pts.push([c[i], c[i + 1]]);
  let r1 = 1e9;
  for (let i = 1; i < pts.length - 1; i++) {
    const [a, b, d] = [pts[i - 1], pts[i], pts[i + 1]];
    const A = Math.hypot(b[0] - a[0], b[1] - a[1]), Bq = Math.hypot(d[0] - b[0], d[1] - b[1]), C = Math.hypot(d[0] - a[0], d[1] - a[1]);
    const s = (A + Bq + C) / 2, ar = Math.sqrt(Math.max(0, s * (s - A) * (s - Bq) * (s - C)));
    if (ar > 1e-6) r1 = Math.min(r1, A * Bq * C / (4 * ar));
  }
  let r2 = 1e9, at = 0;
  for (let s = 0; s <= L.len - 6; s += 1) {
    const a = L.at(s), b = L.at(Math.min(L.len, s + 6));
    let d = Math.atan2(b.tx, b.tz) - Math.atan2(a.tx, a.tz);
    d -= 2 * Math.PI * Math.round(d / (2 * Math.PI));
    const r = 6 / Math.max(1e-9, Math.abs(d));
    if (r < r2) { r2 = r; at = s; }
  }
  ok(`hq min bend radius ≥ 25 m (vertices ${r1 === 1e9 ? 'n/a' : r1.toFixed(1)}, 6 m window ${r2.toFixed(1)})`, (r1 === 1e9 || r1 >= 25) && r2 >= 25, { r1, r2, at });
}

// 2) s=127 短桥按 OSM 形状做，不挂路名牌
{ const sh = R.BRIDGES.find(b => b.style === 'short' && b.a6b);
  ok('s=127 short bridge exists (OSM shape, w≈11, pipe rail, no name / no plate)', !!(sh && sh.w === 11 && sh.railStyle === 'pipe' && !sh.plate && !sh.name && (sh.parapetH || 0) <= 0.9), sh && { id: sh.id, w: sh.w, plate: sh.plate, name: sh.name, rail: sh.railStyle });
  ok('short bridge is not in 6B stone-sign plates', sh && !(A6B.plates || []).some(p => p.bridge === sh.id || /短桥|东浦/.test(p.name || '')));
  ok('short bridge spans water, both ends on land', sh && R.isWater(sh.x, sh.z) && [-1, 1].every(sg => R.isLand(sh.x + sh.n[0] * sg * (sh.hw + 2.5), sh.z + sh.n[1] * sg * (sh.hw + 2.5))));
}

// 3) 无名脚桥不做
ok('unnamed footbridge is not built (no a6b foot kind; only hq3–hq7)', !R.BRIDGES.some(b => b.a6b && b.kind === 'foot') && A6B.bridges.join() === 'hq3,hq4,hq5,hq6,hq7');

// 4) 交图相机：接缝 / 福飞 / 铁路 / 湖景·大井·江厝同机位
{ const C = A6B.cams, names = ['seam', 'fufei', 'rail', 'triple'];
  ok('four handoff cameras are present (seam, fufei, rail, triple)', names.every(n => C[n] && C[n].look && C[n].look.length >= 3));
  ok('triple camera note calls out 湖景 / 大井 / 江厝 side by side', /湖景/.test(C.triple.note) && /大井/.test(C.triple.note) && /江厝/.test(C.triple.note));
}

// 三座短桥栏杆/跨度可分，都比福飞路窄
{ const dj = R.BRIDGES.find(b => b.name === '大井路' && b.a6b);
  const hj = R.BRIDGES.find(b => b.name === '湖景路' && b.a6b);
  const jc = R.BRIDGES.find(b => b.name === '江厝路' && b.a6b);
  const ff = R.BRIDGES.find(b => b.name === '福飞路' && b.a6b);
  const n2 = R.BRIDGES.find(b => b.name === '北二环' && b.river === 'hq');
  ok('湖景 / 大井 / 江厝 have distinct widths and rail styles, all narrower than 福飞路',
    hj && dj && jc && ff && hj.w === 10 && dj.w === 12 && jc.w === 14 && ff.w === 42
    && hj.railStyle === 'slab' && dj.railStyle === 'posts' && !jc.railStyle
    && hj.w < ff.w && dj.w < ff.w && jc.w < ff.w
    && (hj.parapetH || 0) < (dj.parapetH || 0) && /railStyle === 'posts'/.test(fsrc) && /railStyle === 'pipe'/.test(fsrc) && /railStyle === 'slab'/.test(fsrc));
  ok('福飞路 is clearly wider than 北二环 (42 > 30) and lower (deckY 1.4 < 3.2) with sidewalks',
    ff && n2 && ff.w > n2.w && ff.w === 42 && n2.w === 30 && ff.deckY === 1.4 && n2.deckY === 3.2 && (ff.walk || 0) >= 3 && ff.tall);
  for (const b of [dj, hj, jc]) {
    ok(`${b.name}: spans water, both ends on land`, R.isWater(b.x, b.z) && [-1, 1].every(sg => R.isLand(b.x + b.n[0] * sg * (b.hw + 2.5), b.z + b.n[1] * sg * (b.hw + 2.5))));
  }
  { // 福飞路 42 m 宽沿河：桥下和桥外侧沿 t 是水（梁墩站在水里）；沿 n 的引路和岸是陆地
    const mid = R.isWater(ff.x, ff.z);
    const river = [-1, 1].every(sg => R.isWater(ff.x + ff.t[0] * sg * (ff.w / 2 + 8), ff.z + ff.t[1] * sg * (ff.w / 2 + 8)));
    const apr = [-1, 1].every(sg => R.isLand(ff.x + ff.n[0] * sg * (ff.half + 10), ff.z + ff.n[1] * sg * (ff.half + 10)));
    ok('福飞路: spans water, river continues past the fascia, approaches are land', mid && river && apr);
  }
}

// 江厝路复用北浪路几何，不新增 draw
{ const jc = R.BRIDGES.find(b => b.name === '江厝路' && b.a6b);
  const bl = R.BRIDGES.find(b => b.name === '北浪路');
  ok('江厝路 reuses 北浪路 geometry (same w/half, not tall, a3Deck path, no custom mesh)',
    jc && bl && jc.w === bl.w && jc.half === bl.half && !jc.tall && !bl.tall && jc.kind === 'road' && /a6b && \(FZR\.a6b\.bridges/.test(fsrc) && /this\.a3Deck/.test(fsrc) && !/function jiangcuo/.test(fsrc));
}

// 福飞路明桥：梁+墩、人行道、中央禁走、路灯并进 fzNightLights，无点光
{ const ff = R.BRIDGES.find(b => b.name === '福飞路');
  ok('fufei() draws an open beam+pier deck with sidewalks and inner lane blockers',
    /fufei\(b\)/.test(fsrc) && /可见主梁/.test(fsrc) && /人行道/.test(fsrc) && /colFufeiInner/.test(fsrc) && /colFufeiLanes|colFufeiInner/.test(fsrc));
  ok('福飞路 lamps are in data and merge into fzNightLights (no PointLight / ShadowGenerator)',
    (A6B.lamps || []).length === 10 && /a6b\.lamps/.test(nsrc) && /fzNightLights/.test(nsrc)
    && !/new B\.PointLight/.test(src) && !/new BABYLON\.PointLight/.test(src) && !/ShadowGenerator/.test(src) && !/SpotLight/.test(src));
  ok('福飞路 center is a road (people use sidewalks); style is fufei and skipped in default a3Deck / colDeck',
    ff && ff.style === 'fufei' && /style !== 'fufei'/.test(fsrc) && /style === 'fufei'\) continue/.test(fsrc));
}

// 铁路背景各 1 draw，梁/墩/接触网杆，上不去，河停在桥南
{ const rails = A6B.rails, L = RV.hq.line, end = L.at(L.len);
  ok('two named rail silhouettes (昌福线, 合福) each in their own paint@a6bRail bucket (1 draw)',
    rails.length === 2 && /昌福/.test(rails[0].name) && /合福/.test(rails[1].name)
    && /paint@a6bRail/.test(fsrc) && /接触网杆/.test(fsrc) && /方形墩/.test(fsrc) && /colRail/.test(fsrc));
  ok('rails are background-only: north of the west cap, river does not run under them',
    rails.every(r => {
      const along = (r.x - end.x) * end.tx + (r.z - end.z) * end.tz;
      return along > -4 && !R.isWater(r.x, r.z);
    }), rails.map(r => ({ name: r.name, x: r.x, z: r.z, water: R.isWater(r.x, r.z) })));
}

// 西头合拢：铁路桥南封闭
{ const L = RV.hq.line, e = L.at(L.len), cap = A6B.cap || 10;
  const px = e.x + e.tx * (cap + 4), pz = e.z + e.tz * (cap + 4);
  ok('west cap: no walkable water past the new closed end (south of the rails)', !R.isWater(px, pz), { px, pz, end: [e.x, e.z], cap });
  ok('west cap collider is named colCap', /name: 'colCap'/.test(fsrc));
  ok('west far buildings sit on a ground pad with a dark plinth', (A6B.far || []).length >= 3 && /A6B\.far|A = FZR\.a6b[\s\S]*#6E7A64/.test(fsrc));
}

// 两岸可走、旧街房子 + 树、铺地色
{ const L = RV.hq.line, bad = [];
  for (let s = A6.hqLen + 12; s < L.len - 8; s += 8) for (const side of [-1, 1]) {
    if (R.BRIDGES.some(b => b.river === 'hq' && Math.abs(b.s - s) < b.w / 2 + 6)) continue;
    const okP = [2.0, 2.5, 3.5, 5.0, 6.5].some(off => { const a = L.at(s, side * (F.rivers.hq.hw + off)); return R.isLand(a.x, a.z) && !R.isWater(a.x, a.z); });
    if (!okP) { const a = L.at(s, side * (F.rivers.hq.hw + 2.5)); bad.push([s, side, a.x, a.z, R.isWater(a.x, a.z), R.isLand(a.x, a.z)]); }
  }
  ok('6B both banks walkable (land in hw+2..6.5, except at bridge boxes)', bad.length <= 2, bad.slice(0, 8));
  const hs = F.houses.filter(h => h.a6b && !h.gone);
  ok('old-street houses on 6B banks (kind old, count ≥ 20)', hs.length >= 20 && hs.every(h => h.kind === 'old') && hs.some(h => h.f), { n: hs.length });
  const trees = F.trees.filter(t => t[5] === 'hq' && (t[6] === 'a6b' || t.a6b));
  // trees may be tagged only as hq; count those west of the 6A join
  const treesW = F.trees.filter(t => t[5] === 'hq' && (t[1] > 650 || t[0] < 20));
  ok('banyans line the 6B banks (west hq trees ≥ 16)', (trees.length >= 16 || treesW.length >= 16), { tagged: trees.length, west: treesW.length });
  ok('6B zone skirt uses PAVEC (a6b.zone is preferred for inA6Z / g6day)', /a6b && FZR\.a6b\.zone/.test(fsrc) && Array.isArray(A6B.zone) && A6B.zone.length === 4);
}

// 夜里：沿用 6A 细碎倒影；isHq 含 6B；g6day 覆盖西段
{ const ld = fsrc.slice(fsrc.indexOf('  lodNow(force) {'), fsrc.indexOf('  refreshTilesIfTurned() {'));
  ok('g6day enable zone unions 6B (day-only)', /gn\.g6day/.test(ld) && /a6b && FZR\.a6b\.zone/.test(ld) && /!this\.nightLod/.test(ld));
  ok('west cap collision spans the banks (0.8 thick × 56 along n, not a 0.7 m post)',
  /西头合拢：一道挡住出界的碰撞/.test(fsrc) && /0\.8, 8, 56/.test(fsrc) && /name: 'colCap'/.test(fsrc));
ok('isHq includes a6b bridges / zone; reflections stay nSeg=5, sc(WARM, 0.48), 0.62',
    /FZR\.a6b && \(FZR\.a6b\.bridges/.test(nsrc) && /nSeg = 5/.test(nsrc) && /sc\(WARM, 0\.48\)/.test(nsrc) && /hqStreak[\s\S]{0,500}0\.62/.test(nsrc));
}

if (fails.length) { console.log('FAILED', fails.join(', ')); process.exit(1); }
console.log('all 6B unit tests passed');
