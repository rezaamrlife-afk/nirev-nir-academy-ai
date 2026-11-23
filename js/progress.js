/**
 * NIREV AI — Progress & Intelligence Dashboard
 * ─────────────────────────────────────────────────────────────
 * Version: 5.0.0 — Premium Redesign
 *
 * Renders the Progress & Predictions page.
 * Reads from store.analytics and store.predictions.
 * All data comes from real assessment scores — nothing invented.
 * ─────────────────────────────────────────────────────────────
 */

import store from './store.js';
import { getScores } from './db.js';
import { buildAnalyticsResult } from './domain/analytics/analytics-domain.js';
import { buildPredictionResult, linearRegression } from './domain/predictions/prediction-domain.js';

// ── CEFR meta ─────────────────────────────────────────────────

const CEFR_META = {
  A1: { label: 'Beginner',      color: '#6B6358', next: 40  },
  A2: { label: 'Elementary',    color: '#8A6F28', next: 55  },
  B1: { label: 'Intermediate',  color: '#C9A84C', next: 70  },
  B2: { label: 'Upper-Int.',    color: '#E07B00', next: 80  },
  C1: { label: 'Advanced',      color: '#DDB96A', next: 90  },
  C2: { label: 'Proficiency',   color: '#EDD090', next: 100 },
};

const SKILL_ICONS = {
  vocabulary: '📖', grammar: '✏️', reading: '📚',
  listening: '🎧', speaking: '🎙️', writing: '✍️', general: '⬡',
};

// ── Initialize ────────────────────────────────────────────────

export function initProgressPage() {
  document.addEventListener('nirev:analytics:ready', (e) => {
    const prediction = buildPredictionResult(e.detail.analytics);
    store.set('predictions', {
      nextLevel:     prediction.targetLevel,
      estimatedDays: prediction.estimatedDays,
      confidence:    prediction.confidenceLabel,
      full:          prediction,
    });
    document.dispatchEvent(new CustomEvent('nirev:prediction:ready', { detail: { prediction } }));
  });

  document.addEventListener('nirev:navigate', (e) => {
    if (e.detail?.pageId === 'progress') _loadAndRender();
  });
}

// ── Load and Render ───────────────────────────────────────────

async function _loadAndRender() {
  const userId    = store.get('user')?.id;
  const container = document.getElementById('progress-content');
  if (!userId || !container) return;

  // Use cached prediction if available
  const cached = store.get('predictions');
  if (cached?.full) {
    const analytics = store.get('analytics')?.full;
    _renderDashboard(cached.full, analytics);
    return;
  }

  // Use cached analytics
  const analytics = store.get('analytics')?.full;
  if (analytics) {
    const prediction = buildPredictionResult(analytics);
    store.set('predictions', {
      nextLevel:     prediction.targetLevel,
      estimatedDays: prediction.estimatedDays,
      confidence:    prediction.confidenceLabel,
      full:          prediction,
    });
    _renderDashboard(prediction, analytics);
    return;
  }

  // Load from DB
  container.innerHTML = _loadingHTML();

  try {
    const { data: scores, error } = await getScores(userId, { limit: 50 });
    if (error || !scores || scores.length === 0) {
      container.innerHTML = _emptyHTML();
      return;
    }

    const analyticsResult = buildAnalyticsResult(scores);
    const prediction      = buildPredictionResult(analyticsResult);

    store.set('analytics',   { loaded: true, full: analyticsResult });
    store.set('predictions', {
      full:          prediction,
      nextLevel:     prediction.targetLevel,
      estimatedDays: prediction.estimatedDays,
      confidence:    prediction.confidenceLabel,
    });

    _renderDashboard(prediction, analyticsResult);

  } catch (err) {
    console.error('[progress] render error:', err);
    container.innerHTML = _errorHTML();
  }
}

// ── Main Render ───────────────────────────────────────────────

