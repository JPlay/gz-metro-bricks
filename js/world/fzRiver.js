/*
 * 福州内河街区（第 1A 批）：从 西门 C 口 / 西洋 A 口 出站进来，是同一片河网（一个街区，两个出口亭）。
 *   白马河（西湖出口 → 乌山路）+ 安泰河（西关 → 安泰桥，只步行）+ 东西河（白马河口 → 加洋路）+ 西湖出口一角。
 *   坐标：整片河网用 W 坐标（x 东、z 北，见 js/data/fz-river.js），kit.root 平移到“当前出口亭 = 街区原点”。
 *   视觉：窄河道、条石驳岸 + 石栏、榕树探到水面上；安泰河两岸白墙黛瓦 + 马鞍墙、石拱桥；白马河 / 东西河现代步道 + 平桥。
 *   远近：地面 / 水面 / 驳岸 / 房子 / 桥 / 远景树冠常开；栏杆、榕树细节、路灯长椅按 80 m 格子只开附近（iPad 帧率）。
 *   游船 A 线：js/game/fzBoat.js（西湖码头 → 西水关码头 → 黎明湖码头）。
 * 第 1B 批（东线，另一片河网，useNet('e')）：斗门 C / 东门 C / 光明港 D 出站进来。
 *   晋安河（温泉公园 → 河口，1:4）+ 光明港（河口 → 光明港码头，1:5）；现代步道 + 条石驳岸 + 石栏 + 榕树；平桥 / 路桥（全部 OSM 位置）。
 *   游船 B 线（白篷）：温泉公园码头 → 福新问渡码头 → 东门停靠点（游戏增设）→ 河口码头 → 光明港码头。
 */
import { XmStreet, textPaint, FONT, FONT_EN, facadePaint } from './xmStreet.js';
import { hex, mix, Geo } from '../core/geo.js';
import { bucketMat } from './kit.js';
import * as D from './decor.js';
import { FZR, WY, RIVERS, BRIDGES, PIERS, KIOSKS, isWater, isLand, isDry, inPoly, shoreFor, soffitAt, deckAt, humpRise, pierNext, ROUTE, STOPS, nextStop, useNet, netOfKiosk, levelAt, inChamber, LOCK, LOCK_STATE, ROUTES, routesOfPier, hudLine } from '../data/fz-river.js';
import { FzBoat } from '../game/fzBoat.js';
import { Haze, RIVER_HAZE } from '../game/haze.js';
import { installTileCull } from './tileCull.js';
import { FZ_EXITS } from '../data/fz-exits.js';
import { xihuPark, sanfang as sanfangStreet } from './fzAttr.js';
import { FZ_LINES } from '../data/fz-lines.js';
import { FzNight } from './fzNight.js';
import { NIGHT, nightWanted, facadeWindows } from '../game/night.js';

const B = window.BABYLON;
const NO = { ao: false }, TAU = Math.PI * 2;
const CELL = 80, NEAR = 125;
const GRANITE = '#9A9385', COPING = '#ABA496', WALLC = '#8A8476';
const yawOf = (fx, fz) => Math.atan2(fx, fz);
const lerp = (a, b, t) => a + (b - a) * t;
/** 船线颜色（码头牌线路章 / 左上角站名牌）：A 红、B 蓝灰、C 绿（2C） */
const LINE_COLOR = { A: '#B3261E', B: '#2E5E8C', C: '#2F7D4A', D: '#7A4E9C' };   // 3A：D 线紫
/** 2C 区域（白马河下段，W z < c2.z0）：常开几何单独一组，离得远（玩家 z > z0 + 400）整组关掉 —— 不加在 1A / 2B 的预算里 */
const inC2 = (z) => !!FZR.c2 && z < FZR.c2.z0;
// 2C 再按 z 切成 150 m 一段（每段一组，各自按玩家远近开关 + 视锥裁剪），闽江远景单独一组
const C2B = 150, c2Band = (z) => Math.max(0, Math.floor((FZR.c2.z0 - z) / C2B));
// 常开的墙面 / 桥身 / 房子 / 树（1A / 2B 部分）按 z 切三条（gN0: -330…-30，gN1: -30…270，gN2: > 270），其余（2B 东西河南段）留在 rest：
// 每条一组，视锥裁剪按条算（背后的整条不画）；离玩家 > 430 m（远裁剪 420 m 之外）整条关掉，画面不变
const ZS = [-330, -30, 270], zStrip = (z) => z > ZS[2] ? 2 : z > ZS[1] ? 1 : z > ZS[0] ? 0 : -1;
/** 2D 区域：安泰河东段（1A 末端以东）+ 南后街走廊；外圈 skirt 画草地（2C 教训：不留纯白地） */
const inD2 = (x, z) => !!FZR.d2 && ((x > 40 && x < 470 && z > -290 && z < -20) || (x > -160 && x < -10 && z > -178 && z < 75));
/** 2D 性能：安泰河东段（1A 末端以东）的常开几何单独一组 d2e（视锥按组裁剪；走进南后街整组关）；南后街走廊里关掉外面的 gN / 细节格子（街两边房子挡着看不见） */
const inD2E = (x, z) => !!FZR.d2 && x > 60 && x < 480 && z > -300 && z < -20;
const C2D = 80, c2DBand = (z) => Math.max(0, Math.floor((FZR.c2.z0 - z) / C2D));   // 细节格子：横向并成一条（每 80 m 一组）

/** 锥形树干侧面法线：径向 + 沿轴的锥度分量（tubeTaper 用矩阵直接变换法线，非均匀缩放后侧面法线几乎朝天） */
function trunkNormals(G, v0, a, b, r0, r1) {
  const dx = b[0] - a[0], dy = b[1] - a[1], dz = b[2] - a[2], L = Math.hypot(dx, dy, dz), ux = dx / L, uy = dy / L, uz = dz / L, k = (r0 - r1) / L;
  for (let v = v0, n = G.p.length / 3; v < n; v++) {
    const px = G.p[v * 3] - a[0], py = G.p[v * 3 + 1] - a[1], pz = G.p[v * 3 + 2] - a[2], t = px * ux + py * uy + pz * uz;
    let rx = px - ux * t, ry = py - uy * t, rz = pz - uz * t; const rl = Math.hypot(rx, ry, rz); if (rl < 1e-4) continue;
    rx = rx / rl + ux * k; ry = ry / rl + uy * k; rz = rz / rl + uz * k; const m = Math.hypot(rx, ry, rz);
    G.n[v * 3] = rx / m; G.n[v * 3 + 1] = ry / m; G.n[v * 3 + 2] = rz / m;
  }
}
export class FzRiverStreet extends XmStreet {
  constructor(scene, code, N, ex) { super(scene, code, { ...N, build: s => s.river() }, ex); }
  /** 不铺默认地面：整片河网自己的岸地；把根节点平移到当前出口亭 */
  ground() {
    this.net = useNet(netOfKiosk(this.code));   // 先换河网（活绑定），下面读到的 KIOSKS / FZR 都是这一片的
    // 同一个站两个出口亭都在河网里（2A：西门 C 口在白马河、西门 B 口在西湖公园）：按出口字母选，key = code_出口
    const K = (this.ex && KIOSKS[this.code + '_' + this.ex.n]) || KIOSKS[this.code] || Object.values(KIOSKS)[0];
    this.K = K; this.others = Object.values(KIOSKS).filter(k => k !== K);
    this.kit.root.position.set(this.O.x - K.x, 0, this.O.z - K.z);
    this.cellFns = new Map(); this.key = this.net === 'a' ? 'fzriver' : 'fzriver-' + this.net;
    // 3C：登记每块图集区域（标牌 / 景物 + 窗位置），夜里拷一份贴图按区域压暗、点亮约 30% 的窗（白天不用，不改任何像素）
    this.atlasRegs = []; { const A = this.atlas, d0 = A.draw; A.draw = (...a) => { const t = this._aTag; this._aTag = null; const uv = d0.apply(A, a); this.atlasRegs.push({ uv, tag: t ? 'scene' : 'sign', win: t && t.win, grid: t && t.grid }); return uv; }; }
  }
  /** 3C：下一次 atlas.draw 是景物（立面 / 店面），win = 窗位置（区域内 0..1 分数），grid = 亮窗上画几格窗棂 */
  sceneTag(win = null, grid = 0) { this._aTag = { win, grid }; }
  kiosk() {}   // 两个亭子在 river() 末尾画（全局几何，不进远近格子）
  /** 2A：西门 B → 西湖公园（原老街区并进来）：牌楼 / 草地 / 沿湖步道 / 观湖亭栈桥 / 远处柳堤和开化寺。
   *  fzAttr.xihuPark 用局部坐标（原点 = 西门 B 亭）写的：这里给它一层平移代理（几何 xf.ox/oz + 碰撞 + 贴图）。 */
  xihuPark() {
    const K = KIOSKS.fzxm_B, ox = K.x, oz = K.z, real = this.kit, A = this.atlas, touched = new Set();
    const g = n => { const G = real.g(n); if (!touched.has(G)) { touched.add(G); G.xf = { cx: 0, cz: 0, s: 1, sy: 1, ox, oz }; } return G; };
    const pk = { g, get solid() { return g('paint'); }, M: real.M, root: real.root,
      col: (x, y, z, ...r) => real.col(x + ox, y, z + oz, ...r), colSlab: (x0, x1, y0, y1, z0, z1, ...r) => real.colSlab(x0 + ox, x1 + ox, y0, y1, z0 + oz, z1 + oz, ...r) };
    const pa = { draw: (...a) => A.draw(...a), quad: (x, y, z, ...r) => A.quad(x + ox, y, z + oz, ...r) };
    // 湖岸线：从牌楼往北扫，第一个落进湖面的 z（局部，0.1 m 精度）；扫到 z1 还没水 = 这一列没湖（东边）
    const shoreCache = new Map(), shore = x => { const key = Math.round(x * 10); if (shoreCache.has(key)) return shoreCache.get(key);
      let z = 16; while (z < 76 && !isWater(x + ox, z + oz)) z += 0.1; shoreCache.set(key, z); return z; };
    let lakeX1 = -24; for (let x = -24; x <= 26; x += 0.5) if (shore(x) < 76) lakeX1 = x;
    const r = xihuPark({ kit: pk, atlas: pa }, { WY: LOCK ? WY + LOCK.rise : WY, shore, x0: -24, x1: 26, z1: 76, lakeX1, bwX: 4, cz: 114, cx1: 80 });
    for (const G of touched) G.xf = null;
    this.decks = r.decks.map(([x0, x1, z0, z1]) => [x0 + ox, x1 + ox, z0 + oz, z1 + oz]);
  }
  /** 2C 分段：这一遍该不该画 z 处的东西 */
  c2ok(z, x) {
    if (inC2(z) !== !!this._c2pass) return false;
    if (this._c2pass) return c2Band(z) === this._c2band;
    const e = x !== undefined && inD2E(x, z);
    if (this._d2epass) return e;
    if (e && this._nPass !== undefined) return false;   // 2D 东段在 d2e 组里画
    return this._nPass === undefined || zStrip(z) === this._nPass;
  }
  /** 2D：玩家在南后街走廊里（局部 |x| < 24、z 24..186：两边都是老宅），外面的 gN / 东段 / 细节格子看不见 */
  inCorr(p, z0 = 24) { if (!FZR.d2) return false; const N = FZR.d2.nhj, lx = N.X0 - p.x, lz = N.Z0 - p.z; return Math.abs(lx) < 24 && lz > z0 && lz < 186; }
  /** W → 世界 */
  wx(x) { return x + this.kit.root.position.x; }
  wz(z) { return z + this.kit.root.position.z; }
  toW(p) { return { x: p.x - this.kit.root.position.x, z: p.z - this.kit.root.position.z }; }
  det(x, z, fn) { const k = Math.floor(x / CELL) + ',' + Math.floor(z / CELL); if (!this.cellFns.has(k)) this.cellFns.set(k, []); this.cellFns.get(k).push(fn); }

