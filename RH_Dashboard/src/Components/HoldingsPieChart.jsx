import React, { useMemo, useState } from "react";
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
} from "recharts";

const HoldingsPieChart = ({ data }) => {
  const [sortConfig, setSortConfig] = useState({
    key: "equity",
    direction: "desc",
  });
  // Convert data to array and sort by equity in descending order
  let chartData = Object.entries(data)
    .map(([ticker, details]) => ({
      name: ticker,
      value: parseFloat(details.equity),
    }))
    .sort((a, b) => b.value - a.value);

  // Calculate total equity for all holdings
  const totalEquity = chartData.reduce((sum, item) => sum + item.value, 0);
  const holdingsRows = useMemo(() => {
    const rows = Object.entries(data).map(([ticker, details]) => {
      const equity = Number(details.equity || 0);

      return {
        ticker,
        name: details.name || ticker,
        quantity: Number(details.quantity || 0),
        equity,
        price: Number(details.price || details.current_price || 0),
        averageBuyPrice: Number(details.average_buy_price || 0),
        weight: totalEquity > 0 ? (equity / totalEquity) * 100 : 0,
      };
    });

    return rows.sort((a, b) => {
      const aValue = a[sortConfig.key];
      const bValue = b[sortConfig.key];
      const direction = sortConfig.direction === "asc" ? 1 : -1;

      if (typeof aValue === "string") {
        return aValue.localeCompare(bValue) * direction;
      }

      return (aValue - bValue) * direction;
    });
  }, [data, sortConfig, totalEquity]);

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
      <div className="holdings-table-wrap">
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
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default HoldingsPieChart;
