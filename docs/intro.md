# 蓝色退潮开场

参考 [P3R 官方网站](https://p3re.jp/en/) 的退潮、白底文案和主视觉揭幕结构，使用本项目品牌文字与原创 SVG；没有使用或热链游戏视频、人物、Logo 或音乐。

## 预览与播放规则

- 在线重播：<https://yeshou1919810.github.io/blue-hour/?intro=1>
- 本地：启动 `npm run dev` 后打开 <http://127.0.0.1:4173/?intro=1>。
- 普通首页在同一标签页会话内播放一次。内部切页、重新渲染和返回首页不会重播。直接进入帖子等深链接也不播放。
- `?intro=1` 强制在每次文档加载时重播，但不会绕过系统“减少动态效果”设置；去掉参数即可回到普通规则。
- 点击右上角“跳过”或按 Esc，立即恢复完整首页。会话存储被禁用时，当前文档仍只会启动一次；刷新新文档后可能再次播放。

## 文件与统一参数

| 文件 | 职责 |
| --- | --- |
| `dist/intro-boot.js` | 首帧判断、全部配置、跳过/Esc、会话标记、独立超时兜底 |
| `dist/intro.js` | 原生 Web Animations 时间线、状态、焦点与动画清理、首页揭幕 |
| `dist/intro.css` | 白底文案、四层 SVG 水面、粒子与响应式样式 |
| `dist/hero-media.js` | 可选的 intro → loop 视频播放器、自动播放失败与超时降级 |
| `dist/index.html` | 首帧内联覆盖样式和无脚本/应用失败时的静态首页 |

编辑 `intro-boot.js` 中的 `config`：

| 参数组 | 内容 |
| --- | --- |
| `brand` | 标题、英文辅助标题、最多三行说明 |
| `colors` | 水体 `#029EEB`、白底 `#FFFFFF`、文案 `#1D384A` |
| `timing` | 所有毫秒时间；`hold` 250、`drain` 2500、`messageFadeAt` 2850、`messageFade` 500、`revealAt` 3150、`paperFade` 550、`stagger` 140、`enter` 650、`complete` 4800、`watchdog` 6500 |
| `waves` | 桌面/手机高度、3/5.5/13/20 秒周期、负延迟、相位偏移与四层透明度 |
| `once` / `force` | 会话一次开关 / 默认读取 `?intro=1` |
| `media` | 静态 poster、桌面/手机 intro 与 loop 路径、媒体等待时间与最长 intro 时长 |
| `onComplete` / `onSkip` | 可选回调；参数为 `{ reason }`，不应在回调中重新锁定页面 |

时间线为 `idle → waveReveal → message → exit → complete`。状态可在 `document.documentElement.dataset.introState` 查看；完成原因在 `dataset.introResult`。调整时间时，让 `complete` 大于最后一组 `revealAt + 5 × stagger + enter`，并让 `watchdog` 留出初始化余量。

水体父容器负责纵向退场，每一层 SVG 自己负责横向循环。波浪两半完全重复，位移半个 SVG 宽度形成无缝循环。波浪与蓝色实体重叠 3px；退场距离由视口高度和波浪高度共同计算。覆盖层使用实时视口宽度（`100vw` 作为后备值），也覆盖桌面滚动条预留区域。

## 主视觉媒体

**当前交付使用 `tide.svg` 图片动效替代视频**：图片轻微缩放归位、低透明度粒子和原有慢速水面浮动。项目没有适合的视频素材，因此配置中的视频路径默认留空，也不会产生视频网络请求。

有自有素材后，可以这样修改配置（路径仅作格式说明，必须先添加实际文件）：

```js
media: {
  poster: './media/hero-poster.webp',
  breakpoint: 600,
  desktop: { intro: './media/intro-desktop.mp4', loop: './media/loop-desktop.mp4' },
  mobile: { intro: './media/intro-mobile.mp4', loop: './media/loop-mobile.mp4' },
  timeout: 4000,
  maxIntro: 15000,
}
```

仅选取当前窗口需要的媒体版本；两段视频静音、行内播放、尺寸和裁切一致。intro 只在本次开场揭幕后播放；其它首页访问直接使用 loop。接棒前等待 loop 的实际解码帧，失败或超时则展示静态图片。媒体不会阻塞 4.8 秒的开场；减少动态效果时不播放视频。

## 可用性与恢复

开场主遮罩期间将应用设为 `inert`，Tab 留在跳过按钮上。白底退场后解除背景交互锁定，最后一组装饰仍可继续进入。正常完成、跳过、异常、路由卸载和页面离开通过同一个清理入口移除遮罩与波浪、取消动画并恢复焦点/滚动。独立的 6.5 秒 watchdog 在开场模块未加载时仍会释放页面。

页面入口中保留静态品牌主视觉及两条现有话题，JavaScript 被禁用或应用加载失败时仍能阅读。互动功能仍需要 JavaScript。

## 验证

```powershell
npm run check
node scripts/qa-intro.mjs
node scripts/qa.mjs
```

两个浏览器脚本均可在命令后附线上网址，使用独立 Chrome 测试配置。开场脚本检查完整时间线、各阶段跳过、会话/重播、键盘、390×844/844×390/2560×1080、播放中旋转、减少动态效果、模块失败、禁用脚本，以及视频接棒/自动播放拒绝/超时/错误。视频检查使用测试浏览器现场生成的短片，不代表已有正式视频素材。

分镜、结果和 Chrome 实际录帧回放保存在 `.qa/intro/`。`playback.html` 是截图帧的可播放验收文件，不是 MP4；这些测试产物不会上传到源码仓库。
