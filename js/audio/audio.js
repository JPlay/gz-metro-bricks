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
 * 声音分区（setEnv）：地铁声（列车行驶 / 进出站、站内音效、广播、站台 / 站厅环境）都经过一个“地铁”增益，只在车站里是 1，
 *   上出口楼梯时随高度渐弱、到街面为 0；街面是车流环境；饭店里是合成的人声嘈杂 + 碗筷碰撞；酒店 / 纪念堂 / 陈家祠里安静。
 *   站台上列车声跟着真实列车走（离得近更响，隔一层楼更轻）。
 * 脚步声（footstep）：全部合成（噪声沙沙 + 脚跟闷响 + 脚尖轻响），每步音高 / 音量 / 时机随机一点；按地面分：
 *   站内地砖清脆、街面石板发闷、木地板、草地，地毯（饭店 / 酒店）几乎听不见。节奏由调用方按实际走路速度控制。
 */
import { CONFIG } from '../core/config.js';
import * as WebSpeech from './webspeech.js';

const ROOT = new URL('../../assets/audio/', import.meta.url).href;
let ctx = null, master, compressor, buses, trainFilter, trainNear, metroTrain, metroSfx, metroTrainSfx, paOut, stepBus, paInput, paNodes = [];
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
let train = { speed: 0, inside: true, braking: false, near: 1 }, lastTrainAt = -1;
// 声音分区：metro 地铁声 0..1（站内 1，出口楼梯上渐弱，街面 0）；street 街面车流；restaurant 饭店嘈杂；sub 站内哪种环境床
const env = { metro: 1, street: 0, restaurant: 0, sub: 'concourse' };
const steps = { count: 0, last: null, times: [] };
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
  // 地铁声总闸：列车循环（低通 → 距离 → 地铁）、列车单次音效、站内音效、站台喇叭，都乘 env.metro
  metroTrain = gainNode(buses.train, env.metro); metroTrainSfx = gainNode(buses.train, env.metro); metroSfx = gainNode(buses.sfx, env.metro); paOut = gainNode(buses.voice, env.metro);
  trainNear = gainNode(metroTrain, 1); stepBus = gainNode(buses.sfx, 1);
  // 一路恒为 0 的常量源接到地铁总闸上：没有列车声 / 音效在播时 Chrome 会跳过这些“空闲”节点，增益自动化不推进，
  // 读出来的 gain.value 一直停在旧值（测试里看到街面上 metro=1）。接上它们就一直被处理，读数 = 实际增益
  try { const keep = ctx.createConstantSource(); keep.offset.value = 0; [trainNear, metroTrain, metroTrainSfx, metroSfx, paOut].forEach(n => keep.connect(n)); keep.start(); } catch (e) { err('keep ' + e); }
  trainFilter = ctx.createBiquadFilter(); trainFilter.type = 'lowpass'; trainFilter.frequency.value = 2900; trainFilter.connect(trainNear);
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
  high.connect(low); low.connect(paOut); paInput = high; paNodes.push(high, low);
  [0.053, 0.137].forEach((d, i) => {
    const delay = ctx.createDelay(0.5), wet = gainNode(paOut, [0.13, 0.07][i]), f = ctx.createBiquadFilter();
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
  const it = coll[name]; if (!it) return; delete coll[name]; if (it.timer) { clearInterval(it.timer); it.timer = null; }
  if (!now) { retired.push(it); smooth(it.gain.gain, 0, 0.25); }
  try { it.source.stop(ctx.currentTime + (now ? 0 : 1.2)); } catch (_) {}
}
function stopBeds() {
  Object.keys(ambient).forEach(n => retire(ambient, n, true));
  Object.keys(loops).forEach(n => retire(loops, n, true));
  retired.splice(0).forEach(it => { if (it.timer) clearInterval(it.timer); try { it.source.stop(); } catch (_) {} });
}
const ZONE_LEVEL = { street: 0.4, concourse: 0.6, platform: 0.7, train: 0.85, restaurant: 0.5 };
const FADE = 0.3;   // 时间常数：约 1 秒基本淡完
/** 共享白噪声（2 秒，每个上下文一份）：脚步声和饭店嘈杂都从里面随机位置取 */
let noise = null;
function noiseBuf() {
  if (noise && noise.ctx === ctx) return noise.buf;
  const n = ctx.sampleRate * 2, buf = ctx.createBuffer(1, n, ctx.sampleRate), d = buf.getChannelData(0);
  for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
  noise = { ctx, buf }; return buf;
}
/** 饭店环境（合成，不要素材）：噪声过三个“共振峰”带通、各自慢慢起伏 → 远处人声嘈杂；随机碗筷 / 汤匙碰撞 */
function restaurantBed(parent) {
  const g = ctx.createGain(); g.gain.value = 0; g.connect(parent);
  const src = ctx.createBufferSource(); src.buffer = noiseBuf(); src.loop = true;
  const mixG = gainNode(g, 0.9), oscs = [];
  [[380, 1.6, 0.5, 2.3], [950, 2.2, 0.38, 3.1], [2100, 2.6, 0.2, 4.4], [3000, 3, 0.08, 5.7]].forEach(([f, q, lvl, hz]) => {
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = f; bp.Q.value = q;
    const am = gainNode(mixG, lvl); src.connect(bp); bp.connect(am);
    const lfo = ctx.createOscillator(), lg = ctx.createGain(); lfo.frequency.value = hz * (0.85 + Math.random() * 0.3); lg.gain.value = lvl * 0.55;
    lfo.connect(lg); lg.connect(am.gain); lfo.start(); oscs.push(lfo);
  });
  src.start(0, Math.random() * 1.8);
  const it = { source: src, gain: g, synth: true };
  const clink = () => {
    if (!canPlay() || ctx.state !== 'running') return;
    const t = ctx.currentTime + Math.random() * 0.2, v = 0.035 + Math.random() * 0.05;
    if (Math.random() < 0.6) {   // 瓷碗 / 汤匙：几个不成谐波的分音，短促衰减
      const f0 = 1900 + Math.random() * 1700;
      for (const [k, a] of [[1, 1], [2.71, 0.5], [5.13, 0.22]]) {
        const o = ctx.createOscillator(), e = ctx.createGain(); o.frequency.value = f0 * k; e.gain.setValueAtTime(0, t); e.gain.linearRampToValueAtTime(v * a, t + 0.003);
        e.gain.exponentialRampToValueAtTime(0.0003, t + 0.12 + Math.random() * 0.25); o.connect(e); e.connect(g); o.start(t); o.stop(t + 0.45);
      }
    } else {   // 筷子：两下很短的“嗒嗒”
      for (let k = 0; k < 2; k++) {
        const n = ctx.createBufferSource(), hp = ctx.createBiquadFilter(), e = ctx.createGain(), tk = t + k * (0.05 + Math.random() * 0.05);
        n.buffer = noiseBuf(); hp.type = 'bandpass'; hp.frequency.value = 3200 + Math.random() * 1500; hp.Q.value = 2.5;
        e.gain.setValueAtTime(0, tk); e.gain.linearRampToValueAtTime(v * 1.4, tk + 0.002); e.gain.exponentialRampToValueAtTime(0.0003, tk + 0.03);
        n.connect(hp); hp.connect(e); e.connect(g); n.start(tk, Math.random() * 1.8); n.stop(tk + 0.05);
      }
    }
  };
  it.timer = setInterval(() => { if (Math.random() < 0.45) clink(); }, 330);
  src.onended = () => { oscs.forEach(o => { try { o.stop(); } catch (_) {} }); const i = retired.indexOf(it); if (i !== -1) retired.splice(i, 1); try { src.disconnect(); g.disconnect(); } catch (_) {} };
  return it;
}
function bedWant() {
  const w = {};
  if (env.metro > 0.002) w[env.sub] = env.metro * (ZONE_LEVEL[env.sub] ?? 0.6);
  if (env.street > 0.002) w.street = env.street * ZONE_LEVEL.street;
  if (env.restaurant > 0.002) w.restaurant = env.restaurant * ZONE_LEVEL.restaurant;
  return w;
}
/** 按 env 调各条环境床和地铁总闸（淡入淡出约 1 秒） */
function updateZone() {
  if (!canPlay()) return;
  for (const n of [metroTrain, metroTrainSfx, metroSfx, paOut]) smooth(n.gain, env.metro, FADE);
  const want = bedWant();
  Object.keys(ambient).forEach(n => { if (!(n in want)) retire(ambient, n); });
  for (const [name, level] of Object.entries(want)) {
    if (ambient[name]) { smooth(ambient[name].gain.gain, level, FADE); continue; }
    if (name === 'restaurant') { ambient[name] = restaurantBed(buses.ambience); smooth(ambient[name].gain.gain, level, FADE); continue; }
    const id = 'ambience.' + name;
    ensureBuffer(id).then(() => {
      if (!canPlay() || ambient[name]) return;
      const lv = bedWant()[name]; if (!lv) return;
      ambient[name] = loop(id, buses.ambience);
      if (ambient[name]) smooth(ambient[name].gain.gain, lv, FADE * 1.5);
    }).catch(e => log.errors.push(e.message));
  }
}
/** 声音分区：{ metro 0..1, street 0..1, restaurant 0..1, sub: 'concourse'|'platform'|'train' }；每帧调用也可以（变化小于 0.01 不动） */
export function setEnv(o) {
  let ch = false;
  for (const k of ['metro', 'street', 'restaurant']) if (o[k] !== undefined) { const v = clamp(o[k], 0, 1), snap = v < 0.01 ? 0 : v > 0.99 ? 1 : v; if (Math.abs(snap - env[k]) >= 0.01 || (snap !== env[k] && (snap === 0 || snap === 1))) { env[k] = snap; ch = true; } }
  if (o.sub && o.sub !== env.sub) { env.sub = o.sub; ch = true; }
  if (ch) { zone = env.metro > 0.5 ? env.sub : env.restaurant > 0.5 ? 'restaurant' : env.street > 0.5 ? 'street' : 'none'; updateZone(); }
}
/** 旧接口：'street' | 'concourse' | 'platform' | 'train' | 'none' */
export function setZone(z) {
  setEnv(z === 'street' ? { metro: 0, street: 1, restaurant: 0 } : z === 'none' ? { metro: 0, street: 0, restaurant: 0 } : { metro: 1, street: 0, restaurant: 0, sub: z });
}

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
  smooth(trainNear.gain, train.inside ? 1 : train.near, 0.12);   // 站台上：跟着真实列车的远近
  smooth(trainFilter.frequency, train.inside ? 2900 : 10500, 0.12);
  layer('motor', moving ? body * (0.13 + 0.49 * Math.sqrt(s)) * (train.braking ? 0.34 : 1) : 0, 0.42 + s * 1.65);
  layer('roll', moving ? body * (0.08 + 0.8 * s) : 0, 0.6 + s * 0.78);
  layer('joints', moving ? body * (0.12 + 0.3 * s) : 0, 0.28 + s * 1.85);
  layer('brake', train.braking && moving ? body * (0.2 + 0.38 * (1 - s)) : 0, 0.78 + s * 0.5);
}
/** 列车行驶声：每帧调用 {speed:0..1, inside, braking, near:0..1（离列车的远近，1 = 就在旁边）} */
export function trainSound(o) { train.speed = clamp(o.speed || 0, 0, 1); train.inside = o.inside !== false; train.braking = !!o.braking; train.near = clamp(o.near ?? 1, 0, 1); updateTrain(false); }

