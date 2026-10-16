/*
 * 哥哥“明明”：和星星（hero.js）同一套玩具风格、同一套骨骼 / 程序化动画，只换外形（不用照片贴图，只是玩具版的神似）。
 *   - 黑色短发，刘海往一边拨、头顶有点蓬；不戴眼镜；圆圆胖胖的笑脸（腮帮子鼓、眯眼笑）；
 *   - 比星星高一截、壮一点（整体缩放 1.04 vs 0.9，胸更宽）；
 *   - 白色运动球衣：藏青色肩袖 + 两侧藏青条、藏青领口；胸前红色“SUNSHINE 23”（唯一一张小贴图，字清楚），背后藏青“23”；
 *   - 藏青及膝运动短裤 + 白色侧条 / 裤脚白边；白短袜；灰色洞洞鞋；
 *   - 金黄色挂绳 + 胸前小黑手表（也当他的羊城通）。
 * 网格：身体 1 个蒙皮网格（顶点色）+ 球衣字 1 个蒙皮小网格（贴图，alpha test）= 2 次绘制调用，和星星（身体 + 眼镜）一样。
 * 骨骼 = people.js 的 11 根 + 第 12 根“右手手指”（平时缩成 0，比 ✌️ 时伸出食指和中指）。
 * 招牌动作：wave = ✌️ 打招呼；cheer = 右手 ✌️ + 左拳一下一下往上挥（庆祝）；nuli = 两只拳头举过肩“努力！”；salute = 敬礼（见到车站工作人员）；
 *   eat（坐着吃东西，见 food.js）沿用 Person 的 sit 再叠加手臂。
 */
import { Geo, hex, mix } from '../core/geo.js';
import { Person, boneDefs } from '../world/people.js';
const B = window.BABYLON;

export const BROTHER_LOOK = {
  fem: false, kid: true, skin: '#F2D2BA', top: '#F7F7F4', bottom: '#1F2A4E', hair: '#1E1714', shoes: '#8C9399',
  hairStyle: 'side', skirt: false, shorts: true, longSleeve: false, bag: null, bagCol: '#000', glasses: false,
  cap: null, scale: 1.04, uniform: null, phone: false, prop: null, tie: null, collar: false, hunch: 0, role: 'brother', pattern: null
};
const COL = {
  hair: hex('#1E1714'), hairHi: hex('#4A3A30'), hairDark: hex('#120D0B'),
  jersey: hex('#F7F7F4'), jerseyDark: hex('#E2E3E0'), navy: hex('#1F2A4E'), navyHi: hex('#2C3A66'), white: hex('#FAFAFA'),
  clog: hex('#8C9399'), clogSole: hex('#D5D8DB'), hole: hex('#5E646B'), sock: hex('#F4F4F2'),
  lanyard: hex('#F2C230'), lanyardDark: hex('#D9A21C'), watch: hex('#1B1C1F'), watchFace: hex('#33414F'),
  eye: hex('#2A2220'), mouth: hex('#B8463F'), tongue: hex('#E57C74')
};
// 骨骼尺寸：髋高 / 腿长和星星一样（坐姿公式不变），头更大更圆、胸更宽更厚
const D = { hip: 0.6, thigh: 0.31, shin: 0.29, torso: 0.4, uarm: 0.22, farm: 0.2, shoulder: 0.19, hipW: 0.085, head: 0.37, neck: 0.04, chestW: 0.35, chestD: 0.21 };
export const HAND_R = 11;
function defs(L) {
  const d = boneDefs(L);
  d[3].o = [-D.shoulder, D.torso - 0.06, 0]; d[4].o = [D.shoulder, D.torso - 0.06, 0]; d[7].o = [-D.hipW, 0, 0]; d[8].o = [D.hipW, 0, 0];
  d[2].o = [0, D.torso, 0];
  d.push({ n: 'fingersR', p: 6, o: [0, -D.farm - 0.05, 0.005] });
  return d;
}
const smooth = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const wrap = a => Math.atan2(Math.sin(a), Math.cos(a));
/**
 * 短发发壳（头骨骼局部坐标）：椭球面从头顶往下长到“下沿”——
 *   前面：刘海往他自己的右边（画面左边）斜拨，左高右低、下沿一绺一绺地参差；两侧：鬓角到耳朵上沿（短）；后面：到发际线。
 */
