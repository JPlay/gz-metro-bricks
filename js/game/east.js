/*
 * 广州东站 · 复兴号 5 号车厢（二等座，室内，独立场景）：从站台上开着的车门走进去才加载，出门就关掉。
 *   - 放在 EO = (2200, 0, 0)（x > 400 → zone 'hall'：街面 / 站内都关掉，没有车站广播）；车厢沿 x，车头方向 = +x；
 *     车里 local x = 站台上的世界 x − EMU.xc（两扇门 local ±11.2 和站台上的门对得上），+z 一侧是站台；
 *   - 客室 local x −9.6..9.6：每排 2+3 座（蓝灰色座椅、白色头枕套，都朝车头），中间过道；18 排；
 *   - 两边大车窗（站台一侧看得到站台和雨棚，另一侧是轨道、围墙和天空），行李架，顶灯；
 *   - 两头端墙中间是开着的玻璃门，门上方一块显示屏（车次 / 区间 / 车厢号）；
 *   - 门厅（local ±9.6..12.5）：站台一侧的车门开着，走到门口（z > 1.3）就下车，站在站台上。
 *   - 坐下 → 车门关上 → 开车（js/data/rail.js：D2315 广州东 → 厦门北，时间压缩约 3 分钟；回程 D3311 厦门北 → 广州东）。
 *     开车时站台（真实几何，单独的 Kit）往后滑走；车窗外是循环滚动的远景板（js/world/emuScenery.js：城市 → 田野 → 山和隧道 → 九龙江特大桥 → 厦门），
 *     到站前目的地站台从前面滑进来停稳、开门；行驶中可以起身在车厢里走动；右下角「快进」×4 / ×10。
 *   - 厦门北站：下车就站在厦门北站站台上（js/world/xmn.js，放在 XO，独立场景）；从同一扇车门上车、坐下就开回广州东。
 *   - 没有任务 / 引导条。
 */
import { Kit } from '../world/kit.js';
import { hex, Geo } from '../core/geo.js';
import { FoodAtlas } from './food-art.js';
import { bakePerson, randomLook, POSES } from '../world/people.js';
import { EMU, GZE, BF } from '../world/gze.js';
import { EmuScenery } from '../world/emuScenery.js';
import { XmnPlatform, XO } from '../world/xmn.js';
import { RAIL, TRIP, routeFor } from '../data/rail.js';
import * as Ann from '../audio/announcements.js';
import * as PH from '../data/phrases.js';
import { pressable } from './input.js';
const B = window.BABYLON;

