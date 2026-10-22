/*
 * 后埔 2 号出口往西南 ~200 m：鑫利花园（吕岭路 250–266 号）。照片见 /workspace/xm-research/xinli/。
 *   临街：250 / 252 / 260 / 262 号，8 层，底层吕岭路商铺（大红招牌）；北门（伸缩门 + 门卫室）开在吕岭路上，夹在 252 和 260 之间
 *   小区里：254 号、256 号（8 层，可以进楼：楼梯间 + 每层两户，101…802 普通门牌），266 号高层（18 层，顶上拱窗 + 红色弧形屋顶）
 *   外观：砖红色面砖 + 白色面砖顶层 + 每层白色横带；白色阳台栏板 + 防盗网；楼梯间竖条顶上拱形长窗 + 红色弧顶；蓝色门牌「吕岭路 256」
 * 256 号：公开资料没查到有电梯 → 只有楼梯（一梯两户，双跑楼梯）。楼内（楼梯间 + 16 户）单独加载，进楼才建，出楼就卸载。
 * 隐私：门牌一律普通编号，不对任何一户做标注 / 高亮 / 播报。
 */
import { Kit } from './kit.js';
import { hex } from '../core/geo.js';
import { FoodAtlas } from '../game/food-art.js';
import * as D from './decor.js';

const FONT = '"PingFang SC","Hiragino Sans GB","Noto Sans CJK SC","Microsoft YaHei",sans-serif', FONT_EN = '"Helvetica Neue",Arial,sans-serif';
export const FH = 2.9;                      // 层高
const RED = '#B25A4E', WHITE = '#F1EEE8';
/** 鑫利花园的立面：砖红面砖、顶层白面砖、白横带、窗 + 防盗网、隔一开间一个白色阳台栏板 */
function xinliPaint({ floors, bays, ground = null, whiteTop = 1 }) {
  return (c, pw, ph) => {
    const fh = ph / floors, bw = pw / bays;
    c.fillStyle = RED; c.fillRect(0, 0, pw, ph);
    c.fillStyle = WHITE; c.fillRect(0, 0, pw, fh * whiteTop);
    // 面砖缝
    const ts = Math.max(3, fh / 6);
    c.strokeStyle = 'rgba(255,255,255,0.13)'; c.lineWidth = 1;
    for (let y = 0; y < ph; y += ts) { c.beginPath(); c.moveTo(0, y); c.lineTo(pw, y); c.stroke(); }
    for (let x = 0; x < pw; x += ts * 1.4) { c.beginPath(); c.moveTo(x, fh * whiteTop); c.lineTo(x, ph); c.stroke(); }
    c.strokeStyle = 'rgba(120,120,120,0.25)'; for (let x = 0; x < pw; x += ts) { c.beginPath(); c.moveTo(x, 0); c.lineTo(x, fh * whiteTop); c.stroke(); }
    for (let f = 0; f < floors; f++) {
      const y0 = ph - (f + 1) * fh;
      c.fillStyle = WHITE; c.fillRect(0, y0 + fh * 0.9, pw, fh * 0.1);
      if (f === 0 && ground) { ground(c, 0, y0, pw, fh); continue; }
      for (let b = 0; b < bays; b++) {
        const balc = b % 2 === 1;
        const x = b * bw + bw * 0.16, w = bw * 0.68, wy = y0 + fh * 0.16, h = fh * (balc ? 0.7 : 0.52);
        c.fillStyle = '#E9E6E0'; c.fillRect(x - 2, wy - 2, w + 4, h + 4);
        c.fillStyle = balc ? '#5E6E78' : '#7F9CB0'; c.fillRect(x, wy, w, h);
        c.fillStyle = 'rgba(255,255,255,0.22)'; c.fillRect(x + w * 0.06, wy + h * 0.08, w * 0.1, h * 0.8);
        // 防盗网（白色铁格）
        c.strokeStyle = 'rgba(236,238,240,0.95)'; c.lineWidth = Math.max(1, w * 0.025);
        for (let i = 1; i < 7; i++) { const gx = x + w * i / 7; c.beginPath(); c.moveTo(gx, wy - 2); c.lineTo(gx, wy + h); c.stroke(); }
        c.beginPath(); c.moveTo(x, wy + h * 0.5); c.lineTo(x + w, wy + h * 0.5); c.stroke();
        if (balc) { c.fillStyle = WHITE; c.fillRect(b * bw + bw * 0.08, y0 + fh * 0.56, bw * 0.84, fh * 0.34); c.fillStyle = 'rgba(0,0,0,0.12)'; c.fillRect(b * bw + bw * 0.08, y0 + fh * 0.56, bw * 0.84, fh * 0.03); }
        else if (f % 2 === 0 && b % 4 === 0) { c.fillStyle = '#EDEDED'; c.fillRect(x + w * 0.62, wy + h + fh * 0.04, w * 0.34, fh * 0.16); }   // 空调外机
      }
    }
  };
}
/** 吕岭路底商：大红招牌 + 卷帘门 / 玻璃门 */
const SHOPS = ['鑫利超市', '五金建材', '水果店', '早餐店', '理发', '药店', '烟酒茶', '粮油店', '手机维修', '面馆', '文具店', '干洗店'];
function shopGround(names) {
  return (c, x0, y0, pw, fh) => {
    const n = names.length, sw = pw / n;
    names.forEach((nm, i) => {
      const x = i * sw;
      c.fillStyle = '#C8C3BA'; c.fillRect(x, y0, sw, fh);
      c.fillStyle = i % 3 === 1 ? '#9AA3A8' : '#3F4A52'; c.fillRect(x + sw * 0.08, y0 + fh * 0.36, sw * 0.84, fh * 0.64);
      if (i % 3 === 1) { c.strokeStyle = 'rgba(255,255,255,0.35)'; for (let k = 0; k < 10; k++) { const yy = y0 + fh * (0.38 + k * 0.062); c.beginPath(); c.moveTo(x + sw * 0.08, yy); c.lineTo(x + sw * 0.92, yy); c.stroke(); } }
      c.fillStyle = '#C21F1F'; c.fillRect(x + sw * 0.02, y0 + fh * 0.04, sw * 0.96, fh * 0.28);
      c.fillStyle = '#FFFFFF'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.font = `800 ${fh * 0.2}px ${FONT}`;
      let size = fh * 0.2; const tw = c.measureText(nm).width; if (tw > sw * 0.86) { size *= sw * 0.86 / tw; c.font = `800 ${size}px ${FONT}`; }
      c.fillText(nm, x + sw / 2, y0 + fh * 0.18);
    });
  };
}
const plate = (txt) => (c, pw, ph) => {
  c.fillStyle = '#1F4FA0'; c.fillRect(0, 0, pw, ph); c.strokeStyle = '#FFFFFF'; c.lineWidth = ph * 0.05; c.strokeRect(ph * 0.06, ph * 0.06, pw - ph * 0.12, ph - ph * 0.12);
  c.fillStyle = '#FFFFFF'; c.textAlign = 'center'; c.textBaseline = 'middle';
  c.font = `700 ${ph * 0.24}px ${FONT}`; c.fillText('吕 岭 路', pw / 2, ph * 0.3);
  c.font = `800 ${ph * 0.44}px ${FONT_EN}`; c.fillText(txt, pw / 2, ph * 0.68);
};

