/*
 * 音频引擎（移植自旧项目 js/metro/audio.js，接口改为 ES 模块）。
 * 保留旧版做法：
 *   - 全部声音为同源本地 MP3（assets/audio，清单 manifest.json），运行时不调用任何 TTS 服务；
 *   - AudioContext 用硬件默认采样率（不再强制 24kHz：iPhone 上自定义采样率会静音/走调）；用 OfflineAudioContext 解码（循环床 16kHz、其余 24kHz），最多 2 路并发解码；
 *   - 语音按需解码，PCM 走 8MiB LRU 缓存（不淘汰正在播放的缓冲）；
 *   - 报站经“站台喇叭”链：高通 280Hz → 低通 4400Hz + 两路早期反射（53ms/137ms），播报时压低环境声；
 *   - 报站串行排队、epoch 取消、优先打断；每段开始/结束派发 gz-audio-caption 事件；
 *   - iOS：首次触摸内同步播放 1 帧静音并 resume（不能先 await 加载）；后台/pagehide 挂起，回前台重试；
 *     支持 navigator.audioSession 时请求 playback（在创建 / resume 之前）。
 *   - iOS 加固：每次手势都重试解锁直到真正 running；'interrupted' / resume 挂起 / running 但时钟不走 → 下一次手势关掉重建；
 *     手势里播一段静音 <audio playsinline>（iPhone 上循环，保证走媒体通道、不受静音键影响）；
 *     手势后仍没声音时显示“点一下开启声音”；?debug=audio 显示诊断面板。
 * 广播走非定位的 PA 链（旧版无喇叭点时的回退路径），不做 HRTF 空间定位。
 */
import { CONFIG } from '../core/config.js';
import * as WebSpeech from './webspeech.js';

const ROOT = new URL('../../assets/audio/', import.meta.url).href;
let ctx = null, master, compressor, buses, trainFilter, paInput, paNodes = [];
let manifest = null, manifestLoading = null;
let recreateNext = false, recreates = 0, unlockAttempts = 0, lastRecreate = 0, decodeOk = 0, decodeFail = 0, lastResumeErr = '';
let everUnlocked = false, needsGesture = true, muted = false, background = document.hidden, volume = 0.9;
const mix = { ambience: 0.55, train: 0.75, sfx: 0.8, voice: 1 };
const assets = Object.create(null), buffers = Object.create(null), compressed = Object.create(null);
const decoding = Object.create(null), missing = new Set(), decoders = Object.create(null);
const voiceUsed = Object.create(null); let voiceBytes = 0; const voiceLimit = 8 * 1048576;
let decodeActive = 0; const decodeWaiters = [];
const active = []; const ambient = Object.create(null); const loops = Object.create(null); const retired = [];
let zone = 'none', ducked = false;
const queue = []; let pumping = false, current = null, epoch = 0;
let train = { speed: 0, inside: true, braking: false }, lastTrainAt = -1;
const log = { played: [], announced: [], fallbacks: [], errors: [] };

function clamp(n, a, b) { return Math.max(a, Math.min(b, Number.isFinite(n) ? n : a)); }
function smooth(param, target, seconds) {
  if (!ctx) return;
  if (param.cancelAndHoldAtTime) param.cancelAndHoldAtTime(ctx.currentTime);
  else { param.cancelScheduledValues(ctx.currentTime); param.setValueAtTime(param.value, ctx.currentTime); }
  param.setTargetAtTime(target, ctx.currentTime, seconds || 0.08);
}
function gainNode(parent, v) { const n = ctx.createGain(); n.gain.value = v; n.connect(parent); return n; }
function canPlay() { return !!ctx && everUnlocked && ctx.state === 'running' && !background; }
function audioSession(v) { try { if (navigator.audioSession && navigator.audioSession.type !== v) navigator.audioSession.type = v; } catch (e) { err('audioSession ' + e); } }
function err(m) { log.errors.push(String(m)); if (log.errors.length > 40) log.errors.shift(); }
const PARAMS = new URLSearchParams(location.search);
// iPhone / iPod（iPadOS 的 Safari 报 Mac UA，不会命中 → iPad 和桌面行为不变）
const IPHONE = /iPhone|iPod/.test(navigator.userAgent);
// 静音键兜底：iPhone 上让一段静音 <audio> 循环播放（?audiokeep=0 关掉，=1 任何设备都开）
const KEEP_HTML = PARAMS.has('audiokeep') ? PARAMS.get('audiokeep') !== '0' : IPHONE;
function emit(name, detail) { window.dispatchEvent(new CustomEvent(name, { detail })); }

