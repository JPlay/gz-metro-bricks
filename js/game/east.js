/*
 * 广州东站 · 复兴号 5 号车厢（二等座，室内，独立场景）：从站台上开着的车门走进去才加载，出门就关掉。
 *   - 放在 EO = (2200, 0, 0)（x > 400 → zone 'hall'：街面 / 站内都关掉，没有车站广播）；车厢沿 x，车头方向 = +x；
 *     车里 local x = 站台上的世界 x − EMU.xc（两扇门 local ±11.2 和站台上的门对得上），+z 一侧是站台；
 *   - 客室 local x −9.6..9.6：每排 2+3 座（蓝灰色座椅、白色头枕套，都朝车头），中间过道；18 排；
 *   - 两边大车窗（站台一侧看得到站台和雨棚，另一侧是轨道、围墙和天空），行李架，顶灯；
 *   - 两头端墙中间是开着的玻璃门，门上方一块显示屏（车次 / 区间 / 车厢号）；
 *   - 门厅（local ±9.6..12.5）：站台一侧的车门开着，走到门口（z > 1.3）就下车，站在站台上。
 *   - 列车一直停着，不开走；没有任务 / 引导条。
 */
import { Kit } from '../world/kit.js';
import { hex } from '../core/geo.js';
import { FoodAtlas } from './food-art.js';
import { bakePerson, randomLook, POSES } from '../world/people.js';
import { EMU, GZE, BF } from '../world/gze.js';

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
/** 车窗外另一侧远处：天空 + 一排楼（挡土墙后面），底边是地面 */
function paintBackdrop(c, pw, ph) {
  const g = c.createLinearGradient(0, 0, 0, ph * 0.8); g.addColorStop(0, '#7FB6E3'); g.addColorStop(1, '#D6EAF6'); c.fillStyle = g; c.fillRect(0, 0, pw, ph * 0.8);
  c.fillStyle = 'rgba(255,255,255,0.9)'; for (const [fx, fy, r] of [[0.12, 0.2, 0.05], [0.16, 0.18, 0.04], [0.55, 0.25, 0.06], [0.6, 0.22, 0.04], [0.85, 0.15, 0.05]]) { c.beginPath(); c.arc(pw * fx, ph * fy, ph * r, 0, 6.3); c.fill(); }
  const cols = ['#D9DEE4', '#E6DCCF', '#CBD5DF', '#E9E4DA', '#D3DCD3'];
  for (let i = 0, x = -10; x < pw; i++) { const w = 22 + ((i * 37) % 30), h = ph * (0.18 + ((i * 29) % 30) / 100); c.fillStyle = cols[i % 5]; c.fillRect(x, ph * 0.8 - h, w, h + 1);
    c.fillStyle = 'rgba(90,110,130,0.35)'; for (let y = ph * 0.8 - h + 3; y < ph * 0.78; y += 5) for (let xx = x + 3; xx < x + w - 3; xx += 5) c.fillRect(xx, y, 2.5, 2.5); x += w + 4; }
  c.fillStyle = '#9DA59A'; c.fillRect(0, ph * 0.8, pw, ph * 0.2);
}
/** 端门上方的显示屏（黑底红色点阵字） */
function paintDisplay(c, pw, ph) {
  c.fillStyle = '#07080A'; c.fillRect(0, 0, pw, ph); c.textBaseline = 'middle';
  c.fillStyle = '#FF4A2E'; c.font = `700 ${ph * 0.42}px sans-serif`;
  c.textAlign = 'left'; c.fillText(EMU.train, pw * 0.03, ph * 0.52);
  c.textAlign = 'center'; c.fillText('广州东→' + EMU.to, pw * 0.47, ph * 0.52);
  c.textAlign = 'right'; c.fillStyle = '#FFB13D'; c.fillText(EMU.car + '车 二等座', pw * 0.97, ph * 0.52);
}
export class EastInterior {
  constructor(scene, M) {
    this.scene = scene; this.M = M; this.seats = [];
    const k = this.kit = new Kit(scene, 'emu-int'), atlas = this.atlas = new FoodAtlas(scene, 1024);
    this.build(k, atlas);
    k.finish(); atlas.finish(k.root, 'emuSigns');
    this.kit.root.setEnabled(false); this.active = false;
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
    const winY0 = 0.82, winY1 = 1.72;
    for (const s of [-1, 1]) {
      const zw = s * W, zi = s * (W - 0.06);
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
      k.g('glass').slab(X(-SX), X(SX), winY0, winY1, s * (W - 0.035) - 0.004, s * (W - 0.035) + 0.004, hex('#DCEBF2'));   // 车窗玻璃
      P.slab(X(-SX), X(SX), winY0 - 0.05, winY0, Math.min(zi, s * (W - 0.2)), Math.max(zi, s * (W - 0.2)), C.frame, { ao: false });   // 窗台
      if (s < 0) k.colSlab(X(-EX), X(EX), 0, HC, -W - 0.4, -W + 0.06);
      else {   // 站台一侧：两扇开着的车门处留口（门口外面再挡一下，走到门口就下车）
        const hs = EMU.doors.map(d => d.lx).sort((a, b) => a - b); let a0 = -EX;
        for (const lx of hs) { k.colSlab(X(a0), X(lx - 0.5), 0, HC, W - 0.06, W + 0.4); a0 = lx + 0.5; }
        k.colSlab(X(a0), X(EX), 0, HC, W - 0.06, W + 0.4);
        for (const d of EMU.doors) k.colSlab(X(d.lx - 0.6), X(d.lx + 0.6), 0, HC, W + 0.15, W + 0.6);
      }
      // 窗间柱：每 2 排一扇大窗
      for (let x = -SX; x <= SX + 0.01; x += 2.0) P.slab(X(x - 0.14), X(x + 0.14), winY0, winY1, Math.min(zw, zi - s * 0.02), Math.max(zw, zi - s * 0.02), C.wall, { ao: false });
      for (const y of [winY0, winY1]) P.slab(X(-SX), X(SX), y - 0.025, y + 0.025, Math.min(zi, zi - s * 0.03), Math.max(zi, zi - s * 0.03), C.frame, { ao: false });
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
          const seat = { wx: X(xb + 0.3), wy: 0, wz: zc, face: Math.PI / 2, eye: 1.42, free: true, world: true, id: this.seats.length, row: r + 1, letter: 'ABCDF'[(z0 < 0 ? 0 : 3) + i], stand: { x: X(xb + 0.42), z: AISLE_Z } };
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
      const uv = atlas.draw(2.0, 0.26, paintDisplay, 300);
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
        P.slab(X(xd - 0.5), X(xd + 0.5), 0, 2.0, W - 0.065, W - 0.055, hex('#E3E6E8'), { ao: false });
        P.slab(X(xd - 0.2), X(xd + 0.2), 1.1, 1.7, W - 0.07, W - 0.066, C.dark, { ao: false });
        P.slab(X(xd - 0.005), X(xd + 0.005), 0, 2.0, W - 0.075, W - 0.07, C.frame, { ao: false });
      }
      // 另一侧：关着的车门
      P.slab(X(xd - 0.5), X(xd + 0.5), 0, 2.0, -W + 0.055, -W + 0.065, hex('#E3E6E8'), { ao: false });
      P.slab(X(xd - 0.2), X(xd + 0.2), 1.1, 1.7, -W + 0.066, -W + 0.07, C.dark, { ao: false });
      P.slab(X(xd - 0.005), X(xd + 0.005), 0, 2.0, -W + 0.07, -W + 0.075, C.frame, { ao: false });
      atlas.sign(X(xd + e * 1.0), 1.75, -W + 0.08, 0.8, 0.3, 0, (c, pw, ph) => { c.fillStyle = '#1F6B4A'; c.fillRect(0, 0, pw, ph); c.fillStyle = '#FFFFFF'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.font = `700 ${ph * 0.45}px sans-serif`; c.fillText('车门 Door', pw / 2, ph / 2); });
    }
    this.outside(k, atlas);
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
    atlas.quad(X(0), 12, -45, 200, 34, 0, atlas.draw(200, 34, paintBackdrop, 110));
  }
  setEnabled(v) { this.kit.root.setEnabled(v); this.active = v; }
  /** 出门：走到站台一侧开着的车门口 */
  wantsExit(p) { return p.z > 1.3 && p.y < 1 && EMU.doors.some(d => Math.abs(p.x - X(d.lx)) < 0.5); }
  doorAt(p) { return EMU.doors.find(d => Math.abs(p.x - X(d.lx)) < 0.7) || EMU.doors[0]; }
  seatNear(p) { let best = null, bd = 0.95; for (const s of this.seats) { if (!s.free || Math.abs(p.y - s.wy) > 1) continue; const d = Math.hypot(p.x - s.wx, p.z - s.wz); if (d < bd) { bd = d; best = s; } } return best; }
  info() { return { active: this.active, seats: this.seats.length, free: this.seats.filter(s => s.free).length }; }
}

