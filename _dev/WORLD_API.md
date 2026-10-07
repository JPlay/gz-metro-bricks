# WORLD API · v3（第三轮，2026-10-07）

**已定稿，可立即对接。** 普通 script，加载顺序：`three.min.js` → `js/metro/config.js` → `js/metro/train.js` → `js/metro/station.js`。仅依赖 THREE r128 和 GZ.config，不依赖 NPC/Audio。所有坐标是模块 group 的本地坐标，1 单位 = 1 积木颗粒，X 沿车长，Y 向上；`update` 的 dt 为秒，speed 为 0..1。调用方负责 renderer、照明、相机、逐帧 update 及 group 的放置。


## 第三轮碰撞与结构接口（已实现）

`st.colliders` / `train.colliders` 为稳定数组，项为 `{id,kind,min:{x,y,z},max:{x,y,z},enabled,owner}`；街面移动汽车/公交的全部构件另有 `dynamic:true` 和 `motion:{type:'traffic',axis:'x',speed,wrapMin:-118,wrapMax:118}`。speed 是有符号 station-local X 速度（汽车±11、公交+7）；每次 `st.update` 后读取当前 min/max，跨网格与道路回绕不能使用初始静态格子。坐标分别为 station-local / train-local，转世界坐标需应用各自 group.matrixWorld。`kind` 是 `obstacle`、`floor`、`ceiling`、`door`；`owner` 用于报告实体名称。地板不做横向障碍，天花检查头部，障碍和门检查身体及相机。enabled 为普通 boolean，静态可见性变化时刷新，避免高频空间查询遍历父链。动态门项在 setDoors/setOpen/st.update 后立即刷新 min/max 和 enabled；闸机 open/close 只修改动画目标，真实扇门 bounds 随 update 更新，不能自行删除关闭门。西班牙式外侧设施仅公园前 enabled。

`st.escalators` 为 `{id,top,bottom,width,min,max}` 数组，width 为梯级宽度；`st.sampleGround(x,z,expectedY)` 返回 `{y,normal:{x,y,z},id,kind}` 或 null。扶梯返回**当前真实移动梯级上表面**，进入/退出平台返回水平面；传 expectedY 选择所在楼层，不能无视楼板穿到另一层。`st.walkableRegions` 给出各层边界与实际开口。`train.sampleGround(x,z,expectedY)` 同样为本地坐标。

`GZ.Station.validate(st,train)` 返回 `{ok,counts,violations,metrics}`。独立于调用者当前视角，检查全部命名路径、两轨全部门路径与公园前外侧下车路径，≤0.5单位采样：净宽≥2.2、净高≥5、脚底支撑；所有脚底 Y<27.9 的路径采样点，26方向真实不透明三角形射线命中；扶梯额外512个均匀球面方向，并检查中心线两侧±0.6的梯井位置；门中心误差≤0.15；列车扫掠全进出站静态间隙≥0.25，包含受电弓、吊顶、隧道口与隧道端墙。counts 每次违规全部累加；violations 每类保留前25条对象/位置。metrics 给出采样/射线数量和净宽、净高、门误差、净距极值。检查真实渲染三角形（包含 InstancedMesh）；封闭检查不使用代理包围盒。正常模式 `setZone` 保留相邻层实体围护；`setCutaway(true)` 专为剖面，不能在游戏或validate中开启。

轨道中心为 **±14.95**（请始终读 tracks[].z，勿硬编码14.6）；岛式PSD仍±9.4，外侧PSD为±20.5，外侧下车点±22.7。主扶梯导航端点保持(-38,14,±2)→(-8,2,±2)，梯级缩到2.6，外围封闭梯井；地面入口/出口端点保持不变，出生点(-76,28,52)，先经(-80,28,40)→(-91,28,40)→(-91,28,27)转入门厅，出口经(78,28,27)→(78,28,39)转出，地标前(52,28,39)。门厅有实体顶与转折挡墙，地下回望不直通天空。门X共用传入 doorXs，不改变车厢长度/座位/正式吊环。

### 碰撞与支撑接入注意

