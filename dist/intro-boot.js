/* Blocking, tiny first-paint gate. Keep this before the application module. */
(() => {
  const config = {
    brand: { title: '蓝调补给站', subtitle: 'BLUE HOUR CLUB', lines: ['不用一下子变好，', '向前一点就很好。'] },
    colors: { water: '#029EEB', paper: '#FFFFFF', ink: '#1D384A' },
    timing: { hold: 250, drain: 2500, messageFadeAt: 2850, messageFade: 500, revealAt: 3150, paperFade: 550, stagger: 140, enter: 650, complete: 4800, watchdog: 6500 },
    waves: { desktopHeight: 'clamp(64px, 9vh, 110px)', mobileHeight: 'clamp(40px, 9vh, 64px)', periods: [3, 5.5, 13, 20], delays: [-1.4, -3.1, -8.3, -15], offsets: [0, 5, 11, 17], opacity: [.2, .5, .7, 1] },
    once: true,
    storageKey: 'blue-hour-intro-v1',
    force: new URLSearchParams(location.search).get('intro') === '1',
    media: { poster: './tide.svg', breakpoint: 600, desktop: { intro: '', loop: '' }, mobile: { intro: '', loop: '' }, timeout: 4000, maxIntro: 15000 },
    onComplete: null,
    onSkip: null,
  };
  window.BlueHourIntroConfig = config;
  const root = document.documentElement;
  const home = ['', '#', '#/', '#/community'].includes(location.hash);
  let seen = false;
  try { seen = sessionStorage.getItem(config.storageKey) === '1'; } catch { /* Storage can be blocked. */ }
  const enabled = home && !matchMedia('(prefers-reduced-motion: reduce)').matches && (config.force || !config.once || !seen);
  let watchdog;
  const gate = window.BlueHourIntro = { enabled, finished: !enabled, cleanup: null, finish };
  function finish(reason = 'complete') {
    if (gate.finished) return;
    gate.finished = true;
    clearTimeout(watchdog);
    document.removeEventListener('keydown', onKey, true);
    document.removeEventListener('click', onClick, true);
    window.removeEventListener('pagehide', onPageHide);
    window.removeEventListener('resize', sizeCover);
    try { gate.cleanup?.(reason); } finally {
      gate.cleanup = null;
      root.classList.remove('intro-pending', 'intro-running', 'intro-revealing');
      root.classList.add('intro-settled');
      root.dataset.introState = 'complete';
      root.dataset.introResult = reason;
      document.getElementById('site-intro')?.remove();
      document.getElementById('intro-skip')?.remove();
      try { sessionStorage.setItem(config.storageKey, '1'); } catch { /* In-memory gate still prevents replay. */ }
      window.dispatchEvent(new CustomEvent('blue-hour:intro-complete', { detail: { reason } }));
      try { (reason === 'skip' ? config.onSkip : config.onComplete)?.({ reason }); } catch (error) { console.warn('Intro callback failed', error); }
    }
  }
  function onKey(event) {
    if (event.key === 'Escape') { event.preventDefault(); event.stopImmediatePropagation(); finish('skip'); }
    else if (event.key === 'Tab' && !root.classList.contains('intro-revealing')) { event.preventDefault(); event.stopImmediatePropagation(); document.getElementById('intro-skip')?.focus({ preventScroll: true }); }
  }
  function onClick(event) { if (event.target.closest?.('#intro-skip')) { event.preventDefault(); event.stopImmediatePropagation(); finish('skip'); } }
  function onPageHide() { finish('unload'); }
  // Keep the cover edge tied to the visual viewport, independently of the page scrollbar.
  function sizeCover() { root.style.setProperty('--intro-screen-width', `${innerWidth}px`); }
  if (enabled) {
    // Measure the platform scrollbar before body parsing; padding preserves content width
    // while the cover hides the scrollbar. Avoid scrollbar-gutter, which also changes vw units.
    const probe = document.createElement('div');
    probe.style.cssText = 'position:absolute;left:-9999px;width:100px;height:100px;overflow:scroll;visibility:hidden';
    root.append(probe);
    root.style.setProperty('--intro-gutter-width', `${probe.offsetWidth - probe.clientWidth}px`);
    probe.remove();
    sizeCover();
    window.addEventListener('resize', sizeCover);
    for (const [name, value] of Object.entries(config.colors)) root.style.setProperty(`--intro-${name}`, value);
    root.classList.add('intro-pending');
    root.dataset.introState = 'idle';
    document.addEventListener('keydown', onKey, true);
    document.addEventListener('click', onClick, true);
    window.addEventListener('pagehide', onPageHide);
    // Independent fail-open guard: even a failed application/module import cannot trap the page.
    watchdog = setTimeout(() => finish('timeout'), config.timing.watchdog);
  }
})();
