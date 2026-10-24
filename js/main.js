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
import { Metro } from './game/service.js';
import { Tickets } from './game/ticket.js';
import { SeatCtl } from './game/seat.js';
import { Social } from './game/social.js';
import { Bubbles } from './ui/bubbles.js';
import { TvmPanel } from './ui/tvm.js';
import { mats } from './core/mats.js';
import { Render } from './core/render.js';
import { STATIONS, LINES, nextStation } from './data/lines.js';
import { networkSVG, xmNetworkSVG, panZoom } from './ui/netmap.js';
import { ATTRACTIONS, attractionExit } from './data/attractions.js';
import { Discovery } from './game/discovery.js';
import { installBrother } from './game/brother-main.js';
import { HotelCtl } from './game/hotel.js';
import { ClanCtl } from './game/clan.js';
import { EastCtl } from './game/east.js';
import { XmMetro } from './game/xmService.js';
import { XM_LINES, XM_STATIONS } from './data/xm-lines.js';
import { XO } from './world/xmn.js';
import { XM_ATTRACTIONS } from './data/xm-visits.js';
import { readSave, writeSave, clearSave, installAutosave } from './game/save.js';
const B = window.BABYLON;

class Events { constructor() { this.h = {}; } on(n, f) { (this.h[n] = this.h[n] || []).push(f); } emit(n, d) { (this.h[n] || []).forEach(f => f(d)); } }

