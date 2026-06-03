/**
 * NIREV AI — Authentication Module  [Refactored: Phase 1.5]
 * ─────────────────────────────────────────────────────────────
 * Responsibilities:
 *   - Supabase client initialization and access
 *   - Sign in / Sign up / Sign out / Password reset
 *   - Session retrieval and auth state listener
 *   - Auth form wiring (DOM interactions only, no UI state calls)
 *   - Input validation utilities
 *
 * Rules enforced in this refactor:
 *   ✓ No import from ui.js (showLoader/hideLoader/showScreen removed)
 *   ✓ No direct DOM navigation — callbacks handle that in app.js
 *   ✓ signIn/signUp return { user, error } — caller manages UI
 *   ✓ signOut dispatches an event — caller manages screen switch
 *   ✓ Supabase URL/key imported from config.js, not hardcoded here
 * ─────────────────────────────────────────────────────────────
 */

import { showToast } from './ui.js';
import store from './store.js';

// ── Supabase Client ───────────────────────────────────────────

let _supabase = null;

/**
 * Initialize the Supabase client.
 * Must be called before any auth function.
 * @param {string} url
 * @param {string} anonKey
 * @returns {SupabaseClient}
 */
export function initSupabase(url, anonKey) {
  _supabase = window.supabase.createClient(url, anonKey);
  return _supabase;
}

/**
 * Returns the initialized Supabase client.
 * Used by db.js and groq.js to get the client.
 * @returns {SupabaseClient | null}
 */
export function getSupabase() {
  return _supabase;
}

// ── Auth State ────────────────────────────────────────────────

/**
 * Returns the current Supabase user from store (not live session).
 * For a live session check, use getSession().
 * @returns {User | null}
 */
export function getCurrentUser() {
  return store.get('user');
}

/**
 * Register a listener for auth state changes.
 * Calls onLogin(user) when session starts.
 * Calls onLogout() when session ends.
 * Keeps store.user and store.isAuthed in sync.
 *
 * @param {Function} onLogin  - (user: User) => void
 * @param {Function} onLogout - () => void
 */
export function onAuthStateChange(onLogin, onLogout) {
  if (!_supabase) return;

  _supabase.auth.onAuthStateChange((event, session) => {
    if (session?.user) {
      store.set('user',     session.user);
      store.set('isAuthed', true);
      onLogin(session.user);
    } else {
      store.set('user',     null);
      store.set('isAuthed', false);
      onLogout();
    }
  });
}

/**
 * Retrieves the current session from Supabase.
 * Use this on page load to check for an existing session.
 * @returns {Session | null}
 */
export async function getSession() {
  if (!_supabase) return null;
  const { data } = await _supabase.auth.getSession();
  return data?.session ?? null;
}

// ── Sign In ───────────────────────────────────────────────────

/**
 * Sign in with email and password.
 * Returns result — does NOT touch UI or store directly.
 * Caller is responsible for loader and screen transitions.
 *
 * @param {string} email
 * @param {string} password
 * @returns {{ user: User | null, error: string | null }}
 */
export async function signIn(email, password) {
  if (!_supabase) return { user: null, error: 'Supabase not initialized' };

  const { data, error } = await _supabase.auth.signInWithPassword({
    email:    email.trim(),
    password,
  });

  if (error) return { user: null, error: error.message };
  return { user: data.user, error: null };
}

// ── Sign Up ───────────────────────────────────────────────────

/**
 * Register a new account.
 * Returns result — does NOT touch UI or store directly.
 *
 * @param {string} email
 * @param {string} password
 * @param {string} fullName
 * @returns {{ user: User | null, error: string | null }}
 */
export async function signUp(email, password, fullName) {
  if (!_supabase) return { user: null, error: 'Supabase not initialized' };

  const { data, error } = await _supabase.auth.signUp({
    email: email.trim(),
    password,
    options: { data: { full_name: fullName.trim() } },
  });

  if (error) return { user: null, error: error.message };
  return { user: data.user, error: null };
}

