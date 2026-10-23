/*
 * 厦门地铁出站后的街区（独立场景，出站才加载，回到出口亭就卸载）：放在 XS = (4000, 0, 0)。
 *   江头 2 号出口：吕岭路 → 莲龙小学（东南偏南）、莲花小学（西南偏西，映华楼 + 花园校园）
 *   吕厝 12 号出口：莲花公园（密林 + 中间荷花池）
 *   诚毅广场 出口：诚毅南路 / 诚毅东路口往东 → 莲花首岸（8 栋高层，底层架空，只看外观）
 * 距离按真实方向、约 1:4 压缩（孩子走一两分钟就到）。只有外观 / 室外场地，不进楼；没有地面引导条。
 * 坐标：+x 东、+z 南；出口亭在原点，玩家从亭子里往 +z 走出来。
 */
import { Kit } from './kit.js';
import { hex, mix } from '../core/geo.js';
import { FoodAtlas } from '../game/food-art.js';
import * as D from './decor.js';
import { XM_LINES } from '../data/xm-lines.js';
import { xinliEstate, Xinli256 } from './xmXinli.js';
import { exitZh } from '../data/xm-visits.js';
import { ATTR_EXITS, ATTR_BUILD } from './xmAttr.js';

export const XS = { x: 4000, z: 0 };
/** 车站里的出口通道（站厅南墙 x 处开口 → 楼梯上到地面 → 进街区） */
export const XM_EXITS = {
  jtou: { n: '2', x: 10, line: 2, road: '吕岭路', to: ['莲龙小学', '莲花小学'], toEn: ['Lianlong Primary School', 'Lianhua Primary School'] },
  lcu: { n: '12', x: 10, line: 1, road: '嘉禾路', to: ['莲花公园'], toEn: ['Lianhua Park'] },
  cyg: { n: '', x: 10, line: 1, road: '诚毅南路', to: ['莲花首岸'], toEn: ['Lianhua Shou\'an'] },
  hpu: { n: '2', x: 10, line: 2, road: '吕岭路', to: ['鑫利花园'], toEn: ['Xinli Garden'] },
  ...ATTR_EXITS,
};
export const FONT = '"PingFang SC","Hiragino Sans GB","Noto Sans CJK SC","Microsoft YaHei",sans-serif';
export const FONT_EN = '"Helvetica Neue",Arial,sans-serif';

/* ---------- 立面贴图 ---------- */
/** 瓷砖立面：floors 层、bays 开间；arch：顶层拱窗；band：每层白色横带 */
export function facadePaint({ floors, bays, wall = '#A8423A', tile = 0.07, band = '#F1EEE8', glass = '#7FA3B8', frame = '#F4F2EE', grille = true, arch = false, ground = null, balcony = null }) {
  return (c, pw, ph) => {
    c.fillStyle = wall; c.fillRect(0, 0, pw, ph);
    // 瓷砖缝
    c.strokeStyle = 'rgba(255,255,255,0.10)'; c.lineWidth = 1;
    const ts = Math.max(3, pw / bays / 9);
    for (let y = 0; y < ph; y += ts) { c.beginPath(); c.moveTo(0, y); c.lineTo(pw, y); c.stroke(); }
    for (let x = 0; x < pw; x += ts * 1.6) { c.beginPath(); c.moveTo(x, 0); c.lineTo(x, ph); c.stroke(); }
    const fh = ph / floors, bw = pw / bays;
    for (let f = 0; f < floors; f++) {
      const y0 = ph - (f + 1) * fh;
      c.fillStyle = band; c.fillRect(0, y0 + fh - fh * 0.1, pw, fh * 0.1);   // 楼层白色横带
      if (f === 0 && ground) { ground(c, 0, y0, pw, fh); continue; }
      for (let b = 0; b < bays; b++) {
        const x = b * bw + bw * 0.2, w = bw * 0.6, wy = y0 + fh * 0.2, h = fh * 0.58;
        if (balcony && b % 2 === 0) { c.fillStyle = balcony; c.fillRect(b * bw + bw * 0.08, y0 + fh * 0.5, bw * 0.84, fh * 0.4); }
        c.fillStyle = frame; c.fillRect(x - 3, wy - 3, w + 6, h + 6);
        if (arch && f === floors - 1) { c.beginPath(); c.moveTo(x - 3, wy + h * 0.3); c.arc(x + w / 2, wy + h * 0.3, w / 2 + 3, Math.PI, 0); c.lineTo(x + w + 3, wy + h + 3); c.lineTo(x - 3, wy + h + 3); c.fill(); }
        c.fillStyle = glass;
        if (arch && f === floors - 1) { c.beginPath(); c.moveTo(x, wy + h * 0.3); c.arc(x + w / 2, wy + h * 0.3, w / 2, Math.PI, 0); c.lineTo(x + w, wy + h); c.lineTo(x, wy + h); c.fill(); }
        else c.fillRect(x, wy, w, h);
        c.fillStyle = 'rgba(255,255,255,0.25)'; c.fillRect(x + w * 0.06, wy + h * 0.08, w * 0.12, h * 0.8);
        if (grille) { c.strokeStyle = 'rgba(230,232,235,0.9)'; c.lineWidth = Math.max(1, w * 0.03); for (let i = 1; i < 6; i++) { const gx = x + w * i / 6; c.beginPath(); c.moveTo(gx, wy + (arch && f === floors - 1 ? h * 0.1 : 0)); c.lineTo(gx, wy + h); c.stroke(); } }
      }
    }
  };
}
/** 门柱竖排字：每个字一行，按柱面宽高缩放到放得下 */
export function pillarText(t, bg = '#B8463A', fg = '#F6D36B') {
  return (c, pw, ph) => {
    c.fillStyle = bg; c.fillRect(0, 0, pw, ph); c.fillStyle = fg; c.textAlign = 'center'; c.textBaseline = 'middle';
    const ch = [...t], sz = Math.min(pw * 0.72, ph * 0.86 / ch.length); c.font = `800 ${sz}px ${FONT}`;
    ch.forEach((x, i) => c.fillText(x, pw / 2, ph / 2 + (i - (ch.length - 1) / 2) * sz * 1.08));
  };
}
export function textPaint(lines, { bg = '#B3261E', fg = '#F6D36B', font = FONT, weight = 800, frame = null } = {}) {
  return (c, pw, ph) => {
    c.fillStyle = bg; c.fillRect(0, 0, pw, ph);
    if (frame) { c.strokeStyle = frame; c.lineWidth = ph * 0.05; c.strokeRect(ph * 0.05, ph * 0.05, pw - ph * 0.1, ph - ph * 0.1); }
    c.fillStyle = fg; c.textAlign = 'center'; c.textBaseline = 'middle';
    const n = lines.length;
    lines.forEach((t, i) => { const sz = (i === 0 ? 0.62 : 0.3) * ph / Math.max(1, n * 0.75); c.font = `${i === 0 ? weight : 600} ${sz}px ${i === 0 ? font : FONT_EN}`; c.fillText(t, pw / 2, ph * (n === 1 ? 0.54 : 0.38 + i * 0.36)); });
  };
}

