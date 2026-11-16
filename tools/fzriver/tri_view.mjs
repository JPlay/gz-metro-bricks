// 离线数三角面（NullEngine，不开浏览器）：node tools/fzriver/tri_view.mjs <repo 根目录绝对路径> '[[name, x, z, yaw, pitch], ...]'
// 在 (x, z)（河网世界坐标）按 lodNow 开关组，第一人称 1.6 m、fov 0.8 做视锥裁剪，按组输出可见三角面 / 网格数。
// 只用于前后对比（浏览器里还有人物、天空、第三人称机位，绝对值比这里高 ~10–15k）。
import fs from 'node:fs'; import vm from 'node:vm';
globalThis.window = globalThis; globalThis.self = globalThis;
const mkEl = () => new Proxy(function(){}, { get: (t, k) => k === Symbol.toPrimitive ? () => 0 : k === 'then' ? undefined : mkEl(), apply: () => mkEl(), construct: () => mkEl(), set: () => true });
globalThis.document = mkEl(); globalThis.localStorage = { getItem: () => null, setItem() {} };
globalThis.addEventListener = () => {}; globalThis.location = { search: '', href: 'http://x/', hash: '' }; globalThis.matchMedia = () => ({ matches: false, addEventListener() {} });
globalThis.requestAnimationFrame = () => 0; globalThis.Image = function () { return mkEl(); };
vm.runInThisContext(fs.readFileSync(new URL('../../vendor/babylonjs/9.28.0/babylon.js', import.meta.url), 'utf8'));
const root = process.argv[2], P = JSON.parse(process.argv[3]);
const S = await import(root + '/js/game/fzService.js');
const eng = new BABYLON.NullEngine({ renderWidth: 1112, renderHeight: 834 }); const scene = new BABYLON.Scene(eng);
const st = S.FZ_SVC.street(scene, 'fzdjk', { n: 'C', x: 10, line: 1, road: 'r', to: ['a'], toEn: ['a'], attr: 'fzriver' });
// 3C：NIGHT=1 数夜景（夜灯网格 + 夜里的组开关距离）；默认白天（after() 按本机时间可能已经开了夜景，这里强制回白天）
if (st.night) st.night.set(process.env.NIGHT === '1');
const gn = st.kit.groupNodes; const out = {};
const cam = new BABYLON.UniversalCamera('c', new BABYLON.Vector3(0, 0, 0), scene); cam.fov = +(process.env.FOV || 0.8); cam.minZ = 0.1; cam.maxZ = 2000; scene.activeCamera = cam;
const grpOf = m => { let a = m; while (a) { for (const [g, n] of Object.entries(gn)) if (n === a) return g; a = a.parent; } return 'free'; };
for (const [name, x, z, yaw, pitch] of P) {
  st.pl = null; st.K = { x, z }; st.lodNow(true);
  cam.position.set(st.wx(x), 1.6, st.wz(z)); cam.rotation.set(pitch || 0, yaw, 0);
  scene.updateTransformMatrix(true); cam.getViewMatrix(true); scene.setTransformMatrix(cam.getViewMatrix(true), cam.getProjectionMatrix(true));
  const fr = BABYLON.Frustum.GetPlanes(scene.getTransformMatrix());
  const r = {}; let T = 0, D = 0;
  for (const m of scene.meshes) { if (!m.isEnabled() || !m.isVisible || !m.getTotalIndices()) continue; m.computeWorldMatrix(true); if (!m.isInFrustum(fr)) continue; const t = m.getTotalIndices() / 3, g = grpOf(m); r[g] = r[g] || [0, 0]; r[g][0] += Math.round(t); r[g][1]++; T += t; D++; }
  out[name] = { T: Math.round(T), D, r };
}
console.log(JSON.stringify(out)); process.exit(0);
