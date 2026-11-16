// Offline pop-in probe: 60 fps yaw schedules, count in-frustum-but-undrawn tile tris.
// Uses the same stale rule as 小美's popin.py (unpadded box in current frustum, not intended det-cull, not past fog).
import fs from 'node:fs'; import vm from 'node:vm';
globalThis.window = globalThis; globalThis.self = globalThis;
const mkEl = () => new Proxy(function(){}, { get: (t, k) => k === Symbol.toPrimitive ? () => 0 : k === 'then' ? undefined : mkEl(), apply: () => mkEl(), construct: () => mkEl(), set: () => true });
globalThis.document = mkEl(); globalThis.localStorage = { getItem: () => null, setItem() {} };
globalThis.addEventListener = () => {}; globalThis.location = { search: '', href: 'http://x/', hash: '' }; globalThis.matchMedia = () => ({ matches: false, addEventListener() {} });
globalThis.requestAnimationFrame = () => 0; globalThis.Image = function () { return mkEl(); };
const root = process.argv[2] || '/workspace/gz-fzsmall';
vm.runInThisContext(fs.readFileSync(root + '/vendor/babylonjs/9.28.0/babylon.js', 'utf8'));
const S = await import(root + '/js/game/fzService.js');
const { BRIDGES, deckAt } = await import(root + '/js/data/fz-river.js');
const eng = new BABYLON.NullEngine({ renderWidth: 1112, renderHeight: 834 });
const scene = new BABYLON.Scene(eng);
const st = S.FZ_SVC.street(scene, 'fzxm', { n: 'C', x: 10, line: 1, road: 'r', to: ['a'], toEn: ['a'], attr: 'fzriver' });
const cam = new BABYLON.UniversalCamera('c', new BABYLON.Vector3(0, 0, 0), scene);
cam.fov = 0.8; cam.minZ = 0.1; cam.maxZ = 2000; scene.activeCamera = cam;
const PAD = 24, NEAR_KEEP = 28, B = BABYLON;
const hits = (min, max, planes, pad) => {
  for (const pl of planes) {
    const n = pl.normal;
    const x = n.x > 0 ? max.x - pad : min.x + pad, y = n.y > 0 ? max.y - pad : min.y + pad, z = n.z > 0 ? max.z - pad : min.z + pad;
    if (n.x * x + n.y * y + n.z * z + pl.d < 0) return false;
  }
  return true;
};
const TC = st.tileCull;
if (!TC) { console.error('no tileCull'); process.exit(1); }
TC.list.forEach(it => { it._inc = null; });
const orig = TC.update.bind(TC);
TC.update = function (c, opts = {}) {
  const before = TC.list.map(it => it.key);
  orig(c, opts);
  const planes = B.Frustum.GetPlanes(c.getScene().getTransformMatrix());
  const pos = c.position, px = opts.px != null ? opts.px : pos.x, pz = opts.pz != null ? opts.pz : pos.z, detR = opts.detR, detOn = opts.detOn !== false;
  TC.list.forEach((it, k) => {
    if (it.key === null || it.key === before[k]) return;
    const inc = new Uint8Array(it.tiles.length);
    if (!(it.det && !detOn)) it.tiles.forEach((t, j) => {
      const d = Math.hypot(t.cx - px, t.cz - pz);
      if (it.det && detR && d > detR && d >= NEAR_KEEP) return;
      if (d < NEAR_KEEP || hits(t.min, t.max, planes, 0)) inc[j] = 1;
    });
    it._inc = inc; it._opts = { px, pz, detR, detOn };
  });
};

function staleCheck() {
  const planes = B.Frustum.GetPlanes(scene.getTransformMatrix()), cp = cam.position;
  const fogEnd = scene.fogMode ? scene.fogEnd : 1e9;
  let n = 0, tris = 0, dmin = 1e9, worst = null;
  TC.list.forEach(it => {
    const m = it.mesh;
    if (!(!m.parent || m.parent.isEnabled())) return;
    if (m.isVisible === false || !it._inc) return;
    const o = it._opts;
    it.tiles.forEach((t, j) => {
      if (it._inc[j] && !it.hid) return;
      if (it.det && (!o.detOn || (o.detR && Math.hypot(t.cx - o.px, t.cz - o.pz) > o.detR && Math.hypot(t.cx - o.px, t.cz - o.pz) >= NEAR_KEEP))) return;
      if (!hits(t.min, t.max, planes, PAD)) return;
      const bx = Math.max(t.min.x + PAD - cp.x, 0, cp.x - t.max.x + PAD), bz = Math.max(t.min.z + PAD - cp.z, 0, cp.z - t.max.z + PAD), d = Math.hypot(bx, bz);
      if (d > fogEnd) return;
      n++; tris += t.i.length / 3;
      if (d < dmin) { dmin = d; worst = { mesh: m.name, cx: Math.round(t.cx), cz: Math.round(t.cz), d: Math.round(d), tris: t.i.length / 3 }; }
    });
  });
  return { n, tris, dmin: n ? Math.round(dmin) : null, worst };
}

