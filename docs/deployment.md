# GitHub Pages 部署

目标仓库：`yeshou1919810/blue-hour`。

在线访问：[蓝调补给站](https://yeshou1919810.github.io/blue-hour/)。无需启动本机服务。

网页内容位于 `dist/`，无需安装依赖或构建。`.github/workflows/pages.yml` 会在推送到 `main` 后检查 JavaScript 语法，再上传并部署 `dist/`。也可以在 GitHub 的 Actions 页面手动运行工作流。

首次配置：仓库 Settings → Pages → Build and deployment → Source 选择 **GitHub Actions**。工作流成功完成后，部署任务中的链接即为实际访问地址。

页面使用相对资源地址与 `#/community` 等哈希路由，适用于 GitHub Pages 的仓库子路径；刷新帖子详情不会要求服务器处理额外路由。

## 后续更新

在项目目录中执行：

```powershell
npm run check
git status
git add dist README.md docs .github package.json server.mjs scripts .gitignore
git commit -m "Update Blue Hour website"
git push origin main
```

检查并确认暂存内容后再提交。不要提交 `.env`、密钥、`.qa` 浏览器数据或本地日志，这些文件已通过 `.gitignore` 排除。

发布后可使用独立测试浏览器检查线上版本（依赖要求见 README）：

```powershell
node scripts/qa.mjs https://yeshou1919810.github.io/blue-hour/
```

## 在线版范围

GitHub Pages 提供静态网页托管。现有搜索、筛选、发帖、收藏、清单、图片本地预览和模拟 AI 回复在浏览器中运行，不依赖本机 Node 服务。

数据仍保存在各自浏览器，线上网址与本地预览的数据互相独立；不同用户之间不会同步帖子。真实模型、识图、登录和共享数据需后续接入独立后端。

部署方式参考 [GitHub Pages 官方工作流说明](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages)。
