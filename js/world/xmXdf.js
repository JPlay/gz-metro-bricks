/*
 * 育秀东路站 3 号出口：育秀中心街面（新东方墨绿底白字招牌 + 橙色标语）+ 门口烤肠小铺 + 等孩子的家长；
 * 走进正门单独加载：一楼门厅（楼梯上二楼）+ 二楼新东方校区（前台、等候区家长、教室里老师上课）。
 * 真实校区：思明区湖滨北路育秀里 36 号育秀中心 2 层（体育中心旁）；小美指定 3 号口最近。
 * 招牌色：新东方绿 #026A60 底、白字「新东方」、橙 #F6AB04 标语（2026 新标「伴你成长，共赴美好」）。
 * 坐标同 xmStreet：出口亭在原点，玩家往 +z 走出来；路在北边 z −22..−8。
 */
import { Geo, hex } from '../core/geo.js';
import * as D from './decor.js';
import { Kit, bucketMat } from './kit.js';
import { FoodAtlas } from '../game/food-art.js';
import { textPaint, facadePaint } from './xmStreet.js';
import { bakePerson, randomLook, archetypeLook, preseed, prnd as prnd01, POSES } from './people.js';

const FONT = '"PingFang SC","Hiragino Sans GB","Noto Sans CJK SC","Microsoft YaHei",sans-serif';
const FONT_EN = '"Helvetica Neue",Arial,sans-serif';

export const XDF_GREEN = '#026A60';
const XDF_GREEN_DK = '#01504A';
export const XDF_ORANGE = '#F6AB04';
const SAUSAGE_RED = '#D7261E';

/** 站着看手机（双臂抬到胸前） */
const STAND_PHONE = { 3: [0, 0, 0.08], 4: [-0.35, 0, -0.15], 5: [-0.15, 0, 0], 6: [-1.5, 0.3, 0], 2: [0.35, 0, 0] };
/** 老师：右臂抬起指向白板 */
const TEACH = { 3: [0, 0, 0.08], 4: [-1.25, 0, -0.35], 5: [-0.15, 0, 0], 6: [-0.3, 0, 0] };
const STAND = POSES.stand, SIT = POSES.sit, SIT_PHONE = POSES.sitPhone;
/** 坐姿：座面高 seat → 骨盆 y */
const sitY = (seat, L) => seat - (L.kid ? 0.6 : 0.86) * L.scale;
/** 家长外形：便装 / 阿婆 / 上班族随机 */
function parentLook(i, o = {}) {
  if (i % 5 === 3) return archetypeLook('granny');
  if (i % 5 === 1) return randomLook({ ...{ collar: true, top: '#F4F6F8', bottom: '#2E3440', bag: null }, ...o });
  return randomLook({ bag: i % 2 ? 'shoulder' : null, ...o });
}

/**
 * 新东方招牌画法：墨绿底、白色粗体斜「新东方」、下方一行橙色标语（2026 新标），可选英文副标。
 * lines：['伴你成长，共赴美好'] 等；small 时字号略小（用于室内）
 */
export function xdfBrand({ slogan = '伴你成长，共赴美好', en = null, border = true } = {}) {
  return (c, pw, ph) => {
    c.fillStyle = XDF_GREEN; c.fillRect(0, 0, pw, ph);
    if (border) { c.fillStyle = XDF_GREEN_DK; c.fillRect(0, 0, pw, ph * 0.06); c.fillRect(0, ph * 0.94, pw, ph * 0.06); }
    c.textAlign = 'center'; c.textBaseline = 'middle';
    const big = Math.min(ph * (slogan ? 0.5 : 0.62), pw / 3.6);
    c.save(); c.translate(pw / 2, ph * (slogan ? 0.38 : 0.48)); c.transform(1, 0, -0.2, 1, 0, 0);   // 新标白字右斜
    c.fillStyle = '#FFFFFF'; c.font = `italic 900 ${big}px ${FONT}`; c.fillText('新东方', 0, 0); c.restore();
    if (slogan) { c.fillStyle = XDF_ORANGE; c.font = `700 ${Math.min(ph * 0.17, pw / 11)}px ${FONT}`; c.fillText(slogan, pw / 2, ph * 0.78); }
    if (en) { c.fillStyle = '#CFE6E2'; c.font = `600 ${ph * 0.1}px ${FONT_EN}`; c.fillText(en, pw / 2, ph * 0.9); }
  };
}

