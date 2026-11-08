/*
 * 福州地铁景点街区（第二批，1 / 4 号线）。坐标约定同 xmAttr.js：出口亭在原点，玩家出亭往 +z 走；亭子后面（z -22..-8）是马路。
 *   东街口 C  → 三坊七巷：南后街北口（“三坊七巷”石牌坊）→ 南后街，两边白墙黛瓦、一道道起伏的马鞍墙（封火墙）、木板店面、红灯笼
 *   南门兜 G1 → 于山 / 白塔：五一广场 → 于山（满山榕树）脚下的白塔（七层八角、白墙灰檐）+ 定光寺屋顶
 *   达道 C   → 上下杭：老街两边 2–3 层青砖 / 灰白墙老商行（木板店面、招牌、灯笼）→ 星安河（下沉河道）+ 三通桥（石拱桥）
 *   西门 B   → 西湖公园：牌楼式大门 → 湖岸垂柳 → 木栈桥 → 立在水上的观湖亭；远处柳堤 + 白石拱桥、湖心岛开化寺
 * 第三批（2 / 5 / 6 号线）：
 *   上藤 B   → 烟台山：上山石板路，两边红砖 / 米黄近代洋楼（两层券廊）→ 灰色花岗岩石厝教堂 + 方塔尖顶钟楼；山上榕树
 *   鼓山 A   → 鼓山风景区：入口广场（车站在广场下）、“鼓山”大石刻、登山古道石门 + 石阶、鼓山索道下站 + 缆绳 / 铁塔 / 来回动的吊厢
 *   东岭 A   → 海峡奥体中心：大广场 + 旗杆 → 椭圆体育场（白壳、蓝斜肋、环形挑棚）——外观未核实，按示意
 *   南门兜 B → 乌山：广场、樱花、榕树山丘 → 灰黑花岗岩七层八角乌塔（石栏围着）；FZ_ATTR_BUILD 键 'fznmd_B'（多出口，见 fz-exits.js more）
 * 外观依据 /workspace/fuzhou-research/brief.md（白塔外观、马鞍墙细节在 brief 里标了“未核实”——按常见照片做示意，不追求测绘级）。
 * FZ_ATTR_GOAL：每个景点的“到达点”（街区局部坐标），fz_attr.py / fz_ride.py 走到这里算到达；从出亭点 (0, 1.2) 到这里一路没有碰撞体。
 * 面数：每个街区 ≤ 9 万三角形、≤ 50 draw（fz_attr.py 量）。
 */
import { Geo, hex } from '../core/geo.js';
import * as D from './decor.js';
import { textPaint, facadePaint, FONT } from './xmStreet.js';
import { q2, roof, figure, ring, ringCol, animMesh } from './xmAttr.js';
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
  const yAt = u => h0 + amp * (0.5 * (Math.cos(u * TAU) * 0.5 + 0.5) ** 1.4 + 0.62 * Math.exp(-(((u - 0.5) / 0.12) ** 2)) + 0.4 * (Math.exp(-((u / 0.07) ** 2)) + Math.exp(-(((1 - u) / 0.07) ** 2))));   // 两头高高翘起、中间一个拱：马鞍形
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
    saddleWall(S, side < 0 ? xb : xf - side * 0.3, z0, Math.abs(xb - xf) + 0.3, 6.2, 4.6 + (i % 3) * 0.6, false, 18);
  }
  // 远处一道横跨的马鞍墙“天际线”（视线尽头）
  saddleWall(S, -26, 186, 52, 6.5, 4.5, false, 16);
  // 游客
  [[-3, 30, 0], [2.5, 36, Math.PI], [-1, 48, 0.2], [3.5, 58, Math.PI], [-4, 70, 0], [1, 84, Math.PI], [-2.5, 100, 0], [4, 116, Math.PI], [-15, 10, 1], [16, 6, -1],
   [1.5, 27, Math.PI], [-4.5, 34, 0.3], [4.6, 41, -2.9], [0, 44, 0], [-3.4, 53, Math.PI], [2, 63, 0.2], [-0.5, 76, Math.PI], [3.8, 92, 0], [-4.2, 108, Math.PI], [1.2, 128, 0], [-2, 146, Math.PI], [3, 160, 0]].forEach(([x, z, r], j) => lowPerson(P, x, 0, z, r, j * 5 + 2, j === 3));
  S.filler([[-60, 40, 40, 30, 22, '#D2CABE'], [60, 40, 40, 30, 26, '#C9C2B6'], [-60, 110, 40, 60, 9, '#E9E5DC'], [60, 110, 40, 60, 9, '#E9E5DC'], [-110, -40, 40, 14, 30, '#CFC7BA'], [110, -40, 40, 14, 24, '#D8D0C3']]);
}

