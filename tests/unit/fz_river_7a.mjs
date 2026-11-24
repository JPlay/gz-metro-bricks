// 福州内河 7A（洋下河：晋安河接缝 → 无名下游 → 命名西头 → 涧田路涵洞以东合拢；PLAN-洋下河 v2 小美 11-23 02:19 定稿；只走路）
import * as R from '../../js/data/fz-river.js';
import fs from 'node:fs';
const fails = [];
function ok(n, v, info) { console.log(`${v ? 'PASS' : 'FAIL'} ${n}${!v && info !== undefined ? ' ' + JSON.stringify(info) : ''}`); if (!v) fails.push(n); }
R.useNet('e');
const F = R.FZR, A7 = F.a7a, A6 = F.a6, A6B = F.a6b, RV = R.RIVERS;
const fsrc = fs.readFileSync(new URL('../../js/world/fzRiver.js', import.meta.url), 'utf8');
const nsrc = fs.readFileSync(new URL('../../js/world/fzNight.js', import.meta.url), 'utf8');
const src = fsrc + nsrc;

ok('7A data present (a7a: yxLen / 7 culverts / express / cap / 4 cams / 1 sign)',
  !!(A7 && A7.yxLen > 520 && A7.yxLen < 560 && (A7.culverts || []).length === 7 && A7.express && A7.express.main && (F.a7b ? (A7.openedTo7b && !A7.capWall) : A7.capWall) && A7.cams && A7.cams.seam && A7.cams.express && A7.cams.culvert && A7.cams.tip && (A7.signs || []).length === 1));

// 已建晋安河中线 / 既有桥不得改（与 main d26fb85 逐点对照）
{ const ja = F.rivers.ja.p, jn = F.rivers.jn.p;
  const br = F.bridges.filter(b => b.river === 'ja' || b.river === 'jn');
  const same = (a, b) => a.length === b.length && a.every((v, i) => v === b[i]);
  ok('ja centerline unchanged vs main d26fb85 (45 pts, head/tail anchors)',
    ja.length === 90 && ja[0] === 356.02 && ja[1] === 415.95 && ja[2] === 379.0 && ja[3] === 359.41
    && ja[ja.length - 4] === 595.06 && ja[ja.length - 3] === -597.86 && ja[ja.length - 2] === 605.52 && ja[ja.length - 1] === -697.67);
  ok('jn centerline unchanged vs main d26fb85 (28 pts, head/tail anchors; shares ja start 356.02, 415.95)',
    jn.length === 56 && jn[0] === 192.77 && jn[1] === 1038.68 && jn[jn.length - 2] === 356.02 && jn[jn.length - 1] === 415.95);
  ok('ja/jn 13 bridges stay put (count + 温泉公园路 / 华林路 anchors)', br.length === 13
    && br.some(b => b.id === 'ja1' && b.name === '温泉公园路' && b.x === 370.04 && b.z === 381.44 && b.w === 16)
    && br.some(b => b.id === 'jn3' && b.name === '华林路' && b.x === 326.06 && b.z === 489.66 && b.w === 26));
}

// 范围：真实约 2154.84 m，游戏约 537–539 m；hw=5；命名西头 + 涧田路涵洞
{ const O = A7.official || {};
  ok('official 7A length is 2154.84 m (unnamed + named west + 涧田路 culvert + 8 m pad)', Math.abs((O.real || O.end || 0) - 2154.84) < 0.02, O);
  ok('game yx length is on the 1:4 budget (~537–539 m)', A7.yxLen >= 530 && A7.yxLen <= 545 && Math.abs((O.game || 0) - A7.yxLen) < 0.05 && RV.yx.line.len >= 530, { yxLen: A7.yxLen, game: O.game, line: RV.yx.line.len });
  ok('hw = 5 (water 10 m) on yx, including unnamed downstream', F.rivers.yx.hw === 5 && A7.hw === 5);
  ok('named west tip and 涧田路 culvert s are recorded', O.namedWestTip === 1788.16 && Array.isArray(O.culvert) && Math.abs(O.culvert[0] - 2055.79) < 0.02 && Math.abs(O.culvert[1] - 2146.84) < 0.02, O);
}

