/*
 * 乌石浦站 4B 出口：厦门 SM 城市广场（SM 厦门综合体）。
 *   一期 SM城市广场（嘉禾路468号，嘉禾路东、仙岳路北，2001-12 开业）：浅色大方盒子 + SM 圆标 + 沃尔玛蓝招牌；
 *   二期 SM新生活广场（嘉禾路399号，嘉禾路西，Arquitectonica 设计）：红宝石（长条）+ 黄宝石（圆楼）+ 蓝宝石（方楼，万达影城）；
 *   SM 天桥（2013-09-26 通行）：94 m 横跨嘉禾路连一期 / 二期，白钢架 + 落地玻璃 + 瓷砖地，两头楼梯 + 扶梯；
 *   第二座过街天桥：一期 ↔ 三期（嘉禾路401号，在二期北侧）。
 * 资料与出入口核对见 /workspace/xmlogs/sm/research.md（PR 描述里有摘要）。
 * 坐标同 xmStreet：出口亭（4B）在原点、开口朝 +z（北）；+x = 东。仙岳路 z −40..−14（东西向，带高架），嘉禾路 x −46..−14（南北向）。
 * 室内：五栋楼（一期 / 红宝石 / 黄宝石 / 蓝宝石 / 三期）都能进，单独加载 SmMall（xmSMMall.js）；SM 天桥两头的 2F 玻璃门直接进楼内 2F。
 */
import { Geo, hex } from '../core/geo.js';
import * as D from './decor.js';
import { Kit, bucketMat } from './kit.js';
import { FoodAtlas } from '../game/food-art.js';
import { textPaint, FONT, FONT_EN } from './xmStreet.js';
import { ringCol } from './xmAttr.js';
import { SmMall } from './xmSMMall.js';
import { bakePerson, randomLook, archetypeLook, preseed, prnd, POSES } from './people.js';

const TAU = Math.PI * 2;
export const SM_NAVY = '#1F3B73', SM_SKY = '#A9D3F0';
/** 走路姿势（一条腿迈出、手臂前后摆） */
const WALK = { 7: [-0.35, 0, 0.04], 8: [0.3, 0, -0.04], 10: [0.45, 0, 0], 3: [0.3, 0, 0.08], 4: [-0.3, 0, -0.08], 5: [-0.2, 0, 0], 6: [-0.3, 0, 0] };
const PHONE = { 3: [0, 0, 0.08], 4: [-0.35, 0, -0.15], 5: [-0.15, 0, 0], 6: [-1.5, 0.3, 0], 2: [0.35, 0, 0] };
const BAGS = ['#1F3B73', '#F4F4F2', '#C8102E', '#C9A97A', '#2B2B2B', '#E9C46A', '#5BA4D8'];
/** 街面 atlas（xmStreet 包过一层）：法线 (nx,nz) → a */
const aS = (nx, nz) => Math.atan2(nx, -nz);

/* ---------------- 画法 ---------------- */
/** SM 圆标：浅蓝竖牌 + 白圆 + 深蓝圈 + 深蓝 SM */
export function smLogo(c, pw, ph, { bg = SM_SKY, label = null } = {}) {
  c.fillStyle = bg; c.fillRect(0, 0, pw, ph);
  const r = Math.min(pw, ph) * 0.4, cx = pw / 2, cy = label ? ph * 0.42 : ph / 2;
  c.fillStyle = '#FFFFFF'; c.beginPath(); c.arc(cx, cy, r, 0, TAU); c.fill();
  c.strokeStyle = SM_NAVY; c.lineWidth = r * 0.13; c.beginPath(); c.arc(cx, cy, r * 0.9, 0, TAU); c.stroke();
  c.fillStyle = SM_NAVY; c.textAlign = 'center'; c.textBaseline = 'middle'; c.font = `italic 900 ${r * 0.95}px ${FONT_EN}`; c.fillText('SM', cx, cy + r * 0.05);
  if (label) { c.font = `800 ${Math.min(pw * 0.8 / label.length, ph * 0.12)}px ${FONT}`; c.fillText(label, cx, ph * 0.86); }
}
/** 一期 SM CITY 竖向灯箱（照实拍）：浅蓝底，白圆 + 深蓝圈 + 深蓝 SM（白内线），下方深蓝 CITY / 福建厦门 */
export function smCityPanel(c, pw, ph) {
  const g = c.createLinearGradient(0, 0, pw, 0); g.addColorStop(0, '#86BCE2'); g.addColorStop(0.5, '#9CCBEA'); g.addColorStop(1, '#86BCE2');
  c.fillStyle = g; c.fillRect(0, 0, pw, ph); c.strokeStyle = '#6FA8D4'; c.lineWidth = pw * 0.025; c.strokeRect(0, 0, pw, ph);
  const cx = pw / 2, cy = ph * 0.3, r = pw * 0.4;
  c.fillStyle = '#F2F4F6'; c.beginPath(); c.arc(cx, cy, r, 0, TAU); c.fill();
  c.strokeStyle = SM_NAVY; c.lineWidth = r * 0.1; c.beginPath(); c.arc(cx, cy, r * 0.94, 0, TAU); c.stroke();
  c.textAlign = 'center'; c.textBaseline = 'middle'; c.font = `500 ${r * 1.0}px ${FONT_EN}`; c.lineJoin = 'round';
  c.save(); c.translate(cx, cy + r * 0.06); c.scale(0.85, 1.2);   // 粗深蓝笔画 + 细白芯 ≈ 实拍里的白色内线
  c.strokeStyle = SM_NAVY; c.lineWidth = r * 0.2; c.strokeText('SM', 0, 0); c.fillStyle = '#FFFFFF'; c.fillText('SM', 0, 0); c.restore();
  c.fillStyle = SM_NAVY; c.font = `900 ${pw * 0.3}px ${FONT_EN}`; c.fillText('CITY', cx, ph * 0.66);
  c.font = `800 ${pw * 0.15}px ${FONT}`; c.fillText('福建厦门', cx, ph * 0.79);
}
/** 一期外墙：浅灰白面砖 + 竖向凹槽 + 楼层线 */
function wallP1(c, pw, ph) {
  c.fillStyle = '#E3E1DB'; c.fillRect(0, 0, pw, ph);
  c.strokeStyle = 'rgba(120,120,120,0.16)'; c.lineWidth = 1;
  const t = Math.max(3, pw / 28);
  for (let y = 0; y < ph; y += t) { c.beginPath(); c.moveTo(0, y); c.lineTo(pw, y); c.stroke(); }
  for (let x = 0; x < pw; x += t * 2) { c.beginPath(); c.moveTo(x, 0); c.lineTo(x, ph); c.stroke(); }
  c.fillStyle = 'rgba(150,152,156,0.35)'; for (let i = 1; i < 4; i++) c.fillRect(pw * i / 4 - 2, 0, 4, ph);
  c.fillStyle = 'rgba(160,160,160,0.25)'; for (let i = 1; i < 5; i++) c.fillRect(0, ph * i / 5, pw, 3);
}
/** 彩色金属钻石板（二期三颗「宝石」的主立面：整面是金属色，不是白墙加色框）；c0 底色、c1 亮面、c2 暗面、seam 板缝 */
function metalDiamond(c0, c1, c2, seam) {
  return (c, pw, ph) => {
    c.fillStyle = c0; c.fillRect(0, 0, pw, ph);
    const s = pw / 4, hs = s * 0.75;
    for (let row = -1; row * hs < ph + hs; row++) for (let col = -1; col * s < pw + s; col++) {
      const x = col * s + (row % 2 ? s / 2 : 0), y = row * hs;
      // 每块菱形上亮下暗（金属折板的受光），隔几块换一档，远看有闪光感
      const g = c.createLinearGradient(x, y - hs, x, y + hs), t = (row * 3 + col * 5) % 4;
      g.addColorStop(0, t === 0 ? c1 : c0); g.addColorStop(1, t === 2 ? c2 : c0);
      c.beginPath(); c.moveTo(x, y - hs); c.lineTo(x + s / 2, y); c.lineTo(x, y + hs); c.lineTo(x - s / 2, y); c.closePath();
      c.fillStyle = g; c.fill(); c.strokeStyle = seam; c.lineWidth = Math.max(1.5, s * 0.035); c.stroke();
    }
  };
}
/** 玻璃幕墙（竖梃 + 横梃） */
function curtain(tint = '#8FB3C8') {
  return (c, pw, ph) => {
    const g = c.createLinearGradient(0, 0, 0, ph); g.addColorStop(0, '#CFE3EE'); g.addColorStop(1, tint); c.fillStyle = g; c.fillRect(0, 0, pw, ph);
    c.fillStyle = '#E9EDF0'; const n = 8; for (let i = 0; i <= n; i++) c.fillRect(pw * i / n - 2, 0, 4, ph);
    for (let i = 0; i <= 6; i++) c.fillRect(0, ph * i / 6 - 2, pw, 3);
  };
}
/** 底层店面：暖光橱窗 + 竖梃 + 几个模特 / 货架剪影 */
export function storefront(warm = '#F6E3C0') {
  return (c, pw, ph) => {
    c.fillStyle = '#3A3F45'; c.fillRect(0, 0, pw, ph);
    const g = c.createLinearGradient(0, 0, 0, ph); g.addColorStop(0, '#FFF7E6'); g.addColorStop(1, warm); c.fillStyle = g; c.fillRect(pw * 0.02, ph * 0.08, pw * 0.96, ph * 0.9);
    c.fillStyle = 'rgba(60,50,40,0.35)';
    for (let i = 0; i < 5; i++) { const x = pw * (0.1 + i * 0.19); c.fillRect(x, ph * 0.45, pw * 0.05, ph * 0.5); c.beginPath(); c.arc(x + pw * 0.025, ph * 0.4, pw * 0.022, 0, TAU); c.fill(); }
    c.fillStyle = '#5A6068'; for (let i = 0; i <= 4; i++) c.fillRect(pw * i / 4 - 3, 0, 6, ph);
  };
}
const sign = (bg, fg, sub = null, opt = {}) => (name) => textPaint(sub ? [name, sub] : [name], { bg, fg, ...opt });
const BRANDS = {
  '麦当劳': ['#DA291C', '#FFC72C'], '屈臣氏': ['#00A499', '#FFFFFF'], 'KFC 肯德基': ['#C8102E', '#FFFFFF'], '面包新语': ['#F08A24', '#FFFFFF'],
  'SM百货': [SM_NAVY, '#FFFFFF'], 'ZARA': ['#111111', '#FFFFFF'], 'MUJI 无印良品': ['#7F0019', '#FFFFFF'], 'SWAROVSKI': ['#FFFFFF', '#1A1A1A'],
  'SEPHORA': ['#000000', '#FFFFFF'], 'Massimo Dutti': ['#2A2A2A', '#E9E2D4'], '例外': ['#2B2B2B', '#F1E9DA'], '西贝莜面村': ['#C8102E', '#FFFFFF'],
  '花潮': ['#2E7D5B', '#FFFFFF'], 'ESPRIT': ['#D61F26', '#FFFFFF'], '优衣库': ['#E50010', '#FFFFFF'], '星巴克': ['#00704A', '#FFFFFF'],
  '海底捞': ['#B8001F', '#FFFFFF'], '喜茶': ['#1A1A1A', '#FFFFFF'], 'H&M': ['#E50010', '#FFFFFF'], '名创优品': ['#E60012', '#FFFFFF'],
  '玩具反斗城': ['#1D4F91', '#FFDD00'], '万达影城': ['#B8001F', '#F4D9A0'], '数码广场': ['#2E6FB5', '#FFFFFF'], '美食广场': ['#E86A1E', '#FFFFFF'],
  '家居生活': ['#5B7F64', '#FFFFFF'], '沃尔玛 B1': ['#0071CE', '#FFFFFF'], 'Apple 授权店': ['#F2F2F2', '#222222'], 'NIKE': ['#111111', '#FFFFFF'],
  '泡泡玛特': ['#E8306B', '#FFFFFF'], '巴拉巴拉 童装': ['#F3B71A', '#1F3B73'], '周大福': ['#B3001B', '#F7D57A'], '无印咖啡': ['#6B4C3B', '#FFFFFF'],
};
export const brandPaint = n => { const [bg, fg] = BRANDS[n] || ['#2B2F35', '#FFFFFF']; return textPaint([n], { bg, fg }); };

