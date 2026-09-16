# 专注星伴服务端接口设计（V1 讨论稿）

> 2026-09-13 计分变更：客户端切换为 `goal-v2`，分数0–200，100过关，部分游戏上限100；项目尚未上线，不做历史分制兼容。服务端成绩校验、最佳成绩比较与报告需联调适配，见 [统一计分及服务端要求](SCORING_V2.md)。不表示生产后端已部署。

> 2026-09-11 实现差异：本文保留产品讨论设计。实际后端已统一为 POST、按 Bearer Token 确定当前用户；账号资料并入 `/me` 与 `/me/update`，详见 [当前资料接口](PROFILE_API.md)。计划推进为 `/training/plans/advance`（planId 放请求体），成绩提交为 `/training/plans/items/best-result`（planId/itemId 放请求体），日报和整体报告为同名路径的 POST JSON 请求。资源异步 job 查询尚未提供。联调应以服务端源码和 OpenAPI 为准。

> 文档用途：产品、客户端与后端接口评审。  
> 更新时间：2026-09-04  
> 范围：登录注册沿用既有方案，本文件只定义登录后的训练计划、成绩、报告和资源包同步能力。

## 1. 目标与核心约定

### 1.1 本期目标

1. 服务端为用户维护唯一的“当前训练日”，每日计划固定为 5 个训练项。
2. 未完成的训练日不会因自然日期变化而丢失；用户跨天、跨设备登录后继续原进度。
3. 当前训练日全部完成后，由用户主动切换到新的训练日。
4. 每个训练项允许重复提交，但服务端只保留最佳成绩。
5. 支持单日/多日报告、近 7 天、近 30 天、全量和相邻阶段对比。
6. 客户端内置最小可玩资源；服务端支持异步补全、断点续传、校验和降级运行。

### 1.2 术语

- **自然日（calendar day）**：按用户资料中的 IANA 时区计算，例如 `Asia/Shanghai`。
- **训练日（training plan）**：包含 5 个训练项的服务端对象。训练日可以跨多个自然日完成。
- **训练项（plan item）**：当天 5 道题中的一道；在当前产品中通常对应一次小游戏训练。
- **当前训练日（active plan）**：用户当前看到且需要继续/确认切换的训练日。每个用户最多一个。
- **最佳成绩（best result）**：某个训练项历次有效提交中排名最高的一次结果。
- **整体难度**：训练日级别的 `difficultyLevel`，取值 1–10。创建计划时冻结，计划中途不变化。
- **阶段（stage）**：用于报告对比的连续已完成训练日分组，V1 默认每 5 个已完成训练日为一个阶段，不等同于自然周。

### 1.3 服务端为准

- 计划内容、计划完成状态、整体难度和最佳成绩均以服务端为最终事实来源。
- 多端同时提交时不采用“最后写入覆盖”，而采用“最佳成绩合并”。
- 已创建的训练日内容必须冻结。资源包、题库或算法升级只影响后续新训练日。
- 所有时间保存为 UTC ISO 8601；训练日日期使用用户时区生成的 `YYYY-MM-DD`。
- 当前客户端的 5 个维度 ID 保持稳定：`focused`、`sustained`、`selective`、`alternating`、`divided`。
- 游戏 ID 直接沿用客户端 `utils/catalog.uts` 中的稳定字符串。

## 2. 推荐业务状态机

```text
首次进入
  -> 创建今天的训练日（5 项）
  -> IN_PROGRESS
       -> 提交任一训练项：更新该项最佳成绩
       -> 5 项均至少有一次有效成绩：COMPLETED
  -> COMPLETED
       -> 用户主动“进入新训练日”
       -> 创建新计划并成为新的 IN_PROGRESS
```

### 2.1 跨天续做规则

假设用户在 9 月 1 日只完成 2/5：