export class XmStreet {
  constructor(scene, code) {
    this.scene = scene; this.code = code; this.ex = XM_EXITS[code];
    const k = this.kit = new Kit(scene, 'xmStreet-' + code); k.root.position.set(XS.x, 0, XS.z);
    this.atlas = new FoodAtlas(scene, 2048);
    { const q = this.atlas.quad.bind(this.atlas); this.atlas.quad = (x, y, z, w, h, a, uv) => q(x, y, z, w, h, Math.PI - a, uv); }   // 本文件约定：a=0 朝 -z、π 朝 +z、±π/2 朝 ±x
    D.reseed(code.length * 97 + code.charCodeAt(0));
    this.ground(); this.kiosk();
    if (code === 'jtou') this.jiangtou(); else if (code === 'lcu') this.lucuo(); else if (code === 'cyg') this.chengyi(); else if (code === 'hpu') this.houpu(); else if (ATTR_BUILD[code]) ATTR_BUILD[code](this);
    k.finish(true); this.atlas.finish(k.root, 'xmStreetSigns');
    if (this.after) this.after();   // 动画件（不冻结），如清水宫上空降落的飞机
    k.root.getChildMeshes(false).forEach(m => { m.receiveShadows = true; });
  }
  dispose() { if (this.inside) { this.inside.dispose(); this.inside = null; } if (this.atlas) this.atlas.dispose(); this.kit.root.getChildMeshes(false).forEach(m => m.dispose()); this.kit.root.dispose(); }
  /** 回到出口亭（往里走）→ 回车站 */
  wantsBack(p) { const lx = p.x - XS.x, lz = p.z - XS.z; return lz < -2.6 && lz > -6 && Math.abs(lx) < 1.9 && p.y < 1.5; }
  spawn() { return [XS.x, 0.05, XS.z + 1.2, 0]; }
  zoneOf(p) { return this.inside ? { ...this.inside.zoneOf(p), code: this.code, street: true } : { kind: 'street', net: 'xm', code: this.code, street: true }; }
  info() { return { code: this.code, meshes: this.kit.root.getChildMeshes(false).length, atlasOverflow: this.atlas.overflow, atlasY: this.atlas.y + this.atlas.row, inside: this.inside ? 256 : null }; }
  /** 每帧：楼内 ↔ 街面切换；返回 'back' = 回车站 */
  update(pl) {
    const p = pl.position;
    if (this.tick) this.tick(Math.min(0.1, this.scene.getEngine().getDeltaTime() / 1000));
    if (this.inside) { if (this.inside.wantsOut(p)) this.leaveBuilding(pl); return null; }
    if (this.wantsBack(p)) return 'back';
    const d = this.xinli && this.xinli.door256;
    if (d && Math.abs(p.x - XS.x - d.x) < 1.0 && p.z - XS.z > d.z - 0.5 && p.z - XS.z < d.z + 0.6 && p.y < 1.5) this.enterBuilding(pl);
    return null;
  }
  /** 进 256 号楼：楼梯间 + 各户单独加载（街区先隐藏） */
  enterBuilding(pl) {
    this.kit.root.setEnabled(false);
    this.inside = new Xinli256(this.scene, { x: XS.x, y: 0, z: XS.z + 1000 });
    const [x, y, z, yaw] = this.inside.spawn(); pl.spawn(x, y, z, yaw);
  }
  leaveBuilding(pl) {
    this.inside.dispose(); this.inside = null; this.kit.root.setEnabled(true);
    const d = this.xinli.door256; pl.spawn(XS.x + d.x, 0.05, XS.z + d.z - 1.6, Math.PI);
  }

  /* ---------- 通用 ---------- */
  ground() {
    const k = this.kit;
    k.floorWithHoles(-160, 160, -60, 200, -0.6, 0, hex('#D6D2CA'), [], true, 'pave');
    k.colSlab(-161, -160, 0, 8, -60, 200); k.colSlab(160, 161, 0, 8, -60, 200); k.colSlab(-160, 160, 0, 8, -61, -60); k.colSlab(-160, 160, 0, 8, 200, 201);
  }
  road(x0, x1, z0, z1, alongX, name) {
    const k = this.kit, P = k.solid, A = k.g('asphalt');
    A.slab(x0, x1, 0, 0.012, z0, z1, hex('#8E9094'), { ao: false });
    if (alongX) {
      const zc = (z0 + z1) / 2; for (const z of [zc - 0.12, zc + 0.12]) P.slab(x0, x1, 0.012, 0.016, z - 0.05, z + 0.05, hex('#F2C230'), { ao: false });
      for (let x = x0 + 2; x < x1 - 2; x += 9) for (const z of [z0 + (z1 - z0) * 0.25, z0 + (z1 - z0) * 0.75]) P.slab(x, x + 4.5, 0.012, 0.016, z - 0.07, z + 0.07, hex('#F2F2F2'), { ao: false });
      for (const zk of [z0, z1]) P.slab(x0, x1, 0, 0.14, zk - 0.11, zk + 0.11, hex('#BFC2C4'), { ao: false });
    } else {
      const xc = (x0 + x1) / 2; for (const x of [xc - 0.12, xc + 0.12]) P.slab(x - 0.05, x + 0.05, 0.012, 0.016, z0, z1, hex('#F2C230'), { ao: false });
      for (let z = z0 + 2; z < z1 - 2; z += 9) for (const x of [x0 + (x1 - x0) * 0.25, x0 + (x1 - x0) * 0.75]) P.slab(x - 0.07, x + 0.07, 0.012, 0.016, z, z + 4.5, hex('#F2F2F2'), { ao: false });
      for (const xk of [x0, x1]) P.slab(xk - 0.11, xk + 0.11, 0, 0.14, z0, z1, hex('#BFC2C4'), { ao: false });
    }
    if (name) this.roadSign(alongX ? x0 + 6 : x1 + 1.2, alongX ? z1 + 1.2 : z0 + 6, name, alongX ? 0 : Math.PI / 2);
  }
  roadSign(x, z, name, ry) {
    const k = this.kit; k.metal.cyl(x, 1.4, z, 0.08, 2.8, hex('#8A9198'), 8);
    this.atlas.quad(x, 2.9, z - 0.02, 1.8, 0.5, ry, this.atlas.draw(1.8, 0.5, textPaint([name], { bg: '#1F5FA8', fg: '#FFFFFF' })));
    this.atlas.quad(x, 2.9, z + 0.02, 1.8, 0.5, ry + Math.PI, this.atlas.draw(1.8, 0.5, textPaint([name], { bg: '#1F5FA8', fg: '#FFFFFF' })));
  }
  /** 厦门地铁出入口亭：灰框玻璃 + 顶上线路色 + 出口号；往 -z 是下去的楼梯 */
  kiosk() {
    const k = this.kit, ex = this.ex, lc = XM_LINES[ex.line].color, P = k.solid, M = k.metal;
    P.slab(-2.6, 2.6, 0, 0.06, -6.4, 0.4, hex('#B9B5AD'), { ao: false });
    for (let i = 0; i < 10; i++) { const z = -2.8 - i * 0.36, y = -0.18 - i * 0.24; P.slab(-1.8, 1.8, y - 0.08, y, z - 0.36, z, hex(i % 2 ? '#C9C5BD' : '#BDB9B1'), { ao: false }); P.slab(-1.75, 1.75, y, y + 0.004, z - 0.06, z, hex('#3A3F45'), { ao: false }); }   // 往下的踏步（看得到，走不下去：走进去就回车站）
    P.slab(-1.9, 1.9, -3, -2.9, -6.4, -2.6, hex('#1B1E22'), { ao: false });
    for (const sx of [-1, 1]) { k.glass.slab(sx * 2.5 - 0.02, sx * 2.5 + 0.02, 0.06, 2.9, -6.3, -0.2, hex('#D6EEF8')); k.colSlab(sx * 2.5 - 0.1, sx * 2.5 + 0.1, 0, 3, -6.4, 0.2); M.slab(sx * 2.5 - 0.08, sx * 2.5 + 0.08, 0, 3.1, 0.1, 0.3, hex('#5C646C'), { ao: false }); M.slab(sx * 2.5 - 0.08, sx * 2.5 + 0.08, 0, 3.1, -6.4, -6.2, hex('#5C646C'), { ao: false }); }
    k.glass.slab(-2.5, 2.5, 0.06, 2.9, -6.34, -6.3, hex('#D6EEF8')); k.colSlab(-2.6, 2.6, 0, 3, -6.6, -6.3);
    for (const sx of [-1, 1]) { k.rail(sx * 1.9, -2.6, sx * 1.9, -6.2, 0); k.colSlab(sx * 1.9 - 0.05, sx * 1.9 + 0.05, 0, 1.2, -6.2, -2.6); }
    M.slab(-2.9, 2.9, 3.0, 3.25, -6.8, 0.7, hex('#6E767E'), { ao: false });
    k.g('band').slab(-2.92, 2.92, 2.75, 3.0, 0.62, 0.72, hex(lc), { ao: false });
    const sign = (c, pw, ph) => {
      c.fillStyle = '#20272E'; c.fillRect(0, 0, pw, ph);
      c.fillStyle = lc; c.fillRect(0, 0, ph, ph); c.fillStyle = '#FFF'; c.textAlign = 'center'; c.textBaseline = 'middle';
      c.font = `800 ${ph * 0.6}px ${FONT_EN}`; c.fillText(ex.n || '出', ph / 2, ph * 0.54);
      c.textAlign = 'left'; c.font = `800 ${ph * 0.36}px ${FONT}`; c.fillText('厦门地铁' + (ex.n ? `  ${exitZh(ex.n)}` : '  出口'), ph * 1.2, ph * 0.38);
      c.font = `600 ${ph * 0.2}px ${FONT_EN}`; c.fillText('Xiamen Metro' + (ex.n ? ` · Exit ${ex.n}` : ' · Exit'), ph * 1.2, ph * 0.74);
    };
    this.atlas.quad(0, 3.55, 0.72, 5.4, 0.62, Math.PI, this.atlas.draw(5.4, 0.62, sign));
    M.slab(-2.7, 2.7, 3.25, 3.86, 0.6, 0.7, hex('#20272E'), { ao: false });
    k.shade.shadeBlob(0, -2.8, 3.4, 4.2, 0.07, 0.25);
  }
  /** 轻一点的树（4 团树冠，密林用） */
  lightTree(x, z, s = 1, kind = 0) {
    const P = this.kit.solid, cy = 3.4 * s, R = 1.9 * s, greens = kind ? ['#4E8F3E', '#5C9E47', '#447F37'] : ['#3B7F3F', '#4A9147', '#336F36'];
    P.cyl(x, 1.4 * s, z, 0.32 * s, 2.8 * s, hex('#6A5340'), 6);
    P.ellipsoid(x, cy, z, R * 1.7, R * 1.15, R * 1.7, hex(greens[0]), 1);
    P.ellipsoid(x + R * 0.5, cy + R * 0.35, z - R * 0.3, R * 1.1, R * 0.85, R * 1.1, hex(greens[1]), 1);
    P.ellipsoid(x - R * 0.45, cy + R * 0.25, z + R * 0.4, R * 1.05, R * 0.8, R * 1.05, hex(greens[2]), 1);
    this.kit.shade.shadeBlob(x, z, 2 * s, 2 * s, 0.02, 0.28, 0, 10);
  }
  fence(x0, z0, x1, z1, gaps = [], h = 1.8, pick = 8) {
    const NOAO = { ao: false };
    const k = this.kit, M = k.metal, len = Math.hypot(x1 - x0, z1 - z0), ux = (x1 - x0) / len, uz = (z1 - z0) / len, n = Math.ceil(len / 2.4);
    for (let i = 0; i < n; i++) {
      const a = i / n * len, b = (i + 1) / n * len, m = (a + b) / 2;
      if (gaps.some(([g0, g1]) => m > g0 && m < g1)) continue;
      const ax = x0 + ux * a, az = z0 + uz * a, bx = x0 + ux * b, bz = z0 + uz * b;
      const ry = Math.atan2(ux, uz);
      M.box((ax + bx) / 2, h - 0.05, (az + bz) / 2, 0.06, 0.06, b - a, hex('#2F3A33'), ry);
      M.box((ax + bx) / 2, 0.25, (az + bz) / 2, 0.06, 0.06, b - a, hex('#2F3A33'), ry);
      for (let j = 0; j < pick; j++) { const t = (j + 0.5) / pick; M.box(ax + (bx - ax) * t, h / 2, az + (bz - az) * t, 0.03, h, 0.03, hex('#2F3A33'), 0, 0, 0, 1, NOAO); }   // 细栏杆不做 AO 分段（省三角形）
      M.box(ax, h / 2 + 0.05, az, 0.1, h + 0.1, 0.1, hex('#25302A'), 0, 0, 0, 1, NOAO);
      k.col((ax + bx) / 2, h / 2, (az + bz) / 2, 0.2, h, b - a, { ry });
    }
  }
  /** 有贴图立面的楼：box + 四面贴图（长面 / 端面各一张） */
  facadeBlock(x, z, w, d, h, wallCol, paintLong, paintEnd, y0 = 0) {
    const k = this.kit, A = this.atlas;
    k.solid.slab(x - w / 2, x + w / 2, y0, y0 + h, z - d / 2, z + d / 2, hex(wallCol), { ao: false });
    k.colSlab(x - w / 2, x + w / 2, y0, y0 + h, z - d / 2, z + d / 2);
    const uvL = A.draw(w, h, paintLong, 17), uvE = A.draw(d, h, paintEnd || paintLong, 17);
    A.quad(x, y0 + h / 2, z - d / 2 - 0.03, w, h, 0, uvL); A.quad(x, y0 + h / 2, z + d / 2 + 0.03, w, h, Math.PI, uvL);
    A.quad(x - w / 2 - 0.03, y0 + h / 2, z, d, h, -Math.PI / 2, uvE); A.quad(x + w / 2 + 0.03, y0 + h / 2, z, d, h, Math.PI / 2, uvE);
    k.solid.slab(x - w / 2 - 0.25, x + w / 2 + 0.25, y0 + h, y0 + h + 0.5, z - d / 2 - 0.25, z + d / 2 + 0.25, hex('#E9E5DD'), { ao: false });
    k.shade.shadeRoom(x - w / 2, x + w / 2, z - d / 2, z + d / 2, 0.012, 1.0, 0.25);
  }
  filler(list) { for (const [x, z, w, d, h, col] of list) D.building(this.kit, x, z, w, d, h, col); }

