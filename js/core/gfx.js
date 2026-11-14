/*
 * 画质升级 Demo 的总控（原版 ↔ 10× 零开销升级，全部运行时切换、不重载页面）：
 *   shadow  建筑与树冠日照投影：每站烘焙一张「最高遮挡高度」图（L8，1024²），着色器沿光线反投查表（0 次额外绘制）
 *   pbr     漆面微纹理 + 全材质法线 / ORM（R=AO，G=粗糙度，B=金属度=1 → 直接用材质标量）
 *   env     天空同源 HDR 环境球：sky_day / sky_dusk + env_day / env_dusk / env_indoor（.env）+ 灯光 / 调色
 *   shader  着色器零纹理增强（去重复宏观变化、贴地暗边、树叶透光、天空色边缘光）
 *   haze    户外大气薄雾（颜色取天空地平线）
 *   water   流动菲涅耳水波（公园前喷泉池）
 *   aa      锐利原生抗锯齿：去掉后期管线（FXAA + 1× 离屏 RT），由画布原生 MSAA 抗锯齿，色调映射在材质里做
 * 状态：mode 'orig' | 'up'，light 'day' | 'dusk'，f = 各项开关（只在 up 模式下生效）。
 */
import { GS, markGfxDirty, baseOf } from './gfxUpgradePlugin.js';
import { TEX, tex } from './mats.js';
import { CONFIG } from './config.js';
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
    sky: 'assets/tex/sky_day.jpg', env: 'vendor/env/env_day.env', fog: C3(0.70, 0.78, 0.88), fogStart: 110, fogEnd: 380, leafCol: C3(1.0, 0.92, 0.62), rimCol: C3(0.55, 0.68, 0.9),
    ip: { exposure: 1.0, contrast: 1.1, sat: 18, hiHue: 45, hiDen: 6, hiSat: 8, shHue: 215, shDen: 12, shSat: 26 } },
  dusk: { hemiI: [0.5, 0.9], hemiD: [C3(1.0, 0.84, 0.74), C3(1.0, 0.95, 0.88)], hemiG: [C3(0.55, 0.42, 0.32), C3(0.58, 0.58, 0.62)],
    sunI: [3.6, 0.85], sunD: [C3(1.0, 0.70, 0.42), C3(1.0, 0.95, 0.88)], sunDir: V3(-0.78, -0.34, 0.52), envI: [0.6, 0.7],
    sky: 'assets/tex/sky_dusk.jpg', env: 'vendor/env/env_dusk.env', fog: C3(0.92, 0.66, 0.45), fogStart: 90, fogEnd: 360, leafCol: C3(1.0, 0.62, 0.3), rimCol: C3(0.75, 0.55, 0.55),
    ip: { exposure: 1.12, contrast: 1.1, sat: 20, hiHue: 35, hiDen: 20, hiSat: 30, shHue: 210, shDen: 15, shSat: 30 } }
};
const ORIG_IP = { exposure: 1.0, contrast: 1.12, sat: 22, hiHue: 30, hiDen: 0, hiSat: 10, shHue: 220, shDen: 6, shSat: 20 };
// 各桶升级贴图：alb 反照率、n 法线（没有就沿用原法线）、orm 打包贴图、nl 法线强度
const UP = {
  paint: { alb: 'paint_d', n: 'paint_n', orm: 'paint_orm', size: 1.6, nl: 0.3 },
  floor: { orm: 'floor_orm' }, pave: { orm: 'pave_orm' }, tactile: { orm: 'tactile_orm' }, ceiling: { orm: 'ceiling_orm' }, wall: { orm: 'wall_orm' },
  metal: { n: 'steel_n', orm: 'steel_orm', nl: 0.3 }, concrete: { n: 'concrete_n', orm: 'concrete_orm', nl: 0.55 }, brick: { orm: 'brick_orm' }, qz: { orm: 'qingzhuan_orm' },
  granite: { orm: 'granite_orm' }, asphalt: { n: 'asphalt_n', orm: 'asphalt_orm', nl: 0.45 }, grass: { n: 'grass_n', orm: 'grass_orm', nl: 0.55 }, facade: { n: 'facade_n', orm: 'facade_orm', nl: 0.75 }
};
// 投影的遮挡体：静态不透明桶（地面类桶靠高度比较自动不产生影子，跳过省时间）
const NO_CAST = new Set(['glass', 'glow', 'band', 'halo', 'shade', 'blob', 'ghost', 'water', 'waterDemo', 'paintHero', 'asphalt', 'grass', 'tactile', 'skyMat']);
const H_STEP = 0.1;   // 高度图 1 级 = 0.1 m（L8 最高 25.5 m）

