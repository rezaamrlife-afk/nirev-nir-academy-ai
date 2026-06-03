/**
 * NIREV AI — Reports Page Controller
 * ─────────────────────────────────────────────────────────────
 * Version: 5.0.0 — Phase 5
 *
 * Features:
 *   - List all assessment sessions with scores
 *   - Expand each session for full breakdown
 *   - Export individual report to PDF (print)
 *   - Export all reports summary
 * ─────────────────────────────────────────────────────────────
 */

import store from './store.js';
import { getScores, getAssessments } from './db.js';

// ── Initialize ────────────────────────────────────────────────

export function initReportsPage() {
  document.addEventListener('nirev:navigate', (e) => {
    if (e.detail?.pageId === 'reports') {
      _loadAndRender();
    }
  });
}

// ── Load ──────────────────────────────────────────────────────

async function _loadAndRender() {
  const container = document.getElementById('reports-content');
  if (!container) return;

  const userId = store.get('user')?.id;
  if (!userId) return;

  container.innerHTML = _loadingHTML();

  try {
    const { data: scores, error } = await getScores(userId, { limit: 50 });

    if (error || !scores || scores.length === 0) {
      container.innerHTML = _emptyHTML();
      return;
    }

    _renderReports(scores, container);

  } catch (err) {
    container.innerHTML = _emptyHTML();
  }
}

// ── Render Reports List ───────────────────────────────────────

function _renderReports(scores, container) {
  const user = store.get('user');
  const name = user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'Learner';

  container.innerHTML = `
    <div class="report-list" id="report-list">
      ${scores.map((score, i) => _buildReportCard(score, i)).join('')}
    </div>
  `;

  // Wire expand/collapse
  container.querySelectorAll('.report-card').forEach(card => {
    card.addEventListener('click', (e) => {
      if (e.target.closest('.report-export-btn')) return;
      card.classList.toggle('expanded');
    });
  });

  // Wire export buttons
  container.querySelectorAll('.report-export-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const idx = parseInt(btn.dataset.index);
      _exportReport(scores[idx], name);
    });
  });
}

// ── Build Report Card ─────────────────────────────────────────

function _buildReportCard(score, index) {
  const totalScore  = Math.round(parseFloat(score.score ?? 0));
  const scoreClass  = totalScore >= 70 ? 'high' : totalScore >= 40 ? 'medium' : 'low';
  const cefrLevel   = score.cefr_level ?? '—';
  const skill       = score.skill ?? '—';
  const date        = _formatDate(score.created_at);
  const details     = score.details ?? {};
  const perQuestion = details.perQuestion ?? [];

  return `
    <div class="report-card" data-index="${index}">
      <div class="report-card__header">
        <div class="report-card__score-circle ${scoreClass}">${totalScore}</div>
        <div class="report-card__info">
          <div class="report-card__title">${skill} Assessment</div>
          <div class="report-card__meta">
            <span>${date}</span>
            <span>CEFR: ${cefrLevel}</span>
            <span>${perQuestion.length} questions</span>
          </div>
        </div>
        <div class="report-card__badges">
          <span class="badge ${scoreClass === 'high' ? 'badge--success' : scoreClass === 'medium' ? 'badge--gold' : ''}"
                style="${scoreClass === 'low' ? 'background:rgba(231,76,60,0.1);color:#e74c3c;border:1px solid rgba(231,76,60,0.2)' : ''}">
            ${cefrLevel}
          </span>
          <button class="report-export-btn" data-index="${index}" type="button">
            ↓ PDF
          </button>
          <span class="report-card__chevron">▼</span>
        </div>
      </div>

      <div class="report-detail">
        <div class="report-detail__grid">
          <div class="report-detail__stat">
            <div class="report-detail__stat-value">${totalScore}/100</div>
            <div class="report-detail__stat-label">Total Score</div>
          </div>
          <div class="report-detail__stat">
            <div class="report-detail__stat-value">${cefrLevel}</div>
            <div class="report-detail__stat-label">CEFR Level</div>
          </div>
          <div class="report-detail__stat">
            <div class="report-detail__stat-value">${perQuestion.length}/${perQuestion.length}</div>
            <div class="report-detail__stat-label">Answered</div>
          </div>
        </div>

        ${perQuestion.length > 0 ? `
        <div class="section-header" style="margin-bottom:var(--space-3);">
          <h3 class="section-title" style="font-size:0.9rem;">Question Breakdown</h3>
        </div>
        <div class="report-questions">
          ${perQuestion.map((q, i) => {
            const s   = Math.round(q.normalised ?? 0);
            const cls = s >= 70 ? 'high' : s >= 40 ? 'medium' : 'low';
            return `
              <div class="report-q-item">
                <div class="report-q-item__num">Q${i+1}</div>
                <div class="report-q-item__content">
                  <div class="report-q-item__feedback">${q.rationale ?? '—'}</div>
                </div>
                <div class="report-q-item__score ${cls}">${s}</div>
              </div>`;
          }).join('')}
        </div>` : ''}
      </div>
    </div>
  `;
}

// ── PDF Export ────────────────────────────────────────────────

