/* ── 상태 ──────────────────────────────────────── */
let selectedLang = "english";
let selectedMode = "oneline";
let selectedTopic = null;
let selectedDifficulty = null;
let selectedOnelinePrompt = null;
let currentAnalysis = null;
let currentText = "";

/* ── 오늘의 질문 데이터 ─────────────────────────── */
const DAILY_QUESTIONS = {
  easy: [
    "오늘 뭐 했어요?",
    "오늘 먹은 음식 중 가장 맛있었던 건?",
    "오늘 날씨는 어땠나요?",
    "오늘 만난 사람이 있나요?",
    "오늘 어디에 갔나요?"
  ],
  medium: [
    "오늘 가장 기억에 남는 순간은?",
    "오늘 배운 것이 있다면?",
    "오늘 가장 힘들었던 순간은?",
    "오늘 감사했던 일이 있나요?",
    "오늘 가장 즐거웠던 시간은?"
  ],
  hard: [
    "오늘 하루를 감정 중심으로 설명해보세요",
    "오늘 당신이 내린 결정 중 가장 의미 있었던 것은?",
    "오늘의 경험이 당신을 어떻게 성장시켰나요?",
    "오늘 가장 복잡한 감정을 느낀 순간을 묘사해보세요",
    "오늘 하루가 당신에게 어떤 의미였나요?"
  ]
};

const DIFF_ICONS = { easy: "🟢", medium: "🟡", hard: "🔴" };

function getTodayQuestion(level) {
  const dayOfYear = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0)) / 86400000);
  const list = DAILY_QUESTIONS[level];
  return list[dayOfYear % list.length];
}

/* ── 주제 & 힌트 데이터 ─────────────────────────── */
const TOPICS = {
  english: [
    { id: "my-day",   emoji: "☀️",  label: "My Day",      hints: ["woke up", "had breakfast", "went to", "felt", "because"] },
    { id: "weekend",  emoji: "🎉",  label: "Weekend",     hints: ["plan to", "want to", "with friends", "excited", "relax"] },
    { id: "food",     emoji: "🍽️", label: "Food",        hints: ["delicious", "tried", "tasted like", "cooked", "restaurant"] },
    { id: "weather",  emoji: "🌤️", label: "Weather",     hints: ["sunny", "cold", "it rained", "warm", "cloudy"] },
    { id: "feelings", emoji: "💭",  label: "Feelings",    hints: ["I felt", "happy", "nervous", "proud", "grateful"] },
    { id: "school",   emoji: "📚",  label: "School/Work", hints: ["learned", "difficult", "my teacher", "classmates", "homework"] },
  ],
  chinese: [
    { id: "my-day",   emoji: "☀️",  label: "我的一天",   hints: ["早上", "吃饭", "去了", "感觉", "因为"] },
    { id: "weekend",  emoji: "🎉",  label: "周末计划",   hints: ["打算", "想要", "和朋友", "开心", "休息"] },
    { id: "food",     emoji: "🍽️", label: "美食",       hints: ["好吃", "尝试了", "味道", "做饭", "餐厅"] },
    { id: "weather",  emoji: "🌤️", label: "天气",       hints: ["晴天", "冷", "下雨了", "暖和", "多云"] },
    { id: "feelings", emoji: "💭",  label: "心情",       hints: ["我感到", "高兴", "紧张", "骄傲", "感谢"] },
    { id: "school",   emoji: "📚",  label: "学校/工作",  hints: ["学到了", "困难", "老师", "同学", "作业"] },
  ]
};

/* ── DOM 참조 ──────────────────────────────────── */
const diaryInput      = document.getElementById("diary-input");
const charCount       = document.getElementById("char-count");
const analyzeBtn      = document.getElementById("analyze-btn");
const btnText         = analyzeBtn.querySelector(".btn-text");
const btnLoading      = analyzeBtn.querySelector(".btn-loading");
const feedbackSec     = document.getElementById("feedback-section");
const saveBtn         = document.getElementById("save-btn");
const saveMsg         = document.getElementById("save-msg");
const writeCard       = document.getElementById("write-card");
const analyzingOverlay = document.getElementById("analyzing-overlay");

