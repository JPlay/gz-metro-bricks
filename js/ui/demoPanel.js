/*
 * 画质升级 Demo 面板（右上角，按钮栏下方；可折叠成小药丸，不挡游玩）：
 *   模式：原版 Default / 10× 零开销升级；光照：晴朗上午 / 黄金夕阳；4 个一键传送机位；逐项开关验证；
 *   实时性能条（一直显示在面板头部）：FPS（平滑 + 3 秒内最低）、Draws、Tris、Res。
 */
import { FEATURES } from '../core/gfx.js';
import { STATUE, AX } from '../world/sysy.js';
export const VIEWS = [
  { id: 'street', icon: '🚶', label: '公园前街景', code: 'gyq', x: 6.5, y: 0.05, z: -55.5, yaw: -0.42, pitch: 0.1, view: 'third' },
  { id: 'water', icon: '🌊', label: '广场水景', code: 'gyq', x: -17.6, y: 0.05, z: -44.3, yaw: -1.12, pitch: 0.3, view: 'third' },
  { id: 'sm', icon: '🏛️', label: '纪念堂红墙', code: 'jnt', x: AX + 5, y: 0.05, z: STATUE.z - 16, yaw: -0.18, pitch: 0.02, view: 'third' },
  { id: 'hall', icon: '🚇', label: '站厅地砖', code: 'gyq', x: 0, y: -5.95, z: -11, yaw: 0, pitch: 0.12, view: 'third' }
];
const LS = 'gz-gfx-demo-panel';
window.__gfxViews = VIEWS;
export function installDemoPanel({ gfx, go }) {
  const el = document.createElement('div'); el.id = 'gfxDemo'; el.className = 'glass';
  const P = new URLSearchParams(location.search);
  let collapsed = P.get('gfxpanel') === '0' || (P.get('gfxpanel') !== '1' && localStorage.getItem(LS) === 'c');
  el.innerHTML = `
    <header><span class="dot"></span><b>画质 Demo</b><span class="tag" id="gfxTag">10×</span><span class="tele" id="gfxTele">— fps</span><button class="fold" aria-label="折叠">▾</button></header>
    <div class="body">
      <div class="seg mode"><button data-mode="orig">原版 Default</button><button data-mode="up">10× 零开销升级</button></div>
      <div class="seg light"><button data-light="day">☀️ 晴朗上午</button><button data-light="dusk">🌅 黄金夕阳</button></div>
      <div class="views">${VIEWS.map(v => `<button data-view="${v.id}"><span class="i">${v.icon}</span>${v.label}</button>`).join('')}</div>
      <details class="feat"><summary>逐项开关验证</summary>
        ${FEATURES.map(([k, t]) => `<label><input type="checkbox" data-f="${k}"><span>${t}</span></label>`).join('')}
      </details>
      <div class="note" id="gfxNote"></div>
    </div>`;
  document.getElementById('hud').appendChild(el);
  const $ = s => el.querySelector(s), $$ = s => [...el.querySelectorAll(s)];
  const setC = c => { collapsed = c; el.classList.toggle('collapsed', c); try { localStorage.setItem(LS, c ? 'c' : 'o'); } catch (_) {} };
  setC(collapsed);
  // 面板上的触摸不传给下面的视角拖动 / 摇杆
  ['pointerdown', 'pointermove', 'pointerup', 'touchstart', 'touchmove', 'touchend', 'click', 'wheel'].forEach(t => el.addEventListener(t, e => e.stopPropagation(), { passive: true }));
  const tap = (node, f) => node.addEventListener('click', e => { e.preventDefault(); f(e); });
  tap($('header'), e => { if (e.target.closest('.fold') || collapsed) setC(!collapsed); });
  $$('[data-mode]').forEach(b => tap(b, () => gfx.setMode(b.dataset.mode)));
  $$('[data-light]').forEach(b => tap(b, () => gfx.setLight(b.dataset.light)));
  $$('[data-view]').forEach(b => tap(b, async () => { const v = VIEWS.find(q => q.id === b.dataset.view); b.classList.add('busy'); try { await go(v); } finally { b.classList.remove('busy'); } }));
  $$('[data-f]').forEach(i => i.addEventListener('change', () => gfx.setFeature(i.dataset.f, i.checked)));
  const sync = () => {
    const s = gfx.state;
    $$('[data-mode]').forEach(b => b.classList.toggle('on', b.dataset.mode === s.mode));
    $$('[data-light]').forEach(b => b.classList.toggle('on', s.mode === 'up' && b.dataset.light === s.light));
    $$('[data-f]').forEach(i => { i.checked = !!s.f[i.dataset.f]; i.disabled = s.mode !== 'up'; });
    el.classList.toggle('orig', s.mode !== 'up');
    $('#gfxTag').textContent = s.mode === 'up' ? (s.light === 'dusk' ? '10× 夕阳' : '10× 上午') : '原版';
    $('#gfxNote').textContent = s.mode === 'up' ? '升级项全部在材质 / 着色器 / 烘焙里完成：不加灯、不加实时阴影，绘制调用不增加' : '原版：当前线上版本的渲染设置';
  };
  gfx.on(sync); sync();
  const tele = $('#gfxTele');
  let last = 0;
  const tick = () => {
    const now = performance.now();
    if (now - last > 250) {
      last = now; const S = gfx.stats;
      tele.innerHTML = `<span><b>${Math.round(S.fps)}</b> fps <i>min ${Math.round(S.min)}</i></span><span><b>${S.draws}</b> draws</span><span>${(S.tris / 1000).toFixed(1)}k tris</span><span>${S.w}×${S.h}</span>`;
    }
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
  return { el, sync, setCollapsed: setC };
}
