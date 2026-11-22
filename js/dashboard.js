
/**
 * NIREV AI — Dashboard Page Module
 * ─────────────────────────────────────────────────────────────
 * Version: 6.1.0 — Real Data Dashboard + Homework Empty State
 *
 * Reads real data from:
 *   - db.js                    (getScores)
 *   - store.js                 (scoring, analytics, predictions)
 *   - analytics-domain.js      (buildAnalyticsResult)
 *   - prediction-domain.js     (buildPredictionResult)
 *
 * Features:
 *   - Real assessment statistics
 *   - Recent assessment activity
 *   - Intelligence insights
 *   - Learner homework assignments
 *   - Professional homework empty state
 *   - Teacher role gating
 * ─────────────────────────────────────────────────────────────
 */

import { getGreeting } from './ui.js';
import store from './store.js';
import { getScores } from './db.js';
import { buildAnalyticsResult } from './domain/analytics/analytics-domain.js';
import { buildPredictionResult } from './domain/predictions/prediction-domain.js';
import { getSupabase } from './auth.js';

// ── Count-up Animation ────────────────────────────────────────

function _countUp(element, target, duration = 800) {
  if (!element) return;

  const isFloat = typeof target === 'number' && !Number.isInteger(target);
  const start = 0;
  const startTime = performance.now();

  function update(currentTime) {
    const elapsed = currentTime - startTime;
    const progress = Math.min(elapsed / duration, 1);
    const ease = 1 - Math.pow(1 - progress, 3);
    const current = start + (target - start) * ease;

    element.textContent = isFloat
      ? current.toFixed(1)
      : Math.round(current);

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

  if (greetingEl) {
    greetingEl.textContent = `${getGreeting()},`;
  }

  if (nameEl) {
    nameEl.textContent = firstName;
  }
}

// ── Main Dashboard Load ───────────────────────────────────────

async function _loadAndRenderDashboard() {
  const userId = store.get('user')?.id;

  if (!userId) return;

  // Render learner homework independently of assessment history
  await _renderPendingAssignments(userId);

  try {
    const { data: scores } = await getScores(userId, { limit: 50 });

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

    // Update analytics store
    store.set('analytics', {
      loaded: true,
      full: analytics,
      scoresBySkill: analytics.bySkill,
      progressData: analytics.charts.scoreLine.values
    });

    // Update predictions store
    store.set('predictions', {
      full: prediction,
      nextLevel: prediction.targetLevel,
      estimatedDays: prediction.estimatedDays,
      confidence: prediction.confidenceLabel
    });

    // Compute learning streak
    const streak = _computeStreak(scores);

    // Update scoring store
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

    // Render dashboard sections
    _renderStats(analytics, prediction, streak);
    _renderRecentActivity(scores);
    _renderInsights(analytics, prediction);

  } catch (err) {
    console.error('[Dashboard] load error:', err);

    _renderEmptyStats();
    _renderEmptyActivity();
    _renderEmptyInsights();

    const container = document.getElementById('recent-activity-list');

    if (container) {
      container.innerHTML = `
        <div style="padding:var(--space-4);text-align:center;">
          <div style="font-size:0.875rem;color:var(--text-muted);">
            Could not load data. Please refresh.
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
    summary.totalSessions === 1
      ? '1 session'
      : `${summary.totalSessions} sessions`
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

  if (streak > 0) {
    _countUp(streakEl, streak, 600);
  }

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

  const trendEl = valueEl
    ?.closest('.stat-card')
    ?.querySelector('.stat-card__trend');

  if (valueEl) {
    valueEl.textContent = value;
  }

  if (trendEl) {
    trendEl.textContent = trend;
  }
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

  const recent = scores.slice(0, 5);

  container.innerHTML = `
    <div class="activity-list">
      ${recent.map(score => {
        const s = Math.round(parseFloat(score.score ?? 0));

        const cls =
          s >= 70 ? 'high' :
          s >= 40 ? 'medium' :
          'low';

        const colors = {
          high: 'var(--status-success)',
          medium: 'var(--gold-bright)',
          low: 'var(--status-danger)'
        };

        const date = _relativeDate(score.created_at);
        const skill = score.skill ?? '—';
        const cefr = score.cefr_level ?? '—';

        return `
          <div
            class="activity-item"
            onclick="window.NIREV.navigateTo('reports')"
            style="cursor:pointer;"
          >
            <div class="activity-item__left">

              <div
                class="activity-item__icon"
                style="
                  background:${colors[cls]}22;
                  color:${colors[cls]};
                  border:1px solid ${colors[cls]}44;
                "
              >
                ${s}
              </div>

              <div class="activity-item__info">
                <div
                  class="activity-item__title"
                  style="text-transform:capitalize"
                >
                  ${skill} Assessment
                </div>

                <div class="activity-item__meta">
                  ${cefr} · ${date}
                </div>
              </div>

            </div>

            <div
              class="activity-item__score"
              style="color:${colors[cls]}"
            >
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

      <div class="empty-state__title">
        No assessments yet
      </div>

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

  container.innerHTML = `
    <div class="insights-list">

      <!-- Performance Trajectory -->
      <div class="insight-item">

        <div class="insight-item__icon">◉</div>

        <div class="insight-item__content">

          <div class="insight-item__label">
            Performance Trajectory
          </div>

          <div class="insight-item__value">
            <span class="trajectory-badge ${summary.trajectory}">
              ${summary.trajectory}
            </span>
          </div>

        </div>
      </div>

      <!-- Next Level Prediction -->
      ${prediction.estimatedDays ? `
        <div class="insight-item">

          <div class="insight-item__icon">✦</div>

          <div class="insight-item__content">

            <div class="insight-item__label">
              Next Level Prediction
            </div>

            <div class="insight-item__value">

              <span style="color:var(--gold-bright)">
                ${prediction.currentLevel} → ${prediction.targetLevel}
              </span>

              <span
                style="
                  color:var(--text-muted);
                  font-size:0.875rem;
                  margin-left:8px;
                "
              >
                ~${prediction.estimatedDays} days
              </span>

            </div>
          </div>
        </div>
      ` : ''}

      <!-- Consistency -->
      <div class="insight-item">

        <div class="insight-item__icon">⬡</div>

        <div class="insight-item__content">

          <div class="insight-item__label">
            Consistency Index
          </div>

          <div class="insight-item__value">

            <div class="insight-bar-wrap">
              <div
                class="insight-bar"
                style="width:${Math.max(0, Math.min(100, summary.consistencyIndex))}%"
              ></div>
            </div>

            <span
              style="
                color:var(--text-muted);
                font-size:0.875rem;
                margin-left:8px;
              "
            >
              ${summary.consistencyIndex}%
            </span>

          </div>
        </div>
      </div>

      <!-- Priority Skill -->
      ${topGap ? `
        <div class="insight-item">

          <div class="insight-item__icon">⚡</div>

          <div class="insight-item__content">

            <div class="insight-item__label">
              Priority Skill
            </div>

            <div
              class="insight-item__value"
              style="text-transform:capitalize;color:var(--orange-bright)"
            >
              ${topGap.skill}

              <span
                style="
                  color:var(--text-muted);
                  font-size:0.875rem;
                  margin-left:8px;
                "
              >
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
    <div
      style="
        padding:var(--space-6);
        text-align:center;
        color:var(--text-muted);
        font-size:0.875rem;
      "
    >
      Complete an assessment to unlock intelligence insights.
    </div>
  `;
}

// ── Homework Empty State ───────────────────────────────────────

function _renderEmptyAssignments(container, message = null, isError = false) {
  if (!container) return;

  container.innerHTML = `
    <div class="dashboard-card dashboard-card--assignments-empty">

      <div class="dashboard-card__header">

        <div class="dashboard-card__title">
          Assigned to You
        </div>

        <div class="dashboard-card__badge">
          0 Pending
        </div>

      </div>

      <div class="assignment-empty">

        <div class="assignment-empty__icon">
          ${isError ? '!' : '✦'}
        </div>

        <div class="assignment-empty__title">
          ${isError
            ? 'Homework temporarily unavailable'
            : 'No homework assigned yet'}
        </div>

        <div class="assignment-empty__text">
          ${message ||
            "Your teacher hasn't assigned any homework at the moment. When a new assignment is available, it will appear here."}
        </div>

      </div>
    </div>
  `;
}

// ── Pending Assignments (Learner) ─────────────────────────────

async function _renderPendingAssignments(userId) {
  const sb = getSupabase();

  if (!sb) return;

  const profileData = store.get('profile');

  // Hide homework for teachers
  if (profileData?.role === 'teacher') {
    document.getElementById('pending-assignments-section')?.remove();
    return;
  }

  // Find or create homework container
  let container = document.getElementById('pending-assignments-section');

  if (!container) {
    const activitySection =
      document.querySelector('.dashboard-section--activity') ??
      document.getElementById('recent-activity-list')?.closest('.dashboard-section') ??
      document.getElementById('recent-activity-list')?.parentElement;

    if (!activitySection?.parentElement) return;

    container = document.createElement('div');
    container.id = 'pending-assignments-section';
    container.style.cssText = 'margin-bottom:var(--space-6);';

    activitySection.parentElement.insertBefore(
      container,
      activitySection
    );
  }

  // Loading state
  container.innerHTML = `
    <div class="dashboard-card">
      <div class="dashboard-card__header">
        <div class="dashboard-card__title">Assigned to You</div>
      </div>
      <div class="assignment-empty__text" style="padding:var(--space-4);">
        Loading your assignments...
      </div>
    </div>
  `;

  // Fetch real pending assignments
  const { data: assignments, error } = await sb
    .from('assignments')
    .select('id, skill, level, message, created_at, status')
    .eq('student_id', userId)
    .eq('status', 'pending')
    .order('created_at', { ascending: false });

  // Handle database errors
  if (error) {
    console.error('[Dashboard] assignments error:', error);

    _renderEmptyAssignments(
      container,
      'We could not load your assignments. Please refresh the page and try again.',
      true
    );

    return;
  }

  // No assignments: show professional empty state
  if (!assignments || assignments.length === 0) {
    _renderEmptyAssignments(container);
    return;
  }

  // Build assignment rows
  const rows = assignments.map(a => {
    const skill = a.skill
      ? a.skill.charAt(0).toUpperCase() + a.skill.slice(1)
      : 'Assessment';

    const date = _relativeDate(a.created_at);

    return `
      <div
        class="assignment-item"
        data-assignment-id="${a.id}"
        data-skill="${a.skill || ''}"
        data-level="${a.level || ''}"
      >

        <div class="assignment-item__icon">
          ✦
        </div>

        <div class="assignment-item__info">

          <div class="assignment-item__title">
            ${skill} · ${a.level || '—'}
          </div>

          ${a.message ? `
            <div class="assignment-item__message">
              "${a.message}"
            </div>
          ` : ''}

          <div class="assignment-item__meta">
            ${date}
          </div>

        </div>

        <button
          class="btn btn--primary btn--sm assignment-item__go"
          type="button"
          data-skill="${a.skill || ''}"
          data-level="${a.level || ''}"
          data-assignment-id="${a.id}"
        >
          Start →
        </button>

      </div>
    `;
  }).join('');

  // Render assignments
  container.innerHTML = `
    <div class="dashboard-card">

      <div class="dashboard-card__header">

        <div class="dashboard-card__title">
          Assigned to You
        </div>

        <div
          class="dashboard-card__badge"
          style="
            background:var(--gold-pure);
            color:#000;
            border-radius:999px;
            padding:2px 10px;
            font-size:0.75rem;
            font-weight:700;
          "
        >
          ${assignments.length} Pending
        </div>

      </div>

      <div class="assignment-list">
        ${rows}
      </div>

    </div>
  `;

  // Wire Start buttons
  container.querySelectorAll('.assignment-item__go').forEach(btn => {
    btn.addEventListener('click', async () => {
      const skill = btn.dataset.skill;
      const level = btn.dataset.level;
      const assignmentId = btn.dataset.assignmentId;

      btn.disabled = true;

      // Mark assignment as completed
      const { error: updateError } = await sb
        .from('assignments')
        .update({ status: 'completed' })
        .eq('id', assignmentId);

      if (updateError) {
        console.error('[Dashboard] assignment update error:', updateError);
        btn.disabled = false;
        return;
      }

      // Remove completed assignment from UI
      btn.closest('.assignment-item')?.remove();

      const list = container.querySelector('.assignment-list');

      const remaining =
        list?.querySelectorAll('.assignment-item').length ?? 0;

      // Update empty state or remaining count
      if (remaining === 0) {
        _renderEmptyAssignments(container);
      } else {
        const badge = container.querySelector('.dashboard-card__badge');

        if (badge) {
          badge.textContent = `${remaining} Pending`;
        }
      }

      // Store assigned level
      store.set('assignedLevel', level);

      // Navigate to assessment
      window.NIREV?.navigateTo('assessment');

      // Select skill and start assessment
      setTimeout(() => {
        const skillCard = document.querySelector(
          `.skill-card[data-skill="${skill}"]`
        );

        if (!skillCard) return;

        skillCard.click();

        setTimeout(() => {
          const startBtn = document.getElementById(
            'btn-start-assessment'
          );

          if (startBtn) {
            startBtn.click();
          }
        }, 200);

      }, 500);
    });
  });
}

// ── Helpers ───────────────────────────────────────────────────

function _computeStreak(scores) {
  if (!scores || scores.length === 0) return 0;

  const days = [
    ...new Set(
      scores.map(s => new Date(s.created_at).toDateString())
    )
  ].sort((a, b) => new Date(b) - new Date(a));

  let streak = 0;
  const today = new Date();

  for (let i = 0; i < days.length; i++) {
    const d = new Date(days[i]);
    const diff = Math.floor((today - d) / 86400000);

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