/* ---------------- 小工具 ---------------- */
/** 街面底层店面（一 / 二 / 三期共用一张） */
const shopUv = S => S._smShop || (S._smShop = S.atlas.draw(12, 4.6, storefront(), 26));
/** 竖直四边形：p0→p1（水平端点 [x,z]），法线朝 (ez, −ex) 一侧 */
export function wallQ(B, p0, p1, y0, y1, col) { B.quad([p0[0], y0, p0[1]], [p1[0], y0, p1[1]], [p1[0], y1, p1[1]], [p0[0], y1, p0[1]], col); }
/** 水平四边形（朝上 up=true / 朝下），四点按 [x,z] 给 */
export function flatQ(B, pts, y, col, up = true) {
  const P = pts.map(p => [p[0], y, p[1]]);
  // 先算这一圈的朝向，保证法线朝上 / 朝下
  const cr = (P[1][0] - P[0][0]) * (P[3][2] - P[0][2]) - (P[1][2] - P[0][2]) * (P[3][0] - P[0][0]);
  const ordered = (cr > 0) === up ? P : [P[0], P[3], P[2], P[1]];
  B.quad(ordered[0], ordered[1], ordered[2], ordered[3], col);
}
/** 沿一面墙铺同一张贴图（seg 米一块） */
function tileFace(A, uv, axis, fixed, a0, a1, y0, y1, nrm, seg) {
  const n = Math.max(1, Math.round((a1 - a0) / seg)), w = (a1 - a0) / n;
  for (let i = 0; i < n; i++) {
    const c = a0 + w * (i + 0.5);
    if (axis === 'x') A.quad(c, (y0 + y1) / 2, fixed + nrm * 0.03, w, y1 - y0, aS(0, nrm), uv);
    else A.quad(fixed + nrm * 0.03, (y0 + y1) / 2, c, w, y1 - y0, aS(nrm, 0), uv);
  }
}
/** 远处 / 楼上的人：低模（~150 三角形；裤腿、上身、手臂、头、头发、购物袋），走路时腿前后分开 */
const SHIRTS = ['#E8E4DA', '#2F4E7A', '#C8443A', '#F2C14E', '#4E8F6A', '#7A5C9E', '#F28BA8', '#5B6670', '#FFFFFF', '#E07A3A'];
const PANTS = ['#2B3036', '#3A4A66', '#5B4A3A', '#1F2226', '#6A7580', '#C9B99A'];
export function lowPerson(P, x, y, z, ry, i, kid = false) {
  const h = kid ? 0.62 : 1, sx = Math.cos(ry), sz = -Math.sin(ry), fx = Math.sin(ry), fz = Math.cos(ry);
  const shirt = hex(SHIRTS[(i * 7 + 3) % SHIRTS.length]), pant = hex(PANTS[(i * 5 + 1) % PANTS.length]), skin = hex(['#E8C29E', '#D9AE86', '#F0CFAE'][i % 3]), hair = hex(['#1E1A18', '#2B2420', '#4A3426'][i % 3]);
  const walk = i % 3 !== 2, st = walk ? 0.32 : 0;
  for (const s of [-1, 1]) P.box(x + sx * 0.09 * s * h, y + 0.42 * h, z + sz * 0.09 * s * h, 0.15 * h, 0.84 * h, 0.16 * h, pant, ry, st * s, 0, 1, { ao: false });
  P.box(x, y + 1.13 * h, z, 0.42 * h, 0.62 * h, 0.24 * h, shirt, ry, 0, 0, 1, { ao: false });
  for (const s of [-1, 1]) P.box(x + sx * 0.27 * s * h, y + 1.1 * h, z + sz * 0.27 * s * h, 0.1 * h, 0.58 * h, 0.11 * h, shirt, ry, -st * s * 0.8, 0, 1, { ao: false });
  P.sphere(x, y + 1.6 * h, z, 0.25 * h, skin, 1); P.sphere(x - fx * 0.03 * h, y + 1.66 * h, z - fz * 0.03 * h, 0.25 * h, hair, 1, 0.75);
  if (!kid && i % 2 === 0) P.box(x + sx * 0.33, y + 0.68, z + sz * 0.33, 0.12, 0.34, 0.3, hex(BAGS[i % BAGS.length]), ry, 0, 0, 1, { ao: false });
}
/** 逛街的人：成人多数拎购物袋，偶尔带小孩 / 看手机 */
export function shopper(P, x, y, z, ry, i, o = {}) {
  if (o.lo) return lowPerson(P, x, y, z, ry, i, o.kid || i % 5 === 2);
  const r = prnd();
  if (o.kid || i % 6 === 2) return bakePerson(P, x, y, z, ry, randomLook({ kid: true, scale: 0.92, bag: r < 0.4 ? 'backpack' : null }), r < 0.5 ? WALK : POSES.stand);
  if (i % 9 === 4) return bakePerson(P, x, y, z, ry, archetypeLook('granny'), POSES.stand);
  const bags = r < 0.65 ? [BAGS[(i * 3) % BAGS.length], r < 0.3 ? BAGS[(i * 5 + 1) % BAGS.length] : null] : null;
  const phone = !bags && r > 0.85;
  return bakePerson(P, x, y, z, ry, randomLook({ shopBags: bags, bag: bags ? null : (r > 0.75 ? 'shoulder' : null), phone }), phone ? PHONE : (o.stand ? POSES.stand : WALK));
}
/** 一家人：大人 + 小孩（并排走） */
export function family(P, x, y, z, ry, i, lo = false) {
  const sx = Math.cos(ry), sz = -Math.sin(ry);
  shopper(P, x, y, z, ry, i * 7 + 1, { lo });
  if (lo) lowPerson(P, x + sx * 0.75, y, z + sz * 0.75, ry, i, true); else bakePerson(P, x + sx * 0.75, y, z + sz * 0.75, ry, randomLook({ kid: true, scale: 0.9, bag: 'backpack' }), WALK);
}

/**
 * 自动扶梯（可选可走）：a → b 底 / 顶中点 [x,y,z]，w 梯级宽。
 * 银色桁架 + 深色梯级带（细横纹）+ 两侧玻璃栏板 + 黑扶手 + 上下梳齿板；walk 时沿 z 向加坡道碰撞（不放台阶）。
 */
export function escalator(k, a, b, w = 1.1, walk = false, o = {}) {
  const P = k.solid, Mt = k.metal, GL = k.glass;
  const dx = b[0] - a[0], dz = b[2] - a[2], dy = b[1] - a[1], H = Math.hypot(dx, dz), L = Math.hypot(H, dy);
  const ux = dx / H, uz = dz / H, sx = uz, sz = -ux, ry = Math.atan2(dx, dz), rx = -Math.atan2(dy, H);
  const m = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2], steel = hex('#C3C9CF'), dark = hex('#2B3036'), ink = hex('#1E2226');
  const th = o.th || 0.95;
  P.box(m[0], m[1] - th / 2 - 0.03, m[2], w + 0.36, th, L + 0.5, hex(o.under || '#E6E8EA'), ry, rx, 0, 1, { ao: false });
  if (o.belly) P.box(m[0], m[1] - th - 0.05, m[2], w + 0.2, 0.04, L + 0.3, hex(o.belly), ry, rx, 0, 1, { ao: false });   // 桁架底面深色条
  P.box(m[0], m[1] + 0.0, m[2], w, 0.05, L, dark, ry, rx, 0, 1, { ao: false });
  const nR = Math.floor(L / 0.7);
  for (let i = 1; i < nR; i++) { const t = i / nR; P.box(a[0] + dx * t, a[1] + dy * t + 0.03, a[2] + dz * t, w * 0.94, 0.012, 0.05, hex('#8A9199'), ry, rx, 0, 1, { ao: false }); }
  for (const [p, s] of [[a, -1], [b, 1]]) Mt.box(p[0] + ux * 0.6 * s, p[1] + 0.012, p[2] + uz * 0.6 * s, w + 0.3, 0.025, 1.2, steel, ry, 0, 0, 1, { ao: false });
  const off = w / 2 + 0.08;
  for (const s of [-1, 1]) {
    const ox = sx * off * s, oz = sz * off * s;
    GL.box(m[0] + ox, m[1] + 0.55, m[2] + oz, 0.03, 0.9, L, hex('#DDEFF7'), ry, rx, 0);
    const pts = [[a[0] - ux * 0.9 + ox, a[1] + 1.0, a[2] - uz * 0.9 + oz], [a[0] + ox, a[1] + 1.0, a[2] + oz], [b[0] + ox, b[1] + 1.0, b[2] + oz], [b[0] + ux * 0.9 + ox, b[1] + 1.0, b[2] + uz * 0.9 + oz]];
    for (let i = 0; i < 3; i++) P.tube(pts[i], pts[i + 1], 0.09, ink, 6);
    for (const p of [pts[0], pts[3]]) Mt.slab(p[0] - 0.05, p[0] + 0.05, p[1] - 1.0, p[1], p[2] - 0.05, p[2] + 0.05, steel, { ao: false });
    if (walk) k.col(m[0] + ox, m[1] + 0.7, m[2] + oz, 0.12, 1.4, L, { ry, rx });
  }
  if (walk) k.stairs('z', a[2], a[1], b[2], b[1], a[0] - w / 2, a[0] + w / 2, Math.min(a[1], b[1]), '#2B3036', { steps: false, rails: false });
}

/* ====================== 街面 ====================== */
const P1 = { x0: 16, x1: 86, z0: 22, z1: 160, h: 28 };          // 一期
const RUBY = { x0: -150, x1: -78, z0: 8, z1: 50, h: 24 };       // 二期 红宝石
const LINK = { x0: -110, x1: -78, z0: 50, z1: 72, h: 22 };      // 二期 玻璃连接中庭
const TOPAZ = { cx: -102, cz: 96, r: 24, h: 26 };                // 二期 黄宝石（圆）
const SAPH = { x0: -158, x1: -130, z0: 58, z1: 120, h: 32 };     // 二期 蓝宝石（方）
const P3 = { x0: -150, x1: -60, z0: 128, z1: 196, h: 23 };      // 三期（嘉禾路401，二期北侧；环评：4 层裙楼 23 m）
const HOTEL = { x0: -140, x1: -112, z0: 150, z1: 186, h: 78 };   // 三期 voco 酒店塔楼（环评：18 层 77.9 m）
const BR1 = { x0: -78, x1: P1.x0, z0: 60, z1: 66, y: 6 };        // SM 天桥（一期 ↔ 二期，94 m）
const BR2 = { x0: P3.x1, x1: P1.x0, z0: 140, z1: 146, y: 6 };    // 第二座过街天桥（一期 ↔ 三期）

export function smCity(S) {
  const k = S.kit, P = k.solid, A = S.atlas, G = k.glow, GL = k.glass, GR = k.g('granite');
  preseed(4040);
  // ---------- 路 ----------
  S.road(-160, 160, -40, -14, true, '仙岳路');
  S.road(-46, -14, -14, 200, false, '嘉禾路'); S.road(-46, -14, -60, -40, false, null);
  S.roadSign(-12.6, 112, '嘉禾路', Math.PI / 2);
  for (let x = -45; x < -15; x += 1.2) P.slab(x, x + 0.6, 0.012, 0.017, -12.5, -8.5, hex('#F2F2F2'), { ao: false });   // 斑马线（嘉禾路过仙岳路口北侧）
  for (let z = -38.5; z < -15.5; z += 1.2) P.slab(-11.5, -7.5, 0.012, 0.017, z, z + 0.6, hex('#F2F2F2'), { ao: false });
  D.hedge(k, -30.5, -29.5, -8, 52); D.hedge(k, -30.5, -29.5, 74, 132); D.hedge(k, -30.5, -29.5, 154, 199);   // 嘉禾路中央绿化带（天桥下断开）
  // 仙岳路高架（东西向，桥面 y≈9.8）
  P.slab(-160, 160, 8.6, 9.8, -36, -18, hex('#C9C6BF'), { ao: false });
  for (const z of [-36, -18.4]) P.slab(-160, 160, 9.8, 10.9, z, z + 0.4, hex('#D9D6CF'), { ao: false });
  k.g('band').slab(-160, 160, 8.5, 8.7, -36.1, -35.9, hex('#3D7FC4'), { ao: false });
  for (const x of [-150, -110, -70, 10, 50, 90, 130]) { P.slab(x - 1.2, x + 1.2, 0, 8.6, -28.6, -25.4, hex('#BDB9B1'), { ao: false }); P.slab(x - 1.5, x + 1.5, 7.6, 8.6, -34, -20, hex('#C4C0B8'), { ao: false }); k.colSlab(x - 1.2, x + 1.2, 0, 8.6, -28.6, -25.4); }
  // 广场铺地
  GR.slab(-78, -46, 0.004, 0.03, -14, 128, hex('#CFC8BB'), { ao: false });
  GR.slab(-14, P1.x0, 0.004, 0.03, -14, 200, hex('#D3CCC0'), { ao: false });

  phase1(S);
  skybridge(S, BR1, [[-66.2, -59.6], [1.8, 8.6]], [-52, -8], '厦门SM城市广场  ⇄  SM新生活广场', 'SM SKYBRIDGE  ·  94 m');
  bridgeStairs(S, 2, 45, BR1.z0, true); bridgeStairs(S, -66, 45, BR1.z0, true);
  skybridge(S, BR2, [[-58.2, -53.8], [1.8, 8.6]], [-30], 'SM城市广场 ⇄ SM三期', 'SM CITY  ·  PHASE III');
  bridgeStairs(S, 2, 125, BR2.z0, true); bridgeStairs(S, -58, 125, BR2.z0, false);

  // ---------- 公交站「SM城市广场」（嘉禾路东侧人行道） ----------
  const bx0 = -12.6, bz0 = 84, bz1 = 96;
  k.metal.slab(bx0, bx0 + 3, 2.7, 2.85, bz0, bz1, hex('#AEB6BD'), { ao: false });
  for (const z of [bz0 + 0.3, bz1 - 0.3]) for (const x of [bx0 + 0.2, bx0 + 2.8]) k.metal.cyl(x, 1.35, z, 0.12, 2.7, hex('#8A9198'), 6);
  GL.slab(bx0 + 2.75, bx0 + 2.8, 0.3, 2.6, bz0 + 0.4, bz1 - 0.4, hex('#D6EEF8'), { ao: false }); k.colSlab(bx0 + 2.7, bx0 + 2.85, 0, 2.6, bz0, bz1);
  P.slab(bx0 + 1.9, bx0 + 2.4, 0.45, 0.5, bz0 + 1, bz1 - 1, hex('#C9CED3'), { ao: false });
  A.quad(bx0 + 1.5, 3.25, (bz0 + bz1) / 2, 9, 0.75, aS(-1, 0), A.draw(9, 0.75, textPaint(['SM城市广场', 'SM City Plaza · Bus'], { bg: '#1F5FA8', fg: '#FFFFFF' }), 50));
  A.quad(bx0 + 2.7, 1.6, bz0 + 2.5, 1.8, 2.2, aS(-1, 0), A.draw(1.8, 2.2, (c, pw, ph) => { c.fillStyle = '#F4F6F8'; c.fillRect(0, 0, pw, ph); c.fillStyle = '#1F5FA8'; c.fillRect(0, 0, pw, ph * 0.16);
    c.fillStyle = '#FFF'; c.font = `800 ${ph * 0.09}px ${FONT}`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('SM城市广场 站', pw / 2, ph * 0.08);
    c.fillStyle = '#1B2530'; c.font = `700 ${ph * 0.075}px ${FONT}`; ['2路', '23路', '27路', '31路', '43路', 'BRT 接驳', '...'].forEach((t, i) => c.fillText(t, pw / 2, ph * (0.26 + i * 0.1))); }));
  for (let i = 0; i < 4; i++) shopper(P, bx0 + 1.2 + (i % 2) * 0.5, 0, bz0 + 2 + i * 2.2, -Math.PI / 2 + (i - 1.5) * 0.3, i + 20, { lo: true });
  bakePerson(P, bx0 + 2.1, 0.5 - 0.86 + 0.0, bz0 + 7, -Math.PI / 2, randomLook({ bag: 'shoulder' }), POSES.sit);

  // ---------- 行道树 + 路灯 ----------
  const skipTree = z => (z > 52 && z < 74) || (z > 132 && z < 154) || (z > 80 && z < 100);
  for (let z = 6; z < 198; z += 13) if (!skipTree(z)) { S.lightTree(-10.4, z, 0.8); if (z < 124) S.lightTree(-50, z, 0.8); }
  for (const z of [10, 40, 110, 170]) { D.lamp(k, -14.8, 0, z, Math.PI / 2); D.lamp(k, -45.2, 0, z, -Math.PI / 2); }
  for (let x = -150; x < 160; x += 22) if (x < -50 || x > -8) S.lightTree(x, -11.2, 0.75);

  // ---------- 远景（仙岳路南侧、北侧）----------
  S.filler([[-110, -52, 50, 14, 46, '#D2CABE'], [-70, -50, 22, 14, 70, '#C9C2B6'], [30, -52, 60, 14, 58, '#CBC5BA'], [110, -50, 50, 14, 40, '#D6D0C6'],
    [130, 180, 50, 30, 40, '#C6CCD2']]);   // 一期北侧原来的远景楼 = 四期 4C 工地，东侧 = 四期 B 地块（phase4）

  // ---------- 人：出口、一期门口、天桥下、二期广场 ----------
  const crowd = [
    [3, 6, 0.3], [-1.5, 9, 0.1], [6, 12, 0.8], [10, 15, 0.6], [14, 10, -0.4], [22, 14, 0.2], [30, 17, 1.2], [46, 18, -0.3], [55, 17, 0.4], [60, 15, 2.8],
    [70, 16, -1.6], [-6, 30, 0.05], [-8, 52, 3.1], [-4, 76, 0.2], [-7, 104, 3.0], [-60, 30, 0.4], [-56, 80, 2.9], [-70, 100, 1.6], [-62, 16, -0.4], [-52, 120, 0.2],
  ];
  crowd.forEach(([x, z, r], i) => shopper(P, x, 0, z, r, i, { lo: i >= 5 }));   // 出口近处用细模，远处低模（四期要省三角形）
  family(P, 34, 12, Math.PI * 0.95, 1); family(P, -64, 60 - 18, Math.PI, 2, true); family(P, -9, 40, 0.1, 3, true);
  for (let i = 0; i < 8; i++) shopper(P, -70 + i * 10 + (i % 2) * 2, BR1.y, BR1.z0 + 1.6 + (i % 3) * 1.4, i % 2 ? Math.PI / 2 : -Math.PI / 2, i + 40, { lo: true });   // 天桥上：低模
  for (let i = 0; i < 3; i++) shopper(P, -40 + i * 22, BR2.y, BR2.z0 + 2 + i, i % 2 ? Math.PI / 2 : -Math.PI / 2, i + 50, { lo: true });

  traffic(S);
  // ---------- 分组（视锥裁剪用）：每组单独几个网格，看不见的那组整组不画 ----------
  //   sm-core = 路 / 一期 / 天桥 / 人 / 树（到处都看得见）；sm-west = 二期 + 三期（嘉禾路西）；剩下 = 四期（兴山路东 + 一期北侧 4C）
  k.group('sm-core');
  phase2(S); phase3(S);
  k.group('sm-west');
  phase4(S);
  // ---------- 进门 ----------
  // 每栋楼都能进：地面正门 + 天桥两头的 2F 玻璃门（y: 6，进楼内 2F；gate = 楼里对应的那扇门）
  const mall = id => (scene, o) => new SmMall(scene, o, id);
  S.enterDoors = [
    { x: 51, z: P1.z0 - 0.3, halfW: 1.6, zLo: -0.4, zHi: 0.8, outPos: [51, P1.z0 - 2.4], outYaw: Math.PI, id: 'sm-city', make: mall('sm-city') },
    { ax: 'x', s: -1, x: TOPAZ.cx + TOPAZ.r + 0.3, z: TOPAZ.cz, halfW: 1.6, zLo: -0.4, zHi: 0.8, outPos: [TOPAZ.cx + TOPAZ.r + 2.6, TOPAZ.cz], outYaw: Math.PI / 2, id: 'sm-topaz', make: mall('sm-topaz') },
    { ax: 'x', s: -1, x: RUBY.x1 + 0.3, z: 24, halfW: 1.7, zLo: -0.5, zHi: 0.8, outPos: [RUBY.x1 + 2.4, 24], outYaw: Math.PI / 2, id: 'sm-ruby', make: mall('sm-ruby') },
    { s: -1, x: -144, z: SAPH.z1 + 0.3, halfW: 1.7, zLo: -0.5, zHi: 0.8, outPos: [-144, SAPH.z1 + 2.4], outYaw: 0, id: 'sm-sapphire', make: mall('sm-sapphire') },
    { ax: 'x', s: -1, x: P3.x1 + 0.3, z: 176, halfW: 1.7, zLo: -0.5, zHi: 0.8, outPos: [P3.x1 + 2.4, 176], outYaw: Math.PI / 2, id: 'sm-p3', make: mall('sm-p3') },
    // 天桥门（桥面 y = 6）
    { ax: 'x', s: 1, x: P1.x0 - 0.4, z: (BR1.z0 + BR1.z1) / 2, y: BR1.y, halfW: 2.6, zLo: -0.6, zHi: 0.8, outPos: [P1.x0 - 2.4, (BR1.z0 + BR1.z1) / 2], outY: BR1.y + 0.05, outYaw: -Math.PI / 2, id: 'sm-city', gate: 'br1', make: mall('sm-city') },
    { ax: 'x', s: 1, x: P1.x0 - 0.4, z: (BR2.z0 + BR2.z1) / 2, y: BR2.y, halfW: 2.6, zLo: -0.6, zHi: 0.8, outPos: [P1.x0 - 2.4, (BR2.z0 + BR2.z1) / 2], outY: BR2.y + 0.05, outYaw: -Math.PI / 2, id: 'sm-city', gate: 'br2', make: mall('sm-city') },
    { ax: 'x', s: -1, x: BR1.x0 + 0.4, z: (BR1.z0 + BR1.z1) / 2, y: BR1.y, halfW: 2.6, zLo: -0.6, zHi: 0.8, outPos: [BR1.x0 + 2.4, (BR1.z0 + BR1.z1) / 2], outY: BR1.y + 0.05, outYaw: Math.PI / 2, id: 'sm-topaz', gate: 'br1', make: mall('sm-topaz') },
    { ax: 'x', s: -1, x: BR2.x0 + 0.4, z: (BR2.z0 + BR2.z1) / 2, y: BR2.y, halfW: 2.6, zLo: -0.6, zHi: 0.8, outPos: [BR2.x0 + 2.4, (BR2.z0 + BR2.z1) / 2], outY: BR2.y + 0.05, outYaw: Math.PI / 2, id: 'sm-p3', gate: 'br2', make: mall('sm-p3') },    // 3F 连廊（楼面 y 11）：北头进三期 3F、南头进黄宝石 3F
    { s: 1, x: (LK3.x0 + LK3.x1) / 2, z: LK3.zP - 0.4, y: LK3.y, halfW: 2.6, zLo: -0.6, zHi: 0.8, outPos: [(LK3.x0 + LK3.x1) / 2, LK3.zP - 2.0], outY: LK3.y + 0.05, outYaw: Math.PI, id: 'sm-p3', gate: 'lk3', make: mall('sm-p3') },
    { s: -1, x: (LK3.x0 + LK3.x1) / 2, z: LK3.zT + 3.4, y: LK3.y, halfW: 2.6, zLo: -0.6, zHi: 0.8, outPos: [(LK3.x0 + LK3.x1) / 2, LK3.zT + 5.0], outY: LK3.y + 0.05, outYaw: 0, id: 'sm-topaz', gate: 'lk3', make: mall('sm-topaz') },
  ];
}

