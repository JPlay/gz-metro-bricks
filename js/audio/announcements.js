/*
 * 报站调度：把 js/data/phrases.js 生成的片段交给音频引擎排队播放。
 * 有 MP3 的片段走 DashScope 预生成语音；没有的自动用 Web Speech 朗读（zh-CN → zh-HK → en-US，rate 0.95），都显示字幕。
 */
import * as Audio from './audio.js';
import * as P from '../data/phrases.js';

export function say(segs, meta = {}) { return Audio.announceIds(segs, meta).catch(e => ({ error: String(e) })); }
export const depart = (line, nextCode, dir, step, withDest) => say(P.departSegs(line, nextCode, dir, step, withDest), { key: 'next', interrupt: true });
/** 一组片段按清单时长要播多久（秒，含段间停顿；和 audio.js pump 的节奏一致：首段 0.07 s、其余 0.22 s；闽南语没 MP3 会被跳过） */
export function seconds(segs) {
  return segs.reduce((t, x, i) => {
    const id = typeof x === 'string' ? x : x.id, m = Audio.getAsset(id), a = m || (typeof x === 'string' ? null : x);
    if (!a || (!m && a.lang === 'nan')) return t;
    return t + (a.duration || Math.max(1.5, (a.text || '').length * (a.lang === 'en' ? 0.07 : 0.24))) + (i ? 0.22 : 0.07);
  }, 0);
}
/**
 * 开出后报“下一站”：下一站有“前往××请从×出口”的景点广播时，这一段行车（出站 + 隧道）要等整段三语广播播完 + 一点余量才进站，
 * 不然进站广播（interrupt）会把景点那句掐掉。返回需要的最短行车时间（秒）；这段广播里没有景点出口那句（普通站、或终点前的“终点站”广播）返回 0 → 行车时长照旧（不变）。
 */
export const VISIT_MARGIN = 1.5;
// 只算带“请从×出口出站”的景点广播（诚毅广场那种只有“欢迎下车游玩”、没有出口的不算）
const isExitVisit = x => typeof x !== 'string' && /^voice\.(xm)?visit\./.test(x.id) && /出口|Exit/.test(x.text || '');
export function departHold(segs) { return segs.some(isExitVisit) ? seconds(segs) + VISIT_MARGIN : 0; }
/** 景点出口广播还在播（或还在等下载）时，行车保底上限从“还差的 + 6 s”放宽到“还差的 + VISIT_CAP s”（见 service.js cruiseDone） */
export const VISIT_CAP = 20;
const asSeg = x => typeof x === 'string' ? (Audio.getAsset(x) || { id: x }) : x;
export function visitLeft() { return Audio.pendingSegs().some(x => isExitVisit(asSeg(x))); }
/**
 * 预取：车停在上一站（或刚开出）时，把下一段“下一站……前往××请从×出口”整段广播的 MP3（所有会播的语种）先下载、解码好，
 * iPad 网络慢、没缓存时也不用开车后才一个个下载。只对有景点出口广播的段（departHold > 0）做；返回预取的片段 id。
 */
export function prefetchDepart(segs) {
  if (!departHold(segs)) return [];
  const ids = segs.map(x => typeof x === 'string' ? x : x.id).filter(id => { const a = Audio.getAsset(id); return a && a.file; });
  Audio.prefetch(ids);
  return ids;
}
export const arrive = code => say(P.arriveSegs(code), { key: 'arrive', interrupt: true });
export const welcome = code => say(P.welcomeSegs(code), { key: 'welcome' });
export const platform = (line, dir, n) => say(P.platformSegs(line, dir, n), { key: 'platform', interrupt: true });
export const doorsClosing = () => say(P.doorsClosingSegs(), { key: 'doorsClosing', interrupt: true });
export const safety = k => say(P.safetySegs(k), { key: 'safety' });
/** 厦门地铁报站（普通话 + 英语） */
export const xmDepart = (line, nextCode, dir, step, withDest) => say(P.xmDepartSegs(line, nextCode, dir, step, withDest), { key: 'next', interrupt: true });
export const xmPlatform = (line, dir, n) => say(P.xmPlatformSegs(line, dir, n), { key: 'platform', interrupt: true });
export const xmExit = code => say(P.xmExitSegs(code), { key: 'xmexit' });
