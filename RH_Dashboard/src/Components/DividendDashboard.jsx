import React from "react";
import {
  AlertTriangle,
  CalendarDays,
  CheckCircle2,
  CircleDollarSign,
  ShieldCheck,
  TrendingUp,
  WalletCards,
} from "lucide-react";
import MetricCard from "./Shell/MetricCard";
import {
  formatCurrency,
  formatPercent,
  formatShortDate,
  formatSignedCurrency,
  getToneClass,
  hasValue,
} from "../formatters";

const CHECK_STATUS_LABELS = {
  tracked: "Tracked",
  needs_fundamental_data: "Needs fundamental data",
};

const getResearchCheckStatusLabel = (status) =>
  CHECK_STATUS_LABELS[status] || "Needs review";

const getNextExDateFootnote = (nextPayment) => {
  if (!nextPayment?.eligibility_date) {
    return "No upcoming ex-date";
  }

  return `${nextPayment.ticker} ex ${formatShortDate(nextPayment.eligibility_date)}`;
};

const getNextExDateValue = (nextPayment) =>
  nextPayment?.eligibility_date
    ? formatShortDate(nextPayment.eligibility_date)
    : "Unavailable";

const getMaxMonthlyIncome = (monthlyCashFlow) =>
  Math.max(
    ...monthlyCashFlow.map((month) => Number(month.total || 0)),
    1
  );

