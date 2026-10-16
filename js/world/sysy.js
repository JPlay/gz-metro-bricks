/*
 * 中山纪念堂（2 号线纪念堂站 C 出口外）：积木风、但尽量好认——
 *   八角形大殿：花岗岩台基 → 米白墙 + 红窗框 → 红色檐口 + 青绿斗拱带 → 宝蓝琉璃瓦下层大屋顶（八条垂脊、翘角）
 *   → 鼓座 → 上层八角攒尖顶 → 金色宝顶；正面和东西两面各一座红柱门廊（歇山小屋顶、“天下为公”匾）。
 *   前面：花岗岩广场 + 孙中山先生铜像（底座）+ 两块大草坪 + 一棵老木棉树 + 几棵榕树 + 入口石牌。
 * 全部写进 Kit 的静态桶（合批、烘焙暗影，不加灯），iPad 上只多几次绘制调用。
 * 坐标：大殿中心 (HALL.x, HALL.z)，正门朝 -z（朝着马路 / 站口这一侧）。
 */
import { hex } from '../core/geo.js';
import * as D from './decor.js';

export const HALL = { x: 34, z: -18 };
const X0 = HALL.x, Z0 = HALL.z;
const T8 = Math.PI / 8;                  // tess=8 的圆柱转 22.5°：正好有一个面朝 -z
const AP = Math.cos(T8);                  // 外接圆半径 → 边心距
const C = {
  stone: hex('#D9D3C5'), stone2: hex('#C9C2B2'), wall: hex('#F3ECDD'), red: hex('#B3302A'), red2: hex('#8F2219'),
  gold: hex('#E3B341'), teal: hex('#2F6E73'), blue: hex('#1F5BB0'), blue2: hex('#2C70C6'), ridge: hex('#163F7C'),
  glass: hex('#2B4C6E'), bronze: hex('#6A5636'), bronze2: hex('#4F4027'), plaza: hex('#E4DED2'), curb: hex('#C9CBCC')
};
/** 正门前的到达点（台阶前）；门口区域 = 到达判定 */
export const HALL_DOOR = { x: X0, z: Z0 - 13.8, y: 0, zone: { x0: X0 - 4.6, x1: X0 + 4.6, z0: Z0 - 15.6, z1: Z0 - 8.4 } };
/** 台阶脚下（引导带终点） */
export const HALL_STEPS_Z = Z0 - 13.4;

