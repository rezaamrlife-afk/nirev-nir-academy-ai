/**
 * NIREV AI — Scoring Domain Contract
 * ─────────────────────────────────────────────────────────────
 * Status:  CONTRACT DEFINED — Implementation: Phase 2
 * Version: 0.2.0-contract
 *
 * ── POSITION IN PIPELINE ─────────────────────────────────────
 *
 *   assessment-domain → [scoring-domain] → feedback-domain
 *                              ↓
 *                       analytics-domain
 *
 * Receives completed session answers from assessment-domain.
 * Sends each answer to Groq for AI evaluation.
 * Returns a structured score object to feedback-domain and analytics-domain.
 *
 * ── PURE vs SIDE-EFFECT RULE ─────────────────────────────────
 *
 *   PURE functions:
 *     - normalizeScore()        raw AI number → 0–100 float
 *     - mapToCEFR()             score → A1/A2/B1/B2/C1/C2
 *     - mapToIELTSBand()        score → 1.0–9.0 band
 *     - computeAverage()        array of scores → mean
 *     - buildScoreBreakdown()   per-question scores → summary
 *
 *   SIDE-EFFECT functions:
 *     - scoreSession()          → calls groq.js + db.js
 *     - scoreAnswer()           → calls groq.js
 *     - persistScore()          → calls db.js (saveScore)
 *
 * ── DEPENDENCIES ─────────────────────────────────────────────
 *
 *   ALLOWED to call:
 *     → groq.js              (scoreResponse)
 *     → db.js                (saveScore, getScoreSummary)
 *     → store.js             (scoring slice write)
 *
 *   NOT ALLOWED to call:
 *     ✗ assessment-domain    (no circular dependency)
 *     ✗ feedback-domain      (scoring does not trigger feedback directly)
 *     ✗ ui.js
 *     ✗ router.js
 *
 *   NOTE: feedback-domain and analytics-domain subscribe to
 *         store.scoring changes — scoring does NOT call them directly.
 *
 * ── INPUT SCHEMA ─────────────────────────────────────────────
 *
 * scoreSession(input):
 * {
 *   sessionId:   string,
 *   userId:      string,
 *   skill:       string,
 *   answers:     AnswerRecord[]   // from assessment-domain output
 * }
 *
 * AnswerRecord (received from assessment-domain):
 * {
 *   questionId:  string,
 *   question:    string,
 *   answer:      string,
 *   rubric:      string,
 *   timeSpentMs: number,
 *   skill:       string
 * }
 *
 * scoreAnswer(input):
 * {
 *   question:    string,
 *   answer:      string,
 *   rubric:      string,
 *   skill:       string
 * }
 *
 * ── OUTPUT SCHEMA ────────────────────────────────────────────
 *
 * scoreAnswer() → AnswerScore:
 * {
 *   questionId:  string,
 *   rawScore:    number,          // 0–100 from Groq
 *   normalised:  number,          // 0–100 float (2 decimal places)
 *   rationale:   string,          // AI explanation (1–2 sentences)
 *   tags:        string[]         // e.g. ['grammar_error', 'good_vocabulary']
 * }
 *
 * scoreSession() → SessionScore:
 * {
 *   sessionId:      string,
 *   userId:         string,
 *   skill:          string,
 *   totalScore:     number,       // 0–100 weighted average
 *   cefrLevel:      string,       // A1 | A2 | B1 | B2 | C1 | C2
 *   ieltsBand:      string,       // '4.0' – '9.0' | null (if not applicable)
 *   breakdown: {
 *     perQuestion:  AnswerScore[],
 *     bySubSkill: {               // grouped by rubric criteria
 *       [subSkill: string]: number
 *     }
 *   },
 *   gradedAt:       string        // ISO timestamp
 * }
 *
 * ── CEFR MAPPING TABLE ───────────────────────────────────────
 *
 *   90–100  → C2
 *   80–89   → C1
 *   70–79   → B2
 *   55–69   → B1
 *   40–54   → A2
 *   0–39    → A1
 *
 * ── IELTS BAND MAPPING ───────────────────────────────────────
 *
 *   95–100  → 9.0
 *   87–94   → 8.5
 *   80–86   → 8.0
 *   73–79   → 7.5
 *   66–72   → 7.0
 *   60–65   → 6.5
 *   53–59   → 6.0
 *   ...
 *
 * ── ERROR OUTPUT ─────────────────────────────────────────────
 *
 * { data: SessionScore | null, error: string | null }
 * ─────────────────────────────────────────────────────────────
 */

// Phase 2 implementation goes here.
export const SCORING_DOMAIN_VERSION = '0.2.0-contract';