/* ============== 南门兜 G1 口：于山风景区（白塔）· 五一广场 ============== */
function pagoda(S, x, z, levels = 7, y0 = 0, { wall = '#F4F2EC', eave: eaveC = '#59606A', base = '#B9B2A4', door = '#3B3027', scale: sc = 1 } = {}) {
  const k = S.kit, P = k.solid, W = k.g('paint@wall'), white = hex(wall), eave = hex(eaveC), R = 6.5 * sc;
  P.cyl(x, y0 + 0.6 - y0 / 2, z, 14 * sc, 1.2 + y0, hex(base), 8, Math.PI / 8); k.colSlab(x - R, x + R, 0, y0 + 1.2, z - R, z + R);
  let y = y0 + 1.2;
  for (let i = 0; i < levels; i++) {
    const d = (10.4 - i * 0.75) * sc, h = (i === 0 ? 6 : 4.4) * (sc < 1 ? 1 : sc);
    W.cyl(x, y + h / 2, z, d, h, white, 8, Math.PI / 8);
    // 拱门 / 小窗：四正面
    for (let j = 0; j < 4; j++) { const a = j * Math.PI / 2, r = d / 2 * Math.cos(Math.PI / 8) + 0.02; P.box(x + Math.sin(a) * r, y + h * 0.42, z - Math.cos(a) * r, i === 0 ? 1.8 : 0.9, i === 0 ? 3 : 1.5, 0.12, hex(door), a); }
    // 腰檐（八角，往外挑）
    P.cyl(x, y + h + 0.25, z, d + 2.6 * sc, 0.5, eave, 8, Math.PI / 8, 0, 0, d + 0.4 * sc);
    y += h + 0.5;
  }
  P.cyl(x, y + 1.0, z, 3.4 * sc, 2.0, eave, 8, Math.PI / 8, 0, 0, 0.6);
  k.metal.cyl(x, y + 3.6, z, 0.4, 5, hex('#C9A23A'), 6); k.metal.sphere(x, y + 2.4, z, 1.0, hex('#C9A23A'), 1); k.metal.sphere(x, y + 4.2, z, 0.8, hex('#C9A23A'), 1);
  k.colSlab(x - 4.6 * sc, x + 4.6 * sc, 0, y, z - 4.6 * sc, z + 4.6 * sc);
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
  // 白塔：在于山西麓（左前方）的山坡上 —— 塔下一个长满草的小山包，正面一道石阶上去
  const TX = -22, TZ = 76, TY = 6.3;
  GR.slab(TX - 12, TX + 12, 0.03, 0.06, 52, 61, hex('#BDB6A8'), NO);
  P.ellipsoid(TX, 0, TZ + 4, 46, 13, 40, hex('#557F3E'), 2); k.colSlab(TX - 18, TX + 18, 0, TY, TZ - 8, TZ + 20);
  const hill = z => 6.5 * Math.sqrt(Math.max(0, 1 - ((z - TZ - 4) / 20) ** 2));   // 山坡表面高度
  for (let i = 0, n = 16; i < n; i++) { const z0 = 60.2 + i * 0.66, y = hill(z0 + 0.66) + 0.12; GR.slab(TX - 2.2, TX + 2.2, y - 0.7, y, z0, z0 + 0.66, hex('#B9B2A4'), NO); }   // 贴着山坡的石阶
  pagoda(S, TX, TZ, 7, TY);
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
/** 老商行立面（贴图）：上面几层 青砖 / 灰白墙 + 木格窗，底层整排木板店面 */
function shopPaint(floors, wall, brick) {
  return (c, pw, ph) => {
    c.fillStyle = wall; c.fillRect(0, 0, pw, ph);
    if (brick) { c.strokeStyle = 'rgba(30,34,38,0.28)'; c.lineWidth = 1; const bh = ph / (floors * 26);
      for (let y = 0, r = 0; y < ph; y += bh, r++) { c.beginPath(); c.moveTo(0, y); c.lineTo(pw, y); c.stroke(); for (let x = (r % 2) * bh * 1.6; x < pw; x += bh * 3.2) { c.beginPath(); c.moveTo(x, y); c.lineTo(x, y + bh); c.stroke(); } } }
    const fh = ph / floors, n = 4;
    for (let f = 1; f < floors; f++) { const y0 = ph - (f + 1) * fh;
      c.fillStyle = brick ? '#4E5458' : '#3A3F45'; c.fillRect(0, y0 + fh - fh * 0.06, pw, fh * 0.06);   // 腰线
      for (let j = 0; j < n; j++) { const x = pw * (j + 0.5) / n, w = pw / n * 0.46, h = fh * 0.56, y = y0 + fh * 0.2;
        c.fillStyle = '#E9DCC6'; c.fillRect(x - w / 2 - 4, y - 4, w + 8, h + 8); c.fillStyle = '#5A3A26'; c.fillRect(x - w / 2, y, w, h);
        c.strokeStyle = '#C9A77A'; c.lineWidth = 3; for (let g = 1; g < 4; g++) { c.beginPath(); c.moveTo(x - w / 2 + w * g / 4, y); c.lineTo(x - w / 2 + w * g / 4, y + h); c.stroke(); }
        c.beginPath(); c.moveTo(x - w / 2, y + h / 2); c.lineTo(x + w / 2, y + h / 2); c.stroke(); } }
    // 底层：木板门店（一扇扇排门 + 中间开着的店门）
    const y0 = ph - fh; c.fillStyle = '#6B4428'; c.fillRect(0, y0, pw, fh);
    for (let j = 0; j < 10; j++) { const x = pw * j / 10; c.fillStyle = j === 4 || j === 5 ? '#2A1C12' : (j % 2 ? '#7A5236' : '#86603F'); c.fillRect(x + 3, y0 + fh * 0.1, pw / 10 - 6, fh * 0.9);
      if (j !== 4 && j !== 5) { c.fillStyle = '#E8D9B0'; c.fillRect(x + pw * 0.02, y0 + fh * 0.16, pw / 10 - pw * 0.04, fh * 0.2); } }
    c.fillStyle = '#3A2618'; c.fillRect(0, y0, pw, fh * 0.08);
  };
}
function shangxiahang(S) {
  const k = S.kit, P = k.solid, A = S.atlas, GR = k.g('granite'), WA = k.g('paint@sea');
  front(S, '达道路');
  // 石板老街（x -6..6，往 +z 到河边）
  GR.slab(-6, 6, 0.005, 0.03, 2, 43.5, hex('#ABA497'), NO);
  for (let z = 4; z < 43; z += 2.4) GR.slab(-5.6, 5.6, 0.031, 0.035, z, z + 0.1, hex('#8E887C'), NO);
  stone(S, 9, 8, 4.6, 1.5, '上下杭', 'Shangxiahang', { bg: '#7E786C' });
  // 街两边：2–3 层老商行（青砖 / 灰白墙），底层木板店面 + 披檐 + 招牌 + 红灯笼
  const SHOP = ['茶行', '钱庄', '布行', '药行', '纸行', '南货', '鱼丸', '酱园'];
  const uvF = {}, fac = (fl, br) => uvF[fl + '' + br] || (uvF[fl + '' + br] = A.draw(12, fl * 3.4, shopPaint(fl, br ? '#6F777D' : '#E4E1DA', br), 26));
  let si = 0;
  const house = (xf, xb, z0, z1, side, fl, br) => {
    const h = fl * 3.4, zc = (z0 + z1) / 2, ry = side < 0 ? Math.PI / 2 : -Math.PI / 2;
    P.slab(Math.min(xf, xb), Math.max(xf, xb), 0, h, z0 + 0.2, z1 - 0.2, hex(br ? '#6F777D' : '#E4E1DA'), NO); k.colSlab(Math.min(xf, xb), Math.max(xf, xb), 0, h, z0, z1);
    A.quad(xf - side * 0.03, h / 2, zc, 12, h, ry, fac(fl, br));
    if (br) { P.slab(Math.min(xf, xb) - 0.2, Math.max(xf, xb) + 0.2, h, h + 0.35, z0, z1, hex('#4E5458'), NO); P.slab(Math.min(xf, xb), Math.max(xf, xb), h + 0.35, h + 1.1, z0 + 0.4, z1 - 0.4, hex('#6F777D'), NO); }   // 青砖商行：平顶女儿墙 + 压檐
    else roof(P, (xf + xb) / 2, zc, Math.abs(xb - xf), z1 - z0 - 0.4, h, 2.2, hex('#33373C'), { ovh: 0.4, swallow: false, curl: 0.25, alongZ: true });
    P.box(xf - side * 0.9, 3.45, zc, 2.0, 0.16, z1 - z0 - 0.6, hex('#3A3F45'), 0, 0, side * 0.32, 1, NO);   // 一层披檐
    const shop = SHOP[si++ % SHOP.length];
    A.quad(xf - side * 0.06, 4.15, zc, 3.4, 0.75, ry, uvF['s' + shop] || (uvF['s' + shop] = A.draw(3.4, 0.75, textPaint([shop], { bg: '#2E1F14', fg: '#E9C46A' }), 60)));
    for (const dz of [-3.8, 3.8]) P.ellipsoid(xf - side * 1.5, 2.85, zc + dz, 0.55, 0.62, 0.55, hex('#D7262E'), 1);
    if (z1 > 40) A.quad((xf + xb) / 2, h / 2, z1 + 0.03, Math.abs(xb - xf), h, Math.PI, fac(fl, br));   // 临河山墙也有门窗（站在河边回头看不是一面白墙）
  };
  for (const side of [-1, 1]) for (let z = 4, i = 0; z < 41; z += 12.5, i++) house(side * 6, side * 20, z, z + 12.5, side, 2 + ((i + (side > 0 ? 1 : 0)) % 2), (i + (side > 0 ? 0 : 1)) % 2 === 0);
  // 星安河：东西向小河（z 44..56），地面挖开、水面低 1.8 米；两岸条石驳岸 + 矮石栏（碰撞墙 1.2 米高，看不见）
  const R0 = 44, R1 = 56, WY = -2.6;
  WA.slab(-160, 160, WY - 0.05, WY, R0, R1, hex('#2F6670'), NO);
  k.colSlab(-160, 160, WY, WY + 0.08, R0, R1);   // 水面托一层，掉下去站在水面上
  for (let i = 0; i < 18; i++) { const x = -150 + i * 17 + (i % 3) * 2; WA.slab(x, x + 6, WY + 0.002, WY + 0.006, R0 + 1.6 + (i % 4) * 2.6, R0 + 1.9 + (i % 4) * 2.6, hex('#8FC0C8'), NO); }
  for (const [z0, z1] of [[R0, R0 + 0.4], [R1 - 0.4, R1]]) GR.slab(-160, 160, WY - 0.3, 0, z0, z1, hex('#8A8476'), NO);
  for (const [z0, z1] of [[R0, R0 + 0.4], [R1 - 0.4, R1]]) for (let x = -158; x < 158; x += 3.1) GR.slab(x, x + 0.06, WY, -0.1, z0 - 0.02, z1 + 0.02, hex('#6E685C'), NO);   // 条石竖缝
  for (const z of [R0, R1]) for (const [a, b] of [[-160, -3.4], [3.4, 160]]) {   // 岸边压顶 + 矮石栏（看得见河）；碰撞体高
    GR.slab(a, b, 0, 0.18, z - 0.5, z + 0.5, hex('#9A9385'), NO); GR.slab(a, b, 0.62, 0.72, z - 0.07, z + 0.07, hex('#B5AE9F'), NO); k.colSlab(a, b, 0, 1.2, z - 0.25, z + 0.25);
    for (let x = a + 1.2; x < b - 0.6; x += 2.6) GR.slab(x - 0.12, x + 0.12, 0.18, 0.62, z - 0.12, z + 0.12, hex('#A8A193'), NO); }   // 望柱 + 扶手（通透，看得见河）
  // 三通桥：花岗岩石拱桥 —— 桥身下面一个拱洞（看得见水），桥面平（好走），两边石栏
  { const half = 5.2, zc = (R0 + R1) / 2, DY = 0.1, n = 36;
    for (let i = 0; i < n; i++) { const z0 = R0 - 0.6 + (R1 - R0 + 1.2) * i / n, z1 = R0 - 0.6 + (R1 - R0 + 1.2) * (i + 1) / n, u = ((z0 + z1) / 2 - zc) / half;
      const yA = Math.abs(u) < 1 ? WY + (-0.12 - WY) * Math.sqrt(1 - u * u) : (z1 <= R0 || z0 >= R1 ? 0 : WY);
      GR.slab(-3.4, 3.4, yA, DY, z0, z1, hex('#9A9384'), NO);
      if (Math.abs(u) < 1) for (const x of [-3.43, 3.43]) GR.slab(x - 0.06, x + 0.06, yA, yA + 0.55, z0 - 0.02, z1 + 0.02, hex('#D6CFBF'), NO); }
    WA.slab(-3.4, 3.4, WY + 0.003, WY + 0.008, R0, R1, hex('#1C4148'), NO);   // 桥洞下的阴影   // 拱券石
    k.colSlab(-3.4, 3.4, -0.6, DY - 0.02, R0 - 0.6, R1 + 0.6);
    for (const x of [-3.2, 3.2]) { GR.slab(x - 0.22, x + 0.22, DY, 0.95, R0 - 1, R1 + 1, hex('#A39C8E'), NO); k.colSlab(x - 0.25, x + 0.25, 0, 1.3, R0 - 1, R1 + 1);
      for (let z = R0 - 0.8; z <= R1 + 0.9; z += 2.4) GR.slab(x - 0.3, x + 0.3, 0.9, 1.25, z - 0.3, z + 0.3, hex('#9A9385'), NO); }
    const uv = A.draw(2.4, 0.5, textPaint(['三通桥'], { bg: '#6E675B', fg: '#F2E2B0' }), 60);
    for (const x of [-3.45, 3.45]) A.quad(x, 0.55, zc, 2.4, 0.5, x < 0 ? -Math.PI / 2 : Math.PI / 2, uv); }
  stone(S, -5.4, R0 - 1.6, 2.6, 1.1, '三通桥', null, { bg: '#6E675B' });
  // 河对岸：一排老商行 / 老厝（面朝河）+ 远处张真君祖殿的翘脊
  for (let x = -80, i = 0; x < 80; x += 16, i++) { if (Math.abs(x + 7.5) < 9) continue; const fl = 2 + (i % 2), br = i % 3 === 1, h = fl * 3.4;
    P.slab(x, x + 15, 0, h, R1 + 3, R1 + 15, hex(br ? '#6F777D' : '#E4E1DA'), NO); k.colSlab(x, x + 15, 0, h, R1 + 2, R1 + 15);
    A.quad(x + 7.5, h / 2, R1 + 2.97, 12, h, 0, fac(fl, br));
    if (br) P.slab(x - 0.2, x + 15.2, h, h + 0.4, R1 + 2.8, R1 + 15, hex('#4E5458'), NO); else roof(P, x + 7.5, R1 + 9, 15, 12, h, 2.2, hex('#33373C'), { ovh: 0.4, swallow: false, curl: 0.25 });
    for (const dx of [3, 12]) P.ellipsoid(x + dx, 2.85, R1 + 2.4, 0.5, 0.58, 0.5, hex('#D7262E'), 1); }
  { const cx = 40, cz = R1 + 30; P.slab(cx - 10, cx + 10, 0, 7, cz - 6, cz + 6, hex('#B5523B'), NO); roof(P, cx, cz, 20, 12, 7, 4, hex('#3A3F45'), { ovh: 1.0, curl: 0.8, ridgeCol: hex('#C9A23A') }); }
  // 逛街的人（街上 + 河边 + 桥上）+ 一条小船
  [[-2, 8, 0], [3, 12, Math.PI], [-3.5, 17, 0.3], [1, 21, Math.PI], [4, 25, 3.0], [-1.5, 28, 0], [2.5, 33, Math.PI], [-4, 36, 0.2], [0.5, 39, 0], [3.5, 41, Math.PI],
   [-12, 42.4, 1.6], [14, 42.6, -1.6], [-24, 42.5, 1.5], [1.5, 50, 0], [-1.5, 47, Math.PI], [1, 53, Math.PI], [-20, 57.6, -1.5], [22, 57.8, 1.5]].forEach(([x, z, r], j) => lowPerson(P, x, 0, z, r, j * 3 + 2, j % 5 === 3));
  P.box(-26, WY + 0.25, 50, 6, 0.5, 1.8, hex('#7A5236'), 0, 0, 0, 1, NO); figure(P, -27.5, 50, '#3E8EDE', 1.4, WY + 0.4);
  S.filler([[-60, 20, 30, 34, 14, '#D2CABE'], [60, 20, 30, 34, 16, '#C9C2B6'], [-100, -40, 40, 14, 26, '#CFC7BA'], [100, -40, 40, 14, 30, '#D8D0C3']]);
}

/* ============== 西门 B 口：西湖公园 ============== */
/** 垂柳：斜一点的树干 + 嫩绿树冠 + 一圈垂下来的柳条（倒锥） */
export function willow(P, x, z, s = 1, kd = 0, y0 = 0) {
  const G = ['#8DBF4E', '#7FB347', '#9CCB5C'], lean = (kd % 2 ? 0.7 : -0.7) * s;
  P.tube([x, y0, z], [x + lean, y0 + 4.4 * s, z], 0.55 * s, hex('#5E4E3E'), 5);
  P.ellipsoid(x + lean, y0 + 5.3 * s, z, 5.4 * s, 2.4 * s, 5.4 * s, hex(G[kd % 3]), 1);
  for (let i = 0; i < 9; i++) { const a = i / 9 * TAU + kd, r = 2.2 * s, h = (3.6 + (i % 3) * 0.6) * s;
    P.cyl(x + lean + Math.cos(a) * r, y0 + 5.0 * s - h / 2, z + Math.sin(a) * r, 0.25 * s, h, hex(G[(i + kd + 1) % 3]), 5, 0, 0, 0, 1.5 * s); }
}
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
  // 园路 + 草地（到湖岸 z 47.6）
  P.slab(-160, 160, 0.02, 0.06, 15, 47.6, hex('#79A85A'), NO);
  GR.slab(-3, 3, 0.061, 0.08, 15, 47.6, hex('#C9C3B6'), NO);
  GR.slab(-160, 160, 0.061, 0.08, 43.2, 46.4, hex('#C9C3B6'), NO);   // 沿湖步道
  // 湖：地面挖开（z 47.6 起），水面低 0.45 米；湖岸条石 + 很矮的石沿（看得见湖；1.2 米高的碰撞墙看不见，孩子掉不下去）
  const WY = -0.45, Z0 = 47.6;
  WA.slab(-160, 160, WY - 0.05, WY, Z0, 200, hex('#4F93A6'), NO);
  k.colSlab(-160, 160, WY, WY + 0.08, Z0, 200);   // 湖面托一层，掉下去站在水面上
  for (let i = 0; i < 30; i++) { const x = -150 + i * 10.3 + (i % 3) * 3, z = 54 + (i * 37) % 130; WA.slab(x, x + 6 + (i % 4), WY + 0.002, WY + 0.006, z, z + 0.35, hex('#B4DCE3'), NO); }
  GR.slab(-160, 160, WY - 0.2, 0.06, Z0, Z0 + 0.5, hex('#9A9385'), NO);
  for (const [a, b] of [[-160, -1.7], [1.7, 160]]) { GR.slab(a, b, 0.06, 0.4, Z0 - 0.1, Z0 + 0.4, hex('#C6BFB1'), NO); k.colSlab(a, b, 0, 1.2, Z0 - 0.1, Z0 + 0.4); }
  // 观湖亭：立在湖面上（石墩托着的平台），一条窄木栈桥从岸边伸过去
  const BZ0 = Z0, BZ1 = 58, PZ = 63.5, DY = 0.12, wood = hex('#8A6440');
  P.slab(-1.6, 1.6, DY - 0.1, DY, BZ0, BZ1, wood, NO); k.colSlab(-1.6, 1.6, -0.6, DY - 0.02, BZ0, BZ1);
  for (let z = BZ0 + 1.6; z < BZ1; z += 2.6) for (const x of [-1.3, 1.3]) GR.slab(x - 0.2, x + 0.2, WY - 0.1, DY - 0.1, z - 0.2, z + 0.2, hex('#8C8577'), NO);
  for (const x of [-1.55, 1.55]) { P.slab(x - 0.06, x + 0.06, DY, DY + 0.75, BZ0 + 0.4, BZ1, hex('#B02A22'), NO); k.colSlab(x - 0.12, x + 0.12, 0, 1.2, BZ0 + 0.4, BZ1);
    for (let z = BZ0 + 0.5; z <= BZ1; z += 1.5) P.slab(x - 0.08, x + 0.08, DY, DY + 0.8, z - 0.08, z + 0.08, hex('#8E2A22'), NO); }
  GR.slab(-5, 5, DY - 0.3, DY, BZ1, PZ + 5, hex('#BDB6A8'), NO); k.colSlab(-5, 5, -0.6, DY - 0.02, BZ1, PZ + 5);
  for (const [x, z] of [[-4.4, BZ1 + 0.6], [4.4, BZ1 + 0.6], [-4.4, PZ + 4.4], [4.4, PZ + 4.4]]) GR.slab(x - 0.5, x + 0.5, WY - 0.1, DY - 0.3, z - 0.5, z + 0.5, hex('#8C8577'), NO);
  for (const [x0, x1, z0, z1] of [[-5, -1.6, BZ1, BZ1 + 0.2], [1.6, 5, BZ1, BZ1 + 0.2], [-5, -4.8, BZ1, PZ + 5], [4.8, 5, BZ1, PZ + 5], [-5, 5, PZ + 4.8, PZ + 5]]) { P.slab(x0, x1, DY, DY + 0.5, z0, z1, hex('#B02A22'), NO); k.colSlab(x0, x1, 0, 1.2, z0, z1); }
  { const cx = 0, cz = PZ;   // 亭子：四根红柱 + 绿瓦攒尖顶
    for (const [x, z] of [[-3.2, -3.2], [3.2, -3.2], [3.2, 3.2], [-3.2, 3.2]]) { P.cyl(cx + x, DY + 1.9, cz + z, 0.42, 3.8, hex('#B02A22'), 8); k.colSlab(cx + x - 0.25, cx + x + 0.25, 0, 3.8, cz + z - 0.25, cz + z + 0.25); }
    P.slab(cx - 3.6, cx + 3.6, DY + 3.7, DY + 4.0, cz - 3.6, cz + 3.6, hex('#B02A22'), NO);
    P.cyl(cx, DY + 5.1, cz, 10, 2.2, hex('#2F7D6D'), 4, Math.PI / 4, 0, 0, 0.6); P.cyl(cx, DY + 6.6, cz, 0.6, 1, hex('#C9A23A'), 6, 0, 0, 0, 0.1);
    const uv = A.draw(2.8, 0.6, textPaint(['观湖亭'], { bg: '#1F3B2E', fg: '#E9C46A' }), 60); A.quad(cx, DY + 3.2, cz - 3.62, 2.8, 0.6, 0, uv); A.quad(cx, DY + 3.2, cz + 3.62, 2.8, 0.6, Math.PI, uv); for (const d of [-1, 1]) P.box(cx, DY + 3.2, cz + d * 3.56, 2.9, 0.7, 0.06, hex('#1F3B2E'), 0, 0, 0, 1, NO); }
  // 柳堤：远处一条从右岸伸到湖心岛的长堤（绿堤 + 一排垂柳），堤上一座白石拱桥
  const CZ = 124, BX = 34, BH = 12, CX0 = -16;   // 堤中线 z、拱桥中心 x、半长
  for (const [a, b] of [[CX0, BX - BH], [BX + BH, 160]]) { P.slab(a, b, WY, 0.35, CZ - 3, CZ + 3, hex('#7DAA55'), NO); GR.slab(a, b, WY, 0.1, CZ - 3.2, CZ - 2.9, hex('#A39C8E'), NO); }
  for (let x = CX0 + 4; x < 160; x += 11) if (Math.abs(x - BX) > BH + 3) willow(P, x, CZ + (((x - CX0) / 11) % 2 ? 1.2 : -1.2), 0.95, ((x - CX0) / 11) | 0, 0.3);
  P.slab(CX0 - 3, CX0 + 3, WY, 0.35, CZ, CZ + 13, hex('#7DAA55'), NO);   // 堤头接上湖心岛
  { const n = 24, ar = 6.5;
    for (let i = 0; i < n; i++) { const x0 = BX - BH + 2 * BH * i / n, x1 = BX - BH + 2 * BH * (i + 1) / n, xm = (x0 + x1) / 2, u = (xm - BX) / BH;
      const top = 0.4 + 3.6 * (1 - u * u), d = Math.abs(xm - BX), und = d < ar ? WY + Math.sqrt(ar * ar - d * d) * 0.82 : WY;
      GR.slab(x0, x1, und, top, CZ - 2.4, CZ + 2.4, hex('#E3DED3'), NO);
      for (const z of [CZ - 2.3, CZ + 2.3]) GR.slab(x0, x1, top, top + 0.55, z - 0.12, z + 0.12, hex('#D2CCC0'), NO);
      if (d < ar) GR.slab(x0, x1, und, und + 0.35, CZ - 2.5, CZ + 2.5, hex('#B9B2A4'), NO); }
    WA.slab(BX - ar, BX + ar, WY + 0.003, WY + 0.008, CZ - 7.5, CZ - 2.6, hex('#E3DED3'), NO); }   // 拱桥倒影（示意）
  // 湖心岛上的开化寺：岛 + 榕树 + 白墙灰瓦的殿（红柱、翘檐），在远处
  P.ellipsoid(-38, WY, 150, 70, 5, 40, hex('#5E8F45'), 2);
  { const cx = -38, cz = 150, y0 = 1.6;
    P.slab(cx - 11, cx + 11, 0, y0, cz - 7, cz + 7, hex('#A39C8E'), NO);
    P.slab(cx - 9, cx + 9, y0, y0 + 5.4, cz - 4, cz + 4, hex('#EFEBE2'), NO);
    for (let x = -8; x <= 8; x += 3.2) P.cyl(cx + x, y0 + 2.7, cz - 4.6, 0.55, 5.4, hex('#9E2B22'), 6);
    roof(P, cx, cz, 18, 8, y0 + 5.4, 3.6, hex('#3A3F45'), { ovh: 1.4, curl: 0.9 });
    P.slab(cx - 6, cx + 6, y0, y0 + 4.4, cz + 9, cz + 15, hex('#EFEBE2'), NO); roof(P, cx, cz + 12, 12, 6, y0 + 4.4, 2.8, hex('#3A3F45'), { ovh: 1.0, curl: 0.8 });
    const uv = A.draw(3.6, 0.9, textPaint(['开化寺'], { bg: '#2E1F14', fg: '#E9C46A' }), 60); A.quad(cx, y0 + 4.5, cz - 4.05, 3.6, 0.9, 0, uv); }
  banyan(P, -64, 146, 1.1, 1, 1.5); banyan(P, -12, 156, 1.0, 2, 1.5); willow(P, -20, 136, 1.0, 1, 1.0); willow(P, -58, 134, 1.0, 2, 1.0);
  // 对岸一排榕树
  for (let x = -140; x <= 140; x += 28) banyan(P, x, 192, 1.0, (x / 28 + 6) % 4 | 0);
  // 湖岸垂柳（沿岸一排，栈桥两边留空）
  for (const x of [-46, -35, -24, -15, -7, 7, 15, 24, 35, 46]) willow(P, x, 46.2, 1.0, (x + 50) % 3);
  for (const [x, z, s, i] of [[-40, 30, 0.9, 3], [42, 30, 1.0, 1]]) banyan(P, x, z, s, i);
  // 游人：园路、湖边步道、栈桥、亭子里
  [[-2, 30, 0, 1], [2, 22, Math.PI, 2], [-8, 44.5, 1.6, 3], [9, 45, -1.6, 4], [-18, 44, 1.5, 5], [20, 45, -1.5, 6], [0.6, 53, Math.PI, 7], [-1.5, 62, 0.3, 8], [2, 65, -2.5, 9], [-30, 45, 1.5, 10]]
    .forEach(([x, z, r, j]) => lowPerson(P, x, z > Z0 ? DY : 0, z, r, j * 3 + 4, j % 4 === 0));
  S.filler([[-100, -40, 40, 14, 22, '#CFC7BA'], [100, -40, 40, 14, 26, '#D8D0C3']]);
}