/** 大殿 + 广场：k = Kit；返回 { door, statue, kapok } 供导向和测试用 */
export function buildSysy(k) {
  const P = k.solid, Gl = k.g('gloss'), Pv = k.g('pave'), S = k.shade;
  // ---------- 台基（两级，八角）----------
  const R0 = 12.6, R1 = 11.4;
  Pv.cyl(X0, 0.3, Z0, R0 * 2, 0.6, C.stone2, 8, T8, 0, 0, undefined, { ao: false });
  Pv.cyl(X0, 0.9, Z0, R1 * 2, 0.6, C.stone, 8, T8, 0, 0, undefined, { ao: false });
  for (const [r, h] of [[R0, 0.6], [R1, 1.2]]) { const s = 2 * r * AP; k.col(X0, h / 2, Z0, s * 0.83, h, s); k.col(X0, h / 2, Z0, s, h, s * 0.83); k.col(X0, h / 2, Z0, s * 0.95, h, s * 0.95, { ry: Math.PI / 4 }); }
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
  k.stairs('z', HALL_STEPS_Z, 0, Z0 - R1 * AP + 0.2, 1.2, X0 - 4.2, X0 + 4.2, 0, C.stone, { rails: false, nosing: '#B8B1A2' });
  for (const sx of [-1, 1]) { Pv.slab(X0 + sx * 4.2 - 0.3, X0 + sx * 4.2 + 0.3, 0, 1.45, HALL_STEPS_Z, Z0 - R1 * AP + 0.4, C.stone2); k.colSlab(X0 + sx * 4.2 - 0.3, X0 + sx * 4.2 + 0.3, 0, 1.45, HALL_STEPS_Z, Z0 - R1 * AP + 0.4); }
  // ---------- 墙身 ----------
  const RW = 9.6, yW0 = 1.2, yW1 = 7.6, aw = RW * AP;
  P.cyl(X0, (yW0 + yW1) / 2, Z0, RW * 2, yW1 - yW0, C.wall, 8, T8, 0, 0, undefined, { aoTop: true });
  P.cyl(X0, yW0 + 0.3, Z0, RW * 2 + 0.3, 0.6, C.stone2, 8, T8, 0, 0, undefined, { ao: false });
  { const s = 2 * aw; k.col(X0, (yW0 + yW1) / 2, Z0, s * 0.83, yW1 - yW0, s); k.col(X0, (yW0 + yW1) / 2, Z0, s, yW1 - yW0, s * 0.83); k.col(X0, (yW0 + yW1) / 2, Z0, s * 0.95, yW1 - yW0, s * 0.95, { ry: Math.PI / 4 }); }
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
  // ---------- 前广场 ----------
  const zF0 = Z0 - R0 * AP - 0.2, zF1 = -52;               // 广场从台基前沿到马路边的人行道
  Pv.slab(X0 - 5.2, X0 + 5.2, 0, 0.05, zF1, zF0, C.plaza, { ao: false });
  for (let z = zF1 + 1.5; z < zF0; z += 1.5) P.slab(X0 - 5.2, X0 + 5.2, 0.05, 0.056, z - 0.03, z + 0.03, C.stone2, { ao: false });
  // 草坪（两块，带路缘）
  const G = k.g('grass');
  for (const [x0, x1] of [[X0 - 15, X0 - 5.4], [X0 + 5.4, X0 + 15]]) {
    G.slab(x0, x1, 0, 0.1, zF1, zF0 - 0.3, hex('#FFFFFF'), { ao: false });
    for (const [a0, a1, b0, b1] of [[x0 - 0.12, x1 + 0.12, zF1 - 0.12, zF1], [x0 - 0.12, x1 + 0.12, zF0 - 0.3, zF0 - 0.18], [x0 - 0.12, x0, zF1, zF0 - 0.3], [x1, x1 + 0.12, zF1, zF0 - 0.3]]) P.slab(a0, a1, 0, 0.16, b0, b1, C.curb, { ao: false });
  }
  // 花坛：草坪靠广场的一侧一排红花
  for (const sx of [-1, 1]) {
    D.hedge(k, X0 + sx * 5.65 - 0.3, X0 + sx * 5.65 + 0.3, zF1 + 0.6, zF0 - 0.9, 0.1, 0.55);
    for (let z = zF1 + 1.0, i = 0; z < zF0 - 1.2; z += 0.7, i++) P.sphere(X0 + sx * (5.65 + (i % 2 ? 0.14 : -0.14)), 0.74, z, 0.2, hex(i % 3 === 2 ? '#F2B33D' : '#E8443A'), 1);
  }
  // 孙中山先生铜像：花岗岩底座 + 站立的长衫铜像（积木风）
  const SX = X0, SZ = Z0 - 20.5;
  Pv.slab(SX - 1.6, SX + 1.6, 0.05, 0.45, SZ - 1.6, SZ + 1.6, C.stone2); Pv.slab(SX - 1.05, SX + 1.05, 0.45, 2.45, SZ - 1.05, SZ + 1.05, C.stone);
  P.slab(SX - 1.2, SX + 1.2, 2.45, 2.62, SZ - 1.2, SZ + 1.2, C.stone2, { ao: false });
  k.col(SX, 1.3, SZ, 3.2, 2.6, 3.2);
  S.shadeBlob(SX, SZ, 2.3, 2.3, 0.06, 0.3);
  statue(P, SX, 2.62, SZ);
  // 底座正面铭牌
  k.sign(SX, 1.45, SZ - 1.06, { kind: 'plain', w: 1.7, h: 0.55, bg: '#3B3226', fg: '#E9C66B', zh: '孙中山先生像', face: Math.PI, align: 'center', box: false });
  // 老木棉树（东草坪，比普通树大一圈，开满红花）+ 榕树
  D.tree(k, X0 + 10.5, 0.1, Z0 - 24, 1.75, 1); k.col(X0 + 10.5, 1.5, Z0 - 24, 0.8, 3, 0.8);
  for (const [x, z, s] of [[X0 - 11, Z0 - 25, 1.2], [X0 - 9, Z0 - 31, 1.05], [X0 + 12, Z0 - 31.5, 1.0], [X0 - 13, Z0 - 18, 1.2], [X0 + 13.5, Z0 - 15, 1.15]]) { D.tree(k, x, z > Z0 - 23 ? 0 : 0.1, z, s, 0); k.col(x, 1, z, 0.5, 2, 0.5); }
  // 入口石牌（广场靠马路的一端，左边）
  Pv.slab(X0 - 9.2, X0 - 5.8, 0, 1.25, zF1 + 0.4, zF1 + 1.0, C.stone2); k.colSlab(X0 - 9.2, X0 - 5.8, 0, 1.25, zF1 + 0.4, zF1 + 1.0);
  k.sign(X0 - 7.5, 0.72, zF1 + 0.37, { kind: 'plain', w: 3.2, h: 0.95, bg: '#24324A', fg: '#F3D27A', zh: '中山纪念堂', en: 'Sun Yat-sen Memorial Hall', face: Math.PI, align: 'center', box: false });
  return { door: HALL_DOOR, statue: { x: SX, z: SZ }, kapok: { x: X0 + 10.5, z: Z0 - 24 } };
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
