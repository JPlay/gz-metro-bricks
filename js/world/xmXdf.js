/*
 * 育秀东路站 3 号出口：育秀中心街面（蓝底白字「新东方」招牌）+ 一楼大厅单独加载。
 * 真实校区：思明区湖滨北路育秀里 36 号育秀中心 2 层（体育中心旁）；小美指定 3 号口最近。
 * 坐标同 xmStreet：出口亭在原点，玩家往 +z 走出来；路在北边 z −22..−8。
 */
import { hex } from '../core/geo.js';
import * as D from './decor.js';
import { Kit } from './kit.js';
import { FoodAtlas } from '../game/food-art.js';
import { textPaint, facadePaint } from './xmStreet.js';
import { figure } from './xmAttr.js';

const FONT = '"PingFang SC","Hiragino Sans GB","Noto Sans CJK SC","Microsoft YaHei",sans-serif';
const FONT_EN = '"Helvetica Neue",Arial,sans-serif';

const XDF_BLUE = '#1B4FA0';
const XDF_BLUE_DK = '#123A78';

/** 街面：育秀中心立面 + 蓝底「新东方」招牌；正门敞开，走进去进大厅 */
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
    c.fillStyle = XDF_BLUE; c.fillRect(x + w * 0.42, y + h * 0.08, w * 0.16, h * 0.12);
    c.fillStyle = '#FFFFFF'; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.font = `800 ${h * 0.09}px ${FONT}`; c.fillText('新东方', x + w / 2, y + h * 0.14);
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

  // 楼顶蓝底白字「新东方」大招牌 + 楼名「育秀中心」
  const sign = (c, pw, ph) => {
    c.fillStyle = XDF_BLUE; c.fillRect(0, 0, pw, ph);
    c.fillStyle = XDF_BLUE_DK; c.fillRect(0, 0, pw, ph * 0.08); c.fillRect(0, ph * 0.92, pw, ph * 0.08);
    c.fillStyle = '#FFFFFF'; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.font = `800 ${ph * 0.55}px ${FONT}`; c.fillText('新 东 方', pw / 2, ph * 0.42);
    c.font = `600 ${ph * 0.18}px ${FONT_EN}`; c.fillText('NEW ORIENTAL', pw / 2, ph * 0.78);
  };
  P.slab(-14, 14, H + 0.5, H + 4.6, Z0 + 0.15, Z0 + 0.7, hex(XDF_BLUE), { ao: false });
  A.quad(0, H + 2.55, Z0 + 0.12, 28, 4.0, 0, A.draw(28, 4.0, sign));
  A.quad(0, 3.5, Z0 + 0.32, 10, 0.7, 0, A.draw(10, 0.7, textPaint(['育秀中心', 'YUXIU CENTER'], { bg: '#5A5248', fg: '#F6E8C8' })));
  // 正门上方蓝底白字「新东方」灯箱（街面近距离可见）
  P.slab(-5.5, 5.5, 4.3, 6.1, Z0 + 0.15, Z0 + 0.65, hex(XDF_BLUE), { ao: false });
  A.quad(0, 5.2, Z0 + 0.12, 11, 1.7, 0, A.draw(11, 1.7, (c, pw, ph) => {
    c.fillStyle = XDF_BLUE; c.fillRect(0, 0, pw, ph);
    c.fillStyle = XDF_BLUE_DK; c.fillRect(0, 0, pw, ph * 0.1); c.fillRect(0, ph * 0.9, pw, ph * 0.1);
    c.fillStyle = '#FFFFFF'; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.font = `800 ${ph * 0.55}px ${FONT}`; c.fillText('新 东 方', pw / 2, ph * 0.42);
    c.font = `600 ${ph * 0.18}px ${FONT_EN}`; c.fillText('NEW ORIENTAL', pw / 2, ph * 0.78);
  }));

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

  S.filler([[-90, 50, 40, 40, 36, '#C9C2B6'], [90, 48, 40, 40, 42, '#BFB6A8'], [-70, -44, 50, 16, 28, '#D2CABE'], [40, -44, 50, 16, 32, '#C6BEB1'], [0, 120, 100, 30, 24, '#CDC5B8']]);

  // 走进正门 → 单独加载大厅（门洞中心 z≈Z0+0.4）
  S.enterDoor = { x: 0, z: Z0 + 0.35, halfW: 1.4, zLo: -0.35, zHi: 0.7, make: (scene, o) => new XdfLobby(scene, o), outYaw: Math.PI, outDz: -1.8, id: 'xdf' };
}