- 9 月 2 日、9 月 5 日或更晚再次打开，仍返回 9 月 1 日计划和 2/5 进度。
- 补完剩余 3 项后，该计划变为 `COMPLETED`。
- 服务端返回 `canAdvance=true`，客户端展示“进入新的训练日”。
- 用户确认后，新训练日日期取 `max(用户当前自然日, 旧计划日期 + 1 天)`；不会补发中间错过的所有日期。

### 2.2 同一天重复开新计划

V1 建议默认关闭：一个自然日最多新建一个训练日。若当天创建并完成计划，返回：

```json
{
  "canAdvance": false,
  "nextAvailableDate": "2026-09-05"
}
```

后台保留产品开关 `allowSameCalendarDayAdvance`，以后若开放加练，可在不改客户端协议的情况下启用。

### 2.3 难度更新

- 用户资料中保存一个整体难度状态，而不是由各设备分别计算。
- 创建训练日时将当前难度写入计划快照，5 项全部使用同一难度级别。
- 计划完成后根据该训练日的 5 项最佳成绩计算 `nextDifficultyLevel`。
- 旧计划补做期间即使算法升级，也不得修改该计划已冻结的难度。
- 需要保存 `difficultyAlgorithmVersion`，便于报告解释和后续重算。

## 3. 通用协议

### 3.1 基础约定

- Base URL：`/api/v1`
- 鉴权：复用现有登录设计，示例使用 `Authorization: Bearer <token>`。
- 数据格式：`application/json; charset=utf-8`
- ID：UUID/ULID，服务端生成；客户端不得使用日期或游戏 ID 充当主键。
- 写接口均接收 `Idempotency-Key`，同一个业务操作重试必须复用相同值。
- 金额不在本期接口范围；新版 `goal-v2` 分数使用整数 `0–200`，accuracy仍为 `0–100`。
- 列表接口使用游标分页；日报日期区间 V1 限制最多 90 天。

### 3.2 统一响应

成功：

```json
{
  "requestId": "req_01J...",
  "data": {}
}
```

失败：

```json
{
  "requestId": "req_01J...",
  "error": {
    "code": "PLAN_NOT_COMPLETED",
    "message": "当前训练日尚未完成",
    "details": {}
  }
}
```

### 3.3 建议错误码

| HTTP | code | 说明 |
|---|---|---|
| 400 | `INVALID_ARGUMENT` | 字段、日期区间或指标不合法 |
| 401 | `UNAUTHORIZED` | 登录态无效 |
| 404 | `PLAN_NOT_FOUND` | 计划不存在或不属于当前用户 |
| 409 | `PLAN_NOT_COMPLETED` | 未完成却请求切换训练日 |
| 409 | `PLAN_ALREADY_ADVANCED` | 该完成计划已经切换过；响应中返回现计划 |
| 409 | `ADVANCE_NOT_AVAILABLE` | 同一自然日不可再次创建计划 |
| 409 | `PLAN_REVISION_CONFLICT` | 客户端计划版本过旧，需要刷新 |
| 422 | `RESULT_NOT_VALID` | 成绩字段或签名校验失败 |
| 426 | `APP_VERSION_UNSUPPORTED` | 客户端版本不再兼容题目/资源协议 |
| 503 | `RESOURCE_PREPARING` | 资源暂未就绪，但应同时返回可用降级方案 |

## 4. 核心数据结构

### 4.1 TrainingPlan

```json
{
  "planId": "plan_01J...",
  "planDate": "2026-09-01",
  "sequenceNo": 18,
  "status": "IN_PROGRESS",
  "revision": 4,
  "difficultyLevel": 4,
  "difficultyAlgorithmVersion": "daily-v1",
  "completedCount": 2,
  "totalCount": 5,
  "createdAt": "2026-09-01T00:12:20Z",
  "completedAt": null,
  "canAdvance": false,
  "nextAvailableDate": null,
  "items": []
}
```

`status`：`IN_PROGRESS | COMPLETED | SUPERSEDED`。`SUPERSEDED` 只表示用户已从完成计划切换，不用于未完成计划。