export const EO = { x: 2200, z: 0 };
const X = x => EO.x + x;
const C = {
  floor: hex('#8D939A'), aisle: hex('#767E86'), wall: hex('#ECEEEF'), wall2: hex('#DADDE0'), frame: hex('#B9BEC3'), ceil: hex('#F4F5F5'),
  seat: hex('#566C80'), seat2: hex('#4A5E71'), head: hex('#EEF1F3'), arm: hex('#5B6066'), back: hex('#9AA2AA'), tray: hex('#7E868E'),
  rack: hex('#C3C8CC'), dark: hex('#3A3F45')
};
const W = 1.6, HC = 2.38, SX = 9.6, EX = 12.5;           // 半宽、顶高、客室端墙、车厢端
const ROWS = 18, XB0 = -9.25, PITCH = 1.0;                 // 第一排靠背 x、排距
const BL3 = [-1.5, -0.16], BL2 = [0.66, 1.5];              // 三人座 / 二人座的 z 范围；中间是过道
const AISLE_Z = 0.25;
/** 端门上方的显示屏（黑底红色点阵字） */
const paintDisplay = trip => (c, pw, ph) => {
  c.fillStyle = '#07080A'; c.fillRect(0, 0, pw, ph); c.textBaseline = 'middle';
  c.fillStyle = '#FF4A2E'; c.font = `700 ${ph * 0.42}px sans-serif`;
  c.textAlign = 'left'; c.fillText(trip.train, pw * 0.03, ph * 0.52);
  c.textAlign = 'center'; c.fillText(trip.from + '→' + trip.to, pw * 0.47, ph * 0.52);
  c.textAlign = 'right'; c.fillStyle = '#FFB13D'; c.fillText(EMU.car + '车 二等座', pw * 0.97, ph * 0.52);
};
export class EastInterior {
  constructor(scene, M) {
    this.scene = scene; this.M = M; this.seats = [];
    const k = this.kit = new Kit(scene, 'emu-int'), atlas = this.atlas = new FoodAtlas(scene, 1024);
    this.trip = RAIL.xm;
    this.build(k, atlas);
    this.doorLeaf(k);
    k.finish(); atlas.finish(k.root, 'emuSigns');
    // 车窗玻璃：比站里的玻璃更通透（少反光），车窗外的风景才看得清
    const gm = k.byBucket['glass@emu'] && k.byBucket['glass@emu'].material; if (gm) { gm.alpha = 0.15; gm.environmentIntensity = 0.5; k.byBucket['glass@emu'].alphaIndex = 10; this.pane.material = gm; }
    // 车窗外的广州东站站台：单独的 Kit（开车时整体往后滑走），不冻结世界矩阵
    const ko = this.outGz = new Kit(scene, 'emu-out-gz'), ao = this.outGzAtlas = new FoodAtlas(scene, 512);
    this.outside(ko, ao); ko.finish(false); ao.finish(ko.root, 'emuOutSigns');
    // 车窗外的远景（挂在车厢中心）
    this.anchor = new B.TransformNode('emuAnchor', scene); this.anchor.position.set(EO.x, 0, 0);
    this.scenery = new EmuScenery(scene, this.anchor);
    this.kit.root.setEnabled(false); this.outGz.root.setEnabled(false); this.anchor.setEnabled(false); this.active = false;
  }
  build(k, atlas) {
    const P = k.solid, G = k.glow;
    // 地板（过道颜色深一点）+ 碰撞
    P.slab(X(-EX), X(EX), -0.1, 0, -W, W, C.floor, { ao: false });
    P.slab(X(-SX), X(SX), 0, 0.004, BL3[1] + 0.02, BL2[0] - 0.02, C.aisle, { ao: false });
    k.colSlab(X(-EX - 1), X(EX + 1), -0.6, 0, -W - 1, W + 1);
    // 顶：平顶 + 两侧斜板；两条长灯带
    P.slab(X(-EX), X(EX), HC, HC + 0.05, -1.05, 1.05, C.ceil, { ao: false });
    for (const s of [-1, 1]) P.box(X(0), HC - 0.2, s * 1.33, EX * 2, 0.05, 0.62, C.ceil, 0, s * 0.62, 0, 1, { ao: false });
    for (const s of [-1, 1]) G.slab(X(-SX + 0.2), X(SX - 0.2), HC - 0.02, HC - 0.005, s * 0.62 - 0.11, s * 0.62 + 0.11, hex('#FFFFFF'));
    G.slab(X(-SX + 0.2), X(SX - 0.2), HC - 0.015, HC, -0.05, 0.05, hex('#EAF3FF'));
    // 两侧墙：下墙板 + 大车窗（窗间柱）+ 窗上墙板；窗外是画（站台一侧 / 另一侧）
    const winY0 = 1.0, winY1 = 1.74, NWIN = 10, WP = 2 * SX / NWIN, PIER = 0.62;   // 每块窗 1.3 m 宽、窗间柱 0.62 m
    for (const s of [-1, 1]) {
      const zw = s * W, zi = s * (W - 0.12);   // 车厢侧墙有 12 cm 厚：窗洞四周看得到窗套的厚度
      // 站台一侧开着的车门处墙板挖开（真的门洞，看得到外面的站台）
      const holes = s > 0 ? EMU.doors.map(d => [d.lx - 0.5, d.lx + 0.5]) : [];
      const cut = (a, b) => { const out = []; let x = a; for (const [h0, h1] of holes) if (h1 > a && h0 < b) { if (h0 > x) out.push([x, h0]); x = h1; } if (x < b) out.push([x, b]); return out; };
      const zs = [Math.min(zw, zi), Math.max(zw, zi)];
      for (const [a, b] of cut(-EX, EX)) { P.slab(X(a), X(b), 0, winY0, ...zs, C.wall2, { ao: false }); P.slab(X(a), X(b), winY1, HC - 0.3, ...zs, C.wall, { ao: false }); }
      for (const [a, b] of [...cut(-EX, -SX), ...cut(SX, EX)]) P.slab(X(a), X(b), winY0, winY1, ...zs, C.wall2, { ao: false });   // 门厅没有车窗
      for (const [h0, h1] of holes) {
        P.slab(X(h0), X(h1), 2.0, HC - 0.3, ...zs, C.wall, { ao: false });                                       // 门洞上方
        for (const x of [h0, h1]) P.slab(X(x - 0.04), X(x + 0.04), 0, 2.04, zi - 0.02, zw + 0.02, C.frame, { ao: false });   // 门框
        P.slab(X(h0 - 0.04), X(h1 + 0.04), 2.0, 2.06, zi - 0.02, zw + 0.02, C.frame, { ao: false });
        P.slab(X(h0), X(h1), -0.1, 0.0, W, GZE.edge - GZE.tz, hex('#9AA0A6'), { ao: false });                    // 踏板（接到站台边）
      }
      k.g('glass@emu').slab(X(-SX), X(SX), winY0, winY1, s * (W - 0.035) - 0.004, s * (W - 0.035) + 0.004, hex('#DCEBF2'));   // 车窗玻璃
      if (s < 0) k.colSlab(X(-EX), X(EX), 0, HC, -W - 0.4, -W + 0.06);
      else {   // 站台一侧：两扇开着的车门处留口（门口外面再挡一下，走到门口就下车）
        const hs = EMU.doors.map(d => d.lx).sort((a, b) => a - b); let a0 = -EX;
        for (const lx of hs) { k.colSlab(X(a0), X(lx - 0.5), 0, HC, W - 0.06, W + 0.4); a0 = lx + 0.5; }
        k.colSlab(X(a0), X(EX), 0, HC, W - 0.06, W + 0.4);
        for (const d of EMU.doors) k.colSlab(X(d.lx - 0.6), X(d.lx + 0.6), 0, HC, W + 0.15, W + 0.6);
      }
      // 窗间柱 + 窗套：一排大窗，每扇四周一圈深灰窗框（压在墙面上 1.5 cm）、上面卷着的遮阳帘、下面一条窗台
      const zf = [Math.min(zi, zi - s * 0.015), Math.max(zi, zi - s * 0.015)], fr = hex('#7D858C'), ft = 0.05;
      for (let i = 0; i <= NWIN; i++) { const c = -SX + i * WP, a = Math.max(-SX, c - PIER / 2), b = Math.min(SX, c + PIER / 2); P.slab(X(a), X(b), winY0, winY1, ...zs, C.wall, { ao: false }); }
      for (let i = 0; i < NWIN; i++) {
        const a = -SX + i * WP + PIER / 2, b = -SX + (i + 1) * WP - PIER / 2;
        P.slab(X(a - ft), X(b + ft), winY1, winY1 + ft, ...zf, fr, { ao: false }); P.slab(X(a - ft), X(b + ft), winY0 - ft, winY0, ...zf, fr, { ao: false });
        for (const x of [a - ft, b]) P.slab(X(x), X(x + ft), winY0, winY1, ...zf, fr, { ao: false });
        P.slab(X(a), X(b), winY1 - 0.07, winY1, Math.min(zi + s * 0.02, zi + s * 0.07), Math.max(zi + s * 0.02, zi + s * 0.07), hex('#5F7182'), { ao: false });   // 卷起的遮阳帘
        P.slab(X(a - 0.04), X(b + 0.04), winY0 - 0.035, winY0, Math.min(zi, s * (W - 0.24)), Math.max(zi, s * (W - 0.24)), C.frame, { ao: false });   // 窗台（往车里伸出 12 cm）
      }
      // 窗下墙板上一条浅色腰线
      P.slab(X(-SX), X(SX), 0.5, 0.53, ...zf, hex('#C9CDD1'), { ao: false });
      // 行李架（金属托架 + 浅色板 + 前沿圆管）
      const r0 = s * 1.1, r1 = s * (W - 0.06);
      P.slab(X(-SX + 0.1), X(SX - 0.1), 1.95, 1.98, Math.min(r0, r1), Math.max(r0, r1), C.rack, { ao: false });
      P.tube([X(-SX + 0.1), 1.99, r0], [X(SX - 0.1), 1.99, r0], 0.045, hex('#D5D9DC'), 6);
      for (let x = -SX + 0.6; x < SX; x += 2.0) P.slab(X(x - 0.03), X(x + 0.03), 1.86, 1.98, Math.min(r0 + s * 0.05, r1), Math.max(r0 + s * 0.05, r1), hex('#AEB4B9'), { ao: false });
      // 行李架下的阅读灯 / 服务面板一条
      G.slab(X(-SX + 0.2), X(SX - 0.2), 1.935, 1.95, Math.min(s * 1.2, s * 1.35), Math.max(s * 1.2, s * 1.35), hex('#F3F7FF'));
    }
    // 行李架上的箱包
    const bagC = ['#2F4A6E', '#8C2F2F', '#3E6B4B', '#C7A35A', '#5A5F66', '#D9822B'];
    [[-7.4, -1, 0.6], [-3.1, 1, 0.45], [0.8, -1, 0.5], [2.2, -1, 0.4], [5.6, 1, 0.55], [7.0, -1, 0.5]].forEach(([x, s, w], i) => P.rbox(X(x), 1.98, s * 1.35, w, 0.26, 0.38, hex(bagC[i % bagC.length]), 0.05, 0, { ao: false }));
    // 座椅：每排 3 + 2，都朝 +x（车头方向）
    for (let r = 0; r < ROWS; r++) {
      const xb = XB0 + r * PITCH;
      for (const [z0, z1, n] of [[...BL3, 3], [...BL2, 2]]) {
        const w = (z1 - z0) / n;
        P.slab(X(xb + 0.1), X(xb + 0.42), 0.0, 0.34, z0 + 0.08, z1 - 0.08, C.arm, { ao: false });                // 座椅底座
        for (let i = 0; i < n; i++) {
          const zc = z0 + w * (i + 0.5);
          P.rbox(X(xb + 0.3), 0.34, zc, 0.46, 0.13, w - 0.05, C.seat, 0.04, 0, { ao: false });                      // 座垫（顶 0.47）
          P.box(X(xb + 0.05), 0.73, zc, 0.11, 0.54, w - 0.05, C.seat2, 0, 0, 0.1, 1, { ao: false });                   // 靠背（略往后仰）
          P.box(X(xb + 0.045), 1.04, zc, 0.13, 0.13, w - 0.09, C.seat2, 0, 0, 0.1, 1, { ao: false });                   // 头枕
          P.box(X(xb + 0.115), 1.01, zc, 0.012, 0.17, w - 0.14, C.head, 0, 0, 0.1, 1, { ao: false });                 // 白色头枕套
          P.box(X(xb - 0.015), 0.76, zc, 0.012, 0.3, w - 0.16, C.tray, 0, 0, 0.1, 1, { ao: false });                 // 椅背上的小桌板
          const seat = { wx: X(xb + 0.3), wy: 0, wz: zc, face: Math.PI / 2, eye: 1.34, free: true, world: true, id: this.seats.length, row: r + 1, letter: 'ABCDF'[(z0 < 0 ? 0 : 3) + i], stand: { x: X(xb + 0.42), z: AISLE_Z } };
          this.seats.push(seat);
        }
        for (let i = 0; i <= n; i++) P.slab(X(xb + 0.08), X(xb + 0.52), 0.56, 0.62, z0 + w * i - 0.025, z0 + w * i + 0.025, C.arm, { ao: false });   // 扶手
        k.colSlab(X(xb - 0.08), X(xb + 0.22), 0, 1.1, z0, z1);
      }
    }
    // 几位坐着的乘客（烘焙进 paint 桶，不额外占 draw）
    for (const [r, letter, look] of [[2, 'A', {}], [5, 'C', { phone: true }], [6, 'F', {}], [9, 'B', {}], [11, 'D', { phone: true }], [14, 'A', {}], [16, 'F', {}]]) {
      const s = this.seats.find(q => q.row === r && q.letter === letter); if (!s) continue;
      s.free = false; const L = randomLook(look);
      bakePerson(P, s.wx, s.wy + 0.48 - (L.kid ? 0.6 : 0.86) * L.scale, s.wz, s.face, L, look.phone ? POSES.sitPhone : POSES.sit);
    }
    // 客室两头的端墙（中间开着的玻璃门 = 过道）+ 门上方的显示屏
    const dz0 = BL3[1] + 0.01, dz1 = BL2[0] - 0.01;
    for (const e of [-1, 1]) {
      const xe = e * SX, a = e > 0 ? -Math.PI / 2 : Math.PI / 2;
      for (const [z0, z1] of [[-W, dz0], [dz1, W]]) { P.slab(X(xe - 0.06), X(xe + 0.06), 0, HC, z0, z1, C.wall, { ao: false }); k.colSlab(X(xe - 0.06), X(xe + 0.06), 0, HC, z0, z1); }
      P.slab(X(xe - 0.06), X(xe + 0.06), 2.0, HC, dz0, dz1, C.wall, { ao: false });
      k.g('glass').slab(X(xe - 0.03), X(xe + 0.03), 0, 1.98, dz1, dz1 + 0.7, hex('#CFE3EE'));   // 滑开的玻璃门扇（叠在墙后）
      for (const z of [dz0, dz1]) P.slab(X(xe - 0.07), X(xe + 0.07), 0, 2.0, z - 0.03, z + 0.03, C.frame, { ao: false });
      const uv = this.dispUV || (this.dispUV = atlas.draw(2.0, 0.26, paintDisplay(this.trip), 300));
      atlas.quad(X(xe - e * 0.07), 2.12, -0.35, 2.0, 0.26, a, uv);
      P.slab(X(xe - e * 0.075), X(xe - e * 0.065), 1.97, 2.27, -1.38, 0.68, C.dark, { ao: false });   // 显示屏边框
      // 端墙上的车厢号牌
      atlas.sign(X(xe - e * 0.07), 1.55, -0.9, 0.5, 0.36, a, (c, pw, ph) => { c.fillStyle = '#F4F5F3'; c.fillRect(0, 0, pw, ph); c.fillStyle = '#3A3F45'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.font = `800 ${ph * 0.6}px sans-serif`; c.fillText(EMU.car, pw / 2, ph * 0.5); });
    }
    // 门厅（客室外两头）：站台一侧车门开着（外面是亮的站台），另一侧车门关着；最外头是通往邻车的风挡门（关着）
    for (const e of [-1, 1]) {
      const xd = e * 11.2;
      P.slab(X(e > 0 ? EX - 0.06 : -EX), X(e > 0 ? EX : -EX + 0.06), 0, HC, -W, W, C.wall2, { ao: false }); k.colSlab(X(e > 0 ? EX - 0.06 : -EX - 0.4), X(e > 0 ? EX + 0.4 : -EX + 0.06), 0, HC, -W, W);
      P.slab(X(e > 0 ? EX - 0.07 : -EX + 0.06), X(e > 0 ? EX - 0.06 : -EX + 0.07), 0, 2.0, -0.45, 0.45, C.frame, { ao: false });
      // 站台一侧：开着的车门是真的门洞（见上面的墙板）；没开的那扇画成关着的门
      if (!EMU.doors.some(d => d.lx === xd)) {
        P.slab(X(xd - 0.5), X(xd + 0.5), 0, 2.0, W - 0.125, W - 0.115, hex('#E3E6E8'), { ao: false });
        P.slab(X(xd - 0.2), X(xd + 0.2), 1.1, 1.7, W - 0.13, W - 0.126, C.dark, { ao: false });
        P.slab(X(xd - 0.005), X(xd + 0.005), 0, 2.0, W - 0.135, W - 0.13, C.frame, { ao: false });
      }
      // 另一侧：关着的车门
      P.slab(X(xd - 0.5), X(xd + 0.5), 0, 2.0, -W + 0.115, -W + 0.125, hex('#E3E6E8'), { ao: false });
      P.slab(X(xd - 0.2), X(xd + 0.2), 1.1, 1.7, -W + 0.126, -W + 0.13, C.dark, { ao: false });
      P.slab(X(xd - 0.005), X(xd + 0.005), 0, 2.0, -W + 0.13, -W + 0.135, C.frame, { ao: false });
      atlas.sign(X(xd + e * 1.0), 1.75, -W + 0.14, 0.8, 0.3, 0, (c, pw, ph) => { c.fillStyle = '#1F6B4A'; c.fillRect(0, 0, pw, ph); c.fillStyle = '#FFFFFF'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.font = `700 ${ph * 0.45}px sans-serif`; c.fillText('车门 Door', pw / 2, ph / 2); });
    }
    // 门厅里的扶手
    for (const d of EMU.doors) for (const dx of [-0.6, 0.6]) P.tube([X(d.lx + dx), 0.9, W - 0.12], [X(d.lx + dx), 1.8, W - 0.12], 0.035, hex('#C9CDD0'), 6);
  }
  /**
   * 车窗外：和街面那套站台对得上的真实几何（不是贴图）——车厢 local z = 世界 z − GZE.tz，local x = 世界 x − EMU.xc。
   * 站台一侧（+z）：站台地面、白边 + 黄色盲道、雨棚柱、雨棚顶 + 灯带、后墙、进站口挡墙、站牌；另一侧：道床、挡土墙 + 绿栏杆、远处的楼和天空。
   */
  outside(k, atlas) {
    const P = k.solid, G = k.glow, LZ = z => z - GZE.tz, LX = x => x - EMU.xc, XA = -60, XB = 60;
    const e = LZ(GZE.edge), back = LZ(GZE.hz1 - 0.3), rz = LZ(-134.5);
    k.g('pave').slab(X(XA), X(XB), -1.25, 0, e, back, hex('#B9BCBF'), { ao: false });
    P.slab(X(XA), X(XB), 0.002, 0.01, e, e + 0.3, hex('#E8EAEA'), { ao: false });
    k.g('tactile').slab(X(XA), X(XB), 0.002, 0.014, e + 0.75, e + 1.05, hex('#F2C230'), { ao: false });
    for (let x = GZE.xw + 4; x < GZE.xe; x += 12) P.cyl(X(LX(x)), 3.3, LZ(-121.2), 0.5, 6.6, hex('#F2F3F3'), 12);
    P.slab(X(XA), X(XB), 6.6, 6.9, rz, back, hex('#E3E5E6'), { ao: false });
    for (const z of [-119, -124]) G.slab(X(XA), X(XB), 6.56, 6.6, LZ(z) - 0.2, LZ(z) + 0.2, hex('#FFF6E2'), { ao: false });
    P.slab(X(XA), X(XB), 0, 10.5, back, back + 0.3, hex('#E9E6E1'), { ao: false });
    P.slab(X(LX(-7.5)), X(LX(7.5)), 0, 6.6, LZ(BF.z - 0.3), LZ(BF.z), hex('#E9E6E1'), { ao: false });
    const plate = (zh, en) => (c, pw, ph) => { c.fillStyle = '#1F4E9C'; c.fillRect(0, 0, pw, ph); c.fillStyle = '#FFFFFF'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.font = `700 ${ph * 0.46}px sans-serif`; c.fillText(zh, pw / 2, ph * 0.4); c.font = `500 ${ph * 0.2}px sans-serif`; c.fillText(en, pw / 2, ph * 0.78); };
    for (const [x, zh, en] of [[6, '广州东', 'Guangzhoudong'], [-18, '5 站台', 'Platform 5']]) {
      atlas.sign(X(LX(x)), 3.2, LZ(-121.0) - 0.04, 3.4, 0.95, Math.PI, plate(zh, en));
      for (const sx of [-1, 1]) P.tube([X(LX(x) + sx * 1.2), 3.67, LZ(-121.0)], [X(LX(x) + sx * 1.2), 6.6, LZ(-121.0)], 0.03, hex('#9AA1A8'), 6);
    }
    atlas.sign(X(LX(0)), 3.3, LZ(BF.z - 0.3) - 0.012, 7.2, 1.5, Math.PI, plate('5 站台', 'Platform 5'));
    // 另一侧：道床、挡土墙 + 绿栏杆、远处的楼和天空
    const zw = LZ(GZE.zs);
    P.slab(X(XA), X(XB), -1.4, -1.3, zw, -1.75, hex('#8D867C'), { ao: false });
    for (let x = XA; x < XB; x += 0.65) P.box(X(x), -1.25, -4.5, 0.24, 0.1, 2.6, hex('#6E5B4A'), 0, 0, 0, 1, { ao: false });
    for (const s of [-1, 1]) P.slab(X(XA), X(XB), -1.2, -1.08, -4.5 + s * 0.717 - 0.04, -4.5 + s * 0.717 + 0.04, hex('#9EA4A9'), { ao: false });
    P.slab(X(XA), X(XB), -1.4, 2.2, zw - 0.5, zw, hex('#C9C5BC'), { ao: false });
    for (let x = XA; x < XB; x += 2.5) P.box(X(x), 2.8, zw - 0.25, 0.06, 1.2, 0.06, hex('#3E6B4E'), 0, 0, 0, 1, { ao: false });
    P.slab(X(XA), X(XB), 3.35, 3.42, zw - 0.3, zw - 0.2, hex('#3E6B4E'), { ao: false });
    // （远处的楼和天空改由 js/world/emuScenery.js 的远景板画，开车时跟着滚动）
  }
  /** 站台一侧开着的车门：塞拉门门扇（关门时从车身外侧滑到门洞里）+ 关门后的碰撞 */
  doorLeaf(k) {
    const g = new Geo(), d = EMU.doors[0];
    // 门扇（中间一扇小窗是真玻璃：关着门也看得到外面的站台往后退）
    const L = hex('#E3E6E8');
    g.slab(-0.5, 0.5, 0, 1.1, -0.02, 0.02, L, { ao: false }); g.slab(-0.5, 0.5, 1.7, 2.0, -0.02, 0.02, L, { ao: false });
    g.slab(-0.5, -0.2, 1.1, 1.7, -0.02, 0.02, L, { ao: false }); g.slab(0.2, 0.5, 1.1, 1.7, -0.02, 0.02, L, { ao: false });
    for (const [x0, x1, y0, y1] of [[-0.22, 0.22, 1.08, 1.12], [-0.22, 0.22, 1.68, 1.72], [-0.22, -0.18, 1.1, 1.7], [0.18, 0.22, 1.1, 1.7]]) g.slab(x0, x1, y0, y1, -0.03, 0.03, C.dark, { ao: false });
    g.slab(-0.52, 0.52, 1.96, 2.0, -0.03, 0.03, C.frame, { ao: false });
    this.leaf = g.toMesh('emuDoorLeaf', this.scene, this.M.paint, k.root); this.leaf.isPickable = false;
    const gp = new Geo(); gp.slab(-0.2, 0.2, 1.1, 1.7, -0.004, 0.004, hex('#DCEBF2'), { ao: false });
    this.pane = gp.toMesh('emuDoorPane', this.scene, this.M.glass, this.leaf); this.pane.isPickable = false; this.pane.alphaIndex = 10; this.pane.hasVertexAlpha = false;
    this.doorF = 0; this.setDoor(0);
    this.doorCol = k.col(X(d.lx), 1.1, W - 0.04, 1.1, 2.2, 0.3, { dynamic: true, name: 'emuDoorCol' }); this.doorCol.checkCollisions = false;
  }
  /** f：0 开着（门扇在车身外侧、往车尾滑开）… 1 关好（门扇嵌进门洞） */
  setDoor(f) {
    const d = EMU.doors[0], a = Math.min(1, f / 0.75), b = Math.max(0, (f - 0.75) / 0.25);
    this.doorF = f; this.leaf.position.set(X(d.lx - 1.0 * (1 - a)), 0, W + 0.06 - 0.09 * b);
    if (this.doorCol) this.doorCol.checkCollisions = f > 0.5;
  }
  /** 端门上方显示屏换成这一程的车次 / 区间 */
  setTrip(trip) {
    if (this.trip === trip) return; this.trip = trip;
    const uv = this.dispUV, A = this.atlas, S = A.S, x = Math.round(uv.u0 * S - 0.5), y = Math.round((1 - uv.v1) * S - 0.5), w = Math.round((uv.u1 - uv.u0) * S + 1), h = Math.round((uv.v1 - uv.v0) * S + 1);
    const c = A.ctx; c.save(); c.beginPath(); c.rect(x, y, w, h); c.clip(); c.translate(x, y); paintDisplay(trip)(c, w, h); c.restore(); A.tex.update(true);
  }
  setEnabled(v) { this.kit.root.setEnabled(v); this.anchor.setEnabled(v); if (!v) this.outGz.root.setEnabled(false); this.active = v; }
  /** 车窗外的广州东站站台：ox = 相对停稳位置的 x 偏移（开出去是负的，开进来是正的）；null = 不显示 */
  showGz(ox) { const r = this.outGz.root; if (ox === null) { r.setEnabled(false); return; } r.setEnabled(this.active); r.position.x = ox; }
  /** 出门：走到站台一侧开着的车门口 */
  wantsExit(p) { return this.doorF < 0.05 && p.z > 1.3 && p.y < 1 && EMU.doors.some(d => Math.abs(p.x - X(d.lx)) < 0.5); }
  doorAt(p) { return EMU.doors.find(d => Math.abs(p.x - X(d.lx)) < 0.7) || EMU.doors[0]; }
  seatNear(p) { let best = null, bd = 0.95; for (const s of this.seats) { if (!s.free || Math.abs(p.y - s.wy) > 1) continue; const d = Math.hypot(p.x - s.wx, p.z - s.wz); if (d < bd) { bd = d; best = s; } } return best; }
  info() { return { active: this.active, seats: this.seats.length, free: this.seats.filter(s => s.free).length }; }
}

