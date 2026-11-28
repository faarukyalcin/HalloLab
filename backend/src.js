/* DeutschAI Cloudflare Worker + D1: user-authenticated data and Gemini broker.
   Secrets: ENCRYPTION_SECRET (base64 32-byte AES key), ADMIN_BOOTSTRAP_SECRET.
   Never add real values to GitHub or client-side JavaScript. */
const enc = new TextEncoder();
const dec = new TextDecoder();
const MAX_JSON = 180_000;
const day = () => new Date().toISOString().slice(0, 10);
const attendanceDay = () => {const parts=Object.fromEntries(new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/Istanbul',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date()).map(p=>[p.type,p.value]));return parts.year+'-'+parts.month+'-'+parts.day;};
const now = () => Math.floor(Date.now() / 1000);
const b64 = bytes => btoa(String.fromCharCode(...bytes));
const bytes = str => Uint8Array.from(atob(str), c => c.charCodeAt(0));
const rand = size => b64(crypto.getRandomValues(new Uint8Array(size))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const hex = x => Array.from(new Uint8Array(x)).map(c => c.toString(16).padStart(2, '0')).join('');
const sha = async s => hex(await crypto.subtle.digest('SHA-256', enc.encode(s)));
// Workerd WebCrypto caps PBKDF2 at 100,000 rounds. Add a separate server-only
// HMAC pepper so a leaked D1 dump is insufficient for offline password guessing.
async function passwordHash(p, salt, env) {
 if (!env.ENCRYPTION_SECRET) throw Error('ENCRYPTION_SECRET eksik');
 const pepperKey = await crypto.subtle.importKey('raw', bytes(env.ENCRYPTION_SECRET), {name:'HMAC', hash:'SHA-256'}, false, ['sign']);
 const peppered = await crypto.subtle.sign('HMAC', pepperKey, enc.encode(p));
 const key = await crypto.subtle.importKey('raw', peppered, 'PBKDF2', false, ['deriveBits']);
 return hex(await crypto.subtle.deriveBits({name:'PBKDF2', salt:bytes(salt), iterations:100000, hash:'SHA-256'}, key, 256));
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
async function logLogin(env,userId){
 const time=now(),date=attendanceDay();
 await env.DB.prepare(`INSERT INTO activity_days(user_id,day,first_seen_at,last_seen_at,login_count)
 VALUES(?,?,?,?,1) ON CONFLICT(user_id,day) DO UPDATE SET last_seen_at=excluded.last_seen_at,login_count=activity_days.login_count+1`)
 .bind(userId,date,time,time).run();
}
async function loginUser(env,u) {
 const token = rand(36);
 const issued=await env.DB.prepare(`INSERT INTO sessions(token_hash,user_id,expires_at,created_at)
  SELECT ?,id,?,? FROM users WHERE id=? AND password_hash=?`)
  .bind(await sha(token),now()+7*86400,now(),u.id,u.password_hash).run();
 if(!issued.meta?.changes)return error('Kullanıcı adı veya şifre yanlış',401);
 await logLogin(env,u.id);
 return answer({token,user:safeUser(u),expiresIn:7*86400});
}
async function throttle(env,key,max=8,window=900) {
 const k=await sha(key), stamp=now();
 const change=await env.DB.prepare(`INSERT INTO login_attempts(key,count,reset_at) VALUES(?,1,?)
  ON CONFLICT(key) DO UPDATE SET
   count=CASE WHEN login_attempts.reset_at<=? THEN 1 ELSE login_attempts.count+1 END,
   reset_at=CASE WHEN login_attempts.reset_at<=? THEN excluded.reset_at ELSE login_attempts.reset_at END
  WHERE login_attempts.reset_at<=? OR login_attempts.count<?`)
  .bind(k,stamp+window,stamp,stamp,stamp,max).run();
 return Number(change.meta?.changes)>0;
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
 return `Sen Edit adlı Almanca öğretmenisin. Kullanıcıya Türkçe, kısa, açık ve cesaretlendirici biçimde destek ver. Genel Almanca, Goethe sınavı zorunlu değil. Seviye ${String(p.level||'A1').slice(0,5)}. Hedef ${Number(p.daily)||20} dk. Önceki ilerlemeyi dikkate al. ${extra}\nGörev: ${task}\nYalnızca ilgili Almanca öğrenme içeriği üret.`;
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
  const salt=b64(crypto.getRandomValues(new Uint8Array(16))),hash=await passwordHash(p,salt,env),id=crypto.randomUUID();
  try{await env.DB.prepare('INSERT INTO users(id,username,email,first_name,last_name,password_salt,password_hash,created_at) VALUES(?,?,?,?,?,?,?,?)').bind(id,username,email,first,last,salt,hash,now()).run();}
  catch{return error('Kullanıcı adı veya e-posta zaten kayıtlı',409);}
  return loginUser(env,{id,username,email,first_name:first,last_name:last,role:'user',password_hash:hash});
 }
 if(route==='/auth/login'&&req.method==='POST'){
  const x=await body(req),username=String(x.username||'').trim(),p=String(x.password||'');
  if(!(await throttle(env,'login:'+req.headers.get('CF-Connecting-IP')+':'+username.toLowerCase(),8,900)))return error('Çok fazla deneme. Sonra tekrar deneyin.',429);
  const u=await env.DB.prepare('SELECT * FROM users WHERE username=? COLLATE NOCASE').bind(username).first();
  if(!u||!p||await passwordHash(p,u.password_salt,env)!==u.password_hash)return error('Kullanıcı adı veya şifre yanlış',401);
  return loginUser(env,u);
 }
 const user=await currentUser(req,env);
 if(!user)return error('Giriş yapmalısın',401);
 if(route==='/auth/me'&&req.method==='GET')return answer({user:safeUser(user)});
 if(route==='/activity/ping'&&req.method==='POST'){
  const payload=await body(req);
  const active=payload.active===true,time=now(),date=attendanceDay();
  // Each authenticated heartbeat contributes at most 65s, capped by elapsed
  // server time. Hidden/unfocused tabs contribute no active study time.
  await env.DB.prepare(`INSERT INTO activity_days(user_id,day,first_seen_at,last_seen_at,active_seconds,last_ping_at)
   VALUES(?,?,?,?,0,?)
   ON CONFLICT(user_id,day) DO UPDATE SET
    last_seen_at=excluded.last_seen_at,
    active_seconds=activity_days.active_seconds+
      CASE WHEN ?=1 AND activity_days.last_ping_at IS NOT NULL
      THEN MIN(65,MAX(0,excluded.last_seen_at-activity_days.last_ping_at)) ELSE 0 END,
    last_ping_at=excluded.last_ping_at`)
   .bind(user.id,date,time,time,time,active?1:0).run();
  return answer({ok:true,day:date});
 }

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
  if(!(await throttle(env,'bootstrap:'+req.headers.get('CF-Connecting-IP'),5,3600)))return error('Yönetici kurulum denemesi sınırlandı',429);
  const x=await body(req);
  if(!env.ADMIN_BOOTSTRAP_SECRET||x.bootstrapSecret!==env.ADMIN_BOOTSTRAP_SECRET)return error('Yetkisiz',403);
  if(user.role==='admin'){
   const recovered=await env.DB.prepare("INSERT OR IGNORE INTO app_settings(key,value,updated_at) SELECT 'founder_user_id',id,? FROM users WHERE id=? AND role='admin'").bind(now(),user.id).run();
   if(recovered.meta?.changes)return answer({ok:true});
   return error('Kurucu zaten belirlenmiş',409);
  }
  const [changed]=await env.DB.batch([env.DB.prepare("UPDATE users SET role='admin' WHERE id=? AND NOT EXISTS (SELECT 1 FROM users WHERE role='admin') AND NOT EXISTS (SELECT 1 FROM app_settings WHERE key='founder_user_id')").bind(user.id),env.DB.prepare("INSERT OR IGNORE INTO app_settings(key,value,updated_at) SELECT 'founder_user_id',id,? FROM users WHERE id=? AND role='admin' AND (SELECT COUNT(*) FROM users WHERE role='admin')=1").bind(now(),user.id)]);
  if(!changed.meta?.changes)return error('Yönetici zaten oluşturulmuş',409);
  return answer({ok:true});
 }
 if(route.startsWith('/admin/')){
  if(user.role!=='admin')return error('Yönetici yetkisi gerekli',403);
  const founder=await env.DB.prepare("SELECT value FROM app_settings WHERE key='founder_user_id'").first();
  const isFounder=founder?.value===user.id;
  if(route==='/admin/users'&&req.method==='GET'){
   // Never expose password hashes, salts, session tokens or API secrets.
   const rows=await env.DB.prepare("SELECT id,username,first_name,last_name,email,role,created_at FROM users ORDER BY created_at DESC LIMIT 500").all();
   const count=await env.DB.prepare('SELECT COUNT(*) AS count FROM users').first();
   const totals=await env.DB.prepare(`SELECT user_id,
    SUM(active_seconds) AS total_seconds,
    SUM(CASE WHEN day>=date('now','-6 days') THEN active_seconds ELSE 0 END) AS last7_seconds,
    COUNT(*) AS visited_days,
    MAX(day) AS last_day
    FROM activity_days GROUP BY user_id`).all();
   const stats=new Map(totals.results.map(row=>[row.user_id,row]));
   return answer({users:rows.results.map(u=>{
    const v=stats.get(u.id)||{};
    return {...safeUser(u),isFounder:founder?.value===u.id,createdAt:u.created_at,totalSeconds:v.total_seconds||0,last7Seconds:v.last7_seconds||0,visitedDays:v.visited_days||0,lastVisit:v.last_day||null};
   }),total:count.count,accountManagement:true,isFounder});
  }
  if(route==='/admin/users/activity'&&req.method==='GET'){
   const id=String(url.searchParams.get('userId')||'');
   if(!/^[a-f0-9-]{36}$/i.test(id))return error('Geçersiz hesap');
   const target=await env.DB.prepare('SELECT id,username FROM users WHERE id=?').bind(id).first();
   if(!target)return error('Hesap bulunamadı',404);
   const entries=await env.DB.prepare(`SELECT day,active_seconds AS activeSeconds,
     login_count AS logins,first_seen_at AS firstSeenAt,last_seen_at AS lastSeenAt
     FROM activity_days WHERE user_id=? AND day >= date('now','-30 days')
     ORDER BY day DESC LIMIT 31`).bind(id).all();
   return answer({username:target.username,days:entries.results,timeZone:'Europe/Istanbul'});
  }
  if(route==='/admin/users/role'&&req.method==='PUT'){
   const x=await body(req),id=String(x.userId||''),role=String(x.role||'');
   if(!/^[a-f0-9-]{36}$/i.test(id)||!['admin','user'].includes(role))return error('Geçersiz hesap veya rol');
   const target=await env.DB.prepare('SELECT id,role FROM users WHERE id=?').bind(id).first();
   if(!target)return error('Hesap bulunamadı',404);
   if(!isFounder)return error('Yönetici yetkilerini yalnızca kurucu değiştirebilir',403);
   if(target.id===founder?.value)return error('Kurucu hesabının yetkisi değiştirilemez',403);
   if(target.id===user.id&&role!=='admin')return error('Kendi yönetici yetkini kaldıramazsın',403);
   const [changed]=await env.DB.batch([
    env.DB.prepare(`UPDATE users SET role=? WHERE id=?
     AND (?<>'user' OR role<>'admin' OR (SELECT COUNT(*) FROM users WHERE role='admin')>1)`).bind(role,id,role),
    env.DB.prepare('DELETE FROM sessions WHERE user_id=? AND EXISTS (SELECT 1 FROM users WHERE id=? AND role=?)').bind(id,id,role)
   ]);
   if(!changed.meta?.changes)return error('Rol değiştirilemedi veya son yönetici korunuyor',409);
   return answer({ok:true,role});
  }
  if(route==='/admin/users'&&req.method==='DELETE'){
   const x=await body(req),id=String(x.userId||'');
   if(!/^[a-f0-9-]{36}$/i.test(id))return error('Geçersiz hesap');
   if(id===user.id)return error('Kendi hesabını bu panelden silemezsin',403);
   if(id===founder?.value)return error('Kurucu hesabı silinemez',403);
   const target=await env.DB.prepare('SELECT username,role FROM users WHERE id=?').bind(id).first();
   if(!target)return error('Hesap bulunamadı',404);
   if(target.role==='admin'&&!isFounder)return error('Yönetici hesaplarını yalnızca kurucu silebilir',403);
   if(x.confirmUsername!==target.username)return error('Kullanıcı adı doğrulanamadı');
   const removed=await env.DB.prepare(`DELETE FROM users WHERE id=? AND username=?
    AND (role<>'admin' OR (SELECT COUNT(*) FROM users WHERE role='admin')>1)`).bind(id,target.username).run();
   if(!removed.meta?.changes)return error('Hesap silinemedi veya son yönetici korunuyor',409);
   return answer({ok:true});
  }
  if(route==='/admin/users/password'&&req.method==='PUT'){
   const x=await body(req),id=String(x.userId||''),password=x.password;
   if(!/^[a-f0-9-]{36}$/i.test(id)||typeof password!=='string'||password.length<10||password.length>128)return error('Geçerli hesap ve 10–128 karakterlik parola gerekli');
   const target=await env.DB.prepare('SELECT role FROM users WHERE id=?').bind(id).first();
   if(!target)return error('Hesap bulunamadı',404);
   if(target.role!=='user')return error('Bu işlem öğrenci hesapları için kullanılabilir',403);
   const salt=b64(crypto.getRandomValues(new Uint8Array(16))),hash=await passwordHash(password,salt,env);
   const [updated]=await env.DB.batch([
    env.DB.prepare("UPDATE users SET password_salt=?,password_hash=? WHERE id=? AND role='user'").bind(salt,hash,id),
    env.DB.prepare('DELETE FROM sessions WHERE user_id=? AND EXISTS (SELECT 1 FROM users WHERE id=? AND password_hash=?)').bind(id,id,hash)
   ]);
   if(!updated.meta?.changes)return error('Hesap artık sıfırlanamıyor',409);
   return answer({ok:true});
  }
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
  const result=await geminiFetch(env,`models/${encodeURIComponent(model)}:generateContent`,{systemInstruction:{parts:[{text:aiPrompt(profile,'Kullanıcının düzeyine uygun sorular, kelimeler, gramer örnekleri hazırla. Gerektiğinde geçerli JSON üret.')} ]},contents:[{role:'user',parts:[{text:task}]}],generationConfig:{temperature:.55,maxOutputTokens:4000}});
  if(result.error)return error(result.error,result.status);
  if(result.status>=400)return error('Gemini isteği başarısız ('+result.status+')',502);
  return answer({text:(result.data.candidates?.[0]?.content?.parts||[]).map(x=>x.text||'').join('')});
 }
 if(route==='/ai/greeting-audio'&&req.method==='POST'){
  if(!(await throttle(env,'greeting-audio:'+user.id,8,3600)))return error('Sesli selam sınırına ulaştın (429).',429);
  const x=await body(req);
  const voices=['Aoede','Puck','Charon','Kore','Fenrir','Leda','Orus','Zephyr'];
  const voiceName=voices.includes(x.voice)?x.voice:'Aoede';
  const result=await geminiFetch(env,'models/gemini-3.1-flash-tts-preview:generateContent',{
   contents:[{parts:[{text:'Aşağıdaki cümleyi akıcı, rahat, enerjik Türkiye Türkçesiyle söyle. Yalnızca tırnak içindeki cümleyi oku: “Merhaba! Ben Edit. Hazırsan Almanca çalışmaya başlayalım.”'}]}],
   generationConfig:{responseModalities:['AUDIO'],speechConfig:{voiceConfig:{prebuiltVoiceConfig:{voiceName}}}}
  });
  if(result.error)return error(result.error,result.status);
  if(result.status===429)return error('Gemini selam kotası doldu (429).',429);
  if(result.status>=400)return error('Gemini selam sesi üretilemedi ('+result.status+').',502);
  const part=result.data?.candidates?.[0]?.content?.parts?.find(p=>p.inlineData?.data&&/^audio\/(?:l16|pcm)/i.test(p.inlineData.mimeType||''));
  if(!part)return error('Gemini selam sesi göndermedi.',502);
  return answer({audio:part.inlineData.data,sampleRate:Number(/rate=(\d+)/.exec(part.inlineData.mimeType)?.[1])||24000});
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
 const allowed=origin===env.SITE_ORIGIN || origin==='https://dilatolyesi.pages.dev' || origin==='http://localhost:5173';
 const headers={'Access-Control-Allow-Origin':allowed?origin:'null','Vary':'Origin','Access-Control-Allow-Headers':'Authorization, Content-Type','Access-Control-Allow-Methods':'GET,POST,PUT,DELETE,OPTIONS','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'};
 if(req.method==='OPTIONS')return new Response(null,{status:allowed?204:403,headers});
 if(origin&&!allowed)return error('Bu kaynağa erişim engellendi',403);
 try{const res=await main(req,env);const h=new Headers(res.headers);Object.entries(headers).forEach(([k,v])=>h.set(k,v));return new Response(res.body,{status:res.status,headers:h});}
 catch(e){console.error('DeutschAI API error',e?.message);const h=new Headers(headers);h.set('Content-Type','application/json');return new Response(JSON.stringify({error:'İşlem gerçekleştirilemedi'}),{status:500,headers:h});}
}};