### 4.2 TrainingPlanItem

```json
{
  "itemId": "item_01J...",
  "order": 1,
  "role": "warmup",
  "gameId": "star-catcher",
  "dimensionId": "focused",
  "difficultyLevel": 4,
  "questionInstanceId": "qinst_01J...",
  "contentVersion": "star-catcher-2026.09.1",
  "seed": "730410923",
  "status": "COMPLETED",
  "resourceRequirements": [
    { "packageId": "core-gameplay", "minVersion": 3 }
  ],
  "playToken": "short-lived-signed-token",
  "bestResult": null
}
```

`role` 建议支持 `warmup | core | reinforce | challenge | cooldown`，但 V1 不要求前端按角色做特殊逻辑。

### 4.3 TrainingResult

字段兼容当前客户端 `TrainingRecord`，并增加服务端同步字段：

```json
{
  "resultId": "result_01J...",
  "submissionId": "device-generated-uuid",
  "planId": "plan_01J...",
  "itemId": "item_01J...",
  "gameId": "star-catcher",
  "dimensionId": "focused",
  "score": 88,
  "difficultyLevel": 4,
  "accuracy": 92,
  "averageReactionMs": 710,
  "durationSeconds": 65,
  "omissions": 1,
  "falseAlarms": 0,
  "switchErrors": 0,
  "interferenceErrors": 0,
  "completedCount": 18,
  "totalCount": 20,
  "scoreAlgorithmVersion": "goal-v2",
  "clientCompletedAt": "2026-09-04T03:15:26Z",
  "serverReceivedAt": "2026-09-04T03:15:29Z"
}
```

## 5. 接口一览

| 方法 | 路径 | 用途 |
|---|---|---|
| POST | `/training/plans/resolve` | 获取或创建用户当前训练日 |
| POST | `/training/plans/{planId}/advance` | 完成后主动切换到新训练日 |
| PUT | `/training/plans/{planId}/items/{itemId}/best-result` | 提交单项成绩并做最佳成绩合并 |
| GET | `/reports/daily?from=&to=` | 查询单日或多日明细及上一次同题成绩 |
| GET | `/reports/overview?asOf=` | 查询整体、近 7/30 天和阶段提升 |
| POST | `/resources/reconcile` | 上报设备资源并获取补全方案 |
| GET | `/resources/jobs/{jobId}` | 查询异步资源准备状态 |
| POST | `/resources/installations/confirm` | 校验后确认设备已安装资源包 |

## 6. 每日训练接口

### 6.1 获取/创建当前训练日

`POST /api/v1/training/plans/resolve`

请求：

```json
{
  "timezone": "Asia/Shanghai",
  "device": {
    "deviceId": "device_01J...",
    "platform": "android",
    "appVersion": "1.0.0",
    "resourceManifestVersion": 7,
    "installedPackages": [
      { "packageId": "bootstrap", "version": 1 },
      { "packageId": "core-gameplay", "version": 3 }
    ]
  }
}
```

处理规则：

1. 存在未完成计划：无论计划日期多早，都返回该计划。
2. 当前计划已完成但尚未主动切换：仍返回已完成计划，同时给出 `canAdvance`。
3. 用户从未创建计划：事务内创建今天计划并返回。
4. 多端同时首次调用：数据库唯一约束保证只创建一份计划。
5. 生成计划时只选择该设备可运行的内容；资源不足时允许重复题库，但不得下发无法启动的题。

响应：

```json
{
  "requestId": "req_01J...",
  "data": {
    "serverNow": "2026-09-04T03:00:00Z",
    "userLocalDate": "2026-09-04",
    "plan": {
      "planId": "plan_01J...",
      "planDate": "2026-09-01",
      "sequenceNo": 18,
      "status": "IN_PROGRESS",
      "revision": 4,
      "difficultyLevel": 4,
      "completedCount": 2,
      "totalCount": 5,
      "canAdvance": false,
      "items": []
    },
    "resourceSync": {
      "state": "UP_TO_DATE",
      "jobId": null
    }
  }
}
```

