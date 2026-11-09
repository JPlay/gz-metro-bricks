/*
 * 厦门地铁 1 号线、2 号线、3 号线、4 号线、6 号线车站数据（游戏里列车真正停靠的全部车站）。
 *
 * 数据来源（1、2 号线 2026-10-22 核对；3、4 号线 2026-11-08 核对；6 号线 2026-11-09 核对）：
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
 *   [5] 中文维基百科 厦门轨道交通3号线（2026-11-08 查阅）
 *       https://zh.wikipedia.org/wiki/厦门轨道交通3号线
 *       —— 运营段 厦门火车站—蔡厝 21 站（2021-06-25 开通；国际博览中心 / 东界 / 洪坑 / 翔安市民公园 2023-06-25 启用，
 *          浦边 2022-09-05 启用）；标识色青色 C63 M0 Y18 K0（云天青），标志符号白鹭；换乘：湖滨东路、火炬园 ↔ 1 号线，
 *          体育中心、五缘湾 ↔ 2 号线，洪坑 ↔ 4 号线（复用 hkg，双向步行换乘）。
 *          南延段（沙坡尾 … 上李）在建、蔡厝以东到翔安机场段未开通：游戏里都不做。
 *   [6] 地铁通 MetroMan 厦门地铁3号线 https://www.metroman.cn/cities/xiamen/lines/line-3（2026-11-08 查阅）
 *       —— 同样 21 站、同样站序；线路色 #30BFD6；官方英文站名（HR Service Center、Huli Park …）
 *   [7] 东南网 2021-06-10 http://xm.fjsen.com/2021-06/10/content_30751956.htm
 *       —— 3 号线车站装修：标准站白色墙面 / 柱面 + 云天青腰带；特色站厦门火车站「时光之旅」（白鹭 + 铁轨车轮意象，付费区云天青）
 *
 *   [8] 地铁通 MetroMan 厦门地铁4号线（2026-11-08 查阅）
 *       https://www.metroman.cn/cities/xiamen/lines/line-4
 *       —— 集美软件园北、后溪、厦门北站、官浔、丙洲、城场、洪坑、前浯，8 站顺序 / 英文名；厦门北 ↔ 1、洪坑 ↔ 3
 *   [9] 中文维基百科 厦门轨道交通4号线 / 前浯站 / 厦门轨道交通颜色模板（2026-11-08 查阅）
 *       https://zh.wikipedia.org/wiki/厦门轨道交通4号线
 *       https://zh.wikipedia.org/wiki/前浯站
 *       https://zh.wikipedia.org/wiki/Template:厦门轨道交通颜色
 *       —— 2026-09-16 开通试乘；前浯 Qianwu 为临时终点；红色 C0 M100 Y100 K0 / #FF0000、中华白海豚符号
 *   [10] 厦门本地宝 2026-09-02 / 2026-09-18（2026-11-08 查阅）
 *       http://xm.bendibao.com/traffic/202691/97285.shtm
 *       http://xm.bendibao.com/traffic/2026918/97393.shtm
 *       —— 集美软件园北—前浯 8 站，西岩跳停、翔安机场不开放；官浔 6 号线只留规划占位（不建设）
 *   [11] 厦门日报 / 厦门网 2026-09-15（2026-11-08 查阅）
 *       https://news.xmnn.cn/xmxw/202609/t20260915_450952.html
 *       —— 4 号线白色为底、红色点缀、现代简约、中华白海豚；本游戏仅标准模板，无指定特色站
 *
 *   [12] 地铁通 MetroMan 厦门地铁6号线（2026-11-09 查阅）
 *       https://www.metroman.cn/cities/xiamen/lines/line-6
 *       —— 角江路 … 华侨大学 17 站顺序 / 官方英文名（Jiaojiang Road、Jiaomei Center、Maluan Center、Huaqiao University …）；
 *          鼎美、马銮中心 ↔ 2 号线，官任 ↔ 1 号线
 *   [13] 中文维基百科 厦门轨道交通6号线 / Module:Adjacent stations/厦门轨道交通（2026-11-09 查阅）
 *       https://zh.wikipedia.org/wiki/厦门轨道交通6号线
 *       https://zh.wikipedia.org/wiki/Module:Adjacent_stations/厦门轨道交通（Template:厦门轨道交通颜色 读这里）
 *       —— 标志色紫色 C50 M90 Y0 K0、颜色模板 #93328E；标示符号三角梅；2026-09-16 角江路—华侨大学开放试乘；
 *          陈井 预计 2027-06 启用（未开通）；龙江明珠、石美、孙厝、嘉庚体育馆、凤林 未开通；马銮中心 4 号线仅规划
 *   [14] 厦门本地宝 2026-09-02 http://xm.bendibao.com/traffic/202691/97286.shtm
 *       厦门广电网 2026-09-01 https://www.xmtv.cn/xmtv/2026-09-01/7132de37d77f6f85.html（2026-11-09 查阅）
 *       —— 试乘开行角江路站至华侨大学站交路，陈井站跳停；换乘：官任（1）、鼎美（2）、马銮中心（2）、华侨大学（BRT）；
 *          官浔 只换乘 4 号线和 BRT（不是 6 号线）
 *
 * 英文站名按厦门地铁导向惯例用拼音 / 官方英文（厦门北站 Xiamen North Railway Station）。
 * 方向：数组顺序 = 站号递增。1 号线递增 = 往镇海路（'zhl'），递减 = 往岩内（'yan'）；
 *       2 号线递增 = 往五缘湾（'wyw'），递减 = 往天竺山（'tzs'）；
 *       3 号线递增 = 往蔡厝（'ccuo'），递减 = 往厦门火车站（'xmhc'）；4 号线递增 = 往前浯（'qwu'），递减 = 往集美软件园北（'jsrb'）；
 *       6 号线递增 = 往华侨大学（'hqdx'），递减 = 往角江路（'jjl'）。
 * 换乘站共用同一个 code（湖滨东路 hbd、火炬园 hjy、体育中心 tyz、五缘湾 wyw）：注册循环把 3 号线也写进 s.lines，
 *       车站就自动建成上下两层站台 + 中间换乘楼梯（和吕厝 1↔2 同一套）。3 号线新站的 theme 默认取线路的 theme（'xm3' 标准站）。
 * code 与广州地铁错开（广州用 gyq/njs…），语音片段 id 用 xm. 前缀在 phrases 里拼。
 */
