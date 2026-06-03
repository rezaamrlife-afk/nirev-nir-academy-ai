/**
 * NIREV AI — Assessment Engine (Orchestration Layer)
 * ─────────────────────────────────────────────────────────────
 * Version: 1.0.0
 * Layer:   ENGINE — orchestration only
 *
 * ── ROLE IN ARCHITECTURE ─────────────────────────────────────
 *
 *   UI / Phase 2 Pages
 *         │
 *         │  calls only this file
 *         ▼
 *   ┌─────────────────────────┐
 *   │   assessment-engine.js  │  ← YOU ARE HERE
 *   │   (Orchestration Layer) │
 *   └─────────────────────────┘
 *         │
 *         │  coordinates
 *         ▼
 *   domain/*  +  store  +  db  +  groq
 *
 * The UI never calls domain files directly.
 * The UI never calls store directly for pipeline actions.
 * The UI never calls groq.js directly.
 * Everything flows through this engine.
 *
 * ── STRICT RULES FOR THIS FILE ───────────────────────────────
 *
 *   ✅ ALLOWED:
 *     - Import and call domain functions
 *     - Import and call store.set() / store.get()
 *     - Import and call db.js functions
 *     - Import and call groq.js functions
 *     - Handle async sequencing and error recovery
 *     - Emit CustomEvents for UI to react to
 *     - Update store at each pipeline stage
 *
 *   ❌ FORBIDDEN:
 *     - Touch the DOM directly
 *     - Import from ui.js (no showToast, no loader calls)
 *     - Import from router.js
 *     - Contain any scoring/feedback/analytics logic itself
 *     - Duplicate logic that belongs in a domain file
 *
 * ── PIPELINE THIS ENGINE ORCHESTRATES ────────────────────────
 *
 *   startAssessment()
 *       │
 *       ├─ 1. validate input
 *       ├─ 2. assessment-domain.startSession()
 *       ├─ 3. store.set('assessment', session)
 *       └─ 4. emit 'nirev:assessment:started'
 *
 *   submitAnswer()
 *       │
 *       ├─ 1. assessment-domain.submitAnswer()
 *       ├─ 2. store.set('assessment', updated)
 *       ├─ 3. if last answer → triggerScoring()
 *       └─ 4. emit 'nirev:assessment:answer-submitted'
 *
 *   triggerScoring()   [internal — called after last answer]
 *       │
 *       ├─ 1. scoring-domain.scoreSession()
 *       ├─ 2. store.set('scoring', sessionScore)
 *       ├─ 3. db.saveScore()
 *       ├─ 4. emit 'nirev:scoring:complete'
 *       └─ 5. triggerPostScoring()  [parallel]
 *
 *   triggerPostScoring()   [internal — runs after scoring]
 *       │
 *       ├─ [parallel branch A] triggerFeedback()
 *       │       ├─ feedback-domain.generateFeedback()
 *       │       ├─ store.set('feedback', result)
 *       │       ├─ db.saveFeedback()
 *       │       └─ emit 'nirev:feedback:ready'
 *       │
 *       └─ [parallel branch B] triggerAnalytics()
 *               ├─ analytics-domain.loadAnalytics()
 *               ├─ store.set('analytics', result)
 *               ├─ triggerPrediction()
 *               │       ├─ prediction-domain.generatePrediction()
 *               │       ├─ store.set('predictions', result)
 *               │       └─ emit 'nirev:prediction:ready'
 *               └─ emit 'nirev:analytics:ready'
 *
 * ── EVENTS EMITTED (UI listens to these) ─────────────────────
 *
 *   'nirev:assessment:started'       → { sessionId, questions[] }
 *   'nirev:assessment:answer-submitted' → { questionId, isLast }
 *   'nirev:assessment:completed'     → { sessionId }
 *   'nirev:assessment:error'         → { stage, error }
 *   'nirev:scoring:started'          → { sessionId }
 *   'nirev:scoring:complete'         → { sessionScore }
 *   'nirev:feedback:generating'      → {}
 *   'nirev:feedback:ready'           → { feedback }
 *   'nirev:analytics:ready'          → { analytics }
 *   'nirev:prediction:ready'         → { prediction }
 *   'nirev:engine:error'             → { stage, error, recoverable }
 *
 * ─────────────────────────────────────────────────────────────
 */

