/**
 * NIREV AI — Assessment Engine (Orchestration Layer)
 * ─────────────────────────────────────────────────────────────
 * Version: 3.0.0 — Phase 3
 * Layer:   ENGINE — orchestration only
 * ─────────────────────────────────────────────────────────────
 */

import store  from '../store.js';
import * as db from '../db.js';
import * as groq from '../groq.js';
import * as AssessmentDomain from '../domain/assessments/assessment-domain.js';
import * as ScoringDomain    from '../domain/scoring/scoring-domain.js';
import * as FeedbackDomain   from '../domain/feedback/feedback-domain.js';
import * as AnalyticsDomain  from '../domain/analytics/analytics-domain.js';

// ── Event Bus ─────────────────────────────────────────────────

function _emit(name, detail = {}) {
  document.dispatchEvent(new CustomEvent(name, { detail }));
}

// ── Engine State ──────────────────────────────────────────────

const _engine = { stage: 'idle', sessionId: null };

function _setStage(s) { _engine.stage = s; }

export function getEngineStage() { return _engine.stage; }

// ── ENTRY: Start Assessment ───────────────────────────────────

export async function startAssessment(input) {
  _setStage('assessing');

  try {
    const validationError = AssessmentDomain.validateStartInput(input);
    if (validationError) return _error('validation', validationError);

    store.reset('assessment');
    _emit('nirev:assessment:loading', { message: 'Generating questions...' });

    // Generate questions via Groq
    const { data: groqText } = await groq.generateQuestions({
      skill: input.skill,
      level: input.level ?? null,
      type:  input.type,
      count: input.questionCount ?? 5,
    });

    const questions = AssessmentDomain.parseGroqQuestions(
      groqText ?? '', input.skill, input.questionCount ?? 5
    );

    // Persist to DB
    const userId = store.get('user')?.id;
    let sessionId = `local-${Date.now()}`;

    if (userId) {
      const { data: dbSession } = await db.createAssessment({
        user_id: userId,
        type:    input.type,
        skill:   input.skill,
      });
      if (dbSession?.id) sessionId = dbSession.id;
    }

    const session = AssessmentDomain.buildSessionContext(input, questions, sessionId);
    _engine.sessionId = sessionId;

    store.set('assessment', {
      sessionId,
      type:         session.type,
      skill:        session.skill,
      status:       'active',
      questions,
      currentIndex: 0,
      answers:      {},
      startedAt:    session.startedAt,
    });

    _emit('nirev:assessment:started', { sessionId, questions });
    return { data: session, error: null };

  } catch (err) {
    return _error('assessment', err.message);
  }
}

// ── Submit Answer ─────────────────────────────────────────────

export async function submitAnswer(input) {
  try {
    const current = store.get('assessment');
    if (!current || current.status !== 'active')
      return _error('submit', 'No active assessment session.');

    const question = current.questions[current.currentIndex];
    if (!question) return _error('submit', 'Question not found.');

    const validationError = AssessmentDomain.validateAnswer(input.answer, question);
    if (validationError) return _error('submit', validationError);

    const isLast    = AssessmentDomain.checkCompletion(current.currentIndex, current.questions.length);
    const nextIndex = current.currentIndex + 1;

    const updatedAnswers = {
      ...current.answers,
      [question.id]: { answer: input.answer, timeSpentMs: input.timeSpentMs ?? 0 },
    };

    store.set('assessment', {
      answers:      updatedAnswers,
      currentIndex: nextIndex,
      status:       isLast ? 'completed' : 'active',
      completedAt:  isLast ? new Date().toISOString() : null,
    });

    _emit('nirev:assessment:answer-submitted', { questionId: question.id, isLast });

    if (isLast) {
      _emit('nirev:assessment:completed', { sessionId: current.sessionId });
      _triggerScoring(current.sessionId, updatedAnswers, current).catch(err => {
        _error('scoring', err.message);
      });
    }

    return { data: { questionId: question.id, received: true, isLast }, error: null };

  } catch (err) {
    return _error('submit', err.message);
  }
}

// ── Abandon ───────────────────────────────────────────────────

export async function abandonAssessment() {
  const current = store.get('assessment');
  if (!current?.sessionId) return;
  store.set('assessment', { status: 'abandoned', completedAt: new Date().toISOString() });
  _setStage('idle');
  _emit('nirev:assessment:abandoned', { sessionId: current.sessionId });
}

