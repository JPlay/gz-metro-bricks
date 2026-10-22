/*
 * 动车车窗外的风景（时间压缩的广州东 → 厦门北）：不是沿线真实建模，而是三层“传送带”远景板 + 一条道床，循环滚动。
 *   - far  远景（z = ±120，不透明）：天空、远山 / 海平线 / 城市天际线；只以 0.35 倍速移动（看起来很远）；
 *   - mid  中景（z = ±40，镂空）：楼房 / 稻田和农舍 / 青山 / 海面 / 厦门的红砖厝和楼；0.75 倍速；
 *   - near 近景（z = ±8.5，镂空）：接触网立柱、护栏、路堑、隧道壁、桥栏；1 倍速；可以是“空”（停在站台时）；
 *   - bed  道床（y = -1.45）：碎石 + 轨枕，贴图滚动。
 * 每层 = 一张画布贴图（几行内容 × 两种变体）+ 一个网格（两侧各 N 块面板）= 1 次绘制；共 4 次绘制、不到 200 个三角形。
 * 面板随列车前进往后移，移过一块面板宽度就整体复位、每块面板的内容往后传一格，最前面一块换成“当前路段”的内容
 *   → 路段变化（城市 → 田野 → 山和隧道 → 跨海大桥 → 厦门）从远处自然地迎面而来，不用淡入淡出。
 */
const B = window.BABYLON;
function rng(seed) { let s = seed >>> 0 || 1; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }

/* ---------- 画法：每个格子 (c, pw, ph, v, R) ，v = 变体 0/1，R = 随机数 ---------- */
const sky = (c, pw, ph, h, top = '#7FB2DE', bot = '#DCEBF5') => { const g = c.createLinearGradient(0, 0, 0, h); g.addColorStop(0, top); g.addColorStop(1, bot); c.fillStyle = g; c.fillRect(0, 0, pw, h); };
function ridge(c, pw, base, amp, col, R, n = 7, sharp = 0.5) {
  c.fillStyle = col; c.beginPath(); c.moveTo(0, base + 400);
  const pts = []; for (let i = 0; i <= n; i++) pts.push([pw * i / n, base - amp * (0.35 + 0.65 * R())]);
  pts[n][1] = pts[0][1];   // 首尾等高 → 左右拼得上
  c.lineTo(0, pts[0][1]); for (let i = 1; i <= n; i++) { const [x0, y0] = pts[i - 1], [x1, y1] = pts[i]; c.quadraticCurveTo((x0 + x1) / 2, Math.min(y0, y1) - amp * sharp * R(), x1, y1); }
  c.lineTo(pw, base + 400); c.closePath(); c.fill();
}
/* 远景：2 列 × 5 行（城市 / 田野 / 山 / 海 / 厦门）；面板 120 m 宽、y -60..90；地平线 y = 0（0.6 高处）。
 * 楼房按米来画（横 / 竖像素密度不一样）：有宽度、有一格格窗户，不会变成一排细竖条。 */
