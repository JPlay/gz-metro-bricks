/*
 * 厦门地铁站台（第三阶段）：闽南红砖 + 燕尾脊/人字梁天花意象 + 海蓝点缀，和广州地铁站一眼能分清。
 * 建在 XO（与国铁厦门北站同一块区域）；换站时整站重建（和广州一样，隧道里换）。
 * 主题（js/data/xm-lines.js theme）：
 *   minnan  — 默认，红砖墙裙 + 木色椽子（1 号线「闽南筑韵」）
 *   transfer— 吕厝，双线站台，换乘色带
 *   rock    — 古地石，灰岩色墙面（2 号线特色镜头）
 *   sail    — 五缘湾 / 邮轮中心，「扬帆」海蓝天花
 *   sea     — 海沧湾公园 / 湿地公园，青绿海波
 *   jiageng — 集美学村，嘉庚红墙白石
 * 坐标：root 在 XO；站台沿 x，轨行区 z = zc ± TRACK；侧式站（xmnb/zhl）只有一侧站台。
 */
import { Kit, FONT, FONT_EN } from './kit.js';
import { hex, mix } from '../core/geo.js';
import { FoodAtlas } from '../game/food-art.js';
import { XM_LINES, XM_STATIONS, xmNext, xmDirFor } from '../data/xm-lines.js';
import { XO } from './xmn.js';
import { noProbe } from './xmnStation.js';

const B = window.BABYLON;
export const XM_PY = -13;          // 1 号线站台面
export const XM_PY2 = -22;         // 2 号线站台面（吕厝更深一层）
export const XM_TRACK = 7.6;
export const XM_PSD = 6;
export const XM_WALL = 10.6;
export const XM_HALL_X = 36;
export const XM_TUNNEL_X = 90;
import { DOOR_XS as TRAIN_DOORS } from './train.js';

const THEME = {
  minnan: { wall: '#F1EEE8', dado: '#B5452F', beam: '#9A6A43', accent: '#2C6E9E', floor: '#D8D3CA' },
  transfer: { wall: '#F4F2EE', dado: '#B5452F', beam: '#8B6914', accent: '#00A651', floor: '#DAD6CE' },
  rock: { wall: '#C8C2B8', dado: '#5C574F', beam: '#3E3B36', accent: '#8A857C', floor: '#B9B3A8' },
  sail: { wall: '#E8F2F7', dado: '#2C7DB0', beam: '#1F5F8B', accent: '#F2711C', floor: '#DCE6EC' },
  sea: { wall: '#E4F0EC', dado: '#1F8A6E', beam: '#0E6B55', accent: '#00A651', floor: '#D5E6DF' },
  jiageng: { wall: '#F5F0E8', dado: '#A8432E', beam: '#E9E4DA', accent: '#1F5F8B', floor: '#E2DCD2' }
};

function namePaint(zh, en, lc, ink) {
  return (c, pw, ph) => {
    c.fillStyle = '#1B2530'; c.fillRect(0, 0, pw, ph);
    c.fillStyle = lc; c.fillRect(0, 0, ph * 0.55, ph);
    c.fillStyle = ink; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.font = `800 ${ph * 0.42}px ${FONT_EN}`; c.fillText(String(arguments[4] || ''), ph * 0.275, ph * 0.52);
    c.fillStyle = '#FFFFFF'; c.textAlign = 'left'; c.font = `800 ${ph * 0.38}px ${FONT}`; c.fillText(zh, ph * 0.7, ph * 0.38);
    c.font = `600 ${ph * 0.18}px ${FONT_EN}`; c.fillText(en, ph * 0.7, ph * 0.72);
  };
}

