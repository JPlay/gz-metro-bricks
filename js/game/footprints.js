// 发光脚印：默认关闭，脚印按钮切换。40 个实例循环使用。
// 每个脚印是一张贴地的小脚丫（左右脚镜像，带脚趾），半透明青色；落点向下射线贴住台阶 / 地面，不会浮在台阶上方。
// 6 秒后淡出；离镜头很近（< 1.1m）的直接隐藏、1.1–2.4m 之间渐隐，避免第三人称贴地时糊成一大块。
const B = window.BABYLON;
const W = 0.11, L = 0.22, SIDE = 0.085, STEP = 0.55, LIFE = 6, ALPHA = 0.6, NEAR0 = 1.1, NEAR1 = 2.4, LIFT = 0.012;
function footTexture(scene) {
  // 右脚脚印（贴图上方 = 脚尖，大脚趾在左侧 = 内侧）；左脚用 scaling.x = -1 镜像
  const t = new B.DynamicTexture('footTex', { width: 128, height: 256 }, scene, true), c = t.getContext();
  c.clearRect(0, 0, 128, 256); c.fillStyle = '#FFFFFF';
  const ell = (x, y, rx, ry, a = 0) => { c.beginPath(); c.ellipse(x, y, rx, ry, a, 0, Math.PI * 2); c.fill(); };
  ell(66, 112, 38, 50, 0.12);          // 前掌
  ell(58, 200, 29, 40, 0.05);          // 脚跟
  c.beginPath(); c.moveTo(34, 120); c.quadraticCurveTo(40, 170, 32, 200); c.lineTo(84, 200); c.quadraticCurveTo(96, 160, 100, 118); c.closePath(); c.fill(); // 足弓连接
  ell(46, 40, 15, 19, -0.15);          // 大脚趾
  ell(73, 34, 10, 12); ell(92, 42, 9, 11); ell(107, 56, 8, 10); ell(116, 74, 7, 8); // 其余四趾
  t.hasAlpha = true; t.update(true);
  return t;
}
export class Footprints {
  constructor(scene) {
    this.scene = scene; this.on = false; this.pool = []; this.i = 0; this.side = 1; this.last = null;
    const src = this.src = B.MeshBuilder.CreateGround('foot', { width: 1, height: 1 }, scene);
    const m = new B.StandardMaterial('footMat', scene);
    m.diffuseTexture = footTexture(scene); m.useAlphaFromDiffuseTexture = true; m.diffuseColor = new B.Color3(0, 0, 0);
    // disableLighting 时漫反射不出光，颜色全靠自发光（否则脚印是黑的）；形状和透明度来自贴图 alpha × 实例颜色 alpha
    m.emissiveColor = B.Color3.FromHexString('#7CF7FF'); m.specularColor = new B.Color3(0, 0, 0); m.disableLighting = true; m.backFaceCulling = false; m.zOffset = -2;
    src.material = m; src.isVisible = false; src.isPickable = false; src.hasVertexAlpha = true; src.alphaIndex = 3;
    src.registerInstancedBuffer('color', 4); src.instancedBuffers.color = new B.Color4(1, 1, 1, ALPHA);
    for (let k = 0; k < 40; k++) {
      const inst = src.createInstance('fp' + k); inst.setEnabled(false); inst.isPickable = false; inst.instancedBuffers.color = new B.Color4(1, 1, 1, 0);
      this.pool.push({ m: inst, life: 0 });
    }
    this.ray = new B.Ray(new B.Vector3(), new B.Vector3(0, -1, 0), 1.3);
    // 只贴看得见的不透明场景表面（台阶、地面、扶梯踏板…），不贴人、玻璃、灯光晕、阴影片。
    // 场景里的可见网格都设了 isPickable=false（只有隐形碰撞盒可拾取，而楼梯碰撞盒是斜坡），所以这里用自定义 predicate 直接测可见网格的三角形，
    // 跳过碰撞盒，脚印才会落在真正的踏步面上。
    this.pred = mesh => mesh.isEnabled() && mesh.isVisible && !(mesh.metadata && mesh.metadata.collider) && !mesh.skeleton && !mesh.infiniteDistance &&
      !/^(foot|fp\d|glass|glow|halo|shade|sky|kidBlob|npcBlob|signs|player)/.test(mesh.name) && !(mesh.material && mesh.material.alpha < 1);
    this.hits = 0; this.misses = 0;
  }
  toggle(v) { this.on = v === undefined ? !this.on : v; if (!this.on) this.clear(); return this.on; }
  clear() { this.pool.forEach(p => { p.life = 0; p.m.setEnabled(false); }); this.last = null; }
  /** 落点：从脚印位置上方 0.5m 向下打射线，取最近的表面高度；打不到就用玩家脚底高度 */
  groundAt(x, y, z) {
    this.ray.origin.set(x, y + 0.5, z);
    const hit = this.scene.pickWithRay(this.ray, this.pred);
    if (hit && hit.hit) { this.hits++; return hit.pickedPoint.y; }
    this.misses++; return y;
  }
  update(dt, pos, yaw, grounded, moving, camPos) {
    if (this.on && grounded && moving) {
      if (!this.last) this.last = pos.clone();
      const d = Math.hypot(pos.x - this.last.x, pos.z - this.last.z);
      if (d > STEP) {
        this.last.copyFrom(pos); this.side = -this.side;
        const p = this.pool[this.i++ % this.pool.length], rx = Math.cos(yaw), rz = -Math.sin(yaw);
        const x = pos.x + rx * this.side * SIDE, z = pos.z + rz * this.side * SIDE;
        p.m.position.set(x, this.groundAt(x, pos.y, z) + LIFT, z); p.m.rotation.y = yaw;
        p.m.scaling.set(W * this.side, 1, L); // side=+1 右脚，-1 左脚（镜像）
        p.life = LIFE; p.m.setEnabled(true);
      }
    }
    for (const p of this.pool) {
      if (p.life <= 0) continue; p.life -= dt;
      if (p.life <= 0) { p.m.setEnabled(false); continue; }
      let a = ALPHA * Math.min(1, p.life / 1.5);
      if (camPos) { const dc = B.Vector3.Distance(camPos, p.m.position); a *= Math.max(0, Math.min(1, (dc - NEAR0) / (NEAR1 - NEAR0))); }
      p.m.instancedBuffers.color.a = a; p.m.isVisible = a > 0.02;
    }
  }
  count() { return this.pool.filter(p => p.life > 0).length; }
}
