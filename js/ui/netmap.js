/*
 * 线路图（共用）：售票机屏幕上的单线“蛇形”线路图（SVG，可点选；Canvas 版画在 3D 售票机屏幕上）、游戏票价。
 * （全网图还没做。）
 * 站名和站序全部来自 js/data/lines.js；线路色 1 号线 #F3D03E、2 号线 #00629B。
 * 换乘站（1、2 号线都有的站，目前只有公园前）画成双色圆环；“你在这里”大而亮，带呼吸光圈。
 */
import { LINES, STATIONS } from '../data/lines.js';

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

