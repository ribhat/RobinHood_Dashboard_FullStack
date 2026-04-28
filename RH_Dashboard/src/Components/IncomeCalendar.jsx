import React from "react";

const formatCurrency = (value) => `$${Number(value || 0).toFixed(2)}`;

const formatDate = (dateText) =>
  new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
  }).format(new Date(`${dateText}T00:00:00`));

const getStatusLabel = (status) =>
  status === "received" ? "Received" : "Estimated";

const IncomeCalendar = ({ data }) => {
  const months = data?.months || [];
  const summary = data?.summary || {};
  const nextPayment = summary.next_expected_payment;
  const asOfDate = data?.as_of_date ? new Date(`${data.as_of_date}T00:00:00`) : new Date();
  const currentMonth = String(asOfDate.getMonth() + 1).padStart(2, "0");
  const currentMonthBucket = months.find((month) => month.month === currentMonth);
  const currentMonthLabel = currentMonthBucket?.month_name || "Current Month";

  return (
    <section className="income-calendar-card" aria-label="Dividend income calendar">
      <div className="income-calendar-header">
        <div>
          <span className="metric-kicker">Income Calendar</span>
          <h2>{data?.year} Dividend Payments</h2>
        </div>
        <span className="projection-basis">Received + estimated cash flow</span>
      </div>

      <div className="income-calendar-summary">
        <div className="income-summary-tile">
          <span className="summary-label">Next Expected Payment</span>
          {nextPayment ? (
            <>
              <strong>{formatCurrency(nextPayment.amount)}</strong>
              <span>
                {nextPayment.ticker} on {formatDate(nextPayment.date)}
              </span>
            </>
          ) : (
            <>
              <strong>{formatCurrency(0)}</strong>
              <span>None scheduled</span>
            </>
          )}
        </div>
        <div className="income-summary-tile">
          <span className="summary-label">{currentMonthLabel} Income</span>
          <strong>{formatCurrency(summary.current_month_income)}</strong>
          <span>
            {formatCurrency(summary.current_month_received)} received /{" "}
            {formatCurrency(summary.current_month_estimated)} estimated
          </span>
        </div>
        <div className="income-summary-tile">
          <span className="summary-label">Remaining Estimated Annual Income</span>
          <strong>{formatCurrency(summary.remaining_estimated_annual_income)}</strong>
          <span>
            {formatCurrency(summary.total_projected_annual_income)} projected total
          </span>
        </div>
      </div>

      <div className="income-month-grid">
        {months.map((month) => (
          <article className="income-month" key={month.month}>
            <div className="income-month-header">
              <h3>{month.month_name}</h3>
              <strong>{formatCurrency(month.total)}</strong>
            </div>
            <div className="income-month-breakdown">
              <span>{formatCurrency(month.received)} received</span>
              <span>{formatCurrency(month.estimated)} estimated</span>
            </div>
            <div className="income-payment-list">
              {month.items.length > 0 ? (
                month.items.map((item, index) => (
                  <span
                    className={`calendar-payment-chip calendar-payment-chip-${item.status}`}
                    key={`${item.ticker}-${item.date}-${item.amount}-${index}`}
                    title={getStatusLabel(item.status)}
                  >
                    <strong>{item.ticker}</strong>
                    <span>{formatDate(item.date)}</span>
                    <span>{formatCurrency(item.amount)}</span>
                  </span>
                ))
              ) : (
                <span className="income-month-empty">No payments</span>
              )}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
};

export default IncomeCalendar;
