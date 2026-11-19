// 福州内河 5（瀛洲河 → 江四水闸 + 闽江远景，PLAN-5 v2 小美 11-19 19:13 定稿；只走路）
import * as R from '../../js/data/fz-river.js';
import fs from 'node:fs';
const fails = [];
function ok(n, v, info) { console.log(`${v ? 'PASS' : 'FAIL'} ${n}${!v && info !== undefined ? ' ' + JSON.stringify(info) : ''}`); if (!v) fails.push(n); }
R.useNet('e');
const F = R.FZR, A5 = F.a5, A4 = F.a4, J = JSON.stringify, RV = R.RIVERS;
const fsrc = fs.readFileSync(new URL('../../js/world/fzRiver.js', import.meta.url), 'utf8');
const nsrc = fs.readFileSync(new URL('../../js/world/fzNight.js', import.meta.url), 'utf8');
ok('5 data present (a5: yzLen / gate / mj / sign / 3 bridges)', !!(A5 && A5.yzLen > 200 && A5.yzLen < 260 && A5.gate && A5.mj && A5.sign && (A5.bridges || []).length === 3));
ok('rivers include yz after gw', Object.keys(RV).join() === 'ja,gm,jn,fb,gw,yz' && RV.yz.zh === '瀛洲河' && F.rivers.yz.hw === 9);
console.log(`INFO yz ${RV.yz.line.len.toFixed(1)} m, gate (${A5.gate.x}, ${A5.gate.z}), blend ${A5.blend}, hw ${A5.hw0}→${A5.hw1}`);

// 汇入口：和 4A 同位置同朝向，头 15–20 m 缓宽
{ const Y = A4.yz, L = RV.yz.line, s0 = L.at(0);
  ok('yz starts at the 4A mouth (same c)', Math.hypot(s0.x - Y.c[0], s0.z - Y.c[1]) < 0.15, { s0: [s0.x, s0.z], c: Y.c });
  const da = Math.atan2(s0.tx, s0.tz) - Math.atan2(Y.d[0], Y.d[1]);
  const d = Math.abs(da - 2 * Math.PI * Math.round(da / (2 * Math.PI)));
  ok(`yz heading at s=0 matches 4A mouth dir (${(d * 180 / Math.PI).toFixed(1)}°)`, d < 3 * Math.PI / 180, d);
  { const p = L.at(6, 0), w4 = L.at(6, 4), l8 = L.at(6, 8), l8b = L.at(6, -8);
    ok('opening half-width still ~6.5 m at s=6 (water at 4 m off-axis, land at 8 m)', R.isWater(p.x, p.z) && R.isWater(w4.x, w4.z) && R.isLand(l8.x, l8.z) && R.isLand(l8b.x, l8b.z), { w4: [w4.x, w4.z], l8: [l8.x, l8.z] }); }
  ok('after the 18 m blend the river is ~18 m wide (hw 9)', A5.hw0 === 6.5 && A5.hw1 === 9 && A5.blend >= 15 && A5.blend <= 20);
  const mid = L.at(Math.min(L.len, 40));
  ok('40 m downstream is still water (river continues, not a cap)', R.isWater(mid.x, mid.z));
}

// 三座命名桥，两岸可走，桥面可过
{ const names = ['老药洲街', '瀛洲桥', '台江路'];
  const bs = names.map(n => R.BRIDGES.find(q => q.name === n && q.river === 'yz'));
  ok('three named yz bridges in order 老药洲街 → 瀛洲桥 → 台江路', bs.every(Boolean) && bs[0].s < bs[1].s && bs[1].s < bs[2].s && A5.bridges.join() === bs.map(b => b.id).join(), bs.map(b => b && [b.id, b.s, b.kind]));
  for (const b of bs) {
    ok(`${b.name}: spans water, both ends on land`, R.isWater(b.x, b.z) && [-1, 1].every(sg => R.isLand(b.x + b.n[0] * sg * (b.hw + 2.5), b.z + b.n[1] * sg * (b.hw + 2.5))));
  }
  ok('老药洲街 and 台江路 are road (a3Deck), 瀛洲桥 is foot', bs[0].kind === 'road' && bs[2].kind === 'road' && bs[1].kind === 'foot');
}

// 两岸步道：沿河两侧岸带是陆地
{ const L = RV.yz.line, bad = [];
  for (let s = 8; s < L.len - 8; s += 8) for (const side of [-1, 1]) {
    if (R.BRIDGES.some(b => b.river === 'yz' && Math.abs(b.s - s) < b.w / 2 + 6)) continue;
    const okP = [2.0, 2.5, 3.5, 5.0, 6.5].some(off => { const a = L.at(s, side * (F.rivers.yz.hw + off)); return R.isLand(a.x, a.z) && !R.isWater(a.x, a.z); });
    if (!okP) { const a = L.at(s, side * (F.rivers.yz.hw + 2.5)); bad.push([s, side, a.x, a.z, R.isWater(a.x, a.z), R.isLand(a.x, a.z)]); }
  }
  ok('both banks walkable (land in hw+2..6.5, except at bridge boxes)', bad.length <= 2, bad.slice(0, 8));
}

