/**
 * NIREV AI — Analytics Page Controller
 * ─────────────────────────────────────────────────────────────
 * Version: 3.0.0 — Phase 3
 *
 * Controls the Analytics page UI.
 * Reads from store.analytics and store.feedback.
 * Renders: summary stats, line chart, radar chart, skill breakdown,
 *          skill gaps, and AI feedback card.
 * ─────────────────────────────────────────────────────────────
 */

import store from './store.js';
import { getScores } from './db.js';
import { buildAnalyticsResult } from './domain/analytics/analytics-domain.js';
import { showToast } from './ui.js';

// ── Initialize ────────────────────────────────────────────────

let _analyticsInitialized = false;

export function initAnalyticsPage() {
  if (_analyticsInitialized) return;
  _analyticsInitialized = true;

  // Listen for analytics ready event
  document.addEventListener('nirev:analytics:ready', (e) => {
    _renderAnalytics(e.detail.analytics);
  });

  // Listen for feedback ready event
  document.addEventListener('nirev:feedback:ready', (e) => {
    _renderFeedback(e.detail.feedback);
  });

  // Listen for navigate to analytics
  document.addEventListener('nirev:navigate', (e) => {
    if (e.detail?.pageId === 'analytics') {
      _loadAndRender();
    }
  });
}

// ── Load and Render ───────────────────────────────────────────

async function _loadAndRender() {
  const userId = store.get('user')?.id;
  if (!userId) return;

  // Check if we have cached analytics
  const cached = store.get('analytics');
  if (cached?.loaded && cached?.full) {
    _renderAnalytics(cached.full);
    const feedback = store.get('feedback')?.lastFeedback;
    if (feedback) _renderFeedback(feedback);
    return;
  }

  // Load from DB
  const container = document.getElementById('analytics-content');
  if (container) container.innerHTML = _loadingHTML();

  try {
    const { data: scores, error } = await getScores(userId, { limit: 50 });
    if (error || !scores || scores.length === 0) {
      if (container) container.innerHTML = _emptyHTML();
      return;
    }

    const analytics = buildAnalyticsResult(scores);
    store.set('analytics', {
      loaded:        true,
      full:          analytics,
      scoresBySkill: analytics.bySkill,
      progressData:  analytics.charts?.scoreLine?.values ?? [],
    });
    _renderAnalytics(analytics);

    const feedback = store.get('feedback')?.lastFeedback;
    if (feedback) _renderFeedback(feedback);

  } catch (err) {
    showToast('Could not load analytics.', 'error');
  }
}

// ── Render Analytics ──────────────────────────────────────────

function _renderAnalytics(analytics) {
  const container = document.getElementById('analytics-content');
  if (!container || !analytics) return;

  const { summary, bySkill, charts, skillGaps } = analytics;

  container.innerHTML = `
    <!-- Summary Stats -->
    <div class="analytics-stats">
      <div class="stat-card stat-card--gold">
        <div class="stat-card__label">Total Assessments</div>
        <div class="stat-card__value" style="font-size:2rem">${summary.totalSessions}</div>
        <div class="stat-card__trend">All time</div>
      </div>
      <div class="stat-card stat-card--orange">
        <div class="stat-card__label">Average Score</div>
        <div class="stat-card__value" style="font-size:2rem">${Math.round(summary.averageScore)}</div>
        <div class="stat-card__trend">Out of 100</div>
      </div>
      <div class="stat-card stat-card--gold">
        <div class="stat-card__label">Best Score</div>
        <div class="stat-card__value" style="font-size:2rem">${summary.bestScore}</div>
        <div class="stat-card__trend">Personal best</div>
      </div>
      <div class="stat-card stat-card--orange">
        <div class="stat-card__label">CEFR Level</div>
        <div class="stat-card__value" style="font-size:2rem">${summary.currentCEFR}</div>
        <div class="stat-card__trend">
          <span class="trajectory-badge ${summary.trajectory}">${summary.trajectory}</span>
        </div>
      </div>
    </div>

    <!-- Charts -->
    <div class="charts-grid">
      <div class="chart-card">
        <div class="chart-card__title">Score History</div>
        <div class="chart-container" id="line-chart-container">
          ${charts.scoreLine.values.length > 0
            ? _buildLineChart(charts.scoreLine)
            : '<div style="display:flex;align-items:center;justify-content:center;height:100%;color:var(--white-muted);font-size:0.8rem;">Complete more assessments to see your progress</div>'
          }
        </div>
      </div>
      <div class="chart-card">
        <div class="chart-card__title">Skill Balance</div>
        <div class="radar-container" id="radar-chart-container">
          ${charts.skillRadar.labels.length > 1
            ? _buildRadarChart(charts.skillRadar)
            : '<div style="display:flex;align-items:center;justify-content:center;height:100%;color:var(--white-muted);font-size:0.8rem;text-align:center;">Complete assessments in multiple skills</div>'
          }
        </div>
      </div>
    </div>

    <!-- Skill Breakdown -->
    ${Object.keys(bySkill).length > 0 ? `
    <div class="card" style="margin-bottom:var(--space-5);">
      <div class="section-header">
        <h2 class="section-title">Performance by Skill</h2>
      </div>
      <div class="skill-breakdown">
        ${Object.entries(bySkill).map(([skill, data]) => `
          <div class="skill-row">
            <div class="skill-row__name">${skill}</div>
            <div class="skill-row__bar-wrap">
              <div class="skill-row__bar" style="width:${Math.round(data.average)}%"></div>
            </div>
            <div class="skill-row__score">${Math.round(data.average)}</div>
            <div class="skill-row__trend ${data.trend}">${data.trend} · ${data.sessions} sessions</div>
          </div>
        `).join('')}
      </div>
    </div>` : ''}

    <!-- Skill Gaps -->
    ${skillGaps.length > 0 ? `
    <div class="card skill-gaps">
      <div class="section-header">
        <h2 class="section-title">Areas to Improve</h2>
      </div>
      ${skillGaps.map(gap => `
        <div class="gap-item">
          <div>
            <div class="gap-item__skill">${gap.skill}</div>
            <div class="gap-item__detail">${Math.round(gap.current)} / ${gap.target} target · ${Math.round(gap.gap)} points to go</div>
          </div>
          <span class="gap-badge ${gap.priority}">${gap.priority}</span>
        </div>
      `).join('')}
    </div>` : ''}

    <!-- Feedback placeholder -->
    <div id="feedback-container"></div>
  `;
}

