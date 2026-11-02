# 缺失的报站语音片段

由 `node tools/audio/export_jobs.mjs` 生成。全网共需 1095 条片段，已有 MP3 1089 条，缺 6 条（普通话 2 / 粤语 0 / 英语 2）。
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
