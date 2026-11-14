/*
 * 福州内河游船 A 线（红篷）：西湖码头 ⇄ 西水关码头 ⇄ 黎明湖码头。
 *   跟坐地铁一样：走上船 → 靠近空座「坐下」→ 船自己开（不用操纵）→ 到站停靠 → 船停稳了才能「起身」→ 走上浮码头。
 *   双头船：两头一样，掉头不用转身；长凳没有靠背，乘客总是朝行进方向坐（终点掉头时座位朝向慢慢转过来）。
 *   船线 / 限速 / 净空：js/data/fz-river.js（ROUTE、speedCap、clearanceReport）。
 *   船停在某个码头时，有人站到别的码头的浮码头 / 码头牌前，船会空船开过去（叫船）。
 *   报站只有普通话 + 英语（小美：游船广播不播福州话）。
 */
import { Kit } from '../world/kit.js';
import { hex } from '../core/geo.js';
import { WY, BOAT, STOPS, ROUTE, routePose, boatStep, levelAtS, LOCK, LOCK_STATE, BOAT_DWELL, BOAT_STAY } from '../data/fz-river.js';
export { BOAT_DWELL };
import { say } from '../audio/announcements.js';
import { fzBoatDepartSegs, fzBoatArriveSegs, fzBoatLockSegs } from '../data/phrases.js';

const B = window.BABYLON;
const NO = { ao: false };

