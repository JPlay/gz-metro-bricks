/*
 * 福州南站 · 站房（东站房）+ 出站层 + 地铁换乘 + 东 / 西广场。
 * 独立区域：第一次在福州南站下车才建（js/world/fzs.js FzsPlatform.show('solo')），只在福州这边打开。
 * 坐标沿用厦门北站房那一套（js/world/xmnStation.js XST，站台坐标、原点 FO），所以站台楼梯 / 出站层 / 换乘通道 / 地铁站厅的位置和厦门北一样，
 * 地铁那边（js/world/fzMetro.js，福州火车南站）也能直接接上（XmStation.linkRailway）。
 * 和厦门北不一样的地方（依据 /workspace/fuzhou-research/brief.md）：
 *   - 东站房：白色“船帆”屋面（一排起伏的帆形）、波浪形玻璃幕墙、金色“榕树”树形柱（主干 + 多级分叉），4 号 / 7 号进站口；
 *   - 站房里面能走进去：候车室（蓝色座椅、金色榕树柱、发车显示屏、检票口暂停检票 —— 进站坐车走站台楼梯，不走候车室）；
 *   - 出站层：出站口 5（“免安检换乘地铁”）→ 换乘通道 → 地铁站厅（1 号线红 #CB333B、5 号线紫 #893B67）；
 *   - 出口：F / A / B 从换乘通道南边上到东广场；D2 从地铁站厅往北，穿过股道下面上到西广场（老站房在西广场北边，只做背景）。
 *   出口位置是示意（未核实）；老站房 3 号进站口 2023-12-25 起关闭，不做。福州地铁标志是简化画法，不是官方图形。
 */
import { Kit, FONT, FONT_EN } from './kit.js';
import { hex } from '../core/geo.js';
import { FoodAtlas } from '../game/food-art.js';
import { XST, noProbe, rr, arrow, exitIcon, bigText } from './xmnStation.js';
import { FZS_EXITS } from '../data/fz-exits.js';
import { FO } from './fzZones.js';

const HY = XST.HY, HC = XST.HC;
const L1 = '#CB333B', L5 = '#893B67', NAVY = '#163A5F', GOLD = '#C9A24A';
/** 福州南站房外形 / 出口通道的位置（站台坐标）。E7 / E4 = 两个进站口的 x 中心 */
export const FZS = {
  face: XST.face, back: -97.6, x0: -90, x1: 80, E7: -82, E4: 20, ew: 8,
  exits: FZS_EXITS, exW: 3, exZ0: XST.tr.z1, exZ1: -64, exTop: -50,
  d2: { z0: XST.metro.z0, z1: -150, top: -164 }, square: { x0: -110, x1: 80, z0: -194, z1: -137.5 }, west: { x0: -70, x1: 70, z0: -194, z1: -180 }
};
const C = {
  floor: hex('#D6D7D3'), floorM: hex('#E2E2DE'), wall: hex('#F2F2EF'), granite: hex('#8F9395'), stone: hex('#E6E3DC'), gold: hex(GOLD), goldD: hex('#A88536'),
  ceil: hex('#F4F4F2'), slat: hex('#C9CDD1'), glass: hex('#7FA9C6'), mull: hex('#F2F3F1'), roof: hex('#F6F7F8'), roofU: hex('#D7DEE5'), dark: hex('#3A3F45'),
  gate: hex('#C9CED3'), l1: hex(L1), l5: hex(L5), pave: hex('#CFCBC3'), trunk: hex('#6F5B44'), leaf: hex('#3F6E3A'), leaf2: hex('#4F7F45'), lamp: hex('#5B6066'),
  seat: hex('#2E5E9E'), hall: hex('#E9E6E0')
};

