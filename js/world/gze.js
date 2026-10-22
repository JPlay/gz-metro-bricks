/*
 * 广州东站（1 号线终点）：出站往南过马路，就是广州东站火车站。
 *   - 玻璃候车大厅：屋顶上一排红色大字「广州东站」，正门「进站口」；厅里成排的蓝灰色候车椅、头顶的大发车屏（真实的车次和终到站）；
 *   - 大厅后面一排检票闸机（走近自动开），过了闸机就是站台：雨棚、站台边的黄色安全线；
 *   - 站台边永远停着一列白色复兴号（红色腰线、流线型车头），不进站也不开走；5 号车厢（二等座）的车门开着，走进去就进车厢（独立场景，见 js/game/east.js）。
 *   全部并进一个单独的 Kit（只在地面上启用）；闸机门扇用实例（1 次绘制）。没有地面引导线。
 */
import { hex } from '../core/geo.js';
import { Geo } from '../core/geo.js';
import { FONT, FONT_EN } from './kit.js';

/** 大厅 z -88..-116、|x| ≤ 28；闸机 z = -112；站台 z -116..-128（边沿 -128）；轨道中心 z = -129.75 */
export const GZE = { hz0: -88, hz1: -116, hx: 28, H: 10.5, gz: -112, edge: -128, tz: -129.75, zs: -137, xw: -60, xe: 50 };
/** 5 号车厢（二等座）的两扇开着的车门：外面的 x ↔ 车厢里的 x（车厢中心 x = -17） */
/** 挡墙（站台上，进站口后面） */
export const BF = { z: -118.6 };
export const EMU = { xc: -17, doors: [{ x: -5.8, lx: 11.2 }], train: 'D2315', to: '厦门北', car: '05' };
const C = {
  white: hex('#F6F7F5'), body: hex('#F4F5F3'), red: hex('#D3121A'), win: hex('#2C3640'), skirt: hex('#9AA1A8'), dark: hex('#3A3F45'),
  frame: hex('#9FA7AE'), roof: hex('#EDEEEB'), col: hex('#E7E8E4'), seat: hex('#5E7489'), seat2: hex('#6E8499'), leg: hex('#8D949B'),
  plat: hex('#C9C6BF'), edge: hex('#ECEBE6'), bed: hex('#8E8A83'), sleeper: hex('#9C978E'), rail: hex('#6D7175'), wall: hex('#BDB9B1'), floor: hex('#DCD8CF')
};
/* ---------- 放样（截面在 zy 平面，沿 x 排列），顶点色按截面 / 点序号给；自动让法线朝外 ---------- */
function loftCol(g, secs, colFn) {
  const B = BABYLON, n = secs[0].pts.length, S = secs.length, base = g.p.length / 3;
  const P = (s, k) => secs[s].pts[k];   // [x, y, z]
  for (let s = 0; s < S; s++) {
    const cy = secs[s].cy, cz = secs[s].cz;
    for (let k = 0; k < n; k++) {
      const p = P(s, k), pa = P(s, Math.max(0, k - 1)), pb = P(s, Math.min(n - 1, k + 1)), sa = P(Math.max(0, s - 1), k), sb = P(Math.min(S - 1, s + 1), k);
      const t1 = new B.Vector3(pb[0] - pa[0], pb[1] - pa[1], pb[2] - pa[2]), t2 = new B.Vector3(sb[0] - sa[0], sb[1] - sa[1], sb[2] - sa[2]);
      let nn = B.Vector3.Cross(t1, t2); if (nn.lengthSquared() < 1e-12) nn = new B.Vector3(1, 0, 0); nn.normalize();
      if (nn.y * (p[1] - cy) + nn.z * (p[2] - cz) < 0 && Math.abs(nn.x) < 0.95) nn.scaleInPlace(-1);
      g.push(p[0], p[1], p[2], nn.x, nn.y, nn.z, colFn(s, k));
    }
  }
  // 绕序：拿第一块四边形的几何法线和要的法线比，反了就整体翻过来
  const a0 = P(0, 0), b0 = P(0, 1), c0 = P(1, 0), e1 = [b0[0] - a0[0], b0[1] - a0[1], b0[2] - a0[2]], e2 = [c0[0] - a0[0], c0[1] - a0[1], c0[2] - a0[2]];
  const gn = [e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]];
  const want = [g.n[base * 3], g.n[base * 3 + 1], g.n[base * 3 + 2]], flip = gn[0] * want[0] + gn[1] * want[1] + gn[2] * want[2] > 0;
  for (let s = 0; s < S - 1; s++) for (let k = 0; k < n - 1; k++) {
    const a = base + s * n + k, b = a + n;
    if (!flip) g.i.push(a, a + 1, b + 1, a, b + 1, b); else g.i.push(a, b + 1, a + 1, a, b, b + 1);
  }
}
/** 车身截面（z 偏移, y）：从远离站台一侧的车底，绕过车顶，到站台一侧的车底；腰线（红）和车窗带（深色）的上下沿各有一对点 */
const HALF = [[1.52, -0.95], [1.66, -0.7], [1.70, -0.3], [1.70, 0.47], [1.70, 0.5], [1.70, 0.66], [1.70, 0.69], [1.70, 0.86], [1.70, 0.9], [1.69, 1.62], [1.685, 1.66], [1.62, 2.15], [1.40, 2.55], [0.95, 2.77], [0.45, 2.84]];
const PROF = [...HALF.map(([z, y]) => [-z, y]), [0, 2.86], ...HALF.slice().reverse().map(([z, y]) => [z, y])];
const bandOf = y => (y > 0.48 && y < 0.68 ? 'red' : y > 0.88 && y < 1.64 ? 'win' : 'white');
/** 车门处的截面：站台一侧 y < 2.1 的点去掉（门洞），只剩远侧 + 车顶 */
const PROF_DOOR = PROF.filter(([z, y]) => !(z > 0 && y < 2.1));
function carBody(g, x0, x1, holes = []) {
  const sec = (x, pr) => ({ cy: 0.95, cz: GZE.tz, pts: pr.map(([z, y]) => [x, y, GZE.tz + z]) });
  const col = pr => (s, k) => { const b = bandOf(pr[k][1]); return b === 'red' ? C.red : b === 'win' ? C.win : C.body; };
  let a = x0;
  for (const [h0, h1] of holes) { loftCol(g, [sec(a, PROF), sec(h0, PROF)], col(PROF)); loftCol(g, [sec(h0, PROF_DOOR), sec(h1, PROF_DOOR)], col(PROF_DOOR)); a = h1; }
  loftCol(g, [sec(a, PROF), sec(x1, PROF)], col(PROF));
  for (const x of [x0, x1]) cap(g, x, PROF.map(([z, y]) => [z, y]), x === x0 ? -1 : 1);
}
/** 车厢端头的封板（扇形） */
function cap(g, x, pts, dir) {
  const base = g.p.length / 3; g.push(x, 0.95, GZE.tz, dir, 0, 0, C.dark);
  for (const [z, y] of pts) g.push(x, y, GZE.tz + z, dir, 0, 0, C.dark);
  for (let k = 0; k < pts.length - 1; k++) { if (dir > 0) g.i.push(base, base + 1 + k, base + 2 + k); else g.i.push(base, base + 2 + k, base + 1 + k); }
  g.i.push(...(dir > 0 ? [base, base + pts.length, base + 1] : [base, base + 1, base + pts.length]));
}
/** 流线型车头：x0（和车身接上）→ 车尖（+x）；越往前越窄、越低，车底也往上收；驾驶室挡风玻璃（深色）在车头上半段 */
function nose(g, x0, L) {
  const T = [0, 0.1, 0.22, 0.34, 0.46, 0.58, 0.69, 0.79, 0.87, 0.93, 0.97, 1.0], secs = [];
  for (const t of T) {
    const hf = 1 - 0.74 * Math.pow(t, 1.35), wf = t < 1 ? 1 - 0.86 * Math.pow(t, 2.1) : 0.06, yb = -0.95 + 0.42 * t * t;
    const h2 = t < 1 ? hf : 0.1, x = x0 + L * t;
    secs.push({ t, cy: yb + 0.5, cz: GZE.tz, pts: PROF.map(([z, y]) => [x, yb + (y + 0.95) * h2 * (t < 1 ? 1 : 0.6), GZE.tz + z * wf]) });
  }
  loftCol(g, secs, (s, k) => {
    const t = secs[s].t, [z, y] = PROF[k], b = bandOf(y);
    if (b === 'red') return C.red;
    if (t > 0.16 && t < 0.52 && y > 2.0 && Math.abs(z) < 1.5) return C.win;   // 挡风玻璃
    if (b === 'win' && t < 0.06) return C.win;
    return C.body;
  });
  const tip = secs[secs.length - 3];
  for (const sd of [-1, 1]) g.ellipsoid(tip.pts[0][0], 0.05, GZE.tz + sd * 0.42, 0.22, 0.09, 0.16, hex('#FFFFFF'), 1);   // 车头灯（白色玻璃罩）
}
/** LED 发车屏（黑底、暖黄 / 绿色点阵字） */
const ROWS = [['D2315', '厦门北', '14:20', 'A1', '正在检票'], ['D3313', '厦门北', '15:51', 'A2', '候车'], ['D7162', '潮汕', '16:45', 'A3', '候车'], ['D2395', '厦门', '16:50', 'A1', '候车'], ['G6541', '香港西九龙', '17:25', 'A4', '候车'], ['C4121', '深圳', '17:46', 'A4', '候车'], ['C6813', '汕头', '18:08', 'A2', '候车'], ['D7108', '潮汕', '19:10', 'A3', '候车']];
function paintBoard(c, pw, ph) {
  c.fillStyle = '#0B0D10'; c.fillRect(0, 0, pw, ph);
  const rh = ph / (ROWS.length + 2.1), xs = [0.04, 0.24, 0.47, 0.64, 0.8].map(f => f * pw);
  c.fillStyle = '#152238'; c.fillRect(0, 0, pw, rh * 1.25);
  c.fillStyle = '#FFFFFF'; c.textBaseline = 'middle'; c.font = `700 ${rh * 0.62}px ${FONT}`;
  c.fillText('出发  Departures', xs[0], rh * 0.62); c.textAlign = 'right'; c.font = `600 ${rh * 0.5}px ${FONT_EN}`; c.fillText('广州东站', pw * 0.97, rh * 0.62); c.textAlign = 'left';
  c.fillStyle = '#9AA6B8'; c.font = `600 ${rh * 0.45}px ${FONT}`;
  ['车次', '终到站', '开点', '检票口', '状态'].forEach((t, i) => c.fillText(t, xs[i], rh * 1.75));
  ROWS.forEach((r, j) => {
    const y = rh * (2.7 + j); if (j % 2 === 0) { c.fillStyle = '#12161C'; c.fillRect(0, y - rh * 0.5, pw, rh); }
    c.font = `700 ${rh * 0.6}px ${FONT}`;
    r.forEach((t, i) => { c.fillStyle = i === 4 ? (t === '正在检票' ? '#3DDC84' : '#FFC23D') : i === 0 ? '#FF9A3D' : '#FFD86B'; c.fillText(t, xs[i], y); });
  });
}
function paintGateLed(c, pw, ph) {
  c.fillStyle = '#0B0D10'; c.fillRect(0, 0, pw, ph); c.textBaseline = 'middle';
  c.fillStyle = '#FF5A3D'; c.font = `800 ${ph * 0.5}px ${FONT}`; c.fillText('检票口 A1–A4', pw * 0.03, ph * 0.52);
  c.fillStyle = '#3DDC84'; c.font = `700 ${ph * 0.42}px ${FONT}`; c.textAlign = 'right'; c.fillText('D2315 厦门北  正在检票', pw * 0.97, ph * 0.52); c.textAlign = 'left';
}

