/**
 * NIREV AI — Central Domain Flow Map
 * ─────────────────────────────────────────────────────────────
 * This file is the single source of truth for:
 *   1. The intelligence pipeline order
 *   2. What each domain receives and returns
 *   3. Which domains can communicate with which
 *   4. Data shape as it flows through the system
 *
 * Rule: If you are unsure which domain handles something,
 *       check this file first.
 * ─────────────────────────────────────────────────────────────
 *
 * ══ THE CORE INTELLIGENCE PIPELINE ══════════════════════════
 *
 *   USER INPUT
 *       │
 *       ▼
 *  ┌─────────────────────┐
 *  │  assessment-domain  │  Phase 2
 *  │  ─────────────────  │
 *  │  IN:  userId,        │
 *  │       type, skill,   │
 *  │       answers[]      │
 *  │  OUT: CompletedSession│
 *  └──────────┬──────────┘
 *             │  passes: AnswerRecord[]
 *             ▼
 *  ┌─────────────────────┐
 *  │   scoring-domain    │  Phase 2
 *  │  ─────────────────  │
 *  │  IN:  AnswerRecord[] │
 *  │  OUT: SessionScore   │
 *  │       (CEFR, IELTS,  │
 *  │        breakdown)    │
 *  └──────────┬──────────┘
 *             │  writes to: store.scoring
 *             │
 *     ┌───────┴────────┐
 *     │                │
 *     ▼                ▼
 *  ┌──────────┐   ┌───────────────┐
 *  │ feedback │   │   analytics   │  Phase 3
 *  │  domain  │   │    domain     │
 *  │  ──────  │   │   ────────    │
 *  │  IN:     │   │  IN:          │
 *  │  Session │   │  score history│
 *  │  Score   │   │  OUT:         │
 *  │  OUT:    │   │  charts,      │
 *  │  Feedback│   │  metrics,     │
 *  │  Result  │   │  skill gaps   │
 *  └──────────┘   └──────┬────────┘
 *                        │  passes: AnalyticsResult
 *                        ▼
 *               ┌─────────────────┐
 *               │prediction-domain│  Phase 4
 *               │  ─────────────  │
 *               │  IN:            │
 *               │  AnalyticsResult│
 *               │  OUT:           │
 *               │  PredictionResult│
 *               │  (ETA, milestones│
 *               │   confidence)   │
 *               └─────────────────┘
 *                        │
 *                        ▼
 *                  store.predictions
 *                        │
 *                        ▼
 *                    UI renders
 *
 * ══ COMMUNICATION RULES ══════════════════════════════════════
 *
 *   ✅ ALLOWED:
 *   assessment  → scoring       (direct function call)
 *   scoring     → store         (write scoring slice)
 *   feedback    → store         (reads scoring, writes feedback)
 *   analytics   → store         (reads scoring, writes analytics)
 *   prediction  → store         (reads analytics, writes predictions)
 *   prediction  → groq.js       (AI-enhanced mode only)
 *
 *   ❌ FORBIDDEN (no backward calls, no skipping):
 *   scoring     → assessment    (pipeline is one-directional)
 *   feedback    → scoring       (read from store, not direct call)
 *   prediction  → db.js         (reads from store.analytics only)
 *   any domain  → ui.js         (domains never touch DOM)
 *   any domain  → router.js     (domains never navigate)
 *
 * ══ STORE SLICES OWNED BY EACH DOMAIN ════════════════════════
 *
 *   assessment-domain  →  store.assessment  (read/write)
 *   scoring-domain     →  store.scoring     (write only)
 *   feedback-domain    →  store.feedback    (write only)
 *   analytics-domain   →  store.analytics   (write only)
 *   prediction-domain  →  store.predictions (write only)
 *
 *   Rule: Each domain OWNS one store slice.
 *         Other domains READ from that slice via store.get().
 *         No domain writes to another domain's slice.
 *
 * ══ DATA SHAPES IN TRANSIT ═══════════════════════════════════
 *
 *   assessment → scoring:
 *   AnswerRecord {
 *     questionId, question, answer, rubric, timeSpentMs, skill
 *   }
 *
 *   scoring → store.scoring (read by feedback + analytics):
 *   SessionScore {
 *     sessionId, userId, skill,
 *     totalScore, cefrLevel, ieltsBand,
 *     breakdown: { perQuestion[], bySubSkill{} },
 *     gradedAt
 *   }
 *
 *   analytics → store.analytics (read by prediction):
 *   AnalyticsResult {
 *     summary: { totalSessions, averageScore, trajectory... },
 *     bySkill: { [skill]: { average, sessions, trend } },
 *     charts:  { scoreLine, skillRadar, sessionBar },
 *     skillGaps: SkillGap[]
 *   }
 *
 *   prediction → store.predictions (read by UI):
 *   PredictionResult {
 *     currentLevel, targetLevel,
 *     estimatedDays, estimatedDate,
 *     confidenceScore, confidenceLabel,
 *     milestones[], recommendation{}
 *   }
 *
 * ══ GROQ USAGE PER DOMAIN ════════════════════════════════════
 *
 *   assessment-domain  →  groq.generateQuestions()   Phase 2
 *   scoring-domain     →  groq.scoreResponse()       Phase 2
 *   feedback-domain    →  groq.generateFeedback()    Phase 3
 *   prediction-domain  →  groq.generatePrediction()  Phase 4 (optional)
 *   analytics-domain   →  ✗ NO Groq (pure computation)
 *
 * ══ PHASE DELIVERY SCHEDULE ══════════════════════════════════
 *
 *   Phase 2:  assessment-domain + scoring-domain
 *   Phase 3:  feedback-domain + analytics-domain
 *   Phase 4:  prediction-domain
 *   Phase 5:  benchmarking (extension of analytics + prediction)
 *
 * ─────────────────────────────────────────────────────────────
 */

export const DOMAIN_FLOW_VERSION = '1.0.0';

export const PIPELINE_ORDER = [
  'assessment',
  'scoring',
  'feedback',   // parallel with analytics
  'analytics',  // parallel with feedback
  'prediction',
];

export const DOMAIN_STORE_OWNERSHIP = {
  assessment:  'assessment',
  scoring:     'scoring',
  feedback:    'feedback',
  analytics:   'analytics',
  prediction:  'predictions',
};

export const ALLOWED_CALLS = {
  assessment:  ['scoring', 'db', 'groq', 'store'],
  scoring:     ['groq', 'db', 'store'],
  feedback:    ['groq', 'db', 'store'],
  analytics:   ['db', 'store'],
  prediction:  ['groq', 'store'],
};