- min/max 是模块根 group 的本地 AABB，不是世界坐标。平移场景时用各自根位置差；一般变换应将8个角转换到世界坐标。数组与 bounds 对象稳定，可缓存空间索引；动态门按最大行程加入索引，近邻再读当前 bounds。隐藏整个 group 时由调用方停用该碰撞集合。
- `kind:'floor'` 是脚底支撑，含楼板与扶梯机身；`supportId` 标识其扶梯。坡上身体检测应结合真实梯级的支撑 ID 和表面，避免把下一块地形当成横墙；上方楼板/顶始终检查。`owner` 是诊断名称，公开字段可 JSON 序列化，内部 THREE 引用不可枚举。
- `st.escalators` 额外提供 `enabled`、`group`、`sample()`，公园前外侧梯井在其余站 disabled。`walkableRegions` 是分层矩形边界、`holes` 楼板实际开口与 enabled，不能把整张 street/hall 矩形当成无障碍区域。墙/柱/设备仍从 colliders 查询。
- `sampleGround` 为实际当前梯级/落地平台/地板上表面；返回 null 表示没有所要求楼层的支撑。列车跨门缝必须检查真实左右脚或足印，不能填入与运行列车相交的固定桥板。`train.sampleGround` 查询实际车厢地板/贯通道/门槛。
- 沿扶梯移动后，expectedY应按新X在top/bottom之间插值预测，随后查询真实级面；梯级采样要求expectedY与该X的名义坡高相差≤1.1。不能横移到新梯级时继续传上一位置的旧Y。
- 闸机通行必须等 `getOpen()===1`；滑门/PSD 的每门通道仅在全开后使用。validate 临时检查真实全开闸机扇门，并恢复原开度和目标，不改变游戏阶段。
- `train.bodyBounds` 是完整实际实体（含受电弓）的 THREE.Box3，Y最大约11.696。`GZ.Station.validateTrainClearance(st,train)` 检查当前完整包围体与 `st.clearanceColliders`，返回 `{ok,gap,objects,penetration}`。支持 station/train 根各自平移，要求根不旋转、不缩放。用于逐帧审计；完整 validate 对逐个实际 train collider 在X∈[-415,415]作解析连续扫掠（不是离散帧采样）。
- `clearanceColliders` 包括 type=platform/psd/ceiling/tunnel 的实体；`psd.openingsByTrack`、`psd.alightOpeningsByTrack` 给出中心/宽度，公园前内外两侧门位均校验。列车与钢轨/枕木的正常轮轨支撑不属于平台/围护净距要求。
- 站台格栅底12.01、轨道±14.95、PSD岛侧±9.4/外侧±20.5、外侧落脚±22.7、外侧扶梯Z±27。站台两侧梯井通道约5.4；所有正式 nav 的净宽/净高由 validate 复核。
- 车站隧道延伸到±720，端墙±721，在到站可移动站体相对列车X±415时，端墙不会扫进整列车。单独行驶 tunnel 顶底12.05，并暴露 colliders / clearanceColliders，可复用 validateTrainClearance。

## Train

```js
const train = GZ.Train.create();
scene.add(train.group);
const st = GZ.Station.build({station:GZ.config.STATIONS[0], dir:1,
  doorXs:train.doors.filter(d => d.side === -1).map(d => d.x)});
train.group.position.set(0, st.trackY, st.tracks[0].z);
```

- `group`：整列中心、轨面为原点；6 节，每节 40，节间 1，整列 `length=245`，宽 10，`floorY=2`，内净宽 8.8、净高 7.2。
- `cars`：6 个车厢静态信息 `{index,x,minX,maxX}`；两端驾驶室关闭，贯通道可行走。
- `doors`：60 个门口（每节每侧5个），`{car,side,x,y,z,width}`；side ±1 对应 z=±5；y=2；width=3.2；x 为整列坐标。每节 offsets `[-14.4,-7.2,0,7.2,14.4]`。
- `setDoors(side,open01)`：立即设置指定侧滑门开度；调用方做时间插值，不会隐式开另一侧。`side=0` 同时控制两侧。
- `seats`：`{car,x,y,z,yaw,position:{x,y,z}}`；y 是座位标称锚点高度（2.95）；实际椅面上表面是3.135，应以真实几何支撑查询落座，眼睛建议 `y+2.4`，相机Z向过道偏0.6以保留≥1的侧墙净距（不改座椅/NPC支撑中心）；yaw 是 THREE 绕 Y 的朝向（0 朝 +Z）。
- `standSpots`：同样的数据形状，y=2（脚底）。
- `walkBounds`：`{minX,maxX,minZ,maxZ,floorY,cars:[...]}`，限制玩家于安全中央通道；`walkBounds.cars` 每节 `{minX,maxX,minZ,maxZ,floorY}`。
- `setRoute({stations,currentIdx,nextIdx,dir})`：stations 是配置站点数组，dir=1 往广州东站、-1 往西塱，门上 LED 线路图与报站屏同步更新。
- `setLights(on)`：车内发光灯带和前后车灯；车头含无阴影 SpotLight 与渐隐轨面光束。
- `update(dt,speed)`：仅车轮转动；车体不做会消耗净距的摇摆。逻辑原点、doors/seats 坐标稳定。
- `dispose()`：释放本实例的几何和纹理；移除 group 由调用方负责。

