/*
 * 换乘地面引导带（公园前 1↔2 号线）：约 0.4m 宽的线路色色带 + 每隔一段的白色 / 深色 V 形箭头。
 *   - 全部写进现有的 glow 桶（不受光照，颜色就是线路色本色），不新增绘制调用；
 *   - 色带抬高（底 y+0.012、顶面 y+0.035，箭头再高 1.5cm 在 y+0.05）：iPad 深度精度低，1~2cm / 6mm 的间隔在远处会闪；
 *     glow 材质另有多边形偏移（mats.js），比地砖、盲道（+0.006）、暗影（+0.008）、地面光斑都高出一截；
 *   - 楼梯段逐级贴在踏步面上（与 kit.stairs 的踏步划分一致）；
 *   - 自拼桥那一段由 bridgeStripe() 生成一块小网格，实例挂在每块桥板上，桥拼好时色带才连起来。
 */
import { Geo, hex } from '../core/geo.js';
const B = window.BABYLON;
export const BAND_W = 0.4, BAND_BOT = 0.012, BAND_TOP = 0.035, CHEV_Y = 0.05;

/** 一个 V 形箭头（两条斜带），中心 (x,z)，指向 (fx,fz)，尺寸 s（米） */
function chevron(G, x, y, z, fx, fz, s, col) {
  const rx = fz, rz = -fx, t = s * 0.2; // 右手方向，带宽
  const P = (f, r) => [x + fx * f + rx * r, y, z + fz * f + rz * r];
  for (const sd of [-1, 1]) {
    // 从侧后 (-0.3s, sd*0.42s) 到尖端 (0.3s, 0)，宽 t
    const a = P(-s * 0.3, sd * s * 0.42), b = P(s * 0.3, 0);
    const q = [a, b, [b[0] - fx * t, y, b[2] - fz * t], [a[0] - fx * t, y, a[2] - fz * t]];
    // 正反两面都画（不依赖朝向）
    G.quad(q[0], q[1], q[2], q[3], col); G.quad(q[3], q[2], q[1], q[0], col);
  }
}
/**
 * 平地段：pts = [[x,z],...] 折线，地面高 y。每段画一条色带；从起点开始每 every 米一个箭头（指向前进方向）。
 */
export function flatBand(G, pts, y, col, chevCol, { every = 1.6, w = BAND_W, start = 0.8 } = {}) {
  const c = hex(col), cc = hex(chevCol);
  for (let i = 0; i < pts.length - 1; i++) {
    const [x0, z0] = pts[i], [x1, z1] = pts[i + 1], L = Math.hypot(x1 - x0, z1 - z0); if (L < 1e-3) continue;
    const fx = (x1 - x0) / L, fz = (z1 - z0) / L, h = w / 2;
    // 只支持横平竖直的段；两端各延长半个带宽，拐角处补满
    G.slab(Math.min(x0, x1) - h, Math.max(x0, x1) + h, y + BAND_BOT, y + BAND_TOP, Math.min(z0, z1) - h, Math.max(z0, z1) + h, c, { ao: false });
    for (let d = Math.min(start, L / 2), e = Math.max(L - 0.3, d); d <= e; d += every) chevron(G, x0 + fx * d, y + CHEV_Y, z0 + fz * d, fx, fz, w * 0.9, cc);
  }
}
/** 楼梯段：沿 x 的楼梯（和 kit.stairs 同样的踏步划分），色带中心在 z=zc；箭头每隔 4 级一个（朝下行方向 dirX） */
export function stairBand(G, a, ya, b, yb, zc, col, chevCol, { w = BAND_W, walkDir = 0, every = 4, visual = false } = {}) {
  const c = hex(col), cc = hex(chevCol), L = Math.abs(b - a), dy = yb - ya, n = Math.max(2, Math.round(Math.abs(dy) / 0.16)), dir = Math.sign(b - a), h = w / 2;
  const fx = walkDir || dir;
  for (let k = 0; k < n; k++) {
    const s0 = a + dir * L * k / n, s1 = a + dir * L * (k + 1) / n;
    // kit.stairs（下行）：踏步 k 的面高 ya+dy*(k+1)/n；stairVisual：同样 top = ya + dy*(k+1)/n
    const top = visual ? ya + dy * (k + 1) / n : ya + dy * (k + (dy < 0 ? 1 : 0)) / n;
    // 踏步前缘的深色防滑条留出来（0.08m），色带只贴在踏面上
    const e0 = Math.min(s0, s1) + 0.02, e1 = Math.max(s0, s1) - 0.09;
    G.slab(e0, e1, top + BAND_BOT, top + BAND_TOP, zc - h, zc + h, c, { ao: false });
    if (k % every === 2) chevron(G, (e0 + e1) / 2, top + CHEV_Y, zc, fx, 0, Math.min(w * 0.9, Math.abs(e1 - e0) * 1.6), cc);
  }
}
/** 自拼桥：每块桥板上一段色带（本地坐标：桥板顶面 y=+0.15，沿 z 长 dz），lanes = [{ dx, col, chev, dirZ }] */
export function bridgeStripe(scene, mat, parent, dz, lanes) {
  const G = new Geo();
  for (const ln of lanes) {
    // 桥板顶面在本地 y=0.15：色带底面离开桥板顶面（以前底面与桥板顶面共面，远处看像两层在抢）
    G.slab(ln.dx - BAND_W / 2, ln.dx + BAND_W / 2, 0.15 + BAND_BOT, 0.15 + BAND_TOP, 0.03, dz - 0.03, hex(ln.col), { ao: false });
    chevron(G, ln.dx, 0.15 + CHEV_Y, dz / 2, 0, ln.dirZ, BAND_W * 0.9, hex(ln.chev));
  }
  const m = G.toMesh('bridgeStripe', scene, mat, parent); m.isVisible = false;
  return m;
}