function context() {
  if (ctx) return ctx;
  const C = window.AudioContext || window.webkitAudioContext;
  if (!C) throw new Error('此浏览器不支持 Web Audio');
  audioSession('playback');  // 先声明会话类型再建上下文（iOS 17+；否则默认 ambient 会被静音键静掉）
  // 不指定 sampleRate：iPhone 硬件常是 48k，强制 24k 在 WebKit 里会走重采样，路由 / 会话变化后可能 running 但无声
  try { ctx = new C({ latencyHint: 'interactive' }); } catch (_) { ctx = new C(); }
  master = ctx.createGain(); master.gain.value = muted ? 0 : volume;
  compressor = ctx.createDynamicsCompressor();
  compressor.threshold.value = -8; compressor.knee.value = 6; compressor.ratio.value = 4; compressor.attack.value = 0.003; compressor.release.value = 0.18;
  master.connect(compressor); compressor.connect(ctx.destination);
  buses = { ambience: gainNode(master, mix.ambience), sfx: gainNode(master, mix.sfx), voice: gainNode(master, mix.voice), train: gainNode(master, mix.train), ui: gainNode(master, 0.5) };
  trainFilter = ctx.createBiquadFilter(); trainFilter.type = 'lowpass'; trainFilter.frequency.value = 2900; trainFilter.connect(buses.train);
  resetPA();
  const me = ctx;
  ctx.onstatechange = () => {
    if (me !== ctx) return;
    if (ctx.state === 'running') { needsGesture = false; hint(false); if (everUnlocked && !background) { updateZone(); updateTrain(true); } }
    else { needsGesture = !background; stopBeds(); }
    emit('gz-audio-state', { context: ctx.state, needsGesture, background });
  };
  return ctx;
}
function resetPA() {
  // 与旧版一致的站台喇叭链；取消时清掉延迟尾音
  paNodes.forEach(n => { try { n.disconnect(); } catch (_) {} }); paNodes.length = 0;
  const high = ctx.createBiquadFilter(), low = ctx.createBiquadFilter();
  high.type = 'highpass'; high.frequency.value = 280; low.type = 'lowpass'; low.frequency.value = 4400;
  high.connect(low); low.connect(buses.voice); paInput = high; paNodes.push(high, low);
  [0.053, 0.137].forEach((d, i) => {
    const delay = ctx.createDelay(0.5), wet = gainNode(buses.voice, [0.13, 0.07][i]), f = ctx.createBiquadFilter();
    delay.delayTime.value = d; f.type = 'lowpass'; f.frequency.value = 2200;
    low.connect(delay); delay.connect(f); f.connect(wet); paNodes.push(delay, f, wet);
  });
}
function applyMix() {
  if (!ctx) return;
  smooth(master.gain, muted ? 0 : volume, 0.03);
  smooth(buses.ambience.gain, mix.ambience * (ducked ? 0.25 : 1), ducked ? 0.05 : 0.2);
  smooth(buses.train.gain, mix.train * (ducked ? 0.45 : 1), ducked ? 0.05 : 0.2);
}
function duck(v) { if (ducked !== v) { ducked = v; applyMix(); } }

