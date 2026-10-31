/*
 * 乌石浦站 4B 出口：厦门 SM 城市广场（SM 厦门综合体）。
 *   一期 SM城市广场（嘉禾路468号，嘉禾路东、仙岳路北，2001-12 开业）：浅色大方盒子 + SM 圆标 + 沃尔玛蓝招牌；
 *   二期 SM新生活广场（嘉禾路399号，嘉禾路西，Arquitectonica 设计）：红宝石（长条）+ 黄宝石（圆楼）+ 蓝宝石（方楼，万达影城）；
 *   SM 天桥（2013-09-26 通行）：94 m 横跨嘉禾路连一期 / 二期，白钢架 + 落地玻璃 + 瓷砖地，两头楼梯 + 扶梯；
 *   第二座过街天桥：一期 ↔ 三期（嘉禾路401号，在二期北侧）。
 * 资料与出入口核对见 /workspace/xmlogs/sm/research.md（PR 描述里有摘要）。
 * 坐标同 xmStreet：出口亭（4B）在原点、开口朝 +z（北）；+x = 东。仙岳路 z −40..−14（东西向，带高架），嘉禾路 x −46..−14（南北向）。
 * 室内：一期 / 二期黄宝石的正门走进去单独加载 SmAtrium（多层中庭 + 扶梯 + 一圈店铺 + 逛街的人）。
 */
