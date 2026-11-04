/*
 * 福州地铁 1 / 2 / 4 / 5 / 6 号线 + 滨海快线车站数据（第一批 1、5 号线；第二批加 4 号线；第三批加 2、6 号线和滨海快线；福州话报站以后再补）。
 *   线路色：Module:Adjacent_stations/福州地铁（/workspace/fuzhou-research/mod_adj.txt）——2 号线 #046A38、6 号线 #005EB8、滨海快线 #00B0B9
 *   出站换乘（ox）：水部↔闽都、1 号线三叉街↔滨海快线三叉街 是两座独立车站（维基注释），游戏里不连通，只在报站 / 线路图上提示
 *   4 号线 23 站顺序 / 英文名：/workspace/fuzhou-research/tpl_4.txt（中文维基 4 号线车站表，2026-10-31 抓取）；线路色 #FF7F41（福州地铁颜色模板）
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
export const FZ_L4 = '#FF7F41';
export const FZ_L2 = '#046A38';
export const FZ_L6 = '#005EB8';
export const FZ_F1 = '#00B0B9';
/** 滨海快线在游戏里的线路编号（内部键 20；对外显示 badge 'F1' + “滨海快线”，不叫“20号线”） */
export const FZ_BH = 20;

export const FZ_LINES = {
  1: {
    id: 1, zh: '1号线', en: 'Line 1', color: FZ_L1, ink: '#FFFFFF', soft: '#F8DADC', mark: '福满闽都', city: '福州地铁',
    dirs: { sjk: { zh: '三江口', en: 'Sanjiangkou', step: 1 }, xf: { zh: '象峰', en: 'Xiangfeng', step: -1 } },
    stations: ['fzxf', 'fzxs', 'fzlhs', 'fzfz', 'fzdm', 'fzsd', 'fzps', 'fzdjk', 'fznmd', 'fzct', 'fzdd', 'fzst', 'fzscj', 'fzbht', 'fzhlz', 'fzhs', 'fzpx', 'fzcm', 'fzsjc', 'fzll', 'fzfzn', 'fzap', 'fzlc', 'fzxy', 'fzsjk']
  },
  4: {
    id: 4, zh: '4号线', en: 'Line 4', color: FZ_L4, ink: '#FFFFFF', soft: '#FFE3D3', mark: '福州地铁', city: '福州地铁',
    dirs: { dfj: { zh: '帝封江', en: 'Difengjiang', step: 1 }, bz: { zh: '半洲', en: 'Banzhou', step: -1 } },
    stations: ['fzbz', 'fzjx', 'fzht', 'fzjns', 'fzfhc', 'fzlz', 'fzxm', 'fzdjk', 'fzslyy', 'fzdmn', 'fzsjch', 'fzzy', 'fzhy', 'fzhoy', 'fzqy', 'fzgmg', 'fzafz', 'fzhhgy', 'fzhzzx', 'fzlp', 'fzcm', 'fzlzwq', 'fzdfj']
  },
  5: {
    id: 5, zh: '5号线', en: 'Line 5', color: FZ_L5, ink: '#FFFFFF', soft: '#EBD8E3', mark: '福州地铁', city: '福州地铁',
    dirs: { fzn: { zh: '福州火车南站', en: 'Fuzhou South Railway Station', step: 1 }, jxhy: { zh: '荆溪厚屿', en: 'Jingxi Houyu', step: -1 } },
    stations: ['fzjxhy', 'fznldx', 'fzht', 'fzzb', 'fzmr', 'fzjs', 'fzfgl', 'fzpsdd', 'fzxj', 'fzdl', 'fzty', 'fzpy', 'fzws', 'fzgszl', 'fzyx', 'fzdfj', 'fzlzgz', 'fzqj', 'fzlj', 'fzfzn']
  },
  2: {
    id: 2, zh: '2号线', en: 'Line 2', color: FZ_L2, ink: '#FFFFFF', soft: '#D3E8DC', mark: '福州地铁', city: '福州地铁',
    dirs: { yl: { zh: '洋里', en: 'Yangli', step: 1 }, suy: { zh: '苏洋', en: 'Suyang', step: -1 } },
    stations: ['fzsuy', 'fzsdi', 'fzsj', 'fzjy', 'fzfzdx', 'fzdysd', 'fzhting', 'fzjyz', 'fzhw', 'fzjs', 'fzjxg', 'fzxb', 'fznh', 'fzxiy', 'fznmd', 'fzsb', 'fzzyg', 'fzwlt', 'fzqy', 'fzsy', 'fzgs', 'fzyl']
  },
  6: {
    id: 6, zh: '6号线', en: 'Line 6', color: FZ_L6, ink: '#FFFFFF', soft: '#D3E3F4', mark: '福州地铁', city: '福州地铁',
    dirs: { wsh: { zh: '万寿', en: 'Wanshou', step: 1 }, pd: { zh: '潘墩', en: 'Pandun', step: -1 } },
    stations: ['fzpd', 'fzlp', 'fzzl', 'fzlc', 'fzxy', 'fzyq', 'fzhc', 'fzzh', 'fzsxy', 'fzwh', 'fzhsh', 'fzsjg', 'fzxw', 'fzwsh']
  },
  [FZ_BH]: {
    id: FZ_BH, badge: 'F1', zh: '滨海快线', en: 'Binhai Express', color: FZ_F1, ink: '#FFFFFF', soft: '#D0F0F1', mark: '福州地铁', city: '福州地铁',
    // 只做“普通车”（站站停）；真实还有大站车 / 直达车
    dirs: { wl: { zh: '文岭', en: 'Wenling', step: 1 }, fzhcz: { zh: '福州火车站', en: 'Fuzhou Railway Station', step: -1 } },
    stations: ['fzfz', 'fzdmn', 'fzmd', 'fzngy', 'fzscjb', 'fzdfj', 'fzxq', 'fzsz', 'fzdsj', 'fzbhcbd', 'fzjc', 'fzwl']
  }
};

