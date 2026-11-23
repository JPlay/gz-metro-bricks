// 7A：从斗门 C 岸道洪水填充 2D 导航栅格，检查 e2e 关键路点在同一连通分量
// 栅格规则对齐 tests/e2e/fz_river_nav.js（land 可走；colDeck/colStair 可走；flag=0 岸墙 / colCulvertLane / colCurb / colFlyRamp / colCulvertTube / 房屋 / 树干为阻挡，外扩 CLR）。
import * as R from '../../js/data/fz-river.js';
import fs from 'node:fs';
const fails = [];
function ok(n, v, info) { console.log(`${v ? 'PASS' : 'FAIL'} ${n}${!v && info !== undefined ? ' ' + JSON.stringify(info) : ''}`); if (!v) fails.push(n); }
R.useNet('e');
const F = R.FZR, A7 = F.a7a, RV = R.RIVERS;
const fsrc = fs.readFileSync(new URL('../../js/world/fzRiver.js', import.meta.url), 'utf8');

ok('culvert GAPS / zebra-to-bank / fly-ramp gap are in a7a.py and fzRiver.js',
  fsrc.includes('bankT') && fsrc.includes('colCulvertLane') && /tInner|hw \+ 2\.8/.test(fsrc)
  && fs.readFileSync(new URL('../../tools/fzriver/a7a.py', import.meta.url), 'utf8').includes('涵洞是跨河公路'));

const RES = 0.45, CLR = 0.38;
const x0 = 280, z0 = 330, x1 = 740, z1 = 910;
const NX = Math.ceil((x1 - x0) / RES), NZ = Math.ceil((z1 - z0) / RES);
const walk = new Uint8Array(NX * NZ), block = new Uint8Array(NX * NZ);
const cx = i => x0 + (i + 0.5) * RES, cz = j => z0 + (j + 0.5) * RES;
const idx = (x, z) => {
  const i = Math.floor((x - x0) / RES), j = Math.floor((z - z0) / RES);
  return (i < 0 || j < 0 || i >= NX || j >= NZ) ? -1 : j * NX + i;
};

const fillTri = (ax, az, bx, bz, qx, qz, arr) => {
  const mnx = Math.max(0, Math.floor((Math.min(ax, bx, qx) - x0) / RES));
  const mxx = Math.min(NX - 1, Math.floor((Math.max(ax, bx, qx) - x0) / RES));
  const mnz = Math.max(0, Math.floor((Math.min(az, bz, qz) - z0) / RES));
  const mxz = Math.min(NZ - 1, Math.floor((Math.max(az, bz, qz) - z0) / RES));
  const s = (px, pz, ux, uz, vx, vz) => (vx - ux) * (pz - uz) - (vz - uz) * (px - ux);
  for (let j = mnz; j <= mxz; j++) for (let i = mnx; i <= mxx; i++) {
    const px = cx(i), pz = cz(j), d1 = s(px, pz, ax, az, bx, bz), d2 = s(px, pz, bx, bz, qx, qz), d3 = s(px, pz, qx, qz, ax, az);
    if (!((d1 < 0 || d2 < 0 || d3 < 0) && (d1 > 0 || d2 > 0 || d3 > 0))) arr[j * NX + i] = 1;
  }
};
for (const c of Object.values(F.land)) {
  const P = c.p, I = c.i;
  for (let k = 0; k < I.length; k += 3) fillTri(P[2 * I[k]], P[2 * I[k] + 1], P[2 * I[k + 1]], P[2 * I[k + 1] + 1], P[2 * I[k + 2]], P[2 * I[k + 2] + 1], walk);
}

