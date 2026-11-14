/*
 * 画质升级总控（默认就是升级画质；?mode=orig / ?no-<项> / ?light=dusk / ?gfxdebug 面板只给测试和对比用）：
 *   shadow  建筑与树冠日照投影：围绕玩家 200 m 见方烘焙「最高遮挡高度」图（R8，1536²），分帧烘焙不卡顿，
 *           走远 60 m / 换场景自动重烘；着色器沿光线反投查表（0 次额外绘制）；室内 / 隧道渐隐
 *   pbr     漆面微纹理 + 全材质法线 / ORM（R=AO，G=粗糙度，B=金属度=1 → 直接用材质标量）
 *   env     天空同源 HDR 环境球：sky_day / sky_dusk + env_day / env_dusk / env_indoor（.env）+ 灯光 / 调色
 *   shader  着色器零纹理增强（去重复宏观变化、贴地暗边、树叶透光、天空色边缘光）
 *   haze    户外大气薄雾（颜色取天空地平线）
 *   water   流动菲涅耳水波（公园前喷泉池）
 *   aa      锐利原生抗锯齿：去掉后期管线（FXAA + 1× 离屏 RT），由画布原生 MSAA 抗锯齿，色调映射在材质里做
 * 状态：mode 'orig' | 'up'，light 'day' | 'dusk'，f = 各项开关（只在 up 模式下生效）。
 */