// 弯半径 ≥ 25 m
{ const L = RV.yx.line, c = F.rivers.yx.p, pts = [];
  for (let i = 0; i < c.length; i += 2) pts.push([c[i], c[i + 1]]);
  let r1 = 1e9;
  for (let i = 1; i < pts.length - 1; i++) {
    const [a, b, d] = [pts[i - 1], pts[i], pts[i + 1]];
    const A = Math.hypot(b[0] - a[0], b[1] - a[1]), Bq = Math.hypot(d[0] - b[0], d[1] - b[1]), C = Math.hypot(d[0] - a[0], d[1] - a[1]);
    const s = (A + Bq + C) / 2, ar = Math.sqrt(Math.max(0, s * (s - A) * (s - Bq) * (s - C)));
    if (ar > 1e-6) r1 = Math.min(r1, A * Bq * C / (4 * ar));
  }
  let r2 = 1e9, at = 0;
  for (let s = 0; s <= L.len - 6; s += 1) {
    const a = L.at(s), b = L.at(Math.min(L.len, s + 6));
    let d = Math.atan2(b.tx, b.tz) - Math.atan2(a.tx, a.tz);
    d -= 2 * Math.PI * Math.round(d / (2 * Math.PI));
    const r = 6 / Math.max(1e-9, Math.abs(d));
    if (r < r2) { r2 = r; at = s; }
  }
  ok(`yx min bend radius ≥ 25 m (vertices ${r1 === 1e9 ? 'n/a' : r1.toFixed(1)}, 6 m window ${r2.toFixed(1)})`, (r1 === 1e9 || r1 >= 25) && r2 >= 25, { r1, r2, at });
}

// 汇入口贴在 jn，整段平移；起点在已建中线上
{ const host = A7.host || {}, st = RV.yx.line.at(0);
  ok('joins jn at the seam by whole-segment translation (start on jn, host.d small)', host.river === 'jn' && host.d < 1.0 && Math.hypot(st.x - 354.17, st.z - 420.5) < 1.0, { host, start: [st.x, st.z] });
}

// 只在命名西头一块「洋下河」牌；无名河/无名桥不挂牌
{ const S = A7.signs[0];
  ok('exactly one 洋下河 sign, at the named west tip', S && S.lines[0] === '洋下河' && S.lines[1] === 'Yangxia River' && (A7.signs || []).length === 1);
  const tip = RV.yx.line.at(A7.official.namedWestTip / 4);
  // 牌在岸上，离命名西头中线不应太远（官方 s / 4 ≈ 游戏 s，平移后 tip s_game 可能略有差别）
  const d = Math.hypot(S.x - tip.x, S.z - tip.z);
  ok('sign stands near the named west tip (bank, not mid-channel)', d < 25 && !R.isWater(S.x, S.z), { d, sign: [S.x, S.z], tip: [tip.x, tip.z] });
  ok('no stone-sign plates on 7A culverts / unnamed bridges', (A7.culverts || []).every(c => !c.plate && !c.named) && !(A7.plates || []).length);
  ok('runtime draws only A7.signs (no extra 7A road name plates in a7aStatic)', /a7aStatic[\s\S]*?a7aCulverts/.test(fsrc) && !/roadSignW/.test((fsrc.split('a7aStatic()')[2] || '').slice(0, 800)));
}

// 7 座涵洞（OSM 6 座下游 + 涧田路），路堤 + 洞口，人走不进管子
{ const cs = A7.culverts, last = cs[cs.length - 1];
  ok('7 culverts (6 OSM downstream + 涧田路), all have deck, cover, ramps', cs.length === 7 && cs.every(c => c.deckY >= 1 && c.cover >= 8 && c.rampL >= 5 && c.walk >= 2));
  ok('last culvert is 涧田路 (way 687591877)', last && last.way === 687591877 && last.roadName === '涧田路', last);
  ok('runtime builds visible mouths, sidewalk ramps, and colCulvertTube (not colDeck)', /colCulvertTube/.test(fsrc) && /a7aCulverts/.test(fsrc) && /DARK/.test(fsrc));
  ok('culvert carriageway is colCulvertLane; sidewalks and a zebra-width bank strip are colDeck',
    /colCulvertLane/.test(fsrc) && /const ZW/.test(fsrc) && /F4F1EA/.test(fsrc) && /a7aCulverts[\s\S]*colDeck/.test(fsrc));
  ok('roads() skips 7A culvert asphalt and road-name signs', /r\.culvert \|\| r\.a7a/.test(fsrc));
}

