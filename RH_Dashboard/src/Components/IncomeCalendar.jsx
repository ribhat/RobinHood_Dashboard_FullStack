import React, { useMemo } from "react";

const formatCurrency = (value) => `$${Number(value || 0).toFixed(2)}`;

const formatDate = (dateText) =>
  new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
  }).format(new Date(`${dateText}T00:00:00`));

const getStatusLabel = (status) =>
  status === "received" ? "Received" : "Estimated";

const getPaymentStatusRank = (status) => (status === "received" ? 0 : 1);

const sortPaymentsByStatusAndAmount = (a, b) => {
  const statusDifference = getPaymentStatusRank(a.status) - getPaymentStatusRank(b.status);

  if (statusDifference !== 0) {
    return statusDifference;
  }

  const amountDifference = Number(b.amount || 0) - Number(a.amount || 0);

  if (amountDifference !== 0) {
    return amountDifference;
  }

  return `${a.date || ""}-${a.ticker || ""}`.localeCompare(
    `${b.date || ""}-${b.ticker || ""}`
  );
};

const IncomeCalendar = ({ data }) => {
  const sortedMonths = useMemo(
    () =>
      (data?.months || []).map((month) => ({
        ...month,
        items: [...(month.items || [])].sort(sortPaymentsByStatusAndAmount),
      })),
    [data?.months]
  );

  if (sortedMonths.length === 0) {
    return (
      <section className="income-calendar-card" aria-label="Dividend income calendar">
        <div className="panel-state empty-state">
          No received or estimated dividend payments are available yet.
        </div>
      </section>
    );
  }

  return (
    <section className="income-calendar-card" aria-label="Dividend income calendar">
      <div className="income-calendar-header">
        <div>
          <span className="metric-kicker">Income Calendar</span>
          <h2>{data?.year} Dividend Payments</h2>
        </div>
        <span className="projection-basis">Received + estimated cash flow</span>
      </div>

      <div className="income-month-grid">
        {sortedMonths.map((month) => (
          <article className="income-month" key={month.month}>
            <div className="income-month-header">
              <h3>{month.month_name}</h3>
              <strong>{formatCurrency(month.total)}</strong>
            </div>
            <div className="income-month-breakdown">
              <span>{formatCurrency(month.received)} received</span>
              <span>{formatCurrency(month.estimated)} estimated remaining</span>
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
