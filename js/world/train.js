/*
 * 地铁列车：3 节编组（游戏里缩短了；每节 18m，每侧 3 对门），参照广州地铁 1 号线 A1 / 2 号线 A4·A8：
 *   鼓形车身截面（侧墙微外鼓、圆弧车顶）、黑色车头面罩 + 大挡风玻璃 + 前照灯 + 目的地显示屏、
 *   腰带（1 号线 A1：黄色车身 + 红色腰带；2 号线：香槟色车身 + 蓝色腰带），车顶空调和受电弓；
 *   车内：不锈钢纵向座椅、立柱 + 横杆 + 三角吊环、双排顶灯带、门上方动态线路图、贯通道。
 * 局部坐标：x 沿车长，y=0 为车厢地板顶面（与站台面齐平），z 横向（±1.5）。
 * 车门是实例（车门壳 / 玻璃 / 色带三组），开关门用缓动曲线；碰撞体随车移动。
 */
import { Kit, FONT, FONT_EN, roundRect } from './kit.js';
import { Geo, hex, mix } from '../core/geo.js';
import { bakePerson, randomLook, POSES, preseed } from './people.js';
import { LINES, STATIONS } from '../data/lines.js';
const B = window.BABYLON;

export const CAR_X = [-18.6, 0, 18.6], DOOR_DX = [-6, 0, 6], HALF = 27.9, DOOR_W = 1.4, DOOR_H = 2.0;
export const DOOR_XS = CAR_X.flatMap(c => DOOR_DX.map(d => c + d));
const WHITE = [1, 1, 1], STEEL = hex('#BFC6CE'), DARK = hex('#2A2E33'), INT = hex('#F1F0EC'), FLOORC = hex('#8E979F');
// 涂装（对照实车）：1 号线 A1 型 = 黄色车身 + 红色腰带；2 号线 = 香槟色车身 + 线路蓝腰带
const BODY = { 1: '#F4CF3A', 2: '#E9DEC6' }, STRIPE = { 1: '#D52B1E', 2: '#00629B' };
// 外轮廓（右半，自下而上），左半镜像
const R = [[1.34, -0.95], [1.45, -0.86], [1.5, -0.6], [1.52, 0.2], [1.53, 0.95], [1.515, 1.55], [1.48, 2.05], [1.43, 2.33], [1.33, 2.53], [1.13, 2.68], [0.8, 2.77], [0.4, 2.81], [0, 2.82]];
const OUT = [...R, ...R.slice(0, -1).reverse().map(([z, y]) => [-z, y])];
const RI = [[1.42, 0], [1.45, 0.95], [1.43, 1.55], [1.4, 2.0], [1.33, 2.2], [1.12, 2.3], [0.8, 2.34], [0, 2.36]];
const INN = [...RI, ...RI.slice(0, -1).reverse().map(([z, y]) => [-z, y])];
/** 截取轮廓中 y∈[y0,y1]、且 z 符号为 side（0 = 不限）的连续段 */
function clip(pts, y0, y1, side = 0) {
  const out = []; let cur = [];
  const inside = p => p[1] >= y0 - 1e-6 && p[1] <= y1 + 1e-6 && (side === 0 || Math.sign(p[0]) === side || Math.abs(p[0]) < 1e-6);
  for (let k = 0; k < pts.length; k++) {
    const p = pts[k];
    if (k > 0) {
      const q = pts[k - 1];
      const xs = [];
      for (const yy of [y0, y1]) if ((q[1] - yy) * (p[1] - yy) < 0) { const t = (yy - q[1]) / (p[1] - q[1]); xs.push([t, [q[0] + (p[0] - q[0]) * t, yy]]); }
      xs.sort((u, v) => u[0] - v[0]);
      for (const [, m] of xs) { if (inside(m)) cur.push(m); else if (cur.length) { out.push(cur); cur = []; } }
    }
    if (inside(p)) cur.push(p); else if (cur.length) { out.push(cur); cur = []; }
  }
  if (cur.length) out.push(cur);
  return out.map(c => c.filter((p, i) => i === 0 || Math.hypot(p[0] - c[i - 1][0], p[1] - c[i - 1][1]) > 1e-4)).filter(c => c.length > 1);
}

