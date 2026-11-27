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
      el.style.setProperty('--panel-delay', Math.min(n++ * 65, 450) + 'ms');
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
    setTimeout(() => { overlay.remove(); }, 900);
  }
  video.addEventListener('ended', finish, {once:true});
  video.addEventListener('error', finish, {once:true});
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
  timeoutId = setTimeout(finish, 12000);
  video.muted = true;
  video.playsInline = true;
  const play = video.play();
  if (play && typeof play.catch === 'function') play.catch(() => {
    // Browser blocks autoplay or data cannot be loaded: do not trap the user.
    setTimeout(finish, 650);
  });
})();
