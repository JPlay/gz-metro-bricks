/*
 * SM 厦门 室内商场（每栋楼单独加载）：
 *   一期 SM城市广场 1–6F；二期 红宝石 / 黄宝石 / 蓝宝石 1–5F；三期 1–4F。
 * 每层都是真的一圈商场：楼板 + 走廊 + 店铺（每栋楼里店名不重复），1F 化妆品 · 珠宝，中间几层服装 / 运动 / 童装，顶层美食广场 + 影城；
 * 每层一块楼层指引（标出「您在这里」）。上下楼：
 *   - 中庭里每两层之间一对扶梯（一上一下，都能走），偶数对南 → 北、奇数对北 → 南，所以到了一层转个身就是下一部上行扶梯；
 *   - 中庭西边一部玻璃观光电梯（每层都停，轿厢里有楼层按钮面板，走到电梯门口自动叫梯）；
 *   - 东边一个封闭楼梯间（每层两跑 + 中间平台）。
 * 天桥进来的门（真的自动玻璃门 + 门头招牌）在 2F，进门是一条短走廊，直通中庭回廊和扶梯。
 * 局部坐标：原点在 1F 正门内侧，正门朝 −z 出楼；中庭中心 (0, CZ)；正 n 边形：中空 apothem 8、店面 15、外墙 21；层高 5.5。
 * 只有外壳（楼板 / 店面 / 扶梯 / 电梯 / 楼梯，全部碰撞）常开；人和美食广场桌椅按层分组，只开玩家所在层 ±1。
 */
import { hex } from '../core/geo.js';
import { Kit, bucketMat } from './kit.js';
import { FoodAtlas } from '../game/food-art.js';
import { textPaint, FONT, FONT_EN } from './xmStreet.js';
import { bakePerson, randomLook, preseed, prnd, POSES } from './people.js';
import { pressable } from '../game/input.js';
import { escalator, lowPerson, shopper, family, brandPaint, storefront, flatQ, goldRing } from './xmSM.js';
const B = window.BABYLON;

const TAU = Math.PI * 2, CZ = 21, AV = 8, AS = 15, AW = 21, FH = 5.5;
export const SM_FH = FH;
/** 店名池：每个名字只在一个池里出现一次；同一栋楼按池顺序取，不会重复 */
export const POOL = {
  beauty: ['SEPHORA 丝芙兰', '屈臣氏', '雅诗兰黛', '兰蔻', '资生堂', 'SK-II', '欧莱雅', 'MAC 魅可', '娇韵诗', '科颜氏', '悦诗风吟', '完美日记', '花西子',
    '周大福', '周生生', '老凤祥', '六福珠宝', '潘多拉', 'SWAROVSKI', '谢瑞麟', 'Tiffany & Co.', '卡地亚', 'APM Monaco', '周六福'],
  ladies: ['ZARA', '例外', '花潮', 'UR', 'Lily', 'ONLY', 'VERO MODA', 'MO&Co.', '歌莉娅', '江南布衣', '太平鸟女装', 'Ochirly', 'ESPRIT', 'COS', 'Massimo Dutti', '伊芙丽', '欧时力', '播 BOBO', '珂莱蒂尔', '玛丝菲尔'],
  men: ['优衣库', 'H&M', 'GAP', '杰克琼斯', 'SELECTED', '马克华菲', '海澜之家', '七匹狼', '利郎', '九牧王', 'BOSS', "Levi's", '太平鸟男装', 'GXG', '卡宾', '雅戈尔', '柒牌', '劲霸男装'],
  sports: ['NIKE', 'adidas', '安踏', '李宁', '特步', '361°', 'New Balance', 'Skechers', 'FILA', '迪卡侬', '鸿星尔克', '匹克', 'UNDER ARMOUR', 'PUMA', 'Converse', 'VANS', '乔丹体育', 'lululemon'],
  kids: ['巴拉巴拉 童装', '泡泡玛特', '玩具反斗城', '乐高', '迪士尼童装', '小猪班纳', '好孩子', '奥特曼玩具', '孩子王', '布鲁可', '安奈儿', 'Hello Kitty', '万代', '米奇妙趣屋', '名创优品', '西西弗书店', '酷乐潮玩', '英氏'],
  food: ['海底捞', '西贝莜面村', '喜茶', '奈雪的茶', '必胜客', '外婆家', '绿茶餐厅', '太二酸菜鱼', '鼎泰丰', '吉野家', '味千拉面', '麦当劳', 'KFC 肯德基', '黄则和花生汤', '沙县小吃', '星巴克',
    '面包新语', '蜜雪冰城', '张亮麻辣烫', '老乡鸡', '鼓浪屿馅饼', '八市海鲜', '湘鄂情', '点都德'],
};
const THEME = { beauty: ['化妆品 · 珠宝', 'Beauty & Jewellery'], ladies: ['女装', 'Ladies'], men: ['男装', 'Menswear'], sports: ['运动', 'Sports'], kids: ['童装 · 玩具', 'Kids & Toys'],
  men_sports: ['男装 · 运动', 'Men & Sports'], food: ['美食广场 · 影城', 'Food Court & Cinema'],
  // 三期（定位「都市潮流聚落 · 新锐社交空间」；SM 官网开业稿 newsdisp.aspx?aid=14054 + 官网三期楼层指引）
  trend: ['国际潮牌 · 旗舰', 'Flagships'], designer: ['运动 · 设计师 · 数码', 'Sports, Designer & Tech'], family: ['亲子 · 潮玩 · 甜品', 'Family, Toys & Cinema'], dining: ['餐饮 · 娱乐 · 喜剧', 'Dining & Fun'] };
/** 某个主题的店名不够时从哪个池补 */
const FALLBACK = { trend: 'sports', designer: 'ladies', family: 'kids', dining: 'food' };
const PLAN = { 6: ['beauty', 'ladies', 'men', 'sports', 'kids', 'food'], 5: ['beauty', 'ladies', 'men_sports', 'kids', 'food'], 4: ['beauty', 'ladies', 'men_sports', 'food'] };
/** 各栋楼：边数、层数、颜色、影城、天桥门（s = 哪一边，c = 沿边的位置，f = 楼层 0 起） */
export const MALLS = {
  'sm-city': { n: 4, NF: 6, title: 'SM城市广场', en: 'SM CITY XIAMEN', accent: '#2E5DA8', warm: '#E4EEF8', seed: 6262, off: 0, cinema: 'SM 影城',
    gates: { br1: { s: 3, c: 7, f: 1, zh: 'SM 天桥 → SM新生活广场（二期）', en: 'SKYBRIDGE TO SM LIFESTYLE' }, br2: { s: 3, c: -7, f: 1, zh: '天桥 → SM 三期', en: 'SKYBRIDGE TO PHASE III' } } },
  'sm-topaz': { n: 16, NF: 5, title: 'SM新生活广场 · 黄宝石', en: 'SM LIFESTYLE · TOPAZ', accent: '#C9A24A', warm: '#F6E7C4', seed: 6161, off: 5, gold: true, cinema: 'CGV 影城',
    gates: { br1: { s: 0, c: 0, f: 1, zh: 'SM 天桥 → SM城市广场（一期）', en: 'SKYBRIDGE TO SM CITY' },
      lk3: { s: 8, c: 0, f: 2, zh: '3F 连廊 → SM 三期', en: 'L3 LINK TO PHASE III' } } },
  'sm-ruby': { n: 4, NF: 5, title: 'SM新生活广场 · 红宝石', en: 'SM LIFESTYLE · RUBY', accent: '#C8102E', warm: '#F8E4E4', seed: 6363, off: 9, cinema: 'UA 影城', gates: {} },
  'sm-sapphire': { n: 4, NF: 5, title: 'SM新生活广场 · 蓝宝石', en: 'SM LIFESTYLE · SAPPHIRE', accent: '#2A5BAE', warm: '#E2EAF8', seed: 6464, off: 13, cinema: '万达影城', gates: {} },
  // 三期：1F 国际潮牌旗舰，2F 运动 / 设计师 / 华为，3F 亲子潮玩 + 万达影城（官网 3F-328），4F 餐饮 + 来疯喜剧；3F 南边连廊 → 二期黄宝石 3F
  'sm-p3': { n: 4, NF: 4, title: 'SM 三期', en: 'SM XIAMEN PHASE III', accent: '#4F7F8F', warm: '#E6EEF0', seed: 6565, off: 3, cinema: '万达影城', cinemaF: 2,
    plan: ['trend', 'designer', 'family', 'dining'],
    // 店名按 SM 官网三期楼层指引（smsupermalls.cn/city/threefloor.aspx，2026-11 抓取）
    names: [['NIKE RISE 1200', '丝芙兰 SEPHORA', 'Maison Kitsuné', 'TOMMY HILFIGER', 'J.LINDEBERG', 'Aape', 'I.T', '星巴克', '雪乐山室内滑雪', '极氪 ZEEKR', 'Monologue', 'MAISON LE FAME'],
      ['HUAWEI 智能生活馆', 'adidas', 'Champion', 'MELAND CLUB', 'nshare', 'RuirUiruI', 'NINE WEST', 'CROCS', 'K·SWISS', 'moussy', '小大董', "Domino's Pizza"],
      ['卡通尼', 'att-store', 'UPGAME', 'PM TOYS', '卡游', '泰谣 Home Thai', '哈根达斯', '一米天妇罗', 'KOI PLUS', '暴龙眼镜', '叫我熊猫', 'TIME 时代'],
      ['怂重庆火锅厂', '哲平鳗满', '霞初铁板烧', '来疯喜剧', '玩刻', 'DELL 戴尔', '樊登书店 × 22 SPACE', '南蛮鸭', '汉烟火', '众玩殿堂 ZONE ONE', '宇宙治茶', '潮玩星球']],
    play: ['卡通尼'],
    gates: { br2: { s: 0, c: 0, f: 1, zh: '天桥 → SM城市广场（一期）', en: 'SKYBRIDGE TO SM CITY' },
      lk3: { s: 0, c: -7, f: 2, zh: '3F 连廊 → 二期 黄宝石', en: 'L3 LINK TO TOPAZ' } } },
};
const STEEL = hex('#C3C9CF'), DARK = hex('#3A3F45'), WHITE = hex('#F3F1EC'), FLOOR = hex('#E9E5DD'), GOLD = hex('#D4A84A');

