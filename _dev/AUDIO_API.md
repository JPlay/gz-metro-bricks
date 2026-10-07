# GZ.Audio 接口（audio，紧急性能版 audio-perf-1）

普通 script：`config.js` → `audio.js`。所有声音为本地 MP3，浏览器不调用百炼、不使用密钥或 SpeechSynthesis。根路径从 audio.js 的 URL 自动推导。119 个素材、90 个语音片段、四站双方向组合，完整文本与来源见 `assets/audio/manifest.json` / `CREDITS.md`。

```js
const A = GZ.Audio;
await A.preload(ratio => { /* 0..1 */ });
// 首次点击事件内立即调用，不要先 await 加载。
A.unlock();
A.setStationAudio({
  concourseSpeakers: [{x:8,y:25,z:-10}],
  platformSpeakers: [{x:0,y:12,z:4}],
  trainSpeakers: [{x:8,y:10,z:14.6}],
  escalators: [{id:'platform-down',position:{x:22,y:12,z:0},zone:'concourse'}]
});
// 每帧在相机变换后调用，复用 THREE.Vector3。
A.setListener(camera.position, camera.getWorldDirection(audioForward));
A.setZone('platform');
await A.announce('platform',{station:'gyq',dir:1,platform:1});
const seconds = A.trainApproach({from:headStart,to:headStop,sourceId:'approaching-train'});
// 如果与 world 精确锁定，每帧覆盖这次进站声源位置：
A.setSourcePosition('approaching-train',headWorld);
A.sfx('doorOpen',{position:doorWorld,duration:1.25});
A.setZone('train');
A.trainSound({speed:.55,inside:true,braking:false,curve:0});
await A.announce('next',{station:'njs',dir:1});
```

所有点为世界坐标 `{x,y,z}`，与 camera 同一尺度，Y 向上，forward 是相机看向的方向（不是欧拉角）。`setListener` 不持有传入对象，不分配临时向量；无变化时跳过 AudioParam 更新；模块内部最多30Hz更新听者参数。配置数组中点也支持 `[x,y,z]`，逐帧 listener/source 使用点对象。站台、列车模型若挂在 group 下，调用方先 localToWorld；乘客在车厢 group 下同理。示例数字仅为接入说明，实际点取 world/nav。不要每帧重新配置整个站。

## 空间与循环广播

- `setListener(pos,forward)`：同步 AudioListener，归一化 forward；约25ms平滑，兼容旧 `setPosition/setOrientation`。耳朵高度取相机位置。
- `sfx(name,opts={}) → number`：`position` 建立 equalpower PannerNode（机电与脚步），随听者走动/转头变化；无位置保持原有自身动作/扩散试听用法。默认 inverse 距离模型、参考距离5世界单位、rolloff1.25；可传 `refDistance/rolloff`。`volume=1`、`rate=1`、`pan=0` 保持兼容。`duration` 用素材时长/行程调整 rate（范围0.25–4），返回真实播放秒数，应优先使用返回值。
- `sourceId` 为一次声音的标识。`setSourcePosition(id,pos)` 更新正在播放的同名 Panner 或已配置扶梯；不会创建不存在的声源。移动瞬态更新会覆盖 from/to 自动轨迹，内部限至30Hz；已配置扶梯是定点床声，位置调整立即更新，不应逐帧重定位。传入对象不被持有。最多10个瞬态同时发声；NPC以 `npc:true` 或 `sourceId:'npc-'+id` 标记，最多3个同时脚步，超出停止最早一个。自己的脚步不需要位置。
- `setStationAudio({concourseSpeakers,platformSpeakers,trainSpeakers,escalators})`：换站/建站调用一次；喇叭数组最多各16点，播放时选离听者最近一只。PA朝下、HRTF定位、高通280Hz/低通4400Hz及低音量早期反射。缺少喇叭点时回退非定位广播，所以 **play 必须传真实世界点**。扶梯最多8台，条目 `{id,position,zone,volume=.5}`；同zone时只启动离听者最近的2台；移动时每0.5秒重选，离开后停止节点。
- `setZone('street'|'concourse'|'platform'|'train'|'none')`：环境平滑交叉过渡；仅创建当前需要的循环节点。站厅/站台自动调度安全广播，初次约20秒，完成后随机45–80秒。连续不会选同一条；一条普通话→粤语，音量0.38并从头顶/远处喇叭发出。
- `setStationAnnouncements({enabled=true,minInterval=45,maxInterval=80,initialDelay=20})`：可关闭或调整。minInterval下限5秒，initialDelay下限0.25秒仅供调试。更改会取消当前安全广播并重新定时。
- `stationAnnouncement(key?) → Promise<{cancelled,skipped?,key?}>`：调音台强制试听，默认随机；仅当前站内zone可播，报站/其他安全广播忙时返回 `{skipped:true,cancelled:false}`，不会加入陈旧队列。key：`escalator/care/walk/queue/psd/lights`；适用zone见 manifest.stationSafety。
- 普通 `announce` 优先，立即打断安全广播。离开站内zone、换站配置、静音、stopAll、后台/AudioContext中断均取消安全广播；恢复后等待新间隔，不补播旧条目。play 不要另建广播定时器。

