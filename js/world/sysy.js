/*
 * 中山纪念堂园区（2 号线纪念堂站 C 出口 → 沿东风中路往东 → 南门楼进园）。按真实布局、约 1:2 缩小：
 *   东风中路北侧：蓝琉璃瓦重檐“南门楼”（三孔拱门、朱红铁门）+ 两侧石柱铁花围栏，把整个园子围起来；
 *   中轴线：南门 → 大草坪中间的大道 → 孙中山先生铜像 → 纪念堂（八角宫殿，宝蓝琉璃瓦）→ 越秀山上的中山纪念碑；
 *   大道东西两侧大草坪 + 一对云鹤华表；纪念堂东北边 350 多岁的“木棉王”（满树红花）；四周榕树、白兰。
 * 资料：维基百科“中山纪念堂 (广州市)”、5000 言《中华地理》“中山纪念堂”（沿中轴线依次为门亭、铜像、纪念堂、纪念碑；华表在南门大草坪东西两侧）、
 *   人民日报海外版 2021-11-08《吾堂中山》（总占地 6.1 万 m²，堂高 48.63 m，南北纵深 72.65 m，大堂跨度 71 m 不设一柱）、
 *   美篇 / 旅游攻略对南门楼“屋宇式三孔大拱门、朱色铁门、重檐、宝蓝色琉璃瓦”、铁花围墙的描述。
 * 坐标：园区中轴 x = AX，纪念堂中心 (HALL.x, HALL.z)，正门朝 -z（朝东风中路）。纪念堂沿用原来的积木模型，
 *   用 Geo 的整体缩放（xz ×1.5、y ×1.15）放大到真实比例（宽:高 ≈ 65:48）。
 * 性能：园区单独一个 Kit（站里在地面时才启用），只用合批的静态桶 + 烘焙暗影，不加灯；树用低面数版本。
 */
import { hex } from '../core/geo.js';
import * as D from './decor.js';

export const AX = 72;
export const HALL = { x: AX, z: 24 };
const X0 = HALL.x, Z0 = HALL.z, HS = 1.5, HY = 1.15;
const TX = x => X0 + (x - X0) * HS, TZ = z => Z0 + (z - Z0) * HS;
const T8 = Math.PI / 8;                  // tess=8 的圆柱转 22.5°：正好有一个面朝 -z
const AP = Math.cos(T8);                  // 外接圆半径 → 边心距
const C = {
  stone: hex('#D9D3C5'), stone2: hex('#C9C2B2'), wall: hex('#F3ECDD'), red: hex('#B3302A'), red2: hex('#8F2219'),
  gold: hex('#E3B341'), teal: hex('#2F6E73'), blue: hex('#1F5BB0'), blue2: hex('#2C70C6'), ridge: hex('#163F7C'),
  glass: hex('#2B4C6E'), bronze: hex('#6A5636'), bronze2: hex('#4F4027'), plaza: hex('#E4DED2'), curb: hex('#C9CBCC'),
  iron: hex('#2B2F33'), granite: hex('#CFC9BC'), grit: hex('#D8D0C0')
};
const HSZ0 = Z0 - 13.4;                   // 模型坐标里的台阶脚
/** 台阶脚下（世界坐标） */
export const HALL_STEPS_Z = TZ(HSZ0);
/** 正门墙面（大红门）所在 z；走到门口 = 进入纪念堂内部 */
export const HALL_WALL_Z = TZ(Z0 - 9.6 * AP);
export const HALL_TOP_Y = 1.2 * HY;
export const HALL_ENTRY = { x0: X0 - 2.0, x1: X0 + 2.0, z0: HALL_WALL_Z - 0.75, z1: HALL_WALL_Z + 0.5, y0: HALL_TOP_Y - 0.4 };
/** 到达点：铜像和台阶之间（台阶前的金色圈）；区域 = 到达判定 */
export const HALL_DOOR = { x: X0, z: HALL_STEPS_Z - 2.2, y: 0, zone: { x0: X0 - 6, x1: X0 + 6, z0: HALL_STEPS_Z - 4.4, z1: HALL_STEPS_Z + 0.6 } };
export const GATE = { x: AX, z0: -60.9, z1: -55.3 };            // 门楼退到人行道后面（人行道 z -64..-61.5 可以一直走过去）
export const PARK = { x0: 16, x1: 128, z0: -58.6, z1: 66 };
export const STATUE = { x: AX, z: HALL_STEPS_Z - 9.5 };
export const KAPOK = { x: AX + 31, z: Z0 + 13 };