/** 门口烤肠小铺：红底白字「烤肠」+ 玻璃柜里转动的烤肠机 + 摊主（无店名） */
function sausageShop(S, x0, x1, z0, z1) {
  const k = S.kit, P = k.solid, A = S.atlas, cx = (x0 + x1) / 2;
  const red = hex(SAUSAGE_RED), white = hex('#F4F2EE'), steel = hex('#B8BEC4');
  // 小亭子：两侧白墙 + 顶 + 后墙贴着楼面
  P.slab(x0, x0 + 0.12, 0, 2.9, z0, z1, white, { ao: false }); P.slab(x1 - 0.12, x1, 0, 2.9, z0, z1, white, { ao: false });
  P.slab(x0, x1, 0, 2.9, z1 - 0.12, z1, white, { ao: false });
  P.slab(x0 - 0.1, x1 + 0.1, 2.9, 3.05, z0 - 0.35, z1, white, { ao: false });
  k.colSlab(x0, x1, 0, 3.05, z0, z1);
  // 红色招牌（朝街）：红底白字「烤肠」
  P.slab(x0 - 0.1, x1 + 0.1, 3.05, 3.85, z0 - 0.36, z0 - 0.2, red, { ao: false });
  A.quad(cx, 3.45, z0 - 0.37, x1 - x0 + 0.1, 0.74, 0, A.draw(x1 - x0 + 0.1, 0.74, (c, pw, ph) => {
    c.fillStyle = SAUSAGE_RED; c.fillRect(0, 0, pw, ph);
    c.fillStyle = '#FFFFFF'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.font = `900 ${ph * 0.72}px ${FONT}`; c.fillText('烤 肠', pw / 2, ph * 0.54);
  }));
  // 柜台 + 红色围挡
  P.slab(x0 + 0.12, x1 - 0.12, 0, 1.0, z0, z0 + 0.7, white, { ao: false });
  P.slab(x0 + 0.12, x1 - 0.12, 0.15, 0.85, z0 - 0.01, z0 + 0.02, red, { ao: false });
  k.metal.slab(x0 + 0.1, x1 - 0.1, 1.0, 1.04, z0 - 0.04, z0 + 0.72, steel, { ao: false });
  // 玻璃柜
  const gx0 = cx - 0.75, gx1 = cx + 0.75, gz0 = z0 + 0.08, gz1 = z0 + 0.62, gy0 = 1.04, gy1 = 1.52;
  k.metal.slab(gx0, gx1, gy0, gy0 + 0.06, gz0, gz1, hex('#5A6068'), { ao: false });
  k.glass.slab(gx0, gx1, gy0 + 0.06, gy1, gz0, gz0 + 0.01, hex('#E6F4FA'), { ao: false });
  k.glass.slab(gx0, gx1, gy1 - 0.01, gy1, gz0, gz1, hex('#E6F4FA'), { ao: false });
  for (const x of [gx0, gx1 - 0.01]) k.glass.slab(x, x + 0.01, gy0 + 0.06, gy1, gz0, gz1, hex('#E6F4FA'), { ao: false });
  k.metal.slab(gx0, gx1, gy1, gy1 + 0.03, gz0, gz1, steel, { ao: false });
  k.glow.slab(gx0 + 0.05, gx1 - 0.05, gy1 - 0.03, gy1 - 0.015, gz0 + 0.1, gz1 - 0.1, hex('#FFC873'), { ao: false });   // 柜内暖灯
  // 转动的辊子 + 烤肠：各一个网格 + 实例，tick 里绕自身轴转
  const RL = 1.36, ry = gy0 + 0.1, nR = 5, dz = (gz1 - gz0 - 0.12) / (nR - 1), rz0 = gz0 + 0.06;
  const rg = new Geo(); rg.cyl(0, 0, 0, 0.03, RL, steel, 8, 0, 0, Math.PI / 2);
  rg.box(0, 0.011, 0, RL, 0.006, 0.006, hex('#6A7078'));   // 一条暗线，转起来看得出
  const sg = new Geo(); sg.capsule([-0.085, 0, 0], [0.085, 0, 0], 0.026, 0.026, hex('#B4472A'), 8);
  for (let i = 0; i < 3; i++) sg.box(-0.06 + i * 0.06, 0.023, 0, 0.014, 0.008, 0.03, hex('#6E2410'));   // 烤痕
  const roller = animMesh(S, rg, 'xdfRoller', 'metal'), sau = animMesh(S, sg, 'xdfSausage');
  const rolls = [roller], saus = [sau];
  for (let i = 0; i < nR; i++) {
    const m = i ? roller.createInstance('xdfRoller' + i) : roller; if (i) { m.parent = k.root; rolls.push(m); }
    m.position.set(cx, ry, rz0 + i * dz);
  }
  let n = 0;
  for (let i = 0; i < nR - 1; i += 2) for (let j = 0; j < 5; j++) {   // 隔一条槽放一排，看得出是一根根

    const m = n ? sau.createInstance('xdfSausage' + n) : sau; if (n) { m.parent = k.root; saus.push(m); }
    m.position.set(cx - RL / 2 + 0.17 + j * 0.255, ry + 0.032, rz0 + (i + 0.5) * dz); m.rotation.x = n * 0.7; n++;
  }
  // 签子筒 + 价目牌
  P.cyl(gx1 + 0.22, 1.14, z0 + 0.3, 0.14, 0.2, hex('#E8E0D0'), 8);
  for (let i = 0; i < 6; i++) P.box(gx1 + 0.2 + (i % 3) * 0.02, 1.32, z0 + 0.28 + (i >> 1) * 0.015, 0.006, 0.22, 0.006, hex('#D9C08A'));
  A.quad(gx0 - 0.28, 1.25, z0 + 0.32, 0.36, 0.42, 0, A.draw(0.36, 0.42, textPaint(['3元/根', '4元/根'], { bg: '#FFF4D6', fg: SAUSAGE_RED })));
  // 摊主：白帽白衣，站在柜台后
  preseed(7101);
  bakePerson(P, cx + 0.2, 0, z0 + 1.25, Math.PI, randomLook({ top: '#F4F4F2', bottom: '#2E3440', cap: true, capCol: '#FFFFFF', bag: null, glasses: false, kid: false, scale: 1.0 }), STAND);
  // 买烤肠的小朋友 + 家长
  bakePerson(P, cx - 0.5, 0, z0 - 0.75, 0, randomLook({ kid: true, bag: 'backpack', bagCol: '#E8505B', scale: 1 }), STAND);
  bakePerson(P, cx + 0.3, 0, z0 - 0.95, -0.3, parentLook(2), STAND_PHONE);
  let t = 0;
  S.tick = dt => { t += dt; for (const m of rolls) m.rotation.x = t * 2.4; for (let i = 0; i < saus.length; i++) saus[i].rotation.x = -t * 4.2 + i * 0.7; };
}
function animMesh(S, g, name, bucket = 'paint') { const m = g.toMesh(name, S.scene, bucketMat(S.scene, S.kit.M, bucket), S.kit.root); m.receiveShadows = false; (S.anim || (S.anim = [])).push(m); return m; }