const SPEEDS = [1, 4, 10];
export class EastCtl {
  constructor({ scene, M, player, hud, seats, Audio, events, getStation }) {
    Object.assign(this, { scene, M, player, hud, seats, Audio, events, getStation });
    this.interior = null; this.xmn = null; this.cur = null; this.side = 'gz'; this.ride = null; this.speed = 1;
    this.count = { enter: 0, exit: 0, rides: 0, arrived: [] };
    const orig = seats.hall; seats.hall = () => (this.interior && this.interior.active ? this.interior : orig ? orig() : null);
    // 「快进」按钮（只在开车时、人在车厢里时出现）
    const hudEl = document.getElementById('hud');
    if (hudEl && !document.getElementById('bFast')) hudEl.insertAdjacentHTML('beforeend', `<button id="bFast" class="btn big fast" hidden aria-label="快进"><span class="emo">⏩</span><span class="lbl">快进</span></button>`);
    this.fastBtn = document.getElementById('bFast');
    if (this.fastBtn) pressable(this.fastBtn, () => this.setSpeed(SPEEDS[(SPEEDS.indexOf(this.speed) + 1) % SPEEDS.length]));
  }
  setSpeed(v) { this.speed = v; if (this.fastBtn) { this.fastBtn.querySelector('.lbl').textContent = v === 1 ? '快进' : '×' + v; this.fastBtn.classList.toggle('on', v > 1); } this.Audio.blip && this.Audio.blip('tap'); }
  ensure() {
    if (!this.interior) this.interior = new EastInterior(this.scene, this.M);
    if (!this.xmn) this.xmn = new XmnPlatform(this.scene);
    return this.interior;
  }
  /** 车厢外现在停着哪个站台（side）：广州东 = 车厢里自带的那组；厦门北 = XmnPlatform 的 car 模式 */
  showStopped() {
    const I = this.interior;
    if (this.side === 'gz') { I.showGz(0); this.xmn.show(null); }
    else { I.showGz(null); this.xmn.show('car'); this.xmn.place(EO.x, 0); }
  }
  /** 从站台走进车门（广州东站：st 是当前车站；厦门北站：st 不变，人在 XO） */
  enter(st, door) {
    const I = this.ensure(); I.setEnabled(true); st.kit.root.setEnabled(false);
    I.setTrip(this.side === 'gz' ? RAIL.xm : RAIL.gz); I.setDoor(0); this.showStopped();
    this.player.spawn(X(door.lx), 0.05, 0.75, door.lx > 0 ? -Math.PI / 2 : Math.PI / 2);   // 进门转身就是客室
    this.cur = { st, loc: 'car' }; this.count.enter++;
    this.hud.toast(`复兴号 ${I.trip.train} · ${EMU.car} 车 二等座`, 2200); this.Audio.blip && this.Audio.blip('tap');
    this.events.emit('east', { enter: true });
  }
  exit() {
    const { st } = this.cur; if (this.player.seat) this.seats.stand();
    const d = this.interior.doorAt(this.player.position);
    if (this.ride) this.cancelRide();
    this.interior.setEnabled(false); this.count.exit++;
    if (this.side === 'xm') {   // 厦门北站：下车站在站台上（独立场景）
      this.xmn.show('solo'); this.cur.loc = 'xmn';
      this.player.spawn(XO.x + d.x, 0.05, GZE.edge + 0.9, 0);
      this.hud.toast('厦门北站 Xiamenbei', 2200);
      this.events.emit('east', { enter: false, at: 'xm' }); return;
    }
    this.xmn.show(null); this.cur = null;
    if (st === this.getStation()) { st.kit.root.setEnabled(true); this.player.spawn(d.x, 0.05, GZE.edge + 0.9, 0); }
    this.events.emit('east', { enter: false, at: 'gz' });
  }
  /** 厦门北站台上走进车门 */
  board(door) {
    const I = this.interior; this.xmn.show(null); I.setEnabled(true); I.setTrip(RAIL.gz); I.setDoor(0); this.showStopped();
    this.player.spawn(X(door.lx), 0.05, 0.75, -Math.PI / 2); this.cur.loc = 'car'; this.count.enter++;
    this.hud.toast(`复兴号 ${RAIL.gz.train} · ${EMU.car} 车 二等座`, 2200); this.Audio.blip && this.Audio.blip('tap');
    this.events.emit('east', { enter: true, at: 'xm' });
  }
  /* ---------- 开车 ---------- */
  startRide() {
    const dest = this.side === 'gz' ? 'xm' : 'gz', trip = RAIL[dest];
    this.interior.setTrip(trip);
    this.ride = { dest, trip, t: 0, s: 0, v: 0, rt: 0, phase: 'closing', seg: 0, route: routeFor(dest), braking: false, rem: 0, flags: {} };
    this.count.rides++; this.setSpeed(1); this.speed = 1;
    // 起步前远景：近景先空着（站台还在旁边），中远景是出发城市
    const r0 = this.ride.route[0], Sc = this.interior.scenery;
    Sc.far.fill(r0.far); Sc.mid.fill(r0.mid); Sc.near.fill('empty'); Sc.resetBridge();
    this.events.emit('emu', { phase: 'closing', dest });
  }
  cancelRide() { this.ride = null; this.interior.setDoor(0); this.Audio.trainSound({ speed: 0 }); this.events.emit('emu', { phase: 'cancel' }); }
  /** 当前路段（rt = 发车后行驶秒数）：每层取“最近一次指定”的内容 */
  segAt(rt) {
    const out = { far: 'city', mid: 'city', near: 'city', tunnel: false, bridge: false };
    for (const e of this.ride.route) { if (e.t > rt) break; for (const k of ['far', 'mid', 'near']) if (e[k]) out[k] = e[k]; out.tunnel = !!e.tunnel; out.bridge = !!e.bridge; }
    return out;
  }
  tick(dtWall) {
    const R = this.ride, I = this.interior, A = this.Audio, dt = dtWall * this.speed, F = R.flags;
    R.t += dt;
    // 关门前（广播刚响）又站起来：车门还开着就不发车，可以下车（坐回去 1.2 秒后重新开始）
    if (R.phase === 'closing' && !(this.player.seat && this.player.seat.seat)) { const f = I.doorF; this.cancelRide(); if (f > 0) { I.setDoor(f); this.doorOpenT = 1.25 * f; this._openSfx = false; } return; }
    if (!F.annDoors && R.t >= 0.6) { F.annDoors = true; Ann.say(PH.emuDoorsSegs(), { key: 'emu', interrupt: true }); }
    if (R.t >= 4.2) { if (!F.closeSfx) { F.closeSfx = true; A.sfx('doorClose'); } I.setDoor(Math.min(1, (R.t - 4.2) / 1.25)); }
    if (R.t < 6.5) return;
    if (!F.departed) { F.departed = true; R.phase = 'run'; A.sfx('train.tractionStart', { volume: 0.7 }); Ann.say(PH.emuDepartSegs(R.dest), { key: 'emu' }); this.events.emit('emu', { phase: 'depart', dest: R.dest }); }
    const rt = R.rt = R.t - 6.5;
    let v;
    if (!R.braking) {
      v = rt < 12 ? 0.8 * rt : Math.min(TRIP.vmax, 9.6 + 3 * (rt - 12));
      if (rt >= TRIP.brakeAt) { R.braking = true; R.rem = TRIP.brakeDist; R.vb = v; R.dec = v * v / (2 * TRIP.brakeDist); R.phase = 'brake'; this.events.emit('emu', { phase: 'brake' }); }
    }
    if (R.braking) { v = Math.max(0.6, Math.sqrt(2 * R.dec * Math.max(0, R.rem))); R.rem -= v * dt; }
    R.v = v; R.s += v * dt;
    const seg = this.segAt(rt), near = R.braking && R.rem < 170 ? 'empty' : seg.near;
    I.scenery.advance(v * dt, { far: seg.far, mid: seg.mid, near });
    // 出发站台往后滑走；目的地站台从前面滑进来
    const from = R.dest === 'xm' ? 'gz' : 'xm', gone = R.s > 420;
    if (from === 'gz') I.showGz(gone ? null : -R.s); else if (!gone) this.xmn.place(EO.x, -R.s); else if (!R.braking) this.xmn.show(null);
    if (R.braking && R.rem < 450) { const ox = Math.max(0, R.rem); if (R.dest === 'gz') I.showGz(ox); else { if (this.xmn.mode !== 'car') this.xmn.show('car'); this.xmn.place(EO.x, ox); } }
    // 路过的提示 / 广播
    if (seg.bridge && !F.bridge) { F.bridge = true; this.hud.toast('九龙江特大桥 · 九龙江入海口', 3000); Ann.say(PH.emuBridgeSegs(), { key: 'emu', interrupt: true }); }
    if (seg.tunnel !== R.inTunnel) { R.inTunnel = seg.tunnel; if (seg.tunnel) this.hud.toast('进隧道啦', 1400); }
    if (!F.annNext && rt >= TRIP.brakeAt - 14) { F.annNext = true; Ann.say(PH.emuNextSegs(R.dest), { key: 'emu', interrupt: true }); }
    A.trainSound({ speed: Math.min(1, v / TRIP.vmax * 0.78 + (R.inTunnel ? 0.22 : 0)), inside: true, braking: R.braking && v < 30 });
    if (R.braking && R.rem <= 0) this.arrive();
  }
  arrive() {
    const R = this.ride; this.ride = null; this.side = R.dest; this.setSpeed(1);
    this.Audio.trainSound({ speed: 0 }); this.Audio.sfx('train.airRelease', { volume: 0.6 });
    this.showStopped(); this.interior.scenery.near.fill('empty'); this.interior.scenery.resetBridge();
    this.doorOpenT = 1.25; this.count.arrived.push(R.dest);
    Ann.say(PH.emuArriveSegs(R.dest), { key: 'emu', interrupt: true });
    this.hud.toast(R.dest === 'xm' ? '到站：厦门北站' : '到站：广州东站', 2400);
    this.events.emit('emu', { phase: 'arrive', dest: R.dest }); this.events.emit('ride', { phase: 'arriveRail', to: R.dest });
  }
  update(dtWall = 0.016) {
    const st = this.getStation(), pl = this.player, p = pl.position;
    if (this.ride) this.tick(dtWall);
    if (this.doorOpenT > 0 && this.interior) { this.doorOpenT -= dtWall; if (this.doorOpenT < 1.25 && !this._openSfx) { this._openSfx = true; this.Audio.sfx('doorOpen'); } this.interior.setDoor(Math.max(0, this.doorOpenT / 1.25)); if (this.doorOpenT <= 0) this._openSfx = false; }
    if (this.fastBtn) { const show = !!(this.ride && this.ride.t > 4 && this.cur && this.cur.loc === 'car'); if (this.fastBtn.hidden === show) this.fastBtn.hidden = !show; }
    if (!this.cur) {
      if (this.interior && this.interior.active) this.interior.setEnabled(false);
      if (!st || !st.gze || pl.seat || p.y < -1 || p.y > 2 || p.x > 400) return null;
      if (this.side !== 'gz') return null;
      if (p.z < GZE.edge - 0.05) { const d = EMU.doors.find(d => Math.abs(p.x - d.x) < 0.55); if (d) this.enter(st, d); }
      return null;
    }
    if (st !== this.cur.st) { this.interior.setEnabled(false); this.xmn.show(null); this.ride = null; this.cur = null; return null; }
    if (this.cur.loc === 'car') {
      // 坐下（车停着、门开着）→ 关门开车
      if (!this.ride && pl.seat && pl.seat.seat && pl.seat.seat.world && this.interior.doorF < 0.01 && !(this.doorOpenT > 0)) { this.sitT = (this.sitT || 0) + dtWall; if (this.sitT > 1.2) { this.sitT = 0; this.startRide(); } } else this.sitT = 0;
      if (this.interior.wantsExit(p) && !pl.seat && !this.ride) this.exit();
    } else if (this.cur.loc === 'xmn') {
      if (!pl.seat && p.y > -1 && p.y < 2 && p.z < GZE.edge - 0.05) { const d = EMU.doors.find(d => Math.abs(p.x - (XO.x + d.x)) < 0.55); if (d) this.board(d); }
      if (p.y < -6) { pl.spawn(XO.x - 5.8, 0.05, GZE.edge + 1.5, 0); }
    }
    return null;
  }
  /** HUD 左上角：动车里 / 厦门北站台上显示车次和站名（不是地铁线路） */
  railHud() {
    if (!this.cur) return null;
    if (this.cur.loc === 'xmn') return { badge: '国铁', zh: '厦门北站', en: 'Xiamenbei', color: '#1F5F8B' };
    const R = this.ride, trip = R ? R.trip : this.interior.trip;
    if (R && R.phase !== 'closing') return { badge: trip.train, zh: '复兴号 ' + EMU.car + ' 车', en: `${trip.fromEn} → ${trip.toEn}`, color: '#D3121A', next: { zh: trip.to, en: trip.toEn } };
    return { badge: trip.train, zh: this.side === 'gz' ? '广州东站' : '厦门北站', en: this.side === 'gz' ? 'Guangzhoudong' : 'Xiamenbei', color: '#D3121A' };
  }
  get loc() { return this.cur ? this.cur.loc : null; }
  info() {
    const R = this.ride;
    return { inside: !!(this.cur && this.cur.loc === 'car'), loc: this.loc, side: this.side, speed: this.speed, door: this.interior ? +this.interior.doorF.toFixed(2) : 0,
      ride: R ? { dest: R.dest, phase: R.phase, t: +R.t.toFixed(1), rt: +R.rt.toFixed(1), v: +R.v.toFixed(1), s: Math.round(R.s), rem: Math.round(R.rem), seg: this.segAt(R.rt), tunnel: !!R.inTunnel } : null,
      xmn: this.xmn ? this.xmn.info() : null, interior: this.interior ? this.interior.info() : null, count: this.count };
  }
}
