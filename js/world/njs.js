/*
 * 农讲所站（1 号线）地面：
 *   中山四路北侧：毛泽东同志主办农民运动讲习所旧址（原番禺学宫）。真实布局坐北朝南，中轴线由南往北：
 *     棂星门（三间六柱花岗石牌坊）→ 泮池 + 拱桥 → 大成门 → 庭院 + 东西廊庑 → 大成殿（月台、红墙、黄琉璃瓦）→ 崇圣殿；四周红墙。
 *   中山四路南侧往南：德政中路小巷 → 文明路“糖水街”：两边南洋式骑楼（首层骑楼廊 + 上面两三层带窗套、山花女儿墙），
 *     一间间糖水铺 / 小吃店招牌 + 路中间的小吃车、串串灯笼。
 * 资料：广州市政府“农民运动讲习所”（中山四路 42 号，原番禺学宫，棂星门、泮池、大成门、大成殿、崇圣殿、东西廊庑）；
 *   南方+《广州糖水边度掂？老广带去文明路》（文明路与德政中路交界的“甜蜜路口”、南洋式骑楼）、《文明路，凭什么是广州必吃街》。
 * 德政中路东侧：丽呈铂锐酒店（德政中路 388 号，2026 年开业，离农讲所站步行不到 100m）——深棕色塔楼 + 竖条暖黄窗带、
 *   楼顶金色「丽呈铂锐酒店 REZEN」、门口「我❤广州」灯牌和红色飘带雕塑；室内见 js/game/hotel.js。商场（珠江·星火1926）先不搭。
 * 性能：全部放在单独的 Kit 里（只在地面上启用），只用合批静态桶 + 一张招牌图集，不加灯。
 */
import { hex } from '../core/geo.js';
import { FONT } from './kit.js';
import { hipRoof } from './sysy.js';

export const NJS = { ax: -32, zFront: -60, zBack: 2, x0: -50, x1: -14 };
/** 文明路（东西向）和德政中路小巷（南北向）；世界往南扩到 ZS */
export const WM = { zN: -103, zS: -113, x0: -58, x1: 58, lane0: 17, lane1: 31, ZS: -128 };
/** 丽呈铂锐酒店（德政中路东侧，农讲所站出口往南不到 100m）：塔楼占地；文明路北排这几间不建 */
export const HOTEL = { x0: 31.3, x1: 50, z0: -102.6, z1: -84 };
/** 文明路上留空的铺位（给以后的糖水店）：[x, 骑楼正面 z] */
export const EMPTY_BAYS = [];
/** 酒店正门（朝西，开在德政中路上）：走进这个范围 = 进酒店大堂 */
export const HOTEL_DOOR = { x: 31.5, z: -93, half: 1.3 };
const C = {
  red: hex('#B4412E'), red2: hex('#9E2E20'), redD: hex('#7E2418'), yel: hex('#E0A63A'), yel2: hex('#C98B26'), ridge: hex('#B5762A'),
  granite: hex('#CFC9BC'), stone: hex('#D9D3C5'), stone2: hex('#BFB8A8'), water: hex('#5FA9C9'), pave: hex('#D8D2C4'), green: hex('#3E7B58'),
  dark: hex('#2F3338'), wood: hex('#7A4A2A'), white: hex('#F5F1E8')
};

export function buildNjs(k) {
  institute(k);
  wenming(k);
  hotel(k);
  return { institute: NJS, street: WM };
}

