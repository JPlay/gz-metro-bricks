/*
 * 厦门北站 · 站台（第一阶段：只有站台，下车用；站房 / 出站口 / 厦门地铁在后面的阶段做）。
 * 坐标沿用广州东站站台那套“站台坐标”（js/world/gze.js GZE）：轨道中心 z = -129.75、站台边 z = -128、车厢中心 x = -17，
 *   所以同一个 Kit 既可以整体平移到 XO（独立场景，下车后站在这里），也可以平移到车厢外面（js/game/east.js 车窗外看到的站台）。
 * 和广州东站明显不一样：
 *   - 岛式站台，头顶是一整片海蓝色的大雨棚（白色树杈形钢柱撑着，白色灯带）；
 *   - 站台中间一排闽南红砖墙基座的立柱（白色花岗岩压顶），站名牌「厦门北 Xiamenbei」；
 *   - 背后隔着另一条股道和站台，是站房：白色石材 + 红砖腰带 + 海蓝色玻璃，屋顶两头高高翘起的燕尾脊轮廓。
 * solo（只在独立场景里打开）：停着的复兴号外观、碰撞、远处的山和城市背景板。
 */
import { Kit } from './kit.js';
import { hex } from '../core/geo.js';
import { FoodAtlas } from '../game/food-art.js';
import { GZE, EMU, buildEmuTrain } from './gze.js';
import { FONT, FONT_EN } from './kit.js';
import { XmnStation, noProbe } from './xmnStation.js';

export const XO = { x: 3000, z: 0 };
export const XMN = { xw: -70, xe: 60, back: -116, edge: GZE.edge, tz: GZE.tz, hole: [-25.2, -11.2, -124.4, -119.6], HY: -6.5 };
/** 站台中间往下到出站层（“上进下出”）：左边楼梯、右边下行扶梯，洞口三面玻璃栏杆 */
function buildStairHole(k) {
  const [h0, h1, h2, h3] = XMN.hole, HY = XMN.HY, zm = (h2 + h3) / 2;
  k.stairs('x', h1, 0, h0, HY, h2, zm - 0.1, HY, '#D9D5CC');
  k.stairs('x', h1, 0, h0, HY, zm + 0.1, h3, HY, '#8C9298', { nosing: '#F2C230' });   // 扶梯：深灰梯级 + 黄边
  k.solid.slab(h0, h1, -0.02, 0.02, zm - 0.1, zm + 0.1, hex('#8D949B'), { ao: false });
  k.g('metal').slab(h1 - 0.2, h1 + 1.2, 0.003, 0.012, zm + 0.15, h3 - 0.05, hex('#B9C0C8'), { ao: false });   // 扶梯入口不锈钢盖板
  k.rail(h0, h2 - 0.1, h1, h2 - 0.1, 0); k.rail(h0, h3 + 0.1, h1, h3 + 0.1, 0); k.rail(h0 - 0.1, h2 - 0.1, h0 - 0.1, h3 + 0.1, 0);
  // 洞口四壁（站台板底到出站层吊顶之间）
  for (const z of [h2 - 0.02, h3 + 0.02]) k.solid.slab(h0, h1, -1.95, -1.25, z - 0.02, z + 0.02, hex('#ECE8E0'), { ao: false });
}
const C = {
  plat: hex('#CFCBC4'), edge: hex('#F1F0EC'), bed: hex('#8E8A83'), sleeper: hex('#A19C92'), rail: hex('#6D7175'),
  roof: hex('#1F5F8B'), roofTop: hex('#E9ECEE'), col: hex('#F4F5F3'), brick: hex('#B5452F'), stone: hex('#E9E4DA'), sea: hex('#2C7DB0'),
  wall: hex('#ECE8E0'), glass: hex('#9CC3DA'), dark: hex('#3A3F45')
};
function plate(zh, en) {
  return (c, pw, ph) => { c.fillStyle = '#1F4E9C'; c.fillRect(0, 0, pw, ph); c.fillStyle = '#FFFFFF'; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.font = `700 ${ph * 0.46}px ${FONT}`; c.fillText(zh, pw / 2, ph * 0.4); c.font = `500 ${ph * 0.2}px ${FONT_EN}`; c.fillText(en, pw / 2, ph * 0.78); };
}
/** 远处背景板：厦门集美的青山、楼和几座红砖厝（独立场景里，越过对面股道看到的） */
function paintBackdrop(c, pw, ph) {
  const g = c.createLinearGradient(0, 0, 0, ph * 0.72); g.addColorStop(0, '#7DB6E6'); g.addColorStop(1, '#E4F0F7'); c.fillStyle = g; c.fillRect(0, 0, pw, ph);
  c.fillStyle = '#93B0B0'; c.beginPath(); c.moveTo(0, ph); for (let i = 0; i <= 10; i++) c.lineTo(pw * i / 10, ph * (0.48 + 0.14 * Math.abs(Math.sin(i * 1.7)))); c.lineTo(pw, ph); c.fill();
  const cols = ['#F2EEE6', '#E6EEF2', '#EFE6DA', '#DDE8EE'];
  for (let i = 0, x = 6; x < pw; i++) { const w = 16 + (i * 13) % 22, h = ph * (0.12 + ((i * 7) % 10) / 40); c.fillStyle = cols[i % 4]; c.fillRect(x, ph * 0.74 - h, w, h); c.fillStyle = 'rgba(70,90,110,0.4)'; for (let y = ph * 0.74 - h + 3; y < ph * 0.72; y += 5) for (let xx = x + 2; xx < x + w - 3; xx += 4) c.fillRect(xx, y, 2, 2.5); x += w + 6 + (i * 11) % 18; }
  c.fillStyle = '#86A47E'; c.fillRect(0, ph * 0.74, pw, ph * 0.26);
}
/** 站房立面上的大字 */
function paintName(c, pw, ph) { c.fillStyle = '#1F5F8B'; c.fillRect(0, 0, pw, ph); c.fillStyle = '#FFFFFF'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.font = `800 ${ph * 0.62}px ${FONT}`; c.fillText('厦 门 北 站', pw * 0.5, ph * 0.54); }

