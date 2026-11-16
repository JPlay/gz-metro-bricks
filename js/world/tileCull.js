/*
 * 把跨几百米合批的常开网格按 80 m 格子拆成索引块，lodNow 时按相机视锥换索引。
 * 面数按朝向降下来，绘制次数不变（同一个网格，同夜灯 cull 的做法）。
 * 近处细节合进 det 一组：视锥之外还按白天 125 m / 夜里 NIGHT.lod.near 裁（替代原来每格一组开关）。
 * 只装在冻结的静态街面网格上（桥/岸墙/房子/树冠/地面/水面/路牌/det），不动船、夜灯、角色。
 */
const TILE = 80;
const PAD = 24;          // 视锥外包一圈，转头时不会闪掉刚进画面的块
const NEAR_KEEP = 28;    // 脚下附近的块一律保留（桥面 / 脚下地面）
const SPAN_MIN = 80;     // 包围盒 xz 跨度不到一格的不必拆
const TRIS_MIN = 80;
export const TURN = 10 * Math.PI / 180;   // 朝向相对上次换索引转过约 10°：这一帧就重算，不等 0.25 s（快转头远处楼会空一截）
export const JUMP = 12;                   // 传送 / 大跳：同样当帧重算
export function angDiff(a, b) { let d = a - b; d -= Math.PI * 2 * Math.round(d / (Math.PI * 2)); return Math.abs(d); }
export function viewNeedsRefresh(view, cam, px, pz) {
  if (!cam) return false;
  if (!view) return true;
  if (Math.hypot(angDiff(cam.rotation.y, view.yaw), angDiff(cam.rotation.x, view.pitch)) > TURN) return true;
  if (Math.hypot(px - view.x, pz - view.z) > JUMP) return true;
  return false;
}

const B = () => window.BABYLON;
function boxHitsFrustum(min, max, planes) {
  for (let i = 0; i < planes.length; i++) {
    const pl = planes[i], nx = pl.normal.x, ny = pl.normal.y, nz = pl.normal.z, d = pl.d;
    const x = nx > 0 ? max.x : min.x, y = ny > 0 ? max.y : min.y, z = nz > 0 ? max.z : min.z;
    if (nx * x + ny * y + nz * z + d < 0) return false;
  }
  return true;
}

/** 在 kit.finish + 图集 finish 之后、造船 / 夜景之前调用 */
export function installTileCull(street) {
  const k = street.kit, list = [];
  const meshes = [...(k.meshes || [])];
  if (street.atlas && street.atlas.mesh) meshes.push(street.atlas.mesh);
  for (const m of meshes) {
    if (!m || m.isDisposed && m.isDisposed() || !m.getTotalIndices || !m.getTotalIndices()) continue;
    if (m.isVisible === false || (m.metadata && m.metadata.collider)) continue;
    const t = m.getTotalIndices() / 3; if (t < TRIS_MIN) continue;
    m.computeWorldMatrix(true);
    const bb = m.getBoundingInfo().boundingBox, minW = bb.minimumWorld, maxW = bb.maximumWorld;
    const dx = maxW.x - minW.x, dz = maxW.z - minW.z;
    if (Math.max(dx, dz) < SPAN_MIN) continue;
    const vd = m.getVerticesData(B().VertexBuffer.PositionKind);
    const idx0 = m.getIndices(); if (!vd || !idx0 || !idx0.length) continue;
    const ox = k.root.position.x, oz = k.root.position.z;
    const tiles = new Map();
    for (let i = 0; i < idx0.length; i += 3) {
      const a = idx0[i] * 3, b = idx0[i + 1] * 3, c = idx0[i + 2] * 3;
      const x = (vd[a] + vd[b] + vd[c]) / 3 + ox, z = (vd[a + 2] + vd[b + 2] + vd[c + 2]) / 3 + oz;
      const key = (Math.floor(x / TILE) | 0) + ',' + (Math.floor(z / TILE) | 0);
      let tile = tiles.get(key);
      if (!tile) {
        tile = { i: [], min: { x: x, y: vd[a + 1], z: z }, max: { x: x, y: vd[a + 1], z: z } };
        tiles.set(key, tile);
      }
      tile.i.push(idx0[i], idx0[i + 1], idx0[i + 2]);
      for (const p of [a, b, c]) {
        const px = vd[p] + ox, py = vd[p + 1], pz = vd[p + 2] + oz;
        if (px < tile.min.x) tile.min.x = px; if (px > tile.max.x) tile.max.x = px;
        if (py < tile.min.y) tile.min.y = py; if (py > tile.max.y) tile.max.y = py;
        if (pz < tile.min.z) tile.min.z = pz; if (pz > tile.max.z) tile.max.z = pz;
      }
    }
    const packed = [];
    for (const tile of tiles.values()) {
      packed.push({
        i: tile.i,
        min: { x: tile.min.x - PAD, y: tile.min.y - PAD, z: tile.min.z - PAD },
        max: { x: tile.max.x + PAD, y: tile.max.y + PAD, z: tile.max.z + PAD },
        cx: (tile.min.x + tile.max.x) / 2,
        cz: (tile.min.z + tile.max.z) / 2
      });
    }
    const detNode = k.groupNodes && k.groupNodes.det;
    const isDet = (mesh) => { let a = mesh; while (a) { if (a === detNode) return true; a = a.parent; } return false; };
    list.push({ mesh: m, tiles: packed, full: idx0, verts: m.getTotalVertices(), key: null, det: isDet(m), hid: false });
  }
  return {
    list,
    _view: null,
    shouldRefresh(cam, px, pz) { return viewNeedsRefresh(this._view, cam, px, pz); },
    update(cam, opts = {}) {
      if (!cam || !list.length) return;
      const pos = cam.position, yaw = cam.rotation ? cam.rotation.y : 0;
      const px = opts.px != null ? opts.px : pos.x, pz = opts.pz != null ? opts.pz : pos.z;
      const detR = opts.detR, detOn = opts.detOn !== false, force = !!opts.force;
      const kPos = Math.round(pos.x / 8) + ',' + Math.round(pos.z / 8) + ',' + Math.round(yaw / 0.12) + ',' + (detR || 0) + ',' + (detOn ? 1 : 0);
      cam.getViewMatrix(true);
      const scene = cam.getScene && cam.getScene();
      if (scene) scene.setTransformMatrix(cam.getViewMatrix(true), cam.getProjectionMatrix(true));
      const planes = B().Frustum.GetPlanes(scene && scene.getTransformMatrix() || cam.getTransformationMatrix());
      this._view = { yaw, pitch: cam.rotation.x, x: px, z: pz };
      for (const item of list) {
        const m = item.mesh;
        const parentOn = !m.parent || m.parent.isEnabled();
        if (!parentOn) { item.key = null; continue; }
        if (!force && item.key === kPos) continue;
        item.key = kPos;
        const out = [];
        if (!(item.det && !detOn)) {
          for (const t of item.tiles) {
            const d = Math.hypot(t.cx - px, t.cz - pz);
            if (item.det && detR && d > detR && d >= NEAR_KEEP) continue;
            if (d < NEAR_KEEP || boxHitsFrustum(t.min, t.max, planes)) {
              const I = t.i; for (let j = 0; j < I.length; j++) out.push(I[j]);
            }
          }
        }
        if (out.length) {
          if (item.hid) { m.setEnabled(true); item.hid = false; }
          m.setIndices(out, item.verts, false);
        } else {
          m.setIndices([], item.verts, false);
          if (m.isEnabled(false)) { m.setEnabled(false); item.hid = true; }
        }
      }
    }
  };
}
