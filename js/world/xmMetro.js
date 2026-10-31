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
import { XM_EXITS } from './xmStreet.js';
import { XM_EXIT_TABLE } from '../data/xm-exits.js';
import { exitZh } from '../data/xm-visits.js';
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

/** 网络描述（厦门默认）：新城市（福州）传自己的 N 进来，几何 / 状态机共用。
 *  O 场景原点；net 列车 / 区域网络 id；LINES / STATIONS 线路；EXITS 每站出口（单个出口，可走到街区）；TABLE 出入口信息牌；rail 与国铁站相连的那个地铁站 code */
export const XM_NET = { O: XO, net: 'xm', LINES: XM_LINES, STATIONS: XM_STATIONS, EXITS: XM_EXITS, TABLE: XM_EXIT_TABLE, rail: 'xmnb', exitZh };
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
  constructor(scene, code, N = XM_NET) {
    this.scene = scene; this.code = code; this.N = N;
    this.s = N.STATIONS[code];
    this.themeKey = this.s.theme || N.theme || 'minnan';
    this.th = (N.THEME && N.THEME[this.themeKey]) || THEME[this.themeKey] || THEME.minnan;
    this.dadoG = N.dado || 'brick';
    const k = this.kit = new Kit(scene, N.net + 'St-' + code);
    k.root.position.set(N.O.x, 0, 0);
    this.atlas = new FoodAtlas(scene, 2048);
    this.platforms = this.frames().map(f => ({ ...f, sides: this.sidesFor(f) }));
    this.platforms.forEach(p => { p.up = this.upFor(p); if (code === N.rail && !p.under) p.endOpen = true; });
    // 换乘楼梯洞口（跟着第一层站台的 zc 走；吕厝 zc=0 → 与原 XF 相同）
    { const z = this.platforms[0].zc; this.XF = { ...XF, z0: XF.z0 + z, z1: XF.z1 + z, zc: z }; }
    this.platforms.forEach(p => { this.buildPlatform(p); this.decor(p); });
    if (this.platforms.length > 1) this.buildTransfer();
    if (code === N.rail) this.linkRailway();
    else this.buildConcourse();
    k.finish(true); this.atlas.finish(k.root, N.net + 'StSigns'); noProbe(k.root);
    { const m = scene.getMaterialByName('brick@xm'); if (m) { m.environmentIntensity = 0.06; m.metallicF0Factor = 0; m.roughness = 1; if (m.bumpTexture) m.bumpTexture.level = 1.2; } }   // 哑光红砖（不要塑料感）
  }
  frames() {
    const lines = this.s.lines, zc = this.code === this.N.rail ? -80 : 0;
    if (lines.length > 1) return [
      { line: lines[0], y: XM_PY, zc, hole: true },
      { line: lines[1], y: XM_PY2, zc, under: true }   // 吕厝：2 号线在 1 号线正下方（真实 1 号线地下二层、2 号线地下三层）
    ];
    // 厦门北站：侧式站台对准国铁出站层地铁站厅（z≈-80），轨在 -z（往站房外）
    if (this.code === this.N.rail) return [{ line: lines[0], y: XM_PY, zc: -80 }];   // 游戏用岛式（双边可乘）；真实为侧式
    if (this.s.side) return [{ line: lines[0], y: XM_PY, zc: 0, sideOnly: true }];
    return [{ line: lines[0], y: XM_PY, zc: 0 }];
  }
  /** 普通站：站台 → 站厅的楼梯（沿 x，脚在 x=-6，顶在 x=-20 / 站厅层 -6.5），z 范围在站台中间的可走区 */
  upFor(P) {
    if (this.code === this.N.rail || P.y !== XM_PY) return null;
    const zc = P.zc, so = P.sideOnly;
    const [z0, z1] = so === 'A' ? [zc - 3.2, zc - 0.2] : so ? [zc + 0.2, zc + 3.2] : [zc - 2, zc + 2];
    return { x0: -20, x1: -6, z0, z1, hole: [-20, -9.4, z0 - 0.3, z1 + 0.3] };
  }
  sidesFor(P) {
    const L = this.N.LINES[P.line], dirs = Object.values(L.dirs);
    // A = -z 侧（step 取 dirs[0]），B = +z 侧
    const mk = (key, step, n) => ({
      key, step, n, trackZ: P.zc + (key === 'A' ? -1 : 1) * XM_TRACK,
      psdZ: P.zc + (key === 'A' ? -1 : 1) * XM_PSD,
      // doorSg = 列车哪一侧的门朝站台：A 侧轨道在站台 -z 外，站台在车的 +z 侧 → +1；B 侧相反 → -1
      doorSg: key === 'A' ? 1 : -1
    });
    if (P.sideOnly) {
      const key = P.sideOnly === 'A' ? 'A' : 'B';
      const step = key === 'A' ? dirs[0].step : dirs[1].step;
      return { [key]: mk(key, step, 1) };
    }
    return { A: mk('A', dirs[0].step, 1), B: mk('B', dirs[1].step, 2) };
  }
  buildPlatform(P) {
    const k = this.kit, y = P.y, zc = P.zc, L = this.N.LINES[P.line], lc = L.color, th = this.th;
    const Pv = k.solid, W = k.g('wall'), BR = k.g(this.dadoG), F = k.g('floor'), G = k.glow, M = k.metal;
    const sideOnly = P.sideOnly;
    let z0 = zc - XM_PSD, z1 = zc + XM_PSD;
    if (sideOnly === 'B') { z0 = zc - 0.4; z1 = zc + XM_PSD; }
    else if (sideOnly === 'A') { z0 = zc - XM_PSD; z1 = zc + 0.4; }
    else if (sideOnly) { z0 = zc - 0.5; z1 = zc + XM_PSD; }
    k.floorWithHoles(-XM_HALL_X, XM_HALL_X, z0, z1, y - 1.3, y, hex(th.floor), P.hole ? [[this.XF.x0, this.XF.x1, this.XF.z0 - 0.1, this.XF.z1 + 0.1]] : [], true, 'floor');
    // 盲道 + 石材收边
    for (const sz of (sideOnly === 'A' ? [-1] : sideOnly === 'B' ? [1] : sideOnly ? [1] : [-1, 1])) {
      k.g('tactile').slab(-XM_HALL_X, XM_HALL_X, y, y + 0.006, zc + sz * 5.2 - 0.2, zc + sz * 5.2 + 0.2, hex('#F2C230'), { ao: false });
      Pv.slab(-XM_HALL_X, XM_HALL_X, y, y + 0.004, zc + sz * 5.7 - 0.15, zc + sz * 5.7 + 0.15, hex('#9AA0A6'), { ao: false });
    }
    // 轨行区
    for (const sz of (sideOnly === 'A' ? [-1] : sideOnly ? [1] : [-1, 1])) {
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
            if (prevC) c.fillText('← ' + this.N.STATIONS[prevC].zh, ph * 0.95, ph * 0.88);
            if (nextC) { c.textAlign = 'right'; c.fillText(this.N.STATIONS[nextC].zh + ' →', pw - 16, ph * 0.88); }
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
    // 侧式站：站台背后一道墙（轨道只在一侧）
    if (sideOnly) {
      const wb = sideOnly === 'A' ? zc + 0.4 : zc - 0.5, wz0 = sideOnly === 'A' ? wb : wb - 0.3, wz1 = sideOnly === 'A' ? wb + 0.3 : wb;
      W.slab(-XM_HALL_X, XM_HALL_X, y, y + 4.45, wz0, wz1, hex(th.wall), { aoTop: true }); k.colSlab(-XM_HALL_X, XM_HALL_X, y, y + 4.45, wz0, wz1);
      const f = sideOnly === 'A' ? wz0 - 0.02 : wz1 + 0.02;
      Pv.slab(-XM_HALL_X, XM_HALL_X, y, y + 1.4, Math.min(wz0, f), Math.max(wz1, f), hex('#E4DDD0'), { ao: false });
      Pv.slab(-XM_HALL_X, XM_HALL_X, y + 1.4, y + 1.55, Math.min(wz0, f - 0.01), Math.max(wz1, f + 0.01), hex(th.beam), { ao: false });
    }
    // 天花：木椽 / 帆影 / 岩石肋
    this.ceil(P);
    // 普通站：站台 → 站厅楼梯（看得见、有灯、有出站牌）
    if (P.up) this.buildUp(P);
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
    const k = this.kit, y = P.y, zc = P.zc, th = this.th, Pv = k.solid, BR = k.g(this.dadoG), GR = k.g('granite'), G = k.glow;
    const rock = this.themeKey === 'rock', CY = y + 4.2, SEA = hex(this.N.sea || '#1F6FA8'), STONE = hex('#E9E3D6'), TILE = hex('#D99A84');
    const so = P.sideOnly;
    const z0 = so === 'A' ? zc - XM_PSD : so ? zc - 0.5 : zc - XM_PSD, z1 = so === 'A' ? zc + 0.4 : zc + XM_PSD;
    let seed = (this.code.charCodeAt(0) * 31 + P.line * 7) | 0;
    const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
    const ROCKS = ['#8C8276', '#A39A8C', '#6F675D', '#B3A897', '#7E7466', '#958B7C'].map(hex);
    // 1) 端墙：站台两头封住（不再看到天空）
    for (const e of [-1, 1]) {
      const xw = e * XM_HALL_X, xi = xw - e * 0.3;
      const xf = xi - e * 0.04, xa = Math.min(xi, xf), xb = Math.max(xi, xf);
      // 厦门北：-x 端墙中间开门洞（z zc±3，高 2.7）→ 换乘通道 / 楼梯上国铁
      const open = P.endOpen && e < 0 ? [zc - 3, zc + 3, y + 2.7] : null;
      const zr = open ? [[z0, open[0]], [open[1], z1]] : [[z0, z1]];
      for (const [a0, a1] of zr) { Pv.slab(Math.min(xw, xi), Math.max(xw, xi), y, CY + 0.25, a0, a1, hex(th.wall), { ao: false }); k.colSlab(Math.min(xw, xi), Math.max(xw, xi), y, CY, a0, a1); }
      if (open) {
        Pv.slab(Math.min(xw, xi), Math.max(xw, xi), open[2], CY + 0.25, open[0], open[1], hex(th.wall), { ao: false });
        Pv.slab(xa - 0.02, xb + 0.02, open[2], open[2] + 0.3, open[0] - 0.15, open[1] + 0.15, STONE, { ao: false });   // 白石门楣
        for (const zz of [open[0], open[1]]) Pv.slab(xa - 0.02, xb + 0.02, y, open[2], zz - 0.15, zz + 0.15, STONE, { ao: false });   // 门框
      }
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
        for (const [a0, a1] of zr) {
          Pv.slab(xa, xb, y, y + 1.6, a0, a1, STONE, { ao: false });
          this.bricks(xa, xb, y + 1.6, CY - 0.6, a0, a1);
          Pv.slab(xa - (e > 0 ? 0.02 : 0), xb + (e < 0 ? 0.02 : 0), y + 1.6, y + 1.78, a0, a1, SEA, { ao: false });
        }
        if (open) this.bricks(xa, xb, open[2] + 0.3, CY - 0.6, open[0], open[1]);
        else {
          // 红砖拼花窗（“出砖入石”）：中间一块白石框 + 海蓝心
          Pv.slab(xa - (e > 0 ? 0.03 : 0), xb + (e < 0 ? 0.03 : 0), y + 1.3, y + 2.35, zc - 1.6, zc + 1.6, STONE, { ao: false });
          Pv.slab(xa - (e > 0 ? 0.05 : 0), xb + (e < 0 ? 0.05 : 0), y + 1.43, y + 2.22, zc - 1.4, zc + 1.4, SEA, { ao: false });
        }
      }
      // 燕尾脊：贴在端墙上沿（沿 z 方向做脊）
      // 山墙上的大燕尾脊：深色瓦脊 + 白灰线，两端长长上翘分叉（低于天花梁，正面能看见）；N.plain（福州）不做
      if (this.N.plain) continue;
      const xr = xi - e * 0.16, col = hex('#2F2723'), line = STONE;
      const ya = y + 2.75, za = z0 + 3.0, zb = z1 - 3.0;
      Pv.slab(xr - 0.14, xr + 0.14, ya, ya + 0.5, za, zb, col, { ao: false });
      // 屋面瓦（脊下一道赭红瓦檐，读作“屋顶”）+ 白灰滴水线
      Pv.slab(xr - 0.1, xr + 0.1, ya - 0.55, ya - 0.08, za - 0.9, zb + 0.9, hex('#8E3B28'), { ao: false });
      Pv.slab(xr - 0.12, xr + 0.12, ya - 0.64, ya - 0.55, za - 1.0, zb + 1.0, STONE, { ao: false });
      Pv.slab(xr - 0.16, xr + 0.16, ya - 0.08, ya, za - 0.3, zb + 0.3, line, { ao: false });
      for (const s2 of [-1, 1]) {
        if (open) break;   // 门洞上方只留脊身和瓦檐，不挂长燕尾（会挡门洞）
        const ze = s2 < 0 ? za : zb;
        Pv.box(xr, ya + 0.36, ze + s2 * 0.95, 0.28, 0.36, 2.0, col, 0, s2 * 0.4, 0, 1, { ao: false });
        Pv.box(xr, ya + 0.95, ze + s2 * 1.95, 0.24, 0.2, 1.3, col, 0, s2 * 0.85, 0, 1, { ao: false });
        Pv.box(xr, ya + 0.78, ze + s2 * 2.15, 0.2, 0.14, 1.0, col, 0, s2 * 0.35, 0, 1, { ao: false });
      }
    }
    // 2) 岛中立柱（侧式站贴墙不放）
    if (!so) for (let x = -22.5; x <= 22.6; x += 9) {
      if (Math.abs(x) < 3 || ((P.hole || P.under) && x > this.XF.x0 - 1.5 && x < this.XF.x1 + 3.5)) continue;
      if (P.up && x > P.up.x0 - 1 && x < P.up.x1 + 2) continue;
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
    if (rock && !so) for (const [xa0, xa1] of (P.up ? [[4.5, 22.5]] : [[-22.5, -4.5], [4.5, 22.5]])) {
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
      else Pv.slab(-XM_HALL_X + 0.3, XM_HALL_X - 0.3, y + 2.97, CY, za, zb, hex(this.N.header || '#3A2C26'), { ao: false });   // 深色木门楣（福州：N.header）
      // 站名牌（中英 + 线路色），挂在屏蔽门上方，面向站台
      const L = this.N.LINES[P.line], stn = this.s;
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
    const holes = [];
    if (P.under) holes.push([this.XF.x0 - 0.2, this.XF.x1, this.XF.z0 - 0.3, this.XF.z1 + 0.3]);
    if (P.up) holes.push(P.up.hole);
    if (holes.length) k.floorWithHoles(-XM_HALL_X, XM_HALL_X, z0, z1, CY, CY + 0.25, hex('#F4F2EE'), holes, false, 'ceiling');
    else k.g('ceiling').slab(-XM_HALL_X, XM_HALL_X, CY, CY + 0.25, z0, z1, hex('#F4F2EE'), { ao: false });
    // 楼梯洞口：沿 x 的梁 / 灯带在洞口处断开
    const H = P.up && P.up.hole, inX = (a, b) => H && b > H[0] && a < H[1];
    const zSplit = (a, b) => (H && inX(a, b)) ? [[a, b, z0, H[2]], [a, b, H[3], z1]] : [[a, b, z0, z1]];
    const xSplit = (a, b, za, zb) => (H && zb > H[2] && za < H[3]) ? [[a, Math.min(b, H[0]), za, zb], [Math.max(a, H[1]), b, za, zb]].filter(r => r[1] - r[0] > 0.2) : [[a, b, za, zb]];
    if (this.themeKey === 'sail' || this.themeKey === 'sea') {
      // 波浪 / 帆：海蓝弧板
      for (let i = 0; i < 9; i++) {
        const t = (i + 0.5) / 9 * 2 - 1, x = t * 36, yy = CY - 0.15 + 0.35 * Math.cos(t * Math.PI);
        if (inX(x - 4.1, x + 4.1)) { for (const [, , za, zb] of zSplit(x - 4.1, x + 4.1)) if (zb - za > 0.4) Pv.box(x, yy, (za + zb) / 2, 8.2, 0.12, (zb - za) * 0.9, hex(th.accent), 0, 0, t * 0.08, 1, { ao: false }); }
        else Pv.box(x, yy, zc, 8.2, 0.12, (z1 - z0) * 0.9, hex(th.accent), 0, 0, t * 0.08, 1, { ao: false });
      }
      for (const [a, b, za, zb] of xSplit(-XM_HALL_X + 2, XM_HALL_X - 2, zc - 0.3, zc + 0.3)) G.slab(a, b, CY - 0.05, CY, za, zb, hex('#FFF8EC'), { ao: false });
    } else if (this.themeKey === 'rock') {
      for (let x = -XM_HALL_X + 2; x < XM_HALL_X; x += 3.2) for (const [a, b, za, zb] of zSplit(x - 0.2, x + 0.2)) Pv.slab(a, b, CY - 0.5, CY, za, zb, hex(th.beam), { ao: false });
    } else {
      // 人字梁 / 木椽（闽南古厝意象）
      for (let x = -XM_HALL_X + 2; x < XM_HALL_X; x += 3.6) { if (P.under && x > this.XF.x0 - 0.5 && x < this.XF.x1 + 0.5) { Pv.slab(x - 0.09, x + 0.09, CY - 0.35, CY, z0, this.XF.z0 - 0.3, hex(th.beam), { ao: false }); Pv.slab(x - 0.09, x + 0.09, CY - 0.35, CY, this.XF.z1 + 0.3, z1, hex(th.beam), { ao: false }); } else for (const [a, b, za, zb] of zSplit(x - 0.09, x + 0.09)) Pv.slab(a, b, CY - 0.35, CY, za, zb, hex(th.beam), { ao: false }); }
      for (const z of (P.under ? [-3, 3] : [-3, 0, 3])) for (const [a, b, za, zb] of xSplit(-XM_HALL_X + 1, XM_HALL_X - 1, zc + z - 0.2, zc + z + 0.2)) G.slab(a, b, CY - 0.4, CY - 0.36, za, zb, hex('#FFF8EC'), { ao: false });
    }
  }
  /** 出站牌（绿底「出」+ 中英文，不带箭头） */
  exitPaint(zh, en) {
    return (c, pw, ph) => {
      c.fillStyle = '#1B2530'; c.fillRect(0, 0, pw, ph);
      c.fillStyle = '#1E8E4E'; c.fillRect(8, 8, ph - 16, ph - 16);
      c.fillStyle = '#FFF'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.font = `800 ${ph * 0.5}px ${FONT}`; c.fillText('出', 8 + (ph - 16) / 2, ph * 0.54);
      c.textAlign = 'left'; c.font = `800 ${ph * 0.34}px ${FONT}`; c.fillText(zh, ph * 1.0, ph * 0.38);
      c.fillStyle = '#C9D2DB'; c.font = `600 ${ph * 0.17}px ${FONT_EN}`; c.fillText(en, ph * 1.0, ph * 0.74);
    };
  }
  /** 普通站：站台 → 站厅的直跑楼梯。脚在站台 x=-6，往 -x 爬到 x=-20（站厅层 -6.5），顶上接一段通道到站厅西北角 */
  buildUp(P) {
    const k = this.kit, U = P.up, y = P.y, CY = y + 4.2, Pv = k.solid, G = k.glow, th = this.th, HY = XM_PY + 6.5, RY = HY + 3.5;
    const WALL = hex('#E9E4DA'), STONE = hex('#E4DDD0');
    k.stairs('x', U.x1, y, U.x0, HY, U.z0, U.z1, y, '#D6D1C7', { nosing: '#4A3A32' });
    const [hx0, hx1, hz0, hz1] = U.hole;
    // 楼梯井（站台天花以上）：两侧墙 + 低端封墙，浅色石材 + 灯带
    Pv.slab(hx0, hx1 + 0.3, CY + 0.25, RY, hz0 - 0.3, hz0, WALL, { ao: false }); k.colSlab(hx0, hx1 + 0.3, CY + 0.25, RY, hz0 - 0.3, hz0);
    Pv.slab(hx0 - 4.6, hx1 + 0.3, CY + 0.25, RY, hz1, hz1 + 0.3, WALL, { ao: false }); k.colSlab(hx0 - 4.6, hx1 + 0.3, CY + 0.25, RY, hz1, hz1 + 0.3);
    Pv.slab(hx1, hx1 + 0.3, CY + 0.25, RY, hz0, hz1, WALL, { ao: false });
    Pv.slab(hx0 - 4.6, hx1 + 0.3, RY, RY + 0.25, -8, hz1 + 0.3, hex('#F4F2EE'), { ao: false });   // 楼梯井 + 通道顶
    for (const z of [hz0 + 0.02, hz1 - 0.02]) G.slab(hx0, hx1, CY + 1.4, CY + 1.48, z - 0.02, z + 0.02, hex('#FFF4DE'), { ao: false });
    for (let x = hx0 + 1; x < hx1 - 0.5; x += 2.6) G.slab(x, x + 1.6, RY - 0.04, RY, (U.z0 + U.z1) / 2 - 0.25, (U.z0 + U.z1) / 2 + 0.25, hex('#FFF8EC'), { ao: false });
    // 楼梯背面（站台上 x<-20 那头看到的墙面）：白石 + 出站牌
    Pv.slab(hx0 - 0.02, hx0, y, CY, U.z0, U.z1, STONE, { ao: false });
    this.atlas.quad(hx0 - 0.03, y + 2.3, (U.z0 + U.z1) / 2, 3.2, 0.62, -Math.PI / 2, this.atlas.draw(3.2, 0.62, this.exitPaint('出站 · 站厅', 'Exit · Concourse')));
    // 楼梯脚上方吊牌（面向 +x，远处就能看见）
    const zm = (U.z0 + U.z1) / 2;
    this.atlas.quad(U.x1 + 0.6, y + 3.2, zm, 3.6, 0.7, Math.PI / 2, this.atlas.draw(3.6, 0.7, this.exitPaint('出站 · 站厅', 'Exit · Concourse')));
    Pv.slab(U.x1 + 0.56, U.x1 + 0.59, y + 2.83, y + 3.57, zm - 1.85, zm + 1.85, hex('#1B2530'), { ao: false });
    for (const s of [-1.5, 1.5]) k.metal.tube([U.x1 + 0.58, y + 3.55, zm + s], [U.x1 + 0.58, CY, zm + s], 0.03, hex('#9AA1A8'), 6);
    // 楼梯顶：通道（x -24.3..-20，z -8..hz1）连到站厅西北角
    k.floorWithHoles(hx0 - 4.3, hx0, -8, hz1, HY - 0.3, HY, hex(th.floor), [], true, 'floor');
    Pv.slab(hx0 - 4.6, hx0 - 4.3, HY - 0.3, RY, -18, hz1 + 0.3, WALL, { ao: false }); k.colSlab(hx0 - 4.6, hx0 - 4.3, HY - 0.3, RY, -18, hz1 + 0.3);
    Pv.slab(hx0, hx0 + 0.3, HY - 0.3, RY, -7.7, hz0 - 0.3, WALL, { ao: false }); k.colSlab(hx0, hx0 + 0.3, HY - 0.3, RY, -7.7, hz0 - 0.3);
    Pv.slab(hx0 - 4.3, hx0 - 4.28, HY, HY + 1.4, -8, hz1, STONE, { ao: false });
    G.slab(hx0 - 2.4, hx0 - 1.9, RY - 0.04, RY, -7.5, hz1 - 0.5, hex('#FFF8EC'), { ao: false });
  }
  psdBuild(P, side) {
    const k = this.kit, y = P.y, z = side.psdZ, sgn = side.key === 'A' ? -1 : 1, lc = this.N.LINES[P.line].color, Pv = k.solid;
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
    k.stairs('x', this.XF.x0, XM_PY2, this.XF.x1, XM_PY, this.XF.z0, this.XF.zc - 0.12, XM_PY2, '#D6D1C7', { nosing: '#4A3A32' });
    k.stairs('x', this.XF.x0, XM_PY2, this.XF.x1, XM_PY, this.XF.zc + 0.12, this.XF.z1, XM_PY2, '#8C9298', { nosing: '#F2C230' });
    { const L = this.XF.x1 - this.XF.x0, dy = XM_PY - XM_PY2, len = Math.hypot(L, dy), ang = Math.atan2(dy, L), mx = (this.XF.x0 + this.XF.x1) / 2, my = (XM_PY + XM_PY2) / 2;
      k.glass.box(mx, my + 0.5, this.XF.zc, len, 0.9, 0.03, hex('#D6EEF8'), 0, 0, ang);
      k.metal.box(mx, my + 0.98, this.XF.zc, len, 0.07, 0.16, hex('#C4CBD2'), 0, 0, ang);
      k.metal.box(mx, my + 0.06, this.XF.zc, len, 0.12, 0.24, hex('#3A3F45'), 0, 0, ang); }
    // 洞口栏杆（两侧 + 楼梯起点对面一头），白石栏板 + 海蓝扶手
    // 洞口：玻璃栏板 + 不锈钢扶手（两侧 + 尽头），能看到下面的踏步和 2 号线站台
    for (const z of [this.XF.z0 - 0.05, this.XF.z1 + 0.05]) { k.rail(this.XF.x0, z, this.XF.x1, z, XM_PY); k.glass.slab(this.XF.x0, this.XF.x1, XM_PY + 0.05, XM_PY + 1.0, z - 0.015, z + 0.015, hex('#D6EEF8')); k.metal.slab(this.XF.x0, this.XF.x1, XM_PY + 1.0, XM_PY + 1.07, z - 0.05, z + 0.05, hex('#C4CBD2'), { ao: false }); k.metal.slab(this.XF.x0, this.XF.x1, XM_PY, XM_PY + 0.06, z - 0.05, z + 0.05, hex('#9AA1A8'), { ao: false }); }
    k.rail(this.XF.x0, this.XF.z0, this.XF.x0, this.XF.z1, XM_PY);
    k.glass.slab(this.XF.x0 - 0.015, this.XF.x0 + 0.015, XM_PY + 0.05, XM_PY + 1.0, this.XF.z0, this.XF.z1, hex('#D6EEF8'));
    k.metal.slab(this.XF.x0 - 0.05, this.XF.x0 + 0.05, XM_PY + 1.0, XM_PY + 1.07, this.XF.z0, this.XF.z1, hex('#C4CBD2'), { ao: false });
    // 楼梯井侧面：浅色石材（不再是红/蓝色块），一道灯带照亮踏步
    for (const z of [this.XF.z0 - 0.3, this.XF.z1 + 0.3]) Pv.slab(this.XF.x0 - 0.2, this.XF.x1, XM_PY2 + 4.2, XM_PY - 1.3, z - 0.1, z + 0.1, hex('#E4DDD0'), { ao: false });
    for (const z of [this.XF.z0 - 0.18, this.XF.z1 + 0.18]) k.glow.slab(this.XF.x0, this.XF.x1, XM_PY - 1.5, XM_PY - 1.42, z - 0.03, z + 0.03, hex('#FFF4DE'), { ao: false });
    const sign = (to) => (c, pw, ph) => {
      c.fillStyle = '#1B2530'; c.fillRect(0, 0, pw, ph);
      const L = this.N.LINES[to]; c.fillStyle = L.color; c.fillRect(10, 10, ph - 20, ph - 20);
      c.fillStyle = '#FFF'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.font = `800 ${ph * 0.55}px ${FONT_EN}`; c.fillText(String(to), 10 + (ph - 20) / 2, ph * 0.54);
      c.textAlign = 'left'; c.font = `800 ${ph * 0.34}px ${FONT}`; c.fillText(`换乘 ${to}号线`, ph * 1.05, ph * 0.38);
      c.fillStyle = '#C9D2DB'; c.font = `600 ${ph * 0.17}px ${FONT_EN}`; c.fillText(`Transfer to Line ${to}  ·  往 ${Object.values(L.dirs).map(d => d.zh).join(' / ')}`, ph * 1.05, ph * 0.74);
    };
    // 楼梯脚在 x0（L2），顶在 x1（L1）：从 -x 看过去能看到踏步/踢面往上；L1 牌在洞口近端，L2 牌在楼梯脚
    { const ls = this.s.lines; this.atlas.quad(this.XF.x0 - 0.6, XM_PY + 3.3, this.XF.zc, 5.2, 1.0, -Math.PI / 2, this.atlas.draw(5.2, 1.0, sign(ls[1])));
    this.atlas.quad(this.XF.x0 - 0.8, XM_PY2 + 3.3, this.XF.zc, 5.2, 1.0, -Math.PI / 2, this.atlas.draw(5.2, 1.0, sign(ls[0]))); }
  }
  /** 普通站：小站厅 + 出入口（游戏里出到黑处即可） */
  buildConcourse() {
    const k = this.kit, y = XM_PY + 6.5, Pv = k.solid, G = k.glow, th = this.th;
    // 站厅 x -24.3..20：西北角（x -24.3..-20）接楼梯通道下站台
    k.floorWithHoles(-24.3, 20, -18, -8, y - 0.3, y, hex(th.floor), [], true, 'floor');
    const ex = this.N.EXITS[this.code];
    if (!ex) { Pv.slab(-24.6, 20, y, y + 3.5, -18.4, -18, hex(th.wall)); k.g(this.dadoG).slab(-24.3, 20, y, y + 1.4, -18.35, -18.05, hex(th.dado), { ao: false }); k.colSlab(-24.6, 20, y, y + 3.5, -18.4, -18); }
    else {
      // 南墙在出口通道处开口（宽 4.4 m）
      const g0 = ex.x - 2.2, g1 = ex.x + 2.2;
      for (const [a0, a1] of [[-24.6, g0], [g1, 20]]) { Pv.slab(a0, a1, y, y + 3.5, -18.4, -18, hex(th.wall)); k.g(this.dadoG).slab(a0, a1, y, y + 1.4, -18.35, -18.05, hex(th.dado), { ao: false }); k.colSlab(a0, a1, y, y + 3.5, -18.4, -18); }
      this.buildExit(ex, y);
    }
    Pv.slab(20, 20.4, y, y + 3.5, -18.4, -7.7, hex(th.wall)); k.colSlab(20, 20.4, y, y + 3.5, -18.4, -7.7);
    // 北墙（站台在它北边的地下），西头留通道口；墙裙红砖
    Pv.slab(-20, 20.4, y, y + 3.5, -8, -7.7, hex(th.wall)); k.colSlab(-20, 20.4, y, y + 3.5, -8, -7.7);
    k.g(this.dadoG).slab(-20, 20, y, y + 1.4, -8.05, -8, hex(th.dado), { ao: false });
    // 站厅吊顶 + 灯带
    Pv.slab(-24.6, 20.4, y + 3.5, y + 3.75, -18.4, -7.7, hex('#F4F2EE'), { ao: false });
    for (const z of [-15.5, -10.5]) G.slab(-23.5, 19.5, y + 3.46, y + 3.5, z - 0.2, z + 0.2, hex('#FFF8EC'), { ao: false });
    // 通道口上方：去站台的牌（面向站厅 -z 看过来的人）
    const L = this.N.LINES[this.s.lines[0]];
    const paint = (c, pw, ph) => {
      c.fillStyle = '#1B2530'; c.fillRect(0, 0, pw, ph);
      c.fillStyle = L.color; c.fillRect(8, 8, ph - 16, ph - 16);
      c.fillStyle = L.ink; c.textAlign = 'center'; c.textBaseline = 'middle'; c.font = `800 ${ph * 0.5}px ${FONT_EN}`; c.fillText(String(L.id), 8 + (ph - 16) / 2, ph * 0.54);
      c.fillStyle = '#FFF'; c.textAlign = 'left'; c.font = `800 ${ph * 0.34}px ${FONT}`; c.fillText('往站台', ph * 1.0, ph * 0.38);
      c.fillStyle = '#C9D2DB'; c.font = `600 ${ph * 0.17}px ${FONT_EN}`; c.fillText('To platforms', ph * 1.0, ph * 0.74);
    };
    this.atlas.quad(-22.15, y + 2.85, -8.3, 3.6, 0.7, Math.PI, this.atlas.draw(3.6, 0.7, paint));
    Pv.slab(-23.95, -20.35, y + 2.5, y + 3.2, -8.28, -8.24, hex('#1B2530'), { ao: false });   // 牌子背面（从通道里看不到反字）
  }
  /** 出口通道：站厅南墙开口 → 平走一段 → 楼梯上到地面（y=0）→ 顶上是“出站”的亮光；走到顶（z < -35）就进街区 */
  buildExit(ex, y) {
    const k = this.kit, Pv = k.solid, th = this.th, x0 = ex.x - 2.2, x1 = ex.x + 2.2, W = hex('#E9E4DA');
    k.floorWithHoles(x0, x1, -22, -18.4, y - 0.3, y, hex(th.floor), [], true, 'floor');
    k.stairs('z', -22, y, -34, 0, x0 + 0.05, x1 - 0.05, y, '#D6D1C7');
    k.floorWithHoles(x0, x1, -37, -34, -0.3, 0, hex(th.floor), [], true, 'floor');
    for (const [a, b] of [[x0 - 0.3, x0], [x1, x1 + 0.3]]) { Pv.slab(a, b, y, 3.6, -37, -18.4, W, { ao: false }); k.colSlab(a, b, y, 3.6, -37, -18.4); }
    Pv.slab(x0 - 0.3, x1 + 0.3, 3.6, 3.9, -37.3, -18.4, hex('#F4F2EE'), { ao: false });
    Pv.slab(x0, x1, y + 3.2, y + 3.5, -22, -18.4, hex('#F4F2EE'), { ao: false });
    Pv.slab(x0 - 0.3, x1 + 0.3, -0.3, 3.6, -37.3, -37, hex('#F4F2EE'), { ao: false }); k.colSlab(x0, x1, 0, 3.6, -37.4, -37);
    k.glow.slab(x0 + 0.2, x1 - 0.2, 0.2, 3.3, -36.98, -36.94, hex('#FFF8E8'), { ao: false });   // 地面出口的天光
    for (let z = -33; z < -19; z += 3.2) k.glow.slab(ex.x - 0.15, ex.x + 0.15, 3.55, 3.6, z, z + 2, hex('#FFF6E0'), { ao: false });
    // 站厅里的出口牌（黄底黑字，地铁出口导向）
    const lc = this.N.LINES[ex.line].color;
    const paint = (c, pw, ph) => {
      c.fillStyle = '#F2C230'; c.fillRect(0, 0, pw, ph); c.fillStyle = '#1B2530'; c.fillRect(8, 8, ph - 16, ph - 16);
      c.fillStyle = '#F2C230'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.font = `800 ${ph * (ex.n.length > 1 ? 0.36 : 0.48)}px ${FONT_EN}`; c.fillText(ex.n || '出', 8 + (ph - 16) / 2, ph * 0.52);
      c.fillStyle = '#1B2530'; c.textAlign = 'left'; c.font = `800 ${ph * 0.3}px ${FONT}`; c.fillText(`${ex.n ? this.N.exitZh(ex.n) : '出口'}${ex.road ? '  ' + ex.road : ''}`, ph * 0.95, ex.to.length ? ph * 0.36 : ph * 0.5);
      if (ex.to.length) { c.font = `600 ${ph * 0.2}px ${FONT}`; c.fillText(ex.to.join(' · '), ph * 0.95, ph * 0.72); }
    };
    this.atlas.quad(ex.x, y + 2.9, -18.5, 4.2, 0.85, 0, this.atlas.draw(4.2, 0.85, paint));
    k.g('band').slab(x0, x1, y + 3.3, y + 3.45, -18.55, -18.45, hex(lc), { ao: false });
    // 有真实出入口表的站：站厅南墙挂一块“出入口信息”牌（全部出口；能走出去的那个高亮）
    const tab = this.N.TABLE[this.code];
    if (tab) {
      const info = (c, pw, ph) => {
        c.fillStyle = '#1B2530'; c.fillRect(0, 0, pw, ph); c.fillStyle = '#F2C230'; c.fillRect(0, 0, pw, ph * 0.16);
        c.fillStyle = '#1B2530'; c.textBaseline = 'middle'; c.textAlign = 'left'; c.font = `800 ${ph * 0.1}px ${FONT}`; c.fillText('出入口信息  Exits', pw * 0.03, ph * 0.085);
        const rh = ph * 0.82 / tab.length;
        tab.forEach(([n, to], i) => {
          const yy = ph * 0.17 + rh * i, on = n === ex.n;
          if (on) { c.fillStyle = '#2E4A66'; c.fillRect(0, yy, pw, rh); }
          c.fillStyle = '#F2C230'; c.fillRect(pw * 0.03, yy + rh * 0.12, rh * 1.3, rh * 0.76);
          c.fillStyle = '#1B2530'; c.textAlign = 'center'; c.font = `800 ${rh * 0.55}px ${FONT_EN}`; c.fillText(n, pw * 0.03 + rh * 0.65, yy + rh * 0.52);
          c.fillStyle = on ? '#FFFFFF' : '#D5DCE3'; c.textAlign = 'left'; c.font = `${on ? 800 : 600} ${rh * 0.5}px ${FONT}`;
          c.fillText(to + (on ? '  ← 本出口' : ''), pw * 0.03 + rh * 1.6, yy + rh * 0.52);
        });
      };
      Pv.slab(-6.8, -1.2, y + 0.9, y + 3.1, -18.0, -17.92, hex('#1B2530'), { ao: false });
      this.atlas.quad(-4, y + 2.0, -17.9, 5.4, 2.0, 0, this.atlas.draw(5.4, 2.0, info, 90));
    }
  }
  /** 厦门北站：站台 -x 端墙门洞 → 换乘通道（x -93..-36，z -83..-77，平地 -13）→ 楼梯下半段（x -93..-101.2）
   *  接上国铁地铁站厅里的楼梯上半段（xmnStation：x -101.2..-107，顶在 -6.5）。全程走路，不传送。 */
  linkRailway() {
    const k = this.kit, y = XM_PY, Pv = k.solid, G = k.glow, P = this.platforms[0], th = this.th;
    const z0 = P.zc - 3, z1 = P.zc + 3, xa = -XM_HALL_X, xs = -93, xt = -101.195, yt = -9.195, cy = -9.7;
    const WALL = hex('#E9E4DA'), STONE = hex('#E4DDD0'), L1 = hex(this.N.LINES[1].color);
    // 楼梯下半段（踏步高 0.1585 / 宽 0.341，和上半段一样）
    k.stairs('x', xs, y, xt, yt, z0, z1, y, '#D6D1C7', { nosing: '#4A3A32' });
    for (const [a0, a1] of [[z0 - 0.3, z0], [z1, z1 + 0.3]]) { Pv.slab(xt, xs, y, -6.8, a0, a1, WALL, { ao: false }); k.colSlab(xt, xs, y, -6.8, a0, a1); }
    Pv.slab(xs - 0.3, xs, cy, -6.8, z0, z1, WALL, { ao: false });   // 楼梯口上方的墙头（通道顶 → 站厅地面）
    for (const z of [z0 + 0.02, z1 - 0.02]) G.slab(xt, xs, -7.4, -7.32, z - 0.02, z + 0.02, hex('#FFF4DE'), { ao: false });
    // 换乘通道
    k.floorWithHoles(xs, xa, z0, z1, y - 0.3, y, hex(th.floor), [], true, 'floor');
    for (const [a0, a1] of [[z0 - 0.3, z0], [z1, z1 + 0.3]]) {
      Pv.slab(xs, xa, y, cy, a0, a1, WALL, { ao: false }); k.colSlab(xs, xa, y, cy, a0, a1);
      const f = a0 < z0 ? a1 + 0.02 : a0 - 0.02;
      Pv.slab(xs, xa, y, y + 1.2, Math.min(f, a0 < z0 ? a1 : a0), Math.max(f, a0 < z0 ? a1 : a0), STONE, { ao: false });
      Pv.slab(xs, xa, y + 1.2, y + 1.4, Math.min(f, a0 < z0 ? a1 : a0) - 0.005, Math.max(f, a0 < z0 ? a1 : a0) + 0.005, L1, { ao: false });
    }
    Pv.slab(xs, xa, cy, cy + 0.25, z0 - 0.3, z1 + 0.3, hex('#F4F2EE'), { ao: false });
    for (let x = xs + 1; x < xa - 1; x += 4) G.slab(x, x + 2.6, cy - 0.04, cy, P.zc - 0.25, P.zc + 0.25, hex('#FFF8EC'), { ao: false });
    // 出站牌：站台端头门洞上方（面向站台 +x），通道中段一块
    this.atlas.quad(xa + 1.5, y + 3.25, P.zc, 4.4, 0.85, Math.PI / 2, this.atlas.draw(4.4, 0.85, this.exitPaint('出站 · 国铁换乘', 'Exit · Railway transfer')));
    Pv.slab(xa + 1.46, xa + 1.49, y + 2.8, y + 3.7, P.zc - 2.25, P.zc + 2.25, hex('#1B2530'), { ao: false });
    for (const s of [-1.8, 1.8]) k.metal.tube([xa + 1.48, y + 3.68, P.zc + s], [xa + 1.48, y + 4.2, P.zc + s], 0.03, hex('#9AA1A8'), 6);
    this.atlas.quad(-18, y + 3.4, P.zc, 4.4, 0.85, Math.PI / 2, this.atlas.draw(4.4, 0.85, this.exitPaint('出站 · 国铁换乘', 'Exit · Railway transfer')));
    Pv.slab(-18.04, -18.01, y + 2.95, y + 3.85, P.zc - 2.25, P.zc + 2.25, hex('#1B2530'), { ao: false });
    this.atlas.quad(-64, cy - 0.45, P.zc, 4.4, 0.85, Math.PI / 2, this.atlas.draw(4.4, 0.85, this.exitPaint('出站 · 国铁换乘', 'Exit · Railway transfer')));
    Pv.slab(-64.04, -64.01, cy - 0.9, cy, P.zc - 2.25, P.zc + 2.25, hex('#1B2530'), { ao: false });
  }
  zoneOf(p) {
    const lx = p.x - this.N.O.x, net = this.N.net;
    for (const P of this.platforms) {
      if (Math.abs(p.y - P.y) < 2.2 && Math.abs(lx) < XM_HALL_X && Math.abs(p.z - P.zc) < XM_WALL)
        return { kind: 'platform', P, code: this.code, net };
    }
    if (p.y > XM_PY + 4 && p.y < XM_PY + 9 && lx > -25 && lx < 22) return { kind: 'concourse', code: this.code, net };
    return { kind: net, code: this.code, net };
  }
  platformFor(line) { return this.platforms.find(p => p.line === line); }
  dispose() {
    if (this.atlas) this.atlas.dispose();
    this.kit.root.getChildMeshes(false).forEach(m => m.dispose());
    this.kit.root.dispose();
  }
  info() { return { code: this.code, theme: this.themeKey, platforms: this.platforms.map(p => ({ line: p.line, y: p.y, zc: p.zc, sides: Object.keys(p.sides) })) }; }
}
