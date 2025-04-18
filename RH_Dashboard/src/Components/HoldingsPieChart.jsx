import React from "react";
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  Legend,
} from "recharts";

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
    <div style={{ height: "500px", width: "800px" }}>
      <h3 className="text-center">Portfolio Allocation</h3>
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={chartData}
            cx="50%"
            cy="50%"
            labelLine={false}
            outerRadius={150}
            fill="#8884d8"
            dataKey="value"
            label={({ name, percent }) =>
              `${name}: ${(percent * 100).toFixed(1)}%`
            }
          >
            {chartData.map((entry, index) => (
              <Cell
                key={`cell-${index}`}
                fill={COLORS[index % COLORS.length]}
              />
            ))}
          </Pie>
          <Tooltip
            formatter={(value) => {
              const percentage = ((value / totalEquity) * 100).toFixed(1);
              return [`$${value.toFixed(2)} (${percentage}%)`, "Value"];
            }}
          />
          <Legend
            verticalAlign="bottom"
            height={40}
            wrapperStyle={{ paddingTop: "0px" }}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
};

export default HoldingsPieChart;
