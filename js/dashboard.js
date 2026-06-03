/**
 * NIREV AI — Dashboard Page Module
 * ─────────────────────────────────────────────────────────────
 * Version: 6.0.0 — Real Data Dashboard
 *
 * Reads real data from:
 *   - db.js          (getScores)
 *   - store.js       (scoring, analytics, predictions)
 *   - analytics-domain.js (buildAnalyticsResult)
 *   - prediction-domain.js (buildPredictionResult)
 * ─────────────────────────────────────────────────────────────
 */

import { getGreeting } from './ui.js';
import store from './store.js';
import { getScores } from './db.js';
import { buildAnalyticsResult } from './domain/analytics/analytics-domain.js';
import { buildPredictionResult } from './domain/predictions/prediction-domain.js';

// ── Initialize ────────────────────────────────────────────────

export function initDashboard() {
  _renderWelcome();
  _loadAndRenderDashboard();

  // Re-render when new assessment scoring completes
  document.addEventListener('nirev:scoring:complete', () => {
    _loadAndRenderDashboard();
  });

  // Re-render on navigate to dashboard
  document.addEventListener('nirev:navigate', (e) => {
    if (e.detail?.pageId === 'dashboard') {
      _loadAndRenderDashboard();
    }
  });
}

// ── Welcome ───────────────────────────────────────────────────

function _renderWelcome() {
  const user      = store.get('user');
  const name      = user?.user_metadata?.full_name
                 || user?.email?.split('@')[0]
                 || 'Learner';
  const firstName = name.split(' ')[0];

  const greetingEl = document.getElementById('dashboard-greeting');
  const nameEl     = document.getElementById('dashboard-name');

  if (greetingEl) greetingEl.textContent = `${getGreeting()},`;
  if (nameEl)     nameEl.textContent     = firstName;
}

// ── Main Load ─────────────────────────────────────────────────

async function _loadAndRenderDashboard() {
  const userId = store.get('user')?.id;
  if (!userId) return;

  try {
    // Load scores from DB
    const { data: scores } = await getScores(userId, { limit: 50 });

    if (!scores || scores.length === 0) {
      _renderEmptyStats();
      _renderEmptyActivity();
      _renderEmptyInsights();
      return;
    }

    // Build analytics + predictions
    const analytics  = buildAnalyticsResult(scores);
    const prediction = buildPredictionResult(analytics);

    // Update store
    store.set('analytics', {
      loaded:        true,
      full:          analytics,
      scoresBySkill: analytics.bySkill,
      progressData:  analytics.charts.scoreLine.values,
    });
    store.set('predictions', {
      full:          prediction,
      nextLevel:     prediction.targetLevel,
      estimatedDays: prediction.estimatedDays,
      confidence:    prediction.confidenceLabel,
    });

    // Compute streak
    const streak = _computeStreak(scores);
    store.set('scoring', {
      ...store.get('scoring'),
      average: analytics.summary.averageScore,
      streak,
      history: scores.map(s => ({
        sessionId: s.assessment_id,
        score:     parseFloat(s.score),
        cefr:      s.cefr_level,
        skill:     s.skill,
        date:      s.created_at,
      })),
    });

    // Render all sections
    _renderStats(analytics, prediction, streak);
    _renderRecentActivity(scores);
    _renderInsights(analytics, prediction);

  } catch (err) {
    console.error('[Dashboard] load error:', err);
    _renderEmptyStats();
    _renderEmptyActivity();
    _renderEmptyInsights();
    // Show non-blocking warning — don't use showToast to avoid import cycle
    const container = document.getElementById('recent-activity-list');
    if (container) {
      container.innerHTML = `
        <div style="padding:var(--space-4);text-align:center;">
          <div style="font-size:0.8rem;color:var(--white-muted);">
            Could not load data. Please refresh.
          </div>
        </div>`;
    }
  }
}

// ── Stats ─────────────────────────────────────────────────────

function _renderStats(analytics, prediction, streak) {
  const { summary } = analytics;

  // Assessments taken
  _setStatCard('stat-assessments',
    summary.totalSessions,
    summary.totalSessions === 1 ? '1 session' : `${summary.totalSessions} sessions`
  );

  // Average score
  _setStatCard('stat-avg-score',
    Math.round(summary.averageScore),
    `Best: ${summary.bestScore}/100`
  );

  // Streak
  _setStatCard('stat-streak',
    streak > 0 ? streak : '—',
    streak > 0 ? `${streak} day streak 🔥` : 'Start today'
  );

  // Current level
  _setStatCard('stat-level',
    summary.currentCEFR,
    prediction.estimatedDays
      ? `→ ${prediction.targetLevel} in ~${prediction.estimatedDays}d`
      : _trajectoryLabel(summary.trajectory)
  );
}

function _setStatCard(id, value, trend) {
  const valueEl = document.getElementById(id);
  const trendEl = valueEl?.closest('.stat-card')?.querySelector('.stat-card__trend');
  if (valueEl) valueEl.textContent = value;
  if (trendEl) trendEl.textContent = trend;
}

function _renderEmptyStats() {
  _setStatCard('stat-assessments', '—', 'No sessions yet');
  _setStatCard('stat-avg-score',   '—', 'No data yet');
  _setStatCard('stat-streak',      '—', 'Start today');
  _setStatCard('stat-level',       '—', 'Take an assessment');
}

// ── Recent Activity ───────────────────────────────────────────

