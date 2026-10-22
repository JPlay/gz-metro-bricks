/*
 * 存档 / 续玩（localStorage）：记住城市、车站、位置、朝向（角色另由 character.js 记住）。
 * 每 5 秒存一次，切到后台 / 关页面时（visibilitychange hidden / pagehide）也存。
 * 坐车途中存档：恢复到最后真正到过的那个站的站台。
 * 只在“普通”场景里更新存档（广州地铁车站 / 厦门地铁车站）；酒店、陈家祠、饭店、国铁厦门北、动车里不覆盖，回来时落到上一个车站位置。
 * 存档带版本号；解析失败 / 版本不对 / 车站不存在 → 用默认开局（绝不白屏）。URL 带 ?start= 时不读存档（测试用）。
 */
export const SAVE_KEY = 'gzmb.save', SAVE_V = 1;
export function readSave() {
  try {
    const raw = localStorage.getItem(SAVE_KEY); if (!raw) return null;
    const s = JSON.parse(raw);
    if (!s || s.v !== SAVE_V || (s.city !== 'gz' && s.city !== 'xm') || typeof s.code !== 'string') return null;
    if (s.pos && !(Array.isArray(s.pos) && s.pos.length === 3 && s.pos.every(Number.isFinite))) s.pos = null;
    if (!Number.isFinite(s.yaw)) s.yaw = 0;
    return s;
  } catch (_) { return null; }
}
export function clearSave() { try { localStorage.removeItem(SAVE_KEY); } catch (_) {} }

/** g: { player, G, metro, xmMetro(), east(), hotel(), clan(), brother() } */
export function snapshot(g) {
  if (g.off && g.off()) return null;
  const { player, G, metro } = g, xm = g.xmMetro(), east = g.east(), hotel = g.hotel(), clan = g.clan(), br = g.brother();
  const p = player.position, pos = [p.x, p.y, p.z].map(v => +v.toFixed(2)), yaw = +player.yaw.toFixed(3);
  if (xm && xm.station) {
    const riding = G.aboard || G.inTunnel || G.zone.kind === 'tunnel';
    const line = xm.ride ? xm.ride.line : (G.zone.P ? G.zone.P.line : null);
    return riding ? { city: 'xm', code: xm.code, line, platform: true } : { city: 'xm', code: xm.code, line, pos, yaw };
  }
  if ((east && east.cur) || (hotel && hotel.cur) || (clan && clan.cur) || (br && br.food && br.food.cur)) return null;   // 室内 / 国铁 / 动车：不覆盖
  if (!G.station || !G.code) return null;
  if (G.aboard || G.inTunnel) { const line = metro.ride ? metro.ride.line : null; return { city: 'gz', code: G.code, line, platform: true }; }
  if (!Number.isFinite(p.y) || p.y < -40) return null;
  return { city: 'gz', code: G.code, pos, yaw };
}
export function writeSave(g) {
  try { const s = snapshot(g); if (!s) return false; s.v = SAVE_V; s.t = Date.now(); localStorage.setItem(SAVE_KEY, JSON.stringify(s)); return true; } catch (_) { return false; }
}
export function installAutosave(g, every = 5000) {
  const tick = () => writeSave(g);
  const id = setInterval(tick, every);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') tick(); });
  window.addEventListener('pagehide', tick);
  return () => clearInterval(id);
}