/* ---------- 四期：SM国际中心 + CHAO BLOCK（兴山路东）、4C 工地（一期北侧） ----------
 * 资料（research.md §8）：四期建在一期原来的露天停车场上；4A / 4B 地块 2024-09 竣工：3 栋塔楼（SM国际中心，5A 写字楼，6–19F 办公，
 * 19 层 86.47 m）+ 裙楼（1–2F 商业 = 非标街区 CHAO BLOCK，3–5F 停车）+ 地下街区；4C 地块（一期北侧）2026-01 封顶，正做幕墙，2027 上半年竣备。
 * CHAO BLOCK 实拍：白色裙楼 + SM 圆标 + 蓝色 LED 字带「CHAOBLOCK」，底层开敞，蓝色大楼梯，主步道「大步路 BIG BLUE」，蓝顶 + 金色圆环灯；
 * 握爪公园（宠物友好）。具体平面没有公开图纸：下面的体块 / 步道 / 塔楼位置是按航拍和实拍估的。 */
const P4 = { x0: 106, x1: 158, z0: -8, z1: 118, h: 23 };   // 4B 地块裙楼（兴山路东、仙岳路北）
const P4C = { x0: 18, x1: 84, z0: 166, z1: 197 };          // 4C 工地（一期北侧）
const BIGBLUE = { x0: 116, x1: 124 }, P4Y = { z0: 28, z1: 80 }, P4E = 136;   // 大步路（南北贯通）、中庭（向兴山路敞开）、东楼
const CHAO_BLUE = '#1F5BD8';
/** LED 字带：蓝底 + 白色点阵字 */
function chaoBand(c, pw, ph) {
  c.fillStyle = CHAO_BLUE; c.fillRect(0, 0, pw, ph);
  c.fillStyle = '#FFFFFF'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.font = `900 ${ph * 0.72}px ${FONT_EN}`;
  c.fillText('CHAOBLOCK', pw * 0.3, ph * 0.54); c.font = `900 ${ph * 0.6}px ${FONT}`; c.fillText('潮 · 街 区', pw * 0.78, ph * 0.54);
  c.fillStyle = CHAO_BLUE; const d = Math.max(2, ph / 14); for (let x = 0; x < pw; x += d) c.fillRect(x, 0, 1, ph); for (let y = 0; y < ph; y += d) c.fillRect(0, y, pw, 1);
}
/** 3–5F 停车楼外皮：白色横向格栅 */
function parkPanel(c, pw, ph) {
  c.fillStyle = '#F1F2F0'; c.fillRect(0, 0, pw, ph); c.fillStyle = 'rgba(120,128,136,0.28)';
  for (let y = 0; y < ph; y += Math.max(3, ph / 28)) c.fillRect(0, y, pw, Math.max(1, ph / 90));
  c.fillStyle = 'rgba(150,156,162,0.35)'; for (let i = 1; i < 4; i++) c.fillRect(pw * i / 4 - 1, 0, 2, ph);
  for (let i = 1; i < 3; i++) c.fillRect(0, ph * i / 3 - 1, pw, 3);
}
/** 写字楼：深色 Low-E 玻璃 + 每层白色横带（一张 = 4 层） */
function towerGlass(c, pw, ph) {
  const g = c.createLinearGradient(0, 0, pw, ph); g.addColorStop(0, '#4D6274'); g.addColorStop(1, '#2C3B48'); c.fillStyle = g; c.fillRect(0, 0, pw, ph);
  c.fillStyle = 'rgba(190,215,235,0.18)'; c.beginPath(); c.moveTo(0, ph * 0.1); c.lineTo(pw * 0.5, 0); c.lineTo(pw, 0); c.lineTo(0, ph * 0.6); c.fill();
  c.fillStyle = '#DCE1E4'; for (let i = 0; i < 4; i++) c.fillRect(0, ph * (i + 0.84) / 4, pw, ph * 0.035);
  c.fillStyle = 'rgba(210,220,226,0.7)'; for (let i = 0; i <= 6; i++) c.fillRect(pw * i / 6 - 1, 0, 2, ph);
}
/** 4C 工地：裸露楼板 + 黑洞洞的窗 + 绿色安全网 */
function bareFrame(c, pw, ph) {
  c.fillStyle = '#B9B6AE'; c.fillRect(0, 0, pw, ph);
  for (let f = 0; f < 4; f++) { c.fillStyle = '#4A4C4E'; c.fillRect(0, ph * (f * 0.25 + 0.04), pw, ph * 0.17);
    c.fillStyle = '#A7A49C'; for (let i = 0; i <= 5; i++) c.fillRect(pw * i / 5 - pw * 0.015, ph * f * 0.25, pw * 0.03, ph * 0.25); }
  c.fillStyle = 'rgba(46,125,70,0.55)'; c.fillRect(0, 0, pw * 0.38, ph);
}
/** 围挡：SM 深蓝底 + 圆标 + 4C 文案 */
function hoarding(c, pw, ph) {
  c.fillStyle = SM_NAVY; c.fillRect(0, 0, pw, ph); c.fillStyle = '#FFFFFF'; c.fillRect(0, ph * 0.86, pw, ph * 0.14);
  const r = ph * 0.3; c.beginPath(); c.arc(ph * 0.45, ph * 0.43, r, 0, TAU); c.fill();
  c.fillStyle = SM_NAVY; c.font = `italic 900 ${r}px ${FONT_EN}`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('SM', ph * 0.45, ph * 0.45);
  c.fillStyle = '#FFFFFF'; c.textAlign = 'left'; c.font = `800 ${ph * 0.26}px ${FONT}`; c.fillText('SM厦门四期 · 4C 地块', ph * 0.9, ph * 0.3);
  c.font = `600 ${ph * 0.17}px ${FONT}`; c.fillText('2026 · 01 封顶   幕墙施工中   2027 敬请期待', ph * 0.9, ph * 0.64);
  c.fillStyle = SM_NAVY; c.font = `700 ${ph * 0.1}px ${FONT}`; c.fillText('安全文明施工  ·  SM INTERNATIONAL CENTER PHASE II', ph * 0.2, ph * 0.93);
}
/** 「潮」浪花大画（东楼面向中庭） */
function chaoWave(c, pw, ph) {
  const g = c.createLinearGradient(0, 0, 0, ph); g.addColorStop(0, '#BFE0FF'); g.addColorStop(1, CHAO_BLUE); c.fillStyle = g; c.fillRect(0, 0, pw, ph);
  c.strokeStyle = '#FFFFFF'; c.lineWidth = ph * 0.035;
  for (let k = 0; k < 4; k++) { c.beginPath(); for (let x = 0; x <= pw; x += pw / 40) { const y = ph * (0.45 + k * 0.13) + Math.sin(x / pw * TAU * 2 + k) * ph * 0.06; x ? c.lineTo(x, y) : c.moveTo(x, y); } c.stroke(); }
  c.fillStyle = '#FFFFFF'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.font = `900 ${ph * 0.36}px ${FONT}`; c.fillText('潮', pw * 0.2, ph * 0.28);
  c.font = `900 ${ph * 0.16}px ${FONT_EN}`; c.fillText('CHAO BLOCK', pw * 0.62, ph * 0.22); c.font = `700 ${ph * 0.08}px ${FONT}`; c.fillText('SM 非标商业街区 · 大步路 BIG BLUE', pw * 0.62, ph * 0.34);
}
/** 握爪公园牌：黄底 + 爪印 */
function pawSign(c, pw, ph) {
  c.fillStyle = '#F2C230'; c.fillRect(0, 0, pw, ph); c.fillStyle = SM_NAVY;
  const paw = (x, y, r) => { c.beginPath(); c.ellipse(x, y, r, r * 0.85, 0, 0, TAU); c.fill(); for (let i = 0; i < 4; i++) { const a = -Math.PI * (0.2 + i * 0.2); c.beginPath(); c.arc(x + Math.cos(a) * r * 1.35, y + Math.sin(a) * r * 1.35, r * 0.38, 0, TAU); c.fill(); } };
  paw(pw * 0.16, ph * 0.6, ph * 0.18); c.textAlign = 'left'; c.textBaseline = 'middle'; c.font = `900 ${ph * 0.3}px ${FONT}`; c.fillText('握爪公园', pw * 0.32, ph * 0.38);
  c.font = `700 ${ph * 0.14}px ${FONT_EN}`; c.fillText('PAW PARK · 宠物友好', pw * 0.32, ph * 0.72);
}
const CHAO_SHOPS = [['WM.HOME', '#EDE7DC', '#2B2B2B'], ['喧哗世界', '#E8306B', '#FFFFFF'], ['INNOUT LAB', '#111111', '#F2C230'], ['M Stand', '#FFFFFF', '#111111'],
  ['景德欧记大排档', '#B8001F', '#FFE3A0'], ['GOST', '#2B2F35', '#FFFFFF'], ['The Nth Possibility', '#F4F1EA', '#1F3B73'], ['FAKEROOM', '#5BA4D8', '#FFFFFF'],
  ['李山山茶事', '#3F6B4A', '#F4EEDC'], ['FUGGLER', '#F28A2E', '#FFFFFF'], ['野菌培养室', '#6B4C3B', '#F4EEDC'], ['日出那边', '#F2C230', '#B8001F'],
  ['漫火串烧', '#2B2B2B', '#F28A2E'], ['酒鬼食堂', '#1F3B73', '#FFFFFF'], ['GRKC', '#FFFFFF', '#C8102E'], ['吉㠭', '#C9A97A', '#2B2B2B']];

