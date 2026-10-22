// Real Chrome / CDP opening tests. No extra packages or production test hooks.
import { spawn } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import assert from 'node:assert/strict';

const root = fileURLToPath(new URL('../', import.meta.url));
const out = path.join(root, '.qa', 'intro');
await mkdir(out, { recursive: true });
const base = process.argv[2] || 'http://127.0.0.1:4173/';
const replay = new URL('?intro=1', base).href;
const port = 19319;
const chrome = spawn('C:/Program Files/Google/Chrome/Application/chrome.exe', ['--headless=new', '--disable-gpu', '--no-first-run', '--disable-extensions', '--disable-background-networking', `--remote-debugging-port=${port}`, `--user-data-dir=${path.join(out, 'profile')}`, 'about:blank'], { windowsHide: true, stdio: 'ignore' });
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
let ws, sequence = 0;
const pending = new Map();
const errors = [];
const passed = [];
const recording = [];
let recordingOn = false;
function send(method, params = {}) {
  return new Promise((resolve, reject) => {
    const id = ++sequence;
    const timer = setTimeout(() => { pending.delete(id); reject(new Error(`CDP timeout: ${method}`)); }, 12000);
    pending.set(id, { resolve: value => { clearTimeout(timer); resolve(value); }, reject: error => { clearTimeout(timer); reject(error); } });
    ws.send(JSON.stringify({ id, method, params }));
  });
}
async function evaluate(expression) {
  const result = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
  if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails));
  return result.result.value;
}
async function until(check, label, timeout = 10000) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    try { if (await check()) return; } catch (error) { if (!/context|navigated/.test(error.message)) throw error; }
    await delay(25);
  }
  throw new Error(`Timeout: ${label}`);
}
async function screenshot(name) {
  const frame = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
  await writeFile(path.join(out, `${name}.png`), Buffer.from(frame.data, 'base64'));
}
async function navigate(url = replay) {
  await send('Page.navigate', { url });
  await until(() => evaluate(`!!window.BlueHourIntro && !!document.querySelector('.page-community')`), 'page ready');
}
async function at(ms) { await until(() => evaluate(`performance.now() - (window.BlueHourIntro.startedAt || performance.now()) >= ${ms}`), `opening ${ms}ms`); }
async function complete() { await until(() => evaluate(`!document.documentElement.classList.contains('intro-pending')`), 'opening complete'); }
async function finalState() {
  assert.equal(await evaluate(`!!document.querySelector('#site-intro')`), false);
  assert.equal(await evaluate(`document.querySelector('#app').inert`), false);
  assert.equal(await evaluate(`getComputedStyle(document.documentElement).overflowY === 'hidden'`), false);
  assert.equal(await evaluate(`Array.from(document.querySelectorAll('.hero h2,.hero-button,.side-nav,.topbar')).every(el => +getComputedStyle(el).opacity === 1)`), true);
  assert.equal(await evaluate(`document.documentElement.scrollWidth <= innerWidth`), true);
  assert.equal(await evaluate(`document.getAnimations().some(a => a.animationName === 'intro-flow')`), false);
}
async function click(selector) {
  const point = await evaluate(`(() => {const el=document.querySelector(${JSON.stringify(selector)}); const r=el.getBoundingClientRect(); return {x:r.x+r.width/2,y:r.y+r.height/2};})()`);
  await send('Input.dispatchMouseEvent', { type: 'mousePressed', ...point, button: 'left', clickCount: 1 });
  await send('Input.dispatchMouseEvent', { type: 'mouseReleased', ...point, button: 'left', clickCount: 1 });
}
async function key(key) {
  const windowsVirtualKeyCode = key === 'Escape' ? 27 : 9;
  await send('Input.dispatchKeyEvent', { type: 'keyDown', key, code: key, windowsVirtualKeyCode });
  await send('Input.dispatchKeyEvent', { type: 'keyUp', key, code: key, windowsVirtualKeyCode });
}
async function check(name, fn) { await fn(); passed.push(name); console.log(`PASS ${name}`); }
async function viewport(width, height) { await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: false }); }