import store  from '../store.js';
import * as db from '../db.js';

// Domain imports — stubs now, implemented in Phase 2/3/4
// These imports will resolve once domain files are implemented.
// import * as AssessmentDomain from '../domain/assessments/assessment-domain.js';
// import * as ScoringDomain    from '../domain/scoring/scoring-domain.js';
// import * as FeedbackDomain   from '../domain/feedback/feedback-domain.js';
// import * as AnalyticsDomain  from '../domain/analytics/analytics-domain.js';
// import * as PredictionDomain from '../domain/predictions/prediction-domain.js';

// ── Event Bus Helper ──────────────────────────────────────────

/**
 * Emit a typed engine event for UI layers to consume.
 * UI pages add listeners via: document.addEventListener('nirev:scoring:complete', ...)
 * Engine never calls UI directly — events are the contract.
 *
 * @param {string} eventName
 * @param {Object} detail
 */
function _emit(eventName, detail = {}) {
  document.dispatchEvent(new CustomEvent(eventName, { detail }));
}

// ── Engine State ──────────────────────────────────────────────
// Tracks what stage the pipeline is currently at.
// Never exposed directly — UI reads from store instead.

const _engineState = {
  stage:    'idle',   // 'idle' | 'assessing' | 'scoring' | 'feedback' | 'analytics' | 'predicting' | 'complete' | 'error'
  sessionId: null,
};

function _setStage(stage) {
  _engineState.stage = stage;
}

// ── Public API ────────────────────────────────────────────────

/**
 * ENTRY POINT — Start a new assessment session.
 *
 * Called by: Phase 2 Assessment UI page
 *
 * @param {{
 *   userId:         string,
 *   type:           'placement' | 'practice' | 'mock',
 *   skill:          'grammar' | 'vocabulary' | 'writing' | 'reading',
 *   level?:         string | null,
 *   questionCount?: number
 * }} input
 *
 * @returns {{ data: SessionContext | null, error: string | null }}
 */
export async function startAssessment(input) {
  _setStage('assessing');

  try {
    // 1. Validate input
    const validationError = _validateStartInput(input);
    if (validationError) {
      return _engineError('validation', validationError);
    }

    // 2. Reset assessment slice in store
    store.reset('assessment');

    // ── Phase 2: Uncomment when assessment-domain is implemented ──
    // const { data: session, error } = await AssessmentDomain.startSession(input);
    // if (error) return _engineError('assessment', error);

    // ── Phase 2 Stub (remove when real domain is active) ──────────
    const session = _stubSession(input);
    const error   = null;
    // ─────────────────────────────────────────────────────────────

    // 3. Update store
    store.set('assessment', {
      sessionId:    session.sessionId,
      type:         session.type,
      skill:        session.skill,
      status:       'active',
      questions:    session.questions,
      currentIndex: 0,
      answers:      {},
      startedAt:    session.startedAt,
    });

    _engineState.sessionId = session.sessionId;

    // 4. Notify UI
    _emit('nirev:assessment:started', {
      sessionId: session.sessionId,
      questions: session.questions,
    });

    return { data: session, error: null };

  } catch (err) {
    return _engineError('assessment', err.message);
  }
}

/**
 * Submit a single answer during an active assessment.
 *
 * Called by: Phase 2 Assessment UI (on each answer submit)
 *
 * @param {{
 *   sessionId:   string,
 *   questionId:  string,
 *   answer:      string,
 *   timeSpentMs: number
 * }} input
 *
 * @returns {{ data: AnswerResult | null, error: string | null }}
 */