## Station

```js
const st = GZ.Station.build({station,dir:1,doorXs});
scene.add(st.group);
st.setStation(GZ.config.STATIONS[2]); // 同步色带、站名、出口、地标
st.setDirection(-1);                   // 同步方向标识
st.update(dt);
```

- `trackY=0`；`platformY=2`、`concourseY=14`、`streetY=28`。
- `tracks[0]`：`{z:14.95,stopX:0,side:-1,dir:1,platformZ:9.4}`，往广州东站，车门 side=-1 朝岛式站台。
- `tracks[1]`：`{z:-14.95,stopX:0,side:1,dir:-1,platformZ:-9.4}`，往西塱，车门 side=+1 朝岛式站台。
- `activeTrackIdx`：dir=1 为0，dir=-1 为1。停稳必须保持 train x=0，使用对应的 side 开门。
- `psd.setOpen(trackIdx,open01)`：对应轨道所有屏蔽门立即设置开度，调用方插值，与 train 滑门同时开关。
- `pids.set({trackIdx,destination,minutes})`：minutes 可数字或中文字符串，如 `2` / `'即将进站'`；只在值改变时更新纹理。
- `setStation(station)`、`setDirection(dir)`：原地换站/方向，不重新创建场景。
- `setZone('street'|'concourse'|'platform'|'all')`：记录当前区域，保留街面、站厅、站台与相邻梯井的实体围护，避免切层露天；默认 all。
- `dispose()`：释放资源。

### 导航与交互

`nav` 的路径点都是 `{x,y,z}`（脚底坐标），附加 `zone`；扶梯端点附加 `escalator`、`kind:'escalator'`。`nav.points` 是命名点字典，以下点同时直接放在 nav 上：

| 名称 | 用途 |
|---|---|
| streetSpawn / entranceTop / entranceBottom | 地面出生点、入口扶梯上端、下端 |
| security / securityExit | 安检入口和出口 |
| tvm / ticketPickup | 售票机前与取币位置 |
| gateIn[i] / gateInExit[i] | 3条进闸通道的前后点 |
| platformEscalatorTop / platformEscalatorBottom | 站厅→站台扶梯两端 |
| platformCenter | 岛式站台中心 |
| platformDoorSpots[i] | **当前方向**每门候车点，顺序与传入 doorXs 相同 |
| platformDoorSpotsByTrack[trackIdx][i] | 两侧全部候车点 |
| platformExitEscalatorBottom / platformExitEscalatorTop | 出站上行扶梯 |
| gateOut[i] / gateOutExit[i] | 3条出闸通道的前后点 |
| exitBottom / exitTop / landmark / landmarkView | 上地面扶梯端点与门厅外观景点（landmark与landmarkView同一点） |

`nav.paths` 为命名折线路径数组，元素仍是点对象；进入扶梯的点带 `kind:'escalator', escalator:'entrance'|'platformDown'|'platformUp'|'exit', speed:3.2`（速度单位/秒，建议按3D弧长）。现成路径：`enter`（streetSpawn→security）、`buyTicket`（security→tvm）、`toGate`（tvm→gateIn[0]）、`toPlatform`（gateInExit[0]→platformCenter）、`exitPlatform`（platformCenter→gateOut[0]）、`leave`（gateOutExit[0]→landmark）。`nav.pathToDoor(i,trackIdx?)` 返回从 platformCenter 到候车点的折线（通过中央通道，避开扶梯）。路径仅在调用时新建；不要每帧调用。

`interact.tvm` 为主售票机，`interact.tvms` 是全部机器。每台 `{position,group,buy(),open(),close(),setMessage(text)}`；buy/open 会发出并展示绿色圆形单程票，close 收回，视觉无音频副作用。

