/**
 * NIREV AI — Scoring Domain
 * ─────────────────────────────────────────────────────────────
 * Status:  IMPLEMENTED — Phase 2
 * Version: 2.0.0
 *
 * PURE functions only — no API, no DB, no UI.
 * Side-effects handled by assessment-engine.js
 * ─────────────────────────────────────────────────────────────
 */

// ── Pure: Normalize raw score to 0–100 ───────────────────────

export function normalizeScore(rawScore) {
  const n = parseFloat(rawScore);
  if (isNaN(n)) return 0;
  return Math.min(100, Math.max(0, parseFloat(n.toFixed(2))));
}

// ── Pure: Map score to CEFR level ────────────────────────────

export function mapToCEFR(score) {
  if (score >= 90) return 'C2';
  if (score >= 80) return 'C1';
  if (score >= 70) return 'B2';
  if (score >= 55) return 'B1';
  if (score >= 40) return 'A2';
  return 'A1';
}

// ── Pure: Map score to IELTS band ────────────────────────────

export function mapToIELTSBand(score) {
  if (score >= 95) return '9.0';
  if (score >= 87) return '8.5';
  if (score >= 80) return '8.0';
  if (score >= 73) return '7.5';
  if (score >= 66) return '7.0';
  if (score >= 60) return '6.5';
  if (score >= 53) return '6.0';
  if (score >= 46) return '5.5';
  if (score >= 40) return '5.0';
  if (score >= 33) return '4.5';
  if (score >= 26) return '4.0';
  return '3.5';
}

// ── Pure: Compute weighted average ───────────────────────────

export function computeAverage(scores) {
  if (!scores || scores.length === 0) return 0;
  const sum = scores.reduce((acc, s) => acc + (parseFloat(s) || 0), 0);
  return parseFloat((sum / scores.length).toFixed(2));
}

// ── Pure: Parse Groq scoring response ────────────────────────

export function parseGroqScore(groqText, questionId) {
  try {
    const clean = groqText.replace(/```json|```/g, '').trim();
    const parsed = JSON.parse(clean);

    return {
      questionId,
      rawScore:   parseFloat(parsed.score ?? parsed.raw_score ?? 50),
      normalised: normalizeScore(parsed.score ?? parsed.raw_score ?? 50),
      rationale:  parsed.rationale ?? parsed.feedback ?? parsed.explanation ?? '',
      tags:       parsed.tags ?? parsed.issues ?? [],
    };
  } catch {
    // Fallback score if parsing fails
    return {
      questionId,
      rawScore:   50,
      normalised: 50,
      rationale:  'Score estimated based on response.',
      tags:       [],
    };
  }
}

// ── Pure: Build score breakdown ──────────────────────────────

export function buildScoreBreakdown(answerScores) {
  const bySubSkill = {};

  answerScores.forEach(s => {
    s.tags?.forEach(tag => {
      if (!bySubSkill[tag]) bySubSkill[tag] = [];
      bySubSkill[tag].push(s.normalised);
    });
  });

  // Average each sub-skill
  Object.keys(bySubSkill).forEach(k => {
    bySubSkill[k] = computeAverage(bySubSkill[k]);
  });

  return {
    perQuestion: answerScores,
    bySubSkill,
  };
}

// ── Pure: Build full SessionScore ────────────────────────────

export function buildSessionScore(sessionId, userId, skill, answerScores) {
  const scores     = answerScores.map(s => s.normalised);
  const totalScore = computeAverage(scores);

  return {
    sessionId,
    userId,
    skill,
    totalScore,
    cefrLevel:  mapToCEFR(totalScore),
    ieltsBand:  mapToIELTSBand(totalScore),
    breakdown:  buildScoreBreakdown(answerScores),
    gradedAt:   new Date().toISOString(),
  };
}

// ── Pure: Build Groq scoring prompt ──────────────────────────

export function buildScoringPrompt(answerRecord) {
  return `You are an expert English language assessor. Score the following learner response.

Skill being assessed: ${answerRecord.skill}
Question type: ${answerRecord.type}
Question: ${answerRecord.question}
${answerRecord.options ? `Options: ${answerRecord.options.join(', ')}` : ''}
Learner's answer: ${answerRecord.answer}
Scoring rubric: ${answerRecord.rubric}

Respond ONLY with a JSON object in this exact format (no markdown, no extra text):
{
  "score": <number 0-100>,
  "rationale": "<1-2 sentence explanation of the score>",
  "tags": ["<issue or strength tag>", ...]
}

Score strictly. Consider accuracy, appropriateness, and completeness.
For multiple choice: 100 if correct, 0 if wrong.
For short-answer and essay: score 0-100 based on the rubric.`;
}

export const SCORING_DOMAIN_VERSION = '2.0.0';
