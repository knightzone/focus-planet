# 儿童档案接口联调

核对日期：2026-09-11。以服务端项目 `/Users/kangzhou/zk/code/focus-companion-backend` 的 `app/api/routes/account.py`、`app/services/account.py`、`app/services/user_info.py`、`app/schemas.py` 及当前 OpenAPI 为准。

资料已合并到账号：读取使用 `POST /api/v1/me`，请求体 `{}`；首次完善和更新均使用 `POST /api/v1/me/update`，`Content-Type: application/json`，需要 `Authorization: Bearer <token>`。旧 `/profiles`、`/profiles/detail`、`/profiles/update` 均已移除。

```json
{
  "nickname": "星星",
  "birthYear": 2018,
  "birthMonth": 9,
  "gender": "unspecified",
  "avatarId": "focus-star",
  "timezone": "Asia/Shanghai"
}
```

- 当前服务端从登录账号定位唯一档案，不传 `profileId` 或 `userId`。
- `nickname` 字符串长度 1–48。
- `birthYear` 整数，`birthMonth` 为 1–12 的整数。
- `gender`：`male`、`female`、`unspecified`。
- `avatarId`：`blue-bunny`、`yellow-kitten`、`focus-star`；不是图片路径。
- `timezone` 字符串长度 3–64，客户端固定 `Asia/Shanghai`。
- `cameraEnabled` 可选布尔值，目前编辑档案不提交此字段。
- 更新字段均可省略；客户端编辑页提交上述完整资料。

首次完善额外提交 `guardianConsentVersion: "privacy-v1"` 和 `guardianConsented: true`；普通编辑不重写同意时间，也不重置摄像头偏好。出生年月来自宝宝档案，不发送计算后的年龄代替年月。

两接口均返回统一包装 `data`，内部为扁平账号信息，包括 `userId`、`providers`、`nickname`、`birthYear`、可空 `birthMonth`、`gender`、`avatarId`、`infoCompleted`。不再返回 `profileId`。现有本地 `ChildProfile.serverId` 暂存 `userId` 以兼容本地数据结构，不作为请求参数。

登录后以服务端资料恢复本地展示，不自动把本地旧资料覆盖到服务端；`infoCompleted: false` 时进入资料完善页。读取失败也引导完善页并提示错误。训练返回 `USER_INFO_REQUIRED` 时引导完善资料。训练、报告、陪伴 API 封装已移除旧档案 ID 参数，按当前登录账号请求。

验证：`node tests/account-api.cjs`、`node tests/offline-sync.cjs`。账号测试不发送真实短信，不写真实用户数据。

服务端参数错误的具体原因位于 `error.details.fields`，每项包含 `loc`、`msg`、`type`；`requestId` 可用于服务端查日志。客户端展示具体出错字段，不记录 Token 或完整个人资料。