/* ── 카드 상태 관리 ─────────────────────────────── */
function setCardState(state) {
  writeCard.dataset.state = state;
  if (state === "analyzing") {
    analyzingOverlay.classList.add("visible");
  } else {
    analyzingOverlay.classList.remove("visible");
  }
}


/* ── 언어 선택 ─────────────────────────────────── */
document.querySelectorAll(".lang-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".lang-btn").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    selectedLang = btn.dataset.lang;
    selectedTopic = null;
    if (selectedMode === "guided" && selectedDifficulty) renderGuidedTopics();
    updatePlaceholder();
  });
});

/* ── 모드 선택 ─────────────────────────────────── */
document.querySelectorAll(".mode-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".mode-btn").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    selectedMode = btn.dataset.mode;
    selectedTopic = null;
    selectedDifficulty = null;
    selectedOnelinePrompt = null;

    const onelineSection = document.getElementById("oneline-section");
    const guidedSection  = document.getElementById("guided-section");

    onelineSection.classList.add("hidden");
    guidedSection.classList.add("hidden");
    document.getElementById("guided-detail").classList.add("hidden");
    document.getElementById("guided-hint-section").classList.add("hidden");
    document.querySelectorAll(".oneline-prompt-btn").forEach(b => b.classList.remove("active"));

    if (selectedMode === "oneline") {
      onelineSection.classList.remove("hidden");
    } else if (selectedMode === "guided") {
      guidedSection.classList.remove("hidden");
      renderGuidedDiffCards();
    }
    updatePlaceholder();
  });
});

/* ── 가이드 모드 난이도 카드 ─────────────────────── */
const GUIDED_SENTENCES = { easy: "1~2문장", medium: "2~3문장", hard: "3~5문장" };

function renderGuidedDiffCards() {
  document.querySelectorAll("#guided-section .difficulty-card").forEach(card => {
    card.classList.toggle("active", card.dataset.level === selectedDifficulty);
    card.onclick = () => {
      selectedDifficulty = card.dataset.level;
      selectedTopic = null;
      renderGuidedDiffCards();
      showGuidedDetail(selectedDifficulty);
      updatePlaceholder();
    };
  });
}

function showGuidedDetail(level) {
  const detail = document.getElementById("guided-detail");
  const qBox   = document.getElementById("guided-question-box");
  qBox.querySelector(".sq-icon").textContent = DIFF_ICONS[level];
  qBox.querySelector(".sq-text").textContent = getTodayQuestion(level);
  document.getElementById("guided-sentence-guide").textContent =
    GUIDED_SENTENCES[level] + " 써보세요 ✨";
  document.getElementById("guided-hint-section").classList.add("hidden");
  detail.classList.remove("hidden");
  renderGuidedTopics();
}

/* ── 가이드 모드 주제 렌더링 ─────────────────────── */
function renderGuidedTopics() {
  const grid = document.getElementById("guided-topic-grid");
  grid.innerHTML = "";
  TOPICS[selectedLang].forEach(topic => {
    const card = document.createElement("button");
    card.className = "topic-card" + (selectedTopic?.id === topic.id ? " active" : "");
    card.innerHTML = `<span class="topic-emoji">${topic.emoji}</span><span class="topic-name">${topic.label}</span>`;
    card.addEventListener("click", () => {
      selectedTopic = topic;
      renderGuidedTopics();
      renderGuidedHints(topic.hints);
      updatePlaceholder();
    });
    grid.appendChild(card);
  });
}

/* ── 가이드 모드 힌트 단어 ───────────────────────── */
function renderGuidedHints(hints) {
  const section   = document.getElementById("guided-hint-section");
  const container = document.getElementById("guided-hint-words");
  container.innerHTML = "";
  hints.forEach(word => {
    const chip = document.createElement("button");
    chip.className = "hint-chip";
    chip.textContent = word;
    chip.addEventListener("click", () => {
      if (chip.classList.contains("used")) return;
      insertAtCursor(diaryInput, word + " ");
      chip.classList.add("used");
      charCount.textContent = diaryInput.value.length;
      diaryInput.focus();
    });
    container.appendChild(chip);
  });
  section.classList.remove("hidden");
}

