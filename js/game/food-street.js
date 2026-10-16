/*
 * 美食店门面（街面，站口广场的一侧）：三种明显不同的样子——
 *   teahouse 茶楼：两层、绿琉璃瓦坡屋顶 + 翘角、四根红柱的外廊、金框大匾、红灯笼、柱上竖排对联；
 *   qilou    骑楼老字号：三层骑楼，底层拱券柱廊（人行道在楼下），二三层窗 + 百叶，黑漆 / 彩色大招牌，顶上山花里一个大菜标，柱边挑出竖招牌；
 *   stall    街边档口：后面两层小楼，前面条纹雨篷 + 灯箱大招牌、不锈钢档口台（大锅冒热气）、门口塑料凳、立在路边的圆形菜标。
 * 几何全部并进车站自己的 Kit 桶（不增加绘制调用）；招牌和菜标画在美食店自己的小贴图集里（这一站 +1 次绘制调用）。
 * 坐标：店在广场西边（W）时门朝 +x，东边（E）时门朝 -x；局部 a = 沿门面（面对店时往右为正），d = 离门面的距离（店外为正、店里为负）。
 */
import { hex, mix } from '../core/geo.js';
import { RESTAURANTS, DISHES } from './food-data.js';
import { FoodAtlas, paintBoard, paintVert, paintIcon, mix2, fitFont } from './food-art.js';
import { FONT } from '../world/kit.js';
const B = window.BABYLON;
export const SHOP = { xf: 13.6, zc: -55, w: 8, depth: 7.5 };

export function frameFor(r) {
  const n = r.side === 'W' ? 1 : -1, xf = -n * SHOP.xf, zc = SHOP.zc;
  const X = d => xf + n * d, Z = a => zc + a * n;
  return { n, xf, zc, X, Z, face: n > 0 ? Math.PI / 2 : -Math.PI / 2, local: p => ({ a: (p.z - zc) * n, d: (p.x - xf) * n }), yawOut: n > 0 ? Math.PI / 2 : -Math.PI / 2 };
}