const FAR_ROWS = ['city', 'fields', 'mount', 'sea', 'xiamen'];
const HZ_F = 0.6, FW = 120, FY0 = -60, FY1 = 90;
const fx = (pw, x) => pw * x / FW, fy = (ph, y) => ph * (FY1 - y) / (FY1 - FY0);
/** 一栋楼（米）：x0..x1、底 yb、高 h；正面 + 右侧一窄条暗面 + 屋顶线 + 一格格窗户 */
function tower(c, pw, ph, x0, x1, yb, h, col, R, o = {}) {
  const X0 = fx(pw, x0), X1 = fx(pw, x1), Yb = fy(ph, yb), Yt = fy(ph, yb + h), sw = (X1 - X0) * 0.14;
  c.fillStyle = col; c.fillRect(X0, Yt, X1 - X0, Yb - Yt);
  c.fillStyle = 'rgba(40,55,70,0.18)'; c.fillRect(X1 - sw, Yt, sw, Yb - Yt);                       // 侧面暗一点 → 有体积
  c.fillStyle = 'rgba(255,255,255,0.35)'; c.fillRect(X0, Yt, X1 - X0, Math.max(1.5, (Yb - Yt) * 0.015));   // 屋顶亮边
  const fl = o.floor || 3.6, bay = o.bay || 3.2, win = o.win || 'rgba(70,95,120,0.55)';
  c.fillStyle = win;
  for (let y = yb + 1.2; y < yb + h - 1.5; y += fl) for (let x = x0 + 1.2; x < x1 - 1.4 - (x1 - x0) * 0.14; x += bay) c.fillRect(fx(pw, x), fy(ph, y + fl * 0.62), fx(pw, bay * 0.55), Math.max(1.5, fy(ph, 0) - fy(ph, fl * 0.45)));
  if (o.crown) { c.fillStyle = col; c.beginPath(); c.moveTo(X0, Yt); c.lineTo((X0 + X1) / 2 + (o.crown > 0 ? sw : -sw), fy(ph, yb + h + o.crownH)); c.lineTo(X1, Yt); c.fill(); }
}
function skyline(c, pw, ph, R, { hmin, hmax, wmin, wmax, gap, yb = 0.5, cols }) {
  for (let x = 2 + R() * 6; x < FW - 2 - wmin;) {
    const w = Math.min(wmin + R() * (wmax - wmin), FW - 2 - x), h = hmin + R() * (hmax - hmin);
    tower(c, pw, ph, x, x + w, yb, h, cols[Math.floor(R() * cols.length)], R); x += w + gap * (0.4 + R());
  }
}
/** 远处海面（地平线 → 面板底），带一点波光 */
function water(c, pw, ph, R, top = '#A9CFE0', bot = '#2E7AA0', glints = 60) {
  const hz = fy(ph, 0), g = c.createLinearGradient(0, hz, 0, ph); g.addColorStop(0, top); g.addColorStop(1, bot); c.fillStyle = g; c.fillRect(0, hz, pw, ph - hz);
  c.fillStyle = 'rgba(255,255,255,0.35)'; for (let i = 0; i < glints; i++) { const y = hz + R() * (ph - hz); c.fillRect(R() * pw, y, fx(pw, 2 + R() * 5), 1.5); }
}
/** 并行的跨海公路桥（厦漳跨海大桥那样）：桥面 y 9 m、每 40 m 一个桥墩从水里立起来；v=1 的那块中间是斜拉桥的塔 + 两边扇形拉索 */
function seaBridge(c, pw, ph, v) {
  const dk0 = 8, dk1 = 10.5;
  c.fillStyle = '#C9CED2';
  for (const x of [20, 60, 100]) { if (v === 1 && x === 60) continue; c.fillRect(fx(pw, x - 1.6), fy(ph, dk0), fx(pw, 3.2), fy(ph, -0.5) - fy(ph, dk0)); }   // 桥墩
  c.fillStyle = 'rgba(80,100,115,0.35)'; for (const x of [20, 60, 100]) if (!(v === 1 && x === 60)) c.fillRect(fx(pw, x + 0.8), fy(ph, dk0), fx(pw, 0.8), fy(ph, -0.5) - fy(ph, dk0));
  c.fillStyle = '#E3E6E8'; c.fillRect(0, fy(ph, dk1), pw, fy(ph, dk0) - fy(ph, dk1));                  // 桥面（连续，左右面板拼得上）
  c.fillStyle = '#9AA3AA'; c.fillRect(0, fy(ph, dk0 + 0.6), pw, 2);
  if (v === 1) {   // 斜拉桥塔（H 形从侧面看是一根，往上收）+ 拉索
    const top = 62, X = 60;
    c.fillStyle = '#D9DDDF'; c.beginPath(); c.moveTo(fx(pw, X - 3.2), fy(ph, -0.5)); c.lineTo(fx(pw, X + 3.2), fy(ph, -0.5)); c.lineTo(fx(pw, X + 1.6), fy(ph, top)); c.lineTo(fx(pw, X - 1.6), fy(ph, top)); c.closePath(); c.fill();
    c.fillStyle = 'rgba(80,100,115,0.3)'; c.fillRect(fx(pw, X + 0.6), fy(ph, top), fx(pw, 1.0), fy(ph, -0.5) - fy(ph, top));
    c.fillStyle = '#C0392B'; c.fillRect(fx(pw, X - 1.6), fy(ph, top + 1.2), fx(pw, 3.2), fy(ph, top) - fy(ph, top + 1.2));   // 塔顶航空灯
    c.strokeStyle = 'rgba(235,238,240,0.95)'; c.lineWidth = 1.6;
    for (let i = 0; i < 9; i++) { const ya = top - 3 - i * 2.2, dx = 10 + i * 5.2; for (const sd of [-1, 1]) { c.beginPath(); c.moveTo(fx(pw, X), fy(ph, ya)); c.lineTo(fx(pw, X + sd * dx), fy(ph, dk1)); c.stroke(); } }
  }
}
const FAR = {
  city(c, pw, ph, v, R) { const hz = fy(ph, 0); sky(c, pw, ph, hz, '#8DB8DE', '#E3ECF2');
    ridge(c, pw, hz, ph * 0.07, 'rgba(150,170,178,0.75)', R, 5, 0.3);                                     // 白云山一线
    skyline(c, pw, ph, R, { hmin: 14, hmax: v ? 46 : 34, wmin: 14, wmax: 30, gap: 5, cols: ['#C9D2DB', '#D8D3C9', '#BFCAD4', '#DDD9CF'] });
    c.fillStyle = 'rgba(225,235,242,0.25)'; c.fillRect(0, fy(ph, 30), pw, hz - fy(ph, 30));             // 远处一层薄雾
    c.fillStyle = '#93A08E'; c.fillRect(0, hz, pw, ph - hz); },
  fields(c, pw, ph, v, R) { const hz = ph * HZ_F; sky(c, pw, ph, hz); ridge(c, pw, hz, ph * 0.12, '#9BB4B8', R, 6, 0.4); ridge(c, pw, hz, ph * 0.06, '#86A890', R, 9, 0.3); c.fillStyle = '#7FA066'; c.fillRect(0, hz, pw, ph - hz); },
  mount(c, pw, ph, v, R) { const hz = ph * HZ_F; sky(c, pw, ph, hz, '#7EAFDB', '#D5E6F0'); ridge(c, pw, hz, ph * 0.34, '#8FAAB5', R, 5, 0.6); ridge(c, pw, hz, ph * 0.22, '#5F8A6C', R, 7, 0.5); c.fillStyle = '#557E58'; c.fillRect(0, hz, pw, ph - hz); },
  sea(c, pw, ph, v, R) { const hz = fy(ph, 0); sky(c, pw, ph, hz, '#77B0E2', '#E6F1F7');
    ridge(c, pw, hz, ph * 0.09, 'rgba(128,156,170,0.7)', R, 4, 0.5);                                     // 远山（低、发蓝）
    water(c, pw, ph, R); seaBridge(c, pw, ph, v); },
  xiamen(c, pw, ph, v, R) { const hz = fy(ph, 0); sky(c, pw, ph, hz, '#7DB6E6', '#E4F0F7');
    ridge(c, pw, hz, ph * 0.14, '#93B0B0', R, 5, 0.5);                                                    // 岛上的山
    const cols = ['#E6E9EC', '#D3DEE6', '#EDE6DA', '#C6D3DE', '#F0EEE9'];
    skyline(c, pw, ph, R, { hmin: 16, hmax: 48, wmin: 12, wmax: 26, gap: 4, yb: 1, cols });
    if (v === 0) for (const x0 of [52, 70]) tower(c, pw, ph, x0, x0 + 13, 1, 88, '#B9CCDA', R, { floor: 4, bay: 2.6, win: 'rgba(60,90,120,0.5)', crown: x0 > 60 ? 1 : -1, crownH: 9 });   // 双子塔（世茂海峡大厦）
    c.fillStyle = '#B9B2A6'; c.fillRect(0, fy(ph, 1), pw, fy(ph, 0) - fy(ph, 1));                         // 海堤
    water(c, pw, ph, R, '#9FCADD', '#3482A6', 30); }
};
/* 中景：2 列 × 5 行；面板 y -25..20 → 地面线（y = -1.3）在 0.52 高处，以上镂空 */
const MID_ROWS = ['city', 'fields', 'mount', 'sea', 'xiamen'];
const GL_M = (25 - 1.3) / 45;   // 地面线离面板底的比例
function house(c, x, gy, w, h, wall, roof, R) { c.fillStyle = wall; c.fillRect(x, gy - h, w, h); c.fillStyle = roof; c.fillRect(x - 2, gy - h - 4, w + 4, 5); c.fillStyle = 'rgba(60,70,80,0.55)'; for (let yy = gy - h + 5; yy < gy - 6; yy += 9) for (let xx = x + 3; xx < x + w - 4; xx += 8) c.fillRect(xx, yy, 4, 5); }
function tree(c, x, gy, r, col) { c.fillStyle = '#5B4632'; c.fillRect(x - 1.5, gy - r * 1.1, 3, r * 1.1); c.fillStyle = col; c.beginPath(); c.arc(x, gy - r * 1.4, r, 0, 6.3); c.fill(); }
function palm(c, x, gy, h) { c.strokeStyle = '#7A6A50'; c.lineWidth = 3; c.beginPath(); c.moveTo(x, gy); c.quadraticCurveTo(x + 4, gy - h / 2, x + 2, gy - h); c.stroke(); c.strokeStyle = '#3F7A3E'; c.lineWidth = 3;
  for (let k = 0; k < 7; k++) { const a = -Math.PI / 2 + (k - 3) * 0.45; c.beginPath(); c.moveTo(x + 2, gy - h); c.quadraticCurveTo(x + 2 + Math.cos(a) * 12, gy - h + Math.sin(a) * 12 - 4, x + 2 + Math.cos(a) * 20, gy - h + Math.sin(a) * 18 + 8); c.stroke(); } }
