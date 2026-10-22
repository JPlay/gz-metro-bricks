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
export const XF = { x0: 4, x1: 20, z0: -1.9, z1: 1.9 };   // 吕厝换乘楼梯（L1 地面开洞 → L2）
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
    this.platforms.forEach(p => { this.buildPlatform(p); this.decor(p); });
    if (this.platforms.length > 1) this.buildTransfer();
    if (code === 'xmnb') this.linkRailway();
    else this.buildConcourse();
    k.finish(true); this.atlas.finish(k.root, 'xmStSigns'); noProbe(k.root);
    { const m = scene.getMaterialByName('brick@xm'); if (m) { m.environmentIntensity = 0.06; m.metallicF0Factor = 0; m.roughness = 1; if (m.bumpTexture) m.bumpTexture.level = 1.2; } }   // 哑光红砖（不要塑料感）
  }
  frames() {
    const lines = this.s.lines;
    if (lines.length > 1) return [
      { line: 1, y: XM_PY, zc: 0, hole: true },
      { line: 2, y: XM_PY2, zc: 0, under: true }   // 吕厝：2 号线在 1 号线正下方（真实 1 号线地下二层、2 号线地下三层）
    ];
    // 厦门北站：侧式站台对准国铁出站层地铁站厅（z≈-80），轨在 -z（往站房外）
    if (this.code === 'xmnb') return [{ line: 1, y: XM_PY, zc: -80 }];   // 游戏用岛式（双边可乘）；真实为侧式
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
    k.floorWithHoles(-XM_HALL_X, XM_HALL_X, z0, z1, y - 1.3, y, hex(th.floor), P.hole ? [[XF.x0, XF.x1, XF.z0 - 0.1, XF.z1 + 0.1]] : [], true, 'floor');
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
      if (this.themeKey === 'rock') BR.slab(-XM_HALL_X, XM_HALL_X, y - 1.75, y + 1.4, wz - sz * 0.02, wz + sz * 0.02, hex(th.dado), { ao: false });
      else {
        Pv.slab(-XM_HALL_X, XM_HALL_X, y - 1.75, y + 1.4, wz - sz * 0.02, wz + sz * 0.02, hex('#E4DDD0'), { ao: false });   // 白石墙裙
        this.bricks(-XM_HALL_X, XM_HALL_X, y + 1.55, y + 4.5, Math.min(wz - sz * 0.02, wz + sz * 0.02), Math.max(wz - sz * 0.02, wz + sz * 0.02));   // 上半墙红砖
      }
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
  /** 燕尾脊：一根脊 + 两端上翘分叉的“燕尾”（闽南古厝屋脊）。dir: 'x' 沿 x */
  yanwei(G, x0, x1, y, z, d, col, k = 1) {
    G.slab(x0, x1, y, y + 0.16 * k, z - d / 2, z + d / 2, col, { ao: false });
    for (const e of [-1, 1]) {
      const xe = e < 0 ? x0 : x1;
      // 主燕尾：向外上翘；副尾：更陡、略短 → 分叉（实测：rz 取 +e 才是往上翘）
      G.box(xe + e * 0.42 * k, y + 0.2 * k, z, 0.95 * k, 0.12 * k, d, col, 0, 0, e * 0.42, 1, { ao: false });
      G.box(xe + e * 0.62 * k, y + 0.42 * k, z, 0.55 * k, 0.09 * k, d * 0.8, col, 0, 0, e * 0.95, 1, { ao: false });
    }
  }
  /** 沿 z 的燕尾脊（柱头用：从站台纵向看是侧影）；实测：沿 z 的盒子 rx=-θ 时 +z 端上翘，所以 rx = -e·θ */
  yanweiZ(G, x, y, z0, z1, d, col, k = 1) {
    G.slab(x - d / 2, x + d / 2, y, y + 0.16 * k, z0, z1, col, { ao: false });
    for (const e of [-1, 1]) {
      const ze = e < 0 ? z0 : z1;
      G.box(x, y + 0.2 * k, ze + e * 0.42 * k, d, 0.12 * k, 0.95 * k, col, 0, -e * 0.42, 0, 1, { ao: false });
      G.box(x, y + 0.42 * k, ze + e * 0.62 * k, d * 0.8, 0.09 * k, 0.55 * k, col, 0, -e * 0.95, 0, 1, { ao: false });
    }
  }
  /** 柱头燕尾脊（实心）：中段平直，两头分段上翘、尾端分叉；红橙瓦面 + 浅灰白压边。沿 z 放，rx=-e·θ 上翘 */
  ridgeZ(G, x, yb, zc, half = 0.55) {
    const TILE = hex('#C9552F'), TRIM = hex('#ECE8E0'), o = { ao: false }, W = 0.34;
    G.slab(x - W / 2, x + W / 2, yb, yb + 0.22, zc - half, zc + half, TILE, o);
    G.slab(x - W / 2 - 0.03, x + W / 2 + 0.03, yb + 0.22, yb + 0.27, zc - half, zc + half, TRIM, o);
    G.slab(x - W / 2 - 0.02, x + W / 2 + 0.02, yb - 0.04, yb, zc - half - 0.02, zc + half + 0.02, TRIM, o);
    const seg = (cz, cy, th, len, h, w, e) => {   // 中心 (cz,cy)、沿 e·z 方向、上翘角 th
      G.box(x, cy, cz, w, h, len, TILE, 0, -e * th, 0, 1, o);
      const nz = -e * Math.sin(th), ny = Math.cos(th);
      G.box(x, cy + ny * (h / 2 + 0.025), cz + nz * (h / 2 + 0.025), w + 0.05, 0.05, len, TRIM, 0, -e * th, 0, 1, o);
    };
    for (const e of [-1, 1]) {
      let z = zc + e * half, yy = yb + 0.11, h = 0.22, w = W;
      for (const deg of [12, 26, 40, 54]) {
        const th = deg * Math.PI / 180, L = 0.17;
        seg(z + e * Math.cos(th) * L / 2, yy + Math.sin(th) * L / 2, th, L + 0.02, h, w, e);
        z += e * Math.cos(th) * L; yy += Math.sin(th) * L; h -= 0.02; w -= 0.02;
      }
      // 燕尾分叉：上叉陡、下叉平，都是实心短块
      for (const [deg, L, hh] of [[72, 0.26, 0.12], [28, 0.28, 0.12]]) {
        const th = deg * Math.PI / 180;
        seg(z + e * Math.cos(th) * L / 2, yy + Math.sin(th) * L / 2, th, L, hh, w - 0.04, e);
      }
    }
  }
  /** 闽南红砖墙面：按 ~1.6 m 分块，每块砖色略有深浅（同一个材质桶，不加 draw） */
  bricks(x0, x1, y0, y1, z0, z1) {
    const B2 = this.kit.g('brick@xm'), alongX = (x1 - x0) >= (z1 - z0), L = alongX ? x1 - x0 : z1 - z0, n = Math.max(1, Math.round(L / 1.6));
    const T = ['#A0807A', '#8E6E68', '#AE8C84', '#987670', '#A6847C'].map(hex);
    for (let i = 0; i < n; i++) {
      const a = i / n, b = (i + 1) / n, c = T[(this._bs = ((this._bs || 7) * 16807) % 2147483647) % T.length];
      if (alongX) B2.slab(x0 + (x1 - x0) * a, x0 + (x1 - x0) * b, y0, y1, z0, z1, c, { ao: false });
      else B2.slab(x0, x1, y0, y1, z0 + (z1 - z0) * a, z0 + (z1 - z0) * b, c, { ao: false });
    }
  }
  /** 不规则岩块：错位、带一点转角，灰褐深浅混合 */
  rockBlock(cx, cy, cz, w, h, d, rnd) {
    const ROCKS = ['#857A6E', '#9C9283', '#6C645A', '#ADA291', '#786E62', '#91877A', '#5F584F'].map(hex);
    this.kit.g('granite').box(cx, cy, cz, w, h, d, ROCKS[(rnd() * ROCKS.length) | 0], (rnd() - 0.5) * 0.3, (rnd() - 0.5) * 0.08, (rnd() - 0.5) * 0.1, 1, { ao: false });
  }
  /** 站台装修：端墙（闽南红砖山墙 / 岩壁）、岛中立柱、屏蔽门上方门楣、燕尾脊吊牌框 */
  decor(P) {
    const k = this.kit, y = P.y, zc = P.zc, th = this.th, Pv = k.solid, BR = k.g('brick'), GR = k.g('granite'), G = k.glow;
    const rock = this.themeKey === 'rock', CY = y + 4.2, SEA = hex('#1F6FA8'), STONE = hex('#E9E3D6'), TILE = hex('#D99A84');
    const so = P.sideOnly;
    const z0 = so === 'A' ? zc - XM_PSD : so ? zc - 0.5 : zc - XM_PSD, z1 = so === 'A' ? zc + 0.4 : zc + XM_PSD;
    let seed = (this.code.charCodeAt(0) * 31 + P.line * 7) | 0;
    const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
    const ROCKS = ['#8C8276', '#A39A8C', '#6F675D', '#B3A897', '#7E7466', '#958B7C'].map(hex);
    // 1) 端墙：站台两头封住（不再看到天空）
    for (const e of [-1, 1]) {
      const xw = e * XM_HALL_X, xi = xw - e * 0.3;
      Pv.slab(Math.min(xw, xi), Math.max(xw, xi), y, CY + 0.25, z0, z1, hex(th.wall), { ao: false });
      k.colSlab(Math.min(xw, xi), Math.max(xw, xi), y, CY, z0, z1);
      const xf = xi - e * 0.04, xa = Math.min(xi, xf), xb = Math.max(xi, xf);
      if (rock) {
        // 岩壁：不规则石块凹凸
        for (let yy = y; yy < CY; ) {
          const h = 0.5 + rnd() * 0.7;
          for (let zz = z0; zz < z1; ) {
            const w = 0.8 + rnd() * 1.6, dz = Math.min(w, z1 - zz), dep = 0.05 + rnd() * 0.25;
            this.rockBlock(xi - e * dep * 0.5, yy + h / 2, zz + dz / 2, 0.3 + dep, h * (0.9 + rnd() * 0.25), dz * (0.95 + rnd() * 0.2), rnd);
            zz += dz;
          }
          yy += h;
        }
        // 海蓝腰带 + 站名
        Pv.slab(xa - (e > 0 ? 0.32 : 0), xb + (e < 0 ? 0.32 : 0), y + 1.0, y + 1.18, z0, z1, SEA, { ao: false });
      } else {
        // 白石勒脚 + 红砖墙身 + 海蓝瓷砖腰线 + 燕尾脊山墙轮廓
        Pv.slab(xa, xb, y, y + 1.6, z0, z1, STONE, { ao: false });
        this.bricks(xa, xb, y + 1.6, CY - 0.6, z0, z1);
        Pv.slab(xa - (e > 0 ? 0.02 : 0), xb + (e < 0 ? 0.02 : 0), y + 1.6, y + 1.78, z0, z1, SEA, { ao: false });
        // 红砖拼花窗（“出砖入石”）：中间一块白石框 + 海蓝心
        Pv.slab(xa - (e > 0 ? 0.03 : 0), xb + (e < 0 ? 0.03 : 0), y + 1.3, y + 2.35, zc - 1.6, zc + 1.6, STONE, { ao: false });
        Pv.slab(xa - (e > 0 ? 0.05 : 0), xb + (e < 0 ? 0.05 : 0), y + 1.43, y + 2.22, zc - 1.4, zc + 1.4, SEA, { ao: false });
      }
      // 燕尾脊：贴在端墙上沿（沿 z 方向做脊）
      // 山墙上的大燕尾脊：深色瓦脊 + 白灰线，两端长长上翘分叉（低于天花梁，正面能看见）
      const xr = xi - e * 0.16, col = hex('#2F2723'), line = STONE;
      const ya = y + 2.75, za = z0 + 3.0, zb = z1 - 3.0;
      Pv.slab(xr - 0.14, xr + 0.14, ya, ya + 0.5, za, zb, col, { ao: false });
      // 屋面瓦（脊下一道赭红瓦檐，读作“屋顶”）+ 白灰滴水线
      Pv.slab(xr - 0.1, xr + 0.1, ya - 0.55, ya - 0.08, za - 0.9, zb + 0.9, hex('#8E3B28'), { ao: false });
      Pv.slab(xr - 0.12, xr + 0.12, ya - 0.64, ya - 0.55, za - 1.0, zb + 1.0, STONE, { ao: false });
      Pv.slab(xr - 0.16, xr + 0.16, ya - 0.08, ya, za - 0.3, zb + 0.3, line, { ao: false });
      for (const s2 of [-1, 1]) {
        const ze = s2 < 0 ? za : zb;
        Pv.box(xr, ya + 0.36, ze + s2 * 0.95, 0.28, 0.36, 2.0, col, 0, s2 * 0.4, 0, 1, { ao: false });
        Pv.box(xr, ya + 0.95, ze + s2 * 1.95, 0.24, 0.2, 1.3, col, 0, s2 * 0.85, 0, 1, { ao: false });
        Pv.box(xr, ya + 0.78, ze + s2 * 2.15, 0.2, 0.14, 1.0, col, 0, s2 * 0.35, 0, 1, { ao: false });
      }
    }
    // 2) 岛中立柱（侧式站贴墙不放）
    if (!so) for (let x = -22.5; x <= 22.6; x += 9) {
      if (Math.abs(x) < 3 || ((P.hole || P.under) && x > XF.x0 - 1.5 && x < XF.x1 + 3.5)) continue;
      k.colSlab(x - 0.45, x + 0.45, y, CY, zc - 0.45, zc + 0.45);
      if (rock) {
        for (let yy = y; yy < CY - 0.3; ) {
          const h = 0.4 + rnd() * 0.55;
          for (let q = 0; q < 3; q++) {
            const w = 0.55 + rnd() * 0.6, d = 0.55 + rnd() * 0.6;
            this.rockBlock(x + (rnd() - 0.5) * 0.45, Math.min(yy + h / 2, CY - 0.3 - h / 2), zc + (rnd() - 0.5) * 0.45, w, h * (0.85 + rnd() * 0.4), d, rnd);
          }
          yy += h * 0.85;
        }
        Pv.slab(x - 0.6, x + 0.6, CY - 0.3, CY - 0.15, zc - 0.6, zc + 0.6, SEA, { ao: false });
      } else {
        Pv.slab(x - 0.55, x + 0.55, y, y + 0.45, zc - 0.55, zc + 0.55, STONE, { ao: false });
        const CT = CY - 1.25;   // 砖柱顶
        for (const [a0, a1, b0, b1] of [[x - 0.45, x + 0.45, zc - 0.46, zc - 0.44], [x - 0.45, x + 0.45, zc + 0.44, zc + 0.46], [x - 0.46, x - 0.44, zc - 0.45, zc + 0.45], [x + 0.44, x + 0.46, zc - 0.45, zc + 0.45]]) this.bricks(a0, a1, y + 0.45, CT, b0, b1);
        Pv.slab(x - 0.44, x + 0.44, y + 0.45, CT, zc - 0.44, zc + 0.44, hex('#7A3A2A'), { ao: false });
        // 海蓝柱头板 + 实心燕尾脊（沿站台方向看是侧影）
        Pv.slab(x - 0.6, x + 0.6, CT, CT + 0.15, zc - 0.6, zc + 0.6, SEA, { ao: false });
        this.ridgeZ(Pv, x, CT + 0.19, zc);
        // 木斗拱：脊上一根短柱托住天花
        Pv.slab(x - 0.14, x + 0.14, CT + 0.46, CY - 0.2, zc - 0.2, zc + 0.2, hex(th.beam), { ao: false });
        Pv.slab(x - 0.8, x + 0.8, CY - 0.2, CY, zc - 0.25, zc + 0.25, hex(th.beam), { ao: false });
        Pv.slab(x - 0.25, x + 0.25, CY - 0.2, CY, zc - 0.9, zc + 0.9, hex(th.beam), { ao: false });
      }
    }
    // 2b) 古地石：岛中一道岩壁把立柱连起来（中间留 x≈0 一段可以穿过）
    if (rock && !so) for (const [xa0, xa1] of [[-22.5, -4.5], [4.5, 22.5]]) {
      k.colSlab(xa0, xa1, y, CY, zc - 0.4, zc + 0.4);
      for (let yy = y; yy < CY - 0.2; ) {
        const h = 0.35 + rnd() * 0.6;
        for (let xx = xa0; xx < xa1; ) {
          const w = 0.7 + rnd() * 1.3;
          this.rockBlock(xx + w / 2, Math.min(yy + h / 2, CY - 0.2 - h / 2), zc + (rnd() - 0.5) * 0.25, w * (1 + rnd() * 0.15), h * (0.9 + rnd() * 0.3), 0.6 + rnd() * 0.35, rnd);
          xx += w;
        }
        yy += h * 0.9;
      }
    }
    // 3) 屏蔽门上方门楣：红砖（或岩石）带 + 海蓝瓷砖线 + 燕尾脊
    for (const side of Object.values(P.sides)) {
      const sg = side.key === 'A' ? -1 : 1, zf = side.psdZ - sg * 0.14;
      const za = Math.min(zf, zf - sg * 0.05), zb = Math.max(zf, zf - sg * 0.05);
      Pv.slab(-XM_HALL_X + 0.3, XM_HALL_X - 0.3, y + 2.82, y + 2.97, za - 0.02, zb + 0.02, SEA, { ao: false });
      if (rock) GR.slab(-XM_HALL_X + 0.3, XM_HALL_X - 0.3, y + 2.97, CY, za, zb, hex('#8C8276'), { ao: false });
      else Pv.slab(-XM_HALL_X + 0.3, XM_HALL_X - 0.3, y + 2.97, CY, za, zb, hex('#3A2C26'), { ao: false });   // 深色木门楣
      // 站名牌（中英 + 线路色），挂在屏蔽门上方，面向站台
      const L = XM_LINES[P.line], stn = this.s;
      const paint = (c, pw, ph) => {
        c.fillStyle = '#FFFFFF'; c.fillRect(0, 0, pw, ph);
        c.fillStyle = L.color; c.fillRect(0, ph * 0.84, pw, ph * 0.16); c.fillRect(0, 0, ph * 0.62, ph * 0.84);
        c.fillStyle = L.ink; c.textAlign = 'center'; c.textBaseline = 'middle'; c.font = `800 ${ph * 0.46}px ${FONT_EN}`; c.fillText(String(L.id), ph * 0.31, ph * 0.44);
        c.fillStyle = '#1B2530'; c.font = `800 ${ph * 0.42}px ${FONT}`; c.fillText(stn.zh, pw * 0.56, ph * 0.33);
        c.fillStyle = '#4A5563'; c.font = `600 ${ph * 0.2}px ${FONT_EN}`; c.fillText(stn.en, pw * 0.56, ph * 0.68);
      };
      for (const bx of [-14, 14]) {
        this.atlas.quad(bx, y + 3.58, zf - sg * 0.08, 6.4, 0.95, sg < 0 ? 0 : Math.PI, this.atlas.draw(6.4, 0.95, paint));
        Pv.slab(bx - 3.3, bx + 3.3, y + 3.07, y + 4.1, Math.min(zf - sg * 0.06, zf), Math.max(zf - sg * 0.06, zf), hex('#1B2530'), { ao: false });
      }
      for (let x = -31.5; x <= 31.6; x += 9) if (Math.abs(Math.abs(x) - 13.5) > 0.1) this.yanwei(Pv, x - 2.6, x + 2.6, CY - 0.62, zf - sg * 0.08, 0.1, rock ? hex('#3E3A34') : hex('#7A2E1F'));
    }
    // 4) 方向吊牌加燕尾脊框顶（站名 / 往 xx 方向）
    for (const side of Object.values(P.sides)) {
      const z = zc + (side.key === 'A' ? -2.5 : 2.5);
      this.yanwei(Pv, -2.7, 2.7, y + 3.98, z, 0.1, hex('#7A2E1F'));
      Pv.slab(-2.85, 2.85, y + 3.0, y + 3.05, z - 0.04, z + 0.04, SEA, { ao: false });
    }
  }
  ceil(P) {
    const k = this.kit, y = P.y, zc = P.zc, th = this.th, CY = y + 4.2, Pv = k.solid, G = k.glow;
    const z0 = P.sideOnly ? zc - 0.5 : zc - XM_PSD, z1 = zc + XM_PSD;
    if (P.under) k.floorWithHoles(-XM_HALL_X, XM_HALL_X, z0, z1, CY, CY + 0.25, hex('#F4F2EE'), [[XF.x0 - 0.2, XF.x1, XF.z0 - 0.3, XF.z1 + 0.3]], false, 'ceiling');
    else k.g('ceiling').slab(-XM_HALL_X, XM_HALL_X, CY, CY + 0.25, z0, z1, hex('#F4F2EE'), { ao: false });
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
      for (let x = -XM_HALL_X + 2; x < XM_HALL_X; x += 3.6) { if (P.under && x > XF.x0 - 0.5 && x < XF.x1 + 0.5) { Pv.slab(x - 0.09, x + 0.09, CY - 0.35, CY, z0, XF.z0 - 0.3, hex(th.beam), { ao: false }); Pv.slab(x - 0.09, x + 0.09, CY - 0.35, CY, XF.z1 + 0.3, z1, hex(th.beam), { ao: false }); } else Pv.slab(x - 0.09, x + 0.09, CY - 0.35, CY, z0, z1, hex(th.beam), { ao: false }); }
      for (const z of (P.under ? [-3, 3] : [-3, 0, 3])) G.slab(-XM_HALL_X + 1, XM_HALL_X - 1, CY - 0.4, CY - 0.36, zc + z - 0.2, zc + z + 0.2, hex('#FFF8EC'), { ao: false });
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
  /** 吕厝：1 号线站台中间开洞，直跑楼梯下到正下方 2 号线站台；两头吊换乘牌（1 橙 / 2 绿） */
  buildTransfer() {
    const k = this.kit, Pv = k.solid, SEA = hex('#1F6FA8');
    // 一半步行楼梯（深色防滑边）+ 一半扶梯（深灰梯级 + 黄边），中间玻璃隔板 + 扶手
    k.stairs('x', XF.x0, XM_PY2, XF.x1, XM_PY, XF.z0, -0.12, XM_PY2, '#D6D1C7', { nosing: '#4A3A32' });
    k.stairs('x', XF.x0, XM_PY2, XF.x1, XM_PY, 0.12, XF.z1, XM_PY2, '#8C9298', { nosing: '#F2C230' });
    { const L = XF.x1 - XF.x0, dy = XM_PY - XM_PY2, len = Math.hypot(L, dy), ang = Math.atan2(dy, L), mx = (XF.x0 + XF.x1) / 2, my = (XM_PY + XM_PY2) / 2;
      k.glass.box(mx, my + 0.5, 0, len, 0.9, 0.03, hex('#D6EEF8'), 0, 0, ang);
      k.metal.box(mx, my + 0.98, 0, len, 0.07, 0.16, hex('#C4CBD2'), 0, 0, ang);
      k.metal.box(mx, my + 0.06, 0, len, 0.12, 0.24, hex('#3A3F45'), 0, 0, ang); }
    // 洞口栏杆（两侧 + 楼梯起点对面一头），白石栏板 + 海蓝扶手
    // 洞口：玻璃栏板 + 不锈钢扶手（两侧 + 尽头），能看到下面的踏步和 2 号线站台
    for (const z of [XF.z0 - 0.05, XF.z1 + 0.05]) { k.rail(XF.x0, z, XF.x1, z, XM_PY); k.glass.slab(XF.x0, XF.x1, XM_PY + 0.05, XM_PY + 1.0, z - 0.015, z + 0.015, hex('#D6EEF8')); k.metal.slab(XF.x0, XF.x1, XM_PY + 1.0, XM_PY + 1.07, z - 0.05, z + 0.05, hex('#C4CBD2'), { ao: false }); k.metal.slab(XF.x0, XF.x1, XM_PY, XM_PY + 0.06, z - 0.05, z + 0.05, hex('#9AA1A8'), { ao: false }); }
    k.rail(XF.x0, XF.z0, XF.x0, XF.z1, XM_PY);
    k.glass.slab(XF.x0 - 0.015, XF.x0 + 0.015, XM_PY + 0.05, XM_PY + 1.0, XF.z0, XF.z1, hex('#D6EEF8'));
    k.metal.slab(XF.x0 - 0.05, XF.x0 + 0.05, XM_PY + 1.0, XM_PY + 1.07, XF.z0, XF.z1, hex('#C4CBD2'), { ao: false });
    // 楼梯井侧面：浅色石材（不再是红/蓝色块），一道灯带照亮踏步
    for (const z of [XF.z0 - 0.3, XF.z1 + 0.3]) Pv.slab(XF.x0 - 0.2, XF.x1, XM_PY2 + 4.2, XM_PY - 1.3, z - 0.1, z + 0.1, hex('#E4DDD0'), { ao: false });
    for (const z of [XF.z0 - 0.18, XF.z1 + 0.18]) k.glow.slab(XF.x0, XF.x1, XM_PY - 1.5, XM_PY - 1.42, z - 0.03, z + 0.03, hex('#FFF4DE'), { ao: false });
    const sign = (to) => (c, pw, ph) => {
      c.fillStyle = '#1B2530'; c.fillRect(0, 0, pw, ph);
      const L = XM_LINES[to]; c.fillStyle = L.color; c.fillRect(10, 10, ph - 20, ph - 20);
      c.fillStyle = '#FFF'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.font = `800 ${ph * 0.55}px ${FONT_EN}`; c.fillText(String(to), 10 + (ph - 20) / 2, ph * 0.54);
      c.textAlign = 'left'; c.font = `800 ${ph * 0.34}px ${FONT}`; c.fillText(`换乘 ${to}号线`, ph * 1.05, ph * 0.38);
      c.fillStyle = '#C9D2DB'; c.font = `600 ${ph * 0.17}px ${FONT_EN}`; c.fillText(`Transfer to Line ${to}  ·  往 ${Object.values(L.dirs).map(d => d.zh).join(' / ')}`, ph * 1.05, ph * 0.74);
    };
    // 楼梯脚在 x0（L2），顶在 x1（L1）：从 -x 看过去能看到踏步/踢面往上；L1 牌在洞口近端，L2 牌在楼梯脚
    this.atlas.quad(XF.x0 - 0.6, XM_PY + 3.3, 0, 5.2, 1.0, -Math.PI / 2, this.atlas.draw(5.2, 1.0, sign(2)));
    this.atlas.quad(XF.x0 - 0.8, XM_PY2 + 3.3, 0, 5.2, 1.0, -Math.PI / 2, this.atlas.draw(5.2, 1.0, sign(1)));
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
