/*
 * 福州地铁站台：沿用厦门地铁的站台骨架（XmStation：站台 / 屏蔽门 / 楼梯 / 站厅 / 出口 / 换乘），换福州的皮：
 *   - 白色搪瓷板墙面（不做闽南红砖、燕尾脊）+ 浅灰石材墙裙 + 线路色腰线
 *   - 1 号线红 #CB333B、5 号线紫 #893B67（福州地铁官方线路色）
 *   - 福州火车南站（theme 'fzs'）：蓝色波浪吊顶（站内“海丝”蓝），1↔5 上下层换乘
 * 坐标：root 在 FO（福州南站同一块区域，和厦门北一样从国铁出站层走楼梯下来）。
 */
import { hex } from '../core/geo.js';
import { XmStation } from './xmMetro.js';
import { FZ_LINES, FZ_STATIONS } from '../data/fz-lines.js';
import { FZ_EXITS, FZ_EXIT_TABLE, fzExitZh } from '../data/fz-exits.js';
import { FO } from './fzZones.js';

const THEME = {
  fz: { wall: '#F3F3F0', dado: '#9A9C98', beam: '#C9CBC8', accent: '#CB333B', floor: '#DAD9D4' },
  fzs: { wall: '#EEF2F6', dado: '#7D8A96', beam: '#2D5C8A', accent: '#2D6FA8', floor: '#DADDE0' }
};

export const FZ_NET = {
  O: FO, net: 'fz', LINES: FZ_LINES, STATIONS: FZ_STATIONS, EXITS: FZ_EXITS, TABLE: FZ_EXIT_TABLE, rail: 'fzfzn', exitZh: fzExitZh,
  THEME, theme: 'fz', dado: 'granite', plain: true, sea: '#B8BCC0', header: '#5E6670'
};

export class FzStation extends XmStation {
  constructor(scene, code, N = FZ_NET) { super(scene, code, N); }
  /** 白色搪瓷板：~1.6 m 一块，两种白交替（同一个材质桶，不加 draw） */
  bricks(x0, x1, y0, y1, z0, z1) {
    const P = this.kit.g('wall'), alongX = (x1 - x0) >= (z1 - z0), L = alongX ? x1 - x0 : z1 - z0, n = Math.max(1, Math.round(L / 1.6));
    const T = ['#F4F4F1', '#ECECE8'].map(hex);
    for (let i = 0; i < n; i++) {
      const a = i / n, b = (i + 1) / n - 0.004, c = T[i % 2];
      if (alongX) P.slab(x0 + (x1 - x0) * a, x0 + (x1 - x0) * b, y0, y1, z0, z1, c, { ao: false });
      else P.slab(x0, x1, y0, y1, z0 + (z1 - z0) * a, z0 + (z1 - z0) * b, c, { ao: false });
    }
  }
  /** 福州：门楣 / 吊牌顶不做燕尾脊，只一道细的金属压条 */
  yanwei(G, x0, x1, y, z, d, col) { G.slab(x0, x1, y, y + 0.08, z - d / 2, z + d / 2, hex('#A7ADB3'), { ao: false }); }
  yanweiZ(G, x, y, z0, z1, d) { G.slab(x - d / 2, x + d / 2, y, y + 0.08, z0, z1, hex('#A7ADB3'), { ao: false }); }
  /** 柱头：浅灰方帽（代替闽南燕尾脊） */
  ridgeZ(G, x, yb, zc, half = 0.55) { G.slab(x - 0.5, x + 0.5, yb - 0.04, yb + 0.12, zc - half, zc + half, hex('#D5D7D4'), { ao: false }); }
  /** 福州火车南站：蓝色波浪吊顶（借厦门「扬帆」那套弧板，颜色走主题 accent） */
  ceil(P) {
    if (this.themeKey !== 'fzs') return super.ceil(P);
    this.themeKey = 'sail';
    try { super.ceil(P); } finally { this.themeKey = 'fzs'; }
  }
}
