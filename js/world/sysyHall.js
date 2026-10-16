/*
 * 中山纪念堂内部（单独的“场景”：第一次走进正门时才搭，放在 x = IX 的远处，进去时把车站 / 园区整块关掉）。
 *   八角形大会堂（真实：直径 71m、不设一柱，这里约 1:2），扇形排开的红色座椅（正对舞台），后面三面是二楼楼座（可以走上去），
 *   北面舞台：红色台口 + 大幕 + 台口上方“天下为公”匾；八角穹顶：一圈圈收向中间的天窗，八条金色肋，没有一根柱子。
 *   南边门厅：两道楼梯上二楼 → 沿南墙的走道 → 楼座；门厅南门 = 出去（回到纪念堂正门外）。
 * 性能：座椅用 thin instance（一个网格、一次绘制）；其余全是合批的静态桶 + 发光件，不加灯。
 */
import { Kit } from './kit.js';
import { Geo, hex } from '../core/geo.js';
const B = window.BABYLON;
export const IX = 600;                         // 内部场景放在 x = 600（远离车站，远裁剪面 420 外）
const O = IX, A = 17, T = Math.tan(Math.PI / 8), RC = A / Math.cos(Math.PI / 8), HW = 14;
const F = { x: 0, z: 9 };                       // 舞台台口中点（座椅都朝这里）
const BAL = { d0: 11.4, front: 12.75, d1: 15.6, wall: 17, y: 4.4, top: 5.2, soffit: 4.1 };
const C = {
  wall: hex('#EFE6D3'), panel: hex('#8A5A3A'), floor: hex('#9A6B44'), red: hex('#A8231C'), red2: hex('#7E1A15'), gold: hex('#E3B341'),
  teal: hex('#2F6E73'), cream: hex('#F4EBD8'), blue: hex('#24427A'), seat: hex('#B8262A'), seat2: hex('#8C1B1E'), dark: hex('#3A3430'),
  win: hex('#DCEBF6'), carpet: hex('#8E2A24'), stone: hex('#D9D3C5')
};
// 八个面：法线角 th（-90° = 南 / -z）
const FACES = [-90, -45, 0, 45, 90, 135, 180, 225].map(d => d * Math.PI / 180);
const nrm = th => [Math.cos(th), Math.sin(th)], tan = th => [-Math.sin(th), Math.cos(th)];
const pt = (th, d, u) => { const [nx, nz] = nrm(th), [tx, tz] = tan(th); return [nx * d + tx * u, nz * d + tz * u]; };

