/**
 * NIREV AI — Scoring Domain
 * ─────────────────────────────────────────────────────────────
 * Domain: Scoring Engine
 * Phase:  2
 * Status: STUB — Architecture placeholder only
 *
 * This domain is responsible for:
 *   - Sending learner responses to Groq for evaluation
 *   - Parsing and normalising AI-returned scores (0–100)
 *   - Mapping scores to CEFR levels and IELTS bands
 *   - Persisting score records via db.js
 *   - Updating store.scoring slice
 *
 * Scoring Rubric Types (planned):
 *   - Grammar accuracy
 *   - Vocabulary range
 *   - Task achievement
 *   - Coherence & cohesion
 *   - Pronunciation (future speaking module)
 *
 * Dependencies (when implemented):
 *   ← groq.js        (scoreResponse)
 *   ← db.js          (saveScore, getScoreSummary)
 *   ← store.js       (scoring slice)
 *   → feedback/      (triggers feedback generation)
 *   → analytics/     (feeds score data)
 * ─────────────────────────────────────────────────────────────
 */

// Phase 2 implementation goes here.

export const SCORING_DOMAIN_VERSION = '0.0.0-stub';