`interact.gatesIn[i]` / `gatesOut[i]` 与 nav gate 数组一一对应，每个 `{position,group,duration,getOpen(),getState(),open(),close(),setOpen(open01),insertToken()}`；open/close 由 station.update 自动平滑动画，insertToken 会让绿色币落入投币口并开闸。进站应刷币后 open，出站调用 insertToken。`interact.security` 为 `{position,group}`。交互 position 是玩家站立的脚底点，可转头看 group。

## Tunnel

```js
const tunnel = GZ.Station.buildTunnel();
scene.add(tunnel.group);
tunnel.group.position.set(0,0,st.tracks[trackIdx].z);
tunnel.update(dt,speed);
```

隧道局部 X 沿列车，原点在轨面，列车应在 local z=0；`group` 覆盖整列车前后。墙灯、线缆、接缝按 speed 沿 -X 连续循环，重复构件使用 InstancedMesh。`update(dt,speed)` 不分配临时对象。`setDirection(1|-1)` 切换掠过方向，`dispose()` 释放资源。乘车时建议隐藏车站，只显示列车与隧道。

## 联调约束

世界模型不创建 requestAnimationFrame，不改 camera/scene，不播放音频，不绑定用户事件。门动画、列车位置、玩家/NPC路径调度归 play。列车停靠 y=0，使车内地板与站台同高；doors/seats 需要以 train.group.localToWorld 转世界坐标。入车用候车点→对应 doors→standSpots；出车反向。勿把 trackIdx 当成 door side。

场景用合并静态几何、实例化重复积木、不启用实时阴影；动态文本使用本地 CanvasTexture。场景同屏仍应由 renderer.info.render.calls 复核；iPad pixel ratio ≤2。

## 真实站点核验（2026-10-06）

已用 ego-browser 阅读以下页面的车站色系、站体装修和出口表；config 的 colorVerified 均为 true。公开资料只提供色系名称，HEX 是该色系的积木近似值，**不是官方定标色号**。

| 站点 | 1号线真实装修 | config color | 选用出口与地标 | 查证来源 |
|---|---|---|---|---|
| 公园前 | 白色；1号线白色陶瓷柱、石板墙 | #FFFFFF | **F口**，吉祥路→人民公园（原D口已修正） | [公园前站](https://zh.wikipedia.org/wiki/公园前站) |
| 农讲所 | 砖红色 | #9C1010（资料图例色） | C口，中山四路→农民运动讲习所旧址 | [农讲所站](https://zh.wikipedia.org/wiki/农讲所站) |
| 烈士陵园 | 土黄色＋白色大理石（勿混用12号线青绿色） | #C8AA6E | D口，中山三路→广州起义烈士陵园正门 | [烈士陵园站](https://zh.wikipedia.org/wiki/烈士陵园站_(广州市)) |
| 东山口 | 米黄色＋红色花岗岩柱（勿混用6号线卡其色） | #E6D6AD | F口，署前路/市政人行通道→龟岗大马路、东山洋楼街区 | [东山口站](https://zh.wikipedia.org/wiki/东山口站) |

东山口F口连通6号线站厅和市政人行通道，demo中的连续扶梯属于适合儿童游玩的空间缩约；并非实测建筑复刻。公园前真实为岛式上车＋两侧式下车的西班牙式站台，应右出左进；具体额外接口见后续补充。

## 公园前西班牙式站台补充（已实现）

`st.spanishLayout` 为是否公园前。公园前保留中央岛式上车，增加两侧下车平台及两座上行扶梯；其余站隐藏此结构。停车中心与全部门坐标不变。

- `tracks[trackIdx].alightSide`：下车侧。公园前为 `-side`；其余站为 `side`。`alightZ` 为对应屏蔽门平面。
- `nav.alightSpotsByTrack[trackIdx][doorIndex]`：公园前外侧下车落脚点，门口顺序与 doorXs 相同；只在 spanishLayout 时使用。
- `nav.pathFromAlight(doorIndex,trackIdx)`：从下车落脚点到 gateOut[0] 的完整路径，包含外侧上行扶梯。其它车站返回普通岛式站台出站路径。
- `psd.setAlightOpen(trackIdx,open01)`：外侧屏蔽门。公园前停站应先打开外侧下车门，再打开中央上车门；下车须用 train.doors 中 side=track.alightSide 的相应门。
- `setStation()` 同步更新 spanishLayout、轨道 alightSide，并切换侧式平台可见性；`setZone('platform')` 自动包含它们。

