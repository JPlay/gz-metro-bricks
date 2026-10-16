/*
 * 陈家祠 头进（室内，独立场景）：从陈家祠站 C 出口外的大门走进来才加载，出门就关掉。
 *   - 放在 CO = (1600, 0, 0)（x > 400 → zone 'hall'：街面 / 站内都关掉，没有车站广播）；
 *   - 五开间的头门厅：花岗石地面、两排木柱、金漆木雕梁架（雕花画在图集上）、大门后面的屏门（四扇金漆木雕屏风）；
 *   - 后面是天井（花岗石 + 两边连廊）和聚贤堂正面（只做立面，不能进去）；天空用一块发光的蓝色天花代替；
 *   - 两个展柜（广东民间工艺：广彩瓷、陶塑），没有任务 / 引导条。
 *   - 回到大门（z < 0.7）就出门，站在门廊里。
 */
import { Kit } from '../world/kit.js';
import { hex } from '../core/geo.js';
import { FoodAtlas } from './food-art.js';
import { CJC_DOOR, paintCeramicRidge, paintPlaster } from '../world/cjc.js';

export const CO = { x: 1600, z: 0 };
const X = x => CO.x + x;
const C = {
  floor: hex('#C9C4B8'), floor2: hex('#BDB7AA'), brick: hex('#8C9395'), wood: hex('#5A3524'), wood2: hex('#43281B'), gold: hex('#D4A84A'),
  plaster: hex('#E9E4D8'), granite: hex('#CFCBC2'), tile: hex('#5F6E62'), red: hex('#8E2A1E'), glass: hex('#DDEFF5')
};
/** 金漆木雕（梁 / 屏门）：深底 + 金色卷草、人物剪影 */
function paintCarving(c, pw, ph, s = 1) {
  c.fillStyle = '#3B2216'; c.fillRect(0, 0, pw, ph);
  const g = c.createLinearGradient(0, 0, 0, ph); g.addColorStop(0, '#F2D07A'); g.addColorStop(1, '#B8862E'); c.strokeStyle = g; c.fillStyle = g;
  c.lineWidth = Math.max(2, ph * 0.04); c.strokeRect(ph * 0.05, ph * 0.05, pw - ph * 0.1, ph - ph * 0.1);
  const n = Math.max(1, Math.round(pw / ph)), cw = pw / n;
  for (let i = 0; i < n; i++) {
    const x = i * cw + cw / 2, y = ph / 2, r = Math.min(cw, ph) * 0.32;
    c.beginPath(); for (let k = 0; k < 24; k++) { const a = k / 24 * Math.PI * 4, rr = r * (0.3 + 0.7 * k / 24); c.lineTo(x + Math.cos(a + i + s) * rr, y + Math.sin(a + i + s) * rr * 0.8); } c.stroke();
    if ((i + s) % 2) { c.beginPath(); c.arc(x, y - r * 0.4, r * 0.18, 0, Math.PI * 2); c.fill(); c.fillRect(x - r * 0.15, y - r * 0.2, r * 0.3, r * 0.6); }
  }
}
/** 屏门：一扇高木门，上半格心（冰裂 / 方格）、中间绦环板（木雕）、下半裙板 */
function paintScreen(c, pw, ph, s = 1) {
  c.fillStyle = '#4A2A1A'; c.fillRect(0, 0, pw, ph);
  c.strokeStyle = '#C99A3E'; c.lineWidth = Math.max(2, pw * 0.03);
  const m = pw * 0.08; c.strokeRect(m, m, pw - 2 * m, ph - 2 * m);
  const y1 = ph * 0.6; c.strokeRect(m * 1.6, m * 1.6, pw - m * 3.2, y1 - m * 2.2);
  for (let i = 1; i < 5; i++) { const x = m * 1.6 + (pw - m * 3.2) * i / 5; c.beginPath(); c.moveTo(x, m * 1.6); c.lineTo(x, y1 - m * 0.6); c.stroke(); }
  for (let j = 1; j < 9; j++) { const y = m * 1.6 + (y1 - m * 2.2) * j / 9; c.beginPath(); c.moveTo(m * 1.6, y); c.lineTo(pw - m * 1.6, y); c.stroke(); }
  c.save(); c.translate(m * 1.6, y1 + m * 0.2); paintCarving(c, pw - m * 3.2, ph * 0.12, s); c.restore();
  c.save(); c.translate(m * 1.6, ph * 0.76); paintCarving(c, pw - m * 3.2, ph * 0.18, s + 1); c.restore();
}
function paintSky(c, pw, ph) { const g = c.createLinearGradient(0, 0, 0, ph); g.addColorStop(0, '#8FC3EA'); g.addColorStop(1, '#D8ECF8'); c.fillStyle = g; c.fillRect(0, 0, pw, ph); c.fillStyle = 'rgba(255,255,255,0.85)'; for (const [x, y, r] of [[0.2, 0.4, 0.1], [0.28, 0.38, 0.08], [0.7, 0.6, 0.12], [0.78, 0.58, 0.09]]) { c.beginPath(); c.arc(x * pw, y * ph, r * pw, 0, Math.PI * 2); c.fill(); } }
function paintCase(c, pw, ph, s) {   // 展柜里的东西：广彩瓷瓶 / 陶塑公仔
  c.fillStyle = '#5A1E1A'; c.fillRect(0, 0, pw, ph);
  const cols = s ? ['#C2412D', '#2E7D5B', '#E0A82E'] : ['#1F5FA0', '#C2412D', '#2E7D5B'];
  for (let i = 0; i < 3; i++) {
    const x = pw * (0.2 + i * 0.3), w = pw * 0.18, h = ph * (0.55 + (i % 2) * 0.2), y = ph * 0.92 - h;
    c.fillStyle = s ? '#F7F1E1' : cols[i]; c.beginPath(); c.moveTo(x - w * 0.25, y); c.quadraticCurveTo(x - w * 0.9, y + h * 0.55, x - w * 0.35, y + h); c.lineTo(x + w * 0.35, y + h); c.quadraticCurveTo(x + w * 0.9, y + h * 0.55, x + w * 0.25, y); c.closePath(); c.fill();
    c.fillStyle = cols[(i + 1) % 3]; c.fillRect(x - w * 0.42, y + h * 0.42, w * 0.84, h * 0.12);
    c.fillStyle = '#D4A84A'; c.fillRect(x - w * 0.3, y, w * 0.6, h * 0.05);
  }
  c.fillStyle = '#E8C26A'; c.font = `700 ${ph * 0.1}px sans-serif`; c.textAlign = 'center'; c.textBaseline = 'top'; c.fillText(s ? '石湾陶塑' : '广彩瓷器 · 石湾陶塑', pw / 2, ph * 0.03);
}

