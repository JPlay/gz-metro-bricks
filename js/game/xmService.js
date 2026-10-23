/*
 * 厦门地铁运营：和广州 Metro（js/game/service.js）同一套状态机，跑在 XO 区域、用 XM_LINES。
 * 列车复用 Train 类（net='xm' 涂装 + 线路图）；隧道仍在 y=-300。
 * 国铁厦门北站付费区进站后由 EastCtl 把控制权交给这里。
 */
import { Train, HALF } from '../world/train.js';
import { Geo, hex } from '../core/geo.js';
import { mats } from '../core/mats.js';
import { XM_LINES, xmNext, xmDirFor } from '../data/xm-lines.js';
import { XmStation, XM_PY } from '../world/xmMetro.js';
import { XmStreet, XM_EXITS, XS } from '../world/xmStreet.js';
import { XO } from '../world/xmn.js';
import * as Ann from '../audio/announcements.js';
const B = window.BABYLON;
const TUN_Y = -300, ARR_T = 9, D0 = 100, VMAX = 22;
const dirKey = (line, step) => Object.keys(XM_LINES[line].dirs).find(d => XM_LINES[line].dirs[d].step === step);

export class XmMetro {
  constructor(scene, ctx) {
    this.scene = scene; this.ctx = ctx; // { player, Audio, events, onTunnel, getRailway }
    this.trains = [10, 11].map(i => this.makeTrain(i));
    this.slots = []; this.ride = null; this.legs = 0; this.station = null; this.code = null;
    this.buildTunnel();
  }
  makeTrain(i) {
    const t = new Train(this.scene, i); t.net = 'xm'; t.setVisible(false);
    t.root.getChildMeshes(false).forEach(m => { m.layerMask = 0x10000000; });
    (t.pax || []).forEach(({ p }) => { if (p && p.mesh) p.mesh.setEnabled(false); });  // 少乘客省 draw
    if (this.ctx.onNewTrain) this.ctx.onNewTrain(t);
    return t;
  }
  buildTunnel() {
    const M = mats(this.scene), g = new Geo(), gl = new Geo(), root = this.tunnel = new B.TransformNode('xmRideTunnel', this.scene);
    g.slab(-90, 90, -1.75, -1.35, -2.6, 2.6, hex('#4A5260'));
    for (const z of [-0.72, 0.72]) g.slab(-90, 90, -1.35, -1.2, z - 0.05, z + 0.05, hex('#B8C0C8'));
    for (const s of [-1, 1]) g.slab(-90, 90, -1.75, 3.6, s * 2.3, s * 2.6, hex('#596170'));
    g.slab(-90, 90, 3.6, 3.9, -2.6, 2.6, hex('#596170'));
    const m1 = g.toMesh('xmTunWalls', this.scene, M.solid, root);
    gl.box(0, 2.6, 0, 0.9, 0.14, 0.05, hex('#FFE9A8'));
    const lamp = gl.toMesh('xmTunLamp', this.scene, M.glow, root); lamp.isVisible = false;
    this.lamps = [];
    for (let i = 0; i < 24; i++) for (const s of [-1, 1]) { const l = lamp.createInstance('xtl'); l.parent = root; l.position.set(-90 + i * 7.5 + (s > 0 ? 3.7 : 0), 0, s * 2.27); this.lamps.push(l); }
    root.position.y = TUN_Y; root.setEnabled(false); m1.isPickable = false;
  }
  buildStation(code) {
    if (this.street) { this.street.dispose(); this.street = null; }
    if (this.station) this.station.dispose();
    const st = new XmStation(this.scene, code);
    this.station = st; this.code = code;
    this.attach(st);
    // 离开厦门北站台时关掉国铁站房；回到厦门北再打开
    const rail = this.ctx.getRailway && this.ctx.getRailway();
    if (rail) {
      if (code === 'xmnb') {
        rail.show('solo');
        if (rail.station) rail.station.setEnabled(false);
        if (rail.solo && rail.solo.root) rail.solo.root.setEnabled(false);
      } else { rail.show(null); }
    }
    this.ctx.events.emit('xm', { code, station: st.info() });
    return st;
  }
  attach(station) {
    this.station = station; this.slots = [];
    const free = this.trains.filter(t => !this.ride || t !== this.ride.train);
    free.forEach(t => t.setVisible(false));
    for (const P of station.platforms) for (const side of Object.values(P.sides)) {
      const slot = { P, side, line: P.line, step: side.step, state: 'away', t: 2 + Math.random() * 6, train: null, u: 0, f: 0, ann: false };
      if (this.ride && this.ride.line === P.line && this.ride.step === side.step) { slot.train = this.ride.train; this.ride.slot = slot; }
      else slot.train = free.shift() || (this.trains.push(this.makeTrain(10 + this.trains.length)), this.trains[this.trains.length - 1]);   // 吕厝 4 个站台侧：按需补车
      this.slots.push(slot);
    }
    this.slots.forEach((s, i) => { if (s.state === 'away') s.t = 2 + i * 2.5; });
  }
  playerOn(train) { return train.contains(this.ctx.player.position); }
  setX(slot, x) {
    // 列车世界 x = XO.x + 局部 x；站台 root 已在 XO
    const t = slot.train; t.setPos(XO.x + x, slot.P.y, slot.side.trackZ);
  }
  doors(slot, f) { slot.f = f; slot.train.setDoors(slot.side.doorSg, f); this.station.setPSD(slot.side, f); }
  update(dt) {
    if (!this.station) return;
    const p = this.ctx.player.position, A = this.ctx.Audio, seated = !!this.ctx.player.seat;
    if (this.street) { if (this.street.update(this.ctx.player) === 'back') this.backFromStreet(); return; }
    if (this.ride && this.ride.phase === 'cruise') return this.cruise(dt);
    { const ex = XM_EXITS[this.code], p = this.ctx.player.position; if (ex && !this.ride && p.z < -35.2 && p.y > -1 && Math.abs(p.x - XO.x - ex.x) < 2.4) { this.goStreet(); return; } }
    let sound = null;
    const inCar = this.slots.some(o => o.train.root.isEnabled() && this.playerOn(o.train));
    const multi = this.station.platforms.length > 1;
    for (const s of this.slots) {
      const tr = s.train, nx = xmNext(s.line, this.code, s.step);
      const aboard = this.playerOn(tr), onPlat = !inCar && this.ctx.zone && this.ctx.zone.kind === 'platform' && this.ctx.zone.P === s.P;
      s.t -= dt;
      // 坐在车里时对面那趟车先不进站（iPad 预算：车厢里 ≤50 draws）
      if (inCar && !aboard) {
        if (s.state === 'arriving' || s.state === 'away') { if (tr.root.isEnabled()) tr.setVisible(false); s.state = 'away'; s.t = Math.max(s.t, 3); continue; }
      }
      switch (s.state) {
        case 'away':
          if (s.t <= 0) {
            s.state = 'arriving'; s.u = 0; tr.setLine(s.line, 'xm'); tr.setMap(s.line, this.code, s.step, nx); tr.setDoors(1, 0); tr.setDoors(-1, 0);
            tr.setVisible(true); this.setX(s, -D0 * s.step);
            if (onPlat) { Ann.xmPlatform(s.line, dirKey(s.line, s.step), s.side.n); A.sfx('train.approach', { volume: 0.8 }); }
          }
          break;
        case 'arriving': {
          s.u = Math.min(1, s.u + dt / ARR_T); const x = -D0 * s.step * (1 - s.u) ** 2;
          this.move(s, x); sound = this.louder(sound, { speed: (1 - s.u) * 0.9, inside: aboard, braking: true });
          if (s.u >= 1) { s.state = 'opening'; s.t = 1.2; A.sfx('doorChime'); A.sfx('psdOpen', { volume: 0.7 }); A.sfx('doorOpen'); if (aboard) A.sfx('train.airRelease', { volume: 0.6 }); }
          break;
        }
        case 'opening': this.doors(s, 1 - Math.max(0, s.t) / 1.2); if (s.t <= 0) { s.state = 'dwell'; s.t = 10; s.ann = false; } break;
        case 'dwell': {
          this.doors(s, 1);
          const terminalHold = !nx && aboard, hold = terminalHold || (!seated && tr.inDoorway(p));
          if (!hold) s.t = Math.min(s.t, 3.5);
          if (!s.ann && s.t < 3.1 && (aboard || onPlat) && !terminalHold) { s.ann = true; Ann.doorsClosing(); A.sfx('doorChime'); }
          if (s.t <= 0 && !hold) { s.state = 'closing'; s.t = 1.4; }
          break;
        }
        case 'closing': this.doors(s, Math.max(0, s.t) / 1.4); if (s.t <= 0) {
          s.state = 'departing'; s.u = 0;
          if (aboard && nx) { this.legs++; Ann.xmDepart(s.line, nx, dirKey(s.line, s.step), s.step, this.legs === 1 || this.ride?.line !== s.line); A.sfx('train.tractionStart', { volume: 0.7 }); this.ride = { train: tr, line: s.line, step: s.step, phase: 'out', slot: s, next: nx }; }
          else if (!nx && aboard) { /* 终点：门再开 */ s.state = 'opening'; s.t = 1.2; }
        } break;
        case 'departing': {
          s.u = Math.min(1, s.u + dt / 8); const x = D0 * s.step * s.u * s.u;
          this.move(s, x); sound = this.louder(sound, { speed: s.u * 0.9, inside: aboard, braking: false });
          if (aboard && nx && Math.abs(x) >= 80) { this.enterTunnel(s, nx); return; }
          if (s.u >= 1) { s.state = 'away'; s.t = 8 + Math.random() * 10; tr.setVisible(false); if (this.ride && this.ride.train === tr && !aboard) this.ride = null; }
          break;
        }
      }
      if (this.ride && this.ride.train === tr && !aboard && s.state !== 'departing' && s.state !== 'arriving') this.ride = null;
      // 叠层换乘站：只画玩家所在那一层的列车（另一层隔着楼板看不见，省 draw）
      if (multi && s.state !== 'away') { const near = aboard || Math.abs(p.y - s.P.y) < 5; if (tr.root.isEnabled() !== near) tr.setVisible(near); }
    }
    if (sound) A.trainSound(sound); else if (!(this.ride && this.ride.phase === 'cruise')) A.trainSound({ speed: 0 });
  }
  move(s, x) {
    const tr = s.train, pl = this.ctx.player, aboard = this.playerOn(tr);
    const prev = tr.root.position.x, worldX = XO.x + x; tr.setPos(worldX, s.P.y, s.side.trackZ); this.refresh(tr);
    if (aboard) pl.position.x += worldX - prev;
  }
  refresh(tr) { tr.root.computeWorldMatrix(true); tr.kit.colliders.forEach(c => c.computeWorldMatrix(true)); }
  enterTunnel(s, nx) {
    const tr = s.train, pl = this.ctx.player, off = pl.position.subtract(tr.root.position);
    this.ride.phase = 'cruise'; this.ride.t = 0; this.ride.off = off; this.ride.from = this.code;
    tr.setPos(0, TUN_Y, 0); this.refresh(tr); pl.position.copyFrom(tr.root.position.add(off)); pl.collider.computeWorldMatrix(true);
    this.tunnel.setEnabled(true);
    this.slots.forEach(o => { if (o.train !== tr) o.train.setVisible(false); });
    this.ctx.onTunnel(true);
    this.buildStation(nx);
    this.ctx.events.emit('ride', { phase: 'cruise', from: this.ride.from, to: nx, line: s.line, net: 'xm' });
  }
  cruise(dt) {
    const r = this.ride, A = this.ctx.Audio; r.t += dt;
    const step = r.step;
    for (const l of this.lamps) { l.position.x -= step * VMAX * dt; if (l.position.x < -90) l.position.x += 180; if (l.position.x > 90) l.position.x -= 180; }
    A.trainSound({ speed: 1, inside: true, braking: false });
    if ((r.t > 5 && !A.isAnnouncing()) || r.t > 14) this.exitTunnel();
  }
  exitTunnel() {
    const r = this.ride, tr = r.train, pl = this.ctx.player, s = r.slot;
    const off = pl.position.subtract(tr.root.position);
    s.state = 'arriving'; s.u = 1 - Math.sqrt(0.8);
    tr.setLine(r.line, 'xm'); tr.setMap(r.line, this.code, r.step, xmNext(r.line, this.code, r.step));
    const x = -D0 * r.step * (1 - s.u) ** 2;
    tr.setPos(XO.x + x, s.P.y, s.side.trackZ); this.refresh(tr);
    pl.position.copyFrom(tr.root.position.add(off)); pl.collider.computeWorldMatrix(true);
    this.tunnel.setEnabled(false); r.phase = 'in';
    this.ctx.onTunnel(false);
    Ann.arrive(this.code); this.ctx.Audio.sfx('train.brake', { volume: 0.5 });
    this.ctx.events.emit('ride', { phase: 'arrive', to: this.code, line: r.line, net: 'xm' });
  }
  /** 出站：关掉车站，加载出口外的街区（独立场景） */
  goStreet() {
    const pl = this.ctx.player;
    this.station.kit.root.setEnabled(false); this.trains.forEach(t => t.setVisible(false));
    this.slots.forEach(s => { s.state = 'away'; s.t = 6 + Math.random() * 6; });
    this.street = new XmStreet(this.scene, this.code);
    const [x, y, z, yaw] = this.street.spawn(); pl.spawn(x, y, z, yaw);
    try { this.ctx.Audio.cancelAnnouncements(); this.ctx.Audio.trainSound({ speed: 0 }); } catch (_) {}
    this.ctx.events.emit('xm', { street: true, code: this.code });
  }
  backFromStreet() {
    const pl = this.ctx.player, ex = XM_EXITS[this.code];
    this.street.dispose(); this.street = null;
    this.station.kit.root.setEnabled(true);
    pl.spawn(XO.x + ex.x, 0.05, -34.4, 0);
    this.ctx.events.emit('xm', { street: false, code: this.code });
  }
  zoneOf(p) { return this.street ? this.street.zoneOf(p) : this.station.zoneOf(p); }
  /** 从国铁付费区进入厦门北站地铁站台 */
  enterFromRailway(player) {
    this.buildStation('xmnb');
    const P = this.station.platformFor(1) || this.station.platforms[0];
    player.spawn(XO.x - 20, P.y + 0.05, P.zc + 1.5, Math.PI);
    Ann.welcome('xmnb');
    this.ctx.events.emit('xm', { enter: true, code: 'xmnb' });
  }
  exitToRailway(player) {
    // 回到国铁出站层换乘通道
    const rail = this.ctx.getRailway && this.ctx.getRailway();
    if (rail) rail.show('solo');
    if (this.station) { this.station.dispose(); this.station = null; this.code = null; this.slots = []; }
    this.trains.forEach(t => t.setVisible(false));
    player.spawn(XO.x - 92, -6.45, -80, Math.PI / 2);
    this.ctx.events.emit('xm', { enter: false });
  }
  louder(a, b) { if (!a) return b; return { speed: Math.max(a.speed, b.speed), inside: a.inside || b.inside, braking: a.braking || b.braking }; }
  call(line, step) { const s = this.slots.find(o => o.line === line && o.step === step); if (s && s.state === 'away') s.t = 0; return !!s; }
  info() {
    return { code: this.code, ride: this.ride ? { phase: this.ride.phase, line: this.ride.line, step: this.ride.step, next: this.ride.next } : null,
      slots: this.slots.map(s => ({ line: s.line, side: s.side.key, step: s.step, state: s.state, t: +s.t.toFixed(1), x: +(s.train.root.position.x - XO.x).toFixed(1), doors: +s.f.toFixed(2) })),
      station: this.station ? this.station.info() : null, street: this.street ? this.street.info() : null };
  }
}
