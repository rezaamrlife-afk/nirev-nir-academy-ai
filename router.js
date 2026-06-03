/**
 * NIREV AI — Client-Side Router
 * ─────────────────────────────────────────────────────────────
 * Responsibilities:
 *   1. Maintain current page state
 *   2. Show/hide page panels in the DOM
 *   3. Sync nav-item active states
 *   4. Update topbar title
 *   5. Notify store of page changes
 *   6. Build sidebar nav from config
 *   7. Build quick-action buttons from config
 *   8. Wire all nav click/keyboard events
 *
 * Rule: router.js never imports from dashboard.js, assessment.js,
 *       or any page-level module. Pages subscribe to router events
 *       via store or CustomEvents — they don't get called directly.
 * ─────────────────────────────────────────────────────────────
 */

import { NAV_SECTIONS, QUICK_ACTIONS, ALL_PAGE_IDS, APP, STORAGE_KEYS } from './config.js';
import store from './store.js';
import { closeSidebar } from './ui.js';

// ── Router State ──────────────────────────────────────────────

let _initialized = false;

// ── Bootstrap ─────────────────────────────────────────────────

/**
 * Initialize the router: build nav, wire events.
 * Call once after DOM is ready.
 */
export function initRouter() {
  if (_initialized) return;
  _initialized = true;

  _buildSidebarNav();
  _buildQuickActions();
  _wireNavClicks();
  _wireKeyboardNav();
  _wireSidebarDismiss();
}

// ── Public Navigation API ─────────────────────────────────────

/**
 * Navigate to a page by ID.
 * Safe to call from anywhere — validates the ID first.
 * @param {string} pageId
 */
export function navigateTo(pageId) {
  const target = ALL_PAGE_IDS.includes(pageId) ? pageId : APP.DEFAULT_PAGE;

  // 1. Update store (single source of truth)
  store.set('currentPage', target);

  // 2. Persist to sessionStorage for reload recovery
  sessionStorage.setItem(STORAGE_KEYS.CURRENT_PAGE, target);

  // 3. Sync DOM
  _activateNavItem(target);
  _showPagePanel(target);
  _updateTopbarTitle(target);

  // 4. Close sidebar on mobile
  if (window.innerWidth <= 900) closeSidebar();

  // 5. Fire event — page modules listen to this
  document.dispatchEvent(
    new CustomEvent('nirev:navigate', { detail: { pageId: target } })
  );
}

/**
 * Restore the last visited page (from sessionStorage) or default.
 */
export function restoreLastPage() {
  const saved = sessionStorage.getItem(STORAGE_KEYS.CURRENT_PAGE);
  const page  = (saved && ALL_PAGE_IDS.includes(saved)) ? saved : APP.DEFAULT_PAGE;
  navigateTo(page);
}

/**
 * Get the currently active page ID.
 * @returns {string}
 */
export function getCurrentPage() {
  return store.get('currentPage') ?? APP.DEFAULT_PAGE;
}

// ── DOM Builders ──────────────────────────────────────────────

function _buildSidebarNav() {
  const navEl = document.getElementById('sidebar-nav');
  if (!navEl) return;

  navEl.innerHTML = NAV_SECTIONS.map(section => `
    <div class="nav-section">
      <div class="nav-section__label">${section.section}</div>
      ${section.items.map(item => `
        <div class="nav-item"
             data-page="${item.id}"
             role="button"
             tabindex="0"
             aria-label="${item.label}">
          <span class="nav-item__icon" aria-hidden="true">${item.icon}</span>
          <span class="nav-item__label">${item.label}</span>
          ${item.badge ? `<span class="nav-item__badge">${item.badge}</span>` : ''}
        </div>
      `).join('')}
    </div>
  `).join('');
}

function _buildQuickActions() {
  const container = document.getElementById('quick-actions-grid');
  if (!container) return;

  container.innerHTML = QUICK_ACTIONS.map(action => `
    <button class="quick-action-btn" data-page="${action.page}" type="button">
      <span class="quick-action-btn__icon" aria-hidden="true">${action.icon}</span>
      <span>${action.label}</span>
    </button>
  `).join('');

  container.querySelectorAll('.quick-action-btn').forEach(btn => {
    btn.addEventListener('click', () => navigateTo(btn.dataset.page));
  });
}

// ── DOM Sync Helpers ──────────────────────────────────────────

function _activateNavItem(pageId) {
  document.querySelectorAll('.nav-item[data-page]').forEach(item => {
    item.classList.toggle('active', item.dataset.page === pageId);
    item.setAttribute('aria-current', item.dataset.page === pageId ? 'page' : 'false');
  });
}

function _showPagePanel(pageId) {
  document.querySelectorAll('.page-panel').forEach(panel => {
    const isTarget = panel.id === `page-${pageId}`;
    panel.style.display = isTarget ? '' : 'none';
    panel.setAttribute('aria-hidden', String(!isTarget));
  });
}

function _updateTopbarTitle(pageId) {
  const titleEl = document.getElementById('topbar-title');
  if (!titleEl) return;

  // Find label from config (source of truth)
  const allItems  = NAV_SECTIONS.flatMap(s => s.items);
  const navItem   = allItems.find(i => i.id === pageId);
  titleEl.textContent = navItem?.label ?? pageId;
}

// ── Event Wiring ──────────────────────────────────────────────

function _wireNavClicks() {
  // Single delegated listener on document
  document.addEventListener('click', (e) => {
    const navItem = e.target.closest('.nav-item[data-page]');
    if (navItem) navigateTo(navItem.dataset.page);
  });
}

function _wireKeyboardNav() {
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    const navItem = document.activeElement?.closest('.nav-item[data-page]');
    if (navItem) {
      e.preventDefault();
      navigateTo(navItem.dataset.page);
    }
  });
}

function _wireSidebarDismiss() {
  document.addEventListener('click', (e) => {
    const sidebar = document.getElementById('sidebar');
    const toggle  = document.getElementById('sidebar-toggle');
    if (
      sidebar?.classList.contains('open') &&
      !sidebar.contains(e.target) &&
      !toggle?.contains(e.target)
    ) {
      closeSidebar();
    }
  });
}