/* ── 커서 위치에 텍스트 삽입 ────────────────────── */
function insertAtCursor(el, text) {
  const start = el.selectionStart;
  const end = el.selectionEnd;
  el.value = el.value.slice(0, start) + text + el.value.slice(end);
  el.selectionStart = el.selectionEnd = start + text.length;
}

/* ── 플레이스홀더 업데이트 ──────────────────────── */
function updatePlaceholder() {
  const lang = selectedLang === "english" ? "영어" : "중국어";
  if (selectedMode === "oneline") {
    const prompts = {
      feeling: `오늘 기분을 ${lang}로 한 문장으로 써보세요...`,
      event:   `오늘 있었던 일을 ${lang}로 한 문장으로 써보세요...`
    };
    diaryInput.placeholder = selectedOnelinePrompt
      ? prompts[selectedOnelinePrompt]
      : `${lang}로 한 문장만 써도 충분해요!`;
  } else if (selectedMode === "guided") {
    if (!selectedDifficulty) {
      diaryInput.placeholder = "위에서 난이도를 고르면 질문과 힌트가 나와요!";
    } else if (!selectedTopic) {
      diaryInput.placeholder = `위 질문에 답하거나, 주제를 골라서 ${lang}로 써보세요...`;
    } else {
      diaryInput.placeholder = `'${selectedTopic.label}' 주제로 ${GUIDED_SENTENCES[selectedDifficulty]} 써보세요!`;
    }
  } else {
    diaryInput.placeholder = `오늘 있었던 일을 ${lang}로 자유롭게 써보세요...`;
  }
}

/* ── 한 줄 시작 프롬프트 ───────────────────────── */
document.querySelectorAll(".oneline-prompt-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".oneline-prompt-btn").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    selectedOnelinePrompt = btn.dataset.prompt;
    updatePlaceholder();
    diaryInput.focus();
  });
});

/* ── 글자 수 카운터 + ② 작성 중 상태 ─────────── */
diaryInput.addEventListener("input", () => {
  const len = diaryInput.value.length;
  charCount.textContent = len;
  setCardState(len > 0 ? "writing" : "idle");
});

/* ── AI 분석 요청 ───────────────────────────────── */
analyzeBtn.addEventListener("click", async () => {
  const text = diaryInput.value.trim();
  if (!text) {
    alert("일기 내용을 입력해주세요.");
    return;
  }

  setLoading(true);
  setCardState("analyzing");
  feedbackSec.classList.add("hidden");
  saveMsg.classList.add("hidden");

  try {
    const res = await fetch("/analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, language: selectedLang })
    });

    if (!res.ok) {
      let msg = "서버 오류가 발생했습니다.";
      try { const err = await res.json(); msg = err.error || msg; } catch {}
      throw new Error(msg);
    }

    const data = await res.json();
    currentText     = text;
    currentAnalysis = data.analysis;

    renderFeedback(data);
    setCardState("done");
    feedbackSec.classList.remove("hidden");
    feedbackSec.scrollIntoView({ behavior: "smooth", block: "start" });

  } catch (e) {
    alert("오류: " + e.message);
  } finally {
    setLoading(false);
  }
});

