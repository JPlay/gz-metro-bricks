// 福州内河 7C（洋下河东段：涧田湖东口 → 命名东头合拢；PLAN-洋下河 v2 §6）
import * as R from '../../js/data/fz-river.js';
import fs from 'node:fs';
const fails = [];
function ok(n, v, info) { console.log(`${v ? 'PASS' : 'FAIL'} ${n}${!v && info !== undefined ? ' ' + JSON.stringify(info) : ''}`); if (!v) fails.push(n); }
R.useNet('e');
const F = R.FZR, A7 = F.a7a, A7B = F.a7b, A7C = F.a7c, A6B = F.a6b, RV = R.RIVERS;
const fsrc = fs.readFileSync(new URL('../../js/world/fzRiver.js', import.meta.url), 'utf8');
const nsrc = fs.readFileSync(new URL('../../js/world/fzNight.js', import.meta.url), 'utf8');
const asrc = fs.readFileSync(new URL('../../tools/fzriver/a7c.py', import.meta.url), 'utf8');

ok('7C data present (a7c: yxLen / sEast0 / 5 decks / cap / plates / cams / lamps)',
  !!(A7C && A7C.yxLen > 1200 && A7C.yxLen < 1600 && A7C.yxLen7b > 880 && A7C.yxLen7b < 980
    && A7C.sEast0 > A7C.yxLen7b + 40 && (A7C.bridges || []).length === 5
    && A7C.capWall && (A7C.far || []).length >= 6
    && A7C.capBank && A7C.capPast && A7C.tip && A7C.mouthOpen && A7C.lakeMouthBank
    && (A7C.plates || []).length === 1 && A7C.cams && A7C.cams.mouth && A7C.cams.cap && A7C.cams.jianshan
    && (A7C.lamps || []).length >= 16));

ok('7B prefix length frozen; 7B lake-outlet seal removed cleanly (openedTo7c, capWall cleared)',
  A7B && A7B.openedTo7c && !A7B.capWall
  && Math.abs(A7B.yxLen - A7C.yxLen7b) < 0.05 && A7B.yxLen >= 880 && A7B.yxLen <= 980
  && A7 && A7.openedTo7b);

ok('ja/jn sha unchanged', A7C.jaJnSha1 === '6eb7a2870782e8dbc9bd3d1ed20a63b42c4a7061'
  && A7.jaJnSha1 === A7C.jaJnSha1 && A7B.jaJnSha1 === A7C.jaJnSha1);

{ const st = RV.yx.line.at(0), mid7b = RV.yx.line.at(A7C.yxLen7b), end7a = [655.86, 825.64];
  ok('yx starts at the 7A/jn seam and 7B west-mouth stays put',
    Math.hypot(st.x - 354.17, st.z - 420.5) < 1.0 && Math.hypot(mid7b.x - 837.38, mid7b.z - 1081.55) < 1.2,
    { start: [st.x, st.z], mid7b: [mid7b.x, mid7b.z], line: RV.yx.line.len, yxLen: A7C.yxLen });
  ok('yx line length matches 7C yxLen (7B + lake crossing + east reach)',
    Math.abs(RV.yx.line.len - A7C.yxLen) < 0.3 && RV.yx.line.len > A7C.yxLen7b + 250);
}


// 新中线（含东口弯）minR ≥ 25 m 游戏单位：6 m 窗口硬检查；顶点半径一并记录。
{ const L = RV.yx.line, c = F.rivers.yx.p, pts = [], lock0 = A7C.yxLen7b, lock1 = L.len;
  for (let i = 0; i < c.length; i += 2) pts.push([c[i], c[i + 1]]);
  let r1 = 1e9, acc = 0;
  for (let i = 1; i < pts.length - 1; i++) {
    const [a, b, d] = [pts[i - 1], pts[i], pts[i + 1]];
    const A = Math.hypot(b[0] - a[0], b[1] - a[1]), Bq = Math.hypot(d[0] - b[0], d[1] - b[1]), C = Math.hypot(d[0] - a[0], d[1] - a[1]);
    const s = (A + Bq + C) / 2, ar = Math.sqrt(Math.max(0, s * (s - A) * (s - Bq) * (s - C)));
    if (ar > 1e-6 && acc + A >= lock0 && acc + A <= lock1) r1 = Math.min(r1, A * Bq * C / (4 * ar));
    acc += A;
  }
  const windowMin = (s0, s1) => {
    let r2 = 1e9, at = s0;
    for (let s = s0; s <= s1 - 6; s += 0.5) {
      const a = L.at(s), b = L.at(Math.min(s1, s + 6));
      let d = Math.atan2(b.tx, b.tz) - Math.atan2(a.tx, a.tz);
      d -= 2 * Math.PI * Math.round(d / (2 * Math.PI));
      const r = 6 / Math.max(1e-9, Math.abs(d));
      if (r < r2) { r2 = r; at = s; }
    }
    return { r2, at };
  };
  const all = windowMin(lock0, lock1);
  const mouth = windowMin(Math.max(lock0, A7C.sEast0 - 40), Math.min(lock1, A7C.sEast0 + 40));
  // 硬检查用 6 m 窗口（与 7A 相同度量、也是东口弯的设计口径）。2 m 折线的顶点外接圆在密采样圆弧上会略偏紧，只作记录。
  ok(`7C new centerline / east-mouth minR ≥ 25 m (6 m window ${all.r2.toFixed(2)} at s=${all.at.toFixed(1)}; east-mouth ${mouth.r2.toFixed(2)}; vertices ${r1 === 1e9 ? 'n/a' : r1.toFixed(2)})`,
    all.r2 >= 25 && mouth.r2 >= 25,
    { r1, r2: all.r2, at: all.at, mouthR: mouth.r2, mouthAt: mouth.at, recorded: A7C.minR, minRMouth: A7C.minRMouth, sEast0: A7C.sEast0, yxLen7b: lock0 });
  ok('A7C records the measured minR (≥ 25, within 1 m of the 6 m window)',
    typeof A7C.minR === 'number' && A7C.minR >= 25 && Math.abs(A7C.minR - all.r2) < 1.0, { recorded: A7C.minR, r2: all.r2 });
}

