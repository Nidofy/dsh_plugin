# UI-v1 技术适配记录

冻结依据：AV-UI-20261022；审阅基线 2cab99a / 0.6.1。本轮版本 0.6.2，世界仍 schema6，偏好 schema2，frame protocol3。没有重开产品选择。

- M0：工作区与审阅 HEAD 相同；原有 NEXT_FEATURES_2026-10-21.md 未改动。不切分支、不重置、不自动提交或推送。
- M1：原 Floating 单体拆成 HUD、管理抽屉、设置、消息、布置托盘；presentation reducer 与 runtime 世界分离。旧命令接入四主入口，单一 Scene 生命周期保留。
- M2：真实背景与全部可交互对象共用投影。原背景 texture 槽缓存边缘 alpha，只有投影/模式变化才重算；额外一张 256×256 氛围纹理按四个外侧区域绘制，避免在真实世界下面重复填充。纹理区域共用同一 GPU source，卸载统一释放。人物/家具不会被边缘模糊。
- M3：七张头像来自批准的 PaperDoll 中性层级离线合成；六张家具缩略来自原 PNG 和正式 NeighborhoodArt renderer，不使用布局稿像素或演示数据。新增资产由资源生成器逐文件校验 SHA256 并接 Host 白名单。
- M4：消息仅从已确认快照派生；初次偏好升级静默标读旧事实。沿原 SaveStore 的迁移保护与 CAS；偏好用户意图串行合并，不写世界。
- M5：Home 与挂饰保持原事务，不能同时编辑；拖动只发 down/up/cancel，pointermove 只更新 iframe ghost。有效 drop 一步 undo；unknown/pending 不丢 candidate。显式关闭脏草稿确认，隐藏保留。
- M6：照片使用同一 renderer 的一次性 720×960 构图；预览内框与导出内容尺寸一致，异常路径恢复矩阵并销毁 RenderTexture。观察相机不入照片。
- M7：旧浏览器测试只更新导航与与冻结模式相冲突的旧入口断言；原业务/冷恢复/所有权/资源断言保留。性能采样用同一设备、Chromium、SwiftShader、DPR、人数、场景 CSS 视口。基线仅在测试夹具覆盖旧 3:4 外壳，使实际 iframe 尺寸相同；不比较不同画布面积。

性能调试期间发现每帧背景 alpha mask 及全画布氛围重复绘制造成软件渲染开销，已经改成按投影缓存和只画世界外侧。按冻结规范 §4.1，软件 renderer 使用实色面板回退，保留用户原透明偏好；正常 GPU 仍保留 blur 与用户开关。中间性能样本不作为最终 PASS 证据。

布局稿 HTML 的内置浏览器访问被 file: 协议安全限制拒绝；未使用服务器、另一浏览器或其他方式绕过。HTML 浏览器标定仍 NOT RUN，不能用本轮运行图代替该项。

所有运行测试使用 synthetic 临时 profile；未安装日常 profile、未调用模型、未发布。真实 Windows 缩放/IME/睡眠/GPU 和一小时验收分别保留 NOT RUN / DEFERRED。
