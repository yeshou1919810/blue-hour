import { createHeroMedia } from './hero-media.js';

const gate = window.BlueHourIntro;
const config = window.BlueHourIntroConfig;
const root = document.documentElement;
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
let media;
let hero;
let openingStarted = false;
let openingFrame = 0;
let release = () => {};
const lifecycle = new AbortController();
const { signal } = lifecycle;

function setupMedia() {
  const next = document.querySelector('.page-community .hero');
  if (next === hero) return;
  if (openingStarted && !gate.finished) gate.finish('route-change');
  media?.destroy(); hero = next;
  if (!hero) { media = null; return; }
  const particles = document.createElement('div');
  particles.className = 'hero-particles'; particles.setAttribute('aria-hidden', 'true');
  particles.innerHTML = '<i></i>'.repeat(6); hero.prepend(particles);
  media = createHeroMedia(hero, config.media);
  if (!gate.enabled || gate.finished) media.start();
}

function startOpening() {
  if (openingStarted || !gate.enabled || gate.finished || !hero) return;
  openingStarted = true;
  const { timing: t, waves, brand } = config;
  if (document.documentElement.scrollHeight <= innerHeight) root.style.setProperty('--intro-gutter-width', '0px');
  root.style.setProperty('--intro-wave-height', matchMedia('(max-width:600px)').matches ? waves.mobileHeight : waves.desktopHeight);
  const layer = document.createElement('section');
  layer.id = 'site-intro'; layer.className = 'site-intro'; layer.setAttribute('role', 'dialog');
  layer.setAttribute('aria-modal', 'true'); layer.setAttribute('aria-labelledby', 'intro-title');
  layer.innerHTML = '<div class="intro-paper"><div class="intro-message"><h2 id="intro-title"></h2><p class="intro-subtitle"></p><p class="intro-description"></p></div></div><div class="intro-water" aria-hidden="true"></div>';
  layer.querySelector('h2').textContent = brand.title;
  layer.querySelector('.intro-subtitle').textContent = brand.subtitle;
  brand.lines.slice(0, 3).forEach((line, index) => {
    const paragraph = layer.querySelector('.intro-description');
    if (index) paragraph.append(document.createElement('br'));
    paragraph.append(document.createTextNode(line));
  });
  const water = layer.querySelector('.intro-water');
  // Two exactly matching periods. SVG stretches with the viewport; half-width translation loops seamlessly.
  const curve = 'M0 50 C100 10 200 10 300 50 S500 90 600 50 S800 10 900 50 S1100 90 1200 50 S1400 10 1500 50 S1700 90 1800 50 S2000 10 2100 50 S2300 90 2400 50 V120 H0 Z';
  water.innerHTML = waves.periods.map((period, i) => `<svg class="intro-wave" viewBox="0 0 2400 100" preserveAspectRatio="none" style="--wave-offset:${waves.offsets[i]}px;--wave-opacity:${waves.opacity[i]};--wave-period:${period}s;--wave-delay:${waves.delays[i]}s"><path d="${curve}"/></svg>`).join('');
  document.body.append(layer);
  if (getComputedStyle(layer).position !== 'fixed') { gate.finish('style-error'); return; }
  root.classList.add('intro-running');
  const app = document.getElementById('app');
  const skip = document.getElementById('intro-skip');
  // The visible skip control must also belong to the modal in the accessibility tree.
  layer.append(skip);
  const previousFocus = document.activeElement;
  const previousInert = app.inert;
  app.inert = true;
  skip.focus({ preventScroll: true });
  let released = false;
  release = () => {
    if (released) return;
    released = true; app.inert = previousInert;
    root.classList.add('intro-revealing');
    layer.removeAttribute('aria-modal'); layer.removeAttribute('role'); layer.removeAttribute('aria-labelledby');
    layer.querySelector('.intro-paper').setAttribute('aria-hidden', 'true');
  };
  const animations = [];
  const staged = [];
  function animate(el, frames, options) {
    if (!el) return;
    const animation = el.animate(frames, { fill: 'both', ...options }); animations.push(animation);
  }
  gate.cleanup = reason => {
    cancelAnimationFrame(openingFrame); release();
    for (const animation of animations) animation.cancel();
    for (const item of staged) item.el.inert = item.inert;
    document.removeEventListener('keydown', trapFocus, true);
    if (reason !== 'complete') { media?.destroy(); if (reason === 'skip' && hero?.isConnected) { media = createHeroMedia(hero, config.media); media.start(); } }
    if (document.activeElement === skip && reason !== 'unload' && reason !== 'route-change') {
      const destination = previousFocus?.isConnected && previousFocus !== document.body ? previousFocus : document.getElementById('main-content');
      destination?.focus({ preventScroll: true });
    }
  };
  function trapFocus(event) { if (!released && event.key === 'Tab') { event.preventDefault(); event.stopImmediatePropagation(); skip.focus({ preventScroll: true }); } }
  document.addEventListener('keydown', trapFocus, true);
  animate(water, [{ transform: 'translate3d(0,0,0)' }, { transform: 'translate3d(0,calc(var(--intro-vh) + var(--intro-wave-height) + 4px),0)' }], { duration: t.drain, delay: t.hold, easing: 'cubic-bezier(0.03,0.1,0.25,1.02)' });
  animate(layer.querySelector('.intro-message'), [{ opacity: 1 }, { opacity: 0 }], { duration: t.messageFade, delay: t.messageFadeAt });
  animate(layer.querySelector('.intro-paper'), [{ opacity: 1 }, { opacity: 0 }], { duration: t.paperFade, delay: t.revealAt, easing: 'ease-in-out' });
  const groups = [
    '.hero-art, .hero-particles', '.brand, .hero-kicker', '.hero h2', '.hero-content > p', '.hero-button',
    '.side-nav, .topbar, .hero-explore, .hero-bottom',
  ];
  groups.forEach((selector, index) => document.querySelectorAll(selector).forEach(el => {
    const at = t.revealAt + index * t.stagger;
    staged.push({ el, at, inert: el.inert, released: false }); el.inert = true;
    animate(el, [{ opacity: 0, transform: `translateY(${index === 0 ? 8 : 14}px)` }, { opacity: 1, transform: 'translateY(0)' }],
      { duration: t.enter, delay: at, easing: 'cubic-bezier(.2,.7,.2,1)' });
  }));
  animate(hero.querySelector('.hero-art img'), [{ transform: 'scale(1.035) translateY(8px)' }, { transform: 'scale(1) translateY(0)' }], { duration: t.complete - t.revealAt, delay: t.revealAt, easing: 'ease-out' });
  const started = performance.now();
  gate.startedAt = started;
  let mediaStarted = false;
  function tick(now) {
    if (gate.finished) return;
    try {
      const elapsed = now - started;
      for (const item of staged) if (!item.released && elapsed >= item.at + 16) { item.el.inert = item.inert; item.released = true; }
      root.dataset.introState = elapsed < t.hold ? 'idle' : elapsed < t.hold + t.drain ? 'waveReveal' : elapsed < t.revealAt ? 'message' : 'exit';
      if (elapsed >= t.revealAt && !mediaStarted) { mediaStarted = true; media?.start({ playIntro: true }); }
      if (elapsed >= t.revealAt + t.paperFade * .65) release();
      if (elapsed >= t.complete) { gate.finish('complete'); return; }
      openingFrame = requestAnimationFrame(tick);
    } catch { gate.finish('error'); }
  }
  openingFrame = requestAnimationFrame(tick);
}

function renderReady() {
  try { setupMedia(); startOpening(); } catch { gate?.finish('error'); }
}
if (gate && config) {
  document.addEventListener('blue-hour:render', renderReady, { signal });
  reducedMotion.addEventListener('change', event => { if (event.matches) { gate.finish('reduced-motion'); media?.destroy(); } }, { signal });
  window.addEventListener('pagehide', () => { gate.finish('unload'); media?.destroy(); lifecycle.abort(); }, { once: true });
  renderReady();
}