/* ====================== 新东方前台大厅（单独加载） ====================== */
/** 大厅坐标：原点在室内中心；门朝 −z 出楼（与 Xinli256 一致） */
export class XdfLobby {
  constructor(scene, origin) {
    this.id = 'xdf';
    const k = this.kit = new Kit(scene, 'xdfLobby'); k.root.position.set(origin.x, origin.y, origin.z); this.o = origin;
    this.atlas = new FoodAtlas(scene, 1024);
    const P = k.solid, A = this.atlas, GR = k.g('granite'), WD = k.g('paint@wood');
    const wall = hex('#F4F1EA'), blue = hex(XDF_BLUE);
    // 空间：宽 16 × 深 14，层高 3.6；门洞在 −z
    const X0 = -8, X1 = 8, Z0 = -1.4, Z1 = 12.5, H = 3.6;
    k.floorWithHoles(X0, X1, Z0, Z1, -0.15, 0, hex('#D8D2C4'), [], true, 'floor');
    P.slab(X0, X1, H - 0.12, H, Z0, Z1, hex('#F7F5F0'), { ao: false });
    // 四墙（南墙门洞）
    P.slab(X0, X0 + 0.2, 0, H, Z0, Z1, wall, { ao: false }); k.colSlab(X0, X0 + 0.2, 0, H, Z0, Z1);
    P.slab(X1 - 0.2, X1, 0, H, Z0, Z1, wall, { ao: false }); k.colSlab(X1 - 0.2, X1, 0, H, Z0, Z1);
    P.slab(X0, X1, 0, H, Z1 - 0.2, Z1, wall, { ao: false }); k.colSlab(X0, X1, 0, H, Z1 - 0.2, Z1);
    // 南墙：门洞 ±1.2
    for (const [a, b] of [[X0, -1.2], [1.2, X1]]) { P.slab(a, b, 0, H, Z0 - 0.05, Z0 + 0.15, wall, { ao: false }); k.colSlab(a, b, 0, H, Z0 - 0.05, Z0 + 0.15); }
    P.slab(-1.2, 1.2, 2.3, H, Z0 - 0.05, Z0 + 0.15, wall, { ao: false });
    // 门外一小块地面 + 天光
    k.floorWithHoles(-3, 3, -5, Z0, -0.15, 0, hex('#8E8A82'), [], true, 'pave');
    k.glow.slab(-3, 3, 0, 3.2, -5.05, -5.0, hex('#DDE8F0'), { ao: false });
    k.colSlab(-3.1, 3.1, 0, 3.2, -5.2, -5.0); k.colSlab(-3.1, -3, 0, 3.2, -5, Z0); k.colSlab(3, 3.1, 0, 3.2, -5, Z0);

    // 后墙品牌墙：蓝底白字「新东方」
    P.slab(-5, 5, 0.8, 2.8, Z1 - 0.25, Z1 - 0.18, blue, { ao: false });
    A.quad(0, 1.8, Z1 - 0.26, 9.5, 1.9, Math.PI, A.draw(9.5, 1.9, (c, pw, ph) => {
      c.fillStyle = XDF_BLUE; c.fillRect(0, 0, pw, ph);
      c.fillStyle = '#FFFFFF'; c.textAlign = 'center'; c.textBaseline = 'middle';
      c.font = `800 ${ph * 0.55}px ${FONT}`; c.fillText('新 东 方', pw / 2, ph * 0.42);
      c.font = `600 ${ph * 0.18}px ${FONT_EN}`; c.fillText('NEW ORIENTAL · YUXIU', pw / 2, ph * 0.78);
    }));

    // 前台（靠后墙正中）
    WD.slab(-2.4, 2.4, 0, 1.05, Z1 - 3.2, Z1 - 1.6, hex('#E9E2D6'), { ao: false });
    P.slab(-2.5, 2.5, 1.05, 1.12, Z1 - 3.25, Z1 - 1.55, blue, { ao: false });
    k.colSlab(-2.5, 2.5, 0, 1.12, Z1 - 3.25, Z1 - 1.55);
    A.quad(0, 0.7, Z1 - 3.26, 3.6, 0.55, Math.PI, A.draw(3.6, 0.55, textPaint(['前 台', 'Reception'], { bg: XDF_BLUE, fg: '#FFFFFF' })));
    // 台上一台电脑 + 绿植
    P.box(-0.8, 1.35, Z1 - 2.4, 0.55, 0.4, 0.08, hex('#2A2A2A')); P.box(-0.8, 1.12, Z1 - 2.4, 0.4, 0.06, 0.3, hex('#C8CDD2'));
    P.cyl(1.6, 1.25, Z1 - 2.2, 0.22, 0.25, hex('#B8663A'), 8); P.ellipsoid(1.6, 1.55, Z1 - 2.2, 0.35, 0.4, 0.35, hex('#4E8F3E'), 1);

    // 等候区沙发（两侧）
    for (const sx of [-1, 1]) {
      const x = sx * 5.2;
      P.slab(x - 1.4, x + 1.4, 0, 0.42, 2.0, 4.2, hex('#4A6FA5'), { ao: false });
      P.slab(x - 1.4, x + 1.4, 0.42, 0.9, 3.9, 4.2, hex('#3E5F90'), { ao: false });
      k.colSlab(x - 1.4, x + 1.4, 0, 0.9, 2.0, 4.2);
      P.slab(x - 0.5, x + 0.5, 0, 0.38, 2.8, 3.4, hex('#E9E2D6'), { ao: false });   // 茶几
    }
    // 两侧教室门（只看外观，进不去）
    for (const [x, z, label] of [[-7.7, 7.5, '教室 201'], [7.7, 7.5, '教室 202'], [-7.7, 10.2, '教室 203'], [7.7, 10.2, '教室 204']]) {
      const sx = Math.sign(x);
      P.slab(x - sx * 0.02, x + sx * 0.02, 0, 2.2, z - 0.55, z + 0.55, hex('#6B3A2A'), { ao: false });
      A.quad(x - sx * 0.03, 2.35, z, 0.7, 0.28, sx < 0 ? Math.PI / 2 : -Math.PI / 2, A.draw(0.7, 0.28, textPaint([label], { bg: '#D8D3C8', fg: '#2E2E2E' })));
    }
    // 顶灯 + 小朋友 / 家长
    for (const x of [-4, 0, 4]) k.glow.slab(x - 0.8, x + 0.8, H - 0.14, H - 0.1, 4, 5, hex('#FFF6E0'), { ao: false });
    for (const [x, z, c] of [[-4.5, 3.2, '#E84A5F'], [4.8, 3.0, '#3FA7D6'], [0.5, 6.5, '#F2B233']]) figure(P, x, z, c, 1.35);
    // 前台旁立牌
    A.quad(-3.6, 1.5, Z1 - 1.8, 0.9, 1.4, Math.PI / 2, A.draw(0.9, 1.4, (c, pw, ph) => {
      c.fillStyle = '#FFFFFF'; c.fillRect(0, 0, pw, ph);
      c.fillStyle = XDF_BLUE; c.fillRect(0, 0, pw, ph * 0.22);
      c.fillStyle = '#FFFFFF'; c.textAlign = 'center'; c.textBaseline = 'middle';
      c.font = `800 ${ph * 0.12}px ${FONT}`; c.fillText('育秀校区', pw / 2, ph * 0.12);
      c.fillStyle = '#2E2E2E'; c.font = `600 ${ph * 0.09}px ${FONT}`;
      ['少儿英语', '中学辅导', '留学考试'].forEach((t, i) => c.fillText(t, pw / 2, ph * (0.4 + i * 0.18)));
    }));

    k.finish(true); this.atlas.finish(k.root, 'xdfLobbySigns');
  }
  wantsOut(p) { const lz = p.z - this.o.z, lx = p.x - this.o.x; return lz < -2.6 && Math.abs(lx) < 3 && p.y - this.o.y < 1.5; }
  spawn() { return [this.o.x, this.o.y + 0.05, this.o.z - 0.4, 0]; }
  zoneOf(p) { return { kind: 'interior', net: 'xm', building: 'xdf', floor: 1, inUnit: false }; }
  dispose() { this.atlas.dispose(); this.kit.root.getChildMeshes(false).forEach(m => m.dispose()); this.kit.root.dispose(); }
}
