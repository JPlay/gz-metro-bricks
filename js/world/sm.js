/*
 * 黄沙站 D 出口：沙面（只做一段沙面大街，不做整个岛）。
 *   - 出站往南过马路，沙基涌上一座小石桥过去，就是沙面大街：中间一条大榕树林荫道（树冠连成一片），石板路；
 *   - 两边 5 栋欧式老洋楼（同一个楼模板，换颜色和细节）：2–3 层，底层拱廊、楼上外廊、白色 / 墨绿百叶窗；奶黄 / 浅粉 / 米白；
 *   - 东边：白色尖塔的露德圣母堂；路边 3 个铜像（拍照的人、拉大提琴的人、撑伞的女士）；
 *   - 街的尽头：一段珠江边的栏杆和江水（不做对岸）。
 *   全部并进一个单独的 Kit（只在地面上启用），各材质桶各 1 次绘制。没有地面引导线 / 箭头。
 */
import { hex } from '../core/geo.js';
import * as D from './decor.js';

export const SM = { z0: -82, z1: -94, zEnd: -200, xs: 10, bw: 3.5 };   // 沙基涌 z -82..-94；街两边楼的临街线 |x| = 10；桥半宽 3.5；江边 z = -200
const C = {
  stone: hex('#CFC6B6'), stone2: hex('#BDB2A0'), curb: hex('#B8AE9E'), white: hex('#FCFBF7'), trim: hex('#F8F5EE'), green: hex('#2E5A44'), door: hex('#3B4A3E'),
  glassC: hex('#6F8FA0'), roof: hex('#9A9488'), iron: hex('#22262A'), bronze: hex('#7A5A36'), water: hex('#58706E'), bark: hex('#6B5A48'), root: hex('#7A6A56')
};
let seed = 11; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;

