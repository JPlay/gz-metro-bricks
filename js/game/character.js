/*
 * 选角色：游戏开始时选 哥哥（明明）或 弟弟（星星）；选择记在 localStorage，右上角「换人」按钮随时再换。
 *   选角台：远处（x = -900）一个圆形小舞台，两个玩具小人并排站着（真实身高比例），下面两个大名字按钮（给小朋友点）；
 *   点谁，谁就做他的招牌动作（星星 🤘、明明 ✌️ + 挥拳），再点「出发！」进游戏。
 *   测试（navigator.webdriver）默认跳过选角台，除非 URL 带 ?select=1；?char=mingming / xingxing 直接指定角色。
 */
import { Hero } from './hero.js';
import { Brother } from './brother.js';
import { Kit } from '../world/kit.js';
import { hex } from '../core/geo.js';
import { makeBlob } from '../world/people.js';
import { pressable } from './input.js';
const B = window.BABYLON;

export const CHARS = {
  mingming: { zh: '明明', role: '哥哥', tag: '爱吃美食', color: '#1F2A4E' },
  xingxing: { zh: '星星', role: '弟弟', tag: '爱坐地铁', color: '#2BA7B8' }
};
const KEY = 'gzmetro.char';
export function savedChar() { try { const v = localStorage.getItem(KEY); return CHARS[v] ? v : null; } catch (_) { return null; } }
export function saveChar(k) { try { localStorage.setItem(KEY, k); } catch (_) {} }
export function makePerson(kind, scene, mat, name) { return kind === 'mingming' ? new Brother(scene, mat, { name: name || 'kid' }) : new Hero(scene, mat, { name: name || 'kid' }); }

/** 把玩家模型换成 kind（保留位置 / 朝向；影子投射、渐隐状态重置） */
export function applyCharacter(player, kind, R) {
  if (player.charKind === kind && player.person) return;
  const old = player.person, M = player._M;
  const p = makePerson(kind, player.scene, M.paint, 'kid');
  player.person = p; player.model = p.mesh; player.charKind = kind;
  p.mesh.position.copyFrom(old.mesh.position); p.mesh.rotation.y = old.mesh.rotation.y;
  old.dispose();
  player._heroFade = undefined;
  if (R) { R.addShadowCaster(p.mesh); }
}