function fillBox(x, z, tx, tz, alongT, alongN, arr, pad) {
  const nx = tz, nz = -tx;
  const hx = tx * (alongT / 2 + pad), hz = tz * (alongT / 2 + pad);
  const wx = nx * (alongN / 2 + pad), wz = nz * (alongN / 2 + pad);
  const pts = [[x - hx - wx, z - hz - wz], [x + hx - wx, z + hz - wz], [x + hx + wx, z + hz + wz], [x - hx + wx, z - hz + wz]];
  fillTri(pts[0][0], pts[0][1], pts[1][0], pts[1][1], pts[2][0], pts[2][1], arr);
  fillTri(pts[0][0], pts[0][1], pts[2][0], pts[2][1], pts[3][0], pts[3][1], arr);
}
function fillSeg(ax, az, bx, bz, halfW, arr, pad) {
  const dx = bx - ax, dz = bz - az, L = Math.hypot(dx, dz) || 1;
  fillBox((ax + bx) / 2, (az + bz) / 2, dx / L, dz / L, L, halfW * 2, arr, pad);
}

const hw = A7.hw, bankOff = hw + 2.8;
for (const w of F.wall) {
  if (w[4] !== 0) continue;
  const [ax, az, bx, bz, flag, sg] = w;
  const L = Math.hypot(bx - ax, bz - az); if (L < 0.05) continue;
  const dx = (bx - ax) / L, dz = (bz - az) / L, rx = dz * sg, rz = -dx * sg; // r 朝水；碰撞向岸移 0.12
  fillBox((ax + bx) / 2 - rx * 0.12, (az + bz) / 2 - rz * 0.12, dx, dz, L, 0.3, block, CLR);
}
for (const h of (F.houses || [])) {
  if (h.gone) continue;
  if (h.x < x0 - 20 || h.x > x1 + 20 || h.z < z0 - 20 || h.z > z1 + 20) continue;
  const tx = h.t ? h.t[0] : Math.sin(h.ry || 0), tz = h.t ? h.t[1] : Math.cos(h.ry || 0);
  fillBox(h.x, h.z, tx, tz, h.w, h.d, block, CLR);
}
for (const t of (F.trees || [])) {
  if (t[5] === 'gone') continue;
  const x = t[0], z = t[1];
  if (x < x0 || x > x1 || z < z0 || z > z1) continue;
  fillBox(x, z, 1, 0, 0.45, 0.45, block, CLR);
}

for (const c of A7.culverts) {
  const rt = c.t, rn = c.n, along = c.along, w = c.w, walkW = c.walk || 2.5, rampL = c.rampL || 6;
  const ZW = Math.min(3.0, Math.max(2.4, along * 0.18)), bankT = hw + 2.8, dY = c.deckY || 1.2;
  for (const su of [-1, 1]) {
    fillBox(c.x + rn[0] * su * (w / 2 - walkW / 2), c.z + rn[1] * su * (w / 2 - walkW / 2), rt[0], rt[1], along + 0.4, walkW, walk, 0.06);
  }
  for (const sv of [-1, 1]) {
    const tInner = along / 2 - ZW, tOuter = along / 2 + 0.3;
    const tuCol = sv * (tInner + tOuter) / 2, tLen = tOuter - tInner;
    fillBox(c.x + rt[0] * tuCol, c.z + rt[1] * tuCol, rt[0], rt[1], tLen, w, walk, 0.06);
    const tuVis = sv * (along / 2 - ZW / 2);
    const v0 = along / 2, v1 = along / 2 + rampL, Len = Math.hypot(rampL, dY);
    const midV = sv * (v0 + v1) / 2;
    const runW = rampL + 2.8, LenW = Math.hypot(runW, dY), midW = sv * (along / 2 + runW / 2);
    fillBox(c.x + rt[0] * midW, c.z + rt[1] * midW, rt[0], rt[1], LenW, walkW, walk, 0.06); // t-axis sidewalk ramp extended to e2e 坡底
    const tFoot = sv * (along / 2 + rampL + 1.4);
    fillBox(c.x + rt[0] * tFoot, c.z + rt[1] * tFoot, rt[0], rt[1], 3.2, w + 0.4, walk, 0.06);
    const tLo = v0, tHi = v1, gap0 = bankT - ZW / 2 - 0.2, gap1 = bankT + ZW / 2 + 0.2;
    const segs = [];
    if (tLo < gap0) segs.push([tLo, Math.min(gap0, tHi)]);
    if (tHi > gap1) segs.push([Math.max(gap1, tLo), tHi]);
    for (const [a, b] of segs) {
      if (b - a < 0.4) continue;
      const mid = sv * (a + b) / 2, slen = (b - a) * (Len / rampL);
      fillBox(c.x + rt[0] * mid, c.z + rt[1] * mid, rt[0], rt[1], slen, w - 2 * walkW, block, CLR);
    }
  }
  for (const su of [-1, 1]) {
    const nHi = su * (w / 2 - walkW / 2), nLo = su * (w / 2 + 5.0), nMid = (nHi + nLo) / 2;
    const run = Math.abs(nLo - nHi), sLen = Math.hypot(run, dY);
    const shTRoad = along + 1.0, shTWing = along + 2 * rampL + 1.0;
    fillBox(c.x + rn[0] * nMid, c.z + rn[1] * nMid, rn[0], rn[1], sLen, shTRoad, walk, 0.06);
    const nHiW = su * (w / 2 + 0.2), nMidW = (nHiW + nLo) / 2, runWsh = Math.abs(nLo - nHiW);
    fillBox(c.x + rn[0] * nMidW, c.z + rn[1] * nMidW, rn[0], rn[1], Math.hypot(runWsh, dY), shTWing, walk, 0.06);
    fillBox(c.x + rn[0] * nLo, c.z + rn[1] * nLo, rn[0], rn[1], 2.8, shTWing + 0.2, walk, 0.06);
  }
  const midLen = Math.max(1.0, along - 2 * ZW - 2 * CLR - 1.2);
  fillBox(c.x, c.z, rt[0], rt[1], midLen, w - 2 * walkW, block, CLR);
  for (const su of [-1, 1]) {
    fillBox(c.x + rn[0] * su * (w / 2 - walkW), c.z + rn[1] * su * (w / 2 - walkW), rt[0], rt[1], midLen, 0.2, block, CLR);
  }
}

