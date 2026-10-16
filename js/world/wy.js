/*
 * 越秀公园站 B1 出口：五羊石像（只做石像 + 它站的小山岗 + 上山的石阶，公园其它部分不做）。
 *   - 出站往南过马路，正对一座树木葱茏的小山岗（越秀山木壳岗的意思），中轴一条花岗石台阶（中间一个歇脚平台）上到山顶平台；
 *   - 山顶：两层八角红花岗石基座 + 一堆嶙峋的红石，五只石羊：中间最高的大公羊昂头、口衔稻穗，四只小一些的围着（低头吃草、回头、卧着、母羊带小羊）；
 *   - 全部红花岗石色（几种深浅），并进一个单独的 Kit（只在地面上启用），只多几次绘制。
 */
import { hex } from '../core/geo.js';
import * as D from './decor.js';

export const WY = { cx: 0, cz: -106, R0: 16, R1: 5.5, H: 5.0, z0: -86, zl: -92.6, yl: 2.3 };
const GR = ['#9B4E45', '#A85C50', '#8E463E', '#B06656'].map(hex);   // 红花岗石
const C = { stone: hex('#C9C1B5'), stone2: hex('#B5AC9F'), granite: hex('#D2CCC2'), rice: hex('#B87060') };
let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;

/** 一只石羊：脚底中心 (x,y,z)、朝向 ry（局部 +z 为头）、大小 s；pose：stand 昂头 / graze 低头 / back 回头 / lie 卧 */
function ram(g, x, y, z, ry, s, pose = 'stand', col = GR[0], rice = false) {
  const cs = Math.cos(ry), sn = Math.sin(ry);
  const W = (lx, ly, lz) => [x + (lx * cs + lz * sn) * s, y + ly * s, z + (-lx * sn + lz * cs) * s];
  const lie = pose === 'lie', by = lie ? 0.48 : 1.0;
  const col2 = col === GR[0] ? GR[2] : GR[0];
  let p = W(0, by, 0); g.ellipsoid(p[0], p[1], p[2], 0.82 * s, 0.74 * s, 1.5 * s, col, 2, ry);                 // 身子（羊毛团）
  p = W(0, by + 0.2, -0.3); g.ellipsoid(p[0], p[1], p[2], 0.7 * s, 0.5 * s, 0.7 * s, col, 1, ry);              // 后背
  if (!lie) for (const [lx, lz] of [[-0.22, -0.48], [0.22, -0.48], [-0.22, 0.46], [0.22, 0.46]]) { p = W(lx, 0.33, lz); g.cyl(p[0], p[1], p[2], 0.22 * s, 0.68 * s, col2, 8); p = W(lx, 0.04, lz); g.cyl(p[0], p[1], p[2], 0.2 * s, 0.08 * s, col2, 8); }
  else for (const lx of [-0.3, 0.3]) { p = W(lx, 0.12, 0.62); g.ellipsoid(p[0], p[1], p[2], 0.18 * s, 0.14 * s, 0.42 * s, col2, 1, ry); }
  p = W(0, by + 0.05, -0.78); g.sphere(p[0], p[1], p[2], 0.2 * s, col, 1);                                         // 尾巴
  // 脖子 + 头：stand 昂头朝前上方；graze 低头；back 回头（头朝一侧后方）
  const hd = pose === 'graze' ? [0, by - 0.35, 1.05] : pose === 'back' ? [0.55, by + 0.75, 0.25] : pose === 'lie' ? [0, by + 0.62, 0.78] : [0, by + 1.05, 0.98];
  const nb = W(0, by + 0.25, 0.55), nh = W(hd[0] * 0.8, hd[1] - 0.1, hd[2] - 0.12);
  g.tubeTaper(nb, nh, 0.5 * s, 0.32 * s, col, 8); g.sphere(nb[0], nb[1], nb[2], 0.5 * s, col, 1);
  const hy = pose === 'back' ? ry + 1.9 : ry, hp = W(...hd), hc = Math.cos(hy), hs = Math.sin(hy);
  const pitch = pose === 'graze' ? 0.9 : pose === 'stand' ? -0.15 : 0.2;
  g.ellipsoid(hp[0], hp[1], hp[2], 0.34 * s, 0.38 * s, 0.6 * s, col, 2, hy, pitch);
  const H = (lx, ly, lz) => [hp[0] + (lx * hc + lz * hs) * s, hp[1] + ly * s, hp[2] + (-lx * hs + lz * hc) * s];
  // 卷角：从头顶两侧往后、往下、再往前卷一圈
  for (const sd of [-1, 1]) {
    const pts = [];
    for (let i = 0; i <= 8; i++) { const t = i / 8, a = Math.PI * (0.35 + 1.5 * t), r = 0.26 * (1 - 0.45 * t); pts.push(H(sd * (0.14 + 0.16 * t), 0.12 + Math.sin(a) * r, -0.12 - Math.cos(a) * r * -1 - 0.18)); }
    g.path(pts, 0.13 * s, col2, 6);
  }
  for (const sd of [-1, 1]) { const e = H(sd * 0.2, 0.06, 0.02); g.ellipsoid(e[0], e[1], e[2], 0.08 * s, 0.05 * s, 0.18 * s, col2, 1, hy + sd * 0.6); }   // 耳朵
  if (rice) {   // 口衔稻穗：三束稻秆从嘴里垂到两边，穗头一串小粒
    const m = H(0, -0.12, 0.34);
    for (const [dx, dz, dy] of [[-0.38, 0.12, -0.95], [0.34, 0.1, -0.9], [0.06, 0.32, -1.05]]) {
      const e = H(dx, -0.12 + dy * 0.4, 0.34 + dz), f = H(dx * 1.25, -0.12 + dy, 0.34 + dz * 1.2);
      g.tube(m, e, 0.05 * s, C.rice, 5); g.tube(e, f, 0.04 * s, C.rice, 5);
      for (let k = 0; k < 4; k++) { const t = 0.35 + k * 0.2, q = [e[0] + (f[0] - e[0]) * t, e[1] + (f[1] - e[1]) * t, e[2] + (f[2] - e[2]) * t]; g.sphere(q[0], q[1], q[2], 0.11 * s, C.rice, 1, 1.4); }
    }
  }
}