export class ClanInterior {
  constructor(scene, M) {
    this.scene = scene; this.M = M; this.seats = [];
    const k = this.kit = new Kit(scene, 'cjc-int'), atlas = this.atlas = new FoodAtlas(scene, 1024);
    this.build(k, atlas);
    k.finish(); atlas.finish(k.root, 'cjcSigns');
    { const g = k.byBucket['glass@case']; if (g && g.material) { const m = g.material; m.alpha = 0.07; m.environmentIntensity = 0.35; m.useRadianceOverAlpha = false; m.useSpecularOverAlpha = false; m.albedoColor = new BABYLON.Color3(0.9, 0.95, 1); } }
    this.spawn = { x: X(0), y: 0.05, z: 1.4, yaw: 0 };
    this.kit.root.setEnabled(false); this.active = false;
  }
  build(k, atlas) {
    const P = k.solid, G = k.glow, W = 8.4, D = 9.6, H = 7.6;   // 头进：x ±W，z 0..D，梁底 ~5.6，脊 7.6
    // 图集里每种花样只画一次，多处复用（屏门 / 雕梁）
    const uvScreen = atlas.draw(1, 4, (c, pw, ph) => paintScreen(c, pw, ph, 1), 64), uvScreen2 = atlas.draw(1, 4, (c, pw, ph) => paintScreen(c, pw, ph, 2), 64);
    const uvBeam = atlas.draw(16, 0.6, (c, pw, ph) => paintCarving(c, pw, ph, 1), 60), uvBeam2 = atlas.draw(8, 0.3, (c, pw, ph) => paintCarving(c, pw, ph, 4), 60);
    const Q = (x, y, z, w, h, a, uv) => atlas.quad(x, y, z, w, h, a, uv);
    // 地面：大块花岗石
    for (let x = -W; x < W; x += 1.2) for (let z = 0; z < D; z += 1.2) P.slab(X(x), X(Math.min(W, x + 1.2)), -0.1, 0, z, Math.min(D, z + 1.2), ((x / 1.2 + z / 1.2) | 0) % 2 ? C.floor : C.floor2, { ao: false });
    k.colSlab(X(-W - 1), X(W + 1), -0.6, 0, -1, D + 9);
    const wall = (x0, x1, y0, y1, z0, z1, col = C.brick) => { P.slab(X(x0), X(x1), y0, y1, z0, z1, col, { ao: false }); k.colSlab(X(x0), X(x1), y0, y1, z0, z1); };
    // 前墙（大门开口 ±1.5，门扇向里开）+ 两侧山墙
    wall(-W, -1.5, 0, H - 1.6, -0.4, 0); wall(1.5, W, 0, H - 1.6, -0.4, 0); P.slab(X(-1.5), X(1.5), 4.6, H - 1.6, -0.4, 0, C.brick, { ao: false });
    G.slab(X(-1.5), X(1.5), 0, 4.6, -0.42, -0.4, hex('#FFF4DE'));   // 门外的亮（门廊和街）
    for (const s of [-1, 1]) { P.box(X(s * 1.55 + s * 0.08), 2.3, 0.75, 0.12, 4.6, 1.5, C.wood2, s * 0.15); }   // 两扇黑门向里开着
    { const Qz = k.g('qz'), bc = hex('#7D8A94');   // 两侧山墙：青砖 + 木构架（贴墙半柱、上下两道枋、墙裙花岗石）
      for (const [a, b, f] of [[-W - 0.4, -W, 1], [W, W + 0.4, -1]]) {
        Qz.slab(X(a), X(b), 0.6, H - 1.6, -0.4, D, bc, { ao: false }); k.colSlab(X(a), X(b), 0, H - 1.6, -0.4, D);
        const xi = f > 0 ? b : a;
        P.slab(X(xi - 0.03 * f), X(xi + 0.05 * f), 0, 0.6, -0.4, D, C.granite, { ao: false });
        for (const z of [0.2, 2.8, 6.8, D - 0.2]) P.slab(X(xi), X(xi + 0.16 * f), 0, 5.6, z - 0.16, z + 0.16, C.wood, { ao: false });
        for (const y of [2.9, 5.4]) P.slab(X(xi), X(xi + 0.1 * f), y - 0.1, y + 0.1, -0.4, D, C.wood, { ao: false });
      }
    }
    // 两排木柱（金柱）
    for (const z of [2.8, 6.8]) for (const x of [-6.2, -2.0, 2.0, 6.2]) { P.cyl(X(x), 2.8, z, 0.46, 5.6, C.wood, 12); P.cyl(X(x), 0.15, z, 0.66, 0.3, C.granite, 12); k.col(X(x), 2.8, z, 0.5, 5.6, 0.5); }
    // 梁架：每排柱上一道大梁 + 金漆木雕梁板 + 瓜柱 + 二梁；纵向檩条
    for (const z of [2.8, 6.8]) {
      P.slab(X(-W), X(W), 5.6, 6.0, z - 0.22, z + 0.22, C.wood, { ao: false });
      Q(X(0), 5.25, z - 0.25, 2 * W - 0.4, 0.62, Math.PI, uvBeam); Q(X(0), 5.25, z + 0.25, 2 * W - 0.4, 0.62, 0, uvBeam);
      for (const x of [-4.1, 0, 4.1]) { P.box(X(x), 6.35, z, 0.3, 0.7, 0.3, C.wood2); P.box(X(x), 6.75, z, 2.6, 0.22, 0.34, C.wood); }
      // 挂落：大梁下每个开间一道金漆通花木雕横楣（前后两面）
      for (const [xa, xb] of [[-W, -6.2], [-6.2, -2.0], [-2.0, 2.0], [2.0, 6.2], [6.2, W]]) {
        const w = xb - xa - 0.5, xm = (xa + xb) / 2;
        P.slab(X(xm - w / 2), X(xm + w / 2), 4.48, 4.56, z - 0.06, z + 0.06, C.wood, { ao: false });
        Q(X(xm), 4.78, z - 0.07, w, 0.42, Math.PI, uvBeam2); Q(X(xm), 4.78, z + 0.07, w, 0.42, 0, uvBeam2);
      }
    }
    for (let z = -0.2; z <= D + 0.2; z += 0.8) P.slab(X(-W), X(W), 6.9 + 0.4 * Math.sin(Math.PI * z / D), 7.02 + 0.4 * Math.sin(Math.PI * z / D), z - 0.06, z + 0.06, C.wood2, { ao: false });
    // 屋面内侧（两坡，深色椽望）
    for (const s of [-1, 1]) { const zm = D / 2 + s * D / 4, a = Math.atan2(1.6, D / 2); P.box(X(0), H - 0.8 + 0.1, zm, 2 * W + 0.8, 0.12, D / 2 / Math.cos(a) + 0.3, hex('#3A2418'), 0, s * a, 0, 1, { ao: false }); }
    // 屏门：大门后面一排四扇（中间两扇、两边各一扇有空可以绕过去）
    const SZ = 6.35;   // 屏门退到后排金柱前（从大门口看过去，整排屏门 + 上面的梁和挂落都在画面里）
    for (const [x, w] of [[-0.9, 0.9], [0.9, 0.9], [-3.6, 1.1], [3.6, 1.1]]) {
      P.slab(X(x - w / 2), X(x + w / 2), 0, 4.2, SZ, SZ + 0.1, C.wood2, { ao: false }); k.colSlab(X(x - w / 2), X(x + w / 2), 0, 4.2, SZ - 0.1, SZ + 0.2);
      Q(X(x), 2.1, SZ - 0.01, w - 0.04, 4.2, Math.PI, Math.abs(x) < 2 ? uvScreen : uvScreen2); Q(X(x), 2.1, SZ + 0.11, w - 0.04, 4.2, 0, uvScreen2);
    }
    P.slab(X(-4.2), X(4.2), 4.2, 4.5, SZ - 0.05, SZ + 0.15, C.wood, { ao: false }); Q(X(0), 4.35, SZ - 0.07, 8.2, 0.26, Math.PI, uvBeam2);
    // 后檐：一排金漆木雕挂落 + 檐柱，下面就是天井
    for (const x of [-6.2, -2.0, 2.0, 6.2]) { P.cyl(X(x), 2.6, D - 0.2, 0.34, 5.2, C.wood, 10); k.col(X(x), 2.6, D - 0.2, 0.38, 5.2, 0.38); }
    Q(X(0), 4.85, D - 0.36, 2 * W - 0.5, 0.7, Math.PI, uvBeam);
    P.slab(X(-W), X(W), 5.2, 5.5, D - 0.5, D + 0.6, C.wood, { ao: false });
    // 天井：花岗石、两边连廊（矮墙 + 柱）、聚贤堂正面（不能进：一排落地木格门）
    const TZ = D + 6.4;
    for (let x = -W; x < W; x += 1.6) P.slab(X(x), X(x + 1.6), -0.05, 0.02, D, TZ, ((x / 1.6) | 0) % 2 ? C.granite : C.floor, { ao: false });
    for (const s of [-1, 1]) { wall(s * W - (s > 0 ? 0 : 0.4), s * W + (s > 0 ? 0.4 : 0), 0, 5.2, D, TZ); for (let z = D + 1.5; z < TZ - 0.5; z += 2.2) P.cyl(X(s * (W - 1.4)), 1.9, z, 0.3, 3.8, C.wood, 8); P.slab(X(s > 0 ? W - 2.0 : -W), X(s > 0 ? W : -W + 2.0), 3.8, 4.0, D, TZ, C.wood2, { ao: false }); }
    wall(-W, W, 0, 0.6, TZ, TZ + 0.6, C.granite);   // 聚贤堂台基（挡住）
    P.slab(X(-W), X(W), 0.6, 6.4, TZ + 0.6, TZ + 0.9, C.wood2, { ao: false }); k.colSlab(X(-W), X(W), 0, 6.4, TZ + 0.3, TZ + 0.9);
    for (let i = 0; i < 10; i++) { const x = -W + 0.85 + i * (2 * W - 1.7) / 9; Q(X(x), 3.2, TZ + 0.58, 1.5, 5.0, Math.PI, i % 2 ? uvScreen : uvScreen2); }
    P.slab(X(-W - 0.5), X(W + 0.5), 6.4, 6.8, TZ - 0.4, TZ + 1.0, hex('#4E5C51'), { ao: false });
    P.box(X(0), 7.6, TZ + 1.4, 2 * W + 1, 0.2, 3.2, C.tile, 0, -0.55, 0, 1, { ao: false });
    Q(X(0), 9.1, TZ + 2.4, 2 * W - 1, 1.4, Math.PI, atlas.draw(2 * W - 1, 1.4, (c, pw, ph) => paintCeramicRidge(c, pw, ph, 7), 62));
    Q(X(0), 6.6, TZ - 0.42, 2 * W - 0.6, 0.38, Math.PI, atlas.draw(2 * W - 0.6, 0.38, (c, pw, ph) => paintPlaster(c, pw, ph, 6), 60));
    // 天：一大块发光的蓝天（天井上方）
    Q(X(0), 11.5, TZ + 3.9, 2 * W + 8, 14, Math.PI, atlas.draw(2 * W + 8, 14, paintSky, 6));
    const sky = G.slab(X(-W - 1), X(W + 1), 12.0, 12.05, D + 0.6, TZ + 4, hex('#BFE0F6'));
    void sky;
    // 展柜（左右各一个，靠山墙）+ 说明牌
    for (const s of [-1, 1]) {
      const x = s * (W - 0.9), z = 5.0;
      P.slab(X(x - 0.6), X(x + 0.6), 0, 0.8, z - 1.2, z + 1.2, C.wood2, { aoTop: true }); k.colSlab(X(x - 0.6), X(x + 0.6), 0, 1.8, z - 1.2, z + 1.2);
      atlas.sign(X(x + s * 0.56), 1.27, z, 2.3, 0.9, s > 0 ? -Math.PI / 2 : Math.PI / 2, (c, pw, ph) => paintCase(c, pw, ph, s > 0 ? 1 : 0));
      // 玻璃：几乎透明（单独的 glass@case 材质，finish 后调 alpha），细铜框；顶上深木盖板 + 下面暖色小射灯
      const Gc = k.g('glass@case'), F = hex('#B08A4A'), y0 = 0.8, y1 = 1.75;
      Gc.slab(X(x - 0.6), X(x + 0.6), y0, y1, z - 1.2, z + 1.2, C.glass);
      for (const [xx, zz] of [[-0.6, -1.2], [0.6, -1.2], [-0.6, 1.2], [0.6, 1.2]]) P.box(X(x + xx), (y0 + y1) / 2, z + zz, 0.035, y1 - y0, 0.035, F, 0, 0, 0, 1, { ao: false });
      for (const yy of [y0 + 0.01, y1]) { P.slab(X(x - 0.62), X(x + 0.62), yy - 0.02, yy + 0.02, z - 1.22, z - 1.18, F, { ao: false }); P.slab(X(x - 0.62), X(x + 0.62), yy - 0.02, yy + 0.02, z + 1.18, z + 1.22, F, { ao: false });
        P.slab(X(x - 0.62), X(x - 0.58), yy - 0.02, yy + 0.02, z - 1.2, z + 1.2, F, { ao: false }); P.slab(X(x + 0.58), X(x + 0.62), yy - 0.02, yy + 0.02, z - 1.2, z + 1.2, F, { ao: false }); }
      P.slab(X(x - 0.64), X(x + 0.64), y1 + 0.02, y1 + 0.1, z - 1.24, z + 1.24, C.wood2, { ao: false });
      P.slab(X(x - 0.58), X(x + 0.58), y0, y0 + 0.02, z - 1.18, z + 1.18, hex('#6E1F1A'), { ao: false });   // 深红绒垫
      // 暖色射灯：盖板下几个小灯头 + 物件脚下一圈暖光斑
      for (const dz of s > 0 ? [-0.75, 0, 0.75] : [-0.78, 0, 0.78]) {
        G.cyl(X(x), y1 - 0.02, z + dz, 0.09, 0.03, hex('#FFD38A'), 8);
        G.cyl(X(x), y0 + 0.025, z + dz, s > 0 || dz ? 0.3 : 0.62, 0.004, hex('#B5652E'), 16);
      }
      if (s < 0) {   // 广彩：一个大花瓶（白底，红 / 金 / 绿开光纹饰），明显比公仔大
        const vz = z, wh = hex('#F5F1E6'), R = hex('#C8452E'), Gd = hex('#D4A84A'), Gr = hex('#2E7D5B');
        P.cyl(X(x), y0 + 0.06, vz, 0.24, 0.08, Gd, 14, 0, 0, 0, 0.2);
        P.cyl(X(x), y0 + 0.22, vz, 0.26, 0.24, wh, 14, 0, 0, 0, 0.46);
        P.sphere(X(x), y0 + 0.42, vz, 0.48, wh, 2, 0.75);
        P.cyl(X(x), y0 + 0.42, vz, 0.49, 0.1, R, 16); P.cyl(X(x), y0 + 0.34, vz, 0.46, 0.03, Gd, 16); P.cyl(X(x), y0 + 0.5, vz, 0.46, 0.03, Gd, 16);
        P.cyl(X(x), y0 + 0.62, vz, 0.3, 0.16, wh, 14, 0, 0, 0, 0.16); P.cyl(X(x), y0 + 0.62, vz, 0.24, 0.04, Gr, 14);
        P.cyl(X(x), y0 + 0.74, vz, 0.15, 0.1, wh, 12, 0, 0, 0, 0.2); P.cyl(X(x), y0 + 0.8, vz, 0.22, 0.03, Gd, 12);
        for (const [dz, c1, c2] of [[-0.78, '#8A5A34', '#2E7D5B'], [0.78, '#2E7D5B', '#E0A82E']]) {   // 旁边两个小石湾公仔，对比出瓶子有多大
          const fh = 0.22, zz = z + dz;
          P.cyl(X(x), y0 + 0.02 + fh * 0.33, zz, fh * 0.45, fh * 0.66, hex(c1), 8, 0, 0, 0, fh * 0.22);
          P.box(X(x), y0 + 0.02 + fh * 0.7, zz, fh * 0.36, fh * 0.12, fh * 0.2, hex(c2));
          P.sphere(X(x), y0 + 0.02 + fh * 0.86, zz, fh * 0.24, hex('#E9C9A0'), 1);
        }
      } else {       // 石湾陶塑：几个小公仔（褐 / 绿 / 蓝釉，0.2~0.26m 高）
        for (const [dz, c1, c2] of [[-0.8, '#8A5A34', '#2E7D5B'], [-0.35, '#2E7D5B', '#E0A82E'], [0.1, '#1F5FA0', '#8A5A34'], [0.5, '#7A4E2E', '#3BA3A0'], [0.85, '#2E7D5B', '#C2412D']]) {
          const fh = 0.2 + ((dz * 10) & 3) * 0.02, zz = z + dz;
          P.cyl(X(x), y0 + 0.02 + fh * 0.33, zz, fh * 0.45, fh * 0.66, hex(c1), 8, 0, 0, 0, fh * 0.22);
          P.box(X(x), y0 + 0.02 + fh * 0.7, zz, fh * 0.36, fh * 0.12, fh * 0.2, hex(c2));
          P.sphere(X(x), y0 + 0.02 + fh * 0.86, zz, fh * 0.24, hex('#E9C9A0'), 1);
        }
      }
    }
    atlas.sign(X(-5.0), 1.5, 0.02, 1.6, 1.0, 0, (c, pw, ph) => { c.fillStyle = '#3B2216'; c.fillRect(0, 0, pw, ph); c.fillStyle = '#E8C26A'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.font = `800 ${ph * 0.2}px sans-serif`; c.fillText('陈家祠 · 头进', pw / 2, ph * 0.25); c.fillStyle = '#F4EFE4'; c.font = `500 ${ph * 0.11}px sans-serif`; c.fillText('1894 年建成，岭南建筑“三雕两塑一铸”', pw / 2, ph * 0.52); c.fillText('木雕 石雕 砖雕 陶塑 灰塑 铁铸', pw / 2, ph * 0.72); });
    // 灯：梁下几盏宫灯（暖光）
    for (const x of [-4.1, 4.1]) for (const z of [2.8, 6.8]) { P.cyl(X(x), 4.9, z, 0.03, 0.6, C.wood2, 6); G.cyl(X(x), 4.35, z, 0.55, 0.65, hex('#FFC86E'), 8); P.cyl(X(x), 4.72, z, 0.62, 0.08, C.red, 8); P.cyl(X(x), 4.0, z, 0.62, 0.08, C.red, 8); }
  }
  setEnabled(v) { this.kit.root.setEnabled(v); this.active = v; }
  wantsExit(p) { return p.z < 0.55 && Math.abs(p.x - X(0)) < 1.4 && p.y < 1; }
  seatNear() { return null; }
  where(p) { return p.z > 9.6 ? 'courtyard' : 'hall'; }
  info() { return { active: this.active }; }
}

