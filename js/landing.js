/**
 * NIREV AI — Public landing page behaviour.
 * Pure UI: screen switching only. Auth, sessions and roles stay in auth.js / app.js.
 */
import { showScreen } from './ui.js';

const $  = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];

function openAuth(tab) {
  showScreen('auth');
  window.scrollTo(0, 0);
  $(`.auth-tab[data-tab="${tab}"]`)?.click();
  history.pushState({ nirev: 'auth' }, '');
}
function goHome() { showScreen('landing'); window.scrollTo(0, 0); }

document.addEventListener('DOMContentLoaded', () => {
  const root = $('#screen-landing');
  if (!root) return;

  $$('[data-landing-auth]').forEach(b => b.addEventListener('click', () => openAuth(b.dataset.landingAuth)));
  $$('[data-landing-home]').forEach(a => a.addEventListener('click', e => { e.preventDefault(); goHome(); }));
  window.addEventListener('popstate', () => {
    if ($('#screen-auth')?.classList.contains('active')) goHome();
  });

  // Smooth in-page navigation (no hash changes, so Supabase recovery links are untouched)
  const menu = $('#lp-menu'), burger = $('#lp-burger');
  $$('[data-lp-scroll]', root).forEach(a => a.addEventListener('click', e => {
    e.preventDefault();
    const id = a.getAttribute('href').slice(1);
    const el = id === 'top' ? null : document.getElementById(id);
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
    window.scrollTo({ top: el ? el.getBoundingClientRect().top + scrollY - 76 : 0, behavior: reduce ? 'auto' : 'smooth' });
    menu?.classList.remove('open'); burger?.setAttribute('aria-expanded', 'false');
  }));
  burger?.addEventListener('click', () => {
    const open = menu.classList.toggle('open');
    burger.setAttribute('aria-expanded', String(open));
  });

  $('#lp-theme')?.addEventListener('click', () => window.nirevToggleTheme?.());
  $('#lp-announce-x')?.addEventListener('click', () => $('#lp-announce').remove());
  const yr = $('#lp-year'); if (yr) yr.textContent = new Date().getFullYear();

  // Language menu (English only for now)
  const lang = $('#lp-lang'), lbtn = $('.lp-lang__btn', lang);
  lbtn?.addEventListener('click', e => {
    e.stopPropagation();
    const open = lang.classList.toggle('open');
    lbtn.setAttribute('aria-expanded', String(open));
  });
  document.addEventListener('click', () => { lang?.classList.remove('open'); lbtn?.setAttribute('aria-expanded', 'false'); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') lang?.classList.remove('open'); });

  // Scroll reveal
  if ('IntersectionObserver' in window) {
    root.classList.add('lp-js');
    const io = new IntersectionObserver(es => es.forEach(en => {
      if (en.isIntersecting) { en.target.classList.add('in'); io.unobserve(en.target); }
    }), { threshold: 0.12 });
    $$('.lp-rv', root).forEach(el => io.observe(el));
  }
});
