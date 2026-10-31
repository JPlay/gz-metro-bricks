/*
 * 厦门地铁 1 / 2 号线：车站附近的景点（报站“下一站……”后接一句 + 厦门线路图上的小图标）。
 * 只列已核实的（出口号来自厦门地铁车站出入口信息 / 中文维基）；没核实出口的不写 exit，只说“欢迎下车游玩”。
 * 有出口号的：下车后站内再播一句“前往××的乘客，请从N号出口出站”；出站街区见 world/xmStreet.js + xmAttr*.js。
 */
export const XM_VISITS = {
  // —— 1 号线 ——
  cyg: { zh: ['集美市民广场'], en: ['Jimei Civic Square'], icon: 'science', name: '市民广场' },
  grn: { zh: ['厦门诚毅自然探索馆'], en: ['the Xiamen Chengyi Nature Exploration Museum'], exit: '3', icon: 'science', name: '诚毅自然探索馆' },   // 原“诚毅科技探索中心”，2026-07-03 升级改名开馆（福建省政府网 2026-07-05）
  jmx: { zh: ['集美学村', '龙舟池', '鳌园'], en: ['Jimei School Village', 'the Dragon Boat Pond', 'Aoyuan Garden'], exit: '2', icon: 'jiageng', name: '集美学村' },
  yby: { zh: ['园林博览苑'], en: ['the Garden Expo Park'], exit: '2', icon: 'pavilion', name: '园博苑' },
  gqi: { zh: ['海堤纪念公园'], en: ['the Seawall Memorial Park'], exit: '1', icon: 'rail', name: '海堤公园' },
  dqn: { zh: ['清水宫'], en: ['Qingshui Temple'], exit: '1', icon: 'temple', name: '清水宫' },
  lhj: { zh: ['莲花公园'], en: ['Lianhua Park'], exit: '4', icon: 'lotus', name: '莲花公园' },
  lbn: { zh: ['外图厦门书城'], en: ['Xiamen Book City'], exit: '3', icon: 'books', name: '书城' },
  zsp: { zh: ['中山公园'], en: ['Zhongshan Park'], exit: '3A', icon: 'park', name: '中山公园' },
  zhl: { zh: ['和平码头', '中山路步行街'], en: ['Heping Pier', 'Zhongshan Road Pedestrian Street'], exits: ['1', '3B'], icon: 'qilou', name: '中山路' },
  // —— 1 / 2 号线换乘 ——
  lcu: { zh: ['莲花公园'], en: ['Lianhua Park'], exit: '12', icon: 'lotus', name: '莲花公园' },
  // —— 2 号线 ——
  hcw: { zh: ['海沧湾公园'], en: ['Haicang Bay Park'], exit: '2', icon: 'bridge', name: '海沧湾' },
  ylz: { zh: ['厦鼓码头'], en: ['the Xiamen-Gulangyu Ferry Terminal'], exit: '6', icon: 'ferry', name: '厦鼓码头' },
  hbz: { zh: ['白鹭洲公园'], en: ['Bailuzhou Park'], exit: '2', icon: 'egret', name: '白鹭洲' },
  yxd: { zh: ['新东方'], en: ['New Oriental'], exit: '3', icon: 'xdf', name: '新东方' },
  wsp: { zh: ['厦门SM城市广场'], en: ['SM City Xiamen'], exit: '4B', icon: 'sm', name: 'SM广场' },
  jtou: { zh: ['莲龙小学'], en: ['Lianlong Primary School'], exit: '2', icon: 'school', name: '莲龙小学' },
  hpu: { zh: ['忠仑公园'], en: ['Zhonglun Park'], exit: '4', icon: 'park', name: '忠仑公园' },
  ctg: { zh: ['忠仑公园'], en: ['Zhonglun Park'], exit: '2', icon: 'park', name: '忠仑公园' },
  gys: { zh: ['观音山沙滩', '沙雕公园'], en: ['Guanyinshan Beach', 'the Sand Sculpture Park'], exit: '4', icon: 'beach', name: '观音山沙滩' },
  sdy: { zh: ['五缘湾湿地公园'], en: ['Wuyuan Bay Wetland Park'], exit: '3', icon: 'swan', name: '湿地公园' },
};
const joinEn = a => a.length > 1 ? a.slice(0, -1).join(', ') + ' and ' + a[a.length - 1] : a[0];
/** 出口号的念法：纯数字“2号出口”，带字母“3A出口” */
export const exitZh = n => /^[0-9]+$/.test(n) ? `${n}号出口` : `${n}出口`;
/** 按出口分组：[{ exit, zh:[…], en:[…] }] */
export function xmGuides(code) {
  const v = XM_VISITS[code]; if (!v) return [];
  const out = [];
  v.zh.forEach((zh, i) => { const ex = v.exits ? v.exits[i] : v.exit; if (!ex) return; let g = out.find(o => o.exit === ex); if (!g) out.push(g = { exit: ex, zh: [], en: [] }); g.zh.push(zh); g.en.push(v.en[i]); });
  return out;
}
/** [普通话, 闽南语（同普通话字面）, 英语] —— 报站“下一站”之后 */
export function xmVisitTexts(code, stnZh, stnEn) {
  const v = XM_VISITS[code]; if (!v) return null;
  const G = xmGuides(code), one = G.length === 1 && G[0].zh.length === v.zh.length;
  const zhEx = !G.length ? '' : one ? `，请从${exitZh(G[0].exit)}出站` : '，' + G.map(g => `${g.zh.join('、')}请从${exitZh(g.exit)}出站`).join('，');
  const enEx = !G.length ? '' : one ? `. Please use Exit ${G[0].exit}` : '. ' + G.map(g => `For ${joinEn(g.en)}, please use Exit ${g.exit}`).join('. ');
  return [`${stnZh}附近有${v.zh.join('、')}，欢迎下车游玩${zhEx}。`, null,
    `${stnEn} is near ${joinEn(v.en)}. You are welcome to get off and visit${enEx}.`];
}
/** 站内（下车后）：“前往中山公园的乘客，请从3A出口出站。” */
export function xmExitTexts(code) {
  const G = xmGuides(code); if (!G.length) return null;
  return [G.map(g => `前往${g.zh.join('、')}的乘客，请从${exitZh(g.exit)}出站`).join('；') + '。', null,
    G.map(g => `Passengers for ${joinEn(g.en)}, please use Exit ${g.exit}.`).join(' ')];
}
/** 地图图标列表 */
export const XM_ATTRACTIONS = Object.entries(XM_VISITS).map(([code, v]) => ({ id: 'xm-' + code, code, icon: v.icon, name: v.name, names: v.zh, exit: v.exit || (v.exits || []).join(' / ') || null }));