// 机场高速：主桥与匝道两层，只走桥下，灯并进 fzNightLights，无 PointLight
{ const E = A7.express.main, ramps = A7.express.ramps || [];
  ok('airport expressway main deck is a high layer (deckY ≥ 6, own mesh)', E && E.deckY >= 6 && E.layer === 'main' && E.name === '福州机场高速' && E.w >= 14);
  ok('ramps are a separate lower layer (2–4 ramps, deckY < main, not merged into one slab)', ramps.length >= 2 && ramps.length <= 4 && ramps.every(r => r.layer === 'ramp' && r.deckY < E.deckY && r.deckY >= 4), { n: ramps.length, ys: ramps.map(r => r.deckY) });
  ok('runtime paints main and ramps in two groups (paint@a7aEx / paint@a7aExRamp) and blocks the deck with colExpress, not colDeck',
    /paint@a7aEx/.test(fsrc) && /paint@a7aExRamp/.test(fsrc) && /colExpress/.test(fsrc) && /a7aExpress/.test(fsrc));
  ok('soffit lights merge into fzNightLights; no PointLight / shadow in 7A runtime or night',
    /a7a\.express\.under/.test(nsrc) && /fzNightLights/.test(nsrc) && !/PointLight/.test(src.match(/a7a[\s\S]*?(?=unders\(|\/\/ 台阶)/)?.[0] || 'PointLight_MISSING') && !/new B\.PointLight/.test(fsrc) && !/new B\.PointLight/.test(nsrc));
  ok('walk-under soffit light records exist', (A7.express.under || []).length >= 4, { n: (A7.express.under || []).length });
}

// 东头合拢像 6B：墙 + 远景
ok('east end is sealed like 6B (capWall + far backdrop + colCap)', F.a7b
  ? (!A7.capWall && (A7.cap === 0 || A7.cap === undefined) && A7.openedTo7b && F.a7b.capWall && (F.a7b.far || []).length >= 3 && /colCap/.test(fsrc))
  : (!!(A7.capWall && (A7.far || []).length >= 3) && /colCap/.test(fsrc) && A7.cap === 2.4));

// 不新建出口、不开船、不延长 B/D
ok('no new kiosk / station; boats still only B and D; 6A/6B data still present',
  Object.keys(F.kiosks).sort().join() === 'fzdm,fzdmn,fzgmg' && A6 && A6B && A6.hqLen > 200 && A6B.westLen > 350
  && (F.routes || []).every(r => r.id === 'D' || r.id === 'B') && F.route.id === 'B');

// 交图机位
{ const C = A7.cams;
  ok('four handoff cameras: seam / express / culvert / tip', ['seam', 'express', 'culvert', 'tip'].every(n => C[n] && C[n].look && C[n].look.length >= 3));
  ok('tip camera note mentions 洋下河 sign', /洋下河/.test(C.tip.note || ''));
  ok('express camera note mentions 机场高速', /机场高速/.test(C.express.note || ''));
}

// g7day：只白天、人在 a7a.zone 才开，夜里关掉以抵消 fzNightLights 那一个 draw
{ const ld = fsrc.slice(fsrc.indexOf('  lodNow(force) {'), fsrc.indexOf('  refreshTilesIfTurned() {'));
  ok('g7day is day-only (off when nightLod)', /gn\.g7day/.test(ld) && /!this\.nightLod/.test(ld) && /a7aDay\(/.test(fsrc) && /k\.group\('g7day'\)/.test(fsrc));
}

// 7A 重做岸墙不得把 6B 江厝路桥洞（flag=1，无碰撞）改成实墙 flag=0
{ const w = (F.wall || []).find(q => q[0] === -50.57 && q[1] === 746.3 && q[2] === -48.08 && q[3] === 760.26);
  ok('江厝路 west gap wall keeps flag 1 (no collider, same as prod d26fb85)', !!(w && w[4] === 1), w);
}

if (fails.length) { console.log('FAILED', fails.length, fails.join(', ')); process.exit(1); }
console.log('All', '7A', 'checks passed');
