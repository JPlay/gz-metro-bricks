/*
 * 3C 福州内河夜景（PLAN-3 §4 / §8）：FzRiverStreet 进河网时按设备本地时间（19:00–06:00）或 ?t=night 打开，离开 / 回白天原样还原。
 *   ① 灯光：Render.setNight（天光压暗偏蓝 + 很弱的冷白蓝月光；没有点光源 / 聚光灯；阴影关）+ 夜空贴图 + clearColor
 *   ② 夜雾：两个网都用 70 → 240 m、雾色 = 地平线色；夜里远处的组更早整组关掉（fzRiver.js lodNow 用 NIGHT.lod）
 *   ③ 发光件：共用 glow 材质（路灯灯罩等）调成暖色；水面 paint@sea 加一点深蓝绿自发光（不是黑）
 *   ④ 图集：白天贴图拷一份 → 非标牌区域乘暗偏蓝、约 30% 的窗亮暖光（只换贴图，0 次绘制）；标牌区域基本保持亮度
 *   ⑤ 夜灯网格（一个网格 = 1 次绘制，加色、不写深度）：路灯小光晕 + 地面暖光圈 + 水面同色短倒影条；桥栏外侧暖光带 + 水面倒影；
 *      码头浮台外沿 / 台阶踏步边沿的暗暖光线（台阶 / 码头边夜里可读）；南后街红灯笼光晕；出口亭门口地面光圈
 *   ⑥ 船：篷檐暖光带并进船自己的漆面网格（夜里换一份带自发光贴图的材质，不加绘制），见 js/game/fzBoat.js setNight
 * 白天：这里的东西一律不建、不改（白天 draws / 三角面 / 像素和 cc71056 一致）。
 */
import { NIGHT, windowLit } from '../game/night.js';
import { Haze, RIVER_HAZE } from '../game/haze.js';
import { Render } from '../core/render.js';
import { bucketMat } from './kit.js';
import { FZR, RIVERS, BRIDGES, PIERS, KIOSKS, isWater, levelAt, deckAt, humpRise } from '../data/fz-river.js';
const B = window.BABYLON;
const yawOf = (fx, fz) => Math.atan2(fx, fz);
const hex3 = s => [1, 3, 5].map(i => parseInt(s.slice(i, i + 2), 16) / 255);
const WARM = hex3(NIGHT.warm), LANTERN = hex3('#FF8A4A');
const sc = (c, k) => [c[0] * k, c[1] * k, c[2] * k];
// 加色贴图的四个区域（u 方向各 1/4）：光晕（径向）/ 地面光圈（更软的径向）/ 倒影条（沿 v 从亮到暗、横向高斯、带碎波纹）/ 光带（横向高斯，沿 u 常亮）
const RG = { halo: 0, pool: 1, streak: 2, line: 3 };
// 共用 glow 材质在 mats.js 里 freeze 了（冻住的材质改颜色不会重新上传 uniform）：先解冻、改、再冻回去
const thawed = (m, f) => { const fr = !!m.isFrozen && typeof m.unfreeze === 'function'; if (fr) m.unfreeze(); f(m); if (fr) m.freeze(); };

