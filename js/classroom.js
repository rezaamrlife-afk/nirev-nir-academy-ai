/**
 * NIREV AI — Classroom Page Controller
 * ─────────────────────────────────────────────────────────────
 * Version: 7.1.0 — Phase 7D
 *
 * Teacher view:
 *   - Create a class → generates unique 6-char code
 *   - List teacher's classes
 *   - View students with scores, avg, CEFR level, last assessment
 *
 * Learner view:
 *   - Join a class by entering a code
 *   - View joined classes
 * ─────────────────────────────────────────────────────────────
 */

import store from './store.js';
import { getSupabase } from './auth.js';
import { showToast } from './ui.js';

// ── Initialize ────────────────────────────────────────────────

export function initClassroomPage() {
  document.addEventListener('nirev:navigate', (e) => {
    if (e.detail?.pageId === 'classroom') {
      _loadClassroomPage();
      _clearClassroomBadge(); // teacher opened classroom — clear badge
    }
  });

  // Check for completed assignments on load (teacher only)
  _checkCompletedAssignments();

  // Re-check every 60 seconds
  setInterval(_checkCompletedAssignments, 60000);
}

// ── Notification Badge ────────────────────────────────────────

const BADGE_KEY = 'nirev-classroom-badge-seen';

async function _checkCompletedAssignments() {
  const profile = store.get('profile');
  if (profile?.role !== 'teacher') return;

  const sb        = getSupabase();
  const teacherId = store.get('user')?.id;
  if (!sb || !teacherId) return;

  // Get last-seen timestamp from localStorage
  const lastSeen = localStorage.getItem(BADGE_KEY) ?? '1970-01-01';

  const { data, error } = await sb
    .from('assignments')
    .select('id', { count: 'exact' })
    .eq('teacher_id', teacherId)
    .eq('status', 'completed')
    .gt('updated_at', lastSeen);

  if (error || !data) return;

  const count = data.length;
  _setClassroomBadge(count);
}

function _setClassroomBadge(count) {
  const navItem = document.querySelector('.nav-item[data-page="classroom"]');
  if (!navItem) return;

  let badge = navItem.querySelector('.nav-notification-badge');

  if (count <= 0) {
    badge?.remove();
    return;
  }

  if (!badge) {
    badge = document.createElement('span');
    badge.className = 'nav-notification-badge';
    navItem.appendChild(badge);
  }
  badge.textContent = count > 9 ? '9+' : count;
}

function _clearClassroomBadge() {
  localStorage.setItem(BADGE_KEY, new Date().toISOString());
  _setClassroomBadge(0);
}

// ── Load ──────────────────────────────────────────────────────

async function _loadClassroomPage() {
  const container = document.getElementById('classroom-content');
  if (!container) return;

  const profile = store.get('profile');
  const role    = profile?.role ?? 'learner';

  if (role === 'teacher') {
    await _renderTeacherView(container);
  } else {
    _renderLearnerView(container);
  }
}

// ── Teacher View ──────────────────────────────────────────────

async function _renderTeacherView(container) {
  container.innerHTML = _loadingHTML();

  const sb     = getSupabase();
  const userId = store.get('user')?.id;
  if (!sb || !userId) { container.innerHTML = _errorHTML(); return; }

  const { data: classes, error } = await sb
    .from('classes')
    .select('*, class_members(count)')
    .eq('teacher_id', userId)
    .order('created_at', { ascending: false });

  if (error) { container.innerHTML = _errorHTML(error.message); return; }

  container.innerHTML = `
    <div class="classroom-header">
      <div>
        <h2 class="classroom-title">My Classes</h2>
        <p class="classroom-subtitle">Create and manage your student groups</p>
      </div>
      <button class="btn btn--primary" id="btn-create-class">
        <span>＋</span> New Class
      </button>
    </div>

    <!-- Create Class Modal -->
    <div class="create-class-modal" id="create-class-modal" style="display:none;">
      <div class="create-class-modal__backdrop" id="modal-backdrop"></div>
      <div class="create-class-modal__box">
        <div class="create-class-modal__header">
          <h3>Create New Class</h3>
          <button class="modal-close" id="btn-modal-close">✕</button>
        </div>
        <div class="form-group">
          <label class="form-label" for="class-name-input">Class Name</label>
          <input id="class-name-input" type="text" class="form-input"
                 placeholder="e.g. Intermediate B1 — Monday Group" maxlength="80" />
        </div>
        <button class="btn btn--primary btn--full" id="btn-confirm-create">
          Create Class
        </button>
      </div>
    </div>

    <!-- Classes Grid -->
    <div class="classes-grid" id="classes-grid">
      ${classes && classes.length > 0
        ? classes.map(cls => _classCardHTML(cls)).join('')
        : _emptyClassesHTML()
      }
    </div>

    <!-- Student Panel -->
    <div class="student-panel" id="student-panel" style="display:none;">
      <div class="student-panel__header">
        <button class="btn-back" id="btn-back-classes">← Back to Classes</button>
        <h3 class="student-panel__title" id="student-panel-title">Students</h3>
        <div class="class-code-display" id="class-code-display"></div>
      </div>
      <div id="student-list-content"></div>
    </div>
  `;

  _wireTeacherEvents();
}