function phase4(S) {
  const k = S.kit, P = k.solid, A = S.atlas, G = k.glow, GL = k.glass, M = k.metal, B = k.g('band'), GR = k.g('granite');
  const { x0, x1, z0, z1, h } = P4, { x0: bx0, x1: bx1 } = BIGBLUE, { z0: yz0, z1: yz1 } = P4Y;
  const white = hex('#F3F4F2'), dark = hex('#2B3036'), blue = hex(CHAO_BLUE), gold = hex('#F2C26B'), line = hex('#EAF6FF');
  const store = shopUv(S), glass2 = A.draw(12, 5, curtain('#7FA6C2'), 9), park = A.draw(13, 10.6, parkPanel, 7), band = A.draw(26, 1.4, chaoBand, 24);
  // ---- 兴山路（南北向，一期东侧）+ 斑马线 ----
  S.road(90, 102, -14, 200, false, null); S.roadSign(103.4, 6, '兴山路', -Math.PI / 2);
  for (const [za, zb] of [[-12.5, -8.5], [36, 40], [158.5, 162.5]]) for (let x = 90.6; x < 101.6; x += 1.2) P.slab(x, x + 0.6, 0.012, 0.017, za, zb, hex('#F2F2F2'), { ao: false });
  for (let z = -10.5; z > -40; z -= 1.2) if (z < -14.5) P.slab(91, 101, 0.012, 0.017, z - 0.6, z, hex('#F2F2F2'), { ao: false });
  GR.slab(86, 90, 0.004, 0.03, -14, 200, hex('#D3CCC0'), { ao: false }); GR.slab(102, x0, 0.004, 0.03, -14, 200, hex('#D3CCC0'), { ao: false });
  // ---- 裙楼体块：南楼 / 北楼（中间穿过大步路）、东楼；中庭 x0…P4E × yz0…yz1 向兴山路敞开 ----
  const mass = (a0, a1, c0, c1, y0, y1) => { P.slab(a0, a1, y0, y1, c0, c1, white, { ao: false }); k.colSlab(a0, a1, y0, y1, c0, c1); };
  for (const [c0, c1] of [[z0, yz0], [yz1, z1]]) { mass(x0, bx0, c0, c1, 0, 6); mass(bx1, x1, c0, c1, 0, 6); mass(x0, x1, c0, c1, 6, h); }
  mass(P4E, x1, yz0, yz1, 0, h);
  // 立面：1F 店面 + 深色招牌带 / 2F 玻璃 / LED 字带 / 3–5F 停车楼白格栅
  const face = (axis, fixed, a0, a1, nrm, { led = false, upper = true, low = true } = {}) => {
    if (low) for (const [s0, s1] of (axis === 'x' && a0 < bx0 && a1 > bx1 ? [[a0, bx0], [bx1, a1]] : [[a0, a1]])) {   // 南北面：大步路口不贴店面
      tileFace(A, store, axis, fixed, s0, s1, 0, 4.6, nrm, 12);
      if (axis === 'x') B.slab(s0, s1, 4.6, 6, fixed + nrm * 0.02 - 0.2, fixed + nrm * 0.02 + 0.2, dark, { ao: false }); else B.slab(fixed + nrm * 0.02 - 0.2, fixed + nrm * 0.02 + 0.2, 4.6, 6, s0, s1, dark, { ao: false }); }
    if (!upper) return;
    tileFace(A, glass2, axis, fixed, a0, a1, 6, 11, nrm, 12);
    tileFace(A, led ? band : park, axis, fixed, a0, a1, 11, 12.4, nrm, led ? 26 : 13);
    tileFace(A, park, axis, fixed, a0, a1, 12.4, h - 0.4, nrm, 13);
    if (axis === 'x') G.slab(a0, a1, h - 0.3, h - 0.18, fixed + nrm * 0.05 - 0.03, fixed + nrm * 0.05 + 0.03, line, { ao: false }); else G.slab(fixed + nrm * 0.05 - 0.03, fixed + nrm * 0.05 + 0.03, h - 0.3, h - 0.18, a0, a1, line, { ao: false });
  };
  face('x', z0, x0, x1, -1, { led: true }); face('x', z1, x0, x1, 1, { led: true });                 // 南（仙岳路）/ 北
  face('z', x0, z0, yz0, -1, { led: true }); face('z', x0, yz1, z1, -1, { led: true });              // 兴山路
  face('z', x1, z0, z1, 1, { low: false });                                                           // 东（背面）
  face('x', yz0, x0, P4E, 1); face('x', yz1, x0, P4E, -1);                                            // 中庭南北两面
  face('z', P4E, yz0, yz1, -1, { upper: false });                                                     // 东楼 1F
  tileFace(A, store, 'z', P4E, yz0 + 2, yz1 - 2, 6.05, 10.6, -1, 12);                                // 东楼 2F（平台上的店）
  A.quad(P4E - 0.05, 17.2, (yz0 + yz1) / 2, 40, 9.6, aS(-1, 0), A.draw(40, 9.6, chaoWave, 12));
  for (const c of [[z0, yz0], [yz1, z1]]) for (const s of [-1, 1]) {                                  // 大步路两侧店面
    const fx = s < 0 ? bx0 : bx1; tileFace(A, store, 'z', fx, c[0], c[1], 0, 4.6, s < 0 ? 1 : -1, 12); }
  // 屋顶女儿墙 + SM 圆标 + 停车楼牌
  P.slab(x0 - 0.3, x1 + 0.3, h, h + 1, z0 - 0.3, z0 + 0.3, white, { ao: false }); P.slab(x0 - 0.3, x0 + 0.3, h, h + 1, z0, z1, white, { ao: false });
  const logo = A.draw(6, 6, (c, pw, ph) => smLogo(c, pw, ph, { bg: '#FFFFFF' }), 24);
  A.quad(x0 + 5, 17.6, z0 - 0.08, 6, 6, aS(0, -1), logo); A.quad(x0 - 0.08, 17.6, 20, 6, 6, aS(-1, 0), logo); A.quad(x0 - 0.08, 17.6, 110, 6, 6, aS(-1, 0), logo);
  A.quad(x1 - 8, 17.6, z0 - 0.08, 9, 3, aS(0, -1), A.draw(9, 3, textPaint(['P  停车楼 3–5F', 'SM PARKING'], { bg: '#1F5FA8', fg: '#FFFFFF' }), 24));
  // ---- 大步路 BIG BLUE：蓝色步道 + 蓝顶 + 金色圆环灯；两头挂牌 ----
  const bb = A.draw(7.6, 1.1, textPaint(['大步路  BIG BLUE', 'CHAO BLOCK · 潮街区'], { bg: CHAO_BLUE, fg: '#FFFFFF' }), 40);
  B.slab(bx0 + 1.5, bx1 - 1.5, 0.03, 0.05, z0 - 6, z1 + 3, blue, { ao: false });
  for (const [c0, c1] of [[z0, yz0], [yz1, z1]]) {
    B.slab(bx0, bx1, 5.84, 5.98, c0, c1, blue, { ao: false });
    for (let z = c0 + 4; z < c1 - 2; z += 7) { G.cyl((bx0 + bx1) / 2, 5.8, z, 2.6, 0.06, gold, 16, 0, 0, 0, undefined, { ao: false }); B.cyl((bx0 + bx1) / 2, 5.76, z, 2.0, 0.06, blue, 16, 0, 0, 0, undefined, { ao: false }); }
    for (const [z, n] of [[c0 - 0.1, -1], [c1 + 0.1, 1]]) A.quad((bx0 + bx1) / 2, 5.2, z, 7.6, 1.1, aS(0, n), bb);
  }
  // ---- 中庭：蓝色大楼梯 → 2F 平台（东楼前，可走）----
  const TY = 6, sx0 = 126, sx1 = 130, sz0 = 40, sz1 = 55, tx0 = 130;
  k.stairs('z', sz0, 0, sz1, TY, sx0, sx1, 0, blue, { rails: true, nosing: '#E8EEF6' });
  P.slab(sx0, P4E, TY - 0.4, TY, sz1, sz1 + 4, hex('#E9ECEF'), { ao: false }); k.colSlab(sx0, P4E, TY - 0.6, TY, sz1, sz1 + 4);
  P.slab(tx0, P4E, TY - 0.4, TY, yz0 + 2, yz1 - 2, hex('#E9ECEF'), { ao: false }); k.colSlab(tx0, P4E, TY - 0.6, TY, yz0 + 2, yz1 - 2);
  B.slab(tx0, P4E, TY - 0.55, TY - 0.4, yz0 + 2, yz1 - 2, blue, { ao: false });
  const rail = (a0, a1, c0, c1) => { GL.slab(a0, a1, TY, TY + 1.1, c0, c1, hex('#D6EEF8'), { ao: false }); M.slab(a0 - 0.02, a1 + 0.02, TY + 1.1, TY + 1.16, c0 - 0.02, c1 + 0.02, hex('#C3C9CF'), { ao: false }); k.colSlab(a0, a1, TY, TY + 1.2, c0, c1); };
  rail(tx0 - 0.05, tx0 + 0.05, yz0 + 2, sz1); rail(tx0 - 0.05, tx0 + 0.05, sz1 + 4, yz1 - 2); rail(sx0 - 0.05, sx0 + 0.05, sz1, sz1 + 4); rail(sx0, tx0, sz1 + 3.95, sz1 + 4.05);
  rail(tx0, P4E, yz0 + 1.95, yz0 + 2.05); rail(tx0, P4E, yz1 - 2.05, yz1 - 1.95);
  for (const z of [yz0 + 3, 66, yz1 - 3]) { M.cyl(tx0 + 0.4, (TY - 0.4) / 2, z, 0.5, TY - 0.4, hex('#E6E8EA'), 10); k.colSlab(tx0 + 0.15, tx0 + 0.65, 0, TY - 0.4, z - 0.25, z + 0.25); }
  for (const z of [36, 48, 62, 72]) { G.cyl(133, TY - 0.6, z, 2.2, 0.06, gold, 16, 0, 0, 0, undefined, { ao: false }); B.cyl(133, TY - 0.64, z, 1.7, 0.06, blue, 16, 0, 0, 0, undefined, { ao: false }); }
  // 店招：大步路两侧 + 中庭四周（官网 / 公众号里的首批品牌）
  const shopSign = (i, x, z, nx, nz, y = 5.3) => { const [n, bg, fg] = CHAO_SHOPS[i % CHAO_SHOPS.length]; A.quad(x + nx * 0.25, y, z + nz * 0.25, 5.2, 0.9, aS(nx, nz), A.draw(5.2, 0.9, textPaint([n], { bg, fg }), 40)); };
  let si = 0;
  for (const z of [0, 14, 90, 104]) { shopSign(si++, bx0, z, 1, 0); shopSign(si++, bx1, z + 6, -1, 0); }
  for (const x of [110, 128]) { shopSign(si++, x, yz0, 0, 1); shopSign(si++, x, yz1, 0, -1); }
  for (const z of [38, 70]) shopSign(si++, P4E, z, -1, 0);
  for (const z of [44, 62]) shopSign(si++, P4E, z, -1, 0, 10.9);
  // ---- 握爪公园（中庭西北角，挨着兴山路）----
  P.slab(x0 + 1, 115, 0.02, 0.12, 56, yz1 - 1, hex('#6FA65A'), { ao: false });
  for (const [a0, a1, c0, c1] of [[115, 115.12, 60, yz1 - 1], [x0 + 1, 112.5, 55.94, 56.06]]) { M.slab(a0, a1, 0.12, 0.9, c0, c1, hex('#FFFFFF'), { ao: false }); k.colSlab(a0, a1, 0, 0.9, c0, c1); }
  M.cyl(114, 1.2, 57.5, 0.1, 2.4, hex('#8A9198'), 6); A.quad(114, 2.3, 57.4, 2.6, 1.2, aS(0, -1), A.draw(2.6, 1.2, pawSign, 60));
  for (const [x, z, r] of [[109, 66, 0.4], [112, 71, 2.2]]) dog(P, x, z, r);
  for (const x of [109, 111]) M.cyl(x, 0.35, 61, 0.06, 0.7, hex('#F28A2E'), 6); M.slab(108.9, 111.1, 0.62, 0.7, 60.96, 61.04, hex('#F28A2E'), { ao: false });
  D.tree(k, 108.5, 0.12, 75, 0.7, 1); D.bench(k, 117, 0, 66, Math.PI / 2); D.bench(k, 117, 0, 44, Math.PI / 2);
  // ---- 3 栋塔楼「SM国际中心」A / B / C（19F 86.47 m；从裙楼顶起）----
  const tg = A.draw(13, 17.2, towerGlass, 6), intl = A.draw(16, 2.4, textPaint(['SM国际中心', 'SM INTERNATIONAL CENTER'], { bg: '#2C3B48', fg: '#FFFFFF' }), 18);
  for (const [n, a0, a1, c0, c1, th] of [['A', 128, 154, -4, 22, 86.5], ['B', 138, 158, 38, 66, 80], ['C', 110, 134, 88, 112, 72]]) {
    P.slab(a0, a1, h, th, c0, c1, hex('#33424F'), { ao: false });
    for (let y = h + 1; y < th - 3; y += 17.2) { const y1 = Math.min(th - 3, y + 17.2);
      tileFace(A, tg, 'x', c0, a0, a1, y, y1, -1, 13); tileFace(A, tg, 'x', c1, a0, a1, y, y1, 1, 13); tileFace(A, tg, 'z', a0, c0, c1, y, y1, -1, 13); tileFace(A, tg, 'z', a1, c0, c1, y, y1, 1, 13); }
    P.slab(a0 - 0.3, a1 + 0.3, th - 3, th, c0 - 0.3, c1 + 0.3, hex('#E4E7E9'), { ao: false }); P.slab(a0 + 2, a1 - 2, th, th + 3, c0 + 2, c1 - 2, hex('#BFC5CA'), { ao: false });
    G.slab(a0 - 0.36, a1 + 0.36, th - 0.3, th - 0.2, c0 - 0.36, c1 + 0.36, line, { ao: false });
    A.quad((a0 + a1) / 2, th - 1.5, c0 - 0.36, 16, 2.4, aS(0, -1), intl); A.quad(a0 - 0.36, th - 1.5, (c0 + c1) / 2, 16, 2.4, aS(-1, 0), intl);
    A.quad(a0 - 0.36, th - 6, c0 + 3, 3, 3, aS(-1, 0), A.draw(3, 3, textPaint([n + '栋'], { bg: '#2C3B48', fg: '#FFFFFF' }), 30));
  }
  // A 栋大堂（11 m 挑高，仙岳路一侧；只做门面）
  GL.slab(134, 150, 0.2, 10.8, z0 - 0.4, z0 - 0.3, hex('#BFD8E6'), { ao: false }); M.slab(133.6, 150.4, 10.8, 11.2, z0 - 1.6, z0, hex('#D5DADF'), { ao: false });
  A.quad(142, 1.5, z0 - 0.45, 3.2, 3.0, aS(0, -1), S._smDoorUv || (S._smDoorUv = A.draw(3.2, 3.0, doorArt, 40)));
  A.quad(142, 9.4, z0 - 0.48, 12, 1.4, aS(0, -1), A.draw(12, 1.4, textPaint(['SM国际中心 A栋 大堂', 'SM INTERNATIONAL CENTER · 5A OFFICE'], { bg: '#FFFFFF', fg: SM_NAVY }), 30));
  // 人（低模）+ 平台上两个
  [[120, -2, 0.1], [121.5, 12, 3.0], [119, 34, 0.4], [124, 46, -0.6], [112, 40, 1.9], [120, 74, 3.1], [118.5, 96, 0.05], [104, 2, 2.9]].forEach(([x, z, r], i) => shopper(P, x, 0, z, r, i + 90, { lo: true }));
  for (const [z, r] of [[50, 0.2], [68, 3.0]]) shopper(P, 133, TY, z, r, z + 7, { lo: true });
  for (const z of [-4, 24, 52, 82, 110, 140]) S.lightTree(104, z, 0.6);
  phase4C(S);
}
/** 小狗（低模，握爪公园） */
function dog(P, x, z, ry) {
  const c = hex(ry > 1 ? '#D9A066' : '#F4F1EA'), fx = Math.sin(ry), fz = Math.cos(ry);
  P.box(x, 0.42, z, 0.26, 0.24, 0.6, c, ry, 0, 0, 1, { ao: false }); P.box(x + fx * 0.36, 0.58, z + fz * 0.36, 0.22, 0.22, 0.24, c, ry, 0, 0, 1, { ao: false });
  for (const s of [-1, 1]) for (const t of [-1, 1]) P.box(x + fx * 0.22 * t + Math.cos(ry) * 0.09 * s, 0.17, z + fz * 0.22 * t - Math.sin(ry) * 0.09 * s, 0.07, 0.34, 0.07, c, ry, 0, 0, 1, { ao: false });
}
/** 4C 地块（一期北侧）：2026-01 封顶，正在做幕墙 → 围挡 + 两栋封顶的塔楼（下半截已装玻璃）+ 塔吊 */
function phase4C(S) {
  const k = S.kit, P = k.solid, A = S.atlas, M = k.metal, G = k.glow, { x0, x1, z0, z1 } = P4C;
  const hd = A.draw(11, 2.6, hoarding, 22), fr = A.draw(13, 16, bareFrame, 6), cw = A.draw(13, 16, curtain('#6F8FA6'), 6), conc = hex('#BDBAB2');
  // 围挡（南面对一期北墙、东面对兴山路、西面对广场）
  for (const [a0, a1, c0, c1] of [[x0 - 2, x1 + 2, z0 - 3.1, z0 - 2.9], [x1 + 1.9, x1 + 2.1, z0 - 3, 199], [x0 - 2.1, x0 - 1.9, z0 - 3, 199]]) {
    P.slab(a0, a1, 0, 2.6, c0, c1, hex('#E9ECEE'), { ao: false }); k.colSlab(a0, a1, 0, 2.6, c0, c1); }
  tileFace(A, hd, 'x', z0 - 3.1, x0 - 2, x1 + 2, 0, 2.6, -1, 11); tileFace(A, hd, 'z', x1 + 2.1, z0 - 3, 199, 0, 2.6, 1, 11); tileFace(A, hd, 'z', x0 - 2.1, z0 - 3, 199, 0, 2.6, -1, 11);
  // 裙楼 5F（毛坯）+ 两栋塔楼：下半截幕墙、上半截裸楼板
  P.slab(x0, x1, 0, 23, z0, z1, conc, { ao: false }); k.colSlab(x0, x1, 0, 23, z0, z1);
  tileFace(A, fr, 'x', z0, x0, x1, 2.6, 23, -1, 13); tileFace(A, fr, 'z', x1, z0, z1, 2.6, 23, 1, 13); tileFace(A, fr, 'z', x0, z0, z1, 2.6, 23, -1, 13);
  for (const [a0, a1, th, gTop] of [[22, 44, 70, 46], [58, 80, 62, 36]]) {
    const c0 = 170, c1 = 192; P.slab(a0, a1, 23, th, c0, c1, conc, { ao: false });
    for (let y = 23; y < th; y += 16) { const y1 = Math.min(th, y + 16), uv = y1 <= gTop ? cw : fr;
      tileFace(A, uv, 'x', c0, a0, a1, y, y1, -1, 11); tileFace(A, uv, 'z', a0, c0, c1, y, y1, -1, 11); tileFace(A, uv, 'z', a1, c0, c1, y, y1, 1, 11); }
    M.slab(a0 + 3, a0 + 5, 0, th + 2, c0 - 1.6, c0 - 0.1, hex('#E2B53A'), { ao: false });   // 施工电梯
  }
  // 塔吊（黄色）：标准节塔身 + 起重臂伸到兴山路上空 + 平衡臂 + 驾驶室 + 吊钩
  const Y = hex('#F2B705'), cx = 51, cz = 181, H = 84;
  M.slab(cx - 1, cx + 1, 0, H, cz - 1, cz + 1, Y, { ao: false }); k.colSlab(cx - 1, cx + 1, 0, H, cz - 1, cz + 1);
  for (let y = 6; y < H; y += 6) M.slab(cx - 1.08, cx + 1.08, y, y + 0.25, cz - 1.08, cz + 1.08, hex('#C99500'), { ao: false });
  M.slab(cx - 14, cx + 46, H, H + 1.3, cz - 0.6, cz + 0.6, Y, { ao: false }); M.slab(cx - 0.5, cx + 0.5, H, H + 7, cz - 0.5, cz + 0.5, Y, { ao: false });
  P.slab(cx - 14, cx - 8, H - 2.2, H, cz - 1.2, cz + 1.2, hex('#9A9890'), { ao: false }); P.slab(cx + 1, cx + 3.4, H - 2.4, H, cz - 1.4, cz + 1.4, hex('#F4F4F2'), { ao: false });
  M.slab(cx + 31, cx + 31.08, 52, H, cz - 0.04, cz + 0.04, hex('#2B3036'), { ao: false }); M.slab(cx + 30.4, cx + 31.7, 51, 52.2, cz - 0.4, cz + 0.4, hex('#D23A2A'), { ao: false });
  G.slab(cx - 0.2, cx + 0.2, H + 7, H + 7.3, cz - 0.2, cz + 0.2, hex('#FF4A3A'), { ao: false });
}