/** 一栋 8 层（或高层）：盒体 + 四面贴图 + 楼梯间竖条（白面砖，顶上拱窗 + 红弧顶）+ 阳台栏板凸出 */
function block(S, { x, z, w, d, floors, no, front = -1, shops = null, stairX = null, tower = false }) {
  const k = S.kit, P = k.solid, A = S.atlas, h = floors * FH;
  P.slab(x - w / 2, x + w / 2, 0, h, z - d / 2, z + d / 2, hex(RED), { ao: false });
  k.colSlab(x - w / 2, x + w / 2, 0, h, z - d / 2, z + d / 2);
  const bays = Math.round(w / 3), ppm = tower ? 9 : 14;
  const long = xinliPaint({ floors, bays, ground: shops ? shopGround(shops) : null, whiteTop: tower ? 2 : 1 });
  const back = xinliPaint({ floors, bays, whiteTop: tower ? 2 : 1 }), end = xinliPaint({ floors, bays: Math.max(2, Math.round(d / 3)), whiteTop: tower ? 2 : 1 });
  const uvF = A.draw(w, h, long, ppm), uvB = shops ? A.draw(w, h, back, ppm) : uvF, uvE = A.draw(d, h, end, ppm);
  // front = -1：正面朝 -z（北，吕岭路）
  A.quad(x, h / 2, z - d / 2 - 0.03, w, h, 0, front < 0 ? uvF : uvB); A.quad(x, h / 2, z + d / 2 + 0.03, w, h, Math.PI, front < 0 ? uvB : uvF);
  A.quad(x - w / 2 - 0.03, h / 2, z, d, h, -Math.PI / 2, uvE); A.quad(x + w / 2 + 0.03, h / 2, z, d, h, Math.PI / 2, uvE);
  P.slab(x - w / 2 - 0.15, x + w / 2 + 0.15, h, h + 0.9, z - d / 2 - 0.15, z + d / 2 + 0.15, hex(WHITE), { ao: false });   // 女儿墙
  // 阳台栏板（白色，凸出 0.5 m；隔开间、每层）——只做正背两面，合在一个 bucket
  const B = k.g('facade');
  for (const sg of [-1, 1]) for (let f = 1; f < floors; f++) for (let b = 1; b < bays; b += 2) {
    const bx = x - w / 2 + (b + 0.5) * (w / bays), zf = z + sg * d / 2;
    B.slab(bx - w / bays * 0.45, bx + w / bays * 0.45, f * FH, f * FH + 1.05, Math.min(zf, zf + sg * 0.55), Math.max(zf, zf + sg * 0.55), hex(WHITE), { ao: false });
  }
  // 楼梯间竖条：白面砖，比屋面高一层，顶上拱形长窗 + 红色弧顶
  if (stairX !== null) {
    const sx = stairX, sz = front < 0 ? z - d / 2 - 0.4 : z + d / 2 + 0.4, top = h + FH;
    P.slab(sx - 1.6, sx + 1.6, 0, top, sz - 0.45, sz + 0.45, hex('#EEEBE5'), { ao: false });
    k.glass.slab(sx - 0.5, sx + 0.5, top - FH * 0.95, top - 0.6, sz - 0.48 * (front < 0 ? 1 : -1) - 0.01, sz - 0.46 * (front < 0 ? 1 : -1), hex('#5E8C76'));
    P.cyl(sx, top - 0.6, sz - 0.47 * (front < 0 ? 1 : -1), 1.0, 0.04, hex('#5E8C76'), 12, 0, Math.PI / 2);
    P.cyl(sx, top, sz, 3.4, 1.0, hex('#B8483A'), 12, 0, 0, Math.PI / 2);   // 红色弧顶（横放半圆柱，下半埋进竖条）
    for (const [a, b] of [[sx - 1.6, sx - 1.05], [sx + 1.05, sx + 1.6]]) k.colSlab(a, b, 0, 3, sz - 0.45, sz + 0.45);
    k.colSlab(sx - 1.6, sx + 1.6, 3, top, sz - 0.45, sz + 0.45);
    if (no !== 256) k.colSlab(sx - 1.05, sx + 1.05, 0, 3, sz - 0.45, sz + 0.45);   // 只有 256 号的楼梯间门能进
    for (let f = 1; f < floors; f++) k.glass.slab(sx - 0.45, sx + 0.45, f * FH + 1.3, f * FH + 2.3, sz - 0.47 * (front < 0 ? 1 : -1) - 0.01, sz - 0.45 * (front < 0 ? 1 : -1), hex('#86A9BC'));
  }
  if (tower) {   // 高层：顶上一圈拱窗 + 红色弧形屋顶（两向）
    for (const [ax, az, len, ry] of [[x, z, w * 0.9, 0], [x, z, d * 0.9, Math.PI / 2]]) P.cyl(ax, h + 0.9, az, 4.2, len, hex('#B8483A'), 14, ry, 0, Math.PI / 2);
    for (let i = 0; i < 4; i++) { const ax = x - w * 0.3 + i * w * 0.2; k.glass.slab(ax - 0.5, ax + 0.5, h - FH * 0.9, h - 0.7, z - d / 2 - 0.05, z - d / 2 - 0.04, hex('#5E8C76')); P.cyl(ax, h - 0.7, z - d / 2 - 0.045, 1.0, 0.02, hex('#5E8C76'), 12, 0, Math.PI / 2); }
  }
  // 蓝色门牌（楼梯间门边 / 楼角）
  const px = stairX !== null ? stairX + 2.0 : x + w / 2 - 1.2, pz = front < 0 ? z - d / 2 - 0.05 : z + d / 2 + 0.05;
  A.quad(px, 2.3, pz, 0.62, 0.42, front < 0 ? 0 : Math.PI, A.draw(0.62, 0.42, plate(String(no)), 200));
  k.shade.shadeRoom(x - w / 2, x + w / 2, z - d / 2, z + d / 2, 0.012, 1.0, 0.25);
  return h;
}
function palm(k, x, z, s = 1) {
  const P = k.solid; P.cyl(x, 3.2 * s, z, 0.36 * s, 6.4 * s, hex('#8A7A62'), 6, 0, 0, 0, 0.26 * s);
  for (let i = 0; i < 7; i++) { const a = i / 7 * Math.PI * 2; P.box(x + Math.cos(a) * 1.3 * s, 6.3 * s, z + Math.sin(a) * 1.3 * s, 2.8 * s, 0.12, 0.7 * s, hex(i % 2 ? '#4E8B3A' : '#3F7A30'), -a, 0, -0.35); }
}

