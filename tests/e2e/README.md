# 端到端测试（Playwright，无头 Chromium）

模拟 iPad：1112×834、触屏、DPR 2。先在仓库根目录 `python3 -m http.server 8123`，再：

```bash
pip install playwright && playwright install chromium
python3 tests/e2e/smoke.py    'http://localhost:8123/?q=1'   # 能启动、无报错
python3 tests/e2e/controls.py 'http://localhost:8123/?q=2'   # 摇杆、拖动转头、捏合、跳、视角、键盘、碰撞
python3 tests/e2e/journey.py  'http://localhost:8123/?q=3'   # 完整旅程：进站→安检→售票机买单程票→刷票过闸机→站台→1 号线坐 2 站→坐回→换乘 2 号线坐 1 站
python3 tests/e2e/ticket.py   'http://localhost:8123/?q=2' <截图目录>   # 没票刷不开闸机 → 买票（选站/投币/出票）→ 刷票进站 → 出站回收单程票 → 羊城通；PART=tvm 只跑售票机面板
python3 tests/e2e/seat.py     'http://localhost:8123/?q=2' <截图目录>   # 车厢里坐下：髋部在座垫上、第一人称眼高降低、开车/到站一直坐着、起身
python3 tests/e2e/ticket_ui.py 'http://localhost:8123/?q=2' <截图目录> [w h] [后缀]   # 售票 UI 小修快速检查（不走完整流程）：提示箭头指向售票机、选中站青绿色、“出票成功”、羊城通说明不断行；ONLY=hint / ONLY=card 只跑一部分
python3 tests/e2e/routemap.py 'http://localhost:8123/?q=2&start=gyq&line=1' <截图目录>   # 车厢门上条形线路图 + 过道 LCD：停站高亮本站 / “到站”，开出后高亮下一站 / “下一站”，贴图只在换站时重画一次
python3 tests/e2e/netmap.py   'http://localhost:8123/?q=2' <截图目录> [w h]   # HUD「地图」按钮 → 全屏全网图（39 个车站、线路色、你在这里）→ 关闭；右上角三个按钮一排不重叠；横屏再看站厅西墙大幅线路图（CLOSE=1 加一张近景）
python3 tests/e2e/drawcalls.py 'http://localhost:8123/' 1   # 几个固定机位的绘制调用数（街面 / 站厅 / 站台 / 车厢）
python3 tests/e2e/shots.py    'http://localhost:8123/'       # 截图（含竖屏 834×1112）
python3 tests/e2e/polish_shots.py 'http://localhost:8123/' /workspace/gz-shots-polish/after 1   # 视觉升级对比截图（12 个场景 + HUD 特写），并打印每张的绘制调用数
```

测试通过 `window.__game`（见 `js/main.js`）读取状态、设置虚拟摇杆和自动走路；`__game.setDtMax(0.25)` 放宽单帧步长上限（默认 0.05 秒），软件渲染 4 fps 时游戏时间也接近墙钟，等车不会慢 5 倍；触屏操作用 CDP 触摸事件真实模拟。
软件渲染下帧率只有个位数到二十几，不代表 iPad 上的表现。截图默认写到 `/workspace/gz-shots-3d/`，可传第二个参数修改。