function shortHair(g, hr, hy) {
  const cx = 0, cy = hy + hr * 0.08, cz = -hr * 0.04, Rx = hr * 0.555, Ry = hr * 0.56, Rz = hr * 0.565;
  const edgeY = th => {
    const a = Math.abs(wrap(th));
    // 正前方（|th| < 0.9）：斜刘海，th<0 = 他的右边（-x）低，th>0 高；参差的发尖
    const fringe = hy + hr * (0.16 + 0.13 * smooth(-0.8, 0.8, wrap(th))) - hr * 0.035 * Math.max(0, Math.sin(th * 11 + 0.6));
    const side = hy + hr * 0.04, back = hy - hr * 0.26;
    return fringe + (side - fringe) * smooth(0.7, 1.25, a) + (back - side) * smooth(1.7, 2.7, a);
  };
  const NT = 60, NP = 14, k0 = g.p.length / 3, W = NT + 1;
  const col = (th, f, y) => {
    const strand = 0.95 + 0.05 * Math.sin(th * 38 + f * 5), hi = Math.max(0, 1 - Math.hypot((y - (hy + hr * 0.46)) / (hr * 0.14), wrap(th - 0.5) / 0.8)) * 0.6;
    return mix(COL.hair, COL.hairHi, hi).map(c => c * strand);
  };
  const ring = [];
  for (let j = 0; j <= NP; j++) for (let i = 0; i <= NT; i++) {
    const th = i / NT * Math.PI * 2, f = j / NP, pm = Math.acos(Math.max(-1, Math.min(1, (edgeY(th) - cy) / Ry))), ph = pm * f;
    // 头顶蓬一点（tousled）：几个方向鼓起
    const tuft = 1 + 0.06 * Math.max(0, Math.sin(th * 5 + 1)) * Math.sin(f * Math.PI) + 0.05 * Math.pow(f, 2);
    const x = cx + Rx * tuft * Math.sin(ph) * Math.sin(th), y = cy + Ry * (1 + 0.04 * (1 - f)) * Math.cos(ph), z = cz + Rz * tuft * Math.sin(ph) * Math.cos(th);
    const n = new B.Vector3((x - cx) / (Rx * Rx), (y - cy) / (Ry * Ry), (z - cz) / (Rz * Rz)).normalize();
    g.push(x, y, z, n.x, n.y, n.z, col(th, f, y));
    if (j === NP) ring.push([x, y, z]);
  }
  for (let j = 0; j < NP; j++) for (let i = 0; i < NT; i++) { const a = k0 + j * W + i, b = a + W; g.i.push(a, a + 1, b, a + 1, b + 1, b); }
  // 下沿一圈薄厚度（双面）
  const k1 = g.p.length / 3;
  for (const [x, y, z] of ring) g.push(x, y, z, 0, -1, 0, COL.hairDark);
  for (const [x, y, z] of ring) { const dx = x - cx, dz = z - cz, l = Math.hypot(dx, dz) || 1; g.push(x - dx / l * hr * 0.06, y + hr * 0.02, z - dz / l * hr * 0.06, 0, -1, 0, COL.hairDark); }
  for (let i = 0; i < NT; i++) { const a = k1 + i, b = a + W; g.i.push(a, b, a + 1, a + 1, b, b + 1, a, a + 1, b, a + 1, b + 1, b); }
  // 头顶几撮翘起的头发
  for (const [x, z, s, rz] of [[0.02, -0.02, 1, 0.3], [-0.06, 0.05, 0.8, -0.4], [0.07, 0.06, 0.75, 0.6], [-0.02, -0.1, 0.85, -0.2]]) g.ellipsoid(x * hr / 0.37, hy + hr * 0.6, z * hr / 0.37 + cz, hr * 0.16 * s, hr * 0.09 * s, hr * 0.12 * s, COL.hair, 1, 0, 0, rz);
  // 斜刘海的一大绺（从头顶左后扫到右前额）
  g.ellipsoid(-hr * 0.12, hy + hr * 0.3, hr * 0.38, hr * 0.42, hr * 0.12, hr * 0.17, mix(COL.hair, COL.hairHi, 0.25), 2, 0.25, -0.35, 0.32);
}