export class FzBoat {
  constructor(S, variant = 'red') {
    this.S = S; this.scene = S.scene; this.variant = variant;
    this.node = new B.TransformNode('fzBoat', this.scene); this.node.parent = S.kit.root;
    this.kit = new Kit(this.scene, 'fzBoatKit', this.node);
    this.build();
    this.kit.finish(false);
    this.kit.meshes.forEach(m => { m.isPickable = false; m.receiveShadows = true; });
    // 起始：停在离出来的出口亭最近的码头
    // 1A：西洋 A 出来停黎明湖（终点）、西门 C 出来停西水关；1B：停在出口亭登记的码头（K.pier）
    const kp = S.K.pier ? STOPS.findIndex(st => st.id === S.K.pier) : -1;
    const start = kp >= 0 ? kp : S.K.code === 'fzxiy' ? STOPS.length - 1 : 1;
    this.i = start; this.s = STOPS[start].s; this.v = 0; this.dir = start === STOPS.length - 1 ? -1 : 1; this.phase = 'dock'; this.target = start; this.dwell = 0; this.t = 0;
    this.lk = null; this.lkEv = null; this.y0 = levelAtS(this.s); this.faceK = this.dir; this.log = []; this.stats = { departs: 0, arrives: 0, calls: 0, maxStep: 0, maxYawStep: 0 };
    this.place(0);
  }
  /* ---------- 模型（船体局部：+z 船头，y=0 水面） ---------- */
  build() {
    const k = this.kit, P = k.solid, D = BOAT.deck, G = BOAT.gunwale, RU = BOAT.roofUnder;
    const wood = hex('#7A4E2D'), woodL = hex('#A57B4F'), dark = hex('#3B2A1E'), post = hex('#5A2E1E');
    const canopy = hex(this.variant === 'white' ? '#F2EFE8' : '#C0392B'), trim = hex(this.variant === 'white' ? '#B3261E' : '#F4E6C8');
    // 船体：中段 + 两头收窄（双头）
    P.box(0, (D - 0.3) / 2, 0, BOAT.beam, D + 0.3, 6.2, wood, 0, 0, 0, 1, NO);
    for (const e of [-1, 1]) { P.box(0, (D - 0.25) / 2 + 0.03, e * 3.45, BOAT.beam * 0.78, D + 0.2, 0.9, wood, 0, 0, 0, 1, NO); P.box(0, (D - 0.2) / 2 + 0.06, e * 3.92, BOAT.beam * 0.46, D + 0.1, 0.5, wood, 0, 0, 0, 1, NO); }
    P.box(0, 0.02, 0, BOAT.beam + 0.03, 0.1, 6.2, dark, 0, 0, 0, 1, NO);   // 水线
    P.box(0, D - 0.02, 0, BOAT.beam - 0.16, 0.04, 7.4, woodL, 0, 0, 0, 1, NO);   // 甲板
    // 舷墙（两侧中间开门）+ 两头挡板
    for (const sx of [-1, 1]) for (const [z0, z1] of [[-3.9, BOAT.door[0]], [BOAT.door[1], 3.9]]) {
      P.box(sx * (BOAT.beam / 2 - 0.05), (D + G) / 2, (z0 + z1) / 2, 0.1, G - D, z1 - z0, wood, 0, 0, 0, 1, NO);
      P.box(sx * (BOAT.beam / 2 - 0.05), G + 0.03, (z0 + z1) / 2, 0.16, 0.06, z1 - z0, woodL, 0, 0, 0, 1, NO);
    }
    for (const e of [-1, 1]) P.box(0, (D + G) / 2, e * 3.95, BOAT.beam * 0.5, G - D, 0.1, wood, 0, 0, 0, 1, NO);
    // 长凳（无靠背）
    for (const z of BOAT.rows) for (const sx of [-1, 1]) {
      P.box(sx * BOAT.seatX, D + 0.42, z, 0.76, 0.06, 0.42, woodL, 0, 0, 0, 1, NO);
      for (const dz of [-0.15, 0.15]) P.box(sx * BOAT.seatX, D + 0.2, z + dz, 0.66, 0.4, 0.05, dark, 0, 0, 0, 1, NO);
    }
    // 篷柱 + 两侧窗（窗框横梁、竖棂）
    const L = BOAT.canopyHalfLen;
    for (const sx of [-1, 1]) {
      for (const z of [-L, -2.0, BOAT.door[0], BOAT.door[1], 2.0, L]) P.box(sx * (BOAT.beam / 2 - 0.06), (G + RU) / 2, z, 0.09, RU - G, 0.09, post, 0, 0, 0, 1, NO);
      P.box(sx * (BOAT.beam / 2 - 0.06), RU - 0.06, 0, 0.1, 0.12, 2 * L, post, 0, 0, 0, 1, NO);        // 窗上横梁
      for (const z of [-2.4, -1.35, 1.35, 2.4]) P.box(sx * (BOAT.beam / 2 - 0.06), (G + RU) / 2, z, 0.04, RU - G, 0.04, post, 0, 0, 0, 1, NO);   // 窗棂
    }
    // 弧形篷顶（顶面 = BOAT.top）+ 白色垂边
    const n = 7, W = BOAT.canopyHalfW;
    for (let i = 0; i < n; i++) {
      const x0 = -W + 2 * W * i / n, x1 = -W + 2 * W * (i + 1) / n, xm = (x0 + x1) / 2, h = 0.09 * Math.cos(xm / W * Math.PI / 2);
      P.box(xm, RU + h + 0.03, 0, x1 - x0 + 0.02, 0.06, 2 * L + 0.3, canopy, 0, 0, Math.atan2(-0.09 * Math.PI / 2 / W * Math.sin(xm / W * Math.PI / 2), 1), 1, NO);
    }
    for (const sx of [-1, 1]) P.box(sx * W, RU - 0.03, 0, 0.03, 0.1, 2 * L + 0.3, trim, 0, 0, 0, 1, NO);
    for (const e of [-1, 1]) {
      P.box(0, RU - 0.03, e * (L + 0.15), 2 * W, 0.1, 0.03, trim, 0, 0, 0, 1, NO);
      // 船头小灯笼：用一根细绳挂在篷檐横梁下（小美：灯笼别悬空）+ 顶盖 / 底穗
      const lz = e * (L + 0.1);
      P.box(0, RU - 0.155, lz, 0.018, 0.17, 0.018, dark, 0, 0, 0, 1, NO);                       // 绳：横梁底 RU-0.08 → 灯笼顶盖
      P.box(0, RU - 0.245, lz, 0.1, 0.03, 0.1, hex('#C9A13B'), 0, 0, 0, 1, NO);                  // 顶盖
      P.ellipsoid(0, RU - 0.37, lz, 0.2, 0.24, 0.2, hex('#D7262E'), 1);                          // 灯笼
      P.box(0, RU - 0.51, lz, 0.025, 0.06, 0.025, hex('#C9A13B'), 0, 0, 0, 1, NO);               // 底穗
    }
    // 碰撞：甲板 + 舷墙（中门留空）+ 两头 + 停靠时伸出去的跳板
    const c = (x, y, z, w, h, d, name) => k.col(x, y, z, w, h, d, { dynamic: true, name, parent: k.root });
    this.cols = [c(0, D - 0.15, 0, BOAT.beam - 0.1, 0.3, 7.7, 'colBoatDeck')];
    for (const sx of [-1, 1]) for (const [z0, z1] of [[-3.95, BOAT.door[0]], [BOAT.door[1], 3.95]]) this.cols.push(c(sx * (BOAT.beam / 2 - 0.05), D + 0.32, (z0 + z1) / 2, 0.14, 0.64, z1 - z0, 'colBoatSide'));
    for (const e of [-1, 1]) this.cols.push(c(0, D + 0.32, e * 3.98, BOAT.beam, 0.64, 0.14, 'colBoatEnd'));
    this.planks = [-1, 1].map(sx => { const m = c(sx * (BOAT.beam / 2 + 0.3), D - 0.05, 0, 0.62, 0.1, BOAT.door[1] - BOAT.door[0], 'colBoatPlank'); m.setEnabled(false); return m; });
    this.plankVis = this.planks.map(m => { const v = B.MeshBuilder.CreateBox('fzBoatPlank', { width: 0.62, height: 0.05, depth: BOAT.door[1] - BOAT.door[0] - 0.1 }, this.scene); v.parent = k.root; v.position.copyFrom(m.position); v.position.y = D - 0.02; v.material = this.kit.meshes[0] ? this.kit.meshes[0].material : null; v.isPickable = false; v.setEnabled(false); return v; });
    // 座位（世界坐标，每帧更新）
    this.seats = [];
    for (const z of BOAT.rows) for (const sx of [-1, 1]) this.seats.push({ world: true, boat: this, follow: true, id: 'boat:' + z + ':' + sx, lz: z, lx: sx * BOAT.seatX, free: true, wx: 0, wy: 0, wz: 0, face: 0, eye: 1.0, camT: 0.75, camDist: 1.7, pitch: 0.22, pitchFirst: 0.2, stand: { x: 0, z: 0 } });
  }
  /* ---------- 位置 ---------- */
  pose() { return routePose(this.s); }
  place(dt) {
    const p = this.pose(), n = this.node, ox = n.position.x, oz = n.position.z, oyaw = n.rotation.y;
    this.t += dt; const bob = 0.012 * Math.sin(this.t * 1.4);
    this.y0 = levelAtS(this.s);   // 船所在水面（西湖 / 闸上游高 0.5 m，闸室里随水位）
    n.position.set(p.x, this.y0 + bob, p.z); n.rotation.y = p.yaw;
    if (dt > 0) { this.stats.maxStep = Math.max(this.stats.maxStep, Math.hypot(p.x - ox, p.z - oz)); const dy = Math.abs(((p.yaw - oyaw + Math.PI) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI) - Math.PI); this.stats.maxYawStep = Math.max(this.stats.maxYawStep, dy); }
    n.computeWorldMatrix(true); this.kit.root.computeWorldMatrix(true);
    for (const m of this.cols) m.computeWorldMatrix(true);
    for (const m of this.planks) if (m.isEnabled(false)) m.computeWorldMatrix(true);
    // 座位：朝行进方向（掉头时慢慢转过来）
    const want = this.dir; this.faceK += Math.max(-dt * 1.6, Math.min(dt * 1.6, want - this.faceK));
    const fx = Math.sin(p.yaw), fz = Math.cos(p.yaw), rx = fz, rz = -fx, R = this.S.kit.root.position, deck = this.y0 + bob + BOAT.deck;
    const face = p.yaw + Math.PI * (1 - this.faceK) / 2;   // faceK 1 = 朝 +s，-1 = 朝 -s，中间转过去
    for (const s of this.seats) {
      s.wx = R.x + p.x + rx * s.lx + fx * s.lz; s.wz = R.z + p.z + rz * s.lx + fz * s.lz; s.wy = deck; s.face = face;
      s.stand.x = R.x + p.x + fx * s.lz; s.stand.z = R.z + p.z + fz * s.lz;   // 起身站到过道
    }
  }
  /** W 坐标点是否在船上（落水判定当“干地”） */
  contains(x, z) { const p = this.pose(), dx = x - p.x, dz = z - p.z, u = dx * p.tx + dz * p.tz, v = dx * p.tz - dz * p.tx; return Math.abs(u) < BOAT.len / 2 + 0.15 && Math.abs(v) < BOAT.beam / 2 + 0.4; }
  seatNear(wp) {
    if (wp.y < this.y0 + 0.2 || wp.y > this.y0 + 1.4) return null;
    let best = null, bd = 0.95;
    for (const s of this.seats) if (s.free) { const d = Math.hypot(wp.x - s.wx, wp.z - s.wz); if (d < bd) { bd = d; best = s; } }
    return best;
  }
  canStand() { return this.phase === 'dock' && this.v < 0.05; }
  docked() { return this.phase === 'dock'; }
  /** 浮码头靠船一侧的跳板：停靠时打开 */
  setPlank(on) {
    const p = this.pose(), pier = STOPS[this.i].pier, rx = p.tz, rz = -p.tx, side = (rx * pier.n[0] + rz * pier.n[1]) > 0 ? 1 : -1;
    this.planks.forEach((m, j) => { const want = on && (j === 0 ? -1 : 1) === side; if (m.isEnabled(false) !== want) { m.setEnabled(want); this.plankVis[j].setEnabled(want); } });
  }
  /* ---------- 状态机 ---------- */
  passengerSeated(pl) { return !!(pl && pl.seat && pl.seat.seat && pl.seat.seat.boat === this); }
  onBoard(pl) { if (!pl) return false; const w = this.S.toW(pl.position); return this.contains(w.x, w.z) && pl.position.y > this.y0 && pl.position.y < this.y0 + 2; }
  depart(target, withPassenger) {
    this.target = target; this.dir = Math.sign(STOPS[target].s - this.s) || this.dir; this.phase = 'go'; this.dwell = 0; this.announcedNear = false; this.setPlank(false);
    this.stats.departs++; this.log.push({ t: +this.t.toFixed(1), ev: 'depart', from: STOPS[this.i].id, to: STOPS[target].id, pax: withPassenger });
    if (withPassenger) { const term = this.dir > 0 ? STOPS[STOPS.length - 1].id : STOPS[0].id; say(fzBoatDepartSegs(term, STOPS[target].id, ROUTE.id), { key: 'boat', interrupt: true }); }
  }
  arrive(pl) {
    this.i = this.target; this.s = STOPS[this.i].s; this.v = 0; this.phase = 'dock'; this.dwell = 0; this.setPlank(true);
    const pax = this.passengerSeated(pl), term = this.i === 0 || this.i === STOPS.length - 1;
    if (term) this.dir = this.i === 0 ? 1 : -1;
    this.departIn = pax && !term ? BOAT_STAY : null;   // 中途站：坐着的乘客有 10 秒点「起身」下船，不起身就接着坐到下一站
    // 终点站（西湖 / 黎明湖）：带着乘客到了就一直停着，等乘客点「起身」下船（以前 3 秒后又带着人开回去，「起身」按不上、上不了岸）
    this.holdTerm = pax && term;
    this.stats.arrives++; this.log.push({ t: +this.t.toFixed(1), ev: 'arrive', at: STOPS[this.i].id, pax });
    if (pax) say(fzBoatArriveSegs(STOPS[this.i].id, term), { key: 'boat', interrupt: true });
  }
  update(dt, pl) {
    dt = Math.min(dt, 0.25); this.dtLast = dt;
    if (this.phase === 'dock') {
      this.dwell += dt; if (this.dwell < 0.2) this.setPlank(true);
      const seated = this.passengerSeated(pl);
      if (seated && this.holdTerm) { this.departIn = null; }   // 终点站：乘客没起身就不开
      else if (seated) {
        if (this.departIn === undefined || this.departIn === null) this.departIn = BOAT_DWELL;
        this.departIn -= dt;
        if (this.departIn <= 0) { this.departIn = null; const j = this.i + this.dir; this.depart(j >= 0 && j < STOPS.length ? j : this.i - this.dir, true); }
      } else {
        this.departIn = null; if (!seated) this.holdTerm = false;
        // 叫船：人站在别的码头（浮码头上，或码头牌 / 台阶口附近），船空船开过去
        if (pl && !this.onBoard(pl) && this.dwell > 1.5) {
          const w = this.S.toW(pl.position);
          for (let j = 0; j < STOPS.length; j++) {
            if (j === this.i) continue; const P = STOPS[j].pier;
            const nearSign = Math.hypot(w.x - P.sign[0], w.z - P.sign[1]) < 6 && pl.position.y > -0.5, onPontoon = Math.hypot(w.x - P.berth[0], w.z - P.berth[1]) < 9 && pl.position.y < -1.2;
            if (nearSign || onPontoon) { this.stats.calls++; this.log.push({ t: +this.t.toFixed(1), ev: 'call', to: STOPS[j].id }); this.depart(j, false); break; }
          }
        }
      }
    } else {
      const st0 = this.lk ? this.lk.st : null;
      if (boatStep(this, dt)) { this.s = STOPS[this.target].s; this.arrive(pl); }   // 行船 + 过闸逻辑在 fz-river.js（单测按同一套算单程时间）
      const st1 = this.lk ? this.lk.st : null;
      if (st1 !== st0) this.log.push({ t: +this.t.toFixed(1), ev: 'lock', st: st1 || 'out', s: +this.s.toFixed(1), lvl: +LOCK_STATE.lvl.toFixed(2) });
      if (this.lkEv === 'enter' && this.passengerSeated(pl)) say(fzBoatLockSegs(), { key: 'boat', interrupt: true });
    }
    if (LOCK && this.phase === 'dock') boatStep(this, dt);   // 停靠时闸门也自己关上
    this.place(dt);
  }
  info() { return { holdTerm: !!this.holdTerm, phase: this.phase, i: this.i, at: STOPS[this.i].id, target: STOPS[this.target].id, s: +this.s.toFixed(2), v: +this.v.toFixed(2), dir: this.dir, seatsFree: this.seats.filter(s => s.free).length, stats: { ...this.stats, maxStep: +this.stats.maxStep.toFixed(3), maxYawStep: +this.stats.maxYawStep.toFixed(4) }, log: this.log.slice(-12), lock: LOCK ? { st: this.lk ? this.lk.st : null, gU: +LOCK_STATE.gU.toFixed(2), gD: +LOCK_STATE.gD.toFixed(2), lvl: +LOCK_STATE.lvl.toFixed(3), y0: +this.y0.toFixed(3) } : null, x: +this.node.position.x.toFixed(2), z: +this.node.position.z.toFixed(2) }; }
  dispose() { this.kit.dispose(); this.node.dispose(); }
}
