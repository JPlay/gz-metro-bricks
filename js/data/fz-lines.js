/*
 * 福州地铁 1 号线、5 号线车站数据（第一批：只做这两条线；福州话报站以后再补）。
 *
 * 数据来源（2026-10-31 核对）：
 *   [1] 英文维基百科 Line 1 (Fuzhou Metro) https://en.wikipedia.org/wiki/Line_1_(Fuzhou_Metro)
 *       —— 25 站顺序（象峰 … 三江口）、英文站名、换乘（东街口 4、南门兜 2、城门 4、福州火车南站 5、梁厝 / 下洋 6）
 *          车辆 B 型 6 节；线路色红色（标准色 ≈ #CB333B）
 *   [2] 英文维基百科 Line 5 (Fuzhou Metro) https://en.wikipedia.org/wiki/Line_5_(Fuzhou_Metro)
 *       —— 20 站顺序（荆溪厚屿 … 福州火车南站）、英文站名（凤冈里 / 螺洲古镇 Ancient Luozhou Town 等）；紫色（≈ #893B67）
 *   [3] /workspace/fuzhou-research/brief.md §2 —— 福州火车南站：站厅 B1、1 号线站台 B2（东西向）、5 号线站台 B3（南北向）；
 *       1 号线“福满闽都”主题；出入口 A（5 号线，近东站房 7 号进站口）、B（东侧公交 / 机场大巴）、D2（1 号线，西广场公交）、F
 * 方向：数组顺序 = 站号递增。1 号线递增 = 往三江口（'sjk'），递减 = 往象峰（'xf'）；
 *       5 号线递增 = 往福州火车南站（'fzn'），递减 = 往荆溪厚屿（'jxhy'）。
 * code 统一 fz 前缀（和广州 / 厦门错开）；语音片段 id 用 fz. 前缀。
 */
export const FZ_L1 = '#CB333B';
export const FZ_L5 = '#893B67';

export const FZ_LINES = {
  1: {
    id: 1, zh: '1号线', en: 'Line 1', color: FZ_L1, ink: '#FFFFFF', soft: '#F8DADC', mark: '福满闽都', city: '福州地铁',
    dirs: { sjk: { zh: '三江口', en: 'Sanjiangkou', step: 1 }, xf: { zh: '象峰', en: 'Xiangfeng', step: -1 } },
    stations: ['fzxf', 'fzxs', 'fzlhs', 'fzfz', 'fzdm', 'fzsd', 'fzps', 'fzdjk', 'fznmd', 'fzct', 'fzdd', 'fzst', 'fzscj', 'fzbht', 'fzhlz', 'fzhs', 'fzpx', 'fzcm', 'fzsjc', 'fzll', 'fzfzn', 'fzap', 'fzlc', 'fzxy', 'fzsjk']
  },
  5: {
    id: 5, zh: '5号线', en: 'Line 5', color: FZ_L5, ink: '#FFFFFF', soft: '#EBD8E3', mark: '福州地铁', city: '福州地铁',
    dirs: { fzn: { zh: '福州火车南站', en: 'Fuzhou South Railway Station', step: 1 }, jxhy: { zh: '荆溪厚屿', en: 'Jingxi Houyu', step: -1 } },
    stations: ['fzjxhy', 'fznldx', 'fzht', 'fzzb', 'fzmr', 'fzjs', 'fzfgl', 'fzpsdd', 'fzxj', 'fzdl', 'fzty', 'fzpy', 'fzws', 'fzgszl', 'fzyx', 'fzdfj', 'fzlzgz', 'fzqj', 'fzlj', 'fzfzn']
  }
};

