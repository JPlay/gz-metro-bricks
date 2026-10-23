/*
 * 厦门地铁 1 / 2 号线：车站出口外的景点街区（XmStreet 的分区搭法；坐标同 xmStreet.js：出口亭在原点，+x 东、+z 南，
 * 玩家从亭子里往 +z 走出来）。出口号都是真实车站的出口（见 data/xm-visits.js），步行距离压缩到一两分钟。
 *   中山公园站 3A：中山公园（1927 南门 · 醒狮球 · 湖 + 儿童岛 · 动物园）
 *   殿前站 1：殿前清水宫（红墙金瓦燕尾脊，正对机场跑道，飞机从屋顶上低低地飞过去降落）
 *   集美学村站 2：龙舟池 · 南薰楼（嘉庚建筑：西式楼身 + 中式屋顶）· 鳌园（集美解放纪念碑）
 *   湿地公园站 3：五缘湾湿地公园（黑天鹅湖 + 木栈道；旁边是三角梅造型的 6 号出入口）
 *   观音山站 4：观音山沙滩 + 沙雕公园
 * 只有外观 / 室外场地；没有地面引导条。
 */
import { Geo, hex } from '../core/geo.js';
import { bucketMat } from './kit.js';
import * as D from './decor.js';
import { textPaint, pillarText, facadePaint, FONT } from './xmStreet.js';
import { ATTR_EXITS2, ATTR_BUILD2 } from './xmAttr2.js';

export const ATTR_EXITS = {
  zsp: { n: '3A', x: 10, line: 1, road: '公园南路', to: ['中山公园'], toEn: ['Zhongshan Park'] },
  dqn: { n: '1', x: 10, line: 1, road: '殿前三路', to: ['清水宫'], toEn: ['Qingshui Temple'] },
  jmx: { n: '2', x: 10, line: 1, road: '龙舟池', to: ['集美学村', '龙舟池', '鳌园'], toEn: ['Jimei School Village', 'Dragon Boat Pond', 'Aoyuan'] },
  sdy: { n: '3', x: 10, line: 2, road: '五缘湾湿地公园', to: ['五缘湾湿地公园'], toEn: ['Wuyuan Bay Wetland Park'] },
  gys: { n: '4', x: 10, line: 2, road: '环岛东路', to: ['观音山沙滩', '沙雕公园'], toEn: ['Guanyinshan Beach', 'Sand Sculpture Park'] },
  ...ATTR_EXITS2,
};

/* ---------- 小工具 ---------- */
const TAU = Math.PI * 2;
/** 双面四边形（屋面、水面这类薄片从两边都看得见） */
export function q2(B, a, b, c, d, col) { B.quad(a, b, c, d, col); B.quad(d, c, b, a, col); }
/** 朝上的椭圆面（水面 / 草地 / 沙地） */
export function disc(B, cx, cz, rx, rz, y, col, n = 36) {
  for (let i = 0; i < n; i++) { const a0 = i / n * TAU, a1 = (i + 1) / n * TAU, c0 = [cx, y, cz], A0 = [cx + Math.cos(a0) * rx, y, cz + Math.sin(a0) * rz], A1 = [cx + Math.cos(a1) * rx, y, cz + Math.sin(a1) * rz]; B.quad(c0, A0, A1, A1, col); }
}
/** 椭圆环带（池岸 / 环路） */
export function ring(B, cx, cz, rx0, rz0, rx1, rz1, y, col, n = 40, skip = null) {
  for (let i = 0; i < n; i++) { const a0 = i / n * TAU, a1 = (i + 1) / n * TAU; if (skip && skip((a0 + a1) / 2)) continue; const p = (a, rx, rz) => [cx + Math.cos(a) * rx, y, cz + Math.sin(a) * rz]; q2(B, p(a0, rx1, rz1), p(a1, rx1, rz1), p(a1, rx0, rz0), p(a0, rx0, rz0), col); }
}
/** 沿椭圆一圈碰撞体（不让人走进水里）；skip(a) 为真处留口 */
export function ringCol(k, cx, cz, rx, rz, n = 48, skip = null) {
  for (let i = 0; i < n; i++) { const a = (i + 0.5) / n * TAU; if (skip && skip(a)) continue; const seg = TAU / n * Math.max(rx, rz) * 1.15; k.col(cx + Math.cos(a) * rx, 0.6, cz + Math.sin(a) * rz, 0.8, 1.2, seg, { ry: Math.atan2(-Math.sin(a) * rx, Math.cos(a) * rz) + Math.PI / 2 }); }
}
const angNear = (a, b, w) => { let d = Math.abs(((a - b) % TAU + TAU) % TAU); d = Math.min(d, TAU - d); return d < w; };
/**
 * 闽南 / 嘉庚式坡屋顶：檐口 (y0) 外挑 ovh，上下两折（下段缓、上段陡，近似反曲），脊沿长边；
 * swallow：脊两端燕尾（往外上翘分叉）
 */
export function roof(B, cx, cz, w, d, y0, h, col, { ovh = 0.8, swallow = true, ridgeCol = null, alongZ = false, curl = 0.5 } = {}) {
  const L = (alongZ ? d : w) / 2 + ovh, Wd = (alongZ ? w : d) / 2 + ovh;    // 半长（沿脊）/ 半宽
  const P = (u, y, v) => alongZ ? [cx + v, y, cz + u] : [cx + u, y, cz + v];
  const ry = h * 0.42, rlen = Math.max(0.6, L - Wd * 0.75), mid = 0.55;
  // 檐口 → 腰线（缓）→ 脊（陡）
  const e = [[-L, y0 + curl * 0.35, -Wd], [L, y0 + curl * 0.35, -Wd], [L, y0 + curl * 0.35, Wd], [-L, y0 + curl * 0.35, Wd]];
  const m = [[-L * 0.86, y0 + ry, -Wd * mid], [L * 0.86, y0 + ry, -Wd * mid], [L * 0.86, y0 + ry, Wd * mid], [-L * 0.86, y0 + ry, Wd * mid]];
  const r = [[-rlen, y0 + h, 0], [rlen, y0 + h, 0]];
  const pt = v => P(v[0], v[1], v[2]);
  q2(B, pt(e[0]), pt(e[1]), pt(m[1]), pt(m[0]), col); q2(B, pt(e[2]), pt(e[3]), pt(m[3]), pt(m[2]), col);
  q2(B, pt(e[1]), pt(e[2]), pt(m[2]), pt(m[1]), col); q2(B, pt(e[3]), pt(e[0]), pt(m[0]), pt(m[3]), col);
  q2(B, pt(m[0]), pt(m[1]), pt(r[1]), pt(r[0]), col); q2(B, pt(m[2]), pt(m[3]), pt(r[0]), pt(r[1]), col);
  q2(B, pt(m[1]), pt(m[2]), pt(r[1]), pt(r[1]), col); q2(B, pt(m[3]), pt(m[0]), pt(r[0]), pt(r[0]), col);
  // 檐角起翘
  for (const [su, sv] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) B.tube(P(su * L, y0 + curl * 0.35, sv * Wd), P(su * (L + 0.5), y0 + curl * 0.35 + 0.55, sv * (Wd + 0.5)), 0.22, col, 6);
  const rc = ridgeCol || col;
  B.tube(P(-rlen, y0 + h + 0.12, 0), P(rlen, y0 + h + 0.12, 0), 0.34, rc, 6);
  if (swallow) for (const s of [-1, 1]) for (const sv of [-0.18, 0.18]) B.path([P(s * rlen, y0 + h + 0.12, 0), P(s * (rlen + 0.9), y0 + h + 0.45, sv * 0.5), P(s * (rlen + 1.6), y0 + h + 1.25, sv * 1.1)], 0.22, rc, 6);
}
/** 椰子树：微弯的树干 + 一圈下垂的羽叶 */
export function palm(P, x, z, h = 7, lean = 0.6, ry = 0) {
  const tx = x + Math.sin(ry) * lean, tz = z + Math.cos(ry) * lean;
  P.path([[x, 0, z], [x + (tx - x) * 0.3, h * 0.5, z + (tz - z) * 0.3], [tx, h, tz]], 0.36, hex('#8C7354'), 6);
  for (let i = 0; i < 8; i++) { const a = i / 8 * TAU + ry, L = 2.6 + (i % 2) * 0.6;
    P.path([[tx, h + 0.1, tz], [tx + Math.cos(a) * L * 0.55, h + 0.55, tz + Math.sin(a) * L * 0.55], [tx + Math.cos(a) * L, h - 0.7, tz + Math.sin(a) * L]], 0.42, hex(i % 2 ? '#4F8A3A' : '#5E9A42'), 4); }
  P.sphere(tx, h - 0.15, tz, 0.7, hex('#6E5A2E'), 1);
}
/** 简单人形（游客 / 划船的人），h 高 */
export function figure(P, x, z, col, h = 1.6, y = 0) {
  P.cyl(x, y + h * 0.3, z, h * 0.22, h * 0.6, hex(col), 6); P.sphere(x, y + h * 0.72, z, h * 0.22, hex('#E8C29E'), 1); P.sphere(x, y + h * 0.8, z, h * 0.2, hex('#2B2420'), 1);
}
/** 动画件：独立网格（不冻结），XmStreet.tick 里每帧改位置 */
function animMesh(S, g, name, bucket = 'paint') { const m = g.toMesh(name, S.scene, bucketMat(S.scene, S.kit.M, bucket), S.kit.root); m.receiveShadows = false; (S.anim || (S.anim = [])).push(m); return m; }
/** 街口：路 + 行道树 + 路灯（出口亭在路南侧） */
function streetFront(S, road, trees = true) {
  const k = S.kit;
  S.road(-160, 160, -22, -8, true, road || null);
  if (trees) for (let x = -150; x <= 150; x += 12) if (Math.abs(x) > 6) S.lightTree(x, -6.2, 0.8);
  for (const x of [-8, 8]) D.lamp(k, x, 0, -6.6, Math.PI);
}
/** 石碑式景点名牌（两面字） */
function nameStone(S, x, z, w, h, zh, en, { bg = '#8E8A82', fg = '#F2E2B0', ry = 0 } = {}) {
  const k = S.kit, A = S.atlas, c = Math.cos(ry), s = Math.sin(ry);
  k.g('granite').box(x, h / 2, z, w, h, 0.6, hex(bg), ry); k.col(x, h / 2, z, w, h, 0.6, { ry });
  const uv = A.draw(w * 0.94, h * 0.8, textPaint(en ? [zh, en] : [zh], { bg, fg }));
  A.quad(x - s * 0.31, h * 0.5, z - c * 0.31, w * 0.94, h * 0.8, -ry, uv); A.quad(x + s * 0.31, h * 0.5, z + c * 0.31, w * 0.94, h * 0.8, Math.PI - ry, uv);   // quad 角 a 朝 (sin a, −cos a)：正面朝 (−sin ry, −cos ry) ⇒ a = −ry（之前用 ry，转过的石碑字是反的）
}

