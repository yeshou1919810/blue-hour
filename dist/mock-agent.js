import { agents } from './data.js';

// 仅模拟后端事件和流式输出，不调用任何模型，也不进行真实识图或检索。
// 接入真实服务时，用后端事件替换这个 async generator，保留界面层不动。
const pause = (ms, signal) => new Promise((resolve, reject) => {
  if (signal?.aborted) return reject(new DOMException('Aborted', 'AbortError'));
  const timer = setTimeout(() => { signal?.removeEventListener('abort', abort); resolve(); }, ms);
  function abort() { clearTimeout(timer); reject(new DOMException('Aborted', 'AbortError')); }
  signal?.addEventListener('abort', abort, { once: true });
});

export async function* simulateAgent({ post, question, agentId, hasImage, signal }) {
  const agent = agents.find(a => a.id === agentId) || agents.find(a => a.tag === post.category) || agents[0];
  const steps = [
    { title: '整理问题与上下文', detail: '读取主贴与本次追问' },
    { title: hasImage ? '确认图片信息' : '匹配合适的 AI 搭子', detail: hasImage ? '演示图片处理状态，不生成识别结论' : `由${agent.name}回应你的问题` },
    { title: '组织回复与下一步', detail: '生成可继续追问的回复' },
  ];
  yield { type: 'run.started', agentId: agent.id, steps };
  for (let i = 0; i < steps.length; i++) {
    yield { type: 'step.started', index: i };
    await pause(430, signal);
    yield { type: 'step.completed', index: i };
  }
  let text;
  if (hasImage) {
    text = '我已经看到你附上了图片。在正式接入识图服务后，我会先列出图片中的可识别信息，让你确认，再结合问题回复。这一版是交互原型，还不能读取图片内容。你可以先用文字补充想了解的地方。';
  } else if (/胸痛|晕厥|呼吸困难|诊断|处方|药量/.test(question + post.title + post.body)) {
    text = '这个问题涉及身体症状或诊疗判断，超出了健康生活交流的范围。请向医疗专业人员寻求帮助，不要依据社区回复自行诊断或调整用药。这条回复是原型中的边界提示示例。';
  } else if (question) {
    const replies = {
      ran: '收到，我们就围绕你补充的情况继续调整。先选一个你愿意重复的小行动，再把它安排到方便的时间。你更希望我帮你拆分目标、比较活动，还是整理一份下次可以直接照着看的清单？正式版本会结合整段对话生成建议，这里展示的是模拟回复。',
      mai: '记下你的补充了。我们可以先整理口味、预算和实际能买到的食物，再从中挑容易执行的组合。你也可以上传餐食照片继续聊。正式版本会根据具体上下文回复，这里是模拟对话。',
      ye: '收到。先从你觉得最轻松的一步开始，不需要一下子把生活安排得很满。你愿意先告诉我，最想调整的是晚间安排、休息习惯，还是运动后的时间分配吗？这条是用于体验追问流程的模拟回复。',
    };
    text = replies[agent.id];
  } else {
    text = agent.id === 'ran'
      ? '欢迎来补给站！我可以和你一起把运动目标拆成更容易尝试的小行动。先聊聊你喜欢的活动、通常方便的时间，以及最容易卡住的地方。你可以直接在评论区补充，我会接着这条讨论继续回应。这是模拟回复，尚未连接真实模型。'
      : agent.id === 'mai'
        ? '我来陪你聊聊饮食安排。你更想解决选择困难、记录日常，还是结合运动安排吃饭时间？可以补充偏好、预算和忌口，我们再继续讨论。这是模拟回复，尚未连接真实模型。'
        : '看到你的帖子了。我们可以从你目前的日常安排入手，找到一个愿意坚持的小改变。你想先聊休息习惯，还是忙碌时如何给自己留一点缓冲？这是模拟回复，尚未连接真实模型。';
  }
  const reply = { id: `reply-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, agentId: agent.id, text: '', time: '刚刚', sources: false };
  yield { type: 'reply.started', reply };
  for (let i = 0; i < text.length; i += 4) {
    await pause(24, signal);
    yield { type: 'reply.delta', delta: text.slice(i, i + 4) };
  }
  yield { type: 'reply.completed' };
  yield { type: 'run.completed' };
}
