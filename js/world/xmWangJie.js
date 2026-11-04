/*
 * SM 旺街（WANG STREET）：厦门地铁 1 号线乌石浦站 4A/4B 方向「出闸入旺」、连通 SM 一期 B1 的地下美食街（2024-09-29 开街，约 1400 m²，美食为主 零售为辅）。
 * 公开资料：
 *   - smsupermalls.cn/city/newsdisp.aspx?aid=14510（SM 官网 2024-09-29「SM旺街今日开街」：乌石浦站 4A4B 方向一步入街、连通一期 B1、首条地铁直达商场的街区、1400 m²）
 *   - smsupermalls.cn/city/m/floor.aspx?fid=18（一期 -1F 店铺表：-1F-ws01..ws15 旺街铺位）
 *   - 新浪 2024-06-07（位于乌石浦站与 SM 一期 B1 的连接之处）、厦门电视台 2024-09-07（A 地块地下）、东南网 2024-10-04
 * 真实平面没有公开，这里的布局是按「一条直街 + 两侧铺位」推测的。
 * 旺街顶上（四期 A 地块）地面是约 5,000 m² 的露天停车场：街面没画——游戏街区里 A 地块的位置没法和真实对上，放到兴山路东会改四期的画面；街面只有一期门前广场上的入口亭。
 * 局部坐标（地面 y 0）：+z 向北（一期），原点在南厅北口；
 *   南厅 z −14..0：东侧楼梯上街（街上 SM 一期门前广场的「旺街」入口亭）→ gate 'main'；西墙连地铁站厅（闸机）→ 'back'（回乌石浦站）
 *   旺街 z 0..54：走廊 x ±3.5，两侧铺位 x ±3.5..±7.5（每格 6 m）
 *   北厅 z 54..70：扶梯 + 楼梯上 1F → 'p1'（接进 SM 一期 1F 正门）；北面玻璃墙后是一期 B1（沃尔玛 / 美食，不能进）
 */
import { hex } from '../core/geo.js';
import { Kit } from './kit.js';
import { FoodAtlas } from '../game/food-art.js';
import { textPaint as textPaint0, FONT, FONT_EN } from './xmStreet.js';
const textPaint = (lines, o = {}) => textPaint0(lines, { fit: true, ...o });   // 旺街的字都按宽度缩，不许出框
import { preseed } from './people.js';
import { escalator, lowPerson, shopper, flatQ } from './xmSM.js';

const H = 4.4, UP = 5.5;
const RED = hex('#B3261E'), CREAM = hex('#F1E6D2'), BRICK = hex('#A9533B'), WOOD = hex('#6B4630'), DARK = hex('#2E2A28'), FLOOR = hex('#E6DCCB'), STEEL = hex('#C3C9CF'), GOLD = hex('#D4A84A');
/** 西侧 / 东侧铺位（南 → 北，每格 6 m；n 是占几格）。名单来自 SM 官网 -1F 店铺表；ws06 标「待租」，ws09–13 官网没列，画成围挡 */
export const WJ_WEST = [
  { ws: 'ws01-02', zh: '富贵开心果', en: 'PISTACHIO', n: 2, bg: '#7FA650', fg: '#FFF8E6', kind: 'snack' },
  { ws: 'ws03-04', zh: '茉酸奶', en: 'MO YOGURT', n: 2, bg: '#F4F1EA', fg: '#2E6B47', kind: 'drink' },
  { ws: 'ws05', zh: '小周珠宝维修中心', en: 'JEWELRY REPAIR', n: 1, bg: '#2B2F3A', fg: '#E8C77A', kind: 'shop' },
  { ws: 'ws06', zh: '待租', en: 'FOR LEASE', n: 1, bg: '#D9D4CA', fg: '#6A645C', kind: 'shut' },
  { ws: 'ws07-08', zh: '有堂古', en: 'YOU TANG GU', n: 2, bg: '#5A2A1E', fg: '#F2D28A', kind: 'snack' },
];
export const WJ_EAST = [
  { ws: 'ws09-13', zh: 'HO! 上街去', en: 'COMING SOON', n: 5, bg: '#C8443A', fg: '#FFE7A8', kind: 'hoard' },
  { ws: 'ws14-15', zh: '阿杏饭团', en: 'A XING RICE BALL', n: 2, bg: '#F2C230', fg: '#5A2A1E', kind: 'snack' },
  { ws: '', zh: '休息区', en: 'SEATS', n: 1, kind: 'seat' },
];
const BAY = 6, Z0 = 0, Z1 = 54;