/* ---------- 欧式老洋楼（一个模板）：side = -1 西边 / +1 东边；zc 中心；w 沿街长；F 层数；col 墙色；o.shut 百叶颜色 ---------- */
function villa(k, side, zc, w, F, col, o = {}) {
  const P = k.solid, Gl = k.glass, s = side, FH = 4.2, xa = s * SM.xs, xb = s * (SM.xs + 2.6), xe = s * (SM.xs + 13), H = F * FH;
  const X0 = Math.min(xb, xe), X1 = Math.max(xb, xe), z0 = zc - w / 2, z1 = zc + w / 2, sh = o.shut || C.green, tr = o.trim || C.trim;
  // 楼身（外廊后面）
  P.slab(X0, X1, 0, H, z0, z1, col); k.colSlab(X0, X1, 0, H, z0, z1);
  // 外廊两端的山墙（侧墙）
  for (const zz of [z0, z1 - 0.5]) P.slab(Math.min(xa, xb), Math.max(xa, xb), 0, H, zz, zz + 0.5, col);
  k.colSlab(Math.min(xa, xb), Math.max(xa, xb), 0, H, z0, z0 + 0.5); k.colSlab(Math.min(xa, xb), Math.max(xa, xb), 0, H, z1 - 0.5, z1);
  // 勒脚、各层楼板（外廊地面）、檐口、女儿墙
  P.slab(Math.min(xa, xe) - 0.05, Math.max(xa, xe) + 0.05, 0, 0.5, z0 - 0.05, z1 + 0.05, hex('#BFB6A6'), { ao: false });
  for (let f = 1; f < F; f++) P.slab(Math.min(xa, xb) - (s < 0 ? 0 : 0.15), Math.max(xa, xb) + (s > 0 ? 0 : 0.15), f * FH - 0.3, f * FH, z0, z1, tr, { ao: false });
  P.slab(Math.min(xa, xe) - 0.35, Math.max(xa, xe) + 0.35, H, H + 0.35, z0 - 0.35, z1 + 0.35, tr, { ao: false });
  P.slab(Math.min(xa, xe) - 0.1, Math.max(xa, xe) + 0.1, H + 0.35, H + 1.1, z0 - 0.1, z1 + 0.1, col, { ao: false });
  P.slab(Math.min(xa, xe) - 0.2, Math.max(xa, xe) + 0.2, H + 1.1, H + 1.25, z0 - 0.2, z1 + 0.2, tr, { ao: false });
  // 女儿墙正中的小山花（三角楣）
  const pw = Math.min(7, w * 0.4);
  for (const d of [-1, 1]) P.box(xa - s * 0.05, H + 1.25 + pw * 0.11, zc + d * pw * 0.25, 0.3, 0.22, pw * 0.56, tr, 0, d * 0.4 * -s * 0 + d * 0.38, 0, 1, { ao: false });
  P.box(xa, H + 1.3, zc, 0.35, 0.9, pw * 0.75, col, 0, 0, 0, 1, { ao: false });
  // 柱跨
  const n = Math.max(3, Math.round(w / 3.4)), bay = (w - 0.5 * 2) / n;
  for (let f = 0; f < F; f++) {
    const y0 = f * FH, yT = (f + 1) * FH - 0.3;
    for (let i = 0; i <= n; i++) {
      const z = z0 + 0.5 + i * bay;
      if (f === 0) { P.box(xa - s * 0.35, (y0 + yT) / 2, z, 0.7, yT - y0, 0.7, col, 0, 0, 0, 1, { ao: false }); k.col(xa - s * 0.35, 1.5, z, 0.7, 3, 0.7); P.box(xa - s * 0.35, yT - 0.2, z, 0.85, 0.25, 0.85, tr, 0, 0, 0, 1, { ao: false }); }
      else { P.cyl(xa - s * 0.35, (y0 + yT) / 2, z, 0.42, yT - y0, tr, 10, 0, 0, 0, 0.36); P.box(xa - s * 0.35, yT - 0.12, z, 0.6, 0.2, 0.6, tr, 0, 0, 0, 1, { ao: false }); }
    }
    for (let i = 0; i < n; i++) {
      const zm = z0 + 0.5 + (i + 0.5) * bay, half = bay / 2 - 0.35;
      if (f === 0) {   // 底层拱廊：拱券（半圆）+ 拱上墙
        const spring = yT - half - 0.35, pts = [];
        for (let j = 0; j <= 8; j++) { const a = Math.PI * j / 8; pts.push([xa - s * 0.12, spring + Math.sin(a) * half, zm - Math.cos(a) * half]); }
        P.path(pts, 0.28, tr, 6);
        for (const dz of [-1, 1]) P.box(xa - s * 0.35, (spring + half * 0.55 + yT) / 2, zm + dz * half * 0.82, 0.55, yT - spring - half * 0.55, half * 0.36, col, 0, 0, 0, 1, { ao: false });
        P.box(xa - s * 0.35, yT - 0.12, zm, 0.55, 0.24, bay - 0.7, col, 0, 0, 0, 1, { ao: false });
      } else {   // 楼上外廊：栏杆（扶手 + 宝瓶柱）
        const ry = y0 + 0.95; P.box(xa - s * 0.35, ry, zm, 0.3, 0.12, bay - 0.4, tr, 0, 0, 0, 1, { ao: false }); P.box(xa - s * 0.35, y0 + 0.12, zm, 0.3, 0.16, bay - 0.4, tr, 0, 0, 0, 1, { ao: false });
        for (let b = 0, nb = Math.floor((bay - 0.6) / 0.42); b < nb; b++) P.cyl(xa - s * 0.35, y0 + 0.53, zm - (nb - 1) * 0.21 + b * 0.42, 0.13, 0.7, tr, 6, 0, 0, 0, 0.09);
      }
      // 外廊后墙：落地窗（白框 + 两扇百叶）/ 底层门
      const wx = xb - s * 0.02, wy = y0 + (f === 0 ? 1.55 : 1.75), ww = Math.min(1.5, bay * 0.45), wh = f === 0 ? 2.9 : 2.6;
      P.box(wx, wy, zm, 0.12, wh + 0.3, ww + 0.3, tr, 0, 0, 0, 1, { ao: false });
      if (f === 0 && i % 2 === 1) P.box(wx - s * 0.04, wy - 0.1, zm, 0.06, wh - 0.1, ww - 0.1, C.door, 0, 0, 0, 1, { ao: false });
      else Gl.box(wx - s * 0.05, wy, zm, 0.04, wh, ww, C.glassC);
      if (f > 0) for (const d of [-1, 1]) P.box(wx - s * 0.06, wy, zm + d * (ww / 2 + 0.38), 0.06, wh, 0.62, sh, 0, 0, 0, 1, { ao: false });
    }
  }
  // 侧面 / 背面：简单的窗（从街上斜着看得到侧面）
  for (let f = 0; f < F; f++) for (let j = 0; j < 3; j++) for (const [zz, nz] of [[z0, -1], [z1, 1]]) {
    const xx = s * (SM.xs + 4.5 + j * 3.4), yy = f * FH + 2;
    P.box(xx, yy, zz + nz * 0.04, 1.4, 2.2, 0.08, tr, 0, 0, 0, 1, { ao: false }); Gl.box(xx, yy, zz + nz * 0.08, 1.0, 1.8, 0.03, C.glassC);
    for (const d of [-1, 1]) P.box(xx + d * 0.8, yy, zz + nz * 0.1, 0.5, 1.9, 0.05, sh, 0, 0, 0, 1, { ao: false });
  }
}

