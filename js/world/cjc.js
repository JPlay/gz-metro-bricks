/*
 * 陈家祠站 C 出口：陈家祠（陈氏书院，广东民间工艺博物馆）正立面。
 *   - 坐北朝南，正对中山七路（游戏里就是站口南边那条东西向马路）；站口东边整片给陈家祠。
 *   - 头门（中间五开间）：花岗石台基 + 四根石檐柱的门廊、黑漆大门 + 门神、石鼓、「陈氏书院」匾；
 *     硬山屋顶 + 屋脊上最出名的陶塑（石湾彩釉人物、亭台）一长条 + 屋檐下的灰塑横幅；
 *   - 两边偏门厅（矮一级、小一号陶塑脊）+ 山墙收头；后面露出聚贤堂的大屋顶和陶塑脊（只有轮廓）。
 *   - 室内只做头进（js/game/clan.js，独立场景，走进大门才加载）。
 * 只用 Kit 合并桶 + 一张招牌图集（陶塑 / 灰塑 / 门神都是画在图集上的），整片只多几次绘制。
 */
import { hex } from '../core/geo.js';
import { FONT } from './kit.js';

export const CJC = { cx: 39, fz: -58, x0: 24, x1: 54 };
/** 大门（门廊里，往北走进门 = 进头进） */
export const CJC_DOOR = { x: 39, z: -55.9, half: 1.5 };
const C = {
  brick: hex('#8C9395'), brick2: hex('#7D8486'), granite: hex('#CFCBC2'), granite2: hex('#B9B4A9'), tile: hex('#5F6E62'), tile2: hex('#4E5C51'),
  black: hex('#1E1B19'), wood: hex('#5A3524'), gold: hex('#D4A84A'), plaster: hex('#E9E4D8'), ridge: hex('#6B7A6E')
};
let seed = 11; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;

