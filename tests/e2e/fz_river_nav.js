// e2e 用：在页面里按街区真实碰撞体建一张 0.4 m 步行栅格（陆地 + 桥面 / 台阶 / 浮码头 − 碰撞体外扩 0.45 m），A* 找路，返回世界坐标路点（给 autopilot 真走）。
async () => {
  const M = await import('/js/data/fz-river.js');
  const S = __game.fzMetro.street, R = S.kit.root.position, F = M.FZR, RES = window.__fzNavRes || 0.25, CLR = 0.38;   // 1B 河网大（约 1 × 1.5 km）：e2e 设 __fzNavRes = 0.35 省内存
  let x0 = 1e9, z0 = 1e9, x1 = -1e9, z1 = -1e9; for (const [x, z] of F.bound) { x0 = Math.min(x0, x); z0 = Math.min(z0, z); x1 = Math.max(x1, x); z1 = Math.max(z1, z); }
  x0 -= 2; z0 -= 2; const NX = Math.ceil((x1 - x0 + 4) / RES), NZ = Math.ceil((z1 - z0 + 4) / RES);
  const walk = new Uint8Array(NX * NZ), block = new Uint8Array(NX * NZ);
  const cx = i => x0 + (i + 0.5) * RES, cz = j => z0 + (j + 0.5) * RES;
  const fillTri = (ax, az, bx, bz, qx, qz, arr) => {
    const mnx = Math.max(0, Math.floor((Math.min(ax, bx, qx) - x0) / RES)), mxx = Math.min(NX - 1, Math.floor((Math.max(ax, bx, qx) - x0) / RES));
    const mnz = Math.max(0, Math.floor((Math.min(az, bz, qz) - z0) / RES)), mxz = Math.min(NZ - 1, Math.floor((Math.max(az, bz, qz) - z0) / RES));
    const s = (px, pz, ux, uz, vx, vz) => (vx - ux) * (pz - uz) - (vz - uz) * (px - ux);
    for (let j = mnz; j <= mxz; j++) for (let i = mnx; i <= mxx; i++) { const px = cx(i), pz = cz(j), d1 = s(px, pz, ax, az, bx, bz), d2 = s(px, pz, bx, bz, qx, qz), d3 = s(px, pz, qx, qz, ax, az);
      if (!((d1 < 0 || d2 < 0 || d3 < 0) && (d1 > 0 || d2 > 0 || d3 > 0))) arr[j * NX + i] = 1; }
  };
  for (const c of Object.values(F.land)) { const P = c.p, I = c.i; for (let k = 0; k < I.length; k += 3) fillTri(P[2 * I[k]], P[2 * I[k] + 1], P[2 * I[k + 1]], P[2 * I[k + 1] + 1], P[2 * I[k + 2]], P[2 * I[k + 2] + 1], walk); }
  const WALKN = /^(colDeck|colStair$|colPontoon|colLanding)/, SKIP = /^(fzrLand|fzrWater)/;
  const hull = pts => { pts.sort((a, b) => a[0] - b[0] || a[1] - b[1]); const cr = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]); const lo = [], up = [];
    for (const p of pts) { while (lo.length >= 2 && cr(lo[lo.length - 2], lo[lo.length - 1], p) <= 0) lo.pop(); lo.push(p); }
    for (const p of pts.slice().reverse()) { while (up.length >= 2 && cr(up[up.length - 2], up[up.length - 1], p) <= 0) up.pop(); up.push(p); }
    return lo.slice(0, -1).concat(up.slice(0, -1)); };
  const segD = (px, pz, ax, az, bx, bz) => { const dx = bx - ax, dz = bz - az, L = dx * dx + dz * dz || 1e-9; let t = ((px - ax) * dx + (pz - az) * dz) / L; t = Math.max(0, Math.min(1, t)); return Math.hypot(px - ax - t * dx, pz - az - t * dz); };
  const inConv = (px, pz, H) => { for (let k = 0; k < H.length; k++) { const a = H[k], b = H[(k + 1) % H.length]; if ((b[0] - a[0]) * (pz - a[1]) - (b[1] - a[1]) * (px - a[0]) < 0) return false; } return true; };
  const boatCols = new Set(S.boat ? S.boat.cols.concat(S.boat.planks || []) : []);
  let nb = 0, nw = 0;
  for (const m of S.kit.colliders) {
    if (!m || SKIP.test(m.name) || boatCols.has(m) || !m.isEnabled()) continue;
    m.computeWorldMatrix(true); const bb = m.getBoundingInfo().boundingBox, V = bb.vectorsWorld;
    const walkable = WALKN.test(m.name);
    if (!walkable && (bb.minimumWorld.y > 2.0 || bb.maximumWorld.y < -0.25 && !/Rail|Parapet/.test(m.name))) continue;
    const H = hull(V.map(v => [v.x - R.x, v.z - R.z])), r = walkable ? 0.06 : CLR, arr = walkable ? walk : block; walkable ? nw++ : nb++;
    let mnx = 1e9, mnz = 1e9, mxx = -1e9, mxz = -1e9; for (const [x, z] of H) { mnx = Math.min(mnx, x); mnz = Math.min(mnz, z); mxx = Math.max(mxx, x); mxz = Math.max(mxz, z); }
    const pad = Math.max(0, r);
    for (let j = Math.max(0, Math.floor((mnz - pad - z0) / RES)); j <= Math.min(NZ - 1, Math.floor((mxz + pad - z0) / RES)); j++)
      for (let i = Math.max(0, Math.floor((mnx - pad - x0) / RES)); i <= Math.min(NX - 1, Math.floor((mxx + pad - x0) / RES)); i++) {
        const px = cx(i), pz = cz(j), inside = inConv(px, pz, H); let d = Infinity; for (let k = 0; k < H.length; k++) { const a = H[k], b = H[(k + 1) % H.length]; d = Math.min(d, segD(px, pz, a[0], a[1], b[0], b[1])); }
        if (r >= 0 ? (inside || d <= r) : (inside && d >= -r)) arr[j * NX + i] = 1;
      }
  }
  const ok = new Uint8Array(NX * NZ); for (let k = 0; k < ok.length; k++) ok[k] = walk[k] && !block[k] ? 1 : 0;
  const idx = (x, z) => { const i = Math.floor((x - x0) / RES), j = Math.floor((z - z0) / RES); return i < 0 || j < 0 || i >= NX || j >= NZ ? -1 : j * NX + i; };
  const snap = (x, z) => { const i0 = Math.floor((x - x0) / RES), j0 = Math.floor((z - z0) / RES); for (let r = 0; r < 25; r++) { let best = -1, bd = 1e9; for (let j = j0 - r; j <= j0 + r; j++) for (let i = i0 - r; i <= i0 + r; i++) { if (i < 0 || j < 0 || i >= NX || j >= NZ || !ok[j * NX + i]) continue; const d = Math.hypot(i - i0, j - j0); if (d < bd) { bd = d; best = j * NX + i; } } if (best >= 0) return best; } return -1; };
  const los = (a, b) => { const ax = a % NX, az = (a / NX) | 0, bx = b % NX, bz = (b / NX) | 0, n = Math.ceil(Math.hypot(bx - ax, bz - az) * 2) + 1; for (let k = 0; k <= n; k++) { const i = Math.round(ax + (bx - ax) * k / n), j = Math.round(az + (bz - az) * k / n); if (!ok[j * NX + i]) return false; } return true; };
  const path = (sx, sz, tx, tz) => {   // 世界坐标进出
    sx -= R.x; sz -= R.z; tx -= R.x; tz -= R.z;
    const s = snap(sx, sz), t = snap(tx, tz); if (s < 0 || t < 0) return { ok: false, why: 'snap', s, t };
    const g = new Float32Array(NX * NZ).fill(Infinity), from = new Int32Array(NX * NZ).fill(-1), closed = new Uint8Array(NX * NZ);
    const tI = t % NX, tJ = (t / NX) | 0, h = k => Math.hypot(k % NX - tI, ((k / NX) | 0) - tJ);
    const heap = [[h(s), s]]; g[s] = 0;
    const push = e => { heap.push(e); let c = heap.length - 1; while (c > 0) { const p = (c - 1) >> 1; if (heap[p][0] <= heap[c][0]) break; [heap[p], heap[c]] = [heap[c], heap[p]]; c = p; } };
    const pop = () => { const top = heap[0], last = heap.pop(); if (heap.length) { heap[0] = last; let c = 0; for (;;) { const l = 2 * c + 1, r = l + 1; let m = c; if (l < heap.length && heap[l][0] < heap[m][0]) m = l; if (r < heap.length && heap[r][0] < heap[m][0]) m = r; if (m === c) break; [heap[m], heap[c]] = [heap[c], heap[m]]; c = m; } } return top; };
    const D = [[1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1], [1, 1, 1.414], [1, -1, 1.414], [-1, 1, 1.414], [-1, -1, 1.414]];
    let found = false, it = 0;
    while (heap.length) { const [, k] = pop(); if (closed[k]) continue; closed[k] = 1; if (k === t) { found = true; break; } if (++it > 3e6) break;
      const i = k % NX, j = (k / NX) | 0;
      for (const [di, dj, c] of D) { const ni = i + di, nj = j + dj; if (ni < 0 || nj < 0 || ni >= NX || nj >= NZ) continue; const n = nj * NX + ni; if (!ok[n] || closed[n]) continue; if (di && dj && (!ok[j * NX + ni] || !ok[nj * NX + i])) continue;
        const ng = g[k] + c; if (ng < g[n]) { g[n] = ng; from[n] = k; push([ng + h(n), n]); } } }
    if (!found) return { ok: false, why: 'nopath', it };
    const raw = []; for (let k = t; k >= 0; k = from[k]) raw.push(k); raw.reverse();
    const out = [raw[0]]; let a = 0; while (a < raw.length - 1) { let b = raw.length - 1; while (b > a + 1 && !los(raw[a], raw[b])) b--; out.push(raw[b]); a = b; }
    return { ok: true, len: +(g[t] * RES).toFixed(1), pts: out.map(k => [+(R.x + cx(k % NX)).toFixed(2), +(R.z + cz((k / NX) | 0)).toFixed(2)]) };
  };
  window.__fzNav = { path, snap: (x, z) => { const k = snap(x - R.x, z - R.z); return k < 0 ? null : [+(R.x + cx(k % NX)).toFixed(2), +(R.z + cz((k / NX) | 0)).toFixed(2)]; }, dbg: (x, z) => { const k = idx(x - R.x, z - R.z); return k < 0 ? -1 : (walk[k] ? 1 : 0) + (block[k] ? 2 : 0); }, clear: (ax, az, bx, bz) => { const a = idx(ax - R.x, az - R.z), b = idx(bx - R.x, bz - R.z); return a >= 0 && b >= 0 && ok[a] && ok[b] && los(a, b); }, isOk: (x, z) => { const k = idx(x - R.x, z - R.z); return k >= 0 && !!ok[k]; } };
  let n = 0; for (const v of ok) n += v;
  return { NX, NZ, walkCells: n, blockers: nb, walkables: nw };
}
