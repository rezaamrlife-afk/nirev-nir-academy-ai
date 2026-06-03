/**
 * NIREV AI — Feedback Domain Contract
 * ─────────────────────────────────────────────────────────────
 * Status:  CONTRACT DEFINED — Implementation: Phase 3
 * Version: 0.2.0-contract
 *
 * ── POSITION IN PIPELINE ─────────────────────────────────────
 *
 *   scoring-domain → [feedback-domain]
 *                          ↓
 *                   (renders to UI via store)
 *
 * Triggered when store.scoring is updated after a session.
 * Reads SessionScore, constructs AI prompt, generates
 * human-readable feedback, persists it, and updates store.feedback.
 *
 * ── PURE vs SIDE-EFFECT RULE ─────────────────────────────────
 *
 *   PURE functions:
 *     - buildFeedbackPrompt()   SessionScore → prompt string
 *     - formatFeedback()        raw AI text → structured FeedbackResult
 *     - classifyFeedbackType()  session data → 'immediate'|'summary'|'progress'
 *
 *   SIDE-EFFECT functions:
 *     - generateFeedback()      → calls groq.js
 *     - saveFeedback()          → calls db.js
 *     - publishFeedback()       → writes to store.feedback
 *
 * ── DEPENDENCIES ─────────────────────────────────────────────
 *
 *   ALLOWED to call:
 *     → groq.js              (generateFeedback, callGroq)
 *     → db.js                (saveFeedback, getLatestFeedback)
 *     → store.js             (reads scoring slice, writes feedback slice)
 *
 *   NOT ALLOWED to call:
 *     ✗ assessment-domain    (pipeline flows forward only)
 *     ✗ scoring-domain       (pipeline flows forward only)
 *     ✗ analytics-domain     (separate branch)
 *     ✗ ui.js
 *     ✗ router.js
 *
 * ── INPUT SCHEMA ─────────────────────────────────────────────
 *
 * generateFeedback(input):
 * {
 *   sessionScore: SessionScore,  // full output from scoring-domain
 *   userLevel:    string,        // current CEFR level
 *   feedbackType: 'immediate'    // right after one answer
 *               | 'summary'      // end of full session
 *               | 'progress'     // weekly/monthly trend
 * }
 *
 * ── OUTPUT SCHEMA ────────────────────────────────────────────
 *
 * generateFeedback() → FeedbackResult:
 * {
 *   sessionId:    string,
 *   type:         'immediate' | 'summary' | 'progress',
 *   sections: {
 *     strengths:  string[],      // What learner did well
 *     weaknesses: string[],      // Areas needing improvement
 *     tips:       string[],      // Actionable improvement tips
 *     summary:    string         // 2–3 sentence overall summary
 *   },
 *   cefrComment:  string,        // Comment on current CEFR level
 *   nextSteps:    string[],      // Recommended next actions
 *   tone:         'encouraging' | 'neutral' | 'challenging',
 *   generatedAt:  string         // ISO timestamp
 * }
 *
 * ── FEEDBACK TONE RULES ──────────────────────────────────────
 *
 *   score < 40   → 'encouraging'  (motivate, do not discourage)
 *   score 40–75  → 'neutral'      (balanced, constructive)
 *   score > 75   → 'challenging'  (push further, raise the bar)
 *
 * ── ERROR OUTPUT ─────────────────────────────────────────────
 *
 * { data: FeedbackResult | null, error: string | null }
 * ─────────────────────────────────────────────────────────────
 */

// Phase 3 implementation goes here.
export const FEEDBACK_DOMAIN_VERSION = '0.2.0-contract';
