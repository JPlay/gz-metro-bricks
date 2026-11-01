/*
 * 景点“小发现”：不是任务，没有提示条。走到中山纪念堂台阶前 → 镜头取景（主角在前、整座纪念堂在后）
 * → 主角“努力！”庆祝 → 2.4 秒后弹出小知识卡。卡片只弹一次：再回到达区（从纪念堂里出来、上下楼座再出门等）只庆祝，不再盖住屏幕；
 * 弹卡前离开了街面（比如直接走进了纪念堂）就不弹，下次回到达区再弹。
 */
import { drawHallIcon } from '../world/kit.js';
const $ = id => document.getElementById(id);
export const SPOT = { code: 'jnt', zh: '中山纪念堂', en: 'Sun Yat-sen Memorial Hall' };
const FACTS = ['这座八角形的大房子，是为了纪念孙中山先生建的。', '蓝色的屋顶是琉璃瓦做的，像一顶亮晶晶的大蓝帽子！'];

export class Discovery {
  constructor({ Audio, player, events }) {
    this.Audio = Audio; this.player = player; this.events = events;
    this.done = false; this.shown = false; this.cardOpen = false; this.inZone = false; this.cardT = 0;
    this.card = $('goalCard');
    const ci = this.card.querySelector('canvas'); if (ci) { const c = ci.getContext('2d'); c.scale(ci.width / 48, ci.height / 48); drawHallIcon(c, 0, 0, 48, '#EAF2FB'); }
    this.card.querySelector('.fact').innerHTML = FACTS.map(f => `<p>${f}</p>`).join('');
    const close = e => { e.preventDefault(); e.stopPropagation(); this.closeCard(); };
    this.card.querySelector('.ok').addEventListener('pointerdown', close);
    this.card.querySelector('.ok').addEventListener('click', close);   // 键盘 / 辅助功能的“点击”也能关
    this.card.addEventListener('pointerdown', e => { e.stopPropagation(); if (e.target === this.card) close(e); });
    ['pointermove', 'pointerup', 'click', 'touchstart'].forEach(t => this.card.addEventListener(t, e => e.stopPropagation()));
  }
  update(g) {
    const dt = g.dt || 0;
    const st = g.station, p = this.player.position, Z = st && st.goal && st.goal.zone;
    const onStreet = g.code === SPOT.code && g.zone.kind === 'street';
    if (this.cardT > 0) { if (!onStreet) this.cardT = 0; else { this.cardT -= dt; if (this.cardT <= 0) this.openCard(); } }
    const inside = !!Z && onStreet && !this.cardOpen && p.x > Z.x0 && p.x < Z.x1 && p.z > Z.z0 && p.z < Z.z1;
    if (inside && !this.inZone) this.arrive(st);
    this.inZone = inside || (this.inZone && this.cardOpen);
  }
  /** 镜头摆到主角正前方偏一侧（主角 + 身后的纪念堂同框，避开铜像），主角转身“努力！”，2.4 秒后弹卡 */
  arrive(st) {
    const first = !this.done; this.done = true; const pl = this.player, p = pl.position, H = st.sysy && st.sysy.hall;
    const card = !this.shown;   // 卡已经看过：只庆祝，不取景、不弹卡
    if (H && card) {
      // 镜头放在主角身后偏一侧、远一点：铜像整座落在画面一侧（不会只露半个），主角站在铜像和纪念堂之间，纪念堂在后面
      const S = st.sysy.statue, s = p.x >= H.x ? 1 : -1;
      const at = { x: p.x + s * 14, z: p.z - 22 };
      if (S && Math.abs(at.z - S.z) < 3) at.z = S.z - 3;
      if (pl.view !== 'third') pl.toggleView();
      pl.frame = { at, look: { x: H.x, z: H.z }, h: 3.0, lookY: 9.0, keep: pl.dist };
      pl.yaw = Math.atan2(H.x - at.x, H.z - at.z); pl.pitch = 0.05;
    }
    pl.celebrate();
    this.Audio.blip && this.Audio.blip('goal');
    if (card) this.cardT = 2.4;
    this.events && this.events.emit('discover', { code: SPOT.code, first });
  }
  openCard() { this.shown = true; this.card.hidden = false; this.card.classList.remove('out'); this.cardOpen = true; }
  closeCard() { if (!this.cardOpen) return; this.cardOpen = false; const pl = this.player; if (pl.frame) pl.frame = null; this.card.classList.add('out'); setTimeout(() => { if (!this.cardOpen) this.card.hidden = true; }, 220); this.Audio.blip && this.Audio.blip('tap'); }
  info() { return { done: this.done, shown: this.shown, card: this.cardOpen, cardSoon: this.cardT > 0, framed: !!this.player.frame }; }
}
