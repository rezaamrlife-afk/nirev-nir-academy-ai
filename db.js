/**
 * NIREV AI — Database Access Layer
 * ─────────────────────────────────────────────────────────────
 * All Supabase table operations live here.
 * No other module queries Supabase tables directly.
 *
 * Pattern:
 *   - Each function returns { data, error }
 *   - Callers decide what to do with errors (show toast, etc.)
 *   - This layer never touches the DOM or imports from ui.js
 *
 * Table Schema (planned — built incrementally per phase):
 *   profiles          Phase 1.5 (bootstrap)
 *   assessments       Phase 2
 *   assessment_questions  Phase 2
 *   scores            Phase 2
 *   feedback          Phase 3
 *   progress_snapshots    Phase 4
 *
 * Rule: Functions are grouped by table.
 *       Each function has a JSDoc with the expected table schema.
 * ─────────────────────────────────────────────────────────────
 */

import { getSupabase } from './auth.js';

// ── Internal helper ───────────────────────────────────────────

/**
 * Wraps any Supabase query in consistent error handling.
 * Returns { data: T | null, error: string | null }
 */
async function _query(fn) {
  try {
    const { data, error } = await fn();
    if (error) return { data: null, error: error.message };
    return { data, error: null };
  } catch (err) {
    return { data: null, error: err.message ?? 'Unknown database error' };
  }
}

// ═══════════════════════════════════════════════════════════════
// TABLE: profiles
// Schema:
//   id          uuid  PK (= auth.users.id)
//   full_name   text
//   email       text
//   role        text  default 'learner'
//   level       text  nullable  (CEFR: A1-C2)
//   created_at  timestamptz
//   updated_at  timestamptz
// ═══════════════════════════════════════════════════════════════

/**
 * Fetch a single user profile by auth user ID.
 * @param {string} userId
 * @returns {{ data: Profile | null, error: string | null }}
 */
export async function getProfile(userId) {
  const sb = getSupabase();
  if (!sb) return { data: null, error: 'Supabase not initialized' };

  return _query(() =>
    sb.from('profiles')
      .select('*')
      .eq('id', userId)
      .single()
  );
}

/**
 * Create a new profile row (called after sign-up).
 * @param {{ id, full_name, email, role? }} profile
 */
export async function createProfile(profile) {
  const sb = getSupabase();
  if (!sb) return { data: null, error: 'Supabase not initialized' };

  return _query(() =>
    sb.from('profiles')
      .insert({
        id:        profile.id,
        full_name: profile.full_name,
        email:     profile.email,
        role:      profile.role ?? 'learner',
      })
      .select()
      .single()
  );
}

/**
 * Update a user's profile fields.
 * @param {string} userId
 * @param {Partial<Profile>} updates
 */
export async function updateProfile(userId, updates) {
  const sb = getSupabase();
  if (!sb) return { data: null, error: 'Supabase not initialized' };

  return _query(() =>
    sb.from('profiles')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', userId)
      .select()
      .single()
  );
}

// ═══════════════════════════════════════════════════════════════
// TABLE: assessments  (Phase 2 — schema defined now, built later)
// Schema:
//   id            uuid  PK
//   user_id       uuid  FK → profiles.id
//   type          text  'placement' | 'practice' | 'mock'
//   skill         text  'writing' | 'grammar' | 'vocabulary'
//   status        text  'active' | 'completed' | 'abandoned'
//   started_at    timestamptz
//   completed_at  timestamptz nullable
//   created_at    timestamptz
// ═══════════════════════════════════════════════════════════════

/**
 * Fetch all completed assessments for a user.
 * @param {string} userId
 * @param {{ limit?: number, skill?: string }} options
 */
export async function getAssessments(userId, options = {}) {
  const sb = getSupabase();
  if (!sb) return { data: null, error: 'Supabase not initialized' };

  return _query(() => {
    let query = sb.from('assessments')
      .select('*')
      .eq('user_id', userId)
      .eq('status', 'completed')
      .order('completed_at', { ascending: false });

    if (options.skill)  query = query.eq('skill', options.skill);
    if (options.limit)  query = query.limit(options.limit);

    return query;
  });
}

/**
 * Create a new assessment session record.
 * @param {{ user_id, type, skill }} params
 */
export async function createAssessment(params) {
  const sb = getSupabase();
  if (!sb) return { data: null, error: 'Supabase not initialized' };

  return _query(() =>
    sb.from('assessments')
      .insert({
        user_id:    params.user_id,
        type:       params.type,
        skill:      params.skill,
        status:     'active',
        started_at: new Date().toISOString(),
      })
      .select()
      .single()
  );
}

