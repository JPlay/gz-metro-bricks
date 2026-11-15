// 福州内河 3C 夜景（PLAN-3 §4 / §8 小美定稿）：夜里判定 / 配色 / 夜里的组开关距离 / 白天不建任何夜景东西 / 进出夜景原样还原 / 夜灯只占 1 次绘制 / 窗光只换贴图 / 船光带并进船网格
import fs from 'node:fs';
const fails = [];
function ok(n, v, info) { console.log(`${v ? 'PASS' : 'FAIL'} ${n}${!v && info !== undefined ? ' ' + JSON.stringify(info) : ''}`); if (!v) fails.push(n); }
// —— 真 Babylon（NullEngine，同 tools/fzriver/tri_view.mjs 的无头加载）——
import vm from 'node:vm';
globalThis.window = globalThis; globalThis.self = globalThis;
const mkEl = () => new Proxy(function () {}, { get: (t, k) => k === Symbol.toPrimitive ? () => 0 : k === 'then' ? undefined : mkEl(), apply: () => mkEl(), construct: () => mkEl(), set: () => true });
globalThis.document = mkEl(); globalThis.localStorage = { getItem: () => null, setItem() {} }; globalThis.addEventListener = () => {};
globalThis.location = { search: '', href: 'http://x/', hash: '' }; globalThis.matchMedia = () => ({ matches: false, addEventListener() {} }); globalThis.requestAnimationFrame = () => 0; globalThis.Image = function () { return mkEl(); };
vm.runInThisContext(fs.readFileSync(new URL('../../vendor/babylonjs/9.28.0/babylon.js', import.meta.url), 'utf8'));
const BJ = globalThis.BABYLON, C3 = BJ.Color3, eng = new BJ.NullEngine(), SC = new BJ.Scene(eng);
const ctx = { canvas: {}, drawImage() {}, fillRect() {}, save() {}, restore() {}, createLinearGradient: () => ({ addColorStop() {} }), beginPath() {}, moveTo() {}, lineTo() {}, stroke() {}, putImageData() {}, createImageData: (w, h) => ({ data: new Uint8ClampedArray(w * h * 4) }) };
const made = { get mesh() { return SC.meshes.filter(m => !m.isDisposed()).length; } };
const N = await import('../../js/game/night.js');
const { Haze, RIVER_HAZE, FOGMODE_NONE, FOGMODE_LINEAR } = await import('../../js/game/haze.js');
const { Render } = await import('../../js/core/render.js');
const { FzNight } = await import('../../js/world/fzNight.js');
const R = await import('../../js/data/fz-river.js');
// ① 什么时候是夜：本地 19:00–06:00；?t=day / ?t=night 覆盖
ok('night hours: 19:00 → 05:59 night, 06:00 → 18:59 day', [19, 20, 23, 0, 3, 5].every(N.isNightHour) && ![6, 7, 12, 17, 18].some(N.isNightHour));
ok('URL override ?t=night / ?t=day (only exact values; works after other params)', N.nightOverride('?t=night') === 'night' && N.nightOverride('?q=1&t=day') === 'day' && N.nightOverride('?q=1&t=night&x=2') === 'night' && N.nightOverride('?t=nights') === null && N.nightOverride('?q=1') === null && N.nightOverride('') === null);
const at = h => new Date(2026, 10, 15, h, 30);
ok('nightWanted: override wins over local time; no override → local time', N.nightWanted('?t=day', at(22)) === false && N.nightWanted('?t=night', at(12)) === true && N.nightWanted('?q=1', at(22)) === true && N.nightWanted('', at(12)) === false && N.nightWanted('', at(18)) === false && N.nightWanted('', at(19)) === true && N.nightWanted('', at(5)) === true && N.nightWanted('', at(6)) === false);
// ② 配色（小美 §8）
const NI = N.NIGHT, hx = s => [1, 3, 5].map(i => parseInt(s.slice(i, i + 2), 16) / 255), near = (a, b, e = 0.01) => a.every((v, i) => Math.abs(v - b[i]) < e);
ok('sky deep blue not black: on-screen zenith #1B2440 → horizon #2E3A5C; clearColor / fog = sky texture horizon (same pipeline)', NI.zenith === '#1B2440' && NI.horizon === '#2E3A5C' && near(NI.render.clear, hx(NI.skyTex.horizon)) && near(NI.haze.color, hx(NI.skyTex.horizon)));
{ const py = fs.readFileSync(new URL('../../tools/fzriver/sky_night.py', import.meta.url), 'utf8'), m = /Z, HZ = \((0x\w+), (0x\w+), (0x\w+)\), \((0x\w+), (0x\w+), (0x\w+)\)/.exec(py), v = m && m.slice(1).map(Number), t = [...hx(NI.skyTex.zenith), ...hx(NI.skyTex.horizon)].map(x => Math.round(x * 255));
  ok('sky_night.py gradient = NIGHT.skyTex (zenith / horizon)', v && v.every((x, i) => x === t[i]), [v, t]); }
