/**
 * 福州地铁出口（第一批 + 第二批 + 第三批景点站）。
 * 第三批来源：brief.md 景点表；上藤 / 鼓山出入口表来自中文维基（st_上藤站.txt / st_鼓山站__福州_.txt）；东岭 A/B/C 口均到奥体（S37 福州新闻网 2026-09-04）。
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

/** 福州火车南站：出口通道（站房局部坐标，同 xmnStation）。A / B / F：换乘通道（z -84..-76）南墙开口 x 中心，往南上到东广场；
 *  D2：地铁站厅北墙开口 x 中心，往北穿过股道下面上到西广场。位置是示意（真实站的出口在地铁站厅 B1 / 各广场，相对位置未核实） */
export const FZS_EXITS = [
  { n: 'F', x: -70, side: 'S', line: 1, to: ['东广场', '东站房'], toEn: ['East Square', 'East Building'], verified: false },
  { n: 'A', x: -62, side: 'S', line: 5, to: ['东站房7号进站口（左转约20米）'], toEn: ['East Building Entrance 7 (turn left, about 20 m)'] },
  { n: 'B', x: -54, side: 'S', line: 5, to: ['东广场公交', '机场大巴'], toEn: ['East Square buses', 'Airport coach'] },
  { n: 'D2', x: -93.1, side: 'N', line: 1, to: ['西广场公交'], toEn: ['West Square buses'] },
];

/** 每站一个出口（XmStation.buildConcourse / XmMetro.goStreet 用的格式：{ n, x, line, road, to, toEn }） */
const E = (line, n = '', to = [], toEn = []) => ({ n, x: 10, line, road: '', to, toEn, verified: false });
export const FZ_EXITS = {};
for (const [id, L] of Object.entries(FZ_LINES)) for (const c of L.stations) if (!FZ_EXITS[c] && c !== 'fzfzn') FZ_EXITS[c] = E(+id);
// 第二批：有景点的站，出口号按 /workspace/fuzhou-research/brief.md 景点表（verified:true = 有来源；路名只写来源里提到的）
Object.assign(FZ_EXITS, {
  fzdjk: { n: 'C', x: 10, line: 1, road: '杨桥东路', to: ['三坊七巷（南后街）', '达明美食街'], toEn: ['Three Lanes and Seven Alleys (Nanhou Street)', 'Daming Food Street'] },
  // 南门兜：两个能走出去的口 —— G1 于山（主出口，x 10）+ B 乌山（站厅南墙西段 x -14，街区键 fznmd_B）
  //   乌山出口核对（第三批复核）：东南网/福州新闻网 2019-12 南门兜出入口表「B出入口：乌山风景区、乌塔公园、冠亚广场」，B 口步行约 150 m 到乌塔公园（大洋晶典旁）；
  //   三坊七巷官网交通页：D2 西南口约 500 m 到乌山历史风貌区南大门、A1 西北口约 450 m 到北门。我们的景点是乌塔 + 山脚广场 → 用 B。
  fznmd: { n: 'G1', x: 10, line: 1, road: '', to: ['于山风景区（白塔）', '五一广场'], toEn: ['Yushan Hill (White Pagoda)', 'Wuyi Square'],
    more: [{ n: 'B', x: -14, line: 2, road: '', to: ['乌山风景区（乌塔）'], toEn: ['Wushan Hill (Black Pagoda)'], attr: 'fznmd_B' }] },
  // 第三批（brief 景点表 #7 #9 #13）
  fzst: { n: 'B', x: 10, line: 1, road: '上藤路', to: ['烟台山（约600米）'], toEn: ['Yantai Hill (about 600 m)'] },
  fzgs: { n: 'A', x: 10, line: 2, road: '福马路', to: ['鼓山风景区'], toEn: ['Gushan Mountain Scenic Area'] },
  fzdl: { n: 'A', x: 10, line: 5, road: '', to: ['海峡奥体中心'], toEn: ['Straits Olympic Sports Center'] },
  fzdd: { n: 'C', x: 10, line: 1, road: '', to: ['上下杭'], toEn: ['Shangxiahang Historic District'] },
  fzxm: { n: 'B', x: 10, line: 4, road: '', to: ['西湖公园', '福建博物院'], toEn: ['West Lake Park', 'Fujian Museum'], attr: 'fzriver',   // 2A：西湖公园并进内河场景（B 口亭在公园牌楼南面）
    // 内河 1A：C 口出来是杨桥路白马河边（西水关码头，游船 A 线）；出口号示意（verified:false），街区见 js/world/fzRiver.js
    more: [{ n: 'C', x: -14, line: 4, road: '杨桥路', to: ['白马河', '西水关码头'], toEn: ['Baima River', 'Xishuiguan Pier'], attr: 'fzriver', verified: false }] },
  // 西洋 A：东西河边（黎明湖码头，游船 A 线）；出口号示意（verified:false）
  fzxiy: { n: 'A', x: 10, line: 2, road: '', to: ['东西河', '黎明湖码头'], toEn: ['Dongxi River', 'Liming Lake Pier'], attr: 'fzriver', verified: false },
  // 内河 1B（东线，另一片河网 tools/fzriver/gen_e.py）：出口号来自福州新闻网 2025-04「乘地铁游福州」（斗门 C 温泉公园、光明港 D 光明港码头），东门 C 按计划示意；都未按站内导向图核实（verified:false）
  fzdm: { n: 'C', x: 10, line: 1, road: '', to: ['晋安河', '温泉公园码头'], toEn: ['Jin\'an River', 'Wenquan Park Pier'], attr: 'fzriver', verified: false },
  fzdmn: { n: 'C', x: 10, line: 4, road: '', to: ['晋安河', '东门停靠点（内河游船）'], toEn: ['Jin\'an River', 'Dongmen Boat Stop'], attr: 'fzriver', verified: false },
  fzgmg: { n: 'D', x: 10, line: 4, road: '', to: ['光明港', '光明港码头'], toEn: ['Guangminggang River', 'Guangminggang Pier'], attr: 'fzriver', verified: false },
});
// 福州火车南站（fzfzn）不在这里：它的站厅就是国铁出站层，出口通道 A / B / F / D2 在 FzsStation 里（FZS_EXITS），不走街区