/* ---------- 露德圣母堂：白色哥特小教堂，正立面朝街（西），中间一座方塔 + 八角尖塔 ---------- */
export const CHAPEL = { x: 16, z: -139 };
function chapel(k) {
  const P = k.solid, Gl = k.glass, G = k.glow, { x, z } = CHAPEL, W = C.white, gray = hex('#8E8A84');
  const L = 17, Wd = 9, Hw = 7.5;
  P.slab(x, x + L, 0, Hw, z - Wd / 2, z + Wd / 2, W); k.colSlab(x, x + L, 0, Hw, z - Wd / 2, z + Wd / 2);
  P.slab(x - 0.1, x + L + 0.1, 0, 0.6, z - Wd / 2 - 0.1, z + Wd / 2 + 0.1, hex('#D9D4C8'), { ao: false });
  for (const d of [-1, 1]) P.box(x + L / 2, Hw + 1.7, z + d * Wd / 4.2, L + 0.4, 0.25, Wd / 2 + 1.4, gray, 0, d * 0.68, 0, 1, { ao: false });   // 坡屋顶
  // 正立面山墙（三角）
  for (const d of [-1, 1]) P.box(x - 0.05, Hw + 1.5, z + d * Wd / 4.3, 0.4, 0.4, Wd / 2 + 1.2, W, 0, d * 0.68, 0, 1, { ao: false });
  P.box(x + 0.15, Hw + 1.2, z, 0.3, 2.2, 4.5, W, 0, 0, 0, 1, { ao: false });
  // 侧墙扶壁 + 尖拱窗
  for (let i = 0; i < 4; i++) for (const d of [-1, 1]) {
    const xx = x + 3.2 + i * 3.7, zz = z + d * Wd / 2;
    P.box(xx - 1.85, 3.2, zz + d * 0.3, 0.6, 6.4, 0.6, W, 0, 0, 0, 1, { ao: false });
    Gl.box(xx, 3.8, zz + d * 0.03, 1.2, 3.4, 0.05, hex('#5E7FA8'));
    for (const e of [-1, 1]) P.box(xx + e * 0.3, 5.75, zz + d * 0.06, 0.16, 1.0, 0.08, W, 0, 0, e * 0.55, 1, { ao: false });
    P.box(xx, 3.8, zz + d * 0.07, 0.08, 3.4, 0.05, W, 0, 0, 0, 1, { ao: false });
  }
  // 塔：方塔（凸出正立面）+ 钟楼 + 八角尖塔 + 十字架
  const tx = x - 1.6, TW = 3.8;
  P.slab(tx - TW / 2, tx + TW / 2, 0, 13, z - TW / 2, z + TW / 2, W); k.colSlab(tx - TW / 2, tx + TW / 2, 0, 13, z - TW / 2, z + TW / 2);
  for (const yy of [6.6, 13]) P.slab(tx - TW / 2 - 0.2, tx + TW / 2 + 0.2, yy, yy + 0.3, z - TW / 2 - 0.2, z + TW / 2 + 0.2, hex('#ECE8DE'), { ao: false });
  for (const [dx, dz] of [[-1, -1], [-1, 1], [1, -1], [1, 1]]) {   // 四角小尖塔
    P.slab(tx + dx * TW / 2 - 0.25, tx + dx * TW / 2 + 0.25, 0, 13.6, z + dz * TW / 2 - 0.25, z + dz * TW / 2 + 0.25, W, { ao: false });
    P.cyl(tx + dx * TW / 2, 14.5, z + dz * TW / 2, 0.6, 1.8, W, 4, Math.PI / 4, 0, 0, 0.02);
  }
  P.cyl(tx, 14.6, z, 3.0, 3.2, W, 8, Math.PI / 8);                                       // 八角钟楼
  for (let i = 0; i < 8; i += 2) { const a = i / 8 * Math.PI * 2 + Math.PI / 8; P.box(tx + Math.cos(a) * 1.4, 14.7, z + Math.sin(a) * 1.4, 0.06, 1.8, 0.55, hex('#3A3F45'), -a, 0, 0, 1, { ao: false }); }
  P.cyl(tx, 16.3, z, 3.3, 0.25, hex('#ECE8DE'), 8, Math.PI / 8, 0, 0, undefined, { ao: false });
  P.cyl(tx, 20.6, z, 3.0, 8.4, W, 8, Math.PI / 8, 0, 0, 0.12);                           // 尖塔
  P.box(tx, 25.6, z, 0.12, 1.6, 0.12, hex('#C9A34A'), 0, 0, 0, 1, { ao: false }); P.box(tx, 25.9, z, 0.12, 0.12, 0.8, hex('#C9A34A'), 0, 0, 0, 1, { ao: false });
  // 正门：尖拱门（深色木门 + 白色门套）+ 圆花窗
  const fx = tx - TW / 2 - 0.03;
  P.box(fx, 1.6, z, 0.08, 3.2, 1.9, hex('#4A3426'), 0, 0, 0, 1, { ao: false });
  for (const e of [-1, 1]) { P.box(fx - 0.06, 3.6, z + e * 0.45, 0.14, 1.4, 0.2, W, 0, e * 0.6, 0, 1, { ao: false }); P.box(fx - 0.06, 1.6, z + e * 1.05, 0.2, 3.2, 0.25, hex('#ECE8DE'), 0, 0, 0, 1, { ao: false }); }
  P.cyl(fx - 0.02, 5.4, z, 1.7, 0.1, hex('#ECE8DE'), 16, 0, 0, Math.PI / 2);
  Gl.cyl(fx - 0.05, 5.4, z, 1.35, 0.05, hex('#8C6FB0'), 16, 0, 0, Math.PI / 2);
  for (let i = 0; i < 4; i++) P.box(fx - 0.08, 5.4, z, 0.04, 1.3, 0.06, W, 0, i * Math.PI / 4, 0, 1, { ao: false });
  G.box(fx - 0.01, 1.3, z, 0.02, 0.06, 0.06, hex('#FFE7B0'));
  // 门前小院：矮白墙 + 铁栏杆 + 两级台阶
  const yx = SM.xs + 0.3;
  for (const d of [-1, 1]) { P.slab(yx, x + L, 0, 0.6, z + d * (Wd / 2 + 1.5) - 0.2, z + d * (Wd / 2 + 1.5) + 0.2, W, { ao: false }); k.colSlab(yx, x + L, 0, 1.2, z + d * (Wd / 2 + 1.5) - 0.2, z + d * (Wd / 2 + 1.5) + 0.2); }
  for (const [a, b] of [[z - Wd / 2 - 1.5, z - 1.6], [z + 1.6, z + Wd / 2 + 1.5]]) {
    P.slab(yx - 0.2, yx + 0.2, 0, 0.6, a, b, W, { ao: false }); k.colSlab(yx - 0.2, yx + 0.2, 0, 1.2, a, b);
    for (let zz = a + 0.3; zz < b; zz += 0.35) P.box(yx, 0.95, zz, 0.04, 0.7, 0.04, C.iron, 0, 0, 0, 1, { ao: false });
    P.slab(yx - 0.04, yx + 0.04, 1.27, 1.32, a, b, C.iron, { ao: false });
  }
  for (const d of [-1, 1]) P.box(yx, 0.9, z + d * 1.6, 0.5, 1.8, 0.5, W, 0, 0, 0, 1, { ao: false });
  k.g('pave').slab(yx + 0.2, tx - TW / 2, 0, 0.06, z - Wd / 2 - 1.3, z + Wd / 2 + 1.3, hex('#E2DCD0'), { ao: false });
}

