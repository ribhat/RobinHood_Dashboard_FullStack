import React from "react";

const formatCurrency = (value) => `$${Number(value || 0).toFixed(2)}`;
const formatDate = (dateText) =>
  new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
  }).format(new Date(`${dateText}T00:00:00`));
const getPaymentDate = (payment) => payment.actual_date || payment.expected_date;

const IncomeProjection = ({ data }) => {
  const previousYearTotal = data.previous_year_actual_total;
  const currentYearCollected = data.current_year_collected;
  const currentHoldingsEstimate = data.current_holdings_estimate;
  const projectionDetails = currentHoldingsEstimate.details || [];
  const progressPercent =
    previousYearTotal > 0
      ? Math.min((currentYearCollected / previousYearTotal) * 100, 100)
      : 0;
  const hasExceededPreviousYear =
    currentYearCollected >= previousYearTotal && previousYearTotal > 0;
  const unmodeledTickers = currentHoldingsEstimate.unmodeled_tickers || [];
  const externalLookupUsed = currentHoldingsEstimate.external_lookup_used || [];
  const rateLimitedTickers = currentHoldingsEstimate.rate_limited_tickers || [];

  return (
    <section className="projection-card" aria-label="Dividend income projection">
      <div className="projection-header">
        <div>
          <span className="metric-kicker">Income Projection</span>
          <h2>Dividend Income Outlook</h2>
        </div>
        <span className="projection-basis">Previous year actuals + current holdings</span>
      </div>

      <div className="projection-section">
        <div className="projection-section-header">
          <h3>{data.previous_year} Actual Dividend Income</h3>
          <span>Conservative baseline</span>
        </div>
        <div className="projection-grid">
          <div className="projection-primary">
            <span className="summary-label">Actual Annual Income</span>
            <strong>{formatCurrency(previousYearTotal)}</strong>
          </div>
          <div className="projection-metric">
            <span className="summary-label">Actual Monthly Average</span>
            <strong>{formatCurrency(data.previous_year_monthly_average)}</strong>
          </div>
          <div className="projection-metric">
            <span className="summary-label">{data.current_year} Collected</span>
            <strong>{formatCurrency(currentYearCollected)}</strong>
          </div>
          <div className="projection-metric">
            <span className="summary-label">
              {hasExceededPreviousYear ? "Above Previous Year" : "Remaining To Match"}
            </span>
            <strong>
              {formatCurrency(
                hasExceededPreviousYear
                  ? currentYearCollected - previousYearTotal
                  : data.remaining_to_previous_year_actual
              )}
            </strong>
          </div>
        </div>
        <div
          className="projection-progress"
          aria-label={`${progressPercent.toFixed(0)} percent of previous year income reached`}
        >
          <div
            className="projection-progress-bar"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>

      <div className="projection-section">
        <div className="projection-section-header">
          <h3>{data.current_year} Current Holdings Estimate</h3>
          <span>Current shares, prior-year payment schedule</span>
        </div>
        <div className="projection-grid current-holdings-grid">
          <div className="projection-primary">
            <span className="summary-label">Estimated Annual Income</span>
            <strong>{formatCurrency(currentHoldingsEstimate.total)}</strong>
          </div>
          <div className="projection-metric">
            <span className="summary-label">Estimated Monthly Average</span>
            <strong>{formatCurrency(currentHoldingsEstimate.monthly_average)}</strong>
          </div>
          <div className="projection-metric">
            <span className="summary-label">Modeled Positions</span>
            <strong>{currentHoldingsEstimate.modeled_ticker_count}</strong>
          </div>
          <div className="projection-metric">
            <span className="summary-label">Unmodeled Positions</span>
            <strong>{unmodeledTickers.length}</strong>
          </div>
        </div>
        {unmodeledTickers.length > 0 && (
          <p className="projection-note">
            No prior-year dividend schedule was found for {unmodeledTickers.join(", ")}.
          </p>
        )}
        {externalLookupUsed.length > 0 && (
          <p className="projection-note">
            Polygon fallback supplied schedules for {externalLookupUsed.join(", ")}.
          </p>
        )}
        {rateLimitedTickers.length > 0 && (
          <p className="projection-note">
            Polygon fallback skipped {rateLimitedTickers.join(", ")} to stay under the free request limit.
          </p>
        )}
        {projectionDetails.length > 0 && (
          <div className="projection-detail">
            <div className="projection-section-header">
              <h3>Modeled Dividend Schedule</h3>
              <span>{projectionDetails.length} positions</span>
            </div>
            <div className="projection-table-wrap">
              <table className="projection-table">
                <thead>
                  <tr>
                    <th>Ticker</th>
                    <th>Shares</th>
                    <th>Annual Outlook</th>
                    <th>Payment Outlook</th>
                  </tr>
                </thead>
                <tbody>
                  {projectionDetails.map((position, positionIndex) => (
                    <tr key={`${position.ticker}-${position.opened_at}-${positionIndex}`}>
                      <td>
                        <strong>{position.ticker}</strong>
                        <span>Opened {position.opened_at}</span>
                      </td>
                      <td>{Number(position.quantity).toFixed(4)}</td>
                      <td>{formatCurrency(position.projected_total)}</td>
                      <td>
                        <div className="payment-chip-list">
                          {position.projected_payments.map((payment, index) => (
                            <span
                              className={`payment-chip ${
                                payment.source === "actual" ? "payment-chip-actual" : ""
                              }`}
                              title={payment.label}
                              key={`${position.ticker}-${getPaymentDate(payment)}-${payment.rate}-${index}`}
                            >
                              {formatDate(getPaymentDate(payment))} {formatCurrency(payment.amount)}
                            </span>
                          ))}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </section>
  );
};

export default IncomeProjection;