export class Train {
  constructor(scene, id) {
    this.scene = scene; this.id = id;
    this.kit = new Kit(scene, 'train' + id);
    this.root = this.kit.root;
    const M = this.kit.M;
    this.shellMat = M.paint.clone('trainShell' + id); this.shellMat.roughness = 0.28; this.shellMat.metallic = 0.25; this.shellMat.environmentIntensity = 1.0;
    this.lineMat = M.paint.clone('trainLine' + id); this.lineMat.roughness = 0.3; this.lineMat.albedoColor = B.Color3.FromHexString('#F3D03E');
    this.accentMat = M.paint.clone('trainAccent' + id); this.accentMat.roughness = 0.3;
    this.seatMat = M.paint.clone('trainSeat' + id); this.seatMat.roughness = 0.25;
    this.steelMat = M.metal.clone('trainSteel' + id); this.steelMat.metallic = 0.45; this.steelMat.roughness = 0.25;
    this.glassMat = M.glass.clone('trainGlass' + id); this.glassMat.albedoColor = new B.Color3(0.22, 0.3, 0.36); this.glassMat.alpha = 0.32;
    this.line = 1; this.open = { 1: 0, '-1': 0 }; this.s = 0; this.pos = new B.Vector3(); this.prev = new B.Vector3();
    this.build();
    this.setLine(1);
  }
  build() {
    const k = this.kit, P = k.solid, Mt = k.metal, Gl = k.glow, Gs = k.g('tglass'), Sh = k.g('shell'), Ln = k.g('line'), Ac = k.g('accent'), Se = k.g('seat'), Gloss = k.g('gloss');
    preseed(this.id * 31 + 5);
    this.seats = []; const taken = [];
    const band = (x0, x1, y0, y1, side, geo = Sh) => { for (const c of clip(OUT, y0, y1, side)) geo.extrudeX(c, x0, x1, WHITE); };
    const ibandI = (x0, x1, y0, y1, side) => { for (const c of clip(INN, y0, y1, side)) P.extrudeX(c, x0, x1, INT, { flip: true }); };
    const lower = (x0, x1, yTop) => {
      for (const sd of [-1, 1]) {
        band(x0, x1, -0.95, Math.min(0.38, yTop), sd);
        if (yTop > 0.38) { band(x0, x1, 0.38, Math.min(0.45, yTop), sd, Ac); }
        if (yTop > 0.45) { band(x0, x1, 0.45, Math.min(0.78, yTop), sd, Ln); }
        if (yTop > 0.78) band(x0, x1, 0.78, yTop, sd);
      }
    };
    for (let ci = 0; ci < CAR_X.length; ci++) {
      const cx = CAR_X[ci], x0 = ci === 0 ? -HALF : cx - 9, x1 = ci === CAR_X.length - 1 ? HALF : cx + 9;
      // 地板 + 车底设备 + 转向架
      P.slab(x0, x1, -0.2, 0, -1.44, 1.44, FLOORC, { ao: false });
      P.slab(x0 + 0.1, x1 - 0.1, -0.005, 0.002, -1.0, 1.0, mix(FLOORC, [1, 1, 1], 0.12), { ao: false });
      P.slab(x0 + 2.5, x1 - 2.5, -0.95, -0.2, -1.2, 1.2, hex('#3A3E44'), { ao: false });
      for (const bx of [cx - 6.3, cx + 6.3]) {
        P.rbox(bx, -1.25, 0, 2.6, 0.45, 2.1, DARK, 0.1, 0, { ao: false });
        for (const wx of [-0.85, 0.85]) for (const wz of [-0.72, 0.72]) Mt.cyl(bx + wx, -1.15, wz, 0.84, 0.13, STEEL, 16, 0, Math.PI / 2, 0, undefined, { ao: false });
      }
      // 车门 / 窗户分段
      const doors = DOOR_DX.map(d => cx + d), segs = [];
      let a = x0; for (const d of doors) { segs.push([a, d - 0.7]); a = d + 0.7; } segs.push([a, x1]);
      for (const [sa, sb] of segs) {
        lower(sa, sb, 0.95);
        band(sa, sb, 1.95, 3, 0);
        ibandI(sa, sb, 1.95, 2.4, 0); // 车内：窗上侧墙 + 圆弧顶板
        for (const sd of [-1, 1]) {
          const piers = [[sa, sa + 0.3], [sb - 0.3, sb]]; if (sb - sa > 3.2) piers.push([(sa + sb) / 2 - 0.12, (sa + sb) / 2 + 0.12]);
          for (const [pa, pb] of piers) { band(pa, pb, 0.95, 1.95, sd); ibandI(pa, pb, 0.95, 1.95, sd); }
          Gs.slab(sa + 0.3, sb - 0.3, 0.95, 1.95, sd * 1.505 - 0.012, sd * 1.505 + 0.012, WHITE, { ao: false });
          // 窗框黑边
          P.slab(sa + 0.28, sb - 0.28, 0.93, 0.97, sd * 1.52 - 0.01, sd * 1.52 + 0.01, DARK, { ao: false }); P.slab(sa + 0.28, sb - 0.28, 1.93, 1.97, sd * 1.505 - 0.01, sd * 1.505 + 0.01, DARK, { ao: false });
          ibandI(sa, sb, 0, 0.95, sd);
          k.col((sa + sb) / 2, 1.22, sd * 1.47, sb - sa, 2.45, 0.1, { parent: this.root, dynamic: true });
          // 不锈钢纵向座椅（门之间）
          const qa = sa + (sa === x0 ? 0.55 : 0.32), qb = sb - (sb === x1 ? 0.55 : 0.32);
          // 座椅：线路色玻璃钢座面 + 靠背（随 setLine 变色），下面不锈钢裙板
          Se.rbox((qa + qb) / 2, 0.41, sd * 1.17, qb - qa, 0.07, 0.46, WHITE, 0.03, 0, { ao: false, bevel: 0.025 });
          Se.box((qa + qb) / 2, 0.74, sd * 1.37, qb - qa, 0.56, 0.05, WHITE, 0, sd * 0.12, 0, 1, { ao: false });
          Mt.slab(qa + 0.05, qb - 0.05, 0.02, 0.41, sd * 1.05, sd * 1.4, STEEL, { ao: false });
          const nSeat = Math.round((qb - qa) / 0.5);
          for (let q = 0; q < nSeat; q++) this.seats.push({ x: qa + (qb - qa) * (q + 0.5) / nSeat, sd });
          for (let q = 1; q < nSeat; q++) P.slab(qa + (qb - qa) * q / nSeat - 0.006, qa + (qb - qa) * q / nSeat + 0.006, 0.47, 0.475, sd * 0.97, sd * 1.36, hex('#2A2E33'), { ao: false });
          k.col((qa + qb) / 2, 0.25, sd * 1.2, qb - qa, 0.5, 0.5, { parent: this.root, dynamic: true });
          // 横杆 + 三角吊环
          Mt.tube([qa, 1.92, sd * 1.0], [qb, 1.92, sd * 1.0], 0.032, STEEL, 8);
          for (let hx = qa + 0.3; hx < qb - 0.2; hx += 0.45) {
            P.box(hx, 1.8, sd * 1.0, 0.025, 0.22, 0.012, hex('#E9ECEF'), 0, 0, 0, 1, { ao: false });
            for (const [p1, p2] of [[[hx - 0.07, 1.62, sd], [hx + 0.07, 1.62, sd]], [[hx - 0.07, 1.62, sd], [hx, 1.72, sd]], [[hx + 0.07, 1.62, sd], [hx, 1.72, sd]]]) P.tube(p1, p2, 0.025, hex('#F2C230'), 5);
          }
          // 座椅两端的立柱
          for (const qx of [qa - 0.1, qb + 0.1]) Mt.tube([qx, 0, sd * 1.12], [qx, 2.3, sd * 1.12], 0.038, STEEL, 8);
        }
      }
      for (const d of doors) {
        lower(d - 0.7, d + 0.7, 0);
        band(d - 0.7, d + 0.7, 2.0, 3, 0);
        ibandI(d - 0.7, d + 0.7, 2.0, 2.4, 0);
        for (const sd of [-1, 1]) { P.slab(d - 0.74, d - 0.68, 0, 2.02, sd * 1.5 - 0.03, sd * 1.5 + 0.03, DARK, { ao: false }); P.slab(d + 0.68, d + 0.74, 0, 2.02, sd * 1.5 - 0.03, sd * 1.5 + 0.03, DARK, { ao: false }); P.slab(d - 0.74, d + 0.74, 1.99, 2.04, sd * 1.5 - 0.03, sd * 1.5 + 0.03, DARK, { ao: false }); Mt.slab(d - 0.7, d + 0.7, -0.005, 0.004, sd * 1.25, sd * 1.5, STEEL, { ao: false }); }
        Mt.tube([d, 0, 0], [d, 2.3, 0], 0.045, STEEL, 10); // 门区中间立柱
      }
      // 车顶内部：双排灯带 + 中间送风口
      for (const lz of [-0.62, 0.62]) Gl.slab(x0 + 0.4, x1 - 0.4, 2.27, 2.29, lz - 0.09, lz + 0.09, hex('#FFFBF2'), { ao: false });
      P.slab(x0 + 0.4, x1 - 0.4, 2.3, 2.33, -0.22, 0.22, hex('#DADDE0'), { ao: false });
      for (let vx = x0 + 1; vx < x1 - 1; vx += 0.5) P.slab(vx, vx + 0.3, 2.295, 2.3, -0.15, 0.15, hex('#9AA1A8'), { ao: false });
      // 车顶外部：空调机组 + （端车）受电弓
      P.rbox(cx, 2.78, 0, 5, 0.32, 1.9, hex('#CDD2D7'), 0.12, 0, { ao: false, bevel: 0.05 });
      if (ci !== 1) {
        const px = cx + (ci === 0 ? 4 : -4);
        P.slab(px - 0.8, px + 0.8, 2.82, 2.9, -0.6, 0.6, DARK, { ao: false });
        P.tube([px - 0.6, 2.9, 0], [px + 0.1, 3.4, 0], 0.05, DARK, 6); P.tube([px + 0.1, 3.4, 0], [px - 0.3, 3.85, 0], 0.04, DARK, 6);
        P.slab(px - 0.5, px - 0.1, 3.85, 3.9, -0.8, 0.8, hex('#3A3F45'), { ao: false });
      }
      // 车端墙（贯通道开口 1.6×2.2）
      for (const [ex, dir] of [[x0, -1], [x1, 1]]) {
        const end = (ci === 0 && dir < 0) || (ci === CAR_X.length - 1 && dir > 0);
        if (end) continue;
        for (const sz of [-1, 1]) { Sh.slab(ex - dir * 0.06, ex, -0.95, 2.4, sz * 0.8, sz * 1.48, WHITE, { ao: false }); P.slab(ex - dir * 0.07, ex - dir * 0.06, 0, 2.3, sz * 0.8, sz * 1.42, INT, { ao: false }); }
        Sh.slab(ex - dir * 0.06, ex, 2.2, 2.75, -1.3, 1.3, WHITE, { ao: false }); P.slab(ex - dir * 0.07, ex - dir * 0.06, 2.2, 2.34, -0.8, 0.8, INT, { ao: false });
        for (const zz of [-1, 1]) k.col(ex - dir * 0.05, 1.22, zz * 1.13, 0.12, 2.45, 0.66, { parent: this.root, dynamic: true });
      }
      // 贯通道（风挡波纹）
      if (ci < CAR_X.length - 1) {
        const ga = x1, gb = CAR_X[ci + 1] - 9;
        for (let f = 0; f <= 6; f++) { const gx = ga + (gb - ga) * f / 6; for (const zz of [-1, 1]) P.slab(gx - 0.03, gx + 0.03, 0, 2.25, zz * 0.82, zz * 0.9, hex(f % 2 ? '#2E3237' : '#3E434A'), { ao: false }); P.slab(gx - 0.03, gx + 0.03, 2.2, 2.28, -0.9, 0.9, hex(f % 2 ? '#2E3237' : '#3E434A'), { ao: false }); }
        Mt.slab(ga, gb, -0.2, 0.005, -0.85, 0.85, STEEL, { ao: false });
        for (const zz of [-1, 1]) k.col((ga + gb) / 2, 1.1, zz * 0.85, gb - ga + 0.1, 2.2, 0.1, { parent: this.root, dynamic: true });
      }
      // 坐着的乘客（烘焙进静态网格）
      // 髋关节对齐座面（座面顶 0.48）：bakePerson 的 y 是脚底基准，坐姿时髋关节在 y + hip×scale
      for (let q = 0; q < 2; q++) { const sd = q ? 1 : -1, px = cx + (q ? 3 : -3.1), L = randomLook({ phone: q === 0 }), hip = (L.kid ? 0.6 : 0.86) * L.scale; taken.push({ x: px, sd }); bakePerson(P, px, 0.55 - hip, sd * 1.2, sd > 0 ? Math.PI : 0, L, q === 0 ? POSES.sitPhone : POSES.sit); }
    }
    // 空座位：和烘焙乘客（肩宽约 0.5m）重叠的座位算有人
    this.seats.forEach(st => { st.free = !taken.some(t => t.sd === st.sd && Math.abs(t.x - st.x) < 0.6); });
    // 车头（两端）：放样鼓形截面，前脸收窄 + 车顶下压；黑色面罩、挡风玻璃、前照灯、目的地屏
    for (const e of [-1, 1]) {
      const xe = e * HALF, L = 1.5, secs = [];
      for (let s = 0; s <= 5; s++) {
        const t = s / 5, pts = OUT.map(([z, y]) => {
          const zz = z * (1 - 0.13 * t * t - (y > 1.9 ? 0.06 * t * t : 0) - (y < -0.5 ? 0.06 * t : 0));
          const yy = y > 0.9 ? 0.9 + (y - 0.9) * (1 - 0.26 * t * t) : (y < -0.6 ? y + 0.12 * t * t : y);
          return [zz, yy];
        });
        secs.push({ x: xe + e * L * Math.sin(t * Math.PI / 2), pts });
      }
      const ordered = e > 0 ? secs : secs.slice().reverse();
      const colFn = (z, y) => (y > 0.82 ? hex('#1B1E22') : WHITE);
      Sh.loftX(ordered.map(sx => ({ x: sx.x, pts: sx.pts })), WHITE, { flip: e > 0, colFn: (z, y, si) => { const t = e > 0 ? si / 5 : 1 - si / 5; return y > 0.85 && t > 0.15 ? [0.12, 0.13, 0.15] : WHITE; } });
      void colFn;
      // 腰带延续到车头
      const last = secs[5], xf = last.x;
      // 前端盖板（扇形填充）
      const k0 = Sh.p.length / 3, cyF = 1.0;
      Sh.push(xf + e * 0.02, cyF, 0, e, 0, 0, [0.12, 0.13, 0.15]);
      last.pts.forEach(([z, y]) => Sh.push(xf, y, z, e, 0, 0, y > 0.85 ? [0.12, 0.13, 0.15] : WHITE));
      const nP = last.pts.length; for (let q = 0; q < nP; q++) { const a1 = k0 + 1 + q, a2 = k0 + 1 + ((q + 1) % nP); e > 0 ? Sh.i.push(k0, a1, a2) : Sh.i.push(k0, a2, a1); }
      // 挡风玻璃（深色高光）+ 目的地屏位置
      const wz = 1.08, fx = xf + e * 0.035;
      Gloss.quad(...(e < 0 ? [[fx, 1.0, wz], [fx, 1.0, -wz], [fx - e * 0.04, 2.05, -wz * 0.96], [fx - e * 0.04, 2.05, wz * 0.96]] : [[fx, 1.0, -wz], [fx, 1.0, wz], [fx - e * 0.04, 2.05, wz * 0.96], [fx - e * 0.04, 2.05, -wz * 0.96]]), hex('#0B0E12'));
      // 前照灯 + 尾灯（圆角灯组）
      for (const sz of [-1, 1]) {
        P.rbox(xf + e * 0.02, 0.3, sz * 0.9, 0.08, 0.34, 0.6, hex('#15181C'), 0.08, Math.PI / 2, { ao: false });
        Gl.box(xf + e * 0.065, 0.53, sz * 0.98, 0.012, 0.13, 0.36, hex('#FFF7E0'));
        Gl.box(xf + e * 0.065, 0.38, sz * 0.74, 0.012, 0.08, 0.12, hex('#FF3B2E'));
      }
      // 车钩 + 防爬器
      P.rbox(xf - e * 0.05, -0.75, 0, 0.4, 0.3, 1.8, DARK, 0.08, 0, { ao: false });
      P.box(xf + e * 0.15, -0.55, 0, 0.35, 0.16, 0.22, hex('#4A4F55'), 0, 0, 0, 1, { ao: false });
      // 驾驶室内部隔墙
      P.slab(Math.min(xe, xe - e * 0.05), Math.max(xe, xe - e * 0.05), 0, 2.36, -1.42, 1.42, INT, { ao: false });
      P.slab(Math.min(xe, xe - e * 0.06), Math.max(xe, xe - e * 0.06), 0.9, 2.0, -0.4, 0.4, hex('#2A3540'), { ao: false });
      k.col(xe, 1.2, 0, 0.2, 2.6, 3.0, { parent: this.root, dynamic: true });
      this['frontX' + (e > 0 ? 'P' : 'N')] = xf;
    }
    k.col(0, -0.15, 0, HALF * 2, 0.3, 2.9, { parent: this.root, dynamic: true, name: 'trainFloor' });
    k.col(0, 2.6, 0, HALF * 2, 0.3, 3.0, { parent: this.root, dynamic: true });
    // 材质：桶 → 专用材质
    const meshes = k.finish(false), by = k.byBucket;
    if (by.shell) by.shell.material = this.shellMat; if (by.line) by.line.material = this.lineMat; if (by.accent) by.accent.material = this.accentMat; if (by.seat) by.seat.material = this.seatMat; if (by.tglass) by.tglass.material = this.glassMat; if (by.metal) by.metal.material = this.steelMat;
    meshes.forEach(m => { m.alwaysSelectAsActiveMesh = false; });
    this.body = by.shell;
    // 门扇（实例）：门壳（车身色）+ 玻璃 + 线路色带；外侧
    const lf = new Geo(), lg = new Geo(), ll = new Geo(), hw = DOOR_W / 2;
    lf.box(0, 0.47, 0, hw, 0.94, 0.05, WHITE, 0, 0, 0, 1, { ao: false }); lf.box(0, 1.9, 0, hw, 0.2, 0.05, WHITE, 0, 0, 0, 1, { ao: false });
    lf.box(-hw / 2 + 0.06, 1.37, 0, 0.12, 0.86, 0.05, WHITE, 0, 0, 0, 1, { ao: false }); lf.box(hw / 2 - 0.06, 1.37, 0, 0.12, 0.86, 0.05, WHITE, 0, 0, 0, 1, { ao: false });
    lg.box(0, 1.37, 0, hw - 0.22, 0.86, 0.03, WHITE, 0, 0, 0, 1, { ao: false });
    ll.box(0, 0.615, 0, hw, 0.33, 0.056, WHITE, 0, 0, 0, 1, { ao: false });
    // 车门内侧：不锈钢浅灰整扇盖住外壳/色带（局部 z 偏内侧，避免和外壳穿模看到黄色）
    const li = new Geo(), IC = hex('#C8CED4'), ID = hex('#9AA3AB');
    li.box(0, 1.0, 0, hw - 0.02, DOOR_H - 0.08, 0.05, IC, 0, 0, 0, 1, { ao: false });
    li.box(0, 0.55, 0, hw - 0.08, 0.08, 0.06, ID, 0, 0, 0, 1, { ao: false }); // 防撞条
    li.box(0, 1.05, 0, hw - 0.18, 0.05, 0.06, hex('#5A6168'), 0, 0, 0, 1, { ao: false }); // 拉手槽
    this.innerMat = this.kit.M.metal.clone('trainDoorIn' + this.id); this.innerMat.metallic = 0.55; this.innerMat.roughness = 0.35;
    this.innerMat.albedoColor = B.Color3.FromHexString('#C8CED4').toLinearSpace(); this.innerMat.backFaceCulling = false;
    const mk = (g, name, mat) => { const m = g.toMesh(name, this.scene, mat, this.root); m.isVisible = false; return m; };
    this.leafSrc = [mk(lf, 'leafShell', this.shellMat), mk(lg, 'leafGlass', this.glassMat), mk(ll, 'leafLine', this.lineMat), mk(li, 'leafInner', this.innerMat)];
    this.leaves = { 1: [], '-1': [] }; this.doorCols = { 1: [], '-1': [] };
    for (const sg of [-1, 1]) for (const dx of DOOR_XS) {
      for (const lr of [-1, 1]) { const set = this.leafSrc.map(src => { const inst = src.createInstance('lf'); inst.parent = this.root; return inst; }); this.leaves[sg].push({ set, dx, lr, sg }); }
      this.doorCols[sg].push(k.col(dx, 1.0, sg * 1.47, DOOR_W, 2.0, 0.12, { parent: this.root, dynamic: true, name: 'door' }));
    }
    this.setDoors(1, 0); this.setDoors(-1, 0);
    // 线路图（门上方，车内两侧）+ 车头目的地屏：同一张动态贴图（上半 = 线路图，下半 = 目的地）
    this.mapTex = new B.DynamicTexture('map' + this.id, { width: 1024, height: 256 }, this.scene, true);
    this.mapMat = new B.StandardMaterial('mapMat' + this.id, this.scene);
    this.mapMat.diffuseColor = new B.Color3(0, 0, 0); this.mapMat.specularColor = new B.Color3(0, 0, 0); this.mapMat.emissiveTexture = this.mapTex; this.mapMat.disableLighting = true; this.mapMat.backFaceCulling = false;
    const mp = [], mu = [], mi = [];
    const quadUV = (pts, v0, v1) => { const b0 = mp.length / 3; pts.forEach(p => mp.push(...p)); mu.push(0, v0, 1, v0, 1, v1, 0, v1); mi.push(b0, b0 + 1, b0 + 2, b0, b0 + 2, b0 + 3); };
    for (const sg of [-1, 1]) for (const dx of DOOR_XS) {
      const z = sg * 1.36, w = 1.3, y0 = 2.04, y1 = 2.28;
      const xa = dx + (sg > 0 ? -w / 2 : w / 2), xb = dx - (sg > 0 ? -w / 2 : w / 2);
      quadUV([[xa, y0, z], [xb, y0, z], [xb, y1, z], [xa, y1, z]], 0, 0.5);
      P.slab(Math.min(xa, xb) - 0.04, Math.max(xa, xb) + 0.04, y0 - 0.04, y1 + 0.04, z - 0.01 * sg, z + 0.02 * sg, DARK, { ao: false });
    }
    for (const e of [-1, 1]) { const fx = this['frontX' + (e > 0 ? 'P' : 'N')] + e * 0.05; quadUV(e < 0 ? [[fx, 2.08, 0.75], [fx, 2.08, -0.75], [fx + 0.03, 2.3, -0.75], [fx + 0.03, 2.3, 0.75]] : [[fx, 2.08, -0.75], [fx, 2.08, 0.75], [fx - 0.03, 2.3, 0.75], [fx - 0.03, 2.3, -0.75]], 0.5, 1); }
    const mm = new B.Mesh('trainMap', this.scene), vd = new B.VertexData(); vd.positions = mp; vd.uvs = mu; vd.indices = mi; vd.normals = mp.map((_, i) => i % 3 === 1 ? 1 : 0); vd.applyToMesh(mm);
    mm.material = this.mapMat; mm.parent = this.root; mm.isPickable = false;
    this.shadowMeshes = [this.body, by.line, by.paint].filter(Boolean);
  }
  setLine(line) {
    this.line = line;
    const lin = h => B.Color3.FromHexString(h).toLinearSpace();
    this.lineMat.albedoColor = lin(STRIPE[line] || LINES[line].color);
    this.accentMat.albedoColor = lin(STRIPE[line] || LINES[line].color);
    this.shellMat.albedoColor = lin(BODY[line] || BODY[1]);
    this.seatMat.albedoColor = lin(LINES[line].color);
  }
  /** 线路图：当前站 code、行进方向 step（+1/-1）、nextCode 正驶向的站；下半张画车头目的地屏 */
  setMap(line, code, step, nextCode) {
    const L = LINES[line], st = L.stations, i = st.indexOf(code), c = this.mapTex.getContext(), W = 1024, H = 128, Y = 128;
    // —— 上半：门上方动态线路图
    c.fillStyle = '#FBFBFA'; c.fillRect(0, Y, W, H);
    c.fillStyle = L.color; c.fillRect(0, Y, 150, H); c.fillStyle = L.ink; c.font = `700 44px ${FONT}`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(L.zh, 75, Y + 50);
    c.font = `600 22px ${FONT_EN}`; c.fillText(L.en, 75, Y + 96);
    const win = 7, half = 3; let a = Math.max(0, Math.min(st.length - win, i - (step > 0 ? 2 : half + 1))); const vis = st.slice(a, a + win);
    const ordered = step > 0 ? vis : vis.slice().reverse(), x0 = 200, dx = (W - x0 - 60) / (win - 1);
    c.fillStyle = L.color; c.fillRect(x0, Y + 56, dx * (ordered.length - 1), 12);
    ordered.forEach((code2, kk) => {
      const x = x0 + kk * dx, idx = st.indexOf(code2), passed = step > 0 ? idx < i : idx > i, here = code2 === code, nxt = code2 === nextCode;
      if (passed) { c.fillStyle = '#C8CED6'; c.fillRect(x, Y + 56, dx, 12); }
      c.beginPath(); c.arc(x, Y + 62, here || nxt ? 16 : 11, 0, Math.PI * 2); c.fillStyle = passed ? '#C8CED6' : (nxt ? '#FF5A4E' : (here ? '#26C281' : '#FFFFFF')); c.fill();
      c.lineWidth = 5; c.strokeStyle = passed ? '#B8BFC8' : L.color; c.stroke();
      c.fillStyle = passed ? '#9AA3AE' : '#1B1D20'; c.font = `${here || nxt ? 700 : 500} ${here || nxt ? 26 : 22}px ${FONT}`; c.textAlign = 'center'; c.textBaseline = 'alphabetic';
      c.fillText(STATIONS[code2].zh, x, Y + 32); if (STATIONS[code2].x.length || STATIONS[code2].lines.length > 1) { c.fillStyle = '#7A8594'; c.font = `500 15px ${FONT}`; c.fillText('换乘', x, Y + 108); }
    });
    c.fillStyle = '#1B1D20'; c.beginPath(); const ax = W - 22; if (step > 0) { c.moveTo(ax + 12, Y + 62); c.lineTo(ax - 10, Y + 46); c.lineTo(ax - 10, Y + 78); } else { c.moveTo(ax - 12, Y + 62); c.lineTo(ax + 10, Y + 46); c.lineTo(ax + 10, Y + 78); } c.fill();
    // —— 下半：车头目的地屏（黑底，橙色 LED 字）
    const dir = Object.values(L.dirs).find(d => d.step === step) || Object.values(L.dirs)[0];
    c.fillStyle = '#0A0B0C'; c.fillRect(0, 0, W, H);
    c.fillStyle = L.color; roundRect(c, 14, 20, 100, 88, 12); c.fill(); c.fillStyle = L.ink; c.font = `700 70px ${FONT_EN}`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(String(line), 64, 68);
    c.fillStyle = '#FFB547'; c.font = `700 64px ${FONT}`; c.textAlign = 'left'; c.fillText(dir.zh, 140, 52); c.font = `600 28px ${FONT_EN}`; c.fillText(dir.en, 142, 104);
    this.mapTex.update(true);
  }
  /** 打开 / 关闭某一侧车门（sg=+1 局部 +z 侧），f: 0 关 … 1 开（缓动：先外摆再滑开） */
  setDoors(sg, f) {
    this.open[sg] = f;
    const e = f * f * (3 - 2 * f), out = Math.min(1, f * 4);
    for (const l of this.leaves[sg]) {
      const px = l.dx + l.lr * (DOOR_W / 4 + e * (DOOR_W / 2 - 0.02)), pz = l.sg * (1.5 + out * 0.06);
      // i=3 内侧面板：往车厢中心偏（-sg），两侧门都盖住外壳黄漆
      l.set.forEach((m, i) => m.position.set(px, 0, i === 3 ? pz - l.sg * 0.09 : pz));
    }
    const closed = f < 0.7; for (const c of this.doorCols[sg]) c.checkCollisions = closed;
  }
  setPos(x, y, z) { this.prev.copyFrom(this.root.position); this.root.position.set(x, y, z); this.pos.copyFrom(this.root.position); }
  local(p) { return new B.Vector3(p.x - this.root.position.x, p.y - this.root.position.y, p.z - this.root.position.z); }
  contains(p) { const l = this.local(p); return Math.abs(l.x) < HALF - 0.1 && Math.abs(l.z) < 1.42 && l.y > -0.6 && l.y < 2.6; }
  inDoorway(p) { const l = this.local(p); if (Math.abs(l.z) < 1.0 || Math.abs(l.z) > 2.3 || Math.abs(l.y) > 1) return false; return DOOR_XS.some(d => Math.abs(l.x - d) < 0.95); }
  setVisible(v) { this.root.setEnabled(v); }
}