/** 闽南红砖厝：红砖墙、白石墙基、两头高翘的燕尾脊 */
function cuo(c, x, gy, w, R) { const h = 20 + R() * 6; c.fillStyle = '#E8E0D2'; c.fillRect(x, gy - 7, w, 7); c.fillStyle = '#B5452F'; c.fillRect(x, gy - h, w, h - 7);
  c.fillStyle = '#7E2E22'; c.fillRect(x + w * 0.42, gy - 16, w * 0.16, 16);
  c.fillStyle = '#5C2A22'; c.beginPath(); c.moveTo(x - 4, gy - h); c.lineTo(x + w + 4, gy - h); c.lineTo(x + w - 6, gy - h - 10); c.lineTo(x + 6, gy - h - 10); c.closePath(); c.fill();
  c.strokeStyle = '#5C2A22'; c.lineWidth = 3; c.beginPath(); c.moveTo(x + 2, gy - h - 10); c.quadraticCurveTo(x + w / 2, gy - h - 6, x + w - 2, gy - h - 10); c.stroke();
  for (const [ex, d] of [[x + 2, -1], [x + w - 2, 1]]) { c.beginPath(); c.moveTo(ex, gy - h - 10); c.quadraticCurveTo(ex + d * 6, gy - h - 12, ex + d * 10, gy - h - 22); c.stroke(); } }   // 燕尾
