// 7C：从涧田湖东口洪水填充 2D 导航栅格，检查东段两岸、涧山巷可过、命名东头合拢走不过。
import * as R from '../../js/data/fz-river.js';
const fails = [];
function ok(n, v, info) { console.log(`${v ? 'PASS' : 'FAIL'} ${n}${!v && info !== undefined ? ' ' + JSON.stringify(info) : ''}`); if (!v) fails.push(n); }
R.useNet('e');
const F = R.FZR, A7B = F.a7b, A7C = F.a7c, RV = R.RIVERS;
ok('a7c present for nav', !!(A7C && A7B && A7B.openedTo7c && A7C.capWall && A7C.sEast0));

const RES = 0.45, CLR = 0.38;
const x0 = 800, z0 = 1070, x1 = 1180, z1 = 1290;
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

const hw = A7C.hw, bankOff = hw + 2.8, s0 = A7C.sEast0;
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
  if (t[0] < x0 - 8 || t[0] > x1 + 8 || t[1] < z0 - 8 || t[1] > z1 + 8) continue;
  fillBox(t[0], t[1], 1, 0, 0.6, 0.6, block, CLR);
}
// walkable decks
for (const b of (F.bridges || [])) {
  if (!(A7C.bridges || []).includes(b.id) && !b.a7c) continue;
  fillBox(b.x, b.z, b.t[0], b.t[1], b.w, b.half * 2, walk, 0.1);
}

const seen = new Uint8Array(NX * NZ);
const snap = (x, z) => {
  let best = -1, bd = 1e9;
  const i0 = Math.floor((x - x0) / RES), j0 = Math.floor((z - z0) / RES);
  for (let j = j0 - 3; j <= j0 + 3; j++) for (let i = i0 - 3; i <= i0 + 3; i++) {
    if (i < 0 || j < 0 || i >= NX || j >= NZ) continue;
    const k = j * NX + i;
    if (!walk[k] || block[k]) continue;
    const d = Math.hypot(cx(i) - x, cz(j) - z);
    if (d < bd) { bd = d; best = k; }
  }
  return best;
};
const snapDist = (x, z, k) => k < 0 ? 99 : Math.hypot(cx(k % NX) - x, cz(Math.floor(k / NX)) - z);

function flood(seedK) {
  const q = [seedK];
  seen[seedK] = 1;
  for (let qi = 0; qi < q.length; qi++) {
    const k = q[qi], i = k % NX, j = Math.floor(k / NX);
    for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const i2 = i + di, j2 = j + dj;
      if (i2 < 0 || j2 < 0 || i2 >= NX || j2 >= NZ) continue;
      const k2 = j2 * NX + i2;
      if (seen[k2] || !walk[k2] || block[k2]) continue;
      seen[k2] = 1; q.push(k2);
    }
  }
}

// seed from the 7B outlet bank (east mouth)
const mouth = RV.yx.line.at(s0, bankOff);
let seed = snap(mouth.x, mouth.z);
if (seed < 0) {
  const mouth2 = RV.yx.line.at(s0, -bankOff);
  seed = snap(mouth2.x, mouth2.z);
}
ok('seed at east mouth is on walkable land', seed >= 0, { mouth, seed });
if (seed >= 0) flood(seed);

function reach(x, z, name, tol = 1.6) {
  const k = snap(x, z), d = snapDist(x, z, k);
  const okk = k >= 0 && seen[k] && d <= tol;
  ok(`reach ${name}`, okk, { x: +x.toFixed(2), z: +z.toFixed(2), d: +d.toFixed(2), snap: k });
  return okk;
}

reach(A7C.capBank[0], A7C.capBank[1], 'east cap bank', 1.8);
{ const [x, z] = A7C.capPast;
  const k = snap(x, z);
  const d = snapDist(x, z, k);
  const blocked = k < 0 || !seen[k] || d > 2.5;
  ok('cannot walk past named east cap', blocked, { x, z, snap: k, d: +d.toFixed(2), seen: !!(k >= 0 && seen[k]) });
}

// 涧山巷 deck should be reachable from the mouth
{ const br = (F.bridges || []).filter(b => b.style === 'jianshan');
  let n = 0;
  for (const b of br) {
    if (reach(b.x, b.z, `涧山巷 ${b.id}`, 2.2)) n++;
  }
  ok('both 涧山巷 decks are reachable from the east mouth', n === br.length && br.length === 2, { n, ids: br.map(b => b.id) });
}

let bankGaps = 0;
for (const side of [1, -1]) {
  for (let s = s0 + 8; s <= RV.yx.line.len - 12; s += 5) {
    const p = RV.yx.line.at(s, side * bankOff);
    const k = snap(p.x, p.z), d = snapDist(p.x, p.z, k);
    if (!(k >= 0 && seen[k] && d <= 1.4)) {
      bankGaps++;
      if (bankGaps <= 10) ok(`nav along-bank s=${s.toFixed(1)} side=${side}`, false, { x: +p.x.toFixed(2), z: +p.z.toFixed(2), d: +d.toFixed(2), snap: k });
    }
  }
}
ok(`along-bank 7C river both sides have no gaps (gapCount=${bankGaps})`, bankGaps === 0, { bankGaps });

if (fails.length) { console.log('FAILED', fails.length, fails.join(', ')); process.exit(1); }
console.log('All 7C nav-connectivity checks passed');