function _classCardHTML(cls) {
  const count = cls.class_members?.[0]?.count ?? 0;
  return `
    <div class="class-card" data-class-id="${cls.id}" data-class-name="${cls.name}" data-class-code="${cls.code}">
      <div class="class-card__top">
        <div class="class-card__icon">◈</div>
        <div class="class-card__code">${cls.code}</div>
        <button class="btn-delete-class" data-class-id="${cls.id}" data-class-name="${cls.name}" title="Delete class">✕</button>
      </div>
      <div class="class-card__name">${cls.name}</div>
      <div class="class-card__meta">${count} student${count !== 1 ? 's' : ''}</div>
      <button class="btn btn--ghost btn--sm class-card__view-btn"
              data-class-id="${cls.id}"
              data-class-name="${cls.name}"
              data-class-code="${cls.code}">
        View Students
      </button>
    </div>
  `;
}

function _emptyClassesHTML() {
  return `
    <div class="classroom-empty">
      <div class="empty-state__icon">◈</div>
      <div class="empty-state__title">No classes yet</div>
      <div class="empty-state__text">Create your first class to get a shareable code for your students.</div>
    </div>
  `;
}

// ── Learner View ──────────────────────────────────────────────

function _renderLearnerView(container) {
  container.innerHTML = `
    <div class="classroom-header">
      <div>
        <h2 class="classroom-title">Join a Class</h2>
        <p class="classroom-subtitle">Enter the code your teacher gave you</p>
      </div>
    </div>
    <div class="join-class-card">
      <div class="form-group">
        <label class="form-label" for="join-code-input">Class Code</label>
        <input id="join-code-input" type="text" class="form-input join-code-input"
               placeholder="e.g. AB12CD" maxlength="6"
               style="text-transform:uppercase;letter-spacing:0.2em;font-size:1.25rem;" />
      </div>
      <button class="btn btn--primary btn--full" id="btn-join-class">
        Join Class
      </button>
      <div id="my-classes-section" style="margin-top:var(--space-6);">
        <div class="section-header">
          <h3 class="section-title">My Classes</h3>
        </div>
        <div id="learner-classes-list"><div class="assessment-loading"><div class="assessment-loading__ring"></div></div></div>
      </div>
    </div>
  `;
  _wireLearnerEvents();
  _loadLearnerClasses();
}

// ── Wire Events — Teacher ─────────────────────────────────────

function _wireTeacherEvents() {
  document.getElementById('btn-create-class')?.addEventListener('click', () => {
    document.getElementById('create-class-modal').style.display = 'flex';
    document.getElementById('class-name-input')?.focus();
  });

  const closeModal = () => {
    document.getElementById('create-class-modal').style.display = 'none';
    const inp = document.getElementById('class-name-input');
    if (inp) inp.value = '';
  };
  document.getElementById('btn-modal-close')?.addEventListener('click', closeModal);
  document.getElementById('modal-backdrop')?.addEventListener('click', closeModal);

  document.getElementById('btn-confirm-create')?.addEventListener('click', _createClass);
  document.getElementById('class-name-input')?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') _createClass();
  });

  document.getElementById('classes-grid')?.addEventListener('click', (e) => {
    const viewBtn = e.target.closest('.class-card__view-btn');
    if (viewBtn) {
      _showStudentPanel(viewBtn.dataset.classId, viewBtn.dataset.className, viewBtn.dataset.classCode);
      return;
    }
    const delBtn = e.target.closest('.btn-delete-class');
    if (delBtn) {
      e.stopPropagation();
      _deleteClass(delBtn.dataset.classId, delBtn.dataset.className);
    }
  });

  document.getElementById('btn-back-classes')?.addEventListener('click', () => {
    document.getElementById('student-panel').style.display = 'none';
    document.getElementById('classes-grid').style.display  = 'grid';
  });
}

