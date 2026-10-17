/*
 * 线路图（共用）：售票机屏幕上的单线“蛇形”线路图（SVG，可点选；Canvas 版画在 3D 售票机屏幕上）、游戏票价。
 * 全网图（networkSVG）：HUD 地图按钮全屏打开，站厅墙上也挂一张。
 * 站名和站序全部来自 js/data/lines.js；线路色 1 号线 #F3D03E、2 号线 #00629B。
 * 换乘站：公园前（1↔2）画成 1 号线黄 + 2 号线蓝的双色圆环；能换乘其他线路的站统一画白心粗深色圈（图例“可以换乘其他线路”）；“你在这里”大而亮，带呼吸光圈。
 */
import { LINES, STATIONS, OTHER_LINES } from '../data/lines.js';
import { ATTRACTIONS } from '../data/attractions.js';
import { iconSVG } from './mapicons.js';

export const GYQ = 'gyq';
/** 两站之间的站数（同线直接数；跨线经 1/2 号线的换乘站） */
export function stopsBetween(a, b) {
  if (a === b) return 0;
  let best = Infinity;
  for (const la of STATIONS[a].lines) for (const lb of STATIONS[b].lines) {
    const A = LINES[la].stations, Bs = LINES[lb].stations;
    if (la === lb) best = Math.min(best, Math.abs(A.indexOf(a) - A.indexOf(b)));
    else for (const x of A.filter(c => Bs.includes(c))) best = Math.min(best, Math.abs(A.indexOf(a) - A.indexOf(x)) + Math.abs(Bs.indexOf(x) - Bs.indexOf(b)));
  }
  return best;
}
/** 游戏票价（元）：按站数分段，起步 2 元。只是游戏里的价格，不是广州地铁的官方票价。 */
export function fareFor(a, b) {
  const n = stopsBetween(a, b);
  return n <= 3 ? 2 : n <= 6 ? 3 : n <= 9 ? 4 : n <= 13 ? 5 : n <= 18 ? 6 : 7;
}
export const isTransfer = c => STATIONS[c].lines.length > 1;
/** 售票机上选中的目的地颜色：单程票的青绿色（“你的票去这里”），和线路色、红色的“你在这里”都不一样 */
export const SEL = '#1AA39B';
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');
/** 名字太长（5 个字以上）就拆两行 */
export function wrapName(zh) { if (zh.length <= 4) return [zh]; const h = Math.ceil(zh.length / 2); return [zh.slice(0, h), zh.slice(h)]; }

/* ---------- 单线蛇形图（售票机屏幕 / 选目的地） ---------- */
const PER_ROW = 8, X0 = 72, DX = 122, ROW_H = 176, Y0 = 92;
export function snakeLayout(line) {
  const st = LINES[line].stations, rows = Math.ceil(st.length / PER_ROW);
  const pts = st.map((c, i) => { const r = Math.floor(i / PER_ROW), k = i % PER_ROW, kk = r % 2 ? PER_ROW - 1 - k : k; return { code: c, x: X0 + kk * DX, y: Y0 + r * ROW_H, r }; });
  return { pts, w: X0 * 2 + DX * (PER_ROW - 1), h: Y0 + (rows - 1) * ROW_H + 92, rows };
}
/** 单线图 SVG：here = 当前站，sel = 选中的目的地；每个站带 data-code，可点 */
export function lineSVG(line, { here, sel } = {}) {
  const L = LINES[line], { pts, w, h } = snakeLayout(line);
  let d = `M${pts[0].x} ${pts[0].y}`;
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1], b = pts[i];
    if (a.r !== b.r) { const ex = a.x + (a.r % 2 === 0 ? 70 : -70); d += ` C${ex} ${a.y} ${ex} ${b.y} ${b.x} ${b.y}`; }
    else d += ` L${b.x} ${b.y}`;
  }
  let s = `<svg class="linemap" viewBox="0 0 ${w} ${h}" xmlns="http://www.w3.org/2000/svg" style="--lc:${L.color}">`;
  s += `<path d="${d}" fill="none" stroke="${L.color}" stroke-width="16" stroke-linecap="round" stroke-linejoin="round"/>`;
  pts.forEach(p => {
    const isHere = p.code === here, isSel = p.code === sel, tr = isTransfer(p.code), nm = wrapName(STATIONS[p.code].zh);
    s += `<g class="st${isHere ? ' here' : ''}${isSel ? ' sel' : ''}" data-code="${p.code}">`;
    s += `<rect class="hit" x="${p.x - DX / 2}" y="${p.y - 46}" width="${DX}" height="${ROW_H - 18}" rx="18"/>`;
    if (isSel) s += `<circle class="glow" cx="${p.x}" cy="${p.y}" r="36"/>`;
    if (isHere) s += `<circle class="pulse" cx="${p.x}" cy="${p.y}" r="26"/>`;
    // 选中的目的地：白心 + 粗的单程票青绿圈（SEL）+ 名字青绿底白字，和红色实心的“你在这里”区分开
    if (isSel) s += `<circle class="dot" cx="${p.x}" cy="${p.y}" r="24" fill="#fff" stroke="${SEL}" stroke-width="10"/>` + (tr ? `<circle cx="${p.x}" cy="${p.y}" r="9" fill="#fff" stroke="${LINES[2].color}" stroke-width="5"/>` : '');
    else if (tr) s += `<circle cx="${p.x}" cy="${p.y}" r="${isHere ? 25 : 21}" fill="#fff" stroke="${LINES[1].color}" stroke-width="9"/><circle cx="${p.x}" cy="${p.y}" r="${isHere ? 14 : 11}" fill="#fff" stroke="${LINES[2].color}" stroke-width="6"/>`;
    else s += `<circle class="dot" cx="${p.x}" cy="${p.y}" r="${isHere ? 22 : 15}" fill="${isHere ? '#FF5A4E' : '#fff'}" stroke="${isHere ? '#fff' : L.color}" stroke-width="${isHere ? 6 : 7}"/>`;
    const fy = p.y + 58, fs = isHere || isSel ? 31 : 27;
    if (isSel) { const lw = Math.max(...nm.map(t => t.length)) * fs + 22; s += `<rect class="selbg" x="${p.x - lw / 2}" y="${fy - fs - 4}" width="${lw}" height="${nm.length * (fs + 3) + 14}" rx="14" fill="${SEL}"/>`; }
    nm.forEach((t, j) => { s += `<text class="nm" x="${p.x}" y="${fy + j * (fs + 3)}" font-size="${fs}" text-anchor="middle">${esc(t)}</text>`; });
    if (isHere) s += `<g class="youare"><rect x="${p.x - 62}" y="${p.y - 78}" width="124" height="38" rx="19"/><text x="${p.x}" y="${p.y - 51}" text-anchor="middle">你在这里</text></g>`;
    if (tr && !isHere) s += `<text class="xfer" x="${p.x}" y="${p.y - 32}" text-anchor="middle">换乘</text>`;
    s += '</g>';
  });
  return s + '</svg>';
}