/* ---------- 一期：SM城市广场 ---------- */
function phase1(S) {
  const k = S.kit, P = k.solid, A = S.atlas, G = k.glow, { x0, x1, z0, z1, h } = P1;
  P.slab(x0 + 0.05, x1 - 0.05, 0, h, z0 + 0.05, z1 - 0.05, hex('#DCDAD4'), { ao: false }); k.colSlab(x0, x1, 0, h, z0, z1);
  P.slab(x0 - 0.3, x1 + 0.3, h, h + 1.0, z0 - 0.3, z1 + 0.3, hex('#C9CCD0'), { ao: false });   // 女儿墙
  const wall = A.draw(14, 18, wallP1, 13), store = shopUv(S);
  for (const [axis, fixed, a0, a1, nrm] of [['x', z0, x0, x1, -1], ['z', x0, z0, z1, -1], ['z', x1, z0, z1, 1]]) {
    tileFace(A, wall, axis, fixed, a0, a1, 6, h, nrm, 14);
    tileFace(A, store, axis, fixed, a0, a1, 0, 4.6, nrm, 12);
    if (axis === 'x') P.slab(a0, a1, 4.6, 6, fixed - 0.25, fixed, hex('#BFC3C8'), { ao: false }); else P.slab(fixed + (nrm < 0 ? -0.25 : 0), fixed + (nrm < 0 ? 0 : 0.25), 4.6, 6, a0, a1, hex('#BFC3C8'), { ao: false });
  }
  // SM 圆标竖牌：西南角两面 + 东南角
  // 对照 2026 实拍（Wikimedia Commons「SM Xiamen 2026.jpg」）：浅蓝竖向灯箱 + 白底深蓝圈「SM」圆标（字母带白色内线）+ 深蓝「CITY」+「福建厦门」
  const logo = A.draw(7, 12, smCityPanel, 34);
  A.quad(x0 + 4.5, 19, z0 - 0.08, 7, 12, aS(0, -1), logo);
  A.quad(x0 - 0.08, 19, z0 + 4.5, 7, 12, aS(-1, 0), logo);
  // （原来的发光灯箱板 g('band') 是半透明排序，会按视角盖住圆标 → 删掉，边框直接画进贴图）
  // 沃尔玛蓝招牌（南立面东段）+ 西立面大字
  A.quad(68, 18.5, z0 - 0.1, 26, 5, aS(0, -1), A.draw(26, 5, (c, pw, ph) => { c.fillStyle = '#0071CE'; c.fillRect(0, 0, pw, ph); c.fillStyle = '#FFF'; c.textBaseline = 'middle'; c.textAlign = 'left';
    c.font = `800 ${ph * 0.52}px ${FONT_EN}`; c.fillText('Walmart', pw * 0.05, ph * 0.52); c.font = `800 ${ph * 0.5}px ${FONT}`; c.fillText('沃尔玛', pw * 0.56, ph * 0.52);
    c.fillStyle = '#FFC220'; for (let i = 0; i < 6; i++) { c.save(); c.translate(pw * 0.48, ph * 0.5); c.rotate(i * Math.PI / 3); c.fillRect(-ph * 0.04, -ph * 0.36, ph * 0.08, ph * 0.2); c.restore(); } }, 22));
  A.quad(x0 - 0.1, 21, 95, 46, 5.5, aS(-1, 0), A.draw(46, 5.5, (c, pw, ph) => { c.fillStyle = '#F7F8FA'; c.fillRect(0, 0, pw, ph); smLogo(c, ph, ph, { bg: '#F7F8FA' });
    c.fillStyle = SM_NAVY; c.textBaseline = 'middle'; c.textAlign = 'left'; c.font = `900 ${ph * 0.55}px ${FONT}`; c.fillText('SM城市广场', ph * 1.15, ph * 0.5);
    c.font = `800 ${ph * 0.3}px ${FONT_EN}`; c.fillText('SM CITY XIAMEN', ph * 1.15 + ph * 3.0, ph * 0.55); }, 16));
  // 店招（南立面一层上沿，朝 −z）
  [['麦当劳', 24], ['屈臣氏', 34], ['KFC 肯德基', 66], ['面包新语', 76]].forEach(([n, x]) => A.quad(x, 5.3, z0 - 0.3, 7, 1.0, aS(0, -1), A.draw(7, 1.0, brandPaint(n), 40)));
  [['SM百货', 40], ['优衣库', 120], ['星巴克', 150]].forEach(([n, z]) => A.quad(x0 - 0.3, 5.3, z, 7, 1.0, aS(-1, 0), A.draw(7, 1.0, brandPaint(n), 40)));
  // 正门（x≈51）：雨篷 + 「SM城市广场」+ 玻璃门
  const dx = 51; k.metal.slab(dx - 7, dx + 7, 5.2, 5.6, z0 - 3.4, z0, hex('#D5DADF'), { ao: false });
  for (const x of [dx - 6.6, dx + 6.6]) k.metal.cyl(x, 2.6, z0 - 3.0, 0.3, 5.2, hex('#C2C8CE'), 8);
  A.quad(dx, 5.4, z0 - 3.45, 13.6, 0.6, aS(0, -1), A.draw(13.6, 0.6, textPaint(['厦门SM城市广场  SM CITY'], { bg: SM_NAVY, fg: '#FFFFFF' }), 40));
  A.quad(dx, 2.0, z0 - 0.08, 4.4, 4.0, aS(0, -1), A.draw(4.4, 4.0, (c, pw, ph) => { c.fillStyle = '#4A5056'; c.fillRect(0, 0, pw, ph); c.fillStyle = '#CDE6F2'; c.fillRect(pw * 0.05, ph * 0.05, pw * 0.42, ph * 0.95); c.fillRect(pw * 0.53, ph * 0.05, pw * 0.42, ph * 0.95);
    c.fillStyle = '#FFF4DA'; c.globalAlpha = 0.6; c.fillRect(pw * 0.08, ph * 0.3, pw * 0.84, ph * 0.7); c.globalAlpha = 1; c.fillStyle = '#9AA3AB'; c.fillRect(pw * 0.43, ph * 0.45, pw * 0.03, ph * 0.12); c.fillRect(pw * 0.54, ph * 0.45, pw * 0.03, ph * 0.12); }, 32));
  k.shade.shadeBlob(dx, z0 - 1.6, 14, 3.4, 0.02, 0.2);
  // 天桥接口（西立面 2F）：玻璃门 + 门头（走到门口进 SM城市广场 2F）
  bridgeGate(S, P1.x0, BR1, -1, 'SM城市广场 2F', 'SM CITY · LEVEL 2', SM_NAVY);
  bridgeGate(S, P1.x0, BR2, -1, 'SM城市广场 2F', 'SM CITY · LEVEL 2', SM_NAVY);
}

