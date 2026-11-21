/**
 * NIREV AI — Theme System
 * Manages color tokens, theme state, and visual utilities
 */

export const NIREV_THEME = {
  colors: {
    black: {
      void:     '#040404',
      deep:     '#080808',
      base:     '#0D0D0D',
      surface:  '#121212',
      elevated: '#181818',
      card:     '#1E1E1E',
      border:   '#2A2A2A',
      muted:    '#333333',
    },
    gold: {
      pure:   '#D4AF37',
      bright: '#E6C55A',
      light:  '#F7D774',
      dim:    '#A08920',
    },
    orange: {
      core:   '#FF8A00',
      bright: '#FF9F1A',
    },
    white: {
      primary:   '#F5F5F0',
      secondary: '#C8C8C0',
      muted:     '#888884',
    },
    status: {
      success: '#2ECC71',
      warning: '#F39C12',
      danger:  '#E74C3C',
      info:    '#3498DB',
    }
  },

  fonts: {
    display: "'Cormorant Garamond', Georgia, serif",
    ui:      "'Syne', sans-serif",
    mono:    "'DM Mono', 'Courier New', monospace",
  },

  breakpoints: {
    mobile: 600,
    tablet: 900,
    desktop: 1200,
  }
};

const THEME_KEY    = 'nirev-theme';
const THEME_COLORS = { light: '#F5F4F0', dark: '#080808' };

function _readSavedTheme() {
  try { return localStorage.getItem(THEME_KEY); } catch (e) { return null; }
}

/** Current theme: 'light' | 'dark' */
export function getTheme() {
  return document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
}

/** Apply a theme. Persists the choice unless persist === false. */
export function setTheme(theme, persist = true) {
  const next = theme === 'dark' ? 'dark' : 'light';
  document.documentElement.setAttribute('data-theme', next);

  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', THEME_COLORS[next]);

  const btn = document.getElementById('btn-theme-toggle');
  if (btn) {
    btn.setAttribute('aria-pressed', String(next === 'dark'));
    btn.setAttribute('aria-label', next === 'dark' ? 'Switch to light theme' : 'Switch to dark theme');
  }

  if (persist) {
    try { localStorage.setItem(THEME_KEY, next); } catch (e) { /* storage unavailable */ }
  }
  return next;
}

export function toggleTheme() {
  return setTheme(getTheme() === 'dark' ? 'light' : 'dark');
}

/**
 * Initialize theme — Light is the default; a saved 'dark' choice is honoured.
 */
export function initTheme() {
  setTheme(_readSavedTheme() === 'dark' ? 'dark' : 'light', false);

  // Optional: apply saved user accent color preference
  const savedAccent = localStorage.getItem('nirev-accent');
  if (savedAccent === 'orange') {
    setAccentOrange();
  }
}

// Used by the topbar toggle button in index.html (kept off window.NIREV,
// which app.js reassigns).
if (typeof window !== 'undefined') window.nirevToggleTheme = toggleTheme;

/**
 * Switch primary accent to orange (alternative mode)
 */
export function setAccentOrange() {
  document.documentElement.style.setProperty('--accent-primary', 'var(--orange-core)');
  localStorage.setItem('nirev-accent', 'orange');
}

/**
 * Switch primary accent back to gold (default)
 */
export function setAccentGold() {
  document.documentElement.style.removeProperty('--accent-primary');
  localStorage.setItem('nirev-accent', 'gold');
}

/**
 * Check if mobile viewport
 */
export function isMobile() {
  return window.innerWidth <= NIREV_THEME.breakpoints.mobile;
}

export function isTablet() {
  return window.innerWidth <= NIREV_THEME.breakpoints.tablet;
}
