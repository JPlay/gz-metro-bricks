/*
 * 厦门北站 · 站房（第二阶段）：出站层（地下）、出站检票口、换乘地铁通道、南广场和站房立面。
 * 独立的区域：第一次在厦门北站下车才建（js/world/xmn.js XmnPlatform.show('solo') 里），只在厦门这边打开，和广州那边的场景完全分开。
 * 依据真实的厦门北站（2010 年启用，“上进下出”：高架候车层进站，站台下面的出站层出站；
 *   出站层有出站地道、地铁出入口；2019 年起北出站口到地铁 1 号口有免安检换乘通道；
 *   南站房（中南建筑设计院）外形取闽南民居的燕尾脊，屋顶两头高高翘起，“仿似腾飞的双翼”）。
 * 厦门地铁 1 号线（岩内—镇海路）线路色是橙色（C0 M68 Y100 K0 ≈ #F2711C）。
 * 坐标：和站台一样，local x（XO.x 为 0），世界 z。站台 y = 0，出站层地面 y = HY = -6.5，出站层吊顶 y = -1.9。
 *   站台楼梯口（xmn.js XMN.hole）x -25.2..-11.2，往 -x 下到出站层；
 *   出站厅 x -44..4、z -132..-62；出站检票口 z = -100；换乘地铁通道 z -84..-76 往 -x，到 x = -88 地铁闸机；
 *   出站楼梯 x -26..-14、z -62..-38 上到南广场（y = 0）；站房南立面 z = -66（站房本体 z -98..-66）。
 * 没有地面导向带 / 地上画的箭头：只有吊牌、墙上的牌子（JPlay 的规矩）。
 */
import { Kit, FONT, FONT_EN } from './kit.js';
import { hex } from '../core/geo.js';
import { FoodAtlas } from '../game/food-art.js';
import { XO, XMN } from './xmn.js';

const HY = -6.5, HC = -1.9;   // = XMN.HY（这里不能在模块顶层读 XMN：xmn.js 和本文件互相 import）
export const XST = {
  HY, HC, hall: { x0: -44, x1: 4, z0: -132, z1: -62 }, gatesZ: -100,
  tr: { x0: -88, x1: -44, z0: -84, z1: -76 }, metro: { x0: -110, x1: -88, z0: -92, z1: -68, gx: -96 },
  stair: { x0: -26, x1: -14, z0: -62, z1: -38 }, face: -66, plaza: { x0: -110, x1: 100, z0: -66, z1: 40 }
};
export const L1 = '#F2711C';
const NAVY = '#163A5F';
const C = {
  floor: hex('#D8D3CA'), floorM: hex('#E2E2DE'), wall: hex('#F1EEE8'), brick: hex('#B5452F'), stone: hex('#E9E4DA'), wood: hex('#9A6A43'),
  ceil: hex('#F4F2EE'), sea: hex('#2C6E9E'), glass: hex('#5E9CC4'), mull: hex('#F2F3F1'), roofTop: hex('#D9DDE0'), dark: hex('#3A3F45'),
  gate: hex('#C9CED3'), l1: hex(L1), pave: hex('#C9C2B6'), trunk: hex('#8A7458'), palm: hex('#4F8A3E'), lamp: hex('#5B6066')
};

/* ---------- 牌子画法（铁路站深蓝底白字；出口绿色；地铁橙色 1 号线） ---------- */
/** 厦门地铁标志（简化）：白底圆角方块，蓝色“M”，上面一个红色三角（闽南红厝屋顶） */
function metroLogo(c, x, y, s) {
  c.fillStyle = '#FFFFFF'; rr(c, x, y, s, s, s * 0.16); c.fill();
  c.fillStyle = '#D7262B'; c.beginPath(); c.moveTo(x + s * 0.5, y + s * 0.1); c.lineTo(x + s * 0.84, y + s * 0.36); c.lineTo(x + s * 0.16, y + s * 0.36); c.closePath(); c.fill();
  c.strokeStyle = '#1D5AA8'; c.lineWidth = s * 0.12; c.lineJoin = 'round'; c.lineCap = 'round';
  c.beginPath(); c.moveTo(x + s * 0.2, y + s * 0.86); c.lineTo(x + s * 0.2, y + s * 0.46); c.lineTo(x + s * 0.5, y + s * 0.72); c.lineTo(x + s * 0.8, y + s * 0.46); c.lineTo(x + s * 0.8, y + s * 0.86); c.stroke();
}
function rr(c, x, y, w, h, r) { c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath(); }
function arrow(c, x, y, s, dir, col = '#FFFFFF') {
  const a = { r: 0, d: Math.PI / 2, l: Math.PI, u: -Math.PI / 2 }[dir];
  c.save(); c.translate(x + s / 2, y + s / 2); c.rotate(a); c.fillStyle = col; c.beginPath();
  c.moveTo(s * 0.45, 0); c.lineTo(0, -s * 0.38); c.lineTo(0, -s * 0.14); c.lineTo(-s * 0.42, -s * 0.14); c.lineTo(-s * 0.42, s * 0.14); c.lineTo(0, s * 0.14); c.lineTo(0, s * 0.38); c.closePath(); c.fill(); c.restore();
}
/** 出口图标：绿色方块 + 白色奔跑的人 + 门 */
function exitIcon(c, x, y, s) {
  c.fillStyle = '#1E8E4E'; rr(c, x, y, s, s, s * 0.1); c.fill();
  c.fillStyle = '#FFFFFF'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.font = `800 ${s * 0.62}px ${FONT}`; c.fillText('出', x + s / 2, y + s * 0.54);
}
function l1Badge(c, x, y, s) { c.fillStyle = L1; rr(c, x, y, s, s, s * 0.18); c.fill(); c.fillStyle = '#FFFFFF'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.font = `800 ${s * 0.74}px ${FONT_EN}`; c.fillText('1', x + s / 2, y + s * 0.55); }
/**
 * 一块横向导向牌：parts = [{a:'l'|'r'|'u'|'d'}, {exit:1}, {metro:1}, {l1:1}, {zh, en, col}, {gap:0.3}, {bar:1}]
 * 每段宽度按牌子高度算；整体居中。
 */
