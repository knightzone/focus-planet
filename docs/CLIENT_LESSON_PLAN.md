# 客户端确定性课程与成绩接口 v1

## 1. 已确认的产品规则

- 5 个训练为 1 课，每课固定包含观察、记忆、反应、逻辑、兼顾各 1 个训练。
- `lessonNo + fixed-cycle-v1` 唯一决定本课 5 个 `gameId`、顺序和 `slotNo`，客户端不随机。
- “是否生成过”不需要单独同步。未作答时没有服务端数据也没有歧义：任意设备仍会生成同一课。
- 同一天只开启一门新课。旧课未完成时继续旧课；旧课在今天补完后，由用户点击“开启今日课程”；没有未完成课且上一课不是今天完成时，自动开启新课。
- 不是今天的待同步成绩必须先上传成功，才能开启新课。

## 2. 固定循环

五类顺序固定为：`selective`、`focused`、`sustained`、`alternating`、`divided`。

每类 6 个游戏保持目录顺序，按以下公式取题：

```text
poolIndex = (lessonNo - 1 + dimensionIndex * 2) % 6
```

因此同一 `lessonNo` 在 Android、iOS 和不同设备上都得到相同 5 题；连续 6 课可轮完每类全部 6 个游戏。协议必须同时带 `lessonAlgorithmVersion: fixed-cycle-v1`，以后若更改循环，新增版本，不能静默改变旧课。

## 3. 难度规则

生成新课时，对本课每个 `gameId` 独立读取最近成绩：

1. 没有历史：采用年龄默认难度，限制在 1–10。
2. 最近一次成绩 `>= 100`：从该次难度 `+1`，最高 10。
3. 否则，从最近一次开始向前检查；只有当前同一难度连续 3 次都 `< 50` 才 `-1`，最低 1。
4. 中间出现其他难度或任一次 `>= 50`，低分连续计数立即中断。
5. 例如难度 4 连续低分后已降到难度 3，必须在难度 3 重新连续出现 3 次 `<50` 才能再降，不能拿旧的难度 4 成绩凑数。

本课生成后难度锁定；同一课重练不会因刚提交的成绩改变本课难度，调整只作用于下一次出现该游戏的课程。

## 4. 服务端接口

服务端当前只提供两个有效训练接口，不保存课程定义，也不计算选题和难度。

### 4.1 获取最近100条训练记录

`POST /api/v1/training/records/latest`，请求 `{}`。

返回 `records[]`，按客户端完成时间倒序，最多100条。客户端根据 `lessonNo + gameId` 恢复最高课次和完成状态。

### 4.2 同步一次训练成绩

`POST /api/v1/training/records/sync`

```json
{
  "lessonNo": 18,
  "gameId": "star-catcher",
  "difficultyLevel": 4,
  "score": 112,
  "accuracy": 94,
  "averageReactionMs": 680,
  "durationSeconds": 72,
  "omissions": 1,
  "falseAlarms": 0,
  "completionCount": 18,
  "scoreAlgorithmVersion": "goal-v2",
  "clientCompletedAt": "2026-09-21T03:20:00.000Z"
}
```

- 合并键为 `userId + lessonNo + gameId`。
- 分数更高时整体替换详细指标；相同或更低分保留原记录。
- `score` 范围0–200，时间必须带时区。
- 自然键和最高分合并保证重复上传安全，不再需要lesson同步、itemId、playToken或submissionId。

## 5. 职责边界

- 固定五题、课程切换、每日门禁和难度计算完全位于客户端。
- 服务端只保存最高成绩并返回最近100条事实记录。
- 服务端随成绩保存本次实际 `difficultyLevel`。客户端直接读取最近记录中的难度计算升级或降级，不依赖本机难度缓存，也不需要反推历史难度。
- 旧 `/training/games/*`、`/training/lessons/*` 接口仍保留，但已标记 deprecated，客户端不再调用。

## 6. 客户端落地文件

- `utils/course-plan.uts`：固定循环、最近记录解析、课次恢复、当日门禁和难度计算。
- `utils/offline-sync.uts`：成绩持久化队列、断网重试和旧日未同步门禁。
- `utils/server-api.uts`：最近100条查询与单次成绩同步。
- `pages/index/index.uvue`：恢复旧课、自动新课、补完旧课后显式开启今日课程。
- `pages/result/result.uvue`：上传轻量成绩字段。
