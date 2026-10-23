/*
 * 报站文案与语音片段 id（普通话 → 粤语 → 英语；厦门地铁为 普通话 → 闽南语 → 英语）。浏览器和 Node（tools/audio/export_jobs.mjs）共用。
 * 旧项目已有 90 条 MP3（公园前/农讲所/烈士陵园/东山口 + 1 号线方向等），这里的 id 与文字与之完全一致；
 * 新增车站 / 2 号线方向沿用同一句式，暂无 MP3 时由 Web Speech 按 text 朗读（见 js/audio/audio.js）。
 */
import { LINES, STATIONS, OTHER_LINES, isTerminal, transfersAt } from './lines.js';
import { XM_LINES, XM_STATIONS, xmNext, xmIsTerminal, xmTransfers } from './xm-lines.js';
import { VISITS, visitTexts } from './visits.js';
import { xmVisitTexts, xmExitTexts } from './xm-visits.js';

export const LANGS = ['zh', 'yue', 'en'];
/** 播放顺序：普通话 → 粤语（广州）/ 闽南语（厦门地铁）→ 英语。粤语只在广州、闽南语只在厦门地铁 1/2 号线；动车只有普通话 + 英语 */
export const ORDER = ['zh', 'yue', 'nan', 'en'];
const LEGACY = new Set(['gyq', 'njs', 'lsly', 'dsk']);
const seg = (key, texts) => LANGS.map((l, i) => ({ id: `voice.${key}.${l}`, lang: l, text: texts[i] })).filter(s => s.text);
/** 厦门地铁：[普通话, 英语] → 普通话 → 闽南语（同一段中文文字，用闽南话念）→ 英语 */
const xseg = (key, zh, en) => [{ id: `voice.${key}.zh`, lang: 'zh', text: zh }, { id: `voice.${key}.nan`, lang: 'nan', text: zh }, { id: `voice.${key}.en`, lang: 'en', text: en }].filter(s => s.text);

