/*
 * 福州内河（第 1A 批：白马河 + 安泰河步行 + 东西河头一段；A 线游船 西湖码头 → 西水关码头 → 黎明湖码头）。
 * 纯数据 + 几何工具（浏览器和 Node 单元测试共用，不碰 BABYLON）。
 *   坐标 W：x 东、z 北，米；原点 = 东街口站 ÷ 3。顺河方向距离按 1:3 压缩，河宽 / 桥 / 树 / 船按 1:1（小美 ①）。
 *   河道数据由 tools/fzriver/gen.py 从 OSM 生成到 fz-river-data.js（不要手改）。
 *   水面 y = WY（-3.0），岸顶 y = 0；船：甲板 WY+0.45（= 浮码头面），篷顶 WY+2.29（小美：船上视角篷只占屏幕上方 ≤20%，篷抬高、缩短到只罩座位）。
 * 净空规则（PLAN.md）：平桥梁底 ≥ -0.4；拱桥在船篷两侧角点处的拱腹高度 ≥ 篷顶 + 0.25。
 */
import { FZR as FZR_A } from './fz-river-data.js';
import { FZR_E } from './fz-river-data-e.js';
/*
 * 两片河网（一次只建一片街区，和 FS 街口一样）：
 *   a = 1A 西线（白马河 / 安泰河 / 东西河，A 线红篷）；e = 1B 东线（晋安河 1:4 + 光明港 1:5，B 线白篷，tools/fzriver/gen_e.py）。
 *   下面的 FZR / RIVERS / ROUTE / STOPS / BRIDGES / KIOSKS / SPEED_CAP 是 ES 模块“活绑定”：useNet(id) 换成另一片，
 *   所有 import 它们的模块（fzRiver.js / fzBoat.js）下一次读到的就是新的那片。街区构造时按出口亭所在河网调用 useNet。
 */
export const NETS = { a: FZR_A, e: FZR_E };
/** 出口亭（车站 code）→ 河网 id */
export function netOfKiosk(code) { for (const [id, F] of Object.entries(NETS)) if (F.kiosks[code]) return id; return 'a'; }
export let FZR = FZR_A, NET = 'a';
export const WY = FZR_A.WY;
/** 船（米，船体局部：+z 船头、+x 右舷）。双头船：两头一样，掉头不用转身；长凳没有靠背，乘客总是朝行进方向坐 */
export const BOAT = { len: 8, beam: 2.4, deck: 0.45, gunwale: 1.0, roofUnder: 2.17, top: 2.29, canopyHalfLen: 2.6, canopyHalfW: 1.27,
  rows: [2.15, 1.3, -1.3, -2.15], seatX: 0.72, door: [-0.6, 0.6] };
export const CLEAR_MIN = 0.25;          // 篷顶与桥底最小净空
export const FLAT_SOFFIT = -0.4;        // 平桥 / 路桥梁底
export const ARCH_CROWN = -0.3;         // 拱桥拱顶（拱腹最高点）
export const CRUISE = 3.5, SLOW = 2.0, ACC = 0.5;