/* ---------- Canvas 小线路图（售票机 3D 屏幕贴图） ---------- */
export function drawLineCanvas(c, line, here, x, y, w, h) {
  const L = LINES[line], { pts, w: W, h: H } = snakeLayout(line), k = Math.min(w / W, h / H), ox = x + (w - W * k) / 2, oy = y + (h - H * k) / 2;
  const P = p => [ox + p.x * k, oy + p.y * k];
  c.lineWidth = 16 * k; c.strokeStyle = L.color; c.lineCap = 'round'; c.lineJoin = 'round'; c.beginPath();
  pts.forEach((p, i) => { const [px, py] = P(p); if (i === 0) c.moveTo(px, py); else if (pts[i - 1].r !== p.r) { const [ax, ay] = P(pts[i - 1]), right = pts[i - 1].r % 2 === 0, ex = ax + (right ? 70 : -70) * k; c.bezierCurveTo(ex, ay, ex, py, px, py); } else c.lineTo(px, py); });
  c.stroke();
  pts.forEach(p => {
    const [px, py] = P(p), me = p.code === here;
    c.beginPath(); c.arc(px, py, (me ? 22 : 15) * k, 0, 7); c.fillStyle = me ? '#FF5A4E' : '#fff'; c.fill(); c.lineWidth = 6 * k; c.strokeStyle = me ? '#fff' : L.color; c.stroke();
    c.fillStyle = '#1B2430'; c.font = `600 ${Math.round((me ? 31 : 26) * k)}px "PingFang SC","Noto Sans CJK SC","Noto Sans SC",sans-serif`; c.textAlign = 'center'; c.textBaseline = 'alphabetic';
    wrapName(STATIONS[p.code].zh).forEach((t, j) => c.fillText(t, px, py + (56 + j * 30) * k));
  });
}

/* ---------- 全网图（1 号线 + 2 号线；HUD 地图按钮全屏打开，站厅墙上也挂一张） ----------
 * 示意图，不按真实比例：2 号线南北竖直穿过公园前，1 号线东西向（西段在黄沙拐向南到西塱，东段在体育中心拐向北到广州东站）。
 * 站序全部来自 lines.js；换乘站（公园前 1↔2）画大双色环，有其他已开通换乘线路的站统一画白心粗深色圈。
 */