export const XM_L1 = '#F2711C';   // 闽南红 / 橙红 C0 M68 Y100 K0
export const XM_L2 = '#00A651';   // 鹭岛绿（官方 CMYK C69 M0 Y100 K0 的实用色）
export const XM_L3 = '#30BFD6';   // 云天青（官方 CMYK C63 M0 Y18 K0；MetroMan 线路色 #30BFD6）

export const XM_L4 = '#FF0000';   // 官方红 C0 M100 Y100 K0；与现有 1 号线 #F2711C 橙红明显区分，未另调色
export const XM_L6 = '#93328E';   // 紫色 C50 M90 Y0 K0（维基颜色模板 #93328E）；与 1 橙红 / 2 绿 / 3 青 / 4 红都分得开

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
  },
  3: {
    id: 3, zh: '3号线', en: 'Line 3', color: XM_L3, ink: '#FFFFFF', soft: '#D6F2F7',
    mark: '白鹭', city: '厦门地铁', theme: 'xm3',   // 标准站：白墙 + 云天青腰带 + 白鹭
    dirs: {
      ccuo: { zh: '蔡厝', en: 'Caicuo', step: 1 },
      xmhc: { zh: '厦门火车站', en: 'Xiamen Railway Station', step: -1 }
    },
    // 运营段 21 站（南延段、蔡厝以东机场段未开通，不做）
    stations: ['xmhc', 'hbd', 'tyz', 'rczx', 'hlgy', 'hrl', 'hjy', 'xds', 'adou', 'bsh', 'hlcx', 'wyw', 'gjbl', 'djie', 'hkg', 'lqn', 'glo', 'xasm', 'pbn', 'hcun', 'ccuo']
  },
  4: {
    id: 4, zh: '4号线', en: 'Line 4', color: XM_L4, ink: '#FFFFFF', soft: '#FFE0E0',
    mark: '白海豚', city: '厦门地铁', theme: 'xm4', // 中华白海豚；标准模板，特色站待美术指定
    dirs: {
      qwu: { zh: '前浯', en: 'Qianwu', step: 1 },
      jsrb: { zh: '集美软件园北', en: 'Jimei Software Park North', step: -1 }
    },
    // 仅运营段：西岩跳停，不做；前浯以东（洞庭 / 机场西 / 翔安机场）不开放
    stations: ['jsrb', 'hxi', 'xmnb', 'gxn', 'bzhou', 'cch', 'hkg', 'qwu']
  },
  6: {
    id: 6, zh: '6号线', en: 'Line 6', color: XM_L6, ink: '#FFFFFF', soft: '#F0DDF0',
    mark: '三角梅', city: '厦门地铁', theme: 'xm6', // 三角梅；白墙标准模板，不做特色站
    dirs: {
      hqdx: { zh: '华侨大学', en: 'Huaqiao University', step: 1 },
      jjl: { zh: '角江路', en: 'Jiaojiang Road', step: -1 }
    },
    // 仅试乘运营段 角江路—华侨大学；陈井 未开通（列车通过不停，不建站）；龙江明珠 / 石美 / 孙厝以东不做
    stations: ['jjl', 'jmzx', 'wpl', 'jhl', 'jmdo', 'ynong', 'ldai', 'dme', 'mlz', 'xbin', 'btou', 'xbn', 'nmao', 'dren', 'grn', 'xlw', 'hqdx']
  }
};

