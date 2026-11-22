
/**
 * NIREV AI — Client-Side Router
 * ─────────────────────────────────────────────────────────────
 * Desktop Sidebar + Role-Based Mobile Bottom Navigation
 *
 * Responsibilities:
 *   1. Maintain current page state
 *   2. Show/hide page panels
 *   3. Synchronize Sidebar navigation
 *   4. Synchronize Mobile Bottom Navigation
 *   5. Update topbar title
 *   6. Notify store of page changes
 *   7. Build navigation from config.js
 *   8. Build dashboard quick actions
 *   9. Wire navigation events
 *
 * Architecture:
 *   - config.js owns navigation definitions
 *   - router.js owns navigation DOM and behavior
 *   - app.js initializes the router and supplies user role
 *   - Page modules subscribe to navigation events
 * ─────────────────────────────────────────────────────────────
 */

import {
  NAV_SECTIONS,
  MOBILE_NAV_BY_ROLE,
  MOBILE_NAV,
  QUICK_ACTIONS,
  ALL_PAGE_IDS,
  APP,
  STORAGE_KEYS
} from './config.js';

import store from './store.js';
import { closeSidebar } from './ui.js';


// ── Router State ──────────────────────────────────────────────

let _initialized = false;

let _navigationRole = MOBILE_NAV.DEFAULT_ROLE || 'learner';


// ── Bootstrap ─────────────────────────────────────────────────

/**
 * Initialize the router.
 * Must be called once after DOM is ready.
 */
export function initRouter() {
  if (_initialized) return;

  _initialized = true;

  _buildSidebarNav();
  _buildMobileNav();
  _buildQuickActions();

  _wireNavClicks();
  _wireKeyboardNav();
  _wireSidebarDismiss();

  _activateNavItem(getCurrentPage());
}


// ── Role Management ───────────────────────────────────────────

/**
 * Set the current user's navigation role.
 *
 * @param {string} role
 */
export function setNavigationRole(role) {
  const normalizedRole =
    String(role || '').toLowerCase() === 'teacher'
      ? 'teacher'
      : 'learner';

  _navigationRole = normalizedRole;

  store.set('navigationRole', normalizedRole);

  _buildMobileNav();

  _activateNavItem(getCurrentPage());

  document.dispatchEvent(
    new CustomEvent('nirev:navigation-role-change', {
      detail: {
        role: normalizedRole
      }
    })
  );
}


/**
 * Get the current navigation role.
 *
 * @returns {string}
 */
export function getNavigationRole() {
  return _navigationRole;
}


// ── Public Navigation API ─────────────────────────────────────

/**
 * Navigate to a page by ID.
 *
 * @param {string} pageId
 */
export function navigateTo(pageId) {

  const target = ALL_PAGE_IDS.includes(pageId)
    ? pageId
    : APP.DEFAULT_PAGE;

  // 1. Update store
  store.set('currentPage', target);

  // 2. Persist current page
  try {
    sessionStorage.setItem(
      STORAGE_KEYS.CURRENT_PAGE,
      target
    );
  } catch (err) {
    console.warn('[Router] Could not persist current page:', err);
  }

  // 3. Synchronize navigation states
  _activateNavItem(target);

  // 4. Show selected page
  _showPagePanel(target);

  // 5. Update topbar
  _updateTopbarTitle(target);

  // 6. Close mobile sidebar
  if (window.innerWidth <= 900) {
    closeSidebar();
  }

  // 7. Notify application modules
  document.dispatchEvent(
    new CustomEvent('nirev:navigate', {
      detail: {
        pageId: target
      }
    })
  );
}


/**
 * Restore last visited page.
 */
export function restoreLastPage() {

  let saved = null;

  try {
    saved = sessionStorage.getItem(
      STORAGE_KEYS.CURRENT_PAGE
    );
  } catch (err) {
    console.warn('[Router] Session storage unavailable:', err);
  }

  const page =
    saved && ALL_PAGE_IDS.includes(saved)
      ? saved
      : APP.DEFAULT_PAGE;

  navigateTo(page);
}


/**
 * Get current page.
 *
 * @returns {string}
 */
export function getCurrentPage() {
  return store.get('currentPage') ?? APP.DEFAULT_PAGE;
}


// ── Sidebar Navigation Builder ────────────────────────────────

function _buildSidebarNav() {

  const navEl = document.getElementById('sidebar-nav');

  if (!navEl) return;

  navEl.innerHTML = NAV_SECTIONS.map(section => `

    <div class="nav-section">

      <div class="nav-section__label">
        ${_escapeHTML(section.section)}
      </div>

      ${section.items.map(item => `

        <div
          class="nav-item"
          data-page="${_escapeHTML(item.id)}"
          role="button"
          tabindex="0"
          aria-label="${_escapeHTML(item.label)}"
          aria-current="false"
        >

          <span
            class="nav-item__icon"
            aria-hidden="true"
          >
            ${_escapeHTML(item.icon)}
          </span>

          <span class="nav-item__label">
            ${_escapeHTML(item.label)}
          </span>

          ${
            item.badge
              ? `
                <span class="nav-item__badge">
                  ${_escapeHTML(item.badge)}
                </span>
              `
              : ''
          }

        </div>

      `).join('')}

    </div>

  `).join('');
}