/** 在车站街面上搭这一站的美食店；返回 [{ r, F, door:{a0,a1,dIn,dOut} }] */
export function buildFoodStreet(st, treeSpots) {
  // ?nofood=1：不搭美食店（性能对比用）
  const list = /[?&]nofood=1/.test(location.search) ? [] : RESTAURANTS.filter(r => r.code === st.code);
  if (!list.length) return [];
  // 店的占地（+2.5m）里的树挪到店后面（只改位置、不删，随机数序列不变，其他装饰不受影响）
  if (treeSpots) for (const r of list) { const n = r.side === 'W' ? 1 : -1; for (let i = treeSpots.length - 1; i >= 0; i--) { const [x, z] = treeSpots[i], d = (x + n * SHOP.xf) * n, a = (z - SHOP.zc) * n; if (d > -SHOP.depth - 2.5 && d < 2.5 && Math.abs(a) < SHOP.w / 2 + 2.5) treeSpots[i] = [-n * (SHOP.xf + SHOP.depth + 3 + (i % 3) * 1.5), z, ...treeSpots[i].slice(2)]; } }
  const k = st.kit, atlas = new FoodAtlas(st.scene, 1024), out = [];
  for (const r of list) {
    const F = frameFor(r), P = k.solid, G = k.glow;
    const bx = (g, a0, a1, y0, y1, d0, d1, col, o = { ao: false }) => g.slab(Math.min(F.X(d0), F.X(d1)), Math.max(F.X(d0), F.X(d1)), y0, y1, Math.min(F.Z(a0), F.Z(a1)), Math.max(F.Z(a0), F.Z(a1)), typeof col === 'string' ? hex(col) : col, o);
    const col = (a0, a1, y0, y1, d0, d1) => k.colSlab(Math.min(F.X(d0), F.X(d1)), Math.max(F.X(d0), F.X(d1)), y0, y1, Math.min(F.Z(a0), F.Z(a1)), Math.max(F.Z(a0), F.Z(a1)));
    const at = (a, y, d) => [F.X(d), y, F.Z(a)];
    const q2 = (g, A, Bp, C, D, c) => { g.quad(A, Bp, C, D, c); g.quad(D, C, Bp, A, c); };
    const sign = (a, y, d, w, h, paint, face = F.face) => atlas.sign(F.X(d), y, F.Z(a), w, h, face, paint);
    sign.world = (x, y, z, w, h, face, paint) => atlas.sign(x, y, z, w, h, face, paint);
    // 店面墙开门洞：墙拆成左 / 右 / 上三块；门洞后面一个浅浅的暖光门厅（看得到“里面”）
    const wallDoor = (aL, aR, y0, y1, dB, dF, c, da, dh, o = { aoTop: false }) => { bx(P, aL, -da, y0, y1, dB, dF, c, o); bx(P, da, aR, y0, y1, dB, dF, c, o); bx(P, -da, da, dh, y1, dB, dF, c, o); };
    const vestibule = (dF, da, dh, depth, c, glow) => {
      const dB = dF - depth; bx(G, -da, da, 0, dh, dB - 0.04, dB, hex(glow));
      bx(P, -da - 0.12, -da, 0, dh, dB, dF, c); bx(P, da, da + 0.12, 0, dh, dB, dF, c); bx(P, -da, da, dh, dh + 0.1, dB, dF, hex(mix2(glow, '#000000', 0.45)));
      bx(P, -da, da, 0, 0.02, dB, dF, hex(mix2(glow, '#5A3A22', 0.6)));
      const [x, , z] = at(0, 0, dB + depth * 0.45); G.cyl(x, dh - 0.05, z, 0.5, 0.06, hex('#FFF4DC'), 12);
    };
    // 一扇门板（世界坐标，铰链 → 门尖），朝街的那面加花样
    const leaf = (aH, dH, aT, dT, h, c, deco) => {
      const [x0, , z0] = at(aH, 0, dH), [x1, , z1] = at(aT, 0, dT), dx = x1 - x0, dz = z1 - z0, L = Math.hypot(dx, dz), ry = Math.atan2(-dz, dx);
      P.box((x0 + x1) / 2, h / 2, (z0 + z1) / 2, L, h, 0.07, c, ry);
      let nx = -dz / L, nz = dx / L; const [cx, , cz] = at(0, 0, 2); if (nx * (cx - x0) + nz * (cz - z0) < 0) { nx = -nx; nz = -nz; }
      if (deco) deco((u, y, off) => [x0 + dx * u + nx * off, y, z0 + dz * u + nz * off], ry, L);
    };
    const H = { r, F, bx, col, at, q2, sign, P, G, k, wallDoor, vestibule, leaf };
    // 门前铺一块地砖（盖住草地边的路缘石）
    bx(k.g('pave'), -4.6, 4.6, 0, 0.165, 0, 0.75, '#D3CCBF');
    let door;
    if (r.form === 'teahouse') door = teahouse(H); else if (r.form === 'qilou') door = qilou(H); else door = stall(H);
    // 地上的软影
    k.shade.shadeStrip(F.X(0), F.Z(-4), F.X(0), F.Z(4), 0.17, F.n, 0, 1.0, 0.25);
    out.push({ r, F, door });
  }
  atlas.finish(k.root, 'foodSigns-' + st.code);
  st.foodAtlas = atlas;
  return out;
}