`st.setCutaway(on)` 是 demo 用的可选接口，隐藏站台顶板、站厅顶板和地面基础板，以便俯视各层；正常游戏保持 false（默认）。所有导航接口仍使用同一套坐标。

两份 demo 在高像素比设备上使用 DPR 上限 **1.5**（主页面也建议如此），iPad 尺寸 Chromium 测试比 DPR=2 更流畅。demo 可选引用 play 提供的 GZ.NPC 展示真实行走乘客；world 两个 JS 模块本身仍独立于 NPC/Audio。`train.setRoute()` 会钳制越界的 currentIdx/nextIdx，四站边界显示本站，不出现空站名。

## 第二轮补充（2026-10-06）

以下均已实现，旧方法签名保持兼容；第三轮轨道与绕柱导航坐标以本文件和 nav 为准：

- `GZ.Train.DOOR_DURATION = train.doorDuration = st.psd.duration = 1.25`：滑门/屏蔽门开或关的机械行程秒数。开度接口仍即时设置；调用方以 `dt / duration` 线性移动开度，警示广播在机械关门之前播放。
- `gate.duration = 0.6`：闸机 open/close 由 station.update 匀速执行；反向途中从当前角度继续，setOpen 仍为即时值。
- `train.getHeadPosition(dir)`：返回稳定、只读的车头本地对象 `{x:±122.85,y:3.85,z:0}`，供相机追踪与空间声源使用。转换世界坐标时考虑 train.group 位置/旋转。
- `train.headlights`：两端 `{dir,group,light,lampMaterial}`；`train.setHeadlights(dir,on)` 选择亮起端，`setRoute` 自动跟随方向，前灯暖白、后端尾灯红色。每列最多一个有效 SpotLight，无实时阴影。渐隐轨面光束不参与碰撞。
- `tunnel.setStation(station)`：更新窗外壁牌站名；同一组纹理与几何复用，默认首站。进隧道时传下一站。
- 所有文字纹理 FrontSide，标牌由两张方向相反的正面构成；被实体背板挡住的背面无文字，不会镜像。PIDS 两面分别显示对应方向。

两个 demo 新增 `worldDemo.inspect({x,y,z}, {x,y,z})` 供截图检查视角；station demo 的“列车进站”播放15秒减速进站，随后按1.25秒开门。train demo 静止时能看见真实车站，行驶时切换为有灯/电缆/站名的连续隧道。所有文字、灯箱与街景资源仍本地生成，无外链。

地面街景与地标是积木化缩约；新增农讲所黄瓦拱门、烈士陵园门楼/碑、东山红砖洋楼、公园入口，非实测建筑模型。地砖与钢材采用 Phong 高光和接缝纹理表达反光，不使用昂贵的实时镜面反射。

### 正式抓握吊环锚点

`train.strapSpots` 共48项，每节两侧各4个长吊带，环心约Y=5.662，另保留156个高吊环。每项 `{car,x,y,z,yaw,stand:{x,y,z}}`，均为车厢本地坐标。stand 为成人脚底点，yaw 为NPC朝向；play 的 `pose:'strap'` 左手与环心重合。无需再生成NPC临时吊带。长吊带在现有8.3高横杆上，未改座位、车门或walkBounds；儿童人仔不使用成人抓握锚点。

### 默认入口与出站观景点（R7）

streetSpawn=(-76,28,52)，在主流程原本face(entranceTop)的方向即可完整看到街面入口站名/英文/出口字母，以及旁边红色地铁标志。不要硬编码回旧(-81,28,40)，该点位于门厅侧边，原扶梯门楣会被转折墙遮挡。

nav.landmark / nav.landmarkView=(52,28,39)是**门厅外玩家脚底观景点**，不是建筑原点；建筑原点=(52,28,47)。nav.paths.leave已完整绕过门厅挡墙并到达此点。不要在路径后另减13个Z（会退回挡墙内部）；引导看向world地标可用{ x:nav.landmark.x, y:nav.landmark.y+5, z:nav.landmark.z+8 }。

### R8合批与可重复验收

`GZ.Station.VERSION='world-round3-8'`。扶梯不透明静态壳体按主梯/公园前外梯合并同材质绘制，实体三角形和碰撞体坐标/ID不变；动态梯级和透明栏板保留原组。不要自行平移单座escalator.group，整站应通过station.group放置。列车demo的车门与对应PSD同步开关。