function _renderDashboard(prediction, analytics) {
  const container = document.getElementById('progress-content');
  if (!container) return;

  const {
    currentLevel, targetLevel, estimatedDays, estimatedDate,
    confidenceScore, confidenceLabel, trajectory,
    milestones, recommendation,
  } = prediction;

  const summary  = analytics?.summary  ?? {};
  const bySkill  = analytics?.bySkill  ?? {};
  const skillGaps = analytics?.skillGaps ?? [];
  const charts   = analytics?.charts   ?? {};

  container.innerHTML = `

    <!-- ══ SECTION 1: Intelligence Overview ══════════════════ -->
    <section class="pi-section pi-overview" aria-label="Intelligence Overview">

      <div class="pi-overview__grid">

        <!-- Current Level card -->
        <div class="pi-kpi-card pi-kpi-card--level">
          <div class="pi-kpi-card__eyebrow">Current Level</div>
          <div class="pi-kpi-card__value pi-kpi-card__value--cefr"
               style="color:${CEFR_META[currentLevel]?.color ?? 'var(--gold-pure)'}">
            ${currentLevel}
          </div>
          <div class="pi-kpi-card__sub">${CEFR_META[currentLevel]?.label ?? ''}</div>
          <div class="pi-kpi-card__bar">
            <div class="pi-kpi-card__bar-fill"
                 style="width:${summary.averageScore ?? 0}%;
                        background:${CEFR_META[currentLevel]?.color ?? 'var(--gold-pure)'}">
            </div>
          </div>
          <div class="pi-kpi-card__bar-label">${Math.round(summary.averageScore ?? 0)}/100</div>
        </div>

        <!-- Sessions card -->
        <div class="pi-kpi-card">
          <div class="pi-kpi-card__eyebrow">Assessments</div>
          <div class="pi-kpi-card__value">${summary.totalSessions ?? 0}</div>
          <div class="pi-kpi-card__sub">Total sessions</div>
          <div class="pi-trajectory pi-trajectory--${trajectory}">
            ${_trajectoryIcon(trajectory)} ${trajectory}
          </div>
        </div>

        <!-- Best Score card -->
        <div class="pi-kpi-card">
          <div class="pi-kpi-card__eyebrow">Best Score</div>
          <div class="pi-kpi-card__value">${summary.bestScore ?? '—'}</div>
          <div class="pi-kpi-card__sub">Personal best</div>
          <div class="pi-kpi-card__sub" style="margin-top:var(--space-2)">
            Avg: <strong style="color:var(--gold-bright)">${Math.round(summary.averageScore ?? 0)}</strong>
          </div>
        </div>

        <!-- Consistency card -->
        <div class="pi-kpi-card">
          <div class="pi-kpi-card__eyebrow">Consistency</div>
          <div class="pi-kpi-card__value">${summary.consistencyIndex ?? 0}<span class="pi-kpi-card__unit">%</span></div>
          <div class="pi-kpi-card__sub">Score stability</div>
          <div class="pi-ring-wrap">
            ${_consistencyRing(summary.consistencyIndex ?? 0)}
          </div>
        </div>

      </div>
    </section>

    <!-- ══ SECTION 2: AI Prediction Panel ════════════════════ -->
    <section class="pi-section pi-prediction" aria-label="AI Prediction">

      <div class="pi-section__header">
        <div class="pi-section__title-wrap">
          <span class="pi-section__eyebrow">AI Prediction Engine</span>
          <h2 class="pi-section__title">Level Forecast</h2>
        </div>
        <span class="pi-confidence-badge pi-confidence-badge--${confidenceLabel}">
          ${_confidenceIcon(confidenceLabel)} ${confidenceLabel} confidence · ${confidenceScore}%
        </span>
      </div>

      <div class="pi-prediction__body">

        ${estimatedDays ? `
          <div class="pi-prediction__hero">
            <div class="pi-prediction__from">${currentLevel}</div>
            <div class="pi-prediction__arrow">→</div>
            <div class="pi-prediction__to" style="color:${CEFR_META[targetLevel]?.color ?? 'var(--gold-pure)'}">
              ${targetLevel}
            </div>
          </div>
          <div class="pi-prediction__meta">
            <div class="pi-prediction__days-wrap">
              <div class="pi-prediction__days">${estimatedDays}</div>
              <div class="pi-prediction__days-label">days to ${targetLevel}</div>
            </div>
            ${estimatedDate ? `
              <div class="pi-prediction__date-wrap">
                <div class="pi-prediction__date-label">Estimated date</div>
                <div class="pi-prediction__date">${_formatDate(estimatedDate)}</div>
              </div>` : ''}
          </div>
        ` : `
          <div class="pi-prediction__unavailable">
            <div class="pi-prediction__unavailable-icon">⬡</div>
            <div class="pi-prediction__unavailable-text">
              ${trajectory === 'declining'
                ? 'Scores are declining — improve consistency for a forecast'
                : 'Complete more assessments to unlock your forecast'}
            </div>
          </div>
        `}

        <div class="pi-prediction__message">${recommendation.message}</div>

      </div>

      ${_renderScoreTimeline(charts)}

    </section>

    <!-- ══ SECTION 3: Skill Intelligence ═════════════════════ -->
    <section class="pi-section pi-skills" aria-label="Skill Intelligence">

      <div class="pi-section__header">
        <div class="pi-section__title-wrap">
          <span class="pi-section__eyebrow">Skill Breakdown</span>
          <h2 class="pi-section__title">Skill Intelligence</h2>
        </div>
      </div>

      ${Object.keys(bySkill).length > 0 ? `
        <div class="pi-skills__grid">
          ${Object.entries(bySkill).map(([skill, data]) => {
            const gap  = skillGaps.find(g => g.skill === skill);
            const icon = SKILL_ICONS[skill] ?? '⬡';
            const pct  = Math.round(data.average ?? 0);
            const cefrColor = _scoreToColor(pct);
            return `
              <div class="pi-skill-card">
                <div class="pi-skill-card__top">
                  <span class="pi-skill-card__icon">${icon}</span>
                  <span class="pi-skill-card__name">${_capitalize(skill)}</span>
                  <span class="pi-skill-card__sessions">${data.sessions} sessions</span>
                </div>
                <div class="pi-skill-card__score-row">
                  <span class="pi-skill-card__score" style="color:${cefrColor}">${pct}</span>
                  <span class="pi-skill-card__cefr">${_scoreToCEFR(pct)}</span>
                  <span class="pi-skill-trend pi-skill-trend--${data.trend}">
                    ${_trendIcon(data.trend)}
                  </span>
                </div>
                <div class="pi-skill-card__bar-track">
                  <div class="pi-skill-card__bar-fill"
                       style="width:${pct}%; background:${cefrColor}">
                  </div>
                </div>
                ${gap?.priority === 'high' ? `
                  <div class="pi-skill-card__gap-badge">↑ Priority focus</div>
                ` : ''}
              </div>`;
          }).join('')}
        </div>
      ` : `
        <div class="pi-empty-inline">No skill data yet — complete a full assessment.</div>
      `}

    </section>

    <!-- ══ SECTION 4: CEFR Roadmap ═══════════════════════════ -->
    <section class="pi-section pi-roadmap" aria-label="CEFR Roadmap">

      <div class="pi-section__header">
        <div class="pi-section__title-wrap">
          <span class="pi-section__eyebrow">Your Path</span>
          <h2 class="pi-section__title">CEFR Roadmap</h2>
        </div>
      </div>

      <div class="pi-roadmap__track">
        ${milestones.map((m, i) => {
          const isCurrent = m.level === currentLevel;
          const status    = m.reached ? 'reached' : isCurrent ? 'current' : 'future';
          const meta      = CEFR_META[m.level] ?? {};
          const detail    = m.reached
            ? 'Achieved ✓'
            : m.estimatedAt
              ? `Est. ${_formatDate(m.estimatedAt)}`
              : 'Keep practising';
          return `
            <div class="pi-roadmap__item pi-roadmap__item--${status}">
              <div class="pi-roadmap__dot" style="${m.reached || isCurrent ? `background:${meta.color};box-shadow:0 0 10px ${meta.color}44` : ''}">
                ${m.reached ? '✓' : m.level}
              </div>
              <div class="pi-roadmap__info">
                <div class="pi-roadmap__level">${m.level} <span>${meta.label ?? ''}</span></div>
                <div class="pi-roadmap__detail">${detail}</div>
              </div>
              <div class="pi-roadmap__target">${m.targetScore}</div>
              ${i < milestones.length - 1 ? '<div class="pi-roadmap__connector"></div>' : ''}
            </div>`;
        }).join('')}
      </div>

    </section>

    <!-- ══ SECTION 5: Study Plan ══════════════════════════════ -->
    <section class="pi-section pi-plan" aria-label="Adaptive Study Plan">

      <div class="pi-section__header">
        <div class="pi-section__title-wrap">
          <span class="pi-section__eyebrow">Personalised for You</span>
          <h2 class="pi-section__title">Study Plan</h2>
        </div>
      </div>

      <div class="pi-plan__grid">

        <div class="pi-plan-card pi-plan-card--sessions">
          <div class="pi-plan-card__icon">📅</div>
          <div class="pi-plan-card__value">${recommendation.sessionsPerWeek}×</div>
          <div class="pi-plan-card__label">Sessions per week</div>
          <div class="pi-plan-card__note">Recommended frequency</div>
        </div>

        <div class="pi-plan-card pi-plan-card--target">
          <div class="pi-plan-card__icon">🎯</div>
          <div class="pi-plan-card__value" style="color:${CEFR_META[targetLevel]?.color ?? 'var(--gold-pure)'}">
            ${targetLevel}
          </div>
          <div class="pi-plan-card__label">Target level</div>
          <div class="pi-plan-card__note">${CEFR_META[targetLevel]?.label ?? ''}</div>
        </div>

        ${recommendation.focusSkills.length > 0 ? `
          <div class="pi-plan-card pi-plan-card--focus">
            <div class="pi-plan-card__icon">⚡</div>
            <div class="pi-plan-card__value" style="font-size:1.25rem">
              ${recommendation.focusSkills[0]}
            </div>
            <div class="pi-plan-card__label">Priority skill</div>
            ${recommendation.focusSkills.length > 1 ? `
              <div class="pi-plan-card__note">Also: ${recommendation.focusSkills.slice(1).join(', ')}</div>
            ` : ''}
          </div>
        ` : ''}

      </div>

      <div class="pi-plan__next-action">
        <span class="pi-plan__next-label">Next action</span>
        <button class="btn btn--primary pi-plan__cta"
                onclick="window.NIREV?.navigateTo('assessment')">
          Start an Assessment →
        </button>
      </div>

    </section>

    <!-- ══ SECTION 6: Learning Insights ══════════════════════ -->
    <section class="pi-section pi-insights" aria-label="Learning Insights">

      <div class="pi-section__header">
        <div class="pi-section__title-wrap">
          <span class="pi-section__eyebrow">AI Analysis</span>
          <h2 class="pi-section__title">Learning Insights</h2>
        </div>
      </div>

      <div class="pi-insights__grid">

        ${_renderInsight('Trajectory', _trajectoryIcon(trajectory), trajectory,
            trajectory === 'improving'  ? 'Your scores are trending upward — keep going!' :
            trajectory === 'declining'  ? 'Scores are dipping — refocus and assess consistently.' :
                                          'Scores are stable — push for more frequent sessions.',
            trajectory === 'improving' ? 'positive' : trajectory === 'declining' ? 'negative' : 'neutral'
        )}

        ${_renderInsight('Consistency', '📊', `${summary.consistencyIndex ?? 0}%`,
            summary.consistencyIndex >= 70 ? 'Very consistent performance — excellent control.' :
            summary.consistencyIndex >= 40 ? 'Some variation — try to maintain steady effort.' :
                                             'High variation — focus on stable, repeated practice.',
            summary.consistencyIndex >= 70 ? 'positive' : summary.consistencyIndex >= 40 ? 'neutral' : 'negative'
        )}

        ${skillGaps.length > 0 ? _renderInsight(
            'Top Gap',
            SKILL_ICONS[skillGaps.sort((a,b) => b.gap - a.gap)[0]?.skill] ?? '⬡',
            _capitalize(skillGaps[0]?.skill ?? '—'),
            `Gap of ${skillGaps[0]?.gap ?? 0} points to next CEFR threshold — prioritise this skill.`,
            'negative'
        ) : ''}

        ${summary.totalSessions >= 10 ? _renderInsight(
            'Data Quality', '🧠', 'Strong',
            `${summary.totalSessions} sessions gives reliable predictions.`,
            'positive'
        ) : _renderInsight(
            'Data Quality', '🧠', `${summary.totalSessions}/10`,
            `${10 - (summary.totalSessions ?? 0)} more sessions needed for high-confidence forecasts.`,
            'neutral'
        )}

      </div>

    </section>

  `;
}