/* ============== 第三批 ============== */
/* ---------- 南门兜 B 口：乌山风景区 · 乌塔（坚牢塔） ---------- */
/** 樱花树（乌山春天开樱花）：细树干 + 几团粉色树冠 */
function sakura(P, x, z, s = 1, kd = 0) {
  const PK = ['#F4B6C8', '#F7C9D6', '#EFA3BA'];
  P.tube([x, 0, z], [x + (kd % 2 ? 0.4 : -0.4) * s, 2.6 * s, z], 0.4 * s, hex('#5A4638'), 5);
  P.ellipsoid(x, 3.6 * s, z, 5.2 * s, 2.6 * s, 5.0 * s, hex(PK[kd % 3]), 1);
  for (let i = 0; i < 3; i++) { const a = i / 3 * TAU + kd; P.ellipsoid(x + Math.cos(a) * 2 * s, 3.2 * s + (i % 2) * 0.5 * s, z + Math.sin(a) * 2 * s, 3.4 * s, 2.0 * s, 3.4 * s, hex(PK[(i + kd + 1) % 3]), 1); }
}
function wushan(S) {
  const k = S.kit, P = k.solid, A = S.atlas, GR = k.g('granite');
  front(S, '乌山路');
  GR.slab(-40, 40, 0.005, 0.03, 2, 62, hex('#C9C3B6'), NO);
  for (let z = 6; z < 62; z += 4) GR.slab(-40, 40, 0.031, 0.035, z, z + 0.1, hex('#B1AA9C'), NO);
  stone(S, -10, 14, 5.2, 1.7, '乌山风景区', 'Wushan Hill', { bg: '#5E5A54' });
  // 乌山：后面几个土丘，满山榕树 + 樱花
  const HILLS = [[-20, 130, 150, 40, 70, '#46753A'], [30, 150, 130, 34, 70, '#4F7F3A'], [-60, 160, 110, 46, 60, '#3F6E35']];
  for (const [x, z, sx, sy, sz, c] of HILLS) P.ellipsoid(x, 0, z, sx, sy, sz, hex(c), 2);
  const hillY = (x, z) => Math.max(0, ...HILLS.map(([hx, hz, sx, sy, sz]) => { const q = ((x - hx) / (sx / 2)) ** 2 + ((z - hz) / (sz / 2)) ** 2; return q < 1 ? sy / 2 * Math.sqrt(1 - q) : 0; }));
  k.colSlab(-80, 80, 0, 8, 92, 93);
  for (const [x, z, s, i] of [[-50, 108, 1.2, 0], [-22, 104, 1.1, 1], [40, 118, 1.1, 3], [-4, 132, 1.0, 1], [20, 140, 1.1, 2], [-40, 140, 1.0, 3]]) banyan(P, x, z, s, i, Math.max(0, hillY(x, z) - 2));
  // 樱花：广场两边 + 山脚
  for (const [x, z, s, i] of [[-24, 30, 1.0, 0], [-30, 46, 1.1, 1], [-18, 58, 0.9, 2], [30, 26, 1.0, 1], [34, 44, 1.1, 2], [-8, 82, 1.0, 0], [8, 96, 1.1, 1], [-30, 88, 1.0, 2], [44, 80, 1.0, 0]]) sakura(P, x, z, s, i);
  // 乌塔：七层八角，灰黑色花岗岩（不刷白）——在广场尽头一圈石栏里（形制示意）
  const TX = 12, TZ = 66;
  GR.slab(TX - 11, TX + 11, 0.03, 0.06, TZ - 11, TZ + 11, hex('#A39C8E'), NO);
  for (const [x0, x1, z0, z1] of [[TX - 11, TX - 2.5, TZ - 11, TZ - 10.6], [TX + 2.5, TX + 11, TZ - 11, TZ - 10.6], [TX - 11, TX - 10.6, TZ - 11, TZ + 11], [TX + 10.6, TX + 11, TZ - 11, TZ + 11], [TX - 11, TX + 11, TZ + 10.6, TZ + 11]]) { GR.slab(x0, x1, 0, 0.9, z0, z1, hex('#7E786C'), NO); k.colSlab(x0, x1, 0, 1.2, z0, z1); }
  pagoda(S, TX, TZ, 7, 0, { wall: '#6E6B66', eave: '#4A4744', base: '#8C877E', door: '#2A2622', scale: 0.82 });
  stone(S, TX + 6.5, TZ - 13, 4.2, 1.4, '乌塔', 'Black Pagoda (Wuta)', { bg: '#5E5A54' });
  for (const [x, z, r, j] of [[-6, 34, 0.5, 1], [6, 24, -2.5, 2], [-14, 48, 1.3, 3], [18, 44, 2.9, 4], [4, 50, 0.2, 5], [24, 54, 3.1, 6]]) lowPerson(P, x, 0, z, r, j * 4 + 3, j === 2);
  S.filler([[-120, 30, 40, 40, 26, '#CFC7BA'], [120, 30, 40, 40, 30, '#D8D0C3'], [-100, -40, 40, 14, 30, '#C9C2B6'], [100, -40, 40, 14, 24, '#D2CABE']]);
}