/* ---------- 茶楼 ---------- */
function teahouse({ r, F, bx, col, at, q2, sign, P, G, k, wallDoor, vestibule, leaf }) {
  const cream = hex('#F2E8D4'), wood = hex('#6B3A1E'), red = hex('#A8231C'), tile = hex('#2E7D5B'), tileD = hex('#1F5E43'), gold = hex('#E3B341'), stone = hex('#BDB5A6');
  // 一层：店身（外廊后面）
  wallDoor(-4, 4, 0, 3.6, -7.5, -1.2, cream, 1.0, 2.7); col(-4, 4, 0, 3.6, -7.5, -1.25);
  bx(P, -4.1, 4.1, 0, 0.35, -1.25, -1.15, stone);
  // 门：红木对开大门（往里开着）+ 金色门钉 + 铜门环；门里暖光门厅 + 木门框 + 门楣
  vestibule(-1.2, 1.0, 2.7, 1.7, hex('#8A5A36'), '#E9B47A');
  const redWood = hex('#9E2A1F'), redDark = hex('#74180F');
  for (const s of [-1, 1]) leaf(s * 1.0, -1.25, s * 0.76, -2.2, 2.65, redWood, (pt, ry, L) => {
    for (const [y0, y1] of [[0.25, 1.15], [1.35, 2.45]]) { const p0 = pt(0.5, (y0 + y1) / 2, 0.045); P.box(p0[0], p0[1], p0[2], L * 0.72, y1 - y0, 0.02, redDark, ry, 0, 0, 1, { ao: false }); }
    for (let i = 0; i < 3; i++) for (let j = 0; j < 4; j++) { const p0 = pt(0.25 + i * 0.25, 1.45 + j * 0.27, 0.06); P.sphere(p0[0], p0[1], p0[2], 0.06, hex('#E3B341'), 1); }
    const kn = pt(0.88, 1.2, 0.07); P.cyl(kn[0], kn[1], kn[2], 0.16, 0.025, hex('#C8962E'), 10, ry, Math.PI / 2, 0);
  });
  bx(P, -1.15, -1.0, 0, 2.85, -1.2, -1.05, wood); bx(P, 1.0, 1.15, 0, 2.85, -1.2, -1.05, wood); bx(P, -1.15, 1.15, 2.7, 2.95, -1.2, -1.05, wood);
  // 两边木格窗
  for (const s of [-1, 1]) { const a0 = s * 1.6, a1 = s * 3.6; bx(G, Math.min(a0, a1), Math.max(a0, a1), 1.0, 2.6, -1.22, -1.17, hex('#FFC97A')); bx(P, Math.min(a0, a1) - 0.08, Math.max(a0, a1) + 0.08, 0.92, 1.0, -1.2, -1.05, wood); bx(P, Math.min(a0, a1) - 0.08, Math.max(a0, a1) + 0.08, 2.6, 2.68, -1.2, -1.05, wood);
    for (let i = 0; i <= 5; i++) { const a = a0 + (a1 - a0) * i / 5; bx(P, a - 0.03, a + 0.03, 1.0, 2.6, -1.17, -1.12, wood); } for (const y of [1.53, 2.07]) bx(P, Math.min(a0, a1), Math.max(a0, a1), y - 0.025, y + 0.025, -1.17, -1.12, wood); }
  // 外廊：四根红柱（石础）+ 柱头横梁
  for (const a of [-3.6, -1.25, 1.25, 3.6]) { const [x, , z] = at(a, 0, -0.25); P.cyl(x, 1.8, z, 0.34, 3.6, red, 12); P.cyl(x, 0.12, z, 0.5, 0.24, stone, 12); k.col(x, 1.8, z, 0.34, 3.6, 0.34); }
  bx(P, -4.2, 4.2, 3.35, 3.65, -0.45, -0.05, red); bx(P, -4.2, 4.2, 3.3, 3.36, -0.45, -0.05, gold);
  // 柱上竖排对联（中间两根柱子的正面）
  for (const [a, t] of [[-1.25, '一盅两件'], [1.25, '点心飘香']]) sign(a, 1.75, 0.0, 0.34, 2.3, paintVert(t, '#A8231C', '#F6D58A', '#E3B341'));
  // 外廊小屋檐（绿琉璃瓦）
  const eave = (aL, aR, dLo, yLo, dHi, yHi) => { q2(P, at(aL, yLo, dLo), at(aR, yLo, dLo), at(aR, yHi, dHi), at(aL, yHi, dHi), tile); for (let i = 0; i <= 16; i++) { const a = aL + (aR - aL) * i / 16; P.tube(at(a, yLo + 0.05, dLo), at(a, yHi + 0.05, dHi), 0.07, tileD, 4); } bx(P, aL, aR, yLo - 0.12, yLo + 0.02, dLo - 0.05, dLo + 0.12, tileD); };
  eave(-4.5, 4.5, 0.55, 3.75, -1.3, 4.35);
  col(-4.5, 4.5, 3.6, 4.4, -1.3, 0.55);
  // 二楼：退进去一点，三扇红框窗（暖光）+ 中间金框大匾
  bx(P, -4, 4, 3.6, 6.7, -7.2, -1.4, cream, { aoTop: false }); col(-4, 4, 3.6, 6.7, -7.2, -1.4);
  for (const s of [-1, 1]) { const a = s * 3.05; bx(G, a - 0.6, a + 0.6, 4.7, 6.1, -1.42, -1.38, hex('#FFC97A')); bx(P, a - 0.7, a + 0.7, 4.6, 4.7, -1.42, -1.3, red); bx(P, a - 0.7, a + 0.7, 6.1, 6.2, -1.42, -1.3, red); bx(P, a - 0.7, a - 0.6, 4.6, 6.2, -1.42, -1.3, red); bx(P, a + 0.6, a + 0.7, 4.6, 6.2, -1.42, -1.3, red); bx(P, a - 0.03, a + 0.03, 4.7, 6.1, -1.39, -1.34, red); }
  bx(P, -2.35, 2.35, 4.45, 6.35, -1.45, -1.3, gold);
  sign(0, 5.4, -1.29, 4.5, 1.7, paintBoard(r, 'plaque'));
  // 大屋顶：前后两坡 + 两头山墙 + 屋脊（两头翘起的脊饰）+ 四个翘角
  const yE = 6.65, yR = 8.7, dF = -0.9, dR = -4.3, dB = -7.7, aw = 4.6;
  q2(P, at(-aw, yE, dF), at(aw, yE, dF), at(aw, yR, dR), at(-aw, yR, dR), tile); q2(P, at(-aw, yR, dR), at(aw, yR, dR), at(aw, yE, dB), at(-aw, yE, dB), tile);
  for (let i = 0; i <= 22; i++) { const a = -aw + 2 * aw * i / 22; P.tube(at(a, yE + 0.06, dF), at(a, yR + 0.06, dR), 0.08, tileD, 4); }
  for (const s of [-1, 1]) q2(P, at(s * 4.0, 6.7, -1.4), at(s * 4.0, 6.7, -7.2), at(s * 4.0, yR - 0.15, dR), at(s * 4.0, yR - 0.15, dR), cream);
  bx(P, -aw - 0.1, aw + 0.1, yE - 0.15, yE + 0.02, dF - 0.05, dF + 0.15, tileD);
  P.tube(at(-aw, yR + 0.12, dR), at(aw, yR + 0.12, dR), 0.24, tileD, 8);
  for (const s of [-1, 1]) { P.path([at(s * aw, yR + 0.12, dR), at(s * (aw + 0.25), yR + 0.4, dR), at(s * (aw + 0.2), yR + 0.85, dR), at(s * (aw - 0.05), yR + 1.0, dR)], 0.2, tileD, 6); P.sphere(...at(s * (aw - 0.05), yR + 1.0, dR), 0.28, gold, 1); }
  for (const s of [-1, 1]) for (const [d0, y0] of [[dF, yE], [dB, yE]]) P.path([at(s * aw, y0, d0), at(s * (aw + 0.45), y0 + 0.2, d0 + Math.sign(d0 - dR) * 0.35), at(s * (aw + 0.55), y0 + 0.6, d0 + Math.sign(d0 - dR) * 0.45)], 0.14, tileD, 5);
  for (const s of [-1, 1]) P.path([at(s * 4.5, 3.75, 0.55), at(s * 4.85, 3.95, 0.8), at(s * 4.9, 4.3, 0.85)], 0.12, tileD, 5);
  // 红灯笼（发光）挂在外廊檐下
  for (const a of [-2.45, 0, 2.45]) { const [x, , z] = at(a, 0, 0.15); G.ellipsoid(x, 2.95, z, 0.55, 0.62, 0.55, hex('#FF5C4D'), 2); P.cyl(x, 3.3, z, 0.3, 0.08, gold, 10); P.cyl(x, 2.6, z, 0.3, 0.08, gold, 10); P.tube([x, 3.32, z], [x, 3.6, z], 0.02, gold, 4); P.tube([x, 2.56, z], [x, 2.35, z], 0.05, hex('#E8B23A'), 4); }
  return { a0: -1.0, a1: 1.0, dIn: -0.75, dOut: 0.9 };
}