/** 农讲所旧址 */
function institute(k) {
  const P = k.solid, Pv = k.g('pave'), A = NJS.ax, zf = NJS.zFront, zb = NJS.zBack, x0 = NJS.x0, x1 = NJS.x1;
  // 院内铺地 + 草地
  Pv.slab(x0, x1, 0, 0.04, zf, zb, C.pave, { ao: false });
  k.g('grass').slab(x0 + 1, A - 3, 0.04, 0.07, -40, -33, hex('#FFFFFF'), { ao: false }); k.g('grass').slab(A + 3, x1 - 1, 0.04, 0.07, -40, -33, hex('#FFFFFF'), { ao: false });
  // 红墙（黄琉璃瓦压顶），正面在棂星门处开口
  const wall = (ax0, ax1, az0, az1) => {
    P.slab(ax0, ax1, 0, 4.0, az0, az1, C.red, { aoTop: true }); k.colSlab(ax0, ax1, 0, 4.0, az0, az1);
    P.slab(Math.min(ax0, ax1) - 0.25, Math.max(ax0, ax1) + 0.25, 4.0, 4.2, Math.min(az0, az1) - 0.25, Math.max(az0, az1) + 0.25, C.yel2, { ao: false });
    const w = Math.abs(ax1 - ax0), d = Math.abs(az1 - az0), cx = (ax0 + ax1) / 2, cz = (az0 + az1) / 2;
    if (w > d) for (const s of [-1, 1]) P.box(cx, 4.35, cz + s * 0.22, w + 0.3, 0.08, 0.55, C.yel, 0, s * 0.5, 0, 1, { ao: false });
    else for (const s of [-1, 1]) P.box(cx + s * 0.22, 4.35, cz, 0.55, 0.08, d + 0.3, C.yel, 0, 0, -s * 0.5, 1, { ao: false });
    P.slab(Math.min(ax0, ax1) - 0.03, Math.max(ax0, ax1) + 0.03, 0, 0.5, Math.min(az0, az1) - 0.03, Math.max(az0, az1) + 0.03, C.stone2, { ao: false });
  };
  wall(x0, A - 5, zf - 0.4, zf + 0.4); wall(A + 5, x1, zf - 0.4, zf + 0.4);
  wall(x0 - 0.4, x0 + 0.4, zf, zb); wall(x1 - 0.4, x1 + 0.4, zf, zb); wall(x0, x1, zb - 0.4, zb + 0.4);
  // 棂星门：三间六柱花岗石牌坊（中间宽）
  const px = [-4.6, -3.0, -1.4, 1.4, 3.0, 4.6];
  for (const dx of px) {
    Pv.box(A + dx, 3.1, zf, 0.56, 6.2, 0.56, C.granite, 0, 0, 0, 1, { ao: true }); k.col(A + dx, 3.1, zf, 0.56, 6.2, 0.56);
    Pv.box(A + dx, 0.45, zf, 0.9, 0.9, 1.3, C.stone2, 0, 0, 0, 1, { ao: true });           // 抱鼓石底座
    P.sphere(A + dx, 6.45, zf, 0.7, C.granite, 1, 1.3);                                    // 柱头云罐
  }
  for (const [a, b, y] of [[-4.9, -1.1, 4.4], [1.1, 4.9, 4.4], [-1.7, 1.7, 5.3]]) { Pv.slab(A + a, A + b, y, y + 0.45, zf - 0.22, zf + 0.22, C.granite, { ao: false }); Pv.slab(A + a, A + b, y - 0.9, y - 0.6, zf - 0.18, zf + 0.18, C.granite, { ao: false }); }
  for (const [a, b, y] of [[-4.9, -1.1, 3.7], [1.1, 4.9, 3.7], [-1.7, 1.7, 4.6]]) Pv.slab(A + a + 0.3, A + b - 0.3, y - 0.12, y + 0.3, zf - 0.12, zf + 0.12, C.stone, { ao: false });
  k.sign(A, 4.57, zf - 0.24, { kind: 'plain', w: 2.6, h: 0.42, bg: '#CFC9BC', fg: '#7E2418', zh: '棂星门', face: Math.PI, align: 'center', box: false });
  // 门口的牌子（真实的是大门边的黑底金字竖牌）
  k.sign(A - 6.6, 2.4, zf - 0.42, { kind: 'plain', vert: true, w: 0.7, h: 3.4, bg: '#2A1A14', fg: '#F2C94C', zh: '农民运动讲习所旧址', face: Math.PI });
  k.sign(A + 7.4, 1.5, zf - 0.6, { kind: 'plain', w: 2.6, h: 1.25, bg: '#FFF7E8', fg: '#7E2418', zh: '这里原来是番禺学宫（孔庙），1926 年毛泽东在这里办农民运动讲习所', face: Math.PI, align: 'left' });
  P.box(A + 7.4, 0.45, zf - 0.6, 0.12, 0.9, 0.12, C.dark);
  // 泮池（半月形水池）+ 中间的石拱桥
  const pz = zf + 3.0, R = 5.2;
  for (const s of [-1, 1]) {
    const xa = A + s * 1.5, xb = A + s * R;
    k.g('glass').slab(Math.min(xa, xb), Math.max(xa, xb), 0.02, 0.06, pz, pz + 4.2, C.water);
    Pv.slab(Math.min(xa, xb) - 0.25, Math.max(xa, xb) + 0.25, 0, 0.55, pz - 0.25, pz, C.stone2, { ao: false });
    Pv.slab(Math.min(xa, xb) - 0.25, Math.max(xa, xb) + 0.25, 0, 0.55, pz + 4.2, pz + 4.45, C.stone2, { ao: false });
    Pv.slab(xb - (s > 0 ? 0 : 0.25), xb + (s > 0 ? 0.25 : 0), 0, 0.55, pz, pz + 4.2, C.stone2, { ao: false });
    k.colSlab(Math.min(xa, xb), Math.max(xa, xb), 0, 1.0, pz - 0.25, pz + 4.45);
  }
  // 拱桥：三段（坡 - 平 - 坡），两侧石栏
  Pv.box(A, 0.18, pz + 0.7, 3.0, 0.36, 1.4, C.stone, 0, -0.25, 0, 1, { ao: true }); Pv.slab(A - 1.5, A + 1.5, 0.3, 0.52, pz + 1.4, pz + 2.8, C.stone, { ao: true }); Pv.box(A, 0.18, pz + 3.5, 3.0, 0.36, 1.4, C.stone, 0, 0.25, 0, 1, { ao: true });
  for (const s of [-1, 1]) { Pv.slab(A + s * 1.5 - 0.12, A + s * 1.5 + 0.12, 0.3, 1.25, pz + 0.3, pz + 3.9, C.granite, { ao: false }); k.colSlab(A + s * 1.5 - 0.12, A + s * 1.5 + 0.12, 0, 1.3, pz + 0.3, pz + 3.9); }
  // 大成门：面阔 5 间，中间开门
  const gz0 = -47, gz1 = -42.5;
  Pv.slab(A - 10, A + 10, 0, 0.45, gz0 - 0.8, gz1 + 0.8, C.stone, { ao: true });
  for (const [a, b] of [[-9, -2], [2, 9]]) { P.slab(A + a, A + b, 0.45, 4.6, gz0 + 0.8, gz1 - 0.8, C.red, { aoTop: true }); k.colSlab(A + a, A + b, 0, 4.6, gz0 + 0.8, gz1 - 0.8); }
  for (let i = -3; i <= 3; i++) for (const z of [gz0 + 0.2, gz1 - 0.2]) P.cyl(A + i * 3, 2.55, z, 0.44, 4.2, C.red2, 10);
  for (const z of [gz0 + 0.8, gz1 - 0.8]) for (const s of [-1, 1]) P.box(A + s * 2, 2.3, z, 0.12, 3.7, 0.2, C.redD);
  P.slab(A - 9.6, A + 9.6, 4.6, 5.0, gz0, gz1, C.yel2, { ao: false });
  hipRoof(k, A - 10.6, A + 10.6, gz0 - 1.0, gz1 + 1.0, 5.0, 2.2, 3.4, 2.0, C.yel, C.yel2, C.ridge, C.green);
  k.sign(A, 4.1, gz0 + 0.74, { kind: 'plain', w: 2.6, h: 0.6, bg: '#2A1A14', fg: '#F2C94C', zh: '大成门', face: Math.PI, align: 'center' });
  // 东西廊庑：红柱长廊 + 黄瓦单坡
  for (const s of [-1, 1]) {
    const xi = A + s * 12.6, xo = A + s * 16.6, xa = Math.min(xi, xo), xb = Math.max(xi, xo);
    P.slab(xa, xb, 0, 0.35, -41, -19, C.stone, { ao: true });
    P.slab(s > 0 ? xb - 0.6 : xa, s > 0 ? xb : xa + 0.6, 0.35, 3.6, -41, -19, C.red, { aoTop: true }); k.colSlab(s > 0 ? xb - 0.6 : xa, s > 0 ? xb : xa + 0.6, 0, 3.6, -41, -19);
    for (let z = -40.5; z <= -19.4; z += 3) P.cyl(xi, 1.95, z, 0.32, 3.2, C.red2, 8);
    P.box((xi + xo) / 2, 3.95, -30, 4.9, 0.18, 22.6, C.yel, 0, 0, s * 0.22, 1, { ao: false });
    P.slab(xa - 0.2, xb + 0.2, 3.55, 3.7, -41.2, -18.8, C.yel2, { ao: false });
  }
  // 大成殿：月台 + 台阶 + 红柱红墙 + 黄琉璃瓦（单檐歇山的简化）
  const hz0 = -28, hz1 = -16, hw = 12;
  Pv.slab(A - hw - 1, A + hw + 1, 0, 1.0, hz0 - 4, hz1 + 1, C.stone, { ao: true }); k.colSlab(A - hw - 1, A + hw + 1, 0, 1.0, hz0 - 4, hz1 + 1);
  k.stairs('z', hz0 - 6.4, 0, hz0 - 4, 1.0, A - 3, A + 3, 0, '#CFC9BC', { rails: false });
  P.slab(A - hw + 1, A + hw - 1, 1.0, 6.6, hz0 + 1.6, hz1 - 0.4, C.red, { aoTop: true }); k.colSlab(A - hw + 1, A + hw - 1, 1.0, 6.6, hz0 + 1.6, hz1 - 0.4);
  for (let i = 0; i < 8; i++) P.cyl(A - hw + 1.6 + i * (2 * hw - 3.2) / 7, 3.8, hz0 + 0.6, 0.56, 5.6, C.red2, 12);
  for (let i = -2; i <= 2; i++) { P.box(A + i * 3.2, 3.3, hz0 + 1.56, 2.2, 4.0, 0.1, C.redD); for (let j = 0; j < 5; j++) P.box(A + i * 3.2, 1.7 + j * 0.8, hz0 + 1.5, 2.0, 0.06, 0.04, C.yel2, 0, 0, 0, 1, { ao: false }); }
  P.slab(A - hw, A + hw, 6.6, 7.1, hz0, hz1, C.green, { ao: false });
  hipRoof(k, A - hw - 1.2, A + hw + 1.2, hz0 - 1.4, hz1 + 1.0, 7.1, 3.6, 4.8, 3.2, C.yel, C.yel2, C.ridge, C.green);
  k.sign(A, 5.6, hz0 + 0.3, { kind: 'plain', w: 3.4, h: 0.8, bg: '#2A1A14', fg: '#F2C94C', zh: '大成殿', face: Math.PI, align: 'center' });
  // 院里一对大香炉 + 树
  for (const s of [-1, 1]) { P.cyl(A + s * 5, 0.6, -36, 1.1, 1.2, hex('#5A4A35'), 10); P.cyl(A + s * 5, 1.35, -36, 1.4, 0.3, hex('#4A3C2A'), 10); }
  // 崇圣殿（后面一座小殿）
  Pv.slab(A - 8, A + 8, 0, 0.6, -10, -2.6, C.stone, { ao: true });
  P.slab(A - 7, A + 7, 0.6, 4.8, -9, -3.4, C.red, { aoTop: true }); k.colSlab(A - 8, A + 8, 0, 4.8, -10, -2.6);
  hipRoof(k, A - 8, A + 8, -10.2, -2.6, 4.8, 2.4, 3.2, 2.0, C.yel, C.yel2, C.ridge, C.green);
}