export function buildWy(k) {
  const P = k.solid, Gs = k.g('grass'), Pv = k.g('pave'), { cx, cz, R0, R1, H, z0, zl, yl } = WY;
  seed = 7;
  // 山脚小广场（花岗石铺装 + 路缘）
  Pv.slab(cx - 7, cx + 7, 0, 0.04, z0 + 4, z0 - 1, C.granite, { ao: false });
  // 小山岗：草坡（截头圆锥）+ 坡上几团起伏 + 露出来的石头 + 一圈树
  Gs.cyl(cx, H / 2, cz, 2 * R0, H, hex('#FFFFFF'), 28, 0, 0, 0, 2 * R1 + 0.6, { ao: false });
  for (let i = 0; i < 9; i++) { const a = 0.5 + i * 0.62, r = R0 * (0.55 + rnd() * 0.3), yy = H * (R0 - r) / (R0 - R1); if (Math.sin(a) > 0.85) continue;
    Gs.sphere(cx + Math.cos(a) * r, yy - 0.3, cz + Math.sin(a) * r, 4 + rnd() * 3, hex('#FFFFFF'), 1, 0.35); }
  for (let i = 0; i < 7; i++) { const a = rnd() * 6.28, r = R0 * (0.5 + rnd() * 0.4), yy = H * (R0 - r) / (R0 - R1); if (Math.sin(a) > 0.6) continue;
    P.sphere(cx + Math.cos(a) * r, yy, cz + Math.sin(a) * r, 0.8 + rnd() * 0.8, hex('#9C978D'), 1, 0.6, true); }
  // 碰撞：一层层的八角形（不能从草坡上爬，只能走台阶）
  for (let i = 0; i < 5; i++) { const top = (i + 1) * (H / 5), r = R0 - (R0 - R1) * top / H; for (let a = 0; a < 4; a++) k.col(cx, top - H / 10, cz, 2 * r, H / 5, 0.83 * r, { ry: a * Math.PI / 4 }); }
  // 树：山坡两侧和后面（前面中轴留出看石像的视线）
  const trees = [];
  for (let i = 0; i < 16; i++) { const a = 0.8 + i / 15 * (Math.PI * 2 - 1.6), r = R0 * (0.62 + (i % 3) * 0.13); trees.push([cx + Math.sin(a) * r, cz + Math.cos(a) * r, r]); }   // 角度 0 = 正北（台阶一侧）
  for (const [x, z, r] of trees) { if (z > cz + 6 && Math.abs(x - cx) < 7) continue; const yy = Math.max(0, H * (R0 - r) / (R0 - R1)); D.tree(k, x, yy, z, 1.0 + rnd() * 0.5, rnd() < 0.3 ? 2 : 0); }
  // 石阶：两段（中间一个歇脚平台），两边花岗石栏板（也挡着不让从台阶边上跳到草坡上）
  const xw = 1.8;
  k.stairs('z', z0, 0, zl, yl, cx - xw, cx + xw, 0, '#C9C1B5', { rails: false });
  Pv.slab(cx - xw, cx + xw, 0, yl, zl, zl - 1.4, C.stone, { aoTop: true }); k.colSlab(cx - xw, cx + xw, 0, yl, zl - 1.4, zl);
  k.stairs('z', zl - 1.4, yl, cz + R1, H, cx - xw, cx + xw, 0, '#C9C1B5', { rails: false });
  const rail = (za, ya, zb, yb) => {   // 斜栏板：从 (za,ya) 到 (zb,yb)
    const L = Math.hypot(zb - za, yb - ya), rx = Math.atan2(yb - ya, za - zb), zm = (za + zb) / 2, ym = (ya + yb) / 2;
    for (const sx of [-1, 1]) {
      P.box(cx + sx * (xw + 0.18), ym + 0.32, zm, 0.36, 1.25, L + 0.2, C.stone2, 0, rx, 0, 1, { ao: false });
      P.box(cx + sx * (xw + 0.18), ym + 0.97, zm, 0.46, 0.1, L + 0.2, C.granite, 0, rx, 0, 1, { ao: false });
      k.col(cx + sx * (xw + 0.18), ym + 0.6, zm, 0.36, 2.0, L, { rx });
    }
  };
  rail(z0, 0, zl, yl); rail(zl - 1.4, yl, cz + R1, H);
  for (const sx of [-1, 1]) { P.slab(cx + sx * (xw + 0.18) - 0.23, cx + sx * (xw + 0.18) + 0.23, 0, yl + 1.0, zl - 1.4, zl, C.stone2, { ao: false }); k.colSlab(cx + sx * xw, cx + sx * (xw + 0.36), 0, yl + 2, zl - 1.4, zl); }
  for (const sx of [-1, 1]) P.box(cx + sx * (xw + 0.18), 0.7, z0 + 0.1, 0.6, 1.4, 0.6, C.granite, 0, 0, 0, 1, { ao: false });   // 山脚两根望柱
  // 山顶平台：花岗石铺地 + 一圈矮栏杆（台阶口留开）
  Pv.cyl(cx, H - 0.12, cz, 2 * R1 + 0.4, 0.24, C.granite, 24, 0, 0, 0, undefined, { ao: false });
  for (let i = 0; i < 20; i++) { const a = i / 20 * Math.PI * 2; if (Math.abs(a - Math.PI / 2) < 0.38) continue;
    const x = cx + Math.cos(a) * (R1 - 0.1), z = cz + Math.sin(a) * (R1 - 0.1); P.box(x, H + 0.4, z, 0.22, 0.8, 0.22, C.stone2, -a);
    const a2 = (i + 1) / 20 * Math.PI * 2; if (Math.abs(a2 - Math.PI / 2) < 0.38) continue;
    const x2 = cx + Math.cos(a2) * (R1 - 0.1), z2 = cz + Math.sin(a2) * (R1 - 0.1), L = Math.hypot(x2 - x, z2 - z);
    P.box((x + x2) / 2, H + 0.72, (z + z2) / 2, 0.16, 0.1, L, C.granite, Math.atan2(x2 - x, z2 - z)); k.col((x + x2) / 2, H + 0.8, (z + z2) / 2, 0.3, 1.6, L, { ry: Math.atan2(x2 - x, z2 - z) }); }
  // 基座：两层八角红花岗石 + 一堆嶙峋红石
  const y0 = H;
  P.cyl(cx, y0 + 0.4, cz, 5.4, 0.8, GR[2], 8, Math.PI / 8); P.cyl(cx, y0 + 0.85, cz, 5.6, 0.1, GR[1], 8, Math.PI / 8, 0, 0, undefined, { ao: false });
  P.cyl(cx, y0 + 1.25, cz, 4.2, 0.7, GR[0], 8, Math.PI / 8); k.col(cx, y0 + 1.5, cz, 4.6, 3, 4.6);
  const yr = y0 + 1.6;
  for (let i = 0; i < 14; i++) { const a = rnd() * 6.28, r = rnd() * 1.6, s2 = 1.0 + rnd() * 1.1; P.sphere(cx + Math.cos(a) * r, yr + rnd() * 0.5, cz + Math.sin(a) * r, s2, GR[(i % 3) + 1], 1, 0.7, true, 1.2, 1); }
  for (let i = 0; i < 6; i++) { const a = i * 1.05 + 0.3; P.sphere(cx + Math.cos(a) * 0.5, yr + 0.9 + (i % 2) * 0.4, cz + Math.sin(a) * 0.5, 1.3, GR[i % 3 + 1], 1, 0.9, true); }
  // 五只羊：中间最高的大羊（昂头衔稻穗，面朝台阶 = 北），四只围着
  ram(P, cx, yr + 1.25, cz + 0.1, 0.6, 2.15, 'stand', GR[0], true);   // 侧转一点，台阶上看是 3/4 侧面
  ram(P, cx - 1.75, yr + 0.1, cz + 1.0, -0.55, 1.05, 'graze', GR[3]);
  ram(P, cx + 1.8, yr + 0.15, cz + 0.85, 0.75, 1.1, 'back', GR[1]);
  ram(P, cx + 1.25, yr + 0.05, cz - 1.55, 2.4, 1.05, 'lie', GR[3]);
  ram(P, cx - 1.2, yr + 0.05, cz + 1.75, -0.2, 0.55, 'stand', GR[0]);   // 小羊（挨着低头的母羊）
  return { WY };
}
