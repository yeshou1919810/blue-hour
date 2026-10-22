// 使用本机 Chrome 的 DevTools 协议检查原型；无第三方测试依赖。
// 先启动 npm run dev，再执行 node scripts/qa.mjs。
import { spawn } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import assert from 'node:assert/strict';

const root = fileURLToPath(new URL('../', import.meta.url));
const baseUrl = new URL(process.argv[2] || 'http://127.0.0.1:4173/').href;
const out = path.join(root, '.qa');
await mkdir(out, { recursive: true });
const chromePath = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const port = 19318;
const chrome = spawn(chromePath, ['--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check', '--disable-extensions', '--disable-background-networking', '--remote-debugging-address=127.0.0.1', `--remote-debugging-port=${port}`, `--user-data-dir=${path.join(out, 'chrome-profile')}`, 'about:blank'], { windowsHide: true, stdio: 'ignore' });
chrome.on('error', error => { console.error(error.message); process.exitCode = 1; });
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
let ws;
const pending = new Map();
const errors = [];
let nextId = 0;
const results = [];

async function until(check, message, timeout = 10000) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    try { if (await check()) return; }
    catch (error) {
      // Chrome replaces the execution context during reloads; retry only that transient state.
      if (!/Inspected target navigated|Cannot find context|Execution context was destroyed/.test(error.message)) throw error;
    }
    await delay(80);
  }
  throw new Error(`Timeout: ${message}`);
}
function send(method, params = {}) {
  return new Promise((resolve, reject) => {
    const id = ++nextId;
    const timer = setTimeout(() => { pending.delete(id); reject(new Error(`CDP timeout: ${method}`)); }, 10000);
    pending.set(id, { resolve: value => { clearTimeout(timer); resolve(value); }, reject });
    ws.send(JSON.stringify({ id, method, params }));
  });
}
async function evaluate(expression) {
  const result = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
  if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails));
  return result.result.value;
}
async function click(selector) {
  const point = await evaluate(`(() => { const el = document.querySelector(${JSON.stringify(selector)}); if(!el) throw new Error('Missing ${selector}'); el.scrollIntoView({block:'center', behavior:'instant'}); const r = el.getBoundingClientRect(); return {x:r.x+r.width/2,y:r.y+r.height/2}; })()`);
  await send('Input.dispatchMouseEvent', { type: 'mousePressed', ...point, button: 'left', clickCount: 1 });
  await send('Input.dispatchMouseEvent', { type: 'mouseReleased', ...point, button: 'left', clickCount: 1 });
}
async function fill(selector, value) {
  await evaluate(`(() => {const el=document.querySelector(${JSON.stringify(selector)}); el.value=${JSON.stringify(value)}; el.dispatchEvent(new Event('input',{bubbles:true}));})()`);
}
async function settled() { await until(() => evaluate(`!document.querySelector('#transition.play')`), 'route animation complete'); }
async function check(name, fn) { await fn(); results.push(name); console.log(`PASS ${name}`); }
async function screenshot(name) {
  await evaluate(`document.querySelector('#toast')?.classList.remove('visible')`);
  await evaluate('window.scrollTo(0,0)');
  await delay(500);
  const result = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
  await writeFile(path.join(out, name), Buffer.from(result.data, 'base64'));
}