// ── Delete Class ──────────────────────────────────────────────

async function _deleteClass(classId, className) {
  if (!confirm('Delete "' + className + '"?\n\nThis will remove all students from the class. This cannot be undone.')) return;

  const sb = getSupabase();

  // Delete members first (FK constraint)
  await sb.from('class_members').delete().eq('class_id', classId);

  // Delete class
  const { error } = await sb.from('classes').delete().eq('id', classId);

  if (error) {
    showToast('Could not delete class: ' + error.message, 'error');
    return;
  }

  showToast('Class deleted.', 'success');

  // Remove card from DOM
  const card = document.querySelector('.class-card[data-class-id="' + classId + '"]');
  if (card) {
    card.remove();
    // Show empty state if no more cards
    const grid = document.getElementById('classes-grid');
    if (grid && !grid.querySelector('.class-card')) {
      grid.innerHTML = _emptyClassesHTML();
    }
  }
}

// ── Create Class ──────────────────────────────────────────────

async function _createClass() {
  const nameInput = document.getElementById('class-name-input');
  const name      = nameInput?.value?.trim();
  if (!name) { showToast('Please enter a class name.', 'error'); return; }

  const btn = document.getElementById('btn-confirm-create');
  btn?.classList.add('loading');

  const sb     = getSupabase();
  const userId = store.get('user')?.id;
  const code   = _generateCode();

  const { data, error } = await sb
    .from('classes')
    .insert({ teacher_id: userId, name, code })
    .select()
    .single();

  btn?.classList.remove('loading');

  if (error) { showToast(error.message, 'error'); return; }

  document.getElementById('create-class-modal').style.display = 'none';
  nameInput.value = '';

  showToast('Class created! Code: ' + data.code, 'success', 5000);

  const grid = document.getElementById('classes-grid');
  const empty = grid?.querySelector('.classroom-empty');
  if (empty) empty.remove();

  const card = document.createElement('div');
  card.innerHTML = _classCardHTML({ ...data, class_members: [{ count: 0 }] });
  grid?.prepend(card.firstElementChild);
}

// ── Student Panel (Phase 7D — with scores) ────────────────────

