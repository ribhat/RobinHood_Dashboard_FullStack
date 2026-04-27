import React from "react";

const formatCurrency = (value) => `$${value.toFixed(2)}`;

const IncomeProjection = ({
  currentYear,
  currentYearTotal,
  baselineYear,
  baselineTotal,
}) => {
  const monthlyBaseline = baselineTotal / 12;
  const remainingToBaseline = Math.max(baselineTotal - currentYearTotal, 0);
  const progressPercent =
    baselineTotal > 0
      ? Math.min((currentYearTotal / baselineTotal) * 100, 100)
      : 0;
  const hasExceededBaseline = currentYearTotal >= baselineTotal && baselineTotal > 0;

  return (
    <section className="projection-card" aria-label="Conservative income projection">
      <div className="projection-header">
        <div>
          <span className="metric-kicker">Conservative Projection</span>
          <h2>Forward Dividend Income</h2>
        </div>
        <span className="projection-basis">Based on {baselineYear} actuals</span>
      </div>

      <div className="projection-grid">
        <div className="projection-primary">
          <span className="summary-label">Annual Income Baseline</span>
          <strong>{formatCurrency(baselineTotal)}</strong>
        </div>
        <div className="projection-metric">
          <span className="summary-label">Monthly Baseline</span>
          <strong>{formatCurrency(monthlyBaseline)}</strong>
        </div>
        <div className="projection-metric">
          <span className="summary-label">{currentYear} Collected</span>
          <strong>{formatCurrency(currentYearTotal)}</strong>
        </div>
        <div className="projection-metric">
          <span className="summary-label">
            {hasExceededBaseline ? "Above Baseline" : "Remaining To Baseline"}
          </span>
          <strong>
            {formatCurrency(
              hasExceededBaseline
                ? currentYearTotal - baselineTotal
                : remainingToBaseline
            )}
          </strong>
        </div>
      </div>

      <div className="projection-progress" aria-label={`${progressPercent.toFixed(0)} percent of baseline reached`}>
        <div
          className="projection-progress-bar"
          style={{ width: `${progressPercent}%` }}
        />
      </div>
    </section>
  );
};

export default IncomeProjection;