function xZh(list) { return list.map(k => { const o = OTHER_LINES[k]; return o.name || o.num + '号线'; }).join('、'); }
function xEn(list) {
  const n = list.map(k => { const o = OTHER_LINES[k]; return o.enName || 'Line ' + o.enNum; });
  return n.length > 1 ? n.slice(0, -1).join(', ') + ' and ' + n[n.length - 1] : n[0];
}
/** 站名后接「站」/ station：站名本身以「站」结尾（广州东站、广州南站、广州火车站）时不再重复 */
const zhStn = zh => zh.endsWith('站') ? zh : zh + '站';
const enStn = s => s.zh.endsWith('站') ? s.en : s.en + ' station';
function stationTexts(code, line) {
  const s = STATIONS[code], xs = transfersAt(code, line).filter(k => k !== line);
  return { zh: s.zh, en: s.en, xs };
}
/** 下一站（不含终点方向） */
/** 景点：下一站报站后接一句“X 站附近有……，欢迎下车游玩，请从 C 出口出站”（js/data/visits.js） */
export const visitSegs = code => { const s = STATIONS[code], t = s && visitTexts(code, zhStn(s.zh), enStn(s)); return t ? seg('visit.' + code, t) : []; };
export function nextSegs(line, code) { return [...nextSegs0(line, code), ...visitSegs(code)]; }
function nextSegs0(line, code) {
  if (code === 'gyq') return [...seg('next.gyq', ['下一站，公园前。', '下一站，公园前。', 'The next station is Gongyuanqian.']),
    ...(line === 1 ? seg('transfer.gyq', ['请从列车前进方向的右门下车，中部楼梯换乘二号线。', '请由列车前进方向的右门落车，中部楼梯换乘二号线。', 'Please exit the train to the right. To transfer to Line Two, please take the stairs in the middle of the platform.'])
      : seg('transfer.gyq2', ['可换乘一号线。', '可换乘一号线。', 'You can transfer to Line One.']))];
  if (code === 'dsk') return seg('next.dsk', ['下一站，东山口，可换乘六号线。', '下一站，东山口，可换乘六号线。', 'The next station is Dongshankou, the interchange with Line Six.']);
  const t = stationTexts(code, line);
  const zx = t.xs.length ? '，可换乘' + xZh(t.xs) : '', ex = t.xs.length ? ', the interchange with ' + xEn(t.xs) : '';
  return seg('next.' + code, [`下一站，${t.zh}${zx}。`, `下一站，${t.zh}${zx}。`, `The next station is ${t.en}${ex}.`]);
}
export function destinationSegs(line, dir) {
  const d = LINES[line].dirs[dir];
  return seg('destination.' + dir, [`本次列车终点站为${d.zh}。`, `本次列车终点站为${d.zh}。`, `The destination of this train is ${d.en}.`]);
}
export function terminalSegs(line, dir) {
  const d = LINES[line].dirs[dir];
  return seg('terminal.' + dir, [`下一站是本次列车的终点站，${d.zh}。请全部乘客带齐行李物品在此站下车，欢迎再次乘坐广州地铁。`,
    `下一站系本次列车的终点站，${d.zh}。请全部乘客带齐行李物品在本站落车，欢迎再次乘坐广州地铁。`,
    `The next station is ${d.en}, the terminal of this journey. Please take all your belongings and leave the train. Thank you for travelling on Guangzhou Metro.`]);
}
/** 列车开出后：（首程带终点方向）+ 下一站 / 终点站 */
export function departSegs(line, nextCode, dir, step, withDestination) {
  const head = withDestination ? destinationSegs(line, dir) : [];
  return isTerminal(line, nextCode, step) ? [...head, ...terminalSegs(line, dir), ...visitSegs(nextCode)] : [...head, ...nextSegs(line, nextCode)];
}
function stnOf(code) { return STATIONS[code] || XM_STATIONS[code]; }
function isXm(code) { return !!XM_STATIONS[code] && !STATIONS[code]; }
export function arriveSegs(code) {
  const s = stnOf(code);
  // 厦门地铁：普通话 → 闽南语 → 英语（不播粤语）
  if (isXm(code)) return xseg('arrive.' + code, `列车即将到达${zhStn(s.zh)}，请小心列车与站台之间的空隙。`, `The train is arriving at ${s.en}. Please mind the gap between the train and the platform.`);
  return [...seg('arrive.' + code, [`列车即将到达${zhStn(s.zh)}，请小心列车与站台之间的空隙。`, `列车即将到达${zhStn(s.zh)}，请小心列车同站台之间的空隙。`, `The train is arriving at ${s.en}. Please mind the gap between the train and the platform.`])];
}
export function welcomeSegs(code) {
  const s = stnOf(code);
  if (isXm(code)) return xseg('welcome.' + code, `欢迎光临${zhStn(s.zh)}。请排队候车，先下后上。`, `Welcome to ${enStn(s)}. Please line up for the train. Let the passengers get off first before you get on.`);
  return seg('welcome.' + code, [`欢迎光临${zhStn(s.zh)}。请排队候车，先下后上。`, `欢迎光临${zhStn(s.zh)}。请排队候车，先落后上。`, `Welcome to ${enStn(s)}. Please line up for the train. Let the passengers get off first before you get on.`]);
}
export function platformSegs(line, dir, n) {
  const d = LINES[line].dirs[dir], num = ['一', '二'][n - 1];
  return seg(`platform.${dir}.${n}`, [`${num}站台，${d.zh}方向列车即将进站。`, `${num}站台，${d.zh}方向列车即将进站。`, `The train bound for ${d.en} is approaching at Platform ${n}.`]);
}
export const doorsClosingSegs = () => seg('doorsClosing', ['车门即将关闭，请注意安全，谨防被夹。', '车门即将关闭，请注意安全，谨防被夹。', 'The doors are closing. Please stand clear of the doors.']);
export const gapSegs = () => seg('gap', ['请小心列车与站台之间的空隙。', '请小心列车同站台之间的空隙。', 'Please mind the gap between the train and the platform.']);
const SAFETY = {
  queue: ['请不要越出黄色安全线，请按地面标识排队候车。', '请勿越出黄色安全线，请按地面标识排队候车。'],
  psd: ['手或身体请勿扶靠屏蔽门、安全门。', '请勿用手或者身体挨住屏蔽门、安全门。'],
  escalator: ['请站稳，并握紧黑色扶手带，请勿在扶梯口处停留。', '请企稳，握紧黑色扶手带，请勿在扶梯口停留。'],
  walk: ['站内通行时请注意地面状况，严禁奔跑、追逐。', '在车站行路请留意地面情况，请勿奔跑同追逐。']
};
export const safetySegs = k => seg('safety.' + k, [SAFETY[k][0], SAFETY[k][1], null]);