/* ---------- 加载与解码 ---------- */
export function loadManifest() {
  if (manifest) return Promise.resolve(manifest);
  if (manifestLoading) return manifestLoading;
  manifestLoading = fetch(ROOT + 'manifest.json').then(r => { if (!r.ok) throw new Error('音频清单加载失败 ' + r.status); return r.json(); })
    .then(m => { manifest = m; m.assets.forEach(a => { assets[a.id] = a; }); return m; })
    .catch(e => { manifestLoading = null; log.errors.push(e.message); throw e; });
  return manifestLoading;
}
async function decode(a, raw) {
  if (decodeActive >= 2) await new Promise(r => decodeWaiters.push(r));
  decodeActive++;
  try {
    const rate = a.loop ? 16000 : 24000;
    let dec = decoders[rate];
    if (!dec) { const O = window.OfflineAudioContext || window.webkitOfflineAudioContext; try { dec = O ? new O(1, 1, rate) : ctx; } catch (_) { dec = ctx; } decoders[rate] = dec; }
    const buf = await new Promise((res, rej) => { const p = dec.decodeAudioData(raw, res, rej); if (p && p.catch) p.catch(rej); });
    buffers[a.id] = buf; decodeOk++;
    if (a.group === 'voice') { voiceBytes += buf.length * buf.numberOfChannels * 4; voiceUsed[a.id] = performance.now(); trimVoice(a.id); }
    return buf;
  } finally { decodeActive--; const n = decodeWaiters.shift(); if (n) n(); }
}
function trimVoice(keep) {
  const ids = Object.keys(voiceUsed).sort((a, b) => voiceUsed[a] - voiceUsed[b]);
  for (let i = 0; voiceBytes > voiceLimit && i < ids.length; i++) {
    const id = ids[i]; if (id === keep || active.some(x => x.id === id)) continue;
    const b = buffers[id]; if (!b) continue;
    voiceBytes -= b.length * b.numberOfChannels * 4; delete buffers[id]; delete voiceUsed[id];
  }
}
/** 取得解码缓冲；文件缺失（404）时 reject，错误带 missing=true */
export async function ensureBuffer(id) {
  await loadManifest(); context();
  const a = assets[id];
  if (!a) { const e = new Error('清单里没有：' + id); e.missing = true; throw e; }
  if (buffers[id]) { if (a.group === 'voice') voiceUsed[id] = performance.now(); return buffers[id]; }
  if (missing.has(id)) { const e = new Error('素材缺失：' + a.file); e.missing = true; throw e; }
  if (decoding[id]) return decoding[id];
  decoding[id] = (async () => {
    let raw = compressed[id];
    if (!raw) {
      const r = await fetch(ROOT + a.file);
      if (!r.ok) { missing.add(id); const e = new Error('素材缺失：' + a.file); e.missing = true; throw e; }
      raw = await r.arrayBuffer();
      if (a.group === 'voice') compressed[id] = raw; // 语音保留小体积 MP3，PCM 可被 LRU 淘汰后重解
    }
    try { return await decode(a, a.group === 'voice' ? raw.slice(0) : raw); }
    catch (e) { decodeFail++; err('decode ' + id + ': ' + (e && e.message || e)); missing.add(id); e.missing = true; throw e; }
  })().finally(() => { delete decoding[id]; });
  return decoding[id];
}
/** 后台预取（不阻塞） */
export function prefetch(ids) { ids.forEach(id => ensureBuffer(id).catch(() => {})); }

/* ---------- 播放 ---------- */
function removeItem(it) { const i = active.indexOf(it); if (i !== -1) active.splice(i, 1); try { it.source.disconnect(); it.gain.disconnect(); } catch (_) {} }
function play(id, bus, opts = {}, done) {
  const buf = buffers[id];
  if (!buf || !canPlay()) { done && done(); return 0; }
  if (active.length >= 10) { const old = active.find(a => a.kind === 'sfx'); if (old) { try { old.source.stop(); } catch (_) {} old.finish(); } }
  const src = ctx.createBufferSource(), g = ctx.createGain();
  src.buffer = buf; src.playbackRate.value = clamp(opts.rate ?? 1, 0.25, 4);
  g.gain.value = clamp(opts.volume ?? 1, 0, 2); src.connect(g); g.connect(opts.pa ? paInput : bus);
  const it = { source: src, gain: g, id, kind: opts.kind || 'sfx' }; let ended = false;
  it.finish = () => { if (ended) return; ended = true; removeItem(it); done && done(); };
  src.onended = it.finish; active.push(it);
  src.start(ctx.currentTime + clamp(opts.delay || 0, 0, 10));
  log.played.push(id); if (log.played.length > 60) log.played.shift();
  return buf.duration / src.playbackRate.value;
}
function loop(id, parent) {
  const buf = buffers[id]; if (!buf) return null;
  const src = ctx.createBufferSource(), g = ctx.createGain();
  g.gain.value = 0; src.buffer = buf; src.loop = true; src.connect(g); g.connect(parent); src.start();
  const it = { source: src, gain: g };
  src.onended = () => { const i = retired.indexOf(it); if (i !== -1) retired.splice(i, 1); try { src.disconnect(); g.disconnect(); } catch (_) {} };
  return it;
}
function retire(coll, name, now) {
  const it = coll[name]; if (!it) return; delete coll[name];
  if (!now) { retired.push(it); smooth(it.gain.gain, 0, 0.25); }
  try { it.source.stop(ctx.currentTime + (now ? 0 : 1.2)); } catch (_) {}
}
function stopBeds() {
  Object.keys(ambient).forEach(n => retire(ambient, n, true));
  Object.keys(loops).forEach(n => retire(loops, n, true));
  retired.splice(0).forEach(it => { try { it.source.stop(); } catch (_) {} });
}
const ZONE_LEVEL = { street: 0.35, concourse: 0.6, platform: 0.7, train: 0.85 };   // 'none'：没有环境声（纪念堂大会堂里）
function updateZone() {
  if (!canPlay()) return;
  Object.keys(ambient).forEach(n => { if (n !== zone) retire(ambient, n); });
  if (zone === 'none') return;
  const id = 'ambience.' + zone;
  if (ambient[zone]) { smooth(ambient[zone].gain.gain, ZONE_LEVEL[zone] ?? 0.6, 0.4); return; }
  const want = zone;
  ensureBuffer(id).then(() => {
    if (zone !== want || !canPlay() || ambient[want]) return;
    ambient[want] = loop(id, buses.ambience);
    if (ambient[want]) smooth(ambient[want].gain.gain, ZONE_LEVEL[want] ?? 0.6, 0.6);
  }).catch(e => log.errors.push(e.message));
}
/** 环境声区：'street' | 'concourse' | 'platform' | 'train' | 'none' */
export function setZone(z) { if (z !== zone) { zone = z; updateZone(); } }

