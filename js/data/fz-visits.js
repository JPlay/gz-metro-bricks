/*
 * 福州地铁：车站附近的景点（报站“下一站……”后接一句 + 福州线路图上的小图标 + 下车后站内“前往××的乘客，请从×出口出站”）。
 * 出口号来源：/workspace/fuzhou-research/brief.md 景点表（福州本地宝 2024-08-20、中文维基各站出入口表）。
 *   东街口 C → 三坊七巷（沿杨桥东路约 400 m 到南后街北口）
 *   南门兜 G1 → 于山风景区（白塔）、五一广场
 *   达道 C → 上下杭（去哪儿网写 A 口，与维基冲突，按 brief 以 C 口为准）
 *   西门 B → 西湖公园（B 口是车站西北口，方位来自维基；官方指引未核实）
 *   第三批：南门兜 B → 乌山风景区（乌塔）；上藤 B → 烟台山（约 603 m）；鼓山 A → 鼓山风景区（车站就在入口广场下面）；
 *           东岭 A → 海峡奥体中心（brief：东岭 A、B、C 口均可；体育场外观未核实，按示意做）
 * 出站街区见 world/fzAttr.js。格式与 xm-visits.js 一样（exit = 单个出口；一站多个出口用 exits，按景点逐个对应）。
 */
import { exitZh } from './xm-visits.js';
export const FZ_VISITS = {
  fzdjk: { zh: ['三坊七巷'], en: ['Three Lanes and Seven Alleys'], exit: 'C', icon: 'mawall', name: '三坊七巷' },
  fznmd: { zh: ['于山风景区', '白塔', '乌山风景区'], en: ['Yushan Hill', 'the White Pagoda', 'Wushan Hill'], exits: ['G1', 'G1', 'B'], icon: 'pagoda', name: '于山白塔 · 乌山' },
  fzdd: { zh: ['上下杭'], en: ['Shangxiahang Historic District'], exit: 'C', icon: 'stonebridge', name: '上下杭' },
  fzxm: { zh: ['西湖公园'], en: ['West Lake Park'], exit: 'B', icon: 'lake', name: '西湖公园' },
  fzst: { zh: ['烟台山'], en: ['Yantai Hill'], exit: 'B', icon: 'chapel', name: '烟台山' },
  fzgs: { zh: ['鼓山风景区'], en: ['Gushan Mountain'], exit: 'A', icon: 'cablecar', name: '鼓山' },
  fzdl: { zh: ['海峡奥体中心'], en: ['the Straits Olympic Sports Center'], exit: 'A', icon: 'stadium', name: '海峡奥体中心' }
};
const joinEn = a => a.length < 2 ? a[0] : a.slice(0, -1).join(', ') + ' and ' + a[a.length - 1];
/** 按出口分组：[{ exit, zh:[…], en:[…] }] */
export function fzGuides(code) {
  const v = FZ_VISITS[code]; if (!v) return [];
  const out = [];
  v.zh.forEach((zh, i) => { const ex = v.exits ? v.exits[i] : v.exit; if (!ex) return; let g = out.find(o => o.exit === ex); if (!g) out.push(g = { exit: ex, zh: [], en: [] }); g.zh.push(zh); g.en.push(v.en[i]); });
  return out;
}
export function fzVisitTexts(code, stnZh, stnEn) {
  const v = FZ_VISITS[code]; if (!v) return null;
  const G = fzGuides(code), one = G.length === 1 && G[0].zh.length === v.zh.length;
  const zhEx = !G.length ? '' : one ? `，请从${exitZh(G[0].exit)}出站` : '，' + G.map(g => `去${g.zh.join('、')}请从${exitZh(g.exit)}出站`).join('，');
  const enEx = !G.length ? '' : one ? `. Please use Exit ${G[0].exit}` : '. ' + G.map(g => `For ${joinEn(g.en)}, please use Exit ${g.exit}`).join('. ');
  return [`${stnZh}附近有${v.zh.join('、')}，欢迎下车游玩${zhEx}。`, null,
    `${stnEn} is near ${joinEn(v.en)}. You are welcome to get off and visit${enEx}.`];
}
/** 站内（下车后）：“前往三坊七巷的乘客，请从C出口出站。”（多出口：每个出口一句） */
export function fzExitTexts(code) {
  const G = fzGuides(code); if (!G.length) return null;
  return [G.map(g => `前往${g.zh.join('、')}的乘客，请从${exitZh(g.exit)}出站`).join('；') + '。', null,
    G.map(g => `Passengers for ${joinEn(g.en)}, please use Exit ${g.exit}.`).join(' ')];
}
export const FZ_ATTRACTIONS = Object.entries(FZ_VISITS).map(([code, v]) => ({ id: 'fz-' + code, code, icon: v.icon, name: v.name, names: v.zh, exit: v.exit || [...new Set(v.exits || [])].join(' / ') || null }));
