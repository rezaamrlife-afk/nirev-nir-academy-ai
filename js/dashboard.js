/**
 * NIREV AI — Dashboard Page Module
 * ─────────────────────────────────────────────────────────────
 * Version: 6.2.0 — Real Data Dashboard + Homework (styled)
 *
 * Reads real data from:
 *   - db.js                    (getScores)
 *   - store.js                 (scoring, analytics, predictions)
 *   - analytics-domain.js      (buildAnalyticsResult)
 *   - prediction-domain.js     (buildPredictionResult)
 *
 * Changes in 6.2:
 *   - All user/teacher text is HTML-escaped (XSS-safe)
 *   - Homework loading / empty / error states use real CSS classes
 *   - Homework section is always placed inside .dashboard-grid
 *   - Detailed error logging (code + message + hint)
 *   - Stale-render guard: slow responses can't overwrite newer ones
 * ─────────────────────────────────────────────────────────────
 */

import { getGreeting } from './ui.js';
import store from './store.js';
import { getScores } from './db.js';
import { buildAnalyticsResult } from './domain/analytics/analytics-domain.js';
import { buildPredictionResult } from './domain/predictions/prediction-domain.js';
import { getSupabase } from './auth.js';

// ── Security helper ───────────────────────────────────────────

const _ESC_MAP = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;'
};