export function buildGze(k, st) {
  const P = k.solid, G = k.glow, Gl = k.glass, M = k.metal, { hz0, hz1, hx, H, gz, edge, tz } = GZE;
  const out = { gates: [], npcs: [] };
  /* ===== 站前小广场 + 候车大厅 ===== */
  k.g('floor').slab(-hx, hx, 0.004, 0.012, hz1, hz0, C.floor, { ao: false });            // 大厅里抛光地面
  // 屋顶（前面挑出 2m）+ 屋顶下的灯带
  P.slab(-hx - 1.5, hx + 1.5, H, H + 0.8, hz1 - 0.5, hz0 + 2.2, C.roof);
  for (let z = hz0 - 2; z > hz1 + 1; z -= 4) G.slab(-hx + 1, hx - 1, H - 0.04, H - 0.01, z - 0.25, z + 0.25, hex('#FFF6E2'), { ao: false });
  // 屋顶上的大字「广州东站」（白色女儿墙 + 红字）
  P.slab(-11, 11, H + 0.8, H + 4.6, hz0 + 1.7, hz0 + 2.2, C.white);
  k.sign(0, H + 2.7, hz0 + 2.22, { kind: 'plain', w: 21, h: 3.6, bg: '#F6F7F5', fg: '#D3121A', zh: '广州东站', face: 0, align: 'center', box: false });
  // 玻璃幕墙：正面（中间大门开口 ±3）、两侧；竖梃 + 横梃
  const glassWall = (x0, x1, z0, z1) => { Gl.slab(x0, x1, 0, H, z0, z1, hex('#BFD8E6')); };
  glassWall(-hx, -3, hz0 - 0.03, hz0 + 0.03); glassWall(3, hx, hz0 - 0.03, hz0 + 0.03); Gl.slab(-3, 3, 3.8, H, hz0 - 0.03, hz0 + 0.03, hex('#BFD8E6'));
  k.colSlab(-hx, -3, 0, H, hz0 - 0.2, hz0 + 0.2); k.colSlab(3, hx, 0, H, hz0 - 0.2, hz0 + 0.2);
  for (const s of [-1, 1]) { glassWall(s * hx - 0.03, s * hx + 0.03, hz1, hz0); k.colSlab(s * hx - 0.2, s * hx + 0.2, 0, H, hz1, hz0); }
  for (let x = -hx; x <= hx + 0.01; x += 3.5) M.slab(x - 0.07, x + 0.07, Math.abs(x) < 3.1 ? 3.8 : 0, H, hz0 + 0.03, hz0 + 0.12, C.frame, { ao: false });   // 大门开口里不立竖梃
  for (const y of [3.8, 7.6, 10.6]) M.slab(-hx, hx, y - 0.06, y + 0.06, hz0 + 0.03, hz0 + 0.12, C.frame, { ao: false });
  for (const s of [-1, 1]) for (let z = hz0; z >= hz1 - 0.01; z -= 4) M.slab(s * hx - 0.12, s * hx + 0.12, 0, H, z - 0.07, z + 0.07, C.frame, { ao: false });
  // 正门雨棚 + 「进站口」
  P.slab(-4.5, 4.5, 3.8, 4.2, hz0 - 0.1, hz0 + 3.2, hex('#4A5058'));
  k.sign(0, 4.55, hz0 + 3.0, { kind: 'plain', w: 4.6, h: 0.6, bg: '#1F4E9C', fg: '#FFFFFF', zh: '进站口', en: 'Entrance', face: 0, align: 'center' });
  // 大厅里的四根大柱子
  for (const x of [-15, 15]) for (const z of [-95, -105.5]) { P.cyl(x, H / 2, z, 1.1, H, C.col, 16); k.col(x, H / 2, z, 1.0, H, 1.0); }
  // 后墙（中间开口 ±5 通往站台）
  P.slab(-hx, -5, 0, H, hz1 - 0.3, hz1, C.wall); P.slab(5, hx, 0, H, hz1 - 0.3, hz1, C.wall); P.slab(-5, 5, 4.2, H, hz1 - 0.3, hz1, C.wall);
  k.colSlab(-hx, -5, 0, H, hz1 - 0.3, hz1); k.colSlab(5, hx, 0, H, hz1 - 0.3, hz1);
  // 进站通道口后面一道挡墙（站台上，雨棚下）：从大门 / 大厅里看不到站台和列车；出了闸机往两边绕到站台
  P.slab(-7.5, 7.5, 0, 6.6, BF.z - 0.3, BF.z, C.wall); k.colSlab(-7.5, 7.5, 0, 6.6, BF.z - 0.3, BF.z);
  k.sign(0, 3.3, BF.z + 0.012, { kind: 'plain', w: 7.2, h: 1.5, bg: '#1F4E9C', fg: '#FFFFFF', zh: '5 站台', en: 'Platform 5', face: 0, align: 'center', box: false });
  // 候车椅：两边各 4 排（背靠背的连排椅，蓝灰色）
  const chair = (x, z, f) => {   // f = +1 面朝 +z / -1 面朝 -z
    P.box(x, 0.45, z, 0.5, 0.07, 0.46, C.seat2, 0, 0, 0, 1, { ao: false });
    P.box(x, 0.74, z - f * 0.24, 0.5, 0.55, 0.06, C.seat, 0, -f * 0.12, 0, 1, { ao: false });
  };
  for (const sx of [-1, 1]) for (const zr of [-93.5, -98, -102.5, -107]) {
    const x0 = sx * 6.5, x1 = sx * 21.5, xa = Math.min(x0, x1), xb = Math.max(x0, x1);
    M.slab(xa, xb, 0.34, 0.4, zr - 0.06, zr + 0.06, C.leg, { ao: false });
    for (const x of [xa + 0.5, xb - 0.5]) M.slab(x - 0.05, x + 0.05, 0, 0.36, zr - 0.3, zr + 0.3, C.leg, { ao: false });
    for (let x = xa + 0.3; x < xb - 0.2; x += 0.56) { chair(x, zr + 0.26, 1); chair(x, zr - 0.26, -1); }
    k.colSlab(xa, xb, 0, 0.9, zr - 0.55, zr + 0.55); k.shade.shadeRoom(xa, xb, zr - 0.55, zr + 0.55, 0.014, 0.3, 0.18);
  }
  // 坐着等车的人（髋部对齐椅面）
  for (const [x, zr, f, look] of [[-9.1, -98, 1, {}], [-13.6, -98, -1, { phone: true }], [11.3, -102.5, 1, {}], [16.9, -93.5, 1, { bag: 'backpack' }], [8.3, -107, -1, { phone: true }]])
    out.npcs.push({ x, z: zr + f * 0.26, ry: f > 0 ? 0 : Math.PI, seatY: 0.48, mode: look.phone ? 'sitPhone' : 'sit', look });
  // 发车屏（吊在厅中间上空，面朝大门）
  k.sign(0, 7.4, -104.5, { kind: 'custom', key: 'gzeBoard', paint: paintBoard, w: 12, h: 4.2, face: 0, hang: H, double: true });   // 两面都有（检票口这边回头也看得到）
  /* ===== 检票闸机（z = gz）===== */
  const lanes = [-4.5, -1.5, 1.5, 4.5];
  k.rail(-hx, gz, -6.45, gz, 0); k.rail(6.45, gz, hx, gz, 0);
  for (const cx of [-6, -3, 0, 3, 6]) {
    // 不锈钢闸机柜：银灰色拉丝面 + 亮一点的竖条高光 + 深色顶面玻璃
    P.rbox(cx, 0, gz, 0.3, 1.0, 1.7, hex('#C3C9CE'), 0.06, 0, { ao: false, bevel: 0.02 }); k.colSlab(cx - 0.4, cx + 0.4, 0, 1.0, gz - 0.85, gz + 0.85);
    for (const sx of [-1, 1]) P.slab(cx + sx * 0.151 - 0.004, cx + sx * 0.151 + 0.004, 0.08, 0.92, gz - 0.7, gz + 0.7, hex('#E4E8EB'), { ao: false });
    P.rbox(cx, 1.0, gz, 0.34, 0.05, 1.75, hex('#5B636B'), 0.09, 0, { ao: false });
    G.slab(cx - 0.09, cx + 0.09, 1.05, 1.056, gz + 0.45, gz + 0.75, hex('#4FA3FF'), { ao: false });
    G.box(cx, 0.85, gz + 0.86, 0.12, 0.1, 0.01, hex('#3DDC84'));
  }
  P.slab(-7, 7, 2.75, 2.85, gz - 0.1, gz + 0.1, hex('#B7BEC4'), { ao: false }); for (const x of [-7, 7]) P.slab(x - 0.08, x + 0.08, 0, 2.85, gz - 0.08, gz + 0.08, hex('#B7BEC4'), { ao: false });
  k.sign(0, 3.25, gz + 0.02, { kind: 'custom', key: 'gzeGate', paint: paintGateLed, w: 9, h: 0.75, face: 0 });
  const flapG = new Geo(); flapG.rbox(0, -0.3, 0, 0.5, 0.6, 0.03, hex('#E9EEF2'), 0.12, 0, { ao: false, bottom: true }); flapG.box(-0.03, 0.0, 0, 0.44, 0.04, 0.035, hex('#D52B1E'), 0, 0, 0, 1, { ao: false });
  const flapSrc = flapG.toMesh('gzeFlap', k.scene, k.M.paint, k.root); flapSrc.isVisible = false;
  for (const lx of lanes) {
    const flaps = [-1, 1].map(sd => { const pv = new BABYLON.TransformNode('gfp', k.scene); pv.parent = k.root; pv.position.set(lx + sd * 0.6, 0.75, gz); const f = flapSrc.createInstance('gzeFlap'); f.parent = pv; f.position.x = -sd * 0.25; return { pv, sd }; });
    const col = k.col(lx, 0.8, gz, 1.2, 1.6, 0.25);
    out.gates.push({ x: lx, z: gz, f: 0, open: false, flaps, col, t: 0 });
  }
  /* ===== 站台 + 雨棚 + 黄色安全线 ===== */
  const xw = GZE.xw, xe = GZE.xe;
  k.g('pave').slab(xw, xe, -1.25, 0, hz1 - 0.3, edge, C.plat, { ao: false }); k.colSlab(xw, xe, -1.3, 0, edge, hz1);
  P.slab(xw, xe, 0.002, 0.01, edge, edge + 0.3, C.edge, { ao: false });
  k.g('tactile').slab(xw, xe, 0.002, 0.014, edge + 0.75, edge + 1.05, hex('#F2C230'), { ao: false });
  for (let x = xw + 4; x < xe; x += 12) { P.cyl(x, 3.3, -121.2, 0.5, 6.6, C.col, 12); k.col(x, 3.3, -121.2, 0.5, 6.6, 0.5); }
  P.slab(xw, xe, 6.6, 6.9, hz1 - 0.3, -134.5, C.roof); P.slab(xw, xe, 6.3, 6.9, -134.5, -134.2, hex('#B9BEC4'));
  for (const z of [-119, -124, -129.75]) G.slab(xw, xe, 6.56, 6.6, z - 0.2, z + 0.2, hex('#FFF6E2'), { ao: false });
  k.sign(6, 3.2, -121.0, { kind: 'plain', w: 3.4, h: 0.95, bg: '#1F4E9C', fg: '#FFFFFF', zh: '广州东', en: 'Guangzhoudong', face: 0, align: 'center', double: true, hang: 6.6 });
  k.sign(-18, 3.2, -121.0, { kind: 'plain', w: 3.4, h: 0.95, bg: '#1F4E9C', fg: '#FFFFFF', zh: '5 站台', en: 'Platform 5', face: 0, align: 'center', double: true, hang: 6.6 });
  // 轨道：道床、轨枕、钢轨；对面挡土墙 + 绿栏杆
  P.slab(xw, xe, -1.4, -1.3, edge, GZE.zs, C.bed, { ao: false }); k.colSlab(xw, xe, -2, -1.3, GZE.zs, edge);
  P.slab(xw, xe, -1.3, -0.02, edge - 0.05, edge, hex('#B5B1A9'), { ao: false });
  for (let x = xw + 0.3; x < xe; x += 0.65) P.box(x, -1.25, tz, 0.24, 0.1, 2.6, C.sleeper, 0, 0, 0, 1, { ao: false });
  for (const s of [-1, 1]) M.slab(xw, xe, -1.2, -1.08, tz + s * 0.717 - 0.04, tz + s * 0.717 + 0.04, C.rail, { ao: false });
  P.slab(xw, xe, -1.4, 2.2, GZE.zs - 0.5, GZE.zs, C.wall); k.colSlab(xw, xe, -2, 8, GZE.zs - 1.5, GZE.zs);
  for (let x = xw; x < xe; x += 2.5) M.box(x, 2.8, GZE.zs - 0.25, 0.06, 1.2, 0.06, hex('#3E6B4E'), 0, 0, 0, 1, { ao: false });
  M.slab(xw, xe, 3.35, 3.42, GZE.zs - 0.3, GZE.zs - 0.2, hex('#3E6B4E'), { ao: false });
  // 站台东头（车头前面）没有车挡着的地方：站台边一道看不见的挡板，不会掉下去
  k.colSlab(26.5, xe, 0, 1.4, edge - 0.25, edge);
  buildEmuTrain(k, (x, y, z, w, h, zh, fg) => k.sign(x, y, z, { kind: 'plain', w, h, bg: '#F4F5F3', fg, zh, face: 0, align: 'center', box: false }));
  return out;
}
/**
 * 停在站台边的复兴号（车头 + 5 号车厢（门开着）+ 后一节），站台坐标系：轨道中心 z = GZE.tz、站台边 GZE.edge、车厢中心 x = EMU.xc。
 * 广州东站和厦门北站共用（厦门北站的 Kit 整体平移到别处）；label(x, y, z, w, h, zh, fg) 画车身上的小字牌。
 */
