/**
 * NIREV AI — Settings Page Controller
 * ─────────────────────────────────────────────────────────────
 * Version: 1.0.0
 *
 * Features:
 *   - Load profile from Supabase on navigate
 *   - Edit: full name, email (read-only), CEFR level, goal
 *   - Save profile to Supabase + update store
 *   - Sign out
 *   - Delete account (confirmation required)
 * ─────────────────────────────────────────────────────────────
 */

import store from './store.js';
import { getProfile, updateProfile } from './db.js';
import { showToast } from './ui.js';
import { signOut } from './auth.js';

// ── State ─────────────────────────────────────────────────────

const _state = {
  profile: null,
  isDirty: false,
};

// ── Init ──────────────────────────────────────────────────────

let _settingsInitialized = false;

export function initSettingsPage() {
  if (_settingsInitialized) return;
  _settingsInitialized = true;

  document.addEventListener('nirev:navigate', (e) => {
    if (e.detail?.pageId === 'settings') {
      _loadAndRender();
    }
  });

  // If already on settings page when init runs, load immediately
  const activePage = sessionStorage.getItem('nirev-page');
  if (activePage === 'settings') {
    _loadAndRender();
  }
}

// ── Load ──────────────────────────────────────────────────────

async function _loadAndRender() {
  const userId = store.get('user')?.id;
  if (!userId) return;

  const container = document.getElementById('settings-content');
  if (!container) return;

  // Show loading state
  container.innerHTML = `
    <div class="assessment-loading">
      <div class="assessment-loading__ring"></div>
      <div class="assessment-loading__text">Loading profile...</div>
    </div>`;

  try {
    const { data: profile } = await getProfile(userId);

    // Merge with store user data
    const user = store.get('user');
    _state.profile = {
      full_name: profile?.full_name || user?.user_metadata?.full_name || '',
      email:     profile?.email    || user?.email || '',
      level:     profile?.level    || store.get('profile.level') || null,
      goal:      profile?.goal     || null,
      role:      profile?.role     || 'learner',
      created_at: profile?.created_at || null,   // read-only, display only
    };

    _render(container);

  } catch (err) {
    container.innerHTML = `<div class="empty-state">
      <div class="empty-state__title">Could not load profile</div>
      <button class="btn btn--secondary" onclick="window.NIREV.navigateTo('settings')">Retry</button>
    </div>`;
  }
}

// ── Render ────────────────────────────────────────────────────

function _render(container) {
  const p = _state.profile;
  const initials = _getInitials(p.full_name || p.email);
  const isTeacher = p.role === 'teacher';   // role comes from the stored profile; never editable here

  container.innerHTML = `

    <!-- Profile Overview -->
    <div class="settings-section settings-overview">
      <div class="settings-avatar-row">
        <div class="settings-avatar" id="settings-avatar">${initials}</div>
        <div class="settings-avatar-info">
          <div class="settings-avatar-name" id="settings-display-name">${p.full_name || 'Your Name'}</div>
          <div class="settings-avatar-email">${p.email}</div>
        </div>
        <span class="settings-role-badge">${_escape(p.role || 'learner')}</span>
      </div>
    </div>

    <!-- Personal Information -->
    <div class="settings-section settings-card--personal">
      <div class="settings-section__title">
        <span class="settings-section__icon">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="8" r="4"/><path d="M4 21c0-4.4 3.6-7 8-7s8 2.6 8 7"/></svg>
        </span>
        Personal Information
      </div>
      ${isTeacher ? '<div class="form-label settings-hint">Update the name shown on your teacher account. Your email cannot be changed here.</div>' : ''}

      <div class="settings-row">
        <div class="form-group">
          <label class="form-label" for="settings-name">Full Name</label>
          <input id="settings-name" type="text" class="form-input"
                 value="${_escape(p.full_name)}"
                 placeholder="Your full name" autocomplete="name" />
        </div>
        <div class="form-group">
          <label class="form-label" for="settings-email">Email</label>
          <input id="settings-email" type="email" class="form-input"
                 value="${_escape(p.email)}"
                 disabled />
        </div>
      </div>
    </div>

    ${isTeacher ? '' : `
    <!-- Learning Profile (CEFR) -->
    <div class="settings-section settings-card--level">
      <div class="settings-section__title">
        <span class="settings-section__icon">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 20V14"/><path d="M10 20V9"/><path d="M16 20V5"/><path d="M22 20H2"/></svg>
        </span>
        Learning Profile
      </div>
      <div class="form-label settings-hint">
        Current CEFR level — select your level, or let AI determine it
      </div>
      <div class="cefr-btn cefr-btn--ai ${!p.level ? 'selected' : ''}" role="button" tabindex="0">
        <span class="cefr-btn--ai__icon" aria-hidden="true">✦</span>
        <span class="cefr-btn--ai__text">
          <span class="cefr-btn__level">AI-determined</span>
          <span class="cefr-btn__desc">Level is estimated from your assessments</span>
        </span>
        <span class="cefr-btn--ai__check" aria-hidden="true">✓</span>
      </div>
      <div class="cefr-grid" id="cefr-grid">
        ${_buildCEFRGrid(p.level)}
      </div>
    </div>

    <!-- Learning Goals -->
    <div class="settings-section settings-card--goals">
      <div class="settings-section__title">
        <span class="settings-section__icon">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.2"/></svg>
        </span>
        Learning Goals
      </div>
      <div class="goal-grid" id="goal-grid">
        ${_buildGoalGrid(p.goal)}
      </div>
    </div>
    `}

    ${isTeacher ? _teacherAccountCard(p) : ''}

    <!-- Save Bar -->
    <div class="settings-save-bar">
      <div class="settings-save-bar__status" id="settings-status" role="status" aria-live="polite">Unsaved changes</div>
      <div class="settings-save-bar__actions">
        <button class="btn btn--ghost" id="settings-reset-btn">Reset</button>
        <button class="btn btn--primary" id="settings-save-btn">Save Changes</button>
      </div>
    </div>

    ${isTeacher ? '' : `
    <!-- Account Actions -->
    <div class="settings-section settings-account">
      <div class="settings-section__title">
        <span class="settings-section__icon">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3l8 3v6c0 4.5-3.4 8.2-8 9-4.6-.8-8-4.5-8-9V6l8-3z"/></svg>
        </span>
        Account Actions
      </div>
      <div class="danger-item">
        <div class="danger-item__info">
          <div class="danger-item__title">Sign Out</div>
          <div class="danger-item__desc">Sign out of your NIREV account</div>
        </div>
        <button class="btn btn--secondary btn--sm" id="settings-signout-btn">Sign Out</button>
      </div>
    </div>
    `}

  `;

  _wirePage();
  _updateStatus('saved');
}

