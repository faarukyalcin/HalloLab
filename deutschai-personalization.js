/* Edit: weekly study program and personalized German drills. */
(() => {
'use strict';
const active=()=>window.DeutschAI;
const store=()=>window.deutschaiStore;
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const read=k=>{try{return JSON.parse(store().getItem(k)||'null')}catch{return null}};
const state=()=>read('deutschai-online-v1')||{};
const section=()=>document.querySelector('#nav [aria-current="page"]')?.dataset.page||'home';
let inflight=false;
const questionRequests=new Map();
const style=document.createElement('style');
style.textContent='.da-personal{margin:17px 0;padding:19px;border:1px solid #ae95ee6b;border-radius:22px;background:linear-gradient(135deg,#6650ae2c,#171a4050)}.da-personal h2{margin:0 0 8px;font-size:20px}.da-personal p{line-height:1.55}.da-personal button{cursor:pointer;border:1px solid #ad95ef8a;border-radius:12px;padding:10px 12px;background:#6747b8;color:#fff}.da-personal .da-question{padding:13px;margin:12px 0;border:1px solid #ad95ef42;border-radius:14px}.da-personal .da-opts{display:grid;gap:7px;margin:10px 0}.da-personal .da-opts button{text-align:left;background:#34265c}.da-personal .da-opts button.correct{background:#16634c}.da-personal .da-opts button.wrong{background:#873f56}.da-personal .da-plan-form{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;margin:14px 0}.da-personal label{display:grid;gap:5px;font-size:13px;color:#ded7fa}.da-personal select,.da-personal input{width:100%;min-width:0;padding:11px;border:1px solid #8e7bd0;border-radius:12px;background:#21193e;color:#fff;font:inherit}.da-personal .da-plan-days{display:grid;grid-template-columns:repeat(auto-fit,minmax(155px,1fr));gap:9px;margin:12px 0}.da-personal .da-plan-day{padding:12px;border:1px solid #a98ce85a;border-radius:14px;background:#22193b9e}.da-personal .da-plan-day.today{border-color:#b4a1ff}.da-personal .da-plan-day h3{margin:0 0 8px;font-size:14px}.da-personal .da-plan-task{display:flex;align-items:flex-start;gap:6px;margin:7px 0;font-size:13px;line-height:1.4}.da-personal .da-plan-task input{width:auto;margin-top:3px;accent-color:#a38aff}.da-personal .da-plan-task.done span{text-decoration:line-through;opacity:.6}.da-personal .da-plan-actions{display:flex;flex-wrap:wrap;gap:8px}.da-personal .da-plan-muted{font-size:13px;color:#bcb2db}.da-personal .da-plan-wide{grid-column:1/-1}@media(max-width:540px){.da-personal .da-plan-form{grid-template-columns:1fr}}';
style.textContent+=` .da-week-strip{display:grid;grid-template-columns:repeat(7,minmax(0,1fr));gap:4px;margin:18px 0}.da-personal .da-week-strip button{padding:8px 2px;display:grid;gap:5px;justify-items:center;background:color-mix(in srgb,var(--paper) 80%,transparent);color:var(--ink);border:1px solid var(--line)}.da-week-strip button[aria-pressed=true]{border-color:var(--green);box-shadow:inset 0 0 0 1px var(--green)}.da-week-strip small{font-size:10px}.da-today-head{padding:14px 0}.da-today-head>span{font-size:11px;color:var(--green);font-weight:700}.da-today-head h3{font-size:21px;margin:7px 0}.da-today-head p{font-size:13px;color:var(--muted)}.da-plan-meter{height:5px;border-radius:9px;background:var(--line);overflow:hidden}.da-plan-meter i{display:block;height:100%;background:var(--green)}.da-step{display:grid;grid-template-columns:32px 1fr;gap:11px;padding:15px 0;border-top:1px solid var(--line)}.da-step-num{width:30px;height:30px;display:grid;place-items:center;border-radius:50%;border:1px solid var(--line);color:var(--green);font-weight:700}.da-step small{display:block;color:var(--muted);margin:6px 0 10px}.da-step-actions{display:flex;gap:8px;flex-wrap:wrap}.da-personal .da-step-actions [data-done]{background:transparent;color:var(--ink);border-color:var(--line)}.da-step.done .da-step-num{background:var(--green);color:var(--paper)}`;
document.head.append(style);

const SETTINGS='deutschai-felcan-settings-v1', PLAN='deutschai-felcan-week-v1';
const weekdays=['Pazartesi','Salı','Çarşamba','Perşembe','Cuma','Cumartesi','Pazar'];
const goals={conversation:'Günlük konuşma',general:'Genel Almanca',goethe:'Goethe sınavı',work:'İş ve kariyer',travel:'Seyahat'};
const weekdaysIndex=()=> (new Date().getDay()+6)%7;
const weekStart=()=>{const d=new Date();d.setHours(12,0,0,0);d.setDate(d.getDate()-weekdaysIndex());return [d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-')};
const preferences=()=>read(SETTINGS);
const existingPlan=()=>read(PLAN);
const GOAL='deutschai-learning-goal-v1';
const levelCodes=['A1','A2','B1','B2','C1','C2'];
const goalLabels={goethe:'Goethe-Zertifikat',general:'Genel Almanca',conversation:'Günlük konuşma',work:'İş ve kariyer',travel:'Seyahat',relocation:'Almanya’da yaşam',telc:'telc',osd:'ÖSD',testdaf:'TestDaF',other:'Diğer'};
window.deutschaiGetLearningGoal=()=>read(GOAL);
window.deutschaiSaveLearningGoal=async input=>{
 if(!active()?.ready)return {success:false,error:'Önce hesabına giriş yap.'};
 const old=read(GOAL)||{};
 const label=String(input?.label||goalLabels[input?.type]||'').trim().slice(0,160);
 if(!label)return {success:false,error:'Öğrencinin gerçek hedefi gerekli.'};
 const type=Object.hasOwn(goalLabels,input?.type)?input.type:'other';
 const targetLevel=String(input?.targetLevel||'').trim().toUpperCase()||null;
 if(targetLevel&&!levelCodes.includes(targetLevel))return {success:false,error:'CEFR hedefi varsa A1–C2 olmalı; yoksa boş bırak.'};
 const minutes=Number(input?.dailyMinutes||old.dailyMinutes||preferences()?.minutes||state().daily||20);
 if(!Number.isInteger(minutes)||minutes<10||minutes>240)return {success:false,error:'Günlük 10–240 dakika arasında çalışma süresi gerekli.'};
 const today=new Date();const local=[today.getFullYear(),String(today.getMonth()+1).padStart(2,'0'),String(today.getDate()).padStart(2,'0')].join('-');
 const deadline=String(input?.deadline||'').trim()||null;
 if(deadline&&(!/^\d{4}-\d{2}-\d{2}$/.test(deadline)||!Number.isFinite(Date.parse(deadline))||new Date(deadline).toISOString().slice(0,10)!==deadline||deadline<local))return {success:false,error:'Geçerli, geçmişte olmayan sınav tarihi gerekli.'};
 const details=String(input?.details||'').trim().slice(0,1400);
 const goal={type,label,targetLevel,dailyMinutes:minutes,deadline,details,assessment:String(input?.assessment||'').trim().slice(0,500),topics:Array.isArray(input?.topics)?input.topics.filter(x=>typeof x==='string').map(x=>x.trim().slice(0,160)).filter(Boolean).slice(0,20):[],updatedAt:new Date().toISOString()};
 // Persist through the existing authenticated state endpoint before reporting success.
 try{await active().api('/state',{method:'PUT',body:JSON.stringify({bucket:GOAL,data:{raw:JSON.stringify(goal)}})});}catch(e){return {success:false,error:'Hedef sunucuya kaydedilemedi: '+String(e.message||e)}}
 store().setItem(GOAL,JSON.stringify(goal));
 const pref={...(preferences()||{}),minutes,goal: ['goethe','general','conversation','work','travel'].includes(type)?type:'general',focus:preferences()?.focus||'balanced'};
 store().setItem(SETTINGS,JSON.stringify(pref));
 window.deutschaiApplyLearningGoal?.(goal);
 window.dispatchEvent(new CustomEvent('deutschai:learning-goal-changed',{detail:goal}));
 const plan=await buildWeek(pref,true,null,true);
 return {success:true,goal,weeklyPlanReady:!!plan&&!plan.fallback,weeklyPlan:window.deutschaiWeeklyContext?.()||null,message:plan&&!plan.fallback?'Hedef kaydedildi ve haftalık plan hazır.':'Hedef kaydedildi; yapay zekâ planı hazır değil. Program bölümünden yeniden oluştur.'};
};

const minutesDisplay=n=>n>=60?(n%60?n/60+' saat':n/60+' saat'):n+' dakika';
function renderProgram(host,s,edit=false){
 const p=preferences(), plan=existingPlan(), learningGoal=read(GOAL), current=plan?.week===weekStart()&&Array.isArray(plan.days)&&(!learningGoal||plan.learningGoalRevision===learningGoal.updatedAt)?plan:null;
 if(!p||edit){
  const duration=Number(p?.minutes||s.daily||20);
  host.innerHTML='<h2>Program ayarları</h2>'
    +'<form class="da-plan-form"><label>Günde kaç dakika çalışabilirsin?<select name="minutes">'+[10,15,20,30,45,60,90,120,180,240].map(n=>'<option value="'+n+'" '+(duration===n?'selected':'')+'>'+minutesDisplay(n)+'</option>').join('')+'</select></label>'
    +'<label>Almanca öğrenme hedefin nedir?<select name="goal">'+Object.entries(goals).map(([k,v])=>'<option value="'+k+'" '+(p?.goal===k?'selected':'')+'>'+v+'</option>').join('')+'</select></label>'
    +'<label class="da-plan-wide">En çok neyi geliştirmek istiyorsun?<select name="focus">'+[['balanced','Her şeyden biraz'],['speaking','Konuşma'],['grammar','Gramer'],['vocabulary','Kelime'],['listening','Dinleme'],['writing','Yazma']].map(([k,v])=>'<option value="'+k+'" '+(p?.focus===k?'selected':'')+'>'+v+'</option>').join('')+'</select></label>'
    +'<div class="da-plan-wide"><button type="submit">Edit, programımı hazırla ✨</button> '+(p?'<button type="button" class="da-cancel">Vazgeç</button>':'')+'</div></form><p class="da-plan-muted" aria-live="polite">Bilgilerin yalnızca senin hesabında saklanır. Programını daha sonra değiştirebilirsin.</p>';
  host.querySelector('form').onsubmit=async event=>{
   event.preventDefault();
   const button=host.querySelector('button[type="submit"]'), form=event.currentTarget;
   const val={minutes:Number(form.elements.minutes.value),goal:form.elements.goal.value,focus:form.elements.focus.value};
   button.disabled=true;button.textContent='Edit programını hazırlıyor…';
   store().setItem(SETTINGS,JSON.stringify(val));
   try{
    if(typeof window.deutschaiPrepareDailyPlan==='function')window.deutschaiPrepareDailyPlan(val.minutes).catch(()=>{});
    else {const old=state();old.daily=val.minutes;store().setItem('deutschai-online-v1',JSON.stringify(old));}
    await buildWeek(val,true);
   }finally{renderProgram(host,state())}
  };
  host.querySelector('.da-cancel')?.addEventListener('click',()=>renderProgram(host,s));
  return;
 }
 const goal=learningGoal?learningGoal.label+(learningGoal.targetLevel?' '+learningGoal.targetLevel:'')+(learningGoal.deadline?' · '+learningGoal.deadline:''):goals[p.goal]||goals.general;
 const today=current?.days[weekdaysIndex()];
 host.innerHTML='<h2>Haftalık çalışma planı</h2>'
  +'<p>Hedefin <b>'+esc(goal)+'</b> · Günlük <b>'+esc(minutesDisplay(p.minutes))+'</b> · Seviye <b>'+esc(s.level||'A1')+'</b>. '+(today?'Bugün '+esc(today.topic)+' çalışıyoruz.':'Bu haftaki programını birlikte hazırlayalım.')+'</p>'
  +'<div class="da-plan-actions"><button class="da-plan-toggle">'+(current?'Haftalık planımı göster':'Haftalık program oluştur')+'</button><button class="da-settings">Çalışma süremi / hedefimi değiştir</button><button class="da-talk">Edit ile konuş</button></div>'
  +'<div class="da-week-slot" aria-live="polite"></div>';
 host.querySelector('.da-settings').onclick=()=>renderProgram(host,s,true);
 host.querySelector('.da-talk').onclick=()=>active().openFelkan();
 host.querySelector('.da-plan-toggle').onclick=()=>{const slot=host.querySelector('.da-week-slot');if(slot.childElementCount){slot.replaceChildren();return}if(current)drawWeek(host,current);else buildWeek(p,false,host)};
 if(current)drawWeek(host,current);
}
const routes=['lessons','grammar','words','practice','writing','exam'];
function taskRoute(task){
 if(routes.includes(task.route))return task.route;
 const s=String(task.activity||'').toLocaleLowerCase('tr');
 return /deneme|sınav/.test(s)?'exam':/yazma|konuşma|e-posta/.test(s)?'writing':/gramer|artikel|fiil çekimi/.test(s)?'grammar':/kelime/.test(s)?'words':/alıştırma|tekrar|dinleme|okuma/.test(s)?'practice':'lessons';
}
window.deutschaiWeeklyContext=()=>{
 const plan=existingPlan();if(plan?.week!==weekStart()||!Array.isArray(plan.days)||(read(GOAL)&&plan.learningGoalRevision!==read(GOAL).updatedAt))return null;
 const today=weekdaysIndex(),days=plan.days.map((d,i)=>({day:weekdays[i],topic:d.topic,tasks:(d.tasks||[]).map((t,j)=>({step:j+1,activity:t.activity,minutes:t.minutes,route:taskRoute(t),done:!!plan.done?.[i+'-'+j]}))}));
 return {week:plan.week,today:weekdays[today],todayIndex:today,days,next:days[today]?.tasks.find(t=>!t.done)||null};
};
window.deutschaiStartWeeklyTask=(dayIndex,taskIndex)=>{
 const plan=existingPlan(),i=Number(dayIndex),j=Number(taskIndex),task=plan?.days?.[i]?.tasks?.[j];
 if(!task||plan.week!==weekStart())return false;
 const route=taskRoute(task),context={week:plan.week,day:i,step:j,route,topic:plan.days[i].topic,activity:task.activity,minutes:task.minutes};
 if(typeof window.deutschaiStartPlannedStudy!=='function')return false;
 return window.deutschaiStartPlannedStudy(context);
};
function drawWeek(host,plan){
 const slot=host.querySelector('.da-week-slot');if(!slot)return;
 const today=weekdaysIndex();let selected=today;
 const draw=()=>{
 const current=existingPlan()||plan,done=current.done||{},day=current.days[selected],tasks=day.tasks||[],next=tasks.findIndex((_,j)=>!done[selected+'-'+j]);
 const completed=tasks.filter((_,j)=>done[selected+'-'+j]).length;
 slot.innerHTML='<div class="da-week-strip">'+current.days.map((d,i)=>'<button type="button" data-week-day="'+i+'" aria-pressed="'+(i===selected)+'"><small>'+weekdays[i].slice(0,3)+'</small><b>'+((d.tasks||[]).length&&(d.tasks||[]).every((_,j)=>done[i+'-'+j])?'✓':i===today?'●':i+1)+'</b></button>').join('')+'</div><div class="da-today-head"><span>'+weekdays[selected]+(selected===today?' · BUGÜN':'')+'</span><h3>'+esc(day.topic||'Almanca')+'</h3><p>'+tasks.reduce((n,t)=>n+Number(t.minutes||0),0)+' dk · '+completed+'/'+tasks.length+' tamamlandı</p><div class="da-plan-meter"><i style="width:'+(tasks.length?100*completed/tasks.length:0)+'%"></i></div></div><div class="da-step-list">'+tasks.map((t,j)=>'<article class="da-step '+(done[selected+'-'+j]?'done':'')+'"><span class="da-step-num">'+(done[selected+'-'+j]?'✓':j+1)+'</span><div><b>'+esc(t.activity)+'</b><small>'+t.minutes+' dk'+(j===next?' · Sıradaki adım':'')+'</small><div class="da-step-actions"><button data-start="'+j+'">'+(done[selected+'-'+j]?'Tekrar çalış':'Çalışmayı başlat →')+'</button><button data-done="'+j+'" aria-pressed="'+!!done[selected+'-'+j]+'">'+(done[selected+'-'+j]?'Geri al':'Tamamladım')+'</button></div></div></article>').join('')+'</div>'+(current.fallback?'<p class="da-plan-muted">Geçici plan · Edit ile yeniden hazırlayabilirsin.</p>':'')+'<button class="da-refresh-plan">Programı yeniden hazırla</button>';
 slot.querySelectorAll('[data-week-day]').forEach(btn=>btn.onclick=()=>{selected=Number(btn.dataset.weekDay);draw()});
 slot.querySelectorAll('[data-start]').forEach(btn=>btn.onclick=()=>{if(!window.deutschaiStartWeeklyTask(selected,Number(btn.dataset.start)))alert('Çalışma şu anda açılamadı. Tekrar dene.')});
 slot.querySelectorAll('[data-done]').forEach(btn=>btn.onclick=()=>{const latest=existingPlan();if(latest?.week!==plan.week)return;const key=selected+'-'+btn.dataset.done;latest.done=latest.done||{};if(latest.done[key])delete latest.done[key];else latest.done[key]=true;store().setItem(PLAN,JSON.stringify(latest));draw()});
 slot.querySelector('.da-refresh-plan').onclick=()=>buildWeek(preferences(),true,host);
 };draw();
}
function fallbackWeek(p,s){
 const focus=p.focus==='grammar'?'Gramer':p.focus==='speaking'?'Konuşma':p.focus==='vocabulary'?'Kelime':p.focus==='listening'?'Dinleme':p.focus==='writing'?'Yazma':'Karma tekrar';
 const first=Math.max(5,Math.round(p.minutes*.4)),second=p.minutes-first;
 return weekdays.map((_,i)=>({topic:[focus,'Yeni ders','Kelime ve tekrar','Konuşma alıştırması','Gramer ve uygulama','Okuma / dinleme','Haftalık tekrar'][i],tasks:[{activity:i===6?'Haftalık öğrendiklerini tekrar et':'Seviyene uygun Almanca dersini çalış',minutes:first},{activity:i===6?'Yanlışlarını gözden geçir':'Kelime ve gramer alıştırmalarını yap',minutes:second}]}));
}
async function buildWeek(p,force=false,host=null,background=false){
 if(!p)return;
 const e=host||document.getElementById('da-study-program');if(!e&&!background)return;
 const slot=e?.querySelector('.da-week-slot');
 if(slot)slot.innerHTML='<p>✨ Edit, seviyeni ve önceki çalışmalarını inceleyerek haftalık planını hazırlıyor…</p>';
 const s=state(),level=s.level||'A1',minutes=p.minutes,week=weekStart(),goal=read(GOAL);
 const task='Edit adlı Almanca öğretmenisin. Türkçe yaz. '+level+' seviyesindeki öğrenci için bu haftaya özel 7 günlük GERÇEKÇİ program hazırla. Günlük süre '+minutes+' dakika (aşma). Hedef: '+(goals[p.goal]||goals.general)+'. Kalıcı hedef: '+JSON.stringify(goal||{})+'. Mevcut seviye ile hedef seviyesi arasındaki farkı dikkate al; hedef sınav ise öğrencinin kaydedilmiş gerçek sınav adına, kapsamına, soru türlerine ve tarihine odaklan. CEFR seviyesi yoksa uydurma. YDT Almanca gibi yazılı çoktan seçmeli sınavlarda ağırlığı okuma, kelime, dil bilgisi ve sınav soru türlerine ver; Goethe formatını dayatma. Bilinmeyen sınavın resmi biçimini uydurma, öğrencinin bildirdiği kapsamı kullan. Resmi soru kopyalama ve başarı vaat etme. Odak: '+p.focus+'. Tamamlanan ders sayısı '+(s.completed||[]).length+'. Zorlanılan kelimeler '+JSON.stringify((s.wrongWords||[]).slice(0,8))+'. Her güne farklı konu ve 2 sıralı, uygulanabilir etkinlik koy. Her görevde route alanı mutlaka lessons, grammar, words, practice, writing, exam seçeneklerinden biri olsun. Kesinlikle SADECE geçerli, kısa JSON döndür: {"days":[{"topic":"konu","tasks":[{"activity":"kısa görev","minutes":10,"route":"lessons"},{"activity":"kısa görev","minutes":10,"route":"practice"}]}]}. days tam 7 eleman, Pazartesi-Pazar sıralı. Her günün süre toplamı '+minutes+' olmalı. Markdown kullanma.';
 let days=null,fallback=false;
 try {
  const res=await active().api('/ai/generate',{method:'POST',body:JSON.stringify({task,profile:{level,daily:minutes}})});
  const raw=String(res.text||'').trim(),parsed=JSON.parse(raw.slice(raw.indexOf('{'),raw.lastIndexOf('}')+1));
  if(!Array.isArray(parsed.days)||parsed.days.length!==7)throw Error('7 günlük plan alınamadı');
  days=parsed.days.map(day=>{
   const tasks=Array.isArray(day.tasks)?day.tasks.slice(0,2):[];
   if(tasks.length!==2)throw Error('Plan eksik');
   const a=Math.max(5,Math.min(minutes-5,Math.round(Number(tasks[0].minutes)||minutes*.5)));
   return {topic:String(day.topic||'Almanca').slice(0,90),tasks:[{activity:String(tasks[0].activity||'Ders').slice(0,130),minutes:a,route:taskRoute(tasks[0])},{activity:String(tasks[1].activity||'Alıştırma').slice(0,130),minutes:minutes-a,route:taskRoute(tasks[1])}]};
  });
 }catch(error){console.warn('Edit programı hazır planla değiştirildi:',error);fallback=true;days=fallbackWeek(p,s)}
 // Do not overwrite a more recent user's choices if another request was submitted.
 if(JSON.stringify(preferences())!==JSON.stringify(p)||read(GOAL)?.updatedAt!==goal?.updatedAt)return;
 const prev=existingPlan(),done=(!force&&prev?.week===week)?prev.done||{}:{};
 const plan={week,minutes,goal:p.goal,focus:p.focus,learningGoalRevision:goal?.updatedAt||null,days,done,fallback};
 store().setItem(PLAN,JSON.stringify(plan));
 if(e?.isConnected)renderProgram(e,state());return plan;
}

const AI_SECTIONS={
 lessons:{title:'Dersler',count:5,focus:'Öğretici yeni bir konu ve pekiştirme.'},
 placement:{title:'Seviye tespiti',count:8,focus:'A1-B2 arası özgün, dengeli seviye belirleme soruları. Tek başına resmi seviye tespiti olduğunu iddia etme.'},
 words:{title:'Kelimeler',count:7,focus:'Almanca kelimeler, artikeller, gündelik kullanımlar.'},
 grammar:{title:'Gramer',count:7,focus:'Gramer kuralı, çeviri, doğru fiil çekimi.'},
 practice:{title:'Pratik',count:8,focus:'Kelime, okuma, gramer, konuşma ve cümle kurma.'},
 exam:{title:'Deneme sınavı',count:12,focus:'Goethe tarzında özgün okuma, gramer, kelime ve iletişim. Resmi Goethe sınavı olduğunu söyleme.'},
 writing:{title:'Yazma ve konuşma',count:6,focus:'E-posta, cümle kurma, konuşma, dil kullanımı.'},
 progress:{title:'Tekrar ve ilerleme',count:5,focus:'Zayıf noktaları ve önceki yanlışları tekrarlama.'}
};
function draw(host,lesson,subject){
 const conf=AI_SECTIONS[subject]||AI_SECTIONS.practice;
 host.innerHTML='<h2>✦ Edit · '+esc(conf.title)+'</h2><p>'+esc(lesson.intro||'Sana özel hazırlanmış çalışmalar.')+'</p><div class="da-list"></div><div class="da-plan-actions"><button class="da-new">Yeni sorular hazırla</button><button class="da-talk-questions">Edit ile sesli çalış</button></div>';
 const dest=host.querySelector('.da-list');
 let shown=0;
 (Array.isArray(lesson.questions)?lesson.questions:[]).slice(0,conf.count).forEach((q,i)=>{
  if(!Array.isArray(q.options)||q.options.length!==4||!Number.isInteger(Number(q.answer))||Number(q.answer)<0||Number(q.answer)>3)return;
  const e=document.createElement('div');e.className='da-question';e.dataset.questionIndex=String(i+1);
  e.innerHTML='<b>'+esc((i+1)+'. '+String(q.question||''))+'</b><div class="da-opts"></div><p class="da-feedback" aria-live="polite"></p>';
  q.options.forEach((option,j)=>{
   const button=document.createElement('button');button.textContent=String(option);
   button.onclick=()=>{
    if(e.dataset.done)return;
    e.dataset.done='1';
    const correct=j===Number(q.answer);
    e.querySelectorAll('.da-opts button').forEach((x,k)=>{x.disabled=true;if(k===Number(q.answer))x.classList.add('correct')});
    if(!correct)button.classList.add('wrong');
    e.querySelector('.da-feedback').textContent=(correct?'Harika! ':'Tekrar edelim. ')+String(q.explanation||'').slice(0,480);
   };
   e.querySelector('.da-opts').append(button);
  });
  dest.append(e);shown++;
 });
 if(!shown)dest.textContent='Geçerli soru bulunamadı. Yeniden oluşturabilirsin.';
 host.querySelector('.da-new').onclick=()=>generate(subject,host,true);
 host.querySelector('.da-talk-questions').onclick=()=>active()?.openFelkan();
}
async function generate(subject,host,force=false){
 const conf=AI_SECTIONS[subject];if(!conf||!host?.isConnected)return;
 const date=new Date().toLocaleDateString('en-CA'),s=state();
 const cacheKey='da-personal-'+subject+'-'+(s.level||'A1')+'-'+date,cached=read(cacheKey);
 if(cached&&!force){draw(host,cached,subject);return}
 if(host.dataset.generating==='1')return;
 host.dataset.generating='1';
 host.innerHTML='<h2>✦ Edit '+esc(conf.title)+' hazırlıyor…</h2><p>Gemini, seviyene ve ilerlemene uygun sorular üretiyor.</p>';
 const level=s.level||'A1';
 const task="Sen DeutschAI öğretmeni Edit'sin. Türkçe açıkla. "+level+' düzeyine uygun '+conf.title+' bölümü hazırlıyorsun. '+conf.focus+' Tamamlanan ders sayısı '+(s.completed||[]).length+', yanlış kelimeler '+JSON.stringify((s.wrongWords||[]).slice(0,12))+'. Tam '+conf.count+' farklı 4 şıklı özgün soru üret. Cevap sırası dengeli olsun. Yalnızca geçerli JSON döndür, Markdown kullanma: {"intro":"Türkçe kısa öğretici açıklama","questions":[{"question":"özgün soru","options":["A","B","C","D"],"answer":0,"explanation":"Türkçe öğretici açıklama"}]}. answer 0-3 tamsayıdır.';
 try{
  let pending=questionRequests.get(cacheKey);
  if(!pending){
    pending=active().api('/ai/generate',{method:'POST',body:JSON.stringify({task,profile:{level,daily:s.daily||20}})}).then(res=>{
      const raw=String(res.text||'').trim(),first=raw.indexOf('{'),last=raw.lastIndexOf('}');
      if(first<0||last<first)throw Error('Gemini JSON sorusu göndermedi');
      const json=JSON.parse(raw.slice(first,last+1));
      if(!Array.isArray(json.questions)||json.questions.length<Math.min(4,conf.count))throw Error('Yeterli soru oluşturulamadı');
      store().setItem(cacheKey,JSON.stringify(json));
      return json;
    }).finally(()=>questionRequests.delete(cacheKey));
    questionRequests.set(cacheKey,pending);
  }
  const json=await pending;
  if(host.isConnected&&section()===subject)draw(host,json,subject);
 }catch(err){
  if(!host.isConnected)return;
  host.innerHTML='<h2>Edit bu çalışmayı hazırlayamadı</h2><p>'+esc(err.message)+'</p><button class="retry">Yeniden dene</button>';
  host.querySelector('.retry').onclick=()=>generate(subject,host,true);
 }finally{delete host.dataset.generating}
}
function update(){
 if(!active()?.ready)return;
 const root=document.getElementById('view');if(!root)return;
 const page=section();
 if(page==='program'){
  const host=root.querySelector('#da-study-program');
  if(host&&!host.childElementCount)renderProgram(host,state());
  return;
 }
 if(['placement','lessons','grammar','exam','words','practice','progress','writing'].includes(page))return; // Single canonical study surface; no duplicate AI blocks.
 if(!AI_SECTIONS[page]||root.querySelector('#da-personal-practice'))return;
 const el=document.createElement('section');el.className='da-personal';el.id='da-personal-practice';
 const top=root.querySelector('.top');if(top)top.after(el);else root.prepend(el);
 generate(page,el);
}
window.deutschaiRegenerateSection=(page)=>{
 const chosen=String(page||section());
 if(['lessons','grammar','exam','words','practice','writing'].includes(chosen))return window.deutschaiOpenPersonalStudy?.(chosen)===true;
 if(['placement','progress'].includes(chosen))return false;
 if(!AI_SECTIONS[chosen])return false;
 if(section()!==chosen){
   if(typeof window.setPage!=='function')return false;
   window.setPage(chosen);
 }
 setTimeout(()=>{
   update();
   const host=document.querySelector('#da-personal-practice');
   if(host)generate(chosen,host,true);
 },120);
 return true;
};
document.addEventListener('DOMContentLoaded',()=>{
 const root=document.getElementById('view');
 if(root)new MutationObserver(()=>queueMicrotask(update)).observe(root,{childList:true});
 setTimeout(update,300);
});
})();