function layer(name, target, rate) {
  if (!canPlay()) return;
  if (target <= 0) { retire(loops, name); return; }
  const id = 'train.' + name;
  if (!loops[name]) {
    if (!buffers[id]) { ensureBuffer(id).then(() => updateTrain(true)).catch(() => {}); return; }
    loops[name] = loop(id, trainFilter);
  }
  if (loops[name]) { smooth(loops[name].source.playbackRate, rate, 0.15); smooth(loops[name].gain.gain, target, 0.15); }
}
function updateTrain(force) {
  if (!canPlay()) return;
  if (!force && ctx.currentTime - lastTrainAt < 0.05) return;
  lastTrainAt = ctx.currentTime;
  const s = train.speed, moving = s > 0.006, body = train.inside ? 0.72 : 1;
  smooth(trainFilter.frequency, train.inside ? 2900 : 10500, 0.12);
  layer('motor', moving ? body * (0.13 + 0.49 * Math.sqrt(s)) * (train.braking ? 0.34 : 1) : 0, 0.42 + s * 1.65);
  layer('roll', moving ? body * (0.08 + 0.8 * s) : 0, 0.6 + s * 0.78);
  layer('joints', moving ? body * (0.12 + 0.3 * s) : 0, 0.28 + s * 1.85);
  layer('brake', train.braking && moving ? body * (0.2 + 0.38 * (1 - s)) : 0, 0.78 + s * 0.5);
}
/** 列车行驶声：每帧调用 {speed:0..1, inside, braking} */
export function trainSound(o) { train.speed = clamp(o.speed || 0, 0, 1); train.inside = o.inside !== false; train.braking = !!o.braking; updateTrain(false); }

/** 单次音效：name 为清单 id 或 sfx.xxx 的简写 */
export function sfx(name, opts = {}) {
  const id = assets[name] ? name : (name.indexOf('.') > 0 ? name : 'sfx.' + name);
  if (!canPlay()) return 0;
  const bus = id.startsWith('train.') ? buses.train : buses.sfx;
  if (buffers[id]) return play(id, bus, opts);
  ensureBuffer(id).then(() => { if (canPlay()) play(id, bus, opts); }).catch(e => log.errors.push(e.message));
  return assets[id] ? assets[id].duration : 0;
}
let stepIndex = 0;
export function footstep() { stepIndex = (stepIndex + 1) % 4; return sfx('sfx.footstep' + (stepIndex ? stepIndex + 1 : ''), { volume: 0.45, rate: 1.05 }); }

/** 合成的柔和提示音（机关咔哒、到达和弦），不需要素材文件 */
export function blip(kind = 'tick') {
  if (!canPlay()) return;
  // [频率, 延迟, 长度, 波形, 音量]
  const notes = { tick: [[880, 0.04, 0.05, 'sine', .12]], settle: [[660, 0.0, 0.25], [990, 0.07, 0.3]], goal: [[523, 0, .4], [659, .12, .4], [784, .24, .5], [1046, .36, .7]], nope: [[330, 0, .18]], tap: [[740, 0, .08]],
    // 售票 / 闸机 / 座位的小音效（全部合成，不用素材）
    coin: [[2093, 0, .09, 'triangle', .14], [3136, .035, .16, 'sine', .1], [2637, .09, .22, 'sine', .08]],
    note: [[420, 0, .12, 'triangle', .1], [520, .07, .1, 'triangle', .08], [1568, .16, .14, 'sine', .08]],
    whirr: [[180, 0, .35, 'triangle', .07], [240, .1, .3, 'triangle', .06], [300, .22, .2, 'triangle', .05]],
    drop: [[1568, 0, .1, 'triangle', .14], [1175, .12, .1, 'triangle', .1], [1397, .22, .08, 'triangle', .07]],
    clink: [[2637, 0, .18, 'sine', .1], [3520, .05, .22, 'sine', .07]],
    sparkle: [[1319, 0, .22, 'sine', .1], [1760, .07, .22, 'sine', .1], [2637, .14, .35, 'sine', .1], [3520, .21, .4, 'sine', .06]],
    oops: [[587, 0, .16, 'sine', .14], [440, .13, .26, 'sine', .12]],
    sit: [[392, 0, .12, 'sine', .14], [294, .08, .18, 'sine', .12]], stand: [[294, 0, .1, 'sine', .12], [440, .08, .16, 'sine', .14]] }[kind] || [];
  const t0 = ctx.currentTime;
  for (const [f, d, len, type, vol] of notes) {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type || 'sine'; o.frequency.value = f; g.gain.setValueAtTime(0, t0 + d);
    g.gain.linearRampToValueAtTime(vol ?? 0.22, t0 + d + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0008, t0 + d + len);
    o.connect(g); g.connect(buses.ui); o.start(t0 + d); o.stop(t0 + d + len + 0.05);
  }
}

