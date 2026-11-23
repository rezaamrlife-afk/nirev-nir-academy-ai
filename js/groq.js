/**
 * NIREV AI — Groq API Wrapper
 * ─────────────────────────────────────────────────────────────
 * Version: 2.0.0 — Phase 2 Implementation
 *
 * Security: Groq API key is passed via config.js (GROQ.API_KEY).
 * Direct browser call — no Edge Function needed for Phase 2.
 * ─────────────────────────────────────────────────────────────
 */

import { GROQ } from './config.js'; // MODEL, MAX_TOKENS, TEMPERATURE only — key is server-side

// ── Token-limit selection ─────────────────────────────────────

/** Token limit for question generation, by assessment type / question count. */
export function getQuestionTokenLimit(type, count) {
  const limits = GROQ.TOKEN_LIMITS.QUESTIONS;
  if (type && limits[type]) return limits[type];
  // Unknown type: pick by question count (practice = 5 → 4096, larger sets → 6144)
  return (count ?? 5) > 5 ? limits.placement : limits.practice;
}

/** Token limit for scoring one answer, by question/answer type. */
export function getScoringTokenLimit(answerType) {
  const key = String(answerType ?? '').toLowerCase().replace(/[_\s]+/g, '-');
  return GROQ.TOKEN_LIMITS.SCORING[key] ?? GROQ.TOKEN_LIMITS.SCORING['short-answer'];
}

// ── Internal Transport ────────────────────────────────────────
//
// Resolves to:
//   { data, error, finishReason, usage, truncated }
// `truncated` is true when Groq stopped because max_tokens was hit
// (finish_reason === 'length'). In that case `data` is null, `error`
// explains why, and the incomplete text is exposed as `partial` so a
// caller can never mistake it for a complete answer.

async function _call(messages, options = {}) {
  const maxTokens = options.max_tokens ?? GROQ.MAX_TOKENS;
  const label     = options.label ?? 'call';

  try {
    const response = await fetch('/api/groq', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model:       options.model       ?? GROQ.MODEL,
        max_tokens:  maxTokens,
        temperature: options.temperature ?? GROQ.TEMPERATURE,
        messages,
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      return { data: null, error: `Groq API error ${response.status}: ${err}`, finishReason: null, usage: null, truncated: false };
    }

    const result       = await response.json();
    const choice       = result?.choices?.[0];
    const content      = choice?.message?.content ?? null;
    const finishReason = choice?.finish_reason ?? null;
    const usage        = result?.usage ?? null;

    console.info(
      `[Groq] ${label}: finish_reason=${finishReason} max_tokens=${maxTokens}`,
      usage ? {
        prompt_tokens:     usage.prompt_tokens,
        completion_tokens: usage.completion_tokens,
        total_tokens:      usage.total_tokens,
      } : 'usage=n/a'
    );

    if (finishReason === 'length') {
      console.warn(`[Groq] ${label}: response truncated (hit max_tokens=${maxTokens}).`);
      return {
        data:         null,
        partial:      content,
        error:        `AI response was cut off (token limit ${maxTokens} reached).`,
        finishReason,
        usage,
        truncated:    true,
      };
    }

    if (!content) {
      return { data: null, error: 'Empty response from Groq', finishReason, usage, truncated: false };
    }
    return { data: content, error: null, finishReason, usage, truncated: false };

  } catch (err) {
    return { data: null, error: err.message ?? 'Network error calling Groq', finishReason: null, usage: null, truncated: false };
  }
}

// ── Public API ────────────────────────────────────────────────

/**
 * Generate assessment questions for a skill and level.
 * @param {{ skill, level, type, count }} params
 */
export async function generateQuestions(params) {
  const { skill, level, type, count = 5, previousQuestions = [] } = params;

  const prompt = `You are an expert English language assessment designer.
Generate ${count} assessment questions for the following:
- Skill: ${skill}
- Level: ${level ?? 'B1'} (CEFR)
- Assessment type: ${type ?? 'practice'}

Return ONLY a JSON array of question objects with no markdown or extra text:
[
  {
    "question": "<question text>",
    "type": "multiple-choice" | "short-answer" | "essay",
    "options": ["A) ...", "B) ...", "C) ...", "D) ..."] or null,
    "difficulty": <1-5>,
    "rubric": "<scoring criteria for this question>"
  }
]

For multiple-choice questions, always include 4 options labeled A) B) C) D).
For short-answer and essay, set options to null.
Make questions appropriate for ${level ?? 'B1'} level learners.
Vary difficulty between ${Math.max(1, (level === 'A1' ? 1 : level === 'A2' ? 2 : level === 'B1' ? 2 : level === 'B2' ? 3 : 4))}-${Math.min(5, (level === 'C1' || level === 'C2' ? 5 : 4))}.
IMPORTANT: Generate completely unique and different questions each time. Use a wide variety of topics, contexts, and scenarios. Never repeat the same question or topic twice. Session seed: ${Date.now()}-${Math.random().toString(36).slice(2)}.${previousQuestions.length > 0 ? `\n\nDo NOT repeat or closely paraphrase any of these questions the learner has already seen:\n${previousQuestions.map((q, i) => `${i + 1}. ${q}`).join('\n')}` : ''}`;

  console.log('[Groq] previousQuestions count:', previousQuestions.length, previousQuestions);
  return _call([{ role: 'user', content: prompt }], {
    temperature: 0.7,
    max_tokens:  getQuestionTokenLimit(type, count),
    label:       `generateQuestions(${type ?? 'practice'}, n=${count})`,
  });
}

/**
 * Score a single learner answer.
 * `params.type` is the answer type (multiple-choice | short-answer | essay)
 * and selects the scoring token limit.
 * @param {{ question, answer, rubric, skill, type, options }} params
 */
export async function scoreResponse(params) {
  const { buildScoringPrompt } = await import('./domain/scoring/scoring-domain.js');
  const prompt = buildScoringPrompt(params);
  return _call([{ role: 'user', content: prompt }], {
    temperature: 0.2,
    max_tokens:  params.max_tokens ?? getScoringTokenLimit(params.type),
    label:       `scoreResponse(${params.type ?? 'unknown'})`,
  });
}

/**
 * Generate detailed feedback for a completed assessment.
 * @param {{ sessionScore, userLevel }} params
 */
export async function generateFeedback(params) {
  const { buildFeedbackPrompt } = await import('./domain/feedback/feedback-domain.js');
  const prompt = buildFeedbackPrompt(params.sessionScore, params.userLevel);
  return _call([{ role: 'user', content: prompt }], {
    temperature: 0.5,
    max_tokens:  GROQ.TOKEN_LIMITS.FEEDBACK,
    label:       'generateFeedback',
  });
}

/**
 * [Phase 4] Generate prediction — stub
 */
export async function generatePrediction(params) {
  console.warn('[Groq] generatePrediction() — Phase 4');
  return { data: null, error: 'Prediction engine not yet active.' };
}

/**
 * Low-level call for domain modules.
 */
export { _call as callGroq };
