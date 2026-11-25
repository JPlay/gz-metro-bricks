// 7B：从 7A 东头接缝洪水填充 2D 导航栅格，检查西段主河两岸、环湖步道双向、东头合拢走不过。
// 栅格规则对齐 tests/e2e/fz_river_nav.js 与 fz_river_7a_nav.mjs。
import * as R from '../../js/data/fz-river.js';
const fails = [];
function ok(n, v, info) { console.log(`${v ? 'PASS' : 'FAIL'} ${n}${!v && info !== undefined ? ' ' + JSON.stringify(info) : ''}`); if (!v) fails.push(n); }
R.useNet('e');
const F = R.FZR, A7 = F.a7a, A7B = F.a7b, RV = R.RIVERS;
ok('a7b present for nav', !!(A7B && A7 && A7.openedTo7b && A7B.loop && (F.a7c ? A7B.openedTo7c : A7B.capWall)));

const RES = 0.45, CLR = 0.38;
const x0 = 580, z0 = 750, x1 = 950, z1 = 1220;
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

const hw = A7B.hw, bankOff = hw + 2.8, end7a = A7B.yxLen7a;
for (const w of F.wall) {
  if (w[4] !== 0) continue;
  const [ax, az, bx, bz, flag, sg] = w;
  const L = Math.hypot(bx - ax, bz - az); if (L < 0.05) continue;
  const dx = (bx - ax) / L, dz = (bz - az) / L, rx = dz * sg, rz = -dx * sg;
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
// 桥面可走（两岸经桥连通）
for (const b of (F.bridges || [])) {
  if (!(b.a7b || (A7B.bridges || []).includes(b.id))) continue;
  const tx = b.t[0], tz = b.t[1];
  fillBox(b.x, b.z, tx, tz, b.w + 1.0, (b.half || (b.hw + 3)) * 2, walk, 0.06);
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

const starts = [];
for (const side of [1, -1]) {
  const p = RV.yx.line.at(end7a - 6, side * bankOff);
  const k = snap(p.x, p.z);
  ok(`7A east end bank side=${side} snaps onto the 7B nav grid`, k >= 0, p);
  starts.push(k);
}
const seen = floodFrom(starts);

for (const side of [1, -1]) {
  const p = RV.yx.line.at(Math.min(RV.yx.line.len - 8, end7a + 12), side * bankOff);
  reach(p.x, p.z, `join open into 7B side=${side}`);
}

const brs = (F.bridges || []).filter(b => b.a7b || (A7B.bridges || []).includes(b.id));
for (const b of brs) {
  for (const side of [1, -1]) {
    const p = RV.yx.line.at(b.s - b.w / 2 - 4, side * bankOff);
    reach(p.x, p.z, `${b.name || b.id} bank s-w/2-4 side=${side}`);
  }
}

ok('lake loop has enough waypoints', (A7B.loop || []).length >= 8, { n: (A7B.loop || []).length });
let loopFail = 0;
for (let i = 0; i < (A7B.loop || []).length; i++) {
  const [x, z] = A7B.loop[i];
  if (!reach(x, z, `lake loop pt${i}`, 1.4)) loopFail++;
}
ok(`lake loop waypoints all reachable from the 7A join (gapCount=${loopFail})`, loopFail === 0, { loopFail, n: A7B.loop.length });
// 双向：环湖路点同属一个连通分量，从任一点都能回到起点（无向洪水填充已覆盖 CW/CCW）
{ const a = A7B.loop[0], b = A7B.loop[Math.floor(A7B.loop.length / 2)];
  const ka = snap(a[0], a[1]), kb = snap(b[0], b[1]);
  ok('lake loop is one component (both directions share connectivity)', ka >= 0 && kb >= 0 && seen[ka] && seen[kb], { ka, kb });
}

reach(A7B.capBank[0], A7B.capBank[1], 'east cap bank', 1.6);
if (F.a7c) {
  const bank = A7B.lakeMouthBank || A7B.capBank;
  reach(bank[0], bank[1], 'lake-side mouth bank', 1.6);
  const open = A7B.mouthOpen || F.a7c.mouthOpen;
  ok('7C mouthOpen is recorded', !!(open && open.length >= 2), { open });
  if (open) reach(open[0], open[1], '7C-side bank through the open outlet (mouthOpen)', 1.8);
  // The spots that broke after the outlet opened must stay on land and in the walk.
  const pt5 = (A7B.loop || [])[5];
  if (pt5) reach(pt5[0], pt5[1], 'lake loop pt5 (outlet-side, must stay land)', 1.6);
} else {
  const [x, z] = A7B.capPast;
  const k = snap(x, z);
  const d = snapDist(x, z, k);
  const reachable = k >= 0 && seen[k] && d <= 2.5;
  ok('cannot walk past east cap (7C side is not in the walkable component)', !reachable, { x, z, snap: k, d: +d.toFixed(2), seen: !!(k >= 0 && seen[k]) });
}

let bankGaps = 0;
for (const side of [1, -1]) {
  const end7b = A7B.yxLen7b || A7B.yxLen;
  for (let s = end7a + 8; s <= end7b - 10; s += 4) {
    const p = RV.yx.line.at(s, side * bankOff);
    const k = snap(p.x, p.z), d = snapDist(p.x, p.z, k);
    if (!(k >= 0 && seen[k] && d <= 1.1)) {
      bankGaps++;
      if (bankGaps <= 10) ok(`nav along-bank s=${s.toFixed(1)} side=${side}`, false, { x: +p.x.toFixed(2), z: +p.z.toFixed(2), d: +d.toFixed(2), snap: k });
    }
  }
}
ok(`along-bank 7B river both sides have no gaps (gapCount=${bankGaps})`, bankGaps === 0, { bankGaps });

if (fails.length) { console.log('FAILED', fails.length, fails.join(', ')); process.exit(1); }
console.log('All 7B nav-connectivity checks passed');