/* ---------- 上藤 B 口：烟台山（近代洋楼 + 石厝教堂） ---------- */
/** 洋楼立面贴图：红砖 / 米黄墙 + 两层券廊（拱形外廊） */
function villaPaint(wall, trim) {
  return (c, pw, ph) => {
    c.fillStyle = wall; c.fillRect(0, 0, pw, ph);
    const n = 5, fh = ph / 2;
    for (let f = 0; f < 2; f++) for (let i = 0; i < n; i++) {
      const x = pw * (i + 0.12) / n, w = pw * 0.76 / n, y = f * fh + fh * 0.18, h = fh * 0.72;
      c.fillStyle = '#2E3238'; c.beginPath(); c.moveTo(x, y + h); c.lineTo(x, y + w / 2); c.arc(x + w / 2, y + w / 2, w / 2, Math.PI, 0); c.lineTo(x + w, y + h); c.closePath(); c.fill();
      c.strokeStyle = trim; c.lineWidth = pw * 0.012; c.stroke();
      c.fillStyle = trim; c.fillRect(x - pw * 0.01, y + h - fh * 0.12, w + pw * 0.02, fh * 0.05);   // 栏杆
    }
    c.fillStyle = trim; c.fillRect(0, fh - ph * 0.02, pw, ph * 0.04); c.fillRect(0, 0, pw, ph * 0.04);
  };
}
/** 坡屋顶（两片斜板） */
function gable(P, x, z, w, d, y, h, col, alongZ = false) {
  const L = alongZ ? d : w, W = (alongZ ? w : d) / 2 + 0.6, sl = Math.hypot(W, h), ang = Math.atan2(h, W);
  for (const s of [-1, 1]) {
    if (alongZ) P.box(x + s * W / 2, y + h / 2, z, sl, 0.25, L + 1.0, col, 0, 0, -s * ang, 1, NO);
    else P.box(x, y + h / 2, z + s * W / 2, L + 1.0, 0.25, sl, col, 0, s * ang, 0, 1, NO);
  }
}
function villa(S, x, z, w, d, wall, trim, roofC, alongZ, faceA) {
  const k = S.kit, P = k.solid, A = S.atlas;
  P.slab(x - w / 2, x + w / 2, 0, 8, z - d / 2, z + d / 2, hex(wall), NO); k.colSlab(x - w / 2, x + w / 2, 0, 8, z - d / 2, z + d / 2);
  P.slab(x - w / 2 - 0.3, x + w / 2 + 0.3, 8, 8.4, z - d / 2 - 0.3, z + d / 2 + 0.3, hex(trim), NO);
  gable(P, x, z, w, d, 8.4, 3, hex(roofC), alongZ);
  const fw = alongZ ? d : w, uv = A.draw(fw - 0.6, 7.4, villaPaint(wall, trim), 30);
  const fx = alongZ ? x + (faceA > 0 ? w / 2 : -w / 2) + Math.sign(faceA) * 0.03 : x, fz = alongZ ? z : z - d / 2 - 0.03;
  A.quad(fx, 4, fz, fw - 0.6, 7.4, faceA, uv);
  if (alongZ) A.quad(x, 4, z - d / 2 - 0.03, w - 0.6, 7.4, 0, A.draw(w - 0.6, 7.4, villaPaint(wall, trim), 30));   // 朝马路那面也有券廊
}
function yantai(S) {
  const k = S.kit, P = k.solid, A = S.atlas, GR = k.g('granite');
  front(S, '上藤路');
  GR.slab(-24, 24, 0.005, 0.03, 2, 14, hex('#C9C3B6'), NO);
  // 上山的石板路（x -5..5），两边老洋楼（红砖 / 米黄墙 + 券廊）
  GR.slab(-5, 5, 0.005, 0.03, 14, 120, hex('#A9A397'), NO);
  for (let z = 16; z < 118; z += 2.4) GR.slab(-4.8, 4.8, 0.031, 0.035, z, z + 0.1, hex('#8E887C'), NO);
  stone(S, 9, 10, 4.8, 1.6, '烟台山', 'Yantai Hill', { bg: '#7E786C' });
  const V = [['#B5523B', '#F1ECE2', '#6E4A3A'], ['#E6D7B4', '#FFFFFF', '#7A4A3A'], ['#C9C2B0', '#F4F2EC', '#5E5A54']];
  [[-15, 26, 0], [15, 30, 1], [-15, 52, 2], [15, 56, 0]].forEach(([x, z, i]) => villa(S, x, z, 18, 16, ...V[i], true, x < 0 ? Math.PI / 2 : -Math.PI / 2));
  // 门口一块小招牌：“近代建筑群”
  A.quad(-5.9, 2.4, 26, 3.4, 0.7, Math.PI / 2, A.draw(3.4, 0.7, textPaint(['仓山近代建筑群'], { bg: '#2E3238', fg: '#E9C46A' }), 60));
  // 石厝教堂：灰色花岗岩小教堂，正面尖山墙 + 尖拱窗，旁边一座方塔尖顶钟楼（示意）
  { const cx = 0, cz = 82, w = 12, d = 20, h = 8, GRY = hex('#8E8A82');
    GR.slab(cx - w / 2, cx + w / 2, 0, h, cz - d / 2, cz + d / 2, GRY, NO); k.colSlab(cx - w / 2, cx + w / 2, 0, h, cz - d / 2, cz + d / 2);
    gable(P, cx, cz, w, d, h, 5, hex('#4A4F55'), true);
    const fz = cz - d / 2 - 0.02;
    q2(GR, [cx - w / 2, h, fz], [cx + w / 2, h, fz], [cx, h + 5, fz], [cx, h + 5, fz], GRY);   // 山墙三角
    A.quad(cx, h / 2 + 0.6, fz - 0.02, w - 1, h + 0.6, 0, A.draw(w - 1, h + 0.6, (c, pw, ph) => {
      c.fillStyle = '#8E8A82'; c.fillRect(0, 0, pw, ph);
      c.strokeStyle = '#7A766E'; c.lineWidth = 2; for (let y = 0; y < ph; y += ph / 14) { c.beginPath(); c.moveTo(0, y); c.lineTo(pw, y); c.stroke(); }
      const arch = (x, y, w2, h2, col) => { c.fillStyle = col; c.beginPath(); c.moveTo(x, y + h2); c.lineTo(x, y + w2 * 0.6); c.quadraticCurveTo(x, y, x + w2 / 2, y - w2 * 0.2); c.quadraticCurveTo(x + w2, y, x + w2, y + w2 * 0.6); c.lineTo(x + w2, y + h2); c.closePath(); c.fill(); };
      arch(pw * 0.4, ph * 0.5, pw * 0.2, ph * 0.5, '#3A2A20');   // 尖拱大门
      arch(pw * 0.12, ph * 0.25, pw * 0.1, ph * 0.4, '#3E5A78'); arch(pw * 0.78, ph * 0.25, pw * 0.1, ph * 0.4, '#3E5A78');
      c.fillStyle = '#5E7FA8'; c.beginPath(); c.arc(pw / 2, ph * 0.22, pw * 0.08, 0, TAU); c.fill(); c.strokeStyle = '#3A3F45'; c.lineWidth = 4; c.stroke();
    }, 40));
    // 钟楼（左前角）
    const tx = cx - w / 2 - 1.6, tz = cz - d / 2 + 2;
    GR.slab(tx - 2, tx + 2, 0, 15, tz - 2, tz + 2, hex('#8A867E'), NO); k.colSlab(tx - 2, tx + 2, 0, 15, tz - 2, tz + 2);
    P.cyl(tx, 18, tz, 5.6, 6, hex('#4A4F55'), 4, Math.PI / 4, 0, 0, 0.1);
    k.metal.cyl(tx, 21.6, tz, 0.12, 1.6, hex('#C9A23A'), 4); k.metal.box(tx, 21.9, tz, 0.9, 0.12, 0.12, hex('#C9A23A'));
    for (const a of [0, Math.PI / 2, Math.PI, -Math.PI / 2]) P.box(tx + Math.sin(a) * 2.02, 12.5, tz - Math.cos(a) * 2.02, 1.0, 2.2, 0.08, hex('#2E3238'), a, 0, 0, 1, NO);
    stone(S, 8, cz - d / 2 - 4, 4.4, 1.4, '石厝教堂', 'Shicuo Church', { bg: '#7E786C' }); }
  // 山上：榕树 + 远处更多洋楼屋顶
  P.ellipsoid(0, 0, 150, 220, 34, 90, hex('#4A7A3C'), 2); k.colSlab(-80, 80, 0, 8, 108, 109);
  for (const [x, z, s, i] of [[-30, 96, 1.1, 0], [28, 100, 1.2, 1], [-50, 76, 1.0, 2], [44, 74, 1.1, 3], [-12, 112, 1.0, 1], [16, 118, 1.0, 2]]) banyan(P, x, z, s, i, z > 104 ? 4 : 0);
  [[-40, 120, 2], [36, 126, 1], [-10, 132, 0]].forEach(([x, z, i]) => { P.slab(x - 7, x + 7, 8, 15, z - 5, z + 5, hex(V[i][0]), NO); gable(P, x, z, 14, 10, 15, 2.6, hex(V[i][2])); });
  for (const [x, z, r, j] of [[-2, 20, 0, 1], [3, 34, Math.PI, 2], [-3, 48, 0.2, 3], [2.5, 60, Math.PI, 4], [-1.5, 68, 0, 5], [6, 70, -1.2, 6]]) lowPerson(P, x, 0, z, r, j * 5 + 1, j === 3);
  S.filler([[-120, 30, 40, 40, 22, '#D2CABE'], [120, 30, 40, 40, 26, '#C9C2B6'], [-100, -40, 40, 14, 30, '#CFC7BA'], [100, -40, 40, 14, 24, '#D8D0C3']]);
}

