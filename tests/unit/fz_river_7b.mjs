// 福州内河 7B（洋下河西段主河：7A 涧田路涵洞以东合拢 → 涧田湖，环湖可走；PLAN-洋下河 v2 §2）
import * as R from '../../js/data/fz-river.js';
import fs from 'node:fs';
const fails = [];
function ok(n, v, info) { console.log(`${v ? 'PASS' : 'FAIL'} ${n}${!v && info !== undefined ? ' ' + JSON.stringify(info) : ''}`); if (!v) fails.push(n); }
R.useNet('e');
const F = R.FZR, A7 = F.a7a, A7B = F.a7b, A6 = F.a6, A6B = F.a6b, RV = R.RIVERS;
const fsrc = fs.readFileSync(new URL('../../js/world/fzRiver.js', import.meta.url), 'utf8');
const nsrc = fs.readFileSync(new URL('../../js/world/fzNight.js', import.meta.url), 'utf8');
const asrc = fs.readFileSync(new URL('../../tools/fzriver/a7b.py', import.meta.url), 'utf8');

ok('7B data present (a7b: yxLen / lake / 6 decks / cap / loop / plates / cams)',
  !!(A7B && A7B.yxLen > 880 && A7B.yxLen < 980 && A7B.yxLen7a > 520 && A7B.yxLen7a < 560
    && A7B.lake && A7B.lake.ring && A7B.lake.ring.length >= 16
    && (A7B.bridges || []).length === 6 && A7B.capWall && (A7B.far || []).length >= 6
    && (A7B.loop || []).length >= 8 && A7B.capBank && A7B.capPast
    && (A7B.plates || []).length === 2 && A7B.cams && A7B.cams.mouth && A7B.cams.cap));

ok('7A prefix length frozen; 7A seal removed cleanly (openedTo7b, capWall/far cleared)',
  A7 && A7.openedTo7b && !A7.capWall && (A7.far || []).length === 0 && (A7.cap === 0 || A7.cap == null)
  && Math.abs(A7.yxLen - A7B.yxLen7a) < 0.05 && A7.yxLen >= 530 && A7.yxLen <= 545);

ok('ja/jn sha unchanged', A7B.jaJnSha1 === '6eb7a2870782e8dbc9bd3d1ed20a63b42c4a7061' && A7.jaJnSha1 === A7B.jaJnSha1);

{ const st = RV.yx.line.at(0), mid = RV.yx.line.at(A7B.yxLen7a), end7a = [655.86, 825.64];
  ok('yx starts at the 7A/jn seam and 7A end stays put',
    Math.hypot(st.x - 354.17, st.z - 420.5) < 1.0 && Math.hypot(mid.x - end7a[0], mid.z - end7a[1]) < 1.2,
    { start: [st.x, st.z], mid: [mid.x, mid.z], line: RV.yx.line.len, yxLen: A7B.yxLen });
  ok('yx line length matches 7B yxLen (7A + west main to the lake)',
    Math.abs(RV.yx.line.len - A7B.yxLen) < 0.2 && RV.yx.line.len > A7B.yxLen7a + 300);
}

ok('hw = 5 on the west main river; lake surface is a wide polygon (not a hw=5 ribbon)',
  F.rivers.yx.hw === 5 && A7B.hw === 5 && A7B.lakeBand === 9
  && A7B.official.lakeArea > 30000 && A7B.lake.ring.length / 2 >= 20);

{ const styles = A7B.byStyle || {};
  const br = (F.bridges || []).filter(b => (A7B.bridges || []).includes(b.id) || b.a7b);
  ok('three dual-deck crossings: 玄南岭路 / 西园路 / unnamed, distinct railStyle',
    (styles.xuan || []).length === 2 && (styles.xiyuan || []).length === 2 && (styles.anon || []).length === 2
    && br.length === 6 && new Set(br.map(b => b.railStyle || b.style)).size >= 3,
    { styles, n: br.length, rail: br.map(b => [b.id, b.name, b.railStyle || b.style, b.s]) });
  ok('named plates only on 玄南岭路 and 西园路; s≈1475 unnamed short bridge has no plate',
    A7B.plates.length === 2
    && A7B.plates.some(p => p.lines[0] === '玄南岭路')
    && A7B.plates.some(p => p.lines[0] === '西园路')
    && br.filter(b => (b.style === 'anon' || b.railStyle === 'anon')).every(b => !b.plate),
    A7B.plates);
  const xuan = br.filter(b => b.style === 'xuan'), xi = br.filter(b => b.style === 'xiyuan');
  ok('dual decks are separate (not one slab): midpoints more than 2 m apart within each named road',
    Math.hypot(xuan[0].x - xuan[1].x, xuan[0].z - xuan[1].z) > 2
    && Math.hypot(xi[0].x - xi[1].x, xi[0].z - xi[1].z) > 2);
}

