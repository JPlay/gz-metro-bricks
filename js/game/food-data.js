/*
 * 广州美食店数据（明明最爱吃）：10 家店、10 种广州招牌美食，每家在不同的车站街面上（站口外广场的一侧）。
 *   店名都是虚构的通用名字（不用真实品牌）；form = 门面样式：teahouse 茶楼 / qilou 骑楼老字号 / stall 街边档口。
 *   side：店在站口广场的西边（W，门朝东）还是东边（E，门朝西）。
 *   FOOD_BY_STATION[code] = 这一站的店（给车站景点播报用：以后可以并进 attraction 广播）。
 */
export const DISHES = {
  hargow:   { zh: '虾饺', en: 'Har gow (shrimp dumplings)', fact: '虾饺的皮是透明的，能看到里面粉红色的大虾仁！' },
  siumai:   { zh: '烧卖', en: 'Siu mai', fact: '烧卖顶上那一点橙色，是蟹籽或者胡萝卜粒哦。' },
  bao:      { zh: '叉烧包', en: 'Char siu bao', fact: '叉烧包蒸好会裂开一个口，像在哈哈大笑！' },
  cheungfun:{ zh: '肠粉', en: 'Cheung fun (rice rolls)', fact: '肠粉是把米浆铺在布上蒸出来的，又薄又滑，所以也叫“布拉肠”。' },
  wonton:   { zh: '云吞面', en: 'Wonton noodles', fact: '老广吃云吞面：云吞放碗底、面放上面，这样面不会泡软！' },
  goose:    { zh: '烧鹅', en: 'Roast goose', fact: '烧鹅烤之前要往皮下吹气，烤出来的皮才会又脆又亮。' },
  shuangpi: { zh: '双皮奶', en: 'Double-skin milk', fact: '双皮奶上面有两层奶皮，所以叫“双皮”！它是顺德人发明的。' },
  congee:   { zh: '砂锅粥', en: 'Clay-pot congee', fact: '砂锅粥在砂锅里一直咕嘟咕嘟熬，米粒都熬开了花，又绵又滑。' },
  claypot:  { zh: '煲仔饭', en: 'Clay-pot rice', fact: '煲仔饭锅底那层香脆的“饭焦”，是最好吃的部分！' },
  ngauzap:  { zh: '牛杂', en: 'Beef offal with radish', fact: '牛杂锅里的萝卜吸饱了汤汁，有时候比牛杂还抢手！' },
  chicken:  { zh: '白切鸡', en: 'White-cut chicken', fact: '白切鸡是把整只鸡放进热水里慢慢浸熟的，蘸姜葱酱最好吃。' },
  gingermilk:{ zh: '姜撞奶', en: 'Ginger milk curd', fact: '把热牛奶“撞”进姜汁里，什么都不用加，它自己就会凝固！' },
  milktea:  { zh: '菊花茶', en: 'Chrysanthemum tea', fact: '喝早茶的“茶”最重要：菊花茶清清甜甜的。' }
};
// 每家店：sign = 招牌底色 / 字色；wall = 店里墙面主色；accent = 点缀色；lantern = 灯笼 / 吊灯颜色；floor = 地砖色
export const RESTAURANTS = [
  { id: 'chalou',  code: 'gyq',  side: 'W', form: 'teahouse', name: '花城茶楼', en: 'Flower City Teahouse', sub: '早茶 · 虾饺 · 烧卖', dish: 'hargow', menu: ['hargow', 'siumai', 'bao'],
    sign: { bg: '#2B1A10', fg: '#F2C94C' }, wall: '#F3E6CF', accent: '#A8231C', lantern: '#E8443A', floor: '#B98A5A', near: '北京路' },
  { id: 'changfen', code: 'cjc', side: 'E', form: 'stall', name: '布拉肠粉', en: 'Steamed Rice Rolls', sub: '现拉现蒸', dish: 'cheungfun', menu: ['cheungfun'],
    sign: { bg: '#FFF4D6', fg: '#C0392B' }, wall: '#FBF3E4', accent: '#E07A2E', lantern: '#FFD66B', floor: '#D9D3C8', near: '陈家祠' },
  { id: 'yuntun', code: 'jnt', side: 'W', form: 'qilou', name: '竹升云吞面', en: 'Wonton Noodles', sub: '鲜虾云吞 · 竹升面', dish: 'wonton', menu: ['wonton'],
    sign: { bg: '#1E5B3A', fg: '#FFE7A0' }, wall: '#EAF2E4', accent: '#1E5B3A', lantern: '#FFE7A0', floor: '#CFC7B5', near: '纪念堂' },
  { id: 'shaola', code: 'hzgc', side: 'E', form: 'qilou', name: '珠江烧腊', en: 'Roast Goose & BBQ', sub: '烧鹅 · 叉烧', dish: 'goose', menu: ['goose'],
    sign: { bg: '#B3261E', fg: '#FFF2C8' }, wall: '#F6E2D2', accent: '#B3261E', lantern: '#FF6B4A', floor: '#C9B9A6', near: '海珠广场' },
  { id: 'tianpin', code: 'csl', side: 'W', form: 'qilou', name: '西关甜品', en: 'Xiguan Desserts', sub: '双皮奶 · 糖水', dish: 'shuangpi', menu: ['shuangpi'],
    sign: { bg: '#F7F1E6', fg: '#8E3B5A' }, wall: '#FCEFF3', accent: '#D86A8E', lantern: '#FFC4D6', floor: '#E8DCCB', near: '上下九' },
  { id: 'shaguozhou', code: 'hs', side: 'E', form: 'qilou', name: '鲜虾砂锅粥', en: 'Clay-pot Congee', sub: '生滚 · 鲜虾', dish: 'congee', menu: ['congee'],
    sign: { bg: '#24427A', fg: '#FFFFFF' }, wall: '#E6EEF7', accent: '#24427A', lantern: '#9FD3FF', floor: '#C8CDD3', near: '黄沙' },
  { id: 'baozaifan', code: 'yj', side: 'W', form: 'qilou', name: '炉火煲仔饭', en: 'Clay-pot Rice', sub: '腊味 · 饭焦香', dish: 'claypot', menu: ['claypot'],
    sign: { bg: '#5A2E14', fg: '#FFB347' }, wall: '#F4E3CF', accent: '#C2571A', lantern: '#FF9A3C', floor: '#A9805C', near: '杨箕' },
  { id: 'niuza', code: 'xmk', side: 'E', form: 'stall', name: '萝卜牛杂', en: 'Beef Offal & Radish', sub: '一串一串', dish: 'ngauzap', menu: ['ngauzap'],
    sign: { bg: '#F5B841', fg: '#5A2E14' }, wall: '#FFF3DA', accent: '#8C4A1E', lantern: '#FFE08A', floor: '#D8CBB4', near: '西门口' },
  { id: 'baiqieji', code: 'yxgy', side: 'E', form: 'teahouse', name: '五羊鸡饭店', en: 'White-cut Chicken', sub: '白切鸡 · 姜葱', dish: 'chicken', menu: ['chicken'],
    sign: { bg: '#123B2C', fg: '#F6E3A1' }, wall: '#F1F0E2', accent: '#2E7D4F', lantern: '#FFDF7A', floor: '#BFA987', near: '越秀公园' },
  { id: 'jiangzhuangnai', code: 'tyxl', side: 'W', form: 'stall', name: '暖暖姜撞奶', en: 'Ginger Milk Curd', sub: '热辣辣 · 滑嘟嘟', dish: 'gingermilk', menu: ['gingermilk'],
    sign: { bg: '#E85D75', fg: '#FFFFFF' }, wall: '#FFF0E6', accent: '#E85D75', lantern: '#FFD3A8', floor: '#E2D6C6', near: '体育西路' }
];
export const FOOD_BY_STATION = RESTAURANTS.reduce((m, r) => { (m[r.code] = m[r.code] || []).push({ id: r.id, name: r.name, dish: DISHES[r.dish].zh, form: r.form, side: r.side }); return m; }, {});
export const restaurantById = id => RESTAURANTS.find(r => r.id === id);