// ── Render Feedback ───────────────────────────────────────────

function _renderFeedback(feedback) {
  const container = document.getElementById('feedback-container');
  if (!container || !feedback) return;

  const { sections, cefrComment, nextSteps, tone } = feedback;
  const toneColors = { encouraging: 'var(--status-success)', neutral: 'var(--gold-pure)', challenging: 'var(--orange-core)' };

  container.innerHTML = `
    <div class="feedback-card" style="margin-top:var(--space-5);">
      <div class="feedback-card__header">
        <span style="font-size:1.25rem">✦</span>
        <div class="feedback-card__title">AI Feedback</div>
        <span class="badge badge--gold" style="margin-left:auto;text-transform:capitalize;">${tone}</span>
      </div>

      ${sections.summary ? `
      <div class="feedback-section">
        <div class="feedback-section__label">Overall Summary</div>
        <div class="feedback-section__summary">${sections.summary}</div>
        ${cefrComment ? `<div class="feedback-section__summary" style="margin-top:var(--space-3);color:var(--gold-bright)">${cefrComment}</div>` : ''}
      </div>` : ''}

      <div style="display:grid;grid-template-columns:1fr 1fr;gap:var(--space-5);margin-bottom:var(--space-5);">
        ${sections.strengths?.length ? `
        <div class="feedback-section">
          <div class="feedback-section__label">Strengths</div>
          <div class="feedback-list">
            ${sections.strengths.map(s => `
              <div class="feedback-list__item">
                <span class="feedback-list__bullet green"></span>
                <span>${s}</span>
              </div>`).join('')}
          </div>
        </div>` : ''}

        ${sections.weaknesses?.length ? `
        <div class="feedback-section">
          <div class="feedback-section__label">Areas to Improve</div>
          <div class="feedback-list">
            ${sections.weaknesses.map(w => `
              <div class="feedback-list__item">
                <span class="feedback-list__bullet red"></span>
                <span>${w}</span>
              </div>`).join('')}
          </div>
        </div>` : ''}
      </div>

      ${sections.tips?.length ? `
      <div class="feedback-section">
        <div class="feedback-section__label">Tips for Improvement</div>
        <div class="feedback-list">
          ${sections.tips.map(t => `
            <div class="feedback-list__item">
              <span class="feedback-list__bullet gold"></span>
              <span>${t}</span>
            </div>`).join('')}
        </div>
      </div>` : ''}

      ${nextSteps?.length ? `
      <div class="feedback-section" style="margin-bottom:0">
        <div class="feedback-section__label">Next Steps</div>
        <div class="feedback-list">
          ${nextSteps.map(n => `
            <div class="feedback-list__item">
              <span class="feedback-list__bullet orange"></span>
              <span>${n}</span>
            </div>`).join('')}
        </div>
      </div>` : ''}
    </div>
  `;
}

// ── Chart Builders ────────────────────────────────────────────

