/**
 * NIREV AI — Analytics Domain
 * ─────────────────────────────────────────────────────────────
 * Status:  IMPLEMENTED — Phase 3
 * Version: 3.0.0
 *
 * PURE functions only — no API, no DB, no UI.
 * ─────────────────────────────────────────────────────────────
 */

// ── Pure: Compute average ─────────────────────────────────────

export function computeAverage(scores) {
  if (!scores || scores.length === 0) return 0;
  const sum = scores.reduce((a, b) => a + (parseFloat(b) || 0), 0);
  return parseFloat((sum / scores.length).toFixed(1));
}

// ── Pure: Compute trajectory ──────────────────────────────────

export function computeTrajectory(scores) {
  if (!scores || scores.length < 2) return 'plateauing';
  const half   = Math.floor(scores.length / 2);
  const first  = computeAverage(scores.slice(0, half));
  const second = computeAverage(scores.slice(half));
  const diff   = second - first;
  if (diff > 5)  return 'improving';
  if (diff < -5) return 'declining';
  return 'plateauing';
}

// ── Pure: Compute consistency index ──────────────────────────

export function computeConsistency(scores) {
  if (!scores || scores.length < 2) return 0;
  const avg  = computeAverage(scores);
  const variance = scores.reduce((sum, s) => sum + Math.pow(s - avg, 2), 0) / scores.length;
  const stdDev   = Math.sqrt(variance);
  return Math.max(0, Math.round(100 - stdDev));
}

// ── Pure: Compute skill gaps ──────────────────────────────────

export function computeSkillGaps(bySkill) {
  const cefrTargets = { A1: 40, A2: 55, B1: 70, B2: 80, C1: 90, C2: 100 };

  return Object.entries(bySkill).map(([skill, data]) => {
    const current    = data.average;
    const cefrLevel  = _scoreToCEFR(current);
    const nextLevels = Object.keys(cefrTargets);
    const nextIdx    = nextLevels.indexOf(cefrLevel) + 1;
    const target     = cefrTargets[nextLevels[nextIdx]] ?? 100;
    const gap        = Math.max(0, target - current);

    return {
      skill,
      current:  parseFloat(current.toFixed(1)),
      target,
      gap:      parseFloat(gap.toFixed(1)),
      priority: gap > 20 ? 'high' : gap > 10 ? 'medium' : 'low',
    };
  });
}

// ── Pure: Build line chart data ───────────────────────────────

export function buildLineChartData(scores) {
  if (!scores || scores.length === 0) {
    return { labels: [], values: [] };
  }
  return {
    labels: scores.map((s, i) => {
      const d = new Date(s.created_at ?? s.date ?? Date.now());
      return `${d.getMonth()+1}/${d.getDate()}`;
    }),
    values: scores.map(s => Math.round(parseFloat(s.score ?? s.value ?? 0))),
  };
}

// ── Pure: Build radar chart data ──────────────────────────────

export function buildRadarChartData(bySkill) {
  const skills = Object.keys(bySkill);
  if (skills.length === 0) return { labels: [], values: [] };
  return {
    labels: skills.map(s => s.charAt(0).toUpperCase() + s.slice(1)),
    values: skills.map(s => Math.round(bySkill[s].average ?? 0)),
  };
}

// ── Pure: Build bar chart data ────────────────────────────────

export function buildBarChartData(scores) {
  if (!scores || scores.length === 0) return { labels: [], values: [] };

  // Group by week
  const weeks = {};
  scores.forEach(s => {
    const d    = new Date(s.created_at ?? s.date ?? Date.now());
    const week = `W${_getWeekNumber(d)}`;
    if (!weeks[week]) weeks[week] = 0;
    weeks[week]++;
  });

  return {
    labels: Object.keys(weeks),
    values: Object.values(weeks),
  };
}

// ── Pure: Build full analytics result ────────────────────────

export function buildAnalyticsResult(scores) {
  if (!scores || scores.length === 0) {
    return {
      summary:    { totalSessions: 0, averageScore: 0, bestScore: 0, currentCEFR: '—', consistencyIndex: 0, trajectory: 'plateauing' },
      bySkill:    {},
      charts:     { scoreLine: { labels: [], values: [] }, skillRadar: { labels: [], values: [] }, sessionBar: { labels: [], values: [] } },
      skillGaps:  [],
      computedAt: new Date().toISOString(),
    };
  }

  const scoreValues = scores.map(s => parseFloat(s.score ?? 0));
  const avg         = computeAverage(scoreValues);
  const best        = Math.max(...scoreValues);

  // Group by skill
  const bySkill = {};
  scores.forEach(s => {
    const skill = s.skill ?? 'general';
    if (!bySkill[skill]) bySkill[skill] = { scores: [], sessions: 0 };
    bySkill[skill].scores.push(parseFloat(s.score ?? 0));
    bySkill[skill].sessions++;
  });

  const bySkillSummary = {};
  Object.entries(bySkill).forEach(([skill, data]) => {
    bySkillSummary[skill] = {
      average:  computeAverage(data.scores),
      sessions: data.sessions,
      trend:    computeTrajectory(data.scores),
    };
  });

  return {
    summary: {
      totalSessions:    scores.length,
      averageScore:     avg,
      bestScore:        Math.round(best),
      currentCEFR:      _scoreToCEFR(avg),
      consistencyIndex: computeConsistency(scoreValues),
      trajectory:       computeTrajectory(scoreValues),
    },
    bySkill: bySkillSummary,
    charts: {
      scoreLine:  buildLineChartData(scores),
      skillRadar: buildRadarChartData(bySkillSummary),
      sessionBar: buildBarChartData(scores),
    },
    skillGaps:  computeSkillGaps(bySkillSummary),
    computedAt: new Date().toISOString(),
  };
}

// ── Helpers ───────────────────────────────────────────────────

function _scoreToCEFR(score) {
  if (score >= 90) return 'C2';
  if (score >= 80) return 'C1';
  if (score >= 70) return 'B2';
  if (score >= 55) return 'B1';
  if (score >= 40) return 'A2';
  return 'A1';
}

function _getWeekNumber(d) {
  const oneJan = new Date(d.getFullYear(), 0, 1);
  return Math.ceil((((d - oneJan) / 86400000) + oneJan.getDay() + 1) / 7);
}

export const ANALYTICS_DOMAIN_VERSION = '3.0.0';