/** 在 (cx,cz) 周围按 s（水平）/ sy（竖直）放大地搭一组积木：Geo 桶整体变换，碰撞 / 楼梯 / 牌子手动换算 */
function scaledBuild(k, cx, cz, s, sy, fn) {
  const xf = { cx, cz, s, sy }, Tx = x => cx + (x - cx) * s, Tz = z => cz + (z - cz) * s;
  const gs = ['paint', 'gloss', 'pave', 'shade', 'glass', 'metal', 'grass'].map(n => k.g(n));
  const on = () => gs.forEach(g => { g.xf = xf; }), off = () => gs.forEach(g => { g.xf = null; });
  const H = Object.create(k);
  H.col = (x, y, z, w, h, d, o = {}) => k.col(Tx(x), y * sy, Tz(z), w * s, h * sy, d * s, o);
  H.colSlab = (x0, x1, y0, y1, z0, z1, o) => H.col((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2, Math.abs(x1 - x0), Math.abs(y1 - y0), Math.abs(z1 - z0), o);
  H.stairs = (axis, a, ya, b, yb, w0, w1, baseY, col, o) => { off(); const r = axis === 'z' ? k.stairs(axis, Tz(a), ya * sy, Tz(b), yb * sy, Tx(w0), Tx(w1), baseY * sy, col, o) : k.stairs(axis, Tx(a), ya * sy, Tx(b), yb * sy, Tz(w0), Tz(w1), baseY * sy, col, o); on(); return r; };
  H.sign = (x, y, z, o) => { off(); k.sign(Tx(x), y * sy, Tz(z), { ...o, w: o.w * s, h: o.h * s, hang: o.hang === undefined ? undefined : o.hang * sy }); on(); };
  on(); try { fn(H); } finally { off(); }
}

/** 整个园区：k = 园区自己的 Kit */
export function buildSysy(k) {
  scaledBuild(k, X0, Z0, HS, HY, buildHall);
  grounds(k);
  gate(k);
  fences(k);
  scaledBuild(k, STATUE.x, STATUE.z, 1.45, 1.45, H => statueGroup(H, STATUE.x, STATUE.z));
  for (const sx of [-1, 1]) scaledBuild(k, AX + sx * 13, -26, 0.85, 0.85, H => huabiao(H, AX + sx * 13, -26));
  kapok(k, KAPOK.x, KAPOK.z);
  backdrop(k);
  return { door: HALL_DOOR, statue: STATUE, kapok: KAPOK, gate: GATE, hall: HALL };
}

/** 纪念堂本体（模型坐标，scaledBuild 负责放大） */
function buildHall(k) {
  const HSZ = HSZ0;
  const P = k.solid, Gl = k.g('gloss'), Pv = k.g('pave'), S = k.shade;
  // ---------- 台基（两级，八角）----------
  const R0 = 12.6, R1 = 11.4;
  Pv.cyl(X0, 0.3, Z0, R0 * 2, 0.6, C.stone2, 8, T8, 0, 0, undefined, { ao: false });
  Pv.cyl(X0, 0.9, Z0, R1 * 2, 0.6, C.stone, 8, T8, 0, 0, undefined, { ao: false });
  // 八角形碰撞：两块正交长方体 + 一块转 45° 的方块（边长 0.7s：角不超出八角的边心距，否则南边的尖角会挡在正门口）
  for (const [r, h] of [[R0, 0.6], [R1, 1.2]]) { const s = 2 * r * AP; k.col(X0, h / 2, Z0, s * 0.83, h, s); k.col(X0, h / 2, Z0, s, h, s * 0.83); k.col(X0, h / 2, Z0, s * 0.7, h, s * 0.7, { ry: Math.PI / 4 }); }
  S.shadeRing(X0, Z0, R0 * AP, R0 * AP + 1.6, 0.012, 0.28, 32);
  // 汉白玉栏杆（台基上沿一圈矮栏，正门处断开）
  for (let f = 0; f < 8; f++) {
    const th = f * Math.PI / 4, nx = Math.cos(th), nz = Math.sin(th), tx = -nz, tz = nx, half = R1 * Math.sin(T8) - 0.3, r = R1 * AP - 0.25;
    const isDoor = Math.abs(nz + 1) < 1e-3 || Math.abs(nx) > 0.999;
    for (let u = -half; u <= half + 1e-3; u += 1.2) {
      if (isDoor && Math.abs(u) < 5.6) continue;
      P.box(X0 + nx * r + tx * u, 1.55, Z0 + nz * r + tz * u, 0.22, 0.7, 0.22, C.wall, 0, 0, 0, 1, { ao: false });
    }
    const segs = isDoor ? [[-half, -5.6], [5.6, half]] : [[-half, half]];
    for (const [u0, u1] of segs) { const um = (u0 + u1) / 2, L = u1 - u0; P.box(X0 + nx * r + tx * um, 1.86, Z0 + nz * r + tz * um, L, 0.12, 0.16, C.wall, -Math.atan2(tz, tx), 0, 0, 1, { ao: false }); }
  }
  // 正面大台阶（0 → 1.2m）
  k.stairs('z', HSZ, 0, Z0 - R1 * AP + 0.2, 1.2, X0 - 4.2, X0 + 4.2, 0, C.stone, { rails: false, nosing: '#B8B1A2' });
  for (const sx of [-1, 1]) { Pv.slab(X0 + sx * 4.2 - 0.3, X0 + sx * 4.2 + 0.3, 0, 1.45, HSZ, Z0 - R1 * AP + 0.4, C.stone2); k.colSlab(X0 + sx * 4.2 - 0.3, X0 + sx * 4.2 + 0.3, 0, 1.45, HSZ, Z0 - R1 * AP + 0.4); }
  // ---------- 墙身 ----------
  const RW = 9.6, yW0 = 1.2, yW1 = 7.6, aw = RW * AP;
  P.cyl(X0, (yW0 + yW1) / 2, Z0, RW * 2, yW1 - yW0, C.wall, 8, T8, 0, 0, undefined, { aoTop: true });
  P.cyl(X0, yW0 + 0.3, Z0, RW * 2 + 0.3, 0.6, C.stone2, 8, T8, 0, 0, undefined, { ao: false });
  { const s = 2 * aw; k.col(X0, (yW0 + yW1) / 2, Z0, s * 0.83, yW1 - yW0, s); k.col(X0, (yW0 + yW1) / 2, Z0, s, yW1 - yW0, s * 0.83); k.col(X0, (yW0 + yW1) / 2, Z0, s * 0.7, yW1 - yW0, s * 0.7, { ry: Math.PI / 4 }); }
  // 每个面：门廊面（南、东、西）开大红门；其余面两扇高窗（红框 + 深蓝玻璃 + 白窗棂）
  const porticoFaces = [Math.PI * 1.5, 0, Math.PI];
  for (let f = 0; f < 8; f++) {
    const th = f * Math.PI / 4, nx = Math.cos(th), nz = Math.sin(th), tx = -nz, tz = nx, ry = -Math.atan2(tz, tx);
    const at = (u, w) => [X0 + nx * (aw + w) + tx * u, Z0 + nz * (aw + w) + tz * u];
    if (porticoFaces.some(a => Math.abs(Math.cos(a) - nx) < 1e-3 && Math.abs(Math.sin(a) - nz) < 1e-3)) {
      const [dx, dz] = at(0, 0.04);
      P.box(dx, yW0 + 2.3, dz, 3.4, 4.6, 0.12, C.red2, ry, 0, 0, 1, { ao: false });
      const [ix, iz] = at(0, 0.1);
      P.box(ix, yW0 + 2.25, iz, 0.06, 4.3, 0.06, C.gold, ry, 0, 0, 1, { ao: false });
      for (const su of [-1, 1]) for (let r = 0; r < 5; r++) for (let c2 = 0; c2 < 3; c2++) { const [bx, bz] = at(su * (0.4 + c2 * 0.45), 0.12); P.sphere(bx, yW0 + 0.9 + r * 0.75, bz, 0.12, C.gold, 1); }
      const [lx, lz] = at(0, 0.06); P.box(lx, yW0 + 4.95, lz, 3.8, 0.5, 0.1, C.gold, ry, 0, 0, 1, { ao: false });
      continue;
    }
    for (const u of [-1.55, 1.55]) {
      const [wx, wz] = at(u, 0.05), [gx, gz] = at(u, 0.09);
      P.box(wx, 4.4, wz, 1.5, 4.0, 0.12, C.red, ry, 0, 0, 1, { ao: false });
      P.box(gx, 4.4, gz, 1.1, 3.5, 0.04, C.glass, ry, 0, 0, 1, { ao: false });
      for (const v of [3.3, 4.4, 5.5]) { const [hx, hz] = at(u, 0.12); P.box(hx, v, hz, 1.1, 0.06, 0.03, C.wall, ry, 0, 0, 1, { ao: false }); }
      const [mx, mz] = at(u, 0.12); P.box(mx, 4.4, mz, 0.06, 3.5, 0.03, C.wall, ry, 0, 0, 1, { ao: false });
      const [ax, az] = at(u, 0.05); P.cyl(ax, 6.4, az, 1.5, 0.12, C.red, 12, ry, Math.PI / 2, 0, undefined, { ao: false });
    }
  }
  // ---------- 檐口：红额枋 + 金线 + 青绿斗拱带 ----------
  P.cyl(X0, yW1 + 0.25, Z0, RW * 2 + 0.5, 0.5, C.red, 8, T8, 0, 0, undefined, { ao: false });
  P.cyl(X0, yW1 + 0.53, Z0, RW * 2 + 0.6, 0.08, C.gold, 8, T8, 0, 0, undefined, { ao: false });
  P.cyl(X0, yW1 + 0.78, Z0, RW * 2 + 0.9, 0.42, C.teal, 8, T8, 0, 0, undefined, { ao: false });
  // 斗拱：一圈小方块（青绿 + 金点）
  for (let f = 0; f < 8; f++) {
    const th = f * Math.PI / 4, nx = Math.cos(th), nz = Math.sin(th), tx = -nz, tz = nx, ry = -Math.atan2(tz, tx), half = (RW + 0.45) * Math.sin(T8) - 0.4, r = (RW + 0.45) * AP + 0.05;
    for (let u = -half; u <= half + 1e-3; u += 0.9) { P.box(X0 + nx * r + tx * u, yW1 + 0.78, Z0 + nz * r + tz * u, 0.4, 0.3, 0.1, C.gold, ry, 0, 0, 1, { ao: false }); }
  }
  // ---------- 下层大屋顶（宝蓝琉璃瓦）----------
  roofTier(k, yW1 + 1.0, 13.2, 6.6, 3.6);
  // ---------- 鼓座 + 上层攒尖顶 + 宝顶 ----------
  const yD0 = yW1 + 1.0 + 3.6, yD1 = yD0 + 2.0;
  P.cyl(X0, (yD0 + yD1) / 2, Z0, 12.6, yD1 - yD0, C.wall, 8, T8, 0, 0, undefined, { ao: false });
  for (let f = 0; f < 8; f++) {
    const th = f * Math.PI / 4, nx = Math.cos(th), nz = Math.sin(th), tx = -nz, tz = nx, ry = -Math.atan2(tz, tx), r = 6.3 * AP + 0.03;
    for (const u of [-1.1, 0, 1.1]) { P.box(X0 + nx * r + tx * u, (yD0 + yD1) / 2, Z0 + nz * r + tz * u, 0.7, 1.2, 0.08, C.red, ry, 0, 0, 1, { ao: false }); P.box(X0 + nx * (r + 0.02) + tx * u, (yD0 + yD1) / 2, Z0 + nz * (r + 0.02) + tz * u, 0.5, 1.0, 0.04, C.glass, ry, 0, 0, 1, { ao: false }); }
  }
  P.cyl(X0, yD1 + 0.2, Z0, 13.2, 0.4, C.red, 8, T8, 0, 0, undefined, { ao: false });
  P.cyl(X0, yD1 + 0.5, Z0, 13.5, 0.3, C.teal, 8, T8, 0, 0, undefined, { ao: false });
  const yTop = roofTier(k, yD1 + 0.65, 8.8, 0.9, 5.4, true);
  P.cyl(X0, yTop + 0.35, Z0, 1.1, 0.7, C.gold, 12, 0, 0, 0, 0.8, { ao: false });
  P.sphere(X0, yTop + 1.2, Z0, 1.3, C.gold, 2);
  P.cyl(X0, yTop + 2.1, Z0, 0.32, 1.2, C.gold, 8, 0, 0, 0, 0.18, { ao: false });
  P.sphere(X0, yTop + 2.8, Z0, 0.55, C.gold, 2);
  // ---------- 三座门廊 ----------
  for (const th of porticoFaces) portico(k, th, aw, yW0, th === Math.PI * 1.5);
}

/** 地面：中轴大道、铜像前庭、纪念堂周围的平台广场、大草坪（带路缘）、园内小路 */
function grounds(k) {
  const P = k.solid, Pv = k.g('pave'), G = k.g('grass'), S = k.shade;
  const lawn = (x0, x1, z0, z1) => {
    G.slab(x0, x1, 0, 0.1, z0, z1, hex('#FFFFFF'), { ao: false });
    for (const [a0, a1, b0, b1] of [[x0 - 0.15, x1 + 0.15, z0 - 0.15, z0], [x0 - 0.15, x1 + 0.15, z1, z1 + 0.15], [x0 - 0.15, x0, z0, z1], [x1, x1 + 0.15, z0, z1]]) P.slab(a0, a1, 0, 0.17, b0, b1, C.curb, { ao: false });
  };
  // 中轴大道：南门 → 铜像前庭（10m 宽浅色花岗岩，每 2m 一道缝）
  Pv.slab(AX - 5, AX + 5, 0, 0.05, GATE.z1, -10, C.plaza, { ao: false });
  for (let z = GATE.z1 + 2; z < -10; z += 2) P.slab(AX - 5, AX + 5, 0.05, 0.056, z - 0.03, z + 0.03, C.stone2, { ao: false });
  for (const sx of [-1, 1]) P.slab(AX + sx * 5 - 0.12, AX + sx * 5 + 0.12, 0, 0.08, GATE.z1, -10, C.stone2, { ao: false });
  // 铜像前庭 + 纪念堂周围的大平台（八角）
  Pv.slab(AX - 15, AX + 15, 0, 0.05, -10, -2, C.plaza, { ao: false });
  Pv.cyl(X0, 0.025, Z0, 2 * 31, 0.05, C.plaza, 8, T8, 0, 0, undefined, { ao: false });
  S.shadeRing(X0, Z0, 31 * AP, 31 * AP + 0.8, 0.06, 0.12, 32);
  // 南面两块大草坪（大道两侧）
  lawn(PARK.x0 + 5, AX - 5.6, -55.5, -10.6); lawn(AX + 5.6, PARK.x1 - 5, -55.5, -10.6);
  // 纪念堂两侧和后面的草地
  lawn(PARK.x0 + 5, X0 - 31, -1.4, PARK.z1 - 5); lawn(X0 + 31, PARK.x1 - 5, -1.4, PARK.z1 - 5);
  lawn(X0 - 24, X0 + 24, Z0 + 31, PARK.z1 - 5);
  // 草坪边上的小花带（靠大道一侧）
  for (const sx of [-1, 1]) for (let z = -54.5, i = 0; z < -11.5; z += 1.1, i++) P.sphere(AX + sx * (6.0 + (i % 2 ? 0.16 : -0.16)), 0.36, z, 0.32, hex(i % 3 === 2 ? '#F2B33D' : '#E8443A'), 1);
  // 榕树 / 白兰（低面数），沿围栏内侧和纪念堂两侧
  const trees = [];
  for (let z = -50; z <= 58; z += 12) trees.push([PARK.x0 + 3.2, z, 1.25], [PARK.x1 - 3.2, z + 6, 1.25]);
  for (const x of [26, 38, 50, 94, 106, 118]) trees.push([x, -57.6, 1.1]);
  trees.push([X0 - 36, Z0 - 4, 1.7], [X0 + 37, Z0 - 8, 1.6], [X0 - 30, Z0 + 26, 1.4], [X0 - 12, Z0 + 36, 1.3], [X0 + 12, Z0 + 37, 1.3]);
  for (const [x, z, s] of trees) cheapTree(k, x, z, s);
}

/** 低面数的树：树干 + 一个主树冠 + 三团小树冠（约 170 个三角形） */
function cheapTree(k, x, z, s) {
  const P = k.solid, g = ['#3F8A45', '#4C9A4E', '#367C3D', '#58A657'];
  k.shade.shadeBlob(x, z, 2.4 * s, 2.4 * s, 0.11, 0.3);
  P.cyl(x, 1.5 * s, z, 0.5 * s, 3 * s, hex('#6E5640'), 6, 0, 0, 0, 0.32 * s);
  const cy = 4.3 * s, prev = P.tint; P.tint = (px, py) => 0.72 + 0.34 * Math.max(0, Math.min(1, (py - (cy - 2.2 * s)) / (4.4 * s)));
  P.ellipsoid(x, cy, z, 4.6 * s, 3.2 * s, 4.6 * s, hex(g[0]), 2);
  for (let i = 0; i < 3; i++) { const a = i * 2.1 + x * 0.37; P.ellipsoid(x + Math.cos(a) * 1.6 * s, cy + 0.5 * s, z + Math.sin(a) * 1.6 * s, 2.6 * s, 2.1 * s, 2.6 * s, hex(g[1 + i]), 1); }
  P.tint = prev; k.col(x, 1.5 * s, z, 0.5 * s, 3 * s, 0.5 * s);
}

/** 四坡屋顶（庑殿式的简化）：檐口矩形 → 顶部小矩形，正反两面都画 */
export function hipRoof(k, x0, x1, z0, z1, y, h, ix, iz, col, colEave, ridge = C.ridge, orn = C.gold) {
  const Gl = k.g('gloss'), P = k.solid;
  Gl.slab(x0 - 0.3, x1 + 0.3, y, y + 0.28, z0 - 0.3, z1 + 0.3, colEave, { ao: false });
  const y1 = y + 0.28, y2 = y1 + h, a = [[x0, z0], [x1, z0], [x1, z1], [x0, z1]], b = [[x0 + ix, z0 + iz], [x1 - ix, z0 + iz], [x1 - ix, z1 - iz], [x0 + ix, z1 - iz]];
  for (let i = 0; i < 4; i++) {
    const j = (i + 1) % 4, A = [a[i][0], y1, a[i][1]], Bq = [a[j][0], y1, a[j][1]], Cq = [b[j][0], y2, b[j][1]], Dq = [b[i][0], y2, b[i][1]];
    Gl.quad(A, Bq, Cq, Dq, col); Gl.quad(Dq, Cq, Bq, A, col);
  }
  Gl.slab(x0 + ix, x1 - ix, y2 - 0.02, y2 + 0.06, z0 + iz, z1 - iz, col, { ao: false });
  // 正脊 + 两端金色吻兽 + 四角起翘
  const zm = (z0 + z1) / 2; P.box((x0 + x1) / 2, y2 + 0.25, zm, x1 - x0 - 2 * ix + 0.6, 0.45, 0.45, ridge, 0, 0, 0, 1, { ao: false });
  for (const xe of [x0 + ix - 0.1, x1 - ix + 0.1]) P.sphere(xe, y2 + 0.65, zm, 0.6, orn, 1);
  for (const [cx, cz, sx, sz] of [[x0, z0, -1, -1], [x1, z0, 1, -1], [x1, z1, 1, 1], [x0, z1, -1, 1]]) {
    P.path([[cx, y1 + 0.1, cz], [cx + sx * (ix * 0.45), y1 + h * 0.42, cz + sz * (iz * 0.45)]], 0.26, ridge, 5);
    P.tubeTaper([cx, y1 + 0.1, cz], [cx + sx * 0.8, y1 + 0.75, cz + sz * 0.8], 0.3, 0.16, ridge, 5); P.sphere(cx + sx * 0.85, y1 + 0.8, cz + sz * 0.85, 0.28, orn, 1);
  }
}

/** 东风中路边的南门楼：三孔拱门（中间大）+ 朱红铁门（开着）+ 重檐宝蓝琉璃瓦 + “中山纪念堂”匾 */
function gate(k) {
  const P = k.solid, Pv = k.g('pave'), zf = GATE.z0, zb = GATE.z1, gx = GATE.x, D = zb - zf, H = 7.6;
  Pv.slab(gx - 12.4, gx + 12.4, 0, 0.3, zf - 0.6, zb + 0.6, C.stone2, { ao: false });
  const ops = [[gx, 2.0, 4.2], [gx - 7.5, 1.5, 3.4], [gx + 7.5, 1.5, 3.4]];        // [中心 x, 半宽, 起拱高]
  const solid = [[gx - 11.5, gx - 9], [gx - 6, gx - 2], [gx + 2, gx + 6], [gx + 9, gx + 11.5]];
  for (const [a, b] of solid) { P.slab(a, b, 0.3, H, zf, zb, C.grit, { aoTop: true }); k.colSlab(a, b, 0, H, zf, zb); P.slab(a - 0.02, b + 0.02, 0.3, 1.3, zf - 0.02, zb + 0.02, C.granite, { ao: false }); }
  for (const [cx, r, hs] of ops) {
    // 拱顶上方的墙：切成竖条，每条底边落在半圆上（积木风的圆拱）
    const n = 10; for (let i = 0; i < n; i++) { const u0 = -r + 2 * r * i / n, u1 = u0 + 2 * r / n, um = (u0 + u1) / 2, yb = hs + 0.3 + Math.sqrt(Math.max(0, r * r - um * um)); P.slab(cx + u0, cx + u1, yb, H, zf, zb, C.grit, { ao: false }); }
    P.slab(cx - r, cx + r, 0.28, 0.3, zf, zb, C.stone2, { ao: false });
    // 拱券线脚（前后两面）
    for (const z of [zf - 0.06, zb + 0.06]) { const pts = []; for (let i = 0; i <= 12; i++) { const a = Math.PI * i / 12; pts.push([cx + Math.cos(a) * (r + 0.12), hs + 0.3 + Math.sin(a) * (r + 0.12), z]); } P.path(pts, 0.24, C.granite, 5); for (const sx of [-1, 1]) P.box(cx + sx * (r + 0.12), (hs + 0.3) / 2 + 0.15, z, 0.24, hs, 0.12, C.granite, 0, 0, 0, 1, { ao: false }); }
    // 朱红铁门：两扇都开着，贴在拱洞两侧
    for (const sx of [-1, 1]) {
      const x = cx + sx * (r - 0.06), leaf = Math.min(r, D * 0.45);
      P.box(x, 0.3 + hs / 2, zf + 0.25 + leaf / 2, 0.08, hs - 0.05, leaf, C.red2, 0, 0, 0, 1, { ao: false });
      for (let yy = 0.9; yy < hs; yy += 0.7) for (let w = 0.3; w < leaf - 0.1; w += 0.45) P.sphere(x - sx * 0.05, 0.3 + yy, zf + 0.25 + w, 0.09, C.gold, 1);
    }
  }
  // 门洞地面（浅色石）
  // 檐下：红额枋 + 青绿彩画带 + 金点
  P.slab(gx - 11.8, gx + 11.8, H, H + 0.5, zf - 0.2, zb + 0.2, C.red, { ao: false });
  P.slab(gx - 12.0, gx + 12.0, H + 0.5, H + 0.85, zf - 0.35, zb + 0.35, C.teal, { ao: false });
  for (let x = gx - 11.4; x <= gx + 11.4; x += 0.9) for (const z of [zf - 0.37, zb + 0.37]) P.box(x, H + 0.67, z, 0.36, 0.22, 0.04, C.gold, 0, 0, 0, 1, { ao: false });
  // 下檐屋顶
  hipRoof(k, gx - 13.2, gx + 13.2, zf - 1.3, zb + 1.3, H + 0.85, 2.0, 4.0, 2.6, C.blue, C.blue2);
  // 上层：米白墙 + 红窗 + 匾
  const yU = H + 0.85 + 2.0;
  P.slab(gx - 8.2, gx + 8.2, yU - 0.4, yU + 2.2, zf + 0.9, zb - 0.9, C.wall, { aoTop: true });
  for (let i = -3; i <= 3; i++) if (i !== 0) for (const z of [zf + 0.88, zb - 0.88]) P.box(gx + i * 2.2, yU + 0.9, z, 1.0, 1.3, 0.06, C.red, 0, 0, 0, 1, { ao: false });
  P.slab(gx - 8.5, gx + 8.5, yU + 2.2, yU + 2.6, zf + 0.7, zb - 0.7, C.red, { ao: false });
  P.slab(gx - 8.7, gx + 8.7, yU + 2.6, yU + 2.9, zf + 0.6, zb - 0.6, C.teal, { ao: false });
  k.sign(gx, yU + 0.95, zf + 0.82, { kind: 'plain', w: 4.6, h: 1.25, bg: '#1E3A6B', fg: '#F2C94C', zh: '中山纪念堂', face: Math.PI, align: 'center' });
  // 上檐屋顶
  hipRoof(k, gx - 10.0, gx + 10.0, zf - 0.2, zb + 0.2, yU + 2.9, 2.6, 5.2, 2.5, C.blue, C.blue2);
}

/** 石柱铁花围栏：每 4m 一根花岗岩柱，石米矮墙 + 黑色铁栏杆（竖条 + 菱形铁花 + 金点） */
function fenceRun(k, x0, z0, x1, z1) {
  const P = k.solid, Pv = k.g('pave'), L = Math.hypot(x1 - x0, z1 - z0), n = Math.max(1, Math.round(L / 4)), ux = (x1 - x0) / L, uz = (z1 - z0) / L, nx = -uz, nz = ux;
  const at = (t, y, o = 0) => [x0 + ux * t + nx * o, y, z0 + uz * t + nz * o], seg = L / n, ry = Math.atan2(ux, uz) - Math.PI / 2;
  const strip = (t, ya, yb, w) => { const a = at(t - w / 2, ya), b = at(t + w / 2, ya), c = at(t + w / 2, yb), d = at(t - w / 2, yb); P.quad(a, b, c, d, C.iron); P.quad(d, c, b, a, C.iron); };
  const bar = (t0, y0, t1, y1, w) => { const a = at(t0, y0), b = at(t1, y1), dx = (t1 - t0), dy = y1 - y0, l = Math.hypot(dx, dy), ox = -dy / l * w / 2, oy = dx / l * w / 2;
    const A = at(t0 + ox, y0 + oy), Bq = at(t1 + ox, y1 + oy), Cq = at(t1 - ox, y1 - oy), Dq = at(t0 - ox, y0 - oy); void a; void b; P.quad(A, Bq, Cq, Dq, C.iron); P.quad(Dq, Cq, Bq, A, C.iron); };
  const mx = (x0 + x1) / 2, mz = (z0 + z1) / 2;
  Pv.box(mx, 0.24, mz, Math.abs(ux) * L + Math.abs(nx) * 0.44, 0.48, Math.abs(uz) * L + Math.abs(nz) * 0.44, C.grit, 0, 0, 0, 1, { ao: true });
  for (const y of [0.62, 1.86]) P.box(mx, y, mz, Math.abs(ux) * L + Math.abs(nx) * 0.05, 0.06, Math.abs(uz) * L + Math.abs(nz) * 0.05, C.iron, 0, 0, 0, 1, { ao: false });
  k.colSlab(Math.min(x0, x1) - Math.abs(nx) * 0.3, Math.max(x0, x1) + Math.abs(nx) * 0.3, 0, 2.4, Math.min(z0, z1) - Math.abs(nz) * 0.3, Math.max(z0, z1) + Math.abs(nz) * 0.3);
  for (let i = 0; i <= n; i++) {
    const [px, , pz] = at(i * seg, 0);
    Pv.box(px, 1.08, pz, 0.56, 2.16, 0.56, C.granite, 0, 0, 0, 1, { ao: true }); P.box(px, 2.24, pz, 0.72, 0.16, 0.72, C.stone2, 0, 0, 0, 1, { ao: false });
    P.cyl(px, 2.46, pz, 0.62, 0.28, C.stone2, 4, Math.PI / 4, 0, 0, 0.12, { ao: false });
    if (i === n) break;
    const t0 = i * seg + 0.4, t1 = (i + 1) * seg - 0.4, tm = (t0 + t1) / 2;
    for (let t = t0; t <= t1 + 1e-3; t += 0.24) if (Math.abs(t - tm) > 0.42) strip(t, 0.48, 2.0, 0.035);
    // 铁花：菱形 + 中间金点
    bar(tm - 0.42, 1.24, tm, 1.72, 0.05); bar(tm, 1.72, tm + 0.42, 1.24, 0.05); bar(tm + 0.42, 1.24, tm, 0.76, 0.05); bar(tm, 0.76, tm - 0.42, 1.24, 0.05);
    strip(tm, 0.48, 0.76, 0.035); strip(tm, 1.72, 2.0, 0.035);
    const [gx, , gz] = at(tm, 0); P.sphere(gx, 1.24, gz, 0.16, C.gold, 1);
    void ry;
  }
}
function fences(k) {
  const z = PARK.z0;
  fenceRun(k, PARK.x0, z, GATE.x - 12, z); fenceRun(k, GATE.x + 12, z, PARK.x1, z);
  fenceRun(k, PARK.x0, z, PARK.x0, PARK.z1); fenceRun(k, PARK.x1, z, PARK.x1, PARK.z1); fenceRun(k, PARK.x0, PARK.z1, PARK.x1, PARK.z1);
}

/** 铜像 + 花岗岩底座（scaledBuild 放大 1.45 倍：铜像约 4.5m、底座约 3.8m） */
function statueGroup(k, SX, SZ) {
  const P = k.solid, Pv = k.g('pave'), S = k.shade;
  Pv.slab(SX - 1.6, SX + 1.6, 0.05, 0.45, SZ - 1.6, SZ + 1.6, C.stone2); Pv.slab(SX - 1.05, SX + 1.05, 0.45, 2.45, SZ - 1.05, SZ + 1.05, C.stone);
  P.slab(SX - 1.2, SX + 1.2, 2.45, 2.62, SZ - 1.2, SZ + 1.2, C.stone2, { ao: false });
  k.col(SX, 1.3, SZ, 3.2, 2.6, 3.2);
  S.shadeBlob(SX, SZ, 2.3, 2.3, 0.06, 0.3);
  statue(P, SX, 2.62, SZ);
  k.sign(SX, 1.45, SZ - 1.06, { kind: 'plain', w: 1.7, h: 0.55, bg: '#3B3226', fg: '#E9C66B', zh: '孙中山先生像', face: Math.PI, align: 'center', box: false });
}

/** 云鹤华表：八角须弥座 + 白石柱 + 云板 + 顶上蹲兽 */
function huabiao(k, x, z) {
  const P = k.solid, Pv = k.g('pave'), W = hex('#EEEBE3');
  Pv.cyl(x, 0.15, z, 3.6, 0.3, C.stone2, 8, T8, 0, 0, undefined, { ao: false });
  Pv.cyl(x, 1.1, z, 2.6, 1.6, W, 8, T8, 0, 0, undefined, { ao: true });
  P.cyl(x, 1.98, z, 2.9, 0.16, C.stone2, 8, T8, 0, 0, undefined, { ao: false });
  P.cyl(x, 6.4, z, 0.95, 8.8, W, 8, T8, 0, 0, 0.82, { aoTop: true });
  for (let i = 0; i < 5; i++) P.cyl(x, 3 + i * 1.5, z, 1.0, 0.18, hex('#DCD8CE'), 8, T8 + i * 0.4, 0, 0, undefined, { ao: false });  // 盘云
  P.box(x, 9.5, z, 3.0, 0.75, 0.22, W, 0, 0, 0, 1, { ao: false }); P.ellipsoid(x - 1.5, 9.5, z, 0.7, 0.8, 0.24, W, 1); P.ellipsoid(x + 1.5, 9.5, z, 0.7, 0.8, 0.24, W, 1);
  P.cyl(x, 10.95, z, 1.7, 0.3, W, 12, 0, 0, 0, undefined, { ao: false });
  P.ellipsoid(x, 11.5, z, 0.8, 0.85, 1.0, W, 1); P.sphere(x, 12.0, z + 0.3, 0.45, W, 1);
  k.col(x, 3, z, 2.6, 6, 2.6); k.shade.shadeBlob(x, z, 2.2, 2.2, 0.11, 0.3);
}

/** 木棉王：粗大的灰褐树干 + 板根，一层层几乎水平伸出的枝，开满红花（花多叶少），树下掉了一地红花 + 小牌子 */
function kapok(k, x, z) {
  const P = k.solid, bark = hex('#7A6A58'), bark2 = hex('#665746');
  k.shade.shadeBlob(x, z, 7, 7, 0.11, 0.34);
  P.cyl(x, 5, z, 1.7, 10, bark, 10, 0, 0, 0, 0.95);
  P.cyl(x, 13, z, 0.95, 6, bark2, 8, 0, 0, 0, 0.4);
  for (let i = 0; i < 6; i++) { const a = i / 6 * 6.28 + 0.3; P.tubeTaper([x, 1.4, z], [x + Math.cos(a) * 2.0, 0.1, z + Math.sin(a) * 2.0], 0.9, 0.25, bark2, 5); }
  k.col(x, 4, z, 1.6, 8, 1.6);
  let seed = 7; const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  const reds = [hex('#D9312B'), hex('#E8443A'), hex('#F05A3C'), hex('#C92A24')];
  const tiers = [[5.6, 6.2, 5], [8.2, 5.2, 5], [10.8, 4.0, 5], [13.2, 2.8, 4], [15.2, 1.6, 3]];
  tiers.forEach(([y, len, nb], ti) => {
    for (let b = 0; b < nb; b++) {
      const a = b / nb * 6.28 + ti * 0.7, ex = x + Math.cos(a) * len, ez = z + Math.sin(a) * len, ey = y + 0.9 + len * 0.08;
      P.tubeTaper([x, y, z], [ex, ey, ez], 0.5 - ti * 0.06, 0.14, bark, 5);
      const steps = Math.max(3, Math.round(len / 0.55));
      for (let s = 1; s <= steps; s++) {
        const t = 0.25 + 0.75 * s / steps, fx = x + (ex - x) * t, fy = y + (ey - y) * t + 0.25, fz = z + (ez - z) * t;
        for (let f = 0; f < 3; f++) P.sphere(fx + (rnd() - 0.5) * 0.9, fy + rnd() * 0.7, fz + (rnd() - 0.5) * 0.9, 0.42 + rnd() * 0.2, reds[(s + f) % 4], 1);
      }
      // 枝梢上一小撮新叶
      P.ellipsoid(ex, ey + 0.3, ez, 0.9, 0.5, 0.9, hex('#7FB25A'), 1);
    }
  });
  for (let f = 0; f < 18; f++) P.sphere(x + (rnd() - 0.5) * 1.6, 17.2 + rnd() * 1.2, z + (rnd() - 0.5) * 1.6, 0.5, reds[f % 4], 1);
  // 地上的落花
  for (let f = 0; f < 40; f++) { const a = rnd() * 6.28, d = 1.4 + rnd() * 5.5; P.cyl(x + Math.cos(a) * d, 0.13, z + Math.sin(a) * d, 0.32, 0.05, reds[f % 4], 6, a, 0, 0, undefined, { ao: false }); }
  // 小牌子
  const sx = x - 6.0, sz = z - 3.0;
  P.cyl(sx, 0.55, sz, 0.12, 1.1, hex('#4A3E30'), 6);
  k.sign(sx, 1.25, sz - 0.02, { kind: 'plain', w: 1.9, h: 0.62, bg: '#5B3A22', fg: '#FFE7B0', zh: '木棉王', en: '350+ years old', face: Math.PI, align: 'center' });
}

/** 远景：北边越秀山 + 山上的中山纪念碑（低模），东边一排矮楼（简模，无贴图） */
function backdrop(k) {
  const P = k.solid, Pv = k.g('pave');
  P.ellipsoid(AX, 0, 130, 230, 58, 92, hex('#5E9B55'), 2);
  P.ellipsoid(AX - 60, 0, 120, 120, 36, 70, hex('#6AA65E'), 1); P.ellipsoid(AX + 70, 0, 118, 130, 40, 70, hex('#58934F'), 1);
  const hy = (x, z) => 29 * Math.sqrt(Math.max(0, 1 - ((x - AX) / 115) ** 2 - ((z - 130) / 46) ** 2));
  for (let i = 0; i < 16; i++) { const x = AX - 70 + i * 9.3, z = 92 + (i % 3) * 5, y = hy(x, z); if (y < 2) continue; P.cyl(x, y + 2.6, z, 4.2, 5.2, hex(i % 2 ? '#3F7F43' : '#4A8B47'), 6, 0, 0, 0, 0.2, { ao: false }); }
  const oy = hy(AX, 116);
  Pv.slab(AX - 3, AX + 3, oy - 1, oy + 1.2, 113, 119, C.stone2);
  Pv.cyl(AX, oy + 1.2 + 10, 116, 3.6, 20, hex('#F1EEE6'), 4, Math.PI / 4, 0, 0, 1.6, { ao: false });
  // 东边远处的矮楼（围栏外，简模：盒子 + 两道窗带）
  const cols = ['#E9E2D6', '#DCE3EA', '#EFE6D2', '#E3E9DF'];
  for (let i = 0; i < 6; i++) { const z = -52 + i * 22, h = 6.5 + (i * 1.7) % 3, c = hex(cols[i % 4]);
    P.slab(137, 151, 0, h, z - 9, z + 9, c, { aoTop: true });
    for (const y of [2.2, 4.6]) if (y < h - 1) P.slab(136.94, 137.0, y, y + 1.1, z - 8, z + 8, hex('#5C7A8F'), { ao: false });
  }
}

/** 一层八角琉璃瓦屋顶：底边外接圆直径 d0、顶 d1、高 h；八条垂脊 + 翘角（金色瓦当头）；返回屋顶顶面高度 */
function roofTier(k, y, d0, d1, h, top = false) {
  const P = k.solid, Gl = k.g('gloss');
  // 檐口（薄板，比屋面再挑出一点）
  Gl.cyl(X0, y + 0.12, Z0, d0 * 2 + 0.6, 0.24, C.blue2, 8, T8, 0, 0, undefined, { ao: false });
  // 屋面：两段（下段缓、上段陡，像真屋顶那样有点“凹”曲线）
  const ym = y + h * 0.42, dm = d0 * 2 * 0.62 + d1 * 0.38;
  Gl.cyl(X0, (y + 0.24 + ym) / 2, Z0, d0 * 2, ym - y - 0.24, C.blue, 8, T8, 0, 0, dm, { ao: false });
  Gl.cyl(X0, (ym + y + h) / 2, Z0, dm, y + h - ym, C.blue, 8, T8, 0, 0, d1, { ao: false });
  // 瓦垄：每个面几道浅色细条（沿坡向下）
  for (let f = 0; f < 8; f++) {
    const th = f * Math.PI / 4, nx = Math.cos(th), nz = Math.sin(th), tx = -nz, tz = nx;
    const a0 = d0 * AP, am = dm / 2 * AP, half = d0 * Math.sin(T8) * 0.8, n = Math.max(3, Math.round(half / 0.9));
    for (let i = -n; i <= n; i++) {
      const u0 = half * i / n, u1 = u0 * (am / a0);
      P.tube([X0 + nx * (a0 + 0.04) + tx * u0, y + 0.3, Z0 + nz * (a0 + 0.04) + tz * u0], [X0 + nx * (am + 0.04) + tx * u1, ym + 0.02, Z0 + nz * (am + 0.04) + tz * u1], 0.07, C.blue2, 4);
    }
  }
  // 垂脊 + 翘角（八个角）
  for (let v = 0; v < 8; v++) {
    const a = T8 + v * Math.PI / 4, cx = Math.cos(a), cz = Math.sin(a);
    const r0 = d0 + 0.3, rm = dm / 2, r1 = d1 / 2;
    P.path([[X0 + cx * r0, y + 0.42, Z0 + cz * r0], [X0 + cx * rm, ym + 0.12, Z0 + cz * rm], [X0 + cx * r1, y + h + 0.05, Z0 + cz * r1]], 0.32, C.ridge, 6);
    // 翘角：檐角往上翘的一小段 + 金色头
    P.tubeTaper([X0 + cx * r0, y + 0.42, Z0 + cz * r0], [X0 + cx * (r0 + 0.9), y + 1.05, Z0 + cz * (r0 + 0.9)], 0.34, 0.18, C.ridge, 6);
    P.sphere(X0 + cx * (r0 + 0.95), y + 1.1, Z0 + cz * (r0 + 0.95), 0.3, C.gold, 1);
    // 脊兽（小小一排金点）
    for (let i = 1; i <= 3; i++) { const t = i / 4, rr = r0 + (rm - r0) * t; P.sphere(X0 + cx * rr, y + 0.42 + (ym - y - 0.3) * t + 0.22, Z0 + cz * rr, 0.2, C.gold, 1); }
  }
  if (top) Gl.cyl(X0, y + h + 0.1, Z0, d1 + 0.2, 0.2, C.ridge, 8, T8, 0, 0, undefined, { ao: false });
  return y + h;
}

/** 门廊：θ = 面朝方向（0 = +x，π/2 = +z，3π/2 = -z 正面）；aw = 墙面边心距 */
function portico(k, th, aw, y0, front) {
  const P = k.solid, Gl = k.g('gloss'), nx = Math.cos(th), nz = Math.sin(th), tx = -nz, tz = nx, ry = -Math.atan2(tz, tx);
  const W = 9.6, D0 = aw - 0.2, D1 = aw + 2.0;                       // 门廊宽、从墙里到外沿
  const at = (u, w) => [X0 + nx * w + tx * u, Z0 + nz * w + tz * u];
  const box = (u, w, y, bw, bh, bd, col, rz = 0, o = { ao: false }) => { const [x, z] = at(u, w); P.box(x, y, z, bw, bh, bd, col, ry, 0, rz, 1, o); };
  const yC = 6.6;                                                    // 柱顶
  // 红柱：前排 6 根 + 后排靠墙 2 根
  for (const u of [-4.2, -2.52, -0.84, 0.84, 2.52, 4.2]) {
    const [x, z] = at(u, D1 - 0.5);
    P.cyl(x, (y0 + yC) / 2, z, 0.62, yC - y0, C.red, 14);
    P.cyl(x, y0 + 0.15, z, 0.9, 0.3, C.wall, 14, 0, 0, 0, undefined, { ao: false });
    P.cyl(x, yC - 0.2, z, 0.72, 0.18, C.gold, 14, 0, 0, 0, undefined, { ao: false });
    k.col(x, (y0 + yC) / 2, z, 0.62, yC - y0, 0.62);
    k.shade.shadeRing(x, z, 0.3, 0.8, y0 + 0.01, 0.28, 14);
  }
  // 额枋：红 + 青绿彩画带 + 金线
  box(0, (D0 + D1) / 2, yC + 0.35, W + 0.4, 0.7, D1 - D0 + 0.2, C.red);
  box(0, D1 + 0.12, yC + 0.4, W + 0.2, 0.42, 0.06, C.teal);
  for (let i = -4; i <= 4; i++) box(i * 1.05, D1 + 0.16, yC + 0.4, 0.5, 0.14, 0.04, C.gold);
  box(0, (D0 + D1) / 2, yC + 0.82, W + 0.8, 0.24, D1 - D0 + 0.6, C.teal);
  // 歇山小屋顶：两片坡（脊沿门廊进深方向）+ 正脊 + 山花（红三角）
  const yr = yC + 0.95, hw = W / 2 + 0.7, ang = 0.5, L = D1 - D0 + 1.6, wm = (D0 + D1) / 2 + 0.3, sl = hw / Math.cos(ang);
  for (const s of [-1, 1]) { const [x, z] = at(s * hw / 2, wm); Gl.box(x, yr + Math.tan(ang) * hw / 2, z, sl + 0.2, 0.26, L, C.blue, ry, 0, -s * ang, 1, { ao: false }); }
  const yRidge = yr + Math.tan(ang) * hw + 0.12;
  box(0, wm, yRidge, 0.42, 0.4, L + 0.3, C.ridge);
  for (const e of [-1, 1]) { const [x, z] = at(0, wm + e * (L / 2 + 0.15)); P.sphere(x, yRidge + 0.3, z, 0.42, C.gold, 1); }
  // 山花（前面的红三角 + 金边）
  const wf = D1 + 0.55, [ax, az] = at(-hw + 0.5, wf), [bx, bz] = at(hw - 0.5, wf), [cx, cz] = at(0, wf), yb = yr + 0.12, yt = yRidge - 0.25;
  P.quad([ax, yb, az], [bx, yb, bz], [cx, yt, cz], [cx, yt, cz], C.red); P.quad([cx, yt, cz], [cx, yt, cz], [bx, yb, bz], [ax, yb, az], C.red);
  const [ax2, az2] = at(-hw + 1.6, wf + 0.02), [bx2, bz2] = at(hw - 1.6, wf + 0.02), yb2 = yb + 0.25, yt2 = yt - 0.45;
  P.quad([ax2, yb2, az2], [bx2, yb2, bz2], [cx + nx * 0.02, yt2, cz + nz * 0.02], [cx + nx * 0.02, yt2, cz + nz * 0.02], C.teal);
  // 门廊顶棚（底面）
  box(0, (D0 + D1) / 2, yC + 0.02, W + 0.3, 0.06, D1 - D0, C.teal);
  // 正面：“天下为公”金字匾（挂在额枋正中）
  if (front) { const [x, z] = at(0, D1 + 0.2); k.sign(x, yC + 1.5, z, { kind: 'plain', w: 3.4, h: 0.9, bg: '#1E3A6B', fg: '#F2C94C', zh: '天下为公', face: Math.atan2(nx, nz), align: 'center' }); }
}

/** 孙中山先生铜像（站姿、长衫、双手在身前）：脚底 y */
function statue(P, x, y, z) {
  const b = C.bronze, d = C.bronze2;
  P.cyl(x, y + 0.08, z, 1.3, 0.16, d, 16, 0, 0, 0, undefined, { ao: false });
  P.cyl(x, y + 0.95, z, 0.95, 1.6, b, 14, 0, 0, 0, 0.72);           // 长衫下摆
  P.cyl(x, y + 2.05, z, 0.76, 0.75, b, 14, 0, 0, 0, 0.8);            // 上身
  P.ellipsoid(x, y + 2.42, z, 1.05, 0.42, 0.6, b, 2);                // 肩
  P.cyl(x, y + 2.68, z, 0.26, 0.2, d, 10);                            // 脖子
  P.sphere(x, y + 2.95, z, 0.5, b, 2);                                // 头
  P.ellipsoid(x, y + 3.12, z + 0.02, 0.5, 0.22, 0.5, d, 2);           // 头发
  for (const s of [-1, 1]) {                                          // 手臂：垂下、前臂收到身前
    P.capsule([x + s * 0.48, y + 2.38, z], [x + s * 0.5, y + 1.75, z - 0.12], 0.13, 0.12, b, 8);
    P.capsule([x + s * 0.5, y + 1.75, z - 0.12], [x + s * 0.12, y + 1.6, z - 0.42], 0.12, 0.11, b, 8);
  }
  P.sphere(x, y + 1.6, z - 0.45, 0.28, d, 1);                         // 双手
  for (const s of [-1, 1]) P.ellipsoid(x + s * 0.18, y + 0.18, z - 0.25, 0.26, 0.14, 0.42, d, 1);   // 鞋
}