ok('hw = 5 on the east reach; official east length is about 1204 m (game ~300)',
  F.rivers.yx.hw === 5 && A7C.hw === 5
  && A7C.official.real > 1190 && A7C.official.real < 1220
  && A7C.official.game > 270 && A7C.official.game < 320);

{ const styles = A7C.byStyle || {};
  const br = (F.bridges || []).filter(b => (A7C.bridges || []).includes(b.id) || b.a7c);
  ok('涧山巷 is the only named east bridge, dual-deck, shortest and lowest',
    (styles.jianshan || []).length === 2
    && br.filter(b => b.style === 'jianshan').every(b => (b.deckY || 1) <= 1.0)
    && br.filter(b => b.style === 'jianshan').every(b => b.w <= 13)
    && A7C.plates.length === 1 && A7C.plates[0].lines[0] === '涧山巷',
    { styles, n: br.length, jian: br.filter(b => b.style === 'jianshan').map(b => [b.id, b.w, b.deckY, b.s]) });
  ok('three unnamed decks have distinct spans/styles and no plates (38 / 9 / 17 m)',
    (styles.anon38 || []).length === 1 && (styles.anon9 || []).length === 1 && (styles.anon17 || []).length === 1
    && br.filter(b => (b.style || '').startsWith('anon')).every(b => !b.plate)
    && new Set(br.map(b => b.railStyle || b.style)).size >= 4,
    { styles, rail: br.map(b => [b.id, b.name, b.railStyle || b.style, b.s, b.w]) });
  const jian = br.filter(b => b.style === 'jianshan');
  ok('涧山巷 dual decks are separate (not one slab)',
    jian.length === 2 && Math.hypot(jian[0].x - jian[1].x, jian[0].z - jian[1].z) > 1.0);
}

{ const W = A7C.capWall, P = A7C.capPast, B = A7C.capBank, tip = A7C.tip;
  const end = RV.yx.line.at(RV.yx.line.len);
  const dTip = Math.hypot(W.x - tip[0], W.z - tip[1]);
  const dEnd = Math.hypot(W.x - end.x, W.z - end.z);
  const alongPast = (P[0] - W.x) * W.t[0] + (P[1] - W.z) * W.t[1];
  const alongBank = (B[0] - W.x) * W.t[0] + (B[1] - W.z) * W.t[1];
  ok('east cap is at the named east tip (yx.end), past is outside, bank is inside',
    dTip < 12 && dEnd < 12 && alongPast > 8 && alongBank < 0,
    { dTip, dEnd, cap: [W.x, W.z], tip, alongPast, alongBank });
  ok('runtime draws 7C cap + far + 涧山巷 plate in a7cStatic; trunk_link is a backdrop ramp, not a walkable deck',
    /a7cStatic\(/.test(fsrc) && /if \(FZR\.a7c\) this\.a7cStatic\(\)/.test(fsrc)
    && A7C.ramp && A7C.ramp.osm === 946061376 && !(A7C.bridges || []).includes('946061376'));
}

ok('no new stations or boats in this batch',
  /不开站不开船/.test(A7C.note || '') && !A7C.station && !A7C.boat && !A7C.route);

ok('night lights merge into fzNightLights; no PointLight / shadows in 7C runtime',
  /a7cLamps|FZR\.a7c/.test(fsrc) && /FZR\.a7c && FZR\.a7c\.lamps/.test(nsrc)
  && !/new B\.PointLight/.test(fsrc) && !/new B\.PointLight/.test(nsrc)
  && !/castShadow|receiveShadow/.test(asrc) && /a7cLamps\(/.test(fsrc)
  && /0\.40/.test(nsrc) && /segL = 1\.15/.test(nsrc));

{ const hs = (F.houses || []).filter(h => h.a7c && !h.gone);
  ok('new banks use old-street houses (kind=old) on both sides of the east reach',
    hs.length >= 12 && hs.every(h => h.kind === 'old'), { n: hs.length });
}

{ const C = A7C.cams;
  ok('handoff cameras cover mouth / 涧山巷 / unnamed decks / cap, first-person eye height',
    C.mouth && C.jianshan && C.anon38 && C.anon9 && C.anon17 && C.cap && C.south && C.joint
    && C.mouth.y >= 1.4 && C.mouth.y <= 1.7 && C.cap.y >= 1.4 && C.cap.y <= 1.7);
}

ok('warm-grey paving (no pure-white solid pads) in 7C static',
  /#CFC9BD/.test(fsrc) && /#A39C8E/.test(fsrc) && /a7cStatic/.test(fsrc));

if (fails.length) { console.log('FAILED', fails.length, fails.join(', ')); process.exit(1); }
console.log('All 7C checks passed');