/* ---------- 牌子（铁路深蓝；出口绿；福州地铁 1 号线红、5 号线紫） ---------- */
/** 福州地铁标志（简化示意，不是官方图形）：红色圆角方块 + 白色“M”，底下一道波浪（闽江） */
export function fzLogo(c, x, y, s) {
  c.fillStyle = '#C8102E'; rr(c, x, y, s, s, s * 0.18); c.fill();
  c.strokeStyle = '#FFFFFF'; c.lineWidth = s * 0.11; c.lineJoin = 'round'; c.lineCap = 'round';
  c.beginPath(); c.moveTo(x + s * 0.2, y + s * 0.7); c.lineTo(x + s * 0.2, y + s * 0.24); c.lineTo(x + s * 0.5, y + s * 0.52); c.lineTo(x + s * 0.8, y + s * 0.24); c.lineTo(x + s * 0.8, y + s * 0.7); c.stroke();
  c.lineWidth = s * 0.07; c.beginPath(); c.moveTo(x + s * 0.16, y + s * 0.84); c.quadraticCurveTo(x + s * 0.33, y + s * 0.74, x + s * 0.5, y + s * 0.84); c.quadraticCurveTo(x + s * 0.67, y + s * 0.94, x + s * 0.84, y + s * 0.84); c.stroke();
}
function lineBadge(c, x, y, s, n) { c.fillStyle = n === 5 ? L5 : L1; rr(c, x, y, s, s, s * 0.18); c.fill(); c.fillStyle = '#FFFFFF'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.font = `800 ${s * 0.74}px ${FONT_EN}`; c.fillText(String(n), x + s / 2, y + s * 0.55); }
function letterBadge(c, x, y, s, t) { c.fillStyle = '#FFFFFF'; rr(c, x, y, s, s, s * 0.14); c.fill(); c.fillStyle = '#1E8E4E'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.font = `800 ${s * (t.length > 1 ? 0.5 : 0.7)}px ${FONT_EN}`; c.fillText(t, x + s / 2, y + s * 0.55); }
/** 横向导向牌：parts = [{a}, {exit}, {metro}, {l:1|5}, {letter:'F'}, {zh, en, col}, {gap}, {bar}] */
export function board(parts, bg = NAVY) {
  return (c, pw, ph) => {
    c.fillStyle = bg; c.fillRect(0, 0, pw, ph); c.strokeStyle = 'rgba(255,255,255,0.85)'; c.lineWidth = Math.max(2, ph * 0.03); c.strokeRect(ph * 0.04, ph * 0.04, pw - ph * 0.08, ph - ph * 0.08);
    const s = ph * 0.62, y = (ph - s) / 2, W = [];
    for (const q of parts) {
      if (q.zh) { c.font = `700 ${ph * 0.36}px ${FONT}`; const a = c.measureText(q.zh).width; c.font = `500 ${ph * 0.18}px ${FONT_EN}`; const b = q.en ? c.measureText(q.en).width : 0; W.push(Math.max(a, b) + ph * 0.18); }
      else if (q.gap !== undefined) W.push(ph * q.gap); else if (q.bar) W.push(ph * 0.25); else W.push(s + ph * 0.14);
    }
    let x = Math.max(ph * 0.12, (pw - W.reduce((a, b) => a + b, 0)) / 2);
    parts.forEach((q, i) => {
      if (q.a) arrow(c, x, y, s, q.a, q.acol || '#FFFFFF');
      else if (q.exit) exitIcon(c, x, y, s);
      else if (q.metro) fzLogo(c, x, y, s);
      else if (q.l) lineBadge(c, x, y, s, q.l);
      else if (q.letter) letterBadge(c, x, y, s, q.letter);
      else if (q.bar) { c.fillStyle = 'rgba(255,255,255,0.55)'; c.fillRect(x + ph * 0.11, ph * 0.16, ph * 0.03, ph * 0.68); }
      else if (q.zh) { c.fillStyle = q.col || '#FFFFFF'; c.textAlign = 'left'; c.textBaseline = 'middle'; c.font = `700 ${ph * 0.36}px ${FONT}`; c.fillText(q.zh, x + ph * 0.09, q.en ? ph * 0.38 : ph * 0.52); if (q.en) { c.font = `500 ${ph * 0.18}px ${FONT_EN}`; c.fillText(q.en, x + ph * 0.09, ph * 0.73); } }
      x += W[i];
    });
  };
}
/** 地铁入口门楣：标志 + 福州地铁 + 1 号线红带 / 5 号线紫带 */
function metroPortal(c, pw, ph) {
  c.fillStyle = '#F7F7F5'; c.fillRect(0, 0, pw, ph); c.fillStyle = L1; c.fillRect(0, ph * 0.66, pw / 2, ph * 0.34); c.fillStyle = L5; c.fillRect(pw / 2, ph * 0.66, pw / 2, ph * 0.34);
  const s = ph * 0.52; fzLogo(c, pw * 0.05, ph * 0.07, s);
  c.fillStyle = '#1D3F73'; c.textAlign = 'left'; c.textBaseline = 'middle'; c.font = `800 ${ph * 0.28}px ${FONT}`; c.fillText('福州地铁', pw * 0.05 + s * 1.2, ph * 0.26);
  c.font = `600 ${ph * 0.13}px ${FONT_EN}`; c.fillText('FUZHOU METRO', pw * 0.05 + s * 1.2, ph * 0.5);
  c.textAlign = 'right'; c.font = `700 ${ph * 0.2}px ${FONT}`; c.fillText('福州火车南站', pw * 0.95, ph * 0.24); c.font = `500 ${ph * 0.11}px ${FONT_EN}`; c.fillText('Fuzhou South Railway Station', pw * 0.95, ph * 0.48);
  c.fillStyle = '#FFFFFF'; c.textAlign = 'center'; c.font = `800 ${ph * 0.16}px ${FONT}`;
  c.fillText('1号线 象峰 ⇄ 三江口', pw * 0.25, ph * 0.77); c.fillText('5号线 荆溪厚屿 ⇄ 福州火车南站', pw * 0.75, ph * 0.77);
  c.font = `600 ${ph * 0.1}px ${FONT_EN}`; c.fillText('Line 1  Xiangfeng ⇄ Sanjiangkou', pw * 0.25, ph * 0.92); c.fillText('Line 5  Jingxi Houyu ⇄ Fuzhou South Railway Station', pw * 0.75, ph * 0.92);
}
/** 东广场远景：福州的山（鼓山方向）+ 高楼，没有红砖厝 */
function backdrop(c, pw, ph) {
  const g = c.createLinearGradient(0, 0, 0, ph * 0.7); g.addColorStop(0, '#7FB0DC'); g.addColorStop(1, '#E6EEF3'); c.fillStyle = g; c.fillRect(0, 0, pw, ph);
  c.fillStyle = '#8FA8A0'; c.beginPath(); c.moveTo(0, ph); for (let i = 0; i <= 14; i++) c.lineTo(pw * i / 14, ph * (0.42 + 0.16 * Math.abs(Math.sin(i * 0.9 + 0.7)))); c.lineTo(pw, ph); c.fill();
  const cols = ['#EEF1F3', '#DCE5EC', '#E9E4DA', '#CFDCE6'];
  for (let i = 0, x = 4; x < pw; i++) { const w = 12 + (i * 13) % 18, h = ph * (0.14 + ((i * 7) % 11) / 30); c.fillStyle = cols[i % 4]; c.fillRect(x, ph * 0.76 - h, w, h);
    c.fillStyle = 'rgba(60,85,110,0.42)'; for (let y = ph * 0.76 - h + 4; y < ph * 0.74; y += 5) for (let xx = x + 2; xx < x + w - 3; xx += 4) c.fillRect(xx, y, 2, 2.5); x += w + 4 + (i * 11) % 14; }
  c.fillStyle = '#7C9C74'; c.fillRect(0, ph * 0.76, pw, ph * 0.24);
}

