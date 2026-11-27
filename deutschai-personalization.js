/* Felkan: personalized welcome and 4-question German drills. */
(() => {
'use strict';
const active=()=>window.DeutschAI;
const store=()=>window.deutschaiStore;
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const read=k=>{try{return JSON.parse(store().getItem(k)||'null')}catch{return null}};
const state=()=>read('deutschai-online-v1')||{};
const section=()=>document.querySelector('#nav [aria-current="page"]')?.dataset.page||'home';
let inflight=false;
const style=document.createElement('style');
style.textContent='.da-personal{margin:17px 0;padding:19px;border:1px solid #ae95ee6b;border-radius:22px;background:linear-gradient(135deg,#6650ae2c,#171a4050)}.da-personal h2{margin:0 0 8px;font-size:20px}.da-personal p{line-height:1.55}.da-personal button{cursor:pointer;border:1px solid #ad95ef8a;border-radius:12px;padding:10px 12px;background:#6747b8;color:#fff}.da-personal .da-question{padding:13px;margin:12px 0;border:1px solid #ad95ef42;border-radius:14px}.da-personal .da-opts{display:grid;gap:7px;margin:10px 0}.da-personal .da-opts button{text-align:left;background:#34265c}.da-personal .da-opts button.correct{background:#16634c}.da-personal .da-opts button.wrong{background:#873f56}';
document.head.append(style);
function planSection(s){
 const plan=JSON.stringify(read('deutschai-ai-plan-v1')||{}).toLowerCase();
 if(plan.includes('gramer')||plan.includes('grammatik'))return 'grammar';
 if(plan.includes('kelime')||plan.includes('wort'))return 'words';
 return (s.wrongWords||[]).length>=3?'words':'grammar';
}
function greet(){
 const root=document.getElementById('view');
 if(!root||root.querySelector('#da-home-greeting'))return;
 const s=state(),target=planSection(s),topic=target==='grammar'?'gramer':'kelime';
 const e=document.createElement('section');e.id='da-home-greeting';e.className='da-personal';
 e.innerHTML='<h2>👋 Hoş geldin, '+esc(active().user?.firstName||'')+'!</h2><p>Ben Felkan. Bugünkü programında '+topic+' çalışması var. '+esc(s.level||'A1')+' seviyene göre sorular hazırlayayım mı? '+(target==='grammar'?'Grameri':'Kelimeleri')+' açayım mı?</p><button class="da-open">Evet, aç</button> <button class="da-talk">Felkan ile konuş</button>';
 e.querySelector('.da-open').onclick=()=>window.setPage(target);
 e.querySelector('.da-talk').onclick=()=>active().openFelkan();
 const top=root.querySelector('.top');if(top)top.after(e);else root.prepend(e);
}
function draw(host,lesson,subject){
 host.innerHTML='<h2>'+esc(lesson.title||'Felkan soruları')+'</h2><p>'+esc(lesson.intro||'')+'</p><div class="da-list"></div><button class="da-new">Yeni sorular</button>';
 const dest=host.querySelector('.da-list');
 (lesson.questions||[]).slice(0,4).forEach((q,i)=>{
  if(!Array.isArray(q.options)||q.options.length!==4||!Number.isInteger(q.answer)||q.answer<0||q.answer>3)return;
  const e=document.createElement('div');e.className='da-question';e.innerHTML='<b>'+esc((i+1)+'. '+q.question)+'</b><div class="da-opts"></div><p class="da-feedback" aria-live="polite"></p>';
  q.options.forEach((option,j)=>{
   const b=document.createElement('button');b.textContent=option;b.onclick=()=>{
    e.querySelectorAll('.da-opts button').forEach(x=>x.disabled=true);
    b.classList.add(j===q.answer?'correct':'wrong');
    e.querySelector('.da-feedback').textContent=(j===q.answer?'Doğru! ':'Tekrar edelim. ')+String(q.explanation||'');
   };e.querySelector('.da-opts').append(b);
  });dest.append(e);
 });
 host.querySelector('.da-new').onclick=()=>generate(subject,host,true);
}
async function generate(subject,host,force=false){
 if(inflight)return;
 const k='da-personal-'+subject+'-'+new Date().toLocaleDateString('en-CA'),cached=read(k);
 if(cached&&!force){draw(host,cached,subject);return}
 inflight=true;host.innerHTML='<h2>Felkan sana özel hazırlıyor…</h2><p>Seviyene uygun sorular hazırlanıyor.</p>';
 const s=state();
 const task='Genel Almanca '+subject+' çalışması. Seviye '+(s.level||'A1')+'. Yanlış kelimeler '+JSON.stringify((s.wrongWords||[]).slice(0,15))+'. Tamamlanan ders sayısı '+(s.completed||[]).length+'. Yalnızca geçerli JSON oluştur: {"title":"...","intro":"Türkçe açıklama","questions":[{"question":"soru","options":["a","b","c","d"],"answer":0,"explanation":"Türkçe kısa açıklama"}]}. Dört farklı soru, answer 0-3.';
 try{
  const res=await active().api('/ai/generate',{method:'POST',body:JSON.stringify({task,profile:{level:s.level,daily:s.daily}})});
  const raw=String(res.text||'').trim();
  const json=JSON.parse(raw.slice(raw.indexOf('{'),raw.lastIndexOf('}')+1));
  if(!Array.isArray(json.questions)||!json.questions.length)throw Error('Geçersiz soru yanıtı');
  store().setItem(k,JSON.stringify(json));draw(host,json,subject);
 }catch(err){
  host.innerHTML='<h2>Felkan şu anda hazırlanamadı</h2><p>'+esc(err.message)+'</p><button class="retry">Yeniden dene</button>';
  host.querySelector('.retry').onclick=()=>generate(subject,host,true);
 }finally{inflight=false}
}
function update(){
 if(!active()?.ready)return;
 const root=document.getElementById('view');if(!root)return;
 const p=section();if(p==='home'){greet();return}
 if(!['grammar','words','practice'].includes(p)||root.querySelector('#da-personal-practice'))return;
 const sectionEl=document.createElement('section');sectionEl.className='da-personal';sectionEl.id='da-personal-practice';
 const top=root.querySelector('.top');if(top)top.after(sectionEl);else root.prepend(sectionEl);
 generate(p,sectionEl);
}
document.addEventListener('DOMContentLoaded',()=>{
 const root=document.getElementById('view');
 if(root)new MutationObserver(()=>queueMicrotask(update)).observe(root,{childList:true});
 setTimeout(update,300);
});
})();