/**
 * NIREV AI — Assessment Page Controller
 * ─────────────────────────────────────────────────────────────
 * Version: 2.0.0 — Phase 2
 *
 * This module controls the Assessment page UI only.
 * It calls assessment-engine.js for all logic — never domain files directly.
 *
 * Screens managed:
 *   1. Start     — skill/type selection
 *   2. Loading   — question generation spinner
 *   3. Quiz      — question + answer loop
 *   4. Results   — score display + breakdown
 * ─────────────────────────────────────────────────────────────
 */

import { startAssessment, submitAnswer, abandonAssessment } from './engine/assessment-engine.js';
import { showToast } from './ui.js';
import store from './store.js';

// ── Page State ────────────────────────────────────────────────

const _state = {
  selectedSkill:   null,
  selectedType:    'practice',
  currentQuestion: null,
  questionTimer:   null,
  timeStarted:     null,
};

// ── Question counts per type ──────────────────────────────────
const TYPE_QUESTION_COUNT = {
  practice:  5,
  placement: 8,
  mock:      10,
};

// ── Initialize ────────────────────────────────────────────────

let _assessmentInitialized = false;

export function initAssessmentPage() {
  _wireSkillCards();
  _wireTypeButtons();
  _wireStartButton();
  _wireAbandonButton();
  _wireSubmitButton();
  _wireRetakeButton();

  if (_assessmentInitialized) return;
  _assessmentInitialized = true;

  _wireEngineEvents(); // document-level listeners — must only attach once
}

// ── Screen Switcher ───────────────────────────────────────────

function _showScreen(name) {
  ['start', 'loading', 'quiz', 'results'].forEach(s => {
    const el = document.getElementById(`assessment-${s}`);
    if (el) el.style.display = s === name ? '' : 'none';
  });
}

// ── Skill Card Wiring ─────────────────────────────────────────

function _wireSkillCards() {
  document.querySelectorAll('.skill-card').forEach(card => {
    card.addEventListener('click', () => {
      document.querySelectorAll('.skill-card').forEach(c => c.classList.remove('selected'));
      card.classList.add('selected');
      _state.selectedSkill = card.dataset.skill;
      _updateStartButton();
    });
  });
}

// ── Type Button Wiring ────────────────────────────────────────

function _wireTypeButtons() {
  document.querySelectorAll('.type-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.type-btn').forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
      _state.selectedType = btn.dataset.type;
      _updateStartButton();
    });
  });
}

// ── Update Start Button ───────────────────────────────────────

function _updateStartButton() {
  const btn  = document.getElementById('btn-start-assessment');
  const meta = document.getElementById('assessment-meta');
  if (!btn) return;

  if (_state.selectedSkill) {
    btn.disabled = false;
    const count = TYPE_QUESTION_COUNT[_state.selectedType] ?? 5;
    if (meta) meta.textContent = `${count} questions · ${_state.selectedSkill} · ${_state.selectedType}`;
  } else {
    btn.disabled = true;
    if (meta) meta.textContent = 'Select a skill to continue';
  }
}

// ── Start Button ──────────────────────────────────────────────

function _wireStartButton() {
  const btn = document.getElementById('btn-start-assessment');
  if (!btn) return;

  btn.addEventListener('click', async () => {
    if (!_state.selectedSkill) return;

    const user = store.get('user');
    if (!user) { showToast('Please sign in to start an assessment.', 'error'); return; }

    btn.classList.add('loading');
    _showScreen('loading');

    const { error } = await startAssessment({
      userId:        user.id,
      type:          _state.selectedType,
      skill:         _state.selectedSkill,
      level:         store.get('profile.level') ?? null,
      questionCount: TYPE_QUESTION_COUNT[_state.selectedType] ?? 5,
    });

    btn.classList.remove('loading');

    if (error) {
      showToast(error, 'error');
      _showScreen('start');
    }
  });
}

// ── Engine Event Listeners ────────────────────────────────────

