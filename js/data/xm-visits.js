/*
 * 厦门地铁 1 / 2 号线：车站附近的景点（报站“下一站……”后接一句 + 厦门线路图上的小图标）。
 * 只列已核实的（出口号来自厦门地铁车站出入口信息 / 中文维基）；没核实出口的不写 exit，只说“欢迎下车游玩”。
 * 游戏里还没有搭出这些景点（只报站 + 地图图标）。
 */
export const XM_VISITS = {
  // —— 1 号线 ——
  cyg: { zh: ['集美市民广场', '诚毅科技探索中心'], en: ['Jimei Civic Square', 'the Chengyi Science and Technology Exploration Center'], icon: 'science', name: '市民广场' },
  yby: { zh: ['园林博览苑'], en: ['the Garden Expo Park'], icon: 'pavilion', name: '园博苑' },
  lhj: { zh: ['莲花公园'], en: ['Lianhua Park'], exit: '4', icon: 'lotus', name: '莲花公园' },
  zsp: { zh: ['中山公园'], en: ['Zhongshan Park'], icon: 'park', name: '中山公园' },
  // —— 1 / 2 号线换乘 ——
  lcu: { zh: ['莲花公园'], en: ['Lianhua Park'], exit: '12', icon: 'lotus', name: '莲花公园' },
  // —— 2 号线 ——
  jtou: { zh: ['莲龙小学'], en: ['Lianlong Primary School'], exit: '2', icon: 'school', name: '莲龙小学' },
  hpu: { zh: ['忠仑公园'], en: ['Zhonglun Park'], exit: '4', icon: 'park', name: '忠仑公园' },
};
const joinEn = a => a.length > 1 ? a.slice(0, -1).join(', ') + ' and ' + a[a.length - 1] : a[0];
/** [普通话, 闽南语（待定，暂空）, 英语] */
export function xmVisitTexts(code, stnZh, stnEn) {
  const v = XM_VISITS[code]; if (!v) return null;
  const ex = v.exit;
  return [`${stnZh}附近有${v.zh.join('、')}，欢迎下车游玩${ex ? `，请从${ex}号出口出站` : ''}。`, null,
    `${stnEn} is near ${joinEn(v.en)}. You are welcome to get off and visit${ex ? `. Please use Exit ${ex}` : ''}.`];
}
/** 地图图标列表 */
export const XM_ATTRACTIONS = Object.entries(XM_VISITS).map(([code, v]) => ({ id: 'xm-' + code, code, icon: v.icon, name: v.name, names: v.zh, exit: v.exit || null }));