/* ---------- 铜像（拍照的人 / 拉大提琴的人 / 撑伞的女士），站在矮石台上 ---------- */
function statue(k, x, z, ry, kind) {
  const M = k.g('metal'), P = k.solid, B = C.bronze, B2 = hex('#5E4428'), cs = Math.cos(ry), sn = Math.sin(ry);
  const W = (lx, ly, lz) => [x + lx * cs + lz * sn, ly, z - lx * sn + lz * cs];
  const E = (lx, ly, lz, a, b, c, col = B, seg = 2) => { const p = W(lx, ly, lz); M.ellipsoid(p[0], p[1], p[2], a, b, c, col, seg, ry); };
  const T = (a, b, d0, d1, col = B) => M.tubeTaper(W(...a), W(...b), d0, d1, col, 7);
  P.cyl(x, 0.12, z, 1.5, 0.24, hex('#9C978D'), 12, 0, 0, 0, undefined, { ao: false }); k.col(x, 0.6, z, 1.0, 1.2, 1.0);
  const y0 = 0.24;
  if (kind === 'photo') {   // 半蹲着举相机拍照
    for (const sx of [-1, 1]) { T([sx * 0.14, y0 + 0.05, sx > 0 ? -0.15 : 0.2], [sx * 0.15, y0 + 0.5, sx > 0 ? -0.05 : 0.15], 0.17, 0.14); T([sx * 0.15, y0 + 0.5, sx > 0 ? -0.05 : 0.15], [sx * 0.13, y0 + 0.92, 0], 0.18, 0.16); E(sx * 0.14, y0 + 0.05, sx > 0 ? -0.1 : 0.26, 0.12, 0.08, 0.26, B2, 1); }
    E(0, y0 + 1.25, 0.02, 0.42, 0.62, 0.3); E(0, y0 + 0.95, 0, 0.38, 0.3, 0.28);
    E(0, y0 + 1.7, 0.04, 0.22, 0.26, 0.24); E(0, y0 + 1.82, -0.02, 0.24, 0.12, 0.25, B2, 1);
    for (const sx of [-1, 1]) { T([sx * 0.2, y0 + 1.48, 0], [sx * 0.24, y0 + 1.3, 0.22], 0.11, 0.09); T([sx * 0.24, y0 + 1.3, 0.22], [sx * 0.1, y0 + 1.66, 0.3], 0.09, 0.08); }
    const c = W(0, y0 + 1.68, 0.33); M.box(c[0], c[1], c[2], 0.26, 0.16, 0.12, B2, ry, 0, 0, 1, { ao: false }); const l = W(0, y0 + 1.68, 0.43); M.cyl(l[0], l[1], l[2], 0.09, 0.12, B2, 8, ry, Math.PI / 2);
  } else if (kind === 'cello') {   // 坐在凳子上拉大提琴
    const st = W(0, y0 + 0.24, -0.05); M.box(st[0], st[1], st[2], 0.4, 0.48, 0.36, B2, ry, 0, 0, 1, { ao: false });
    for (const sx of [-1, 1]) { T([sx * 0.13, y0 + 0.5, 0], [sx * 0.2, y0 + 0.5, 0.42], 0.17, 0.15); T([sx * 0.2, y0 + 0.5, 0.42], [sx * 0.22, y0 + 0.05, 0.46], 0.15, 0.12); E(sx * 0.22, y0 + 0.05, 0.54, 0.12, 0.08, 0.24, B2, 1); }
    E(0, y0 + 0.92, 0, 0.4, 0.62, 0.28); E(0, y0 + 1.38, 0.03, 0.21, 0.25, 0.23); E(0, y0 + 1.5, -0.02, 0.23, 0.11, 0.24, B2, 1);
    E(0, y0 + 0.62, 0.42, 0.38, 0.55, 0.16, B2); E(0, y0 + 0.92, 0.4, 0.3, 0.32, 0.14, B2);       // 琴身
    T([0, y0 + 1.05, 0.4], [0, y0 + 1.62, 0.36], 0.05, 0.04, B2); T([0, y0 + 0.3, 0.42], [0, y0 + 0.02, 0.5], 0.03, 0.02, B2);
    T([-0.2, y0 + 1.15, 0], [-0.16, y0 + 1.25, 0.3], 0.1, 0.08); T([-0.16, y0 + 1.25, 0.3], [-0.05, y0 + 1.45, 0.36], 0.08, 0.07);
    T([0.2, y0 + 1.15, 0], [0.32, y0 + 0.95, 0.28], 0.1, 0.08); T([0.32, y0 + 0.95, 0.28], [0.12, y0 + 0.8, 0.5], 0.08, 0.07);
    T([0.36, y0 + 0.9, 0.52], [-0.36, y0 + 0.72, 0.52], 0.025, 0.02, B2);                    // 琴弓
  } else {   // 撑伞散步的女士（长裙）
    M.cyl(x, y0 + 0.5, z, 0.62, 1.0, B, 12, 0, 0, 0, 0.34);
    E(0, y0 + 1.25, 0, 0.34, 0.55, 0.25); E(0, y0 + 1.68, 0.02, 0.2, 0.24, 0.22); E(0, y0 + 1.78, -0.04, 0.22, 0.2, 0.22, B2, 1);
    T([0.18, y0 + 1.42, 0], [0.3, y0 + 1.2, 0.18], 0.09, 0.08); T([0.3, y0 + 1.2, 0.18], [0.26, y0 + 1.42, 0.3], 0.08, 0.07);
    T([-0.18, y0 + 1.42, 0], [-0.24, y0 + 1.0, 0.05], 0.09, 0.07);
    T([0.26, y0 + 1.35, 0.3], [0.26, y0 + 2.3, 0.3], 0.03, 0.03, B2);
    const u = W(0.26, y0 + 2.35, 0.3); M.cyl(u[0], u[1], u[2], 1.3, 0.35, B2, 10, 0, 0, 0, 0.06);
  }
}

