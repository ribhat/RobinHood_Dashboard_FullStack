import React from "react";

const hasValue = (value) => value !== null && value !== undefined;

const formatCurrency = (value) => (
  hasValue(value) ? `$${Number(value).toFixed(2)}` : "Unavailable"
);

const formatSignedCurrency = (value) => {
  if (!hasValue(value)) {
    return "Unavailable";
  }

  const amount = Number(value);
  const prefix = amount > 0 ? "+" : amount < 0 ? "-" : "";
  return `${prefix}$${Math.abs(amount).toFixed(2)}`;
};

const formatPercent = (value) => (
  hasValue(value) ? `${Number(value).toFixed(2)}%` : "Unavailable"
);

const getToneClass = (value) => {
  if (!hasValue(value) || Number(value) === 0) {
    return "";
  }

  return Number(value) > 0 ? "positive-metric" : "negative-metric";
};

const COST_BASIS_COVERAGE_HELP =
  "Cost basis coverage is the share of positions where purchase cost data is available. It is needed to calculate gain/loss and returns.";

const PerformanceList = ({ title, positions }) => (
  <div className="performance-list">
    <h3>{title}</h3>
    {positions.length > 0 ? (
      positions.map((position) => (
        <div className="performance-row" key={`${title}-${position.ticker}`}>
          <div>
            <strong>{position.ticker}</strong>
            <span>{position.name}</span>
          </div>
          <div className="performance-values">
            <strong
              className={`performance-primary-value ${getToneClass(
                position.unrealized_return_percent
              )}`}
            >
              {formatPercent(position.unrealized_return_percent)}
            </strong>
            <span
              className={`performance-secondary-value ${getToneClass(
                position.unrealized_gain_loss
              )}`}
            >
              {formatSignedCurrency(position.unrealized_gain_loss)}
            </span>
          </div>
        </div>
      ))
    ) : (
      <div className="portfolio-empty-state">Cost basis unavailable</div>
    )}
  </div>
);

const PortfolioOverview = ({ data }) => {
  const largestPosition = data?.largest_position;
  const coverage = data?.cost_basis_coverage || {};
  const coveredPercent = Math.min(Number(coverage.coverage_percent || 0), 100);
  const concentrationPercent = Math.min(
    Number(data?.largest_position_weight_percent || 0),
    100
  );
  const topHoldings = data?.top_holdings || [];

  return (
    <section className="portfolio-overview" aria-label="Portfolio overview">
      <div className="portfolio-metric-grid">
        <div className="summary-card portfolio-metric-card">
          <span className="summary-label">Portfolio Value</span>
          <strong className="summary-value portfolio-metric-value">
            {formatCurrency(data?.total_equity)}
          </strong>
          <span className="metric-footnote">{data?.position_count || 0} positions</span>
        </div>
        <div className="summary-card portfolio-metric-card">
          <span className="summary-label">Unrealized Gain/Loss</span>
          <strong
            className={`summary-value portfolio-metric-value ${getToneClass(
              data?.unrealized_gain_loss
            )}`}
          >
            {formatSignedCurrency(data?.unrealized_gain_loss)}
          </strong>
          <span className={`metric-footnote ${getToneClass(data?.unrealized_return_percent)}`}>
            {formatPercent(data?.unrealized_return_percent)}
          </span>
        </div>
        <div className="summary-card portfolio-metric-card">
          <span className="summary-label">Estimated Annual Dividends</span>
          <strong className="summary-value portfolio-metric-value">
            {formatCurrency(data?.estimated_annual_dividend_income)}
          </strong>
          <span className="metric-footnote">
            {formatPercent(data?.estimated_dividend_yield_percent)} yield
          </span>
        </div>
        <div className="summary-card portfolio-metric-card">
          <span className="summary-label">Largest Position</span>
          <strong className="summary-value portfolio-metric-value">
            {largestPosition ? largestPosition.ticker : "None"}
          </strong>
          <span className="metric-footnote">
            {formatPercent(data?.largest_position_weight_percent)} of portfolio
          </span>
        </div>
      </div>

      <div className="portfolio-insight-grid">
        <article className="portfolio-insight-panel">
          <div className="portfolio-insight-header">
            <div>
              <span className="metric-kicker">Performance</span>
              <h2>Top Movers</h2>
            </div>
            <span className="projection-basis">
              {coverage.covered_position_count || 0} with cost basis
            </span>
          </div>
          <div className="performance-columns">
            <PerformanceList title="Gainers" positions={data?.top_gainers || []} />
            <PerformanceList title="Laggers" positions={data?.top_losers || []} />
          </div>
        </article>

        <article className="portfolio-insight-panel">
          <div className="portfolio-insight-header">
            <div>
              <span className="metric-kicker">Portfolio Shape</span>
              <h2>Concentration</h2>
            </div>
            <span className="projection-basis">
              {coverage.unavailable_position_count || 0} missing basis
            </span>
          </div>

          <div className="portfolio-meter-group">
            <div>
              <div className="portfolio-meter-label">
                <span>Largest holding</span>
                <strong>{formatPercent(data?.largest_position_weight_percent)}</strong>
              </div>
              <div className="portfolio-meter">
                <div style={{ width: `${concentrationPercent}%` }} />
              </div>
            </div>
            <div>
              <div className="portfolio-meter-label">
                <span className="meter-label-with-tooltip">
                  Cost basis coverage
                  <span className="info-tooltip">
                    <button
                      aria-describedby="cost-basis-coverage-tooltip"
                      aria-label="What cost basis coverage means"
                      className="info-tooltip-trigger"
                      type="button"
                    >
                      i
                    </button>
                    <span
                      className="info-tooltip-content"
                      id="cost-basis-coverage-tooltip"
                      role="tooltip"
                    >
                      {COST_BASIS_COVERAGE_HELP}
                    </span>
                  </span>
                </span>
                <strong>{formatPercent(coverage.coverage_percent)}</strong>
              </div>
              <div className="portfolio-meter coverage-meter">
                <div style={{ width: `${coveredPercent}%` }} />
              </div>
            </div>
          </div>

          <div className="top-holdings-list">
            {topHoldings.map((position) => (
              <div className="top-holding-row" key={position.ticker}>
                <div>
                  <strong>{position.ticker}</strong>
                  <span>{position.name}</span>
                </div>
                <div>
                  <strong>{formatCurrency(position.equity)}</strong>
                  <span>{formatPercent(position.weight_percent)}</span>
                </div>
              </div>
            ))}
          </div>
        </article>
      </div>
    </section>
  );
};

export default PortfolioOverview;