export async function submitAnswer(input) {
  try {
    const current = store.get('assessment');

    if (!current || current.status !== 'active') {
      return _engineError('submit', 'No active assessment session.');
    }

    // ── Phase 2: Uncomment when assessment-domain is implemented ──
    // const { data: result, error } = await AssessmentDomain.submitAnswer(input);
    // if (error) return _engineError('submit', error);

    // ── Phase 2 Stub ──────────────────────────────────────────────
    const nextIndex = current.currentIndex + 1;
    const isLast    = nextIndex >= current.questions.length;
    const result    = { questionId: input.questionId, received: true, isLast };
    // ─────────────────────────────────────────────────────────────

    // Update answers in store
    const updatedAnswers = {
      ...current.answers,
      [input.questionId]: {
        answer:      input.answer,
        timeSpentMs: input.timeSpentMs,
      },
    };

    store.set('assessment', {
      answers:      updatedAnswers,
      currentIndex: nextIndex,
      status:       isLast ? 'completed' : 'active',
      completedAt:  isLast ? new Date().toISOString() : null,
    });

    _emit('nirev:assessment:answer-submitted', {
      questionId: input.questionId,
      isLast,
    });

    // If last answer — trigger scoring pipeline automatically
    if (isLast) {
      _emit('nirev:assessment:completed', {
        sessionId: input.sessionId,
      });
      // Non-blocking: scoring runs in background
      _triggerScoring(input.sessionId, updatedAnswers, current).catch(err => {
        _engineError('scoring', err.message);
      });
    }

    return { data: result, error: null };

  } catch (err) {
    return _engineError('submit', err.message);
  }
}

/**
 * Manually abort an active assessment session.
 *
 * Called by: Phase 2 Assessment UI (exit / cancel button)
 */
export async function abandonAssessment() {
  const current = store.get('assessment');
  if (!current?.sessionId) return;

  store.set('assessment', { status: 'abandoned', completedAt: new Date().toISOString() });
  _setStage('idle');
  _emit('nirev:assessment:abandoned', { sessionId: current.sessionId });
}

/**
 * Get the current engine stage.
 * UI can use this to show appropriate loading states.
 * @returns {string}
 */
export function getEngineStage() {
  return _engineState.stage;
}

// ── Internal Pipeline Steps ───────────────────────────────────

/**
 * STEP 2 — Run scoring after all answers are collected.
 * Internal only — called automatically after last answer.
 *
 * @param {string}   sessionId
 * @param {Object}   answers        — collected from store
 * @param {Object}   assessmentCtx  — assessment slice from store
 */
async function _triggerScoring(sessionId, answers, assessmentCtx) {
  _setStage('scoring');
  _emit('nirev:scoring:started', { sessionId });

  try {
    // Build AnswerRecord[] from collected answers + question context
    const answerRecords = _buildAnswerRecords(answers, assessmentCtx.questions);

    // ── Phase 2: Uncomment when scoring-domain is implemented ─────
    // const { data: sessionScore, error } = await ScoringDomain.scoreSession({
    //   sessionId,
    //   userId:  store.get('user')?.id,
    //   skill:   assessmentCtx.skill,
    //   answers: answerRecords,
    // });
    // if (error) { _engineError('scoring', error); return; }

    // ── Phase 2 Stub ──────────────────────────────────────────────
    const sessionScore = _stubSessionScore(sessionId, assessmentCtx, answerRecords);
    // ─────────────────────────────────────────────────────────────

    // Update store
    store.set('scoring', {
      lastScore: sessionScore,
      history:   [...(store.get('scoring')?.history ?? []), {
        sessionId,
        score:   sessionScore.totalScore,
        cefr:    sessionScore.cefrLevel,
        skill:   sessionScore.skill,
        date:    sessionScore.gradedAt,
      }],
    });

    // Persist to DB
    const userId = store.get('user')?.id;
    if (userId) {
      await db.saveScore({
        user_id:       userId,
        assessment_id: sessionId,
        skill:         assessmentCtx.skill,
        score:         sessionScore.totalScore,
        cefr_level:    sessionScore.cefrLevel,
        details:       sessionScore.breakdown,
      });
    }

    _emit('nirev:scoring:complete', { sessionScore });

    // Step 3: Fan out to feedback + analytics in parallel
    await _triggerPostScoring(sessionScore);

  } catch (err) {
    _engineError('scoring', err.message);
  }
}