/* ---------- 鼓山 A 口：鼓山风景区入口广场 + 空中索道 ---------- */
function gushan(S) {
  const k = S.kit, P = k.solid, A = S.atlas, GR = k.g('granite');
  front(S, '福马路');
  // 入口广场（车站就在广场下面）
  GR.slab(-50, 50, 0.005, 0.03, 2, 70, hex('#CFC9BC'), NO);
  for (let x = -48; x < 50; x += 6) GR.slab(x, x + 0.12, 0.031, 0.035, 2, 70, hex('#B7B1A4'), NO);
  for (const sx of [-1, 1]) { P.slab(sx * 18, sx * 46, 0.03, 0.18, 12, 30, hex('#6FA34A'), NO); k.colSlab(Math.min(sx * 18, sx * 46), Math.max(sx * 18, sx * 46), 0, 0.5, 12, 30); }
  // 鼓山：几座大山叠起来（山顶 ~90 m）
  const HILLS = [[0, 230, 300, 180, 160, '#3F6E35'], [-90, 190, 160, 110, 120, '#46753A'], [90, 200, 170, 120, 120, '#4A7A3C'], [20, 150, 140, 50, 60, '#557F3E']];
  for (const [x, z, sx, sy, sz, c] of HILLS) P.ellipsoid(x, 0, z, sx, sy, sz, hex(c), 2);
  k.colSlab(-100, 100, 0, 8, 96, 97);
  // 山坡上：露出来的花岗岩石头 + 一棵棵松树（贴着山体表面放）
  { const hy = (x, z) => Math.max(0, ...HILLS.map(([cx, cz, sx, sy, sz]) => { const u = 1 - ((x - cx) / (sx / 2)) ** 2 - ((z - cz) / (sz / 2)) ** 2; return u > 0 ? sy / 2 * Math.sqrt(u) : 0; }));
    let r = 7; const rnd = () => (r = (r * 16807) % 2147483647) / 2147483647;
    for (let i = 0; i < 34; i++) { const x = -120 + rnd() * 240, z = 140 + rnd() * 120, y = hy(x, z); if (y < 6) continue;
      const h = 7 + rnd() * 5; P.cyl(x, y + h * 0.2, z, 0.6, h * 0.4, hex('#5A4232'), 5, 0, 0, 0, undefined, NO);
      P.cyl(x, y + h * 0.5, z, h * 0.55, h * 0.45, hex(['#2F5A2E', '#2A5229', '#356334'][i % 3]), 7, 0, 0, 0, 0.3, NO);
      P.cyl(x, y + h * 0.82, z, h * 0.36, h * 0.36, hex('#38693A'), 7, 0, 0, 0, 0.05, NO); }
    for (let i = 0; i < 16; i++) { const x = -110 + rnd() * 220, z = 128 + rnd() * 110, y = hy(x, z); if (y < 4) continue;
      const w = 6 + rnd() * 8; P.ellipsoid(x, y - 0.5, z, w, w * 0.45, w * 0.7, hex(['#9A958B', '#8C877E', '#A8A398'][i % 3]), 1, rnd() * 3); } }
  for (const [x, z, s, i] of [[-40, 100, 1.2, 0], [-10, 96, 1.0, 1], [44, 100, 1.1, 2], [-64, 120, 1.1, 3], [70, 124, 1.0, 1]]) banyan(P, x, z, s, i);
  // 大石刻“鼓山”
  { const x = 0, z = 60; GR.box(x, 2.6, z, 9, 5.2, 2.2, hex('#8C877E'), 0.1); k.col(x, 2.6, z, 9, 5.2, 2.2, { ry: 0.1 });
    A.quad(x - 0.11, 2.8, z - 1.12, 7.4, 3.6, -0.1, A.draw(7.4, 3.6, textPaint(['鼓山', 'Gushan Mountain'], { bg: '#8C877E', fg: '#B02A22' }), 50)); }
  stone(S, -14, 40, 5.2, 1.6, '鼓山风景区', 'Gushan Scenic Area', { bg: '#7E786C' });
  // 登山古道起点：左边一道石阶 + 小石门
  { const x = -32, z0 = 74;
    for (const gx of [x - 3.2, x + 3.2]) { GR.slab(gx - 0.5, gx + 0.5, 0, 5, z0 - 0.5, z0 + 0.5, hex('#A39C8E'), NO); k.colSlab(gx - 0.5, gx + 0.5, 0, 5, z0 - 0.5, z0 + 0.5); }
    roof(P, x, z0, 7.6, 1.6, 5, 1.2, hex('#3A3F45'), { ovh: 0.4, curl: 0.4 });
    A.quad(x, 4.2, z0 - 0.52, 4.2, 0.8, 0, A.draw(4.2, 0.8, textPaint(['登山古道'], { bg: '#2E1F14', fg: '#E9C46A' }), 60));
    for (let i = 0; i < 18; i++) GR.slab(x - 2.4, x + 2.4, 0, 0.3 + i * 0.32, z0 + 1 + i * 0.7, z0 + 1.7 + i * 0.7, hex('#B9B2A4'), NO); }
  // 索道下站：右边一座白房子（“鼓山索道”）+ 缆绳上山 + 一座座铁塔；吊厢沿缆绳动（两条：上行 / 下行）
  const BX = 30, BZ = 72, BY = 9, TOP = [40, 92, 210];
  P.slab(BX - 8, BX + 8, 0, BY, BZ - 6, BZ + 6, hex('#EEF0F2'), NO); k.colSlab(BX - 8, BX + 8, 0, BY, BZ - 6, BZ + 6);
  P.slab(BX - 8.6, BX + 8.6, BY, BY + 0.6, BZ - 6.6, BZ + 6.6, hex('#B02A22'), NO);
  P.slab(BX - 3, BX + 3, 0, 3.6, BZ - 6.05, BZ - 6.0, hex('#2E3238'), NO);
  A.quad(BX, 6.8, BZ - 6.05, 9, 1.6, 0, A.draw(9, 1.6, textPaint(['鼓山索道', 'Gushan Cableway'], { bg: '#B02A22', fg: '#FFFFFF' }), 60));
  P.slab(TOP[0] - 6, TOP[0] + 6, 76, TOP[1] + 4, TOP[2] - 2, TOP[2] + 8, hex('#EEF0F2'), NO); P.slab(TOP[0] - 6.5, TOP[0] + 6.5, TOP[1] + 4, TOP[1] + 4.6, TOP[2] - 2.5, TOP[2] + 8.5, hex('#B02A22'), NO);   // 上站（山上）
  const dir = [TOP[0] - BX, TOP[1] - BY, TOP[2] - BZ], LEN = Math.hypot(...dir), u = dir.map(v => v / LEN);
  for (const off of [-1.6, 1.6]) { const a = [BX + off, BY - 0.6, BZ], b = [TOP[0] + off, TOP[1], TOP[2]]; k.metal.tube(a, b, 0.08, hex('#3A3F45'), 4); }
  for (let t = 0.22; t < 0.95; t += 0.24) { const x = BX + dir[0] * t, y = BY + dir[1] * t, z = BZ + dir[2] * t;
    k.metal.tube([x, -2, z], [x, y + 0.6, z], 0.9, hex('#9AA3AD'), 4); k.metal.box(x, y + 0.6, z, 4.4, 0.4, 0.5, hex('#9AA3AD')); }
  const SP = 18, NCAB = Math.floor(LEN / SP), cab = sgn => { const g = new Geo();
    for (let i = 0; i < NCAB; i++) { const d = i * SP, x = BX + sgn * 1.6 + u[0] * d, y = BY - 0.6 + u[1] * d, z = BZ + u[2] * d;
      g.box(x, y - 0.9, z, 0.06, 1.8, 0.06, hex('#3A3F45')); g.box(x, y - 2.6, z, 1.8, 1.6, 1.8, hex(i % 2 ? '#D7262E' : '#E9C46A')); g.box(x, y - 2.4, z, 1.84, 0.6, 1.4, hex('#BFDCEB')); }
    return animMesh(S, g, 'fzCable' + sgn); };
  const up = cab(-1), dn = cab(1); S.cable = { t: 0 };
  S.tick = dt => { S.cable.t = (S.cable.t + dt * 2.5) % SP; const t = S.cable.t; up.position.set(u[0] * t, u[1] * t, u[2] * t); dn.position.set(-u[0] * t, -u[1] * t, -u[2] * t); };
  for (const [x, z, r, j] of [[-6, 30, 0.5, 1], [6, 22, -2.5, 2], [-20, 46, 1.3, 3], [22, 58, 2.9, 4], [26, 64, 0.2, 5], [-30, 68, 3.1, 6], [10, 50, 0, 7]]) lowPerson(P, x, 0, z, r, j * 4 + 2, j === 2);
  S.filler([[-120, 30, 40, 40, 18, '#CFC7BA'], [120, 30, 40, 40, 22, '#D8D0C3'], [-100, -40, 40, 14, 26, '#C9C2B6'], [100, -40, 40, 14, 20, '#D2CABE']]);
}