### 6.2 主动切换新训练日

`POST /api/v1/training/plans/{planId}/advance`

请求：

```json
{
  "expectedRevision": 7,
  "timezone": "Asia/Shanghai",
  "deviceId": "device_01J...",
  "resourceManifestVersion": 7
}
```

前置条件：

- 旧计划 5 项均至少存在一份有效成绩。
- 到达允许创建新计划的自然日，或后台已开启同日加练。
- 操作必须在数据库事务中完成：锁定旧计划、标记 `SUPERSEDED`、创建新计划、更新用户当前计划指针。

成功返回新计划。重复请求返回同一新计划，不重复创建。

## 7. 单项成绩提交

### 7.1 提交并覆盖最佳成绩

`PUT /api/v1/training/plans/{planId}/items/{itemId}/best-result`

Header：

```text
Idempotency-Key: 2bb4d876-...
```

请求：

```json
{
  "submissionId": "2bb4d876-...",
  "playToken": "token-from-plan-item",
  "planRevision": 4,
  "score": 88,
  "accuracy": 92,
  "averageReactionMs": 710,
  "durationSeconds": 65,
  "omissions": 1,
  "falseAlarms": 0,
  "switchErrors": 0,
  "interferenceErrors": 0,
  "completedCount": 18,
  "totalCount": 20,
  "scoreAlgorithmVersion": "goal-v2",
  "clientCompletedAt": "2026-09-04T03:15:26Z",
  "deviceId": "device_01J..."
}
```

响应：

```json
{
  "requestId": "req_01J...",
  "data": {
    "accepted": true,
    "acceptedAsBest": true,
    "previousBestScore": 81,
    "bestResult": {},
    "plan": {
      "status": "IN_PROGRESS",
      "revision": 5,
      "completedCount": 3,
      "totalCount": 5,
      "canAdvance": false
    }
  }
}
```

最佳成绩合并规则：

1. 首次有效提交直接成为最佳成绩，并将该项标记为 `COMPLETED`。
2. 后续 `score` 更高才整体替换最佳成绩及其全部指标。
3. 分数相同默认保留较早记录，避免设备重复同步造成结果抖动。
4. 较低成绩也返回 HTTP 200 和 `acceptedAsBest=false`，不能作为错误重试。
5. 一个训练项只能保存一条业务最佳记录；如因风控需要保留提交审计日志，应设置较短保存周期并与报告表隔离。
6. 服务端校验 `playToken` 内的用户、计划、训练项、游戏、难度及内容版本，不能信任客户端传入的这些身份字段。
7. 客户端离线时保留提交队列；恢复网络后使用原 `submissionId` 重试。多设备冲突仍按最高分合并。

> V1 以综合分 `score` 为唯一胜负依据。以后如需按正确率、耗时复合排序，必须新增明确的 `bestRuleVersion`，不能静默改变旧数据。

## 8. 报告接口

### 8.1 单日/多日报告

`GET /api/v1/reports/daily?from=2026-09-01&to=2026-09-07&timezone=Asia%2FShanghai`

- `from`、`to` 均为用户训练日日期，包含首尾。
- 一次最多 90 天。
- 返回计划中 5 项及最佳成绩；尚未完成的项目也必须返回。
- `previousSameGame` 指该用户在本计划之前最近一次出现相同 `gameId` 的最佳成绩，不要求是相邻自然日。
- 难度不同时仍返回，但 `strictlyComparable=false`，前端不宜直接展示“提升/下降”。

响应示例：

