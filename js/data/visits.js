/*
 * 车站附近可以去玩的地方（报站 “X 站附近有……，欢迎下车游玩” + 车厢屏黄条 “本站可前往：……”）。
 * zh / en：景点名（可多个）；exit：推荐出口。只列游戏里真的搭出来、从这个出口能走到的地方；出口必须是站里真有的出口（默认只有 D）。名单与来源见 /workspace/gz-shots-polish/station-attractions.md。
 */
export const VISITS = {
  // —— 1 号线 ——
  hs: { zh: ['沙面'], en: ['Shamian Island'], exit: 'D' },
  cjc: { zh: ['陈家祠'], en: ['the Chen Clan Ancestral Hall'], exit: 'C' },
  gyq: { zh: ['人民公园'], en: ["the People's Park"], exit: 'D' },   // D 出口西边的喷泉草坪（station.js sig 'park'）；北京路没搭，不报
  njs: { zh: ['农讲所旧址', '文明路糖水街'], en: ['the Peasant Movement Institute', 'the Wenming Road dessert street'], exit: 'D' },
  lsly: { zh: ['广州起义烈士陵园'], en: ["the Guangzhou Uprising Martyrs' Cemetery"], exit: 'D' },   // 游戏里只有 D 出口；纪念碑在出口北边（sig 'memorial'）
  dsk: { zh: ['东山口红砖洋楼'], en: ['the Dongshankou red-brick villas'], exit: 'D' },   // D 出口两边的红砖洋楼（sig 'villa'）；东山湖没搭，不报
  // 广州东站：出站往南过马路就是火车站（游戏里搭出来了：候车大厅、闸机、站台上的复兴号）；真实的 G 出口「广州火车东站」，和站里导向牌、地图卡片一致
  gzdz: { zh: ['广州东火车站'], en: ['Guangzhou East Railway Station'], exit: 'G',
    say: ex => [`前往广州东火车站的乘客，请从${ex}出口出站。`, `前往广州东火车站嘅乘客，请喺${ex}出口出站。`, `Passengers for Guangzhou East Railway Station, please use Exit ${ex}.`] },
  // —— 2 号线 ——
  jnt: { zh: ['中山纪念堂'], en: ['the Sun Yat-sen Memorial Hall'], exit: 'C' },
  yxgy: { zh: ['越秀公园五羊石像'], en: ['the Five Rams Statue in Yuexiu Park'], exit: 'B1' },   // 镇海楼没搭（wy.js 只有五羊山岗），不报
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