/*
 * 动车（国铁）车厢广播：只有普通话 + 英语（国铁列车不播粤语；js/data/rail.js）。时间压缩的一程里不报中途停站。
 * 车次按铁路播音习惯逐位读（D 二三一五）；英文站名用 Guangzhou East / Xiamen North（车站英文译名）。
 */
const EMU_T = {
  xm: { no: 'D二三一五', noEn: 'D two three one five', from: '广州东站', to: '厦门北站', fromEn: 'Guangzhou East', toEn: 'Xiamen North', city: '厦门', cityEn: 'Xiamen' },
  gz: { no: 'D三三一一', noEn: 'D three three one one', from: '厦门北站', to: '广州东站', fromEn: 'Xiamen North', toEn: 'Guangzhou East', city: '广州', cityEn: 'Guangzhou' }
};
export const emuDoorsSegs = () => seg('emu.doors', ['列车即将出发，车门即将关闭，请注意安全。', null, 'The train is about to depart. The doors are closing.']);
export const emuDepartSegs = d => { const t = EMU_T[d]; return seg('emu.depart.' + d, [`旅客们，欢迎乘坐${t.no}次列车。本次列车由${t.from}开往${t.to}。`, null, `Welcome aboard train ${t.noEn}, from ${t.fromEn} to ${t.toEn}.`]); };
export const emuBridgeSegs = () => seg('emu.bridge', ['列车正在通过九龙江特大桥。', null, 'We are now crossing the Jiulong River Bridge.']);
export const emuNextSegs = d => { const t = EMU_T[d]; return seg('emu.next.' + d, [`前方到站，${t.to}。请您带好随身物品，准备下车。`, null, `We will soon arrive at ${t.toEn}. Please take your belongings and get ready to leave the train.`]); };
export const emuArriveSegs = d => { const t = EMU_T[d]; return seg('emu.arrive.' + d, [`${t.to}到了。欢迎您来到${t.city}，下车时请注意列车与站台之间的空隙。`, null, `We have arrived at ${t.toEn}. Welcome to ${t.cityEn}. Please mind the gap when leaving the train.`]); };
export function emuJobs() { return [...emuDoorsSegs(), ...emuBridgeSegs(), ...['xm', 'gz'].flatMap(d => [...emuDepartSegs(d), ...emuNextSegs(d), ...emuArriveSegs(d)])]; }

