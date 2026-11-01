# 缺失的报站语音片段

由 `node tools/audio/export_jobs.mjs` 生成。全网共需 1832 条片段，已有 MP3 1440 条，缺 392 条（普通话 84 / 粤语 0 / 英语 84）。
缺失片段在游戏里自动用 Web Speech 朗读（zh-CN → zh-HK（若有）→ en-US（若有），语速 0.95），并照常显示字幕。

生成方法：设置环境变量 DASHSCOPE_API_KEY 后运行 `python3 tools/audio/generate_voice.py`（会读取 voice-jobs.json，只生成缺的）。

| id | 语言 | 文本 |
| --- | --- | --- |
| voice.xmvisit.wsp.zh | zh | 乌石浦站附近有厦门SM城市广场，欢迎下车游玩，请从4B出口出站。 |
| voice.xmvisit.wsp.nan | nan | 乌石浦站附近有厦门SM城市广场，欢迎下车游玩，请从4B出口出站。 |
| voice.xmvisit.wsp.en | en | Wushipu station is near SM City Xiamen. You are welcome to get off and visit. Please use Exit 4B. |
| voice.xmexit.wsp.zh | zh | 前往厦门SM城市广场的乘客，请从4B出口出站。 |
| voice.xmexit.wsp.nan | nan | 前往厦门SM城市广场的乘客，请从4B出口出站。 |
| voice.xmexit.wsp.en | en | Passengers for SM City Xiamen, please use Exit 4B. |
| voice.fz.destination.sjk.fzh | fzh | 本次列车终点站为三江口。 |
| voice.fz.terminal.sjk.fzh | fzh | 下一站是本次列车的终点站，三江口。请全部乘客带齐行李物品在此站下车，欢迎再次乘坐福州地铁。 |
| voice.fz.platform.sjk.1.fzh | fzh | 一站台，三江口方向列车即将进站。 |
| voice.fz.platform.sjk.2.fzh | fzh | 二站台，三江口方向列车即将进站。 |
| voice.fz.destination.xf.fzh | fzh | 本次列车终点站为象峰。 |
| voice.fz.terminal.xf.fzh | fzh | 下一站是本次列车的终点站，象峰。请全部乘客带齐行李物品在此站下车，欢迎再次乘坐福州地铁。 |
| voice.fz.platform.xf.1.fzh | fzh | 一站台，象峰方向列车即将进站。 |
| voice.fz.platform.xf.2.fzh | fzh | 二站台，象峰方向列车即将进站。 |
| voice.fz.arrive.fzxf.fzh | fzh | 列车即将到达象峰站，请小心列车与站台之间的空隙。 |
| voice.fz.welcome.fzxf.fzh | fzh | 欢迎光临象峰站。请排队候车，先下后上。 |
| voice.fz.next.fzxs.fzh | fzh | 下一站，秀山。 |
| voice.fz.arrive.fzxs.fzh | fzh | 列车即将到达秀山站，请小心列车与站台之间的空隙。 |
| voice.fz.welcome.fzxs.fzh | fzh | 欢迎光临秀山站。请排队候车，先下后上。 |
| voice.fz.next.fzlhs.fzh | fzh | 下一站，罗汉山。 |
| voice.fz.arrive.fzlhs.fzh | fzh | 列车即将到达罗汉山站，请小心列车与站台之间的空隙。 |
| voice.fz.welcome.fzlhs.fzh | fzh | 欢迎光临罗汉山站。请排队候车，先下后上。 |
| voice.fz.next.fzfz.fzh | fzh | 下一站，福州火车站。 |
| voice.fz.arrive.fzfz.fzh | fzh | 列车即将到达福州火车站，请小心列车与站台之间的空隙。 |
| voice.fz.welcome.fzfz.fzh | fzh | 欢迎光临福州火车站。请排队候车，先下后上。 |
| voice.fz.next.fzdm.fzh | fzh | 下一站，斗门。 |
| voice.fz.arrive.fzdm.fzh | fzh | 列车即将到达斗门站，请小心列车与站台之间的空隙。 |
| voice.fz.welcome.fzdm.fzh | fzh | 欢迎光临斗门站。请排队候车，先下后上。 |
| voice.fz.next.fzsd.fzh | fzh | 下一站，树兜。 |
| voice.fz.arrive.fzsd.fzh | fzh | 列车即将到达树兜站，请小心列车与站台之间的空隙。 |
| voice.fz.welcome.fzsd.fzh | fzh | 欢迎光临树兜站。请排队候车，先下后上。 |
| voice.fz.next.fzps.fzh | fzh | 下一站，屏山。 |
| voice.fz.arrive.fzps.fzh | fzh | 列车即将到达屏山站，请小心列车与站台之间的空隙。 |
| voice.fz.welcome.fzps.fzh | fzh | 欢迎光临屏山站。请排队候车，先下后上。 |
| voice.fz.next.fzdjk1.zh | zh | 下一站，东街口，可换乘4号线。 |
| voice.fz.next.fzdjk1.fzh | fzh | 下一站，东街口，可换乘4号线。 |
| voice.fz.next.fzdjk1.en | en | The next station is Dongjiekou, the interchange with Line 4. |
| voice.fz.arrive.fzdjk.fzh | fzh | 列车即将到达东街口站，请小心列车与站台之间的空隙。 |
| voice.fz.welcome.fzdjk.fzh | fzh | 欢迎光临东街口站。请排队候车，先下后上。 |
| voice.fz.fzvisit.fzdjk.zh | zh | 东街口站附近有三坊七巷，欢迎下车游玩，请从C出口出站。 |
| voice.fz.fzvisit.fzdjk.fzh | fzh | 东街口站附近有三坊七巷，欢迎下车游玩，请从C出口出站。 |
| voice.fz.fzvisit.fzdjk.en | en | Dongjiekou station is near Three Lanes and Seven Alleys. You are welcome to get off and visit. Please use Exit C. |
| voice.fz.fzexit.fzdjk.zh | zh | 前往三坊七巷的乘客，请从C出口出站。 |
| voice.fz.fzexit.fzdjk.fzh | fzh | 前往三坊七巷的乘客，请从C出口出站。 |
| voice.fz.fzexit.fzdjk.en | en | Passengers for Three Lanes and Seven Alleys, please use Exit C. |
| voice.fz.next.fznmd.fzh | fzh | 下一站，南门兜，可换乘2号线。 |
| voice.fz.arrive.fznmd.fzh | fzh | 列车即将到达南门兜站，请小心列车与站台之间的空隙。 |
| voice.fz.welcome.fznmd.fzh | fzh | 欢迎光临南门兜站。请排队候车，先下后上。 |
| voice.fz.fzvisit.fznmd.zh | zh | 南门兜站附近有于山风景区、白塔，欢迎下车游玩，请从G1出口出站。 |
| voice.fz.fzvisit.fznmd.fzh | fzh | 南门兜站附近有于山风景区、白塔，欢迎下车游玩，请从G1出口出站。 |
| voice.fz.fzvisit.fznmd.en | en | Nanmendou station is near Yushan Hill and the White Pagoda. You are welcome to get off and visit. Please use Exit G1. |
| voice.fz.fzexit.fznmd.zh | zh | 前往于山风景区、白塔的乘客，请从G1出口出站。 |
| voice.fz.fzexit.fznmd.fzh | fzh | 前往于山风景区、白塔的乘客，请从G1出口出站。 |
| voice.fz.fzexit.fznmd.en | en | Passengers for Yushan Hill and the White Pagoda, please use Exit G1. |
| voice.fz.next.fzct.fzh | fzh | 下一站，茶亭。 |
| voice.fz.arrive.fzct.fzh | fzh | 列车即将到达茶亭站，请小心列车与站台之间的空隙。 |
| voice.fz.welcome.fzct.fzh | fzh | 欢迎光临茶亭站。请排队候车，先下后上。 |
| voice.fz.next.fzdd.fzh | fzh | 下一站，达道。 |
| voice.fz.arrive.fzdd.fzh | fzh | 列车即将到达达道站，请小心列车与站台之间的空隙。 |
| voice.fz.welcome.fzdd.fzh | fzh | 欢迎光临达道站。请排队候车，先下后上。 |
| voice.fz.fzvisit.fzdd.zh | zh | 达道站附近有上下杭，欢迎下车游玩，请从C出口出站。 |
| voice.fz.fzvisit.fzdd.fzh | fzh | 达道站附近有上下杭，欢迎下车游玩，请从C出口出站。 |
| voice.fz.fzvisit.fzdd.en | en | Dadao station is near Shangxiahang Historic District. You are welcome to get off and visit. Please use Exit C. |
| voice.fz.fzexit.fzdd.zh | zh | 前往上下杭的乘客，请从C出口出站。 |
| voice.fz.fzexit.fzdd.fzh | fzh | 前往上下杭的乘客，请从C出口出站。 |
| voice.fz.fzexit.fzdd.en | en | Passengers for Shangxiahang Historic District, please use Exit C. |
| voice.fz.next.fzst.fzh | fzh | 下一站，上藤。 |
| voice.fz.arrive.fzst.fzh | fzh | 列车即将到达上藤站，请小心列车与站台之间的空隙。 |
| voice.fz.welcome.fzst.fzh | fzh | 欢迎光临上藤站。请排队候车，先下后上。 |
| voice.fz.next.fzscj.fzh | fzh | 下一站，三叉街。 |
| voice.fz.arrive.fzscj.fzh | fzh | 列车即将到达三叉街站，请小心列车与站台之间的空隙。 |
| voice.fz.welcome.fzscj.fzh | fzh | 欢迎光临三叉街站。请排队候车，先下后上。 |
| voice.fz.next.fzbht.fzh | fzh | 下一站，白湖亭。 |
| voice.fz.arrive.fzbht.fzh | fzh | 列车即将到达白湖亭站，请小心列车与站台之间的空隙。 |
| voice.fz.welcome.fzbht.fzh | fzh | 欢迎光临白湖亭站。请排队候车，先下后上。 |
| voice.fz.next.fzhlz.fzh | fzh | 下一站，葫芦阵。 |
| voice.fz.arrive.fzhlz.fzh | fzh | 列车即将到达葫芦阵站，请小心列车与站台之间的空隙。 |
| voice.fz.welcome.fzhlz.fzh | fzh | 欢迎光临葫芦阵站。请排队候车，先下后上。 |
| voice.fz.next.fzhs.fzh | fzh | 下一站，黄山。 |
| voice.fz.arrive.fzhs.fzh | fzh | 列车即将到达黄山站，请小心列车与站台之间的空隙。 |
| voice.fz.welcome.fzhs.fzh | fzh | 欢迎光临黄山站。请排队候车，先下后上。 |
| voice.fz.next.fzpx.fzh | fzh | 下一站，排下。 |
| voice.fz.arrive.fzpx.fzh | fzh | 列车即将到达排下站，请小心列车与站台之间的空隙。 |
| voice.fz.welcome.fzpx.fzh | fzh | 欢迎光临排下站。请排队候车，先下后上。 |
| voice.fz.next.fzcm1.zh | zh | 下一站，城门，可换乘4号线。 |
| voice.fz.next.fzcm1.fzh | fzh | 下一站，城门，可换乘4号线。 |
| voice.fz.next.fzcm1.en | en | The next station is Chengmen, the interchange with Line 4. |
| voice.fz.arrive.fzcm.fzh | fzh | 列车即将到达城门站，请小心列车与站台之间的空隙。 |
| voice.fz.welcome.fzcm.fzh | fzh | 欢迎光临城门站。请排队候车，先下后上。 |
| voice.fz.next.fzsjc.fzh | fzh | 下一站，三角埕。 |
| voice.fz.arrive.fzsjc.fzh | fzh | 列车即将到达三角埕站，请小心列车与站台之间的空隙。 |
| voice.fz.welcome.fzsjc.fzh | fzh | 欢迎光临三角埕站。请排队候车，先下后上。 |
| voice.fz.next.fzll.fzh | fzh | 下一站，胪雷。 |
| voice.fz.arrive.fzll.fzh | fzh | 列车即将到达胪雷站，请小心列车与站台之间的空隙。 |
| voice.fz.welcome.fzll.fzh | fzh | 欢迎光临胪雷站。请排队候车，先下后上。 |
| voice.fz.next.fzfzn1.fzh | fzh | 下一站，福州火车南站，可换乘5号线。 |
| voice.fz.arrive.fzfzn.fzh | fzh | 列车即将到达福州火车南站，请小心列车与站台之间的空隙。 |
| voice.fz.welcome.fzfzn.fzh | fzh | 欢迎光临福州火车南站。请排队候车，先下后上。 |
| voice.fz.exit.fzfzn.fzh | fzh | 乘坐国铁的乘客，请从站厅南侧A口出站，左转约二十米到东站房七号进站口。去西广场请走D2口。 |
| voice.fz.next.fzap.fzh | fzh | 下一站，安平。 |
| voice.fz.arrive.fzap.fzh | fzh | 列车即将到达安平站，请小心列车与站台之间的空隙。 |
| voice.fz.welcome.fzap.fzh | fzh | 欢迎光临安平站。请排队候车，先下后上。 |
| voice.fz.next.fzlc.fzh | fzh | 下一站，梁厝，可换乘6号线。 |
| voice.fz.arrive.fzlc.fzh | fzh | 列车即将到达梁厝站，请小心列车与站台之间的空隙。 |
| voice.fz.welcome.fzlc.fzh | fzh | 欢迎光临梁厝站。请排队候车，先下后上。 |
| voice.fz.next.fzxy.fzh | fzh | 下一站，下洋，可换乘6号线。 |
| voice.fz.arrive.fzxy.fzh | fzh | 列车即将到达下洋站，请小心列车与站台之间的空隙。 |
| voice.fz.welcome.fzxy.fzh | fzh | 欢迎光临下洋站。请排队候车，先下后上。 |
| voice.fz.arrive.fzsjk.fzh | fzh | 列车即将到达三江口站，请小心列车与站台之间的空隙。 |
| voice.fz.welcome.fzsjk.fzh | fzh | 欢迎光临三江口站。请排队候车，先下后上。 |
| voice.fz.destination.dfj.zh | zh | 本次列车终点站为帝封江。 |
| voice.fz.destination.dfj.fzh | fzh | 本次列车终点站为帝封江。 |
| voice.fz.destination.dfj.en | en | The destination of this train is Difengjiang. |
| voice.fz.terminal.dfj.zh | zh | 下一站是本次列车的终点站，帝封江。请全部乘客带齐行李物品在此站下车，欢迎再次乘坐福州地铁。 |
| voice.fz.terminal.dfj.fzh | fzh | 下一站是本次列车的终点站，帝封江。请全部乘客带齐行李物品在此站下车，欢迎再次乘坐福州地铁。 |
| voice.fz.terminal.dfj.en | en | The next station is Difengjiang, the terminal of this journey. Please take all your belongings and leave the train. Thank you for travelling on Fuzhou Metro. |
| voice.fz.platform.dfj.1.zh | zh | 一站台，帝封江方向列车即将进站。 |
| voice.fz.platform.dfj.1.fzh | fzh | 一站台，帝封江方向列车即将进站。 |
| voice.fz.platform.dfj.1.en | en | The train bound for Difengjiang is approaching at Platform 1. |
| voice.fz.platform.dfj.2.zh | zh | 二站台，帝封江方向列车即将进站。 |
| voice.fz.platform.dfj.2.fzh | fzh | 二站台，帝封江方向列车即将进站。 |
| voice.fz.platform.dfj.2.en | en | The train bound for Difengjiang is approaching at Platform 2. |
| voice.fz.destination.bz.zh | zh | 本次列车终点站为半洲。 |
| voice.fz.destination.bz.fzh | fzh | 本次列车终点站为半洲。 |
| voice.fz.destination.bz.en | en | The destination of this train is Banzhou. |
| voice.fz.terminal.bz.zh | zh | 下一站是本次列车的终点站，半洲。请全部乘客带齐行李物品在此站下车，欢迎再次乘坐福州地铁。 |
| voice.fz.terminal.bz.fzh | fzh | 下一站是本次列车的终点站，半洲。请全部乘客带齐行李物品在此站下车，欢迎再次乘坐福州地铁。 |
| voice.fz.terminal.bz.en | en | The next station is Banzhou, the terminal of this journey. Please take all your belongings and leave the train. Thank you for travelling on Fuzhou Metro. |
| voice.fz.platform.bz.1.zh | zh | 一站台，半洲方向列车即将进站。 |
| voice.fz.platform.bz.1.fzh | fzh | 一站台，半洲方向列车即将进站。 |
| voice.fz.platform.bz.1.en | en | The train bound for Banzhou is approaching at Platform 1. |
| voice.fz.platform.bz.2.zh | zh | 二站台，半洲方向列车即将进站。 |
| voice.fz.platform.bz.2.fzh | fzh | 二站台，半洲方向列车即将进站。 |
| voice.fz.platform.bz.2.en | en | The train bound for Banzhou is approaching at Platform 2. |
| voice.fz.arrive.fzbz.zh | zh | 列车即将到达半洲站，请小心列车与站台之间的空隙。 |
| voice.fz.arrive.fzbz.fzh | fzh | 列车即将到达半洲站，请小心列车与站台之间的空隙。 |
| voice.fz.arrive.fzbz.en | en | The train is arriving at Banzhou. Please mind the gap between the train and the platform. |
| voice.fz.welcome.fzbz.zh | zh | 欢迎光临半洲站。请排队候车，先下后上。 |
| voice.fz.welcome.fzbz.fzh | fzh | 欢迎光临半洲站。请排队候车，先下后上。 |
| voice.fz.welcome.fzbz.en | en | Welcome to Banzhou station. Please line up for the train. Let the passengers get off first before you get on. |
| voice.fz.next.fzjx.zh | zh | 下一站，建新。 |
| voice.fz.next.fzjx.fzh | fzh | 下一站，建新。 |
| voice.fz.next.fzjx.en | en | The next station is Jianxin. |
| voice.fz.arrive.fzjx.zh | zh | 列车即将到达建新站，请小心列车与站台之间的空隙。 |
| voice.fz.arrive.fzjx.fzh | fzh | 列车即将到达建新站，请小心列车与站台之间的空隙。 |
| voice.fz.arrive.fzjx.en | en | The train is arriving at Jianxin. Please mind the gap between the train and the platform. |
| voice.fz.welcome.fzjx.zh | zh | 欢迎光临建新站。请排队候车，先下后上。 |
| voice.fz.welcome.fzjx.fzh | fzh | 欢迎光临建新站。请排队候车，先下后上。 |
| voice.fz.welcome.fzjx.en | en | Welcome to Jianxin station. Please line up for the train. Let the passengers get off first before you get on. |
| voice.fz.next.fzht4.zh | zh | 下一站，洪塘，可换乘5号线。 |
| voice.fz.next.fzht4.fzh | fzh | 下一站，洪塘，可换乘5号线。 |
| voice.fz.next.fzht4.en | en | The next station is Hongtang, the interchange with Line 5. |
| voice.fz.arrive.fzht.fzh | fzh | 列车即将到达洪塘站，请小心列车与站台之间的空隙。 |
| voice.fz.welcome.fzht.fzh | fzh | 欢迎光临洪塘站。请排队候车，先下后上。 |
| voice.fz.next.fzjns.zh | zh | 下一站，金牛山。 |
| voice.fz.next.fzjns.fzh | fzh | 下一站，金牛山。 |
| voice.fz.next.fzjns.en | en | The next station is Jinniushan. |
| voice.fz.arrive.fzjns.zh | zh | 列车即将到达金牛山站，请小心列车与站台之间的空隙。 |
| voice.fz.arrive.fzjns.fzh | fzh | 列车即将到达金牛山站，请小心列车与站台之间的空隙。 |
| voice.fz.arrive.fzjns.en | en | The train is arriving at Jinniushan. Please mind the gap between the train and the platform. |
| voice.fz.welcome.fzjns.zh | zh | 欢迎光临金牛山站。请排队候车，先下后上。 |
| voice.fz.welcome.fzjns.fzh | fzh | 欢迎光临金牛山站。请排队候车，先下后上。 |
| voice.fz.welcome.fzjns.en | en | Welcome to Jinniushan station. Please line up for the train. Let the passengers get off first before you get on. |
| voice.fz.next.fzfhc.zh | zh | 下一站，凤凰池。 |
| voice.fz.next.fzfhc.fzh | fzh | 下一站，凤凰池。 |
| voice.fz.next.fzfhc.en | en | The next station is Fenghuangchi. |
| voice.fz.arrive.fzfhc.zh | zh | 列车即将到达凤凰池站，请小心列车与站台之间的空隙。 |
| voice.fz.arrive.fzfhc.fzh | fzh | 列车即将到达凤凰池站，请小心列车与站台之间的空隙。 |
| voice.fz.arrive.fzfhc.en | en | The train is arriving at Fenghuangchi. Please mind the gap between the train and the platform. |
| voice.fz.welcome.fzfhc.zh | zh | 欢迎光临凤凰池站。请排队候车，先下后上。 |
| voice.fz.welcome.fzfhc.fzh | fzh | 欢迎光临凤凰池站。请排队候车，先下后上。 |
| voice.fz.welcome.fzfhc.en | en | Welcome to Fenghuangchi station. Please line up for the train. Let the passengers get off first before you get on. |
| voice.fz.next.fzlz.zh | zh | 下一站，陆庄。 |
| voice.fz.next.fzlz.fzh | fzh | 下一站，陆庄。 |
| voice.fz.next.fzlz.en | en | The next station is Luzhuang. |
| voice.fz.arrive.fzlz.zh | zh | 列车即将到达陆庄站，请小心列车与站台之间的空隙。 |
| voice.fz.arrive.fzlz.fzh | fzh | 列车即将到达陆庄站，请小心列车与站台之间的空隙。 |
| voice.fz.arrive.fzlz.en | en | The train is arriving at Luzhuang. Please mind the gap between the train and the platform. |
| voice.fz.welcome.fzlz.zh | zh | 欢迎光临陆庄站。请排队候车，先下后上。 |
| voice.fz.welcome.fzlz.fzh | fzh | 欢迎光临陆庄站。请排队候车，先下后上。 |
| voice.fz.welcome.fzlz.en | en | Welcome to Luzhuang station. Please line up for the train. Let the passengers get off first before you get on. |
| voice.fz.next.fzxm.zh | zh | 下一站，西门。 |
| voice.fz.next.fzxm.fzh | fzh | 下一站，西门。 |
| voice.fz.next.fzxm.en | en | The next station is Ximen. |
| voice.fz.arrive.fzxm.zh | zh | 列车即将到达西门站，请小心列车与站台之间的空隙。 |
| voice.fz.arrive.fzxm.fzh | fzh | 列车即将到达西门站，请小心列车与站台之间的空隙。 |
| voice.fz.arrive.fzxm.en | en | The train is arriving at Ximen. Please mind the gap between the train and the platform. |
| voice.fz.welcome.fzxm.zh | zh | 欢迎光临西门站。请排队候车，先下后上。 |
| voice.fz.welcome.fzxm.fzh | fzh | 欢迎光临西门站。请排队候车，先下后上。 |
| voice.fz.welcome.fzxm.en | en | Welcome to Ximen station. Please line up for the train. Let the passengers get off first before you get on. |
| voice.fz.fzvisit.fzxm.zh | zh | 西门站附近有西湖公园，欢迎下车游玩，请从B出口出站。 |
| voice.fz.fzvisit.fzxm.fzh | fzh | 西门站附近有西湖公园，欢迎下车游玩，请从B出口出站。 |
| voice.fz.fzvisit.fzxm.en | en | Ximen station is near West Lake Park. You are welcome to get off and visit. Please use Exit B. |
| voice.fz.fzexit.fzxm.zh | zh | 前往西湖公园的乘客，请从B出口出站。 |
| voice.fz.fzexit.fzxm.fzh | fzh | 前往西湖公园的乘客，请从B出口出站。 |
| voice.fz.fzexit.fzxm.en | en | Passengers for West Lake Park, please use Exit B. |
| voice.fz.next.fzdjk4.zh | zh | 下一站，东街口，可换乘1号线。 |
| voice.fz.next.fzdjk4.fzh | fzh | 下一站，东街口，可换乘1号线。 |
| voice.fz.next.fzdjk4.en | en | The next station is Dongjiekou, the interchange with Line 1. |
| voice.fz.next.fzslyy.zh | zh | 下一站，省立医院。 |
| voice.fz.next.fzslyy.fzh | fzh | 下一站，省立医院。 |
| voice.fz.next.fzslyy.en | en | The next station is Provincial Hospital. |
| voice.fz.arrive.fzslyy.zh | zh | 列车即将到达省立医院站，请小心列车与站台之间的空隙。 |
| voice.fz.arrive.fzslyy.fzh | fzh | 列车即将到达省立医院站，请小心列车与站台之间的空隙。 |
| voice.fz.arrive.fzslyy.en | en | The train is arriving at Provincial Hospital. Please mind the gap between the train and the platform. |
| voice.fz.welcome.fzslyy.zh | zh | 欢迎光临省立医院站。请排队候车，先下后上。 |
| voice.fz.welcome.fzslyy.fzh | fzh | 欢迎光临省立医院站。请排队候车，先下后上。 |
| voice.fz.welcome.fzslyy.en | en | Welcome to Provincial Hospital station. Please line up for the train. Let the passengers get off first before you get on. |
| voice.fz.next.fzdmn.zh | zh | 下一站，东门。 |
| voice.fz.next.fzdmn.fzh | fzh | 下一站，东门。 |
| voice.fz.next.fzdmn.en | en | The next station is Dongmen. |
| voice.fz.arrive.fzdmn.zh | zh | 列车即将到达东门站，请小心列车与站台之间的空隙。 |
| voice.fz.arrive.fzdmn.fzh | fzh | 列车即将到达东门站，请小心列车与站台之间的空隙。 |
| voice.fz.arrive.fzdmn.en | en | The train is arriving at Dongmen. Please mind the gap between the train and the platform. |
| voice.fz.welcome.fzdmn.zh | zh | 欢迎光临东门站。请排队候车，先下后上。 |
| voice.fz.welcome.fzdmn.fzh | fzh | 欢迎光临东门站。请排队候车，先下后上。 |
| voice.fz.welcome.fzdmn.en | en | Welcome to Dongmen station. Please line up for the train. Let the passengers get off first before you get on. |
| voice.fz.next.fzsjch.zh | zh | 下一站，三角池。 |
| voice.fz.next.fzsjch.fzh | fzh | 下一站，三角池。 |
| voice.fz.next.fzsjch.en | en | The next station is Sanjiaochi. |
| voice.fz.arrive.fzsjch.zh | zh | 列车即将到达三角池站，请小心列车与站台之间的空隙。 |
| voice.fz.arrive.fzsjch.fzh | fzh | 列车即将到达三角池站，请小心列车与站台之间的空隙。 |
| voice.fz.arrive.fzsjch.en | en | The train is arriving at Sanjiaochi. Please mind the gap between the train and the platform. |
| voice.fz.welcome.fzsjch.zh | zh | 欢迎光临三角池站。请排队候车，先下后上。 |
| voice.fz.welcome.fzsjch.fzh | fzh | 欢迎光临三角池站。请排队候车，先下后上。 |
| voice.fz.welcome.fzsjch.en | en | Welcome to Sanjiaochi station. Please line up for the train. Let the passengers get off first before you get on. |
| voice.fz.next.fzzy.zh | zh | 下一站，竹屿。 |
| voice.fz.next.fzzy.fzh | fzh | 下一站，竹屿。 |
| voice.fz.next.fzzy.en | en | The next station is Zhuyu. |
| voice.fz.arrive.fzzy.zh | zh | 列车即将到达竹屿站，请小心列车与站台之间的空隙。 |
| voice.fz.arrive.fzzy.fzh | fzh | 列车即将到达竹屿站，请小心列车与站台之间的空隙。 |
| voice.fz.arrive.fzzy.en | en | The train is arriving at Zhuyu. Please mind the gap between the train and the platform. |
| voice.fz.welcome.fzzy.zh | zh | 欢迎光临竹屿站。请排队候车，先下后上。 |
| voice.fz.welcome.fzzy.fzh | fzh | 欢迎光临竹屿站。请排队候车，先下后上。 |
| voice.fz.welcome.fzzy.en | en | Welcome to Zhuyu station. Please line up for the train. Let the passengers get off first before you get on. |
| voice.fz.next.fzhy.zh | zh | 下一站，横屿。 |
| voice.fz.next.fzhy.fzh | fzh | 下一站，横屿。 |
| voice.fz.next.fzhy.en | en | The next station is Hengyu. |
| voice.fz.arrive.fzhy.zh | zh | 列车即将到达横屿站，请小心列车与站台之间的空隙。 |
| voice.fz.arrive.fzhy.fzh | fzh | 列车即将到达横屿站，请小心列车与站台之间的空隙。 |
| voice.fz.arrive.fzhy.en | en | The train is arriving at Hengyu. Please mind the gap between the train and the platform. |
| voice.fz.welcome.fzhy.zh | zh | 欢迎光临横屿站。请排队候车，先下后上。 |
| voice.fz.welcome.fzhy.fzh | fzh | 欢迎光临横屿站。请排队候车，先下后上。 |
| voice.fz.welcome.fzhy.en | en | Welcome to Hengyu station. Please line up for the train. Let the passengers get off first before you get on. |
| voice.fz.next.fzhoy.zh | zh | 下一站，后屿。 |
| voice.fz.next.fzhoy.fzh | fzh | 下一站，后屿。 |
| voice.fz.next.fzhoy.en | en | The next station is Houyu. |
| voice.fz.arrive.fzhoy.zh | zh | 列车即将到达后屿站，请小心列车与站台之间的空隙。 |
| voice.fz.arrive.fzhoy.fzh | fzh | 列车即将到达后屿站，请小心列车与站台之间的空隙。 |
| voice.fz.arrive.fzhoy.en | en | The train is arriving at Houyu. Please mind the gap between the train and the platform. |
| voice.fz.welcome.fzhoy.zh | zh | 欢迎光临后屿站。请排队候车，先下后上。 |
| voice.fz.welcome.fzhoy.fzh | fzh | 欢迎光临后屿站。请排队候车，先下后上。 |
| voice.fz.welcome.fzhoy.en | en | Welcome to Houyu station. Please line up for the train. Let the passengers get off first before you get on. |
| voice.fz.next.fzqy.zh | zh | 下一站，前屿，可换乘2号线。 |
| voice.fz.next.fzqy.fzh | fzh | 下一站，前屿，可换乘2号线。 |
| voice.fz.next.fzqy.en | en | The next station is Qianyu, the interchange with Line 2. |
| voice.fz.arrive.fzqy.zh | zh | 列车即将到达前屿站，请小心列车与站台之间的空隙。 |
| voice.fz.arrive.fzqy.fzh | fzh | 列车即将到达前屿站，请小心列车与站台之间的空隙。 |
| voice.fz.arrive.fzqy.en | en | The train is arriving at Qianyu. Please mind the gap between the train and the platform. |
| voice.fz.welcome.fzqy.zh | zh | 欢迎光临前屿站。请排队候车，先下后上。 |
| voice.fz.welcome.fzqy.fzh | fzh | 欢迎光临前屿站。请排队候车，先下后上。 |
| voice.fz.welcome.fzqy.en | en | Welcome to Qianyu station. Please line up for the train. Let the passengers get off first before you get on. |
| voice.fz.next.fzgmg.zh | zh | 下一站，光明港。 |
| voice.fz.next.fzgmg.fzh | fzh | 下一站，光明港。 |
| voice.fz.next.fzgmg.en | en | The next station is Guangminggang. |
| voice.fz.arrive.fzgmg.zh | zh | 列车即将到达光明港站，请小心列车与站台之间的空隙。 |
| voice.fz.arrive.fzgmg.fzh | fzh | 列车即将到达光明港站，请小心列车与站台之间的空隙。 |
| voice.fz.arrive.fzgmg.en | en | The train is arriving at Guangminggang. Please mind the gap between the train and the platform. |
| voice.fz.welcome.fzgmg.zh | zh | 欢迎光临光明港站。请排队候车，先下后上。 |
| voice.fz.welcome.fzgmg.fzh | fzh | 欢迎光临光明港站。请排队候车，先下后上。 |
| voice.fz.welcome.fzgmg.en | en | Welcome to Guangminggang station. Please line up for the train. Let the passengers get off first before you get on. |
| voice.fz.next.fzafz.zh | zh | 下一站，鳌峰洲。 |
| voice.fz.next.fzafz.fzh | fzh | 下一站，鳌峰洲。 |
| voice.fz.next.fzafz.en | en | The next station is Aofengzhou. |
| voice.fz.arrive.fzafz.zh | zh | 列车即将到达鳌峰洲站，请小心列车与站台之间的空隙。 |
| voice.fz.arrive.fzafz.fzh | fzh | 列车即将到达鳌峰洲站，请小心列车与站台之间的空隙。 |
| voice.fz.arrive.fzafz.en | en | The train is arriving at Aofengzhou. Please mind the gap between the train and the platform. |
| voice.fz.welcome.fzafz.zh | zh | 欢迎光临鳌峰洲站。请排队候车，先下后上。 |
| voice.fz.welcome.fzafz.fzh | fzh | 欢迎光临鳌峰洲站。请排队候车，先下后上。 |
| voice.fz.welcome.fzafz.en | en | Welcome to Aofengzhou station. Please line up for the train. Let the passengers get off first before you get on. |
| voice.fz.next.fzhhgy.zh | zh | 下一站，花海公园。 |
| voice.fz.next.fzhhgy.fzh | fzh | 下一站，花海公园。 |
| voice.fz.next.fzhhgy.en | en | The next station is Huahai Park. |
| voice.fz.arrive.fzhhgy.zh | zh | 列车即将到达花海公园站，请小心列车与站台之间的空隙。 |
| voice.fz.arrive.fzhhgy.fzh | fzh | 列车即将到达花海公园站，请小心列车与站台之间的空隙。 |
| voice.fz.arrive.fzhhgy.en | en | The train is arriving at Huahai Park. Please mind the gap between the train and the platform. |
| voice.fz.welcome.fzhhgy.zh | zh | 欢迎光临花海公园站。请排队候车，先下后上。 |
| voice.fz.welcome.fzhhgy.fzh | fzh | 欢迎光临花海公园站。请排队候车，先下后上。 |
| voice.fz.welcome.fzhhgy.en | en | Welcome to Huahai Park station. Please line up for the train. Let the passengers get off first before you get on. |
| voice.fz.next.fzhzzx.zh | zh | 下一站，会展中心。 |
| voice.fz.next.fzhzzx.fzh | fzh | 下一站，会展中心。 |
| voice.fz.next.fzhzzx.en | en | The next station is Exhibition Center. |
| voice.fz.arrive.fzhzzx.zh | zh | 列车即将到达会展中心站，请小心列车与站台之间的空隙。 |
| voice.fz.arrive.fzhzzx.fzh | fzh | 列车即将到达会展中心站，请小心列车与站台之间的空隙。 |
| voice.fz.arrive.fzhzzx.en | en | The train is arriving at Exhibition Center. Please mind the gap between the train and the platform. |
| voice.fz.welcome.fzhzzx.zh | zh | 欢迎光临会展中心站。请排队候车，先下后上。 |
| voice.fz.welcome.fzhzzx.fzh | fzh | 欢迎光临会展中心站。请排队候车，先下后上。 |
| voice.fz.welcome.fzhzzx.en | en | Welcome to Exhibition Center station. Please line up for the train. Let the passengers get off first before you get on. |
| voice.fz.next.fzlp.zh | zh | 下一站，林浦，可换乘6号线。 |
| voice.fz.next.fzlp.fzh | fzh | 下一站，林浦，可换乘6号线。 |
| voice.fz.next.fzlp.en | en | The next station is Linpu, the interchange with Line 6. |
| voice.fz.arrive.fzlp.zh | zh | 列车即将到达林浦站，请小心列车与站台之间的空隙。 |
| voice.fz.arrive.fzlp.fzh | fzh | 列车即将到达林浦站，请小心列车与站台之间的空隙。 |
| voice.fz.arrive.fzlp.en | en | The train is arriving at Linpu. Please mind the gap between the train and the platform. |
| voice.fz.welcome.fzlp.zh | zh | 欢迎光临林浦站。请排队候车，先下后上。 |
| voice.fz.welcome.fzlp.fzh | fzh | 欢迎光临林浦站。请排队候车，先下后上。 |
| voice.fz.welcome.fzlp.en | en | Welcome to Linpu station. Please line up for the train. Let the passengers get off first before you get on. |
| voice.fz.next.fzcm4.zh | zh | 下一站，城门，可换乘1号线。 |
| voice.fz.next.fzcm4.fzh | fzh | 下一站，城门，可换乘1号线。 |
| voice.fz.next.fzcm4.en | en | The next station is Chengmen, the interchange with Line 1. |
| voice.fz.next.fzlzwq.zh | zh | 下一站，螺洲温泉。 |
| voice.fz.next.fzlzwq.fzh | fzh | 下一站，螺洲温泉。 |
| voice.fz.next.fzlzwq.en | en | The next station is Luozhou Hot Spring. |
| voice.fz.arrive.fzlzwq.zh | zh | 列车即将到达螺洲温泉站，请小心列车与站台之间的空隙。 |
| voice.fz.arrive.fzlzwq.fzh | fzh | 列车即将到达螺洲温泉站，请小心列车与站台之间的空隙。 |
| voice.fz.arrive.fzlzwq.en | en | The train is arriving at Luozhou Hot Spring. Please mind the gap between the train and the platform. |
| voice.fz.welcome.fzlzwq.zh | zh | 欢迎光临螺洲温泉站。请排队候车，先下后上。 |
| voice.fz.welcome.fzlzwq.fzh | fzh | 欢迎光临螺洲温泉站。请排队候车，先下后上。 |
| voice.fz.welcome.fzlzwq.en | en | Welcome to Luozhou Hot Spring station. Please line up for the train. Let the passengers get off first before you get on. |
| voice.fz.arrive.fzdfj.fzh | fzh | 列车即将到达帝封江站，请小心列车与站台之间的空隙。 |
| voice.fz.welcome.fzdfj.fzh | fzh | 欢迎光临帝封江站。请排队候车，先下后上。 |
| voice.fz.destination.fzn.fzh | fzh | 本次列车终点站为福州火车南站。 |
| voice.fz.terminal.fzn.fzh | fzh | 下一站是本次列车的终点站，福州火车南站。请全部乘客带齐行李物品在此站下车，欢迎再次乘坐福州地铁。 |
| voice.fz.platform.fzn.1.fzh | fzh | 一站台，福州火车南站方向列车即将进站。 |
| voice.fz.platform.fzn.2.fzh | fzh | 二站台，福州火车南站方向列车即将进站。 |
| voice.fz.destination.jxhy.fzh | fzh | 本次列车终点站为荆溪厚屿。 |
| voice.fz.terminal.jxhy.fzh | fzh | 下一站是本次列车的终点站，荆溪厚屿。请全部乘客带齐行李物品在此站下车，欢迎再次乘坐福州地铁。 |
| voice.fz.platform.jxhy.1.fzh | fzh | 一站台，荆溪厚屿方向列车即将进站。 |
| voice.fz.platform.jxhy.2.fzh | fzh | 二站台，荆溪厚屿方向列车即将进站。 |
| voice.fz.arrive.fzjxhy.fzh | fzh | 列车即将到达荆溪厚屿站，请小心列车与站台之间的空隙。 |
| voice.fz.welcome.fzjxhy.fzh | fzh | 欢迎光临荆溪厚屿站。请排队候车，先下后上。 |
| voice.fz.next.fznldx.fzh | fzh | 下一站，农林大学。 |
| voice.fz.arrive.fznldx.fzh | fzh | 列车即将到达农林大学站，请小心列车与站台之间的空隙。 |
| voice.fz.welcome.fznldx.fzh | fzh | 欢迎光临农林大学站。请排队候车，先下后上。 |
| voice.fz.next.fzht5.zh | zh | 下一站，洪塘，可换乘4号线。 |
| voice.fz.next.fzht5.fzh | fzh | 下一站，洪塘，可换乘4号线。 |
| voice.fz.next.fzht5.en | en | The next station is Hongtang, the interchange with Line 4. |
| voice.fz.next.fzzb.fzh | fzh | 下一站，阵坂。 |
| voice.fz.arrive.fzzb.fzh | fzh | 列车即将到达阵坂站，请小心列车与站台之间的空隙。 |
| voice.fz.welcome.fzzb.fzh | fzh | 欢迎光临阵坂站。请排队候车，先下后上。 |
| voice.fz.next.fzmr.fzh | fzh | 下一站，马榕。 |
| voice.fz.arrive.fzmr.fzh | fzh | 列车即将到达马榕站，请小心列车与站台之间的空隙。 |
| voice.fz.welcome.fzmr.fzh | fzh | 欢迎光临马榕站。请排队候车，先下后上。 |
| voice.fz.next.fzjs.fzh | fzh | 下一站，金山，可换乘2号线。 |
| voice.fz.arrive.fzjs.fzh | fzh | 列车即将到达金山站，请小心列车与站台之间的空隙。 |
| voice.fz.welcome.fzjs.fzh | fzh | 欢迎光临金山站。请排队候车，先下后上。 |
| voice.fz.next.fzfgl.fzh | fzh | 下一站，凤冈里。 |
| voice.fz.arrive.fzfgl.fzh | fzh | 列车即将到达凤冈里站，请小心列车与站台之间的空隙。 |
| voice.fz.welcome.fzfgl.fzh | fzh | 欢迎光临凤冈里站。请排队候车，先下后上。 |
| voice.fz.next.fzpsdd.fzh | fzh | 下一站，浦上大道。 |
| voice.fz.arrive.fzpsdd.fzh | fzh | 列车即将到达浦上大道站，请小心列车与站台之间的空隙。 |
| voice.fz.welcome.fzpsdd.fzh | fzh | 欢迎光临浦上大道站。请排队候车，先下后上。 |
| voice.fz.next.fzxj.fzh | fzh | 下一站，霞镜。 |
| voice.fz.arrive.fzxj.fzh | fzh | 列车即将到达霞镜站，请小心列车与站台之间的空隙。 |
| voice.fz.welcome.fzxj.fzh | fzh | 欢迎光临霞镜站。请排队候车，先下后上。 |
| voice.fz.next.fzdl.fzh | fzh | 下一站，东岭。 |
| voice.fz.arrive.fzdl.fzh | fzh | 列车即将到达东岭站，请小心列车与站台之间的空隙。 |
| voice.fz.welcome.fzdl.fzh | fzh | 欢迎光临东岭站。请排队候车，先下后上。 |
| voice.fz.next.fzty.fzh | fzh | 下一站，台屿。 |
| voice.fz.arrive.fzty.fzh | fzh | 列车即将到达台屿站，请小心列车与站台之间的空隙。 |
| voice.fz.welcome.fzty.fzh | fzh | 欢迎光临台屿站。请排队候车，先下后上。 |
| voice.fz.next.fzpy.fzh | fzh | 下一站，盘屿。 |
| voice.fz.arrive.fzpy.fzh | fzh | 列车即将到达盘屿站，请小心列车与站台之间的空隙。 |
| voice.fz.welcome.fzpy.fzh | fzh | 欢迎光临盘屿站。请排队候车，先下后上。 |
| voice.fz.next.fzws.fzh | fzh | 下一站，吴山。 |
| voice.fz.arrive.fzws.fzh | fzh | 列车即将到达吴山站，请小心列车与站台之间的空隙。 |
| voice.fz.welcome.fzws.fzh | fzh | 欢迎光临吴山站。请排队候车，先下后上。 |
| voice.fz.next.fzgszl.fzh | fzh | 下一站，盖山竹榄。 |
| voice.fz.arrive.fzgszl.fzh | fzh | 列车即将到达盖山竹榄站，请小心列车与站台之间的空隙。 |
| voice.fz.welcome.fzgszl.fzh | fzh | 欢迎光临盖山竹榄站。请排队候车，先下后上。 |
| voice.fz.next.fzyx.fzh | fzh | 下一站，义序。 |
| voice.fz.arrive.fzyx.fzh | fzh | 列车即将到达义序站，请小心列车与站台之间的空隙。 |
| voice.fz.welcome.fzyx.fzh | fzh | 欢迎光临义序站。请排队候车，先下后上。 |
| voice.fz.next.fzdfj5.zh | zh | 下一站，帝封江，可换乘4号线。 |
| voice.fz.next.fzdfj5.fzh | fzh | 下一站，帝封江，可换乘4号线。 |
| voice.fz.next.fzdfj5.en | en | The next station is Difengjiang, the interchange with Line 4. |
| voice.fz.next.fzlzgz.fzh | fzh | 下一站，螺洲古镇。 |
| voice.fz.arrive.fzlzgz.fzh | fzh | 列车即将到达螺洲古镇站，请小心列车与站台之间的空隙。 |
| voice.fz.welcome.fzlzgz.fzh | fzh | 欢迎光临螺洲古镇站。请排队候车，先下后上。 |
| voice.fz.next.fzqj.fzh | fzh | 下一站，前锦。 |
| voice.fz.arrive.fzqj.fzh | fzh | 列车即将到达前锦站，请小心列车与站台之间的空隙。 |
| voice.fz.welcome.fzqj.fzh | fzh | 欢迎光临前锦站。请排队候车，先下后上。 |
| voice.fz.next.fzlj.fzh | fzh | 下一站，龙江。 |
| voice.fz.arrive.fzlj.fzh | fzh | 列车即将到达龙江站，请小心列车与站台之间的空隙。 |
| voice.fz.welcome.fzlj.fzh | fzh | 欢迎光临龙江站。请排队候车，先下后上。 |
| voice.fz.doorsClosing.fzh | fzh | 车门即将关闭，请注意安全。 |
| voice.emu.depart.gzf.zh | zh | 旅客们，欢迎乘坐D三三零九次列车。本次列车由广州东站开往福州南站。 |
| voice.emu.depart.gzf.en | en | Welcome aboard train D three three zero nine, from Guangzhou East to Fuzhou South. |
| voice.emu.next.gzf.zh | zh | 前方到站，福州南站。请您带好随身物品，准备下车。 |
| voice.emu.next.gzf.en | en | We will soon arrive at Fuzhou South. Please take your belongings and get ready to leave the train. |
| voice.emu.arrive.gzf.zh | zh | 福州南站到了。欢迎您来到福州，下车时请注意列车与站台之间的空隙。 |
| voice.emu.arrive.gzf.en | en | We have arrived at Fuzhou South. Welcome to Fuzhou. Please mind the gap when leaving the train. |