/** 车站：zh / en；x = 本游戏两条线以外的已开通换乘；theme：'fzs' = 福州火车南站（蓝色吊顶 + 漆画） */
export const FZ_STATIONS = {
  // —— 1 号线
  fzxf: { zh: '象峰', en: 'Xiangfeng', x: [] },
  fzxs: { zh: '秀山', en: 'Xiushan', x: [] },
  fzlhs: { zh: '罗汉山', en: 'Luohanshan', x: [] },
  fzfz: { zh: '福州火车站', en: 'Fuzhou Railway Station', x: [] },      // 1 ↔ 滨海快线
  fzdm: { zh: '斗门', en: 'Doumen', x: [] },
  fzsd: { zh: '树兜', en: 'Shudou', x: [] },
  fzps: { zh: '屏山', en: 'Pingshan', x: [] },
  fzdjk: { zh: '东街口', en: 'Dongjiekou', x: [] },
  fznmd: { zh: '南门兜', en: 'Nanmendou', x: [] },
  fzct: { zh: '茶亭', en: 'Chating', x: [] },
  fzdd: { zh: '达道', en: 'Dadao', x: [] },
  fzst: { zh: '上藤', en: 'Shangteng', x: [] },
  fzscj: { zh: '三叉街', en: 'Sanchajie', x: [], ox: [20], twin: 'fzscjb' },   // 滨海快线三叉街是另一座站，出站换乘
  fzbht: { zh: '白湖亭', en: 'Baihuting', x: [] },
  fzhlz: { zh: '葫芦阵', en: 'Huluzhen', x: [] },
  fzhs: { zh: '黄山', en: 'Huangshan', x: [] },
  fzpx: { zh: '排下', en: 'Paixia', x: [] },
  fzcm: { zh: '城门', en: 'Chengmen', x: [] },
  fzsjc: { zh: '三角埕', en: 'Sanjiaocheng', x: [] },
  fzll: { zh: '胪雷', en: 'Lulei', x: [] },
  fzfzn: { zh: '福州火车南站', en: 'Fuzhou South Railway Station', x: [], theme: 'fzs' },   // 1↔5 换乘；B2 1 号线、B3 5 号线
  fzap: { zh: '安平', en: 'Anping', x: [] },
  fzlc: { zh: '梁厝', en: 'Liangcuo', x: [] },
  fzxy: { zh: '下洋', en: 'Xiayang', x: [] },
  fzsjk: { zh: '三江口', en: 'Sanjiangkou', x: [] },
  // —— 5 号线（fzfzn 已在上面）
  fzjxhy: { zh: '荆溪厚屿', en: 'Jingxi Houyu', x: [] },
  fznldx: { zh: '农林大学', en: 'Agriculture and Forestry University', x: [] },
  fzht: { zh: '洪塘', en: 'Hongtang', x: [] },
  fzzb: { zh: '阵坂', en: 'Zhenban', x: [] },
  fzmr: { zh: '马榕', en: 'Marong', x: [] },
  fzjs: { zh: '金山', en: 'Jinshan', x: [] },
  fzfgl: { zh: '凤岗里', en: 'Fenggangli', x: [] },   // 中文维基 5 号线车站表 / 车站条目“凤岗里站”（第三批改正，原写作凤冈里）
  fzpsdd: { zh: '浦上大道', en: 'Pushang Dadao', x: [] },
  fzxj: { zh: '霞镜', en: 'Xiajing', x: [] },
  fzdl: { zh: '东岭', en: 'Dongling', x: [] },
  fzty: { zh: '台屿', en: 'Taiyu', x: [] },
  fzpy: { zh: '盘屿', en: 'Panyu', x: [] },
  fzws: { zh: '吴山', en: 'Wushan', x: [] },
  fzgszl: { zh: '盖山竹榄', en: 'Gaishan Zhulan', x: [] },
  fzyx: { zh: '义序', en: 'Yixu', x: [] },
  fzdfj: { zh: '帝封江', en: 'Difengjiang', x: [] },
  fzlzgz: { zh: '螺洲古镇', en: 'Ancient Luozhou Town', x: [] },
  fzqj: { zh: '前锦', en: 'Qianjin', x: [] },
  fzlj: { zh: '龙江', en: 'Longjiang', x: [] },
  // —— 4 号线（第二批；洪塘 / 东街口 / 城门 / 帝封江 已在上面）
  fzbz: { zh: '半洲', en: 'Banzhou', x: [] },
  fzjx: { zh: '建新', en: 'Jianxin', x: [] },
  fzjns: { zh: '金牛山', en: 'Jinniushan', x: [] },
  fzfhc: { zh: '凤凰池', en: 'Fenghuangchi', x: [] },
  fzlz: { zh: '陆庄', en: 'Luzhuang', x: [] },
  fzxm: { zh: '西门', en: 'Ximen', x: [] },
  fzslyy: { zh: '省立医院', en: 'Provincial Hospital', x: [] },
  fzdmn: { zh: '东门', en: 'Dongmen', x: [] },          // 4 ↔ 滨海快线
  fzsjch: { zh: '三角池', en: 'Sanjiaochi', x: [] },
  fzzy: { zh: '竹屿', en: 'Zhuyu', x: [] },
  fzhy: { zh: '横屿', en: 'Hengyu', x: [] },
  fzhoy: { zh: '后屿', en: 'Houyu', x: [] },
  fzqy: { zh: '前屿', en: 'Qianyu', x: [] },
  fzgmg: { zh: '光明港', en: 'Guangminggang', x: [] },
  fzafz: { zh: '鳌峰洲', en: 'Aofengzhou', x: [] },
  fzhhgy: { zh: '花海公园', en: 'Huahai Park', x: [] },
  fzhzzx: { zh: '会展中心', en: 'Exhibition Center', x: [] },
  fzlp: { zh: '林浦', en: 'Linpu', x: [] },
  fzlzwq: { zh: '螺洲温泉', en: 'Luozhou Hot Spring', x: [] },
  // —— 2 号线（第三批；金山 / 南门兜 / 前屿 已在上面）。顺序 / 英文名：tpl_2.txt（中文维基 2 号线车站表）；只做已开通的苏洋—洋里 22 站
  fzsuy: { zh: '苏洋', en: 'Suyang', x: [] },
  fzsdi: { zh: '沙堤', en: 'Shadi', x: [] },
  fzsj: { zh: '上街', en: 'Shangjie', x: [] },
  fzjy: { zh: '金屿', en: 'Jinyu', x: [] },
  fzfzdx: { zh: '福州大学', en: 'Fuzhou University', x: [] },
  fzdysd: { zh: '董屿·福建师大', en: 'Dongyu / Fujian Normal University', x: [] },
  fzhting: { zh: '厚庭', en: 'Houting', x: [] },
  fzjyz: { zh: '桔园洲', en: 'Juyuanzhou', x: [] },
  fzhw: { zh: '洪湾', en: 'Hongwan', x: [] },
  fzjxg: { zh: '金祥', en: 'Jinxiang', x: [] },
  fzxb: { zh: '祥坂', en: 'Xiangban', x: [] },
  fznh: { zh: '宁化', en: 'Ninghua', x: [] },
  fzxiy: { zh: '西洋', en: 'Xiyang', x: [] },
  fzsb: { zh: '水部', en: 'Shuibu', x: [], ox: [20], twin: 'fzmd' },   // 与滨海快线闽都站出站换乘（两座独立车站）
  fzzyg: { zh: '紫阳', en: 'Ziyang', x: [] },
  fzwlt: { zh: '五里亭', en: 'Wuliting', x: [] },
  fzsy: { zh: '上洋', en: 'Shangyang', x: [] },
  fzgs: { zh: '鼓山', en: 'Gushan', x: [] },
  fzyl: { zh: '洋里', en: 'Yangli', x: [] },
  // —— 6 号线（第三批；林浦 / 梁厝 / 下洋 已在上面）。tpl_6.txt；只做已开通的潘墩—万寿 14 站
  fzpd: { zh: '潘墩', en: 'Pandun', x: [] },
  fzzl: { zh: '樟岚', en: 'Zhanglan', x: [] },
  fzyq: { zh: '营前', en: 'Yingqian', x: [] },
  fzhc: { zh: '航城', en: 'Hangcheng', x: [] },
  fzzh: { zh: '郑和', en: 'Zhenghe', x: [] },
  fzsxy: { zh: '十洋', en: 'Shiyang', x: [] },
  fzwh: { zh: '吴航', en: 'Wuhang', x: [] },
  fzhsh: { zh: '鹤上', en: 'Heshang', x: [] },
  fzsjg: { zh: '沙京', en: 'Shajing', x: [] },
  fzxw: { zh: '下吴', en: 'Xiawu', x: [] },
  fzwsh: { zh: '万寿', en: 'Wanshou', x: [] },
  // —— 滨海快线（第三批；福州火车站 / 东门 / 帝封江 已在上面）。tpl_滨海快线.txt；2025-09-29 开通；只做开通的 12 个停站（盖山 / 莲花山 / 滨海西 预留未开）
  fzmd: { zh: '闽都', en: 'Mindu', x: [], ox: [2], twin: 'fzsb' },   // 与 2 号线水部站出站换乘
  fzngy: { zh: '南公园', en: 'Nangongyuan', x: [] },
  fzscjb: { zh: '三叉街', en: 'Sanchajie', x: [], ox: [1], twin: 'fzscj' },   // 与 1 号线三叉街站出站换乘（两座独立车站）
  fzxq: { zh: '祥谦', en: 'Xiangqian', x: [] },
  fzsz: { zh: '首占', en: 'Shouzhan', x: [] },
  fzdsj: { zh: '大数据', en: 'Dashuju', x: [] },
  fzbhcbd: { zh: '滨海中央商务区', en: 'Binhai CBD', x: [] },
  fzjc: { zh: '机场', en: 'Airport', x: [] },
  fzwl: { zh: '文岭', en: 'Wenling', x: [] }
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
/** 线路名（“2号线” / “滨海快线”）和英文名；badge = 线路牌上的大字（“2” / “F1”），号 = 牌后的小字 */
export const fzLineZh = k => (FZ_LINES[k] ? FZ_LINES[k].zh : k + '号线');
export const fzLineEn = k => (FZ_LINES[k] ? FZ_LINES[k].en : 'Line ' + k);
export const fzBadge = k => (FZ_LINES[k] && FZ_LINES[k].badge) || String(k);
export const fzBadgeSuffix = k => (FZ_LINES[k] && FZ_LINES[k].badge ? '' : '号线');
export function fzIsTerminal(line, code, step) { return fzNext(line, code, step) === null; }