/* ---------- 骑楼 ---------- */
function qilou({ r, F, bx, col, at, q2, sign, P, G, k, wallDoor, vestibule }) {
  const fac = hex(mix2(r.accent, '#FFFFFF', 0.78)), facD = hex(mix2(r.accent, '#FFFFFF', 0.55)), white = hex('#F7F4EE'), acc = hex(r.accent), dark = hex('#3A332E'), tile = hex(mix2(r.floor, '#ffffff', 0.2));
  const AD = -3.6, Y1 = 4.1, TOP = 10.6;   // 骑楼廊深 3.6 m：楼在上、人行道在楼下
  // 底层：骑楼柱廊（人行道在楼下）。里面的店面墙在 d = AD
  wallDoor(-4, 4, 0, Y1, -7.5, AD, facD, 0.9, 2.6); col(-4, 4, 0, Y1, -7.5, AD - 0.05);
  bx(P, -4.05, 4.05, 0, 0.03, AD, 0, tile);                                   // 廊下地砖
  for (let i = 0; i < 8; i++) bx(P, -4 + i, -3.5 + i, 0.03, 0.035, AD, 0, hex(mix2(r.floor, '#000000', 0.12)));
  bx(P, -4.05, 4.05, Y1 - 0.12, Y1, AD, -0.45, white);                       // 廊下天花
  for (const a of [-2.5, 0, 2.5]) { const [x, , z] = at(a, 0, AD * 0.55); G.cyl(x, Y1 - 0.14, z, 0.42, 0.04, hex('#FFF1D6'), 12); P.cyl(x, Y1 - 0.1, z, 0.5, 0.04, hex('#3A332E'), 12); } // 廊下吸顶灯
  k.shade.shadeStrip(F.X(AD + 0.05), F.Z(-4), F.X(AD + 0.05), F.Z(4), 0.04, F.n, 0, 1.4, 0.22);   // 廊下靠墙暗一点
  // 店面：中间玻璃门（深色铝框 + 两扇玻璃 + 不锈钢拉手，后面暖光门厅）+ 两边橱窗（暖光 + 菜标）
  vestibule(AD, 0.9, 2.6, 1.5, hex(mix2(r.wall, '#FFFFFF', 0.2)), '#F2C994');
  { const alu = hex('#2F3438'), steelH = hex('#D9DEE2');
    k.glass.slab(Math.min(F.X(AD + 0.02), F.X(AD + 0.06)), Math.max(F.X(AD + 0.02), F.X(AD + 0.06)), 0.05, 2.55, Math.min(F.Z(-0.88), F.Z(0.88)), Math.max(F.Z(-0.88), F.Z(0.88)), hex('#D8EEF6'));
    bx(P, -0.9, 0.9, 0, 0.12, AD + 0.01, AD + 0.09, alu); bx(P, -0.9, 0.9, 2.5, 2.6, AD + 0.01, AD + 0.09, alu);
    for (const [a0, a1] of [[-0.9, -0.82], [-0.04, 0.04], [0.82, 0.9]]) bx(P, a0, a1, 0, 2.6, AD + 0.01, AD + 0.09, alu);
    for (const s of [-1, 1]) bx(P, s * 0.12 - 0.02, s * 0.12 + 0.02, 0.85, 1.45, AD + 0.09, AD + 0.15, steelH);
    sign(0, 2.0, AD + 0.1, 0.9, 0.22, (c, pw, ph) => { c.fillStyle = '#2F3438'; c.fillRect(0, 0, pw, ph); c.fillStyle = '#FFFFFF'; c.textAlign = 'center'; c.textBaseline = 'middle'; fitFont(c, '推  PUSH  拉', 800, ph * 0.62, FONT, pw * 0.9); c.fillText('推  PUSH  拉', pw / 2, ph * 0.55); }); }
  bx(P, -1.05, -0.9, 0, 2.8, AD, AD + 0.15, dark); bx(P, 0.9, 1.05, 0, 2.8, AD, AD + 0.15, dark); bx(P, -1.05, 1.05, 2.6, 2.8, AD, AD + 0.15, dark);
  for (const s of [-1, 1]) { const a0 = s * 1.4, a1 = s * 3.6; bx(G, Math.min(a0, a1), Math.max(a0, a1), 0.75, 2.5, AD + 0.02, AD + 0.05, hex('#FFE6BF')); bx(P, Math.min(a0, a1) - 0.08, Math.max(a0, a1) + 0.08, 0, 0.75, AD, AD + 0.12, acc); bx(P, Math.min(a0, a1) - 0.08, Math.max(a0, a1) + 0.08, 2.5, 2.62, AD, AD + 0.12, dark);
    sign(s * 2.5, 1.7, AD + 0.06, 1.0, 1.0, paintIcon(r.dish, r.accent)); }
  // 柱子 + 拱券（每跨一道半椭圆拱）
  const cols = [-3.75, -1.25, 1.25, 3.75];
  for (const a of cols) { bx(P, a - 0.27, a + 0.27, 0, Y1, -0.5, 0.02, white, { aoTop: false }); bx(P, a - 0.33, a + 0.33, 0, 0.45, -0.56, 0.06, facD); col(a - 0.27, a + 0.27, 0, Y1, -0.5, 0.02); }
  for (let b = 0; b < 3; b++) { const a0 = cols[b] + 0.27, a1 = cols[b + 1] - 0.27, N = 10;
    for (let i = 0; i < N; i++) { const u0 = i / N, u1 = (i + 1) / N, um = (u0 + u1) / 2, ya = 3.05 + 0.6 * Math.sqrt(Math.max(0, 1 - (2 * um - 1) ** 2)); bx(P, a0 + (a1 - a0) * u0, a0 + (a1 - a0) * u1, ya, Y1, -0.45, 0.0, white); } }
  // 二三层：立面 + 窗（白窗套 + 彩色百叶）+ 腰线 + 大招牌
  bx(P, -4.1, 4.1, Y1, TOP, -7.5, 0.0, fac, { aoTop: false }); col(-4.1, 4.1, Y1, TOP, -7.5, 0.0);
  bx(P, -4.15, 4.15, Y1, Y1 + 0.18, -0.05, 0.08, white);
  bx(P, -3.85, 3.85, 4.15, 5.75, 0.0, 0.07, hex('#1B1B1B'));
  sign(0, 4.95, 0.08, 7.5, 1.45, paintBoard(r, 'lacquer'));
  for (const [y0, y1] of [[6.3, 7.9], [8.5, 9.8]]) for (const a of [-2.6, 0, 2.6]) {
    bx(P, a - 0.62, a + 0.62, y0 - 0.12, y1 + 0.12, 0.0, 0.06, white); bx(G, a - 0.45, a + 0.45, y0, y1, 0.04, 0.07, hex('#CFE3F2'));
    bx(P, a - 0.03, a + 0.03, y0, y1, 0.06, 0.09, white);
    for (const s of [-1, 1]) { bx(P, a + s * 0.62 - (s > 0 ? 0 : 0.42), a + s * 0.62 + (s > 0 ? 0.42 : 0), y0, y1, 0.06, 0.1, acc); for (let j = 1; j < 8; j++) { const y = y0 + (y1 - y0) * j / 8; bx(P, a + s * 0.62 - (s > 0 ? 0 : 0.42), a + s * 0.62 + (s > 0 ? 0.42 : 0), y - 0.012, y + 0.012, 0.1, 0.11, hex(mix2(r.accent, '#000000', 0.25))); } }
  }
  bx(P, -1.4, 1.4, 6.15, 6.28, 0.0, 0.55, white); for (let i = 0; i <= 8; i++) { const a = -1.35 + i * 2.7 / 8; bx(P, a - 0.03, a + 0.03, 6.28, 6.9, 0.45, 0.51, white); } bx(P, -1.4, 1.4, 6.9, 6.98, 0.42, 0.54, white); // 小阳台
  bx(P, -4.2, 4.2, 8.1, 8.24, -0.05, 0.12, white); bx(P, -4.2, 4.2, TOP - 0.1, TOP + 0.15, -0.05, 0.18, white);
  // 女儿墙 + 山花（中间圆拱，里面一个大菜标）
  bx(P, -4.1, 4.1, TOP + 0.15, TOP + 0.85, -0.25, 0.05, fac);
  { const N = 14; for (let i = 0; i < N; i++) { const u0 = i / N, u1 = (i + 1) / N, um = (u0 + u1) / 2, h = 1.55 * Math.sqrt(Math.max(0, 1 - (2 * um - 1) ** 2)); bx(P, -1.7 + 3.4 * u0, -1.7 + 3.4 * u1, TOP + 0.85, TOP + 0.85 + h, -0.25, 0.05, fac); } }
  bx(P, -1.8, 1.8, TOP + 0.8, TOP + 0.9, -0.28, 0.1, white);
  sign(0, TOP + 1.45, 0.06, 1.35, 1.35, paintIcon(r.dish, r.accent));
  // 挑出来的竖招牌（在最外那根柱子上面，两面都有字）
  { const [x, , z] = at(4.25, 0, 0.75), w = 0.72, h = 2.9, y = 5.6, paint = paintVert(r.name, r.sign.bg, r.sign.fg, r.sign.fg);
    P.box(x, y, z, w + 0.1, h + 0.1, 0.06, hex('#2B2B2B'), 0, 0, 0, 1, { ao: false });
    sign.world(x, y, z + 0.035, w, h, 0, paint); sign.world(x, y, z - 0.035, w, h, Math.PI, paint);
    P.tube(at(4.25, y + h / 2 + 0.05, 0.0), at(4.25, y + h / 2 + 0.05, 1.2), 0.05, hex('#2B2B2B'), 4); }
  return { a0: -0.9, a1: 0.9, dIn: AD + 0.45, dOut: AD + 1.5 };
}