async function _showStudentPanel(classId, className, classCode) {
  document.getElementById('classes-grid').style.display  = 'none';
  document.getElementById('student-panel').style.display = 'block';
  document.getElementById('student-panel-title').textContent = className;
  document.getElementById('class-code-display').innerHTML =
    '<span class="code-label">Class Code:</span>' +
    '<span class="code-value">' + classCode + '</span>' +
    '<button class="btn-copy" id="btn-copy-code" title="Copy code">⧉</button>';

  document.getElementById('btn-copy-code')?.addEventListener('click', () => {
    navigator.clipboard.writeText(classCode).then(() => showToast('Code copied!', 'success'));
  });

  const listEl = document.getElementById('student-list-content');
  listEl.innerHTML = _loadingHTML();

  const sb = getSupabase();

  // Fetch members
  const { data: members, error } = await sb
    .from('class_members')
    .select('student_id, joined_at')
    .eq('class_id', classId)
    .order('joined_at', { ascending: false });

  if (error) { listEl.innerHTML = _errorHTML(error.message); return; }

  if (!members || members.length === 0) {
    listEl.innerHTML =
      '<div class="classroom-empty">' +
        '<div class="empty-state__icon">✦</div>' +
        '<div class="empty-state__title">No students yet</div>' +
        '<div class="empty-state__text">Share the code <strong>' + classCode + '</strong> with your students so they can join.</div>' +
      '</div>';
    return;
  }

  const studentIds = members.map(m => m.student_id).filter(Boolean);

  // Fetch profiles separately
  const { data: profilesData } = await sb
    .from('profiles')
    .select('id, full_name, email, level')
    .in('id', studentIds);

  const profileMap = {};
  (profilesData ?? []).forEach(p => { profileMap[p.id] = p; });

  // Rebuild data array with profile info
  const data = members.map(m => ({ ...m, profile: profileMap[m.student_id] ?? {} }));
  const { data: scoresData } = await sb
    .from('scores')
    .select('user_id, score, skill, cefr_level, created_at')
    .in('user_id', studentIds)
    .order('created_at', { ascending: false });

  // Build per-student score map
  const scoreMap = {};
  (scoresData ?? []).forEach(s => {
    if (!scoreMap[s.user_id]) scoreMap[s.user_id] = [];
    scoreMap[s.user_id].push(s);
  });

  // Class-level stats
  const totalStudents      = data.length;
  const studentsWithScores = studentIds.filter(id => scoreMap[id]?.length > 0).length;
  const allScores          = (scoresData ?? []).map(s => s.score);
  const classAvg           = allScores.length
    ? Math.round(allScores.reduce((a, b) => a + b, 0) / allScores.length)
    : null;
  const participation      = totalStudents > 0
    ? Math.round((studentsWithScores / totalStudents) * 100)
    : 0;

  // Build student rows
  let rows = '';
  data.forEach(m => {
    const profile  = m.profile ?? {};
    const sid      = m.student_id;
    const scores   = scoreMap[sid] ?? [];
    const avg      = scores.length
      ? Math.round(scores.reduce((a, b) => a + b.score, 0) / scores.length)
      : null;
    const last     = scores[0];
    const lastDate = last ? _formatDate(last.created_at) : null;
    const level    = profile.level ?? last?.cefr_level ?? null;

    const barWidth  = avg !== null ? avg : 0;
    const barColor  = avg === null ? '' : avg >= 70 ? 'var(--gold-pure)' : avg >= 50 ? 'var(--orange-bright,#ff7828)' : '#e55';
    const scoreBar  = avg !== null
      ? '<div class="score-mini-bar"><div class="score-mini-bar__fill" style="width:' + barWidth + '%;background:' + barColor + ';"></div></div>'
      : '';
    const lastInfo  = lastDate
      ? '<div class="student-row__last">Last: ' + lastDate + '</div>'
      : '<div class="student-row__last muted">No assessments yet</div>';
    const levelBadge = level
      ? '<div class="student-row__level">' + level + '</div>'
      : '';

    rows +=
      '<div class="student-row student-row--rich" data-student-id="' + sid + '" style="cursor:pointer;" title="Click to view details">' +
        '<div class="student-row__avatar">' + _initials(profile.full_name) + '</div>' +
        '<div class="student-row__info">' +
          '<div class="student-row__name">' + (profile.full_name ?? '—') + '</div>' +
          '<div class="student-row__email">' + (profile.email ?? '') + '</div>' +
          lastInfo +
        '</div>' +
        '<div class="student-row__stats">' +
          scoreBar +
          '<div class="student-row__avg">' + (avg !== null ? avg + '%' : '—') + '</div>' +
          levelBadge +
        '</div>' +
      '</div>';
  });

  listEl.innerHTML =
    '<div class="class-stats-bar">' +
      '<div class="class-stat"><div class="class-stat__value">' + totalStudents + '</div><div class="class-stat__label">Students</div></div>' +
      '<div class="class-stat"><div class="class-stat__value">' + studentsWithScores + '</div><div class="class-stat__label">Active</div></div>' +
      '<div class="class-stat"><div class="class-stat__value' + (classAvg === null ? ' muted' : '') + '">' + (classAvg !== null ? classAvg + '%' : '—') + '</div><div class="class-stat__label">Class Avg</div></div>' +
      '<div class="class-stat"><div class="class-stat__value">' + participation + '%</div><div class="class-stat__label">Participation</div></div>' +
    '</div>' +
    '<div class="student-list" id="student-rows">' + rows + '</div>' +
    '<div id="student-detail-panel" style="display:none;"></div>';

  // Wire click on each student row
  listEl.querySelectorAll('.student-row--rich').forEach(row => {
    row.addEventListener('click', () => {
      const sid = row.dataset.studentId;
      const profile = profileMap[sid] ?? {};
      const scores  = scoreMap[sid] ?? [];
      _showStudentDetail(sid, profile, scores);
    });
  });
}

// ── Student Detail Panel ──────────────────────────────────────

