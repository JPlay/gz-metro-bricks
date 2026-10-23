/*
 * 厦门地铁景点街区（续）——坐标约定见 xmAttr.js（出口亭在原点，玩家往 +z 走出来；路在北边 z -22..-8）。
 *   镇海路 1 / 3B：和平码头 + 远处鼓浪屿（日光岩、郑成功像）；中山路步行街骑楼（3B 出口在骑楼街口）
 *   莲坂 3：外图厦门书城（玻璃大厅里的波浪形书架，可以走进去）
 *   高崎 1：海堤纪念公园（老铁轨一直铺进海里）
 *   园博苑 2：水上园林 + 落羽杉（长在水里的“水杉林”）
 *   官任 3：诚毅科技探索中心
 *   蔡塘 2：忠仑公园
 *   湖滨中路 2：白鹭洲公园（白鹭女神像 + 音乐喷泉，筼筜湖）
 *   邮轮中心 6：厦鼓码头（去鼓浪屿的轮渡）
 *   海沧湾公园 2：海边看海沧大桥
 */
import { hex } from '../core/geo.js';
import * as D from './decor.js';
import { textPaint, pillarText, facadePaint, FONT } from './xmStreet.js';
import { q2, disc, ring, ringCol, roof, palm, figure } from './xmAttr.js';

const WIP_EXITS = {
  zhl: { n: '1', x: 10, line: 1, road: '和平码头', to: ['和平码头', '中山路步行街 3B'], toEn: ['Heping Pier', 'Zhongshan Road (Exit 3B)'] },
  lbn: { n: '3', x: 10, line: 1, road: '嘉禾路', to: ['外图厦门书城'], toEn: ['Xiamen Book City'] },
  gqi: { n: '1', x: 10, line: 1, road: '海堤纪念公园', to: ['海堤纪念公园'], toEn: ['Seawall Memorial Park'] },
  yby: { n: '2', x: 10, line: 1, road: '园博苑', to: ['园博苑'], toEn: ['Garden Expo Park'] },
  grn: { n: '3', x: 10, line: 1, road: '诚毅科技探索中心', to: ['诚毅科技探索中心'], toEn: ['Chengyi Sci-Tech Center'] },
  ctg: { n: '2', x: 10, line: 2, road: '忠仑公园', to: ['忠仑公园'], toEn: ['Zhonglun Park'] },
  hbz: { n: '2', x: 10, line: 2, road: '白鹭洲公园', to: ['白鹭洲公园'], toEn: ['Bailuzhou Park'] },
  ylz: { n: '6', x: 10, line: 2, road: '厦鼓码头', to: ['厦鼓码头'], toEn: ['Xiamen–Gulangyu Ferry Pier'] },
  hcw: { n: '2', x: 10, line: 2, road: '海沧湾公园', to: ['海沧湾公园', '海沧大桥'], toEn: ['Haicang Bay Park', 'Haicang Bridge'] },
};

const TAU = Math.PI * 2;
function front(S, road, trees = true) {
  S.road(-160, 160, -22, -8, true, road || null);
  if (trees) for (let x = -150; x <= 150; x += 12) if (Math.abs(x) > 6) S.lightTree(x, -6.2, 0.8);
  for (const x of [-8, 8]) D.lamp(S.kit, x, 0, -6.6, Math.PI);
}
function stone(S, x, z, w, h, zh, en, { bg = '#8E8A82', fg = '#F2E2B0', ry = 0 } = {}) {
  const k = S.kit, A = S.atlas, c = Math.cos(ry), s = Math.sin(ry);
  k.g('granite').box(x, h / 2, z, w, h, 0.6, hex(bg), ry); k.col(x, h / 2, z, w, h, 0.6, { ry });
  const uv = A.draw(w * 0.94, h * 0.8, textPaint(en ? [zh, en] : [zh], { bg, fg }));
  A.quad(x - s * 0.31, h * 0.5, z - c * 0.31, w * 0.94, h * 0.8, ry, uv); A.quad(x + s * 0.31, h * 0.5, z + c * 0.31, w * 0.94, h * 0.8, ry + Math.PI, uv);
}
/** 海面：z ≥ z0，岸线碰撞 */
function sea(S, z0, x0 = -900, x1 = 900, col = '#3C86A6') {
  const k = S.kit, W = k.g('gloss@water');
  W.slab(x0, x1, -0.3, -0.05, z0, 1200, hex(col), { ao: false });
  for (let i = 0; i < 20; i++) { const x = -260 + i * 26 + D.rnd() * 8, z = z0 + 10 + D.rnd() * 140; W.slab(x, x + 12, -0.045, -0.04, z, z + 0.6, hex('#BFDDE8'), { ao: false }); }
  k.colSlab(Math.max(x0, -160), Math.min(x1, 160), 0, 3, z0 - 1.2, z0 - 0.4);
}
/** 海边石栏杆（沿 x 方向） */
function seawall(S, x0, x1, z, gaps = []) {
  const k = S.kit, GR = k.g('granite'), C = hex('#D7D1C4');
  GR.slab(x0, x1, -0.3, 0.2, z - 1.2, z, hex('#BDB6A8'), { ao: false });
  for (let x = x0; x <= x1; x += 2.5) { if (gaps.some(([a, b]) => x > a && x < b)) continue; GR.slab(x - 0.15, x + 0.15, 0.2, 1.1, z - 0.75, z - 0.45, C, { ao: false }); }
  let a = x0; for (const [g0, g1] of [...gaps, [x1, x1]]) { if (g0 > a) GR.slab(a, g0, 1.0, 1.15, z - 0.8, z - 0.4, C, { ao: false }); a = g1; }
}
/** 鼓浪屿（远景）：绿岛 + 日光岩 + 红顶洋楼 + 东边礁石上的郑成功像 */
function gulangyu(S, cx, cz, s = 1) {
  const P = S.kit.solid;
  P.ellipsoid(cx, 0, cz, 320 * s, 44 * s, 150 * s, hex('#5E8A5A'), 2);
  P.ellipsoid(cx - 40 * s, 14 * s, cz - 10 * s, 120 * s, 46 * s, 70 * s, hex('#6A955E'), 1);
  // 日光岩（灰白巨石 + 顶上小旗杆）
  P.ellipsoid(cx - 40 * s, 38 * s, cz - 12 * s, 26 * s, 26 * s, 22 * s, hex('#B9B2A6'), 1); P.ellipsoid(cx - 32 * s, 46 * s, cz - 16 * s, 14 * s, 16 * s, 12 * s, hex('#C7C0B4'), 1);
  P.cyl(cx - 34 * s, 58 * s, cz - 16 * s, 0.6 * s, 8 * s, hex('#8A8A8A'), 4); P.box(cx - 32 * s, 60 * s, cz - 16 * s, 3.5 * s, 2.4 * s, 0.2, hex('#D6312A'));
  // 洋楼（红屋顶白墙）
  for (let i = 0; i < 26; i++) { const a = (i / 26) * Math.PI + Math.PI, r = 0.55 + D.rnd() * 0.35, x = cx + Math.cos(a) * 280 * s * r, z = cz + Math.sin(a) * 120 * s * r * 0.6 - 10 * s, y = 6 * s + (1 - r) * 30 * s;
    const w = (6 + D.rnd() * 6) * s, h = (5 + D.rnd() * 6) * s; P.slab(x - w / 2, x + w / 2, y - 2 * s, y + h, z - w / 3, z + w / 3, hex(['#F1EDE4', '#E9DFC9', '#EDE4D6'][i % 3]), { ao: false });
    P.cyl(x, y + h + 1.6 * s, z, w * 1.3, 3.2 * s, hex('#B6513A'), 4, Math.PI / 4, 0, 0, 0.1); }
  // 郑成功像（东头覆鼎岩上，白色花岗岩，面朝东）
  const ex = cx + 200 * s, ez = cz - 60 * s; P.ellipsoid(ex, 0, ez, 30 * s, 16 * s, 24 * s, hex('#A8A296'), 1);
  P.cyl(ex, 20 * s, ez, 6 * s, 16 * s, hex('#EDEAE2'), 8, 0, 0, 0, 4.5 * s); P.sphere(ex, 30 * s, ez, 4 * s, hex('#EDEAE2'), 1); P.cyl(ex, 33 * s, ez, 3 * s, 2 * s, hex('#EDEAE2'), 6);
  P.tube([ex, 26 * s, ez - 2 * s], [ex - 5 * s, 22 * s, ez - 4 * s], 1.6 * s, hex('#EDEAE2'), 5);
}
/** 轮渡船（白色双层） */
function ferry(P, x, z, ry = 0, col = '#2F6FB5', name = null, A = null) {
  const c = Math.cos(ry), s = Math.sin(ry);
  P.box(x, 0.4, z, 8, 2.2, 26, hex('#F4F5F6'), ry); P.box(x, 0.1, z, 8.1, 0.6, 26.2, hex(col), ry);
  P.box(x - s * 1, 2.6, z - c * 1, 7, 2.2, 18, hex('#F4F5F6'), ry); P.box(x - s * 1, 2.65, z - c * 1, 7.05, 0.9, 17.8, hex('#4E6E86'), ry);
  P.box(x - s * 3, 4.6, z - c * 3, 6, 1.8, 8, hex('#F4F5F6'), ry); P.box(x + s * 12.5, 0.6, z + c * 12.5, 4, 1.8, 3, hex('#F4F5F6'), ry);
}

