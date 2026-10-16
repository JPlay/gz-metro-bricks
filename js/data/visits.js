/*
 * 车站附近可以去玩的地方（报站 “X 站附近有……，欢迎下车游玩” + 车厢屏黄条 “本站可前往：……”）。
 * zh / en：景点名（可多个）；exit：推荐出口（没有核实到就不写）。名单与来源见 /workspace/gz-shots-polish/station-attractions.md。
 */
export const VISITS = {
  jnt: { zh: ['中山纪念堂'], en: ['the Sun Yat-sen Memorial Hall'], exit: 'C' },
};
const joinEn = n => n.length > 1 ? n.slice(0, -1).join(', ') + ' and ' + n[n.length - 1] : n[0];
/** 三语报站文字：[普, 粤, 英] */
export function visitTexts(code, stnZh, stnEn) {
  const v = VISITS[code]; if (!v) return null;
  const zh = v.zh.join('、'), ex = v.exit;
  return [`${stnZh}附近有${zh}，欢迎下车游玩${ex ? `，请从${ex}出口出站` : ''}。`,
    `${stnZh}附近有${zh}，欢迎落车游玩${ex ? `，请喺${ex}出口出站` : ''}。`,
    `${stnEn} is near ${joinEn(v.en)}. You are welcome to get off and visit${ex ? `. Please use Exit ${ex}` : ''}.`];
}
/** 车厢屏黄条 */
export const visitBanner = code => VISITS[code] ? `本站可前往：${VISITS[code].zh.join('、')}${VISITS[code].exit ? `（${VISITS[code].exit} 出口）` : ''}` : '';