/** 街面：育秀中心立面 + 墨绿底「新东方」招牌 + 烤肠小铺 + 门口家长；正门敞开，走进去进门厅 */
export function yuxiuXdf(S) {
  const k = S.kit, P = k.solid, A = S.atlas, GR = k.g('granite');
  S.road(-160, 160, -22, -8, true, '湖滨北路');
  for (let x = -150; x <= 150; x += 12) if (Math.abs(x) > 6) S.lightTree(x, -6.2, 0.8);
  for (const x of [-8, 8]) D.lamp(k, x, 0, -6.6, Math.PI);
  GR.slab(-60, 60, 0.005, 0.03, -6, 28, hex('#D2CCBF'), { ao: false });

  // 育秀中心：八层米色瓷砖楼（商业综合体），正门朝 −z（对着出口亭）
  const X0 = -28, X1 = 28, Z0 = 28, Z1 = 58, H = 28;
  const long = facadePaint({ floors: 8, bays: 12, wall: '#E8E0D4', band: '#F4F0EA', glass: '#7FA3B8', frame: '#F8F6F2', grille: true, ground: (c, x, y, w, h) => {
    c.fillStyle = '#D8D0C4'; c.fillRect(x, y, w, h);
    c.fillStyle = '#9FB8C8';
    for (let i = 0; i < 10; i++) {
      const gx = x + w * (0.04 + i * 0.096), gw = w * 0.07;
      if (Math.abs(gx + gw / 2 - (x + w / 2)) < w * 0.08) continue;   // 正门开洞
      c.fillRect(gx, y + h * 0.18, gw, h * 0.62);
      c.fillStyle = '#F4F2EE'; c.fillRect(gx - 2, y + h * 0.16, gw + 4, 3); c.fillStyle = '#9FB8C8';
    }
    // 正门玻璃
    c.fillStyle = '#B8D4E6'; c.fillRect(x + w * 0.42, y + h * 0.08, w * 0.16, h * 0.84);
    c.fillStyle = XDF_GREEN; c.fillRect(x + w * 0.42, y + h * 0.08, w * 0.16, h * 0.12);
    c.fillStyle = '#FFFFFF'; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.font = `italic 900 ${h * 0.08}px ${FONT}`; c.fillText('新东方 2F', x + w / 2, y + h * 0.14);
    c.fillStyle = XDF_ORANGE; c.fillRect(x + w * 0.42, y + h * 0.2, w * 0.16, h * 0.012);
  }});
  const end = facadePaint({ floors: 8, bays: 5, wall: '#E8E0D4', band: '#F4F0EA', glass: '#7FA3B8', frame: '#F8F6F2', grille: true });
  // 二层以上实心；一层两侧实墙 + 正门开口（中间 6 m）
  P.slab(X0, X1, 4.2, H, Z0 + 0.4, Z1, hex('#E8E0D4'), { ao: false });
  A.quad(0, 4.2 + (H - 4.2) / 2, Z0 + 0.37, X1 - X0, H - 4.2, 0, A.draw(X1 - X0, H - 4.2, long));
  P.slab(X0 - 0.4, X1 + 0.4, H, H + 0.5, Z0, Z1 + 0.4, hex('#F1EEE8'), { ao: false });
  // 一层侧墙 / 后墙
  P.slab(X0, X0 + 0.45, 0, 4.2, Z0, Z1, hex('#E8E0D4'), { ao: false });
  P.slab(X1 - 0.45, X1, 0, 4.2, Z0, Z1, hex('#E8E0D4'), { ao: false });
  P.slab(X0, X1, 0, 4.2, Z1 - 0.45, Z1, hex('#EDE8DE'), { ao: false });
  k.colSlab(X0, X0 + 0.45, 0, 4.2, Z0, Z1); k.colSlab(X1 - 0.45, X1, 0, 4.2, Z0, Z1); k.colSlab(X0, X1, 0, 4.2, Z1 - 0.45, Z1);
  // 一层正面玻璃（正门开口两侧）+ 门柱
  for (const [a, b] of [[X0, -3], [3, X1]]) {
    k.glass.slab(a, b, 0.05, 4.0, Z0 + 0.35, Z0 + 0.45, hex('#D6EEF8'));
    k.colSlab(a, b, 0, 4.2, Z0 + 0.25, Z0 + 0.55);
  }
  for (const x of [-3.1, 3.1]) { P.slab(x - 0.18, x + 0.18, 0, 4.2, Z0 + 0.2, Z0 + 0.55, hex('#C9C2B6'), { ao: false }); k.colSlab(x - 0.18, x + 0.18, 0, 4.2, Z0 + 0.2, Z0 + 0.55); }
  k.metal.slab(X0, X1, 4.0, 4.25, Z0 + 0.25, Z0 + 0.55, hex('#3A4652'), { ao: false });
  // 端面贴图（侧墙）
  A.quad(X0 - 0.03, H / 2, (Z0 + Z1) / 2, Z1 - Z0, H, -Math.PI / 2, A.draw(Z1 - Z0, H, end));
  A.quad(X1 + 0.03, H / 2, (Z0 + Z1) / 2, Z1 - Z0, H, Math.PI / 2, A.draw(Z1 - Z0, H, end));

  // 楼顶新东方大招牌：墨绿底、白色斜体「新东方」、橙色标语「伴你成长，共赴美好」（2026 新标；老店多是橙色 XDF.CN）
  P.slab(-14, 14, H + 0.5, H + 4.6, Z0 + 0.15, Z0 + 0.7, hex(XDF_GREEN), { ao: false });
  A.quad(0, H + 2.55, Z0 + 0.12, 28, 4.0, 0, A.draw(28, 4.0, xdfBrand({ slogan: '伴你成长，共赴美好' })));
  A.quad(0, 3.5, Z0 + 0.32, 10, 0.7, 0, A.draw(10, 0.7, textPaint(['育秀中心', 'YUXIU CENTER'], { bg: '#5A5248', fg: '#F6E8C8' })));
  // 正门上方灯箱（街面近距离可见）：同款墨绿 + 白字 + 橙标语，注明校区在二楼
  P.slab(-5.5, 5.5, 4.3, 6.1, Z0 + 0.15, Z0 + 0.65, hex(XDF_GREEN), { ao: false });
  A.quad(0, 5.2, Z0 + 0.12, 11, 1.7, 0, A.draw(11, 1.7, xdfBrand({ slogan: '育秀校区 · 2楼  伴你成长，共赴美好' })));

  // 一层门厅天花 / 浅色地面（街面这段只做门廊感；真正大厅单独加载）
  P.slab(X0 + 0.5, X1 - 0.5, 4.05, 4.2, Z0 + 0.5, Z1 - 0.5, hex('#F4F0EA'), { ao: false });
  GR.slab(-3, 3, 0.005, 0.025, Z0 - 4, Z0 + 0.5, hex('#DAD2C3'), { ao: false });

  // 门前广场：树、长椅、路牌
  for (const x of [-22, -12, 12, 22]) S.lightTree(x, 18, 0.9, 1);
  for (const [x, r] of [[-16, 0], [16, 0]]) D.bench(k, x, 0, 16, r);
  A.quad(-10, 2.4, 8, 0.08, 1.6, Math.PI / 2, A.draw(0.08, 1.6, (c, pw, ph) => {
    c.fillStyle = '#2F6FB5'; c.fillRect(0, 0, pw, ph);
    c.fillStyle = '#FFFFFF'; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.font = `700 ${Math.min(pw, ph) * 0.55}px ${FONT}`;
    [...'育秀中心'].forEach((ch, i) => c.fillText(ch, pw / 2, ph * (0.18 + i * 0.16)));
  }));
  k.metal.cyl(-10, 1.1, 8, 0.06, 2.2, hex('#6E767E'), 6);

  // 门口：烤肠小铺（正门左手边）+ 等孩子下课的家长
  sausageShop(S, -8.9, -5.3, 24.4, 28.2);
  preseed(7202);
  [[2.4, 25.6, 0.4, 0], [3.6, 24.4, -0.6, 1], [5.2, 25.8, -1.2, 2], [-3.6, 23.6, 0.6, 3], [1.0, 22.6, 0.1, 4], [6.6, 23.9, -0.9, 5]]
    .forEach(([x, z, r, i]) => bakePerson(P, x, 0, z, r, parentLook(i, { phone: i % 2 === 0 }), i % 2 === 0 ? STAND_PHONE : STAND));

  S.filler([[-90, 50, 40, 40, 36, '#C9C2B6'], [90, 48, 40, 40, 42, '#BFB6A8'], [-70, -44, 50, 16, 28, '#D2CABE'], [40, -44, 50, 16, 32, '#C6BEB1'], [0, 120, 100, 30, 24, '#CDC5B8']]);

  // 走进正门 → 单独加载大厅（门洞中心 z≈Z0+0.4）
  S.enterDoor = { x: 0, z: Z0 + 0.35, halfW: 1.4, zLo: -0.35, zHi: 0.7, make: (scene, o) => new XdfLobby(scene, o), outYaw: Math.PI, outDz: -1.8, id: 'xdf' };
}