export class ClanCtl {
  constructor({ scene, M, player, hud, seats, Audio, events, getStation }) {
    Object.assign(this, { scene, M, player, hud, seats, Audio, events, getStation });
    this.interior = null; this.cur = null; this.count = { enter: 0 };
    const orig = seats.hall; seats.hall = () => (this.interior && this.interior.active ? this.interior : orig ? orig() : null);
  }
  enter(st) {
    if (!this.interior) this.interior = new ClanInterior(this.scene, this.M);
    const I = this.interior; I.setEnabled(true); st.kit.root.setEnabled(false);
    const s = I.spawn; this.player.spawn(s.x, s.y, s.z, s.yaw);
    this.cur = { st }; this.count.enter++;
    this.hud.toast('陈家祠 · 头进', 2000); this.Audio.blip && this.Audio.blip('tap');
    this.events.emit('clan', { enter: true });
  }
  exit() {
    const { st } = this.cur; if (this.player.seat) this.seats.stand();
    this.interior.setEnabled(false); this.cur = null;
    if (st === this.getStation()) { st.kit.root.setEnabled(true); this.player.spawn(CJC_DOOR.x, 0.5, CJC_DOOR.z - 1.3, Math.PI); }
    this.events.emit('clan', { enter: false });
  }
  update() {
    const st = this.getStation(), pl = this.player, p = pl.position;
    if (!this.cur) {
      if (this.interior && this.interior.active) this.interior.setEnabled(false);
      if (!st || !st.cjc || pl.seat || p.y < -1 || p.y > 2 || p.x > 400) return null;
      const D = CJC_DOOR; if (Math.abs(p.x - D.x) < D.half && p.z > D.z - 0.45 && p.z < D.z + 1) this.enter(st);
      return null;
    }
    if (st !== this.cur.st) { this.interior.setEnabled(false); this.cur = null; return null; }
    if (this.interior.wantsExit(p) && !pl.seat) this.exit();
    return null;
  }
  info() { return { inside: !!this.cur, where: this.cur ? this.interior.where(this.player.position) : null, count: this.count }; }
}
