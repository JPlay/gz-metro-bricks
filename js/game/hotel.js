/*
 * 丽呈铂锐酒店（农讲所站，德政中路 388 号）——可以真的走进去的小酒店：
 *   ① 正门 → 大堂（前台 + 前台小姐姐、沙发、品牌墙、电梯厅、楼梯门）；
 *   ② 电梯：在电梯口按「按电梯」→ 轿厢开过来、门打开 → 走进去按楼层按钮（1 / 2 / 3）→ 关门、楼层显示一层层跳 → 到了开门；
 *   ③ 楼梯：一个共用的楼梯间（两跑楼梯 + 平台），1F ↔ 2F ↔ 3F 都能走；
 *   ④ 客房走廊（2F、3F 共用同一个楼层模板，门牌号跟着楼层变）：3F 的 302 双床房、301 大床房能开门进去，别的房门都锁着；
 *   ⑤ 客房：床能「坐下」也能「躺下」，窗外是街景。
 * 实现：
 *   - 室内放在 HO = (1000, 0, 0)（x > 400 → zone 'hall'：街面 / 站内都关掉，只画酒店里这几样；没有车站环境声和广播）；
 *   - 只有一层“客房层”几何（y = FY）。爬楼梯从 2F 上到 3F 时，走到上一跑楼梯顶就把人往下挪 4.5m 并把楼层改成 3（几何一模一样），
 *     3F 往下走反过来；坐电梯 2↔3 时轿厢不动，只是关着门、楼层显示跳一下。2F 时楼梯间上半截（去 3F 的两跑）显示，3F 时换成封顶 + 栏杆。
 *   - 电梯轿厢是一个会上下移动的网格 + 碰撞地板；每个楼层口两扇不锈钢门左右滑开，门关着时有碰撞。
 *   - 门牌号、楼层显示、轿厢按钮灯画在一张小 DynamicTexture 上，状态变了才重画。
 * 性能：整栋室内 ≈ 25 次绘制、3 万多三角形（见 tests/e2e/hotel.py）。
 */
import { Kit } from '../world/kit.js';
import { hex, mix, Geo } from '../core/geo.js';
import { FoodAtlas } from './food-art.js';
import { Person, randomLook } from '../world/people.js';
import { pressable } from './input.js';
import { HOTEL_DOOR } from '../world/njs.js';
const B = window.BABYLON;
export const HO = { x: 1000, z: 0 };
const FY = 4.5, CH = 2.8, LH = 4.2;             // 客房层地面高度、客房层层高、大堂层高
const SX0 = 8.3, SX1 = 10.7, SZ = 1.2;           // 电梯井（局部 x 8.3..10.7，z ±1.2），门洞 z ±0.6
const WX = 8.0;                                  // 大堂 / 走廊东墙（内侧）
const ST = { x0: 8.3, x1: 12.3, z0: 1.9, z1: 7.6, wl: [8.3, 9.9], el: [10.7, 12.3], zA: 3.4, zB: 6.4 };   // 楼梯间
const DOOR_Z = [2.0, 3.3];                       // 楼梯门洞（东墙上）
const X = x => HO.x + x;
const C = {
  marble: hex('#E9E3D8'), marble2: hex('#D8CFC0'), wood: hex('#6B4430'), wood2: hex('#4E3022'), brown: hex('#3A231B'), gold: hex('#D9AE5C'),
  wall: hex('#F1EBE1'), wall2: hex('#E4DACB'), carpet: hex('#5B3F5E'), carpet2: hex('#7A5A78'), steel: hex('#B9C0C8'), steel2: hex('#8F979F'),
  white: hex('#FAFAF7'), linen: hex('#F4F1EA'), green: hex('#3E7B58'), stair: hex('#CFC9BC'), floorW: hex('#B88A5E'), sofa: hex('#8A6A52'), accent: hex('#C9A15A')
};
const ROOMS = [   // 客房层的门：north = 北侧（z>0）；open = 3F 可以进
  { n: 1, x0: -2, x1: 2, side: 1, kind: 'king', open: true }, { n: 2, x0: -6, x1: -2, side: 1, kind: 'twin', open: true }, { n: 3, x0: -10, x1: -6, side: 1 },
  { n: 4, x0: 2, x1: 6, side: -1 }, { n: 5, x0: -2, x1: 2, side: -1 }, { n: 6, x0: -6, x1: -2, side: -1 }, { n: 7, x0: -10, x1: -6, side: -1 }
];
const CW = 1.3;                                  // 走廊半宽（z ±1.3）