export function buildEmuTrain(k, label) {
  const P = k.solid, G = k.glow, M = k.metal, { edge, tz } = GZE;
  /* ===== 复兴号（白色、红腰线、流线型车头）：3 号… 这里只做三节：车头 + 5 号车厢（门开着）+ 后一节 ===== */
  const Bd = k.g('paint');
  const cars = [[-60, -30.2], [-29.7, -4.3], [-3.8, 15]];
  for (const [a, b] of cars) carBody(Bd, a, b, EMU.doors.filter(d => d.x > a && d.x < b).map(d => [d.x - 0.5, d.x + 0.5]));
  nose(Bd, 15, 11.6);
  for (const x of [-29.95, -4.05]) P.box(x, 1.0, tz, 0.5, 3.2, 2.9, C.dark, 0, 0, 0, 1, { ao: false });   // 车厢连接处的风挡
  // 转向架（车底深灰 + 车轮）
  for (const [a, b] of cars) for (const xb of [a + 3, b - 3]) {
    P.box(xb, -1.0, tz, 2.8, 0.36, 2.4, hex('#2E3236'), 0, 0, 0, 1, { ao: false });
    for (const dx of [-1.25, 1.25]) for (const s of [-1, 1]) P.cyl(xb + dx, -1.0, tz + s * 0.72, 0.9, 0.12, hex('#3A3D40'), 12, 0, Math.PI / 2, 0);
  }
  // 车顶：受电弓（5 号车厢）+ 设备罩
  P.rbox(-17, 2.84, tz, 3.2, 0.3, 1.6, hex('#D9DBD8'), 0.12, 0, { ao: false });
  M.tube([-18.2, 3.15, tz], [-17.0, 4.1, tz], 0.06, hex('#5A5F64'), 6); M.tube([-17.0, 4.1, tz], [-16.0, 3.3, tz], 0.06, hex('#5A5F64'), 6); M.slab(-17.3, -16.7, 4.08, 4.14, tz - 0.8, tz + 0.8, hex('#5A5F64'), { ao: false });
  // 站台一侧的车窗（深色窗带上用白色窗间柱隔开）、车门
  const zf = tz + 1.705;
  const doorsAt = [[-58, -32, -60], [-28.2, -5.8], [-1.6, 12.5]];   // 每节车两头各一扇门（5 号车厢的开着）
  for (const [a, b] of cars) for (let x = a + 2.6; x < Math.min(b, 15.5) - 2.4; x += 1.25) if (!EMU.doors.some(d => Math.abs(x - d.x) < 0.75)) P.box(x, 1.26, zf, 0.2, 0.78, 0.02, C.body, 0, 0, 0, 1, { ao: false });
  doorsAt.forEach(([d1, d2]) => {
    for (const dx of [d1, d2]) {
      const open = EMU.doors.some(d => d.x === dx);
      if (open) {
        // 真的门洞（车身放样在这里挖开，见 carBody）：门框往里收一点，门里是门厅——站台上就看得到车厢里面
        const zi = zf - 0.16, zb = tz - 1.55, xa = dx - 1.6, xb = dx + 1.3;   // 门框内沿、门厅对面墙、门厅两头（客室端墙 / 车厢端）
        for (const sx of [-1, 1]) P.slab(dx + sx * 0.5 - 0.035, dx + sx * 0.5 + 0.035, 0, 2.05, zi, zf + 0.02, hex('#B8BEC4'), { ao: false });   // 门框（侧）
        P.slab(dx - 0.535, dx + 0.535, 2.0, 2.16, zi, zf + 0.02, hex('#B8BEC4'), { ao: false });                                                  // 门框（上）
        P.slab(dx - 0.5, dx + 0.5, -0.95, 0.0, zi, zf - 0.01, C.body, { ao: false });                                                             // 门槛下的车身裙板
        P.slab(dx - 0.5, dx + 0.5, -0.03, 0.005, zi, edge, hex('#9AA0A6'), { ao: false });                                                       // 踏板（伸到站台边）
        P.slab(dx - 0.5, dx + 0.5, -0.03, 0.005, edge, edge + 0.0, hex('#9AA0A6'), { ao: false });
        P.box(dx - 0.98, 1.0, zf + 0.04, 0.96, 1.98, 0.04, C.body, 0, 0, 0, 1, { ao: false });                                                   // 门扇往外塞拉滑开（滑向车尾一侧）
        // 门厅：地板、天花（灯）、对面墙 + 关着的车门、客室端墙（玻璃门开着，看得到座椅）、车厢端墙；外面车身挡着，只在门洞里看得到
        P.slab(xa, xb, -0.06, 0.0, zb, zi, hex('#8D939A'), { ao: false });
        P.slab(xa, xb, 2.32, 2.36, zb, zi, hex('#F4F5F5'), { ao: false }); G.slab(dx - 0.6, dx + 0.6, 2.3, 2.32, zb + 0.6, zi - 0.4, hex('#FFFFFF'));
        P.slab(xa, xb, 0, 2.32, zb - 0.05, zb, hex('#DADDE0'), { ao: false });
        P.slab(dx - 0.5, dx + 0.5, 0, 2.0, zb, zb + 0.01, hex('#E3E6E8'), { ao: false }); P.slab(dx - 0.2, dx + 0.2, 1.1, 1.7, zb + 0.01, zb + 0.015, hex('#59636D'), { ao: false });
        for (const sx of [-1, 1]) P.tube([dx + sx * 0.62, 0.9, zi - 0.06], [dx + sx * 0.62, 1.8, zi - 0.06], 0.035, hex('#C9CDD0'), 6);
        P.slab(xb, xb + 0.05, 0, 2.32, zb, zi, hex('#DADDE0'), { ao: false });
        const za = tz + 0.25 - 0.41, zc = tz + 0.25 + 0.41;   // 客室端门（过道）
        P.slab(xa - 0.05, xa, 0, 2.32, zb, za, hex('#ECEEEF'), { ao: false }); P.slab(xa - 0.05, xa, 0, 2.32, zc, zi, hex('#ECEEEF'), { ao: false }); P.slab(xa - 0.05, xa, 2.0, 2.32, za, zc, hex('#ECEEEF'), { ao: false });
        P.slab(xa - 3.5, xa - 0.05, -0.06, 0.0, zb, zi, hex('#8D939A'), { ao: false }); P.slab(xa - 3.5, xa - 0.05, 2.32, 2.36, zb, zi, hex('#F4F5F5'), { ao: false });
        for (let r = 0; r < 3; r++) for (const [z0, z1] of [[-1.5, -0.16], [0.66, 1.5]]) {   // 端门里面看得到的头两三排座椅（简化）
          const xs = xa - 0.95 - r * 1.0;
          P.slab(xs, xs + 0.46, 0.34, 0.47, tz + z0, tz + z1, hex('#566C80'), { ao: false }); P.slab(xs - 0.06, xs + 0.06, 0.46, 1.1, tz + z0, tz + z1, hex('#4A5E71'), { ao: false });
        }
        for (const z of [zb - 0.05, zi]) P.slab(xa - 3.5, xa - 0.05, 0, 2.32, Math.min(z, z + 0.05), Math.max(z, z + 0.05), hex('#DADDE0'), { ao: false });   // 客室两侧墙（只在端门里看得到一点）
        P.slab(xa - 3.55, xa - 3.5, 0, 2.32, zb, zi, hex('#DADDE0'), { ao: false });
        G.slab(xa - 3.5, xa - 0.1, 2.3, 2.32, tz - 0.7, tz - 0.5, hex('#FFFFFF')); G.slab(xa - 3.5, xa - 0.1, 2.3, 2.32, tz + 0.5, tz + 0.7, hex('#FFFFFF'));
      } else {
        for (const sx of [-1, 1]) P.box(dx + sx * 0.5, 1.0, zf + 0.004, 0.03, 2.0, 0.02, hex('#9AA1A8'), 0, 0, 0, 1, { ao: false });
        P.box(dx, 2.0, zf + 0.004, 1.03, 0.03, 0.02, hex('#9AA1A8'), 0, 0, 0, 1, { ao: false });
        P.box(dx, 1.4, zf + 0.004, 0.42, 0.6, 0.02, C.win, 0, 0, 0, 1, { ao: false });
      }
    }
  });
  label(6, 0.24, zf + 0.012, 1.9, 0.4, '复兴号', '#D3121A');
  label(-17, 0.24, zf + 0.012, 1.5, 0.36, '05 二等座', '#3A3F45');
  // 车身碰撞（5 号车厢两扇门处留口，口里面一块“门后墙”）
  const zc0 = tz - 1.72, zc1 = edge;
  const segs = [[-60, -6.35], [-5.25, 16]];   // 只有 5 号车厢东头那扇门开着
  for (const [a, b] of segs) k.colSlab(a, b, -1.3, 3.2, zc0, zc1);
  for (const d of EMU.doors) for (const sx of [-1, 1]) k.colSlab(d.x + sx * 0.5 - 0.04, d.x + sx * 0.5 + 0.04, -1.3, 3.2, edge - 0.2, edge);
  for (const d of EMU.doors) { k.colSlab(d.x - 0.55, d.x + 0.55, -1.3, 3.2, zc0, edge - 0.7); k.colSlab(d.x - 0.55, d.x + 0.55, -1.3, 0, edge - 0.7, edge); }
  k.colSlab(16, 26.5, -1.3, 1.8, tz - 1.3, tz + 1.3);
}
/** 闸机：走近（任意一边）就开，走过去关上 */
export function updateGze(o, dt, player, Audio) {
  const p = player.position;
  for (const g of o.gates) {
    const near = Math.abs(p.x - g.x) < 0.8 && Math.abs(p.z - g.z) < 1.6 && p.y < 2;
    if (near && g.t < 0.6) { if (!g.open) g.beep = true; g.t = 0.8; }
    if (g.t > 0 && Math.abs(p.x - g.x) < 0.8 && Math.abs(p.z - g.z) < 1.0) g.t = Math.max(g.t, 0.6);
    g.t -= dt;
    const want = g.t > 0;
    if (want && !g.open) { g.open = true; if (Audio && g.beep) { Audio.sfx('gateBeep'); setTimeout(() => Audio.sfx('gateOpen', { volume: 0.7 }), 120); } g.beep = false; }
    if (!want && g.open) g.open = false;
    g.f += ((g.open ? 1 : 0) - g.f) * Math.min(1, dt * 9);
    g.flaps.forEach(fl => { fl.pv.rotation.y = fl.sd * g.f * Math.PI / 2; });
    g.col.checkCollisions = g.f < 0.6;
  }
}
