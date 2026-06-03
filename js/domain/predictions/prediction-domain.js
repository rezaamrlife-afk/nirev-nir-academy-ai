/**
 * NIREV AI — Prediction Domain
 * ─────────────────────────────────────────────────────────────
 * Status:  IMPLEMENTED — Phase 4
 * Version: 4.0.0
 *
 * PURE functions only — no API, no DB, no UI.
 * ─────────────────────────────────────────────────────────────
 */

// ── CEFR Level System ─────────────────────────────────────────

const CEFR_LEVELS   = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];
const CEFR_SCORES   = { A1: 0, A2: 40, B1: 55, B2: 70, C1: 80, C2: 90 };
const CEFR_TARGETS  = { A1: 40, A2: 55, B1: 70, B2: 80, C1: 90, C2: 100 };

// ── Pure: Linear Regression ───────────────────────────────────

export function linearRegression(scores) {
  const n = scores.length;
  if (n < 2) return { slope: 0, intercept: scores[0] ?? 0, r2: 0 };

  const xs = scores.map((_, i) => i);
  const meanX = xs.reduce((a, b) => a + b, 0) / n;
  const meanY = scores.reduce((a, b) => a + b, 0) / n;

  const ssXX = xs.reduce((sum, x) => sum + Math.pow(x - meanX, 2), 0);
  const ssXY = xs.reduce((sum, x, i) => sum + (x - meanX) * (scores[i] - meanY), 0);
  const ssYY = scores.reduce((sum, y) => sum + Math.pow(y - meanY, 2), 0);

  const slope     = ssXX === 0 ? 0 : ssXY / ssXX;
  const intercept = meanY - slope * meanX;
  const r2        = ssYY === 0 ? 0 : Math.pow(ssXY, 2) / (ssXX * ssYY);

  return { slope, intercept, r2: parseFloat(r2.toFixed(3)) };
}

// ── Pure: Estimate days to reach target score ─────────────────

export function estimateDaysToLevel(currentScore, targetScore, slope, sessionsPerWeek = 3) {
  if (slope <= 0) return null; // not improving

  const scoreNeeded    = targetScore - currentScore;
  const sessionsNeeded = scoreNeeded / slope;
  const daysNeeded     = Math.ceil((sessionsNeeded / sessionsPerWeek) * 7);

  return Math.max(1, daysNeeded);
}

// ── Pure: Compute confidence ──────────────────────────────────

export function computeConfidence(sessionCount, r2) {
  if (sessionCount < 3)  return { score: 20, label: 'low' };
  if (sessionCount < 10) {
    const score = Math.round(20 + (sessionCount - 3) * 8 + r2 * 20);
    return { score: Math.min(69, score), label: 'medium' };
  }
  const score = Math.round(70 + r2 * 30);
  return { score: Math.min(100, score), label: 'high' };
}

// ── Pure: Get next CEFR level ─────────────────────────────────

export function getNextLevel(currentLevel) {
  const idx = CEFR_LEVELS.indexOf(currentLevel);
  if (idx === -1 || idx === CEFR_LEVELS.length - 1) return null;
  return CEFR_LEVELS[idx + 1];
}

// ── Pure: Build milestone map ─────────────────────────────────

export function buildMilestoneMap(currentScore, slope, sessionsPerWeek = 3) {
  return CEFR_LEVELS.map(level => {
    const target  = CEFR_TARGETS[level];
    const reached = currentScore >= target;

    let estimatedAt = null;
    if (!reached && slope > 0) {
      const days = estimateDaysToLevel(currentScore, target, slope, sessionsPerWeek);
      if (days !== null) {
        const d = new Date();
        d.setDate(d.getDate() + days);
        estimatedAt = d.toISOString().split('T')[0];
      }
    }

    return {
      level,
      targetScore: target,
      reached,
      estimatedAt,
    };
  });
}

// ── Pure: Recommend sessions per week ────────────────────────

export function recommendFrequency(trajectory, avgScore) {
  if (trajectory === 'declining') return 5;
  if (trajectory === 'plateauing') return 4;
  if (avgScore < 40) return 5;
  if (avgScore < 60) return 4;
  return 3;
}

// ── Pure: Build full prediction result ───────────────────────

export function buildPredictionResult(analyticsResult) {
  const { summary, bySkill, skillGaps } = analyticsResult;

  const currentLevel = summary.currentCEFR;
  const nextLevel    = getNextLevel(currentLevel);
  const scores       = _extractScoreHistory(analyticsResult);
  const { slope, intercept, r2 } = linearRegression(scores);
  const confidence   = computeConfidence(summary.totalSessions, r2);

  const sessionsPerWeek = recommendFrequency(summary.trajectory, summary.averageScore);
  const targetScore     = nextLevel ? CEFR_TARGETS[currentLevel] : 100;
  const estimatedDays   = nextLevel && slope > 0
    ? estimateDaysToLevel(summary.averageScore, targetScore, slope, sessionsPerWeek)
    : null;

  const estimatedDate = estimatedDays ? (() => {
    const d = new Date();
    d.setDate(d.getDate() + estimatedDays);
    return d.toISOString().split('T')[0];
  })() : null;

  // Focus skills — top 2 gaps
  const focusSkills = (skillGaps ?? [])
    .sort((a, b) => b.gap - a.gap)
    .slice(0, 2)
    .map(g => g.skill);

  // Personalised message
  const message = _buildMessage(summary.trajectory, currentLevel, nextLevel, estimatedDays);

  return {
    currentLevel,
    targetLevel:    nextLevel ?? currentLevel,
    estimatedDays,
    estimatedDate,
    confidenceScore: confidence.score,
    confidenceLabel: confidence.label,
    trajectory:      summary.trajectory,
    milestones:      buildMilestoneMap(summary.averageScore, slope, sessionsPerWeek),
    recommendation: {
      sessionsPerWeek,
      focusSkills,
      message,
    },
    generatedAt: new Date().toISOString(),
  };
}

// ── Helpers ───────────────────────────────────────────────────

function _extractScoreHistory(analyticsResult) {
  return analyticsResult.charts?.scoreLine?.values ?? [];
}

function _buildMessage(trajectory, currentLevel, nextLevel, estimatedDays) {
  if (!nextLevel) return `You've reached ${currentLevel} — keep pushing to maintain it!`;
  if (trajectory === 'improving' && estimatedDays) {
    return `Great progress! At this rate you'll reach ${nextLevel} in about ${estimatedDays} days.`;
  }
  if (trajectory === 'declining') {
    return `Your scores are dropping — try to assess more consistently to get back on track.`;
  }
  return `Stay consistent and you'll reach ${nextLevel ?? 'the next level'} soon.`;
}

export const PREDICTIONS_DOMAIN_VERSION = '4.0.0';