function _wireEngineEvents() {
  document.addEventListener('nirev:assessment:loading', (e) => {
    const textEl = document.getElementById('loading-text');
    if (textEl) textEl.textContent = e.detail?.message ?? 'Loading...';
    _showScreen('loading');
  });

  document.addEventListener('nirev:assessment:started', (e) => {
    const { questions } = e.detail;
    _renderQuestion(questions, 0);
    _showScreen('quiz');
  });

  document.addEventListener('nirev:assessment:answer-submitted', (e) => {
    if (!e.detail.isLast) {
      const assessment = store.get('assessment');
      _renderQuestion(assessment.questions, assessment.currentIndex);
    } else {
      _showScreen('loading');
      document.getElementById('loading-text').textContent = 'Scoring your answers...';
    }
  });

  document.addEventListener('nirev:scoring:complete', (e) => {
    _renderResults(e.detail.sessionScore);
    _showScreen('results');
  });

  document.addEventListener('nirev:engine:error', (e) => {
    showToast(e.detail.error ?? 'An error occurred.', 'error');
    if (!e.detail.recoverable) _showScreen('start');
  });
}

// ── Render Question ───────────────────────────────────────────

function _renderQuestion(questions, index) {
  const question = questions[index];
  if (!question) return;

  _state.currentQuestion = question;
  _state.timeStarted     = Date.now();

  const total    = questions.length;
  const progress = ((index + 1) / total) * 100;

  // Progress
  const countEl = document.getElementById('quiz-progress-count');
  const fillEl  = document.getElementById('quiz-progress-fill');
  const labelEl = document.getElementById('quiz-skill-label');
  if (countEl) countEl.textContent = `${index + 1} / ${total}`;
  if (fillEl)  fillEl.style.width  = `${progress}%`;
  if (labelEl) labelEl.textContent = _state.selectedSkill?.charAt(0).toUpperCase() + _state.selectedSkill?.slice(1);

  // Question meta
  const typeEl = document.getElementById('question-type');
  const diffEl = document.getElementById('question-difficulty');
  if (typeEl) typeEl.textContent = _formatType(question.type);
  if (diffEl) {
    diffEl.innerHTML = Array.from({ length: 5 }, (_, i) =>
      `<span class="difficulty-dot ${i < question.difficulty ? 'active' : ''}"></span>`
    ).join('');
  }

  // Question text
  const textEl = document.getElementById('question-text');
  if (textEl) textEl.textContent = question.text;

  // Answer area
  const answerEl = document.getElementById('answer-area');
  if (answerEl) {
    if (question.type === 'multiple-choice' && question.options?.length) {
      answerEl.innerHTML = `
        <div class="options-grid" id="options-grid">
          ${question.options.map((opt, i) => `
            <button class="option-btn" data-value="${opt}" data-index="${i}" type="button">
              <span class="option-btn__letter">${String.fromCharCode(65 + i)}</span>
              <span>${opt.replace(/^[A-D]\)\s*/, '')}</span>
            </button>
          `).join('')}
        </div>`;

      // Wire option buttons
      answerEl.querySelectorAll('.option-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          answerEl.querySelectorAll('.option-btn').forEach(b => b.classList.remove('selected'));
          btn.classList.add('selected');
          document.getElementById('btn-submit-answer').disabled = false;
        });
      });
    } else {
      const placeholder = question.type === 'essay'
        ? 'Write your response here (4-6 sentences recommended)...'
        : 'Type your answer here...';
      answerEl.innerHTML = `
        <textarea class="answer-textarea" id="answer-input"
                  placeholder="${placeholder}" rows="${question.type === 'essay' ? 6 : 3}"></textarea>`;

      answerEl.querySelector('#answer-input')?.addEventListener('input', (e) => {
        document.getElementById('btn-submit-answer').disabled = e.target.value.trim().length === 0;
      });
    }
  }

  // Reset submit button
  const submitBtn = document.getElementById('btn-submit-answer');
  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.textContent = index === total - 1 ? 'Submit Assessment ✓' : 'Next Question →';
  }
}