try {
  await until(async () => { try { return (await fetch(`http://127.0.0.1:${port}/json/version`)).ok; } catch { return false; } }, 'Chrome startup');
  const target = await (await fetch(`http://127.0.0.1:${port}/json/new?about:blank`, { method: 'PUT' })).json();
  ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => { ws.addEventListener('open', resolve, { once: true }); ws.addEventListener('error', reject, { once: true }); });
  ws.addEventListener('message', event => {
    const message = JSON.parse(event.data);
    if (message.id) { const p = pending.get(message.id); if (p) { pending.delete(message.id); if (message.error) p.reject(new Error(JSON.stringify(message.error))); else p.resolve(message.result); } }
    if (message.method === 'Runtime.exceptionThrown') errors.push(message.params.exceptionDetails);
    if (message.method === 'Log.entryAdded' && message.params.entry.level === 'error') errors.push(message.params.entry);
  });
  await send('Page.enable'); await send('Runtime.enable'); await send('Log.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1050, deviceScaleFactor: 1, mobile: false });
  await send('Page.navigate', { url: baseUrl });
  await until(() => evaluate(`!!document.querySelector('.post-card')`), 'homepage');
  await until(() => evaluate(`!document.documentElement.classList.contains('intro-pending')`), 'opening finishes');
  await evaluate('localStorage.clear()');
  await send('Page.reload');
  await until(() => evaluate(`document.querySelectorAll('.post-card').length===4`), 'clean demo state');
  await screenshot('preview-community.png');

  await check('desktop layout at 1440 px', async () => {
    assert.equal(await evaluate('document.documentElement.scrollWidth <= innerWidth'), true);
    assert.equal(await evaluate(`document.querySelectorAll('.agent-row').length`), 3);
  });
  await check('topic filters and keyword search', async () => {
    await click('[data-filter="运动训练"]'); assert.equal(await evaluate(`document.querySelectorAll('.post-card').length`), 2);
    await click('[data-filter="全部"]'); await fill('#search', '食堂'); assert.equal(await evaluate(`document.querySelectorAll('.post-card').length`), 1);
    await fill('#search', '没有匹配的关键词'); assert.equal(await evaluate(`!!document.querySelector('.empty')`), true);
    await click('[data-reset-search]'); assert.equal(await evaluate(`document.querySelectorAll('.post-card').length`), 4);
  });
  await check('like, save, saved page and empty state', async () => {
    await click('[data-like="running"]'); assert.equal(await evaluate(`document.querySelector('[data-like="running"]').getAttribute('aria-pressed')`), 'true');
    await click('[data-save="running"]'); await click('.side-nav [data-route="saved"]'); await settled();
    assert.equal(await evaluate(`document.querySelectorAll('.post-card').length`), 1);
    await click('[data-save="running"]'); assert.equal(await evaluate(`!!document.querySelector('.empty')`), true);
    await click('.side-nav [data-route="community"]'); await settled();
  });
  await check('post detail and safe context follow-up', async () => {
    await click('.post-title[data-post="running"]'); await settled();
    assert.equal(await evaluate(`document.querySelectorAll('.reply-card').length`), 2);
    await screenshot('preview-discussion.png');
    await click('[data-reply="run-b"]');
    assert.equal(await evaluate(`document.querySelector('.replying-to').textContent.includes('夜航')`), true);
    await fill('#followup-text', '我想安排在周末。<script>window.unexpected = true</script>');
    await click('#followup-form button[type="submit"]');
    await until(() => evaluate(`document.querySelector('.monitor-state')?.textContent.includes('本次回复已完成')`), 'complete streamed reply');
    assert.equal(await evaluate(`document.querySelectorAll('.reply-card').length`), 4);
    assert.equal(await evaluate(`window.unexpected === undefined`), true);
    assert.equal(await evaluate(`document.querySelector('.reply-card:last-child .reply-head strong').textContent`), '夜航');
  });
  await check('stop a streaming reply and recover composer', async () => {
    await fill('#followup-text', '再继续聊聊'); await click('#followup-form button[type="submit"]');
    await until(() => evaluate(`!!document.querySelector('.streaming')`), 'stream starts');
    await click('[data-stop]');
    assert.equal(await evaluate(`!!document.querySelector('.streaming')`), false);
    assert.equal(await evaluate(`document.querySelector('#followup-text').disabled`), false);
    assert.equal(await evaluate(`document.querySelector('.monitor-state').textContent.includes('已停止')`), true);
  });
  await check('new post with image preview and simulated image boundary', async () => {
    await click('.side-nav [data-route="community"]'); await settled();
    await click('[data-compose]');
    await fill('#post-title', '这是我想讨论的运动计划'); await fill('#post-body', '想从自己喜欢的活动开始，附一张图片来测试发帖流程。');
    const documentNode = await send('DOM.getDocument');
    const inputNode = await send('DOM.querySelector', { nodeId: documentNode.root.nodeId, selector: '#post-image' });
    await send('DOM.setFileInputFiles', { nodeId: inputNode.nodeId, files: [path.join(out, 'preview-community.png')] });
    await until(() => evaluate(`!!document.querySelector('#composer-preview img')`), 'image preview');
    await click('#composer-form button[type="submit"]');
    await until(() => evaluate(`document.querySelector('.monitor-state')?.textContent.includes('本次回复已完成')`), 'new-post AI reply');
    assert.equal(await evaluate(`document.querySelector('.detail-post h1').textContent`), '这是我想讨论的运动计划');
    assert.equal(await evaluate(`document.querySelector('.reply-text').textContent.includes('还不能读取图片内容')`), true);
    assert.equal(await evaluate(`!!document.querySelector('.detail-post img')`), true);
  });
  await check('goal checklist and persistence after reload', async () => {
    await click('.side-nav [data-route="rhythm"]'); await settled();
    await click('.rhythm-goal [data-goal="walk"]');
    assert.equal(await evaluate(`document.querySelector('.rhythm-goal [data-goal="walk"]').getAttribute('aria-pressed')`), 'true');
    await send('Page.reload'); await until(() => evaluate(`!!document.querySelector('.week-strip')`), 'reload rhythm');
    assert.equal(await evaluate(`document.querySelector('.rhythm-goal [data-goal="walk"]').getAttribute('aria-pressed')`), 'true');
    await click('.side-nav [data-route="mine"]'); await settled(); assert.equal(await evaluate(`document.querySelectorAll('.post-card').length`), 2);
  });
  await check('browser history and reduced motion at 1280 px', async () => {
    await evaluate('history.back()'); await until(() => evaluate(`!!document.querySelector('.week-strip')`), 'back navigation');
    await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });
    await click('.side-nav [data-route="community"]');
    assert.equal(await evaluate(`!!document.querySelector('#transition.play')`), false);
    await send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 900, deviceScaleFactor: 1, mobile: false });
    assert.equal(await evaluate('document.documentElement.scrollWidth <= innerWidth'), true);
  });
  // The following checks use the isolated QA browser profile, never the user's browser storage.
  await evaluate('localStorage.clear()');
  await send('Page.reload');
  await until(() => evaluate(`document.querySelectorAll('.post-card').length === 4`), 'reset isolated visual fixtures');
  await send('Emulation.setEmulatedMedia', { features: [] });

  async function go(route) {
    if (await evaluate(`matchMedia('(max-width:900px)').matches`)) {
      await click('#menu-toggle');
      await delay(400);
      assert.equal(await evaluate(`document.body.classList.contains('nav-open')`), true, 'mobile menu opens before route selection');
    }
    await click(`.side-nav [data-route="${route}"]`);
    await until(() => evaluate(`location.hash === '#/${route}'`), `route ${route}`);
    await settled();
  }
  async function key(key, code, modifiers = 0) {
    const windowsVirtualKeyCode = { Tab: 9, Escape: 27, ArrowLeft: 37, ArrowRight: 39, Home: 36, End: 35 }[key] || 0;
    await send('Input.dispatchKeyEvent', { type: 'keyDown', key, code, modifiers, windowsVirtualKeyCode });
    await send('Input.dispatchKeyEvent', { type: 'keyUp', key, code, modifiers, windowsVirtualKeyCode });
  }
  async function layout(label) {
    const widths = await evaluate(`({document:document.documentElement.scrollWidth, viewport:innerWidth})`);
    assert.ok(widths.document <= widths.viewport, `${label} horizontal overflow: ${JSON.stringify(widths)}`);
    const overflow = await evaluate(`Array.from(document.querySelectorAll('.post-title,.reply-text,.detail-body,.detail-post h1,.hero h2,.goal-title,.dialog-header h2')).filter(el => el.getClientRects().length && el.scrollWidth > el.clientWidth + 2).map(el => ({tag:el.className,text:el.textContent.slice(0,45)}))`);
    assert.deepEqual(overflow, [], `${label} clipped text`);
    assert.equal(await evaluate(`Array.from(document.images).every(img=>img.complete && img.naturalWidth>0)`), true, `${label} images loaded`);
  }

  for (const width of [1440, 1024, 768, 390]) {
    await check(`all pages and composer at ${width} px`, async () => {
      await send('Emulation.setDeviceMetricsOverride', { width, height: width === 390 ? 844 : 1000, deviceScaleFactor: 1, mobile: false });
      await delay(450);
      await go('community');
      await layout(`community ${width}`);
      await screenshot(`p3r-community-${width}.png`);
      await click('[data-scroll-feed]');
      await until(() => evaluate(`Math.abs(document.querySelector('#community-feed').getBoundingClientRect().top) < 5`), 'feed entry scroll');
      await click('.post-title[data-post="running"]'); await settled();
      await layout(`discussion ${width}`);
      await screenshot(`p3r-discussion-${width}.png`);
      for (const route of ['saved', 'mine', 'rhythm']) {
        await go(route); await layout(`${route} ${width}`);
        await screenshot(`p3r-${route}-${width}.png`);
      }
      await click('[data-compose]');
      await until(() => evaluate(`document.querySelector('#composer').open`), 'composer opens');
      await delay(400);
      assert.equal(await evaluate(`document.querySelector('#composer').scrollWidth <= document.querySelector('#composer').clientWidth`), true, 'dialog width');
      await layout(`composer ${width}`);
      await screenshot(`p3r-composer-${width}.png`);
      await key('Tab', 'Tab');
      assert.equal(await evaluate(`document.querySelector('#composer').contains(document.activeElement)`), true, 'modal focus stays inside');
      await key('Escape', 'Escape');
      await until(() => evaluate(`!document.querySelector('#composer').open`), 'Esc closes modal');
    });
  }

  await check('mobile drawer focus, Esc, large controls and persistent navigation', async () => {
    await go('community');
    assert.equal(await evaluate(`document.querySelector('#site-navigation').inert`), true);
    await click('#menu-toggle'); await delay(400);
    assert.equal(await evaluate(`document.querySelector('#site-navigation').contains(document.activeElement)`), true);
    await evaluate(`Array.from(document.querySelector('#site-navigation').querySelectorAll('a[href],button:not(:disabled)')).filter(el=>el.getClientRects().length).at(-1).focus()`);
    await key('Tab', 'Tab');
    assert.equal(await evaluate(`document.activeElement.classList.contains('mobile-nav-close')`), true);
    await key('Escape', 'Escape');
    assert.equal(await evaluate(`document.activeElement.id`), 'menu-toggle');
    assert.equal(await evaluate(`document.body.classList.contains('nav-open')`), false);
    assert.equal(await evaluate(`Array.from(document.querySelectorAll('.hero-button,.hero-explore,.filter')).every(el=>el.getBoundingClientRect().height>=44)`), true);
    await click('.post-title[data-post="running"]'); await settled();
    await fill('#followup-text', '想从简单的小目标开始');
    await click('#followup-form button[type="submit"]');
    await until(() => evaluate(`!!document.querySelector('.streaming')`), 'mobile streamed reply');
    await click('.run-feedback [data-stop]');
    assert.equal(await evaluate(`document.querySelector('#followup-text').disabled`), false);
  });

  await check('upload errors remain visible inside the dialog and form validation works', async () => {
    await go('community'); await click('[data-compose]'); await delay(400);
    const doc = await send('DOM.getDocument');
    const upload = await send('DOM.querySelector', { nodeId: doc.root.nodeId, selector: '#post-image' });
    await send('DOM.setFileInputFiles', { nodeId: upload.nodeId, files: [path.join(root, 'dist/favicon.svg')] });
    await until(() => evaluate(`document.querySelector('#composer-error').textContent.includes('请选择')`), 'unsupported image alert');
    assert.equal(await evaluate(`document.querySelector('#composer-error').getAttribute('role')`), 'alert');
    await fill('#post-title', '   '); await fill('#post-body', '验证表单');
    await click('#composer-form button[type="submit"]');
    assert.equal(await evaluate(`document.querySelector('#composer-error').textContent.includes('至少')`), true);
    await key('Escape', 'Escape');
    await until(() => evaluate(`!document.querySelector('#composer').open`), 'Esc closes error dialog');
  });

  await check('keyboard tabs, focus visibility and reduced-motion behavior', async () => {
    await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false });
    await go('community');
    await evaluate(`document.querySelector('[role="tab"][aria-selected="true"]').focus()`);
    await key('ArrowRight', 'ArrowRight');
    assert.equal(await evaluate(`document.activeElement.dataset.tab`), '热门');
    assert.equal(await evaluate(`document.activeElement.getAttribute('aria-selected')`), 'true');
    assert.equal(await evaluate(`getComputedStyle(document.activeElement).outlineStyle`), 'solid');
    await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });
    await go('rhythm'); await go('community');
    assert.equal(await evaluate(`getComputedStyle(document.querySelector('.hero-art')).animationName`), 'none');
    assert.equal(await evaluate(`getComputedStyle(document.querySelector('.hero h2')).opacity`), '1');
    assert.equal(await evaluate(`!!document.querySelector('#transition.play')`), false);
  });
  await check('no browser runtime or resource errors', async () => { assert.deepEqual(errors, []); });
  await writeFile(path.join(out, 'qa-results.json'), JSON.stringify({ baseUrl, passed: results, browserErrors: errors, verifiedAt: new Date().toISOString() }, null, 2));
  console.log(`Screenshots and results: ${out}`);
} catch (error) {
  console.error('Browser errors:', JSON.stringify(errors));
  if (ws?.readyState === WebSocket.OPEN) {
    console.error('Page:', await evaluate('({url:location.href,body:document.body.innerText.slice(0,1000)})').catch(() => null));
    await screenshot('qa-failure.png').catch(() => {});
  }
  throw error;
} finally {
  if (ws?.readyState === WebSocket.OPEN) { try { await send('Browser.close'); } catch {} ws.close(); }
  if (chrome.exitCode === null) chrome.kill();
}
