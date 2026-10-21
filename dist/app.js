import { agents, initialPosts, initialGoals } from './data.js';
import { simulateAgent } from './mock-agent.js';

const iconPaths = {
  pulse: '<path d="M2 12h5l3-8 4 16 3-8h5"/>',
  grid: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',
  bookmark: '<path d="M6 4h12v17l-6-4-6 4z"/>',
  activity: '<path d="M4 16l5-5 4 3 7-10M15 4h5v5"/><path d="M4 21h16"/>',
  chat: '<path d="M21 11a8 8 0 0 1-8 8H7l-5 3 2-6a8 8 0 1 1 17-5Z"/>',
  search: '<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/>',
  bell: '<path d="M5 16V9a7 7 0 0 1 14 0v7l2 2H3zM10 21h4"/>',
  arrow: '<path d="M5 12h14m-5-5 5 5-5 5"/>',
  arrowUp: '<path d="M6 18 18 6M6 6h12v12"/>',
  plus: '<path d="M12 4v16M4 12h16"/>',
  chevron: '<path d="m9 5 7 7-7 7"/>',
  back: '<path d="m12 5-7 7 7 7M5 12h15"/>',
  heart: '<path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0l-1 1-1-1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z"/>',
  eye: '<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/>',
  spark: '<path d="m12 2 2.5 7.5L22 12l-7.5 2.5L12 22l-2.5-7.5L2 12l7.5-2.5z"/>',
  check: '<path d="m5 12 4 4L19 6"/>',
  shield: '<path d="m12 2 8 3v7c0 5-8 10-8 10S4 17 4 12V5z"/><path d="m8 11 3 3 5-5"/>',
  moon: '<path d="M20.5 14a8.5 8.5 0 0 1-10.5-10.5A9 9 0 1 0 20.5 14Z"/>',
  drop: '<path d="M12 2S5 10 5 15a7 7 0 0 0 14 0c0-5-7-13-7-13Z"/>',
  image: '<rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="8" cy="8" r="1.5"/><path d="m3 17 6-6 5 5 3-3 4 4"/>',
  x: '<path d="m6 6 12 12M6 18 18 6"/>',
  send: '<path d="m3 3 19 8-8 3-3 8zM3 3l11 11"/>',
  book: '<path d="M3 4h6a4 4 0 0 1 3 2 4 4 0 0 1 3-2h6v15h-6a4 4 0 0 0-3 2 4 4 0 0 0-3-2H3zM12 6v15"/>',
  stop: '<rect x="5" y="5" width="14" height="14" rx="2"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7v.1"/>',
  menu: '<path d="M3 6h18M3 12h14M3 18h18"/>',
};
const icon = (name, extra = '') => `<svg class="icon ${extra}" viewBox="0 0 24 24" aria-hidden="true">${iconPaths[name] || iconPaths.spark}</svg>`;
const esc = (value = '') => String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const byId = id => document.getElementById(id);
const getAgent = id => agents.find(a => a.id === id) || agents[0];
const safeRead = () => {
  try {
    const value = JSON.parse(localStorage.getItem('blue-hour-v1'));
    if (!value || !Array.isArray(value.posts) || !Array.isArray(value.goals)) return null;
    if (!value.posts.every(p => typeof p.id === 'string' && typeof p.title === 'string' && typeof p.body === 'string' && Array.isArray(p.replies) && Array.isArray(p.tags) && Array.isArray(p.agentIds))) return null;
    if (!value.goals.every(g => typeof g.id === 'string' && typeof g.title === 'string')) return null;
    return value;
  } catch { return null; }
};
const cached = safeRead();
const state = {
  posts: cached?.posts || structuredClone(initialPosts), goals: cached?.goals || structuredClone(initialGoals),
  saved: new Set(cached?.saved || []), liked: new Set(cached?.liked || []),
  route: 'community', postId: null, filter: '全部', tab: '推荐', search: '',
  replyTarget: null, controller: null, monitor: null, draft: { title: '', body: '', category: '运动训练' }, attachment: null, followupAttachment: null,
};
let toastTimer;
let transitionTimer;
let routeApplyTimer;
let transitioning = false;
let runVersion = 0;

function persist() {
  try {
    localStorage.setItem('blue-hour-v1', JSON.stringify({
      posts: state.posts.map(post => ({ ...post, image: null, replies: post.replies.map(r => ({ ...r, image: null, streaming: false, interrupted: r.streaming || r.interrupted })) })),
      goals: state.goals, saved: [...state.saved], liked: [...state.liked],
    }));
  } catch { toast('浏览器未能保存记录，本次会话仍可继续使用。'); }
}
function toast(message) {
  const box = byId('toast');
  box.textContent = message;
  box.classList.add('visible');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => box.classList.remove('visible'), 3500);
}

function runnerSvg() {
  return `<svg viewBox="0 0 460 300" fill="none" aria-hidden="true">
    <defs><linearGradient id="runnerGradient" x1="210" y1="60" x2="335" y2="240" gradientUnits="userSpaceOnUse"><stop stop-color="#edffff"/><stop offset="1" stop-color="#72d8ff"/></linearGradient><linearGradient id="orbitGradient"><stop stop-color="#b6f4ff" stop-opacity=".05"/><stop offset="1" stop-color="#a8eeff" stop-opacity=".7"/></linearGradient></defs>
    <text x="99" y="225" fill="#a0dfff" opacity=".12" font-family="Arial" font-size="180" font-style="italic" font-weight="900">UP</text>
    <g transform="rotate(-24 240 150)"><ellipse cx="240" cy="150" rx="164" ry="100" stroke="#89dfff" stroke-width="1" opacity=".3"/><ellipse cx="240" cy="150" rx="180" ry="113" stroke="#89dfff" stroke-width=".5" opacity=".15"/><path d="M76 150c0-55 73-100 164-100" stroke="#b6f4ff" stroke-width="3"/><circle cx="76" cy="150" r="4" fill="#ceffff"/></g>
    <g class="orbit"><circle cx="220" cy="150" r="118" stroke="#99e8ff" stroke-width=".6" stroke-dasharray="2 19" opacity=".6"/></g>
    <path class="speed" d="m103 120 54-17m-79 88 81-26m180-72 81-25m-82 122 55-17M82 242l117-37" stroke="#a0e7ff" stroke-width="2" stroke-dasharray="80 100" opacity=".45"/>
    <g class="runner" stroke="url(#runnerGradient)" stroke-linecap="round" stroke-linejoin="round"><circle cx="274" cy="68" r="14" fill="url(#runnerGradient)" stroke="none"/><path d="m250 103 28 24 37-15" stroke-width="12"/><path d="m249 101-30 33-28-10" stroke-width="11"/><path d="m253 101-14 52 37 28 27 45" stroke-width="21"/><path d="m240 150-39 37-38-4" stroke-width="17"/><path d="m301 226 17 4m-155-47-11 9" stroke-width="10"/></g>
    <path d="m180 246 135-40" stroke="#8ceaff" stroke-width="1" opacity=".4"/><path d="M381 50v12m-6-6h12M115 63v10m-5-5h10M363 222v10m-5-5h10" stroke="#b5f4ff" opacity=".7"/>
    <text x="324" y="75" fill="#abebff" font-family="Arial" font-size="8" letter-spacing="2" transform="rotate(-15 324 75)">RE:START</text>
  </svg>`;
}