function parts(L) {
  const d = D, out = [];
  const P = bone => { const g = new Geo(); out.push({ bone, g }); return g; };
  const skin = hex(L.skin);
  // —— 腿：藏青及膝短裤（外侧白条、裤脚白边）+ 小腿 + 白袜 + 灰洞洞鞋 ——
  [[7, 9, -1], [8, 10, 1]].forEach(([t, s, sx]) => {
    const th = P(t);
    th.tubeTaper([0, 0.04, 0], [0, -d.thigh, 0], 0.235, 0.225, COL.navy, 14);
    th.sphere(0, -d.thigh, 0, 0.215, skin, 2);
    th.box(sx * 0.116, -d.thigh * 0.45, 0, 0.012, d.thigh * 1.0, 0.03, COL.white, 0, 0, 0, 1, { ao: false }); // 外侧白条
    const sh = P(s);
    sh.tubeTaper([0, 0.02, 0], [0, -0.06, 0], 0.228, 0.226, COL.navy, 14);                  // 裤腿盖过膝盖
    sh.tubeTaper([0, -0.06, 0], [0, -0.075, 0], 0.232, 0.232, COL.white, 14);               // 裤脚白边
    sh.box(sx * 0.114, -0.02, 0, 0.012, 0.09, 0.03, COL.white, 0, 0, 0, 1, { ao: false });
    sh.tubeTaper([0, -0.06, 0], [0, -d.shin + 0.06, 0], 0.15, 0.115, skin, 10);              // 小腿（肉嘟嘟）
    sh.tubeTaper([0, -d.shin + 0.08, 0], [0, -d.shin + 0.02, 0], 0.122, 0.118, COL.sock, 10); // 白短袜
    const fy = -d.shin - 0.005;
    sh.rbox(0, fy, 0.03, 0.122, 0.032, 0.232, COL.clogSole, 0.05, 0, { ao: false });
    sh.ellipsoid(0, fy + 0.042, 0.07, 0.122, 0.09, 0.18, COL.clog, 2);
    sh.ellipsoid(0, fy + 0.037, -0.02, 0.118, 0.075, 0.14, COL.clog, 2);
    for (const [hx, hz] of [[-0.028, 0.11], [0.028, 0.11], [0, 0.135], [-0.034, 0.065], [0.034, 0.065], [0, 0.088]]) sh.ellipsoid(hx, fy + 0.082 - Math.abs(hz - 0.075) * 0.25, hz, 0.015, 0.008, 0.015, COL.hole, 1);
    sh.tube([-0.06, fy + 0.05, -0.02], [0, fy + 0.06, -0.08], 0.015, COL.clogSole, 5); sh.tube([0.06, fy + 0.05, -0.02], [0, fy + 0.06, -0.08], 0.015, COL.clogSole, 5);
  });
  // —— 髋：短裤腰 ——
  const hp = P(0);
  hp.ellipsoid(0, -0.02, 0, d.chestW * 1.1, 0.24, d.chestD * 1.22, COL.navy, 2);
  // —— 躯干：白球衣（藏青两侧条、藏青肩、藏青 V 领边），肚子圆一点 ——
  const sp = P(1), tr = d.torso;
  sp.tubeTaper([0, -0.05, 0], [0, tr * 0.62, 0], d.chestW * 0.98, d.chestW * 1.0, COL.jersey, 16);
  sp.ellipsoid(0, tr * 0.2, d.chestD * 0.08, d.chestW * 1.0, tr * 0.55, d.chestD * 1.12, COL.jersey, 2); // 小肚子
  sp.ellipsoid(0, tr * 0.66, 0, d.chestW * 1.04, tr * 0.5, d.chestD * 1.12, COL.jersey, 2);
  // 两侧藏青条（贴着身体侧面，从腋下到下摆）
  for (const sx of [-1, 1]) sp.box(sx * d.chestW * 0.5, tr * 0.36, 0, 0.03, tr * 0.86, d.chestD * 0.62, COL.navy, 0, 0, 0, 1, { ao: false });
  // 肩：藏青肩头
  sp.capsule([-d.shoulder * 0.85, tr - 0.07, 0], [d.shoulder * 0.85, tr - 0.07, 0], 0.07, 0.07, COL.jersey, 10);
  for (const sx of [-1, 1]) sp.ellipsoid(sx * d.shoulder * 0.9, tr - 0.065, 0, 0.115, 0.1, 0.13, COL.navy, 2);
  sp.cyl(0, tr - 0.015, 0, 0.13, 0.032, COL.navy, 14); // 领口罗纹
  // 金黄挂绳 + 小黑手表（羊城通）
  // 挂绳短短一圈，小手表挂在领口下面（不挡住胸前的 SUNSHINE 23）
  const wy = tr * 0.74, wz = 0.128;
  for (const sx of [-1, 1]) sp.path([[sx * 0.065, tr - 0.005, 0.03], [sx * 0.07, tr * 0.9, 0.1], [sx * 0.03, wy + 0.03, wz]], 0.011, COL.lanyard, 5);
  sp.rbox(0, wy - 0.05, wz + 0.004, 0.05, 0.058, 0.018, COL.watch, 0.014, 0, { ao: false });
  sp.box(0, wy - 0.021, wz + 0.014, 0.034, 0.036, 0.004, COL.watchFace, 0, 0, 0, 1, { ao: false });
  sp.box(0, wy - 0.014, wz + 0.017, 0.016, 0.005, 0.002, hex('#6FE3C0'), 0, 0, 0, 1, { ao: false });
  // —— 头：大圆脸、胖腮帮、眯眼笑 ——
  const hd = P(2), hr = d.head, hy = d.neck + hr * 0.48;
  hd.tubeTaper([0, -0.02, 0], [0, d.neck + 0.03, 0], 0.1, 0.09, skin, 8);
  hd.ellipsoid(0, hy, 0.005, hr * 1.04, hr * 1.0, hr * 0.98, skin, 5);
  for (const sx of [-1, 1]) hd.ellipsoid(sx * hr * 0.27, hy - hr * 0.16, hr * 0.27, hr * 0.38, hr * 0.34, hr * 0.32, skin, 3); // 胖腮帮
  for (const sx of [-1, 1]) hd.ellipsoid(sx * hr * 0.51, hy - hr * 0.04, -hr * 0.02, hr * 0.12, hr * 0.19, hr * 0.13, mix(skin, hex('#F0A8A0'), 0.25), 1); // 耳朵
  shortHair(hd, hr, hy);
  const fz = hr * 0.49;
  for (const sx of [-1, 1]) {
    // 眯眯笑眼：一道弯弯的“∩”
    const ex = sx * hr * 0.18, ey = hy + hr * 0.03;
    hd.path([[ex - hr * 0.075, ey - hr * 0.012, fz - 0.004], [ex - hr * 0.03, ey + hr * 0.03, fz + 0.003], [ex + hr * 0.03, ey + hr * 0.03, fz + 0.003], [ex + hr * 0.075, ey - hr * 0.012, fz - 0.004]], hr * 0.042, COL.eye, 5);
    hd.box(ex, ey + hr * 0.14, fz - 0.01, hr * 0.15, hr * 0.028, hr * 0.03, COL.hair, 0, 0, sx * -0.1, 1, { ao: false }); // 眉毛
    hd.ellipsoid(sx * hr * 0.32, hy - hr * 0.12, fz - hr * 0.05, hr * 0.13, hr * 0.065, hr * 0.04, mix(skin, hex('#F08A8A'), 0.4), 1); // 腮红
  }
  hd.sphere(0, hy - hr * 0.07, fz + hr * 0.02, hr * 0.075, mix(skin, [0.9, 0.62, 0.55], 0.15), 1); // 圆鼻头
  // 张嘴大笑：上边平、下边圆的嘴 + 舌头
  hd.ellipsoid(0, hy - hr * 0.22, fz - hr * 0.02, hr * 0.2, hr * 0.085, hr * 0.06, COL.mouth, 2);
  hd.ellipsoid(0, hy - hr * 0.245, fz - hr * 0.005, hr * 0.11, hr * 0.04, hr * 0.04, COL.tongue, 1);
  hd.box(0, hy - hr * 0.178, fz + hr * 0.005, hr * 0.2, hr * 0.03, hr * 0.04, skin, 0, 0, 0, 1, { ao: false }); // 上唇压平
  // —— 手臂：藏青短袖（袖口白边）+ 肉肉的手臂 ——
  for (const [u, f] of [[3, 5], [4, 6]]) {
    const ua = P(u);
    ua.capsule([0, 0, 0], [0, -d.uarm * 0.5, 0], 0.08, 0.077, COL.navy, 10);
    ua.tubeTaper([0, -d.uarm * 0.5, 0], [0, -d.uarm * 0.56, 0], 0.16, 0.16, COL.white, 10);
    ua.tubeTaper([0, -d.uarm * 0.5, 0], [0, -d.uarm, 0], 0.1, 0.088, skin, 10); ua.sphere(0, -d.uarm, 0, 0.088, skin, 1);
    const fa = P(f); fa.tubeTaper([0, 0, 0], [0, -d.farm, 0], 0.088, 0.074, skin, 10);
    fa.ellipsoid(0, -d.farm - 0.035, 0.005, 0.085, 0.095, 0.08, skin, 2);
  }
  // 右手手指（✌️：食指 + 中指），平时缩成 0
  const fg = P(HAND_R);
  fg.capsule([0.02, 0, 0.012], [0.034, -0.085, 0.016], 0.012, 0.011, skin, 6);
  fg.capsule([-0.008, 0, 0.012], [-0.02, -0.085, 0.016], 0.012, 0.011, skin, 6);
  fg.capsule([0.004, 0.02, 0.03], [0.0, -0.01, 0.036], 0.013, 0.012, skin, 6);
  return out;
}