function board(parts, bg = NAVY) {
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
      else if (q.metro) metroLogo(c, x, y, s);
      else if (q.l1) l1Badge(c, x, y, s);
      else if (q.bar) { c.fillStyle = 'rgba(255,255,255,0.55)'; c.fillRect(x + ph * 0.11, ph * 0.16, ph * 0.03, ph * 0.68); }
      else if (q.zh) { c.fillStyle = q.col || '#FFFFFF'; c.textAlign = 'left'; c.textBaseline = 'middle'; c.font = `700 ${ph * 0.36}px ${FONT}`; c.fillText(q.zh, x + ph * 0.09, q.en ? ph * 0.38 : ph * 0.52); if (q.en) { c.font = `500 ${ph * 0.18}px ${FONT_EN}`; c.fillText(q.en, x + ph * 0.09, ph * 0.73); } }
      x += W[i];
    });
  };
}
/** 大字（站房立面 / 地铁入口）：bg 底色、fg 字色 */
function bigText(zh, en, bg, fg, enCol) {
  return (c, pw, ph) => { c.fillStyle = bg; c.fillRect(0, 0, pw, ph); c.fillStyle = fg; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.font = `800 ${ph * (en ? 0.56 : 0.7)}px ${FONT}`; c.fillText(zh, pw / 2, ph * (en ? 0.4 : 0.54)); if (en) { c.fillStyle = enCol || fg; c.font = `600 ${ph * 0.2}px ${FONT_EN}`; c.fillText(en, pw / 2, ph * 0.82); } };
}
/** 地铁入口门楣：标志 + 厦门地铁 + 橙色 1 号线带 */
function metroPortal(c, pw, ph) {
  c.fillStyle = '#F7F7F5'; c.fillRect(0, 0, pw, ph); c.fillStyle = L1; c.fillRect(0, ph * 0.7, pw, ph * 0.3);
  const s = ph * 0.56; metroLogo(c, pw * 0.05, ph * 0.07, s); c.strokeStyle = '#1D5AA8'; c.lineWidth = 3; rr(c, pw * 0.05, ph * 0.07, s, s, s * 0.16); c.stroke();
  c.fillStyle = '#1D3F73'; c.textAlign = 'left'; c.textBaseline = 'middle'; c.font = `800 ${ph * 0.3}px ${FONT}`; c.fillText('厦门地铁', pw * 0.05 + s * 1.2, ph * 0.28);
  c.font = `600 ${ph * 0.14}px ${FONT_EN}`; c.fillText('XIAMEN METRO', pw * 0.05 + s * 1.2, ph * 0.54);
  c.textAlign = 'right'; c.font = `700 ${ph * 0.22}px ${FONT}`; c.fillText('厦门北站', pw * 0.95, ph * 0.26); c.font = `500 ${ph * 0.12}px ${FONT_EN}`; c.fillText('Xiamen North Railway Station', pw * 0.95, ph * 0.5);
  c.fillStyle = '#FFFFFF'; c.textAlign = 'center'; c.font = `800 ${ph * 0.2}px ${FONT}`; c.fillText('1号线  岩内 ⇄ 镇海路     Line 1  Yannei ⇄ Zhenhailu', pw / 2, ph * 0.86);
}
function backdrop(c, pw, ph) {
  const g = c.createLinearGradient(0, 0, 0, ph * 0.7); g.addColorStop(0, '#78B2E4'); g.addColorStop(1, '#E3EFF6'); c.fillStyle = g; c.fillRect(0, 0, pw, ph);
  c.fillStyle = '#9BB5B3'; c.beginPath(); c.moveTo(0, ph); for (let i = 0; i <= 12; i++) c.lineTo(pw * i / 12, ph * (0.5 + 0.12 * Math.abs(Math.sin(i * 1.3 + 0.4)))); c.lineTo(pw, ph); c.fill();
  const cols = ['#F2EEE6', '#E4ECF1', '#EFE4D6', '#DCE6EC'];
  for (let i = 0, x = 4; x < pw; i++) { const w = 14 + (i * 13) % 20, h = ph * (0.1 + ((i * 7) % 9) / 38); c.fillStyle = cols[i % 4]; c.fillRect(x, ph * 0.76 - h, w, h);
    if (i % 5 === 2) { c.fillStyle = '#A8432E'; c.beginPath(); c.moveTo(x - 3, ph * 0.76 - h); c.quadraticCurveTo(x + w / 2, ph * 0.76 - h + 4, x + w + 3, ph * 0.76 - h - 5); c.lineTo(x + w, ph * 0.76 - h + 2); c.lineTo(x, ph * 0.76 - h + 2); c.fill(); }
    c.fillStyle = 'rgba(70,90,110,0.4)'; for (let y = ph * 0.76 - h + 4; y < ph * 0.74; y += 5) for (let xx = x + 2; xx < x + w - 3; xx += 4) c.fillRect(xx, y, 2, 2.5); x += w + 5 + (i * 11) % 16; }
  c.fillStyle = '#7F9F78'; c.fillRect(0, ph * 0.76, pw, ph * 0.24);
}