/* ====================== 镇海路站 1 / 3B：和平码头 + 中山路骑楼 ====================== */
function zhenhaiRoad(S) {
  const k = S.kit, P = k.solid, A = S.atlas, GR = k.g('granite');
  front(S, '镇海路');
  // 东边 / 正前：去和平码头的滨海广场
  GR.slab(-24, 160, 0.005, 0.03, 2, 108, hex('#D2CCBF'), { ao: false });
  // 和平码头候船楼：两层，中间钟楼，“和平码头”大字
  const TX = 30, TZ = 86;
  S.facadeBlock(TX, TZ, 60, 16, 9, '#EDE8DE', facadePaint({ floors: 2, bays: 14, wall: '#EDE8DE', band: '#2F6FB5', glass: '#7FA6C0', frame: '#FFFFFF', grille: false }), facadePaint({ floors: 2, bays: 4, wall: '#EDE8DE', band: '#2F6FB5', glass: '#7FA6C0', frame: '#FFFFFF', grille: false }));
  P.slab(TX - 4, TX + 4, 9.5, 20, TZ - 4, TZ + 4, hex('#EDE8DE'), { ao: false }); k.g('gloss').cyl(TX, 21.5, TZ, 9.5, 3, hex('#2F6FB5'), 4, Math.PI / 4, 0, 0, 1);
  const clock = (c, pw, ph) => { c.fillStyle = '#EDE8DE'; c.fillRect(0, 0, pw, ph); c.fillStyle = '#FFFFFF'; c.beginPath(); c.arc(pw / 2, ph / 2, ph * 0.44, 0, TAU); c.fill(); c.strokeStyle = '#1B2530'; c.lineWidth = ph * 0.04; c.stroke();
    for (let i = 0; i < 12; i++) { const a = i / 12 * TAU; c.fillRect(pw / 2 + Math.cos(a) * ph * 0.36 - 2, ph / 2 + Math.sin(a) * ph * 0.36 - 2, 4, 4); }
    c.lineWidth = ph * 0.05; c.beginPath(); c.moveTo(pw / 2, ph / 2); c.lineTo(pw / 2, ph * 0.18); c.moveTo(pw / 2, ph / 2); c.lineTo(pw * 0.7, ph * 0.55); c.stroke(); };
  A.quad(TX, 16.5, TZ - 4.02, 5, 5, 0, A.draw(5, 5, clock));
  A.quad(TX, 10.5, TZ - 8.06, 18, 2.4, 0, A.draw(18, 2.4, textPaint(['和平码头', 'HEPING PIER'], { bg: '#2F6FB5', fg: '#FFFFFF' })));
  A.quad(TX, 2.0, TZ - 8.06, 8, 3.2, 0, A.draw(8, 3.2, (c, pw, ph) => { c.fillStyle = '#3A4A5A'; c.fillRect(0, 0, pw, ph); c.fillStyle = '#9FC1D8'; for (let i = 0; i < 4; i++) c.fillRect(pw * (0.04 + i * 0.24), ph * 0.08, pw * 0.2, ph * 0.84); }));
  // 码头：栈桥 + 停靠的轮渡（码头楼两侧到海）
  seawall(S, -24, 160, 110, [[-2, 70]]);
  P.slab(0, 60, -0.3, 0.05, 94, 132, hex('#B8B1A4'), { ao: false }); k.colSlab(0, 60, 0, 3, 132, 133); k.colSlab(-1, 0, 0, 3, 108, 132); k.colSlab(60, 61, 0, 3, 108, 132);
  for (let x = 0; x <= 60; x += 3) k.metal.cyl(x, 0.6, 131.6, 0.12, 1.2, hex('#5C646C'), 5);
  k.metal.tube([0, 1.15, 131.6], [60, 1.15, 131.6], 0.08, hex('#5C646C'), 5);
  for (const x of [8, 50]) { P.cyl(x, 0.4, 130, 0.5, 0.8, hex('#2A2A2A'), 8); }
  ferry(P, 20, 146, Math.PI / 2); ferry(P, 70, 170, Math.PI / 2 + 0.3, '#C8322A');
  sea(S, 133, -900, 900); k.colSlab(-160, 0, 0, 3, 109, 110); k.colSlab(60, 160, 0, 3, 109, 110);
  gulangyu(S, 40, 470, 1);
  // 西边：中山路步行街（x -100..-40 的一段，南北向），两边骑楼；3B 出口在街口
  const X0 = -84, X1 = -56, Z0 = -6, Z1 = 100;
  P.slab(X0, X1, 0.005, 0.03, Z0, Z1, hex('#B7AB98'), { ao: false });
  for (let z = Z0 + 2; z < Z1; z += 4) P.slab(X0 + 2, X1 - 2, 0.031, 0.036, z, z + 0.3, hex('#A0957F'), { ao: false });
  const pastel = ['#E9D6B4', '#F1E5CF', '#E4C9A8', '#EBDCC2', '#DDC6A6', '#F0DFC6'];
  const qilou = (side, z0, z1, i) => {  // side -1 = 西侧（立面朝 +x），+1 = 东侧（朝 -x）
    const xf = side < 0 ? X0 : X1, xb = xf + side * 14, w = z1 - z0, col = pastel[i % 6], h = 13 + (i % 3) * 2.5;
    const a = Math.min(xf, xb), b = Math.max(xf, xb);
    // 后半截实墙，前 3.5 m 是骑楼（底层廊下，二层以上挑出来压在柱子上）
    const xi = xf + side * 3.5, ai = Math.min(xi, xb), bi = Math.max(xi, xb);
    P.slab(ai, bi, 0, h, z0 + 0.1, z1 - 0.1, hex(col), { ao: false }); k.colSlab(ai, bi, 0, h, z0, z1);
    P.slab(a, b, 4.2, h, z0 + 0.1, z1 - 0.1, hex(col), { ao: false });
    P.slab(Math.min(xf, xi), Math.max(xf, xi), 0.03, 0.06, z0, z1, hex('#9A8E7A'), { ao: false });
    for (const z of [z0 + 0.5, (z0 + z1) / 2, z1 - 0.5]) { P.slab(xf - 0.35, xf + 0.35, 0, 4.2, z - 0.35, z + 0.35, hex(col), { ao: false }); k.colSlab(xf - 0.35, xf + 0.35, 0, 4.2, z - 0.35, z + 0.35); }
    // 山花女儿墙（中间起拱）
    P.slab(xf - 0.2, xf + 0.2, h, h + 1.2, z0 + 0.2, z1 - 0.2, hex(col), { ao: false }); P.cyl(xf, h + 1.2, (z0 + z1) / 2, 4, 0.4, hex(col), 12, 0, 0, Math.PI / 2);
    const ry = side < 0 ? Math.PI / 2 : -Math.PI / 2;
    const uv = A.draw(w - 0.4, h - 4.4, facadePaint({ floors: 3, bays: Math.max(2, Math.round(w / 3.2)), wall: col, band: '#B5523B', glass: '#6F8DA0', frame: '#FFFFFF', grille: false, arch: true, tile: 0.05 }));
    A.quad(xf - side * 0.21, 4.2 + (h - 4.4) / 2, (z0 + z1) / 2, w - 0.4, h - 4.4, ry, uv);
    const shop = ['老字号', '黄则和', '馅饼', '沙茶面', '鼓浪屿馅饼', '花生汤', '土笋冻', '茶叶', '药房', '鱼丸'][i % 10];
    A.quad(xi - side * 0.02, 2.6, (z0 + z1) / 2, w * 0.7, 0.9, ry, A.draw(w * 0.7, 0.9, textPaint([shop], { bg: ['#8A2A1E', '#1E3A5A', '#2E5A3A'][i % 3], fg: '#F2D06B' })));
    A.quad(xi - side * 0.02, 1.1, (z0 + z1) / 2, w * 0.7, 1.8, ry, A.draw(w * 0.7, 1.8, (c, pw, ph) => { c.fillStyle = '#3A3A3A'; c.fillRect(0, 0, pw, ph); c.fillStyle = '#D9C69A'; c.fillRect(pw * 0.06, ph * 0.08, pw * 0.88, ph * 0.84); c.fillStyle = '#8A6A4A'; for (let j = 1; j < 4; j++) c.fillRect(pw * j / 4, ph * 0.08, 3, ph * 0.84); }));
  };
  let i = 0; for (let z = Z0 + 4; z < Z1 - 4; z += 11) { qilou(-1, z, z + 11, i); qilou(1, z + (i % 2 ? 0 : 0), z + 11, i + 3); i++; }
  // 3B 出口（街口，东侧骑楼廊下前）
  { const x = X1 - 6, z = 2; P.slab(x - 2.2, x + 2.2, 0, 0.06, z - 3, z + 2, hex('#B9B5AD'), { ao: false }); k.glass.slab(x - 2, x + 2, 0.06, 2.8, z - 2.6, z - 2.5, hex('#D6EEF8'));
    for (const s of [-1, 1]) k.glass.slab(x + s * 2 - 0.03, x + s * 2 + 0.03, 0.06, 2.8, z - 2.6, z + 1.2, hex('#D6EEF8')); k.metal.slab(x - 2.3, x + 2.3, 2.8, 3.0, z - 2.8, z + 1.4, hex('#5C646C'), { ao: false });
    k.colSlab(x - 2.1, x + 2.1, 0, 3, z - 2.7, z - 2.4); for (const s of [-1, 1]) k.colSlab(x + s * 2 - 0.1, x + s * 2 + 0.1, 0, 3, z - 2.6, z + 1.2);
    const sp = (c, pw, ph) => { c.fillStyle = '#20272E'; c.fillRect(0, 0, pw, ph); c.fillStyle = '#F2711C'; c.fillRect(0, 0, ph, ph); c.fillStyle = '#FFF'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.font = `800 ${ph * 0.46}px Arial`; c.fillText('3B', ph / 2, ph * 0.54); c.textAlign = 'left'; c.font = `800 ${ph * 0.38}px ${FONT}`; c.fillText('3B出口 中山路', ph * 1.2, ph * 0.52); };
    A.quad(x, 3.3, z + 1.25, 3.4, 0.6, Math.PI, A.draw(3.4, 0.6, sp)); k.metal.slab(x - 1.75, x + 1.75, 3.0, 3.6, z + 1.18, z + 1.22, hex('#20272E'), { ao: false }); }
  // 中山路牌坊式街名牌
  { const z = 12; for (const x of [X0 + 1, X1 - 1]) { P.cyl(x, 3, z, 0.5, 6, hex('#8A2A1E'), 8); k.colSlab(x - 0.3, x + 0.3, 0, 6, z - 0.3, z + 0.3); } P.slab(X0, X1, 5.6, 7.0, z - 0.3, z + 0.3, hex('#8A2A1E'), { ao: false });
    const uv = A.draw(X1 - X0 - 2, 1.2, textPaint(['中山路步行街', 'Zhongshan Road'], { bg: '#8A2A1E', fg: '#F2D06B' })); A.quad((X0 + X1) / 2, 6.3, z - 0.32, X1 - X0 - 2, 1.2, 0, uv); A.quad((X0 + X1) / 2, 6.3, z + 0.32, X1 - X0 - 2, 1.2, Math.PI, uv); }
  for (const [x, z, c] of [[-72, 20, '#E84A5F'], [-68, 34, '#3FA7D6'], [-74, 52, '#F2B233'], [-66, 70, '#6CC04A'], [12, 60, '#E86A3A'], [40, 64, '#3FA7D6']]) figure(P, x, z, c, 1.5);
  for (let x = 0; x < 150; x += 14) S.lightTree(x, 106, 0.8, 1);
  S.filler([[-130, 40, 40, 80, 16, '#D8CDB8'], [120, 50, 40, 50, 22, '#CDC5B8'], [-30, -42, 40, 16, 18, '#D2CABE'], [40, -42, 40, 16, 22, '#C6BEB1'], [-110, -44, 40, 16, 14, '#E0D3BC']]);
}