import { GS, markGfxDirty, baseOf, HOOKS, ensureWater } from './gfxUpgradePlugin.js';
import { TEX, tex } from './mats.js';
import { CONFIG } from './config.js';
import { KITS } from '../world/kit.js';
const B = window.BABYLON;
const V3 = (x, y, z) => new B.Vector3(x, y, z).normalize();
const C3 = (r, g, b) => new B.Color3(r, g, b);
export const FEATURES = [
  ['shadow', '建筑与树冠日照投影 (0 Draw Call)'], ['pbr', '漆面微纹理 + 全材质法线/ORM'], ['env', '天空同源 HDR 环境球 (.env)'],
  ['shader', 'Shader 零纹理增强 (去重复+叶透光)'], ['haze', '户外大气薄雾'], ['water', '流动菲涅耳水波'], ['aa', '锐利原生抗锯齿 (去 FXAA 糊边)']
];
// 灯光预设：[户外, 站内]
export const LOOKS = {
  orig: { hemiI: [0.65, 0.95], hemiD: [C3(0.95, 0.97, 1.0), C3(1.0, 0.98, 0.94)], hemiG: [C3(0.55, 0.55, 0.5), C3(0.62, 0.62, 0.64)],
    sunI: [2.4, 0.9], sunD: [C3(1.0, 0.95, 0.86), C3(1.0, 0.99, 0.96)], sunDir: V3(-0.42, -1, 0.55), envI: [1.0, 0.9] },
  day: { hemiI: [0.42, 0.9], hemiD: [C3(0.9, 0.95, 1.0), C3(1.0, 0.97, 0.92)], hemiG: [C3(0.52, 0.5, 0.46), C3(0.58, 0.6, 0.64)],
    sunI: [3.2, 0.85], sunD: [C3(1.0, 0.94, 0.84), C3(1.0, 0.97, 0.92)], sunDir: V3(-0.48, -0.78, 0.40), envI: [0.62, 0.7],
    sky: 'assets/tex/sky_day.jpg', env: 'vendor/env/env_day.env', fog: C3(0.68, 0.77, 0.9), fogStart: 140, fogEnd: 480, leafCol: C3(1.0, 0.92, 0.62), rimCol: C3(0.55, 0.68, 0.9),
    ip: { exposure: 1.02, contrast: 1.12, sat: 26, hiHue: 45, hiDen: 6, hiSat: 10, shHue: 215, shDen: 10, shSat: 24 } },
  dusk: { hemiI: [0.5, 0.9], hemiD: [C3(1.0, 0.84, 0.74), C3(1.0, 0.95, 0.88)], hemiG: [C3(0.55, 0.42, 0.32), C3(0.58, 0.58, 0.62)],
    sunI: [3.6, 0.85], sunD: [C3(1.0, 0.70, 0.42), C3(1.0, 0.95, 0.88)], sunDir: V3(-0.78, -0.34, 0.52), envI: [0.6, 0.7],
    sky: 'assets/tex/sky_dusk.jpg', env: 'vendor/env/env_dusk.env', fog: C3(0.92, 0.66, 0.45), fogStart: 90, fogEnd: 360, leafCol: C3(1.0, 0.62, 0.3), rimCol: C3(0.75, 0.55, 0.55),
    ip: { exposure: 1.12, contrast: 1.1, sat: 20, hiHue: 35, hiDen: 20, hiSat: 30, shHue: 210, shDen: 15, shSat: 30 } }
};
const ORIG_IP = { exposure: 1.0, contrast: 1.12, sat: 22, hiHue: 30, hiDen: 0, hiSat: 10, shHue: 220, shDen: 6, shSat: 20 };
// 各桶升级贴图：alb 反照率、n 法线（没有就沿用原法线）、orm 打包贴图、nl 法线强度
const UP = {
  paint: { alb: 'paint_d', n: 'paint_n', orm: 'paint_orm', size: 1.6, nl: 0.3 },
  floor: { orm: 'floor_orm', env: 1.3, ro: false }, pave: { orm: 'pave_orm' }, tactile: { orm: 'tactile_orm' }, ceiling: { orm: 'ceiling_orm' }, wall: { orm: 'wall_orm', env: 1.0 },
  metal: { n: 'steel_n', orm: 'steel_orm', nl: 0.3 }, concrete: { n: 'concrete_n', orm: 'concrete_orm', nl: 0.55 }, brick: { orm: 'brick_orm' }, qz: { orm: 'qingzhuan_orm' },
  granite: { orm: 'granite_orm' }, asphalt: { n: 'asphalt_n', orm: 'asphalt_orm', nl: 0.45 }, grass: { n: 'grass_n', orm: 'grass_orm', nl: 0.55 }, facade: { n: 'facade_n', orm: 'facade_orm', nl: 0.75 }
};
// 投影的遮挡体：静态不透明桶（地面类桶靠高度比较自动不产生影子，跳过省时间）
const NO_CAST = new Set(['glass', 'glow', 'band', 'halo', 'shade', 'blob', 'ghost', 'water', 'waterDemo', 'paintHero', 'asphalt', 'grass', 'tactile', 'skyMat']);
const H_STEP = 0.1;   // 高度图 1 级 = 0.1 m（8 位最高 25.5 m，相对烘焙基准高度）
// 会动的 / 内景 Kit 不投日照影子（列车、船、电梯轿厢、选人舞台、各种室内）
const NO_CAST_KIT = /^(train|fzBoat|smLiftCar|charStage|food-int|hotel-|cjc-int|hall-int|emu-|xdfLobby)/;
// 各档位：taps 阴影采样、noise 宏观噪声、dual 水面第二层法线、res 阴影图分辨率、shadow 是否烘焙日照投影、shader 零纹理增强
export const TIER_GFX = [
  { taps: 4, noise: 1, dual: 1, res: 1536, shadow: 1, shader: 1 },
  { taps: 4, noise: 1, dual: 1, res: 1536, shadow: 1, shader: 1 },
  { taps: 1, noise: 0, dual: 0, res: 1024, shadow: 1, shader: 1 },
  { taps: 1, noise: 0, dual: 0, res: 1024, shadow: 0, shader: 0 }
];
const SH_EXT = 200, SH_MOVE = 60, SLICE_MS = 4;

