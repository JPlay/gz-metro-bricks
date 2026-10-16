/*
 * 美食店玩法（明明爱吃）：走进店门 → 店内（共用一个内部模板，按店换颜色 / 装饰 / 招牌菜，进门时才搭）→
 *   ① 走到桌边「坐下」（沿用坐下动作）→ ②「点菜」大按钮 → 图片菜单 → ③ 菜端上桌（玩具菜从小变大）→
 *   ④ 吃一口：头顶冒出 😋“好好吃！”，坐着举起两只拳头“努力！” → ⑤ 小卡片介绍这道菜 + 美食护照盖章。
 *   美食护照（右上角「美食」）记住吃过哪几家（localStorage）；选了明明时，地图上有美食店的站会多一个小碗标。
 * 店内场景放在 (-600, -30, 0)：离车站很远（远裁剪面外），进店时把车站整块关掉，绘制调用只剩店里这几样。
 */
import { Kit } from '../world/kit.js';
import { hex, mix, Geo } from '../core/geo.js';
import { RESTAURANTS, DISHES, restaurantById } from './food-data.js';
import { FoodAtlas, paintBoard, paintPoster, paintIcon, paintVert, dishGeo, dishURL, mix2 } from './food-art.js';
import { networkLayout } from '../ui/netmap.js';
import { STATIONS } from '../data/lines.js';
import { pressable } from './input.js';
const B = window.BABYLON;
export const FO = { x: -600, y: -30, z: 0 };
const PKEY = 'gzmetro.foodPassport';
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');