/* ---------- 报站队列 ---------- */
function caption(a, extra) { emit('gz-audio-caption', a ? { id: a.id, text: a.text, lang: a.lang, channel: 'important', ...extra } : null); }
function sleep(ms, token) { return new Promise(r => { const t = setTimeout(r, ms); if (token) token.cancel = () => { clearTimeout(t); r(); }; }); }
let sleepToken = null;
function estimate(a) { return (a.duration || Math.max(1.5, (a.text || '').length * (a.lang === 'en' ? 0.07 : 0.24))) * 1000; }

/** 缺失片段的替代：VOICE_FALLBACK = 'webspeech'（浏览器朗读） | 'caption'（只显示字幕） */
async function fallbackClip(a, myEpoch) {
  log.fallbacks.push(a.id);
  const useSpeech = CONFIG.VOICE_FALLBACK === 'webspeech' && WebSpeech.available() && !muted && !background;
  caption(a, { silent: !useSpeech, fallback: CONFIG.VOICE_FALLBACK });
  if (useSpeech) {
    const spoken = await WebSpeech.speakClip(a.text, a.lang, estimate(a) + 4000);
    if (spoken) return;
  }
  sleepToken = {}; await sleep(estimate(a), sleepToken);
}
async function pump() {
  if (pumping) return;
  pumping = true; duck(true);
  try {
    while (queue.length) {
      const item = queue.shift(); current = item;
      if (item.epoch !== epoch) { item.resolve({ cancelled: true }); continue; }
      for (let i = 0; i < item.ids.length && item.epoch === epoch; i++) {
        // 片段可以是清单 id，也可以是 {id, lang, text}（新车站：清单里没有 MP3 时直接走 Web Speech 回退）
        const x = item.ids[i], a = typeof x === 'string' ? assets[x] : (assets[x.id] || x);
        if (!a) { log.errors.push('未知片段 ' + x); continue; }
        if (!canPlay() || muted) {
          // 未解锁/静音/后台：照样按时长显示字幕，保证游戏节奏一致
          caption(a, { silent: true }); sleepToken = {}; await sleep(estimate(a) + (i ? 220 : 70), sleepToken); continue;
        }
        let ok = !!(a.file && assets[a.id]);
        if (ok) { try { await ensureBuffer(a.id); } catch (e) { ok = false; } }
        if (item.epoch !== epoch) break;
        if (!ok) { await fallbackClip(a, item.epoch); continue; }
        caption(a);
        log.announced.push(a.id);
        await new Promise(res => { const d = play(a.id, buses.voice, { pa: true, volume: 1, delay: i ? 0.22 : 0.07, kind: 'voice' }, res); if (!d) res(); });
      }
      item.resolve({ cancelled: item.epoch !== epoch });
    }
  } finally { current = null; pumping = false; duck(false); caption(null); }
}
/** 串行播放一组片段 id（普通话→粤语→英语的顺序由调用方给出）。返回 Promise<{cancelled}> */
export function announceIds(ids, meta = {}) {
  return loadManifest().then(() => new Promise(resolve => {
    if (meta.interrupt) cancelAnnouncements();
    queue.push({ ids, resolve, epoch, key: meta.key });
    // 预取本组语音，减少段间停顿
    prefetch(ids.map(x => typeof x === 'string' ? x : x.id).filter(id => assets[id]));
    pump();
  }));
}
export function cancelAnnouncements() {
  epoch++;
  queue.splice(0).forEach(q => q.resolve({ cancelled: true }));
  active.slice().forEach(a => { if (a.kind === 'voice') { try { a.source.stop(); } catch (_) {} a.finish(); } });
  if (sleepToken && sleepToken.cancel) sleepToken.cancel();
  WebSpeech.cancel();
  if (ctx) resetPA();
  caption(null);
}
/** 只取消某几类广播（例如上车后站台的进站 / 欢迎广播不该继续在车厢里响）；其余排队的照常播 */
export function cancelKeys(keys) {
  const ks = new Set(keys), keep = [];
  queue.splice(0).forEach(q => { if (ks.has(q.key)) q.resolve({ cancelled: true }); else keep.push(q); });
  if (current && ks.has(current.key)) {
    epoch++;
    active.slice().forEach(a => { if (a.kind === 'voice') { try { a.source.stop(); } catch (_) {} a.finish(); } });
    if (sleepToken && sleepToken.cancel) sleepToken.cancel();
    WebSpeech.cancel(); if (ctx) resetPA(); caption(null);
  }
  keep.forEach(q => { q.epoch = epoch; queue.push(q); });
  if (keep.length) pump();
}
export function isAnnouncing() { return pumping || queue.length > 0; }

