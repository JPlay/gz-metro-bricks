// HUD：左上角站名牌（广州地铁风格：线路色标 + 中文站名 + 英文站名 + 线路色底边）、下一站提示、居中提示（toast）。
import { LINES, STATIONS } from '../data/lines.js';
const $ = id => document.getElementById(id);
export class Hud {
  constructor() { this.toastT = null; this.key = ''; }
  where(code, line, nextCode) {
    const s = STATIONS[code], L = LINES[line] || LINES[s.lines[0]], key = code + line + (nextCode || '');
    if (key === this.key) return; const changed = this.key && this.key.slice(0, code.length) !== code; this.key = key;
    const w = $('where'); w.style.setProperty('--line', L.color); w.style.setProperty('--ink', L.ink);
    const ln = $('whereLine'); ln.innerHTML = `<b>${L.id}</b><small>号线</small>`; ln.setAttribute('aria-label', L.zh);
    $('whereName').textContent = s.zh; $('whereEn').textContent = s.en;
    if (changed) { w.classList.remove('swap'); void w.offsetWidth; w.classList.add('swap'); }
    const n = $('next');
    if (nextCode) { n.hidden = false; n.innerHTML = `<span class="tag">下一站<small>Next</small></span><span class="nm">${STATIONS[nextCode].zh}<small>${STATIONS[nextCode].en}</small></span>`; n.style.setProperty('--line', L.color); } else n.hidden = true;
  }
  toast(text, ms = 1800) {
    const t = $('toast'); t.textContent = text; t.hidden = false; t.classList.remove('out'); t.style.animation = 'none'; void t.offsetWidth; t.style.animation = '';
    clearTimeout(this.toastT); clearTimeout(this.toastT2);
    this.toastT = setTimeout(() => { t.classList.add('out'); this.toastT2 = setTimeout(() => { t.hidden = true; }, 260); }, ms);
  }
  /** ico = 图标符号名（eye1 / eye3 / sound / mute） */
  setBtn(id, on, ico, lbl) {
    const b = $(id); b.classList.toggle('on', !!on);
    if (ico) b.querySelector('.ico use').setAttribute('href', '#i-' + ico);
    if (lbl) b.querySelector('.lbl').textContent = lbl;
  }
}
