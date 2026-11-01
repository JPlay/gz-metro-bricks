/*
 * 福州地铁景点街区（第二批，1 / 4 号线）。坐标约定同 xmAttr.js：出口亭在原点，玩家出亭往 +z 走；亭子后面（z -22..-8）是马路。
 *   东街口 C  → 三坊七巷：南后街北口（“三坊七巷”石牌坊）→ 南后街，两边白墙黛瓦、一道道起伏的马鞍墙（封火墙）、木板店面、红灯笼
 *   南门兜 G1 → 于山 / 白塔：五一广场 → 于山（满山榕树）脚下的白塔（七层八角、白墙灰檐）+ 定光寺屋顶
 *   达道 C   → 上下杭：老街 → 星安河 + 三通桥（石桥）→ 两岸白墙黑瓦的老厝和砖砌的老商行
 *   西门 B   → 西湖公园：牌楼式大门 → 湖边观景平台（亭子）→ 西湖、湖心小岛、湖边大榕树
 * 外观依据 /workspace/fuzhou-research/brief.md（白塔外观、马鞍墙细节在 brief 里标了“未核实”——按常见照片做示意，不追求测绘级）。
 * FZ_ATTR_GOAL：每个景点的“到达点”（街区局部坐标），fz_attr.py / fz_ride.py 走到这里算到达；从出亭点 (0, 1.2) 到这里一路没有碰撞体。
 * 面数：每个街区 ≤ 9 万三角形、≤ 50 draw（fz_attr.py 量）。
 */
import { hex } from '../core/geo.js';
import * as D from './decor.js';
import { textPaint, facadePaint, FONT } from './xmStreet.js';
import { q2, roof, figure } from './xmAttr.js';
import { lowPerson } from './xmSM.js';

const TAU = Math.PI * 2, NO = { ao: false };
function front(S, road) {
  S.road(-160, 160, -22, -8, true, road || null);
  for (let x = -150; x <= 150; x += 12) if (Math.abs(x) > 6) S.lightTree(x, -6.2, 0.8);
  for (const x of [-8, 8]) D.lamp(S.kit, x, 0, -6.6, Math.PI);
}
function stone(S, x, z, w, h, zh, en, { bg = '#8E8A82', fg = '#F2E2B0', ry = 0 } = {}) {
  const k = S.kit, A = S.atlas, c = Math.cos(ry), s = Math.sin(ry);
  k.g('granite').box(x, h / 2, z, w, h, 0.6, hex(bg), ry); k.col(x, h / 2, z, w, h, 0.6, { ry });
  const uv = A.draw(w * 0.94, h * 0.8, textPaint(en ? [zh, en] : [zh], { bg, fg }));
  A.quad(x - s * 0.31, h * 0.5, z - c * 0.31, w * 0.94, h * 0.8, -ry, uv); A.quad(x + s * 0.31, h * 0.5, z + c * 0.31, w * 0.94, h * 0.8, Math.PI - ry, uv);
}
/** 榕树（福州 = 榕城）：粗矮树干 + 几根分枝 + 又宽又扁的树冠 + 垂下来的气根 */
export function banyan(P, x, z, s = 1, kind = 0, y0 = 0) {
  if (y0) { const T = { cyl: (a, b, c, ...r) => P.cyl(a, b + y0, c, ...r), tube: (a, b, ...r) => P.tube([a[0], a[1] + y0, a[2]], [b[0], b[1] + y0, b[2]], ...r), ellipsoid: (a, b, c, ...r) => P.ellipsoid(a, b + y0, c, ...r) }; return banyan(T, x, z, s, kind, 0); }
  const trunk = hex('#6B5A48'), G = ['#2F6B34', '#3A7A3C', '#2A5F30', '#447F3A'];
  P.cyl(x, 1.6 * s, z, 1.3 * s, 3.2 * s, trunk, 7);
  for (let i = 0; i < 4; i++) { const a = i / 4 * TAU + kind; P.tube([x, 2.8 * s, z], [x + Math.cos(a) * 3.2 * s, 5.2 * s, z + Math.sin(a) * 3.2 * s], 0.5 * s, trunk, 5); }
  P.ellipsoid(x, 6.2 * s, z, 11 * s, 3.6 * s, 10 * s, hex(G[kind % 4]), 1);
  for (let i = 0; i < 4; i++) { const a = i / 4 * TAU + 0.8 + kind; P.ellipsoid(x + Math.cos(a) * 3.6 * s, 6.8 * s + (i % 2) * 0.6 * s, z + Math.sin(a) * 3.4 * s, 6.4 * s, 3 * s, 6 * s, hex(G[(i + 1 + kind) % 4]), 1); }
  for (let i = 0; i < 6; i++) { const a = i / 6 * TAU + 0.3, r = (2.4 + (i % 3)) * s; P.tube([x + Math.cos(a) * r, 4.8 * s, z + Math.sin(a) * r], [x + Math.cos(a) * r, 0.4 * s + (i % 2) * 1.4 * s, z + Math.sin(a) * r], 0.12 * s, hex('#7A6A56'), 3); }
}
/** 马鞍墙（封火墙）：白墙，顶上一道黑瓦压顶，轮廓两头高、中间一个小起拱 —— 墙沿 x（a=0）或 z 方向，从 (x0,z0) 长 L */
function saddleWall(S, x0, z0, L, h0, amp, alongZ, n = 14) {
  const k = S.kit, W = k.g('paint@wall'), T = k.solid, white = hex('#F3F1EA'), cap = hex('#2E3238');
  const yAt = u => h0 + amp * (0.55 * (Math.cos(u * TAU) * 0.5 + 0.5) ** 1.4 + 0.45 * Math.exp(-(((u - 0.5) / 0.12) ** 2)));
  const P = (d, y, off = 0) => alongZ ? [x0 + off, y, z0 + d] : [x0 + d, y, z0 + off];
  const top = [];
  for (let i = 0; i <= n; i++) { const u = i / n; top.push(P(u * L, yAt(u))); }
  for (let i = 0; i < n; i++) { const a = i / n * L, b = (i + 1) / n * L, ya = yAt(i / n), yb = yAt((i + 1) / n);
    for (const off of [-0.25, 0.25]) q2(W, P(a, 0, off), P(b, 0, off), P(b, yb, off), P(a, ya, off), white); }
  T.path(top.map(p => [p[0], p[1] + 0.12, p[2]]), 0.62, cap, 4);
  if (alongZ) k.colSlab(x0 - 0.3, x0 + 0.3, 0, h0, z0, z0 + L); else k.colSlab(x0, x0 + L, 0, h0, z0 - 0.3, z0 + 0.3);
}

