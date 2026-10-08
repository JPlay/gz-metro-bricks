/*
 * 入口：Babylon 引擎、灯光阴影、画质自适应、主循环；把车站 / 玩家 / 输入 / 列车 / 语音串起来。
 * window.__game 是给自动化测试用的调试接口（不影响正常游玩）。
 */
import { CONFIG } from './core/config.js';
import * as Audio from './audio/audio.js';
import * as Ann from './audio/announcements.js';
import { initCaptions } from './ui/captions.js';
import { Hud } from './ui/hud.js';
import { Station, SPAWN, MAIN, GYQ2, YC } from './world/station.js';
import { Player } from './game/player.js';
import { Input, pressable } from './game/input.js';
import { Footprints } from './game/footprints.js';
import { Metro } from './game/service.js';
import { mats } from './core/mats.js';
import { Render } from './core/render.js';
import { STATIONS, LINES, nextStation } from './data/lines.js';
const B = window.BABYLON;

class Events { constructor() { this.h = {}; } on(n, f) { (this.h[n] = this.h[n] || []).push(f); } emit(n, d) { (this.h[n] || []).forEach(f => f(d)); } }

export async function start() {
  // 加载各阶段耗时（毫秒，相对页面导航开始），测试读 window.__loadT
  const LT = window.__loadT = window.__loadT || {}; const mark = k => { LT[k] = Math.round(performance.now()); };
  mark('mainStart');
  const canvas = document.getElementById('c');
  const engine = new B.Engine(canvas, true, { stencil: false, powerPreference: 'high-performance', audioEngine: false }, false);
  const scene = new B.Scene(engine);
  scene.ambientColor = new B.Color3(0.35, 0.35, 0.38);
  scene.collisionsEnabled = true; scene.skipPointerMovePicking = true; scene.autoClear = true;
  const progress = (f, msg) => { if (window.__loadUI) return window.__loadUI.set(f, msg); const b = document.getElementById('loadBar'), m = document.getElementById('loadMsg'); if (b) b.style.width = Math.max(3, Math.min(100, f * 100)).toFixed(1) + '%'; if (m && msg) m.textContent = msg; };
  // 让浏览器先把进度画出来再做下一段同步重活（搭车站会占住主线程 1–2 秒）
  const paint = () => new Promise(r => requestAnimationFrame(() => setTimeout(r, 0)));
  progress(0.50, '正在准备材质…');
  const M = mats(scene);
  const cam = new B.FreeCamera('cam', new B.Vector3(0, 2, -52), scene); cam.minZ = 0.08; cam.maxZ = 420; cam.fov = 0.92; cam.inputs.clear();
  const R = new Render(engine, scene, cam);
  mark('render');
  progress(0.55, '正在搭建车站…');
  await paint();

  const events = new Events(), hud = new Hud(), input = new Input({
    surface: document.getElementById('touch'), stick: document.getElementById('stick'), hint: document.getElementById('stickHint'),
    onView: () => toggleView(), onFoot: () => toggleFoot(), onMute: () => toggleMute(), onJump: () => {}
  });
  const player = new Player(scene, M, cam), feet = new Footprints(scene);
  player.meshes().forEach(m => R.addShadowCaster(m));
  initCaptions();
  Audio.loadManifest().catch(e => console.warn('manifest', e));

  const G = { code: null, station: null, zone: { kind: 'street' }, welcomed: false, tier: CONFIG.fixedQuality ?? 1, fps: 60, auto: null, inTunnel: false, lastStep: 0 };
  const metro = new Metro(scene, {
    player, Audio, events, buildStation: code => buildStation(code), onTunnel: v => { G.inTunnel = v; scene.fogMode = v ? B.Scene.FOGMODE_LINEAR : B.Scene.FOGMODE_NONE; },
    get zone() { return G.zone; }
  });
  metro.trains.forEach(t => t.shadowMeshes.forEach(m => R.addShadowCaster(m)));
  scene.fogColor = new B.Color3(0.08, 0.09, 0.11); scene.fogStart = 25; scene.fogEnd = 85;

  function buildStation(code) {
    if (G.station) G.station.dispose();
    R.disposeProbes();
    const st = new Station(scene, code, events, M);
    st.kit.meshes.forEach(m => { m.receiveShadows = m.name !== 'glow' && m.name !== 'halo' && m.name !== 'shade'; });
    // 抛光地面的反射探针（站厅 / 站台各一个，静态渲染一次，盒投影）
    const list = st.probeMeshes(), byB = st.kit.byBucket;
    if (byB.floor) R.makeProbe('probeHall', new B.Vector3(0, YC + 2.2, 3), new B.Vector3(36, 4.4, 46), list, byB.floor.material);
    if (byB['floor@P']) R.makeProbe('probeP', new B.Vector3(0, MAIN.y + 2.1, MAIN.zc), new B.Vector3(96, 4.2, 12), list, byB['floor@P'].material);
    if (byB['floor@P2']) R.makeProbe('probeP2', new B.Vector3(0, GYQ2.y + 2.1, GYQ2.zc), new B.Vector3(96, 4.2, 12), list, byB['floor@P2'].material);
    G.station = st; G.code = code; G.welcomed = false; feet.clear();
    metro.attach(st);
    return st;
  }
  mark('trains'); progress(0.62, '正在搭建车站…'); await paint();
  // —— 开始位置：默认公园前站口外的街上
  if (CONFIG.start && STATIONS[CONFIG.start]) {
    const st = buildStation(CONFIG.start), P = st.platformFor(CONFIG.startLine) || st.platforms[0];
    player.spawn(20, P.y + 0.05, P.zc, Math.PI / 2);
  } else { buildStation('gyq'); player.spawn(SPAWN.x, SPAWN.y + 0.05, SPAWN.z, SPAWN.yaw); }
  mark('station');
  progress(0.72, '正在准备贴图与着色…');
  await paint();

  // —— 事件 → 提示
  const MVTXT = { penrose: '✨ 楼梯连成一圈了！', bridge: '✨ 桥自己拼起来了！', arches: '✨ 拱门对齐啦！' };
  events.on('gate', () => hud.toast('闸机开啦 ✔'));
  events.on('security', () => hud.toast('安检通过 ✔ 嘀！'));
  events.on('mv', d => { hud.toast(MVTXT[d.kind] || '✨', 2400); Audio.blip && Audio.blip('goal'); G.mv = (G.mv || 0) + 1; });
  events.on('ride', d => { if (d.phase === 'arrive') hud.toast(`到站：${STATIONS[d.to].zh}`, 2200); });

  // —— 按钮
  const toggleView = () => { const v = player.toggleView(); hud.setBtn('bView', v === 'first', v === 'first' ? 'eye1' : 'eye3', v === 'first' ? '第一人称' : '第三人称'); return v; };
  const toggleFoot = () => { const on = feet.toggle(); hud.setBtn('bFoot', on); hud.toast(on ? '发光脚印：开' : '脚印：关', 1200); return on; };
  const toggleMute = () => { Audio.setMuted(!Audio.isMuted()); hud.setBtn('bMute', Audio.isMuted(), Audio.isMuted() ? 'mute' : 'sound', Audio.isMuted() ? '静音' : '声音'); return Audio.isMuted(); };
  pressable(document.getElementById('bView'), toggleView);
  pressable(document.getElementById('bFoot'), toggleFoot);
  pressable(document.getElementById('bMute'), toggleMute);
  pressable(document.getElementById('bJump'), () => { input.jumpQueued = true; });
  hud.setBtn('bView', false, 'eye3', '第三人称');
  // iOS：第一次触摸时解锁音频（必须在手势事件里同步调用）
  let unlocked = false;
  const unlock = () => { if (unlocked) return; unlocked = true; Audio.unlock().then(ok => { if (!ok) unlocked = false; }); };
  ['pointerdown', 'touchend', 'click', 'keydown'].forEach(ev => document.addEventListener(ev, unlock, { capture: true, passive: true }));

  // —— 画质
  const applyQuality = () => { R.setTier(G.tier, CONFIG.qualityLevels); };
  applyQuality();
  mark('quality');
  let fpsAcc = 0, fpsN = 0, fpsT = 0, lowCount = 0;
  window.addEventListener('resize', () => engine.resize());

  // —— 主循环
  let stepAcc = 0;
  scene.onBeforeRenderObservable.add(() => {
    const dt = Math.min(0.05, engine.getDeltaTime() / 1000);
    // 自动驾驶（测试用）
    if (G.auto) {
      const a = G.auto, t = a.pts[a.i], p = player.position, dx = t[0] - p.x, dz = t[1] - p.z, d = Math.hypot(dx, dz);
      a.time += dt;
      if (d < 0.35) { a.i++; a.time = 0; if (a.i >= a.pts.length) { input.virtual = null; G.auto = null; a.resolve({ ok: true }); } }
      else if (a.time > 12) { input.virtual = null; G.auto = null; a.resolve({ ok: false, stuckAt: [p.x, p.y, p.z], target: t }); }
      else { player.yaw = Math.atan2(dx, dz); input.virtual = { x: 0, y: d < 1 ? 0.5 : 1, run: !!a.run && d > 2 }; }
    }
    const inp = input.read();
    const conv = G.station.conveyor(player.position);
    player.update(dt, inp, conv ? { x: conv * dt, z: 0 } : null);
    metro.update(dt);
    player.updateCamera(dt, scene);
    G.station.update(dt, player, cam, Audio, metro);
    // 区域 / 环境声 / 欢迎广播
    const p = player.position, aboard = metro.trains.some(t => t.root.isEnabled() && t.contains(p));
    G.zone = G.inTunnel ? { kind: 'tunnel' } : G.station.zoneOf(p); G.aboard = aboard || G.inTunnel;
    Audio.setZone(G.aboard ? 'train' : ({ street: 'street', platform: 'platform' }[G.zone.kind] || 'concourse'));
    if (G.zone.kind === 'platform' && !G.welcomed && !G.aboard) { G.welcomed = true; if (!Audio.isAnnouncing()) Ann.welcome(G.code); }
    const rl = metro.ride && metro.ride.train && G.aboard ? metro.ride : null;
    const line = rl ? rl.line : (G.zone.kind === 'platform' ? G.zone.P.line : STATIONS[G.code].lines[0]);
    hud.where(G.code, line, rl && rl.phase === 'cruise' ? rl.next : null);
    // 脚步声 / 脚印
    if (player.grounded && player.speed > 0.5 && !G.aboard) { stepAcc += player.speed * dt; if (stepAcc > 0.75) { stepAcc = 0; Audio.footstep(); } }
    feet.update(dt, p, player.facing, player.grounded, player.moving && !G.aboard);
    if (player.landed) { player.landed = false; Audio.sfx('footstep', { volume: 0.6, rate: 0.8 }); }
    // 掉出世界 → 回到站台 / 站口
    if (!G.inTunnel && p.y < -40) {
      const P = G.station.platforms[0]; player.spawn(20, P.y + 0.05, P.zc, Math.PI / 2); hud.toast('回到站台啦');
    }
    // 室内外灯光过渡 + 阴影跟随玩家
    R.update(dt, G.zone.kind === 'street' && !G.inTunnel ? 0 : 1, p);
    // 帧率 → 自动降档
    fpsAcc += engine.getFps(); fpsN++; fpsT += dt;
    if (fpsT > 3) {
      G.fps = fpsAcc / fpsN; fpsAcc = fpsN = fpsT = 0;
      if (CONFIG.fixedQuality === null && G.fps < 45 && G.tier < 3) { if (++lowCount >= 2) { G.tier++; lowCount = 0; applyQuality(); } } else lowCount = 0;
    }
  });
  // 等贴图 / 着色器：按真实剩余工作推进进度条（软件渲染下着色器编译很慢，不能卡在 95%）
  const readyAt = performance.now();
  const waitReady = async () => {
    const cap = 2500;
    while (performance.now() - readyAt < cap) {
      let ok = false; try { ok = scene.isReady(); } catch (_) {}
      const t = Math.min(1, (performance.now() - readyAt) / cap);
      progress(0.72 + 0.22 * t, '正在准备贴图与着色…');
      if (ok) return true;
      await new Promise(r => setTimeout(r, 100));
    }
    return false;
  };
  try { await waitReady(); } catch (_) {}
  mark('ready');
  progress(0.95, '正在打光…');
  R.refreshProbes();
  let nFrames = 0; scene.onAfterRenderObservable.add(() => { nFrames++; if (nFrames === 1) mark('frame1'); if (nFrames === 5) mark('frame5'); if (nFrames === 30) mark('frame30'); });
  engine.runRenderLoop(() => scene.render());
  // 等首帧出来再关加载页，进度走到 100%
  await new Promise(r => {
    const obs = scene.onAfterRenderObservable.add(() => {
      if (nFrames >= 1) { scene.onAfterRenderObservable.remove(obs); progress(1, '准备好了！'); r(); }
    });
    setTimeout(r, 2500);
  });
  const loading = document.getElementById('loading'); loading.classList.add('done'); setTimeout(() => loading.remove(), 700);
  setTimeout(() => R.preloadIndoor(), 1500);

  // —— 测试接口
  let inst = null; try { inst = new B.SceneInstrumentation(scene); inst.captureFrameTime = true; } catch (_) {}
  window.__game = {
    state: () => ({
      code: G.code, zone: G.zone.kind, pos: [player.position.x, player.position.y, player.position.z].map(v => +v.toFixed(2)), yaw: +player.yaw.toFixed(3), pitch: +player.pitch.toFixed(3),
      view: player.view, grounded: player.grounded, foot: feet.on, footCount: feet.count(), aboard: !!G.aboard, inTunnel: G.inTunnel, fps: Math.round(engine.getFps()), avgFps: Math.round(G.fps), tier: G.tier,
      metro: metro.info(), mv: G.mv || 0, camPos: [cam.position.x, cam.position.y, cam.position.z].map(v => +v.toFixed(2)),
      babylon: { version: B.Engine.Version, source: window.__babylonSource, attempts: window.__babylonAttempts },
      drawCalls: (engine._drawCalls && engine._drawCalls.current) ?? null, activeMeshes: scene.getActiveMeshes().length, gates: G.station.gates.map(g => +g.f.toFixed(2)),
      security: G.station.security.flash > 0, probes: R.probes.length, atlas: G.station.kit.atlas ? { y: G.station.kit.atlas.y + G.station.kit.atlas.row, overflow: G.station.kit.atlas.overflow } : null, audio: Audio.getState(),
      // 街面引导箭头：从出生点 (0,0,-48) 指向站口（+z）；yaw=0 即世界 +z
      guideArrow: { from: [SPAWN.x, SPAWN.z], toward: [0, -38], yaw: 0, tipSign: '+z' }
    }),
    teleport: (x, y, z, yaw) => player.spawn(x, y, z, yaw ?? player.yaw),
    setMove: (x, y, run) => { input.virtual = (x || y) ? { x, y, run } : null; },
    look: (dx, dy) => { input.look.x += dx; input.look.y += dy; },
    jump: () => { input.jumpQueued = true; }, toggleView, toggleFoot, toggleMute,
    autopilot: (pts, run) => new Promise(resolve => { G.auto = { pts, i: 0, time: 0, resolve, run }; }),
    call: (line, step) => metro.call(line, step), metro, player, scene, engine, events, render: R
  };
}