/* ====================== 莲坂站 3 号出口：外图厦门书城 ====================== */
function bookCity(S) {
  const k = S.kit, P = k.solid, A = S.atlas, GR = k.g('granite'), WD = k.g('paint@wood');
  front(S, '嘉禾路');
  GR.slab(-60, 60, 0.005, 0.03, -6, 34, hex('#D2CCBF'), { ao: false });
  // 书城：四层大楼（玻璃幕墙 + 顶上红字招牌），一层是通高玻璃大厅，正门敞开可以走进去
  const X0 = -40, X1 = 40, Z0 = 34, Z1 = 90, H = 24;
  const glassFac = facadePaint({ floors: 4, bays: 16, wall: '#5A6A78', band: '#3A4652', glass: '#8FB4CC', frame: '#C9D3DA', grille: false });
  // 二层以上
  P.slab(X0, X1, 8, H, Z0 + 0.5, Z1, hex('#C9D3DA'), { ao: false });
  A.quad(0, 8 + (H - 8) / 2, Z0 + 0.48, X1 - X0, H - 8, 0, A.draw(X1 - X0, H - 8, glassFac));
  P.slab(X0 - 0.5, X1 + 0.5, H, H + 0.6, Z0, Z1 + 0.5, hex('#3A4652'), { ao: false });
  const sign = (c, pw, ph) => { c.fillStyle = '#B3261E'; c.fillRect(0, 0, pw, ph); c.fillStyle = '#FFFFFF'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.font = `800 ${ph * 0.6}px ${FONT}`; c.fillText('外图厦门书城', pw / 2, ph * 0.42); c.font = `600 ${ph * 0.2}px Arial`; c.fillText('XIAMEN FOREIGN BOOK CITY', pw / 2, ph * 0.82); };
  P.slab(-16, 16, H + 0.6, H + 5, Z0 + 0.2, Z0 + 0.8, hex('#B3261E'), { ao: false }); A.quad(0, H + 2.8, Z0 + 0.18, 32, 4.4, 0, A.draw(32, 4.4, sign));
  // 一层大厅：两侧和后面实墙，正面玻璃（中间 8 m 开口）
  P.slab(X0, X0 + 0.5, 0, 8, Z0, Z1, hex('#C9D3DA'), { ao: false }); P.slab(X1 - 0.5, X1, 0, 8, Z0, Z1, hex('#C9D3DA'), { ao: false }); P.slab(X0, X1, 0, 8, Z1 - 0.5, Z1, hex('#E9E4DA'), { ao: false });
  k.colSlab(X0, X0 + 0.5, 0, 8, Z0, Z1); k.colSlab(X1 - 0.5, X1, 0, 8, Z0, Z1); k.colSlab(X0, X1, 0, 8, Z1 - 0.5, Z1);
  for (const [a, b] of [[X0, -4], [4, X1]]) { k.glass.slab(a, b, 0.05, 7.9, Z0 + 0.45, Z0 + 0.55, hex('#D6EEF8')); k.colSlab(a, b, 0, 8, Z0 + 0.3, Z0 + 0.7); }
  for (let x = X0; x <= X1; x += 5) k.metal.slab(x - 0.08, x + 0.08, 0, 8, Z0 + 0.4, Z0 + 0.6, hex('#3A4652'), { ao: false });
  k.metal.slab(X0, X1, 7.8, 8.2, Z0 + 0.3, Z0 + 0.7, hex('#3A4652'), { ao: false });
  P.slab(X0 + 0.5, X1 - 0.5, 7.7, 8, Z0 + 0.5, Z1 - 0.5, hex('#F4EFE6'), { ao: false });   // 天花
  WD.slab(X0 + 0.5, X1 - 0.5, 0.005, 0.03, Z0 + 0.5, Z1 - 0.5, hex('#C9A37A'), { ao: false });
  for (let x = X0 + 6; x < X1 - 4; x += 8) for (let z = Z0 + 6; z < Z1 - 4; z += 8) k.glow.slab(x - 1.2, x + 1.2, 7.66, 7.7, z - 0.3, z + 0.3, hex('#FFF6E0'), { ao: false });
  // 波浪形书架：顺着正弦曲线摆的一串书架格子（彩色书脊）
  const spines = (c, pw, ph) => { const cols = ['#B3261E', '#2F6FB5', '#E0A82E', '#2E8B57', '#6A3D8A', '#E86A3A', '#1E3A5A', '#F2F2F2', '#3FA7D6'];
    c.fillStyle = '#7A5A3C'; c.fillRect(0, 0, pw, ph); const rows = 5, rh = ph / rows;
    for (let r = 0; r < rows; r++) { let x = 3; while (x < pw - 3) { const w = 5 + ((x * 7 + r * 13) % 9), h = rh * (0.62 + ((x * 3 + r) % 5) * 0.06); c.fillStyle = cols[(x + r * 5) % cols.length]; c.fillRect(x, r * rh + rh - 4 - h, w - 1, h); x += w; } c.fillStyle = '#5A3E28'; c.fillRect(0, r * rh + rh - 4, pw, 4); } };
  const suv = A.draw(2.4, 2.2, spines);
  const wave = (zc, amp, ph0, h) => { const N = 18, xs = X0 + 4, xe = X1 - 4;
    for (let i = 0; i < N; i++) { const t0 = i / N, t1 = (i + 1) / N, x0 = xs + (xe - xs) * t0, x1 = xs + (xe - xs) * t1, z0 = zc + Math.sin(t0 * TAU * 1.5 + ph0) * amp, z1 = zc + Math.sin(t1 * TAU * 1.5 + ph0) * amp;
      const mx = (x0 + x1) / 2, mz = (z0 + z1) / 2, len = Math.hypot(x1 - x0, z1 - z0), ry = Math.atan2(x1 - x0, z1 - z0);
      WD.box(mx, h / 2, mz, 0.5, h, len + 0.05, hex('#8A6A4A'), ry); k.col(mx, h / 2, mz, 0.5, h, len, { ry });
      WD.box(mx, h + 0.04, mz, 0.6, 0.08, len + 0.1, hex('#E9D8B8'), ry);
      const nx = Math.cos(ry), nz = -Math.sin(ry);   // 书架两面的法线
      for (const s of [-1, 1]) A.quad(mx + s * nx * 0.26, h / 2, mz + s * nz * 0.26, len * 0.98, h * 0.94, ry + (s > 0 ? Math.PI / 2 : -Math.PI / 2), suv); } };
  wave(Z0 + 16, 3.2, 0, 2.2); wave(Z0 + 30, 3.2, Math.PI, 2.2);
  // 后墙通高书墙
  const wuv = A.draw(X1 - X0 - 2, 7, spines); A.quad(0, 3.7, Z1 - 0.52, X1 - X0 - 2, 7, Math.PI, wuv);
  // 读书台 + 小朋友
  for (const [x, z] of [[-24, Z0 + 42], [0, Z0 + 44], [24, Z0 + 42]]) { WD.cyl(x, 0.4, z, 3.2, 0.8, hex('#E9D8B8'), 12); k.col(x, 0.4, z, 3, 0.8, 3); for (let j = 0; j < 5; j++) P.box(x - 0.8 + j * 0.4, 0.86, z + (j % 2) * 0.3, 0.32, 0.12, 0.45, hex(['#B3261E', '#2F6FB5', '#E0A82E', '#2E8B57', '#6A3D8A'][j]), j * 0.4); }
  for (const [x, z, c] of [[-20, Z0 + 23, '#E84A5F'], [10, Z0 + 24, '#3FA7D6'], [-4, Z0 + 38, '#F2B233'], [26, Z0 + 37, '#6CC04A']]) figure(P, x, z, c, 1.2);
  // 门前小广场
  for (const x of [-30, -15, 15, 30]) S.lightTree(x, 26, 0.9, 1);
  for (const [x, r] of [[-22, 0], [22, 0]]) D.bench(k, x, 0, 20, r);
  S.filler([[-100, 50, 50, 50, 40, '#C9C2B6'], [100, 50, 50, 50, 50, '#BFB6A8'], [-70, -44, 50, 16, 30, '#D2CABE'], [40, -44, 50, 16, 36, '#C6BEB1'], [0, 130, 120, 30, 30, '#CDC5B8']]);
}