// ── Sign Out ──────────────────────────────────────────────────

/**
 * Sign out the current user.
 * Clears store state and fires 'nirev:signout' event.
 * app.js listens for this event to switch screens.
 */
export async function signOut() {
  if (!_supabase) return;
  await _supabase.auth.signOut();
  store.resetAll();
  document.dispatchEvent(new CustomEvent('nirev:signout'));
}

// ── Password Reset ────────────────────────────────────────────

/**
 * Send a password reset email.
 * @param {string} email
 * @returns {{ error: string | null }}
 */
export async function sendPasswordReset(email) {
  if (!_supabase) return { error: 'Supabase not initialized' };

  const { error } = await _supabase.auth.resetPasswordForEmail(email.trim(), {
    redirectTo: `${window.location.origin}/index.html`,
  });

  return { error: error?.message ?? null };
}

// ── Validation Utilities ──────────────────────────────────────

/** @param {string} email */
export function validateEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

/** @param {string} password */
export function validatePassword(password) {
  if (!password || password.length < 8)
    return 'Password must be at least 8 characters';
  return null;
}

// ── Auth Form Wiring ──────────────────────────────────────────

/**
 * Wire all auth form interactions.
 * Handles tabs, sign-in submit, sign-up submit, forgot password.
 * UI feedback (toasts) is the only ui.js call here — purely presentational.
 */
export function initAuthForms() {
  _wireAuthTabs();
  _wireSignInForm();
  _wireSignUpForm();
  _wireForgotPassword();
}

function _wireAuthTabs() {
  document.querySelectorAll('.auth-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.auth-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      const target = tab.dataset.tab;
      document.querySelectorAll('.auth-form-panel').forEach(p => {
        p.classList.toggle('active', p.id === `form-${target}`);
      });
    });
  });
}

function _wireSignInForm() {
  const form = document.getElementById('form-signin');
  if (!form) return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email    = document.getElementById('signin-email')?.value ?? '';
    const password = document.getElementById('signin-password')?.value ?? '';
    const btn      = form.querySelector('.btn--primary');

    if (!validateEmail(email)) {
      showToast('Please enter a valid email address.', 'error');
      return;
    }

    btn?.classList.add('loading');
    const { error } = await signIn(email, password);
    btn?.classList.remove('loading');

    if (error) showToast(error, 'error');
    // Success is handled by onAuthStateChange in app.js
  });
}

function _wireSignUpForm() {
  const form = document.getElementById('form-signup');
  if (!form) return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name     = document.getElementById('signup-name')?.value ?? '';
    const email    = document.getElementById('signup-email')?.value ?? '';
    const password = document.getElementById('signup-password')?.value ?? '';
    const btn      = form.querySelector('.btn--primary');

    const pwError = validatePassword(password);
    if (pwError)               { showToast(pwError, 'error');        return; }
    if (!validateEmail(email)) { showToast('Invalid email.', 'error'); return; }
    if (!name.trim())          { showToast('Please enter your name.', 'error'); return; }

    btn?.classList.add('loading');
    const { error } = await signUp(email, password, name);
    btn?.classList.remove('loading');

    if (error) {
      showToast(error, 'error');
    } else {
      showToast('Account created! Please check your email to confirm.', 'success', 6000);
    }
  });
}

function _wireForgotPassword() {
  const link = document.getElementById('forgot-password-link');
  if (!link) return;

  link.addEventListener('click', async (e) => {
    e.preventDefault();
    const email = document.getElementById('signin-email')?.value ?? '';
    if (!validateEmail(email)) {
      showToast('Enter your email above first.', 'warning');
      return;
    }
    const { error } = await sendPasswordReset(email);
    if (error) {
      showToast(error, 'error');
    } else {
      showToast('Password reset email sent.', 'success');
    }
  });
}
