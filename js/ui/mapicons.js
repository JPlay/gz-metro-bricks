/*
 * 地图景点小图标（全网图 SVG、站厅墙上的线路图贴图、车厢条形线路图 Canvas 共用一套）：
 * 白色圆底 + 线路色细圈 + 里面一个简单的彩色剪影。剪影是 100×100 方框里的 SVG path，Canvas 用 Path2D 画同一套 path。
 */
const ICONS = {
  // 中山纪念堂：八角形蓝瓦大屋顶 + 红墙
  hall: [['M49 4h2v10h-2z', '#C9A34A'], ['M50 12L63 24L80 31L90 44H10L20 31L37 24Z', '#1F5BB0'], ['M14 44h72v5H14z', '#17478A'], ['M22 49h56v27H22z', '#C8432F'], ['M43 58h14v18H43z', '#F3E3C0'], ['M12 76h76v8H12z', '#9AA3AD']],
  // 农讲所：红色棂星门（门楼）+ 门前一碗糖水（文明路）
  gate: [['M10 30L50 14L90 30Z', '#7A2E22'], ['M16 30h68v8H16z', '#C0392B'], ['M22 38h9v42h-9zM69 38h9v42h-9z', '#C0392B'], ['M22 50h56v5H22z', '#C0392B'], ['M35 66h30a15 13 0 0 1 -30 0z', '#F2A33A'], ['M42 60c-3-4 3-6 0-10M50 60c-3-4 3-6 0-10M58 60c-3-4 3-6 0-10', 'none', '#E58A2E']],
  // 酒店：一张小床（床头板 + 被子 + 枕头）
  bed: [['M12 30h9v50h-9z', '#8A5A44'], ['M23 44h20v10H23z', '#7FB3DE'], ['M21 54h68v12H21z', '#E07A5F'], ['M12 66h77v8H12z', '#8A5A44'], ['M82 74h7v8h-7zM12 74h7v8h-7z', '#6E4636']],
  // 陈家祠：岭南祠堂（屋脊两头翘起的灰塑脊 + 灰瓦 + 青砖墙 + 木门）
  clan: [['M10 32Q14 14 24 26L76 26Q86 14 90 32Z', '#2F7D6D'], ['M16 32h68l8 14H8z', '#4A5560'], ['M20 46h60v32H20z', '#B9A88C'], ['M40 54h20v24H40z', '#6B3E22'], ['M14 78h72v6H14z', '#8C8C8C']],
  // 越秀公园五羊石像：红褐色花岗岩的羊（弯角）+ 石座
  rams: [['M22 56C22 44 38 40 54 42C64 42 68 44 70 40C72 30 82 27 87 34C90 40 87 47 81 50C79 60 73 66 62 66L34 66C27 66 22 62 22 56Z', '#A0503C'], ['M29 63h7v15h-7zM41 64h7v14h-7zM58 64h7v14h-7zM69 61h7v17h-7z', '#A0503C'], ['M80 36m-6 0a6 6 0 1 0 12 0a6 6 0 1 0 -12 0', '#6B2E22'], ['M16 78h70v8H16z', '#9AA3AD']],
  // 沙面：露德圣母堂的白色尖塔（剪影用蓝灰色，窗和门白色）
  chapel: [['M49 1h2v11h-2zM45.5 4h9v2h-9z', '#C9A34A'], ['M50 10L58 40H42Z', '#5E7FA8'], ['M42 40h16v40H42z', '#5E7FA8'], ['M16 80V58L29 49L42 58V80ZM58 80V58L71 49L84 58V80Z', '#7C97BA'], ['M50 52m-3.5 0a3.5 3.5 0 1 0 7 0a3.5 3.5 0 1 0 -7 0M46 80V69Q50 61 54 69V80Z', '#FFFFFF']],
  // 广州东站：复兴号流线型车头（白车身用浅蓝灰剪影 + 红腰线 + 深色挡风玻璃 / 车窗）+ 轨道
  emu: [['M8 36H48C68 36 84 48 93 66V71H8Z', '#B9C6D2'], ['M53 39C64 40 73 46 78 53H60Z', '#2C3640'], ['M14 44h8v7h-8zM26 44h8v7h-8zM38 44h8v7h-8z', '#2C3640'], ['M8 58H86L89.5 63H8Z', '#D3121A'], ['M18 71h12v6H18zM56 71h12v6H56z', '#4A525C'], ['M6 79h88v5H6z', '#9AA3AD']],
};
export const ICON_KINDS = Object.keys(ICONS);
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');
/** SVG：圆心 (cx,cy)、半径 r、圈色 ring */
export function iconSVG(kind, cx, cy, r, ring) {
  const k = (r * 1.5) / 100, ox = cx - 50 * k, oy = cy - 50 * k;
  let s = `<circle cx="${cx}" cy="${cy}" r="${r}" fill="#fff" stroke="${ring}" stroke-width="${Math.max(2, r * 0.16).toFixed(1)}"/>`;
  s += `<g transform="translate(${ox.toFixed(2)} ${oy.toFixed(2)}) scale(${k.toFixed(4)})">`;
  for (const [d, f, st] of ICONS[kind]) s += st ? `<path d="${d}" fill="none" stroke="${st}" stroke-width="4" stroke-linecap="round"/>` : `<path d="${d}" fill="${f}"/>`;
  return s + '</g>';
}
/** Canvas 版（车厢条形线路图等）：同一套 path */
export function drawIcon(c, kind, cx, cy, r, ring) {
  c.save();
  c.beginPath(); c.arc(cx, cy, r, 0, Math.PI * 2); c.fillStyle = '#fff'; c.fill(); c.lineWidth = Math.max(2, r * 0.16); c.strokeStyle = ring; c.stroke();
  const k = (r * 1.5) / 100; c.translate(cx - 50 * k, cy - 50 * k); c.scale(k, k);
  for (const [d, f, st] of ICONS[kind]) { const p = new Path2D(d); if (st) { c.strokeStyle = st; c.lineWidth = 4; c.lineCap = 'round'; c.stroke(p); } else { c.fillStyle = f; c.fill(p); } }
  c.restore();
}
export { esc as escIcon };