/* ====================== 高崎站 1 号出口：海堤纪念公园 ====================== */
function seawallPark(S) {
  const k = S.kit, P = k.solid, A = S.atlas, GR = k.g('granite'), G = k.g('grass');
  front(S, null);
  G.slab(-160, 160, 0.004, 0.012, 2, 100, hex('#FFFFFF'), { ao: false });
  stone(S, -10, 14, 6, 2.0, '海堤纪念公园', 'Seawall Memorial Park', { bg: '#7E7A70' });
  // 老铁轨：从公园里一路铺到海里（鹰厦铁路的老海堤段）；枕木 + 两条钢轨 + 碎石道床
  const RX = 14, rz0 = 20, rz1 = 420;
  P.slab(RX - 2.2, RX + 2.2, 0, 0.25, rz0, 98, hex('#8E877C'), { ao: false });
  for (let z = rz0 + 0.4; z < rz1; z += 0.8) k.g('paint@wood').slab(RX - 1.3, RX + 1.3, 0.25, 0.4, z - 0.12, z + 0.12, hex('#5A4632'), { ao: false });
  for (const s of [-0.72, 0.72]) { k.metal.slab(RX + s - 0.05, RX + s + 0.05, 0.4, 0.58, rz0, rz1, hex('#6F6A64'), { ao: false }); k.metal.slab(RX + s - 0.035, RX + s + 0.035, 0.58, 0.6, rz0, rz1, hex('#C9C7C2'), { ao: false }); }
  // 海堤：花岗岩条石堤身伸进海里，两侧护栏
  GR.slab(RX - 6, RX + 6, -0.5, 0.25, 98, rz1, hex('#B6AE9F'), { ao: false });
  for (const s of [-1, 1]) { GR.slab(RX + s * 6 - 0.3, RX + s * 6 + 0.3, 0.25, 1.0, 98, rz1, hex('#C9C2B4'), { ao: false }); k.colSlab(RX + s * 6 - 0.3, RX + s * 6 + 0.3, 0, 1.2, 98, 200); }
  for (let z = 104; z < rz1; z += 10) GR.slab(RX - 6.3, RX + 6.3, -0.5, 0.26, z, z + 0.3, hex('#A39B8C'), { ao: false });
  for (let z = 110; z < 300; z += 30) { k.metal.cyl(RX + 6.6, 3, z, 0.18, 6, hex('#6F6A64'), 6); k.metal.tube([RX + 6.6, 5.8, z], [RX + 4.5, 5.8, z], 0.1, hex('#6F6A64'), 4); }
  // 车挡 + 老信号机
  P.slab(RX - 1.6, RX + 1.6, 0.4, 1.4, rz0 - 0.6, rz0, hex('#C8322A'), { ao: false }); for (let i = 0; i < 4; i++) P.slab(RX - 1.6 + i * 0.9, RX - 1.2 + i * 0.9, 0.42, 1.38, rz0 - 0.62, rz0 - 0.58, hex('#F2F2F2'), { ao: false }); k.colSlab(RX - 1.6, RX + 1.6, 0, 1.4, rz0 - 0.6, rz0);
  { const x = RX + 3.2, z = 40; k.metal.cyl(x, 3, z, 0.22, 6, hex('#3A3A3A'), 6); P.slab(x - 0.5, x + 0.5, 4.6, 6.4, z - 0.3, z + 0.3, hex('#1B1B1B'), { ao: false }); k.glow.sphere(x, 6.0, z - 0.32, 0.5, hex('#FF4A3A'), 1); k.glow.sphere(x, 5.1, z - 0.32, 0.5, hex('#4AFF6A'), 1); }
  // 纪念碑：花岗岩方尖碑 + 题字
  { const x = -24, z = 56; for (let i = 0; i < 3; i++) GR.slab(x - 5 + i * 1.2, x + 5 - i * 1.2, i * 0.4, (i + 1) * 0.4, z - 5 + i * 1.2, z + 5 - i * 1.2, hex('#CFC7B8'), { ao: false });
    GR.slab(x - 1.6, x + 1.6, 1.2, 16, z - 1.6, z + 1.6, hex('#E9E4D8'), { ao: false }); GR.cyl(x, 16.8, z, 3.2, 1.6, hex('#E9E4D8'), 4, Math.PI / 4, 0, 0, 0.2); k.colSlab(x - 5, x + 5, 0, 1.2, z - 5, z + 5); k.colSlab(x - 1.6, x + 1.6, 0, 16, z - 1.6, z + 1.6);
    A.quad(x, 9, z - 1.62, 1.6, 12, 0, A.draw(1.6, 12, pillarText('移山填海', '#E9E4D8', '#B3261E'))); }
  // 浮雕墙（修堤的人们：抬石头的剪影）
  { const x0 = -70, x1 = -40, z = 70; GR.slab(x0, x1, 0, 3.6, z, z + 0.8, hex('#BDB6A8'), { ao: false }); k.colSlab(x0, x1, 0, 3.6, z, z + 0.8);
    A.quad((x0 + x1) / 2, 1.8, z - 0.02, x1 - x0 - 1, 3.0, 0, A.draw(x1 - x0 - 1, 3.0, (c, pw, ph) => { c.fillStyle = '#C9C2B4'; c.fillRect(0, 0, pw, ph); c.fillStyle = '#8E877C';
      for (let i = 0; i < 9; i++) { const x = pw * (0.06 + i * 0.11), y = ph * 0.9; c.beginPath(); c.arc(x, y - ph * 0.62, ph * 0.07, 0, TAU); c.fill(); c.fillRect(x - ph * 0.06, y - ph * 0.55, ph * 0.12, ph * 0.32); c.fillRect(x - ph * 0.08, y - ph * 0.25, ph * 0.05, ph * 0.25); c.fillRect(x + ph * 0.03, y - ph * 0.25, ph * 0.05, ph * 0.25);
        if (i % 2) { c.fillRect(x - ph * 0.3, y - ph * 0.72, ph * 0.6, ph * 0.04); c.fillRect(x + ph * 0.14, y - ph * 0.68, ph * 0.18, ph * 0.18); } } })); }
  // 海 + 对岸集美
  sea(S, 100, -900, RX - 6.2); sea(S, 100, RX + 6.2, 900);
  for (let x = -150; x <= 150; x += 2.5) if (Math.abs(x - RX) > 7) { GR.slab(x - 0.15, x + 0.15, 0, 1.0, 99, 99.3, hex('#D7D1C4'), { ao: false }); }
  GR.slab(-160, RX - 6, 0.9, 1.05, 99, 99.4, hex('#D7D1C4'), { ao: false }); GR.slab(RX + 6, 160, 0.9, 1.05, 99, 99.4, hex('#D7D1C4'), { ao: false });
  k.colSlab(-160, RX - 6.4, 0, 3, 98.6, 99.6); k.colSlab(RX + 6.4, 160, 0, 3, 98.6, 99.6);
  for (let i = 0; i < 16; i++) { const x = -420 + i * 56, h = 20 + D.rnd() * 50; P.slab(x, x + 30, 0, h, 640, 660, hex(['#D8D2C6', '#C9C2B6', '#BFC8CF'][i % 3]), { ao: false }); }
  for (let x = -150; x <= 150; x += 11) if (Math.abs(x - RX) > 8) S.lightTree(x, 92, 0.8, 0);
  for (const [x, z] of [[-60, 30], [50, 40], [80, 70], [-100, 60], [40, 80]]) S.lightTree(x, z, 1.4, 1);
  for (const [x, z, c] of [[RX - 3, 130, '#E84A5F'], [RX + 2, 150, '#3FA7D6'], [-20, 40, '#F2B233']]) figure(P, x, z, c, 1.4, x > 0 ? 0.25 : 0);
  S.filler([[-80, -42, 40, 16, 24, '#D2CABE'], [10, -44, 40, 16, 20, '#C9C2B6'], [80, -42, 40, 16, 28, '#CDC5B8']]);
}

/** 落羽杉：细高锥形树冠，秋天红褐；根部膝根 */
function cypress(P, x, z, h, col, y = 0) {
  P.cyl(x, y + h * 0.3, z, 0.55, h * 0.6, hex('#6A4A34'), 6, 0, 0, 0, 0.3);
  P.cyl(x, y + h * 0.62, z, h * 0.26, h * 0.76, hex(col), 7, 0, 0, 0, 0.05);
  for (let i = 0; i < 3; i++) { const a = i * 2.1; P.cyl(x + Math.cos(a) * 1.0, y + 0.25, z + Math.sin(a) * 1.0, 0.25, 0.5, hex('#6A4A34'), 4, 0, 0, 0, 0.08); }
}