export class Gfx {
  constructor({ engine, scene, R, M }) {
    this.engine = engine; this.scene = scene; this.R = R; this.M = M;
    const P = new URLSearchParams(location.search);
    this.state = { mode: P.get('mode') === 'orig' ? 'orig' : 'up', light: P.get('light') === 'dusk' ? 'dusk' : 'day', f: Object.fromEntries(FEATURES.map(([k]) => [k, true])) };
    for (const [k] of FEATURES) if (P.get('no-' + k) !== null) this.state.f[k] = false;
    this.shadowTex = {}; this.station = null; this.envCache = {}; this.skyCache = {}; this.texLoaded = false;
    this.stats = { fps: 60, min: 60, draws: 0, tris: 0, w: 0, h: 0, bakeMs: {} };
    this._fpsWin = []; this._lastApply = 0;
    this.listeners = [];
    // 绘制调用 / 三角形要在这一帧画完之后读（onBeforeRender 时计数器刚清零）
    scene.onAfterRenderObservable.add(() => { const S = this.stats; S.draws = (engine._drawCalls && engine._drawCalls.current) || 0; S.tris = Math.round(scene.getActiveIndices() / 3); S.w = engine.getRenderWidth(); S.h = engine.getRenderHeight(); });
  }
  on(f) { this.listeners.push(f); }
  get up() { return this.state.mode === 'up'; }
  want(k) { return this.up && !!this.state.f[k]; }
  setMode(m) { this.state.mode = m === 'orig' ? 'orig' : 'up'; this.apply(); }
  setLight(l) { this.state.light = l === 'dusk' ? 'dusk' : 'day'; if (this.state.mode !== 'up') this.state.mode = 'up'; this.apply(); }
  setFeature(k, v) { this.state.f[k] = !!v; this.apply(); }
  /** 应用当前状态（材质 / 天空 / 环境 / 灯光 / 雾 / 后期 / 水 / 插件 define） */
  apply() {
    const t0 = performance.now(), s = this.state, R = this.R, L = this.up ? LOOKS[s.light] : LOOKS.orig;
    if (this.up) this.loadTex();
    // 灯光 + 环境 + 天空
    const env = this.want('env');
    R.look = { ...LOOKS.orig, ...(this.up ? { hemiI: L.hemiI, hemiD: L.hemiD, hemiG: L.hemiG, sunI: L.sunI, sunD: L.sunD, sunDir: L.sunDir } : {}), envI: env ? L.envI : LOOKS.orig.envI };
    R.envOutO = env ? this.envTex(L.env) : null;
    R.envInO = env ? this.envTex('vendor/env/env_indoor.env') : null;
    R.setSky(env ? L.sky : 'assets/tex/sky.jpg');
    this.setIP(env ? L.ip : ORIG_IP);
    R.haze = this.want('haze') ? { color: L.fog, start: L.fogStart, end: L.fogEnd } : null;
    R.applyZone(R.indoor, true); R.updateFog();
    // 后期 / 抗锯齿
    R.setNoPost(this.want('aa'));
    // 插件参数
    const wasOn = GS.on, wasW = GS.water.on;
    GS.on = this.up; GS.shadow = this.want('shadow') ? 1 : 0; GS.shader = this.want('shader') ? 1 : 0;
    if (this.up) { GS.sunDir.copyFrom(L.sunDir); GS.sunCol.copyFrom(L.leafCol); GS.sky.copyFrom(L.rimCol); GS.shadowK = s.light === 'dusk' ? 0.8 : 0.88; GS.rim = s.light === 'dusk' ? 0.07 : 0.05; }
    GS.water.on = this.want('water');
    if (GS.shadow) this.ensureShadow();
    GS.shTex = GS.shadow && this.station ? (this.shadowTex[this.station.code + ':' + s.light] || {}).tex || null : null;
    if (GS.shTex) { const e = this.shadowTex[this.station.code + ':' + s.light]; GS.shMap = e.map; GS.shTexel = e.texel; }
    this.applyMats();
    this.applyWater();
    if (wasOn !== GS.on || wasW !== GS.water.on) markGfxDirty(this.scene);
    // 站内反射探针按新材质 / 环境重拍一次（静态，RENDER_ONCE）
    clearTimeout(this._probeT); this._probeT = setTimeout(() => { try { R.refreshProbes(); } catch (_) {} }, 120);
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
  /** 升级贴图只在第一次进升级模式时加载（原版模式 0 额外下载） */
  loadTex() {
    if (this.texLoaded) return; this.texLoaded = true; const s = this.scene;
    this.up_ = {};
    for (const [k, u] of Object.entries(UP)) {
      const size = u.size || (TEX[k] && TEX[k].size) || 1, o = this.up_[k] = {};
      for (const key of ['alb', 'n', 'orm']) if (u[key]) { const t = tex(s, u[key]); t.uScale = t.vScale = 1 / size; o[key] = t; }
      if (o.n) o.n.level = u.nl ?? 0.7;
    }
    const W = GS.water; W.n1 = new B.Texture('assets/tex/water_n1.jpg', s, false, true, B.Texture.TRILINEAR_SAMPLINGMODE); W.n2 = new B.Texture('assets/tex/water_n2.jpg', s, false, true, B.Texture.TRILINEAR_SAMPLINGMODE);
    W.n1.anisotropicFilteringLevel = W.n2.anisotropicFilteringLevel = 4;
    W.n1.onLoadObservable.addOnce(() => markGfxDirty(s)); W.n2.onLoadObservable.addOnce(() => markGfxDirty(s));
  }
  normalsOn() { const q = CONFIG.qualityLevels[this.R.tier]; return q ? !!q.normals : true; }
  applyMats() {
    const M = this.M, pbr = this.want('pbr'), nOn = this.normalsOn();
    for (const m of this.scene.materials) {
      if (!m._gfx) continue;
      const b = baseOf(m.name), base = M[b];
      if (!m._gfxOrig) m._gfxOrig = base && base !== m && base._gfxOrig ? { ...base._gfxOrig } : { alb: m.albedoTexture, n: m._normalTex || null, rough: m.roughness, inN: M.normals.includes(m) };
      const o = m._gfxOrig, u = pbr && this.up_ ? this.up_[b] : null;
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
      m.useHorizonOcclusion = !!(u && n); m.useRadianceOcclusion = !!u;
    }
  }
  applyWater() {
    const st = this.station; if (!st) return;
    const on = this.want('water');
    for (const m of st.kit.root.getChildMeshes(false)) if (m.name === 'water') m.setEnabled(on);
  }
  /** 新车站建好后调用：给新克隆的材质套当前状态、烘焙日照投影 */
  onStation(st) {
    if (this.station && this.station !== st) { for (const k of Object.keys(this.shadowTex)) { this.shadowTex[k].tex && this.shadowTex[k].tex.dispose(); delete this.shadowTex[k]; } }
    this.station = st; GS.shTex = null;
    this.apply();
  }
  ensureShadow() {
    const st = this.station; if (!st) return;
    const key = st.code + ':' + this.state.light; if (this.shadowTex[key]) return;
    this.shadowTex[key] = this.bakeSunShadow(st, LOOKS[this.state.light].sunDir);
  }
  /**
   * 烘焙「最高遮挡高度」图：每个户外静态三角形沿光线 L 投到地面（G = P + L · y / −L.y），
   * 在投影三角形覆盖的每个像素写 max(高度)。片元查表：同一条光线上有比自己高的遮挡点 = 在影子里。
   */
  bakeSunShadow(st, L) {
    const t0 = performance.now(), meshes = [];
    for (const m of st.kit.root.getChildMeshes(false)) {
      if (!m.material || m.skeleton || (m.metadata && m.metadata.collider) || !m.isVisible) continue;
      const nm = m.material.name; if (NO_CAST.has(baseOf(nm)) || m.material.alpha < 0.5) continue;
      if (m.getTotalVertices() < 3) continue; meshes.push(m);
    }
    // 范围：遮挡体的 xz 包围盒 + 投影长度，限制在 260 m 见方内
    let x0 = 1e9, x1 = -1e9, z0 = 1e9, z1 = -1e9; const kx = -L.x / L.y, kz = -L.z / L.y;
    const tmp = new B.Vector3(), data = [];
    for (const m of meshes) {
      const P = m.getVerticesData(B.VertexBuffer.PositionKind), I = m.getIndices(); if (!P || !I) continue;
      const wm = m.computeWorldMatrix(true), id = wm.isIdentity(), n = P.length / 3, X = new Float32Array(n), Y = new Float32Array(n), Z = new Float32Array(n);
      let any = false;
      for (let i = 0; i < n; i++) {
        if (id) tmp.set(P[i * 3], P[i * 3 + 1], P[i * 3 + 2]); else B.Vector3.TransformCoordinatesFromFloatsToRef(P[i * 3], P[i * 3 + 1], P[i * 3 + 2], wm, tmp);
        const y = tmp.y; Y[i] = y; X[i] = tmp.x + kx * Math.max(0, y); Z[i] = tmp.z + kz * Math.max(0, y);
        if (y > 0.05 && y < 40) { any = true; x0 = Math.min(x0, tmp.x, X[i]); x1 = Math.max(x1, tmp.x, X[i]); z0 = Math.min(z0, tmp.z, Z[i]); z1 = Math.max(z1, tmp.z, Z[i]); }
      }
      if (any) data.push({ X, Y, Z, I });
    }
    if (!data.length) return { tex: null };
    const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2, ext = Math.min(260, Math.max(x1 - x0, z1 - z0) + 4);
    const RES = 1024, ox = cx - ext / 2, oz = cz - ext / 2, inv = RES / ext;
    const hm = new Uint8Array(RES * RES); let tris = 0, px = 0;
    for (const { X, Y, Z, I } of data) {
      for (let t = 0; t < I.length; t += 3) {
        const a = I[t], b = I[t + 1], c = I[t + 2];
        const ya = Y[a], yb = Y[b], yc = Y[c]; if (ya < 0.08 && yb < 0.08 && yc < 0.08) continue;
        if (ya > 60 || yb > 60 || yc > 60) continue;
        const ax = (X[a] - ox) * inv, az = (Z[a] - oz) * inv, bx = (X[b] - ox) * inv, bz = (Z[b] - oz) * inv, qx = (X[c] - ox) * inv, qz = (Z[c] - oz) * inv;
        const area = (bx - ax) * (qz - az) - (qx - ax) * (bz - az); if (Math.abs(area) < 1e-6) continue;
        let minX = Math.max(0, Math.floor(Math.min(ax, bx, qx))), maxX = Math.min(RES - 1, Math.ceil(Math.max(ax, bx, qx)));
        let minZ = Math.max(0, Math.floor(Math.min(az, bz, qz))), maxZ = Math.min(RES - 1, Math.ceil(Math.max(az, bz, qz)));
        if (minX > maxX || minZ > maxZ) continue; tris++;
        const ia = 1 / area, ha = Math.max(0, ya) / H_STEP, hb = Math.max(0, yb) / H_STEP, hc = Math.max(0, yc) / H_STEP;
        // 很细的投影（细杆、薄板侧面）：按保守光栅化放宽半个像素，避免路灯杆 / 树干的影子断掉
        const e = Math.abs(area) < 6 ? 0.5 / Math.sqrt(Math.abs(area)) : 0;
        for (let z = minZ; z <= maxZ; z++) {
          const pz = z + 0.5;
          for (let x = minX; x <= maxX; x++) {
            const pxx = x + 0.5;
            let w0 = ((bx - pxx) * (qz - pz) - (qx - pxx) * (bz - pz)) * ia, w1 = ((qx - pxx) * (az - pz) - (ax - pxx) * (qz - pz)) * ia, w2 = 1 - w0 - w1;
            if (w0 < -e || w1 < -e || w2 < -e) continue;
            w0 = Math.max(0, w0); w1 = Math.max(0, w1); w2 = Math.max(0, 1 - w0 - w1);
            const h = Math.min(255, Math.round(w0 * ha + w1 * hb + w2 * hc)), k = z * RES + x;
            if (h > hm[k]) hm[k] = h; px++;
          }
        }
      }
    }
    // RGBA8（只用 R）：L8 / R8 在部分 WebGL 实现里不能被 readPixels 校验，RGBA 最稳（1024² × 4 B = 4 MB 显存）
    const rgba = new Uint8Array(RES * RES * 4); for (let i = 0, j = 0; i < hm.length; i++, j += 4) { rgba[j] = hm[i]; rgba[j + 3] = 255; }
    const tex = new B.RawTexture(rgba, RES, RES, B.Engine.TEXTUREFORMAT_RGBA, this.scene, false, false, B.Texture.BILINEAR_SAMPLINGMODE);
    tex.wrapU = tex.wrapV = B.Texture.CLAMP_ADDRESSMODE; tex.name = 'gfxSunShadow';
    const ms = +(performance.now() - t0).toFixed(1);
    this.stats.bakeMs[st.code + ':' + this.state.light] = ms;
    return { tex, map: [ox, oz, 1 / ext, 1 / ext], texel: 1 / RES, ms, tris, px, ext: +ext.toFixed(1), meshes: meshes.length };
  }
  /** 每帧：水波滚动 + 性能读数 */
  update() {
    const dt = Math.min(0.1, this.engine.getDeltaTime() / 1000), W = GS.water;
    GS.time += dt;
    if (W.on) { W.off[0] += 0.021 * dt; W.off[1] += 0.013 * dt; W.off[2] -= 0.016 * dt; W.off[3] += 0.024 * dt; }
    const f = dt > 0 ? 1 / dt : 60, S = this.stats;
    S.fps += (f - S.fps) * 0.08;
    const now = performance.now(); this._fpsWin.push([now, f]); while (this._fpsWin.length && now - this._fpsWin[0][0] > 3000) this._fpsWin.shift();
    S.min = this._fpsWin.reduce((a, [, v]) => Math.min(a, v), 999);
  }
}