const NW = 1240, NH = 1010, GX = 600, GY = 520;
const L1_POS = {   // 1 号线：[x, y, 标签位置 a=上 b=下 l=左 r=右]
  xl: [280, 820, 'l'], kk: [280, 745, 'l'], hdw: [280, 670, 'l'], fc: [280, 595, 'l'], hs: [280, GY, 'a'],
  csl: [360, GY, 'a'], cjc: [440, GY, 'a'], xmk: [520, GY, 'a'], gyq: [GX, GY, 'x'],
  njs: [680, GY, 'b'], lsly: [760, GY, 'A'], dsk: [840, GY, 'b'], yj: [920, GY, 'a'], tyxl: [1000, GY, 'b'], tyzx: [1080, GY, 'r'], gzdz: [1080, 420, 'r']
};
/** portrait = 竖屏版：同一张示意图横向收窄、纵向拉长（2 号线南北向更舒展），铺满竖屏宽度；图例挪到右下空白处 */
export function networkLayout(portrait = false) {
  const pos = {};
  LINES[1].stations.forEach(c => { pos[c] = L1_POS[c].slice(); });
  const s2 = LINES[2].stations, g = s2.indexOf('gyq');
  s2.forEach((c, i) => { if (c === 'gyq') return; pos[c] = i > g ? [GX, 440 - (i - g - 1) * 38, 'l'] : [GX, 600 + (g - 1 - i) * 34, 'r']; });
  if (!portrait) return { pos, w: NW, h: NH, legend: [40, 40] };
  for (const p of Object.values(pos)) { p[0] = p[0] - 100; p[1] = 760 + (p[1] - GY) * 1.45; }
  return { pos, w: 1140, h: 1500, legend: [790, 1060] };
}
/** “你在这里”脉动圈：r 30、描边 8，动画放大到 1.9 倍（css hereBreath）→ 最大外沿半径 */
export const PULSE_R = 30, PULSE_W = 8, PULSE_MAX = (PULSE_R + PULSE_W / 2) * 1.9;
const YOU_AT = { hs: 'L', tyzx: 'B', gzdz: 'L', lsly: 'U' };
/** 景点小图标：放在站名旁边的空白处，图标下面写景点短名。每个景点有几个候选位置（相对站点圆心），按顺序取第一个
 *  不压站名 / 站点 / 线 / “你在这里”标签 / 别的图标的位置（“你在这里”那一站站名变大，所以每次画图都重新挑）；离站点远时画一条线路色细引线。 */
export const ICON_R = 27, ICON_FS = 24, ICON_LY = ICON_R + 25;   // 图标半径、景点名字号（≥ 站名字号的一半）、景点名基线在圆心下方多少
export const NET_DEBUG = { obst: null };   // 排查用：上一次画图时图标要躲开的外框
/** 候选位置（相对站点圆心）[dx, dy, 景点名位置 'b' = 图标下面（默认）| 'r' = 图标右边, -, 画引线?]；横屏 / 竖屏站距不同，分开写。
 *  候选都放不下时在附近网格里找：离自己站最近（不比离别的站近）、不压东西的地方；离站远（> LEAD_D）就画引线。 */
const ICON_CAND = {
  L: {
    sysy: [[100, 8, 'r'], [100, 4, 'r'], [100, 0, 'r'], [104, 8, 'r'], [180, -6, 'r', false, true]],
    rams: [[64, -14, 'r'], [64, -10, 'r'], [68, -16, 'r'], [100, -12, 'r'], [100, -16, 'r'], [104, -12, 'r']],
    njs: [[86, 46], [88, 48], [90, 46], [88, 64], [80, 80], [88, 96], [96, 96], [100, 88], [108, 88]],
    hotel: [[86, 136], [86, 140], [88, 154], [80, 170], [88, 186], [96, 186], [100, 178], [108, 178], [170, 46], [170, 136]],
    cjc: [[0, 52], [-10, 52], [-40, 52], [40, 52], [0, -100], [-40, -100], [60, 100], [0, 100], [-20, 100], [20, 100]],
    shamian: [[-70, -10], [-70, -14], [0, -100], [-50, -60]],
  },
  P: {
    sysy: [[100, 0, 'r'], [100, -4, 'r'], [104, 6, 'r']],
    rams: [[56, -2, 'r'], [60, -6, 'r'], [102, -24, 'r'], [76, -20, 'r'], [80, -20, 'r']],
    njs: [[86, 46], [88, 48], [90, 46], [88, 64], [80, 80], [88, 96], [96, 96], [100, 88], [108, 88]],
    hotel: [[86, 136], [86, 140], [88, 154], [80, 170], [88, 186], [96, 186], [100, 178], [108, 178], [170, 46]],
    cjc: [[0, 52], [-10, 52], [-40, 52], [40, 52]],
    shamian: [[0, -100], [-50, -60], [-70, -10]],
  },
};
const LEAD_D = 110;
const GRID = []; for (let dx = -200; dx <= 200; dx += 10) for (let dy = -160; dy <= 160; dy += 8) for (const m of ['b', 'r']) { const d = Math.hypot(dx, dy); if (d > 40) GRID.push([dx, dy, m, d + (m === 'r' ? 24 : 0)]); }
GRID.sort((a, b) => a[3] - b[3]);
/** a = 矩形 [x, y, w, h]；b = 矩形，或圆 [cx, cy, r]（“你在这里”脉动圈放到最大时的外沿） */
const hit = (a, b) => b.length === 3 ? Math.hypot(Math.max(a[0], Math.min(b[0], a[0] + a[2])) - b[0], Math.max(a[1], Math.min(b[1], a[1] + a[3])) - b[1]) < b[2]
  : a[0] < b[0] + b[2] && b[0] < a[0] + a[2] && a[1] < b[1] + b[3] && b[1] < a[1] + a[3];
