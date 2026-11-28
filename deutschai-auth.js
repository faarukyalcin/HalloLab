/* DilAtölyesi account UI and local-first, account-scoped cloud state. */
(() => {
  'use strict';
  const origin = String(window.DEUTSCHAI_API_URL || '').replace(/\/$/, '');
  const get = localStorage.getItem.bind(localStorage);
  const put = localStorage.setItem.bind(localStorage);
  const del = localStorage.removeItem.bind(localStorage);
  const authKey = 'deutschai:auth:v2';
  const usernameKey = 'deutschai:last-username';
  const rememberUsername = name => {
    if(typeof name==='string'&&/^[a-zA-Z0-9_]{3,32}$/.test(name))put(usernameKey,name);
  };
  const saveSession = () => sessionStorage.setItem(authKey,JSON.stringify(auth));
  let auth = null;
  try { auth = JSON.parse(sessionStorage.getItem(authKey) || 'null'); } catch {}
  const oldSession=get(authKey);
  if(oldSession){
    try{if(!get(usernameKey))rememberUsername(JSON.parse(oldSession)?.user?.username)}catch{}
    del(authKey);
  }
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
    if (!response.ok) throw Object.assign(Error(value.error || 'Sunucu hatası'),{status:response.status});
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
      console.warn('DilAtölyesi bulut kayıt hatası:',key,error);
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
  function hydrate(data) {
    if (!auth||!data) return false;
    const match = new Map(Object.keys(localStorage).filter(k=>k.startsWith(prefix())).map(k=>{
      const key=k.slice(prefix().length);
      return [bucket(key),key];
    }));
    let changed=false;
    for (const [id,entry] of Object.entries(data.buckets || {})) {
      const key=match.get(id)||id;
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
    'body #da-felcan-float{display:grid!important;place-items:center;left:auto;right:max(14px,env(safe-area-inset-right));top:50%;bottom:auto;transform:translateY(-50%);width:50px;height:50px;padding:0;border-radius:18px;animation:none}',
    '#da-felcan-float .da-felcan-text{display:none}',
    'body #da-felcan-float .da-felcan-orb{transform:scale(.56)}',
    '#da-felcan-float[data-voice="speaking"] .da-felcan-orb,#da-felcan-float[data-voice="connecting"] .da-felcan-orb{animation:none}',
    'body #da-felcan-float[data-voice="speaking"]{border-color:#e4c4ff;box-shadow:0 0 20px #ac79ee90}',
    '.da-admin-action-dialog{max-width:calc(100vw - 32px);border:1px solid #aa94ed70;border-radius:26px;padding:28px;background:linear-gradient(150deg,#292346,#15182e);color:#f8f5ff;box-shadow:0 26px 80px #080917a8;font:15px/1.5 system-ui}',
    '.da-admin-action-dialog::backdrop{background:#070a1bb0;backdrop-filter:blur(5px)}',
    '.da-admin-action-dialog button{border:1px solid #c6abff65;background:#654bd0;color:white;border-radius:12px;padding:10px 15px;font:700 14px system-ui;cursor:pointer}',
    '.da-admin-action-dialog button:disabled{opacity:.65;cursor:wait}',
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
    '@media(max-width:999px){body #da-felcan-float{display:none!important}}',
    '@media(max-width:650px){#da-auth-screen .da-admin-user{flex-direction:column}#da-auth-screen .da-admin-actions{justify-content:flex-start}}',
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
    '#da-felcan-float .da-felcan-orb{width:44px;height:44px;display:grid;place-items:center;position:relative;overflow:hidden;border:1px solid #fffa;border-radius:17px;background:radial-gradient(circle at 22% 13%,#f0d8ffbb,transparent 55%),linear-gradient(130deg,#a889ef,#5449ac 75%);box-shadow:inset 0 2px 8px #ffffff65,0 0 16px #986ae655;font-size:19px;color:white}',
    '#da-felcan-float .da-felcan-orb::after{content:"";position:absolute;top:8px;left:7px;right:7px;height:8px;border-radius:100%;background:#ffffff60;filter:blur(4px)}',
    '#da-felcan-float .da-felcan-sub{display:block;font-size:10px;font-weight:500;color:#ded5fa;margin-top:2px}',
    '#da-felcan-window{position:fixed;right:20px;bottom:96px;z-index:991;width:min(415px,calc(100vw - 24px));height:min(610px,calc(100dvh - 116px));min-height:320px;overflow:hidden;border:1px solid #e2cfff60;border-radius:26px;background:linear-gradient(150deg,#282348f5,#11152cf8);backdrop-filter:blur(30px);box-shadow:0 25px 90px #09071dbb,inset 0 1px #fff4;display:flex;flex-direction:column;animation:da-felcan-appear .3s ease both}',
    '#da-felcan-window[hidden]{display:none}',
    '#da-felcan-window .da-felcan-head{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:12px 14px;color:#f8f3ff;border-bottom:1px solid #c9b5fc33;background:#9a80e712}',
    '#da-felcan-window .da-felcan-head strong{font-size:14px}',
    '#da-felcan-window .da-felcan-head span{font-size:11px;color:#c5b8e8}',
    '#da-felcan-window .da-felcan-close{border:1px solid #cfbaff66;border-radius:11px;background:#7661b655;color:#fff;font:600 12px system-ui;padding:9px 11px;cursor:pointer}',
    '#da-felcan-window iframe{flex:1;width:100%;min-height:0;border:0;background:transparent}',
    '#da-felcan-window .da-explain{border:1px solid #c5a6ff77;background:#6844b886;color:white;border-radius:11px;padding:8px 9px;cursor:pointer;font:600 11px system-ui}',
    '#da-felcan-float .da-felcan-orb{width:57px;height:63px;border-radius:46% 46% 40% 40%;overflow:visible;position:relative;background:radial-gradient(circle at 28% 9%,#f5e2ff,#ae8bf0 46%,#6552b4);box-shadow:inset 4px 5px 9px #fff9,inset -5px -7px 15px #482d9466,0 0 18px #9365df88}',
    '#da-felcan-float .da-felcan-orb::before{content:"";position:absolute;width:18px;height:26px;background:#a485de;top:-10px;left:5px;border-radius:100% 5% 90% 20%;transform:rotate(-20deg);box-shadow:36px 13px 0 -2px #a485de}',
    '#da-felcan-float .da-felcan-orb::after{display:none}',
    '#da-felcan-float .da-toy-eyes{position:absolute;top:19px;left:12px;font:900 15px system-ui;white-space:pre;color:#302054;letter-spacing:6px}',
    '#da-felcan-float .da-toy-smile{position:absolute;top:32px;left:24px;color:#39235c;font-size:18px;line-height:1}',
    '#da-felcan-float .da-toy-feet{position:absolute;bottom:-6px;left:10px;background:#6645a0;width:14px;height:11px;border-radius:7px;box-shadow:26px 0 #6645a0}',
    '#da-felcan-float .da-toy-spark{position:absolute;right:-10px;top:1px;color:#ffde8f;font-size:17px;filter:drop-shadow(0 0 6px #cba3ff)}',
    '#da-felcan-window[hidden]{display:none!important}',

    '#da-felcan-runtime{position:fixed!important;left:-10px!important;bottom:-10px!important;width:2px!important;height:2px!important;opacity:0!important;overflow:hidden!important;pointer-events:none!important;z-index:-1!important}',
    '#da-felcan-runtime iframe{width:2px;height:2px;border:0;display:block}',
    '#da-felcan-float .da-felcan-orb{transform-origin:50% 82%;transition:filter .2s,transform .2s}',
    '#da-felcan-float .da-toy-smile{transform-origin:center 40%;transition:transform .15s}',
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
      screen.innerHTML='<div class="da-card"><h1>DilAtölyesi</h1><p>Hesap sunucusu henüz yapılandırılmadı.</p></div>';
      return;
    }
    screen.innerHTML='<div class="da-login-shell">'
      +'<section class="da-login-hero"><div class="da-login-brand"><span class="da-brand-mark">✦</span><strong>DilAtölyesi</strong><span class="da-brand-pill">ALMANCA ÖĞRENMENİN YENİ YOLU</span></div>'
      +'<div class="da-hero-content"><div class="da-login-kicker">✦ KİŞİSEL YAPAY ZEKÂ ÖĞRETMENİN</div><h1>Almanca öğrenmek <em>seninle</em> başlar.</h1><p>Edit seni tanır, hedeflerini öğrenir ve günlük derslerini ilerlemene göre şekillendirir. Her gün küçük bir adım, her gün gerçek gelişim.</p>'
      +'<div class="da-hero-mascot" aria-hidden="true"><span class="da-hero-ears"></span><span class="da-hero-face">● &nbsp; ●<span>ᴗ</span></span><span class="da-hero-feet"></span><span class="da-hero-star">✧</span></div>'
      +'<div class="da-login-stats"><div><b>7 gün</b><span>Kişisel haftalık plan</span></div><div><b>4 beceri</b><span>Okuma · Yazma · Dinleme · Konuşma</span></div><div><b>AI</b><span>Edit ile öğrenme</span></div></div></div>'
      +'<p class="da-hero-note">Kendi hızında öğren. Kaldığın yerden devam et.</p></section>'
      +'<section class="da-card da-login-card"><div class="da-form-kicker">DİLATÖLYESİ HESABIN</div><h2>'+(mode==='register'?'Yolculuğuna başla':'Yeniden hoş geldin!')+'</h2><p>'+(mode==='register'?'Hesabını oluştur; Edit ilk programını birlikte hazırlasın.':'Almanca yolculuğuna kaldığın yerden devam et.')+'</p>'
      +'<div class="da-tabs" role="group" aria-label="Hesap işlemi"><button type="button" id="da-login-tab" aria-pressed="'+(mode==='login')+'">Giriş Yap</button><button type="button" id="da-signup-tab" aria-pressed="'+(mode==='register')+'">Kayıt Ol</button></div>'
      +'<form id="da-auth-form" autocomplete="off"><label>Kullanıcı adı<input name="username" autocomplete="username" minlength="3" maxlength="32" required placeholder="Kullanıcı adın"></label>'
      +(mode==='register' ? '<div class="da-name-row"><label>Adın<input name="firstName" autocomplete="given-name" maxlength="80" required placeholder="Adın"></label><label>Soyadın<input name="lastName" autocomplete="family-name" maxlength="80" required placeholder="Soyadın"></label></div><label>E-posta<input name="email" type="email" autocomplete="email" required placeholder="ornek@eposta.com"></label>' : '')
      +'<label>Şifre<input name="password" type="password" minlength="'+(mode==='register'?'10':'1')+'" autocomplete="new-password" required placeholder="Şifren"></label>'
      +'<p class="da-error" role="alert">'+safe(message)+'</p><button class="da-login-submit" type="submit">'+(mode==='register'?'Hesap Oluştur ✦':'Öğrenmeye Devam Et ✦')+'</button></form>'
      +'<p class="da-login-secure">🔒 İlerlemen hesabına özel saklanır. Yöneticiler giriş günlerini ve yaklaşık aktif çalışma sürelerini görebilir. API anahtarı istenmez.</p></section></div>';
    screen.querySelector('#da-login-tab').onclick=()=>show('login');
    screen.querySelector('#da-signup-tab').onclick=()=>show('register');
    const form=screen.querySelector('#da-auth-form');
    if(mode==='login'){
      const username=get(usernameKey)||'';
      form.elements.username.value=username;
      if(username)form.elements.password.focus();
    }
    form.onsubmit=async event=>{
      event.preventDefault();
      const submit=screen.querySelector('[type=submit]');submit.disabled=true;
      const fields=Object.fromEntries(new FormData(form));
      form.elements.password.value='';
      try {
        auth=await request('/auth/'+(mode==='login'?'login':'register'),{method:'POST',body:JSON.stringify(fields)});
        rememberUsername(auth?.user?.username);
        saveSession();sessionStorage.removeItem('da-hydrated');
        location.reload();
      } catch(e) {screen.querySelector('.da-error').textContent=e.message;submit.disabled=false;}
    };
  }
  async function logout() {
    try {await request('/auth/logout',{method:'POST'});} catch {}
    auth=null;sessionStorage.removeItem(authKey);sessionStorage.removeItem('da-hydrated');location.reload();
  }
  function admin() {
    if(auth?.user.role!=='admin')return;
    const e=overlay();
    e.innerHTML='<div class="da-card da-admin-card"><div class="da-admin-top"><div class="da-admin-heading"><span class="da-admin-emblem" aria-hidden="true">✦</span><div><small>YÖNETİM MERKEZİ</small><h1>Yönetici Paneli</h1><p>Hesaplar, roller ve Gemini yönetimi</p></div></div><button type="button" id="da-admin-close" aria-label="Kapat">✕</button></div>'
      +'<div class="da-admin-stat-grid"><div><b id="da-users-count">—</b><small>Toplam kayıtlı hesap</small></div><div><b id="da-admins-count">—</b><small>Yöneticiler</small></div><div><b id="da-members-count">—</b><small>Öğrenciler</small></div></div>'
      +'<section class="da-admin-section"><h2>Hesap yönetimi</h2><div class="da-admin-toolbar"><label for="da-user-search">Hesap ara</label><input id="da-user-search" type="search" placeholder="Ad, kullanıcı adı veya e-posta"><button type="button" id="da-reload-users">Yenile</button></div><p id="da-admin-account-status" role="status"></p><div class="da-admin-users" id="da-admin-users" aria-live="polite">Üyeler yükleniyor…</div></section>'
      +'<section class="da-admin-section"><h2>Gemini API anahtarı</h2><p>Ortak anahtarı yöneticiler değiştirebilir. Mevcut anahtar tarayıcıya geri gönderilmez.</p><form id="da-admin-form"><label>Yeni Gemini API anahtarı<input name="apiKey" type="password" autocomplete="off" required></label><p class="da-error" role="alert"></p><button type="submit">Anahtarı Kaydet</button></form></section></div>';
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
        if(data.isFounder===false&&!users.some(u=>u.isFounder)&&data.total===users.length){const setup=document.createElement('button');setup.type='button';setup.textContent='Kurucu hesabını doğrula';setup.onclick=claimAdmin;list.append(setup)}
        if(!users.length)list.textContent='Henüz kayıtlı hesap yok.';
        for(const u of users){
          const item=document.createElement('article');item.className='da-admin-user';if(u.isFounder||u.role==='admin')item.dataset.staff=u.isFounder?'founder':'admin';
          item.dataset.search=[u.firstName,u.lastName,u.username,u.email,u.id].join(' ').toLocaleLowerCase('tr-TR');
          const details=document.createElement('div');details.className='da-admin-user-info';
          const title=document.createElement('strong');title.textContent=(u.firstName||'')+' '+(u.lastName||'')+' · @'+u.username+(u.isFounder?' · 👑 Kurucu':'');
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
          if(u.id===auth.user.id||u.isFounder||data.isFounder===false)select.disabled=true;
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
            if(u.id!==auth.user.id&&!u.isFounder&&(u.role!=='admin'||data.isFounder!==false)){
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
        const response=await request('/auth/me');auth.user=response.user;saveSession();location.reload();
      } catch(err) {e.querySelector('.da-error').textContent=err.message;b.disabled=false;}
    };
  }
  async function community() {
    const e=overlay();
    e.innerHTML='<div class="da-card da-profile-card da-community-card"><div class="da-profile-actions" style="justify-content:space-between;margin:0"><h2 style="margin:0">Öğrenci topluluğu</h2><button type="button" id="da-community-close">✕</button></div><p>Birlikte öğren, seviyeleri keşfet ve başarıları kutla.</p><p>Profilini paylaşmak için Profilim bölümündeki topluluk ayarını açabilirsin.</p><div id="da-community-list" aria-live="polite">Öğrenciler yükleniyor…</div><button type="button" id="da-community-more" hidden>Weitere · Daha fazla</button></div>';
    const list=e.querySelector('#da-community-list'),more=e.querySelector('#da-community-more');
    e.querySelector('#da-community-close').onclick=()=>e.hidden=true;
    let offset=0;
    async function load(){
      more.disabled=true;
      try{
        const data=await request('/community?offset='+offset);
        if(!list.isConnected)return;
        if(offset===0)list.replaceChildren();
        for(const m of data.members||[]){
          const card=document.createElement('article');card.className='da-community-member da-profile-level';if(m.role==='founder'||m.role==='admin')card.dataset.staff=m.role;
          const avatar=document.createElement('span');avatar.className='da-profile-avatar';
          const name=m.displayName||m.username;
          if(typeof m.photo==='string'&&m.photo.length<60000&&/^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/.test(m.photo)){const img=document.createElement('img');img.src=m.photo;img.alt='';avatar.append(img)}else avatar.textContent=String(name||'?').slice(0,2).toLocaleUpperCase('tr');
          const body=document.createElement('div');body.style.minWidth='0';const title=document.createElement('strong');title.textContent=name;const meta=document.createElement('small');meta.textContent='@'+m.username+(m.visible?' · '+(m.level||'Seviye belirlenmedi'):' · Gizli profil');body.append(title,meta);
          if(m.role==='founder'||m.role==='admin'){const roles=document.createElement('div');roles.className='da-community-badges';const chip=document.createElement('span');chip.textContent=m.role==='founder'?'👑 Kurucu':'🛡️ Yönetici';roles.append(chip);body.append(roles)}
          if(m.visible){const info=document.createElement('small');info.textContent=String(m.lessons||0)+' tamamlanan ders';body.append(info);const badges=document.createElement('div');badges.className='da-community-badges';for(const badge of m.badges||[]){const chip=document.createElement('span');chip.textContent='🏅 '+badge;badges.append(chip)}body.append(badges)}
          card.append(avatar,body);list.append(card);
        }
        if(!list.childElementCount)list.textContent='Henüz topluluk üyesi yok.';
        offset=data.nextOffset;more.hidden=offset==null;
      }catch(err){if(list.isConnected)list.textContent='Topluluk yüklenemedi: '+err.message}
      finally{more.disabled=false}
    }
    more.onclick=load;await load();
  }
  function account() {
    if (!auth?.user || document.getElementById('da-account-action')) return;
    const key='deutschai-personal-profile-v1';
    const read=k=>{try{return JSON.parse(store.getItem(k)||'null')||{}}catch{return {}}};
    const levels=['A1','A2','B1','B2','C1','C2'];
    const validPhoto=v=>typeof v==='string'&&/^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/.test(v)&&v.length<60000;
    const b=document.createElement('button');b.id='da-account-action';b.className='da-account-button';
    const style=document.createElement('style');
    style.textContent=`
      #da-account-action{display:flex;align-items:center;gap:7px}
      .study-header .study-tools:has(#da-account-action){display:flex;align-items:center;gap:6px;flex-wrap:nowrap}
      .study-header #da-account-action{position:relative!important;inset:auto!important;z-index:auto;flex:none;max-width:125px;min-width:0;padding:5px 8px;border-radius:14px;background:linear-gradient(145deg,#ffffff20,#ffffff08);border:1px solid #b8a9ed60;box-shadow:inset 0 1px 0 #ffffff30;color:var(--ink,#fff);font-size:12px;white-space:nowrap}
      .study-header #da-account-action .da-profile-label{overflow:hidden;text-overflow:ellipsis;max-width:68px}
      @media(max-width:600px){body .app.study-app>.study-header .study-brand{font-size:clamp(12px,3.6vw,17px);gap:7px}body .app.study-app>.study-header .study-mark{width:34px;height:34px} .study-header #da-account-action{max-width:100px;padding:4px 6px;gap:4px;min-height:40px}.study-header #da-account-action .da-profile-avatar{width:27px;height:27px}.study-header #da-account-action .da-profile-label{max-width:45px}body .app.study-app>.study-header .study-appearance>summary{width:36px;height:40px}}
      @media(max-width:360px){.study-header #da-account-action .da-profile-label{max-width:34px}.study-header #da-account-action{padding:4px;gap:3px}}
      .da-profile-avatar{display:inline-grid;place-items:center;overflow:hidden;flex:none;border-radius:50%;background:linear-gradient(145deg,color-mix(in srgb,var(--green,#b59aff) 65%,var(--paper,#252347)),var(--paper,#252347));color:var(--ink,#fff);font-weight:800;width:32px;height:32px;border:1px solid var(--line,#ffffff65)}
      .da-profile-avatar img{width:100%;height:100%;object-fit:cover}
      #da-auth-screen:has(.da-profile-card){background:color-mix(in srgb,var(--bg,#101329) 38%,transparent);backdrop-filter:blur(9px) saturate(120%);-webkit-backdrop-filter:blur(9px) saturate(120%);color:var(--ink,#fff)}
      #da-auth-screen .da-profile-card{box-sizing:border-box;width:min(470px,100%);max-height:calc(100dvh - 36px);padding:22px;border-radius:28px;background:radial-gradient(ellipse at 5% 0%,color-mix(in srgb,var(--green,#b59aff) 24%,transparent),transparent 55%),radial-gradient(ellipse at 100% 100%,color-mix(in srgb,var(--green,#b59aff) 16%,transparent),transparent 55%),linear-gradient(145deg,color-mix(in srgb,var(--paper,#252347) 87%,transparent),color-mix(in srgb,var(--bg,#101329) 80%,transparent));border:1px solid color-mix(in srgb,var(--green,#b59aff) 42%,var(--line,#ffffff44));box-shadow:inset 0 1px 1px #ffffff55,inset 0 -1px 14px color-mix(in srgb,var(--green,#b59aff) 14%,transparent),0 24px 80px #0006;backdrop-filter:blur(32px) saturate(160%);-webkit-backdrop-filter:blur(32px) saturate(160%);color:var(--ink,#fff)}
      .da-profile-head{display:flex;gap:15px;align-items:center;margin:15px 0}.da-profile-head .da-profile-avatar{width:72px;height:72px;font-size:25px}
      .da-profile-head h2{margin:0;overflow-wrap:anywhere}#da-auth-screen .da-profile-card :is(p,label,small,.da-profile-muted){color:var(--muted,#c9c1e4)}
      .da-profile-level,.da-profile-stat{border:1px solid var(--line,#ffffff33);border-radius:16px;background:linear-gradient(145deg,color-mix(in srgb,var(--green,#b59aff) 10%,transparent),color-mix(in srgb,var(--paper,#252347) 38%,transparent));padding:12px;box-shadow:inset 0 1px 0 #ffffff20}
      .da-profile-level h2{color:var(--green,#b59aff)}
      .da-profile-stats{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:7px;margin:10px 0}.da-profile-stat{text-align:center}.da-profile-stat b{display:block;font-size:20px}.da-profile-stat small{font-size:11px}
      #da-auth-screen .da-profile-card button{color:var(--ink,#fff);background:linear-gradient(145deg,color-mix(in srgb,var(--green,#b59aff) 25%,var(--paper,#252347)),color-mix(in srgb,var(--green,#b59aff) 10%,var(--paper,#252347)));border-color:color-mix(in srgb,var(--green,#b59aff) 38%,var(--line,#ffffff44));box-shadow:inset 0 1px 0 #ffffff28}
      #da-auth-screen .da-profile-card input,#da-auth-screen .da-profile-card textarea,#da-auth-screen .da-profile-card select{width:100%;box-sizing:border-box;background:var(--paper,#252347);color:var(--ink,#fff);border:1px solid var(--line,#ffffff44);border-radius:10px;padding:10px;font:inherit}
      .da-community-card{width:min(540px,100%)!important}.da-community-member{display:flex;gap:12px;align-items:flex-start;margin:10px 0;overflow-wrap:anywhere}.da-community-member .da-profile-avatar{width:48px;height:48px}.da-community-member small{display:block;margin:4px 0}.da-community-badges{display:flex;flex-wrap:wrap;gap:5px;margin-top:6px}.da-community-badges span{font-size:11px;padding:5px 8px;border-radius:999px;border:1px solid var(--line,#ffffff33);background:color-mix(in srgb,var(--green,#b59aff) 12%,transparent)}
      /* Shared theme glass for management, with subtle purple staff accents. */
      #da-auth-screen:has(.da-admin-card){background:color-mix(in srgb,var(--bg,#101329) 35%,#09091d44);-webkit-backdrop-filter:blur(10px) saturate(125%);backdrop-filter:blur(10px) saturate(125%);color:var(--ink,#fff)}
      #da-auth-screen .da-admin-card{box-sizing:border-box;width:min(1040px,100%);max-height:calc(100dvh - 36px);padding:clamp(14px,3vw,28px);border-radius:28px;color:var(--ink,#fff);border:1px solid color-mix(in srgb,var(--green,#b59aff) 35%,var(--line,#ffffff44));background:radial-gradient(ellipse at 5% 0%,color-mix(in srgb,var(--green,#b59aff) 19%,transparent),transparent 50%),linear-gradient(145deg,color-mix(in srgb,var(--paper,#252347) 94%,transparent),color-mix(in srgb,var(--bg,#101329) 88%,transparent));-webkit-backdrop-filter:blur(32px) saturate(160%);backdrop-filter:blur(32px) saturate(160%);box-shadow:inset 0 1px 0 #ffffff55,0 24px 80px #0006;overscroll-behavior:contain}
      #da-auth-screen .da-admin-heading{display:flex;align-items:center;gap:12px;min-width:0}#da-auth-screen .da-admin-heading h1{font-size:clamp(20px,4.5vw,29px);letter-spacing:-.045em;margin:3px 0}#da-auth-screen .da-admin-heading small{font-size:10px;letter-spacing:.13em;font-weight:800;color:var(--green,#b59aff)}#da-auth-screen .da-admin-heading p{font-size:12px;margin:0}
      #da-auth-screen .da-admin-emblem{display:grid;place-items:center;flex:none;width:45px;height:45px;border:1px solid color-mix(in srgb,var(--green,#b59aff) 40%,transparent);border-radius:15px;background:color-mix(in srgb,var(--green,#b59aff) 20%,transparent);box-shadow:inset 0 1px 0 #ffffff30;color:var(--green,#b59aff);font-size:26px}
      #da-auth-screen .da-admin-top{align-items:center;padding-bottom:14px;border-bottom:1px solid var(--line,#ffffff33)}#da-auth-screen #da-admin-close{border-radius:50%;width:36px;height:36px;padding:0;flex:none}
      #da-auth-screen .da-admin-card :is(p,label,small,.da-admin-activity-summary){color:var(--muted,#c9c1e4)}
      #da-auth-screen .da-admin-card :is(.da-admin-section,.da-admin-stat-grid>div,.da-admin-user,.da-admin-activity,.da-admin-day){background:linear-gradient(145deg,color-mix(in srgb,var(--green,#b59aff) 8%,var(--paper,#252347)),color-mix(in srgb,var(--paper,#252347) 65%,transparent));border:1px solid var(--line,#ffffff33);box-shadow:inset 0 1px 0 #ffffff19}
      #da-auth-screen .da-admin-card .da-admin-section{border-radius:21px;padding:clamp(12px,3vw,18px)}#da-auth-screen .da-admin-card .da-admin-stat-grid{margin-top:16px}#da-auth-screen .da-admin-card .da-admin-stat-grid b{color:var(--green,#b59aff);font-variant-numeric:tabular-nums}
      #da-auth-screen .da-admin-card :is(input,select){background:var(--paper,#252347);color:var(--ink,#fff);border:1px solid var(--line,#ffffff44);border-radius:12px}
      #da-auth-screen .da-admin-card button{background:linear-gradient(145deg,color-mix(in srgb,var(--green,#b59aff) 20%,var(--paper,#252347)),color-mix(in srgb,var(--green,#b59aff) 8%,var(--paper,#252347)));color:var(--ink,#fff);border-color:color-mix(in srgb,var(--green,#b59aff) 35%,var(--line,#ffffff44));box-shadow:inset 0 1px 0 #ffffff22;border-radius:12px}
      #da-auth-screen .da-admin-card .da-admin-danger{background:color-mix(in srgb,#dc557b 17%,var(--paper,#252347));color:var(--ink,#fff);border-color:#dc557b80}
      #da-auth-screen .da-admin-card .da-admin-user-extra span{background:color-mix(in srgb,var(--green,#b59aff) 10%,transparent);color:var(--ink,#fff);border-color:var(--line,#ffffff33)}
      #da-auth-screen .da-admin-card .da-admin-day b{color:var(--ink,#fff)}#da-auth-screen .da-admin-card .da-admin-day.visited{background:color-mix(in srgb,var(--green,#b59aff) 22%,var(--paper,#252347));border-color:var(--green,#b59aff)}
      #da-auth-screen :is(.da-community-member,.da-admin-user)[data-staff]{border:1px solid #b28aff85;background:radial-gradient(ellipse at 0% 0%,#ad7aff20,transparent 72%),color-mix(in srgb,var(--paper,#252347) 85%,transparent);box-shadow:0 0 15px #a16bfa25,inset 0 1px 0 #c5a5ff44}
      #da-auth-screen :is(.da-community-member,.da-admin-user)[data-staff="founder"]{border-color:#c2a0ffb0;box-shadow:0 0 20px #b17aff38,inset 0 1px 0 #d9c2ff60}
      #da-auth-screen .da-community-member[data-staff] .da-profile-avatar{border-color:#c2a0ffb0;box-shadow:0 0 12px #b184ff55}
      #da-auth-screen .da-community-member[data-staff] .da-community-badges span{border-color:#b28aff70}
      @media(max-width:600px){#da-auth-screen:has(.da-admin-card){padding:10px}#da-auth-screen .da-admin-card{max-height:calc(100dvh - 20px);padding:14px;border-radius:24px}#da-auth-screen .da-admin-heading{gap:8px}#da-auth-screen .da-admin-emblem{width:38px;height:38px}#da-auth-screen .da-admin-actions{flex-wrap:wrap;gap:6px}#da-auth-screen .da-admin-actions button{flex:1;min-height:40px}}
      .da-profile-actions{display:flex;flex-wrap:wrap;gap:8px;margin-top:12px}.da-profile-card form{display:grid;gap:10px}.da-profile-card [hidden]{display:none!important}
    `;document.head.append(style);
    function avatar(photo,name){const s=document.createElement('span');s.className='da-profile-avatar';if(validPhoto(photo)){const img=document.createElement('img');img.src=photo;img.alt='';s.append(img)}else{s.textContent=(name||'?').trim().slice(0,2).toLocaleUpperCase('tr')}return s}
    function refresh(){const p=read(key);const label=document.createElement('span');label.className='da-profile-label';label.textContent=p.displayName||auth.user.firstName;b.setAttribute('aria-label',label.textContent+' · Profilim');b.replaceChildren(avatar(p.photo,auth.user.firstName),label,document.createTextNode('▾'))}
    refresh();(document.querySelector('.study-header .study-tools')||document.body).append(b);
    b.onclick=()=>{
      const e=overlay(),p=read(key),learning=read('deutschai-ai-profile-v1'),placement=read('deutschai-ai-placement-v1'),progress=read('deutschai-online-v1');
      const level=levels.includes(placement.level)?placement.level:levels.includes(learning.level)?learning.level:'Belirlenmedi';
      const fullName=[auth.user.firstName,auth.user.lastName].filter(Boolean).join(' ');
      e.innerHTML='<div class="da-card da-profile-card"><div class="da-profile-actions" style="justify-content:space-between;margin:0"><strong>PROFİLİM</strong><button type="button" id="da-close" aria-label="Kapat">✕</button></div><div class="da-profile-head"><span id="da-profile-photo"></span><div><h2 id="da-profile-name"></h2><small id="da-profile-handle"></small></div></div><div class="da-profile-level"><small class="da-profile-muted">Almanca seviyen</small><h2 style="margin:5px 0">'+safe(level)+'</h2><small class="da-profile-muted">'+(levels.includes(placement.level)?'Seviye tespit sınavı sonucu':level==='Belirlenmedi'?'Seviye tespit sınavını tamamla':'Mevcut çalışma seviyesi')+'</small></div><div class="da-profile-stats"><div class="da-profile-stat"><b>'+safe(Array.isArray(progress.completed)?progress.completed.length:0)+'</b><small>Ders</small></div><div class="da-profile-stat"><b>'+safe(Number(progress.xp)||0)+'</b><small>XP</small></div><div class="da-profile-stat"><b>'+safe(Number(learning.dailyMinutes)||Number(progress.daily)||0)+'</b><small>Günlük dk.</small></div></div><p id="da-profile-bio" class="da-profile-muted"></p><button type="button" id="da-profile-edit">Profili düzenle</button> <button type="button" id="da-community-open">Öğrenci topluluğu</button><form id="da-profile-form" hidden><label>Profil fotoğrafı<input type="file" accept="image/*" id="da-profile-file"></label><button type="button" id="da-profile-remove">Fotoğrafı kaldır</button><label>Görünen ad<input name="displayName" maxlength="60"></label><label>Şehir<input name="city" maxlength="60"></label><label>Doğum tarihi (isteğe bağlı)<input name="birthday" type="date"></label><label>Hakkımda<textarea name="bio" maxlength="240" rows="3"></textarea></label><label>Hedef seviye<select name="goal"><option value="">Seçiniz</option>'+levels.map(x=>'<option>'+x+'</option>').join('')+'</select></label><label style="display:flex;align-items:center;gap:8px"><input style="width:auto" type="checkbox" name="communityVisible"> Fotoğrafımı, görünen adımı, seviyemi ve rozetlerimi diğer öğrencilere göster</label><button type="submit">Değişiklikleri kaydet</button></form><p id="da-profile-status" role="status" class="da-profile-muted"></p><div class="da-profile-actions">'+(auth.user.role==='admin'?'<button id="da-admin">Admin Paneli</button>':'<button id="da-claim-admin">İlk Yönetici Kurulumu</button>')+'<button id="da-logout">Çıkış Yap</button></div></div>';
      const q=s=>e.querySelector(s),form=q('#da-profile-form'),status=q('#da-profile-status');
      let photo=validPhoto(p.photo)?p.photo:'',busy=false;
      const paint=()=>q('#da-profile-photo').replaceChildren(avatar(photo,fullName));
      paint();q('#da-profile-name').textContent=p.displayName||fullName;q('#da-profile-handle').textContent='@'+auth.user.username+' · '+(auth.user.role==='admin'?'Yönetici':'Öğrenci');
      q('#da-profile-bio').textContent=[p.city,p.bio,p.goal?'Hedef: '+p.goal:''].filter(Boolean).join(' · ');
      for(const field of ['displayName','city','birthday','bio','goal'])form.elements[field].value=p[field]||'';
      form.elements.communityVisible.checked=p.communityVisible===true;
      q('#da-community-open').onclick=community;
      q('#da-profile-edit').onclick=()=>{form.hidden=!form.hidden;q('#da-profile-edit').textContent=form.hidden?'Profili düzenle':'Düzenlemeyi kapat'};
      q('#da-profile-remove').onclick=()=>{photo='';q('#da-profile-file').value='';paint()};
      q('#da-profile-file').onchange=async ev=>{
        const file=ev.target.files?.[0];if(!file)return;
        if(!file.type.startsWith('image/')||file.size>15000000){status.textContent='15 MB altında bir görsel seç.';return}
        busy=true;const url=URL.createObjectURL(file);
        try{const image=new Image();image.src=url;await image.decode();const canvas=document.createElement('canvas');canvas.width=canvas.height=160;const n=Math.min(image.width,image.height);canvas.getContext('2d').drawImage(image,(image.width-n)/2,(image.height-n)/2,n,n,0,0,160,160);const data=canvas.toDataURL('image/jpeg',.75);if(!validPhoto(data))throw Error('Görsel çok büyük.');photo=data;paint();status.textContent='Fotoğraf hazır; kaydetmeyi unutma.'}catch(err){status.textContent='Fotoğraf açılamadı. JPEG veya PNG dene.'}finally{URL.revokeObjectURL(url);busy=false}
      };
      form.onsubmit=async ev=>{
        ev.preventDefault();if(busy)return;
        const data=Object.fromEntries(new FormData(form));const value={displayName:data.displayName.trim().slice(0,60),city:data.city.trim().slice(0,60),birthday:data.birthday,bio:data.bio.trim().slice(0,240),goal:levels.includes(data.goal)?data.goal:'',photo,communityVisible:form.elements.communityVisible.checked};
        const raw=JSON.stringify(value),submit=form.querySelector('[type=submit]');submit.disabled=true;
        try{await request('/state',{method:'PUT',body:JSON.stringify({bucket:bucket(key),data:{raw}})});put(prefix()+key,raw);refresh();b.click();e.querySelector('#da-profile-status').textContent='Profil kaydedildi.'}catch(err){status.textContent='Profil kaydedilemedi: '+err.message;submit.disabled=false}
      };
      q('#da-logout').onclick=logout;q('#da-close').onclick=()=>e.hidden=true;
      if(auth.user.role==='admin')q('#da-admin').onclick=admin;else q('#da-claim-admin').onclick=claimAdmin;
    };
  }


  // Edit speaks as a small animated character; a same-origin, visually-hidden
  // iframe keeps the Live connection alive while the learner navigates lessons.
  let lastFelcanContext='', felcanReady=false, felcanRequested=false;
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
      title:root.querySelector('.top h1, h1, .placement-card h2')?.textContent?.trim()||'DilAtölyesi',
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
    const mobile=document.querySelector('#nav [data-page="live"]');
    if(mobile){
      mobile.dataset.voice=state;
      mobile.title=message||'Edit ile konuş';
      const label=mobile.querySelector('.study-route-label');
      if(label)label.textContent=state==='audio-blocked'?'Sesi aç':'Edit';
      mobile.setAttribute('aria-label',state==='audio-blocked'?'Edit’in sesini aç':'Edit ile konuş');
    }
    const button=document.getElementById('da-felcan-float');
    if(!button)return;
    button.dataset.voice=state;
    button.title=message?'Edit · '+message:'Edit ile konuş';
    button.setAttribute('aria-pressed',String(['connecting','listening','speaking','muted'].includes(state)));
    button.setAttribute('aria-label',state==='idle'?'Edit ile sesli konuşmaya başla':state==='error'?'Edit bağlantısını yeniden dene':state==='audio-blocked'?'Edit’in sesini aç':state==='mic-blocked'?'Edit için mikrofon izni ver':state==='muted'?'Edit mikrofonunu aç':'Edit mikrofonunu duraklat');
    const sub=button.querySelector('.da-felcan-sub');
    if(sub)sub.textContent=message||({idle:'Konuşmak için dokun',connecting:'Bağlanıyor…',listening:'Seni dinliyorum',speaking:'Edit konuşuyor',muted:'Mikrofon duraklatıldı',error:'Tekrar dokun'}[state]||'Edit');
  }
  function ensureFelcanRuntime(){
    if(!auth)return null;
    let runtime=document.getElementById('da-felcan-runtime');
    if(runtime)return runtime;
    runtime=document.createElement('div');
    runtime.id='da-felcan-runtime';
    const iframe=document.createElement('iframe');
    iframe.title='Edit sesli bağlantı';
    iframe.allow='microphone; autoplay';
    iframe.tabIndex=-1;
    iframe.setAttribute('aria-hidden','true');
    iframe.src='./felkan.html?compact=1&v=dilatolyesi-1';
    iframe.addEventListener('load',()=>{
      felcanReady=true;
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
      console.warn('Edit ses bağlantısı:',error);
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
  function floatingFelcan(){
    if(!auth||document.getElementById('da-felcan-float'))return;
    const button=document.createElement('button');
    button.type='button';button.id='da-felcan-float';
    button.dataset.voice='idle';
    button.title='Edit ile konuş';
    button.setAttribute('aria-label','Edit ile sesli konuşmaya başla');
    button.setAttribute('aria-pressed','false');
    button.innerHTML='<span class="da-felcan-orb" aria-hidden="true"><span class="da-toy-eyes">● ●</span><span class="da-toy-smile">ᴗ</span><span class="da-toy-feet"></span><span class="da-toy-spark">✦</span></span><span class="da-felcan-text">Edit<span class="da-felcan-sub">Konuşmak için dokun</span></span>';
    button.onclick=startFelcanVoice;
    document.getElementById('view')?.addEventListener('click',event=>{
      const question=event.target.closest(felcanQuestionSelector);
      if(question)felcanFocusedQuestion=question;
    },true);
    document.body.append(button);
    button.addEventListener('pointerenter',ensureFelcanRuntime,{once:true});
    button.addEventListener('focus',ensureFelcanRuntime,{once:true});
    const warmMobileVoice=event=>{
      if(event.target.closest('[data-page="live"]'))ensureFelcanRuntime();
    };
    const nav=document.getElementById('nav');
    nav?.addEventListener('pointerover',warmMobileVoice,{passive:true});
    nav?.addEventListener('focusin',warmMobileVoice);
  }
  window.deutschaiStore=store;
  window.DeutschAI={api:request,store,openCommunity:community,get user(){return auth?.user||null;},get ready(){return !!origin && !!auth;},logout,showAdmin:admin,openFelkan:felkan,getStudyContext:number=>auth?felcanScreenContext(number):null};
  window.addEventListener('message',event=>{
    const frame=felcanFrame();
    if(event.origin!==location.origin||!frame||event.source!==frame.contentWindow)return;
    if(event.data?.type==='deutschai:voice-state'){
      felcanVisual(event.data.state||'idle',String(event.data.message||'').slice(0,90));
      return;
    }
    if(event.data?.type==='deutschai:generate'){
      const page=String(event.data.page||'');
      if(typeof window.deutschaiRegenerateSection==='function')
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
      const hydratingReload=sessionStorage.getItem('da-hydrated')==='1';
      sessionStorage.removeItem('da-hydrated');
      const [me,cloudState]=await Promise.all([
        request('/auth/me'),
        hydratingReload?null:request('/state').catch(error=>{console.warn('Çalışma durumu yüklenemedi:',error.message);return null})
      ]);
      auth.user=me.user;saveSession();
      if(hydrate(cloudState)){
        sessionStorage.setItem('da-hydrated','1');location.reload();return;
      }
      account();
      floatingFelcan();
      startStudyAttendance();
    } catch(error) {
      auth=null;
      if(error.status===401)sessionStorage.removeItem(authKey);
      show('login',error.message);
    }
  });
})();