function placeGate() {
  const x = -70.55, z = -199.75, tx = -80, tz = -202.9;
  const wx = st.wx(x), wz = st.wz(z);
  cam.position.set(wx, 1.6, wz);
  cam.rotation.set(0.08, Math.atan2(st.wx(tx) - wx, st.wz(tz) - wz), 0);
  st.pl = { position: cam.position.clone() };
}
function placeJindou() {
  const b = BRIDGES.find(br => br.id === 'at4');
  const y = deckAt(b, 0) + 1.6, tx = b.x - b.t[0] * 40, tz = b.z - b.t[1] * 40;
  const wx = st.wx(b.x), wz = st.wz(b.z);
  cam.position.set(wx, y, wz);
  cam.rotation.set(0.08, Math.atan2(st.wx(tx) - wx, st.wz(tz) - wz), 0);
  st.pl = { position: cam.position.clone() };
}
function placeCleg2() {
  const b = st.boats.C, s0 = b.s0 ?? b.s;
  b.s = s0 + 30 * b.dir; b.place(0); const p = b.pose(); b.node.computeWorldMatrix(true);
  const wp = b.node.getAbsolutePosition();
  cam.position.set(wp.x, wp.y + 1.2, wp.z);
  cam.rotation.set(0.08, Math.atan2(p.tx * b.dir, p.tz * b.dir), 0);
  st.pl = { position: new BABYLON.Vector3(wp.x, wp.y + 1.2, wp.z) };
}

function schedTurn(y0, dy, nturn, nhold, tag) {
  const s = [];
  for (let i = 0; i < 30; i++) s.push({ yaw: y0, tag: 'pre' });
  for (let i = 0; i < nturn; i++) s.push({ yaw: y0 + dy * (i + 1) / nturn, tag: tag || 'turn' });
  for (let i = 0; i < nhold; i++) s.push({ yaw: y0 + dy, tag: 'hold' });
  s.push({ yaw: y0 + dy, tag: 'truth', inval: true, lod: true });
  return s;
}

function runCase(name, sched, mode) {
  // mode: 'old' = only 0.25s lodNow; 'new' = refreshTilesIfTurned after cam write + 0.25s lodNow
  st.lodT = 0; st.lodNow(true);
  let staleFrames = 0, afterHold = 0, maxTris = 0, minD = null, worst = null, run = 0, best = 0;
  const DT = 1 / 60;
  for (const s of sched) {
    cam.rotation.y = s.yaw;
    if (s.inval) TC.list.forEach(it => { it.key = null; });
    if (s.lod) st.lodNow(false);
    if (mode === 'old') {
      st.lodT -= DT; if (st.lodT <= 0) { st.lodT = 0.25; st.lodNow(false); }
    } else {
      st.lodT -= DT; if (st.lodT <= 0) { st.lodT = 0.25; st.lodNow(false); }
      st.refreshTilesIfTurned();
    }
    scene.updateTransformMatrix(true);
    cam.getViewMatrix(true);
    scene.setTransformMatrix(cam.getViewMatrix(true), cam.getProjectionMatrix(true));
    const stl = staleCheck();
    if (stl.n) {
      staleFrames++;
      if (s.tag === 'hold') afterHold++;
      if (stl.tris > maxTris) { maxTris = stl.tris; worst = stl; }
      if (minD == null || stl.dmin < minD) minD = stl.dmin;
      run++; best = Math.max(best, run);
    } else run = 0;
  }
  const out = { name, mode, frames: sched.length, staleFrames, staleFramesAfterTurn: afterHold, maxStaleTris: maxTris, minStaleDist: minD, longestStaleRunFrames: best, longestStaleRunSec: +(best / 60).toFixed(3), worst };
  console.log(JSON.stringify(out));
  return out;
}

const cases = {
  "turn180_0.2s": (y0) => schedTurn(y0, Math.PI, 12, 36),
  "turn180back_0.2s": (y0) => schedTurn(y0 + Math.PI, -Math.PI, 12, 36),
  "turn90_0.1s": (y0) => schedTurn(y0, Math.PI / 2, 6, 36),
  "spin360_0.5s": (y0) => schedTurn(y0, 2 * Math.PI, 30, 36, 'spin'),
  "spin720_1.0s_ccw": (y0) => schedTurn(y0, -4 * Math.PI, 60, 36, 'spin')
};

const locs = [['gate_west', placeGate], ['jindou_at4', placeJindou], ['cleg2_d30', placeCleg2]];
const results = { day: {} };
if (st.night) st.night.set(false);
for (const [loc, place] of locs) {
  place();
  const y0 = cam.rotation.y;
  results.day[loc] = {};
  const modes = process.env.COMPARE === '1' ? ['old', 'new'] : ['new'];
  for (const mode of modes) {
    for (const [cn, mk] of Object.entries(cases)) {
      place();
      results.day[loc][mode + '/' + cn] = runCase(loc + '/' + cn, mk(y0), mode);
    }
  }
}
const outp = process.argv[3] || '/workspace/fzriver/c3/popin_offline.json';
fs.writeFileSync(outp, JSON.stringify(results, null, 1));
console.log('WROTE', outp);
const bad = [];
for (const [loc, casesR] of Object.entries(results.day)) {
  for (const [k, v] of Object.entries(casesR)) {
    if (k.startsWith('new/') && (v.staleFrames > 1 || v.maxStaleTris > 0 && v.longestStaleRunFrames > 1)) bad.push(k + ' ' + JSON.stringify({ staleFrames: v.staleFrames, maxStaleTris: v.maxStaleTris, run: v.longestStaleRunFrames }));
  }
}
if (bad.length) { console.error('FAIL stale after fix', bad); process.exit(1); }
console.log('POPIN OFFLINE PASS (new path staleFrames ≤ 1)');