export class EastCtl {
  constructor({ scene, M, player, hud, seats, Audio, events, getStation }) {
    Object.assign(this, { scene, M, player, hud, seats, Audio, events, getStation });
    this.interior = null; this.cur = null; this.count = { enter: 0, exit: 0 };
    const orig = seats.hall; seats.hall = () => (this.interior && this.interior.active ? this.interior : orig ? orig() : null);
  }
  enter(st, door) {
    if (!this.interior) this.interior = new EastInterior(this.scene, this.M);
    const I = this.interior; I.setEnabled(true); st.kit.root.setEnabled(false);
    this.player.spawn(X(door.lx), 0.05, 0.75, door.lx > 0 ? -Math.PI / 2 : Math.PI / 2);   // 进门转身就是客室
    this.cur = { st }; this.count.enter++;
    this.hud.toast(`复兴号 ${EMU.train} · ${EMU.car} 车 二等座`, 2200); this.Audio.blip && this.Audio.blip('tap');
    this.events.emit('east', { enter: true });
  }
  exit() {
    const { st } = this.cur; if (this.player.seat) this.seats.stand();
    const d = this.interior.doorAt(this.player.position);
    this.interior.setEnabled(false); this.cur = null; this.count.exit++;
    if (st === this.getStation()) { st.kit.root.setEnabled(true); this.player.spawn(d.x, 0.05, GZE.edge + 0.9, 0); }
    this.events.emit('east', { enter: false });
  }
  update() {
    const st = this.getStation(), pl = this.player, p = pl.position;
    if (!this.cur) {
      if (this.interior && this.interior.active) this.interior.setEnabled(false);
      if (!st || !st.gze || pl.seat || p.y < -1 || p.y > 2 || p.x > 400) return null;
      if (p.z < GZE.edge - 0.05) { const d = EMU.doors.find(d => Math.abs(p.x - d.x) < 0.55); if (d) this.enter(st, d); }
      return null;
    }
    if (st !== this.cur.st) { this.interior.setEnabled(false); this.cur = null; return null; }
    if (this.interior.wantsExit(p) && !pl.seat) this.exit();
    return null;
  }
  info() { return { inside: !!this.cur, interior: this.interior ? this.interior.info() : null, count: this.count }; }
}