/* ---------- 二期：SM新生活广场（红宝石 + 玻璃中庭 + 黄宝石 + 蓝宝石） ---------- */
function phase2(S) {
  const k = S.kit, P = k.solid, A = S.atlas, G = k.glow, GL = k.glass;
  const ruby = A.draw(12, 16, metalDiamond('#A9152B', '#D3364A', '#820B1D', '#640816'), 13), store = shopUv(S);
  // 红宝石：长条楼，整面红色金属钻石板 + 红色檐口
  { const { x0, x1, z0, z1, h } = RUBY;
    P.slab(x0, x1, 0, h, z0, z1, hex('#A3142C'), { ao: false }); k.colSlab(x0, x1, 0, h, z0, z1);
    for (const [axis, fixed, a0, a1, nrm] of [['z', x1, z0, z1, 1], ['x', z0, x0, x1, -1]]) { tileFace(A, ruby, axis, fixed, a0, a1, 5.5, h - 1.6, nrm, 12); tileFace(A, store, axis, fixed, a0, a1, 0, 4.6, nrm, 12); }
    k.g('band').slab(x0 - 0.4, x1 + 0.4, h - 1.6, h, z0 - 0.4, z1 + 0.4, hex('#C8102E'), { ao: false });
    k.g('band').slab(x0 - 0.3, x1 + 0.3, 4.6, 5.5, z0 - 0.3, z1 + 0.3, hex('#B0122A'), { ao: false });
    A.quad(x1 + 0.45, 16, 20, 9, 5, aS(1, 0), A.draw(9, 5, (c, pw, ph) => { c.fillStyle = '#F4F2EE'; c.fillRect(0, 0, pw, ph); c.fillStyle = '#111'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.font = `500 ${ph * 0.62}px Didot, "Bodoni 72", Georgia, serif`; c.fillText('ZARA', pw / 2, ph * 0.55); }, 30));
    A.quad(x1 + 0.45, 13.5, 38, 6, 9, aS(1, 0), A.draw(6, 9, (c, pw, ph) => { c.fillStyle = '#1D4F91'; c.fillRect(0, 0, pw, ph); c.fillStyle = '#FFDD00'; c.textAlign = 'center'; c.textBaseline = 'middle';
      c.font = `900 ${pw * 0.2}px ${FONT}`; ['玩具', '反斗城'].forEach((t, i) => c.fillText(t, pw / 2, ph * (0.2 + i * 0.2))); c.fillStyle = '#FFF'; c.font = `800 ${pw * 0.13}px ${FONT_EN}`; c.fillText('Toys"R"Us', pw / 2, ph * 0.62);
      c.font = `800 ${pw * 0.12}px ${FONT}`; c.fillText('4F 红宝石', pw / 2, ph * 0.82); }, 30));
    A.quad(-110, 15, z0 - 0.45, 12, 3, aS(0, -1), A.draw(12, 3, brandPaint('SEPHORA'), 30));
    A.quad(-132, 15, z0 - 0.45, 12, 3, aS(0, -1), A.draw(12, 3, brandPaint('Massimo Dutti'), 30));
    [['H&M', 30], ['海底捞', 44]].forEach(([n, z]) => A.quad(x1 + 0.3, 5.05, z, 6, 0.9, aS(1, 0), A.draw(6, 0.9, brandPaint(n), 40)));
    A.quad(-94, 5.05, z0 - 0.3, 6, 0.9, aS(0, -1), A.draw(6, 0.9, brandPaint('喜茶'), 40));
    groundDoor(S, x1, 24, 1, '红宝石 RUBY', '#C8102E'); }
  // 玻璃连接中庭（天桥落在这里）+ 「SM新生活广场」
  { const { x0, x1, z0, z1, h } = LINK, cw = A.draw(11, 16, curtain(), 12);
    P.slab(x0, x1, 0, h, z0, z1, hex('#B9CAD6'), { ao: false }); k.colSlab(x0, x1, 0, h, z0, z1);
    tileFace(A, cw, 'z', x1, z0, z1, 0, h, 1, 11);
    P.slab(x0 - 0.3, x1 + 0.6, h, h + 0.8, z0 - 0.3, z1 + 0.3, hex('#E6E8EA'), { ao: false });
    A.quad(x1 + 0.7, h - 3.5, 52.5, 4.6, 4.6, aS(1, 0), A.draw(4.6, 4.6, (c, pw, ph) => smLogo(c, pw, ph, { bg: '#FFFFFF' }), 40));
    A.quad(x1 + 0.7, h - 3.5, 66, 18, 3.0, aS(1, 0), A.draw(18, 3, textPaint(['SM新生活广场', 'SM LIFESTYLE CENTER'], { bg: '#FFFFFF', fg: SM_NAVY }), 22));
    bridgeGate(S, x1, BR1, 1, 'SM新生活广场 · 黄宝石 2F', 'SM LIFESTYLE · TOPAZ L2', '#C9A24A'); }
  // 中庭和蓝宝石之间的裙房
  P.slab(-130, LINK.x0, 0, 14, 50, 72, hex('#E4E3DF'), { ao: false }); k.colSlab(-130, LINK.x0, 0, 14, 50, 72);
  // 黄宝石：圆楼，整圈金色金属钻石板 + 金色环带；东侧正门
  { const { cx, cz, r, h } = TOPAZ, n = 24, gold = hex('#C9A24A'), gw = A.draw(6.3, 14, metalDiamond('#C9A24A', '#EED58A', '#9C7A30', '#7E6226'), 18), gs = A.draw(6.3, 4.6, storefront('#F6E7C4'), 26);
    const ap = r * Math.cos(Math.PI / n);
    for (let i = 0; i < n; i++) {
      const a = (i + 0.5) / n * TAU, nx = Math.cos(a), nz = Math.sin(a), x = cx + nx * ap, z = cz + nz * ap, w = 2 * r * Math.sin(Math.PI / n);
      const door = Math.abs(Math.atan2(nz, nx)) < 0.2;
      for (let j = 0; j < 2; j++) A.quad(x, 5.5 + (h - 5.5) / 4 * (2 * j + 1), z, w, (h - 5.5) / 2, aS(nx, nz), gw);
      if (!door) A.quad(x, 2.3, z, w, 4.6, aS(nx, nz), gs);
    }
    P.cyl(cx, h / 2, cz, 2 * r - 0.3, h, hex('#C29C48'), n, 0, 0, 0, undefined, { ao: false });
    for (const [y, t] of [[4.6, 0.9], [h - 0.2, 1.4]]) k.g('band').cyl(cx, y + t / 2, cz, 2 * r + 0.8, t, gold, n, 0, 0, 0, undefined, { ao: false });
    ringCol(k, cx, cz, r, r, 48, a => a < 0.1 || a > TAU - 0.1);
    k.colSlab(cx + r - 1.6, cx + r - 1.2, 0, 5, cz - 2, cz + 2);
    for (const s of [-1, 1]) k.colSlab(cx + r - 1.2, cx + r + 0.4, 0, 5, cz + s * 1.7 - 0.1 + (s > 0 ? 0 : -1.4), cz + s * 1.7 + 0.1 + (s > 0 ? 1.4 : 0));
    // 正门：金色门框 + 玻璃门
    const px = cx + r + 0.05; k.metal.slab(px, px + 0.5, 0, 5.4, cz - 2.4, cz - 1.8, gold, { ao: false }); k.metal.slab(px, px + 0.5, 0, 5.4, cz + 1.8, cz + 2.4, gold, { ao: false }); k.metal.slab(px, px + 0.5, 4.8, 5.6, cz - 2.4, cz + 2.4, gold, { ao: false });
    A.quad(px - 0.2, 2.3, cz, 3.6, 4.4, aS(1, 0), A.draw(3.6, 4.4, (c, pw, ph) => { c.fillStyle = '#B8D6E6'; c.fillRect(0, 0, pw, ph); c.fillStyle = '#FFF0D0'; c.globalAlpha = 0.7; c.fillRect(0, ph * 0.3, pw, ph * 0.7); c.globalAlpha = 1; c.fillStyle = '#8A7440'; c.fillRect(pw * 0.48, 0, pw * 0.04, ph); }, 32));
    A.quad(px + 0.55, 6.6, cz, 12, 1.6, aS(1, 0), A.draw(12, 1.6, textPaint(['黄宝石  TOPAZ', 'SM LIFESTYLE'], { bg: '#C9A24A', fg: '#FFFFFF' }), 40));
    [['MUJI 无印良品', -0.55], ['SWAROVSKI', 0.55], ['例外', 0.95], ['西贝莜面村', -0.95], ['花潮', 1.35]].forEach(([nm, a]) => { const x = cx + Math.cos(a) * (r + 0.3), z = cz + Math.sin(a) * (r + 0.3); A.quad(x, 5.05, z, 5.4, 0.85, aS(Math.cos(a), Math.sin(a)), A.draw(5.4, 0.85, brandPaint(nm), 40)); });
    k.shade.shadeBlob(px + 2, cz, 4, 6, 0.02, 0.2); }
  // 蓝宝石：方楼，蓝色金属钻石板 + 万达影城
  { const { x0, x1, z0, z1, h } = SAPH, blue = A.draw(12, 14, metalDiamond('#2A5BAE', '#5A8BD6', '#1C3F7E', '#163266'), 13);
    P.slab(x0, x1, 0, h, z0, z1, hex('#2A5BAE'), { ao: false }); k.colSlab(x0, x1, 0, h, z0, z1);
    tileFace(A, blue, 'z', x1, z0, z1, 14, h - 1.4, 1, 12); tileFace(A, blue, 'x', z0, x0, x1, 14, h - 1.4, -1, 12); tileFace(A, blue, 'x', z1, x0, x1, 4, h - 1.4, 1, 12);
    k.g('band').slab(x0 - 0.4, x1 + 0.4, h - 1.4, h, z0 - 0.4, z1 + 0.4, hex('#2E5DA8'), { ao: false });
    A.quad(x1 + 0.5, h - 5, 100, 14, 3.4, aS(1, 0), A.draw(14, 3.4, brandPaint('万达影城'), 30));
    A.quad(x1 + 0.5, h - 9, 100, 14, 2.2, aS(1, 0), A.draw(14, 2.2, textPaint(['蓝宝石  SAPPHIRE', '影城 · 健身'], { bg: '#2E5DA8', fg: '#FFFFFF' }), 30));
    groundDoor(S, -144, z1, 'z', '蓝宝石 SAPPHIRE', '#2A5BAE'); }
  // 天桥西头的「欢迎」灯箱
  A.quad(-47.5, 2.4, 40, 2.4, 3.2, aS(1, 0), A.draw(2.4, 3.2, (c, pw, ph) => smLogo(c, pw, ph, { label: 'SM新生活广场' }), 45));
  k.metal.slab(-47.75, -47.55, 0, 4.0, 38.7, 41.3, hex('#5C646C'), { ao: false }); k.colSlab(-47.8, -47.5, 0, 4, 38.7, 41.3);
}

/* ---------- 三期（嘉禾路401，二期北侧）：L 形 4 层裙楼 + voco 酒店塔楼 + 3F 连廊（→ 黄宝石 3F）+ 「夏花」雕塑广场 ----------
 * 资料：SM 官网「SM厦门三期夺得金坐标」（L 型建筑外观、流畅轮廓线条、极简灯光线条勾勒轮廓、水畔小景、秦岭户外雕塑 12 m × 7 m，凤凰花 + 白鹭）
 *       SM 官网三期开业稿（两座过街天桥 + 三层连廊接二期）；公共空间艺术设计网「夏花」（不锈钢骨架激光镂空 + 光学水晶玻璃，水雾 + 灯光）
 * 体块：东翼（沿嘉禾路）x −84…−60 + 南翼（对着黄宝石）z 128…152，两翼 23 m；东南角做 R10 圆角；西北角低一块（12 m 屋顶花园），酒店塔楼从上面起 */
