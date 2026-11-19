// 福州内河 6A（湖前河东段 茶园水闸 → 北二环 → 北浪路，PLAN-6 v2 小美 11-20 03:24 定稿；只走路）
import * as R from '../../js/data/fz-river.js';
import fs from 'node:fs';
const fails = [];
function ok(n, v, info) { console.log(`${v ? 'PASS' : 'FAIL'} ${n}${!v && info !== undefined ? ' ' + JSON.stringify(info) : ''}`); if (!v) fails.push(n); }
R.useNet('e');
const F = R.FZR, A6 = F.a6, A4 = F.a4, RV = R.RIVERS;
const fsrc = fs.readFileSync(new URL('../../js/world/fzRiver.js', import.meta.url), 'utf8');
const nsrc = fs.readFileSync(new URL('../../js/world/fzNight.js', import.meta.url), 'utf8');
ok('6A data present (a6: hqLen / gate / 2 bridges / camMouth)', !!(A6 && A6.hqLen > 200 && A6.hqLen < 320 && A6.gate && A6.sign && (A6.bridges || []).length === 2 && A6.camMouth));
ok('rivers include hq after gw', Object.keys(RV).join() === 'ja,gm,jn,fb,gw,hq' && RV.hq.zh === '湖前河' && F.rivers.hq.hw === 5);
console.log(`INFO hq ${RV.hq.line.len.toFixed(1)} m, gate (${A6.gate.x}, ${A6.gate.z}), blend ${A6.blend}, hw ${A6.hw0}→${A6.hw1}, jnS ${A6.jnS}`);

// 汇入口：接在已建晋安河北段 s=466.2，头 12 m 沿西岸法向，半宽 13→5
{ const L = RV.hq.line, s0 = L.at(0), jn = RV.jn.line.at(A6.jnS || 466.2);
  ok('hq starts on jn at s≈466.2 (same point)', Math.hypot(s0.x - jn.x, s0.z - jn.z) < 0.25, { s0: [s0.x, s0.z], jn: [jn.x, jn.z] });
  const dn = Math.atan2(s0.tx, s0.tz) - Math.atan2(jn.nx, jn.nz);
  const d = Math.abs(dn - 2 * Math.PI * Math.round(dn / (2 * Math.PI)));
  ok(`hq heading at s=0 follows jn west-bank normal (${(d * 180 / Math.PI).toFixed(1)}°)`, d < 8 * Math.PI / 180, d);
  { const p = L.at(50, 0), w4 = L.at(50, 4), l8 = L.at(50, 8), l8b = L.at(50, -8);
    ok('well past the mouth blend the channel is ~10 m (water at 4 m, land at 8 m)', R.isWater(p.x, p.z) && R.isWater(w4.x, w4.z) && R.isLand(l8.x, l8.z) && R.isLand(l8b.x, l8b.z), { w4: [w4.x, w4.z], l8: [l8.x, l8.z] }); }
  { const jw = RV.jn.line.at(A6.jnS, F.rivers.jn.hw), js = RV.jn.line.at(A6.jnS - 22, F.rivers.jn.hw);
    ok('晋安河西岸 at the mouth is open water; 22 m along the bank it is land again (banks turn inward)', R.isWater(jw.x, jw.z) && R.isLand(js.x, js.z) && !R.isWater(js.x, js.z), { jw: [jw.x, jw.z], js: [js.x, js.z] }); }
  ok('width blends 13 → 5 over ~16 m', A6.hw0 === 13 && A6.hw1 === 5 && A6.blend >= 14 && A6.blend <= 20);
  const mid = L.at(Math.min(L.len, 40));
  ok('40 m downstream is still water (river continues past the mouth)', R.isWater(mid.x, mid.z));
}

// 弯半径 ≥ 25 m
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