/* ---------- 大榕树：几根主干、粗枝、垂下来的气根、一大片扁平树冠 ---------- */
function banyan(k, x, z, s = 1) {
  const P = k.solid, bark = C.bark;
  k.shade.shadeBlob(x, z, 7 * s, 7 * s, 0.03, 0.35);
  for (let i = 0; i < 3; i++) { const a = i * 2.1 + rnd(), d = 0.35 * s; P.tubeTaper([x + Math.cos(a) * d, 0, z + Math.sin(a) * d], [x + Math.cos(a) * 0.15, 3.6 * s, z + Math.sin(a) * 0.15], 1.0 * s, 0.6 * s, bark, 9); }
  for (let i = 0; i < 5; i++) { const a = i * 1.257 + rnd() * 0.5, r = 0.9 * s; P.ellipsoid(x + Math.cos(a) * r, 0.2, z + Math.sin(a) * r, 1.0 * s, 0.5 * s, 0.4 * s, bark, 1, -a); }   // 板根
  const tips = [];
  for (let i = 0; i < 6; i++) {
    const a = i / 6 * Math.PI * 2 + rnd() * 0.5, r = (3.8 + rnd() * 1.8) * s, y1 = (5.4 + rnd() * 1.2) * s, t = [x + Math.cos(a) * r, y1, z + Math.sin(a) * r];
    P.tubeTaper([x, 3.3 * s, z], t, 0.55 * s, 0.22 * s, bark, 7); tips.push(t);
    for (let j = 0; j < 3; j++) { const f = 0.35 + j * 0.25, rx = x + (t[0] - x) * f + (rnd() - 0.5) * 0.4, rz = z + (t[2] - z) * f + (rnd() - 0.5) * 0.4, ry = 3.3 * s + (t[1] - 3.3 * s) * f; P.tube([rx, ry, rz], [rx + (rnd() - 0.5) * 0.3, 0.6 + rnd() * 1.6, rz + (rnd() - 0.5) * 0.3], 0.07 * s, C.root, 4); }
  }
  const greens = ['#2F5E2E', '#3A6E34', '#2C5528', '#447A3A', '#356730'], cy = 7.6 * s, R = 7.8 * s;
  const prev = P.tint; P.tint = (px, py) => 0.62 + 0.42 * Math.max(0, Math.min(1, (py - (cy - 2.5 * s)) / (5 * s)));
  P.ellipsoid(x, cy, z, R * 2, 3.4 * s, R * 2, hex(greens[0]), 2);
  for (const t of tips) P.ellipsoid(t[0], t[1] + 1.6 * s, t[2], 6.2 * s, 2.8 * s, 6.2 * s, hex(greens[(tips.indexOf(t) % 4) + 1]), 2);
  for (let i = 0; i < 4; i++) { const a = rnd() * 6.28, r = rnd() * 3 * s; P.ellipsoid(x + Math.cos(a) * r, cy + 1.6 * s, z + Math.sin(a) * r, 5.5 * s, 2.6 * s, 5.5 * s, hex(greens[i % 5]), 2); }
  P.tint = prev;
  k.col(x, 1.5, z, 1.4 * s, 3, 1.4 * s);
}

