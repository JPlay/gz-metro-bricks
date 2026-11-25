/*
 * 3C 福州内河夜景（PLAN-3 §4 / §8）：FzRiverStreet 进河网时按设备本地时间（19:00–06:00）或 ?t=night 打开，离开 / 回白天原样还原。
 *   ① 灯光：Render.setNight（天光压暗偏蓝 + 很弱的冷白蓝月光；没有点光源 / 聚光灯；阴影关）+ 夜空贴图 + clearColor
 *   ② 夜雾：两个网都用 60 → 220 m、雾色 = 地平线色；夜里远处的组更早整组关掉（fzRiver.js lodNow 用 NIGHT.lod）
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
const WYn = -3;   // 河面高（fz-river WY）
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
      this.saved = { glow: M.glow.emissiveColor.clone(), water: water.emissiveColor.clone(), waterEnv: water.environmentIntensity, waterDirect: water.directIntensity, atlas: S.atlas.mat ? S.atlas.mat.emissiveTexture : null,
        tint: this.tintMats().map(t => [t, t.albedoColor.clone()]) };
      if (Render.active) Render.active.setNight(NIGHT.render);
      if (S.haze) S.haze.restore();
      S.haze = new Haze(s, s.activeCamera, NIGHT.haze); S.haze.apply();
      thawed(M.glow, g => { g.emissiveColor = new B.Color3(...NIGHT.glow); });
      // 纯顶点色材质（paint / paint@wall / paint@sea …，没有反照率贴图）夜里按 NIGHT.tint 乘暗偏蓝：顶点色按线性值直接进 PBR，白天调得很亮（白墙 #F3F1EA ≈ 1.0、水 #2F6670），
      // 只压灯光时它们和带 sRGB 贴图的石板 / 铺装（白天就暗一档）差得越来越明显 → 夜里白墙 / 地坪几乎纯白、水面亮青（小美 night2 意见 ①②）。带贴图的材质不动
      for (const [t] of this.saved.tint) { const k = this.tintOf(t); t.albedoColor = new B.Color3(k[0], k[1], k[2]); }
      water.emissiveColor = new B.Color3(...NIGHT.water); if (water.environmentIntensity !== undefined) water.environmentIntensity = NIGHT.waterEnv; if (water.directIntensity !== undefined) water.directIntensity = NIGHT.waterDirect;   // 低月光在水面上的高光也压一压（水比岸上铺装暗一档）
      if (S.atlas.mat) S.atlas.mat.emissiveTexture = this.nightAtlas();
      this.lights().setEnabled(true);
    } else {
      const v = this.saved, water = bucketMat(s, M, 'paint@sea');
      if (Render.active) Render.active.setNight(null);
      if (S.haze) S.haze.restore();
      // 回白天：换回 1B 的白天水汽（没有就不开雾）；离开河网（leaving）时 fzRiver.dispose 已经把雾还原到进河网之前，不再开
      S.haze = !leaving && RIVER_HAZE[S.net] ? new Haze(s, s.activeCamera, RIVER_HAZE[S.net]) : null; if (S.haze) S.haze.apply();
      if (v) { thawed(M.glow, g => { g.emissiveColor = v.glow; }); for (const [t, c] of v.tint || []) t.albedoColor = c; water.emissiveColor = v.water; if (v.waterEnv !== undefined) water.environmentIntensity = v.waterEnv; if (v.waterDirect !== undefined) water.directIntensity = v.waterDirect; if (S.atlas.mat && v.atlas) S.atlas.mat.emissiveTexture = v.atlas; }
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
    const LP = [];   // 灯头水平位置：8A 取景机位的倒影要用
    // 路灯（和 fzRiver.js promenade 同一套位置 / 过滤）
    for (const [, r] of Object.entries(RIVERS)) for (const side of [-1, 1]) for (let s = 20; s < r.line.len - 10; s += 34) {
      const a = r.line.at(s, side * (r.hw + 5.2)); if (isWater(a.x, a.z) || BRIDGES.some(b => Math.hypot(b.x - a.x, b.z - a.z) < b.w / 2 + b.half)) continue;
      if (FZR.d2 && Math.hypot(a.x - FZR.d2.zzf.sign[0], a.z - FZR.d2.zzf.sign[1]) < 4.5) continue;
      const fx = -a.nx * side, fz = -a.nz * side, f = yawOf(fx, fz), dx = Math.sin(f), dz = Math.cos(f), hx = a.x + dx * 1.75, hz = a.z + dz * 1.75;
      halo(hx, 6.95, hz, 0.9, sc(WARM, 0.7)); LP.push([hx, hz, 6.95]);
      flat(hx - dx * 0.4, 0.045, hz - dz * 0.4, dx, dz, 3.8, 3.8, RG.pool, sc(WARM, 0.42));
      const Z = FZR.a5 && FZR.a5.zone, p0 = r.line.at(s, side * (r.hw - 0.9));
      const yzStreak = r.id === 'yz' || (Z && p0.x > Z[0] && p0.x < Z[2] && p0.z > Z[1] && p0.z < Z[3]);
      const yx7bStreak = r.id === 'yx' && s > ((FZR.a7a && FZR.a7a.yxLen7a) || 0);   // 7B 河段：倒影也要细、暗、断开，不要实心亮橙条
      const hqStreak = r === RIVERS.hq;
      const L = Math.min((yzStreak || yx7bStreak) ? 3.4 : 7.5, r.hw * 0.95), p1 = r.line.at(s, side * (r.hw - 0.9 - L));   // 3C 返工：离岸墙 0.9 m 起（贴墙那段从岸上 / 桥上被岸墙挡住），宽 0.8 m
      if (isWater(p0.x, p0.z) && isWater(p1.x, p1.z)) {
        if (hqStreak) {   // 6A：倒影仍分段断开（不是一根原木）；加厚略提亮（参照 4A 058067c 檐带），从河面上看得见
          const lv = levelAt(p0.x, p0.z), ax = (p0.x - p1.x) / L, az = (p0.z - p1.z) / L;
          const nSeg = 5, span = L * 0.92, gap = 0.45, segL = (span - (nSeg - 1) * gap) / nSeg, mx = (p0.x + p1.x) / 2, mz = (p0.z + p1.z) / 2;
          for (let k = 0; k < nSeg; k++) { const d = -span / 2 + k * (segL + gap) + segL / 2; flat(mx + ax * d, lv + 0.025, mz + az * d, ax, az, 0.62, segL / 2, RG.streak, sc(WARM, 0.48)); }
        } else if (yzStreak || yx7bStreak) {   // 5 / 7B 河段：沿驳岸的倒影改细、改暗、分成短段，避免夜图像一根原木
          const nSeg = 3, gap = 0.7, segL = (L - (nSeg - 1) * gap) / nSeg;
          for (let k = 0; k < nSeg; k++) {
            const a = k * (segL + gap), b = a + segL, qa = r.line.at(s, side * (r.hw - 0.9 - a)), qb = r.line.at(s, side * (r.hw - 0.9 - b));
            if (!isWater(qa.x, qa.z) || !isWater(qb.x, qb.z)) continue;
            const ll = Math.hypot(qa.x - qb.x, qa.z - qb.z) || 1;
            flat((qa.x + qb.x) / 2, levelAt(qa.x, qa.z) + 0.02, (qa.z + qb.z) / 2, (qa.x - qb.x) / ll, (qa.z - qb.z) / ll, 0.18, ll / 2, RG.streak, sc(WARM, 0.18));
          }
        } else { const lv = levelAt(p0.x, p0.z), ax = (p0.x - p1.x) / L, az = (p0.z - p1.z) / L; flat((p0.x + p1.x) / 2, lv + 0.02, (p0.z + p1.z) / 2, ax, az, 0.8, L / 2, RG.streak, sc(WARM, 0.85)); }
      }
      n.lamp++;
    }
    // 3B：琴亭湖步道路灯（和 fzRiver.js lakeLamps 同一套位置）：灯头光晕 + 地面光圈 + 湖面一条短倒影
    for (const [x, z, fx, fz] of (FZR.b3 && FZR.b3.lamps) || []) {
      const hx = x + fx * 1.75, hz = z + fz * 1.75; halo(hx, 6.95, hz, 0.9, sc(WARM, 0.7)); LP.push([hx, hz, 6.95]); flat(hx - fx * 0.4, 0.045, hz - fz * 0.4, fx, fz, 3.8, 3.8, RG.pool, sc(WARM, 0.42));
      const L = 7.5, p0 = [x + fx * 6.1, z + fz * 6.1], p1 = [p0[0] + fx * L, p0[1] + fz * L];
      if (isWater(p0[0], p0[1]) && isWater(p1[0], p1[1])) flat((p0[0] + p1[0]) / 2, levelAt(p0[0], p0[1]) + 0.02, (p0[1] + p1[1]) / 2, -fx, -fz, 0.8, L / 2, RG.streak, sc(WARM, 0.85));
      n.lamp++;
    }
    // 7B：涧田湖步道路灯并进 fzNightLights。切向旋 90° 指向湖心（数据 tx,tz 是沿环切向），沿法向探到水面再铺短倒影：细、暗、断开，不要一根亮橙条
    for (const Lmp of (FZR.a7b && FZR.a7b.lamps) || []) {
      const [x, z] = Lmp, c = (FZR.a7b.lake && FZR.a7b.lake.c) || [x, z];
      let fx = c[0] - x, fz = c[1] - z, fl = Math.hypot(fx, fz) || 1; fx /= fl; fz /= fl;
      if (Lmp.length >= 4) {
        const tx = Lmp[2], tz = Lmp[3], nx = -tz, nz = tx;
        if (nx * fx + nz * fz >= 0) { fx = nx; fz = nz; } else { fx = -nx; fz = -nz; }
        const nl = Math.hypot(fx, fz) || 1; fx /= nl; fz /= nl;
      }
      const hx = x + fx * 1.2, hz = z + fz * 1.2;
      halo(hx, 6.95, hz, 1.15, sc(WARM, 0.85));   // 岸上灯头要看得清（4A 标准：倒影细、暗、断开，但灯本身明显）
      flat(hx - fx * 0.4, 0.045, hz - fz * 0.4, fx, fz, 3.4, 3.4, RG.pool, sc(WARM, 0.5));
      let start = 0;
      for (let d = 0.8; d <= 16; d += 0.2) { if (isWater(x + fx * d, z + fz * d)) { start = d + 0.08; break; } }
      if (start) {
        // 4A：每盏岸灯脚下要有细、断开、但能看清的短倒影（贴岸，不铺到湖心，也不要一根实心橙条）
        const nSeg = 3, gap = 0.55, segL = 1.15;
        for (let k = 0; k < nSeg; k++) {
          const a = start + k * (segL + gap), b = a + segL;
          const x0 = x + fx * a, z0 = z + fz * a, x1 = x + fx * b, z1 = z + fz * b;
          if (!isWater(x0, z0) || !isWater(x1, z1)) continue;
          const ll = Math.hypot(x1 - x0, z1 - z0) || 1;
          const dim = 0.82 * (1 - k * 0.16);
          flat((x0 + x1) / 2, levelAt(x0, z0) + 0.025, (z0 + z1) / 2, (x1 - x0) / ll, (z1 - z0) / ll, 0.40, ll / 2, RG.streak, sc(WARM, dim));
        }
      }
      n.lamp++;
    }
    // 7C：东段岸灯并进 fzNightLights。数据 fx,fz 已朝水面。倒影同 4A/7B：细、暗、断开，贴岸短条，不要一根亮橙条
    for (const Lmp of (FZR.a7c && FZR.a7c.lamps) || []) {
      const [x, z, fx0, fz0] = Lmp;
      let fx = fx0, fz = fz0, fl = Math.hypot(fx, fz) || 1; fx /= fl; fz /= fl;
      const hx = x + fx * 1.2, hz = z + fz * 1.2;
      halo(hx, 6.95, hz, 1.15, sc(WARM, 0.85));
      flat(hx - fx * 0.4, 0.045, hz - fz * 0.4, fx, fz, 1.8, 1.8, RG.pool, sc(WARM, 0.34));
      let start = 0;
      for (let d = 0.8; d <= 16; d += 0.2) { if (isWater(x + fx * d, z + fz * d)) { start = d + 0.08; break; } }
      if (start) {
        const nSeg = 3, gap = 0.55, segL = 1.15;
        for (let k = 0; k < nSeg; k++) {
          const a = start + k * (segL + gap), b = a + segL;
          const x0 = x + fx * a, z0 = z + fz * a, x1 = x + fx * b, z1 = z + fz * b;
          if (!isWater(x0, z0) || !isWater(x1, z1)) continue;
          const ll = Math.hypot(x1 - x0, z1 - z0) || 1;
          const dim = 0.82 * (1 - k * 0.16);
          flat((x0 + x1) / 2, levelAt(x0, z0) + 0.025, (z0 + z1) / 2, (x1 - x0) / ll, (z1 - z0) / ll, 0.40, ll / 2, RG.streak, sc(WARM, dim));
        }
      }
      n.lamp++;
    }
    // 8A：南半湖 / 入湖渠 / 3号码头岸灯并进 fzNightLights。倒影同 4A/7B：细、暗、断开，贴岸短条，不要一根亮橙条。不加 PointLight。
    for (const Lmp of (FZR.a8a && FZR.a8a.lamps) || []) {
      const [x, z, fx0, fz0] = Lmp;
      let fx = fx0, fz = fz0, fl = Math.hypot(fx, fz) || 1; fx /= fl; fz /= fl;
      const hx = x + fx * 0.12, hz = z + fz * 0.12;   // 8A 灯杆 3.1 m、灯帽 y≈3.05（不要用 4A 7 m 杆的光晕高度，否则光晕飘在灯上方）
      halo(hx, 3.0, hz, 0.62, sc(WARM, 0.8)); LP.push([hx, hz, 3.0]);
      flat(hx, 0.05, hz, fx, fz, 1.5, 1.5, RG.pool, sc(WARM, 0.30));
      let start = 0;
      for (let d = 0.8; d <= 16; d += 0.2) { if (isWater(x + fx * d, z + fz * d)) { start = d + 0.08; break; } }
      if (!start) {   // 灯朝向若背水，改向最近水面补短倒影
        let best = 99;
        for (let a = 0; a < 8; a++) {
          const tx = Math.cos(a * Math.PI / 4), tz = Math.sin(a * Math.PI / 4);
          for (let d = 0.8; d <= 14; d += 0.4) {
            if (isWater(x + tx * d, z + tz * d) && d < best) { best = d; fx = tx; fz = tz; start = d + 0.08; break; }
          }
        }
      }
      if (start) {
        const nSeg = 3, gap = 0.5, segL = 1.25;
        for (let k = 0; k < nSeg; k++) {
          const a = start + k * (segL + gap), b = a + segL;
          const x0 = x + fx * a, z0 = z + fz * a, x1 = x + fx * b, z1 = z + fz * b;
          if (!isWater(x0, z0) || !isWater(x1, z1)) continue;
          const ll = Math.hypot(x1 - x0, z1 - z0) || 1;
          const dim = 0.92 * (1 - k * 0.18);
          flat((x0 + x1) / 2, levelAt(x0, z0) + 0.025, (z0 + z1) / 2, (x1 - x0) / ll, (z1 - z0) / ll, 0.48, ll / 2, RG.streak, sc(WARM, dim));
        }
      }
      n.lamp++;
    }
    // 8A 3号码头牌 / 晋安湖牌：细、暗、断开的水面倒影（无点光）
    const a8aMarks = [];
    for (const S of (FZR.a8a && FZR.a8a.plates) || []) a8aMarks.push(S);
    for (const S of a8aMarks) {
      const x = S.x, z = S.z; let fx = S.f[0], fz = S.f[1];
      let start = 0;
      for (let d = 0.6; d <= 14; d += 0.2) { if (isWater(x + fx * d, z + fz * d)) { start = d + 0.08; break; } }
      if (!start) {
        let best = 99;
        for (let a = 0; a < 8; a++) {
          const tx = Math.cos(a * Math.PI / 4), tz = Math.sin(a * Math.PI / 4);
          for (let d = 0.6; d <= 14; d += 0.4) {
            if (isWater(x + tx * d, z + tz * d) && d < best) { best = d; fx = tx; fz = tz; start = d + 0.08; break; }
          }
        }
      }
      if (!start) continue;
      const nSeg = 2, gap = 0.55, segL = 1.05;
      for (let k = 0; k < nSeg; k++) {
        const a = start + k * (segL + gap), b = a + segL;
        const x0 = x + fx * a, z0 = z + fz * a, x1 = x + fx * b, z1 = z + fz * b;
        if (!isWater(x0, z0) || !isWater(x1, z1)) continue;
        const ll = Math.hypot(x1 - x0, z1 - z0) || 1;
        flat((x0 + x1) / 2, levelAt(x0, z0) + 0.025, (z0 + z1) / 2, (x1 - x0) / ll, (z1 - z0) / ll, 0.42, ll / 2, RG.streak, sc(WARM, 0.78 * (1 - k * 0.2)));
      }
    }
    // 8A 入湖渠 / 牌前：再铺一组固定的细暗断开倒影，避免机位上看不见
    const extra8 = ((FZR.a8a && FZR.a8a.nightStreaks) || []).slice();
    // 牌 / 灯的倒影落点由 a8a.py 按取景机位算好（nightStreaks），这里不再按牌朝向乱找水面
    for (const row of extra8) {
      let x = row[0], z = row[1], fx = row[2], fz = row[3];
      const fl = Math.hypot(fx, fz) || 1; fx /= fl; fz /= fl;
      let start = 0;
      if (isWater(x, z)) start = 0.15;
      else {
        for (let d = 0.4; d <= 26; d += 0.2) { if (isWater(x + fx * d, z + fz * d)) { start = d + 0.06; break; } }
        if (!start) {
          let best = 99;
          for (let a = 0; a < 8; a++) {
            const tx = Math.cos(a * Math.PI / 4), tz = Math.sin(a * Math.PI / 4);
            for (let d = 0.4; d <= 24; d += 0.4) {
              if (isWater(x + tx * d, z + tz * d) && d < best) { best = d; fx = tx; fz = tz; start = d + 0.06; break; }
            }
          }
        }
      }
      if (!start && !isWater(x, z)) continue;
      const nSeg = 3, gap = 0.45, segL = 1.2;
      for (let k = 0; k < nSeg; k++) {
        const a = start + k * (segL + gap), b = a + segL;
        const x0 = x + fx * a, z0 = z + fz * a, x1 = x + fx * b, z1 = z + fz * b;
        if (!isWater((x0 + x1) / 2, (z0 + z1) / 2)) continue;
        const ll = Math.hypot(x1 - x0, z1 - z0) || 1;
        flat((x0 + x1) / 2, levelAt(x0, z0) + 0.04, (z0 + z1) / 2, (x1 - x0) / ll, (z1 - z0) / ll, 0.70, ll / 2, RG.streak, sc(WARM, 1.05 * (1 - k * 0.18)));
      }
    }
    // 8A：取景机位的灯倒影。镜面点在灯→机位地面线上、离机位 d·e/(e+h)（e 眼高、h 灯头高，都从水面量）；
    // 水波把它拉成一条朝灯方向的竖向光柱：在镜面点前后铺 3 段细、暗、断开的短条（只落水面）。画面上正落在灯的正下方。
    // 全部进同一个 lights 网格，不加 draw，不加点光。
    for (const SC of (FZR.a8a && FZR.a8a.streakCams) || []) {
      const [cx, cz, lx, lz, maxd, half] = SC, eye = (SC[7] || 1.7) - WYn, la = Math.atan2(lz - cz, lx - cx);
      for (const L of LP.concat(SC[6] || [])) {
        const x = L[0], z = L[1], h = (L[2] == null ? 1.3 : L[2]) - WYn;
        const d = Math.hypot(x - cx, z - cz); if (d < 6 || d > maxd) continue;
        let ang = Math.atan2(z - cz, x - cx) - la; ang = Math.atan2(Math.sin(ang), Math.cos(ang)); if (Math.abs(ang) > half * Math.PI / 180) continue;
        const ux = (x - cx) / d, uz = (z - cz) / d, tm = d * eye / (eye + h);   // 机位 → 灯
        const t0 = tm * 0.78, t1 = Math.min(d - 0.6, tm * 1.85), nSeg = 4, gap = (t1 - t0) * 0.07, segL = (t1 - t0 - 3 * gap) / nSeg, w = 0.11 + 0.0065 * tm;
        for (let k = 0; k < nSeg; k++) {
          const a = t0 + k * (segL + gap), b = a + segL;
          const x0 = cx + ux * a, z0 = cz + uz * a, x1 = cx + ux * b, z1 = cz + uz * b;
          if (!isWater(x0, z0) || !isWater(x1, z1) || !isWater((x0 + x1) / 2, (z0 + z1) / 2)) continue;
          const kd = Math.abs((a + b) / 2 - tm) / (t1 - t0);
          flat((x0 + x1) / 2, levelAt(x0, z0) + 0.03, (z0 + z1) / 2, ux, uz, w, segL / 2, RG.streak, sc(WARM, 0.82 * (1 - kd * 0.8)));
        }
      }
    }
    // 桥：栏板外侧一道暖光带（跟着拱桥桥面起伏）+ 水面上同色的淡倒影
    for (const b of BRIDGES) {
      if (b.kind === 'bingde' || b.kind === 'covered') continue;
      const rise = humpRise(b), flatB = !rise && b.kind !== 'sarch', uo = flatB ? b.w / 2 : b.w / 2 - 0.03, t = b.t, nn = b.n;
      const isYx = !!((FZR.a7b && (FZR.a7b.bridges || []).includes(b.id)) || (FZR.a7c && (FZR.a7c.bridges || []).includes(b.id)));
      const top = v => flatB ? ((b.deckY || 0) + (b.tall ? (b.barrier || 2.2) * 0.7 : 1.0)) : deckAt(b, v) + 0.84, Pt = (u, v) => [b.x + t[0] * u + nn[0] * v, b.z + t[1] * u + nn[1] * v];
      const seg = flatB ? 1 : 10, v0 = -b.half + 0.25, v1 = b.half - 0.25;
      for (const su of [-1, 1]) {
        if (isYx) {   // 7B 双幅桥：栏板暖光改成短段、略暗，避免岸边看去像 3–4 根实心亮橙条
          const nSeg = 5, gap = 0.7, span = v1 - v0, segL = (span - (nSeg - 1) * gap) / nSeg;
          for (let i = 0; i < nSeg; i++) {
            const va = v0 + i * (segL + gap), vb = va + segL, [xa, za] = Pt(su * (uo + 0.025), va), [xb, zb] = Pt(su * (uo + 0.025), vb), ya = top(va) - 0.07, yb = top(vb) - 0.07;
            quad((xa + xb) / 2, (ya + yb) / 2, (za + zb) / 2, [(xb - xa) / 2, (yb - ya) / 2, (zb - za) / 2], [0, 0.06, 0], RG.line, sc(WARM, 0.48));
          }
        } else for (let i = 0; i < seg; i++) {
          const va = v0 + (v1 - v0) * i / seg, vb = v0 + (v1 - v0) * (i + 1) / seg, [xa, za] = Pt(su * (uo + 0.025), va), [xb, zb] = Pt(su * (uo + 0.025), vb), ya = top(va) - 0.07, yb = top(vb) - 0.07;
          quad((xa + xb) / 2, (ya + yb) / 2, (za + zb) / 2, [(xb - xa) / 2, (yb - ya) / 2, (zb - za) / 2], [0, 0.075, 0], RG.line, sc(WARM, 0.95));
        }
        const hw = Math.max(0, (b.hw || 0) - 0.6), [cx, cz] = Pt(su * (uo + 1.0), 0);
        // 贴图 v（高斯那一向）= t：离桥越远越淡；沿 n 铺满水面宽。贴着闸的桥（新港闸西沿就是六一中路）不要把倒影铺进闸前水面，否则正看闸时像河道中间掉了一根橙管
        const nearSluice = [FZR.c2 && FZR.c2.sluice, FZR.a3 && FZR.a3.gate, FZR.a4 && FZR.a4.gate, FZR.a5 && FZR.a5.gate, FZR.a6 && FZR.a6.gate].some(g => g && Math.hypot(cx - g.x, cz - g.z) < (g.hw || 20) + 10);
        if (hw > 1 && isWater(cx, cz) && !nearSluice) {
          const Z6 = (FZR.a6b && FZR.a6b.zone) || (FZR.a6 && FZR.a6.zone), isHq = !!(FZR.a6 || FZR.a6b) && (((FZR.a6 && (FZR.a6.bridges || []).includes(b.id)) || (FZR.a6b && (FZR.a6b.bridges || []).includes(b.id)) || (Z6 && cx > Z6[0] && cx < Z6[2] && cz > Z6[1] && cz < Z6[3])));
          const Z5 = FZR.a5 && FZR.a5.zone, isYz = FZR.a5 && ((FZR.a5.bridges || []).includes(b.id) || (Z5 && cx > Z5[0] && cx < Z5[2] && cz > Z5[1] && cz < Z5[3]));
          if (isHq || isYz || isYx) {   // 6A / 5 / 7B：倒影分段断开，不要一整根原木。7B 与 ⑤ 一样细、暗
            const nSeg = 5, span = hw * 0.82, gap = 0.55, segL = (2 * span - (nSeg - 1) * gap) / nSeg;
            const thick = isHq ? 0.62 : 0.36, warm = isHq ? 0.48 : (isYx ? 0.22 : 0.16), yoff = isHq ? 0.025 : 0.02;
            for (let k = 0; k < nSeg; k++) {
              const vv = -span + k * (segL + gap) + segL / 2, [x, z] = Pt(su * (uo + 1.0), vv);
              if (isWater(x, z)) flat(x, levelAt(x, z) + yoff, z, t[0], t[1], segL / 2, thick, RG.streak, sc(WARM, warm));
            }
          } else flat(cx, levelAt(cx, cz) + 0.02, cz, t[0], t[1], hw, 1.1, RG.line, sc(WARM, 0.34));
        }
      }
      n.bridge++;
    }
    // 水闸（彬德 / 九门闸 / 新港闸同一套 c2Sluice）：灯带在墩帽顶和启闭房檐下，和九门闸一样只加色、不加点光源。不要把灯带铺进孔跨水面。
    for (const S of [FZR.c2 && FZR.c2.sluice, FZR.a3 && FZR.a3.gate, FZR.a4 && FZR.a4.gate]) {
      if (!S) continue;
      const tS = S.t, nS = S.n, hw = S.hw, NB = S.bays, PW = 1.2, PT = 3.6;
      const Pt = (a, b) => [S.x + tS[0] * a + nS[0] * b, S.z + tS[1] * a + nS[1] * b];
      const PB = (() => { const o = [-hw]; if (S.bayW && S.bayW.length === NB) { const sm = S.bayW.reduce((a, b) => a + b, 0), inner = 2 * hw - NB * PW, sc = inner / sm; let v = -hw; for (let i = 0; i < NB; i++) { v += PW + S.bayW[i] * sc; o.push(v); } } else { for (let i = 1; i <= NB; i++) o.push(-hw + (2 * hw / NB) * i); } return o; })();
      // 墩帽顶：上下游各一段沿墩宽的短带（约 1 m），正视时是一排亮点。不要再沿水流拉长条（正视几乎看成一条线/看不见）。
      const PA0 = -2.4, PA1 = 2.2;
      for (const v of PB) for (const aa of [PA0 - 0.12, PA1 + 0.12]) { const [x, z] = Pt(aa, v); flat(x, PT + 0.32, z, nS[0], nS[1], 0.16, 0.50, RG.line, sc(WARM, 1.15)); }
      { const H0 = PT + 0.24, HH = 2.8, HL = 2 * hw + PW + 0.2, HA0 = -1.6, HA1 = 2.0;
        // 檐带移到檐口外侧（墙在 ±1.6/2.0，檐口只探出约 0.1 m），加厚约 3 倍、略提亮；仍用 RG.line，避免晕成一团
        for (const aa of [HA0 - 0.22, HA1 + 0.22]) { const [x, z] = Pt(aa, 0); flat(x, H0 + HH + 0.00, z, nS[0], nS[1], 0.24, HL / 2, RG.line, sc(WARM, 1.05)); } }
    }
    // 6A 茶园水闸：泵房檐下短灯带 + 堰端压顶，不加孔跨水面倒影；并进已有 fzNightLights
    if (FZR.a6 && FZR.a6.gate) {
      const S = FZR.a6.gate, tS = S.t, nS = S.n, H = S.house;
      const Pt = (a, b) => [S.x + tS[0] * a + nS[0] * b, S.z + tS[1] * a + nS[1] * b];
      for (const sv of [-1, 1]) { const [x, z] = Pt(0.2, sv * (S.hw - 0.45)); flat(x, 0.85, z, nS[0], nS[1], 0.16, 0.45, RG.line, sc(WARM, 0.7)); }
      if (H) {
        const fx = H.n[0], fz = H.n[1];
        flat(H.x, H.h + 1.15, H.z, H.t[0], H.t[1], H.w / 2 - 0.2, 0.12, RG.line, sc(WARM, 0.8));
        flat(H.x - fx * 0.3, 0.045, H.z - fz * 0.3, fx, fz, 2.2, 2.2, RG.pool, sc(WARM, 0.28));
      }
    }
    // 6A 北二环桥下步道：沿桥宽贴梁底两道暖光带，夜里桥下不要一片漆黑（不加点光源）
    for (const U of (FZR.a6 && FZR.a6.under) || []) {
      const t = U.t, [x, z] = [U.x, U.z], sof = (U.soffit != null) ? U.soffit : ((U.deckY || 3.2) - 1.3);
      flat(x, sof + 0.04, z, t[0], t[1], U.w / 2 - 1.2, 0.2, RG.line, sc(WARM, 0.9));
      flat(x + t[0] * 8, sof + 0.04, z + t[1] * 8, t[0], t[1], 6.0, 0.2, RG.line, sc(WARM, 0.85));
      flat(x, 0.045, z, t[0], t[1], 1.8, 1.8, RG.pool, sc(WARM, 0.36));
    }
    // 5 江四水闸：并进同一张 lights 网格。堰顶短带（正视一排亮点）+ 泵房檐口外侧加厚灯带（4A 教训：要够厚、够亮、别藏在檐下）
    if (FZR.a5 && FZR.a5.gate) {
      const S5 = FZR.a5.gate, tS = S5.t, nS = S5.n, hw = S5.hw, H = S5.house;
      const Pt = (a, b) => [S5.x + tS[0] * a + nS[0] * b, S5.z + tS[1] * a + nS[1] * b];
      const WT = 1.55, PW = 1.0, PB = [-hw, -PW / 2, hw], PA0 = -1.4, PA1 = 2.4;
      // 墩帽顶短带：沿 n，正视 / 斜视都是一排亮点（不要沿水流拉长条）
      for (const v of PB) for (const aa of [PA0 - 0.12, PA1 + 0.12]) { const [x, z] = Pt(aa, v); flat(x, WT + 0.10 + 0.32, z, nS[0], nS[1], 0.18, 0.55, RG.line, sc(WARM, 1.15)); }
      if (H) {
        const fx = H.n[0], fz = H.n[1], rx = H.t[0], rz = H.t[1];
        // 只在朝汇入口 / 正面的山墙檐口做加厚灯带（沿房深 = 沿 n），正视能看见一条横带。不要沿 t 拉朝河檐（正视是一条插进天空的橙线）。
        const ux = H.x + rx * (-H.w / 2 - 0.22), uz = H.z + rz * (-H.w / 2 - 0.22);
        flat(ux, H.h + 0.10, uz, fx, fz, 0.24, H.d / 2 + 0.12, RG.line, sc(WARM, 1.05));
      }
    }
    // 5 闽江对岸：夜里仍要读得出是大江。剪影体块在 a5Static 常开；这里并进同一张 lights 网格，疏落地加窗和少量路灯。
    // 对岸约 180 m，NIGHT.lightR=110，把这些片的裁剪半径抬到 140，观景处 / 闸前能看见，不改全局 lightR。
    if (FZR.a5 && FZR.a5.far) {
      const WIN = hex3('#FFD39A'), FAR_R = 140;
      const farQ = (cx, cy, cz, u, v, rg, col) => { quad(cx, cy, cz, u, v, rg, col); QC[QC.length - 1] = FAR_R; };
      for (let i = 0; i < FZR.a5.far.length; i++) {
        const [x, z, fx, fz] = FZR.a5.far[i], rx = -fz, rz = fx;
        const h = 14 + (i * 11) % 22, w = 12 + (i * 5) % 8, d = 10;
        const cx = x - fx * (d / 2 + 0.6), cz = z - fz * (d / 2 + 0.6);
        const fxw = cx + fx * (d / 2 + 0.08), fzw = cz + fz * (d / 2 + 0.08);
        // 对岸 180 m，窗要做成整层灯带才看得出，不能是几像素的小点
        if (i % 3 === 0) {
          for (const yk of [0.35, 0.62]) {
            const yy = h * yk; if (yy < 3.0 || yy > h - 1.6) continue;
            farQ(fxw, yy, fzw, [rx * w * 0.32, 0, rz * w * 0.32], [0, 1.1, 0], RG.line, sc(WIN, 1.35));
          }
        }
        if (i % 4 === 0) {
          halo(x + fx * 2.0, 6.4, z + fz * 2.0, 3.6, sc(WARM, 0.95));
          QC[QC.length - 1] = FAR_R; QC[QC.length - 4] = FAR_R;
        }
      }
    }
    // 5 瀛洲桥桥头路灯：并进同一张 lights 网格（光晕 + 地面光圈；近水处短倒影）
    for (const [x, z, fx, fz] of (FZR.a5 && FZR.a5.lamps) || []) {
      const hx = x + fx * 1.75, hz = z + fz * 1.75;
      halo(hx, 6.95, hz, 0.9, sc(WARM, 0.7));
      flat(hx - fx * 0.4, 0.045, hz - fz * 0.4, fx, fz, 3.2, 3.2, RG.pool, sc(WARM, 0.42));
    }
    // 6B 福飞路人行道路灯：并进同一张 fzNightLights（灯头光晕 + 桥面光圈；不加点光源）
    if (FZR.a6b && FZR.a6b.lamps) {
      const dY = 1.4;
      for (const L of FZR.a6b.lamps) {
        const su = L.side || 1, fx = -su * L.n[0], fz = -su * L.n[1], hx = L.x + fx * 1.75, hz = L.z + fz * 1.75;
        halo(hx, dY + 6.95, hz, 0.9, sc(WARM, 0.7));
        flat(hx - fx * 0.4, dY + 0.045, hz - fz * 0.4, fx, fz, 3.2, 3.2, RG.pool, sc(WARM, 0.42));
      }
    }
    // 7A 机场高速桥下：梁底暖光带并进同一张 fzNightLights，夜里桥下不要一片漆黑（不加点光源）
    for (const U of (FZR.a7a && FZR.a7a.express && FZR.a7a.express.under) || []) {
      const t = U.t, nU = U.n || [-t[1], t[0]], [x, z] = [U.x, U.z], sof = (U.soffit != null) ? U.soffit : ((U.deckY || 6.8) - 1.2);
      // 梁底两道加宽暖光带（沿桥宽），夜里桥下要读得出空间，不要一片漆黑
      flat(x, sof + 0.05, z, t[0], t[1], (U.w || 16) / 2 - 1.0, 0.45, RG.line, sc(WARM, 1.05));
      for (const sg of [-0.32, 0.32]) {
        const bx = x + nU[0] * sg * (U.w || 16), bz = z + nU[1] * sg * (U.w || 16);
        flat(bx, sof + 0.05, bz, t[0], t[1], 5.5, 0.28, RG.line, sc(WARM, 0.95));
      }
      flat(x, 0.045, z, t[0], t[1], 2.2, 2.2, RG.pool, sc(WARM, 0.42));
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
    else if (rg === 2) {   // 3C 返工（小美 night3 ②）：倒影 = 一节一节的短暖光条（6 节、节间留暗缝），靠岸那头最亮最宽，往河心变窄变暗；不是一整条淡光
      const sg = vv * 6, f = sg - Math.floor(sg), bar = Math.min(1, Math.max(0, (f - 0.12) / 0.08)) * Math.min(1, Math.max(0, (0.72 - f) / 0.08));
      const w = 0.3 + 0.5 * vv, g = Math.exp(-(u / w) * (u / w) * 2.2) * (1 - Math.abs(u));
      k = bar * g * (0.3 + 0.7 * Math.pow(vv, 1.2));
    }
    else { k = Math.exp(-v * v * 5) * (1 - v * v) * (Math.abs(u) > 0.94 ? (1 - Math.abs(u)) / 0.06 : 1); }
    const q = Math.max(0, Math.min(255, Math.round(k * 255))), o = (y * W + x) * 4; d[o] = d[o + 1] = d[o + 2] = q; d[o + 3] = 255;
  }
  c.putImageData(img, 0, 0); t.update(true);
  return t;
}