/** 球衣字贴图：上半 = 胸前红色“SUNSHINE”（弧形）+ 大号“23”（深色描边），下半 = 背后藏青“23” */
let jerseyTex = null, jerseyMat = null;
function getJerseyMat(scene, paint) {
  if (jerseyMat && jerseyMat.getScene() === scene) return jerseyMat;
  const S = 512, t = jerseyTex = new B.DynamicTexture('jerseyTex', { width: S, height: S }, scene, true);
  const c = t.getContext(); c.fillStyle = '#F7F7F4'; c.fillRect(0, 0, S, S); // 底色 = 球衣白（不透明，和身体同一种 PBR 材质，光照一致）
  const F = '"Arial Black","Helvetica Neue",Arial,sans-serif';
  // 胸前：SUNSHINE（每个字母沿弧排）
  c.textAlign = 'center'; c.textBaseline = 'middle';
  const word = 'SUNSHINE', R = 380, cx = 256, cy = 62 + R;
  c.font = `900 58px ${F}`; c.lineJoin = 'round';
  for (let i = 0; i < word.length; i++) {
    const a = (i - (word.length - 1) / 2) * 0.112;
    c.save(); c.translate(cx + Math.sin(a) * R, cy - Math.cos(a) * R); c.rotate(a);
    c.lineWidth = 10; c.strokeStyle = '#FFFFFF'; c.strokeText(word[i], 0, 0);
    c.lineWidth = 4; c.strokeStyle = '#1F2A4E'; c.strokeText(word[i], 0, 0);
    c.fillStyle = '#D62E2E'; c.fillText(word[i], 0, 0); c.restore();
  }
  c.font = `900 132px ${F}`; c.lineWidth = 14; c.strokeStyle = '#FFFFFF'; c.strokeText('23', 256, 172);
  c.lineWidth = 7; c.strokeStyle = '#1F2A4E'; c.strokeText('23', 256, 172); c.fillStyle = '#D62E2E'; c.fillText('23', 256, 172);
  // 背后：藏青大“23”
  c.font = `900 190px ${F}`; c.lineWidth = 8; c.strokeStyle = '#D62E2E'; c.strokeText('23', 256, 390); c.fillStyle = '#1F2A4E'; c.fillText('23', 256, 390);
  t.hasAlpha = false; t.update(true); t.anisotropicFilteringLevel = 8;
  // 克隆身体用的 paint（PBR + 顶点色），只换上这张贴图：字所在的那一片和衣服其他地方明暗完全一样
  const m = jerseyMat = paint.clone('jerseyMat'); m.albedoTexture = t; m.bumpTexture = null; m.backFaceCulling = false;
  return m;
}
/** 胸前 / 背后贴着躯干圆柱面的弧形小片（脊柱骨骼上），u/v 对应贴图上下两半 */
function jerseyGeo(restSpine) {
  const g = new Geo().withBones(); g.bone = 1;
  const t = new Geo(), uv = [], tr = D.torso, NU = 14, NV = 4;
  // 躯干正面是一个圆柱（半径 = chestW*0.98/2，y 从 -0.05 到 0.62*torso），字贴在圆柱面上、离开 8mm
  const R0 = D.chestW * 0.49 + 0.008;
  const patch = (front, y0, y1, half, v0, v1) => {
    const k = t.p.length / 3;
    for (let j = 0; j <= NV; j++) for (let i = 0; i <= NU; i++) {
      const fu = i / NU, fv = j / NV, y = y0 + (y1 - y0) * fv, a = (fu - 0.5) * 2 * half;
      // 文字从观看者的左往右：正面（法线 +z）u 往 -x 增大，背面（法线 -z）u 往 +x 增大
      const x = Math.sin(a) * R0 * (front ? -1 : 1), z = Math.cos(a) * R0 * (front ? 1 : -1);
      t.push(x, y, z, x / R0, 0, z / R0, [1, 1, 1]);
      uv.push(fu, v0 + (v1 - v0) * fv);
    }
    for (let j = 0; j < NV; j++) for (let i = 0; i < NU; i++) { const a = k + j * (NU + 1) + i, b = a + NU + 1; t.i.push(a, a + 1, b, a + 1, b + 1, b); }
  };
  patch(true, 0.0, tr * 0.62, 0.82, 0.5, 1.0);
  patch(false, 0.0, tr * 0.62, 0.82, 0.0, 0.5);
  t.u = uv;
  g.merge(t, restSpine);
  return g;
}