function _exportReport(score, userName) {
  const totalScore  = Math.round(parseFloat(score.score ?? 0));
  const cefrLevel   = score.cefr_level ?? '—';
  const skill       = score.skill ?? '—';
  const date        = _formatDate(score.created_at);
  const details     = score.details ?? {};
  const perQuestion = details.perQuestion ?? [];

  const printWindow = window.open('', '_blank');
  printWindow.document.write(`
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <title>NIREV Assessment Report — ${userName}</title>
      <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body {
          font-family: 'Georgia', serif;
          background: #fff;
          color: #1a1a1a;
          padding: 40px;
          max-width: 800px;
          margin: 0 auto;
        }
        .header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          border-bottom: 2px solid #D4AF37;
          padding-bottom: 20px;
          margin-bottom: 30px;
        }
        .logo {
          font-size: 2rem;
          font-weight: 700;
          letter-spacing: 0.1em;
          color: #0D0D0D;
        }
        .logo span { color: #D4AF37; }
        .meta { text-align: right; font-size: 0.8rem; color: #666; }
        .score-hero {
          text-align: center;
          padding: 30px;
          background: #f9f6ee;
          border-radius: 12px;
          margin-bottom: 30px;
          border: 1px solid #D4AF37;
        }
        .score-hero h1 {
          font-size: 4rem;
          color: #D4AF37;
          line-height: 1;
          margin-bottom: 8px;
        }
        .score-hero .cefr {
          font-size: 1.5rem;
          color: #333;
          margin-bottom: 4px;
        }
        .score-hero .skill {
          font-size: 0.9rem;
          color: #666;
          text-transform: uppercase;
          letter-spacing: 0.1em;
        }
        .stats {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 16px;
          margin-bottom: 30px;
        }
        .stat {
          text-align: center;
          padding: 16px;
          border: 1px solid #e0e0e0;
          border-radius: 8px;
        }
        .stat-value { font-size: 1.5rem; font-weight: 700; color: #D4AF37; }
        .stat-label { font-size: 0.7rem; color: #999; text-transform: uppercase; letter-spacing: 0.1em; margin-top: 4px; }
        h2 { font-size: 1rem; color: #333; margin-bottom: 16px; text-transform: uppercase; letter-spacing: 0.1em; border-bottom: 1px solid #eee; padding-bottom: 8px; }
        .q-item { display: flex; gap: 12px; padding: 12px; border-bottom: 1px solid #f0f0f0; align-items: flex-start; }
        .q-num { font-size: 0.75rem; color: #999; min-width: 30px; margin-top: 2px; }
        .q-feedback { flex: 1; font-size: 0.85rem; color: #444; font-style: italic; }
        .q-score { font-size: 1.1rem; font-weight: 700; min-width: 36px; text-align: right; }
        .q-score.high   { color: #27ae60; }
        .q-score.medium { color: #D4AF37; }
        .q-score.low    { color: #e74c3c; }
        .footer { margin-top: 40px; text-align: center; font-size: 0.75rem; color: #999; border-top: 1px solid #eee; padding-top: 20px; }
        @media print {
          body { padding: 20px; }
          .no-print { display: none; }
        }
      </style>
    </head>
    <body>
      <div class="header">
        <div class="logo">NIREV<span>.</span></div>
        <div class="meta">
          <div><strong>${userName}</strong></div>
          <div>${date}</div>
          <div>Assessment Report</div>
        </div>
      </div>

      <div class="score-hero">
        <h1>${totalScore}</h1>
        <div class="cefr">${cefrLevel}</div>
        <div class="skill">${skill} Assessment</div>
      </div>

      <div class="stats">
        <div class="stat">
          <div class="stat-value">${totalScore}/100</div>
          <div class="stat-label">Score</div>
        </div>
        <div class="stat">
          <div class="stat-value">${cefrLevel}</div>
          <div class="stat-label">CEFR Level</div>
        </div>
        <div class="stat">
          <div class="stat-value">${perQuestion.length}/${perQuestion.length}</div>
          <div class="stat-label">Answered</div>
        </div>
      </div>

      ${perQuestion.length > 0 ? `
      <h2>Question Breakdown</h2>
      ${perQuestion.map((q, i) => {
        const s   = Math.round(q.normalised ?? 0);
        const cls = s >= 70 ? 'high' : s >= 40 ? 'medium' : 'low';
        return `
          <div class="q-item">
            <div class="q-num">Q${i+1}</div>
            <div class="q-feedback">${q.rationale ?? '—'}</div>
            <div class="q-score ${cls}">${s}</div>
          </div>`;
      }).join('')}` : ''}

      <div class="footer">
        Generated by NIREV AI · Next Generation Intelligence for Evaluation & Validation
      </div>

      <script>window.onload = () => { window.print(); }<\/script>
    </body>
    </html>
  `);
  printWindow.document.close();
}

// ── Helpers ───────────────────────────────────────────────────

function _formatDate(dateStr) {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function _loadingHTML() {
  return `
    <div class="assessment-loading">
      <div class="assessment-loading__ring"></div>
      <div class="assessment-loading__text">Loading reports...</div>
    </div>`;
}

function _emptyHTML() {
  return `
    <div class="reports-empty">
      <div class="empty-state__icon">◎</div>
      <div class="empty-state__title">No reports yet</div>
      <div class="empty-state__text">Complete an assessment to generate your first report.</div>
      <button class="btn btn--primary" onclick="window.NIREV.navigateTo('assessment')">Start Assessment</button>
    </div>`;
}