/* ====================== 园博苑站 2 号出口：水上园林 + 落羽杉 ====================== */
function gardenExpo(S) {
  const k = S.kit, P = k.solid, A = S.atlas, GR = k.g('granite'), G = k.g('grass'), W = k.g('gloss@water');
  front(S, null);
  G.slab(-160, 160, 0.004, 0.012, 2, 40, hex('#FFFFFF'), { ao: false });
  // 园博苑大门（白色曲线门架 + 字）
  { const z = 30; for (const s of [-1, 1]) { P.cyl(s * 10, 4, z, 1.4, 8, hex('#F1EEE6'), 10); k.colSlab(s * 10 - 0.7, s * 10 + 0.7, 0, 8, z - 0.7, z + 0.7); }
    const pts = []; for (let i = 0; i <= 12; i++) { const t = i / 12; pts.push([-10 + 20 * t, 8 + Math.sin(t * Math.PI) * 3, z]); } P.path(pts, 1.0, hex('#F1EEE6'), 8);
    const uv = A.draw(10, 1.6, textPaint(['园博苑', 'Garden Expo Park'], { bg: '#2E7D5B', fg: '#FFFFFF' })); A.quad(0, 9.2, z - 0.55, 10, 1.6, 0, uv); A.quad(0, 9.2, z + 0.55, 10, 1.6, Math.PI, uv);
    k.metal.slab(-5, 5, 8.4, 10, z - 0.5, z + 0.5, hex('#2E7D5B'), { ao: false }); }
  // 大水面：z 44..196，水里一片片落羽杉；中间一条石板曲桥穿过去，桥上有亭
  W.slab(-160, 160, -0.3, 0.05, 44, 200, hex('#4C8A7E'), { ao: false });
  for (const [x, z, w] of [[-60, 70, 40], [50, 90, 50], [-20, 140, 30], [80, 160, 40]]) W.slab(x - w / 2, x + w / 2, 0.051, 0.056, z, z + 1, hex('#9FCBC0'), { ao: false });
  GR.slab(-160, 160, -0.3, 0.2, 42.5, 44, hex('#BDB6A8'), { ao: false });
  // 曲桥（之字形）：中心线
  const BR = [[0, 40], [0, 62], [16, 74], [-6, 92], [12, 112], [0, 130], [0, 196]], HW = 1.6;
  for (let i = 0; i < BR.length - 1; i++) { const [ax, az] = BR[i], [bx, bz] = BR[i + 1], len = Math.hypot(bx - ax, bz - az), ry = Math.atan2(bx - ax, bz - az), mx = (ax + bx) / 2, mz = (az + bz) / 2, nx = Math.cos(ry), nz = -Math.sin(ry);
    GR.box(mx, 0.25, mz, HW * 2, 0.3, len + HW * 2, hex('#D2CCBF'), ry);
    for (const s of [-1, 1]) { GR.box(mx + s * nx * HW, 0.75, mz + s * nz * HW, 0.18, 0.7, len, hex('#E9E4D8'), ry); k.col(mx + s * nx * (HW + 0.05), 0.7, mz + s * nz * (HW + 0.05), 0.25, 1.4, Math.max(0.5, len - HW * 1.6), { ry }); }
    for (let t = 0; t < len; t += 3) { const x = ax + (bx - ax) * t / len, z = az + (bz - az) * t / len; GR.cyl(x, -0.2, z, 0.9, 0.6, hex('#A39B8C'), 6); } }
  for (let i = 0; i < 64; i++) { const a = i / 64 * TAU; }
  // 不让人走下水：岸线（桥口留门）+ 桥两侧的水面挡
  k.colSlab(-160, -HW - 0.2, 0, 3, 43.4, 44); k.colSlab(HW + 0.2, 160, 0, 3, 43.4, 44);
  // 亭（桥中间平台上）
  { const x = 0, z = 130; GR.slab(x - 5, x + 5, 0, 0.42, z - 5, z + 5, hex('#D2CCBF'), { ao: false }); k.colSlab(x - 5.2, x - 5, 0, 1.2, z - 5, z - 2); k.colSlab(x + 5, x + 5.2, 0, 1.2, z - 5, z - 2); k.colSlab(x - 5.2, x - 5, 0, 1.2, z + 2, z + 5); k.colSlab(x + 5, x + 5.2, 0, 1.2, z + 2, z + 5);
    for (const [dx, dz] of [[-3, -3], [3, -3], [-3, 3], [3, 3]]) { P.cyl(x + dx, 2.0, z + dz, 0.36, 3.2, hex('#A23B2C'), 8); k.colSlab(x + dx - 0.2, x + dx + 0.2, 0, 3, z + dz - 0.2, z + dz + 0.2); }
    roof(k.g('gloss@tile'), x, z, 6.4, 6.4, 3.6, 2.6, hex('#3A4A5A'), { ovh: 1.0 }); }
  // 落羽杉林：成片立在水里（几片秋红、几片还绿）
  const cols = ['#B0562E', '#C46A34', '#9A4A2A', '#6E8A3A', '#8A7A3A'];
  const grove = (gx, gz, n, rx, rz) => { for (let i = 0; i < n; i++) { const x = gx + (D.rnd() - 0.5) * rx * 2, z = gz + (D.rnd() - 0.5) * rz * 2; if (Math.abs(x) < 4 && z < 135) continue; if (Math.abs(x - 6) < 14 && z > 60 && z < 120) continue; cypress(P, x, z, 12 + D.rnd() * 8, cols[i % cols.length]); } };
  grove(-40, 66, 14, 20, 12); grove(44, 70, 12, 18, 10); grove(-50, 120, 16, 26, 16); grove(50, 130, 14, 24, 16); grove(-20, 175, 12, 30, 10); grove(60, 180, 10, 30, 10);
  // 岸边：芦苇 + 长椅 + 游人
  for (let x = -140; x < 150; x += 12) if (Math.abs(x) > 12) S.lightTree(x, 38, 0.8, 1);
  for (const [x, r] of [[-20, 0], [24, 0]]) D.bench(k, x, 0, 36, r);
  for (const [x, z, c] of [[1, 52, '#E84A5F'], [10, 74, '#3FA7D6'], [-2, 128, '#F2B233']]) figure(P, x, z, c, 1.4, 0.4);
  // 远处的园林塔（园博苑里的主题塔）
  { const x = -100, z = 230; for (let i = 0; i < 5; i++) { const y = i * 6, w = 8 - i * 0.9; P.slab(x - w / 2, x + w / 2, y, y + 5, z - w / 2, z + w / 2, hex('#E9E4D8'), { ao: false }); roof(k.g('gloss@tile'), x, z, w, w, y + 5, 1.4, hex('#3A4A5A'), { ovh: 1.0, swallow: false }); } }
  S.filler([[-70, -42, 40, 16, 16, '#D2CABE'], [20, -44, 40, 16, 20, '#C9C2B6'], [100, -42, 40, 16, 18, '#CDC5B8']]);
}

