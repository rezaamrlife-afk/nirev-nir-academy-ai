/**
 * NIREV AI — Dashboard Page Module  [Refactored: Phase 1.5]
 * ─────────────────────────────────────────────────────────────
 * Responsibilities:
 *   - Render dashboard welcome header
 *   - Render placeholder stats (real data: Phase 2+)
 *   - Render recent activity list (real data: Phase 2+)
 *
 * Removed in Phase 1.5:
 *   - QUICK_ACTIONS export (moved to config.js)
 *
 * Reads from:
 *   - store.js  (user, profile, scoring)
 *   - ui.js     (getGreeting, formatRelativeTime)
 * ─────────────────────────────────────────────────────────────
 */

import { getGreeting } from './ui.js';
import store            from './store.js';

/**
 * Initialize the dashboard page.
 * Called by app.js after login; re-safe to call on each nav to dashboard.
 */
export function initDashboard() {
  _renderWelcome();
  _renderStats();
  _renderRecentActivity();
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

// ── Stats ─────────────────────────────────────────────────────

/**
 * Render stat cards.
 * Phase 1.5: all values are placeholders.
 * Phase 2: values come from store.scoring (populated by db.js).
 */
function _renderStats() {
  const scoring = store.get('scoring');

  _setStat('stat-assessments', scoring?.history?.length || '—', 'No assessments yet');
  _setStat('stat-avg-score',   _formatStat(scoring?.average),   'No data yet');
  _setStat('stat-streak',      _formatStat(scoring?.streak),    'Start today');
  _setStat('stat-level',       store.get('profile.level') || '—', 'Take an assessment');
}

function _setStat(id, value, fallbackTrend) {
  const el = document.getElementById(id);
  if (el) el.textContent = value;
}

function _formatStat(val) {
  if (val === null || val === undefined || val === 0) return '—';
  return typeof val === 'number' ? val.toFixed(1) : val;
}

// ── Recent Activity ───────────────────────────────────────────

/**
 * Render recent activity list.
 * Phase 1.5: empty state.
 * Phase 2: list of recent assessment sessions from store.scoring.history.
 */
function _renderRecentActivity() {
  const container = document.getElementById('recent-activity-list');
  if (!container) return;

  const history = store.get('scoring')?.history ?? [];

  if (history.length === 0) {
    container.innerHTML = _emptyStateHTML();
    return;
  }

  // Phase 2: render actual list items here
  container.innerHTML = _emptyStateHTML();
}

function _emptyStateHTML() {
  return `
    <div class="empty-state">
      <div class="empty-state__icon">◈</div>
      <div class="empty-state__title">No assessments yet</div>
      <div class="empty-state__text">
        Complete your first assessment to begin tracking your performance.
      </div>
      <button class="btn btn--primary"
              onclick="window.NIREV.navigateTo('assessment')"
              type="button">
        Start Assessment
      </button>
    </div>
  `;
}