/* ── 피드백 렌더링 ──────────────────────────────── */
function renderFeedback({ analysis, quiz, vocabulary }) {
  // 점수 & 레벨
  document.getElementById("score-value").textContent = analysis.score;
  document.getElementById("overall-feedback").textContent = analysis.overall_feedback_kr;

  const badge = document.getElementById("level-badge");
  const levelMap = { beginner: "초급", intermediate: "중급", advanced: "고급" };
  badge.textContent = levelMap[analysis.level] || analysis.level;
  badge.className = `badge badge-${analysis.level}`;

  // 교정 텍스트
  document.getElementById("corrected-text").textContent = analysis.corrected_text;

  // 오류 목록
  const errorsCard = document.getElementById("errors-card");
  const errorsList = document.getElementById("errors-list");
  errorsList.innerHTML = "";

  if (analysis.errors && analysis.errors.length > 0) {
    errorsCard.classList.remove("hidden");
    analysis.errors.forEach(err => {
      const li = document.createElement("li");
      li.className = `error-item ${err.type}`;
      li.innerHTML = `
        <div class="error-top">
          <span class="error-original">${escHtml(err.original)}</span>
          <span class="arrow">→</span>
          <span class="error-corrected">${escHtml(err.corrected)}</span>
          <span class="error-type">${err.type}</span>
        </div>
        <div class="error-explanation">${escHtml(err.explanation_kr)}</div>
      `;
      errorsList.appendChild(li);
    });
  } else {
    errorsCard.classList.remove("hidden");
    errorsList.innerHTML = '<li style="color:var(--accent);padding:8px 0;">오류 없음! 훌륭한 문장입니다 🎉</li>';
  }

  // 빈칸 채우기 퀴즈
  const quizCard = document.getElementById("quiz-card");
  const quizList = document.getElementById("quiz-list");
  quizList.innerHTML = "";

  if (quiz && quiz.length > 0) {
    quizCard.classList.remove("hidden");
    quiz.forEach((q, i) => {
      const div = document.createElement("div");
      div.className = "quiz-item";
      div.dataset.answer = q.answer.toLowerCase().trim();
      div.innerHTML = `
        <div class="quiz-number">문제 ${i + 1}</div>
        <div class="quiz-sentence">${escHtml(q.sentence_with_blank).replace("___", '<strong>___</strong>')}</div>
        <div class="quiz-input-wrap">
          <input type="text" class="quiz-input" placeholder="정답을 입력하세요" />
        </div>
        <div class="quiz-hint">💡 힌트: ${escHtml(q.hint_kr)}</div>
        <div class="quiz-result"></div>
      `;
      quizList.appendChild(div);
    });
  } else {
    quizCard.classList.add("hidden");
  }

  // 관련 단어
  const vocabCard = document.getElementById("vocab-card");
  const vocabList = document.getElementById("vocab-list");
  vocabList.innerHTML = "";

  if (vocabulary && vocabulary.length > 0) {
    vocabCard.classList.remove("hidden");
    vocabulary.forEach(v => {
      const div = document.createElement("div");
      div.className = "vocab-item";
      const tags = (v.related_words || []).map(w => `<span class="vocab-tag">${escHtml(w)}</span>`).join("");
      div.innerHTML = `
        <div class="vocab-word">${escHtml(v.word)}</div>
        <div class="vocab-meaning">${escHtml(v.meaning_kr)}</div>
        <div class="vocab-example">"${escHtml(v.example_sentence)}"</div>
        <div class="vocab-related">${tags}</div>
      `;
      vocabList.appendChild(div);
    });
  } else {
    vocabCard.classList.add("hidden");
  }
}

/* ── 퀴즈 정답 확인 ─────────────────────────────── */
document.getElementById("check-quiz-btn").addEventListener("click", () => {
  document.querySelectorAll(".quiz-item").forEach(item => {
    const input   = item.querySelector(".quiz-input");
    const result  = item.querySelector(".quiz-result");
    const correct = item.dataset.answer;
    const userAns = input.value.toLowerCase().trim();

    input.classList.remove("correct", "wrong");
    result.classList.remove("show", "correct", "wrong");

    if (!userAns) return;

    if (userAns === correct) {
      input.classList.add("correct");
      result.textContent = "✅ 정답!";
      result.classList.add("show", "correct");
    } else {
      input.classList.add("wrong");
      result.textContent = `❌ 오답 — 정답: ${item.dataset.answer}`;
      result.classList.add("show", "wrong");
    }
  });
});

