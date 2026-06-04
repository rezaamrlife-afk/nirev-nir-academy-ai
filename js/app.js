/**
 * NIREV AI — Application Bootstrap  [Refactored: Phase 1.5]
 * ─────────────────────────────────────────────────────────────
 * This file is the entry point ONLY.
 * Its sole job is to initialize all modules in the correct order.
 *
 * It does NOT:
 *   - Define navigation structure (→ config.js)
 *   - Build nav DOM (→ router.js)
 *   - Wire nav events (→ router.js)
 *   - Hold API keys (→ config.js)
 *   - Contain QUICK_ACTIONS (→ config.js)
 *   - Import from page-level modules (dashboard, assessment, etc.)
 *
 * Initialization sequence:
 *   1. Theme
 *   2. Supabase client
 *   3. Router (nav DOM + events)
 *   4. Auth forms
 *   5. Global event listeners (signout, navigate)
 *   6. Session check → show correct screen
 * ─────────────────────────────────────────────────────────────
 */

import { SUPABASE, APP }                          from './config.js';
import { initTheme }                              from './theme.js';
import { showLoader, hideLoader, showScreen,
         toggleSidebar, closeSidebar, getInitials } from './ui.js';
import { initSupabase, onAuthStateChange,
         getSession, initAuthForms, signOut,
         getCurrentUser }                         from './auth.js';
import { initRouter, navigateTo, restoreLastPage } from './router.js';
import { initDashboard }                           from './dashboard.js';
import { initAssessmentPage }                      from './assessment.js';
import { initAnalyticsPage }                       from './analytics.js';
import { initProgressPage }                        from './progress.js';
import { initReportsPage }                         from './reports.js';
import store                                       from './store.js';

// ── Bootstrap ─────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', async () => {

  // 1. Theme
  initTheme();
  showLoader('Initializing NIREV');

  // Safety net: if bootstrap takes too long, force auth screen
  // Covers: network timeout, CDN failure, unhandled rejection
  const _safetyTimer = setTimeout(() => {
    hideLoader();
    showScreen('auth');
  }, 8000);

  try {
    // 2. Supabase
    if (!window.supabase) throw new Error('Supabase CDN not loaded');
    initSupabase(SUPABASE.URL, SUPABASE.ANON_KEY);

    // 3. Router
    initRouter();

    // 4. Auth forms
    initAuthForms();

    // 5. Global event listeners
    _wireSignOut();
    _wireSignOutEvent();
    _wireSidebarToggle();

    // 6. Auth state listener
    // _authResolved: set to true as soon as onAuthStateChange fires
    // Prevents getSession timeout from showing auth when session may exist
    let _authResolved = false;

    onAuthStateChange(
      (user) => {
        _authResolved = true;
        clearTimeout(_safetyTimer);
        hideLoader();
        _onUserLoggedIn(user);
      },
      () => {
        _authResolved = true;
        clearTimeout(_safetyTimer);
        hideLoader();
        showScreen('auth');
      }
    );

    // 7. getSession with timeout
    //
    // KEY DESIGN DECISION (prevents flicker):
    //   - getSession returns null BEFORE timeout → session confirmed absent → show auth
    //   - getSession times out → session state unknown → keep loader, let onAuthStateChange decide
    //   - onAuthStateChange(user) → show app (always wins)
    //   - onAuthStateChange(null) → show auth (confirmed absent)
    //   - safety timer (8s) → show auth (absolute last resort)
    //
    // This eliminates auth→app flicker because we never prematurely show auth
    // when session might exist but Supabase is responding slowly.

    const sessionPromise = getSession();
    const timeoutPromise = new Promise((resolve) =>
      setTimeout(() => resolve('__timeout__'), 6000)
    );
    const result = await Promise.race([sessionPromise, timeoutPromise]);

    if (result === '__timeout__') {
      // Timed out — session state UNKNOWN
      // Do NOT show auth: onAuthStateChange will resolve this
      // Safety timer at 8s is still running as backstop
      // No action needed here — avoid premature screen change
    } else if (!result) {
      // getSession returned null BEFORE timeout — session confirmed absent
      if (!_authResolved) {
        clearTimeout(_safetyTimer);
        hideLoader();
        showScreen('auth');
      }
    }
    // result is a valid session → onAuthStateChange will fire and handle it

  } catch (err) {
    clearTimeout(_safetyTimer);
    hideLoader();
    showScreen('auth');
    console.error('[Bootstrap] failed:', err);
  }

  // 8. Expose minimal global API for inline HTML event handlers
  window.NIREV = { navigateTo };
});

// ── Auth Event Handlers ───────────────────────────────────────

// Guard: prevents re-initialization on TOKEN_REFRESH or repeated auth events
let _appInitialized = false;

function _onUserLoggedIn(user) {
  showScreen('app');
  _updateUserWidget(user);

  if (!_appInitialized) {
    _appInitialized = true;
    restoreLastPage();
    initDashboard();
    initAssessmentPage();
    initAnalyticsPage();
    initProgressPage();
    initReportsPage();
  }
}

/**
 * Wire the Sign Out button click → signOut()
 */
function _wireSignOut() {
  const btn = document.getElementById('btn-signout');
  if (btn) btn.addEventListener('click', () => signOut());
}

/**
 * Listen for the 'nirev:signout' event dispatched by auth.js.
 * Handles the screen transition after sign-out completes.
 */
function _wireSignOutEvent() {
  document.addEventListener('nirev:signout', () => {
    _appInitialized = false; // Allow re-init on next login
    showScreen('auth');
  });
}

// ── Sidebar Toggle ───────────────────────────────────────────

function _wireSidebarToggle() {
  // Hamburger toggle button — uses ui.js toggleSidebar (handles overlay)
  const btn = document.getElementById('sidebar-toggle');
  if (btn) btn.addEventListener('click', (e) => {
    e.stopPropagation();
    toggleSidebar();
  });

  // Close button inside sidebar — uses ui.js closeSidebar (handles overlay)
  const closeBtn = document.getElementById('sidebar-close');
  if (closeBtn) closeBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    closeSidebar();
  });
}

// ── User Widget ───────────────────────────────────────────────

function _updateUserWidget(user) {
  const name     = user?.user_metadata?.full_name
                || user?.email?.split('@')[0]
                || 'User';
  const initials = getInitials(name);

  const avatarEl = document.getElementById('user-avatar');
  const nameEl   = document.getElementById('user-name');
  const roleEl   = document.getElementById('user-role');

  if (avatarEl) avatarEl.textContent = initials;
  if (nameEl)   nameEl.textContent   = name;
  if (roleEl)   roleEl.textContent   = store.get('profile.role') ?? 'Learner';
}