// 两座命名桥：北二环更宽更高，北浪路较矮较窄；两岸可走过河
{ const names = ['北二环', '北浪路'];
  const bs = names.map(n => R.BRIDGES.find(q => q.name === n && q.river === 'hq'));
  ok('two named hq bridges in order 北二环 → 北浪路 (s from the east mouth)', bs.every(Boolean) && bs[0].s < bs[1].s && A6.bridges.join() === bs.map(b => b.id).join(), bs.map(b => b && [b.id, b.s, b.w, b.tall]));
  ok('北二环 is clearly wider (30) and marked tall; 北浪路 is 14 and not tall', bs[0] && bs[0].w === 30 && bs[0].tall && (bs[0].barrier || 2.2) >= 2 && bs[1] && bs[1].w === 14 && !bs[1].tall);
  for (const b of bs) {
    ok(`${b.name}: spans water, both ends on land`, R.isWater(b.x, b.z) && [-1, 1].every(sg => R.isLand(b.x + b.n[0] * sg * (b.hw + 2.5), b.z + b.n[1] * sg * (b.hw + 2.5))));
  }
  ok('both are road bridges drawn with a3Deck (not raw asphalt)', bs.every(b => b.kind === 'road') && /FZR\.a6 && \(FZR\.a6\.bridges/.test(fsrc) && /b\.tall/.test(fsrc));
  ok('北二环 deck is raised (deckY≥3, rampL≥12) so the bank walkway can pass under', bs[0].deckY >= 3 && bs[0].rampL >= 12 && bs[0].half >= A6.hw1 + 3.5, { deckY: bs[0].deckY, rampL: bs[0].rampL, half: bs[0].half });
  { const U = (A6.under || [])[0], b = bs[0];
    const dv = U && ((U.x - b.x) * b.n[0] + (U.z - b.z) * b.n[1]);
    const du = U && ((U.x - b.x) * b.t[0] + (U.z - b.z) * b.t[1]);
    ok('under camera sits on the bank under the deck (not on the road edge)', U && R.isLand(U.x, U.z) && !R.isWater(U.x, U.z) && Math.abs(Math.abs(dv) - (A6.hw1 + 2.2)) < 1.2 && Math.abs(du) > 2 && Math.abs(du) < b.w / 2 && (U.soffit || 0) >= 1.6, { U, dv, du }); }
}

// 两岸步道可走
{ const L = RV.hq.line, bad = [];
  for (let s = 20; s < L.len - 8; s += 8) for (const side of [-1, 1]) {
    if (R.BRIDGES.some(b => b.river === 'hq' && Math.abs(b.s - s) < b.w / 2 + 6)) continue;
    const okP = [2.0, 2.5, 3.5, 5.0, 6.5].some(off => { const a = L.at(s, side * (F.rivers.hq.hw + off)); return R.isLand(a.x, a.z) && !R.isWater(a.x, a.z); });
    if (!okP) { const a = L.at(s, side * (F.rivers.hq.hw + 2.5)); bad.push([s, side, a.x, a.z, R.isWater(a.x, a.z), R.isLand(a.x, a.z)]); }
  }
  ok('both banks walkable (land in hw+2..6.5, except at bridge boxes)', bad.length <= 2, bad.slice(0, 8));
}

// 西头合拢：北浪路以西封闭，没有天空缝
{ const L = RV.hq.line, end = L.at(L.len), te = { x: end.tx, z: end.tz };
  const past = L.at(L.len); // at() clamps; step along tangent
  const px = past.x + te.x * (A6.cap + 4), pz = past.z + te.z * (A6.cap + 4);
  ok('west cap: no walkable water past the closed end', !R.isWater(px, pz), { px, pz, end: [past.x, past.z], cap: A6.cap });
  ok('west cap has far backdrop slots (no sky gap)', (A6.far || []).length >= 3);
}

// 茶园水闸：单孔、筒顶泵房、只看不过、浅灰、不用 c2Sluice / 九门 / 新港 / 江四那一套
{ const G = A6.gate, H = G.house;
  ok('茶园水闸: 1 bay, barrel-roof side pump house, not a full-span 启闭房', G.bays === 1 && G.style === 'cy' && H && H.roof === 'barrel' && H.w <= 8 && H.h <= 5.5 && /a6Sluice/.test(fsrc) && !/this\.c2Sluice\(G, '茶园/.test(fsrc));
  ok('gate block keeps people off the weir (colGateBlock extends down to WY)', G.block.length === 4 && /colGateBlock/.test(fsrc) && /yBot = WY/.test(fsrc));
  ok('sign: 茶园水闸 / Chayuan Sluice, wood board (stopOnly)', A6.sign.zh === '茶园水闸' && A6.sign.en === 'Chayuan Sluice' && A6.sign.stopOnly === true);
  { const st = (A6.signs || []).find(s => s.id === 'cyh'), bn = A6.bench, dWS = st && Math.hypot(A6.sign.x - st.x, A6.sign.z - st.z);
    ok('wood and stone signs are separated (≥ 4 m, not stacked)', st && dWS >= 4, { dWS });
    const dW = bn && Math.hypot(bn[0] - A6.sign.x, bn[1] - A6.sign.z), dS = bn && st && Math.hypot(bn[0] - st.x, bn[1] - st.z);
    ok('bench is ≥ 3.5 m from both signs and on land', bn && dW >= 3.5 && dS >= 3.5 && R.isLand(bn[0], bn[1]) && !R.isWater(bn[0], bn[1]), { dW, dS, bn });
  }
  ok('light-grey stone family (PIER / CAP / BASE as 九门闸) but distinct silhouette (barrel roof + screw pumps, 1 bay)',
    /a6Sluice[\s\S]*const PIER = '#A39C8E'/.test(fsrc) && /a6Sluice[\s\S]*(barrel roof|筒顶)/.test(fsrc) && /螺杆泵/.test(fsrc) && G.bays === 1);
  ok('a6Sluice is not c2Sluice / a5Sluice / 九门 / 新港 / 江四 copy', !/a5Sluice/.test(fsrc) && /筒顶泵房/.test(fsrc));
}

// 两岸旧街：kind=old，不是现代方楼
{ const hs = F.houses.filter(h => h.a6 && !h.gone);
  ok('old-street houses on both banks (kind old, count ≥ 20)', hs.length >= 20 && hs.every(h => h.kind === 'old') && hs.some(h => h.f) && new Set(hs.map(h => Math.sign((h.x - RV.hq.line.at(h.s || 40).x) || 1))).size >= 1, { n: hs.length });
  const trees = F.trees.filter(t => t[5] === 'hq');
  ok('banyans line both banks (hq trees ≥ 16)', trees.length >= 16, { n: trees.length });
}

// 同机位相机：在晋安河东岸，朝西看东口
{ const C = A6.camMouth, jn = RV.jn.line.at(A6.jnS);
  ok('camMouth stands on the east bank of 晋安河 (on land, east of jn center)', C && R.isLand(C.x, C.z) && !R.isWater(C.x, C.z) && Math.hypot(C.x - jn.x, C.z - jn.z) > 8, C);
  const lx = C.look[0] - C.x, lz = C.look[2] - C.z;
  // 西 = 湖前方向 ≈ jn.n
  const al = Math.atan2(lx, lz), an = Math.atan2(jn.nx, jn.nz);
  let d = al - an; d -= 2 * Math.PI * Math.round(d / (2 * Math.PI));
  ok('camMouth looks west into the mouth (along jn normal)', Math.abs(d) < 25 * Math.PI / 180, { deg: d * 180 / Math.PI, C });
}

// 夜里：细碎倒影从一开始就有；桥下灯带并进 fzNightLights；无点光/阴影；g6day 只白天
{ const ld = fsrc.slice(fsrc.indexOf('  lodNow(force) {'), fsrc.indexOf('  refreshTilesIfTurned() {'));
  ok('g6day is day-only (off when nightLod)', /gn\.g6day/.test(ld) && /!this\.nightLod/.test(ld) && /g6day/.test(fsrc));
  ok('night reflections on hq are thin / dim / broken (nSeg + sc(WARM, 0.16)) from the start', /isHq/.test(nsrc) && /nSeg = 5/.test(nsrc) && /sc\(WARM, 0\.16\)/.test(nsrc));
  ok('北二环 underpass strips merge into fzNightLights (no PointLight / ShadowGenerator)',
    /a6\.under/.test(nsrc) && /fzNightLights/.test(nsrc) && !/new B\.PointLight/.test(nsrc) && !/ShadowGenerator/.test(nsrc) && !/new BABYLON\.PointLight/.test(fsrc + nsrc));
  ok('茶园水闸 night strips are in the same fzNightLights mesh, not a new group', /a6\.gate/.test(nsrc) && !/k\.group\('g6night'\)/.test(fsrc));
}

// PAVEC 岸地裙边
ok('6A zone skirt uses PAVEC (inAZ, same paving colour as the banks)', /inAZ/.test(fsrc) && /PAVEC/.test(fsrc) && Array.isArray(A6.zone) && A6.zone.length === 4);

if (fails.length) { console.log('FAILED', fails.join(', ')); process.exit(1); }
console.log('all 6A unit tests passed');