ok('warm lights #FFC27A; glow tint warm, not white-blown (b < 0.7)', NI.warm === '#FFC27A' && NI.glow[0] === 1 && NI.glow[2] < 0.7);
ok('moonlight cold white-blue and very weak (≤ 0.35, blue ≥ red)', NI.render.moon <= 0.35 && NI.render.moonColor[2] >= NI.render.moonColor[0] && NI.render.hemi < 0.65);
ok('water deep blue-green, not black (emissive g, b > r > 0)', NI.water[0] > 0 && NI.water[1] > NI.water[0] && NI.water[2] > NI.water[0]);
ok('sparse windows: ~30% lit (deterministic)', NI.atlas.lit === 0.3 && (() => { let l = 0, t = 0; for (let r = 0; r < 60; r++) for (let w = 0; w < 30; w++) { t++; l += N.windowLit(r, w); } return Math.abs(l / t - 0.3) < 0.04; })() && N.windowLit(3, 4) === N.windowLit(3, 4));
ok('facadeWindows = facadePaint layout (floors × bays, ground floor skipped when ground)', N.facadeWindows(5, 5).length === 25 && N.facadeWindows(5, 5, true).length === 20 && near(N.facadeWindows(4, 5)[0], [0.04, 0.8, 0.12, 0.145], 1e-9));
// ③ 夜里的预算：雾更近、远处组更早关（只收不放），细节格子 125 → 90
ok('night fog nearer than 1B day haze (end 240 < 350) and cutoffs never exceed day', NI.haze.end <= 240 && NI.haze.end < RIVER_HAZE.e.end && NI.lod.near < 125 && NI.lod.gN <= 430 && NI.lod.c2 <= 330 && NI.lod.c2d <= 110 && NI.lod.d2e <= 430 && NI.lod.c2mj <= 450);
ok('far groups cut only beyond fog end (fully fogged → no visible pop)', NI.lod.gN >= NI.haze.end && NI.lod.c2 >= NI.haze.end && NI.lod.d2e >= NI.haze.end);
// ④ 源码约束：无点光源 / 聚光灯 / 阴影；白天走原代码路径；夜景东西只在夜里建
const src = f => fs.readFileSync(new URL('../../' + f, import.meta.url), 'utf8');
const fzN = src('js/world/fzNight.js'), rnd = src('js/core/render.js'), riv = src('js/world/fzRiver.js'), boat = src('js/game/fzBoat.js'), nj = src('js/game/night.js');
ok('no PointLight / SpotLight / ShadowGenerator in night code', ![fzN, nj].some(s => /PointLight|SpotLight|ShadowGenerator/.test(s)) && !/new B\.(PointLight|SpotLight)/.test(rnd));
ok('night turns sun shadow off (setNight / setSunShadow / setTier all gate on !this.night)', (rnd.match(/!this\.night/g) || []).length >= 3);
ok('day path untouched: applyZone day lerps as before, night only via `if (this.night) this.applyNight(1 - f)`', /h\.intensity = lerp\(0\.65, 0\.95, f\);/.test(rnd) && /sun\.intensity = lerp\(2\.4, 0\.9, f\);/.test(rnd) && /if \(this\.night\) this\.applyNight\(1 - f\);/.test(rnd));
ok('night lights = exactly one mesh (1 draw), built lazily inside set(true)', (fzN.match(/new B\.Mesh\(/g) || []).length === 1 && /this\.lights\(\)\.setEnabled\(true\)/.test(fzN));
ok('window glow is texture-only (night atlas = DynamicTexture swap, no meshes in nightAtlas)', /nightAtlas\(\) \{[\s\S]*?new B\.DynamicTexture[\s\S]*?return t;\n  \}/.test(fzN) && !/nightAtlas\(\) \{[\s\S]*?new B\.Mesh[\s\S]*?return t;\n  \}/.test(fzN));
ok('boat canopy strip merged into the boat paint mesh (setNight swaps vertex data + material clone, no new mesh)', /setNight\(on\) \{[\s\S]*?byBucket\.paint[\s\S]*?setVerticesData[\s\S]*?m\.material = on \?/.test(boat) && !/setNight\(on\) \{[\s\S]*?new B\.Mesh[\s\S]*?\n  dispose\(\)/.test(boat));
ok('fzRiver: night decided in after() from URL + local time, re-checked every 30 s, disposed on leave', /this\.night = new FzNight\(this\);[^\n]*this\.night\.set\(nightWanted\(location\.search\)\)/.test(riv) && /this\.nightT = 30; this\.night\.set\(nightWanted/.test(riv) && /if \(this\.night\) \{ this\.night\.dispose\(\); this\.night = null; \}/.test(riv));
ok('fzRiver lodNow: night shifts distances only when nightLod (day → original thresholds)', /NL = this\.nightLod \? NIGHT\.lod : null/.test(riv) && /\+ \(NL \? NEAR - NL\.near : 0\)/.test(riv) && /\+ \(NL \? 430 - NL\.gN : 0\)/.test(riv));
ok('no dependency on PR #30 dusk assets', ![fzN, nj, rnd, riv].some(s => /dusk|黄昏/i.test(s)));
// ⑤ 进夜景 / 回白天 / 离开河网：原样还原（替身场景，跑真 FzNight）
for (const net of ['a', 'e']) {
  R.useNet(net);
  const calls = [];
  Render.active = { night: null, setNight(c) { this.night = c; calls.push(c ? 'night' : 'day'); } };
  const water = { emissiveColor: new C3(0, 0, 0) }, glow = { emissiveColor: new C3(1, 1, 1) };
  const scene = SC; SC.fogMode = FOGMODE_NONE; SC.fogStart = 0; SC.fogEnd = 1000; SC.fogColor = new C3(0.2, 0.2, 0.3); SC.activeCamera = { maxZ: 420 };
  const M = { glow, paint: { clone: () => water }, colored: { 'bucket:paint@sea': water }, normals: [] };
  let lods = 0; const boatN = [];
  const S = { scene, net, kit: { M, root: new BJ.TransformNode('root', SC) }, atlas: { S: 2048, mat: { emissiveTexture: 'DAYTEX' }, tex: { getContext: () => ctx, level: 0.95 } }, atlasRegs: [{ uv: { u0: 0, u1: 0.1, v0: 0.9, v1: 1 }, tag: 'scene', win: N.facadeWindows(4, 5) }, { uv: { u0: 0.2, u1: 0.3, v0: 0.9, v1: 1 }, tag: 'sign' }],
    pierFrame: p => ({ P: (a, b) => [p.x + p.t[0] * a - p.n[0] * b, p.z + p.t[1] * a - p.n[1] * b] }), lodNow() { lods++; }, boats: { A: { setNight(v) { boatN.push(v); } } } };
  if (RIVER_HAZE[net]) { S.haze = new Haze(scene, scene.activeCamera, RIVER_HAZE[net]); S.haze.apply(); }
  const snap = () => JSON.stringify({ fog: [scene.fogMode, scene.fogStart, scene.fogEnd, scene.fogColor.asArray()], maxZ: scene.activeCamera.maxZ, glow: glow.emissiveColor, water: water.emissiveColor, atlas: S.atlas.mat.emissiveTexture, lod: !!S.nightLod, haze: S.haze ? S.haze.cfg : null, rn: Render.active.night });
  const day = snap(), m0 = made.mesh;
  const nt = new FzNight(S); nt.set(false);
  ok(`[${net}] set(false) by day builds nothing, changes nothing`, snap() === day && made.mesh === m0 && calls.length === 0);
  nt.set(true);
  ok(`[${net}] night on: render night, night fog 70→240 horizon colour, glow warm, water blue-green, atlas swapped, night LOD, boats lit`, Render.active.night === NI.render && scene.fogMode === FOGMODE_LINEAR && scene.fogEnd === NI.haze.end && glow.emissiveColor.b < 0.7 && water.emissiveColor.g > 0 && S.atlas.mat.emissiveTexture !== 'DAYTEX' && S.nightLod === true && boatN.at(-1) === true && nt.mesh && nt.mesh.isEnabled(false));
  ok(`[${net}] night lights: one mesh, lamps + bridges + stairs/piers present`, made.mesh === m0 + 1 && nt.counts.lamp > 20 && nt.counts.bridge > 5 && nt.counts.pier > 0, nt.counts);
  { const Q = nt._qc, all = nt.counts.tris, p = { x: Q[0], z: Q[1] }; nt.cull(p); const I = nt.mesh.getIndices(), keep = new Set(); for (let k = 0; k < I.length; k += 6) keep.add(Math.floor(I[k] / 4));
    const inR = q => Math.hypot(Q[3 * q] - p.x, Q[3 * q + 1] - p.z) - Q[3 * q + 2] < NI.lightR, n = Q.length / 3; let good = true; for (let q = 0; q < n; q++) if (keep.has(q) !== inR(q)) good = false;
    const t1 = nt.counts.drawn; nt.cull({ x: p.x + 3, z: p.z }); const same = nt.counts.drawn === t1; nt._ck = null; nt.cull({ x: 1e6, z: 1e6 });
    ok(`[${net}] night lights culled to ${NI.lightR} m around the player (index swap, same mesh; < 16 m move = no rebuild)`, NI.lightR >= 90 && good && t1 > 0 && t1 < all && same && nt.counts.drawn === 0 && made.mesh === m0 + 1, { all, t1 }); nt._ck = null; nt.cull(p); }
  nt.set(true); ok(`[${net}] set(true) twice: no extra mesh`, made.mesh === m0 + 1);
  nt.set(false);
  ok(`[${net}] back to day: everything exactly as before (fog / haze / glow / water / atlas / LOD / render)`, snap() === day && !nt.mesh.isEnabled(false) && boatN.at(-1) === false, [snap(), day]);
  nt.set(true); nt.set(false); ok(`[${net}] second night→day cycle reuses the mesh, still identical`, snap() === day && made.mesh === m0 + 1);
  nt.set(true);
  // 离开河网（fzRiver.dispose 顺序：先还原雾，再 night.dispose）
  if (S.haze) { S.haze.restore(); S.haze = null; } nt.dispose();
  ok(`[${net}] leave river while night: fog back to pre-river, render day, glow / water restored, mesh disposed`, scene.fogMode === FOGMODE_NONE && scene.fogEnd === 1000 && scene.fogColor.r === 0.2 && Render.active.night === null && glow.emissiveColor.r === 1 && glow.emissiveColor.b === 1 && water.emissiveColor.g === 0 && !nt.mesh && !S.haze);
}
if (fails.length) { console.log(`${fails.length} FAILED: ${fails.join('; ')}`); process.exit(1); } else console.log('ALL PASS');