// ── Internal: Scoring ─────────────────────────────────────────

async function _triggerScoring(sessionId, answers, ctx) {
  _setStage('scoring');
  _emit('nirev:scoring:started', { sessionId });
  _emit('nirev:assessment:loading', { message: 'Scoring your answers...' });

  try {
    const answerRecords = AssessmentDomain.buildCompletedSession(
      sessionId, answers, ctx.questions, ctx.skill
    ).answers;

    const answerScores = [];
    for (const record of answerRecords) {
      if (!record.answer || record.answer.trim() === '') {
        answerScores.push(ScoringDomain.parseGroqScore(
          '{"score":0,"rationale":"No answer provided.","tags":["no_answer"]}',
          record.questionId
        ));
        continue;
      }
      const { data: scoreText } = await groq.scoreResponse(record);
      answerScores.push(ScoringDomain.parseGroqScore(scoreText ?? '', record.questionId));
    }

    const userId       = store.get('user')?.id ?? 'guest';
    const sessionScore = ScoringDomain.buildSessionScore(sessionId, userId, ctx.skill, answerScores);

    const currentHistory = store.get('scoring')?.history ?? [];
    store.set('scoring', {
      lastScore: sessionScore,
      history: [...currentHistory, {
        sessionId,
        score: sessionScore.totalScore,
        cefr:  sessionScore.cefrLevel,
        skill: sessionScore.skill,
        date:  sessionScore.gradedAt,
      }],
      average: ScoringDomain.computeAverage([
        ...currentHistory.map(h => h.score),
        sessionScore.totalScore,
      ]),
    });

    if (userId !== 'guest') {
      await db.completeAssessment(sessionId);
      await db.saveScore({
        user_id:       userId,
        assessment_id: sessionId,
        skill:         ctx.skill,
        score:         sessionScore.totalScore,
        cefr_level:    sessionScore.cefrLevel,
        details:       sessionScore.breakdown,
      });
    }

    _emit('nirev:scoring:complete', { sessionScore });

    // Fan out to feedback + analytics in parallel
    await Promise.allSettled([
      _triggerFeedback(sessionScore, userId),
      _triggerAnalytics(userId),
    ]);

    _setStage('complete');

  } catch (err) {
    _error('scoring', err.message);
  }
}

// ── Internal: Feedback ────────────────────────────────────────

async function _triggerFeedback(sessionScore, userId) {
  _emit('nirev:feedback:generating', {});

  try {
    store.set('feedback', { isGenerating: true });

    const userLevel = store.get('profile.level') ?? sessionScore.cefrLevel;
    const { data: feedbackText } = await groq.generateFeedback({
      sessionScore,
      userLevel,
    });

    const feedback = FeedbackDomain.parseFeedbackResponse(
      feedbackText ?? '',
      sessionScore.sessionId,
      sessionScore.totalScore
    );

    store.set('feedback', { lastFeedback: feedback, isGenerating: false });

    if (userId && userId !== 'guest') {
      await db.saveFeedback({
        user_id:       userId,
        assessment_id: sessionScore.sessionId,
        content:       feedback.sections?.summary ?? '',
        model:         'llama-3.1-8b-instant',
      });
    }

    _emit('nirev:feedback:ready', { feedback });

  } catch (err) {
    store.set('feedback', { isGenerating: false });
    _error('feedback', err.message, true);
  }
}

// ── Internal: Analytics ───────────────────────────────────────

async function _triggerAnalytics(userId) {
  try {
    if (!userId || userId === 'guest') return;

    const { data: scores } = await db.getScores(userId, { limit: 50 });
    if (!scores || scores.length === 0) return;

    const analyticsResult = AnalyticsDomain.buildAnalyticsResult(scores);

    store.set('analytics', {
      loaded:        true,
      scoresBySkill: analyticsResult.bySkill,
      progressData:  analyticsResult.charts.scoreLine.values,
      full:          analyticsResult,
    });

    _emit('nirev:analytics:ready', { analytics: analyticsResult });

  } catch (err) {
    _error('analytics', err.message, true);
  }
}

// ── Error Handler ─────────────────────────────────────────────

function _error(stage, message, recoverable = false) {
  console.error(`[Engine] ${stage}: ${message}`);
  _emit('nirev:engine:error', { stage, error: message, recoverable });
  if (!recoverable) {
    _setStage('error');
    store.set('assessment', { status: 'error' });
  }
  return { data: null, error: message };
}