完整复跑命令是`_dev/tools/qa/world-evidence.sh`（需已有localhost:8080静态服务），独立Chromium依次跑八例、真实梯级/负例/性能、四站全部场景与六向截图、双向实际进站、入口/地标横竖屏、列车与资源/网络检查，任一硬断言失败即退出非0。

只跑几何可用`_dev/tools/qa/world-validate.sh`，逐例执行四站×两方向，任一例非0即失败；输出在`shots/world/round3/validation/`。补充脚本`world-ground.js`查真实移动梯级三角形，`world-negative.js`验证三项故意制造的错误会被检出；`world-performance.js`在四站24个水平朝向/剖面与双向进站122个位置检查绘制预算。`python3 _dev/tools/qa/world-report.py`汇总原始JSON、断言验收线并保存源码SHA256，不替代play的12路线及audio自然复测。

### R9独立反例修复与动态契约

R9将站台两侧实体墙由Y12.3延伸至站厅地板，封闭外侧梯井洞口斜回望时墙顶与楼板间的真实缝隙；导航、相机、碰撞阈值与既有collider ID保持不变。当前墙顶和版本以以下R11为准。

`GZ.Station.validateReportedViews(st)` 返回 `{ok,origins:6,rays:30,probes,failures}`，用临时65°、4:3相机重放独立测试记录的6个实际出口相机位置、yaw/pitch，分别查四角及中心。每个probe保留position/direction/corner和850范围内不透明实体命中距离（未命中为null）；不修改实际玩家或相机。完整validate将失败累加到既有`counts.enclosure`，metrics增加`reportedViewOrigins=6`/`reportedViewRays=30`，不能只跑旧26方向宣称通过。

站厅黄色盲道、街面车道标线/斑马线/铺装明确为`kind:'floor'`（包括solid-4498/4499/7693），按实际几何支撑脚底；没有全局忽略低障碍，路缘、座椅、墙柱、设备和车辆仍保持其实际障碍类型。

R9的原始检查保存在`shots/world/round3/r9/`，与旧R8报告分开。重跑本批用`_dev/tools/qa/world-r9-evidence.sh`；`world-r9-contract.js`复查8站向×6实际视角、地面元数据、四辆车全部69碰撞构件的动态边界（含跨网格和回绕）。最终结论仍由play完整12自然路线及audio独立复测决定。

### R10站型楼板闭合（R11保留）

`GZ.Station.VERSION='world-round3-10'`。普通三站关闭两个未安装外侧上行扶梯的楼板/站台顶板孔，公园前仍开放真实外侧梯井。`setStation`同时切换这四块真实实体的可见性、collider.enabled和站厅`walkableRegions.holes`（公园前三处孔、普通站仅主扶梯一处孔）。楼板和顶板collider在原数组末尾追加，全部既有collider ID保持不变。地面网格/实体射线支撑由`world-r10-contract.js`验证，不能只用墙挡住天空而留无梯空井。

R10历史批可重复验收用`_dev/tools/qa/world-r10-evidence.sh`，原始JSON在`shots/world/round3/r10/`。它执行完整四站两向六类检查、6个实际视角、站型楼板实体、115地面细条、69移动车辆构件、3原负例、恢复R8实体缺口的新增视锥负例与798个绘制预算采样。`world-r10-report.py`断言所有结果，并核对检查前后station/train源码SHA256；任何生产修改使本批无效。R8/R9目录保留历史证据，不拼入当前版本。

### R11墙顶嵌入楼板（历史冻结版）

`GZ.Station.VERSION='world-round3-11'`。站台侧墙实际顶面为Y13.8，嵌入站厅楼板[13.52,14]约0.28；墙顶不再与地板上表面共面，避免站色顶面在地砖上闪烁。R10按站型补板及R9动态/地面契约全部保留，nav、碰撞阈值、旧collider ID和门位不变。

当前可重复验收用`_dev/tools/qa/world-r11-evidence.sh`，证据在`shots/world/round3/r11/`；`world-r11-contract.js`另断言两个真实墙顶距地板上表面>0.19、与楼板重叠>0.27。原8例/4负例/798绘制样本与前后生产hash检查全部重跑，不能拼入R10结果。2026-10-07 15:24完整报告通过：八例六类全0、240报告视锥射线命中、1,680补板实体支撑点通过、四种负例全检出、798绘制位置最大272；原采样/阈值不变。

