/*
 * 厦门地铁 1 号线、2 号线车站数据（游戏里列车真正停靠的全部车站）。
 *
 * 数据来源（2026-10-22 核对）：
 *   [1] 中文维基百科 厦门轨道交通1号线
 *       https://zh.wikipedia.org/wiki/厦门轨道交通1号线
 *       —— 24 站顺序（岩内 … 镇海路）、英文站名、标识色橙色 C0 M68 Y100 K0 ≈ #F2711C、
 *          闽南古厝识别符号、开通 2017-12-31；厦门北站为地下一层侧式，可换乘 4 号线
 *   [2] 中文维基百科 厦门轨道交通2号线
 *       https://zh.wikipedia.org/wiki/厦门轨道交通2号线
 *       —— 站序（天竺山 … 五缘湾）、标识色绿色 C69 M0 Y100 K0（鹭岛绿）、凤凰木识别符号、
 *          开通 2019-12-25；中国大陆首条海底地铁盾构隧道（邮轮中心—海沧湾公园）
 *   [3] 中文维基百科 厦门地铁 / 东南网厦门 2019-12-24
 *       —— 1↔2 唯一换乘站：吕厝；换乘标识 1→2 用绿色、2→1 用闽南红
 *   [4] 厦门本地宝 / 东南网：2 号线“一线一景·海上花园生态绿岛”；五缘湾站主题“扬帆再起航”；
 *       古地石站名取自岩石地名，本游戏用岩石色站台作 2 号线特色镜头
 *
 * 英文站名按厦门地铁导向惯例用拼音 / 官方英文（厦门北站 Xiamen North Railway Station）。
 * 方向：数组顺序 = 站号递增。1 号线递增 = 往镇海路（'zhl'），递减 = 往岩内（'yan'）；
 *       2 号线递增 = 往五缘湾（'wyw'），递减 = 往天竺山（'tzs'）。
 * code 与广州地铁错开（广州用 gyq/njs…），语音片段 id 用 xm. 前缀在 phrases 里拼。
 */
export const XM_L1 = '#F2711C';   // 闽南红 / 橙红 C0 M68 Y100 K0
export const XM_L2 = '#00A651';   // 鹭岛绿（官方 CMYK C69 M0 Y100 K0 的实用色）

export const XM_LINES = {
  1: {
    id: 1, zh: '1号线', en: 'Line 1', color: XM_L1, ink: '#FFFFFF', soft: '#FDE4D4',
    mark: '闽南古厝', city: '厦门地铁',
    dirs: {
      zhl: { zh: '镇海路', en: 'Zhenhailu', step: 1 },
      yan: { zh: '岩内', en: 'Yannei', step: -1 }
    },
    stations: ['yan', 'xmnb', 'tsl', 'jmd', 'jsr', 'cyg', 'grn', 'xjl', 'xlv', 'yby', 'jmx', 'gqi', 'dqn', 'hjy', 'tbn', 'wsp', 'lcu', 'lhj', 'lbn', 'hbd', 'wza', 'jjc', 'zsp', 'zhl']
  },
  2: {
    id: 2, zh: '2号线', en: 'Line 2', color: XM_L2, ink: '#FFFFFF', soft: '#D4F0E0',
    mark: '凤凰木', city: '厦门地铁',
    dirs: {
      wyw: { zh: '五缘湾', en: 'Wuyuanwan', step: 1 },
      tzs: { zh: '天竺山', en: 'Tianzhushan', step: -1 }
    },
    // 一期开通站序（含马銮中心 / 鼎美暂缓开通的相邻站仍列入，游戏里可停；与维基一致）
    stations: ['tzs', 'dfu', 'dya', 'dme', 'mlz', 'xyd', 'xan', 'wjl', 'mql', 'hxz', 'hsw', 'hcw', 'ylz', 'jyl', 'hbz', 'tyz', 'yxd', 'lcu', 'jtou', 'hpu', 'ctg', 'gds', 'ldo', 'rjy', 'hcu', 'gys', 'dzh', 'jrz', 'wto', 'sdy', 'zzh', 'wyw']
  }
};

