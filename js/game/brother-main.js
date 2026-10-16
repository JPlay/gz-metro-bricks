/*
 * 哥哥明明 + 广州美食：把选角色、换人按钮、明明的敬礼、美食店（food.js）接到游戏里。
 * main.js 只调用一次 installBrother(...)，其余都在这几个新模块里（不改 hero.js / player.js）。
 */
import { CharSelect, CHARS, applyCharacter, savedChar, saveChar, makePerson } from './character.js';
import { pressable } from './input.js';
import { FoodCtl } from './food.js';
const B = window.BABYLON;

export function installBrother(deps) {
  const { scene, cam, M, player, R, social, getStation } = deps;
  if (!document.getElementById('brotherCss')) { const l = document.createElement('link'); l.id = 'brotherCss'; l.rel = 'stylesheet'; l.href = 'css/brother.css'; document.head.appendChild(l); }
  player._M = M; player.charKind = 'xingxing';
  const api = { food: null };
  api.food = new FoodCtl(deps);
  // —— 选角色：开始时弹出（测试默认跳过，?select=1 才弹；?char= 直接指定）——
  const qs = new URLSearchParams(location.search), forced = qs.get('char');
  const sel = new CharSelect({ scene, cam, M, player, R, onDone: k => { applyCharacter(player, k, R); deps.events.emit('char', { kind: k }); api.food && api.food.onChar(k); } });
  // 选角台开着：玩家不动、不响应摇杆（镜头由选角台接管）
  const upd = player.update.bind(player), ZERO = { mx: 0, my: 0, lx: 0, ly: 0, run: false, jump: false, pinch: 0 };
  player.update = (dt, inp, extra) => upd(dt, sel.open ? ZERO : inp, sel.open ? null : extra);
  // 右上角「换人」按钮
  const btns = document.getElementById('btns');
  if (btns && !document.getElementById('bChar')) {
    btns.insertAdjacentHTML('afterbegin', `<button id="bChar" class="btn glass" aria-label="换人"><svg class="ico" viewBox="0 0 48 48"><circle cx="17" cy="15" r="6" fill="currentColor"/><path d="M6 37c0-7 5-12 11-12s11 5 11 12" fill="currentColor"/><circle cx="33" cy="17" r="5" fill="currentColor" opacity=".6"/><path d="M25 37c1-6 4-10 8-10s9 4 9 10" fill="currentColor" opacity=".6"/></svg><span class="lbl">换人</span></button>`);
    pressable(document.getElementById('bChar'), () => sel.show(player.charKind));
  }
  const start = CHARS[forced] ? forced : (savedChar() || 'xingxing');
  if (CHARS[forced]) saveChar(forced);
  applyCharacter(player, start, R);
  if (!navigator.webdriver || qs.get('select') === '1') { if (!CHARS[forced]) sel.show(savedChar() || null); }
  // —— 明明见到车站工作人员（客服中心）：站定敬礼，工作人员挥手 ——
  let saluted = false;
  scene.onBeforeRenderObservable.add(() => {
    const st = getStation(); if (!st || !st.staff || player.charKind !== 'mingming' || sel.open) return;
    const s = st.staff.p.mesh.position, p = player.position, d = Math.hypot(s.x - p.x, s.z - p.z);
    if (Math.abs(s.y - p.y) > 1.5 || d > 6) { saluted = false; return; }
    if (!saluted && d < 3.6 && !player.seat) {
      saluted = true; const yaw = Math.atan2(s.x - p.x, s.z - p.z);
      player.emote = { mode: 'salute', yaw, t: 2.4 };
      st.crowd.act(st.staff, 'wave', Math.atan2(p.x - s.x, p.z - s.z), 2.2);
      api.lastSalute = performance.now();
    }
  });
  Object.assign(api, {
    select: sel, show: () => sel.show(player.charKind), pick: k => sel.pick(k), confirm: () => sel.confirm(),
    setChar: k => { applyCharacter(player, k, R); saveChar(k); api.food && api.food.onChar(k); },
    info: () => ({ char: player.charKind, select: sel.info(), food: api.food ? api.food.info() : null, saluted })
  });
  // 另一个小朋友站在旁边（两兄弟合影 / 测试用）：api.buddy(x, y, z, yaw, mode)，api.buddy(null) 收起
  let buddy = null;
  api.buddy = (x, y, z, yaw = 0, mode = 'idle') => {
    if (buddy) { buddy.p.dispose(); buddy = null; }
    if (x === null || x === undefined) return null;
    const kind = player.charKind === 'mingming' ? 'xingxing' : 'mingming', p = makePerson(kind, scene, M.paint, 'buddy');
    p.mesh.position.set(x, y, z); p.mesh.rotation.y = yaw; R.addShadowCaster && R.addShadowCaster(p.mesh);
    buddy = { p, mode }; return kind;
  };
  api.buddyMode = m => { if (buddy) buddy.mode = m; };
  scene.onBeforeRenderObservable.add(() => { if (buddy) buddy.p.animate(Math.min(0.1, scene.getEngine().getDeltaTime() / 1000), { mode: buddy.mode }); });
  return api;
}
