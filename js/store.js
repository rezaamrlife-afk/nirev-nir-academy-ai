/**
 * NIREV AI — Application State Store
 * ─────────────────────────────────────────────────────────────
 * Lightweight reactive store without any framework dependency.
 *
 * Pattern: Observer / Pub-Sub
 *   - State is a plain object (never mutated directly externally)
 *   - Modules call store.set(key, value) to update
 *   - Modules call store.subscribe(key, callback) to react
 *   - Modules call store.get(key) to read
 *
 * Rule: All shared application state lives here.
 *       Module-private state stays inside that module.
 * ─────────────────────────────────────────────────────────────
 */

// ── Internal State Shape ──────────────────────────────────────
// This defines every top-level key the app will ever use.
// Future modules add their slice here before Phase implementation.

const _state = {
  // ── Auth ──────────────────────────────────────────────────
  user:         null,    // Supabase user object | null
  isAuthed:     false,   // boolean

  // ── Navigation ────────────────────────────────────────────
  currentPage:  'dashboard',

  // ── User Profile (Phase 2+) ───────────────────────────────
  profile: {
    id:           null,
    fullName:     null,
    email:        null,
    role:         'learner',   // 'learner' | 'teacher' | 'admin'
    level:        null,        // CEFR level: A1–C2 | null until assessed
    createdAt:    null,
  },

  // ── Assessment Session (Phase 2) ──────────────────────────
  assessment: {
    sessionId:    null,
    type:         null,   // 'placement' | 'practice' | 'mock'
    skill:        null,   // 'writing' | 'speaking' | 'grammar' | 'vocabulary'
    status:       'idle', // 'idle' | 'active' | 'paused' | 'completed'
    questions:    [],
    currentIndex: 0,
    answers:      {},
    startedAt:    null,
    completedAt:  null,
  },

  // ── Scoring (Phase 2) ─────────────────────────────────────
  scoring: {
    lastScore:    null,
    history:      [],    // [{ sessionId, score, date, skill }]
    average:      null,
    streak:       0,
  },

  // ── Feedback (Phase 3) ───────────────────────────────────
  feedback: {
    lastFeedback: null,
    isGenerating: false,
  },

  // ── Analytics (Phase 3) ──────────────────────────────────
  analytics: {
    loaded:       false,
    scoresBySkill: {},
    progressData:  [],
  },

  // ── Predictions (Phase 4) ────────────────────────────────
  predictions: {
    nextLevel:    null,
    estimatedDays: null,
    confidence:   null,
  },

  // ── UI State ──────────────────────────────────────────────
  ui: {
    sidebarOpen:  false,
    loaderActive: false,
    loaderText:   '',
  },
};

// ── Subscriber Registry ───────────────────────────────────────
// Map<key: string, Set<callback: Function>>
const _subscribers = new Map();

// ── Internal Helpers ──────────────────────────────────────────

/**
 * Deep-reads a dot-path from _state.
 * e.g. _read('assessment.status') → 'idle'
 */
function _read(path) {
  return path.split('.').reduce((obj, key) => obj?.[key], _state);
}

/**
 * Shallow-writes a top-level key into _state.
 * For nested keys, merges one level deep.
 * e.g. _write('assessment', { status: 'active' })
 *      merges into _state.assessment without replacing other keys
 */
function _write(topKey, value) {
  if (typeof _state[topKey] === 'object' &&
      _state[topKey] !== null &&
      !Array.isArray(_state[topKey]) &&
      typeof value === 'object' &&
      value !== null) {
    _state[topKey] = { ..._state[topKey], ...value };
  } else {
    _state[topKey] = value;
  }
}

/**
 * Notify all subscribers for a given top-level key.
 */
function _notify(topKey) {
  const subs = _subscribers.get(topKey);
  if (!subs) return;
  const currentValue = _state[topKey];
  subs.forEach(cb => {
    try { cb(currentValue); }
    catch (err) { console.error(`[Store] subscriber error for "${topKey}":`, err); }
  });
}

// ── Public API ────────────────────────────────────────────────

const store = {

  /**
   * Read a value from state.
   * @param {string} key - top-level key or dot-path ('assessment.status')
   * @returns {*}
   */
  get(key) {
    return _read(key);
  },

  /**
   * Write a value to state and notify subscribers.
   * @param {string} topKey - must be a top-level key defined in _state
   * @param {*} value - replaces or merges into the current value
   */
  set(topKey, value) {
    if (!(topKey in _state)) {
      console.warn(`[Store] Unknown key: "${topKey}". Add it to _state first.`);
      return;
    }
    _write(topKey, value);
    _notify(topKey);
  },

  /**
   * Subscribe to changes on a top-level key.
   * @param {string} topKey
   * @param {Function} callback - called with the new value on every change
   * @returns {Function} unsubscribe function
   */
  subscribe(topKey, callback) {
    if (!_subscribers.has(topKey)) {
      _subscribers.set(topKey, new Set());
    }
    _subscribers.get(topKey).add(callback);

    // Return unsubscribe
    return () => {
      _subscribers.get(topKey)?.delete(callback);
    };
  },

  /**
   * One-time snapshot of the entire state (for debugging).
   * Never use this for reactive reads — use get() instead.
   */
  snapshot() {
    return JSON.parse(JSON.stringify(_state));
  },

  /**
   * Reset a top-level key back to its original empty/null state.
   * Useful when user signs out.
   * @param {string} topKey
   */
  reset(topKey) {
    const resets = {
      user:        null,
      isAuthed:    false,
      currentPage: 'dashboard',
      profile:     { id: null, fullName: null, email: null, role: 'learner', level: null, createdAt: null },
      assessment:  { sessionId: null, type: null, skill: null, status: 'idle', questions: [], currentIndex: 0, answers: {}, startedAt: null, completedAt: null },
      scoring:     { lastScore: null, history: [], average: null, streak: 0 },
      feedback:    { lastFeedback: null, isGenerating: false },
      analytics:   { loaded: false, scoresBySkill: {}, progressData: [] },
      predictions: { nextLevel: null, estimatedDays: null, confidence: null },
      ui:          { sidebarOpen: false, loaderActive: false, loaderText: '' },
    };
    if (topKey in resets) {
      _state[topKey] = resets[topKey];
      _notify(topKey);
    }
  },

  /**
   * Reset all user-owned state on sign-out.
   */
  resetAll() {
    ['user', 'isAuthed', 'profile', 'assessment', 'scoring',
     'feedback', 'analytics', 'predictions'].forEach(k => this.reset(k));
  },
};

export default store;