/* ============== 东街口 C 口：三坊七巷（南后街北口） ============== */
function sanfang(S) {
  const k = S.kit, P = k.solid, A = S.atlas, GR = k.g('granite');
  front(S, '杨桥东路');
  // 口部小广场 + 南后街石板路（x -7..7，往 +z）
  GR.slab(-24, 24, 0.005, 0.03, 2, 20, hex('#C9C3B6'), NO);
  GR.slab(-7, 7, 0.005, 0.03, 20, 190, hex('#A9A397'), NO);
  for (let z = 22; z < 188; z += 3) GR.slab(-6.6, 6.6, 0.031, 0.035, z, z + 0.12, hex('#8E887C'), NO);
  // 石牌坊（四柱三间，中间写“三坊七巷”，背面“南后街”）
  { const z = 22, gy = 8.4;
    for (const x of [-7.4, -3.2, 3.2, 7.4]) { GR.slab(x - 0.45, x + 0.45, 0, x * x > 20 ? 6.2 : gy, z - 0.45, z + 0.45, hex('#B9B2A4'), NO); GR.slab(x - 0.8, x + 0.8, 0, 0.6, z - 0.8, z + 0.8, hex('#A39C8E'), NO); k.colSlab(x - 0.5, x + 0.5, 0, 8, z - 0.5, z + 0.5); }
    GR.slab(-3.6, 3.6, gy - 1.9, gy - 0.3, z - 0.35, z + 0.35, hex('#B9B2A4'), NO);
    for (const [a, b] of [[-7.8, -2.8], [2.8, 7.8]]) GR.slab(a, b, 5.0, 6.0, z - 0.35, z + 0.35, hex('#B9B2A4'), NO);
    roof(P, 0, z, 8.2, 1.4, gy, 1.5, hex('#3A3F45'), { ovh: 0.5, curl: 0.4 }); roof(P, -5.3, z, 5, 1.2, 6.1, 1.1, hex('#3A3F45'), { ovh: 0.4, curl: 0.3 }); roof(P, 5.3, z, 5, 1.2, 6.1, 1.1, hex('#3A3F45'), { ovh: 0.4, curl: 0.3 });
    const uvF = A.draw(6.4, 1.5, textPaint(['三坊七巷'], { bg: '#2E3238', fg: '#E9C46A' }), 60), uvB = A.draw(6.4, 1.5, textPaint(['南后街'], { bg: '#2E3238', fg: '#E9C46A' }), 60);
    A.quad(0, gy - 1.1, z - 0.37, 6.4, 1.5, 0, uvF); A.quad(0, gy - 1.1, z + 0.37, 6.4, 1.5, Math.PI, uvB); }
  stone(S, 12, 12, 5.6, 1.6, '三坊七巷', 'Three Lanes and Seven Alleys', { bg: '#7E786C' });
  // 南后街两边：一户一户的老宅，临街木板店面 + 黛瓦披檐；户与户之间是高出屋面的马鞍墙
  const SHOP = ['鱼丸', '肉燕', '漆器', '油纸伞', '茉莉花茶', '寿山石', '软木画', '光饼', '书坊', '锅边'];
  const uvC = {};
  let i = 0;
  for (let z = 26; z < 182; z += 13, i++) for (const side of [-1, 1]) {
    const xf = side * 7, xb = side * 22, z0 = z, z1 = z + 13, zc = (z0 + z1) / 2, ry = side < 0 ? Math.PI / 2 : -Math.PI / 2;
    // 白墙院落体块（低）+ 临街两层木构店面
    P.slab(Math.min(xf, xb), Math.max(xf, xb), 0, 6.2, z0 + 0.3, z1 - 0.3, hex('#F1EEE6'), NO); k.colSlab(Math.min(xf, xb), Math.max(xf, xb), 0, 6.2, z0, z1);
    roof(P, side * 14.5, zc, 15, 12.4, 6.2, 2.6, hex('#3A3F45'), { ovh: 0.3, swallow: false, curl: 0.2, alongZ: true });
    const key = 'f' + (i + side + 9) % 3;
    A.quad(xf - side * 0.03, 2.9, zc, 12, 5.6, ry, uvC[key] || (uvC[key] = A.draw(12, 5.6, (c, pw, ph) => {
      c.fillStyle = '#5A3A26'; c.fillRect(0, 0, pw, ph); const n = 6;
      for (let j = 0; j < n; j++) { const x = pw * j / n; c.fillStyle = j % 3 === 1 ? '#3A2618' : '#7A5236'; c.fillRect(x + pw * 0.012, ph * 0.52, pw / n - pw * 0.024, ph * 0.46);
        c.fillStyle = '#E8D9B0'; c.fillRect(x + pw * 0.03, ph * 0.08, pw / n - pw * 0.06, ph * 0.34); c.strokeStyle = '#4A2E1C'; c.lineWidth = 3;
        for (let g = 1; g < 4; g++) { c.beginPath(); c.moveTo(x + pw * 0.03 + (pw / n - pw * 0.06) * g / 4, ph * 0.08); c.lineTo(x + pw * 0.03 + (pw / n - pw * 0.06) * g / 4, ph * 0.42); c.stroke(); } }
      c.fillStyle = '#3A2618'; c.fillRect(0, ph * 0.45, pw, ph * 0.05);
    }, 34)));
    // 一层披檐（黛瓦，伸到街面上）
    P.box(xf - side * 0.9, 3.35, zc, 2.0, 0.18, 12.8, hex('#3A3F45'), 0, 0, side * 0.32, 1, NO);
    const shop = SHOP[(i * 2 + (side > 0 ? 1 : 0)) % SHOP.length];
    A.quad(xf - side * 0.06, 4.1, zc, 4, 0.7, ry, uvC['s' + shop] || (uvC['s' + shop] = A.draw(4, 0.7, textPaint([shop], { bg: '#2E1F14', fg: '#E9C46A' }), 60)));
    for (const dz of [-4, 4]) { P.ellipsoid(xf - side * 1.5, 2.85, zc + dz, 0.55, 0.62, 0.55, hex('#D7262E'), 1); }
    // 户与户之间：马鞍墙（垂直街面，高出屋顶）
    saddleWall(S, side < 0 ? xb : xf - side * 0.3, z0, Math.abs(xb - xf) + 0.3, 6.2, 3.4 + (i % 3) * 0.8, false, 12);
  }
  // 远处一道横跨的马鞍墙“天际线”（视线尽头）
  saddleWall(S, -26, 186, 52, 6.5, 4.5, false, 16);
  // 游客
  [[-3, 30, 0], [2.5, 36, Math.PI], [-1, 48, 0.2], [3.5, 58, Math.PI], [-4, 70, 0], [1, 84, Math.PI], [-2.5, 100, 0], [4, 116, Math.PI], [-15, 10, 1], [16, 6, -1]].forEach(([x, z, r], j) => lowPerson(P, x, 0, z, r, j * 5 + 2, j === 3));
  S.filler([[-60, 40, 40, 30, 22, '#D2CABE'], [60, 40, 40, 30, 26, '#C9C2B6'], [-60, 110, 40, 60, 9, '#E9E5DC'], [60, 110, 40, 60, 9, '#E9E5DC'], [-110, -40, 40, 14, 30, '#CFC7BA'], [110, -40, 40, 14, 24, '#D8D0C3']]);
}