/** 文明路糖水街（南洋式骑楼 + 小吃车 + 串灯） */
function wenming(k) {
  const P = k.solid, Pv = k.g('pave'), W = WM;
  // 地面：文明路（石板路）+ 德政中路小巷 + 骑楼廊下地砖
  Pv.slab(W.x0, W.x1, 0, 0.03, W.zS, W.zN, hex('#C8C2B6'), { ao: false });
  for (let x = W.x0 + 1; x < W.x1; x += 2.4) P.slab(x, x + 0.06, 0.03, 0.035, W.zS + 0.6, W.zN - 0.6, hex('#B5AEA0'), { ao: false });
  Pv.slab(W.lane0, W.lane1, 0, 0.03, W.zN, -83, hex('#C8C2B6'), { ao: false });
  // 两排骑楼：每开间 4m；首层廊下 2.6m 深可以走；德政中路口（北排）留空
  const COLS = ['#F2E3C6', '#E8D2C2', '#DCE7E0', '#F3DCD2', '#E4E0EC', '#F5EBD0', '#D9E4EE', '#EFD9C4'];
  const SHOPS = [
    ['糖水铺', '#C0392B'], null, ['姜撞奶', '#B5651D'], ['龟苓膏', '#3B3B3B'], ['芒果甜品', '#E3A400'], ['杨枝甘露', '#E07B39'],
    ['肠粉', '#2E8B57'], ['牛杂', '#8E3B2B'], ['鸡蛋仔', '#C74B7A'], ['炖品', '#5B4B8A'], ['云吞面', '#1F7A8C'], ['豆花', '#3C7DBF'],
    ['烧腊', '#A93226'], ['凉茶', '#5D6D3E'], ['菠萝包', '#D4A017'], ['艇仔粥', '#2471A3']
  ];
  let si = 0, ci = 0; const this_empty = EMPTY_BAYS; EMPTY_BAYS.length = 0;
  const row = (zf, n) => {                     // zf = 骑楼正面线；n = 朝向街心的方向（+1 朝 +z，-1 朝 -z）
    const zb = zf - n * 2.6, zBack = n > 0 ? zf - 12 : zf + 14;   // 廊下后墙 / 楼背
    for (let x = W.x0; x < W.x1 - 0.1; x += 4) {
      if (n < 0 && x + 4 > W.lane0 && x < W.lane1) continue;  // 北排：德政中路口
      if (n < 0 && x + 4 > HOTEL.x0 && x < HOTEL.x1) continue; // 北排：德政中路东侧给丽呈铂锐酒店
      const c = hex(COLS[ci++ % COLS.length]), floors = 2 + ((ci * 7) % 3 === 0 ? 1 : 0), H = 3.6 + floors * 3.0;
      const za = Math.min(zb, zBack), zz = Math.max(zb, zBack);
      // 楼体（廊后）+ 首层店面
      P.slab(x, x + 4, 0, H, za, zz, c, { aoTop: true }); k.colSlab(x, x + 4, 0, H, za, zz);
      // 二楼以上悬挑到骑楼正面
      const fa = Math.min(zf, zb), fb = Math.max(zf, zb);
      P.slab(x, x + 4, 3.6, H, fa, fb, c, { aoTop: true });
      // 骑楼柱（开间两边）
      P.box(x + 0.3, 1.8, zf - n * 0.3, 0.5, 3.6, 0.5, c, 0, 0, 0, 1, { ao: true }); k.col(x + 0.3, 1.8, zf - n * 0.3, 0.5, 3.6, 0.5);
      // 店面玻璃 + 门；空铺位（留给以后的糖水店）= 拉下的卷闸门 + 空白招牌
      const zs = zb + n * 0.02, sh = SHOPS[si++ % SHOPS.length];
      if (sh) { k.g('glass').box(x + 2, 1.5, zs, 3.0, 2.4, 0.05, hex('#7FA8C0')); P.box(x + 2, 1.35, zs + n * 0.02, 1.0, 2.2, 0.04, hex('#5A3A22')); }
      else { P.box(x + 2, 1.4, zs, 3.4, 2.8, 0.06, hex('#B9BEC4'), 0, 0, 0, 1, { ao: false }); for (let j = 0; j < 9; j++) P.box(x + 2, 0.2 + j * 0.3, zs + n * 0.035, 3.4, 0.03, 0.02, hex('#9CA2A8'), 0, 0, 0, 1, { ao: false }); }
      // 骑楼口的招牌（横匾）
      const sz = zf + n * 0.05, face = n > 0 ? 0 : Math.PI;
      if (sh) k.sign(x + 2, 3.15, sz, { kind: 'plain', w: 3.3, h: 0.62, bg: sh[1], fg: '#FFF6DC', zh: sh[0], face, align: 'center' });
      else { P.box(x + 2, 3.15, sz, 3.3, 0.62, 0.04, hex('#F4EFE4'), 0, 0, 0, 1, { ao: false }); this_empty.push([x + 2, zf]); }
      // 楼上：每层两扇窗（白窗套 + 绿百叶）+ 腰线
      for (let f = 0; f < floors; f++) {
        const y = 3.6 + f * 3.0 + 1.6, zw = zf + n * 0.03;
        for (const dx of [1.1, 2.9]) {
          P.box(x + dx, y, zw, 1.1, 1.7, 0.06, C.white, 0, 0, 0, 1, { ao: false });
          P.box(x + dx, y - 0.05, zw + n * 0.02, 0.8, 1.4, 0.04, (f + ci) % 2 ? hex('#3E7B58') : hex('#4A6E8A'), 0, 0, 0, 1, { ao: false });
        }
        P.slab(x - 0.02, x + 4.02, 3.6 + f * 3.0 - 0.1, 3.6 + f * 3.0 + 0.1, Math.min(zf, zf + n * 0.12), Math.max(zf, zf + n * 0.12), C.white, { ao: false });
      }
      // 女儿墙：南洋式山花 + 透风方孔
      const yt = H, zp = zf;
      P.slab(x, x + 4, yt, yt + 0.9, Math.min(zp, zp - n * 0.3), Math.max(zp, zp - n * 0.3), c, { ao: false });
      if (ci % 2) P.box(x + 2, yt + 1.15, zp - n * 0.15, 1.8, 0.6, 0.3, c, 0, 0, 0, 1, { ao: false });
      P.box(x + 2, yt + 0.45, zp + n * 0.01, 0.5, 0.4, 0.02, hex('#6B5F52'), 0, 0, 0, 1, { ao: false });
    }
  };
  row(W.zN, -1); row(W.zS, 1);
  // 德政中路口：两边楼的侧墙 + 路口的竖招牌
  for (const x of [W.lane0]) { P.slab(x - 0.3, x + 0.3, 0, 7.5, W.zN, -89, hex('#E9E2D6'), { aoTop: true }); k.colSlab(x - 0.3, x + 0.3, 0, 7.5, W.zN, -89); }
  k.sign(W.lane0 + 0.36, 4.4, -95, { kind: 'plain', vert: true, w: 0.8, h: 3.2, bg: '#C0392B', fg: '#FFF2C8', zh: '文明路糖水街', face: Math.PI / 2 });
  // 德政中路口的牌坊：两根红柱（石柱础）+ 额枋 + 绿琉璃小屋顶 + 两面都有的名牌
  { const cx = (W.lane0 + W.lane1) / 2, z = -84.2, red = hex('#B8322A'), tile = hex('#2F6B4F'), stone = hex('#BDB6A8');
    for (const s of [-1, 1]) { const x = cx + s * 3.4; P.box(x, 0.3, z, 0.7, 0.6, 0.7, stone); P.cyl(x, 3.2, z, 0.36, 5.2, red, 12); k.col(x, 2.9, z, 0.5, 5.8, 0.5); }
    P.box(cx, 5.75, z, 7.6, 0.35, 0.4, red); P.box(cx, 4.55, z, 7.2, 0.22, 0.32, red);
    P.box(cx, 5.98, z, 7.4, 0.1, 0.5, hex('#D9AE5C'));
    P.box(cx, 6.3, z, 8.6, 0.18, 1.5, tile); P.box(cx, 6.55, z, 7.6, 0.35, 1.1, tile); P.box(cx, 6.82, z, 7.8, 0.14, 0.3, hex('#24563F'));
    for (const s of [-1, 1]) P.box(cx + s * 4.1, 6.5, z, 0.5, 0.3, 0.3, tile, 0, 0, s * 0.5);
    k.sign(cx, 5.1, z, { kind: 'plain', w: 5.2, h: 0.95, bg: '#B4412E', fg: '#FFE7A8', zh: '文明路 · 糖水街', en: 'Wenming Road Desserts', face: Math.PI, align: 'center', double: true }); }
  // 街两端封住（看起来像街继续延伸：远处一排低楼）
  for (const x of [W.x0 - 0.5, W.x1 + 0.5]) { P.slab(x - 0.5, x + 0.5, 0, 9, W.zS, W.zN, hex('#E3DCCF'), { aoTop: true }); k.colSlab(x - 0.5, x + 0.5, 0, 9, W.zS, W.zN); }
  // 小吃车（街心，一字排开，留出走路的位置）
  const STALLS = [['鸡蛋仔', '#F2C230'], ['烤肠', '#E8443A'], ['碗仔翅', '#8E5A2B'], ['糖葱饼', '#F28CB1'], ['钵仔糕', '#5FB4DA'], ['咖喱鱼蛋', '#E3A400']];
  const zc = (W.zN + W.zS) / 2;
  STALLS.forEach(([name, col], i) => {
    const x = W.x0 + 10 + i * 17 + (i >= 3 ? 6 : 0), z = zc + (i % 2 ? 1.6 : -1.6), ry = 0;
    P.slab(x - 1.1, x + 1.1, 0.35, 1.15, z - 0.6, z + 0.6, hex('#F4F1EA'), { aoTop: true }); k.colSlab(x - 1.2, x + 1.2, 0, 1.2, z - 0.7, z + 0.7);
    P.slab(x - 1.12, x + 1.12, 1.15, 1.22, z - 0.62, z + 0.62, hex('#B9C0C8'), { ao: false });
    for (const s of [-1, 1]) P.cyl(x + s * 0.8, 0.22, z + 0.62, 0.42, 0.08, C.dark, 10, 0, Math.PI / 2, 0);
    for (const s of [-1, 1]) for (const t of [-1, 1]) P.box(x + s * 1.0, 1.75, z + t * 0.5, 0.06, 1.1, 0.06, hex('#9AA2AA'));
    // 条纹雨篷
    for (let j = 0; j < 4; j++) P.box(x - 0.9 + j * 0.6, 2.36, z, 0.6, 0.08, 1.5, j % 2 ? hex('#FFFFFF') : hex(col), 0, 0, 0, 1, { ao: false });
    for (let j = 0; j < 3; j++) P.sphere(x - 0.6 + j * 0.6, 1.32, z, 0.28, hex(col), 1);
    k.sign(x, 1.72, z - 0.66, { kind: 'plain', w: 1.6, h: 0.4, bg: col, fg: '#1B1D20', zh: name, face: Math.PI, align: 'center', box: false });
    k.sign(x, 1.72, z + 0.66, { kind: 'plain', w: 1.6, h: 0.4, bg: col, fg: '#1B1D20', zh: name, face: 0, align: 'center', box: false });
    void ry;
  });
  // 串串红灯笼（横跨街道）
  for (let x = W.x0 + 6; x < W.x1 - 4; x += 8) {
    for (let j = 0; j < 4; j++) { const z = W.zS + 2 + j * 2; k.glow.ellipsoid(x, 4.6 - Math.abs(j - 1.5) * 0.15, z, 0.5, 0.62, 0.5, hex('#FF5C4D'), 1); }
    P.box(x, 4.95, zc, 0.02, 0.02, W.zN - W.zS, C.dark, 0, 0, 0, 1, { ao: false });
  }
}