const P3E = { x0: -84, z0: 138 }, P3S = { x1: -70, z1: 152 }, P3R = { cx: -70, cz: 138, r: 10 }, P3LOW = 12, LK3 = { x0: -108, x1: -100, y: 11, zT: 117, zP: P3.z0 };
/** 三期立面：玻璃 + 每层三道白色横向铝百叶（层高 5.75） */
function finWall(tint = '#86A9BE', floors = 3) {
  return (c, pw, ph) => {
    const g = c.createLinearGradient(0, 0, 0, ph); g.addColorStop(0, '#D3E4EE'); g.addColorStop(1, tint); c.fillStyle = g; c.fillRect(0, 0, pw, ph);
    c.fillStyle = 'rgba(40,60,75,0.28)'; for (let i = 0; i < 6; i++) c.fillRect(pw * i / 6 - 1, 0, 2, ph);
    for (let f = 0; f < floors; f++) { const y0 = ph * f / floors;
      c.fillStyle = '#F4F6F7'; c.fillRect(0, y0, pw, ph / floors * 0.13);
      c.fillStyle = 'rgba(244,246,247,0.85)'; for (const t of [0.42, 0.68]) c.fillRect(0, y0 + ph / floors * t, pw, ph / floors * 0.05); }
  };
}
function phase3(S) {
  const k = S.kit, P = k.solid, A = S.atlas, G = k.glow, GL = k.glass, GR = k.g('granite'), { x0, x1, z0, z1, h } = P3;
  const fw = A.draw(12, 17, finWall(), 7), store = shopUv(S), wall = hex('#E4E8EB'), white = hex('#F4F6F7'), line = hex('#EAF6FF');
  // ---- 体块 ----
  P.slab(P3E.x0, x1, 0, h, P3E.z0, z1, wall, { ao: false }); k.colSlab(P3E.x0, x1, 0, h, P3E.z0, z1);
  P.slab(x0, P3S.x1, 0, h, z0, P3S.z1, wall, { ao: false }); k.colSlab(x0, P3S.x1, 0, h, z0, P3S.z1);
  P.slab(x0, P3E.x0, 0, P3LOW, P3S.z1, z1, hex('#D5DAD6'), { ao: false }); k.colSlab(x0, P3E.x0, 0, P3LOW, P3S.z1, z1);
  { const { cx, cz, r } = P3R; P.cyl(cx, h / 2, cz, 2 * r, h, wall, 24, 0, 0, 0, undefined, { ao: false });
    for (let i = 0; i < 8; i++) { const a = -Math.PI / 2 + (i + 0.5) / 8 * Math.PI / 2, nx = Math.cos(a), nz = Math.sin(a), w = 2 * r * Math.sin(Math.PI / 32) * 2 + 0.05;
      k.col(cx + nx * (r - 0.4), h / 2, cz + nz * (r - 0.4), 0.8, h, w * 1.1, { ry: Math.atan2(-nz, nx) + Math.PI / 2 });
      A.quad(cx + nx * (r + 0.04), 6 + (h - 7) / 2, cz + nz * (r + 0.04), w, h - 7, aS(nx, nz), fw);
      A.quad(cx + nx * (r + 0.04), 2.3, cz + nz * (r + 0.04), w, 4.6, aS(nx, nz), store);
      k.g('band').box(cx + nx * (r + 0.15), 5.3, cz + nz * (r + 0.15), w, 1.4, 0.3, hex('#2B3036'), Math.atan2(nx, nz) + Math.PI / 2, 0, 0, 1, { ao: false });
      for (const y of [h - 0.25, 11.3]) G.box(cx + nx * (r + 0.32), y, cz + nz * (r + 0.32), w, 0.12, 0.06, line, Math.atan2(nx, nz) + Math.PI / 2, 0, 0, 1, { ao: false });
      P.box(cx + nx * (r + 0.1), h + 0.1, cz + nz * (r + 0.1), w, 1.4, 0.5, white, Math.atan2(nx, nz) + Math.PI / 2, 0, 0, 1, { ao: false }); } }
  // 东立面（嘉禾路）z 138…196、南立面（对黄宝石）x −150…−80：上面玻璃百叶，底层店面
  tileFace(A, fw, 'z', x1, P3E.z0, z1, 6, h - 1, 1, 12); tileFace(A, store, 'z', x1, P3E.z0, z1, 0, 4.6, 1, 12);
  tileFace(A, fw, 'x', z0, x0, P3R.cx, 6, h - 1, -1, 12); tileFace(A, store, 'x', z0, x0, P3R.cx, 0, 4.6, -1, 12);
  const B = k.g('band');
  B.slab(x1 - 0.3, x1 + 0.3, 4.6, 6, P3E.z0, z1 + 0.3, hex('#2B3036'), { ao: false }); B.slab(x0 - 0.3, P3R.cx, 4.6, 6, z0 - 0.3, z0 + 0.3, hex('#2B3036'), { ao: false });
  // 女儿墙
  P.slab(P3E.x0, x1 + 0.3, h - 1, h + 0.8, P3E.z0, z1 + 0.3, white, { ao: false }); P.slab(x0 - 0.3, P3S.x1, h - 1, h + 0.8, z0 - 0.3, P3S.z1, white, { ao: false });
  // 极简灯光线条：屋檐、3F 楼板线、几根竖向转角线
  for (const y of [h - 0.25, 11.3]) { G.slab(x1 + 0.3, x1 + 0.36, y - 0.06, y + 0.06, P3E.z0, z1 + 0.3, line, { ao: false }); G.slab(x0 - 0.3, P3R.cx, y - 0.06, y + 0.06, z0 - 0.36, z0 - 0.3, line, { ao: false }); }
  G.slab(x1 + 0.3, x1 + 0.36, 0.3, h, z1 + 0.24, z1 + 0.3, line, { ao: false }); G.slab(x0 - 0.36, x0 - 0.3, 0.3, h, z0 - 0.36, z0 - 0.3, line, { ao: false });
  // 西北角低区：12 m 屋顶花园（草 + 几棵树 + 木栈道）
  P.slab(x0 + 0.5, P3E.x0 - 0.5, P3LOW, P3LOW + 0.25, P3S.z1 + 0.5, z1 - 0.5, hex('#6FA65A'), { ao: false });
  P.slab(x0 - 0.2, P3E.x0, P3LOW - 0.6, P3LOW + 1.1, z1 - 0.3, z1 + 0.2, white, { ao: false });
  for (const [tx, tz] of [[-140, 188], [-94, 160]]) D.tree(k, tx, P3LOW + 0.25, tz, 0.7, 1);
  // 招牌
  A.quad(x1 + 0.45, 15, 168, 22, 3.4, aS(1, 0), A.draw(22, 3.4, textPaint(['SM厦门 三期', 'SM XIAMEN · PHASE III'], { bg: '#FFFFFF', fg: SM_NAVY }), 15));
  A.quad(x1 + 0.45, 15, 186, 4, 4, aS(1, 0), A.draw(4, 4, (c, pw, ph) => smLogo(c, pw, ph, { bg: '#FFFFFF' }), 30));
  { const a = -Math.PI / 4, nx = Math.cos(a), nz = Math.sin(a); A.quad(P3R.cx + nx * (P3R.r + 0.5), 16.5, P3R.cz + nz * (P3R.r + 0.5), 5, 5, aS(nx, nz), A.draw(5, 5, (c, pw, ph) => smLogo(c, pw, ph, { bg: '#FFFFFF' }), 20)); }
  A.quad(-128, 16.5, z0 - 0.45, 18, 3, aS(0, -1), A.draw(18, 3, textPaint(['SM厦门 三期', '都市潮流聚落 · 新锐社交空间'], { bg: '#FFFFFF', fg: SM_NAVY }), 15));
  // ---- voco 酒店塔楼（18 层 77.9 m；从低区屋面起） ----
  { const { x0, x1, z0, z1, h: th } = HOTEL, tw = A.draw(14, 20, curtain('#6F8FA6'), 7);
    P.slab(x0, x1, P3LOW, th, z0, z1, hex('#BFCBD4'), { ao: false });
    tileFace(A, tw, 'z', x1, z0, z1, P3LOW + 0.6, th - 2, 1, 14); tileFace(A, tw, 'x', z0, x0, x1, h + 0.6, th - 2, -1, 14);
    P.slab(x0 - 0.3, x1 + 0.3, th - 2, th, z0 - 0.3, z1 + 0.3, hex('#E9ECEE'), { ao: false });
    G.slab(x1 + 0.3, x1 + 0.36, h, th, z0 - 0.36, z0 - 0.3, line, { ao: false });
    const vocoUv = {}, voco = (w, hh) => vocoUv[w + 'x' + hh] || (vocoUv[w + 'x' + hh] = A.draw(w, hh, (c, pw, ph) => { c.fillStyle = '#E9ECEE'; c.fillRect(0, 0, pw, ph); c.fillStyle = '#E4007C'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.font = `800 ${ph * 0.6}px ${FONT_EN}`; c.fillText('voco', pw / 2, ph * 0.42); c.fillStyle = '#333'; c.font = `600 ${ph * 0.16}px ${FONT_EN}`; c.fillText('XIAMEN SM CITY', pw / 2, ph * 0.82); }, 30));
    A.quad(x1 + 0.35, th - 5, 168, 12, 4, aS(1, 0), voco(12, 4)); A.quad(-126, th - 5, z0 - 0.35, 12, 4, aS(0, -1), voco(12, 4)); }
  // voco 酒店落客入口（嘉禾路 403 号；只做门面，酒店不进）
  { const zc = 192, x = x1 + 0.06;
    k.metal.slab(x1, x1 + 4.2, 4.0, 4.3, zc - 4, zc + 4, hex('#D5DADF'), { ao: false }); G.slab(x1 + 4.1, x1 + 4.25, 3.9, 4.0, zc - 4, zc + 4, line, { ao: false });
    for (const z of [zc - 3.6, zc + 3.6]) k.metal.cyl(x1 + 3.8, 2, z, 0.25, 4, hex('#9AA1A8'), 8);
    A.quad(x + 0.02, 1.6, zc, 3.2, 3.0, aS(1, 0), S._smDoorUv || (S._smDoorUv = A.draw(3.2, 3.0, doorArt, 40)));
    A.quad(x1 + 4.27, 4.15, zc, 7.6, 0.55, aS(1, 0), A.draw(7.6, 0.55, textPaint(['voco 厦门SM酒店  ·  嘉禾路403号'], { bg: '#FFFFFF', fg: '#E4007C' }), 50)); }
  // ---- 三期门前广场：铺地 + 「夏花」雕塑 + 水畔小景 ----
  GR.slab(-80, -46, 0.004, 0.03, 128, 140, hex('#CFC8BB'), { ao: false }); GR.slab(x1, -46, 0.004, 0.03, 140, 200, hex('#CFC8BB'), { ao: false });
  for (let z = 130; z < 199; z += 3) P.slab(x1, -46, 0.031, 0.036, z, z + 0.08, hex('#B9B2A6'), { ao: false });
  xiaHua(S, -53, 160);
  for (const [za, zb] of [[164.5, 173], [179, 195.5]]) {
    GR.slab(-51.2, -47.4, 0, 0.42, za, zb, hex('#BFB8AC'), { ao: false }); k.colSlab(-51.2, -47.4, 0, 0.9, za, zb);
    GL.slab(-50.9, -47.7, 0.36, 0.4, za + 0.3, zb - 0.3, hex('#7FB8D0'), { ao: false });
    for (let z = za + 1.2; z < zb - 1; z += 2.6) P.sphere(-49.3, 0.55, z, 0.9, hex(z % 2 > 1 ? '#5E9A4E' : '#4C8A44'), 1, 0.6); }
  D.tree(k, -49.3, 0.42, 168.8, 0.8, 1); D.tree(k, -49.3, 0.42, 187, 0.8, 1);
  for (let i = 0; i < 4; i++) shopper(P, -56 + (i % 2) * 3, 0, 150 + i * 6 + (i > 1 ? 8 : 0), (i % 2 ? 1 : -1) * 1.2 + i, i + 70, { lo: true });
  // ---- 3F 连廊（三期 3F ↔ 二期黄宝石 3F，可走） ----
  link3(S);
  bridgeGate(S, x1, BR2, 1, 'SM 三期 2F', 'SM PHASE III · L2', '#4F7F8F');
  groundDoor(S, x1, 176, 1, 'SM 三期', '#4F7F8F');
}
/** 雕塑「夏花」（秦岭，2023-01-01 点亮）：不锈钢镂空花瓣 + 嵌红 / 橙水晶，像白鹭振翅般绽放的凤凰花；高 12 m、宽 7 m；底下一圈水池 + 雾 */
function xiaHua(S, cx, cz) {
  const k = S.kit, M = k.metal, G = k.glow, GL = k.glass, steel = hex('#DDE2E6'), red = hex('#E2412E'), org = hex('#F28A2E');
  k.g('granite').cyl(cx, 0.25, cz, 9, 0.5, hex('#BFB8AC'), 24, 0, 0, 0, undefined, { ao: false }); k.colSlab(cx - 3.9, cx + 3.9, 0, 1, cz - 3.9, cz + 3.9);
  GL.cyl(cx, 0.48, cz, 8.2, 0.06, hex('#7FB8D0'), 24, 0, 0, 0, undefined, { ao: false });
  GL.cyl(cx, 1.1, cz, 6.4, 1.2, hex('#F4F8FA'), 16, 0, 0, 0, 7.6, { ao: false });   // 水雾
  M.tubeTaper([cx, 0.5, cz], [cx, 6.4, cz], 0.9, 0.45, steel, 10);
  for (let i = 0; i < 6; i++) {
    const a = i / 6 * TAU + 0.3, ca = Math.cos(a), sa = Math.sin(a), egret = i % 2 === 0;
    for (let j = -1; j <= 1; j++) {
      const b = a + j * 0.22, cb = Math.cos(b), sb = Math.sin(b), R = egret ? 3.5 : 2.8, top = egret ? 12 : 10.4;
      const p0 = [cx + ca * 0.3, 6.2, cz + sa * 0.3], p1 = [cx + cb * R * 0.55, 8.4 + (egret ? 0.6 : 0), cz + sb * R * 0.55], p2 = [cx + cb * R, top - Math.abs(j) * 0.7, cz + sb * R];
      M.tubeTaper(p0, p1, 0.26, 0.2, steel, 5); M.tubeTaper(p1, p2, 0.2, 0.06, egret && j === 0 ? hex('#FFFFFF') : steel, 5);
      if (!egret || j === 0) G.sphere((p1[0] + p2[0]) / 2, (p1[1] + p2[1]) / 2, (p1[2] + p2[2]) / 2, 0.5, (i + j) % 2 ? red : org, 1);
    }
  }
  for (let i = 0; i < 10; i++) { const a = i / 10 * TAU; G.sphere(cx + Math.cos(a) * 1.4, 6.9 + (i % 3) * 0.3, cz + Math.sin(a) * 1.4, 0.55, i % 2 ? red : org, 1); }
  S.atlas.quad(cx + 4.45, 0.75, cz, 2.4, 0.5, aS(1, 0), S.atlas.draw(2.4, 0.5, textPaint(['夏花 · 秦岭 2023'], { bg: '#2B3036', fg: '#FFFFFF' }), 60));
}
/** 3F 连廊：玻璃廊 x −108…−100、楼面 y 11；南头插进黄宝石北面（z≈120），北头接三期南立面（z 128）；两头各一扇门 */
function link3(S) {
  const k = S.kit, P = k.solid, G = k.glow, { x0, x1, y: Y, zT, zP } = LK3, white = hex('#F4F6F7'), xc = (x0 + x1) / 2, TOP = Y + 3.6;
  const GLW = k.g('glass@bridge'), gm = bucketMat(k.scene, k.M, 'glass@bridge'); gm.environmentIntensity = 0; gm.alpha = 0.22;
  k.g('granite').slab(x0, x1, Y - 0.3, Y, zT, zP, hex('#DCD6CB'), { ao: false }); k.colSlab(x0, x1, Y - 0.6, Y, zT, zP);
  for (let z = zT + 1.2; z < zP; z += 1.2) P.quad([x0, Y + 0.004, z], [x1, Y + 0.004, z], [x1, Y + 0.004, z + 0.05], [x0, Y + 0.004, z + 0.05], hex('#B9B2A6'));
  for (const [a, b] of [[x0 - 0.3, x0 + 0.2], [x1 - 0.2, x1 + 0.3]]) P.slab(a, b, Y - 1.6, Y - 0.3, zT, zP, white, { ao: false });
  P.slab(x0, x1, Y - 1.65, Y - 1.5, zT, zP, hex('#E2E4E6'), { ao: false });
  for (const [a, b] of [[x0 - 0.06, x0], [x1, x1 + 0.06]]) { GLW.slab(a, b, Y, TOP, zT, zP, hex('#D6EEF8'), { ao: false }); k.colSlab(a - 0.1, b + 0.1, Y, TOP + 1, zT, zP); }
  for (let z = zT + 0.6; z < zP; z += 2.6) for (const x of [x0 - 0.08, x1 + 0.02]) k.metal.slab(x, x + 0.06, Y, TOP, z, z + 0.12, hex('#C3C9CF'), { ao: false });
  for (const x of [x0 + 0.05, x1 - 0.11]) k.metal.slab(x, x + 0.06, Y + 1.0, Y + 1.05, zT, zP, hex('#AEB6BD'), { ao: false });
  P.slab(x0 - 0.3, x1 + 0.3, TOP, TOP + 0.45, zT, zP, white, { ao: false }); G.slab(xc - 0.25, xc + 0.25, TOP - 0.03, TOP, zT + 0.5, zP - 0.5, hex('#FFF6E0'), { ao: false });
  for (const x of [x0 - 0.36, x1 + 0.3]) for (const y of [Y - 1.6, TOP + 0.45]) G.slab(x, x + 0.06, y - 0.05, y + 0.05, zT + 3, zP, hex('#EAF6FF'), { ao: false });
  k.colSlab(x0, x1, Y, TOP, zT + 2.1, zT + 2.4);   // 黄宝石墙里面不让穿过去
  zGate(S, zT + 2.85, xc, Y, 1, '二期 黄宝石 3F', 'SM LIFESTYLE · TOPAZ L3', '#B8892E');
  zGate(S, zP - 0.06, xc, Y, -1, 'SM 三期 3F', 'SM PHASE III · L3', '#4F7F8F');
  for (let i = 0; i < 2; i++) shopper(P, xc - 1.6 + i * 3.2, Y, zT + 5 + i * 3, i ? 0 : Math.PI, i + 80, { lo: true });
}
/** z 立面上的连廊门（bridgeGate 的 z 版本）：fz = 立面 z，dir = 门朝 +z（1）/ −z（−1） */
function zGate(S, fz, xc, Y, dir, zh, en, col) {
  const k = S.kit, A = S.atlas, z = fz + dir * 0.06, steel = hex('#C3C9CF'), x0 = xc - 4, x1 = xc + 4;
  for (const x of [x0 - 0.15, xc - 1.75, xc + 1.6, x1]) k.metal.slab(x, x + 0.15, Y, Y + 3.0, z - 0.12, z + 0.12, steel, { ao: false });
  k.metal.slab(x0 - 0.15, x1 + 0.15, Y + 3.0, Y + 3.6, z - 0.15, z + 0.15, hex(col), { ao: false });
  A.quad(xc, Y + 3.3, z + dir * 0.17, 5.6, 0.56, aS(0, dir), A.draw(5.6, 0.56, textPaint([zh, en], { bg: col, fg: '#FFFFFF' }), 50));
  A.quad(xc, Y + 1.5, z + dir * 0.02, 3.2, 3.0, aS(0, dir), S._smDoorUv || (S._smDoorUv = A.draw(3.2, 3.0, doorArt, 40)));
  for (const [a, b] of [[x0, xc - 1.75], [xc + 1.75, x1]]) k.glass.slab(a, b, Y, Y + 3.0, z - 0.02, z + 0.02, hex('#D6EEF8'), { ao: false });
  k.glow.slab(xc - 1.6, xc + 1.6, Y + 2.95, Y + 3.0, z + dir * 0.18 - 0.02, z + dir * 0.18 + 0.02, hex('#FFF4DA'), { ao: false });
}