function sidebar() {
  const nav = [ ['community', 'grid', '社区广场'], ['rhythm', 'activity', '我的节奏'], ['saved', 'bookmark', '我的收藏'], ['mine', 'chat', '我的动态'] ];
  return `<button class="nav-scrim" tabindex="-1" aria-hidden="true" data-close-nav></button><aside class="sidebar" id="site-navigation" aria-label="主要导航">
    <button class="mobile-nav-close icon-btn" data-close-nav aria-label="关闭导航">${icon('x')}</button>
    <a class="brand" href="#/community" data-route="community" aria-label="蓝调补给站首页"><span class="brand-symbol">${icon('pulse')}</span><span class="brand-name">蓝调补给站<small>BLUE HOUR CLUB</small></span></a>
    <div class="nav-caption">我的补给空间</div>
    <nav class="side-nav">${nav.map(([route, glyph, title], i) => `<a href="#/${route}" data-route="${route}" class="nav-item ${state.route === route || (route === 'community' && state.route === 'post') ? 'active' : ''}" ${state.route === route || (route === 'community' && state.route === 'post') ? 'aria-current="page"' : ''} aria-label="${title}"><span class="nav-number" aria-hidden="true">0${i + 1}</span>${icon(glyph)}<span class="nav-label">${title}</span>${route === 'saved' && state.saved.size ? `<span class="count">${state.saved.size}</span>` : ''}</a>`).join('')}</nav>
    <div class="nav-caption">找到你的同频</div>
    ${['运动训练', '营养饮食', '作息恢复'].map(t => `<button class="side-topic" data-topic="${t}"><span>#</span>${t}</button>`).join('')}
    <div class="sidebar-bottom"><div class="side-note"><span class="eyebrow">A LITTLE BETTER, DAILY</span>${icon('spark')}<h3>不用一下子变好，<br>向前一点就很好。</h3><p>你的每一次尝试，<br>都值得被认真回应。</p></div>
    <div class="profile"><span class="avatar">我</span><div><strong>体验玩家</strong><small>今天也在认真生活</small></div><span class="prototype-mark">V0.1</span></div></div>
  </aside>`;
}

function topbar() {
  const titles = { community: '社区广场', saved: '我的收藏', mine: '我的动态', rhythm: '我的节奏', post: '话题详情' };
  return `<header class="topbar"><button class="menu-toggle" aria-label="打开主要导航" aria-controls="site-navigation" aria-expanded="false" id="menu-toggle">${icon('menu')}<span>菜单</span></button><div class="breadcrumb"><span>补给空间</span><span class="muted separator">/</span><b>${titles[state.route]}</b></div>
    <div class="top-actions"><label class="search-box">${icon('search')}<input id="search" type="search" placeholder="搜索话题，找到同频的声音" value="${esc(state.search)}" aria-label="搜索社区话题" maxlength="80"/><span class="search-shortcut" aria-hidden="true">/</span></label>
    <span class="demo-pill">交互原型 · 演示数据</span><div class="notice-wrap"><button class="icon-btn" id="notice-toggle" aria-label="查看通知" aria-expanded="false">${icon('bell')}<i class="notification-dot"></i></button><div class="notice-popover" id="notice-popover" hidden><strong>欢迎来到蓝调补给站</strong><p>发布一个问题，邀请 AI 搭子加入讨论。此原型的回复、任务进度均为本地模拟，尚未连接真实 AI 服务。</p></div></div>
    </div></header>`;
}

function dateBlock() {
  const now = new Date();
  const parts = Object.fromEntries(new Intl.DateTimeFormat('zh-CN', { timeZone: 'Asia/Shanghai', month: '2-digit', day: '2-digit', weekday: 'long' }).formatToParts(now).map(p => [p.type, p.value]));
  return `<div class="heading-date"><strong>${parts.day}</strong><span class="date-split"></span><div>${parts.month} 月 · ${parts.weekday}<small>又是可以重新开始的一天</small></div></div>`;
}

function hero() {
  return `<section class="hero" aria-labelledby="hero-title"><div class="hero-word" aria-hidden="true">RE:START</div><div class="hero-art" aria-hidden="true"><img src="./tide.svg" alt="" width="760" height="620"/></div><div class="hero-content"><div class="hero-kicker"><span>01 / BLUE HOUR CLUB</span><span class="hero-kicker-line"></span>运动 · 健康 · 生活</div><h2 id="hero-title">把状态，<br><em>练回来。</em></h2><p>聊运动，聊生活，也聊偶尔的停滞。<br>你的 AI 搭子，陪你找到自己的节奏。</p><div class="hero-cta"><button class="hero-button" data-compose><span>发布一个小问题</span>${icon('arrowUp')}</button><button class="hero-explore" data-scroll-feed>逛逛社区 <span aria-hidden="true">↓</span></button></div><span class="hero-small">每个改变，从一句话开始。</span></div><span class="hero-corner">AI × 运动 × 生活</span><div class="hero-bottom"><span>YOUR DAILY RE:START</span><span>按自己的节奏，再次出发 <b aria-hidden="true">↘</b></span></div></section>`;
}

function agentAvatar(agent, tiny = false) {
  return `<span class="${tiny ? 'tiny-agent' : 'agent-avatar'} ${agent.color}" aria-hidden="true">${agent.mark}</span>`;
}
function agentsPanel() {
  return `<section class="panel"><div class="panel-header between"><div><h2>你的 AI 搭子</h2><div class="eyebrow">A LITTLE COMPANY</div></div><span class="online-tag">模拟体验</span></div>
  ${agents.map(a => `<div class="agent-row">${agentAvatar(a)}<div class="agent-info"><strong>${a.name} <span class="ai-label">AI · ${a.role}</span></strong><p>${a.description}</p></div></div>`).join('')}
  <p class="agent-explainer">${icon('shield')}每一位搭子均为 AI，回复供生活交流参考，不替代专业诊疗。</p></section>`;
}
function goalsPanel() {
  const count = state.goals.filter(g => g.done).length;
  return `<section class="panel" id="goals-panel"><div class="between"><h2>今天，对自己好一点</h2><a class="panel-link" data-route="rhythm" href="#/rhythm">全部 ${icon('chevron')}</a></div><div class="goal-progress"><b>${count}</b><span>/ ${state.goals.length}</span><small>小行动，大补给</small></div><div class="progress-track" role="progressbar" aria-label="今日小行动完成度" aria-valuenow="${count}" aria-valuemin="0" aria-valuemax="${state.goals.length}"><div style="width:${count / state.goals.length * 100}%"></div></div><div class="goal-list">${state.goals.map(g => goalButton(g)).join('')}</div></section>`;
}
function goalButton(g, expanded = false) {
  return `<button class="goal ${g.done ? 'done' : ''}" data-goal="${esc(g.id)}" aria-pressed="${!!g.done}"><span class="check">${g.done ? icon('check') : ''}</span><span><span class="goal-title">${esc(g.title)}</span>${expanded ? `<small>${esc(g.detail)}</small>` : ''}</span></button>`;
}
function topicsPanel() {
  return `<section class="panel"><div class="between"><h2>正在聊什么</h2>${icon('spark')}</div><div class="topic-list">${[['新手求助', '一起从零开始'], ['好好吃饭', '日常补给'], ['找回节奏', '慢慢来就好']].map(([topic, sub], i) => `<button class="topic-button" data-search="${topic}"><b>0${i + 1}</b><span># ${topic}</span><small>${sub}</small></button>`).join('')}</div></section>`;
}
function rightFooter() {
  return `<footer class="right-footer"><button data-guide>关于补给站</button> · 原创视觉与交互原型<br>好状态，从来不止一种标准。<div class="footer-line">BLUE HOUR CLUB © 2026 · PROTOTYPE</div></footer>`;
}
function standardAside() { return `<aside class="right-column" aria-label="搭子与生活目标">${agentsPanel()}${goalsPanel()}${topicsPanel()}${rightFooter()}</aside>`; }

function postCard(post) {
  const names = post.agentIds.map(id => getAgent(id).name).join('、');
  const replies = post.replies.filter(r => r.agentId).length;
  return `<article class="post-card ${post.visual === 'run' ? 'post-card-featured' : ''}" aria-label="${esc(post.title)}"><div class="post-meta"><span class="avatar ${esc(post.avatarColor || 'sky')}">${esc(post.avatar)}</span><span>${esc(post.author)}</span><time>· ${esc(post.time)}</time><span class="category-pill">${esc(post.category)}</span></div>
  <div class="post-main"><div class="post-copy"><button class="post-title" data-post="${esc(post.id)}">${esc(post.title)}</button><p class="post-excerpt">${esc(post.body)}</p><div class="tags">${post.tags.map(t => `<span># ${esc(t)}</span>`).join('')}</div></div>
  ${post.image ? `<div class="post-thumb"><img src="${esc(post.image)}" alt="帖子附图"/></div>` : post.visual === 'run' ? `<div class="post-thumb" aria-hidden="true"><div class="thumb-lines"></div>${runnerSvg()}<strong>JUST<br>START.</strong><small>从这一步开始</small></div>` : ''}</div>
  <div class="post-foot"><div class="agent-replied">${post.agentIds.map(id => agentAvatar(getAgent(id), true)).join('')}<span class="reply-label">${replies ? `<b>${esc(names)}</b> 已加入讨论` : '等待 AI 搭子加入'}</span></div><div class="post-stats"><button class="stat-btn ${state.liked.has(post.id) ? 'selected' : ''}" data-like="${esc(post.id)}" aria-label="${state.liked.has(post.id) ? '取消点赞' : '点赞'}" aria-pressed="${state.liked.has(post.id)}">${icon('heart')} ${post.likes + (state.liked.has(post.id) ? 1 : 0)}</button><button class="stat-btn" data-post="${esc(post.id)}" aria-label="查看 ${post.replies.length} 条回帖">${icon('chat')} ${post.replies.length}</button><span class="stat-btn stat-views" aria-label="演示浏览量">${icon('eye')} ${post.views}</span><button class="stat-btn ${state.saved.has(post.id) ? 'selected' : ''}" data-save="${esc(post.id)}" aria-label="${state.saved.has(post.id) ? '取消收藏' : '收藏帖子'}" aria-pressed="${state.saved.has(post.id)}">${icon('bookmark')}</button></div></div></article>`;
}

function filteredPosts() {
  let posts = [...state.posts];
  if (state.route === 'saved') posts = posts.filter(p => state.saved.has(p.id));
  if (state.route === 'mine') posts = posts.filter(p => p.mine || p.replies.some(r => r.isUser));
  if (state.filter !== '全部') posts = posts.filter(p => p.category === state.filter);
  const query = state.search.trim().toLowerCase();
  if (query) posts = posts.filter(p => `${p.title} ${p.body} ${p.tags.join(' ')} ${p.author}`.toLowerCase().includes(query));
  if (state.tab === '热门') posts.sort((a, b) => b.likes - a.likes);
  if (state.tab === '推荐') posts.sort((a, b) => ((b.visual ? 1000 : 0) + b.likes) - ((a.visual ? 1000 : 0) + a.likes));
  return posts;
}
function feedContent() {
  const posts = filteredPosts();
  let html;
  if (posts.length) html = `<div class="feed-list">${posts.map(postCard).join('')}</div><div class="end-note">${state.search ? '以上是匹配的话题' : '不必赶路，按自己的节奏来'}</div>`;
  else html = `<div class="empty">${icon(state.route === 'saved' ? 'bookmark' : 'chat')}<h2>${state.search ? '暂时没有找到相关话题' : state.route === 'saved' ? '把想再看的讨论，留在这里' : state.route === 'mine' ? '你的第一条动态，还在等你' : '这个分区还很安静'}</h2><p>${state.search ? '试试“跑步”“食堂”或“习惯”等关键词。' : state.route === 'saved' ? '点击帖子上的收藏图标，就能随时回来继续聊。' : '发布一个问题，邀请 AI 搭子加入讨论。'}</p><button class="secondary-btn" ${state.search ? 'data-reset-search' : 'data-compose'}>${state.search ? '清除搜索' : '发布第一个问题'} ${icon('arrow')}</button></div>`;
  return `<div class="filter-row">${['全部', '运动训练', '营养饮食', '作息恢复'].map(t => `<button class="filter ${state.filter === t ? 'active' : ''}" data-filter="${t}" aria-pressed="${state.filter === t}">${t}</button>`).join('')}<span class="filter-count">${posts.length} 条话题</span></div>${html}`;
}
function communityPage() {
  const title = state.route === 'saved' ? '我的收藏' : state.route === 'mine' ? '我的动态' : '社区广场';
  const subtitle = state.route === 'saved' ? '把有帮助的声音收藏起来，留给未来的自己。' : state.route === 'mine' ? '每一次提问与交流，都在记录你向前的一步。' : '有问题一起聊，有改变一起见证。';
  const sectionNumber = state.route === 'saved' ? '03' : state.route === 'mine' ? '04' : '01';
  const sectionLabel = state.route === 'saved' ? 'SAVED CONNECTIONS' : state.route === 'mine' ? 'MY CONVERSATIONS' : 'COMMUNITY';
  return `<div class="page-heading between ${state.route === 'community' ? 'page-heading-home' : ''}"><div><span class="eyebrow page-label">${sectionNumber} / ${sectionLabel}</span><h1>${title}<span class="title-dot">.</span></h1><p>${subtitle}</p></div>${state.route === 'community' ? dateBlock() : `<button class="primary-btn" data-compose>${icon('plus')} 发布话题</button>`}</div>${state.route === 'community' ? hero() : ''}<div class="section-heading" id="community-feed" tabindex="-1"><span class="section-number" aria-hidden="true">${sectionNumber}</span><div><span class="eyebrow">${sectionLabel} / FEED</span><h2>${state.route === 'community' ? '找到你的同频' : state.route === 'saved' ? '值得再读的声音' : '记录每一次向前'}</h2></div><span class="section-note">每个问题，都值得被认真回应。</span></div><div class="columns"><section class="main-column" aria-label="社区话题"><div class="feed-heading"><div class="feed-tabs" role="tablist" aria-label="话题排序">${['推荐', '热门', '最新'].map(t => `<button class="feed-tab ${state.tab === t ? 'active' : ''}" data-tab="${t}" role="tab" aria-selected="${state.tab === t}" tabindex="${state.tab === t ? '0' : '-1'}">${t === '推荐' && state.route !== 'community' ? '全部' : t}</button>`).join('')}</div><span class="feed-label">GOOD VIBES, GOOD COMPANY.</span></div><div id="feed-content">${feedContent()}</div></section>${standardAside()}</div>`;
}
function updateFeed() { if (byId('feed-content')) byId('feed-content').innerHTML = feedContent(); }

// The desktop sidebar becomes a modal drawer on small screens, without duplicating navigation.
function setNavigation(open, restoreFocus = true) {
  const sidebar = byId('site-navigation');
  if (!sidebar) return;
  const compact = matchMedia('(max-width: 900px)').matches;
  const active = compact && open;
  const wasOpen = document.body.classList.contains('nav-open');
  document.body.classList.toggle('nav-open', active);
  sidebar.inert = compact && !active;
  document.querySelector('.workspace').inert = active;
  byId('menu-toggle')?.setAttribute('aria-expanded', String(active));
  if (active) {
    sidebar.setAttribute('role', 'dialog');
    sidebar.setAttribute('aria-modal', 'true');
    sidebar.querySelector('.mobile-nav-close').focus({ preventScroll: true });
  } else {
    sidebar.removeAttribute('role');
    sidebar.removeAttribute('aria-modal');
    if (wasOpen && restoreFocus) byId('menu-toggle')?.focus({ preventScroll: true });
  }
}

function replyCard(reply) {
  const agent = reply.agentId ? getAgent(reply.agentId) : null;
  return `<article class="reply-card ${agent ? 'ai-reply' : 'human-reply'}" id="${esc(reply.id)}"><div class="reply-head">${agent ? agentAvatar(agent) : '<span class="avatar sky">我</span>'}<div><strong>${agent ? agent.name : '体验玩家'}</strong>${agent ? `<span class="ai-badge">AI</span><span class="role">${agent.role}</span>` : '<span class="role">用户追问</span>'}</div><time>${esc(reply.time || '刚刚')}</time></div>${reply.parentName ? `<div class="parent-quote">回复 @${esc(reply.parentName)}：${esc(reply.parentText || '')}</div>` : ''}<div class="reply-text ${reply.streaming ? 'streaming' : ''}" id="text-${esc(reply.id)}">${esc(reply.text)}</div>${reply.image ? `<img src="${esc(reply.image)}" class="detail-picture" alt="本次追问附图"/>` : ''}<div class="reply-actions">${agent ? `<button class="reply-to-btn" data-reply="${esc(reply.id)}" ${state.controller ? 'disabled' : ''}>${icon('chat')} 追问${agent.name}</button><span class="demo-reply-label">模拟 AI 回复</span>` : ''}${reply.interrupted ? '<span class="reply-status">回复已停止，可重新追问</span>' : ''}</div></article>`;
}
function monitorPanel() {
  const monitor = state.monitor;
  const steps = monitor?.steps || [
    { title: '理解主贴与追问', detail: '结合当前讨论的上下文' },
    { title: '邀请合适的 AI 搭子', detail: '按话题匹配不同的交流角色' },
    { title: '生成回复，继续讨论', detail: '结果会出现在评论区' },
  ];
  return `<section class="panel agent-monitor" id="agent-monitor"><div class="monitor-title">${icon('spark')} <strong>搭子行动记录</strong></div><span class="monitor-state ${state.controller ? 'running' : `is-${monitor?.status || 'idle'}`}" role="status">${state.controller ? '正在回应你的问题' : monitor?.status === 'done' ? '本次回复已完成' : monitor?.status === 'stopped' ? '本次回复已停止' : monitor?.status === 'error' ? '回复中断，请重试' : '等待你发起讨论'}</span><ol class="step-list">${steps.map((step, i) => `<li class="step ${monitor?.done?.includes(i) ? 'done' : monitor?.active === i ? 'active' : ''}"><span class="step-icon">${monitor?.done?.includes(i) ? icon('check') : `0${i + 1}`}</span><div><strong>${step.title}</strong><p>${step.detail}</p></div></li>`).join('')}</ol>${state.controller ? `<button class="secondary-btn" data-stop>${icon('stop')} 停止本次回复</button>` : ''}<div class="monitor-note"><strong>让每一步，都看得见。</strong><br>这里展示任务进度，不展示模型内部推理。当前为模拟流程，尚未调用模型、检索或外部工具。</div></section>`;
}
function followupForm(post) {
  const target = post.replies.find(r => r.id === state.replyTarget);
  return `<form id="followup-form" class="followup-panel"><div class="replying-to">${icon('chat')} ${target?.agentId ? `正在追问 <strong>@${getAgent(target.agentId).name}</strong><button class="icon-btn" type="button" data-clear-target aria-label="取消指定回复对象">${icon('x')}</button>` : '继续聊聊，AI 搭子会接着回应'}</div><textarea id="followup-text" aria-label="输入追问内容" placeholder="补充你的情况，或者问一句「那我该从哪一步开始？」" maxlength="1000" ${state.controller ? 'disabled' : ''}></textarea><div id="followup-preview"></div><div class="followup-footer"><div><label class="attachment-button" for="followup-file" role="button" tabindex="${state.controller ? '-1' : '0'}" aria-disabled="${!!state.controller}">${icon('image')} 附上图片</label><input hidden type="file" id="followup-file" accept="image/jpeg,image/png,image/webp" ${state.controller ? 'disabled' : ''}/><small>Ctrl / ⌘ + Enter 发送</small></div><button class="primary-btn" type="submit" ${state.controller ? 'disabled' : ''}>${state.controller ? '搭子回复中…' : '发送追问'} ${icon('send')}</button></div>${state.controller ? `<div class="run-feedback"><span role="status">${icon('spark')} 搭子正在准备模拟回复</span><button class="secondary-btn" type="button" data-stop>${icon('stop')} 停止回复</button></div>` : ''}</form>`;
}
function postPage() {
  const post = state.posts.find(p => p.id === state.postId);
  if (!post) return `<div class="empty">${icon('search')}<h2>这条话题暂时找不到了</h2><a class="primary-btn" href="#/community" data-route="community">返回社区</a></div>`;
  return `<button class="back-button" data-route="community">${icon('back')} 返回社区广场</button><div class="columns"><section class="main-column" aria-label="帖子与回帖"><article class="detail-post"><div class="context-pill">${icon('spark')} 与 AI 搭子一起讨论 · 演示话题</div><div class="post-meta"><span class="avatar ${esc(post.avatarColor || 'sky')}">${esc(post.avatar)}</span><span>${esc(post.author)}</span><time>· ${esc(post.time)}</time><span class="category-pill">${esc(post.category)}</span></div><h1>${esc(post.title)}</h1><div class="detail-body">${esc(post.body)}</div>${post.image ? `<img class="detail-picture" src="${esc(post.image)}" alt="楼主上传的图片"/>` : ''}<div class="tags">${post.tags.map(t => `<span># ${esc(t)}</span>`).join('')}</div><div class="post-stats"><button class="stat-btn ${state.liked.has(post.id) ? 'selected' : ''}" data-like="${esc(post.id)}" aria-pressed="${state.liked.has(post.id)}">${icon('heart')} ${post.likes + (state.liked.has(post.id) ? 1 : 0)} 人觉得有帮助</button><button class="stat-btn ${state.saved.has(post.id) ? 'selected' : ''}" data-save="${esc(post.id)}" aria-pressed="${state.saved.has(post.id)}">${icon('bookmark')} ${state.saved.has(post.id) ? '已收藏' : '收藏话题'}</button></div></article>
  <div class="discussion-heading"><h2>同频的声音<span id="reply-count">${post.replies.length}</span></h2><small>AI 身份公开，让每一次交流更清晰</small></div><div class="reply-list" id="reply-list">${post.replies.length ? post.replies.map(replyCard).join('') : '<div class="empty" id="reply-empty"><p>问题已送达，AI 搭子正在准备加入讨论。</p></div>'}</div><div id="followup-container">${followupForm(post)}</div><p class="local-note">AI 角色与回复均为演示内容 · 只讨论运动和生活习惯，不提供诊断或用药建议</p></section><aside class="right-column" aria-label="AI 执行进度"><div>${monitorPanel()}</div>${agentsPanel()}<div class="detail-help"><strong>${icon('image')} 一张图，也可以开启讨论</strong>在发帖或追问时附上餐食、运动记录等图片。当前支持本地图片预览，真实识图能力将由后端接入。</div>${rightFooter()}</aside></div>`;
}

function rhythmPage() {
  const today = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Shanghai' }));
  const monday = new Date(today); monday.setDate(today.getDate() - (today.getDay() + 6) % 7);
  const days = Array.from({ length: 7 }, (_, i) => { const d = new Date(monday); d.setDate(monday.getDate() + i); return d; });
  return `<div class="page-heading between"><div><span class="eyebrow page-label">02 / MY RHYTHM</span><h1>我的节奏<span class="title-dot">.</span></h1><p>少一点比较，多一点属于自己的进度。</p></div>${dateBlock()}</div><div class="columns"><section class="main-column"><div class="rhythm-hero"><span class="eyebrow">SMALL STEPS COUNT.</span><h2>慢一点，也是在向前。</h2><p>今天不需要满分。做一件让自己舒服的小事，就很好。</p></div><div class="week-strip" aria-label="本周日期">${days.map((d, i) => `<div class="day ${d.getDate() === today.getDate() ? 'today' : ''}" ${d.getDate() === today.getDate() ? 'aria-current="date"' : ''}><small>${['周一', '周二', '周三', '周四', '周五', '周六', '周日'][i]}</small><strong>${d.getDate()}</strong></div>`).join('')}</div><div class="discussion-heading"><h2>今日小行动</h2><small>完成记录仅保存在当前浏览器</small></div>${state.goals.map(g => `<div class="rhythm-goal"><span class="goal-icon">${icon(g.icon)}</span>${goalButton(g, true)}</div>`).join('')}<p class="local-note">这是手动勾选的生活清单，不是 AI 生成的个性化健康计划。</p><button class="secondary-btn" data-compose>${icon('chat')} 想聊聊我的计划</button></section>${standardAside()}</div>`;
}

function render() {
  byId('app').innerHTML = `${sidebar()}<div class="workspace">${topbar()}<main id="main-content" class="page-${state.route}" tabindex="-1">${state.route === 'post' ? postPage() : state.route === 'rhythm' ? rhythmPage() : communityPage()}</main></div>`;
  bindSearch();
  bindFollowup();
  setNavigation(false, false);
  document.title = state.route === 'post' ? `${state.posts.find(p => p.id === state.postId)?.title || '话题详情'} · 蓝调补给站` : '蓝调补给站 · 找回自己的好状态';
}

function cancelRun() {
  if (state.controller) {
    state.controller.abort(); state.controller = null; runVersion++;
    if (state.monitor) { state.monitor.status = 'stopped'; state.monitor.active = null; }
    for (const p of state.posts) for (const r of p.replies) if (r.streaming) { r.streaming = false; r.interrupted = true; }
    persist();
  }
}
function navigate(route, postId = null, { animate = true, push = true, focus = true } = {}) {
  if (transitioning) return;
  setNavigation(false, false);
  cancelRun();
  revokeAttachment('followupAttachment');
  const apply = () => {
    state.route = route; state.postId = postId; state.replyTarget = null; state.monitor = null;
    if (push) history.pushState({}, '', route === 'post' ? `#/post/${encodeURIComponent(postId)}` : `#/${route}`);
    render(); window.scrollTo({ top: 0, behavior: 'instant' });
    if (focus) byId('main-content').focus({ preventScroll: true });
  };
  if (!animate || matchMedia('(prefers-reduced-motion: reduce)').matches) { apply(); return; }
  transitioning = true;
  byId('transition').classList.remove('play');
  void byId('transition').offsetWidth;
  byId('transition').classList.add('play');
  const duration = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--motion-route')) || 360;
  routeApplyTimer = setTimeout(apply, duration * .44);
  clearTimeout(transitionTimer);
  transitionTimer = setTimeout(() => { byId('transition').classList.remove('play'); transitioning = false; }, duration + 20);
}
function routeFromUrl() {
  let hash;
  try { hash = decodeURIComponent(location.hash.slice(2)); } catch { hash = 'community'; }
  const [route, id] = hash.split('/');
  navigate(['community', 'post', 'rhythm', 'saved', 'mine'].includes(route) ? route : 'community', id || null, { animate: false, push: false, focus: false });
}