/** 厦门这边的网格不要用广州车站的反射探针（探针是按广州站厅 / 站台的盒子投影的，拿到这里地面会映出一道道黄线、白线，像地上画了导向带）：
 *  换成没有反射贴图的副本（每种材质一个，缓存） */
const NOPROBE = {};
export function noProbe(root) {
  for (const m of root.getChildMeshes(false)) {
    const mat = m.material; if (!mat || !('reflectionTexture' in mat) || mat.name.endsWith('@xmn')) continue;
    if (!mat.reflectionTexture && !['floor', 'wall', 'gloss'].includes(mat.name)) continue;
    const c = NOPROBE[mat.name] || (NOPROBE[mat.name] = mat.clone(mat.name + '@xmn'));
    c.reflectionTexture = null; c._noProbe = true; if (c.name.startsWith('floor')) { c.environmentIntensity = 0.12; c.roughness = 0.42; } m.material = c;
  }
}
export class XmnStation {
  constructor(scene) {
    this.scene = scene;
    const k = this.kit = new Kit(scene, 'xmnSt'); k.root.position.set(XO.x, 0, 0);
    const at = this.atlas = new FoodAtlas(scene, 2048);
    this.build(k, at);
    k.finish(true); at.finish(k.root, 'xmnStSigns'); noProbe(k.root);
    this.root = k.root;
  }
  setEnabled(v) { this.root.setEnabled(v); }
  /** 吊牌：牌面 + 深色边框 + 两根吊杆（top = 吊顶 y）；two = 背面也画（背面可以是另一块） */
  hang(x, y, z, w, h, a, paint, top = HC, back) {
    const k = this.kit, at = this.atlas, nx = Math.sin(a), nz = Math.cos(a), uv = at.draw(w, h, paint);
    at.quad(x, y, z, w, h, a, uv);
    if (back !== undefined) at.quad(x - nx * 0.08, y, z - nz * 0.08, w, h, a + Math.PI, back ? at.draw(w, h, back) : uv);
    k.solid.box(x - nx * 0.04, y, z - nz * 0.04, w + 0.08, h + 0.08, 0.06, hex('#1B2530'), a, 0, 0, 1, { ao: false });
    if (top !== null) for (const s of [-1, 1]) k.metal.tube([x - nx * 0.04 - nz * s * w * 0.36, y + h / 2, z - nz * 0.04 + nx * s * w * 0.36], [x - nx * 0.04 - nz * s * w * 0.36, top, z - nz * 0.04 + nx * s * w * 0.36], 0.035, hex('#9AA1A8'), 6);
  }
  build(k, at) {
    const P = k.solid, G = k.glow, M = k.metal, BR = k.g('brick'), F = k.g('floor'), CE = k.g('ceiling');
    const { hall: H, tr: T, metro: MT, stair: S } = XST, hole = XMN.hole;
    /* ===== 出站层（地下）：地面 / 吊顶 / 墙 ===== */
    k.floorWithHoles(H.x0, H.x1, H.z0, H.z1, HY - 0.3, HY, C.floor, [], true, 'floor');
    k.floorWithHoles(T.x0, T.x1, T.z0, T.z1, HY - 0.3, HY, C.floor, [], true, 'floor');
    k.floorWithHoles(MT.x0, MT.x1, MT.z0, MT.z1, HY - 0.3, HY, C.floorM, [[-108, -100, -86, -74]], true, 'floor');
    // 吊顶：白色 + 木色椽子（闽南厝的檩条意思）+ 灯带；楼梯口上方开洞
    for (const r of [[H.x0, H.x1, H.z0, H.z1], [T.x0, T.x1, T.z0, T.z1], [MT.x0, MT.x1, MT.z0, MT.z1]]) {
      const holes = r === undefined ? [] : (r[0] === H.x0 ? [hole] : []);
      k.floorWithHoles(r[0], r[1], r[2], r[3], HC, HC + 0.25, C.ceil, holes, false, 'ceiling');
    }
    for (let x = H.x0 + 1.5; x < H.x1; x += 2.4) { const over = x > hole[0] - 0.3 && x < hole[1] + 0.3; for (const [z0, z1] of over ? [[H.z0, hole[2]], [hole[3], H.z1]] : [[H.z0, H.z1]]) P.slab(x - 0.09, x + 0.09, HC - 0.32, HC, z0, z1, C.wood, { ao: false }); }
    for (const z of [-126, -112, -104, -90, -72]) G.slab(H.x0 + 1, H.x1 - 1, HC - 0.36, HC - 0.32, z - 0.25, z + 0.25, hex('#FFF8EC'), { ao: false });
    for (const z of [T.z0 + 2, T.z1 - 2]) G.slab(T.x0, T.x1, HC - 0.04, HC, z - 0.2, z + 0.2, hex('#FFF8EC'), { ao: false });
    for (let x = T.x0 + 2; x < T.x1; x += 2.4) P.slab(x - 0.09, x + 0.09, HC - 0.32, HC, T.z0, T.z1, C.wood, { ao: false });
    G.slab(MT.x0 + 1, MT.x1 - 0.5, HC - 0.04, HC, -82, -78, hex('#FFFFFF'), { ao: false });
    // 墙：下部红砖墙裙 + 白石压条，上部白墙
    const wall = (x0, x1, z0, z1, top = HC, dado = true) => {
      k.block(x0, x1, HY, top, z0, z1, C.wall, true, 'paint', { ao: false });
      if (!dado) return;
      const dx = x1 - x0 < z1 - z0 ? 0.04 : 0, dz = dx ? 0 : 0.04;
      BR.slab(x0 - dx, x1 + dx, HY, HY + 1.5, z0 - dz, z1 + dz, C.brick, { ao: false });
      P.slab(x0 - dx * 1.6, x1 + dx * 1.6, HY + 1.5, HY + 1.66, z0 - dz * 1.6, z1 + dz * 1.6, C.stone, { ao: false });
    };
    wall(H.x0, H.x1, H.z0 - 0.4, H.z0);                         // 北墙（股道下面）
    wall(H.x1, H.x1 + 0.4, H.z0, H.z1);                         // 东墙
    wall(H.x0 - 0.4, H.x0, H.z0, T.z0); wall(H.x0 - 0.4, H.x0, T.z1, H.z1);   // 西墙，中间开口去地铁
    wall(H.x0, S.x0, H.z1, H.z1 + 0.4); wall(S.x1, H.x1, H.z1, H.z1 + 0.4);   // 南墙，中间是上广场的楼梯
    wall(T.x0, T.x1, T.z0 - 0.4, T.z0); wall(T.x0, T.x1, T.z1, T.z1 + 0.4);   // 换乘通道两边
    // 地铁站厅：白墙 + 橙色 1 号线腰带
    for (const [x0, x1, z0, z1] of [[MT.x0, MT.x1, MT.z0 - 0.4, MT.z0], [MT.x0, MT.x1, MT.z1, MT.z1 + 0.4], [MT.x0 - 0.4, MT.x0, MT.z0, MT.z1],
      [MT.x1, MT.x1 + 0.4, MT.z0, T.z0], [MT.x1, MT.x1 + 0.4, T.z1, MT.z1]]) {
      k.block(x0, x1, HY, HC, z0, z1, C.wall, true, 'paint', { ao: false });
      const dx = x1 - x0 < z1 - z0 ? 0.03 : 0, dz = dx ? 0 : 0.03;
      P.slab(x0 - dx, x1 + dx, HY + 2.3, HY + 2.65, z0 - dz, z1 + dz, C.l1, { ao: false });
      P.slab(x0 - dx, x1 + dx, HY, HY + 0.15, z0 - dz, z1 + dz, C.dark, { ao: false });
    }
    // 柱子：红砖包柱 + 白石柱头
    for (const x of [-34, -2]) for (const z of [-126, -112, -88, -72]) { BR.slab(x - 0.55, x + 0.55, HY, HC - 0.3, z - 0.55, z + 0.55, C.brick); P.slab(x - 0.62, x + 0.62, HC - 0.8, HC - 0.3, z - 0.62, z + 0.62, C.stone, { ao: false }); k.colSlab(x - 0.55, x + 0.55, HY, HC, z - 0.55, z + 0.55); }
    /* ===== 出站检票口（z = -100）：一排闸机，翼门开着；两边玻璃隔断 ===== */
    const GZ = XST.gatesZ, gx0 = -32.6, ng = 21;
    for (let i = 0; i < ng; i++) {
      const x = gx0 + i * 1.2;
      P.rbox(x, HY, GZ, 0.3, 1.0, 1.7, C.gate, 0.04, 0, { ao: false }); P.slab(x - 0.15, x + 0.15, HY + 1.0, HY + 1.03, GZ - 0.85, GZ + 0.85, hex('#2B3036'), { ao: false });
      G.slab(x - 0.12, x + 0.12, HY + 1.031, HY + 1.04, GZ - 0.82, GZ - 0.7, hex('#3BD16F'), { ao: false });
      k.colSlab(x - 0.15, x + 0.15, HY, HY + 1.0, GZ - 0.85, GZ + 0.85);
    }
    for (const [x0, x1] of [[H.x0, gx0 - 0.15], [gx0 + (ng - 1) * 1.2 + 0.15, -4]]) { k.glass.slab(x0, x1, HY, HY + 1.6, GZ - 0.03, GZ + 0.03, hex('#DDEFF7')); M.slab(x0, x1, HY + 1.6, HY + 1.66, GZ - 0.05, GZ + 0.05, hex('#B9C0C8'), { ao: false }); k.colSlab(x0, x1, HY, HY + 1.6, GZ - 0.1, GZ + 0.1); }
    // 工作人员通道 + 补票处
    P.rbox(-1.5, HY, GZ - 1, 3, 1.1, 2.4, hex('#E7E2D8'), 0.05, 0, { ao: false }); k.colSlab(-3, 0, HY, HY + 1.1, GZ - 2.2, GZ + 0.2);
    BR.slab(-3.2, 4, HY, HY + 2.6, GZ + 0.2, GZ + 0.5, C.brick); k.colSlab(-3.2, 4, HY, HY + 2.6, GZ + 0.2, GZ + 0.5);
    this.hang(-20, HY + 3.7, GZ - 0.4, 14, 1.3, Math.PI, bigText('出站检票口', 'Exit Ticket Check', NAVY, '#FFFFFF'), HC, board([{ exit: 1 }, { zh: '出站口', en: 'Exit' }, { a: 'u' }]));
    this.hang(-1.5, HY + 2.9, GZ - 2.25, 3, 0.55, Math.PI, bigText('补票处 Ticket Office', null, '#1B6E56', '#FFFFFF'), null);
    /* ===== 吊牌（铁路导向：深蓝底；出站绿；地铁橙色 1 号线） ===== */
    const sDown = board([{ exit: 1 }, { zh: '出站口', en: 'Exit' }, { bar: 1 }, { metro: 1 }, { l1: 1 }, { zh: '换乘地铁', en: 'Metro Line 1' }, { a: 'r' }]);
    this.hang(-30.5, HY + 3.6, -122, 9.5, 1.1, Math.PI / 2, sDown);                                     // 下楼梯就看到（面向 +x）
    this.hang(-20, HY + 3.6, -110, 12, 1.1, Math.PI, board([{ exit: 1 }, { zh: '出站口', en: 'Exit' }, { a: 'u' }, { gap: 0.6 }, { metro: 1 }, { l1: 1 }, { zh: '换乘地铁1号线', en: 'Transfer to Metro Line 1' }, { a: 'u' }]),
      HC, board([{ a: 'u' }, { zh: '站台', en: 'Platforms' }, { gap: 0.4 }, { zh: '往广州方向', en: 'To Guangzhou' }]));
    this.hang(-20, HY + 3.6, -90, 14, 1.1, Math.PI, board([{ a: 'l' }, { metro: 1 }, { l1: 1 }, { zh: '换乘地铁 免安检', en: 'Metro Transfer · No re-screening' }, { gap: 0.8 }, { exit: 1 }, { zh: '南广场 出租车 公交', en: 'South Square · Taxi · Bus' }, { a: 'u' }]),
      HC, board([{ a: 'u' }, { zh: '1-8 站台', en: 'Platforms 1-8' }]));
    this.hang(-50, HY + 3.6, -80, 6, 1.0, Math.PI / 2, board([{ metro: 1 }, { l1: 1 }, { zh: '地铁1号线', en: 'Metro Line 1' }, { a: 'u' }]), HC, board([{ exit: 1 }, { zh: '出站口', en: 'Exit' }, { a: 'u' }]));
    this.hang(-70, HY + 3.6, -80, 6, 1.0, Math.PI / 2, board([{ zh: '免安检换乘通道', en: 'Transfer passage' }, { a: 'u' }]), HC, board([{ zh: '国铁 厦门北站', en: 'Railway Station' }, { a: 'u' }]));
    this.hang(-20, HY + 3.6, -64, 11, 1.1, Math.PI, board([{ exit: 1 }, { zh: '出站口  南广场', en: 'Exit · South Square' }, { a: 'u' }, { gap: 0.4 }, { zh: '出租车 · 公交 · BRT', en: 'Taxi · Bus · BRT' }]), HC);
    // 换乘通道墙上的大字 + 地铁宣传灯箱
    at.quad(-62, HY + 2.4, T.z0 + 0.02, 10, 1.1, 0, at.draw(10, 1.1, bigText('换乘地铁1号线', 'Transfer to Xiamen Metro Line 1', '#F7F5F0', '#1D3F73', L1)));
    at.quad(-62, HY + 2.4, T.z1 - 0.02, 10, 1.1, Math.PI, at.draw(10, 1.1, bigText('厦门北站 · 地铁换乘中心', 'Xiamenbei Transfer Hub', '#F7F5F0', '#1D3F73')));
    /* ===== 地铁站厅：入口门楣、闸机（关着，第三阶段才进得去）、售票机、客服中心、下站台的楼梯 ===== */
    k.block(MT.x1, MT.x1 + 0.4, HY + 2.75, HC, T.z0, T.z1, C.wall, true, 'paint', { ao: false });   // 入口门楣
    at.quad(MT.x1 + 0.41, HY + 3.55, -80, 7.6, 1.5, Math.PI / 2, at.draw(7.6, 1.5, metroPortal));
    P.slab(MT.x1 - 0.02, MT.x1 + 0.42, HY + 2.6, HY + 2.75, T.z0, T.z1, C.l1, { ao: false });
    const gxx = MT.gx;
    for (let z = MT.z0 + 1.2, i = 0; z < MT.z1 - 0.8; z += 1.2, i++) {
      P.rbox(gxx, HY, z, 1.7, 1.0, 0.28, hex('#D7DADD'), 0.04, 0, { ao: false }); P.slab(gxx - 0.85, gxx + 0.85, HY + 1.0, HY + 1.03, z - 0.14, z + 0.14, hex('#2B3036'), { ao: false }); P.slab(gxx - 0.86, gxx + 0.86, HY + 0.82, HY + 0.9, z - 0.145, z + 0.145, C.l1, { ao: false });
      G.slab(gxx + 0.55, gxx + 0.75, HY + 1.041, HY + 1.05, z - 0.1, z + 0.1, hex(i % 3 === 1 ? '#F04A3A' : '#38C46A'), { ao: false });
      if (z + 1.2 < MT.z1 - 0.8) k.glass.slab(gxx - 0.05, gxx + 0.05, HY + 0.35, HY + 1.0, z + 0.14, z + 1.06, hex('#F2A06A'));   // 翼门（关着）
    }
    k.colSlab(gxx - 0.3, gxx + 0.3, HY, HY + 1.6, MT.z0, MT.z1);
    this.hang(gxx + 0.4, HY + 3.4, -80, 6, 0.9, Math.PI / 2, board([{ metro: 1 }, { zh: '进站', en: 'Entrance' }, { l1: 1 }, { zh: '往 岩内 / 镇海路', en: 'To Yannei / Zhenhailu' }]), HC);
    for (const z of [-90.2, -88.6]) { P.rbox(-93, HY, z, 1.0, 1.9, 0.8, hex('#E9EBEC'), 0.05, Math.PI / 2, { ao: false }); at.quad(-92.48, HY + 1.35, z, 0.6, 0.45, Math.PI / 2, at.draw(0.6, 0.45, bigText('购票', 'Tickets', '#1D3F73', '#FFFFFF'))); k.colSlab(-93.5, -92.5, HY, HY + 1.9, z - 0.4, z + 0.4); }
    P.rbox(-92, HY, -70.2, 5, 1.1, 2.2, hex('#F3F1EC'), 0.05, 0, { ao: false }); k.colSlab(-94.5, -89.5, HY, HY + 1.1, -71.3, -68); at.quad(-92, HY + 2.6, -68.02, 4, 0.6, Math.PI, at.draw(4, 0.6, bigText('客服中心 Service Centre', null, L1, '#FFFFFF')));
    // 下站台楼梯（付费区里，往下到黑处：站台层第三阶段做）
    { const [x0, x1, z0, z1] = [-108, -100, -86, -74]; for (let i = 0; i < 18; i++) F.slab(x1 - (i + 1) * 0.44, x1 - i * 0.44, HY - 0.3 - i * 0.28 - 0.28, HY - 0.3 - i * 0.28, z0, z1, C.floorM, { ao: false });
      P.slab(x0 - 0.2, x1, HY - 6, HY - 5.9, z0, z1, hex('#202428'), { ao: false });
      k.rail(x0, z0 - 0.1, x1, z0 - 0.1, HY); k.rail(x0, z1 + 0.1, x1, z1 + 0.1, HY); k.rail(x0 - 0.1, z0, x0 - 0.1, z1, HY); }
    this.hang(-104, HY + 3.4, -80, 6, 0.9, Math.PI / 2, board([{ l1: 1 }, { zh: '站台  往岩内 / 往镇海路', en: 'Platforms · Yannei / Zhenhailu' }, { a: 'd' }]), HC);
    /* ===== 出站楼梯：从出站层上到南广场（露天楼梯井） ===== */
    k.stairs('z', S.z0, HY, S.z1, 0, S.x0, S.x1, HY, '#D6D1C7');
    for (const x of [S.x0 - 0.3, S.x1]) { k.block(x, x + 0.3, HY, 0, S.z0, S.z1, C.wall, true, 'paint', { ao: false }); }
    for (const [x0, x1] of [[S.x0 - 0.33, S.x0 - 0.3], [S.x1 + 0.3, S.x1 + 0.33]]) BR.slab(x0, x1, -3.2, -0.6, S.z0, S.z1, C.brick, { ao: false });
    k.rail(S.x0 - 0.3, S.z0, S.x0 - 0.3, S.z1, 0); k.rail(S.x1 + 0.3, S.z0, S.x1 + 0.3, S.z1, 0); k.rail(S.x0 - 0.3, S.z0 - 0.1, S.x1 + 0.3, S.z0 - 0.1, 0);
    /* ===== 南广场 ===== */
    const PZ = XST.plaza;
    k.floorWithHoles(PZ.x0, PZ.x1, PZ.z0, PZ.z1, -0.3, 0, C.pave, [[S.x0 - 0.3, S.x1 + 0.3, S.z0, S.z1]], true, 'pave');
    k.g('asphalt').slab(PZ.x0 - 40, PZ.x1 + 40, -0.32, -0.15, PZ.z1, PZ.z1 + 24, hex('#4B4E52'), { ao: false });
    k.g('grass').slab(PZ.x0 - 60, PZ.x1 + 60, -0.35, -0.2, PZ.z1 + 24, PZ.z1 + 120, hex('#7FA36B'), { ao: false });
    for (const [x0, x1, z0, z1] of [[PZ.x0 - 1, PZ.x0, PZ.z0, PZ.z1], [PZ.x1, PZ.x1 + 1, PZ.z0, PZ.z1], [PZ.x0, PZ.x1, PZ.z1, PZ.z1 + 1]]) k.colSlab(x0, x1, 0, 3, z0, z1);
    for (let x = PZ.x0 + 2; x < PZ.x1; x += 3) P.cyl(x, 0.45, PZ.z1 - 0.3, 0.22, 0.9, hex('#E8E6E1'), 8);   // 路边石墩
    // 花坛 + 棕榈 + 路灯
    for (const [x, z] of [[-70, -30], [-45, -10], [-70, 10], [40, -30], [15, -10], [40, 10], [28, 26], [70, -10]]) {
      BR.slab(x - 2.4, x + 2.4, 0, 0.55, z - 2.4, z + 2.4, C.brick); P.slab(x - 2.5, x + 2.5, 0.55, 0.62, z - 2.5, z + 2.5, C.stone, { ao: false }); k.g('grass').slab(x - 2.2, x + 2.2, 0.62, 0.66, z - 2.2, z + 2.2, hex('#5E8F4A'), { ao: false });
      k.colSlab(x - 2.5, x + 2.5, 0, 0.62, z - 2.5, z + 2.5);
      const h = 7 + ((x * 7 + z) % 3 + 3) % 3; P.cyl(x, 0.6 + h / 2, z, 0.42, h, C.trunk, 8, 0, 0, 0, 0.3);
      for (let i = 0; i < 9; i++) { const a = i * 2 * Math.PI / 9, top = [x, 0.6 + h, z]; P.tube(top, [x + Math.cos(a) * 2.2, h + 1.2, z + Math.sin(a) * 2.2], 0.32, C.palm, 5); P.tube([x + Math.cos(a) * 2.2, h + 1.2, z + Math.sin(a) * 2.2], [x + Math.cos(a) * 3.8, h - 0.2, z + Math.sin(a) * 3.8], 0.24, C.palm, 5); }
    }
    for (const x of [-90, -55, 0, 55, 90]) for (const z of [-40, 0, 30]) if (!(Math.abs(x + 20) < 10 && z < -30)) { M.cyl(x, 4, z, 0.16, 8, C.lamp, 8); G.box(x, 8.1, z, 0.9, 0.18, 0.4, hex('#FFF6DC'), 0, 0, 0, 1, { ao: false }); }
    // 广场上的指示牌（站立式）+ 地铁出入口标志柱
    { const x = -31.5, z = -37; for (const sx of [-1.9, 1.9]) M.slab(x + sx - 0.07, x + sx + 0.07, 0, 2.2, z - 0.07, z + 0.07, C.lamp, { ao: false }); k.colSlab(x - 2, x + 2, 0, 3.3, z - 0.1, z + 0.1);
      at.quad(x, 2.75, z + 0.03, 4.6, 1.1, 0, at.draw(4.6, 1.1, board([{ metro: 1 }, { l1: 1 }, { zh: '地铁1号线', en: 'Metro Line 1' }, { a: 'r' }]))); P.slab(x - 2.35, x + 2.35, 2.15, 3.35, z - 0.05, z + 0.02, hex('#1B2530'), { ao: false }); }
    { const x = -40, z = -48; P.slab(x - 0.5, x + 0.5, 0, 5.6, z - 0.5, z + 0.5, hex('#F7F7F5')); k.colSlab(x - 0.5, x + 0.5, 0, 5.6, z - 0.5, z + 0.5);
      for (const a of [0, Math.PI]) at.quad(x, 4.6, z + (a ? -0.51 : 0.51), 0.9, 0.9, a, at.draw(0.9, 0.9, (c, pw, ph) => { c.fillStyle = '#F7F7F5'; c.fillRect(0, 0, pw, ph); metroLogo(c, pw * 0.08, ph * 0.08, pw * 0.84); }));
      for (const a of [0, Math.PI]) at.quad(x, 3.2, z + (a ? -0.51 : 0.51), 0.9, 1.4, a, at.draw(0.9, 1.4, (c, pw, ph) => { c.fillStyle = L1; c.fillRect(0, 0, pw, ph); c.fillStyle = '#FFF'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.font = `800 ${pw * 0.62}px ${FONT_EN}`; c.fillText('1', pw / 2, ph * 0.32); c.font = `700 ${pw * 0.2}px ${FONT}`; c.fillText('地铁', pw / 2, ph * 0.68); c.fillText('Metro', pw / 2, ph * 0.86); })); }
    at.quad(-5, 22, PZ.z1 + 110, 360, 60, Math.PI, at.draw(360, 60, backdrop, 3));
    this.buildFacade(k, at);
  }
  /** 站房南立面：白石台基 + 红砖墙 + 海蓝玻璃幕墙 + 两层屋顶，两头像燕尾脊一样高高翘起（“腾飞的双翼”） */
  buildFacade(k, at) {
    const P = k.solid, BR = k.g('brick'), GL = k.glass, z = XST.face, X0 = -90, X1 = 80, cx = (X0 + X1) / 2, zb = -98;
    k.colSlab(X0, X1, 0, 24, zb, z);
    P.slab(X0, X1, 0, 1.0, z - 0.6, z + 0.4, C.stone);                         // 台基
    // 首层：入口五开间（玻璃门 + 白石门框），两边红砖墙 + 白石窗框
    const E0 = -45, E1 = 35;
    for (const [x0, x1] of [[X0, E0], [E1, X1]]) {
      BR.slab(x0, x1, 1, 7, z - 0.4, z, C.brick);
      for (let x = x0 + 3; x < x1 - 2; x += 5) { P.slab(x - 1.1, x + 1.1, 2.0, 6.0, z - 0.02, z + 0.12, C.stone, { ao: false }); GL.slab(x - 0.8, x + 0.8, 2.3, 5.7, z + 0.12, z + 0.16, C.glass); }
    }
    GL.slab(E0, E1, 1, 7, z - 1.2, z - 1.1, C.glass);
    // 玻璃后面：室内（深一点的蓝灰墙 + 几道灯带），免得透过站房看到站台那边
    P.slab(X0 + 0.5, X1 - 0.5, 1, 22, z - 4.2, z - 4, hex('#566F86'), { ao: false });
    for (const y of [6.6, 12.5, 16]) k.glow.slab(-68, 58, y, y + 0.12, z - 3.98, z - 3.9, hex('#FFF4DE'), { ao: false });
    for (let x = E0; x <= E1 + 0.01; x += 16) P.slab(x - 1, x + 1, 1, 7, z - 1.2, z + 0.1, C.stone);
    for (let x = E0 + 4; x < E1; x += 4) if ((x - E0) % 16) P.slab(x - 0.1, x + 0.1, 1, 7, z - 1.1, z - 1.0, C.mull, { ao: false });
    P.slab(X0, X1, 7, 8.2, z - 0.5, z + 0.5, C.stone);                          // 白石腰线
    // 中段：海蓝玻璃幕墙 + 白色竖梃；两端红砖“护厝”
    GL.slab(-70, 60, 8.2, 16.5, z - 0.6, z - 0.5, C.glass);
    for (let x = -70; x <= 60.01; x += 3.25) P.slab(x - 0.12, x + 0.12, 8.2, 16.5, z - 0.5, z - 0.3, C.mull, { ao: false });
    for (let y = 11; y < 16.5; y += 2.8) P.slab(-70, 60, y - 0.06, y + 0.06, z - 0.5, z - 0.35, C.mull, { ao: false });
    for (const [x0, x1] of [[X0, -70], [60, X1]]) { BR.slab(x0, x1, 8.2, 16.5, z - 0.4, z, C.brick); P.slab(x0, x1, 16.5, 17.2, z - 0.5, z + 0.2, C.stone); for (const y of [9.5, 12.8]) { const xm = (x0 + x1) / 2; P.slab(xm - 3.2, xm + 3.2, y, y + 2.4, z - 0.02, z + 0.1, C.stone, { ao: false }); GL.slab(xm - 2.8, xm + 2.8, y + 0.3, y + 2.1, z + 0.1, z + 0.14, C.glass); } }
    // 檐下白石大字带
    P.slab(-70, 60, 16.5, 21.5, z - 0.6, z - 0.2, C.stone);
    GL.slab(-58, 48, 23.4, 27.6, z - 6.6, z - 6.5, C.glass); GL.slab(-58, 48, 23.4, 27.6, zb + 5.5, zb + 5.6, C.glass);   // 两层屋顶之间的高侧窗
    at.quad(-5, 19, z - 0.17, 30, 4.2, 0, at.draw(30, 4.2, bigText('厦 门 北 站', null, '#E9E4DA', '#B5302A'), 34));
    // 背面（站台那边，xmn.js 的立面到 14.9 m）往上补到屋檐
    GL.slab(X0, X1, 14.3, 22, zb - 0.5, zb - 0.4, C.glass);
    P.slab(X0 - 0.4, X0, 0, 22, zb, z, C.stone); P.slab(X1, X1 + 0.4, 0, 22, zb, z, C.stone);
    // 屋顶：海蓝色檐底 + 银白屋面，中间平缓、两头往上翘（燕尾）；上下两层
    const roof = (xa, xb, y0, lift, za, zb2, th, n) => {
      const half = (xb - xa) / 2, mid = (xa + xb) / 2, yf = t => y0 + 1.2 * t * t + lift * Math.max(0, Math.abs(t) - 0.55) ** 2 / 0.2025;
      for (let i = 0; i < n; i++) {
        const t0 = -1 + 2 * i / n, t1 = -1 + 2 * (i + 1) / n, x0 = mid + t0 * half, x1 = mid + t1 * half, ya = yf(t0), yb = yf(t1), L = Math.hypot(x1 - x0, yb - ya), ang = Math.atan2(yb - ya, x1 - x0);
        P.box((x0 + x1) / 2, (ya + yb) / 2, (za + zb2) / 2, L + 0.08, 0.35, zb2 - za, C.sea, 0, 0, ang, 1, { ao: false });
        P.box((x0 + x1) / 2, (ya + yb) / 2 + th / 2, (za + zb2) / 2, L + 0.08, th - 0.35, zb2 - za - 0.6, C.roofTop, 0, 0, ang, 1, { ao: false });
        P.box((x0 + x1) / 2, (ya + yb) / 2 + 0.2, zb2 + 0.05, L + 0.08, th * 0.75, 0.25, C.mull, 0, 0, ang, 1, { ao: false });   // 白色檐口
      }
    };
    roof(X0 - 16, X1 + 16, 22.2, 9, zb - 4, z + 9, 1.6, 44);
    roof(-58, 48, 27.5, 7, zb + 6, z - 6, 1.3, 32);
    // 屋脊 + 燕尾：中间一道深红褐色正脊，两头分叉上翘
    const rr = hex('#7A3426'), zr = (zb + z) / 2 - 2;
    P.slab(-38, 28, 29.0, 30.8, zr - 0.7, zr + 0.7, rr, { ao: false });
    for (const sd of [-1, 1]) { const x0 = sd < 0 ? -38 : 28;
      for (let i = 0; i < 10; i++) for (const fz of [-1, 1]) P.box(x0 + sd * (i * 1.4 + 0.7), 29.9 + i * 0.55 + i * i * 0.09, zr + fz * (0.15 + i * i * 0.014), 1.6, 1.2, 0.6, rr, fz * sd * -0.06 * i / 9, 0, sd * (0.16 + i * 0.075), 1, { ao: false }); }
    // 檐下“凤凰木”树形柱：白色主干 + 四根斜撑托住挑檐
    for (const x of [-80, -58, -36, -2, 20, 42, 64]) {
      P.cyl(x, 7, z + 6.5, 0.9, 14, C.mull, 12, 0, 0, 0, 0.7);
      for (const [dx, dz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) P.tube([x, 13.6, z + 6.5], [x + dx * 4, 22.2 + 1.2 * ((x + dx * 4 - cx) / 106) ** 2, z + 6.5 + dz * 2.2], 0.36, C.mull, 8);
      k.colSlab(x - 0.45, x + 0.45, 0, 14, z + 6.05, z + 6.95);
    }
  }
  /** 人在哪一块：platform / hall / passage(换乘通道+地铁站厅) / plaza */
  static area(lx, y, z) {
    if (y < -3) return lx < XST.hall.x0 ? 'passage' : 'hall';
    if (z > XST.face - 1 && y > -1.5) return 'plaza';
    if (z > -64 && z < -36 && lx > XST.stair.x0 - 0.5 && lx < XST.stair.x1 + 0.5) return 'plaza';
    return 'platform';
  }
}