function menuWall(kind) {
  return (c, pw, ph) => {
    c.fillStyle = '#3B2A22'; c.fillRect(0, 0, pw, ph);
    if (kind === 'shop') { c.fillStyle = '#E9E2D6'; c.fillRect(pw * 0.05, ph * 0.1, pw * 0.9, ph * 0.8); for (let i = 0; i < 5; i++) { c.fillStyle = '#C9A24A'; c.beginPath(); c.arc(pw * (0.15 + i * 0.17), ph * 0.45, ph * 0.12, 0, 7); c.fill(); } return; }
    const g = c.createLinearGradient(0, 0, 0, ph * 0.6); g.addColorStop(0, '#FFF1CC'); g.addColorStop(1, '#F2B866'); c.fillStyle = g; c.fillRect(pw * 0.04, ph * 0.08, pw * 0.92, ph * 0.56);
    const C = kind === 'drink' ? ['#F4F4F2', '#B567D6', '#F2545B', '#7FBF6A'] : ['#C8443A', '#F2C230', '#8A5A3A', '#2E7D4F'];
    for (let i = 0; i < 4; i++) { c.fillStyle = C[i]; c.fillRect(pw * (0.08 + i * 0.22), ph * 0.14, pw * 0.18, ph * 0.24); c.fillStyle = '#5A3A22'; c.fillRect(pw * (0.08 + i * 0.22), ph * 0.44, pw * 0.18, ph * 0.05); }
    c.fillStyle = '#8A5A3A'; c.fillRect(0, ph * 0.7, pw, ph * 0.3);
  };
}
/** 洋楼立面（铺位招牌上方一圈：米色墙 + 红砖壁柱 + 拱窗；按厦门老洋楼的意思画，不是照着真店画的） */
function yanglou(c, pw, ph) {
  c.fillStyle = '#F1E6D2'; c.fillRect(0, 0, pw, ph);
  const n = Math.round(pw / ph * 1.2);
  for (let i = 0; i < n; i++) { const x = (i + 0.5) * pw / n, w = pw / n * 0.42;
    c.fillStyle = '#A9533B'; c.fillRect(i * pw / n, 0, pw / n * 0.1, ph);
    c.fillStyle = '#3E6E73'; c.beginPath(); c.moveTo(x - w / 2, ph * 0.9); c.lineTo(x - w / 2, ph * 0.42); c.arc(x, ph * 0.42, w / 2, Math.PI, 0); c.lineTo(x + w / 2, ph * 0.9); c.fill();
    c.fillStyle = '#F6D36B'; c.fillRect(x - w / 2, ph * 0.62, w, ph * 0.04); }
  c.fillStyle = '#8A3A2A'; c.fillRect(0, 0, pw, ph * 0.08); c.fillRect(0, ph * 0.92, pw, ph * 0.08);
}
function hoard(c, pw, ph) {
  c.fillStyle = '#C8443A'; c.fillRect(0, 0, pw, ph);
  c.fillStyle = '#FFE7A8'; c.textAlign = 'center'; c.textBaseline = 'middle';
  // 上下叠排，每行量宽缩放，不许互相压字
  const fit = (t, w, sz, f, maxW) => { c.font = `${w} ${sz}px ${f}`; const m = c.measureText(t).width; if (m > maxW) c.font = `${w} ${sz * maxW / m}px ${f}`; };
  fit('HO! 上街去', 900, ph * 0.3, FONT, pw * 0.86); c.fillText('HO! 上街去', pw / 2, ph * 0.28);
  fit('人旺财旺精神旺 · 呷旺饮旺家家旺', 700, ph * 0.11, FONT, pw * 0.86); c.fillText('人旺财旺精神旺 · 呷旺饮旺家家旺', pw / 2, ph * 0.55);
  fit('WANG STREET · -1F ws09–ws13 · COMING SOON', 600, ph * 0.065, FONT_EN, pw * 0.86); c.fillText('WANG STREET · -1F ws09–ws13 · COMING SOON', pw / 2, ph * 0.7);
  for (let i = 0; i < 9; i++) { c.fillStyle = i % 2 ? '#F2C230' : '#FFFFFF'; c.beginPath(); c.arc(pw * (0.05 + i * 0.11), ph * 0.86, ph * 0.04, 0, 7); c.fill(); }
}
function directory(c, pw, ph) {
  c.fillStyle = '#2E2A28'; c.fillRect(0, 0, pw, ph);
  c.fillStyle = '#B3261E'; c.fillRect(0, 0, pw, ph * 0.18);
  c.fillStyle = '#F6D36B'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.font = `900 ${ph * 0.11}px ${FONT}`; c.fillText('SM 旺街 · 店铺指引  -1F', pw / 2, ph * 0.09);
  c.textAlign = 'left'; c.font = `700 ${ph * 0.055}px ${FONT}`; c.fillStyle = '#F3F1EC';
  const L = [...WJ_WEST, ...WJ_EAST.filter(s => s.ws)].map(s => `${s.ws.toUpperCase()}  ${s.kind === 'hoard' ? '新店筹备' : s.zh}`);
  L.forEach((t, i) => c.fillText(t, pw * (i < 4 ? 0.05 : 0.53), ph * (0.3 + (i % 4) * 0.14)));
  c.fillStyle = '#9AA1A8'; c.font = `600 ${ph * 0.045}px ${FONT}`; c.fillText('↓ 地铁1号线 乌石浦站 4A·4B      ↑ SM城市广场 一期 B1 / 1F', pw * 0.05, ph * 0.92);
}
function b1Beyond(c, pw, ph) {
  const g = c.createLinearGradient(0, 0, 0, ph); g.addColorStop(0, '#F7F3EA'); g.addColorStop(1, '#D9D2C4'); c.fillStyle = g; c.fillRect(0, 0, pw, ph);
  const S = [['沃尔玛', '#0071CE', '#FFC220'], ['老塞咖啡', '#3B2A22', '#F2D28A'], ['陈家生煎', '#B3261E', '#FFF1CC'], ['阿嬷薄饼', '#2E7D4F', '#FFFFFF'], ['袁记云饺', '#C8443A', '#FFFFFF'], ['奈雪的茶', '#2B2B2B', '#F4F4F2']];
  S.forEach(([t, bg, fg], i) => { const x = pw * (0.02 + i * 0.163); c.fillStyle = '#E9E2D6'; c.fillRect(x, ph * 0.45, pw * 0.15, ph * 0.5); c.fillStyle = bg; c.fillRect(x, ph * 0.3, pw * 0.15, ph * 0.15);
    c.fillStyle = fg; c.textAlign = 'center'; c.textBaseline = 'middle'; c.font = `800 ${ph * 0.08}px ${FONT}`; c.fillText(t, x + pw * 0.075, ph * 0.375); });
  c.fillStyle = '#3A3F45'; c.font = `800 ${ph * 0.1}px ${FONT}`; c.textAlign = 'center'; c.fillText('SM城市广场 一期 B1', pw / 2, ph * 0.14);
}