```json
{
  "requestId": "req_01J...",
  "data": {
    "days": [
      {
        "planId": "plan_01J...",
        "planDate": "2026-09-01",
        "status": "COMPLETED",
        "difficultyLevel": 4,
        "completedCount": 5,
        "totalCount": 5,
        "summary": {
          "averageScore": 84,
          "averageAccuracy": 89,
          "totalDurationSeconds": 410
        },
        "items": [
          {
            "itemId": "item_01J...",
            "order": 1,
            "gameId": "star-catcher",
            "dimensionId": "focused",
            "bestResult": {
              "score": 88,
              "accuracy": 92,
              "averageReactionMs": 710
            },
            "previousSameGame": {
              "planDate": "2026-08-27",
              "difficultyLevel": 4,
              "score": 82,
              "scoreDelta": 6,
              "strictlyComparable": true
            }
          }
        ]
      }
    ]
  }
}
```

### 8.2 整体报告

`GET /api/v1/reports/overview?asOf=2026-09-04&timezone=Asia%2FShanghai`

响应建议包含：

```json
{
  "requestId": "req_01J...",
  "data": {
    "asOf": "2026-09-04",
    "allTime": {
      "completedPlans": 26,
      "completedItems": 130,
      "averageScore": 81,
      "trainingDurationSeconds": 10920,
      "activeDays": 31,
      "currentStreak": 4
    },
    "periods": {
      "last7Days": {
        "current": { "averageScore": 84, "completedItems": 18 },
        "previous": { "averageScore": 80, "completedItems": 15 },
        "change": { "absolute": 4, "relativePercent": 5.0 }
      },
      "last30Days": {
        "current": { "averageScore": 82, "completedItems": 72 },
        "previous": { "averageScore": 78, "completedItems": 60 },
        "change": { "absolute": 4, "relativePercent": 5.1 }
      }
    },
    "dimensions": [
      {
        "dimensionId": "focused",
        "currentScore": 86,
        "previousScore": 81,
        "change": 5,
        "sampleCount": 22
      }
    ],
    "stageComparison": {
      "stageSize": 5,
      "current": {
        "fromSequenceNo": 21,
        "toSequenceNo": 25,
        "averageScore": 84
      },
      "previous": {
        "fromSequenceNo": 16,
        "toSequenceNo": 20,
        "averageScore": 79
      },
      "absoluteChange": 5,
      "relativePercent": 6.3,
      "comparable": true
    },
    "dailyTrend": [
      { "date": "2026-09-01", "averageScore": 83, "completedItems": 5 }
    ],
    "disclaimer": "训练数据用于展示个人练习趋势，不构成医学或能力诊断。"
  }
}
```

统计口径：

- 近 7/30 天按自然日期窗口查询，但只使用各训练项的最佳成绩。
- “上一周期”分别为前 7 天、前 30 天，不与当前窗口重叠。
- `absolute = current - previous`；相对提升率为 `absolute / previous × 100%`。
- 上一周期无样本时，变化字段返回 `null`，不能返回 0%。
- 维度均分按训练项聚合，每个训练项只计入一个主维度。
- 两个阶段均完整且算法版本可比时，`comparable=true`；否则只展示数据，不生成提升文案。
- 报告必须返回样本量，避免把一次偶然成绩包装成稳定提升。

## 9. 资源包异步补全

### 9.1 设计原则

1. 安装包必须内置 `bootstrap` 最小资源集，断网也能完成若干训练。
2. 资源不足不是阻断登录或训练的错误；服务端只能从已安装能力中生成可玩计划。
3. 资源同步按设备管理，同一账户的不同手机可能拥有不同资源版本。
4. 当前未完成计划引用的资源不可被清理；新资源只影响未来创建的计划。
5. 资源文件使用 CDN，支持 HTTP Range、SHA-256 校验、临时下载地址和原子安装。
6. 下载失败保留旧资源，客户端不得先删除可用版本。

### 9.2 对账并请求补全

`POST /api/v1/resources/reconcile`

```json
{
  "deviceId": "device_01J...",
  "platform": "android",
  "appVersion": "1.0.0",
  "manifestVersion": 7,
  "installedPackages": [
    {
      "packageId": "bootstrap",
      "version": 1,
      "sha256": "..."
    }
  ],
  "freeDiskBytes": 12884901888,
  "network": "wifi"
}
```