function _showStudentDetail(sid, profile, scores) {
  const rowsEl  = document.getElementById('student-rows');
  const detailEl = document.getElementById('student-detail-panel');
  if (!rowsEl || !detailEl) return;

  rowsEl.style.display  = 'none';
  detailEl.style.display = 'block';

  // Group scores by skill
  const bySkill = {};
  scores.forEach(s => {
    if (!bySkill[s.skill]) bySkill[s.skill] = [];
    bySkill[s.skill].push(s);
  });

  // Build skill bars
  const skills = Object.keys(bySkill);
  let skillRows = '';
  if (skills.length === 0) {
    skillRows = '<p style="color:var(--white-muted);font-size:0.875rem;">No assessments yet.</p>';
  } else {
    skills.forEach(skill => {
      const arr  = bySkill[skill];
      const avg  = Math.round(arr.reduce((a, b) => a + b.score, 0) / arr.length);
      const last = arr[0];
      const color = avg >= 70 ? 'var(--gold-pure)' : avg >= 50 ? 'var(--orange-bright,#ff7828)' : '#e55';
      skillRows +=
        '<div class="skill-detail-row">' +
          '<div class="skill-detail-row__label">' + skill.charAt(0).toUpperCase() + skill.slice(1) + '</div>' +
          '<div class="skill-detail-row__bar">' +
            '<div class="skill-detail-row__fill" style="width:' + avg + '%;background:' + color + ';"></div>' +
          '</div>' +
          '<div class="skill-detail-row__score">' + avg + '%</div>' +
          '<div class="skill-detail-row__meta">' + arr.length + ' session' + (arr.length !== 1 ? 's' : '') +
            (last?.cefr_level ? ' · ' + last.cefr_level : '') + '</div>' +
        '</div>';
    });
  }

  // Overall stats
  const overallAvg = scores.length
    ? Math.round(scores.reduce((a, b) => a + b.score, 0) / scores.length)
    : null;
  const level = profile.level ?? scores[0]?.cefr_level ?? null;

  detailEl.innerHTML =
    '<div class="student-detail">' +
      '<button class="btn-back" id="btn-back-to-list">← Back to Students</button>' +
      '<div class="student-detail__header">' +
        '<div class="student-row__avatar" style="width:48px;height:48px;font-size:1rem;">' + _initials(profile.full_name) + '</div>' +
        '<div>' +
          '<div style="font-size:1.1rem;font-weight:700;color:var(--white-pure);">' + (profile.full_name ?? '—') + '</div>' +
          '<div style="font-size:0.8rem;color:var(--white-muted);">' + (profile.email ?? '') + '</div>' +
        '</div>' +
        (level ? '<div class="student-row__level" style="margin-left:auto;">' + level + '</div>' : '') +
        (overallAvg !== null ? '<div style="font-size:1.25rem;font-weight:700;color:var(--white-pure);margin-left:var(--space-3);">' + overallAvg + '%</div>' : '') +
      '</div>' +
      '<div class="skill-detail-list">' + skillRows + '</div>' +
      '<button class="btn btn--primary" id="btn-assign-assessment" style="margin-top:var(--space-4);width:100%;">✦ Assign Assessment</button>' +
      '<div id="assignment-history-section" style="margin-top:var(--space-5);">' +
        '<div style="font-size:0.75rem;font-weight:700;letter-spacing:0.08em;color:var(--white-muted);text-transform:uppercase;margin-bottom:var(--space-3);">Assignment History</div>' +
        '<div id="assignment-history-list"><div class="assessment-loading"><div class="assessment-loading__ring"></div></div></div>' +
      '</div>' +
    '</div>' +

    // Assign modal
    '<div id="assign-modal" style="display:none;position:fixed;inset:0;z-index:1000;display:none;align-items:center;justify-content:center;">' +
      '<div style="position:absolute;inset:0;background:rgba(0,0,0,0.7);" id="assign-modal-backdrop"></div>' +
      '<div style="position:relative;background:var(--surface-2,#1a1a2e);border:1px solid var(--border-subtle,rgba(255,255,255,0.1));border-radius:12px;padding:var(--space-6);width:min(420px,90vw);z-index:1;">' +
        '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:var(--space-5);">' +
          '<h3 style="margin:0;color:var(--white-pure);">Assign Assessment</h3>' +
          '<button id="assign-modal-close" style="background:none;border:none;color:var(--white-muted);font-size:1.2rem;cursor:pointer;">✕</button>' +
        '</div>' +
        '<div style="font-size:0.85rem;color:var(--white-muted);margin-bottom:var(--space-4);">Assigning to: <strong style="color:var(--white-pure);">' + (profile.full_name ?? 'Student') + '</strong></div>' +
        '<div class="form-group">' +
          '<label class="form-label">Skill</label>' +
          '<select class="form-input" id="assign-skill">' +
            '<option value="grammar">Grammar</option>' +
            '<option value="vocabulary">Vocabulary</option>' +
            '<option value="writing">Writing</option>' +
            '<option value="reading">Reading</option>' +
            '<option value="listening">Listening</option>' +
            '<option value="speaking">Speaking</option>' +
          '</select>' +
        '</div>' +
        '<div class="form-group">' +
          '<label class="form-label">Target Level (CEFR)</label>' +
          '<select class="form-input" id="assign-level">' +
            '<option value="A1">A1 — Beginner</option>' +
            '<option value="A2">A2 — Elementary</option>' +
            '<option value="B1" selected>B1 — Intermediate</option>' +
            '<option value="B2">B2 — Upper Intermediate</option>' +
            '<option value="C1">C1 — Advanced</option>' +
            '<option value="C2">C2 — Proficient</option>' +
          '</select>' +
        '</div>' +
        '<div class="form-group">' +
          '<label class="form-label">Message (optional)</label>' +
          '<input type="text" class="form-input" id="assign-message" placeholder="e.g. Focus on verb tenses" maxlength="120" />' +
        '</div>' +
        '<button class="btn btn--primary btn--full" id="btn-confirm-assign">Send Assignment</button>' +
      '</div>' +
    '</div>';

  document.getElementById('btn-back-to-list')?.addEventListener('click', () => {
    detailEl.style.display = 'none';
    rowsEl.style.display   = 'block';
  });

  // Assign modal logic
  const assignModal    = document.getElementById('assign-modal');
  const openAssign     = () => { assignModal.style.display = 'flex'; };
  const closeAssign    = () => { assignModal.style.display = 'none'; };

  document.getElementById('btn-assign-assessment')?.addEventListener('click', openAssign);
  document.getElementById('assign-modal-close')?.addEventListener('click', closeAssign);
  document.getElementById('assign-modal-backdrop')?.addEventListener('click', closeAssign);

  document.getElementById('btn-confirm-assign')?.addEventListener('click', async () => {
    const skill   = document.getElementById('assign-skill')?.value;
    const level   = document.getElementById('assign-level')?.value;
    const message = document.getElementById('assign-message')?.value?.trim() || null;
    const btn     = document.getElementById('btn-confirm-assign');
    const sb      = getSupabase();
    const teacherId = store.get('user')?.id;

    btn?.classList.add('loading');

    const { error } = await sb.from('assignments').insert({
      teacher_id: teacherId,
      student_id: sid,
      skill,
      level,
      message,
      status: 'pending',
    });

    btn?.classList.remove('loading');

    if (error) {
      showToast('Could not send assignment: ' + error.message, 'error');
    } else {
      showToast('Assignment sent to ' + (profile.full_name ?? 'student') + '!', 'success');
      closeAssign();
      _loadAssignmentHistory(sid); // refresh history after sending
    }
  });

  // Load assignment history
  _loadAssignmentHistory(sid);
}