/** 折线：累计里程、按里程取点（含横向偏移）、投影 */
export function mkLine(flat) {
  const x = [], z = [], s = [0];
  for (let i = 0; i < flat.length; i += 2) { x.push(flat[i]); z.push(flat[i + 1]); }
  for (let i = 1; i < x.length; i++) s.push(s[i - 1] + Math.hypot(x[i] - x[i - 1], z[i] - z[i - 1]));
  const len = s[s.length - 1];
  const seg = q => { let lo = 0, hi = s.length - 1; while (hi - lo > 1) { const m = (lo + hi) >> 1; if (s[m] <= q) lo = m; else hi = m; } return lo; };
  const at = (q, lat = 0) => {
    q = Math.max(0, Math.min(len, q)); const i = Math.min(seg(q), x.length - 2), L = s[i + 1] - s[i] || 1, u = (q - s[i]) / L;
    // 切线：前后 1 m 的弦（折线拐点处也平滑）
    const a = Math.max(0, Math.min(q - 1, len - 2)), ia = Math.min(seg(a), x.length - 2), ib = Math.min(seg(a + 2), x.length - 2);
    const pa = [x[ia] + (x[ia + 1] - x[ia]) * ((a - s[ia]) / (s[ia + 1] - s[ia] || 1)), z[ia] + (z[ia + 1] - z[ia]) * ((a - s[ia]) / (s[ia + 1] - s[ia] || 1))];
    const pb = [x[ib] + (x[ib + 1] - x[ib]) * ((a + 2 - s[ib]) / (s[ib + 1] - s[ib] || 1)), z[ib] + (z[ib + 1] - z[ib]) * ((a + 2 - s[ib]) / (s[ib + 1] - s[ib] || 1))];
    let tx = pb[0] - pa[0], tz = pb[1] - pa[1]; const tl = Math.hypot(tx, tz) || 1; tx /= tl; tz /= tl;
    const nx = tz, nz = -tx;   // 右手法线（顺着走的右边）
    const px = x[i] + (x[i + 1] - x[i]) * u, pz = z[i] + (z[i + 1] - z[i]) * u;
    return { x: px + nx * lat, z: pz + nz * lat, tx, tz, nx, nz };
  };
  const project = (px, pz) => {
    let best = { d: Infinity, s: 0 };
    for (let i = 0; i < x.length - 1; i++) {
      const ax = x[i], az = z[i], dx = x[i + 1] - ax, dz = z[i + 1] - az, L2 = dx * dx + dz * dz || 1;
      const u = Math.max(0, Math.min(1, ((px - ax) * dx + (pz - az) * dz) / L2)), qx = ax + dx * u, qz = az + dz * u, d = Math.hypot(px - qx, pz - qz);
      if (d < best.d) best = { d, s: s[i] + Math.sqrt(L2) * u };
    }
    const a = at(best.s); best.lat = (px - a.x) * a.nx + (pz - a.z) * a.nz; return best;
  };
  return { x, z, s, len, at, project };
}
export let RIVERS, ROUTE, PIERS, PIER, STOPS, BRIDGES, KIOSKS, SPEED_CAP;
const CACHE = {};
/** 换河网（活绑定）；返回河网 id */
export function useNet(id) {
  if (!NETS[id]) id = 'a';
  if (!CACHE[id]) {
    const F = NETS[id], rivers = Object.fromEntries(Object.entries(F.rivers).map(([k, r]) => [k, { ...r, line: mkLine(r.p) }]));
    const route = { ...F.route, line: mkLine(F.route.p) }, pier = Object.fromEntries(F.piers.map(p => [p.id, p]));
    CACHE[id] = { F, rivers, route, piers: F.piers, pier, stops: F.route.stops.map(s => ({ ...s, pier: pier[s.id] })), bridges: F.bridges, kiosks: F.kiosks, cap: null };
  }
  const C = CACHE[id];
  NET = id; FZR = C.F; RIVERS = C.rivers; ROUTE = C.route; PIERS = C.piers; PIER = C.pier; STOPS = C.stops; BRIDGES = C.bridges; KIOSKS = C.kiosks;
  if (!C.cap) C.cap = buildSpeedCap();
  SPEED_CAP = C.cap;
  return id;
}
/** 码头顺序 = 船线里程顺序（STOPS 在 useNet 里换） */

/* ---------- 点在多边形 / 三角形 ---------- */
export function inPoly(px, pz, f) {
  let c = false;
  for (let i = 0, j = f.length / 2 - 1; i < f.length / 2; j = i++) {
    const xi = f[2 * i], zi = f[2 * i + 1], xj = f[2 * j], zj = f[2 * j + 1];
    if ((zi > pz) !== (zj > pz) && px < (xj - xi) * (pz - zi) / (zj - zi) + xi) c = !c;
  }
  return c;
}
function inTri(px, pz, ax, az, bx, bz, cx, cz) {
  const d1 = (px - bx) * (az - bz) - (ax - bx) * (pz - bz), d2 = (px - cx) * (bz - cz) - (bx - cx) * (pz - cz), d3 = (px - ax) * (cz - az) - (cx - ax) * (pz - az);
  return !(((d1 < 0) || (d2 < 0) || (d3 < 0)) && ((d1 > 0) || (d2 > 0) || (d3 > 0)));
}
function inCells(T, px, pz) {
  const c = T[Math.floor(px / FZR.cell) + ',' + Math.floor(pz / FZR.cell)]; if (!c) return false;
  const P = c.p, I = c.i;
  for (let k = 0; k < I.length; k += 3) if (inTri(px, pz, P[2 * I[k]], P[2 * I[k] + 1], P[2 * I[k + 1]], P[2 * I[k + 1] + 1], P[2 * I[k + 2]], P[2 * I[k + 2] + 1])) return true;
  return false;
}
/** 水面（河道 + 西湖一角），不含台阶 / 浮码头 */
export const isWater = (x, z) => inCells(FZR.water, x, z) && !FZR.dry.some(d => inPoly(x, z, d));
export const isLand = (x, z) => inCells(FZR.land, x, z);
export const isDry = (x, z) => FZR.dry.some(d => inPoly(x, z, d));

