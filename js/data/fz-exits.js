/**
 * 福州地铁出口（第一批）。
 *
 * 福州火车南站（fzfzn）—— 来源：福州市政府网 2023-12-28《福州火车南站地铁—铁路换乘路线有变化》
 *   https://www.fuzhou.gov.cn/zgfzzt/qyrz/gyfz/202312/t20231229_4747188.htm ；福州新闻网 2023-12-24
 *   https://news.fznews.com.cn/fzxw/20231224/G5z3YV349A.shtml ；/workspace/fuzhou-research/brief.md §1.2
 *   - A 口（5 号线）：东站房南侧安检进站；出 A 口左转约 20 m 到东站房 7 号进站口
 *   - B 口（5 号线）：东广场公交、机场大巴
 *   - D2 口（1 号线）：西广场公交
 *   - F 口：高峰期也可走 B、F 口进站（F 口通往：东广场 / 东站房，具体去向未核实）
 *   - 高铁到达旅客从东站房“出站口 5”直接进地铁，免二次安检；老站房 3 号口自 2023-12-25 起关闭（游戏不做）
 *   原文抓取超时，以上来自搜索摘要，出口细节上线前要按“福州地铁”App 再核。
 *
 * 其他车站：第一批只给一个“出口”（不写出口号，去向留空），出站后是默认街口（FzStreet.plain）。
 *   这些出口号 **未核实**（verified:false），第二批按福州地铁官方 / 维基各站条目补。
 */
import { FZ_LINES, FZ_STATIONS } from './fz-lines.js';

/** 福州火车南站：地铁站厅（国铁出站层 B1）里的出口通道（x = 站厅南 / 北墙开口中心，站厅坐标同 xmnStation 的 MT 区） */
export const FZS_EXITS = [
  { n: 'F', x: -105.5, side: 'S', line: 1, to: ['东广场', '东站房'], toEn: ['East Square', 'East Building'], verified: false },
  { n: 'A', x: -98.5, side: 'S', line: 5, to: ['东站房7号进站口（左转约20米）'], toEn: ['East Building Entrance 7 (turn left, about 20 m)'] },
  { n: 'B', x: -91.5, side: 'S', line: 5, to: ['东广场公交', '机场大巴'], toEn: ['East Square buses', 'Airport coach'] },
  { n: 'D2', x: -99, side: 'N', line: 1, to: ['西广场公交'], toEn: ['West Square buses'] },
];

/** 每站一个出口（XmStation.buildConcourse / XmMetro.goStreet 用的格式：{ n, x, line, road, to, toEn }） */
const E = (line, n = '', to = [], toEn = []) => ({ n, x: 10, line, road: '', to, toEn, verified: false });
export const FZ_EXITS = {};
for (const [id, L] of Object.entries(FZ_LINES)) for (const c of L.stations) if (!FZ_EXITS[c]) FZ_EXITS[c] = E(+id);
// 福州火车南站：地铁站厅就是国铁出站层，出口通道单独做（FzsStation），这里只占位，出站去街区走 A 口
FZ_EXITS.fzfzn = { n: 'A', x: 10, line: 5, road: '', to: FZS_EXITS[1].to, toEn: FZS_EXITS[1].toEn };

/** 站厅出入口信息牌（只有核过的站才有） */
export const FZ_EXIT_TABLE = {
  fzfzn: FZS_EXITS.map(e => [e.n, e.to.join('、')]),
};
export const fzExitZh = n => /^[0-9]+$/.test(n) ? `${n}号出口` : `${n}出口`;
export { FZ_STATIONS };
