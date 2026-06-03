/**
 * NIREV AI — Feedback Domain
 * ─────────────────────────────────────────────────────────────
 * Status:  IMPLEMENTED — Phase 3
 * Version: 3.0.0
 *
 * PURE functions only — no API, no DB, no UI.
 * ─────────────────────────────────────────────────────────────
 */

// ── Pure: Classify feedback tone ─────────────────────────────

export function classifyTone(score) {
  if (score < 40) return 'encouraging';
  if (score <= 75) return 'neutral';
  return 'challenging';
}

// ── Pure: Build Groq feedback prompt ─────────────────────────

export function buildFeedbackPrompt(sessionScore, userLevel) {
  const tone     = classifyTone(sessionScore.totalScore);
  const perQ     = sessionScore.breakdown?.perQuestion ?? [];
  const skill    = sessionScore.skill;
  const score    = Math.round(sessionScore.totalScore);
  const cefr     = sessionScore.cefrLevel;

  const answersText = perQ.map((q, i) =>
    `Q${i+1}: Score ${Math.round(q.normalised)}/100 — ${q.rationale ?? ''}`
  ).join('\n');

  return `You are an expert English language teacher giving personalised feedback to a learner.

Assessment details:
- Skill: ${skill}
- Total Score: ${score}/100
- CEFR Level: ${cefr}
- Current learner level: ${userLevel ?? 'unknown'}
- Feedback tone: ${tone} (${tone === 'encouraging' ? 'be very motivating and supportive' : tone === 'neutral' ? 'be balanced and constructive' : 'be challenging and push them further'})

Per-question results:
${answersText}

Respond ONLY with a JSON object (no markdown, no extra text):
{
  "strengths": ["<specific strength 1>", "<specific strength 2>"],
  "weaknesses": ["<specific weakness 1>", "<specific weakness 2>"],
  "tips": ["<actionable tip 1>", "<actionable tip 2>", "<actionable tip 3>"],
  "summary": "<2-3 sentence overall summary of performance>",
  "cefrComment": "<1 sentence about their ${cefr} level and what it means>",
  "nextSteps": ["<next step 1>", "<next step 2>"]
}

Be specific, practical, and personalised. Reference the actual skill (${skill}) in your feedback.`;
}

// ── Pure: Parse Groq feedback response ───────────────────────

export function parseFeedbackResponse(groqText, sessionId, score) {
  try {
    const clean  = groqText.replace(/```json|```/g, '').trim();
    const parsed = JSON.parse(clean);

    return {
      sessionId,
      type:        'summary',
      sections: {
        strengths:  parsed.strengths  ?? [],
        weaknesses: parsed.weaknesses ?? [],
        tips:       parsed.tips       ?? [],
        summary:    parsed.summary    ?? '',
      },
      cefrComment:  parsed.cefrComment ?? '',
      nextSteps:    parsed.nextSteps   ?? [],
      tone:         classifyTone(score),
      generatedAt:  new Date().toISOString(),
    };
  } catch {
    return _fallbackFeedback(sessionId, score);
  }
}

// ── Pure: Fallback feedback ───────────────────────────────────

function _fallbackFeedback(sessionId, score) {
  return {
    sessionId,
    type: 'summary',
    sections: {
      strengths:  ['You completed the assessment'],
      weaknesses: ['Keep practising to improve your score'],
      tips:       ['Review grammar rules', 'Practice daily', 'Read English texts'],
      summary:    `You scored ${Math.round(score)}/100. Keep practising to improve your performance.`,
    },
    cefrComment:  '',
    nextSteps:    ['Take another assessment', 'Study the areas where you scored low'],
    tone:         classifyTone(score),
    generatedAt:  new Date().toISOString(),
  };
}

export const FEEDBACK_DOMAIN_VERSION = '3.0.0';
