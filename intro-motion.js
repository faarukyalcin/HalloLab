/* DeutschAI intro: plays on each full page opening; no session/localStorage gate. */
(() => {
  'use strict';
  const overlay = document.getElementById('deutschai-intro');
  if (!overlay) return;
  const video = overlay.querySelector('video');
  const skip = overlay.querySelector('.intro-skip');
  const root = document.getElementById('view');
  let finished = false;
  let timeoutId;
  let observer;
  function markPanels() {
    if (!root) return;
    const nodes = root.querySelectorAll(
      '.top, .classroom-lead > .card, .study-metrics > .stat, ' +
      '.classroom > .card, .columns > .card, .dashboard .card, ' +
      '.learning-subject, .adaptive-ai-panel, .placement-card'
    );
    let n = 0;
    nodes.forEach(el => {
      if (el.classList.contains('panel-enter')) return;
      el.style.setProperty('--panel-delay', Math.min(n++ * 42, 240) + 'ms');
      el.classList.add('panel-enter');
    });
  }
  function finish() {
    if (finished) return;
    finished = true;
    clearTimeout(timeoutId);
    markPanels();
    document.body.classList.add('intro-finished');
    overlay.classList.add('is-leaving');
    video.pause();
    setTimeout(() => { overlay.remove(); }, 600);
  }
  video.addEventListener('ended', finish, {once:true});
  video.addEventListener('error', () => {
    if (video.dataset.selected === 'desktop') {
      video.dataset.selected = 'mobile';
      video.src = './deutschai-intro.mp4?v=2';
      video.load();
      video.play().catch(() => setTimeout(finish, 650));
    } else finish();
  });
  skip.addEventListener('click', finish);
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && !finished) finish();
  });
  if (root) {
    observer = new MutationObserver(() => {
      if (finished) markPanels();
    });
    observer.observe(root, {childList:true,subtree:true});
  }
  timeoutId = setTimeout(finish, 15000);
  video.muted = true;
  video.playsInline = true;
  async function start() {
    const mobile = matchMedia('(max-width: 767px)').matches;
    const desktopUrl = './deutschai-intro-desktop.mp4?v=1';
    let useDesktop = false;
    if (!mobile) {
      try {
        const response = await fetch(desktopUrl, { method:'HEAD' });
        useDesktop = response.ok && (response.headers.get('content-type') || '').includes('video');
      } catch (_) { /* Existing mobile video remains available as fallback. */ }
    }
    if (finished) return;
    video.dataset.selected = useDesktop ? 'desktop' : 'mobile';
    video.src = useDesktop ? desktopUrl : './deutschai-intro.mp4?v=2';
    video.load();
    const play = video.play();
    if (play && typeof play.catch === 'function') play.catch(() => setTimeout(finish, 650));
  }
  start();
})();