const DividendDashboard = ({ data }) => {
  if (!data) {
    return (
      <section className="dividend-dashboard" aria-label="Dividend dashboard">
        <div className="panel-state empty-state">
          Dividend dashboard insights need dividend history and current holdings.
        </div>
      </section>
    );
  }

  const headline = data.headline || {};
  const growth = data.growth || {};
  const incomeQuality = data.income_quality || {};
  const concentration = data.concentration || {};
  const monthlyCashFlow = data.monthly_cash_flow || [];
  const riskFlags = data.risk_flags || [];
  const researchChecks = data.research_checks || [];
  const nextPayment = incomeQuality.next_payment;
  const concentrationPositions = concentration.positions || [];
  const maxMonthlyIncome = getMaxMonthlyIncome(monthlyCashFlow);

  return (
    <section className="dividend-dashboard" aria-label="Dividend dashboard">
      <div className="dividend-dashboard-header">
        <div>
          <span className="metric-kicker">Dividend Income</span>
          <h2>Dividend Dashboard</h2>
        </div>
        <span className="projection-basis">Income quality, growth, and concentration</span>
      </div>

      <div className="dividend-dashboard-metrics">
        <MetricCard
          icon={CircleDollarSign}
          label="Forward Annual Income"
          value={formatCurrency(headline.estimated_annual_income)}
          tone="green"
          footnote={`${formatCurrency(headline.projected_annual_income)} projected cash flow`}
        />
        <MetricCard
          icon={WalletCards}
          label="Dividend Yield"
          value={formatPercent(headline.portfolio_yield_percent)}
          tone="blue"
          footnote={`${formatCurrency(headline.estimated_monthly_income)} monthly average`}
        />
        <MetricCard
          icon={TrendingUp}
          label="Year Over Year"
          value={formatSignedCurrency(growth.year_over_year_change)}
          tone={growth.trend === "down" ? "red" : "orange"}
          trend={{
            className: getToneClass(growth.year_over_year_change),
            text: hasValue(growth.year_over_year_change_percent)
              ? formatPercent(growth.year_over_year_change_percent)
              : "New income stream",
          }}
          footnote={`${growth.current_year || "Current"} vs ${growth.previous_year || "prior"}`}
        />
        <MetricCard
          icon={CalendarDays}
          label="Next Ex-Date"
          value={getNextExDateValue(nextPayment)}
          tone="purple"
          footnote={getNextExDateFootnote(nextPayment)}
        />
      </div>

      <div className="dividend-dashboard-grid">
        <article className="dividend-insight-panel">
          <div className="dividend-insight-header">
            <div>
              <span className="metric-kicker">Income Quality</span>
              <h3>Coverage And Cadence</h3>
            </div>
            <ShieldCheck size={20} aria-hidden="true" />
          </div>
          <div className="quality-stat-grid">
            <div>
              <span>Payers</span>
              <strong>{incomeQuality.payer_count || 0}</strong>
            </div>
            <div>
              <span>Modeled</span>
              <strong>{formatPercent(incomeQuality.modeled_position_coverage_percent)}</strong>
            </div>
            <div>
              <span>Cadence</span>
              <strong>{formatPercent(incomeQuality.monthly_income_consistency_percent)}</strong>
            </div>
          </div>
          <p className="quality-cadence">
            {incomeQuality.months_with_income || 0} of 12 months with income
          </p>
          <div className="quality-payment-row">
            <span>{incomeQuality.received_payment_count || 0} received</span>
            <span>{incomeQuality.estimated_payment_count || 0} estimated</span>
          </div>
        </article>

        <article className="dividend-insight-panel">
          <div className="dividend-insight-header">
            <div>
              <span className="metric-kicker">Concentration</span>
              <h3>Income Dependence</h3>
            </div>
            <AlertTriangle size={20} aria-hidden="true" />
          </div>
          <div className="concentration-summary">
            <span>Top payer provides {formatPercent(concentration.top_payer_income_share_percent)}</span>
            <strong>{concentration.top_payer?.ticker || "None"}</strong>
          </div>
          <div className="income-payer-list">
            {concentrationPositions.slice(0, 5).map((position) => (
              <div className="income-payer-row" key={position.ticker}>
                <div>
                  <strong>{position.ticker}</strong>
                  <span>{formatCurrency(position.projected_total)}</span>
                </div>
                <div className="income-share-meter">
                  <div
                    style={{
                      width: `${Math.min(
                        Number(position.income_share_percent || 0),
                        100
                      )}%`,
                    }}
                  />
                </div>
                <span>{formatPercent(position.income_share_percent)}</span>
              </div>
            ))}
          </div>
        </article>
      </div>

      {monthlyCashFlow.length > 0 && (
        <article className="dividend-insight-panel monthly-income-panel">
          <div className="dividend-insight-header">
            <div>
              <span className="metric-kicker">Monthly Cash Flow</span>
              <h3>Received And Estimated Income</h3>
            </div>
            <span className="projection-basis">
              {formatPercent(incomeQuality.monthly_income_consistency_percent)} consistency
            </span>
          </div>
          <div className="monthly-income-grid">
            {monthlyCashFlow.map((month) => {
              const total = Number(month.total || 0);
              const heightPercent = Math.max((total / maxMonthlyIncome) * 100, total > 0 ? 8 : 0);

              return (
                <div className="monthly-income-column" key={month.month}>
                  <div className="monthly-income-track" aria-hidden="true">
                    <span style={{ height: `${heightPercent}%` }} />
                  </div>
                  <strong>{month.month_name?.slice(0, 3)}</strong>
                  <span>{formatCurrency(month.total)}</span>
                </div>
              );
            })}
          </div>
        </article>
      )}

      <div className="dividend-dashboard-grid">
        <article className="dividend-insight-panel">
          <div className="dividend-insight-header">
            <div>
              <span className="metric-kicker">Safety Signals</span>
              <h3>Data Notes</h3>
            </div>
            <AlertTriangle size={20} aria-hidden="true" />
          </div>
          <div className="risk-flag-list">
            {riskFlags.length > 0 ? (
              riskFlags.map((flag) => (
                <div className={`risk-flag risk-flag-${flag.severity}`} key={flag.code}>
                  <strong>{flag.severity}</strong>
                  <span>{flag.message}</span>
                </div>
              ))
            ) : (
              <div className="risk-flag risk-flag-info">
                <strong>clear</strong>
                <span>No dividend dashboard flags for the current data.</span>
              </div>
            )}
          </div>
        </article>

        <article className="dividend-insight-panel">
          <div className="dividend-insight-header">
            <div>
              <span className="metric-kicker">Investor Checklist</span>
              <h3>Dividend Research Coverage</h3>
            </div>
            <CheckCircle2 size={20} aria-hidden="true" />
          </div>
          <div className="research-check-list">
            {researchChecks.map((check) => (
              <div className="research-check-row" key={check.label}>
                <div>
                  <strong>{check.label}</strong>
                  <span>{check.message}</span>
                </div>
                <span className={`research-check-status research-check-status-${check.status}`}>
                  {getResearchCheckStatusLabel(check.status)}
                </span>
              </div>
            ))}
          </div>
        </article>
      </div>

      {hasValue(headline.yield_on_cost_percent) && (
        <div className="yield-on-cost-strip">
          <span>Yield On Cost</span>
          <strong>{formatPercent(headline.yield_on_cost_percent)}</strong>
          <span>{formatCurrency(headline.year_to_date_income)} collected year to date</span>
        </div>
      )}
    </section>
  );
};

export default DividendDashboard;
