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

const getNextExpectedPaymentGroup = (months) => {
  const expectedPayments = months
    .flatMap((month) => month.items || [])
    .filter((item) => item.status !== "received" && item.date)
    .sort((a, b) => {
      const dateDifference = `${a.date}`.localeCompare(`${b.date}`);

      if (dateDifference !== 0) {
        return dateDifference;
      }

      return Number(b.amount || 0) - Number(a.amount || 0);
    });

  if (expectedPayments.length === 0) {
    return null;
  }

  const nextDate = expectedPayments[0].date;
  const paymentsOnNextDate = expectedPayments.filter((item) => item.date === nextDate);
  const amount = paymentsOnNextDate.reduce(
    (total, item) => total + Number(item.amount || 0),
    0
  );
  const tickers = paymentsOnNextDate
    .map((item) => item.ticker)
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b));

  return {
    amount,
    date: nextDate,
    tickers,
  };
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
  const summary = data?.summary || {};
  const nextPayment = useMemo(
    () => getNextExpectedPaymentGroup(sortedMonths),
    [sortedMonths]
  );
  const asOfDate = data?.as_of_date ? new Date(`${data.as_of_date}T00:00:00`) : new Date();
  const currentMonth = String(asOfDate.getMonth() + 1).padStart(2, "0");
  const currentMonthBucket = sortedMonths.find((month) => month.month === currentMonth);
  const currentMonthLabel = currentMonthBucket?.month_name || "Current Month";

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

      <div className="income-calendar-summary">
        <div className="income-summary-tile">
          <span className="summary-label">Next Expected Payment</span>
          {nextPayment ? (
            <>
              <strong>{formatCurrency(nextPayment.amount)}</strong>
              <span>
                {nextPayment.tickers.join(", ")} on {formatDate(nextPayment.date)}
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
            {formatCurrency(summary.current_month_estimated)} estimated remaining
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
