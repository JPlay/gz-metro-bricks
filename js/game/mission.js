/*
 * 小任务：去中山纪念堂（给 8 岁小朋友的一路提示）。
 *   左上角任务卡：大字“去中山纪念堂” + 下一步该做什么（按当前车站 / 区域 / 坐车方向实时换）；
 *   地图按钮里纪念堂站标成“目的地”；到了正门台阶前的金色圈 → 主角自动“努力！”庆祝 + 弹出到达卡（一两句小知识）。
 * 只用 lines.js / route.js 的数据：从任何一站出发都能算出要不要在公园前换乘、坐哪个方向。
 */
import { LINES, STATIONS } from '../data/lines.js';
import { routeTo } from '../data/route.js';
import { drawHallIcon } from '../world/kit.js';
const $ = id => document.getElementById(id);
export const GOAL = { code: 'jnt', zh: '中山纪念堂', en: 'Sun Yat-sen Memorial Hall' };
const FACTS = ['这座八角形的大房子，是为了纪念孙中山先生建的。', '蓝色的屋顶是琉璃瓦做的，像一顶亮晶晶的大蓝帽子！'];

export class Mission {
  constructor({ hud, Audio, player, tickets, events }) {
    this.hud = hud; this.Audio = Audio; this.player = player; this.tickets = tickets; this.events = events;
    this.done = false; this.step = ''; this.cardOpen = false; this.inZone = false;
    this.el = $('goal'); this.card = $('goalCard');
    // 任务卡左边的小图标（canvas 画的纪念堂，和站里导向牌上的同一个）
    const ic = this.el.querySelector('canvas'); if (ic) { const c = ic.getContext('2d'); c.scale(ic.width / 48, ic.height / 48); drawHallIcon(c, 0, 0, 48, '#FFFFFF'); }
    const ci = this.card.querySelector('canvas'); if (ci) { const c = ci.getContext('2d'); c.scale(ci.width / 48, ci.height / 48); drawHallIcon(c, 0, 0, 48, '#EAF2FB'); }
    this.card.querySelector('.fact').innerHTML = FACTS.map(f => `<p>${f}</p>`).join('');
    const close = e => { e.preventDefault(); e.stopPropagation(); this.closeCard(); };
    this.card.querySelector('.ok').addEventListener('pointerdown', close);
    this.card.addEventListener('pointerdown', e => { e.stopPropagation(); if (e.target === this.card) close(e); });
    ['pointermove', 'pointerup', 'click', 'touchstart'].forEach(t => this.card.addEventListener(t, e => e.stopPropagation()));
    this.el.hidden = false;
  }
  /** 当前这一步的提示（简单中文） */
  hint(g) {
    if (this.done) return '到啦！你真棒！';
    const code = g.code, z = g.zone, ride = g.ride, G = GOAL.code;
    if (g.aboard && ride) {
      const soon = ride.phase === 'cruise';
      if (code === G) return soon ? '下一站纪念堂，准备下车！' : '到纪念堂啦！门开了就下车';
      if (code === 'gyq' && ride.line === 1) return soon ? '下一站公园前，准备换乘 2 号线！' : '到公园前啦！下车换乘 2 号线';
      const leg = routeTo(code, G).legs[0];
      if (leg && leg.line === ride.line && leg.dir.step === ride.step) return `坐到「${STATIONS[leg.to].zh}」下车（还有 ${leg.stops} 站）`;
      return '坐反啦！下一站下车，到对面坐车';
    }
    if (code === G) {
      if (z.kind === 'platform') return '跟着地上的绿色箭头走';
      if (z.kind === 'street') return '跟着绿色箭头，走到纪念堂门口';
      return '跟着绿色箭头，从 C 出口出去';
    }
    const legs = routeTo(code, G).legs, leg = legs[0];
    if (!leg) return '';
    if (z.kind === 'street') return '走进地铁站，去坐车';
    if (z.kind === 'concourse' && !z.paid) return this.tickets && this.tickets.inv ? '刷票进站' : '先买票，选「纪念堂」';
    if (code === 'gyq' && (z.kind === 'transfer' || (z.kind === 'platform' && z.P.line === 1))) return '跟着蓝色引导带，换乘 2 号线';
    if (z.kind === 'platform') {
      if (z.P.line !== leg.line) return `去 ${leg.line} 号线站台`;
      return `坐往「${leg.dir.zh}」的车，${legs.length > 1 ? '到公园前换乘' : `${leg.stops} 站就到`}`;
    }
    return `下楼去坐 ${leg.line} 号线`;
  }
  update(g) {
    const h = this.hint(g);
    if (h !== this.step) {
      this.step = h; const s = this.el.querySelector('.step'); s.textContent = h;
      this.el.classList.remove('bump'); void this.el.offsetWidth; this.el.classList.add('bump');
    }
    this.el.classList.toggle('done', this.done);
    // 到达：纪念堂站街面、正门台阶前的金色圈附近
    const st = g.station, p = this.player.position, Z = st && st.goal && st.goal.zone;
    const inside = !!Z && g.code === GOAL.code && g.zone.kind === 'street' && p.x > Z.x0 && p.x < Z.x1 && p.z > Z.z0 && p.z < Z.z1;
    if (inside && !this.inZone) this.arrive(st);
    this.inZone = inside;
  }
  arrive(st) {
    const first = !this.done; this.done = true;
    this.player.celebrate();
    if (st.goalGem) st.goalGem.setEnabled(false);
    this.Audio.blip && this.Audio.blip('goal');
    this.openCard(first);
    this.events && this.events.emit('goal', { code: GOAL.code, first });
  }
  openCard() { this.card.hidden = false; this.card.classList.remove('out'); this.cardOpen = true; }
  closeCard() { if (!this.cardOpen) return; this.cardOpen = false; this.card.classList.add('out'); setTimeout(() => { if (!this.cardOpen) this.card.hidden = true; }, 220); this.Audio.blip && this.Audio.blip('tap'); }
  info() { return { done: this.done, step: this.step, card: this.cardOpen }; }
}