/* ── 표현 추천 ─────────────────────────────────── */
async function fetchExpress(mode) {
  const text = diaryInput.value.trim();
  if (!text) { alert("먼저 일기를 써주세요."); return; }

  const naturalBtn = document.getElementById("natural-btn");
  const nativeBtn  = document.getElementById("native-btn");
  const resultBox  = document.getElementById("expr-result");

  naturalBtn.disabled = true;
  nativeBtn.disabled  = true;
  resultBox.innerHTML = '<p style="font-size:.85rem;color:var(--muted);padding:4px 0;">분석 중...</p>';
  resultBox.classList.remove("hidden");

  try {
    const res = await fetch("/express", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, language: selectedLang, mode })
    });
    const data = await res.json();
    if (data.error) throw new Error(data.error);

    const title = mode === "natural" ? "✨ 더 자연스러운 표현" : "🗣️ 네이티브 표현";
    const items = (data.suggestions || []).map(s => `
      <div class="expr-item">
        <div class="expr-original">${escHtml(s.original)}</div>
        <div class="expr-suggested">${escHtml(s.suggested)}</div>
        <div class="expr-reason">${escHtml(s.reason_kr)}</div>
      </div>
    `).join("");

    resultBox.innerHTML = `<div class="expr-result-title">${title}</div>${items || "<p style='font-size:.85rem;color:var(--muted)'>추천할 표현이 없어요!</p>"}`;
  } catch (e) {
    resultBox.innerHTML = `<p style="font-size:.85rem;color:#A04040;">오류: ${escHtml(e.message)}</p>`;
  } finally {
    naturalBtn.disabled = false;
    nativeBtn.disabled  = false;
  }
}

document.getElementById("natural-btn").addEventListener("click", () => fetchExpress("natural"));
document.getElementById("native-btn").addEventListener("click",  () => fetchExpress("native"));

/* ── LocalStorage 유틸 ──────────────────────────── */
const STORAGE_KEY = "litdiary_entries";

function getEntries() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]"); }
  catch { return []; }
}

function saveEntry(entry) {
  const entries = getEntries();
  entries.push(entry);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
}

function deleteEntry(id) {
  const entries = getEntries().filter(e => e.id !== id);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
}

/* ── 일기 저장 (txt 다운로드) ──────────────────── */
saveBtn.addEventListener("click", () => {
  if (!currentAnalysis) return;

  const date = new Date().toLocaleString("ko-KR", { year:"numeric", month:"2-digit", day:"2-digit", hour:"2-digit", minute:"2-digit" });
  const langLabel = selectedLang === "english" ? "English" : "中文";
  const levelMap  = { beginner: "초급", intermediate: "중급", advanced: "고급" };
  const level     = levelMap[currentAnalysis.level] || currentAnalysis.level;
  const errors    = (currentAnalysis.errors || []).map((e, i) =>
    `  ${i + 1}. [${e.type}] ${e.original} → ${e.corrected}\n     ${e.explanation_kr}`
  ).join("\n");

  const content = [
    `LitDiary — 나의 언어 일기`,
    `=${"=".repeat(38)}`,
    `날짜    : ${date}`,
    `언어    : ${langLabel}`,
    `레벨    : ${level}  |  점수 : ${currentAnalysis.score}점`,
    ``,
    `[ 원문 ]`,
    currentText,
    ``,
    `[ 교정된 문장 ]`,
    currentAnalysis.corrected_text,
    ``,
    `[ 총평 ]`,
    currentAnalysis.overall_feedback_kr,
    ``,
    errors ? `[ 오류 목록 ]\n${errors}` : `[ 오류 목록 ]\n  오류 없음 🎉`,
    ``,
    `-${"—".repeat(38)}`,
    `Generated by LitDiary`
  ].join("\n");

  const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  const fileName = `LitDiary_${date.replace(/[.\s:]/g, "-").replace(/-+/g, "-")}.txt`;
  a.href = url;
  a.download = fileName;
  a.click();
  URL.revokeObjectURL(url);

  saveMsg.classList.remove("hidden");
  saveBtn.disabled = true;
  setTimeout(() => {
    saveMsg.classList.add("hidden");
    saveBtn.disabled = false;
  }, 3000);
});

/* ── 히스토리 로드 ──────────────────────────────── */
function loadHistory() {
  const container = document.getElementById("history-list");
  const list = getEntries();

  if (!list.length) {
    container.innerHTML = "<p class='empty-msg'>저장된 일기가 없습니다.</p>";
    return;
  }

  container.innerHTML = "";
  [...list].reverse().forEach(entry => {
    const div = document.createElement("div");
    div.className = "history-item";
    const langLabel = entry.language === "english" ? "🇺🇸 English" : "🇨🇳 中文";
    const score = entry.analysis?.score ?? "--";
    const preview = (entry.text || "").slice(0, 80) + (entry.text?.length > 80 ? "..." : "");

    div.innerHTML = `
      <div class="history-top">
        <span class="history-date">${entry.date}</span>
        <span class="history-lang">${langLabel}</span>
      </div>
      <div class="history-preview">${escHtml(preview)}</div>
      <div class="history-score">점수: ${score}점 · ${entry.analysis?.level ?? ""}</div>
    `;
    div.addEventListener("click", () => showHistoryModal(entry));
    container.appendChild(div);
  });
}