{ const W = A7B.capWall, P = A7B.capPast, B = A7B.capBank, o = A7B.outlet;
  const end = RV.yx.line.at(RV.yx.line.len);
  const dEnd = Math.hypot(W.x - end.x, W.z - end.z);
  const alongPast = (P[0] - W.x) * W.t[0] + (P[1] - W.z) * W.t[1];
  const alongBank = (B[0] - W.x) * W.t[0] + (B[1] - W.z) * W.t[1];
  ok('east cap is at the NE 7C outlet, not at yx.end; past is on the 7C side, bank on the lake side',
    dEnd > 20 && Math.hypot(W.x - o[0], W.z - o[1]) < 12 && alongPast > 8 && alongBank < 0,
    { dEnd, cap: [W.x, W.z], outlet: o, alongPast, alongBank });
  ok('runtime draws 7B cap + far + plates in a7bStatic; 7A colCap skipped when capWall is opened',
    /a7bStatic\(/.test(fsrc) && /if \(L && A\.capWall\)/.test(fsrc) && /if \(FZR\.a7b\) this\.a7bStatic\(\)/.test(fsrc));
}

ok('no 涧田湖水闸 in this batch', /未做涧田湖水闸/.test(A7B.note || '') && !A7B.gate && !A7B.shuizha && !(A7B.official && A7B.official.gate));

ok('night lights merge into fzNightLights; no PointLight / shadows in 7B runtime',
  /a7bLamps|FZR\.a7b/.test(fsrc) && /fzNightLights/.test(nsrc)
  && !/new B\.PointLight/.test(fsrc) && !/new B\.PointLight/.test(nsrc)
  && !/castShadow|receiveShadow/.test(asrc) && /a7bLamps\(/.test(fsrc));

{ const hs = (F.houses || []).filter(h => h.a7b && !h.gone);
  ok('new banks use old-street houses (kind=old) on both the river and the lake ring',
    hs.length >= 40 && hs.every(h => h.kind === 'old'), { n: hs.length });
}

{ const C = A7B.cams;
  ok('handoff cameras cover mouth / plazas / bridges / cap, first-person eye height',
    ['mouth', 'plaza_west', 'plaza_north', 'plaza_east', 'south', 'xuan', 'xiyuan', 'anon', 'cap'].every(n => C[n] && C[n].look && C[n].look.length >= 3)
    && Object.values(C).every(c => c.y >= 0.4 && c.y <= 2.2));
  const inside = Object.entries(C).filter(([n, c]) => (F.houses || []).some(h => {
    if (h.gone) return false;
    const tx = h.t ? h.t[0] : Math.sin(h.ry || 0), tz = h.t ? h.t[1] : Math.cos(h.ry || 0);
    const nx = tz, nz = -tx;
    const dx = c.x - h.x, dz = c.z - h.z;
    return Math.abs(dx * tx + dz * tz) <= h.w / 2 + 0.4 && Math.abs(dx * nx + dz * nz) <= h.d / 2 + 0.4;
  }));
  ok('no handoff camera sits inside a house', inside.length === 0, inside);
}

ok('7A zone expanded so g7day covers the 7B river and lake (night sheen off → night ≤ day)',
  A7.zone && A7.zone[2] >= A7B.zone[2] - 0.1 && A7.zone[3] >= A7B.zone[3] - 0.1
  && /a7aDay\(/.test(fsrc) && /g7day/.test(fsrc));

ok('no new kiosk / station; boats still only B and D; 6A/6B/7A data still present',
  Object.keys(F.kiosks).sort().join() === 'fzdm,fzdmn,fzgmg' && A6 && A6B && A7
  && A6.hqLen > 200 && A6B.westLen > 350
  && (F.routes || []).every(r => r.id === 'D' || r.id === 'B') && F.route.id === 'B');

ok('7A culverts still 7, 涧田路 last, express still present (7A otherwise unchanged)',
  (A7.culverts || []).length === 7 && A7.culverts[A7.culverts.length - 1].roadName === '涧田路' && A7.express && A7.express.main);

if (fails.length) { console.log('FAILED', fails.length, fails.join(', ')); process.exit(1); }
console.log('All 7B checks passed');
