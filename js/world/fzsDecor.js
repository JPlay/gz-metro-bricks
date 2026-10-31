/*
 * 福州南站 / 福州街口用的低面数小件（全部烘焙进 Kit 的合并网格，不加绘制调用）：
 *   坐着的旅客（大人 / 小孩，约 130 个三角形）、拉行李箱的旅客、出租车、花坛。
 * 人物朝向约定同 xmSM.lowPerson：ry 时正面朝 (sin ry, cos ry)。
 */
import { hex } from '../core/geo.js';
import { lowPerson } from './xmSM.js';

const SHIRTS = ['#E8E4DA', '#2F4E7A', '#C8443A', '#F2C14E', '#4E8F6A', '#7A5C9E', '#F28BA8', '#5B6670', '#FFFFFF', '#E07A3A', '#3E8EDE'];
const PANTS = ['#2B3036', '#3A4A66', '#5B4A3A', '#1F2226', '#6A7580', '#C9B99A'];
const SKIN = ['#E8C29E', '#D9AE86', '#F0CFAE'], HAIR = ['#1E1A18', '#2B2420', '#4A3426'];
const CASES = ['#2F3A46', '#C8443A', '#E9C46A', '#5BA4D8', '#8E9AA6', '#F28BA8'];
const NO = { ao: false };

/** 坐着的旅客（约 68 个三角形：大腿 / 小腿 / 上身 / 头发各一个盒子 + 头）：(x, z) = 臀部位置，y = 坐垫面高度 */
export function sitter(P, x, y, z, ry, i, kid = false) {
  const h = kid ? 0.62 : 1, fx = Math.sin(ry), fz = Math.cos(ry);
  const shirt = hex(SHIRTS[(i * 7 + 3) % SHIRTS.length]), pant = hex(PANTS[(i * 5 + 1) % PANTS.length]), skin = hex(SKIN[i % 3]), hair = hex(HAIR[i % 3]);
  const knee = 0.42 * h, legY = y + 0.08 * h, sl = kid ? 0.4 * h : legY;
  P.box(x + fx * knee / 2, legY, z + fz * knee / 2, 0.36 * h, 0.15 * h, knee + 0.08 * h, pant, ry, 0, 0, 1, NO);   // 大腿（两条并一块）
  P.box(x + fx * knee, kid ? legY - sl / 2 : legY / 2, z + fz * knee, 0.34 * h, sl, 0.15 * h, pant, ry, 0, 0, 1, NO);   // 小腿
  P.box(x - fx * 0.03 * h, y + 0.4 * h, z - fz * 0.03 * h, 0.5 * h, 0.6 * h, 0.24 * h, shirt, ry, 0, 0, 1, NO);   // 上身（含手臂）
  P.sphere(x, y + 0.86 * h, z, 0.25 * h, skin, 1);
  P.box(x - fx * 0.04 * h, y + 0.97 * h, z - fz * 0.04 * h, 0.25 * h, 0.09 * h, 0.25 * h, hair, ry, 0, 0, 1, NO);
}
/** 行李箱（立着，带拉杆）：x, z 箱子中心 */
export function suitcase(P, x, z, ry, i, s = 1) {
  const c = hex(CASES[i % CASES.length]);
  P.box(x, 0.33 * s, z, 0.4 * s, 0.56 * s, 0.24 * s, c, ry, 0, 0, 1, NO);
  P.box(x, 0.85 * s, z, 0.26 * s, 0.5 * s, 0.03, hex('#4A4F55'), ry, 0, 0, 1, NO);
}
/** 拉行李箱走路的旅客（箱子在身后一侧） */
export function traveler(P, x, z, ry, i, kid = false) {
  lowPerson(P, x, 0, z, ry, i * 2 + 1, kid);
  if (kid) return;
  const fx = Math.sin(ry), fz = Math.cos(ry), sx = Math.cos(ry), sz = -Math.sin(ry), side = i % 2 ? 1 : -1;
  const bx = x + sx * 0.42 * side - fx * 0.45, bz = z + sz * 0.42 * side - fz * 0.45;
  const c = hex(CASES[i % CASES.length]);
  P.box(bx, 0.36, bz, 0.4, 0.56, 0.24, c, ry, -0.25, 0, 1, NO);
  P.tube([bx + fx * 0.12, 0.62, bz + fz * 0.12], [x + sx * 0.3 * side, 0.82, z + sz * 0.3 * side], 0.03, hex('#4A4F55'), 4);
}
/** 一家人：大人 + 小孩并排（小孩在大人右手边） */
export function family(P, x, z, ry, i) {
  traveler(P, x, z, ry, i * 2);   // 偶数号：箱子在左手边，右手牵小孩
  const sx = Math.cos(ry), sz = -Math.sin(ry);
  lowPerson(P, x + sx * 0.7, 0, z + sz * 0.7, ry, i + 5, true);
  P.tube([x + sx * 0.3, 0.78, z + sz * 0.3], [x + sx * 0.5, 0.5, z + sz * 0.5], 0.045, hex('#F1C9A5'), 4);   // 牵着的手
}
/** 出租车：车身 + 车顶灯（沿 x 方向，dir = ±1 车头朝向） */
export function taxi(k, x, z, dir, col = '#2F7FC1', P = k.solid) {
  const ry = dir > 0 ? Math.PI / 2 : -Math.PI / 2;
  P.box(x, 0.62, z, 1.8, 0.7, 4.5, hex(col), ry, 0, 0, 1, NO);
  P.box(x - dir * 0.2, 1.22, z, 1.62, 0.55, 2.4, hex('#DCE6EE'), ry, 0, 0, 1, NO);
  P.box(x - dir * 0.2, 1.52, z, 1.5, 0.08, 2.2, hex(col), ry, 0, 0, 1, NO);
  P.box(x - dir * 0.2, 1.68, z, 0.3, 0.24, 0.9, hex('#F6D36B'), ry, 0, 0, 1, NO);   // 车顶灯
  for (const ax of [-1.45, 1.45]) for (const s of [-1, 1]) P.box(x + ax, 0.33, z + s * 0.86, 0.66, 0.66, 0.24, hex('#24272B'), 0, 0, 0, 1, NO);
  k.colSlab(x - 2.3, x + 2.3, 0, 1.6, z - 1, z + 1);
}
/** 花坛：花岗岩矮墙 + 绿篱 + 几簇花 */
export function flowerBed(k, x, z, w, d, i = 0) {
  const P = k.solid, flowers = ['#E8505B', '#F5B841', '#EF7AA8', '#FFFFFF', '#C8102E'];
  P.slab(x - w / 2, x + w / 2, 0, 0.55, z - d / 2, z + d / 2, hex('#B9BBB8'), NO);
  P.slab(x - w / 2 + 0.2, x + w / 2 - 0.2, 0.55, 0.85, z - d / 2 + 0.2, z + d / 2 - 0.2, hex('#4F8A3E'), NO);
  const n = Math.max(3, Math.round(w / 1.4));
  for (let j = 0; j < n; j++) for (const s of [-1, 1]) P.box(x - w / 2 + (j + 0.5) * w / n, 0.95, z + s * d * 0.18, w / n * 0.7, 0.22, d * 0.26, hex(flowers[(i + j + (s > 0 ? 2 : 0)) % flowers.length]), 0, 0, 0, 1, NO);
  k.colSlab(x - w / 2, x + w / 2, 0, 0.55, z - d / 2, z + d / 2);
}