export class HotelInterior {
  constructor(scene, M) {
    this.scene = scene; this.M = M;
    const k = this.kit = new Kit(scene, 'hotel-int'), atlas = this.atlas = new FoodAtlas(scene, 1024);
    this.up = new Kit(scene, 'hotel-up', k.root); this.cap = new Kit(scene, 'hotel-cap', k.root);
    this.seats = []; this.floor = 2;
    this.spawn = { x: X(0), y: 0.05, z: -4.6, yaw: 0 };
    this.lobby(k, atlas); this.corridor(k, atlas); this.rooms(k, atlas); this.stairs(k); this.shaft(k);
    k.finish(); this.up.finish(); this.cap.finish(); atlas.finish(k.root, 'hotelSigns');
    this.buildDyn(); this.buildLift(); this.buildDoors(); this.staff();
    this.kit.root.setEnabled(false);
    this.setFloor(2, true);
  }
  /* ———————— 大堂 ———————— */
  lobby(k, atlas) {
    const P = k.solid, G = k.glow;
    // 地面：大块米色石材（2m 一格两色）
    for (let x = -8; x < WX; x += 2) for (let z = -6; z < 6; z += 2) P.slab(X(x), X(Math.min(WX, x + 2)), -0.1, 0, z, z + 2, ((x + z) / 2) % 2 ? C.marble : C.marble2, { ao: false });
    k.colSlab(X(-9), X(ST.x1), -0.6, 0, -7, ST.z1);
    // 墙
    const wall = (x0, x1, y0, y1, z0, z1, col = C.wall) => { P.slab(X(x0), X(x1), y0, y1, z0, z1, col, { ao: false }); k.colSlab(X(x0), X(x1), y0, y1, z0, z1); };
    wall(-8.3, -8, 0, LH, -6, 6); wall(-8.3, WX + 0.3, 0, LH, 6, 6.3);
    wall(-8.3, -1.2, 0, LH, -6.3, -6); wall(1.2, WX + 0.3, 0, LH, -6.3, -6); P.slab(X(-1.2), X(1.2), 2.8, LH, -6.3, -6, C.wall, { ao: false });
    // 东墙：电梯门洞（z ±0.6）+ 楼梯门洞
    wall(WX, SX0, 0, LH, -6, -0.6); wall(WX, SX0, 0, LH, 0.6, DOOR_Z[0]); wall(WX, SX0, 0, LH, DOOR_Z[1], 6);
    P.slab(X(WX), X(SX0), 2.35, LH, -0.6, 0.6, C.steel2, { ao: false }); P.slab(X(WX), X(SX0), 2.35, LH, DOOR_Z[0], DOOR_Z[1], C.wall, { ao: false });
    P.slab(X(WX - 0.05), X(WX), 0, 2.4, -0.75, -0.6, C.steel, { ao: false }); P.slab(X(WX - 0.05), X(WX), 0, 2.4, 0.6, 0.75, C.steel, { ao: false }); P.slab(X(WX - 0.05), X(WX), 2.35, 2.45, -0.75, 0.75, C.steel, { ao: false });
    // 下半截深色护墙板
    P.slab(X(-7.99), X(-7.96), 0, 1.0, -6, 6, C.wood2, { ao: false }); P.slab(X(-8), X(WX), 0, 1.0, 5.96, 5.99, C.wood2, { ao: false });
    // 吊顶 + 筒灯 + 一圈暖光灯槽
    P.slab(X(-8.3), X(WX + 0.3), LH, FY - 0.08, -6.3, 6.3, C.white, { ao: false }); k.colSlab(X(-8.3), X(WX + 0.3), LH, FY - 0.08, -6.3, 6.3);
    for (const x of [-5.5, -2, 1.5, 5]) for (const z of [-3.5, 0, 3.5]) G.cyl(X(x), LH - 0.01, z, 0.45, 0.02, hex('#FFF4DC'), 12);
    for (const [a, b, c, d] of [[-7.9, WX - 0.1, -5.9, -5.8], [-7.9, WX - 0.1, 5.8, 5.9], [-7.9, -7.8, -5.9, 5.9]]) G.slab(X(a), X(b), LH - 0.08, LH - 0.04, c, d, hex('#FFD9A0'));
    // 品牌墙（北墙中间）：深色木饰面 + 金字
    P.slab(X(-4.6), X(2.6), 1.0, 3.9, 5.88, 5.96, C.wood2, { ao: false });
    atlas.sign(X(-1), 2.85, 5.86, 5.4, 1.2, Math.PI, (c, w, h) => {
      c.fillStyle = '#3A231B'; c.fillRect(0, 0, w, h); c.fillStyle = '#E8C26A'; c.textAlign = 'center'; c.textBaseline = 'middle';
      c.font = `800 ${h * 0.42}px "Noto Sans CJK SC",sans-serif`; c.fillText('丽呈铂锐酒店', w / 2, h * 0.36); c.font = `600 ${h * 0.26}px "Helvetica Neue",Arial,sans-serif`; c.fillText('R E Z E N', w / 2, h * 0.76);
    });
    // 前台：深木柜台 + 白色台面 + 金色腰线；台上一个服务铃
    const dz0 = 3.2, dz1 = 4.0, dx0 = -4.2, dx1 = 2.2;
    P.slab(X(dx0), X(dx1), 0, 1.05, dz0, dz1, C.wood, { aoTop: false }); P.slab(X(dx0 - 0.05), X(dx1 + 0.05), 1.05, 1.12, dz0 - 0.1, dz1, C.white, { ao: false });
    P.slab(X(dx0), X(dx1), 0.5, 0.56, dz0 - 0.01, dz0, C.gold, { ao: false }); k.colSlab(X(dx0 - 0.05), X(dx1 + 0.05), 0, 1.2, dz0 - 0.1, dz1);
    P.cyl(X(-0.4), 1.15, dz0 + 0.2, 0.18, 0.06, C.gold, 10); P.sphere(X(-0.4), 1.2, dz0 + 0.2, 0.14, C.gold, 1, 0.8);
    P.slab(X(0.6), X(1.2), 1.12, 1.14, dz0 + 0.05, dz0 + 0.45, hex('#2B2F33'), { ao: false });   // 平板（登记用）
    // 前台牌（柜台正面）
    atlas.sign(X(-1), 0.78, dz0 - 0.02, 2.4, 0.5, Math.PI, (c, w, h) => { c.fillStyle = '#3A231B'; c.fillRect(0, 0, w, h); c.fillStyle = '#E8C26A'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.font = `800 ${h * 0.5}px "Noto Sans CJK SC",sans-serif`; c.fillText('前台  Reception', w / 2, h * 0.54); });
    // 休息区（西侧）：沙发 + 茶几 + 地毯 + 绿植
    P.slab(X(-7.0), X(-3.2), 0, 0.012, -4.6, -0.6, C.carpet, { ao: false });
    P.slab(X(-7.9), X(-7.0), 0, 0.45, -4.2, -1.0, C.sofa, { aoTop: true }); P.slab(X(-7.95), X(-7.6), 0.45, 1.0, -4.2, -1.0, C.sofa, { aoTop: true }); k.colSlab(X(-7.95), X(-7.0), 0, 0.9, -4.2, -1.0);
    for (const [a, b] of [[-4.35, -4.2], [-1.0, -0.85]]) { P.slab(X(-7.95), X(-7.0), 0, 0.7, a, b, C.sofa, { ao: false }); k.colSlab(X(-7.95), X(-7.0), 0, 0.7, a, b); }
    P.slab(X(-6.2), X(-4.8), 0.38, 0.44, -3.2, -2.0, C.white, { ao: false }); for (const [a, b] of [[-6.1, -3.1], [-4.9, -3.1], [-6.1, -2.1], [-4.9, -2.1]]) P.slab(X(a - 0.03), X(a + 0.03), 0, 0.38, b - 0.03, b + 0.03, C.gold, { ao: false });
    k.colSlab(X(-6.2), X(-4.8), 0, 0.45, -3.2, -2.0);
    for (const [x, z] of [[-7.4, -5.4], [-7.4, 5.3], [6.8, 5.3], [6.8, -5.4]]) { P.cyl(X(x), 0.3, z, 0.6, 0.6, C.brown, 10); P.sphere(X(x), 1.1, z, 1.0, C.green, 1, 1.4); k.col(X(x), 0.6, z, 0.6, 1.2, 0.6); }
    // 门口地垫 + “出口”
    P.slab(X(-1.0), X(1.0), 0, 0.012, -6, -5.0, C.brown, { ao: false });
    G.slab(X(-1.2), X(1.2), 0, 2.8, -6.32, -6.3, hex('#FFF6E0'));
    k.colSlab(X(-1.5), X(1.5), 0, 3, -7.4, -7.0);
    atlas.sign(X(0), 3.15, -5.98, 1.4, 0.45, 0, (c, w, h) => { c.fillStyle = '#1F7A3A'; c.fillRect(0, 0, w, h); c.fillStyle = '#fff'; c.font = `800 ${h * 0.6}px sans-serif`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('出口 ↓', w / 2, h * 0.54); });
    // 电梯口 / 楼梯门的牌
    atlas.sign(X(WX - 0.02), 3.3, 0, 1.6, 0.45, -Math.PI / 2, liftSign);
    atlas.sign(X(WX - 0.02), 2.75, (DOOR_Z[0] + DOOR_Z[1]) / 2, 1.3, 0.4, -Math.PI / 2, stairSign);
  }
  /* ———————— 客房层走廊（2F / 3F 共用） ———————— */
  corridor(k, atlas) {
    const P = k.solid, G = k.glow, y0 = FY, y1 = FY + CH;
    const wall = (x0, x1, a, b, z0, z1, col = C.wall2) => { P.slab(X(x0), X(x1), a, b, z0, z1, col, { ao: false }); k.colSlab(X(x0), X(x1), a, b, z0, z1); };
    // 地毯（深紫底 + 浅色花纹条）+ 电梯厅石材
    P.slab(X(-10), X(4.5), y0 - 0.02, y0, -CW, CW, C.carpet, { ao: false });
    for (let x = -9.5; x < 4.4; x += 1.0) P.slab(X(x), X(x + 0.5), y0, y0 + 0.004, -0.5, 0.5, C.carpet2, { ao: false });
    P.slab(X(4.5), X(WX), y0 - 0.02, y0, -CW, ST.zA, C.marble, { ao: false });
    k.colSlab(X(-10.5), X(WX + 0.3), y0 - 0.3, y0, -7.6, 7.6);
    // 走廊两侧墙：房门处的门（门洞 0.9m；能开的两间单独做活动门）
    for (const side of [-1, 1]) {
      const za = side > 0 ? CW : -CW - 0.15, zb = side > 0 ? CW + 0.15 : -CW, xe = side > 0 ? 4.5 : WX;
      let x = -10;
      const doors = ROOMS.filter(r => r.side === side).map(r => (r.x0 + r.x1) / 2).sort((a, b) => a - b);
      for (const dx of doors) { wall(x, dx - 0.45, y0, y1, za, zb); P.slab(X(dx - 0.45), X(dx + 0.45), y0 + 2.15, y1, za, zb, C.wall2, { ao: false }); x = dx + 0.45; }
      wall(x, xe, y0, y1, za, zb);
      // 护墙板 + 门框
      P.slab(X(-10), X(xe), y0, y0 + 0.12, side > 0 ? za - 0.01 : zb, side > 0 ? za : zb + 0.01, C.wood2, { ao: false });
      for (const r of ROOMS.filter(r => r.side === side)) {
        const dx = (r.x0 + r.x1) / 2, zf = side > 0 ? za - 0.02 : zb + 0.02;
        for (const s of [-1, 1]) P.slab(X(dx + s * 0.5 - 0.05), X(dx + s * 0.5 + 0.05), y0, y0 + 2.2, Math.min(zf, zf - side * 0.03), Math.max(zf, zf - side * 0.03), C.wood2, { ao: false });
        P.slab(X(dx - 0.55), X(dx + 0.55), y0 + 2.15, y0 + 2.25, Math.min(zf, zf - side * 0.03), Math.max(zf, zf - side * 0.03), C.wood2, { ao: false });
        if (!r.open) {   // 锁着的门：画在墙洞里的门板 + 门把手 + 碰撞
          const zd = side > 0 ? CW + 0.08 : -CW - 0.08;
          P.slab(X(dx - 0.45), X(dx + 0.45), y0, y0 + 2.15, zd - 0.025, zd + 0.025, C.wood, { ao: false }); k.colSlab(X(dx - 0.45), X(dx + 0.45), y0, y0 + 2.15, zd - 0.05, zd + 0.05);
          P.sphere(X(dx + 0.3), y0 + 1.0, zd - side * 0.05, 0.08, C.gold, 1);
          P.slab(X(dx + 0.25), X(dx + 0.35), y0 + 1.15, y0 + 1.35, zd - side * 0.03, zd - side * 0.028, hex('#2B2F33'), { ao: false });   // 门锁
        }
      }
    }
    // 电梯厅（东头）：北墙、西墙
    wall(4.35, 4.5, y0, y1, CW + 0.15, ST.zA); wall(4.35, WX + 0.3, y0, y1, ST.zA, ST.zA + 0.15);
    // 东墙：电梯门洞 + 楼梯门洞
    wall(WX, SX0, y0, y1, -CW - 0.15, -0.6); wall(WX, SX0, y0, y1, 0.6, DOOR_Z[0]); wall(WX, SX0, y0, y1, DOOR_Z[1], ST.zA);
    P.slab(X(WX), X(SX0), y0 + 2.35, y1, -0.6, 0.6, C.steel2, { ao: false }); P.slab(X(WX), X(SX0), y0 + 2.35, y1, DOOR_Z[0], DOOR_Z[1], C.wall2, { ao: false });
    P.slab(X(WX - 0.05), X(WX), y0, y0 + 2.4, -0.75, -0.6, C.steel, { ao: false }); P.slab(X(WX - 0.05), X(WX), y0, y0 + 2.4, 0.6, 0.75, C.steel, { ao: false }); P.slab(X(WX - 0.05), X(WX), y0 + 2.35, y0 + 2.45, -0.75, 0.75, C.steel, { ao: false });
    atlas.sign(X(WX - 0.02), y0 + 2.75, (DOOR_Z[0] + DOOR_Z[1]) / 2, 1.3, 0.4, -Math.PI / 2, stairSign);
    // 西头：尽头窗（街景）
    wall(-10.15, -10, y0, y1, -CW, CW);
    atlas.sign(X(-9.98), y0 + 1.5, 0, 1.6, 1.4, Math.PI / 2, (c, w, h) => streetView(c, w, h, 1));
    P.slab(X(-9.99), X(-9.95), y0 + 0.75, y0 + 0.8, -0.85, 0.85, C.white, { ao: false }); P.slab(X(-9.99), X(-9.95), y0 + 2.2, y0 + 2.25, -0.85, 0.85, C.white, { ao: false });
    // 天花 + 筒灯
    P.slab(X(-10.2), X(WX + 0.3), y1, y1 + 0.1, -CW - 0.15, ST.zA + 0.15, C.white, { ao: false }); k.colSlab(X(-10.2), X(WX + 0.3), y1, y1 + 0.1, -CW - 0.15, ST.zA + 0.15);
    for (let x = -9; x < 4; x += 2.5) G.cyl(X(x), y1 - 0.01, 0, 0.35, 0.02, hex('#FFF4DC'), 10);
    G.cyl(X(6.2), y1 - 0.01, 1.0, 0.4, 0.02, hex('#FFF4DC'), 10);
    // 电梯厅：挂画 + 小边桌
    atlas.sign(X(4.52), y0 + 1.6, 2.35, 1.2, 0.9, Math.PI / 2, (c, w, h) => cantonTower(c, w, h));
    P.slab(X(4.5), X(4.9), y0, y0 + 0.8, 1.8, 2.9, C.wood, { aoTop: true }); k.colSlab(X(4.5), X(4.9), y0, y0 + 0.8, 1.8, 2.9);
    P.sphere(X(4.7), y0 + 0.95, 2.35, 0.3, hex('#E8505B'), 1);
  }
  /* ———————— 两间客房：302 双床房、301 大床房（北侧） ———————— */
  rooms(k, atlas) {
    const P = k.solid, G = k.glow, y0 = FY, y1 = FY + CH, zn = 7.3, zs = CW + 0.15;
    const wall = (x0, x1, z0, z1, col = C.wall) => { P.slab(X(x0), X(x1), y0, y1, z0, z1, col, { ao: false }); k.colSlab(X(x0), X(x1), y0, y1, z0, z1); };
    // 外墙 + 房间之间的墙（3 号房只有墙，没有室内）
    wall(-10.15, 2.15, zn, zn + 0.15); wall(-10.15, -10, zs, zn); wall(-6.07, -5.93, zs, zn); wall(-2.07, -1.93, zs, zn); wall(1.93, 2.07, zs, zn);
    for (const r of ROOMS.filter(r => r.open)) {
      const x0 = r.x0 + 0.07, x1 = r.x1 - 0.07, dx = (r.x0 + r.x1) / 2, twin = r.kind === 'twin';
      // 木地板 + 天花 + 灯
      for (let i = 0; i < 8; i++) P.slab(X(x0), X(x1), y0 - 0.02, y0, zs + i * (zn - zs) / 8, zs + (i + 1) * (zn - zs) / 8, i % 2 ? C.floorW : mix(C.floorW, [1, 1, 1], 0.12), { ao: false });
      P.slab(X(x0), X(x1), y1, y1 + 0.1, zs, zn, C.white, { ao: false }); k.colSlab(X(x0), X(x1), y1, y1 + 0.1, zs, zn);
      G.cyl(X(dx), y1 - 0.01, 4.5, 0.5, 0.02, hex('#FFF1D6'), 12);
      // 卫生间（门边一个磨砂玻璃小盒子）
      const bx0 = twin ? x0 : dx + 0.6, bx1 = twin ? dx - 0.6 : x1;
      k.g('glass').slab(X(bx0), X(bx1), y0, y0 + 2.4, 3.3, 3.4, hex('#DDEBF0'));
      P.slab(X(twin ? bx1 - 0.1 : bx0), X(twin ? bx1 : bx0 + 0.1), y0, y0 + 2.4, zs, 3.4, C.wall2, { ao: false }); k.colSlab(X(bx0), X(bx1), y0, y0 + 2.4, zs, 3.4);
      atlas.sign(X((bx0 + bx1) / 2), y0 + 1.7, 3.42, 0.7, 0.3, 0, (c, w, h) => { c.fillStyle = '#F5F1E8'; c.fillRect(0, 0, w, h); c.fillStyle = '#5B4B3A'; c.font = `700 ${h * 0.55}px "Noto Sans CJK SC",sans-serif`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('卫生间 WC', w / 2, h * 0.55); });
      // 窗：街景 + 白窗框 + 窗帘
      const wx0 = x0 + 0.5, wx1 = x1 - 0.5;
      atlas.sign(X((wx0 + wx1) / 2), y0 + 1.55, zn - 0.01, wx1 - wx0, 1.5, Math.PI, (c, w, h) => streetView(c, w, h, twin ? 2 : 3));
      for (const yy of [y0 + 0.78, y0 + 2.3]) P.slab(X(wx0 - 0.05), X(wx1 + 0.05), yy - 0.03, yy + 0.03, zn - 0.05, zn - 0.01, C.white, { ao: false });
      for (const xx of [wx0, (wx0 + wx1) / 2, wx1]) P.slab(X(xx - 0.03), X(xx + 0.03), y0 + 0.78, y0 + 2.3, zn - 0.05, zn - 0.01, C.white, { ao: false });
      for (const s of [-1, 1]) P.slab(X(s < 0 ? wx0 - 0.45 : wx1 + 0.05), X(s < 0 ? wx0 - 0.05 : wx1 + 0.45), y0 + 0.2, y1 - 0.05, zn - 0.2, zn - 0.05, hex('#C9B79A'), { ao: false });
      P.slab(X(x0), X(x1), y1 - 0.12, y1 - 0.04, zn - 0.24, zn - 0.04, C.wood2, { ao: false });
      // 床（坐 / 躺）
      const bed = (bx, bz, len, wid, dir) => {   // bx = 床头那面墙的 x，dir = 床往哪边伸（+1 往东）
        const xa = Math.min(bx, bx + dir * len), xb = Math.max(bx, bx + dir * len), za = bz - wid / 2, zb = bz + wid / 2;
        P.slab(X(xa), X(xb), y0, y0 + 0.28, za, zb, C.wood2, { aoTop: false });
        P.slab(X(xa + 0.02), X(xb - 0.02), y0 + 0.28, y0 + 0.5, za + 0.02, zb - 0.02, C.white, { ao: false });
        const ft = dir > 0 ? xb : xa, mid = bx + dir * len * 0.62;
        P.slab(X(Math.min(mid, ft)), X(Math.max(mid, ft)), y0 + 0.5, y0 + 0.56, za - 0.01, zb + 0.01, hex('#F7F4EE'), { ao: false });   // 被子
        P.slab(X(Math.min(ft, ft - dir * 0.45)), X(Math.max(ft, ft - dir * 0.45)), y0 + 0.56, y0 + 0.58, za - 0.02, zb + 0.02, C.accent, { ao: false });   // 床尾巾
        const pw = wid > 1.5 ? 2 : 1;
        for (let i = 0; i < pw; i++) { const pz = pw === 1 ? bz : bz + (i ? 0.42 : -0.42); P.box(X(bx + dir * 0.32), y0 + 0.6, pz, 0.38, 0.16, wid > 1.5 ? 0.72 : 0.66, C.linen, 0, 0, 0, 1, { ao: false }); }
        P.slab(X(Math.min(bx, bx + dir * 0.1)), X(Math.max(bx, bx + dir * 0.1)), y0, y0 + 1.25, za - 0.1, zb + 0.1, C.brown, { aoTop: true });   // 软包床头
        k.colSlab(X(xa), X(xb), y0, y0 + 0.55, za, zb);
        const face = dir > 0 ? Math.PI / 2 : -Math.PI / 2, fx = ft - dir * 0.28, lx = ft - dir * 0.12;
        this.seats.push({ wx: X(fx), wy: y0, wz: bz, face, free: true, world: true, id: this.seats.length, bed: r.kind, room: r.n,
          lie: { x: X(lx), y: y0 + 0.5 + 0.14, z: bz, yaw: face } });
      };
      const lamp = (x, z) => { P.slab(X(x - 0.25), X(x + 0.25), y0, y0 + 0.5, z - 0.22, z + 0.22, C.wood, { aoTop: true }); k.colSlab(X(x - 0.25), X(x + 0.25), y0, y0 + 0.5, z - 0.22, z + 0.22); P.cyl(X(x), y0 + 0.62, z, 0.08, 0.24, C.gold, 8); G.cyl(X(x), y0 + 0.82, z, 0.32, 0.22, hex('#FFE3B0'), 12, 0, 0, 0, 0.22); };
      if (twin) {
        bed(x0, 4.25, 2.0, 1.1, 1); bed(x0, 6.45, 2.0, 1.1, 1); lamp(x0 + 0.3, 5.35);
        this.tvWall(k, x1, -1, 5.2);
      } else {
        bed(x1, 5.0, 2.0, 1.8, -1); lamp(x1 - 0.3, 3.75); lamp(x1 - 0.3, 6.25);
        this.tvWall(k, x0, 1, 5.0);
      }
      // 小地毯 + 拖鞋
      P.slab(X(dx - 0.9), X(dx + 0.9), y0, y0 + 0.01, 3.6, 4.4, hex('#D8C8B0'), { ao: false });
      for (const s of [-1, 1]) P.box(X(twin ? x0 + 2.25 : x1 - 2.25), y0 + 0.02, 4.0 + s * 0.09, 0.25, 0.03, 0.1, C.white, 0, 0, 0, 1, { ao: false });
    }
  }
  /** 电视墙：桌子 + 电视（屏幕上是酒店欢迎画面）+ 小椅子 */
  tvWall(k, xw, dir, zc) {
    const P = k.solid, y0 = FY, xa = Math.min(xw, xw + dir * 0.55), xb = Math.max(xw, xw + dir * 0.55);
    P.slab(X(xa), X(xb), y0 + 0.72, y0 + 0.77, zc - 0.8, zc + 0.8, C.wood, { ao: false }); for (const z of [zc - 0.75, zc + 0.75]) P.slab(X(xa + 0.03), X(xb - 0.03), y0, y0 + 0.72, z - 0.03, z + 0.03, C.wood2, { ao: false });
    k.colSlab(X(xa), X(xb), y0, y0 + 0.8, zc - 0.8, zc + 0.8);
    const xs = xw + dir * 0.04;
    P.slab(X(Math.min(xw, xs)), X(Math.max(xw, xs)), y0 + 1.15, y0 + 1.95, zc - 0.7, zc + 0.7, hex('#1B1D20'), { ao: false });
    this.atlas.sign(X(xs + dir * 0.005), y0 + 1.55, zc, 1.32, 0.72, dir > 0 ? Math.PI / 2 : -Math.PI / 2, (c, w, h) => {
      const g = c.createLinearGradient(0, 0, w, h); g.addColorStop(0, '#2B4C6E'); g.addColorStop(1, '#5B3F5E'); c.fillStyle = g; c.fillRect(0, 0, w, h);
      c.fillStyle = '#E8C26A'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.font = `800 ${h * 0.2}px "Noto Sans CJK SC",sans-serif`; c.fillText('欢迎入住', w / 2, h * 0.38);
      c.fillStyle = '#fff'; c.font = `600 ${h * 0.13}px "Noto Sans CJK SC",sans-serif`; c.fillText('丽呈铂锐酒店 · REZEN', w / 2, h * 0.64);
    });
    P.slab(X(Math.min(xw + dir * 0.7, xw + dir * 1.1)), X(Math.max(xw + dir * 0.7, xw + dir * 1.1)), y0 + 0.42, y0 + 0.47, zc - 0.2, zc + 0.2, C.sofa, { ao: false });
  }
  /* ———————— 楼梯间（1F → 2F 两跑；2F → “3F” 两跑只在 2F 时显示） ———————— */
  stairs(k) {
    const S = ST, col = '#CFC9BC';
    const shell = (kk, y0, y1) => {
      const P = kk.solid;
      for (const [a, b, c, d] of [[S.x1, S.x1 + 0.15, S.z0, S.z1], [S.x0, S.x1 + 0.15, S.z1, S.z1 + 0.15], [S.x0, S.x1 + 0.15, S.z0 - 0.15, S.z0]]) { P.slab(X(a), X(b), y0, y1, c, d, C.wall, { ao: false }); kk.colSlab(X(a), X(b), y0, y1, c, d); }
      kk.colSlab(X(WX), X(S.x0), y0, y1, ST.zA, S.z1);
      kk.solid.slab(X(WX), X(S.x0), y0, y1, ST.zA, S.z1, C.wall, { ao: false });
    };
    const flights = (kk, base) => {
      const P = kk.solid;
      kk.stairs('z', S.zA, base, S.zB, base + FY / 2, S.el[0], S.el[1], base, col, { rails: false });
      P.slab(X(S.x0), X(S.x1), base + FY / 2 - 0.12, base + FY / 2, S.zB, S.z1, C.stair, { ao: false }); kk.colSlab(X(S.x0), X(S.x1), base + FY / 2 - 0.3, base + FY / 2, S.zB, S.z1);
      kk.stairs('z', S.zB, base + FY / 2, S.zA, base + FY, S.wl[0], S.wl[1], base + FY / 2, col, { rails: false });
      // 中间的井：两道栏杆（斜）+ 平台口的一小段
      for (const [x, ya, yb] of [[S.el[0] - 0.05, base, base + FY / 2], [S.wl[1] + 0.05, base + FY, base + FY / 2]]) {
        const A = [X(x), ya + 0.95, S.zA], Bp = [X(x), yb + 0.95, S.zB];
        kk.metal.tube(A, Bp, 0.05, C.steel, 6); kk.g('glass').box(X(x), (ya + yb) / 2 + 0.5, (S.zA + S.zB) / 2, 0.03, 0.85, Math.hypot(S.zB - S.zA, yb - ya), hex('#E2F2FA'), 0, -Math.atan2(yb - ya, S.zB - S.zA), 0);
        kk.col(X(x), (ya + yb) / 2 + 0.6, (S.zA + S.zB) / 2, 0.12, 1.4, Math.hypot(S.zB - S.zA, yb - ya), { rx: -Math.atan2(yb - ya, S.zB - S.zA) });
      }
    };
    // 1F 地面延伸进楼梯间（入口平台）+ 一跑二跑 + 2F 平台
    k.solid.slab(X(S.x0), X(S.x1), -0.1, 0, S.z0, S.zA, C.stair, { ao: false });
    k.solid.slab(X(S.wl[0]), X(S.wl[1]), 0, FY / 2, S.zA, S.zB, C.wall2, { ao: false }); k.colSlab(X(S.wl[0]), X(S.wl[1]), 0, FY / 2, S.zA, S.zB);   // 二跑下面封起来
    flights(k, 0); shell(k, 0, FY + CH);
    k.solid.slab(X(S.x0), X(S.x1), FY - 0.15, FY, S.z0, S.zA, C.stair, { ao: false }); k.colSlab(X(S.x0), X(S.x1), FY - 0.3, FY, S.z0, S.zA);
    // 楼层牌（平台墙上）
    this.stairPlates = [[X(S.x1 - 0.02), 1.7, (S.z0 + S.zA) / 2, -Math.PI / 2, 'lobby'], [X(S.x1 - 0.02), FY + 1.7, (S.z0 + S.zA) / 2, -Math.PI / 2, 'floor']];
    // 2F 时：再往上两跑 + 顶上平台（走到顶 = 3F）+ 楼梯间顶
    flights(this.up, FY); shell(this.up, FY + CH, 2 * FY + CH);
    this.up.solid.slab(X(S.x0), X(S.x1), 2 * FY - 0.15, 2 * FY, S.z0, S.zA, C.stair, { ao: false }); this.up.colSlab(X(S.x0), X(S.x1), 2 * FY - 0.3, 2 * FY, S.z0, S.zA);
    this.up.solid.slab(X(S.x0), X(S.x1 + 0.15), 2 * FY + CH, 2 * FY + CH + 0.1, S.z0 - 0.15, S.z1 + 0.15, C.white, { ao: false });
    this.up.colSlab(X(WX), X(S.x0), 2 * FY, 2 * FY + CH, S.z0, ST.zA);   // 顶上平台西侧是墙（没有门，传送前不会走出去）
    // 3F 时：楼梯间封顶 + 上楼口一道栏杆（顶层）
    this.cap.solid.slab(X(S.x0), X(S.x1 + 0.15), FY + CH, FY + CH + 0.1, S.z0 - 0.15, S.z1 + 0.15, C.white, { ao: false }); this.cap.colSlab(X(S.x0), X(S.x1 + 0.15), FY + CH, FY + CH + 0.1, S.z0 - 0.15, S.z1 + 0.15);
    this.cap.rail(X(S.el[0]), S.zA + 0.05, X(S.el[1]), S.zA + 0.05, FY);
    this.cap.solid.slab(X(S.x0), X(S.x1), FY + CH - 0.05, FY + CH, S.zA, S.z1, C.white, { ao: false });
  }
  /** 电梯井（四面墙从地面到 2F 顶） */
  shaft(k) {
    const P = k.solid, top = FY + CH + 0.3;
    for (const [a, b, c, d] of [[SX1, SX1 + 0.2, -SZ - 0.2, SZ + 0.2], [SX0, SX1, -SZ - 0.2, -SZ], [SX0, SX1, SZ, SZ + 0.2]]) { P.slab(X(a), X(b), -0.3, top, c, d, C.steel2, { ao: false }); k.colSlab(X(a), X(b), -0.3, top, c, d); }
    P.slab(X(SX0), X(SX1), -0.35, -0.3, -SZ, SZ, C.steel2, { ao: false });
  }
  /* ———————— 动态小贴图：门牌、楼层显示、轿厢按钮 ———————— */
  buildDyn() {
    const S = 512, tex = this.dyn = new B.DynamicTexture('hotelDyn', { width: S, height: S }, this.scene, true);
    tex.hasAlpha = false; this.dctx = tex.getContext();
    const p = [], uv = [], ind = [], cells = this.cells = {};
    const cell = (name, cx, cy, cw, chh) => { cells[name] = { x: cx, y: cy, w: cw, h: chh }; return { u0: (cx + 1) / S, u1: (cx + cw - 1) / S, v0: 1 - (cy + chh - 1) / S, v1: 1 - (cy + 1) / S }; };
    const quad = (x, y, z, w, h, a, u) => {
      const nx = Math.sin(a), nz = Math.cos(a), rx = -nz, rz = nx, base = p.length / 3, ox = x + nx * 0.012, oz = z + nz * 0.012;
      for (const [du, dv] of [[-w / 2, -h / 2], [w / 2, -h / 2], [w / 2, h / 2], [-w / 2, h / 2]]) p.push(ox + rx * du, y + dv, oz + rz * du);
      uv.push(u.u0, u.v0, u.u1, u.v0, u.u1, u.v1, u.u0, u.v1); ind.push(base, base + 1, base + 2, base, base + 2, base + 3);
    };
    // 楼层显示（大堂 / 走廊电梯口上方）
    const disp = cell('disp', 0, 0, 160, 64);
    quad(X(WX - 0.02), 2.75, 0, 0.75, 0.3, -Math.PI / 2, disp); quad(X(WX - 0.02), FY + 2.68, 0, 0.75, 0.3, -Math.PI / 2, disp);
    // 门牌（7 个）
    ROOMS.forEach((r, i) => { const u = cell('room' + r.n, 160 + (i % 4) * 88, Math.floor(i / 4) * 40, 88, 40); const dx = (r.x0 + r.x1) / 2 + 0.75, zf = r.side > 0 ? CW - 0.02 : -CW + 0.02; quad(X(dx), FY + 1.55, zf, 0.36, 0.17, r.side > 0 ? Math.PI : 0, u); });
    // 走廊上的大楼层牌 + 楼梯间楼层牌
    const fl = cell('floorBig', 0, 80, 256, 96);
    quad(X(7.2), FY + 2.0, ST.zA - 0.01, 1.2, 0.45, Math.PI, fl);
    const lob = cell('lobby', 256, 80, 256, 96);
    for (const [x, y, z, a, kind] of this.stairPlates) quad(x, y, z, 1.0, 0.38, a, kind === 'lobby' ? lob : fl);
    // 轿厢里的按钮面板（跟着轿厢走，单独一个网格）
    this.panelUV = cell('panel', 0, 192, 96, 192);
    const m = this.dynMesh = new B.Mesh('hotelDyn', this.scene), vd = new B.VertexData(), n = [];
    for (let i = 0; i < p.length; i += 3) n.push(0, 1, 0);
    vd.positions = p; vd.uvs = uv; vd.indices = ind; vd.normals = n; vd.applyToMesh(m);
    const mat = this.dynMat = new B.StandardMaterial('hotelDynMat', this.scene);
    mat.diffuseColor = new B.Color3(0, 0, 0); mat.specularColor = new B.Color3(0, 0, 0); mat.emissiveTexture = tex; mat.disableLighting = true; mat.backFaceCulling = false;
    m.material = mat; m.parent = this.kit.root; m.isPickable = false; m.freezeWorldMatrix();
  }
  /** 重画动态贴图：floor = 客房层现在是几楼；lift = { floor, dir, target } */
  drawDyn(lift) {
    const c = this.dctx, F = this.floor, cl = this.cells;
    const box = (n, bg) => { const r = cl[n]; c.fillStyle = bg; c.fillRect(r.x, r.y, r.w, r.h); return r; };
    const txt = (r, s, size, col, dy = 0.54, font = 'sans-serif', wt = 800) => { c.fillStyle = col; c.font = `${wt} ${size}px ${font}`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(s, r.x + r.w / 2, r.y + r.h * dy); };
    { const r = box('disp', '#111418'); const arrow = lift.dir > 0 ? '▲' : lift.dir < 0 ? '▼' : ''; c.fillStyle = '#FF9A3C'; c.font = '800 46px sans-serif'; c.textBaseline = 'middle'; c.textAlign = 'center'; c.fillText(String(lift.floor), r.x + r.w * 0.62, r.y + r.h * 0.55); if (arrow) { c.font = '800 30px sans-serif'; c.fillText(arrow, r.x + r.w * 0.25, r.y + r.h * 0.55); } }
    for (const r of ROOMS) { const q = box('room' + r.n, '#3A231B'); txt(q, `${F}0${r.n}`, 28, '#E8C26A'); }
    { const r = box('floorBig', '#3A231B'); txt(r, `${F}F`, 62, '#E8C26A', 0.42); txt(r, F === 3 ? '客房 301–307' : '客房 201–207', 22, '#FFFFFF', 0.82, '"Noto Sans CJK SC",sans-serif', 600); }
    { const r = box('lobby', '#3A231B'); txt(r, '1F', 62, '#E8C26A', 0.42); txt(r, '大堂 Lobby', 22, '#FFFFFF', 0.82, '"Noto Sans CJK SC",sans-serif', 600); }
    { const r = box('panel', '#C3CAD1'); const cx = r.x + r.w / 2;
      c.fillStyle = '#111418'; c.fillRect(r.x + 10, r.y + 8, r.w - 20, 34); c.fillStyle = '#FF9A3C'; c.font = '800 28px sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(String(lift.floor), cx, r.y + 26);
      [3, 2, 1].forEach((n, i) => { const y = r.y + 70 + i * 42; const on = lift.target === n; c.beginPath(); c.arc(cx, y, 17, 0, Math.PI * 2); c.fillStyle = on ? '#FFB347' : '#8F979F'; c.fill(); c.lineWidth = 3; c.strokeStyle = on ? '#FFF2C8' : '#5E666E'; c.stroke(); c.fillStyle = on ? '#3A231B' : '#FFFFFF'; c.font = '800 20px sans-serif'; c.fillText(String(n), cx, y + 1); }); }
    this.dyn.update(true);
  }
  /* ———————— 电梯 ———————— */
  buildLift() {
    const g = new Geo(), o = { ao: false }, w = SX1 - SX0 - 0.2, hw = SZ - 0.1, H = 2.45;
    g.slab(-w / 2, w / 2, -0.12, 0, -hw, hw, hex('#D8D2C4'), o);
    for (let i = 0; i < 4; i++) g.slab(-w / 2 + 0.2 + i * 0.5, -w / 2 + 0.25 + i * 0.5, 0, 0.004, -hw + 0.15, hw - 0.15, hex('#C9C2B2'), o);
    g.slab(w / 2 - 0.06, w / 2, 0, H, -hw, hw, C.steel, o); for (const s of [-1, 1]) g.slab(-w / 2, w / 2, 0, H, s > 0 ? hw - 0.06 : -hw, s > 0 ? hw : -hw + 0.06, C.steel, o);
    g.slab(w / 2 - 0.07, w / 2 - 0.06, 0.9, 2.1, -0.7, 0.7, hex('#9FB4C4'), o);           // 镜子
    g.slab(-w / 2, w / 2, H, H + 0.08, -hw, hw, C.steel2, o);
    g.tube([w / 2 - 0.12, 0.9, -0.8], [w / 2 - 0.12, 0.9, 0.8], 0.05, C.gold, 6);           // 扶手
    g.slab(-w / 2 + 0.1, -w / 2 + 0.5, 0.75, 1.65, -hw + 0.06, -hw + 0.08, C.steel2, o);     // 按钮面板底板
    const mesh = this.carMesh = g.toMesh('hotelCar', this.scene, this.M.paint, this.kit.root);
    const light = B.MeshBuilder.CreateCylinder('hotelCarLight', { diameter: 1.0, height: 0.02, tessellation: 16 }, this.scene);
    light.material = this.carLightMat = (() => { const m = new B.StandardMaterial('hotelCarLightMat', this.scene); m.emissiveColor = new B.Color3(1, 0.95, 0.85); m.disableLighting = true; return m; })();
    light.parent = mesh; light.position.set(0, H - 0.01, 0); light.isPickable = false;
    // 面板贴图（按钮灯）
    const pm = new B.Mesh('hotelCarPanel', this.scene), vd = new B.VertexData(), U = this.panelUV, pw = 0.16, ph = 0.32;
    vd.positions = [-pw, -ph, 0, pw, -ph, 0, pw, ph, 0, -pw, ph, 0]; vd.uvs = [U.u1, U.v0, U.u0, U.v0, U.u0, U.v1, U.u1, U.v1]; vd.indices = [0, 1, 2, 0, 2, 3, 0, 2, 1, 0, 3, 2]; vd.normals = [0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1]; vd.applyToMesh(pm);
    pm.material = this.dynMat; pm.parent = mesh; pm.position.set(-w / 2 + 0.3, 1.2, -hw + 0.095); pm.isPickable = false;
    // 碰撞地板（跟着轿厢动）
    const fl = this.carFloor = B.MeshBuilder.CreateBox('hotelCarFloor', { width: w, height: 0.3, depth: 2 * hw }, this.scene);
    fl.parent = mesh; fl.position.y = -0.15; fl.isVisible = false; fl.checkCollisions = true; fl.isPickable = true; fl.metadata = { collider: true };
    mesh.position.set(X((SX0 + SX1) / 2), 0, 0);
    this.lift = { y: 0, floor: 1, target: 0, dir: 0, state: 'idle', door: [0, 0], t: 0, queue: null, from: 1 };
  }
  buildDoors() {
    const mat = this.doorMat = new B.StandardMaterial('hotelDoorMat', this.scene); mat.diffuseColor = new B.Color3(0.72, 0.75, 0.79); mat.specularColor = new B.Color3(0.5, 0.5, 0.5);
    this.ldoors = [0, FY].map((y, L) => {
      const panels = [-1, 1].map(s => { const m = B.MeshBuilder.CreateBox('hotelLiftDoor', { width: 0.06, height: 2.32, depth: 0.62 }, this.scene); m.material = mat; m.parent = this.kit.root; m.position.set(X(WX + 0.12), y + 1.16, s * 0.3); m.isPickable = false; return m; });
      const col = B.MeshBuilder.CreateBox('hotelLiftDoorCol', { width: 0.3, height: 2.4, depth: 1.25 }, this.scene); col.parent = this.kit.root; col.position.set(X(WX + 0.12), y + 1.2, 0); col.isVisible = false; col.checkCollisions = true; col.metadata = { collider: true };
      return { panels, col, y, L };
    });
    // 两间能进的房门（铰链在一侧，走近了自己打开；只有 3F 能开）
    this.rdoors = ROOMS.filter(r => r.open).map(r => {
      const dx = (r.x0 + r.x1) / 2, zd = CW + 0.08;
      const pivot = new B.TransformNode('hotelDoorPivot', this.scene); pivot.parent = this.kit.root; pivot.position.set(X(dx - 0.45), FY, zd);
      const m = B.MeshBuilder.CreateBox('hotelRoomDoor', { width: 0.9, height: 2.15, depth: 0.05 }, this.scene); m.parent = pivot; m.position.set(0.45, 1.075, 0);
      const dm = new B.StandardMaterial('hotelRoomDoorMat', this.scene); dm.diffuseColor = new B.Color3(0.42, 0.27, 0.19); dm.specularColor = new B.Color3(0.1, 0.1, 0.1); m.material = dm;
      const knob = B.MeshBuilder.CreateSphere('hotelKnob', { diameter: 0.08, segments: 6 }, this.scene); knob.parent = m; knob.position.set(0.3, -0.08, -0.05); knob.material = this.doorMat;
      m.checkCollisions = true; m.isPickable = false;
      return { r, pivot, m, open: 0, x: X(dx), z: zd };
    });
  }
  staff() {
    const p = this.clerk = new Person(this.scene, this.M.paint, randomLook({ fem: true, top: '#3A231B', bottom: '#2B2F33' }), { parent: this.kit.root });
    p.mesh.position.set(X(-1.6), 0, 4.6); p.mesh.rotation.y = Math.PI; p.animate(0.016);
  }
  /* ———————— 状态 ———————— */
  setFloor(f, force) {
    if (f === this.floor && !force) return; this.floor = f;
    this.up.root.setEnabled(f === 2); this.cap.root.setEnabled(f === 3);
    this.drawDyn(this.lift);
  }
  setEnabled(v) { this.kit.root.setEnabled(v); this.active = v; if (v) { this.up.root.setEnabled(this.floor === 2); this.cap.root.setEnabled(this.floor === 3); } }
  wantsExit(p) { return p.y < 1 && p.z < -5.75 && Math.abs(p.x - X(0)) < 1.2; }
  seatNear(p) { let best = null, bd = 0.95; for (const s of this.seats) { if (!s.free || Math.abs(p.y - s.wy) > 1 || (s.room && this.floor !== 3)) continue; const d = Math.hypot(p.x - s.wx, p.z - s.wz); if (d < bd) { bd = d; best = s; } } return best; }
  /** 玩家在哪：'lobby' | 'corridor' | 'room' | 'stairs' | 'lift' */
  where(p) {
    const lx = p.x - HO.x;
    if (lx > SX0 && lx < SX1 && Math.abs(p.z) < SZ) return 'lift';
    if (lx > ST.x0 - 0.05 && p.z > ST.z0 - 0.1) return 'stairs';
    if (p.y < 2) return 'lobby';
    return p.z > CW + 0.15 && lx < 2.1 ? 'room' : 'corridor';
  }
  inCar(p) { const lx = p.x - HO.x; return lx > SX0 + 0.05 && lx < SX1 && Math.abs(p.z) < SZ && Math.abs(p.y - this.lift.y) < 1.2; }
  info() {
    const L = this.lift;
    return { active: !!this.active, floor: this.floor, lift: { y: +L.y.toFixed(2), floor: L.floor, state: L.state, door: L.door.map(v => +v.toFixed(2)), target: L.target },
      rooms: this.rdoors.map(d => ({ n: `${this.floor}0${d.r.n}`, kind: d.r.kind, open: +d.open.toFixed(2) })), seats: this.seats.map(s => ({ x: +s.wx.toFixed(2), y: s.wy, z: +s.wz.toFixed(2), face: +s.face.toFixed(3), bed: s.bed, free: s.free })) };
  }
  dispose() { this.kit.root.dispose(false, true); this.atlas.tex.dispose(); this.dyn.dispose(); }
}