// ── Wire ──────────────────────────────────────────────────────

function _wirePage() {
  // Name input
  const nameInput = document.getElementById('settings-name');
  if (nameInput) {
    nameInput.addEventListener('input', () => {
      _state.isDirty = true;
      _updateStatus('unsaved');
      // Live update avatar and display name
      const name = nameInput.value.trim();
      const avatarEl = document.getElementById('settings-avatar');
      const displayEl = document.getElementById('settings-display-name');
      if (avatarEl) avatarEl.textContent = _getInitials(name || _state.profile.email);
      if (displayEl) displayEl.textContent = name || 'Your Name';
    });
  }

  // CEFR grid
  document.querySelectorAll('.cefr-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.cefr-btn').forEach(b => b.classList.remove('selected'));
      btn.classList.toggle('selected');
      _state.isDirty = true;
      _updateStatus('unsaved');
    });
  });

  // Goal grid
  document.querySelectorAll('.goal-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.goal-btn').forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
      _state.isDirty = true;
      _updateStatus('unsaved');
    });
  });

  // Save button
  const saveBtn = document.getElementById('settings-save-btn');
  if (saveBtn) saveBtn.addEventListener('click', _save);

  // Reset button
  const resetBtn = document.getElementById('settings-reset-btn');
  if (resetBtn) resetBtn.addEventListener('click', () => {
    const container = document.getElementById('settings-content');
    if (container) _render(container);
    showToast('Changes reset', 'info');
  });

  // Sign out
  const signOutBtn = document.getElementById('settings-signout-btn');
  if (signOutBtn) signOutBtn.addEventListener('click', async () => {
    signOutBtn.classList.add('loading');
    await signOut();
  });
}

// ── Save ──────────────────────────────────────────────────────

async function _save() {
  const userId = store.get('user')?.id;
  if (!userId) return;

  const saveBtn = document.getElementById('settings-save-btn');
  if (saveBtn) saveBtn.classList.add('loading');
  _updateStatus('saving');

  // Collect values
  const nameInput = document.getElementById('settings-name');
  const selectedCEFR = document.querySelector('.cefr-btn.selected');
  const selectedGoal = document.querySelector('.goal-btn.selected');

  const isTeacher = _state.profile?.role === 'teacher';

  // Teachers only update their name — CEFR level, learning goal and role are never sent.
  const updates = isTeacher
    ? { full_name: nameInput?.value.trim() || _state.profile.full_name }
    : {
        full_name: nameInput?.value.trim() || _state.profile.full_name,
        level:     selectedCEFR?.dataset.level || null,
        goal:      selectedGoal?.dataset.goal  || null,
      };

  try {
    const { data, error } = await updateProfile(userId, updates);

    if (error) {
      showToast('Could not save profile. Try again.', 'error');
      _updateStatus('error');
    } else {
      // Update store
      store.set('profile', isTeacher
        ? { ...store.get('profile'), fullName: updates.full_name }
        : { ...store.get('profile'), fullName: updates.full_name, level: updates.level });

      // Update sidebar user widget
      const nameEl = document.getElementById('user-name');
      if (nameEl) nameEl.textContent = updates.full_name;

      _state.profile = { ..._state.profile, ...updates };
      _state.isDirty = false;
      showToast('Profile saved', 'success');
      _updateStatus('saved');
    }
  } catch (err) {
    showToast('Could not save profile.', 'error');
    _updateStatus('error');
  } finally {
    if (saveBtn) saveBtn.classList.remove('loading');
  }
}

