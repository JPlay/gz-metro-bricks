/*
 * 画质升级 Demo 的 PBR 着色器插件（Babylon MaterialPluginBase，0 次额外绘制、0 张额外贴图——除了每站一张烘焙的日照高度图）：
 *   GfxUpgradePlugin（所有静态 PBR 桶材质）：
 *     1. 日照投影：每个车站把户外静态几何沿太阳方向投到地面，烘焙成一张「最高遮挡高度」图（js/core/gfx.js bakeSunShadow），
 *        片元沿光线反投到地面查表：那条光线上有比自己高的遮挡物 → 在影子里。地面、墙面、长椅都对，树冠投下斑驳的影子；
 *        只压太阳那部分直射光（漫反射 × 朝向太阳的程度 + 高光），环境光 / 天光不动，所以影子透亮不发黑。
 *     2. 去重复宏观变化：世界坐标多倍频值噪声 ±6% 明度 / 冷暖（大片沥青、草地、墙不再像贴墙纸）
 *        + 墙脚 0.45 m 贴地暗边（只对竖直面）+ 户外挑檐底面偏冷。
 *     3. 树叶透光：绿色（G > R×1.15 且 G > B×1.1）的户外表面，逆光时透出暖色、顺光时树冠受光面微微提亮。
 *     4. 天空同色掠射边缘光：朝上 / 掠射角的边缘加一点天空色（物体轮廓更清楚）。
 *   GfxWaterPlugin（只给演示水池）：两张水波法线按世界坐标反向滚动叠加 + 反射限幅（掠射角不会变成一片白）。
 * 原版模式下 define 全关 = 着色器与原版完全一致（切换时 Babylon 按 define 缓存，第二次切换不再编译）。
 */
