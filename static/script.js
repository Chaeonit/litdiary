/* ── 상태 ──────────────────────────────────────── */
let selectedLang = "english";
let currentAnalysis = null;
let currentText = "";

/* ── DOM 참조 ──────────────────────────────────── */
const diaryInput    = document.getElementById("diary-input");
const charCount     = document.getElementById("char-count");
const analyzeBtn    = document.getElementById("analyze-btn");
const btnText       = analyzeBtn.querySelector(".btn-text");
const btnLoading    = analyzeBtn.querySelector(".btn-loading");
const feedbackSec   = document.getElementById("feedback-section");
const saveBtn       = document.getElementById("save-btn");
const saveMsg       = document.getElementById("save-msg");

/* ── 탭 전환 ───────────────────────────────────── */
document.querySelectorAll(".tab-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("active"));
    document.querySelectorAll(".tab-content").forEach(c => c.classList.remove("active"));
    btn.classList.add("active");
    document.getElementById(`tab-${btn.dataset.tab}`).classList.add("active");
    if (btn.dataset.tab === "history") loadHistory();
  });
});

/* ── 언어 선택 ─────────────────────────────────── */
document.querySelectorAll(".lang-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".lang-btn").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    selectedLang = btn.dataset.lang;
    diaryInput.placeholder = selectedLang === "english"
      ? "오늘 있었던 일을 영어로 자유롭게 써보세요..."
      : "오늘 있었던 일을 중국어로 자유롭게 써보세요...";
  });
});

/* ── 글자 수 카운터 ────────────────────────────── */
diaryInput.addEventListener("input", () => {
  charCount.textContent = diaryInput.value.length;
});

/* ── AI 분석 요청 ───────────────────────────────── */
analyzeBtn.addEventListener("click", async () => {
  const text = diaryInput.value.trim();
  if (!text) {
    alert("일기 내용을 입력해주세요.");
    return;
  }

  setLoading(true);
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

/* ── 일기 저장 ─────────────────────────────────── */
saveBtn.addEventListener("click", async () => {
  if (!currentAnalysis) return;

  try {
    const res = await fetch("/diaries", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        language: selectedLang,
        text: currentText,
        analysis: currentAnalysis
      })
    });

    if (!res.ok) throw new Error("저장 실패");

    saveMsg.classList.remove("hidden");
    saveBtn.disabled = true;
    setTimeout(() => {
      saveMsg.classList.add("hidden");
      saveBtn.disabled = false;
    }, 3000);
  } catch (e) {
    alert("저장 중 오류가 발생했습니다.");
  }
});

/* ── 히스토리 로드 ──────────────────────────────── */
async function loadHistory() {
  const container = document.getElementById("history-list");
  container.innerHTML = "<p class='empty-msg'>불러오는 중...</p>";

  try {
    const res  = await fetch("/diaries");
    const list = await res.json();

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
  } catch {
    container.innerHTML = "<p class='empty-msg'>불러오기 실패. 다시 시도해주세요.</p>";
  }
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
        <button class="modal-close">✕</button>
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