function _formatType(type) {
  return { 'multiple-choice': 'Multiple Choice', 'short-answer': 'Short Answer', 'essay': 'Essay' }[type] ?? type;
}

// ── Submit Answer ─────────────────────────────────────────────

function _wireSubmitButton() {
  const btn = document.getElementById('btn-submit-answer');
  if (!btn) return;

  btn.addEventListener('click', async () => {
    const question = _state.currentQuestion;
    if (!question) return;

    let answer = '';
    if (question.type === 'multiple-choice') {
      const selected = document.querySelector('.option-btn.selected');
      if (!selected) { showToast('Please select an answer.', 'warning'); return; }
      answer = selected.dataset.value;
    } else {
      const input = document.getElementById('answer-input');
      if (!input?.value.trim()) { showToast('Please write an answer.', 'warning'); return; }
      answer = input.value.trim();
    }

    const timeSpentMs = Date.now() - (_state.timeStarted ?? Date.now());
    btn.disabled = true;

    const assessment = store.get('assessment');
    const { error } = await submitAnswer({
      sessionId:   assessment.sessionId,
      questionId:  question.id,
      answer,
      timeSpentMs,
    });

    if (error) {
      showToast(error, 'error');
      btn.disabled = false;
    }
  });
}

// ── Abandon Button ────────────────────────────────────────────

function _wireAbandonButton() {
  const btn = document.getElementById('btn-abandon');
  if (!btn) return;
  btn.addEventListener('click', async () => {
    await abandonAssessment();
    _showScreen('start');
    showToast('Assessment abandoned.', 'warning');
  });
}

// ── Retake Button ─────────────────────────────────────────────

function _wireRetakeButton() {
  const btn = document.getElementById('btn-retake');
  if (!btn) return;
  btn.addEventListener('click', () => {
    _state.selectedSkill = null;
    document.querySelectorAll('.skill-card').forEach(c => c.classList.remove('selected'));
    _updateStartButton();
    _showScreen('start');
  });
}

// ── Render Results ────────────────────────────────────────────

function _renderResults(sessionScore) {
  if (!sessionScore) return;

  const scoreEl  = document.getElementById('result-score');
  const cefrEl   = document.getElementById('result-cefr');
  const ieltsEl  = document.getElementById('result-ielts');
  const totalEl  = document.getElementById('result-total');
  const cefrCard = document.getElementById('result-cefr-card');
  const qEl      = document.getElementById('result-questions');
  const skillEl  = document.getElementById('result-skill-label');

  const score = Math.round(sessionScore.totalScore ?? 0);

  if (scoreEl)  scoreEl.textContent  = score;
  if (cefrEl)   cefrEl.textContent   = sessionScore.cefrLevel ?? '—';
  if (ieltsEl)  ieltsEl.textContent  = `IELTS Band ${sessionScore.ieltsBand ?? '—'}`;
  if (totalEl)  totalEl.textContent  = `${score}/100`;
  if (cefrCard) cefrCard.textContent = sessionScore.cefrLevel ?? '—';
  if (skillEl)  skillEl.textContent  = sessionScore.skill ?? '—';

  const perQ = sessionScore.breakdown?.perQuestion ?? [];
  if (qEl) qEl.textContent = `${perQ.length}/${perQ.length}`;

  // Breakdown list
  const listEl = document.getElementById('breakdown-list');
  if (listEl && perQ.length > 0) {
    listEl.innerHTML = perQ.map((item, i) => {
      const s = Math.round(item.normalised ?? 0);
      const cls = s >= 70 ? 'high' : s >= 40 ? 'medium' : 'low';
      const assessment = store.get('assessment');
      const qText = assessment?.questions?.[i]?.text ?? `Question ${i + 1}`;
      return `
        <div class="breakdown-item">
          <div style="flex:1; min-width:0;">
            <div class="breakdown-item__q">Q${i + 1}: ${qText}</div>
            ${item.rationale ? `<div class="breakdown-item__rationale">${item.rationale}</div>` : ''}
          </div>
          <div class="breakdown-item__score ${cls}">${s}</div>
        </div>`;
    }).join('');
  }
}
