(function () {
  const LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];
  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
  const isLevel = value => LEVELS.includes(value);
  const dateKey = () => new Date().toLocaleDateString('sv-SE');

  function evaluateDailyTest(previous, correct, total, date) {
    const current = previous && isLevel(previous.level)
      ? { ...previous, percent: clamp(Number(previous.percent) || 0, 0, 100), tests: Array.isArray(previous.tests) ? previous.tests : [] }
      : { level: 'A1', percent: 0, tests: [], lastTestDate: null };
    if (!Number.isFinite(total) || total < 3) return { progress: current, changed: false, reason: 'too-few-questions' };
    if (current.lastTestDate === date) return { progress: current, changed: false, reason: 'already-counted-today' };

    const score = Math.round(clamp(correct / total, 0, 1) * 100);
    const delta = score >= 80 ? 10 : score < 50 ? -4 : 0;
    let level = current.level;
    let percent = clamp(current.percent + delta, 0, 100);
    let promotedTo = null;
    if (percent >= 100) {
      const nextIndex = LEVELS.indexOf(level) + 1;
      if (nextIndex < LEVELS.length) {
        level = LEVELS[nextIndex];
        promotedTo = level;
        percent = 0;
      }
    }
    const test = { date, level: current.level, score, correct, total, delta };
    return {
      changed: true,
      score,
      delta,
      promotedTo,
      progress: { level, percent, lastTestDate: date, tests: [...current.tests, test].slice(-30) }
    };
  }

  const core = { LEVELS, evaluateDailyTest };
  if (typeof module !== 'undefined' && module.exports) module.exports = core;
  if (typeof window === 'undefined') return;
  window.DeutschAILearningCore = core;

  const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
  const parse = key => { try { return JSON.parse((window.deutschaiStore || localStorage).getItem(key) || 'null'); } catch { return null; } };
  const levelFromPlacement = () => {
    const placed = parse('deutschai-ai-placement-v1')?.level;
    return isLevel(placed) ? placed : (isLevel(state.level) ? state.level : 'A1');
  };

  function getLevelProgress() {
    if (!state.levelProgress || !isLevel(state.levelProgress.level)) {
      state.levelProgress = { level: levelFromPlacement(), percent: 0, tests: [], lastTestDate: null };
      save();
    } else {
      state.levelProgress.percent = clamp(Number(state.levelProgress.percent) || 0, 0, 100);
      if (!Array.isArray(state.levelProgress.tests)) state.levelProgress.tests = [];
    }
    return state.levelProgress;
  }

  const baseSave = save;
  save = function () {
    const track = state.levelProgress;
    if (track && Array.isArray(track.tests) && track.tests.length === 0 && isLevel(state.level) && track.level !== state.level) {
      track.level = state.level;
    }
    return baseSave();
  };

  function progressMarkup() {
    const track = getLevelProgress();
    const index = LEVELS.indexOf(track.level);
    const next = LEVELS[index + 1] || null;
    const displayLevel = track.percent >= 50 ? `${track.level}+` : track.level;
    const latest = track.tests.slice(-3).reverse();
    return `<section class="card learning-level-card">
      <div class="learning-card-heading"><div><div class="eyebrow">SEVİYE YOLCULUĞUN</div><h2>${esc(displayLevel)} <span class="muted">→</span> ${next ? esc(next) : 'C2 tamamlandı'}</h2></div><span class="badge">%${track.percent}</span></div>
      <div class="learning-level-labels"><span>${esc(track.level)}${track.percent >= 50 ? '+' : ''} · mevcut seviye</span><span>${next ? esc(next) + ' · hedef' : 'En ileri seviye'}</span></div>
      <div class="progress learning-level-meter" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${track.percent}"><i style="width:${track.percent}%"></i></div>
      <p class="muted learning-note">Günlük testlerin son sonuçları ilerlemeyi küçük adımlarla günceller. Tek düşük sonuç birikmiş ilerlemeni silmez.</p>
      ${latest.length ? `<div class="learning-test-history"><b>Son testler</b>${latest.map(test => `<span class="badge">${esc(test.date)} · %${test.score}</span>`).join('')}</div>` : '<p class="muted learning-note">İlk günlük testin tamamlandığında ilerleme burada görünür.</p>'}
    </section>`;
  }

  function packForToday() {
    const pack = parse('deutschai-ai-daily-v1');
    return pack?.date === dateKey() ? pack : null;
  }

  function routeForTask(task) {
    const text = `${task?.activity || ''} ${task?.skill || ''}`.toLocaleLowerCase('tr-TR');
    if (/sprechen|speaking|konuş|mündlich|canlı/.test(text)) return 'live';
    if (/schreiben|writing|yazma|yazı/.test(text)) return 'writing';
    if (/grammat|grammar|gramer|dilbilgisi/.test(text)) return 'grammar';
    if (/wortschatz|vocab|kelime/.test(text)) return 'words';
    if (/lesen|reading|hören|listening|okuma|dinleme|alıştır|practice/.test(text)) return 'practice';
    if (/goethe|exam|sınav|deneme/.test(text)) return 'exam';
    if (/lesson|ders|konu/.test(text)) return 'lessons';
    return 'practice';
  }

  function dailyPlanMarkup() {
    const profile = parse('deutschai-ai-profile-v1') || {};
    const studentName = String(window.deutschaiStudentName || '').trim();
    const minutes = clamp(Number(profile.dailyMinutes || state.daily || 20), 5, 180);
    const pack = packForToday();
    const schedule = Array.isArray(pack?.content?.schedule) ? pack.content.schedule : [];
    const progress = state.dailyPlanProgress?.date === dateKey() ? state.dailyPlanProgress : { date: dateKey(), completed: {} };
    const completeCount = schedule.filter((_, index) => progress.completed?.[index]).length;
    const cardFor = (task, index) => {
      const done = !!progress.completed?.[index];
      return `<article class="learning-task ${done ? 'is-complete' : ''}">
        <button class="learning-task-open" onclick="window.deutschaiOpenPlanTask(${index})" aria-label="${esc(task.activity || task.skill || 'Çalışmayı aç')}">
          <span class="badge">${Math.max(1, Number(task.minutes) || 0)} dk</span><b>${esc(task.activity || 'Günlük çalışma')}</b><small>${esc(task.skill || 'Kişisel çalışma')}</small>
        </button>
        <button class="learning-task-done ${done ? 'is-complete' : ''}" onclick="window.deutschaiTogglePlanTask(${index})">${done ? '✓ Tamamlandı' : 'Tamamlandı olarak işaretle'}</button>
      </article>`;
    };
    const sections = [
      { key: 'grammar', title: 'Gramer', icon: '🧩' },
      { key: 'vocabulary', title: 'Kelime ve tekrar', icon: 'Aa' },
      { key: 'reading', title: 'Okuma', icon: '📖' },
      { key: 'listening', title: 'Dinleme', icon: '🎧' },
      { key: 'writing', title: 'Yazma', icon: '✍️' },
      { key: 'speaking', title: 'Konuşma', icon: '🎙️' },
      { key: 'goethe', title: 'Goethe pratiği', icon: '✦' },
    ];
    const sectionFor = task => {
      const text = `${task?.activity || ''} ${task?.skill || ''}`.toLocaleLowerCase('tr-TR');
      if (/sprechen|speaking|konuş|mündlich|canlı/.test(text)) return 'speaking';
      if (/schreiben|writing|yazma|yazı/.test(text)) return 'writing';
      if (/grammat|grammar|gramer|dilbilgisi/.test(text)) return 'grammar';
      if (/hören|horen|listening|dinleme/.test(text)) return 'listening';
      if (/wortschatz|vocab|kelime|vocabulary|tekrar/.test(text)) return 'vocabulary';
      if (/goethe|exam|sınav|deneme/.test(text)) return 'goethe';
      return 'reading';
    };
    const cards = sections.map(section => {
      const items = schedule.map((task,index)=>({task,index})).filter(item=>sectionFor(item.task)===section.key);
      return `<section class="learning-subject"><h3>${section.icon} ${section.title}</h3><div class="learning-daily-items">${items.length?items.map(({task,index})=>cardFor(task,index)).join(''):'<p class="muted learning-note">Bugünkü plana bu bölüm eklenmedi.</p>'}</div></section>`;
    }).join('');
    const extra = Array.isArray(state.extraWork) ? state.extraWork.slice(-12).reverse() : [];
    const extraMarkup = extra.length ? `<section class="learning-extra"><h3>Ekstra çalışma · tekrar et</h3><div class="learning-daily-items">${extra.map((task,index)=>`<article class="learning-task"><button class="learning-task-open" onclick="window.deutschaiOpenExtraWork(${index})"><span class="badge">${esc(task.minutes||5)} dk</span><b>${esc(task.activity||'Tamamlanan çalışma')}</b><small>${esc(task.skill||'Kişisel çalışma')} · ${esc(task.completedOn||'')}</small></button></article>`).join('')}</div></section>` : '';
    const empty = `<div class="learning-plan-empty"><p class="muted">Bugünkü programını seviyene, ayırabileceğin süreye ve son çalışmalarına göre yapay zekâ hazırlasın.</p><button class="btn" onclick="window.deutschaiCreateHomePlan()">✦ Günlük planı hazırla</button></div>`;
    return `<section class="card learning-daily-card">
      <div class="learning-card-heading"><div><div class="eyebrow">KİŞİSEL PROGRAM</div><h2>Bugünkü çalışma planın</h2><p class="muted learning-note">${studentName ? `Hoş geldin, ${esc(studentName)}. ` : ''}Derslerini burada takip edebilirsin.</p></div><button class="btn ghost" onclick="setPage('live')">🎙 Programı asistanla konuş</button>${schedule.length ? `<span class="badge">${completeCount}/${schedule.length} tamamlandı</span>` : ''}</div>
      <div class="learning-time-control"><label for="learning-daily-minutes">Günlük ayırabileceğin süre</label><select id="learning-daily-minutes">${[10,15,20,30,45,60,90].map(value => `<option value="${value}" ${minutes === value ? 'selected' : ''}>${value} dakika</option>`).join('')}</select></div>
      ${schedule.length ? `<p class="muted learning-note">${esc(pack.content.adaptationTr || `${pack.content.level || profile.level || state.level} seviyen ve son çalışma sonuçların dikkate alındı.`)}</p><div class="learning-subject-grid">${cards}</div>${extraMarkup}<button class="btn ghost learning-refresh" onclick="window.deutschaiCreateHomePlan()">Süreyi uygula ve Gemini’ye planı yenilet</button>` : empty}
    </section>`;
  }


  function openPlanTask(index) {
    const task = packForToday()?.content?.schedule?.[index];
    if (!task) return;
    setPage(routeForTask(task));
  }

  function togglePlanTask(index) {
    const task = packForToday()?.content?.schedule?.[index];
    if (!task) return;
    if (state.dailyPlanProgress?.date !== dateKey()) state.dailyPlanProgress = { date: dateKey(), completed: {} };
    const completed = state.dailyPlanProgress.completed || (state.dailyPlanProgress.completed = {});
    completed[index] = !completed[index];
    if (!Array.isArray(state.attempts)) state.attempts = [];
    const minutes = Math.max(1, Number(task.minutes) || 5);
    if (completed[index]) {
      state.minutes = (Number(state.minutes) || 0) + minutes;
      state.attempts.push({ ok: true, planTask: true, skill: task.skill || task.activity || 'daily-plan', level: getLevelProgress().level, at: Date.now() });
      if (!Array.isArray(state.extraWork)) state.extraWork = [];
      state.extraWork.push({ activity: task.activity || 'Günlük çalışma', skill: task.skill || '', minutes, completedOn: dateKey(), planDate: dateKey(), planIndex: index, task: { ...task } });
      state.extraWork = state.extraWork.slice(-40);
    } else {
      state.minutes = Math.max(0, (Number(state.minutes) || 0) - minutes);
      const extraIndex = (state.extraWork || []).map(item => item.planDate === dateKey() && item.planIndex === index).lastIndexOf(true);
      if (extraIndex >= 0) state.extraWork.splice(extraIndex, 1);
    }
    state.attempts = state.attempts.slice(-200);
    save();
    if (page === 'home') home();
    else window.deutschaiRefreshAssistantDashboard?.();
    const schedule = packForToday()?.content?.schedule || [];
    if (completed[index] && schedule.length && schedule.every((_, taskIndex) => !!completed[taskIndex])) {
      void window.deutschaiStartDailyAssessment?.();
    }
  }

  function openExtraWork(index) {
    const items = (state.extraWork || []).slice(-12).reverse();
    const item = items[index];
    if (!item) return;
    const task = item.task || item;
    const route = routeForTask(task);
    setPage(route);
  }

  async function createHomePlan() {
    const selected = document.querySelector('#learning-daily-minutes');
    const minutes = clamp(Number(selected?.value || state.daily || 20), 5, 180);
    state.daily = minutes;
    save();
    const button = document.querySelector('.learning-refresh') || document.querySelector('.learning-plan-empty .btn');
    if (button) { button.disabled = true; button.textContent = 'Kişisel programın hazırlanıyor…'; }
    try {
      if (typeof window.deutschaiPrepareDailyPlan !== 'function') throw new Error('Sesli asistan bağlantısı hazır değil.');
      await window.deutschaiPrepareDailyPlan(minutes);
    } catch (error) {
      if (button) { button.disabled = false; button.textContent = 'Programı yeniden hazırla'; }
      const card = document.querySelector('.learning-daily-card');
      if (card) { let note = card.querySelector('[role=alert]'); if (!note) { note = document.createElement('p'); note.setAttribute('role','alert'); note.className='error'; card.appendChild(note); } note.textContent = error?.message || 'Program hazırlanamadı.'; }
    }
  }

  function recordDailyTest(scoreCorrect, total, skill) {
    const track = getLevelProgress();
    const result = evaluateDailyTest(track, scoreCorrect, total, dateKey());
    if (!result.changed) return result;
    state.levelProgress = result.progress;
    state.level = result.progress.level;
    state.levelProgress.tests[state.levelProgress.tests.length - 1].skill = skill || 'daily';
    save();
    const aiLevel = document.querySelector('#ai-level');
    if (aiLevel && typeof window.aiSaveProfile === 'function') {
      aiLevel.value = result.progress.level;
      window.aiSaveProfile();
    } else {
      const profile = parse('deutschai-ai-profile-v1') || {};
      profile.level = result.progress.level;
      (window.deutschaiStore || localStorage).setItem('deutschai-ai-profile-v1', JSON.stringify(profile));
    }
    return result;
  }

  window.deutschaiDailyProgramMarkup = dailyPlanMarkup;
  window.deutschaiOpenPlanTask = openPlanTask;
  window.deutschaiTogglePlanTask = togglePlanTask;
  window.deutschaiCreateHomePlan = createHomePlan;
  window.deutschaiOpenExtraWork = openExtraWork;

  const baseProgress = progress;
  progress = function () {
    baseProgress();
    const view = document.querySelector('#view');
    if (view) view.insertAdjacentHTML('beforeend', `<div class="learning-progress-extra">${progressMarkup()}</div>`);
  };

  const style = document.createElement('style');
  style.textContent = `.learning-overview{margin-top:18px}.learning-overview-grid{display:grid;grid-template-columns:minmax(280px,.8fr) minmax(360px,1.2fr);gap:15px;align-items:start}.learning-card-heading{display:flex;justify-content:space-between;gap:12px;align-items:center}.learning-card-heading h2{margin:4px 0 12px}.learning-level-labels{display:flex;justify-content:space-between;gap:12px;font-size:12px;color:var(--muted);margin:12px 0 7px}.learning-level-meter{height:12px}.learning-level-meter i{transition:width .35s ease}.learning-note{font-size:12px;margin:11px 0}.learning-test-history{display:flex;gap:7px;align-items:center;flex-wrap:wrap;margin-top:14px;font-size:12px}.learning-time-control{display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin:5px 0 11px}.learning-time-control label{font-size:12px;color:var(--muted)}.learning-subject-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}.learning-subject h3,.learning-extra h3{margin:8px 0}.learning-daily-items{display:grid;gap:9px}.learning-task{border:1px solid var(--line);border-radius:13px;padding:12px;background:var(--paper)}.learning-task.is-complete{opacity:.72}.learning-task-open{width:100%;border:0;background:transparent;color:var(--ink);display:grid;grid-template-columns:auto 1fr;align-items:center;gap:7px 10px;text-align:left;padding:0}.learning-task-open b{font-size:14px}.learning-task-open small{grid-column:2;color:var(--muted)}.learning-task-open:hover b{text-decoration:underline}.learning-task-done{margin-top:10px;border:1px solid var(--line);background:var(--bg);border-radius:9px;padding:6px 9px;color:var(--muted);font-size:11px}.learning-task-done.is-complete{color:var(--green);font-weight:700}.learning-plan-empty{padding:8px 0}.learning-refresh{margin-top:12px}.learning-progress-extra{margin-top:14px}@media(max-width:1050px){.learning-overview-grid{grid-template-columns:1fr}}@media(max-width:600px){.learning-daily-items,.learning-subject-grid{grid-template-columns:1fr}.learning-level-labels{font-size:11px}}`;
  document.head.appendChild(style);

  const originalDailyAnswer = window.aiDailyAnswer;
  if (typeof originalDailyAnswer === 'function') {
    window.aiDailyAnswer = function (button, answerIndex, explanation, questionIndex) {
      const box = button?.closest?.('.question[data-aiq]');
      const options = box ? [...box.querySelectorAll('.option')] : [];
      const chosen = options.indexOf(button);
      const correct = chosen === Number(answerIndex);
      const skill = box?.querySelector('.badge')?.textContent?.trim() || 'daily';
      const result = originalDailyAnswer.apply(this, arguments);
      if (box) box.dataset.learningOk = correct ? '1' : '0';
      const lastAttempt = state.attempts?.[state.attempts.length - 1];
      if (lastAttempt) { lastAttempt.level = getLevelProgress().level; lastAttempt.skill = skill; }
      if (Array.isArray(state.attempts)) state.attempts = state.attempts.slice(-200);
      save();
      const questions = [...document.querySelectorAll('.question[data-aiq]')];
      if (questions.length >= 3 && questions.every(item => item.dataset.done === '1')) {
        const correctCount = questions.filter(item => item.dataset.learningOk === '1').length;
        const track = getLevelProgress();
        const outcome = recordDailyTest(correctCount, questions.length, skill);
        if (outcome.changed) {
          const message = outcome.promotedTo
            ? `Günlük testin %${outcome.score}. Tebrikler, ${outcome.promotedTo} seviyesine geçtin!`
            : `Günlük testin %${outcome.score}. Seviye ilerlemen ${outcome.delta > 0 ? '+' : ''}${outcome.delta} puan değişti.`;
          const resultLine = document.createElement('p');
          resultLine.className = 'feedback learning-test-result';
          resultLine.textContent = message;
          questions[questions.length - 1].after(resultLine);
        } else if (outcome.reason === 'already-counted-today') {
          const resultLine = document.createElement('p');
          resultLine.className = 'feedback learning-test-result';
          resultLine.textContent = 'Bugünkü seviye testi zaten kaydedildi; yeni sonuç yarın ilerlemeyi günceller.';
          questions[questions.length - 1].after(resultLine);
        }
      }
      return result;
    };
  }

})();