/* ====================== 官任站 3 号出口：诚毅科技探索中心 ====================== */
function sciTech(S) {
  const k = S.kit, P = k.solid, A = S.atlas, GR = k.g('granite'), G = k.g('grass');
  front(S, null);
  GR.slab(-60, 60, 0.005, 0.03, -6, 80, hex('#D9D6CE'), { ao: false });
  G.slab(-160, -60, 0.004, 0.012, 2, 196, hex('#FFFFFF'), { ao: false }); G.slab(60, 160, 0.004, 0.012, 2, 196, hex('#FFFFFF'), { ao: false });
  // 科技馆：白色弧形大楼（多段折面近似弧墙），正中一颗“星球”球幕影院
  const cz = 150, R = 60, a0 = -0.9, a1 = 0.9, N = 14, H = 22;
  for (let i = 0; i < N; i++) { const t0 = a0 + (a1 - a0) * i / N, t1 = a0 + (a1 - a0) * (i + 1) / N, x0 = Math.sin(t0) * R, z0 = cz - Math.cos(t0) * R, x1 = Math.sin(t1) * R, z1 = cz - Math.cos(t1) * R;
    const mx = (x0 + x1) / 2, mz = (z0 + z1) / 2, len = Math.hypot(x1 - x0, z1 - z0), ry = Math.atan2(x1 - x0, z1 - z0);
    P.box(mx, H / 2, mz, 10, H, len + 0.2, hex('#F1F1EE'), ry); k.col(mx, H / 2, mz, 10, H, len, { ry });
    const nx = Math.cos(ry), nz = -Math.sin(ry), sg = (nz < 0 ? 1 : -1);
    for (let y = 3; y < H - 2; y += 4.5) k.glass.box(mx + sg * nx * 5.05, y + 1.2, mz + sg * nz * 5.05, 0.1, 2.4, len * 0.8, hex('#7FB4D6'), ry);
    k.metal.box(mx, H + 0.4, mz, 10.6, 0.8, len + 0.3, hex('#2F6FB5'), ry); }
  const dz = cz - R - 4;
  P.sphere(0, 16, dz, 24, hex('#E9EEF2'), 3); P.cyl(0, 3, dz, 18, 6, hex('#D9D6CE'), 16); k.col(0, 8, dz, 20, 16, 20);
  for (let i = 0; i < 3; i++) P.cyl(0, 16, dz, 27 + i * 0.1, 0.4, hex(['#2F6FB5', '#F2711C', '#00A651'][i]), 32, 0.4 * i, 0.35 + i * 0.3, 0.2 * i);   // 星环
  const sign = (c, pw, ph) => { c.fillStyle = '#2F6FB5'; c.fillRect(0, 0, pw, ph); c.fillStyle = '#FFFFFF'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.font = `800 ${ph * 0.5}px ${FONT}`; c.fillText('诚毅科技探索中心', pw / 2, ph * 0.4); c.font = `600 ${ph * 0.2}px Arial`; c.fillText('CHENGYI SCI-TECH EXPLORATION CENTER', pw / 2, ph * 0.8); };
  P.slab(-14, 14, 0, 3.2, dz - 14, dz - 13.4, hex('#2F6FB5'), { ao: false }); k.colSlab(-14, 14, 0, 3.2, dz - 14, dz - 13.4); A.quad(0, 1.6, dz - 14.02, 27.6, 3.0, 0, A.draw(27.6, 3.0, sign));
  // 广场：DNA 双螺旋雕塑 + 日晷 + 太阳系小行星
  { const x = -30, z = 40; GR.cyl(x, 0.3, z, 5, 0.6, hex('#BDB6A8'), 16);
    for (let i = 0; i < 28; i++) { const t = i / 28, y = 0.8 + t * 12, a = t * TAU * 2;
      for (const s of [0, Math.PI]) k.g('gloss').sphere(x + Math.cos(a + s) * 1.6, y, z + Math.sin(a + s) * 1.6, 0.6, hex(s ? '#F2711C' : '#2F6FB5'), 1);
      if (i % 2 === 0) k.metal.tube([x + Math.cos(a) * 1.6, y, z + Math.sin(a) * 1.6], [x - Math.cos(a) * 1.6, y, z - Math.sin(a) * 1.6], 0.14, hex('#D9DDE0'), 4); }
    k.col(x, 2, z, 4.6, 4, 4.6); }
  { const x = 30, z = 40; GR.cyl(x, 0.4, z, 7, 0.8, hex('#D7D1C4'), 24); k.metal.tube([x, 0.8, z + 1], [x, 5, z - 2], 0.3, hex('#8A7A5A'), 6); for (let i = 0; i < 12; i++) { const a = i / 12 * TAU; P.slab(x + Math.cos(a) * 3 - 0.1, x + Math.cos(a) * 3 + 0.1, 0.8, 0.84, z + Math.sin(a) * 3 - 0.3, z + Math.sin(a) * 3 + 0.3, hex('#5A4A3A'), { ao: false }); } k.col(x, 0.4, z, 7, 0.8, 7); }
  const planets = [['#F2B233', 3.0], ['#C9B39A', 0.7], ['#E3C08A', 1.0], ['#3F86C8', 1.1], ['#C8553D', 0.8], ['#D9A973', 2.2], ['#E8D3A2', 1.9]];
  planets.forEach(([c, d], i) => { const x = -50 + i * 16, z = 66; GR.cyl(x, 0.6, z, 1.0, 1.2, hex('#BDB6A8'), 8); k.g('gloss').sphere(x, 1.5 + d / 2, z, d, hex(c), 2); if (i === 5) P.cyl(x, 1.5 + d / 2, z, d * 1.8, 0.08, hex('#C9B38A'), 24, 0, 0.4); k.col(x, 1, z, 1.2, 2, 1.2); });
  for (const [x, z, c] of [[-6, 50, '#E84A5F'], [4, 60, '#3FA7D6'], [-24, 46, '#F2B233'], [20, 44, '#6CC04A']]) figure(P, x, z, c, 1.2);
  for (let z = 10; z < 90; z += 12) for (const x of [-56, 56]) S.lightTree(x, z, 0.9, 1);
  S.filler([[-70, -42, 40, 16, 30, '#D2CABE'], [20, -44, 40, 16, 40, '#C9C2B6'], [100, -42, 40, 16, 26, '#CDC5B8'], [-120, 120, 40, 60, 24, '#D8D2C6'], [120, 120, 40, 60, 30, '#CDC5B8']]);
}

/* ====================== 蔡塘站 2 号出口：忠仑公园 ====================== */
function zhonglunPark(S) {
  const k = S.kit, P = k.solid, A = S.atlas, GR = k.g('granite'), G = k.g('grass'), W = k.g('gloss@water');
  front(S, null);
  G.slab(-160, 160, 0.004, 0.012, 2, 196, hex('#FFFFFF'), { ao: false });
  // 大门：两块大石头 + 横梁“忠仑公园”
  { const z = 22; for (const s of [-1, 1]) { P.ellipsoid(s * 9, 2.4, z, 5, 5, 4, hex('#A39B8C'), 1); k.col(s * 9, 2.4, z, 4.4, 4.8, 3.6); }
    P.slab(-7, 7, 4.4, 6.0, z - 0.4, z + 0.4, hex('#5E6B5A'), { ao: false }); const uv = A.draw(13, 1.4, textPaint(['忠仑公园', 'Zhonglun Park'], { bg: '#5E6B5A', fg: '#F2EAD0' })); A.quad(0, 5.2, z - 0.42, 13, 1.4, 0, uv); A.quad(0, 5.2, z + 0.42, 13, 1.4, Math.PI, uv); }
  // 环形步道 + 中心湖
  const cx = 0, cz = 110, RX = 50, RZ = 32;
  ring(P, cx, cz, RX + 3, RZ + 3, RX + 7, RZ + 7, 0.02, hex('#C8553D'), 48);   // 红色塑胶跑道
  ring(GR, cx, cz, RX, RZ, RX + 1.2, RZ + 1.2, 0.2, hex('#BDB6A8'), 48);
  disc(W, cx, cz, RX + 0.2, RZ + 0.2, 0.06, hex('#4F8E96'), 48); ringCol(k, cx, cz, RX + 0.6, RZ + 0.6, 56);
  P.slab(-2, 2, 0.01, 0.03, 26, cz - RZ - 7, hex('#CBBFA8'), { ao: false });
  // 湖心喷泉 + 九曲桥边的亭
  P.cyl(cx, 0.2, cz, 6, 0.4, hex('#BDB6A8'), 16); for (let i = 0; i < 8; i++) { const a = i / 8 * TAU; k.glass.tube([cx + Math.cos(a) * 1, 0.4, cz + Math.sin(a) * 1], [cx + Math.cos(a) * 3.2, 4, cz + Math.sin(a) * 3.2], 0.25, hex('#E8F4FA'), 4); } k.glass.cyl(cx, 3.5, cz, 0.5, 7, hex('#E8F4FA'), 6);
  { const x = -RX - 10, z = cz; GR.slab(x - 3.2, x + 3.2, 0, 0.3, z - 3.2, z + 3.2, hex('#D2CCBF'), { ao: false }); for (const [dx, dz] of [[-2.2, -2.2], [2.2, -2.2], [-2.2, 2.2], [2.2, 2.2]]) { P.cyl(x + dx, 1.7, z + dz, 0.3, 2.8, hex('#A23B2C'), 8); k.colSlab(x + dx - 0.2, x + dx + 0.2, 0, 3, z + dz - 0.2, z + dz + 0.2); } roof(k.g('gloss@tile'), x, z, 5, 5, 3.1, 2.2, hex('#3A4A5A'), { ovh: 0.9 }); }
  // 小山包（绿草坡）+ 坡上的花海（三角梅 / 凤凰木）
  for (const [x, z, rx, ry, rz] of [[90, 80, 46, 10, 34], [-100, 160, 50, 12, 36], [100, 170, 40, 9, 30]]) { G.ellipsoid(x, 0, z, rx, ry * 2, rz, hex('#FFFFFF'), 2); k.col(x, ry / 2, z, rx * 0.7, ry, rz * 0.7); }
  for (let i = 0; i < 30; i++) { const a = D.rnd() * TAU, r = D.rnd(), x = 90 + Math.cos(a) * 18 * r, z = 80 + Math.sin(a) * 13 * r; P.sphere(x, 4.6 - r * 3.4, z, 1.2, hex(i % 3 ? '#D63384' : '#F2B233'), 0); }
  // 儿童游乐区 + 篮球场
  { const x = 70, z = 34; P.slab(x - 14, x + 14, 0.012, 0.04, z - 8, z + 8, hex('#F2C230'), { ao: false });
    for (const [dx, c] of [[-8, '#E84A5F'], [0, '#3FA7D6'], [8, '#6CC04A']]) { P.slab(x + dx - 1.5, x + dx + 1.5, 0, 2.2, z - 1.5, z + 1.5, hex(c), { ao: false }); P.cyl(x + dx, 3.2, z, 3.6, 2.0, hex('#F4F4F4'), 4, Math.PI / 4, 0, 0, 0); k.colSlab(x + dx - 1.5, x + dx + 1.5, 0, 2.2, z - 1.5, z + 1.5); }
    P.box(x + 4, 1.1, z + 4, 4.6, 0.12, 1.1, hex('#F2711C'), 0, 0, -0.42); }
  { const x = -70, z = 40; P.slab(x - 14, x + 14, 0.012, 0.04, z - 8, z + 8, hex('#3F7DA6'), { ao: false }); P.slab(x - 0.06, x + 0.06, 0.04, 0.05, z - 8, z + 8, hex('#FFFFFF'), { ao: false });
    for (const s of [-1, 1]) { k.metal.cyl(x + s * 13, 1.8, z, 0.2, 3.6, hex('#5C646C'), 6); P.slab(x + s * 12.6 - 0.05, x + s * 12.6 + 0.05, 3.0, 4.1, z - 0.9, z + 0.9, hex('#F4F4F4'), { ao: false }); k.metal.cyl(x + s * 12.2, 3.05, z, 0.5, 0.06, hex('#F2711C'), 10); } }
  for (let i = 0; i < 50; i++) { const a = i / 50 * TAU, x = cx + Math.cos(a) * (RX + 13 + D.rnd() * 6), z = cz + Math.sin(a) * (RZ + 13 + D.rnd() * 6); if (Math.abs(x) < 6 && z < cz) continue; if (x > 50 && z < 50) continue; if (x < -52 && z < 50) continue; S.lightTree(x, z, 0.9 + D.rnd() * 0.4, i % 3 ? 0 : 1); }
  for (const [x, z, c] of [[1, 40, '#E84A5F'], [-1, 60, '#3FA7D6'], [64, 36, '#F2B233'], [-66, 42, '#6CC04A'], [20, cz - RZ - 5, '#E86A3A']]) figure(P, x, z, c, 1.3);
  S.filler([[-70, -42, 40, 16, 60, '#C9CED2'], [20, -44, 40, 16, 80, '#B9C3CB'], [100, -42, 40, 16, 50, '#CDD2D6']]);
}