export class Brother extends Person {
  constructor(scene, mat, opts = {}) {
    super(scene, mat, { ...BROTHER_LOOK }, { name: opts.name || 'brother', build: { defs, parts } });
    const restSpine = B.Matrix.Translation(0, D.hip + 0.02, 0);
    const jm = this.jersey = jerseyGeo(restSpine).toMesh('brotherJersey', scene, getJerseyMat(scene, mat));
    jm.skeleton = this.skeleton; jm.numBoneInfluencers = 1; jm.parent = this.mesh;
    this.kind = 'mingming';
    this.fingers(0);
  }
  fingers(k) { const s = Math.max(0.001, k); this._b[HAND_R].setScale(new B.Vector3(s, s, s)); this.fingerK = k; }
  vsign(t) { const w = Math.sin(t * 7) * 0.1; this.setBone(4, -0.25, 0, 1.05); this.setBone(6, -0.2, 0.25, 2.25 + w); this.fingers(1); }
  animate(dt, o = {}) {
    const mode = o.mode || this.mode;
    if (!['wave', 'cheer', 'salute', 'nuli', 'vsign'].includes(mode)) { if (this.fingerK) this.fingers(0); return super.animate(dt, o); }
    super.animate(dt, { ...o, mode: 'idle' });
    const t = this.t;
    if (mode === 'wave' || mode === 'vsign') {
      // ✌️ 打招呼：右手举到脸旁比 V，手腕轻轻晃，头微微歪
      this.vsign(t); this.setBone(2, 0.02, this.lookYaw * 0.3, -0.1);
    } else if (mode === 'cheer') {
      // 庆祝：右手 ✌️ 举高 + 左拳在肩上一下一下往上挥，身体跟着一颠
      const pump = Math.max(0, Math.sin(t * 9)), b = pump * 0.1;
      this.setBone(4, -0.15, 0, 2.3); this.setBone(6, 0, 0.3, 0.6 + Math.sin(t * 7) * 0.08); this.fingers(1);
      this.setBone(3, 0, 0, -1.5 - pump * 0.55); this.setBone(5, 0, 0, -1.6 + pump * 0.5);
      this.setBone(7, 0, 0, -0.18); this.setBone(8, 0, 0, 0.18);
      this.setBone(2, -0.14, 0, 0.12); this.hipBob = -0.02 + b * 0.3;
    } else if (mode === 'nuli') {
      // “努力！”：两只拳头举过肩（照片 4-nuli）
      const b = Math.abs(Math.sin(t * 5)) * 0.12;
      this.setBone(3, 0, 0, -1.7 - b); this.setBone(4, 0, 0, 1.7 + b); this.setBone(5, 0, 0, -1.45); this.setBone(6, 0, 0, 1.45);
      this.setBone(7, 0, 0, -0.28); this.setBone(8, 0, 0, 0.28); this.setBone(9, 0, 0, 0.1); this.setBone(10, 0, 0, -0.1);
      this.setBone(2, -0.12, 0, Math.sin(t * 2.5) * 0.08); this.fingers(0); this.hipBob = -0.03;
    } else {
      // 敬礼：站直，右手指尖并拢碰到右眉（照片 5-salute）
      this.setBone(4, 0, 0.35, 2.2); this.setBone(6, 0, 0, 1.75); this.fingers(0);
      this.setBone(3, 0, 0, 0.04); this.setBone(5, -0.05, 0, 0); this.setBone(2, -0.06, 0, 0); this.setBone(1, -0.03, 0, 0);
    }
  }
  dispose() { this.jersey.dispose(); super.dispose(); }
}