export async function start() {
  // 加载各阶段耗时（毫秒，相对页面导航开始），测试读 window.__loadT
  const LT = window.__loadT = window.__loadT || {}; const mark = k => { LT[k] = Math.round(performance.now()); };
  mark('mainStart');
  const canvas = document.getElementById('c');
  // stencil: true —— iOS Safari 在 stencil:false 时默认帧缓冲往往只给 16 位深度（远处地面引导带 / 贴墙牌子闪烁、穿模的主因）；要 stencil 才会分配 D24S8
  const engine = new B.Engine(canvas, true, { stencil: true, depth: true, powerPreference: 'high-performance', audioEngine: false }, false);
  const scene = new B.Scene(engine);
  // 默认帧缓冲的深度位数（建好引擎、还没画任何东西时读一次；测试和真机排查用）
  const DEPTH_BITS = (() => { try { return engine._gl.getParameter(engine._gl.DEPTH_BITS); } catch (_) { return null; } })(), depthBits = () => DEPTH_BITS;
  scene.ambientColor = new B.Color3(0.35, 0.35, 0.38);
  scene.collisionsEnabled = true; scene.skipPointerMovePicking = true; scene.autoClear = true;
  const progress = (f, msg) => { if (window.__loadUI) return window.__loadUI.set(f, msg); const b = document.getElementById('loadBar'), m = document.getElementById('loadMsg'); if (b) b.style.width = Math.max(3, Math.min(100, f * 100)).toFixed(1) + '%'; if (m && msg) m.textContent = msg; };
  // 让浏览器先把进度画出来再做下一段同步重活（搭车站会占住主线程 1–2 秒）
  const paint = () => new Promise(r => requestAnimationFrame(() => setTimeout(r, 0)));
  progress(0.50, '正在给车站刷油漆…');
  const M = mats(scene);
  const cam = new B.FreeCamera('cam', new B.Vector3(0, 2, -52), scene); cam.minZ = 0.25; cam.maxZ = 420; // 近裁剪面：第三人称 0.25（深度精度 ≈ 距离² / 近裁剪面，比 0.08 好 3 倍），第一人称 / 镜头贴近时在 Player.updateCamera 里降到 0.1 cam.fov = 0.92; cam.inputs.clear();
  const R = new Render(engine, scene, cam);
  mark('render');
  progress(0.55, '正在铺轨道…');
  await paint();

  const events = new Events(), hud = new Hud(), input = new Input({
    surface: document.getElementById('touch'), stick: document.getElementById('stick'), hint: document.getElementById('stickHint'),
    onView: () => toggleView(), onMute: () => toggleMute(), onJump: () => {}
  });
  const player = new Player(scene, M, cam);
  const tickets = new Tickets({ hud, Audio, events, panel: new TvmPanel({ Audio }), scene, cam });
  const seats = new SeatCtl({ player, metro: null, Audio, events });
  seats.hall = () => (G.station && G.station.interior && G.station.interior.active ? G.station.interior : null);
  player.leanFn = p => { const h = seats.hall(); return h && h.lean ? h.lean(p) : 0; };
  const bubbles = new Bubbles(scene, cam);
  player.onStandRequest = () => seats.stand();
  player.meshes().forEach(m => R.addShadowCaster(m));
  initCaptions();
  Audio.loadManifest().catch(e => console.warn('manifest', e));

  const G = { code: null, station: null, zone: { kind: 'street' }, welcomed: false, tier: CONFIG.fixedQuality ?? 1, fps: 60, auto: null, inTunnel: false, lastStep: 0 };
  const metro = new Metro(scene, {
    player, Audio, events, buildStation: code => buildStation(code), onTunnel: v => { G.inTunnel = v; scene.fogMode = v ? B.Scene.FOGMODE_LINEAR : B.Scene.FOGMODE_NONE; },
    get zone() { return G.zone; },
    extTrain: () => !!(east && east.ride)   // 动车在开：列车声由 js/game/east.js 控制
  });
  seats.metro = metro;
  const discovery = new Discovery({ Audio, player, events });
  const social = new Social({ scene, player, bubbles, Audio, events, getStation: () => G.station, getCode: () => G.code, getMetro: () => metro });
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
    st.ticketPolicy = tickets;
    G.station = st; G.code = code; G.gzCode = code; G.welcomed = false;
    metro.attach(st);
    return st;
  }
  mark('trains'); progress(0.62, '正在搭站台…'); await paint();
  // —— 开始位置：默认公园前站口外的街上
  if (CONFIG.start && STATIONS[CONFIG.start]) {
    const st = buildStation(CONFIG.start), P = st.platformFor(CONFIG.startLine) || st.platforms[0];
    player.spawn(20, P.y + 0.05, P.zc, Math.PI / 2);
  } else {
    // 续玩：读存档（坏档 / 版本不对 → readSave 返回 null → 默认开局）
    const sv = readSave(); let ok = false;
    if (sv && sv.city === 'gz' && STATIONS[sv.code]) {
      try {
        const st = buildStation(sv.code);
        if (sv.platform || !sv.pos) { const P = (sv.line && st.platformFor(sv.line)) || st.platforms[0]; player.spawn(20, P.y + 0.05, P.zc, Math.PI / 2); }
        else player.spawn(sv.pos[0], sv.pos[1], sv.pos[2], sv.yaw);
        ok = true; G.resumed = 'gz';
      } catch (e) { console.warn('resume gz failed', e); clearSave(); }
    }
    if (sv && sv.city === 'xm' && XM_STATIONS[sv.code]) G.pendingXm = sv;
    if (!ok) { buildStation('gyq'); player.spawn(SPAWN.x, SPAWN.y + 0.05, SPAWN.z, SPAWN.yaw); }
  }
  mark('station');
  progress(0.72, '正在贴瓷砖、挂站牌…');
  await paint();

  // —— 事件 → 提示
  const MVTXT = { penrose: '✨ 楼梯连成一圈了！', bridge: '✨ 桥自己拼起来了！', arches: '✨ 拱门对齐啦！' };
  events.on('gate', d => { if (d.beep) hud.toast('闸机开啦 ✔'); });
  events.on('security', () => hud.toast('安检通过 ✔ 嘀！'));
  events.on('mv', d => { hud.toast(MVTXT[d.kind] || '✨', 2400); Audio.blip && Audio.blip('goal'); G.mv = (G.mv || 0) + 1; });
  events.on('ride', d => { if (d.phase === 'arrive') { const nm = (STATIONS[d.to] || XM_STATIONS[d.to] || {}).zh || d.to; hud.toast(`到站：${nm}`, 2200); G.arrived = true; G.welcomed = false; } });

  // —— 按钮
  const toggleView = () => { const v = player.toggleView(); hud.setBtn('bView', v === 'first', v === 'first' ? 'eye1' : 'eye3', v === 'first' ? '第一人称' : '第三人称'); return v; };
  const toggleMute = () => { Audio.setMuted(!Audio.isMuted()); hud.setBtn('bMute', Audio.isMuted(), Audio.isMuted() ? 'mute' : 'sound', Audio.isMuted() ? '静音' : '声音'); return Audio.isMuted(); };
  // 地图按钮：全屏全网线路图，当前站有脉动的“你在这里”
  const mapEl = document.getElementById('netmap');
  // 竖屏用竖版布局（铺满宽度）；地图里可以双指缩放、单指拖动，双击还原
  // 点地图上的景点小图标：弹出一张小卡片（景点名 + 从哪个出口出站）
  const attrCard = document.createElement('div'); attrCard.className = 'attrcard'; attrCard.hidden = true; mapEl.querySelector('.sheet').appendChild(attrCard);
  const hideCard = () => { attrCard.hidden = true; G.attrCard = null; };
  const showCard = (id, cx, cy) => {
    const xa = XM_ATTRACTIONS.find(t => t.id === id), a = xa || ATTRACTIONS.find(t => t.id === id); if (!a) return false;
    attrCard.innerHTML = xa ? `<b>${a.names.join('<br>')}</b><span>${XM_STATIONS[a.code].zh}站 · ${a.exit ? `从 <em>${a.exit}</em> 号出口出站` : '在本站下车'}</span>`
      : `<b>${a.names.join('<br>')}</b><span>${STATIONS[a.code].zh.replace(/站$/, '')}站 · 从 <em>${attractionExit(a.code)}</em> 出口出站</span>`;
    attrCard.hidden = false; const sh = mapEl.querySelector('.sheet').getBoundingClientRect(), w = attrCard.offsetWidth, h = attrCard.offsetHeight;
    attrCard.style.left = Math.max(8, Math.min(sh.width - w - 8, cx - sh.left - w / 2)) + 'px'; attrCard.style.top = Math.max(8, Math.min(sh.height - h - 8, cy - sh.top - h - 30)) + 'px';
    G.attrCard = { id, text: attrCard.textContent }; Audio.blip && Audio.blip('tap'); return true;
  };
  const mapTap = (x, y) => { const g = document.elementsFromPoint(x, y).map(e => e.closest && e.closest('g.attr')).find(Boolean); if (g) return showCard(g.dataset.attr, x, y); hideCard(); return false; };
  const mapBox = mapEl.querySelector('.mapbox'), mapPZ = panZoom(mapBox, mapTap);
  const drawMap = () => {
    G.mapPortrait = innerHeight > innerWidth;
    if (xmMetro && xmMetro.station) mapBox.innerHTML = xmNetworkSVG(xmMetro.code, { portrait: G.mapPortrait });
    else mapBox.innerHTML = networkSVG(G.code, { portrait: G.mapPortrait });
    mapPZ.reset(); hideCard();
  };
  const openMap = () => { drawMap(); mapEl.classList.remove('out'); mapEl.hidden = false; G.mapOpen = true; Audio.blip && Audio.blip('tap'); };
  window.addEventListener('resize', () => { if (G.mapOpen && G.mapPortrait !== (innerHeight > innerWidth)) drawMap(); });
  const closeMap = () => { if (!G.mapOpen) return; G.mapOpen = false; mapEl.classList.add('out'); setTimeout(() => { if (!G.mapOpen) mapEl.hidden = true; }, 200); };
  pressable(document.getElementById('bMap'), () => G.mapOpen ? closeMap() : openMap());
  mapEl.addEventListener('pointerdown', e => { e.stopPropagation(); if (e.target.closest('.x') || e.target === mapEl) { e.preventDefault(); closeMap(); } });
  ['pointermove', 'pointerup', 'click', 'touchstart'].forEach(t => mapEl.addEventListener(t, e => e.stopPropagation()));
  window.addEventListener('keydown', e => { if (e.code === 'Escape') closeMap(); });
  pressable(document.getElementById('bView'), toggleView);
  pressable(document.getElementById('bMute'), toggleMute);
  pressable(document.getElementById('bJump'), () => { input.jumpQueued = true; });
  // 动作大按钮（买票 / 刷卡 / 坐下 / 起身）；键盘 E
  const doAct = () => { const a = hud.act; if (a && a.run) { a.run(); hud.actKey = null; } };
  pressable(document.getElementById('bAct'), doAct);
  window.addEventListener('keydown', e => { if (e.code === 'KeyE' && !e.repeat) doAct(); });
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
  let stepAcc = 0, hotel = null, clan = null, east = null, xmMetro = null;
  scene.onBeforeRenderObservable.add(() => {
    const dt = Math.min(G.dtMax || 0.05, engine.getDeltaTime() / 1000);
    // 自动驾驶（测试用）
    if (G.auto) {
      const a = G.auto, t = a.pts[a.i], p = player.position, dx = t[0] - p.x, dz = t[1] - p.z, d = Math.hypot(dx, dz);
      a.time += dt;
      const warped = a.lp && Math.hypot(p.x - a.lp[0], p.z - a.lp[1]) > 20; a.lp = [p.x, p.z];
      if (warped) { input.virtual = null; G.auto = null; a.resolve({ ok: true, warped: true }); }   // 走进 / 走出独立内景（车厢、陈家祠…）被传送了：停下
      else if (player.frame) { input.virtual = null; G.auto = null; a.resolve({ ok: true, framed: true }); }  // 到达机位接管镜头时停下
      else if (d < 0.35) { a.i++; a.time = 0; if (a.i >= a.pts.length) { input.virtual = null; G.auto = null; a.resolve({ ok: true }); } }
      else if (a.time > 12) { input.virtual = null; G.auto = null; a.resolve({ ok: false, stuckAt: [p.x, p.y, p.z], target: t }); }
      else { player.yaw = Math.atan2(dx, dz); input.virtual = { x: 0, y: d < 1 ? 0.5 : 1, run: !!a.run && d > 2 }; }
    }
    const inp = input.read(), p0 = player.position;
    let inXm = !!(xmMetro && xmMetro.station);
    const conv = (!inXm && !(east && east.cur)) ? G.station.conveyor(player.position) : 0;
    player.update(dt, inp, conv ? { x: conv * dt, z: 0 } : null);
    if (inXm) xmMetro.update(dt); else if (!(east && east.cur)) metro.update(dt);
    player.syncSeat();
    player.updateCamera(dt, scene);
    if (!inXm && !(east && east.cur)) G.station.update(dt, player, cam, Audio, metro);
    // 动作按钮：车厢里优先“坐下 / 起身”，否则售票机 / 闸机
    const hotelAct = hotel ? hotel.update(dt) : null; if (clan) clan.update(dt); if (east) east.update(dt);
    // 厦门北走楼梯回国铁：east.update 这一帧拆了地铁站，后面的区域 / HUD 要按国铁算
    if (inXm && !xmMetro.station) inXm = false;
    const seatAct = seats.update(), ticketAct = tickets.update(dt, G.station, player), socialAct = social.update(dt);
    hud.action(seatAct || hotelAct || ticketAct || socialAct);
    // 车厢里的乘客动画（只动玩家所在 / 附近的车）
    for (const t of metro.trains) if (t.root.isEnabled() && t.pax && Math.abs(t.root.position.x - p0.x) < 45 && Math.abs(t.root.position.y - p0.y) < 6) for (const q of t.pax) q.p.animate(dt);
    bubbles.update(dt);
    // 坐着时藏起“跳”按钮（起身用右下角的“起身”）
    const seated = !!player.seat; if (seated !== G.jumpHidden) { G.jumpHidden = seated; document.getElementById('bJump').hidden = seated; }
    // 区域 / 环境声 / 欢迎广播
    const p = player.position;
    const aboardGz = !(east && east.cur) && !inXm && metro.trains.some(t => t.root.isEnabled() && t.contains(p));
    const aboardXm = inXm && xmMetro.trains.some(t => t.root.isEnabled() && t.contains(p));
    G.aboard = aboardGz || aboardXm || G.inTunnel;
    // 在厦门地铁里 G.code 是厦门站码；回到广州（坐动车回来时广州站不重建）要换回广州站码，否则 STATIONS[G.code] 为空，HUD 每帧报错、游戏卡死
    if (!inXm && G.gzCode) G.code = G.gzCode;
    if (G.inTunnel) G.zone = { kind: 'tunnel' };
    else if (inXm) { G.zone = xmMetro.zoneOf(p); G.code = xmMetro.code; }
    else if (east && east.cur) G.zone = { kind: 'xmn', area: east.area };
    else G.zone = G.station.zoneOf(p);
    // 在地面上看不到地下的列车（车站全在地下）：用 layerMask 跳过列车网格，省掉两列车 ~6 万三角形
    { const lm = G.zone.kind === 'street' || G.zone.kind === 'hall' ? 0x0FFFFFFF : 0x1FFFFFFF; if (cam.layerMask !== lm) cam.layerMask = lm; }
    // 站台上看列车：只有自己坐的那列车画车厢里的屏（线路图条 / LCD / 呼吸光圈 / 亮面件），别的车隔着窗看不清，省 4 次绘制 / 列；
    // 地下没有太阳：列车不投太阳阴影（每列车 3 次阴影绘制）
    for (const t of [...metro.trains, ...(xmMetro ? xmMetro.trains : [])]) {
      if (!t._inner) t._inner = t.root.getChildMeshes(false).filter(m => /^(trainStrip|trainLcd|trainHotGlow|gloss|leafInner)$/.test(m.name) || (m.sourceMesh && m.sourceMesh.name === 'leafInner'));
      const inside = t.root.isEnabled() && t.contains(p);
      if (t._innerOn !== inside) { t._innerOn = inside; t._inner.forEach(m => m.setEnabled(inside)); }
      // 车厢乘客：自己坐的车全显示；别的车只显示 20m 内的（远处隔着两层玻璃看不出来，每人 1 次绘制）
      if (t.pax && t.root.isEnabled()) for (const q of t.pax) { const m = q.p.mesh, w = m.getAbsolutePosition(), on = inside || (w.x - p.x) ** 2 + (w.z - p.z) ** 2 < 20 * 20; if (m.isEnabled() !== on) m.setEnabled(on); }
      const sh = G.zone.kind === 'street' && !G.inTunnel;
      if (t._shOn !== sh && t.shadowMeshes) { t._shOn = sh; const rl = R.sg.getShadowMap().renderList; for (const m of t.shadowMeshes) { const i = rl.indexOf(m); if (sh && i < 0) rl.push(m); else if (!sh && i >= 0) rl.splice(i, 1); } }
    }
    R.setSunShadow(G.zone.kind === 'street' || G.zone.kind === 'hall');
    // 坐车到站、走出车厢 → 主角庆祝一下（两只拳头举起“努力！”）
    if (G.wasAboard && !G.aboard && G.arrived) { G.arrived = false; player.celebrate(); }
    G.wasAboard = G.aboard;
    // 纪念堂大会堂 / 店里：没有车站环境声（广播本身由下面“出了车站”那行停掉）
    const inHall = G.zone.kind === 'hall';
    // 一上车：站台上的进站 / 欢迎 / 安全广播不再继续在车厢里响
    if (G.aboard && !G.annAboard) Audio.cancelKeys(['platform', 'welcome', 'safety']);
    G.annAboard = G.aboard;
    // 声音分区：地铁声只在车站里（出口楼梯上随高度渐弱，到街面为 0）；街面车流；饭店嘈杂；酒店 / 纪念堂 / 陈家祠安静
    // 室内：酒店 / 饭店（饭店内景在地下 y≈-30，zoneOf 看不出来，按控制器判断）/ 陈家祠 / 纪念堂大会堂
    const hallKind = hotel && hotel.cur ? 'hotel' : G.brother && G.brother.food && G.brother.food.cur ? 'restaurant' : clan && clan.cur ? 'clan' : inXm ? (xmMetro.street && !xmMetro.street.inside ? null : 'xmmetro') : east && east.cur ? (east.loc === 'car' ? 'emu' : 'xmn') : inHall ? 'sysy' : null;
    { let metroL = 1, streetL = 0;
      if (G.aboard || G.inTunnel) metroL = 1;
      else if (hallKind === 'xmn' && east.area === 'plaza') { metroL = 0; streetL = 1; }   // 厦门北站南广场：露天，街上的声音
      else if (hallKind === 'emu' || hallKind === 'xmn' || hallKind === 'xmmetro') metroL = 1;   // 动车 / 国铁厦门北 / 厦门地铁
      else if (hallKind) metroL = 0;
      else { const u = Math.max(0, Math.min(1, (p.y - (YC + 1)) / (-0.4 - (YC + 1)))); streetL = u * u * (3 - 2 * u); metroL = 1 - streetL; }
      const sm = !hallKind && G.station && G.station.sm ? Math.max(0, Math.min(1, (-78 - p.z) / 14)) : 0;
      const ez = !hallKind && G.station && G.station.gze ? Math.max(0, Math.min(1, (-86 - p.z) / 5)) : 0;   // 广州东站：进了候车大厅，街上的车流声轻下去
      streetL *= 1 - 0.7 * ez;   // 沙面：过了沙基涌，车流声轻下去、榕树上有鸟叫
      Audio.setEnv({ metro: metroL, street: streetL * (1 - 0.65 * sm), birds: streetL * sm, restaurant: hallKind === 'restaurant' ? 1 : 0, sub: G.aboard || G.inTunnel || hallKind === 'emu' ? 'train' : G.zone.kind === 'platform' || (hallKind === 'xmn' && east.area === 'platform') || hallKind === 'xmmetro' ? 'platform' : 'concourse' }); }
    if (G.zone.kind === 'platform' && !G.welcomed && !G.aboard && !inXm) { G.welcomed = true; if (!Audio.isAnnouncing()) Ann.welcome(G.code); }
    if (inXm && G.zone.kind === 'platform' && !G.welcomed && !G.aboard) { G.welcomed = true; if (!Audio.isAnnouncing()) Ann.welcome(xmMetro.code); }
    // 出了车站（街面 / 纪念堂大会堂）：站内广播（欢迎 / 进站 / 关门）和字幕立刻停，不再跟着人走到街上
    if ((G.zone.kind === 'street' || G.zone.kind === 'hall') && !G.aboard && !(east && east.cur) && Audio.isAnnouncing()) Audio.cancelAnnouncements();
    const rlXm = inXm && xmMetro.ride && xmMetro.ride.train && G.aboard ? xmMetro.ride : null;
    const rl = !inXm && metro.ride && metro.ride.train && G.aboard ? metro.ride : null;
    if (inXm) hud.whereXm(xmMetro.code, rlXm ? rlXm.line : (G.zone.P ? G.zone.P.line : XM_STATIONS[xmMetro.code].lines[0]), rlXm && rlXm.phase === 'cruise' ? rlXm.next : null);
    else { const rh = east && east.railHud(); if (rh) hud.whereRail(rh); else { const line = rl ? rl.line : (G.zone.kind === 'platform' ? G.zone.P.line : STATIONS[G.code].lines[0]); hud.where(G.code, line, rl && rl.phase === 'cruise' ? rl.next : null); } }
    discovery.update({ code: G.code, zone: G.zone, station: G.station, dt });
    // 脚步声
    // 脚步声：按实际水平位移算速度（被挡住、站着不动就没有脚步），步幅随速度变大；地面：站内地砖 / 街面石板 / 地毯（饭店、酒店）/ 木地板（纪念堂）
    { const surface = hallKind === 'hotel' || hallKind === 'restaurant' ? 'carpet' : hallKind === 'sysy' ? 'wood' : hallKind === 'emu' ? 'carpet' : hallKind === 'clan' || (G.zone.kind === 'street' && !hallKind) || (hallKind === 'xmn' && east.area === 'plaza') ? 'stone' : 'tile';
      const lp = G.stepPos || (G.stepPos = p.clone()), v = dt > 0 ? Math.hypot(p.x - lp.x, p.z - lp.z) / dt : 0; lp.copyFrom(p);
      const stride = Math.max(0.65, Math.min(1.05, 0.6 + 0.08 * v));
      if (player.grounded && !G.aboard && !player.seat && v > 0.35 && v < 15) { stepAcc += v * dt; if (stepAcc >= stride) { stepAcc -= stride; Audio.footstep({ surface, k: Math.min(1.2, 0.75 + v * 0.08) }); } }
      else stepAcc = Math.min(stepAcc, stride * 0.55);
      if (player.landed) { player.landed = false; Audio.footstep({ surface, land: true }); } }
    // 掉出世界 → 回到站台 / 站口
    if (!G.inTunnel && p.y < -40) {
      if (inXm) {
        const P = xmMetro.station.platforms[0];
        const z = P.sideOnly === 'A' ? P.zc - 2.2 : P.sideOnly === 'B' ? P.zc + 2.2 : P.zc + 2;
        player.spawn(XO.x + 10, P.y + 0.05, z, Math.PI / 2); hud.toast('回到站台啦');
      }
      else if (!(east && east.cur)) { const P = G.station.platforms[0]; player.spawn(20, P.y + 0.05, P.zc, Math.PI / 2); hud.toast('回到站台啦'); }
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
      progress(0.72 + 0.22 * t, '正在贴瓷砖、挂站牌…');
      if (ok) return true;
      await new Promise(r => setTimeout(r, 100));
    }
    return false;
  };
  try { await waitReady(); } catch (_) {}
  mark('ready');
  progress(0.95, '正在点亮站厅…');
  R.refreshProbes();
  let nFrames = 0; scene.onAfterRenderObservable.add(() => { nFrames++; if (nFrames === 1) mark('frame1'); if (nFrames === 5) mark('frame5'); if (nFrames === 30) mark('frame30'); });
  engine.runRenderLoop(() => scene.render());
  // 等首帧出来再关加载页，进度走到 100%
  await new Promise(r => {
    const obs = scene.onAfterRenderObservable.add(() => {
      if (nFrames >= 1) { scene.onAfterRenderObservable.remove(obs); progress(1, '列车到站啦，出发！'); r(); }
    });
    setTimeout(r, 2500);
  });
  const loading = document.getElementById('loading'); loading.classList.add('done'); setTimeout(() => loading.remove(), 700);
  setTimeout(() => R.preloadIndoor(), 1500);

  // —— 测试接口
  let inst = null; try { inst = new B.SceneInstrumentation(scene); inst.captureFrameTime = true; } catch (_) {}
  // 哥哥明明 + 美食店（选角色、换人、美食护照；见 js/game/brother-main.js）
  // 丽呈铂锐酒店（农讲所站）：大堂 / 电梯 / 楼梯 / 客房（见 js/game/hotel.js）
  hotel = new HotelCtl({ scene, M, player, hud, seats, Audio, events, getStation: () => G.station, getCode: () => G.code });
  // 陈家祠头进（陈家祠站 C 出口）：见 js/game/clan.js
  clan = new ClanCtl({ scene, M, player, hud, seats, Audio, events, getStation: () => G.station });
  // 广州东站：站台上停着的复兴号 5 号车厢（二等座）：见 js/game/east.js
  east = new EastCtl({ scene, M, player, hud, seats, Audio, events, getStation: () => G.station });
  xmMetro = new XmMetro(scene, {
    player, Audio, events,
    onTunnel: v => { G.inTunnel = v; scene.fogMode = v ? B.Scene.FOGMODE_LINEAR : B.Scene.FOGMODE_NONE; },
    getRailway: () => east && east.xmn,
    onNewTrain: t => t.shadowMeshes && t.shadowMeshes.forEach(m => R.addShadowCaster(m))
  });
  east.xmMetro = xmMetro;
  seats.xmMetro = xmMetro;   // 厦门地铁车厢也走同一套「坐下 / 起身」
  // 续玩：厦门地铁（要等 east / xmMetro 建好）。跟从国铁走进厦门北地铁一样：广州场景关掉，xmMetro 接管
  if (G.pendingXm) {
    const sv = G.pendingXm; G.pendingXm = null;
    try {
      east.ensure(); east.side = 'xm'; east.cur = { st: G.station, loc: 'xmmetro', area: 'metro' }; G.station.kit.root.setEnabled(false);
      xmMetro.buildStation(sv.code); events.emit('xm', { enter: true, code: sv.code });
      const st = xmMetro.station;
      if (sv.platform || !sv.pos) { const P = (sv.line && st.platformFor(sv.line)) || st.platforms[0]; const z = P.sideOnly === 'A' ? P.zc - 2.2 : P.sideOnly === 'B' ? P.zc + 2.2 : P.zc + 2; player.spawn(XO.x + 10, P.y + 0.05, z, Math.PI / 2); }
      else player.spawn(sv.pos[0], sv.pos[1], sv.pos[2], sv.yaw);
      G.resumed = 'xm';
    } catch (e) { console.warn('resume xm failed', e); clearSave(); G.noSave = true; location.reload(); }
  }
  const brother = installBrother({ scene, cam, M, player, R, hud, seats, social, bubbles, Audio, events, input, getStation: () => G.station, getCode: () => G.code }); G.brother = brother;
  // 自动存档（5 秒 / 切后台 / 关页面）；测试 URL（?start=）也存，方便 e2e 验证
  const saveCtx = { player, G, metro, xmMetro: () => xmMetro, east: () => east, hotel: () => hotel, clan: () => clan, brother: () => brother, off: () => !!G.noSave };
  installAutosave(saveCtx);
  // 地图面板里唯一的「回到起点」：清存档、重新开局
  { const hd = mapEl.querySelector('header'), b = document.createElement('button'); b.className = 'restart'; b.textContent = '回到起点'; b.setAttribute('aria-label', '回到起点');
    hd.insertBefore(b, hd.querySelector('.x'));
    pressable(b, () => { G.noSave = true; clearSave(); location.reload(); }); }
  window.__game = {
    state: () => ({
      code: G.code, zone: G.zone.kind, pos: [player.position.x, player.position.y, player.position.z].map(v => +v.toFixed(2)), yaw: +player.yaw.toFixed(3), pitch: +player.pitch.toFixed(3),
      view: player.view, grounded: player.grounded, aboard: !!G.aboard, inTunnel: G.inTunnel, fps: Math.round(engine.getFps()), avgFps: Math.round(G.fps), tier: G.tier,
      metro: metro.info(), xmMetro: xmMetro ? xmMetro.info() : null, mv: G.mv || 0, camPos: [cam.position.x, cam.position.y, cam.position.z].map(v => +v.toFixed(2)),
      babylon: { version: B.Engine.Version, source: window.__babylonSource, attempts: window.__babylonAttempts },
      drawCalls: (engine._drawCalls && engine._drawCalls.current) ?? null, activeMeshes: scene.getActiveMeshes().length, depthBits: depthBits(), minZ: cam.minZ, gates: G.station.gates.map(g => +g.f.toFixed(2)),
      security: G.station.security.flash > 0, probes: R.probes.length, atlas: G.station.kit.atlas ? { y: G.station.kit.atlas.y + G.station.kit.atlas.row, overflow: G.station.kit.atlas.overflow } : null, audio: Audio.getState(),
      ticket: tickets.info(), seat: seats.info(), social: social.info(), discover: discovery.info(), hotel: hotel ? hotel.info() : null, clan: clan ? clan.info() : null, east: east ? east.info() : null, hall: G.station && G.station.interior ? G.station.interior.info() : null, mapOpen: !!G.mapOpen, attrCard: G.attrCard || null, act: hud.act ? { id: hud.act.id, label: hud.act.label } : null
    }),
    teleport: (x, y, z, yaw) => player.spawn(x, y, z, yaw ?? player.yaw),
    setMove: (x, y, run) => { input.virtual = (x || y) ? { x, y, run } : null; },
    look: (dx, dy) => { input.look.x += dx; input.look.y += dy; },
    jump: () => { input.jumpQueued = true; }, toggleView, toggleMute,
    autopilot: (pts, run) => new Promise(resolve => { G.auto = { pts, i: 0, time: 0, resolve, run }; }),
    call: (line, step) => (xmMetro && xmMetro.station ? xmMetro.call(line, step) : metro.call(line, step)), openMap, closeMap, mapZoom: mapPZ,
    // 测试：软件渲染只有几帧每秒，放宽单帧步长上限让游戏时间接近墙钟（默认 0.05）
    setDtMax: v => { G.dtMax = v; }, save: { write: () => writeSave(saveCtx), read: readSave, clear: clearSave, off: () => { G.noSave = true; }, resumed: () => G.resumed || null }, act: doAct, Audio, brother, hotel, clan, east, xmMetro, tickets, seats, social, discovery, bubbles, metro, player, scene, engine, events, render: R, get station() { return G.station; }
  };
}