export class SmWangJie {
  constructor(scene, origin, id = 'sm-wj') {
    this.id = id; this.o = origin; this.scene = scene;
    const k = this.kit = new Kit(scene, 'smWangJie'); k.root.position.set(origin.x, origin.y, origin.z);
    const A = this.atlas = new FoodAtlas(scene, 2048, { bestFit: 3 });
    const P = k.solid, GL = k.glass, G = k.glow, GR = k.g('granite'), Mt = k.metal, F = k.g('floor');
    preseed(20240929);
    const a = (nx, nz) => Math.atan2(nx, nz);
    // ---------- 地面 / 顶棚 / 外墙 ----------
    const floor = (x0, x1, z0, z1, col = FLOOR) => { F.slab(x0, x1, -0.3, 0, z0, z1, col, { ao: false }); k.colSlab(x0, x1, -0.3, 0, z0, z1); };
    floor(-10, 10, -14, 0); floor(-7.5, 7.5, Z0, Z1); floor(-10, 10, Z1, 70); floor(-18, -10, -9, -5, hex('#D8D4CC'));
    for (let z = Z0 + 3; z < Z1; z += BAY) F.slab(-3.2, 3.2, 0, 0.01, z - 0.12, z + 0.12, hex('#B3261E'), { ao: false });  // 走廊红色地纹
    F.slab(-0.12, 0.12, 0, 0.01, Z0, Z1, GOLD, { ao: false });
    const ceil = (x0, x1, z0, z1, y = H, col = hex('#3A2E2A')) => flatQ(P, [[x0, z0], [x1, z0], [x1, z1], [x0, z1]], y, col, false);
    ceil(-10, 4, -14, 0); ceil(8, 10, -14, 0); ceil(4, 8, -4, 0); ceil(-7.5, 7.5, Z0, Z1); ceil(-18, -10, -9, -5, 3.2, hex('#E9E5DD'));
    ceil(-10, 10, Z1, 70, 9.6, hex('#E9E5DD'));
    const wall = (x0, x1, z0, z1, y1 = H, col = CREAM, Bk = P) => { Bk.slab(x0, x1, 0, y1, z0, z1, col, { ao: false }); k.colSlab(x0, x1, 0, y1, z0, z1); };
    wall(-10.3, -10, -14, -9); wall(-10.3, -10, -5, 0); wall(-18.3, -18, -9, -5, 3.2, hex('#E9E5DD'));
    for (const z of [-9.3, -5]) wall(-18, -10, z, z + 0.3, 3.2, hex('#E9E5DD'));
    P.slab(-10.3, -10, 3.2, H, -9, -5, CREAM, { ao: false });
    wall(-10, 4, -14.3, -14); wall(8, 10, -14.3, -14); wall(10, 10.3, -14, 0);
    for (const s of [-1, 1]) { wall(s < 0 ? -10 : 7.5, s < 0 ? -7.5 : 10, -0.3, 0); wall(s < 0 ? -7.8 : 7.5, s < 0 ? -7.5 : 7.8, Z0, Z1); wall(s < 0 ? -10 : 7.5, s < 0 ? -7.5 : 10, Z1, Z1 + 0.3); }
    for (const s of [-1, 1]) wall(s < 0 ? -7.5 : 3.5, s < 0 ? -3.5 : 7.5, -0.12, 0.12, H);
    wall(-10.3, -10, Z1, 70, 9.6); wall(10, 10.3, Z1, 70, 9.6);
    // ---------- 南厅：楼梯上街（东） ----------
    k.stairs('z', -4, 0, -13, 3.9, 4, 8, -0.3, '#D9D4CA', { rails: true, railWall: true });
    floor(4, 8, -14, -13, hex('#D9D4CA')); P.slab(4, 8, 3.6, 3.9, -14, -13, hex('#D9D4CA'), { ao: false });
    wall(3.7, 4, -14, -4, 3.9 + 3); wall(8, 8.3, -14, -4, 3.9 + 3);
    G.slab(4, 8, 7.2, 7.3, -14, -4, hex('#FFF6E0'), { ao: false });      // 楼梯井顶：亮光（街上的天光）
    A.sign(6, 5.6, -3.98, 4, 1.0, a(0, 1), textPaint(['↑ 出站 · SM城市广场 门前广场', 'TO STREET · SM CITY PLAZA'], { bg: '#2E2A28', fg: '#F6D36B' }));
    // ---------- 南厅：西墙地铁通道 + 闸机 ----------
    for (const z of [-8.6, -7, -5.4]) { Mt.slab(-14.3, -13.1, 0, 1.0, z - 0.14, z + 0.14, STEEL, { ao: false }); k.colSlab(-14.3, -13.1, 0, 1.1, z - 0.15, z + 0.15); G.slab(-14.25, -14.1, 1.0, 1.05, z - 0.12, z + 0.12, hex('#4CD06A'), { ao: false }); }
    A.sign(-17.96, 1.9, -7, 3.8, 1.4, a(1, 0), textPaint(['地铁1号线 乌石浦站', 'XIAMEN METRO LINE 1 · WUSHIPU · 4A/4B'], { bg: '#E86B2A', fg: '#FFFFFF' }));
    A.sign(-9.98, 3.8, -7, 4, 0.9, a(1, 0), textPaint(['出闸入旺', 'METRO LINE 1 · WUSHIPU STATION'], { bg: '#B3261E', fg: '#F6D36B' }));
    // 北墙（南厅）：店铺指引 + 标语
    A.sign(-9.97, 2.0, -11, 3.0, 2.0, a(1, 0), directory);
    // ---------- 旺街大门（z 0）：红底金字门头 + 灯笼 ----------
    for (const s of [-1, 1]) { P.slab(s * 3.5 - 0.3, s * 3.5 + 0.3, 0, H, -0.3, 0.3, RED, { ao: false }); k.colSlab(s * 3.5 - 0.3, s * 3.5 + 0.3, 0, H, -0.3, 0.3); }
    P.slab(-3.8, 3.8, 3.3, H, -0.3, 0.3, RED, { ao: false });
    A.sign(0, 3.85, -0.32, 7.2, 1.0, a(0, -1), textPaint(['SM 旺街', 'WANG STREET · 出闸入旺'], { bg: '#B3261E', fg: '#F6D36B', frame: '#F6D36B' }));
    A.sign(0, 3.85, 0.32, 7.2, 1.0, a(0, 1), textPaint(['人旺财旺精神旺', 'WANG STREET'], { bg: '#B3261E', fg: '#F6D36B' }));
    // ---------- 两侧铺位 ----------
    this.shops = [];
    const uvY = A.draw(BAY - 0.3, 0.8, yanglou);   // 洋楼门头带：一张图，每个开间重复贴（省贴图集）
    const row = (list, s) => {
      let z = Z0;
      for (const sh of list) {
        const z0 = z, z1 = z + sh.n * BAY, zc = (z0 + z1) / 2, L = z1 - z0, xi = s * 3.5, xo = s * 7.5, an = a(-s, 0);
        z = z1; this.shops.push({ ws: sh.ws, zh: sh.zh, side: s, z0, z1 });
        wall(Math.min(s * 3.5, s * 7.5), Math.max(s * 3.5, s * 7.5), z1 - 0.12, z1 + 0.12);   // 分隔墙
        P.slab(Math.min(xi, xi + s * 0.15), Math.max(xi, xi + s * 0.15), 3.0, H, z0, z1, CREAM, { ao: false });   // 门头墙
        for (let j = 0; j < sh.n; j++) A.quad(xi - s * 0.01, 3.95, z0 + BAY * (j + 0.5), BAY - 0.3, 0.8, an, uvY);
        if (sh.kind === 'seat') {
          for (const dz of [-1.4, 1.4]) { P.cyl(s * 5.5, 0.72, zc + dz, 1.0, 0.06, WOOD, 10, 0, 0, 0, undefined, { ao: false }); P.cyl(s * 5.5, 0.36, zc + dz, 0.12, 0.72, DARK, 6, 0, 0, 0, undefined, { ao: false });
            for (const dx of [-0.8, 0.8]) P.box(s * 5.5 + dx, 0.23, zc + dz, 0.4, 0.46, 0.4, RED, 0, 0, 0, 1, { ao: false }); k.col(s * 5.5, 0.4, zc + dz, 2.2, 0.8, 1.1); }
          A.sign(xo - s * 0.02, 2.0, zc, 4, 1.6, a(-s, 0), textPaint(['呷旺饮旺家家旺', 'WANG STREET'], { bg: '#F1E6D2', fg: '#B3261E' }));
          continue;
        }
        if (sh.kind === 'hoard' || sh.kind === 'shut') {   // 围挡 / 卷闸：整面挡住
          P.slab(Math.min(xi, xi + s * 0.1), Math.max(xi, xi + s * 0.1), 0, 3.0, z0 + 0.12, z1 - 0.12, hex(sh.kind === 'hoard' ? '#C8443A' : '#BFC3C6'), { ao: false }); k.colSlab(Math.min(xi, xi + s * 0.15), Math.max(xi, xi + s * 0.15), 0, 3, z0, z1);
          if (sh.kind === 'hoard') { const uvH = A.draw(BAY - 0.4, 2.6, hoard); for (let j = 0; j < sh.n; j++) A.quad(xi - s * 0.02, 1.55, z0 + BAY * (j + 0.5), BAY - 0.4, 2.6, an, uvH); }
          else A.sign(xi - s * 0.02, 1.5, zc, L - 0.6, 2.4, an, (c, pw, ph) => { c.fillStyle = '#BFC3C6'; c.fillRect(0, 0, pw, ph); c.fillStyle = '#9AA1A8'; for (let y = 0; y < ph; y += ph / 16) c.fillRect(0, y, pw, ph / 64); textPaint(['待租', 'FOR LEASE · -1F-WS06'], { bg: 'rgba(0,0,0,0)', fg: '#5A5550' })(c, pw, ph); });
          A.sign(xi - s * 0.02, 3.3, zc, Math.min(L - 0.6, 4.8), 0.55, an, textPaint([sh.zh, `${sh.en} · -1F-${sh.ws.toUpperCase()}`], { bg: sh.bg, fg: sh.fg }));
          continue;
        }
        // 开着的铺：柜台 + 后墙灯箱菜单 + 门头招牌 + 暖光灯带
        P.slab(Math.min(s * 3.7, s * 4.4), Math.max(s * 3.7, s * 4.4), 0, 1.05, z0 + 0.4, z1 - 0.4, hex(sh.bg), { ao: false }); k.colSlab(Math.min(s * 3.6, s * 4.4), Math.max(s * 3.6, s * 4.4), 0, 1.1, z0, z1);
        P.slab(Math.min(s * 3.65, s * 4.45), Math.max(s * 3.65, s * 4.45), 1.05, 1.1, z0 + 0.35, z1 - 0.35, hex('#EDE7DC'), { ao: false });
        A.sign(xo - s * 0.02, 2.0, zc, L - 1, 1.6, a(-s, 0), menuWall(sh.kind));
        P.slab(Math.min(s * 6.2, s * 7.4), Math.max(s * 6.2, s * 7.4), 0, 0.9, z0 + 0.5, z1 - 0.5, hex('#B9B2A6'), { ao: false });
        A.sign(xi - s * 0.02, 3.3, zc, Math.min(L - 0.6, 4.8), 0.6, an, textPaint([sh.zh, `${sh.en} · -1F-${sh.ws.toUpperCase()}`], { bg: sh.bg, fg: sh.fg }));
        G.slab(Math.min(xi - s * 0.05, xi - s * 0.15), Math.max(xi - s * 0.05, xi - s * 0.15), 2.92, 3.0, z0 + 0.3, z1 - 0.3, hex('#FFD89A'), { ao: false });
        for (let j = 0; j < sh.n; j++) lowPerson(P, s * 5.3, 0, z0 + BAY * (j + 0.5), a(-s, 0), j + this.shops.length * 3);   // 店员
      }
    };
    row(WJ_WEST, -1); row(WJ_EAST, 1);
    // 顶上一串红灯笼（走廊中间，每 6 m 一对）
    for (let z = Z0 + 3; z < Z1; z += BAY) for (const x of [-1.6, 1.6]) { G.ellipsoid(x, 3.55, z, 0.55, 0.48, 0.55, hex('#E8402F'), 1); P.cyl(x, 3.85, z, 0.32, 0.08, GOLD, 6, 0, 0, 0, undefined, { ao: false }); P.cyl(x, 3.25, z, 0.32, 0.08, GOLD, 6, 0, 0, 0, undefined, { ao: false }); Mt.tube([x, 3.9, z], [x, H, z], 0.02, DARK, 3); }
    // 横幅两面都印字（单面会从背后看到镜像字）；同一张贴图正反各贴一次
    for (let z = Z0 + 6; z < Z1; z += 12) { const uvB = A.draw(5.6, 0.55, textPaint([z % 24 === 6 ? 'HO! 上街去' : '人旺财旺精神旺 · 呷旺饮旺家家旺'], { bg: '#B3261E', fg: '#F6D36B' }));
      A.quad(0, 3.9, z - 0.02, 5.6, 0.55, a(0, -1), uvB); A.quad(0, 3.9, z + 0.02, 5.6, 0.55, a(0, 1), uvB); }
    // ---------- 北厅：扶梯 + 楼梯上 1F，北面玻璃墙后是一期 B1 ----------
    escalator(k, [5.6, 0, 57], [5.6, UP, 66.5], 1.1, true);
    k.stairs('z', 57, 0, 66.5, UP, 1.6, 4.2, -0.3, '#D9D4CA', { rails: true });
    P.slab(0.8, 10, UP - 0.3, UP, 66.5, 70, hex('#E9E5DD'), { ao: false }); k.colSlab(0.8, 10, UP - 0.3, UP, 66.5, 70);
    Mt.slab(0.75, 0.85, UP - 0.3, UP + 1.1, 66.5, 70, STEEL, { ao: false }); k.colSlab(0.7, 0.9, UP - 0.3, UP + 1.1, 66.5, 70);
    wall(0.8, 10, 70, 70.3, 9.6); A.sign(5.4, UP + 2.0, 69.98, 7.5, 1.4, a(0, -1), textPaint(['SM城市广场 一期 1F', 'SM CITY · LEVEL 1  →'], { bg: '#1D4E89', fg: '#FFFFFF' }));
    G.slab(3.6, 7.2, UP + 0.02, UP + 2.8, 69.92, 69.98, hex('#FFF6E0'), { ao: false });   // 1F 门洞（亮）
    GL.slab(-10, 0.8, 0, 3.6, 69.9, 70, hex('#D6EEF8'), { ao: false }); k.colSlab(-10, 0.8, 0, 3.6, 69.85, 70.05);
    P.slab(-10, 0.8, 3.6, 9.6, 70, 70.3, CREAM, { ao: false });
    A.sign(-4.6, 1.8, 70.2, 10.6, 3.4, a(0, -1), b1Beyond);
    A.sign(-4.6, 4.5, 69.85, 8, 0.9, a(0, -1), textPaint(['SM城市广场 一期 B1', 'WALMART · B1 FOOD'], { bg: '#1D4E89', fg: '#FFFFFF' }));
    A.sign(-9.97, 4.5, 62, 7, 2.4, a(1, 0), textPaint(['SM 旺街', '首条地铁直达商场的街区 · 1400 m²'], { bg: '#B3261E', fg: '#F6D36B', frame: '#F6D36B' }));
    // ---------- 人 ----------
    const crowd = [[-1.5, -6, 0.3], [2.5, -9, 2.4], [-5, -3, 1.2], [1.2, 5, 0], [-1.8, 11, 3.1], [2, 16, 0.2], [-2.4, 21, 1.4], [1.6, 27, 3.0], [-0.8, 33, 0.1],
      [2.4, 38, 2.8], [-2, 44, 0.3], [1, 49, 3.2], [-4, 59, 0.5], [-6.5, 64, 2.5], [5.6, 61, 0]];
    crowd.forEach(([x, z, r], i) => shopper(P, x, 0, z, r, i, { lo: i > 4 }));
    // 站在铺前点单的人：大门口那位细模，街里两位低模（i 取 %3 = 2 → lowPerson 站姿；省 ~5k 三角形）
    for (const [x, z, i, lo] of [[-1.4, 3.5, 43, false], [1.4, 30, 50, true], [-1.4, 46, 86, true]]) shopper(P, x, 0, z, Math.PI / 2 * (x < 0 ? 1 : -1), i, { stand: true, lo });
    k.shade.shadeRoom(-7.5, 7.5, Z0, Z1, 0.02, 0.6, 0.18);
    k.finish(true); A.finish(k.root, 'smWangJieSigns');
  }
  floorOf() { return -1; }
  update() {}
  /** 出口：楼梯顶 → 'main'（街上）；西边闸机外 → 'back'（地铁站）；1F 平台北头 → 进 SM 一期 */
  wantsOut(p) {
    const lx = p.x - this.o.x, lz = p.z - this.o.z, ly = p.y - this.o.y;
    if (lz < -11.8 && lx > 3.5 && lx < 8.5 && ly > 2.8) return 'main';
    if (lx < -15.6 && Math.abs(lz + 7) < 2.2 && ly < 1.5) return 'back';
    if (lz > 68.6 && lx > 0.8 && ly > UP - 1) return { enter: 'sm-city' };
    return null;
  }
  spawn(gate = this.o.gate || 'main') {
    const o = this.o;
    if (gate === 'metro') return [o.x - 12, o.y + 0.05, o.z - 7, Math.PI / 2];
    return [o.x + 6, o.y + 0.05, o.z - 2.6, 0];
  }
  zoneOf() { return { kind: 'interior', net: 'xm', building: this.id, floor: -1, inUnit: false }; }
  info() { return { id: this.id, shops: this.shops, gates: ['main', 'back', 'p1'], overflow: this.atlas.overflow, atlasY: this.atlas.y }; }
  dispose() { this.atlas.dispose(); this.kit.root.getChildMeshes(false).forEach(m => m.dispose()); this.kit.root.dispose(); }
}
