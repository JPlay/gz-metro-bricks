/*
 * 厦门地铁运营：和广州 Metro（js/game/service.js）同一套状态机，跑在 XO 区域、用 XM_LINES。
 * 列车复用 Train 类（net='xm' 涂装 + 线路图）；隧道仍在 y=-300。
 * 国铁厦门北站付费区进站后由 EastCtl 把控制权交给这里。
 */
import { Train, HALF } from '../world/train.js';
import { Geo, hex } from '../core/geo.js';
import { mats } from '../core/mats.js';
import { XM_LINES, xmNext, xmDirFor } from '../data/xm-lines.js';
import { XmStation, XM_PY, XM_NET, exitList } from '../world/xmMetro.js';
import { XmStreet, XM_EXITS, XS } from '../world/xmStreet.js';
import { XO } from '../world/xmn.js';
import * as Ann from '../audio/announcements.js';
import { xmExitSegs, xmDepartSegs } from '../data/phrases.js';
import { cruiseDone } from './service.js';
const B = window.BABYLON;
const TUN_Y = -300, ARR_T = 9, D0 = 100, VMAX = 22;
/** 城市地铁描述（厦门默认）：福州传自己的一份（js/game/fzService.js）。状态机、隧道、出站 / 回国铁流程两城共用 */
export const XM_SVC = {
  N: XM_NET, net: 'xm', ev: 'xm', ids: [10, 11],
  station: (scene, code) => new XmStation(scene, code),
  street: (scene, code) => new XmStreet(scene, code),
  next: xmNext,
  ann: { platform: Ann.xmPlatform, depart: Ann.xmDepart, arrive: Ann.arrive, welcome: Ann.welcome, exit: Ann.xmExit },
  exitSegs: xmExitSegs, departSegs: xmDepartSegs,
  /** 这个站能不能从站厅出口走到街区（厦门北没有出口街区：XM_EXITS 里本来就没有 xmnb） */
  streetAt: code => !!XM_EXITS[code],
};

