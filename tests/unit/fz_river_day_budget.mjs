// 福州内河白天预算：常开大网格按视锥换索引（不加 draw），近处细节合进 det 一组再用同一套裁。
import fs from 'node:fs';
const fails = [];
function ok(n, v, info) { console.log(`${v ? 'PASS' : 'FAIL'} ${n}${!v && info !== undefined ? ' ' + JSON.stringify(info) : ''}`); if (!v) fails.push(n); }
const src = fs.readFileSync(new URL('../../js/world/fzRiver.js', import.meta.url), 'utf8');
const cull = fs.readFileSync(new URL('../../js/world/tileCull.js', import.meta.url), 'utf8');
ok('fzRiver imports and installs tileCull after boats, updates it in lodNow', /import \{ installTileCull \} from '\.\/tileCull\.js'/.test(src) && /this\.tileCull = installTileCull\(this\)/.test(src) && /this\.tileCull\.update\(this\.scene\.activeCamera/.test(src));
ok('non-2C detail cells merge into one det group (no per-cell c: groups)', /k\.group\('det'\)/.test(src) && !/k\.group\('c:' \+ key\)/.test(src) && /if \(gn\.det\)/.test(src));
ok('tileCull swaps indices on the same mesh (setIndices, like night lights) and hides empty meshes', /m\.setIndices\(out, item\.verts, false\)/.test(cull) && /setEnabled\(false\)/.test(cull) && /detR/.test(cull));
ok('det tiles also respect day NEAR / night NIGHT.lod.near (same 125 / 80 as before)', /detR: \(NL \? NL\.near : NEAR\) \+ CELL \* 0\.7/.test(src) && /detOn: !corrP/.test(src));
const { NIGHT } = await import('../../js/game/night.js');
ok('night lod.near stays tighter than day 125 (80) and d2e/gN/c2 never exceed day caps', NIGHT.lod.near === 80 && NIGHT.lod.near < 125 && NIGHT.lod.gN <= 430 && NIGHT.lod.c2 <= 330 && NIGHT.lod.c2d <= 110 && NIGHT.lod.d2e <= 430);
ok('no point lights or shadows added (tileCull has none; night still forbids them)', !/PointLight|SpotLight|shadowGenerator|castShadows\s*=\s*true/.test(cull) && !/PointLight|SpotLight/.test(src));

ok('24 m pad is unchanged', /const PAD = 24/.test(cull));
ok('late beforeRender observer refreshes tiles after camera write; dispose removes it', /onBeforeRenderObservable\.add\(\(\) => this\.refreshTilesIfTurned\(\)\)/.test(src) && /refreshTilesIfTurned\(\)/.test(src) && /force: true/.test(src) && /if \(this\._tileObs\)/.test(src));
ok('tick still uses 0.25 s cadence for lodNow (groups + periodic tiles)', /this\.lodT -= dt; if \(this\.lodT <= 0\) \{ this\.lodT = 0\.25; this\.lodNow\(false\); \}/.test(src));
const { TURN, JUMP, angDiff, viewNeedsRefresh } = await import('../../js/world/tileCull.js');
ok('TURN is ~10°, JUMP is 12 m', Math.abs(TURN - 10 * Math.PI / 180) < 1e-12 && JUMP === 12);
const cam = (y, p) => ({ rotation: { y, x: p } });
const v0 = { yaw: 0, pitch: 0, x: 0, z: 0 };
ok('viewNeedsRefresh: first call / no view is true; same pose is false', viewNeedsRefresh(null, cam(0, 0), 0, 0) === true && viewNeedsRefresh(v0, cam(0, 0), 0, 0) === false);
ok('viewNeedsRefresh: 9° stay, 10.1° and 180° wrap trigger', viewNeedsRefresh(v0, cam(9 * Math.PI / 180, 0), 0, 0) === false && viewNeedsRefresh(v0, cam(10.1 * Math.PI / 180, 0), 0, 0) === true && viewNeedsRefresh(v0, cam(Math.PI, 0), 0, 0) === true && viewNeedsRefresh({ yaw: Math.PI - 0.05, pitch: 0, x: 0, z: 0 }, cam(-Math.PI + 0.05, 0), 0, 0) === false);
ok('viewNeedsRefresh: pitch 10.1° triggers; combined <10° stay', viewNeedsRefresh(v0, cam(0, 10.1 * Math.PI / 180), 0, 0) === true && viewNeedsRefresh(v0, cam(6 * Math.PI / 180, 6 * Math.PI / 180), 0, 0) === false);
ok('viewNeedsRefresh: jump 13 m triggers, walk 8 m does not', viewNeedsRefresh(v0, cam(0, 0), 13, 0) === true && viewNeedsRefresh(v0, cam(0, 0), 8, 0) === false);
ok('angDiff wraps 2π and is symmetric', Math.abs(angDiff(0, 2 * Math.PI - 0.1) - 0.1) < 1e-9 && Math.abs(angDiff(0.2, -0.2) - 0.4) < 1e-9);
if (fails.length) { console.error('FAILS', fails); process.exit(1); }
console.log('all passed');
