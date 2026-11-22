
/**
 * NIREV AI — Application Configuration
 * ─────────────────────────────────────────────────────────────
 * Single source of truth for:
 *   - Environment configuration
 *   - Supabase connection
 *   - Application constants
 *   - Desktop navigation
 *   - Role-based mobile navigation
 *   - Quick actions
 *   - Storage keys
 *   - Timeouts and limits
 *   - Feature flags
 *
 * Rule:
 * No other file should duplicate configuration values.
 * ─────────────────────────────────────────────────────────────
 */


// ── Environment Detection ─────────────────────────────────────

export const ENV = {
  isDev:
    window.location.hostname === 'localhost' ||
    window.location.hostname === '127.0.0.1',

  isProd:
    window.location.hostname !== 'localhost' &&
    window.location.hostname !== '127.0.0.1',
};


// ── Supabase ──────────────────────────────────────────────────
// Public Supabase Publishable Key.
// Access must always be protected by Supabase RLS policies.
// NEVER expose the Supabase Secret Key in frontend code.

export const SUPABASE = {
  URL: 'https://odzuzbazeysyxlwczjax.supabase.co',

  ANON_KEY:
    'sb_publishable_CKMZ3EEdqPjgDMKO6gQuUQ_jIQtD2qO',
};


// ── Groq ──────────────────────────────────────────────────────
// IMPORTANT:
// Never expose Groq secret API keys in frontend code.
// Store GROQ_API_KEY in server-side environment variables.
// All Groq requests must pass through the server-side proxy.

export const GROQ = {
  MODEL: 'openai/gpt-oss-120b',
  MAX_TOKENS: 1024,
  TEMPERATURE: 0.4,
  EDGE_FN_URL: '/functions/v1/groq-proxy',
};


// ── Application Meta ──────────────────────────────────────────

export const APP = {
  NAME: 'NIREV AI',

  FULL_NAME:
    'Next Generation Intelligence for Evaluation & Validation',

  VERSION: '1.5.0',

  DEFAULT_PAGE: 'dashboard',
};


// ── Desktop Sidebar Navigation ────────────────────────────────
// Single source of truth for desktop navigation.
// badge: optional status label.
// phase: development phase; null means currently available.

export const NAV_SECTIONS = [
  {
    section: 'Core',

    items: [
      {
        id: 'dashboard',
        label: 'Dashboard',
        icon: '◈',
        phase: null,
      },
      {
        id: 'assessment',
        label: 'Assessment',
        icon: '✦',
        phase: 2,
        badge: 'Phase 2',
      },
      {
        id: 'analytics',
        label: 'Analytics',
        icon: '◉',
        phase: 3,
        badge: 'Phase 3',
      },
    ],
  },

  {
    section: 'Progress',

    items: [
      {
        id: 'progress',
        label: 'Progress',
        icon: '⬡',
        phase: 4,
        badge: 'Phase 4',
      },
      {
        id: 'reports',
        label: 'Reports',
        icon: '◎',
        phase: 4,
        badge: 'Phase 4',
      },
    ],
  },

  {
    section: 'Classroom',

    items: [
      {
        id: 'classroom',
        label: 'Classroom',
        icon: '⬡',
        phase: null,
      },
    ],
  },

  {
    section: 'Account',

    items: [
      {
        id: 'settings',
        label: 'Settings',
        icon: '⚙',
        phase: null,
      },
    ],
  },
];


// ── All Valid Page IDs ────────────────────────────────────────
// Used by router.js for navigation validation.

export const ALL_PAGE_IDS = NAV_SECTIONS
  .flatMap(section => section.items)
  .map(item => item.id);


// ── Mobile Bottom Navigation ──────────────────────────────────
// Role-based navigation for mobile devices.
// Maximum 5 items per role.
// Every destination must exist in ALL_PAGE_IDS.

export const MOBILE_NAV_BY_ROLE = {

  teacher: [
    {
      id: 'dashboard',
      label: 'Home',
      icon: '◈',
    },
    {
      id: 'classroom',
      label: 'Classroom',
      icon: '⬡',
    },
    {
      id: 'assessment',
      label: 'Assess',
      icon: '✦',
    },
    {
      id: 'analytics',
      label: 'Analytics',
      icon: '◉',
    },
    {
      id: 'reports',
      label: 'Reports',
      icon: '◎',
    },
  ],

  learner: [
    {
      id: 'dashboard',
      label: 'Home',
      icon: '◈',
    },
    {
      id: 'assessment',
      label: 'Assess',
      icon: '✦',
    },
    {
      id: 'progress',
      label: 'Progress',
      icon: '⬡',
    },
    {
      id: 'reports',
      label: 'Reports',
      icon: '◎',
    },
    {
      id: 'settings',
      label: 'Settings',
      icon: '⚙',
    },
  ],

};


// ── Mobile Navigation Settings ───────────────────────────────

export const MOBILE_NAV = {
  ENABLED: true,

  BREAKPOINT: 600,

  MAX_ITEMS: 5,

  DEFAULT_ROLE: 'learner',
};


// ── Quick Actions ────────────────────────────────────────────
// Dashboard shortcuts.

export const QUICK_ACTIONS = [
  {
    icon: '✦',
    label: 'New Assessment',
    page: 'assessment',
  },
  {
    icon: '◈',
    label: 'View Analytics',
    page: 'analytics',
  },
  {
    icon: '◉',
    label: 'Progress Report',
    page: 'progress',
  },
  {
    icon: '⚙',
    label: 'Settings',
    page: 'settings',
  },
];


// ── Storage Keys ──────────────────────────────────────────────
// Centralized browser storage identifiers.

export const STORAGE_KEYS = {
  CURRENT_PAGE: 'nirev-page',

  ACCENT_COLOR: 'nirev-accent',

  USER_PROFILE: 'nirev-profile',
};


// ── Timeouts & Limits ─────────────────────────────────────────

export const LIMITS = {
  TOAST_DEFAULT_MS: 3500,

  TOAST_LONG_MS: 6000,

  LOADER_MIN_MS: 400,

  SESSION_CHECK_MS: 60000,

  MAX_ASSESSMENT_Q: 50,

  SCORE_DECIMAL_PLACES: 1,
};


// ── Feature Flags ─────────────────────────────────────────────
// Enable features only when their implementation is ready.

export const FEATURES = {
  ASSESSMENT_ENGINE: true,

  SCORING_ENGINE: true,

  FEEDBACK_ENGINE: true,

  ANALYTICS: true,

  PROGRESS_TRACKING: true,

  PREDICTIONS: true,

  BENCHMARKING: false,

  REPORTING: true,

  PWA: true,
};
