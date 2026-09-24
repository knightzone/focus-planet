# 离线训练与报告

- 每次训练先保存本地原始记录；有服务端计划项和 playToken 时，先持久化上传队列，再请求成绩接口。重复练习也提交，由服务端合并最佳成绩。
- 队列按账号隔离，重试沿用原 submissionId、计划 ID、训练项 ID、playToken 和完成时间，成功后才删除。网络失败、服务端拒绝、凭据过期均保留原始数据。
- App 启动/回到前台、登录就绪、网络恢复四类事件都会走同一个入口 `syncNow()`（先 `flushResults()` 补传，再 `refreshReports()` 刷新报告），运行期间每 30 秒重试补传。系统挂起或杀死 App 后不能保证即时联网回调，下次打开继续上传。
- 补传期间 `refreshReports()` 会主动跳过，队列清空（或中止）后自动再刷新一次，避免把补传前的旧报告写进缓存；报告页 onShow 里的 `flushResults()` → `refreshReports()` 同样是这个顺序。
- 整体报告和近两天日报从服务端获取并落盘；报告页先读缓存，再刷新。缓存有效期 48 小时，按账号隔离。缓存过期不删除本地训练记录和未上传队列。
- 服务端只支持具有计划凭据的成绩。自由练习/没有预先下载计划的离线训练仍保留本机历史，不能伪造计划或 playToken 上传；过期 token 是否接受由服务端决定。
- 服务端已将资料并入账号，计划 resolve、日报、整体报告、陪伴均不再传 profileId；资料读取/更新使用 `/me` 和 `/me/update`。本地旧记录及补传队列保持原有账号隔离方式。

回归测试：使用 Node 执行 `tests/offline-sync.cjs`（测试需要 HBuilderX 随附的 TypeScript）。覆盖断网持久化、重启恢复、账号隔离、网络恢复（含 `isConnected=false` 事件参数复核）、App 启动、登录就绪、回前台补传与报告刷新顺序、断网回前台不丢队列、30 秒轮询重建、并发去重、幂等 ID、挂起后残留上传锁释放、缓存及过期保留队列。

## iOS（App Vapor）行为

- 事件链：`App.uvue` 的 `onLaunch` 调 `initializeOfflineSync()`（注册 `focus-auth-ready`、`uni.onNetworkStatusChange`、30 秒轮询，并立即同步一次；`initialized` 守卫只防重复注册）；`onShow` 调 `resumeOfflineSync()`（重建轮询 + 立即同步），不依赖启动时那次注册。
- 回前台顺序：`resumeOfflineSync()` → `syncNow()` → 网络复核 → `flushResults()` →（队列空了或补传结束才）`refreshReports()`，保证报告读到的是补传后的数据。
- 网络判定：`uni.onNetworkStatusChange` 在各端参数一致（`isConnected: boolean` + `networkType: string`）。iOS 回前台/切网瞬间可能给出过渡性 `isConnected=false`，此时用 `uni.getNetworkType()` 复核（`networkType != 'none'` 即视为可联网）再决定是否补传；复核失败按“可能有网”处理，交给请求结果决定，避免漏传。
- 挂起恢复：iOS 挂起会暂停 JS 定时器与在途请求回调。回前台时 `resumeOfflineSync()` 会重建 30 秒轮询；在途上传锁超过 90 秒视为残留并释放，下次同步沿用原 `submissionId` 重新提交（服务端按 `Idempotency-Key` 去重），队列数据不丢。
- 原生依赖：只用到官方 `uni.getNetworkType` / `uni.onNetworkStatusChange`，对应 Swift 源码已在本仓库 iOS 打包白名单 `ios/scripts/build-extapi.sh`（`uni-getNetworkType-*.swift`、`uni-network-index.swift`）内，本次未新增任何 iOS 原生代码或编译/打包步骤。HarmonyOS 端 `uni.getNetworkType` 需要 `ohos.permission.GET_NETWORK_INFO` 权限。
- 队列结构、`submissionId` 幂等语义、账号隔离键（`focus_pending_results_<userId>`、`focus_report_<userId>_<kind>`）与报告 48 小时 TTL 均未改动。

真机验收：联网进入首页取得计划 → 飞行模式完成一项 → 报告页查看本机记录/已有缓存 → 关闭飞行模式（不切页也应自动补传）→ 检查待同步消失及日报更新。补传途中退出 App 后重新打开也应继续。iOS 额外验证：切后台超过 90 秒再回前台应继续补传并刷新报告；补传进行中切后台再回来，不能出现一直“待同步”卡住。