/* ====================== 湖滨中路站 2 号出口：白鹭洲公园（白鹭女神 + 音乐喷泉） ====================== */
function bailuzhou(S) {
  const k = S.kit, P = k.solid, A = S.atlas, GR = k.g('granite'), G = k.g('grass'), W = k.g('gloss@water');
  front(S, '湖滨中路');
  G.slab(-160, 160, 0.004, 0.012, 2, 70, hex('#FFFFFF'), { ao: false });
  stone(S, 10, 18, 5, 1.8, '白鹭洲公园', 'Bailuzhou Park', { bg: '#5E6B5A', fg: '#F2EAD0' });
  GR.slab(-3, 3, 0.005, 0.03, 0, 70, hex('#D2CCBF'), { ao: false });
  // 筼筜湖：z ≥ 72；岸边一排白栏杆
  W.slab(-900, 900, -0.3, 0.02, 72, 900, hex('#3F7F8E'), { ao: false });
  seawall(S, -160, 160, 72); k.colSlab(-160, 160, 0, 3, 71.2, 72);
  // 白鹭女神像：湖中圆台，白色少女坐像，手里托一只白鹭（鹭岛的城市雕塑）
  const SX = 0, SZ = 110;
  GR.cyl(SX, 0.6, SZ, 12, 1.2, hex('#BDB6A8'), 24); GR.cyl(SX, 2.4, SZ, 5, 2.4, hex('#E3DDD0'), 16);
  const Wh = hex('#F4F2EC');
  P.ellipsoid(SX, 5.2, SZ + 0.4, 3.8, 3.0, 4.6, Wh, 2);             // 衣裙 / 盘坐的腿
  P.cyl(SX, 7.8, SZ + 0.6, 2.2, 3.6, Wh, 10, 0, -0.1, 0, 1.4);       // 上身
  P.sphere(SX, 10.3, SZ + 0.4, 1.5, Wh, 2); P.ellipsoid(SX, 10.4, SZ + 1.0, 1.7, 2.4, 1.4, Wh, 1);   // 头 + 长发
  P.tube([SX - 0.9, 9.0, SZ + 0.4], [SX - 2.2, 10.2, SZ - 0.6], 0.6, Wh, 6); P.tube([SX - 2.2, 10.2, SZ - 0.6], [SX - 2.0, 11.8, SZ - 0.9], 0.5, Wh, 6);   // 举起的手
  P.tube([SX + 0.9, 9.0, SZ + 0.4], [SX + 2.0, 7.6, SZ - 0.8], 0.6, Wh, 6);
  // 手上的白鹭（展翅）
  { const bx = SX - 2.0, by = 12.6, bz = SZ - 1.0; P.ellipsoid(bx, by, bz, 0.7, 0.7, 1.4, Wh, 1); P.path([[bx, by + 0.3, bz - 0.5], [bx, by + 1.1, bz - 0.7], [bx, by + 1.2, bz - 1.1]], 0.2, Wh, 4); P.tubeTaper([bx, by + 1.2, bz - 1.2], [bx, by + 1.1, bz - 1.9], 0.14, 0.04, hex('#2A2A2A'), 4);
    for (const s of [-1, 1]) { q2(P, [bx, by + 0.2, bz - 0.4], [bx + s * 3.2, by + 1.8, bz + 0.2], [bx + s * 2.6, by + 1.0, bz + 1.2], [bx, by + 0.2, bz + 0.6], Wh); } }
  k.col(SX, 2, SZ, 12, 4, 12);
  // 音乐喷泉：雕像前一排水柱（不同高度）+ 灯
  for (let i = 0; i < 25; i++) { const x = -48 + i * 4, z = 90, h = 3 + Math.abs(Math.sin(i * 0.7)) * 9; k.glass.cyl(x, h / 2, z, 0.45, h, hex('#E8F6FC'), 6, 0, 0, 0, 0.15); k.glass.sphere(x, h, z, 1.0, hex('#F4FAFE'), 1); k.glow.cyl(x, 0.1, z, 0.9, 0.12, hex(['#7FD3FF', '#FFE07F', '#FF8FB8'][i % 3]), 8); }
  for (let i = 0; i < 12; i++) { const a = i / 12 * TAU, x = SX + Math.cos(a) * 9, z = SZ + Math.sin(a) * 9; k.glass.tube([x, 0.2, z], [SX + Math.cos(a) * 6.5, 6, SZ + Math.sin(a) * 6.5], 0.35, hex('#E8F6FC'), 4); }
  // 白鹭（湖面 / 栏杆上）
  const egret = (x, z, y = 0, fly = false) => { P.ellipsoid(x, y + 0.9, z, 0.34, 0.4, 0.7, Wh, 1, 0.4, 0.4); P.path([[x, y + 1.05, z + 0.25], [x, y + 1.45, z + 0.3], [x, y + 1.6, z + 0.42]], 0.09, Wh, 4); P.tubeTaper([x, y + 1.62, z + 0.5], [x, y + 1.6, z + 0.8], 0.06, 0.02, hex('#2A2A2A'), 4);
    if (fly) for (const s of [-1, 1]) q2(P, [x, y + 1.0, z - 0.2], [x + s * 1.4, y + 1.6, z], [x + s * 1.2, y + 1.2, z + 0.4], [x, y + 1.0, z + 0.3], Wh); else for (const s of [-0.08, 0.08]) P.tube([x + s, y, z], [x + s, y + 0.7, z], 0.03, hex('#2A2A2A'), 3); };
  for (const [x, z] of [[-30, 71.4], [24, 71.4], [60, 71.4]]) egret(x, z, 1.1);
  for (const [x, z, y] of [[-20, 130, 8], [16, 140, 12], [40, 120, 6], [-50, 150, 10]]) egret(x, z, y, true);
  // 对岸：筼筜湖边的城市天际线
  for (let i = 0; i < 18; i++) { const x = -460 + i * 52, h = 30 + D.rnd() * 90; P.slab(x, x + 30, 0, h, 360, 380, hex(['#D8D2C6', '#C9C2B6', '#BFC8CF', '#AEB9C2'][i % 4]), { ao: false }); }
  for (let x = -150; x <= 150; x += 12) if (Math.abs(x) > 6) palm(P, x, 64, 7, 0.8, x * 0.2);
  for (const [x, r] of [[-20, Math.PI], [20, Math.PI], [-50, Math.PI], [50, Math.PI]]) D.bench(k, x, 0, 66, r);
  for (const [x, z, c] of [[-4, 60, '#E84A5F'], [6, 62, '#3FA7D6'], [-40, 68, '#F2B233']]) figure(P, x, z, c, 1.4);
  S.filler([[-70, -42, 40, 16, 40, '#D2CABE'], [20, -44, 40, 16, 60, '#C9C2B6'], [100, -42, 40, 16, 36, '#CDC5B8']]);
}