/** 文字的大致外框（中文每字约 1 个字号宽） */
const textRect = (x, y, t, fs, anc) => { const w = [...String(t)].length * fs + 2, x0 = anc === 'end' ? x - w : anc === 'start' ? x : x - w / 2; return [x0 - 1, y - fs * 1.15, w + 2, fs * 1.5]; };
const segRects = (x0, y0, x1, y1, hw) => { const n = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0) / (hw * 1.5))), out = []; for (let i = 0; i <= n; i++) { const t = i / n, x = x0 + (x1 - x0) * t, y = y0 + (y1 - y0) * t; out.push([x - hw, y - hw, hw * 2, hw * 2]); } return out; };
export const iconFs = name => [...name].length >= 5 ? ICON_FS - 3 : ICON_FS;   // 名字长（中山纪念堂）字小一号
/** 景点名的位置：'b' 图标正下方居中；'r' 图标右边、和圆心齐平 */
export const labelAt = (x, y, name, mode) => mode === 'r' ? [x + ICON_R + 7, y + iconFs(name) * 0.36, 'start'] : [x, y + ICON_LY, 'middle'];
export const iconRects = (x, y, name, mode) => { const [lx, ly, anc] = labelAt(x, y, name, mode); return [[x - ICON_R - 2, y - ICON_R - 2, ICON_R * 2 + 4, ICON_R * 2 + 4], textRect(lx, ly, name, iconFs(name), anc)]; };
/** 挑位置：obstacles = 已有元素外框；返回每个景点 { ...a, x, y, leader } */
export function placeIcons(pos, obstacles, portrait = false, here = null, noGrid = false) {   // 按默认顺序摆；有图标只能退到网格里时，换成纪念堂最后摆再试一次，取退得少的
  let res = null;
  for (const order of [ATTRACTIONS, [...ATTRACTIONS.filter(a => a.code !== 'jnt'), ...ATTRACTIONS.filter(a => a.code === 'jnt')]]) {
    const ob = obstacles.slice(), out = placeOrder(order, pos, ob, portrait, here, noGrid), bad = out.filter(a => a.forced).length * 100 + out.filter(a => a.ringSoft).length * 10 + out.filter(a => a.grid).length;
    if (!res || bad < res.bad) res = { out, ob, bad };
    if (!bad) break;
  }
  obstacles.length = 0; obstacles.push(...res.ob);
  return ATTRACTIONS.map(a => res.out.find(b => b.id === a.id));
}
function placeOrder(order, pos, obstacles, portrait, here, noGrid) {
  const out = [], C = ICON_CAND[portrait ? 'P' : 'L'];
  for (const a of order) {
    const [sx, sy] = pos[a.code];
    let best = null;
    const amb = (x, y, d) => Object.entries(pos).some(([c, p]) => c !== a.code && Math.hypot(x - p[0], y - p[1]) < d);
    // 第 1 轮：手写候选 + 附近网格，全部要躲（含“你在这里”脉动圈最大外沿）；第 2 轮（别的站的图标才有）：只用手写候选，允许被脉动圈扫到
    const rounds = [[noGrid ? C[a.id] : [...C[a.id], ...GRID.map(g => [g[0], g[1], g[2], true])], obstacles]];
    if (a.code !== here && !noGrid) rounds.push([C[a.id], obstacles.filter(o => o.length === 4)]);
    for (const [cands, avoid] of rounds) { if (best) break;
    for (const [dx, dy, m = 'b', grid, lead] of cands) {
      const x = sx + dx, y = sy + dy, d = Math.hypot(dx, dy), far = lead || (grid && d > LEAD_D);   // 手写候选不画引线（除非第 5 项写了 true）
      if (grid && amb(x, y, d)) continue;
      const R = iconRects(x, y, a.name, m);
      if (R.some(r => avoid.some(o => hit(r, o)))) continue;
      const L = far ? segRects(sx + dx * 26 / d, sy + dy * 26 / d, x - dx * (ICON_R + 2) / d, y - dy * (ICON_R + 2) / d, 2) : [];
      if (L.some(r => avoid.some(o => o.length === 4 && hit(r, o)))) continue;
      best = { ...a, x, y, mode: m, leader: far ? [sx, sy] : null, grid: !!grid, ringSoft: avoid !== obstacles }; obstacles.push(...R, ...L); break;
    } }
    if (!best) { const [dx, dy, m = 'b'] = C[a.id][0]; best = { ...a, x: sx + dx, y: sy + dy, mode: m, leader: null, forced: true }; }
    out.push(best);
  }
  return out;
}
/** 五角星 path（图例里“景点”的小白圆图标） */
const star = (cx, cy, r) => 'M' + Array.from({ length: 10 }, (_, i) => { const a = -Math.PI / 2 + i * Math.PI / 5, q = i % 2 ? r * 0.45 : r; return (cx + Math.cos(a) * q).toFixed(1) + ' ' + (cy + Math.sin(a) * q).toFixed(1); }).join('L') + 'Z';
/** 换乘其他线路的站：统一一种样式（白心 + 粗深色圈），不再按换乘线路上色 */
export const XRING = '#1B2430', XR = 14, XW = 7;
const OTHER = c => STATIONS[c].x.map(k => OTHER_LINES[k]).filter(Boolean);
/** 全网图 SVG；here = 当前站（脉动的“你在这里”），opts.wall = 墙上版（不要动画，字更粗） */
export function networkSVG(here, opts = {}) {
  const { pos, w, h, legend: [gx, gy] } = networkLayout(!!opts.portrait), F = 'font-family="PingFang SC,Hiragino Sans GB,Noto Sans CJK SC,Noto Sans SC,Microsoft YaHei,sans-serif"';
  let s = `<svg class="netmap" viewBox="0 0 ${w} ${h}" xmlns="http://www.w3.org/2000/svg" ${F}>`;
  s += `<rect width="${w}" height="${h}" rx="28" fill="#FFFFFF"/>`;
  // 标题 + 图例（换乘站只有两种样式：公园前 1↔2 双色环；其他站能换乘别的线路 = 白心粗深色圈）
  s += `<text x="${gx}" y="${gy + 26}" font-size="40" font-weight="800" fill="#1B2430">广州地铁</text><text x="${gx}" y="${gy + 60}" font-size="20" font-weight="600" fill="#6B7787" font-family="Helvetica Neue,Arial,sans-serif">Guangzhou Metro</text>`;
  [1, 2].forEach((l, i) => { const L = LINES[l], y = gy + 100 + i * 56; s += `<rect x="${gx}" y="${y}" width="74" height="40" rx="12" fill="${L.color}"/><text x="${gx + 37}" y="${y + 30}" font-size="28" font-weight="800" fill="${L.ink}" text-anchor="middle">${l}</text><text x="${gx + 86}" y="${y + 30}" font-size="26" font-weight="700" fill="#1B2430">${L.zh}</text>`; });
  s += `<circle cx="${gx + 22}" cy="${gy + 240}" r="18" fill="#fff" stroke="${LINES[1].color}" stroke-width="8"/><circle cx="${gx + 22}" cy="${gy + 240}" r="8" fill="#fff" stroke="${LINES[2].color}" stroke-width="6"/><text x="${gx + 52}" y="${gy + 249}" font-size="23" font-weight="700" fill="#34404F">1号线和2号线在这里换乘</text>`;
  s += `<circle cx="${gx + 22}" cy="${gy + 290}" r="${XR}" fill="#fff" stroke="${XRING}" stroke-width="${XW}"/><text x="${gx + 52}" y="${gy + 299}" font-size="23" font-weight="700" fill="#34404F">可以换乘其他线路</text>`;
  s += `<g class="legend-attr"><circle cx="${gx + 22}" cy="${gy + 340}" r="17" fill="#fff" stroke="#6B7787" stroke-width="3"/><path d="${star(gx + 22, gy + 340, 10)}" fill="#F2B233"/></g><text x="${gx + 52}" y="${gy + 349}" font-size="23" font-weight="700" fill="#34404F">可以下车游玩的景点</text>`;
  const obst = [];   // 景点图标要躲开的元素外框
  [[gx, gy, 315, 362]].forEach(r => obst.push(r));   // 标题 + 图例
  // 线
  for (const l of [1, 2]) {
    const pts = LINES[l].stations.map(c => pos[c]);
    for (let i = 0; i < pts.length - 1; i++) obst.push(...segRects(pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1], 9).map(r => Object.assign(r, { ln: 1 })));   // ln：线路本身（“你在这里”的引线可以跨过）
    s += `<polyline points="${pts.map(p => p[0] + ',' + p[1]).join(' ')}" fill="none" stroke="${LINES[l].color}" stroke-width="16" stroke-linecap="round" stroke-linejoin="round"/>`;
  }
  // 站点 + 站名
  for (const [c, [x, y, side]] of Object.entries(pos)) {
    const S = STATIONS[c], both = S.lines.length > 1, oth = OTHER(c), me = c === here, l = S.lines[0];
    if (both) s += `<circle cx="${x}" cy="${y}" r="27" fill="#fff" stroke="${LINES[1].color}" stroke-width="11"/><circle cx="${x}" cy="${y}" r="13" fill="#fff" stroke="${LINES[2].color}" stroke-width="8"/>`;
    else if (oth.length) s += `<circle cx="${x}" cy="${y}" r="${XR}" fill="#fff" stroke="${XRING}" stroke-width="${XW}"/>`;
    else s += `<circle cx="${x}" cy="${y}" r="10" fill="#fff" stroke="${LINES[l].color}" stroke-width="6"/>`;
    const fs = me ? 30 : both ? 30 : 25, fw = me || both ? 800 : 600, col = me ? '#E2312A' : '#1B2430';
    let tx = x, ty = y + 9, anc = 'middle';
    if (side === 'a') ty = y - 26; else if (side === 'A') { ty = y - 26; tx = x - 12; anc = 'start'; } else if (side === 'b') ty = y + 44; else if (side === 'l') { tx = x - 24; anc = 'end'; } else if (side === 'r') { tx = x + 24; anc = 'start'; } else { tx = x - 30; ty = y + 54; anc = 'end'; }
    s += `<text x="${tx}" y="${ty}" font-size="${fs}" font-weight="${fw}" fill="${col}" text-anchor="${anc}" paint-order="stroke" stroke="#fff" stroke-width="6" stroke-linejoin="round">${esc(S.zh)}</text>`;
    obst.push(textRect(tx, ty, S.zh, fs, anc), [x - 30, y - 30, 60, 60].map((v, i) => i < 2 ? v + (both ? 0 : 14) : both ? v : v - 28));
  }
  // 景点小图标（白底圆 + 线路色细圈 + 彩色剪影，下面写景点名；点一下打开小卡片，见 main.js）
  if (here && pos[here]) { const [x, y] = pos[here]; obst.push(Object.assign([x - 32, y - 32, 64, 64], { me: 1 }), [x, y, PULSE_MAX + 2]); }   // 红点 + 脉动圈最大时的外沿
  NET_DEBUG.obst = obst.slice();
  // “你在这里”标签的首选位置（站名另一侧 / YOU_AT）如果本身不压东西，先占住，图标让开
  let icons = null, youFix = null;
  if (here && pos[here]) {
    // 依次试“你在这里”标签的几个常用位置：标签位本身空着就先占住，再摆图标；图标都能放在手写位置、引线也不压图标才采用
    const [hx, hy] = pos[here];
    for (const [lx, ly] of [...youSpots(here, pos), ...youRing(hx, hy)]) {
      const r = [lx - 80, ly - 27, 160, 54];
      if (lx < 84 || ly < 30 || lx > w - 84 || ly > h - 30 || obst.some(o => o.length === 4 && hit(r, o))) continue;
      const ob = [...obst, r], t = placeIcons(pos, ob, !!opts.portrait, here, true);
      if (t.some(a => a.forced || a.grid || a.ringSoft)) continue;
      ob.splice(ob.indexOf(r), 1);
      if (youCost(hx, hy, lx, ly, ob) > 0) continue;
      icons = t; youFix = [lx, ly]; obst.length = 0; obst.push(...ob); break;
    }
  }
  if (!icons) icons = placeIcons(pos, obst, !!opts.portrait, here);   // 先摆图标，“你在这里”标签再挑一个不压图标 / 站名的方向
  const youXY = here && pos[here] ? youFix || youAt(here, pos, obst, w, h) : null;
  for (const a of icons) {
    const ring = LINES[STATIONS[a.code].lines[0]].color;
    if (a.leader) { const [sx, sy] = a.leader, d = Math.hypot(a.x - sx, a.y - sy), ux = (a.x - sx) / d, uy = (a.y - sy) / d; s += `<line class="attrlead" x1="${(sx + ux * 16).toFixed(1)}" y1="${(sy + uy * 16).toFixed(1)}" x2="${(a.x - ux * (ICON_R + 1)).toFixed(1)}" y2="${(a.y - uy * (ICON_R + 1)).toFixed(1)}" stroke="${ring}" stroke-width="3" stroke-dasharray="2 5" stroke-linecap="round"/>`; }
    s += `<g class="attr" data-attr="${a.id}" data-code="${a.code}"${a.forced ? ' data-forced="1"' : ''}${a.grid ? ' data-grid="1"' : ''}${a.ringSoft ? ' data-ringsoft="1"' : ''}><circle cx="${a.x}" cy="${a.y + (a.mode === 'r' ? 0 : 8)}" r="${ICON_R + 14}" fill="#fff" fill-opacity="0"/>${iconSVG(a.icon, a.x, a.y, ICON_R, ring)}`;
    const [lx, ly, anc] = labelAt(a.x, a.y, a.name, a.mode);
    s += `<text class="attrnm" x="${lx}" y="${ly.toFixed(1)}" font-size="${iconFs(a.name)}" font-weight="700" fill="#34404F" text-anchor="${anc}" paint-order="stroke" stroke="#fff" stroke-width="5" stroke-linejoin="round">${esc(a.name)}</text></g>`;
  }
  // 你在这里：红点 + 脉动圈 + 标签
  if (here && pos[here]) {
    const [x, y] = pos[here];
    if (!opts.wall) s += `<circle class="pulse" cx="${x}" cy="${y}" r="${PULSE_R}" fill="none" stroke="#FF5A4E" stroke-width="${PULSE_W}"/>`;
    // 标签放在站名的另一侧（不盖住站名）；几个拐角站单独指定
    const [lx, ly] = youXY;
    s += `<g class="youare"><line x1="${x}" y1="${y}" x2="${lx}" y2="${ly}" stroke="#FF5A4E" stroke-width="5"/><rect x="${lx - 78}" y="${ly - 25}" width="156" height="50" rx="25" fill="#FF5A4E" stroke="#fff" stroke-width="4"/><text x="${lx}" y="${ly + 10}" font-size="28" font-weight="800" fill="#fff" text-anchor="middle">你在这里</text></g>`;
    s += `<circle class="here" cx="${x}" cy="${y}" r="${opts.wall ? 20 : 16}" fill="#FF5A4E" stroke="#fff" stroke-width="5"/>`;
  }
  return s + '</svg>';
}
const YOU_D = { R: [128, 0], L: [-128, 0], B: [0, 74], U: [0, -70], UR: [140, -96], DR: [150, 100], UL: [-140, -96], DL: [-150, 100], UU: [80, -130], UUL: [-80, -130], UR2: [100, -120], UR3: [96, -164], BL: [-70, 80] };
/** “你在这里”标签位置：默认放在站名的另一侧；obst 给了就按顺序换方向，躲开景点图标（站名、站点也躲，不压别的东西） */
const youPref = (here, pos) => YOU_AT[here] || { l: 'R', r: 'L', a: 'B', A: 'B', b: 'U', x: 'UR' }[pos[here][2]];
/** 常用位置：首选方向（站名另一侧 / YOU_AT）+ 几个固定方向 */
function youSpots(here, pos) { const [x, y] = pos[here]; return [youPref(here, pos), 'U', 'B', 'R', 'L', 'UR', 'UR2', 'UR3', 'DR', 'UL', 'DL', 'BL'].map(sd => [x + YOU_D[sd][0], y + YOU_D[sd][1]]); }
const youRing = (x, y) => { const out = []; for (const d of [100, 130, 160, 190, 220, 260, 300]) for (let k = 0; k < 36; k++) out.push([x + Math.round(Math.cos(k / 36 * Math.PI * 2) * d * 1.3), y + Math.round(Math.sin(k / 36 * Math.PI * 2) * d)]); return out; };
/** 标签放在 (lx, ly) 的代价：标签压到任何东西 / 引线压到站名、站点、图标 = 每个 1000；引线跨过线路 = 1 */
function youCost(x, y, lx, ly, obst) {
  const d = Math.hypot(lx - x, ly - y), e = Math.min(80 / Math.max(1e-6, Math.abs(lx - x)), 27 / Math.max(1e-6, Math.abs(ly - y)));
  const pill = [lx - 80, ly - 27, 160, 54], L = segRects(x + (lx - x) * 38 / d, y + (ly - y) * 38 / d, lx - (lx - x) * e, ly - (ly - y) * e, 3);   // 引线：从红点外 38 到标签边
  return obst.filter(o => o.length === 4 && hit(pill, o)).length * 1000 + obst.filter(o => o.length === 4 && !o.me && L.some(r => hit(r, o))).reduce((t, o) => t + (o.ln ? 1 : 1000), 0);
}
/** “你在这里”标签位置：常用位置里第一个完全不压东西的；都不行就在一圈圈更远的地方找代价最小（其次离站近）的 */
function youAt(here, pos, obst, W = 1e9, H = 1e9) {
  const [x, y] = pos[here], spots = youSpots(here, pos);
  if (!obst) return spots[0];
  const cands = spots.slice();
  cands.push(...youRing(x, y));
  let best = null, bs = Infinity;
  cands.forEach(([lx, ly], i) => {
    if (bs === -1 || lx < 84 || ly < 30 || lx > W - 84 || ly > H - 30) return;
    const n = youCost(x, y, lx, ly, obst), sc = n * 1000 + Math.hypot(lx - x, ly - y);
    if (n === 0 && i < spots.length) { bs = -1; best = [lx, ly]; return; }
    if (sc < bs) { bs = sc; best = [lx, ly]; }
  });
  NET_DEBUG.youN = bs === -1 ? 0 : Math.floor(bs / 1e6);
  return best;
}
/** 屏幕坐标 ↔ svg 坐标（viewBox + 默认 xMidYMid meet；不用 getScreenCTM，某些浏览器在缩放 / 弹窗里会算错） */
export function svgMap(svg) {
  const r = svg.getBoundingClientRect(), vb = svg.viewBox.baseVal, k = Math.min(r.width / vb.width, r.height / vb.height);
  const ox = r.left + (r.width - vb.width * k) / 2, oy = r.top + (r.height - vb.height * k) / 2;
  return { toSvg: (x, y) => [(x - ox) / k, (y - oy) / k], toClient: (x, y) => [ox + x * k, oy + y * k] };
}
/** 全网图上离 (x, y)（svg 坐标）最近的车站；超过 r 返回 null（问路的选站面板用：点站名或圆点附近都算） */
export function nearestStation(x, y, portrait, r = 80) {
  const { pos } = networkLayout(portrait); let best = null, bd = r;
  for (const [c, [px, py, side]] of Object.entries(pos)) {
    // 站名在哪边就往哪边多算一点，点字也行
    const lx = side === 'l' ? px - 60 : side === 'r' ? px + 60 : px, ly = side === 'a' ? py - 30 : side === 'b' ? py + 30 : py;
    const d = Math.min(Math.hypot(x - px, y - py), Math.hypot(x - lx, y - ly)); if (d < bd) { bd = d; best = c; }
  }
  return best;
}

