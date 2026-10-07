# 音频制作工具

全部是离线制作/验证工具，网页不执行它们。Python 3 + numpy + requests + 本机 ffmpeg/ffprobe；没有 npm 运行时依赖。

- `generate_voice.py`：百炼 HTTP TTS，四个并行请求，可断点续作。只从环境变量读取 `DASHSCOPE_API_KEY` 和 `DASHSCOPE_HOST`。`--only <id子串>` 可仅重制匹配片段，`--manifest-only` 只写文字清单。既有非语音素材会保留。
- `generate_soundscape.py`：固定随机种子生成通风、机械、轮轨和双音门铃，叠加已许可录音的精选纹理。原作应位于系统临时目录 `/tmp/gz-audio-source/`，文件名 street.mp3、crowd.mp3、ride.mp3；来源见 `assets/audio/CREDITS.md`。
- `validate_assets.py`：验证119项清单/文件一致、四站双方向三语覆盖、全部契约音效、MP3解码、非静音、无样本削波、时长及≤20 MB预算，报告为 `validation.json`。
- `check_transcription.py`：可选付费回转录质量检查（qwen3-asr-flash），只存原文与识别文字，不存原始 API 响应/请求头/密钥/签名 URL。它是辅助检查，专有名词、繁简体、同音字及短句省略不可单凭字符相似度判断发音错误。
- `find_rail_excerpt.py`：筛选真实轮轨段，避免夹入异地可辨广播。初始118秒片段被回转录检出报站，最终改用150秒起片段。筛选及最终报告见 `rail-excerpt-check.json`、`transcription-rail-final.json`。

`voice-cache.json` 只存片段制作指纹；修改语音模型、音色、文本后会重制。改变 DSP 或播报指令后，应移除对应指纹再重制。实际 API 结果不落盘，原始语音 WAV 经系统临时文件处理后即删除。

真实浏览器：Ego TaskSpace 46 验证了原始解码、静音、自然三语序列、广播排队、四站双方向完整next、挂起取消及连续列车声。JSON记录与 `_dev/shots/audio/` 截图保存证据；尺寸模拟为 Chromium 820×1180，不宣称 iPad Safari 真机测试。页面 `http://localhost:8080/_dev/audio-test.html` 可逐项重复试听。


第二轮：先运行 `generate_voice.py --only safety.` 合成6条普通话/粤语，再运行 `generate_round2.py` 补扶梯、起步、过弯、放气并重制1.25秒门机构。若重新运行第一轮 soundscape，它会替换非语音清单，必须紧接着运行 round2 恢复第二轮素材。最后 `validate_assets.py` 检查119项与安全广播/门时长契约。

`check_transcription.py --only safety. --report transcription-round2.json` 对新增安全语音做付费ASR。环境变量始终仅进程内读取；生产代码和报告不存响应、签名URL或密钥。

`browser_round2_qa.js` 是 Ego 真实浏览器专项复测脚本，当前绑定本次任务空间49和p1/p2。空间结束后不可直接复用这个空间编号，独立新任务须修改为自己的新空间/页面。覆盖HRTF左右反转/距离/移动覆盖、6条安全广播自然播放、优先打断/随机调度/离区取消、起步/过弯/放气/门时长/NPC上限、真实tab隐藏恢复及挂起取消。报告 `browser-round2-checks.json`；生产API不依赖该QA注入。浏览器PCM内存实测72.4MiB，与MP3文件体积不同。


紧急性能版 `audio-perf-1`：上述第二轮72.4MiB为旧快照，当前初始PCM28.7MiB，语音按需LRU，接口见AUDIO_API。`browser_perf_qa.js` 与 `browser_perf_lifecycle_qa.js` 是Playwright `run-code` 函数表达式，各用**新的独立Chromium context**执行一次，避免重复安装原生节点计数器。第一份测原速/CPU6站厅PA、双侧门机械音、车内/移动列车；第二份测实际48kHz AudioContext、CPU6冷九段报站、解码中取消、全部90预览与挂起恢复。仅覆盖音频隔离场景，不代表整站或A12真机。

本地服务8080已运行。使用playwright技能wrapper建立自己的新session，先open调音台，再`--raw run-code --filename=_dev/tools/audio/browser_perf_qa.js`保存JSON，随后close自己的session。生命周期脚本另建新session。截图保存在`shots/audio/perf/audio-perf-recheck*.png`，人工查看后才记录通过。实际16:58冻结证据及hash在`shots/audio/perf/audio-perf1-summary.json`。测试不调用付费API、不读取密钥。


