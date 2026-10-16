# 缺失的报站语音片段

由 `node tools/audio/export_jobs.mjs` 生成。全网共需 473 条片段，已有 MP3 413 条，缺 60 条（普通话 20 / 粤语 20 / 英语 20）。
缺失片段在游戏里自动用 Web Speech 朗读（zh-CN → zh-HK（若有）→ en-US（若有），语速 0.95），并照常显示字幕。

生成方法：设置环境变量 DASHSCOPE_API_KEY 后运行 `python3 tools/audio/generate_voice.py`（会读取 voice-jobs.json，只生成缺的）。

| id | 语言 | 文本 |
| --- | --- | --- |
| voice.visit.kk.zh | zh | 坑口站附近有芳村黄大仙祠，欢迎下车游玩，请从B出口出站。 |
| voice.visit.kk.yue | yue | 坑口站附近有芳村黄大仙祠，欢迎落车游玩，请喺B出口出站。 |
| voice.visit.kk.en | en | Kengkou station is near Fangcun Wong Tai Sin Temple. You are welcome to get off and visit. Please use Exit B. |
| voice.visit.fc.zh | zh | 芳村站附近有醉观公园，欢迎下车游玩，请从D出口出站。 |
| voice.visit.fc.yue | yue | 芳村站附近有醉观公园，欢迎落车游玩，请喺D出口出站。 |
| voice.visit.fc.en | en | Fangcun station is near Zuiguan Park. You are welcome to get off and visit. Please use Exit D. |
| voice.visit.hs.zh | zh | 黄沙站附近有沙面，欢迎下车游玩，请从D出口出站。 |
| voice.visit.hs.yue | yue | 黄沙站附近有沙面，欢迎落车游玩，请喺D出口出站。 |
| voice.visit.hs.en | en | Huangsha station is near Shamian Island. You are welcome to get off and visit. Please use Exit D. |
| voice.visit.csl.zh | zh | 长寿路站附近有上下九步行街、荔枝湾涌，欢迎下车游玩，请从A出口出站。 |
| voice.visit.csl.yue | yue | 长寿路站附近有上下九步行街、荔枝湾涌，欢迎落车游玩，请喺A出口出站。 |
| voice.visit.csl.en | en | Changshou Lu station is near Shangxiajiu Pedestrian Street and Lizhiwan Creek. You are welcome to get off and visit. Please use Exit A. |
| voice.visit.cjc.zh | zh | 陈家祠站附近有陈家祠，欢迎下车游玩，请从C出口出站。 |
| voice.visit.cjc.yue | yue | 陈家祠站附近有陈家祠，欢迎落车游玩，请喺C出口出站。 |
| voice.visit.cjc.en | en | Chenjiaci station is near the Chen Clan Ancestral Hall. You are welcome to get off and visit. Please use Exit C. |
| voice.visit.xmk.zh | zh | 西门口站附近有光孝寺，欢迎下车游玩。 |
| voice.visit.xmk.yue | yue | 西门口站附近有光孝寺，欢迎落车游玩。 |
| voice.visit.xmk.en | en | Ximenkou station is near Guangxiao Temple. You are welcome to get off and visit. |
| voice.visit.gyq.zh | zh | 公园前站附近有人民公园、北京路步行街，欢迎下车游玩。 |
| voice.visit.gyq.yue | yue | 公园前站附近有人民公园、北京路步行街，欢迎落车游玩。 |
| voice.visit.gyq.en | en | Gongyuanqian station is near the People's Park and Beijing Road Pedestrian Street. You are welcome to get off and visit. |
| voice.visit.lsly.zh | zh | 烈士陵园站附近有广州起义烈士陵园，欢迎下车游玩，请从C出口出站。 |
| voice.visit.lsly.yue | yue | 烈士陵园站附近有广州起义烈士陵园，欢迎落车游玩，请喺C出口出站。 |
| voice.visit.lsly.en | en | Lieshi Lingyuan station is near the Guangzhou Uprising Martyrs' Cemetery. You are welcome to get off and visit. Please use Exit C. |
| voice.visit.dsk.zh | zh | 东山口站附近有东山口红砖洋楼、东山湖公园，欢迎下车游玩。 |
| voice.visit.dsk.yue | yue | 东山口站附近有东山口红砖洋楼、东山湖公园，欢迎落车游玩。 |
| voice.visit.dsk.en | en | Dongshankou station is near the Dongshankou red-brick villas and Dongshan Lake Park. You are welcome to get off and visit. |
| voice.visit.tyzx.zh | zh | 体育中心站附近有天河体育中心，欢迎下车游玩，请从C出口出站。 |
| voice.visit.tyzx.yue | yue | 体育中心站附近有天河体育中心，欢迎落车游玩，请喺C出口出站。 |
| voice.visit.tyzx.en | en | Tiyu Zhongxin station is near the Tianhe Sports Center. You are welcome to get off and visit. Please use Exit C. |
| voice.visit.gzdz.zh | zh | 广州东站附近有天河飘绢，欢迎下车游玩，请从F出口出站。 |
| voice.visit.gzdz.yue | yue | 广州东站附近有天河飘绢，欢迎落车游玩，请喺F出口出站。 |
| voice.visit.gzdz.en | en | Guangzhou Dongzhan is near the Tianhe Floating Silk fountain. You are welcome to get off and visit. Please use Exit F. |
| voice.visit.lx.zh | zh | 洛溪站附近有洛溪大桥、洛浦公园，欢迎下车游玩。 |
| voice.visit.lx.yue | yue | 洛溪站附近有洛溪大桥、洛浦公园，欢迎落车游玩。 |
| voice.visit.lx.en | en | Luoxi station is near Luoxi Bridge and Luopu Park. You are welcome to get off and visit. |
| voice.visit.nz.zh | zh | 南洲站附近有海珠儿童公园、陈李济中药博物馆，欢迎下车游玩。 |
| voice.visit.nz.yue | yue | 南洲站附近有海珠儿童公园、陈李济中药博物馆，欢迎落车游玩。 |
| voice.visit.nz.en | en | Nanzhou station is near Haizhu Children's Park and the Chen Li Ji Chinese Medicine Museum. You are welcome to get off and visit. |
| voice.visit.jnx.zh | zh | 江南西站附近有十香园，欢迎下车游玩。 |
| voice.visit.jnx.yue | yue | 江南西站附近有十香园，欢迎落车游玩。 |
| voice.visit.jnx.en | en | Jiangnanxi station is near the Shixiang Garden. You are welcome to get off and visit. |
| voice.visit.seg.zh | zh | 市二宫站附近有孙中山大元帅府纪念馆，欢迎下车游玩，请从A出口出站。 |
| voice.visit.seg.yue | yue | 市二宫站附近有孙中山大元帅府纪念馆，欢迎落车游玩，请喺A出口出站。 |
| voice.visit.seg.en | en | Shi'ergong station is near the Memorial Museum of Sun Yat-sen's Generalissimo Mansion. You are welcome to get off and visit. Please use Exit A. |
| voice.visit.hzgc.zh | zh | 海珠广场站附近有石室圣心大教堂，欢迎下车游玩，请从B2出口出站。 |
| voice.visit.hzgc.yue | yue | 海珠广场站附近有石室圣心大教堂，欢迎落车游玩，请喺B2出口出站。 |
| voice.visit.hzgc.en | en | Haizhu Guangchang station is near the Sacred Heart Cathedral. You are welcome to get off and visit. Please use Exit B2. |
| voice.visit.yxgy.zh | zh | 越秀公园站附近有越秀公园五羊石像、镇海楼，欢迎下车游玩，请从B1出口出站。 |
| voice.visit.yxgy.yue | yue | 越秀公园站附近有越秀公园五羊石像、镇海楼，欢迎落车游玩，请喺B1出口出站。 |
| voice.visit.yxgy.en | en | Yuexiu Gongyuan station is near the Five Rams Statue in Yuexiu Park and Zhenhai Tower. You are welcome to get off and visit. Please use Exit B1. |
| voice.visit.syl.zh | zh | 三元里站附近有三元里人民抗英斗争纪念馆，欢迎下车游玩，请从B出口出站。 |
| voice.visit.syl.yue | yue | 三元里站附近有三元里人民抗英斗争纪念馆，欢迎落车游玩，请喺B出口出站。 |
| voice.visit.syl.en | en | Sanyuanli station is near the Sanyuanli Anti-British Struggle Memorial. You are welcome to get off and visit. Please use Exit B. |
| voice.visit.bygy.zh | zh | 白云公园站附近有白云公园，欢迎下车游玩，请从A出口出站。 |
| voice.visit.bygy.yue | yue | 白云公园站附近有白云公园，欢迎落车游玩，请喺A出口出站。 |
| voice.visit.bygy.en | en | Baiyun Gongyuan station is near Baiyun Park. You are welcome to get off and visit. Please use Exit A. |
| voice.visit.bywhgc.zh | zh | 白云文化广场站附近有广州城市规划展览中心，欢迎下车游玩，请从A出口出站。 |
| voice.visit.bywhgc.yue | yue | 白云文化广场站附近有广州城市规划展览中心，欢迎落车游玩，请喺A出口出站。 |
| voice.visit.bywhgc.en | en | Baiyun Wenhua Guangchang station is near the Guangzhou Urban Planning Exhibition Center. You are welcome to get off and visit. Please use Exit A. |