/** 单次音效：name 为清单 id 或 sfx.xxx 的简写 */
export function sfx(name, opts = {}) {
  const id = assets[name] ? name : (name.indexOf('.') > 0 ? name : 'sfx.' + name);
  if (!canPlay()) return 0;
  // 列车 / 车站的音效走地铁总闸（出了车站就听不到）
  const bus = id.startsWith('train.') ? metroTrainSfx : STATION_SFX.has(id) ? metroSfx : buses.sfx;
  if (buffers[id]) return play(id, bus, opts);
  ensureBuffer(id).then(() => { if (canPlay()) play(id, bus, opts); }).catch(e => log.errors.push(e.message));
  return assets[id] ? assets[id].duration : 0;
}
const STATION_SFX = new Set(['sfx.doorChime', 'sfx.psdOpen', 'sfx.psdClose', 'sfx.doorOpen', 'sfx.doorClose', 'sfx.gateBeep', 'sfx.gateOpen', 'sfx.securityBeep', 'sfx.escalator', 'sfx.ticketMachine', 'sfx.tokenDrop', 'sfx.horn']);
/* 脚步声地面：type/f/q 沙沙声的滤波，dec 衰减秒，vol 音量，thump 脚跟闷响（相对音量 / 频率），toe 脚尖轻响 */
const SURF = {
  tile:   { type: 'bandpass', f: 2900, q: 0.9, dec: 0.045, vol: 0.2,  thump: 0.45, tf: 125, toe: 0.55 },   // 站内花岗岩地砖：清脆
  stone:  { type: 'lowpass',  f: 1050, q: 0.6, dec: 0.06,  vol: 0.2,  thump: 0.6,  tf: 95,  toe: 0.35 },   // 街面石板：发闷
  wood:   { type: 'bandpass', f: 850,  q: 1.1, dec: 0.07,  vol: 0.17, thump: 0.75, tf: 160, toe: 0.4 },    // 木地板
  grass:  { type: 'bandpass', f: 2200, q: 0.6, dec: 0.11,  vol: 0.1,  thump: 0.15, tf: 90,  toe: 0.5 },    // 草地：沙沙
  carpet: { type: 'lowpass',  f: 380,  q: 0.5, dec: 0.05,  vol: 0.035, thump: 0.3, tf: 75,  toe: 0 }       // 地毯：几乎听不见
};
function burst(t, S, v, r, dec, dest) {
  const n = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
  n.buffer = noiseBuf(); n.playbackRate.value = r; f.type = S.type; f.frequency.value = S.f * r; f.Q.value = S.q;
  g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(v, t + 0.004); g.gain.exponentialRampToValueAtTime(0.0003, t + dec);
  n.connect(f); f.connect(g); g.connect(dest); n.start(t, Math.random() * 1.7); n.stop(t + dec + 0.05);
  n.onended = () => { try { n.disconnect(); f.disconnect(); g.disconnect(); } catch (_) {} };
}
/** 一步脚步声（合成）。o: { surface: 'tile'|'stone'|'wood'|'grass'|'carpet', land: 落地, k: 额外音量系数 } */
export function footstep(o = {}) {
  const surface = SURF[o.surface] ? o.surface : 'tile', S = SURF[surface];
  steps.count++; steps.last = { surface, land: !!o.land, at: Math.round(performance.now()) }; steps.times.push(steps.last.at); if (steps.times.length > 40) steps.times.shift();
  if (!canPlay()) return 0;
  const t = ctx.currentTime + 0.005 + Math.random() * 0.012, r = 1 + (Math.random() * 2 - 1) * 0.08;
  const v = S.vol * (0.78 + Math.random() * 0.44) * (o.k ?? 1) * (o.land ? 1.5 : 1), dec = S.dec * (0.85 + Math.random() * 0.3) * (o.land ? 1.4 : 1);
  burst(t, S, v, r, dec, stepBus);                                                                  // 鞋底落地的沙沙
  if (S.thump) {                                                                                    // 脚跟闷响：低频，音高往下掉
    const os = ctx.createOscillator(), g = ctx.createGain(), f0 = S.tf * r * (o.land ? 0.8 : 1);
    os.frequency.setValueAtTime(f0, t); os.frequency.exponentialRampToValueAtTime(f0 * 0.6, t + 0.07);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(v * S.thump, t + 0.005); g.gain.exponentialRampToValueAtTime(0.0003, t + 0.08);
    os.connect(g); g.connect(stepBus); os.start(t); os.stop(t + 0.1); os.onended = () => { try { os.disconnect(); g.disconnect(); } catch (_) {} };
  }
  if (S.toe && !o.land) burst(t + 0.05 + Math.random() * 0.04, S, v * S.toe * (0.7 + Math.random() * 0.5), r * 1.08, dec * 0.6, stepBus);   // 脚尖滚过去的轻响
  return dec;
}

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
    ding: [[1568, 0, .45, 'sine', .15], [2093, .004, .5, 'sine', .06], [3136, .006, .2, 'sine', .03]],   // 电梯按钮：短促的“叮”
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
function gains() {
  if (!ctx) return null;
  const r = x => +x.toFixed(3), beds = {};
  Object.entries(ambient).forEach(([k, it]) => { beds[k] = r(it.gain.gain.value); });
  return { metroTarget: env.metro, metro: r(metroTrain.gain.value), sfx: r(metroSfx.gain.value), pa: r(paOut.gain.value), trainNear: r(trainNear.gain.value), beds, retiring: retired.length };
}
export function getState() {
  return {
    context: ctx ? ctx.state : 'uninitialized', unlocked: everUnlocked && !!ctx && ctx.state === 'running', needsGesture, background, muted,
    zone, ducked, env: { ...env }, gains: gains(), steps: { count: steps.count, last: steps.last, times: steps.times.slice(-12) }, train: { ...train }, announcing: current ? current.key : null, queued: queue.length, active: active.length,
    decoded: Object.keys(buffers).length, missing: [...missing], voiceCacheBytes: voiceBytes,
    sampleRate: ctx ? ctx.sampleRate : null, fallbackMode: CONFIG.VOICE_FALLBACK, diag: diag(),
    log: { played: log.played.slice(), announced: log.announced.slice(), fallbacks: log.fallbacks.slice(), errors: log.errors.slice() }
  };
}