## 列车与门机构

- `trainSound({speed:0..1,inside=true,braking=false,curve=0})`：每帧调用。电机、真实轮轨纹理、接缝、制动、过弯轮缘摩擦独立平滑混合；0速度无运动循环。`curve` 是当前过弯接触强度0..1，省略为直线；不要把任何模拟弯道声当成广州实际区间曲线的测绘数据。
- 起步（从0跨过0.006，车内，非制动）自动播 `train.tractionStart`，5.2秒牵引逆变器分级升调；制动到0自动播 `train.airRelease`，1.75秒。调用方不必重复触发。停止、开始制动或离开车内时终止尚未播完的升调；连续抖动有4秒起步/2秒放气防重入。持续电机率仍随速度变化。
- `trainApproach(opts) / trainDepart(opts) → number`：完整站台进/出站，默认15/13秒。`from/to` 创建可移动Panner，按smoothstep从起点运动到终点；可传 `sourceId` 与逐帧 world 车头位置锁定（world提供 getHeadPosition(dir)，需转世界坐标）。`duration/volume` 可选，返回真实秒数。参考距离18、rolloff1.15。车内持续行驶使用 trainSound，避免叠站台离站声。
- 车门/PSD `doorOpen/doorClose/psdOpen/psdClose` 已按 world 标准重制为 **1.25秒**，闸机 `gateOpen` 为 **0.60秒**。请在动画开始时播，开度按 `dt / (train.doorDuration||1.25)`；可传duration适配未来行程。关门警示 `doorChime` **3.62秒**，先播提示，再播机械行程，二者独立。正常进站不自动鸣笛。
- 全部动作名称：`footstep`（自动轮换4种）、`footstep2/3/4`、`ticketMachine/tokenDrop/securityBeep/gateBeep/gateOpen/doorChime/doorOpen/doorClose/psdOpen/psdClose/horn/escalator`。escalator为循环素材，正常由 setStationAudio 管理；sfx直接调用只播放一遍。

## 报站、加载与状态

`announce(key,params) → Promise<{cancelled:boolean}>`：普通话→粤语→英语串行排队，报站压低环境/列车声。`params.station` 接受四站id、中文名、配置对象或索引，默认gyq；`dir` 为1/up/广州东站或-1/down/西塱（direction同义，destination接受终点名）；platform为1/2，未传是场景默认编号，不宣称实站编号已经核验。可传 `position/sourceId` 覆盖自动选择的头顶喇叭。

key：`platform/next/arrive/doorsClosing/gap/transfer/terminal/destination/welcome`。别名 `arrival/arrived/nextStation/approach/doorClose/closeDoors`。next为终点三语→下一站三语→下车侧/换乘三语。公园前右门下车、中部楼梯换乘2号线；其余三站左门下车。transfer仅公园前/东山口有广播。未知站/广播或加载错误 reject。

- `preload(onProgress) → Promise<manifest>`：复用加载，最多2路fetch/decode；29个机电/列车/环境素材预解码，90段语音保留约2.89MiB本地MP3、播放前按需解码。语音PCM使用8MiB LRU缓存，不淘汰仍在播放的缓冲；重要广播和安全广播在await解码后重新检查取消epoch/场景，旧声音不会恢复串播。失败等所有工作流结束再reject、重试复用已准备资源。语音冷`preview`同步返回清单时长，异步解码后播放；`stopAll`/后台取消会抑制待解码声音。回调式decodeAudioData兼容旧WebKit。尝试24kHz主AudioContext；用OfflineAudioContext把循环床存为16kHz、其他素材/语音24kHz，硬件48kHz也不使缓存翻倍；Offline不可用时回退主context，getState报告真实采样率。加载不自动出声。
- `unlock() → Promise<boolean>`：真实点击内同步创建/启动1帧静音源并调用resume，然后才await。未解锁/后台调用声音会跳过或返回cancelled，避免陈旧报站在第一次点击时突然串播。不要在等待preload之后才调用unlock。
- `sfx` 未完成preload时启动加载，但同步返回0；要安排动画先等preload。加载后未解锁/后台也返回0。
- `setMuted(bool)` 保持重要广播时序，取消安全广播；`setVolume(0..1)`；`setMix({ambience,train,sfx,voice})` 默认 .65/.8/.8/1。
- `stopAll()`：停止全部瞬态和循环节点（含正在淡出的节点）、清空PA回声、清除安全计时，zone置none、speed置0；当前/排队广播resolve `{cancelled:true}`，挂起状态也能完成取消。需要重新setZone才恢复场景声音。
- `suspend() → Promise`：取消瞬态/旧广播、清空PA回声、停止循环与正在淡出的节点、释放AudioSession意图、挂起context，保留zone/速度供恢复；调音台可模拟。`unlock` 重新启动当前需要的床声。
- `getState()`：加载/context/unlocked/needsGesture/background、zone/speed/inside/braking/curve、announcing/queued/ducked、stationAnnouncing/nextStationAnnouncementMs、active/beds/retiringBeds/spatialSources/listener、assetCount/decodedAssetCount/decodedBytes/compressedVoiceBytes/voiceCacheBytes/voiceCacheLimit、sampleRate/loopDecodeRate/voiceDecodeRate/decodeConcurrencyPeak/pendingVoiceDecodes、spatialPannerCount/hrtfPannerCount/audioPerformanceVersion、audioSessionSupported/mix/errors。
- `getLevel() → number` 总输出RMS；`preview(assetId,opts) → number` 单段一次试听，无广播压低；`getManifest()`。
- `gz-audio-caption`：每段广播开始 `{id,text,lang,channel:'important'|'station'}`，结束detail=null。`gz-audio-state`：`{context,needsGesture,background}`。均为可选window事件。

