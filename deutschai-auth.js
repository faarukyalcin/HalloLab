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
    screen.innerHTML='<div class="da-card"><h1>DeutschAI</h1><p>Felkan ile kişisel Almanca çalışma alanın.</p>'
      +'<div class="da-tabs"><button type="button" id="da-login-tab">Giriş Yap</button><button type="button" id="da-signup-tab">Kayıt Ol</button></div>'
      +'<form id="da-auth-form"><label>Kullanıcı Adı<input name="username" autocomplete="username" minlength="3" maxlength="32" required></label>'
      +(mode==='register' ? '<label>İsim<input name="firstName" autocomplete="given-name" maxlength="80" required></label><label>Soyisim<input name="lastName" autocomplete="family-name" maxlength="80" required></label><label>E-posta<input name="email" type="email" autocomplete="email" required></label>' : '')
      +'<label>Şifre<input name="password" type="password" minlength="'+(mode==='register'?'10':'1')+'" autocomplete="'+(mode==='register'?'new-password':'current-password')+'" required></label>'
      +'<p class="da-error" role="alert">'+safe(message)+'</p><button type="submit">'+(mode==='register'?'Hesap Oluştur':'Giriş Yap')+'</button></form>'
      +'<p>API anahtarı istemiyoruz. İlerlemen hesabına özel saklanır.</p></div>';
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

  let lastFelcanContext='';
  function felcanScreenContext(){
    const root=document.getElementById('view');if(!root)return null;
    const title=root.querySelector('.top h1')?.textContent?.trim()||'DeutschAI';
    const q=[...root.querySelectorAll('.question')].find(x=>x.getClientRects().length&&!x.dataset.done)||root.querySelector('.question');
    return {
      title,
      page:document.querySelector('#nav [aria-current="page"]')?.dataset.page||'home',
      prompt:q?.querySelector('p b')?.textContent?.trim()||root.querySelector('#da-personal-practice .da-question b')?.textContent?.trim()||'',
      passage:q?.querySelector('.study-prompt')?.textContent?.trim()||'',
      options:[...(q?.querySelectorAll('.option')||[])].map(x=>x.textContent.trim()).slice(0,6),
      grammar:root.querySelector('details[open]')?.textContent?.slice(0,600)||''
    };
  }
  function sendFelcanContext(force=false,explain=false){
    const frame=document.querySelector('#da-felcan-window iframe');
    if(!frame?.contentWindow)return;
    const context=felcanScreenContext();if(!context)return;
    const serialized=JSON.stringify(context);
    if(!force&&serialized===lastFelcanContext)return;
    lastFelcanContext=serialized;
    frame.contentWindow.postMessage({type:explain?'deutschai:explain':'deutschai:context',context},location.origin);
  }
  function setFelcanVisible(panel,visible){
    panel.hidden=!visible;
    const frame=panel.querySelector('iframe');
    if(frame?.contentWindow)frame.contentWindow.postMessage({type:'deutschai:visibility',visible},location.origin);
    if(visible)sendFelcanContext(true);
  }
  function felkan(){
    if(!auth)return show();
    let panel=document.getElementById('da-felcan-window');
    if(!panel){
      panel=document.createElement('section');
      panel.id='da-felcan-window';
      panel.setAttribute('role','dialog');
      panel.setAttribute('aria-label','Felcan yardımcı öğretmen');
      panel.innerHTML='<div class="da-felcan-head"><strong>✦ Felcan <span>· Öğretmenin</span></strong><div style="display:flex;gap:6px"><button type="button" class="da-explain">Bu soruyu açıkla</button><button type="button" class="da-felcan-close" aria-label="Felcanı küçült">− Küçült</button></div></div><iframe title="Felcan Almanca öğretmeni" allow="microphone;autoplay" src="./felkan.html?compact=1&v=toy-1"></iframe>';
      panel.querySelector('.da-felcan-close').onclick=()=>{setFelcanVisible(panel,false);document.getElementById('da-felcan-float')?.focus()};
      panel.querySelector('.da-explain').onclick=()=>sendFelcanContext(true,true);
      panel.querySelector('iframe').addEventListener('load',()=>sendFelcanContext(true));
      document.body.append(panel);
    }
    setFelcanVisible(panel,true);
  }
  function floatingFelcan(){
    if(!auth||document.getElementById('da-felcan-float'))return;
    const button=document.createElement('button');
    button.type='button';button.id='da-felcan-float';
    button.setAttribute('aria-label','Felcan yardımcı öğretmeni aç veya küçült');
    button.innerHTML='<span class="da-felcan-orb" aria-hidden="true"><span class="da-toy-eyes">● ●</span><span class="da-toy-smile">ᴗ</span><span class="da-toy-feet"></span><span class="da-toy-spark">✦</span></span><span class="da-felcan-text">Felcan<span class="da-felcan-sub">Yanında, hazır ✨</span></span>';
    button.onclick=()=>{const panel=document.getElementById('da-felcan-window');if(panel&&!panel.hidden){setFelcanVisible(panel,false);return}felkan()};
    document.body.append(button);
    setInterval(()=>{if(document.getElementById('da-felcan-window'))sendFelcanContext()},1300);
  }
  window.deutschaiStore=store;
  window.DeutschAI={api:request,store,get user(){return auth?.user||null;},get ready(){return !!origin && !!auth;},logout,showAdmin:admin,openFelkan:felkan};
  window.addEventListener('message',event=>{
    if (event.origin!==location.origin || event.data?.type!=='deutschai:navigate') return;
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