// ── Helpers ───────────────────────────────────────────────────

function _updateStatus(state) {
  const el = document.getElementById('settings-status');
  if (!el) return;
  el.className = 'settings-save-bar__status';
  if (state === 'saved') {
    el.textContent = '✓ All changes saved';
    el.classList.add('saved');
  } else if (state === 'saving') {
    el.textContent = 'Saving...';
  } else if (state === 'error') {
    el.textContent = '✕ Save failed';
    el.classList.add('error');
  } else {
    el.textContent = 'Unsaved changes';
  }
}

function _teacherAccountCard(p) {
  const since = p.created_at ? new Date(p.created_at) : null;
  const sinceText = since && !isNaN(since)
    ? since.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
    : '';
  return `
    <!-- Account Information (teacher) -->
    <div class="settings-section settings-card--account">
      <div class="settings-section__title">
        <span class="settings-section__icon">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3l8 3v6c0 4.5-3.4 8.2-8 9-4.6-.8-8-4.5-8-9V6l8-3z"/></svg>
        </span>
        Account Information
      </div>
      <div class="form-label settings-hint">Your sign-in details. Your role is set when the account is created and cannot be changed here.</div>
      <ul class="settings-info-list">
        <li><span>Email</span><strong>${_escape(p.email)}</strong></li>
        <li><span>Role</span><strong>Teacher</strong></li>
        ${sinceText ? `<li><span>Member since</span><strong>${sinceText}</strong></li>` : ''}
      </ul>
      <div class="danger-item">
        <div class="danger-item__info">
          <div class="danger-item__title">Sign Out</div>
          <div class="danger-item__desc">Sign out of your NIREV account</div>
        </div>
        <button class="btn btn--secondary btn--sm" id="settings-signout-btn">Sign Out</button>
      </div>
    </div>`;
}

function _buildCEFRGrid(currentLevel) {
  const levels = [
    { level: 'A1', desc: 'Beginner' },
    { level: 'A2', desc: 'Elementary' },
    { level: 'B1', desc: 'Intermediate' },
    { level: 'B2', desc: 'Upper Int.' },
    { level: 'C1', desc: 'Advanced' },
    { level: 'C2', desc: 'Mastery' },
  ];
  return levels.map(l => `
    <div class="cefr-btn ${l.level === currentLevel ? 'selected' : ''}"
         data-level="${l.level}" role="button" tabindex="0">
      <span class="cefr-btn__level">${l.level}</span>
      <span class="cefr-btn__desc">${l.desc}</span>
    </div>`).join('');
}

function _buildGoalGrid(currentGoal) {
  const goals = [
    { goal: 'ielts',       icon: '🎯', title: 'IELTS Preparation',    desc: 'Targeting a specific band score' },
    { goal: 'academic',    icon: '🎓', title: 'Academic English',     desc: 'University or research purposes' },
    { goal: 'business',    icon: '💼', title: 'Business English',     desc: 'Professional communication' },
    { goal: 'general',     icon: '🌍', title: 'General Improvement',  desc: 'Overall language development' },
    { goal: 'teaching',    icon: '📚', title: 'Teacher Development',  desc: 'ELT professional development' },
  ];
  return goals.map(g => `
    <div class="goal-btn ${g.goal === currentGoal ? 'selected' : ''}"
         data-goal="${g.goal}" role="button" tabindex="0">
      <span class="goal-btn__icon">${g.icon}</span>
      <div class="goal-btn__text">
        <div class="goal-btn__title">${g.title}</div>
        <div class="goal-btn__desc">${g.desc}</div>
      </div>
      <span class="goal-btn__check">✓</span>
    </div>`).join('');
}

function _getInitials(name) {
  if (!name) return '?';
  const parts = name.trim().split(' ');
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

function _escape(str) {
  return (str || '').replace(/"/g, '&quot;').replace(/</g, '&lt;');
}
