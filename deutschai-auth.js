/* DeutschAI account UI and local-first, account-scoped cloud state. */
(() => {
  'use strict';
  const origin = String(window.DEUTSCHAI_API_URL || '').replace(/\/$/, '');
  const get = localStorage.getItem.bind(localStorage);
  const put = localStorage.setItem.bind(localStorage);
  const del = localStorage.removeItem.bind(localStorage);
  const authKey = 'deutschai:auth:v2';
  let auth = null;
  try { auth = JSON.parse(get(authKey) || 'null'); } catch {}
  if (!auth?.token || !auth?.user?.id) auth = null;
  const prefix = () => 'deutschai:user:' + (auth?.user?.id || 'guest') + ':';
  const syncKeys = key => /^deutschai-|^felkan_/.test(key);
  const pending = new Map();
  const timers = new Map();
  const safe = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  async function request(path, options = {}) {
    if (!origin) throw Error('Backend kurulumu henüz tamamlanmadı');
    const response = await fetch(origin + path, {
      ...options, cache:'no-store',
      headers: {
        'Content-Type':'application/json',
        ...(auth?.token ? {'Authorization':'Bearer ' + auth.token} : {}),
        ...(options.headers || {})
      }
    });
    const value = await response.json().catch(() => ({}));
    if (!response.ok) throw Error(value.error || 'Sunucu hatası');
    return value;
  }
  function bucket(key) {
    return String(key).replace(/[^a-z0-9_-]/gi, '_').slice(0,39).toLowerCase();
  }
  async function savePending(key) {
    if (!auth || !origin || !pending.has(key)) return;
    const raw = pending.get(key);
    pending.delete(key);
    try {
      await request('/state', {method:'PUT',body:JSON.stringify({bucket:bucket(key),data:{raw}})});
    } catch (error) {
      console.warn('DeutschAI bulut kayıt hatası:',key,error);
    }
  }
  const store = {
    getItem(key) { return get(origin ? prefix() + key : String(key)); },
    setItem(key,value) {
      const k=String(key),v=String(value);
      put(origin ? prefix()+k : k,v);
      if (origin && auth && syncKeys(k)) {
        pending.set(k,v);
        clearTimeout(timers.get(k));
        timers.set(k,setTimeout(() => savePending(k),850));
      }
    },
    removeItem(key) { del(origin ? prefix()+key : String(key)); },
    key(index) {
      if(!origin) return localStorage.key(index);
      return Object.keys(localStorage).filter(k=>k.startsWith(prefix()))[index]?.slice(prefix().length) || null;
    },
    get length() {
      return origin ? Object.keys(localStorage).filter(k=>k.startsWith(prefix())).length : localStorage.length;
    }
  };
  async function hydrate() {
    if (!auth) return false;
    const data=await request('/state');
    const match = Object.keys(localStorage).filter(k => k.startsWith(prefix())).map(k => k.slice(prefix().length));
    let changed=false;
    for (const [id,entry] of Object.entries(data.buckets || {})) {
      const key=match.find(k=>bucket(k)===id) || id;
      const value=entry?.data?.raw;
      if (typeof value === 'string' && get(prefix()+key)!==value) {
        put(prefix()+key,value);
        changed=true;
      }
    }
    return changed;
  }
  const style=document.createElement('style');
  style.textContent = [
    'body #da-felcan-float:not(.da-dock-hidden){display:grid!important;place-items:center;left:max(14px,env(safe-area-inset-left));right:auto;bottom:max(16px,env(safe-area-inset-bottom));width:50px;height:50px;padding:0;border-radius:18px;animation:none}',
    'body #da-felcan-float.da-dock-hidden{display:none!important}',
    '#da-felcan-float .da-felcan-text{display:none}',
    'body #da-felcan-float .da-felcan-orb{transform:scale(.56)}',
    '#da-felcan-float[data-voice="speaking"] .da-felcan-orb,#da-felcan-float[data-voice="connecting"] .da-felcan-orb{animation:none}',
    'body #da-felcan-float[data-voice="speaking"]{border-color:#e4c4ff;box-shadow:0 0 20px #ac79ee90}',
    '#da-felcan-welcome,.da-admin-action-dialog{max-width:calc(100vw - 32px);border:1px solid #aa94ed70;border-radius:26px;padding:28px;background:linear-gradient(150deg,#292346,#15182e);color:#f8f5ff;box-shadow:0 26px 80px #080917a8;font:15px/1.5 system-ui}',
    '#da-felcan-welcome{width:min(390px,calc(100vw - 32px));text-align:center;padding:40px 24px 26px}',
    '#da-felcan-welcome::backdrop,.da-admin-action-dialog::backdrop{background:#070a1bb0;backdrop-filter:blur(5px)}',
    'body #da-felcan-welcome .da-felcan-orb{margin:16px auto 30px;transform:scale(1.42)}',
    '#da-felcan-welcome h2{font-size:30px;margin:0 0 6px;line-height:1.2}',
    '#da-felcan-welcome .da-welcome-status{color:#ddd1f8;margin:0 0 12px;min-height:22px}',
    '#da-felcan-welcome .da-welcome-greet,.da-admin-action-dialog button{border:1px solid #c6abff65;background:#654bd0;color:white;border-radius:12px;padding:10px 15px;font:700 14px system-ui;cursor:pointer}',
    '#da-felcan-welcome .da-welcome-greet{width:100%;min-height:46px}',
    '#da-felcan-welcome .da-welcome-greet:disabled,.da-admin-action-dialog button:disabled{opacity:.65;cursor:wait}',
    '#da-felcan-welcome .da-welcome-dismiss{position:absolute;right:14px;top:12px;width:38px;height:38px;border:0;border-radius:12px;background:#ffffff10;color:#f8f5ff;font-size:24px;cursor:pointer}',
    '#da-felcan-welcome[data-voice="speaking"] .da-toy-smile{animation:da-felcan-mouth .21s linear infinite alternate}',
    '#da-auth-screen .da-admin-toolbar{display:grid;grid-template-columns:minmax(0,1fr) auto;align-items:end;gap:8px}',
    '#da-auth-screen .da-admin-toolbar label{grid-column:1/-1;margin:0}',
    '#da-auth-screen .da-admin-toolbar input,.da-admin-action-dialog input{min-width:0;width:100%;padding:10px;border:1px solid #a891db7a;border-radius:10px;background:#101327;color:#fff;font:inherit}',
    '#da-auth-screen .da-admin-user{align-items:flex-start;background:#222644;border-color:#b3a0ef3f}',
    '#da-auth-screen .da-admin-user[hidden]{display:none}',
    '#da-auth-screen .da-admin-actions,.da-admin-action-dialog .da-admin-actions{display:flex;flex-wrap:wrap;gap:7px;align-items:center}',
    '#da-auth-screen .da-admin-actions{justify-content:flex-end}',
    '#da-auth-screen .da-admin-actions button{padding:8px 10px;white-space:nowrap}',
    '#da-auth-screen .da-admin-danger,.da-admin-action-dialog .da-admin-danger{background:#78374b;color:#fff1f5;border-color:#ff9fb16e}',
    '.da-admin-action-dialog{width:min(440px,calc(100vw - 32px))}',
    '.da-admin-action-dialog h2{margin:0;font-size:21px}',
    '.da-admin-action-dialog label{display:grid;gap:6px}',
    '.da-admin-action-dialog [role="alert"]{color:#ffa8b7}',
    '@media(max-width:999px){body #da-felcan-float:not(.da-dock-hidden){bottom:calc(86px + env(safe-area-inset-bottom))}}',
    '@media(max-width:650px){#da-auth-screen .da-admin-user{flex-direction:column}#da-auth-screen .da-admin-actions{justify-content:flex-start}}',
    '@media(prefers-reduced-motion:reduce){#da-felcan-welcome .da-toy-smile{animation:none!important}}',
    '#da-auth-screen{position:fixed;inset:0;z-index:2147483600;display:grid;place-items:center;padding:18px;background:radial-gradient(circle at 15% 10%,#4e3895,#130d2c 56%,#080b19);color:#f4f1ff;font:15px system-ui}',
    '#da-auth-screen[hidden]{display:none}',
    '#da-auth-screen .da-card{width:min(420px,100%);max-height:95dvh;overflow:auto;padding:26px;border:1px solid #af9cef65;border-radius:25px;background:#251d4cdd;box-shadow:0 20px 65px #0008;backdrop-filter:blur(23px)}',
    '#da-auth-screen h1{margin:0 0 8px;font-size:26px}',
    '#da-auth-screen p{color:#c9c1e4;line-height:1.5}',
    '#da-auth-screen label{display:grid;gap:5px;margin:10px 0;font-size:13px;color:#dcd5ff}',
    '#da-auth-screen input{width:100%;padding:12px;border:1px solid #7866bf;border-radius:12px;background:#151132;color:#fff;font:16px system-ui}',
    '#da-auth-screen button,.da-account-button{cursor:pointer;border:1px solid #a893f1;border-radius:13px;padding:10px 13px;background:linear-gradient(135deg,#8d66e6,#5939b6);color:white;font-weight:750}',
    '#da-auth-screen .da-tabs{display:flex;gap:8px;margin:15px 0}.da-tabs button{flex:1}',
    '#da-auth-screen .da-error{color:#ffb2c3;min-height:21px}',
    '#da-auth-screen{background:radial-gradient(ellipse 60% 75% at 14% 10%,#6745b071,transparent 70%),radial-gradient(ellipse 55% 75% at 87% 80%,#4b429a60,transparent 70%),linear-gradient(140deg,#0a0e22,#12112f 63%,#090c21);overflow-y:auto;align-items:center}',
    '#da-auth-screen .da-login-shell{display:grid;grid-template-columns:minmax(0,1.18fr) minmax(335px,.82fr);width:min(1110px,100%);min-height:min(680px,calc(100dvh - 48px));border:1px solid #c6a7ff44;border-radius:32px;overflow:hidden;background:linear-gradient(110deg,#292653aa,#13172dd9);box-shadow:0 35px 100px #040617b0;backdrop-filter:blur(30px)}',
    '#da-auth-screen .da-login-hero{position:relative;display:flex;flex-direction:column;justify-content:space-between;overflow:hidden;padding:33px clamp(22px,4vw,54px);background:radial-gradient(circle at 74% 45%,#b88bff37,transparent 42%),linear-gradient(140deg,#342b6b98,#25254d66 58%,#11193488);border-right:1px solid #e2cbff25}',
    '#da-auth-screen .da-login-hero::after{content:"";position:absolute;width:500px;height:250px;right:-200px;top:-170px;transform:rotate(-19deg);border-radius:50%;border:1px solid #ceb0ff65;background:linear-gradient(160deg,#c899ff32,transparent);box-shadow:inset 0 -20px 55px #bd8bff1d;pointer-events:none}',
    '#da-auth-screen .da-login-brand{display:flex;align-items:center;gap:11px;font-size:19px;font-weight:800;position:relative;z-index:1}',
    '#da-auth-screen .da-brand-mark{display:grid;place-items:center;width:38px;height:38px;border-radius:13px;background:linear-gradient(150deg,#a98af7,#6149a8);border:1px solid #dec8ff99;box-shadow:0 7px 22px #673fb777}',
    '#da-auth-screen .da-brand-pill{margin-left:auto;font-size:9px;letter-spacing:.09em;color:#ded0ff;border:1px solid #c5afff44;border-radius:99px;padding:7px 10px}',
    '#da-auth-screen .da-hero-content{position:relative;z-index:1;padding:27px 0}',
    '#da-auth-screen .da-login-kicker,#da-auth-screen .da-form-kicker{color:#ba9cf9;font-size:11px;font-weight:800;letter-spacing:.19em}',
    '#da-auth-screen .da-login-hero h1{font-size:clamp(34px,4.1vw,60px);line-height:1.09;letter-spacing:-.045em;max-width:560px;margin:19px 0 15px}',
    '#da-auth-screen .da-login-hero h1 em{font-style:normal;color:#cfb3ff}',
    '#da-auth-screen .da-login-hero p{font-size:15px;line-height:1.7;max-width:490px;color:#d2cbea}',
    '#da-auth-screen .da-hero-mascot{position:relative;width:118px;height:115px;margin:26px auto 14px;filter:drop-shadow(0 15px 27px #b680ff55);animation:da-felcan-fly 4s ease-in-out infinite}',
    '#da-auth-screen .da-hero-face{display:flex;flex-direction:column;justify-content:center;align-items:center;position:absolute;inset:10px 10px 8px;border-radius:47% 47% 41% 41%;background:radial-gradient(circle at 30% 10%,#f4e0ff,#ab8beb 46%,#6f56bb);border:1px solid #fffb;box-shadow:inset 3px 4px 16px #fff8;font-size:18px;font-weight:900;color:#342051;line-height:1.7}',
    '#da-auth-screen .da-hero-face span{font-size:22px;line-height:.6}',
    '#da-auth-screen .da-hero-ears{position:absolute;width:35px;height:53px;top:-15px;left:12px;border-radius:90% 10% 70% 20%;background:#c5a4f3;transform:rotate(-20deg);box-shadow:83px 26px 0 -6px #a788dc}',
    '#da-auth-screen .da-hero-feet{position:absolute;bottom:2px;left:22px;width:24px;height:13px;border-radius:8px;background:#7053af;box-shadow:48px 0 #7053af}',
    '#da-auth-screen .da-hero-star{position:absolute;right:-3px;top:9px;color:#fbe2a8;font-size:31px;text-shadow:0 0 13px #d7aaff}',
    '#da-auth-screen .da-login-stats{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;margin-top:17px}',
    '#da-auth-screen .da-login-stats>div{padding:14px 11px;border:1px solid #d0b7ff36;border-radius:17px;background:#ffffff0b;backdrop-filter:blur(15px)}',
    '#da-auth-screen .da-login-stats b{display:block;font-size:21px;color:#fff}',
    '#da-auth-screen .da-login-stats span{display:block;color:#c8bfe0;font-size:10px;line-height:1.5;margin-top:4px}',
    '#da-auth-screen .da-hero-note{margin:10px 0 0;font-size:12px;color:#beb7db}',
    '#da-auth-screen .da-login-card{margin:0;width:100%;max-height:none;overflow-y:auto;box-shadow:none;border:0;border-radius:0;background:linear-gradient(150deg,#1c1d3acc,#12142fe6);padding:clamp(24px,4vw,55px);display:flex;flex-direction:column;justify-content:center}',
    '#da-auth-screen .da-login-card h2{font-size:clamp(25px,3vw,35px);letter-spacing:-.035em;margin:11px 0 5px}',
    '#da-auth-screen .da-login-card p{font-size:13px;line-height:1.55}',
    '#da-auth-screen .da-login-card .da-tabs{background:#100e2a;border:1px solid #a992e94f;border-radius:14px;padding:5px;margin:24px 0 14px}',
    '#da-auth-screen .da-login-card .da-tabs button{background:transparent;border:0;box-shadow:none;color:#afa7d0;font-size:13px}',
    '#da-auth-screen .da-login-card .da-tabs button[aria-pressed="true"]{color:#fff;background:linear-gradient(135deg,#9774ed,#6044bd);box-shadow:0 5px 17px #6044bd77}',
    '#da-auth-screen .da-login-card label{margin:9px 0 13px;font-size:12px;font-weight:600}',
    '#da-auth-screen .da-login-card input{border:1px solid #baa7fa57;border-radius:13px;background:#0e112caa;transition:border-color .2s,box-shadow .2s}',
    '#da-auth-screen .da-login-card input:focus{outline:0;border-color:#cbb6ff;box-shadow:0 0 0 3px #b28bff33}',
    '#da-auth-screen .da-name-row{display:grid;grid-template-columns:1fr 1fr;gap:10px}',
    '#da-auth-screen .da-login-submit{display:block;width:100%;margin-top:10px;padding:14px 18px;font-size:14px;box-shadow:0 9px 27px #7455d255}',
    '#da-auth-screen .da-login-secure{margin:20px 0 0!important;text-align:center;font-size:11px!important}',
    '@media(max-width:780px){#da-auth-screen{padding:10px;align-items:flex-start}#da-auth-screen .da-login-shell{grid-template-columns:1fr;min-height:unset;border-radius:23px}#da-auth-screen .da-login-hero{padding:22px 23px 17px;border-right:0;border-bottom:1px solid #e2cbff25}#da-auth-screen .da-login-hero h1{font-size:33px}#da-auth-screen .da-hero-mascot{display:none}#da-auth-screen .da-login-stats{margin:16px 0 0}#da-auth-screen .da-brand-pill{display:none}#da-auth-screen .da-login-card{padding:24px 23px 30px}#da-auth-screen .da-hero-content{padding:20px 0 0}#da-auth-screen .da-login-hero p{font-size:13px}#da-auth-screen .da-login-stats b{font-size:17px}}',
    '@media(max-width:370px){#da-auth-screen .da-name-row{grid-template-columns:1fr}#da-auth-screen .da-login-stats>div{padding:9px 7px}#da-auth-screen .da-login-stats span{font-size:9px}}',
    '#da-auth-screen .da-admin-card{width:min(1040px,100%);max-height:calc(100dvh - 32px);padding:clamp(16px,3vw,30px);background:#17192f;border-color:#bcaaff45;overflow:auto}',
    '#da-auth-screen .da-admin-top{display:flex;justify-content:space-between;align-items:start;gap:12px}',
    '#da-auth-screen .da-admin-top button{white-space:nowrap}',
    '#da-auth-screen .da-admin-stat-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;margin:15px 0}',
    '#da-auth-screen .da-admin-stat-grid>div{border:1px solid #c6b0ff55;border-radius:16px;background:#ffffff0a;padding:15px}',
    '#da-auth-screen .da-admin-stat-grid b{display:block;font-size:29px;color:#e1c5ff}',
    '#da-auth-screen .da-admin-stat-grid small{font-size:11px;color:#cbbfe6}',
    '#da-auth-screen .da-admin-section{margin:16px 0;padding:17px;border:1px solid #cbb5ff44;background:#1b173d8a;border-radius:19px}',
    '#da-auth-screen .da-admin-section h2{font-size:19px;margin:0 0 7px}',
    '#da-auth-screen .da-admin-users{display:grid;gap:9px;max-height:45dvh;overflow-y:auto;margin:13px 0}',
    '#da-auth-screen .da-admin-user{display:flex;align-items:center;justify-content:space-between;gap:11px;padding:12px;border:1px solid #a88aee55;border-radius:13px;background:#342a5970}',
    '#da-auth-screen .da-admin-user-info{min-width:0;overflow-wrap:anywhere}',
    '#da-auth-screen .da-admin-user-info strong{display:block;font-size:13px}',
    '#da-auth-screen .da-admin-user-info small{display:block;color:#b9acd9;margin-top:4px;font-size:11px}',
    '#da-auth-screen .da-admin-user select{max-width:128px;min-width:103px;border:1px solid #ab90e7;border-radius:10px;background:#211b43;color:#fff;padding:10px;font:12px system-ui}',
    '#da-auth-screen .da-admin-activity{margin-top:12px;border:1px solid #bfa3fc66;border-radius:15px;padding:12px;background:#16152a88}',
    '#da-auth-screen .da-admin-activity-summary{font-size:12px;color:#e2d5ff;margin:4px 0 11px}',
    '#da-auth-screen .da-admin-daygrid{display:grid;grid-template-columns:repeat(7,minmax(0,1fr));gap:6px}',
    '#da-auth-screen .da-admin-day{display:flex;flex-direction:column;gap:5px;min-width:0;text-align:center;border:1px solid #bca3f541;border-radius:9px;padding:7px 2px;background:#28234388}',
    '#da-auth-screen .da-admin-day.visited{background:#674aaf77;border-color:#b49bfa9e}',
    '#da-auth-screen .da-admin-day b{font-size:10px;color:#fff}',
    '#da-auth-screen .da-admin-day small{font-size:9px;color:#d1c3ef;line-height:1.3}',
    '#da-auth-screen .da-admin-user-extra{display:flex;flex-wrap:wrap;gap:6px;margin-top:7px}',
    '#da-auth-screen .da-admin-user-extra span{font-size:10px;border:1px solid #bea5f643;padding:4px 7px;border-radius:8px;color:#e2d3fd}',

    '@media(max-width:600px){#da-auth-screen .da-admin-card{max-height:calc(100dvh - 20px)}#da-auth-screen .da-admin-stat-grid{gap:6px}#da-auth-screen .da-admin-stat-grid>div{padding:9px}#da-auth-screen .da-admin-stat-grid b{font-size:22px}#da-auth-screen .da-admin-user{flex-direction:column;align-items:stretch}#da-auth-screen .da-admin-user select{max-width:none}}',
    '#da-account-action{position:fixed;top:97px;right:12px;z-index:98;font-size:12px}',
    '#da-felcan-float{position:fixed;right:22px;bottom:24px;z-index:990;display:flex;align-items:center;gap:10px;cursor:pointer;border:1px solid #d9c6ff77;border-radius:24px;padding:7px 16px 7px 8px;background:linear-gradient(135deg,#6550a9b8,#242148e3);color:#fff;backdrop-filter:blur(26px) saturate(150%);box-shadow:0 16px 45px #160d4570,inset 0 1px #ffffff50;font:700 13px system-ui;animation:da-felcan-fly 5s ease-in-out infinite}',
    '#da-felcan-float:hover{border-color:#e2ceff;box-shadow:0 18px 48px #6c43b766;animation-play-state:paused}',
    ':is(#da-felcan-float,#da-felcan-welcome) .da-felcan-orb{width:44px;height:44px;display:grid;place-items:center;position:relative;overflow:hidden;border:1px solid #fffa;border-radius:17px;background:radial-gradient(circle at 22% 13%,#f0d8ffbb,transparent 55%),linear-gradient(130deg,#a889ef,#5449ac 75%);box-shadow:inset 0 2px 8px #ffffff65,0 0 16px #986ae655;font-size:19px;color:white}',
    ':is(#da-felcan-float,#da-felcan-welcome) .da-felcan-orb::after{content:"";position:absolute;top:8px;left:7px;right:7px;height:8px;border-radius:100%;background:#ffffff60;filter:blur(4px)}',
    '#da-felcan-float .da-felcan-sub{display:block;font-size:10px;font-weight:500;color:#ded5fa;margin-top:2px}',
    '#da-felcan-window{position:fixed;right:20px;bottom:96px;z-index:991;width:min(415px,calc(100vw - 24px));height:min(610px,calc(100dvh - 116px));min-height:320px;overflow:hidden;border:1px solid #e2cfff60;border-radius:26px;background:linear-gradient(150deg,#282348f5,#11152cf8);backdrop-filter:blur(30px);box-shadow:0 25px 90px #09071dbb,inset 0 1px #fff4;display:flex;flex-direction:column;animation:da-felcan-appear .3s ease both}',
    '#da-felcan-window[hidden]{display:none}',
    '#da-felcan-window .da-felcan-head{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:12px 14px;color:#f8f3ff;border-bottom:1px solid #c9b5fc33;background:#9a80e712}',
    '#da-felcan-window .da-felcan-head strong{font-size:14px}',
    '#da-felcan-window .da-felcan-head span{font-size:11px;color:#c5b8e8}',
    '#da-felcan-window .da-felcan-close{border:1px solid #cfbaff66;border-radius:11px;background:#7661b655;color:#fff;font:600 12px system-ui;padding:9px 11px;cursor:pointer}',
    '#da-felcan-window iframe{flex:1;width:100%;min-height:0;border:0;background:transparent}',
    '#da-felcan-window .da-explain{border:1px solid #c5a6ff77;background:#6844b886;color:white;border-radius:11px;padding:8px 9px;cursor:pointer;font:600 11px system-ui}',
    ':is(#da-felcan-float,#da-felcan-welcome) .da-felcan-orb{width:57px;height:63px;border-radius:46% 46% 40% 40%;overflow:visible;position:relative;background:radial-gradient(circle at 28% 9%,#f5e2ff,#ae8bf0 46%,#6552b4);box-shadow:inset 4px 5px 9px #fff9,inset -5px -7px 15px #482d9466,0 0 18px #9365df88}',
    ':is(#da-felcan-float,#da-felcan-welcome) .da-felcan-orb::before{content:"";position:absolute;width:18px;height:26px;background:#a485de;top:-10px;left:5px;border-radius:100% 5% 90% 20%;transform:rotate(-20deg);box-shadow:36px 13px 0 -2px #a485de}',
    ':is(#da-felcan-float,#da-felcan-welcome) .da-felcan-orb::after{display:none}',
    ':is(#da-felcan-float,#da-felcan-welcome) .da-toy-eyes{position:absolute;top:19px;left:12px;font:900 15px system-ui;white-space:pre;color:#302054;letter-spacing:6px}',
    ':is(#da-felcan-float,#da-felcan-welcome) .da-toy-smile{position:absolute;top:32px;left:24px;color:#39235c;font-size:18px;line-height:1}',
    ':is(#da-felcan-float,#da-felcan-welcome) .da-toy-feet{position:absolute;bottom:-6px;left:10px;background:#6645a0;width:14px;height:11px;border-radius:7px;box-shadow:26px 0 #6645a0}',
    ':is(#da-felcan-float,#da-felcan-welcome) .da-toy-spark{position:absolute;right:-10px;top:1px;color:#ffde8f;font-size:17px;filter:drop-shadow(0 0 6px #cba3ff)}',
    '#da-felcan-window[hidden]{display:none!important}',

    '#da-felcan-runtime{position:fixed!important;left:-10px!important;bottom:-10px!important;width:2px!important;height:2px!important;opacity:0!important;overflow:hidden!important;pointer-events:none!important;z-index:-1!important}',
    '#da-felcan-runtime iframe{width:2px;height:2px;border:0;display:block}',
    ':is(#da-felcan-float,#da-felcan-welcome) .da-felcan-orb{transform-origin:50% 82%;transition:filter .2s,transform .2s}',
    ':is(#da-felcan-float,#da-felcan-welcome) .da-toy-smile{transform-origin:center 40%;transition:transform .15s}',
    '#da-felcan-float[data-voice="connecting"] .da-felcan-orb{animation:da-felcan-thinking .65s ease-in-out infinite alternate}',
    '#da-felcan-float[data-voice="listening"] .da-felcan-orb::before{animation:da-felcan-ears .35s ease-in-out infinite alternate}',
    '#da-felcan-float[data-voice="listening"] .da-felcan-orb{filter:drop-shadow(0 0 7px #bc8cff88)}',
    '#da-felcan-float[data-voice="speaking"] .da-felcan-orb{animation:da-felcan-speak .3s ease-in-out infinite alternate}',
    '#da-felcan-float[data-voice="speaking"] .da-toy-smile{animation:da-felcan-mouth .21s linear infinite alternate}',
    '#da-felcan-float[data-voice="speaking"] .da-felcan-orb::before{animation:da-felcan-ears .23s ease-in-out infinite alternate}',
    '#da-felcan-float[data-voice="muted"] .da-felcan-orb{filter:grayscale(.4);opacity:.78}',
    '#da-felcan-float[data-voice="error"] .da-felcan-orb{filter:hue-rotate(55deg)}',
    '@keyframes da-felcan-ears{from{transform:rotate(-26deg) translateY(0)}to{transform:rotate(-9deg) translateY(-6px)}}',
    '@keyframes da-felcan-mouth{from{transform:scaleY(.45);opacity:.7}to{transform:scaleY(1.65) translateY(2px);opacity:1}}',
    '@keyframes da-felcan-speak{from{transform:rotate(-5deg) scale(1)}to{transform:rotate(5deg) scale(1.06)}}',
    '@keyframes da-felcan-thinking{from{transform:rotate(-4deg)}to{transform:rotate(4deg)}}',
    '#da-felcan-hello{position:fixed;right:25px;bottom:116px;z-index:990;width:min(310px,calc(100vw - 36px));padding:14px 35px 14px 16px;border:1px solid #d7c0ff76;border-radius:19px;background:linear-gradient(135deg,#504079ed,#242044ef);color:#fff;box-shadow:0 15px 45px #0c062d8c;backdrop-filter:blur(26px);font:600 13px/1.5 system-ui;cursor:pointer;animation:da-felcan-appear .4s ease both}',
    '#da-felcan-hello::after{content:"";position:absolute;right:31px;bottom:-8px;width:13px;height:13px;transform:rotate(45deg);background:#31284f;border-right:1px solid #d7c0ff76;border-bottom:1px solid #d7c0ff76}',
    '#da-felcan-hello .da-hello-dismiss{position:absolute;right:9px;top:7px;border:0;background:transparent;color:#ede3ff;font:23px system-ui;cursor:pointer}',
    '#da-felcan-float.da-felcan-waving .da-felcan-orb::before{animation:da-felcan-ears .29s ease-in-out infinite alternate}',
    '#da-felcan-float.da-felcan-waving .da-felcan-orb{animation:da-felcan-speak .45s ease-in-out infinite alternate}',
    '@media(max-width:600px){#da-felcan-hello{right:12px;bottom:160px}}',
    '@keyframes da-felcan-fly{0%,100%{transform:translateY(0)}50%{transform:translateY(-9px)}}',
    '@keyframes da-felcan-appear{from{opacity:0;transform:translateY(14px) scale(.97)}to{opacity:1;transform:none}}',
    '@media(max-width:600px){#da-felcan-float{bottom:82px;right:12px;padding:6px;border-radius:19px}#da-felcan-float .da-felcan-text{display:none}#da-felcan-float .da-felcan-orb{width:44px;height:44px}#da-felcan-window{right:8px;bottom:149px;width:calc(100vw - 16px);height:min(570px,calc(100dvh - 168px));border-radius:21px}}',
    '@media(prefers-reduced-motion:reduce){#da-felcan-float,#da-felcan-window{animation:none}}',
    '@media(min-width:1000px){#da-account-action{top:70px;right:23px}}'
  ].join('');
  document.head.append(style);
  function overlay() {
    let node=document.getElementById('da-auth-screen');
    if(!node){node=document.createElement('div');node.id='da-auth-screen';document.body.append(node);}
    node.hidden=false;
    return node;
  }
  function show(mode='login',message='') {
    const screen=overlay();
    if (!origin) {
      screen.innerHTML='<div class="da-card"><h1>DeutschAI</h1><p>Hesap sunucusu henüz yapılandırılmadı.</p></div>';
      return;
    }
    screen.innerHTML='<div class="da-login-shell">'
      +'<section class="da-login-hero"><div class="da-login-brand"><span class="da-brand-mark">✦</span><strong>DeutschAI</strong><span class="da-brand-pill">ALMANCA ÖĞRENMENİN YENİ YOLU</span></div>'
      +'<div class="da-hero-content"><div class="da-login-kicker">✦ KİŞİSEL YAPAY ZEKÂ ÖĞRETMENİN</div><h1>Almanca öğrenmek <em>seninle</em> başlar.</h1><p>Felcan seni tanır, hedeflerini öğrenir ve günlük derslerini ilerlemene göre şekillendirir. Her gün küçük bir adım, her gün gerçek gelişim.</p>'
      +'<div class="da-hero-mascot" aria-hidden="true"><span class="da-hero-ears"></span><span class="da-hero-face">● &nbsp; ●<span>ᴗ</span></span><span class="da-hero-feet"></span><span class="da-hero-star">✧</span></div>'
      +'<div class="da-login-stats"><div><b>7 gün</b><span>Kişisel haftalık plan</span></div><div><b>4 beceri</b><span>Okuma · Yazma · Dinleme · Konuşma</span></div><div><b>AI</b><span>Felcan ile öğrenme</span></div></div></div>'
      +'<p class="da-hero-note">Kendi hızında öğren. Kaldığın yerden devam et.</p></section>'
      +'<section class="da-card da-login-card"><div class="da-form-kicker">DEUTSCHAI HESABIN</div><h2>'+(mode==='register'?'Yolculuğuna başla':'Yeniden hoş geldin!')+'</h2><p>'+(mode==='register'?'Hesabını oluştur; Felcan ilk programını birlikte hazırlasın.':'Almanca yolculuğuna kaldığın yerden devam et.')+'</p>'
      +'<div class="da-tabs" role="group" aria-label="Hesap işlemi"><button type="button" id="da-login-tab" aria-pressed="'+(mode==='login')+'">Giriş Yap</button><button type="button" id="da-signup-tab" aria-pressed="'+(mode==='register')+'">Kayıt Ol</button></div>'
      +'<form id="da-auth-form"><label>Kullanıcı adı<input name="username" autocomplete="username" minlength="3" maxlength="32" required placeholder="Kullanıcı adın"></label>'
      +(mode==='register' ? '<div class="da-name-row"><label>Adın<input name="firstName" autocomplete="given-name" maxlength="80" required placeholder="Adın"></label><label>Soyadın<input name="lastName" autocomplete="family-name" maxlength="80" required placeholder="Soyadın"></label></div><label>E-posta<input name="email" type="email" autocomplete="email" required placeholder="ornek@eposta.com"></label>' : '')
      +'<label>Şifre<input name="password" type="password" minlength="'+(mode==='register'?'10':'1')+'" autocomplete="'+(mode==='register'?'new-password':'current-password')+'" required placeholder="Şifren"></label>'
      +'<p class="da-error" role="alert">'+safe(message)+'</p><button class="da-login-submit" type="submit">'+(mode==='register'?'Hesap Oluştur ✦':'Öğrenmeye Devam Et ✦')+'</button></form>'
      +'<p class="da-login-secure">🔒 İlerlemen hesabına özel saklanır. Yöneticiler giriş günlerini ve yaklaşık aktif çalışma sürelerini görebilir. API anahtarı istenmez.</p></section></div>';
    screen.querySelector('#da-login-tab').onclick=()=>show('login');
    screen.querySelector('#da-signup-tab').onclick=()=>show('register');
    screen.querySelector('#da-auth-form').onsubmit=async event=>{
      event.preventDefault();
      const submit=screen.querySelector('[type=submit]');submit.disabled=true;
      const fields=Object.fromEntries(new FormData(event.currentTarget));
      try {
        auth=await request('/auth/'+(mode==='login'?'login':'register'),{method:'POST',body:JSON.stringify(fields)});
        put(authKey,JSON.stringify(auth));sessionStorage.removeItem('da-hydrated');
        location.reload();
      } catch(e) {screen.querySelector('.da-error').textContent=e.message;submit.disabled=false;}
    };
  }
  async function logout() {
    try {await request('/auth/logout',{method:'POST'});} catch {}
    if(auth?.user?.id)sessionStorage.removeItem('da:welcomed:'+auth.user.id);
    auth=null;del(authKey);sessionStorage.removeItem('da-hydrated');location.reload();
  }
  function admin() {
    if(auth?.user.role!=='admin')return;
    const e=overlay();
    e.innerHTML='<div class="da-card da-admin-card"><div class="da-admin-top"><div><h1>Yönetici Paneli</h1><p>DeutschAI hesapları, roller ve Gemini yönetimi</p></div><button type="button" id="da-admin-close">✕ Kapat</button></div>'
      +'<div class="da-admin-stat-grid"><div><b id="da-users-count">—</b><small>Toplam kayıtlı hesap</small></div><div><b id="da-admins-count">—</b><small>Yöneticiler</small></div><div><b id="da-members-count">—</b><small>Öğrenciler</small></div></div>'
      +'<section class="da-admin-section"><h2>Hesap yönetimi</h2><div class="da-admin-toolbar"><label for="da-user-search">Hesap ara</label><input id="da-user-search" type="search" placeholder="Ad, kullanıcı adı veya e-posta"><button type="button" id="da-reload-users">Yenile</button></div><p id="da-admin-account-status" role="status"></p><div class="da-admin-users" id="da-admin-users" aria-live="polite">Üyeler yükleniyor…</div></section>'
      +'<section class="da-admin-section"><h2>Gemini API anahtarı</h2><p>Ortak anahtarı yalnızca yöneticiler değiştirebilir. Mevcut anahtar tarayıcıya geri gönderilmez.</p><form id="da-admin-form"><label>Yeni Gemini API anahtarı<input name="apiKey" type="password" autocomplete="off" required></label><p class="da-error" role="alert"></p><button type="submit">Anahtarı Kaydet</button></form></section></div>';
    const list=e.querySelector('#da-admin-users');
    const search=e.querySelector('#da-user-search');
    const accountStatus=e.querySelector('#da-admin-account-status');
    const filter=()=>{
      const query=search.value.trim().toLocaleLowerCase('tr-TR');
      for(const item of list.querySelectorAll('.da-admin-user'))item.hidden=!item.dataset.search.includes(query);
    };
    search.oninput=filter;
    function accountAction(user,kind){
      const deleting=kind==='delete';
      const dialog=document.createElement('dialog');dialog.className='da-admin-action-dialog';
      dialog.innerHTML='<form><h2></h2><p></p><label><span></span><input required></label><p role="alert"></p><div class="da-admin-actions"><button type="button">Vazgeç</button><button type="submit"></button></div></form>';
      const form=dialog.querySelector('form');
      const input=form.querySelector('input');
      const status=form.querySelector('[role="alert"]');
      const submit=form.querySelector('[type="submit"]');
      form.querySelector('h2').textContent=deleting?'@'+user.username+' hesabını sil':'@'+user.username+' için yeni parola';
      form.querySelector('h2').id='da-admin-action-title';
      dialog.setAttribute('aria-labelledby','da-admin-action-title');
      form.querySelector('p').textContent=deleting?'Hesap, ilerleme ve çalışma geçmişi kalıcı olarak silinir.':'Yeni parola belirlenir ve açık oturumlar kapanır.';
      form.querySelector('label span').textContent=deleting?'Onaylamak için @ işareti olmadan '+user.username+' yaz':'Yeni parola (10–128 karakter)';
      input.type=deleting?'text':'password';
      input.autocomplete=deleting?'off':'new-password';
      if(!deleting){input.minLength=10;input.maxLength=128}
      submit.textContent=deleting?'Hesabı kalıcı sil':'Parolayı kaydet';
      if(deleting)submit.className='da-admin-danger';
      form.querySelector('[type="button"]').onclick=()=>dialog.close();
      dialog.addEventListener('close',()=>dialog.remove(),{once:true});
      form.onsubmit=async event=>{
        event.preventDefault();
        if(deleting&&input.value!==user.username){status.textContent='Kullanıcı adı eşleşmiyor.';return}
        submit.disabled=true;
        status.textContent='';
        try{
          const payload=deleting?{userId:user.id,confirmUsername:input.value}:{userId:user.id,password:input.value};
          await request(deleting?'/admin/users':'/admin/users/password',{method:deleting?'DELETE':'PUT',body:JSON.stringify(payload)});
          dialog.close();
          await load();
          accountStatus.textContent=deleting?'Hesap silindi.':'Parola değişti ve açık oturumlar kapatıldı.';
        }catch(error){status.textContent=error.message;submit.disabled=false}
      };
      document.body.append(dialog);
      dialog.showModal();
    }
    const minutes=seconds=>{const n=Math.max(0,Number(seconds)||0);return Math.floor(n/3600)+' sa '+Math.floor(n%3600/60)+' dk'};

    e.querySelector('#da-admin-close').onclick=()=>e.hidden=true;
    const load=async()=>{
      list.textContent='Hesaplar yükleniyor…';
      try{
        const data=await request('/admin/users');
        const users=Array.isArray(data.users)?data.users:[];
        accountStatus.textContent=data.accountManagement?'':'Silme ve parola sıfırlama için sunucu güncellemesi bekleniyor.';
        e.querySelector('#da-users-count').textContent=String(data.total??users.length);
        e.querySelector('#da-admins-count').textContent=String(users.filter(u=>u.role==='admin').length);
        e.querySelector('#da-members-count').textContent=String(users.filter(u=>u.role!=='admin').length);
        list.replaceChildren();
        if(!users.length)list.textContent='Henüz kayıtlı hesap yok.';
        for(const u of users){
          const item=document.createElement('article');item.className='da-admin-user';
          item.dataset.search=[u.firstName,u.lastName,u.username,u.email,u.id].join(' ').toLocaleLowerCase('tr-TR');
          const details=document.createElement('div');details.className='da-admin-user-info';
          const title=document.createElement('strong');title.textContent=(u.firstName||'')+' '+(u.lastName||'')+' · @'+u.username;
          const meta=document.createElement('small');meta.textContent=(u.email||'')+' · '+(u.createdAt?new Date(u.createdAt*1000).toLocaleDateString('tr-TR'):'Tarih yok');
          const summary=document.createElement('div');summary.className='da-admin-user-extra';
          for(const value of ['Son 7 gün: '+minutes(u.last7Seconds),'Toplam: '+minutes(u.totalSeconds),'Ziyaret günleri: '+u.visitedDays,'Son giriş/ziyaret: '+(u.lastVisit||'Yok')]){
            const chip=document.createElement('span');chip.textContent=value;summary.append(chip);
          }
          const historyBtn=document.createElement('button');historyBtn.type='button';historyBtn.textContent='Son 30 günü göster';
          historyBtn.style.marginTop='8px';
          const activity=document.createElement('div');activity.className='da-admin-activity';activity.hidden=true;
          historyBtn.onclick=async()=>{
            if(!activity.hidden){activity.hidden=true;historyBtn.textContent='Son 30 günü göster';return}
            activity.hidden=false;historyBtn.textContent='Takvimi gizle';activity.textContent='Günlük kayıtlar yükleniyor…';
            try{
              const result=await request('/admin/users/activity?userId='+encodeURIComponent(u.id));
              const byDay=new Map((result.days||[]).map(day=>[day.day,day]));
              const grid=document.createElement('div');grid.className='da-admin-daygrid';
              // Date keys are relative to Istanbul, matching server recording.
              const dateParts=Object.fromEntries(new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/Istanbul',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date()).map(p=>[p.type,p.value]));
              const ymd=dateParts.year+'-'+dateParts.month+'-'+dateParts.day;
              const [yy,mm,dd]=ymd.split('-').map(Number);
              const base=Date.UTC(yy,mm-1,dd);
              for(let i=29;i>=0;i--){
                const date=new Date(base-i*86400000).toISOString().slice(0,10),d=byDay.get(date);
                const cell=document.createElement('div');cell.className='da-admin-day'+(d?' visited':'');
                const lbl=document.createElement('b');lbl.textContent=date.slice(5);
                const detail=document.createElement('small');detail.textContent=d?(minutes(d.activeSeconds)+' / '+(d.logins||0)+' giriş'):'Kayıt yok';
                cell.title=date+(d?' · Aktif ekran '+minutes(d.activeSeconds)+' · '+(d.logins||0)+' giriş':' · Kayıt bulunamadı');
                cell.append(lbl,detail);grid.append(cell);
              }
              activity.replaceChildren();
              const info=document.createElement('p');info.className='da-admin-activity-summary';
              info.textContent='Son 30 gün · Türkiye saati · Mor günler ziyaret kaydı bulunan günlerdir. Süre, aktif ve görünür sekmede yaklaşık geçirilen zamandır. Eski geçmiş geriye dönük doldurulmaz.';
              activity.append(info,grid);
            }catch(err){activity.textContent='Günlük kayıtlar alınamadı: '+err.message}
          };
          details.append(title,meta,summary,historyBtn,activity);
          const select=document.createElement('select');select.setAttribute('aria-label','@'+u.username+' hesabının rolü');
          for(const [v,label] of [['user','Öğrenci'],['admin','Yönetici']]){
            const option=document.createElement('option');option.value=v;option.textContent=label;option.selected=v===u.role;select.append(option);
          }
          if(u.id===auth.user.id)select.disabled=true;
          select.onchange=async()=>{
            const next=select.value;
            if(!confirm('@'+u.username+' hesabının rolü '+(next==='admin'?'yönetici':'öğrenci')+' olarak değiştirilsin mi? Kullanıcının oturumu kapatılır.')){select.value=u.role;return}
            select.disabled=true;
            try{await request('/admin/users/role',{method:'PUT',body:JSON.stringify({userId:u.id,role:next})});await load()}
            catch(error){alert(error.message);select.value=u.role;select.disabled=u.id===auth.user.id}
          };
          const actions=document.createElement('div');actions.className='da-admin-actions';
          actions.append(select);
          if(data.accountManagement){
            if(u.role==='user'){
              const reset=document.createElement('button');reset.type='button';reset.textContent='Parolayı sıfırla';
              reset.onclick=()=>accountAction(u,'password');actions.append(reset);
            }
            if(u.id!==auth.user.id){
              const remove=document.createElement('button');remove.type='button';remove.textContent='Hesabı sil';remove.className='da-admin-danger';
              remove.onclick=()=>accountAction(u,'delete');actions.append(remove);
            }
          }
          item.append(details,actions);list.append(item);
        }
        filter();
        if(data.total>users.length){const caption=document.createElement('p');caption.textContent='İlk '+users.length+' hesap görüntüleniyor.';list.append(caption)}
      }catch(error){list.textContent='Liste alınamadı: '+error.message+' — Backend güncellemesinin yayımlandığından emin ol.'}
    };
    e.querySelector('#da-reload-users').onclick=load;
    e.querySelector('form').onsubmit=async ev=>{
      ev.preventDefault();
      const status=e.querySelector('.da-error');
      try{await request('/admin/gemini-key',{method:'PUT',body:JSON.stringify(Object.fromEntries(new FormData(ev.currentTarget)))});status.textContent='Anahtar güvenli olarak kaydedildi';ev.currentTarget.reset()}
      catch(error){status.textContent=error.message}
    };
    load();
  }
  function claimAdmin() {
    const e=overlay();
    e.innerHTML='<div class="da-card"><h1>İlk Yönetici Kurulumu</h1><p>Cloudflare üzerinde oluşturduğun ADMIN_BOOTSTRAP_SECRET değerini gir. Bu parola sadece ilk yönetici için bir kere kullanılır; tarayıcıda saklanmaz.</p><form id="da-claim"><label>Kurulum sırrı<input name="bootstrapSecret" type="password" autocomplete="off" required></label><p class="da-error" role="alert"></p><button type="submit">Yönetici Hesabımı Etkinleştir</button> <button type="button" id="da-close">Kapat</button></form></div>';
    e.querySelector('#da-close').onclick=()=>e.hidden=true;
    e.querySelector('form').onsubmit=async event=>{
      event.preventDefault();
      const b=e.querySelector('[type=submit]');b.disabled=true;
      try {
        await request('/admin/claim',{method:'POST',body:JSON.stringify(Object.fromEntries(new FormData(event.currentTarget)))});
        const response=await request('/auth/me');auth.user=response.user;put(authKey,JSON.stringify(auth));location.reload();
      } catch(err) {e.querySelector('.da-error').textContent=err.message;b.disabled=false;}
    };
  }
  function account() {
    if (!auth?.user) return;
    const b=document.createElement('button');b.id='da-account-action';b.className='da-account-button';
    b.textContent=auth.user.firstName+' ▾';document.body.append(b);
    b.onclick=()=>{
      const e=overlay();
      e.innerHTML='<div class="da-card"><h1>Hesabım</h1><p>'+safe(auth.user.firstName)+' '+safe(auth.user.lastName)+' · @'+safe(auth.user.username)+'</p><button id="da-logout">Çıkış Yap</button> '+(auth.user.role==='admin'?'<button id="da-admin">Admin Paneli</button> ':'<button id="da-claim-admin">İlk Yönetici Kurulumu</button> ')+'<button id="da-close">Kapat</button></div>';
      e.querySelector('#da-logout').onclick=logout;
      e.querySelector('#da-close').onclick=()=>e.hidden=true;
      if(auth.user.role==='admin')e.querySelector('#da-admin').onclick=admin;
      else e.querySelector('#da-claim-admin').onclick=claimAdmin;
    };
  }


  // Felcan speaks as a small animated character; a same-origin, visually-hidden
  // iframe keeps the Live connection alive while the learner navigates lessons.
  let lastFelcanContext='', felcanReady=false, felcanRequested=false, felcanState='idle';
  let felcanFocusedQuestion=null;
  const felcanQuestionSelector='.question, .da-question, .adaptive-question, .placement-question';
  function felcanScreenContext(questionNumber){
    const root=document.getElementById('view');
    if(!root)return null;
    const practiceItems=window.deutschaiPracticeItems?.();
    const practiceRoot=practiceItems?root.querySelector('#questions'):null;
    const nodes=[...(practiceRoot||root).querySelectorAll(felcanQuestionSelector)].filter(node=>node.getClientRects().length);
    const total=practiceRoot?practiceItems.length:nodes.length;
    const height=window.innerHeight;
    const visible=nodes.map((node,index)=>({number:index+1,rect:node.getBoundingClientRect()}))
      .filter(({rect})=>rect.bottom>0&&rect.top<height);
    const chosen=nodes.indexOf(felcanFocusedQuestion)+1;
    const selected=visible.some(item=>item.number===chosen)?chosen:0;
    const centered=visible.find(({rect})=>rect.top<=height/2&&rect.bottom>=height/2)?.number||visible[0]?.number||0;
    const requested=Number.isInteger(questionNumber)&&questionNumber>0?questionNumber:0;
    const numbers=requested?(requested<=total?[requested]:[]):[...new Set([selected,centered,...visible.slice(0,6).map(item=>item.number)].filter(Boolean))];
    if(!requested&&!numbers.length&&total===1)numbers.push(1);
    const questions=numbers.map(number=>{
      const node=nodes[number-1];
      const placement=node?.classList.contains('placement-question')?node.closest('.placement-card'):null;
      const saved=practiceRoot?practiceItems[number-1]:null;
      const prompt=saved?.prompt|| (placement?node.textContent.trim():'')||node?.querySelector('p b, b, legend, .da-question-title, .placement-prompt')?.textContent?.trim()||'';
      const passage=saved?.passage||(placement||node)?.querySelector('.study-prompt, .adaptive-question > .muted, .placement-passage')?.textContent?.trim()||'';
      const options=saved?.options||[...((placement||node)?.querySelectorAll('.option, .da-opts button, .adaptive-option, .placement-option, label:has(input[type="radio"])')||[])].map(option=>option.textContent.trim());
      return {number,prompt,passage,options,feedback:node?.querySelector('.feedback, .da-feedback, .adaptive-feedback')?.textContent?.trim()||''};
    });
    return {
      title:root.querySelector('.top h1, h1, .placement-card h2')?.textContent?.trim()||'DeutschAI',
      page:document.querySelector('#nav [aria-current="page"]')?.dataset.page||'home',
      selectedQuestion:selected,centeredQuestion:centered,visibleQuestions:visible.map(item=>item.number),
      questionCount:total,questions,
      grammar:root.querySelector('details[open]')?.textContent?.trim().slice(0,1800)||'',
      lesson:root.querySelector('.classroom-lead, .placement-card')?.textContent?.trim().slice(0,800)||''
    };
  }
  function felcanFrame(){
    return document.querySelector('#da-felcan-runtime iframe');
  }
  function sendFelcanContext(force=false,explain=false){
    const frame=felcanFrame();
    if(!frame?.contentWindow||!felcanReady)return;
    const context=felcanScreenContext();if(!context)return;
    const serialized=JSON.stringify(context);
    if(!force&&serialized===lastFelcanContext)return;
    lastFelcanContext=serialized;
    frame.contentWindow.postMessage({type:explain?'deutschai:explain':'deutschai:context',context},location.origin);
  }
  function felcanVisual(state,message){
    felcanState=state;
    const dialog=document.getElementById('da-felcan-welcome');
    if(dialog){
      dialog.dataset.voice=state;
      const greet=dialog.querySelector('.da-welcome-greet');
      greet.disabled=['connecting','speaking'].includes(state);
      greet.textContent=state==='audio-blocked'?'Sesi aç':state==='error'||state==='listening'?'Tekrar dene':'Felcan’a selam ver';
      dialog.querySelector('.da-welcome-status').textContent=message||'';
    }
    const mobile=document.querySelector('#nav [data-page="live"]');
    if(mobile){
      mobile.dataset.voice=state;
      mobile.title=message||'Felcan ile konuş';
      const label=mobile.querySelector('.study-route-label');
      if(label)label.textContent=state==='audio-blocked'?'Sesi aç':'Felcan';
      mobile.setAttribute('aria-label',state==='audio-blocked'?'Felcan’ın sesini aç':'Felcan ile konuş');
    }
    const button=document.getElementById('da-felcan-float');
    if(!button)return;
    button.dataset.voice=state;
    button.setAttribute('aria-pressed',String(['connecting','listening','speaking','muted'].includes(state)));
    button.setAttribute('aria-label',state==='idle'?'Felcan ile sesli konuşmaya başla':state==='error'?'Felcan bağlantısını yeniden dene':state==='audio-blocked'?'Felcan’ın sesini aç':state==='mic-blocked'?'Felcan için mikrofon izni ver':state==='muted'?'Felcan mikrofonunu aç':'Felcan mikrofonunu duraklat');
    const sub=button.querySelector('.da-felcan-sub');
    if(sub)sub.textContent=message||({idle:'Konuşmak için dokun',connecting:'Bağlanıyor…',listening:'Seni dinliyorum',speaking:'Felcan konuşuyor',muted:'Mikrofon duraklatıldı',error:'Tekrar dokun'}[state]||'Felcan');
  }
  function ensureFelcanRuntime(){
    if(!auth)return null;
    let runtime=document.getElementById('da-felcan-runtime');
    if(runtime)return runtime;
    runtime=document.createElement('div');
    runtime.id='da-felcan-runtime';
    const iframe=document.createElement('iframe');
    iframe.title='Felcan sesli bağlantı';
    iframe.allow='microphone; autoplay';
    iframe.tabIndex=-1;
    iframe.setAttribute('aria-hidden','true');
    iframe.src='./felkan.html?compact=1&v=welcome-admin-1';
    iframe.addEventListener('load',()=>{
      felcanReady=true;
      const greet=document.querySelector('#da-felcan-welcome .da-welcome-greet');
      if(greet)greet.disabled=false;
      sendFelcanContext(true);
      if(felcanRequested){
        felcanRequested=false;
        startFelcanVoice();
      }
    });
    runtime.append(iframe);
    document.body.append(runtime);
    return runtime;
  }
  function startFelcanVoice(){
    if(!auth)return show();
    ensureFelcanRuntime();
    if(!felcanReady){felcanRequested=true;felcanVisual('connecting','Hazırlanıyor…');return}
    try{
      const voice=felcanFrame()?.contentWindow?.FelcanVoiceControl;
      if(!voice?.toggle){felcanVisual('error','Bağlantıyı yeniden dene');return}
      voice.toggle();
    }catch(error){
      console.warn('Felcan ses bağlantısı:',error);
      felcanVisual('error','Ses başlatılamadı');
    }
  }
  function felkan(){startFelcanVoice()}

  let activityTicker=null;
  function startStudyAttendance(){
    if(!auth||activityTicker)return;
    const isActive=()=>document.visibilityState==='visible' && (document.hasFocus?.()!==false);
    const ping=()=>{if(!auth||!origin)return;request('/activity/ping',{method:'POST',body:JSON.stringify({active:isActive()})}).catch(err=>console.warn('Çalışma süresi kaydedilemedi:',err.message))};
    ping();
    activityTicker=setInterval(ping,60000);
    document.addEventListener('visibilitychange',ping);
    window.addEventListener('focus',ping);
    window.addEventListener('blur',ping);
  }
  function felcanWelcome(){
    if(!auth?.user||felcanState!=='idle'||sessionStorage.getItem('da:welcomed:'+auth.user.id))return;
    const welcomeKey='da:welcomed:'+auth.user.id;
    const dialog=document.createElement('dialog');
    dialog.id='da-felcan-welcome';
    dialog.setAttribute('aria-labelledby','da-felcan-welcome-title');
    dialog.innerHTML='<button class="da-welcome-dismiss" type="button" aria-label="Felcan’ı küçült">×</button><h2 id="da-felcan-welcome-title">Felcan</h2><p class="da-welcome-status" role="status"></p><button class="da-welcome-greet" type="button">Felcan’a selam ver</button>';
    const dock=document.getElementById('da-felcan-float');
    const avatar=dock.querySelector('.da-felcan-orb').cloneNode(true);
    dialog.prepend(avatar);
    const greet=dialog.querySelector('.da-welcome-greet');
    greet.disabled=!felcanReady;
    greet.onclick=()=>{
      try{
        const voice=felcanFrame()?.contentWindow?.FelcanVoiceControl;
        if(!voice?.greet)throw Error('Felcan hazırlanıyor. Biraz sonra tekrar dene.');
        voice.greet();
      }catch(error){felcanVisual('error',error.message)}
    };
    dialog.querySelector('.da-welcome-dismiss').onclick=()=>dialog.close();
    dialog.addEventListener('close',()=>{
      sessionStorage.setItem(welcomeKey,'1');
      dialog.remove();
      dock.classList.remove('da-dock-hidden');
      dock.focus({preventScroll:true});
    },{once:true});
    document.body.append(dialog);
    dock.classList.add('da-dock-hidden');
    dialog.showModal();
    greet.focus();
  }

  function floatingFelcan(){
    if(!auth||document.getElementById('da-felcan-float'))return;
    const button=document.createElement('button');
    button.type='button';button.id='da-felcan-float';
    button.dataset.voice='idle';
    button.setAttribute('aria-label','Felcan ile sesli konuşmaya başla');
    button.setAttribute('aria-pressed','false');
    button.innerHTML='<span class="da-felcan-orb" aria-hidden="true"><span class="da-toy-eyes">● ●</span><span class="da-toy-smile">ᴗ</span><span class="da-toy-feet"></span><span class="da-toy-spark">✦</span></span><span class="da-felcan-text">Felcan<span class="da-felcan-sub">Konuşmak için dokun</span></span>';
    button.onclick=startFelcanVoice;
    document.getElementById('view')?.addEventListener('click',event=>{
      const question=event.target.closest(felcanQuestionSelector);
      if(question)felcanFocusedQuestion=question;
    },true);
    document.body.append(button);
    ensureFelcanRuntime();
    if(document.getElementById('deutschai-intro')){
      document.addEventListener('deutschai:intro-finished',()=>{
        if(button.isConnected)felcanWelcome();
      },{once:true});
    }else felcanWelcome();
  }
  window.deutschaiStore=store;
  window.DeutschAI={api:request,store,get user(){return auth?.user||null;},get ready(){return !!origin && !!auth;},logout,showAdmin:admin,openFelkan:felkan,getStudyContext:number=>auth?felcanScreenContext(number):null};
  window.addEventListener('message',event=>{
    if(event.origin!==location.origin)return;
    if(event.data?.type==='deutschai:greeting-played' && event.source===felcanFrame()?.contentWindow){
      document.getElementById('da-felcan-welcome')?.close();
      return;
    }
    if(event.data?.type==='deutschai:voice-state' && event.source===felcanFrame()?.contentWindow){
      felcanVisual(event.data.state||'idle',String(event.data.message||'').slice(0,90));
      return;
    }
    if(event.data?.type==='deutschai:generate'){
      const page=String(event.data.page||'');
      if(event.source===felcanFrame()?.contentWindow&&typeof window.deutschaiRegenerateSection==='function')
        window.deutschaiRegenerateSection(page);
      return;
    }
    if(event.data?.type!=='deutschai:navigate')return;
    if(!['home','lessons','grammar','words','practice','writing','exam','placement','progress'].includes(event.data.page))return;
    if(typeof window.setPage==='function')window.setPage(event.data.page);
    const current=document.querySelector('#nav [aria-current="page"]')?.dataset.page;
    event.source?.postMessage({type:'deutschai:navigated',page:event.data.page,ok:current===event.data.page},event.origin);
    sendFelcanContext(true);
  });
  document.addEventListener('DOMContentLoaded',async()=>{
    if(!origin)return; // Avoid locking the existing GitHub Pages site before backend activation.
    if(!auth){show();return;}
    try{
      const me=await request('/auth/me');
      auth.user=me.user;put(authKey,JSON.stringify(auth));
      const changed=await hydrate();
      if(changed && !sessionStorage.getItem('da-hydrated')){
        sessionStorage.setItem('da-hydrated','1');location.reload();return;
      }
      account();
      floatingFelcan();
      startStudyAttendance();
    } catch(error) {auth=null;del(authKey);show('login',error.message);}
  });
})();