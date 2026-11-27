/* DeutschAI ↔ Felkan; no API key is exposed to the browser. */
(() => {
  'use strict';
  const apiBase = String(window.DEUTSCHAI_API_URL || '').replace(/\/$/, '');
  let auth = null;
  try { auth = JSON.parse(localStorage.getItem('deutschai:auth:v2') || 'null'); } catch {}
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
          } catch(error) { console.warn('Felkan eşitleme başarısız',error); }
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
      if (!response.ok) throw Error(result.error || 'Felkan sesli bağlantı kurulamadı');
      return result.token;
    },
    navigate(page) {
      const allowed = ['home','lessons','grammar','words','practice','writing','exam','placement','progress'];
      if (!allowed.includes(page)) return false;
      if (window.parent !== window) {
        window.parent.postMessage({type:'deutschai:navigate',page},window.location.origin);
      } else {
        window.location.href = './?open=' + encodeURIComponent(page);
      }
      return true;
    },
    appContext() {
      let state = {};
      try { state = JSON.parse(storage.getItem('deutschai-online-v1') || '{}'); } catch {}
      return {
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