/** 站厅出入口信息牌（只有核过的站才有） */
export const FZ_EXIT_TABLE = {
  fzfzn: FZS_EXITS.map(e => [e.n, e.to.join('、')]),
  // 只列 brief 里核过的口；其余口没核实，不上牌
  fzdjk: [['C', '杨桥东路、三坊七巷（南后街北口，约400米）']],
  fznmd: [['G1', '于山风景区（白塔）、五一广场'], ['A1', '三坊七巷南口（约600米）'], ['B', '乌山风景区']],
  fzdd: [['C', '上下杭（约850米）']],
  fzxm: [['B', '西湖公园（约800米）、福建博物院'], ['C', '杨桥路、白马河、西水关码头（内河游船）']],
  fzxiy: [['A', '东西河、黎明湖码头（内河游船）']],
  fzdm: [['C', '晋安河、温泉公园码头（内河游船）']],
  fzdmn: [['C', '晋安河、东门停靠点（内河游船）']],
  fzgmg: [['D', '光明港、光明港码头（内河游船）']],
  fzst: [['A', '上藤路万春巷路口东侧'], ['B', '烟台山（约600米）'], ['C', '六一南路、汇达广场']],
  fzgs: [['A', '鼓山风景区（福马路东侧）'], ['B', '鼓山路口、鼓山公交总站'], ['C', '福马路东侧、省革命历史纪念馆'], ['D', '福马路东侧、廨院公交总站']],
  fzdl: [['A', '海峡奥体中心'], ['B', '海峡奥体中心'], ['C', '海峡奥体中心']],
};
export const fzExitZh = n => /^[0-9]+$/.test(n) ? `${n}号出口` : `${n}出口`;
export { FZ_STATIONS };
