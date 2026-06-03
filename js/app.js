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
         toggleSidebar, getInitials }             from './ui.js';
import { initSupabase, onAuthStateChange,
         getSession, initAuthForms, signOut,
         getCurrentUser }                         from './auth.js';
import { initRouter, navigateTo, restoreLastPage } from './router.js';
import { initDashboard }                           from './dashboard.js';
import { initAssessmentPage }                      from './assessment.js';
import store                                       from './store.js';

// ── Bootstrap ─────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', async () => {

  // 1. Theme
  initTheme();
  showLoader('Initializing NIREV');

  // 2. Supabase
  initSupabase(SUPABASE.URL, SUPABASE.ANON_KEY);

  // 3. Router — builds nav DOM + wires click/keyboard events
  initRouter();

  // 4. Auth forms
  initAuthForms();

  // 5. Global event listeners
  _wireSignOut();
  _wireSignOutEvent();

  // 6. Auth state — drives screen transitions
  onAuthStateChange(
    (user) => {
      hideLoader();
      _onUserLoggedIn(user);
    },
    () => {
      hideLoader();
      showScreen('auth');
    }
  );

  // 7. Check for existing session on load
  const session = await getSession();
  if (!session) {
    hideLoader();
    showScreen('auth');
  }

  // 8. Expose minimal global API for inline HTML event handlers
  // (Only navigateTo is exposed; everything else stays modular)
  window.NIREV = { navigateTo };
});

// ── Auth Event Handlers ───────────────────────────────────────

function _onUserLoggedIn(user) {
  showScreen('app');
  _updateUserWidget(user);
  restoreLastPage();
  initDashboard();
  initAssessmentPage();
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
    showScreen('auth');
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