// 江四水闸：2 孔、有侧泵房、只看不过、浅灰、不用 c2Sluice
{ const G = A5.gate, H = G.house;
  ok('江四水闸: 2 bays, has a side pump house, not a full-span 启闭房', G.bays === 2 && H && H.w <= 10 && H.h <= 7 && /a5Sluice/.test(fsrc) && !/this\.c2Sluice\(G, '江四/.test(fsrc) && !/启闭房/.test(fsrc.slice(fsrc.indexOf('a5Sluice'), fsrc.indexOf('a5Day'))));
  ok('gate block keeps people off the weir (colGateBlock)', G.block.length === 4 && /colGateBlock/.test(fsrc));
  ok('sign: 江四水闸 / Jiangsi Sluice, wood board (stopOnly)', A5.sign.zh === '江四水闸' && A5.sign.en === 'Jiangsi Sluice' && A5.sign.stopOnly === true);
  const mid = Lmid(G);
  function Lmid(G) { return G.block.reduce((a, q) => [a[0] + q[0] / 4, a[1] + q[1] / 4], [0, 0]); }
  ok('front view is upstream of the weir (looking toward 闽江)', (G.view[0] - G.x) * G.t[0] + (G.view[1] - G.z) * G.t[1] < 0);
  ok('light-grey stone family (same PIER / CAP / BASE as 九门闸)', /a5Sluice[\s\S]*const PIER = '#A39C8E'/.test(fsrc) && /a5Sluice[\s\S]*#B5AE9F/.test(fsrc) && /a5Sluice[\s\S]*#9A9385/.test(fsrc));
}

// 闽江远景：宽水面，对岸远，不是内河
{ const J = A5.mj, [af, b0, b1] = J.far;
  ok('闽江 far water: wider than an inner canal (half-span ≥ 300 m, far bank ≥ 150 m), lower than the inland river', b1 - b0 >= 600 && af >= 150 && J.lv < F.WY && J.shore.length >= 4 && J.water && J.water.p.length >= 6);
  const [o0, o1] = J.o, [tx, tz] = J.t, [nx, nz] = J.n;
  const cx = o0 + tx * (af * 0.4), cz = o1 + tz * (af * 0.4);
  ok('闽江 surface is not walkable (isWater false in the far basin)', !R.isWater(cx, cz));
  ok('a5Day draws a far-bank ground strip + embankment + skyline (bluish-grey, no warm whites)', /a5Day\(\)/.test(fsrc) && /对岸地面/.test(fsrc) && /#7E8C99/.test(fsrc.slice(fsrc.indexOf('a5Day'))) && !/#D9D2C4|#E3D9C6/.test(fsrc.slice(fsrc.indexOf('a5Day'), fsrc.indexOf('a5Day') + 1800)));
}

// 夜里 draw ≤ 昼：g5day 只白天；灯带并进已有网格
{ const ld = fsrc.slice(fsrc.indexOf('  lodNow(force) {'), fsrc.indexOf('  refreshTilesIfTurned() {'));
  ok('g5day (yz glints + 闽江 skyline): day-only group, off whenever nightLod', /if \(FZR\.a5\) \{ this\.a5Day\(\); k\.group\('g5day'\); \}/.test(fsrc) && /gn\.g5day\) \{ const Z = FZR\.a5\.zone, on = !this\.nightLod/.test(ld));
  ok('g5day skips tileCull (stable day count)', /g5day\.getChildMeshes\(\)/.test(fsrc) && /noTileCull: true/.test(fsrc));
  ok('yz glints not in the always-on water loop', /FZR\.a5 && id === 'yz'/.test(fsrc));
  ok('no PointLight / ShadowGenerator in a5Static / a5Day / a5Sluice', !/a5Static[\s\S]{0,2500}(PointLight|ShadowGenerator)/.test(fsrc) && !/a5Day[\s\S]{0,2500}(PointLight|ShadowGenerator)/.test(fsrc) && !/a5Sluice[\s\S]{0,3500}(PointLight|ShadowGenerator)/.test(fsrc));
  ok('night: 江四 strips merged into the existing lights() mesh (gable eave + weir pads as a row of dots)', /FZR\.a5 && FZR\.a5\.gate/.test(nsrc) && /H\.w \/ 2 - 0\.22/.test(nsrc) && /0\.24, H\.d \/ 2/.test(nsrc) && /sc\(WARM, 1\.05\)/.test(nsrc) && /0\.18, 0\.55/.test(nsrc));
  ok('night: still a single lights mesh, no extra Mesh / PointLight', (nsrc.match(/new B\.Mesh\(/g) || []).length === 1 && !/PointLight|ShadowGenerator/.test(nsrc));
  ok('night: skip bridge water reflection next to 江四 too', /FZR\.a5 && FZR\.a5\.gate/.test(nsrc.slice(nsrc.indexOf('nearSluice'), nsrc.indexOf('nearSluice') + 280)));
}

// 只走路
ok('walk only: routes B + D unchanged, no new piers / kiosks / boat', Object.keys(R.ROUTES).join() === 'B,D' && !R.PIERS.some(p => p.a5) && !Object.values(R.KIOSKS).some(k => k.a5));

// 落水回岸
{ const bad = []; const L = RV.yz.line; for (let s = 3; s < L.len - 3; s += 6) for (const l of [-4, 0, 4]) { const p = L.at(s, l); if (!R.isWater(p.x, p.z)) continue; const c = R.shoreFor(p.x, p.z); if (!c || !R.isLand(c.x, c.z)) bad.push([s, l, p.x, p.z]); }
  ok('fall in on yz → shoreFor lands on the bank', !bad.length, bad.slice(0, 5)); }

// 圈：三座桥两端都在 A5.loop 里
ok('e2e loop anchors: each of the three bridges has both ends', (A5.loop || []).length === 6 && ['老药洲街', '瀛洲桥', '台江路'].every(n => A5.loop.filter(q => q.name === n).length === 2));

console.log(fails.length ? `\n${fails.length} FAILED: ${fails.join(', ')}` : '\nALL PASS');
process.exit(fails.length ? 1 : 0);