export class HallInterior {
  constructor(scene, M) {
    this.scene = scene; const k = this.kit = new Kit(scene, 'hall-int');
    this.seats = []; this.spawn = { x: O, y: 0.05, z: -22, yaw: 0 };
    this.shell(k); this.stage(k); this.balcony(k); this.lobby(k); this.ceiling(k);
    this.groundSeats();
    k.finish();
    this.seatMesh = this.buildSeats(M);
    this.kit.root.setEnabled(false);
  }
  q2(G, a, b, c, d, col) { G.quad(a, b, c, d, col); G.quad(d, c, b, a, col); }
  /** 地面 + 八面墙（南墙开两道门）+ 高窗 */
  shell(k) {
    const P = k.solid, G = k.glow;
    P.cyl(O, -0.04, 0, RC * 2, 0.1, C.floor, 8, Math.PI / 8, 0, 0, undefined, { ao: false });
    k.colSlab(O - 20, O + 20, -0.6, 0, -25, 20);
    // 过道红地毯（中间一条 + 横过道）
    P.slab(O - 0.8, O + 0.8, 0.01, 0.025, -16.9, 3.5, C.carpet, { ao: false });
    FACES.forEach(th => {
      const half = A * T, ry = Math.atan2(nrm(th)[0], nrm(th)[1]);
      const isS = Math.abs(th + Math.PI / 2) < 1e-3, isN = Math.abs(th - Math.PI / 2) < 1e-3;
      const seg = (u0, u1, y0, y1, col) => { const [ax, az] = pt(th, A - 0.01, u0), [bx, bz] = pt(th, A - 0.01, u1); this.q2(P, [O + ax, y0, az], [O + bx, y0, bz], [O + bx, y1, bz], [O + ax, y1, az], col); };
      const solid = (u0, u1, y0, y1) => { if (y0 < 2.4) seg(u0, u1, y0, Math.min(y1, 2.4), C.panel); if (y1 > 2.4) seg(u0, u1, Math.max(y0, 2.4), y1, C.wall); const [cx, cz] = pt(th, A + 0.3, (u0 + u1) / 2); k.col(O + cx, (y0 + y1) / 2, cz, Math.abs(u1 - u0), y1 - y0, 0.6, { ry }); };
      if (isS) { solid(-half, -1.6, 0, HW); solid(1.6, half, 0, HW); solid(-1.6, 1.6, 3.2, BAL.top); solid(-1.6, 1.6, 7.6, HW); }
      else solid(-half, half, 0, HW);
      // 金色腰线
      { const [ax, az] = pt(th, A - 0.03, -half), [bx, bz] = pt(th, A - 0.03, half); this.q2(P, [O + ax, 2.4, az], [O + bx, 2.4, bz], [O + bx, 2.55, bz], [O + ax, 2.55, az], C.gold); }
      // 高窗（南、北两面没有）
      if (!isS && !isN) for (const u of [-3.4, 0, 3.4]) {
        const [ax, az] = pt(th, A - 0.06, u - 0.9), [bx, bz] = pt(th, A - 0.06, u + 0.9); this.q2(G, [O + ax, 8.6, az], [O + bx, 8.6, bz], [O + bx, 12.6, bz], [O + ax, 12.6, az], C.win);
        const [cx, cz] = pt(th, A - 0.05, u - 1.05), [dx, dz] = pt(th, A - 0.05, u + 1.05); this.q2(P, [O + cx, 8.4, cz], [O + dx, 8.4, dz], [O + dx, 12.8, dz], [O + cx, 12.8, cz], C.red);
      }
    });
  }
  /** 舞台：台口墙（z = 9）+ 红色台口 + 大幕 + “天下为公”匾 + 台上 */
  stage(k) {
    const P = k.solid, zf = F.z, half = 4.6, xw = A / Math.cos(Math.PI / 4) - zf;   // 台口墙两端碰到东北 / 西北面的位置
    for (const [x0, x1] of [[-xw, -half], [half, xw]]) { P.slab(O + x0, O + x1, 0, HW, zf, zf + 0.4, C.wall, { aoTop: true }); k.colSlab(O + x0, O + x1, 0, HW, zf, zf + 0.4); P.slab(O + x0, O + x1, 0, 2.4, zf - 0.02, zf, C.panel, { ao: false }); }
    P.slab(O - half, O + half, 7.8, HW, zf, zf + 0.4, C.wall, { ao: false });
    // 台口框：红 + 金边
    for (const s of [-1, 1]) { P.slab(O + s * half - (s > 0 ? 0 : 1.1), O + s * half + (s > 0 ? 1.1 : 0), 0, 7.8, zf - 0.35, zf, C.red, { aoTop: true }); P.slab(O + s * (half + 0.02) - 0.06, O + s * (half + 0.02) + 0.06, 0, 7.8, zf - 0.37, zf - 0.3, C.gold, { ao: false }); }
    P.slab(O - half - 1.1, O + half + 1.1, 6.4, 7.8, zf - 0.35, zf, C.red, { ao: false }); P.slab(O - half, O + half, 6.36, 6.46, zf - 0.37, zf - 0.3, C.gold, { ao: false });
    k.sign(O, 9.4, zf - 0.04, { kind: 'plain', w: 5.6, h: 1.4, bg: '#1E3A6B', fg: '#F2C94C', zh: '天下为公', face: Math.PI, align: 'center' });
    // 舞台
    P.slab(O - half - 0.2, O + half + 0.2, 0, 1.1, zf, 16.6, hex('#7B4A2C'), { ao: false }); k.colSlab(O - half - 0.2, O + half + 0.2, 0, 1.1, zf, 16.6);
    P.slab(O - half, O + half, 0, 1.1, zf - 0.05, zf, C.red2, { ao: false });
    // 大幕（两边收起）+ 檐幕 + 天幕
    for (const s of [-1, 1]) for (let i = 0; i < 4; i++) P.cyl(O + s * (half - 0.35 - i * 0.42), 3.75, zf + 0.6, 0.5, 5.3, i % 2 ? C.red2 : C.red, 8);
    P.slab(O - half, O + half, 5.4, 6.4, zf + 0.3, zf + 0.6, C.red2, { ao: false });
    P.slab(O - half, O + half, 1.1, 6.4, 16.4, 16.6, hex('#2B3E66'), { ao: false });
    k.glow.slab(O - 3.5, O + 3.5, 1.12, 1.16, zf + 1.2, zf + 1.6, hex('#FFE7A8'), { ao: false });   // 台口脚光
    // 台上的讲台 + 两盆花
    P.slab(O - 0.6, O + 0.6, 1.1, 2.15, 12.2, 12.8, hex('#6B3F22'));
    for (const s of [-1, 1]) { P.cyl(O + s * 2.6, 1.45, 11.0, 0.7, 0.7, hex('#6B3F22'), 8); P.sphere(O + s * 2.6, 2.05, 11.0, 0.9, hex('#E8443A'), 1); }
  }
  /** 二楼楼座：南、西南、东南三面（沿墙一条走道 → 三排逐级降低的座椅 → 前面的走道 + 栏板） */
  balcony(k) {
    const P = k.solid, faces = FACES.filter(th => [-90, -135, -45].some(d => Math.abs(th - d * Math.PI / 180) < 1e-3 || Math.abs(th - (d + 360) * Math.PI / 180) < 1e-3));
    const rows = [[BAL.front, 13.7, 4.6], [13.7, 14.65, 4.8], [14.65, BAL.d1, 5.0]];
    faces.forEach(th => {
      const [nx, nz] = nrm(th), ry = Math.atan2(nx, nz);
      // 楼板（每一级一块梯形棱柱，底面统一在 soffit）
      const prism = (d0, d1, y1, col) => {
        const p = (d, s) => { const [x, z] = pt(th, d, s * d * T); return [O + x, z]; };
        const [a, b, c, e] = [p(d0, -1), p(d0, 1), p(d1, 1), p(d1, -1)];
        this.q2(P, [a[0], y1, a[1]], [b[0], y1, b[1]], [c[0], y1, c[1]], [e[0], y1, e[1]], col);
        this.q2(P, [a[0], BAL.soffit, a[1]], [b[0], BAL.soffit, b[1]], [b[0], y1, b[1]], [a[0], y1, a[1]], C.cream);
        this.q2(P, [a[0], BAL.soffit, a[1]], [b[0], BAL.soffit, b[1]], [c[0], BAL.soffit, c[1]], [e[0], BAL.soffit, e[1]], C.cream);
        for (const [u, v] of [[a, e], [b, c]]) this.q2(P, [u[0], BAL.soffit, u[1]], [v[0], BAL.soffit, v[1]], [v[0], y1, v[1]], [u[0], y1, u[1]], C.cream);
      };
      prism(BAL.d0, BAL.front, BAL.y, C.carpet);
      for (const [d0, d1, y] of rows) prism(d0, d1, y, C.carpet);
      prism(BAL.d1, BAL.wall, BAL.top, C.carpet);
      // 碰撞：前走道（平）+ 座椅区（斜坡）+ 后走道（平）
      const len = d => 2 * d * T + 0.6;
      const flat = (d0, d1, y) => { const [cx, cz] = pt(th, (d0 + d1) / 2, 0); k.col(O + cx, y - 0.15, cz, len(d1), 0.3, d1 - d0, { ry }); };
      flat(BAL.d0, BAL.front, BAL.y); flat(BAL.d1, BAL.wall + 0.3, BAL.top);
      { const dz = BAL.d1 - BAL.front, dy = BAL.top - BAL.y, L = Math.hypot(dz, dy), a = Math.atan2(dy, dz), t = 0.3, dm = (BAL.front + BAL.d1) / 2, ym = (BAL.y + BAL.top) / 2;
        const [cx, cz] = pt(th, dm + Math.sin(a) * t / 2, 0); k.col(O + cx, ym - Math.cos(a) * t / 2, cz, len(BAL.d1), t, L, { ry, rx: -a }); }
      // 栏板：红色 + 金色扶手，0.75m 高（小朋友站在栏板后能看到楼下；碰撞体比栏板高，不会掉下去）
      { const [cx, cz] = pt(th, BAL.d0 + 0.1, 0), L = 2 * BAL.d0 * T + 0.2; P.box(O + cx, BAL.y + 0.35, cz, L, 0.7, 0.2, C.red, ry, 0, 0, 1, { ao: false }); P.box(O + cx, BAL.y + 0.73, cz, L + 0.05, 0.08, 0.28, C.gold, ry, 0, 0, 1, { ao: false }); k.col(O + cx, BAL.y + 0.7, cz, L, 1.4, 0.3, { ry });
        P.box(O + cx - nx * 0.11, BAL.y - 0.1, cz - nz * 0.11, L, 0.5, 0.03, C.gold, ry, 0, 0, 1, { ao: false }); }
      // 楼座两头（西、东）的栏板
      const endS = Math.abs(th + Math.PI / 4) < 1e-3 ? 1 : (Math.abs(th - 1.25 * Math.PI) < 1e-3 || Math.abs(th + 0.75 * Math.PI) < 1e-3) ? -1 : 0;
      if (endS) { const [ax, az] = pt(th, BAL.d0, endS * BAL.d0 * T), [bx, bz] = pt(th, BAL.wall, endS * BAL.wall * T), L = Math.hypot(bx - ax, bz - az), ery = Math.atan2(bx - ax, bz - az), cx = O + (ax + bx) / 2, cz = (az + bz) / 2;
        P.box(cx, BAL.top + 0.2, cz, 0.2, 1.6, L, C.red, ery, 0, 0, 1, { ao: false }); P.box(cx, BAL.top + 1.03, cz, 0.28, 0.08, L, C.gold, ery, 0, 0, 1, { ao: false }); k.col(cx, BAL.top + 0.3, cz, 0.3, 2.2, L, { ry: ery }); }
      // 座椅（三排）
      rows.forEach(([d0, d1, y]) => { const d = (d0 + d1) / 2 + 0.05, half = d * T - 0.45; for (let u = -half; u <= half + 1e-3; u += 0.62) { const [x, z] = pt(th, d, u); this.addSeat(x, y, z); } });
    });
  }
  /** 一楼扇形座椅：以台口中点为圆心，14 排，四条放射形过道 */
  groundSeats() {
    const aisles = [-50, -22, 22, 50].map(d => d * Math.PI / 180);
    for (let i = 0; i < 14; i++) {
      const r = 5.0 + i * 0.95, span = 72 * Math.PI / 180, step = 0.62 / r;
      for (let ph = -span; ph <= span + 1e-6; ph += step) {
        if (aisles.some(a => Math.abs(ph - a) * r < 0.75)) continue;
        if (Math.abs(ph) * r < 0.9) continue;                                     // 中间红地毯过道
        const x = F.x + r * Math.sin(ph), z = F.z - r * Math.cos(ph);
        if (FACES.some(th => { const [nx, nz] = nrm(th); return x * nx + z * nz > A - 1.1; })) continue;
        if (z < -15.8) continue;
        this.addSeat(x, 0, z);
      }
    }
  }
  addSeat(x, y, z) { const face = Math.atan2(F.x - x, F.z - z); this.seats.push({ wx: O + x, wy: y, wz: z, face, free: true, world: true, id: this.seats.length }); }
  /** 座椅原型（坐垫 + 靠背 + 支架，36 个三角形）→ thin instance，一次绘制 */
  buildSeats(M) {
    const g = new Geo(), o = { ao: false };
    g.box(0, 0.24, -0.06, 0.12, 0.48, 0.34, C.dark, 0, 0, 0, 1, o);
    g.box(0, 0.47, 0.02, 0.52, 0.1, 0.46, C.seat, 0, 0, 0, 1, o);
    g.box(0, 0.74, -0.22, 0.52, 0.5, 0.09, C.seat2, 0, -0.14, 0, 1, o);   // 靠背矮一点（顶 ≈ 1.0m）：坐着时身后镜头能看到主角的肩和头
    const mesh = g.toMesh('hallSeats', this.scene, M.paint, this.kit.root);
    const buf = new Float32Array(this.seats.length * 16), m = new B.Matrix(), q = new B.Quaternion(), s = new B.Vector3(1, 1, 1), t = new B.Vector3();
    this.seats.forEach((st, i) => { B.Quaternion.RotationYawPitchRollToRef(st.face, 0, 0, q); t.set(st.wx, st.wy, st.wz); B.Matrix.ComposeToRef(s, q, t, m); m.copyToArray(buf, i * 16); });
    mesh.thinInstanceSetBuffer('matrix', buf, 16, true); mesh.thinInstanceRefreshBoundingInfo(false);
    mesh.isPickable = false; mesh.receiveShadows = true; mesh.freezeWorldMatrix();
    return mesh;
  }
  /** 门厅：南墙外，两道楼梯上二楼走道（沿南墙），南门出去 */
  lobby(k) {
    const P = k.solid, z0 = -24, z1 = -A, xl = 12.5;
    P.slab(O - xl, O + xl, 0, 0.01, z0, z1, C.stone, { ao: false });
    P.slab(O - 1.2, O + 1.2, 0.01, 0.025, z0, z1, C.carpet, { ao: false });
    for (const s of [-1, 1]) { P.slab(O + s * xl - (s > 0 ? 0 : 0.4), O + s * xl + (s > 0 ? 0.4 : 0), 0, 8.6, z0, z1, C.wall, { aoTop: true }); k.colSlab(O + s * xl - (s > 0 ? 0 : 0.4), O + s * xl + (s > 0 ? 0.4 : 0), 0, 8.6, z0, z1); }
    // 南墙（中间是出去的大门：亮白色）
    for (const [a, b] of [[-xl, -1.8], [1.8, xl]]) { P.slab(O + a, O + b, 0, 8.6, z0 - 0.4, z0, C.wall, { aoTop: true }); k.colSlab(O + a, O + b, 0, 8.6, z0 - 0.4, z0); }
    P.slab(O - 1.8, O + 1.8, 3.6, 8.6, z0 - 0.4, z0, C.wall, { ao: false });
    k.glow.slab(O - 1.8, O + 1.8, 0, 3.6, z0 - 0.5, z0 - 0.42, hex('#F6FAFF'), { ao: false });
    for (const s of [-1, 1]) P.slab(O + s * 1.8 - 0.12, O + s * 1.8 + 0.12, 0, 3.7, z0 - 0.02, z0 + 0.08, C.red, { ao: false });
    k.colSlab(O - 3, O + 3, 0, 4, z0 - 1.6, z0 - 1.2);
    k.sign(O, 4.2, z0 + 0.06, { kind: 'plain', w: 2.6, h: 0.6, bg: '#1F7A3A', fg: '#FFFFFF', zh: '出口', en: 'Exit', face: 0, align: 'center' });
    P.slab(O - xl, O + xl, 8.6, 8.8, z0, z1, C.cream, { ao: false });
    for (const s of [-1, 1]) { const a = s > 0 ? A * T : -xl, b = s > 0 ? xl : -A * T; P.slab(O + a, O + b, 0, 8.6, z1, z1 + 0.4, C.wall, { aoTop: true }); k.colSlab(O + a, O + b, 0, 8.6, z1, z1 + 0.4); }
    // 楼梯（东西各一道，沿 x 往两边上）+ 二楼平台 + 沿南墙的走道（过门洞上方）
    for (const s of [-1, 1]) {
      k.stairs('x', O + s * 2.6, 0, O + s * 10.4, BAL.top, -21.4, -19.6, 0, C.stone, { rails: true });
      P.slab(O + s * 10.4 - (s > 0 ? 0 : 1.7), O + s * 10.4 + (s > 0 ? 1.7 : 0), BAL.top - 0.3, BAL.top, -21.6, z1, C.stone, { ao: false });
      k.colSlab(O + s * 10.4 - (s > 0 ? 0 : 1.7), O + s * 10.4 + (s > 0 ? 1.7 : 0), BAL.top - 0.3, BAL.top, -21.6, z1);
      k.sign(O + s * 2.0, 2.4, -19.55, { kind: 'plain', w: 2.4, h: 0.55, bg: '#1E3A6B', fg: '#FFFFFF', zh: '楼座 ↑', en: 'Balcony', face: Math.PI, align: 'center' });
    }
    P.slab(O - 10.4, O + 10.4, BAL.top - 0.3, BAL.top, -18.7, z1, C.stone, { ao: false }); k.colSlab(O - 10.4, O + 10.4, BAL.top - 0.3, BAL.top, -18.7, z1);
    // 走道栏杆（门厅一侧）
    P.slab(O - 10.4, O + 10.4, BAL.top, BAL.top + 1.0, -18.75, -18.68, hex('#CFE3EE'), { ao: false }); P.slab(O - 10.4, O + 10.4, BAL.top + 1.0, BAL.top + 1.08, -18.8, -18.62, C.gold, { ao: false });
    k.colSlab(O - 10.4, O + 10.4, BAL.top, BAL.top + 1.3, -18.85, -18.6);
    // 门厅里的小知识牌
    k.sign(O + 6.2, 2.0, z1 - 0.05, { kind: 'plain', w: 4.2, h: 0.9, bg: '#F4EBD8', fg: '#7E1A15', zh: '大厅里一根柱子都没有！', en: '71 m wide, no columns', face: Math.PI, align: 'center' });
    // 门厅吊灯（发光件）
    for (const x of [-6, 0, 6]) k.glow.sphere(O + x, 7.4, -20.5, 0.9, hex('#FFF1CC'), 1);
  }
  /** 八角穹顶：墙顶 → 三圈逐渐收小 → 中间天窗；八条金肋；檐口一圈灯 */
  ceiling(k) {
    const P = k.solid, G = k.glow, rings = [[RC, HW], [RC * 0.68, HW + 4.2], [RC * 0.36, HW + 6.8], [RC * 0.14, HW + 7.8]], cols = [C.cream, hex('#DCE8E6'), C.cream];
    for (let r = 0; r < rings.length - 1; r++) for (let i = 0; i < 8; i++) {
      const a0 = FACES[i] - Math.PI / 8, a1 = FACES[i] + Math.PI / 8, [R0, y0] = rings[r], [R1, y1] = rings[r + 1];
      const p = (a, R, y) => [O + Math.cos(a) * R, y, Math.sin(a) * R];
      this.q2(P, p(a0, R0, y0), p(a1, R0, y0), p(a1, R1, y1), p(a0, R1, y1), cols[r]);
    }
    { const [R, y] = rings[3]; G.cyl(O, y + 0.05, 0, R * 2, 0.1, hex('#FFF6DD'), 8, Math.PI / 8, 0, 0, undefined, { ao: false }); }
    for (let i = 0; i < 8; i++) { const a = FACES[i] - Math.PI / 8; P.path(rings.map(([R, y]) => [O + Math.cos(a) * (R - 0.15), y - 0.15, Math.sin(a) * (R - 0.15)]), 0.32, C.gold, 5); }
    for (const [R, y] of rings.slice(0, 3)) for (let i = 0; i < 8; i++) { const a0 = FACES[i] - Math.PI / 8, a1 = FACES[i] + Math.PI / 8; P.tube([O + Math.cos(a0) * (R - 0.2), y - 0.2, Math.sin(a0) * (R - 0.2)], [O + Math.cos(a1) * (R - 0.2), y - 0.2, Math.sin(a1) * (R - 0.2)], 0.22, i % 2 ? C.gold : C.teal, 4); }
    for (let i = 0; i < 24; i++) { const a = i / 24 * Math.PI * 2; G.sphere(O + Math.cos(a) * (RC - 1.6), HW - 0.4, Math.sin(a) * (RC - 1.6), 0.36, hex('#FFF1CC'), 1); }
  }
  setEnabled(v) { this.kit.root.setEnabled(v); this.active = v; }
  update() {}
  wantsExit(p) { return p.z < -23.3 && Math.abs(p.x - O) < 2.2 && p.y < 2; }
  /** 离玩家最近的空座位（水平 0.9m 内，高度差 1m 内） */
  seatNear(p) { let best = null, bd = 0.9; for (const s of this.seats) { if (!s.free || Math.abs(p.y - s.wy) > 1) continue; const d = Math.hypot(p.x - s.wx, p.z - s.wz); if (d < bd) { bd = d; best = s; } } return best; }
  info() { return { seats: this.seats.length, active: !!this.active }; }
  dispose() { this.seatMesh.dispose(); this.kit.dispose(); }
}
