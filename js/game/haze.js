/*
 * 河面水汽远景（福州内河 1B，小美）：线性雾 200 m 开始、350 m 基本融进天色；150 m 内一点不灰（雾系数 = 0）。
 * 只在 1B 河网街区里开，离开（回站 / 换区）原样还原 scene 的雾设置和相机远裁剪面（地铁隧道雾仍由 main.js onTunnel 管）。
 * 不碰 BABYLON：纯数值，Node 单测直接跑（js/core/render.js 的天空穹顶 fogEnabled=false / applyFog=false，不会被雾刷成一片平色）。
 */
/** 雾色 = 天空贴图 assets/tex/sky.jpg 地平线一圈的平均色（0.58, 0.77, 0.96）和 clearColor（0.62, 0.78, 0.92）之间，略偏水汽白 */
export const RIVER_HAZE = {
  e: { start: 200, end: 350, color: [0.6, 0.775, 0.945], maxZ: 380 },
};
export const FOGMODE_NONE = 0, FOGMODE_LINEAR = 3;   // = BABYLON.Scene.FOGMODE_*
/** 线性雾在距离 d 的“雾量”（0 = 原色，1 = 全是雾色），同 Babylon：f = (end − d) / (end − start) 夹到 0..1，雾量 = 1 − f */
export function hazeAmount(cfg, d) { const f = Math.max(0, Math.min(1, (cfg.end - d) / (cfg.end - cfg.start))); return 1 - f; }
export class Haze {
  /** scene：要有 fogMode / fogStart / fogEnd / fogColor{r,g,b}；cam：可选，有 maxZ */
  constructor(scene, cam, cfg) { this.scene = scene; this.cam = cam; this.cfg = cfg; this.saved = null; }
  apply() {
    const s = this.scene, c = this.cfg;
    if (!this.saved) this.saved = { mode: s.fogMode, start: s.fogStart, end: s.fogEnd, color: s.fogColor ? [s.fogColor.r, s.fogColor.g, s.fogColor.b] : null, cam: this.cam || null, maxZ: this.cam ? this.cam.maxZ : null };
    this.reassert();
  }
  /** 每帧调用也便宜：只在被别处改掉时写回（隧道之外） */
  reassert() {
    const s = this.scene, c = this.cfg;
    if (s.fogMode !== FOGMODE_LINEAR) s.fogMode = FOGMODE_LINEAR;
    if (s.fogStart !== c.start) s.fogStart = c.start;
    if (s.fogEnd !== c.end) s.fogEnd = c.end;
    if (s.fogColor && (s.fogColor.r !== c.color[0] || s.fogColor.g !== c.color[1] || s.fogColor.b !== c.color[2])) { s.fogColor.r = c.color[0]; s.fogColor.g = c.color[1]; s.fogColor.b = c.color[2]; }
    if (this.cam && c.maxZ && this.cam.maxZ !== c.maxZ) this.cam.maxZ = c.maxZ;
  }
  restore() {
    const v = this.saved; if (!v) return; const s = this.scene;
    s.fogMode = v.mode; s.fogStart = v.start; s.fogEnd = v.end;
    if (v.color && s.fogColor) { s.fogColor.r = v.color[0]; s.fogColor.g = v.color[1]; s.fogColor.b = v.color[2]; }
    if (v.cam && v.maxZ != null) v.cam.maxZ = v.maxZ;
    this.saved = null;
  }
}