## iOS Safari

首次触摸必须直接unlock。支持 `navigator.audioSession` 时请求playback；不支持时不依赖此接口（Safari16.0–16.3静音开关可能让Web Audio无声）。模块监听 visibilitychange/pagehide/pageshow(BFCache) 与context statechange：进入后台取消旧广播、停止床声并suspend；回前台尝试resume，失败保留needsGesture，下次真实点击/touchend/keydown重试。检测到interrupted或suspended同样取消旧序列，不承诺能绕过WebKit系统级音频故障。具体真机风险和来源见 STATUS-audio。

预算：119MP3，5,541,195字节（5.284MiB），素材不改。旧版全解码PCM 72.4MiB；紧急版初始28.7MiB、语音缓存8MiB；48kHz硬件替身遍历90语音的缓存PCM峰36.7MiB（按AudioBuffer长度估计，非进程RSS），具体场景峰值见STATUS。最多2同时解码，是项目主动限制。空间报站和移动列车保留HRTF，机电/脚步/扶梯使用equalpower；最多2台近处扶梯、3个NPC瞬态和10总瞬态。PA反射从5路减为2路，听者/移动瞬态声源最多30Hz、列车混音20Hz；API仍可每帧调用。循环床保留立体声，以16kHz存储会削掉8kHz以上细节，优先流畅和内存；语音24kHz/普通话粤语英文文本及MP3不变。调音台 `http://localhost:8080/_dev/audio-test.html`。


## 性能复测

每次独立路线需CDP CPU6全程、`?perf=1`记录帧率/脚本/渲染预算；审计默认关闭，只有`?audit=1`显式启用（由play实现）。音频模块隔离压力报告见`shots/audio/perf/`，它不能代替含world/play的≥50fps完整路线，更不是A12真机DSP测量。旧图/旧批和当前音频性能边界见STATUS。

独立验收使用有界面Chromium并记录实际WebGL GPU，原生上下文deviceScaleFactor=2，横1112×834/竖834×1112；逐阶段和逐秒核对deviceDPR恒2、renderer上限1.5，拒绝软件栅格化或中途降成deviceDPR1的证据。保留每秒帧率、最差帧间隔及抓图时间；按协调人20:30裁决，CPU6各阶段平均≥50fps；单秒最低和抓图波动保留诊断，不独立判失败。原速阶段中位≤2ms、95分位≤5ms，阶段首帧/首次显示列车/开界面尖峰≤12ms且每阶段≤3；candidate21 native d/e已由协调人裁定达标，A3-041旧峰值项关闭。默认12、显式audit=1几何12和独立4自然路线依裁决顺序用同一冻结源通过。每次真实转头还核对实际yaw/pitch，图片名称不能替代360°/抬低头覆盖。脚本见`tools/audio/run-natural-cpu6.sh`、`check-performance.py`；当前最终联合复测状态见STATUS，准备脚本不等于已通过。

解码采样率行为依据[Web Audio规范](https://www.w3.org/TR/webaudio/#dom-baseaudiocontext-decodeaudiodata)；HRTF/equalpower模型见[规范PannerNode](https://www.w3.org/TR/webaudio/#panningmodeltype)。

主流程控制开销另经负责人分段报告独立核读：`owner-audio-control-profile-review.json` 与 `owner-slow-audio-control-review.json`（位于 `shots/audio/round3/`）记录原报告和 Audio 源 SHA；trainSound/setListener 各单次峰约0.2ms。`audioAndUI` 的合并标签还包含NPC脚步、交互/DOM和标记更新，不能把整个分段都归给音频。原生DSP与系统音频线程不在这些JavaScript计时里；实际48kHz/CPU6冷解码压力及资源峰值见 `shots/audio/perf/audio-perf-cold-cpu6.json`。