/* ---------- 楼门（街面一侧） ---------- */
const doorArt = (c, pw, ph) => { c.fillStyle = '#5C646C'; c.fillRect(0, 0, pw, ph);
  const g = c.createLinearGradient(0, 0, 0, ph); g.addColorStop(0, '#CFE6F2'); g.addColorStop(0.35, '#B9D8E8'); g.addColorStop(1, '#FFF1D6');
  for (const [a, b] of [[0.04, 0.48], [0.52, 0.96]]) { c.fillStyle = g; c.fillRect(pw * a, ph * 0.04, pw * (b - a), ph * 0.96); c.fillStyle = 'rgba(255,255,255,0.35)'; c.fillRect(pw * (a + 0.04), ph * 0.08, pw * 0.05, ph * 0.85); }
  c.fillStyle = '#9AA3AB'; c.fillRect(pw * 0.42, ph * 0.42, pw * 0.03, ph * 0.16); c.fillRect(pw * 0.55, ph * 0.42, pw * 0.03, ph * 0.16);
  c.fillStyle = 'rgba(60,50,40,0.25)'; for (let i = 0; i < 3; i++) c.fillRect(pw * (0.15 + i * 0.3), ph * 0.55, pw * 0.06, ph * 0.4); };
/** 天桥桥头的商场门：钢门框 + 自动玻璃门（门后亮着商场）+ 门头招牌；fx = 楼面 x，dir = 门朝向（+1 朝东 / −1 朝西） */
function bridgeGate(S, fx, br, dir, zh, en, col) {
  const k = S.kit, A = S.atlas, Y = br.y, zc = (br.z0 + br.z1) / 2, x = fx + dir * 0.06, steel = hex('#C3C9CF');
  for (const z of [br.z0 - 0.15, zc - 1.75, zc + 1.6, br.z1]) k.metal.slab(x - 0.12, x + 0.12, Y, Y + 3.0, z, z + 0.15, steel, { ao: false });
  k.metal.slab(x - 0.15, x + 0.15, Y + 3.0, Y + 3.7, br.z0 - 0.15, br.z1 + 0.15, hex(col), { ao: false });
  A.quad(x + dir * 0.17, Y + 3.35, zc, 5.6, 0.62, aS(dir, 0), A.draw(5.6, 0.62, textPaint([zh, en], { bg: col, fg: '#FFFFFF' }), 50));
  A.quad(x + dir * 0.02, Y + 1.5, zc, 3.2, 3.0, aS(dir, 0), S._smDoorUv || (S._smDoorUv = A.draw(3.2, 3.0, doorArt, 40)));
  for (const [a, b] of [[br.z0, zc - 1.75], [zc + 1.75, br.z1]]) k.glass.slab(x - 0.02, x + 0.02, Y, Y + 3.0, a, b, hex('#D6EEF8'), { ao: false });
  k.glow.slab(x + dir * 0.18 - 0.02, x + dir * 0.18 + 0.02, Y + 2.95, Y + 3.0, zc - 1.6, zc + 1.6, hex('#FFF4DA'), { ao: false });
}
/** 地面的楼门（红宝石 / 蓝宝石 / 三期）：门框 + 玻璃门 + 门头；ax 'z' = 门在北立面（z = fixed），否则 dir = ±1 东 / 西立面 */
function groundDoor(S, a, b, dir, label, col) {
  const k = S.kit, A = S.atlas, steel = hex('#C3C9CF'), north = dir === 'z';
  const nx = north ? 0 : dir, nz = north ? 1 : 0, cx = north ? a : a + dir * 0.06, cz = north ? b + 0.06 : b;
  const box = (u0, u1, y0, y1, t = 0.12) => north ? k.metal.slab(cx + u0, cx + u1, y0, y1, cz - t, cz + t, steel, { ao: false }) : k.metal.slab(cx - t, cx + t, y0, y1, cz + u0, cz + u1, steel, { ao: false });
  box(-1.95, -1.75, 0, 3.4); box(1.75, 1.95, 0, 3.4); box(-1.95, 1.95, 3.0, 3.4);
  A.quad(cx + nx * 0.02, 1.5, cz + nz * 0.02, 3.5, 3.0, aS(nx, nz), S._smDoorUv || (S._smDoorUv = A.draw(3.2, 3.0, doorArt, 40)));
  A.quad(cx + nx * 0.14, 3.95, cz + nz * 0.14, 5, 0.8, aS(nx, nz), A.draw(5, 0.8, textPaint([label, '入口 ENTRANCE'], { bg: col, fg: '#FFFFFF' }), 50));
  if (north) k.metal.slab(cx - 2.6, cx + 2.6, 3.5, 3.6, cz, cz + 2.2, hex('#D5DADF'), { ao: false }); else k.metal.slab(Math.min(cx, cx + dir * 2.2), Math.max(cx, cx + dir * 2.2), 3.5, 3.6, cz - 2.6, cz + 2.6, hex('#D5DADF'), { ao: false });
}

/* ---------- 天桥 ---------- */
function skybridge(S, br, gapsS, piers, label, sub) {
  const k = S.kit, P = k.solid, A = S.atlas, GL = k.glass, G = k.glow, GR = k.g('granite');
  const { x0, x1, z0, z1, y: Y } = br, white = hex('#F4F5F6'), zc = (z0 + z1) / 2, TOP = Y + 3.6;
  // 天桥两侧玻璃墙单独一个材质、不反射环境贴图：通用 glass 反射的是户外 .env（里面有糊掉的绿树和暖色灯），
  //   顺着桥走时侧窗是掠射角，菲涅尔把这些反射放大成窗外一团团发光的绿 / 橙色糊斑（小美 05 截图）
  const GLW = k.g('glass@bridge'), gm = bucketMat(k.scene, k.M, 'glass@bridge'); gm.environmentIntensity = 0; gm.alpha = 0.22;
  GR.slab(x0, x1, Y - 0.3, Y, z0, z1, hex('#DCD6CB'), { ao: false }); k.colSlab(x0, x1, Y - 0.6, Y, z0, z1);
  for (let x = x0 + 1.2; x < x1; x += 1.2) P.quad([x, Y + 0.004, z0], [x + 0.05, Y + 0.004, z0], [x + 0.05, Y + 0.004, z1], [x, Y + 0.004, z1], hex('#B9B2A6'));
  for (const z of [z0 + 1.5, z1 - 1.5]) P.quad([x0, Y + 0.004, z], [x1, Y + 0.004, z], [x1, Y + 0.004, z + 0.05], [x0, Y + 0.004, z + 0.05], hex('#B9B2A6'));
  // 白钢箱梁 + 底板
  for (const [a, b] of [[z0 - 0.2, z0 + 0.35], [z1 - 0.35, z1 + 0.2]]) P.slab(x0, x1, Y - 1.8, Y - 0.3, a, b, white, { ao: false });
  P.slab(x0, x1, Y - 1.85, Y - 1.7, z0, z1, hex('#E2E4E6'), { ao: false });
  // 立柱（每 4 m）+ 玻璃墙（楼梯口留洞）
  for (let x = x0; x <= x1 + 0.01; x += 4) for (const z of [z0, z1]) P.slab(x - 0.12, x + 0.12, Y, TOP, z - 0.12, z + 0.12, white, { ao: false });
  const segs = (side, gaps) => { let out = [[x0, x1]]; for (const [ga, gb] of gaps) out = out.flatMap(([a, b]) => gb <= a || ga >= b ? [[a, b]] : [[a, ga], [gb, b]].filter(([p, q]) => q - p > 0.2)); return out; };
  for (const [z, gaps] of [[z0, gapsS], [z1, []]]) for (const [a, b] of segs(z, gaps)) { GLW.slab(a, b, Y, TOP, z - 0.03, z + 0.03, hex('#D6EEF8'), { ao: false }); k.colSlab(a, b, Y, TOP, z - 0.1, z + 0.1); P.slab(a, b, Y + 0.95, Y + 1.0, z + (z === z0 ? 0.05 : -0.1), z + (z === z0 ? 0.1 : -0.05), hex('#C9CED3'), { ao: false }); }
  for (const [ga, gb] of gapsS) P.slab(ga, gb, TOP - 0.6, TOP, z0 - 0.15, z0 + 0.15, white, { ao: false });
  // 两头不再封墙：桥头是商场的自动玻璃门（bridgeGate），走到门口进楼内 2F（见 S.enterDoors 里 y: 6 的门）
  // 屋面 + 夜景灯带
  P.slab(x0 - 0.3, x1 + 0.3, TOP, TOP + 0.35, z0 - 0.45, z1 + 0.45, white, { ao: false });
  for (const z of [z0 - 0.47, z1 + 0.43]) G.slab(x0, x1, TOP + 0.05, TOP + 0.13, z, z + 0.04, hex('#BFE6FF'), { ao: false });
  G.slab(x0 + 1, x1 - 1, TOP - 0.04, TOP, zc - 0.25, zc + 0.25, hex('#FFF8EC'), { ao: false });
  for (const z of [z0 - 0.23, z1 + 0.19]) G.slab(x0, x1, Y - 1.9, Y - 1.84, z, z + 0.04, hex('#BFE6FF'), { ao: false });
  // 桥墩（嘉禾路两侧人行道 / 中央分隔带）
  for (const px of piers) { P.cyl(px, (Y - 1.8) / 2, zc, 1.3, Y - 1.8, white, 12, 0, 0, 0, 1.0, { ao: false }); k.colSlab(px - 0.65, px + 0.65, 0, Y - 1.8, zc - 0.65, zc + 0.65); }
  // 桥身招牌（两面）
  const mid = (x0 + x1) / 2, sp = A.draw(26, 1.2, (c, pw, ph) => { c.fillStyle = '#FFFFFF'; c.fillRect(0, 0, pw, ph); smLogo(c, ph, ph, { bg: '#FFFFFF' }); c.fillStyle = SM_NAVY; c.textBaseline = 'middle'; c.textAlign = 'left';
    c.font = `900 ${ph * 0.5}px ${FONT}`; c.fillText(label, ph * 1.2, ph * 0.38); c.font = `700 ${ph * 0.24}px ${FONT_EN}`; c.fillText(sub, ph * 1.2, ph * 0.8); }, 26);
  A.quad(mid, Y - 1.05, z0 - 0.25, 26, 1.2, aS(0, -1), sp); A.quad(mid, Y - 1.05, z1 + 0.25, 26, 1.2, aS(0, 1), sp);
}
/** 天桥一头：直跑楼梯（x sx..sx+4，z zb→zt）+ 旁边一部上行扶梯 + 玻璃雨棚 */
function bridgeStairs(S, sx, zb, zt, esc) {
  const k = S.kit, Y = 6, L = zt - zb, ang = Math.atan2(Y, L);
  k.stairs('z', zb, 0, zt, Y, sx, sx + 4, 0, '#CFC9BE', { rails: true });
  if (esc) escalator(k, [sx + 5.4, 0, zb], [sx + 5.4, Y, zt], 1.1, true);
  const x1 = sx + (esc ? 6.4 : 4.3), cx = (sx - 0.3 + x1) / 2, w = x1 - sx + 0.3;
  k.glass.box(cx, Y / 2 + 3.0, (zb + zt) / 2, w, 0.06, Math.hypot(L, Y), hex('#CFE8F4'), 0, -ang, 0);
  for (const z of [zb + 1, zt - 1]) for (const x of [sx - 0.3, x1]) { const yTop = (z - zb) / L * Y + 3.0; k.metal.slab(x - 0.08, x + 0.08, Math.max(0, yTop - 3.1), yTop, z - 0.08, z + 0.08, hex('#E6E8EA'), { ao: false }); }
}

/* ---------- 车流（实例：每种车一个网格） ---------- */
function carGeo(col, bus = false) {
  const g = new Geo(), c = hex(col), dk = hex('#2A2F35'), gl = hex('#6E8796');
  if (bus) { g.box(0, 1.75, 0, 2.5, 2.9, 11.6, c, 0, 0, 0, 1, { ao: false }); g.box(0, 2.15, 0, 2.54, 1.0, 11.0, gl, 0, 0, 0, 1, { ao: false }); g.box(0, 3.25, 0, 2.3, 0.15, 10, hex('#E6E8EA'), 0, 0, 0, 1, { ao: false }); }
  else { g.box(0, 0.65, 0, 1.8, 0.7, 4.4, c, 0, 0, 0, 1, { ao: false }); g.box(0, 1.25, -0.2, 1.6, 0.55, 2.3, gl, 0, 0, 0, 1, { ao: false }); }
  const wz = bus ? 4 : 1.4, wr = bus ? 0.95 : 0.66;
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) g.cyl(sx * (bus ? 1.15 : 0.82), wr / 2, sz * wz, wr, 0.3, dk, 8, 0, 0, Math.PI / 2, undefined, { ao: false });
  return g;
}
function traffic(S) {
  const k = S.kit, mat = bucketMat(S.scene, k.M, 'paint');
  const srcs = ['#F4F4F2', '#2B2F35', '#C8322A', '#8A9AA8'].map((c, i) => { const m = carGeo(c).toMesh('smCar' + i, S.scene, mat, k.root); m.receiveShadows = false; return m; });
  const bus = carGeo('#2E8B57', true).toMesh('smBus', S.scene, mat, k.root); bus.receiveShadows = false;
  const cars = []; let n = 0;
  const add = (src, x, y, z, vx, vz, lo, hi) => { const m = n++ < srcs.length + 1 && !src.__used ? (src.__used = true, src) : src.createInstance('smCarI' + n); if (m !== src) m.parent = k.root; m.position.set(x, y, z); m.rotation.y = Math.atan2(vx, vz); cars.push({ m, vx, vz, lo, hi }); };
  // 嘉禾路：北行 3 车道（东半幅），南行 3 车道（西半幅）
  [[-18.6, 1], [-23, 1], [-27.4, 1], [-33, -1], [-37.5, -1], [-42, -1]].forEach(([x, d], li) => { for (let i = 0; i < 3; i++) add(srcs[(li + i) % 4], x, 0, -58 + i * 86 + li * 23, 0, d * (8 + li % 3), -60, 200); });
  add(bus, -18.6, 0, 120, 0, 6, -60, 200); add(bus, -42, 0, 30, 0, -6, -60, 200);
  // 仙岳路地面 + 高架
  [[-37, -1, 0], [-33, -1, 0], [-21, 1, 0], [-17, 1, 0], [-32.5, -1, 9.8], [-28, -1, 9.8], [-26, 1, 9.8], [-21.5, 1, 9.8]].forEach(([z, d, y], li) => { for (let i = 0; i < 2; i++) add(srcs[(li + i + 1) % 4], -150 + i * 160 + li * 31, y, z, d * (10 + li % 3), 0, -160, 160); });
  S.tick = dt => { for (const c of cars) { const p = c.m.position; p.x += c.vx * dt; p.z += c.vz * dt;
    if (c.vz) { if (p.z > c.hi) p.z = c.lo; if (p.z < c.lo) p.z = c.hi; } else { if (p.x > c.hi) p.x = c.lo; if (p.x < c.lo) p.x = c.hi; } } };
}

/* 室内：见 xmSMMall.js（SmMall：每栋楼单独加载，多层 + 扶梯 + 观光电梯 + 楼梯 + 天桥门） */
export { SmMall } from './xmSMMall.js';