/* ============== 南门兜 G1 口：于山风景区（白塔）· 五一广场 ============== */
function pagoda(S, x, z, levels = 7) {
  const k = S.kit, P = k.solid, W = k.g('paint@wall'), white = hex('#F4F2EC'), eave = hex('#59606A');
  P.cyl(x, 0.6, z, 14, 1.2, hex('#B9B2A4'), 8, Math.PI / 8); k.colSlab(x - 6.5, x + 6.5, 0, 1.2, z - 6.5, z + 6.5);
  let y = 1.2;
  for (let i = 0; i < levels; i++) {
    const d = 10.4 - i * 0.75, h = i === 0 ? 6 : 4.4;
    W.cyl(x, y + h / 2, z, d, h, white, 8, Math.PI / 8);
    // 拱门 / 小窗：四正面
    for (let j = 0; j < 4; j++) { const a = j * Math.PI / 2, r = d / 2 * Math.cos(Math.PI / 8) + 0.02; P.box(x + Math.sin(a) * r, y + h * 0.42, z - Math.cos(a) * r, i === 0 ? 1.8 : 0.9, i === 0 ? 3 : 1.5, 0.12, hex('#3B3027'), a); }
    // 灰色腰檐（八角，往外挑）
    P.cyl(x, y + h + 0.25, z, d + 2.6, 0.5, eave, 8, Math.PI / 8, 0, 0, d + 0.4);
    y += h + 0.5;
  }
  P.cyl(x, y + 1.0, z, 3.4, 2.0, eave, 8, Math.PI / 8, 0, 0, 0.6);
  k.metal.cyl(x, y + 3.6, z, 0.4, 5, hex('#C9A23A'), 6); k.metal.sphere(x, y + 2.4, z, 1.0, hex('#C9A23A'), 1); k.metal.sphere(x, y + 4.2, z, 0.8, hex('#C9A23A'), 1);
  k.colSlab(x - 4.6, x + 4.6, 0, y, z - 4.6, z + 4.6);
  return y;
}
function yushan(S) {
  const k = S.kit, P = k.solid, A = S.atlas, GR = k.g('granite');
  front(S, '八一七北路');
  // 五一广场：大片花岗岩铺地 + 两块草坪 + 旗杆
  GR.slab(-60, 60, 0.005, 0.03, 2, 64, hex('#CFC9BC'), NO);
  for (let x = -58; x < 60; x += 6) GR.slab(x, x + 0.12, 0.031, 0.035, 2, 64, hex('#B7B1A4'), NO);
  for (const sx of [-1, 1]) { P.slab(sx * 22, sx * 52, 0.03, 0.18, 14, 46, hex('#6FA34A'), NO); k.colSlab(Math.min(sx * 22, sx * 52), Math.max(sx * 22, sx * 52), 0, 0.5, 14, 46); D.hedge(k, Math.min(sx * 22, sx * 52), Math.max(sx * 22, sx * 52), 13.4, 14.2, 0, 0.7); }
  k.metal.cyl(36, 9, 30, 0.3, 18, hex('#C9CED3'), 6); P.box(37.4, 16.6, 30, 2.6, 1.7, 0.05, hex('#DE2910'), 0, 0, 0, 1, NO);
  // 于山：几个大土丘叠成小山，满山榕树
  const HILLS = [[10, 120, 150, 30, 70, '#4F7F3A'], [-30, 140, 110, 44, 70, '#46753A'], [40, 150, 120, 36, 60, '#4A7A3C'], [0, 175, 160, 52, 60, '#3F6E35']];
  for (const [x, z, sx, sy, sz, c] of HILLS) P.ellipsoid(x, 0, z, sx, sy, sz, hex(c), 2);
  const hillY = (x, z) => Math.max(0, ...HILLS.map(([hx, hz, sx, sy, sz]) => { const q = ((x - hx) / (sx / 2)) ** 2 + ((z - hz) / (sz / 2)) ** 2; return q < 1 ? sy / 2 * Math.sqrt(1 - q) : 0; }));
  k.colSlab(-80, 80, 0, 8, 86, 87);
  for (const [x, z, s, i] of [[-48, 112, 1.2, 0], [-20, 104, 1.1, 1], [8, 100, 1.3, 2], [36, 112, 1.1, 3], [58, 128, 1.2, 0], [-6, 130, 1.0, 1], [24, 136, 1.1, 2], [-38, 140, 1.0, 3], [10, 160, 1.2, 1], [-60, 150, 1.1, 2]]) banyan(P, x, z, s, i, Math.max(0, hillY(x, z) - 2));
  // 白塔：在于山西麓（左前方），塔前一小块平台
  const TX = -22, TZ = 76;
  GR.slab(TX - 12, TX + 12, 0.03, 0.06, 64, 88, hex('#BDB6A8'), NO);
  pagoda(S, TX, TZ);
  stone(S, TX + 9.5, 62, 4.6, 1.5, '白塔', 'White Pagoda', { bg: '#7E786C' });
  // 定光寺（白塔寺）屋顶：塔东边一座红墙殿
  { const cx = 4, cz = 78; P.slab(cx - 9, cx + 9, 0, 5, cz - 5, cz + 5, hex('#B5523B'), NO); k.colSlab(cx - 9, cx + 9, 0, 5, cz - 5, cz + 5); roof(P, cx, cz, 18, 10, 5, 3.4, hex('#3A3F45'), { ovh: 1.0, curl: 0.6 });
    A.quad(cx, 3.6, cz - 5.03, 5, 1.1, 0, A.draw(5, 1.1, textPaint(['定光寺'], { bg: '#2E1F14', fg: '#E9C46A' }), 60)); }
  // 山门石碑 + 上山台阶入口
  stone(S, 26, 66, 5.2, 1.7, '于山风景区', 'Yushan Hill', { bg: '#7E786C' });
  for (const [x, z, r, j] of [[-8, 40, 0.5, 1], [6, 30, -2.5, 2], [-14, 20, 1.3, 3], [14, 50, 2.9, 4], [-30, 58, 0.2, 5], [0, 58, 3.1, 6]]) lowPerson(P, x, 0, z, r, j * 4 + 1, j === 2);
  S.filler([[-120, 30, 40, 40, 30, '#CFC7BA'], [120, 30, 40, 40, 26, '#D8D0C3'], [-100, -40, 40, 14, 34, '#C9C2B6'], [100, -40, 40, 14, 28, '#D2CABE']]);
}