const okG = new Uint8Array(NX * NZ);
for (let k = 0; k < okG.length; k++) okG[k] = walk[k] && !block[k] ? 1 : 0;

function snap(x, z) {
  const i0 = Math.floor((x - x0) / RES), j0 = Math.floor((z - z0) / RES);
  for (let r = 0; r < 16; r++) {
    let best = -1, bd = 1e9;
    for (let j = j0 - r; j <= j0 + r; j++) for (let i = i0 - r; i <= i0 + r; i++) {
      if (i < 0 || j < 0 || i >= NX || j >= NZ || !okG[j * NX + i]) continue;
      const d = Math.hypot(i - i0, j - j0); if (d < bd) { bd = d; best = j * NX + i; }
    }
    if (best >= 0) return best;
  }
  return -1;
}

function floodFrom(starts) {
  const seen = new Uint8Array(NX * NZ), q = [];
  for (const s of starts) { if (s >= 0 && !seen[s]) { seen[s] = 1; q.push(s); } }
  for (let qi = 0; qi < q.length; qi++) {
    const k = q[qi], i = k % NX, j = (k / NX) | 0;
    for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]]) {
      if (di && dj && (!okG[j * NX + (i + di)] || !okG[(j + dj) * NX + i])) continue;
      const ni = i + di, nj = j + dj;
      if (ni < 0 || nj < 0 || ni >= NX || nj >= NZ) continue;
      const n = nj * NX + ni; if (!okG[n] || seen[n]) continue;
      seen[n] = 1; q.push(n);
    }
  }
  return seen;
}
const startA = RV.jn.line.at(A7.host.s - 25, F.rivers.jn.hw + 2.6);
const startB = RV.jn.line.at(A7.host.s - 25, -(F.rivers.jn.hw + 2.6));
const startSeam = snap(A7.cams.seam.x, A7.cams.seam.z);
const sA = snap(startA.x, startA.z), sB = snap(startB.x, startB.z);
ok('斗门 C bank +lat (jn host-25, hw+2.6) snaps onto the nav grid', sA >= 0, startA);
ok('斗门 C bank -lat snaps onto the nav grid', sB >= 0, startB);
ok('seam camera snaps onto the nav grid', startSeam >= 0, A7.cams.seam);
const seen = floodFrom([sA, sB]);
// 汇入口同岸（+lat / 机位）应能走到 seam；洋下河路点在另一岸经涵洞/岸道连通，两岸起步都应算「斗门 C 岸」。
ok('C +lat bank reaches seam camera', startSeam >= 0 && !!seen[startSeam]);
function snapDist(x, z, k) {
  if (k < 0) return 99;
  return Math.hypot(cx(k % NX) - x, cz((k / NX) | 0) - z);
}
function reach(x, z, label, maxSnap = 1.2) {
  const k = snap(x, z);
  const d = snapDist(x, z, k);
  const r = k >= 0 && !!seen[k] && d <= maxSnap;
  ok(`nav reaches ${label}`, r, { x: +x.toFixed(2), z: +z.toFixed(2), snap: k, d: +d.toFixed(2) });
  return r;
}