/**
 * STEP 3 — Fan out to feedback and analytics in parallel.
 * Runs after scoring completes.
 *
 * @param {Object} sessionScore — full SessionScore from scoring-domain
 */
async function _triggerPostScoring(sessionScore) {
  // Run feedback and analytics concurrently — neither depends on the other
  await Promise.allSettled([
    _triggerFeedback(sessionScore),
    _triggerAnalytics(sessionScore),
  ]);
}

/**
 * STEP 3A — Generate AI feedback.
 * Runs in parallel with analytics.
 *
 * @param {Object} sessionScore
 */
async function _triggerFeedback(sessionScore) {
  _setStage('feedback');
  _emit('nirev:feedback:generating', {});

  try {
    // ── Phase 3: Uncomment when feedback-domain is implemented ────
    // const { data: feedback, error } = await FeedbackDomain.generateFeedback({
    //   sessionScore,
    //   userLevel:    store.get('profile.level'),
    //   feedbackType: 'summary',
    // });
    // if (error) { _engineError('feedback', error, true); return; }

    // ── Phase 3 Stub ──────────────────────────────────────────────
    const feedback = _stubFeedback(sessionScore);
    // ─────────────────────────────────────────────────────────────

    store.set('feedback', {
      lastFeedback: feedback,
      isGenerating: false,
    });

    const userId = store.get('user')?.id;
    if (userId) {
      await db.saveFeedback({
        user_id:       userId,
        assessment_id: sessionScore.sessionId,
        content:       feedback.sections?.summary ?? '',
        model:         'stub',
      });
    }

    _emit('nirev:feedback:ready', { feedback });

  } catch (err) {
    // Feedback failure is non-fatal — pipeline continues
    _engineError('feedback', err.message, true);
  }
}

/**
 * STEP 3B — Compute analytics, then trigger prediction.
 * Runs in parallel with feedback.
 *
 * @param {Object} sessionScore
 */
async function _triggerAnalytics(sessionScore) {
  _setStage('analytics');

  try {
    const userId = store.get('user')?.id;
    if (!userId) return;

    // ── Phase 3: Uncomment when analytics-domain is implemented ───
    // const { data: analytics, error } = await AnalyticsDomain.loadAnalytics({
    //   userId,
    //   dateRange: { from: null, to: null },
    //   skills:    null,
    // });
    // if (error) { _engineError('analytics', error, true); return; }

    // ── Phase 3 Stub ──────────────────────────────────────────────
    const analytics = _stubAnalytics(sessionScore);
    // ─────────────────────────────────────────────────────────────

    store.set('analytics', {
      loaded:        true,
      scoresBySkill: analytics.bySkill ?? {},
      progressData:  analytics.charts?.scoreLine?.values ?? [],
    });

    _emit('nirev:analytics:ready', { analytics });

    // Step 4: Prediction runs after analytics
    await _triggerPrediction(analytics);

  } catch (err) {
    _engineError('analytics', err.message, true);
  }
}

/**
 * STEP 4 — Generate performance prediction.
 * Runs after analytics completes.
 *
 * @param {Object} analyticsResult
 */
async function _triggerPrediction(analyticsResult) {
  _setStage('predicting');

  try {
    const userId = store.get('user')?.id;
    if (!userId) return;

    // ── Phase 4: Uncomment when prediction-domain is implemented ──
    // const { data: prediction, error } = await PredictionDomain.generatePrediction({
    //   userId,
    //   analyticsResult,
    //   targetLevel: null,
    //   mode:        'statistical',
    // });
    // if (error) { _engineError('prediction', error, true); return; }

    // ── Phase 4 Stub ──────────────────────────────────────────────
    const prediction = _stubPrediction(analyticsResult);
    // ─────────────────────────────────────────────────────────────

    store.set('predictions', {
      nextLevel:     prediction.targetLevel,
      estimatedDays: prediction.estimatedDays,
      confidence:    prediction.confidenceLabel,
    });

    _emit('nirev:prediction:ready', { prediction });
    _setStage('complete');

  } catch (err) {
    _engineError('prediction', err.message, true);
    _setStage('complete'); // prediction failure never blocks completion
  }
}