export class FzsStation {
  constructor(scene) {
    this.scene = scene;
    const k = this.kit = new Kit(scene, 'fzsSt'); k.root.position.set(FO.x, 0, 0);
    const at = this.atlas = new FoodAtlas(scene, 2048);
    this.build(k, at);
    k.finish(true); at.finish(k.root, 'fzsStSigns'); noProbe(k.root);
    this.root = k.root;
  }
  setEnabled(v) { this.root.setEnabled(v); }
  hang(x, y, z, w, h, a, paint, top = HC, back) {
    const k = this.kit, at = this.atlas, nx = Math.sin(a), nz = Math.cos(a), uv = at.draw(w, h, paint);
    at.quad(x, y, z, w, h, a, uv);
    if (back !== undefined) at.quad(x - nx * 0.08, y, z - nz * 0.08, w, h, a + Math.PI, back ? at.draw(w, h, back) : uv);
    k.solid.box(x - nx * 0.04, y, z - nz * 0.04, w + 0.08, h + 0.08, 0.06, hex('#1B2530'), a, 0, 0, 1, { ao: false });
    if (top !== null) for (const s of [-1, 1]) k.metal.tube([x - nx * 0.04 - nz * s * w * 0.36, y + h / 2, z - nz * 0.04 + nx * s * w * 0.36], [x - nx * 0.04 - nz * s * w * 0.36, top, z - nz * 0.04 + nx * s * w * 0.36], 0.035, hex('#9AA1A8'), 6);
  }
  /** 金色榕树柱：主干 + 两级分叉（顶到 yTop），几根细“气根” */
  banyan(x, z, y0, yFork, yTop, spread, dia = 0.9, collide = true) {
    const P = this.kit.solid, k = this.kit;
    P.cyl(x, (y0 + yFork) / 2, z, dia, yFork - y0, C.gold, 12, 0, 0, 0, dia * 0.8);
    for (let i = 0; i < 4; i++) {
      const a = Math.PI / 4 + i * Math.PI / 2, m = [x + Math.cos(a) * spread * 0.45, yFork + (yTop - yFork) * 0.55, z + Math.sin(a) * spread * 0.32];
      P.tube([x, yFork - 0.3, z], m, dia * 0.42, C.gold, 7);
      for (const da of [-0.45, 0, 0.45]) P.tube(m, [x + Math.cos(a + da) * spread, yTop, z + Math.sin(a + da) * spread * 0.7], dia * 0.24, C.gold, 6);
      k.solid.tube(m, [m[0] + 0.2, m[1] - (yFork - y0) * 0.45, m[2]], 0.06, C.goldD, 4);   // 气根
    }
    if (collide) k.colSlab(x - dia / 2, x + dia / 2, y0, yFork, z - dia / 2, z + dia / 2);
  }
  build(k, at) {
    const P = k.solid, G = k.glow, M = k.metal, GR = k.g('granite'), CE = k.g('ceiling');
    const { hall: H, tr: T, metro: MT, stair: S } = XST, hole = [-25.2, -11.2, -124.4, -119.6];
    /* ===== 出站层（地下）：地面 / 吊顶 / 墙 ===== */
    k.floorWithHoles(H.x0, H.x1, H.z0, H.z1, HY - 0.3, HY, C.floor, [], true, 'floor');
    k.floorWithHoles(T.x0, T.x1, T.z0, T.z1, HY - 0.3, HY, C.floor, [], true, 'floor');
    k.floorWithHoles(MT.x0, MT.x1, MT.z0, MT.z1, HY - 0.3, HY, C.floorM, [[-107, -101, -83, -77]], true, 'floor');
    for (const r of [[H.x0, H.x1, H.z0, H.z1], [T.x0, T.x1, T.z0, T.z1], [MT.x0, MT.x1, MT.z0, MT.z1]]) k.floorWithHoles(r[0], r[1], r[2], r[3], HC, HC + 0.25, C.ceil, r[0] === H.x0 ? [hole] : [], false, 'ceiling');
    // 吊顶：浅灰金属格栅 + 灯带
    for (let z = H.z0 + 1.5; z < H.z1; z += 1.8) { const over = z > hole[2] - 0.3 && z < hole[3] + 0.3; for (const [x0, x1] of over ? [[H.x0, hole[0]], [hole[1], H.x1]] : [[H.x0, H.x1]]) M.slab(x0, x1, HC - 0.22, HC, z - 0.06, z + 0.06, C.slat, { ao: false }); }
    for (const x of [-36, -20, -4]) G.slab(x - 0.25, x + 0.25, HC - 0.26, HC - 0.22, H.z0 + 1, H.z1 - 1, hex('#FFF8EC'), { ao: false });
    for (const z of [T.z0 + 2, T.z1 - 2]) G.slab(T.x0, T.x1, HC - 0.04, HC, z - 0.2, z + 0.2, hex('#FFF8EC'), { ao: false });
    G.slab(MT.x0 + 1, MT.x1 - 0.5, HC - 0.04, HC, -82, -78, hex('#FFFFFF'), { ao: false });
    // 墙：灰色花岗岩墙裙 + 金色压条，上部白墙
    const wall = (x0, x1, z0, z1, top = HC) => {
      k.block(x0, x1, HY, top, z0, z1, C.wall, true, 'paint', { ao: false });
      const dx = x1 - x0 < z1 - z0 ? 0.04 : 0, dz = dx ? 0 : 0.04;
      GR.slab(x0 - dx, x1 + dx, HY, HY + 1.5, z0 - dz, z1 + dz, C.granite, { ao: false });
      P.slab(x0 - dx * 1.6, x1 + dx * 1.6, HY + 1.5, HY + 1.6, z0 - dz * 1.6, z1 + dz * 1.6, C.gold, { ao: false });
    };
    wall(H.x0, H.x1, H.z0 - 0.4, H.z0); wall(H.x1, H.x1 + 0.4, H.z0, H.z1);
    wall(H.x0 - 0.4, H.x0, H.z0, T.z0); wall(H.x0 - 0.4, H.x0, T.z1, H.z1);
    wall(H.x0, S.x0, H.z1, H.z1 + 0.4); wall(S.x1, H.x1, H.z1, H.z1 + 0.4);
    wall(T.x0, T.x1, T.z0 - 0.4, T.z0);
    // 换乘通道南墙：F / A / B 出口通道开口（门楣上面一块出口牌）
    const W2 = FZS.exW / 2, exs = FZS.exits.filter(e => e.side === 'S').sort((a, b) => a.x - b.x);
    { let x = T.x0; for (const e of exs) { wall(x, e.x - W2, T.z1, T.z1 + 0.4); k.block(e.x - W2, e.x + W2, HY + 2.6, HC, T.z1, T.z1 + 0.4, C.wall, true, 'paint', { ao: false }); x = e.x + W2; } wall(x, T.x1, T.z1, T.z1 + 0.4); }
    // 地铁站厅：白墙 + 红 / 紫腰带；北墙开 D2 口
    const d2 = FZS.exits.find(e => e.n === 'D2');
    for (const [x0, x1, z0, z1] of [[MT.x0, d2.x - W2, MT.z0 - 0.4, MT.z0], [d2.x + W2, MT.x1, MT.z0 - 0.4, MT.z0], [MT.x0, MT.x1, MT.z1, MT.z1 + 0.4], [MT.x0 - 0.4, MT.x0, MT.z0, MT.z1],
      [MT.x1, MT.x1 + 0.4, MT.z0, T.z0], [MT.x1, MT.x1 + 0.4, T.z1, MT.z1]]) {
      k.block(x0, x1, HY, HC, z0, z1, C.wall, true, 'paint', { ao: false });
      const dx = x1 - x0 < z1 - z0 ? 0.03 : 0, dz = dx ? 0 : 0.03;
      P.slab(x0 - dx, x1 + dx, HY + 2.3, HY + 2.48, z0 - dz, z1 + dz, C.l1, { ao: false }); P.slab(x0 - dx, x1 + dx, HY + 2.48, HY + 2.66, z0 - dz, z1 + dz, C.l5, { ao: false });
      P.slab(x0 - dx, x1 + dx, HY, HY + 0.15, z0 - dz, z1 + dz, C.dark, { ao: false });
    }
    k.block(d2.x - W2, d2.x + W2, HY + 2.6, HC, MT.z0 - 0.4, MT.z0, C.wall, true, 'paint', { ao: false });
    // 柱子：白石包柱 + 金色柱头
    for (const x of [-34, -2]) for (const z of [-126, -112, -88, -72]) { P.slab(x - 0.55, x + 0.55, HY, HC - 0.3, z - 0.55, z + 0.55, C.stone); P.slab(x - 0.62, x + 0.62, HC - 0.7, HC - 0.3, z - 0.62, z + 0.62, C.gold, { ao: false }); k.colSlab(x - 0.55, x + 0.55, HY, HC, z - 0.55, z + 0.55); }
    /* ===== 出站口 5（出站检票口，z = -100） ===== */
    const GZ = XST.gatesZ, gx0 = -32.6, ng = 21;
    for (let i = 0; i < ng; i++) {
      const x = gx0 + i * 1.2;
      P.rbox(x, HY, GZ, 0.3, 1.0, 1.7, C.gate, 0.04, 0, { ao: false }); P.slab(x - 0.15, x + 0.15, HY + 1.0, HY + 1.03, GZ - 0.85, GZ + 0.85, hex('#2B3036'), { ao: false });
      G.slab(x - 0.12, x + 0.12, HY + 1.031, HY + 1.04, GZ - 0.82, GZ - 0.7, hex('#3BD16F'), { ao: false });
      k.colSlab(x - 0.15, x + 0.15, HY, HY + 1.0, GZ - 0.85, GZ + 0.85);
    }
    for (const [x0, x1] of [[H.x0, gx0 - 0.15], [gx0 + (ng - 1) * 1.2 + 0.15, -4]]) { k.glass.slab(x0, x1, HY, HY + 1.6, GZ - 0.03, GZ + 0.03, hex('#DDEFF7')); M.slab(x0, x1, HY + 1.6, HY + 1.66, GZ - 0.05, GZ + 0.05, hex('#B9C0C8'), { ao: false }); k.colSlab(x0, x1, HY, HY + 1.6, GZ - 0.1, GZ + 0.1); }
    P.rbox(-1.5, HY, GZ - 1, 3, 1.1, 2.4, hex('#E7E2D8'), 0.05, 0, { ao: false }); k.colSlab(-3, 0, HY, HY + 1.1, GZ - 2.2, GZ + 0.2);
    GR.slab(-3.2, 4, HY, HY + 2.6, GZ + 0.2, GZ + 0.5, C.granite); k.colSlab(-3.2, 4, HY, HY + 2.6, GZ + 0.2, GZ + 0.5);
    this.hang(-20, HY + 3.7, GZ - 0.4, 14, 1.3, Math.PI, bigText('出站口 5', 'Exit 5', NAVY, '#FFFFFF'), HC, board([{ exit: 1 }, { zh: '出站口5', en: 'Exit 5' }, { a: 'u' }]));
    this.hang(-1.5, HY + 2.9, GZ - 2.25, 3, 0.55, Math.PI, bigText('补票处 Ticket Office', null, '#1B6E56', '#FFFFFF'), null);
    /* ===== 吊牌 ===== */
    const sDown = board([{ exit: 1 }, { zh: '出站口5', en: 'Exit 5' }, { bar: 1 }, { metro: 1 }, { l: 1 }, { l: 5 }, { zh: '换乘地铁', en: 'Metro Lines 1 & 5' }, { a: 'r' }]);
    this.hang(-30.5, HY + 3.6, -122, 9.5, 1.1, Math.PI / 2, sDown);
    this.hang(-20, HY + 3.6, -110, 13, 1.1, Math.PI, board([{ exit: 1 }, { zh: '出站口5', en: 'Exit 5' }, { a: 'u' }, { gap: 0.6 }, { metro: 1 }, { l: 1 }, { l: 5 }, { zh: '换乘地铁 免安检', en: 'Metro transfer · No re-screening' }, { a: 'u' }]),
      HC, board([{ a: 'u' }, { zh: '站台', en: 'Platforms' }, { gap: 0.4 }, { zh: '往厦门方向', en: 'To Xiamen' }]));
    this.hang(-20, HY + 3.6, -90, 14, 1.1, Math.PI, board([{ a: 'l' }, { metro: 1 }, { l: 1 }, { l: 5 }, { zh: '换乘地铁 免安检', en: 'Metro Transfer · No re-screening' }, { gap: 0.8 }, { exit: 1 }, { zh: '东广场', en: 'East Square' }, { a: 'u' }]),
      HC, board([{ a: 'u' }, { zh: '站台', en: 'Platforms' }]));
    this.hang(-48, HY + 3.6, -80, 6.4, 1.0, Math.PI / 2, board([{ metro: 1 }, { l: 1 }, { l: 5 }, { zh: '换乘地铁', en: 'Metro' }, { a: 'u' }]), HC, board([{ exit: 1 }, { zh: '出站口5', en: 'Exit 5' }, { a: 'u' }]));
    this.hang(-84, HY + 3.6, -80, 6.4, 1.0, -Math.PI / 2, board([{ zh: '国铁 福州南站', en: 'Railway Station' }, { a: 'u' }]), HC, board([{ exit: 1 }, { zh: '出口 F A B', en: 'Exits F A B' }, { a: 'u' }]));
    this.hang(-20, HY + 3.6, -64, 11, 1.1, Math.PI, board([{ exit: 1 }, { zh: '东广场', en: 'East Square' }, { a: 'u' }, { gap: 0.4 }, { zh: '出租车 · 公交', en: 'Taxi · Bus' }]), HC);
    at.quad(-62, HY + 2.4, T.z0 + 0.02, 12, 1.1, 0, at.draw(12, 1.1, bigText('换乘地铁1号线 5号线', 'Transfer to Fuzhou Metro Lines 1 & 5', '#F7F5F0', '#1D3F73', L1)));
    at.quad(-80, HY + 2.0, T.z1 - 0.02, 10, 0.8, Math.PI, at.draw(10, 0.8, bigText('出站口5 · 免安检换乘', 'Exit 5 · No re-screening', '#F7F5F0', '#1D3F73')));
    // 出口通道口的牌（门楣上，面向换乘通道）
    for (const e of exs) at.quad(e.x, HY + 3.25, T.z1 - 0.02, 3.0, 0.9, Math.PI, at.draw(3.0, 0.9, board([{ exit: 1 }, { letter: e.n }, { zh: e.to[0].replace(/（.*）/, ''), en: e.toEn[0].replace(/ \(.*\)/, '') }], '#1E8E4E')));
    /* ===== 地铁站厅 ===== */
    k.block(MT.x1, MT.x1 + 0.4, HY + 2.75, HC, T.z0, T.z1, C.wall, true, 'paint', { ao: false });
    at.quad(MT.x1 + 0.41, HY + 3.55, -80, 7.6, 1.5, Math.PI / 2, at.draw(7.6, 1.5, metroPortal));
    P.slab(MT.x1 - 0.02, MT.x1 + 0.42, HY + 2.6, HY + 2.75, T.z0, T.z1, C.l1, { ao: false });
    const gxx = MT.gx;
    for (let z = MT.z0 + 1.2; z < MT.z1 - 0.8; z += 1.2) {
      P.rbox(gxx, HY, z, 1.7, 1.0, 0.28, hex('#D7DADD'), 0.04, 0, { ao: false }); P.slab(gxx - 0.85, gxx + 0.85, HY + 1.0, HY + 1.03, z - 0.14, z + 0.14, hex('#2B3036'), { ao: false }); P.slab(gxx - 0.86, gxx + 0.86, HY + 0.82, HY + 0.9, z - 0.145, z + 0.145, C.l1, { ao: false });
      G.slab(gxx + 0.55, gxx + 0.75, HY + 1.041, HY + 1.05, z - 0.1, z + 0.1, hex('#38C46A'), { ao: false });
      k.colSlab(gxx - 0.85, gxx + 0.85, HY, HY + 1.0, z - 0.14, z + 0.14);
    }
    this.hang(gxx + 0.4, HY + 3.4, -80, 7, 0.9, Math.PI / 2, board([{ metro: 1 }, { zh: '进站', en: 'Entrance' }, { l: 1 }, { l: 5 }, { zh: '往 象峰 / 三江口 · 荆溪厚屿', en: 'To Xiangfeng / Sanjiangkou · Jingxi Houyu' }]), HC);
    for (const z of [-90.6, -89.0]) { P.rbox(-88.9, HY, z, 1.0, 1.9, 0.8, hex('#E9EBEC'), 0.05, Math.PI / 2, { ao: false }); at.quad(-89.42, HY + 1.35, z, 0.6, 0.45, -Math.PI / 2, at.draw(0.6, 0.45, bigText('购票', 'Tickets', '#1D3F73', '#FFFFFF'))); k.colSlab(-89.4, -88.4, HY, HY + 1.9, z - 0.4, z + 0.4); }
    P.rbox(-92, HY, -70.2, 5, 1.1, 2.2, hex('#F3F1EC'), 0.05, 0, { ao: false }); k.colSlab(-94.5, -89.5, HY, HY + 1.1, -71.3, -68); at.quad(-92, HY + 2.95, -68.02, 4, 0.6, Math.PI, at.draw(4, 0.6, bigText('客服中心 Service Centre', null, L1, '#FFFFFF')));
    { const [x0, x1, z0, z1] = [-107, -101, -83, -77];
      k.stairs('x', x0, HY, -101.195, -9.195, z0, z1, -13, C.floorM, { nosing: '#4A3A32' });
      for (const [a0, a1] of [[z0 - 0.3, z0], [z1, z1 + 0.3]]) { P.slab(x0, -101.195, -13, HY - 0.3, a0, a1, C.wall, { ao: false }); k.colSlab(x0, -101.195, -13, HY - 0.3, a0, a1); }
      P.slab(x0 - 0.3, x0, -13, HY - 0.3, z0 - 0.3, z1 + 0.3, C.wall, { ao: false });
      for (const z of [z0 + 0.02, z1 - 0.02]) G.slab(x0, -101.195, HY - 0.9, HY - 0.84, z - 0.02, z + 0.02, hex('#FFF4DE'), { ao: false });
      k.rail(x0, z0 - 0.05, x1, z0 - 0.05, HY); k.rail(x0, z1 + 0.05, x1, z1 + 0.05, HY); k.rail(x1 + 0.05, z0, x1 + 0.05, z1, HY); }
    this.hang(-104, HY + 3.4, -80, 6.4, 0.9, Math.PI / 2, board([{ l: 1 }, { l: 5 }, { zh: '站台', en: 'Platforms' }, { a: 'd' }]), HC);
    this.hang(d2.x, HY + 3.4, MT.z0 + 1.5, 5.5, 0.9, 0, board([{ exit: 1 }, { letter: 'D2' }, { zh: '西广场', en: 'West Square' }, { a: 'u' }], '#1E8E4E'), HC);
    /* ===== 出站楼梯（S）：出站层 → 东广场 ===== */
    k.stairs('z', S.z0, HY, S.z1, 0, S.x0, S.x1, HY, '#D6D1C7');
    for (const x of [S.x0 - 0.3, S.x1]) k.block(x, x + 0.3, HY, 0, S.z0, S.z1, C.wall, true, 'paint', { ao: false });
    k.rail(S.x0 - 0.3, S.z0, S.x0 - 0.3, S.z1, 0); k.rail(S.x1 + 0.3, S.z0, S.x1 + 0.3, S.z1, 0); k.rail(S.x0 - 0.3, S.z0 - 0.1, S.x1 + 0.3, S.z0 - 0.1, 0);
    /* ===== 出口通道 F / A / B（往南上到东广场）、D2（往北穿过股道下面上到西广场） ===== */
    const corridor = (x, za, zb, ztop, sign, e) => {   // za → zb 平走（HY），zb → ztop 楼梯上到 0
      const x0 = x - W2, x1 = x + W2, lo = Math.min(za, zb), hi = Math.max(za, zb);
      k.floorWithHoles(x0, x1, lo, hi, HY - 0.3, HY, C.floor, [], true, 'floor');
      k.floorWithHoles(x0 - 0.3, x1 + 0.3, lo, hi, HC, HC + 0.25, C.ceil, [], false, 'ceiling');
      G.slab(x - 0.3, x + 0.3, HC - 0.04, HC, lo + 0.5, hi - 0.5, hex('#FFF8EC'), { ao: false });
      for (const [a, b] of [[x0 - 0.3, x0], [x1, x1 + 0.3]]) { wall(a, b, lo, hi); }
      const sl = Math.min(zb, ztop), sh = Math.max(zb, ztop);
      k.stairs('z', zb, HY, ztop, 0, x0, x1, HY, '#D6D1C7');
      for (const [a, b] of [[x0 - 0.3, x0], [x1, x1 + 0.3]]) k.block(a, b, HY, 0, sl, sh, C.wall, true, 'paint', { ao: false });
      k.rail(x0 - 0.3, sl, x0 - 0.3, sh, 0); k.rail(x1 + 0.3, sl, x1 + 0.3, sh, 0); k.rail(x0 - 0.3, zb - sign * 0.1, x1 + 0.3, zb - sign * 0.1, 0);
      // 出口顶上：门架 + 两面牌（面向广场：地铁标志 + 口号；面向楼梯：出口 + 去向）
      const zt = ztop + sign * 0.15, aOut = sign > 0 ? 0 : Math.PI;
      for (const sx of [x0 - 0.4, x1 + 0.4]) { M.slab(sx - 0.1, sx + 0.1, 0, 3.3, zt - 0.1, zt + 0.1, C.lamp, { ao: false }); k.colSlab(sx - 0.12, sx + 0.12, 0, 3.3, zt - 0.12, zt + 0.12); }
      P.slab(x0 - 0.5, x1 + 0.5, 2.6, 3.4, zt - 0.08, zt + 0.08, hex('#1B2530'), { ao: false });
      at.quad(x, 3.0, zt + sign * 0.09, FZS.exW + 0.9, 0.76, aOut, at.draw(FZS.exW + 0.9, 0.76, board([{ metro: 1 }, { letter: e.n }, { zh: '福州地铁', en: 'Fuzhou Metro' }], '#F7F7F5')));
      at.quad(x, 3.0, zt - sign * 0.09, FZS.exW + 0.9, 0.76, aOut + Math.PI, at.draw(FZS.exW + 0.9, 0.76, board([{ exit: 1 }, { letter: e.n }, { zh: e.to[0].replace(/（.*）/, ''), en: e.toEn[0].replace(/ \(.*\)/, '') }], '#1E8E4E')));
    };
    for (const e of exs) corridor(e.x, FZS.exZ0, FZS.exZ1, FZS.exTop, 1, e);
    corridor(d2.x, FZS.d2.z0, FZS.d2.z1, FZS.d2.top, -1, d2);
    // F / A / B 通道顶（东站房地面下面，z -66 以南是广场，地面挖洞的部分是楼梯井）
    /* ===== 东广场 ===== */
    const PZ = XST.plaza, exHoles = exs.map(e => [e.x - W2 - 0.3, e.x + W2 + 0.3, FZS.exZ1, FZS.exTop]);
    k.floorWithHoles(PZ.x0, PZ.x1, PZ.z0, PZ.z1, -0.3, 0, C.pave, [[S.x0 - 0.3, S.x1 + 0.3, S.z0, S.z1], ...exHoles], true, 'pave');
    k.g('asphalt').slab(PZ.x0 - 40, PZ.x1 + 40, -0.32, -0.15, PZ.z1, PZ.z1 + 24, hex('#4B4E52'), { ao: false });
    k.g('grass').slab(PZ.x0 - 60, PZ.x1 + 60, -0.35, -0.2, PZ.z1 + 24, PZ.z1 + 120, hex('#7FA36B'), { ao: false });
    for (const [x0, x1, z0, z1] of [[PZ.x0 - 1, PZ.x0, PZ.z0, PZ.z1], [PZ.x1, PZ.x1 + 1, PZ.z0, PZ.z1], [PZ.x0, PZ.x1, PZ.z1, PZ.z1 + 1]]) k.colSlab(x0, x1, 0, 3, z0, z1);
    for (let x = PZ.x0 + 2; x < PZ.x1; x += 3) P.cyl(x, 0.45, PZ.z1 - 0.3, 0.22, 0.9, hex('#E8E6E1'), 8);
    const tree = (x, z, s = 1) => {   // 榕树：粗短树干 + 几团深绿树冠
      GR.slab(x - 2.4, x + 2.4, 0, 0.55, z - 2.4, z + 2.4, C.granite); k.g('grass').slab(x - 2.2, x + 2.2, 0.55, 0.6, z - 2.2, z + 2.2, hex('#5E8F4A'), { ao: false });
      k.colSlab(x - 2.4, x + 2.4, 0, 0.55, z - 2.4, z + 2.4);
      P.cyl(x, 2.4, z, 0.9 * s, 3.8, C.trunk, 8, 0, 0, 0, 0.6 * s);
      for (const [dx, dy, dz, d] of [[0, 6.2, 0, 6], [2.2, 5.2, 1, 4.4], [-2.3, 5.3, -0.6, 4.6], [0.6, 5, -2.2, 4.2], [-0.8, 5.1, 2.1, 4]]) k.solid.sphere(x + dx * s, dy * s, z + dz * s, d * s, (dx + dz) > 0 ? C.leaf2 : C.leaf, 1);
    };
    for (const [x, z] of [[-75, -30], [-45, -10], [-70, 10], [40, -30], [15, -10], [40, 10], [28, 26], [70, -10]]) tree(x, z);
    for (const x of [-90, -40, 0, 55, 90]) for (const z of [-40, 0, 30]) if (!(Math.abs(x + 20) < 10 && z < -30)) { M.cyl(x, 4, z, 0.16, 8, C.lamp, 8); G.box(x, 8.1, z, 0.9, 0.18, 0.4, hex('#FFF6DC'), 0, 0, 0, 1, { ao: false }); }
    { const x = -30, z = -40; for (const sx of [-1.9, 1.9]) M.slab(x + sx - 0.07, x + sx + 0.07, 0, 2.2, z - 0.07, z + 0.07, C.lamp, { ao: false }); k.colSlab(x - 2, x + 2, 0, 3.3, z - 0.1, z + 0.1);
      at.quad(x, 2.75, z + 0.03, 4.6, 1.1, 0, at.draw(4.6, 1.1, board([{ a: 'l' }, { metro: 1 }, { l: 1 }, { l: 5 }, { zh: '地铁 F A B口', en: 'Metro Exits F A B' }]))); P.slab(x - 2.35, x + 2.35, 2.15, 3.35, z - 0.05, z + 0.02, hex('#1B2530'), { ao: false }); }
    at.quad(-5, 22, PZ.z1 + 110, 360, 60, Math.PI, at.draw(360, 60, backdrop, 3));
    /* ===== 西广场 + 老站房（背景） ===== */
    const SQ = FZS.square, WB = FZS.west;
    k.floorWithHoles(SQ.x0, SQ.x1, SQ.z0, SQ.z1, -0.3, 0, C.pave, [[d2.x - W2 - 0.3, d2.x + W2 + 0.3, FZS.d2.top, FZS.d2.z1]], true, 'pave');
    for (const [x0, x1, z0, z1] of [[SQ.x0 - 0.6, SQ.x0, SQ.z0, SQ.z1], [SQ.x1, SQ.x1 + 0.6, SQ.z0, SQ.z1], [SQ.x0, SQ.x1, SQ.z1 - 0.1, SQ.z1 + 0.1], [SQ.x0, SQ.x1, SQ.z0 - 0.6, SQ.z0]]) k.colSlab(x0, x1, 0, 3, z0, z1);
    P.slab(SQ.x0 - 0.6, SQ.x0, 0, 1.2, SQ.z0, SQ.z1, C.stone); P.slab(SQ.x1, SQ.x1 + 0.6, 0, 1.2, SQ.z0, SQ.z1, C.stone);
    P.slab(WB.x0, WB.x1, 0, 1.2, WB.z1, WB.z1 + 1.2, C.stone);
    P.slab(WB.x0, WB.x1, 0, 16, WB.z0, WB.z1 - 0.4, hex('#E4E6E8')); k.colSlab(WB.x0, WB.x1, 0, 16, WB.z0, WB.z1 + 1.2);
    k.glass.slab(WB.x0 + 6, WB.x1 - 6, 1.2, 13, WB.z1 - 0.4, WB.z1 - 0.3, C.glass);
    for (let x = WB.x0 + 6; x <= WB.x1 - 6 + 0.01; x += 4) P.slab(x - 0.12, x + 0.12, 1.2, 13, WB.z1 - 0.3, WB.z1 - 0.1, C.mull, { ao: false });
    P.slab(WB.x0 - 4, WB.x1 + 4, 16, 17.4, WB.z0, WB.z1 + 3, C.roof); P.slab(WB.x0 - 4, WB.x1 + 4, 15.7, 16, WB.z0, WB.z1 + 3, C.roofU, { ao: false });
    at.quad(0, 14.5, WB.z1 - 0.05, 22, 2.6, 0, at.draw(22, 2.6, bigText('福 州 南 站', null, '#E4E6E8', '#8B1E1E'), 34));
    at.quad(-40, 3.4, WB.z1 - 0.05, 9, 0.9, 0, at.draw(9, 0.9, bigText('3号进站口 暂停使用', 'Entrance 3 closed', '#6B7178', '#FFFFFF')));
    for (const [x, z] of [[-60, -160], [-20, -172], [30, -160], [60, -172]]) tree(x, z);
    for (const x of [-80, -40, 0, 40]) { M.cyl(x, 4, -150, 0.16, 8, C.lamp, 8); G.box(x, 8.1, -150, 0.9, 0.18, 0.4, hex('#FFF6DC'), 0, 0, 0, 1, { ao: false }); }
    { const x = d2.x + 5.5, z = -168; P.slab(x - 0.5, x + 0.5, 0, 3.6, z - 0.5, z + 0.5, hex('#F7F7F5')); k.colSlab(x - 0.5, x + 0.5, 0, 3.6, z - 0.5, z + 0.5);
      for (const a of [0, Math.PI]) at.quad(x, 2.6, z + (a ? -0.51 : 0.51), 0.9, 1.6, a, at.draw(0.9, 1.6, (c, pw, ph) => { c.fillStyle = '#F7F7F5'; c.fillRect(0, 0, pw, ph); fzLogo(c, pw * 0.08, ph * 0.04, pw * 0.84); c.fillStyle = '#1E8E4E'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.font = `800 ${pw * 0.42}px ${FONT_EN}`; c.fillText('D2', pw / 2, ph * 0.68); c.font = `700 ${pw * 0.18}px ${FONT}`; c.fillText('西广场', pw / 2, ph * 0.9); })); }
    { const x = -30, z = -168; P.slab(x - 4, x + 4, 2.8, 3.0, z - 1.2, z + 1.2, hex('#3E6E9A'), { ao: false }); for (const sx of [-3.6, 3.6]) M.slab(x + sx - 0.07, x + sx + 0.07, 0, 2.8, z - 0.07, z + 0.07, C.lamp, { ao: false });
      at.quad(x, 3.3, z + 1.25, 6, 0.6, 0, at.draw(6, 0.6, bigText('西广场公交站 West Square Bus', null, '#1B6E56', '#FFFFFF'))); k.colSlab(x - 4, x + 4, 0, 0.5, z - 0.3, z + 0.3); P.slab(x - 3, x + 3, 0.42, 0.5, z - 0.3, z + 0.3, C.seat, { ao: false }); }
    this.buildHall(k, at);
    this.buildFacade(k, at);
  }
  /** 候车室（东站房里面，地面 y = 0）：蓝色座椅、金色榕树柱、发车屏；检票口“暂停检票”（进站走站台，不在这里检票） */
  buildHall(k, at) {
    const P = k.solid, G = k.glow, M = k.metal, { face, back, x0, x1 } = FZS, zf = face - 0.6;
    k.floorWithHoles(x0 + 0.4, x1 - 0.4, back, face, -0.3, 0, C.hall, [], true, 'floor');
    P.slab(x0, x1, 13, 13.4, back, zf, C.ceil, { ao: false });
    for (let z = back + 3; z < zf - 1; z += 4) G.slab(x0 + 2, x1 - 2, 12.9, 13, z - 0.2, z + 0.2, hex('#FFF8EC'), { ao: false });
    P.slab(x0, x1, 0, 22, back - 0.4, back, C.wall, { ao: false }); k.colSlab(x0, x1, 0, 14, back - 0.4, back);
    for (const [a, b] of [[x0 - 0.4, x0 + 0.4], [x1 - 0.4, x1 + 0.4]]) { P.slab(a, b, 0, 22, back, face, C.stone); k.colSlab(a, b, 0, 14, back, face); }
    // 座椅（蓝色，背靠背两排一组）
    for (const [xa, xb] of [[-74, -30], [-14, 8], [30, 72]]) for (const z of [-90, -82, -74]) {
      M.slab(xa, xb, 0.38, 0.44, z - 0.5, z + 0.5, hex('#8D949B'), { ao: false });
      for (let x = xa + 0.35; x < xb; x += 0.7) for (const sz of [-1, 1]) { P.rbox(x, 0.44, z + sz * 0.26, 0.56, 0.08, 0.46, C.seat, 0.03, 0, { ao: false }); P.slab(x - 0.27, x + 0.27, 0.5, 1.0, z + sz * 0.5 - 0.03, z + sz * 0.5 + 0.03, C.seat, { ao: false }); }
      k.colSlab(xa, xb, 0, 0.9, z - 0.55, z + 0.55);
    }
    // 金色榕树柱（室内，顶到吊顶）
    for (const x of [-52, -22, 18, 48]) for (const z of [-86, -78]) this.banyan(x, z, 0, 7.5, 13, 3.2, 0.8);
    // 检票口（暂停检票）+ 发车显示屏
    for (const gx of [-58, -8, 44]) { for (let i = 0; i < 6; i++) { const x = gx + i * 1.2; P.rbox(x, 0, back + 2.2, 0.3, 1.0, 1.7, C.gate, 0.04, 0, { ao: false }); G.slab(x - 0.12, x + 0.12, 1.031, 1.04, back + 1.45, back + 1.57, hex('#E04A3A'), { ao: false }); }
      k.colSlab(gx - 0.6, gx + 6.6, 0, 1.2, back + 1.2, back + 3.2);
      this.hang(gx + 3, 3.4, back + 3.4, 6, 0.9, 0, bigText('检票口 · 暂停检票', 'Gate closed · Board from the platform', '#2B3640', '#FFD27A', '#FFFFFF'), null); }
    at.quad(-5, 8, back + 0.05, 18, 4, 0, at.draw(18, 4, (c, pw, ph) => {
      c.fillStyle = '#10161C'; c.fillRect(0, 0, pw, ph); c.textBaseline = 'middle';
      const rows = [['车次 Train', '终到 To', '开点 Dep', '状态 Status'], ['G3027', '厦门北 Xiamenbei', '11:55', '正在候车'], ['G3028', '福州南 到达 Arr.', '14:35', '已到达']];
      rows.forEach((r, i) => { const y = ph * (0.18 + i * 0.3); c.font = `${i ? 700 : 600} ${ph * (i ? 0.15 : 0.11)}px ${FONT}`; [0.04, 0.24, 0.62, 0.78].forEach((fx, j) => { c.fillStyle = i === 0 ? '#9FB4C8' : j === 3 ? '#55E07A' : '#FFC54A'; c.textAlign = 'left'; c.fillText(r[j], pw * fx, y); }); });
    }, 40));
    at.quad(-5, 11.2, back + 0.05, 22, 1.6, 0, at.draw(22, 1.6, bigText('候车室 Waiting Hall', null, '#F2F2EF', '#1D3F73')));
  }
  /** 东站房立面：波浪玻璃幕墙、金色榕树柱撑起白色“船帆”屋面；7 号 / 4 号进站口 */
  buildFacade(k, at) {
    const P = k.solid, M = k.metal, GL = k.glass, z = FZS.face, { x0: X0, x1: X1, E7, E4, ew, back } = FZS;
    const open = x => [E7, E4].some(e => Math.abs(x - e) < ew / 2);
    // 碰撞：立面一道墙，两个进站口留开
    { let x = X0; for (const e of [E7, E4]) { k.colSlab(x, e - ew / 2, 0, 14, z - 0.9, z - 0.1); x = e + ew / 2; } k.colSlab(x, X1, 0, 14, z - 0.9, z - 0.1); }
    k.colSlab(E7 - ew / 2, E7 + ew / 2, 6.2, 14, z - 0.9, z - 0.1); k.colSlab(E4 - ew / 2, E4 + ew / 2, 6.2, 14, z - 0.9, z - 0.1);
    // 波浪玻璃幕墙：每 3.2 m 一个折点，z 按正弦起伏
    const zw = x => z - 0.5 + 0.38 * Math.sin((x - X0) * 2 * Math.PI / 12.8);
    for (let xa = X0 + 0.4; xa < X1 - 0.4 - 0.01; xa += 3.2) {
      const xb = Math.min(xa + 3.2, X1 - 0.4), za = zw(xa), zb = zw(xb), L = Math.hypot(xb - xa, zb - za), ry = Math.atan2(-(zb - za), xb - xa), xm = (xa + xb) / 2, zm = (za + zb) / 2;
      const y0 = open(xm) ? 6.2 : 0;
      GL.box(xm, (y0 + 18) / 2, zm, L, 18 - y0, 0.06, C.glass, ry, 0, 0, 1, { ao: false });
      M.slab(xa - 0.1, xa + 0.1, 0, 18, za - 0.12, za + 0.12, C.mull, { ao: false });
      for (const y of [6, 12]) P.box(xm, y, zm + 0.06, L + 0.05, 0.16, 0.12, C.gold, ry, 0, 0, 1, { ao: false });
    }
    // 进站口：金色门框 + 雨篷 + 号码牌
    for (const [e, n] of [[E7, 7], [E4, 4]]) {
      P.slab(e - ew / 2 - 0.3, e - ew / 2, 0, 6.2, z - 0.9, z - 0.1, C.gold); P.slab(e + ew / 2, e + ew / 2 + 0.3, 0, 6.2, z - 0.9, z - 0.1, C.gold);
      P.slab(e - ew / 2 - 1, e + ew / 2 + 1, 6.2, 6.6, z - 0.9, z + 4, C.roof, { ao: false });
      at.quad(e, 5.4, z + 0.02, 6.4, 0.9, 0, at.draw(6.4, 0.9, board([{ zh: `${n}号进站口`, en: `Entrance ${n}` }, { a: 'u' }])));
    }
    P.slab(X0, X1, 18, 22.6, z - 0.9, z - 0.3, C.roof);   // 檐下白带 + 站名
    at.quad(-5, 20.3, z - 0.28, 28, 3.6, 0, at.draw(28, 3.6, bigText('福 州 南 站', 'FUZHOUNAN', '#F6F7F8', '#8B1E1E', '#1D3F73'), 34));
    P.slab(X0, X1, 13.4, 22, back - 2.4, back - 2.0, C.wall, { ao: false });   // 站台那边的立面（xmn.js 到 14.9 m）往上补
    // 船帆屋面：沿 x 一排起伏的帆（每段一个弧顶），白色屋面 + 浅灰蓝檐底
    const xa = X0 - 16, xb = X1 + 16, nS = 6, n = 72, za = back - 4, zb = z + 9, sail = x => 22.6 + 4.2 * Math.pow(Math.abs(Math.sin(Math.PI * (x - xa) / ((xb - xa) / nS))), 0.6);
    for (let i = 0; i < n; i++) {
      const x0 = xa + (xb - xa) * i / n, x1 = xa + (xb - xa) * (i + 1) / n, ya = sail(x0), yb = sail(x1), L = Math.hypot(x1 - x0, yb - ya), ang = Math.atan2(yb - ya, x1 - x0);
      P.box((x0 + x1) / 2, (ya + yb) / 2, (za + zb) / 2, L + 0.08, 0.3, zb - za, C.roofU, 0, 0, ang, 1, { ao: false });
      P.box((x0 + x1) / 2, (ya + yb) / 2 + 0.45, (za + zb) / 2 - 0.3, L + 0.08, 0.6, zb - za - 0.6, C.roof, 0, 0, ang, 1, { ao: false });
      P.box((x0 + x1) / 2, (ya + yb) / 2 + 0.2, zb + 0.05, L + 0.08, 0.9, 0.25, C.mull, 0, 0, ang, 1, { ao: false });
    }
    // 檐下金色榕树柱（立面前面一排）
    for (const x of [-46, -6, 30, 62]) this.banyan(x, z + 6.5, 0, 12, 22.4, 4.2, 1.0);
  }
  /** 人在哪一块：passage / hall / wait（候车室）/ plaza（东广场）/ square（西广场）/ platform */
  static area(lx, y, z) {
    if (y < -3) return lx < XST.hall.x0 ? 'passage' : 'hall';
    if (z < FZS.square.z1 + 0.2 && y > -3) return 'square';
    if (y > -1.5 && z > FZS.back - 0.5 && z < FZS.face - 0.4 && lx > FZS.x0 && lx < FZS.x1) return 'wait';
    if (z > XST.face - 1 && y > -1.5) return 'plaza';
    if (z > -64 && z < -36 && lx > XST.stair.x0 - 0.5 && lx < XST.stair.x1 + 0.5) return 'plaza';
    for (const e of FZS.exits) if (Math.abs(lx - e.x) < FZS.exW / 2 + 0.3 && (e.side === 'S' ? z > FZS.exZ0 : z < FZS.d2.z0)) return e.side === 'S' ? 'plaza' : 'square';
    return 'platform';
  }
}