/** 鑫利花园外观（加在 XmStreet 里；S = XmStreet 实例） */
export function xinliEstate(S) {
  const k = S.kit, P = k.solid, A = S.atlas;
  const Z0 = -5;      // 临街楼北墙（吕岭路南侧人行道 z -8..-5）
  // 临街 4 栋 + 北门
  const fr = [[250, -118, ['鑫利超市', '五金建材', '水果店', '早餐店']], [252, -96, ['理发', '药店', '烟酒茶']], [260, -64, ['粮油店', '手机维修', '面馆']], [262, -42, ['文具店', '干洗店', '鑫利超市']]];
  for (const [no, x, shops] of fr) {
    block(S, { x, z: Z0 + 6, w: no === 250 ? 20 : 18, d: 12, floors: 8, no, shops, stairX: x + 4 });
    // 底商大红招牌（凸出的灯箱条）+ 雨篷
    const w = no === 250 ? 20 : 18;
    P.slab(x - w / 2, x + w / 2, 3.15, 3.3, Z0 - 1.4, Z0, hex('#D9D4CA'), { ao: false });
  }
  // 北门：两根门柱 + 门头「鑫利花园」+ 伸缩门（拉开一半）+ 门卫室
  const gx = -80, gz = Z0;
  for (const dx of [-5.6, 5.6]) { P.slab(gx + dx - 0.5, gx + dx + 0.5, 0, 3.6, gz - 0.5, gz + 0.5, hex('#D8D2C6'), { ao: false }); k.colSlab(gx + dx - 0.5, gx + dx + 0.5, 0, 3.6, gz - 0.5, gz + 0.5); }
  P.slab(gx - 6.1, gx + 6.1, 3.6, 4.4, gz - 0.55, gz + 0.55, hex('#B8483A'), { ao: false });
  const gate = (c, pw, ph) => { c.fillStyle = '#B8483A'; c.fillRect(0, 0, pw, ph); c.fillStyle = '#F6D36B'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.font = `800 ${ph * 0.6}px ${FONT}`; c.fillText('鑫 利 花 园', pw / 2, ph * 0.55); };
  A.quad(gx, 4.0, gz - 0.58, 8, 0.7, 0, A.draw(8, 0.7, gate));
  for (let i = 0; i < 10; i++) { const x = gx + 0.6 + i * 0.5; k.metal.slab(x - 0.02, x + 0.02, 0.1, 1.6, gz - 0.05, gz + 0.05, hex('#C8CDD2'), { ao: false }); k.metal.box(x + 0.25, 0.85, gz, 0.56, 1.4, 0.04, hex('#B9BFC5'), 0, 0, 0); k.metal.box(x + 0.25, 0.85, gz, 0.56, 0.04, 0.04, hex('#9AA0A6'), 0, 0, 0.9 * (i % 2 ? 1 : -1)); }
  k.metal.slab(gx + 0.4, gx + 5.4, 0.02, 0.12, gz - 0.12, gz + 0.12, hex('#6E767E'), { ao: false });   // 轨道
  k.colSlab(gx + 0.4, gx + 5.4, 0, 1.6, gz - 0.2, gz + 0.2);
  // 门卫室（白墙 + 蓝窗 + 红檐）
  P.slab(gx - 5, gx - 2, 0, 2.8, gz + 1.2, gz + 4, hex('#EFECE6'), { ao: false }); k.colSlab(gx - 5, gx - 2, 0, 2.8, gz + 1.2, gz + 4);
  k.glass.slab(gx - 2.02, gx - 1.98, 1.0, 2.2, gz + 1.6, gz + 3.6, hex('#6F9DC4')); k.glass.slab(gx - 4.6, gx - 2.4, 1.0, 2.2, gz + 1.18, gz + 1.2, hex('#6F9DC4'));
  P.slab(gx - 5.3, gx - 1.7, 2.8, 3.0, gz + 0.9, gz + 4.3, hex('#B8483A'), { ao: false });
  A.quad(gx - 3.5, 2.45, gz + 1.16, 1.4, 0.32, 0, A.draw(1.4, 0.32, (c, pw, ph) => { c.fillStyle = '#FFFFFF'; c.fillRect(0, 0, pw, ph); c.fillStyle = '#1F4FA0'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.font = `800 ${ph * 0.66}px ${FONT}`; c.fillText('门 卫 室', pw / 2, ph * 0.55); }));
  // 小区围墙（西 / 东 / 南）+ 院子铺地
  const X0 = -130, X1 = -32, Z1 = 72;
  for (const [x0, x1, z0, z1] of [[X0 - 0.3, X0, Z0 + 12, Z1], [X1, X1 + 0.3, Z0 + 12, Z1], [X0, X1, Z1, Z1 + 0.3]]) { P.slab(x0, x1, 0, 2.2, z0, z1, hex('#E3DED4'), { ao: false }); k.colSlab(x0, x1, 0, 2.2, z0, z1); }
  P.slab(X0, X1, 0.004, 0.014, Z0 + 12, Z1, hex('#BDB7AC'), { ao: false });
  P.slab(gx - 4, gx + 4, 0.006, 0.016, Z0, Z0 + 12, hex('#BDB7AC'), { ao: false });
  // 小区里：254、256（可进）、266 高层
  block(S, { x: -116, z: 36, w: 20, d: 12, floors: 8, no: 254, stairX: -112 });
  block(S, { x: -86, z: 36, w: 20, d: 12, floors: 8, no: 256, stairX: -86 });
  block(S, { x: -56, z: 42, w: 14, d: 14, floors: 18, no: 266, tower: true });
  // 256 号楼梯间入口：竖条底部开一个深色门洞（走进去就进楼）
  P.slab(-87.0, -85.0, 0.0, 2.3, 36 - 6 - 0.9, 36 - 6 - 0.86, hex('#2A2724'), { ao: false });
  P.slab(-87.3, -84.7, 2.3, 2.5, 36 - 6 - 1.4, 36 - 6 - 0.85, hex('#B8483A'), { ao: false });   // 小雨篷
  // 绿化：棕榈 + 树 + 花坛 + 自行车棚
  for (const [x, z] of [[-124, 14], [-104, 14], [-70, 14], [-44, 16], [-124, 58], [-100, 60], [-76, 58], [-40, 60]]) palm(k, x, z, 0.9);
  for (const [x, z] of [[-112, 22], [-62, 24], [-96, 54], [-50, 62]]) S.lightTree(x, z, 0.9, 1);
  D.hedge(k, -104, -94, 18, 21, 0.01, 0.6); D.hedge(k, -72, -64, 18, 21, 0.01, 0.6);
  k.metal.slab(-128, -120, 2.2, 2.3, 46, 50, hex('#4F7D6A'), { ao: false }); for (const x of [-128, -120]) for (const z of [46, 50]) k.metal.cyl(x, 1.1, z, 0.08, 2.2, hex('#5C646C'), 6);
  for (let i = 0; i < 5; i++) D.bin && i === 0 && D.bin(k, -78, 0, 18);
  return { door256: { x: -86, z: 36 - 6 - 0.9 } };
}