/* ---------- 东岭 A 口：福州海峡奥体中心（体育场外观未核实，按示意：白色椭圆外壳 + 蓝色斜肋 + 环形挑棚） ---------- */
function aoti(S) {
  const k = S.kit, P = k.solid, A = S.atlas, GR = k.g('granite'), M = k.metal;
  front(S, null);
  GR.slab(-90, 90, 0.005, 0.03, 2, 80, hex('#D3CEC4'), NO);
  for (let z = 6; z < 80; z += 6) GR.slab(-90, 90, 0.031, 0.035, z, z + 0.15, hex('#B9B3A6'), NO);
  stone(S, 12, 14, 6.4, 1.8, '海峡奥体中心', 'Straits Olympic Sports Center', { bg: '#2D5C8A', fg: '#FFFFFF' });
  // 旗杆一排
  for (let i = 0; i < 6; i++) { const x = -25 + i * 10; M.cyl(x, 7, 40, 0.24, 14, hex('#C9CED3'), 6); P.box(x + 1.1, 12.8, 40, 2.0, 1.3, 0.05, hex(['#DE2910', '#2D6FA8', '#3E9A4A', '#E9C46A', '#DE2910', '#2D6FA8'][i]), 0, 0, 0, 1, NO); k.colSlab(x - 0.2, x + 0.2, 0, 14, 39.8, 40.2); }
  // 体育场：中心 (0,150)，外椭圆 rx 70 / rz 56。真实海峡奥体体育场 = 白色：一圈往外挑的拱形白色挑棚（边缘起伏），
  // 立面一根根竖向弯曲的白色板（鳍片），后面是深色玻璃。下面都是“形制示意”，不是测绘
  const CX = 0, CZ = 150, RX = 70, RZ = 56, H = 30, WH = hex('#F4F5F6'), WH2 = hex('#E2E6EA'), GL = hex('#4E5D6C');
  const pt = (a, s = 1) => [CX + Math.cos(a) * RX * s, CZ + Math.sin(a) * RZ * s];
  // 1) 深色玻璃筒身（鳍片的背景）+ 筒顶一圈
  for (let i = 0, N = 48; i < N; i++) { const a0 = i / N * TAU, a1 = (i + 1) / N * TAU, [x0, z0] = pt(a0, 0.96), [x1, z1] = pt(a1, 0.96);
    q2(P, [x0, 0, z0], [x1, 0, z1], [x1, H - 1, z1], [x0, H - 1, z0], i % 2 ? GL : hex('#55636F')); }
  ring(P, CX, CZ, RX * 0.6, RZ * 0.56, RX * 0.96, RZ * 0.96, 0.2, hex('#7C8892'), 32);   // 看台（从挑棚中间能看到一点）
  ring(P, CX, CZ, 0, 0, RX * 0.6, RZ * 0.56, 0.25, hex('#4F9A45'), 24);                  // 球场草坪
  // 2) 立面鳍片：72 片竖向白板，中段往外鼓（弯），往上略扭
  for (let i = 0, NF = 72; i < NF; i++) {
    const a = (i + 0.5) / NF * TAU, prof = [[0, 1.0], [9, 1.035], [19, 1.04], [H - 0.5, 1.0]], tw = 0.012;
    for (let j = 0; j < prof.length - 1; j++) {
      const [y0, s0] = prof[j], [y1, s1] = prof[j + 1], b0 = a + tw * y0 / H, b1 = a + tw * y1 / H;
      const [ix0, iz0] = pt(b0, s0 - 0.04), [ox0, oz0] = pt(b0, s0), [ix1, iz1] = pt(b1, s1 - 0.04), [ox1, oz1] = pt(b1, s1);
      q2(P, [ix0, y0, iz0], [ox0, y0, oz0], [ox1, y1, oz1], [ix1, y1, iz1], j === 1 ? WH : WH2);
    }
  }
  // 3) 环形拱形挑棚：18 跨，每跨的外沿往上拱（边缘起伏），从筒身往外挑出去
  { const NB = 18, M = 6, N = NB * M;
    const yo = (i) => H + 0.5 + 3.4 * Math.sin(Math.PI * ((i % M) / M));   // 外沿高度：跨中高、肋处低 → 一个个拱
    for (let i = 0; i < N; i++) {
      const a0 = i / N * TAU, a1 = (i + 1) / N * TAU, y0 = yo(i), y1 = yo(i + 1), m0 = H + 1.8 + 0.5 * Math.sin(Math.PI * ((i % M) / M)), m1 = H + 1.8 + 0.5 * Math.sin(Math.PI * (((i + 1) % M) / M));
      const I0 = pt(a0, 0.64), I1 = pt(a1, 0.64), M0 = pt(a0, 0.98), M1 = pt(a1, 0.98), O0 = pt(a0, 1.15), O1 = pt(a1, 1.15);
      q2(P, [I0[0], H - 1.2, I0[1]], [I1[0], H - 1.2, I1[1]], [M1[0], m1, M1[1]], [M0[0], m0, M0[1]], WH);
      q2(P, [M0[0], m0, M0[1]], [M1[0], m1, M1[1]], [O1[0], y1, O1[1]], [O0[0], y0, O0[1]], WH);
      q2(P, [O0[0], y0 - 0.7, O0[1]], [O1[0], y1 - 0.7, O1[1]], [O1[0], y1, O1[1]], [O0[0], y0, O0[1]], WH2);   // 外沿封边（看得出起伏的边线）
      if (i % M === 0) { const R0 = pt(a0, 0.99), R1 = pt(a0, 1.15); P.tube([R0[0], H - 5, R0[1]], [R1[0], y0 - 0.3, R1[1]], 0.7, WH, 6); }   // 挑棚悬挑肋
    }
    ring(P, CX, CZ, RX * 0.62, RZ * 0.58, RX * 0.645, RZ * 0.605, H - 1.25, hex('#2D6FA8'), 48);   // 内沿一圈蓝边
  }
  // 4) 入口（南面正中）：鳍片之间的玻璃大门 + 名字
  { const z = CZ - RZ * 0.96 - 0.3; k.glass.slab(-12, 12, 0, 6, z - 0.2, z, hex('#9CC8E0'));
    A.quad(0, 22, CZ - RZ * 1.05 - 1.2, 24, 3, 0, A.draw(24, 3, textPaint(['海峡奥体中心 · 体育场', 'Straits Olympic Sports Center Stadium'], { bg: '#2D5C8A', fg: '#FFFFFF' }), 40)); }
  ringCol(k, CX, CZ, RX * 1.0, RZ * 1.0, 40);
  // 5) 前面：检票闸机一排（有顶棚）+ 售票亭 + 两边栏杆
  { const GZ = 84, GX = 14, G = k.glow;
    GR.slab(-60, 60, 0.005, 0.03, 80, 92, hex('#D3CEC4'), NO);
    for (let x = -GX; x <= GX + 0.01; x += 2.8) {
      P.slab(x - 0.18, x + 0.18, 0, 1.05, GZ - 0.7, GZ + 0.7, hex('#A7B0B8'), NO); k.colSlab(x - 0.18, x + 0.18, 0, 1.05, GZ - 0.7, GZ + 0.7);
      G.slab(x - 0.12, x + 0.12, 1.05, 1.1, GZ - 0.6, GZ - 0.3, hex(Math.round(x / 2.8) % 2 ? '#3FD07A' : '#FF5A4E'), NO);
      if (x < GX) k.glass.slab(x + 0.18, x + 0.75, 0.45, 1.0, GZ - 0.03, GZ + 0.03, hex('#CDE8F4'));   // 闸门挡板
    }
    for (const x of [-GX - 0.2, GX + 0.2]) M.cyl(x, 1.9, GZ, 0.22, 3.8, hex('#C9CED3'), 6);
    P.slab(-GX - 1, GX + 1, 3.8, 4.1, GZ - 2.2, GZ + 2.2, WH, NO);
    A.quad(0, 4.6, GZ - 0.05, 8, 1.0, 0, A.draw(8, 1.0, textPaint(['检票口 · Ticket Gates'], { bg: '#2D5C8A', fg: '#FFFFFF' }), 60));
    P.slab(-0.9, 0.9, 4.1, 5.1, GZ - 0.05, GZ + 0.05, hex('#2D5C8A'), NO);
    for (const sx of [-1, 1]) { M.tube([sx * (GX + 0.4), 1.0, GZ], [sx * 44, 1.0, GZ], 0.07, hex('#C4CBD2'), 4);
      for (let x = GX + 4; x <= 44; x += 5) M.tube([sx * x, 0, GZ], [sx * x, 1.0, GZ], 0.07, hex('#C4CBD2'), 4);
      k.colSlab(Math.min(sx * (GX + 0.4), sx * 44), Math.max(sx * (GX + 0.4), sx * 44), 0, 1.1, GZ - 0.1, GZ + 0.1); }
    // 售票亭：白色小房子 + 蓝色顶 + 窗口
    const BX = -24, BZ = 78;
    P.slab(BX - 2.6, BX + 2.6, 0, 3, BZ - 1.6, BZ + 1.6, WH, NO); k.colSlab(BX - 2.6, BX + 2.6, 0, 3, BZ - 1.6, BZ + 1.6);
    P.slab(BX - 3, BX + 3, 3, 3.35, BZ - 2.1, BZ + 2.1, hex('#2D6FA8'), NO);
    for (const wx of [-1.3, 1.3]) { k.glass.slab(BX + wx - 0.8, BX + wx + 0.8, 1.0, 2.2, BZ - 1.63, BZ - 1.6, hex('#7FA9C4')); P.slab(BX + wx - 0.9, BX + wx + 0.9, 0.95, 1.0, BZ - 1.9, BZ - 1.6, hex('#B8BEC4'), NO); }
    A.quad(BX, 2.65, BZ - 1.66, 4.6, 0.6, 0, A.draw(4.6, 0.6, textPaint(['售票处 · Tickets'], { bg: '#2D5C8A', fg: '#FFFFFF' }), 60)); }
  // 周边：两座矮一点的场馆（示意）+ 绿化
  for (const [x, z, w, h, c] of [[-110, 120, 50, 16, '#E9ECEE'], [110, 120, 50, 18, '#DDE3E8']]) { P.cyl(x, h / 2, z, w, h, hex(c), 16, 0, 0, 0, w * 0.8); k.colSlab(x - w / 2, x + w / 2, 0, h, z - w / 2, z + w / 2); }
  for (let x = -80; x <= 80; x += 16) if (Math.abs(x) > 12) S.lightTree(x, 86, 0.9);
  // 人：广场上散步的、排队检票的、买票的；有几个穿球衣的球迷（红 / 蓝白条，背后白号码）
  const JER = ['#D7262E', '#1F5BB0', '#D7262E', '#F4F5F6'];
  const fan = (x, z, ry, j, jc) => { lowPerson(P, x, 0, z, ry, j, false); if (jc === undefined) return;
    const col = hex(JER[jc % JER.length]), sx = Math.cos(ry), sz = -Math.sin(ry), fx = Math.sin(ry), fz = Math.cos(ry);
    P.box(x, 1.13, z, 0.45, 0.64, 0.27, col, ry, 0, 0, 1, NO);
    for (const s of [-1, 1]) P.box(x + sx * 0.27 * s, 1.27, z + sz * 0.27 * s, 0.13, 0.28, 0.14, col, ry, 0, 0, 1, NO);
    P.box(x - fx * 0.14, 1.18, z - fz * 0.14, 0.18, 0.24, 0.01, hex(jc % JER.length === 3 ? '#1F5BB0' : '#FFFFFF'), ry, 0, 0, 1, NO); };
  const PEOPLE = [[-4, 30, 0.5], [5, 24, -2.5], [-16, 52, 1.3], [16, 60, 2.9], [2, 70, 0.2], [-30, 66, 3.1], [28, 46, 0], [-8, 76, 2.8],
    [-10, 18, 0.1], [12, 36, -0.3], [-22, 40, 0.6], [24, 72, 0.1], [-36, 52, -0.4], [36, 64, 2.6], [8, 54, 3.0], [-2, 44, 0.0],
    // 排队检票（面朝 +z）
    [-8.4, 81.5, 0], [-8.4, 80.3, 0], [-2.8, 81.5, 0], [-2.8, 80.2, 0], [-2.8, 79, 0], [2.8, 81.5, 0], [8.4, 81.6, 0], [8.4, 80.4, 0], [11.2, 81.5, 0],
    // 售票亭窗口前
    [-25.3, 75.6, 0], [-22.7, 75.4, 0], [-22.7, 74.2, 0]];
  const JERSEY = { 1: 0, 4: 1, 9: 2, 13: 3, 16: 0, 17: 1, 19: 2, 21: 0, 24: 1, 26: 2 };
  PEOPLE.forEach(([x, z, r], j) => fan(x, z, r, j * 4 + 5, JERSEY[j]));
  S.filler([[-130, -40, 40, 14, 26, '#C9C2B6'], [130, -40, 40, 14, 20, '#D2CABE']]);
}