/* ---------- 欧式铸铁路灯（双灯头） ---------- */
function lamp(k, x, z) {
  const M = k.g('metal'), I = C.iron;
  M.cyl(x, 0.35, z, 0.36, 0.7, I, 8); M.cyl(x, 2.2, z, 0.12, 3.4, I, 8, 0, 0, 0, 0.09); M.cyl(x, 3.95, z, 0.2, 0.12, I, 8);
  M.box(x, 3.7, z, 0.06, 0.06, 1.3, I, 0, 0, 0, 1, { ao: false });
  for (const d of [-1, 1]) { M.cyl(x, 3.85, z + d * 0.62, 0.32, 0.08, I, 8); k.glow.cyl(x, 3.6, z + d * 0.62, 0.24, 0.38, hex('#FFF1CF'), 8, 0, 0, 0, 0.3); M.cyl(x, 3.95, z + d * 0.62, 0.36, 0.12, I, 8, 0, 0, 0, 0.05); }
  M.cyl(x, 4.25, z, 0.14, 0.5, I, 6, 0, 0, 0, 0.02);
  k.col(x, 1.5, z, 0.3, 3, 0.3);
}

export function buildSm(k) {
  seed = 11;
  const P = k.solid, Pv = k.g('pave'), Gs = k.g('grass'), Wt = k.g('gloss'), { z0, z1, zEnd, xs, bw } = SM;
  // —— 沙基涌：水面 + 两岸石砌驳岸 + 岸边铁栏杆（桥口留开）
  Wt.slab(-60, 60, -1.6, -1.3, z1, z0, C.water, { ao: false });
  for (const zz of [z0, z1]) {
    const d = zz === z0 ? -1 : 1;
    P.slab(-60, 60, -1.6, 0, zz + (d > 0 ? 0 : -0.4), zz + (d > 0 ? 0.4 : 0), hex('#A79F92'));
    Pv.slab(-60, 60, -0.05, 0.08, zz + (d > 0 ? 0 : -0.6), zz + (d > 0 ? 0.6 : 0), C.stone2, { ao: false });
    for (const [a, b] of [[-60, -bw - 0.3], [bw + 0.3, 60]]) {
      const rz = zz + d * 0.35; k.colSlab(a, b, 0, 1.6, rz - 0.15, rz + 0.15);
      P.slab(a, b, 1.0, 1.06, rz - 0.04, rz + 0.04, C.iron, { ao: false }); P.slab(a, b, 0.35, 0.39, rz - 0.03, rz + 0.03, C.iron, { ao: false });
      for (let x = a + 0.1; x < b; x += 2.5) P.box(x, 0.55, rz, 0.07, 1.1, 0.07, C.iron, 0, 0, 0, 1, { ao: false });
    }
  }
  // —— 小石桥：桥面（中间微微拱起）+ 两边石栏板 + 桥下拱
  Pv.slab(-bw, bw, -0.5, 0.02, z1 - 0.2, z0 + 0.2, C.stone, { ao: false }); k.colSlab(-bw, bw, -0.6, 0, z1 - 0.5, z0 + 0.5);
  for (const sx of [-1, 1]) {
    P.slab(sx * bw - 0.25, sx * bw + 0.25, 0, 1.0, z1 - 0.6, z0 + 0.6, C.stone2); k.colSlab(sx * bw - 0.25, sx * bw + 0.25, 0, 1.6, z1 - 0.6, z0 + 0.6);
    P.slab(sx * bw - 0.32, sx * bw + 0.32, 1.0, 1.12, z1 - 0.7, z0 + 0.7, C.stone, { ao: false });
    for (const zz of [z1 - 0.6, z0 + 0.6]) P.box(sx * bw, 0.75, zz, 0.6, 1.5, 0.6, C.stone, 0, 0, 0, 1, { ao: false });
  }
  for (const zz of [z0 + 0.2, z1 - 0.2]) for (let j = 0; j < 8; j++) { const a0 = Math.PI * j / 8, a1 = Math.PI * (j + 1) / 8, r = bw - 0.4; P.tube([-Math.cos(a0) * r, -1.5 + Math.sin(a0) * 1.1, zz], [-Math.cos(a1) * r, -1.5 + Math.sin(a1) * 1.1, zz], 0.3, C.stone2, 5); }   // 桥洞拱券（水面上看得到）
  // —— 沙面大街：石板路（大块石板，比站口一侧暖一点）+ 中间林荫带（石砌树池 + 地被）
  Pv.slab(-xs - 14, xs + 14, 0, 0.03, zEnd, z1, C.stone, { ao: false });
  for (let z = z1 - 2; z > zEnd; z -= 3) P.slab(-xs, xs, 0.03, 0.034, z - 0.04, z + 0.04, hex('#B3A998'), { ao: false });   // 石板缝
  const tz = [];
  for (let z = z1 - 10; z > zEnd + 6; z -= 14) tz.push(z);
  for (const z of tz) {
    Gs.slab(-2.0, 2.0, 0, 0.18, z - 4, z + 4, hex('#FFFFFF'), { ao: false });
    for (const sx of [-1, 1]) P.slab(sx * 2.0 - 0.15, sx * 2.0 + 0.15, 0, 0.35, z - 4.15, z + 4.15, C.curb, { ao: false });
    for (const sz of [-1, 1]) P.slab(-2.15, 2.15, 0, 0.35, z + sz * 4 - 0.15, z + sz * 4 + 0.15, C.curb, { ao: false });
    k.colSlab(-2.15, 2.15, 0, 0.6, z - 4.15, z + 4.15);
    banyan(k, (rnd() - 0.5) * 0.8, z, 0.95 + rnd() * 0.2);
  }
  // 两边路灯、长椅（背靠树池、朝两边）
  for (let z = z1 - 6; z > zEnd + 4; z -= 16) for (const sx of [-1, 1]) lamp(k, sx * 7.6, z);
  for (const z of tz) for (const sx of [-1, 1]) D.bench(k, sx * 2.75, 0, z + 1.6, sx > 0 ? -Math.PI / 2 : Math.PI / 2);
  // —— 两边老洋楼（一个模板 × 5）+ 露德圣母堂
  villa(k, -1, -112, 20, 3, hex('#EBD9A6'));
  villa(k, -1, -137, 20, 2, hex('#E8C9BF'), { shut: C.trim });
  villa(k, -1, -164, 22, 3, hex('#EFEBE1'));
  villa(k, 1, -112, 20, 2, hex('#F0E2BE'), { shut: C.trim });
  villa(k, 1, -180, 22, 3, hex('#E9CFC4'));
  chapel(k);
  // 洋楼之间 / 西南角：小花园（矮绿篱 + 普通树），楼后面用树挡住
  for (const [x, z] of [[-16, -188], [-21, -192], [17, -128], [18, -163], [-28, -124], [-28, -150], [28, -150], [28, -100]]) { D.tree(k, x, 0, z, 1.1 + rnd() * 0.3, 0); k.col(x, 1, z, 0.45, 2, 0.45); }
  D.hedge(k, -22, -11, -196.5, -195.5, 0, 0.8);
  // —— 铜像
  statue(k, 5.2, -127, -Math.PI / 2 - 0.5, 'photo');
  statue(k, -5.4, -150, Math.PI / 2, 'cello');
  statue(k, 5.0, -170, -2.6, 'parasol');
  // —— 街尽头：珠江边（江堤 + 栏杆 + 江水，不做对岸）
  P.slab(-60, 60, -1.6, 0.0, zEnd - 0.5, zEnd, hex('#A79F92'));
  Pv.slab(-xs - 14, xs + 14, 0, 0.08, zEnd + 1.2, zEnd, C.stone2, { ao: false });
  for (let x = -24; x <= 24; x += 2.4) P.box(x, 0.55, zEnd + 0.3, 0.22, 1.1, 0.22, C.white, 0, 0, 0, 1, { ao: false });
  P.slab(-24.2, 24.2, 1.05, 1.2, zEnd + 0.15, zEnd + 0.45, C.white, { ao: false });
  for (let x = -23.4; x < 24; x += 0.6) if (Math.abs(((x + 24) % 2.4)) > 0.3) P.box(x, 0.65, zEnd + 0.3, 0.08, 0.8, 0.08, C.white, 0, 0, 0, 1, { ao: false });
  k.colSlab(-60, 60, 0, 1.6, zEnd, zEnd + 0.5);
  Wt.slab(-260, 260, -1.6, -1.3, zEnd - 260, zEnd - 0.5, C.water, { ao: false });
  // 两侧边界（楼后面不让走出去）
  for (const sx of [-1, 1]) k.colSlab(sx * 24 - 0.5, sx * 24 + 0.5, 0, 6, zEnd, z1);
  return { SM, CHAPEL };
}