/** 地图里双指捏合缩放 + 单指拖动平移（1–4 倍），双击还原。box = 包着 svg 的容器；返回 reset() */
export function panZoom(box, onTap) {
  const pts = new Map(); let k = 1, tx = 0, ty = 0, start = null, lastTap = 0, tap = null;
  const el = () => box.firstElementChild;
  const apply = () => { const r = box.getBoundingClientRect(), mx = r.width * (k - 1) / 2, my = r.height * (k - 1) / 2; tx = Math.max(-mx, Math.min(mx, tx)); ty = Math.max(-my, Math.min(my, ty)); const e = el(); if (e) { e.style.transform = `translate(${tx}px,${ty}px) scale(${k})`; e.style.transformOrigin = 'center center'; } box.classList.toggle('zoomed', k > 1.01); };
  const snap = () => { const a = [...pts.values()]; if (!a.length) return null; const cx = a.reduce((s, p) => s + p.x, 0) / a.length, cy = a.reduce((s, p) => s + p.y, 0) / a.length; const d = a.length > 1 ? Math.hypot(a[0].x - a[1].x, a[0].y - a[1].y) : 0; return { cx, cy, d, k, tx, ty }; };
  box.addEventListener('pointerdown', e => {
    e.preventDefault(); try { box.setPointerCapture(e.pointerId); } catch (_) {} pts.set(e.pointerId, { x: e.clientX, y: e.clientY }); start = snap();
    if (pts.size === 1) { tap = { t: performance.now(), x: e.clientX, y: e.clientY }; } else tap = null;
  });
  box.addEventListener('pointermove', e => {
    if (!pts.has(e.pointerId)) return; pts.set(e.pointerId, { x: e.clientX, y: e.clientY }); const c = snap(); if (!c || !start) return;
    if (pts.size > 1 && start.d > 10) {
      const r = box.getBoundingClientRect(), ox = start.cx - (r.left + r.width / 2), oy = start.cy - (r.top + r.height / 2);
      const nk = Math.max(1, Math.min(4, start.k * c.d / start.d)), f = nk / start.k;
      k = nk; tx = ox - (ox - start.tx) * f + (c.cx - start.cx); ty = oy - (oy - start.ty) * f + (c.cy - start.cy);
    } else { tx = start.tx + c.cx - start.cx; ty = start.ty + c.cy - start.cy; }
    apply();
  });
  // 双击还原：两次干脆的单指轻点（没拖动、没捏合）
  const up = e => {
    if (tap && pts.size === 1 && performance.now() - tap.t < 280 && Math.hypot(e.clientX - tap.x, e.clientY - tap.y) < 12 && onTap && onTap(e.clientX, e.clientY)) lastTap = 0;   // 点到景点图标：打开小卡片（不算双击的第一下）
    else if (tap && pts.size === 1 && performance.now() - tap.t < 280 && Math.hypot(e.clientX - tap.x, e.clientY - tap.y) < 12) { const now = performance.now(); if (now - lastTap < 350) { k = 1; tx = ty = 0; apply(); lastTap = 0; } else lastTap = now; }
    tap = null; pts.delete(e.pointerId); start = snap();
  };
  box.addEventListener('pointerup', up); box.addEventListener('pointercancel', up);
  return { reset() { k = 1; tx = ty = 0; pts.clear(); apply(); }, set(nk, x = 0, y = 0) { k = nk; tx = x; ty = y; apply(); }, get scale() { return k; } };
}
