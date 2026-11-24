/**
 * NIREV AI — Progress & Intelligence Dashboard
 * ─────────────────────────────────────────────────────────────
 * Version: 6.0.0 — Modern report layout
 *
 * Renders the Progress & Predictions page.
 * Reads from store.analytics and store.predictions.
 * All data comes from real assessment scores — nothing invented.
 * ─────────────────────────────────────────────────────────────
 */

import store from './store.js';
import { getScores } from './db.js';
import { buildAnalyticsResult } from './domain/analytics/analytics-domain.js';
import { buildPredictionResult } from './domain/predictions/prediction-domain.js';

// ── Display constants ─────────────────────────────────────────

const CEFR_LABEL = {
  A1: 'Beginner', A2: 'Elementary', B1: 'Intermediate',
  B2: 'Upper-Intermediate', C1: 'Advanced', C2: 'Proficiency',
};

const SKILL_ICON = {
  vocabulary: 'book', grammar: 'pen', reading: 'read',
  listening: 'headset', speaking: 'mic', writing: 'pen', general: 'grid',
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
//
// Presentation only. Every number below comes from the prediction /
// analytics results (real assessment scores). Nothing is invented.

function _renderDashboard(prediction, analytics) {
  const container = document.getElementById('progress-content');
  if (!container) return;

  const {
    currentLevel, targetLevel, estimatedDays, estimatedDate,
    confidenceScore, confidenceLabel, trajectory,
    milestones = [], recommendation = { sessionsPerWeek: 3, focusSkills: [], message: '' },
  } = prediction;

  const summary   = analytics?.summary   ?? {};
  const bySkill   = analytics?.bySkill   ?? {};
  const skillGaps = analytics?.skillGaps ?? [];
  const charts    = analytics?.charts    ?? {};

  const avg      = Math.round(summary.averageScore ?? 0);
  const curMs    = milestones.find(m => m.level === currentLevel);
  const target   = curMs?.targetScore ?? null;               // score needed to leave the current level
  const toGo     = target !== null ? Math.max(0, Math.round(target - (summary.averageScore ?? 0))) : null;
  const topGap   = [...skillGaps].sort((a, b) => b.gap - a.gap)[0] ?? null;
  const sessions = summary.totalSessions ?? 0;
  const consist  = summary.consistencyIndex ?? 0;

  container.innerHTML = `

    <!-- ══ 1. Intelligence Overview ═══════════════════════════ -->
    <section class="pi-section pi-overview" aria-label="Intelligence overview">
      <div class="pi-gauge-card">
        <div class="pi-gauge" role="img" aria-label="Average score ${avg} out of 100, level ${currentLevel}">
          ${_gaugeSVG(avg)}
          <div class="pi-gauge__center">
            <span class="pi-gauge__level">${currentLevel}</span>
            <span class="pi-gauge__label">${CEFR_LABEL[currentLevel] ?? ''}</span>
          </div>
        </div>
        <div class="pi-gauge-card__meta">
          <div class="pi-eyebrow">Current level</div>
          <div class="pi-gauge-card__score"><strong>${avg}</strong><span>/100 average</span></div>
          ${target !== null && targetLevel !== currentLevel ? `
            <div class="pi-gauge-card__next">
              <span class="pi-chip pi-chip--gold">Next · ${targetLevel}</span>
              <span class="pi-gauge-card__next-text">${toGo > 0 ? `${toGo} pts to reach ${target}` : `Target ${target} reached`}</span>
            </div>` : `
            <div class="pi-gauge-card__next">
              <span class="pi-chip pi-chip--gold">Top level</span>
            </div>`}
        </div>
      </div>

      <div class="pi-stats">
        ${_stat('layers',  'Assessments', sessions,                 'completed sessions')}
        ${_stat('trophy',  'Best score',  summary.bestScore ?? '—', `average ${avg}`)}
        ${_stat('pulse',   'Consistency', `${consist}<small>%</small>`, 'score stability', _meter(consist))}
        ${_stat(_trendName(trajectory), 'Trend', `<span class="pi-trend pi-trend--${trajectory}">${_cap(trajectory)}</span>`, 'across your sessions')}
      </div>
    </section>

    <!-- ══ 2. AI Prediction ═══════════════════════════════════ -->
    <section class="pi-section pi-forecast" aria-label="AI prediction">
      <header class="pi-section__header">
        <div>
          <div class="pi-eyebrow">AI prediction engine</div>
          <h2 class="pi-section__title">Level forecast</h2>
        </div>
        <span class="pi-confidence pi-confidence--${confidenceLabel}">
          <span class="pi-confidence__dot"></span>${_cap(confidenceLabel)} confidence · ${confidenceScore}%
        </span>
      </header>

      <div class="pi-forecast__grid">
        <div class="pi-forecast__path">
          <div class="pi-path">
            <span class="pi-path__from">${currentLevel}</span>
            <span class="pi-path__arrow">${_icon('arrow', 28)}</span>
            <span class="pi-path__to">${targetLevel}</span>
          </div>
          ${estimatedDays ? `
            <div class="pi-forecast__facts">
              <div><strong>${estimatedDays}</strong><span>days to ${targetLevel}</span></div>
              ${estimatedDate ? `<div><strong>${_formatDate(estimatedDate)}</strong><span>estimated date</span></div>` : ''}
            </div>` : `
            <div class="pi-forecast__empty">
              ${trajectory === 'declining'
                ? 'Scores are declining — assess more consistently to unlock a forecast.'
                : 'Complete more assessments to unlock your forecast.'}
            </div>`}
        </div>

        <div class="pi-forecast__confidence">
          <div class="pi-eyebrow">Forecast reliability</div>
          <div class="pi-bar pi-bar--lg"><span style="width:${Math.min(100, confidenceScore)}%"></span></div>
          <p>${confidenceLabel === 'high'
              ? 'Based on enough sessions for a dependable estimate.'
              : confidenceLabel === 'medium'
                ? 'Improves as you complete more sessions.'
                : 'Too few sessions so far — treat this as a rough guide.'}</p>
        </div>
      </div>

      ${recommendation.message ? `<div class="pi-callout">${_icon('spark', 18)}<p>${_esc(recommendation.message)}</p></div>` : ''}
    </section>

    <!-- ══ 3. Score trend ═════════════════════════════════════ -->
    ${_renderTrend(charts, target, targetLevel)}

    <!-- ══ 4. Skill Intelligence ══════════════════════════════ -->
    <section class="pi-section pi-skills" aria-label="Skill intelligence">
      <header class="pi-section__header">
        <div>
          <div class="pi-eyebrow">Skill breakdown</div>
          <h2 class="pi-section__title">Skill intelligence</h2>
        </div>
      </header>

      ${Object.keys(bySkill).length > 0 ? `
        <div class="pi-skills__layout ${Object.keys(bySkill).length >= 3 ? 'has-radar' : ''}">
          ${Object.keys(bySkill).length >= 3 ? `<div class="pi-radar">${_radarSVG(charts.skillRadar)}</div>` : ''}
          <ul class="pi-skill-list">
            ${Object.entries(bySkill).map(([skill, d]) => _skillRow(skill, d, skillGaps.find(g => g.skill === skill))).join('')}
          </ul>
        </div>` : `<div class="pi-empty-inline">No skill data yet — complete a full assessment.</div>`}
    </section>

    <!-- ══ 5. CEFR Roadmap ════════════════════════════════════ -->
    <section class="pi-section pi-roadmap" aria-label="CEFR roadmap">
      <header class="pi-section__header">
        <div>
          <div class="pi-eyebrow">Your path</div>
          <h2 class="pi-section__title">CEFR roadmap</h2>
        </div>
      </header>
      ${_roadmap(milestones, currentLevel)}
    </section>

    <!-- ══ 6. Adaptive Study Plan ═════════════════════════════ -->
    <section class="pi-section pi-plan" aria-label="Adaptive study plan">
      <header class="pi-section__header">
        <div>
          <div class="pi-eyebrow">Personalised for you</div>
          <h2 class="pi-section__title">Study plan</h2>
        </div>
      </header>

      <div class="pi-plan__grid">
        <div class="pi-plan-tile">
          <span class="pi-plan-tile__icon">${_icon('calendar', 20)}</span>
          <strong>${recommendation.sessionsPerWeek}×<small> / week</small></strong>
          <span>Recommended sessions</span>
        </div>
        <div class="pi-plan-tile">
          <span class="pi-plan-tile__icon">${_icon('target', 20)}</span>
          <strong>${targetLevel}</strong>
          <span>Target level · ${CEFR_LABEL[targetLevel] ?? ''}</span>
        </div>
        <div class="pi-plan-tile pi-plan-tile--focus">
          <span class="pi-plan-tile__icon">${_icon('bolt', 20)}</span>
          ${recommendation.focusSkills.length > 0 ? `
            <div class="pi-chips">${recommendation.focusSkills.map(s => `<span class="pi-chip pi-chip--orange">${_cap(s)}</span>`).join('')}</div>
            <span>Priority skills</span>` : `
            <strong>—</strong><span>No priority skill yet</span>`}
        </div>
      </div>

      <div class="pi-plan__cta">
        <p>Ready for your next session? Practice your priority skills to move toward ${targetLevel}.</p>
        <button class="btn btn--primary pi-plan__btn" onclick="window.NIREV?.navigateTo('assessment')">
          Start an assessment ${_icon('arrow', 16)}
        </button>
      </div>
    </section>

    <!-- ══ 7. Learning Insights ═══════════════════════════════ -->
    <section class="pi-section pi-insights" aria-label="Learning insights">
      <header class="pi-section__header">
        <div>
          <div class="pi-eyebrow">AI analysis</div>
          <h2 class="pi-section__title">Learning insights</h2>
        </div>
      </header>

      <div class="pi-insights__grid">
        ${_insight('Trajectory', _trendName(trajectory), _cap(trajectory),
            trajectory === 'improving' ? 'Your scores are trending upward — keep the momentum.' :
            trajectory === 'declining' ? 'Scores are dipping — refocus and assess consistently.' :
                                         'Scores are stable — more frequent sessions will move the needle.',
            trajectory === 'improving' ? 'positive' : trajectory === 'declining' ? 'negative' : 'neutral')}

        ${_insight('Consistency', 'pulse', `${consist}%`,
            consist >= 70 ? 'Very consistent performance — excellent control.' :
            consist >= 40 ? 'Some variation — aim for steady effort between sessions.' :
                            'High variation — repeated, regular practice will stabilise your scores.',
            consist >= 70 ? 'positive' : consist >= 40 ? 'neutral' : 'negative')}

        ${topGap ? _insight('Biggest gap', 'target', _cap(topGap.skill),
            `${topGap.gap} points to the next CEFR threshold — prioritise this skill.`, 'negative') : ''}

        ${sessions >= 10
          ? _insight('Data quality', 'brain', 'Strong', `${sessions} sessions give reliable predictions.`, 'positive')
          : _insight('Data quality', 'brain', `${sessions}/10`, `${10 - sessions} more sessions needed for high-confidence forecasts.`, 'neutral')}
      </div>
    </section>
  `;
}

// ── Pieces ────────────────────────────────────────────────────

function _stat(icon, label, value, sub, extra = '') {
  return `
    <div class="pi-stat">
      <div class="pi-stat__top"><span class="pi-stat__icon">${_icon(icon, 18)}</span><span class="pi-eyebrow">${label}</span></div>
      <div class="pi-stat__value">${value}</div>
      <div class="pi-stat__sub">${sub}</div>
      ${extra}
    </div>`;
}

function _meter(pct) {
  return `<div class="pi-bar"><span style="width:${Math.max(0, Math.min(100, pct))}%"></span></div>`;
}

function _insight(title, icon, value, desc, sentiment) {
  return `
    <div class="pi-insight pi-insight--${sentiment}">
      <span class="pi-insight__icon">${_icon(icon, 20)}</span>
      <div class="pi-insight__body">
        <div class="pi-eyebrow">${title}</div>
        <div class="pi-insight__value">${value}</div>
        <p>${desc}</p>
      </div>
    </div>`;
}

function _skillRow(skill, d, gap) {
  const pct = Math.max(0, Math.min(100, Math.round(d.average ?? 0)));
  return `
    <li class="pi-skill">
      <span class="pi-skill__icon">${_icon(SKILL_ICON[skill] ?? 'grid', 18)}</span>
      <div class="pi-skill__main">
        <div class="pi-skill__head">
          <span class="pi-skill__name">${_cap(skill)}</span>
          <span class="pi-skill__meta">${d.sessions} ${d.sessions === 1 ? 'session' : 'sessions'}</span>
          <span class="pi-trend pi-trend--${d.trend}" title="${_cap(d.trend)}">${_icon(_trendName(d.trend), 14)}</span>
        </div>
        <div class="pi-bar"><span style="width:${pct}%"></span></div>
        ${gap?.priority === 'high'
          ? `<span class="pi-skill__flag">Priority focus · ${gap.gap} pts to next level</span>`
          : gap && gap.gap > 0 ? `<span class="pi-skill__gap">${gap.gap} pts to next level</span>` : ''}
      </div>
      <div class="pi-skill__score"><strong>${pct}</strong><span class="pi-chip">${_scoreToCEFR(pct)}</span></div>
    </li>`;
}

function _roadmap(milestones, currentLevel) {
  if (!milestones.length) return '';
  const idx = Math.max(0, milestones.findIndex(m => m.level === currentLevel));
  const fill = milestones.length > 1 ? (idx / (milestones.length - 1)) * 100 : 0;
  return `
    <ol class="pi-road" style="--pi-fill:${fill}%">
      ${milestones.map((m) => {
        const status = m.reached ? 'reached' : m.level === currentLevel ? 'current' : 'future';
        const note = m.reached ? 'Achieved' : m.estimatedAt ? `Est. ${_formatDate(m.estimatedAt)}` : (status === 'current' ? 'In progress' : 'Keep practising');
        return `
          <li class="pi-road__step pi-road__step--${status}">
            <span class="pi-road__dot">${m.reached ? _icon('check', 16) : m.level}</span>
            <div class="pi-road__text">
              <strong>${m.level}<em>${CEFR_LABEL[m.level] ?? ''}</em></strong>
              <span>${note}</span>
              <small>Score ${m.targetScore}+</small>
            </div>
          </li>`;
      }).join('')}
    </ol>`;
}

// ── Score trend chart (HTML + SVG, no distortion) ─────────────

function _renderTrend(charts, target, targetLevel) {
  const raw    = charts.scoreLine?.values ?? [];
  const rawLab = charts.scoreLine?.labels ?? [];
  if (raw.length === 0) return '';

  // Scores arrive newest-first; show them oldest → newest (left → right).
  const vals = [...raw].reverse();
  const labs = [...rawLab].reverse();
  const n    = vals.length;
  const x    = (i) => n === 1 ? 50 : (i / (n - 1)) * 100;
  const y    = (v) => 100 - Math.max(0, Math.min(100, v));

  const line = vals.map((v, i) => `${x(i).toFixed(2)},${y(v).toFixed(2)}`).join(' ');
  const area = `0,100 ${line} 100,100`.replace('0,100', `${x(0).toFixed(2)},100`).replace(/ 100,100$/, ` ${x(n - 1).toFixed(2)},100`);

  const latest = vals[n - 1];
  const best   = Math.max(...vals);
  const mean   = Math.round(vals.reduce((a, b) => a + b, 0) / n);
  const showDots = n <= 24;

  // ~5 evenly spaced x labels
  const step = Math.max(1, Math.ceil((n - 1) / 4));
  const ticks = [];
  for (let i = 0; i < n; i += step) ticks.push(i);
  if (ticks[ticks.length - 1] !== n - 1) ticks.push(n - 1);

  return `
    <section class="pi-section pi-trend-card" aria-label="Score trend">
      <header class="pi-section__header">
        <div>
          <div class="pi-eyebrow">Score history</div>
          <h2 class="pi-section__title">Score trend</h2>
        </div>
        <div class="pi-trend-card__chips">
          <span class="pi-chip">Latest ${latest}</span>
          <span class="pi-chip">Avg ${mean}</span>
          <span class="pi-chip pi-chip--gold">Best ${best}</span>
        </div>
      </header>

      <div class="pi-chart" role="img" aria-label="Score history across ${n} sessions, latest ${latest} out of 100">
        <div class="pi-chart__yaxis">${[100, 75, 50, 25, 0].map(v => `<span style="top:${100 - v}%">${v}</span>`).join('')}</div>
        <div class="pi-chart__plot">
          ${[0, 25, 50, 75, 100].map(v => `<i class="pi-chart__grid" style="top:${100 - v}%"></i>`).join('')}
          ${target !== null ? `<i class="pi-chart__target" style="top:${y(target)}%"><b>${targetLevel} target · ${target}</b></i>` : ''}
          <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
            <defs>
              <linearGradient id="pi-area" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%"   style="stop-color:var(--gold-pure);stop-opacity:.32"/>
                <stop offset="100%" style="stop-color:var(--gold-pure);stop-opacity:0"/>
              </linearGradient>
              <linearGradient id="pi-line" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%"   style="stop-color:var(--gold-pure)"/>
                <stop offset="100%" style="stop-color:var(--orange-core)"/>
              </linearGradient>
            </defs>
            ${n > 1 ? `<polygon points="${area}" fill="url(#pi-area)"/>
            <polyline points="${line}" fill="none" stroke="url(#pi-line)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" vector-effect="non-scaling-stroke"/>` : ''}
          </svg>
          ${vals.map((v, i) => (showDots || i === n - 1) ? `
            <span class="pi-chart__dot ${i === n - 1 ? 'is-last' : ''}" style="left:${x(i)}%;top:${y(v)}%" title="${_esc(labs[i] ?? '')}: ${v}"></span>` : '').join('')}
          <span class="pi-chart__tag" style="left:${x(n - 1)}%;top:${y(latest)}%">${latest}</span>
        </div>
        <div class="pi-chart__xaxis">${ticks.map(i => `<span style="left:${x(i)}%">${_esc(labs[i] ?? '')}</span>`).join('')}</div>
      </div>
    </section>`;
}

// ── SVG builders ──────────────────────────────────────────────

function _gaugeSVG(pct) {
  const r = 78, c = 2 * Math.PI * r, p = Math.max(0, Math.min(100, pct));
  return `
    <svg viewBox="0 0 200 200" aria-hidden="true">
      <defs>
        <linearGradient id="pi-gauge-g" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%"   style="stop-color:var(--gold-pure)"/>
          <stop offset="100%" style="stop-color:var(--orange-core)"/>
        </linearGradient>
      </defs>
      <circle cx="100" cy="100" r="${r}" class="pi-gauge__track" fill="none" stroke-width="14"/>
      <circle cx="100" cy="100" r="${r}" fill="none" stroke="url(#pi-gauge-g)" stroke-width="14" stroke-linecap="round"
              stroke-dasharray="${(c * p / 100).toFixed(1)} ${c.toFixed(1)}" transform="rotate(-90 100 100)"/>
    </svg>`;
}

function _radarSVG(radar) {
  const labels = radar?.labels ?? [], values = radar?.values ?? [];
  const n = labels.length;
  if (n < 3) return '';
  const cx = 200, cy = 158, R = 100;
  const pt = (i, f) => {
    const a = -Math.PI / 2 + (i * 2 * Math.PI) / n;
    return [cx + Math.cos(a) * R * f, cy + Math.sin(a) * R * f];
  };
  const poly = (f) => Array.from({ length: n }, (_, i) => pt(i, f).map(v => v.toFixed(1)).join(',')).join(' ');
  const data = values.map((v, i) => pt(i, Math.max(0, Math.min(100, v)) / 100).map(q => q.toFixed(1)).join(',')).join(' ');
  return `
    <svg viewBox="0 0 400 316" role="img" aria-label="Skill radar chart">
      <defs>
        <linearGradient id="pi-radar-g" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%"   style="stop-color:var(--gold-pure);stop-opacity:.5"/>
          <stop offset="100%" style="stop-color:var(--orange-core);stop-opacity:.35"/>
        </linearGradient>
      </defs>
      ${[0.25, 0.5, 0.75, 1].map(f => `<polygon points="${poly(f)}" class="pi-radar__ring"/>`).join('')}
      ${labels.map((_, i) => { const [px, py] = pt(i, 1); return `<line x1="${cx}" y1="${cy}" x2="${px.toFixed(1)}" y2="${py.toFixed(1)}" class="pi-radar__axis"/>`; }).join('')}
      <polygon points="${data}" fill="url(#pi-radar-g)" class="pi-radar__shape"/>
      ${values.map((v, i) => { const [px, py] = pt(i, Math.max(0, Math.min(100, v)) / 100); return `<circle cx="${px.toFixed(1)}" cy="${py.toFixed(1)}" r="4" class="pi-radar__pt"/>`; }).join('')}
      ${labels.map((l, i) => {
        const [px, py] = pt(i, 1.2);
        const anchor = Math.abs(px - cx) < 8 ? 'middle' : px > cx ? 'start' : 'end';
        return `<text x="${px.toFixed(1)}" y="${(py + 4).toFixed(1)}" text-anchor="${anchor}" class="pi-radar__label">${_esc(l)}</text>`;
      }).join('')}
    </svg>`;
}

// ── Icons (inline SVG, stroke = currentColor) ─────────────────

const ICONS = {
  layers:  '<path d="M12 3 3 8l9 5 9-5-9-5Z"/><path d="m3 13 9 5 9-5"/>',
  trophy:  '<path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0V4Z"/><path d="M17 5h3v2a3 3 0 0 1-3 3M7 5H4v2a3 3 0 0 0 3 3"/>',
  pulse:   '<path d="M3 12h4l2-6 4 12 2-6h6"/>',
  up:      '<path d="m3 17 6-6 4 4 8-8"/><path d="M15 7h6v6"/>',
  down:    '<path d="m3 7 6 6 4-4 8 8"/><path d="M15 17h6v-6"/>',
  flat:    '<path d="M4 12h16"/><path d="m15 7 5 5-5 5"/>',
  arrow:   '<path d="M5 12h14"/><path d="m13 6 6 6-6 6"/>',
  spark:   '<path d="M12 3v4M12 17v4M3 12h4M17 12h4"/><path d="m6.5 6.5 2.5 2.5M15 15l2.5 2.5M17.5 6.5 15 9M9 15l-2.5 2.5"/>',
  calendar:'<rect x="3" y="5" width="18" height="16" rx="3"/><path d="M8 3v4M16 3v4M3 10h18"/>',
  target:  '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.2"/>',
  bolt:    '<path d="M13 2 4 14h7l-1 8 9-12h-7l1-8Z"/>',
  brain:   '<path d="M9 4a3 3 0 0 0-3 3 3 3 0 0 0-2 5 3 3 0 0 0 2 5 3 3 0 0 0 6 1V5a2 2 0 0 0-3-1Z"/><path d="M15 4a3 3 0 0 1 3 3 3 3 0 0 1 2 5 3 3 0 0 1-2 5 3 3 0 0 1-6 1V5a2 2 0 0 1 3-1Z"/>',
  check:   '<path d="m5 12 5 5 9-10"/>',
  book:    '<path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2V5Z"/><path d="M8 7h7"/>',
  pen:     '<path d="m4 20 1-4L16 5l3 3L8 19l-4 1Z"/><path d="m14 7 3 3"/>',
  read:    '<path d="M2 5h7a3 3 0 0 1 3 3v12a2 2 0 0 0-2-2H2V5Z"/><path d="M22 5h-7a3 3 0 0 0-3 3v12a2 2 0 0 1 2-2h8V5Z"/>',
  headset: '<path d="M4 15v-3a8 8 0 0 1 16 0v3"/><rect x="3" y="14" width="4" height="6" rx="2"/><rect x="17" y="14" width="4" height="6" rx="2"/>',
  mic:     '<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/>',
  grid:    '<rect x="4" y="4" width="7" height="7" rx="1.5"/><rect x="13" y="4" width="7" height="7" rx="1.5"/><rect x="4" y="13" width="7" height="7" rx="1.5"/><rect x="13" y="13" width="7" height="7" rx="1.5"/>',
};

function _icon(name, size = 20) {
  return `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name] ?? ICONS.grid}</svg>`;
}

// ── Helpers ───────────────────────────────────────────────────

function _trendName(t) {
  return t === 'improving' ? 'up' : t === 'declining' ? 'down' : 'flat';
}

function _scoreToCEFR(score) {
  if (score >= 90) return 'C2';
  if (score >= 80) return 'C1';
  if (score >= 70) return 'B2';
  if (score >= 55) return 'B1';
  if (score >= 40) return 'A2';
  return 'A1';
}

function _cap(str) {
  return str ? String(str).charAt(0).toUpperCase() + String(str).slice(1) : '';
}

function _esc(str) {
  return String(str ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
}

function _formatDate(dateStr) {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

// ── States ────────────────────────────────────────────────────

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
      <div class="pi-empty__icon">${_icon('layers', 34)}</div>
      <div class="pi-empty__title">No progress data yet</div>
      <div class="pi-empty__text">Complete at least one assessment to unlock your Progress Dashboard.</div>
      <button class="btn btn--primary" onclick="window.NIREV?.navigateTo('assessment')">
        Start first assessment
      </button>
    </div>`;
}

function _errorHTML() {
  return `
    <div class="pi-empty">
      <div class="pi-empty__icon">${_icon('pulse', 34)}</div>
      <div class="pi-empty__title">Couldn't load your data</div>
      <div class="pi-empty__text">Check your connection and try again.</div>
      <button class="btn btn--secondary" onclick="window.NIREV?.navigateTo('progress')">
        Retry
      </button>
    </div>`;
}
