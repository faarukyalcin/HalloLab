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
      +'<p class="da-login-secure">🔒 İlerlemen hesabına özel saklanır. API anahtarı istenmez.</p></section></div>';
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
    auth=null;del(authKey);sessionStorage.removeItem('da-hydrated');location.reload();
  }
  function admin() {
    const e=overlay();
    e.innerHTML='<div class="da-card"><h1>Yönetici Paneli</h1><p>Ortak Gemini API anahtarını yalnızca yönetici tanımlar. Anahtar tarayıcıya geri gönderilmez.</p><form id="da-admin-form"><label>Gemini API anahtarı<input name="apiKey" type="password" autocomplete="off" required></label><p class="da-error"></p><button type="submit">Kaydet</button> <button type="button" id="da-close">Kapat</button></form></div>';
    e.querySelector('#da-close').onclick=()=>e.hidden=true;
    e.querySelector('form').onsubmit=async ev=>{
      ev.preventDefault();
      try{await request('/admin/gemini-key',{method:'PUT',body:JSON.stringify(Object.fromEntries(new FormData(ev.currentTarget)))});e.querySelector('.da-error').textContent='Anahtar güvenli olarak kaydedildi';}
      catch(err){e.querySelector('.da-error').textContent=err.message;}
    };
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
  let felcanFocusedQuestion=-1;
  function felcanScreenContext(){
    const root=document.getElementById('view');if(!root)return null;
    const title=root.querySelector('.top h1')?.textContent?.trim()||'DeutschAI';
    const nodes=[...root.querySelectorAll('.question, #da-personal-practice .da-question')];
    const questions=nodes.slice(0,40).map((node,i)=>{
      const prompt=node.querySelector('p b, b')?.textContent?.trim()||'';
      const passage=node.querySelector('.study-prompt')?.textContent?.trim()||'';
      const options=[...node.querySelectorAll('.option, .da-opts button')].map(x=>x.textContent.trim()).slice(0,8);
      const feedback=node.querySelector('.feedback, .da-feedback')?.textContent?.trim()||'';
      return {number:i+1,prompt:prompt.slice(0,280),passage:passage.slice(0,380),options,answered:node.dataset.done==='1',feedback:feedback.slice(0,220)};
    });
    const focused=nodes.findIndex(node=>node.contains(document.activeElement));
    const selected=focused>=0?focused+1:felcanFocusedQuestion>0&&felcanFocusedQuestion<=questions.length?felcanFocusedQuestion:0;
    return {
      title,page:document.querySelector('#nav [aria-current="page"]')?.dataset.page||'home',
      level:(document.querySelector('.study-next .badge')?.textContent||'').slice(0,20),
      selectedQuestion:selected,
      questionCount:nodes.length,
      questions,
      grammar:root.querySelector('details[open]')?.textContent?.slice(0,1100)||'',
      lesson:root.querySelector('.classroom-lead')?.textContent?.slice(0,350)||''
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
    const button=document.getElementById('da-felcan-float');
    if(!button)return;
    button.dataset.voice=state;
    button.setAttribute('aria-pressed',String(['connecting','listening','speaking','muted'].includes(state)));
    button.setAttribute('aria-label',state==='idle'?'Felcan ile sesli konuşmaya başla':state==='error'?'Felcan bağlantısını yeniden dene':state==='muted'?'Felcan mikrofonunu aç':'Felcan mikrofonunu duraklat');
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
    iframe.src='./felkan.html?compact=1&v=toy-voice-1';
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
      console.warn('Felcan ses bağlantısı:',error);
      felcanVisual('error','Ses başlatılamadı');
    }
  }
  function felkan(){startFelcanVoice()}

  function felcanWelcome(){
    const button=document.getElementById('da-felcan-float');
    if(!button)return;
    const name=String(auth?.user?.firstName||'arkadaşım').trim();
    let bubble=document.getElementById('da-felcan-hello');
    if(!bubble){
      bubble=document.createElement('div');
      bubble.id='da-felcan-hello';
      bubble.setAttribute('role','status');
      bubble.innerHTML='<span class="da-hello-text"></span><button type="button" class="da-hello-dismiss" aria-label="Karşılamayı kapat">×</button>';
      button.insertAdjacentElement('beforebegin',bubble);
      bubble.querySelector('.da-hello-dismiss').onclick=()=>bubble.remove();
      bubble.onclick=e=>{if(e.target.closest('button'))return;startFelcanVoice();bubble.remove()};
    }
    bubble.querySelector('.da-hello-text').textContent='👋 Hoş geldin, '+name+'! Ben Felcan. Bugün kaldığımız yerden devam edelim mi?';
    button.classList.add('da-felcan-waving');
    setTimeout(()=>button.classList.remove('da-felcan-waving'),3400);
    setTimeout(()=>bubble.remove(),13500);
    // Only try hands-free greeting when microphone permission was previously
    // granted. Browsers may still require a click to unlock audio.
    const once='da:felcan-auto-greet:'+auth.user.id;
    if(sessionStorage.getItem(once))return;
    sessionStorage.setItem(once,'1');
    if(!navigator.permissions?.query)return;
    navigator.permissions.query({name:'microphone'}).then(permission=>{
      if(permission.state==='granted'&&document.visibilityState==='visible'){
        felcanRequested=true;
        if(felcanReady){felcanRequested=false;startFelcanVoice()}
      }
    }).catch(()=>{});
  }
  function floatingFelcan(){
    if(!auth||document.getElementById('da-felcan-float'))return;
    const button=document.createElement('button');
    button.type='button';button.id='da-felcan-float';
    button.dataset.voice='idle';
    button.setAttribute('aria-label','Felcan ile sesli konuşmaya başla');
    button.setAttribute('aria-pressed','false');
    button.innerHTML='<span class="da-felcan-orb" aria-hidden="true"><span class="da-toy-eyes">● ●</span><span class="da-toy-smile">ᴗ</span><span class="da-toy-feet"></span><span class="da-toy-spark">✦</span></span><span class="da-felcan-text">Felcan<span class="da-felcan-sub">Konuşmak için dokun</span></span>';
    button.onclick=()=>{document.getElementById('da-felcan-hello')?.remove();startFelcanVoice()};
    document.getElementById('view')?.addEventListener('click',e=>{const q=e.target.closest('.question, #da-personal-practice .da-question');if(!q)return;felcanFocusedQuestion=[...document.querySelectorAll('#view .question, #view #da-personal-practice .da-question')].indexOf(q)+1;sendFelcanContext(true)},true);
    document.body.append(button);
    ensureFelcanRuntime();
    felcanWelcome();
    setInterval(()=>{if(felcanReady)sendFelcanContext()},1400);
  }
  window.deutschaiStore=store;
  window.DeutschAI={api:request,store,get user(){return auth?.user||null;},get ready(){return !!origin && !!auth;},logout,showAdmin:admin,openFelkan:felkan};
  window.addEventListener('message',event=>{
    if(event.origin!==location.origin)return;
    if(event.data?.type==='deutschai:voice-state' && event.source===felcanFrame()?.contentWindow){
      felcanVisual(event.data.state||'idle',String(event.data.message||'').slice(0,90));
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
    } catch(error) {auth=null;del(authKey);show('login',error.message);}
  });
})();