function bindSearch() {
  byId('search')?.addEventListener('input', event => {
    state.search = event.target.value;
    if (state.route !== 'community' && state.route !== 'saved' && state.route !== 'mine') {
      navigate('community', null, { animate: false, focus: false });
      const input = byId('search'); input.focus(); input.setSelectionRange?.(input.value.length, input.value.length);
    } else updateFeed();
  });
}
function updateMonitor() {
  const panel = byId('agent-monitor');
  if (panel) panel.outerHTML = monitorPanel();
}
function updateFollowup() {
  const post = state.posts.find(p => p.id === state.postId);
  if (post && byId('followup-container')) {
    const previous = byId('followup-text')?.value || '';
    byId('followup-container').innerHTML = followupForm(post);
    bindFollowup();
    byId('followup-text').value = previous;
    renderImagePreview('followup');
  }
}
function bindFollowup() {
  byId('followup-form')?.addEventListener('submit', submitFollowup);
  byId('followup-file')?.addEventListener('change', event => selectImage(event.target.files[0], 'followupAttachment'));
  byId('followup-text')?.addEventListener('keydown', event => { if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') { event.preventDefault(); byId('followup-form').requestSubmit(); } });
}

async function runAgent(post, question = '', agentId = null, hasImage = false) {
  cancelRun();
  const version = ++runVersion;
  const controller = new AbortController(); state.controller = controller;
  let currentReply;
  document.querySelectorAll('[data-reply]').forEach(b => b.disabled = true);
  updateFollowup();
  try {
    for await (const event of simulateAgent({ post, question, agentId, hasImage, signal: controller.signal })) {
      if (version !== runVersion || state.postId !== post.id) return;
      if (event.type === 'run.started') { state.monitor = { steps: event.steps, active: null, done: [], status: 'running' }; updateMonitor(); }
      if (event.type === 'step.started') { state.monitor.active = event.index; updateMonitor(); }
      if (event.type === 'step.completed') { state.monitor.done.push(event.index); state.monitor.active = null; updateMonitor(); }
      if (event.type === 'reply.started') {
        currentReply = { ...event.reply, streaming: true }; post.replies.push(currentReply);
        if (!post.agentIds.includes(currentReply.agentId)) post.agentIds.push(currentReply.agentId);
        byId('reply-empty')?.remove();
        byId('reply-list')?.insertAdjacentHTML('beforeend', replyCard(currentReply));
        byId('reply-count').textContent = post.replies.length;
        const rect = byId(currentReply.id)?.getBoundingClientRect();
        if (rect && rect.top > innerHeight - 120) byId(currentReply.id).scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth', block: 'center' });
      }
      if (event.type === 'reply.delta' && currentReply) { currentReply.text += event.delta; const text = byId(`text-${currentReply.id}`); if (text) text.textContent = currentReply.text; }
      if (event.type === 'reply.completed' && currentReply) { currentReply.streaming = false; byId(currentReply.id).outerHTML = replyCard(currentReply); }
      if (event.type === 'run.completed') { state.monitor.status = 'done'; }
    }
  } catch (error) {
    if (version !== runVersion) return;
    if (error.name !== 'AbortError') { state.monitor = { ...(state.monitor || {}), status: 'error', active: null }; toast('回复未完成，可以重新发送追问。'); }
  } finally {
    if (version === runVersion) {
      state.controller = null;
      if (currentReply?.streaming) { currentReply.streaming = false; currentReply.interrupted = true; if (byId(currentReply.id)) byId(currentReply.id).outerHTML = replyCard(currentReply); }
      updateMonitor(); updateFollowup();
      document.querySelectorAll('[data-reply]').forEach(b => b.disabled = false);
      persist();
    }
  }
}

function submitFollowup(event) {
  event.preventDefault();
  if (state.controller) return;
  const input = byId('followup-text');
  const text = input.value.trim();
  const image = state.followupAttachment;
  if (!text && !image) { toast('先写下想追问的内容，或附上一张图片。'); input.focus(); return; }
  const post = state.posts.find(p => p.id === state.postId);
  if (!post) return;
  const parent = post.replies.find(r => r.id === state.replyTarget);
  const parentAgent = parent?.agentId ? getAgent(parent.agentId) : null;
  const reply = { id: `user-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, isUser: true, text: text || '我附上了一张图片，想请搭子帮我看看。', time: '刚刚', parentName: parentAgent?.name, parentText: parent?.text, image: image?.url || null };
  post.replies.push(reply);
  state.followupAttachment = null;
  state.replyTarget = null;
  input.value = '';
  byId('reply-empty')?.remove();
  byId('reply-list').insertAdjacentHTML('beforeend', replyCard(reply));
  byId('reply-count').textContent = post.replies.length;
  persist();
  runAgent(post, reply.text, parentAgent?.id, !!image);
}

function openComposer() {
  byId('composer').innerHTML = `<div class="dialog-header"><span class="eyebrow">START A CONVERSATION</span><h2 id="composer-title">一个问题，一次新开始。</h2><p>不用组织得很完美，你的搭子已经准备好倾听。</p><button class="dialog-close" data-close-composer aria-label="关闭发帖窗口">${icon('x')}</button></div><form id="composer-form" class="composer-form"><div class="field"><label for="post-title">给话题起个标题<span>最多 60 个字</span></label><input id="post-title" name="title" maxlength="60" minlength="3" required placeholder="最近有什么运动或生活上的小困惑？" value="${esc(state.draft.title)}"/></div><div class="field"><span class="field-label" id="category-label">选择一个补给分区</span><div class="category-options" role="group" aria-labelledby="category-label">${['运动训练', '营养饮食', '作息恢复'].map(t => `<label class="category-option"><input type="radio" name="category" value="${t}" ${state.draft.category === t ? 'checked' : ''}/>${t}</label>`).join('')}</div></div><div class="field"><label for="post-body">展开说说<span>最多 2000 个字</span></label><textarea id="post-body" name="body" maxlength="2000" required placeholder="可以聊聊你的目标、日常安排，或者已经尝试过的方法。">${esc(state.draft.body)}</textarea></div><label class="upload-zone" for="post-image" role="button" tabindex="0">${icon('image')}<span><strong>附上一张图，让问题更具体</strong><small>JPG / PNG / WebP · 最大 5 MB · 本地预览，暂不识图</small></span></label><input type="file" hidden id="post-image" accept="image/jpeg,image/png,image/webp"/><div id="composer-preview"></div><p class="form-error" id="composer-error" role="alert"></p><div class="composer-actions"><small>${icon('shield')} AI 搭子会明确标注身份。<br>本版发布内容仅保存在当前浏览器。</small><button class="primary-btn" type="submit">发布，邀请搭子 ${icon('arrowUp')}</button></div></form>`;
  byId('composer-form').addEventListener('submit', submitPost);
  byId('composer-form').addEventListener('input', () => {
    state.draft = { title: byId('post-title').value, body: byId('post-body').value, category: byId('composer-form').elements.category.value };
  });
  byId('post-image').addEventListener('change', event => selectImage(event.target.files[0], 'attachment'));
  renderImagePreview('composer');
  byId('composer').showModal();
}
function submitPost(event) {
  event.preventDefault();
  const title = byId('post-title').value.trim();
  const body = byId('post-body').value.trim();
  if (title.length < 3 || !body) { byId('composer-error').textContent = '标题至少写 3 个字，并补充一点具体内容。'; return; }
  const category = byId('composer-form').elements.category.value;
  const agent = agents.find(a => a.tag === category) || agents[0];
  const post = { id: `post-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, author: '体验玩家', avatar: '我', avatarColor: 'sky', time: '刚刚', category, title, body, tags: ['我的提问'], likes: 0, views: 1, image: state.attachment?.url || null, agentIds: [agent.id], replies: [], mine: true };
  state.attachment = null; state.draft = { title: '', body: '', category: '运动训练' };
  state.posts.unshift(post); persist();
  byId('composer').close();
  state.filter = '全部'; state.search = ''; state.tab = '最新';
  navigate('post', post.id, { animate: false });
  toast('问题已发布，AI 搭子正在加入讨论。');
  runAgent(post, '', agent.id, !!post.image);
}

function revokeAttachment(key) {
  if (state[key]?.url) URL.revokeObjectURL(state[key].url);
  state[key] = null;
}
function selectImage(file, key) {
  if (!file) return;
  const imageError = message => {
    if (key === 'attachment' && byId('composer-error')) byId('composer-error').textContent = message;
    else toast(message);
  };
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) { imageError('请选择 JPG、PNG 或 WebP 图片。'); return; }
  if (file.size > 5 * 1024 * 1024) { imageError('图片超过 5 MB，请选择小一点的图片。'); return; }
  if (key === 'attachment' && byId('composer-error')) byId('composer-error').textContent = '';
  revokeAttachment(key);
  state[key] = { url: URL.createObjectURL(file), name: file.name };
  renderImagePreview(key === 'attachment' ? 'composer' : 'followup');
}
function renderImagePreview(place) {
  const image = place === 'composer' ? state.attachment : state.followupAttachment;
  const element = byId(`${place}-preview`);
  if (!element) return;
  element.innerHTML = image ? `<div class="image-preview"><img src="${esc(image.url)}" alt="待上传图片的本地预览"/><span>${esc(image.name)}<br>仅当前会话预览 · 未上传服务器</span><button type="button" class="icon-btn" data-remove-image="${place}" aria-label="移除图片">${icon('x')}</button></div>` : '';
}

function openGuide() {
  byId('guide').innerHTML = `<div class="dialog-header"><span class="eyebrow">WELCOME TO BLUE HOUR</span><h2 id="guide-title">在这里，找到同频的声音。</h2><p>运动与健康生活 AI 社区 · 视觉交互原型 v0.1</p><button class="dialog-close" data-close-guide aria-label="关闭介绍">${icon('x')}</button></div><div class="guide-content"><h3>从一个问题开始</h3><ol><li>在社区浏览话题，或发布自己的运动、饮食、生活习惯问题。</li><li>AI 搭子以公开身份回帖。点击“追问”，继续同一段讨论。</li><li>收藏有帮助的帖子，在“我的节奏”勾选自己的生活小行动。</li></ol><h3>这次可以体验什么？</h3><p>分区筛选、关键词搜索、点赞收藏、发帖、评论区追问、模拟流式回复、任务进度、停止回复、图片预览与斜切转场。</p><h3>原型的边界</h3><p>当前没有真实账号、模型调用、图片识别、知识库检索或外部工具调用。所有 AI 回复与执行状态均为本地演示。图片只用于当前会话预览，不会上传；文字、点赞和收藏保存在当前浏览器。</p><p>搭子是 AI 交流角色，不是真实用户或医生；健康讨论不替代专业诊疗。视觉使用原创图形、排版与代码绘制，没有使用游戏人物、音乐或截图。</p><button class="secondary-btn" data-close-guide>了解了，开始补给 ${icon('arrow')}</button></div>`;
  byId('guide').showModal();
}

document.addEventListener('click', event => {
  const target = event.target.closest('button,a');
  if (!target) return;
  if (target.classList.contains('skip-link')) { event.preventDefault(); byId('main-content').focus(); return; }
  if (target.id === 'menu-toggle') { setNavigation(true); return; }
  if (target.hasAttribute('data-close-nav')) { setNavigation(false); return; }
  if (target.hasAttribute('data-scroll-feed')) {
    byId('community-feed')?.focus({ preventScroll: true });
    byId('community-feed')?.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth', block: 'start' });
    return;
  }
  if (target.hasAttribute('data-route')) { event.preventDefault(); state.search = ''; state.filter = '全部'; state.tab = '推荐'; navigate(target.dataset.route); return; }
  if (target.hasAttribute('data-post')) { navigate('post', target.dataset.post); return; }
  if (target.hasAttribute('data-compose')) { openComposer(); return; }
  if (target.hasAttribute('data-guide')) { openGuide(); return; }
  if (target.hasAttribute('data-close-composer')) { byId('composer').close(); return; }
  if (target.hasAttribute('data-close-guide')) { byId('guide').close(); return; }
  if (target.hasAttribute('data-tab')) { state.tab = target.dataset.tab; document.querySelectorAll('[data-tab]').forEach(t => { t.classList.toggle('active', t.dataset.tab === state.tab); t.setAttribute('aria-selected', t.dataset.tab === state.tab); t.tabIndex = t.dataset.tab === state.tab ? 0 : -1; }); updateFeed(); return; }
  if (target.hasAttribute('data-filter')) { state.filter = target.dataset.filter; updateFeed(); return; }
  if (target.hasAttribute('data-topic')) { state.filter = target.dataset.topic; state.search = ''; navigate('community'); return; }
  if (target.hasAttribute('data-search')) { state.search = target.dataset.search; state.filter = '全部'; navigate('community'); return; }
  if (target.hasAttribute('data-reset-search')) { state.search = ''; byId('search').value = ''; updateFeed(); return; }
  if (target.hasAttribute('data-save') || target.hasAttribute('data-like')) {
    const isSave = target.hasAttribute('data-save');
    const id = isSave ? target.dataset.save : target.dataset.like;
    const set = isSave ? state.saved : state.liked;
    if (set.has(id)) set.delete(id); else set.add(id);
    persist();
    if (isSave) toast(set.has(id) ? '已放进收藏，随时回来继续聊。' : '已取消收藏。');
    if (state.route === 'post') {
      const post = state.posts.find(p => p.id === id);
      target.classList.toggle('selected', set.has(id)); target.setAttribute('aria-pressed', set.has(id));
      target.innerHTML = isSave ? `${icon('bookmark')} ${set.has(id) ? '已收藏' : '收藏话题'}` : `${icon('heart')} ${post.likes + (set.has(id) ? 1 : 0)} 人觉得有帮助`;
    } else updateFeed();
    const nav = document.querySelector('.side-nav [data-route="saved"]');
    if (nav) { nav.querySelector('.count')?.remove(); if (state.saved.size) nav.insertAdjacentHTML('beforeend', `<span class="count">${state.saved.size}</span>`); }
    return;
  }
  if (target.hasAttribute('data-goal')) {
    const g = state.goals.find(g => g.id === target.dataset.goal); if (!g) return;
    g.done = !g.done; persist();
    if (state.route === 'rhythm') { const top = scrollY; render(); window.scrollTo(0, top); document.querySelector(`[data-goal="${g.id}"]`)?.focus({ preventScroll: true }); }
    else if (byId('goals-panel')) { byId('goals-panel').outerHTML = goalsPanel(); document.querySelector(`[data-goal="${g.id}"]`)?.focus({ preventScroll: true }); }
    if (g.done) toast('这一点小改变，值得为自己点赞。'); return;
  }
  if (target.hasAttribute('data-reply')) {
    state.replyTarget = target.dataset.reply;
    updateFollowup();
    byId('followup-text')?.focus({ preventScroll: true });
    byId('followup-container')?.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth', block: 'center' }); return;
  }
  if (target.hasAttribute('data-clear-target')) { state.replyTarget = null; updateFollowup(); byId('followup-text')?.focus(); return; }
  if (target.hasAttribute('data-stop')) { cancelRun(); updateMonitor(); const post = state.posts.find(p => p.id === state.postId); byId('reply-list').innerHTML = post.replies.map(replyCard).join(''); updateFollowup(); document.querySelectorAll('[data-reply]').forEach(b => b.disabled = false); toast('已停止回复，可以补充问题后继续聊。'); return; }
  if (target.hasAttribute('data-remove-image')) {
    const place = target.dataset.removeImage; revokeAttachment(place === 'composer' ? 'attachment' : 'followupAttachment');
    const input = byId(place === 'composer' ? 'post-image' : 'followup-file'); if (input) input.value = '';
    renderImagePreview(place); return;
  }
  if (target.id === 'notice-toggle') { const pop = byId('notice-popover'); pop.hidden = !pop.hidden; target.setAttribute('aria-expanded', !pop.hidden); }
});

document.addEventListener('click', event => {
  if (!event.target.closest('.notice-wrap')) { const pop = byId('notice-popover'); if (pop) { pop.hidden = true; byId('notice-toggle')?.setAttribute('aria-expanded', 'false'); } }
});
document.addEventListener('keydown', event => {
  if (document.body.classList.contains('nav-open')) {
    if (event.key === 'Escape') { event.preventDefault(); setNavigation(false); return; }
    if (event.key === 'Tab') {
      const controls = [...byId('site-navigation').querySelectorAll('a[href], button:not(:disabled)')].filter(el => el.getClientRects().length);
      const first = controls[0]; const last = controls.at(-1);
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    }
    return;
  }
  const tab = event.target.closest('[role="tab"]');
  if (tab && ['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) {
    event.preventDefault();
    const tabs = [...tab.parentElement.querySelectorAll('[role="tab"]')];
    const index = tabs.indexOf(tab);
    const next = event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1 : (index + (event.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length;
    tabs[next].focus(); tabs[next].click(); return;
  }
  const upload = event.target.closest('label[role="button"]');
  if (upload && ['Enter', ' '].includes(event.key)) {
    event.preventDefault();
    if (upload.getAttribute('aria-disabled') !== 'true') byId(upload.htmlFor)?.click();
    return;
  }
  const inputActive = ['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName);
  if (event.key === '/' && !inputActive && !byId('composer').open && !byId('guide').open) { event.preventDefault(); byId('search')?.focus(); }
  if (event.key === 'Escape') { const pop = byId('notice-popover'); if (pop) { pop.hidden = true; byId('notice-toggle')?.setAttribute('aria-expanded', 'false'); } }
});
for (const id of ['composer', 'guide']) byId(id).addEventListener('click', event => { if (event.target === byId(id)) { const r = byId(id).getBoundingClientRect(); if (event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom) byId(id).close(); } });
window.addEventListener('popstate', () => { transitioning = false; clearTimeout(transitionTimer); clearTimeout(routeApplyTimer); byId('transition').classList.remove('play'); routeFromUrl(); });
window.addEventListener('beforeunload', () => { cancelRun(); });
matchMedia('(max-width: 900px)').addEventListener('change', () => setNavigation(false, false));
routeFromUrl();
