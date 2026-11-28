/* Play the opening video once per browser tab. */
(() => {
  'use strict';
  const overlay = document.getElementById('deutschai-intro');
  if (!overlay) return;
  const video = overlay.querySelector('video');
  const skip = overlay.querySelector('.intro-skip');
  const root = document.getElementById('view');
  const seenKey='deutschai-intro-seen';
  let seen=false;
  try{seen=sessionStorage.getItem(seenKey)==='1'}catch{}
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
  function finish(instant=false) {
    if (finished) return;
    finished = true;
    clearTimeout(timeoutId);
    markPanels();
    document.body.classList.add('intro-finished');
    overlay.classList.add('is-leaving');
    video.pause();
    try{sessionStorage.setItem(seenKey,'1')}catch{}
    const remove=()=>{
      overlay.remove();
      document.dispatchEvent(new Event('deutschai:intro-finished'));
    };
    if(instant===true)remove();
    else setTimeout(remove,600);
  }
  video.addEventListener('ended', finish, {once:true});
  video.addEventListener('error', () => {
    if (video.dataset.selected === 'desktop') {
      video.dataset.selected = 'mobile';
      video.src = './deutschai-intro.mp4?v=2';
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
  if(seen){finish(true);return}
  try{sessionStorage.setItem(seenKey,'1')}catch{}
  timeoutId = setTimeout(finish, 15000);
  video.muted = true;
  video.playsInline = true;
  const mobile = matchMedia('(max-width: 767px)').matches;
  video.dataset.selected = mobile ? 'mobile' : 'desktop';
  video.src = mobile ? './deutschai-intro.mp4?v=2' : './deutschai-intro-desktop.mp4?v=1';
  video.play().catch(()=>{if(!video.error)setTimeout(finish,650)});
})();
