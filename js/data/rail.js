/*
 * 国铁动车：广州东 ⇄ 厦门北（经厦深铁路）。游戏里时间压缩成约 3 分钟一程，中途不停站。
 * 数据来源（2026-10-22 核对）：
 *   [1] 高铁旅行网 广州东→厦门北时刻表 https://www.gaotie.com.cn/lieche/guangzhoudong-xiamenbei.html
 *       —— D2315/D2318 广州东 14:20 开，厦门北 18:57 到（4 小时 37 分，经停 10 站）
 *   [2] 铁路网 D2315 次时刻表 https://www.crecc.com/huoche/d2315.html —— 经停 东莞、东莞南、深圳北（之后改为 D2318）、深圳坪山、惠阳、葵潭、
 *       潮汕、诏安、云霄、漳州、厦门北（再往北开到南平市）
 *   [3] 高铁旅行网 厦门北→广州东 https://www.gaotie.com.cn/lieche/xiamenbei-guangzhoudong.html —— D3311/D3310 厦门北 15:18 开，广州东 19:17 到
 *   [4] 中文维基百科 厦深铁路 https://zh.wikipedia.org/wiki/厦深铁路 ；新浪广东《厦深高铁“秘密”数据说桥隧》（桥梁 145 座、隧道 74 座；
 *       九龙江特大桥 4572.657 m 在厦门北—漳州共线段，跨九龙江北溪北港、南港和西溪，是进厦门前最后一座大桥）
 * 车窗外：广州城区 → 珠三角 / 潮汕的田野 → 粤东闽南的山和隧道 → 九龙江特大桥（九龙江入海口的宽阔水面）→ 厦门（集美）。
 */
/**
 * 城市表：每个城市一座高铁站（游戏里的“国铁站”），dests = 从这里能坐动车去的城市（顺序 = 选目的地卡片的顺序，第一个是默认）。
 * 只有一个目的地时不弹选择卡片（坐下就开）。
 */
export const CITIES = {
  gz: { zh: '广州', en: 'Guangzhou', icon: '🏙️', stn: '广州东站', stnEn: 'Guangzhoudong', dests: ['xm'] },
  xm: { zh: '厦门', en: 'Xiamen', icon: '🌊', stn: '厦门北站', stnEn: 'Xiamenbei', dests: ['gz'] }
};
/** 车次表：键 = 'from>to'（城市代码）。ann = 报站片段 id 用的键（广州⇄厦门沿用旧 id：emu.depart.xm / emu.depart.gz，已有 MP3） */
export const TRIPS = {
  'gz>xm': { fromCity: 'gz', toCity: 'xm', ann: 'xm', train: 'D2315', from: '广州东', to: '厦门北', fromEn: 'Guangzhoudong', toEn: 'Xiamenbei', dep: '14:20', arr: '18:57', car: '05',
    bridge: { toast: '九龙江特大桥 · 九龙江入海口', ann: 'bridge' } },
  'xm>gz': { fromCity: 'xm', toCity: 'gz', ann: 'gz', train: 'D3311', from: '厦门北', to: '广州东', fromEn: 'Xiamenbei', toEn: 'Guangzhoudong', dep: '15:18', arr: '19:17', car: '05',
    bridge: { toast: '九龙江特大桥 · 九龙江入海口', ann: 'bridge' } }
};
// trip.from / trip.to = 车厢显示屏 / HUD 上的站名（不带“站”）；fromCity / toCity = 城市代码
for (const t of Object.values(TRIPS)) t.key = t.fromCity + '>' + t.toCity;
export const tripKey = (from, to) => from + '>' + to;
export function tripFor(from, to) { return TRIPS[tripKey(from, to)] || null; }
/** 从 city 出发能去的城市（只列有车次的） */
export function destsFrom(city) { return ((CITIES[city] || {}).dests || []).filter(d => TRIPS[tripKey(city, d)]); }
/** 旧接口：RAIL[dest]（按目的地）。只在每个城市只有一个出发站时有意义；新代码用 tripFor(from, to) */
export const RAIL = { xm: TRIPS['gz>xm'], gz: TRIPS['xm>gz'] };
/**
 * 一程的路段（行驶秒数，×1 速度；关门 + 起步约 6 s，到站前制动约 17 s）。
 * far / mid / near：车窗外三层远景的内容（js/world/emuScenery.js）；toast：路过时的小提示；ann：路过时的广播（js/data/phrases.js）。
 */
const OUT = [
  { t: 0, far: 'city', mid: 'city', near: 'city' },
  { t: 48, far: 'fields', mid: 'fields', near: 'fields' },
  { t: 84, far: 'mount', mid: 'mount', near: 'mount' },
  { t: 94, near: 'tunnel', tunnel: true },
  { t: 102, near: 'mount' },
  { t: 110, near: 'tunnel', tunnel: true, far: 'sea', mid: 'sea' },   // 远景 / 中景在隧道里整片换成海（看不见的时候换，出洞就看到海）
  { t: 119, near: 'mount' },
  { t: 128, far: 'sea', mid: 'sea', near: 'bridge', bridge: true },
  { t: 140, far: 'xiamen', bridge: true },   // 过桥后半段：对岸厦门的楼群才出现（远景层移得慢，约 15 s 后进入窗口）
  { t: 156, far: 'xiamen', mid: 'xiamen', near: 'fields' }
];
const BACK = [
  { t: 0, far: 'xiamen', mid: 'xiamen', near: 'fields' },
  { t: 22, far: 'sea', mid: 'sea', near: 'bridge', bridge: true },
  { t: 50, far: 'mount', mid: 'mount', near: 'mount' },
  { t: 60, near: 'tunnel', tunnel: true },
  { t: 69, near: 'mount' },
  { t: 77, near: 'tunnel', tunnel: true },
  { t: 85, near: 'mount' },
  { t: 98, far: 'fields', mid: 'fields', near: 'fields' },
  { t: 134, far: 'city', mid: 'city', near: 'city' }
];
/** 行驶 TRIP 秒后开始进站制动 */
export const TRIP = { brakeAt: 166, brakeDist: 600, vmax: 70 };
const ROUTES = { 'gz>xm': OUT, 'xm>gz': BACK };
/** 一程的路段：routeFor(from, to)；旧写法 routeFor(dest) 仍可用（广州⇄厦门） */
export function routeFor(from, to) {
  if (to === undefined) { to = from; from = to === 'xm' ? 'gz' : 'xm'; }
  return ROUTES[tripKey(from, to)] || OUT;
}
export function registerRoute(from, to, route) { ROUTES[tripKey(from, to)] = route; }
