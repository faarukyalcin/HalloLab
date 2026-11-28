"use strict";
(() => {
  const apiBase = "https://generativelanguage.googleapis.com/v1beta";
  let sessionKey = "";
  const brokerReady = () => Boolean(window.DEUTSCHAI_API_URL && window.DeutschAI?.ready);

  async function geminiRequest(route, body, timeout) {
    const key = sessionKey;
    if (!key) throw new Error("Gemini için İlerleme sayfasından API anahtarını ekle.");
    let response;
    try {
      response = await fetch(apiBase + route, {
        method: "POST",
        headers: { "x-goog-api-key": key, "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(timeout)
      });
    } catch (error) {
      throw new Error(error.name === "TimeoutError" ? "Gemini isteği zaman aşımına uğradı." : "Gemini sunucusuna bağlanılamadı.");
    }
    if (!response.ok) throw new Error("Gemini isteği başarısız (HTTP " + response.status + "). API anahtarını ve erişimini kontrol et.");
    return response.json();
  }

  const quizFormat = "Her soruda question, options (metin dizisi), answer (sıfır tabanlı doğru seçenek), explanation ve level alanları olsun.";
  const taskFormats = {
    diagnostic: "title, intro ve questions alanları olsun. " + quizFormat,
    diagnosticGrade: "recommendedLevel, confidence (0–1), focusAreas (dizi), rationaleTr alanları olsun.",
    evaluate: "score (0–100), estimatedLevel, feedbackTr, strengths, corrections, weakTopics, nextExercise alanları olsun.",
    exam: "title, sections ve questions alanları olsun. " + quizFormat,
    lesson: "title, objective, explanation, examples [{de,tr}], vocabulary [{de,tr}] ve questions alanları olsun. " + quizFormat,
    plan: "title, level, focus ve days [{day,activity,minutes}] alanları olsun.",
    daily: "title, level, adaptationTr, schedule [{activity,skill,minutes}], vocabularyReview [{de,tr}], newVocabulary [{de,tr,category,exampleDe,exampleTr}], grammarReview {topic,explanationTr,examples:[{de,tr}]}, lesson {title,objective,explanationTr,examples:[{de,tr}]}, exercises [{skill,prompt,options,answer,explanationTr}], writingTask {prompt,criteria}, speakingTask {prompt}, goethePractice {title,prompt} alanları olsun."
  };

  async function geminiTutor(input) {
    const task = input?.task;
    if (!Object.hasOwn(taskFormats, task)) throw new Error("Bilinmeyen Gemini çalışması.");
    const instructions = "Türkçe konuşan bir öğrenci için Almanca öğretmenisin. Genel çalışmalarda günlük iletişim ve kelime, gramer, dinleme, konuşma, okuma, yazma becerilerine odaklan. Öğrenci profilindeki learningGoal kalıcı eğitim hedefidir: mevcut seviyeyi hedef seviyeye karıştırma, hedefe kademeli ilerle. Goethe/telc/ÖSD/TestDaF hedeflerinde uygun özgün sınav hazırlığı yap; resmi sınav sorularını kopyalama ve başarı garantisi verme. Herhangi bir özel sınav veya amaç için learningGoal.label, details, assessment ve topics alanlarını kullan. YKS Almanca YDT hedefinde özgün çoktan seçmeli okuma, kelime ve dil bilgisi odaklı içerik üret, Goethe biçimini dayatma. Okul sınavında öğrencinin verdiği müfredat ve soru türleri önceliklidir. Bilinmeyen resmi sınav formatını uydurma. Hedef yoksa Goethe biçimini yalnızca istek özellikle belirttiğinde kullan. Almanca örnek ve soruları seçilen CEFR seviyesine, açıklamaları Türkçeye uyarla. Bir JSON nesnesi döndür. Kullanıcı isteğinde belirli bir JSON yapısı istendiğinde onu kullan. Aksi halde şu yapıyı kullan: " + taskFormats[task];
    if (brokerReady()) {
      // The deployed Worker caps task at 3000 characters. Keep the actual request
      // first, and include only bounded personalization instead of duplicating history.
      const p=input.profile||{},g=p.learningGoal||{},lp=p.learnerProgress||{};
      const context={level:p.level,daily:p.dailyMinutes||p.daily,goal:g.label?{label:g.label,targetLevel:g.targetLevel,details:String(g.details||'').slice(0,180),topics:(g.topics||[]).slice(0,5)}:null,focus:(p.focusAreas||[]).slice(0,5),weak:(p.mastery||[]).slice(0,4).map(x=>x.topic),recent:(lp.recentAnswers||[]).slice(-6).map(x=>({ok:x.ok,skill:x.skill}))};
      const head='Edit Almanca öğretmeni. Türkçe açıkla, gerçek seviyeye ve hedefe uygun özgün içerik hazırla. Yalnız geçerli JSON, Markdown yok. Kullanıcının istediği JSON şeması öncelikli. Görev: '+task+'\n';
      const request=String(input.text||'');
      const tail='\nÖğrenci: '+JSON.stringify(context);
      const room=3000-head.length-40;
      const prompt=head+(request.length<=room-tail.length?request+tail:request.length<=room?request:request.slice(0,room))+'\nSadece JSON döndür.';
      const response = await window.DeutschAI.api('/ai/generate',{
        method:'POST',body:JSON.stringify({task:prompt,profile:input.profile||{}})
      });
      const raw = String(response.text || '').trim();
      let answer;
      try { answer = JSON.parse(raw.slice(raw.indexOf('{'),raw.lastIndexOf('}')+1)); } catch {}
      if (!answer || typeof answer !== 'object' || Array.isArray(answer))
        throw Error('Felkan geçerli bir çalışma döndürmedi.');
      return answer;
    }
    const data = await geminiRequest("/models/gemini-3.8-flash:generateContent", {
      systemInstruction: { parts: [{ text: instructions }] },
      contents: [{ role: "user", parts: [{ text: JSON.stringify({
        task, profile: input.profile, history: Array.isArray(input.history) ? input.history.slice(-12) : [], request: String(input.text || "")
      }) }] }],
      generationConfig: { responseMimeType: "application/json" }
    }, 90000);
    const result = data.candidates?.[0]?.content?.parts?.filter(part => !part.thought).map(part => part.text || "").join("");
    let answer;
    try { answer = JSON.parse(result); } catch {}
    if (!answer || typeof answer !== "object" || Array.isArray(answer)) throw new Error("Gemini geçerli bir çalışma döndürmedi.");
    return answer;
  }

  async function geminiLiveToken() {
    if (brokerReady()) {
      const response = await window.DeutschAI.api('/ai/live-token',{method:'POST',body:'{}'});
      return {token:response.token,model:'models/gemini-3.8-live'};
    }
    const data = await geminiRequest("/auth_tokens", { uses: 1 }, 20000);
    if (!data.name) throw new Error("Gemini Live oturum anahtarı alınamadı.");
    return { token: data.name, model: "models/gemini-3.8-live" };
  }

  window.deutschaiWeb = Object.freeze({
    geminiTutor,
    geminiLiveToken,
    geminiKeyStatus: async () => brokerReady() ? window.DeutschAI.api('/ai/status') : ({configured:!!sessionKey}),
    geminiKeySave: async value => {
      if (window.DEUTSCHAI_API_URL) throw Error('Gemini anahtarını yalnız yönetici panelinden ayarlayabilirsin.');
      const key = String(value || "").trim();
      if (key.length < 20 || key.length > 256 || /\s/.test(key)) throw new Error("Geçerli Gemini API anahtarını gir.");
      sessionKey = key;
      return { configured: true };
    },
    geminiKeyRemove: async () => {
      if (window.DEUTSCHAI_API_URL) throw Error('Ortak anahtar yalnız yönetici panelinden değiştirilebilir.');
      sessionKey='';return {configured:false};
    }
  });
})();