const tipS = Math.min(RV.yx.line.len - 8, A7.official.namedWestTip / 4);
for (const side of [1, -1]) {
  const p = RV.yx.line.at(tipS, side * bankOff);
  reach(p.x, p.z, `named west tip bank side=${side}`);
}
// e2e 只查 六一北路 / 夏莲路 / 涧田路 的斑马与岸道（晋安北路在汇入口斜交，e2e 不过那条斑马）
const e2eNames = new Set(['六一北路', '夏莲路', '涧田路']);
for (const c of A7.culverts) {
  const along = c.along, ZW = Math.min(3.0, Math.max(2.4, along * 0.18)), w = c.w, walkW = c.walk || 2.5;
  const name = c.roadName || c.id;
  if (e2eNames.has(name)) {
    for (const sv of [-1, 1]) {
      const tu = sv * (along / 2 - ZW / 2);
      for (const su of [-1, 1]) {
        const nv = su * (w / 2 - walkW / 2);
        const x = c.x + c.t[0] * tu + c.n[0] * nv, z = c.z + c.t[1] * tu + c.n[1] * nv;
        reach(x, z, `${name} zebra sv=${sv} sidewalk su=${su}`);
      }
    }
  }
  if (c.s >= 20) {
    for (const side of [1, -1]) {
      const p = RV.yx.line.at(c.s - 8, side * bankOff);
      reach(p.x, p.z, `${name} bank s-8 side=${side}`);
    }
  }
}
for (const side of [1, -1]) {
  const p = RV.yx.line.at(20, side * bankOff);
  reach(p.x, p.z, `yx bank s=20 side=${side} (past 晋安北路)`);
}

const E = A7.express.main;
for (const side of [1, -1]) {
  const p = RV.yx.line.at(E.s, side * (hw + 3.2));
  reach(p.x, p.z, `expressway underside side=${side}`);
}
{
  const p = RV.yx.line.at(RV.yx.line.len - 2, bankOff);
  reach(p.x, p.z, 'east cap bank');
}

// 沿岸步道密采样：snap 必须近，避免路点落到孤立垫板上算通过，而真实走线在夏莲路被抬高 colDeck 挡住
let bankGaps = 0;
for (const side of [1, -1]) {
  for (let s = 20; s <= tipS; s += 2) {
    const p = RV.yx.line.at(s, side * bankOff);
    const k = snap(p.x, p.z), d = snapDist(p.x, p.z, k);
    if (!(k >= 0 && seen[k] && d <= 0.9)) {
      bankGaps++;
      if (bankGaps <= 8) ok(`nav along-bank s=${s} side=${side}`, false, { x: +p.x.toFixed(2), z: +p.z.toFixed(2), d: +d.toFixed(2), snap: k });
    }
  }
}
ok(`along-bank s=20…tip both sides have no gaps (gapCount=${bankGaps})`, bankGaps === 0, { bankGaps });

if (fails.length) { console.log('FAILED', fails.length, fails.join(', ')); process.exit(1); }
console.log('All 7A nav-connectivity checks passed');
