"use strict";
(() => {
  const apiBase = "https://generativelanguage.googleapis.com/v1beta";
  let sessionKey = "";

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
    const instructions = "Türkçe konuşan bir öğrenci için Goethe odaklı Almanca öğretmenisin. Almanca örnek ve soruları seçilen CEFR seviyesine, açıklamaları Türkçeye uyarla. Bir JSON nesnesi döndür. Kullanıcı isteğinde belirli bir JSON yapısı istendiğinde onu kullan. Aksi halde şu yapıyı kullan: " + taskFormats[task];
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
    const data = await geminiRequest("/auth_tokens", { uses: 1 }, 20000);
    if (!data.name) throw new Error("Gemini Live oturum anahtarı alınamadı.");
    return { token: data.name, model: "models/gemini-3.8-live" };
  }

  window.deutschaiWeb = Object.freeze({
    geminiTutor,
    geminiLiveToken,
    geminiKeyStatus: async () => ({ configured: !!sessionKey }),
    geminiKeySave: async value => {
      const key = String(value || "").trim();
      if (key.length < 20 || key.length > 256 || /\s/.test(key)) throw new Error("Geçerli Gemini API anahtarını gir.");
      sessionKey = key;
      return { configured: true };
    },
    geminiKeyRemove: async () => { sessionKey = ""; return { configured: false }; }
  });
})();
