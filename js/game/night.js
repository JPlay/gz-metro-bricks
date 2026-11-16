/*
 * 3C 夜景（PLAN-3 §4 / §8，小美定稿）：只在福州内河街区（FzRiverStreet：a 网 + e 网）里生效。
 *   什么时候是夜：设备本地时间 19:00–06:00；URL 覆盖 ?t=day / ?t=night（测试 / 截图用，不加按钮）。
 *   离开河网（回站 / 换区）→ 原样还原白天；白天的代码路径和 cc71056 完全一样（夜景的网格 / 贴图白天一律不建）。
 *   不用点光源 / 聚光灯、不开阴影；灯光全是发光件 + 加色光晕（一个网格 = 一次绘制）。
 * 纯数值，不碰 BABYLON：Node 单测直接跑。
 */
export const NIGHT_FROM = 19, NIGHT_TO = 6;
/** 本地小时 h（0–23）是不是夜里：19:00 起、06:00 前 */
export function isNightHour(h) { return h >= NIGHT_FROM || h < NIGHT_TO; }
/** URL 覆盖：?t=night / ?t=day（别的值不算） */
export function nightOverride(search) { const m = /[?&]t=(day|night)(?:&|#|$)/.exec(search || ''); return m ? m[1] : null; }
/** 要不要夜景：先看 URL 覆盖，再看设备本地时间 */
export function nightWanted(search, date = new Date()) { const o = nightOverride(search); return o ? o === 'night' : isNightHour(date.getHours()); }
const h2 = s => [1, 3, 5].map(i => parseInt(s.slice(i, i + 2), 16) / 255);
export const NIGHT = {
  // 天：深蓝不是黑（天顶 #1B2440 → 地平线 #2E3A5C）；clearColor / 雾色 = 地平线色，远处融进天边
  // 屏幕上的目标色是 zenith / horizon；天空贴图（tools/fzriver/sky_night.py）按渲染管线预补偿成 skyTex，雾色 / clearColor 用贴图的地平线色（同一条管线出来才和天边对得上）
  zenith: '#1B2440', horizon: '#2E3A5C', skyTex: { zenith: '#34364A', horizon: '#4A5068' }, clear: h2('#4A5068'),
  // 灯光（Render.setNight）：月光冷白蓝、很弱；天光压低偏蓝，步道 / 台阶 / 码头边 / 栏杆靠它保持可读
  //   3C 返工（小美 night2 ②）：月亮放低（仰角 ~27°）+ 天光地面色提亮 → 立面（白墙）比地坪多吃一点光：墙成月光灰蓝、地坪和石板一样暗
  render: { hemi: 0.22, hemiColor: [0.62, 0.7, 0.95], hemiGround: [0.45, 0.5, 0.68], moon: 0.22, moonColor: [0.74, 0.83, 1.0], moonDir: [-0.7, -0.45, 0.55], env: 0.12, sky: 'assets/tex/sky_night.jpg', clear: h2('#4A5068') },
  // 夜雾（两个网都用）：近处一点不灰，240 m 完全融进地平线色 —— 远处的组可以更早整组关掉（雾不省绘制，关组才省）
  haze: { start: 70, end: 240, color: h2('#4A5068'), maxZ: null },
  // 夜里各组的开关距离（白天值见 fzRiver.js lodNow）：雾尽头 240 m 以外整组关（看不见）；近处细节格子 125 → 90 m
  lod: { near: 90, gN: 250, c2: 250, c2d: 90, d2e: 250, c2mj: 260 },
  lightR: 110,   // 夜灯片只画 110 m 以内（夜雾 70→240 m；灯片不吃雾，再远也只是几个小亮点）：船上 / 西片最重点省下 ~1.5k 面
  // 暖光 #FFC27A；光晕小、不过曝成白
  warm: '#FFC27A', glow: [1.0, 0.8, 0.56],
  // 水：深蓝绿不是黑（paint@sea 加一点自发光，线性空间；夜里环境反射压到 waterEnv，不再反出白天天色的亮青）
  water: [0.004, 0.014, 0.02], waterEnv: 0.05, waterDirect: 0.45,
  // 夜里纯顶点色材质（没有反照率贴图）的反照率乘子（白天全是 1；fzNight.tintMats 选材质、回白天原样还原）：
  //   paint：地坪 / 路面 / 杂项压到和旁边石板一样暗、略偏冷；paint@wall（马鞍墙 / 粉墙）留成月光下的灰蓝，比石板亮一档还认得出墙；
  //   paint@sea（水）深蓝绿，比岸上铺装暗一档（亮的只剩灯下的暖色倒影条）
  tint: { paint: [0.3, 0.3, 0.36], 'paint@wall': [0.66, 0.73, 0.92], 'paint@sea': [0.16, 0.12, 0.12] },
  // 图集：白天贴图拷一份，非标牌区域乘暗偏蓝；标牌区域基本保持亮度（出口牌 / 码头牌 / 河名牌可读）；立面窗约 30% 亮暖光
  atlas: { scene: '#3A4462', sign: '#D2CEC6', lit: 0.3 },
};
/** 窗亮不亮：按（区域序号, 窗序号）确定性取值，约 ratio 比例亮 */
export function windowLit(region, win, ratio = NIGHT.atlas.lit) { const v = Math.sin(region * 127.1 + win * 311.7 + 0.5) * 43758.5453; return v - Math.floor(v) < ratio; }
/** facadePaint({ floors, bays, ground }) 的窗位置（区域内 0..1 分数，y 向下），与 xmStreet.js facadePaint 同一算法 */
export function facadeWindows(floors, bays, ground = false) {
  const out = [], fh = 1 / floors, bw = 1 / bays;
  for (let f = 0; f < floors; f++) { if (f === 0 && ground) continue; const y0 = 1 - (f + 1) * fh; for (let b = 0; b < bays; b++) out.push([b * bw + bw * 0.2, y0 + fh * 0.2, bw * 0.6, fh * 0.58]); }
  return out;
}