/**
 * Mark an assessment as completed.
 * @param {string} assessmentId
 */
export async function completeAssessment(assessmentId) {
  const sb = getSupabase();
  if (!sb) return { data: null, error: 'Supabase not initialized' };

  return _query(() =>
    sb.from('assessments')
      .update({
        status:       'completed',
        completed_at: new Date().toISOString(),
      })
      .eq('id', assessmentId)
      .select()
      .single()
  );
}

// ═══════════════════════════════════════════════════════════════
// TABLE: scores  (Phase 2 — schema defined now, built later)
// Schema:
//   id             uuid  PK
//   user_id        uuid  FK → profiles.id
//   assessment_id  uuid  FK → assessments.id
//   skill          text
//   score          numeric  (0–100)
//   band           text     nullable (IELTS: '4.0'–'9.0')
//   cefr_level     text     nullable (A1–C2)
//   details        jsonb    sub-scores, breakdowns
//   created_at     timestamptz
// ═══════════════════════════════════════════════════════════════

/**
 * Fetch all scores for a user, newest first.
 * @param {string} userId
 * @param {{ skill?: string, limit?: number }} options
 */
export async function getScores(userId, options = {}) {
  const sb = getSupabase();
  if (!sb) return { data: null, error: 'Supabase not initialized' };

  return _query(() => {
    let query = sb.from('scores')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (options.skill) query = query.eq('skill', options.skill);
    if (options.limit) query = query.limit(options.limit);

    return query;
  });
}

/**
 * Insert a new score record.
 * @param {{ user_id, assessment_id, skill, score, band?, cefr_level?, details? }} params
 */
export async function saveScore(params) {
  const sb = getSupabase();
  if (!sb) return { data: null, error: 'Supabase not initialized' };

  return _query(() =>
    sb.from('scores')
      .insert(params)
      .select()
      .single()
  );
}

/**
 * Compute summary stats for a user's scores.
 * Returns { total, average, best, streak } using Supabase aggregation.
 * @param {string} userId
 */
export async function getScoreSummary(userId) {
  const sb = getSupabase();
  if (!sb) return { data: null, error: 'Supabase not initialized' };

  return _query(() =>
    sb.from('scores')
      .select('score, created_at, skill')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
  );
}

// ═══════════════════════════════════════════════════════════════
// TABLE: feedback  (Phase 3 — schema defined now, built later)
// Schema:
//   id             uuid  PK
//   user_id        uuid  FK → profiles.id
//   assessment_id  uuid  FK → assessments.id
//   content        text  (AI-generated feedback text)
//   model          text  (groq model used)
//   prompt_tokens  int
//   created_at     timestamptz
// ═══════════════════════════════════════════════════════════════

/**
 * Save AI-generated feedback for an assessment.
 * @param {{ user_id, assessment_id, content, model, prompt_tokens? }} params
 */
export async function saveFeedback(params) {
  const sb = getSupabase();
  if (!sb) return { data: null, error: 'Supabase not initialized' };

  return _query(() =>
    sb.from('feedback')
      .insert(params)
      .select()
      .single()
  );
}

/**
 * Get the most recent feedback entry for a user.
 * @param {string} userId
 */
export async function getLatestFeedback(userId) {
  const sb = getSupabase();
  if (!sb) return { data: null, error: 'Supabase not initialized' };

  return _query(() =>
    sb.from('feedback')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single()
  );
}

// ═══════════════════════════════════════════════════════════════
// TABLE: progress_snapshots  (Phase 4)
// Schema:
//   id          uuid  PK
//   user_id     uuid  FK → profiles.id
//   date        date
//   level       text
//   avg_score   numeric
//   created_at  timestamptz
// ═══════════════════════════════════════════════════════════════

/**
 * Fetch progress snapshots for charting.
 * @param {string} userId
 * @param {{ days?: number }} options
 */
export async function getProgressSnapshots(userId, options = {}) {
  const sb = getSupabase();
  if (!sb) return { data: null, error: 'Supabase not initialized' };

  return _query(() => {
    let query = sb.from('progress_snapshots')
      .select('*')
      .eq('user_id', userId)
      .order('date', { ascending: true });

    if (options.days) {
      const since = new Date();
      since.setDate(since.getDate() - options.days);
      query = query.gte('date', since.toISOString().split('T')[0]);
    }

    return query;
  });
}
