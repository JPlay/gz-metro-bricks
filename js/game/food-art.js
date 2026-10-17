/*
 * 美食的画法（共用）：
 *   drawDish(c, cx, cy, r, id)  —— 2D 卡通菜（招牌圆标、点菜图片菜单、小卡片、美食护照都用这一套），画在半径 r 的圆里；
 *   dishGeo(id)                 —— 3D 玩具菜（顶点色几何，原点在桌面，约 0.3m 大），上菜时放到桌上；
 *   FoodAtlas                   —— 美食店自己的小贴图集（招牌 / 菜单板 / 海报：大字 + 菜的图），一个网格一次绘制。
 */
import { Geo, hex, mix } from '../core/geo.js';
import { FONT, FONT_EN } from '../world/kit.js';
const B = window.BABYLON;

/* ---------------- 2D ---------------- */
const circ = (c, x, y, r, f, s, lw) => { c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); if (f) { c.fillStyle = f; c.fill(); } if (s) { c.strokeStyle = s; c.lineWidth = lw || r * 0.08; c.stroke(); } };
const ell = (c, x, y, rx, ry, f, rot = 0, s, lw) => { c.beginPath(); c.ellipse(x, y, rx, ry, rot, 0, Math.PI * 2); if (f) { c.fillStyle = f; c.fill(); } if (s) { c.strokeStyle = s; c.lineWidth = lw; c.stroke(); } };
function plate(c, x, y, r, col = '#FFFFFF', rim = '#D9E2EA') { ell(c, x, y + r * 0.06, r, r * 0.62, 'rgba(0,0,0,.12)'); ell(c, x, y, r, r * 0.6, col, 0, rim, r * 0.06); ell(c, x, y, r * 0.72, r * 0.42, null, 0, 'rgba(0,0,0,.06)', r * 0.03); }
function bowl(c, x, y, r, col, inner) {
  c.beginPath(); c.moveTo(x - r, y); c.bezierCurveTo(x - r, y + r * 0.95, x + r, y + r * 0.95, x + r, y); c.closePath(); c.fillStyle = col; c.fill();
  ell(c, x, y + r * 0.62, r * 0.36, r * 0.1, mix2(col, '#000', 0.25));
  ell(c, x, y, r, r * 0.34, inner, 0, mix2(col, '#fff', 0.35), r * 0.07);
}
function claypot(c, x, y, r, inner) {
  c.beginPath(); c.moveTo(x - r, y); c.bezierCurveTo(x - r * 1.05, y + r * 0.9, x + r * 1.05, y + r * 0.9, x + r, y); c.closePath(); c.fillStyle = '#7A4A2E'; c.fill();
  c.fillStyle = '#5E3520'; c.fillRect(x + r * 0.9, y + r * 0.05, r * 0.55, r * 0.16); // 把手
  ell(c, x, y, r, r * 0.34, inner, 0, '#9C6440', r * 0.08);
}
function mix2(a, b, t) { const p = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16)), A = p(a), Bc = p(b); return '#' + A.map((v, i) => Math.round(v + (Bc[i] - v) * t).toString(16).padStart(2, '0')).join(''); }
function steam(c, x, y, r) { c.strokeStyle = 'rgba(255,255,255,.85)'; c.lineWidth = r * 0.06; c.lineCap = 'round'; for (const dx of [-0.3, 0, 0.3]) { c.beginPath(); c.moveTo(x + dx * r, y); c.bezierCurveTo(x + dx * r - r * 0.12, y - r * 0.18, x + dx * r + r * 0.12, y - r * 0.3, x + dx * r, y - r * 0.45); c.stroke(); } }
function hargow(c, x, y, s) { c.beginPath(); c.moveTo(x - s, y + s * 0.3); c.quadraticCurveTo(x, y - s * 1.2, x + s, y + s * 0.3); c.closePath(); c.fillStyle = '#F7EEE8'; c.fill(); c.strokeStyle = '#E8D6CC'; c.lineWidth = s * 0.08; c.stroke(); ell(c, x, y - s * 0.05, s * 0.45, s * 0.25, 'rgba(244,140,120,.55)'); for (let i = -2; i <= 2; i++) { c.beginPath(); c.moveTo(x + i * s * 0.3, y - s * 0.35 + Math.abs(i) * s * 0.1); c.lineTo(x + i * s * 0.33, y - s * 0.12); c.strokeStyle = '#E4D2C6'; c.stroke(); } }
function siumai(c, x, y, s) { c.fillStyle = '#F4C64E'; c.fillRect(x - s * 0.6, y - s * 0.5, s * 1.2, s * 0.9); ell(c, x, y + s * 0.4, s * 0.6, s * 0.2, '#E3AE33'); ell(c, x, y - s * 0.5, s * 0.6, s * 0.22, '#F6DFA6'); ell(c, x, y - s * 0.5, s * 0.45, s * 0.15, '#E9B7A0'); circ(c, x, y - s * 0.55, s * 0.13, '#F2702A'); }
function bao(c, x, y, s) { ell(c, x, y, s, s * 0.8, '#FBF6EC', 0, '#E8DFCF', s * 0.06); c.beginPath(); c.moveTo(x - s * 0.35, y - s * 0.35); c.lineTo(x, y - s * 0.05); c.lineTo(x + s * 0.35, y - s * 0.35); c.lineTo(x, y - s * 0.55); c.closePath(); c.fillStyle = '#B5432F'; c.fill(); }
export function drawDish(c, x, y, r, id) {
  c.save(); c.lineJoin = 'round';
  const s = r / 100;
  switch (id) {
    case 'hargow': case 'siumai': case 'bao': {
      // 竹蒸笼
      ell(c, x, y + 18 * s, 84 * s, 40 * s, '#B8864B'); c.fillStyle = '#C99A5B'; c.fillRect(x - 84 * s, y - 10 * s, 168 * s, 28 * s); ell(c, x, y - 10 * s, 84 * s, 40 * s, '#E9D9B8', 0, '#A97A42', 7 * s);
      for (let i = -3; i <= 3; i++) { c.beginPath(); c.moveTo(x + i * 22 * s, y + 0 * s); c.lineTo(x + i * 22 * s, y + 28 * s); c.strokeStyle = 'rgba(120,80,30,.35)'; c.lineWidth = 3 * s; c.stroke(); }
      const f = { hargow, siumai, bao }[id], pts = id === 'bao' ? [[-28, -16], [30, -16], [0, -2]] : [[-36, -16], [0, -24], [36, -16], [-18, 0], [20, 0]];
      for (const [dx, dy] of pts) f(c, x + dx * s, y + dy * s, (id === 'bao' ? 30 : 22) * s);
      steam(c, x, y - 40 * s, 80 * s); break;
    }
    case 'cheungfun':
      plate(c, x, y + 10 * s, 92 * s);
      for (const dy of [-18, 4, 26]) { ell(c, x, y + dy * s, 62 * s, 14 * s, '#FDFBF6', 0, '#ECE6DA', 3 * s); ell(c, x + 20 * s, y + dy * s - 2 * s, 16 * s, 6 * s, 'rgba(240,140,120,.5)'); }
      c.strokeStyle = '#8A4E22'; c.lineWidth = 7 * s; c.lineCap = 'round'; c.beginPath(); c.moveTo(x - 58 * s, y - 6 * s); c.bezierCurveTo(x - 20 * s, y + 10 * s, x + 20 * s, y - 2 * s, x + 56 * s, y + 18 * s); c.stroke();
      for (const [dx, dy] of [[-30, -22], [10, -6], [36, 18], [-8, 26], [44, -16]]) circ(c, x + dx * s, y + dy * s, 4 * s, '#4CAF50');
      break;
    case 'wonton':
      bowl(c, x, y - 4 * s, 88 * s, '#E9F1F7', '#F2D9A0');
      c.strokeStyle = '#F2C94C'; c.lineWidth = 5 * s; for (let i = 0; i < 6; i++) { c.beginPath(); c.moveTo(x - 60 * s + i * 8 * s, y - 14 * s); c.bezierCurveTo(x - 20 * s, y - 34 * s + i * 4 * s, x + 20 * s, y + 6 * s, x + 56 * s - i * 6 * s, y - 14 * s); c.stroke(); }
      for (const [dx, dy] of [[-36, 4], [8, 10], [44, 0]]) { ell(c, x + dx * s, y + dy * s - 6 * s, 20 * s, 13 * s, '#FBF2E2', 0, '#E6D3B5', 2 * s); ell(c, x + dx * s, y + dy * s - 8 * s, 9 * s, 6 * s, 'rgba(240,140,110,.6)'); }
      for (const [dx, dy] of [[-12, -22], [24, -20], [-46, -10]]) circ(c, x + dx * s, y + dy * s, 5 * s, '#5DBB63');
      steam(c, x, y - 34 * s, 70 * s); break;
    case 'goose':
      plate(c, x, y + 12 * s, 94 * s);
      for (let i = 0; i < 6; i++) { const dx = -50 + i * 20; c.save(); c.translate(x + dx * s, y + 4 * s); c.rotate(-0.25); c.fillStyle = '#F6E6D2'; c.fillRect(-9 * s, -2 * s, 18 * s, 24 * s); c.fillStyle = '#B4541B'; c.fillRect(-9 * s, -10 * s, 18 * s, 10 * s); c.fillStyle = '#E08A3A'; c.fillRect(-9 * s, -10 * s, 18 * s, 3 * s); c.restore(); }
      circ(c, x + 62 * s, y + 30 * s, 16 * s, '#FFFFFF', '#D9E2EA', 3 * s); circ(c, x + 62 * s, y + 30 * s, 11 * s, '#D9492E'); break;
    case 'shuangpi': case 'gingermilk':
      bowl(c, x, y, 78 * s, '#FFFFFF', id === 'shuangpi' ? '#FBF3DE' : '#F6E3A6');
      if (id === 'shuangpi') { ell(c, x - 6 * s, y - 2 * s, 46 * s, 12 * s, 'rgba(255,255,255,.8)'); for (const [dx, dy] of [[-14, -4], [-2, 2], [10, -6], [0, -8], [-8, 6]]) circ(c, x + dx * s, y + dy * s, 6 * s, '#8E2A2A'); }
      else { ell(c, x + 12 * s, y - 2 * s, 18 * s, 10 * s, '#E6C35A', 0.3, '#C9A040', 2 * s); ell(c, x - 18 * s, y - 4 * s, 26 * s, 6 * s, 'rgba(255,255,255,.6)'); }
      c.fillStyle = '#C9CED4'; c.save(); c.translate(x + 58 * s, y - 24 * s); c.rotate(0.7); c.fillRect(-4 * s, -32 * s, 8 * s, 40 * s); ell(c, 0, 12 * s, 12 * s, 16 * s, '#D9DEE3'); c.restore(); break;
    case 'congee':
      claypot(c, x, y - 4 * s, 82 * s, '#FBF7EE');
      for (const [dx, dy] of [[-30, -6], [14, -10], [36, 2]]) { c.beginPath(); c.arc(x + dx * s, y + dy * s, 12 * s, Math.PI * 0.1, Math.PI * 1.3); c.strokeStyle = '#F2783C'; c.lineWidth = 8 * s; c.lineCap = 'round'; c.stroke(); }
      for (const [dx, dy] of [[-8, -16], [24, -18], [-44, -2], [4, 6]]) circ(c, x + dx * s, y + dy * s, 4.5 * s, '#4CAF50');
      steam(c, x, y - 30 * s, 70 * s); break;
    case 'claypot':
      claypot(c, x, y - 4 * s, 82 * s, '#FBF5E6');
      for (const [dx, dy] of [[-34, -8], [-12, -14], [10, -12], [32, -8]]) { ell(c, x + dx * s, y + dy * s, 12 * s, 7 * s, '#C2332B', 0, '#8C1E18', 2 * s); circ(c, x + dx * s - 3 * s, y + dy * s - 1 * s, 2 * s, '#F4D4CC'); }
      for (const [dx, dy] of [[-20, 6], [22, 4]]) ell(c, x + dx * s, y + dy * s, 16 * s, 7 * s, '#4C9A3F', 0.4);
      circ(c, x + 2 * s, y + 8 * s, 10 * s, '#FFFFFF'); circ(c, x + 2 * s, y + 8 * s, 6 * s, '#F5B93A');
      steam(c, x, y - 30 * s, 70 * s); break;
    case 'ngauzap':
      bowl(c, x, y + 6 * s, 80 * s, '#E9E3D6', '#B66A30');
      for (const [dx, h] of [[-26, 70], [6, 80], [32, 66]]) { c.strokeStyle = '#D8B47A'; c.lineWidth = 5 * s; c.beginPath(); c.moveTo(x + dx * s, y + 4 * s); c.lineTo(x + dx * s + 6 * s, y - h * s); c.stroke(); }
      for (const [dx, dy, col] of [[-26, -18, '#8A4A22'], [-24, -40, '#C79A6A'], [8, -30, '#F0E2C8'], [9, -54, '#8A4A22'], [34, -22, '#C79A6A'], [35, -44, '#F0E2C8']]) { c.save(); c.translate(x + dx * s, y + dy * s); c.rotate(0.2); c.fillStyle = col; c.fillRect(-11 * s, -9 * s, 22 * s, 18 * s); c.restore(); }
      steam(c, x - 50 * s, y - 20 * s, 50 * s); break;
    case 'chicken':
      plate(c, x, y + 12 * s, 94 * s);
      for (let i = 0; i < 7; i++) { const dx = -54 + i * 18; c.save(); c.translate(x + dx * s, y + 2 * s + Math.abs(i - 3) * 2 * s); c.rotate(0.15); c.fillStyle = '#FFF6E3'; c.fillRect(-8 * s, -4 * s, 16 * s, 22 * s); c.fillStyle = '#F4D27A'; c.fillRect(-8 * s, -10 * s, 16 * s, 7 * s); c.restore(); }
      circ(c, x + 60 * s, y + 30 * s, 16 * s, '#FFFFFF', '#D9E2EA', 3 * s); circ(c, x + 60 * s, y + 30 * s, 11 * s, '#7CC36A'); for (const [dx, dy] of [[56, 27], [63, 33], [61, 26]]) circ(c, x + dx * s, y + dy * s, 2.5 * s, '#F2D27A'); break;
    case 'milktea': default:
      ell(c, x, y + 50 * s, 40 * s, 12 * s, 'rgba(0,0,0,.15)'); c.fillStyle = '#FFFFFF'; c.fillRect(x - 34 * s, y - 20 * s, 68 * s, 66 * s); ell(c, x, y - 20 * s, 34 * s, 10 * s, '#E9C46A'); circ(c, x, y - 22 * s, 8 * s, '#F6E27A');
  }
  c.restore();
}
/** 一张菜的小图（dataURL），HTML 菜单 / 卡片 / 护照用；缓存 */
const urlCache = {};
export function dishURL(id, size = 220, bg = null) {
  const k = id + size + bg; if (urlCache[k]) return urlCache[k];
  const cv = document.createElement('canvas'); cv.width = cv.height = size; const c = cv.getContext('2d');
  if (bg) { c.fillStyle = bg; c.beginPath(); c.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2); c.fill(); }
  drawDish(c, size / 2, size / 2 + size * 0.06, size * 0.42, id);
  return (urlCache[k] = cv.toDataURL());
}