/* ── 히스토리 모달 ──────────────────────────────── */
function showHistoryModal(entry) {
  const existing = document.querySelector(".modal-overlay");
  if (existing) existing.remove();

  const overlay = document.createElement("div");
  overlay.className = "modal-overlay";

  const a = entry.analysis || {};
  const errorsHtml = (a.errors || []).map(e => `
    <li class="error-item ${e.type}">
      <div class="error-top">
        <span class="error-original">${escHtml(e.original)}</span>
        <span class="arrow">→</span>
        <span class="error-corrected">${escHtml(e.corrected)}</span>
        <span class="error-type">${e.type}</span>
      </div>
      <div class="error-explanation">${escHtml(e.explanation_kr)}</div>
    </li>
  `).join("") || "<li style='color:var(--accent);padding:8px 0;'>오류 없음 🎉</li>";

  overlay.innerHTML = `
    <div class="modal">
      <div class="modal-header">
        <div>
          <strong>${entry.date}</strong>
          &nbsp;<span class="badge badge-${a.level}">${a.level ?? ""}</span>
        </div>
        <div style="display:flex;gap:8px;align-items:center;">
          <button class="modal-delete" title="삭제" style="background:none;border:none;font-size:1rem;cursor:pointer;color:var(--muted);padding:4px 8px;border-radius:6px;transition:all .2s;">🗑️</button>
          <button class="modal-close" style="background:none;border:none;font-size:1.4rem;cursor:pointer;color:var(--muted);">✕</button>
        </div>
      </div>
      <p style="font-size:.85rem;color:var(--muted);margin-bottom:12px;">
        ${entry.language === "english" ? "🇺🇸 English" : "🇨🇳 中文"} &nbsp;·&nbsp; 점수: <strong>${a.score ?? "--"}점</strong>
      </p>
      <h4 style="margin-bottom:8px;font-size:.9rem;">원문</h4>
      <div class="corrected-text" style="margin-bottom:16px;">${escHtml(entry.text)}</div>
      <h4 style="margin-bottom:8px;font-size:.9rem;">교정 문장</h4>
      <div class="corrected-text" style="margin-bottom:16px;">${escHtml(a.corrected_text ?? "")}</div>
      <h4 style="margin-bottom:8px;font-size:.9rem;">총평</h4>
      <p style="font-size:.9rem;color:var(--text);margin-bottom:16px;">${escHtml(a.overall_feedback_kr ?? "")}</p>
      <h4 style="margin-bottom:8px;font-size:.9rem;">오류 목록</h4>
      <ul class="errors-list">${errorsHtml}</ul>
    </div>
  `;

  overlay.querySelector(".modal-close").addEventListener("click", () => overlay.remove());
  overlay.querySelector(".modal-delete").addEventListener("click", () => {
    if (!confirm("이 일기를 삭제할까요?")) return;
    deleteEntry(entry.id);
    overlay.remove();
    loadHistory();
  });
  overlay.addEventListener("click", e => { if (e.target === overlay) overlay.remove(); });
  document.body.appendChild(overlay);
}

/* ── 유틸 ─────────────────────────────────────── */
function setLoading(on) {
  analyzeBtn.disabled = on;
  btnText.classList.toggle("hidden", on);
  btnLoading.classList.toggle("hidden", !on);
  if (on) {
    btnLoading.innerHTML = '<span class="spinner"></span>분석 중...';
  } else {
    // analyzing 상태가 끝났지만 done으로 안 바뀐 경우(오류) → writing으로 복귀
    if (writeCard.dataset.state === "analyzing") {
      setCardState(diaryInput.value.trim() ? "writing" : "idle");
    }
  }
}

function escHtml(str) {
  if (!str) return "";
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