/* ====================== 邮轮中心站 6 号出口：厦鼓码头 ====================== */
function ferryPier(S) {
  const k = S.kit, P = k.solid, A = S.atlas, GR = k.g('granite');
  front(S, '东渡路');
  GR.slab(-160, 160, 0.005, 0.03, -6, 100, hex('#D2CCBF'), { ao: false });
  // 厦鼓码头候船厅：白色大屋面（波浪形）+ 蓝色字
  const X0 = -50, X1 = 50, Z0 = 52, Z1 = 84;
  S.facadeBlock(0, (Z0 + Z1) / 2, X1 - X0, Z1 - Z0, 10, '#F1F1EE', facadePaint({ floors: 2, bays: 20, wall: '#F1F1EE', band: '#2F6FB5', glass: '#7FA6C0', frame: '#FFFFFF', grille: false }), facadePaint({ floors: 2, bays: 6, wall: '#F1F1EE', band: '#2F6FB5', glass: '#7FA6C0', frame: '#FFFFFF', grille: false }));
  for (let i = 0; i < 5; i++) { const x = X0 + 10 + i * 20; k.g('gloss').cyl(x, 11.5, (Z0 + Z1) / 2, 20, Z1 - Z0 + 6, hex('#F4F5F6'), 16, Math.PI / 2, Math.PI / 2, 0); }
  k.metal.slab(X0 - 1, X1 + 1, 10.2, 10.6, Z0 - 3, Z1 + 3, hex('#2F6FB5'), { ao: false });
  A.quad(0, 7.6, Z0 - 0.06, 26, 2.8, 0, A.draw(26, 2.8, textPaint(['厦鼓码头', 'XIAMEN–GULANGYU FERRY'], { bg: '#F1F1EE', fg: '#2F6FB5' })));
  A.quad(0, 2.0, Z0 - 0.06, 14, 3.4, 0, A.draw(14, 3.4, (c, pw, ph) => { c.fillStyle = '#3A4A5A'; c.fillRect(0, 0, pw, ph); c.fillStyle = '#9FC1D8'; for (let i = 0; i < 6; i++) c.fillRect(pw * (0.03 + i * 0.163), ph * 0.08, pw * 0.13, ph * 0.84); }));
  // 售票 / 指示牌
  { const x = -26, z = 36; k.metal.cyl(x, 1.5, z, 0.16, 3, hex('#5C646C'), 6); P.slab(x - 2, x + 2, 2.6, 4.0, z - 0.1, z + 0.1, hex('#2F6FB5'), { ao: false }); A.quad(x, 3.3, z - 0.12, 3.8, 1.2, 0, A.draw(3.8, 1.2, textPaint(['往鼓浪屿 →', 'To Gulangyu'], { bg: '#2F6FB5', fg: '#FFFFFF' }))); }
  // 候船厅两侧到海边的栈桥 + 停靠的轮渡
  seawall(S, -160, 160, 120, [[-70, -54], [54, 70]]);
  for (const x of [-62, 62]) { P.slab(x - 6, x + 6, -0.3, 0.05, 100, 150, hex('#B8B1A4'), { ao: false }); k.colSlab(x - 7, x - 6, 0, 3, 119, 150); k.colSlab(x + 6, x + 7, 0, 3, 119, 150); k.colSlab(x - 6, x + 6, 0, 3, 150, 151);
    P.slab(x - 4, x + 4, 0, 3.4, 104, 140, hex('#E9EEF2'), { ao: false }); k.colSlab(x - 4, x + 4, 0, 3.4, 104, 140); k.glass.slab(x - 4.05, x + 4.05, 1.2, 3, 104, 140, hex('#BFE0F0')); k.g('gloss').slab(x - 5, x + 5, 3.4, 3.8, 103, 141, hex('#2F6FB5'), { ao: false }); }
  ferry(P, -45, 145, 0.08); ferry(P, 80, 160, -0.1, '#00A651');
  sea(S, 121, -900, -68); sea(S, 121, -56, 56); sea(S, 121, 68, 900);
  k.colSlab(-160, -68, 0, 3, 119, 120); k.colSlab(-56, 56, 0, 3, 119, 120); k.colSlab(68, 160, 0, 3, 119, 120);
  // 东边：邮轮码头的大邮轮（白色船身，多层甲板）
  { const x = 220, z = 200; P.box(x, 8, z, 30, 16, 220, hex('#F4F5F6'), 0.05); P.box(x, 2, z, 30.2, 4, 220.2, hex('#1E3A5A'), 0.05); for (let i = 0; i < 6; i++) P.box(x, 18 + i * 3.4, z - 10, 27 - i, 3, 160 - i * 12, hex(i % 2 ? '#E9EEF2' : '#F4F5F6'), 0.05); P.cyl(x, 42, z - 40, 8, 10, hex('#C8322A'), 10); }
  gulangyu(S, -60, 520, 1);
  for (let x = -150; x <= 150; x += 12) if (Math.abs(x) > 54) palm(P, x, 112, 7, 0.6, x * 0.2);
  for (const [x, z, c] of [[-4, 40, '#E84A5F'], [6, 44, '#3FA7D6'], [-20, 46, '#F2B233'], [24, 40, '#6CC04A'], [-62, 112, '#E86A3A'], [62, 110, '#3FA7D6']]) figure(P, x, z, c, 1.5);
  S.filler([[-80, -42, 40, 16, 30, '#D2CABE'], [10, -44, 40, 16, 26, '#C9C2B6'], [90, -42, 40, 16, 34, '#CDC5B8'], [-130, 60, 40, 40, 16, '#D8D2C6'], [130, 60, 40, 40, 20, '#CDC5B8']]);
}

/* ====================== 海沧湾公园站 2 号出口：海沧湾公园 + 海沧大桥 ====================== */
function haicangBay(S) {
  const k = S.kit, P = k.solid, A = S.atlas, GR = k.g('granite'), G = k.g('grass');
  front(S, null);
  G.slab(-160, 160, 0.004, 0.012, 2, 80, hex('#FFFFFF'), { ao: false });
  GR.slab(-160, 160, 0.005, 0.03, 80, 100, hex('#D2CCBF'), { ao: false });
  GR.slab(-3, 3, 0.005, 0.03, 0, 80, hex('#D2CCBF'), { ao: false });
  stone(S, 10, 20, 5, 1.8, '海沧湾公园', 'Haicang Bay Park', { bg: '#5E6B5A', fg: '#F2EAD0' });
  seawall(S, -160, 160, 102); k.colSlab(-160, 160, 0, 3, 101.2, 102);
  sea(S, 103);
  // 海沧大桥：悬索桥，两座门形主塔，主缆悬链线，吊索，桥面（横跨视野，东西走向）
  const BZ = 380, DY = 40, T1 = -170, T2 = 190, TH = 120, C = hex('#E3E6E8'), Cd = hex('#C9CED2'), Rd = hex('#9A9A9A');
  P.slab(-1400, 1400, DY - 2.4, DY, BZ - 9, BZ + 9, Cd, { ao: false }); P.slab(-1400, 1400, DY, DY + 0.3, BZ - 8, BZ + 8, hex('#5A5D61'), { ao: false });
  for (const s of [-1, 1]) P.slab(-1400, 1400, DY + 0.3, DY + 1.4, BZ + s * 8.6 - 0.3, BZ + s * 8.6 + 0.3, C, { ao: false });
  for (const tx of [T1, T2]) { for (const s of [-1, 1]) P.slab(tx - 3, tx + 3, -0.3, TH, BZ + s * 10 - 2.5, BZ + s * 10 + 2.5, C, { ao: false });
    for (const y of [DY - 3, 70, TH - 6]) P.slab(tx - 2.5, tx + 2.5, y, y + 4, BZ - 10, BZ + 10, C, { ao: false });
    P.slab(tx - 10, tx + 10, -0.3, 4, BZ - 16, BZ + 16, hex('#B8B1A4'), { ao: false }); }
  const cab = (x0, x1, y0, y1, sag) => { const pts = []; for (let i = 0; i <= 16; i++) { const t = i / 16; pts.push([x0 + (x1 - x0) * t, y0 + (y1 - y0) * t - sag * 4 * t * (1 - t), 0]); } return pts; };
  const spans = [[-900, T1, DY + 6, TH - 1, -30], [T1, T2, TH - 1, TH - 1, (TH - DY - 6) * 0.98], [T2, 900, TH - 1, DY + 6, -30]];
  for (const s of [-1, 1]) for (const [x0, x1, y0, y1, sag] of spans) { const pts = cab(x0, x1, y0, y1, sag).map(p => [p[0], p[1], BZ + s * 10]); P.path(pts, 1.4, Rd, 6);
    if (x0 === T1) for (let i = 1; i < 30; i++) { const t = i / 30, x = x0 + (x1 - x0) * t, y = y0 - sag * 4 * t * (1 - t); P.tube([x, DY + 1, BZ + s * 9.4], [x, y, BZ + s * 10], 0.3, Rd, 3); } }
  // 桥上的车
  for (let i = 0; i < 10; i++) { const x = -300 + i * 70 + D.rnd() * 20, z = BZ + (i % 2 ? 3 : -3); P.box(x, DY + 1.1, z, 4.6, 1.6, 2, hex(['#C8322A', '#F4F4F4', '#2F6FB5', '#F2B233', '#3A3A3A'][i % 5]), Math.PI / 2); }
  // 对岸（厦门岛）
  for (let i = 0; i < 20; i++) { const x = -600 + i * 64, h = 20 + D.rnd() * 70; P.slab(x, x + 36, 0, h, 700, 720, hex(['#D8D2C6', '#C9C2B6', '#BFC8CF', '#AEB9C2'][i % 4]), { ao: false }); }
  // 公园：大草坪、风筝、椰树、长椅、亲水步道
  for (let x = -150; x <= 150; x += 12) if (Math.abs(x) > 6) palm(P, x, 92, 7, 0.8, x * 0.2);
  for (const [x, z] of [[-60, 40], [-90, 60], [60, 36], [100, 60], [-30, 70], [40, 66]]) S.lightTree(x, z, 1.3, 1);
  for (const [x, r] of [[-20, Math.PI], [20, Math.PI], [-50, Math.PI], [50, Math.PI]]) D.bench(k, x, 0, 96, r);
  for (const [kx, ky, kz, c] of [[-30, 26, 60, '#E84A5F'], [20, 32, 70, '#F2B233'], [50, 22, 50, '#3FA7D6']]) { q2(P, [kx, ky + 1.6, kz], [kx + 1.2, ky, kz], [kx, ky - 2, kz], [kx - 1.2, ky, kz], hex(c)); P.path([[kx, ky - 2, kz], [kx + 0.4, ky - 5, kz - 0.4], [kx - 0.2, ky - 8, kz - 0.8]], 0.12, hex(c), 3); }
  for (const [x, z, c] of [[-30, 36, '#E84A5F'], [20, 46, '#F2B233'], [50, 30, '#3FA7D6'], [-4, 90, '#6CC04A'], [8, 96, '#E86A3A']]) figure(P, x, z, c, 1.3);
  S.filler([[-80, -42, 40, 16, 50, '#D2CABE'], [10, -44, 40, 16, 70, '#C9C2B6'], [90, -42, 40, 16, 60, '#CDC5B8']]);
}

const WIP_BUILD = { zhl: zhenhaiRoad, lbn: bookCity, gqi: seawallPark, yby: gardenExpo, grn: sciTech, ctg: zhonglunPark, hbz: bailuzhou, ylz: ferryPier, hcw: haicangBay };

// WIP：9 个街区还在调，暂不接入（ATTR_EXITS2 / ATTR_BUILD2 为空 → 这些站仍是普通街面）
const WIP = false;
export const ATTR_EXITS2 = WIP ? WIP_EXITS : {};
export const ATTR_BUILD2 = WIP ? WIP_BUILD : {};
