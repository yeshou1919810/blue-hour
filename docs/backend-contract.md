# 前后端协作草案（尚未实现）

目标：前端管理发帖、讨论、图片预览和任务反馈；后端负责持久化、真实模型、Agent 调度、检索和识图。此文档供队友讨论，不表示这些接口已经存在。

## 业务接口建议

| 方法与路径 | 职责 |
| --- | --- |
| `GET /api/posts?category=&q=&sort=&cursor=` | 分页话题列表 |
| `POST /api/posts` | 创建主贴，返回主贴 ID |
| `GET /api/posts/:id` | 主贴与历史回帖 |
| `POST /api/uploads` | 上传图片，返回附件 ID，不接收浏览器 blob URL |
| `POST /api/posts/:id/replies` | 保存追问，包含父回帖 ID、文本和附件 ID |
| `POST /api/posts/:id/runs` | 基于已保存问题启动 Agent，返回运行 ID |
| `GET /api/runs/:id/events` | 订阅 SSE 任务与回复事件 |
| `POST /api/runs/:id/cancel` | 真正停止后端任务，而不仅关闭前端动画 |

正式版必须再共同确定身份认证、数据权限、分页、错误码、幂等键与事件重连规则。帖子原文及回帖必须以纯文本或经过清洗的 Markdown 渲染，不能直接执行模型生成的 HTML。

## 建议的数据形状

```json
{
  "id": "reply_123",
  "postId": "post_123",
  "parentReplyId": "reply_122",
  "author": { "kind": "ai", "id": "ran", "name": "阿燃", "role": "运动搭子" },
  "text": "可公开展示的回复正文",
  "attachmentIds": [],
  "sources": [],
  "createdAt": "2026-10-15T08:00:00Z",
  "status": "completed"
}
```

实际来源放入 `sources`；没有完成检索或没有可核验来源时，不展示“已检索”“依据某指南”等标签。多角色是交流设计，不能只靠多个头像就宣称已实现多 Agent 协作。

## 事件示例

```text
id: 1
event: run.started
data: {"runId":"run_123","agentId":"ran"}

id: 2
event: step.started
data: {"stepId":"context","title":"整理当前讨论"}

id: 3
event: step.completed
data: {"stepId":"context"}

id: 4
event: reply.delta
data: {"replyId":"reply_123","delta":"可以先从"}

id: 5
event: reply.completed
data: {"replyId":"reply_123","sources":[]}

id: 6
event: run.completed
data: {"runId":"run_123"}
```

其他事件：`run.failed`、`run.cancelled`、`tool.started`、`tool.completed`。使用连续事件 ID 去重与断线恢复；重试不能产生重复主贴或回帖。进度为可公开任务摘要，不返回模型内部思维链、系统提示词、密钥或敏感工具参数。

## 识图的最小流程

1. 用户选择图片，前端校验类型/大小并展示预览。
2. 用户提交后上传，后端再次验证类型、大小、文件内容和访问权限。
3. 后端进行真实识图；将可观察信息、局限与需要用户确认的字段结构化返回。
4. 前端先展示识别结果供用户确认或修正，再继续讨论。

不要从一张照片承诺准确体脂、食物重量、热量或健康诊断。原型现在只实现第 1 步。

## 比赛展示前应落实的真实能力

- 选一条完整场景落实真实模型、上下文、工具调用及可见结果。
- 有 RAG 时提供真实可核验的来源和检索结果，避免装饰性状态。
- 公开 AI 身份，按健康生活服务定位设计诊疗边界。
- 网络失败、模型失败、图片失败可重试；取消任务有真实服务端响应。
- API 密钥只在后端；前端不接收、不记录或打包密钥。
