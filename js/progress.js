/**
 * NIREV AI — Progress Page Controller
 * ─────────────────────────────────────────────────────────────
 * Version: 4.0.0 — Phase 4
 *
 * Controls the Progress page UI. 
 * Reads from store.analytics and store.predictions.
 * Renders: prediction hero, recommendations, milestone timeline.
 * ─────────────────────────────────────────────────────────────
 */

import store from './store.js';
import { getScores } from './db.js';
import { buildAnalyticsResult } from './domain/analytics/analytics-domain.js';
import { buildPredictionResult } from './domain/predictions/prediction-domain.js';

// ── Initialize ────────────────────────────────────────────────

export function initProgressPage() {
  // Listen for analytics ready — trigger prediction
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

  // Listen for navigate to progress
  document.addEventListener('nirev:navigate', (e) => {
    if (e.detail?.pageId === 'progress') {
      _loadAndRender();
    }
  });
}

// ── Load and Render ───────────────────────────────────────────

async function _loadAndRender() {
  const userId = store.get('user')?.id;
  if (!userId) return;

  const container = document.getElementById('progress-content');
  if (!container) return;

  // Check cached prediction
  const cached = store.get('predictions');
  if (cached?.full) {
    _renderProgress(cached.full);
    return;
  }

  // Check cached analytics
  const analytics = store.get('analytics')?.full;
  if (analytics) {
    const prediction = buildPredictionResult(analytics);
    store.set('predictions', {
      nextLevel:     prediction.targetLevel,
      estimatedDays: prediction.estimatedDays,
      confidence:    prediction.confidenceLabel,
      full:          prediction,
    });
    _renderProgress(prediction);
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
    store.set('predictions', { full: prediction, nextLevel: prediction.targetLevel,
                               estimatedDays: prediction.estimatedDays,
                               confidence: prediction.confidenceLabel });

    _renderProgress(prediction);

  } catch (err) {
    container.innerHTML = _emptyHTML();
  }
}

// ── Render ────────────────────────────────────────────────────

function _renderProgress(prediction) {
  const container = document.getElementById('progress-content');
  if (!container || !prediction) return;

  const { currentLevel, targetLevel, estimatedDays, estimatedDate,
          confidenceScore, confidenceLabel, trajectory,
          milestones, recommendation } = prediction;

  container.innerHTML = `

    <!-- Prediction Hero -->
    <div class="prediction-hero">
      <div class="prediction-hero__label">AI Prediction Engine</div>

      ${estimatedDays ? `
        <div class="prediction-hero__days">${estimatedDays}</div>
        <div class="prediction-hero__days-label">DAYS TO NEXT LEVEL</div>
        <div class="prediction-hero__target">
          ${currentLevel} → <span style="color:var(--gold-pure)">${targetLevel}</span>
        </div>
        ${estimatedDate ? `<div class="prediction-hero__date">Estimated: ${_formatDate(estimatedDate)}</div>` : ''}
      ` : `
        <div class="prediction-hero__days" style="font-size:3rem">${currentLevel}</div>
        <div class="prediction-hero__days-label">CURRENT LEVEL</div>
        <div class="prediction-hero__target" style="color:var(--white-muted)">
          ${trajectory === 'declining' ? 'Focus on consistency to improve' : 'Keep practising to unlock predictions'}
        </div>
      `}

      <div class="prediction-hero__message">${recommendation.message}</div>

      <div>
        <span class="confidence-badge ${confidenceLabel}">
          ${confidenceLabel} confidence · ${confidenceScore}%
        </span>
      </div>
    </div>

    <!-- Recommendation -->
    <div class="recommendation-card">
      <div class="section-header">
        <h2 class="section-title">Your Study Plan</h2>
        <span class="trajectory-badge ${trajectory}">${trajectory}</span>
      </div>
      <div class="recommendation-grid">
        <div class="rec-item">
          <div class="rec-item__icon">📅</div>
          <div class="rec-item__value">${recommendation.sessionsPerWeek}×</div>
          <div class="rec-item__label">Sessions per week</div>
        </div>
        <div class="rec-item">
          <div class="rec-item__icon">🎯</div>
          <div class="rec-item__value">${targetLevel}</div>
          <div class="rec-item__label">Target level</div>
        </div>
        <div class="rec-item">
          <div class="rec-item__icon">⚡</div>
          <div class="rec-item__value">${recommendation.focusSkills.length > 0 ? recommendation.focusSkills[0] : '—'}</div>
          <div class="rec-item__label">Priority skill</div>
        </div>
      </div>
      ${recommendation.focusSkills.length > 1 ? `
        <div style="margin-top:var(--space-4);font-size:0.875rem;color:var(--white-muted);">
          Also focus on: <span style="color:var(--gold-bright)">${recommendation.focusSkills.slice(1).join(', ')}</span>
        </div>` : ''}
    </div>

    <!-- Milestone Timeline -->
    <div class="milestone-timeline">
      <div class="section-header">
        <h2 class="section-title">CEFR Milestones</h2>
      </div>
      <div class="milestone-list">
        ${milestones.map(m => {
          const status = m.reached ? 'reached' : (m.level === currentLevel ? 'current' : 'future');
          const icon   = m.reached ? '✓' : (m.level === currentLevel ? '●' : m.level);
          const detail = m.reached
            ? 'Achieved'
            : m.estimatedAt
              ? `Est. ${_formatDate(m.estimatedAt)}`
              : 'Keep practising';
          return `
            <div class="milestone-item">
              <div class="milestone-item__dot ${status}">${icon}</div>
              <div class="milestone-item__info">
                <div class="milestone-item__level ${status}">${m.level}${m.level === currentLevel ? ' ← Current' : ''}</div>
                <div class="milestone-item__detail">${detail} · Target: ${m.targetScore}/100</div>
              </div>
              <div class="milestone-item__score ${status}">${m.targetScore}</div>
            </div>`;
        }).join('')}
      </div>
    </div>

  `;
}

// ── Helpers ───────────────────────────────────────────────────

function _formatDate(dateStr) {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function _loadingHTML() {
  return `
    <div class="assessment-loading">
      <div class="assessment-loading__ring"></div>
      <div class="assessment-loading__text">Calculating predictions...</div>
    </div>`;
}

function _emptyHTML() {
  return `
    <div class="progress-empty">
      <div class="empty-state__icon">⬡</div>
      <div class="empty-state__title">No progress data yet</div>
      <div class="empty-state__text">Complete at least one assessment to see your progress and predictions.</div>
      <button class="btn btn--primary" onclick="window.NIREV.navigateTo('assessment')">Start Assessment</button>
    </div>`;
}