/* ---------- 画法 ---------- */
function foodStall(c, pw, ph) {
  c.fillStyle = '#3B2A22'; c.fillRect(0, 0, pw, ph);
  const g = c.createLinearGradient(0, 0, 0, ph * 0.6); g.addColorStop(0, '#FFE7B8'); g.addColorStop(1, '#F2B866'); c.fillStyle = g; c.fillRect(pw * 0.04, ph * 0.06, pw * 0.92, ph * 0.5);
  for (let i = 0; i < 4; i++) { c.fillStyle = ['#C8443A', '#F4F4F2', '#2E7D4F', '#F2C230'][i]; c.fillRect(pw * (0.08 + i * 0.22), ph * 0.12, pw * 0.18, ph * 0.18);
    c.fillStyle = '#5A3A22'; c.fillRect(pw * (0.08 + i * 0.22), ph * 0.34, pw * 0.18, ph * 0.04); }
  c.fillStyle = '#D9D4CA'; c.fillRect(0, ph * 0.62, pw, ph * 0.08); c.fillStyle = '#8A5A3A'; c.fillRect(0, ph * 0.7, pw, ph * 0.3);
  c.fillStyle = 'rgba(255,255,255,0.18)'; for (let x = 0; x < pw; x += pw / 12) c.fillRect(x, ph * 0.72, 2, ph * 0.28);
}
/** 亲子乐园门面（卡通尼 / 神奇科学家 / 乐海豚）：彩色软包 + 波波球 + 滑梯 */
function playFront(c, pw, ph) {
  c.fillStyle = '#3A3F45'; c.fillRect(0, 0, pw, ph);
  const g = c.createLinearGradient(0, 0, 0, ph); g.addColorStop(0, '#FFF6D8'); g.addColorStop(1, '#BFE8F6'); c.fillStyle = g; c.fillRect(pw * 0.02, ph * 0.08, pw * 0.96, ph * 0.9);
  const C = ['#F2545B', '#F2C230', '#3FB27F', '#3E8EDE', '#B567D6', '#FF8C42'];
  for (let i = 0; i < 6; i++) { c.fillStyle = C[i]; c.fillRect(pw * (0.05 + i * 0.15), ph * 0.18, pw * 0.12, ph * 0.3); }
  c.fillStyle = '#F2545B'; c.beginPath(); c.moveTo(pw * 0.62, ph * 0.5); c.quadraticCurveTo(pw * 0.8, ph * 0.55, pw * 0.92, ph * 0.95); c.lineTo(pw * 0.84, ph * 0.95); c.quadraticCurveTo(pw * 0.74, ph * 0.62, pw * 0.6, ph * 0.58); c.fill();
  for (let i = 0; i < 46; i++) { c.fillStyle = C[i % 6]; c.beginPath(); c.arc(pw * (0.05 + ((i * 37) % 53) / 100), ph * (0.72 + ((i * 17) % 23) / 100), ph * 0.035, 0, TAU); c.fill(); }
  c.fillStyle = 'rgba(255,255,255,0.3)'; c.fillRect(pw * 0.02, ph * 0.08, pw * 0.96, ph * 0.04);
}
function cinemaPaint(name, accent) {
  return (c, pw, ph) => { c.fillStyle = '#141826'; c.fillRect(0, 0, pw, ph); c.fillStyle = accent; c.fillRect(0, ph * 0.78, pw, ph * 0.22);
    c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillStyle = '#FFE08A'; c.font = `900 ${ph * 0.5}px ${FONT}`; c.fillText(name, pw / 2, ph * 0.38);
    c.fillStyle = '#FFFFFF'; c.font = `800 ${ph * 0.15}px ${FONT_EN}`; c.fillText('CINEMA · IMAX · 4DX', pw / 2, ph * 0.89); };
}
function posterPaint(i) {
  const T = [['熊出没', '#2E8B57', '#F2C230'], ['海底探险', '#1F5FA8', '#7FD3F2'], ['机器人总动员', '#5B4A9E', '#F28BA8'], ['恐龙乐园', '#7A5C2E', '#9CCB5B'], ['太空之旅', '#18203A', '#B9C7FF'], ['小马宝莉', '#C55A9E', '#FFD1EC']][i % 6];
  return (c, pw, ph) => { const g = c.createLinearGradient(0, 0, 0, ph); g.addColorStop(0, T[1]); g.addColorStop(1, '#111'); c.fillStyle = g; c.fillRect(0, 0, pw, ph);
    c.fillStyle = T[2]; c.beginPath(); c.arc(pw / 2, ph * 0.42, pw * 0.3, 0, TAU); c.fill(); c.fillStyle = '#FFFFFF'; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.font = `900 ${Math.min(pw / T[0].length, ph * 0.12)}px ${FONT}`; c.fillText(T[0], pw / 2, ph * 0.82); c.strokeStyle = '#E8E1C8'; c.lineWidth = pw * 0.03; c.strokeRect(0, 0, pw, ph); };
}
/** 天桥尽头：画出桥继续往前（白地砖收拢 + 两边玻璃 + 天空）——走 2.6 m 就切到街上的真天桥 */
function bridgeView(zh) {
  return (c, pw, ph) => { const g = c.createLinearGradient(0, 0, 0, ph * 0.55); g.addColorStop(0, '#8EC5EE'); g.addColorStop(1, '#DCEEF9'); c.fillStyle = g; c.fillRect(0, 0, pw, ph);
    const cx = pw / 2, hy = ph * 0.5; c.fillStyle = '#D8D4CC'; c.beginPath(); c.moveTo(0, ph); c.lineTo(cx - pw * 0.08, hy); c.lineTo(cx + pw * 0.08, hy); c.lineTo(pw, ph); c.fill();
    c.strokeStyle = 'rgba(120,120,120,0.35)'; c.lineWidth = 2; for (let i = 1; i < 6; i++) { const y = hy + (ph - hy) * (i / 6) ** 2; const w = (y - hy) / (ph - hy); c.beginPath(); c.moveTo(cx - pw * (0.08 + 0.42 * w), y); c.lineTo(cx + pw * (0.08 + 0.42 * w), y); c.stroke(); }
    c.fillStyle = 'rgba(200,232,246,0.55)'; c.beginPath(); c.moveTo(0, 0); c.lineTo(cx - pw * 0.08, hy * 0.7); c.lineTo(cx - pw * 0.08, hy); c.lineTo(0, ph); c.fill(); c.beginPath(); c.moveTo(pw, 0); c.lineTo(cx + pw * 0.08, hy * 0.7); c.lineTo(cx + pw * 0.08, hy); c.lineTo(pw, ph); c.fill();
    c.fillStyle = '#FFFFFF'; c.fillRect(0, 0, pw, ph * 0.08); c.fillStyle = '#1F3B73'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.font = `800 ${ph * 0.06}px ${FONT}`; c.fillText(zh, cx, ph * 0.04); };
}