  /* ---------- 江头 2 号出口：莲龙小学 + 莲花小学 ---------- */
  jiangtou() {
    const k = this.kit, P = k.solid, A = this.atlas;
    this.road(-160, 160, -22, -8, true, '吕岭路');           // 吕岭路（东西向，出口在路南）
    this.road(14, 26, -8, 200, false, '龙翔里');              // 往南的小路
    this.road(-160, 14, 44, 54, true, '莲花北路');             // 往西去莲花小学
    for (let x = -150; x <= 150; x += 12) if (Math.abs(x) > 6) this.lightTree(x, -6.2, 0.8);
    for (let z = 4; z < 190; z += 12) { this.lightTree(12, z, 0.75); this.lightTree(28, Math.abs(z - 88) < 8 ? z + 9 : z, 0.75); }   // 莲龙小学校门（z 81..95）前不种树，挪到门柱外
    for (const x of [-8, 8]) D.lamp(k, x, 0, -6.6, Math.PI);
    D.bench(k, -6, 0, 3, Math.PI / 2); D.bin(k, 5, 0, 3);
    // —— 莲龙小学（东南偏南 ~290 m → 约 70 m）：校门朝西开在龙翔里上 ——
    const SX = 30, SZ = 58, SW = 60, SD = 64;   // 校园 x 30..90, z 58..122
    this.fence(SX, SZ, SX + SW, SZ, []); this.fence(SX + SW, SZ, SX + SW, SZ + SD, []); this.fence(SX, SZ + SD, SX + SW, SZ + SD, []);
    this.fence(SX, SZ, SX, SZ + SD, [[24, 36]]);
    // 校门：两根门柱 + 校名（金字红底）+ 伸缩门（拉开一半）+ 门卫室
    const gz = SZ + 30;
    for (const dz of [-6.2, 6.2]) { P.slab(SX - 0.7, SX + 0.7, 0, 3.4, gz + dz - 0.7, gz + dz + 0.7, hex('#B8463A'), { ao: false }); P.slab(SX - 0.8, SX + 0.8, 3.4, 3.6, gz + dz - 0.8, gz + dz + 0.8, hex('#F1EEE8'), { ao: false }); k.colSlab(SX - 0.7, SX + 0.7, 0, 3.4, gz + dz - 0.7, gz + dz + 0.7); }
    A.quad(SX - 0.72, 2.5, gz - 6.2, 1.2, 1.6, -Math.PI / 2, A.draw(1.2, 1.6, pillarText('小学')));
    A.quad(SX - 0.72, 2.5, gz + 6.2, 1.2, 1.6, -Math.PI / 2, A.draw(1.2, 1.6, pillarText('莲龙')));
    P.slab(SX - 0.5, SX + 0.5, 3.6, 4.4, gz - 7, gz + 7, hex('#9C352C'), { ao: false });
    A.quad(SX - 0.53, 4.0, gz, 12, 0.75, -Math.PI / 2, A.draw(12, 0.75, textPaint(['厦门市莲龙小学'], { bg: '#9C352C', fg: '#F6D36B' })));
    { // 伸缩门（银灰不锈钢，拉开一半）：竖杆 + 交叉斜杆 + 上下横杆 + 底轮；门头机箱在靠柱一端
      const SG = hex('#C3C8CD'), SD = hex('#9EA5AC'), za = gz + 0.6, zb = gz + 5.45, n = 10, cw = (zb - za) / n, ang = Math.atan2(cw, 1.2), dl = Math.hypot(cw, 1.2);
      for (let i = 0; i <= n; i++) { const z = za + i * cw; P.slab(SX - 0.04, SX + 0.04, 0.12, 1.5, z - 0.025, z + 0.025, SG, { ao: false }); }
      for (let i = 0; i < n; i++) { const z = za + (i + 0.5) * cw; for (const sg of [-1, 1]) P.box(SX + sg * 0.02, 0.8, z, 0.025, dl, 0.035, SD, 0, sg * ang); }
      for (const y of [0.16, 1.44]) P.slab(SX - 0.05, SX + 0.05, y - 0.03, y + 0.03, za, zb, SG, { ao: false });
      for (let i = 0; i <= n; i += 2) P.cyl(SX, 0.06, za + i * cw, 0.12, 0.08, hex('#3A3D40'), 6, 0, 0, Math.PI / 2);
      P.slab(SX - 0.22, SX + 0.22, 0, 1.6, zb, zb + 0.35, hex('#D4D8DC'), { ao: false });   // 机头
    }
    k.colSlab(SX - 0.2, SX + 0.2, 0, 1.6, gz + 0.5, gz + 5.8);
    P.slab(SX + 1.5, SX + 4.5, 0, 2.8, gz - 10.5, gz - 7.5, hex('#E8E4DC'), { ao: false }); k.glass.slab(SX + 1.48, SX + 1.52, 1.0, 2.2, gz - 10, gz - 8, hex('#BFD8E6')); P.slab(SX + 1.3, SX + 4.7, 2.8, 3.0, gz - 10.7, gz - 7.3, hex('#9C352C'), { ao: false }); k.colSlab(SX + 1.5, SX + 4.5, 0, 2.8, gz - 10.5, gz - 7.5);
    // 教学楼（4 层红砖色瓷砖、白横带、顶层拱窗、红色门廊）：南北向长条，面朝西（校门）
    const tb = facadePaint({ floors: 4, bays: 12, arch: true, ground: (c, x, y, w, h) => { const bw = w / 12; for (let b = 0; b < 12; b++) { if (b === 5 || b === 6) continue; c.fillStyle = '#F4F2EE'; c.fillRect(b * bw + bw * 0.2 - 3, y + h * 0.2 - 3, bw * 0.6 + 6, h * 0.58 + 6); c.fillStyle = '#7FA3B8'; c.fillRect(b * bw + bw * 0.2, y + h * 0.2, bw * 0.6, h * 0.58); } c.fillStyle = '#3B3330'; c.fillRect(5 * bw + bw * 0.15, y + h * 0.2, bw * 1.7, h * 0.8); } });
    const te = facadePaint({ floors: 4, bays: 4, arch: true });
    this.facadeBlock(SX + 44, SZ + 32, 12, 44, 14.4, '#A8423A', te, tb);
    // 红色门廊 + 名字
    P.slab(SX + 36.4, SX + 38, 0, 3.6, SZ + 28.5, SZ + 29.1, hex('#F1EEE8'), { ao: false }); P.slab(SX + 36.4, SX + 38, 0, 3.6, SZ + 34.9, SZ + 35.5, hex('#F1EEE8'), { ao: false });
    P.slab(SX + 36, SX + 38, 3.6, 4.3, SZ + 28, SZ + 36, hex('#C8322A'), { ao: false });
    A.quad(SX + 37.9, 6.3, SZ + 32, 7, 1.0, -Math.PI / 2, A.draw(7, 1.0, textPaint(['厦门市莲龙小学'], { bg: '#A8423A', fg: '#F6D36B' })));
    // 综合楼（3 层，北边东西向）
    const cb = facadePaint({ floors: 3, bays: 8 }), ce = facadePaint({ floors: 3, bays: 3 });
    this.facadeBlock(SX + 30, SZ + 7, 30, 10, 11, '#A8423A', cb, ce);
    // 200 m 塑胶跑道（红）+ 中间草坪；南半边
    const tcx = SX + 22, tcz = SZ + 48, L = 18, R0 = 7, R1 = 10.6;
    const G = k.g('grass'), RB = k.g('paint@track');
    G.slab(tcx - L / 2, tcx + L / 2, 0.02, 0.07, tcz - R0, tcz + R0, hex('#FFFFFF'), { ao: false });
    for (const sz of [-1, 1]) RB.slab(tcx - L / 2, tcx + L / 2, 0.02, 0.06, sz < 0 ? tcz - R1 : tcz + R0, sz < 0 ? tcz - R0 : tcz + R1, hex('#B5473A'), { ao: false });
    const N = 18;
    for (const sx of [-1, 1]) for (let i = 0; i < N; i++) {
      const a0 = -Math.PI / 2 + i / N * Math.PI, a1 = -Math.PI / 2 + (i + 1) / N * Math.PI, cx = tcx + sx * L / 2;
      const p = (a, r) => [cx + sx * Math.cos(a) * r, 0.06, tcz + Math.sin(a) * r];
      RB.quad(p(a0, R0), p(a1, R0), p(a1, R1), p(a0, R1), hex('#B5473A'));
      RB.quad(p(a0, R1), p(a1, R1), p(a1, R0), p(a0, R0), hex('#B5473A'));
      const g = (a, r) => [cx + sx * Math.cos(a) * r, 0.07, tcz + Math.sin(a) * r];
      G.quad(g(a0, 0), g(a1, 0), g(a1, R0), g(a0, R0), hex('#FFFFFF')); G.quad(g(a0, R0), g(a1, R0), g(a1, 0), g(a0, 0), hex('#FFFFFF'));
      for (const r of [7.9, 8.8, 9.7]) { const q = (a, rr) => [cx + sx * Math.cos(a) * rr, 0.065, tcz + Math.sin(a) * rr]; P.quad(q(a0, r - 0.04), q(a1, r - 0.04), q(a1, r + 0.04), q(a0, r + 0.04), hex('#F4F2EE')); P.quad(q(a0, r + 0.04), q(a1, r + 0.04), q(a1, r - 0.04), q(a0, r - 0.04), hex('#F4F2EE')); }
    }
    for (const r of [7.9, 8.8, 9.7]) for (const sz of [-1, 1]) P.slab(tcx - L / 2, tcx + L / 2, 0.06, 0.065, tcz + sz * r - 0.04, tcz + sz * r + 0.04, hex('#F4F2EE'), { ao: false });
    // 校园铺地 + 树
    P.slab(SX + 0.2, SX + 36, 0.005, 0.02, SZ + 24, SZ + 36, hex('#CFC7BA'), { ao: false });
    for (const [x, z] of [[SX + 4, SZ + 4], [SX + 12, SZ + 4], [SX + 4, SZ + 60], [SX + 14, SZ + 61], [SX + 56, SZ + 60], [SX + 57, SZ + 4]]) this.lightTree(x, z, 0.9);
    // 庭院雕塑「腾飞」：花岗岩基座 + 三条上旋的金色飘带 + 顶上一颗球
    const yx = SX + 24, yz = SZ + 30;
    k.g('granite').slab(yx - 1.6, yx + 1.6, 0, 0.6, yz - 1.6, yz + 1.6, hex('#CFCBC2'), { ao: false }); k.colSlab(yx - 1.6, yx + 1.6, 0, 0.6, yz - 1.6, yz + 1.6);
    A.quad(yx - 1.62, 0.32, yz, 2.2, 0.4, -Math.PI / 2, A.draw(2.2, 0.4, textPaint(['腾飞'], { bg: '#CFCBC2', fg: '#7A2E22' })));
    for (let r = 0; r < 3; r++) { const pts = []; for (let i = 0; i <= 14; i++) { const t = i / 14, a = r * 2.094 + t * 3.4, rr = 0.9 * (1 - t * 0.7); pts.push([yx + Math.cos(a) * rr, 0.6 + t * 5.2, yz + Math.sin(a) * rr]); }
      for (let i = 0; i < pts.length - 1; i++) k.metal.tubeTaper(pts[i], pts[i + 1], 0.34 - i * 0.016, 0.32 - i * 0.016, hex(r === 1 ? '#E0B04A' : '#D49A36'), 6); }
    k.metal.sphere(yx, 6.0, yz, 0.6, hex('#E8C25A'), 1);
    // —— 莲花小学（西南偏西 ~340 m → 约 85 m）：花园校园 + 映华楼（2025 新楼）——
    this.lianhuaSchool(-96, 56);
    // 莲花北路（转向南、贴着莲花小学西边），西侧一排老店面；35-104 号：新疆麦麦提烤羊肉王（学校往南偏西 ~100 m → ~25 m）
    this.road(-106, -98, 54, 200, false, null);
    this.kebab(-110, 112, 120);
    D.building(k, -116, 102, 12, 16, 10, '#B9A48E'); D.building(k, -116, 130, 12, 16, 13, '#A99782'); k.colSlab(-122, -110, 0, 10, 94, 110); k.colSlab(-122, -110, 0, 13, 122, 138);
    for (let z = 60; z < 196; z += 11) if (z < 108 || z > 124) this.lightTree(-97.2, z, 0.8);
    this.filler([[60, -40, 30, 14, 26, '#C9C2B6'], [-40, -42, 34, 14, 32, '#D8D2C6'], [-110, -40, 30, 14, 22, '#BFB6A8'], [110, -40, 26, 14, 30, '#CDC5B8'], [52, 160, 30, 20, 18, '#D2CABE'], [-60, 120, 26, 18, 20, '#C6BEB1'], [120, 90, 20, 30, 24, '#D9D3C8']]);
  }
  lianhuaSchool(X0, Z0) {
    const k = this.kit, P = k.solid, A = this.atlas, W = 56, Dp = 52;   // 校园 x X0..X0+W, z Z0..Z0+Dp；校门朝北开在莲花北路
    this.fence(X0, Z0, X0 + W, Z0, [[34, 46]], 1.6); this.fence(X0, Z0, X0, Z0 + Dp, [], 1.6); this.fence(X0 + W, Z0, X0 + W, Z0 + Dp, [], 1.6); this.fence(X0, Z0 + Dp, X0 + W, Z0 + Dp, [], 1.6);
    const gx = X0 + 40;
    for (const dx of [-6, 6]) { P.slab(gx + dx - 0.6, gx + dx + 0.6, 0, 3.0, Z0 - 0.6, Z0 + 0.6, hex('#E9E3D6'), { ao: false }); k.colSlab(gx + dx - 0.6, gx + dx + 0.6, 0, 3, Z0 - 0.6, Z0 + 0.6); }
    P.slab(gx - 6.6, gx + 6.6, 3.0, 3.7, Z0 - 0.45, Z0 + 0.45, hex('#3E6B4F'), { ao: false });
    A.quad(gx, 3.35, Z0 - 0.48, 11, 0.62, 0, A.draw(11, 0.62, textPaint(['厦门市莲花小学'], { bg: '#3E6B4F', fg: '#F4E6B8' })));
    // 映华楼：5 层，浅米色 + 陶土色竖向遮阳条 + 大玻璃窗（新楼）
    const yh = (c, pw, ph) => {
      c.fillStyle = '#EFE9DE'; c.fillRect(0, 0, pw, ph);
      const fl = 5, fh = ph / fl, bays = 10, bw = pw / bays;
      for (let f = 0; f < fl; f++) { const y0 = ph - (f + 1) * fh; for (let b = 0; b < bays; b++) { c.fillStyle = '#6F93A8'; c.fillRect(b * bw + bw * 0.12, y0 + fh * 0.18, bw * 0.76, fh * 0.64); c.fillStyle = 'rgba(255,255,255,0.25)'; c.fillRect(b * bw + bw * 0.16, y0 + fh * 0.22, bw * 0.1, fh * 0.56); c.fillStyle = '#B9673F'; c.fillRect(b * bw - bw * 0.04, y0, bw * 0.08, fh); }
        c.fillStyle = '#FFFFFF'; c.fillRect(0, y0 + fh * 0.88, pw, fh * 0.08); c.fillStyle = 'rgba(80,140,70,0.85)'; for (let b = 0; b < bays; b++) c.fillRect(b * bw + bw * 0.12, y0 + fh * 0.82, bw * 0.76, fh * 0.06); }
      c.fillStyle = '#B9673F'; c.font = `800 ${fh * 0.38}px ${FONT}`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('映华楼', pw * 0.5, ph - fh * 4.55);
    };
    const ye = (c, pw, ph) => { c.fillStyle = '#EFE9DE'; c.fillRect(0, 0, pw, ph); for (let i = 0; i < 6; i++) { c.fillStyle = '#B9673F'; c.fillRect(pw * (0.1 + i * 0.16), 0, pw * 0.05, ph); } };
    this.facadeBlock(X0 + 22, Z0 + 38, 34, 12, 18.5, '#EFE9DE', yh, ye);
    // 花园：草坪、花坛（绿篱 + 花）、紫藤廊架、小凉亭、很多树
    const G = k.g('grass');
    G.slab(X0 + 2, X0 + 30, 0.01, 0.08, Z0 + 4, Z0 + 28, hex('#FFFFFF'), { ao: false });
    P.slab(X0 + 34, X0 + 46, 0.005, 0.02, Z0 + 0.5, Z0 + 31, hex('#D4CBBC'), { ao: false });
    for (const [x0, z0] of [[X0 + 6, Z0 + 8], [X0 + 18, Z0 + 8], [X0 + 6, Z0 + 18], [X0 + 18, Z0 + 18]]) { D.hedge(k, x0, x0 + 7, z0, z0 + 5, 0.08, 0.6); for (let i = 0; i < 8; i++) P.sphere(x0 + 1 + (i % 4) * 1.6, 0.8, z0 + 1.4 + Math.floor(i / 4) * 2.2, 0.36, hex(['#E85A7A', '#F2C230', '#F07FA8', '#FFFFFF'][i % 4]), 1); }
    // 廊架
    for (let i = 0; i < 6; i++) { const z = Z0 + 5 + i * 4; for (const x of [X0 + 49, X0 + 53]) { P.cyl(x, 1.3, z, 0.22, 2.6, hex('#8B5E3C'), 8); k.colSlab(x - 0.15, x + 0.15, 0, 2.6, z - 0.15, z + 0.15); } P.slab(X0 + 48.4, X0 + 53.6, 2.6, 2.8, z - 0.12, z + 0.12, hex('#7A5034'), { ao: false }); }
    for (let i = 0; i < 12; i++) P.ellipsoid(X0 + 51, 3.0, Z0 + 4 + i * 1.9, 1.6, 0.4, 1.0, hex(i % 3 ? '#5E9A4E' : '#9D7FC8'), 1);
    // 凉亭
    const px = X0 + 10, pz = Z0 + 30;
    for (const [dx, dz] of [[-1.5, -1.5], [1.5, -1.5], [-1.5, 1.5], [1.5, 1.5]]) { P.cyl(px + dx, 1.3, pz + dz, 0.22, 2.6, hex('#A23B2C'), 8); k.colSlab(px + dx - 0.15, px + dx + 0.15, 0, 2.6, pz + dz - 0.15, pz + dz + 0.15); }
    P.cyl(px, 3.1, pz, 5.2, 0.9, hex('#2F6B57'), 4, Math.PI / 4, 0, 0, 0.3);
    for (const [x, z] of [[X0 + 3, Z0 + 3], [X0 + 3, Z0 + 26], [X0 + 30, Z0 + 3], [X0 + 30, Z0 + 26], [X0 + 46, Z0 + 46], [X0 + 4, Z0 + 47], [X0 + 52, Z0 + 47], [X0 + 26, Z0 + 2.5], [X0 + 14, Z0 + 2.5]]) this.lightTree(x, z, 0.85, 1);
  }