资源已准备好时：

```json
{
  "requestId": "req_01J...",
  "data": {
    "state": "DOWNLOAD_READY",
    "manifestVersion": 8,
    "playableNow": true,
    "catalogCoverage": {
      "availableGameCount": 6,
      "totalGameCount": 20,
      "mayRepeatSoon": true
    },
    "packages": [
      {
        "packageId": "visual-core-1",
        "version": 2,
        "required": true,
        "priority": 100,
        "sizeBytes": 24576000,
        "sha256": "...",
        "downloadUrl": "https://cdn.example.com/signed/...",
        "urlExpiresAt": "2026-09-04T05:00:00Z",
        "minAppVersion": "1.0.0"
      }
    ]
  }
}
```

后台尚在组装/生成资源时：

```json
{
  "requestId": "req_01J...",
  "data": {
    "state": "PREPARING",
    "playableNow": true,
    "jobId": "rjob_01J...",
    "retryAfterSeconds": 30,
    "fallback": {
      "manifestVersion": 7,
      "availableGameIds": ["star-catcher", "shape-match"]
    }
  }
}
```

### 9.3 查询异步任务

`GET /api/v1/resources/jobs/{jobId}`

状态：`QUEUED | PREPARING | READY | FAILED | EXPIRED`。

```json
{
  "requestId": "req_01J...",
  "data": {
    "jobId": "rjob_01J...",
    "status": "READY",
    "progressPercent": 100,
    "retryAfterSeconds": null,
    "packages": []
  }
}
```

客户端轮询建议：前台 5、15、30、60 秒退避；进入后台后交给系统后台下载任务，不持续唤醒应用。

### 9.4 安装确认

`POST /api/v1/resources/installations/confirm`

客户端必须在下载完成、解压到临时目录并通过 SHA-256/文件清单校验后再调用：

```json
{
  "deviceId": "device_01J...",
  "manifestVersion": 8,
  "packages": [
    { "packageId": "visual-core-1", "version": 2, "sha256": "..." }
  ],
  "installedAt": "2026-09-04T03:28:00Z"
}
```

服务端随后可以为“下一训练日”扩展题库。当前计划不得因该确认发生替换。

### 9.5 客户端补全流程

```text
启动应用
  -> 使用内置 bootstrap 资源立即可玩
  -> 后台调用 resources/reconcile
     -> UP_TO_DATE：结束
     -> DOWNLOAD_READY：按优先级断点下载
     -> PREPARING：低频轮询 job
  -> 下载到临时目录
  -> 校验大小、SHA-256、manifest 签名
  -> 原子移动到正式目录
  -> installations/confirm
  -> 下一个新训练日扩大可选题库
```

## 10. 建议数据表

| 表 | 核心字段/约束 |
|---|---|
| `user_training_state` | `user_id` 唯一、当前计划、整体难度、难度算法版本、时区 |
| `training_plan` | 用户、计划日期、序号、状态、难度快照、revision；用户只能有一个当前计划 |
| `training_plan_item` | 计划、顺序 1–5、游戏、维度、题目实例、内容版本、资源要求 |
| `training_best_result` | `item_id` 唯一，保存最佳结果和算法版本 |
| `idempotency_record` | 用户、接口、key 唯一，保存请求摘要和响应 |
| `game_content_version` | 游戏版本、配置、可用状态、资源依赖、兼容 App 版本 |
| `resource_package` | 平台、版本、大小、SHA-256、文件清单、CDN 对象键 |
| `device_resource_state` | 用户、设备、已安装 manifest 和包版本、最后上报时间 |
| `resource_prepare_job` | 任务状态、进度、重试信息、产物版本、错误码 |

数据库约束至少保证：

- 每个计划恰好 5 个不同 `itemId`，顺序唯一。
- `training_best_result.item_id` 唯一。
- 同一用户同一 `sequenceNo` 唯一。
- 同一已完成计划只能成功 advance 一次。
- 同一用户、接口和 `Idempotency-Key` 唯一。