// ── Score Timeline ────────────────────────────────────────────

function _renderScoreTimeline(charts) {
  const { labels = [], values = [] } = charts.scoreLine ?? {};
  if (values.length === 0) return '';

  const max    = Math.max(...values, 100);
  const points = values.map((v, i) => {
    const x = (i / Math.max(values.length - 1, 1)) * 100;
    const y = 100 - (v / max) * 100;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(' ');

  // Forecast: last point projected one step ahead
  const regression = values.length >= 2
    ? _simpleLinearRegression(values)
    : null;
  const forecastY = regression
    ? Math.min(100, Math.max(0, regression.slope * values.length + regression.intercept))
    : null;
  const forecastPoint = forecastY !== null
    ? `100,${(100 - (forecastY / max) * 100).toFixed(1)}`
    : null;

  return `
    <div class="pi-timeline">
      <div class="pi-timeline__header">
        <span class="pi-timeline__label">Score History</span>
        ${forecastPoint ? '<span class="pi-timeline__forecast-label">— — Forecast</span>' : ''}
      </div>
      <div class="pi-timeline__chart" role="img" aria-label="Score history chart">
        <svg viewBox="0 0 100 60" preserveAspectRatio="none" class="pi-timeline__svg">
          <!-- Grid lines -->
          <line x1="0" y1="20" x2="100" y2="20" stroke="currentColor" stroke-opacity="0.06" stroke-width="0.5"/>
          <line x1="0" y1="40" x2="100" y2="40" stroke="currentColor" stroke-opacity="0.06" stroke-width="0.5"/>
          <line x1="0" y1="60" x2="100" y2="60" stroke="currentColor" stroke-opacity="0.06" stroke-width="0.5"/>

          <!-- Area fill -->
          <defs>
            <linearGradient id="scoreGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stop-color="var(--gold-pure)" stop-opacity="0.18"/>
              <stop offset="100%" stop-color="var(--gold-pure)" stop-opacity="0.01"/>
            </linearGradient>
          </defs>
          <polygon
            points="${points} 100,100 0,100"
            fill="url(#scoreGrad)"
          />

          <!-- Score line -->
          <polyline
            points="${points}"
            fill="none"
            stroke="var(--gold-pure)"
            stroke-width="1.5"
            stroke-linecap="round"
            stroke-linejoin="round"
          />

          <!-- Forecast line -->
          ${forecastPoint ? `
            <polyline
              points="${points.split(' ').pop()} ${forecastPoint}"
              fill="none"
              stroke="var(--orange-bright)"
              stroke-width="1"
              stroke-dasharray="2,2"
              stroke-linecap="round"
            />
          ` : ''}

          <!-- Data dots -->
          ${values.map((v, i) => {
            const x = (i / Math.max(values.length - 1, 1)) * 100;
            const y = 100 - (v / max) * 100;
            return `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="1.8" fill="var(--gold-pure)"/>`;
          }).join('')}
        </svg>

        <!-- Y labels -->
        <div class="pi-timeline__y-labels">
          <span>100</span><span>60</span><span>20</span>
        </div>
      </div>

      <!-- X labels (last 5 max) -->
      <div class="pi-timeline__x-labels">
        ${labels.slice(-5).map(l => `<span>${l}</span>`).join('')}
      </div>
    </div>
  `;
}

// ── Insight card ──────────────────────────────────────────────

function _renderInsight(title, icon, value, description, sentiment) {
  return `
    <div class="pi-insight-card pi-insight-card--${sentiment}">
      <div class="pi-insight-card__top">
        <span class="pi-insight-card__icon">${icon}</span>
        <span class="pi-insight-card__title">${title}</span>
      </div>
      <div class="pi-insight-card__value">${value}</div>
      <div class="pi-insight-card__desc">${description}</div>
    </div>
  `;
}

// ── Consistency ring (SVG) ────────────────────────────────────

function _consistencyRing(pct) {
  const r = 14; const c = 2 * Math.PI * r;
  const fill = (pct / 100) * c;
  const color = pct >= 70 ? 'var(--status-success)' : pct >= 40 ? 'var(--gold-pure)' : 'var(--status-danger)';
  return `
    <svg width="36" height="36" viewBox="0 0 36 36" class="pi-ring">
      <circle cx="18" cy="18" r="${r}" fill="none" stroke="currentColor" stroke-opacity="0.1" stroke-width="3"/>
      <circle cx="18" cy="18" r="${r}" fill="none" stroke="${color}" stroke-width="3"
              stroke-dasharray="${fill.toFixed(1)} ${c.toFixed(1)}"
              stroke-linecap="round"
              transform="rotate(-90 18 18)"/>
    </svg>`;
}

// ── Helpers ───────────────────────────────────────────────────

function _trajectoryIcon(t) {
  return t === 'improving' ? '↑' : t === 'declining' ? '↓' : '→';
}

function _trendIcon(t) {
  return t === 'improving' ? '↑' : t === 'declining' ? '↓' : '→';
}

function _confidenceIcon(label) {
  return label === 'high' ? '◆' : label === 'medium' ? '◇' : '○';
}

function _scoreToColor(score) {
  if (score >= 90) return CEFR_META.C2.color;
  if (score >= 80) return CEFR_META.C1.color;
  if (score >= 70) return CEFR_META.B2.color;
  if (score >= 55) return CEFR_META.B1.color;
  if (score >= 40) return CEFR_META.A2.color;
  return CEFR_META.A1.color;
}

function _scoreToCEFR(score) {
  if (score >= 90) return 'C2';
  if (score >= 80) return 'C1';
  if (score >= 70) return 'B2';
  if (score >= 55) return 'B1';
  if (score >= 40) return 'A2';
  return 'A1';
}

function _capitalize(str) {
  return str ? str.charAt(0).toUpperCase() + str.slice(1) : '';
}

function _formatDate(dateStr) {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function _simpleLinearRegression(values) {
  const n = values.length;
  const xs = values.map((_, i) => i);
  const meanX = (n - 1) / 2;
  const meanY = values.reduce((a, b) => a + b, 0) / n;
  const ssXX  = xs.reduce((s, x) => s + (x - meanX) ** 2, 0);
  const ssXY  = xs.reduce((s, x, i) => s + (x - meanX) * (values[i] - meanY), 0);
  const slope = ssXX === 0 ? 0 : ssXY / ssXX;
  return { slope, intercept: meanY - slope * meanX };
}

function _loadingHTML() {
  return `
    <div class="pi-loading">
      <div class="pi-loading__ring"></div>
      <div class="pi-loading__text">Calculating your intelligence profile…</div>
    </div>`;
}

function _emptyHTML() {
  return `
    <div class="pi-empty">
      <div class="pi-empty__icon">⬡</div>
      <div class="pi-empty__title">No progress data yet</div>
      <div class="pi-empty__text">Complete at least one assessment to unlock your Progress Dashboard.</div>
      <button class="btn btn--primary" onclick="window.NIREV?.navigateTo('assessment')">
        Start First Assessment
      </button>
    </div>`;
}

function _errorHTML() {
  return `
    <div class="pi-empty">
      <div class="pi-empty__icon">⚠</div>
      <div class="pi-empty__title">Couldn't load your data</div>
      <div class="pi-empty__text">Check your connection and try again.</div>
      <button class="btn btn--secondary" onclick="window.NIREV?.navigateTo('progress')">
        Retry
      </button>
    </div>`;
}