  /* ---------- 后埔 2 号出口：鑫利花园（吕岭路 250–266 号，往西南 ~200 m → 约 50 m） ---------- */
  houpu() {
    const k = this.kit;
    this.road(-160, 160, -22, -8, true, '吕岭路');
    for (let x = -150; x <= 150; x += 12) if (Math.abs(x) > 6 && (x > -30 || x < -132)) this.lightTree(x, -6.2, 0.8);
    for (const x of [-8, 8]) D.lamp(k, x, 0, -6.6, Math.PI);
    this.xinli = xinliEstate(this);
    this.filler([[60, -40, 30, 14, 30, '#C9C2B6'], [-40, -42, 34, 14, 24, '#D8D2C6'], [-110, -40, 30, 14, 34, '#BFB6A8'], [110, -40, 26, 14, 22, '#CDC5B8'], [40, 50, 30, 30, 28, '#D2CABE'], [-80, 120, 40, 20, 26, '#C6BEB1']]);
  }
  /** 莲花北路 35-104：新疆麦麦提烤羊肉王（红底白字招牌、门口炭烤槽 + 串架、矮桌塑料凳） */
  kebab(x1, z0, z1) {
    const k = this.kit, P = k.solid, A = this.atlas, M = k.metal, x0 = x1 - 12, h = 10.2, zc = (z0 + z1) / 2, W = z1 - z0;
    // 三层老店面：上面两层是住宅（棕色面砖 + 防盗网窗），底层店面敞开
    P.slab(x0, x1, 3.4, h, z0, z1, hex('#9C6B55'), { ao: false }); k.colSlab(x0, x1, 0, h, z0, z0 + 0.3); k.colSlab(x0, x1, 0, h, z1 - 0.3, z1); k.colSlab(x0, x0 + 0.3, 0, h, z0, z1);
    const up = (c, pw, ph) => { c.fillStyle = '#9C6B55'; c.fillRect(0, 0, pw, ph); c.strokeStyle = 'rgba(255,255,255,0.1)'; for (let y = 0; y < ph; y += 6) { c.beginPath(); c.moveTo(0, y); c.lineTo(pw, y); c.stroke(); }
      for (let f = 0; f < 2; f++) for (let b = 0; b < 3; b++) { const bw = pw / 3, x = b * bw + bw * 0.18, y = ph * (f * 0.5 + 0.12), w = bw * 0.64, hh = ph * 0.3; c.fillStyle = '#EDEAE4'; c.fillRect(x - 3, y - 3, w + 6, hh + 6); c.fillStyle = '#6F8C9E'; c.fillRect(x, y, w, hh); c.strokeStyle = '#DADDE0'; c.lineWidth = 2; for (let i = 1; i < 6; i++) { c.beginPath(); c.moveTo(x + w * i / 6, y); c.lineTo(x + w * i / 6, y + hh); c.stroke(); } } };
    A.quad(x1 + 0.03, 3.4 + (h - 3.4) / 2, zc, W, h - 3.4, Math.PI / 2, A.draw(W, h - 3.4, up, 40));
    // 底层店内：白瓷砖墙 + 地砖 + 里面两张桌子
    P.slab(x0 + 0.3, x1, 0.0, 0.03, z0 + 0.3, z1 - 0.3, hex('#D9D4CA'), { ao: false });
    P.slab(x0 + 0.3, x0 + 0.4, 0, 3.4, z0 + 0.3, z1 - 0.3, hex('#F4E6C8'), { ao: false });
    for (const [za, zb] of [[z0, z0 + 0.3], [z1 - 0.3, z1]]) P.slab(x0, x1, 0, 3.4, za, zb, hex('#F4E6C8'), { ao: false });   // 店面两侧墙（原来只有碰撞，看得见天）
    P.slab(x0 + 0.3, x1, 3.2, 3.4, z0 + 0.3, z1 - 0.3, hex('#F6E2B8'), { ao: false });
    for (const dz of [-2.2, 0, 2.2]) k.glow.slab(x0 + 2.5, x1 - 2.5, 3.16, 3.2, zc + dz - 0.18, zc + dz + 0.18, hex('#FFC864'), { ao: false });   // 暖黄灯管
    // 后墙菜单板（深红底、黄字价目）
    A.quad(x0 + 0.42, 2.15, zc, 4.4, 1.5, Math.PI / 2, A.draw(4.4, 1.5, (c, pw, ph) => { c.fillStyle = '#7A1414'; c.fillRect(0, 0, pw, ph); c.strokeStyle = '#F2C24E'; c.lineWidth = ph * 0.02; c.strokeRect(ph * 0.03, ph * 0.03, pw - ph * 0.06, ph - ph * 0.06);
      c.fillStyle = '#FFE08A'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.font = `800 ${ph * 0.16}px ${FONT}`; c.fillText('菜 单', pw / 2, ph * 0.15);
      const items = [['羊肉串', '3元/串'], ['红柳大串', '12元'], ['烤腰子', '8元'], ['烤馕', '5元'], ['拌面', '18元'], ['抓饭', '22元']];
      c.font = `700 ${ph * 0.11}px ${FONT}`; items.forEach(([n, v], i) => { const col = i % 2, row = (i / 2) | 0, x = pw * (col ? 0.53 : 0.07), y = ph * (0.38 + row * 0.22); c.textAlign = 'left'; c.fillStyle = '#FFFFFF'; c.fillText(n, x, y); c.textAlign = 'right'; c.fillStyle = '#FFE08A'; c.fillText(v, x + pw * 0.4, y); }); }, 120));
    // 招牌：红底白字
    P.slab(x1, x1 + 0.25, 3.4, 4.6, z0, z1, hex('#C21F1F'), { ao: false });
    A.quad(x1 + 0.27, 4.0, zc, W - 0.2, 1.1, Math.PI / 2, A.draw(W - 0.2, 1.1, (c, pw, ph) => { c.fillStyle = '#C21F1F'; c.fillRect(0, 0, pw, ph); c.fillStyle = '#FFFFFF'; c.textAlign = 'center'; c.textBaseline = 'middle';
      c.font = `800 ${ph * 0.56}px ${FONT}`; let t = '新疆麦麦提烤羊肉王', tw = c.measureText(t).width; if (tw > pw * 0.94) c.font = `800 ${ph * 0.56 * pw * 0.94 / tw}px ${FONT}`; c.fillText(t, pw / 2, ph * 0.42);
      c.font = `600 ${ph * 0.16}px ${FONT}`; c.fillText('羊肉串 · 烤馕 · 拌面 · 抓饭', pw / 2, ph * 0.84); }, 120));
    // 门口炭烤槽：铁皮长槽 + 发红的炭 + 一排羊肉串 + 烟罩
    const gx = x1 + 1.2, g0 = z0 + 1.2, g1 = z0 + 4.2;
    M.slab(gx - 0.25, gx + 0.25, 0.7, 0.95, g0, g1, hex('#3A3D40'), { ao: false }); for (const z of [g0 + 0.1, g1 - 0.1]) M.slab(gx - 0.22, gx + 0.22, 0, 0.7, z - 0.04, z + 0.04, hex('#2C2E30'), { ao: false });
    k.colSlab(gx - 0.3, gx + 0.3, 0, 1.0, g0, g1);
    k.glow.slab(gx - 0.2, gx + 0.2, 0.95, 0.98, g0 + 0.1, g1 - 0.1, hex('#FF6A1E'), { ao: false });
    for (let i = 0; i < 18; i++) { const z = g0 + 0.2 + i * 0.15; M.slab(gx - 0.42, gx + 0.42, 1.0, 1.012, z - 0.006, z + 0.006, hex('#B9BEC3'), { ao: false }); P.slab(gx - 0.18, gx + 0.18, 1.0, 1.04, z - 0.025, z + 0.025, hex(i % 3 ? '#8E4A2E' : '#A85A36'), { ao: false }); }
    // 串架：竖铁架上挂一排排生串
    const rz = g1 + 0.6;
    for (const dz of [0, 1.0]) M.cyl(gx, 0.9, rz + dz, 0.05, 1.8, hex('#8A9198'), 6);
    for (let r = 0; r < 4; r++) { const y = 0.7 + r * 0.32; M.slab(gx - 0.02, gx + 0.02, y, y + 0.02, rz, rz + 1.0, hex('#8A9198'), { ao: false }); for (let i = 0; i < 9; i++) P.slab(gx - 0.12, gx + 0.12, y - 0.04, y, rz + 0.06 + i * 0.1, rz + 0.08 + i * 0.1, hex(i % 2 ? '#C0483A' : '#E0A88C'), { ao: false }); }
    // 门口矮桌 + 塑料凳（红 / 蓝）
    for (const [tx, tz] of [[x1 + 2.6, zc + 1.6], [x1 + 2.6, zc + 3.6], [x0 + 4, zc], [x0 + 7.5, zc - 2]]) {
      P.slab(tx - 0.4, tx + 0.4, 0, 0.5, tz - 0.4, tz + 0.4, hex('#DCD7CC'), { ao: false }); P.slab(tx - 0.45, tx + 0.45, 0.5, 0.54, tz - 0.45, tz + 0.45, hex('#F4F2EE'), { ao: false }); k.colSlab(tx - 0.45, tx + 0.45, 0, 0.54, tz - 0.45, tz + 0.45);
      for (const [dx, dz, cl] of [[-0.75, 0, '#D93A30'], [0.75, 0, '#2E6FC2'], [0, 0.75, '#D93A30']]) { P.cyl(tx + dx, 0.15, tz + dz, 0.34, 0.3, hex(cl), 8, 0, 0, 0, 0.26); P.cyl(tx + dx, 0.31, tz + dz, 0.36, 0.03, hex(cl), 8); }
    }
    k.shade.shadeBlob(x1 + 1.8, zc, 2.2, W / 2, 0.02, 0.18);
  }
  /* ---------- 吕厝 12 号出口：莲花公园 ---------- */
  lucuo() {
    const k = this.kit, P = k.solid, A = this.atlas;
    this.road(-160, 160, -22, -8, true, '嘉禾路');
    this.road(-24, -12, -8, 200, false, '凌香里');
    for (let x = -150; x <= 150; x += 12) if (Math.abs(x) > 6) this.lightTree(x, -6.2, 0.8);
    for (const x of [-8, 8]) D.lamp(k, x, 0, -6.6, Math.PI);
    // 公园：x 8..86, z 40..110（~2 ha 压缩），入口朝西北（从出口走过来 ~90 m）
    const X0 = 8, X1 = 86, Z0 = 40, Z1 = 112, cx = (X0 + X1) / 2, cz = (Z0 + Z1) / 2;
    this.fence(X0, Z0, X1, Z0, [[6, 14]]); this.fence(X0, Z0, X0, Z1, []); this.fence(X1, Z0, X1, Z1, []); this.fence(X0, Z1, X1, Z1, []);
    // 入口：镂空莲花铁牌（灰黑钢板 + 金字）
    const ex = X0 + 10;
    k.metal.slab(ex - 4.4, ex - 4.2, 0, 2.6, Z0 - 0.1, Z0 + 0.1, hex('#3C4044'), { ao: false }); k.metal.slab(ex + 4.2, ex + 4.4, 0, 2.6, Z0 - 0.1, Z0 + 0.1, hex('#3C4044'), { ao: false });
    const lotusSign = (c, pw, ph) => {
      c.fillStyle = '#3A4045'; c.fillRect(0, 0, pw, ph);
      // 镂空莲花：用浅绿 / 天色表示“透过去看到的树”
      c.save(); c.translate(pw / 2, ph * 0.42); const s = ph * 0.32; c.fillStyle = '#8FB38A';
      const petal = (a, len, wd) => { c.save(); c.rotate(a); c.beginPath(); c.moveTo(0, 0); c.quadraticCurveTo(wd, -len * 0.5, 0, -len); c.quadraticCurveTo(-wd, -len * 0.5, 0, 0); c.fill(); c.restore(); };
      petal(0, s * 1.1, s * 0.35); for (const sg of [-1, 1]) { petal(sg * 0.45, s * 1.0, s * 0.3); petal(sg * 0.95, s * 0.9, s * 0.28); petal(sg * 1.45, s * 0.85, s * 0.22); }
      c.restore();
      c.fillStyle = '#D9A93F'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.font = `800 ${ph * 0.17}px ${FONT}`; c.fillText('莲 花 公 园', pw / 2, ph * 0.82);
    };
    A.quad(ex, 1.6, Z0 - 0.12, 3.2, 2.6, 0, A.draw(3.2, 2.6, lotusSign)); A.quad(ex, 1.6, Z0 + 0.12, 3.2, 2.6, Math.PI, A.draw(3.2, 2.6, lotusSign));
    k.metal.slab(ex - 1.7, ex + 1.7, 0.2, 3.0, Z0 - 0.05, Z0 + 0.05, hex('#3A4045'), { ao: false });
    k.colSlab(ex - 1.7, ex + 1.7, 0, 3.0, Z0 - 0.1, Z0 + 0.1);
    k.g('grass').slab(X0 + 0.3, X1 - 0.3, 0.004, 0.012, Z0 + 0.3, Z1 - 0.3, hex('#FFFFFF'), { ao: false });   // 公园草地
    // 园路（环形 + 入口）
    P.slab(ex - 2, ex + 2, 0.005, 0.02, Z0, Z0 + 12, hex('#CBBFA8'), { ao: false });
    const RX = 26, RZ = 22, PW = 3.2, N = 40;
    const ring = (rx0, rz0, rx1, rz1, y, col, B) => { for (let i = 0; i < N; i++) { const a0 = i / N * Math.PI * 2, a1 = (i + 1) / N * Math.PI * 2, p = (a, rx, rz) => [cx + Math.cos(a) * rx, y, cz + Math.sin(a) * rz]; B.quad(p(a0, rx1, rz1), p(a1, rx1, rz1), p(a1, rx0, rz0), p(a0, rx0, rz0), col); B.quad(p(a0, rx0, rz0), p(a1, rx0, rz0), p(a1, rx1, rz1), p(a0, rx1, rz1), col); } };
    ring(RX, RZ, RX + PW, RZ + PW, 0.02, hex('#CBBFA8'), P);
    // 荷花池：池岸石 + 水面 + 荷叶 + 荷花
    const WX = 18, WZ = 14;
    ring(WX, WZ, WX + 1.0, WZ + 1.0, 0.25, hex('#BDB6A8'), P);
    for (let i = 0; i < N; i++) { const a = (i + 0.5) / N * Math.PI * 2; k.col(cx + Math.cos(a) * (WX + 0.5), 0.5, cz + Math.sin(a) * (WZ + 0.5), 1.2, 1, 2.6, { ry: -a }); }
    for (let i = 0; i < N; i++) { const a0 = i / N * Math.PI * 2, a1 = (i + 1) / N * Math.PI * 2; const tri = (B, y, r, col) => { const c0 = [cx, y, cz], A1 = [cx + Math.cos(a1) * (WX + r), y, cz + Math.sin(a1) * (WZ + r)], A0 = [cx + Math.cos(a0) * (WX + r), y, cz + Math.sin(a0) * (WZ + r)]; B.quad(c0, A0, A1, A1, col); };   // 朝上的一面；第 4 点不能和第 1 点重合（否则法线算成 0，水面发黑）
      tri(P, 0.09, 0, hex('#4F9C9A')); tri(P, 0.035, 0.2, hex('#2F6E6A')); }   // 水面（地面之上；池底深绿）
    // 水面上的天光：几道浅蓝白的反光带（贴在水面上 1 cm）
    for (const [dx, dz, w, d] of [[-6, -4, 9, 1.4], [3, 3, 11, 1.1], [-2, 8, 7, 0.9], [8, -7, 6, 1.0]]) P.slab(cx + dx - w / 2, cx + dx + w / 2, 0.095, 0.1, cz + dz - d / 2, cz + dz + d / 2, hex('#A9D6DE'), { ao: false });
    for (let i = 0; i < 150; i++) { const a = D.rnd() * Math.PI * 2, r = Math.sqrt(D.rnd()) * 0.93; const x = cx + Math.cos(a) * r * WX, z = cz + Math.sin(a) * r * WZ, s = 0.8 + D.rnd() * 0.7;
      P.cyl(x, 0.12 + D.rnd() * 0.04, z, 1.3 * s, 0.03, hex(D.rnd() < 0.5 ? '#4E8E3E' : '#5DA04A'), 8);
      if (i % 7 === 0) { P.ellipsoid(x + 0.2, 0.55, z, 0.32, 0.36, 0.32, hex('#F07FA8'), 1); P.cyl(x + 0.2, 0.25, z, 0.04, 0.5, hex('#4E8E3E'), 4); } }
    // 小石桥 + 亭子（池边）
    k.g('granite').slab(cx - 1.2, cx + 1.2, 0.3, 0.55, cz - WZ - 1.2, cz - WZ + 4, hex('#CFCBC2'), { ao: false });
    const tx = cx + WX + 4, tz = cz;
    for (const [dx, dz] of [[-1.6, -1.6], [1.6, -1.6], [-1.6, 1.6], [1.6, 1.6]]) { P.cyl(tx + dx, 1.4, tz + dz, 0.24, 2.8, hex('#A23B2C'), 8); k.colSlab(tx + dx - 0.15, tx + dx + 0.15, 0, 2.8, tz + dz - 0.15, tz + dz + 0.15); }
    P.cyl(tx, 3.3, tz, 5.6, 1.0, hex('#2F6B57'), 6, 0, 0, 0, 0.3);
    // 密林：环路外一圈 + 角落
    for (let i = 0; i < 84; i++) { const a = i / 84 * Math.PI * 2 + D.rnd() * 0.1, rr = 1.06 + D.rnd() * 0.42; const x = cx + Math.cos(a) * (RX + PW + 3) * rr, z = cz + Math.sin(a) * (RZ + PW + 3) * rr;
      if (x < X0 + 2 || x > X1 - 2 || z < Z0 + 2 || z > Z1 - 2) continue; if (Math.abs(x - ex) < 4 && z < Z0 + 14) continue; this.lightTree(x, z, 0.9 + D.rnd() * 0.4, i % 3 === 0 ? 1 : 0); }
    for (let x = X0 + 3; x < X1 - 2; x += 5.5) for (const z of [Z0 + 3.5, Z0 + 8.5]) { if (Math.abs(x - ex) < 4.5) continue; this.lightTree(x + D.rnd() * 1.5, z + D.rnd() * 1.5, 0.85 + D.rnd() * 0.4, D.rnd() < 0.4 ? 1 : 0); }   // 沿街一排密树（公园外面看就是一片林子）
    for (let i = 0; i < 16; i++) { const a = (i + 0.3) / 16 * Math.PI * 2; if (Math.abs(Math.sin(a) + 1) < 0.15) continue; this.lightTree(cx + Math.cos(a) * (WX + 4.5), cz + Math.sin(a) * (WZ + 4.5), 0.75 + D.rnd() * 0.3, i % 2); }
    for (const [x, z, r] of [[cx - RX - 1.5, cz, Math.PI / 2], [cx, cz + RZ + PW + 1, Math.PI], [cx + 10, cz - RZ - PW - 0.9, 0]]) D.bench(k, x, 0, z, r);
    this.filler([[60, -40, 30, 14, 34, '#C9C2B6'], [-40, -42, 34, 14, 28, '#D8D2C6'], [120, -40, 30, 14, 40, '#BFB6A8'], [-80, 70, 30, 30, 24, '#CDC5B8'], [130, 80, 24, 40, 30, '#D2CABE'], [40, 160, 50, 20, 22, '#C6BEB1']]);
  }

