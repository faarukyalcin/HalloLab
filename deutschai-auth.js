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
  function felkan() {
    if (!auth) return show();
    document.getElementById('da-felkan-modal')?.remove();
    const e=document.createElement('div');e.id='da-felkan-modal';
    e.style.cssText='position:fixed;inset:0;z-index:1100;background:#0b091d';
    e.innerHTML='<button aria-label="Felkan kapat" style="position:absolute;z-index:5;right:15px;top:15px;border:1px solid #a998e8;border-radius:14px;padding:12px;background:#241a4c;color:#fff">✕ Kapat</button><iframe title="Felkan Almanca öğretmeni" allow="microphone;autoplay" src="./felkan.html" style="width:100%;height:100%;border:0"></iframe>';
    e.querySelector('button').onclick=()=>e.remove();document.body.append(e);
  }
  window.deutschaiStore=store;
  window.DeutschAI={api:request,store,get user(){return auth?.user||null;},get ready(){return !!origin && !!auth;},logout,showAdmin:admin,openFelkan:felkan};
  window.addEventListener('message',event=>{
    if (event.origin!==location.origin || event.data?.type!=='deutschai:navigate') return;
    if(!['home','lessons','grammar','words','practice','writing','exam','placement','progress'].includes(event.data.page))return;
    document.getElementById('da-felkan-modal')?.remove();
    if(typeof window.setPage==='function')window.setPage(event.data.page);
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
    } catch(error) {auth=null;del(authKey);show('login',error.message);}
  });
})();