/* ---------------- 3D 玩具菜 ---------------- */
const W = hex('#FFFFFF');
function plate3(g, r = 0.13, col = '#FFFFFF') { g.cyl(0, 0.006, 0, r * 2, 0.012, hex('#E3E8EE'), 20, 0, 0, 0, r * 1.7, { ao: false }); g.cyl(0, 0.014, 0, r * 1.6, 0.006, hex(col), 20, 0, 0, 0, undefined, { ao: false }); }
function bowl3(g, r, col, inner, y = 0) { g.cyl(0, y + 0.012, 0, r * 0.9, 0.024, hex(col), 16, 0, 0, 0, r * 1.2, { ao: false }); g.cyl(0, y + 0.05, 0, r * 1.2, 0.052, hex(col), 18, 0, 0, 0, r * 2, { ao: false }); g.cyl(0, y + 0.075, 0, r * 1.86, 0.004, hex(inner), 18, 0, 0, 0, undefined, { ao: false }); }
function pot3(g, r, inner) { const c = hex('#7A4A2E'); g.cyl(0, 0.045, 0, r * 2, 0.09, c, 18, 0, 0, 0, r * 1.7, { ao: false }); g.cyl(0, 0.092, 0, r * 1.84, 0.006, hex(inner), 18, 0, 0, 0, undefined, { ao: false }); g.box(r * 1.05, 0.08, 0, 0.07, 0.02, 0.03, hex('#5E3520'), 0, 0, 0, 1, { ao: false }); }
function steamer3(g) { const c = hex('#C99A5B'); g.cyl(0, 0.035, 0, 0.26, 0.07, c, 20, 0, 0, 0, undefined, { ao: false }); g.cyl(0, 0.071, 0, 0.24, 0.004, hex('#E9D9B8'), 20, 0, 0, 0, undefined, { ao: false }); }
/** 3D 玩具菜：原点在桌面中心，菜的“正面”朝 +z */
export function dishGeo(id) {
  const g = new Geo();
  switch (id) {
    case 'hargow': steamer3(g); for (const [x, z] of [[-0.055, -0.03], [0.055, -0.03], [0, 0.05]]) { g.ellipsoid(x, 0.095, z, 0.075, 0.05, 0.05, hex('#F7EEE8'), 2); g.ellipsoid(x, 0.1, z, 0.04, 0.025, 0.03, mix(hex('#F7EEE8'), hex('#F08C78'), 0.5), 1); } break;
    case 'siumai': steamer3(g); for (const [x, z] of [[-0.055, -0.03], [0.055, -0.03], [0, 0.05]]) { g.cyl(x, 0.1, z, 0.06, 0.055, hex('#F4C64E'), 10, 0, 0, 0, undefined, { ao: false }); g.cyl(x, 0.128, z, 0.05, 0.004, hex('#E9B7A0'), 10, 0, 0, 0, undefined, { ao: false }); g.sphere(x, 0.133, z, 0.018, hex('#F2702A'), 1); } break;
    case 'bao': steamer3(g); for (const [x, z] of [[-0.052, -0.025], [0.052, -0.025], [0, 0.055]]) { g.ellipsoid(x, 0.105, z, 0.085, 0.07, 0.085, hex('#FBF6EC'), 2); g.ellipsoid(x, 0.138, z, 0.03, 0.012, 0.03, hex('#B5432F'), 1); } break;
    case 'cheungfun': plate3(g, 0.14); for (const z of [-0.04, 0, 0.04]) { g.capsule([-0.075, 0.03, z], [0.075, 0.03, z], 0.019, 0.019, hex('#FDFBF6'), 10); } g.box(0, 0.05, 0, 0.17, 0.003, 0.02, hex('#8A4E22'), 0.3, 0, 0, 1, { ao: false }); for (const [x, z] of [[-0.05, -0.03], [0.03, 0.02], [0.06, -0.04]]) g.sphere(x, 0.052, z, 0.012, hex('#4CAF50'), 1); break;
    case 'wonton': bowl3(g, 0.085, '#E9F1F7', '#F2D9A0'); for (let i = 0; i < 5; i++) g.tube([-0.06, 0.082, -0.04 + i * 0.02], [0.06, 0.082, -0.03 + i * 0.018], 0.008, hex('#F2C94C'), 5); for (const [x, z] of [[-0.04, 0.03], [0.04, 0.035], [0, -0.04]]) g.ellipsoid(x, 0.085, z, 0.05, 0.03, 0.04, hex('#FBF2E2'), 1); for (const [x, z] of [[-0.02, -0.01], [0.03, -0.02]]) g.sphere(x, 0.088, z, 0.012, hex('#5DBB63'), 1); break;
    case 'goose': plate3(g, 0.14); for (let i = 0; i < 6; i++) { const x = -0.075 + i * 0.03; g.box(x, 0.032, 0, 0.026, 0.03, 0.08, hex('#F6E6D2'), 0.2, 0, 0, 1, { ao: false }); g.box(x, 0.05, 0.002, 0.027, 0.01, 0.082, hex('#B4541B'), 0.2, 0, 0, 1, { ao: false }); } break;
    case 'shuangpi': bowl3(g, 0.07, '#FFFFFF', '#FBF3DE'); for (const [x, z] of [[-0.02, 0], [0.01, 0.02], [0.02, -0.015], [-0.005, -0.025]]) g.sphere(x, 0.08, z, 0.014, hex('#8E2A2A'), 1); g.box(0.07, 0.09, 0.02, 0.012, 0.004, 0.09, hex('#C9CED4'), 0.6, -0.4, 0, 1, { ao: false }); break;
    case 'gingermilk': bowl3(g, 0.07, '#FFFFFF', '#F6E3A6'); g.ellipsoid(0.02, 0.08, 0, 0.035, 0.008, 0.022, hex('#E6C35A'), 1); g.box(0.07, 0.09, 0.02, 0.012, 0.004, 0.09, hex('#C9CED4'), 0.6, -0.4, 0, 1, { ao: false }); break;
    case 'congee': pot3(g, 0.085, '#FBF7EE'); for (const [x, z] of [[-0.035, 0], [0.02, 0.03], [0.03, -0.03]]) g.tube([x - 0.015, 0.098, z], [x + 0.015, 0.1, z + 0.01], 0.014, hex('#F2783C'), 6); for (const [x, z] of [[-0.01, -0.03], [0.04, 0.0]]) g.sphere(x, 0.1, z, 0.012, hex('#4CAF50'), 1); break;
    case 'claypot': pot3(g, 0.085, '#FBF5E6'); for (const [x, z] of [[-0.04, -0.02], [-0.012, -0.035], [0.02, -0.03], [0.045, -0.01]]) g.cyl(x, 0.098, z, 0.03, 0.008, hex('#C2332B'), 10, 0, 0, 0, undefined, { ao: false }); g.ellipsoid(0, 0.1, 0.03, 0.08, 0.01, 0.03, hex('#4C9A3F'), 1); g.sphere(0.03, 0.1, 0.03, 0.025, hex('#F5B93A'), 1, 0.4); break;
    case 'ngauzap': bowl3(g, 0.075, '#E9E3D6', '#B66A30'); for (const [x, z] of [[-0.03, 0], [0.01, 0.02], [0.035, -0.02]]) { g.tube([x, 0.06, z], [x + 0.01, 0.22, z], 0.006, hex('#D8B47A'), 5); g.box(x + 0.003, 0.11, z, 0.035, 0.03, 0.03, hex('#8A4A22'), 0.2, 0, 0, 1, { ao: false }); g.box(x + 0.006, 0.15, z, 0.033, 0.028, 0.03, hex('#F0E2C8'), -0.2, 0, 0, 1, { ao: false }); g.box(x + 0.008, 0.185, z, 0.03, 0.025, 0.028, hex('#C79A6A'), 0.3, 0, 0, 1, { ao: false }); } break;
    case 'chicken': plate3(g, 0.14); for (let i = 0; i < 6; i++) { const x = -0.075 + i * 0.03; g.box(x, 0.032, 0, 0.026, 0.03, 0.08, hex('#FFF6E3'), -0.15, 0, 0, 1, { ao: false }); g.box(x, 0.05, 0, 0.027, 0.008, 0.082, hex('#F4D27A'), -0.15, 0, 0, 1, { ao: false }); } g.cyl(0.11, 0.02, 0.07, 0.05, 0.03, W, 12, 0, 0, 0, undefined, { ao: false }); g.cyl(0.11, 0.036, 0.07, 0.04, 0.003, hex('#7CC36A'), 12, 0, 0, 0, undefined, { ao: false }); break;
    default: g.cyl(0, 0.04, 0, 0.07, 0.08, W, 12, 0, 0, 0, undefined, { ao: false }); g.cyl(0, 0.081, 0, 0.06, 0.003, hex('#E9C46A'), 12, 0, 0, 0, undefined, { ao: false });
  }
  // 筷子（放在菜的右边）
  g.tube([0.16, 0.012, -0.08], [0.17, 0.012, 0.12], 0.009, hex('#C98B4A'), 5); g.tube([0.18, 0.012, -0.08], [0.19, 0.012, 0.12], 0.009, hex('#C98B4A'), 5);
  return g;
}