/* ================= 店内（共用模板） ================= */
export class FoodInterior {
  constructor(scene, M, r) {
    this.scene = scene; this.r = r; const k = this.kit = new Kit(scene, 'food-int-' + r.id), O = FO;
    const P = k.solid, G = k.glow, atlas = this.atlas = new FoodAtlas(scene, 1024);
    const X0 = O.x - 5, X1 = O.x + 5, Z0 = -4.5, Z1 = 5.5, Y = O.y, HT = 3.4;
    const wall = hex(r.wall), acc = hex(r.accent), floor = hex(r.floor), floor2 = mix(floor, [1, 1, 1], 0.35), wood = hex('#7A4B2A');
    this.spawn = { x: O.x, y: Y + 0.05, z: Z0 + 1.1, yaw: 0 };
    // 地面：棋盘格地砖
    k.colSlab(X0 - 1, X1 + 1, Y - 0.6, Y, Z0 - 1, Z1 + 1);
    for (let i = 0; i < 10; i++) for (let j = 0; j < 10; j++) P.slab(X0 + i, X0 + i + 1, Y - 0.05, Y, Z0 + j, Z0 + j + 1, (i + j) % 2 ? floor : floor2, { ao: false });
    // 墙：下半截深色护墙板 + 上半截主色 + 一条点缀色腰线
    const wallSeg = (x0, x1, z0, z1) => { P.slab(x0, x1, Y, Y + 1.0, z0, z1, mix(acc, [0, 0, 0], 0.15), { ao: false }); P.slab(x0, x1, Y + 1.0, Y + HT, z0, z1, wall, { ao: false }); k.colSlab(x0, x1, Y, Y + HT, z0, z1); };
    wallSeg(X0 - 0.3, X0, Z0, Z1); wallSeg(X1, X1 + 0.3, Z0, Z1); wallSeg(X0 - 0.3, X1 + 0.3, Z1, Z1 + 0.3);
    wallSeg(X0 - 0.3, O.x - 0.9, Z0 - 0.3, Z0); wallSeg(O.x + 0.9, X1 + 0.3, Z0 - 0.3, Z0); P.slab(O.x - 0.9, O.x + 0.9, Y + 2.5, Y + HT, Z0 - 0.3, Z0, wall, { ao: false });
    for (const [x0, x1, z0, z1] of [[X0, X0 + 0.04, Z0, Z1], [X1 - 0.04, X1, Z0, Z1], [X0, X1, Z1 - 0.04, Z1], [X0, X1, Z0, Z0 + 0.04]]) P.slab(x0, x1, Y + 1.0, Y + 1.12, z0, z1, hex(mix2(r.accent, '#FFFFFF', 0.35)), { ao: false });
    // 出口：南墙的门（亮光）+ 绿色“出口”牌
    G.slab(O.x - 0.9, O.x + 0.9, Y, Y + 2.5, Z0 - 0.32, Z0 - 0.26, hex('#FFF6E0'));
    k.colSlab(O.x - 1.5, O.x + 1.5, Y, Y + 3, Z0 - 1.4, Z0 - 1.0);
    atlas.sign(O.x, Y + 2.85, Z0 + 0.02, 1.4, 0.45, 0, (c, pw, ph) => { c.fillStyle = '#1F7A3A'; c.fillRect(0, 0, pw, ph); c.fillStyle = '#fff'; c.font = `800 ${ph * 0.6}px sans-serif`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('出口 ↓', pw / 2, ph * 0.54); });
    // 天花 + 灯
    P.slab(X0, X1, Y + HT, Y + HT + 0.1, Z0, Z1, hex('#F7F3EA'), { ao: false });
    for (const x of [-2.5, 0, 2.5]) for (const z of [-1.5, 1.5, 4]) G.cyl(O.x + x, Y + HT - 0.02, z, 0.7, 0.03, hex('#FFF4DC'), 16);
    // 后面的柜台 + 柜台上一大份招牌菜（玩具菜放大 2 倍）
    P.slab(O.x - 3.4, O.x + 3.4, Y, Y + 1.0, 4.3, 5.1, acc, { aoTop: false }); P.slab(O.x - 3.5, O.x + 3.5, Y + 1.0, Y + 1.08, 4.2, 5.2, hex('#EDE6DA'), { ao: false }); k.colSlab(O.x - 3.5, O.x + 3.5, Y, Y + 1.2, 4.2, 5.2);
    P.merge(dishGeo(r.dish), B.Matrix.Compose(new B.Vector3(2.2, 2.2, 2.2), B.Quaternion.RotationYawPitchRoll(Math.PI, 0, 0), new B.Vector3(O.x + 1.6, Y + 1.08, 4.6)));
    P.merge(dishGeo(r.menu[1] || r.dish), B.Matrix.Compose(new B.Vector3(1.6, 1.6, 1.6), B.Quaternion.RotationYawPitchRoll(Math.PI, 0, 0), new B.Vector3(O.x - 1.8, Y + 1.08, 4.6)));
    // 后墙：店名大招牌 + 图片菜单板；左右墙：小知识海报 + 招牌菜大圆标
    const board = r.form === 'teahouse' ? 'plaque' : r.form === 'stall' ? 'lightbox' : 'lacquer';
    atlas.sign(O.x, Y + 2.6, Z1 - 0.06, 5.2, 1.1, Math.PI, paintBoard(r, board));
    atlas.sign(O.x - 4.95, Y + 2.1, 1.0, 2.6, 1.95, Math.PI / 2, paintPoster(r, { id: r.dish, ...DISHES[r.dish] }));
    atlas.sign(O.x + 4.95, Y + 2.15, 1.0, 1.5, 1.5, -Math.PI / 2, paintIcon(r.dish, r.accent));
    atlas.sign(O.x + 4.95, Y + 2.0, 3.6, 0.55, 1.7, -Math.PI / 2, paintVert(DISHES[r.dish].zh + '好味', r.sign.bg, r.sign.fg, r.sign.fg));
    // 店的样子：茶楼 = 木格屏风 + 红灯笼；骑楼 = 老花砖腰线 + 吊扇；档口 = 不锈钢台 + 红蓝塑料凳
    const lan = hex(r.lantern);
    if (r.form === 'teahouse') {
      for (const x of [-2.5, 0, 2.5]) for (const z of [-0.2, 2.6]) { G.ellipsoid(O.x + x, Y + 2.65, z, 0.45, 0.52, 0.45, lan, 2); P.cyl(O.x + x, Y + 2.95, z, 0.25, 0.06, hex('#E3B341'), 10); P.tube([O.x + x, Y + 2.97, z], [O.x + x, Y + HT, z], 0.02, hex('#E3B341'), 4); }
      for (const sx of [-1, 1]) { const x = O.x + sx * 4.9; for (let i = 0; i < 7; i++) P.slab(x - 0.04, x + 0.04, Y + 0.4, Y + 2.4, -3.8 + i * 0.25, -3.75 + i * 0.25, wood, { ao: false }); }
    } else if (r.form === 'qilou') {
      for (let i = 0; i < 20; i++) for (const z of [Z1 - 0.06]) P.slab(X0 + i * 0.5, X0 + i * 0.5 + 0.25, Y + 0.6, Y + 0.85, z - 0.01, z, (i % 2) ? hex('#2E6E8E') : hex('#E8C35A'), { ao: false });
      for (const z of [-0.2, 2.6]) { P.cyl(O.x, Y + HT - 0.25, z, 0.12, 0.5, hex('#3A3F45'), 8); for (let b = 0; b < 3; b++) P.box(O.x, Y + HT - 0.5, z, 1.4, 0.03, 0.22, hex('#5A3A22'), b * Math.PI / 3, 0, 0, 1, { ao: false }); G.sphere(O.x, Y + HT - 0.56, z, 0.22, lan, 1); }
    } else {
      P.slab(X0 + 0.05, X0 + 0.7, Y, Y + 0.95, 2.6, 5.4, hex('#C8CDD2'), { aoTop: false }); k.colSlab(X0, X0 + 0.7, Y, Y + 1.1, 2.6, 5.4);
      for (const z of [3.2, 4.6]) { P.cyl(X0 + 0.38, Y + 1.15, z, 0.5, 0.4, hex('#9AA2AA'), 14); G.sphere(X0 + 0.38, Y + 1.55, z, 0.3, hex('#F7FAFC'), 1); }
      for (const x of [-2.5, 0, 2.5]) G.cyl(O.x + x, Y + HT - 0.2, 1.2, 0.5, 0.25, lan, 12);
    }
    // 门口的地垫
    P.slab(O.x - 0.9, O.x + 0.9, Y, Y + 0.012, Z0, Z0 + 0.9, acc, { ao: false });
    k.finish(); atlas.finish(k.root, 'foodIntSigns');
    // 桌椅：一张桌子 + 两把椅子（东西两边面对面）做原型，thin instance 摆 4 套（一次绘制）
    this.seats = []; const tables = [[-2.3, -0.4], [2.3, -0.4], [-2.3, 2.3], [2.3, 2.3]];
    this.tableMesh = this.buildTables(M, tables);
    tables.forEach(([tx, tz], ti) => {
      k.col(O.x + tx, Y + 0.4, tz, 0.95, 0.8, 0.95);
      for (const sx of [-1, 1]) { const face = sx < 0 ? Math.PI / 2 : -Math.PI / 2; this.seats.push({ wx: O.x + tx + sx * 0.66, wy: Y, wz: tz, face, free: true, world: true, id: this.seats.length, table: ti, food: true, tx: O.x + tx, tz }); }
    });
    this.TOP = Y + 0.72;
    this.kit.root.setEnabled(false);
  }
  buildTables(M, tables) {
    const g = new Geo(), r = this.r, round = r.form === 'teahouse', o = { ao: false };
    const top = round ? hex('#F7F4EC') : r.form === 'stall' ? hex('#F2F2F0') : hex('#8A5A36'), leg = hex('#5A4636');
    if (round) { g.cyl(0, 0.7, 0, 1.08, 0.04, top, 24, 0, 0, 0, undefined, o); g.cyl(0, 0.6, 0, 1.12, 0.16, hex('#F1EDE2'), 24, 0, 0, 0, undefined, o); g.cyl(0, 0.35, 0, 0.1, 0.7, leg, 8); g.cyl(0, 0.03, 0, 0.6, 0.06, leg, 12); g.cyl(0, 0.725, 0, 0.42, 0.012, hex('#D9E4E0'), 20, 0, 0, 0, undefined, o); }
    else { g.slab(-0.5, 0.5, 0.68, 0.72, -0.5, 0.5, top, o); for (const [x, z] of [[-0.42, -0.42], [0.42, -0.42], [-0.42, 0.42], [0.42, 0.42]]) g.slab(x - 0.03, x + 0.03, 0, 0.68, z - 0.03, z + 0.03, leg, o); }
    const chair = hex(r.form === 'stall' ? '#E8505B' : r.form === 'teahouse' ? '#7A3B22' : r.accent);
    for (const sx of [-1, 1]) {
      const cx = sx * 0.66;
      if (r.form === 'stall') { g.cyl(cx, 0.21, 0, 0.36, 0.42, chair, 10, 0, 0, 0, 0.3, o); }
      else { g.slab(cx - 0.21, cx + 0.21, 0.4, 0.45, -0.21, 0.21, chair, o); g.slab(cx + sx * 0.18, cx + sx * 0.23, 0.45, 0.95, -0.21, 0.21, chair, o); for (const [x, z] of [[-0.17, -0.17], [0.17, -0.17], [-0.17, 0.17], [0.17, 0.17]]) g.slab(cx + x - 0.02, cx + x + 0.02, 0, 0.4, z - 0.02, z + 0.02, chair, o); }
    }
    if (round) { g.cyl(0.18, 0.79, -0.22, 0.14, 0.13, hex('#FFFFFF'), 12); g.cyl(0.18, 0.86, -0.22, 0.05, 0.02, hex('#FFFFFF'), 8); g.tube([0.26, 0.8, -0.22], [0.33, 0.86, -0.22], 0.025, hex('#FFFFFF'), 5); } // 茶壶
    const mesh = g.toMesh('foodTables', this.scene, M.paint, this.kit.root);
    const buf = new Float32Array(tables.length * 16), m = new B.Matrix();
    tables.forEach(([tx, tz], i) => { B.Matrix.TranslationToRef(FO.x + tx, FO.y, tz, m); m.copyToArray(buf, i * 16); });
    mesh.thinInstanceSetBuffer('matrix', buf, 16, true); mesh.thinInstanceRefreshBoundingInfo(false); mesh.isPickable = false; mesh.receiveShadows = true; mesh.freezeWorldMatrix();
    return mesh;
  }
  setEnabled(v) { this.kit.root.setEnabled(v); this.active = v; }
  update() {}
  wantsExit(p) { return p.z < -4.25 && Math.abs(p.x - FO.x) < 1.0; }
  seatNear(p) { let best = null, bd = 0.95; for (const s of this.seats) { if (!s.free || Math.abs(p.y - s.wy) > 1) continue; const d = Math.hypot(p.x - s.wx, p.z - s.wz); if (d < bd) { bd = d; best = s; } } return best; }
  info() { return { id: this.r.id, seats: this.seats.map(s => ({ x: +s.wx.toFixed(2), y: s.wy, z: +s.wz.toFixed(2), face: +s.face.toFixed(3), free: s.free })), active: !!this.active }; }
  dispose() { this.tableMesh.dispose(); this.atlas.dispose(); this.kit.dispose(); }
}

