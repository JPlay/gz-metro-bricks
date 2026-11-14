/*
 * 街区水面（河道 / 湖）：地面挖了洞，水面本身原先没有碰撞，掉下去会一直往下掉，
 * 掉深了还会被送回地铁站台。这里托在水面上，并给出可点的「回到岸上」。
 */
import { pressable, hudHit } from './input.js';
import { FZ_ATTR_HOLES } from '../world/fzAttr.js';

const FZ_SURFACE = { fzdd: -2.6 };

function inBox(lx, lz, box) {
  const [x0, x1, z0, z1] = box;
  return lx >= x0 && lx <= x1 && lz >= z0 && lz <= z1;
}

/** 人现在是不是掉进了这条街登记过的水面坑（返回水面高度和最近岸边） */
export function streetWaterAt(p, street) {
  if (!p || !street || !street.O) return null;
  // 福州内河（js/world/fzRiver.js）：河道是任意形状的多边形，由街区自己判定（台阶 / 浮码头 / 船上不算水里）
  if (typeof street.waterAt === 'function') return street.waterAt(p);
  const holes = (street.N && street.N.holes && street.N.holes[street.key]) || (street.N && street.N.net === 'fz' && FZ_ATTR_HOLES[street.key]) || [];
  if (!holes.length) return null;
  const O = street.O, lx = p.x - O.x, lz = p.z - O.z;
  for (const box of holes) {
    if (!inBox(lx, lz, box)) continue;
    const [x0, x1, z0, z1] = box;
    const cand = [
      { lx, lz: z0 - 1.4, d: Math.abs(lz - z0) },
      { lx, lz: z1 + 1.4, d: Math.abs(lz - z1) },
      { lx: x0 - 1.4, lz, d: Math.abs(lx - x0) },
      { lx: x1 + 1.4, lz, d: Math.abs(lx - x1) },
    ];
    let best = cand[0];
    for (const c of cand) if (c.d < best.d) best = c;
    const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
    return {
      key: street.key,
      surfaceY: (street.N && street.N.net === 'fz' && FZ_SURFACE[street.key] != null) ? FZ_SURFACE[street.key] : -0.5,
      shore: { x: O.x + best.lx, y: 0.05, z: O.z + best.lz, yaw: Math.atan2(cx - best.lx, cz - best.lz) },
    };
  }
  return null;
}

export function pickShore(p, street, lastSafe) {
  if (lastSafe && lastSafe.y > -0.15) return lastSafe;
  const wet = streetWaterAt(p, street);
  if (wet) return wet.shore;
  if (street && street.O) return { x: street.O.x, y: 0.05, z: street.O.z + 1.2, yaw: 0 };
  return null;
}

/** 挂上「回到岸上」按钮，每帧 tick：托住落水的人、决定要不要显示按钮 */
export function installShore({ player, hud, Audio }) {
  const hudEl = document.getElementById('hud');
  if (hudEl && !document.getElementById('bShore')) {
    hudEl.insertAdjacentHTML('beforeend', `<button id="bShore" class="btn shore" hidden type="button" aria-label="回到岸上"><span class="lbl">回到岸上</span></button>`);
  }
  const btn = document.getElementById('bShore');
  hudHit(btn);
  let lastSafe = null, held = null;

  const rescue = () => {
    const street = held && held.street;
    const s = pickShore(player.position, street, lastSafe);
    if (!s) return;
    player.spawn(s.x, s.y, s.z, s.yaw);
    hud.toast('回到岸上了');
    if (btn) btn.hidden = true;
    held = null;
    Audio.blip && Audio.blip('tap');
  };
  if (btn) pressable(btn, rescue);

  const tick = ({ street, zone, inTunnel }) => {
    const p = player.position;
    const onStreet = !!(zone && zone.kind === 'street' && !(street && street.inside));
    // 不要求脚沾地：刚传送到岸上的那一帧也可能还没落地，照样记住岸上的位置
    // 内河街区：只记真正的岸地（台阶顶、桥面、船上都在河道范围里，救上来不能放回那儿）
    if (!inTunnel && onStreet && p.y > -0.15 && p.y < 4 && !(street && street.safeAt && !street.safeAt(p))) {
      lastSafe = { x: p.x, y: Math.max(0.05, p.y), z: p.z, yaw: player.yaw };
    }
    const wet = streetWaterAt(p, street);
    // 内河街区：岸顶以下也有能站的地方（台阶、浮码头、船），只有真的在水面上才算落水；坐着（坐船）永远不算
    const river = !!(street && typeof street.waterAt === 'function');
    const inHole = !inTunnel && onStreet && p.y < -0.15 && (!river || (!player.seat && !!wet && p.y < wet.surfaceY + 0.8));
    if (!inHole) {
      held = null;
      if (btn) btn.hidden = true;
      return false;
    }
    if (wet) held = { ...wet, street };
    else if (street) held = { ...(held || {}), street, surfaceY: (held && held.surfaceY) || -2.6 };
    const surface = (wet && wet.surfaceY) || (held && held.surfaceY) || -2.6;
    if (p.y < surface + 0.05) {
      p.y = surface + 0.05;
      player.vy = 0;
      player.grounded = true;
    }
    if (btn) btn.hidden = false;
    return true;
  };

  return { tick, rescue };
}