/** 车站：zh / en；x = 已开通的其他换乘（本网内另一条线之外）；theme = 站台装修主题键 */
export const XM_STATIONS = {
  // —— 1 号线
  yan: { zh: '岩内', en: 'Yannei', x: [] },
  xmnb: { zh: '厦门北站', en: 'Xiamen North Railway Station', x: [4], theme: 'minnan', side: true },  // 真实：地下一层侧式
  tsl: { zh: '天水路', en: 'Tianshui Lu', x: [] },
  jmd: { zh: '集美大道', en: 'Jimei Dadao', x: [] },
  jsr: { zh: '集美软件园', en: 'Jimei Software Park', x: [] },
  cyg: { zh: '诚毅广场', en: 'Chengyi Guangchang', x: [] },
  grn: { zh: '官任', en: 'Guanren', x: [6] },
  xjl: { zh: '杏锦路', en: 'Xingjin Lu', x: [] },
  xlv: { zh: '杏林村', en: 'Xinglin Cun', x: [] },
  yby: { zh: '园博苑', en: 'Yuanboyuan', x: [] },
  jmx: { zh: '集美学村', en: 'Jimei School Village', x: [], theme: 'jiageng' },  // 真实：高架
  gqi: { zh: '高崎', en: 'Gaoqi', x: [] },
  dqn: { zh: '殿前', en: 'Dianqian', x: [] },
  hjy: { zh: '火炬园', en: 'Torch Hi-Tech Park', x: [3] },
  tbn: { zh: '塘边', en: 'Tangbian', x: [] },
  wsp: { zh: '乌石浦', en: 'Wushipu', x: [] },
  lcu: { zh: '吕厝', en: 'Lücuo', x: [], theme: 'transfer' },                 // 1↔2 唯一换乘
  lhj: { zh: '莲花路口', en: 'Lianhua Lukou', x: [] },
  lbn: { zh: '莲坂', en: 'Lianban', x: [] },
  hbd: { zh: '湖滨东路', en: 'Hubin Donglu', x: [3] },
  wza: { zh: '文灶', en: 'Wenzao', x: [] },
  jjc: { zh: '将军祠', en: 'Jiangjunci', x: [] },
  zsp: { zh: '中山公园', en: 'Zhongshan Gongyuan', x: [] },
  zhl: { zh: '镇海路', en: 'Zhenhailu', x: [], side: true },
  // —— 2 号线（lcu 已在上面）
  tzs: { zh: '天竺山', en: 'Tianzhushan', x: [] },
  dfu: { zh: '东孚', en: 'Dongfu', x: [] },
  dya: { zh: '东瑶', en: 'Dongyao', x: [] },
  dme: { zh: '鼎美', en: 'Dingmei', x: [6] },
  mlz: { zh: '马銮中心', en: 'Maluan Zhongxin', x: [4, 6] },
  xyd: { zh: '新阳大道', en: 'Xinyang Dadao', x: [] },
  xan: { zh: '新垵', en: "Xin'an", x: [] },
  wjl: { zh: '翁角路', en: 'Wengjiao Lu', x: [] },
  mql: { zh: '马青路', en: 'Maqing Lu', x: [] },
  hxz: { zh: '海沧行政中心', en: 'Haicang Xingzheng Zhongxin', x: [] },
  hsw: { zh: '海沧商务中心', en: 'Haicang Shangwu Zhongxin', x: [] },
  hcw: { zh: '海沧湾公园', en: 'Haicangwan Gongyuan', x: [], theme: 'sea' },
  ylz: { zh: '邮轮中心', en: 'Cruise Center', x: [], theme: 'sail' },
  jyl: { zh: '建业路', en: 'Jianye Lu', x: [] },
  hbz: { zh: '湖滨中路', en: 'Hubin Zhonglu', x: [] },
  tyz: { zh: '体育中心', en: 'Tiyu Zhongxin', x: [3] },
  yxd: { zh: '育秀东路', en: 'Yuxiu Donglu', x: [] },
  jtou: { zh: '江头', en: 'Jiangtou', x: [] },
  hpu: { zh: '后埔', en: 'Houpu', x: [] },
  ctg: { zh: '蔡塘', en: 'Caitang', x: [] },
  gds: { zh: '古地石', en: 'Gudishi', x: [], theme: 'rock' },                 // 岩石色特色站
  ldo: { zh: '岭兜', en: 'Lingdou', x: [] },
  rjy: { zh: '软件园二期', en: 'Software Park Phase II', x: [] },
  hcu: { zh: '何厝', en: 'Hecuo', x: [] },
  gys: { zh: '观音山', en: 'Guanyinshan', x: [] },
  dzh: { zh: '东宅', en: 'Dongzhai', x: [] },
  jrz: { zh: '两岸金融中心', en: 'Cross-Strait Financial Center', x: [] },
  wto: { zh: '五通', en: 'Wutong', x: [] },
  sdy: { zh: '湿地公园', en: 'Wetland Park', x: [], theme: 'sea' },
  zzh: { zh: '钟宅', en: 'Zhongzhai', x: [] },
  wyw: { zh: '五缘湾', en: 'Wuyuanwan', x: [3], theme: 'sail' }                // “扬帆再起航”
};

for (const [id, l] of Object.entries(XM_LINES)) l.stations.forEach(c => {
  const s = XM_STATIONS[c]; if (!s) throw new Error('missing XM station ' + c);
  s.code = c; (s.lines = s.lines || []).push(+id);
});

export function xmStationIndex(line, code) { return XM_LINES[line].stations.indexOf(code); }
export function xmDirStep(line, dir) { return XM_LINES[line].dirs[dir].step; }
export function xmDirFor(line, step) { return Object.keys(XM_LINES[line].dirs).find(k => XM_LINES[line].dirs[k].step === step); }
export function xmNext(line, code, step) {
  const L = XM_LINES[line].stations, i = L.indexOf(code) + step;
  return i >= 0 && i < L.length ? L[i] : null;
}
export function xmIsTerminal(line, code, step) { return xmNext(line, code, step) === null; }
export function xmTransfers(code, exceptLine) {
  const s = XM_STATIONS[code];
  return [...s.lines.filter(l => l !== exceptLine), ...s.x];
}