/** 全网需要的全部片段（用于生成缺失清单 / 语音生成任务） */
/** 厦门地铁报站（普通话 → 闽南语 → 英语；线路方向 id 带 xm 前缀以免和广州撞） */
export function xmDestinationSegs(line, dir) {
  const d = XM_LINES[line].dirs[dir];
  return xseg('destination.xm' + dir, `本次列车终点站为${d.zh}。`, `The destination of this train is ${d.en}.`);
}
export function xmTerminalSegs(line, dir) {
  const d = XM_LINES[line].dirs[dir];
  return xseg('terminal.xm' + dir, `下一站是本次列车的终点站，${d.zh}。请全部乘客带齐行李物品在此站下车，欢迎再次乘坐厦门地铁。`,
    `The next station is ${d.en}, the terminal of this journey. Please take all your belongings and leave the train. Thank you for travelling on Xiamen Metro.`);
}
export function xmPlatformSegs(line, dir, n) {
  const d = XM_LINES[line].dirs[dir], num = ['一', '二'][n - 1];
  return xseg(`platform.xm${dir}.${n}`, `${num}站台，${d.zh}方向列车即将进站。`, `The train bound for ${d.en} is approaching at Platform ${n}.`);
}
export function xmNextSegs(line, code) {
  const s = XM_STATIONS[code], xs = xmTransfers(code, line);
  const xZh = xs.map(k => typeof k === 'number' && XM_LINES[k] ? XM_LINES[k].zh : (k === 3 ? '3号线' : k === 4 ? '4号线' : k === 6 ? '6号线' : String(k))).join('、');
  const xEn = xs.map(k => typeof k === 'number' && XM_LINES[k] ? XM_LINES[k].en : ('Line ' + k)).join(' and ');
  const zx = xs.length ? '，可换乘' + xZh : '', ex = xs.length ? ', the interchange with ' + xEn : '';
  // 两条线都停的站（吕厝）：换乘对象随线路不同 → 片段 id 带线路号（next.lcu1 / next.lcu2）
  const both = Object.values(XM_LINES).filter(L => L.stations.includes(code)).length > 1;
  return xseg('next.' + code + (both ? line : ''), `下一站，${s.zh}${zx}。`, `The next station is ${s.en}${ex}.`);
}
/** 厦门：下一站附近的景点（js/data/xm-visits.js） */
export const xmExitSegs = code => { const t = xmExitTexts(code); return t ? xseg('xmexit.' + code, t[0], t[t.length - 1]) : []; };
export const xmVisitSegs = code => { const s = XM_STATIONS[code], t = s && xmVisitTexts(code, s.zh + '站', s.en + ' station'); return t ? xseg('xmvisit.' + code, t[0], t[t.length - 1]) : []; };
export function xmDepartSegs(line, nextCode, dir, step, withDestination) {
  const head = withDestination ? xmDestinationSegs(line, dir) : [];
  return xmIsTerminal(line, nextCode, step) ? [...head, ...xmTerminalSegs(line, dir)] : [...head, ...xmNextSegs(line, nextCode), ...xmVisitSegs(nextCode)];
}
export function allJobs() {
  const out = new Map(), add = list => list.forEach(s => out.set(s.id, s));
  for (const [id, L] of Object.entries(LINES)) {
    const line = +id;
    for (const dir of Object.keys(L.dirs)) { add(destinationSegs(line, dir)); add(terminalSegs(line, dir)); add(platformSegs(line, dir, 1)); add(platformSegs(line, dir, 2)); }
    L.stations.forEach((c, i) => { if (i > 0 && i < L.stations.length - 1) add(nextSegs(line, c)); add(arriveSegs(c)); add(welcomeSegs(c)); add(visitSegs(c)); });
  }
  for (const [id, L] of Object.entries(XM_LINES)) {
    const line = +id;
    for (const dir of Object.keys(L.dirs)) { add(xmDestinationSegs(line, dir)); add(xmTerminalSegs(line, dir)); add(xmPlatformSegs(line, dir, 1)); add(xmPlatformSegs(line, dir, 2)); }
    L.stations.forEach((c, i) => { if (i > 0 && i < L.stations.length - 1) add(xmNextSegs(line, c)); add(arriveSegs(c)); add(welcomeSegs(c)); add(xmVisitSegs(c)); add(xmExitSegs(c)); });
  }
  add(doorsClosingSegs()); add(gapSegs()); add(emuJobs()); Object.keys(SAFETY).forEach(k => add(safetySegs(k)));
  return [...out.values()].map(s => ({ ...s, file: 'voice/' + s.id.slice(6).replace(/\./g, '-') + '.mp3' }));
}
export { LEGACY };