## 11. 并发与一致性

### 11.1 多端成绩竞争

在数据库中使用条件更新，而不是先查再写：

```sql
UPDATE training_best_result
SET score = :score, ...
WHERE item_id = :item_id AND score < :score;
```

首次插入和条件更新需要放入事务；提交后重新读取当前最佳结果返回客户端。

### 11.2 完成计划

- 每次首次完成训练项后，事务内更新计划 `completed_count`。
- 当计数达到 5 时计算计划摘要、下一难度并将状态改为 `COMPLETED`。
- 不要依赖客户端单独调用“完成训练日”接口，避免客户端退出造成状态悬空。

### 11.3 缓存

- 当前计划可短缓存，但成绩提交后必须主动失效。
- 报告缓存键需要包含用户、日期、计划 revision/聚合版本。
- 报告允许最终一致；当前计划与最佳成绩必须强一致。

## 12. 隐私、风控与可观测性

- 不在题目、成绩或日志中保存儿童真实姓名；只使用内部用户/档案 ID。
- 日志不得记录完整 access token、playToken 或带签名的 CDN URL。
- 成绩接口限制频率，并校验合理耗时、题目 token 和内容版本。
- 所有修改记录 `requestId`、用户、设备、服务端时间和算法版本，便于排查跨端同步。
- 资源任务失败要区分网络、空间不足、校验失败、版本不兼容和服务端产物失败。
- 报告文案坚持“训练表现/趋势”，不输出医学、智力或诊断性结论。

## 13. 当前客户端迁移映射

当前工程与服务端 V1 的主要差异：

| 当前客户端 | 服务端 V1 |
|---|---|
| 本地生成每日 3 项 | 服务端冻结每日 5 项 |
| 本机按游戏维护难度 | 用户级整体难度，按训练日冻结 |
| 每次结果均写本地历史 | 每个训练项只保留最佳成绩 |
| 当天本地记录决定完成状态 | 服务端计划项状态决定进度 |
| 报告基于本机全部记录 | 报告统一由服务端最佳成绩聚合 |

字段映射：

| 当前 `TrainingRecord` | 接口字段 |
|---|---|
| `averageReaction` | `averageReactionMs` |
| `completedAt` | `clientCompletedAt` |
| `difficultyLevel` | 由服务端计划项给出，客户端不得自行提升后回传 |
| `id` | 迁移阶段可作为 `submissionId`，正式版使用 UUID |

迁移建议：

1. 第一阶段只接入计划 resolve 和成绩提交，本地存储继续作为离线队列与缓存。
2. 第二阶段接入日报、整体报告，逐步停止客户端自行聚合。
3. 第三阶段接入资源对账和后台下载。
4. 历史本地成绩如需导入，应使用单独的 legacy import 接口，并标记 `source=LEGACY_LOCAL`；不要把它们伪装成服务端计划完成记录。

## 14. 后端评审待确认项

以下项目需要产品、后端、客户端在开发前确认：

1. 同一自然日是否永远只允许一个训练日，还是允许“加练”。
2. 当前客户端已采用平均100分过关升级，连续低分降级仍保留；服务端应对齐 `goal-v2`，见 SCORING_V2.md。
3. “阶段”是否固定为 5 个已完成训练日，还是由测评周期/课程包定义。
4. 最佳成绩是否永久仅按 `score` 比较；同分是否需要以准确率或耗时决胜。
5. 报告的近 7/30 天按自然日还是最近 7/30 个训练日；本文默认自然日。
6. 资源包是全量预构建，还是存在按用户动态生成的产物；两者可共用当前 job 协议。
7. 资源 CDN、签名服务、最大包体、移动网络下载策略和本地空间下限。
8. 儿童档案与账号是一对一还是一对多；若一对多，所有接口路径需增加 `profileId`，训练状态必须按档案隔离。

其中第 8 项会直接影响所有表的唯一约束，建议最先确定。