  /* ---------- 诚毅广场出口：莲花首岸 ---------- */
  chengyi() {
    const k = this.kit, P = k.solid, A = this.atlas;
    this.road(-14, -2, -60, 200, false, '诚毅南路');
    this.road(-160, 160, 52, 66, true, '诚毅东路');
    for (let z = -50; z <= 190; z += 12) if (z < 48 || z > 70) { this.lightTree(-16, z, 0.8); this.lightTree(0.5, z + 6, 0.8); }
    // 小区：路口往东 ~100 m（压缩 ~30 m 起）：x 34..124, z 74..150
    const X0 = 34, X1 = 124, Z0 = 74, Z1 = 152;
    this.fence(X0, Z0, X1, Z0, [[8, 16]], 1.8); this.fence(X0, Z0, X0, Z1, [], 1.8); this.fence(X1, Z0, X1, Z1, [], 1.8); this.fence(X0, Z1, X1, Z1, [], 1.8);
    const gx = X0 + 12;
    P.slab(gx - 6, gx + 6, 0, 0.3, Z0 - 2, Z0 + 2, hex('#C9C4B8'), { ao: false });
    k.g('granite').slab(gx - 9, gx - 5, 0, 1.4, Z0 - 0.6, Z0 + 0.6, hex('#8E8A82'), { ao: false }); k.colSlab(gx - 9, gx - 5, 0, 1.4, Z0 - 0.6, Z0 + 0.6);
    A.quad(gx - 7, 0.85, Z0 - 0.62, 3.8, 0.8, 0, A.draw(3.8, 0.8, textPaint(['莲花首岸'], { bg: '#8E8A82', fg: '#F2E2B0' })));
    // 8 栋：11 / 24 / 33 层混合（层高 3 m），底层 4.5 m 架空（柱子 + 透空）
    const towers = [[48, 92, 11], [70, 90, 24], [94, 92, 33], [114, 96, 24], [50, 126, 24], [74, 132, 33], [98, 128, 11], [116, 136, 33]];
    const paints = {};
    const tp = fl => paints[fl] || (paints[fl] = this.atlas.draw(16, fl * 3, (c, pw, ph) => {
      c.fillStyle = '#ECE7DD'; c.fillRect(0, 0, pw, ph);
      const fh = ph / fl;
      for (let f = 0; f < fl; f++) { const y0 = ph - (f + 1) * fh;
        for (let b = 0; b < 4; b++) { const bw = pw / 4; c.fillStyle = '#6F8DA0'; c.fillRect(b * bw + bw * 0.12, y0 + fh * 0.18, bw * 0.76, fh * 0.62); c.fillStyle = '#F7F5F0'; c.fillRect(b * bw + bw * 0.06, y0 + fh * 0.72, bw * 0.88, fh * 0.2); c.fillStyle = 'rgba(40,60,70,0.35)'; c.fillRect(b * bw + bw * 0.06, y0 + fh * 0.7, bw * 0.88, fh * 0.03); }
        c.fillStyle = '#C9B79A'; c.fillRect(0, y0 + fh * 0.95, pw, fh * 0.05); }
      c.fillStyle = '#B79E7A'; c.fillRect(pw * 0.46, 0, pw * 0.08, ph);
    }, 7));
    for (const [x, z, fl] of towers) {
      const w = 16, d = 14, h = fl * 3, y0 = 4.5;
      P.slab(x - w / 2, x + w / 2, y0, y0 + h, z - d / 2, z + d / 2, hex('#ECE7DD'), { ao: false });
      const uv = tp(fl);
      A.quad(x, y0 + h / 2, z - d / 2 - 0.03, w, h, 0, uv); A.quad(x, y0 + h / 2, z + d / 2 + 0.03, w, h, Math.PI, uv);
      A.quad(x - w / 2 - 0.03, y0 + h / 2, z, d, h, -Math.PI / 2, uv); A.quad(x + w / 2 + 0.03, y0 + h / 2, z, d, h, Math.PI / 2, uv);
      P.slab(x - w / 2 - 0.3, x + w / 2 + 0.3, y0 + h, y0 + h + 1.2, z - d / 2 - 0.3, z + d / 2 + 0.3, hex('#C9B79A'), { ao: false });
      P.slab(x - 3, x + 3, y0 + h + 1.2, y0 + h + 4, z - 2, z + 2, hex('#E2DCD0'), { ao: false });
      // 架空层：楼板底 + 6 根柱 + 中间电梯厅核心筒
      P.slab(x - w / 2, x + w / 2, y0 - 0.5, y0, z - d / 2, z + d / 2, hex('#D9D3C7'), { ao: false });
      for (const dx of [-w / 2 + 0.6, 0, w / 2 - 0.6]) for (const dz of [-d / 2 + 0.6, d / 2 - 0.6]) { P.slab(x + dx - 0.45, x + dx + 0.45, 0, y0 - 0.5, z + dz - 0.45, z + dz + 0.45, hex('#CFC8BA'), { ao: false }); k.colSlab(x + dx - 0.45, x + dx + 0.45, 0, y0, z + dz - 0.45, z + dz + 0.45); }
      P.slab(x - 2.2, x + 2.2, 0, y0 - 0.5, z - 1.6, z + 1.6, hex('#B8AE9E'), { ao: false }); k.glass.slab(x - 1.2, x + 1.2, 0.1, 2.6, z - 1.64, z - 1.6, hex('#BFD8E6')); k.colSlab(x - 2.2, x + 2.2, 0, y0, z - 1.6, z + 1.6);
      k.shade.shadeRoom(x - w / 2, x + w / 2, z - d / 2, z + d / 2, 0.012, 1.2, 0.3);
    }
    // 小区绿化
    const G = k.g('grass');
    G.slab(X0 + 1, X1 - 1, 0.01, 0.06, Z0 + 1, Z1 - 1, hex('#FFFFFF'), { ao: false });
    P.slab(gx - 2, gx + 2, 0.06, 0.08, Z0, Z1 - 2, hex('#CFC7BA'), { ao: false }); P.slab(X0 + 2, X1 - 2, 0.06, 0.08, Z0 + 18, Z0 + 21, hex('#CFC7BA'), { ao: false });
    for (let i = 0; i < 22; i++) { const x = X0 + 3 + D.rnd() * (X1 - X0 - 6), z = Z0 + 3 + D.rnd() * (Z1 - Z0 - 6); if (towers.some(([tx, tz]) => Math.abs(x - tx) < 11 && Math.abs(z - tz) < 10)) continue; this.lightTree(x, z, 0.8, i % 2); }
    this.filler([[-50, 20, 30, 20, 18, '#D2CABE'], [-60, 110, 30, 30, 30, '#C6BEB1'], [140, 40, 20, 20, 40, '#CDC5B8']]);
  }
}