`world-r11-shots.js`采四站slab正/反/斜视角、8向360°、抬头低头及6原始相机视角，共58张实际PNG。已逐张实际查看，12张slab另看全尺寸，补板/真实梯井按站型一致、共面条纹消失、没有看到新增缺口；逐图路径及SHA256见`shots/world/round3/r11/visual-review.json`。world静态回归已完成，不替代play自然12条/audio独立4条或测试员DEFECTS结论。

### 紧急性能版R13（当前冻结版，world回归完成）

`GZ.Station.VERSION` 与 `GZ.Train.VERSION` 均为 `world-round3-13`。四份生产文件的精确SHA256在`shots/world/perf/r13/source-sha256.json`；play在联合新导航批次同步刷新script查询版本。R11性能基线四站798绘制位置最高272 draw、218,402 triangles（36人）；R12候选合批后60人/DPR1.5/阴影关闭降到144/176,326，但额外支撑检查发现机身AABB覆盖实际钢级+0.205，R12已撤销最终候选，不能复用其报告。R13全部预算、八几何、负例、原图已从同一冻结源重跑通过，证据`shots/world/perf/r13/report.json`，逐阶段CSV与95图ledger同目录。

合批用RGB/钢面高光/发光/无光照标志的顶点属性保留各实体材质，文字贴图、可变主题色和灯色、透明窗仍独立。`st.renderBatch`/`train.renderBatch`提供静态合批诊断；只搬移同材质静态render mesh，原collider source group/导航/站型开孔仍保留，可见性和运动组独立。极薄装饰保留实际上下水平面；屋顶凸点仍存在，减少数量及合理细分；204吊环/公开抓握锚点不删。扶梯机身改为连续实际斜实体，保留分段public bounds用于廉价碰撞。街面车底四块原半透明阴影变低反差不透明实体，同4车69dynamic构件契约。

12扇真实旋转闸机玻璃合为1个动态InstancedMesh，原pivot/collider仍逐扇更新；10个真实TVM/闸机单程币合为1个动态InstancedMesh，原buy/insertToken动画与可见性保留。消费真实几何的显式debug工具必须支持instanceMatrix更新，不能缓存首帧实例矩阵当静态。PSD和train滑门的可动组仍独立，重复同开度不重新刷bounds；开度实际变化才刷新。

`e.sample(x,z,expectedY)`仍为固定44个当前`{x,y}`数字位置的有界查表，返回真实钢级上表面/平台/null，不读取Mesh、矩阵或三角形；没有新增`sampleFast`/`sampleFootFast`别名。play的FastField用`(e.sampleFast||e.sample)`即可，平地继续用编译floor格表，勿每帧遍历`st.sampleGround`全部floor。黄色窄标条最高比钢面+0.0375，按用户允许0.1鞋底微差保留廉价近似。R13的`st.sampleGround`在有效真实梯级范围优先返回e.sample，不再被保守机身AABB替换为更高的flat floor；该早返回不增加查询。

`validate`、`validateReportedViews`与`validateTrainClearance`均只在显式debug/QA调用；build/update不自动调用。正式默认audit关闭由play负责，不能每帧执行完整三角形闭合检查。CPU6主循环/自适应/自然12路线由play及独立测试员负责，world离线绘制预算和有界查表微测不能替代真实主循环FPS。

R13实测：3,632站体/2,560车厢真实渲染位置，60人/DPR1.5/阴影off，峰144draw/176,326tri及131draw/175,416tri；八例六类0、5,821,904真实射线、四种负例准确检出并恢复、动态12pane84bbox样本误差≤1.831e-6、十币全10实例。e.sample每1,000次CPU1 median0.1ms、CPU6 median0.5/P95 1.5ms，两次各60,000查询无射线/空支撑，钢面与sampleGround数值差异0。95真实图全部查看、23另看原尺寸；实际close17:38:15.853北京时间。上述不代表整站主循环CPU6或真实A12 Safari通过。


### R13独立密集预算补充（18:10，同源）

四站×双方向×横竖屏16例、51,120实际renderer提交点，持续60真实NPC、原生DPR2/renderer1.5/阴影off，最高146draw/176378tri，透明提交24（普通站18），所有错误0；源哈希前后/彼此/结束一致。详细阶段表`shots/world/perf/BUDGET-world.md`及`shots/world/perf/final/report.json`。比上方6192样本覆盖更多极端朝向/实际双币/35秒车辆回绕；不修改公共接口或验收阈值，不把预算计数当CPU6或真机FPS。


## R14：加载时预计算标牌，换站复用 GPU 纹理（已冻结）

