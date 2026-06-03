/**
 * NIREV AI — Application Configuration
 * ─────────────────────────────────────────────────────────────
 * Single source of truth for:
 *   - Environment & API keys
 *   - Application constants
 *   - Navigation structure
 *   - Feature flags
 *   - Storage key names
 *
 * Rule: No other file should contain magic strings or raw keys.
 *       Import from here instead.
 * ─────────────────────────────────────────────────────────────
 */

// ── Environment Detection ─────────────────────────────────────

export const ENV = {
  isDev:  window.location.hostname === 'localhost' ||
          window.location.hostname === '127.0.0.1',
  isProd: window.location.hostname !== 'localhost' &&
          window.location.hostname !== '127.0.0.1',
};

// ── Supabase ──────────────────────────────────────────────────
// Replace these values before deployment.
// In production, these are the public anon keys (safe to expose).

export const SUPABASE = {
  URL:      'https://odzuzbazeysyxlwczjax.supabase.co',
  ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9kenV6YmF6ZXlzeXhsd2N6amF4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA0ODUyODcsImV4cCI6MjA5NjA2MTI4N30.r8JajCWeUZcMpt1ZdoNT-DAfFTbRMzY_tdSclKndrjs',
};

// ── Groq ──────────────────────────────────────────────────────
// IMPORTANT: Never expose Groq secret keys in frontend code.
// All Groq calls must be proxied through a Supabase Edge Function.
// This object holds only non-secret configuration.

export const GROQ = {
  API_KEY:         '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',
  MODEL:           'llama-3.1-8b-instant',
  MAX_TOKENS:      1024,
  TEMPERATURE:     0.4,
  EDGE_FN_URL:     '/functions/v1/groq-proxy',
};

// ── Application Meta ──────────────────────────────────────────

export const APP = {
  NAME:       'NIREV AI',
  FULL_NAME:  'Next Generation Intelligence for Evaluation & Validation',
  VERSION:    '1.5.0',
  DEFAULT_PAGE: 'dashboard',
};

// ── Navigation Structure ──────────────────────────────────────
// Single definition used by router.js and sidebar builder.
// badge: optional pill label on nav item
// phase: which phase this page becomes active (null = active now)

export const NAV_SECTIONS = [
  {
    section: 'Core',
    items: [
      { id: 'dashboard',  label: 'Dashboard',  icon: '◈', phase: null   },
      { id: 'assessment', label: 'Assessment', icon: '✦', phase: 2, badge: 'Phase 2' },
      { id: 'analytics',  label: 'Analytics',  icon: '◉', phase: 3, badge: 'Phase 3' },
    ],
  },
  {
    section: 'Progress',
    items: [
      { id: 'progress', label: 'Progress', icon: '⬡', phase: 4, badge: 'Phase 4' },
      { id: 'reports',  label: 'Reports',  icon: '◎', phase: 4, badge: 'Phase 4' },
    ],
  },
  {
    section: 'Account',
    items: [
      { id: 'settings', label: 'Settings', icon: '⚙', phase: null },
    ],
  },
];

// Flat list of all page IDs — used by router for validation
export const ALL_PAGE_IDS = NAV_SECTIONS
  .flatMap(s => s.items)
  .map(i => i.id);

// ── Quick Actions (Dashboard widget) ─────────────────────────

export const QUICK_ACTIONS = [
  { icon: '✦', label: 'New Assessment', page: 'assessment' },
  { icon: '◈', label: 'View Analytics',  page: 'analytics'  },
  { icon: '◉', label: 'Progress Report', page: 'progress'   },
  { icon: '⚙', label: 'Settings',        page: 'settings'   },
];

// ── Storage Keys ──────────────────────────────────────────────
// Centralised so a rename never requires grep across files.

export const STORAGE_KEYS = {
  CURRENT_PAGE:   'nirev-page',      // sessionStorage
  ACCENT_COLOR:   'nirev-accent',    // localStorage
  USER_PROFILE:   'nirev-profile',   // localStorage (cached profile)
};

// ── Timeouts & Limits ─────────────────────────────────────────

export const LIMITS = {
  TOAST_DEFAULT_MS:     3500,
  TOAST_LONG_MS:        6000,
  LOADER_MIN_MS:        400,   // minimum loader display time (UX)
  SESSION_CHECK_MS:     60000, // how often to re-verify session
  MAX_ASSESSMENT_Q:     50,    // max questions per assessment session
  SCORE_DECIMAL_PLACES: 1,
};

// ── Feature Flags ─────────────────────────────────────────────
// Set to true as each feature is built and ready.

export const FEATURES = {
  ASSESSMENT_ENGINE:  true,   // Phase 2 ✅
  SCORING_ENGINE:     true,   // Phase 2 ✅
  FEEDBACK_ENGINE:    true,   // Phase 3 ✅
  ANALYTICS:          true,   // Phase 3 ✅
  PROGRESS_TRACKING:  false,  // Phase 4
  PREDICTIONS:        false,  // Phase 4
  BENCHMARKING:       false,  // Phase 5
  REPORTING:          false,  // Phase 4
  PWA:                false,  // Phase 5
};