/** 车站：zh / en；x = 本游戏两条线以外的已开通换乘；theme：'fzs' = 福州火车南站（蓝色吊顶 + 漆画） */
export const FZ_STATIONS = {
  // —— 1 号线
  fzxf: { zh: '象峰', en: 'Xiangfeng', x: [] },
  fzxs: { zh: '秀山', en: 'Xiushan', x: [] },
  fzlhs: { zh: '罗汉山', en: 'Luohanshan', x: [] },
  fzfz: { zh: '福州火车站', en: 'Fuzhou Railway Station', x: [] },      // 滨海快线（市域线，不在本游戏里）
  fzdm: { zh: '斗门', en: 'Doumen', x: [] },
  fzsd: { zh: '树兜', en: 'Shudou', x: [] },
  fzps: { zh: '屏山', en: 'Pingshan', x: [] },
  fzdjk: { zh: '东街口', en: 'Dongjiekou', x: [4] },
  fznmd: { zh: '南门兜', en: 'Nanmendou', x: [2] },
  fzct: { zh: '茶亭', en: 'Chating', x: [] },
  fzdd: { zh: '达道', en: 'Dadao', x: [] },
  fzst: { zh: '上藤', en: 'Shangteng', x: [] },
  fzscj: { zh: '三叉街', en: 'Sanchajie', x: [] },
  fzbht: { zh: '白湖亭', en: 'Baihuting', x: [] },
  fzhlz: { zh: '葫芦阵', en: 'Huluzhen', x: [] },
  fzhs: { zh: '黄山', en: 'Huangshan', x: [] },
  fzpx: { zh: '排下', en: 'Paixia', x: [] },
  fzcm: { zh: '城门', en: 'Chengmen', x: [4] },
  fzsjc: { zh: '三角埕', en: 'Sanjiaocheng', x: [] },
  fzll: { zh: '胪雷', en: 'Lulei', x: [] },
  fzfzn: { zh: '福州火车南站', en: 'Fuzhou South Railway Station', x: [], theme: 'fzs' },   // 1↔5 换乘；B2 1 号线、B3 5 号线
  fzap: { zh: '安平', en: 'Anping', x: [] },
  fzlc: { zh: '梁厝', en: 'Liangcuo', x: [6] },
  fzxy: { zh: '下洋', en: 'Xiayang', x: [6] },
  fzsjk: { zh: '三江口', en: 'Sanjiangkou', x: [] },
  // —— 5 号线（fzfzn 已在上面）
  fzjxhy: { zh: '荆溪厚屿', en: 'Jingxi Houyu', x: [] },
  fznldx: { zh: '农林大学', en: 'Agriculture and Forestry University', x: [] },
  fzht: { zh: '洪塘', en: 'Hongtang', x: [4] },
  fzzb: { zh: '阵坂', en: 'Zhenban', x: [] },
  fzmr: { zh: '马榕', en: 'Marong', x: [] },
  fzjs: { zh: '金山', en: 'Jinshan', x: [2] },
  fzfgl: { zh: '凤冈里', en: 'Fenggangli', x: [] },
  fzpsdd: { zh: '浦上大道', en: 'Pushang Dadao', x: [] },
  fzxj: { zh: '霞镜', en: 'Xiajing', x: [] },
  fzdl: { zh: '东岭', en: 'Dongling', x: [] },
  fzty: { zh: '台屿', en: 'Taiyu', x: [] },
  fzpy: { zh: '盘屿', en: 'Panyu', x: [] },
  fzws: { zh: '吴山', en: 'Wushan', x: [] },
  fzgszl: { zh: '盖山竹榄', en: 'Gaishan Zhulan', x: [] },
  fzyx: { zh: '义序', en: 'Yixu', x: [] },
  fzdfj: { zh: '帝封江', en: 'Difengjiang', x: [4] },
  fzlzgz: { zh: '螺洲古镇', en: 'Ancient Luozhou Town', x: [] },
  fzqj: { zh: '前锦', en: 'Qianjin', x: [] },
  fzlj: { zh: '龙江', en: 'Longjiang', x: [] }
};

for (const [id, l] of Object.entries(FZ_LINES)) l.stations.forEach(c => {
  const s = FZ_STATIONS[c]; if (!s) throw new Error('missing FZ station ' + c);
  s.code = c; (s.lines = s.lines || []).push(+id);
});

export function fzDirFor(line, step) { return Object.keys(FZ_LINES[line].dirs).find(k => FZ_LINES[line].dirs[k].step === step); }
export function fzNext(line, code, step) {
  const L = FZ_LINES[line].stations, i = L.indexOf(code) + step;
  return i >= 0 && i < L.length ? L[i] : null;
}
export function fzTransfers(code, exceptLine) { const s = FZ_STATIONS[code]; return [...s.lines.filter(l => l !== exceptLine), ...s.x]; }
export function fzIsTerminal(line, code, step) { return fzNext(line, code, step) === null; }