/** 外地高铁站站台的配置（福州南等复用同一套站台：js/world/fzs.js）。O 场景原点；id kit 名前缀；name 站名牌；station(scene) 站房（下车后第一次 solo 才建） */
export const XMN_CFG = { O: XO, id: 'xmn', name: ['厦门北', 'Xiamenbei'], C, backdrop: paintBackdrop, station: scene => new XmnStation(scene) };

export class XmnPlatform {
  /** 建在 cfg.O（厦门 = XO）；car 模式时 root 挪到车厢外 */
  constructor(scene, cfg = XMN_CFG) {
    this.scene = scene; this.cfg = cfg; this.O = cfg.O; this.C = cfg.C || C;
    const id = cfg.id;
    const k = this.kit = new Kit(scene, id); k.root.position.set(this.O.x, 0, 0);
    const atlas = this.atlas = new FoodAtlas(scene, 1024);
    const s = this.solo = new Kit(scene, id + '-solo', k.root); const sa = this.soloAtlas = new FoodAtlas(scene, 1024);
    this.build(k, atlas, s, sa);
    k.finish(false); atlas.finish(k.root, id + 'Signs');
    s.finish(false); sa.finish(s.root, id + 'SoloSigns'); noProbe(k.root);
    k.root.setEnabled(false); this.mode = null;
  }
  build(k, atlas, s, sa) {
    const P = k.solid, G = k.glow, M = k.metal, { xw, xe, back, edge, tz } = XMN, C = this.C;
    /* 岛式站台 */
    k.floorWithHoles(xw, xe, edge, back, -1.25, 0, C.plat, [XMN.hole], false, 'pave');   // 中间开一个楼梯口（往下到出站层）
    buildStairHole(k);
    for (const [z0, z1] of [[edge, edge + 0.3], [back - 0.3, back]]) P.slab(xw, xe, 0.002, 0.01, z0, z1, C.edge, { ao: false });
    for (const z of [edge + 0.75, back - 1.05]) k.g('tactile').slab(xw, xe, 0.002, 0.014, z, z + 0.3, hex('#F2C230'), { ao: false });
    P.slab(xw - 0.3, xw, -1.25, 0.02, back, edge, C.edge, { ao: false }); P.slab(xe, xe + 0.3, -1.25, 0.02, back, edge, C.edge, { ao: false });
    /* 两条股道（本线 + 站台另一边） */
    for (const [zc, z0, z1] of [[tz, tz - 2.5, edge], [back + 1.75, back, back + 3.5]]) {
      P.slab(xw - 40, xe + 40, -1.4, -1.3, Math.min(z0, z1), Math.max(z0, z1), C.bed, { ao: false });
      for (let x = xw - 40; x < xe + 40; x += 0.65) P.box(x, -1.25, zc, 0.24, 0.1, 2.6, C.sleeper, 0, 0, 0, 1, { ao: false });
      for (const sd of [-1, 1]) M.slab(xw - 40, xe + 40, -1.2, -1.08, zc + sd * 0.717 - 0.04, zc + sd * 0.717 + 0.04, C.rail, { ao: false });
    }
    P.slab(xw, xe, -1.3, -0.02, edge - 0.05, edge, hex('#B5B1A9'), { ao: false }); P.slab(xw, xe, -1.3, -0.02, back, back + 0.05, hex('#B5B1A9'), { ao: false });
    /* 对面（站房一侧）的站台 + 站房立面 */
    const z2 = back + 3.5, zb = back + 18;
    k.g('pave').slab(xw, xe, -1.25, 0, z2, zb - 2, C.plat, { ao: false }); P.slab(xw, xe, 0.002, 0.01, z2, z2 + 0.3, C.edge, { ao: false }); k.g('tactile').slab(xw, xe, 0.002, 0.014, z2 + 0.75, z2 + 1.05, hex('#F2C230'), { ao: false });
    this.facade(k, atlas, xw, xe, zb);
    /* 大雨棚（海蓝色底面 + 白色顶面），白色树杈柱 */
    const r0 = tz - 6, r1 = zb - 2.2, RY = 8.6;
    P.slab(xw - 6, xe + 6, RY, RY + 0.12, r0, r1, C.roof, { ao: false }); P.slab(xw - 6, xe + 6, RY + 0.12, RY + 0.5, r0, r1, C.roofTop, { ao: false });
    for (let z = r0 + 2; z < r1 - 1; z += 3.2) G.slab(xw - 5, xe + 5, RY - 0.03, RY, z - 0.12, z + 0.12, hex('#F4F8FF'), { ao: false });
    const zc = (back + edge) / 2;
    this.cols = [];
    for (let x = xw + 7; x < xe; x += 18) {
      // 红砖基座 + 白石压顶；白色钢柱；顶上四根斜撑（树杈）
      this.colBase(k, x, zc);
      P.cyl(x, 1.22 + (RY - 2.6 - 1.22) / 2, zc, 0.5, RY - 2.6 - 1.22, C.col, 12);
      for (const [dx, dz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) P.tube([x, RY - 2.7, zc], [x + dx * 3.2, RY, zc + dz * 3.4], 0.22, C.col, 8);
      this.cols.push(x);
    }
    // 站名牌（吊在雨棚下，两面）+ 柱子上的小站名
    const pu = atlas.draw(3.6, 1.0, plate(...this.cfg.name));
    for (const x of [xw + 16, xw + 52, xw + 88, xw + 124].filter(x => x < xe - 2)) for (const a of [0, Math.PI]) {
      atlas.quad(x, 3.4, zc + (a ? -0.05 : 0.05), 3.6, 1.0, a, pu);
      for (const sx of [-1, 1]) M.tube([x + sx * 1.3, 3.9, zc], [x + sx * 1.3, RY, zc], 0.03, hex('#9AA1A8'), 6);
    }
    // 候车椅（站台两头，蓝色）
    for (const x of [xw + 25, xw + 97].filter(x => x < xe - 4)) { M.slab(x - 2, x + 2, 0.36, 0.42, zc - 0.25, zc + 0.25, hex('#8D949B'), { ao: false }); for (let i = 0; i < 6; i++) P.rbox(x - 1.7 + i * 0.68, 0.42, zc, 0.5, 0.06, 0.46, C.sea, 0.03, 0, { ao: false }); }
    // 对面（远离站房）一侧：挡墙 + 海蓝色栏杆
    const zs = GZE.zs;
    P.slab(xw - 40, xe + 40, -1.4, 1.6, zs - 0.5, zs, C.stone);
    for (let x = xw - 40; x < xe + 40; x += 2.5) M.box(x, 2.2, zs - 0.25, 0.06, 1.2, 0.06, C.sea, 0, 0, 0, 1, { ao: false });
    M.slab(xw - 40, xe + 40, 2.75, 2.82, zs - 0.3, zs - 0.2, C.sea, { ao: false });

    /* ===== solo：独立场景才打开 ===== */
    buildEmuTrain(s, (x, y, z, w, h, zh, fg) => sa.sign(x, y, z, w, h, 0, (c, pw, ph) => { c.fillStyle = '#F4F5F3'; c.fillRect(0, 0, pw, ph); c.fillStyle = fg; c.textAlign = 'center'; c.textBaseline = 'middle'; c.font = `800 ${ph * 0.7}px ${FONT}`; c.fillText(zh, pw / 2, ph * 0.54); }));
    sa.quad(-5, 8, zs - 60, 260, 40, 0, sa.draw(260, 40, this.cfg.backdrop, 4));
    // 碰撞：站台地面、两条站台边（列车没挡住的地方）、两头、站房一侧股道
    { const [h0, h1, h2, h3] = XMN.hole; s.colSlab(xw, h0, -1.3, 0, back, edge); s.colSlab(h1, xe, -1.3, 0, back, edge); s.colSlab(h0, h1, -1.3, 0, edge, h2); s.colSlab(h0, h1, -1.3, 0, h3, back); }
    s.colSlab(xw, xe, 0, 1.4, back - 0.25, back);
    s.colSlab(26.5, xe, 0, 1.4, edge - 0.25, edge); s.colSlab(xw, -60, 0, 1.4, edge - 0.25, edge);
    s.colSlab(xw - 0.6, xw, 0, 2, back, edge); s.colSlab(xe, xe + 0.6, 0, 2, back, edge);
    for (const x of this.cols) s.col(x, 1.5, zc, 1.3, 3, 1.3);
  }
  /** 站房一侧的立面（厦门北：白石 + 红砖腰带 + 海蓝玻璃 + 燕尾脊轮廓） */
  facade(k, atlas, xw, xe, zb) {
    const P = k.solid, M = k.metal, C = this.C;
    P.slab(xw - 20, xe + 20, -1.3, 1.4, zb - 2, zb, C.stone);                                    // 白石墙基
    k.g('brick').slab(xw - 20, xe + 20, 1.4, 3.4, zb - 2, zb, C.brick);                          // 红砖腰带
    P.slab(xw - 20, xe + 20, 3.4, 3.8, zb - 2.15, zb, C.stone);
    k.glass.slab(xw - 20, xe + 20, 3.8, 13.5, zb - 1.6, zb - 1.5, C.glass);                       // 海蓝玻璃幕墙
    for (let x = xw - 20; x <= xe + 20; x += 6) M.slab(x - 0.12, x + 0.12, 3.8, 13.5, zb - 1.75, zb - 1.55, hex('#D8DCDF'), { ao: false });
    P.slab(xw - 20, xe + 20, 3.8, 13.5, zb - 0.3, zb, C.wall);
    P.slab(xw - 22, xe + 22, 13.5, 14.3, zb - 2.6, zb + 0.5, C.stone);                            // 檐口
    // 屋脊：中间平、两头高高翘起的燕尾（深红褐色瓦脊）
    const rr = hex('#7A3426');
    P.slab(xw - 10, xe + 10, 14.3, 14.9, zb - 1.4, zb - 0.6, rr);
    for (const sd of [-1, 1]) { const x0 = sd < 0 ? xw - 10 : xe + 10; for (let i = 0; i < 6; i++) P.box(x0 + sd * (i * 1.1 + 0.5), 14.9 + i * 0.42 + i * i * 0.05, zb - 1.0, 1.25, 0.55, 0.8, rr, 0, 0, sd * (0.18 + i * 0.09), 1, { ao: false }); }
    atlas.quad(0, 9.2, zb - 2.17, 16, 2.6, Math.PI, atlas.draw(16, 2.6, paintName, 56));
  }
  /** 雨棚柱的基座（厦门北：红砖 + 白石压顶） */
  colBase(k, x, zc) {
    const P = k.solid, C = this.C;
    k.g('brick').slab(x - 0.6, x + 0.6, 0, 1.1, zc - 0.6, zc + 0.6, C.brick); P.slab(x - 0.68, x + 0.68, 1.1, 1.22, zc - 0.68, zc + 0.68, C.stone);
  }
  /** 'solo'：独立场景（在 O）；'car'：车厢外的站台（ox = 车厢里看到的位置偏移） */
  show(mode, ox = 0) {
    const r = this.kit.root;
    if (!mode) { r.setEnabled(false); this.mode = null; if (this.station) this.station.setEnabled(false); return; }
    r.setEnabled(true); this.solo.root.setEnabled(mode === 'solo');
    // 站房（出站层 / 换乘通道 / 南广场）：厦门自己的一块区域，第一次下车才建，只在独立场景里打开
    if (mode === 'solo' && !this.station) this.station = this.cfg.station(this.scene);
    if (this.station) this.station.setEnabled(mode === 'solo');
    if (mode === 'solo') r.position.set(this.O.x, 0, 0);
    this.mode = mode; this.ox = ox;
  }
  /** car 模式：站台坐标 → 车厢坐标（车厢中心 x = EO.x，站台在 +z 一侧），再往前挪 ox（进站时从前面滑过来） */
  place(eoX, ox) { this.kit.root.position.set(eoX - EMU.xc + ox, 0, -GZE.tz); }
  info() { return { mode: this.mode, station: !!this.station, stationOn: !!(this.station && this.station.root.isEnabled()) }; }
}