/* ———————— 画布小图 ———————— */
function liftSign(c, w, h) { c.fillStyle = '#3A231B'; c.fillRect(0, 0, w, h); c.fillStyle = '#E8C26A'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.font = `800 ${h * 0.5}px "Noto Sans CJK SC",sans-serif`; c.fillText('电梯 Lift', w / 2, h * 0.55); }
function stairSign(c, w, h) { c.fillStyle = '#1F7A3A'; c.fillRect(0, 0, w, h); c.fillStyle = '#fff'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.font = `800 ${h * 0.52}px "Noto Sans CJK SC",sans-serif`; c.fillText('楼梯 Stairs', w / 2, h * 0.55); }
/** 窗外街景：天空 + 对面骑楼 + 远处高楼（广州塔）+ 街上的树和车；v 换一点变化 */
function streetView(c, w, h, v) {
  const g = c.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#7FB6E6'); g.addColorStop(0.65, '#CFE6F5'); g.addColorStop(1, '#E9F1F4'); c.fillStyle = g; c.fillRect(0, 0, w, h);
  // 远处高楼 + 广州塔
  const far = ['#9FB0C2', '#B3C0CE', '#A6B6C6'];
  for (let i = 0; i < 9; i++) { const bw = w * (0.07 + ((i * 37 + v * 11) % 5) * 0.012), bh = h * (0.25 + ((i * 53 + v * 7) % 7) * 0.05), bx = (i / 9) * w + ((v * 13) % 9); c.fillStyle = far[i % 3]; c.fillRect(bx, h * 0.62 - bh, bw, bh); }
  const tx = w * (0.18 + 0.2 * (v % 3)); c.fillStyle = '#E86A5A'; c.beginPath(); c.moveTo(tx - w * 0.035, h * 0.62); c.quadraticCurveTo(tx, h * 0.32, tx - w * 0.012, h * 0.12); c.lineTo(tx + w * 0.012, h * 0.12); c.quadraticCurveTo(tx, h * 0.32, tx + w * 0.035, h * 0.62); c.fill();
  c.fillRect(tx - 1.5, h * 0.02, 3, h * 0.1);
  // 对面骑楼（暖色、带拱窗）
  const cols = ['#F2E3C6', '#E8D2C2', '#DCE7E0', '#F3DCD2', '#F5EBD0'];
  for (let i = 0; i < 5; i++) { const bx = i * w / 5, bw = w / 5 - 2; c.fillStyle = cols[(i + v) % 5]; c.fillRect(bx, h * 0.5, bw, h * 0.35); c.fillStyle = '#FFFFFF'; for (const fx of [0.25, 0.65]) { c.fillRect(bx + bw * fx, h * 0.56, bw * 0.16, h * 0.1); } c.fillStyle = '#3E7B58'; for (const fx of [0.27, 0.67]) c.fillRect(bx + bw * fx, h * 0.575, bw * 0.12, h * 0.075); c.fillStyle = '#8E6A4A'; c.fillRect(bx + bw * 0.1, h * 0.74, bw * 0.8, h * 0.11); }
  // 街：路面 + 树 + 小车
  c.fillStyle = '#8E9196'; c.fillRect(0, h * 0.85, w, h * 0.15); c.fillStyle = '#F5F5F0'; for (let x = 0; x < w; x += w / 8) c.fillRect(x, h * 0.92, w / 16, 2);
  c.fillStyle = '#3F8A45'; for (let i = 0; i < 4; i++) { c.beginPath(); c.arc((i + 0.5) * w / 4, h * 0.72, h * 0.08, 0, Math.PI * 2); c.fill(); }
  const cars = ['#E8443A', '#1F5BB0', '#F2C230']; for (let i = 0; i < 2; i++) { c.fillStyle = cars[(i + v) % 3]; const cx = w * (0.2 + i * 0.45); c.fillRect(cx, h * 0.87, w * 0.12, h * 0.05); c.fillRect(cx + w * 0.02, h * 0.845, w * 0.07, h * 0.03); }
}
function cantonTower(c, w, h) {
  c.fillStyle = '#F5EBD8'; c.fillRect(0, 0, w, h); c.fillStyle = '#2B4C6E'; c.fillRect(w * 0.06, h * 0.06, w * 0.88, h * 0.88);
  c.fillStyle = '#E86A5A'; c.beginPath(); c.moveTo(w * 0.42, h * 0.9); c.quadraticCurveTo(w * 0.5, h * 0.5, w * 0.47, h * 0.18); c.lineTo(w * 0.53, h * 0.18); c.quadraticCurveTo(w * 0.5, h * 0.5, w * 0.58, h * 0.9); c.fill();
  c.fillStyle = '#FFE3B0'; for (let i = 0; i < 12; i++) c.fillRect(w * (0.1 + Math.random() * 0.8), h * (0.6 + Math.random() * 0.3), 2, 2);
}