/** 落水后的上岸点：最近一段有栏杆缺口 / 岸线，往岸上退 1.8 m（面朝河） */
export function shoreFor(px, pz) {
  let best = null;
  for (const w of FZR.wall) {
    if (w[4] > 1) continue;
    const [ax, az, bx, bz] = w, dx = bx - ax, dz = bz - az, L2 = dx * dx + dz * dz || 1, u = Math.max(0, Math.min(1, ((px - ax) * dx + (pz - az) * dz) / L2));
    const qx = ax + dx * u, qz = az + dz * u, d = Math.hypot(px - qx, pz - qz);
    if (!best || d < best.d) { const L = Math.sqrt(L2), rx = dz / L, rz = -dx / L, sg = w[5]; best = { d, x: qx - rx * sg * 1.8, z: qz - rz * sg * 1.8, yaw: Math.atan2(rx * sg, rz * sg) }; }
  }
  return best;
}

/* ---------- 桥：桥下净空 ---------- */
/** 桥面下沿（绝对 y），v = 横跨河道的坐标（米，0 = 河中线）；不在桥下返回 null */
export function bridgeLocal(b, x, z) { const dx = x - b.x, dz = z - b.z; return { u: dx * b.t[0] + dz * b.t[1], v: dx * b.n[0] + dz * b.n[1] }; }
export function soffitAt(b, v) {
  if (b.kind === 'arch' || b.kind === 'hump') { const R = b.hw, H = ARCH_CROWN - WY, k = 1 - (v / R) ** 2; return k <= 0 ? WY : WY + H * Math.sqrt(k); }
  return FLAT_SOFFIT;
}
/** 拱桥（驼峰）桥面高：两头 0 → 中间 rise */
export const humpRise = b => b.kind === 'hump' ? (b.w > 6 ? 0.9 : 0.75) : b.kind === 'arch' ? 0.9 : 0;
export function deckAt(b, v) { const r = humpRise(b); if (!r) return 0; const k = Math.max(0, 1 - Math.abs(v) / b.half); return r * (1 - (1 - k) * (1 - k)); }