/* ============== 达道 C 口：上下杭（星安河 + 三通桥） ============== */
function shangxiahang(S) {
  const k = S.kit, P = k.solid, A = S.atlas, GR = k.g('granite'), WA = k.g('paint@sea');
  front(S, '达道路');
  // 石板老街（x -6..6，往 +z 到河边）
  GR.slab(-6, 6, 0.005, 0.03, 2, 40, hex('#ABA497'), NO);
  for (let z = 4; z < 40; z += 2.4) GR.slab(-5.6, 5.6, 0.031, 0.035, z, z + 0.1, hex('#8E887C'), NO);
  stone(S, 9, 8, 4.6, 1.5, '上下杭', 'Shangxiahang', { bg: '#7E786C' });
  // 街两边：老商行（红砖 + 拱窗）和白墙黑瓦老厝交替
  const brick = facadePaint({ floors: 2, bays: 4, wall: '#A8533C', band: '#E9DCC6', glass: '#4F5F6A', frame: '#E9DCC6', grille: false, arch: true });
  const uvB = A.draw(12, 7.4, brick, 30), uvW = A.draw(12, 6, facadePaint({ floors: 2, bays: 3, wall: '#EFEBE2', band: '#3A3F45', glass: '#5A3A26', frame: '#3A2618', grille: false }), 30);
  for (const side of [-1, 1]) for (let z = 4, i = 0; z < 36; z += 12.5, i++) {
    const xf = side * 6, xb = side * 20, zc = z + 6, ry = side < 0 ? Math.PI / 2 : -Math.PI / 2, red = (i + (side > 0 ? 1 : 0)) % 2 === 0, h = red ? 8 : 6.4;
    P.slab(Math.min(xf, xb), Math.max(xf, xb), 0, h, z + 0.2, z + 12.3, hex(red ? '#A8533C' : '#EFEBE2'), NO); k.colSlab(Math.min(xf, xb), Math.max(xf, xb), 0, h, z, z + 12.5);
    A.quad(xf - side * 0.03, h / 2, zc, 12, h - 0.6, ry, red ? uvB : uvW);
    if (red) P.slab(Math.min(xf, xb), Math.max(xf, xb), h, h + 0.9, z + 0.2, z + 12.3, hex('#E9DCC6'), NO);
    else roof(P, side * 13, zc, 14, 12.1, h, 2.4, hex('#33373C'), { ovh: 0.4, swallow: false, curl: 0.2, alongZ: true });
  }
  // 星安河：东西向小河（z 44..56），两岸石栏杆，三通桥在 x -3..3 横过去
  const R0 = 44, R1 = 56;
  WA.slab(-160, 160, 0.01, 0.04, R0, R1, hex('#3F7F8C'), NO);
  for (let i = 0; i < 16; i++) { const x = -150 + i * 19; WA.slab(x, x + 7, 0.041, 0.045, R0 + 2 + (i % 4) * 2.4, R0 + 2.3 + (i % 4) * 2.4, hex('#8FC0C8'), NO); }
  for (const z of [R0, R1]) { GR.slab(-160, 160, 0, 0.3, z - 0.5, z + 0.5, hex('#9A9385'), NO);
    for (const [a, b] of [[-160, -3.4], [3.4, 160]]) { GR.slab(a, b, 0.3, 1.05, z - 0.18, z + 0.18, hex('#B5AE9F'), NO); k.colSlab(a, b, 0, 1.2, z - 0.25, z + 0.25); } }
  // 三通桥：花岗岩平桥 + 桥栏（示意，桥面是平的）
  GR.slab(-3.4, 3.4, 0.04, 0.32, R0 - 1, R1 + 1, hex('#B9B2A4'), NO);
  for (const x of [-3.2, 3.2]) { GR.slab(x - 0.22, x + 0.22, 0.32, 1.25, R0 - 1, R1 + 1, hex('#A39C8E'), NO); k.colSlab(x - 0.25, x + 0.25, 0, 1.3, R0 - 1, R1 + 1);
    for (let z = R0 - 0.8; z <= R1 + 0.9; z += 2.4) GR.slab(x - 0.3, x + 0.3, 1.2, 1.6, z - 0.3, z + 0.3, hex('#9A9385'), NO); }
  A.quad(0, 1.0, R0 - 1.03, 3, 0.55, 0, A.draw(3, 0.55, textPaint(['三通桥'], { bg: '#6E675B', fg: '#F2E2B0' }), 60));
  // 河对岸：一排白墙黑瓦老厝 + 远处张真君祖殿的翘脊
  for (let x = -80, i = 0; x < 80; x += 16, i++) { if (Math.abs(x) < 4) continue; const h = 6 + (i % 3);
    P.slab(x, x + 15, 0, h, R1 + 3, R1 + 15, hex('#EFEBE2'), NO); k.colSlab(x, x + 15, 0, h, R1 + 2, R1 + 15);
    A.quad(x + 7.5, h / 2, R1 + 2.97, 15, h - 0.6, 0, uvW); roof(P, x + 7.5, R1 + 9, 15, 12, h, 2.2, hex('#33373C'), { ovh: 0.4, swallow: false, curl: 0.2 }); }
  { const cx = 40, cz = R1 + 30; P.slab(cx - 10, cx + 10, 0, 7, cz - 6, cz + 6, hex('#B5523B'), NO); roof(P, cx, cz, 20, 12, 7, 4, hex('#3A3F45'), { ovh: 1.0, curl: 0.8, ridgeCol: hex('#C9A23A') }); }
  // 河边游客 + 一条小船
  for (const [x, z, r, j] of [[-12, 41, 1.6, 1], [14, 42, -1.6, 2], [1.5, 50, 0, 3], [-1.5, 47, Math.PI, 4], [-2, 20, 0, 5], [3, 30, Math.PI, 6]]) lowPerson(P, x, 0, z, r, j * 3 + 2, j === 3);
  P.box(-30, 0.25, 50, 6, 0.5, 1.8, hex('#7A5236'), 0, 0, 0, 1, NO); figure(P, -31.5, 50, '#3E8EDE', 1.4, 0.4);
  S.filler([[-60, 20, 30, 34, 14, '#D2CABE'], [60, 20, 30, 34, 16, '#C9C2B6'], [-100, -40, 40, 14, 26, '#CFC7BA'], [100, -40, 40, 14, 30, '#D8D0C3']]);
}