const mx = (pw, x) => pw * x / 40, my = (ph, y) => ph * (20 - y) / 45;
/** 中景楼房（米）：x0..x1、从地面（y -1.3）起高 h；一层 3 m、一开间 2.5 m 的窗格 + 侧面暗条 + 屋顶 */
function block(c, pw, ph, x0, x1, h, col) {
  const X0 = mx(pw, x0), X1 = mx(pw, x1), Yb = my(ph, -1.3), Yt = my(ph, -1.3 + h), sw = (X1 - X0) * 0.12;
  c.fillStyle = col; c.fillRect(X0, Yt, X1 - X0, Yb - Yt); c.fillStyle = 'rgba(40,55,70,0.16)'; c.fillRect(X1 - sw, Yt, sw, Yb - Yt);
  c.fillStyle = '#8D959E'; c.fillRect(X0 - 2, Yt - 3, X1 - X0 + 4, 4);
  c.fillStyle = 'rgba(60,80,100,0.55)';
  for (let y = -1.3 + 1.0; y < -1.3 + h - 1.6; y += 3) for (let x = x0 + 0.7; x < x1 - 1.2 - (x1 - x0) * 0.12; x += 2.5) c.fillRect(mx(pw, x), my(ph, y + 1.8), mx(pw, 1.4), my(ph, 0) - my(ph, 1.5));
}
const MID = {
  city(c, pw, ph, v, R) { const gy = ph * (1 - GL_M); c.clearRect(0, 0, pw, ph);
    const cols = ['#D9DEE4', '#E6DCCF', '#CBD5DF', '#E9E4DA', '#D3DCD3', '#C8CFD8'];
    for (let x = 1 + R() * 2; x < 40 - 9;) { const w = Math.min(8 + R() * 10, 39 - x), h = 6 + R() * (v ? 15 : 11); block(c, pw, ph, x, x + w, h, cols[Math.floor(R() * cols.length)]); x += w + 1 + R() * 3; }
    for (let i = 0; i < 5; i++) tree(c, R() * pw, gy, 6 + R() * 4, '#4F7F4A');
    c.fillStyle = '#8F9890'; c.fillRect(0, gy, pw, ph - gy); c.fillStyle = '#A9AEA6'; c.fillRect(0, gy + 6, pw, 5); },
  fields(c, pw, ph, v, R) { const gy = ph * (1 - GL_M); c.clearRect(0, 0, pw, ph);
    if (v === 0) { house(c, pw * 0.3, gy, 90, 30, '#F1EFE8', '#6E5B4A', R); house(c, pw * 0.3 + 98, gy, 64, 22, '#ECE8DE', '#6E5B4A', R); }
    for (let i = 0; i < 9; i++) { const x = R() * pw; if (R() < 0.5) tree(c, x, gy, 5 + R() * 4, '#4C7A40'); else palm(c, x, gy, 18 + R() * 8); }
    for (let y = gy, k = 0; y < ph; y += 7 + k * 1.5, k++) { c.fillStyle = k % 2 ? '#86B05A' : '#9CC063'; c.fillRect(0, y, pw, 8 + k * 1.5); }
    c.fillStyle = 'rgba(80,110,60,0.5)'; for (let x = R() * 60; x < pw; x += 60 + R() * 80) c.fillRect(x, gy, 2, ph - gy); },
  mount(c, pw, ph, v, R) { const gy = ph * (1 - GL_M); c.clearRect(0, 0, pw, ph);
    ridge(c, pw, gy, ph * 0.42, '#4E7B55', R, 4, 0.7); ridge(c, pw, gy, ph * 0.22, '#3F6B47', R, 6, 0.5);
    c.fillStyle = 'rgba(30,60,35,0.35)'; for (let i = 0; i < 60; i++) { c.beginPath(); c.arc(R() * pw, gy - R() * ph * 0.28, 3 + R() * 4, 0, 6.3); c.fill(); }
    c.fillStyle = '#3C6343'; c.fillRect(0, gy, pw, ph - gy); },
  sea(c, pw, ph, v, R) { const gy = ph * (1 - GL_M); c.clearRect(0, 0, pw, ph);
    const g = c.createLinearGradient(0, gy - 6, 0, ph); g.addColorStop(0, '#8CBCD3'); g.addColorStop(1, '#2F7598'); c.fillStyle = g; c.fillRect(0, gy - 6, pw, ph - gy + 6);
    c.fillStyle = 'rgba(255,255,255,0.5)'; for (let i = 0; i < 70; i++) { const y = gy + R() * (ph - gy); c.fillRect(R() * pw, y, 8 + (y - gy) * 0.3 * R(), 1.5 + (y - gy) / 50); }
    if (v === 1) { c.fillStyle = '#E9ECEE'; c.beginPath(); c.moveTo(pw * 0.6, gy - 2); c.lineTo(pw * 0.6 + 26, gy - 2); c.lineTo(pw * 0.6 + 20, gy + 3); c.lineTo(pw * 0.6 + 4, gy + 3); c.fill(); c.fillStyle = '#C0392B'; c.fillRect(pw * 0.6 + 10, gy - 9, 6, 7); }   // 小渔船
    c.fillStyle = 'rgba(120,95,70,0.6)'; for (let x = R() * 80; x < pw; x += 70 + R() * 90) c.fillRect(x, gy + 4, 30, 2); },   // 远处的养殖浮排
  xiamen(c, pw, ph, v, R) { const gy = ph * (1 - GL_M); c.clearRect(0, 0, pw, ph);
    if (v === 0) { cuo(c, mx(pw, 1), gy, mx(pw, 9), R); cuo(c, mx(pw, 11.5), gy, mx(pw, 7.5), R); block(c, pw, ph, 21, 30, 13, '#F2EEE6'); cuo(c, mx(pw, 31.5), gy, mx(pw, 7.5), R); }
    else { block(c, pw, ph, 1, 11, 16, '#F4F1EA'); cuo(c, mx(pw, 13), gy, mx(pw, 9), R); block(c, pw, ph, 24, 33, 10, '#DDE8EE'); cuo(c, mx(pw, 34), gy, mx(pw, 5.5), R); }
    for (let i = 0; i < 7; i++) palm(c, R() * pw, gy, 22 + R() * 10);
    c.fillStyle = '#8E9A8C'; c.fillRect(0, gy, pw, ph - gy); c.fillStyle = '#B9B2A6'; c.fillRect(0, gy + 6, pw, 5); }
};
/* 近景：2 列 × 8 行；面板 y -3.5..6（9.5 m）；接触网立柱每块一根（14 m） */
const NEAR_ROWS = ['empty', 'city', 'fields', 'mount', 'portalIn', 'tunnel', 'portalOut', 'bridge'];
const NY0 = -3.5, NH = 9.5, ny = (ph, y) => ph * (1 - (y - NY0) / NH);
function mast(c, pw, ph, x) { c.fillStyle = '#8E969C'; c.fillRect(x, ny(ph, 5.8), 6, ny(ph, -1.3) - ny(ph, 5.8)); c.fillRect(x - 40, ny(ph, 5.2), 46, 3); c.fillStyle = '#5E666C'; c.fillRect(x - 40, ny(ph, 4.9), 2, 7); }
function catenary(c, pw, ph) { c.fillStyle = 'rgba(60,64,68,0.9)'; c.fillRect(0, ny(ph, 5.0), pw, 1.5); c.fillRect(0, ny(ph, 4.4), pw, 1); }
const NEAR = {
  empty(c, pw, ph) { c.clearRect(0, 0, pw, ph); },
  city(c, pw, ph, v, R) { c.clearRect(0, 0, pw, ph); const g = ny(ph, -0.6);
    c.fillStyle = '#9B9E98'; c.fillRect(0, g, pw, ph - g); c.fillStyle = '#C9CBC6'; c.fillRect(0, ny(ph, 1.6), pw, g - ny(ph, 1.6));   // 声屏障下段（混凝土）
    c.fillStyle = 'rgba(190,215,225,0.35)'; c.fillRect(0, ny(ph, 3.0), pw, ny(ph, 1.6) - ny(ph, 3.0)); c.fillStyle = '#8A9399'; for (let x = 0; x < pw; x += pw / 4) c.fillRect(x, ny(ph, 3.0), 4, ny(ph, -0.6) - ny(ph, 3.0));
    catenary(c, pw, ph); if (v === 0) mast(c, pw, ph, pw * 0.5); },
  fields(c, pw, ph, v, R) { c.clearRect(0, 0, pw, ph); const g = ny(ph, -1.0);
    c.fillStyle = '#7FA05A'; c.beginPath(); c.moveTo(0, g); c.lineTo(pw, g); c.lineTo(pw, ph); c.lineTo(0, ph); c.fill();
    c.fillStyle = '#6E9050'; for (let i = 0; i < 30; i++) c.fillRect(R() * pw, g + R() * (ph - g), 3, 2);
    c.strokeStyle = '#B8BCB6'; c.lineWidth = 2; c.beginPath(); c.moveTo(0, ny(ph, 0.2)); c.lineTo(pw, ny(ph, 0.2)); c.stroke(); for (let x = 0; x < pw; x += pw / 6) c.fillRect(x, ny(ph, 0.2), 2, ny(ph, -1) - ny(ph, 0.2));   // 隔离栅
    catenary(c, pw, ph); if (v === 0) mast(c, pw, ph, pw * 0.4); },
  mount(c, pw, ph, v, R) { c.clearRect(0, 0, pw, ph);   // 路堑边坡：护坡格 + 草
    const top = ny(ph, v ? 3.5 : 1.8); c.fillStyle = '#8A8F7A'; c.fillRect(0, top, pw, ph - top); c.fillStyle = '#5E8A4E'; for (let i = 0; i < 80; i++) c.fillRect(R() * pw, top + R() * (ph - top), 4, 3);
    c.strokeStyle = '#B7B8AC'; c.lineWidth = 3; for (let x = -pw; x < pw * 2; x += 40) { c.beginPath(); c.moveTo(x, top); c.lineTo(x + (ph - top), ph); c.stroke(); c.beginPath(); c.moveTo(x, ph); c.lineTo(x + (ph - top), top); c.stroke(); }
    c.fillStyle = '#4F7A47'; c.fillRect(0, top - 6, pw, 7); catenary(c, pw, ph); if (v === 0) mast(c, pw, ph, pw * 0.6); },
  tunnel(c, pw, ph, v) { c.fillStyle = '#2B2E31'; c.fillRect(0, 0, pw, ph); c.fillStyle = '#383C40'; c.fillRect(0, ny(ph, 0.8), pw, 4);
    if (v === 0) { c.fillStyle = '#FFE7A8'; c.fillRect(pw * 0.5, ny(ph, 2.4), 18, 5); } c.fillStyle = '#202326'; c.fillRect(0, ny(ph, -0.9), pw, ph); },
  portalIn(c, pw, ph, v, R) { NEAR.mount(c, pw, ph, 1, R); c.fillStyle = '#B9BAB2'; c.fillRect(pw * 0.55, 0, pw * 0.08, ph); c.fillStyle = '#2B2E31'; c.fillRect(pw * 0.63, 0, pw * 0.37, ph); },
  portalOut(c, pw, ph, v, R) { NEAR.mount(c, pw, ph, 1, R); c.fillStyle = '#2B2E31'; c.fillRect(0, 0, pw * 0.37, ph); c.fillStyle = '#B9BAB2'; c.fillRect(pw * 0.37, 0, pw * 0.08, ph); },
  bridge(c, pw, ph, v) { c.clearRect(0, 0, pw, ph);   // 桥上：只有桥面边梁 + 一道钢栏杆（上下都通透 → 看得到下面和远处的海）
    c.fillStyle = '#C9CBC6'; c.fillRect(0, ny(ph, -1.0), pw, ny(ph, -1.5) - ny(ph, -1.0)); c.fillStyle = '#A3A7A4'; c.fillRect(0, ny(ph, -1.0), pw, 3);   // 边梁
    c.fillStyle = 'rgba(0,0,0,0.12)'; c.fillRect(0, ny(ph, -1.5), pw, 4);
    c.fillStyle = '#7F8A92'; c.fillRect(0, ny(ph, 1.0), pw, 4); c.fillRect(0, ny(ph, 0.35), pw, 2);                                               // 扶手 + 中横杆
    for (let x = 0; x < pw; x += pw / 10) c.fillRect(x, ny(ph, 1.0), 3, ny(ph, -1.0) - ny(ph, 1.0));                                            // 立柱
    catenary(c, pw, ph); if (v === 0) mast(c, pw, ph, pw * 0.5); }
};
function bedPaint(c, S) { c.fillStyle = '#8E877C'; c.fillRect(0, 0, S, S); const R = rng(7); for (let i = 0; i < 900; i++) { c.fillStyle = R() < 0.5 ? '#7C756B' : '#A39C90'; c.fillRect(R() * S, R() * S, 2, 2); }
  for (let k = 0; k < 4; k++) { c.fillStyle = '#B5B0A6'; c.fillRect(k * S / 4 + 8, S * 0.22, S / 4 * 0.38, S * 0.56); }   // 轨枕（沿 x 每 0.65 m）
  c.fillStyle = '#6B6F72'; c.fillRect(0, S * 0.3, S, 5); c.fillRect(0, S * 0.7 - 5, S, 5); }