import { Geo, hex } from '../core/geo.js';
import * as D from './decor.js';
import { Kit, bucketMat } from './kit.js';
import { FoodAtlas } from '../game/food-art.js';
import { textPaint, FONT, FONT_EN } from './xmStreet.js';
import { ringCol } from './xmAttr.js';
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
/** 二期外墙：白色菱形格（Arquitectonica 的“钻石”立面），accent 色做竖向彩带 */
function wallDiamond(accent, glass = false) {
  return (c, pw, ph) => {
    c.fillStyle = '#F2F1ED'; c.fillRect(0, 0, pw, ph);
    const s = pw / 4, hs = s * 0.75;
    for (let row = -1; row * hs < ph + hs; row++) for (let col = -1; col * s < pw + s; col++) {
      const x = col * s + (row % 2 ? s / 2 : 0), y = row * hs;
      c.beginPath(); c.moveTo(x, y - hs); c.lineTo(x + s / 2, y); c.lineTo(x, y + hs); c.lineTo(x - s / 2, y); c.closePath();
      c.fillStyle = (row + col) % 3 === 0 ? (glass ? '#9DB8C9' : '#E4E6E8') : '#F6F5F2'; c.fill();
      c.strokeStyle = '#C3C8CD'; c.lineWidth = Math.max(1.5, s * 0.04); c.stroke();
    }
    if (accent) { c.fillStyle = accent; c.globalAlpha = 0.9; c.fillRect(pw * 0.06, 0, pw * 0.05, ph); c.fillRect(pw * 0.89, 0, pw * 0.05, ph); c.globalAlpha = 1; }
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
function storefront(warm = '#F6E3C0') {
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
const brandPaint = n => { const [bg, fg] = BRANDS[n] || ['#2B2F35', '#FFFFFF']; return textPaint([n], { bg, fg }); };

/* ---------------- 小工具 ---------------- */
/** 街面底层店面（一 / 二 / 三期共用一张） */
const shopUv = S => S._smShop || (S._smShop = S.atlas.draw(12, 4.6, storefront(), 26));
/** 竖直四边形：p0→p1（水平端点 [x,z]），法线朝 (ez, −ex) 一侧 */
function wallQ(B, p0, p1, y0, y1, col) { B.quad([p0[0], y0, p0[1]], [p1[0], y0, p1[1]], [p1[0], y1, p1[1]], [p0[0], y1, p0[1]], col); }
/** 水平四边形（朝上 up=true / 朝下），四点按 [x,z] 给 */
function flatQ(B, pts, y, col, up = true) {
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
function shopper(P, x, y, z, ry, i, o = {}) {
  if (o.lo) return lowPerson(P, x, y, z, ry, i, o.kid || i % 5 === 2);
  const r = prnd();
  if (o.kid || i % 6 === 2) return bakePerson(P, x, y, z, ry, randomLook({ kid: true, scale: 0.92, bag: r < 0.4 ? 'backpack' : null }), r < 0.5 ? WALK : POSES.stand);
  if (i % 9 === 4) return bakePerson(P, x, y, z, ry, archetypeLook('granny'), POSES.stand);
  const bags = r < 0.65 ? [BAGS[(i * 3) % BAGS.length], r < 0.3 ? BAGS[(i * 5 + 1) % BAGS.length] : null] : null;
  const phone = !bags && r > 0.85;
  return bakePerson(P, x, y, z, ry, randomLook({ shopBags: bags, bag: bags ? null : (r > 0.75 ? 'shoulder' : null), phone }), phone ? PHONE : (o.stand ? POSES.stand : WALK));
}
/** 一家人：大人 + 小孩（并排走） */
function family(P, x, y, z, ry, i, lo = false) {
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

  phase1(S); phase2(S); phase3(S);
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
    [52, 182, 56, 24, 34, '#CFC9BE'], [130, 140, 30, 60, 52, '#C6CCD2'], [130, 60, 30, 50, 30, '#D4CEC4']]);

  // ---------- 人：出口、一期门口、天桥下、二期广场 ----------
  const crowd = [
    [3, 6, 0.3], [-1.5, 9, 0.1], [6, 12, 0.8], [10, 15, 0.6], [14, 10, -0.4], [22, 14, 0.2], [30, 17, 1.2], [46, 18, -0.3], [55, 17, 0.4], [60, 15, 2.8],
    [70, 16, -1.6], [-6, 30, 0.05], [-8, 52, 3.1], [-4, 76, 0.2], [-7, 104, 3.0], [-60, 30, 0.4], [-56, 80, 2.9], [-70, 100, 1.6], [-62, 16, -0.4], [-52, 120, 0.2],
  ];
  crowd.forEach(([x, z, r], i) => shopper(P, x, 0, z, r, i, { lo: i >= 8 }));   // 出口 / 一期门口近处用细模，远处低模
  family(P, 34, 12, Math.PI * 0.95, 1); family(P, -64, 60 - 18, Math.PI, 2, true); family(P, -9, 40, 0.1, 3, true);
  for (let i = 0; i < 8; i++) shopper(P, -70 + i * 10 + (i % 2) * 2, BR1.y, BR1.z0 + 1.6 + (i % 3) * 1.4, i % 2 ? Math.PI / 2 : -Math.PI / 2, i + 40, { lo: i % 2 === 0 });
  for (let i = 0; i < 3; i++) shopper(P, -40 + i * 22, BR2.y, BR2.z0 + 2 + i, i % 2 ? Math.PI / 2 : -Math.PI / 2, i + 50, { lo: true });

  traffic(S);
  // ---------- 进门 ----------
  S.enterDoors = [
    { x: 51, z: P1.z0 - 0.3, halfW: 1.6, zLo: -0.4, zHi: 0.8, outPos: [51, P1.z0 - 2.4], outYaw: Math.PI, id: 'sm-city', make: (scene, o) => new SmAtrium(scene, o, 'city') },
    { ax: 'x', s: -1, x: TOPAZ.cx + TOPAZ.r + 0.3, z: TOPAZ.cz, halfW: 1.6, zLo: -0.4, zHi: 0.8, outPos: [TOPAZ.cx + TOPAZ.r + 2.6, TOPAZ.cz], outYaw: Math.PI / 2, id: 'sm-topaz', make: (scene, o) => new SmAtrium(scene, o, 'topaz') },
  ];
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
  // 天桥接口（西立面 2F）：入口框 + 灯箱
  for (const br of [BR1, BR2]) { k.metal.slab(x0 - 0.4, x0, br.y, br.y + 4.2, br.z0 - 0.6, br.z1 + 0.6, hex('#E6E8EA'), { ao: false });
    A.quad(x0 - 0.45, br.y + 1.6, (br.z0 + br.z1) / 2, 4.2, 3.0, aS(-1, 0), A.draw(4.2, 3.0, textPaint(['SM城市广场 2F', 'SM City · Level 2'], { bg: '#2B3036', fg: '#FFFFFF' }), 40)); }
}

/* ---------- 二期：SM新生活广场（红宝石 + 玻璃中庭 + 黄宝石 + 蓝宝石） ---------- */
function phase2(S) {
  const k = S.kit, P = k.solid, A = S.atlas, G = k.glow, GL = k.glass;
  const white = A.draw(12, 16, wallDiamond('#C8102E'), 13), store = shopUv(S);
  // 红宝石：长条楼，白钻石格 + 红色竖带 / 红色檐口
  { const { x0, x1, z0, z1, h } = RUBY;
    P.slab(x0, x1, 0, h, z0, z1, hex('#E9E8E4'), { ao: false }); k.colSlab(x0, x1, 0, h, z0, z1);
    for (const [axis, fixed, a0, a1, nrm] of [['z', x1, z0, z1, 1], ['x', z0, x0, x1, -1]]) { tileFace(A, white, axis, fixed, a0, a1, 5.5, h - 1.6, nrm, 12); tileFace(A, store, axis, fixed, a0, a1, 0, 4.6, nrm, 12); }
    k.g('band').slab(x0 - 0.4, x1 + 0.4, h - 1.6, h, z0 - 0.4, z1 + 0.4, hex('#C8102E'), { ao: false });
    k.g('band').slab(x0 - 0.3, x1 + 0.3, 4.6, 5.5, z0 - 0.3, z1 + 0.3, hex('#B0122A'), { ao: false });
    A.quad(x1 + 0.45, 16, 20, 9, 5, aS(1, 0), A.draw(9, 5, (c, pw, ph) => { c.fillStyle = '#F4F2EE'; c.fillRect(0, 0, pw, ph); c.fillStyle = '#111'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.font = `500 ${ph * 0.62}px Didot, "Bodoni 72", Georgia, serif`; c.fillText('ZARA', pw / 2, ph * 0.55); }, 30));
    A.quad(x1 + 0.45, 13.5, 38, 6, 9, aS(1, 0), A.draw(6, 9, (c, pw, ph) => { c.fillStyle = '#1D4F91'; c.fillRect(0, 0, pw, ph); c.fillStyle = '#FFDD00'; c.textAlign = 'center'; c.textBaseline = 'middle';
      c.font = `900 ${pw * 0.2}px ${FONT}`; ['玩具', '反斗城'].forEach((t, i) => c.fillText(t, pw / 2, ph * (0.2 + i * 0.2))); c.fillStyle = '#FFF'; c.font = `800 ${pw * 0.13}px ${FONT_EN}`; c.fillText('Toys"R"Us', pw / 2, ph * 0.62);
      c.font = `800 ${pw * 0.12}px ${FONT}`; c.fillText('4F 红宝石', pw / 2, ph * 0.82); }, 30));
    A.quad(-110, 15, z0 - 0.45, 12, 3, aS(0, -1), A.draw(12, 3, brandPaint('SEPHORA'), 30));
    A.quad(-132, 15, z0 - 0.45, 12, 3, aS(0, -1), A.draw(12, 3, brandPaint('Massimo Dutti'), 30));
    [['H&M', 30], ['海底捞', 44]].forEach(([n, z]) => A.quad(x1 + 0.3, 5.05, z, 6, 0.9, aS(1, 0), A.draw(6, 0.9, brandPaint(n), 40)));
    A.quad(-94, 5.05, z0 - 0.3, 6, 0.9, aS(0, -1), A.draw(6, 0.9, brandPaint('喜茶'), 40)); }
  // 玻璃连接中庭（天桥落在这里）+ 「SM新生活广场」
  { const { x0, x1, z0, z1, h } = LINK, cw = A.draw(11, 16, curtain(), 12);
    P.slab(x0, x1, 0, h, z0, z1, hex('#B9CAD6'), { ao: false }); k.colSlab(x0, x1, 0, h, z0, z1);
    tileFace(A, cw, 'z', x1, z0, z1, 0, h, 1, 11);
    P.slab(x0 - 0.3, x1 + 0.6, h, h + 0.8, z0 - 0.3, z1 + 0.3, hex('#E6E8EA'), { ao: false });
    A.quad(x1 + 0.7, h - 3.5, 52.5, 4.6, 4.6, aS(1, 0), A.draw(4.6, 4.6, (c, pw, ph) => smLogo(c, pw, ph, { bg: '#FFFFFF' }), 40));
    A.quad(x1 + 0.7, h - 3.5, 66, 18, 3.0, aS(1, 0), A.draw(18, 3, textPaint(['SM新生活广场', 'SM LIFESTYLE CENTER'], { bg: '#FFFFFF', fg: SM_NAVY }), 22));
    k.metal.slab(x1, x1 + 0.4, 6, 10.2, BR1.z0 - 0.6, BR1.z1 + 0.6, hex('#E6E8EA'), { ao: false }); }
  // 中庭和蓝宝石之间的裙房
  P.slab(-130, LINK.x0, 0, 14, 50, 72, hex('#E4E3DF'), { ao: false }); k.colSlab(-130, LINK.x0, 0, 14, 50, 72);
  // 黄宝石：圆楼，白格立面 + 金色环带；东侧正门
  { const { cx, cz, r, h } = TOPAZ, n = 24, gold = hex('#C9A24A'), gw = A.draw(6.3, 14, wallDiamond('#D9B45A'), 18), gs = A.draw(6.3, 4.6, storefront('#F6E7C4'), 26);
    const ap = r * Math.cos(Math.PI / n);
    for (let i = 0; i < n; i++) {
      const a = (i + 0.5) / n * TAU, nx = Math.cos(a), nz = Math.sin(a), x = cx + nx * ap, z = cz + nz * ap, w = 2 * r * Math.sin(Math.PI / n);
      const door = Math.abs(Math.atan2(nz, nx)) < 0.2;
      for (let j = 0; j < 2; j++) A.quad(x, 5.5 + (h - 5.5) / 4 * (2 * j + 1), z, w, (h - 5.5) / 2, aS(nx, nz), gw);
      if (!door) A.quad(x, 2.3, z, w, 4.6, aS(nx, nz), gs);
    }
    P.cyl(cx, h / 2, cz, 2 * r - 0.3, h, hex('#EEEDE8'), n, 0, 0, 0, undefined, { ao: false });
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
  // 蓝宝石：方楼，蓝色带 + 万达影城
  { const { x0, x1, z0, z1, h } = SAPH, blue = A.draw(12, 14, wallDiamond('#2E5DA8', true), 13);
    P.slab(x0, x1, 0, h, z0, z1, hex('#E6E8EC'), { ao: false }); k.colSlab(x0, x1, 0, h, z0, z1);
    tileFace(A, blue, 'z', x1, z0, z1, 14, h - 1.4, 1, 12); tileFace(A, blue, 'x', z0, x0, x1, 14, h - 1.4, -1, 12); tileFace(A, blue, 'x', z1, x0, x1, 4, h - 1.4, 1, 12);
    k.g('band').slab(x0 - 0.4, x1 + 0.4, h - 1.4, h, z0 - 0.4, z1 + 0.4, hex('#2E5DA8'), { ao: false });
    A.quad(x1 + 0.5, h - 5, 100, 14, 3.4, aS(1, 0), A.draw(14, 3.4, brandPaint('万达影城'), 30));
    A.quad(x1 + 0.5, h - 9, 100, 14, 2.2, aS(1, 0), A.draw(14, 2.2, textPaint(['蓝宝石  SAPPHIRE', '影城 · 健身'], { bg: '#2E5DA8', fg: '#FFFFFF' }), 30)); }
  // 天桥西头的「欢迎」灯箱
  A.quad(-47.5, 2.4, 40, 2.4, 3.2, aS(1, 0), A.draw(2.4, 3.2, (c, pw, ph) => smLogo(c, pw, ph, { label: 'SM新生活广场' }), 45));
  k.metal.slab(-47.75, -47.55, 0, 4.0, 38.7, 41.3, hex('#5C646C'), { ao: false }); k.colSlab(-47.8, -47.5, 0, 4, 38.7, 41.3);
}

/* ---------- 三期（嘉禾路401，二期北侧）：4 层裙楼 + voco 酒店塔楼 ---------- */
function phase3(S) {
  const k = S.kit, P = k.solid, A = S.atlas, { x0, x1, z0, z1, h } = P3;
  const cw = A.draw(12, 14, curtain('#7FA6BF'), 12), store = shopUv(S);
  P.slab(x0, x1, 0, h, z0, z1, hex('#D8DDE2'), { ao: false }); k.colSlab(x0, x1, 0, h, z0, z1);
  for (const [axis, fixed, a0, a1, nrm] of [['z', x1, z0, z1, 1], ['x', z0, x0, x1, -1]]) { tileFace(A, cw, axis, fixed, a0, a1, 6, h - 1, nrm, 12); tileFace(A, store, axis, fixed, a0, a1, 0, 4.6, nrm, 12); }
  k.g('band').slab(x0 - 0.3, x1 + 0.3, 4.6, 6, z0 - 0.3, z1 + 0.3, hex('#2B3036'), { ao: false });
  P.slab(x0 - 0.3, x1 + 0.3, h - 1, h + 0.6, z0 - 0.3, z1 + 0.3, hex('#EEF0F2'), { ao: false });
  A.quad(x1 + 0.45, 15, 168, 22, 3.4, aS(1, 0), A.draw(22, 3.4, textPaint(['SM厦门 三期', 'SM XIAMEN · PHASE III'], { bg: '#FFFFFF', fg: SM_NAVY }), 20));
  A.quad(x1 + 0.45, 15, 186, 4, 4, aS(1, 0), A.draw(4, 4, (c, pw, ph) => smLogo(c, pw, ph, { bg: '#FFFFFF' }), 40));
  // 酒店塔楼
  { const { x0, x1, z0, z1, h: th } = HOTEL, tw = A.draw(14, 20, curtain('#6F8FA6'), 9);
    P.slab(x0, x1, h, th, z0, z1, hex('#BFCBD4'), { ao: false });
    tileFace(A, tw, 'z', x1, z0, z1, h + 0.6, th - 2, 1, 14); tileFace(A, tw, 'x', z0, x0, x1, h + 0.6, th - 2, -1, 14);
    P.slab(x0 - 0.3, x1 + 0.3, th - 2, th, z0 - 0.3, z1 + 0.3, hex('#E9ECEE'), { ao: false });
    A.quad(x1 + 0.35, th - 5, 168, 12, 4, aS(1, 0), A.draw(12, 4, (c, pw, ph) => { c.fillStyle = '#E9ECEE'; c.fillRect(0, 0, pw, ph); c.fillStyle = '#E4007C'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.font = `800 ${ph * 0.6}px ${FONT_EN}`; c.fillText('voco', pw / 2, ph * 0.42); c.fillStyle = '#333'; c.font = `600 ${ph * 0.16}px ${FONT_EN}`; c.fillText('XIAMEN SM CITY', pw / 2, ph * 0.82); }, 30)); }
  // 三期 ↔ 二期 3F 连廊（落在黄宝石北侧）
  const cy = 11; S.kit.glass.slab(-108, -100, cy, cy + 4, TOPAZ.cz + TOPAZ.r - 3, z0 + 0.1, hex('#CFE6F2'), { ao: false });
  P.slab(-108.3, -99.7, cy - 0.6, cy, TOPAZ.cz + TOPAZ.r - 3, z0, hex('#EEF0F2'), { ao: false }); P.slab(-108.3, -99.7, cy + 4, cy + 4.4, TOPAZ.cz + TOPAZ.r - 3, z0, hex('#EEF0F2'), { ao: false });
  k.metal.slab(x1, x1 + 0.4, BR2.y, BR2.y + 4.2, BR2.z0 - 0.6, BR2.z1 + 0.6, hex('#E6E8EA'), { ao: false });
}

/* ---------- 天桥 ---------- */
function skybridge(S, br, gapsS, piers, label, sub) {
  const k = S.kit, P = k.solid, A = S.atlas, GL = k.glass, G = k.glow, GR = k.g('granite');
  const { x0, x1, z0, z1, y: Y } = br, white = hex('#F4F5F6'), zc = (z0 + z1) / 2, TOP = Y + 3.6;
  GR.slab(x0, x1, Y - 0.3, Y, z0, z1, hex('#DCD6CB'), { ao: false }); k.colSlab(x0, x1, Y - 0.6, Y, z0, z1);
  // 天桥两侧玻璃墙单独一个材质、不反射环境贴图：通用 glass 反射的是户外 .env（里面有糊掉的绿树和暖色灯），
  //   顺着桥走时侧窗是掠射角，菲涅尔把这些反射放大成窗外一团团发光的绿 / 橙色糊斑（小美 05 截图）
  const GLW = k.g('glass@bridge'), gm = bucketMat(k.scene, k.M, 'glass@bridge'); gm.environmentIntensity = 0; gm.alpha = 0.22;
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
  k.colSlab(x0 - 0.2, x0, Y, TOP, z0, z1); k.colSlab(x1, x1 + 0.2, Y, TOP, z0, z1);   // 两头是商场的门（关着时也能当过街天桥：这里不进商场）
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

/* ====================== 室内：多层中庭（单独加载） ====================== */
/**
 * 局部坐标：原点在门内侧，门朝 −z 出楼。中庭中心 (0, CZ)；正 n 边形：中空 apothem 8、店面 15、外墙 21；层高 5.5，5 层。
 * variant 'topaz' = 二期黄宝石（16 边近似圆、金色）；'city' = 一期（方、蓝色）。
 * 1F → 2F 一部可走的扶梯（北侧）。中空顶上是玻璃天窗（看得到蓝天白云），黄宝石的栏杆扶手 / 柱子包金色金属。
 */
const CZ = 21, AV = 8, AS = 15, AW = 21, FH = 5.5, NF = 5, GOLD = hex('#D4A84A');
const SHOPS = {
  // 黄宝石：每层 16 间、共 5 层；每个名字只出现一次（不在一圈里重复）
  topaz: ['MUJI 无印良品', 'SWAROVSKI', '周大福', '星巴克', 'Apple 授权店', 'ZARA', '屈臣氏', '丝芙兰', '潘多拉', '周生生', 'Swatch', '雅诗兰黛', '兰蔻', 'COACH', '施华洛世奇童话', '老凤祥',
    '例外', '花潮', 'UR', 'Lily', 'ONLY', 'VERO MODA', 'GAP', 'H&M', '优衣库', '太平鸟', '江南布衣', 'MO&Co.', 'Ochirly', '歌莉娅', '马克华菲', '森马',
    'NIKE', 'adidas', '安踏', '李宁', '特步', '361°', 'New Balance', 'Skechers', 'FILA', '迪卡侬', '华为', '小米之家', 'OPPO', 'vivo', '大疆', '漫步者',
    '巴拉巴拉 童装', '泡泡玛特', '名创优品', '乐高', '迪士尼童装', '小猪班纳', '好孩子', '奥特曼玩具', '西西弗书店', '言几又', '晨光文具', '酷乐潮玩', 'Hello Kitty', '万代', '孩子王', '布鲁可',
    '西贝莜面村', '海底捞', '喜茶', '奈雪的茶', '必胜客', '外婆家', '绿茶餐厅', '太二酸菜鱼', '鼎泰丰', '吉野家', '味千拉面', '麦当劳', '肯德基', '黄则和花生汤', '沙县小吃', '万达影城'],
  city: ['麦当劳', '屈臣氏', 'KFC 肯德基', 'ESPRIT', '面包新语', 'SM百货', '沃尔玛 B1', '数码广场', '家居生活', '美食广场', '优衣库', '星巴克', '周大福', '名创优品', '泡泡玛特', '巴拉巴拉 童装'],
};
export class SmAtrium {
  constructor(scene, origin, variant = 'topaz') {
    this.variant = variant; this.id = variant === 'topaz' ? 'sm-topaz' : 'sm-city';
    const k = this.kit = new Kit(scene, 'smAtrium'); k.root.position.set(origin.x, origin.y, origin.z); this.o = origin;
    const A = this.atlas = new FoodAtlas(scene, 1024), P = k.solid, GL = k.glass, G = k.glow, GR = k.g('granite');
    const topaz = variant === 'topaz', n = topaz ? 16 : 4, accent = hex(topaz ? '#C9A24A' : '#2E5DA8'), white = hex('#F3F1EC');
    preseed(topaz ? 6161 : 6262);
    const t = Math.tan(Math.PI / n);
    const phi = s => -Math.PI / 2 + s * TAU / n;
    const vtx = (s, ap, e) => { const a = phi(s) + e * Math.PI / n, R = ap / Math.cos(Math.PI / n); return [Math.cos(a) * R, CZ + Math.sin(a) * R]; };   // e=−1/+1：这一边的两个角
    const aIn = s => Math.atan2(-Math.cos(phi(s)), -Math.sin(phi(s)));   // 朝中庭的 atlas 角（raw：法线 (sin a, cos a)）
    // 黄宝石的金色金属单独一桶，带一点自发光：从下往上看时金边不会暗成深褐色（+1 draw）
    const GM = topaz ? k.g('metal@gold') : k.metal;
    if (topaz) bucketMat(scene, k.M, 'metal@gold').emissiveColor.set(0.32, 0.23, 0.07);

    // ---------- 地面 / 楼板 / 屋顶 ----------
    k.floorWithHoles(-AW - 1, AW + 1, 0, CZ + AW + 1, -0.15, 0, hex('#E8E4DC'), [], true, 'granite');
    for (let r = 0; r < 3; r++) for (let s = 0; s < n; s++) {   // 中庭地面的金 / 蓝色圈（不是导向线）
      const ap = 2 + r * 2.2, p = [vtx(s, ap, -1), vtx(s, ap, 1), vtx(s, ap + 0.25, 1), vtx(s, ap + 0.25, -1)]; flatQ(P, p, 0.005, accent);
    }
    for (let f = 1; f < NF; f++) {
      const y = f * FH;
      for (let s = 0; s < n; s++) {
        const q = [vtx(s, AV, -1), vtx(s, AV, 1), vtx(s, AW, 1), vtx(s, AW, -1)];
        flatQ(GR, q, y, hex('#E9E5DD'), true); flatQ(P, q, y - 0.6, white, false);
        const a = vtx(s, AV, -1), b = vtx(s, AV, 1);
        wallQ(P, b, a, y - 0.6, y, white);                      // 中空边的楼板侧面（朝中庭）
        G.quad([b[0], y - 0.62, b[1]], [a[0], y - 0.62, a[1]], [a[0], y - 0.55, a[1]], [b[0], y - 0.55, b[1]], hex('#FFF4DA'));
        // 栏杆：2F 可走（带碰撞），往上只做玻璃 + 扶手
        const gap = f === 1 && s === n / 2;
        const segs = gap ? [[a, [-1.0, a[1] + (b[1] - a[1]) * ((-1.0 - a[0]) / (b[0] - a[0] || 1))]], [[1.0, a[1] + (b[1] - a[1]) * ((1.0 - a[0]) / (b[0] - a[0] || 1))], b]] : [[a, b]];
        for (const [p0, p1] of segs) {
        for (const ap of [10.5, 13.5]) for (const e of [-0.5, 0.5]) {   // 楼板底的筒灯（不让天花板一片空灰）
          const a0 = phi(s) + e * Math.PI / n, R = ap / Math.cos(Math.PI / n), cx = Math.cos(a0) * R, cz = CZ + Math.sin(a0) * R, h = 0.22;
          flatQ(G, [[cx - h, cz - h], [cx + h, cz - h], [cx + h, cz + h], [cx - h, cz + h]], y - 0.61, hex('#FFF6E0'), false); }
        if (topaz) { const nx0 = Math.cos(phi(s)) * 0.03, nz0 = Math.sin(phi(s)) * 0.03;   // 楼板边包一条金色金属（略往中空外凸）
          GM.quad([b[0] - nx0, y - 0.5, b[1] - nz0], [a[0] - nx0, y - 0.5, a[1] - nz0], [a[0] - nx0, y - 0.05, a[1] - nz0], [b[0] - nx0, y - 0.05, b[1] - nz0], GOLD); }
          if (f === 1) { k.rail(p0[0], p0[1], p1[0], p1[1], y); if (topaz) GM.tube([p0[0], y + 1.12, p0[1]], [p1[0], y + 1.12, p1[1]], 0.09, GOLD, 8); }
          else { const len = Math.hypot(p1[0] - p0[0], p1[1] - p0[1]), ry = Math.atan2(p1[0] - p0[0], p1[1] - p0[1]); GL.box((p0[0] + p1[0]) / 2, y + 0.55, (p0[1] + p1[1]) / 2, 0.03, 0.9, len, hex('#E2F2FA'), ry); GM.tube([p0[0], y + 1.08, p0[1]], [p1[0], y + 1.08, p1[1]], topaz ? 0.09 : 0.06, topaz ? GOLD : hex('#C9CFD5'), 6); }
        }
        if (f === 1) { const mx = Math.cos(phi(s)) * (AV + AW) / 2, mz = CZ + Math.sin(phi(s)) * (AV + AW) / 2; k.col(mx, y - 0.3, mz, 2 * (AV + AW) / 2 * t + 0.6, 0.6, AW - AV, { ry: Math.atan2(Math.cos(phi(s)), Math.sin(phi(s))) }); }
      }
    }
    const RY = NF * FH;
    for (let s = 0; s < n; s++) { const q = [vtx(s, AV, -1), vtx(s, AV, 1), vtx(s, AW, 1), vtx(s, AW, -1)]; flatQ(P, q, RY, white, false); flatQ(GL, [vtx(s, 0.01, -1), vtx(s, AV, -1), vtx(s, AV, 1), vtx(s, 0.01, 1)], RY + 1.2, hex('#CFE6F4'), false);
      const a = vtx(s, AV, -1), b = vtx(s, AV, 1); wallQ(P, b, a, RY, RY + 1.2, white); }
    // 天窗：玻璃上方一块不受光照的天空（蓝天 + 几朵白云），玻璃分格用金色（黄宝石）/ 银色金属框
    const SKY = RY + 1.7;
    for (let s = 0; s < n; s++) flatQ(G, [vtx(s, 0.01, -1), vtx(s, AW, -1), vtx(s, AW, 1), vtx(s, 0.01, 1)], SKY, hex('#5FA8E6'), false);
    for (const [cx, cz, rx, rz] of [[-3, CZ - 2, 2.6, 1.3], [3.5, CZ + 3, 3.2, 1.5], [-1, CZ + 5.5, 1.8, 0.9], [4.5, CZ - 4.5, 1.6, 0.8]])
      for (let i = 0; i < 10; i++) { const a0 = i / 10 * TAU, a1 = (i + 1) / 10 * TAU; const c0 = [cx, SKY - 0.05, cz], p1 = [cx + Math.cos(a1) * rx, SKY - 0.05, cz + Math.sin(a1) * rz], p0 = [cx + Math.cos(a0) * rx, SKY - 0.05, cz + Math.sin(a0) * rz]; G.quad(c0, p1, p0, c0, hex('#F6FAFF')); G.quad(c0, p0, p1, c0, hex('#F6FAFF')); }
    const MUL = topaz ? GOLD : hex('#C9CFD5');
    for (let s = 0; s < n; s++) { const a = vtx(s, AV, -1), b = vtx(s, AV, 1); GM.tube([0, RY + 1.15, CZ], [a[0], RY + 1.15, a[1]], 0.12, MUL, 6); GM.tube([a[0], RY + 1.15, a[1]], [b[0], RY + 1.15, b[1]], 0.14, MUL, 6);
      const m0 = vtx(s, AV * 0.5, -1), m1 = vtx(s, AV * 0.5, 1); GM.tube([m0[0], RY + 1.15, m0[1]], [m1[0], RY + 1.15, m1[1]], 0.1, MUL, 6); }

    // ---------- 店铺：每层每边一圈（店面 apothem 15），1F 南侧留门厅 ----------
    const glassUv = A.draw(9, 3.6, storefront(topaz ? '#F6E7C4' : '#E4EEF8'), 24);
    const names = SHOPS[variant], signUv = {};
    const sUv = nm => signUv[nm] || (signUv[nm] = A.draw(6, 0.8, brandPaint(nm), 36));
    let si = 0;
    for (let f = 0; f < NF; f++) {
      const y = f * FH;
      for (let s = 0; s < n; s++) {
        const half = AS * t, L = 2 * half, per = Math.max(1, Math.round(L / 9));
        let parts = []; for (let i = 0; i < per; i++) parts.push([-half + L * i / per, -half + L * (i + 1) / per]);
        if (f === 0 && s === 0) parts = parts.flatMap(([a, b]) => b <= -3 || a >= 3 ? [[a, b]] : [[a, -3], [3, b]].filter(([p, q]) => q - p > 1.5 && (q <= -3 || p >= 3)));
        const ph = phi(s), nx = Math.cos(ph), nz = Math.sin(ph), ex = -Math.sin(ph), ez = Math.cos(ph);   // e：沿这一边（逆时针）
        for (const [a, b] of parts) {
          const c = (a + b) / 2, w = b - a, x = nx * AS + ex * c, z = CZ + nz * AS + ez * c;
          A.quad(x, y + 2.0, z, w - 0.3, 3.6, aIn(s), glassUv);
          const nm = (f === 4 && !topaz) ? '美食广场' : (f === 3 && !topaz && s % 2) ? '家居生活' : names[si++ % names.length];
          A.quad(x - nx * 0.05, y + 4.3, z - nz * 0.05, Math.min(w - 0.6, 6), 0.8, aIn(s), sUv(nm));
          P.box(x + nx * 0.1, y + 4.3, z + nz * 0.1, w, 1.4, 0.2, hex('#3A3F45'), Math.atan2(nx, nz), 0, 0, 1, { ao: false });
        }
        for (const e of [-1, 1]) { const p = vtx(s, AS, e); (topaz ? GM : P).slab(p[0] - 0.3, p[0] + 0.3, y, y + FH - 0.6, p[1] - 0.3, p[1] + 0.3, topaz ? GOLD : white, { ao: false }); }   // 店间柱：黄宝石包金
        if (f < 2) { const mx = nx * (AS + 0.4), mz = CZ + nz * (AS + 0.4); if (!(f === 0 && s === 0)) k.col(mx, y + 2.6, mz, L + 1, 5.2, 0.6, { ry: Math.atan2(ex, ez) + Math.PI / 2 }); }
      }
    }
    // 1F 门厅：x ±3，z 0..6（南侧店面之间），门洞 |x|<2.4
    const zV = CZ - AS;
    for (const sx of [-1, 1]) { P.slab(sx * 3 - 0.15, sx * 3 + 0.15, 0, FH - 0.6, 0, zV, white, { ao: false }); k.colSlab(sx * 3 - 0.2, sx * 3 + 0.2, 0, FH, -0.2, zV); }
    if (!topaz) for (const sx of [-1, 1]) k.colSlab(sx * 3, sx * AS, 0, FH, zV - 0.6, zV - 0.2);
    P.slab(-3, 3, FH - 0.6, FH - 0.4, 0, zV, white, { ao: false });
    P.slab(-3.2, -2.4, 0, FH - 0.6, -0.2, 0.1, accent, { ao: false }); P.slab(2.4, 3.2, 0, FH - 0.6, -0.2, 0.1, accent, { ao: false }); P.slab(-3.2, 3.2, 3.6, FH - 0.6, -0.2, 0.1, white, { ao: false });
    k.colSlab(-3.3, -2.4, 0, FH, -0.3, 0.1); k.colSlab(2.4, 3.3, 0, FH, -0.3, 0.1);
    A.quad(0, 4.4, 0.15, 4.6, 0.7, 0, A.draw(4.6, 0.7, textPaint([topaz ? 'SM新生活广场 · 黄宝石' : 'SM城市广场'], { bg: topaz ? '#C9A24A' : SM_NAVY, fg: '#FFFFFF' }), 60));
    // 门外一小块地面 + 天光（同 XdfLobby）
    k.floorWithHoles(-3, 3, -5, 0, -0.15, 0, hex('#8E8A82'), [], true, 'pave');
    G.slab(-3, 3, 0, 3.2, -5.05, -5.0, hex('#DDE8F0'), { ao: false });
    k.colSlab(-3.1, 3.1, 0, 3.2, -5.2, -5.0); k.colSlab(-3.1, -3, 0, 3.2, -5, 0); k.colSlab(3, 3.1, 0, 3.2, -5, 0);
    // 楼层指引牌（门厅里，朝 +z 进来的人看得到；只写楼层，不画箭头）
    const dir = topaz ? [['5F', '影城 · 美食'], ['4F', '玩具反斗城（在红宝石）· 童装'], ['3F', '运动 · 数码'], ['2F', '女装 · 例外 · 花潮'], ['1F', 'MUJI · SWAROVSKI · 西贝']]
                      : [['5F', '美食广场'], ['4F', '家居生活'], ['3F', '数码广场'], ['2F', 'ESPRIT · SM百货'], ['1F', '麦当劳 · 屈臣氏 · KFC'], ['B1', '沃尔玛']];
    A.quad(-2.83, 2.0, 3.0, 2.6, 2.2, Math.PI / 2, A.draw(2.6, 2.2, (c, pw, ph) => { c.fillStyle = '#20262C'; c.fillRect(0, 0, pw, ph); const rh = ph / (dir.length + 1);
      c.fillStyle = topaz ? '#C9A24A' : '#2E5DA8'; c.fillRect(0, 0, pw, rh); c.fillStyle = '#FFF'; c.textBaseline = 'middle'; c.textAlign = 'center'; c.font = `800 ${rh * 0.55}px ${FONT}`; c.fillText('楼层指引 Directory', pw / 2, rh / 2);
      dir.forEach(([f, txt], i) => { c.textAlign = 'left'; c.fillStyle = '#F2C230'; c.font = `800 ${rh * 0.55}px ${FONT_EN}`; c.fillText(f, pw * 0.05, rh * (i + 1.5)); c.fillStyle = '#E8ECEF'; c.font = `600 ${rh * 0.42}px ${FONT}`; c.fillText(txt, pw * 0.2, rh * (i + 1.5)); }); }, 80));

    // ---------- 扶梯 ----------
    escalator(k, [0, 0, CZ - 1.5], [0, FH, CZ + AV], 1.2, true);
    // 2F 以上的交叉扶梯（飞天梯）去掉了：从 1F 往上看是一块悬在中空里的深灰斜板，挡住天窗（小美审稿）

    // ---------- 中庭吊饰：宝石 ----------
    const gy = RY - 4;
    k.metal.tube([0, RY, CZ], [0, gy + 1.6, CZ], 0.05, hex('#9AA1A8'), 4);
    P.cyl(0, gy, CZ, 2.6, 2.2, accent, 8, 0, 0, 0, 0.2, { ao: false }); P.cyl(0, gy + 1.4, CZ, 1.2, 0.6, accent, 8, 0, 0, 0, 2.6, { ao: false });
    for (let i = 0; i < 6; i++) { const a = i / 6 * TAU, r = 4.5, y = gy - 1 - (i % 3) * 1.2; k.metal.tube([Math.cos(a) * r, RY, CZ + Math.sin(a) * r], [Math.cos(a) * r, y + 0.5, CZ + Math.sin(a) * r], 0.03, hex('#9AA1A8'), 4);
      k.glass.cyl(Math.cos(a) * r, y, CZ + Math.sin(a) * r, 0.9, 1.0, hex(topaz ? '#F2D48A' : '#9CC7EE'), 6, 0, 0, 0, 0.1, { ao: false }); }

    // ---------- 人 ----------
    let pi = 0;
    for (let i = 0; i < 14; i++) { const a = i / 14 * TAU + 0.2, r = 10 + (i % 3) * 1.6, x = Math.cos(a) * r, z = CZ + Math.sin(a) * r; if (z < 7 && Math.abs(x) < 4) continue; shopper(P, x, 0, z, a + (i % 2 ? Math.PI / 2 : -Math.PI / 2), pi++, { lo: i % 2 === 1 }); }
    for (let i = 0; i < 6; i++) shopper(P, (i - 2.5) * 1.6, 0, 6 + (i % 3) * 2.5, i % 2 ? 0 : Math.PI, pi++);
    for (let f = 1; f < 4; f++) for (let i = 0; i < 6; i++) { const a = i / 6 * TAU + f, r = 11 + (i % 2), x = Math.cos(a) * r, z = CZ + Math.sin(a) * r; shopper(P, x, f * FH, z, a + Math.PI / 2, pi++, { lo: true }); }
    family(P, -5, 0, CZ - 6, 0.4, 9); family(P, 6, 0, CZ + 9, Math.PI + 0.3, 10, true);
    bakePerson(P, 0.1, 1.7, CZ + 1.4, 0, randomLook({ shopBags: ['#1F3B73', null] }), POSES.stand);   // 扶梯上

    k.finish(true); A.finish(k.root, 'smAtriumSigns');
  }
  wantsOut(p) { const lz = p.z - this.o.z, lx = p.x - this.o.x; return lz < -2.6 && Math.abs(lx) < 3 && p.y - this.o.y < 1.5; }
  spawn() { return [this.o.x, this.o.y + 0.05, this.o.z - 0.4, 0]; }
  zoneOf(p) { const f = Math.max(1, Math.min(NF, Math.round((p.y - this.o.y) / FH) + 1)); return { kind: 'interior', net: 'xm', building: this.id, floor: f, inUnit: false }; }
  dispose() { this.atlas.dispose(); this.kit.root.getChildMeshes(false).forEach(m => m.dispose()); this.kit.root.dispose(); }
}