/* ====================== 商场 ====================== */
export class SmMall {
  constructor(scene, origin, id = 'sm-city', o = {}) {
    const cfg = this.cfg = MALLS[id] || MALLS['sm-city']; this.id = MALLS[id] ? id : 'sm-city'; this.o = origin; this.scene = scene;
    const n = this.n = cfg.n, NF = this.NF = cfg.NF, RY = this.RY = NF * FH;
    const k = this.kit = new Kit(scene, 'smMall'); k.root.position.set(origin.x, origin.y, origin.z);
    const A = this.atlas = new FoodAtlas(scene, 2048);
    const P = k.solid, GL = k.glass, G = k.glow, GR = k.g('granite'), Mt = k.metal;
    const gold = !!cfg.gold, accent = hex(cfg.accent), plan = this.plan = cfg.plan || PLAN[NF], cinF = cfg.cinemaF ?? NF - 1;
    const GM = gold ? k.g('metal@gold') : Mt;
    if (gold) bucketMat(scene, k.M, 'metal@gold').emissiveColor.set(0.32, 0.23, 0.07);
    preseed(cfg.seed);
    const t = Math.tan(Math.PI / n);
    const F = []; for (let s = 0; s < n; s++) { const ph = -Math.PI / 2 + s * TAU / n, nx = Math.cos(ph), nz = Math.sin(ph); F.push({ s, nx, nz, ex: -nz, ez: nx, ry: Math.atan2(nx, nz), aIn: Math.atan2(-nx, -nz), aOut: Math.atan2(nx, nz) }); }
    this.F = F;
    const pt = (f, r, c) => [f.nx * r + f.ex * c, CZ + f.nz * r + f.ez * c];
    const cl = (r, c) => Math.max(-r * t, Math.min(r * t, c));
    const vtx = (s, r, e) => pt(F[s], r, e * r * t);
    const boxRC = (Bk, f, r0, r1, c0, c1, y0, y1, col) => { const [x, z] = pt(f, (r0 + r1) / 2, (c0 + c1) / 2); Bk.box(x, (y0 + y1) / 2, z, Math.abs(c1 - c0), y1 - y0, Math.abs(r1 - r0), col, f.ry, 0, 0, 1, { ao: false }); };
    const colRC = (f, r0, r1, c0, c1, y0, y1, oo = {}) => { const [x, z] = pt(f, (r0 + r1) / 2, (c0 + c1) / 2); return k.col(x, (y0 + y1) / 2, z, Math.abs(c1 - c0), y1 - y0, Math.abs(r1 - r0), { ry: f.ry, ...oo }); };
    const rect = (f, r0, r1, c0, c1, clamp = true) => clamp ? [pt(f, r0, cl(r0, c0)), pt(f, r0, cl(r0, c1)), pt(f, r1, cl(r1, c1)), pt(f, r1, cl(r1, c0))] : [pt(f, r0, c0), pt(f, r0, c1), pt(f, r1, c1), pt(f, r1, c0)];
    /** 一块楼板：上面地砖 + 下面白天花 + 碰撞（clamp = 按正多边形的梯形裁边） */
    const slab = (f, r0, r1, c0, c1, y, { clamp = true, top = FLOOR, collide = true } = {}) => {
      const q = rect(f, r0, r1, c0, c1, clamp); flatQ(GR, q, y, top, true); flatQ(P, q, y - 0.6, WHITE, false);
      if (collide) { const a = clamp ? Math.max(c0, -r1 * t) : c0, b = clamp ? Math.min(c1, r1 * t) : c1; colRC(f, r0, r1, a, b, y - 0.6, y); }
    };
    const edgeZ = (x, sg) => { let d = 1e9; for (const f of F) { const q = sg * f.nz; if (q > 1e-3) d = Math.min(d, (AV - f.nx * x) / q); } return CZ + sg * d; };
    this.edgeZ = edgeZ;
    const signUv = {}, sUv = nm => signUv[nm] || (signUv[nm] = A.draw(6, 0.8, brandPaint(nm), 36));
    const txt = (lines, bg, fg, w, h, ppm = 60) => A.draw(w, h, textPaint(lines, { bg, fg }), ppm);

    // ---------- 楼梯间（东边，φ = 0：r → +x，c → +z） ----------
    const st = this.st = n === 16 ? { s: 4, hall: [-2.98, 6.5], door: [-2.85, -1.05], fl: [-1, 5], land: [5, 6.3], rA: [15.25, 17.4], rB: [17.7, 19.85], back: 20.05, extraWall: [5] }
                                  : { s: 1, hall: [-7.2, 7.4], door: [-7, -5], fl: [-5, 5], land: [5, 7.2], rA: [15.3, 17.5], rB: [17.8, 20.0], back: 20.3, extraWall: [] };
    const cinemaSides = n === 16 ? [7, 8, 9] : [2];
    const gates = Object.entries(cfg.gates).map(([key, g]) => ({ key, ...g }));
    this.gates = gates;

    // ---------- 店名 ----------
    const used = {}, take = pool => { const L = POOL[pool], i = used[pool] = (used[pool] || 0); used[pool]++; return L[(cfg.off + i) % L.length]; };
    const got = new Set(), nf = new Array(NF).fill(0);
    const nameFor = (f, i) => { const th = plan[f], L = cfg.names && cfg.names[f];
      if (L) while (nf[f] < L.length) { const nm = L[nf[f]++]; if (!got.has(nm)) { got.add(nm); return nm; } }
      for (let k2 = 0; k2 < 40; k2++) { const nm = take(th === 'men_sports' ? (i % 2 ? 'sports' : 'men') : FALLBACK[th] || th); if (!got.has(nm)) { got.add(nm); return nm; } }
      return take(FALLBACK[th] || th); };
    this.shops = []; this.shopFloors = [];

    // ---------- 每层每边的分段 ----------
    const segsOf = (f, s) => {
      const half = AS * t, L = 2 * half, per = Math.max(1, Math.round(L / 9)), top = f === cinF;
      if (top && cinemaSides.includes(s)) return [[-half, half, 'cinema']];
      if (st.extraWall.includes(s)) return [[-half, half, 'wall']];
      const cuts = [];
      if (f === 0 && s === 0) cuts.push([-3, 3, 'open', 'lobby']);
      for (const g of gates) if (g.f === f && g.s === s) cuts.push([g.c - 3, g.c + 3, 'open', g.key]);
      if (s === st.s) { if (st.door[0] - st.hall[0] > 0.05) cuts.push([st.hall[0], st.door[0], 'wall']); cuts.push([st.door[0], st.door[1], 'open', 'stair']); cuts.push([st.door[1], Math.min(st.hall[1], half), 'stairwall']); }
      const out = [];
      for (let i = 0; i < per; i++) {
        let pieces = [[-half + L * i / per, -half + L * (i + 1) / per]];
        for (const [a, b] of cuts) pieces = pieces.flatMap(([p, q]) => b <= p || a >= q ? [[p, q]] : [[p, a], [b, q]].filter(([u, v]) => v - u > 0.01));
        for (const [p, q] of pieces) out.push([p, q, q - p >= 2.5 ? 'shop' : 'wall']);
      }
      for (const c of cuts) out.push([Math.max(c[0], -half), Math.min(c[1], half), c[2], c[3]]);
      return out.filter(p => p[1] - p[0] > 0.01).sort((u, v) => u[0] - v[0]);
    };

    // ---------- 1F 地面 ----------
    k.floorWithHoles(-AW - 1, AW + 1, 0, CZ + AW + 1, -0.15, 0, hex('#E8E4DC'), [], true, 'granite');
    for (let r = 0; r < 3; r++) for (let s = 0; s < n; s++) { const ap = 2 + r * 2.2; flatQ(P, [vtx(s, ap, -1), vtx(s, ap, 1), vtx(s, ap + 0.25, 1), vtx(s, ap + 0.25, -1)], 0.005, accent); }

    // ---------- 楼层 ----------
    const LIFT = this.LIFT = { x0: -7.95, x1: -5.3, z: 1.45, cx0: -7.85, cx1: -5.45, cz: 1.25 };
    let shopIdx = 0;
    for (let f = 0; f < NF; f++) {
      const y = f * FH, E = f % 2 === 0 ? -1 : 1, names = [];
      for (let s = 0; s < n; s++) {
        const fr = F[s];
        if (f > 0) {
          // 回廊楼板（中空边 → 店面）+ 楼板侧面 + 灯带 + 筒灯
          slab(fr, AV, AS, -1e9, 1e9, y);
          const a = vtx(s, AV, -1), b = vtx(s, AV, 1);
          P.quad([b[0], y - 0.6, b[1]], [a[0], y - 0.6, a[1]], [a[0], y, a[1]], [b[0], y, b[1]], WHITE);
          G.quad([b[0], y - 0.62, b[1]], [a[0], y - 0.62, a[1]], [a[0], y - 0.55, a[1]], [b[0], y - 0.55, b[1]], hex('#FFF4DA'));
          for (const ap of [10.5, 13.5]) for (const e of [-0.5, 0.5]) { const [cx, cz] = pt(fr, ap, e * ap * t), h = 0.22; flatQ(G, [[cx - h, cz - h], [cx + h, cz - h], [cx + h, cz + h], [cx - h, cz + h]], y - 0.61, hex('#FFF6E0'), false); }
          if (gold) { const ox = fr.nx * 0.03, oz = fr.nz * 0.03; GM.quad([b[0] - ox, y - 0.5, b[1] - oz], [a[0] - ox, y - 0.5, a[1] - oz], [a[0] - ox, y - 0.05, a[1] - oz], [b[0] - ox, y - 0.05, b[1] - oz], GOLD); }
          // 栏杆（碰撞）：扶梯口 |x| < 3.6 留开口，西边电梯门口留开口
          let segs = [[a, b]];
          const clip = (sg, ax, lo, hi) => sg.flatMap(([p, q]) => { const va = p[ax], vb = q[ax]; if (Math.abs(vb - va) < 1e-6) return va > lo && va < hi ? [] : [[p, q]];
            const tl = (lo - va) / (vb - va), th = (hi - va) / (vb - va), t0 = Math.max(0, Math.min(tl, th)), t1 = Math.min(1, Math.max(tl, th)); if (t0 >= t1) return [[p, q]];
            const at = u => [p[0] + (q[0] - p[0]) * u, p[1] + (q[1] - p[1]) * u], out = []; if (t0 > 0.01) out.push([p, at(t0)]); if (t1 < 0.99) out.push([at(t1), q]); return out; });
          if (fr.nz * E > 0.5) segs = clip(segs, 0, -3.6, 3.6);
          if (fr.nx < -0.9) segs = clip(segs, 1, CZ - LIFT.z, CZ + LIFT.z);
          for (const [p0, p1] of segs) { if (Math.hypot(p1[0] - p0[0], p1[1] - p0[1]) < 0.2) continue; k.rail(p0[0], p0[1], p1[0], p1[1], y); if (gold) GM.tube([p0[0], y + 1.12, p0[1]], [p1[0], y + 1.12, p1[1]], 0.09, GOLD, 8); }
        }
        // 柱子（店面那一圈的角）
        if (!(n === 16 && s === st.s + 1)) { const p = vtx(s, AS, -1); (gold ? GM : P).slab(p[0] - 0.3, p[0] + 0.3, y, y + FH - 0.6, p[1] - 0.3, p[1] + 0.3, gold ? GOLD : WHITE, { ao: false }); }
        // 店面 / 墙 / 开口 / 影城
        for (const [a, b, kind, tag] of segsOf(f, s)) {
          const w = b - a, c = (a + b) / 2, [x, z] = pt(fr, AS, c);
          if (kind === 'shop') {
            const nm = nameFor(f, shopIdx++); names.push(nm);
            const play = cfg.play && cfg.play.includes(nm);
            A.quad(x, y + 1.9, z, w - 0.02, 3.4, fr.aIn, play ? (this._play || (this._play = A.draw(9, 3.6, playFront, 24))) : f === NF - 1 ? (this._stall || (this._stall = A.draw(9, 3.6, foodStall, 24))) : (this._glass || (this._glass = A.draw(9, 3.6, storefront(cfg.warm), 24))));
            const [sx, sz] = pt(fr, AS - 0.05, c); A.quad(sx, y + 4.3, sz, Math.min(w - 0.6, 6), 0.8, fr.aIn, sUv(nm));
            boxRC(P, fr, AS, AS + 0.2, a, b, y + 3.6, y + 5.0, DARK);
            colRC(fr, AS, AS + 0.3, a, b, y, y + FH - 0.6);
          } else if (kind === 'wall' || kind === 'stairwall') {
            boxRC(P, fr, AS, AS + 0.25, a, b, y, y + FH - 0.6, WHITE); colRC(fr, AS, AS + 0.3, a, b, y, y + FH - 0.6);
            if (kind === 'stairwall') { const [qx, qz] = pt(fr, AS - 0.03, a + 1.0); A.quad(qx, y + 2.4, qz, 1.6, 0.55, fr.aIn, this._stUv || (this._stUv = txt(['楼梯 STAIRS'], '#1E7F4E', '#FFFFFF', 1.6, 0.55))); }
          } else if (kind === 'open') {
            if (tag !== 'lobby') { boxRC(P, fr, AS, AS + 0.25, a, b, y + 3.8, y + FH - 0.6, WHITE); colRC(fr, AS, AS + 0.3, a, b, y + 3.8, y + FH - 0.6); }
            if (tag && tag !== 'lobby' && tag !== 'stair') { const g = cfg.gates[tag], [qx, qz] = pt(fr, AS - 0.05, c); A.quad(qx, y + 4.3, qz, 5.6, 0.8, fr.aIn, txt([g.zh, g.en], '#1F3B73', '#FFFFFF', 5.6, 0.8, 50)); }
            if (tag === 'stair') { const [qx, qz] = pt(fr, AS - 0.05, c); A.quad(qx, y + 4.1, qz, w, 0.5, fr.aIn, this._stDoor || (this._stDoor = txt(['楼梯 ↑↓'], '#1E7F4E', '#FFFFFF', w, 0.5))); }
          } else if (kind === 'cinema') {
            boxRC(P, fr, AS, AS + 0.3, a, b, y, y + FH - 0.6, hex('#1C1F2E')); colRC(fr, AS, AS + 0.35, a, b, y, y + FH - 0.6);
            const mid = n === 16 ? s === 8 : true, [qx, qz] = pt(fr, AS - 0.04, c);
            if (mid) { A.quad(qx, y + 3.9, qz, Math.min(w - 0.6, 12), 1.2, fr.aIn, A.draw(Math.min(w - 0.6, 12), 1.2, cinemaPaint(cfg.cinema, cfg.accent), 40));
              const [ex, ez] = pt(fr, AS - 0.05, c); A.quad(ex, y + 1.4, ez, 2.6, 2.6, fr.aIn, txt(['入场', 'ENTRANCE'], '#2B2F35', '#FFE08A', 2.6, 2.6, 40));
              boxRC(P, fr, AS - 1.4, AS - 0.6, c - 4.2, c - 2.2, y, y + 1.1, DARK); colRC(fr, AS - 1.4, AS - 0.6, c - 4.2, c - 2.2, y, y + 1.1);
              const [tx, tz] = pt(fr, AS - 1.42, c - 3.2); A.quad(tx, y + 0.7, tz, 1.8, 0.5, fr.aIn, txt(['售票 TICKETS'], '#C8102E', '#FFFFFF', 1.8, 0.5));
              if (n === 4) for (const pc of [-11, -7, 7, 11]) { const [px, pz] = pt(fr, AS - 0.05, pc); A.quad(px, y + 1.9, pz, 1.7, 2.5, fr.aIn, A.draw(1.7, 2.5, posterPaint(pc + 11), 40)); } }
            else { A.quad(qx, y + 1.9, qz, 1.7, 2.5, fr.aIn, A.draw(1.7, 2.5, posterPaint(s), 40)); A.quad(qx, y + 4.0, qz, 3.6, 0.7, fr.aIn, txt([cfg.cinema], '#141826', '#FFE08A', 3.6, 0.7)); }
          }
        }
      }
      this.shopFloors.push(names); this.shops.push(...names);
    }
    // 屋顶 + 天窗
    for (let s = 0; s < n; s++) { flatQ(P, [vtx(s, AV, -1), vtx(s, AV, 1), vtx(s, AW, 1), vtx(s, AW, -1)], RY, WHITE, false); flatQ(GL, [vtx(s, 0.01, -1), vtx(s, AV, -1), vtx(s, AV, 1), vtx(s, 0.01, 1)], RY + 1.2, hex('#CFE6F4'), false);
      const a = vtx(s, AV, -1), b = vtx(s, AV, 1); P.quad([b[0], RY, b[1]], [a[0], RY, a[1]], [a[0], RY + 1.2, a[1]], [b[0], RY + 1.2, b[1]], WHITE); }
    const SKY = RY + 1.7;
    for (let s = 0; s < n; s++) flatQ(G, [vtx(s, 0.01, -1), vtx(s, AW, -1), vtx(s, AW, 1), vtx(s, 0.01, 1)], SKY, hex('#5FA8E6'), false);
    for (const [cx, cz, rx, rz] of [[-3, CZ - 2, 2.6, 1.3], [3.5, CZ + 3, 3.2, 1.5], [-1, CZ + 5.5, 1.8, 0.9], [4.5, CZ - 4.5, 1.6, 0.8]])
      for (let i = 0; i < 10; i++) { const a0 = i / 10 * TAU, a1 = (i + 1) / 10 * TAU, c0 = [cx, SKY - 0.05, cz], p1 = [cx + Math.cos(a1) * rx, SKY - 0.05, cz + Math.sin(a1) * rz], p0 = [cx + Math.cos(a0) * rx, SKY - 0.05, cz + Math.sin(a0) * rz]; G.quad(c0, p1, p0, c0, hex('#F6FAFF')); G.quad(c0, p0, p1, c0, hex('#F6FAFF')); }
    const MUL = gold ? GOLD : hex('#C9CFD5');
    for (let s = 0; s < n; s++) { const a = vtx(s, AV, -1), b = vtx(s, AV, 1); GM.tube([0, RY + 1.15, CZ], [a[0], RY + 1.15, a[1]], 0.12, MUL, 6); GM.tube([a[0], RY + 1.15, a[1]], [b[0], RY + 1.15, b[1]], 0.14, MUL, 6); }

    // ---------- 1F 门厅（南边正门） ----------
    const zV = CZ - AS, hasGateAbove = gates.some(g => g.s === 0 && g.f === 1);
    for (const sx of [-1, 1]) { P.slab(sx * 3 - 0.15, sx * 3 + 0.15, 0, FH - 0.6, 0, zV, WHITE, { ao: false }); k.colSlab(sx * 3 - 0.2, sx * 3 + 0.2, 0, FH, -0.2, zV); }
    if (!hasGateAbove) P.slab(-3, 3, FH - 0.6, FH - 0.4, 0, zV, WHITE, { ao: false });
    P.slab(-3.2, -2.4, 0, FH - 0.6, -0.2, 0.1, accent, { ao: false }); P.slab(2.4, 3.2, 0, FH - 0.6, -0.2, 0.1, accent, { ao: false }); P.slab(-3.2, 3.2, 3.6, FH - 0.6, -0.2, 0.1, WHITE, { ao: false });
    k.colSlab(-3.3, -2.4, 0, FH, -0.3, 0.1); k.colSlab(2.4, 3.3, 0, FH, -0.3, 0.1);
    A.quad(0, 4.4, 0.15, 4.6, 0.7, 0, txt([cfg.title], cfg.accent, '#FFFFFF', 4.6, 0.7));
    k.floorWithHoles(-3, 3, -5, 0, -0.15, 0, hex('#8E8A82'), [], true, 'pave');
    G.slab(-3, 3, 0, 3.2, -5.05, -5.0, hex('#DDE8F0'), { ao: false });
    k.colSlab(-3.1, 3.1, 0, 3.2, -5.2, -5.0); k.colSlab(-3.1, -3, 0, 3.2, -5, 0); k.colSlab(3, 3.1, 0, 3.2, -5, 0);

    // ---------- 天桥门：走廊 + 自动玻璃门 + 门头 + 门外一段天桥 ----------
    this.gdoors = [];
    for (const g of gates) {
      const fr = F[g.s], y = g.f * FH, c0 = g.c - 3, c1 = g.c + 3, R2 = AW + 7;
      slab(fr, AS, AW, c0, c1, y, { clamp: false });
      slab(fr, AW, R2, c0, c1, y, { clamp: false, top: hex('#F1EEE8') });
      for (let r = AW + 1; r < R2; r += 1.2) { const q = rect(fr, r, r + 0.04, c0, c1, false); flatQ(P, q, y + 0.004, hex('#C9C4BA'), true); }
      for (const c of [c0, c1]) { const s0 = c === c0 ? c0 - 0.25 : c1, s1 = c === c0 ? c0 : c1 + 0.25;
        boxRC(P, fr, AS, AW, s0, s1, y, y + 3.8, WHITE); colRC(fr, AS, AW, s0, s1, y, y + 3.8);
        boxRC(GL, fr, AW, R2, s0 + 0.1, s1 - 0.1, y, y + 3.6, hex('#D6EEF8')); colRC(fr, AW, R2, s0, s1, y, y + 3.6);
        boxRC(P, fr, AW, R2, s0, s1, y + 0.95, y + 1.0, hex('#C9CED3')); }
      flatQ(P, rect(fr, AS, AW, c0, c1, false), y + 3.8, WHITE, false);
      flatQ(G, rect(fr, AS + 0.5, AW - 0.5, g.c - 0.3, g.c + 0.3, false), y + 3.78, hex('#FFF6E0'), false);
      boxRC(P, fr, AW, R2, c0 - 0.3, c1 + 0.3, y + 3.6, y + 3.9, WHITE);
      flatQ(G, rect(fr, AW + 0.5, R2 - 0.5, g.c - 0.25, g.c + 0.25, false), y + 3.58, hex('#FFF8EC'), false);
      boxRC(P, fr, AW, R2, c0, c1, y - 1.8, y - 0.6, WHITE);
      // 尽头：画出天桥继续往前（+ 碰撞）；走到门外 2.6 m 就上街
      const [ex, ez] = pt(fr, R2 - 0.05, g.c); A.quad(ex, y + 1.8, ez, 6, 3.6, fr.aIn, A.draw(6, 3.6, bridgeView(g.zh), 40)); colRC(fr, R2, R2 + 0.3, c0, c1, y, y + 3.6);
      // 门框 + 门头招牌 + 侧窗
      for (const [a, b] of [[c0, c0 + 0.25], [g.c - 1.75, g.c - 1.6], [g.c + 1.6, g.c + 1.75], [c1 - 0.25, c1]]) boxRC(GM, fr, AW - 0.1, AW + 0.1, a, b, y, y + 3.0, gold ? GOLD : STEEL);
      boxRC(P, fr, AW - 0.15, AW + 0.15, c0, c1, y + 3.0, y + 3.8, accent);
      const hd = txt([g.zh, g.en], cfg.accent, '#FFFFFF', 5.6, 0.7, 50), [hx, hz] = pt(fr, AW - 0.17, g.c); A.quad(hx, y + 3.4, hz, 5.6, 0.7, fr.aIn, hd);
      const [ox, oz] = pt(fr, AW + 0.17, g.c); A.quad(ox, y + 3.4, oz, 5.6, 0.7, fr.aOut, txt([cfg.title, cfg.en], cfg.accent, '#FFFFFF', 5.6, 0.7, 50));
      for (const [a, b] of [[c0 + 0.25, g.c - 1.75], [g.c + 1.75, c1 - 0.25]]) { boxRC(GL, fr, AW - 0.03, AW + 0.03, a, b, y, y + 3.0, hex('#D6EEF8')); colRC(fr, AW - 0.1, AW + 0.1, a, b, y, y + 3.0); }
      const dcol = colRC(fr, AW - 0.1, AW + 0.1, g.c - 1.6, g.c + 1.6, y, y + 3.0, { dynamic: true });
      this.gdoors.push({ g, fr, y, col: dcol, open: 0, panels: [] });
    }

    // ---------- 楼梯间 ----------
    {
      const fr = F[st.s], [h0, h1] = st.hall, [fl0, fl1] = st.fl, [rA0, rA1] = st.rA, [rB0, rB1] = st.rB;
      // 三面墙 + 两跑中间的隔墙（整栋楼高）
      boxRC(P, fr, AS, st.back, h0 - 0.2, h0, 0, RY, WHITE); colRC(fr, AS, st.back, h0 - 0.2, h0, 0, RY);
      boxRC(P, fr, AS, st.back, h1, h1 + 0.2, 0, RY, WHITE); colRC(fr, AS, st.back, h1, h1 + 0.2, 0, RY);
      boxRC(P, fr, st.back, st.back + 0.2, h0 - 0.2, h1 + 0.2, 0, RY, WHITE); colRC(fr, st.back, st.back + 0.2, h0 - 0.2, h1 + 0.2, 0, RY);
      boxRC(P, fr, rA1, rB0, fl0, fl1, 0, RY, hex('#E6E2DA')); colRC(fr, rA1, rB0, fl0, fl1, 0, RY);
      for (let f = 0; f < NF; f++) {
        const y = f * FH;
        if (f > 0) { const o2 = { clamp: false, top: hex('#DAD5CB') };
          slab(fr, AS, rB0, h0, h1, y, o2); slab(fr, rB0, rB1, h0, fl0, y, o2); slab(fr, rB0, rB1, fl1, h1, y, o2); slab(fr, rB1, st.back, h0, h1, y, o2); }
        flatQ(G, rect(fr, rA0 + 0.6, rA1 - 0.6, fl0 + 1, fl1 - 1, false), y + FH - 0.62, hex('#FFF6E0'), false);
        const [gx, gz] = pt(fr, AS + 0.27, (st.door[0] + st.door[1]) / 2); A.quad(gx, y + 3.0, gz, 1.6, 0.5, fr.aOut, this._flUv?.[f] || ((this._flUv = this._flUv || [])[f] = txt([`${f + 1}F`], '#1E7F4E', '#FFFFFF', 1.6, 0.5)));
        if (f < NF - 1) {
          k.stairs('z', CZ + fl0, y, CZ + fl1, y + FH / 2, rA0, rA1, y, '#D9D4CA', { rails: true });
          slab(fr, rA0, rB1, fl1, Math.min(st.land[1], h1), y + FH / 2, { clamp: false, top: hex('#DAD5CB') });
          k.stairs('z', CZ + fl1, y + FH / 2, CZ + fl0, y + FH, rB0, rB1, y + FH / 2 - 0.2, '#D9D4CA', { rails: true });
        }
      }
    }

    // ---------- 扶梯：每两层一对（一上一下） ----------
    this.esc = [];
    for (let p = 0; p < NF - 1; p++) {
      const even = p % 2 === 0;
      for (const x of even ? [-0.9, 0.9] : [-2.7, 2.7]) {
        const zS = edgeZ(x, -1), zN = edgeZ(x, 1);
        const a = [x, p * FH, even ? zS : zN], b = [x, (p + 1) * FH, even ? zN : zS];
        escalator(k, a, b, 1.1, true, { belly: '#C9CED3' });
        if (x < 0) this.esc.push({ p, x, from: a, to: b });
        const [ax, , az] = a, up = x < 0, sg = even ? -1 : 1;
        A.quad(ax, a[1] + 2.4, az + sg * 0.9, 1.1, 0.4, even ? Math.PI : 0, up ? (this._upUv || (this._upUv = txt(['▲ 上行 UP'], '#1E7F4E', '#FFFFFF', 1.1, 0.4))) : (this._dnUv || (this._dnUv = txt(['▼ 下行 DOWN'], '#C8443A', '#FFFFFF', 1.1, 0.4))));
      }
    }

    // ---------- 观光电梯（西边，中空边上） ----------
    {
      const Lf = LIFT;
      for (const zz of [CZ - Lf.z, CZ + Lf.z]) { GL.slab(Lf.x0, Lf.x1, 0, RY, zz - 0.03, zz + 0.03, hex('#D6EEF8'), { ao: false }); k.colSlab(Lf.x0, Lf.x1, 0, RY, zz - 0.06, zz + 0.06); }
      GL.slab(Lf.x1 - 0.03, Lf.x1 + 0.03, 0, RY, CZ - Lf.z, CZ + Lf.z, hex('#D6EEF8'), { ao: false }); k.colSlab(Lf.x1 - 0.06, Lf.x1 + 0.06, 0, RY, CZ - Lf.z, CZ + Lf.z);
      for (const [x, z] of [[Lf.x0, CZ - Lf.z], [Lf.x0, CZ + Lf.z], [Lf.x1, CZ - Lf.z], [Lf.x1, CZ + Lf.z]]) GM.slab(x - 0.08, x + 0.08, 0, RY + 0.4, z - 0.08, z + 0.08, gold ? GOLD : STEEL, { ao: false });
      for (const sg of [-1, 1]) { Mt.slab(Lf.x0 - 0.05, Lf.x0 + 0.05, 0, RY, CZ + sg * 0.95, CZ + sg * Lf.z, STEEL, { ao: false }); k.colSlab(Lf.x0 - 0.08, Lf.x0 + 0.08, 0, RY, Math.min(CZ + sg * 0.95, CZ + sg * Lf.z), Math.max(CZ + sg * 0.95, CZ + sg * Lf.z)); }
      for (let f = 0; f < NF; f++) { const y = f * FH, top = f < NF - 1 ? (f + 1) * FH : RY;
        GL.slab(Lf.x0 - 0.03, Lf.x0 + 0.03, y + 2.45, top, CZ - 0.95, CZ + 0.95, hex('#D6EEF8'), { ao: false }); k.colSlab(Lf.x0 - 0.08, Lf.x0 + 0.08, y + 2.45, top, CZ - 0.95, CZ + 0.95);
        Mt.slab(Lf.x0 - 0.2, Lf.x0 + 0.02, y + 2.4, y + 2.6, CZ - 1.0, CZ + 1.0, STEEL, { ao: false });
        if (f > 0) { Mt.slab(Lf.x0 - 0.05, Lf.cx0, y - 0.05, y, CZ - 0.95, CZ + 0.95, STEEL, { ao: false }); k.colSlab(Lf.x0 - 0.1, Lf.cx0, y - 0.3, y, CZ - 0.95, CZ + 0.95); }
        A.quad(Lf.x0 - 0.12, y + 2.85, CZ, 1.9, 0.45, -Math.PI / 2, this._liftUv || (this._liftUv = txt(['观光电梯 LIFT'], cfg.accent, '#FFFFFF', 1.9, 0.45)));
        G.slab(Lf.x0 - 0.13, Lf.x0 - 0.1, y + 1.15, y + 1.35, CZ + 1.12, CZ + 1.28, hex('#FFE08A'), { ao: false }); }
      GL.slab(Lf.x0, Lf.x1, RY + 0.4, RY + 0.45, CZ - Lf.z, CZ + Lf.z, hex('#D6EEF8'), { ao: false });
    }

    // ---------- 楼层指引（每层一块，标「您在这里」） ----------
    const dPos = n === 16 ? [8.13, CZ - 8.13] : [11.5, CZ - 11.5], dF = [-Math.SQRT1_2, Math.SQRT1_2], dry = Math.atan2(dF[0], dF[1]);
    const dirRows = []; for (let f = NF - 1; f >= 0; f--) { const th = THEME[plan[f]], ex = this.shopFloors[f].slice(0, 2).join(' · ');
      dirRows.push([f, `${f + 1}F`, th[0] + (f === cinF ? ` · ${cfg.cinema}` : ''), th[1], ex]); }
    for (let f = 0; f < NF; f++) {
      const y = f * FH;
      P.box(dPos[0], y + 1.3, dPos[1], 1.9, 2.6, 0.3, hex('#2B3036'), dry, 0, 0, 1, { ao: false }); k.col(dPos[0], y + 1.3, dPos[1], 1.9, 2.6, 0.3, { ry: dry });
      const uv = A.draw(1.8, 2.4, (c, pw, ph) => { c.fillStyle = '#20262C'; c.fillRect(0, 0, pw, ph); const rh = ph / (NF + 2.2);
        c.fillStyle = cfg.accent; c.fillRect(0, 0, pw, rh * 1.2); c.fillStyle = '#FFF'; c.textBaseline = 'middle'; c.textAlign = 'center'; c.font = `800 ${rh * 0.42}px ${FONT}`; c.fillText(cfg.title, pw / 2, rh * 0.38);
        c.font = `700 ${rh * 0.32}px ${FONT}`; c.fillText('楼层指引 DIRECTORY', pw / 2, rh * 0.86);
        dirRows.forEach(([ff, lab, zh, en, ex], i) => { const yy = rh * (i + 1.7); if (ff === f) { c.fillStyle = '#F2C230'; c.fillRect(0, yy - rh * 0.48, pw, rh * 0.96); }
          c.textAlign = 'left'; c.fillStyle = ff === f ? '#20262C' : '#F2C230'; c.font = `800 ${rh * 0.5}px ${FONT_EN}`; c.fillText(lab, pw * 0.04, yy);
          c.fillStyle = ff === f ? '#20262C' : '#E8ECEF'; c.font = `700 ${rh * 0.3}px ${FONT}`; c.fillText(zh, pw * 0.26, yy - rh * 0.17); c.font = `500 ${rh * 0.22}px ${FONT}`; c.fillText(ex || en, pw * 0.26, yy + rh * 0.2); });
        c.fillStyle = '#F2C230'; c.textAlign = 'center'; c.font = `800 ${rh * 0.36}px ${FONT}`; c.fillText(`★ 您在这里 ${f + 1}F  YOU ARE HERE`, pw / 2, ph - rh * 0.55);
        c.fillStyle = '#AEB6BE'; c.font = `600 ${rh * 0.24}px ${FONT}`; c.fillText('扶梯 Escalator · 观光电梯 Lift · 楼梯 Stairs', pw / 2, ph - rh * 0.15); }, 90);
      for (const sg of [1, -1]) A.quad(dPos[0] + dF[0] * 0.16 * sg, y + 1.4, dPos[1] + dF[1] * 0.16 * sg, 1.8, 2.4, Math.atan2(dF[0] * sg, dF[1] * sg), uv);
    }
    // 美食广场招牌（顶层中空边上挂一块）
    { const y = (NF - 1) * FH, uv = txt(['美食广场 FOOD COURT'], '#C8443A', '#FFFFFF', 5, 0.8, 50); A.quad(0, y + 4.4, edgeZ(0, 1) + 3, 5, 0.8, Math.PI, uv); A.quad(0, y + 4.4, edgeZ(0, -1) - 3, 5, 0.8, 0, uv); }

    // ---------- 中庭吊饰 ----------
    if (gold) topazChandelier(k, CZ, RY);   // 黄宝石：天窗下的哑光金环吊灯（替换原来的棕色八角筒 + 4 个玻璃灯笼）
    else {   // 其它楼：避开扶梯 |x| < 3.6
      const gy = RY - 2.6;
      k.metal.tube([0, RY, CZ], [0, gy + 1.6, CZ], 0.05, hex('#9AA1A8'), 4);
      P.cyl(0, gy, CZ, 2.0, 1.6, accent, 8, 0, 0, 0, 0.2, { ao: false }); P.cyl(0, gy + 1.1, CZ, 1.0, 0.5, accent, 8, 0, 0, 0, 2.0, { ao: false });
      for (const a of [Math.PI / 6, 5 * Math.PI / 6, 7 * Math.PI / 6, 11 * Math.PI / 6]) { const x = Math.cos(a) * 5.2, z = CZ + Math.sin(a) * 5.2;
        k.metal.tube([x, RY, z], [x, gy - 0.2, z], 0.03, hex('#9AA1A8'), 4); k.glass.cyl(x, gy - 0.7, z, 0.9, 1.0, hex('#9CC7EE'), 6, 0, 0, 0, 0.1, { ao: false }); }
    }

    // ---------- 远处的人（外壳里，低模） ----------
    const spots = (f, m) => { const out = []; for (let i = 0; out.length < m && i < 80; i++) { const a = prnd() * TAU, r = 9.5 + prnd() * 4.5, x = Math.cos(a) * r, z = CZ + Math.sin(a) * r;
      if (Math.abs(x) < 4.2 && Math.abs(z - CZ) > 6) continue; if (x < -6 && Math.abs(z - CZ) < 3.5) continue; if (Math.hypot(x - dPos[0], z - dPos[1]) < 2) continue; out.push([x, z, a]); } return out; };
    let pi = 0;
    for (let f = 0; f < NF; f++) for (const [x, z, a] of spots(f, 4)) lowPerson(P, x, f * FH, z, a + (pi % 2 ? Math.PI / 2 : -Math.PI / 2), pi++, pi % 5 === 2);
    k.finish(true); A.finish(k.root, 'smMallSigns');

    // ---------- 每层的细节（人 / 美食广场桌椅）：只开玩家所在层 ±1 ----------
    this.detail = [];
    for (let f = 0; f < NF; f++) {
      const dk = new Kit(scene, 'smMallF' + (f + 1), k.root), Pd = dk.solid, y = f * FH;
      for (const [x, z, a] of spots(f, f === 0 ? 7 : 5)) shopper(Pd, x, y, z, a + (pi % 2 ? Math.PI / 2 : -Math.PI / 2), pi++, { lo: pi % 3 === 0 });
      if (f === 0) { family(Pd, -5, 0, CZ - 6, 0.4, 9); for (let i = 0; i < 3; i++) shopper(Pd, (i - 1) * 1.6, 0, 7 + i * 1.5, i % 2 ? 0 : Math.PI, pi++); }
      if (f === 1) family(Pd, 6, y, CZ + 11, Math.PI + 0.3, 10);
      if (f === NF - 1) {
        const corners = n === 16 ? [[8.13, CZ + 8.13], [-8.13, CZ + 8.13], [-8.13, CZ - 8.13]] : [[12.4, CZ + 12.4], [-12.4, CZ + 12.4], [-12.4, CZ - 12.4]];
        for (const [cx, cz] of corners) for (const [ox, oz] of n === 16 ? [[-0.9, 0.9], [0.9, -0.9]] : [[-1.3, -1.3], [1.3, -1.3], [-1.3, 1.3], [1.3, 1.3]]) {
          const x = cx + ox, z = cz + oz; Pd.cyl(x, y + 0.74, z, 1.0, 0.05, hex('#F4F1EA'), 12, 0, 0, 0, undefined, { ao: false }); Pd.cyl(x, y + 0.37, z, 0.12, 0.72, hex('#7A7F86'), 6, 0, 0, 0, undefined, { ao: false });
          for (let j = 0; j < 4; j++) { const ja = j * Math.PI / 2 + 0.4; Pd.cyl(x + Math.cos(ja) * 0.75, y + 0.23, z + Math.sin(ja) * 0.75, 0.38, 0.46, hex(['#E07A3A', '#F2C14E', '#4E8F6A', '#5BA4D8'][j]), 8, 0, 0, 0, undefined, { ao: false }); }
          dk.col(x, y + 0.4, z, 1.0, 0.8, 1.0);
          if (prnd() < 0.6) bakePerson(Pd, x + 0.75, y, z - 0.2, -Math.PI / 2, randomLook({ kid: prnd() < 0.3 }), POSES.sit || POSES.stand);
        }
      }
      dk.finish(true); this.detail.push(dk);
    }
    this._detailFloor = -9; this.setDetail(0);

    // ---------- 动的部分：门（实例）、电梯轿厢 ----------
    const metalM = bucketMat(scene, k.M, 'metal'), glassM = bucketMat(scene, k.M, 'glass');
    const gSrc = B.MeshBuilder.CreateBox('smGateDoor', { width: 1.6, height: 2.95, depth: 0.05 }, scene); gSrc.material = glassM; gSrc.parent = k.root; gSrc.isPickable = false; gSrc.alphaIndex = 11;
    let gi = 0;
    for (const d of this.gdoors) for (const sg of [-1, 1]) { const m = gi++ ? gSrc.createInstance('smGateDoorI' + gi) : gSrc; m.parent = k.root; m.rotation.y = d.fr.ry; m.isPickable = false; d.panels.push({ m, sg }); }
    if (!gi) gSrc.setEnabled(false);
    this._placeGateDoors(0);
    // 电梯
    const Lf = LIFT, ccx = (Lf.cx0 + Lf.cx1) / 2, hw = (Lf.cx1 - Lf.cx0) / 2;
    const ck = this.car = new Kit(scene, 'smLiftCar', k.root); ck.root.position.set(ccx, 0, CZ);
    ck.solid.slab(-hw, hw, -0.15, 0, -Lf.cz, Lf.cz, hex('#B9B2A6'), { ao: false }); ck.col(0, -0.15, 0, 2 * hw, 0.3, 2 * Lf.cz, { dynamic: true });
    ck.solid.slab(-hw, hw, 2.55, 2.65, -Lf.cz, Lf.cz, WHITE, { ao: false }); ck.glow.slab(-hw + 0.3, hw - 0.3, 2.53, 2.55, -0.8, 0.8, hex('#FFF6E0'), { ao: false });
    for (const sg of [-1, 1]) { ck.glass.slab(-hw, hw, 0, 2.55, sg * Lf.cz - 0.02, sg * Lf.cz + 0.02, hex('#DDF0F8'), { ao: false }); ck.col(0, 1.3, sg * (Lf.cz + 0.02), 2 * hw, 2.6, 0.08, { dynamic: true });
      ck.metal.tube([-hw + 0.1, 0.95, sg * (Lf.cz - 0.06)], [hw - 0.1, 0.95, sg * (Lf.cz - 0.06)], 0.05, STEEL, 6);
      ck.metal.slab(-hw - 0.03, -hw + 0.03, 0, 2.6, sg * 0.95, sg * Lf.cz, STEEL, { ao: false }); ck.col(-hw, 1.3, sg * (0.95 + Lf.cz) / 2, 0.08, 2.6, Lf.cz - 0.95, { dynamic: true }); }
    ck.glass.slab(hw - 0.02, hw + 0.02, 0, 2.55, -Lf.cz, Lf.cz, hex('#DDF0F8'), { ao: false }); ck.col(hw + 0.02, 1.3, 0, 0.08, 2.6, 2 * Lf.cz, { dynamic: true });
    ck.metal.tube([hw - 0.06, 0.95, -Lf.cz + 0.1], [hw - 0.06, 0.95, Lf.cz - 0.1], 0.05, STEEL, 6);
    ck.solid.slab(hw - 0.08, hw - 0.04, 1.0, 1.6, 0.55, 0.95, hex('#2B3036'), { ao: false });
    for (let f = 0; f < NF; f++) ck.glow.slab(hw - 0.09, hw - 0.08, 1.07 + f * 0.085, 1.13 + f * 0.085, 0.65, 0.85, hex('#FFE08A'), { ao: false });
    this.carDoorCol = ck.col(-hw - 0.02, 1.2, 0, 0.08, 2.4, 1.9, { dynamic: true });
    ck.finish(false);
    const dSrc = B.MeshBuilder.CreateBox('smLiftDoor', { width: 0.05, height: 2.35, depth: 0.97 }, scene); dSrc.material = metalM; dSrc.isPickable = false;
    this.carPanels = []; this.landing = [];
    let di = 0; const inst = () => { const m = di++ ? dSrc.createInstance('smLiftDoorI' + di) : dSrc; m.isPickable = false; return m; };
    for (const sg of [-1, 1]) { const m = inst(); m.parent = ck.root; m.position.set(-hw - 0.06, 1.18, sg * 0.485); this.carPanels.push({ m, sg }); }
    for (let f = 0; f < NF; f++) { const y = f * FH, pan = [];
      for (const sg of [-1, 1]) { const m = inst(); m.parent = k.root; m.position.set(Lf.x0 - 0.1, y + 1.18, CZ + sg * 0.485); pan.push({ m, sg }); }
      this.landing.push({ f, y, panels: pan, col: k.col(Lf.x0 - 0.1, y + 1.2, CZ, 0.1, 2.4, 1.9, { dynamic: true }) }); }
    this.lift = { y: 0, floor: 0, state: 'idle', t: 0, queue: null, target: null, from: 0, to: 0, dur: 1, door: new Array(NF).fill(0), rides: 0 };
    // 轿厢里的楼层按钮面板（HUD）
    const hud = typeof document !== 'undefined' && document.getElementById('hud');
    if (hud) {
      const old = document.getElementById('smLiftPanel'); if (old) old.remove();
      hud.insertAdjacentHTML('beforeend', `<div id="smLiftPanel" class="glass" hidden><b>观光电梯</b><div class="fl"></div></div>`);
      this.panel = document.getElementById('smLiftPanel');
      const rows = []; for (let f = NF; f >= 1; f--) rows.push(f);
      this.panel.querySelector('.fl').innerHTML = rows.map(f => `<button class="flb" data-f="${f}"><span>${f}F</span><small>${f === 1 ? '大堂' : f === NF ? '美食' : THEME[plan[f - 1]][0].split(' ')[0]}</small></button>`).join('');
      this.panel.querySelectorAll('.flb').forEach(b => pressable(b, () => this.press(+b.dataset.f)));
      ['pointerdown', 'pointermove', 'pointerup', 'touchstart', 'click'].forEach(tp => this.panel.addEventListener(tp, e => e.stopPropagation()));
    }
  }
  setDetail(fl) { if (fl === this._detailFloor) return; this._detailFloor = fl; this.detail.forEach((d, f) => { const en = Math.abs(f - fl) <= 1; if (d.root.isEnabled() !== en) d.root.setEnabled(en); }); }
  _placeGateDoors() {
    for (const d of this.gdoors) for (const { m, sg } of d.panels) { const c = d.g.c + sg * (0.8 + 1.5 * d.open), x = d.fr.nx * AW + d.fr.ex * c, z = CZ + d.fr.nz * AW + d.fr.ez * c; m.position.set(x, d.y + 1.5, z); }
  }
  floorOf(p) { return Math.max(0, Math.min(this.NF - 1, Math.round((p.y - this.o.y) / FH))); }
  inCar(p) { const L = this.LIFT, lx = p.x - this.o.x, lz = p.z - this.o.z; return lx > L.cx0 + 0.1 && lx < L.cx1 && Math.abs(lz - CZ) < L.cz && Math.abs(p.y - this.o.y - this.lift.y) < 1.3; }
  /** 叫梯 / 按楼层（n = 1..NF） */
  press(n) { const f = n - 1; if (this.panel) this.panel.querySelectorAll('.flb').forEach(b => { if (+b.dataset.f === n) b.classList.add('on'); }); this.go(f); }
  go(f) {
    const L = this.lift; f = Math.max(0, Math.min(this.NF - 1, f));
    if (L.state === 'moving') { L.queue = f; return; }
    L.target = f;
    if (f === L.floor) { if (L.state !== 'open') L.state = 'opening'; L.t = 0; return; }
    L.queue = f; if (L.state === 'open' || L.state === 'opening') L.state = 'closing'; else if (L.state === 'idle') this._startMove();
  }
  _startMove() { const L = this.lift; L.state = 'moving'; L.from = L.floor; L.to = L.queue; L.queue = null; L.t = 0; L.dur = 1.0 * Math.abs(L.to - L.from) + 0.8; L.rides++; }
  update(pl, dt) {
    const p = pl.position, L = this.lift, Lf = this.LIFT, lx = p.x - this.o.x, lz = p.z - this.o.z, ly = p.y - this.o.y, fl = this.floorOf(p);
    this.setDetail(fl);
    // 天桥门：走近就开
    let moved = false;
    for (const d of this.gdoors) { const [gx, gz] = [d.fr.nx * AW + d.fr.ex * d.g.c, CZ + d.fr.nz * AW + d.fr.ez * d.g.c], near = Math.abs(ly - d.y) < 1.6 && Math.hypot(lx - gx, lz - gz) < 3.6;
      const nv = d.open + Math.sign((near ? 1 : 0) - d.open) * Math.min(Math.abs((near ? 1 : 0) - d.open), dt / 0.6); if (nv !== d.open) { d.open = nv; moved = true; }
      const block = d.open < 0.85; if (d.col.isEnabled() !== block) d.col.setEnabled(block); }
    if (moved) this._placeGateDoors();
    // 电梯：走到门口自动叫梯
    const inCar = this.inCar(p);
    if (!inCar && L.state !== 'moving' && lx < Lf.x0 - 0.1 && lx > Lf.x0 - 2.2 && Math.abs(lz - CZ) < 1.6 && Math.abs(ly - fl * FH) < 1 && !(L.floor === fl && (L.state === 'open' || L.state === 'opening'))) this.go(fl);
    if (L.state === 'opening') { L.t += dt; if (L.t > 0.7) { L.state = 'open'; L.t = 0; } }
    else if (L.state === 'open') { L.t += dt; const inDoor = lx > Lf.x0 - 0.7 && lx < Lf.cx0 + 0.5 && Math.abs(lz - CZ) < 1.0 && Math.abs(ly - L.y) < 1.5;
      if (L.queue !== null && !inDoor) L.state = 'closing'; else if (L.t > 6 && !inDoor && !inCar) L.state = 'closing'; }
    else if (L.state === 'moving') {
      L.t += dt; const kk = Math.min(1, L.t / L.dur), e = kk * kk * (3 - 2 * kk), ny = (L.from + (L.to - L.from) * e) * FH;
      const wasIn = this.inCar(p); L.y = ny; this.car.root.position.y = ny;
      for (const c of this.car.colliders) c.computeWorldMatrix(true);
      if (wasIn) { p.y = this.o.y + ny + 0.02; pl.groundY = this.o.y + ny; pl.vy = 0; pl.collider && pl.collider.computeWorldMatrix(true); }
      if (kk >= 1) { L.floor = L.to; L.target = null; L.state = 'opening'; L.t = 0; }
    }
    const want = L.state === 'opening' || L.state === 'open' ? 1 : 0;
    for (const d of this.landing) {
      const tgt = d.f === L.floor && L.state !== 'moving' ? want : 0, cur = L.door[d.f], nv = cur + Math.sign(tgt - cur) * Math.min(Math.abs(tgt - cur), dt / 0.7);
      if (nv !== cur || this._init !== true) { L.door[d.f] = nv; for (const { m, sg } of d.panels) m.position.z = CZ + sg * (0.485 + 0.92 * nv); }
      const blocked = nv < 0.85; if (d.col.isEnabled() !== blocked) d.col.setEnabled(blocked);
    }
    const cd = L.state === 'moving' ? 0 : L.door[L.floor];
    for (const { m, sg } of this.carPanels) m.position.z = sg * (0.485 + 0.92 * cd);
    const cb = cd < 0.85; if (this.carDoorCol.isEnabled() !== cb) this.carDoorCol.setEnabled(cb);
    this._init = true;
    if (L.state === 'closing' && L.door[L.floor] <= 0.001) { if (L.queue !== null) this._startMove(); else L.state = 'idle'; }
    if (this.panel) { const show = inCar && L.state !== 'moving'; if (this.panel.hidden === show) this.panel.hidden = !show;
      if (show) this.panel.querySelectorAll('.flb').forEach(b => b.classList.toggle('on', +b.dataset.f === L.floor + 1 || (L.target !== null && +b.dataset.f === L.target + 1))); }
  }
  /** 出口：1F 正门 → 'main'；天桥门外 2.6 m → 天桥的 key */
  wantsOut(p) {
    const lx = p.x - this.o.x, lz = p.z - this.o.z, ly = p.y - this.o.y;
    if (lz < -2.6 && Math.abs(lx) < 3 && ly < 1.5) return 'main';
    for (const d of this.gdoors) { const r = d.fr.nx * lx + d.fr.nz * (lz - CZ), c = d.fr.ex * lx + d.fr.ez * (lz - CZ); if (r > AW + 2.6 && Math.abs(c - d.g.c) < 3 && Math.abs(ly - d.y) < 1.5) return d.g.key; }
    return null;
  }
  spawn(gate = this.o.gate || 'main') {
    const d = this.gdoors.find(x => x.g.key === gate);
    if (!d) return [this.o.x, this.o.y + 0.05, this.o.z - 0.4, 0];
    const r = AW - 1.2, x = d.fr.nx * r + d.fr.ex * d.g.c, z = CZ + d.fr.nz * r + d.fr.ez * d.g.c; this.setDetail(d.g.f);
    return [this.o.x + x, this.o.y + d.y + 0.05, this.o.z + z, Math.atan2(-d.fr.nx, -d.fr.nz)];
  }
  zoneOf(p) { return { kind: 'interior', net: 'xm', building: this.id, floor: this.floorOf(p) + 1, inUnit: false }; }
  info() { const L = this.lift; return { id: this.id, floors: this.NF, shops: this.shops, shopFloors: this.shopFloors, gates: this.gates.map(g => g.key), lift: { state: L.state, floor: L.floor + 1, y: L.y, rides: L.rides, panel: this.panel ? !this.panel.hidden : null },
    esc: this.esc.map(e => ({ p: e.p, x: e.x, from: e.from, to: e.to })), stair: this.st, edge: { sx: [-0.9, -2.7].map(x => [this.edgeZ(x, -1), this.edgeZ(x, 1)]) }, overflow: this.atlas.overflow, detailFloor: this._detailFloor + 1 }; }
  dispose() {
    if (this.panel) this.panel.remove();
    this.atlas.dispose(); this.kit.root.getChildMeshes(false).forEach(m => m.dispose()); this.kit.root.dispose();
  }
}