  river() {
    const k = this.kit;
    this.facades();
    this.walls(); this.bridges(); this.piers(); if (FZR.c2) this.c2Static(); else this.sharedDecks(); if (FZR.a3) this.a3Static(); if (FZR.a4) this.a4Static(); if (FZR.a6) this.a6Static(); if (FZR.b3) this.b3Static(); this.stepsDown(); this.unders(); this.roads(); this.houses(); this.trees(); this.promenade(); if (FZR.b3) this.lakeLamps(); if (FZR.sfqx) this.sanfang(); if (FZR.lakeBox) this.backdrops(); if (LOCK) this.lockStatic(); if (KIOSKS.fzxm_B) this.xihuPark();
    k.group('g0');   // 上面直接画的东西（桥、码头、台阶、马路、牌坊…）常开：单独封一组，别被并进第一个细节格子
    if (this._nhjw || this._nhjH) {
      if (this._nhjw) { for (const t of this._nhjw) this.banyanNear(...t); this._nhjw = null; }
      if (this._nhjH) { this._nhjHdraw = true; for (const [h, i] of this._nhjH) this.houseBody(h, i); this._nhjHdraw = false; this._nhjH = null; }
      k.group('d2b');
    }   // 步道榕树 + 两侧 4 栋单独成组（紧包围盒），牌坊口往西看能裁掉
    // 近处细节：非 2C 段全部合进 det 一组（同材质合并，少十来次绘制），lodNow 里用 tileCull 按视锥 + 距离裁
    this.cellKeys = [];
    // 2C 的细节格子：同一行（80 m）横向并成一组 c2d:i（少一半以上绘制调用），离玩家这一行 < 110 m 才开
    const c2cells = {};
    for (const [key, fns] of this.cellFns) {
      const cz = (Number(key.split(',')[1]) + 0.5) * CELL;
      if (inC2(cz)) { const b = c2DBand(cz); (c2cells[b] || (c2cells[b] = [])).push(fns); continue; }
      fns.forEach(f => f()); this.cellKeys.push(key);
    }
    k.group('det');
    this.c2Detail = Object.keys(c2cells).map(Number);
    for (const b of this.c2Detail) { c2cells[b].forEach(fns => fns.forEach(f => f())); k.group('c2d:' + b); }
    // 3A：光明港东段水面亮纹 + 闸外闽江对岸（树 / 楼）单独一组 g3day：只白天、人在东段一带才开；夜里整组关（夜雾 60 → 220 m，对岸 230 m 外本来就全进雾里）—— 3A 一带夜里 draw 不超过白天（小美 3A ④）
    if (FZR.a3) { this.a3Day(); k.group('g3day'); }
    // 4A：西段水面亮纹 + 闸西新港河对岸楼 / 树，单独一组 g4day：只白天、人在西段一带才开；夜里整组关，夜 draw ≤ 昼（同九门闸）
    if (FZR.a4) { this.a4Day(); k.group('g4day'); }
    // 6A：湖前河水面亮纹单独一组 g6day：只白天、人在东段一带才开；夜里整组关，夜 draw ≤ 昼
    if (FZR.a6) { this.a6Day(); k.group('g6day'); }
    // 3B：晋安河北段 / 凤坂河 / 琴亭湖水面亮纹单独一组 g3bday：只白天、人在 3B 一带才开（夜里关掉腾出夜灯那一个 draw —— 3B 一带夜里 draw 不超过白天）
    if (FZR.b3) { this.b3Day(); k.group('g3bday'); }
    // 2C：白马河下段水面亮纹单独一组 g2day：只白天、人在 2C / 彬德一带才开；夜里整组关，腾出夜灯那一个 draw（4A 给三座水闸加檐下/墩帽灯带后，彬德观景处夜 21 > 昼 20）
    if (FZR.c2) { this.c2Day(); k.group('g2day'); }
    // 2C：白马河下段的常开几何（墙面 / 桥身 / 房子 / 树 / 闽江远景）单独一组（c2），按玩家远近整组开关
    if (FZR.c2) {
      const nb = 1 + Math.max(...FZR.houses.map(h => h.z).concat(FZR.trees.map(t => t[1]), BRIDGES.filter(b => b.c2).map(b => b.z), FZR.wall.map(w => (w[1] + w[3]) / 2)).filter(inC2).map(c2Band));
      this._c2pass = true; this.c2Bands = nb;
      for (let i = 0; i < nb; i++) { this._c2band = i; this.piers(); for (const K of Object.values(KIOSKS)) if (inC2(K.z) && c2Band(K.z) === i) this.kioskAt(K); this.bridges(); this.unders(); this.roads(); this.wallFaces(); this.bridgeBodies(); this.houseBodies(); this.treeBlobs(); k.group('c2:' + i); }
      this._c2band = -1; this.minjiang(); this.c2Sluice(); k.group('c2mj'); this._c2pass = false;
    }
    // 2D：东街口 C 南后街（fzAttr.sanfang 转 180° 嵌进来）单独一组 d2s，离走廊远了整组关
    if (FZR.d2) { this.nhjStreet(); k.group('d2s'); this.nhjStreet(true); k.group('d2sLo'); }   // 2D 南后街：近处 hi（走进街里）/ 远处 lo（牌坊外、步道上、河边）
    if (FZR.c2) { for (let i = 0; i < ZS.length; i++) { this._nPass = i; this.wallFaces(); this.bridgeBodies(); this.houseBodies(); this.treeBlobs(); k.group('gN' + i); } this._nPass = -1; }
    if (FZR.d2) { this._d2epass = true; this.wallFaces(); this.bridgeBodies(); this.houseBodies(); this.treeBlobs(); this.d2Static(); k.group('d2e'); this._d2epass = false; }
    // 以下是常开的全局几何（rest 组）
    if (FZR.d2 && KIOSKS.fzdjk) { this.kioskAt(KIOSKS.fzdjk); k.group('d2k'); }   // 东街口亭单独成组：离亭远了关掉，避免 850 面永远算进 rest 的包围盒
    this.groundAndWater(); this.wallFaces(); this.bridgeBodies(); this.houseBodies(); this.treeBlobs(); this._nPass = undefined;
    for (const K of Object.values(KIOSKS)) if (!inC2(K.z) && K !== KIOSKS.fzdjk) this.kioskAt(K);   // 2C 的出口亭（宁化 A）在 2C 分段里画
    this.boundary();
  }
  after() {
    // 1B：河面水汽远景（200 → 350 m 线性雾；远裁剪保持 420 m，不切天空穹顶）；离开街区时 dispose 还原
    if (RIVER_HAZE[this.net]) { this.haze = new Haze(this.scene, this.scene.activeCamera, RIVER_HAZE[this.net]); this.haze.apply(); }
    if (LOCK) this.lockGates();
    // 2C：一条船线一条船（a 网：A 线 + C 线，同一款船、红篷）；this.boat = 当前和玩家相关的那条（坐着的 > 站在上面的 > 出口亭那条线的）
    this.boats = {}; for (const [rid, c] of Object.entries(ROUTES)) this.boats[rid] = new FzBoat(this, c.route.canopy || 'red', rid);
    this.homeRid = Object.keys(ROUTES).find(r => this.K.pier && ROUTES[r].stops.some(s => s.id === this.K.pier)) || ROUTE.id || 'A';
    if (this.kit.groupNodes && this.kit.groupNodes.g3bday) for (const m of this.kit.groupNodes.g3bday.getChildMeshes()) { m.metadata = Object.assign({}, m.metadata, { noTileCull: true }); m.alwaysSelectAsActiveMesh = true; }   // 3B 白天组：开着就整组画（白天计数稳定）
    if (this.kit.groupNodes && this.kit.groupNodes.g3day) for (const m of this.kit.groupNodes.g3day.getChildMeshes()) { m.metadata = Object.assign({}, m.metadata, { noTileCull: true }); m.alwaysSelectAsActiveMesh = true; }   // 3A 白天组：开着就整组画（不按视锥换索引 / 不被视锥裁掉），白天 draw 数稳定，夜里 ≤ 白天
    if (this.kit.groupNodes && this.kit.groupNodes.g4day) for (const m of this.kit.groupNodes.g4day.getChildMeshes()) { m.metadata = Object.assign({}, m.metadata, { noTileCull: true }); m.alwaysSelectAsActiveMesh = true; }
    if (this.kit.groupNodes && this.kit.groupNodes.g6day) for (const m of this.kit.groupNodes.g6day.getChildMeshes()) { m.metadata = Object.assign({}, m.metadata, { noTileCull: true }); m.alwaysSelectAsActiveMesh = true; }
    if (this.kit.groupNodes && this.kit.groupNodes.g2day) for (const m of this.kit.groupNodes.g2day.getChildMeshes()) { m.metadata = Object.assign({}, m.metadata, { noTileCull: true }); m.alwaysSelectAsActiveMesh = true; }
    this.tileCull = installTileCull(this);   // 常开大网格按视锥换索引（不加 draw）
    this.lodT = 0; this.lodNow(true);
    // 3C：夜景（设备本地时间 19:00–06:00 / ?t=night|day 覆盖）；白天什么都不建
    this.night = new FzNight(this); this.nightT = 0; this.night.set(nightWanted(location.search));
    // 主循环里 Fuzhou 的 street.update 在 player.updateCamera 之前：快转头时这一拍观察器跑在镜头写完之后，朝向过约 10° / 位置跳变就当帧换索引
    this._tileObs = this.scene.onBeforeRenderObservable.add(() => this.refreshTilesIfTurned());
  }
  get boat() {
    const bs = this.boats ? Object.values(this.boats) : []; if (!bs.length) return null; const pl = this.pl;
    if (pl) { const a = bs.find(b => b.passengerSeated(pl)) || bs.find(b => b.onBoard(pl)); if (a) return a; }
    return this.boats[this.homeRid] || bs[0];
  }
  set boat(v) { if (!v) this.boats = {}; }
  /* ---------- 地面 / 水面（三角网，碰撞体按 60 m 格子分开） ---------- */
  groundAndWater() {
    const k = this.kit, PV = k.g('pave'), WA = k.g('paint@sea');
    const GRASS = hex('#79A85A'), SKIRTC = hex('#BDB7AA'), PAVEC = hex('#CFC9BD');   // 2A：西湖公园一带的岸地 / 外圈画成草地（小美：站在牌楼、码头、栈道、柳堤看不到白边）
    const add = (G, T, y, col) => {   // y：数 或 (x, z) => y（2A：湖 + 闸上游水面高 0.5 m）
      for (const c of Object.values(T)) {
        const P = c.p, I = c.i, base = G.p.length / 3;
        for (let j = 0; j < P.length; j += 2) G.push(P[j], typeof y === 'function' ? y(P[j], P[j + 1]) : y, P[j + 1], 0, 1, 0, typeof col === 'function' ? col(P[j], P[j + 1]) : col);
        for (let j = 0; j < I.length; j += 3) G.i.push(base + I[j], base + I[j + 1], base + I[j + 2]);
      }
    };
    add(PV, FZR.land, 0, PAVEC);
    if (KIOSKS.fzxm_B) {   // 西湖公园一带的岸地盖一层草（园路 / 步道 / 栈桥都画在上面）；西边白马河岸和闸不动
      const G = k.solid, inZ = (x, z) => x > -346 && x < -270 && z > 110.6 && z < 240;
      for (const c of Object.values(FZR.land)) { const P = c.p, I = c.i;
        for (let j = 0; j < I.length; j += 3) { const a = I[j] * 2, b = I[j + 1] * 2, d = I[j + 2] * 2; if (!inZ((P[a] + P[b] + P[d]) / 3, (P[a + 1] + P[b + 1] + P[d + 1]) / 3)) continue;
          const base = G.p.length / 3; for (const q of [a, b, d]) G.push(P[q], 0.012, P[q + 1], 0, 1, 0, GRASS); G.i.push(base, base + 1, base + 2); } } } add(WA, FZR.water, levelAt, hex('#2F6670'));
    // 可走范围外：一圈地面 + 西湖其余湖面（只看，不碰撞；边界墙挡着走不过去）
    { const pk = FZR.sbwPark, inPk = (x, z) => pk && x > pk[0] && x < pk[2] && z > pk[1] && z < pk[3];   // 2B 水部步道两边：草地（小美 2B ②）
      const c2z = FZR.c2 ? FZR.c2.z0 : -1e9;   // 2C（白马河下段）可走范围外的一圈也画草地（小美 2C ②：宁化 A 口出来左手一大片纯白地）
      const qp = FZR.b3 && FZR.b3.park, inQ = (x, z) => !!qp && x > qp[0] && x < qp[2] && z > qp[1] && z < qp[3];   // 3B：琴亭湖公园一圈外面也是草地
      const bz = FZR.b3 && FZR.b3.zone, inBZ = (x, z) => !!bz && bz.some(r => x > r[0] && x < r[2] && z > r[1] && z < r[3]) && !inQ(x, z);
      const az = FZR.a6 && FZR.a6.zone, inAZ = (x, z) => !!az && x > az[0] && x < az[2] && z > az[1] && z < az[3] && !inQ(x, z);
      let skirt = FZR.skirt;
      if (bz) {   // 3B（小美 11-17）：晋安河北段 / 凤坂河一带可走范围外的一圈 = 岸地同款铺地（pave 桶 + PAVEC），不再一大块近白的平面
        const P = FZR.skirt.p, I = FZR.skirt.i, Ia = [], Ib = [];
        for (let j = 0; j < I.length; j += 3) { const hit = [I[j], I[j + 1], I[j + 2]].some(q => inBZ(P[q * 2], P[q * 2 + 1]) || inAZ(P[q * 2], P[q * 2 + 1])) || inBZ((P[I[j] * 2] + P[I[j + 1] * 2] + P[I[j + 2] * 2]) / 3, (P[I[j] * 2 + 1] + P[I[j + 1] * 2 + 1] + P[I[j + 2] * 2 + 1]) / 3) || inAZ((P[I[j] * 2] + P[I[j + 1] * 2] + P[I[j + 2] * 2]) / 3, (P[I[j] * 2 + 1] + P[I[j + 1] * 2 + 1] + P[I[j + 2] * 2 + 1]) / 3); (hit ? Ib : Ia).push(I[j], I[j + 1], I[j + 2]); }
        skirt = { p: P, i: Ia }; add(PV, [{ p: P, i: Ib }], -0.01, PAVEC);
      }
      add(k.solid, [skirt], -0.01, (KIOSKS.fzxm_B || pk || FZR.c2 || qp) ? ((x, z) => ((KIOSKS.fzxm_B && x > -620 && x < -190 && z > 60 && z < 600) || inPk(x, z) || z < c2z || inD2(x, z) || inQ(x, z)) ? GRASS : SKIRTC) : SKIRTC); }
    if (FZR.d2) add(WA, [FZR.d2.mouth.water], WY, hex('#2F6670'));   // 2D 琼东河口远景水面：和内河同高、同色（小美 2D ⑥：看不出接缝） add(WA, [FZR.lakeFar], (LOCK ? WY + LOCK.rise : WY) - 0.03, hex('#2F6670'));
    for (const [x0, z0, x1, z1] of FZR.lakeShore) { const L = Math.hypot(x1 - x0, z1 - z0); k.g('granite').box((x0 + x1) / 2, (WY - 0.2) / 2, (z0 + z1) / 2, 0.5, -WY + 0.2, L + 0.3, hex('#8E887C'), yawOf(x1 - x0, z1 - z0), 0, 0, 1, NO); }
    // 碰撞：每格一个不可见网格
    const colMesh = (T, y, name) => {
      for (const [key, c] of Object.entries(T)) {
        const P = [], I = c.i.slice(); for (let j = 0; j < c.p.length; j += 2) P.push(c.p[j], typeof y === 'function' ? y(c.p[j], c.p[j + 1]) : y, c.p[j + 1]);
        const m = new B.Mesh(name + key, this.scene), vd = new B.VertexData(); vd.positions = P; vd.indices = I; vd.normals = []; B.VertexData.ComputeNormals(P, I, vd.normals); vd.applyToMesh(m);
        m.parent = k.root; m.isVisible = false; m.checkCollisions = true; m.isPickable = true; m.metadata = { collider: true }; m.computeWorldMatrix(true); m.freezeWorldMatrix(); k.colliders.push(m);
      }
    };
    colMesh(FZR.land, 0, 'fzrLand'); colMesh(FZR.water, levelAt, 'fzrWater');
    // 水面上一点点亮纹（不规则短条），远看不死板
    // 2C：白马河加长了 —— 1A / 2B 那段的亮纹照旧（同一个计数器、同样的位置），2C 下段另起一个计数器接着画
    let i = 0; const ext = [];
    for (const [id, r] of Object.entries(RIVERS)) { if (FZR.b3 && (id === 'jn' || id === 'fb')) continue; if (FZR.a4 && id === 'gw') continue;   // 3B / 4A 亮纹在各自白天组（夜里关掉，draw ≤ 昼）
      const end = id === 'bm' && FZR.c2 ? FZR.c2.bmALen : id === 'gm' && FZR.a3 ? FZR.a3.gmALen : r.line.len; let s = 6;
      for (; s < end - 6; s += 13) { const a = r.line.at(s, ((i++ * 37) % 11 - 5) / 6 * r.hw * 0.6); if (inChamber(a.x, a.z)) continue; WA.box(a.x, levelAt(a.x, a.z) + 0.004, a.z, 0.25, 0.004, 4.5, hex('#8FC0C8'), yawOf(a.tx, a.tz), 0, 0, 1, NO); }
      if (end < r.line.len && !(id === 'gm' && FZR.a3)) ext.push([r, s]); }
    let j = 0; for (const [r, s0] of ext) for (let s = s0; s < r.line.len - 6; s += 13) { const a = r.line.at(s, ((j++ * 37) % 11 - 5) / 6 * r.hw * 0.6); WA.box(a.x, WY + 0.004, a.z, 0.25, 0.004, 4.5, hex('#8FC0C8'), yawOf(a.tx, a.tz), 0, 0, 1, NO); }
  }
  /* ---------- 2A 西湖船闸（小美：深灰钢人字闸门，顶上走道 + 栏杆，门缝两边红白警示条；闸室墙上水位刻度线；不写字、不画箭头）---------- */
  /** 闸室局部坐标 → W：a 顺水（闸室中点 0，下游 +），b 横向（LOCK.n 方向） */
  lockP(a, b) { const L = LOCK; return [L.mid[0] + L.t[0] * a + L.n[0] * b, L.mid[1] + L.t[1] * a + L.n[1] * b]; }
  lockStatic() {
    const L = LOCK, k = this.kit, GR = k.g('granite'), P = k.solid, half = (L.s[1] - L.s[0]) / 2, ryT = yawOf(L.t[0], L.t[1]), ryN = yawOf(L.n[0], L.n[1]);
    const RED = hex('#C62828'), WHITE = hex('#F4F1EA'), BLACK = hex('#22262A');
    // 水位刻度尺（小美 11-14 第二版）：直接贴在闸墙上的红白竖条，宽 0.3 m、0.1 m 一格；上游头、下游头各一条（同一侧墙，面向闸室）；
    // 低水位旁标「0」、高水位旁标「0.5」——船降下去时数得出降了 5 格
    const yLo = WY - 0.3, yHi = WY + L.rise + 0.3, GS = 1;
    // 数字用方块拼（七段式，高 0.2 m、笔画 0.035 m，黑色），和刻度条同一套朝向，贴墙不翘
    const SEG = { 0: 'abcdef', 5: 'acdfg' }, sw = 0.035, dw = 0.11, dh = 0.2;
    const sgn = L.n[0] * L.t[1] - L.n[1] * L.t[0] > 0 ? -1 : 1;   // 站在闸室里面朝墙（朝 +n）：看过去的「右」沿 sgn·t
    const digit = (a0, y0, ch) => { const segs = SEG[ch];
      const put = (u, y, w, h) => { const [x, z] = this.lockP(a0 + sgn * u, GS * (L.hw - 0.02)); P.box(x, y, z, w, h, 0.02, BLACK, ryN, 0, 0, 1, NO); };
      if (segs.includes('a')) put(0, y0 + dh / 2, dw, sw); if (segs.includes('g')) put(0, y0, dw, sw); if (segs.includes('d')) put(0, y0 - dh / 2, dw, sw);
      if (segs.includes('f')) put(-dw / 2, y0 + dh / 4, sw, dh / 2); if (segs.includes('b')) put(dw / 2, y0 + dh / 4, sw, dh / 2);
      if (segs.includes('e')) put(-dw / 2, y0 - dh / 4, sw, dh / 2); if (segs.includes('c')) put(dw / 2, y0 - dh / 4, sw, dh / 2); };
    for (const a of [-half + 2.85, half - 2.85]) {
      const [x, z] = this.lockP(a, GS * (L.hw - 0.012));
      for (let y = yLo, i = 0; y < yHi - 1e-6; y += 0.1, i++) P.box(x, y + 0.05, z, 0.3, 0.1, 0.024, i % 2 ? WHITE : RED, ryN, 0, 0, 1, NO);
      for (const [y, txt] of [[WY, '0'], [WY + L.rise, '05']]) {
        const [mx, mz] = this.lockP(a, GS * (L.hw - 0.03)); P.box(mx, y, mz, 0.44, 0.022, 0.02, BLACK, ryN, 0, 0, 1, NO);   // 该水位一道黑短线
        const u0 = sgn * (0.15 + 0.06 + dw / 2), step = sgn * (dw + 0.07);
        if (txt === '0') digit(a + u0, y + 0.17, '0');
        else { digit(a + u0, y + 0.17, '0'); const [px, pz] = this.lockP(a + u0 + step * 0.75, GS * (L.hw - 0.02)); P.box(px, y + 0.17 - dh / 2 + sw / 2, pz, sw, sw, 0.02, BLACK, ryN, 0, 0, 1, NO); digit(a + u0 + step * 1.5, y + 0.17, '5'); }
      }
    }
    // 门龛：每扇门开到贴墙（约 90°）时收进墙上一个门龛——龛底深色衬板 + 龛尾一道花岗岩挡墩（门扇长 ~1.9 m）
    for (const [a0, dir] of [[-half, 1], [half, -1]]) for (const sd of [-1, 1]) {
      const aE = a0 + dir * 2.15, [bx, bz] = this.lockP((a0 + aE) / 2, sd * (L.hw - 0.01)), [px, pz] = this.lockP(aE + dir * 0.2, sd * (L.hw - 0.27));
      P.box(bx, (WY - 0.6) / 2, bz, 0.02, -(WY - 0.6), 2.15, hex('#2B2F33'), ryT, 0, 0, 1, NO);
      GR.box(px, (WY - 0.7) / 2, pz, 0.54, -(WY - 0.7), 0.4, hex('#8E887C'), ryT, 0, 0, 1, NO);
    }
    // 闸门两侧的门墩（花岗岩，顶面略高出岸地）
    for (const a of [-half, half]) for (const sd of [-1, 1]) { const [x, z] = this.lockP(a, sd * (L.hw + 0.35)); GR.box(x, (WY - 0.4 + 0.18) / 2, z, 0.7, 0.18 - (WY - 0.4), 1.1, hex('#8E887C'), ryT, 0, 0, 1, NO); }
  }
  lockGates() {
    const L = LOCK, half = (L.s[1] - L.s[0]) / 2, M = this.kit.M;
    const STEEL = hex('#474C52'), RIB = hex('#363A3F'), WALK = hex('#6B7075'), RAIL = hex('#2E3236'), RED = hex('#C62828'), WHITE = hex('#F4F1EA');
    const hinge = L.hw - 0.3, Lf = hinge / Math.cos(0.32) + 0.03, y0 = WY - 0.6, y1 = 0.0, T = 0.34;   // 斜接角 18°
    const g = new Geo(), o = NO;
    g.box(Lf / 2, (y0 + y1) / 2, 0, Lf, y1 - y0, T, STEEL, 0, 0, 0, 1, o);
    for (let y = y0 + 0.5; y < y1 - 0.2; y += 0.5) for (const sz of [-1, 1]) g.box(Lf / 2, y, sz * (T / 2 + 0.02), Lf - 0.1, 0.07, 0.04, RIB, 0, 0, 0, 1, o);   // 横肋
    for (const xx of [0.06, Lf * 0.5]) for (const sz of [-1, 1]) g.box(xx, (y0 + y1) / 2, sz * (T / 2 + 0.02), 0.08, y1 - y0, 0.04, RIB, 0, 0, 0, 1, o);   // 竖肋
    g.box(Lf / 2, y1 + 0.03, 0, Lf, 0.06, 0.56, WALK, 0, 0, 0, 1, o);   // 顶上走道（开门时贴墙不穿墙：门轴离墙 0.3 m）
    for (const sz of [-1, 1]) {
      g.box(Lf / 2, y1 + 1.0, sz * 0.25, Lf, 0.05, 0.05, RAIL, 0, 0, 0, 1, o); g.box(Lf / 2, y1 + 0.55, sz * 0.25, Lf, 0.035, 0.035, RAIL, 0, 0, 0, 1, o);
      for (let xx = 0.05; xx <= Lf; xx += Lf / 3) g.box(xx, y1 + 0.5, sz * 0.25, 0.045, 1.0, 0.045, RAIL, 0, 0, 0, 1, o);
    }
    // 门缝一侧的红白警示条（两面 + 端面，0.25 m 一段）
    for (let y = y0 + 0.3, i = 0; y < y1; y += 0.25, i++) { const c = i % 2 ? WHITE : RED, h = Math.min(0.25, y1 - y); g.box(Lf - 0.08, y + h / 2, 0, 0.17, h, T + 0.02, c, 0, 0, 0, 1, o); }
    const src = g.toMesh('fzLockLeaf', this.scene, M.solid, this.kit.root); src.isVisible = false; src.isPickable = false;
    this.lock = { leaves: [], water: null };
    for (const [gk, a] of [['gU', -half], ['gD', half]]) for (const sd of [-1, 1]) {
      const piv = new B.TransformNode('fzLockPiv', this.scene); piv.parent = this.kit.root;
      const [hx, hz] = this.lockP(a, sd * hinge); piv.position.set(hx, 0, hz);
      const m = src.createInstance('fzLockLeafI'); m.parent = piv; m.isPickable = false;
      // 关：从门轴指向河中、略朝上游（-t）18°；开：贴着闸室墙转进闸室里（上闸门朝下游 +t、下闸门朝上游 -t），不伸到闸外
      const cx = -sd * L.n[0] * Math.cos(0.32) - L.t[0] * Math.sin(0.32), cz = -sd * L.n[1] * Math.cos(0.32) - L.t[1] * Math.sin(0.32);
      const thC = Math.atan2(-cz, cx), dir = gk === 'gU' ? 1 : -1, thO0 = Math.atan2(-dir * L.t[1], dir * L.t[0]); let d = thO0 - thC; d = ((d + Math.PI) % TAU + TAU) % TAU - Math.PI;
      this.lock.leaves.push({ gk, piv, thC, d });
    }
    // 闸室水面：一块平面，高度跟着 LOCK_STATE.lvl
    const wg = new Geo(), WC = hex('#2F6670'), [cx0, cz0] = this.lockP(0, 0);
    wg.box(0, -0.005, 0, 2 * L.hw + 0.02, 0.01, 2 * half + 0.02, WC, 0, 0, 0, 1, o);
    const wm = wg.toMesh('fzLockWater', this.scene, bucketMat(this.scene, M, 'paint@sea'), this.kit.root); wm.isPickable = false;
    wm.position.set(cx0, WY, cz0); wm.rotation.y = yawOf(L.t[0], L.t[1]); this.lock.water = wm;
    this.lockPose();
  }
  lockPose() {
    const S = LOCK_STATE, ease = u => u * u * (3 - 2 * u);
    for (const l of this.lock.leaves) l.piv.rotation.y = l.thC + l.d * ease(S[l.gk]);
    this.lock.water.position.y = WY + S.lvl;
  }
  /** 门扇和门轴线的夹角（度，0 = 关；全开贴闸室墙：上闸门约 108、下闸门约 72）：单测 / e2e 用 */
  lockAngles() { return this.lock ? this.lock.leaves.map(l => ({ g: l.gk, deg: +(Math.abs(l.d) * (LOCK_STATE[l.gk] ? ((u => u * u * (3 - 2 * u))(LOCK_STATE[l.gk])) : 0) * 180 / Math.PI).toFixed(1) })) : []; }
  /* ---------- 驳岸：墙面常开；压顶石 + 石栏（近处细节）+ 碰撞 ---------- */
  wallFaces() {
    const GR = this.kit.g('granite'), col = hex(WALLC), dark = hex('#6E685C');
    for (const w of FZR.wall) {
      if (w[4] === 3 || w[4] === 5) continue;   // 5 = 2D 琼东河口矮挡墙（walls 里画），不画整面岸墙
      const mx = (w[0] + w[2]) / 2, mz = (w[1] + w[3]) / 2;
      if (this._d2epass && inD2E(mx, mz)) continue;   // 已进细节格子，避免 400 m 岸墙合成一个包围盒
      if (!this.c2ok(mz, mx)) continue;
      this.wallFaceOne(w, GR, col);
    }
  }
  wallFaceOne(w, GR, col) {
    GR = GR || this.kit.g('granite'); col = col || hex(WALLC);
    let [ax, az, bx, bz] = w; if (w[5] > 0) [ax, az, bx, bz] = [bx, bz, ax, az];   // 法线朝水
    GR.quad([ax, 0.02, az], [bx, 0.02, bz], [bx, WY - 0.4, bz], [ax, WY - 0.4, az], col);
    const L = Math.hypot(bx - ax, bz - az);
    // 压顶条石（常开：远看河岸一道亮线）
    const dx = (bx - ax) / L, dz = (bz - az) / L, lx = dz * w[5], lz = -dx * w[5];   // l = 朝岸上
    GR.box((ax + bx) / 2 - lx * 0.3, 0.03, (az + bz) / 2 - lz * 0.3, 0.6, 0.06, L + 0.02, hex(COPING), yawOf(dx, dz), 0, 0, 1, NO);
  }
  walls() {
    const k = this.kit;
    if (FZR.d2) for (const w of FZR.wall) {   // 2D 东段岸墙面进格子（同楼）：常开压顶远看仍在格子距离里一道线
      const mx = (w[0] + w[2]) / 2, mz = (w[1] + w[3]) / 2;
      if (inD2E(mx, mz) && w[4] !== 3 && w[4] !== 5) this.det(mx, mz, () => this.wallFaceOne(w));
    }
    for (const w of FZR.wall) {
      const [ax, az, bx, bz, flag, sg] = w, L = Math.hypot(bx - ax, bz - az); if (L < 0.05) continue;
      const dx = (bx - ax) / L, dz = (bz - az) / L, rx = dz * sg, rz = -dx * sg, ry = yawOf(dx, dz), mx = (ax + bx) / 2, mz = (az + bz) / 2;   // r = 朝水
      if (flag === 0) {
        k.col(mx - rx * 0.12, 0.6, mz - rz * 0.12, 0.3, 1.2, L, { ry });
        this.det(mx, mz, () => {
          const GR = k.g('granite'), n = Math.max(1, Math.round(L / 2.3));
          GR.box(mx - rx * 0.12, 0.74, mz - rz * 0.12, 0.16, 0.1, L, hex('#B5AE9F'), ry, 0, 0, 1, NO);   // 扶手条石
          for (let i = 0; i <= n; i++) { const t = i / n; GR.box(ax + (bx - ax) * t - rx * 0.12, 0.38, az + (bz - az) * t - rz * 0.12, 0.2, 0.72, 0.2, hex('#A8A193'), ry, 0, 0, 1, NO); }
        });
      } else if (flag === 2) {   // 河道尽头：暗洞（河继续往外流）+ 挡墙
        k.col(mx - rx * 0.3, 1, mz - rz * 0.3, 0.6, 8, L, { ry, name: 'colCap' });
        const GR = k.g('granite');
        GR.box(mx + rx * 0.35, WY + 1.1, mz + rz * 0.35, 0.7, 3.1, L + 0.4, hex('#7C766A'), ry, 0, 0, 1, NO);
        k.solid.box(mx + rx * 0.0, WY + 0.75, mz + rz * 0.0, 0.05, 1.6, Math.max(1, L - 3), hex('#141A1C'), ry, 0, 0, 1, NO);
      } else if (flag === 3) k.col(mx - rx * 0.2, 0.5, mz - rz * 0.2, 0.4, 8, L, { ry, name: 'colLake' });
      else if (flag === 4) k.col(mx - rx * 0.3, 1, mz - rz * 0.3, 0.6, 8, L, { ry, name: 'colCap' });   // 2C 口门：彬德水闸外就是闽江（闸在 c2Static 里画），不画暗洞
      else if (flag === 5) {   // 2D 琼东河口：一道矮挡墙（条石，顶面高出水面 0.7 m），墙外远景水面接着流（不画暗洞、不画整面岸墙）；可见几何在 d2Static，避免进常开 g0
        k.col(mx, 1, mz, 0.7, 8, L + 0.6, { ry, name: 'colCap' }); }
    }
  }
  /* ---------- 可走范围外圈：看不见的高墙 ---------- */
  boundary() {
    const b = FZR.bound, k = this.kit;
    for (let i = 0; i < b.length - 1; i++) {
      const [ax, az] = b[i], [bx, bz] = b[i + 1], L = Math.hypot(bx - ax, bz - az); if (L < 0.05) continue;
      k.col((ax + bx) / 2, 1, (az + bz) / 2, 0.5, 10, L + 0.3, { ry: yawOf(bx - ax, bz - az), name: 'colBound' });
    }
  }
  /* ---------- 桥 ---------- */
  bridgeFrame(b) {
    const t = b.t, n = b.n;
    return { P: (u, v) => [b.x + t[0] * u + n[0] * v, b.z + t[1] * u + n[1] * v], ryN: yawOf(n[0], n[1]), ryT: yawOf(t[0], t[1]) };
  }
  /** 桥面坡道碰撞体：沿 n 从 v0 到 v1，高度 y0 → y1 */
  ramp(b, v0, v1, y0, y1, u0, u1, th = 0.3, name = 'col') {
    const F = this.bridgeFrame(b), L = Math.hypot(v1 - v0, y1 - y0), [cx, cz] = F.P((u0 + u1) / 2, (v0 + v1) / 2), ang = Math.atan2(y1 - y0, v1 - v0);
    const nrm = th / 2 / Math.cos(ang);
    return this.kit.col(cx, (y0 + y1) / 2 - nrm, cz, Math.abs(u1 - u0), th, L, { ry: F.ryN, rx: -ang, name });
  }
  bridges() {
    // 碰撞体 + 栏杆（近处细节）；桥身（拱、桥面、栏板）在 bridgeBodies 里常开
    const k = this.kit;
    if (FZR.d2 && !this._c2pass && this._nPass === undefined && !this._d2epass) {
      for (const b of BRIDGES) if (inD2E(b.x, b.z)) this.det(b.x, b.z, () => { this._d2eBr = b; this.bridgeBodies(); this._d2eBr = null; });
    }
    for (const b of BRIDGES) {
      if (!!b.c2 !== !!this._c2pass || (this._c2pass && c2Band(b.z) !== this._c2band)) continue;
      const F = this.bridgeFrame(b), half = b.half, w = b.w, rise = humpRise(b);
      if (!rise) {
        const [cx, cz] = F.P(0, 0), dY = (b.tall && b.deckY) ? b.deckY : 0, rampL = b.rampL || 0;
        k.col(cx, dY - 0.2, cz, w, 0.4, 2 * half, { ry: F.ryN, name: 'colDeck' });
        const pH = dY ? (b.barrier || 2.2) : 1.2;
        for (const su of [-1, 1]) { const [px, pz] = F.P(su * (w / 2 - 0.15), 0); k.col(px, dY + pH / 2, pz, 0.3, pH, 2 * half - 0.2, { ry: F.ryN, name: 'colParapet' }); }
        if (dY && rampL) for (const sv of [-1, 1]) {
          this.ramp(b, sv * half, sv * (half + rampL), dY, 0, -w / 2, w / 2, 0.3, 'colDeck');
          for (const su of [-1, 1]) this.ramp(b, sv * half, sv * (half + rampL), dY + pH * 0.7, pH * 0.7, su * (w / 2 - 0.3), su * (w / 2), 0.4, 'colParapet');
        }
      } else {
        const N = 6;
        for (let i = 0; i < N; i++) { const v0 = -half + 2 * half * i / N, v1 = -half + 2 * half * (i + 1) / N; this.ramp(b, v0, v1, deckAt(b, v0), deckAt(b, v1), -w / 2, w / 2, 0.3, 'colDeck');
          for (const su of [-1, 1]) this.ramp(b, v0, v1, deckAt(b, v0) + 1.25, deckAt(b, v1) + 1.25, su * (w / 2 - 0.3), su * (w / 2), 2.5, 'colParapet'); }
      }
    }
  }
  bridgeBodies() {
    const k = this.kit, GR = k.g('granite'), P = k.solid, A = this.atlas;
    for (const b of BRIDGES) {
      if (this._d2eBr) { if (b !== this._d2eBr) continue; }
      else if (!!b.c2 !== !!this._c2pass || (this._c2pass ? c2Band(b.z) !== this._c2band : this._d2epass ? !inD2E(b.x, b.z) : (this._nPass !== undefined && (inD2E(b.x, b.z) || zStrip(b.z) !== this._nPass)))) continue;
      if (this._d2epass && inD2E(b.x, b.z)) continue;   // 已进细节格子
      const F = this.bridgeFrame(b), half = b.half, w = b.w, rise = humpRise(b), hw = b.hw, dY = (b.tall && b.deckY) ? b.deckY : 0;
      if (b.kind === 'bingde') this.bingde(b);
      else if (!rise && b.kind !== 'sarch') {
        const [cx, cz] = F.P(0, 0), road = b.kind === 'road';
        GR.box(cx, dY - 0.2, cz, w, 0.4, 2 * half, hex(road ? '#9C978C' : '#A39C8E'), F.ryN, 0, 0, 1, NO);
        if (road && ((FZR.a3 && (FZR.a3.bridges || []).includes(b.id)) || (FZR.a4 && (FZR.a4.bridges || []).includes(b.id)) || (FZR.a6 && (FZR.a6.bridges || []).includes(b.id)) || b.a4 || b.a6 || b.b3 || (FZR.b3 && FZR.b3.grey && FZR.b3.grey.bridges.includes(b.id)))) this.a3Deck(b, F, w, half);   // 3B 路桥同款（小美 3A：不用 asphalt 桶）   // 小美 11-17：3A 路桥桥面 = 深灰沥青 + 标线（原 asphalt 材质反天光，白天像一块深蓝的洞）
        else if (road) k.g('asphalt').box(cx, 0.008, cz, w - 1.6, 0.012, 2 * half, hex('#7E8084'), F.ryN, 0, 0, 1, NO);
        // 桥墩：贴岸墙的两块（不进水道中间，船好过）
        const U = [...(FZR.unders || []), ...(FZR.undersC || [])].find(u => u.bridge === b.id);
        const pierTop = dY > 0 ? dY - 0.4 : -0.4;
        for (const sv of [-1, 1]) { if (U && sv === U.side) continue; const [px, pz] = F.P(0, sv * (hw - 0.35)); GR.box(px, (WY - 0.4 + pierTop) / 2, pz, w + 0.3, pierTop - (WY - 0.4), 0.7, hex('#8E887C'), F.ryN, 0, 0, 1, NO); }
        for (const su of [-1, 1]) {
          const [px, pz] = F.P(su * (w / 2 - 0.15), 0);
          if (b.kind === 'foot') { k.metal.box(px, 1.0, pz, 0.06, 0.06, 2 * half - 0.2, hex('#4A5560'), F.ryN, 0, 0, 1, NO); for (let v = -half + 0.2; v <= half - 0.1; v += 1.6) { const [qx, qz] = F.P(su * (w / 2 - 0.15), v); k.metal.box(qx, 0.5, qz, 0.05, 1.0, 0.05, hex('#4A5560'), 0, 0, 0, 1, NO); } }
          else if (b.kind === 'covered') { P.box(px, 0.45, pz, 0.12, 0.9, 2 * half - 0.2, hex('#8B3A2B'), F.ryN, 0, 0, 1, NO); }
          else if (b.tall) { const H = b.barrier || 2.2; GR.box(px, dY + H / 2, pz, 0.36, H, 2 * half - 0.2, hex('#A8A193'), F.ryN, 0, 0, 1, NO); }   // 6A 北二环：抬高桥面 + 高声屏障，比北浪路 1 m 栏板明显更高
          else GR.box(px, 0.5, pz, 0.3, 1.0, 2 * half - 0.2, hex('#B1AA9C'), F.ryN, 0, 0, 1, NO);
        }
        if (b.tall) {   // 更深的主梁 + 中央分隔带；抬高后梁底在 deckY-1.3，岸上能从桥下走过
          GR.box(cx, dY - 0.85, cz, w, 0.9, 2 * half, hex('#8A8476'), F.ryN, 0, 0, 1, NO);
          GR.box(cx, dY + 1.05, cz, 0.5, 2.1, 2 * half - 0.4, hex('#9C978C'), F.ryN, 0, 0, 1, NO);
        }
        if (dY && (b.rampL || 0) > 0) {   // 两头坡道（沥青贴在斜板上）
          const rampL = b.rampL;
          for (const sv of [-1, 1]) {
            const v0 = sv * half, v1 = sv * (half + rampL), [rx, rz] = F.P(0, (v0 + v1) / 2);
            const L = Math.hypot(rampL, dY), ang = Math.atan2(0 - dY, v1 - v0);
            GR.box(rx, dY / 2, rz, w, 0.36, L, hex('#9C978C'), F.ryN, -ang, 0, 1, NO);
            k.g('granite').box(rx, dY / 2 + 0.2, rz, w - 1.6, 0.08, L, hex('#4E5155'), F.ryN, -ang, 0, 1, NO);
          }
        }
        if (b.kind === 'covered') this.pavilion(b);
      } else {
        // 拱桥（2C sarch：普通单拱平桥，同一套切片，桥面平 deckAt = 0）：沿 n 切片，每片从拱腹到桥面（拱洞看得见水）；桥面石 + 两侧望柱栏板
        const N = 28, Ruse = hw;
        for (let i = 0; i < N; i++) {
          const v0 = -half + 2 * half * i / N, v1 = -half + 2 * half * (i + 1) / N, vm = (v0 + v1) / 2;
          const yTop = deckAt(b, vm), yBot = Math.abs(vm) < Ruse ? soffitAt(b, vm) : WY - 0.4, [cx, cz] = F.P(0, vm);
          GR.box(cx, (yTop + yBot) / 2, cz, w, yTop - yBot, v1 - v0 + 0.02, hex('#9A9384'), F.ryN, 0, 0, 1, NO);
          if (Math.abs(vm) < Ruse) for (const su of [-1, 1]) { const [qx, qz] = F.P(su * (w / 2 + 0.03), vm); GR.box(qx, yBot + 0.18, qz, 0.06, 0.36, v1 - v0 + 0.02, hex('#C9C2B2'), F.ryN, 0, 0, 1, NO); }   // 拱券石（浅色一圈）
          for (const su of [-1, 1]) { const [qx, qz] = F.P(su * (w / 2 - 0.15), vm); GR.box(qx, yTop + 0.42, qz, 0.24, 0.84, v1 - v0 + 0.02, hex('#B5AE9F'), F.ryN, 0, 0, 1, NO); }   // 栏板
        }
        for (const su of [-1, 1]) for (let v = -half; v <= half + 0.01; v += half / 3) { const [qx, qz] = F.P(su * (w / 2 - 0.15), v); GR.box(qx, deckAt(b, v) + 0.6, qz, 0.32, 1.2, 0.32, hex('#A39C8E'), 0, 0, 0, 1, NO); }   // 望柱
        k.g('paint@sea').box(...F.P(0, 0).flatMap((c, j) => j ? [WY + 0.006, c] : [c]), w, 0.004, 2 * hw, hex('#1C4148'), F.ryN, 0, 0, 1, NO);   // 桥洞下的阴影
      }
      // 桥名牌（只有有名字的古桥 / 路桥挂古名；无名小桥不挂 —— 小美 ⑧）
      if (b.plate) {
        const uv = A.draw(1.8, 0.45, textPaint([b.plate], { bg: '#6E675B', fg: '#F2E2B0' }), 70);
        for (const su of [-1, 1]) { const [qx, qz] = F.P(su * (w / 2 + 0.02), 0); A.quad(qx, (b.deckY || 0) + deckAt(b, 0) + 0.45, qz, 1.8, 0.45, Math.atan2(b.t[0] * su, -b.t[1] * su), uv); }
      }
    }
  }
  /** 2C 彬德桥（古石桥，步行）：条石桥面略拱起、两座船形分水石墩（三孔）、两头石阶纹、低石栏 + 望柱；有桥名牌（在 bridgeBodies 末尾） */
  bingde(b) {
    const k = this.kit, GR = k.g('granite'), F = this.bridgeFrame(b), half = b.half, w = b.w, hw = b.hw, N = 26, TH = 0.42;
    const stone = hex('#9A9384'), edge = hex('#B9B2A2'), pierC = hex('#8A8476');
    for (let i = 0; i < N; i++) {
      const v0 = -half + 2 * half * i / N, v1 = -half + 2 * half * (i + 1) / N, vm = (v0 + v1) / 2, yTop = deckAt(b, vm), [cx, cz] = F.P(0, vm);
      const yBot = Math.abs(vm) < hw ? yTop - TH : WY - 0.4;   // 河面上：一层条石板；岸上：实心桥台
      GR.box(cx, (yTop + yBot) / 2, cz, w, yTop - yBot, v1 - v0 + 0.02, Math.abs(vm) < hw ? stone : hex(i % 2 ? '#A39C8E' : '#9A9385'), F.ryN, 0, 0, 1, NO);
      for (const su of [-1, 1]) { const [qx, qz] = F.P(su * (w / 2 + 0.02), vm); GR.box(qx, yTop - TH / 2, qz, 0.05, TH * 0.6, v1 - v0 + 0.02, edge, F.ryN, 0, 0, 1, NO); }   // 桥面石侧边（浅色一道）
      for (const su of [-1, 1]) { const [qx, qz] = F.P(su * (w / 2 - 0.12), vm); GR.box(qx, yTop + 0.28, qz, 0.2, 0.56, v1 - v0 + 0.02, hex('#B5AE9F'), F.ryN, 0, 0, 1, NO); }   // 低石栏
    }
    for (const su of [-1, 1]) for (let v = -half; v <= half + 0.01; v += half / 4) { const [qx, qz] = F.P(su * (w / 2 - 0.12), v); GR.box(qx, deckAt(b, v) + 0.42, qz, 0.26, 0.84, 0.26, hex('#A39C8E'), 0, 0, 0, 1, NO); }   // 望柱
    // 两座石墩（三孔）：墩身 + 两头尖的分水石（沿水流 t 方向）
    for (const sv of [-1, 1]) {
      const v = sv * hw / 3, yTop = deckAt(b, v) - TH, [px, pz] = F.P(0, v);
      GR.box(px, (yTop + WY - 0.4) / 2, pz, w + 0.4, yTop - (WY - 0.4), 1.0, pierC, F.ryN, 0, 0, 1, NO);
      for (const su of [-1, 1]) { const [qx, qz] = F.P(su * (w / 2 + 0.45), v); GR.box(qx, (WY + 0.6 + WY - 0.4) / 2, qz, 0.7, 1.0, 0.7, pierC, F.ryN + Math.PI / 4, 0, 0, 1, NO); }
      k.col(px, (yTop + WY - 0.4) / 2, pz, w + 0.4, yTop - (WY - 0.4), 1.0, { ry: F.ryN, name: 'colBridgePier' });
    }
    k.g('paint@sea').box(...F.P(0, 0).flatMap((c, j) => j ? [WY + 0.006, c] : [c]), w, 0.004, 2 * hw, hex('#1C4148'), F.ryN, 0, 0, 1, NO);   // 桥下阴影
  }
  /** 二桥亭桥：木构廊桥（柱子 + 两坡黛瓦顶） */
  pavilion(b) {
    const F = this.bridgeFrame(b), P = this.kit.solid, w = b.w, half = b.half - 0.4, wood = hex('#7B3B2A'), tile = hex('#33373C');
    for (const su of [-1, 1]) for (let v = -half; v <= half + 0.01; v += half / 3) { const [x, z] = F.P(su * (w / 2 - 0.2), v); P.box(x, 1.45, z, 0.22, 2.9, 0.22, wood, F.ryN); }
    for (const su of [-1, 1]) { const [x, z] = F.P(su * w / 4, 0); P.box(x, 3.35, z, w / 2 + 0.6, 0.14, 2 * half + 1.2, tile, F.ryN, 0, su * -0.42, 1, NO); }
    const [x, z] = F.P(0, 0); P.box(x, 3.68, z, 0.3, 0.2, 2 * half + 1.4, tile, F.ryN, 0, 0, 1, NO);
  }
  /* ---------- 码头：台阶下到浮码头 + 码头牌 ---------- */
  pierFrame(p) { const t = p.t, n = p.n; return { P: (a, b) => [p.x + t[0] * a - n[0] * b, p.z + t[1] * a - n[1] * b], ryT: yawOf(t[0], t[1]), ryN: yawOf(n[0], n[1]) }; }
  stairAlong(F, a0, a1, b0, b1, y0, y1, steps, opts = {}) {
    // 沿 t（a）从 a0（高 y0）到 a1（低 y1）的石阶；碰撞：一块斜板（+ 可选外侧扶手）
    const k = this.kit, GR = k.g('granite'), L = Math.hypot(a1 - a0, y1 - y0), ang = Math.atan2(y0 - y1, a1 - a0), [cx, cz] = F.P((a0 + a1) / 2, (b0 + b1) / 2);
    (this._stairs || (this._stairs = new Map())).set([cx, cz, a0, a1].map(v => v.toFixed(2)).join(','), { F, a0, a1, b0, b1, y0, y1, steps });   // 3C：夜里踏步边沿的暗暖光线
    k.col(cx, (y0 + y1) / 2 - 0.15 / Math.cos(ang), cz, Math.abs(b1 - b0), 0.3, L, { ry: F.ryT, rx: ang, name: 'colStair' });
    for (let i = 0; i < steps; i++) {
      const aa = a0 + (a1 - a0) * i / steps, ab = a0 + (a1 - a0) * (i + 1) / steps, yy = y0 + (y1 - y0) * (i + 0.5) / steps, [sx, sz] = F.P((aa + ab) / 2, (b0 + b1) / 2);
      GR.box(sx, (yy + WY - 0.4) / 2, sz, Math.abs(b1 - b0), yy - (WY - 0.4), Math.abs(ab - aa) + 0.01, hex(i % 2 ? '#A39C8E' : '#9A9385'), F.ryT, 0, 0, 1, NO);
    }
    if (opts.rail) { const [rx, rz] = F.P((a0 + a1) / 2, b1 - 0.06); k.col(rx, (y0 + y1) / 2 + 0.6, rz, 0.12, 1.2, L, { ry: F.ryT, rx: ang, name: 'colStairRail' });
      k.metal.box(rx, (y0 + y1) / 2 + 0.95, rz, 0.06, 0.06, L, hex('#4A5560'), F.ryT, ang, 0, 1, NO);
      for (let i = 0; i <= 4; i++) { const a = a0 + (a1 - a0) * i / 4, [px, pz] = F.P(a, b1 - 0.06), y = y0 + (y1 - y0) * i / 4; k.metal.box(px, y + 0.48, pz, 0.05, 0.96, 0.05, hex('#4A5560'), 0, 0, 0, 1, NO); } }
  }
  piers() {
    const k = this.kit, GR = k.g('granite'), P = k.solid, A = this.atlas;
    for (const p of PIERS) {
      if (!this.c2ok(p.z)) continue;   // 2C 的码头（上海西）在 2C 分段里画
      if (p.shared) continue;   // 2C 西水关 C 线泊位：共用 A 线台阶 + 码头牌，栈道 / 浮码头在 c2Static 里画
      const top = levelAt(p.berth[0], p.berth[1]) + 0.45;   // 浮码头面 = 船甲板（西湖码头在闸上游，高 0.5 m）
      const F = this.pierFrame(p);
      this.stairAlong(F, -10, -3.6, 0, 1.5, 0, top, 14, { rail: true });
      // 湖边码头（西湖）：湖岸线是弯的，台阶靠岸一侧和岸地之间空着一条 0.7 m 宽的水缝 —— 下船走上台阶顶，一脚踩进缝里掉下去、回不到岸上（小美 1A 验收 ①）。
      // 补一道贴着台阶的花岗岩岸墙（顶面和岸地齐平、带碰撞），台阶顶直接接上岸地。河边码头台阶本来就贴着岸地，不加。
      // 所有码头：台阶靠岸一侧的岸地底下垫一块实心碰撞体（岸地只是一层没有厚度的三角网，人从半截台阶横着往岸上走会钻到岸地下面掉下去）
      { const [qx, qz] = F.P(-10, -0.3), [cx, cz] = F.P(-7.3, -0.4), y0 = WY - 0.4, y1 = -0.004;
        if (!isLand(qx, qz)) GR.box(cx, (y0 + y1) / 2, cz, 0.8, y1 - y0, 7.4, hex('#9A9385'), F.ryT, 0, 0, 1, NO);
        k.col(cx, (y0 + y1) / 2, cz, 0.8, y1 - y0, 7.4, { ry: F.ryT, name: 'colQuay' }); }
      // 台阶顶平台：台阶顶外侧（a < -10）原来是空的水面，上到台阶顶一步走过头就掉下去；补 1 m 花岗岩平台 + 外侧栏杆，上岸从平台转身进岸墙缺口
      { const y0 = WY - 0.4, y1 = -0.004, [cx, cz] = F.P(-10.5, 0.75);
        GR.box(cx, (y0 + y1) / 2, cz, 1.5, y1 - y0, 1.0, hex('#A39C8E'), F.ryT, 0, 0, 1, NO); k.col(cx, (y0 + y1) / 2, cz, 1.5, y1 - y0, 1.0, { ry: F.ryT, name: 'colStairHead' });
        const [ex, ez] = F.P(-10.96, 0.75), [sx, sz] = F.P(-10.5, 1.44);
        k.col(ex, 0.6, ez, 1.5, 1.2, 0.08, { ry: F.ryT, name: 'colStairHeadRail' }); k.col(sx, 0.6, sz, 0.12, 1.2, 1.0, { ry: F.ryT, name: 'colStairHeadRail' });
        k.metal.box(ex, 0.95, ez, 1.5, 0.06, 0.06, hex('#4A5560'), F.ryT, 0, 0, 1, NO); k.metal.box(sx, 0.95, sz, 0.06, 0.06, 1.0, hex('#4A5560'), F.ryT, 0, 0, 1, NO);
        for (const [a, b] of [[-10.96, 0.06], [-10.96, 1.44], [-10.0, 1.44]]) { const [px, pz] = F.P(a, b); k.metal.box(px, 0.48, pz, 0.05, 0.96, 0.05, hex('#4A5560'), 0, 0, 0, 1, NO); } }
      // 浮码头：木面 + 深色浮箱
      const [cx, cz] = F.P(2.4, 1.35);
      P.box(cx, top - 0.06, cz, 2.7, 0.12, 12, hex('#9C7A55'), F.ryT, 0, 0, 1, NO);
      P.box(cx, top - 0.3, cz, 2.6, 0.36, 11.8, hex('#3E4549'), F.ryT, 0, 0, 1, NO);
      k.col(cx, top - 0.2, cz, 2.7, 0.4, 12, { ry: F.ryT, name: 'colPontoon' });
      for (let a = -3; a <= 8; a += 2.2) { const [x, z] = F.P(a, 2.55); P.cyl(x, top + 0.18, z, 0.18, 0.36, hex('#2B2F33'), 8); }   // 系船桩
      for (let a = -3.4; a <= 8.2; a += 1.45) for (let j = 0; j < 1; j++) { const [x, z] = F.P(a, 0.08); P.box(x, top + 0.02, z, 0.08, 0.02, 0.6, hex('#E7C23C'), F.ryN, 0, 0, 1, NO); }   // 岸边黄线
      this.pierSign(p);
    }
  }
  /** 码头牌（小美 ⑤）：深灰石座 + 木色牌面；大字中文码头名、下面一行小英文、线路 A线、下一站；不画箭头、不画线路图 */
  pierSign(p) {
    const k = this.kit, A = this.atlas, [x, z] = p.sign, fx = -p.n[0], fz = -p.n[1];   // 牌面朝河（站在步道上读）
    const ry = yawOf(fx, fz), c = Math.cos(ry), s = Math.sin(ry);
    // 深灰石台（座 + 一圈石帽），不要发黑的方块；stopOnly（新港闸 / 魁岐）尤其要看得出是石头
    k.g('granite').box(x, 0.32, z, 2.0, 0.64, 0.62, hex('#6A7076'), ry, 0, 0, 1, NO);
    k.g('granite').box(x, 0.66, z, 2.16, 0.08, 0.78, hex('#8A9096'), ry, 0, 0, 1, NO);
    k.solid.box(x, 1.55, z, 1.75, 1.7, 0.12, hex('#8B6844'), ry, 0, 0, 1, NO);        // 木牌
    k.col(x, 0.9, z, 1.9, 1.8, 0.5, { ry, name: 'colSign' });
    // 2C：一座码头几条船线（西水关：A 线 + C 线，C 线泊位 xsgc 共用这块牌）→ 每条线一行：线路章 + 下一站
    const rows = [p.id, ...PIERS.filter(q => q.shared === p.id).map(q => q.id)].flatMap(id => routesOfPier(id).map(rid => ({ rid, nx: pierNext(id, rid) })));
    const nx = rows.length ? rows[0].nx : pierNext(p.id);
    const paint = (cv, pw, ph) => {
      cv.fillStyle = '#A27A50'; cv.fillRect(0, 0, pw, ph);
      for (let i = 0; i < 9; i++) { cv.fillStyle = `rgba(70,40,20,${0.05 + (i % 3) * 0.03})`; cv.fillRect(0, ph * i / 9 + 2, pw, 2); }   // 木纹
      cv.strokeStyle = '#5E4128'; cv.lineWidth = ph * 0.025; cv.strokeRect(ph * 0.03, ph * 0.03, pw - ph * 0.06, ph - ph * 0.06);
      cv.fillStyle = '#2B1A0E'; cv.textAlign = 'center'; cv.textBaseline = 'middle';
      // 字号按牌宽收：码头名再长也不出框
      const fit = (txt, w8, size, font, x, y, maxW) => { cv.font = `${w8} ${size}px ${font}`; const m = cv.measureText(txt).width; if (m > maxW) cv.font = `${w8} ${size * maxW / m}px ${font}`; cv.fillText(txt, x, y); };
      if (p.stopOnly) { fit(p.zh, 800, ph * 0.22, FONT, pw / 2, ph * 0.42, pw * 0.86); fit(p.en, 600, ph * 0.1, FONT_EN, pw / 2, ph * 0.64, pw * 0.86); return; }   // 3A 魁岐停靠点：只写停靠点名（小美 3A ③：不写线路、下一站）
      fit(p.zh, 800, ph * 0.22, FONT, pw / 2, ph * 0.29, pw * 0.86);
      fit(p.en, 600, ph * 0.085, FONT_EN, pw / 2, ph * 0.48, pw * 0.86);
      cv.fillStyle = '#5E4128'; cv.fillRect(pw * 0.1, ph * 0.57, pw * 0.8, ph * 0.008);
      // 线路小圆章（A 线红 / B 线蓝灰 / C 线绿）+ 下一站；两条线时上下两行（字号略收）
      const R_ = rows.length ? rows : [{ rid: ROUTE.id || 'A', nx }], two = R_.length > 1;
      R_.forEach(({ rid, nx }, i) => {
        const cy = two ? ph * (0.67 + i * 0.18) : ph * 0.76, rr = two ? ph * 0.07 : ph * 0.09, sc = two ? 0.82 : 1;
        cv.fillStyle = LINE_COLOR[rid] || '#B3261E'; cv.beginPath(); cv.arc(pw * 0.16, cy, rr, 0, TAU); cv.fill();
        cv.fillStyle = '#FFF'; cv.textAlign = 'center'; cv.font = `800 ${ph * 0.085 * sc}px ${FONT}`; cv.fillText(rid + '线', pw * 0.16, cy + ph * 0.005);
        cv.fillStyle = '#2B1A0E'; cv.textAlign = 'left';
        fit('下一站  ' + nx.map(q => q.zh).join(' / '), 700, ph * 0.075 * sc, FONT, pw * 0.29, cy - ph * 0.04 * sc, pw * 0.66);
        fit('Next: ' + nx.map(q => q.en).join(' / '), 600, ph * 0.055 * sc, FONT_EN, pw * 0.29, cy + ph * 0.07 * sc, pw * 0.66);
      });
    };
    const uv = A.draw(1.65, 1.6, paint, 150);
    A.quad(x + s * 0.07, 1.55, z + c * 0.07, 1.65, 1.6, Math.atan2(fx, -fz), uv);
    A.quad(x - s * 0.07, 1.55, z - c * 0.07, 1.65, 1.6, Math.atan2(-fx, fz), uv);
  }
  /* ---------- 2C：西水关 C 线栈道 + 泊位、彬德水闸、闸边观景处 ---------- */
  c2Static() {
    this.sharedDecks();
  }
  /** 共用码头的第二条线泊位（2C 西水关 C 线 / 3A 光明港码头 D 线）：从浮码头下游端沿岸墙接出去的木栈道（和浮码头同高 = 船甲板），到泊位；外沿钢栏，泊位那段敞开（上下船） */
  sharedDecks() {
    const k = this.kit, P = k.solid, M = k.metal;
    for (const q of PIERS.filter(q => q.shared && q.deck)) {
      const top = levelAt(q.berth[0], q.berth[1]) + 0.45, G = P, Pp = q.deck.p, I = q.deck.i, base = G.p.length / 3, wood = hex('#9C7A55');
      for (let j = 0; j < Pp.length; j += 2) G.push(Pp[j], top, Pp[j + 1], 0, 1, 0, wood);
      for (let j = 0; j < I.length; j += 3) G.i.push(base + I[j], base + I[j + 1], base + I[j + 2]);   // 同岸地三角网的绕向（gen.py ccw_up）：朝上
      // 浮箱侧面（深色）：沿栈道外轮廓一圈
      const R = q.deckRing, n = R.length / 2;
      for (let j = 0; j < n; j++) { const ax = R[2 * j], az = R[2 * j + 1], bx = R[(2 * j + 2) % R.length], bz = R[(2 * j + 3) % R.length]; P.quad([ax, top - 0.01, az], [bx, top - 0.01, bz], [bx, top - 0.48, bz], [ax, top - 0.48, az], hex('#3E4549')); P.quad([bx, top - 0.01, bz], [ax, top - 0.01, az], [ax, top - 0.48, az], [bx, top - 0.48, bz], hex('#3E4549')); }
      // 碰撞：栈道面一块三角网（同岸地）
      const cp = []; for (let j = 0; j < Pp.length; j += 2) cp.push(Pp[j], top, Pp[j + 1]);
      const m = new B.Mesh('fzrDeckC', this.scene), vd = new B.VertexData(); vd.positions = cp; vd.indices = I.slice(); vd.normals = []; B.VertexData.ComputeNormals(cp, vd.indices, vd.normals); vd.applyToMesh(m);
      m.parent = k.root; m.isVisible = false; m.checkCollisions = true; m.isPickable = true; m.metadata = { collider: true }; m.computeWorldMatrix(true); m.freezeWorldMatrix(); k.colliders.push(m);
      // 外沿钢栏（深灰，同码头台阶栏杆）
      const rl = q.rail;
      for (let j = 0; j < rl.length - 1; j++) { const [ax, az] = rl[j], [bx, bz] = rl[j + 1], L = Math.hypot(bx - ax, bz - az); if (L < 0.05) continue; const ry = yawOf(bx - ax, bz - az), mx = (ax + bx) / 2, mz = (az + bz) / 2;
        M.box(mx, top + 0.95, mz, 0.06, 0.06, L + 0.03, hex('#4A5560'), ry, 0, 0, 1, NO); M.box(mx, top + 0.5, mz, 0.04, 0.04, L, hex('#4A5560'), ry, 0, 0, 1, NO); k.col(mx, top + 0.6, mz, 0.12, 1.2, L, { ry, name: 'colDeckRail' }); }
      for (const [x, z] of rl) M.box(x, top + 0.48, z, 0.05, 0.96, 0.05, hex('#4A5560'), 0, 0, 0, 1, NO);
      // 泊位：系船桩 + 岸边黄线（同浮码头）
      const t = q.t, nn = q.n, [bx0, bz0] = q.berth, side = 1, eb = 1.2 + 0.25;   // 船舷外 0.25 m（栈道边）
      for (let a = -3.3; a <= 3.31; a += 2.2) { const x = bx0 + t[0] * a + nn[0] * eb * side, z = bz0 + t[1] * a + nn[1] * eb * side; if (isDry(x, z)) P.cyl(x, top + 0.18, z, 0.18, 0.36, hex('#2B2F33'), 8); }
      for (let a = -3.6; a <= 3.61; a += 1.45) { const x = bx0 + t[0] * a + nn[0] * (eb + 0.1), z = bz0 + t[1] * a + nn[1] * (eb + 0.1); if (isDry(x, z)) P.box(x, top + 0.02, z, 0.08, 0.02, 0.6, hex('#E7C23C'), yawOf(nn[0], nn[1]), 0, 0, 1, NO); }
    }
  }
  /** 2C：彬德水闸 + 观景处（和闽江远景同一组 c2mj：离得远整组关；碰撞体挂 root 不受影响） */
  c2Sluice(S = FZR.c2.sluice, NAME = '彬德水闸') {   // 3A 魁岐九门闸同一套（九孔）
    const k = this.kit, P = k.solid, GR = k.g('granite');
    // 彬德水闸 r2（小美 2C ①：原来像深蓝脚手架 + 没贴图的白方块）：四座条石 / 混凝土闸墩（和驳岸同色的灰米色）+ 墩间三扇灰色平板闸门（上下游两面横肋）
    // + 墩顶一座横跨全闸的启闭房（米色墙、每孔两扇窗、灰瓦两坡顶、端墙上闸名）+ 闸门吊杆 + 下游低处一道条石工作桥（石栏）。不用 metal（远看发蓝）、不留纯白块
    const t = S.t, n = S.n, hw = S.hw, NB = S.bays, Pt = (a, b) => [S.x + t[0] * a + n[0] * b, S.z + t[1] * a + n[1] * b], ryT = yawOf(t[0], t[1]);
    // a 沿水流（+ 往闽江 / 新港河）、b 横跨河；sa / sb = 沿 a / b 的尺寸
    const bx = (M, a, b, y, sa, sy, sb, col) => { const [x, z] = Pt(a, b); M.box(x, y, z, sb, sy, sa, hex(col), ryT, 0, 0, 1, NO); };
    const y0 = WY - 0.4, PT = 3.6, PW = 1.2, PA0 = -2.4, PA1 = 2.2;
    // 墩中心：默认均分；4A 新港闸用 bayW（南 2 孔窄、北 1 孔宽）。颜色和九门闸 / 彬德完全同一套。
    const PB = (() => { const o = [-hw]; if (S.bayW && S.bayW.length === NB) { const sm = S.bayW.reduce((a, b) => a + b, 0), inner = 2 * hw - NB * PW, sc = inner / sm; let v = -hw; for (let i = 0; i < NB; i++) { v += PW + S.bayW[i] * sc; o.push(v); } } else { for (let i = 1; i <= NB; i++) o.push(-hw + (2 * hw / NB) * i); } return o; })();
    const HB = 2 * hw / NB;   // 均分时的孔距（工作桥栏柱间距仍用它做步长）
    const PIER = '#A39C8E', CAP = '#B5AE9F', SLOT = '#6E685C', GATE = '#8A8C88', RIBC = '#74766F', WALL = '#D6CCB6', BASE = '#9A9385', ROOF = '#5E6266', WIN = '#5A6164', FRAME = '#8E887C';
    for (let i = 0; i <= NB; i++) { const v = PB[i], [x, z] = Pt((PA0 + PA1) / 2, v);
      bx(GR, (PA0 + PA1) / 2, v, (y0 + PT) / 2, PA1 - PA0, PT - y0, PW, PIER); k.col(x, (y0 + PT) / 2, z, PW, PT - y0, PA1 - PA0, { ry: ryT, name: 'colSluice' });
      bx(GR, (PA0 + PA1) / 2, v, PT + 0.12, PA1 - PA0 + 0.3, 0.24, PW + 0.3, CAP);   // 墩帽
      for (let y = WY + 0.6; y < PT - 0.3; y += 0.9) bx(GR, (PA0 + PA1) / 2, v, y, PA1 - PA0 + 0.02, 0.04, PW + 0.02, '#8E887C');   // 条石砌缝（一圈细线）
      const [ux, uz] = Pt(PA0 - 0.2, v); GR.box(ux, (y0 + WY + 0.6) / 2, uz, 0.9, WY + 0.6 - y0, 0.9, hex(PIER), ryT + Math.PI / 4, 0, 0, 1, NO);   // 上游分水尖
      for (const e of [-1, 1]) if ((i > 0 || e > 0) && (i < NB || e < 0)) bx(GR, 0.4, v + e * (PW / 2 + 0.005), (y0 + PT) / 2, 0.36, PT - y0, 0.02, SLOT); }   // 门槽
    for (let i = 0; i < NB; i++) { const v0 = PB[i] + PW / 2, v1 = PB[i + 1] - PW / 2, vm = (v0 + v1) / 2, W = v1 - v0, gt = 0.3;
      bx(GR, 0.4, vm, (y0 + gt) / 2, 0.26, gt - y0, W, GATE);   // 平板闸门（关着，顶比岸面高一点）
      for (let y = WY + 0.35; y < gt - 0.1; y += 0.6) for (const sa of [-1, 1]) bx(GR, 0.4 + sa * 0.15, vm, y, 0.05, 0.09, W - 0.1, RIBC);   // 横肋：上下游两面
      for (const sa of [-1, 1]) bx(GR, 0.4 + sa * 0.15, vm, (y0 + gt) / 2, 0.05, gt - y0, 0.09, RIBC);   // 中间竖肋
      bx(GR, 0.4, vm, gt + 0.04, 0.34, 0.08, W, '#7A7C78');   // 门顶压条
      for (const e of [-1, 1]) { bx(GR, 0.4, vm + e * W / 3, (gt + PT) / 2, 0.14, PT - gt, 0.14, '#7A7C78'); bx(GR, 0.4, vm + e * W / 3, gt + 0.12, 0.3, 0.16, 0.3, '#6E706C'); } }   // 吊杆 + 吊耳
    // 启闭房：横跨全闸，坐在墩帽上
    { const H0 = PT + 0.24, HH = 2.8, HA0 = -1.6, HA1 = 2.0, HAm = (HA0 + HA1) / 2, HD = HA1 - HA0, HL = 2 * hw + PW + 0.2;
      bx(P, HAm, 0, H0 + HH / 2, HD, HH, HL, WALL); bx(GR, HAm, 0, H0 + 0.25, HD + 0.06, 0.5, HL + 0.06, BASE);   // 墙身 + 灰石勒脚
      bx(GR, HAm, 0, H0 + HH + 0.08, HD + 0.2, 0.16, HL + 0.2, CAP);   // 檐口
      const rise = 1.1, slope = Math.atan2(rise, HD / 2);
      for (const sd of [-1, 1]) { const [rx, rz] = Pt(HAm + sd * HD / 4, 0); P.box(rx, H0 + HH + 0.16 + rise / 2, rz, HL + 0.5, 0.14, Math.hypot(HD / 2, rise) + 0.45, hex(ROOF), ryT, sd * slope, 0, 1, NO); }
      bx(P, HAm, 0, H0 + HH + 0.18 + rise, 0.3, 0.2, HL + 0.5, '#4A4E52');   // 屋脊
      for (const e of [-1, 1]) { const [gx, gz] = Pt(HAm, e * (HL / 2 + 0.02)); for (let j = 0; j < 4; j++) P.box(gx, H0 + HH + 0.16 + (j + 0.5) * rise / 4, gz, 0.04, rise / 4, HD * (1 - (j + 0.5) / 4), hex(WALL), ryT, 0, 0, 1, NO); }   // 山墙三角（台阶叠出来）
      for (let i = 0; i < NB; i++) for (const q of [-0.22, 0.22]) { const vm = (PB[i] + PB[i + 1]) / 2 + q * (PB[i + 1] - PB[i]);   // 每孔两扇窗，上下游两面
        for (const sa of [-1, 1]) { const aa = HAm + sa * (HD / 2 + 0.03); bx(GR, aa, vm, H0 + 1.55, 0.05, 1.3, 1.5, FRAME); bx(P, aa + sa * 0.02, vm, H0 + 1.55, 0.04, 1.1, 1.3, WIN); bx(P, aa + sa * 0.04, vm, H0 + 1.55, 0.03, 1.1, 0.06, FRAME); bx(GR, aa + sa * 0.06, vm, H0 + 0.88, 0.14, 0.08, 1.7, CAP); } }
      for (const e of [-1, 1]) { const bb = e * (HL / 2 + 0.03);   // 两头端墙：一扇窗 + 闸名牌（灰石底、米黄字；不画箭头 / 地图）
        bx(GR, HAm, bb, H0 + 1.0, 1.0, 1.0, 0.05, FRAME); bx(P, HAm, bb + e * 0.02, H0 + 1.0, 0.85, 0.85, 0.04, WIN);
        const [qx, qz] = Pt(HAm, bb + e * 0.03), uv = this.atlas.draw(2.0, 0.5, textPaint([NAME], { bg: '#6E675B', fg: '#F2E2B0' }), 70);
        this.atlas.quad(qx, H0 + 2.2, qz, 2.0, 0.5, Math.atan2(n[0] * e, -n[1] * e), uv); }
      { const [qx, qz] = Pt(HA0 - 0.04, 0), uv = this.atlas.draw(3.0, 0.6, textPaint([NAME], { bg: '#6E675B', fg: '#F2E2B0' }), 80); this.atlas.quad(qx, H0 + 2.35, qz, 3.0, 0.6, Math.atan2(-t[0], t[1]), uv); } }   // 上游面正中
    // 下游工作桥：墩间条石板 + 石栏（和驳岸石栏同款）
    { const WA = PA1 - 0.8; bx(GR, WA, 0, -0.1, 1.4, 0.3, 2 * hw + PW, CAP);
      for (const sa of [-1, 1]) { bx(GR, WA + sa * 0.62, 0, 0.74, 0.16, 0.1, 2 * hw + PW, '#B5AE9F'); for (let v = -hw; v <= hw + 0.01; v += HB / 3) bx(GR, WA + sa * 0.62, v, 0.38, 0.2, 0.72, 0.2, '#A8A193'); } }
    // 闸边观景处（江滨西大道下穿上来往南几步）：花岗岩铺地 + 一张长椅，朝闽江
    { const [x, z] = S.view; GR.box(x, 0.015, z, 3.2, 0.03, 3.2, hex('#ABA497'), ryT, 0, 0, 1, NO);
      let bx = x - n[0] * 1.0, bz = z - n[1] * 1.0;
      if (FZR.a4 && S === FZR.a4.gate && FZR.a4.sign) {   // 新港闸：长椅从木牌正面挪开约 2 m，免得挡住牌
        const sg = FZR.a4.sign; bx = sg.x - n[0] * 3.2 + t[0] * 2.0; bz = sg.z - n[1] * 3.2 + t[1] * 2.0;
      }
      D.bench(this.kit, bx, 0, bz, yawOf(t[0], t[1]), true); }
  }
  /** 2C 闽江远景（口门外，只看不走）：江面（比内河低 0.6 m）+ 北岸堤墙 + 堤顶石栏、三县洲大桥剪影、对岸一排树和楼 */
  minjiang() {
    const k = this.kit, J = FZR.c2.mj, WA = k.g('paint@sea'), GR = k.g('granite'), P = k.solid, M = k.metal;
    { const Pp = J.water.p, I = J.water.i, base = WA.p.length / 3, c = hex('#3C6C70'); for (let j = 0; j < Pp.length; j += 2) WA.push(Pp[j], J.lv, Pp[j + 1], 0, 1, 0, c); for (let j = 0; j < I.length; j += 3) WA.i.push(base + I[j], base + I[j + 1], base + I[j + 2]); }
    for (const [ax, az, bx, bz] of J.shore) { GR.quad([ax, 0.0, az], [bx, 0.0, bz], [bx, J.lv - 0.4, bz], [ax, J.lv - 0.4, az], hex(WALLC)); GR.quad([bx, 0.0, bz], [ax, 0.0, az], [ax, J.lv - 0.4, az], [bx, J.lv - 0.4, bz], hex(WALLC)); }
    for (const [ax, az, bx, bz] of J.rail) this.stoneRail(ax, az, bx, bz);
    // 三县洲大桥（剪影）：桥面 + 桥墩 + 一座 H 形塔 + 斜拉索
    const S = J.sxz, deckY = 9;
    for (let i = 0; i < S.length - 1; i++) { const [ax, az] = S[i], [bx, bz] = S[i + 1], L = Math.hypot(bx - ax, bz - az), ry = yawOf(bx - ax, bz - az);
      P.box((ax + bx) / 2, deckY, (az + bz) / 2, 22, 1.4, L + 0.5, hex('#B9B5AD'), ry, 0, 0, 1, NO); P.box((ax + bx) / 2, deckY + 0.95, (az + bz) / 2, 22.2, 0.5, L + 0.5, hex('#8E9094'), ry, 0, 0, 1, NO); }
    for (const [x, z] of S.slice(1, -1)) for (const e of [-1, 1]) P.box(x + e * 6, (J.lv + deckY) / 2, z, 2.2, deckY - J.lv, 2.2, hex('#A8A39A'), 0, 0, 0, 1, NO);
    { const [x, z] = S[1], [x2, z2] = S[2], ry = yawOf(x2 - x, z2 - z), tx = Math.sin(ry), tz = Math.cos(ry), H = 48;
      for (const e of [-1, 1]) P.box(x + tz * e * 10, (J.lv + H) / 2, z - tx * e * 10, 2.0, H - J.lv, 3.0, hex('#C9C5BC'), ry, 0, 0, 1, NO);
      P.box(x, H - 6, z, 22, 1.6, 2.4, hex('#C9C5BC'), ry, 0, 0, 1, NO);
      for (const e of [-1, 1]) for (const d of [-1, 1]) for (let c = 1; c <= 5; c++) { const L = 14 + c * 13, ax = x + tz * e * 10, az = z - tx * e * 10, top = H - 8 - c * 2, bx = ax + tx * d * L, bz = az + tz * d * L, len = Math.hypot(L, top - deckY - 1);
        M.box((ax + bx) / 2, (top + deckY + 1) / 2, (az + bz) / 2, 0.12, 0.12, len, hex('#E3E1DC'), ry, -d * Math.atan2(top - deckY - 1, L), 0, 1, NO); } }
    // 对岸：一排树冠 + 低层楼（远景，按固定序列取色，不随机）
    const [x0, zf, x1] = J.far, G = ['#3A7A3C', '#2F6B34', '#447F3A'], W = ['#D9D2C4', '#C9CED2', '#E3D9C6', '#BFC6C9'];
    for (let x = x0 + 6, i = 0; x < x1; x += 13, i++) { P.ellipsoid(x, 4.5, zf - 5, 9, 4.2, 6, hex(G[i % 3]), 1); if (i % 2 === 0) { const h = 12 + (i * 7) % 15; P.box(x + 4, h / 2, zf - 22, 16, h, 10, hex(W[i % 4]), 0, 0, 0, 1, NO); } }
  }
  /** 3A：魁岐九门闸（同彬德水闸：石闸墩 + 九扇灰闸门 + 启闭房，不用 metal、不留纯白块）+ 闸边观景处 + 闸外闽江江面 / 堤墙 / 石栏（常开，和 g0 同一批材质，不加 draw）
   *  只能看、不能上：闸的整个占地一块看不见的高碰撞体（colGateBlock，人从岸上 / 水里都进不去）；闸两头岸上的石栏在 mj.rail */
  a3Static() {
    const A3 = FZR.a3, G = A3.gate, J = A3.mj, k = this.kit, WA = k.g('paint@sea'), GR = k.g('granite');
    this.c2Sluice(G, '魁岐九门闸');
    { const B_ = G.block, cx = B_.reduce((a, q) => a + q[0], 0) / 4, cz = B_.reduce((a, q) => a + q[1], 0) / 4, la = Math.hypot(B_[1][0] - B_[0][0], B_[1][1] - B_[0][1]), lb = Math.hypot(B_[2][0] - B_[1][0], B_[2][1] - B_[1][1]);
      k.col(cx, 3, cz, lb, 16, la, { ry: yawOf(G.t[0], G.t[1]), name: 'colGateBlock' }); }
    { const Pp = J.water.p, I = J.water.i, base = WA.p.length / 3, c = hex('#2F6670'); for (let j = 0; j < Pp.length; j += 2) WA.push(Pp[j], J.lv, Pp[j + 1], 0, 1, 0, c); for (let j = 0; j < I.length; j += 3) WA.i.push(base + I[j], base + I[j + 1], base + I[j + 2]); }   // 闽江江面：和内河同色（远景无接缝，同 2D 琼东河口）
    for (const [ax, az, bx, bz] of J.shore) { GR.quad([ax, 0.0, az], [bx, 0.0, bz], [bx, J.lv - 0.4, bz], [ax, J.lv - 0.4, az], hex(WALLC)); GR.quad([bx, 0.0, bz], [ax, 0.0, az], [ax, J.lv - 0.4, az], [bx, J.lv - 0.4, bz], hex(WALLC)); }
    for (const [ax, az, bx, bz] of J.rail) this.stoneRail(ax, az, bx, bz);
  }
  /** 4A：新港闸（同九门闸浅灰石材 + 南 2 孔北 1 孔，只能看不能过）+ 闸西新港河封闭远景水面 / 堤墙 / 石栏 + 木牌 + 瀛洲河石牌。常开，和 g0 同一批材质，不加 draw */
  a4Static() {
    const A4 = FZR.a4, G = A4.gate, X = A4.xg, k = this.kit, WA = k.g('paint@sea'), GR = k.g('granite');
    this.c2Sluice(G, '新港闸');
    { const B_ = G.block, cx = B_.reduce((a, q) => a + q[0], 0) / 4, cz = B_.reduce((a, q) => a + q[1], 0) / 4, la = Math.hypot(B_[1][0] - B_[0][0], B_[1][1] - B_[0][1]), lb = Math.hypot(B_[2][0] - B_[1][0], B_[2][1] - B_[1][1]);
      k.col(cx, 3, cz, lb, 16, la, { ry: yawOf(G.t[0], G.t[1]), name: 'colGateBlock' }); }
    { const Pp = X.water.p, I = X.water.i, base = WA.p.length / 3, c = hex('#2F6670'); for (let j = 0; j < Pp.length; j += 2) WA.push(Pp[j], X.lv, Pp[j + 1], 0, 1, 0, c); for (let j = 0; j < I.length; j += 3) WA.i.push(base + I[j], base + I[j + 1], base + I[j + 2]); }   // 新港河水面：和内河同色系，高 1 m；两岸堤墙围住，不是一块平水面切一刀
    for (const [ax, az, bx, bz] of X.shore) { GR.quad([ax, 0.0, az], [bx, 0.0, bz], [bx, X.lv - 0.4, bz], [ax, X.lv - 0.4, az], hex(WALLC)); GR.quad([bx, 0.0, bz], [ax, 0.0, az], [ax, X.lv - 0.4, az], [bx, X.lv - 0.4, bz], hex(WALLC)); }
    for (const [ax, az, bx, bz] of X.rail) this.stoneRail(ax, az, bx, bz);
    { const P = k.solid, [ox, oz] = X.o, [tx, tz] = X.t, [nx, nz] = X.n, ry = yawOf(nx, nz), lv = X.lv;
      for (const sg of [-1, 1]) {
        const um = 22, vG = sg * 22, vW = sg * 16.8, xg = ox + tx * um + nx * vG, zg = oz + tz * um + nz * vG, xe = ox + tx * um + nx * vW, ze = oz + tz * um + nz * vW;
        P.box(xg, 0.5, zg, 14, 1.0, 36, hex('#6E7A64'), ry, 0, 0, 1, NO);   // 两岸地面，夜里也在，不露裙板挖空
        P.box(xe, (lv + 1.0) / 2, ze, 1.6, lv + 0.6, 36, hex('#8A8578'), ry, 0, 0, 1, NO);
        P.box(xe, lv + 0.35, ze, 1.8, 0.08, 36, hex('#A39C8E'), ry, 0, 0, 1, NO);
      }
      const [cx, cz] = [ox + tx * 42, oz + tz * 42];
      P.box(cx, 0.5, cz, 40, 1.0, 16, hex('#6E7A64'), ry, 0, 0, 1, NO);   // 西头合拢的地面
    }
    if (A4.sign) this.pierSign({ ...A4.sign, sign: [A4.sign.x, A4.sign.z] });
    for (const S of A4.signs || []) this.stoneSign(S.x, S.z, S.f[0], S.f[1], 3.6, 1.5, S.lines);
  }
  /** 4A 白天才画（g4day）：西段水面亮纹 + 闸西新港河两岸密楼 / 树冠，把远景水面围住，不露天空缝 */
  a4Day() {
    const A4 = FZR.a4, k = this.kit, WA = k.g('paint@sea'), P = k.solid, r = RIVERS.gw;
    if (r) { let j = 0; for (let s = 4; s < r.line.len - 4; s += 11) { const a = r.line.at(s, ((j++ * 37) % 11 - 5) / 6 * r.hw * 0.55); if (typeof isWater === 'function' && !isWater(a.x, a.z)) continue; WA.box(a.x, WY + 0.004, a.z, 0.25, 0.004, 4.0, hex('#8FC0C8'), yawOf(a.tx, a.tz), 0, 0, 1, NO); } }
    const G = ['#3A7A3C', '#2F6B34', '#447F3A'], W = ['#7E8C99', '#8796A3', '#76858F', '#8F9AA5', '#6F7C86'];   // 偏蓝灰远景色，不用米白（雾里会像白板）
    const far = A4.far || [];
    for (let i = 0; i < far.length; i++) {
      const [x, z, fx, fz] = far[i], rx = -fz, rz = fx, h = 10 + (i * 7) % 14, w = 9 + (i * 3) % 5, d = 8;
      const cx = x - fx * (d / 2 + 0.4), cz = z - fz * (d / 2 + 0.4), ry = yawOf(rx, rz);
      P.box(cx, h / 2, cz, w, h, d, hex(W[i % 5]), ry, 0, 0, 1, NO);
      P.ellipsoid(x + fx * 1.2, 4.2, z + fz * 1.2, 7.5, 3.6, 5.5, hex(G[i % 3]), 1);
    }
  }
  /** 3B：琴亭湖 / 凤坂河石牌（同 2D 朱紫坊石牌，进 g0 同一批材质，不加 draw） */
  b3Static() { for (const S of FZR.b3.signs) this.stoneSign(S.x, S.z, S.f[0], S.f[1], 3.6, 1.5, S.lines); this.b3Slope(); this.b3Ting(); }
  /** 琴亭湖远岸（小美 11-17）：石岸改草坡——岸线往水里 6 m 斜下去（没进水面），岸上 2.5 m 一条草边；墙是 flag 3（不可见碰撞）。并进 kit.solid，不加 draw */
  b3Slope() {
    const P = this.kit.solid, G = hex('#79A85A'), G2 = hex('#5E8A47');
    const up = (a, b, c, d, cols) => { const e1 = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], e2 = [d[0] - a[0], d[1] - a[1], d[2] - a[2]], ny = e2[2] * e1[0] - e2[0] * e1[2];
      if (ny >= 0) P.quad(a, b, c, d, null, cols); else P.quad(d, c, b, a, null, [cols[3], cols[2], cols[1], cols[0]]); };
    for (const [ax0, az0, bx0, bz0, sg] of FZR.b3.slope || []) {
      const L = Math.hypot(bx0 - ax0, bz0 - az0) || 1, dx = (bx0 - ax0) / L, dz = (bz0 - az0) / L, rx = dz * sg, rz = -dx * sg, e = 0.35;
      const ax = ax0 - dx * e, az = az0 - dz * e, bx = bx0 + dx * e, bz = bz0 + dz * e, yb = WY - 0.35;
      up([ax, 0.014, az], [bx, 0.014, bz], [bx + rx * 6, yb, bz + rz * 6], [ax + rx * 6, yb, az + rz * 6], [G, G, G2, G2]);
      up([ax - rx * 2.5, 0.014, az - rz * 2.5], [bx - rx * 2.5, 0.014, bz - rz * 2.5], [bx, 0.014, bz], [ax, 0.014, az], [G, G, G, G]);
    }
  }
  /** 琴亭：湖边草坡上的方亭（石台、四根红柱、额枋、深灰攒尖顶、"琴亭"匾朝湖），同 2A 观湖亭的做法，并进 granite / solid / 图集，不加 draw；柱子有碰撞 */
  b3Ting() {
    const T = FZR.b3.ting; if (!T) return;
    const k = this.kit, P = k.solid, GR = k.g('granite'), A = this.atlas, fx = T.f[0], fz = T.f[1], rx = fz, rz = -fx, ry = yawOf(fx, fz), RED = hex('#A8322A'), DY = 0.16;
    const at = (u, v) => [T.x + rx * u + fx * v, T.z + rz * u + fz * v];
    GR.box(T.x, DY / 2, T.z, 8.4, DY, 8.4, hex('#9C968A'), ry, 0, 0, 1, NO);
    for (const [u, v] of [[-3, -3], [3, -3], [3, 3], [-3, 3]]) { const [x, z] = at(u, v); P.cyl(x, DY + 1.75, z, 0.4, 3.5, RED, 8); GR.box(x, DY + 0.12, z, 0.7, 0.24, 0.7, hex('#8C8577'), ry, 0, 0, 1, NO); k.colSlab(x - 0.25, x + 0.25, 0, 3.6, z - 0.25, z + 0.25); }
    for (const [u, v, w, d] of [[0, -3, 6.8, 0.36], [0, 3, 6.8, 0.36], [-3, 0, 0.36, 6.8], [3, 0, 0.36, 6.8]]) { const [x, z] = at(u, v); P.box(x, DY + 3.45, z, w, 0.4, d, RED, ry, 0, 0, 1, NO); }
    P.box(T.x, DY + 3.75, T.z, 7.4, 0.2, 7.4, hex('#5B5F63'), ry, 0, 0, 1, NO);
    P.cyl(T.x, DY + 4.85, T.z, 10.6, 2.0, hex('#3E4347'), 4, ry + Math.PI / 4, 0, 0, 0.6); P.cyl(T.x, DY + 6.1, T.z, 0.5, 0.6, hex('#C9A23A'), 6, 0, 0, 0, 0.1);
    const [sx, sz] = at(0, 3.2), uv = A.draw(2.4, 0.62, textPaint([T.zh], { bg: '#1F3B2E', fg: '#E9C46A' }), 60);
    P.box(sx - fx * 0.02, DY + 2.9, sz - fz * 0.02, 2.6, 0.72, 0.06, hex('#1F3B2E'), ry, 0, 0, 1, NO);
    A.quad(sx + fx * 0.03, DY + 2.9, sz + fz * 0.03, 2.4, 0.62, Math.atan2(fx, -fz), uv);
    const [px, pz] = at(3.9, 4.6); this.stoneSign(px, pz, fx, fz, 1.6, 0.8, [T.zh, T.en]);   // 亭前小石牌
  }
  /** 3A 路桥桥面：深灰沥青（granite 桶：粗颗粒、几乎不反天光）+ 白色分道虚线 / 边线 + 中间双黄线（kit.solid）——都并进已有网格，不加 draw */
  a3Deck(b, F, w, half) {
    const k = this.kit, GR = k.g('granite'), P = k.solid, W2 = (w - 1.6) / 2, L = 2 * half, [cx, cz] = F.P(0, 0), wh = hex('#E8E6DF'), ye = hex('#E2B53A'), y0 = b.deckY || 0;
    GR.box(cx, y0 + 0.008, cz, 2 * W2, 0.012, L, hex('#4E5155'), F.ryN, 0, 0, 1, NO);
    const ln = (u, v0, v1, c, wd = 0.15) => { const [x, z] = F.P(u, (v0 + v1) / 2); P.box(x, y0 + 0.018, z, wd, 0.006, v1 - v0, c, F.ryN, 0, 0, 1, NO); };
    for (const e of [-1, 1]) { ln(e * 0.18, -half, half, ye, 0.14); ln(e * (W2 - 0.5), -half, half, wh, 0.18);   // 双黄中线 + 两边边线
      for (let j = 1; j * 3.5 < W2 - 1.2; j++) for (let v = -half + 1.5; v + 3 <= half - 1; v += 9) ln(e * j * 3.5, v, v + 3, wh); }   // 分道白虚线（3 m 线 6 m 空）
  }

  /** 6A 常开：茶园水闸（单孔矮堰 + 岸边筒顶泵房，只看不过）+ 西头远景楼挡住天空缝；浅灰石材家族，不用 c2Sluice */
  a6Static() {
    const A6 = FZR.a6, G = A6.gate, k = this.kit, P = k.solid;
    this.a6Sluice(G);
    if (A6.sign) this.pierSign({ ...A6.sign, sign: [A6.sign.x, A6.sign.z] });
    for (const S of A6.signs || []) this.stoneSign(S.x, S.z, S.f[0], S.f[1], 3.6, 1.5, S.lines);
    if (A6.bench) { const [x, z] = A6.bench; this.kit.g('granite').box(x, 0.22, z, 1.4, 0.44, 0.45, hex('#8A8476'), 0, 0, 0, 1, NO); k.col(x, 0.22, z, 1.4, 0.44, 0.45, { name: 'colBench' }); }
    // 西头合拢后的远景楼（偏蓝灰，夜里仍是剪影，不加暖白）
    const Wc = ['#7E8C99', '#8796A3', '#76858F', '#8F9AA5'];
    (A6.far || []).forEach((q, i) => {
      const [x, z, fx, fz] = q, ry = yawOf(fx, fz), h = 8 + (i * 5) % 10;
      P.box(x, h / 2, z, 10, h, 7, hex(Wc[i % 4]), ry, 0, 0, 1, NO);
    });
  }
  a6Sluice(S) {
    // 茶园水闸：单孔低堰（没有跨河启闭房）+ 岸上一座小筒顶泵房 + 两根螺杆泵筒。浅灰（PIER / CAP / BASE 同九门），剪影有别于九门 / 新港 / 江四。
    const k = this.kit, GR = k.g('granite'), P = k.solid, t = S.t, n = S.n, hw = S.hw;
    const PIER = '#A39C8E', CAP = '#B5AE9F', BASE = '#9A9385', CONC = '#B5B3AB';
    const Pt = (a, b) => [S.x + t[0] * a + n[0] * b, S.z + t[1] * a + n[1] * b];
    const ryN = yawOf(n[0], n[1]), ryT = yawOf(t[0], t[1]);
    // 低堰：顶只高出水面约 1.4 m，单孔，两端墩
    const top = 0.55, thick = 1.6, y0 = WY - 0.2;
    for (const sv of [-1, 1]) {
      const [px, pz] = Pt(0, sv * (hw - 0.45));
      GR.box(px, (y0 + top) / 2, pz, thick + 0.8, top - y0, 1.1, hex(PIER), ryT, 0, 0, 1, NO);
      GR.box(px, top + 0.12, pz, thick + 1.0, 0.24, 1.3, hex(CAP), ryT, 0, 0, 1, NO);
    }
    const [cx, cz] = Pt(0, 0);
    GR.box(cx, (y0 + top) / 2, cz, thick, top - y0, 2 * hw - 1.6, hex(BASE), ryT, 0, 0, 1, NO);
    GR.box(cx, top + 0.08, cz, thick + 0.2, 0.16, 2 * hw - 1.4, hex(CAP), ryT, 0, 0, 1, NO);
    // 碰撞：整座堰过人不过
    const mid = S.block.reduce((a, q) => [a[0] + q[0] / 4, a[1] + q[1] / 4], [0, 0]);
    const yBot = WY - 0.2, yTop = 1.6;
    k.col(mid[0], (yBot + yTop) / 2, mid[1], 5.2, yTop - yBot, 2 * hw + 3.2, { ry: ryT, name: 'colGateBlock' });
    // 筒顶泵房（岸上，圆拱顶，不是两坡黛瓦，也不是长条启闭房）
    const H = S.house, hy = H.h / 2;
    P.box(H.x, hy, H.z, H.w, H.h, H.d, hex(CONC), ryT, 0, 0, 1, NO);
    P.box(H.x, 0.25, H.z, H.w + 0.2, 0.5, H.d + 0.2, hex(BASE), ryT, 0, 0, 1, NO);
    // barrel roof：沿 t 方向的半圆拱（几块盒子近似），深灰金属顶，和两岸黛瓦分开
    const rise = 1.55;
    for (const sd of [-1, 1]) {
      const [rx, rz] = [H.x + t[0] * sd * H.w * 0.22, H.z + t[1] * sd * H.w * 0.22];
      P.box(rx, H.h + rise * 0.45, rz, H.w * 0.58, rise * 0.75, H.d + 0.2, hex('#6A6E72'), ryT, sd * 0.48, 0, 1, NO);
    }
    P.box(H.x, H.h + rise * 0.88, H.z, 0.55, 0.38, H.d + 0.15, hex('#5A5E62'), ryT, 0, 0, 1, NO);
    // 两根螺杆泵筒（立在泵房靠水一侧，茶园独有）
    for (const se of [-1, 1]) {
      const [qx, qz] = [H.x + n[0] * S.houseSide * (-H.d / 2 - 0.9) + t[0] * se * 1.55, H.z + n[1] * S.houseSide * (-H.d / 2 - 0.9) + t[1] * se * 1.55];
      P.cyl(qx, 1.85, qz, 0.62, 3.7, hex('#8A9096'), 8, 0, 0);
      P.cyl(qx, 3.85, qz, 0.22, 0.5, hex('#4A5056'), 8, 0, 0);
    }
    k.col(H.x, hy, H.z, H.w, H.h, H.d, { ry: ryT, name: 'colPumpHouse' });
  }
  /** 6A 白天才画（g6day）：湖前河水面亮纹。夜里关掉，夜 draw ≤ 昼 */
  a6Day() {
    const k = this.kit, WA = k.g('paint@sea'), C = hex('#8FC0C8'), r = RIVERS.hq;
    if (!r) return;
    let j = 0;
    for (let s = 6; s < r.line.len - 6; s += 13) {
      const a = r.line.at(s, ((j++ * 37) % 11 - 5) / 6 * r.hw * 0.6);
      if (!isWater(a.x, a.z)) continue;
      WA.box(a.x, WY + 0.004, a.z, 0.25, 0.004, 4.5, C, yawOf(a.tx, a.tz), 0, 0, 1, NO);
    }
  }

  /** 2C 白天才画的一组（g2day）：白马河下段水面亮纹（同 3B / 4A 的短条）。夜里关掉，夜 draw ≤ 昼 */
  c2Day() {
    const k = this.kit, WA = k.g('paint@sea'), C = hex('#8FC0C8'), r = RIVERS.bm;
    if (!r) return;
    let j = 0; const s0 = Math.max(6, (FZR.c2.bmALen || 0) + 4);
    for (let s = s0; s < r.line.len - 6; s += 13) { const a = r.line.at(s, ((j++ * 37) % 11 - 5) / 6 * r.hw * 0.6); if (!isWater(a.x, a.z)) continue; WA.box(a.x, WY + 0.004, a.z, 0.25, 0.004, 4.5, C, yawOf(a.tx, a.tz), 0, 0, 1, NO); }
  }
    /** 3B 白天才画的一组（g3bday）：晋安河北段 / 凤坂河 / 琴亭湖水面亮纹（同 1B 的短条） */
  b3Day() {
    const k = this.kit, WA = k.g('paint@sea'), C = hex('#8FC0C8');
    let j = 0; for (const id of ['jn', 'fb']) { const r = RIVERS[id]; for (let s = 6; s < r.line.len - 6; s += 13) { const a = r.line.at(s, ((j++ * 37) % 11 - 5) / 6 * r.hw * 0.6); if (!isWater(a.x, a.z)) continue; WA.box(a.x, WY + 0.004, a.z, 0.25, 0.004, 4.5, C, yawOf(a.tx, a.tz), 0, 0, 1, NO); } }
    const L = FZR.b3.lake, [cx, cz] = L.c; let x0 = 1e9, x1 = -1e9, z0 = 1e9, z1 = -1e9; for (let i = 0; i < L.ring.length; i += 2) { x0 = Math.min(x0, L.ring[i]); x1 = Math.max(x1, L.ring[i]); z0 = Math.min(z0, L.ring[i + 1]); z1 = Math.max(z1, L.ring[i + 1]); }
    for (let x = x0 + 6, a = 0; x < x1 - 6; x += 11) for (let z = z0 + 6; z < z1 - 6; z += 11, a++) { const ox = x + ((a * 37) % 7 - 3), oz = z + ((a * 53) % 7 - 3); if (!inPoly(ox, oz, L.ring) || !inPoly(ox + 4, oz, L.ring) || !inPoly(ox - 4, oz, L.ring)) continue; WA.box(ox, WY + 0.004, oz, 0.25, 0.004, 4.5, C, 0.6 + (a % 5) * 0.25, 0, 0, 1, NO); }
  }
  /** 3A 白天才画的一组（g3day）：光明港东段水面亮纹 + 闽江对岸一排树冠 / 低层楼（远景，固定序列取色） */
  a3Day() {
    const A3 = FZR.a3, J = A3.mj, k = this.kit, WA = k.g('paint@sea'), P = k.solid, r = RIVERS.gm;
    let j = 0; for (let s = A3.gmALen + 4; s < r.line.len - 6; s += 13) { const a = r.line.at(s, ((j++ * 37) % 11 - 5) / 6 * r.hw * 0.6); WA.box(a.x, WY + 0.004, a.z, 0.25, 0.004, 4.5, hex('#8FC0C8'), yawOf(a.tx, a.tz), 0, 0, 1, NO); }
    const [o0, o1] = J.o, [tx, tz] = J.t, [nx, nz] = J.n, [af, b0, b1] = J.far, Pt = (a, b) => [o0 + tx * a + nx * b, o1 + tz * a + nz * b], ry = yawOf(nx, nz);
    // 小美 11-17：对岸楼用偏蓝灰的远景色（原来米白色在雾里像半透明白板）；树冠和楼底下补一条对岸地面 + 堤岸（树不再像浮在江面上）——都在同一张 solid 网格里，不加 draw
    const Gc = ['#3A7A3C', '#2F6B34', '#447F3A'], Wc = ['#7E8C99', '#8796A3', '#76858F', '#8F9AA5'];
    { const bm = (b0 + b1) / 2, L = b1 - b0 + 16, [gx, gz] = Pt(af + 34, bm), [ex, ez] = Pt(af - 0.6, bm), y0 = J.lv - 0.4, y1 = 1.2;
      P.box(gx, 0.5, gz, 70, 1.0, L, hex('#6E7A64'), ry, 0, 0, 1, NO);   // 对岸地面（树带 + 楼底，顶面 +1.0）
      P.box(ex, (y0 + y1) / 2, ez, 1.6, y1 - y0, L, hex('#8A8578'), ry, 0, 0, 1, NO);   // 堤岸（石墙，比地面略高一点）
      P.box(ex, y1 + 0.03, ez, 1.8, 0.06, L, hex('#A39C8E'), ry, 0, 0, 1, NO); }   // 堤顶压顶
    for (let b = b0 + 6, i = 0; b < b1; b += 13, i++) { const [x, z] = Pt(af + 5, b); P.ellipsoid(x, 4.5, z, 9, 4.2, 6, hex(Gc[i % 3]), 1);
      if (i % 2 === 0) { const h = 12 + (i * 7) % 15, [hx, hz] = Pt(af + 22, b + 4); P.box(hx, h / 2, hz, 16, h, 10, hex(Wc[i % 4]), ry, 0, 0, 1, NO); } }
  }
  /** 水埠头：贴着岸墙下到水边的石阶（侧面敞开，可以故意走下水） */
  stepsDown() {
    for (const st of FZR.steps) {
      const F = this.pierFrame(st);
      const lv = levelAt(st.x, st.z); this.stairAlong(F, -4.2, 2.2, 0, 1.4, 0, lv + 0.25, 15);
      const k = this.kit, [cx, cz] = F.P(3.2, 0.7);
      k.g('granite').box(cx, lv + 0.1, cz, 1.4, 0.3, 2.0, hex('#8E887C'), F.ryT, 0, 0, 1, NO); k.col(cx, lv + 0.1, cz, 1.4, 0.3, 2.0, { ry: F.ryT, name: 'colLanding' });
    }
  }
  /** 2B 桥下步道（五一中路 / 八一七中路，北岸）：石阶下到 U.y → 桥底石板平台 → 石阶上来；外沿栏杆、两头阶顶挡板 */
  unders() {
    const k = this.kit, GR = k.g('granite');
    for (const U of this._c2pass ? (FZR.undersC || []).filter(U => c2Band(U.z) === this._c2band) : (FZR.unders || [])) {   // 2C：工业路 / 江滨西大道桥下步道（西岸）在 2C 分段里画
      const F = this.pierFrame(U), f = U.flat, r = U.run, w = U.w, y = U.y;
      this.stairAlong(F, -f - r, -f, 0, w, 0, y, 12, { rail: true });
      this.stairAlong(F, f + r, f, 0, w, 0, y, 12, { rail: true });
      const [cx, cz] = F.P(0, w / 2);
      GR.box(cx, (y + WY - 0.4) / 2, cz, w, y - (WY - 0.4), 2 * f + 0.02, hex('#9A9385'), F.ryT, 0, 0, 1, NO);
      k.col(cx, y - 0.15, cz, w, 0.3, 2 * f + 0.1, { ry: F.ryT, name: 'colUnder' });
      // 外沿栏杆（和码头台阶同款深灰钢栏）
      const [rx, rz] = F.P(0, w - 0.06); k.col(rx, y + 0.6, rz, 0.12, 1.2, 2 * f, { ry: F.ryT, name: 'colUnderRail' });
      k.metal.box(rx, y + 0.95, rz, 0.06, 0.06, 2 * f, hex('#4A5560'), F.ryT, 0, 0, 1, NO);
      for (let a = -f; a <= f + 0.01; a += f / Math.max(1, Math.round(f / 1.6))) { const [px, pz] = F.P(a, w - 0.06); k.metal.box(px, y + 0.48, pz, 0.05, 0.96, 0.05, hex('#4A5560'), 0, 0, 0, 1, NO); }
      // 阶顶外端：挡板（台阶顶端外面就是水）
      // 阶顶靠岸一侧的水缝（岸线拐弯往里退）：补齐岸花岗岩填块，顶面和岸地齐平、带碰撞（小美 2B ③）
      (U.fill || []).forEach((fl, i) => { if (!fl) return; const e = i ? 1 : -1, y0 = WY - 0.4, y1 = -0.004, [qx, qz] = F.P(e * (f + r - 1.07), -fl / 2);
        GR.box(qx, (y0 + y1) / 2, qz, fl, y1 - y0, 2.46, hex('#A39C8E'), F.ryT, 0, 0, 1, NO); k.col(qx, (y0 + y1) / 2, qz, fl, y1 - y0, 2.46, { ry: F.ryT, name: 'colUnderFill' }); });
      for (const e of [-1, 1]) { const [ex, ez] = F.P(e * (f + r + 0.08), w / 2); GR.box(ex, 0.45, ez, w, 0.9, 0.16, hex('#B5AE9F'), F.ryT, 0, 0, 1, NO); k.col(ex, 0.5, ez, w, 1.2, 0.2, { ry: F.ryT, name: 'colUnderEnd' }); }
    }
  }
  /** 2B 水部步道两边的石栏（和驳岸同款：条石扶手 + 望柱） */
  stoneRail(ax, az, bx, bz) {
    const k = this.kit, GR = k.g('granite'), L = Math.hypot(bx - ax, bz - az), ry = yawOf((bx - ax) / L, (bz - az) / L), mx = (ax + bx) / 2, mz = (az + bz) / 2, n = Math.max(1, Math.round(L / 2.3));
    k.col(mx, 0.6, mz, 0.3, 1.2, L, { ry, name: 'colWalkRail' });
    GR.box(mx, 0.74, mz, 0.16, 0.1, L, hex('#B5AE9F'), ry, 0, 0, 1, NO);
    for (let i = 0; i <= n; i++) { const t = i / n; GR.box(ax + (bx - ax) * t, 0.38, az + (bz - az) * t, 0.2, 0.72, 0.2, hex('#A8A193'), ry, 0, 0, 1, NO); }
  }
  /* ---------- 路 / 广场 ---------- */
  roads() {
    const k = this.kit, A = k.g('asphalt');
    for (const r of FZR.roads) {
      if (r.plaza) continue;
      const p = r.poly, cx = (p[0] + p[2] + p[4] + p[6]) / 4, cz = (p[1] + p[3] + p[5] + p[7]) / 4, L = Math.hypot(p[2] - p[0], p[3] - p[1]), W = Math.hypot(p[6] - p[0], p[7] - p[1]), ry = yawOf(r.dir[0], r.dir[1]);
      if (!this.c2ok(cz)) continue;
      if (r.id === 'nhj') { k.g('granite').box(cx, 0.012, cz, W, 0.02, L, hex('#ABA497'), ry, 0, 0, 1, NO); continue; }
      if (r.walk) {   // 2B 水部步道：中间花岗岩石板，两边绿化带（榕树），石栏；不画任何地面指引
        const sw = r.w - 4.4; k.g('granite').box(cx, 0.012, cz, sw, 0.02, L, hex('#ABA497'), ry, 0, 0, 1, NO);
        for (const sv of [-1, 1]) k.solid.box(cx + r.dir[1] * sv * (sw / 2 + 1.1), 0.01, cz - r.dir[0] * sv * (sw / 2 + 1.1), 2.2, 0.02, L, hex('#6F8F4E'), ry, 0, 0, 1, NO);
        for (const [ax, az, bx, bz] of r.rails || []) this.stoneRail(ax, az, bx, bz);
        continue;
      }
      if (r.b3 || (FZR.b3 && FZR.b3.grey && FZR.b3.grey.roads.includes(r.id))) {   // 3B 路桥两头的路（小美 11-17：凤坂河口旁 1B 前横南路 gm3 桥面 + 两头也换成同款，不再一块深蓝）：和桥面同款深灰沥青（granite 桶，不反天光）+ 双黄中线 + 白边线，接得上
        const GR = k.g('granite'), W2 = (W - 3) / 2, ln = (u, c, wd) => k.solid.box(cx + r.dir[1] * u, 0.018, cz - r.dir[0] * u, wd, 0.006, L, hex(c), ry, 0, 0, 1, NO);
        GR.box(cx, 0.006, cz, W - 3, 0.012, L, hex('#4E5155'), ry, 0, 0, 1, NO); for (const e of [-1, 1]) { ln(e * 0.18, '#E2B53A', 0.14); ln(e * (W2 - 0.5), '#E8E6DF', 0.18); }
        continue;
      }
      A.box(cx, 0.006, cz, W - 3, 0.012, L, hex('#8E9094'), ry, 0, 0, 1, NO);
      k.solid.box(cx, 0.014, cz, 0.12, 0.004, L, hex('#F2C230'), ry, 0, 0, 1, NO);
      if (r.name && !r.stub) this.roadSignW(cx + r.dir[1] * (W / 2 - 0.6), cz - r.dir[0] * (W / 2 - 0.6), r.name, ry);
    }
  }
  roadSignW(x, z, name, ry, y = 2.9, pole = true) {
    const k = this.kit; if (pole) k.metal.cyl(x, 1.4, z, 0.08, 2.8, hex('#8A9198'), 8);
    const uv = this.atlas.draw(1.8, 0.5, textPaint([name], { bg: '#1F5FA8', fg: '#FFFFFF' }), 80), fx = Math.cos(ry), fz = -Math.sin(ry);
    this.atlas.quad(x + fx * 0.02, y, z + fz * 0.02, 1.8, 0.5, Math.atan2(fx, -fz), uv); this.atlas.quad(x - fx * 0.02, y, z - fz * 0.02, 1.8, 0.5, Math.atan2(-fx, fz), uv);
  }
  /* ---------- 房子 ---------- */
  facades() {
    const A = this.atlas; this.fac = {};
    const walls = ['#D9D2C4', '#C9CED2', '#E3D9C6', '#BFC6C9'];
    for (const fl of [4, 5, 6, 7, 8]) for (let c = 0; c < 2; c++) this.sceneTag(facadeWindows(fl, 5)), this.fac['m' + fl + c] = A.draw(14, fl * 3, facadePaint({ floors: fl, bays: 5, wall: walls[(fl + c) % 4], tile: 0.06, band: '#F3F0EA', glass: c ? '#7FA3B8' : '#86A8A0', frame: '#F1EEE8', grille: false, balcony: c ? null : '#C7C0B2' }), 12);
    const mh = (cv, pw, ph) => {
      cv.fillStyle = '#F1EEE6'; cv.fillRect(0, 0, pw, ph);
      cv.fillStyle = '#5E6266'; cv.fillRect(0, ph * 0.86, pw, ph * 0.14);   // 青石勒脚
      cv.fillStyle = '#4A2A1C'; cv.fillRect(pw * 0.42, ph * 0.42, pw * 0.16, ph * 0.44);   // 木门
      cv.strokeStyle = '#C9A25C'; cv.lineWidth = 2; cv.strokeRect(pw * 0.42, ph * 0.42, pw * 0.16, ph * 0.44);
      for (const x of [0.14, 0.72]) { cv.fillStyle = '#3B2A20'; cv.fillRect(pw * x, ph * 0.3, pw * 0.14, ph * 0.22); cv.strokeStyle = '#8A6A44'; cv.lineWidth = 2; for (let i = 1; i < 4; i++) { cv.beginPath(); cv.moveTo(pw * x + pw * 0.14 * i / 4, ph * 0.3); cv.lineTo(pw * x + pw * 0.14 * i / 4, ph * 0.52); cv.stroke(); } }
      cv.fillStyle = 'rgba(0,0,0,0.08)'; cv.fillRect(0, 0, pw, ph * 0.06);
    };
    this.sceneTag([[0.14, 0.3, 0.14, 0.22], [0.72, 0.3, 0.14, 0.22]], 4); this.fac.mh = A.draw(10, 6, mh, 26);
    if (FZR.d2) {
      // 2D：白墙黛瓦民居的侧墙 / 后墙（2C 教训：不留没贴图的纯白墙）——白灰墙 + 青石勒脚 + 一扇小格窗 + 雨渍
      this.sceneTag([[0.44, 0.3, 0.12, 0.18]], 4); this.fac.mhS = A.draw(10, 6, (cv, pw, ph) => {
        cv.fillStyle = '#ECE7DC'; cv.fillRect(0, 0, pw, ph);
        for (let i = 0; i < 7; i++) { cv.fillStyle = `rgba(90,85,75,${0.04 + (i % 3) * 0.02})`; cv.fillRect(pw * (0.06 + i * 0.14), ph * 0.06, pw * 0.05, ph * (0.25 + (i % 3) * 0.12)); }   // 雨渍
        cv.fillStyle = '#5E6266'; cv.fillRect(0, ph * 0.86, pw, ph * 0.14);
        cv.fillStyle = '#3B2A20'; cv.fillRect(pw * 0.44, ph * 0.3, pw * 0.12, ph * 0.18); cv.strokeStyle = '#8A6A44'; cv.lineWidth = 2;
        for (let i = 1; i < 4; i++) { cv.beginPath(); cv.moveTo(pw * (0.44 + 0.03 * i), ph * 0.3); cv.lineTo(pw * (0.44 + 0.03 * i), ph * 0.48); cv.stroke(); }
        cv.fillStyle = 'rgba(0,0,0,0.08)'; cv.fillRect(0, 0, pw, ph * 0.06);
      }, 26);
      // 2D 朱紫坊沿河立面（小美 2D ③）：门一律是关着的双扇木门（门缝 + 门环 + 石门槛），窗是关着的木格窗
      this.sceneTag([[0.12, 0.28, 0.14, 0.24], [0.74, 0.28, 0.14, 0.24]], 5); this.fac.zzf = A.draw(10, 6, (cv, pw, ph) => {
        cv.fillStyle = '#F0EBE1'; cv.fillRect(0, 0, pw, ph);
        cv.fillStyle = '#5E6266'; cv.fillRect(0, ph * 0.86, pw * 0.4, ph * 0.14); cv.fillRect(pw * 0.6, ph * 0.86, pw * 0.4, ph * 0.14);
        cv.fillStyle = '#8E887C'; cv.fillRect(pw * 0.38, ph * 0.44, pw * 0.24, ph * 0.04);   // 门楣石
        cv.fillStyle = '#4A2418'; cv.fillRect(pw * 0.4, ph * 0.48, pw * 0.2, ph * 0.5);
        cv.strokeStyle = '#2A140C'; cv.lineWidth = 3; cv.beginPath(); cv.moveTo(pw * 0.5, ph * 0.48); cv.lineTo(pw * 0.5, ph * 0.98); cv.stroke();   // 门缝
        for (const x of [0.4, 0.5]) for (let j = 1; j < 4; j++) { cv.strokeStyle = 'rgba(30,12,6,0.6)'; cv.lineWidth = 2; cv.strokeRect(pw * (x + 0.015), ph * (0.48 + (j - 1) * 0.165 + 0.02), pw * 0.07, ph * 0.13); }   // 门板格
        for (const x of [0.47, 0.53]) { cv.strokeStyle = '#C9A25C'; cv.lineWidth = 3; cv.beginPath(); cv.arc(pw * x, ph * 0.72, ph * 0.025, 0, TAU); cv.stroke(); }   // 门环
        for (const x of [0.12, 0.74]) { cv.fillStyle = '#4A3326'; cv.fillRect(pw * x, ph * 0.28, pw * 0.14, ph * 0.24); cv.strokeStyle = '#7A5A3A'; cv.lineWidth = 2;
          for (let i = 1; i < 5; i++) { cv.beginPath(); cv.moveTo(pw * x + pw * 0.14 * i / 5, ph * 0.28); cv.lineTo(pw * x + pw * 0.14 * i / 5, ph * 0.52); cv.stroke(); }
          cv.beginPath(); cv.moveTo(pw * x, ph * 0.4); cv.lineTo(pw * (x + 0.14), ph * 0.4); cv.stroke(); }
        cv.fillStyle = 'rgba(0,0,0,0.08)'; cv.fillRect(0, 0, pw, ph * 0.06);
      }, 26);
    }
  }
  houses() {
    const k = this.kit;
    for (const h of FZR.houses) { if (h.gone) continue; const ry = yawOf(h.f[0], h.f[1]); k.col(h.x, h.h / 2, h.z, h.w, h.h, h.d, { ry, name: 'colHouse' }); }
    // 2D 东段楼进 80 m 细节格子：整段合成一组时包围盒跨 400 m，河边往西看整组都裁不掉（+8k 面）。格子已有，不增 draw。
    if (FZR.d2) FZR.houses.forEach((h, i) => {
      if (inD2E(h.x, h.z)) this.det(h.x, h.z, () => this.houseBody(h, i));
      else if (h.d2) (this._nhjH = this._nhjH || []).push([h, i]);   // 步道两侧 4 栋：进 d2b 紧包围盒，牌坊口往西看能裁掉（不进 gN0 大网格）
    });
  }
  houseBodies() {
    const k = this.kit, P = k.solid, A = this.atlas, cols = ['#D9D2C4', '#C9CED2', '#E3D9C6', '#BFC6C9'];
    FZR.houses.forEach((h, i) => {
      if (h.gone) return;   // 3B：凤坂河口占到的 1B 楼（gone 标记，下标 / 颜色不动）
      if (!this.c2ok(h.z, h.x)) return;
      if (this._d2epass && inD2E(h.x, h.z)) return;   // 已进细节格子
      if (h.d2 && !inD2E(h.x, h.z) && !this._nhjHdraw) return;   // 进 d2b
      this.houseBody(h, i);
    });
  }
  houseBody(h, i) {
    const k = this.kit, P = k.solid, A = this.atlas, cols = ['#D9D2C4', '#C9CED2', '#E3D9C6', '#BFC6C9'];
      const ry = yawOf(h.f[0], h.f[1]), fx = h.f[0], fz = h.f[1], tx = fz, tz = -fx;
      if (h.kind === 'mod') {
        P.box(h.x, h.h / 2, h.z, h.w, h.h, h.d, hex(cols[i % 4]), ry, 0, 0, 1, NO);
        P.box(h.x, h.h + 0.25, h.z, h.w + 0.3, 0.5, h.d + 0.3, hex('#E9E5DD'), ry, 0, 0, 1, NO);
        const fl = Math.max(4, Math.min(8, Math.round(h.h / 3)));
        A.quad(h.x + fx * (h.d / 2 + 0.03), h.h / 2, h.z + fz * (h.d / 2 + 0.03), h.w, h.h, Math.atan2(fx, -fz), this.fac['m' + fl + (i % 2)]);
        if (h.back || (FZR.c2 && h.z < FZR.c2.z0)) {   // 2C 的楼四面都贴立面（小美 2C ②：宁化 A 口出来左手那栋侧墙是白方块）；背朝水部步道 / 亭子的楼：背面 + 两个侧面也贴立面（小美 2B ②：原来是没贴图的白方块）
          const fc = this.fac['m' + fl + ((i + 1) % 2)];
          A.quad(h.x - fx * (h.d / 2 + 0.03), h.h / 2, h.z - fz * (h.d / 2 + 0.03), h.w, h.h, Math.atan2(-fx, fz), fc);
          for (const se of [-1, 1]) A.quad(h.x + tx * se * (h.w / 2 + 0.03), h.h / 2, h.z + tz * se * (h.w / 2 + 0.03), h.d, h.h, Math.atan2(tx * se, -tz * se), fc);
        }
      } else {
        // 白墙黛瓦：墙身 + 两坡瓦顶（屋脊沿 t）+ 两头马鞍墙（阶梯状白墙 + 黑瓦压顶）
        P.box(h.x, h.h / 2, h.z, h.w, h.h, h.d, hex('#F1EEE6'), ry, 0, 0, 1, NO);
        P.box(h.x, 0.3, h.z, h.w + 0.04, 0.6, h.d + 0.04, hex('#6B6F73'), ry, 0, 0, 1, NO);
        const rise = 1.9, slope = Math.atan2(rise, h.d / 2);
        for (const sd of [-1, 1]) P.box(h.x + fx * sd * h.d / 4, h.h + rise / 2, h.z + fz * sd * h.d / 4, h.w - 0.4, 0.14, Math.hypot(h.d / 2, rise) + 0.4, hex('#33373C'), ry, sd * slope, 0, 1, NO);
        P.box(h.x, h.h + rise + 0.05, h.z, h.w - 0.4, 0.2, 0.3, hex('#2A2D31'), ry, 0, 0, 1, NO);
        for (const se of [-1, 1]) {
          const ex = h.x + tx * se * (h.w / 2 - 0.2), ez = h.z + tz * se * (h.w / 2 - 0.2);
          for (const [dd, hh] of [[h.d * 0.5, rise + 0.9], [h.d * 0.24, rise + 1.5]]) { P.box(ex, h.h + hh / 2, ez, 0.4, hh, dd * 2, hex('#F3F1EA'), ry, 0, 0, 1, NO); P.box(ex, h.h + hh + 0.08, ez, 0.62, 0.16, dd * 2 + 0.3, hex('#2E3238'), ry, 0, 0, 1, NO); }
        }
        A.quad(h.x + fx * (h.d / 2 + 0.03), h.h / 2, h.z + fz * (h.d / 2 + 0.03), h.w, h.h, Math.atan2(fx, -fz), h.zzf ? this.fac.zzf : this.fac.mh);
        if (h.d2) {   // 2D：侧墙 / 后墙也贴立面（不留纯白墙）
          A.quad(h.x - fx * (h.d / 2 + 0.03), h.h / 2, h.z - fz * (h.d / 2 + 0.03), h.w, h.h, Math.atan2(-fx, fz), this.fac.mhS);
          for (const se of [-1, 1]) A.quad(h.x + tx * se * (h.w / 2 + 0.03), h.h / 2, h.z + tz * se * (h.w / 2 + 0.03), h.d, h.h, Math.atan2(tx * se, -tz * se), this.fac.mhS);
        }
        if (h.zzf) {   // 朱紫坊：关着的双扇木门（实体门板压在门洞上，门环、石门槛）—— 一看就进不去
          const dw = h.w * 0.2, dh = h.h * 0.5, fd = h.d / 2 + 0.06, wood = hex('#4A2418');
          P.box(h.x + fx * fd, 0.12 + (dh - 0.12) / 2, h.z + fz * fd, dw, dh - 0.12, 0.1, wood, ry, 0, 0, 1, NO);
          P.box(h.x + fx * (fd + 0.06), 0.12 + (dh - 0.12) / 2, h.z + fz * (fd + 0.06), 0.04, dh - 0.12, 0.02, hex('#2A140C'), ry, 0, 0, 1, NO);   // 门缝
          for (const se of [-1, 1]) P.cyl(h.x + fx * (fd + 0.07) + tx * se * 0.16, dh * 0.56, h.z + fz * (fd + 0.07) + tz * se * 0.16, 0.12, 0.03, hex('#C9A25C'), 8, ry, Math.PI / 2);   // 门环
          this.kit.g('granite').box(h.x + fx * (fd + 0.25), 0.07, h.z + fz * (fd + 0.25), dw + 0.6, 0.14, 0.5, hex('#9A9385'), ry, 0, 0, 1, NO);   // 石门槛
        }
      }
  }
  /* ---------- 榕树：主干与主树冠进静态合批常开（不增 draw call，远景不悬空）；分杈 / 气根 / 副冠只开附近 ---------- */
  trees() {
    FZR.trees.forEach(([x, z, fx, fz, s, kind, up], i) => {
      if (kind === 'gone') return;   // 3B：凤坂河口占到的 1B 榕树
      if (kind === 'nhjw') { this._nhjw = this._nhjw || []; this._nhjw.push([x, z, fx, fz, s, up]); }
      else if (kind !== 'lake') this.det(x, z, () => {   // 2D 东段主干也进格子（同楼）：别和岸墙合成 400 m 包围盒
        if (inD2E(x, z)) this.treeBlobAt(x, z, fx, fz, s, kind, up, i);
        this.banyanNear(x, z, fx, fz, s, up);
      });
    });   // 2D 步道（南后街 ⇄ 牌坊）那 4 棵榕树直接进常开的 g0：放进细节格子会把格子的包围盒拉到牌坊口，河边往西看整格都裁不掉（+3k 面）
  }
  // up = 1：2B 新种的树（东段 / 水部步道）主干直立，树冠略朝 f 偏 —— 不再斜着横过人行道（小美 2B ④）；气根只垂到 2.6 m 以上
  banyanNear(x, z, fx, fz, s, up) {
    const P = this.kit.solid, trunk = hex('#6B5A48'), G = ['#2F6B34', '#3A7A3C', '#2A5F30'], lean = up ? 0 : 1.6 * s;
    for (const a of [-0.7, 0.7]) { const c = Math.cos(a), sn = Math.sin(a), dx = fx * c - fz * sn, dz = fz * c + fx * sn; P.tube([x + fx * lean, 3.2 * s, z + fz * lean], [x + fx * lean + dx * 2.6 * s, 5.0 * s, z + fz * lean + dz * 2.6 * s], 0.42 * s, trunk, 4, false); }
    P.ellipsoid(x + fx * (lean + 2.4 * s) - fz * 1.4, 5.9 * s, z + fz * (lean + 2.4 * s) + fx * 1.4, 6.2 * s, 2.6 * s, 5.6 * s, hex(G[(x | 0) % 3 < 0 ? 0 : (x | 0) % 3]), 1);
    for (let i = 0; i < 4; i++) { const r = (1.6 + i * 0.7) * s, sd = i % 2 ? 1 : -1, px = x + fx * (lean + r) + fz * sd * 1.2, pz = z + fz * (lean + r) - fx * sd * 1.2; P.tube([px, 4.6 * s, pz], [px, (up ? 2.6 + (i % 2) * 0.4 : 2.2 - (i % 2) * 0.9) * s, pz], 0.1 * s, hex('#7A6A56'), 3, false); }   // 垂到水面上方的气根
  }
  treeBlobs() {
    FZR.trees.forEach(([x, z, fx, fz, s, kind, up], i) => {
      if (kind === 'gone') return;
      if (!this.c2ok(z, x)) return;
      if (this._d2epass && inD2E(x, z)) return;   // 已进细节格子
      this.treeBlobAt(x, z, fx, fz, s, kind, up, i);
    });
  }
  treeBlobAt(x, z, fx, fz, s, kind, up, i) {
    const P = this.kit.solid, trunk = hex('#6B5A48'), G = ['#2F6B34', '#3A7A3C', '#2A5F30', '#447F3A'];
    if (kind === 'lake') {
      P.tube([x, 0, z], [x + fx * 0.8, 4.2 * s, z + fz * 0.8], 0.5 * s, hex('#5E4E3E'), 5, false);
      P.ellipsoid(x + fx * 1.2, 5.0, z + fz * 1.2, 5.4, 2.6, 5.4, hex('#7FB347'), 1);
      return;
    }
    const lean = up ? 0 : 1.6 * s;
    // 简模主干一直插进树冠底部（5.1 s，树冠底约 4.6 s），和树冠同在 kit.solid 静态合批（0 额外 draw call）
    const tv0 = P.p.length / 3, ta = [x, 0, z], tb = [x + fx * (lean + 0.8 * s), 5.1 * s, z + fz * (lean + 0.8 * s)];
    P.tubeTaper(ta, [x + fx * (lean + 0.8 * s), 5.1 * s, z + fz * (lean + 0.8 * s)], 1.0 * s, 0.45 * s, trunk, 5, false);
    if (FZR.id === 'e') trunkNormals(P, tv0, ta, tb, 0.5 * s, 0.225 * s);   // 小美 11-17：光明港一带主干发粉白 → 按真实锥面重算法线（tubeTaper 的非均匀缩放把侧面法线掰成朝天，迎着太阳一片白），和其它河段一样是棕色
    P.ellipsoid(x + fx * (lean + 1.4 * s), 6.3 * s, z + fz * (lean + 1.4 * s), 9.5 * s, 3.4 * s, 8.5 * s, hex(G[i % 4]), 1, yawOf(fx, fz));
  }
  /* ---------- 步道：路灯 / 长椅 ---------- */
  promenade() {
    for (const [id, r] of Object.entries(RIVERS)) for (const side of [-1, 1]) for (let s = 20; s < r.line.len - 10; s += 34) {
      const a = r.line.at(s, side * (r.hw + 5.2)); if (isWater(a.x, a.z) || BRIDGES.some(b => Math.hypot(b.x - a.x, b.z - a.z) < b.w / 2 + b.half)) continue;
      if (FZR.d2 && Math.hypot(a.x - FZR.d2.zzf.sign[0], a.z - FZR.d2.zzf.sign[1]) < 4.5) continue;   // 2D 朱紫坊石牌前不放路灯长椅
      const fx = -a.nx * side, fz = -a.nz * side;   // 朝河
      this.det(a.x, a.z, () => {
        D.lamp(this.kit, a.x, 0, a.z, yawOf(fx, fz));
        const b = r.line.at(s + 9, side * (r.hw + 4.2));
        // 2B 东西河东段（1A 段树最东约 x=-50）：沿河看去，原长椅端面是铸铁腿的实心黑方板，改用带扶手的侧框
        if (!isWater(b.x, b.z)) D.bench(this.kit, b.x, 0, b.z, yawOf(-fx, -fz), (id === 'dx' && b.x > -30) || (id === 'bm' && FZR.c2 && s > FZR.c2.bmALen) || (id === 'at' && FZR.d2 && s > FZR.d2.atALen));   // 2C 白马河下段 / 2D 安泰河东段也用铸铁扶手侧框
      });
    }
  }
  /** 3B：琴亭湖一圈步道的路灯 / 长椅（生成器按湖岸 5.2 m 一圈、34 m 一盏，同沿河步道；进细节格子） */
  lakeLamps() {
    for (const [x, z, fx, fz, bx, bz] of FZR.b3.lamps) this.det(x, z, () => { D.lamp(this.kit, x, 0, z, yawOf(fx, fz)); D.bench(this.kit, bx, 0, bz, yawOf(-fx, -fz), true); });
  }
  /* ---------- 三坊七巷南口（澳门桥北头 → 南后街）：石板街 + 牌坊 ---------- */
  sanfang() {
    const S = FZR.sfqx, k = this.kit, GR = k.g('granite'), P = k.solid, A = this.atlas, dx = S.dir[0], dz = S.dir[1], tx = dz, tz = -dx, ry = yawOf(dx, dz);
    for (const sd of [-1, 1]) { const x = S.x + tx * sd * 3.6, z = S.z + tz * sd * 3.6; GR.box(x, 3, z, 0.7, 6, 0.7, hex('#8E887C'), ry); k.col(x, 3, z, 0.7, 6, 0.7, { ry, name: 'colGate' }); }
    GR.box(S.x, 5.6, S.z, 8.6, 0.7, 0.8, hex('#8E887C'), ry); P.box(S.x, 6.35, S.z, 9.4, 0.18, 1.6, hex('#33373C'), ry, 0, 0, 1, NO);
    const uv = A.draw(3.6, 0.9, textPaint(['三坊七巷', 'Three Lanes and Seven Alleys'], { bg: '#6E675B', fg: '#F2E2B0' }), 90);
    A.quad(S.x - dx * 0.42, 4.75, S.z - dz * 0.42, 3.6, 0.9, Math.atan2(-dx, dz), uv);
    const uv2 = A.draw(1.6, 0.42, textPaint(['南后街'], { bg: '#2E1F14', fg: '#E9C46A' }), 80);
    A.quad(S.x - dx * 0.42 + tx * 2.6, 2.6, S.z - dz * 0.42 + tz * 2.6, 1.6, 0.42, Math.atan2(-dx, dz), uv2);
    // 牌坊后面：南后街继续往里（远景：两排白墙 + 红灯笼），看得见走不进（第 2 批接东街口 C 口的三坊七巷街区）
    // 2D：牌坊后面接上南后街（东街口 C 口一路走过来），原来那块白墙 + 挡板拆掉
    if (!FZR.d2) { const bx = S.x + dx * 6, bz = S.z + dz * 6; P.box(bx, 3, bz, 12, 6, 0.4, hex('#F1EEE6'), ry); k.col(bx, 3, bz, 12, 6, 0.6, { ry, name: 'colBack' }); }
    for (const sd of [-1, 1]) for (let i = 0; i < 3; i++) P.ellipsoid(S.x + dx * (1 + i * 1.6) + tx * sd * 3.2, 3.2, S.z + dz * (1 + i * 1.6) + tz * sd * 3.2, 0.5, 0.6, 0.5, hex('#D7262E'), 1);
  }
  /** 石牌（灰石块 + 两面刻字，同 fzAttr.stone）：正面朝 (fx, fz) */
  stoneSign(x, z, fx, fz, w, h, lines, bg = '#7E786C') {
    const k = this.kit, A = this.atlas, ry = yawOf(fx, fz);
    k.g('granite').box(x, h / 2, z, w, h, 0.6, hex(bg), ry, 0, 0, 1, NO); k.col(x, h / 2, z, w, h, 0.6, { ry, name: 'colSign' });
    const uv = A.draw(w * 0.94, h * 0.8, textPaint(lines, { bg, fg: '#F2E2B0' }));
    A.quad(x + fx * 0.31, h * 0.5, z + fz * 0.31, w * 0.94, h * 0.8, Math.atan2(fx, -fz), uv); A.quad(x - fx * 0.31, h * 0.5, z - fz * 0.31, w * 0.94, h * 0.8, Math.atan2(-fx, fz), uv);
  }
  /** 2D：朱紫坊石牌、琼东河口远景（岸墙 / 岸上石栏 / 对岸树） */
  d2Static() {
    const k = this.kit, D2 = FZR.d2, Z = D2.zzf, M = D2.mouth, GR = k.g('granite'), P = k.solid;
    this.stoneSign(Z.sign[0], Z.sign[1], Z.f[0], Z.f[1], 3.6, 1.5, ['朱紫坊', 'Zhuzifang']);
    for (const w of FZR.wall) if (w[4] === 5) {   // 矮挡墙可见几何（碰撞在 walls() 已登记，不进常开 g0）
      const [ax, az, bx, bz, flag, sg] = w, L = Math.hypot(bx - ax, bz - az), dx = (bx - ax) / L, dz = (bz - az) / L, rx = dz * sg, rz = -dx * sg, ry = yawOf(dx, dz), mx = (ax + bx) / 2, mz = (az + bz) / 2;
      GR.box(mx, (WY - 0.4 + WY + 0.7) / 2, mz, 0.7, 1.1, L + 0.6, hex('#8E887C'), ry, 0, 0, 1, NO); GR.box(mx, WY + 0.74, mz, 0.86, 0.08, L + 0.7, hex(COPING), ry, 0, 0, 1, NO);
      for (let u = -L / 2 + 0.9; u < L / 2 - 0.5; u += 1.6) GR.box(mx + dx * u + rx * 0.36, WY + 0.15, mz + dz * u + rz * 0.36, 0.02, 1.1, 0.04, hex('#6E685C'), ry, 0, 0, 1, NO);
    }
    for (const [ax, az, bx, bz] of M.shore) { GR.quad([ax, 0.0, az], [bx, 0.0, bz], [bx, WY - 0.4, bz], [ax, WY - 0.4, az], hex(WALLC)); GR.quad([bx, 0.0, bz], [ax, 0.0, az], [ax, WY - 0.4, az], [bx, WY - 0.4, bz], hex(WALLC)); }
    for (const [ax, az, bx, bz] of M.rail) this.stoneRail(ax, az, bx, bz);
    // 远景对岸：琼东河两岸一排榕树冠（只看；固定序列取色）
    const G = ['#2F6B34', '#3A7A3C', '#2A5F30', '#447F3A'], [qx, qz] = M.qdh;
    for (let i = 0; i < 14; i++) { const u = (i - 6.5) * 13, e = i % 2 ? 1 : -1, x = qx + 9 * e + u * 0.08, z = qz + u;
      P.tubeTaper([x, 0, z], [x, 4.8, z], 1.0, 0.45, hex('#6B5A48'), 5, false); P.ellipsoid(x, 6.1, z, 9, 3.3, 8.5, hex(G[i % 4]), 1); }
    for (const e of [-1, 1]) { const x = M.x + M.t[0] * 18 + M.n[0] * e * 14, z = M.z + M.t[1] * 18 + M.n[1] * e * 14;
      P.tubeTaper([x, 0, z], [x, 4.8, z], 1.0, 0.45, hex('#6B5A48'), 5, false); P.ellipsoid(x, 6.1, z, 9, 3.3, 8.5, hex(G[(e + 2) % 4]), 1); }
  }
  /** 2D：东街口 C → 三坊七巷（南后街）。fzAttr.sanfang 用局部坐标（亭子在原点、南后街往 +z）：转 180° 嵌进来（局部 (x, z) → W (X0 - x, Z0 - z)），
   *  南后街一路往南（W -z）接一段石板步道到河网的三坊七巷南口牌坊（小美 2D ②）。亭子在局部 (12, -1)（kioskAt 画，亭口朝 W +z = 杨桥东路） */
  nhjStreet(lo = false) {
    // lo（远处 LOD，组 d2sLo）：同一套街再画一遍简化版；碰撞体不重复登记，贴图按 hi 那遍的顺序复用（不多占图集）
    const real0 = this.kit, A0 = this.atlas, col0 = real0.col, colSlab0 = real0.colSlab, draw0 = A0.draw;
    if (!lo) { this._d2draws = []; A0.draw = (...a) => { const uv = draw0.apply(A0, a); this._d2draws.push([a[0], a[1], uv]); return uv; }; }
    else { let n = 0; real0.col = () => {}; real0.colSlab = () => {}; A0.draw = (...a) => { const r = this._d2draws[n++]; return r && r[0] === a[0] && r[1] === a[1] ? r[2] : draw0.apply(A0, a); }; }
    try { this.nhjStreet_(lo); } finally { real0.col = col0; real0.colSlab = colSlab0; A0.draw = draw0; }
  }
  nhjStreet_(lo) {
    const N = FZR.d2.nhj, X0 = N.X0, Z0 = N.Z0, real = this.kit, A = this.atlas, touched = new Set(), R = Math.PI;
    const g = n => { const G = real.g(n); if (!touched.has(G)) { touched.add(G); G.xf = { cx: 0, cz: 0, s: -1, sy: 1, ox: X0, oz: Z0 }; } return G; };
    const pk = { g, get solid() { return g('paint'); }, M: real.M, root: real.root,
      col: (x, y, z, w, h, d, o = {}) => real.col(X0 - x, y, Z0 - z, w, h, d, { ...o, ry: (o.ry || 0) + R }),
      colSlab: (x0, x1, y0, y1, z0, z1, o) => real.colSlab(X0 - x1, X0 - x0, y0, y1, Z0 - z1, Z0 - z0, o) };
    const SHOPWIN = Array.from({ length: 6 }, (_, j) => [j / 6 + 0.03, 0.08, 1 / 6 - 0.06, 0.34]);   // fzAttr sanfang 店面（12×5.6 m）上半截的木格纸窗
    const pa = { draw: (...a) => { if (a[0] === 12 && a[1] === 5.6) this.sceneTag(SHOPWIN, 4); try { return A.draw(...a); } finally { this._aTag = null; } }, quad: (x, y, z, w, h, ry, uv) => A.quad(X0 - x, y, Z0 - z, w, h, ry + R, uv) };
    const fill = [];
    sanfangStreet({ kit: pk, atlas: pa, filler: list => fill.push(...list) }, { embed: true, endFace: this.fac.mhS, lo });
    for (const G of touched) G.xf = null;
    this.filler(fill.map(([x, z, w, d, h, c]) => [X0 - x, Z0 - z, w, d, h, c]));   // 街区原来的远处楼（局部坐标 → W）
    // 杨桥东路南侧人行道（局部 z -8..2）+ 路缘石 + 人行道护栏（深灰钢，护栏外就是马路）+ 杨桥东路（只看）
    const GR = real.g('granite'), Mt = real.metal, zc = Z0 + 8;
    GR.slab(X0 - 24, X0 + 24, 0.005, 0.03, Z0 - 2, zc, hex('#C9C3B6'), NO);
    if (!lo) for (let x = X0 - 23; x < X0 + 24; x += 2) GR.slab(x, x + 0.06, 0.031, 0.035, Z0 - 1.8, zc - 0.2, hex('#ADA698'), NO);
    if (!lo) {   // 路缘石 + 杨桥东路（±160 m 长）只在 hi 里画：lo 组的包围盒要收在街区宽度内，河边往东 / 往西看时整组能被视锥裁掉
      GR.slab(X0 - 60, X0 + 60, 0.0, 0.15, zc, zc + 0.3, hex('#9A9385'), NO);
      real.g('asphalt').slab(X0 - 160, X0 + 160, 0.004, 0.012, zc + 0.3, zc + 14.6, hex('#7E8084'), NO);
      real.solid.slab(X0 - 160, X0 + 160, 0.012, 0.016, zc + 7.38, zc + 7.52, hex('#F2C230'), NO);
      GR.slab(X0 - 160, X0 + 160, 0.0, 0.15, zc + 14.6, zc + 18, hex('#B9B5AD'), NO);
    }
    Mt.slab(X0 - 24, X0 + 24, 0.92, 0.98, zc - 0.12, zc - 0.06, hex('#4A5560'), NO); Mt.slab(X0 - 24, X0 + 24, 0.18, 0.24, zc - 0.12, zc - 0.06, hex('#4A5560'), NO);
    if (!lo) for (let x = X0 - 24; x <= X0 + 24.01; x += 2) Mt.slab(x - 0.03, x + 0.03, 0, 0.98, zc - 0.12, zc - 0.06, hex('#4A5560'), NO);   // lo：护栏立柱省掉（远处只看得到两道横杆）
    // 路口：只放真实路名牌（蓝底白字），不画地面引导
    this.roadSignW(X0 + 9.5, Z0 + 6.6, '杨桥东路', Math.PI / 2);   // 同一根杆：上面杨桥东路（顺马路），下面南后街（顺南后街）
    this.roadSignW(X0 + 9.5, Z0 + 6.6, '南后街', 0, 2.3, false);
  }
  /** 西湖一角的远景：湖对岸一排垂柳（边界外） */
  backdrops() {
    const P = this.kit.solid, [x0, , , z1] = FZR.lakeBox;
    for (let x = x0 + 4; x < -300; x += 9) P.ellipsoid(x, 4, z1 + 4, 8, 4.5, 6, hex(x % 2 ? '#7FB347' : '#6FA341'), 1);
    for (let z = 140; z < z1; z += 9) P.ellipsoid(x0 - 4, 4, z, 6, 4.5, 8, hex('#7FB347'), 1);
  }
  /* ---------- 出口亭（福州地铁）：两个，亭口朝北 ---------- */
  kioskAt(K) {
    const k = this.kit, ex = [FZ_EXITS[K.code], ...(FZ_EXITS[K.code].more || [])].find(e => e.n === K.n) || FZ_EXITS[K.code];
    const lc = (FZ_LINES[ex.line] || { color: '#C8102E' }).color, P = k.solid, M = k.metal, ox = K.x, oz = K.z, [bz, be] = this.N.brand;
    const sl = (G, x0, x1, y0, y1, z0, z1, c, o) => G.slab(x0 + ox, x1 + ox, y0, y1, z0 + oz, z1 + oz, c, o);
    // 2D：东街口 C 亭内地单独铺 2C 花岗岩石板（#ABA497 + granite，同南后街 / 水部步道）。共用预制体其它亭仍用原来的漆面，避免改到已验收的出口亭。
    if (K.code === 'fzdjk') sl(k.g('granite'), -2.6, 2.6, 0, 0.06, -6.4, 0.4, hex('#ABA497'), NO);
    else sl(P, -2.6, 2.6, 0, 0.06, -6.4, 0.4, hex('#B9B5AD'), NO);
    for (let i = 0; i < 10; i++) { const z = -2.8 - i * 0.36, y = -0.18 - i * 0.24; sl(P, -1.8, 1.8, y - 0.08, y, z - 0.36, z, hex(i % 2 ? '#C9C5BD' : '#BDB9B1'), NO); }
    sl(P, -1.9, 1.9, -3, -2.9, -6.4, -2.6, hex('#1B1E22'), NO);
    for (const sx of [-1, 1]) { sl(k.glass, sx * 2.5 - 0.02, sx * 2.5 + 0.02, 0.06, 2.9, -6.3, -0.2, hex('#D6EEF8')); k.colSlab(sx * 2.5 - 0.1 + ox, sx * 2.5 + 0.1 + ox, 0, 3, -6.4 + oz, 0.2 + oz); sl(M, sx * 2.5 - 0.08, sx * 2.5 + 0.08, 0, 3.1, 0.1, 0.3, hex('#5C646C'), NO); sl(M, sx * 2.5 - 0.08, sx * 2.5 + 0.08, 0, 3.1, -6.4, -6.2, hex('#5C646C'), NO); }
    sl(k.glass, -2.5, 2.5, 0.06, 2.9, -6.34, -6.3, hex('#D6EEF8')); k.colSlab(-2.6 + ox, 2.6 + ox, 0, 3, -6.6 + oz, -6.3 + oz);
    for (const sx of [-1, 1]) { k.rail(sx * 1.9 + ox, -2.6 + oz, sx * 1.9 + ox, -6.2 + oz, 0); }
    sl(M, -2.9, 2.9, 3.0, 3.25, -6.8, 0.7, hex('#6E767E'), NO);
    sl(k.g('band'), -2.92, 2.92, 2.75, 3.0, 0.62, 0.72, hex(lc), NO);
    // 亭子里往下的踏步：岸地三角网在这里挖了洞（tools/fzriver/gen.py），走进去 = 回站
    const sign = (c, pw, ph) => {
      c.fillStyle = '#20272E'; c.fillRect(0, 0, pw, ph);
      c.fillStyle = lc; c.fillRect(0, 0, ph, ph); c.fillStyle = '#FFF'; c.textAlign = 'center'; c.textBaseline = 'middle';
      c.font = `800 ${ph * 0.6}px ${FONT_EN}`; c.fillText(ex.n || '出', ph / 2, ph * 0.54);
      c.textAlign = 'left'; c.font = `800 ${ph * 0.36}px ${FONT}`; c.fillText(bz + `  ${FZ_STATIONS_ZH(K.code)} ${ex.n}出口`, ph * 1.2, ph * 0.38);
      c.font = `600 ${ph * 0.2}px ${FONT_EN}`; c.fillText(be + ` · Exit ${ex.n}`, ph * 1.2, ph * 0.74);
    };
    this.atlas.quad(ox, 3.55, oz + 0.72, 5.4, 0.62, Math.PI, this.atlas.draw(5.4, 0.62, sign));
    sl(M, -2.7, 2.7, 3.25, 3.86, 0.6, 0.7, hex('#20272E'), NO);
  }
  /* ---------- 每帧 ---------- */
  lodNow(force) {
    const pl = this.pl, gn = this.kit.groupNodes; if (!gn) return;
    const p = pl ? this.toW(pl.position) : { x: this.K.x, z: this.K.z };
    const corrP = this.inCorr(p, -9), NL = this.nightLod ? NIGHT.lod : null; if (NL && this.night) this.night.cull(p);   // 3C：夜里雾更近，远处的组更早关（白天 NL = null → 原来的距离）   // 南后街走廊（连出口亭前小广场 = 南后街北口）：外面的 gN / d2e / 细节格子都关（两边老宅 + 远处楼块挡着）
    if (gn.det) { const on = !corrP; if (force || gn.det.isEnabled(false) !== on) gn.det.setEnabled(on); }
    if (FZR.d2 && gn.d2s) {   // 2D 南后街：离走廊外框（局部 |x| < 24、z -12..200）< 120 m 才画；人在街里（局部 z < 192）用 hi，否则 lo
      const N = FZR.d2.nhj, lx = N.X0 - p.x, lz = N.Z0 - p.z, near = Math.hypot(Math.max(0, Math.abs(lx) - 24), Math.max(0, -12 - lz, lz - 200)) < 120;
      const hi = near && this.inCorr(p, -9);   // 和 corrP 同一个范围（街里 + 北口小广场）：hi 开着的时候外面的组都关着
      if (force || gn.d2s.isEnabled(false) !== hi) gn.d2s.setEnabled(hi);
      if (gn.d2sLo && (force || gn.d2sLo.isEnabled(false) !== (near && !hi))) gn.d2sLo.setEnabled(near && !hi);
      const e = !corrP && Math.hypot(Math.max(0, 60 - p.x, p.x - 480), Math.max(0, -300 - p.z, p.z + 20)) < (NL ? NL.d2e : 430);
      if (gn.d2e && (force || gn.d2e.isEnabled(false) !== e)) gn.d2e.setEnabled(e);
      if (gn.d2k && KIOSKS.fzdjk) { const K = KIOSKS.fzdjk, on = Math.hypot(p.x - K.x, p.z - K.z) < 140; if (force || gn.d2k.isEnabled(false) !== on) gn.d2k.setEnabled(on); }
      if (gn.d2b) { const on = Math.hypot(p.x + 78, p.z + 175) < 100; if (force || gn.d2b.isEnabled(false) !== on) gn.d2b.setEnabled(on); }
    }
    if (this.c2Bands) {
      const z0 = FZR.c2.z0, set = (node, on) => { if (node && (force || node.isEnabled(false) !== on)) node.setEnabled(on); };
      for (let i = 0; i < this.c2Bands; i++) { const zt = z0 - i * C2B, zb = zt - C2B, d = p.z > zt ? p.z - zt : p.z < zb ? zb - p.z : 0; set(gn['c2:' + i], d < (NL ? NL.c2 : 330)); }
      set(gn.c2mj, p.z < FZR.c2.sluice.z + (NL ? NL.c2mj : 450)); ZS.forEach((z0_, i) => { const z1_ = i + 1 < ZS.length ? ZS[i + 1] : 1e9, d = (p.z < z0_ ? z0_ - p.z : p.z > z1_ ? p.z - z1_ : 0) + (NL ? 430 - NL.gN : 0); set(gn['gN' + i], d < 430 && !corrP); });
      for (const i of this.c2Detail) { const zt = z0 - i * C2D, zb = zt - C2D, d = p.z > zt ? p.z - zt : p.z < zb ? zb - p.z : 0; set(gn['c2d:' + i], d < (NL ? NL.c2d : 110)); }
    }
    if (gn.g3bday) { const on = !this.nightLod && FZR.b3.zone.some(q => p.x > q[0] && p.x < q[2] && p.z > q[1] && p.z < q[3]); if (force || gn.g3bday.isEnabled(false) !== on) gn.g3bday.setEnabled(on); }   // 3B 白天组：只白天 + 人在 3B 一带
    if (gn.g3day) { const on = !this.nightLod && p.x > FZR.a3.x0 - 60; if (force || gn.g3day.isEnabled(false) !== on) gn.g3day.setEnabled(on); }   // 3A 白天组：只白天 + 人在光明港码头往东一带
    if (gn.g4day) { const on = !this.nightLod && p.x < FZR.a4.x0 + 80 && p.z < -640; if (force || gn.g4day.isEnabled(false) !== on) gn.g4day.setEnabled(on); }   // 4A 白天组：只白天 + 人在河口以西一带
    if (gn.g6day) { const Z = FZR.a6.zone, on = !this.nightLod && p.x > Z[0] - 40 && p.x < Z[2] + 40 && p.z > Z[1] - 40 && p.z < Z[3] + 40; if (force || gn.g6day.isEnabled(false) !== on) gn.g6day.setEnabled(on); }   // 6A 白天组：只白天 + 人在湖前东段一带
    if (gn.g2day) { const on = !this.nightLod && p.z < FZR.c2.z0 + 80; if (force || gn.g2day.isEnabled(false) !== on) gn.g2day.setEnabled(on); }   // 2C 白天组：只白天 + 人在白马河下段 / 彬德一带
    if (this.tileCull) this.tileCull.update(this.scene.activeCamera, { px: this.wx(p.x), pz: this.wz(p.z), detR: (NL ? NL.near : NEAR) + CELL * 0.7, detOn: !corrP });
  }
  refreshTilesIfTurned() {
    const tc = this.tileCull, cam = this.scene && this.scene.activeCamera; if (!tc || !cam) return;
    const pl = this.pl, p = pl ? this.toW(pl.position) : { x: this.K.x, z: this.K.z };
    const px = this.wx(p.x), pz = this.wz(p.z);
    if (!tc.shouldRefresh(cam, px, pz)) return;
    const corrP = this.inCorr(p, -9), NL = this.nightLod ? NIGHT.lod : null;
    tc.update(cam, { px, pz, detR: (NL ? NL.near : NEAR) + CELL * 0.7, detOn: !corrP, force: true });
  }
  tick(dt) {
    // 船按真实时间走（上限 0.25 s/帧，每帧最多挪 0.9 m；人坐在船上跟着走，不会“跳”）；街区其余逻辑仍用 0.1 s 上限
    if (this.boats) { const dt_ = Math.min(0.25, this.scene.getEngine().getDeltaTime() / 1000); for (const b of Object.values(this.boats)) b.update(dt_, this.pl); }
    if (this.lock) this.lockPose();
    this.lodT -= dt; if (this.lodT <= 0) { this.lodT = 0.25; this.lodNow(false); }
    if (this.night && (this.nightT -= dt) <= 0) { this.nightT = 30; this.night.set(nightWanted(location.search)); }   // 3C：19:00 / 06:00 跨过去时（河网里待着）跟着切
  }
  update(pl) {
    this.pl = pl; const p = pl.position, w = this.toW(p);
    if (this.haze && p.y > -50) this.haze.reassert();   // 别处（onTunnel 等）关掉了就写回；隧道在 y≈-300，不抢隧道雾
    // 兜底：万一从台阶 / 墙缝掉到地面以下（低帧率一步跨太大），自由下落到水面以下 1 m 就放回最近的岸上（同「回到岸上」的落点）
    if (!pl.seat && !pl.grounded && pl.vy < -3 && p.y < levelAt(w.x, w.z) - 1 && p.y > -40) { const sh = shoreFor(w.x, w.z); if (sh) { pl.spawn(this.wx(sh.x), 0.05, this.wz(sh.z), sh.yaw); this.fellThrough = (this.fellThrough || 0) + 1; } }
    if (!pl.seat) for (const o of this.others) { const lx = w.x - o.x, lz = w.z - o.z; if (lz < -2.6 && lz > -6 && Math.abs(lx) < 1.9 && p.y < 1.5) { this.backTo = { code: o.code, n: o.n }; return 'back'; } }
    return super.update(pl);
  }
  /** 落水判定（js/game/water.js 用）：在河道 / 湖面里（不在台阶、浮码头、船上）→ 水面高度 + 上岸点 */
  /** 「回到岸上」能记作安全点的位置：岸地（不含台阶 / 桥面 / 浮码头 / 船） */
  onAnyBoat(x, z) { return !!this.boats && Object.values(this.boats).some(b => b.contains(x, z)); }
  safeAt(p) { const w = this.toW(p); return isLand(w.x, w.z) && !this.onAnyBoat(w.x, w.z); }
  waterAt(p) {
    const w = this.toW(p);
    if (!isWater(w.x, w.z) && !inChamber(w.x, w.z)) return null;
    if (this.onAnyBoat(w.x, w.z)) return null;
    if (this.decks && p.y > -0.6 && this.decks.some(([x0, x1, z0, z1]) => w.x >= x0 && w.x <= x1 && w.z >= z0 && w.z <= z1)) return null;   // 观湖亭栈桥 / 平台上
    const s = shoreFor(w.x, w.z); if (!s) return null;
    return { key: this.key, surfaceY: levelAt(w.x, w.z), shore: { x: this.wx(s.x), y: 0.05, z: this.wz(s.z), yaw: s.yaw } };
  }
  /** 左上角站名牌：岸上「福州内河」；在船上（坐着或站在船上）「<线>线 · 下一站」；line / color = 本片河网的船线（A 红 / B 蓝灰，同码头牌线路章） */
  riverHud(pl) {
    let line = ROUTE.id || 'A', color = line === 'B' ? '#2E5E8C' : '#B3261E'; const b = this.boat;
    // 2C：岸上永远是本片河网主线色（a 网 A 红）—— 以前按“和玩家相关的船”取色，宁化 A 出来那条是 C 船，岸上就变绿了（小美 2C ④）
    const home = this.homeLine || (this.homeLine = Object.keys(ROUTES)[0] || line), on = !!(b && pl && (b.passengerSeated(pl) || b.onBoard(pl)));
    ({ line, color } = hudLine(home, on ? b.rid : null));
    if (!on) return { boat: false, line, color };
    // 停靠时显示当前码头（和「××码头到了」的播报一致），开船后再切到下一站（小美 11-14）
    const docked = b.phase === 'dock', j = docked ? b.i : b.target, P = ROUTES[b.rid].stops[j].pier;
    return { boat: true, docked, line, color, next: { id: P.id, zh: P.zh, en: P.en } };
  }
  info() { return { ...super.info(), fellThrough: this.fellThrough || 0, net: this.net, route: ROUTE.id, river: true, night: !!(this.night && this.night.on), kiosk: this.K.code, boat: this.boat ? this.boat.info() : null, boats: this.boats ? Object.fromEntries(Object.entries(this.boats).map(([r, b]) => [r, b.info()])) : null, cellsOn: this.kit.groupNodes && this.kit.groupNodes.det && this.kit.groupNodes.det.isEnabled(false) ? (this.cellKeys ? this.cellKeys.length : 0) : 0, cells: this.cellKeys ? this.cellKeys.length : 0 }; }
  dispose() { if (this.haze) { this.haze.restore(); this.haze = null; } if (this._tileObs) { this.scene.onBeforeRenderObservable.remove(this._tileObs); this._tileObs = null; } if (this.night) { this.night.dispose(); this.night = null; } if (this.boats) for (const b of Object.values(this.boats)) b.dispose(); this.boats = null; super.dispose(); }
}
const FZ_STATIONS_ZH = c => ({ fzdjk: '东街口', fzxm: '西门', fzxiy: '西洋', fzsb: '水部', fzdm: '斗门', fzdmn: '东门', fzgmg: '光明港', fznh: '宁化' })[c] || '';
export { FzRiverStreet as default };
void mix; void lerp; void isDry; void ROUTE;