/* ---------- 街边档口 ---------- */
function stall({ r, F, bx, col, at, q2, sign, P, G, k, wallDoor, vestibule }) {
  const wall = hex(mix2(r.accent, '#FFFFFF', 0.82)), acc = hex(r.accent), steel = hex('#C8CDD2'), dark = hex('#3A3F45');
  const DB = -3.2;
  // 后面两层小楼
  wallDoor(-4, 4, 0, 7.2, -7.5, DB, wall, 0.9, 2.5); col(-4, 4, 0, 7.2, -7.5, DB - 0.05);
  bx(P, -4.1, 4.1, 7.2, 7.6, -7.6, DB + 0.1, hex('#E9E6E0'));
  for (const a of [-2.6, 0, 2.6]) { bx(P, a - 0.7, a + 0.7, 4.6, 6.4, DB, DB + 0.05, hex('#F4F4F2')); bx(G, a - 0.6, a + 0.6, 4.7, 6.3, DB + 0.04, DB + 0.07, hex('#CFE3F2')); bx(P, a - 0.75, a + 0.75, 4.5, 4.6, DB, DB + 0.3, hex('#BFC4C8')); for (let j = 0; j < 6; j++) bx(P, a - 0.7 + j * 0.28, a - 0.68 + j * 0.28, 4.6, 5.3, DB + 0.25, DB + 0.3, dark); }
  // 店门挂布门帘（中间开衩、印一个大字）+ 门里暖光门厅 + 门边“店内有座”
  vestibule(DB, 0.9, 2.5, 1.4, hex('#D9D4CC'), '#F5D3A0');
  { const [x0, , z0] = at(-0.95, 0, DB + 0.1), [x1, , z1] = at(0.95, 0, DB + 0.1); P.tube([x0, 2.45, z0], [x1, 2.45, z1], 0.04, hex('#8A6A4A'), 6); }
  { const ch = DISHES[r.dish].zh.slice(-1), bg = r.sign.bg === '#FFF4D6' ? r.accent : r.sign.bg;
    sign(0, 1.73, DB + 0.09, 1.8, 1.45, (c, pw, ph) => {
      c.fillStyle = bg; c.fillRect(0, 0, pw, ph); c.fillStyle = 'rgba(0,0,0,.18)'; c.fillRect(0, 0, pw, ph * 0.12);
      for (const x of [pw / 3, pw * 2 / 3]) { c.fillStyle = 'rgba(0,0,0,.12)'; c.fillRect(x - 2, ph * 0.12, 4, ph); }
      c.fillStyle = 'rgba(0,0,0,.45)'; c.fillRect(pw / 2 - 3, ph * 0.3, 6, ph);   // 中间开衩
      c.beginPath(); c.arc(pw / 2, ph * 0.52, ph * 0.27, 0, Math.PI * 2); c.fillStyle = '#FFFFFF'; c.fill();
      c.fillStyle = bg; c.textAlign = 'center'; c.textBaseline = 'middle'; c.font = `900 ${ph * 0.34}px ${FONT}`; c.fillText(ch, pw / 2, ph * 0.54); }); }
  bx(P, -1.0, -0.9, 0, 2.6, DB, DB + 0.12, steel); bx(P, 0.9, 1.0, 0, 2.6, DB, DB + 0.12, steel); bx(P, -1.0, 1.0, 2.5, 2.6, DB, DB + 0.12, steel);
  sign(1.75, 1.6, DB + 0.05, 0.55, 1.5, paintVert('店内有座', '#FFFFFF', r.accent, r.accent));
  // 灯箱大招牌
  bx(P, -3.85, 3.85, 3.3, 5.0 - 0.6, DB, DB + 0.3, dark);
  sign(0, 3.85, DB + 0.31, 7.5, 1.2, paintBoard(r, 'lightbox'));
  // 条纹雨篷（从招牌下面斜着伸出来）+ 前沿波浪边
  const N = 12, yHi = 3.25, yLo = 2.55, dHi = DB, dLo = 0.5;
  for (let i = 0; i < N; i++) { const a0 = -4.2 + 8.4 * i / N, a1 = -4.2 + 8.4 * (i + 1) / N, c = i % 2 ? hex('#FFFFFF') : hex(r.sign.bg === '#FFF4D6' ? r.accent : r.sign.bg);
    q2(P, at(a0, yLo, dLo), at(a1, yLo, dLo), at(a1, yHi, dHi), at(a0, yHi, dHi), c);
    P.cyl(...at((a0 + a1) / 2, yLo - 0.12, dLo + 0.02), 8.4 / N, 0.24, c, 10, 0, 0, 0, 0.0, { ao: false }); }
  col(-4.2, 4.2, 2.5, 3.3, DB, 0.5);
  for (const a of [-4.15, 4.15]) { const [x, , z] = at(a, 0, 0.45); P.cyl(x, 1.3, z, 0.07, 2.6, steel, 8); }
  // 档口台：不锈钢台面 + 玻璃柜 + 大锅（冒热气的白球）
  bx(P, -3.9, -1.3, 0, 0.95, -1.4, -0.35, steel); bx(P, -3.95, -1.25, 0.95, 1.0, -1.45, -0.3, hex('#E2E6EA')); col(-3.9, -1.3, 0, 1.1, -1.4, -0.35);
  k.glass.box(...at(-3.15, 1.3, -0.95), 0.9, 0.6, 1.1, hex('#DDEFF7'));
  { const [x, , z] = at(-1.95, 0, -0.85); P.cyl(x, 1.25, z, 0.78, 0.5, hex('#9AA2AA'), 16); P.cyl(x, 1.5, z, 0.7, 0.02, hex(r.dish === 'ngauzap' ? '#9A5426' : '#F3EBDD'), 16, 0, 0, 0, undefined, { ao: false });
    for (const [dx, dy, s] of [[0, 1.85, 0.38], [0.15, 2.15, 0.28], [-0.1, 2.35, 0.22]]) G.sphere(x + dx, dy, z, s, hex('#F7FAFC'), 1); }
  // 门口塑料凳 + 小折叠桌
  for (const [a, d, c] of [[2.0, 1.25, '#E8505B'], [3.2, 1.25, '#3E8EDE'], [2.6, 2.05, '#E8505B']]) { const [x, , z] = at(a, 0, d); P.cyl(x, 0.21, z, 0.34, 0.42, hex(c), 10, 0, 0, 0, 0.28, { ao: false }); }
  { const [x, , z] = at(2.6, 0, 1.6); P.cyl(x, 0.6, z, 0.06, 1.2, steel, 6); P.cyl(x, 0.62, z, 0.75, 0.04, hex('#F4F4F2'), 14, 0, 0, 0, undefined, { ao: false }); k.col(x, 0.3, z, 0.6, 0.6, 0.6); }
  // 路边立着的圆形菜标（双面）
  { const [x, , z] = at(4.4, 0, 1.0); P.cyl(x, 0.9, z, 0.07, 1.8, dark, 8); P.cyl(x, 0.04, z, 0.5, 0.08, dark, 12); k.col(x, 0.9, z, 0.2, 1.8, 0.2);
    sign(4.4, 2.15, 1.0 + 0.04, 1.0, 1.0, paintIcon(r.dish, r.accent)); sign(4.4, 2.15, 1.0 - 0.04, 1.0, 1.0, paintIcon(r.dish, r.accent), F.face + Math.PI); }
  return { a0: -0.9, a1: 0.9, dIn: -2.75, dOut: -1.7 };
}