export class XmStation {
  constructor(scene, code) {
    this.scene = scene; this.code = code;
    this.s = XM_STATIONS[code];
    this.themeKey = this.s.theme || 'minnan';
    this.th = THEME[this.themeKey] || THEME.minnan;
    const k = this.kit = new Kit(scene, 'xmSt-' + code);
    k.root.position.set(XO.x, 0, 0);
    this.atlas = new FoodAtlas(scene, 2048);
    this.platforms = this.frames().map(f => ({ ...f, sides: this.sidesFor(f) }));
    this.platforms.forEach(p => this.buildPlatform(p));
    if (this.platforms.length > 1) this.buildTransfer();
    if (code === 'xmnb') this.linkRailway();
    else this.buildConcourse();
    k.finish(true); this.atlas.finish(k.root, 'xmStSigns'); noProbe(k.root);
  }
  frames() {
    const lines = this.s.lines;
    if (lines.length > 1) return [
      { line: 1, y: XM_PY, zc: 0 },
      { line: 2, y: XM_PY2, zc: 28 }
    ];
    // 厦门北站：侧式站台对准国铁出站层地铁站厅（z≈-80），轨在 -z（往站房外）
    if (this.code === 'xmnb') return [{ line: 1, y: XM_PY, zc: -80, sideOnly: 'A' }];  // 侧式：轨在 -z，站台朝站厅 +z
    if (this.s.side) return [{ line: lines[0], y: XM_PY, zc: 0, sideOnly: true }];
    return [{ line: lines[0], y: XM_PY, zc: 0 }];
  }
  sidesFor(P) {
    const L = XM_LINES[P.line], dirs = Object.values(L.dirs);
    // A = -z 侧（step 取 dirs[0]），B = +z 侧
    const mk = (key, step, n) => ({
      key, step, n, trackZ: P.zc + (key === 'A' ? -1 : 1) * XM_TRACK,
      psdZ: P.zc + (key === 'A' ? -1 : 1) * XM_PSD, doorSg: key === 'A' ? -1 : 1
    });
    if (P.sideOnly) {
      const key = P.sideOnly === 'A' ? 'A' : 'B';
      const step = key === 'A' ? dirs[0].step : dirs[1].step;
      return { [key]: mk(key, step, 1) };
    }
    return { A: mk('A', dirs[0].step, 1), B: mk('B', dirs[1].step, 2) };
  }
  buildPlatform(P) {
    const k = this.kit, y = P.y, zc = P.zc, L = XM_LINES[P.line], lc = L.color, th = this.th;
    const Pv = k.solid, W = k.g('wall'), BR = k.g('brick'), F = k.g('floor'), G = k.glow, M = k.metal;
    const sideOnly = P.sideOnly;
    let z0 = zc - XM_PSD, z1 = zc + XM_PSD;
    if (sideOnly === 'B') { z0 = zc - 0.4; z1 = zc + XM_PSD; }
    else if (sideOnly === 'A') { z0 = zc - XM_PSD; z1 = zc + 0.4; }
    else if (sideOnly) { z0 = zc - 0.5; z1 = zc + XM_PSD; }
    k.floorWithHoles(-XM_HALL_X, XM_HALL_X, z0, z1, y - 1.3, y, hex(th.floor), [], true, 'floor');
    // 盲道 + 石材收边
    for (const sz of (sideOnly === 'A' ? [-1] : sideOnly === 'B' ? [1] : sideOnly ? [1] : [-1, 1])) {
      k.g('tactile').slab(-XM_HALL_X, XM_HALL_X, y, y + 0.006, zc + sz * 5.2 - 0.2, zc + sz * 5.2 + 0.2, hex('#F2C230'), { ao: false });
      Pv.slab(-XM_HALL_X, XM_HALL_X, y, y + 0.004, zc + sz * 5.7 - 0.15, zc + sz * 5.7 + 0.15, hex('#9AA0A6'), { ao: false });
    }
    // 轨行区
    for (const sz of (sideOnly ? [-1] : [-1, 1])) {
      const tz = zc + sz * XM_TRACK, C = k.g('concrete');
      C.slab(-XM_TUNNEL_X, XM_TUNNEL_X, y - 1.75, y - 1.38, tz - 2.3, tz + 2.3, hex('#B8B6B0'), { ao: false });
      for (const rz of [-0.72, 0.72]) M.slab(-XM_TUNNEL_X, XM_TUNNEL_X, y - 1.32, y - 1.2, tz + rz - 0.035, tz + rz + 0.035, hex('#9EA4AA'), { ao: false });
      for (let x = -XM_HALL_X; x < XM_HALL_X; x += 0.9) C.slab(x, x + 0.26, y - 1.38, y - 1.32, tz - 1.15, tz + 1.15, hex('#9C9A94'), { ao: false });
      Pv.tube([-XM_TUNNEL_X, y + 3.75, tz], [XM_TUNNEL_X, y + 3.75, tz], 0.03, hex('#6B4A2E'), 5);
      const wz = zc + sz * XM_WALL;
      W.slab(-XM_HALL_X, XM_HALL_X, y - 1.75, y + 4.8, wz - (sz > 0 ? 0 : 0.3), wz + (sz > 0 ? 0.3 : 0), hex(th.wall), { aoTop: true });
      k.colSlab(-XM_HALL_X, XM_HALL_X, y - 1.75, y + 4.8, wz - 0.15, wz + 0.15);
      // 红砖 / 岩石墙裙 + 线路色腰线
      BR.slab(-XM_HALL_X, XM_HALL_X, y - 1.75, y + 1.4, wz - sz * 0.02, wz + sz * 0.02, hex(th.dado), { ao: false });
      Pv.slab(-XM_HALL_X, XM_HALL_X, y + 1.4, y + 1.55, wz - sz * 0.03, wz + sz * 0.03, hex(th.beam), { ao: false });
      Pv.slab(-XM_HALL_X, XM_HALL_X, y + 0.15, y + 0.5, wz - sz * 0.04, wz, hex(lc), { ao: false });
      if (this.themeKey === 'rock') {
        k.g('granite').slab(-XM_HALL_X, XM_HALL_X, y + 1.55, y + 4.5, wz - sz * 0.015, wz + sz * 0.015, hex('#A39E94'), { ao: false });
        for (let x = -XM_HALL_X + 3; x < XM_HALL_X; x += 6) Pv.slab(x - 0.15, x + 0.15, y + 1.55, y + 4.5, wz - sz * 0.04, wz, hex('#6E6A63'), { ao: false });
      }
      // 站名牌
      const stIdx = L.stations.indexOf(this.code);
      const prevC = L.stations[stIdx - 1], nextC = L.stations[stIdx + 1];
      for (let x = -24; x <= 24; x += 32) {
        const paint = (c, pw, ph) => {
          c.fillStyle = '#1B2530'; c.fillRect(0, 0, pw, ph);
          c.fillStyle = lc; c.fillRect(8, 8, ph * 0.7, ph - 16);
          c.fillStyle = L.ink; c.textAlign = 'center'; c.textBaseline = 'middle';
          c.font = `800 ${ph * 0.48}px ${FONT_EN}`; c.fillText(String(L.id), 8 + ph * 0.35, ph * 0.52);
          c.fillStyle = '#FFF'; c.textAlign = 'left'; c.font = `800 ${ph * 0.36}px ${FONT}`; c.fillText(this.s.zh, ph * 0.95, ph * 0.36);
          c.font = `600 ${ph * 0.16}px ${FONT_EN}`; c.fillText(this.s.en, ph * 0.95, ph * 0.7);
          if (prevC || nextC) {
            c.fillStyle = '#9AA3AD'; c.font = `600 ${ph * 0.12}px ${FONT}`;
            if (prevC) c.fillText('← ' + XM_STATIONS[prevC].zh, ph * 0.95, ph * 0.88);
            if (nextC) { c.textAlign = 'right'; c.fillText(XM_STATIONS[nextC].zh + ' →', pw - 16, ph * 0.88); }
          }
        };
        this.atlas.quad(x, y + 2.2, wz - sz * 0.05, 7.2, 1.5, sz > 0 ? Math.PI : 0, this.atlas.draw(7.2, 1.5, paint));
        Pv.box(x, y + 2.2, wz - sz * 0.08, 7.4, 1.65, 0.06, hex('#1B2530'), 0, 0, 0, 1, { ao: false });
      }
      // 隧道两端
      for (const e of [-1, 1]) {
        const xa = e * XM_HALL_X, xb = e * XM_TUNNEL_X, x0 = Math.min(xa, xb), x1 = Math.max(xa, xb);
        C.slab(x0, x1, y - 1.75, y + 3.6, tz - 2.6, tz + 2.6, hex('#A8A6A0'), { ao: false });
        Pv.slab(xb - e * 0.3, xb, y - 1.75, y + 4.6, tz - 2.6, tz + 2.6, hex('#15181D'), { ao: false });
      }
    }
    // 天花：木椽 / 帆影 / 岩石肋
    this.ceil(P);
    // 屏蔽门
    for (const side of Object.values(P.sides)) this.psdBuild(P, side);
    // 吊牌：方向
    for (const side of Object.values(P.sides)) {
      const dir = Object.values(L.dirs).find(d => d.step === side.step);
      const z = zc + (side.key === 'A' ? -2.5 : 2.5);
      const paint = (c, pw, ph) => {
        c.fillStyle = '#1B2530'; c.fillRect(0, 0, pw, ph);
        c.fillStyle = lc; c.fillRect(0, 0, ph * 0.7, ph);
        c.fillStyle = L.ink; c.textAlign = 'center'; c.textBaseline = 'middle';
        c.font = `800 ${ph * 0.5}px ${FONT_EN}`; c.fillText(String(L.id), ph * 0.35, ph * 0.52);
        c.fillStyle = '#FFF'; c.textAlign = 'left'; c.font = `700 ${ph * 0.34}px ${FONT}`; c.fillText('往 ' + dir.zh, ph * 0.85, ph * 0.38);
        c.font = `500 ${ph * 0.16}px ${FONT_EN}`; c.fillText('to ' + dir.en, ph * 0.85, ph * 0.72);
      };
      this.atlas.quad(0, y + 3.5, z, 5.5, 0.9, side.key === 'A' ? 0 : Math.PI, this.atlas.draw(5.5, 0.9, paint));
      for (const sx of [-1.8, 1.8]) M.tube([sx, y + 3.95, z], [sx, y + 4.15, z], 0.03, hex('#9AA1A8'), 6);
    }
  }
  ceil(P) {
    const k = this.kit, y = P.y, zc = P.zc, th = this.th, CY = y + 4.2, Pv = k.solid, G = k.glow;
    const z0 = P.sideOnly ? zc - 0.5 : zc - XM_PSD, z1 = zc + XM_PSD;
    k.g('ceiling').slab(-XM_HALL_X, XM_HALL_X, CY, CY + 0.25, z0, z1, hex('#F4F2EE'), { ao: false });
    if (this.themeKey === 'sail' || this.themeKey === 'sea') {
      // 波浪 / 帆：海蓝弧板
      for (let i = 0; i < 9; i++) {
        const t = (i + 0.5) / 9 * 2 - 1, x = t * 36, yy = CY - 0.15 + 0.35 * Math.cos(t * Math.PI);
        Pv.box(x, yy, zc, 8.2, 0.12, (z1 - z0) * 0.9, hex(th.accent), 0, 0, t * 0.08, 1, { ao: false });
      }
      G.slab(-XM_HALL_X + 2, XM_HALL_X - 2, CY - 0.05, CY, zc - 0.3, zc + 0.3, hex('#FFF8EC'), { ao: false });
    } else if (this.themeKey === 'rock') {
      for (let x = -XM_HALL_X + 2; x < XM_HALL_X; x += 3.2) Pv.slab(x - 0.2, x + 0.2, CY - 0.5, CY, z0, z1, hex(th.beam), { ao: false });
    } else {
      // 人字梁 / 木椽（闽南古厝意象）
      for (let x = -XM_HALL_X + 2; x < XM_HALL_X; x += 3.6) Pv.slab(x - 0.09, x + 0.09, CY - 0.35, CY, z0, z1, hex(th.beam), { ao: false });
      for (const z of [-3, 0, 3]) G.slab(-XM_HALL_X + 1, XM_HALL_X - 1, CY - 0.4, CY - 0.36, zc + z - 0.2, zc + z + 0.2, hex('#FFF8EC'), { ao: false });
    }
  }
  psdBuild(P, side) {
    const k = this.kit, y = P.y, z = side.psdZ, sgn = side.key === 'A' ? -1 : 1, lc = XM_LINES[P.line].color, Pv = k.solid;
    const doors = TRAIN_DOORS;
    let x = -XM_HALL_X;
    const ops = doors.map(d => [d - 0.8, d + 0.8]);
    const seg = (a, b) => {
      if (b - a < 0.05) return;
      k.glass.slab(a, b, y + 0.1, y + 2.3, z - 0.012, z + 0.012, hex('#D6EEF8'));
      for (let m = a; m <= b + 0.01; m += Math.max(1.2, (b - a) / Math.max(1, Math.round((b - a) / 2.4))))
        k.metal.slab(m - 0.04, m + 0.04, y, y + 2.3, z - 0.06, z + 0.06, hex('#B9C0C8'), { ao: false });
      k.colSlab(a, b, y, y + 3.2, z - 0.08, z + 0.08);
    };
    for (const [a, b] of ops) { seg(x, a); x = b; } seg(x, XM_HALL_X);
    k.metal.slab(-XM_HALL_X, XM_HALL_X, y, y + 0.1, z - 0.07, z + 0.07, hex('#B9C0C8'), { ao: false });
    Pv.slab(-XM_HALL_X, XM_HALL_X, y + 2.3, y + 2.82, z - 0.12, z + 0.12, hex('#2A2D31'), { ao: false });
    Pv.slab(-XM_HALL_X, XM_HALL_X, y + 2.55, y + 2.72, z - 0.13, z + 0.13, hex(lc), { ao: false });
    k.colSlab(-XM_HALL_X, XM_HALL_X, y + 2.0, y + 4.2, z - 0.12, z + 0.12);
    // PSD 滑动门（开合由 setPSD 控制透明度/碰撞简化：用整段碰撞，开门时关掉门洞碰撞）
    side.psd = { open: 0, cols: [] };
    for (const d of doors) {
      const leaf = k.glass.slab(d - 0.7, d + 0.7, y + 0.1, y + 2.3, z - 0.02, z + 0.02, hex('#C5E4F2'));
      const col = k.colSlab(d - 0.7, d + 0.7, y, y + 2.3, z - 0.08, z + 0.08);
      side.psd.cols.push(col);
    }
  }
  setPSD(side, f) {
    if (!side.psd) return;
    side.psd.open = f;
    const closed = f < 0.7;
    for (const c of side.psd.cols) c.checkCollisions = closed;
  }
  /** 吕厝：两层之间的换乘楼梯 + 导向 */
  buildTransfer() {
    const k = this.kit, Pv = k.solid;
    // 楼梯从 L1 (y=-13,z=0) 到 L2 (y=-22,z=28)；中间休息平台
    k.floorWithHoles(-10, 10, 8, 16, XM_PY - 4.3, XM_PY - 4, hex('#D8D3CA'), [], true, 'floor');
    k.stairs('z', 4, XM_PY, 10, XM_PY - 4, -8, 8, XM_PY - 4, '#D6D1C7');
    k.stairs('z', 14, XM_PY - 4, 22, XM_PY2, -8, 8, XM_PY2, '#D6D1C7');
    const paint = (c, pw, ph) => {
      c.fillStyle = '#1B2530'; c.fillRect(0, 0, pw, ph);
      c.fillStyle = '#F2711C'; c.fillRect(8, 8, ph * 0.55, ph - 16);
      c.fillStyle = '#FFF'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.font = `800 ${ph * 0.4}px ${FONT_EN}`; c.fillText('1', 8 + ph * 0.275, ph * 0.4);
      c.fillStyle = '#00A651'; c.fillRect(8, ph * 0.55, ph * 0.55, ph * 0.35);
      c.fillStyle = '#FFF'; c.font = `800 ${ph * 0.28}px ${FONT_EN}`; c.fillText('2', 8 + ph * 0.275, ph * 0.72);
      c.textAlign = 'left'; c.font = `700 ${ph * 0.28}px ${FONT}`; c.fillText('换乘 Transfer', ph * 0.8, ph * 0.5);
    };
    this.atlas.quad(0, XM_PY + 3.4, 6, 5, 1.0, Math.PI, this.atlas.draw(5, 1.0, paint));
    this.atlas.quad(0, XM_PY2 + 3.4, 24, 5, 1.0, 0, this.atlas.draw(5, 1.0, paint));
  }
  /** 普通站：小站厅 + 出入口（游戏里出到黑处即可） */
  buildConcourse() {
    const k = this.kit, y = XM_PY + 6.5, Pv = k.solid, th = this.th;
    k.floorWithHoles(-20, 20, -18, -8, y - 0.3, y, hex(th.floor), [], true, 'floor');
    k.stairs('z', -8, XM_PY, -14, y, -6, 6, XM_PY, '#D6D1C7');
    Pv.slab(-20, 20, y, y + 3.5, -18.4, -18, hex(th.wall));
    Pv.slab(-20.4, -20, y, y + 3.5, -18, -8, hex(th.wall)); Pv.slab(20, 20.4, y, y + 3.5, -18, -8, hex(th.wall));
    k.g('brick').slab(-20, 20, y, y + 1.4, -18.35, -18.05, hex(th.dado), { ao: false });
  }
  /** 厦门北站：接到国铁出站层已有的地铁站厅楼梯口（xmnStation 里楼梯下到约 -12） */
  linkRailway() {
    const k = this.kit, y = XM_PY, Pv = k.solid;
    // 站台在 zc=-80；楼梯口在 x -108..-100、z -86..-74：补齐站台侧踏步到站台面
    // 站厅楼梯口（x -108..-100）落到站台：补站台一侧的踏步和栏杆
    k.stairs('x', -100, -6.5, -108, y, -86, -74, y, '#D6D1C7');
    k.rail(-108, -86.1, -100, -86.1, y); k.rail(-108, -73.9, -100, -73.9, y);
    // 回站厅的方向牌
    const paint = (c, pw, ph) => {
      c.fillStyle = '#1B2530'; c.fillRect(0, 0, pw, ph);
      c.fillStyle = '#1E8E4E'; c.fillRect(8, 8, ph - 16, ph - 16);
      c.fillStyle = '#FFF'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.font = `800 ${ph * 0.28}px ${FONT}`; c.fillText('出', 8 + (ph - 16) / 2, ph * 0.5);
      c.textAlign = 'left'; c.font = `700 ${ph * 0.3}px ${FONT}`; c.fillText('国铁出站 / 换乘', ph * 0.95, ph * 0.38);
      c.font = `500 ${ph * 0.14}px ${FONT_EN}`; c.fillText('Railway exit / Transfer', ph * 0.95, ph * 0.7);
    };
    this.atlas.quad(-96, y + 3.3, -80, 5.5, 0.9, Math.PI / 2, this.atlas.draw(5.5, 0.9, paint));
  }
  zoneOf(p) {
    const lx = p.x - XO.x;
    for (const P of this.platforms) {
      if (Math.abs(p.y - P.y) < 2.2 && Math.abs(lx) < XM_HALL_X && Math.abs(p.z - P.zc) < XM_WALL)
        return { kind: 'platform', P, code: this.code, net: 'xm' };
    }
    if (p.y > XM_PY + 4 && p.y < XM_PY + 9 && Math.abs(lx) < 22) return { kind: 'concourse', code: this.code, net: 'xm' };
    return { kind: 'xm', code: this.code, net: 'xm' };
  }
  platformFor(line) { return this.platforms.find(p => p.line === line); }
  dispose() {
    if (this.atlas) this.atlas.dispose();
    this.kit.root.getChildMeshes(false).forEach(m => m.dispose());
    this.kit.root.dispose();
  }
  info() { return { code: this.code, theme: this.themeKey, platforms: this.platforms.map(p => ({ line: p.line, y: p.y, zc: p.zc, sides: Object.keys(p.sides) })) }; }
}