// ── Mobile Bottom Navigation Builder ─────────────────────────

function _buildMobileNav() {

  const navEl = document.getElementById('mobile-bottom-nav');

  if (!navEl) return;

  if (MOBILE_NAV.ENABLED === false) {
    navEl.hidden = true;
    navEl.innerHTML = '';
    return;
  }

  const configuredItems =
    MOBILE_NAV_BY_ROLE[_navigationRole] ||
    MOBILE_NAV_BY_ROLE[MOBILE_NAV.DEFAULT_ROLE] ||
    [];

  const items = configuredItems
    .filter(item => ALL_PAGE_IDS.includes(item.id))
    .slice(0, MOBILE_NAV.MAX_ITEMS || 5);

  navEl.hidden = false;

  navEl.innerHTML = items.map(item => `

    <button
      type="button"
      class="bottom-nav__item"
      data-page="${_escapeHTML(item.id)}"
      aria-label="${_escapeHTML(item.label)}"
      aria-current="false"
    >

      <span
        class="bottom-nav__icon"
        aria-hidden="true"
      >
        ${_escapeHTML(item.icon)}
      </span>

      <span class="bottom-nav__label">
        ${_escapeHTML(item.label)}
      </span>

    </button>

  `).join('');

  _activateNavItem(getCurrentPage());
}


// ── Dashboard Quick Actions Builder ───────────────────────────

function _buildQuickActions() {

  const container = document.getElementById('quick-actions-grid');

  if (!container) return;

  container.innerHTML = QUICK_ACTIONS
    .filter(action => ALL_PAGE_IDS.includes(action.page))
    .map(action => `

      <button
        class="quick-action-btn"
        data-page="${_escapeHTML(action.page)}"
        type="button"
      >

        <span
          class="quick-action-btn__icon"
          aria-hidden="true"
        >
          ${_escapeHTML(action.icon)}
        </span>

        <span>
          ${_escapeHTML(action.label)}
        </span>

      </button>

    `).join('');

  container.querySelectorAll('.quick-action-btn').forEach(btn => {

    btn.addEventListener('click', () => {
      navigateTo(btn.dataset.page);
    });

  });
}


// ── Navigation State Synchronization ─────────────────────────

function _activateNavItem(pageId) {

  // Desktop Sidebar
  document.querySelectorAll('.nav-item[data-page]').forEach(item => {

    const isActive = item.dataset.page === pageId;

    item.classList.toggle('active', isActive);

    item.setAttribute(
      'aria-current',
      isActive ? 'page' : 'false'
    );

  });


  // Mobile Bottom Navigation
  document.querySelectorAll('.bottom-nav__item[data-page]').forEach(item => {

    const isActive = item.dataset.page === pageId;

    item.classList.toggle('active', isActive);

    item.setAttribute(
      'aria-current',
      isActive ? 'page' : 'false'
    );

  });

}


// ── Page Panel Management ─────────────────────────────────────

function _showPagePanel(pageId) {

  document.querySelectorAll('.page-panel').forEach(panel => {

    const isTarget = panel.id === `page-${pageId}`;

    panel.style.display = isTarget ? '' : 'none';

    panel.setAttribute(
      'aria-hidden',
      String(!isTarget)
    );

  });

}


// ── Topbar Title ──────────────────────────────────────────────

function _updateTopbarTitle(pageId) {

  const titleEl = document.getElementById('topbar-title');

  if (!titleEl) return;

  const allItems = NAV_SECTIONS.flatMap(
    section => section.items
  );

  const navItem = allItems.find(
    item => item.id === pageId
  );

  titleEl.textContent = navItem?.label ?? pageId;

}


// ── Navigation Click Events ───────────────────────────────────

function _wireNavClicks() {

  // One delegated listener for Sidebar and Bottom Navigation.
  document.addEventListener('click', e => {

    const navItem = e.target.closest(
      '.nav-item[data-page], .bottom-nav__item[data-page]'
    );

    if (!navItem) return;

    const pageId = navItem.dataset.page;

    if (!pageId) return;

    navigateTo(pageId);

  });

}


// ── Keyboard Navigation ───────────────────────────────────────

function _wireKeyboardNav() {

  document.addEventListener('keydown', e => {

    if (e.key !== 'Enter' && e.key !== ' ') return;

    const navItem = document.activeElement?.closest(
      '.nav-item[data-page]'
    );

    if (!navItem) return;

    e.preventDefault();

    navigateTo(navItem.dataset.page);

  });

}


// ── Sidebar Dismiss ───────────────────────────────────────────

function _wireSidebarDismiss() {

  document.addEventListener('click', e => {

    const sidebar = document.getElementById('sidebar');

    const toggle = document.getElementById('sidebar-toggle');

    if (
      sidebar?.classList.contains('open') &&
      !sidebar.contains(e.target) &&
      !toggle?.contains(e.target)
    ) {

      closeSidebar();

    }

  });

}


// ── Utility: HTML Escaping ────────────────────────────────────

function _escapeHTML(value) {

  return String(value ?? '').replace(/[&<>"']/g, char => {

    const entities = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    };

    return entities[char];

  });

}
