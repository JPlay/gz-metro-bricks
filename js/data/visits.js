/*
 * 车站附近可以去玩的地方（报站 “X 站附近有……，欢迎下车游玩” + 车厢屏黄条 “本站可前往：……”）。
 * zh / en：景点名（可多个）；exit：推荐出口（没有核实到就不写）。名单与来源见 /workspace/gz-shots-polish/station-attractions.md。
 */
export const VISITS = {
  // —— 1 号线 ——
  kk: { zh: ['芳村黄大仙祠'], en: ['Fangcun Wong Tai Sin Temple'], exit: 'B' },
  fc: { zh: ['醉观公园'], en: ['Zuiguan Park'], exit: 'D' },
  hs: { zh: ['沙面'], en: ['Shamian Island'], exit: 'D' },
  csl: { zh: ['上下九步行街', '荔枝湾涌'], en: ['Shangxiajiu Pedestrian Street', 'Lizhiwan Creek'], exit: 'A' },
  cjc: { zh: ['陈家祠'], en: ['the Chen Clan Ancestral Hall'], exit: 'C' },
  xmk: { zh: ['光孝寺'], en: ['Guangxiao Temple'] },
  gyq: { zh: ['人民公园', '北京路步行街'], en: ["the People's Park", 'Beijing Road Pedestrian Street'] },
  njs: { zh: ['农讲所旧址', '文明路糖水街'], en: ['the Peasant Movement Institute', 'the Wenming Road dessert street'], exit: 'D' },
  lsly: { zh: ['广州起义烈士陵园'], en: ["the Guangzhou Uprising Martyrs' Cemetery"], exit: 'C' },
  dsk: { zh: ['东山口红砖洋楼', '东山湖公园'], en: ['the Dongshankou red-brick villas', 'Dongshan Lake Park'] },
  tyzx: { zh: ['天河体育中心'], en: ['the Tianhe Sports Center'], exit: 'C' },
  // 广州东站：出站往南过马路就是火车站（游戏里搭出来了：候车大厅、闸机、站台上的复兴号）；真实的 G 出口「广州火车东站」，和站里导向牌、地图卡片一致
  gzdz: { zh: ['广州东火车站'], en: ['Guangzhou East Railway Station'], exit: 'G',
    say: ex => [`前往广州东火车站的乘客，请从${ex}出口出站。`, `前往广州东火车站嘅乘客，请喺${ex}出口出站。`, `Passengers for Guangzhou East Railway Station, please use Exit ${ex}.`] },
  // —— 2 号线 ——
  lx: { zh: ['洛溪大桥', '洛浦公园'], en: ['Luoxi Bridge', 'Luopu Park'] },
  nz: { zh: ['海珠儿童公园', '陈李济中药博物馆'], en: ["Haizhu Children's Park", 'the Chen Li Ji Chinese Medicine Museum'] },
  jnx: { zh: ['十香园'], en: ['the Shixiang Garden'] },
  seg: { zh: ['孙中山大元帅府纪念馆'], en: ["the Memorial Museum of Sun Yat-sen's Generalissimo Mansion"], exit: 'A' },
  hzgc: { zh: ['石室圣心大教堂'], en: ['the Sacred Heart Cathedral'], exit: 'B2' },
  jnt: { zh: ['中山纪念堂'], en: ['the Sun Yat-sen Memorial Hall'], exit: 'C' },
  yxgy: { zh: ['越秀公园五羊石像', '镇海楼'], en: ['the Five Rams Statue in Yuexiu Park', 'Zhenhai Tower'], exit: 'B1' },
  syl: { zh: ['三元里人民抗英斗争纪念馆'], en: ['the Sanyuanli Anti-British Struggle Memorial'], exit: 'B' },
  bygy: { zh: ['白云公园'], en: ['Baiyun Park'], exit: 'A' },
  bywhgc: { zh: ['广州城市规划展览中心'], en: ['the Guangzhou Urban Planning Exhibition Center'], exit: 'A' },
};
const joinEn = n => n.length > 1 ? n.slice(0, -1).join(', ') + ' and ' + n[n.length - 1] : n[0];
/** 三语报站文字：[普, 粤, 英] */
export function visitTexts(code, stnZh, stnEn) {
  const v = VISITS[code]; if (!v) return null;
  const zh = v.zh.join('、'), ex = v.exit;
  if (v.say) return v.say(ex);
  return [`${stnZh}附近有${zh}，欢迎下车游玩${ex ? `，请从${ex}出口出站` : ''}。`,
    `${stnZh}附近有${zh}，欢迎落车游玩${ex ? `，请喺${ex}出口出站` : ''}。`,
    `${stnEn} is near ${joinEn(v.en)}. You are welcome to get off and visit${ex ? `. Please use Exit ${ex}` : ''}.`];
}
/** 车厢屏黄条 */
export const visitBanner = code => VISITS[code] ? `本站可前往：${VISITS[code].zh.join('、')}${VISITS[code].exit ? `（${VISITS[code].exit} 出口）` : ''}` : '';