function _esc(value) {
  return String(value ?? '').replace(/[&<>"']/g, c => _ESC_MAP[c]);
}

function _cap(value, fallback = '') {
  const s = String(value ?? '');
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : fallback;
}

// ── Count-up Animation ────────────────────────────────────────

function _countUp(element, target, duration = 800) {
  if (!element) return;

  const isFloat = typeof target === 'number' && !Number.isInteger(target);
  const startTime = performance.now();

  function update(currentTime) {
    const progress = Math.min((currentTime - startTime) / duration, 1);
    const ease = 1 - Math.pow(1 - progress, 3);
    const current = target * ease;

    element.textContent = isFloat ? current.toFixed(1) : Math.round(current);

    if (progress < 1) {
      requestAnimationFrame(update);
    } else {
      element.textContent = isFloat ? target.toFixed(1) : target;
    }
  }

  requestAnimationFrame(update);
}

// ── Initialization ────────────────────────────────────────────

let _dashboardInitialized = false;
let _renderToken = 0; // stale-render guard

export function initDashboard() {
  _renderWelcome();
  _loadAndRenderDashboard();

  if (_dashboardInitialized) return;
  _dashboardInitialized = true;

  // Re-render when a new assessment is completed
  document.addEventListener('nirev:scoring:complete', () => {
    _loadAndRenderDashboard();
  });

  // Re-render when navigating back to Dashboard
  document.addEventListener('nirev:navigate', (e) => {
    if (e.detail?.pageId === 'dashboard') {
      _renderWelcome();
      _loadAndRenderDashboard();
    }
  });
}

// ── Welcome ───────────────────────────────────────────────────

function _renderWelcome() {
  const user = store.get('user');

  const name =
    user?.user_metadata?.full_name ||
    user?.email?.split('@')[0] ||
    'Learner';

  const firstName = name.split(' ')[0];

  const greetingEl = document.getElementById('dashboard-greeting');
  const nameEl = document.getElementById('dashboard-name');

  if (greetingEl) greetingEl.textContent = `${getGreeting()},`;
  if (nameEl) nameEl.textContent = firstName;
}

// ── Main Dashboard Load ───────────────────────────────────────

async function _loadAndRenderDashboard() {
  const userId = store.get('user')?.id;
  if (!userId) return;

  const token = ++_renderToken;

  // Homework renders independently of assessment history
  _renderPendingAssignments(userId, token);

  try {
    const { data: scores } = await getScores(userId, { limit: 50 });

    if (token !== _renderToken) return;

    // No assessment history
    if (!scores || scores.length === 0) {
      _renderEmptyStats();
      _renderEmptyActivity();
      _renderEmptyInsights();
      return;
    }

    // Build analytics and predictions
    const analytics = buildAnalyticsResult(scores);
    const prediction = buildPredictionResult(analytics);

    store.set('analytics', {
      loaded: true,
      full: analytics,
      scoresBySkill: analytics.bySkill,
      progressData: analytics.charts.scoreLine.values
    });

    store.set('predictions', {
      full: prediction,
      nextLevel: prediction.targetLevel,
      estimatedDays: prediction.estimatedDays,
      confidence: prediction.confidenceLabel
    });

    const streak = _computeStreak(scores);

    store.set('scoring', {
      ...store.get('scoring'),
      average: analytics.summary.averageScore,
      streak,
      history: scores.map(s => ({
        sessionId: s.assessment_id,
        score: parseFloat(s.score),
        cefr: s.cefr_level,
        skill: s.skill,
        date: s.created_at
      }))
    });

    _renderStats(analytics, prediction, streak);
    _renderRecentActivity(scores);
    _renderInsights(analytics, prediction);

  } catch (err) {
    console.error('[Dashboard] load error:', err);

    if (token !== _renderToken) return;

    _renderEmptyStats();
    _renderEmptyInsights();

    const container = document.getElementById('recent-activity-list');
    if (container) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-state__icon">!</div>
          <div class="empty-state__title">Could not load your data</div>
          <div class="empty-state__text">
            Check your connection and refresh the page.
          </div>
        </div>
      `;
    }
  }
}

// ── Statistics ────────────────────────────────────────────────

function _renderStats(analytics, prediction, streak) {
  const { summary } = analytics;

  const assessEl = document.getElementById('stat-assessments');
  const avgEl = document.getElementById('stat-avg-score');
  const streakEl = document.getElementById('stat-streak');

  _setStatCard(
    'stat-assessments',
    summary.totalSessions,
    summary.totalSessions === 1 ? '1 session' : `${summary.totalSessions} sessions`
  );
  _countUp(assessEl, summary.totalSessions, 600);

  _setStatCard(
    'stat-avg-score',
    Math.round(summary.averageScore),
    `Best: ${summary.bestScore}/100`
  );
  _countUp(avgEl, Math.round(summary.averageScore), 800);

  _setStatCard(
    'stat-streak',
    streak > 0 ? streak : '—',
    streak > 0 ? `${streak} day streak 🔥` : 'Start today'
  );
  if (streak > 0) _countUp(streakEl, streak, 600);

  _setStatCard(
    'stat-level',
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
  _setStatCard('stat-avg-score', '—', 'No data yet');
  _setStatCard('stat-streak', '—', 'Start today');
  _setStatCard('stat-level', '—', 'Take an assessment');
}

// ── Recent Activity ───────────────────────────────────────────

function _renderRecentActivity(scores) {
  const container = document.getElementById('recent-activity-list');
  if (!container) return;

  const colors = {
    high: 'var(--status-success)',
    medium: 'var(--gold-bright)',
    low: 'var(--status-danger)'
  };

  const recent = scores.slice(0, 5);

  container.innerHTML = `
    <div class="activity-list">
      ${recent.map(score => {
        const s = Math.round(parseFloat(score.score ?? 0));
        const tone = s >= 70 ? 'high' : s >= 40 ? 'medium' : 'low';
        const color = colors[tone];

        const date = _relativeDate(score.created_at);
        const skill = _esc(score.skill ?? '—');
        const cefr = _esc(score.cefr_level ?? '—');

        return `
          <div
            class="activity-item"
            role="button"
            tabindex="0"
            onclick="window.NIREV.navigateTo('reports')"
            onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();window.NIREV.navigateTo('reports')}"
          >
            <div class="activity-item__left">

              <div
                class="activity-item__icon"
                style="background:color-mix(in srgb, ${color} 14%, transparent);color:${color};border-color:color-mix(in srgb, ${color} 28%, transparent);"
              >
                ${s}
              </div>

              <div class="activity-item__info">
                <div class="activity-item__title" style="text-transform:capitalize">
                  ${skill} Assessment
                </div>
                <div class="activity-item__meta">
                  ${cefr} · ${date}
                </div>
              </div>

            </div>

            <div class="activity-item__score" style="color:${color}">
              ${s}/100
            </div>
          </div>
        `;
      }).join('')}
    </div>
  `;
}

function _renderEmptyActivity() {
  const container = document.getElementById('recent-activity-list');
  if (!container) return;

  container.innerHTML = `
    <div class="empty-state">
      <div class="empty-state__icon">◈</div>
      <div class="empty-state__title">No assessments yet</div>
      <div class="empty-state__text">
        Complete your first assessment to begin tracking your performance.
      </div>
      <button
        class="btn btn--primary"
        onclick="window.NIREV.navigateTo('assessment')"
        type="button"
      >
        Start Assessment
      </button>
    </div>
  `;
}

// ── Intelligence Insights ──────────────────────────────────────

function _renderInsights(analytics, prediction) {
  const container = document.getElementById('dashboard-insights');
  if (!container) return;

  const { summary, skillGaps } = analytics;

  const topGap = skillGaps?.length
    ? [...skillGaps].sort((a, b) => b.gap - a.gap)[0]
    : null;

  const consistency = Math.max(0, Math.min(100, Number(summary.consistencyIndex) || 0));

  container.innerHTML = `
    <div class="insights-list">

      <div class="insight-item">
        <div class="insight-item__icon">◉</div>
        <div class="insight-item__content">
          <div class="insight-item__label">Performance Trajectory</div>
          <div class="insight-item__value">
            <span class="trajectory-badge ${_esc(summary.trajectory)}">
              ${_esc(summary.trajectory)}
            </span>
          </div>
        </div>
      </div>

      ${prediction.estimatedDays ? `
        <div class="insight-item">
          <div class="insight-item__icon">✦</div>
          <div class="insight-item__content">
            <div class="insight-item__label">Next Level Prediction</div>
            <div class="insight-item__value">
              <span style="color:var(--gold-bright)">
                ${_esc(prediction.currentLevel)} → ${_esc(prediction.targetLevel)}
              </span>
              <span style="color:var(--text-muted);font-size:0.875rem;">
                ~${_esc(prediction.estimatedDays)} days
              </span>
            </div>
          </div>
        </div>
      ` : ''}

      <div class="insight-item">
        <div class="insight-item__icon">⬡</div>
        <div class="insight-item__content">
          <div class="insight-item__label">Consistency Index</div>
          <div class="insight-item__value">
            <div class="insight-bar-wrap">
              <div class="insight-bar" style="width:${consistency}%"></div>
            </div>
            <span style="color:var(--text-muted);font-size:0.875rem;">
              ${consistency}%
            </span>
          </div>
        </div>
      </div>

      ${topGap ? `
        <div class="insight-item">
          <div class="insight-item__icon">⚡</div>
          <div class="insight-item__content">
            <div class="insight-item__label">Priority Skill</div>
            <div
              class="insight-item__value"
              style="text-transform:capitalize;color:var(--orange-bright)"
            >
              ${_esc(topGap.skill)}
              <span style="color:var(--text-muted);font-size:0.875rem;text-transform:none;">
                +${Math.round(topGap.gap)} pts needed
              </span>
            </div>
          </div>
        </div>
      ` : ''}

    </div>
  `;
}

function _renderEmptyInsights() {
  const container = document.getElementById('dashboard-insights');
  if (!container) return;

  container.innerHTML = `
    <div style="padding:var(--space-6);text-align:center;color:var(--text-muted);font-size:0.9375rem;">
      Complete an assessment to unlock intelligence insights.
    </div>
  `;
}

// ── Homework: states ───────────────────────────────────────────

function _renderAssignmentsLoading(container) {
  container.innerHTML = `
    <div class="dashboard-card">
      <div class="dashboard-card__header">
        <div class="dashboard-card__title">Assigned to You</div>
      </div>
      <div class="assignment-loading">Loading your assignments…</div>
    </div>
  `;
}

function _renderEmptyAssignments(container, message = null, isError = false) {
  if (!container) return;

  container.innerHTML = `
    <div class="dashboard-card ${isError ? 'dashboard-card--assignments-error' : 'dashboard-card--assignments-empty'}">

      <div class="dashboard-card__header">
        <div class="dashboard-card__title">Assigned to You</div>
        <div class="dashboard-card__badge">0 Pending</div>
      </div>

      <div class="assignment-empty">
        <div class="assignment-empty__icon">${isError ? '!' : '✦'}</div>

        <div class="assignment-empty__title">
          ${isError ? 'Homework is unavailable right now' : 'No homework assigned yet'}
        </div>

        <div class="assignment-empty__text">
          ${_esc(
            message ||
            "Your teacher hasn't assigned any homework. New assignments will appear here."
          )}
        </div>
      </div>

    </div>
  `;
}

// ── Homework: container placement ──────────────────────────────

function _ensureAssignmentsContainer() {
  let container = document.getElementById('pending-assignments-section');
  if (container) return container;

  const activitySection =
    document.querySelector('.dashboard-section--activity') ??
    document.getElementById('recent-activity-list')?.closest('.dashboard-section') ??
    document.getElementById('recent-activity-list')?.closest('.dashboard-grid > *') ??
    document.getElementById('recent-activity-list')?.parentElement;

  if (!activitySection?.parentElement) return null;

  container = document.createElement('div');
  container.id = 'pending-assignments-section';

  // Inserted before Activity, inside the same parent (.dashboard-grid)
  activitySection.parentElement.insertBefore(container, activitySection);

  return container;
}

// ── Pending Assignments (Learner) ─────────────────────────────

async function _renderPendingAssignments(userId, token = _renderToken) {
  const sb = getSupabase();
  if (!sb) return;

  const profileData = store.get('profile');

  // Teachers don't see homework
  if (profileData?.role === 'teacher') {
    document.getElementById('pending-assignments-section')?.remove();
    return;
  }

  const container = _ensureAssignmentsContainer();
  if (!container) return;

  _renderAssignmentsLoading(container);

  const { data: assignments, error } = await sb
    .from('assignments')
    .select('id, skill, level, message, created_at, status')
    .eq('student_id', userId)
    .eq('status', 'pending')
    .order('created_at', { ascending: false });

  if (token !== _renderToken) return;

  if (error) {
    // code 42P01 = missing table · 42703 = missing column · 42501 = RLS denied
    console.error('[Dashboard] assignments error:', {
      code: error.code,
      message: error.message,
      details: error.details,
      hint: error.hint
    });

    _renderEmptyAssignments(
      container,
      'We could not load your assignments. Refresh the page to try again.',
      true
    );
    return;
  }

  if (!assignments || assignments.length === 0) {
    _renderEmptyAssignments(container);
    return;
  }

  const rows = assignments.map(a => {
    const skill = _cap(a.skill, 'Assessment');
    const date = _relativeDate(a.created_at);

    return `
      <div class="assignment-item" data-assignment-id="${_esc(a.id)}">

        <div class="assignment-item__icon">✦</div>

        <div class="assignment-item__info">
          <div class="assignment-item__title">
            ${_esc(skill)} · ${_esc(a.level || '—')}
          </div>

          ${a.message ? `
            <div class="assignment-item__message">“${_esc(a.message)}”</div>
          ` : ''}

          <div class="assignment-item__meta">${date}</div>
        </div>

        <button
          class="assignment-item__go"
          type="button"
          data-skill="${_esc(a.skill || '')}"
          data-level="${_esc(a.level || '')}"
          data-assignment-id="${_esc(a.id)}"
        >
          Start
        </button>

      </div>
    `;
  }).join('');

  container.innerHTML = `
    <div class="dashboard-card">

      <div class="dashboard-card__header">
        <div class="dashboard-card__title">Assigned to You</div>
        <div class="dashboard-card__badge dashboard-card__badge--active">
          ${assignments.length} Pending
        </div>
      </div>

      <div class="assignment-list">${rows}</div>

    </div>
  `;

  // Wire Start buttons
  container.querySelectorAll('.assignment-item__go').forEach(btn => {
    btn.addEventListener('click', async () => {
      const { skill, level, assignmentId } = btn.dataset;

      btn.disabled = true;

      const { error: updateError } = await sb
        .from('assignments')
        .update({ status: 'completed' })
        .eq('id', assignmentId);

      if (updateError) {
        console.error('[Dashboard] assignment update error:', updateError);
        btn.disabled = false;
        return;
      }

      btn.closest('.assignment-item')?.remove();

      const remaining =
        container.querySelectorAll('.assignment-item').length;

      if (remaining === 0) {
        _renderEmptyAssignments(container);
      } else {
        const badge = container.querySelector('.dashboard-card__badge');
        if (badge) badge.textContent = `${remaining} Pending`;
      }

      store.set('assignedLevel', level);
      window.NIREV?.navigateTo('assessment');

      // Select skill and start assessment
      setTimeout(() => {
        const skillCard = document.querySelector(`.skill-card[data-skill="${CSS.escape(skill)}"]`);
        if (!skillCard) return;

        skillCard.click();

        setTimeout(() => {
          document.getElementById('btn-start-assessment')?.click();
        }, 200);
      }, 500);
    });
  });
}

// ── Helpers ───────────────────────────────────────────────────

function _computeStreak(scores) {
  if (!scores || scores.length === 0) return 0;

  const days = [
    ...new Set(scores.map(s => new Date(s.created_at).toDateString()))
  ].sort((a, b) => new Date(b) - new Date(a));

  let streak = 0;
  const today = new Date();

  for (let i = 0; i < days.length; i++) {
    const diff = Math.floor((today - new Date(days[i])) / 86400000);

    if (diff === i || diff === i + 1) {
      streak++;
    } else {
      break;
    }
  }

  return streak;
}

function _relativeDate(dateStr) {
  if (!dateStr) return '—';

  const diff = Date.now() - new Date(dateStr).getTime();
  const min = Math.floor(diff / 60000);

  if (min < 1) return 'just now';
  if (min < 60) return `${min}m ago`;

  const hrs = Math.floor(min / 60);
  if (hrs < 24) return `${hrs}h ago`;

  const days = Math.floor(hrs / 24);
  if (days === 1) return 'yesterday';
  if (days < 7) return `${days} days ago`;

  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric'
  });
}

function _trajectoryLabel(trajectory) {
  return {
    improving: '↑ Improving',
    plateauing: '→ Stable',
    declining: '↓ Declining'
  }[trajectory] ?? '—';
}
