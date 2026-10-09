# 缺失的报站语音片段

由 `node tools/audio/export_jobs.mjs` 生成。全网共需 407 条片段，已有 MP3 305 条，缺 102 条（普通话 34 / 粤语 34 / 英语 34）。
缺失片段在游戏里自动用 Web Speech 朗读（zh-CN → zh-HK（若有）→ en-US（若有），语速 0.95），并照常显示字幕。

生成方法：设置环境变量 DASHSCOPE_API_KEY 后运行 `python3 tools/audio/generate_voice.py`（会读取 voice-jobs.json，只生成缺的）。

| id | 语言 | 文本 |
| --- | --- | --- |
| voice.arrive.hzgc.zh | zh | 列车即将到达海珠广场站，请小心列车与站台之间的空隙。 |
| voice.arrive.hzgc.yue | yue | 列车即将到达海珠广场站，请小心列车同站台之间嘅空隙。 |
| voice.arrive.hzgc.en | en | The train is arriving at Haizhu Guangchang. Please mind the gap between the train and the platform. |
| voice.welcome.hzgc.zh | zh | 欢迎光临海珠广场站。请排队候车，先下后上。 |
| voice.welcome.hzgc.yue | yue | 欢迎光临海珠广场站。请排队候车，先落后上。 |
| voice.welcome.hzgc.en | en | Welcome to Haizhu Guangchang station. Please line up for the train. Let the passengers get off first before you get on. |
| voice.next.jnt.zh | zh | 下一站，纪念堂。 |
| voice.next.jnt.yue | yue | 下一站，纪念堂。 |
| voice.next.jnt.en | en | The next station is Jiniantang. |
| voice.arrive.jnt.zh | zh | 列车即将到达纪念堂站，请小心列车与站台之间的空隙。 |
| voice.arrive.jnt.yue | yue | 列车即将到达纪念堂站，请小心列车同站台之间嘅空隙。 |
| voice.arrive.jnt.en | en | The train is arriving at Jiniantang. Please mind the gap between the train and the platform. |
| voice.welcome.jnt.zh | zh | 欢迎光临纪念堂站。请排队候车，先下后上。 |
| voice.welcome.jnt.yue | yue | 欢迎光临纪念堂站。请排队候车，先落后上。 |
| voice.welcome.jnt.en | en | Welcome to Jiniantang station. Please line up for the train. Let the passengers get off first before you get on. |
| voice.next.yxgy.zh | zh | 下一站，越秀公园。 |
| voice.next.yxgy.yue | yue | 下一站，越秀公园。 |
| voice.next.yxgy.en | en | The next station is Yuexiu Gongyuan. |
| voice.arrive.yxgy.zh | zh | 列车即将到达越秀公园站，请小心列车与站台之间的空隙。 |
| voice.arrive.yxgy.yue | yue | 列车即将到达越秀公园站，请小心列车同站台之间嘅空隙。 |
| voice.arrive.yxgy.en | en | The train is arriving at Yuexiu Gongyuan. Please mind the gap between the train and the platform. |
| voice.welcome.yxgy.zh | zh | 欢迎光临越秀公园站。请排队候车，先下后上。 |
| voice.welcome.yxgy.yue | yue | 欢迎光临越秀公园站。请排队候车，先落后上。 |
| voice.welcome.yxgy.en | en | Welcome to Yuexiu Gongyuan station. Please line up for the train. Let the passengers get off first before you get on. |
| voice.next.gzhcz.zh | zh | 下一站，广州火车站，可换乘五号线。 |
| voice.next.gzhcz.yue | yue | 下一站，广州火车站，可换乘五号线。 |
| voice.next.gzhcz.en | en | The next station is Guangzhou Huochezhan, the interchange with Line Five. |
| voice.arrive.gzhcz.zh | zh | 列车即将到达广州火车站，请小心列车与站台之间的空隙。 |
| voice.arrive.gzhcz.yue | yue | 列车即将到达广州火车站，请小心列车同站台之间嘅空隙。 |
| voice.arrive.gzhcz.en | en | The train is arriving at Guangzhou Huochezhan. Please mind the gap between the train and the platform. |
| voice.welcome.gzhcz.zh | zh | 欢迎光临广州火车站。请排队候车，先下后上。 |
| voice.welcome.gzhcz.yue | yue | 欢迎光临广州火车站。请排队候车，先落后上。 |
| voice.welcome.gzhcz.en | en | Welcome to Guangzhou Huochezhan. Please line up for the train. Let the passengers get off first before you get on. |
| voice.next.syl.zh | zh | 下一站，三元里。 |
| voice.next.syl.yue | yue | 下一站，三元里。 |
| voice.next.syl.en | en | The next station is Sanyuanli. |
| voice.arrive.syl.zh | zh | 列车即将到达三元里站，请小心列车与站台之间的空隙。 |
| voice.arrive.syl.yue | yue | 列车即将到达三元里站，请小心列车同站台之间嘅空隙。 |
| voice.arrive.syl.en | en | The train is arriving at Sanyuanli. Please mind the gap between the train and the platform. |
| voice.welcome.syl.zh | zh | 欢迎光临三元里站。请排队候车，先下后上。 |
| voice.welcome.syl.yue | yue | 欢迎光临三元里站。请排队候车，先落后上。 |
| voice.welcome.syl.en | en | Welcome to Sanyuanli station. Please line up for the train. Let the passengers get off first before you get on. |
| voice.next.fxgy.zh | zh | 下一站，飞翔公园。 |
| voice.next.fxgy.yue | yue | 下一站，飞翔公园。 |
| voice.next.fxgy.en | en | The next station is Feixiang Gongyuan. |
| voice.arrive.fxgy.zh | zh | 列车即将到达飞翔公园站，请小心列车与站台之间的空隙。 |
| voice.arrive.fxgy.yue | yue | 列车即将到达飞翔公园站，请小心列车同站台之间嘅空隙。 |
| voice.arrive.fxgy.en | en | The train is arriving at Feixiang Gongyuan. Please mind the gap between the train and the platform. |
| voice.welcome.fxgy.zh | zh | 欢迎光临飞翔公园站。请排队候车，先下后上。 |
| voice.welcome.fxgy.yue | yue | 欢迎光临飞翔公园站。请排队候车，先落后上。 |
| voice.welcome.fxgy.en | en | Welcome to Feixiang Gongyuan station. Please line up for the train. Let the passengers get off first before you get on. |
| voice.next.bygy.zh | zh | 下一站，白云公园。 |
| voice.next.bygy.yue | yue | 下一站，白云公园。 |
| voice.next.bygy.en | en | The next station is Baiyun Gongyuan. |
| voice.arrive.bygy.zh | zh | 列车即将到达白云公园站，请小心列车与站台之间的空隙。 |
| voice.arrive.bygy.yue | yue | 列车即将到达白云公园站，请小心列车同站台之间嘅空隙。 |
| voice.arrive.bygy.en | en | The train is arriving at Baiyun Gongyuan. Please mind the gap between the train and the platform. |
| voice.welcome.bygy.zh | zh | 欢迎光临白云公园站。请排队候车，先下后上。 |
| voice.welcome.bygy.yue | yue | 欢迎光临白云公园站。请排队候车，先落后上。 |
| voice.welcome.bygy.en | en | Welcome to Baiyun Gongyuan station. Please line up for the train. Let the passengers get off first before you get on. |
| voice.next.bywhgc.zh | zh | 下一站，白云文化广场，可换乘十二号线。 |
| voice.next.bywhgc.yue | yue | 下一站，白云文化广场，可换乘十二号线。 |
| voice.next.bywhgc.en | en | The next station is Baiyun Wenhua Guangchang, the interchange with Line Twelve. |
| voice.arrive.bywhgc.zh | zh | 列车即将到达白云文化广场站，请小心列车与站台之间的空隙。 |
| voice.arrive.bywhgc.yue | yue | 列车即将到达白云文化广场站，请小心列车同站台之间嘅空隙。 |
| voice.arrive.bywhgc.en | en | The train is arriving at Baiyun Wenhua Guangchang. Please mind the gap between the train and the platform. |
| voice.welcome.bywhgc.zh | zh | 欢迎光临白云文化广场站。请排队候车，先下后上。 |
| voice.welcome.bywhgc.yue | yue | 欢迎光临白云文化广场站。请排队候车，先落后上。 |
| voice.welcome.bywhgc.en | en | Welcome to Baiyun Wenhua Guangchang station. Please line up for the train. Let the passengers get off first before you get on. |
| voice.next.xg.zh | zh | 下一站，萧岗。 |
| voice.next.xg.yue | yue | 下一站，萧岗。 |
| voice.next.xg.en | en | The next station is Xiaogang. |
| voice.arrive.xg.zh | zh | 列车即将到达萧岗站，请小心列车与站台之间的空隙。 |
| voice.arrive.xg.yue | yue | 列车即将到达萧岗站，请小心列车同站台之间嘅空隙。 |
| voice.arrive.xg.en | en | The train is arriving at Xiaogang. Please mind the gap between the train and the platform. |
| voice.welcome.xg.zh | zh | 欢迎光临萧岗站。请排队候车，先下后上。 |
| voice.welcome.xg.yue | yue | 欢迎光临萧岗站。请排队候车，先落后上。 |
| voice.welcome.xg.en | en | Welcome to Xiaogang station. Please line up for the train. Let the passengers get off first before you get on. |
| voice.next.jx.zh | zh | 下一站，江夏。 |
| voice.next.jx.yue | yue | 下一站，江夏。 |
| voice.next.jx.en | en | The next station is Jiangxia. |
| voice.arrive.jx.zh | zh | 列车即将到达江夏站，请小心列车与站台之间的空隙。 |
| voice.arrive.jx.yue | yue | 列车即将到达江夏站，请小心列车同站台之间嘅空隙。 |
| voice.arrive.jx.en | en | The train is arriving at Jiangxia. Please mind the gap between the train and the platform. |
| voice.welcome.jx.zh | zh | 欢迎光临江夏站。请排队候车，先下后上。 |
| voice.welcome.jx.yue | yue | 欢迎光临江夏站。请排队候车，先落后上。 |
| voice.welcome.jx.en | en | Welcome to Jiangxia station. Please line up for the train. Let the passengers get off first before you get on. |
| voice.next.hb.zh | zh | 下一站，黄边。 |
| voice.next.hb.yue | yue | 下一站，黄边。 |
| voice.next.hb.en | en | The next station is Huangbian. |
| voice.arrive.hb.zh | zh | 列车即将到达黄边站，请小心列车与站台之间的空隙。 |
| voice.arrive.hb.yue | yue | 列车即将到达黄边站，请小心列车同站台之间嘅空隙。 |
| voice.arrive.hb.en | en | The train is arriving at Huangbian. Please mind the gap between the train and the platform. |
| voice.welcome.hb.zh | zh | 欢迎光临黄边站。请排队候车，先下后上。 |
| voice.welcome.hb.yue | yue | 欢迎光临黄边站。请排队候车，先落后上。 |
| voice.welcome.hb.en | en | Welcome to Huangbian station. Please line up for the train. Let the passengers get off first before you get on. |
| voice.arrive.jhwg.zh | zh | 列车即将到达嘉禾望岗站，请小心列车与站台之间的空隙。 |
| voice.arrive.jhwg.yue | yue | 列车即将到达嘉禾望岗站，请小心列车同站台之间嘅空隙。 |
| voice.arrive.jhwg.en | en | The train is arriving at Jiahewanggang. Please mind the gap between the train and the platform. |
| voice.welcome.jhwg.zh | zh | 欢迎光临嘉禾望岗站。请排队候车，先下后上。 |
| voice.welcome.jhwg.yue | yue | 欢迎光临嘉禾望岗站。请排队候车，先落后上。 |
| voice.welcome.jhwg.en | en | Welcome to Jiahewanggang station. Please line up for the train. Let the passengers get off first before you get on. |