/* ====================== 中山公园站 3A 出口：中山公园 ====================== */
function zhongshanPark(S) {
  const k = S.kit, P = k.solid, A = S.atlas, G = k.g('grass'), GR = k.g('granite'), W = k.g('gloss@water');
  streetFront(S, '公园南路');
  D.bench(k, -6, 0, 3, Math.PI / 2); D.bin(k, 5, 0, 3);
  // 园区 x -90..100, z 28..196；南门（1927 年建园）开在北侧围墙正中，朝着公园南路
  const X0 = -90, X1 = 100, Z0 = 28, Z1 = 196;
  S.fence(X0, Z0, X1, Z0, [[80, 100]], 1.6, 4); S.fence(X0, Z0, X0, Z1, [], 1.6, 4); S.fence(X1, Z0, X1, Z1, [], 1.6, 4); S.fence(X0, Z1, X1, Z1, [], 1.6, 4);
  G.slab(X0 + 0.3, X1 - 0.3, 0.004, 0.012, Z0 + 0.3, Z1 - 0.3, hex('#FFFFFF'), { ao: false });
  // —— 南门：四根方石柱（中间宽、两侧窄），柱头绿琉璃小檐 + 宝珠；中间门楣“中山公园”金字 ——
  const stone = hex('#D9D4C8'), stoneD = hex('#BDB6A8'), gz = Z0;
  for (const x of [-9.5, -4, 4, 9.5]) {
    const h = Math.abs(x) < 5 ? 7.2 : 5.2;
    GR.slab(x - 0.8, x + 0.8, 0, 0.6, gz - 0.8, gz + 0.8, stoneD, { ao: false });
    GR.slab(x - 0.6, x + 0.6, 0.6, h, gz - 0.6, gz + 0.6, stone, { ao: false });
    for (let y = 1.6; y < h - 0.4; y += 1.2) GR.slab(x - 0.63, x + 0.63, y, y + 0.06, gz - 0.63, gz + 0.63, stoneD, { ao: false });   // 石缝
    k.g('gloss').slab(x - 0.95, x + 0.95, h, h + 0.3, gz - 0.95, gz + 0.95, hex('#2E7D5B'), { ao: false });
    k.g('gloss').cyl(x, h + 0.6, gz, 1.4, 0.6, hex('#2E7D5B'), 4, Math.PI / 4, 0, 0, 0.2);
    P.sphere(x, h + 1.1, gz, 0.5, hex('#D9A93F'), 1);
    k.colSlab(x - 0.8, x + 0.8, 0, h, gz - 0.8, gz + 0.8);
  }
  for (const s of [-1, 1]) { GR.slab(s * 9.5 - 0.3, s * 10.3, 0, 2.2, gz - 0.35, gz + 0.35, stone, { ao: false }); }
  GR.slab(-4.6, 4.6, 5.6, 6.8, gz - 0.5, gz + 0.5, stone, { ao: false }); GR.slab(-4.8, 4.8, 6.8, 7.05, gz - 0.6, gz + 0.6, stoneD, { ao: false });
  const plaque = (c, pw, ph) => { c.fillStyle = '#7A2A20'; c.fillRect(0, 0, pw, ph); c.strokeStyle = '#D9A93F'; c.lineWidth = ph * 0.06; c.strokeRect(ph * 0.06, ph * 0.06, pw - ph * 0.12, ph - ph * 0.12);
    c.fillStyle = '#F2D06B'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.font = `800 ${ph * 0.5}px ${FONT}`; c.fillText('中 山 公 园', pw / 2, ph * 0.44); c.font = `600 ${ph * 0.2}px ${FONT}`; c.fillText('一九二七', pw / 2, ph * 0.8); };
  const puv = A.draw(6.4, 1.1, plaque); A.quad(0, 6.2, gz - 0.52, 6.4, 1.1, 0, puv); A.quad(0, 6.2, gz + 0.52, 6.4, 1.1, Math.PI, puv);
  for (const s of [-1, 1]) A.quad(s * 9.5, 3.2, gz - 0.62, 1.0, 3.4, 0, A.draw(1.0, 3.4, pillarText(s < 0 ? '天下为公' : '博爱', '#CFC9BC', '#7A2A20')));
  // —— 中轴：花岗岩甬道 → 醒狮球（狮子踩地球，近百年的老雕塑）——
  GR.slab(-3, 3, 0.005, 0.03, Z0, 92, hex('#CFC9BC'), { ao: false });
  for (let z = Z0 + 6; z < 90; z += 8) for (const s of [-1, 1]) { D.lamp(k, s * 4, 0, z, s > 0 ? -Math.PI / 2 : Math.PI / 2); }
  const lz = 58;
  GR.cyl(0, 0.25, lz, 12, 0.5, stoneD, 24); W.cyl(0, 0.52, lz, 11, 0.04, hex('#3F8C8E'), 24); GR.cyl(0, 0.75, lz, 2.4, 0.5, stone, 16);   // 圆形水池
  ringCol(k, 0, lz, 6, 6, 16);
  GR.slab(-0.9, 0.9, 1.0, 4.6, lz - 0.9, lz + 0.9, stone, { ao: false }); GR.slab(-1.1, 1.1, 4.6, 4.9, lz - 1.1, lz + 1.1, stoneD, { ao: false });
  P.sphere(0, 6.2, lz, 2.6, hex('#5D7F86'), 2);                                    // 地球
  for (const a of [0.0, 0.5, 1.0]) P.cyl(0, 6.2 + (a - 0.5) * 1.6, lz, 2.6 * Math.sqrt(1 - Math.pow((a - 0.5) * 1.2, 2)) + 0.02, 0.05, hex('#C9B66A'), 16);   // 纬线
  const BR = hex('#6E5A3A'), BRL = hex('#8A7148');
  P.ellipsoid(0, 7.9, lz + 0.1, 1.0, 0.8, 1.9, BR, 1);                               // 狮身
  P.sphere(0, 8.5, lz - 0.95, 1.15, BRL, 1); P.sphere(0, 8.35, lz - 1.45, 0.5, BR, 1);   // 鬃毛 + 嘴
  for (const [dx, dz] of [[-0.35, -0.6], [0.35, -0.6], [-0.35, 0.8], [0.35, 0.8]]) P.cyl(dx, 7.35, lz + dz, 0.26, 0.6, BR, 6);
  P.path([[0, 8.0, lz + 1.0], [0, 8.6, lz + 1.5], [0, 8.9, lz + 1.3]], 0.14, BR, 5);
  A.quad(0, 2.8, lz - 0.93, 1.6, 0.6, 0, A.draw(1.6, 0.6, textPaint(['醒狮球'], { bg: '#BDB6A8', fg: '#5A2A1E' })));
  // —— 湖（南湖）+ 儿童岛（拱桥过去：旋转木马 / 滑梯 / 秋千）——
  const cx = 5, cz = 140, RX = 62, RZ = 40, IX = 17, IZ = 12;
  const bridgeGap = a => angNear(a, -Math.PI / 2, 0.06);
  ring(GR, cx, cz, RX, RZ, RX + 1.2, RZ + 1.2, 0.22, stoneD, 48, bridgeGap);
  ringCol(k, cx, cz, RX + 0.6, RZ + 0.6, 56, a => angNear(a, -Math.PI / 2, 0.05));
  disc(W, cx, cz, RX + 0.2, RZ + 0.2, 0.06, hex('#4F8E96'), 48);
  for (const [dx, dz, w, d] of [[-20, -10, 18, 1.6], [12, 14, 22, 1.2], [-30, 18, 12, 1.0], [30, -18, 14, 1.2]]) W.slab(cx + dx - w / 2, cx + dx + w / 2, 0.065, 0.07, cz + dz - d / 2, cz + dz + d / 2, hex('#9FCBD2'), { ao: false });
  // 岛
  disc(G, cx, cz, IX, IZ, 0.14, hex('#FFFFFF'), 32); ring(GR, cx, cz, IX, IZ, IX + 0.8, IZ + 0.8, 0.2, stoneD, 32, a => angNear(a, -Math.PI / 2, 0.12));
  ringCol(k, cx, cz, IX + 0.4, IZ + 0.4, 36, a => angNear(a, -Math.PI / 2, 0.11));
  // 拱桥（石栏杆，栏杆顶顺着拱）：从北岸 z≈99 到岛 z≈128
  const b0 = cz - RZ - 2, b1 = cz - IZ - 0.5, bw = 2.2;
  GR.slab(cx - bw, cx + bw, 0, 0.12, b0, b1, hex('#D2CCBF'), { ao: false });
  for (const s of [-1, 1]) { const x = cx + s * (bw + 0.15);
    for (let i = 0; i <= 10; i++) { const t = i / 10, z = b0 + (b1 - b0) * t, hh = 0.9 + Math.sin(t * Math.PI) * 0.9; GR.slab(x - 0.14, x + 0.14, 0, hh, z - 0.14, z + 0.14, stone, { ao: false }); }
    for (let i = 0; i < 10; i++) { const t0 = i / 10, t1 = (i + 1) / 10; GR.tube([x, 0.9 + Math.sin(t0 * Math.PI) * 0.9, b0 + (b1 - b0) * t0], [x, 0.9 + Math.sin(t1 * Math.PI) * 0.9, b0 + (b1 - b0) * t1], 0.2, stone, 6); }
    k.colSlab(x - 0.15, x + 0.15, 0, 1.5, b0, b1);
    for (let i = 0; i < 12; i++) { const t0 = i / 12, t1 = (i + 1) / 12, z0 = b0 + (b1 - b0) * t0, z1 = b0 + (b1 - b0) * t1; GR.quad([x, Math.sin(t0 * Math.PI) * 0.7, z0], [x, Math.sin(t1 * Math.PI) * 0.7, z1], [x, -0.1, z1], [x, -0.1, z0], stone); GR.quad([x, -0.1, z0], [x, -0.1, z1], [x, Math.sin(t1 * Math.PI) * 0.7, z1], [x, Math.sin(t0 * Math.PI) * 0.7, z0], stone); }
  }
  A.quad(cx, 2.3, cz - IZ - 0.6, 3.2, 0.8, 0, A.draw(3.2, 0.8, textPaint(['儿童岛', 'Children\'s Island'], { bg: '#E86A3A', fg: '#FFFFFF' })));
  k.metal.cyl(cx - 1.7, 1.15, cz - IZ - 0.6, 0.1, 2.3, hex('#5C646C'), 6); k.metal.cyl(cx + 1.7, 1.15, cz - IZ - 0.6, 0.1, 2.3, hex('#5C646C'), 6);
  // 旋转木马
  { const x = cx - 7, z = cz + 1, cols = ['#E84A5F', '#F2B233', '#3FA7D6', '#6CC04A', '#B07CD8', '#F28C38'];
    P.cyl(x, 0.35, z, 7.2, 0.4, hex('#F4E7C8'), 18); P.cyl(x, 2.2, z, 0.5, 4.0, hex('#D9A93F'), 8);
    P.cyl(x, 4.6, z, 7.8, 0.5, hex('#C8322A'), 18); P.cyl(x, 5.6, z, 7.8, 1.6, hex('#F4E7C8'), 18, 0, 0, 0, 0.5);
    for (let i = 0; i < 12; i++) { const a = i / 12 * TAU; P.sphere(x + Math.cos(a) * 3.9, 4.35, z + Math.sin(a) * 3.9, 0.36, hex(cols[i % 6]), 1); }
    for (let i = 0; i < 6; i++) { const a = i / 6 * TAU, hx = x + Math.cos(a) * 2.6, hz = z + Math.sin(a) * 2.6, hy = 1.2 + (i % 2) * 0.35, ry = a + Math.PI / 2;
      k.metal.cyl(hx, 2.5, hz, 0.06, 4.2, hex('#E8D7A0'), 6);
      P.box(hx, hy, hz, 0.4, 0.42, 1.2, hex(i % 2 ? '#FFFFFF' : '#F4D6E0'), ry);
      P.box(hx + Math.sin(ry) * 0.62, hy + 0.32, hz + Math.cos(ry) * 0.62, 0.3, 0.55, 0.32, hex(i % 2 ? '#FFFFFF' : '#F4D6E0'), ry, -0.4);
      P.box(hx, hy + 0.25, hz, 0.46, 0.1, 0.5, hex(cols[i]), ry); }
    k.col(x, 1, z, 7.2, 2, 7.2); }
  // 滑梯：台子 + 楼梯 + 黄色滑道
  { const x = cx + 7, z = cz - 3;
    for (const [dx, dz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) P.cyl(x + dx, 1.2, z + dz, 0.16, 2.4, hex('#3FA7D6'), 6);
    P.slab(x - 1.2, x + 1.2, 2.2, 2.35, z - 1.2, z + 1.2, hex('#E84A5F'), { ao: false }); P.cyl(x, 3.4, z, 3.2, 1.0, hex('#F2B233'), 4, Math.PI / 4, 0, 0, 0);
    P.box(x + 3.3, 1.2, z, 4.8, 0.12, 1.1, hex('#F2C230'), 0, 0, -0.45); for (const s of [-1, 1]) P.box(x + 3.3, 1.42, z + s * 0.55, 4.8, 0.35, 0.08, hex('#F2C230'), 0, 0, -0.45);
    for (let i = 0; i < 6; i++) P.slab(x - 1.2 - 0.3 - i * 0.32, x - 1.2 - i * 0.32, 2.1 - i * 0.36, 2.2 - i * 0.36, z - 0.5, z + 0.5, hex('#6CC04A'), { ao: false });
    k.colSlab(x - 1.3, x + 5.6, 0, 2.4, z - 1.3, z + 1.3); }
  // 秋千
  { const x = cx + 4, z = cz + 7; for (const s of [-1, 1]) { P.tube([x + s * 2.4, 0, z - 0.9], [x + s * 2.4, 2.6, z], 0.12, hex('#E84A5F'), 6); P.tube([x + s * 2.4, 0, z + 0.9], [x + s * 2.4, 2.6, z], 0.12, hex('#E84A5F'), 6); }
    P.tube([x - 2.4, 2.6, z], [x + 2.4, 2.6, z], 0.14, hex('#E84A5F'), 6);
    for (const dx of [-1.1, 1.1]) { k.metal.tube([x + dx - 0.25, 2.6, z], [x + dx - 0.25, 0.6, z], 0.03, hex('#9EA5AC'), 4); k.metal.tube([x + dx + 0.25, 2.6, z], [x + dx + 0.25, 0.6, z], 0.03, hex('#9EA5AC'), 4); P.slab(x + dx - 0.3, x + dx + 0.3, 0.55, 0.62, z - 0.15, z + 0.15, hex('#3FA7D6'), { ao: false }); }
    k.colSlab(x - 2.6, x + 2.6, 0, 2.6, z - 1, z + 1); }
  for (const [x, z] of [[cx - 13, cz - 5], [cx + 13, cz + 4], [cx - 2, cz + 9]]) S.lightTree(x, z, 0.7, 1);
  // 天鹅脚踏船
  for (const [x, z, r] of [[cx - 34, cz - 6, 0.6], [cx + 30, cz + 12, 2.2], [cx - 22, cz + 22, 3.6]]) {
    P.ellipsoid(x, 0.45, z, 1.6, 0.8, 2.6, hex('#F6F6F2'), 1, r); P.path([[x + Math.sin(r) * 0.9, 0.7, z + Math.cos(r) * 0.9], [x + Math.sin(r) * 1.2, 1.7, z + Math.cos(r) * 1.2], [x + Math.sin(r) * 1.55, 2.0, z + Math.cos(r) * 1.55]], 0.3, hex('#F6F6F2'), 6);
    P.sphere(x + Math.sin(r) * 1.75, 2.0, z + Math.cos(r) * 1.75, 0.22, hex('#E8892A'), 1); P.box(x, 1.0, z - 0, 1.2, 0.5, 1.0, hex('#4A90C8'), r); }
  // —— 动物园（东北角）：梅花鹿 · 猴山 · 孔雀 ——
  const ZX0 = 58, ZX1 = 96, ZZ0 = 38, ZZ1 = 92;
  S.fence(ZX0, ZZ0, ZX1, ZZ0, [], 1.3, 4); S.fence(ZX0, ZZ0, ZX0, ZZ1, [], 1.3, 4); S.fence(ZX0, ZZ1, ZX1, ZZ1, [], 1.3, 4); S.fence(ZX0, 65, ZX1, 65, [], 1.3, 4); S.fence(77, ZZ0, 77, 65, [], 1.3, 4);
  P.slab(ZX0 + 0.5, ZX1 - 0.5, 0.013, 0.03, ZZ0 + 0.5, ZZ1 - 0.5, hex('#B5A27E'), { ao: false });
  nameStone(S, ZX0 - 4, 50, 3.2, 1.6, '动物园', 'Zoo', { bg: '#7A5A3C', fg: '#FFF3D0', ry: Math.PI / 2 });
  // 梅花鹿
  const deer = (x, z, r, s = 1) => { const C = hex('#B9773E'), Cd = hex('#8A5530'), F = Math.sin(r), Q = Math.cos(r);
    P.ellipsoid(x, 1.05 * s, z, 0.55 * s, 0.6 * s, 1.35 * s, C, 1, r);
    for (const [a, b] of [[-0.18, -0.45], [0.18, -0.45], [-0.18, 0.45], [0.18, 0.45]]) P.cyl(x + Q * a + F * b, 0.42 * s, z - F * a + Q * b, 0.12 * s, 0.84 * s, Cd, 5);
    const nx = x + F * 0.65 * s, nz = z + Q * 0.65 * s; P.tube([nx, 1.2 * s, nz], [nx + F * 0.3 * s, 1.75 * s, nz + Q * 0.3 * s], 0.3 * s, C, 6); P.ellipsoid(nx + F * 0.45 * s, 1.85 * s, nz + Q * 0.45 * s, 0.32 * s, 0.3 * s, 0.55 * s, C, 1, r);
    for (const sd of [-1, 1]) P.path([[nx + F * 0.3 * s + Q * sd * 0.1, 2.0 * s, nz + Q * 0.3 * s - F * sd * 0.1], [nx + F * 0.2 * s + Q * sd * 0.3, 2.5 * s, nz + Q * 0.2 * s - F * sd * 0.3], [nx + F * 0.35 * s + Q * sd * 0.45, 2.8 * s, nz + Q * 0.35 * s - F * sd * 0.45]], 0.06, hex('#6B4A2A'), 4);
    for (let i = 0; i < 5; i++) P.sphere(x + Q * ((i % 2) - 0.5) * 0.4 + F * (i - 2) * 0.25, 1.3 * s, z - F * ((i % 2) - 0.5) * 0.4 + Q * (i - 2) * 0.25, 0.14, hex('#F4E6CC'), 1); };
  deer(64, 46, 1.2); deer(70, 55, -0.6, 0.85); deer(73, 44, 2.6, 0.7);
  S.lightTree(62, 60, 0.6, 1);
  // 猴山：石堆 + 攀爬架 + 猴子
  { const x = 87, z = 51; P.ellipsoid(x, 1.2, z, 12, 4.2, 10, hex('#9A8F80'), 1); P.ellipsoid(x + 2, 2.6, z - 1, 6, 4.0, 5, hex('#A79C8C'), 1);
    for (const [dx, dz] of [[-3, 2], [3, 3]]) { P.cyl(x + dx, 3.5, z + dz, 0.18, 7, hex('#7A5A3C'), 6); P.tube([x + dx, 6.5, z + dz], [x + (dx > 0 ? -3 : 3) + dx * 0.0, 6.5, z + dz], 0.14, hex('#7A5A3C'), 6); }
    const monkey = (mx, my, mz) => { const M = hex('#8C6A4A'); P.ellipsoid(mx, my + 0.35, mz, 0.42, 0.55, 0.38, M, 1); P.sphere(mx, my + 0.8, mz, 0.34, M, 1); P.sphere(mx, my + 0.78, mz - 0.13, 0.2, hex('#E3B79A'), 1); P.path([[mx, my + 0.2, mz + 0.18], [mx + 0.2, my + 0.05, mz + 0.5], [mx + 0.25, my + 0.5, mz + 0.65]], 0.07, M, 4); };
    monkey(x - 2, 3.4, z + 0.5); monkey(x + 2.5, 4.4, z - 2); monkey(x - 3, 5.9, z + 2); monkey(x + 1, 1.6, z - 4.5); }
  // 孔雀（开屏一只）
  const peacock = (x, z, r, open) => { const B1 = hex('#1F6FA8'), Gn = hex('#2E8B57');
    P.ellipsoid(x, 0.75, z, 0.45, 0.55, 0.75, B1, 1, r); P.tube([x, 0.9, z], [x + Math.sin(r) * 0.2, 1.5, z + Math.cos(r) * 0.2], 0.16, B1, 5); P.sphere(x + Math.sin(r) * 0.25, 1.55, z + Math.cos(r) * 0.25, 0.22, B1, 1);
    P.cyl(x, 0.3, z, 0.06, 0.6, hex('#8A7A5A'), 4);
    if (open) for (let i = 0; i < 13; i++) { const a = -1.2 + i / 12 * 2.4, bx = x - Math.sin(r) * 0.35, bz = z - Math.cos(r) * 0.35, tx = bx - Math.sin(r) * 0.2 + Math.cos(r) * Math.sin(a) * 1.8, tz = bz - Math.cos(r) * 0.2 - Math.sin(r) * Math.sin(a) * 1.8, ty = 0.8 + Math.cos(a) * 1.7;
      P.tube([bx, 0.8, bz], [tx, ty, tz], 0.28, Gn, 4); P.sphere(tx, ty, tz, 0.4, hex('#2B8C8C'), 1); P.sphere(tx, ty, tz, 0.18, hex('#F2B233'), 1); }
    else P.tube([x - Math.sin(r) * 0.4, 0.75, z - Math.cos(r) * 0.4], [x - Math.sin(r) * 2.2, 0.15, z - Math.cos(r) * 2.2], 0.35, Gn, 4); };
  peacock(70, 76, Math.PI, true); peacock(82, 82, 2.2, false); peacock(88, 72, -2.5, false);
  // —— 西边：红柱绿瓦亭 + 大榕树（垂着气根）——
  { const tx = -52, tz = 70; for (const [dx, dz] of [[-2, -2], [2, -2], [-2, 2], [2, 2]]) { P.cyl(tx + dx, 1.5, tz + dz, 0.3, 3, hex('#A23B2C'), 8); k.colSlab(tx + dx - 0.2, tx + dx + 0.2, 0, 3, tz + dz - 0.2, tz + dz + 0.2); }
    GR.slab(tx - 3, tx + 3, 0, 0.3, tz - 3, tz + 3, stoneD, { ao: false });
    roof(k.g('gloss'), tx, tz, 4.4, 4.4, 3.0, 2.0, hex('#2E7D5B'), { ovh: 0.9, swallow: false }); }
  const banyan = (x, z, s) => { S.lightTree(x, z, s, 0); for (let i = 0; i < 9; i++) { const a = i / 9 * TAU, r = 1.8 * s * (0.6 + (i % 3) * 0.2); P.cyl(x + Math.cos(a) * r, 1.6 * s, z + Math.sin(a) * r, 0.06, 3.2 * s, hex('#7A6650'), 4); } };
  banyan(-38, 50, 1.7); banyan(-70, 100, 1.9); banyan(30, 46, 1.5); banyan(-20, 196 - 12, 1.8);
  // 环湖路 + 林子
  ring(P, cx, cz, RX + 1.2, RZ + 1.2, RX + 4.2, RZ + 4.2, 0.02, hex('#CBBFA8'), 48);
  for (let i = 0; i < 60; i++) { const a = i / 60 * TAU + D.rnd() * 0.05, rr = 1.0 + D.rnd() * 0.25, x = cx + Math.cos(a) * (RX + 9) * rr, z = cz + Math.sin(a) * (RZ + 9) * rr;
    if (x < X0 + 2 || x > X1 - 2 || z < Z0 + 3 || z > Z1 - 2) continue; if (x > ZX0 - 3 && z < ZZ1 + 3) continue; if (Math.abs(x) < 9 && z < 100) continue; if (Math.abs(x + 52) < 6 && Math.abs(z - 70) < 6) continue;
    S.lightTree(x, z, 0.9 + D.rnd() * 0.4, i % 3 === 0 ? 1 : 0); }
  for (let x = X0 + 4; x < X1 - 2; x += 6) { if (Math.abs(x) < 13 || (x > ZX0 - 2)) continue; S.lightTree(x + D.rnd() * 1.5, Z0 + 4 + D.rnd() * 1.5, 0.85 + D.rnd() * 0.35, D.rnd() < 0.4 ? 1 : 0); }
  for (const [x, z, r] of [[-7, 40, Math.PI / 2], [7, 40, -Math.PI / 2], [-7, 80, Math.PI / 2], [7, 80, -Math.PI / 2], [cx - 30, cz - RZ - 3, 0], [cx + 30, cz - RZ - 3, 0]]) D.bench(k, x, 0, z, r);
  for (const [x, z, c] of [[-2, 34, '#E84A5F'], [2.2, 36, '#3FA7D6'], [-1.4, 70, '#F2B233'], [cx + 1, cz - 4, '#6CC04A'], [cx - 3, cz - 8, '#E86A3A']]) figure(P, x, z, c, 1.1);
  S.filler([[-60, -42, 40, 16, 22, '#D8D2C6'], [10, -44, 36, 14, 30, '#C9C2B6'], [70, -42, 40, 16, 26, '#CDC5B8'], [130, -40, 30, 14, 34, '#BFB6A8'], [-130, -40, 30, 14, 20, '#D2CABE'], [135, 120, 30, 60, 18, '#D2CABE'], [-130, 120, 30, 60, 16, '#CDC5B8']]);
}

/* ====================== 殿前站 1 号出口：清水宫 ====================== */
function dianqianTemple(S) {
  const k = S.kit, P = k.solid, A = S.atlas, GR = k.g('granite'), BK = k.g('brick'), GO = k.g('gloss@gold');
  streetFront(S, '殿前三路');
  // 小巷往南：两边闽南红砖民居
  S.road(14, 24, -8, 150, false, null);
  for (let z = 6; z < 140; z += 14) S.lightTree(26.5, z, 0.7, 1);
  const RED = hex('#B4432F'), REDd = hex('#9A3726'), GOLD = hex('#D9A93A'), GRN = hex('#2E7D5B');
  // 宫：正殿（后）+ 三川殿（前）+ 两侧护墙；坐北朝南，正门对着南边的机场跑道
  const T0 = 46, FR = 86;     // 后墙 z=46，正面（三川殿前檐）z=86
  GR.slab(-15, 15, 0, 0.5, T0 - 1, FR + 1, hex('#CFC7B8'), { ao: false }); k.colSlab(-15, 15, 0, 0.5, T0 - 1, FR - 4);
  // 正殿
  BK.slab(-11, 11, 0.5, 7.2, T0, T0 + 16, RED, { ao: false }); k.colSlab(-11, 11, 0, 7.2, T0, T0 + 16);
  roof(GO, 0, T0 + 8, 22, 16, 7.2, 5.2, GOLD, { ovh: 1.4, ridgeCol: hex('#C8322A'), curl: 0.6 });
  // 屋脊上的双龙抢珠（剪瓷雕）
  for (const s of [-1, 1]) P.path([[s * 1.2, 12.9, T0 + 8], [s * 2.6, 13.8, T0 + 8], [s * 4.2, 13.2, T0 + 8], [s * 5.6, 13.9, T0 + 8], [s * 6.6, 13.3, T0 + 8]], 0.4, hex('#2E8B57'), 6);
  P.sphere(0, 13.6, T0 + 8, 0.9, hex('#F2C230'), 1); P.cyl(0, 13.0, T0 + 8, 0.2, 0.6, hex('#C8322A'), 6);
  // 天井两侧廊
  for (const s of [-1, 1]) { BK.slab(s * 11 - (s > 0 ? 3 : 0), s * 11 + (s > 0 ? 0 : 3), 0.5, 5.2, T0 + 16, FR - 9, RED, { ao: false }); k.colSlab(Math.min(s * 11, s * 8), Math.max(s * 11, s * 8), 0, 5.2, T0 + 16, FR - 9); roof(GO, s * 9.5, (T0 + 16 + FR - 9) / 2, 3, FR - 9 - T0 - 16, 5.2, 1.6, GOLD, { ovh: 0.6, swallow: false, alongZ: true }); }
  // 三川殿（门厅）：中间高、两边低（三段屋顶，中脊最高）
  BK.slab(-11, 11, 0.5, 6.0, FR - 9, FR - 2.4, RED, { ao: false }); k.colSlab(-11, 11, 0, 6, FR - 9, FR - 2.4);
  roof(GO, 0, FR - 5.6, 9, 7.6, 6.4, 3.6, GOLD, { ovh: 1.3, ridgeCol: hex('#C8322A') });
  for (const s of [-1, 1]) roof(GO, s * 7.6, FR - 5.6, 7, 7.2, 5.6, 2.6, GOLD, { ovh: 1.0, ridgeCol: hex('#C8322A') });
  for (const s of [-1, 1]) P.path([[s * 0.8, 10.2, FR - 5.6], [s * 2.0, 10.8, FR - 5.6], [s * 3.3, 10.3, FR - 5.6]], 0.3, hex('#2E8B57'), 6);
  P.sphere(0, 10.6, FR - 5.6, 0.6, hex('#F2C230'), 1);
  // 前廊：四根石雕龙柱 + 红门（门神）+ 匾额“清水宫”
  for (const x of [-7.6, -3, 3, 7.6]) { GR.cyl(x, 3.2, FR - 1.2, 0.7, 5.4, hex('#BDB6A8'), 10); P.path([[x + 0.35, 1.0, FR - 1.2], [x, 2.2, FR - 0.85], [x - 0.35, 3.4, FR - 1.2], [x, 4.6, FR - 0.85], [x + 0.3, 5.5, FR - 1.2]], 0.24, hex('#C9B66A'), 5); k.colSlab(x - 0.4, x + 0.4, 0, 5.4, FR - 1.6, FR - 0.8); }
  const doorGod = (c, pw, ph) => { c.fillStyle = '#B3261E'; c.fillRect(0, 0, pw, ph); for (const s of [0, 1]) { const x0 = s * pw / 2;
      c.fillStyle = '#8A1D16'; c.fillRect(x0 + pw * 0.02, ph * 0.03, pw * 0.46, ph * 0.94);
      c.fillStyle = '#E2B04A'; for (let i = 0; i < 5; i++) for (let j = 0; j < 3; j++) { c.beginPath(); c.arc(x0 + pw * (0.1 + j * 0.15), ph * (0.12 + i * 0.18), pw * 0.022, 0, TAU); c.fill(); }
      c.fillStyle = '#F2D6B0'; c.beginPath(); c.arc(x0 + pw * 0.25, ph * 0.34, pw * 0.09, 0, TAU); c.fill(); c.fillStyle = '#2B6A4A'; c.fillRect(x0 + pw * 0.13, ph * 0.45, pw * 0.24, ph * 0.38); c.fillStyle = '#E2B04A'; c.fillRect(x0 + pw * 0.13, ph * 0.58, pw * 0.24, ph * 0.05); c.fillStyle = '#1B1B1B'; c.fillRect(x0 + pw * 0.16, ph * 0.22, pw * 0.18, ph * 0.06); } };
  A.quad(0, 2.4, FR - 2.37, 3.2, 3.8, Math.PI, A.draw(3.2, 3.8, doorGod)); for (const s of [-1, 1]) A.quad(s * 5.3, 2.1, FR - 2.37, 2.2, 3.2, Math.PI, A.draw(2.2, 3.2, doorGod));
  A.quad(0, 4.9, FR - 2.36, 3.4, 1.0, Math.PI, A.draw(3.4, 1.0, textPaint(['清水宫'], { bg: '#1E2A44', fg: '#F2C230', frame: '#D9A93A' })));
  for (const [x, t] of [[-3, '慈济护国'], [3, '清水祖师']]) A.quad(x, 3.2, FR - 0.82, 0.7, 3.0, Math.PI, A.draw(0.7, 3.0, pillarText(t, '#BDB6A8', '#8A1D16')));
  // 石狮 + 天公炉
  for (const s of [-1, 1]) { const x = s * 5, z = FR + 2.5; GR.slab(x - 0.7, x + 0.7, 0, 1.0, z - 0.7, z + 0.7, hex('#BDB6A8'), { ao: false }); P.ellipsoid(x, 1.6, z, 1.0, 1.2, 1.3, hex('#A8A096'), 1); P.sphere(x, 2.4, z + 0.3, 0.9, hex('#A8A096'), 1); k.colSlab(x - 0.7, x + 0.7, 0, 2.8, z - 0.7, z + 0.7); }
  { const x = 0, z = FR + 9; GR.slab(-1.4, 1.4, 0, 0.6, z - 1.4, z + 1.4, hex('#BDB6A8'), { ao: false }); P.cyl(x, 1.2, z, 2.0, 1.2, hex('#5A4A3A'), 10); k.metal.cyl(x, 2.1, z, 1.6, 0.6, hex('#6B5A3A'), 10, 0, 0, 0, 1.0); k.g('gloss@gold').cyl(x, 2.9, z, 1.4, 1.0, GOLD, 8, 0, 0, 0, 0.3); k.colSlab(-1.4, 1.4, 0, 3, z - 1.4, z + 1.4);
    for (let i = 0; i < 4; i++) P.cyl(x - 0.3 + i * 0.2, 2.6, z, 0.03, 0.8, hex('#C8322A'), 4); }
  // 宫前大埕（花岗岩）
  GR.slab(-22, 22, 0.005, 0.03, FR + 1, 140, hex('#D2CCBF'), { ao: false });
  for (const [x, z, c] of [[-8, 110, '#3FA7D6'], [-6.8, 111, '#F2B233'], [9, 118, '#E84A5F'], [10, 119.5, '#6CC04A']]) figure(P, x, z, c, 1.4);
  // 闽南红砖厝（两边）
  const house = (x, z, w, d, ry = 0) => { BK.slab(x - w / 2, x + w / 2, 0, 4.2, z - d / 2, z + d / 2, RED, { ao: false }); k.colSlab(x - w / 2, x + w / 2, 0, 4.2, z - d / 2, z + d / 2); roof(k.g('paint@tile'), x, z, w, d, 4.2, 2.2, hex('#B6513A'), { ovh: 0.5, ridgeCol: REDd }); };
  for (const [x, z] of [[-34, 40], [-34, 62], [-34, 84], [40, 36], [40, 58], [40, 80], [-56, 52], [-56, 76]]) house(x, z, 14, 12);
  // 机场围界（铁丝网 + 刺网）和跑道进近灯：宫正前方
  const FZ = 146;
  for (let x = -160; x <= 160; x += 4) { k.metal.cyl(x, 1.8, FZ, 0.12, 3.6, hex('#7C858E'), 6); k.metal.tube([x, 3.6, FZ], [x, 4.0, FZ + 0.4], 0.08, hex('#7C858E'), 4); }
  k.glass.slab(-160, 160, 0.1, 3.5, FZ - 0.02, FZ + 0.02, hex('#C9D1D6')); k.colSlab(-160, 160, 0, 4, FZ - 0.2, FZ + 0.2);
  for (const y of [1.2, 2.4, 3.5]) k.metal.slab(-160, 160, y - 0.02, y + 0.02, FZ - 0.03, FZ + 0.03, hex('#8A939B'), { ao: false });
  for (let i = 0; i < 3; i++) k.metal.tube([-160, 3.8 + i * 0.12, FZ + 0.2 + i * 0.1], [160, 3.8 + i * 0.12, FZ + 0.2 + i * 0.1], 0.05, hex('#9EA5AC'), 4);
  k.g('grass').slab(-160, 160, 0.004, 0.012, FZ + 0.3, 200, hex('#FFFFFF'), { ao: false });
  for (let z = FZ + 8; z < 200; z += 9) { k.metal.cyl(0, 1.2, z, 0.2, 2.4, hex('#D9DDE0'), 6); k.metal.slab(-6, 6, 2.3, 2.45, z - 0.1, z + 0.1, hex('#D9DDE0'), { ao: false }); for (let x = -5; x <= 5; x += 2.5) k.glow.sphere(x, 2.6, z, 0.4, hex('#FFF2C0'), 1); }
  A.quad(0, 2.2, FZ - 0.08, 4.4, 0.7, 0, A.draw(4.4, 0.7, textPaint(['机场控制区 · 禁止入内'], { bg: '#C8322A', fg: '#FFFFFF' })));
  // 跑道（围墙外，看得到）：沥青 + 入口斑马线 + 中线
  const RW = k.g('asphalt'); RW.slab(-30, 30, -0.02, 0.0, 200, 640, hex('#5A5D61'), { ao: false });
  k.g('grass').slab(-400, -30, -0.03, -0.01, 200, 640, hex('#FFFFFF'), { ao: false }); k.g('grass').slab(30, 400, -0.03, -0.01, 200, 640, hex('#FFFFFF'), { ao: false });
  for (let i = 0; i < 12; i++) { const x = -26 + i * 4.5 + (i >= 6 ? 4 : 0); P.slab(x, x + 2.2, 0.0, 0.01, 212, 242, hex('#F2F2F2'), { ao: false }); }
  for (let z = 260; z < 640; z += 30) P.slab(-0.6, 0.6, 0.0, 0.01, z, z + 16, hex('#F2F2F2'), { ao: false });
  for (let z = 204; z < 640; z += 20) for (const x of [-30, 30]) k.glow.sphere(x, 0.3, z, 0.5, hex('#FFF2C0'), 1);
  S.filler([[-120, 40, 30, 30, 12, '#D2CABE'], [110, 60, 40, 30, 16, '#CDC5B8'], [-110, 100, 30, 24, 10, '#D8D2C6'], [100, 110, 40, 24, 12, '#C9C2B6'], [-40, -42, 40, 16, 18, '#D2CABE'], [40, -42, 40, 16, 22, '#C6BEB1']]);
  // —— 飞机：厦航白机身蓝尾翼，沿下滑道从北边过来，低低掠过清水宫屋顶，落到跑道上 ——
  const g = new Geo(), W = hex('#F4F5F6'), BL = hex('#1F4FA0'), GY = hex('#B8BEC4');
  g.capsule([0, 0, -16], [0, 0, 16], 1.9, 1.9, W, 12);
  g.tubeTaper([0, 0, 16], [0, 0.6, 21], 3.8, 1.2, W, 12); g.tubeTaper([0, 0, -16], [0, 0.9, -22], 3.8, 0.8, W, 12);
  for (const s of [-1, 1]) { g.quad([s * 1.6, -0.5, 2], [s * 17, 0.6, -6], [s * 17, 0.6, -9], [s * 1.6, -0.5, -6], GY); g.quad([s * 1.6, -0.5, -6], [s * 17, 0.6, -9], [s * 17, 0.6, -6], [s * 1.6, -0.5, 2], GY);
    g.cyl(s * 6.5, -1.6, -1, 2.2, 4.4, GY, 12, 0, Math.PI / 2); g.cyl(s * 6.5, -1.6, 1.2, 1.6, 0.1, hex('#30353A'), 12, 0, Math.PI / 2);
    g.quad([s * 1, 0.6, -17], [s * 7, 1.0, -21.5], [s * 7, 1.0, -23], [s * 1, 0.6, -21], W); g.quad([s * 1, 0.6, -21], [s * 7, 1.0, -23], [s * 7, 1.0, -21.5], [s * 1, 0.6, -17], W);
    for (let i = 0; i < 10; i++) g.box(s * 1.93, 0.6, 12 - i * 2.6, 0.05, 0.4, 0.5, hex('#2A3440')); }
  g.quad([0, 1.2, -15], [0, 8.5, -22.5], [0, 8.5, -25], [0, 1.2, -22], BL); g.quad([0, 1.2, -22], [0, 8.5, -25], [0, 8.5, -22.5], [0, 1.2, -15], BL);
  g.box(0, -0.4, 0, 3.86, 0.35, 30, BL);
  for (const s of [-1, 1]) g.box(s * 1.2, 0.9, 18.2, 0.6, 0.35, 0.5, hex('#2A3440'));
  g.cyl(0, -2.4, 12, 0.3, 1.6, GY, 6); for (const s of [-1, 1]) g.cyl(s * 2.4, -2.4, -2, 0.4, 1.6, GY, 6);
  const plane = animMesh(S, g, 'xmPlane');
  const lg = new Geo(); for (const s of [-1, 1]) lg.sphere(s * 17, 0.6, -7.5, 0.5, hex(s < 0 ? '#FF4A3A' : '#4AFF6A'), 1); lg.sphere(0, -1.6, 15, 0.8, hex('#FFFFFF'), 1); lg.sphere(0, 2.2, 0, 0.5, hex('#FF3A3A'), 1);
  const lights = animMesh(S, lg, 'xmPlaneLights', 'glow'); lights.parent = plane;
  // 下滑道：飞过宫顶（z≈54）时离地 ~30 m，接地点 z≈300
  const TD = 300, slope = (30 - 2.5) / (TD - 54), V = 62, Z0s = -330, Z1s = 640, PERIOD = (Z1s - Z0s) / V + 9;
  S.plane = { t: 6.2, period: PERIOD };
  const place = () => { const t = S.plane.t % PERIOD, z = Z0s + V * t; if (z > Z1s) { plane.setEnabled(false); return; } plane.setEnabled(true);
    const y = z < TD ? 2.5 + slope * (TD - z) : 2.5, pitch = z < TD - 30 ? -slope + 0.06 : 0.02;
    plane.position.set(0, y + 2.4, z); plane.rotation.set(-pitch, 0, 0); };
  place();
  S.tick = dt => { if (!S.plane.hold) S.plane.t += dt; place(); };
}

/* ====================== 集美学村站 2 号出口：龙舟池 · 南薰楼 · 鳌园 ====================== */
function jimeiVillage(S) {
  const k = S.kit, P = k.solid, A = S.atlas, GR = k.g('granite'), W = k.g('gloss@water'), GT = k.g('gloss@tile'), BK = k.g('brick');
  streetFront(S, null);
  const GRN = hex('#2E7D5B'), ORG = hex('#C4532F'), WH = hex('#E9E4D8'), STONE = hex('#D7D1C4');
  // 龙舟池：x -120..110，z 34..112（大水面），北岸低矮白石栏杆（齐腰以下，站在岸上能看到整片水）；正中开口下到亲水平台
  const PX0 = -120, PX1 = 110, PZ0 = 34, PZ1 = 112, GAP = 9;
  GR.slab(-14, 14, 0.005, 0.03, 0, PZ0 - 1, hex('#CFC9BC'), { ao: false });
  GR.slab(PX0 - 1, PX1 + 1, 0, 0.3, PZ0 - 1.2, PZ0, STONE, { ao: false }); GR.slab(PX0 - 1, PX1 + 1, 0, 0.3, PZ1, PZ1 + 1.2, STONE, { ao: false });
  GR.slab(PX0 - 1.2, PX0, 0, 0.3, PZ0, PZ1, STONE, { ao: false }); GR.slab(PX1, PX1 + 1.2, 0, 0.3, PZ0, PZ1, STONE, { ao: false });
  W.slab(PX0, PX1, 0.0, 0.08, PZ0, PZ1, hex('#2F7F95'), { ao: false });
  // 水面波光：近处密、远处疏的浅色细条
  for (let i = 0; i < 34; i++) { const z = PZ0 + 3 + Math.pow(i / 34, 1.4) * (PZ1 - PZ0 - 6), w = 8 + D.rnd() * 26, x = PX0 + 10 + D.rnd() * (PX1 - PX0 - 20 - w);
    W.slab(x, x + w, 0.081, 0.085, z, z + 0.35 + (1 - i / 34) * 0.5, hex(i % 3 ? '#8FC6D4' : '#C9E6EC'), { ao: false }); }
  for (let x = PX0; x <= PX1; x += 3) { if (Math.abs(x) < GAP) continue; GR.slab(x - 0.14, x + 0.14, 0.3, 0.85, PZ0 - 0.75, PZ0 - 0.45, WH, { ao: false }); }
  for (let x = PX0; x <= PX1; x += 3) GR.slab(x - 0.14, x + 0.14, 0.3, 0.85, PZ1 + 0.45, PZ1 + 0.75, WH, { ao: false });
  for (const [a, b] of [[PX0, -GAP], [GAP, PX1]]) GR.slab(a, b, 0.8, 0.92, PZ0 - 0.78, PZ0 - 0.42, WH, { ao: false });
  GR.slab(PX0, PX1, 0.8, 0.92, PZ1 + 0.42, PZ1 + 0.78, WH, { ao: false });
  k.colSlab(PX0 - 1, -GAP, 0, 1.3, PZ0 - 1, PZ0 - 0.2); k.colSlab(GAP, PX1 + 1, 0, 1.3, PZ0 - 1, PZ0 - 0.2);
  k.colSlab(PX0 - 1, PX1 + 1, 0, 1.3, PZ1 + 0.2, PZ1 + 1); k.colSlab(PX0 - 1.2, PX0, 0, 1.3, PZ0, PZ1); k.colSlab(PX1, PX1 + 1.2, 0, 1.3, PZ0, PZ1);
  // 亲水平台（花岗岩，伸进池里 8 m，三面矮栏）
  const DZ1 = PZ0 + 8;
  GR.slab(-GAP + 1, GAP - 1, 0, 0.14, PZ0 - 1.2, DZ1, hex('#D2CCBF'), { ao: false });
  for (const s of [-1, 1]) { const x = s * (GAP - 1.15); for (let z = PZ0; z <= DZ1; z += 2) GR.slab(x - 0.12, x + 0.12, 0.14, 0.8, z - 0.12, z + 0.12, WH, { ao: false }); GR.slab(x - 0.16, x + 0.16, 0.75, 0.86, PZ0 - 0.4, DZ1, WH, { ao: false }); k.colSlab(x - 0.2, x + 0.2, 0, 1.3, PZ0 - 0.4, DZ1); }
  for (let x = -GAP + 1.2; x <= GAP - 1.2; x += 2) GR.slab(x - 0.12, x + 0.12, 0.14, 0.8, DZ1 - 0.3, DZ1 - 0.06, WH, { ao: false });
  GR.slab(-GAP + 1, GAP - 1, 0.75, 0.86, DZ1 - 0.34, DZ1 - 0.02, WH, { ao: false }); k.colSlab(-GAP + 1, GAP - 1, 0, 1.3, DZ1 - 0.4, DZ1);
  // 池中两座亭（红柱 + 绿琉璃燕尾脊顶）
  for (const x of [-62, 50]) { const z = 76; GR.slab(x - 3.5, x + 3.5, 0, 0.6, z - 3.5, z + 3.5, STONE, { ao: false });
    for (const [dx, dz] of [[-2.4, -2.4], [2.4, -2.4], [-2.4, 2.4], [2.4, 2.4]]) P.cyl(x + dx, 2.1, z + dz, 0.36, 3.0, hex('#A23B2C'), 8);
    roof(GT, x, z, 5.4, 5.4, 3.6, 2.4, GRN, { ovh: 1.0, ridgeCol: hex('#C4A13A') }); }
  // 龙舟（龙头龙尾 + 划手）；crew=false 是靠岸系着的那条
  const boat = (x, z, col, crew = true) => { const C = hex(col);
    P.box(x, 0.35, z, 18, 0.5, 1.4, C); P.box(x, 0.62, z, 17, 0.08, 1.5, hex('#F2D06B'));
    for (let i = 0; i < 6; i++) P.box(x - 7.5 + i * 3, 0.62, z, 1.2, 0.09, 1.52, hex('#2E7D5B'));   // 船舷鳞纹
    P.path([[x - 9, 0.5, z], [x - 9.8, 1.4, z], [x - 10.6, 1.9, z]], 0.5, C, 6); P.sphere(x - 10.8, 2.0, z, 0.8, C, 1); P.sphere(x - 11.1, 2.2, z + 0.25, 0.18, hex('#FFFFFF'), 1); P.sphere(x - 11.1, 2.2, z - 0.25, 0.18, hex('#FFFFFF'), 1);
    P.path([[x - 10.9, 2.3, z], [x - 10.4, 2.9, z], [x - 9.9, 2.6, z]], 0.12, hex('#F2D06B'), 4);   // 龙角
    P.path([[x + 9, 0.5, z], [x + 9.8, 1.2, z], [x + 10.4, 2.0, z]], 0.3, C, 5);
    if (crew) for (let i = 0; i < 8; i++) { figure(P, x - 6.5 + i * 1.8, z, i % 2 ? '#F2F2F2' : col, 1.0, 0.5); P.tube([x - 6.5 + i * 1.8, 0.9, z + 0.4], [x - 6.0 + i * 1.8, 0.1, z + 1.4], 0.06, hex('#8A6A4A'), 4); }
    else for (let i = 0; i < 8; i++) P.box(x - 6.5 + i * 1.8, 0.7, z, 0.25, 0.06, 1.3, hex('#8A6A4A'));   // 空坐板
    k.g('metal').cyl(x - 7.8, 1.1, z, 0.7, 0.5, hex('#C8322A'), 8, 0, 0, Math.PI / 2); };
  boat(-70, 60, '#E0A82E'); boat(20, 92, '#2E8B57');
  // 靠岸系着的红龙舟：贴着亲水平台东侧，两根系船桩 + 缆绳
  { const bx = GAP + 11, bz = PZ0 + 2.2; boat(bx, bz, '#C8322A', false);
    for (const dx of [-6, 6]) { GR.cyl(bx + dx, 0.55, PZ0 - 0.9, 0.42, 0.8, hex('#5C5A55'), 8); P.path([[bx + dx, 0.85, PZ0 - 0.9], [bx + dx, 0.5, PZ0 + 0.6], [bx + dx * 0.8, 0.62, bz - 0.5]], 0.07, hex('#C9B58A'), 4); } }
  // 南岸（远岸）：南薰楼（中央 15 层塔楼 + 两翼 6 层）—— 白花岗岩西式楼身、红砖腰线拱窗，顶上绿琉璃中式重檐
  const BZ = 136;
  const granFac = (fl, bays) => facadePaint({ floors: fl, bays, wall: '#E3DDD0', band: '#B5523B', glass: '#6F8DA0', frame: '#F4F2EE', grille: false, arch: true, tile: 0.05 });
  const cX = -10;
  S.facadeBlock(cX, BZ, 16, 14, 50, '#E3DDD0', granFac(15, 5), granFac(15, 4));
  roof(GT, cX, BZ, 16, 14, 50.5, 3.2, GRN, { ovh: 1.3, swallow: true, ridgeCol: hex('#C4A13A') });
  P.slab(cX - 5, cX + 5, 53.2, 56.5, BZ - 4, BZ + 4, hex('#E3DDD0'), { ao: false }); roof(GT, cX, BZ, 10, 8, 56.5, 3.6, GRN, { ovh: 1.2, swallow: true, ridgeCol: hex('#C4A13A') });
  for (const s of [-1, 1]) { const wx = cX + s * 24; S.facadeBlock(wx, BZ + 1, 32, 12, 21, '#E3DDD0', granFac(6, 10), granFac(6, 4)); roof(GT, wx, BZ + 1, 32, 12, 21.5, 3.6, ORG, { ovh: 1.0, ridgeCol: hex('#9A3726') }); }
  A.quad(cX, 23.8, BZ - 7.06, 8, 1.6, 0, A.draw(8, 1.6, textPaint(['南薰楼'], { bg: '#E3DDD0', fg: '#B5523B' })));
  // 南薰楼在水里的倒影（淡色竖条，贴水面）
  W.slab(cX - 7, cX + 7, 0.086, 0.09, PZ1 - 26, PZ1 - 1, hex('#B7D3D6'), { ao: false }); for (const s of [-1, 1]) W.slab(cX + s * 24 - 15, cX + s * 24 + 15, 0.086, 0.09, PZ1 - 10, PZ1 - 1, hex('#A6C9CF'), { ao: false });
  // 道南楼（东）：红砖长楼 + 绿瓦屋顶（中段起三座歇山）
  const brickFac = (fl, bays) => facadePaint({ floors: fl, bays, wall: '#B5523B', band: '#F1EEE8', glass: '#6F8DA0', frame: '#F4F2EE', grille: false, arch: true });
  S.facadeBlock(72, BZ + 2, 62, 13, 20, '#B5523B', brickFac(6, 22), brickFac(6, 4));
  roof(GT, 72, BZ + 2, 62, 13, 20.5, 3.4, GRN, { ovh: 1.0, ridgeCol: hex('#C4A13A') });
  for (const x of [50, 72, 94]) { P.slab(x - 5, x + 5, 20.5, 25, BZ - 2.5, BZ + 6.5, hex('#B5523B'), { ao: false }); roof(GT, x, BZ + 2, 10, 9, 25, 3.2, GRN, { ovh: 1.1, ridgeCol: hex('#C4A13A') }); }
  A.quad(72, 13, BZ - 4.56, 7, 1.3, 0, A.draw(7, 1.3, textPaint(['道南楼'], { bg: '#B5523B', fg: '#F6E7C8' })));
  // 西边：小一点的嘉庚楼（红砖 + 橙瓦）
  S.facadeBlock(-84, BZ + 4, 30, 12, 14, '#B5523B', brickFac(4, 10), brickFac(4, 4)); roof(GT, -84, BZ + 4, 30, 12, 14.5, 3.0, ORG, { ovh: 1.0, ridgeCol: hex('#9A3726') });
  // 南岸步道 + 凤凰木 / 榕树
  GR.slab(-150, 158, 0.005, 0.03, PZ1 + 1.2, PZ1 + 9, hex('#CFC9BC'), { ao: false });
  for (let x = -150; x < 150; x += 11) { if (Math.abs(x - cX) < 44) continue; S.lightTree(x, PZ1 + 6, 0.9, x % 2 ? 1 : 0); }   // 南薰楼正前方不种树，挡视线
  // 鳌园（东南角，伸进海里）：集美解放纪念碑 —— 28 m 高的白花岗岩碑：三层须弥座台基 + 方碑身（竖排金字）+ 顶上绿琉璃碑亭
  const MX = 142, MZ = 150, AX0 = 116, AX1 = 170;
  GR.slab(AX0, AX1, 0.005, 0.04, 96, 200, hex('#D2CCBF'), { ao: false });
  GR.slab(MX - 2.5, MX + 2.5, 0.04, 0.06, 104, MZ - 12, hex('#E4DFD3'), { ao: false });   // 中轴石板路
  // 鳌园牌坊（白石三间，绿瓦顶）
  { const gz = 104; for (const x of [-6, -2.2, 2.2, 6]) { GR.slab(MX + x - 0.45, MX + x + 0.45, 0, Math.abs(x) < 3 ? 6.5 : 5, gz - 0.45, gz + 0.45, WH, { ao: false }); k.colSlab(MX + x - 0.45, MX + x + 0.45, 0, 6, gz - 0.45, gz + 0.45); }
    GR.slab(MX - 2.6, MX + 2.6, 5.2, 6.5, gz - 0.4, gz + 0.4, WH, { ao: false }); roof(GT, MX, gz, 6, 1.6, 6.5, 1.2, GRN, { ovh: 0.5, swallow: true, ridgeCol: hex('#C4A13A') });
    for (const s2 of [-1, 1]) { GR.slab(MX + s2 * 4.1 - 1.6, MX + s2 * 4.1 + 1.6, 4.0, 5.0, gz - 0.35, gz + 0.35, WH, { ao: false }); roof(GT, MX + s2 * 4.1, gz, 4, 1.4, 5.0, 0.9, GRN, { ovh: 0.4, swallow: false }); }
    const uv = A.draw(4.2, 1.1, textPaint(['鳌 园'], { bg: '#E9E4D8', fg: '#2E5E4E' })); A.quad(MX, 5.85, gz - 0.42, 4.2, 1.1, 0, uv); A.quad(MX, 5.85, gz + 0.42, 4.2, 1.1, Math.PI, uv); }
  // 台基三层（每层石栏）
  for (let i = 0; i < 3; i++) { const r = 11 - i * 2.6, y0 = i * 0.7, y1 = y0 + 0.7;
    GR.slab(MX - r, MX + r, y0, y1, MZ - r, MZ + r, STONE, { ao: false });
    for (let t = -r + 0.4; t <= r - 0.4; t += 1.6) for (const [dx, dz] of [[t, -r + 0.3], [t, r - 0.3], [-r + 0.3, t], [r - 0.3, t]]) GR.slab(MX + dx - 0.12, MX + dx + 0.12, y1, y1 + 0.55, MZ + dz - 0.12, MZ + dz + 0.12, WH, { ao: false });
  }
  for (let i = 0; i < 3; i++) GR.slab(MX - 2.2, MX + 2.2, i * 0.7, (i + 1) * 0.7, MZ - 11 - 1.8 + i * 2.6, MZ - 11 + i * 2.6 + 0.01, hex('#E4DFD3'), { ao: false });   // 正面台阶
  k.colSlab(MX - 11, MX + 11, 0, 0.7, MZ - 11, MZ + 11); k.colSlab(MX - 3.6, MX + 3.6, 0, 32, MZ - 3.6, MZ + 3.6);
  // 碑座 + 碑身（略收分）+ 碑檐 + 碑亭
  GR.slab(MX - 3.6, MX + 3.6, 2.1, 6.4, MZ - 3.6, MZ + 3.6, hex('#E9E4D8'), { ao: false });
  GR.slab(MX - 3.9, MX + 3.9, 6.4, 6.9, MZ - 3.9, MZ + 3.9, STONE, { ao: false });
  GR.cyl(MX, 18.5, MZ, 3.4 * Math.SQRT2, 23.2, hex('#F4F1EA'), 4, Math.PI / 4, 0, 0, 2.8 * Math.SQRT2);
  GR.slab(MX - 2.2, MX + 2.2, 30.1, 30.7, MZ - 2.2, MZ + 2.2, STONE, { ao: false });
  for (let y = 9; y < 30; y += 3.5) GR.slab(MX - 1.75 + (y - 7) * 0.006, MX + 1.75 - (y - 7) * 0.006, y, y + 0.08, MZ - 1.76, MZ + 1.76, hex('#DCD6C9'), { ao: false });
  roof(GT, MX, MZ, 4.6, 4.6, 30.7, 2.6, GRN, { ovh: 0.9, swallow: false }); P.sphere(MX, 33.7, MZ, 0.8, hex('#D9A93F'), 1);
  const mon = (c, pw, ph) => { c.fillStyle = '#F4F1EA'; c.fillRect(0, 0, pw, ph); c.fillStyle = '#C49A2E'; c.textAlign = 'center'; c.textBaseline = 'middle'; const t = [...'集美解放纪念碑'], sz = Math.min(pw * 0.8, ph / t.length * 0.92); c.font = `800 ${sz}px ${FONT}`; t.forEach((ch, i) => c.fillText(ch, pw / 2, ph / 2 + (i - (t.length - 1) / 2) * sz * 1.05)); };
  A.quad(MX, 18, MZ - 1.72, 2.4, 18, 0, A.draw(2.4, 18, mon));
  // 碑座四面浮雕（石色浅深两块）
  const relief = (c, pw, ph) => { c.fillStyle = '#D8D1C3'; c.fillRect(0, 0, pw, ph); c.fillStyle = '#A99F8C'; for (let i = 0; i < 7; i++) { const x = pw * (0.08 + i * 0.13); c.beginPath(); c.arc(x, ph * 0.32, ph * 0.1, 0, TAU); c.fill(); c.fillRect(x - ph * 0.08, ph * 0.42, ph * 0.16, ph * 0.38); } c.strokeStyle = '#B9B0A0'; c.lineWidth = ph * 0.05; c.strokeRect(0, 0, pw, ph); };
  const ruv = A.draw(6.2, 3.2, relief); A.quad(MX, 4.25, MZ - 3.62, 6.2, 3.2, 0, ruv); A.quad(MX - 3.62, 4.25, MZ, 6.2, 3.2, -Math.PI / 2, ruv); A.quad(MX + 3.62, 4.25, MZ, 6.2, 3.2, Math.PI / 2, ruv);
  // 石狮一对（台阶两侧）
  for (const s2 of [-1, 1]) { const x = MX + s2 * 4, z = MZ - 14.5; GR.slab(x - 0.8, x + 0.8, 0, 1.0, z - 1.0, z + 1.0, STONE, { ao: false });
    P.ellipsoid(x, 1.6, z + 0.2, 1.0, 1.1, 1.5, hex('#C8C1B2'), 1); P.sphere(x, 2.5, z - 0.4, 1.0, hex('#BDB6A8'), 1); P.sphere(x, 2.35, z - 0.85, 0.45, hex('#C8C1B2'), 1); k.colSlab(x - 0.8, x + 0.8, 0, 3, z - 1, z + 1); }
  // 碑前两侧石雕长廊
  for (const s of [-1, 1]) { const x = MX + s * 18; GR.slab(x - 1.6, x + 1.6, 0, 0.3, MZ - 14, MZ + 14, STONE, { ao: false }); for (let z = MZ - 13; z <= MZ + 13; z += 3.25) { GR.slab(x - 0.25, x + 0.25, 0.3, 3.2, z - 0.25, z + 0.25, hex('#BDB6A8'), { ao: false }); k.colSlab(x - 0.25, x + 0.25, 0, 3.2, z - 0.25, z + 0.25); }
    GR.slab(x - s * 1.4 - 0.15, x - s * 1.4 + 0.15, 0.3, 2.6, MZ - 13, MZ + 13, hex('#D8D1C3'), { ao: false });
    roof(GT, x, MZ, 3.6, 29, 3.2, 1.4, GRN, { ovh: 0.5, swallow: false, alongZ: true }); }
  // 碑后：陈嘉庚先生墓（龟背形墓顶 + 半圆墓围）
  { const tz = MZ + 24; GR.slab(MX - 7, MX + 7, 0, 0.4, tz - 5, tz + 5, STONE, { ao: false }); P.ellipsoid(MX, 0.6, tz, 5.6, 1.8, 4.4, hex('#CFC9BC'), 2);
    ring(GR, MX, tz + 1, 7.5, 6, 8.1, 6.6, 1.3, hex('#BDB6A8'), 24, a => Math.sin(a) < -0.2); k.colSlab(MX - 7, MX + 7, 0, 1.5, tz - 5, tz + 5); }
  // 松柏（让广场不空）
  for (const [x, z] of [[AX0 + 4, 112], [AX0 + 4, 128], [AX0 + 4, 172], [AX1 - 4, 112], [AX1 - 4, 128], [AX1 - 4, 172], [MX - 10, 186], [MX + 10, 186]]) { P.cyl(x, 1.2, z, 0.3, 2.4, hex('#6A5340'), 5); P.cyl(x, 4.2, z, 3.0, 5.2, hex('#2F6B3A'), 7, 0, 0, 0, 0.4); P.cyl(x, 6.6, z, 1.8, 2.8, hex('#3A7A44'), 7, 0, 0, 0, 0.1); }
  nameStone(S, AX0 + 2, 100, 4, 1.8, '鳌园', 'Aoyuan', { bg: '#8E8A82', fg: '#F2E2B0' });
  // 海（东边围墙外）+ 远处的厦门大桥
  W.slab(170, 900, -0.05, 0.0, -300, 900, hex('#3F8A92'), { ao: false }); W.slab(-900, 170, -0.05, 0.0, 200, 900, hex('#3F8A92'), { ao: false });
  for (let x = 200; x < 900; x += 40) P.cyl(x, 8, -120, 3, 16, hex('#C9C9C4'), 8);
  P.slab(170, 900, 15, 17, -122, -118, hex('#D9D6CE'), { ao: false });
  for (const [x, z, c] of [[-4, 24, '#E84A5F'], [5, 26, '#3FA7D6'], [-30, 86, '#F2B233'], [MX - 3, MZ - 20, '#6CC04A'], [MX + 2, MZ - 19, '#E86A3A']]) figure(P, x, z, c, 1.4);
  S.filler([[-80, -42, 40, 16, 20, '#D2CABE'], [-20, -44, 40, 16, 26, '#C9C2B6'], [50, -42, 40, 16, 18, '#CDC5B8'], [-140, 170, 30, 40, 16, '#C6BEB1']]);
}

/* ====================== 湿地公园站 3 号出口：五缘湾湿地公园 ====================== */
function wetlandPark(S) {
  const k = S.kit, P = k.solid, A = S.atlas, G = k.g('grass'), W = k.g('gloss@water'), WD = k.g('paint@wood');
  streetFront(S, null);
  const MAG = hex('#D63384'), MAGd = hex('#B0246A');
  // —— 6 号出入口：三角梅造型（三片洋红苞片做顶棚，中间白色小花）——
  { const x = -34, z = 2;
    P.slab(x - 2.6, x + 2.6, 0, 0.06, z - 3, z + 2, hex('#B9B5AD'), { ao: false });
    k.glass.slab(x - 2.2, x + 2.2, 0.06, 2.8, z - 2.6, z - 2.5, hex('#D6EEF8')); for (const s of [-1, 1]) k.glass.slab(x + s * 2.2 - 0.03, x + s * 2.2 + 0.03, 0.06, 2.8, z - 2.6, z + 1.2, hex('#D6EEF8'));
    k.colSlab(x - 2.3, x + 2.3, 0, 3, z - 2.7, z - 2.4); for (const s of [-1, 1]) k.colSlab(x + s * 2.2 - 0.1, x + s * 2.2 + 0.1, 0, 3, z - 2.6, z + 1.2);
    // 一朵花：中间绿色花茎（钢管）托着花心；5 片洋红苞片从花心向外、向上翘起（像碗口张开），每片底下一根斜撑落地
    const fx = x, fz = z - 0.7, FY = 3.9, STEM = hex('#3F7D3A');
    k.metal.cyl(fx, FY / 2, fz, 0.42, FY, STEM, 10); k.colSlab(fx - 0.25, fx + 0.25, 0, FY, fz - 0.25, fz + 0.25);
    P.cyl(fx, FY + 0.15, fz, 2.2, 0.5, STEM, 10, 0, 0, 0, 1.2);                              // 花托（绿萼）
    for (let i = 0; i < 5; i++) { const a = i / 5 * TAU + Math.PI / 2 + Math.PI / 5, ux = Math.cos(a), uz = Math.sin(a), ry = Math.atan2(ux, uz), L = 5.4, tilt = 0.62;
      const r = 0.7 + Math.cos(tilt) * L / 2, cxp = fx + ux * r, czp = fz + uz * r, cyp = FY + 0.35 + Math.sin(tilt) * L / 2;
      P.ellipsoid(cxp, cyp, czp, 3.4, 0.28, L, i % 2 ? MAG : MAGd, 2, ry, -tilt, 0);                // 苞片：外端翘起
      P.path([[fx + ux * 0.6, FY + 0.45, fz + uz * 0.6], [cxp, cyp + 0.12, czp], [fx + ux * (0.7 + Math.cos(tilt) * L * 0.95), FY + 0.4 + Math.sin(tilt) * L * 0.95, fz + uz * (0.7 + Math.cos(tilt) * L * 0.95)]], 0.07, hex('#8C1E57'), 4);   // 叶脉
      const sx = fx + ux * 3.8, sz = fz + uz * 3.8; k.metal.tube([sx, 0, sz], [fx + ux * 2.2, FY + 0.2 + Math.sin(tilt) * 1.6, fz + uz * 2.2], 0.16, STEM, 6);   // 斜撑
      k.colSlab(sx - 0.15, sx + 0.15, 0, 1.5, sz - 0.15, sz + 0.15); }
    for (let i = 0; i < 3; i++) { const a = i / 3 * TAU; P.sphere(fx + Math.cos(a) * 0.42, FY + 0.75, fz + Math.sin(a) * 0.42, 0.55, hex('#FFF7E0'), 1); P.tube([fx + Math.cos(a) * 0.42, FY + 0.9, fz + Math.sin(a) * 0.42], [fx + Math.cos(a) * 0.5, FY + 1.35, fz + Math.sin(a) * 0.5], 0.06, hex('#F2C230'), 3); }   // 花心三朵小白花
    const s6 = (c, pw, ph) => { c.fillStyle = '#20272E'; c.fillRect(0, 0, pw, ph); c.fillStyle = '#F2C230'; c.fillRect(0, 0, ph, ph); c.fillStyle = '#20272E'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.font = `800 ${ph * 0.66}px Arial`; c.fillText('6', ph / 2, ph * 0.54); c.fillStyle = '#FFF'; c.textAlign = 'left'; c.font = `800 ${ph * 0.42}px ${FONT}`; c.fillText('6号出口', ph * 1.25, ph * 0.52); };
    A.quad(x, 2.95, z + 1.25, 2.6, 0.6, Math.PI, A.draw(2.6, 0.6, s6)); k.metal.slab(x - 1.35, x + 1.35, 2.6, 3.3, z + 1.18, z + 1.22, hex('#20272E'), { ao: false }); }
  // 三角梅花丛（沿入口）
  const bush = (x, z, s = 1) => { P.ellipsoid(x, 0.7 * s, z, 2.2 * s, 1.4 * s, 2.0 * s, hex('#3F7D3A'), 1); for (let i = 0; i < 6; i++) P.sphere(x + (D.rnd() - 0.5) * 1.8 * s, (0.9 + D.rnd() * 0.6) * s, z + (D.rnd() - 0.5) * 1.6 * s, 0.7 * s, i % 3 ? MAG : hex('#E85AA0'), 1); };
  for (let x = -60; x <= 60; x += 7) if (Math.abs(x) > 8) bush(x, 8, 1);
  nameStone(S, 8, 30, 5, 1.8, '五缘湾湿地公园', 'Wuyuan Bay Wetland Park', { bg: '#5E6B5A', fg: '#F2EAD0' });
  // 湖：中心 (10,122)，北岸 z≈66
  const cx = 10, cz = 122, RX = 92, RZ = 56, IX = 15, IZ = 11, icx = 22, icz = 146;
  G.slab(-150, 155, 0.004, 0.012, 20, 196, hex('#FFFFFF'), { ao: false });
  disc(W, cx, cz, RX + 1, RZ + 1, 0.05, hex('#3E7F7A'), 56);
  for (const [dx, dz, w, d] of [[-40, -20, 30, 1.4], [30, 10, 40, 1.2], [-20, 30, 26, 1.0], [50, -30, 18, 1.0]]) W.slab(cx + dx - w / 2, cx + dx + w / 2, 0.055, 0.06, cz + dz - d / 2, cz + dz + d / 2, hex('#93C4C0'), { ao: false });
  ring(P, cx, cz, RX, RZ, RX + 2.5, RZ + 2.5, 0.06, hex('#8E8A6A'), 56);
  // 木栈道：折线（带斜接的左右两条栏杆线），从北岸到湖中小岛的观鸟亭
  const BW = [[10, 52], [10, 74], [30, 90], [12, 106], [32, 120], [22, icz - IZ + 1]], HW = 1.6;
  const off = sgn => BW.map((p, i) => { const a = BW[Math.max(0, i - 1)], b = BW[Math.min(BW.length - 1, i + 1)]; let tx = b[0] - a[0], tz = b[1] - a[1]; const l = Math.hypot(tx, tz); tx /= l; tz /= l;
    let mx = -tz, mz = tx; if (i > 0 && i < BW.length - 1) { const t0 = [p[0] - a[0], p[1] - a[1]], l0 = Math.hypot(...t0), n0 = [-t0[1] / l0, t0[0] / l0]; const k1 = 1 / Math.max(0.3, mx * n0[0] + mz * n0[1]); mx *= k1; mz *= k1; }
    return [p[0] + sgn * mx * HW, p[1] + sgn * mz * HW]; });
  const L = off(1), R = off(-1);
  for (let i = 0; i < BW.length - 1; i++) {
    WD.quad([L[i][0], 0.16, L[i][1]], [L[i + 1][0], 0.16, L[i + 1][1]], [R[i + 1][0], 0.16, R[i + 1][1]], [R[i][0], 0.16, R[i][1]], hex('#9A7652')); WD.quad([R[i][0], 0.16, R[i][1]], [R[i + 1][0], 0.16, R[i + 1][1]], [L[i + 1][0], 0.16, L[i + 1][1]], [L[i][0], 0.16, L[i][1]], hex('#9A7652'));
    const [ax, az] = BW[i], [bx, bz] = BW[i + 1], len = Math.hypot(bx - ax, bz - az);
    for (let t = 0.7; t < len; t += 1.4) { const x = ax + (bx - ax) * t / len, z = az + (bz - az) * t / len, ry = Math.atan2(bx - ax, bz - az); WD.box(x, 0.17, z, HW * 2, 0.02, 0.06, hex('#7A5A3C'), ry); }
    for (const S2 of [L, R]) { const [x0, z0] = S2[i], [x1, z1] = S2[i + 1], l = Math.hypot(x1 - x0, z1 - z0), ry = Math.atan2(x1 - x0, z1 - z0);
      WD.box((x0 + x1) / 2, 1.05, (z0 + z1) / 2, 0.12, 0.1, l, hex('#7A5A3C'), ry); WD.box((x0 + x1) / 2, 0.6, (z0 + z1) / 2, 0.06, 0.06, l, hex('#7A5A3C'), ry);
      for (let t = 0; t <= l; t += 2) WD.cyl(x0 + (x1 - x0) * t / l, 0.45, z0 + (z1 - z0) * t / l, 0.14, 1.2, hex('#6A4A30'), 5);
      if (i > 0 || true) k.col((x0 + x1) / 2, 0.7, (z0 + z1) / 2, 0.2, 1.4, l + 0.3, { ry }); }
  }
  ringCol(k, cx, cz, RX + 0.5, RZ + 0.5, 72, a => angNear(a, -Math.PI / 2, 0.025));
  // 小岛 + 观鸟亭（木构茅草顶）
  disc(G, icx, icz, IX, IZ, 0.12, hex('#FFFFFF'), 28); ringCol(k, icx, icz, IX + 0.3, IZ + 0.3, 32, a => angNear(a, -Math.PI / 2 - 0.0, 0.14));
  { const x = icx, z = icz + 1; for (const [dx, dz] of [[-2.2, -2.2], [2.2, -2.2], [-2.2, 2.2], [2.2, 2.2]]) { WD.cyl(x + dx, 1.5, z + dz, 0.3, 3, hex('#6A4A30'), 6); k.colSlab(x + dx - 0.2, x + dx + 0.2, 0, 3, z + dz - 0.2, z + dz + 0.2); }
    WD.slab(x - 3, x + 3, 0.12, 0.3, z - 3, z + 3, hex('#9A7652'), { ao: false }); roof(k.g('paint@thatch'), x, z, 4.6, 4.6, 3.0, 2.4, hex('#B59A62'), { ovh: 0.8, swallow: false, curl: 0 });
    A.quad(x, 2.6, z - 2.3, 2.2, 0.5, 0, A.draw(2.2, 0.5, textPaint(['观鸟亭', 'Bird Hide'], { bg: '#6A4A30', fg: '#F6E7C8' }))); }
  // 红树林 / 芦苇
  const mangrove = (x, z, s = 1) => { for (let i = 0; i < 5; i++) { const a = i / 5 * TAU; P.tube([x + Math.cos(a) * 0.9 * s, 0.05, z + Math.sin(a) * 0.9 * s], [x, 1.1 * s, z], 0.1, hex('#6A5A44'), 4); } P.ellipsoid(x, 2.0 * s, z, 3.2 * s, 1.8 * s, 3.0 * s, hex('#3D6E3A'), 1); };
  for (let i = 0; i < 26; i++) { const a = D.rnd() * TAU, r = 0.82 + D.rnd() * 0.12, x = cx + Math.cos(a) * RX * r, z = cz + Math.sin(a) * RZ * r; if (Math.abs(x - 20) < 18 && z < cz + 10 && z > 50) continue; mangrove(x, z, 0.8 + D.rnd() * 0.5); }
  for (let i = 0; i < 8; i++) { const a = i / 8 * TAU + 0.3; mangrove(icx + Math.cos(a) * IX * 0.7, icz + Math.sin(a) * IZ * 0.7 + 2, 0.7); }
  const reeds = (x, z) => { for (let i = 0; i < 9; i++) { const dx = (D.rnd() - 0.5) * 1.6, dz = (D.rnd() - 0.5) * 1.6, h = 1.4 + D.rnd() * 0.8; P.tube([x + dx, 0, z + dz], [x + dx * 1.2, h, z + dz * 1.2], 0.05, hex('#9EAA6A'), 3); P.ellipsoid(x + dx * 1.2, h + 0.15, z + dz * 1.2, 0.14, 0.5, 0.14, hex('#C9B58A'), 1); } };
  for (let i = 0; i < 26; i++) { const a = i / 26 * TAU, x = cx + Math.cos(a) * (RX - 2), z = cz + Math.sin(a) * (RZ - 2); if (Math.abs(x - 10) < 6 && z < cz) continue; reeds(x, z); }
  // 黑天鹅（黑身红嘴，S 形长脖子）
  const swan = (x, z, r, s = 1) => { const BL = hex('#1D1F22'), F = Math.sin(r), Q = Math.cos(r);
    P.ellipsoid(x, 0.32 * s, z, 0.9 * s, 0.6 * s, 1.6 * s, BL, 1, r); P.ellipsoid(x - F * 0.5 * s, 0.6 * s, z - Q * 0.5 * s, 0.8 * s, 0.5 * s, 0.9 * s, hex('#2A2C30'), 1, r);
    P.path([[x + F * 0.6 * s, 0.45 * s, z + Q * 0.6 * s], [x + F * 0.95 * s, 1.0 * s, z + Q * 0.95 * s], [x + F * 0.7 * s, 1.55 * s, z + Q * 0.7 * s], [x + F * 0.85 * s, 1.85 * s, z + Q * 0.85 * s]], 0.2 * s, BL, 5);
    P.sphere(x + F * 0.95 * s, 1.9 * s, z + Q * 0.95 * s, 0.28 * s, BL, 1); P.tubeTaper([x + F * 1.05 * s, 1.88 * s, z + Q * 1.05 * s], [x + F * 1.4 * s, 1.8 * s, z + Q * 1.4 * s], 0.16 * s, 0.07 * s, hex('#D9343A'), 5); };
  for (const [x, z, r, s] of [[-12, 92, 0.8, 1.1], [-8, 96, 1.4, 1], [-40, 110, -0.5, 1.2], [56, 104, 2.4, 1], [60, 112, 3.0, 0.9], [-30, 140, 0.2, 1], [46, 150, -2.2, 1.1], [-58, 126, 1.0, 0.8], [2, 84, 0.3, 1]]) swan(x, z, r, s);
  // 白鹭（站在岸边 / 木桩上）
  const egret = (x, z, y = 0) => { const Wh = hex('#FBFBF8'); P.ellipsoid(x, y + 0.9, z, 0.34, 0.4, 0.7, Wh, 1, 0.4, 0.4); P.path([[x, y + 1.05, z + 0.25], [x, y + 1.45, z + 0.3], [x, y + 1.6, z + 0.42]], 0.09, Wh, 4); P.tubeTaper([x, y + 1.62, z + 0.5], [x, y + 1.6, z + 0.8], 0.06, 0.02, hex('#E0B43A'), 4); for (const s of [-0.08, 0.08]) P.tube([x + s, y, z], [x + s, y + 0.7, z], 0.03, hex('#2A2A2A'), 3); };
  for (const [x, z] of [[-70, 96], [70, 92], [-20, 172], [62, 160]]) egret(x, z);
  for (const [x, z] of [[-4, 100], [42, 126], [-26, 120]]) { WD.cyl(x, 0.5, z, 0.3, 1.0, hex('#6A4A30'), 5); egret(x, z, 1.0); }
  // 岸边步道 + 长椅 + 树
  for (let x = -130; x < 150; x += 12) S.lightTree(x, 28 + (x % 24 ? 2 : -2), 0.8, x % 3 ? 1 : 0);
  for (const [x, z, r] of [[-20, 58, 0], [40, 58, 0], [-60, 70, 0.6]]) D.bench(k, x, 0, z, r);
  for (const [x, z, c] of [[12, 70, '#E84A5F'], [8, 66, '#3FA7D6'], [28, 96, '#F2B233']]) figure(P, x, z, c, 1.2, 0.16);
  S.filler([[-80, -42, 40, 16, 60, '#C9CED2'], [-10, -46, 30, 16, 80, '#B9C3CB'], [60, -42, 40, 16, 50, '#CDD2D6'], [130, -40, 30, 14, 70, '#BFC8CF']]);
}

/* ====================== 观音山站 4 号出口：观音山沙滩 + 沙雕公园 ====================== */
function guanyinBeach(S) {
  const k = S.kit, P = k.solid, A = S.atlas, W = k.g('gloss@water'), SA = k.g('paint@sand'), GR = k.g('granite');
  streetFront(S, '环岛东路', false);
  const SAND = hex('#E8D2A2'), SANDd = hex('#D9BE88'), SC = hex('#D8BD8A');
  // 滨海步道 + 椰子树
  GR.slab(-160, 160, 0.005, 0.03, -6, 26, hex('#CFC9BC'), { ao: false });
  for (let x = -150; x <= 150; x += 10) if (Math.abs(x) > 6) palm(P, x, -5 + (x % 20 ? 0 : 1), 6.5 + (x % 30 === 0 ? 1.5 : 0), 0.8, x * 0.1);
  for (let x = -150; x <= 150; x += 14) if (Math.abs(x) > 8) palm(P, x + 5, 22, 7.5, 1.2, x * 0.3 + 1);
  nameStone(S, 0, 24, 5.4, 2.0, '观音山沙滩', 'Guanyinshan Beach', { bg: '#7A8C9A', fg: '#FFFFFF' });
  // 沙滩 z 27..88（湿沙带 80..88），海 z ≥ 86：近岸三道白浪（浪头稍微隆起，站在沙滩上平视也看得见）
  const SH = 88;
  SA.slab(-160, 160, 0.0, 0.05, 27, SH + 2, SAND, { ao: false });
  SA.slab(-160, 160, 0.05, 0.055, SH - 8, SH + 1, hex('#C9AE7C'), { ao: false });   // 湿沙
  for (let i = 0; i < 46; i++) { const x = -150 + D.rnd() * 300, z = 32 + D.rnd() * (SH - 46); SA.ellipsoid(x, 0.03, z, 2 + D.rnd() * 4, 0.12, 1 + D.rnd() * 2, SANDd, 1); }
  const SEA = k.g('paint@sea');   // 哑光：低机位掠射时 gloss 水面会把天空反成一片白
  SEA.slab(-900, 900, 0.0, 0.07, SH - 2, 900, hex('#2A7FB0'), { ao: false });
  SEA.slab(-900, 900, 0.07, 0.085, SH - 2, SH + 12, hex('#4DB3CC'), { ao: false });   // 近岸浅水（浅一点的蓝绿）
  // 岸边泡沫：沿水线一条连续的白沫（前后错开一点）；白沫和浪尖用哑光材质，避免水面高光把整片海照成白的
  const FO = k.g('paint@foam'), FW = hex('#F6F9FA'), FP = hex('#BFE3EC');
  for (let i = 0; i < 32; i++) { const x0 = -160 + i * 10, z = SH - 1.6 + Math.sin(i * 1.3) * 0.6; FO.slab(x0 - 0.5, x0 + 10.5, 0.1, 0.13, z, z + 0.9 + D.rnd() * 0.6, FW, { ao: false }); }
  // 三道碎浪：连续的白色浪尖（略高出水面）+ 前面一窄条淡蓝白碎沫；越远越窄
  for (const [wz, hh, dd] of [[SH + 7, 0.3, 0.9], [SH + 17, 0.24, 0.7], [SH + 30, 0.18, 0.55]]) {
    const segN = 20, L = 400 / segN;
    for (let i = 0; i < segN; i++) { const x0 = -200 + i * L, z = wz + Math.sin(i * 0.8 + wz) * 1.0;
      FO.box(x0 + L / 2, 0.08 + hh / 2, z, L + 0.6, hh, dd, FW, 0, 0, 0, 1, { ao: false });
      FO.slab(x0 - 0.3, x0 + L + 0.3, 0.1, 0.11, z - dd / 2 - 1.0, z - dd / 2, FP, { ao: false }); } }
  for (let i = 0; i < 18; i++) { const x0 = -200 + i * 24 + D.rnd() * 6, z = SH + 44 + D.rnd() * 60; FO.slab(x0, x0 + 10, 0.1, 0.11, z, z + 0.5, FP, { ao: false }); }
  k.colSlab(-160, 160, 0, 3, SH + 3, SH + 4);   // 只能走到浅水边
  // 远处的小岛（大担 / 二担方向）
  P.ellipsoid(-180, 0, 620, 160, 50, 60, hex('#6E8A86'), 1); P.ellipsoid(220, 0, 700, 120, 36, 50, hex('#7A9490'), 1);
  // 太阳伞 + 躺椅 + 救生塔 + 排球网
  const umb = (x, z, c1, c2) => { k.metal.cyl(x, 1.3, z, 0.08, 2.6, hex('#E6E6E6'), 5); for (let i = 0; i < 8; i++) { const a0 = i / 8 * TAU, a1 = (i + 1) / 8 * TAU; q2(P, [x, 2.9, z], [x + Math.cos(a0) * 1.8, 2.3, z + Math.sin(a0) * 1.8], [x + Math.cos(a1) * 1.8, 2.3, z + Math.sin(a1) * 1.8], [x + Math.cos(a1) * 1.8, 2.3, z + Math.sin(a1) * 1.8], hex(i % 2 ? c1 : c2)); }
    for (const s of [-1, 1]) { P.box(x + s * 1.1, 0.35, z + 1.2, 0.7, 0.08, 1.8, hex('#F2F2F2'), 0, -0.2); P.box(x + s * 1.1, 0.55, z + 0.4, 0.7, 0.6, 0.08, hex('#F2F2F2'), 0, -0.6); } };
  for (const [x, z, a, b] of [[10, 50, '#E84A5F', '#FFFFFF'], [26, 58, '#3FA7D6', '#FFFFFF'], [44, 46, '#F2B233', '#E84A5F'], [62, 62, '#6CC04A', '#FFFFFF'], [-8, 64, '#B07CD8', '#FFFFFF'], [80, 50, '#E84A5F', '#F2B233'], [98, 64, '#3FA7D6', '#F2B233'], [118, 52, '#E84A5F', '#FFFFFF']]) umb(x, z, a, b);
  { const x = 72, z = 76; for (const [dx, dz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) P.tube([x + dx * 1.2, 0, z + dz * 1.2], [x + dx * 0.8, 3.2, z + dz * 0.8], 0.16, hex('#F4F4F4'), 5);
    P.slab(x - 1.2, x + 1.2, 3.2, 3.35, z - 1.2, z + 1.2, hex('#F4F4F4'), { ao: false }); P.slab(x - 1.0, x + 1.0, 3.35, 4.4, z - 1.0, z + 1.0, hex('#E84A3A'), { ao: false }); P.cyl(x, 4.8, z, 2.4, 0.8, hex('#F4F4F4'), 4, Math.PI / 4, 0, 0, 0.2);
    P.path([[x - 0.9, 0, z - 2.6], [x - 0.9, 3.2, z - 1.2]], 0.08, hex('#F4F4F4'), 4); P.path([[x + 0.9, 0, z - 2.6], [x + 0.9, 3.2, z - 1.2]], 0.08, hex('#F4F4F4'), 4); k.colSlab(x - 1.3, x + 1.3, 0, 4.4, z - 1.3, z + 1.3); }
  { const x = 30, z = 70; for (const s of [-1, 1]) k.metal.cyl(x + s * 5, 1.2, z, 0.12, 2.4, hex('#E6E6E6'), 5); k.glass.slab(x - 5, x + 5, 1.5, 2.4, z - 0.02, z + 0.02, hex('#DDE4E8')); P.sphere(x + 2, 0.15, z + 3, 0.3, hex('#F2B233'), 1); }
  for (const [x, z, c] of [[16, 54, '#E84A5F'], [20, 42, '#3FA7D6'], [40, 84, '#F2B233'], [54, 86, '#6CC04A'], [90, 85, '#E86A3A'], [-20, 82, '#3FA7D6']]) figure(P, x, z, c, 1.3, 0.05);
  // —— 沙雕公园（西边，围起来的一片）：城堡 · 海龟 · 海豚 · 大象 · 鼓浪屿钢琴 ——
  const X0 = -150, X1 = -46, Z0 = 32, Z1 = 80;
  for (const [a, b, c, d, gaps] of [[X0, Z0, X1, Z0, [[44, 58]]], [X0, Z0, X0, Z1, []], [X1, Z0, X1, Z1, []], [X0, Z1, X1, Z1, []]]) {
    const len = Math.hypot(c - a, d - b), n = Math.ceil(len / 2), ry = Math.atan2(c - a, d - b);
    for (let i = 0; i <= n; i++) { const t = i / n * len; if (gaps.some(([g0, g1]) => t > g0 && t < g1)) continue; P.cyl(a + (c - a) * t / len, 0.6, b + (d - b) * t / len, 0.18, 1.2, hex('#8A6A4A'), 5); }
    const segs = gaps.length ? [[0, gaps[0][0]], [gaps[0][1], len]] : [[0, len]];
    for (const [s0, s1] of segs) { const m = (s0 + s1) / 2, x = a + (c - a) * m / len, z = b + (d - b) * m / len; for (const y of [0.5, 1.0]) P.box(x, y, z, 0.08, 0.1, s1 - s0, hex('#9A7652'), ry); k.col(x, 0.7, z, 0.3, 1.4, s1 - s0, { ry }); }
  }
  // 入口牌坊（木）
  { const gx = X0 + 51, gz = Z0; for (const s of [-1, 1]) { P.cyl(gx + s * 6, 2.4, gz, 0.5, 4.8, hex('#8A6A4A'), 8); k.colSlab(gx + s * 6 - 0.3, gx + s * 6 + 0.3, 0, 4.8, gz - 0.3, gz + 0.3); }
    P.slab(gx - 7, gx + 7, 4.4, 5.6, gz - 0.3, gz + 0.3, hex('#E8D2A2'), { ao: false });
    const sp = (c, pw, ph) => { c.fillStyle = '#E8D2A2'; c.fillRect(0, 0, pw, ph); c.fillStyle = '#C8553D'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.font = `800 ${ph * 0.58}px ${FONT}`; c.fillText('沙 雕 公 园', pw / 2, ph * 0.42); c.font = `600 ${ph * 0.22}px Arial`; c.fillText('SAND SCULPTURE PARK', pw / 2, ph * 0.82); };
    const uv = A.draw(13.6, 1.1, sp); A.quad(gx, 5.0, gz - 0.32, 13.6, 1.1, 0, uv); A.quad(gx, 5.0, gz + 0.32, 13.6, 1.1, Math.PI, uv); }
  // 城堡
  { const x = -100, z = 62; SA.slab(x - 12, x + 12, 0, 1.2, z - 9, z + 9, SC, { ao: false }); SA.slab(x - 8, x + 8, 1.2, 7, z - 6, z + 6, SC, { ao: false });
    for (const [dx, dz, h, d] of [[-8, -6, 10, 3.4], [8, -6, 10, 3.4], [-8, 6, 9, 3], [8, 6, 9, 3], [0, 0, 15, 4.6]]) { SA.cyl(x + dx, h / 2, z + dz, d, h, SC, 12); SA.cyl(x + dx, h + 1.4, z + dz, d * 1.15, 2.8, SANDd, 12, 0, 0, 0, 0); }
    for (let i = -3; i <= 3; i++) SA.slab(x + i * 2.2 - 0.6, x + i * 2.2 + 0.6, 7, 7.8, z - 6.2, z - 5.8, SC, { ao: false });
    SA.slab(x - 1.4, x + 1.4, 1.2, 4.4, z - 6.05, z - 5.95, hex('#B79C6A'), { ao: false }); k.colSlab(x - 12, x + 12, 0, 8, z - 9, z + 9); }
  // 海龟
  { const x = -128, z = 46; SA.ellipsoid(x, 0.9, z, 9, 3.4, 11, SC, 2); for (const [dx, dz] of [[-4.5, -4], [4.5, -4], [-4, 4.5], [4, 4.5]]) SA.ellipsoid(x + dx, 0.3, z + dz, 3.4, 0.6, 2.2, SC, 1, Math.atan2(dx, dz));
    SA.ellipsoid(x, 1.0, z - 6.4, 2.6, 2.0, 3.2, SC, 1); for (let i = 0; i < 6; i++) { const a = i / 6 * TAU; SA.ellipsoid(x + Math.cos(a) * 2.6, 2.2, z + Math.sin(a) * 3.2, 2.4, 0.6, 2.6, SANDd, 1); } SA.ellipsoid(x, 2.6, z, 2.6, 0.8, 3, SANDd, 1); k.col(x, 1, z, 9, 2, 12); }
  // 海豚（跃出浪花）
  { const x = -68, z = 46; SA.ellipsoid(x, 0.6, z, 10, 1.6, 6, SANDd, 1);
    for (const [dx, ry, h] of [[-2, 0.4, 5.5], [3, -0.3, 6.5]]) { const pts = []; for (let i = 0; i <= 6; i++) { const t = i / 6, a = t * Math.PI; pts.push([x + dx + Math.cos(a) * 3.2 * Math.cos(ry), 0.8 + Math.sin(a) * h, z + Math.cos(a) * 3.2 * Math.sin(ry)]); } SA.path(pts, 1.5, SC, 8); SA.sphere(pts[0][0], pts[0][1], pts[0][2], 1.4, SC, 1); }
    k.col(x, 1, z, 10, 2, 6); }
  // 大象
  { const x = -128, z = 70; SA.ellipsoid(x, 3.4, z, 7, 5, 9, SC, 2); SA.sphere(x, 5.0, z - 5.2, 4.2, SC, 1); for (const s of [-1, 1]) SA.ellipsoid(x + s * 2.3, 5.2, z - 4.6, 0.8, 3.6, 3.0, SANDd, 1);
    SA.path([[x, 4.2, z - 7], [x, 2.4, z - 7.8], [x, 0.8, z - 7.2]], 1.0, SC, 6); for (const [dx, dz] of [[-2, -2.6], [2, -2.6], [-2, 2.6], [2, 2.6]]) SA.cyl(x + dx, 1.2, z + dz, 1.9, 2.4, SC, 8); k.col(x, 2, z, 7, 4, 12); }
  // 钢琴（鼓浪屿“琴岛”）
  { const x = -64, z = 70; SA.slab(x - 6, x + 6, 0, 3.0, z - 3, z + 3, SC, { ao: false }); SA.box(x, 3.6, z + 1.6, 12, 4, 0.8, SC, 0, -0.35);
    for (let i = 0; i < 18; i++) P.slab(x - 5.6 + i * 0.62, x - 5.6 + i * 0.62 + 0.5, 3.0, 3.12, z - 3.0, z - 1.6, hex(i % 7 === 2 || i % 7 === 6 ? '#B79C6A' : '#F2E6C8'), { ao: false }); k.colSlab(x - 6, x + 6, 0, 4, z - 3, z + 3); }
  for (const [x, z, c] of [[-96, 40, '#E84A5F'], [-84, 42, '#F2B233'], [-80, 74, '#3FA7D6']]) figure(P, x, z, c, 1.1, 0.05);
  // 小朋友堆的小沙堡
  for (const [x, z] of [[2, 44], [36, 76], [-14, 72]]) { SA.cyl(x, 0.3, z, 1.2, 0.6, SC, 8); SA.cyl(x, 0.8, z, 0.6, 0.6, SC, 8, 0, 0, 0, 0); P.box(x + 1.2, 0.2, z, 0.5, 0.4, 0.5, hex('#E84A5F')); }
  // 观音山商务区（路北）
  S.filler([[-110, -44, 30, 18, 90, '#AEB9C2'], [-60, -46, 26, 20, 120, '#9FB0BD'], [-10, -44, 30, 18, 80, '#B9C3CB'], [44, -46, 28, 20, 110, '#A9B6C0'], [100, -44, 30, 18, 70, '#C2CBD2'], [146, -44, 20, 18, 96, '#B0BCC5']]);
}

export const ATTR_BUILD = { zsp: zhongshanPark, dqn: dianqianTemple, jmx: jimeiVillage, sdy: wetlandPark, gys: guanyinBeach, ...ATTR_BUILD2 };
