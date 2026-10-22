# 缺失的报站语音片段

由 `node tools/audio/export_jobs.mjs` 生成。全网共需 857 条片段，已有 MP3 507 条，缺 350 条（普通话 175 / 粤语 0 / 英语 175）。
缺失片段在游戏里自动用 Web Speech 朗读（zh-CN → zh-HK（若有）→ en-US（若有），语速 0.95），并照常显示字幕。

生成方法：设置环境变量 DASHSCOPE_API_KEY 后运行 `python3 tools/audio/generate_voice.py`（会读取 voice-jobs.json，只生成缺的）。

| id | 语言 | 文本 |
| --- | --- | --- |
| voice.terminal.xmzhl.zh | zh | 下一站是本次列车的终点站，镇海路。请全部乘客带齐行李物品在此站下车，欢迎再次乘坐厦门地铁。 |
| voice.terminal.xmzhl.en | en | The next station is Zhenhailu, the terminal of this journey. Please take all your belongings and leave the train. Thank you for travelling on Xiamen Metro. |
| voice.destination.xmyan.zh | zh | 本次列车终点站为岩内。 |
| voice.destination.xmyan.en | en | The destination of this train is Yannei. |
| voice.terminal.xmyan.zh | zh | 下一站是本次列车的终点站，岩内。请全部乘客带齐行李物品在此站下车，欢迎再次乘坐厦门地铁。 |
| voice.terminal.xmyan.en | en | The next station is Yannei, the terminal of this journey. Please take all your belongings and leave the train. Thank you for travelling on Xiamen Metro. |
| voice.platform.xmyan.1.zh | zh | 一站台，岩内方向列车即将进站。 |
| voice.platform.xmyan.1.en | en | The train bound for Yannei is approaching at Platform 1. |
| voice.platform.xmyan.2.zh | zh | 二站台，岩内方向列车即将进站。 |
| voice.platform.xmyan.2.en | en | The train bound for Yannei is approaching at Platform 2. |
| voice.arrive.yan.zh | zh | 列车即将到达岩内站，请小心列车与站台之间的空隙。 |
| voice.arrive.yan.en | en | The train is arriving at Yannei. Please mind the gap between the train and the platform. |
| voice.welcome.yan.zh | zh | 欢迎光临岩内站。请排队候车，先下后上。 |
| voice.welcome.yan.en | en | Welcome to Yannei station. Please line up for the train. Let the passengers get off first before you get on. |
| voice.next.xmnb.zh | zh | 下一站，厦门北站，可换乘4号线。 |
| voice.next.xmnb.en | en | The next station is Xiamen North Railway Station, the interchange with Line 4. |
| voice.welcome.tsl.zh | zh | 欢迎光临天水路站。请排队候车，先下后上。 |
| voice.welcome.tsl.en | en | Welcome to Tianshui Lu station. Please line up for the train. Let the passengers get off first before you get on. |
| voice.next.jmd.zh | zh | 下一站，集美大道。 |
| voice.next.jmd.en | en | The next station is Jimei Dadao. |
| voice.arrive.jmd.zh | zh | 列车即将到达集美大道站，请小心列车与站台之间的空隙。 |
| voice.arrive.jmd.en | en | The train is arriving at Jimei Dadao. Please mind the gap between the train and the platform. |
| voice.welcome.jmd.zh | zh | 欢迎光临集美大道站。请排队候车，先下后上。 |
| voice.welcome.jmd.en | en | Welcome to Jimei Dadao station. Please line up for the train. Let the passengers get off first before you get on. |
| voice.next.jsr.zh | zh | 下一站，集美软件园。 |
| voice.next.jsr.en | en | The next station is Jimei Software Park. |
| voice.arrive.jsr.zh | zh | 列车即将到达集美软件园站，请小心列车与站台之间的空隙。 |
| voice.arrive.jsr.en | en | The train is arriving at Jimei Software Park. Please mind the gap between the train and the platform. |
| voice.welcome.jsr.zh | zh | 欢迎光临集美软件园站。请排队候车，先下后上。 |
| voice.welcome.jsr.en | en | Welcome to Jimei Software Park station. Please line up for the train. Let the passengers get off first before you get on. |
| voice.next.cyg.zh | zh | 下一站，诚毅广场。 |
| voice.next.cyg.en | en | The next station is Chengyi Guangchang. |
| voice.arrive.cyg.zh | zh | 列车即将到达诚毅广场站，请小心列车与站台之间的空隙。 |
| voice.arrive.cyg.en | en | The train is arriving at Chengyi Guangchang. Please mind the gap between the train and the platform. |
| voice.welcome.cyg.zh | zh | 欢迎光临诚毅广场站。请排队候车，先下后上。 |
| voice.welcome.cyg.en | en | Welcome to Chengyi Guangchang station. Please line up for the train. Let the passengers get off first before you get on. |
| voice.xmvisit.cyg.zh | zh | 诚毅广场站附近有集美市民广场、诚毅科技探索中心，欢迎下车游玩。 |
| voice.xmvisit.cyg.en | en | Chengyi Guangchang station is near Jimei Civic Square and the Chengyi Science and Technology Exploration Center. You are welcome to get off and visit. |
| voice.next.grn.zh | zh | 下一站，官任，可换乘6号线。 |
| voice.next.grn.en | en | The next station is Guanren, the interchange with Line 6. |
| voice.arrive.grn.zh | zh | 列车即将到达官任站，请小心列车与站台之间的空隙。 |
| voice.arrive.grn.en | en | The train is arriving at Guanren. Please mind the gap between the train and the platform. |
| voice.welcome.grn.zh | zh | 欢迎光临官任站。请排队候车，先下后上。 |
| voice.welcome.grn.en | en | Welcome to Guanren station. Please line up for the train. Let the passengers get off first before you get on. |
| voice.next.xjl.zh | zh | 下一站，杏锦路。 |
| voice.next.xjl.en | en | The next station is Xingjin Lu. |
| voice.arrive.xjl.zh | zh | 列车即将到达杏锦路站，请小心列车与站台之间的空隙。 |
| voice.arrive.xjl.en | en | The train is arriving at Xingjin Lu. Please mind the gap between the train and the platform. |
| voice.welcome.xjl.zh | zh | 欢迎光临杏锦路站。请排队候车，先下后上。 |
| voice.welcome.xjl.en | en | Welcome to Xingjin Lu station. Please line up for the train. Let the passengers get off first before you get on. |
| voice.next.xlv.zh | zh | 下一站，杏林村。 |
| voice.next.xlv.en | en | The next station is Xinglin Cun. |
| voice.arrive.xlv.zh | zh | 列车即将到达杏林村站，请小心列车与站台之间的空隙。 |
| voice.arrive.xlv.en | en | The train is arriving at Xinglin Cun. Please mind the gap between the train and the platform. |
| voice.welcome.xlv.zh | zh | 欢迎光临杏林村站。请排队候车，先下后上。 |
| voice.welcome.xlv.en | en | Welcome to Xinglin Cun station. Please line up for the train. Let the passengers get off first before you get on. |
| voice.next.yby.zh | zh | 下一站，园博苑。 |
| voice.next.yby.en | en | The next station is Yuanboyuan. |
| voice.arrive.yby.zh | zh | 列车即将到达园博苑站，请小心列车与站台之间的空隙。 |
| voice.arrive.yby.en | en | The train is arriving at Yuanboyuan. Please mind the gap between the train and the platform. |
| voice.welcome.yby.zh | zh | 欢迎光临园博苑站。请排队候车，先下后上。 |
| voice.welcome.yby.en | en | Welcome to Yuanboyuan station. Please line up for the train. Let the passengers get off first before you get on. |
| voice.xmvisit.yby.zh | zh | 园博苑站附近有园林博览苑，欢迎下车游玩。 |
| voice.xmvisit.yby.en | en | Yuanboyuan station is near the Garden Expo Park. You are welcome to get off and visit. |
| voice.next.jmx.zh | zh | 下一站，集美学村。 |
| voice.next.jmx.en | en | The next station is Jimei School Village. |
| voice.arrive.jmx.zh | zh | 列车即将到达集美学村站，请小心列车与站台之间的空隙。 |
| voice.arrive.jmx.en | en | The train is arriving at Jimei School Village. Please mind the gap between the train and the platform. |
| voice.welcome.jmx.zh | zh | 欢迎光临集美学村站。请排队候车，先下后上。 |
| voice.welcome.jmx.en | en | Welcome to Jimei School Village station. Please line up for the train. Let the passengers get off first before you get on. |
| voice.next.gqi.zh | zh | 下一站，高崎。 |
| voice.next.gqi.en | en | The next station is Gaoqi. |
| voice.arrive.gqi.zh | zh | 列车即将到达高崎站，请小心列车与站台之间的空隙。 |
| voice.arrive.gqi.en | en | The train is arriving at Gaoqi. Please mind the gap between the train and the platform. |
| voice.welcome.gqi.zh | zh | 欢迎光临高崎站。请排队候车，先下后上。 |
| voice.welcome.gqi.en | en | Welcome to Gaoqi station. Please line up for the train. Let the passengers get off first before you get on. |
| voice.next.dqn.zh | zh | 下一站，殿前。 |
| voice.next.dqn.en | en | The next station is Dianqian. |
| voice.arrive.dqn.zh | zh | 列车即将到达殿前站，请小心列车与站台之间的空隙。 |
| voice.arrive.dqn.en | en | The train is arriving at Dianqian. Please mind the gap between the train and the platform. |
| voice.welcome.dqn.zh | zh | 欢迎光临殿前站。请排队候车，先下后上。 |
| voice.welcome.dqn.en | en | Welcome to Dianqian station. Please line up for the train. Let the passengers get off first before you get on. |
| voice.next.hjy.zh | zh | 下一站，火炬园，可换乘3号线。 |
| voice.next.hjy.en | en | The next station is Torch Hi-Tech Park, the interchange with Line 3. |
| voice.arrive.hjy.zh | zh | 列车即将到达火炬园站，请小心列车与站台之间的空隙。 |
| voice.arrive.hjy.en | en | The train is arriving at Torch Hi-Tech Park. Please mind the gap between the train and the platform. |
| voice.welcome.hjy.zh | zh | 欢迎光临火炬园站。请排队候车，先下后上。 |
| voice.welcome.hjy.en | en | Welcome to Torch Hi-Tech Park station. Please line up for the train. Let the passengers get off first before you get on. |
| voice.next.tbn.zh | zh | 下一站，塘边。 |
| voice.next.tbn.en | en | The next station is Tangbian. |
| voice.arrive.tbn.zh | zh | 列车即将到达塘边站，请小心列车与站台之间的空隙。 |
| voice.arrive.tbn.en | en | The train is arriving at Tangbian. Please mind the gap between the train and the platform. |
| voice.welcome.tbn.zh | zh | 欢迎光临塘边站。请排队候车，先下后上。 |
| voice.welcome.tbn.en | en | Welcome to Tangbian station. Please line up for the train. Let the passengers get off first before you get on. |
| voice.next.wsp.zh | zh | 下一站，乌石浦。 |
| voice.next.wsp.en | en | The next station is Wushipu. |
| voice.arrive.wsp.zh | zh | 列车即将到达乌石浦站，请小心列车与站台之间的空隙。 |
| voice.arrive.wsp.en | en | The train is arriving at Wushipu. Please mind the gap between the train and the platform. |
| voice.welcome.wsp.zh | zh | 欢迎光临乌石浦站。请排队候车，先下后上。 |
| voice.welcome.wsp.en | en | Welcome to Wushipu station. Please line up for the train. Let the passengers get off first before you get on. |
| voice.next.lcu.zh | zh | 下一站，吕厝，可换乘1号线。 |
| voice.next.lcu.en | en | The next station is Lücuo, the interchange with Line 1. |
| voice.xmvisit.lcu.zh | zh | 吕厝站附近有莲花公园，欢迎下车游玩，请从12号出口出站。 |
| voice.xmvisit.lcu.en | en | Lücuo station is near Lianhua Park. You are welcome to get off and visit. Please use Exit 12. |
| voice.next.lhj.zh | zh | 下一站，莲花路口。 |
| voice.next.lhj.en | en | The next station is Lianhua Lukou. |
| voice.arrive.lhj.zh | zh | 列车即将到达莲花路口站，请小心列车与站台之间的空隙。 |
| voice.arrive.lhj.en | en | The train is arriving at Lianhua Lukou. Please mind the gap between the train and the platform. |
| voice.welcome.lhj.zh | zh | 欢迎光临莲花路口站。请排队候车，先下后上。 |
| voice.welcome.lhj.en | en | Welcome to Lianhua Lukou station. Please line up for the train. Let the passengers get off first before you get on. |
| voice.xmvisit.lhj.zh | zh | 莲花路口站附近有莲花公园，欢迎下车游玩，请从4号出口出站。 |
| voice.xmvisit.lhj.en | en | Lianhua Lukou station is near Lianhua Park. You are welcome to get off and visit. Please use Exit 4. |
| voice.next.lbn.zh | zh | 下一站，莲坂。 |
| voice.next.lbn.en | en | The next station is Lianban. |
| voice.arrive.lbn.zh | zh | 列车即将到达莲坂站，请小心列车与站台之间的空隙。 |
| voice.arrive.lbn.en | en | The train is arriving at Lianban. Please mind the gap between the train and the platform. |
| voice.welcome.lbn.zh | zh | 欢迎光临莲坂站。请排队候车，先下后上。 |
| voice.welcome.lbn.en | en | Welcome to Lianban station. Please line up for the train. Let the passengers get off first before you get on. |
| voice.next.hbd.zh | zh | 下一站，湖滨东路，可换乘3号线。 |
| voice.next.hbd.en | en | The next station is Hubin Donglu, the interchange with Line 3. |
| voice.arrive.hbd.zh | zh | 列车即将到达湖滨东路站，请小心列车与站台之间的空隙。 |
| voice.arrive.hbd.en | en | The train is arriving at Hubin Donglu. Please mind the gap between the train and the platform. |
| voice.welcome.hbd.zh | zh | 欢迎光临湖滨东路站。请排队候车，先下后上。 |
| voice.welcome.hbd.en | en | Welcome to Hubin Donglu station. Please line up for the train. Let the passengers get off first before you get on. |
| voice.next.wza.zh | zh | 下一站，文灶。 |
| voice.next.wza.en | en | The next station is Wenzao. |
| voice.arrive.wza.zh | zh | 列车即将到达文灶站，请小心列车与站台之间的空隙。 |
| voice.arrive.wza.en | en | The train is arriving at Wenzao. Please mind the gap between the train and the platform. |
| voice.welcome.wza.zh | zh | 欢迎光临文灶站。请排队候车，先下后上。 |
| voice.welcome.wza.en | en | Welcome to Wenzao station. Please line up for the train. Let the passengers get off first before you get on. |
| voice.next.jjc.zh | zh | 下一站，将军祠。 |
| voice.next.jjc.en | en | The next station is Jiangjunci. |
| voice.arrive.jjc.zh | zh | 列车即将到达将军祠站，请小心列车与站台之间的空隙。 |
| voice.arrive.jjc.en | en | The train is arriving at Jiangjunci. Please mind the gap between the train and the platform. |
| voice.welcome.jjc.zh | zh | 欢迎光临将军祠站。请排队候车，先下后上。 |
| voice.welcome.jjc.en | en | Welcome to Jiangjunci station. Please line up for the train. Let the passengers get off first before you get on. |
| voice.next.zsp.zh | zh | 下一站，中山公园。 |
| voice.next.zsp.en | en | The next station is Zhongshan Gongyuan. |
| voice.arrive.zsp.zh | zh | 列车即将到达中山公园站，请小心列车与站台之间的空隙。 |
| voice.arrive.zsp.en | en | The train is arriving at Zhongshan Gongyuan. Please mind the gap between the train and the platform. |
| voice.welcome.zsp.zh | zh | 欢迎光临中山公园站。请排队候车，先下后上。 |
| voice.welcome.zsp.en | en | Welcome to Zhongshan Gongyuan station. Please line up for the train. Let the passengers get off first before you get on. |
| voice.xmvisit.zsp.zh | zh | 中山公园站附近有中山公园，欢迎下车游玩。 |
| voice.xmvisit.zsp.en | en | Zhongshan Gongyuan station is near Zhongshan Park. You are welcome to get off and visit. |
| voice.arrive.zhl.zh | zh | 列车即将到达镇海路站，请小心列车与站台之间的空隙。 |
| voice.arrive.zhl.en | en | The train is arriving at Zhenhailu. Please mind the gap between the train and the platform. |
| voice.welcome.zhl.zh | zh | 欢迎光临镇海路站。请排队候车，先下后上。 |
| voice.welcome.zhl.en | en | Welcome to Zhenhailu station. Please line up for the train. Let the passengers get off first before you get on. |
| voice.destination.xmwyw.zh | zh | 本次列车终点站为五缘湾。 |
| voice.destination.xmwyw.en | en | The destination of this train is Wuyuanwan. |
| voice.terminal.xmwyw.zh | zh | 下一站是本次列车的终点站，五缘湾。请全部乘客带齐行李物品在此站下车，欢迎再次乘坐厦门地铁。 |
| voice.terminal.xmwyw.en | en | The next station is Wuyuanwan, the terminal of this journey. Please take all your belongings and leave the train. Thank you for travelling on Xiamen Metro. |
| voice.platform.xmwyw.1.zh | zh | 一站台，五缘湾方向列车即将进站。 |
| voice.platform.xmwyw.1.en | en | The train bound for Wuyuanwan is approaching at Platform 1. |
| voice.platform.xmwyw.2.zh | zh | 二站台，五缘湾方向列车即将进站。 |
| voice.platform.xmwyw.2.en | en | The train bound for Wuyuanwan is approaching at Platform 2. |
| voice.destination.xmtzs.zh | zh | 本次列车终点站为天竺山。 |
| voice.destination.xmtzs.en | en | The destination of this train is Tianzhushan. |
| voice.terminal.xmtzs.zh | zh | 下一站是本次列车的终点站，天竺山。请全部乘客带齐行李物品在此站下车，欢迎再次乘坐厦门地铁。 |
| voice.terminal.xmtzs.en | en | The next station is Tianzhushan, the terminal of this journey. Please take all your belongings and leave the train. Thank you for travelling on Xiamen Metro. |
| voice.platform.xmtzs.1.zh | zh | 一站台，天竺山方向列车即将进站。 |
| voice.platform.xmtzs.1.en | en | The train bound for Tianzhushan is approaching at Platform 1. |
| voice.platform.xmtzs.2.zh | zh | 二站台，天竺山方向列车即将进站。 |
| voice.platform.xmtzs.2.en | en | The train bound for Tianzhushan is approaching at Platform 2. |
| voice.arrive.tzs.zh | zh | 列车即将到达天竺山站，请小心列车与站台之间的空隙。 |
| voice.arrive.tzs.en | en | The train is arriving at Tianzhushan. Please mind the gap between the train and the platform. |
| voice.welcome.tzs.zh | zh | 欢迎光临天竺山站。请排队候车，先下后上。 |
| voice.welcome.tzs.en | en | Welcome to Tianzhushan station. Please line up for the train. Let the passengers get off first before you get on. |
| voice.next.dfu.zh | zh | 下一站，东孚。 |
| voice.next.dfu.en | en | The next station is Dongfu. |
| voice.arrive.dfu.zh | zh | 列车即将到达东孚站，请小心列车与站台之间的空隙。 |
| voice.arrive.dfu.en | en | The train is arriving at Dongfu. Please mind the gap between the train and the platform. |
| voice.welcome.dfu.zh | zh | 欢迎光临东孚站。请排队候车，先下后上。 |
| voice.welcome.dfu.en | en | Welcome to Dongfu station. Please line up for the train. Let the passengers get off first before you get on. |
| voice.next.dya.zh | zh | 下一站，东瑶。 |
| voice.next.dya.en | en | The next station is Dongyao. |
| voice.arrive.dya.zh | zh | 列车即将到达东瑶站，请小心列车与站台之间的空隙。 |
| voice.arrive.dya.en | en | The train is arriving at Dongyao. Please mind the gap between the train and the platform. |
| voice.welcome.dya.zh | zh | 欢迎光临东瑶站。请排队候车，先下后上。 |
| voice.welcome.dya.en | en | Welcome to Dongyao station. Please line up for the train. Let the passengers get off first before you get on. |
| voice.next.dme.zh | zh | 下一站，鼎美，可换乘6号线。 |
| voice.next.dme.en | en | The next station is Dingmei, the interchange with Line 6. |
| voice.arrive.dme.zh | zh | 列车即将到达鼎美站，请小心列车与站台之间的空隙。 |
| voice.arrive.dme.en | en | The train is arriving at Dingmei. Please mind the gap between the train and the platform. |
| voice.welcome.dme.zh | zh | 欢迎光临鼎美站。请排队候车，先下后上。 |
| voice.welcome.dme.en | en | Welcome to Dingmei station. Please line up for the train. Let the passengers get off first before you get on. |
| voice.next.mlz.zh | zh | 下一站，马銮中心，可换乘4号线、6号线。 |
| voice.next.mlz.en | en | The next station is Maluan Zhongxin, the interchange with Line 4 and Line 6. |
| voice.arrive.mlz.zh | zh | 列车即将到达马銮中心站，请小心列车与站台之间的空隙。 |
| voice.arrive.mlz.en | en | The train is arriving at Maluan Zhongxin. Please mind the gap between the train and the platform. |
| voice.welcome.mlz.zh | zh | 欢迎光临马銮中心站。请排队候车，先下后上。 |
| voice.welcome.mlz.en | en | Welcome to Maluan Zhongxin station. Please line up for the train. Let the passengers get off first before you get on. |
| voice.next.xyd.zh | zh | 下一站，新阳大道。 |
| voice.next.xyd.en | en | The next station is Xinyang Dadao. |
| voice.arrive.xyd.zh | zh | 列车即将到达新阳大道站，请小心列车与站台之间的空隙。 |
| voice.arrive.xyd.en | en | The train is arriving at Xinyang Dadao. Please mind the gap between the train and the platform. |
| voice.welcome.xyd.zh | zh | 欢迎光临新阳大道站。请排队候车，先下后上。 |
| voice.welcome.xyd.en | en | Welcome to Xinyang Dadao station. Please line up for the train. Let the passengers get off first before you get on. |
| voice.next.xan.zh | zh | 下一站，新垵。 |
| voice.next.xan.en | en | The next station is Xin'an. |
| voice.arrive.xan.zh | zh | 列车即将到达新垵站，请小心列车与站台之间的空隙。 |
| voice.arrive.xan.en | en | The train is arriving at Xin'an. Please mind the gap between the train and the platform. |
| voice.welcome.xan.zh | zh | 欢迎光临新垵站。请排队候车，先下后上。 |
| voice.welcome.xan.en | en | Welcome to Xin'an station. Please line up for the train. Let the passengers get off first before you get on. |
| voice.next.wjl.zh | zh | 下一站，翁角路。 |
| voice.next.wjl.en | en | The next station is Wengjiao Lu. |
| voice.arrive.wjl.zh | zh | 列车即将到达翁角路站，请小心列车与站台之间的空隙。 |
| voice.arrive.wjl.en | en | The train is arriving at Wengjiao Lu. Please mind the gap between the train and the platform. |
| voice.welcome.wjl.zh | zh | 欢迎光临翁角路站。请排队候车，先下后上。 |
| voice.welcome.wjl.en | en | Welcome to Wengjiao Lu station. Please line up for the train. Let the passengers get off first before you get on. |
| voice.next.mql.zh | zh | 下一站，马青路。 |
| voice.next.mql.en | en | The next station is Maqing Lu. |
| voice.arrive.mql.zh | zh | 列车即将到达马青路站，请小心列车与站台之间的空隙。 |
| voice.arrive.mql.en | en | The train is arriving at Maqing Lu. Please mind the gap between the train and the platform. |
| voice.welcome.mql.zh | zh | 欢迎光临马青路站。请排队候车，先下后上。 |
| voice.welcome.mql.en | en | Welcome to Maqing Lu station. Please line up for the train. Let the passengers get off first before you get on. |
| voice.next.hxz.zh | zh | 下一站，海沧行政中心。 |
| voice.next.hxz.en | en | The next station is Haicang Xingzheng Zhongxin. |
| voice.arrive.hxz.zh | zh | 列车即将到达海沧行政中心站，请小心列车与站台之间的空隙。 |
| voice.arrive.hxz.en | en | The train is arriving at Haicang Xingzheng Zhongxin. Please mind the gap between the train and the platform. |
| voice.welcome.hxz.zh | zh | 欢迎光临海沧行政中心站。请排队候车，先下后上。 |
| voice.welcome.hxz.en | en | Welcome to Haicang Xingzheng Zhongxin station. Please line up for the train. Let the passengers get off first before you get on. |
| voice.next.hsw.zh | zh | 下一站，海沧商务中心。 |
| voice.next.hsw.en | en | The next station is Haicang Shangwu Zhongxin. |
| voice.arrive.hsw.zh | zh | 列车即将到达海沧商务中心站，请小心列车与站台之间的空隙。 |
| voice.arrive.hsw.en | en | The train is arriving at Haicang Shangwu Zhongxin. Please mind the gap between the train and the platform. |
| voice.welcome.hsw.zh | zh | 欢迎光临海沧商务中心站。请排队候车，先下后上。 |
| voice.welcome.hsw.en | en | Welcome to Haicang Shangwu Zhongxin station. Please line up for the train. Let the passengers get off first before you get on. |
| voice.next.hcw.zh | zh | 下一站，海沧湾公园。 |
| voice.next.hcw.en | en | The next station is Haicangwan Gongyuan. |
| voice.arrive.hcw.zh | zh | 列车即将到达海沧湾公园站，请小心列车与站台之间的空隙。 |
| voice.arrive.hcw.en | en | The train is arriving at Haicangwan Gongyuan. Please mind the gap between the train and the platform. |
| voice.welcome.hcw.zh | zh | 欢迎光临海沧湾公园站。请排队候车，先下后上。 |
| voice.welcome.hcw.en | en | Welcome to Haicangwan Gongyuan station. Please line up for the train. Let the passengers get off first before you get on. |
| voice.next.ylz.zh | zh | 下一站，邮轮中心。 |
| voice.next.ylz.en | en | The next station is Cruise Center. |
| voice.arrive.ylz.zh | zh | 列车即将到达邮轮中心站，请小心列车与站台之间的空隙。 |
| voice.arrive.ylz.en | en | The train is arriving at Cruise Center. Please mind the gap between the train and the platform. |
| voice.welcome.ylz.zh | zh | 欢迎光临邮轮中心站。请排队候车，先下后上。 |
| voice.welcome.ylz.en | en | Welcome to Cruise Center station. Please line up for the train. Let the passengers get off first before you get on. |
| voice.next.jyl.zh | zh | 下一站，建业路。 |
| voice.next.jyl.en | en | The next station is Jianye Lu. |
| voice.arrive.jyl.zh | zh | 列车即将到达建业路站，请小心列车与站台之间的空隙。 |
| voice.arrive.jyl.en | en | The train is arriving at Jianye Lu. Please mind the gap between the train and the platform. |
| voice.welcome.jyl.zh | zh | 欢迎光临建业路站。请排队候车，先下后上。 |
| voice.welcome.jyl.en | en | Welcome to Jianye Lu station. Please line up for the train. Let the passengers get off first before you get on. |
| voice.next.hbz.zh | zh | 下一站，湖滨中路。 |
| voice.next.hbz.en | en | The next station is Hubin Zhonglu. |
| voice.arrive.hbz.zh | zh | 列车即将到达湖滨中路站，请小心列车与站台之间的空隙。 |
| voice.arrive.hbz.en | en | The train is arriving at Hubin Zhonglu. Please mind the gap between the train and the platform. |
| voice.welcome.hbz.zh | zh | 欢迎光临湖滨中路站。请排队候车，先下后上。 |
| voice.welcome.hbz.en | en | Welcome to Hubin Zhonglu station. Please line up for the train. Let the passengers get off first before you get on. |
| voice.next.tyz.zh | zh | 下一站，体育中心，可换乘3号线。 |
| voice.next.tyz.en | en | The next station is Tiyu Zhongxin, the interchange with Line 3. |
| voice.arrive.tyz.zh | zh | 列车即将到达体育中心站，请小心列车与站台之间的空隙。 |
| voice.arrive.tyz.en | en | The train is arriving at Tiyu Zhongxin. Please mind the gap between the train and the platform. |
| voice.welcome.tyz.zh | zh | 欢迎光临体育中心站。请排队候车，先下后上。 |
| voice.welcome.tyz.en | en | Welcome to Tiyu Zhongxin station. Please line up for the train. Let the passengers get off first before you get on. |
| voice.next.yxd.zh | zh | 下一站，育秀东路。 |
| voice.next.yxd.en | en | The next station is Yuxiu Donglu. |
| voice.arrive.yxd.zh | zh | 列车即将到达育秀东路站，请小心列车与站台之间的空隙。 |
| voice.arrive.yxd.en | en | The train is arriving at Yuxiu Donglu. Please mind the gap between the train and the platform. |
| voice.welcome.yxd.zh | zh | 欢迎光临育秀东路站。请排队候车，先下后上。 |
| voice.welcome.yxd.en | en | Welcome to Yuxiu Donglu station. Please line up for the train. Let the passengers get off first before you get on. |
| voice.next.jtou.zh | zh | 下一站，江头。 |
| voice.next.jtou.en | en | The next station is Jiangtou. |
| voice.arrive.jtou.zh | zh | 列车即将到达江头站，请小心列车与站台之间的空隙。 |
| voice.arrive.jtou.en | en | The train is arriving at Jiangtou. Please mind the gap between the train and the platform. |
| voice.welcome.jtou.zh | zh | 欢迎光临江头站。请排队候车，先下后上。 |
| voice.welcome.jtou.en | en | Welcome to Jiangtou station. Please line up for the train. Let the passengers get off first before you get on. |
| voice.xmvisit.jtou.zh | zh | 江头站附近有莲龙小学，欢迎下车游玩，请从2号出口出站。 |
| voice.xmvisit.jtou.en | en | Jiangtou station is near Lianlong Primary School. You are welcome to get off and visit. Please use Exit 2. |
| voice.next.hpu.zh | zh | 下一站，后埔。 |
| voice.next.hpu.en | en | The next station is Houpu. |
| voice.arrive.hpu.zh | zh | 列车即将到达后埔站，请小心列车与站台之间的空隙。 |
| voice.arrive.hpu.en | en | The train is arriving at Houpu. Please mind the gap between the train and the platform. |
| voice.welcome.hpu.zh | zh | 欢迎光临后埔站。请排队候车，先下后上。 |
| voice.welcome.hpu.en | en | Welcome to Houpu station. Please line up for the train. Let the passengers get off first before you get on. |
| voice.xmvisit.hpu.zh | zh | 后埔站附近有忠仑公园，欢迎下车游玩，请从4号出口出站。 |
| voice.xmvisit.hpu.en | en | Houpu station is near Zhonglun Park. You are welcome to get off and visit. Please use Exit 4. |
| voice.next.ctg.zh | zh | 下一站，蔡塘。 |
| voice.next.ctg.en | en | The next station is Caitang. |
| voice.arrive.ctg.zh | zh | 列车即将到达蔡塘站，请小心列车与站台之间的空隙。 |
| voice.arrive.ctg.en | en | The train is arriving at Caitang. Please mind the gap between the train and the platform. |
| voice.welcome.ctg.zh | zh | 欢迎光临蔡塘站。请排队候车，先下后上。 |
| voice.welcome.ctg.en | en | Welcome to Caitang station. Please line up for the train. Let the passengers get off first before you get on. |
| voice.next.gds.zh | zh | 下一站，古地石。 |
| voice.next.gds.en | en | The next station is Gudishi. |
| voice.arrive.gds.zh | zh | 列车即将到达古地石站，请小心列车与站台之间的空隙。 |
| voice.arrive.gds.en | en | The train is arriving at Gudishi. Please mind the gap between the train and the platform. |
| voice.welcome.gds.zh | zh | 欢迎光临古地石站。请排队候车，先下后上。 |
| voice.welcome.gds.en | en | Welcome to Gudishi station. Please line up for the train. Let the passengers get off first before you get on. |
| voice.next.ldo.zh | zh | 下一站，岭兜。 |
| voice.next.ldo.en | en | The next station is Lingdou. |
| voice.arrive.ldo.zh | zh | 列车即将到达岭兜站，请小心列车与站台之间的空隙。 |
| voice.arrive.ldo.en | en | The train is arriving at Lingdou. Please mind the gap between the train and the platform. |
| voice.welcome.ldo.zh | zh | 欢迎光临岭兜站。请排队候车，先下后上。 |
| voice.welcome.ldo.en | en | Welcome to Lingdou station. Please line up for the train. Let the passengers get off first before you get on. |
| voice.next.rjy.zh | zh | 下一站，软件园二期。 |
| voice.next.rjy.en | en | The next station is Software Park Phase II. |
| voice.arrive.rjy.zh | zh | 列车即将到达软件园二期站，请小心列车与站台之间的空隙。 |
| voice.arrive.rjy.en | en | The train is arriving at Software Park Phase II. Please mind the gap between the train and the platform. |
| voice.welcome.rjy.zh | zh | 欢迎光临软件园二期站。请排队候车，先下后上。 |
| voice.welcome.rjy.en | en | Welcome to Software Park Phase II station. Please line up for the train. Let the passengers get off first before you get on. |
| voice.next.hcu.zh | zh | 下一站，何厝。 |
| voice.next.hcu.en | en | The next station is Hecuo. |
| voice.arrive.hcu.zh | zh | 列车即将到达何厝站，请小心列车与站台之间的空隙。 |
| voice.arrive.hcu.en | en | The train is arriving at Hecuo. Please mind the gap between the train and the platform. |
| voice.welcome.hcu.zh | zh | 欢迎光临何厝站。请排队候车，先下后上。 |
| voice.welcome.hcu.en | en | Welcome to Hecuo station. Please line up for the train. Let the passengers get off first before you get on. |
| voice.next.gys.zh | zh | 下一站，观音山。 |
| voice.next.gys.en | en | The next station is Guanyinshan. |
| voice.arrive.gys.zh | zh | 列车即将到达观音山站，请小心列车与站台之间的空隙。 |
| voice.arrive.gys.en | en | The train is arriving at Guanyinshan. Please mind the gap between the train and the platform. |
| voice.welcome.gys.zh | zh | 欢迎光临观音山站。请排队候车，先下后上。 |
| voice.welcome.gys.en | en | Welcome to Guanyinshan station. Please line up for the train. Let the passengers get off first before you get on. |
| voice.next.dzh.zh | zh | 下一站，东宅。 |
| voice.next.dzh.en | en | The next station is Dongzhai. |
| voice.arrive.dzh.zh | zh | 列车即将到达东宅站，请小心列车与站台之间的空隙。 |
| voice.arrive.dzh.en | en | The train is arriving at Dongzhai. Please mind the gap between the train and the platform. |
| voice.welcome.dzh.zh | zh | 欢迎光临东宅站。请排队候车，先下后上。 |
| voice.welcome.dzh.en | en | Welcome to Dongzhai station. Please line up for the train. Let the passengers get off first before you get on. |
| voice.next.jrz.zh | zh | 下一站，两岸金融中心。 |
| voice.next.jrz.en | en | The next station is Cross-Strait Financial Center. |
| voice.arrive.jrz.zh | zh | 列车即将到达两岸金融中心站，请小心列车与站台之间的空隙。 |
| voice.arrive.jrz.en | en | The train is arriving at Cross-Strait Financial Center. Please mind the gap between the train and the platform. |
| voice.welcome.jrz.zh | zh | 欢迎光临两岸金融中心站。请排队候车，先下后上。 |
| voice.welcome.jrz.en | en | Welcome to Cross-Strait Financial Center station. Please line up for the train. Let the passengers get off first before you get on. |
| voice.next.wto.zh | zh | 下一站，五通。 |
| voice.next.wto.en | en | The next station is Wutong. |
| voice.arrive.wto.zh | zh | 列车即将到达五通站，请小心列车与站台之间的空隙。 |
| voice.arrive.wto.en | en | The train is arriving at Wutong. Please mind the gap between the train and the platform. |
| voice.welcome.wto.zh | zh | 欢迎光临五通站。请排队候车，先下后上。 |
| voice.welcome.wto.en | en | Welcome to Wutong station. Please line up for the train. Let the passengers get off first before you get on. |
| voice.next.sdy.zh | zh | 下一站，湿地公园。 |
| voice.next.sdy.en | en | The next station is Wetland Park. |
| voice.arrive.sdy.zh | zh | 列车即将到达湿地公园站，请小心列车与站台之间的空隙。 |
| voice.arrive.sdy.en | en | The train is arriving at Wetland Park. Please mind the gap between the train and the platform. |
| voice.welcome.sdy.zh | zh | 欢迎光临湿地公园站。请排队候车，先下后上。 |
| voice.welcome.sdy.en | en | Welcome to Wetland Park station. Please line up for the train. Let the passengers get off first before you get on. |
| voice.next.zzh.zh | zh | 下一站，钟宅。 |
| voice.next.zzh.en | en | The next station is Zhongzhai. |
| voice.arrive.zzh.zh | zh | 列车即将到达钟宅站，请小心列车与站台之间的空隙。 |
| voice.arrive.zzh.en | en | The train is arriving at Zhongzhai. Please mind the gap between the train and the platform. |
| voice.welcome.zzh.zh | zh | 欢迎光临钟宅站。请排队候车，先下后上。 |
| voice.welcome.zzh.en | en | Welcome to Zhongzhai station. Please line up for the train. Let the passengers get off first before you get on. |
| voice.arrive.wyw.zh | zh | 列车即将到达五缘湾站，请小心列车与站台之间的空隙。 |
| voice.arrive.wyw.en | en | The train is arriving at Wuyuanwan. Please mind the gap between the train and the platform. |
| voice.welcome.wyw.zh | zh | 欢迎光临五缘湾站。请排队候车，先下后上。 |
| voice.welcome.wyw.en | en | Welcome to Wuyuanwan station. Please line up for the train. Let the passengers get off first before you get on. |
