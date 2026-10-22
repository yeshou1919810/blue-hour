/** Optional intro → loop video controller. The original SVG poster is always underneath. */
export function createHeroMedia(hero, config) {
  const controller = new AbortController();
  const { signal } = controller;
  const timers = new Set();
  const frameRequests = new Map();
  const videos = [];
  let started = false;
  let shade;
  const poster = hero.querySelector('.hero-art img');
  const originalPoster = poster?.getAttribute('src');
  if (poster && config.poster && config.poster !== originalPoster) {
    poster.addEventListener('error', () => { poster.src = originalPoster; }, { once: true, signal });
    poster.src = config.poster;
  }
  const selected = matchMedia(`(max-width:${config.breakpoint}px)`).matches ? config.mobile : config.desktop;
  const sources = selected || {};
  function timer(callback, ms) { const id = setTimeout(() => { timers.delete(id); callback(); }, ms); timers.add(id); return id; }
  function clear(id) { clearTimeout(id); timers.delete(id); }
  function video(src, loop = false) {
    if (!src) return null;
    const el = document.createElement('video');
    el.className = 'hero-video'; el.muted = true; el.defaultMuted = true; el.playsInline = true; el.loop = loop;
    el.setAttribute('aria-hidden', 'true'); el.setAttribute('playsinline', ''); el.preload = 'auto'; el.src = src;
    hero.querySelector('.hero-art').append(el); videos.push(el);
    el.addEventListener('error', () => { el.classList.remove('is-visible'); }, { signal });
    return el;
  }
  async function show(el) {
    if (!el || signal.aborted) return false;
    let timeout;
    try {
      const ready = new Promise((resolve, reject) => {
        signal.addEventListener('abort', () => reject(new Error('aborted')), { once: true });
        el.addEventListener('error', () => reject(new Error('media error')), { once: true, signal });
        el.play().then(() => {
          if (signal.aborted) return reject(new Error('aborted'));
          if ('requestVideoFrameCallback' in el) frameRequests.set(el, el.requestVideoFrameCallback(() => { frameRequests.delete(el); resolve(); }));
          else if (el.readyState >= 2) resolve();
          else el.addEventListener('loadeddata', resolve, { once: true, signal });
        }, reject);
      });
      await Promise.race([ready, new Promise((_, reject) => { timeout = timer(() => reject(new Error('media timeout')), config.timeout); })]);
      if (signal.aborted) return false;
      el.classList.add('is-visible');
      return true;
    } catch { el.pause(); el.classList.remove('is-visible'); return false; }
    finally {
      clear(timeout);
      if (frameRequests.has(el)) { el.cancelVideoFrameCallback(frameRequests.get(el)); frameRequests.delete(el); }
    }
  }
  async function start({ playIntro = false } = {}) {
    if (started || signal.aborted || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    started = true;
    if (!sources.intro && !sources.loop) return;
    shade = document.createElement('div'); shade.className = 'hero-video-shade'; shade.setAttribute('aria-hidden', 'true');
    hero.querySelector('.hero-art').append(shade);
    const opening = playIntro ? video(sources.intro) : null;
    const looping = video(sources.loop, true);
    if (!opening || !await show(opening)) { await show(looping); return; }
    // Keep the last intro frame until the loop has delivered a decoded frame.
    let switched = false;
    const switchToLoop = async () => {
      if (switched || signal.aborted) return;
      switched = true;
      await show(looping);
      opening.classList.remove('is-visible'); // decoded loop or static poster fallback
      opening.pause();
    };
    opening.addEventListener('ended', switchToLoop, { once: true, signal });
    timer(switchToLoop, config.maxIntro);
  }
  return { start, destroy() {
    controller.abort(); for (const id of timers) clearTimeout(id); timers.clear();
    for (const [el, id] of frameRequests) el.cancelVideoFrameCallback(id); frameRequests.clear();
    for (const el of videos) { el.pause(); el.removeAttribute('src'); el.load(); el.remove(); }
    shade?.remove();
  } };
}