/* ---------- 船线 ---------- */
export function routePose(s) { const a = ROUTE.line.at(s); return { x: a.x, z: a.z, tx: a.tx, tz: a.tz, yaw: Math.atan2(a.tx, a.tz) }; }
/** 船篷四角 + 两侧中点（世界 W 坐标）；dir = ±1（行进方向，双头船无所谓） */
export function canopyPts(s) {
  const p = routePose(s), nx = p.tz, nz = -p.tx, L = BOAT.canopyHalfLen, W = BOAT.canopyHalfW, out = [];
  for (const [a, b] of [[-L, -W], [L, -W], [L, W], [-L, W], [0, W], [0, -W], [0, 0]]) out.push({ x: p.x + p.tx * a + nx * b, z: p.z + p.tz * a + nz * b });
  return out;
}
export function hullPts(s, inset = 0) {
  const p = routePose(s), nx = p.tz, nz = -p.tx, L = BOAT.len / 2 - inset, W = BOAT.beam / 2 - inset, out = [];
  for (const [a, b] of [[-L, -W], [L, -W], [L, W], [-L, W], [0, W], [0, -W]]) out.push({ x: p.x + p.tx * a + nx * b, z: p.z + p.tz * a + nz * b });
  return out;
}
/** 整条船线逐 step 米检查：船篷角点在桥下时的净空。返回每座经过的桥的最小净空 */
export function clearanceReport(step = 0.25) {
  const top = WY + BOAT.top, per = {};
  for (let s = 0; s <= ROUTE.line.len; s += step) {
    for (const q of canopyPts(s)) for (const b of BRIDGES) {
      const { u, v } = bridgeLocal(b, q.x, q.z);
      if (Math.abs(u) > b.w / 2 || Math.abs(v) > b.half) continue;
      const gap = soffitAt(b, v) - top;
      if (!per[b.id] || gap < per[b.id].gap) per[b.id] = { gap: +gap.toFixed(3), s: +s.toFixed(2), v: +v.toFixed(2), kind: b.kind, name: b.name };
    }
  }
  const gaps = Object.values(per).map(x => x.gap);
  return { per, min: gaps.length ? Math.min(...gaps) : Infinity, ok: gaps.every(g => g >= CLEAR_MIN) };
}
/** 船线上每米的限速：过桥 / 急弯慢行 */
function buildSpeedCap() {
  // 速度分区：A 线没有 zones（全程 3.5、过桥 2.0，和 1A 一样）；B 线见 gen_e.py ZONES（晋安河 3.5，光明港开阔段 5.5，过桥 / 进出码头 3.5）
  const Z = ROUTE.zones || {}, n = Math.ceil(ROUTE.line.len) + 1, cap = new Array(n).fill(Z.cruise || CRUISE);
  if (Z.fast) for (let i = Math.ceil(Z.fast[0]); i <= Math.min(n - 1, Z.fast[1]); i++) cap[i] = Z.vFast;
  const vBridge = Z.vBridge || SLOW;
  for (let i = 0; i < n; i++) {
    const p = routePose(i);
    for (const b of BRIDGES) { const { u, v } = bridgeLocal(b, p.x, p.z); if (Math.abs(u) < b.w / 2 + 10 && Math.abs(v) < b.half + 2) cap[i] = Math.min(cap[i], vBridge); }
    if (Z.vPier) for (const st of STOPS) if (Math.abs(i - st.s) < Z.pierZone) cap[i] = Math.min(cap[i], Z.vPier);
    // 转弯半径（前后 4 m 的切线夹角）
    const a = routePose(Math.max(0, i - 4)), c = routePose(Math.min(ROUTE.line.len, i + 4)), da = Math.abs(Math.atan2(a.tx * c.tz - a.tz * c.tx, a.tx * c.tx + a.tz * c.tz));
    if (da > 0.02) { const R = 8 / da; cap[i] = Math.min(cap[i], Math.max(1.2, Math.sqrt(0.7 * R))); }
  }
  // 前后平滑：限速变化不超过 ACC 能追上的
  for (let i = n - 2; i >= 0; i--) cap[i] = Math.min(cap[i], Math.sqrt(cap[i + 1] ** 2 + 2 * ACC * 1));
  for (let i = 1; i < n; i++) cap[i] = Math.min(cap[i], Math.sqrt(cap[i - 1] ** 2 + 2 * ACC * 1));
  return cap;
}
/** 行船一步（fzBoat.js 每帧调用；单测按同一套逻辑积分出单程时间）。b = { s, v, dir, target }；到站返回 true（调用方把 s 放到站点） */
export function goStep(b, dt) {
  const goal = STOPS[b.target].s, rem = (goal - b.s) * b.dir;
  const vStop = Math.sqrt(Math.max(0, 2 * ACC * 0.9 * (rem - 0.05)));
  const vMax = Math.min(speedCap(b.s), vStop), dv = vMax - b.v;
  b.v += Math.max(-1.0 * dt, Math.min(ACC * dt, dv)); if (b.v < 0) b.v = 0;
  if (rem < 0.08 || (rem < 0.6 && b.v < 0.12)) return true;
  b.s += b.v * dt * b.dir; if (b.v < 0.15 && rem > 0.6) b.v = 0.15;   // 别停在半路（限速平滑后末段也至少蠕动）
  return false;
}
export const BOAT_DWELL = 3.0;   // 坐下后几秒开船
export const BOAT_STAY = 9;      // 中途站停靠（坐着的乘客有 9 秒点「起身」；小美定，B 线单程压到 8 分钟内）
/** 坐着不下船从站 i0 到 i1 的时间（秒，dt 1/60）：起点坐下等 BOAT_DWELL + 各段行船 + 中途站 BOAT_STAY */
export function runTime(i0, i1, dt = 1 / 60) {
  const dir = Math.sign(i1 - i0); let t = BOAT_DWELL, legs = [];
  for (let i = i0; i !== i1; i += dir) {
    const b = { s: STOPS[i].s, v: 0, dir, target: i + dir }; let lt = 0, vmax = 0;
    while (!goStep(b, dt)) { lt += dt; vmax = Math.max(vmax, b.v); if (lt > 3600) break; }
    legs.push({ from: STOPS[i].id, to: STOPS[i + dir].id, secs: +lt.toFixed(1), vmax: +vmax.toFixed(2) }); t += lt + (i + dir !== i1 ? BOAT_STAY : 0);
  }
  return { secs: +t.toFixed(1), legs };
}
useNet('a');
export const speedCap = s => SPEED_CAP[Math.max(0, Math.min(SPEED_CAP.length - 1, Math.round(s)))];
/** 下一站：从站序号 i 往 dir 方向 */
export function nextStop(i, dir) { const j = i + dir; return j >= 0 && j < STOPS.length ? j : i - dir; }
/** 码头牌上的“下一站”：两头只有一个方向，中间两个方向 */
export function pierNext(id) { const i = STOPS.findIndex(s => s.id === id); return [STOPS[i - 1], STOPS[i + 1]].filter(Boolean).map(s => s.pier); }