// ── Assignment History ────────────────────────────────────────

async function _loadAssignmentHistory(studentId) {
  const listEl = document.getElementById('assignment-history-list');
  if (!listEl) return;

  const sb        = getSupabase();
  const teacherId = store.get('user')?.id;

  const { data, error } = await sb
    .from('assignments')
    .select('id, skill, level, message, status, created_at')
    .eq('teacher_id', teacherId)
    .eq('student_id', studentId)
    .order('created_at', { ascending: false });

  if (error) {
    listEl.innerHTML = '<p style="color:var(--white-muted);font-size:0.8rem;">Could not load history.</p>';
    return;
  }

  if (!data || data.length === 0) {
    listEl.innerHTML = '<p style="color:var(--white-muted);font-size:0.8rem;">No assignments sent yet.</p>';
    return;
  }

  listEl.innerHTML = data.map(a => {
    const skill      = a.skill?.charAt(0).toUpperCase() + a.skill?.slice(1);
    const date       = _formatDate(a.created_at);
    const isPending  = a.status === 'pending';
    const statusColor = isPending ? 'var(--orange-bright,#ff7828)' : 'var(--status-success,#4caf50)';
    const statusLabel = isPending ? 'Pending' : 'Completed';

    return '<div style="display:flex;align-items:center;gap:var(--space-3);padding:var(--space-2) 0;border-bottom:1px solid rgba(255,255,255,0.06);">' +
      '<div style="flex:1;min-width:0;">' +
        '<div style="font-size:0.85rem;font-weight:600;color:var(--white-pure);">' + skill + ' · ' + a.level + '</div>' +
        (a.message ? '<div style="font-size:0.75rem;color:var(--white-muted);font-style:italic;margin-top:2px;">"' + a.message + '"</div>' : '') +
        '<div style="font-size:0.72rem;color:var(--white-muted);margin-top:2px;">' + date + '</div>' +
      '</div>' +
      '<div style="font-size:0.72rem;font-weight:700;color:' + statusColor + ';background:' + statusColor + '18;border-radius:999px;padding:2px 8px;flex-shrink:0;">' + statusLabel + '</div>' +
    '</div>';
  }).join('');
}