/** 丽呈铂锐酒店外观：裙楼（首层玻璃店面 + 雨篷 + 正门）+ 深棕色塔楼（竖条暖黄窗带、每层一道深色横线）+ 楼顶金字招牌 + 门口灯牌 / 红飘带 */
function hotel(k) {
  const P = k.solid, G = k.glow, H = HOTEL, D = HOTEL_DOOR;
  const body = hex('#5A2A22'), body2 = hex('#45201A'), gold = hex('#D9AE5C'), dark = hex('#1E2A33'), dark2 = hex('#26323C'), warm = hex('#FFC56B'), warm2 = hex('#F2B060');
  let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  // 裙楼（1-2F）：棕红实体 + 深色玻璃 + 暖光玻璃门
  const px0 = 31.5, px1 = 49.5, pz0 = -102.2, pz1 = -84.5, PH = 5;
  P.slab(px0, px1, 0, PH, pz0, pz1, body2, { aoTop: true }); k.colSlab(px0, px1, 0, PH, pz0, pz1);
  P.slab(px0 - 0.1, px1 + 0.1, PH - 0.45, PH, pz0 - 0.1, pz1 + 0.1, gold, { ao: false });
  const store = (face, a, b) => {   // face 'w' 西立面（x = px0）沿 z；'n' 北立面（z = pz1）沿 x
    const n = Math.max(1, Math.round((b - a) / 1.6)), st = (b - a) / n;
    for (let i = 0; i < n; i++) {
      const u0 = a + i * st + 0.06, u1 = a + (i + 1) * st - 0.06, lit = rnd() < 0.35;
      if (face === 'w') { P.slab(px0 - 0.06, px0, 0.3, 4.0, u0, u1, lit ? hex('#6B4A33') : dark2, { ao: false }); if (lit) G.slab(px0 - 0.07, px0 - 0.065, 3.3, 3.9, u0 + 0.1, u1 - 0.1, warm2); }
      else { P.slab(u0, u1, 0.3, 4.0, pz1, pz1 + 0.06, lit ? hex('#6B4A33') : dark2, { ao: false }); if (lit) G.slab(u0 + 0.1, u1 - 0.1, 3.3, 3.9, pz1 + 0.065, pz1 + 0.07, warm2); }
    }
  };
  store('w', pz0 + 0.8, D.z - 2.6); store('w', D.z + 2.6, pz1 - 0.8); store('n', px0 + 0.8, px1 - 0.8);
  // 正门：两扇玻璃门（门框金色）+ 门里暖光
  G.slab(px0 - 0.04, px0 - 0.02, 0, 3.0, D.z - D.half, D.z + D.half, hex('#FFDDA0'));
  for (const z of [D.z - D.half, D.z, D.z + D.half]) P.slab(px0 - 0.12, px0, 0, 3.0, z - 0.05, z + 0.05, gold, { ao: false });
  P.slab(px0 - 0.14, px0, 2.95, 3.15, D.z - D.half - 0.1, D.z + D.half + 0.1, gold, { ao: false });
  for (const s of [-1, 1]) P.slab(px0 - 0.1, px0, 1.0, 1.1, D.z + s * 0.12, D.z + s * 0.6, hex('#B88A3E'), { ao: false });   // 门把手
  // 雨篷 + 两根细柱 + 门头字
  P.slab(px0 - 2.0, px0, 3.9, 4.2, D.z - 2.6, D.z + 2.6, body, { ao: false }); P.slab(px0 - 2.05, px0, 3.85, 3.92, D.z - 2.65, D.z + 2.65, gold, { ao: false });
  for (const s of [-1, 1]) { P.box(px0 - 1.85, 1.95, D.z + s * 2.4, 0.12, 3.9, 0.12, gold); k.col(px0 - 1.85, 1.95, D.z + s * 2.4, 0.15, 3.9, 0.15); }
  G.slab(px0 - 1.9, px0 - 0.1, 3.84, 3.86, D.z - 2.3, D.z + 2.3, hex('#FFE7B8'));
  k.sign(px0 - 2.06, 4.05, D.z, { kind: 'plain', w: 3.6, h: 0.32, bg: '#2A1A14', fg: '#E8C26A', zh: '丽呈铂锐酒店 REZEN', face: -Math.PI / 2, align: 'center', box: false });
  // 塔楼：棕红色墙身 + 竖向窗格（深色玻璃为主，约 3 成亮暖黄，随机）
  const tx0 = 32.5, tx1 = 48.5, tz0 = -101, tz1 = -86, TY0 = PH, TY1 = 38, FH = 3.0;
  P.slab(tx0, tx1, TY0, TY1, tz0, tz1, body, { aoTop: true });
  const win = (face, u, y, lit) => {   // 一个窗格 1.0 × 2.1
    const c = lit ? (rnd() < 0.5 ? warm : warm2) : (rnd() < 0.5 ? dark : dark2), B = lit ? G : P, h0 = y + 0.45, h1 = y + 2.55;
    if (face === 'w') B.slab(tx0 - 0.05, tx0 - 0.01, h0, h1, u - 0.5, u + 0.5, c, { ao: false });
    else if (face === 'e') B.slab(tx1 + 0.01, tx1 + 0.05, h0, h1, u - 0.5, u + 0.5, c, { ao: false });
    else if (face === 'n') B.slab(u - 0.5, u + 0.5, h0, h1, tz1 + 0.01, tz1 + 0.05, c, { ao: false });
    else B.slab(u - 0.5, u + 0.5, h0, h1, tz0 - 0.05, tz0 - 0.01, c, { ao: false });
  };
  for (let y = TY0 + 0.3; y < TY1 - 2.9; y += FH) {
    for (let z = tz0 + 0.9; z < tz1 - 0.5; z += 1.5) { win('w', z, y, rnd() < 0.3); win('e', z, y, rnd() < 0.25); }
    for (let x = tx0 + 0.9; x < tx1 - 0.5; x += 1.5) { win('n', x, y, rnd() < 0.3); win('s', x, y, rnd() < 0.25); }
    P.slab(tx0 - 0.1, tx0, y - 0.06, y + 0.06, tz0, tz1, body2, { ao: false }); P.slab(tx0, tx1, y - 0.06, y + 0.06, tz1, tz1 + 0.1, body2, { ao: false });
  }
  // 楼顶：加高女儿墙 + 金色大字「丽呈铂锐酒店」（北面、西面各一块），金边
  const PY = 4.0;
  P.slab(tx0 - 0.2, tx1 + 0.2, TY1, TY1 + PY, tz0 - 0.2, tz1 + 0.2, body2, { ao: false });
  P.slab(tx0 - 0.25, tx1 + 0.25, TY1 + PY, TY1 + PY + 0.15, tz0 - 0.25, tz1 + 0.25, gold, { ao: false });
  const roofSign = (c, pw, ph) => {
    c.fillStyle = '#2A1612'; c.fillRect(0, 0, pw, ph);
    const g = c.createLinearGradient(0, ph * 0.1, 0, ph * 0.9); g.addColorStop(0, '#FFE6A0'); g.addColorStop(0.5, '#F2C25A'); g.addColorStop(1, '#C8902E');
    c.fillStyle = g; c.textAlign = 'center'; c.textBaseline = 'middle';
    // 左边 R 标（下面小字 REZEN），右边整排金色大字
    c.font = `900 ${ph * 0.62}px Georgia,serif`; c.fillText('R', ph * 0.55, ph * 0.42); c.font = `700 ${ph * 0.17}px sans-serif`; c.fillText('REZEN', ph * 0.55, ph * 0.82);
    const t = '丽呈铂锐酒店', x0 = ph * 1.15, avail = pw - x0 - ph * 0.2; let fs = ph * 0.74; c.font = `900 ${fs}px ${FONT}`; const tw = c.measureText(t).width; if (tw > avail) { fs *= avail / tw; c.font = `900 ${fs}px ${FONT}`; }
    c.fillText(t, x0 + avail / 2, ph * 0.54);
    c.strokeStyle = '#D9AE5C'; c.lineWidth = ph * 0.04; c.strokeRect(ph * 0.03, ph * 0.03, pw - ph * 0.06, ph - ph * 0.06);
  };
  k.sign((tx0 + tx1) / 2, TY1 + PY / 2, tz1 + 0.22, { kind: 'custom', key: 'rezenN', paint: roofSign, w: 15.8, h: 3.7, face: 0 });
  k.sign(tx0 - 0.22, TY1 + PY / 2, (tz0 + tz1) / 2, { kind: 'custom', key: 'rezenN', paint: roofSign, w: 15.8, h: 3.7, face: -Math.PI / 2 });
  // 门口灯牌「我❤广州」：塔楼西北角下部的竖向灯箱（参考图：我 / 红心 / 广州）
  const heartSign = (c, pw, ph) => {
    c.fillStyle = '#16100E'; c.fillRect(0, 0, pw, ph);
    c.strokeStyle = '#E8C26A'; c.lineWidth = pw * 0.03; c.strokeRect(pw * 0.03, pw * 0.03, pw - pw * 0.06, ph - pw * 0.06);
    c.fillStyle = '#FFFFFF'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.font = `900 ${pw * 0.62}px ${FONT}`;
    c.shadowColor = '#FFF4D0'; c.shadowBlur = pw * 0.06;
    c.fillText('我', pw / 2, ph * 0.17);
    const hx = pw / 2, hy = ph * 0.43, r = pw * 0.2; c.fillStyle = '#FF2D3D'; c.shadowColor = '#FF5060';
    c.beginPath(); c.moveTo(hx, hy + r * 1.5); c.bezierCurveTo(hx - r * 2.4, hy, hx - r * 1.2, hy - r * 1.6, hx, hy - r * 0.5); c.bezierCurveTo(hx + r * 1.2, hy - r * 1.6, hx + r * 2.4, hy, hx, hy + r * 1.5); c.fill();
    c.fillStyle = '#FFFFFF'; c.shadowColor = '#FFF4D0'; c.fillText('广', pw / 2, ph * 0.67); c.fillText('州', pw / 2, ph * 0.87);
  };
  const sz = tz1 - 1.6;
  P.slab(tx0 - 0.25, tx0, TY0 + 0.4, TY0 + 7.6, sz - 1.0, sz + 1.0, hex('#16100E'), { ao: false });
  k.sign(tx0 - 0.26, TY0 + 4.0, sz, { kind: 'custom', key: 'woaigz', paint: heartSign, w: 1.8, h: 7.0, face: -Math.PI / 2 });
}