/** 一层：画布图集 + 两侧 N 块面板（同一个网格） */
class Layer {
  constructor(scene, name, o) {
    Object.assign(this, o); this.scene = scene;
    const S = o.size || 1024, tex = this.tex = new B.DynamicTexture(name + 'Tex', { width: S, height: S }, scene, true);
    tex.hasAlpha = !!o.alpha; tex.wrapU = tex.wrapV = B.Texture.CLAMP_ADDRESSMODE; tex.anisotropicFilteringLevel = 4;
    const c = tex.getContext(), cw = S / o.cols, ch = S / o.rows.length, pad = 2, R = rng(o.seed);
    c.clearRect(0, 0, S, S);
    o.rows.forEach((row, r) => { for (let v = 0; v < o.cols; v++) { c.save(); c.translate(v * cw + pad, r * ch + pad); c.beginPath(); c.rect(0, 0, cw - 2 * pad, ch - 2 * pad); c.clip(); o.paint[row](c, cw - 2 * pad, ch - 2 * pad, v, R); c.restore(); } });
    tex.update(true);
    this.cell = (row, v) => { const r = o.rows.indexOf(row), u0 = (v * cw + pad + 0.5) / S, u1 = ((v + 1) * cw - pad - 0.5) / S, v1 = 1 - (r * ch + pad + 0.5) / S, v0 = 1 - ((r + 1) * ch - pad - 0.5) / S; return [u0, u1, v0, v1]; };
    const mat = this.mat = new B.StandardMaterial(name + 'Mat', scene);
    // 不受光：颜色全走 emissiveTexture；镂空层再挂同一张图做 diffuseTexture（hasAlpha → alpha test，不用半透明排序），diffuse 颜色为黑
    mat.emissiveTexture = tex; if (o.alpha) mat.diffuseTexture = tex; mat.diffuseColor = new B.Color3(0, 0, 0); mat.specularColor = new B.Color3(0, 0, 0); mat.emissiveColor = new B.Color3(0, 0, 0);
    mat.disableLighting = true; mat.backFaceCulling = false; mat.fogEnabled = false;
    const m = this.mesh = new B.Mesh(name, scene), p = [], uv = [], ind = [], nrm = [];
    this.slots = [];   // 每块面板：{ side, i, row, v }
    for (const side of [1, -1]) for (let i = 0; i < o.n; i++) {
      const x0 = (i - o.n / 2) * o.w, x1 = x0 + o.w, z = side * o.z, b = p.length / 3;
      p.push(x0, o.y0, z, x1, o.y0, z, x1, o.y1, z, x0, o.y1, z); nrm.push(0, 0, -side, 0, 0, -side, 0, 0, -side, 0, 0, -side);
      uv.push(0, 0, 0, 0, 0, 0, 0, 0); ind.push(b, b + 1, b + 2, b, b + 2, b + 3);
      this.slots.push({ side, i, row: o.init, v: 0 });
    }
    const vd = new B.VertexData(); vd.positions = p; vd.normals = nrm; vd.uvs = uv; vd.indices = ind; vd.applyToMesh(m, true);
    m.material = mat; m.isPickable = false; m.alwaysSelectAsActiveMesh = true; m.parent = o.parent;
    this.uvs = new Float32Array(uv.length); this.off = 0; this.R = rng(o.seed + 11); this.writeUV();
  }
  writeUV() { this.slots.forEach((s, k) => { const [u0, u1, v0, v1] = this.cell(s.row, s.v); this.uvs.set([u0, v0, u1, v0, u1, v1, u0, v1], k * 8); }); this.mesh.updateVerticesData(B.VertexBuffer.UVKind, this.uvs); }
  /** 所有面板立刻换成 row（隧道里看不见远景时用） */
  fill(row) { for (const s of this.slots) { s.row = row; s.v = this.pick(); } this.writeUV(); }
  pick() { return this.cols > 1 && this.R() < 0.5 ? 1 : 0; }
  /** 前进 d 米；next(side) 给最前面新面板的内容 */
  advance(d, next) {
    this.off += d * this.k; let dirty = false;
    while (this.off >= this.w) {
      this.off -= this.w; dirty = true;
      for (const side of [1, -1]) {
        const row = this.slots.filter(s => s.side === side).sort((a, b) => a.i - b.i);
        for (let i = 0; i < row.length - 1; i++) { row[i].row = row[i + 1].row; row[i].v = row[i + 1].v; }
        const nx = next(side); row[row.length - 1].row = nx; row[row.length - 1].v = this.pick();
      }
    }
    if (dirty) this.writeUV();
    this.mesh.position.x = -this.off;
  }
  front(side) { const r = this.slots.filter(s => s.side === side); return r[r.length - 1].row; }
  dispose() { this.mesh.dispose(); this.mat.dispose(); this.tex.dispose(); }
}

