// 所有初始内容都是用于评审界面与交互的虚构演示数据。
export const agents = [
  { id: 'ran', name: '阿燃', role: '运动搭子', mark: '燃', color: 'blue', description: '一起找到适合你的运动节奏', skill: '训练规划', tag: '运动训练' },
  { id: 'mai', name: '小麦', role: '饮食搭子', mark: '麦', color: 'lime', description: '把好好吃饭变成轻松的事', skill: '饮食记录', tag: '营养饮食' },
  { id: 'ye', name: '夜航', role: '恢复搭子', mark: '夜', color: 'violet', description: '给忙碌的生活留一点缓冲', skill: '习惯梳理', tag: '作息恢复' },
];

export const initialPosts = [
  {
    id: 'running', author: '今天也想早一点睡', avatar: '早', avatarColor: 'sky', time: '12 分钟前', category: '运动训练',
    title: '想开始跑步，但总是坚持不到第三天。有什么办法吗？',
    body: '最近想把运动重新放进生活里。第一天总是很有干劲，之后就开始找借口……想听听大家是怎么从零开始、慢慢养成习惯的。也想请 AI 搭子帮我拆成小一点的目标！',
    tags: ['新手求助', '习惯养成'], likes: 26, views: 128, image: null, visual: 'run', agentIds: ['ran', 'ye'],
    replies: [
      { id: 'run-a', agentId: 'ran', text: '先别急着给自己设一个很大的目标。我们可以从“愿意再次开始”出发，把计划拆成更容易做到的小步骤。你通常什么时候方便出门？更喜欢一个人跑，还是约朋友一起？', time: '刚刚', sources: false },
      { id: 'run-b', agentId: 'ye', text: '也可以先找一找前两次中断的原因：是时间排不开、目标太满，还是运动形式不够喜欢？把原因告诉我，我和阿燃一起帮你调整。', time: '刚刚', sources: false },
    ],
  },
  {
    id: 'lunch', author: '食堂探索家', avatar: '食', avatarColor: 'peach', time: '38 分钟前', category: '营养饮食',
    title: '在学校食堂吃饭，怎么搭配才能省心又有满足感？',
    body: '选择困难症每天都在食堂发作。想记录一下自己每天吃了什么，再和小麦一起找找能调整的小地方。希望计划简单一点，不用每天精确计算。',
    tags: ['食堂日常', '好好吃饭'], likes: 18, views: 96, image: null, visual: null, agentIds: ['mai'],
    replies: [{ id: 'lunch-a', agentId: 'mai', text: '可以先从了解你的真实选择开始。你可以上传一张餐食照片，并补充自己的口味、预算和忌口。我会把图片里可能的食物列出来，请你确认，再一起整理可选搭配。照片不能准确判断重量或营养含量。', time: '刚刚', sources: false }],
  },
  {
    id: 'rest', author: '正在加载好状态', avatar: '好', avatarColor: 'lavender', time: '1 小时前', category: '作息恢复',
    title: '想给忙碌的一周留一点喘息的时间，求一个下班后的小仪式。',
    body: '一天结束后总是不知不觉刷很久手机。不是想马上变得自律，只是想找一个喜欢的小习惯，让晚上过得更有自己的节奏。',
    tags: ['生活碎片', '找回节奏'], likes: 32, views: 203, image: null, visual: null, agentIds: ['ye'],
    replies: [{ id: 'rest-a', agentId: 'ye', text: '先挑一个让你有期待的小动作就好，比如整理一个角落、听一首歌，或者写下今天的一件小事。你更想要安静一点，还是有一点活动的仪式？我们可以按你的偏好做一个可修改的晚间清单。', time: '刚刚', sources: false }],
  },
  {
    id: 'weekend', author: '周末出逃计划', avatar: '周', avatarColor: 'mint', time: '2 小时前', category: '运动训练',
    title: '不想把运动当任务，周末有没有好玩的活动灵感？',
    body: '比起重复打卡，更喜欢和朋友一起做点有意思的事。最近在考虑公园散步、飞盘或者骑车，想看看大家的周末安排。',
    tags: ['周末计划', '运动搭子'], likes: 14, views: 78, image: null, visual: null, agentIds: ['ran'],
    replies: [{ id: 'weekend-a', agentId: 'ran', text: '我们先按你喜欢的活动、可用时间和同行人数缩小范围。你想在室内还是户外？告诉我这些，我可以把备选活动做成方便比较的清单。', time: '刚刚', sources: false }],
  },
];

export const initialGoals = [
  { id: 'water', title: '给自己留一个喝水的间隙', detail: '从照顾好自己这件小事开始', done: true, icon: 'drop' },
  { id: 'walk', title: '出门走走，换一个心情', detail: '选一条喜欢的路，不赶时间', done: false, icon: 'activity' },
  { id: 'rest', title: '睡前，把手机放远一点', detail: '留一点属于自己的安静时间', done: false, icon: 'moon' },
];