/* ====================== 育秀中心门厅 + 二楼新东方校区（单独加载） ====================== */
/**
 * 局部坐标：原点在门内侧，门朝 −z 出楼（与 Xinli256 一致）。
 * 一楼（y 0）：门厅、保安台、楼层指引、直跑楼梯（x 5..7，z 2.5→10.3）上到二楼。
 * 二楼（y FY）：西侧两间教室（玻璃隔断，老师站在白板前、学生坐着上课），北侧前台 + 品牌墙，西北角等候区（家长坐沙发）。
 */
const FY = 4.2, H2 = 7.6;
export class XdfLobby {
  constructor(scene, origin) {
    this.id = 'xdf';
    const k = this.kit = new Kit(scene, 'xdfLobby'); k.root.position.set(origin.x, origin.y, origin.z); this.o = origin;
    this.atlas = new FoodAtlas(scene, 1024);
    const P = k.solid, A = this.atlas, WD = k.g('paint@wood');
    const wall = hex('#F4F1EA'), green = hex(XDF_GREEN), orange = hex(XDF_ORANGE), wood = hex('#C9A77C');
    const X0 = -10, X1 = 10, Z0 = -1.4, Z1 = 20, F1Z = 12;   // 一楼门厅只到 z 12
    const SX0 = 5, SX1 = 7, SZ0 = 2.5, SZ1 = 10.3;          // 楼梯
    preseed(8301);

    // ---------- 壳体 ----------
    k.floorWithHoles(X0, X1, Z0, F1Z, -0.15, 0, hex('#D8D2C4'), [], true, 'granite');   // 不用 floor 桶（带黄色导盲条纹理）
    k.floorWithHoles(X0, X1, Z0, Z1, FY - 0.2, FY, hex('#E3D9C8'), [[SX0 - 0.1, SX1 + 0.1, SZ0, SZ1]], true, 'granite');
    P.slab(X0, X1, H2 - 0.12, H2, Z0, Z1, hex('#F7F5F0'), { ao: false });
    P.slab(X0, X0 + 0.2, 0, H2, Z0, Z1, wall, { ao: false }); k.colSlab(X0, X0 + 0.2, 0, H2, Z0, Z1);
    P.slab(X1 - 0.2, X1, 0, H2, Z0, Z1, wall, { ao: false }); k.colSlab(X1 - 0.2, X1, 0, H2, Z0, Z1);
    P.slab(X0, X1, FY, H2, Z1 - 0.2, Z1, wall, { ao: false }); k.colSlab(X0, X1, FY, H2, Z1 - 0.2, Z1);
    P.slab(X0, X1, 0, FY - 0.2, F1Z, F1Z + 0.2, wall, { ao: false }); k.colSlab(X0, X1, 0, FY - 0.2, F1Z, F1Z + 0.2);   // 一楼北墙（电梯厅墙）
    // 南墙：一楼门洞 ±1.2，二楼整面墙 + 窗
    for (const [a, b] of [[X0, -1.2], [1.2, X1]]) { P.slab(a, b, 0, FY, Z0 - 0.05, Z0 + 0.15, wall, { ao: false }); k.colSlab(a, b, 0, FY, Z0 - 0.05, Z0 + 0.15); }
    P.slab(-1.2, 1.2, 2.3, FY, Z0 - 0.05, Z0 + 0.15, wall, { ao: false });
    P.slab(X0, X1, FY, H2, Z0 - 0.05, Z0 + 0.15, wall, { ao: false }); k.colSlab(X0, X1, FY, H2, Z0 - 0.05, Z0 + 0.15);
    for (const x of [-7, 2, 8]) k.glass.slab(x - 1.1, x + 1.1, FY + 1.0, FY + 2.6, Z0 + 0.16, Z0 + 0.18, hex('#CFE6F2'), { ao: false });
    // 门外一小块地面 + 天光
    k.floorWithHoles(-3, 3, -5, Z0, -0.15, 0, hex('#8E8A82'), [], true, 'pave');
    k.glow.slab(-3, 3, 0, 3.2, -5.05, -5.0, hex('#DDE8F0'), { ao: false });
    k.colSlab(-3.1, 3.1, 0, 3.2, -5.2, -5.0); k.colSlab(-3.1, -3, 0, 3.2, -5, Z0); k.colSlab(3, 3.1, 0, 3.2, -5, Z0);

    // ---------- 一楼门厅 ----------
    k.stairs('z', SZ0, 0, SZ1, FY, SX0, SX1, 0, '#CFC8BA', { rails: true });
    // 二楼楼梯井护栏（北端是楼梯口，敞开）
    k.rail(SX0 - 0.15, SZ0 - 0.05, SX0 - 0.15, SZ1, FY); k.rail(SX1 + 0.15, SZ0 - 0.05, SX1 + 0.15, SZ1, FY); k.rail(SX0 - 0.15, SZ0 - 0.05, SX1 + 0.15, SZ0 - 0.05, FY);
    // 楼梯旁墙上：新东方 二楼（不画箭头）
    P.slab(X1 - 0.24, X1 - 0.2, 1.6, 3.0, 3.4, 7.4, green, { ao: false });
    A.quad(X1 - 0.25, 2.3, 5.4, 4.0, 1.4, -Math.PI / 2, A.draw(4.0, 1.4, xdfBrand({ slogan: '育秀校区 · 2楼' })));
    // 楼层指引（西墙）
    A.quad(X0 + 0.21, 1.7, 3.0, 1.6, 2.0, Math.PI / 2, A.draw(1.6, 2.0, (c, pw, ph) => {
      c.fillStyle = '#4E4A44'; c.fillRect(0, 0, pw, ph); c.textAlign = 'left'; c.textBaseline = 'middle';
      c.fillStyle = '#F6E8C8'; c.font = `800 ${ph * 0.09}px ${FONT}`; c.fillText('育秀中心 楼层指引', pw * 0.08, ph * 0.1);
      [['8F', '写字楼'], ['3F–7F', '写字楼'], ['2F', '新东方育秀校区'], ['1F', '门厅 · 保安室']].forEach(([f, t], i) => {
        const y = ph * (0.3 + i * 0.17);
        if (f === '2F') { c.fillStyle = XDF_GREEN; c.fillRect(pw * 0.04, y - ph * 0.07, pw * 0.92, ph * 0.14); }
        c.fillStyle = f === '2F' ? XDF_ORANGE : '#FFFFFF'; c.font = `800 ${ph * 0.075}px ${FONT_EN}`; c.fillText(f, pw * 0.08, y);
        c.fillStyle = '#FFFFFF'; c.font = `600 ${ph * 0.07}px ${FONT}`; c.fillText(t, pw * 0.36, y);
      });
    }));
    // 保安台 + 保安
    WD.slab(-8.2, -6.2, 0, 1.05, 6.2, 7.0, hex('#8A6A4A'), { ao: false }); k.colSlab(-8.2, -6.2, 0, 1.05, 6.2, 7.0);
    bakePerson(P, -7.2, 0, 7.6, Math.PI, randomLook({ top: '#2B3A55', bottom: '#2B3A55', cap: true, capCol: '#1E2A40', bag: null, fem: false, collar: true, scale: 1.0 }), STAND);
    // 电梯门（北墙，装饰）
    for (const x of [-4.5, -2.0]) { P.slab(x - 0.8, x + 0.8, 0, 2.3, F1Z - 0.04, F1Z, hex('#B4BBC2'), { ao: false }); P.slab(x - 0.01, x + 0.01, 0, 2.3, F1Z - 0.05, F1Z, hex('#7E868E'), { ao: false }); P.slab(x - 1.0, x + 1.0, 2.3, 2.6, F1Z - 0.05, F1Z, hex('#6E767E'), { ao: false }); }
    // 门厅长椅 + 一位等着的家长
    P.slab(-4.6, -1.8, 0.4, 0.46, 8.6, 9.1, wood, { ao: false }); P.slab(-4.5, -1.9, 0, 0.4, 8.7, 9.0, hex('#6E767E'), { ao: false }); k.colSlab(-4.6, -1.8, 0, 0.46, 8.6, 9.1);
    { const L = parentLook(4, { phone: true }); bakePerson(P, -3.6, sitY(0.46, L), 8.85, Math.PI, L, SIT_PHONE); }
    for (const z of [3, 8]) k.glow.slab(-5, 3, FY - 0.24, FY - 0.2, z - 0.3, z + 0.3, hex('#FFF6E0'), { ao: false });

    // ---------- 二楼：教室 ×2（西侧） ----------
    const CX0 = X0, CX1 = -3.6;
    P.slab(CX0, CX1, FY, H2, 6.34, 6.46, wall, { ao: false }); k.colSlab(CX0, CX1, FY, H2, 6.34, 6.46);
    P.slab(CX0, CX1, FY, H2, 14.14, 14.26, wall, { ao: false }); k.colSlab(CX0, CX1, FY, H2, 14.14, 14.26);
    const rooms = [{ z0: Z0 + 0.15, z1: 6.34, n: '201', t: '少儿英语', board: ['Unit 3  My School', 'This is my classroom.', 'Hello! How are you?'] },
                   { z0: 6.46, z1: 14.14, n: '202', t: '初中数学', board: ['分数加减', '1/2 + 1/3 = 5/6', '3/4 − 1/8 = ?'] }];
    rooms.forEach((r, ri) => {
      const zc = (r.z0 + r.z1) / 2, d0 = r.z1 - 1.6, d1 = r.z1 - 0.6;   // 门在教室后部
      // 走廊侧隔断：下实上玻璃，门洞可进
      for (const [a, b] of [[r.z0, d0], [d1, r.z1]]) {
        P.slab(CX1 - 0.06, CX1 + 0.06, FY, FY + 0.9, a, b, wall, { ao: false });
        k.glass.slab(CX1 - 0.02, CX1 + 0.02, FY + 0.9, FY + 2.5, a, b, hex('#DCEFF6'), { ao: false });
        k.colSlab(CX1 - 0.08, CX1 + 0.08, FY, FY + 2.5, a, b);
      }
      P.slab(CX1 - 0.06, CX1 + 0.06, FY + 2.5, H2, r.z0, r.z1, wall, { ao: false });
      WD.slab(CX1 - 0.04, CX1 + 0.04, FY, FY + 2.2, d0 - 0.9, d0, hex('#B88A5A'), { ao: false });   // 开着的门扇（贴墙）
      P.slab(CX1 + 0.07, CX1 + 0.09, FY + 2.3, FY + 2.5, d0 - 0.2, d1 + 0.2, green, { ao: false });
      A.quad(CX1 + 0.1, FY + 2.4, (d0 + d1) / 2, 1.3, 0.2, Math.PI / 2, A.draw(1.3, 0.2, textPaint([`${r.n}  ${r.t}`], { bg: XDF_GREEN, fg: '#FFFFFF' })));
      // 白板（西墙）
      P.slab(X0 + 0.2, X0 + 0.26, FY + 0.85, FY + 2.15, zc - 1.9, zc + 1.9, hex('#9AA2AA'), { ao: false });
      A.quad(X0 + 0.27, FY + 1.5, zc, 3.7, 1.2, Math.PI / 2, A.draw(3.7, 1.2, (c, pw, ph) => {
        c.fillStyle = '#FBFBF8'; c.fillRect(0, 0, pw, ph); c.textAlign = 'left'; c.textBaseline = 'middle';
        r.board.forEach((t, i) => { c.fillStyle = i ? '#1F3F8A' : '#C62828'; c.font = `${i ? 600 : 800} ${ph * (i ? 0.15 : 0.17)}px ${FONT}`; c.fillText(t, pw * 0.06, ph * (0.2 + i * 0.28)); });
      }));
      WD.slab(X0 + 1.1, X0 + 1.7, FY, FY + 1.05, zc - 2.5, zc - 1.7, hex('#8A6A4A'), { ao: false }); k.colSlab(X0 + 1.1, X0 + 1.7, FY, FY + 1.05, zc - 2.5, zc - 1.7);   // 讲台
      // 老师：站在白板旁，面向学生，抬手讲解
      const T = randomLook({ kid: false, bag: null, collar: ri === 1, top: ri ? '#F4F6F8' : '#E86A5A', bottom: '#2E3440', glasses: ri === 1, scale: 1.0 });
      bakePerson(P, X0 + 1.0, FY, zc + 0.3, Math.PI / 2 - 0.35, T, TEACH);
      // 学生：2 列 × 3 排，面向白板（−x）
      for (const sx of [-6.9, -4.7]) for (const dz of [-2.3, -0.7, 0.9]) {
        const z = zc + dz;
        WD.slab(sx - 0.95, sx - 0.42, FY, FY + 0.62, z - 0.36, z + 0.36, hex('#D9C3A0'), { ao: false });
        P.slab(sx - 0.85, sx - 0.55, FY + 0.62, FY + 0.63, z - 0.15, z + 0.15, hex('#FFFFFF'), { ao: false });   // 摊开的书
        P.slab(sx - 0.3, sx + 0.12, FY + 0.34, FY + 0.38, z - 0.2, z + 0.2, hex('#3E7E74'), { ao: false });
        P.slab(sx + 0.1, sx + 0.14, FY + 0.38, FY + 0.82, z - 0.2, z + 0.2, hex('#3E7E74'), { ao: false });
        k.colSlab(sx - 0.95, sx + 0.14, FY, FY + 0.7, z - 0.36, z + 0.36);
        const L = randomLook({ kid: true, bag: null, scale: 0.95 + prnd01() * 0.1, uniform: null });
        bakePerson(P, sx - 0.05, sitY(FY + 0.38, L), z, -Math.PI / 2, L, SIT);
      }
      k.glow.slab(-8, -5.6, H2 - 0.14, H2 - 0.1, zc - 0.4, zc + 0.4, hex('#FFF6E0'), { ao: false });
    });

    // ---------- 二楼：前台 + 品牌墙（北） ----------
    P.slab(-1.2, 6.8, FY + 1.7, FY + 3.3, Z1 - 0.26, Z1 - 0.2, green, { ao: false });
    A.quad(2.8, FY + 2.5, Z1 - 0.27, 7.8, 1.5, Math.PI, A.draw(7.8, 1.5, xdfBrand({ slogan: '伴你成长，共赴美好' })));
    const DZ0 = 16.0, DZ1 = 17.3;
    WD.slab(0.6, 5.0, FY, FY + 1.05, DZ0, DZ1, hex('#F2EEE6'), { ao: false });
    P.slab(0.5, 5.1, FY + 1.05, FY + 1.12, DZ0 - 0.05, DZ1 + 0.05, green, { ao: false });
    P.slab(0.6, 5.0, FY + 0.95, FY + 1.0, DZ0 - 0.02, DZ0, orange, { ao: false });
    k.colSlab(0.5, 5.1, FY, FY + 1.12, DZ0 - 0.05, DZ1 + 0.05);
    A.quad(2.8, FY + 0.55, DZ0 - 0.03, 3.4, 0.55, Math.PI, A.draw(3.4, 0.55, textPaint(['前 台', 'Reception'], { bg: XDF_GREEN, fg: '#FFFFFF' })));
    P.box(1.3, FY + 1.35, DZ0 + 0.7, 0.55, 0.4, 0.08, hex('#2A2A2A')); P.box(1.3, FY + 1.13, DZ0 + 0.7, 0.4, 0.04, 0.3, hex('#C8CDD2'));
    P.cyl(4.4, FY + 1.25, DZ0 + 0.7, 0.22, 0.25, hex('#B8663A'), 8); P.ellipsoid(4.4, FY + 1.55, DZ0 + 0.7, 0.35, 0.4, 0.35, hex('#4E8F3E'), 1);
    // 前台老师 + 来问课的家长
    bakePerson(P, 2.6, FY, 18.0, Math.PI, randomLook({ fem: true, top: XDF_GREEN, bottom: '#2E3440', collar: true, bag: null, scale: 0.98 }), STAND);
    bakePerson(P, 4.3, FY, 15.2, -0.25, parentLook(1), STAND);
    // 课程立牌
    A.quad(-0.4, FY + 0.85, 15.2, 0.9, 1.4, Math.PI * 0.75, A.draw(0.9, 1.4, (c, pw, ph) => {
      c.fillStyle = '#FFFFFF'; c.fillRect(0, 0, pw, ph);
      c.fillStyle = XDF_GREEN; c.fillRect(0, 0, pw, ph * 0.22); c.fillStyle = XDF_ORANGE; c.fillRect(0, ph * 0.22, pw, ph * 0.03);
      c.fillStyle = '#FFFFFF'; c.textAlign = 'center'; c.textBaseline = 'middle';
      c.font = `800 ${ph * 0.12}px ${FONT}`; c.fillText('育秀校区', pw / 2, ph * 0.12);
      c.fillStyle = '#2E2E2E'; c.font = `600 ${ph * 0.09}px ${FONT}`;
      ['少儿英语', '中学辅导', '留学考试'].forEach((t, i) => c.fillText(t, pw / 2, ph * (0.42 + i * 0.18)));
    }));

    // ---------- 二楼：等候区（西北角），家长坐沙发等孩子下课 ----------
    const sofa = hex('#2E8075'), sofaDk = hex('#23665D');
    P.slab(-9.2, -5.4, FY, FY + 0.45, 18.9, 19.8, sofa, { ao: false }); P.slab(-9.2, -5.4, FY + 0.45, FY + 1.0, 19.5, 19.8, sofaDk, { ao: false });
    k.colSlab(-9.2, -5.4, FY, FY + 1.0, 18.9, 19.8);
    P.slab(X0 + 0.2, X0 + 1.1, FY, FY + 0.45, 14.8, 18.2, sofa, { ao: false }); P.slab(X0 + 0.2, X0 + 0.5, FY + 0.45, FY + 1.0, 14.8, 18.2, sofaDk, { ao: false });
    k.colSlab(X0 + 0.2, X0 + 1.1, FY, FY + 1.0, 14.8, 18.2);
    WD.slab(-8.0, -6.6, FY, FY + 0.4, 15.8, 17.6, hex('#E9E2D6'), { ao: false }); k.colSlab(-8.0, -6.6, FY, FY + 0.4, 15.8, 17.6);
    P.slab(-7.6, -7.2, FY + 0.4, FY + 0.43, 16.2, 16.5, orange, { ao: false });   // 桌上一本宣传册
    let pi = 0;
    for (const x of [-8.5, -7.3, -6.1]) { const L = parentLook(pi, { phone: pi % 2 === 0 }); bakePerson(P, x, sitY(FY + 0.45, L), 19.25, Math.PI, L, pi % 2 === 0 ? SIT_PHONE : SIT); pi++; }
    for (const z of [15.4, 17.4]) { const L = parentLook(pi, { phone: pi % 2 === 0 }); bakePerson(P, X0 + 0.75, sitY(FY + 0.45, L), z, Math.PI / 2, L, pi % 2 === 0 ? SIT_PHONE : SIT); pi++; }
    { const L = randomLook({ kid: true, bag: 'backpack', bagCol: '#F5B841', scale: 1 }); bakePerson(P, X0 + 0.75, sitY(FY + 0.45, L), 16.4, Math.PI / 2, L, SIT_PHONE); }
    bakePerson(P, -4.3, FY, 15.0, -Math.PI / 2 - 0.5, parentLook(3), STAND);   // 站着朝教室张望的家长
    for (const [x, z] of [[-4.2, 19.4], [6.2, 19.4]]) { P.cyl(x, FY + 0.25, z, 0.4, 0.5, hex('#B8663A'), 8); P.ellipsoid(x, FY + 0.85, z, 0.6, 0.8, 0.6, hex('#4E8F3E'), 1); }
    // 光荣榜（东墙）
    A.quad(X1 - 0.21, FY + 1.6, 13.5, 2.4, 1.3, -Math.PI / 2, A.draw(2.4, 1.3, (c, pw, ph) => {
      c.fillStyle = '#FFFFFF'; c.fillRect(0, 0, pw, ph); c.fillStyle = XDF_GREEN; c.fillRect(0, 0, pw, ph * 0.24);
      c.fillStyle = '#FFFFFF'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.font = `800 ${ph * 0.14}px ${FONT}`; c.fillText('优秀学员 光荣榜', pw / 2, ph * 0.12);
      for (let i = 0; i < 6; i++) { const x = pw * (0.1 + (i % 3) * 0.3), y = ph * (0.36 + (i >> 1 & 1) * 0.0 + Math.floor(i / 3) * 0.32);
        c.fillStyle = '#D6E9E6'; c.fillRect(x, y, pw * 0.2, ph * 0.22); c.fillStyle = XDF_ORANGE; c.fillRect(x, y + ph * 0.22, pw * 0.2, ph * 0.04); }
    }));
    for (const [x, z] of [[1, 3], [1, 9], [2.8, 13.5], [2.8, 18], [-6.5, 17]]) k.glow.slab(x - 0.9, x + 0.9, H2 - 0.14, H2 - 0.1, z - 0.3, z + 0.3, hex('#FFF6E0'), { ao: false });

    k.finish(true); this.atlas.finish(k.root, 'xdfLobbySigns');
  }
  wantsOut(p) { const lz = p.z - this.o.z, lx = p.x - this.o.x; return lz < -2.6 && Math.abs(lx) < 3 && p.y - this.o.y < 1.5; }
  spawn() { return [this.o.x, this.o.y + 0.05, this.o.z - 0.4, 0]; }
  zoneOf(p) { return { kind: 'interior', net: 'xm', building: 'xdf', floor: p.y - this.o.y > FY - 1.5 ? 2 : 1, inUnit: false }; }
  dispose() { this.atlas.dispose(); this.kit.root.getChildMeshes(false).forEach(m => m.dispose()); this.kit.root.dispose(); }
}