export class XmMetro {
  constructor(scene, ctx, S = XM_SVC) {
    this.scene = scene; this.ctx = ctx; // { player, Audio, events, onTunnel, getRailway }
    this.S = S; this.N = S.N; this.net = S.net;
    this.dirKey = (line, step) => Object.keys(this.N.LINES[line].dirs).find(d => this.N.LINES[line].dirs[d].step === step);
    this.trains = S.ids.map(i => this.makeTrain(i));
    this.slots = []; this.ride = null; this.legs = 0; this.station = null; this.code = null;
    this.buildTunnel();
  }
  makeTrain(i) {
    const t = new Train(this.scene, i); t.net = this.net; t.setVisible(false);
    t.root.getChildMeshes(false).forEach(m => { m.layerMask = 0x10000000; });
    (t.pax || []).forEach(({ p }) => { if (p && p.mesh) p.mesh.setEnabled(false); });  // 少乘客省 draw
    if (this.ctx.onNewTrain) this.ctx.onNewTrain(t);
    return t;
  }
  buildTunnel() {
    const M = mats(this.scene), g = new Geo(), gl = new Geo(), root = this.tunnel = new B.TransformNode(this.net + 'RideTunnel', this.scene);
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
    const st = this.S.station(this.scene, code);
    this.station = st; this.code = code;
    this.attach(st);
    // 离开厦门北站台时关掉国铁站房；回到厦门北再打开
    const rail = this.ctx.getRailway && this.ctx.getRailway();
    if (rail) {
      if (code === this.N.rail) {
        rail.show('solo');
        // 国铁站房只在人走在楼梯 / 换乘通道西段时打开（east.js 每帧按位置切）；solo（动车外观、远景）关掉省 draw
        const pp = this.ctx.player && this.ctx.player.position, near = !!pp && (pp.x - this.N.O.x) < -60 && pp.y > XM_PY - 1 && pp.y < -5 && Math.abs(pp.z + 80) < 14;
        if (rail.station) rail.station.setEnabled(!!near);
        if (rail.solo && rail.solo.root) rail.solo.root.setEnabled(false);
      } else { rail.show(null); }
    }
    this.ctx.events.emit(this.S.ev, { code, station: st.info() });
    return st;
  }
  attach(station) {
    this.station = station; this.slots = []; this.exitWait = null; this.lvY = null;
    const free = this.trains.filter(t => !this.ride || t !== this.ride.train);
    free.forEach(t => t.setVisible(false));
    let rideSlot = null;
    for (const P of station.platforms) for (const side of Object.values(P.sides)) {
      const slot = { P, side, line: P.line, step: side.step, state: 'away', t: 2 + Math.random() * 6, train: null, u: 0, f: 0, ann: false };
      if (this.ride && this.ride.line === P.line && this.ride.step === side.step) { slot.train = this.ride.train; this.ride.slot = rideSlot = slot; }
      else slot.train = free.shift() || (this.trains.push(this.makeTrain(this.S.ids[0] + this.trains.length)), this.trains[this.trains.length - 1]);   // 吕厝 4 个站台侧：按需补车
      this.slots.push(slot);
    }
    // 终点站是侧式单边站台（镇海路：只有往岩内方向那一侧 B，step -1）：开过来的车（step +1）没有同方向的槽位。
    // 以前 ride.slot 还指着上一站的旧槽位 → exitTunnel 把一个已不在 this.slots 里的槽位设成 arriving，再也没人推进它
    // → 列车永远“进站中”、不开门、下不了车。现在：同线路找不到同方向槽位时，借这条线的站台槽位终到（车从 -x 开进来停在这一侧），
    // 乘客下车后清客开走；下一班再按这一侧本来的方向（side.step）进站。
    if (this.ride && !rideSlot) {
      const slot = this.slots.find(o => o.line === this.ride.line);
      if (slot) { if (slot.train && slot.train !== this.ride.train) { slot.train.setVisible(false); this.trains.includes(slot.train) || this.trains.push(slot.train); } slot.train = this.ride.train; slot.step = this.ride.step; this.ride.slot = slot; }
    }
    this.slots.forEach((s, i) => { if (s.state === 'away') s.t = 2 + i * 2.5; });
  }
  playerOn(train) { return train.contains(this.ctx.player.position); }
  setX(slot, x) {
    // 列车世界 x = XO.x + 局部 x；站台 root 已在 XO
    const t = slot.train; t.setPos(this.N.O.x + x, slot.P.y, slot.side.trackZ);
  }
  doors(slot, f) { slot.f = f; slot.train.setDoors(slot.side.doorSg, f); this.station.setPSD(slot.side, f); }
  update(dt) {
    if (!this.station) return;
    const p = this.ctx.player.position, A = this.ctx.Audio, seated = !!this.ctx.player.seat;
    if (this.street) { if (this.street.update(this.ctx.player) === 'back') this.backFromStreet(); return; }
    if (this.ride && this.ride.phase === 'cruise') return this.cruise(dt);
    { const p = this.ctx.player.position; if (!this.ride && p.z < -35.2 && p.y > -1 && this.S.streetAt(this.code)) { const ex = exitList(this.N.EXITS[this.code]).find(e => Math.abs(p.x - this.N.O.x - e.x) < 2.4); if (ex) { this.goStreet(ex); return; } } }
    let sound = null;
    const inCar = this.slots.some(o => o.train.root.isEnabled() && this.playerOn(o.train));
    const multi = this.station.platforms.length > 1;
    // 叠层换乘站：玩家算在哪一层（离哪层站台面近；换乘楼梯半中间留 ±0.6 m 回差，不在两层之间来回闪）
    if (multi) { const ys = [...new Set(this.station.platforms.map(q => q.y))], d = y => Math.abs(p.y - y);
      if (!ys.includes(this.lvY) || ys.some(y => d(y) < d(this.lvY) - 1.2)) this.lvY = ys.reduce((a, y) => d(y) < d(a) ? y : a, ys[0]); }
    for (const s of this.slots) {
      if (s.state === 'away' && s.step !== s.side.step) s.step = s.side.step;   // 借来终到的槽位（见 attach）：清客开走后恢复这一侧本来的方向
      const tr = s.train, nx = this.S.next(s.line, this.code, s.step);
      const aboard = this.playerOn(tr), onPlat = !inCar && this.ctx.zone && this.ctx.zone.kind === 'platform' && this.ctx.zone.P === s.P;
      // 人在车上、车停在这一站：先把下一段景点出口广播的 MP3 下载、解码好（同广州 service.js）
      if (aboard && nx && s.pre !== s.step && s.state !== 'away' && s.state !== 'departing') { s.pre = s.step; this.preloadNext(s, nx); }
      s.t -= dt;
      // 坐在车里时对面那趟车先不进站（iPad 预算：车厢里 ≤50 draws）
      if (inCar && !aboard) {
        if (s.state === 'arriving' || s.state === 'away') { if (tr.root.isEnabled()) tr.setVisible(false); s.state = 'away'; s.t = Math.max(s.t, 3); continue; }
      }
      switch (s.state) {
        case 'away':
          if (s.t <= 0) {
            s.state = 'arriving'; s.u = 0; tr.setLine(s.line, this.net); tr.setMap(s.line, this.code, s.step, nx); tr.setDoors(1, 0); tr.setDoors(-1, 0);
            tr.setVisible(true); this.setX(s, -D0 * s.step);
            if (onPlat) { this.S.ann.platform(s.line, this.dirKey(s.line, s.step), s.side.n); A.sfx('train.approach', { volume: 0.8 }); }
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
          const ew = this.exitWait && this.exitWait.slot === s ? this.exitWait : null;
          if (!hold) s.t = Math.min(s.t, ew && ew.release ? 3.1 + Ann.EXIT_MARGIN : 3.5);
          // 刚从这列车下来、出口广播（“前往××的乘客，请从×出口出站”）还在播：关门提示（interrupt）和关门都等它播完 + EXIT_MARGIN 秒；
          // 播放期间最多多停 EXIT_CAP 秒（游戏时间）。没有出口广播的站 exitWait 为空 → 停站时长照旧
          if (ew) {
            ew.el += dt;
            if (!ew.done && ew.el < Ann.EXIT_CAP) s.t = Math.max(s.t, 3.5 + Ann.EXIT_MARGIN);
            else { if (!ew.doneAt) ew.doneAt = performance.now(); if (!ew.release) { ew.release = true; s.t = Math.max(s.t, 3.1 + Ann.EXIT_MARGIN); } }
          }
          if (!s.ann && s.t < 3.1 && (aboard || onPlat) && !terminalHold) { s.ann = true; (this.S.ann.doorsClosing || Ann.doorsClosing)(); A.sfx('doorChime'); }
          if (s.t <= 0 && !hold) { s.state = 'closing'; s.t = 1.4; if (ew) { this.lastExit = { ...this.exitInfo(), closeAt: Math.round(performance.now() - ew.t0) }; this.exitWait = null; } }
          break;
        }
        case 'closing': this.doors(s, Math.max(0, s.t) / 1.4); if (s.t <= 0) {
          s.state = 'departing'; s.u = 0;
          if (aboard && nx) {
            this.legs++; const dk = this.dirKey(s.line, s.step), wd = this.legs === 1 || this.ride?.line !== s.line;
            this.S.ann.depart(s.line, nx, dk, s.step, wd); A.sfx('train.tractionStart', { volume: 0.7 });
            // 下一站有景点出口广播：行车等整段广播播完再进站（同广州 service.js cruiseDone）；其它站 hold=0 不变
            const hold = Ann.departHold(this.S.departSegs(s.line, nx, dk, s.step, wd));
            this.ride = { train: tr, line: s.line, step: s.step, phase: 'out', slot: s, next: nx, hold, el: 0, from: this.code };
          }
          else if (!nx && aboard) { /* 终点：门再开 */ s.state = 'opening'; s.t = 1.2; }
        } break;
        case 'departing': {
          s.u = Math.min(1, s.u + dt / 8); const x = D0 * s.step * s.u * s.u;
          this.move(s, x); sound = this.louder(sound, { speed: s.u * 0.9, inside: aboard, braking: false });
          if (aboard && this.ride && this.ride.train === tr) this.ride.el += dt;
          if (aboard && nx && Math.abs(x) >= 80) { this.enterTunnel(s, nx); return; }
          if (s.u >= 1) { s.state = 'away'; s.t = 8 + Math.random() * 10; tr.setVisible(false); if (this.ride && this.ride.train === tr && !aboard) this.alighted(); }
          break;
        }
      }
      if (this.ride && this.ride.train === tr && !aboard && s.state !== 'departing' && s.state !== 'arriving') this.alighted();
      // 叠层换乘站：只画玩家所在那一层的列车（另一层隔着楼板看不见，省 draw）
      //（以前是 |p.y - P.y| < 5：东街口 / 帝封江换乘楼梯半中间两层都算“近”，四趟车一起画 —— 61 draws / 124k tris）
      if (multi && s.state !== 'away') { const near = aboard || (s.P.y === this.lvY && Math.abs(p.y - s.P.y) < 5); if (tr.root.isEnabled() !== near) tr.setVisible(near); }
    }
    if (sound) A.trainSound(sound); else if (!(this.ride && this.ride.phase === 'cruise')) A.trainSound({ speed: 0 });
  }
  /** 下车了：有景点出口的站再播一句“前往××的乘客，请从N号出口出站”（每到一次站播一次） */
  alighted() {
    const from = this.ride; this.ride = null;
    const segs = this.S.exitSegs(this.code);
    if (from && this.guided !== this.code && segs.length) {
      this.guided = this.code;
      const s = from.slot, ew = this.exitWait = s && (s.state === 'dwell' || s.state === 'opening') ? { code: this.code, slot: s, dur: +Ann.seconds(segs).toFixed(2), t0: performance.now(), el: 0, done: false, doneAt: 0, release: false } : null;
      if (ew && s.state === 'dwell') s.t = Math.max(s.t, 3.5 + Ann.EXIT_MARGIN);   // 同一帧里关门提示不能先抢播
      Promise.resolve(this.S.ann.exit(this.code)).then(() => { if (ew) { ew.done = true; ew.doneAt = ew.doneAt || performance.now(); } });
    }
  }
  exitInfo() { const e = this.exitWait; return e ? { code: e.code, dur: e.dur, el: +e.el.toFixed(2), done: e.done, doneAt: e.doneAt ? Math.round(e.doneAt - e.t0) : null } : null; }
  move(s, x) {
    const tr = s.train, pl = this.ctx.player, aboard = this.playerOn(tr);
    const prev = tr.root.position.x, worldX = this.N.O.x + x; tr.setPos(worldX, s.P.y, s.side.trackZ); this.refresh(tr);
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
    this.ctx.events.emit('ride', { phase: 'cruise', from: this.ride.from, to: nx, line: s.line, net: this.net });
  }
  cruise(dt) {
    const r = this.ride, A = this.ctx.Audio; r.t += dt;
    const step = r.step;
    for (const l of this.lamps) { l.position.x -= step * VMAX * dt; if (l.position.x < -90) l.position.x += 180; if (l.position.x > 90) l.position.x -= 180; }
    A.trainSound({ speed: 1, inside: true, braking: false });
    if (cruiseDone(r, A.isAnnouncing(), r.hold > 0 && Ann.visitLeft())) this.exitTunnel();
  }
  preloadNext(s, nx) {
    const ids = Ann.prefetchDepart(this.S.departSegs(s.line, nx, this.dirKey(s.line, s.step), s.step, this.legs === 0 || this.ride?.line !== s.line));
    const exitIds = Ann.prefetchSegs(this.S.exitSegs(nx));   // 下一站下车的出口广播也提前一站预载
    if (ids.length || exitIds.length) this.preload = { at: this.code, next: nx, ids, exitIds };
  }
  exitTunnel() {
    const r = this.ride, tr = r.train, pl = this.ctx.player, s = r.slot;
    this.lastLeg = { from: r.from, to: this.code, hold: +(r.hold || 0).toFixed(2), out: +(r.el || 0).toFixed(2), cruise: +r.t.toFixed(2), total: +((r.el || 0) + r.t).toFixed(2), ext: !!r.hold && r.t > Math.max(14, r.hold - (r.el || 0) + 6) };
    const off = pl.position.subtract(tr.root.position);
    s.state = 'arriving'; s.u = 1 - Math.sqrt(0.8);
    tr.setLine(r.line, this.net); tr.setMap(r.line, this.code, r.step, this.S.next(r.line, this.code, r.step));
    const x = -D0 * r.step * (1 - s.u) ** 2;
    tr.setPos(this.N.O.x + x, s.P.y, s.side.trackZ); this.refresh(tr);
    pl.position.copyFrom(tr.root.position.add(off)); pl.collider.computeWorldMatrix(true);
    this.tunnel.setEnabled(false); r.phase = 'in';
    this.ctx.onTunnel(false);
    this.S.ann.arrive(this.code); this.ctx.Audio.sfx('train.brake', { volume: 0.5 });
    this.ctx.events.emit('ride', { phase: 'arrive', to: this.code, line: r.line, net: this.net });
  }
  /** 出站：关掉车站，加载出口外的街区（独立场景） */
  goStreet(ex = this.N.EXITS[this.code]) {
    const pl = this.ctx.player; this.streetEx = ex;
    this.station.kit.root.setEnabled(false); this.trains.forEach(t => t.setVisible(false));
    this.slots.forEach(s => { s.state = 'away'; s.t = 6 + Math.random() * 6; });
    this.street = this.S.street(this.scene, this.code, ex);
    const [x, y, z, yaw] = this.street.spawn(); pl.spawn(x, y, z, yaw);
    try { this.ctx.Audio.cancelAnnouncements(); this.ctx.Audio.trainSound({ speed: 0 }); } catch (_) {}
    this.ctx.events.emit(this.S.ev, { street: true, code: this.code });
  }
  backFromStreet() {
    const pl = this.ctx.player, ex = this.streetEx || this.N.EXITS[this.code];
    this.street.dispose(); this.street = null;
    this.station.kit.root.setEnabled(true);
    pl.spawn(this.N.O.x + ex.x, 0.05, -34.4, 0);
    this.ctx.events.emit(this.S.ev, { street: false, code: this.code });
  }
  // 走楼梯回国铁时，同一帧里 main 先算了 inXm 再由 east.update 拆站：station 可能已为 null
  zoneOf(p) { return this.street ? this.street.zoneOf(p) : this.station ? this.station.zoneOf(p) : { kind: 'xmn', area: 'passage' }; }
  /** 从国铁付费区进入厦门北站地铁站台 */
  enterFromRailway(player) {
    const rc = this.N.rail;
    this.buildStation(rc);
    const P = this.station.platformFor(1) || this.station.platforms[0];
    player.spawn(this.N.O.x - 20, P.y + 0.05, P.zc + 1.5, Math.PI);
    this.S.ann.welcome(rc);
    this.ctx.events.emit(this.S.ev, { enter: true, code: rc });
  }
  /** 走楼梯下来：只建站，不动人（人正踩在楼梯上） */
  enterWalk() {
    const rc = this.N.rail;
    this.buildStation(rc);
    this.S.ann.welcome(rc);
    this.ctx.events.emit(this.S.ev, { enter: true, code: rc, walk: true });
  }
  exitToRailway(player, walk = false) {
    // 回到国铁出站层换乘通道
    const rail = this.ctx.getRailway && this.ctx.getRailway();
    if (rail) rail.show('solo');
    if (this.station) { this.station.dispose(); this.station = null; this.code = null; this.slots = []; }
    this.trains.forEach(t => t.setVisible(false));
    if (!walk) player.spawn(this.N.O.x - 92, -6.45, -80, Math.PI / 2);
    this.ctx.events.emit(this.S.ev, { enter: false, walk });
  }
  louder(a, b) { if (!a) return b; return { speed: Math.max(a.speed, b.speed), inside: a.inside || b.inside, braking: a.braking || b.braking }; }
  call(line, step) { const s = this.slots.find(o => o.line === line && o.step === step); if (s && s.state === 'away') s.t = 0; return !!s; }
  info() {
    return { code: this.code, ride: this.ride ? { phase: this.ride.phase, line: this.ride.line, step: this.ride.step, next: this.ride.next, hold: this.ride.hold, el: this.ride.el, t: this.ride.t } : null, lastLeg: this.lastLeg || null, preload: this.preload || null, exitWait: this.exitInfo(), lastExit: this.lastExit || null,
      slots: this.slots.map(s => ({ line: s.line, side: s.side.key, step: s.step, state: s.state, t: +s.t.toFixed(1), x: +(s.train.root.position.x - this.N.O.x).toFixed(1), doors: +s.f.toFixed(2) })),
      station: this.station ? this.station.info() : null, street: this.street ? this.street.info() : null };
  }
}