/* ============== 西门 B 口：西湖公园 ============== */
function xihu(S) {
  const k = S.kit, P = k.solid, A = S.atlas, GR = k.g('granite'), WA = k.g('paint@sea');
  front(S, '湖头街');
  // 公园大门：三间牌楼（红柱、绿琉璃瓦），中间写“西湖公园”
  { const z = 14, gy = 7;
    for (const x of [-6.5, -2.6, 2.6, 6.5]) { P.cyl(x, (Math.abs(x) > 4 ? 5.4 : gy) / 2, z, 0.8, Math.abs(x) > 4 ? 5.4 : gy, hex('#B02A22'), 8); k.colSlab(x - 0.45, x + 0.45, 0, gy, z - 0.45, z + 0.45); }
    P.slab(-3, 3, gy - 1.5, gy - 0.2, z - 0.3, z + 0.3, hex('#B02A22'), NO);
    roof(P, 0, z, 6.4, 1.6, gy, 1.6, hex('#2F7D6D'), { ovh: 0.6, curl: 0.5 }); roof(P, -4.6, z, 4.4, 1.3, 5.4, 1.1, hex('#2F7D6D'), { ovh: 0.4 }); roof(P, 4.6, z, 4.4, 1.3, 5.4, 1.1, hex('#2F7D6D'), { ovh: 0.4 });
    const uv = A.draw(5.4, 1.1, textPaint(['西湖公园'], { bg: '#1F3B2E', fg: '#E9C46A' }), 60); A.quad(0, gy - 0.85, z - 0.32, 5.4, 1.1, 0, uv); A.quad(0, gy - 0.85, z + 0.32, 5.4, 1.1, Math.PI, uv);
    for (const [a, b] of [[-60, -7.2], [7.2, 60]]) { P.slab(a, b, 0, 2.4, z - 0.3, z + 0.3, hex('#E9E3D6'), NO); P.slab(a, b, 2.4, 2.7, z - 0.5, z + 0.5, hex('#2F7D6D'), NO); k.colSlab(a, b, 0, 2.6, z - 0.3, z + 0.3); } }
  stone(S, 11, 8, 4.8, 1.5, '西湖公园', 'West Lake Park', { bg: '#7E786C' });
  // 园路（湖边）+ 草地
  P.slab(-60, 60, 0.02, 0.06, 15, 42, hex('#79A85A'), NO);
  GR.slab(-3, 3, 0.061, 0.08, 15, 42, hex('#C9C3B6'), NO);
  // 湖：z ≥ 48；湖岸石栏，观景平台伸进湖里（x -8..8, z 42..52），平台上一座亭子
  WA.slab(-160, 160, 0.01, 0.04, 48, 200, hex('#4F8FA0'), NO);
  for (let i = 0; i < 22; i++) { const x = -150 + i * 14 + (i % 3) * 3, z = 60 + (i * 37) % 120; WA.slab(x, x + 8, 0.041, 0.045, z, z + 0.4, hex('#A9D2DA'), NO); }
  GR.slab(-160, 160, 0, 0.25, 47, 48.4, hex('#A39C8E'), NO);
  for (const [a, b] of [[-160, -8], [8, 160]]) { GR.slab(a, b, 0.25, 1.0, 47.5, 47.9, hex('#C6BFB1'), NO); k.colSlab(a, b, 0, 1.2, 47.4, 48); }
  GR.slab(-8, 8, 0.04, 0.3, 42, 58, hex('#BDB6A8'), NO);
  for (const x of [-8, 8]) { GR.slab(x - 0.2, x + 0.2, 0.3, 1.05, 48, 58, hex('#C6BFB1'), NO); k.colSlab(x - 0.25, x + 0.25, 0, 1.2, 47.5, 58.2); }
  GR.slab(-8, 8, 0.3, 1.05, 57.8, 58.2, hex('#C6BFB1'), NO); k.colSlab(-8, 8, 0, 1.2, 57.7, 58.3);
  { const cx = 0, cz = 53;   // 亭子：四根红柱 + 绿瓦攒尖顶
    for (const [x, z] of [[-3.2, -3.2], [3.2, -3.2], [3.2, 3.2], [-3.2, 3.2]]) { P.cyl(cx + x, 1.9, cz + z, 0.42, 3.8, hex('#B02A22'), 8); k.colSlab(cx + x - 0.25, cx + x + 0.25, 0, 3.8, cz + z - 0.25, cz + z + 0.25); }
    P.slab(cx - 3.6, cx + 3.6, 3.7, 4.0, cz - 3.6, cz + 3.6, hex('#B02A22'), NO);
    P.cyl(cx, 5.1, cz, 10, 2.2, hex('#2F7D6D'), 4, Math.PI / 4, 0, 0, 0.6); P.cyl(cx, 6.6, cz, 0.6, 1, hex('#C9A23A'), 6, 0, 0, 0, 0.1);
    A.quad(cx, 3.2, cz - 3.62, 2.8, 0.6, 0, A.draw(2.8, 0.6, textPaint(['观湖亭'], { bg: '#1F3B2E', fg: '#E9C46A' }), 60)); }
  // 湖心小岛（开化寺）：岛 + 榕树 + 一座殿
  P.ellipsoid(-30, 0, 120, 60, 4, 34, hex('#5E8F45'), 2);
  { const cx = -30, cz = 120; P.slab(cx - 8, cx + 8, 0, 6, cz - 4, cz + 4, hex('#E8C35A'), NO); roof(P, cx, cz, 16, 8, 6, 3, hex('#B5523B'), { ovh: 0.9, curl: 0.7 }); }
  banyan(P, -48, 116, 1.1, 1); banyan(P, -12, 126, 0.9, 2);
  // 远处湖岸一排榕树 + 拱桥（示意）
  for (let x = -140; x <= 140; x += 28) banyan(P, x, 190, 1.0, (x / 28 + 6) % 4 | 0);
  P.cyl(60, 0, 150, 24, 0.9, hex('#D8D2C4'), 16, 0, 0, Math.PI / 2, 24);
  // 近岸榕树（平台两边）
  for (const [x, z, s, i] of [[-22, 36, 1.0, 0], [22, 34, 1.1, 2], [-44, 30, 0.9, 3], [46, 30, 1.0, 1]]) banyan(P, x, z, s, i);
  for (const [x, z, r, j] of [[-2, 30, 0, 1], [2, 22, Math.PI, 2], [-4, 50, 0.4, 3], [3, 55, Math.PI, 4], [-14, 44, 1.5, 5], [18, 45, -1.5, 6]]) lowPerson(P, x, 0, z, r, j * 3 + 4, j === 4);
  S.filler([[-100, -40, 40, 14, 22, '#CFC7BA'], [100, -40, 40, 14, 26, '#D8D0C3']]);
}

export const FZ_ATTR_BUILD = { fzdjk: sanfang, fznmd: yushan, fzdd: shangxiahang, fzxm: xihu };
/** 到达点（街区局部 x, z）+ 半径：走到这里算“到了景点” */
export const FZ_ATTR_GOAL = {
  fzdjk: { x: 0, z: 32, r: 4, name: '三坊七巷（南后街）', path: [[0, 10], [0, 20], [0, 32]], view: [0, 4, 0, -0.1] },
  fznmd: { x: -22, z: 60, r: 4, name: '于山白塔', path: [[0, 12], [-10, 36], [-22, 60]], view: [-14, 32, -0.18, -0.3] },
  fzdd: { x: 0, z: 50, r: 3, name: '上下杭（三通桥）', path: [[0, 14], [0, 30], [0, 42], [0, 50]], view: [0, 33, 0, 0.04] },
  fzxm: { x: 0, z: 49, r: 3, name: '西湖公园（观湖亭）', path: [[0, 10], [0, 26], [0, 40], [0, 49]], view: [0, 34, 0, -0.04] },
};
