/**
 * NIREV AI — UI Utilities
 * Toast notifications, loader, navigation helpers, sidebar
 */

// ── Toast System ──────────────────────────────────────────────

let toastContainer = null;

function getToastContainer() {
  if (!toastContainer) {
    toastContainer = document.getElementById('toast-container');
    if (!toastContainer) {
      toastContainer = document.createElement('div');
      toastContainer.id = 'toast-container';
      document.body.appendChild(toastContainer);
    }
  }
  return toastContainer;
}

/**
 * Show a toast notification
 * @param {string} message
 * @param {'success'|'error'|'warning'|'info'} type
 * @param {number} duration ms
 */
export function showToast(message, type = 'info', duration = 3500) {
  const container = getToastContainer();
  const toast = document.createElement('div');
  toast.className = `toast toast--${type}`;

  const icons = {
    success: '✓',
    error:   '✕',
    warning: '⚠',
    info:    'ℹ',
  };

  toast.innerHTML = `
    <div class="toast__icon-wrap">${icons[type] ?? icons.info}</div>
    <span class="toast__message">${message}</span>
  `;
  container.appendChild(toast);

  setTimeout(() => {
    toast.classList.add('removing');
    toast.addEventListener('animationend', () => toast.remove(), { once: true });
  }, duration);
}

// ── Loader ────────────────────────────────────────────────────

/**
 * Show/hide the full-screen loader
 */
export function showLoader(text = 'Initializing') {
  const overlay = document.getElementById('loader-overlay');
  if (!overlay) return;
  const txt = overlay.querySelector('.loader-text');
  if (txt) txt.textContent = text;
  overlay.classList.remove('hidden');
}

export function hideLoader() {
  const overlay = document.getElementById('loader-overlay');
  if (!overlay) return;
  overlay.classList.add('hidden');
}

// ── Navigation / Screen Switching ────────────────────────────

/**
 * Show a named screen, hide all others
 * @param {'auth'|'app'} screenName
 */
export function showScreen(screenName) {
  document.querySelectorAll('.screen').forEach(s => {
    s.classList.remove('active');
  });
  const target = document.getElementById(`screen-${screenName}`);
  if (target) target.classList.add('active');
}

/**
 * Activate a nav item and its corresponding page panel
 * @param {string} pageId
 */
export function navigateTo(pageId) {
  // Update nav items
  document.querySelectorAll('.nav-item').forEach(item => {
    item.classList.toggle('active', item.dataset.page === pageId);
  });

  // Show/hide page panels
  document.querySelectorAll('.page-panel').forEach(panel => {
    panel.style.display = panel.id === `page-${pageId}` ? '' : 'none';
  });

  // Dispatch event for any listeners
  document.dispatchEvent(new CustomEvent('nirev:navigate', { detail: pageId }));

  // Update topbar title
  const activeItem = document.querySelector(`.nav-item[data-page="${pageId}"]`);
  const topbarTitle = document.getElementById('topbar-title');
  if (topbarTitle && activeItem) {
    topbarTitle.textContent = activeItem.querySelector('.nav-item__label')?.textContent || pageId;
  }

  // Close sidebar on mobile after navigation
  if (window.innerWidth <= 900) {
    closeSidebar();
  }

  // Store current page
  sessionStorage.setItem('nirev-page', pageId);
}

// ── Sidebar ───────────────────────────────────────────────────

export function openSidebar() {
  const sidebar = document.getElementById('sidebar');
  if (sidebar) sidebar.classList.add('open');
}

export function closeSidebar() {
  const sidebar = document.getElementById('sidebar');
  if (sidebar) sidebar.classList.remove('open');
}

export function toggleSidebar() {
  const sidebar = document.getElementById('sidebar');
  if (sidebar) sidebar.classList.toggle('open');
}

// ── Greeting ──────────────────────────────────────────────────

/**
 * Returns time-appropriate greeting
 */
export function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

// ── Format helpers ────────────────────────────────────────────

export function formatScore(score) {
  if (score === null || score === undefined) return '—';
  return typeof score === 'number' ? score.toFixed(1) : score;
}

export function formatDate(dateStr) {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export function formatRelativeTime(dateStr) {
  if (!dateStr) return '';
  const diff = Date.now() - new Date(dateStr).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return 'just now';
  if (min < 60) return `${min}m ago`;
  const hrs = Math.floor(min / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

// ── Avatar initial ────────────────────────────────────────────

export function getInitials(name) {
  if (!name) return 'N';
  return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
}