/** 黄宝石中庭金环吊灯：5 圈哑光金环（#C9A75E，同四期金环）上大下小、错层吊在天窗下，像倒置的层叠灯；
 *  只有环底一圈细灯带 + 两圈小珠灯 + 中心垂珠是暖白自发光，环本身不发光。全部进 metal / glow 两个已有桶（不加 draw），
 *  约 2k 三角形，无实时光源。环最大 R 5.0 —— 西边观光电梯井内壁在 x = −5.3，不碰；最低点 y ≈ RY − 3.6，在 5F 楼面（RY − 5.5）上方。 */
export const TOPAZ_RINGS = [[5.0, 0.8, 0.12, 40], [4.1, 1.45, 0.11, 36], [3.2, 2.1, 0.1, 30], [2.3, 2.7, 0.09, 24], [1.4, 3.2, 0.08, 18]];   // [R, 距 RY 往下, 管半径, 段数]
function topazChandelier(k, CZ, RY) {
  const M = k.metal, G = k.glow, cable = hex('#8C9096'), warm = hex('#FFF1D0'), top = RY + 1.15;
  const bead = (x, y, z, s) => {   // 小八面体珠灯（8 三角形，正面朝外）
    const v = [[0, s, 0], [s, 0, 0], [0, 0, s], [-s, 0, 0], [0, 0, -s], [0, -s, 0]], b0 = G.p.length / 3;
    for (const [dx, dy, dz] of v) { const l = Math.hypot(dx, dy, dz); G.push(x + dx, y + dy, z + dz, dx / l, dy / l, dz / l, warm); }
    for (const [a, b] of [[1, 2], [2, 3], [3, 4], [4, 1]]) G.i.push(b0, b0 + a, b0 + b, b0 + 5, b0 + b, b0 + a); };
  TOPAZ_RINGS.forEach(([R, dy, r, seg], i) => {
    const y = RY - dy; goldRing(k, 0, y, CZ, R, r, seg, '#FFF1D0');
    for (let j = 0; j < 4; j++) { const a = (j + (i % 2) * 0.5) / 4 * Math.PI * 2 + Math.PI / 4, x = Math.cos(a) * R, z = CZ + Math.sin(a) * R; M.tube([x, top, z], [x, y + r, z], 0.025, cable, 4, false); }
    if (i === 0 || i === 2) { const nb = i === 0 ? 20 : 14; for (let j = 0; j < nb; j++) { const a = (j + 0.5) / nb * Math.PI * 2; bead(Math.cos(a) * R, y - r - 0.16, CZ + Math.sin(a) * R, 0.07); } }
  });
  const yb = RY - 3.6; M.tube([0, top, CZ], [0, yb + 0.2, CZ], 0.07, hex('#C9A75E'), 6, false); bead(0, yb, CZ, 0.2);
}