function _buildLineChart(data) {
  const { labels, values } = data;
  if (!values.length) return '';

  const W = 600, H = 180, pad = { top: 20, right: 20, bottom: 30, left: 40 };
  const innerW = W - pad.left - pad.right;
  const innerH = H - pad.top - pad.bottom;

  const minV = Math.max(0, Math.min(...values) - 10);
  const maxV = Math.min(100, Math.max(...values) + 10);
  const xStep = innerW / Math.max(values.length - 1, 1);

  const pts = values.map((v, i) => {
    const x = pad.left + i * xStep;
    const y = pad.top + innerH - ((v - minV) / (maxV - minV || 1)) * innerH;
    return { x, y, v };
  });

  const linePath = pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
  const areaPath = `${linePath} L ${pts[pts.length-1].x} ${pad.top + innerH} L ${pts[0].x} ${pad.top + innerH} Z`;

  // Grid lines
  const gridLines = [0, 25, 50, 75, 100].map(v => {
    if (v < minV || v > maxV) return '';
    const y = pad.top + innerH - ((v - minV) / (maxV - minV || 1)) * innerH;
    return `
      <line class="chart-grid-line" x1="${pad.left}" y1="${y}" x2="${pad.left + innerW}" y2="${y}"/>
      <text class="chart-label" x="${pad.left - 5}" y="${y + 4}" text-anchor="end">${v}</text>`;
  }).join('');

  // X labels
  const xLabels = labels.map((l, i) => {
    if (labels.length > 8 && i % 2 !== 0) return '';
    const x = pad.left + i * xStep;
    return `<text class="chart-label" x="${x}" y="${pad.top + innerH + 18}" text-anchor="middle">${l}</text>`;
  }).join('');

  return `
    <svg class="chart-svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid meet">
      <defs>
        <linearGradient id="gold-gradient" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#D4AF37" stop-opacity="0.4"/>
          <stop offset="100%" stop-color="#D4AF37" stop-opacity="0"/>
        </linearGradient>
      </defs>
      ${gridLines}
      ${xLabels}
      <path class="chart-area" d="${areaPath}"/>
      <path class="chart-line" d="${linePath}"/>
      ${pts.map(p => `<circle class="chart-dot" cx="${p.x}" cy="${p.y}" r="3">
        <title>${p.v}/100</title>
      </circle>`).join('')}
    </svg>`;
}

function _buildRadarChart(data) {
  const { labels, values } = data;
  if (labels.length < 2) return '';

  const CX = 120, CY = 100, R = 75;
  const n     = labels.length;
  const angle = (i) => (i * 2 * Math.PI / n) - Math.PI / 2;

  // Background rings
  const rings = [0.25, 0.5, 0.75, 1].map(r => {
    const pts = Array.from({ length: n }, (_, i) => {
      const a = angle(i);
      return `${CX + R * r * Math.cos(a)},${CY + R * r * Math.sin(a)}`;
    }).join(' ');
    return `<polygon class="radar-bg" points="${pts}"/>`;
  }).join('');

  // Axes
  const axes = Array.from({ length: n }, (_, i) => {
    const a = angle(i);
    return `<line class="radar-bg" x1="${CX}" y1="${CY}" x2="${CX + R * Math.cos(a)}" y2="${CY + R * Math.sin(a)}"/>`;
  }).join('');

  // Data polygon
  const dataPoints = values.map((v, i) => {
    const a = angle(i);
    const r = (v / 100) * R;
    return `${CX + r * Math.cos(a)},${CY + r * Math.sin(a)}`;
  }).join(' ');

  // Labels
  const lbls = labels.map((l, i) => {
    const a = angle(i);
    const x = CX + (R + 16) * Math.cos(a);
    const y = CY + (R + 16) * Math.sin(a);
    return `<text class="radar-label" x="${x}" y="${y + 4}">${l}</text>`;
  }).join('');

  // Dots
  const dots = values.map((v, i) => {
    const a = angle(i);
    const r = (v / 100) * R;
    return `<circle class="radar-dot" cx="${CX + r * Math.cos(a)}" cy="${CY + r * Math.sin(a)}" r="3"/>`;
  }).join('');

  return `
    <svg class="radar-svg" viewBox="0 0 240 200" preserveAspectRatio="xMidYMid meet">
      ${rings}${axes}
      <polygon class="radar-area" points="${dataPoints}"/>
      ${dots}${lbls}
    </svg>`;
}

// ── Utility HTML ──────────────────────────────────────────────

function _loadingHTML() {
  return `
    <div class="assessment-loading">
      <div class="assessment-loading__ring"></div>
      <div class="assessment-loading__text">Loading analytics...</div>
    </div>`;
}

function _emptyHTML() {
  return `
    <div class="analytics-empty">
      <div class="empty-state__icon">◈</div>
      <div class="empty-state__title">No data yet</div>
      <div class="empty-state__text">Complete your first assessment to see your analytics.</div>
      <button class="btn btn--primary" onclick="window.NIREV.navigateTo('assessment')">Start Assessment</button>
    </div>`;
}
