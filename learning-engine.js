/* Account-scoped learning evidence. No AI-generated mastery scores. */
(function(root){
'use strict';
const KEY='deutschai-mastery-v1',DAY=86400000;
const clean=(v,n=120)=>String(v||'').normalize('NFKC').trim().slice(0,n);
const norm=v=>clean(v).toLocaleLowerCase('tr').replace(/[^\p{L}\p{N}]+/gu,' ').trim();
const skillOf=v=>{const s=norm(v);return /wort|vocab|kelime|words/.test(s)?'vocabulary':/gram|grammar|fiil|artikel/.test(s)?'grammar':/lesen|reading|okuma|paragraf/.test(s)?'reading':/hören|horen|listening|dinleme/.test(s)?'listening':/schreiben|writing|yazma/.test(s)?'writing':/sprechen|speaking|konuşma/.test(s)?'speaking':'general'};
function createEngine(store,clock=()=>Date.now()){
 const load=()=>{try{const x=JSON.parse(store.getItem(KEY)||'null');if(x?.version===1&&x.topics&&Array.isArray(x.events))return x;}catch{}return {version:1,topics:{},events:[]}};
 function record(e){
  if(!e||!e.id||typeof e.correct!=='boolean'||!clean(e.topic))return false;
  const db=load(),id=clean(e.id,220);if(db.events.includes(id))return false;
  const level=/^(A1|A2|B1|B2|C1|C2)$/.test(e.level)?e.level:'unknown',skill=skillOf(e.skill),topic=clean(e.topic),key=level+'|'+skill+'|'+norm(topic);
  const now=clock(),old=Object.hasOwn(db.topics,key)?db.topics[key]:null;
  const t=old||{topic,level,skill,total:0,correct:0,independent:0,independentCorrect:0,streak:0,reviewStage:0,days:[],recent:[],lastAt:0,dueAt:0};
  t.total++;if(e.correct)t.correct++;t.recent=[...t.recent,e.correct?1:0].slice(-10);
  if(!e.assisted){
    t.independent++;if(e.correct)t.independentCorrect++;
    t.streak=e.correct?t.streak+1:0;
    const date=new Date(now).toISOString().slice(0,10);t.days=[...new Set([...t.days,date])].slice(-12);
    if(!e.correct)t.reviewStage=0;
    else if(!t.lastIndependentAt||now>=t.dueAt)t.reviewStage=Math.min(4,t.reviewStage+1);
    t.lastIndependentAt=now;
    t.dueAt=now+DAY*[1,1,3,7,14][t.reviewStage];
  }else if(!e.correct||!t.dueAt){t.dueAt=now+DAY;t.reviewStage=0}
  t.lastAt=now;db.topics[key]=t;db.events=[...db.events,id].slice(-800);
  const entries=Object.entries(db.topics).sort((a,b)=>b[1].lastAt-a[1].lastAt).slice(0,120);db.topics=Object.fromEntries(entries);
  store.setItem(KEY,JSON.stringify(db));return true;
 }
 function summary(level){
  const now=clock(),all=Object.entries(load().topics).map(([id,t])=>{
    const accuracy=t.total?Math.round(t.correct/t.total*100):0,independentAccuracy=t.independent?Math.round(t.independentCorrect/t.independent*100):null;
    const recent=t.recent.length?t.recent.reduce((a,b)=>a+b,0)/t.recent.length:0;
    const status=t.independent>=5&&t.days.length>=2&&t.streak>=3&&independentAccuracy>=80&&recent>=.8?'pekişti':t.total<3?'ölçülüyor':recent<.6?'zorlanıyor':'gelişiyor';
    return {id,topic:t.topic,level:t.level,skill:t.skill,accuracy,independentAccuracy,total:t.total,independent:t.independent,status,dueAt:t.dueAt,due:!!t.dueAt&&t.dueAt<=now,lastAt:t.lastAt};
  }).filter(x=>!level||x.level===level);
  const priority=all.filter(x=>x.due||x.status==='zorlanıyor').sort((a,b)=>Number(b.due)-Number(a.due)||a.accuracy-b.accuracy||a.dueAt-b.dueAt);
  return {topics:all.sort((a,b)=>b.lastAt-a.lastAt),priority:priority.slice(0,8),next:priority[0]||null,observations:all.reduce((n,t)=>n+t.total,0)};
 }
 return {record,summary};
}
root.DilLearningEngine={create:createEngine,skillOf};
if(typeof module!=='undefined'&&module.exports)module.exports=root.DilLearningEngine;
})(typeof window!=='undefined'?window:globalThis);