/** 车窗外的全部远景（挂在 parent 下：parent 放在车厢中心 (EO.x, 0, 0)） */
export class EmuScenery {
  constructor(scene, parent) {
    this.root = new B.TransformNode('emuScenery', scene); this.root.parent = parent;
    const P = this.root;
    this.far = new Layer(scene, 'sceneFar', { parent: P, rows: FAR_ROWS, cols: 2, size: 2048, paint: FAR, n: 6, w: 120, z: 120, y0: -60, y1: 90, k: 0.35, init: 'city', seed: 3 });
    this.mid = new Layer(scene, 'sceneMid', { parent: P, rows: MID_ROWS, cols: 2, paint: MID, alpha: true, n: 14, w: 40, z: 40, y0: -25, y1: 20, k: 0.75, init: 'city', seed: 5 });
    this.near = new Layer(scene, 'sceneNear', { parent: P, rows: NEAR_ROWS, cols: 2, paint: NEAR, alpha: true, n: 12, w: 14, z: 8.5, y0: NY0, y1: NY0 + NH, k: 1, init: 'empty', seed: 9 });
    // 道床（碎石 + 轨枕），贴图沿 x 滚动
    const S = 256, bt = this.bedTex = new B.DynamicTexture('bedTex', { width: S, height: S }, scene, true); bedPaint(bt.getContext(), S); bt.update(true);
    bt.wrapU = B.Texture.WRAP_ADDRESSMODE; bt.uScale = 300 / 2.6; bt.vScale = 1;
    const bm = this.bedMat = new B.StandardMaterial('bedMat', scene); bm.emissiveTexture = bt; bm.disableLighting = true; bm.specularColor = new B.Color3(0, 0, 0); bm.diffuseColor = new B.Color3(0, 0, 0); bt.level = 0.92;
    const bed = this.bed = B.MeshBuilder.CreateGround('sceneBed', { width: 300, height: 17 }, scene); bed.position.y = -1.45; bed.parent = P; bed.material = bm; bed.isPickable = false;
    // 桥下的海面（只在桥上打开，+1 次绘制）：近景板和道床都收窄到桥面宽，往下看就是开阔的海
    const sea = this.sea = B.MeshBuilder.CreateGround('sceneSea', { width: 700, height: 260 }, scene); sea.position.y = -12; sea.parent = P; sea.isPickable = false;
    const sm = this.seaMat = new B.StandardMaterial('seaMat', scene); sm.disableLighting = true; sm.emissiveColor = B.Color3.FromHexString('#3C83A6'); sm.specularColor = new B.Color3(0, 0, 0); sm.diffuseColor = new B.Color3(0, 0, 0); sm.fogEnabled = false;
    sea.material = sm; sea.setEnabled(false); this.bridgeK = 0;
    this.meshes = [this.far.mesh, this.mid.mesh, this.near.mesh, bed, sea];
  }
  /** seg：{ far, mid, near } 当前路段每层要的内容（near 可以是 'empty'） */
  advance(d, seg) {
    this.far.advance(d, () => seg.far); this.mid.advance(d, () => seg.mid); this.near.advance(d, () => seg.near);
    this.bedTex.uOffset = (this.bedTex.uOffset + d / 2.6) % 1;
    // 近景里大半块面板是桥 → 近景板从 ±8.5 m 收到 ±4 m（桥栏）、道床收到桥面宽、海面打开
    const nb = this.near.slots.filter(q => q.row === 'bridge').length / this.near.slots.length, want = nb > 0.5 ? 1 : 0;
    this.bridgeK += (want - this.bridgeK) * Math.min(1, 0.04 + d * 0.02);
    if (Math.abs(this.bridgeK - want) < 0.01) this.bridgeK = want;
    const k = this.bridgeK; this.near.mesh.scaling.z = 1 - k * (1 - 4 / 8.5); this.bed.scaling.z = 1 - k * (1 - 7.4 / 17); this.sea.setEnabled(k > 0.02);
  }
  resetBridge() { this.bridgeK = 0; this.near.mesh.scaling.z = 1; this.bed.scaling.z = 1; this.sea.setEnabled(false); }
  setEnabled(v) { this.root.setEnabled(v); }
  dispose() { this.far.dispose(); this.mid.dispose(); this.near.dispose(); this.bed.dispose(); this.bedMat.dispose(); this.sea.dispose(); this.seaMat.dispose(); this.bedTex.dispose(); this.root.dispose(); }
}