2026-10-07，world-round3-14 已冻结。全新8组合/负例/6192渲染预算/95场景图+51预绘标牌图通过；完整当前证据见 shots/world/perf/r14/report.json、visual-review.json、memory.json。不引用 R13 作当前通过；联合自然路线仍由play/测试员完成。

三模块实例 `train` / `st` / `tunnel` 均有同步 `prewarmTextures(renderer) → {textureCount,milliseconds}`。create/build 已画好默认 CanvasTexture；调用方应在加载页仍显示、正式主循环启动前依次调用这三个方法（必须记录加载费用），随后保留真实灯光组合与各视角 program 预热。此方法对包含不可见状态的整个缓存逐张 `renderer.initTexture`，只初始化当前材质 map 不足以覆盖默认缓存。没有 setTimeout、没有首次到站才上传、没有 per-frame GPU 初始化。`getPanelTextures()` 可枚举缓存；`getPanelStats()` 给实际 default/fallback 数量、尺寸、画布绘制次数、RGBA/完整 mip 估算，供冷页证据与内存评估。

默认静态标牌四站共 24 张：站名/入口/地标/站台线路各4，导向为4站×2方向8；路线方向/出口/换乘文字完整。PIDS 两个独立原材质共用8张（广州东站/西塱×数字2、3、即将进站、本站停靠），两屏可同时显示不同状态。四台 TVM 的独立原材质共用5张（原两行默认屏+去四站），保留各自状态。Train 缓存真实游玩四站×两向8个 `currentIdx → clamp(currentIdx+dir)` 线路屏及2张车头方向屏；隧道站名4张。全部保留 r128 sRGB、原字体/字号/画布尺寸、Mip 过滤、正反面材质/几何、主题与所有实体。切换只选择 immutable texture，原 material 对象不换；默认状态不画 Canvas、不增加 texture.version。同一站的全部可见配置字段组成 key，相同内容立即返回；站型/地标影响的 collider 域在加载时分类并预计算 enabled 快照，门/车辆实时 bounds 与 cutaway 的契约不变。

任意自定义 PIDS 数字/字符串、TVM 文字、站名数据与 Train 非默认 nextIdx/stations 仍能同步显示：每个固定材质最多一个 mutable fallback，换新文字重画该张并上传，费用留在调用者计时里；不会为100个自定义字符串常驻100张。此路径不承诺已预载。`dispose()` 包含未显示的缓存/有界 fallback，不能仅释放当前 map。

离线 THREE r128 逻辑检查（Canvas 方法 mock，不是浏览器像素/GPU/RSS证据）得默认51 canvas/texture，46 MiB RGBA，含完整 mip 约61.33 MiB；各维度：Station37/36.5 MiB（含 TVM/PIDS），Train10/8.5 MiB，Tunnel4/1 MiB。对照 R13 动态屏尺寸/数量计算为14张/11 MiB，因此新增37张、35 MiB RGBA+35 MiB Canvas估算，GPU含 mip 新增约46.67 MiB；未减少分辨率或删除状态。真实冷页已实测：缓存51纹理46MiB；含不变静态与demo NPC的完整scene/cache共81纹理63.3125MiB RGBA，原生2D canvas观测82个（含缩至1像素的临时PIDS），加载峰64.3125MiB。三模块GPU预载共4ms；另冷页51/51 __webglTexture存在且__version===texture.version，全部真实预绘PNG已导出并逐张检查。四站两向默认Canvas/texture.version增量0，setter CPU1峰0.1ms/CPU6峰1.1ms；此为WORLD同步诊断，不代整站自然CPU6 FPS。100自定义状态仅60张并60/60dispose，全部固定材料最多13fallback/64张。R13对照是源码尺寸重建，不冒充实际R13冷页内存测试；RGBA/Mip/Canvas值均为分配估算，不是RSS/全部GPU驱动或全站内存。


2026-10-07 20:30协调人裁决生效：停止新增优化/重构，四WORLD SHA维持20:19:31清单（独立主页面冷启动同SHA确认后正式冻结），只补未完证据/未关P1。用户已确认iPad Air3目前不卡，此为用户真机反馈；WORLD browser模型测试不能替真机。全站性能线采用median≤2/P95≤5、各阶段≤3首帧尖峰≤12、CPU6阶段平均≥50。World不自行改DEFECTS最终结论，后续等联合12审计+12默认与独立4路线。
