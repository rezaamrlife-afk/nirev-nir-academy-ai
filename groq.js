/**
 * NIREV AI — Groq API Wrapper
 * ─────────────────────────────────────────────────────────────
 * Architecture-ready stub. Business logic is NOT implemented yet.
 * This file defines the interface all future AI calls will use.
 *
 * Security Model:
 *   All Groq calls are proxied through a Supabase Edge Function.
 *   The Groq secret key never appears in frontend code.
 *   The Edge Function URL is defined in config.js (GROQ.EDGE_FN_URL).
 *
 * Pattern:
 *   Each public function takes a structured prompt input
 *   and returns { data: string | null, error: string | null }.
 *   Callers handle the result — this layer never touches DOM or store.
 *
 * Future Domains:
 *   - Assessment scoring prompts     → domain/scoring/
 *   - Feedback generation prompts    → domain/feedback/
 *   - Prediction analysis prompts    → domain/predictions/
 *
 * Rule: Raw prompts live in their domain folder.
 *       This file handles transport, auth headers, retries, and errors.
 * ─────────────────────────────────────────────────────────────
 */

import { GROQ } from './config.js';
import { getSupabase } from './auth.js';

// ── Internal Transport ────────────────────────────────────────

/**
 * Send a request to the Groq proxy Edge Function.
 * The Edge Function attaches the Groq API key server-side.
 *
 * @param {Object} payload - { messages, model?, max_tokens?, temperature? }
 * @returns {{ data: string | null, error: string | null }}
 */
async function _callProxy(payload) {
  const sb = getSupabase();
  if (!sb) return { data: null, error: 'Supabase not initialized' };

  try {
    // Get current session token to authenticate with the Edge Function
    const { data: sessionData } = await sb.auth.getSession();
    const accessToken = sessionData?.session?.access_token;
    if (!accessToken) return { data: null, error: 'Not authenticated' };

    const response = await fetch(GROQ.EDGE_FN_URL, {
      method: 'POST',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        model:       payload.model       ?? GROQ.MODEL,
        max_tokens:  payload.max_tokens  ?? GROQ.MAX_TOKENS,
        temperature: payload.temperature ?? GROQ.TEMPERATURE,
        messages:    payload.messages,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      return { data: null, error: `Groq proxy error ${response.status}: ${errText}` };
    }

    const result = await response.json();
    const content = result?.choices?.[0]?.message?.content ?? null;

    if (!content) return { data: null, error: 'Empty response from AI' };
    return { data: content, error: null };

  } catch (err) {
    return { data: null, error: err.message ?? 'Network error' };
  }
}

// ── Public API Stubs ──────────────────────────────────────────
// These are the contracts that domain modules will call.
// Implementation details will be added per phase.

/**
 * [Phase 2] Score a learner's assessment response.
 * @param {{ skill, question, answer, rubric }} params
 * @returns {{ data: { score, feedback, details } | null, error: string | null }}
 */
export async function scoreResponse(params) {
  // Prompt construction will be implemented in domain/scoring/
  // when Phase 2 begins. This stub defines the interface contract.
  console.warn('[Groq] scoreResponse() — not yet implemented (Phase 2)');
  return { data: null, error: 'Assessment engine not yet active.' };
}

/**
 * [Phase 3] Generate detailed feedback for a completed assessment.
 * @param {{ skill, answers, scores, userLevel }} params
 * @returns {{ data: string | null, error: string | null }}
 */
export async function generateFeedback(params) {
  console.warn('[Groq] generateFeedback() — not yet implemented (Phase 3)');
  return { data: null, error: 'Feedback engine not yet active.' };
}

/**
 * [Phase 4] Generate a progress prediction for a learner.
 * @param {{ scoreHistory, currentLevel, targetLevel }} params
 * @returns {{ data: { estimatedDays, confidence, nextMilestone } | null, error: string | null }}
 */
export async function generatePrediction(params) {
  console.warn('[Groq] generatePrediction() — not yet implemented (Phase 4)');
  return { data: null, error: 'Prediction engine not yet active.' };
}

/**
 * [Phase 2] Generate assessment questions for a skill.
 * @param {{ skill, level, type, count }} params
 * @returns {{ data: Question[] | null, error: string | null }}
 */
export async function generateQuestions(params) {
  console.warn('[Groq] generateQuestions() — not yet implemented (Phase 2)');
  return { data: null, error: 'Assessment engine not yet active.' };
}

// ── Exported Transport (for domain modules that build raw payloads) ──

/**
 * Low-level call for domain modules that build their own payloads.
 * Only use this inside js/domain/ submodules.
 * @param {Object} payload
 */
export { _callProxy as callGroq };
