// 福州内河 2D（安泰河东段 + 东街口 C 南后街接三坊七巷南口牌坊 + 津门桥 + 朱紫坊 + 琼东河口；达道三捷河改名 + 码头，PLAN-2D 定稿 v2）：小美七条 + 硬规则的数据 / 逻辑检查
import * as R from '../../js/data/fz-river.js';
import fs from 'node:fs';
import { FZ_EXITS } from '../../js/data/fz-exits.js';
const fails = [];
function ok(n, v, info) { console.log(`${v ? 'PASS' : 'FAIL'} ${n}${!v && info !== undefined ? ' ' + JSON.stringify(info) : ''}`); if (!v) fails.push(n); }
R.useNet('a');
const F = R.FZR, D2 = F.d2, src = fs.readFileSync(new URL('../../js/world/fzRiver.js', import.meta.url), 'utf8'), attr = fs.readFileSync(new URL('../../js/world/fzAttr.js', import.meta.url), 'utf8');
const L = R.RIVERS.at.line, B = id => R.BRIDGES.find(b => b.id === id);
ok('d2 block present; 安泰河 extended east (1A part kept: atALen 544.27 → full > 780)', D2 && Math.abs(D2.atALen - 544.27) < 0.05 && L.len > 780, [D2 && D2.atALen, L.len]);
// ① 东段桥：只做津门桥（OSM 津门路 s2167，路桥 + 古名牌）；四座找不到位置的不做
const jm = B('at10');
ok('津门桥: at10 road bridge on 津门路, plate 津门桥, d2 flag, east of 安泰桥', jm && jm.kind === 'road' && jm.name === '津门路' && jm.plate === '津门桥' && jm.d2 && jm.s > B('at9').s + 100, jm);
ok('only one new bridge on 安泰河 east; 福枝桥 / 新桥 / 武安桥 / 古仙桥 not invented', R.BRIDGES.filter(b => b.river === 'at' && b.s > D2.atALen).length === 1 && !R.BRIDGES.some(b => /福枝|^新桥|武安|古仙/.test((b.name || '') + (b.plate || ''))));
{ const ex = F.roads.filter(r => r.id === 'at10e' || r.id === 'at10w'); ok('津门路 road stubs both banks (walkable over the bridge)', ex.length === 2 && ex.every(r => r.d2 && r.name === '津门路')); }
// ② 东街口 C → 南后街 → 三坊七巷南口牌坊（榕树 + 石栏，不画地面引导；路口只放真实路名牌）
const K = R.KIOSKS.fzdjk, N = D2.nhj, G = F.sfqx;
ok('东街口 C kiosk in net a (river world), exit C attr fzriver', K && K.n === 'C' && R.netOfKiosk('fzdjk') === 'a' && FZ_EXITS.fzdjk.attr === 'fzriver' && FZ_EXITS.fzdjk.n === 'C', K);
ok('kiosk sits at local (12, -1) of the embedded 南后街 block (rotated 180°)', Math.abs(K.x - (N.X0 - 12)) < 0.02 && Math.abs(K.z - (N.Z0 + 1)) < 0.02);
const walkPts = []; { const lk = t => [G.x + G.dir[0] * t, G.z + G.dir[1] * t];
  walkPts.push([K.x, K.z + 2], [N.X0 - 12, N.Z0 - 6], [N.X0, N.Z0 - 14]); for (let lz = 20; lz <= 190; lz += 2) walkPts.push([N.X0, N.Z0 - lz]); for (let t = 31; t >= 1; t -= 1) walkPts.push(lk(t)); }
ok('walkable land all the way kiosk → plaza → 南后街 → step path → 牌坊 (no water / no gap)', walkPts.every(([x, z]) => R.isLand(x, z) && !R.isWater(x, z)), walkPts.filter(([x, z]) => !R.isLand(x, z)).slice(0, 4));
{ let segs = 0; for (let i = 1; i < walkPts.length; i++) segs += Math.hypot(walkPts[i][0] - walkPts[i - 1][0], walkPts[i][1] - walkPts[i - 1][1]); ok(`walk kiosk → 牌坊 ≈ ${segs.toFixed(0)} m (data ${N.walk_m})`, Math.abs(segs - N.walk_m) < 25, segs); }
const lkw = F.roads.find(r => r.id === 'nhjw');
ok('step path 牌坊 → 南后街: walk road with stone rails both sides (granite + green strips, no ground markings)', lkw && lkw.walk && lkw.rails.length === 2 && lkw.d2);
ok('banyans along the step path (both sides, upright)', F.trees.filter(t => t[5] === 'nhjw' && t[6] === 1).length >= 4);
{ const body = src.slice(src.indexOf('  nhjStreet(lo = false) {'), src.indexOf('  /** 西湖一角的远景'));
  ok('junction: only real street-name signs (杨桥东路 + 南后街), no arrows / maps / ground guides', /roadSignW\([^)]*'杨桥东路'/.test(body) && /roadSignW\([^)]*'南后街'/.test(body) && !/箭头|arrow|地图/.test(body.replace(/不画地面引导/g, '')));
  ok('embedded block: fzAttr.sanfang through a 180° proxy (xf s = -1, quads ry + π, colliders mirrored)', /s: -1/.test(body) && /ry \+ R/.test(body) && /X0 - x1, X0 - x0/.test(body) && /embed: true/.test(body)); }