/** 景点街区地面挖洞（下沉的河道 / 湖面）：XmStreet.ground() 用 */
export const FZ_ATTR_HOLES = { fzdd: [[-160, 160, 44, 56]], fzxm: [[-160, 160, 47.6, 200]] };
export const FZ_ATTR_BUILD = { fzdjk: sanfang, fznmd: yushan, fzdd: shangxiahang, fzxm: xihu, fzst: yantai, fzgs: gushan, fzdl: aoti, fznmd_B: wushan };
/** 到达点（街区局部 x, z）+ 半径：走到这里算“到了景点” */
export const FZ_ATTR_GOAL = {
  fzdjk: { x: 0, z: 32, r: 4, name: '三坊七巷（南后街）', path: [[0, 10], [0, 20], [0, 32]], view: [0, 4, 0, -0.1] },
  fznmd: { x: -22, z: 60, r: 4, name: '于山白塔', path: [[0, 12], [-10, 36], [-22, 60]], view: [-14, 30, -0.18, -0.34] },
  fzdd: { x: 0, z: 50, r: 3, name: '上下杭（三通桥）', path: [[0, 14], [0, 30], [0, 42], [0, 50]], view: [-16, 42.4, 1.25, 0.16], back: [0, 50, Math.PI, 0.04] },
  fzxm: { x: 0, z: 49, r: 3, name: '西湖公园（观湖亭）', path: [[0, 10], [0, 26], [0, 40], [0, 49]], view: [0, 36, 0, 0.02] },
  fzst: { x: 0, z: 64, r: 4, name: '烟台山（石厝教堂）', path: [[0, 10], [0, 30], [0, 50], [0, 64]], view: [-3, 44, 0.12, -0.12] },
  fzgs: { x: 0, z: 50, r: 4, name: '鼓山风景区（索道）', path: [[0, 10], [0, 30], [0, 50]], view: [-4, 18, 0.25, -0.2] },
  fzdl: { x: 0, z: 76, r: 4, name: '海峡奥体中心', path: [[0, 10], [0, 30], [0, 52], [0, 76]], view: [0, 16, 0, -0.16] },
  fznmd_B: { x: 6, z: 50, r: 4, name: '乌山（乌塔）', path: [[0, 12], [2, 30], [6, 50]], view: [-2, 26, 0.25, -0.3] },
};