export class Gfx {
  constructor({ engine, scene, R, M }) {
    this.engine = engine; this.scene = scene; this.R = R; this.M = M;
    const P = new URLSearchParams(location.search);
    this.debug = P.has('gfxdebug');
    this.state = { mode: P.get('mode') === 'orig' ? 'orig' : 'up', light: P.get('light') === 'dusk' ? 'dusk' : 'day', f: Object.fromEntries(FEATURES.map(([k]) => [k, true])) };
    for (const [k] of FEATURES) if (P.get('no-' + k) !== null) this.state.f[k] = false;
    this.envCache = {}; this.texLoaded = false; this.tier = 1; this.focus = null;
    this.sh = { cur: null, job: null, spare: null, buf: null, t: 0 };
    this.stats = { fps: 60, min: 60, draws: 0, tris: 0, w: 0, h: 0, bake: null, bakes: 0 };
    this._fpsWin = [];
    this.listeners = [];
    HOOKS.onAttach = m => { if (this._applied) this.applyMat(m); };
    // 绘制调用 / 三角形要在这一帧画完之后读（onBeforeRender 时计数器刚清零）
    scene.onAfterRenderObservable.add(() => { const S = this.stats; S.draws = (engine._drawCalls && engine._drawCalls.current) || 0; S.tris = Math.round(scene.getActiveIndices() / 3); S.w = engine.getRenderWidth(); S.h = engine.getRenderHeight(); });
  }
  on(f) { this.listeners.push(f); }
  get up() { return this.state.mode === 'up'; }
  get T() { return TIER_GFX[this.tier] || TIER_GFX[1]; }
  want(k) { return this.up && !!this.state.f[k]; }
  setMode(m) { this.state.mode = m === 'orig' ? 'orig' : 'up'; this.apply(); }
  setLight(l) { this.state.light = l === 'dusk' ? 'dusk' : 'day'; if (this.state.mode !== 'up') this.state.mode = 'up'; this.apply(); }
  setFeature(k, v) { this.state.f[k] = !!v; this.apply(); }
  /** 画质档位变了（main.js applyQuality）：只改 uniform 级参数，不触发重编译 */
  setTier(t) { this.tier = t; this.applyTierParams(); this.applyMats(); }
  applyTierParams() {
    const T = this.T;
    GS.taps = T.taps; GS.noise = T.noise; GS.water.dual = T.dual;
    GS.shadow = this.want('shadow') && T.shadow ? 1 : 0; GS.shader = this.want('shader') && T.shader ? 1 : 0;
    if (!GS.shadow) this.dropShadow();
  }
  /** 应用当前状态（材质 / 天空 / 环境 / 灯光 / 雾 / 后期 / 水 / 插件 define）；正常游玩只在启动时调一次 */
  apply() {
    const t0 = performance.now(), s = this.state, R = this.R, L = this.up ? LOOKS[s.light] : LOOKS.orig;
    if (this.up) this.loadTex();
    const env = this.want('env');
    R.look = { ...LOOKS.orig, ...(this.up ? { hemiI: L.hemiI, hemiD: L.hemiD, hemiG: L.hemiG, sunI: L.sunI, sunD: L.sunD, sunDir: L.sunDir } : {}), envI: env ? L.envI : LOOKS.orig.envI };
    // 环境贴图：户外的立刻要；站内的按需（第一次进站内时 Render.preloadIndoor 才取）
    R.envOutO = env ? this.envTex(L.env) : null;
    R.envPending = false;
    R.envInUrlO = env ? 'vendor/env/env_indoor.env' : null; R.envInO = env && this.envCache['vendor/env/env_indoor.env'] || null;
    R.envInGet = env ? () => (R.envInO = this.envTex('vendor/env/env_indoor.env')) : null;
    R.setSky(env ? L.sky : 'assets/tex/sky.jpg');
    this.setIP(env ? L.ip : ORIG_IP);
    R.haze = this.want('haze') ? { color: L.fog, start: L.fogStart, end: L.fogEnd } : null;
    R.applyZone(R.indoor, true); R.updateFog();
    R.setNoPost(this.want('aa'));
    const wasOn = GS.on, wasW = GS.water.on, wasLight = this._light;
    GS.on = this.up; this._light = s.light;
    if (this.up) { GS.sunDir.copyFrom(L.sunDir); GS.sunCol.copyFrom(L.leafCol); GS.sky.copyFrom(L.rimCol); GS.shadowK = s.light === 'dusk' ? 0.8 : 0.88; GS.rim = s.light === 'dusk' ? 0.07 : 0.05; GS.leaf = L.leaf ?? 1; }
    GS.water.on = this.want('water');
    this.applyTierParams();
    if (wasLight && wasLight !== s.light) this.dropShadow();
    this.applyMats();
    this.applyWater();
    if (wasOn !== GS.on || wasW !== GS.water.on) markGfxDirty(this.scene);
    if (this._applied) { clearTimeout(this._probeT); this._probeT = setTimeout(() => { try { R.refreshProbes(); } catch (_) {} }, 120); }
    this._applied = true;
    this.stats.applyMs = +(performance.now() - t0).toFixed(1);
    this.listeners.forEach(f => f(this));
  }
  setIP(o) {
    const ip = this.scene.imageProcessingConfiguration, cc = ip.colorCurves || new B.ColorCurves();
    ip.exposure = o.exposure; ip.contrast = o.contrast;
    cc.globalSaturation = o.sat; cc.highlightsHue = o.hiHue; cc.highlightsDensity = o.hiDen; cc.highlightsSaturation = o.hiSat;
    cc.shadowsHue = o.shHue; cc.shadowsDensity = o.shDen; cc.shadowsSaturation = o.shSat; ip.colorCurves = cc;
  }
  envTex(url) {
    if (!this.envCache[url]) { const t = this.envCache[url] = B.CubeTexture.CreateFromPrefilteredData(url, this.scene); t.name = url.split('/').pop(); }
    return this.envCache[url];
  }
  /** 升级贴图只在升级模式加载（?mode=orig 0 额外下载） */
  loadTex() {
    if (this.texLoaded) return; this.texLoaded = true; const s = this.scene;
    this.up_ = {};
    for (const [k, u] of Object.entries(UP)) {
      const size = u.size || (TEX[k] && TEX[k].size) || 1, o = this.up_[k] = {};
      for (const key of ['alb', 'n', 'orm']) if (u[key]) { const t = tex(s, u[key]); t.uScale = t.vScale = 1 / size; o[key] = t; }
      if (o.n) o.n.level = u.nl ?? 0.7;
    }
  }
  /** 水面法线：只有场景里真有升级水面时才下载 */
  loadWater() {
    const W = GS.water, s = this.scene; if (W.n1) return;
    W.n1 = new B.Texture('assets/tex/water_n1.jpg', s, false, true, B.Texture.TRILINEAR_SAMPLINGMODE); W.n2 = new B.Texture('assets/tex/water_n2.jpg', s, false, true, B.Texture.TRILINEAR_SAMPLINGMODE);
    W.n1.anisotropicFilteringLevel = W.n2.anisotropicFilteringLevel = 4;
    let n = 0; const done = () => { if (++n === 2) markGfxDirty(s); };
    W.n1.onLoadObservable.addOnce(done); W.n2.onLoadObservable.addOnce(done);
  }
  normalsOn() { const q = CONFIG.qualityLevels[this.R.tier]; return q ? !!q.normals : true; }
  applyMats() { for (const m of this.scene.materials) if (m._gfx) this.applyMat(m); }
  /** 河 / 海水面（'paint@sea' 桶，福州内河、厦门海边）：升级画质下换成流动水波 + 半哑光（不用漆面贴图；掠射不反白） */
  applySea(m, o) {
    const on = this.want('water');
    if (on) { ensureWater(m); this.loadWater(); }
    m.albedoTexture = on ? null : o.alb; m.bumpTexture = on ? null : (this.normalsOn() ? o.n : null); m._normalTex = on ? null : o.n;
    const i = this.M.normals.indexOf(m); if (on && i >= 0) this.M.normals.splice(i, 1); else if (!on && o.n && i < 0) this.M.normals.push(m);
    m.metallicTexture = null; m.useRoughnessFromMetallicTextureGreen = m.useMetallnessFromMetallicTextureBlue = m.useAmbientOcclusionFromMetallicTextureRed = false;
    m.roughness = on ? 0.4 : o.rough; if (o.env == null) o.env = m.environmentIntensity; m.environmentIntensity = on ? 0.8 : o.env;
    if (o.ho == null) { o.ho = m.useHorizonOcclusion; o.ro = m.useRadianceOcclusion; }
    m.useHorizonOcclusion = on ? false : o.ho; m.useRadianceOcclusion = on ? false : o.ro;
  }
  applyMat(m) {
    const M = this.M, pbr = this.want('pbr'), nOn = this.normalsOn();
    const b = baseOf(m.name), base = M[b];
    if (!m._gfxOrig) m._gfxOrig = base && base !== m && base._gfxOrig ? { ...base._gfxOrig, env: undefined, ho: undefined, ro: undefined } : { alb: m.albedoTexture, n: m._normalTex || null, rough: m.roughness, inN: M.normals.includes(m) };
    const o = m._gfxOrig;
    if (m.name === 'paint@sea') return this.applySea(m, o);
    const u = pbr && this.up_ ? this.up_[b] : null;
    const alb = u && u.alb ? u.alb : o.alb, n = u && u.n ? u.n : o.n;
    if (m.albedoTexture !== alb) m.albedoTexture = alb;
    m._normalTex = n;
    const inN = M.normals.indexOf(m);
    if (n && inN < 0) M.normals.push(m); else if (!n && inN >= 0) M.normals.splice(inN, 1);
    if (n) m.invertNormalMapY = false;
    const bump = nOn ? n : null; if (m.bumpTexture !== bump) m.bumpTexture = bump;
    const orm = u && u.orm ? u.orm : null;
    if (m.metallicTexture !== orm) m.metallicTexture = orm;
    m.useRoughnessFromMetallicTextureGreen = !!orm; m.useMetallnessFromMetallicTextureBlue = !!orm; m.useAmbientOcclusionFromMetallicTextureRed = !!orm;
    m.useRoughnessFromMetallicTextureAlpha = false;
    m.roughness = orm ? 1.0 : o.rough;
    m.useHorizonOcclusion = !!(u && n); m.useRadianceOcclusion = !!u && UP[b].ro !== false;
    if (u && UP[b] && UP[b].env != null) { if (o.env == null) o.env = m.environmentIntensity; m.environmentIntensity = UP[b].env; } else if (o.env != null) m.environmentIntensity = o.env;
  }
  /** 公园前喷泉池的升级水面（station.js 里名为 water 的网格） */
  applyWater(st) {
    st = st || this.station; if (!st || !st.kit) return;
    const on = this.want('water'); let any = false;
    for (const m of st.kit.root.getChildMeshes(false)) if (m.name === 'water') { m.setEnabled(on); any = true; }
    if (on && any) this.loadWater();
  }
  /** 广州新车站建好后调用（材质克隆自升级后的桶材质，已经是升级状态；这里只管水面） */
  onStation(st) { this.station = st; this.applyWater(st); }
  // ———————————————— 日照投影：分帧烘焙 ————————————————
  dropShadow() { const c = this.sh.cur; this.sh.cur = null; this.sh.job = null; GS.shTex = null; if (c && c.tex) { if (this.sh.spare) this.sh.spare.dispose(); this.sh.spare = c.tex; } }
  casterKits() { const out = []; for (const k of KITS) if (k.root.isEnabled() && !NO_CAST_KIT.test(k.root.name)) out.push(k); return out; }
  shadowTick(dt) {
    const R = this.R, S = this.sh;
    GS.shFade = Math.max(0, 1 - R.indoor);
    if (!GS.on || !GS.shadow) return;
    if (S.job) { const dl = performance.now() + SLICE_MS; let r; try { r = S.job.next(dl); } catch (e) { console.warn('gfx shadow bake', e); S.job = null; return; } if (r.done) S.job = null; return; }
    if ((S.t -= dt) > 0) return; S.t = 0.35;
    const f = this.focus && this.focus(); if (!f) return;
    const kits = this.casterKits();
    const sig = kits.map(k => k.root.uniqueId).sort().join('|') + ':' + this.state.light;
    if (S.cur && S.cur.sig !== sig) this.dropShadow();     // 换了场景：旧图对不上，先关掉
    if (!kits.length || R.indoorTarget > 0.5) return;      // 室内 / 隧道：不烘（影子本来也渐隐掉了），出来再烘
    const c = S.cur;
    if (c && Math.abs(f.x - c.cx) < SH_MOVE && Math.abs(f.z - c.cz) < SH_MOVE && Math.abs(f.y - c.fy) < 5) return;
    S.job = this.bakeJob(kits, { x: f.x, y: f.y, z: f.z }, sig, LOOKS[this.state.light].sunDir);
  }
  /**
   * 烘焙「最高遮挡高度」图（生成器，next(deadline) 每次做到 deadline 就让出主线程）：
   * 每个静态三角形沿光线 L 投到基准面（G = P + L · (y − base) / −L.y），覆盖的像素写 max(高度)。片元查表：同一条光线上有比自己高的遮挡点 = 在影子里。
   */
  *bakeJob(kits, f, sig, L) {
    const t0 = performance.now(); let busy = 0, frames = 0, dl = yield;
    const RES = this.T.res, ext = SH_EXT, inv = RES / ext, ox = f.x - ext / 2, oz = f.z - ext / 2, base = Math.floor(f.y - 1);
    const kx = -L.x / L.y, kz = -L.z / L.y, maxH = 255 * H_STEP;
    if (!this.sh.buf || this.sh.buf.length !== RES * RES) this.sh.buf = new Uint8Array(RES * RES); const hm = this.sh.buf; hm.fill(0);
    let tris = 0, px = 0, meshes = 0, n = 0, sliceT = performance.now();
    const check = () => (++n & 15) === 0 && performance.now() > dl;
    const pause = function* () { busy += performance.now() - sliceT; frames++; dl = yield; sliceT = performance.now(); };
    const tmp = new B.Vector3(), mtx = new B.Matrix();
    let X = new Float32Array(4096), Y = new Float32Array(4096), Z = new Float32Array(4096);
    for (const k of kits) {
      if (k.root.isDisposed()) continue;
      for (const m of k.root.getChildMeshes(false)) {
        if (!m.material || m.skeleton || (m.metadata && m.metadata.collider) || !m.isVisible || m.isDisposed()) continue;
        if (NO_CAST.has(baseOf(m.material.name)) || m.material.alpha < 0.5 || m.getTotalVertices() < 3) continue;
        const thin = m.hasThinInstances && m.thinInstanceCount > 0, bb = m.getBoundingInfo().boundingBox, mn = bb.minimumWorld, mx = bb.maximumWorld;
        if (!thin && (mx.y < base + 0.1 || mn.y > base + 60)) continue;
        const sx = kx * (mx.y - base), sz = kz * (mx.y - base);
        if (!thin && (Math.max(mx.x, mx.x + sx) < ox || Math.min(mn.x, mn.x + sx) > ox + ext || Math.max(mx.z, mx.z + sz) < oz || Math.min(mn.z, mn.z + sz) > oz + ext)) continue;
        const P = m.getVerticesData(B.VertexBuffer.PositionKind), I = m.getIndices(); if (!P || !I) continue;
        const nv = P.length / 3; if (X.length < nv) { X = new Float32Array(nv); Y = new Float32Array(nv); Z = new Float32Array(nv); }
        const wm = m.computeWorldMatrix(true);
        const inst = thin ? m.thinInstanceGetWorldMatrices() : [null];
        meshes++;
        for (const im of inst) {
          let W = wm; if (im) { im.multiplyToRef(wm, mtx); W = mtx; }
          const id = W.isIdentity();
          for (let i = 0; i < nv; i++) {
            if (id) tmp.set(P[i * 3], P[i * 3 + 1], P[i * 3 + 2]); else B.Vector3.TransformCoordinatesFromFloatsToRef(P[i * 3], P[i * 3 + 1], P[i * 3 + 2], W, tmp);
            const h = tmp.y - base; Y[i] = h; const hp = Math.max(0, h); X[i] = (tmp.x + kx * hp - ox) * inv; Z[i] = (tmp.z + kz * hp - oz) * inv;
            if ((i & 2047) === 2047 && performance.now() > dl) yield* pause();
          }
          if (performance.now() > dl) yield* pause();
          for (let t = 0; t < I.length; t += 3) {
            if (check()) yield* pause();
            const a = I[t], b = I[t + 1], c = I[t + 2];
            const ya = Y[a], yb = Y[b], yc = Y[c]; if (ya < 0.08 && yb < 0.08 && yc < 0.08) continue;
            if (ya > 60 || yb > 60 || yc > 60) continue;
            const ax = X[a], az = Z[a], bx = X[b], bz = Z[b], qx = X[c], qz = Z[c];
            const area = (bx - ax) * (qz - az) - (qx - ax) * (bz - az); if (Math.abs(area) < 1e-6) continue;
            const minX = Math.max(0, Math.floor(Math.min(ax, bx, qx))), maxX = Math.min(RES - 1, Math.ceil(Math.max(ax, bx, qx)));
            const minZ = Math.max(0, Math.floor(Math.min(az, bz, qz))), maxZ = Math.min(RES - 1, Math.ceil(Math.max(az, bz, qz)));
            if (minX > maxX || minZ > maxZ) continue; tris++;
            const ia = 1 / area, ha = Math.min(maxH, Math.max(0, ya)) / H_STEP, hb = Math.min(maxH, Math.max(0, yb)) / H_STEP, hc = Math.min(maxH, Math.max(0, yc)) / H_STEP;
            // 很细的投影（细杆、薄板侧面）：保守光栅化放宽半个像素，避免路灯杆 / 树干的影子断掉
            const e = Math.abs(area) < 6 ? 0.5 / Math.sqrt(Math.abs(area)) : 0;
            // 每行用三条边的线性方程直接算出覆盖区间，只遍历区间内的像素
            const A0 = -(qz - bz) * ia, A1 = -(az - qz) * ia;
            for (let z = minZ; z <= maxZ; z++) {
              const pz = z + 0.5;
              const C0 = ((bx) * (qz - pz) - (qx) * (bz - pz)) * ia, C1 = ((qx) * (az - pz) - (ax) * (qz - pz)) * ia;
              // w0(x) = C0 + A0·x，w1(x) = C1 + A1·x，w2 = 1 − w0 − w1
              let lo = minX + 0.5, hi = maxX + 0.5;
              const lim = (A, C) => { if (Math.abs(A) < 1e-12) return C >= -e; const r = (-e - C) / A; if (A > 0) { if (r > lo) lo = r; } else if (r < hi) hi = r; return true; };
              if (!lim(A0, C0) || !lim(A1, C1) || !lim(-A0 - A1, 1 - C0 - C1)) continue;
              const xs = Math.max(minX, Math.ceil(lo - 0.5)), xe = Math.min(maxX, Math.floor(hi - 0.5)); if (xs > xe) continue;
              const row = z * RES;
              for (let x = xs; x <= xe; x++) {
                const pxx = x + 0.5; let w0 = C0 + A0 * pxx, w1 = C1 + A1 * pxx;
                w0 = w0 < 0 ? 0 : w0 > 1 ? 1 : w0; w1 = w1 < 0 ? 0 : w1 > 1 - w0 ? 1 - w0 : w1; const w2 = 1 - w0 - w1;
                const h = (w0 * ha + w1 * hb + w2 * hc + 0.5) | 0;
                if (h > hm[row + x]) hm[row + x] = h > 255 ? 255 : h;
              }
              px += xe - xs + 1;
            }
          }
        }
      }
    }
    busy += performance.now() - sliceT;
    // 烘焙期间换了场景（建新站 / 进出内景）：这张图作废，下一轮按新场景重烘
    { const now = this.casterKits().map(k => k.root.uniqueId).sort().join('|') + ':' + this.state.light; if (now !== sig) return; }
    // 上传：WebGL2 用单通道 R8（1536² = 2.3 MB），WebGL1 退回 RGBA
    const r8 = this.engine.webGLVersion >= 2;
    let data = hm; if (!r8) { data = new Uint8Array(RES * RES * 4); for (let i = 0, j = 0; i < hm.length; i++, j += 4) { data[j] = hm[i]; data[j + 3] = 255; } }
    const fmt = r8 ? B.Engine.TEXTUREFORMAT_R : B.Engine.TEXTUREFORMAT_RGBA;
    let tex = this.sh.spare; this.sh.spare = null;
    if (tex && tex.getSize().width === RES && !tex.isDisposed()) tex.update(data);
    else { if (tex) tex.dispose(); tex = new B.RawTexture(data, RES, RES, fmt, this.scene, false, false, B.Texture.BILINEAR_SAMPLINGMODE); tex.wrapU = tex.wrapV = B.Texture.CLAMP_ADDRESSMODE; tex.name = 'gfxSunShadow'; }
    const old = this.sh.cur;
    this.sh.cur = { tex, sig, cx: f.x, cz: f.z, fy: f.y, base, res: RES };
    if (old && old.tex) this.sh.spare = old.tex;
    GS.shTex = tex; GS.shMap = [ox, oz, 1 / ext, 1 / ext]; GS.shTexel = 1 / RES; GS.shBase = base;
    this.stats.bakes++;
    this.stats.bake = { busyMs: +busy.toFixed(1), wallMs: Math.round(performance.now() - t0), frames, tris, px, meshes, res: RES, kits: kits.length, base, at: [Math.round(f.x), Math.round(f.z)] };
  }
  /** 每帧：日照投影烘焙时间片 + 水波滚动 + 性能读数 */
  update() {
    const dt = Math.min(0.1, this.engine.getDeltaTime() / 1000), W = GS.water;
    GS.time += dt;
    this.shadowTick(dt);
    if (W.on) { W.off[0] += 0.021 * dt; W.off[1] += 0.013 * dt; W.off[2] -= 0.016 * dt; W.off[3] += 0.024 * dt; }
    const f = dt > 0 ? 1 / dt : 60, S = this.stats;
    S.fps += (f - S.fps) * 0.08;
    const now = performance.now(); this._fpsWin.push([now, f]); while (this._fpsWin.length && now - this._fpsWin[0][0] > 3000) this._fpsWin.shift();
    S.min = this._fpsWin.reduce((a, [, v]) => Math.min(a, v), 999);
  }
}