`natural_cpu6_template.js` 为第三轮性能新批的独立自然路线观察器，替换三个占位符后在自己的独立Chromium执行，先创建输出目录。**必须等生产冻结并取得独占性能浏览器窗口**。全程CPU6，Air3横屏1112×834/DPR2（生产renderer限1.5），portrait命名路线在pickup后保持834×1112/DPR2；真实点击、环顾360°/抬低头/行走随机转头和四币/坐姿/站起/中途继续，不使用debug.goto/位置/时间修改。返回实际响应SHA、轻量帧率/预算/音频资源采样、最终perf报告、真实门坐标与panner。所有PNG人工逐张看，另运行check-door-spatial.py。默认关闭的audit报告不能算几何0，需要同生产另跑audit=1的完整12。qa-screenshot-start/end保留抓图/机器只读实体检查的时间，辅助识别测试采集自身的开销，不可直接抹掉真实交互掉帧。CPU6只是代理，并非真实Safari/A12。

`browser_perf_cold_qa.js`补音频首次冷解码的CPU6帧间隔：初始零语音PCM、完整九段真实next、两段安全PA，再遍历90预览缓存；实际48kHz原生context。只有一台活跃音频页时执行，用于防止把解码卡顿藏到第一次广播。已于17:34在独占窗口运行通过，结果为shots/audio/perf/audio-perf-cold-cpu6.json，截图亦已逐张看；只证明音频冷解码帧调度，不替整站。


独立自然CPU6脚本现在须用 `open about:blank --browser=chrome --headed --config=_dev/tools/audio/playwright-ipad.json` 创建原生DPR2上下文，然后一个长run-code运行到底；不再用与上下文默认DPR1冲突的临时CDP像素覆盖。竖屏只用真实setViewportSize，DPR仍2；每阶段deviceMin/Max与逐秒采样硬断言。CDP只设置CPU6/网络只读取证。`check-performance.py verification.json joint-source.json` 校验15阶段、≥50fps/150calls/180k、实际DPR、避障失败、九响应真实SHA和当前冻结源；原速脚本median≤2/P95≤5ms（首帧等尖峰≤12ms且每阶段≤3）与显式audit12另验，不以disabled零帧代替。依20:30协调人裁决，CPU6用阶段平均≥50fps验收；抓图与无抓图的低一秒窗口都保留诊断，不再独立判失败。

自然性能批显式headed并保存真实WEBGL_debug_renderer_info；check-performance硬拒SwiftShader/llvmpipe/swrast/未知GPU。原生DPR2配置已用独立静态about:blank验证横竖切换与截图后的五快照均2，证据native-dpr2-fixture.json；此静态配置检查不能代替游戏帧率。

`run-natural-cpu6.sh RUN FROM TO JOINT_MANIFEST` 自动核对联合冻结源、创建全新结果目录、用原生DPR2 headed Chrome跑一个完整自然旅程、保存前后源/实际响应、同时产出性能与门声判定，再close唯一自有页。只在协调好的独占窗口执行；PNG人工复核仍是独立必需步骤。

观察器进一步核对真实鼠标拖动后的yaw/pitch（误差≤0.08rad），scanCoverage保存每阶段7个实际视角及7图范围；进站/关门/抵站也环顾，不只停在默认视角。拖动无法达到目标或自然驱动异常会保存QA-FAILED图和runnerErrors，不能静默算通过。显式记录Audit.update/Station.validate调用数0、初始/末尾求解计数及shadowMap.enabled=false；这些证据缺失同样失败。当前仅已准备/语法检查，最终四条实际执行与人工逐图账本仍须另完成。

`check-joint-evidence.py JOINT_MANIFEST CPU6_BATCH AUDIT_BATCH NATIVE_BATCH RUN1 RUN2 RUN3 RUN4`核对同SHA独立4、正式CPU6完整12、显式audit完整12、原速双向、World R14四站两向8例/60人模块6192预算及真实PNG逐图SHA账本。只生成自动证据结论，永远不自行把DEFECTS人工结论改通过；负例/所有视觉问题仍由测试员复核。不能拿先前R20/R11旧脚本或报告拼最终交付。

最终执行顺序按BRIEF 20:30裁决：world/play冻结 → play正式12审计/12默认 → root独立4。停止新增优化；candidate21 native d/e已被协调人接受，旧峰值不再卡验收。