try {
  await until(async () => { try { return (await fetch(`http://127.0.0.1:${port}/json/version`)).ok; } catch { return false; } }, 'Chrome');
  const target = await (await fetch(`http://127.0.0.1:${port}/json/new?about:blank`, { method: 'PUT' })).json();
  ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise(resolve => ws.addEventListener('open', resolve, { once: true }));
  ws.addEventListener('message', event => {
    const message = JSON.parse(event.data);
    if (message.id) {
      const call = pending.get(message.id);
      if (call) { pending.delete(message.id); message.error ? call.reject(new Error(JSON.stringify(message.error))) : call.resolve(message.result); }
    }
    if (message.method === 'Runtime.exceptionThrown') errors.push(message.params.exceptionDetails);
    if (message.method === 'Page.screencastFrame') {
      if (recordingOn) recording.push({ time: message.params.metadata.timestamp, data: message.params.data });
      send('Page.screencastFrameAck', { sessionId: message.params.sessionId }).catch(() => {});
    }
  });
  await send('Page.enable'); await send('Runtime.enable'); await send('Network.enable');
  await viewport(1440, 1000);
  await navigate(); await complete();
  await evaluate(`sessionStorage.removeItem('blue-hour-intro-v1')`);

  await check('first visit: blue → four flowing waves → white message → staggered homepage', async () => {
    await send('Page.startScreencast', { format: 'jpeg', quality: 75, maxWidth: 1280, maxHeight: 900, everyNthFrame: 2 });
    await navigate(base);
    recordingOn = true;
    await until(() => evaluate(`!!window.BlueHourIntro.startedAt`), 'timeline starts');
    const heroBounds = await evaluate(`({x:document.querySelector('.hero').getBoundingClientRect().x,width:document.querySelector('.hero').getBoundingClientRect().width})`);
    assert.equal(await evaluate(`getComputedStyle(document.querySelector('.intro-water'),'::after').backgroundColor`), 'rgb(2, 158, 235)');
    assert.equal(await evaluate(`document.querySelector('#site-intro').getBoundingClientRect().right >= innerWidth`), true, 'cover includes scrollbar gutter');
    assert.equal(await evaluate(`document.documentElement.clientWidth === innerWidth`), true, 'no reserved gutter clips overlay painting');
    await screenshot('01-blue');
    await key('Tab'); assert.equal(await evaluate('document.activeElement.id'), 'intro-skip');
    assert.equal(await evaluate(`!!document.querySelector('[role="dialog"] #intro-skip')`), true);
    await at(700); await screenshot('02-receding');
    const first = await evaluate(`({y:document.querySelector('.intro-water').getBoundingClientRect().y, waves:[...document.querySelectorAll('.intro-wave')].map(el=>getComputedStyle(el).transform)})`);
    assert.equal(new Set(first.waves).size, 4);
    await at(1600); await screenshot('03-message-revealed');
    const second = await evaluate(`({y:document.querySelector('.intro-water').getBoundingClientRect().y, waves:[...document.querySelectorAll('.intro-wave')].map(el=>getComputedStyle(el).transform)})`);
    assert.ok(second.y > first.y); assert.notDeepEqual(first.waves, second.waves);
    await at(2770); await screenshot('04-white-message');
    assert.equal(await evaluate(`document.querySelector('.intro-water').getBoundingClientRect().top > innerHeight`), true);
    await at(3250); await screenshot('05-unveil');
    await at(3950); await screenshot('06-hero');
    assert.equal(await evaluate(`+getComputedStyle(document.querySelector('.hero h2')).opacity > +getComputedStyle(document.querySelector('.side-nav')).opacity`), true);
    await complete(); await finalState(); await screenshot('07-complete');
    assert.deepEqual(await evaluate(`({x:document.querySelector('.hero').getBoundingClientRect().x,width:document.querySelector('.hero').getBoundingClientRect().width})`), heroBounds, 'scroll restoration does not shift homepage layout');
    recordingOn = false; await send('Page.stopScreencast');
  });
  await check('same-tab reload and internal navigation do not replay', async () => {
    await navigate(base); assert.equal(await evaluate('window.BlueHourIntro.enabled'), false);
    await evaluate(`document.querySelector('[data-route="rhythm"]').click()`);
    await until(() => evaluate(`!!document.querySelector('.page-rhythm') && !document.querySelector('#transition.play')`), 'rhythm route');
    await evaluate(`document.querySelector('[data-route="community"]').click()`);
    await until(() => evaluate(`!!document.querySelector('.hero') && !document.querySelector('#transition.play')`), 'home route');
    assert.equal(await evaluate(`!!document.querySelector('#site-intro')`), false);
  });
  for (const time of [50, 1100, 2900, 3350, 4200]) {
    await check(`skip at ${time}ms leaves complete usable homepage`, async () => {
      await navigate(); await at(time); await click('#intro-skip'); await complete(); await finalState();
      await evaluate(`document.querySelector('.hero-button').click()`);
      assert.equal(await evaluate(`document.querySelector('#composer').open`), true);
      await key('Escape'); await until(() => evaluate(`!document.querySelector('#composer').open`), 'modal Esc');
    });
  }
  await check('Escape skips and session storage denial is safe', async () => {
    const injection = await send('Page.addScriptToEvaluateOnNewDocument', { source: `const get=Storage.prototype.getItem,set=Storage.prototype.setItem;Storage.prototype.getItem=function(k){if(this===sessionStorage)throw Error('blocked');return get.call(this,k)};Storage.prototype.setItem=function(k,v){if(this===sessionStorage)throw Error('blocked');return set.call(this,k,v)};` });
    await navigate(); await at(300); await key('Escape'); await complete(); await finalState();
    await send('Page.removeScriptToEvaluateOnNewDocument', { identifier: injection.identifier });
  });
  for (const [width, height] of [[390,844],[844,390],[2560,1080]]) {
    await check(`wave coverage and reveal at ${width}×${height}`, async () => {
      await viewport(width, height); await navigate(); await at(1100); await screenshot(`wave-${width}`);
      assert.equal(await evaluate(`document.documentElement.scrollWidth <= innerWidth`), true);
      assert.equal(await evaluate(`document.querySelector('#site-intro').getBoundingClientRect().right >= innerWidth`), true);
      await at(2770); assert.equal(await evaluate(`document.querySelector('.intro-water').getBoundingClientRect().top > innerHeight`), true);
      await complete(); await finalState(); await screenshot(`home-${width}`);
    });
  }
  await check('viewport resize during drain still clears every wave', async () => {
    await viewport(390,844); await navigate(); await at(700); await viewport(844,390);
    await at(2780); assert.equal(await evaluate(`document.querySelector('.intro-water').getBoundingClientRect().top > innerHeight`), true);
    await complete(); await finalState();
  });
  await check('reduced motion bypasses forced intro', async () => {
    await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });
    await navigate(); assert.equal(await evaluate('window.BlueHourIntro.enabled'), false); await finalState();
    await send('Emulation.setEmulatedMedia', { features: [] });
  });
  await check('mid-animation reduced-motion change cleans up immediately', async () => {
    await navigate(); await at(700);
    await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });
    await complete(); await finalState();
    await send('Emulation.setEmulatedMedia', { features: [] });
  });
  await check('failed opening module fails open through watchdog', async () => {
    await send('Network.setBlockedURLs', { urls: ['*/intro.js'] });
    await navigate(); await complete(); await finalState();
    assert.equal(await evaluate('document.documentElement.dataset.introResult'), 'timeout');
    await send('Network.setBlockedURLs', { urls: [] });
  });
  await check('failed app import still exposes static homepage', async () => {
    await send('Network.setBlockedURLs', { urls: ['*/app.js'] });
    await send('Page.navigate', { url: replay });
    await until(() => evaluate(`!!document.querySelector('.fallback-home')`), 'static fallback');
    await complete();
    assert.equal(await evaluate(`document.querySelector('.fallback-home').innerText.includes('蓝调补给站')`), true);
    await screenshot('fallback-app'); await send('Network.setBlockedURLs', { urls: [] });
  });
  await check('JavaScript disabled retains readable static homepage', async () => {
    await send('Emulation.setScriptExecutionDisabled', { value: true });
    await send('Page.navigate', { url: base }); await delay(800); await screenshot('fallback-no-script');
    await send('Emulation.setScriptExecutionDisabled', { value: false });
    assert.equal(await evaluate(`!!document.querySelector('.fallback-home') && !document.querySelector('#site-intro') && !document.documentElement.classList.contains('intro-pending')`), true);
  });
  await check('video intro → decoded loop frame, autoplay denial and timeout fallback', async () => {
    await viewport(1440,1000); await navigate(base); await complete();
    const result = await evaluate(`(async()=>{
      const {createHeroMedia}=await import('./hero-media.js');
      const canvas=document.createElement('canvas');canvas.width=64;canvas.height=64;
      const ctx=canvas.getContext('2d');const stream=canvas.captureStream(12);const chunks=[];
      const recorder=new MediaRecorder(stream,{mimeType:'video/webm'});
      recorder.ondataavailable=e=>chunks.push(e.data);
      const stopped=new Promise(resolve=>recorder.onstop=resolve);recorder.start();
      const draw=setInterval(()=>{ctx.fillStyle='#029EEB';ctx.fillRect(0,0,64,64)},50);
      await new Promise(r=>setTimeout(r,600));recorder.stop();await stopped;clearInterval(draw);stream.getTracks().forEach(t=>t.stop());
      const url=URL.createObjectURL(new Blob(chunks,{type:'video/webm'}));
      const config={...window.BlueHourIntroConfig.media,desktop:{intro:url,loop:url},timeout:700,maxIntro:1200};
      const h=document.querySelector('.hero');let media=createHeroMedia(h,config);await media.start({playIntro:true});
      await new Promise(r=>setTimeout(r,1600));const loop=!!h.querySelector('video[aria-hidden].is-visible') && [...h.querySelectorAll('video')].some(v=>v.loop&&v.classList.contains('is-visible'));
      media.destroy();
      const play=HTMLMediaElement.prototype.play;HTMLMediaElement.prototype.play=()=>Promise.reject(new DOMException('blocked','NotAllowedError'));
      media=createHeroMedia(h,config);await media.start({playIntro:true});const denied=!h.querySelector('video.is-visible');media.destroy();
      HTMLMediaElement.prototype.play=()=>new Promise(()=>{});
      media=createHeroMedia(h,{...config,timeout:80});await media.start({playIntro:true});const timeout=!h.querySelector('video.is-visible');media.destroy();
      HTMLMediaElement.prototype.play=play;
      const bad=URL.createObjectURL(new Blob(['not a video'],{type:'video/webm'}));
      media=createHeroMedia(h,{...config,desktop:{intro:bad,loop:bad}});await media.start({playIntro:true});const failed=!h.querySelector('video.is-visible');media.destroy();
      URL.revokeObjectURL(url);URL.revokeObjectURL(bad);
      return {loop,denied,timeout,failed,poster:h.querySelector('.hero-art img').naturalWidth>0,clean:!h.querySelector('video')};
    })()`);
    assert.deepEqual(result, { loop: true, denied: true, timeout: true, failed: true, poster: true, clean: true });
  });
  assert.deepEqual(errors, []);
  await writeFile(path.join(out, 'results.json'), JSON.stringify({ baseUrl: base, passed, errors, verifiedAt: new Date().toISOString() }, null, 2));
  // Reviewable playback of frames captured from the real browser, with actual timestamps.
  if (recording.length) await writeFile(path.join(out, 'playback.html'), `<!doctype html><meta charset="utf-8"><title>蓝调补给站 · 实际开场录帧</title><style>body{margin:0;background:#031126;color:white;font:16px sans-serif;text-align:center}img{display:block;max-width:100%;max-height:85vh;margin:auto}button{padding:12px 24px;margin:16px}</style><button id="play">重新播放实际录帧</button><span>来自 Chrome 的截图帧，非模拟动画</span><img id="frame"><script>const frames=${JSON.stringify(recording)};const image=document.querySelector('#frame');let raf;function play(){cancelAnimationFrame(raf);const start=performance.now();function tick(now){const elapsed=(now-start)/1000;const f=frames.findLast(f=>f.time-frames[0].time<=elapsed)||frames[0];image.src='data:image/jpeg;base64,'+f.data;if(elapsed<frames.at(-1).time-frames[0].time)raf=requestAnimationFrame(tick)}raf=requestAnimationFrame(tick)}document.querySelector('#play').onclick=play;play();</script>`);
  console.log(`Opening screenshots, captured playback and results: ${out}`);
} catch (error) {
  await screenshot('failure').catch(() => {}); throw error;
} finally {
  if (ws?.readyState === WebSocket.OPEN) { try { await send('Browser.close'); } catch {} ws.close(); }
  if (chrome.exitCode === null) chrome.kill();
}
