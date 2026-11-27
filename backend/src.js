/* DeutschAI Cloudflare Worker + D1: user-authenticated data and Gemini broker.
   Secrets: ENCRYPTION_SECRET (base64 32-byte AES key), ADMIN_BOOTSTRAP_SECRET.
   Never add real values to GitHub or client-side JavaScript. */
const enc = new TextEncoder();
const dec = new TextDecoder();
const MAX_JSON = 180_000;
const day = () => new Date().toISOString().slice(0, 10);
const now = () => Math.floor(Date.now() / 1000);
const b64 = bytes => btoa(String.fromCharCode(...bytes));
const bytes = str => Uint8Array.from(atob(str), c => c.charCodeAt(0));
const rand = size => b64(crypto.getRandomValues(new Uint8Array(size))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const hex = x => Array.from(new Uint8Array(x)).map(c => c.toString(16).padStart(2, '0')).join('');
const sha = async s => hex(await crypto.subtle.digest('SHA-256', enc.encode(s)));
async function passwordHash(p, salt) {
 const key = await crypto.subtle.importKey('raw', enc.encode(p), 'PBKDF2', false, ['deriveBits']);
 return hex(await crypto.subtle.deriveBits({ name:'PBKDF2', salt:bytes(salt), iterations:310000, hash:'SHA-256' },key,256));
}
const error = (message, status = 400) => Response.json({error:message}, {status});
const answer = (data,status=200) => Response.json(data,{status,headers:{'Cache-Control':'no-store'}});
async function body(req) {
 const len = Number(req.headers.get('content-length') || 0);
 if (len > MAX_JSON) throw Error('İstek çok büyük');
 const raw = await req.text();
 if (raw.length > MAX_JSON) throw Error('İstek çok büyük');
 return JSON.parse(raw || '{}');
}
async function currentUser(req,env) {
 const token = (req.headers.get('Authorization') || '').match(/^Bearer ([A-Za-z0-9_-]{32,})$/)?.[1];
 if (!token) return null;
 const hash = await sha(token);
 return env.DB.prepare(`SELECT u.id,u.username,u.first_name,u.last_name,u.email,u.role,
 s.token_hash FROM sessions s JOIN users u ON u.id=s.user_id
 WHERE s.token_hash=? AND s.expires_at>?`).bind(hash,now()).first();
}
function safeUser(u){return {id:u.id,username:u.username,firstName:u.first_name,lastName:u.last_name,email:u.email,role:u.role};}
async function loginUser(env,u) {
 const token = rand(36);
 await env.DB.prepare('INSERT INTO sessions(token_hash,user_id,expires_at,created_at) VALUES (?,?,?,?)')
  .bind(await sha(token),u.id,now()+7*86400,now()).run();
 return answer({token,user:safeUser(u),expiresIn:7*86400});
}
async function throttle(env,key,max=8,window=900) {
 const k=await sha(key), stamp=now();
 const row=await env.DB.prepare('SELECT count,reset_at FROM login_attempts WHERE key=?').bind(k).first();
 if(row&&row.reset_at>stamp&&row.count>=max)return false;
 if(!row||row.reset_at<=stamp)await env.DB.prepare('INSERT INTO login_attempts(key,count,reset_at) VALUES(?,1,?) ON CONFLICT(key) DO UPDATE SET count=1,reset_at=excluded.reset_at').bind(k,stamp+window).run();
 else await env.DB.prepare('UPDATE login_attempts SET count=count+1 WHERE key=?').bind(k).run();
 return true;
}
async function encryptionKey(env){
 if(!env.ENCRYPTION_SECRET)throw Error('ENCRYPTION_SECRET eksik');
 return crypto.subtle.importKey('raw',bytes(env.ENCRYPTION_SECRET),'AES-GCM',false,['encrypt','decrypt']);
}
async function seal(env,plain){const iv=crypto.getRandomValues(new Uint8Array(12));const ct=await crypto.subtle.encrypt({name:'AES-GCM',iv},await encryptionKey(env),enc.encode(plain));return b64(iv)+'.'+b64(new Uint8Array(ct));}
async function unseal(env,data){const [iv,ct]=data.split('.');return dec.decode(await crypto.subtle.decrypt({name:'AES-GCM',iv:bytes(iv)},await encryptionKey(env),bytes(ct)));}
async function geminiKey(env){const r=await env.DB.prepare("SELECT value FROM app_settings WHERE key='gemini_api_key'").first();return r?unseal(env,r.value):null;}
async function geminiFetch(env,path,payload){
 const key=await geminiKey(env);if(!key)return {error:'Yönetici henüz Gemini API anahtarı tanımlamadı',status:503};
 const res=await fetch(`https://generativelanguage.googleapis.com/${path==='auth_tokens'?'v1alpha':'v1beta'}/${path}`,{method:'POST',headers:{'Content-Type':'application/json','x-goog-api-key':key},body:JSON.stringify(payload)});
 const json=await res.json().catch(()=>({}));return {data:json,status:res.status};
}
function aiPrompt(profile,task,extra='') {
 const p=profile||{};
 return `Sen Felkan adlı Almanca öğretmenisin. Kullanıcıya Türkçe, kısa, açık ve cesaretlendirici biçimde destek ver. Genel Almanca, Goethe sınavı zorunlu değil. Seviye ${String(p.level||'A1').slice(0,5)}. Hedef ${Number(p.daily)||20} dk. Önceki ilerlemeyi dikkate al. ${extra}\nGörev: ${task}\nYalnızca ilgili Almanca öğrenme içeriği üret.`;
}
async function main(req,env){
 const url=new URL(req.url),route=url.pathname;
 if(route==='/health')return answer({ok:true,service:'DeutschAI API'});
 if(!env.DB)return error('D1 veritabanı yapılandırılmadı',503);
 if(route==='/auth/register'&&req.method==='POST'){
  const x=await body(req),username=String(x.username||'').trim(),email=String(x.email||'').trim().toLowerCase();
  const first=String(x.firstName||'').trim(),last=String(x.lastName||'').trim(),p=String(x.password||'');
  if(!/^[a-zA-Z0-9_]{3,32}$/.test(username)||!/^\S+@\S+\.\S+$/.test(email)||first.length<1||first.length>80||last.length<1||last.length>80||p.length<10||p.length>128)return error('Alanları kontrol et: kullanıcı adı 3-32 karakter, şifre en az 10 karakter olmalı');
  if(!(await throttle(env,'register:'+req.headers.get('CF-Connecting-IP'),5,3600)))return error('Çok fazla kayıt denemesi',429);
  const salt=b64(crypto.getRandomValues(new Uint8Array(16))),hash=await passwordHash(p,salt),id=crypto.randomUUID();
  try{await env.DB.prepare('INSERT INTO users(id,username,email,first_name,last_name,password_salt,password_hash,created_at) VALUES(?,?,?,?,?,?,?,?)').bind(id,username,email,first,last,salt,hash,now()).run();}
  catch{return error('Kullanıcı adı veya e-posta zaten kayıtlı',409);}
  return loginUser(env,{id,username,email,first_name:first,last_name:last,role:'user'});
 }
 if(route==='/auth/login'&&req.method==='POST'){
  const x=await body(req),username=String(x.username||'').trim(),p=String(x.password||'');
  if(!(await throttle(env,'login:'+req.headers.get('CF-Connecting-IP')+':'+username,8,900)))return error('Çok fazla deneme. Sonra tekrar deneyin.',429);
  const u=await env.DB.prepare('SELECT * FROM users WHERE username=? COLLATE NOCASE').bind(username).first();
  if(!u||!p||await passwordHash(p,u.password_salt)!==u.password_hash)return error('Kullanıcı adı veya şifre yanlış',401);
  return loginUser(env,u);
 }
 const user=await currentUser(req,env);
 if(!user)return error('Giriş yapmalısın',401);
 if(route==='/auth/me'&&req.method==='GET')return answer({user:safeUser(user)});
 if(route==='/auth/logout'&&req.method==='POST'){
  await env.DB.prepare('DELETE FROM sessions WHERE token_hash=?').bind(user.token_hash).run();return answer({ok:true});
 }
 if(route==='/state'&&req.method==='GET'){
  const rows=await env.DB.prepare('SELECT bucket,data,revision,updated_at FROM user_states WHERE user_id=?').bind(user.id).all();
  return answer({buckets:Object.fromEntries(rows.results.map(x=>[x.bucket,{data:JSON.parse(x.data),revision:x.revision,updatedAt:x.updated_at}]))});
 }
 if(route==='/state'&&req.method==='PUT'){
  const x=await body(req),bucket=String(x.bucket||'');
  if(!/^[a-z][a-z0-9_-]{0,39}$/.test(bucket)||!x.data||typeof x.data!=='object'||JSON.stringify(x.data).length>90000)return error('Geçersiz durum verisi');
  const data=JSON.stringify(x.data),old=await env.DB.prepare('SELECT revision FROM user_states WHERE user_id=? AND bucket=?').bind(user.id,bucket).first();
  const rev=old?.revision||0;
  if(x.expectedRevision!=null && Number(x.expectedRevision)!==rev)return error('Çakışma: başka cihazdaki değişiklik daha yeni',409);
  await env.DB.prepare(`INSERT INTO user_states(user_id,bucket,data,revision,updated_at) VALUES(?,?,?,1,?)
  ON CONFLICT(user_id,bucket) DO UPDATE SET data=excluded.data,revision=user_states.revision+1,updated_at=excluded.updated_at`).bind(user.id,bucket,data,now()).run();
  return answer({ok:true,revision:rev+1});
 }
 if(route==='/admin/claim'&&req.method==='POST'){
  const x=await body(req);
  if(!env.ADMIN_BOOTSTRAP_SECRET||x.bootstrapSecret!==env.ADMIN_BOOTSTRAP_SECRET)return error('Yetkisiz',403);
  const previous=await env.DB.prepare("SELECT id FROM users WHERE role='admin' LIMIT 1").first();
  if(previous)return error('Yönetici zaten oluşturulmuş',409);
  await env.DB.prepare("UPDATE users SET role='admin' WHERE id=?").bind(user.id).run();return answer({ok:true});
 }
 if(route.startsWith('/admin/')){
  if(user.role!=='admin')return error('Yönetici yetkisi gerekli',403);
  if(route==='/admin/status'&&req.method==='GET')return answer({geminiConfigured:!!(await geminiKey(env))});
  if(route==='/admin/gemini-key'&&req.method==='PUT'){
   const x=await body(req),key=String(x.apiKey||'').trim();if(key.length<20||key.length>200)return error('Geçersiz API anahtarı');
   const encrypted=await seal(env,key);
   await env.DB.prepare("INSERT INTO app_settings(key,value,updated_at) VALUES('gemini_api_key',?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value,updated_at=excluded.updated_at").bind(encrypted,now()).run();return answer({ok:true});
  }
  return error('Bilinmeyen yönetici işlemi',404);
 }
 if(route==='/ai/status'&&req.method==='GET')return answer({configured:!!(await geminiKey(env))});
 if(route==='/ai/generate'&&req.method==='POST'){
  if(!(await throttle(env,'ai:'+user.id,45,3600)))return error('Saatlik AI sınırına ulaştın',429);
  const x=await body(req),task=String(x.task||'').slice(0,3000);
  const profile=x.profile&&typeof x.profile==='object'?x.profile:{};
  if(task.length<3)return error('İstek boş');
  const model=env.GEMINI_TEXT_MODEL||'gemini-2.5-flash';
  const result=await geminiFetch(env,`models/${encodeURIComponent(model)}:generateContent`,{systemInstruction:{parts:[{text:aiPrompt(profile,'Kullanıcının düzeyine uygun sorular, kelimeler, gramer örnekleri hazırla. Gerektiğinde geçerli JSON üret.')} ]},contents:[{role:'user',parts:[{text:task}]}],generationConfig:{temperature:.55,maxOutputTokens:1700}});
  if(result.error)return error(result.error,result.status);
  if(result.status>=400)return error('Gemini isteği başarısız ('+result.status+')',502);
  return answer({text:(result.data.candidates?.[0]?.content?.parts||[]).map(x=>x.text||'').join('')});
 }
 if(route==='/ai/live-token'&&req.method==='POST'){
  if(!(await throttle(env,'live:'+user.id,20,3600)))return error('Çok fazla sesli oturum',429);
  const expire=new Date(Date.now()+30*60*1000).toISOString();
  const start=new Date(Date.now()+60*1000).toISOString();
  const result=await geminiFetch(env,'auth_tokens',{uses:1,expireTime:expire,newSessionExpireTime:start});
  if(result.error)return error(result.error,result.status);
  if(result.status>=400||!result.data.name)return error('Gemini sesli oturum anahtarı alınamadı',502);
  return answer({token:result.data.name,expiresIn:60});
 }
 return error('Bilinmeyen yol',404);
}
export default {async fetch(req,env){
 const origin=req.headers.get('Origin')||'';
 const allowed=origin===env.SITE_ORIGIN || origin==='http://localhost:5173';
 const headers={'Access-Control-Allow-Origin':allowed?origin:'null','Vary':'Origin','Access-Control-Allow-Headers':'Authorization, Content-Type','Access-Control-Allow-Methods':'GET,POST,PUT,OPTIONS','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'};
 if(req.method==='OPTIONS')return new Response(null,{status:allowed?204:403,headers});
 if(origin&&!allowed)return error('Bu kaynağa erişim engellendi',403);
 try{const res=await main(req,env);const h=new Headers(res.headers);Object.entries(headers).forEach(([k,v])=>h.set(k,v));return new Response(res.body,{status:res.status,headers:h});}
 catch(e){console.error('DeutschAI API error',e?.message);const h=new Headers(headers);h.set('Content-Type','application/json');return new Response(JSON.stringify({error:'İşlem gerçekleştirilemedi'}),{status:500,headers:h});}
}};