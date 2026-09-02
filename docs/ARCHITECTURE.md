# MVP 技术结构

## 领域结构

```text
ChildProfile
  -> AgeBand
  -> DailyPlan
  -> TrainingGame
  -> TrainingRecord
  -> DimensionReport
```

每个游戏只能有一个主要维度，可以附加次要维度。成长分数只计入主要维度，避免同一局训练被重复计算。

## 当前本地数据

- `focus_planet_profile`：儿童昵称、年龄与创建时间
- `focus_planet_records`：游戏、维度、分数、正确率、反应时间与完成时间

正式版应为本地记录增加 schema 版本，并在登录后与服务端进行增量同步。

## 游戏扩展约定

新增游戏时：

1. 在 `utils/catalog.uts` 增加游戏元数据。
2. 在 `pages/game/` 增加对应页面或复用通用游戏引擎。
3. 训练结束统一写入 `TrainingRecord`。
4. 报告页只通过 `dimensionId` 聚合，不依赖具体游戏实现。

## 评分原则

MVP 只保存原始指标和演示分数。正式版需保留正确率、遗漏、误触、反应时间及其离散程度，再基于同年龄段和个人基线生成成长反馈。不要把游戏分数包装为医学或智力结论。
