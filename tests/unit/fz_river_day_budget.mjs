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
if (fails.length) { console.error('FAILS', fails); process.exit(1); }
console.log('all passed');