ok('gate backdrop (white wall + collider) removed when 2D present', /if \(!FZR\.d2\) \{ const bx = S\.x \+ dx \* 6/.test(src));
ok('sanfang embed: no front road, no skyline wall at the far end, end gables get façades', /if \(!E\) front\(S/.test(attr) && /if \(!E\) saddleWall\(S, -26, 186/.test(attr) && /o\.endFace/.test(attr));
ok('Geo.merge normals follow a 180° xf (s < 0)', /if \(X\.s < 0\) \{ tmpN\.x = -tmpN\.x; tmpN\.z = -tmpN\.z; \}/.test(fs.readFileSync(new URL('../../js/core/geo.js', import.meta.url), 'utf8')));
ok('perf: 南后街 hi / lo LOD groups (d2s / d2sLo), lo pass registers no colliders and reuses the atlas draws', /k\.group\('d2s'\); this\.nhjStreet\(true\); k\.group\('d2sLo'\)/.test(src) && /real0\.col = \(\) => \{\}; real0\.colSlab = \(\) => \{\}/.test(src) && /this\._d2draws\[n\+\+\]/.test(src) && /function roofLo/.test(attr));
ok('perf: east section in its own group d2e; corridor mode turns off gN / det / d2e', /k\.group\('d2e'\)/.test(src) && /d < 430 && !corrP/.test(src) && /k\.group\('det'\)/.test(src) && /detOn: !corrP/.test(src) && /if \(gn\.det\)/.test(src));
// ③ 朱紫坊：北岸沿河立面 + 石牌 + 古榕；门一律关着
const zz = F.houses.filter(h => h.zzf);
ok(`朱紫坊 north-bank fronts (${zz.length} houses, 白墙黛瓦, facing the river)`, zz.length >= 6 && zz.every(h => h.kind === 'mh' && h.d2 && h.f[1] < 0));
ok('朱紫坊 doors: closed double wooden doors (facade + solid door leaf + rings + threshold); no open doorway', /关着的双扇木门/.test(src) && /h\.zzf \? this\.fac\.zzf/.test(src) && /门缝/.test(src) && /门环/.test(src));
ok('朱紫坊 stone sign on the north bank, facing the river, on land', R.isLand(...D2.zzf.sign) && /'朱紫坊', 'Zhuzifang'/.test(src) && D2.zzf.f[1] < 0);
ok('old banyans by the sign (scale 1.3)', F.trees.filter(t => t[5] === 'zzf' && t[4] >= 1.3).length >= 1);
// ④ ⑤ 达道：三捷河改名、河名牌（1A 木牌 + 石座，上中文下英文）、码头牌只写名字、展示船缆绳系着且没有上船提示；星安桥不出现
{ const body = attr.slice(attr.indexOf('function shangxiahang(S) {'), attr.indexOf('/* ============== 西门 B 口'));
  ok('达道: our own wrong name 星安河 replaced by 三捷河 (code + comments); 星安桥 nowhere', !/星安/.test(attr) && /三捷河/.test(body));
  ok('河名牌 三捷河 / Sanjie River on the 1A board (stone base + wood board)', /woodBoard\(S, [^)]*'三捷河', 'Sanjie River'\)/.test(body) && /深灰石座|#4D4F52/.test(attr));
  ok('码头牌 only 「三捷河码头 / Sanjie River Pier」 (no line badge, no next stop)', /woodBoard\(S, [^)]*'三捷河码头', 'Sanjie River Pier'\)/.test(body) && !/下一站|线路章|Next:/.test(attr.slice(attr.indexOf('function woodBoard'), attr.indexOf('function mooredBoat'))));
  const mb = attr.slice(attr.indexOf('function mooredBoat'), attr.indexOf('/* ============== 达道'));
  ok('display boats: ≥ 3 moored with ropes to bollards, no tap / board prompt', (body.match(/mooredBoat\(/g) || []).length >= 2 && /缆绳/.test(mb) && /系船桩/.test(mb) && !/pressable|onTap|上船|board\(/.test(mb.replace(/不能上|没有提示/g, ''))); }
// ⑥ 琼东河口：矮挡墙 + 远景水面（同高同色，看不出接缝）
const M = D2.mouth, cap5 = F.wall.filter(w => w[4] === 5);
ok('mouth: one low-wall cap segment (flag 5) at the 安泰河 east end; old 1A dark-hole cap gone', cap5.length === 1 && Math.hypot((cap5[0][0] + cap5[0][2]) / 2 - M.x, (cap5[0][1] + cap5[0][3]) / 2 - M.z) < 1 && !F.wall.some(w => w[4] === 2 && Math.hypot((w[0] + w[2]) / 2 - 63.4, (w[1] + w[3]) / 2 - 188.3 * -1) < 8), cap5);
ok('far water: triangles beyond the wall, drawn at WY with the river colour (#2F6670) — no seam', M.water.i.length >= 3 && /add\(WA, \[FZR\.d2\.mouth\.water\], WY, hex\('#2F6670'\)\)/.test(src) && /add\(WA, FZR\.water, levelAt, hex\('#2F6670'\)\)/.test(src));
ok('low wall: top 0.7 m above water (far water visible over it); bank faces not drawn across the mouth', /flag === 5/.test(src) && /WY \+ 0\.7/.test(src) && /w\[4\] === 3 \|\| w\[4\] === 5/.test(src));
{ const far = M.water, P = far.p; let inReg = 0; for (let j = 0; j < P.length; j += 2) if (R.isLand(P[j], P[j + 1])) inReg++; ok('far water outside the walkable land (only to look at)', inReg <= 2, inReg); }
ok('mouth: stone rails on the bank ends + far shore walls', M.rail.length >= 2 && M.shore.length >= 4);
// ⑦ 夜景灯光留给批 3
ok('no night-lighting work in 2D (no emissive lantern / night mode added)', !/夜景|night/i.test(src.slice(src.indexOf('  d2Static() {'), src.indexOf('  /** 西湖一角的远景'))));
// 验收 + 2C 教训
ok('2D houses: façades on all four sides (side / back mhS texture)', /if \(h\.d2\) \{/.test(src) && /this\.fac\.mhS/.test(src) && F.houses.filter(h => h.d2).length >= 20);
ok('2D skirt painted grass (no pure-white ground) in the east section + 南后街 corridor', /inD2\(x, z\)( \|\| inQ\(x, z\))?\) \? GRASS/.test(src));
ok('2D benches use the cast-iron side frames (no black box end-on)', /id === 'at' && FZR\.d2 && s > FZR\.d2\.atALen/.test(src));
ok('HUD shore stays red (A line colour) everywhere in net a', R.hudLine('A', null).color === '#B3261E');
ok('perf: lo street drops far-row saddle walls / lanterns, filler and the ±160 m road (bbox stays street-wide)', /far = LO && z \+ 13 <= 143/.test(attr) && /if \(!far\) saddleWall/.test(attr) && /if \(!LO\) S\.filler/.test(attr) && /if \(!lo\) \{\s*\/\/ 路缘石/.test(src));
ok('perf: the 4 link banyans (nhjw) + 4 roadside houses go to group d2b (tight bbox, not g0 / gN0)', /k\.group\('d2b'\)/.test(src) && /Math\.hypot\(p\.x \+ 78, p\.z \+ 175\) < 100/.test(src) && F.trees.filter(t => t[5] === 'nhjw').length === 4);
ok('perf: east houses / tree trunks go to 80 m detail cells (d2e keeps walls / sign / mouth, no 400 m house bbox)', /if \(inD2E\(h\.x, h\.z\)\) this\.det\(h\.x, h\.z/.test(src) && /if \(inD2E\(x, z\)\) this\.treeBlobAt/.test(src) && /if \(this\._d2epass && inD2E\(h\.x, h\.z\)\) return/.test(src));
ok('perf: fzdjk kiosk is its own group d2k, on only within 140 m (not batched into rest)', /k\.group\('d2k'\)/.test(src) && /Math\.hypot\(p\.x - K\.x, p\.z - K\.z\) < 140/.test(src));
ok('perf: 琼东河口 visible wall is in d2Static, not always-on g0', /w\[4\] === 5/.test(src) && /矮挡墙可见几何/.test(src) && /不进常开 g0/.test(src));
ok('东街口 kiosk label resolves (FZ_STATIONS_ZH fzdjk = 东街口)', /fzdjk: '东街口'/.test(src));
ok('东街口 C 亭内地单独用 2C 花岗岩（#ABA497），其它亭仍是共用预制体的漆面 #B9B5AD', (() => {
  const fn = src.slice(src.indexOf('  kioskAt(K) {'), src.indexOf('  /* ---------- 每帧 ---------- */'));
  return /K\.code === 'fzdjk'/.test(fn) && /k\.g\('granite'\)/.test(fn) && /#ABA497/.test(fn) && /else sl\(P, -2\.6, 2\.6, 0, 0\.06, -6\.4, 0\.4, hex\('#B9B5AD'\)/.test(fn);
})());
{ // 东段沿岸一路是岸地（北岸、南岸各走一遍：安泰桥东 → 口门前 3 m，横向 hw + 3）
  let bad = []; for (const sd of [-1, 1]) for (let s = D2.atALen + 2; s < L.len - 3; s += 2) { const a = L.at(s, sd * (6 + 3)); if (!R.isLand(a.x, a.z)) bad.push([sd, +s.toFixed(0)]); }
  ok('both banks of the east section walkable end to end (except bridge abutments)', bad.filter(([sd, s]) => Math.abs(s - jm.s) > jm.w / 2 + 1).length === 0, bad.slice(0, 6)); }
if (fails.length) { console.log(`\n${fails.length} FAILED: ${fails.join(', ')}`); process.exit(1); } else console.log('\nALL PASS');