function _renderRecentActivity(scores) {
  const container = document.getElementById('recent-activity-list');
  if (!container) return;

  const recent = scores.slice(0, 5);

  container.innerHTML = `
    <div class="activity-list">
      ${recent.map(score => {
        const s       = Math.round(parseFloat(score.score ?? 0));
        const cls     = s >= 70 ? 'high' : s >= 40 ? 'medium' : 'low';
        const colors  = { high: 'var(--status-success)', medium: 'var(--gold-bright)', low: 'var(--status-danger)' };
        const date    = _relativeDate(score.created_at);
        const skill   = score.skill ?? '—';
        const cefr    = score.cefr_level ?? '—';

        return `
          <div class="activity-item" onclick="window.NIREV.navigateTo('reports')" style="cursor:pointer;">
            <div class="activity-item__left">
              <div class="activity-item__icon" style="background:${colors[cls]}22;color:${colors[cls]};border:1px solid ${colors[cls]}44;">
                ${s}
              </div>
              <div class="activity-item__info">
                <div class="activity-item__title" style="text-transform:capitalize">${skill} Assessment</div>
                <div class="activity-item__meta">${cefr} · ${date}</div>
              </div>
            </div>
            <div class="activity-item__score" style="color:${colors[cls]}">${s}/100</div>
          </div>`;
      }).join('')}
    </div>`;
}

function _renderEmptyActivity() {
  const container = document.getElementById('recent-activity-list');
  if (!container) return;
  container.innerHTML = `
    <div class="empty-state">
      <div class="empty-state__icon">◈</div>
      <div class="empty-state__title">No assessments yet</div>
      <div class="empty-state__text">Complete your first assessment to begin tracking your performance.</div>
      <button class="btn btn--primary" onclick="window.NIREV.navigateTo('assessment')" type="button">
        Start Assessment
      </button>
    </div>`;
}

// ── Intelligence Insights Panel ───────────────────────────────

function _renderInsights(analytics, prediction) {
  const container = document.getElementById('dashboard-insights');
  if (!container) return;

  const { summary, skillGaps } = analytics;
  const topGap = skillGaps?.sort((a, b) => b.gap - a.gap)[0];

  container.innerHTML = `
    <div class="insights-list">

      <!-- Trajectory -->
      <div class="insight-item">
        <div class="insight-item__icon">◉</div>
        <div class="insight-item__content">
          <div class="insight-item__label">Performance Trajectory</div>
          <div class="insight-item__value">
            <span class="trajectory-badge ${summary.trajectory}">${summary.trajectory}</span>
          </div>
        </div>
      </div>

      <!-- Next Level Prediction -->
      ${prediction.estimatedDays ? `
      <div class="insight-item">
        <div class="insight-item__icon">✦</div>
        <div class="insight-item__content">
          <div class="insight-item__label">Next Level Prediction</div>
          <div class="insight-item__value">
            <span style="color:var(--gold-bright)">${prediction.currentLevel} → ${prediction.targetLevel}</span>
            <span style="color:var(--white-muted);font-size:0.8rem;margin-left:8px;">~${prediction.estimatedDays} days</span>
          </div>
        </div>
      </div>` : ''}

      <!-- Consistency -->
      <div class="insight-item">
        <div class="insight-item__icon">⬡</div>
        <div class="insight-item__content">
          <div class="insight-item__label">Consistency Index</div>
          <div class="insight-item__value">
            <div class="insight-bar-wrap">
              <div class="insight-bar" style="width:${summary.consistencyIndex}%"></div>
            </div>
            <span style="color:var(--white-muted);font-size:0.8rem;margin-left:8px;">${summary.consistencyIndex}%</span>
          </div>
        </div>
      </div>

      <!-- Priority Skill -->
      ${topGap ? `
      <div class="insight-item">
        <div class="insight-item__icon">⚡</div>
        <div class="insight-item__content">
          <div class="insight-item__label">Priority Skill</div>
          <div class="insight-item__value" style="text-transform:capitalize;color:var(--orange-bright)">
            ${topGap.skill}
            <span style="color:var(--white-muted);font-size:0.8rem;margin-left:8px;">+${Math.round(topGap.gap)} pts needed</span>
          </div>
        </div>
      </div>` : ''}

    </div>`;
}

function _renderEmptyInsights() {
  const container = document.getElementById('dashboard-insights');
  if (!container) return;
  container.innerHTML = `
    <div style="padding:var(--space-6);text-align:center;color:var(--white-muted);font-size:0.875rem;">
      Complete an assessment to unlock intelligence insights.
    </div>`;
}

// ── Helpers ───────────────────────────────────────────────────

function _computeStreak(scores) {
  if (!scores || scores.length === 0) return 0;

  const days = [...new Set(
    scores.map(s => new Date(s.created_at).toDateString())
  )].sort((a, b) => new Date(b) - new Date(a));

  let streak = 0;
  const today = new Date();

  for (let i = 0; i < days.length; i++) {
    const d    = new Date(days[i]);
    const diff = Math.floor((today - d) / 86400000);
    if (diff === i || diff === i + 1) streak++;
    else break;
  }

  return streak;
}

function _relativeDate(dateStr) {
  if (!dateStr) return '—';
  const diff = Date.now() - new Date(dateStr).getTime();
  const min  = Math.floor(diff / 60000);
  if (min < 1)   return 'just now';
  if (min < 60)  return `${min}m ago`;
  const hrs = Math.floor(min / 60);
  if (hrs < 24)  return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days === 1) return 'yesterday';
  if (days < 7)  return `${days} days ago`;
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function _trajectoryLabel(trajectory) {
  return { improving: '↑ Improving', plateauing: '→ Stable', declining: '↓ Declining' }[trajectory] ?? '—';
}