// ── Error Handler ─────────────────────────────────────────────

/**
 * Centralised engine error handler.
 * @param {string}  stage       — which pipeline stage failed
 * @param {string}  message     — error description
 * @param {boolean} recoverable — true = pipeline continues; false = hard stop
 */
function _engineError(stage, message, recoverable = false) {
  console.error(`[Engine] ${stage} error: ${message}`);
  _emit('nirev:engine:error', { stage, error: message, recoverable });

  if (!recoverable) {
    _setStage('error');
    store.set('assessment', { status: 'error' });
  }

  return { data: null, error: message };
}

// ── Validation ────────────────────────────────────────────────

function _validateStartInput(input) {
  if (!input?.userId)  return 'userId is required';
  if (!input?.type)    return 'Assessment type is required';
  if (!input?.skill)   return 'Skill is required';

  const validTypes  = ['placement', 'practice', 'mock'];
  const validSkills = ['grammar', 'vocabulary', 'writing', 'reading'];

  if (!validTypes.includes(input.type))
    return `Invalid type: ${input.type}. Must be one of: ${validTypes.join(', ')}`;
  if (!validSkills.includes(input.skill))
    return `Invalid skill: ${input.skill}. Must be one of: ${validSkills.join(', ')}`;

  return null; // valid
}

// ── Build Answer Records ──────────────────────────────────────

/**
 * Converts raw answer map + questions array into AnswerRecord[].
 * Shape defined in assessment-domain contract.
 */
function _buildAnswerRecords(answers, questions) {
  return questions.map(q => ({
    questionId:  q.id,
    question:    q.text,
    answer:      answers[q.id]?.answer      ?? '',
    rubric:      q.rubric                   ?? '',
    timeSpentMs: answers[q.id]?.timeSpentMs ?? 0,
    skill:       q.skill,
  }));
}

// ── Phase Stubs (replaced as domains are implemented) ─────────
// These keep the engine functional and testable before Phase 2.
// Each stub mirrors the exact contract defined in its domain file.
// Remove each stub as its real domain implementation goes live.

function _stubSession(input) {
  return {
    sessionId: `stub-session-${Date.now()}`,
    type:      input.type,
    skill:     input.skill,
    questions: [],   // Phase 2: populated by groq.generateQuestions()
    startedAt: new Date().toISOString(),
  };
}

function _stubSessionScore(sessionId, ctx, answerRecords) {
  return {
    sessionId,
    userId:     store.get('user')?.id ?? 'stub',
    skill:      ctx.skill,
    totalScore: 0,
    cefrLevel:  '—',
    ieltsBand:  null,
    breakdown:  { perQuestion: [], bySubSkill: {} },
    gradedAt:   new Date().toISOString(),
  };
}

function _stubFeedback(sessionScore) {
  return {
    sessionId: sessionScore.sessionId,
    type:      'summary',
    sections:  { strengths: [], weaknesses: [], tips: [], summary: '' },
    cefrComment: '',
    nextSteps:   [],
    tone:        'encouraging',
    generatedAt: new Date().toISOString(),
  };
}

function _stubAnalytics(sessionScore) {
  return {
    summary:   { totalSessions: 1, averageScore: 0, trajectory: 'plateauing' },
    bySkill:   { [sessionScore.skill]: { average: 0, sessions: 1, trend: 'plateauing' } },
    charts:    { scoreLine: { labels: [], values: [] }, skillRadar: { labels: [], values: [] }, sessionBar: { labels: [], values: [] } },
    skillGaps: [],
  };
}

function _stubPrediction(analytics) {
  return {
    currentLevel:    '—',
    targetLevel:     '—',
    estimatedDays:   null,
    estimatedDate:   null,
    confidenceScore: 0,
    confidenceLabel: 'low',
    trajectory:      analytics?.summary?.trajectory ?? 'plateauing',
    milestones:      [],
    recommendation:  { sessionsPerWeek: 3, focusSkills: [], message: '' },
    generatedAt:     new Date().toISOString(),
  };
}
