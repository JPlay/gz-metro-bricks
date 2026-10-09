# 缺失的报站语音片段

由 `node tools/audio/export_jobs.mjs` 生成。全网共需 407 条片段，已有 MP3 354 条，缺 53 条（普通话 17 / 粤语 18 / 英语 18）。
缺失片段在游戏里自动用 Web Speech 朗读（zh-CN → zh-HK（若有）→ en-US（若有），语速 0.95），并照常显示字幕。

生成方法：设置环境变量 DASHSCOPE_API_KEY 后运行 `python3 tools/audio/generate_voice.py`（会读取 voice-jobs.json，只生成缺的）。

| id | 语言 | 文本 |
| --- | --- | --- |
| voice.welcome.fxgy.yue | yue | 欢迎光临飞翔公园站。请排队候车，先落后上。 |
| voice.welcome.fxgy.en | en | Welcome to Feixiang Gongyuan station. Please line up for the train. Let the passengers get off first before you get on. |
| voice.next.bygy.zh | zh | 下一站，白云公园。 |
| voice.next.bygy.yue | yue | 下一站，白云公园。 |
| voice.next.bygy.en | en | The next station is Baiyun Gongyuan. |
| voice.arrive.bygy.zh | zh | 列车即将到达白云公园站，请小心列车与站台之间的空隙。 |
| voice.arrive.bygy.yue | yue | 列车即将到达白云公园站，请小心列车同站台之间的空隙。 |
| voice.arrive.bygy.en | en | The train is arriving at Baiyun Gongyuan. Please mind the gap between the train and the platform. |
| voice.welcome.bygy.zh | zh | 欢迎光临白云公园站。请排队候车，先下后上。 |
| voice.welcome.bygy.yue | yue | 欢迎光临白云公园站。请排队候车，先落后上。 |
| voice.welcome.bygy.en | en | Welcome to Baiyun Gongyuan station. Please line up for the train. Let the passengers get off first before you get on. |
| voice.next.bywhgc.zh | zh | 下一站，白云文化广场，可换乘十二号线。 |
| voice.next.bywhgc.yue | yue | 下一站，白云文化广场，可换乘十二号线。 |
| voice.next.bywhgc.en | en | The next station is Baiyun Wenhua Guangchang, the interchange with Line Twelve. |
| voice.arrive.bywhgc.zh | zh | 列车即将到达白云文化广场站，请小心列车与站台之间的空隙。 |
| voice.arrive.bywhgc.yue | yue | 列车即将到达白云文化广场站，请小心列车同站台之间的空隙。 |
| voice.arrive.bywhgc.en | en | The train is arriving at Baiyun Wenhua Guangchang. Please mind the gap between the train and the platform. |
| voice.welcome.bywhgc.zh | zh | 欢迎光临白云文化广场站。请排队候车，先下后上。 |
| voice.welcome.bywhgc.yue | yue | 欢迎光临白云文化广场站。请排队候车，先落后上。 |
| voice.welcome.bywhgc.en | en | Welcome to Baiyun Wenhua Guangchang station. Please line up for the train. Let the passengers get off first before you get on. |
| voice.next.xg.zh | zh | 下一站，萧岗。 |
| voice.next.xg.yue | yue | 下一站，萧岗。 |
| voice.next.xg.en | en | The next station is Xiaogang. |
| voice.arrive.xg.zh | zh | 列车即将到达萧岗站，请小心列车与站台之间的空隙。 |
| voice.arrive.xg.yue | yue | 列车即将到达萧岗站，请小心列车同站台之间的空隙。 |
| voice.arrive.xg.en | en | The train is arriving at Xiaogang. Please mind the gap between the train and the platform. |
| voice.welcome.xg.zh | zh | 欢迎光临萧岗站。请排队候车，先下后上。 |
| voice.welcome.xg.yue | yue | 欢迎光临萧岗站。请排队候车，先落后上。 |
| voice.welcome.xg.en | en | Welcome to Xiaogang station. Please line up for the train. Let the passengers get off first before you get on. |
| voice.next.jx.zh | zh | 下一站，江夏。 |
| voice.next.jx.yue | yue | 下一站，江夏。 |
| voice.next.jx.en | en | The next station is Jiangxia. |
| voice.arrive.jx.zh | zh | 列车即将到达江夏站，请小心列车与站台之间的空隙。 |
| voice.arrive.jx.yue | yue | 列车即将到达江夏站，请小心列车同站台之间的空隙。 |
| voice.arrive.jx.en | en | The train is arriving at Jiangxia. Please mind the gap between the train and the platform. |
| voice.welcome.jx.zh | zh | 欢迎光临江夏站。请排队候车，先下后上。 |
| voice.welcome.jx.yue | yue | 欢迎光临江夏站。请排队候车，先落后上。 |
| voice.welcome.jx.en | en | Welcome to Jiangxia station. Please line up for the train. Let the passengers get off first before you get on. |
| voice.next.hb.zh | zh | 下一站，黄边。 |
| voice.next.hb.yue | yue | 下一站，黄边。 |
| voice.next.hb.en | en | The next station is Huangbian. |
| voice.arrive.hb.zh | zh | 列车即将到达黄边站，请小心列车与站台之间的空隙。 |
| voice.arrive.hb.yue | yue | 列车即将到达黄边站，请小心列车同站台之间的空隙。 |
| voice.arrive.hb.en | en | The train is arriving at Huangbian. Please mind the gap between the train and the platform. |
| voice.welcome.hb.zh | zh | 欢迎光临黄边站。请排队候车，先下后上。 |
| voice.welcome.hb.yue | yue | 欢迎光临黄边站。请排队候车，先落后上。 |
| voice.welcome.hb.en | en | Welcome to Huangbian station. Please line up for the train. Let the passengers get off first before you get on. |
| voice.arrive.jhwg.zh | zh | 列车即将到达嘉禾望岗站，请小心列车与站台之间的空隙。 |
| voice.arrive.jhwg.yue | yue | 列车即将到达嘉禾望岗站，请小心列车同站台之间的空隙。 |
| voice.arrive.jhwg.en | en | The train is arriving at Jiahewanggang. Please mind the gap between the train and the platform. |
| voice.welcome.jhwg.zh | zh | 欢迎光临嘉禾望岗站。请排队候车，先下后上。 |
| voice.welcome.jhwg.yue | yue | 欢迎光临嘉禾望岗站。请排队候车，先落后上。 |
| voice.welcome.jhwg.en | en | Welcome to Jiahewanggang station. Please line up for the train. Let the passengers get off first before you get on. |
