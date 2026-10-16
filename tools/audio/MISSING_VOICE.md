# 缺失的报站语音片段

由 `node tools/audio/export_jobs.mjs` 生成。全网共需 413 条片段，已有 MP3 410 条，缺 3 条（普通话 1 / 粤语 1 / 英语 1）。
缺失片段在游戏里自动用 Web Speech 朗读（zh-CN → zh-HK（若有）→ en-US（若有），语速 0.95），并照常显示字幕。

生成方法：设置环境变量 DASHSCOPE_API_KEY 后运行 `python3 tools/audio/generate_voice.py`（会读取 voice-jobs.json，只生成缺的）。

| id | 语言 | 文本 |
| --- | --- | --- |
| voice.visit.njs.zh | zh | 农讲所站附近有农讲所旧址、文明路糖水街，欢迎下车游玩，请从C出口出站。 |
| voice.visit.njs.yue | yue | 农讲所站附近有农讲所旧址、文明路糖水街，欢迎落车游玩，请喺C出口出站。 |
| voice.visit.njs.en | en | Nongjiangsuo station is near the Peasant Movement Institute and the Wenming Road dessert street. You are welcome to get off and visit. Please use Exit C. |
