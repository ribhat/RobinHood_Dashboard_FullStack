import React from "react";

const PortfolioSummary = ({
  equity,
  dividendsThisMonth,
  dividendsThisYear,
}) => {
  const metrics = [
    {
      label: "Portfolio Value",
      value: `$${parseFloat(equity).toFixed(2)}`,
    },
    {
      label: "Dividends This Month",
      value: `$${dividendsThisMonth.toFixed(2)}`,
    },
    {
      label: "Dividends This Year",
      value: `$${dividendsThisYear.toFixed(2)}`,
    },
  ];

  return (
    <section className="summary-grid" aria-label="Portfolio summary">
      {metrics.map((metric) => (
        <div className="summary-card" key={metric.label}>
          <span className="summary-label">{metric.label}</span>
          <strong className="summary-value">{metric.value}</strong>
        </div>
      ))}
    </section>
  );
};

export default PortfolioSummary;