/** 陶塑屋脊（石湾彩釉）：一长条亭台楼阁 + 人物 + 花果，两头卷起的鳌鱼 */
export function paintCeramicRidge(c, pw, ph, s = 1) {
  seed = 11 + s * 101;
  const g = c.createLinearGradient(0, 0, 0, ph); g.addColorStop(0, '#9CC7D8'); g.addColorStop(1, '#BFDCE6'); c.fillStyle = g; c.fillRect(0, 0, pw, ph);
  const base = ph * 0.86; c.fillStyle = '#3F6B57'; c.fillRect(0, base, pw, ph - base);
  const glaze = ['#2E7D5B', '#1F5FA0', '#E0A82E', '#C2412D', '#F2EAD3', '#7A4E9A', '#3BA3A0'];
  // 亭台楼阁（每隔一段一座）
  for (let x = ph * 1.2; x < pw - ph * 1.2; x += ph * (1.6 + rnd() * 0.8)) {
    const w = ph * (0.55 + rnd() * 0.3), h = ph * (0.38 + rnd() * 0.22), y = base - h;
    c.fillStyle = '#C9B48A'; c.fillRect(x - w / 2, y, w, h);
    c.fillStyle = '#7A3B22'; for (let i = 0; i < 3; i++) c.fillRect(x - w / 2 + w * (0.12 + i * 0.32), y + h * 0.3, w * 0.12, h * 0.7);
    c.fillStyle = '#2E7D5B'; c.beginPath(); c.moveTo(x - w * 0.7, y + 2); c.quadraticCurveTo(x, y - h * 0.15, x + w * 0.7, y + 2); c.lineTo(x + w * 0.45, y - h * 0.35); c.lineTo(x - w * 0.45, y - h * 0.35); c.closePath(); c.fill();
    c.fillStyle = '#E0A82E'; c.fillRect(x - w * 0.05, y - h * 0.55, w * 0.1, h * 0.22);
  }
  // 人物（成排，戏曲故事）
  for (let x = ph * 0.9; x < pw - ph * 0.9; x += ph * (0.32 + rnd() * 0.18)) {
    const hgt = ph * (0.34 + rnd() * 0.16), y = base - hgt, col = glaze[(rnd() * glaze.length) | 0], col2 = glaze[(rnd() * glaze.length) | 0];
    c.fillStyle = col; c.beginPath(); c.moveTo(x - hgt * 0.22, base); c.lineTo(x + hgt * 0.22, base); c.lineTo(x + hgt * 0.12, y + hgt * 0.3); c.lineTo(x - hgt * 0.12, y + hgt * 0.3); c.closePath(); c.fill();
    c.fillStyle = col2; c.fillRect(x - hgt * 0.17, y + hgt * 0.3, hgt * 0.34, hgt * 0.12);
    c.fillStyle = '#F3D9B5'; c.beginPath(); c.arc(x, y + hgt * 0.2, hgt * 0.11, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#1E1B19'; c.fillRect(x - hgt * 0.11, y + hgt * 0.06, hgt * 0.22, hgt * 0.07);
    if (rnd() < 0.35) { c.strokeStyle = '#E0A82E'; c.lineWidth = Math.max(1, hgt * 0.04); c.beginPath(); c.moveTo(x + hgt * 0.15, y + hgt * 0.5); c.lineTo(x + hgt * 0.35, y - hgt * 0.05); c.stroke(); }
  }
  // 底座上的花果纹 + 两头卷起的鳌鱼
  for (let x = 4; x < pw; x += ph * 0.22) { c.fillStyle = glaze[((x / 7) | 0) % glaze.length]; c.beginPath(); c.arc(x, base + (ph - base) * 0.5, (ph - base) * 0.32, 0, Math.PI * 2); c.fill(); }
  for (const [x, d] of [[ph * 0.45, 1], [pw - ph * 0.45, -1]]) {
    c.fillStyle = '#2E7D5B'; c.beginPath(); c.moveTo(x - d * ph * 0.35, base); c.quadraticCurveTo(x - d * ph * 0.4, ph * 0.1, x + d * ph * 0.1, ph * 0.04); c.quadraticCurveTo(x + d * ph * 0.05, ph * 0.4, x + d * ph * 0.35, base); c.closePath(); c.fill();
    c.fillStyle = '#E0A82E'; c.beginPath(); c.arc(x, ph * 0.3, ph * 0.06, 0, Math.PI * 2); c.fill();
  }
}
/** 灰塑横幅（屋檐下 / 山墙头）：白底浅彩，山水花鸟 + 回纹边 */
export function paintPlaster(c, pw, ph, s = 1) {
  seed = 37 + s * 13;
  c.fillStyle = '#EDE8DC'; c.fillRect(0, 0, pw, ph);
  c.strokeStyle = '#4C7A8C'; c.lineWidth = ph * 0.06; c.strokeRect(ph * 0.05, ph * 0.05, pw - ph * 0.1, ph - ph * 0.1);
  const n = Math.max(2, Math.round(pw / (ph * 2.6)));
  for (let i = 0; i < n; i++) {
    const x0 = ph * 0.15 + i * (pw - ph * 0.3) / n, w = (pw - ph * 0.3) / n - ph * 0.1;
    c.fillStyle = '#F6F2E8'; c.fillRect(x0 + ph * 0.05, ph * 0.18, w, ph * 0.64);
    c.fillStyle = '#7FA7B5'; c.beginPath(); c.moveTo(x0 + ph * 0.05, ph * 0.82); for (let k = 0; k <= 6; k++) c.lineTo(x0 + ph * 0.05 + w * k / 6, ph * (0.5 + 0.25 * Math.abs(Math.sin(k * 1.3 + i)))); c.lineTo(x0 + ph * 0.05 + w, ph * 0.82); c.fill();
    c.fillStyle = '#5E8F5A'; for (let k = 0; k < 3; k++) { c.beginPath(); c.arc(x0 + w * (0.2 + rnd() * 0.6), ph * (0.42 + rnd() * 0.15), ph * 0.09, 0, Math.PI * 2); c.fill(); }
    c.fillStyle = '#C2412D'; c.beginPath(); c.arc(x0 + w * (0.3 + rnd() * 0.4), ph * 0.32, ph * 0.05, 0, Math.PI * 2); c.fill();
  }
}
/** 门神（秦琼 / 尉迟恭的意思：彩色武将，左右各一扇） */
function paintDoorGods(c, pw, ph) {
  c.fillStyle = '#1E1B19'; c.fillRect(0, 0, pw, ph);
  for (let i = 0; i < 2; i++) {
    const x = pw * (0.25 + i * 0.5), w = pw * 0.42;
    c.fillStyle = '#26211E'; c.fillRect(x - w / 2, ph * 0.02, w, ph * 0.96);
    c.fillStyle = '#C2412D'; c.fillRect(x - w * 0.36, ph * 0.3, w * 0.72, ph * 0.5);
    c.fillStyle = '#E0A82E'; c.fillRect(x - w * 0.4, ph * 0.28, w * 0.8, ph * 0.06); c.fillRect(x - w * 0.3, ph * 0.5, w * 0.6, ph * 0.04);
    c.fillStyle = '#2E7D5B'; c.fillRect(x - w * 0.36, ph * 0.78, w * 0.3, ph * 0.17); c.fillRect(x + w * 0.06, ph * 0.78, w * 0.3, ph * 0.17);
    c.fillStyle = '#F3C9A0'; c.beginPath(); c.arc(x, ph * 0.2, w * 0.17, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#1E1B19'; c.fillRect(x - w * 0.2, ph * 0.06, w * 0.4, ph * 0.06); c.fillRect(x - w * 0.08, ph * 0.24, w * 0.16, ph * 0.04);
    c.fillStyle = '#E0A82E'; c.beginPath(); c.arc(x + (i ? -1 : 1) * w * 0.12, ph * 0.66, w * 0.05, 0, Math.PI * 2); c.fill();   // 铺首
  }
}

export function buildCjc(k) {
  const P = k.solid, Pv = k.g('pave'), G = k.glow, { cx, fz, x0, x1 } = CJC;
  // 门前广场（花岗石）
  Pv.slab(x0 - 2, x1 + 2, 0, 0.03, -63.6, fz, C.granite, { ao: false });
  for (let x = x0 - 2; x < x1 + 2; x += 1.2) P.slab(x, x + 0.03, 0.03, 0.034, -63.6, fz, C.granite2, { ao: false });
  // 台基（整排）+ 门廊前三级台阶
  const PH = 0.45;
  Pv.slab(x0, x1, 0, PH, fz - 0.6, fz + 10, C.granite, { aoTop: true });
  k.colSlab(x0, cx - 7, 0, PH, fz - 0.6, fz + 10); k.colSlab(cx + 7, x1, 0, PH, fz - 0.6, fz + 10);
  k.stairs('z', fz - 2.0, 0, fz - 0.6, PH, cx - 6, cx + 6, 0, '#CFCBC2', { rails: false });
  k.colSlab(cx - 7, cx + 7, PH - 0.3, PH, fz - 0.6, fz + 10);
  const roof = (xa, xb, zf, zr, y0, y1, ribs = true) => {   // 硬山：前坡（从檐口 zf,y0 到脊 zr,y1）+ 后坡对称
    const L = Math.hypot(zr - zf, y1 - y0), a = Math.atan2(y1 - y0, zr - zf);
    for (const s of [-1, 1]) {
      const zm = zr + s * (zr - zf) / 2;
      P.box((xa + xb) / 2, (y0 + y1) / 2, zm, xb - xa + 0.4, 0.22, L + 0.3, s < 0 ? C.tile : C.tile2, 0, s * a, 0, 1, { ao: false });
      if (ribs && s < 0) for (let x = xa + 0.25; x < xb - 0.1; x += 0.45) P.box(x, (y0 + y1) / 2 + 0.13, zm, 0.12, 0.08, L + 0.3, C.tile2, 0, -a, 0, 1, { ao: false });
    }
    P.slab(xa - 0.2, xb + 0.2, y0 - 0.25, y0, zf - 0.25, zf + 0.15, C.tile2, { ao: false });   // 檐口（勾头滴水那一条）
  };
  const ridge = (xa, xb, zr, y, h, key) => {   // 脊座 + 陶塑脊（两面画）
    P.slab(xa - 0.1, xb + 0.1, y, y + 0.35, zr - 0.3, zr + 0.3, C.ridge, { ao: false });
    P.slab(xa, xb, y + 0.35, y + 0.42, zr - 0.18, zr + 0.18, C.plaster, { ao: false });
    k.sign((xa + xb) / 2, y + 0.42 + h / 2, zr, { kind: 'custom', key, paint: (c, pw, ph) => paintCeramicRidge(c, pw, ph, key.length), w: xb - xa, h, face: Math.PI, double: true });
  };
  const wall = (xa, xb, y0, y1, za, zb, col = C.brick) => { P.slab(xa, xb, y0, y1, za, zb, col, { aoTop: true }); k.colSlab(xa, xb, y0, y1, za, zb); };
  // —— 头门（中间 x 27..41）：门廊退进 2.4m，前面四根石檐柱
  const GX0 = cx - 7, GX1 = cx + 7, EAVE = 7.4, RID = 10.2, zIn = fz + 2.4;
  wall(GX0, GX1, PH, EAVE, zIn, zIn + 6);                                  // 门廊后墙（大门在这里）
  for (const xa of [GX0, GX1 - 0.6]) wall(xa, xa + 0.6, PH, EAVE, fz, zIn); // 门廊两头的墙
  for (const x of [cx - 5.4, cx - 2, cx + 2, cx + 5.4]) { P.box(x, PH + (EAVE - 0.6 - PH) / 2, fz + 0.35, 0.5, EAVE - 0.6 - PH, 0.5, C.granite, 0, 0, 0, 1, { ao: true }); k.col(x, PH + 3, fz + 0.35, 0.5, 6, 0.5); }
  P.slab(GX0, GX1, EAVE - 0.6, EAVE - 0.25, fz + 0.1, fz + 0.6, C.granite2, { ao: false });   // 石额枋
  for (const x of [cx - 3.7, cx, cx + 3.7]) P.box(x, EAVE - 0.95, fz + 0.35, 1.6, 0.35, 0.3, C.granite2, 0, 0, 0, 1, { ao: false }); // 驼峰（石雕）
  P.slab(GX0, GX1, EAVE - 0.25, EAVE, fz - 0.2, zIn, C.wood, { ao: false });          // 门廊顶
  k.sign(cx, EAVE - 0.95, fz + 0.62 - 0.4, { kind: 'custom', key: 'plasterGate', paint: (c, pw, ph) => paintPlaster(c, pw, ph, 1), w: 1.0, h: 0.3, face: Math.PI });
  // 大门：黑漆双扇 + 门神；门框花岗石；门槛；上面「陈氏书院」匾
  const DZ = zIn - 0.02, DW = 3.0, DH = 4.6;
  P.slab(cx - DW / 2 - 0.35, cx + DW / 2 + 0.35, PH, PH + DH + 0.35, DZ - 0.06, DZ, C.granite2, { ao: false });
  k.sign(cx, PH + DH / 2, DZ - 0.07, { kind: 'custom', key: 'doorGods', paint: paintDoorGods, w: DW, h: DH, face: Math.PI });
  P.slab(cx - DW / 2, cx + DW / 2, PH, PH + 0.35, DZ - 0.3, DZ - 0.06, C.wood, { ao: false });
  k.sign(cx, PH + DH + 1.05, DZ - 0.08, { kind: 'custom', key: 'plaqueCs', w: 3.6, h: 1.0, face: Math.PI, paint: (c, pw, ph) => {
    c.fillStyle = '#1E1B19'; c.fillRect(0, 0, pw, ph); c.strokeStyle = '#D4A84A'; c.lineWidth = ph * 0.07; c.strokeRect(ph * 0.06, ph * 0.06, pw - ph * 0.12, ph - ph * 0.12);
    c.fillStyle = '#E8C26A'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.font = `900 ${ph * 0.6}px ${FONT}`; c.fillText('陈 氏 书 院', pw / 2, ph * 0.54); } });
  for (const s of [-1, 1]) { P.cyl(cx + s * (DW / 2 + 0.75), PH + 0.75, DZ - 0.45, 1.1, 0.42, C.granite, 14, 0, 0, Math.PI / 2); P.box(cx + s * (DW / 2 + 0.75), PH + 0.15, DZ - 0.45, 0.55, 0.3, 0.9, C.granite2); k.col(cx + s * (DW / 2 + 0.75), PH + 0.7, DZ - 0.45, 0.6, 1.4, 1.0); }   // 抱鼓石
  // 门廊两侧墙上的灰塑 + 屋檐下灰塑横幅（整面）
  k.sign(cx, EAVE + 0.35, fz - 0.28, { kind: 'custom', key: 'plasterFrieze', paint: (c, pw, ph) => paintPlaster(c, pw, ph, 2), w: GX1 - GX0, h: 0.7, face: Math.PI });
  roof(GX0, GX1, fz - 0.5, fz + 3.6, EAVE, RID);
  ridge(GX0 + 0.3, GX1 - 0.3, fz + 3.6, RID, 1.9, 'ridgeGateMain');
  // 山墙（头门两头高出屋面，青砖 + 灰塑收头）
  for (const xa of [GX0 - 0.5, GX1]) { wall(xa, xa + 0.5, PH, RID + 0.4, fz - 0.6, fz + 7.8); P.slab(xa - 0.08, xa + 0.58, RID + 0.4, RID + 0.75, fz - 0.7, fz + 7.9, C.plaster, { ao: false }); }
  // —— 两边偏门厅（矮一级）：青砖墙 + 偏门 + 小陶塑脊
  for (const [a, b] of [[x0 + 2, GX0 - 0.5], [GX1 + 0.5, x1 - 2]]) {
    const e2 = 6.2, r2 = 8.6, mid = (a + b) / 2;
    wall(a, b, PH, e2, fz, fz + 6);
    for (let x = a + 0.5; x < b - 0.4; x += 0.42) P.slab(x, x + 0.02, PH + 0.3, e2 - 0.4, fz - 0.012, fz, C.brick2, { ao: false });   // 磨砖对缝的竖缝
    P.slab(mid - 1.0, mid + 1.0, PH, PH + 3.2, fz - 0.05, fz, C.black, { ao: false }); P.slab(mid - 1.2, mid + 1.2, PH + 3.2, PH + 3.4, fz - 0.07, fz, C.granite2, { ao: false });
    k.sign(mid, e2 - 0.35, fz - 0.03, { kind: 'custom', key: 'plasterSide' + (a < cx ? 'W' : 'E'), paint: (c, pw, ph) => paintPlaster(c, pw, ph, a < cx ? 3 : 4), w: b - a - 0.4, h: 0.55, face: Math.PI });
    roof(a, b, fz - 0.4, fz + 3.0, e2, r2);
    ridge(a + 0.4, b - 0.4, fz + 3.0, r2, 1.2, 'ridgeSide' + (a < cx ? 'W' : 'E'));
  }
  // —— 最外两头的连廊墙（矮，灰塑收头）
  for (const [a, b] of [[x0, x0 + 2], [x1 - 2, x1]]) { wall(a, b, PH, 5.0, fz + 0.6, fz + 6); P.slab(a - 0.05, b + 0.05, 5.0, 5.3, fz + 0.55, fz + 6.05, C.plaster, { ao: false }); }
  // —— 后面：聚贤堂的大屋顶 + 陶塑脊（只要轮廓，从街上越过头门能看到）
  wall(GX0 - 4, GX1 + 4, PH, 8.6, fz + 12, fz + 22, C.brick2);
  roof(GX0 - 4.5, GX1 + 4.5, fz + 11.5, fz + 17, 8.6, 12.6, false);
  ridge(GX0 - 3.5, GX1 + 3.5, fz + 17, 12.6, 2.2, 'ridgeHall');
  // 两边各一棵大榕树（遮一点后面的空）
  for (const x of [x0 - 1.0, x1 + 1.0]) { P.cyl(x, 1.6, fz - 4.4, 0.6, 3.2, hex('#6B5340'), 8); P.sphere(x, 4.6, fz - 4.4, 4.6, hex('#3E7B4E'), 1, 0.8); k.col(x, 1.6, fz - 4.4, 0.7, 3.2, 0.7); }
  return { CJC, door: CJC_DOOR };
}
