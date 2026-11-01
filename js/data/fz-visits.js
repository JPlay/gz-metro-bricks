/*
 * 福州地铁：车站附近的景点（报站“下一站……”后接一句 + 福州线路图上的小图标 + 下车后站内“前往××的乘客，请从×出口出站”）。
 * 出口号来源：/workspace/fuzhou-research/brief.md 景点表（福州本地宝 2024-08-20、中文维基各站出入口表）。
 *   东街口 C → 三坊七巷（沿杨桥东路约 400 m 到南后街北口）
 *   南门兜 G1 → 于山风景区（白塔）、五一广场
 *   达道 C → 上下杭（去哪儿网写 A 口，与维基冲突，按 brief 以 C 口为准）
 *   西门 B → 西湖公园（B 口是车站西北口，方位来自维基；官方指引未核实）
 * 出站街区见 world/fzAttr.js。格式与 xm-visits.js 一样（exit = 单个出口；以后多出口用 exits）。
 */
import { exitZh } from './xm-visits.js';
export const FZ_VISITS = {
  fzdjk: { zh: ['三坊七巷'], en: ['Three Lanes and Seven Alleys'], exit: 'C', icon: 'mawall', name: '三坊七巷' },
  fznmd: { zh: ['于山风景区', '白塔'], en: ['Yushan Hill', 'the White Pagoda'], exit: 'G1', icon: 'pagoda', name: '于山白塔' },
  fzdd: { zh: ['上下杭'], en: ['Shangxiahang Historic District'], exit: 'C', icon: 'stonebridge', name: '上下杭' },
  fzxm: { zh: ['西湖公园'], en: ['West Lake Park'], exit: 'B', icon: 'lake', name: '西湖公园' }
};
const joinEn = a => a.length < 2 ? a[0] : a.slice(0, -1).join(', ') + ' and ' + a[a.length - 1];
export function fzVisitTexts(code, stnZh, stnEn) {
  const v = FZ_VISITS[code]; if (!v) return null;
  const ex = v.exit;
  return [`${stnZh}附近有${v.zh.join('、')}，欢迎下车游玩${ex ? `，请从${exitZh(ex)}出站` : ''}。`, null,
    `${stnEn} is near ${joinEn(v.en)}. You are welcome to get off and visit${ex ? `. Please use Exit ${ex}` : ''}.`];
}
/** 站内（下车后）：“前往三坊七巷的乘客，请从C出口出站。” */
export function fzExitTexts(code) {
  const v = FZ_VISITS[code]; if (!v || !v.exit) return null;
  return [`前往${v.zh.join('、')}的乘客，请从${exitZh(v.exit)}出站。`, null, `Passengers for ${joinEn(v.en)}, please use Exit ${v.exit}.`];
}
export const FZ_ATTRACTIONS = Object.entries(FZ_VISITS).map(([code, v]) => ({ id: 'fz-' + code, code, icon: v.icon, name: v.name, names: v.zh, exit: v.exit || null }));