/* ---------- 坐船视角：同时看得见几座桥（小美：任何时刻 ≤ 2 座）---------- */
/** 船上坐着的视点（W 坐标 + 高度）：前排靠窗、船中、第三人称（后上方 1.7 m）；朝行进方向 */
// fov = 第一人称竖直视角（player.js FOV_FIRST），aspect 取 16:9（比 iPad 1.44 更宽，偏保守）；
// dist = “认得出是一座桥”的距离 150 m（桥面 + 栏杆约 1.4 m 高，150 m 外在 820 px 高的屏上不到 8 px、桥跨不到 10°）。相机 maxZ 是 420 m（只算视锥会多到 5 座，见 1B 报告）
export const VIEW = { fov: 1.0, aspect: 16 / 9, eyeY: WY + 0.45 + 1.1, thirdBack: 1.7, thirdUp: 0.8, dist: 150, maxZ: 420 };
/**
 * 从船线里程 s、行进方向 dir 看过去，视锥里、视线不被岸挡住的桥（不算桥挡桥、不算房子 / 树挡：偏保守，只会多算）。
 * 视线挡判定：视线经过岸地（不是水面 / 台阶 / 浮码头）时，若那一点视线高度低于岸顶（y = 0）就算被驳岸挡住 —— 人坐在船上眼睛比岸低 1.45 m。
 * 桥的取样点：桥面两侧栏杆顶（y = +1.0），横跨河道每 2 m 一点（只取河面上方 |v| ≤ hw + 1）。
 */
export function bridgesInView(s, dir, o = {}) {
  const V = { ...VIEW, ...o }, p = routePose(s), fx = p.tx * dir, fz = p.tz * dir, nx = fz, nz = -fx;
  const hf = Math.atan(Math.tan(V.fov / 2) * V.aspect), vf = V.fov / 2;
  const eyes = [[0, 2.0, V.eyeY], [0.72, 2.0, V.eyeY], [-0.72, 2.0, V.eyeY], [0, -V.thirdBack, V.eyeY + V.thirdUp]].map(([lx, lz, y]) => ({ x: p.x + fx * lz + nx * lx, z: p.z + fz * lz + nz * lx, y }));
  const seen = new Set();
  const losClear = (e, tx, ty, tz) => {
    const L = Math.hypot(tx - e.x, tz - e.z), n = Math.max(1, Math.ceil(L / 1.5));
    for (let i = 1; i < n; i++) { const t = i / n, x = e.x + (tx - e.x) * t, z = e.z + (tz - e.z) * t, y = e.y + (ty - e.y) * t; if (y < 0.02 && isLand(x, z) && !isDry(x, z)) return false; }
    return true;
  };
  for (const b of BRIDGES) {
    const dc = Math.hypot(b.x - p.x, b.z - p.z); if (dc > V.dist + b.half + b.w) continue;
    let vis = false;
    for (const e of eyes) {
      for (let v = 0; v <= b.hw + 1 && !vis; v += 2) for (const sv of v ? [-1, 1] : [1]) for (const su of [-1, 1]) {
        if (vis) break;
        const tx = b.x + b.t[0] * su * b.w / 2 + b.n[0] * sv * v, tz = b.z + b.t[1] * su * b.w / 2 + b.n[1] * sv * v, ty = 1.0;
        const dx = tx - e.x, dz = tz - e.z, d = Math.hypot(dx, dz); if (d > V.dist || d < 0.01) continue;
        const fwd = dx * fx + dz * fz, side = dx * nx + dz * nz; if (fwd <= 0.05) continue;
        if (Math.abs(Math.atan2(side, fwd)) > hf) continue;
        if (Math.abs(Math.atan2(ty - e.y, fwd)) > vf + 0.04) continue;   // 正头顶的桥（人在桥下）不在画面里
        if (losClear(e, tx, ty, tz)) vis = true;
      }
      if (vis) break;
    }
    if (vis) seen.add(b.id);
  }
  return [...seen];
}