/* ---------------- 贴图集 ---------------- */
export class FoodAtlas {
  constructor(scene, S = 1024) {
    this.S = S; this.x = 0; this.y = 0; this.row = 0; this.scene = scene; this.overflow = 0;
    this.tex = new B.DynamicTexture('foodSigns', { width: S, height: S }, scene, true);
    this.tex.hasAlpha = false; this.tex.anisotropicFilteringLevel = 8; this.ctx = this.tex.getContext();
    this.ctx.fillStyle = '#222'; this.ctx.fillRect(0, 0, S, S);
    this.p = []; this.uv = []; this.i = [];
  }
  /** 画一块 w×h 米的牌子（paint(c, pw, ph)），返回 uv */
  draw(w, h, paint, ppm = 110) {
    let k = Math.min(ppm, 1000 / w, 500 / h); const pw = Math.round(w * k), ph = Math.round(h * k);
    if (this.x + pw > this.S) { this.x = 0; this.y += this.row + 3; this.row = 0; }
    if (this.y + ph > this.S) { this.overflow++; this.x = 0; this.y = 0; console.warn('food atlas overflow'); }
    const r = { x: this.x, y: this.y }; this.x += pw + 3; this.row = Math.max(this.row, ph);
    const c = this.ctx; c.save(); c.beginPath(); c.rect(r.x, r.y, pw, ph); c.clip(); c.translate(r.x, r.y); paint(c, pw, ph); c.restore();
    const S = this.S; return { u0: (r.x + 0.5) / S, u1: (r.x + pw - 0.5) / S, v0: 1 - (r.y + ph - 0.5) / S, v1: 1 - (r.y + 0.5) / S };
  }
  /** face：正面法线 = (sin a, 0, cos a) */
  quad(x, y, z, w, h, a, uv) {
    const nx = Math.sin(a), nz = Math.cos(a), rx = -nz, rz = nx, base = this.p.length / 3, ox = x + nx * 0.01, oz = z + nz * 0.01;
    for (const [u, v] of [[-w / 2, -h / 2], [w / 2, -h / 2], [w / 2, h / 2], [-w / 2, h / 2]]) this.p.push(ox + rx * u, y + v, oz + rz * u);
    this.uv.push(uv.u0, uv.v0, uv.u1, uv.v0, uv.u1, uv.v1, uv.u0, uv.v1); this.i.push(base, base + 1, base + 2, base, base + 2, base + 3);
  }
  sign(x, y, z, w, h, a, paint) { this.quad(x, y, z, w, h, a, this.draw(w, h, paint)); }
  finish(parent, name = 'foodSigns') {
    this.tex.update(true);
    const mat = this.mat = new B.StandardMaterial(name + 'Mat', this.scene);
    mat.diffuseColor = new B.Color3(0, 0, 0); mat.specularColor = new B.Color3(0, 0, 0); mat.emissiveTexture = this.tex; mat.disableLighting = true; mat.backFaceCulling = false; mat.emissiveColor = new B.Color3(0, 0, 0); this.tex.level = 0.95;
    const m = this.mesh = new B.Mesh(name, this.scene), vd = new B.VertexData(), n = [];
    for (let k = 0; k < this.p.length; k += 3) n.push(0, 1, 0);
    vd.positions = this.p; vd.uvs = this.uv; vd.indices = this.i; vd.normals = n; vd.applyToMesh(m);
    m.material = mat; m.parent = parent; m.isPickable = false; m.computeWorldMatrix(true); m.freezeWorldMatrix();
    return m;
  }
  dispose() { if (this.mesh) this.mesh.dispose(); this.tex.dispose(); if (this.mat) this.mat.dispose(); }
}
/* —— 招牌画法 —— */
export function fitFont(c, txt, weight, size, font, maxW) { c.font = `${weight} ${size}px ${font}`; const w = c.measureText(txt).width; if (w > maxW) { size *= maxW / w; c.font = `${weight} ${size}px ${font}`; } return size; }
/** 横招牌：左边圆形菜图标，右边大字店名 + 小字；style: 'lacquer'（老字号黑漆金字 + 金边）| 'plaque'（茶楼金框匾）| 'lightbox'（档口灯箱） */
export function paintBoard(r, style) {
  return (c, pw, ph) => {
    const bg = r.sign.bg, fg = r.sign.fg;
    if (style === 'lightbox') { const g = c.createLinearGradient(0, 0, 0, ph); g.addColorStop(0, mix2(bg, '#ffffff', 0.25)); g.addColorStop(1, bg); c.fillStyle = g; c.fillRect(0, 0, pw, ph); }
    else { c.fillStyle = bg; c.fillRect(0, 0, pw, ph); }
    if (style !== 'lightbox') { c.strokeStyle = style === 'plaque' ? '#E3B341' : mix2(fg, bg, 0.3); c.lineWidth = ph * 0.06; c.strokeRect(ph * 0.05, ph * 0.05, pw - ph * 0.1, ph - ph * 0.1); }
    const ic = ph * 0.42; circ(c, ph * 0.55, ph / 2, ic, '#FFFFFF', style === 'plaque' ? '#E3B341' : fg, ph * 0.04);
    drawDish(c, ph * 0.55, ph / 2 + ic * 0.08, ic * 0.92, r.dish);
    const x0 = ph * 1.12, avail = pw - x0 - ph * 0.2;
    c.fillStyle = fg; c.textBaseline = 'middle'; c.textAlign = 'center';
    fitFont(c, r.name, 900, ph * 0.56, FONT, avail); c.fillText(r.name, x0 + avail / 2, ph * 0.42);
    fitFont(c, r.sub, 700, ph * 0.17, FONT, avail); c.globalAlpha = 0.9; c.fillText(r.sub, x0 + avail / 2, ph * 0.8); c.globalAlpha = 1; c.textAlign = 'left';
  };
}
/** 竖招牌（大字竖排） */
export function paintVert(txt, bg, fg, border) {
  return (c, pw, ph) => {
    c.fillStyle = bg; c.fillRect(0, 0, pw, ph); if (border) { c.strokeStyle = border; c.lineWidth = pw * 0.07; c.strokeRect(pw * 0.06, pw * 0.06, pw - pw * 0.12, ph - pw * 0.12); }
    const ch = [...txt], cs = Math.min(pw * 0.7, ph * 0.86 / ch.length); c.fillStyle = fg; c.font = `900 ${cs}px ${FONT}`; c.textAlign = 'center'; c.textBaseline = 'middle';
    ch.forEach((t, i) => c.fillText(t, pw / 2, ph / 2 + (i - (ch.length - 1) / 2) * cs * 1.06)); c.textAlign = 'left';
  };
}
/** 一个菜的圆标（单独挂的）*/
export function paintIcon(id, ring) { return (c, pw, ph) => { c.fillStyle = ring; c.fillRect(0, 0, pw, ph); circ(c, pw / 2, ph / 2, pw * 0.46, '#FFFFFF', ring, pw * 0.05); drawDish(c, pw / 2, ph / 2 + pw * 0.03, pw * 0.4, id); }; }
/** 店里的海报：菜图 + 菜名 + 一句小知识 */
export function paintPoster(r, dish) {
  return (c, pw, ph) => {
    c.fillStyle = '#FFFDF6'; c.fillRect(0, 0, pw, ph); c.fillStyle = r.accent; c.fillRect(0, 0, pw, ph * 0.08); c.fillRect(0, ph * 0.92, pw, ph * 0.08);
    drawDish(c, pw * 0.5, ph * 0.36, Math.min(pw, ph) * 0.28, dish.id);
    c.fillStyle = r.accent; c.textAlign = 'center'; c.textBaseline = 'middle'; fitFont(c, dish.zh, 900, ph * 0.13, FONT, pw * 0.9); c.fillText(dish.zh, pw / 2, ph * 0.66);
    c.fillStyle = '#4A3A30'; const words = [...dish.fact], per = Math.ceil(words.length / 2);
    fitFont(c, dish.fact.slice(0, per), 700, ph * 0.06, FONT, pw * 0.9); c.fillText(dish.fact.slice(0, per), pw / 2, ph * 0.77); c.fillText(dish.fact.slice(per), pw / 2, ph * 0.85); c.textAlign = 'left';
  };
}
export { mix2, circ };