/* ---------- 解锁 / 生命周期 ---------- */
// 0.5 秒 8kHz 8-bit 静音 WAV（运行时生成 data URI）。在手势里播放它：iOS 会把页面音频切到媒体（playback）通道
function silentWav() {
  const n = 4000, b = new Uint8Array(44 + n), v = new DataView(b.buffer);
  const w = (o, t) => { for (let i = 0; i < t.length; i++) b[o + i] = t.charCodeAt(i); };
  w(0, 'RIFF'); v.setUint32(4, 36 + n, true); w(8, 'WAVEfmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
  v.setUint32(24, 8000, true); v.setUint32(28, 8000, true); v.setUint16(32, 1, true); v.setUint16(34, 8, true); w(36, 'data'); v.setUint32(40, n, true);
  b.fill(128, 44);
  let str = ''; for (let i = 0; i < b.length; i++) str += String.fromCharCode(b[i]);
  return 'data:audio/wav;base64,' + btoa(str);
}
let htmlEl = null, htmlState = 'none';
function primeHtml() {
  if (background) return;
  try {
    if (!htmlEl) {
      htmlEl = document.createElement('audio');
      htmlEl.setAttribute('playsinline', ''); htmlEl.setAttribute('webkit-playsinline', ''); htmlEl.setAttribute('x-webkit-airplay', 'deny');
      htmlEl.preload = 'auto'; htmlEl.loop = KEEP_HTML; htmlEl.disableRemotePlayback = true; htmlEl.src = silentWav();
    }
    // iPhone：一直循环（暂停了就重新播）；其他设备：播一次就够
    if (KEEP_HTML ? (!htmlEl.paused && htmlState !== 'error') : (htmlState === 'played' || htmlState === 'pending')) return;
    htmlState = 'pending';
    const p = htmlEl.play();
    if (p && p.then) p.then(() => { htmlState = 'played'; }, e => { htmlState = 'error'; err('html ' + (e && e.name || e)); });
    else htmlState = 'played';
  } catch (e) { htmlState = 'error'; err('html ' + e.message); }
}
function pauseHtml() { try { if (KEEP_HTML && htmlEl && !htmlEl.paused) { htmlEl.pause(); htmlState = 'paused'; } } catch (_) {} }

/** 关掉坏掉的上下文（interrupted 收不回来 / running 但时钟不走 / closed），重建整条图。已解码的 AudioBuffer 可直接复用 */
function recreate(why) {
  const old = ctx; if (!old) return;
  err('recreate: ' + why); recreates++; lastRecreate = performance.now(); recreateNext = false; clock = null;
  try { stopBeds(); } catch (_) {}
  active.slice().forEach(a => { try { a.source.stop(); } catch (_) {} a.finish(); });
  Object.keys(decoders).forEach(k => { if (decoders[k] === old) delete decoders[k]; });
  old.onstatechange = null; ctx = null;
  try { const p = old.close(); if (p && p.catch) p.catch(() => {}); } catch (_) {}
  context();
}

// “点一下开启声音”：手势之后上下文仍没跑起来时显示，避免静默失败
let hintEl = null;
function hint(show) {
  if (show && (muted || background)) show = false;
  if (!show) { if (hintEl) hintEl.hidden = true; return; }
  if (!hintEl) {
    hintEl = document.createElement('div'); hintEl.id = 'audioHint'; hintEl.textContent = '🔇 点一下开启声音';
    hintEl.style.cssText = 'position:fixed;left:50%;top:calc(env(safe-area-inset-top,0px) + 10px);transform:translateX(-50%);z-index:9999;padding:6px 14px;border-radius:16px;background:rgba(0,0,0,.62);color:#fff;font:600 14px/1.3 system-ui,-apple-system,sans-serif;pointer-events:none;';
    document.body.appendChild(hintEl);
  }
  hintEl.hidden = false;
}

const RESUME_TIMEOUT = 1500;  // iOS 上 resume() 可能永远不 settle（WebKit 281566）
function withTimeout(p, ms) { return Promise.race([p, new Promise(r => setTimeout(() => r('timeout'), ms))]); }
let pendingUnlock = null, lastUnlockAt = -1e9;

/** 必须在真实触摸事件里同步调用（iOS Safari）。没确认 running 之前，每次手势都会再调 */
export function unlock() {
  const now = performance.now();
  // 同一次点击会依次触发 pointerdown / pointerup / touchend / click，30ms 内复用同一次尝试
  if (pendingUnlock && now - lastUnlockAt < 30 && ctx && !recreateNext) return pendingUnlock;
  lastUnlockAt = now; unlockAttempts++;
  try {
    audioSession('playback');            // 先声明会话类型，再建 / 恢复上下文
    primeHtml();
    if (ctx && ctx.state === 'closed') recreate('closed');
    else if (ctx && recreateNext && now - lastRecreate > 400) recreate('not running after previous gesture');
    context();
    const c = ctx;
    const s = c.createBufferSource(); s.buffer = c.createBuffer(1, 1, c.sampleRate);
    s.connect(c.destination); s.onended = () => s.disconnect(); s.start(0);
    if (CONFIG.VOICE_FALLBACK === 'webspeech') WebSpeech.prime();
    // iOS 的 'interrupted'：有的版本要先 suspend 再 resume 才能恢复
    if (c.state === 'interrupted') { try { const q = c.suspend(); if (q && q.catch) q.catch(() => {}); } catch (_) {} }
    const p = c.state === 'running' ? Promise.resolve() : c.resume();
    loadManifest().catch(() => {});
    pendingUnlock = withTimeout(p.then(() => 'ok', e => { lastResumeErr = String(e && (e.name + ' ' + e.message) || e); err('resume ' + lastResumeErr); return 'err'; }), RESUME_TIMEOUT).then(r => {
      if (c !== ctx) return !!ctx && ctx.state === 'running';
      const ok = c.state === 'running';
      if (r === 'timeout') err('resume timeout, state=' + c.state);
      everUnlocked = ok || everUnlocked; needsGesture = !ok;
      if (ok) recreateNext = false;
      else if (!background) recreateNext = true;   // 下一次手势关掉重建
      if (ok && !background) { updateZone(); updateTrain(true); }
      hint(!ok);
      emit('gz-audio-state', { context: c.state, needsGesture, background });
      return ok;
    });
    return pendingUnlock;
  } catch (e) { err('unlock ' + (e && e.message || e)); hint(true); return Promise.resolve(false); }
}
function visible(v) {
  background = !v;
  if (!v) { cancelAnnouncements(); stopBeds(); needsGesture = true; hint(false); pauseHtml(); audioSession('auto'); if (ctx && ctx.state === 'running') ctx.suspend().catch(() => {}); }
  else if (ctx && everUnlocked) {
    audioSession('playback');
    const c = ctx;
    withTimeout(c.resume().then(() => 'ok', () => 'err'), RESUME_TIMEOUT).then(r => {
      if (c !== ctx || background) return;
      needsGesture = c.state !== 'running';
      if (!needsGesture) { updateZone(); updateTrain(true); hint(false); }
      else { if (c.state !== 'suspended' || r !== 'ok') recreateNext = true; hint(true); }
    });
  }
}
document.addEventListener('visibilitychange', () => visible(!document.hidden));
window.addEventListener('pagehide', () => visible(false));
window.addEventListener('pageshow', e => { if (e.persisted) visible(!document.hidden); });
// 每种手势都试：iOS 有时不把 pointerdown / touchstart 当作用户激活，touchend / click 才算
['pointerdown', 'pointerup', 'touchend', 'click', 'keydown'].forEach(ev => document.addEventListener(ev, e => {
  if (document.hidden || (e.type === 'keydown' && e.repeat)) return;
  if (!ctx || ctx.state !== 'running' || needsGesture || recreateNext || (KEEP_HTML && htmlEl && htmlEl.paused)) unlock();
}, { capture: true, passive: true }));

// “running 但时钟不走”（iOS 路由 / 采样率变化后的已知症状）：标记下一次手势重建
let clock = null, stalls = 0;
setInterval(() => {
  if (!ctx || background || ctx.state !== 'running') { clock = null; return; }
  const now = performance.now(), t = ctx.currentTime;
  if (clock && now - clock.at > 900 && t - clock.t < 0.02) { stalls++; err('clock stalled while running'); recreateNext = true; needsGesture = true; hint(true); }
  clock = { t, at: now };
}, 1000);

function diag() {
  const as = navigator.audioSession;
  return {
    iphone: IPHONE, state: ctx ? ctx.state : 'none', sampleRate: ctx ? ctx.sampleRate : null,
    baseLatency: ctx && ctx.baseLatency != null ? +ctx.baseLatency.toFixed(4) : null, outputLatency: ctx && ctx.outputLatency != null ? +ctx.outputLatency.toFixed(4) : null,
    currentTime: ctx ? +ctx.currentTime.toFixed(2) : null,
    audioSession: as ? { supported: true, type: as.type, state: as.state } : { supported: false },
    html: { keep: KEEP_HTML, state: htmlState, paused: htmlEl ? htmlEl.paused : null },
    everUnlocked, needsGesture, recreateNext, recreates, unlockAttempts, stalls, lastResumeErr, decodeOk, decodeFail, muted, background,
    speech: WebSpeech.available(), errors: log.errors.slice(-6)
  };
}
export function diagnostics() { return diag(); }

// ?debug=audio：屏幕左侧（HUD 下面、摇杆上面）的诊断面板，只有按钮接收触摸（给 iPhone 用户截图用），带“测试音”和“重建”按钮
if ((PARAMS.get('debug') || '').split(',').includes('audio')) {
  const mount = () => {
    const box = document.createElement('div'); box.id = 'audioDebug';
    box.style.cssText = 'position:fixed;left:6px;top:calc(env(safe-area-inset-top,0px) + 232px);pointer-events:none;z-index:10000;max-width:min(92vw,420px);padding:6px 8px;border-radius:8px;background:rgba(0,0,0,.78);color:#cfe;font:11px/1.35 ui-monospace,Menlo,monospace;white-space:pre-wrap;word-break:break-all;';
    const pre = document.createElement('div'), row = document.createElement('div');
    row.style.cssText = 'margin-top:4px;display:flex;gap:6px';
    const btn = (label, fn) => { const b = document.createElement('button'); b.textContent = label; b.style.cssText = 'font:12px system-ui;padding:6px 12px;border-radius:6px;border:0;pointer-events:auto'; b.addEventListener('click', e => { e.stopPropagation(); fn(); }); ['pointerdown', 'touchstart'].forEach(t => b.addEventListener(t, e => e.stopPropagation(), { passive: true })); row.appendChild(b); };
    btn('测试音', () => { unlock().then(() => blip('goal')); });
    btn('重建', () => { recreateNext = true; lastRecreate = 0; pendingUnlock = null; unlock().then(() => blip('settle')); });
    box.appendChild(pre); box.appendChild(row); document.body.appendChild(box);
    const draw = () => {
      const d = diag(), a = d.audioSession;
      pre.textContent = [
        `ctx ${d.state}  ${d.sampleRate || '-'}Hz  t=${d.currentTime ?? '-'}  lat ${d.baseLatency ?? '-'}/${d.outputLatency ?? '-'}`,
        `audioSession ${a.supported ? 'supported type=' + a.type + ' state=' + a.state : 'NOT supported'}`,
        `html ${d.html.state}${d.html.keep ? ' (loop)' : ''} paused=${d.html.paused}  iphone=${d.iphone}`,
        `unlocked=${d.everUnlocked} needsGesture=${d.needsGesture} recreateNext=${d.recreateNext}`,
        `attempts=${d.unlockAttempts} recreates=${d.recreates} stalls=${d.stalls} muted=${d.muted}`,
        `decode ok=${d.decodeOk} fail=${d.decodeFail}  speech=${d.speech}`,
        d.lastResumeErr ? 'resumeErr ' + d.lastResumeErr : '',
        ...d.errors.map(e => '! ' + e)
      ].filter(Boolean).join('\n');
    };
    draw(); setInterval(draw, 500);
  };
  if (document.body) mount(); else document.addEventListener('DOMContentLoaded', mount);
}

export function setMuted(v) { muted = !!v; applyMix(); if (muted) { WebSpeech.cancel(); hint(false); } }
export function isMuted() { return muted; }
export function getManifest() { return manifest; }
export function getAsset(id) { return assets[id]; }
export function getState() {
  return {
    context: ctx ? ctx.state : 'uninitialized', unlocked: everUnlocked && !!ctx && ctx.state === 'running', needsGesture, background, muted,
    zone, ducked, announcing: current ? current.key : null, queued: queue.length, active: active.length,
    decoded: Object.keys(buffers).length, missing: [...missing], voiceCacheBytes: voiceBytes,
    sampleRate: ctx ? ctx.sampleRate : null, fallbackMode: CONFIG.VOICE_FALLBACK, diag: diag(),
    log: { played: log.played.slice(), announced: log.announced.slice(), fallbacks: log.fallbacks.slice(), errors: log.errors.slice() }
  };
}
