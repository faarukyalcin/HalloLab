/* DeutschAI ↔ Edit; no API key is exposed to the browser. */
(() => {
  'use strict';
  const apiBase = String(window.DEUTSCHAI_API_URL || '').replace(/\/$/, '');
  let auth = null;
  try { auth = JSON.parse(sessionStorage.getItem('deutschai:auth:v2') || 'null'); } catch {}
  const userId = auth?.user?.id || 'guest';
  const scope = key => 'deutschai:user:' + userId + ':' + key;
  const storage = {
    getItem(key) { return localStorage.getItem(scope(key)); },
    setItem(key, value) {
      localStorage.setItem(scope(key), String(value));
      if (key === 'felkan_data' && auth?.token && apiBase) {
        clearTimeout(storage.timer);
        storage.timer = setTimeout(async () => {
          try {
            await fetch(apiBase + '/state', {
              method: 'PUT',
              headers: {'Content-Type':'application/json','Authorization':'Bearer ' + auth.token},
              body: JSON.stringify({bucket:'felkan_data',data:{raw:String(value)}})
            });
          } catch(error) { console.warn('Edit eşitleme başarısız',error); }
        }, 900);
      }
    },
    removeItem(key) { localStorage.removeItem(scope(key)); }
  };
  window.FelkanStorage = storage;
  window.FelkanBridge = {
    get user() { return auth?.user || null; },
    async liveToken() {
      if (!apiBase || !auth?.token) throw Error('Önce DeutschAI hesabına giriş yapmalısın');
      const response = await fetch(apiBase + '/ai/live-token', {
        method:'POST',
        headers:{'Content-Type':'application/json','Authorization':'Bearer ' + auth.token},
        body:'{}'
      });
      const result = await response.json();
      if(response.status===429||/\b429\b|RESOURCE_EXHAUSTED/.test(result.error||''))throw Error('Gemini ses kotası veya oturum sınırı doldu (429).');
      if (!response.ok) throw Error(result.error || 'Edit sesli bağlantı kurulamadı');
      return result.token;
    },
    navigate(page) {
      const allowed = ['home','lessons','program','grammar','words','practice','writing','exam','placement','progress','community','profile'];
      if (!allowed.includes(page)) return false;
      if (window.parent !== window) {
        try {
          if(typeof window.parent.DeutschAI?.openStudySection==='function')return window.parent.DeutschAI.openStudySection(page);
          if(typeof window.parent.setPage==='function'){
            window.parent.setPage(page);
            return window.parent.document.querySelector('#nav [aria-current="page"]')?.dataset.page===page;
          }
        } catch(e) { /* postMessage fallback for isolated frames */ }
        window.parent.postMessage({type:'deutschai:navigate',page},window.location.origin);
        return false; // No verified completion in the fallback path.
      }
      window.location.href = './?open=' + encodeURIComponent(page);
      return true;
    },
    generate(page) {
      const allowed=['lessons','placement','words','grammar','practice','exam','writing','progress'];
      if(!allowed.includes(page))return false;
      if(window.parent!==window){
        try{
          if(typeof window.parent.deutschaiRegenerateSection==='function')return window.parent.deutschaiRegenerateSection(page);
        }catch(error){ console.warn('Edit çalışma başlatamadı',error); }
        window.parent.postMessage({type:'deutschai:generate',page},window.location.origin);
        return true;
      }
      return typeof window.deutschaiRegenerateSection==='function'&&window.deutschaiRegenerateSection(page);
    },
    appContext() {
      let state = {}, plan = null, preferences = null;
      try { state = JSON.parse(storage.getItem('deutschai-online-v1') || '{}'); } catch {}
      try { plan = JSON.parse(storage.getItem('deutschai-felcan-week-v1') || 'null'); } catch {}
      try { preferences = JSON.parse(storage.getItem('deutschai-felcan-settings-v1') || 'null'); } catch {}
      const day=(new Date().getDay()+6)%7;
      let current=null;try{current=window.parent!==window?window.parent.DeutschAI?.getLearningSummary():null}catch{}
      return {
        currentLearning:current,
        studyPreferences: preferences ? {minutes:preferences.minutes,goal:preferences.goal,focus:preferences.focus} : null,
        weeklyPlan:plan?.days?.[day] ? {week:plan.week,today:plan.days[day]} : null,
        user:auth?.user?.firstName || '',
        level:state.level || 'A1',
        daily:state.daily || 20,
        completedLessons:Array.isArray(state.completed) ? state.completed.length : 0,
        wrongWords:(state.wrongWords || []).slice(0,10),
        grammarDone:state.grammarDone || {}
      };
    }
  };
})();