/* ================= 控制器 + 界面 ================= */
export class FoodCtl {
  constructor({ scene, cam, M, player, R, hud, seats, bubbles, Audio, events, getStation, getCode }) {
    Object.assign(this, { scene, cam, M, player, R, hud, seats, bubbles, Audio, events, getStation, getCode });
    this.cur = null; this.interior = null; this.meal = null; this.count = { enter: 0, order: 0, eat: 0, stamp: 0 };
    this.pass = this.loadPass();
    const origHall = seats.hall; seats.hall = () => (this.interior && this.interior.active ? this.interior : origHall ? origHall() : null);
    this.buildUI();
    scene.onBeforeRenderObservable.add(() => this.update(Math.min(0.25, scene.getEngine().getDeltaTime() / 1000)));
  }
  loadPass() { try { const v = JSON.parse(localStorage.getItem(PKEY) || '[]'); return Array.isArray(v) ? v.filter(id => restaurantById(id)) : []; } catch (_) { return []; } }
  savePass() { try { localStorage.setItem(PKEY, JSON.stringify(this.pass)); } catch (_) {} }
  /* —— 界面 —— */
  buildUI() {
    const hudEl = document.getElementById('hud');
    // 点菜大按钮（坐下以后出现，在「起身」左边）
    hudEl.insertAdjacentHTML('beforeend', `<button id="bOrder" class="btn big order" hidden aria-label="点菜"><span class="emo">📜</span><span class="lbl">点菜</span></button>`);
    pressable(this.orderBtn = document.getElementById('bOrder'), () => this.openMenu());
    // 右上角「美食」= 美食护照
    const btns = document.getElementById('btns');
    btns.insertAdjacentHTML('afterbegin', `<button id="bFood" class="btn glass" aria-label="美食护照"><span class="emo">🍜</span><span class="lbl">美食</span><i class="cnt"></i></button>`);
    pressable(document.getElementById('bFood'), () => this.passOpen ? this.closePass() : this.openPass());
    const mk = (id, html) => { const el = document.createElement('div'); el.id = id; el.hidden = true; el.className = 'foodsheet'; el.innerHTML = html; document.body.appendChild(el); ['pointerdown', 'pointermove', 'pointerup', 'touchstart', 'click'].forEach(t => el.addEventListener(t, e => e.stopPropagation())); return el; };
    this.menuEl = mk('foodMenu', `<div class="sheet glass"><header><b class="ttl"></b><small>点一下想吃的</small><button class="x" aria-label="关闭"><svg class="ico"><use href="#i-close"/></svg></button></header><div class="items"></div></div>`);
    pressable(this.menuEl.querySelector('.x'), () => this.closeMenu());
    this.cardEl = mk('foodCard', `<div class="sheet glass"><div class="stamp">已尝<br><small></small></div><img class="pic" alt=""><h2></h2><small class="en"></small><div class="fact"></div><div class="prog"></div><button class="ok">好耶！</button></div>`);
    pressable(this.cardEl.querySelector('.ok'), () => this.closeCard());
    this.passEl = mk('foodPass', `<div class="sheet glass"><header><b class="ttl">美食护照</b><small class="sub"></small><button class="x" aria-label="关闭"><svg class="ico"><use href="#i-close"/></svg></button></header><div class="grid"></div></div>`);
    pressable(this.passEl.querySelector('.x'), () => this.closePass());
    this.updateCount();
    // 地图：选了明明时，有美食店的站旁边多一个小碗
    const box = document.querySelector('#netmap .mapbox');
    if (box) new MutationObserver(() => this.decorateMap(box)).observe(box, { childList: true });
  }
  updateCount() { const c = document.querySelector('#bFood .cnt'); if (c) c.textContent = `${this.pass.length}/${RESTAURANTS.length}`; document.getElementById('bFood').classList.toggle('hl', this.player.charKind === 'mingming'); }
  onChar() { this.updateCount(); }
  decorateMap(box) {
    const svg = box.querySelector('svg.netmap'); if (!svg || svg.querySelector('.foodmk') || this.player.charKind !== 'mingming') return;
    const portrait = svg.viewBox.baseVal.width < 1200, { pos } = networkLayout(portrait);
    let s = '';
    for (const r of RESTAURANTS) { const p = pos[r.code]; if (!p) continue; const done = this.pass.includes(r.id), x = p[0] + 22, y = p[1] - 30;
      s += `<g class="foodmk"><circle cx="${x}" cy="${y}" r="17" fill="${done ? '#F5B841' : '#FFFFFF'}" stroke="#E07A2E" stroke-width="4"/><text x="${x}" y="${y + 7}" font-size="19" text-anchor="middle">🍜</text></g>`; }
    svg.insertAdjacentHTML('beforeend', s);
  }
  openMenu() {
    if (!this.cur || !this.player.seat) return;
    const r = this.cur.r; this.menuEl.querySelector('.ttl').textContent = `${r.name} · 菜单`;
    this.menuEl.querySelector('.items').innerHTML = r.menu.map(id => `<button class="item" data-id="${id}"><img src="${dishURL(id, 240, '#FFF6E6')}" alt=""><b>${esc(DISHES[id].zh)}</b><small>${esc(DISHES[id].en)}</small></button>`).join('');
    this.menuEl.querySelectorAll('.item').forEach(b => pressable(b, () => this.order(b.dataset.id)));
    this.menuEl.hidden = false; this.menuOpen = true; this.Audio.blip && this.Audio.blip('tap');
  }
  closeMenu() { this.menuEl.hidden = true; this.menuOpen = false; }
  /** 上菜：玩具菜放到他面前的桌上（从小变大）*/
  order(id) {
    this.closeMenu(); const seat = this.player.seat && this.player.seat.seat; if (!seat || !seat.food) return;
    this.clearDish();
    const g = dishGeo(id), mesh = g.toMesh('dish', this.scene, this.M.paint, this.interior.kit.root);
    const fx = Math.sin(seat.face), fz = Math.cos(seat.face);
    mesh.position.set(seat.wx + fx * 0.36, this.interior.TOP, seat.wz + fz * 0.36); mesh.rotation.y = seat.face + Math.PI; mesh.scaling.setAll(0.01); this.DS = 1.3;
    this.R.addShadowCaster && this.R.addShadowCaster(mesh);
    this.meal = { id, mesh, t: 0, phase: 'serve', seat, bite: false, card: false };
    this.count.order++; this.Audio.blip && this.Audio.blip('goal');
    this.events.emit('food', { order: id, shop: this.cur.r.id });
  }
  clearDish() { if (this.meal && this.meal.mesh) this.meal.mesh.dispose(); this.meal = null; }
  showCard() {
    const r = this.cur.r, id = this.meal.id, d = DISHES[id], first = !this.pass.includes(r.id);
    if (first) { this.pass.push(r.id); this.savePass(); this.count.stamp++; this.updateCount(); }
    const el = this.cardEl; el.querySelector('.pic').src = dishURL(id, 320, '#FFF6E6'); el.querySelector('h2').textContent = `好好吃！${d.zh}`; el.querySelector('.en').textContent = d.en;
    el.querySelector('.fact').textContent = d.fact; el.querySelector('.stamp small').textContent = r.name;
    el.querySelector('.prog').innerHTML = `<b>美食护照</b> ${this.pass.length} / ${RESTAURANTS.length} ${first ? '<span class="new">+1 盖章！</span>' : ''}`;
    el.classList.toggle('first', first); el.hidden = false; this.cardOpen = true;
    this.events.emit('food', { stamp: r.id, count: this.pass.length, first });
  }
  closeCard() { this.cardEl.hidden = true; this.cardOpen = false; }
  openPass() {
    const ming = this.player.charKind === 'mingming';
    this.passEl.querySelector('.ttl').textContent = ming ? '明明的美食护照' : '美食护照';
    this.passEl.querySelector('.sub').textContent = `吃过 ${this.pass.length} / ${RESTAURANTS.length} 家`;
    this.passEl.querySelector('.grid').innerHTML = RESTAURANTS.map(r => { const done = this.pass.includes(r.id);
      return `<div class="cell ${done ? 'done' : ''}"><img src="${dishURL(r.dish, 160, done ? '#FFF1D6' : '#EEF1F4')}" alt=""><b>${esc(DISHES[r.dish].zh)}</b><small>${esc(r.name)}</small><span class="st">🚇 ${esc(STATIONS[r.code].zh)}</span>${done ? '<i class="mark">已尝</i>' : ''}</div>`; }).join('');
    this.passEl.hidden = false; this.passOpen = true; this.Audio.blip && this.Audio.blip('tap');
  }
  closePass() { this.passEl.hidden = true; this.passOpen = false; }
  /* —— 进店 / 出店 —— */
  enter(shop, st) {
    if (this.interior) this.interior.dispose();
    this.interior = new FoodInterior(this.scene, this.M, shop.r);
    this.interior.setEnabled(true); st.kit.root.setEnabled(false);
    const s = this.interior.spawn; this.player.spawn(s.x, s.y, s.z, s.yaw);
    this.cur = { shop, r: shop.r, st }; this.count.enter++;
    this.bubbles.clear(); this.hud.toast(`欢迎光临 ${shop.r.name}！`, 2200);
    this.events.emit('food', { enter: shop.r.id });
  }
  exit() {
    const { shop, st } = this.cur; this.clearDish(); this.closeMenu();
    if (this.player.seat) this.seats.stand();
    this.interior.dispose(); this.interior = null; this.cur = null;
    if (st === this.getStation()) {
      st.kit.root.setEnabled(true);
      const F = shop.F, d = shop.door.dOut; this.player.spawn(F.X(d), 0.05, F.Z(0), F.yawOut); this.player.yaw = F.yawOut;
    }
    this.events.emit('food', { exit: true });
  }
  update(dt) {
    const st = this.getStation(), pl = this.player, p = pl.position;
    if (st !== this._st) { if (this._st && this._st.foodAtlas && this._st !== st) { this._st.foodAtlas.tex.dispose(); if (this._st.foodAtlas.mat) this._st.foodAtlas.mat.dispose(); } this._st = st; if (this.cur && this.cur.st !== st) { this.clearDish(); if (this.interior) this.interior.dispose(); this.interior = null; this.cur = null; } }
    if (!st) return;
    if (!this.cur) {
      if (pl.seat || p.y < -1 || p.y > 2) return;
      for (const shop of st.foodShops || []) { const L = shop.F.local(p), D = shop.door; if (L.a > D.a0 && L.a < D.a1 && L.d < D.dIn && L.d > D.dIn - 1.2) { this.enter(shop, st); break; } }
      this.orderBtn.hidden = true; return;
    }
    if (this.interior.wantsExit(p) && !pl.seat) { this.exit(); this.orderBtn.hidden = true; return; }
    const seat = pl.seat && pl.seat.seat, seated = !!(seat && seat.food);
    if (!seated && this.meal) this.clearDish();
    this.orderBtn.hidden = !seated || !!(this.meal && this.meal.phase !== 'done') || this.menuOpen || this.cardOpen || this.passOpen;
    const m = this.meal; if (!m) return;
    m.t += dt;
    // 测试/截图：hold='served' 停在刚上菜、'bite' 停在吃第一口举拳（无头浏览器 1–3 fps，截图要好几秒）
    if (this.hold === 'served' && m.phase === 'eat') m.t = Math.min(m.t, 0.6);
    if (this.hold === 'bite' && m.phase === 'eat') m.t = Math.min(m.t, 1.7);
    if (m.phase === 'serve') { const k = Math.min(1, m.t / 0.5), s = k < 1 ? 0.3 + 0.85 * Math.sin(k * Math.PI * 0.5) : 1; m.mesh.scaling.setAll(this.DS * Math.min(1.08, s)); if (m.t > 0.8) { m.mesh.scaling.setAll(this.DS); m.phase = 'eat'; m.t = 0; } }
    else if (m.phase === 'eat') {
      if (!m.bite && m.t > 1.0) { m.bite = true; this.count.eat++; pl.person.happyT = 4.5; this.bubbles.say({ pos: () => pl.model.getAbsolutePosition().add(new B.Vector3(0, 1.75 * (pl.model.scaling.y || 1), 0)) }, { html: `<div class="yum"><span class="emo">😋</span><b>好好吃！</b></div>`, kind: 'yum', ms: 2800 }); this.Audio.blip && this.Audio.blip('goal'); m.mesh.scaling.set(0.92 * this.DS, 0.85 * this.DS, 0.92 * this.DS); this.events.emit('food', { bite: m.id }); }
      if (m.t > 2.0 && m.t < 2.1) m.mesh.scaling.set(0.85 * this.DS, 0.7 * this.DS, 0.85 * this.DS);
      if (m.t > 3.6) { m.phase = 'card'; m.t = 0; this.showCard(); }
    } else if (m.phase === 'card' && !this.cardOpen) { m.phase = 'done'; m.mesh.scaling.set(0.8 * this.DS, 0.5 * this.DS, 0.8 * this.DS); }
    this.animateEat(m);
  }
  /** 坐着吃：右手（拿筷子）一下一下送到嘴边；吃第一口后两只拳头举起来“努力！” */
  animateEat(m) {
    const per = this.player.person; if (!this.player.seat || !per.setBone) return;
    if (m.phase === 'eat') {
      if (per.happyT !== undefined) per.happyT = Math.max(per.happyT, 0.3);
      const t = m.t, yay = t > 1.15 && t < 2.6;
      if (yay) { const b = Math.abs(Math.sin(t * 6)) * 0.12; per.setBone(3, 0, 0, -1.7 - b); per.setBone(4, 0, 0, 1.7 + b); per.setBone(5, 0, 0, -1.45); per.setBone(6, 0, 0, 1.45); per.setBone(2, -0.12, 0, Math.sin(t * 3) * 0.08); }
      else { const k = 0.5 - 0.5 * Math.cos(Math.min(t, 6) * Math.PI * 1.6), lean = 0.18 * (1 - k); per.setBone(4, -0.55 - 0.65 * k, 0.25 * k, -0.15 - 0.15 * k); per.setBone(6, -0.7 - 1.25 * k, 0.35 * k, 0); per.setBone(2, 0.18 * (1 - k) + 0.05, 0, 0); per.setBone(1, lean, 0, 0); }
    }
  }
  resetPass() { this.pass = []; this.savePass(); this.updateCount(); }
  info() {
    return { inside: this.cur ? this.cur.r.id : null, interior: this.interior ? this.interior.info() : null, meal: this.meal ? { id: this.meal.id, phase: this.meal.phase, bite: this.meal.bite } : null,
      pass: this.pass.slice(), count: this.count, menuOpen: !!this.menuOpen, cardOpen: !!this.cardOpen, passOpen: !!this.passOpen, orderBtn: !this.orderBtn.hidden,
      shops: (this.getStation() && this.getStation().foodShops || []).map(s => ({ id: s.r.id, door: [s.F.X(s.door.dIn + 0.6), s.F.Z(0)], out: [s.F.X(s.door.dOut + 1.5), s.F.Z(0)], yawIn: s.F.yawOut + Math.PI })) };
  }
}
export { RESTAURANTS };
