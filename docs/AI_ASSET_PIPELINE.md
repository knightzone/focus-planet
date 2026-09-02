# AI 游戏素材生成与发布流程

## 原则

AI 只负责生成候选素材，儿童端只使用经过人工审核并随版本发布的静态资源。客户端不直接请求图片生成服务，也不展示未经审核的生成结果。

```text
游戏策划提交素材需求
  -> 后台生成任务
  -> AI 生成候选图
  -> 自动规格检查
  -> 内容安全检查
  -> 美术/产品人工审核
  -> 标注找茬热点或对象边界
  -> 压缩与多尺寸导出
  -> 发布到素材版本
  -> 客户端更新或随包内置
```

## 素材类型

- `mascot`：伙伴角色及情绪、动作变体
- `single_object`：动物、食物、文具、交通工具等独立对象
- `scene`：森林、教室、太空、海洋等游戏背景
- `spot_difference_pair`：固定差异数量的左右双图
- `sequence`：记忆与排序游戏使用的连续画面
- `reward`：星球装饰、徽章和成长物品

## 后台任务字段

```text
assetId
assetType
styleVersion
promptTemplate
promptVariables
ageBands
gameTags
generationStatus
reviewStatus
candidateFiles
approvedFile
width / height / alpha
contentSafetyResult
reviewNotes
hotspots
createdAt / reviewedAt / publishedAt
```

## 自动检查

- 文件格式、尺寸、宽高比与文件大小
- 是否真的包含透明通道，不能只生成棋盘格背景
- 单对象是否完整、是否触边或包含多余对象
- 对象包的数量是否与需求一致
- 找茬左右图的构图是否一致、差异数量是否准确
- 是否存在文字、水印、商标、可怕或不适龄内容
- 色彩对比度及小屏幕下的可辨识度

## 找茬图专用数据

找茬图不能只有图片，还要保存可点击热点：

```json
{
  "assetId": "spot-difference-space-picnic-v1",
  "differenceCount": 5,
  "hotspots": [
    { "id": "d1", "x": 0.24, "y": 0.31, "radius": 0.05 }
  ]
}
```

坐标使用 0–1 的归一化值，使同一张图能适配不同屏幕尺寸。热点必须由人工复核，不能完全相信生成模型给出的差异描述。

## 运行时目录约定

```text
static/images/drafts/     AI 候选图，不允许代码引用
static/images/runtime/    已批准并可由客户端引用
content/ai-assets/        生成任务、提示词和审核状态
```

## 第一批计划

1. 批准版太空狐狸伙伴及 4 个情绪动作。
2. 动物、食物、文具各 12 个独立对象。
3. 适合 3–6 岁的 3 组简单找不同。
4. 适合 7–9 岁的 3 组五处找茬。
5. 适合 10–12 岁的 3 组七处找茬。
6. 为森林寻宝准备 3 套背景和目标物。

## 后台实现建议

后台先采用任务队列，而不是同步等待生成：`POST /admin/assets/generation-jobs` 创建任务，Worker 调用图片生成服务，结果进入待审核状态；`POST /admin/assets/{id}/approve` 批准后才写入发布清单。所有生成提示词、模型版本、审核人和发布时间都应留痕。

项目中的 `backend/asset-service` 已实现第一阶段的任务创建、查询、批准和拒绝接口。图片生成 Worker 尚未绑定具体供应商。
