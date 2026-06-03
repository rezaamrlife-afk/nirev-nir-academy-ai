/* ============================================================
   NIREV AI — Analytics Page Styles
   Phase 3
   ============================================================ */

.analytics-page {
  padding: var(--space-8);
  max-width: var(--content-max);
}

/* ── Page Header ── */
.analytics-header {
  margin-bottom: var(--space-8);
  animation: fade-up var(--dur-slow) var(--ease-out) both;
}

.analytics-header__eyebrow {
  font-family: var(--font-mono);
  font-size: 0.7rem;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: var(--white-muted);
  margin-bottom: var(--space-2);
}

.analytics-header__title {
  font-family: var(--font-display);
  font-size: 2rem;
  font-weight: 400;
  color: var(--white-primary);
}

.analytics-header__title span {
  background: linear-gradient(135deg, var(--gold-pure), var(--gold-light));
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

/* ── Summary Stats ── */
.analytics-stats {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: var(--space-4);
  margin-bottom: var(--space-8);
  animation: fade-up var(--dur-slow) var(--ease-out) 0.1s both;
}

@media (max-width: 1000px) { .analytics-stats { grid-template-columns: repeat(2, 1fr); } }
@media (max-width: 600px)  { .analytics-stats { grid-template-columns: 1fr; } }

/* ── Charts Grid ── */
.charts-grid {
  display: grid;
  grid-template-columns: 2fr 1fr;
  gap: var(--space-5);
  margin-bottom: var(--space-6);
  animation: fade-up var(--dur-slow) var(--ease-out) 0.2s both;
}

@media (max-width: 900px) { .charts-grid { grid-template-columns: 1fr; } }

.chart-card {
  background: var(--black-surface);
  border: 1px solid var(--black-border);
  border-radius: var(--radius-xl);
  padding: var(--space-6);
}

.chart-card__title {
  font-family: var(--font-display);
  font-size: 1rem;
  font-weight: 500;
  color: var(--white-primary);
  margin-bottom: var(--space-5);
}

/* ── Score Line Chart ── */
.chart-container {
  position: relative;
  height: 200px;
  width: 100%;
}

.chart-svg {
  width: 100%;
  height: 100%;
  overflow: visible;
}

.chart-line {
  fill: none;
  stroke: var(--gold-pure);
  stroke-width: 2;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.chart-area {
  fill: url(#gold-gradient);
  opacity: 0.15;
}

.chart-dot {
  fill: var(--gold-pure);
  stroke: var(--black-surface);
  stroke-width: 2;
  cursor: pointer;
  transition: r 0.15s;
}

.chart-dot:hover { r: 5; }

.chart-label {
  font-family: var(--font-mono);
  font-size: 9px;
  fill: var(--white-muted);
}

.chart-grid-line {
  stroke: var(--black-border);
  stroke-width: 1;
  stroke-dasharray: 4 4;
}

/* ── Radar Chart ── */
.radar-container {
  height: 200px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.radar-svg {
  width: 100%;
  height: 100%;
}

.radar-bg   { fill: none; stroke: var(--black-border); stroke-width: 1; }
.radar-area { fill: rgba(212,175,55,0.15); stroke: var(--gold-pure); stroke-width: 1.5; }
.radar-dot  { fill: var(--gold-pure); }
.radar-label {
  font-family: var(--font-mono);
  font-size: 9px;
  fill: var(--white-muted);
  text-anchor: middle;
}

/* ── Skill breakdown ── */
.skill-breakdown {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  margin-bottom: var(--space-6);
  animation: fade-up var(--dur-slow) var(--ease-out) 0.3s both;
}

.skill-row {
  display: flex;
  align-items: center;
  gap: var(--space-4);
  padding: var(--space-4) var(--space-5);
  background: var(--black-surface);
  border: 1px solid var(--black-border);
  border-radius: var(--radius-lg);
  transition: border-color var(--dur-base);
}

.skill-row:hover { border-color: var(--gold-line); }

.skill-row__name {
  width: 100px;
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--white-primary);
  text-transform: capitalize;
  flex-shrink: 0;
}

.skill-row__bar-wrap {
  flex: 1;
  height: 6px;
  background: var(--black-border);
  border-radius: var(--radius-pill);
  overflow: hidden;
}

.skill-row__bar {
  height: 100%;
  border-radius: var(--radius-pill);
  background: linear-gradient(90deg, var(--gold-dim), var(--gold-pure));
  transition: width var(--dur-slow) var(--ease-smooth);
  box-shadow: 0 0 6px var(--gold-glow);
}

.skill-row__score {
  font-family: var(--font-display);
  font-size: 1.125rem;
  font-weight: 500;
  color: var(--gold-bright);
  min-width: 48px;
  text-align: right;
}

.skill-row__trend {
  font-family: var(--font-mono);
  font-size: 0.65rem;
  letter-spacing: 0.08em;
  min-width: 72px;
  text-align: right;
}

.skill-row__trend.improving { color: var(--status-success); }
.skill-row__trend.declining { color: var(--status-danger);  }
.skill-row__trend.plateauing{ color: var(--white-muted);    }

/* ── Skill Gaps ── */
.skill-gaps {
  animation: fade-up var(--dur-slow) var(--ease-out) 0.4s both;
}

.gap-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--space-4) var(--space-5);
  background: var(--black-surface);
  border: 1px solid var(--black-border);
  border-radius: var(--radius-lg);
  margin-bottom: var(--space-3);
}

.gap-item__skill {
  font-size: 0.875rem;
  font-weight: 500;
  text-transform: capitalize;
  color: var(--white-primary);
}

.gap-item__detail {
  font-family: var(--font-mono);
  font-size: 0.7rem;
  color: var(--white-muted);
  margin-top: 2px;
}

.gap-badge {
  padding: 3px 10px;
  border-radius: var(--radius-pill);
  font-family: var(--font-mono);
  font-size: 0.65rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.gap-badge.high   { background: rgba(231,76,60,0.12);  color: var(--status-danger);  border: 1px solid rgba(231,76,60,0.2); }
.gap-badge.medium { background: var(--gold-ghost);      color: var(--gold-bright);     border: 1px solid var(--gold-line);    }
.gap-badge.low    { background: rgba(46,204,113,0.08); color: var(--status-success); border: 1px solid rgba(46,204,113,0.2);}

/* ── Trajectory badge ── */
.trajectory-badge {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-1) var(--space-3);
  border-radius: var(--radius-pill);
  font-family: var(--font-mono);
  font-size: 0.68rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.trajectory-badge.improving  { background: rgba(46,204,113,0.10); color: var(--status-success); border: 1px solid rgba(46,204,113,0.2); }
.trajectory-badge.declining  { background: rgba(231,76,60,0.10);  color: var(--status-danger);  border: 1px solid rgba(231,76,60,0.2);  }
.trajectory-badge.plateauing { background: var(--white-ghost);    color: var(--white-muted);    border: 1px solid var(--black-border);  }

/* ── Feedback Card ── */
.feedback-card {
  background: var(--black-surface);
  border: 1px solid var(--gold-line);
  border-radius: var(--radius-xl);
  padding: var(--space-6);
  margin-bottom: var(--space-6);
  animation: fade-up var(--dur-slow) var(--ease-out) 0.15s both;
}

.feedback-card__header {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  margin-bottom: var(--space-5);
}

.feedback-card__title {
  font-family: var(--font-display);
  font-size: 1.125rem;
  font-weight: 500;
  color: var(--white-primary);
}

.feedback-section {
  margin-bottom: var(--space-5);
}

.feedback-section__label {
  font-family: var(--font-mono);
  font-size: 0.65rem;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--white-muted);
  margin-bottom: var(--space-3);
}

.feedback-section__summary {
  font-size: 0.9375rem;
  color: var(--white-secondary);
  line-height: 1.7;
}

.feedback-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.feedback-list__item {
  display: flex;
  align-items: flex-start;
  gap: var(--space-3);
  font-size: 0.875rem;
  color: var(--white-secondary);
  line-height: 1.6;
}

.feedback-list__bullet {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  margin-top: 7px;
  flex-shrink: 0;
}

.feedback-list__bullet.green  { background: var(--status-success); }
.feedback-list__bullet.red    { background: var(--status-danger);  }
.feedback-list__bullet.gold   { background: var(--gold-pure);      }
.feedback-list__bullet.orange { background: var(--orange-core);    }

/* ── Empty analytics ── */
.analytics-empty {
  text-align: center;
  padding: var(--space-20) var(--space-8);
}
