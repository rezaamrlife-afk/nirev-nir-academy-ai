/**
 * NIREV AI — Groq API Wrapper
 * ─────────────────────────────────────────────────────────────
 * Version: 2.0.0 — Phase 2 Implementation
 *
 * Security: Groq API key is passed via config.js (GROQ.API_KEY).
 * Direct browser call — no Edge Function needed for Phase 2.
 * ─────────────────────────────────────────────────────────────
 */

import { GROQ } from './config.js';

// ── Internal Transport ────────────────────────────────────────

async function _call(messages, options = {}) {
  try {
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': `Bearer ${GROQ.API_KEY}`,
      },
      body: JSON.stringify({
        model:       options.model       ?? GROQ.MODEL,
        max_tokens:  options.max_tokens  ?? GROQ.MAX_TOKENS,
        temperature: options.temperature ?? GROQ.TEMPERATURE,
        messages,
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      return { data: null, error: `Groq API error ${response.status}: ${err}` };
    }

    const result  = await response.json();
    const content = result?.choices?.[0]?.message?.content ?? null;

    if (!content) return { data: null, error: 'Empty response from Groq' };
    return { data: content, error: null };

  } catch (err) {
    return { data: null, error: err.message ?? 'Network error calling Groq' };
  }
}

// ── Public API ────────────────────────────────────────────────

/**
 * Generate assessment questions for a skill and level.
 * @param {{ skill, level, type, count }} params
 */
export async function generateQuestions(params) {
  const { skill, level, type, count = 5 } = params;

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
Vary difficulty between ${Math.max(1, (level === 'A1' ? 1 : level === 'A2' ? 2 : level === 'B1' ? 2 : level === 'B2' ? 3 : 4))}-${Math.min(5, (level === 'C1' || level === 'C2' ? 5 : 4))}.`;

  return _call([{ role: 'user', content: prompt }], { temperature: 0.7 });
}

/**
 * Score a single learner answer.
 * @param {{ question, answer, rubric, skill, type, options }} params
 */
export async function scoreResponse(params) {
  const { buildScoringPrompt } = await import('./domain/scoring/scoring-domain.js');
  const prompt = buildScoringPrompt(params);
  return _call([{ role: 'user', content: prompt }], { temperature: 0.2, max_tokens: 300 });
}

/**
 * [Phase 3] Generate feedback — stub
 */
export async function generateFeedback(params) {
  console.warn('[Groq] generateFeedback() — Phase 3');
  return { data: null, error: 'Feedback engine not yet active.' };
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