// ── Learner Events ────────────────────────────────────────────

function _wireLearnerEvents() {
  document.getElementById('btn-join-class')?.addEventListener('click', _joinClass);
  document.getElementById('join-code-input')?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') _joinClass();
  });
  document.getElementById('join-code-input')?.addEventListener('input', (e) => {
    e.target.value = e.target.value.toUpperCase();
  });
}

async function _joinClass() {
  const input = document.getElementById('join-code-input');
  const code  = input?.value?.trim().toUpperCase();
  if (!code || code.length < 4) { showToast('Please enter a valid class code.', 'error'); return; }

  const btn = document.getElementById('btn-join-class');
  btn?.classList.add('loading');

  const sb     = getSupabase();
  const userId = store.get('user')?.id;

  const { data: cls, error: findErr } = await sb
    .from('classes')
    .select('id, name')
    .eq('code', code)
    .single();

  if (findErr || !cls) {
    btn?.classList.remove('loading');
    showToast('Class not found. Check the code and try again.', 'error');
    return;
  }

  const { error: joinErr } = await sb
    .from('class_members')
    .insert({ class_id: cls.id, student_id: userId });

  btn?.classList.remove('loading');

  if (joinErr) {
    if (joinErr.message.includes('unique') || joinErr.code === '23505') {
      showToast('You\'re already in "' + cls.name + '".', 'warning');
    } else {
      showToast(joinErr.message, 'error');
    }
    return;
  }

  if (input) input.value = '';
  showToast('Joined "' + cls.name + '" successfully!', 'success');
  _loadLearnerClasses();
}

async function _loadLearnerClasses() {
  const listEl = document.getElementById('learner-classes-list');
  if (!listEl) return;

  const sb     = getSupabase();
  const userId = store.get('user')?.id;

  const { data, error } = await sb
    .from('class_members')
    .select('joined_at, classes(id, name, code, profiles(full_name))')
    .eq('student_id', userId)
    .order('joined_at', { ascending: false });

  if (error || !data || data.length === 0) {
    listEl.innerHTML = '<p style="color:var(--white-muted);font-size:0.875rem;">No classes joined yet.</p>';
    return;
  }

  let rows = '';
  data.forEach(m => {
    rows +=
      '<div class="learner-class-row">' +
        '<div class="learner-class-row__icon">◈</div>' +
        '<div class="learner-class-row__info">' +
          '<div class="learner-class-row__name">' + (m.classes?.name ?? '—') + '</div>' +
          '<div class="learner-class-row__teacher">Teacher: ' + (m.classes?.profiles?.full_name ?? '—') + '</div>' +
        '</div>' +
        '<div class="learner-class-row__code">' + (m.classes?.code ?? '') + '</div>' +
      '</div>';
  });

  listEl.innerHTML = '<div class="learner-class-list">' + rows + '</div>';
}

// ── Helpers ───────────────────────────────────────────────────

function _generateCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  return Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

function _initials(name) {
  if (!name) return '?';
  return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
}

function _formatDate(dateStr) {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function _loadingHTML() {
  return '<div class="assessment-loading"><div class="assessment-loading__ring"></div><div class="assessment-loading__text">Loading...</div></div>';
}

function _errorHTML(msg) {
  return '<div class="progress-empty"><div class="empty-state__icon">⚠</div><div class="empty-state__title">Error</div><div class="empty-state__text">' + (msg ?? 'Something went wrong.') + '</div></div>';
}