const STAGE = { x: -900, y: 0, z: 0 };
export class CharSelect {
  constructor({ scene, cam, M, player, R, onDone }) {
    Object.assign(this, { scene, cam, M, player, R, onDone });
    this.open = false; this.sel = null;
    const el = this.el = document.createElement('div'); el.id = 'charsel'; el.hidden = true;
    el.innerHTML = `<div class="ttl glass"><b>选一个小朋友，出发！</b><small>点名字选他</small></div>
      <div class="picks">${Object.entries(CHARS).map(([k, c]) => `<button class="pick" data-k="${k}" style="--c:${c.color}"><span class="nm">${c.zh}</span><span class="rl">${c.role}</span>${k === 'mingming' ? `<span class="tag">🍜 ${c.tag}</span>` : `<span class="tag">🚇 ${c.tag}</span>`}</button>`).join('')}</div>
      <button class="go" hidden>出发！</button>`;
    document.body.appendChild(el);
    el.querySelectorAll('.pick').forEach(b => pressable(b, () => this.pick(b.dataset.k)));
    pressable(el.querySelector('.go'), () => this.confirm());
    ['pointerdown', 'pointermove', 'pointerup', 'touchstart', 'click'].forEach(t => el.addEventListener(t, e => e.stopPropagation()));
  }
  buildStage() {
    const k = this.kit = new Kit(this.scene, 'charStage'), P = k.solid, G = k.glow, O = STAGE;
    // 圆形小舞台：木色台面 + 一圈彩色积木边 + 两个站位的浅色圆圈
    P.cyl(O.x, O.y + 0.15, O.z, 5.6, 0.3, hex('#F3D9A4'), 40, 0, 0, 0, undefined, { ao: false });
    P.cyl(O.x, O.y - 0.15, O.z, 6.0, 0.3, hex('#E2A85A'), 40, 0, 0, 0, undefined, { ao: false });
    const cols = ['#E8505B', '#F5B841', '#2BB3B1', '#42B883', '#8E6CCF', '#3E8EDE'];
    for (let i = 0; i < 24; i++) { const a = i / 24 * Math.PI * 2; P.rbox(O.x + Math.cos(a) * 2.95, O.y + 0.0, O.z + Math.sin(a) * 2.95, 0.5, 0.36, 0.34, hex(cols[i % 6]), 0.06, -a + Math.PI / 2, { ao: false }); }
    for (const sx of [-1, 1]) P.cyl(O.x + sx * 0.85, O.y + 0.305, O.z, 1.3, 0.01, hex('#FFF4DC'), 32, 0, 0, 0, undefined, { ao: false });
    // 背景：一面弧形的天蓝墙 + 白云 + 一列小地铁
    for (let i = 0; i < 18; i++) {
      const a0 = (i / 18 - 0.5) * 2.4, a1 = ((i + 1) / 18 - 0.5) * 2.4, R = 9, q = (a, y) => [O.x + Math.sin(a) * R, O.y + y, O.z + Math.cos(a) * R];
      G.quad(q(a1, -0.4), q(a0, -0.4), q(a0, 7), q(a1, 7), hex('#BFE6FA'), [[0.98, 0.95, 0.85, 1], [0.98, 0.95, 0.85, 1], [0.62, 0.84, 0.98, 1], [0.62, 0.84, 0.98, 1]]);
    }
    for (const [a, y, s] of [[-0.75, 4.9, 0.7], [0.25, 5.6, 0.85], [0.9, 4.5, 0.6]]) for (const [dx, dy, r] of [[0, 0, 0.7], [0.6, -0.1, 0.55], [-0.6, -0.12, 0.5]]) G.sphere(O.x + Math.sin(a) * 8.6 + dx * s, O.y + y + dy * s, O.z + Math.cos(a) * 8.6, r * s * 2, hex('#FFFFFF'), 2, 0.6);
    for (let i = 0; i < 4; i++) { const x = O.x - 3.2 + i * 2.15; P.rbox(x, O.y + 1.1, O.z + 8.2, 2.0, 1.2, 0.5, hex('#F3D03E'), 0.25, 0, { ao: false }); for (const wx of [-0.5, 0.15, 0.7]) G.box(x + wx, O.y + 1.85, O.z + 7.93, 0.4, 0.35, 0.02, hex('#DDF2FF')); }
    k.finish();
    // 两个小人：左 = 明明（哥哥），右 = 星星（从镜头看）
    this.models = {};
    for (const [kind, sx] of [['mingming', 1], ['xingxing', -1]]) {
      const p = makePerson(kind, this.scene, this.M.paint, 'sel-' + kind);
      p.mesh.position.set(O.x + sx * 0.85, O.y + 0.31, O.z); p.mesh.rotation.y = Math.PI + sx * 0.12;
      const bl = makeBlob(this.scene, this.M, 'selBlob', 0.5, 0.6); bl.position.set(O.x + sx * 0.85, O.y + 0.315, O.z); bl.parent = null;
      this.models[kind] = { p, bl, sx };
    }
  }
  show(cur) {
    if (!this.kit) this.buildStage();
    this.kit.root.setEnabled(true); for (const m of Object.values(this.models)) { m.p.mesh.setEnabled(true); m.bl.setEnabled(true); }
    this.open = true; this.el.hidden = false; document.body.classList.add('charsel-on');
    this.sel = null; this.el.querySelector('.go').hidden = true;
    this.el.querySelectorAll('.pick').forEach(b => b.classList.remove('on'));
    if (cur) this.pick(cur, true);
    this.obs = this.scene.onBeforeRenderObservable.add(() => this.tick());
    this.layout();
  }
  /** 名字按钮放在各自小人的脚下（投影到屏幕） */
  layout() {
    const W = innerWidth, H = innerHeight, tm = this.scene.getTransformMatrix(), vp = this.cam.viewport.toGlobal(W, H);
    for (const [kind, m] of Object.entries(this.models)) {
      const v = B.Vector3.Project(new B.Vector3(m.p.mesh.position.x, STAGE.y + 0.1, STAGE.z), B.Matrix.IdentityReadOnly, tm, vp);
      const b = this.el.querySelector(`.pick[data-k="${kind}"]`); if (b && isFinite(v.x)) { b.style.left = Math.round(v.x) + 'px'; b.style.top = Math.round(Math.min(H - 300, v.y + 6)) + 'px'; }
    }
  }
  tick() {
    const dt = Math.min(0.05, this.scene.getEngine().getDeltaTime() / 1000), O = STAGE, portrait = innerHeight > innerWidth;
    // 镜头：正对两个小人，稍微俯视；竖屏退远一点
    const dist = portrait ? 6.6 : 4.4;
    this.cam.position.set(O.x, O.y + 1.45, O.z - dist); this.cam.rotation.set(0.07, 0, 0); this.cam.minZ = 0.25;
    for (const [kind, m] of Object.entries(this.models)) {
      const on = kind === this.sel, mode = on ? 'cheer' : 'idle'; // 明明 cheer = ✌️ + 挥拳；星星 cheer = 两只拳头“努力！”
      m.p.animate(dt, { mode });
      m.p.mesh.position.y = O.y + 0.31 + (m.p.hipBob || 0) * 0.6;
      const want = Math.PI + m.sx * (on ? 0.0 : 0.12); m.p.mesh.rotation.y += (want - m.p.mesh.rotation.y) * Math.min(1, dt * 6);
    }
    this.layout();
  }
  pick(kind, silent) {
    this.sel = kind; this.el.querySelectorAll('.pick').forEach(b => b.classList.toggle('on', b.dataset.k === kind));
    const go = this.el.querySelector('.go'); go.hidden = false; go.textContent = `${CHARS[kind].zh}，出发！`;
    if (!silent && this.onPick) this.onPick(kind);
  }
  confirm() { if (!this.sel) return; const k = this.sel; this.hide(); saveChar(k); this.onDone && this.onDone(k); }
  hide() {
    this.open = false; this.el.hidden = true; document.body.classList.remove('charsel-on');
    if (this.obs) { this.scene.onBeforeRenderObservable.remove(this.obs); this.obs = null; }
    if (this.kit) { this.kit.root.setEnabled(false); for (const m of Object.values(this.models)) { m.p.mesh.setEnabled(false); m.bl.setEnabled(false); } }
  }
  info() { return { open: this.open, sel: this.sel }; }
}
