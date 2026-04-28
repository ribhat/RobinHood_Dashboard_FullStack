import React, { useMemo, useState } from "react";
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
} from "recharts";

const formatCurrency = (value) => (
  value === null || value === undefined ? "N/A" : `$${Number(value).toFixed(2)}`
);

const formatPercent = (value) => (
  value === null || value === undefined ? "N/A" : `${Number(value).toFixed(2)}%`
);

const getPerformanceClass = (value) => {
  if (value === null || value === undefined || Number(value) === 0) {
    return "";
  }

  return Number(value) > 0 ? "positive-metric" : "negative-metric";
};

const HoldingsPieChart = ({ data }) => {
  // Convert data to array and sort by equity in descending order
  let chartData = Object.entries(data)
    .map(([ticker, details]) => ({
      name: ticker,
      value: parseFloat(details.equity),
    }))
    .sort((a, b) => b.value - a.value);

  // Calculate total equity for all holdings
  const totalEquity = chartData.reduce((sum, item) => sum + item.value, 0);

  if (!chartData.length || totalEquity === 0) {
    return (
      <div className="chart-shell holdings-chart-shell">
        <div className="panel-state">No holdings data available.</div>
      </div>
    );
  }

  // If there are more than 10 holdings, keep top 10 and sum the rest as "Other"
  if (chartData.length > 10) {
    const top10 = chartData.slice(0, 10);
    const others = chartData.slice(10);
    const othersSum = others.reduce((sum, item) => sum + item.value, 0);

    // Only add "Other" if the sum is greater than 0
    if (othersSum > 0) {
      chartData = [...top10, { name: "Other", value: othersSum }];
    } else {
      chartData = top10;
    }
  }

  const COLORS = [
    "#0088FE",
    "#00C49F",
    "#FFBB28",
    "#FF8042",
    "#8884D8",
    "#82CA9D",
    "#FF6B6B",
    "#4ECDC4",
    "#45B7D1",
    "#FFA07A",
    "#A4DE6C",
    "#D0ED57",
  ];

  return (
    <div className="chart-shell holdings-chart-shell">
      <div className="chart-content holdings-chart-content">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart margin={{ top: 8, right: 8, bottom: 8, left: 8 }}>
            <Pie
              data={chartData}
              cx="50%"
              cy="50%"
              innerRadius="48%"
              outerRadius="78%"
              fill="#8884d8"
              dataKey="value"
              nameKey="name"
            >
              {chartData.map((entry, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={COLORS[index % COLORS.length]}
                />
              ))}
            </Pie>
            <Tooltip
              formatter={(value, name) => {
                const percentage = ((value / totalEquity) * 100).toFixed(1);
                return [`$${value.toFixed(2)} (${percentage}%)`, name];
              }}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <div className="holdings-list" aria-label="Portfolio allocation legend">
        {chartData.map((holding, index) => {
          const percentage = ((holding.value / totalEquity) * 100).toFixed(1);

          return (
            <div className="holding-row" key={holding.name}>
              <span
                className="holding-color"
                style={{ backgroundColor: COLORS[index % COLORS.length] }}
              />
              <span className="holding-name">{holding.name}</span>
              <span className="holding-value">${holding.value.toFixed(2)}</span>
              <span className="holding-percent">{percentage}%</span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export const HoldingsTable = ({ data, showPerformance = false }) => {
  const [sortConfig, setSortConfig] = useState({
    key: "equity",
    direction: "desc",
  });
  const totalEquity = Object.values(data).reduce(
    (sum, details) => sum + Number(details.equity || 0),
    0
  );
  const holdingsRows = useMemo(() => {
    const rows = Object.entries(data).map(([ticker, details]) => {
      const equity = Number(details.equity || 0);

      const row = {
        ticker,
        name: details.name || ticker,
        quantity: Number(details.quantity || 0),
        equity,
        price: Number(details.price || details.current_price || 0),
        averageBuyPrice: Number(details.average_buy_price || 0),
        costBasis: null,
        unrealizedGainLoss: null,
        unrealizedReturnPercent: null,
        weight: totalEquity > 0 ? (equity / totalEquity) * 100 : 0,
      };

      if (row.averageBuyPrice > 0 && row.quantity > 0) {
        row.costBasis = row.averageBuyPrice * row.quantity;
        row.unrealizedGainLoss = row.equity - row.costBasis;
        row.unrealizedReturnPercent = (
          row.unrealizedGainLoss / row.costBasis
        ) * 100;
      }

      return row;
    });

    return rows.sort((a, b) => {
      const aValue = a[sortConfig.key];
      const bValue = b[sortConfig.key];
      const direction = sortConfig.direction === "asc" ? 1 : -1;

      if (aValue === null && bValue === null) {
        return 0;
      }

      if (aValue === null) {
        return 1;
      }

      if (bValue === null) {
        return -1;
      }

      if (typeof aValue === "string") {
        return aValue.localeCompare(bValue) * direction;
      }

      return (aValue - bValue) * direction;
    });
  }, [data, sortConfig, totalEquity]);

  const requestSort = (key) => {
    setSortConfig((currentSort) => ({
      key,
      direction:
        currentSort.key === key && currentSort.direction === "desc" ? "asc" : "desc",
    }));
  };
  const renderSortLabel = (label, key) => {
    if (sortConfig.key !== key) {
      return label;
    }

    return `${label} (${sortConfig.direction})`;
  };

  return (
      <div className="holdings-table-wrap" aria-label="Holdings details">
        <table className="holdings-table">
          <thead>
            <tr>
              <th>
                <button type="button" onClick={() => requestSort("ticker")}>
                  {renderSortLabel("Ticker", "ticker")}
                </button>
              </th>
              <th>
                <button type="button" onClick={() => requestSort("quantity")}>
                  {renderSortLabel("Shares", "quantity")}
                </button>
              </th>
              <th>
                <button type="button" onClick={() => requestSort("equity")}>
                  {renderSortLabel("Equity", "equity")}
                </button>
              </th>
              <th>
                <button type="button" onClick={() => requestSort("weight")}>
                  {renderSortLabel("Weight", "weight")}
                </button>
              </th>
              <th>
                <button type="button" onClick={() => requestSort("price")}>
                  {renderSortLabel("Price", "price")}
                </button>
              </th>
              <th>
                <button type="button" onClick={() => requestSort("averageBuyPrice")}>
                  {renderSortLabel("Avg Cost", "averageBuyPrice")}
                </button>
              </th>
              {showPerformance && (
                <>
                  <th>
                    <button type="button" onClick={() => requestSort("unrealizedGainLoss")}>
                      {renderSortLabel("Gain/Loss", "unrealizedGainLoss")}
                    </button>
                  </th>
                  <th>
                    <button type="button" onClick={() => requestSort("unrealizedReturnPercent")}>
                      {renderSortLabel("Return", "unrealizedReturnPercent")}
                    </button>
                  </th>
                </>
              )}
            </tr>
          </thead>
          <tbody>
            {holdingsRows.map((holding) => (
              <tr key={holding.ticker}>
                <td>
                  <strong>{holding.ticker}</strong>
                  <span>{holding.name}</span>
                </td>
                <td>{holding.quantity.toFixed(4)}</td>
                <td>${holding.equity.toFixed(2)}</td>
                <td>{holding.weight.toFixed(1)}%</td>
                <td>${holding.price.toFixed(2)}</td>
                <td>${holding.averageBuyPrice.toFixed(2)}</td>
                {showPerformance && (
                  <>
                    <td className={getPerformanceClass(holding.unrealizedGainLoss)}>
                      {formatCurrency(holding.unrealizedGainLoss)}
                    </td>
                    <td className={getPerformanceClass(holding.unrealizedReturnPercent)}>
                      {formatPercent(holding.unrealizedReturnPercent)}
                    </td>
                  </>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
  );
};

export default HoldingsPieChart;