/* ================= 控制器：进出酒店、电梯、房门、躺下 ================= */
export class HotelCtl {
  constructor({ scene, M, player, hud, seats, Audio, events, getStation, getCode }) {
    Object.assign(this, { scene, M, player, hud, seats, Audio, events, getStation, getCode });
    this.interior = null; this.cur = null; this.count = { enter: 0, call: 0, ride: 0, lie: 0, stairsUp: 0 };
    const orig = seats.hall; seats.hall = () => (this.interior && this.interior.active ? this.interior : orig ? orig() : null);
    const hudEl = document.getElementById('hud');
    hudEl.insertAdjacentHTML('beforeend', `<button id="bLie" class="btn big lie" hidden aria-label="躺下"><svg class="ico"><use href="#i-bed"/></svg><span class="lbl">躺下</span></button>
      <div id="liftPanel" class="glass" hidden><b>电梯</b><div class="fl"></div></div>`);
    this.lieBtn = document.getElementById('bLie'); pressable(this.lieBtn, () => this.toggleLie());
    this.panel = document.getElementById('liftPanel');
    this.panel.querySelector('.fl').innerHTML = [3, 2, 1].map(n => `<button class="flb" data-f="${n}"><span>${n}</span><small>${n === 1 ? '大堂' : n + ' 楼'}</small></button>`).join('');
    this.panel.querySelectorAll('.flb').forEach(b => pressable(b, () => this.press(+b.dataset.f)));
    ['pointerdown', 'pointermove', 'pointerup', 'touchstart', 'click'].forEach(t => this.panel.addEventListener(t, e => e.stopPropagation()));
  }
  enter(st) {
    if (!this.interior) this.interior = new HotelInterior(this.scene, this.M);
    const I = this.interior; I.setFloor(2, true); I.setEnabled(true); st.kit.root.setEnabled(false);
    const s = I.spawn; this.player.spawn(s.x, s.y, s.z, s.yaw);
    this.cur = { st }; this.count.enter++;
    this.hud.toast('欢迎光临 丽呈铂锐酒店！', 2200); this.Audio.blip && this.Audio.blip('tap');
    this.events.emit('hotel', { enter: true });
  }
  exit() {
    const { st } = this.cur; if (this.player.seat) this.seats.stand();
    this.interior.setEnabled(false); this.cur = null; this.panel.hidden = true; this.lieBtn.hidden = true;
    if (st === this.getStation()) { st.kit.root.setEnabled(true); this.player.spawn(HOTEL_DOOR.x - 1.4, 0.05, HOTEL_DOOR.z, -Math.PI / 2); }
    this.events.emit('hotel', { enter: false });
  }
  /** 叫电梯 / 按楼层 */
  call() { const I = this.interior, p = this.player.position; const f = p.y < 2 ? 1 : I.floor; this.count.call++; this.Audio.blip && this.Audio.blip('tap'); this.go(f); }
  press(f) { this.Audio.blip && this.Audio.blip('tap'); this.count.ride += f !== this.interior.lift.floor ? 1 : 0; this.go(f); }
  go(f) {
    const L = this.interior.lift;
    if (L.state === 'moving') { L.queue = f; return; }
    L.target = f;
    if (f === L.floor) { if (L.state !== 'open') L.state = 'opening'; L.t = 0; L.target = 0; this.interior.drawDyn(L); return; }
    L.queue = f; if (L.state === 'open' || L.state === 'opening') { L.state = 'closing'; } else if (L.state === 'idle') this.startMove();
    this.interior.drawDyn(L);
  }
  startMove() { const L = this.interior.lift; L.state = 'moving'; L.from = L.floor; L.to = L.queue; L.queue = null; L.t = 0; L.dir = Math.sign(L.to - L.from); L.dur = 1.3 * Math.abs(L.to - L.from) + 0.6; this.interior.drawDyn(L); }
  toggleLie() { const pl = this.player; if (!pl.seat || !pl.seat.seat.bed) return; pl.lying = !pl.lying; if (pl.lying) this.count.lie++; this.Audio.blip && this.Audio.blip(pl.lying ? 'sit' : 'stand'); this.events.emit('hotel', { lie: pl.lying }); }
  /** 每帧（主循环里，玩家更新之后）：返回右下角动作按钮（按电梯）或 null */
  update(dt) {
    const st = this.getStation(), pl = this.player, p = pl.position;
    if (!this.cur) {
      if (this.interior && this.interior.active) this.interior.setEnabled(false);
      if (!st || !st.njs || pl.seat || p.y < -1 || p.y > 2 || p.x > 400) return null;
      const D = HOTEL_DOOR; if (p.x > D.x - 0.9 && p.x < D.x + 0.5 && Math.abs(p.z - D.z) < D.half) this.enter(st);
      return null;
    }
    if (st !== this.cur.st) { this.interior.setEnabled(false); this.cur = null; return null; }
    const I = this.interior, L = I.lift;
    if (I.wantsExit(p) && !pl.seat) { this.exit(); return null; }
    // —— 电梯
    const inCar = I.inCar(p);
    if (L.state === 'opening') { L.t += dt; if (L.t > 0.8) { L.state = 'open'; L.t = 0; L.dir = 0; I.drawDyn(L); } }
    else if (L.state === 'open') { L.t += dt; const lx = p.x - HO.x, inDoor = lx > WX - 0.6 && lx < SX0 + 0.5 && Math.abs(p.z) < 0.8 && Math.abs(p.y - L.y) < 1.5; if (L.queue && !inDoor) L.state = 'closing'; else if (L.t > 10 && !inDoor && !inCar) L.state = 'closing'; }
    else if (L.state === 'closing') { L.t = 0; }
    else if (L.state === 'moving') {
      L.t += dt; const k = Math.min(1, L.t / L.dur), e = k * k * (3 - 2 * k);
      const yA = L.from === 1 ? 0 : FY, yB = L.to === 1 ? 0 : FY, ny = yA + (yB - yA) * e;
      const shown = Math.round(L.from + (L.to - L.from) * Math.min(1, k * 1.15)); if (shown !== L.floor) { L.floor = shown; I.drawDyn(L); }
      const wasIn = I.inCar(p);
      L.y = ny; I.carMesh.position.y = ny;
      if (wasIn) { p.y = ny + 0.02; pl.groundY = ny; pl.vy = 0; pl.collider.computeWorldMatrix(true); }
      if (k >= 1) { L.floor = L.to; L.target = 0; L.state = 'opening'; L.t = 0; L.dir = 0; if (L.to >= 2 && (wasIn || p.y > 3)) I.setFloor(L.to); I.drawDyn(L); this.Audio.blip && this.Audio.blip('goal'); this.events.emit('hotel', { arrive: L.floor }); }
    }
    // 门的开合（只开轿厢所在那一层）
    const want = L.state === 'opening' || L.state === 'open' ? 1 : 0, level = L.y > 2 ? 1 : 0;
    for (const d of I.ldoors) {
      const tgt = d.L === level && L.state !== 'moving' ? want : 0, cur = L.door[d.L];
      const nv = cur + Math.sign(tgt - cur) * Math.min(Math.abs(tgt - cur), dt / 0.7); L.door[d.L] = nv;
      d.panels[0].position.z = -0.3 - 0.58 * nv; d.panels[1].position.z = 0.3 + 0.58 * nv;
      const blocked = nv < 0.85; if (d.col.isEnabled() !== blocked) d.col.setEnabled(blocked);
    }
    if (L.state === 'closing' && L.door[level] <= 0.001) { if (L.queue) this.startMove(); else { L.state = 'idle'; L.dir = 0; I.drawDyn(L); } }
    // —— 楼梯：2F 走到最上面 = 3F（往下挪 4.5m）；3F 往下走 = 2F
    const lx = p.x - HO.x;
    if (lx > ST.x0 - 0.05 && p.z > ST.z0 - 0.1) {
      if (I.floor === 2 && p.y > 2 * FY - 0.35) { this.shiftY(-FY); I.setFloor(3); this.count.stairsUp++; this.events.emit('hotel', { stairs: 3 }); }
      else if (I.floor === 3 && p.y < FY - 0.35 && p.y > 2.5) { I.setFloor(2); this.shiftY(FY); }
    }
    if (p.y < 2.5 && I.floor !== 2 && !(L.state === 'moving' && inCar)) I.setFloor(2);
    // —— 房门（3F 走近了自己开）
    for (const d of I.rdoors) {
      const near = I.floor === 3 && Math.abs(p.y - FY) < 1.5 && Math.hypot(p.x - d.x, p.z - d.z) < 1.8;
      const nv = d.open + Math.sign((near ? 1 : 0) - d.open) * Math.min(Math.abs((near ? 1 : 0) - d.open), dt / 0.6);
      if (nv !== d.open) { d.open = nv; d.pivot.rotation.y = -nv * 1.6; }
      const block = d.open < 0.7; if (d.m.checkCollisions !== block) d.m.checkCollisions = block;
    }
    // 2F 的门：走到门口提示一下
    if (I.floor === 2 && Math.abs(p.y - FY) < 1.5) for (const d of I.rdoors) if (Math.hypot(p.x - d.x, p.z - d.z) < 1.0 && !this._lockToast) { this._lockToast = 3; this.hud.toast(`${I.floor}0${d.r.n} 是别人的房间，去 3 楼看看吧`, 2200); }
    if (this._lockToast) this._lockToast = Math.max(0, this._lockToast - dt);
    // —— 界面：躺下按钮、电梯面板
    const bed = pl.seat && pl.seat.seat.bed; this.lieBtn.hidden = !bed;
    if (bed) { const lbl = pl.lying ? '坐起来' : '躺下'; if (this.lieBtn.dataset.l !== lbl) { this.lieBtn.dataset.l = lbl; this.lieBtn.querySelector('.lbl').textContent = lbl; } }
    const showPanel = inCar && L.state !== 'moving'; if (this.panel.hidden === showPanel) this.panel.hidden = !showPanel;
    if (showPanel) this.panel.querySelectorAll('.flb').forEach(b => b.classList.toggle('on', +b.dataset.f === L.floor || +b.dataset.f === L.target));
    // 动作按钮：电梯口「按电梯」
    if (!inCar && !pl.seat && L.state !== 'moving') {
      const callY = p.y < 2 ? 0 : FY, here = (callY === 0 ? 1 : I.floor);
      if (lx > WX - 1.6 && lx < WX + 0.2 && Math.abs(p.z) < 1.5 && Math.abs(p.y - callY) < 1 && !(L.floor === here && (L.state === 'open' || L.state === 'opening')))
        return { id: 'lift', label: '按电梯', icon: 'lift', run: () => this.call() };
    }
    return null;
  }
  shiftY(d) { const pl = this.player; pl.position.y += d; pl.groundY += d; if (pl.camY !== undefined) pl.camY += d; if (pl.eyeY !== undefined) pl.eyeY += d; if (pl.camCap !== undefined) pl.camCap += d; pl.collider.computeWorldMatrix(true); }
  info() { return { inside: !!this.cur, where: this.cur ? this.interior.where(this.player.position) : null, interior: this.interior && this.cur ? this.interior.info() : null, lying: !!this.player.lying, count: this.count, panel: !this.panel.hidden, lieBtn: !this.lieBtn.hidden }; }
}