export class FzNight {
  constructor(S) { this.S = S; this.on = false; this.mesh = null; this.atlasTex = null; this.saved = null; }
  /** on = true 夜 / false 白天（还原）。重复调用无副作用 */
  set(on, leaving = false) {
    on = !!on; if (on === this.on) return; this.on = on; this._ck = null;
    const S = this.S, s = S.scene, M = S.kit.M;
    if (on) {
      const water = bucketMat(s, M, 'paint@sea');
      this.saved = { glow: M.glow.emissiveColor.clone(), water: water.emissiveColor.clone(), waterEnv: water.environmentIntensity, atlas: S.atlas.mat ? S.atlas.mat.emissiveTexture : null,
        tint: this.tintMats().map(t => [t, t.albedoColor.clone()]) };
      if (Render.active) Render.active.setNight(NIGHT.render);
      if (S.haze) S.haze.restore();
      S.haze = new Haze(s, s.activeCamera, NIGHT.haze); S.haze.apply();
      thawed(M.glow, g => { g.emissiveColor = new B.Color3(...NIGHT.glow); });
      // 纯顶点色材质（paint / paint@wall / paint@sea …，没有反照率贴图）夜里按 NIGHT.tint 乘暗偏蓝：顶点色按线性值直接进 PBR，白天调得很亮（白墙 #F3F1EA ≈ 1.0、水 #2F6670），
      // 只压灯光时它们和带 sRGB 贴图的石板 / 铺装（白天就暗一档）差得越来越明显 → 夜里白墙 / 地坪几乎纯白、水面亮青（小美 night2 意见 ①②）。带贴图的材质不动
      for (const [t] of this.saved.tint) { const k = this.tintOf(t); t.albedoColor = new B.Color3(k[0], k[1], k[2]); }
      water.emissiveColor = new B.Color3(...NIGHT.water); if (water.environmentIntensity !== undefined) water.environmentIntensity = NIGHT.waterEnv;
      if (S.atlas.mat) S.atlas.mat.emissiveTexture = this.nightAtlas();
      this.lights().setEnabled(true);
    } else {
      const v = this.saved, water = bucketMat(s, M, 'paint@sea');
      if (Render.active) Render.active.setNight(null);
      if (S.haze) S.haze.restore();
      // 回白天：换回 1B 的白天水汽（没有就不开雾）；离开河网（leaving）时 fzRiver.dispose 已经把雾还原到进河网之前，不再开
      S.haze = !leaving && RIVER_HAZE[S.net] ? new Haze(s, s.activeCamera, RIVER_HAZE[S.net]) : null; if (S.haze) S.haze.apply();
      if (v) { thawed(M.glow, g => { g.emissiveColor = v.glow; }); for (const [t, c] of v.tint || []) t.albedoColor = c; water.emissiveColor = v.water; if (v.waterEnv !== undefined) water.environmentIntensity = v.waterEnv; if (S.atlas.mat && v.atlas) S.atlas.mat.emissiveTexture = v.atlas; }
      if (this.mesh) this.mesh.setEnabled(false);
      this.saved = null;
    }
    if (S.boats) for (const b of Object.values(S.boats)) b.setNight(on);
    S.nightLod = on; if (!leaving) S.lodNow(true);
  }
  /** 离开河网：先还原白天，再释放夜里建的贴图 / 网格 / 材质 */
  dispose() {
    this.set(false, true);
    if (this.mesh) { const m = this.mesh; if (m.material) { if (m.material.emissiveTexture) m.material.emissiveTexture.dispose(); m.material.dispose(); } m.dispose(); this.mesh = null; }
    if (this.atlasTex) { this.atlasTex.dispose(); this.atlasTex = null; }
  }
  /** 夜里要乘暗的材质：河网街区网格用到的、没有反照率贴图的不透明 PBR（paint 及其 paint@* 克隆等），外加共用 paint / paint@sea（船 / 人物也用 paint） */
  tintMats() {
    const S = this.S, M = S.kit.M, set = new Set([M.paint, bucketMat(S.scene, M, 'paint@sea')]);
    for (const m of S.kit.meshes || []) if (m.material) set.add(m.material);
    return [...set].filter(t => t && t.albedoColor && !t.albedoTexture && !(t.alpha < 1) && !t.unlit);
  }
  tintOf(t) { const T = NIGHT.tint; return T[t.name] || T.paint; }
  /* ---------- ④ 夜里的图集贴图 ---------- */
  nightAtlas() {
    if (this.atlasTex) return this.atlasTex;
    const A = this.S.atlas, N = A.S, src = A.tex.getContext().canvas, regs = this.S.atlasRegs || [];
    const t = this.atlasTex = new B.DynamicTexture('fzNightSigns', { width: N, height: N }, this.S.scene, true);
    t.hasAlpha = false; t.anisotropicFilteringLevel = 8; t.level = A.tex.level;
    const c = t.getContext(); c.drawImage(src, 0, 0);
    const rect = uv => { const x0 = Math.floor(uv.u0 * N - 0.5), x1 = Math.ceil(uv.u1 * N + 0.5), y0 = Math.floor((1 - uv.v1) * N - 0.5), y1 = Math.ceil((1 - uv.v0) * N + 0.5); return [x0, y0, x1 - x0, y1 - y0]; };
    // 按区域乘色：景物（立面 / 店面）压暗偏蓝；标牌只轻微压暗（夜里出口牌 / 码头牌 / 河名牌 / 桥名牌照样读得清）
    c.save(); c.globalCompositeOperation = 'multiply';
    regs.forEach(r => { const [x, y, w, h] = rect(r.uv); c.fillStyle = r.tag === 'scene' ? NIGHT.atlas.scene : NIGHT.atlas.sign; c.fillRect(x, y, w, h); });
    c.restore();
    // 窗：约 30% 亮暖光（同一块立面贴图被多栋楼共用，亮窗图案也跟着共用）
    regs.forEach((r, ri) => {
      if (r.tag !== 'scene' || !r.win) return; const [x, y, w, h] = rect(r.uv);
      r.win.forEach((q, wi) => {
        if (!windowLit(ri, wi)) return;
        const wx = x + q[0] * w, wy = y + q[1] * h, ww = q[2] * w, wh = q[3] * h, g = c.createLinearGradient(0, wy, 0, wy + wh);
        g.addColorStop(0, '#FFD39A'); g.addColorStop(1, '#F0A860'); c.fillStyle = g; c.fillRect(wx, wy, ww, wh);
        if (r.grid) { c.strokeStyle = 'rgba(90,50,25,0.55)'; c.lineWidth = Math.max(1, ww * 0.04); for (let i = 1; i < r.grid; i++) { c.beginPath(); c.moveTo(wx + ww * i / r.grid, wy); c.lineTo(wx + ww * i / r.grid, wy + wh); c.stroke(); } }
      });
    });
    t.update(true);
    return t;
  }
  /** 夜灯按距离裁：只画离人 NIGHT.lightR 以内的灯片（一个网格，换索引，不加 draw）。lodNow 夜里调；人挪过 16 m 才重算 */
  cull(p) {
    if (!this.mesh || !this._qc) return;
    const k = Math.round(p.x / 16) + ',' + Math.round(p.z / 16); if (k === this._ck) return; this._ck = k;
    const Q = this._qc, A = this._I, R = NIGHT.lightR, out = [];
    for (let q = 0, n = Q.length / 3; q < n; q++) if (Math.hypot(Q[3 * q] - p.x, Q[3 * q + 1] - p.z) - Q[3 * q + 2] < R) for (let j = 0; j < 6; j++) out.push(A[6 * q + j]);
    this.mesh.setIndices(out, this.mesh.getTotalVertices(), false); this.counts.drawn = out.length / 3;
  }
  /* ---------- ⑤ 夜灯网格 ---------- */
  lights() {
    if (this.mesh) return this.mesh;
    const S = this.S, P = [], Cl = [], U = [], I = [], QC = [];
    const quad = (cx, cy, cz, u, v, rg, col) => {   // u / v = 半边向量；贴图 v=1 在 +v 那头
      const b = P.length / 3, u0 = rg * 0.25 + 0.004, u1 = rg * 0.25 + 0.246;
      for (const [a, e] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) { P.push(cx + u[0] * a + v[0] * e, cy + u[1] * a + v[1] * e, cz + u[2] * a + v[2] * e); Cl.push(col[0], col[1], col[2], 1); }
      U.push(u0, 0.02, u1, 0.02, u1, 0.98, u0, 0.98); I.push(b, b + 1, b + 2, b, b + 2, b + 3); QC.push(cx, cz, Math.hypot(u[0], u[2]) + Math.hypot(v[0], v[2]));
    };
    const flat = (cx, cy, cz, ax, az, hu, hv, rg, col) => quad(cx, cy, cz, [az * hu, 0, -ax * hu], [ax * hv, 0, az * hv], rg, col);   // 水平：v 沿 (ax, az)
    const halo = (x, y, z, r, col) => { quad(x, y, z, [r, 0, 0], [0, r, 0], RG.halo, col); quad(x, y, z, [0, 0, r], [0, r, 0], RG.halo, col); };
    const n = { lamp: 0, bridge: 0, stair: 0, pier: 0, lantern: 0 };
    // 路灯（和 fzRiver.js promenade 同一套位置 / 过滤）
    for (const [, r] of Object.entries(RIVERS)) for (const side of [-1, 1]) for (let s = 20; s < r.line.len - 10; s += 34) {
      const a = r.line.at(s, side * (r.hw + 5.2)); if (isWater(a.x, a.z) || BRIDGES.some(b => Math.hypot(b.x - a.x, b.z - a.z) < b.w / 2 + b.half)) continue;
      if (FZR.d2 && Math.hypot(a.x - FZR.d2.zzf.sign[0], a.z - FZR.d2.zzf.sign[1]) < 4.5) continue;
      const fx = -a.nx * side, fz = -a.nz * side, f = yawOf(fx, fz), dx = Math.sin(f), dz = Math.cos(f), hx = a.x + dx * 1.75, hz = a.z + dz * 1.75;
      halo(hx, 6.95, hz, 0.9, sc(WARM, 0.7));
      flat(hx - dx * 0.4, 0.045, hz - dz * 0.4, dx, dz, 3.8, 3.8, RG.pool, sc(WARM, 0.42));
      const L = Math.min(7.5, r.hw * 0.95), p0 = r.line.at(s, side * (r.hw - 0.9)), p1 = r.line.at(s, side * (r.hw - 0.9 - L));   // 3C 返工：离岸墙 0.9 m 起（贴墙那段从岸上 / 桥上被岸墙挡住），宽 0.8 m
      if (isWater(p0.x, p0.z) && isWater(p1.x, p1.z)) { const lv = levelAt(p0.x, p0.z), ax = (p0.x - p1.x) / L, az = (p0.z - p1.z) / L; flat((p0.x + p1.x) / 2, lv + 0.02, (p0.z + p1.z) / 2, ax, az, 0.8, L / 2, RG.streak, sc(WARM, 0.85)); }
      n.lamp++;
    }
    // 桥：栏板外侧一道暖光带（跟着拱桥桥面起伏）+ 水面上同色的淡倒影
    for (const b of BRIDGES) {
      if (b.kind === 'bingde' || b.kind === 'covered') continue;
      const rise = humpRise(b), flatB = !rise && b.kind !== 'sarch', uo = flatB ? b.w / 2 : b.w / 2 - 0.03, t = b.t, nn = b.n;
      const top = v => flatB ? 1.0 : deckAt(b, v) + 0.84, Pt = (u, v) => [b.x + t[0] * u + nn[0] * v, b.z + t[1] * u + nn[1] * v];
      const seg = flatB ? 1 : 10, v0 = -b.half + 0.25, v1 = b.half - 0.25;
      for (const su of [-1, 1]) {
        for (let i = 0; i < seg; i++) {
          const va = v0 + (v1 - v0) * i / seg, vb = v0 + (v1 - v0) * (i + 1) / seg, [xa, za] = Pt(su * (uo + 0.025), va), [xb, zb] = Pt(su * (uo + 0.025), vb), ya = top(va) - 0.07, yb = top(vb) - 0.07;
          quad((xa + xb) / 2, (ya + yb) / 2, (za + zb) / 2, [(xb - xa) / 2, (yb - ya) / 2, (zb - za) / 2], [0, 0.075, 0], RG.line, sc(WARM, 0.95));
        }
        const hw = Math.max(0, (b.hw || 0) - 0.6), [cx, cz] = Pt(su * (uo + 1.0), 0);
        if (hw > 1 && isWater(cx, cz)) flat(cx, levelAt(cx, cz) + 0.02, cz, t[0], t[1], hw, 1.1, RG.line, sc(WARM, 0.34));   // 贴图 v（高斯那一向）= t：离桥越远越淡；沿 n 铺满水面宽
      }
      n.bridge++;
    }
    // 台阶：每级踏步边沿一道暗暖光线（stairAlong 建的时候登记）
    for (const st of (S._stairs ? S._stairs.values() : [])) {
      const { F, a0, a1, b0, b1, y0, y1, steps } = st, ta = [F.P(1, 0)[0] - F.P(0, 0)[0], F.P(1, 0)[1] - F.P(0, 0)[1]];
      for (let i = 0; i < steps; i++) {
        const ab = a0 + (a1 - a0) * (i + 1) / steps, yy = y0 + (y1 - y0) * (i + 0.5) / steps, [x, z] = F.P(ab - Math.sign(a1 - a0) * 0.05, (b0 + b1) / 2);
        flat(x, yy + 0.012, z, ta[0], ta[1], Math.abs(b1 - b0) / 2 - 0.06, 0.045, RG.line, sc(WARM, 0.5));
      }
      n.stair++;
    }
    // 码头：浮台外沿 + 浮台面靠水一侧一道暖光线；码头牌前地面暖光圈
    for (const p of PIERS) {
      if (p.shared) continue;
      const top = levelAt(p.berth[0], p.berth[1]) + 0.45, F = S.pierFrame(p), ta = [p.t[0], p.t[1]];
      { const [x, z] = F.P(2.4, 2.69); quad(x, top - 0.1, z, [ta[0] * 6, 0, ta[1] * 6], [0, 0.05, 0], RG.line, sc(WARM, 0.6)); }
      { const [x, z] = F.P(2.4, 2.5); flat(x, top + 0.006, z, -p.n[0], -p.n[1], 5.9, 0.08, RG.line, sc(WARM, 0.45)); }
      if (p.sign) { const [x, z] = p.sign; flat(x - p.n[0] * 1.3, 0.045, z - p.n[1] * 1.3, 1, 0, 1.9, 1.9, RG.pool, sc(WARM, 0.28)); }
      n.pier++;
    }
    // 南后街红灯笼（fzAttr sanfang：z 26..182 每 13 m 一户，两侧，每户两盏；嵌进来时转 180°：W = (X0 − x, Z0 − z)）
    if (FZR.d2) { const N0 = FZR.d2.nhj; for (let z = 26; z < 182; z += 13) for (const side of [-1, 1]) for (const dz of [-4, 4]) { halo(N0.X0 - (side * 7 - side * 1.5), 2.85, N0.Z0 - (z + 6.5 + dz), 0.95, sc(LANTERN, 0.6)); n.lantern++; } }
    // 出口亭门口（亭口朝 +z）
    for (const K of Object.values(KIOSKS)) flat(K.x, 0.075, K.z + 1.8, 1, 0, 2.4, 2.0, RG.pool, sc(WARM, 0.24));
    // 网格
    const m = this.mesh = new B.Mesh('fzNightLights', S.scene), vd = new B.VertexData(), nrm = [];
    for (let i = 0; i < P.length; i += 3) nrm.push(0, 1, 0);
    vd.positions = P; vd.colors = Cl; vd.uvs = U; vd.indices = I; vd.normals = nrm; vd.applyToMesh(m, false);
    const mat = new B.StandardMaterial('fzNightLightsMat', S.scene);
    mat.diffuseColor = new B.Color3(0, 0, 0); mat.specularColor = new B.Color3(0, 0, 0); mat.emissiveColor = new B.Color3(0, 0, 0); mat.disableLighting = true;
    mat.emissiveTexture = lightTex(S.scene); mat.alphaMode = B.Engine.ALPHA_ADD; mat.alpha = 0.999; mat.backFaceCulling = false; mat.disableDepthWrite = true; mat.zOffset = -2; mat.fogEnabled = false;
    m.material = mat; m.parent = S.kit.root; m.isPickable = false; m.hasVertexAlpha = false; m.alphaIndex = 30; m.applyFog = false;
    m.computeWorldMatrix(true); m.freezeWorldMatrix(); m.doNotSyncBoundingInfo = true;
    this.counts = { ...n, tris: I.length / 3 }; this._I = I; this._qc = QC; this._ck = null;
    return m;
  }
}
/** 加色贴图：256×64，四个区域（见 RG） */
function lightTex(scene) {
  const W = 256, H = 64, t = new B.DynamicTexture('fzNightLightTex', { width: W, height: H }, scene, true), c = t.getContext();
  t.hasAlpha = false; t.wrapU = t.wrapV = B.Texture.CLAMP_ADDRESSMODE;
  const img = c.createImageData(W, H), d = img.data;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const rg = Math.floor(x / 64), u = (x % 64 + 0.5) / 64 * 2 - 1, v = 1 - (y + 0.5) / H * 2, vv = 1 - (y + 0.5) / H;   // u,v ∈ −1..1；vv：贴图 v（0 底 → 1 顶）
    let k = 0;
    if (rg === 0) { const r = Math.hypot(u, v); k = r >= 1 ? 0 : Math.pow(1 - r, 2.4) * 0.85 + (r < 0.18 ? (0.18 - r) / 0.18 * 0.5 : 0); }
    else if (rg === 1) { const r = Math.hypot(u, v); k = r >= 1 ? 0 : Math.pow(1 - r * r, 2) * 0.9; }
    else if (rg === 2) { const g = Math.exp(-u * u * 6) * (1 - Math.abs(u)), ripple = 0.65 + 0.35 * Math.sin(vv * 40) * Math.sin(vv * 13 + 1.3); k = g * Math.pow(vv, 1.4) * ripple; }
    else { k = Math.exp(-v * v * 5) * (1 - v * v) * (Math.abs(u) > 0.94 ? (1 - Math.abs(u)) / 0.06 : 1); }
    const q = Math.max(0, Math.min(255, Math.round(k * 255))), o = (y * W + x) * 4; d[o] = d[o + 1] = d[o + 2] = q; d[o + 3] = 255;
  }
  c.putImageData(img, 0, 0); t.update(true);
  return t;
}