const B = window.BABYLON;
export const GFX_BASES = new Set(['paint', 'gloss', 'floor', 'pave', 'tactile', 'ceiling', 'wall', 'metal', 'concrete', 'brick', 'qz', 'granite', 'asphalt', 'grass', 'facade']);
export const baseOf = name => String(name || '').split('@')[0];
/** 所有插件共享的运行时状态（gfx.js 改这里，再 markDirty） */
export const GS = {
  on: false,            // 总开关（原版 = false）
  shadow: 0, shader: 0, // 子开关（uniform，切换不用重编译）
  sunDir: new B.Vector3(-0.48, -0.78, 0.40).normalize(), shadowK: 0.62,
  sunCol: new B.Color3(1.0, 0.86, 0.62), leaf: 1.0,
  sky: new B.Color3(0.62, 0.74, 0.9), rim: 0.06,
  shTex: null, shMap: [0, 0, 1, 1], shTexel: 1 / 1024, shH: 25.5, shBase: 0,
  shFade: 1,            // 室内 / 隧道渐隐（1 = 户外全开）
  taps: 4,              // 阴影采样数：档位 0/1 = 4（软边），档位 2 = 1
  noise: 1,             // 程序化宏观噪声（档位 2 关）
  time: 0,
  water: { on: false, dual: 1, n1: null, n2: null, s1: 0.13, s2: 0.53, off: [0, 0, 0, 0], strength: 0.24, refl: 0.72, clamp: 2.5 }
};
const NOISE = `
float gfxHash(vec2 p){ p = fract(p * vec2(0.1031, 0.1030)); p += dot(p, p.yx + 33.33); return fract((p.x + p.y) * p.x); }
float gfxNoise(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(gfxHash(i), gfxHash(i + vec2(1.0, 0.0)), f.x), mix(gfxHash(i + vec2(0.0, 1.0)), gfxHash(i + vec2(1.0, 1.0)), f.x), f.y); }
`;
export class GfxUpgradePlugin extends B.MaterialPluginBase {
  constructor(material) {
    super(material, 'GfxUpgrade', 210, { GFXUP: false });
    this.doNotSerialize = true;
    this._enable(true);
  }
  getClassName() { return 'GfxUpgradePlugin'; }
  prepareDefines(defines) { defines.GFXUP = !!GS.on; }
  getSamplers(samplers) { samplers.push('gfxShadowSampler'); }
  getUniforms() {
    return {
      ubo: [
        { name: 'gfxF', size: 4, type: 'vec4' }, { name: 'gfxSunDir', size: 4, type: 'vec4' }, { name: 'gfxSunCol', size: 4, type: 'vec4' },
        { name: 'gfxSky', size: 4, type: 'vec4' }, { name: 'gfxShMap', size: 4, type: 'vec4' }, { name: 'gfxShP', size: 4, type: 'vec4' }
      ],
      fragment: `#ifdef GFXUP
uniform vec4 gfxF; uniform vec4 gfxSunDir; uniform vec4 gfxSunCol; uniform vec4 gfxSky; uniform vec4 gfxShMap; uniform vec4 gfxShP;
#endif`
    };
  }
  bindForSubMesh(ubo) {
    if (!GS.on) return;
    const has = GS.shadow && GS.shTex && GS.shTex.isReady();
    ubo.updateFloat4('gfxF', has ? GS.shFade : 0, GS.shader, GS.noise, 0);
    const d = GS.sunDir; ubo.updateFloat4('gfxSunDir', d.x, d.y, d.z, GS.shadowK);
    const c = GS.sunCol; ubo.updateFloat4('gfxSunCol', c.r, c.g, c.b, GS.leaf);
    const s = GS.sky; ubo.updateFloat4('gfxSky', s.r, s.g, s.b, GS.rim);
    const m = GS.shMap; ubo.updateFloat4('gfxShMap', m[0], m[1], m[2], m[3]);
    ubo.updateFloat4('gfxShP', GS.shTexel, GS.shH, GS.shBase, GS.taps);
    if (GS.shTex) ubo.setTexture('gfxShadowSampler', GS.shTex);
  }
  getActiveTextures(a) { if (GS.shTex) a.push(GS.shTex); }
  hasTexture(t) { return t === GS.shTex; }
  getCustomCode(type) {
    if (type !== 'fragment') return null;
    return {
      CUSTOM_FRAGMENT_DEFINITIONS: `#ifdef GFXUP
uniform sampler2D gfxShadowSampler;
${NOISE}
float gfxShadowAt(vec3 P, vec3 Ng) {
  // 墙面 / 侧面：高度图在竖直面上梯度很陡（1 texel ≈ 0.25 m 高差，再加保守光栅化 + 4 次偏移采样），
  // 只靠 0.22 m 法线偏移会自阴影（向阳的楼面整面发黑）→ 侧面加大法线偏移 + 高度偏置（斜率偏置）
  float gs = 1.0 - abs(Ng.y);
  vec3 Q = P + Ng * (0.22 + 0.35 * gs);
  float t = (Q.y - gfxShP.z) / max(0.06, -gfxSunDir.y);
  vec2 g = Q.xz + gfxSunDir.xz * t;
  vec2 uv = (g - gfxShMap.xy) * gfxShMap.zw;
  if (uv.x < 0.0 || uv.y < 0.0 || uv.x > 1.0 || uv.y > 1.0) return 0.0;
  float y0 = Q.y - gfxShP.z + 0.06 + 0.6 * gs, yb = y0 + 0.9, k = gfxShP.y;
  if (gfxShP.w < 2.0) return smoothstep(y0, yb, texture2D(gfxShadowSampler, uv).r * k);
  // 4 个旋转网格采样 + 半影带（高度差 0.9 m 内渐变）：边缘软、看不出 texel 台阶
  float o = gfxShP.x * 1.6, acc = 0.0;
  acc += smoothstep(y0, yb, texture2D(gfxShadowSampler, uv + vec2(o, o * 0.4)).r * k);
  acc += smoothstep(y0, yb, texture2D(gfxShadowSampler, uv + vec2(-o, -o * 0.4)).r * k);
  acc += smoothstep(y0, yb, texture2D(gfxShadowSampler, uv + vec2(-o * 0.4, o)).r * k);
  acc += smoothstep(y0, yb, texture2D(gfxShadowSampler, uv + vec2(o * 0.4, -o)).r * k);
  return acc * 0.25;
}
#endif`,
      CUSTOM_FRAGMENT_BEFORE_LIGHTS: `#ifdef GFXUP
vec3 gfxNg = normalize(vNormalW);
float gfxOut = smoothstep(-1.4, -0.5, vPositionW.y);
if (gfxF.y > 0.5) {
  if (gfxF.z > 0.5) {
  vec2 gq = vPositionW.xz + vec2(vPositionW.y * 0.37, -vPositionW.y * 0.23);
  float gm = (gfxNoise(gq * 0.043) - 0.5) * 0.085 + (gfxNoise(gq * 0.19 + 17.0) - 0.5) * 0.04 + (gfxNoise(gq * 0.83 + 5.0) - 0.5) * 0.015;
  surfaceAlbedo *= vec3(1.0 + gm * 1.25, 1.0 + gm, 1.0 + gm * 0.7);
  }
  float gside = 1.0 - abs(gfxNg.y);
  surfaceAlbedo *= mix(1.0, mix(0.8, 1.0, smoothstep(0.0, 0.45, vPositionW.y)), gside * gfxOut);
}
#endif`,
      CUSTOM_FRAGMENT_BEFORE_FINALCOLORCOMPOSITION: `#ifdef GFXUP
{
  float gNdL = dot(gfxNg, -gfxSunDir.xyz);
  float gLit = 1.0;
  if (gfxF.x > 0.01 && gfxOut > 0.01) {
    float gsh = gfxShadowAt(vPositionW, gfxNg) * gfxOut * gfxF.x;
    gLit = 1.0 - gsh;
    finalDiffuse *= 1.0 - gsh * gfxSunDir.w * smoothstep(-0.05, 0.3, gNdL);
#ifdef REFLECTION
    finalIrradiance *= 1.0 - gsh * 0.3;
#endif
#ifdef SPECULARTERM
    finalSpecularScaled *= gLit;
#endif
  }
  if (gfxF.y > 0.5 && gfxOut > 0.01) {
    vec3 ga = surfaceAlbedo.rgb;
    float gleaf = step(ga.r * 1.15, ga.g) * step(ga.b * 1.1, ga.g) * gfxOut * gfxSunCol.w * (1.0 - smoothstep(0.7, 0.92, gfxNg.y) * 0.85);   // 朝上的草地不透光（夕阳下草地发黄）
    float gback = pow(max(0.0, dot(viewDirectionW, gfxSunDir.xyz)), 3.0);
    vec3 gtrans = gfxSunCol.rgb * ga * (gback * 1.6 * (0.35 + 0.65 * gLit) + max(0.0, gNdL * 0.5 + 0.5) * 0.18 * gLit);
    finalDiffuse += gtrans * gleaf;
    float gfr = pow(1.0 - clamp(dot(normalW, viewDirectionW), 0.0, 1.0), 4.0);
    finalDiffuse += gfxSky.rgb * gfr * clamp(normalW.y * 0.6 + 0.5, 0.0, 1.0) * gfxSky.w * gfxOut;
#ifdef REFLECTION
    if (gfxNg.y < -0.5) finalIrradiance *= mix(vec3(1.0), vec3(0.84, 0.89, 1.0), gfxOut);
#endif
  }
}
#endif`
    };
  }
}
export class GfxWaterPlugin extends B.MaterialPluginBase {
  constructor(material) { super(material, 'GfxWater', 220, { GFXWATER: false }); this.doNotSerialize = true; this._enable(true); }
  getClassName() { return 'GfxWaterPlugin'; }
  prepareDefines(defines) { defines.GFXWATER = !!(GS.water.on && GS.water.n1 && GS.water.n2); }
  getSamplers(s) { s.push('gfxW1', 'gfxW2'); }
  getUniforms() {
    return { ubo: [{ name: 'gfxWT', size: 4, type: 'vec4' }, { name: 'gfxWP', size: 4, type: 'vec4' }, { name: 'gfxWQ', size: 4, type: 'vec4' }],
      fragment: `#ifdef GFXWATER
uniform vec4 gfxWT; uniform vec4 gfxWP; uniform vec4 gfxWQ;
#endif` };
  }
  bindForSubMesh(ubo) {
    const W = GS.water; if (!(W.on && W.n1 && W.n2)) return;
    ubo.updateFloat4('gfxWT', W.off[0], W.off[1], W.off[2], W.off[3]);
    ubo.updateFloat4('gfxWP', W.strength, W.refl, W.clamp, W.s1);
    ubo.updateFloat4('gfxWQ', W.dual, 0, 0, 0);
    ubo.setTexture('gfxW1', W.n1); ubo.setTexture('gfxW2', W.n2);
  }
  getActiveTextures(a) { const W = GS.water; if (W.n1) a.push(W.n1, W.n2); }
  hasTexture(t) { const W = GS.water; return t === W.n1 || t === W.n2; }
  getCustomCode(type) {
    if (type !== 'fragment') return null;
    return {
      CUSTOM_FRAGMENT_DEFINITIONS: `#ifdef GFXWATER
uniform sampler2D gfxW1; uniform sampler2D gfxW2;
#endif`,
      CUSTOM_FRAGMENT_BEFORE_LIGHTS: `#ifdef GFXWATER
{
  vec2 wp = vPositionW.xz;
  vec3 wn1 = texture2D(gfxW1, wp * gfxWP.w + gfxWT.xy).xyz * 2.0 - 1.0;
  vec3 wn2 = gfxWQ.x > 0.5 ? texture2D(gfxW2, wp * (gfxWP.w * 1.9) + gfxWT.zw).xyz * 2.0 - 1.0 : vec3(0.0);
  float wfade = 1.0 / (1.0 + 0.09 * length(vEyePosition.xyz - vPositionW));
  vec2 wd = (wn1.xy + wn2.xy * 0.8) * gfxWP.x * wfade;
  normalW = normalize(vec3(wd.x, 1.0, wd.y));
}
#endif`,
      CUSTOM_FRAGMENT_BEFORE_FINALCOLORCOMPOSITION: `#ifdef GFXWATER
#ifdef REFLECTION
finalRadianceScaled = min(finalRadianceScaled * gfxWP.y, vec3(gfxWP.z));
#endif
#ifdef SPECULARTERM
finalSpecularScaled = min(finalSpecularScaled, vec3(gfxWP.z * 2.0));
#endif
#endif`
    };
  }
}
const ATTACHED = new WeakSet();
/** 给静态桶材质挂升级插件（同一材质只挂一次；克隆出来的 'floor@P' 等也调这个） */
export function ensureGfx(m) {
  if (!m || ATTACHED.has(m) || !m.getClassName || m.getClassName() !== 'PBRMaterial' || !GFX_BASES.has(baseOf(m.name))) return m;
  ATTACHED.add(m); m._gfx = new GfxUpgradePlugin(m); if (HOOKS.onAttach) HOOKS.onAttach(m); return m;
}
/** gfx.js 挂的回调：新克隆的桶材质（各城市建场景时才出现）按当前画质状态配置 */
export const HOOKS = { onAttach: null };
export function ensureWater(m) { if (m && !m._gfxW) m._gfxW = new GfxWaterPlugin(m); return m; }
/** 改了 GS.on / GS.water.on 之后调：让材质按新 define 重新取着色器（Babylon 按 define 串缓存 effect） */
export function markGfxDirty(scene) {
  for (const m of scene.materials) if (m._gfx || m._gfxW) m.markAsDirty(B.Material.AllDirtyFlag);
}
