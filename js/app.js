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
    // Guard: CDN might fail on mobile
    if (!window.supabase) {
      throw new Error('Supabase CDN not loaded');
    }
    initSupabase(SUPABASE.URL, SUPABASE.ANON_KEY);

    // 3. Router — builds nav DOM + wires click/keyboard events
    initRouter();

    // 4. Auth forms
    initAuthForms();

    // 5. Global event listeners
    _wireSignOut();
    _wireSignOutEvent();
    _wireSidebarToggle();

    // 6. Auth state — drives screen transitions
    onAuthStateChange(
      (user) => {
        clearTimeout(_safetyTimer);
        hideLoader();
        _onUserLoggedIn(user);
      },
      () => {
        clearTimeout(_safetyTimer);
        hideLoader();
        showScreen('auth');
      }
    );

    // 7. Check for existing session on load
    // Wrap in timeout to prevent infinite hang on mobile
    const sessionPromise = getSession();
    const timeoutPromise = new Promise((resolve) => setTimeout(() => resolve(null), 6000));
    const session = await Promise.race([sessionPromise, timeoutPromise]);

    if (!session) {
      clearTimeout(_safetyTimer);
      hideLoader();
      showScreen('auth');
    }
    // If session exists: onAuthStateChange will fire and dismiss loader

  } catch (err) {
    // Any bootstrap failure → show auth screen (never leave user stuck)
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