/** 车站：zh / en；x = 已开通的其他换乘（本网内另一条线之外）；theme = 站台装修主题键 */
export const XM_STATIONS = {
  // —— 1 号线
  yan: { zh: '岩内', en: 'Yannei', x: [] },
  xmnb: { zh: '厦门北站', en: 'Xiamen North Railway Station', x: [], theme: 'minnan', side: true },  // 真实：地下一层侧式
  tsl: { zh: '天水路', en: 'Tianshui Lu', x: [] },
  jmd: { zh: '集美大道', en: 'Jimei Dadao', x: [] },
  jsr: { zh: '集美软件园', en: 'Jimei Software Park', x: [] },
  cyg: { zh: '诚毅广场', en: 'Chengyi Guangchang', x: [] },
  grn: { zh: '官任', en: 'Guanren', x: [] },                                   // 1↔6 共用 code，双层步行换乘
  xjl: { zh: '杏锦路', en: 'Xingjin Lu', x: [] },
  xlv: { zh: '杏林村', en: 'Xinglin Cun', x: [] },
  yby: { zh: '园博苑', en: 'Yuanboyuan', x: [] },
  jmx: { zh: '集美学村', en: 'Jimei School Village', x: [], theme: 'jiageng' },  // 真实：高架
  gqi: { zh: '高崎', en: 'Gaoqi', x: [] },
  dqn: { zh: '殿前', en: 'Dianqian', x: [] },
  hjy: { zh: '火炬园', en: 'Torch Hi-Tech Park', x: [] },
  tbn: { zh: '塘边', en: 'Tangbian', x: [] },
  wsp: { zh: '乌石浦', en: 'Wushipu', x: [] },
  lcu: { zh: '吕厝', en: 'Lücuo', x: [], theme: 'transfer' },                 // 1↔2 唯一换乘
  lhj: { zh: '莲花路口', en: 'Lianhua Lukou', x: [] },
  lbn: { zh: '莲坂', en: 'Lianban', x: [] },
  hbd: { zh: '湖滨东路', en: 'Hubin Donglu', x: [] },
  wza: { zh: '文灶', en: 'Wenzao', x: [] },
  jjc: { zh: '将军祠', en: 'Jiangjunci', x: [] },
  zsp: { zh: '中山公园', en: 'Zhongshan Gongyuan', x: [] },
  zhl: { zh: '镇海路', en: 'Zhenhailu', x: [], side: true },
  // —— 2 号线（lcu 已在上面）
  tzs: { zh: '天竺山', en: 'Tianzhushan', x: [] },
  dfu: { zh: '东孚', en: 'Dongfu', x: [] },
  dya: { zh: '东瑶', en: 'Dongyao', x: [] },
  dme: { zh: '鼎美', en: 'Dingmei', x: [] },                                   // 2↔6 共用 code
  mlz: { zh: '马銮中心', en: 'Maluan Zhongxin', x: [] },                           // 2↔6 共用 code；4 号线此站仅规划，不报
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
  tyz: { zh: '体育中心', en: 'Tiyu Zhongxin', x: [] },
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
  wyw: { zh: '五缘湾', en: 'Wuyuanwan', x: [], theme: 'sail' },               // “扬帆再起航”（2 号线站台；3 号线站台用 3 号线标准站）
  // —— 3 号线（hbd / tyz / hjy / wyw 已在上面：换乘站共用 code）
  xmhc: { zh: '厦门火车站', en: 'Xiamen Railway Station', x: [], theme: 'timetravel' },   // 特色站「时光之旅」；真实为地下二层侧式，游戏用岛式
  rczx: { zh: '人才中心', en: 'HR Service Center', x: [] },
  hlgy: { zh: '湖里公园', en: 'Huli Park', x: [] },
  hrl: { zh: '华荣路', en: 'Huarong Road', x: [] },
  xds: { zh: '小东山', en: 'Xiaodongshan', x: [] },
  adou: { zh: '安兜', en: 'Andou', x: [] },
  bsh: { zh: '坂尚', en: 'Banshang', x: [] },                                // 真实：地下一层侧式，游戏用岛式
  hlcx: { zh: '湖里创新园', en: 'Huli Innovation Park', x: [] },
  gjbl: { zh: '国际博览中心', en: 'International Expo Center', x: [] },       // 2023-08-15 由“体育会展”更名
  djie: { zh: '东界', en: 'Dongjie', x: [] },
  hkg: { zh: '洪坑', en: 'Hongkeng', x: [] },                                  // 3↔4 共用 code，自动双层步行换乘
  lqn: { zh: '林前', en: 'Linqian', x: [] },
  glo: { zh: '鼓锣', en: 'Guluo', x: [] },
  xasm: { zh: '翔安市民公园', en: "Xiang'an Public Park", x: [] },
  pbn: { zh: '浦边', en: 'Pubian', x: [] },
  hcun: { zh: '后村', en: 'Houcun', x: [] },                                 // 注意：hcu 已是 2 号线何厝
  ccuo: { zh: '蔡厝', en: 'Caicuo', x: [] },                                 // 真实为高架站；游戏里和其他站一样在地下
  // —— 4 号线（xmnb / hkg 复用；高架段在游戏中沿用地下站台模板）
  jsrb: { zh: '集美软件园北', en: 'Jimei Software Park North', x: [] },
  hxi: { zh: '后溪', en: 'Houxi', x: [] },
  gxn: { zh: '官浔', en: 'Guanxun', x: [] },                                 // 真实只换乘 4 号线和 BRT（6 号线不经过官浔）
  bzhou: { zh: '丙洲', en: 'Bingzhou', x: [] },
  cch: { zh: '城场', en: 'Chengchang', x: [] },
  qwu: { zh: '前浯', en: 'Qianwu', x: [] },                                // 浯 U+6D6F；临时终点，绝非“前浔”
  // —— 6 号线（dme / mlz 复用 2 号线，grn 复用 1 号线；陈井未开通不建）
  jjl: { zh: '角江路', en: 'Jiaojiang Road', x: [] },
  jmzx: { zh: '角美中心', en: 'Jiaomei Center', x: [] },
  wpl: { zh: '文圃路', en: 'Wenpu Road', x: [] },
  jhl: { zh: '角海路', en: 'Jiaohai Road', x: [] },
  jmdo: { zh: '角美东', en: 'Jiaomei East', x: [] },                           // 注意：jmd 已是 1 号线集美大道
  ynong: { zh: '一农', en: 'Yinong', x: [] },
  ldai: { zh: '林埭', en: 'Lindai', x: [] },
  xbin: { zh: '西滨', en: 'Xibin', x: [] },
  btou: { zh: '碑头', en: 'Beitou', x: [] },
  xbn: { zh: '杏滨', en: 'Xingbin', x: [] },
  nmao: { zh: '内茂', en: 'Neimao', x: [] },
  dren: { zh: '董任', en: 'Dongren', x: [] },
  xlw: { zh: '杏林湾', en: 'Xinglinwan', x: [] },
  hqdx: { zh: '华侨大学', en: 'Huaqiao University', x: [] }                    // 真实可换乘 BRT（游戏不做 BRT）
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
