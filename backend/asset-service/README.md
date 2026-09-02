# 素材后台服务（MVP）

这是一个不依赖第三方包的本地管理 API，用于创建 AI 素材任务和记录人工审核结果。当前故意不包含图片生成 Provider，因此不会读取 API Key，也不会自动调用外部服务。

## 启动

```bash
npm start
```

默认监听 `http://127.0.0.1:4310`。

## 接口

- `GET /health`
- `GET /admin/assets/generation-jobs`
- `POST /admin/assets/generation-jobs`
- `POST /admin/assets/generation-jobs/:id/approve`
- `POST /admin/assets/generation-jobs/:id/reject`

创建任务示例：

```json
{
  "assetId": "food-apple-red-v1",
  "assetType": "single_object",
  "promptTemplate": "singleObject",
  "promptVariables": {
    "subject": "red apple",
    "ageBand": "growth",
    "background": "transparent"
  },
  "ageBands": ["starter", "growth"],
  "gameTags": ["visual_search", "matching"]
}
```

正式接入生成 Provider 时，应由独立 Worker 消费 `queued` 任务，并写入候选文件与自动检查结果。管理 API 不应同步等待图片生成。