/* ====================== 256 号楼内（单独加载） ====================== */
/** 楼内坐标：楼梯间中心 x=0；地面层门厅 z -1.4..1.2（门朝 -z 出楼）；每层左户 x<-1.3（f01）、右户 x>1.3（f02） */
export class Xinli256 {
  constructor(scene, origin) {
    const k = this.kit = new Kit(scene, 'xinli256'); k.root.position.set(origin.x, origin.y, origin.z); this.o = origin;
    this.atlas = new FoodAtlas(scene, 1024);
    const P = k.solid, A = this.atlas, N = 8, wall = hex('#ECE8DF'), dado = hex('#7D8F86');
    // 楼梯间（双跑）
    // 每一跑只做薄踏步 + 斜碰撞板：双跑楼梯同一跑上下层正好相差一层高，若踏步实心填到楼板，
    // 上一层那跑的实心体会压在下一层同跑的头顶（跑到顶端时净空为 0，人会卡死）
    const tread = hex('#C9C4B8'), nose = hex('#6B6258');
    const flight = (a, ya, b, yb, w0, w1) => {
      k.stairs('z', a, ya, b, yb, w0, w1, Math.max(ya, yb), tread, { rails: false, steps: false });   // baseY = 顶：不要侧墙 / 端墙（端墙会悬在下一层平台人头高度）
      const n = Math.max(2, Math.round(Math.abs(yb - ya) / 0.16)), dir = Math.sign(b - a), L = Math.abs(b - a);
      const rise = Math.abs(yb - ya) / n;
      for (let i = 0; i < n; i++) {
        const s0 = a + dir * L * i / n, s1 = a + dir * L * (i + 1) / n, top = ya + (yb - ya) * (i + 1) / n;
        k.g('floor').slab(w0, w1, top - rise - 0.04, top, Math.min(s0, s1), Math.max(s0, s1), tread, { ao: false });
        k.g('paint').slab(w0 + 0.05, w1 - 0.05, top, top + 0.006, Math.min(s0, s0 + dir * 0.07), Math.max(s0, s0 + dir * 0.07), nose, { ao: false });
      }
      // 梯段底板：一整块平滑的斜板（白色涂料），把踏步下面的锯齿包住——从下一层抬头看是一道光滑的斜面
      const dy = yb - ya, len = Math.hypot(L, dy), ang = Math.atan2(dy, b - a), th = 0.2;
      P.box((w0 + w1) / 2, (ya + yb) / 2 - (rise + 0.04) / 2 - th / 2 / Math.abs(Math.cos(ang)), (a + b) / 2, w1 - w0, th, len, soffit, 0, -ang);
    };
    const soffit = hex('#F2EFE8'), IRON = hex('#2F3133'), RAIL = hex('#4A2E22');
    // 老小区铁栏杆：黑色方钢竖杆（间距 ~0.12）+ 深棕扶手
    const railing = (z0, y0, z1, y1) => {
      const n = Math.round(Math.abs(z1 - z0) / 0.12), L = Math.hypot(z1 - z0, y1 - y0), ang = Math.atan2(y1 - y0, z1 - z0);
      for (let i = 0; i <= n; i++) { const t = i / n, z = z0 + (z1 - z0) * t, yb = y0 + (y1 - y0) * t; P.slab(-0.015, 0.015, yb, yb + 0.92, z - 0.015, z + 0.015, IRON, { ao: false }); }
      P.box(0, (y0 + y1) / 2 + 0.95, (z0 + z1) / 2, 0.07, 0.06, L + 0.08, RAIL, 0, -ang);
      P.box(0, (y0 + y1) / 2 + 0.12, (z0 + z1) / 2, 0.03, 0.03, L, IRON, 0, -ang);
    };
    for (let f = 0; f < N; f++) {
      const y = f * FH;
      k.floorWithHoles(-1.3, 1.3, -1.4, 1.2, y - 0.15, y, hex('#B9B4A8'), [], true, 'floor');                   // 楼层平台
      if (f < N - 1) {
        flight(1.2, y, 4.4, y + FH / 2, -1.25, -0.02);   // 上半跑（左）
        k.floorWithHoles(-1.3, 1.3, 4.4, 6.0, y + FH / 2 - 0.15, y + FH / 2, hex('#B9B4A8'), [], true, 'floor');  // 休息平台
        flight(4.4, y + FH / 2, 1.2, y + FH, 0.02, 1.25);  // 下半跑（右）
        // 中间的铁栏杆（老小区：黑铁竖杆 + 棕扶手）+ 碰撞
        railing(1.2, y, 4.4, y + FH / 2); railing(4.4, y + FH / 2, 1.2, y + FH);
        k.col(0, y + FH / 2 + 0.5, 2.8, 0.1, FH + 1, 3.2);
        // 休息平台的窗（朝南）
        k.glass.slab(-0.8, 0.8, y + FH / 2 + 0.9, y + FH / 2 + 2.1, 6.02, 6.06, hex('#BFD8E6'));
      }
      // 楼梯间墙：左右墙在门洞处断开；墙裙
      for (const sx of [-1, 1]) {
        const xw = sx * 1.3;
        for (const [z0, z1] of [[-1.4, -1.2], [-0.2, 6.0]]) { P.slab(Math.min(xw, xw + sx * 0.12), Math.max(xw, xw + sx * 0.12), y, y + FH, z0, z1, wall, { ao: false }); k.colSlab(Math.min(xw, xw + sx * 0.12), Math.max(xw, xw + sx * 0.12), y, y + FH, z0, z1); }
        P.slab(Math.min(xw, xw + sx * 0.12), Math.max(xw, xw + sx * 0.12), y + 2.1, y + FH, -1.2, -0.2, wall, { ao: false });
      }
      P.slab(-1.3, 1.3, y, y + FH, 6.0, 6.12, wall, { ao: false }); k.colSlab(-1.3, 1.3, y, y + FH, 6.0, 6.12);
      if (f > 0) { P.slab(-1.3, 1.3, y, y + FH, -1.52, -1.4, wall, { ao: false }); k.colSlab(-1.3, 1.3, y, y + FH, -1.52, -1.4); }
      k.glow.slab(-0.2, 0.2, y + FH - 0.06, y + FH - 0.02, -0.3, 0.1, hex('#FFF2D8'), { ao: false });   // 声控灯
      // 两户：门洞在楼梯间墙上（z -1.2..-0.2），门牌是普通编号
      for (const sx of [-1, 1]) {
        const no = `${f + 1}0${sx < 0 ? 1 : 2}`;
        this.unit(sx, y, no);
        // 门框（深红木门开着，靠墙）
        k.solid.slab(sx * 1.24 - 0.03, sx * 1.24 + 0.03, y, y + 2.1, -1.22, -1.18, hex('#6B3A2A'), { ao: false });
        k.solid.box(sx * (1.3 + 0.45), y + 1.05, -1.25, 0.9, 2.05, 0.05, hex('#7A3E2C'));
        A.quad(sx * 1.17, y + 2.32, -0.7, 0.36, 0.2, sx < 0 ? Math.PI / 2 : -Math.PI / 2, A.draw(0.36, 0.2, (c, pw, ph) => { c.fillStyle = '#D8D3C8'; c.fillRect(0, 0, pw, ph); c.fillStyle = '#2E2E2E'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.font = `700 ${ph * 0.7}px ${FONT_EN}`; c.fillText(no, pw / 2, ph * 0.55); }, 300));
      }
      // 楼层号：画在楼层平台的墙上（对着上来的楼梯；一楼在门洞上方）——只写楼层，不写户号
      A.quad(0, f > 0 ? y + 1.75 : 2.6, -1.38, 0.62, 0.38, 0, A.draw(0.5, 0.3, (c, pw, ph) => { c.fillStyle = '#ECE8DF'; c.fillRect(0, 0, pw, ph); c.fillStyle = '#B8483A'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.font = `800 ${ph * 0.8}px ${FONT_EN}`; c.fillText(`${f + 1}F`, pw / 2, ph * 0.55); }, 200));
    }
    // 顶：屋面板；地面层门厅（门洞 z=-1.4，往 -z 走出楼）+ 信报箱
    P.slab(-1.42, 1.42, N * FH - 0.15, N * FH + 0.1, -1.52, 6.12, wall, { ao: false });
    P.slab(-1.3, -1.2, 0, 2.3, -1.52, -1.4, hex('#6B3A2A'), { ao: false }); P.slab(1.2, 1.3, 0, 2.3, -1.52, -1.4, hex('#6B3A2A'), { ao: false });
    P.slab(-1.3, 1.3, 2.3, FH, -1.52, -1.4, wall, { ao: false });
    k.floorWithHoles(-3, 3, -5, -1.4, -0.15, 0, hex('#8E8A82'), [], true, 'pave');   // 门口一小块地面
    k.glow.slab(-3, 3, 0, 3.2, -5.05, -5.0, hex('#DDE8F0'), { ao: false });          // 门外的天光
    k.colSlab(-3.1, 3.1, 0, 3.2, -5.2, -5.0); k.colSlab(-3.1, -3, 0, 3.2, -5, -1.4); k.colSlab(3, 3.1, 0, 3.2, -5, -1.4);
    k.finish(true); this.atlas.finish(k.root, 'xinli256Signs');
  }
  /** 一户：门厅 + 客厅（朝北）+ 卧室（朝南）+ 厨房 + 卫生间；sx=-1 左户（f01），+1 右户（f02） */
  unit(sx, y, no) {
    const k = this.kit, P = k.solid, x0 = sx < 0 ? -10.3 : 1.42, x1 = sx < 0 ? -1.42 : 10.3, z0 = -6, z1 = 6;
    const wall = hex('#F2EFE8'), X = v => sx < 0 ? -v : v;   // X(v)：从楼梯间往外 v 米
    k.floorWithHoles(x0, x1, z0, z1, y - 0.15, y, hex(['#C9A57E', '#D8CDB8', '#BFA88A'][(+no[0]) % 3]), [], true, 'floor');
    P.slab(x0, x1, y + FH - 0.22, y + FH - 0.15, z0, z1, hex('#F7F5F0'), { ao: false });   // 天花（在上层楼板下面）
    // 外墙（四周；北、南有窗 + 防盗网）
    const xo = sx < 0 ? x0 : x1;
    P.slab(Math.min(xo, xo + sx * 0.2), Math.max(xo, xo + sx * 0.2), y, y + FH, z0, z1, wall, { ao: false }); k.colSlab(Math.min(xo, xo + sx * 0.2), Math.max(xo, xo + sx * 0.2), y, y + FH, z0, z1);
    const bd0 = Math.min(X(7.8), X(9.6)), bd1 = Math.max(X(7.8), X(9.6));   // 阳台推拉门（北墙最外一间）
    for (const zz of [z0, z1]) {
      const zw0 = Math.min(zz, zz + (zz < 0 ? -0.2 : 0.2)), zw1 = Math.max(zz, zz + (zz < 0 ? -0.2 : 0.2));
      if (zz === z0) { P.slab(x0, bd0, y, y + 0.9, zw0, zw1, wall, { ao: false }); P.slab(bd1, x1, y, y + 0.9, zw0, zw1, wall, { ao: false }); } else P.slab(x0, x1, y, y + 0.9, zw0, zw1, wall, { ao: false });
      P.slab(x0, x1, y + 2.3, y + FH, zw0, zw1, wall, { ao: false }); k.colSlab(x0, x1, y, y + FH, zw0, zw1);
      for (let i = 0; i < 3; i++) { if (zz === z0 && i === 2) continue; const a = Math.min(X(2.6 + i * 2.6), X(4.4 + i * 2.6)), b = Math.max(X(2.6 + i * 2.6), X(4.4 + i * 2.6)); k.glass.slab(a, b, y + 0.9, y + 2.3, zw0 + 0.08, zw1 - 0.08, hex('#CFE3EE')); for (let g = 0; g < 6; g++) { const gx = a + (b - a) * (g + 0.5) / 6; k.metal.slab(gx - 0.015, gx + 0.015, y + 0.9, y + 2.3, zz < 0 ? zw0 - 0.04 : zw1, zz < 0 ? zw0 : zw1 + 0.04, hex('#E8EAEC'), { ao: false }); } }
      P.slab(Math.min(X(2.6), X(zz === z0 ? 7.0 : 9.6)), Math.max(X(2.6), X(zz === z0 ? 7.0 : 9.6)), y + 0.9, y + 0.94, zz < 0 ? zw0 + 0.02 : zw1 - 0.06, zz < 0 ? zw0 + 0.06 : zw1 - 0.02, hex('#DDD8CE'), { ao: false });
    }
    { // 推拉门：两扇铝框玻璃门（一扇推开一半）+ 外面的阳台（栏板 + 晾衣杆 + 盆栽）
      const AL = hex('#BFC4C8'), m = (bd0 + bd1) / 2;
      for (const [p0, p1, zz] of [[bd0, m + 0.1, -6.12], [m - 0.45, bd1 - 0.45, -6.06]]) { k.glass.slab(p0 + 0.04, p1 - 0.04, y + 0.04, y + 2.26, zz - 0.02, zz + 0.02, hex('#CFE3EE'));
        for (const xx of [p0, p1 - 0.05]) P.slab(xx, xx + 0.05, y, y + 2.3, zz - 0.03, zz + 0.03, AL, { ao: false }); for (const yy of [y, y + 2.25]) P.slab(p0, p1, yy, yy + 0.05, zz - 0.03, zz + 0.03, AL, { ao: false }); }
      P.slab(bd0, bd1, y, y + 0.03, -6.2, -6.0, AL, { ao: false });   // 门槛轨道
      P.slab(bd0 - 0.2, bd1 + 0.2, y - 0.15, y - 0.02, -7.5, -6.2, hex('#CFC9BE'), { ao: false });   // 阳台地面
      P.slab(bd0 - 0.2, bd1 + 0.2, y - 0.02, y + 1.05, -7.6, -7.5, wall, { ao: false }); for (const xx of [bd0 - 0.2, bd1 + 0.1]) P.slab(xx, xx + 0.1, y - 0.02, y + 1.05, -7.5, -6.2, wall, { ao: false });
      P.slab(bd0 - 0.1, bd1 + 0.1, y + 2.2, y + 2.23, -7.0, -6.97, AL, { ao: false });   // 晾衣杆
      P.slab(bd0 + 0.3, bd0 + 0.75, y + 1.2, y + 1.95, -7.02, -6.98, hex('#E0A93A'), { ao: false }); P.slab(bd0 + 0.9, bd0 + 1.3, y + 1.4, y + 1.95, -7.02, -6.98, hex('#7FA8D0'), { ao: false });   // 晾着的衣服
      P.cyl(bd1 - 0.3, y + 0.18, -7.15, 0.36, 0.36, hex('#B8663A'), 8); P.ellipsoid(bd1 - 0.3, y + 0.62, -7.15, 0.5, 0.55, 0.5, hex('#4E8F3E'), 1);
    }
    // 户内隔墙：客厅（z<1）/ 卧室（z>1, 外侧）/ 厨房 + 卫生间（z>1, 靠楼梯间）
    const part = (a, b, za, zb, door) => { const lo = Math.min(a, b), hi = Math.max(a, b); if (door) { const [d0, d1] = door; for (const [p, q] of [[za, d0], [d1, zb]]) if (q - p > 0.05) { P.slab(lo, hi, y, y + FH, p, q, wall, { ao: false }); k.colSlab(lo, hi, y, y + FH, p, q); } P.slab(lo, hi, y + 2.1, y + FH, d0, d1, wall, { ao: false }); } else { P.slab(lo, hi, y, y + FH, za, zb, wall, { ao: false }); k.colSlab(lo, hi, y, y + FH, za, zb); } };
    const partX = (xa, xb, zc, door) => { const lo = Math.min(xa, xb), hi = Math.max(xa, xb); const [d0, d1] = door ? [Math.min(door[0], door[1]), Math.max(door[0], door[1])] : [hi, hi];
      for (const [p, q] of [[lo, d0], [d1, hi]]) if (q - p > 0.05) { P.slab(p, q, y, y + FH, zc - 0.06, zc + 0.06, wall, { ao: false }); k.colSlab(p, q, y, y + FH, zc - 0.06, zc + 0.06); }
      if (door) P.slab(d0, d1, y + 2.1, y + FH, zc - 0.06, zc + 0.06, wall, { ao: false }); };
    partX(X(1.42), X(4.2), 1.2, [X(2.4), X(3.2)]);         // 客厅 | 厨房（厨房门）
    partX(X(4.2), X(10.3), 1.2, [X(5.6), X(6.6)]);          // 客厅 | 卧室（卧室门）
    part(X(4.2) - 0.06, X(4.2) + 0.06, 1.2, 6, null);       // 厨房、卫生间 | 卧室
    partX(X(1.42), X(4.2), 3.6, [X(2.4), X(3.2)]);         // 厨房 | 卫生间
    // 家具：沙发、茶几、电视柜、餐桌 + 椅、床、衣柜、灶台、洗手台
    const fur = (a, b, y0, y1, za, zb, col) => { P.slab(Math.min(X(a), X(b)), Math.max(X(a), X(b)), y + y0, y + y1, za, zb, hex(col), { ao: false }); };
    fur(5.0, 7.8, 0, 0.45, -5.6, -4.8, '#8A6A54'); fur(5.0, 7.8, 0.45, 0.85, -5.85, -5.6, '#8A6A54'); k.colSlab(Math.min(X(5), X(7.8)), Math.max(X(5), X(7.8)), y, y + 0.85, -5.85, -4.8);   // 沙发
    fur(5.6, 7.2, 0, 0.4, -4.0, -3.4, '#6A4E3A');                                       // 茶几
    // 电视柜（长矮柜 + 两个抽屉）+ 电视（黑框、深蓝屏）+ 音箱
    fur(4.8, 8.0, 0, 0.48, 0.62, 1.12, '#7A5A44'); fur(5.0, 6.3, 0.12, 0.36, 0.6, 0.62, '#8E6C52'); fur(6.5, 7.8, 0.12, 0.36, 0.6, 0.62, '#8E6C52');
    fur(5.6, 7.2, 0.52, 1.46, 1.0, 1.08, '#16181B'); fur(5.66, 7.14, 0.58, 1.4, 0.98, 1.0, '#2C4058'); fur(6.3, 6.5, 0.48, 0.52, 0.85, 1.05, '#16181B');
    for (const a of [5.1, 7.5]) fur(a - 0.12, a + 0.12, 0.48, 0.9, 0.8, 1.05, '#2A2A2A');
    fur(2.4, 3.8, 0, 0.76, -4.4, -3.2, '#B08A64'); k.colSlab(Math.min(X(2.4), X(3.8)), Math.max(X(2.4), X(3.8)), y, y + 0.76, -4.4, -3.2);   // 餐桌
    // 四把木餐椅（坐面 + 靠背 + 四条腿）
    for (const [a, zc, bz] of [[2.75, -4.75, -1], [3.45, -4.75, -1], [2.75, -2.85, 1], [3.45, -2.85, 1]]) {
      fur(a - 0.21, a + 0.21, 0.42, 0.46, zc - 0.21, zc + 0.21, '#9A7350');
      fur(a - 0.21, a + 0.21, 0.46, 0.95, zc + bz * 0.18, zc + bz * 0.21, '#9A7350');
      for (const [dx, dz] of [[-0.18, -0.18], [0.18, -0.18], [-0.18, 0.18], [0.18, 0.18]]) fur(a + dx - 0.02, a + dx + 0.02, 0, 0.42, zc + dz - 0.02, zc + dz + 0.02, '#6E5038'); }
    // 卧室门：木门开着靠在卧室一侧 + 门套
    P.slab(Math.min(X(5.6), X(5.64)), Math.max(X(5.6), X(5.64)), y, y + 2.08, 1.26, 2.12, hex('#A8754E'), { ao: false });
    fur(5.62, 5.7, 1.0, 1.06, 2.0, 2.06, '#D8C9A0');
    for (const a of [5.52, 6.6]) fur(a, a + 0.08, 0, 2.15, 1.12, 1.28, '#8A5E3E'); fur(5.52, 6.68, 2.08, 2.15, 1.12, 1.28, '#8A5E3E');
    fur(5.4, 7.8, 0, 0.5, 3.2, 5.6, '#E8E2D6'); fur(5.4, 7.8, 0.5, 0.58, 3.2, 5.6, '#8FB0C8'); fur(5.4, 7.8, 0, 1.0, 5.6, 5.8, '#7A5A44'); k.colSlab(Math.min(X(5.4), X(7.8)), Math.max(X(5.4), X(7.8)), y, y + 0.58, 3.2, 5.8);   // 床
    fur(8.3, 8.85, 0, 2.0, 1.4, 3.2, '#C9B08C');                                         // 衣柜
    fur(1.5, 4.1, 0, 0.85, 2.9, 3.5, '#D8D4CC'); fur(2.0, 2.8, 0.85, 0.9, 3.0, 3.4, '#3A3A3A');   // 厨房灶台
    fur(1.5, 2.1, 0, 0.8, 5.3, 5.9, '#F4F4F2'); fur(3.4, 4.1, 0, 0.42, 5.2, 5.9, '#F4F4F2');      // 卫生间：洗手台 + 马桶
    // 外墙上一幅画 + 一盆绿植（门厅角落）
    P.slab(Math.min(X(10.08), X(10.1)), Math.max(X(10.08), X(10.1)), y + 1.3, y + 2.0, -3.4, -2.2, hex('#D9B45A'), { ao: false }); P.slab(Math.min(X(10.06), X(10.08)), Math.max(X(10.06), X(10.08)), y + 1.36, y + 1.94, -3.34, -2.26, hex('#6FA0B8'), { ao: false });
    P.cyl(X(2.0), y + 0.2, -5.4, 0.4, 0.4, hex('#B8663A'), 8); P.ellipsoid(X(2.0), y + 0.75, -5.4, 0.7, 0.8, 0.7, hex('#4E8F3E'), 1);
    k.glow.slab(Math.min(X(4.8), X(6.6)), Math.max(X(4.8), X(6.6)), y + FH - 0.25, y + FH - 0.22, -3.2, -2.6, hex('#FFF6E4'), { ao: false });   // 吸顶灯
  }
  /** 出楼：在地面层往门外走（z < -2.6） */
  wantsOut(p) { const lz = p.z - this.o.z, lx = p.x - this.o.x; return lz < -2.6 && Math.abs(lx) < 3 && p.y - this.o.y < 1.5; }
  spawn() { return [this.o.x, this.o.y + 0.05, this.o.z - 0.6, 0]; }
  zoneOf(p) { const f = Math.max(0, Math.min(7, Math.floor((p.y - this.o.y + 0.3) / FH))), lx = p.x - this.o.x; return { kind: 'interior', net: 'xm', building: 256, floor: f + 1, inUnit: Math.abs(lx) > 1.45 }; }
  dispose() { this.atlas.dispose(); this.kit.root.getChildMeshes(false).forEach(m => m.dispose()); this.kit.root.dispose(); }
}
