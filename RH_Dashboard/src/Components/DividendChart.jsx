import React from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  LineChart,
  Line,
  ScatterChart,
  Scatter,
} from "recharts";

const DividendChart = ({ data, chartType }) => {
  const chartData = data.months.map((month, index) => ({
    month,
    dividends: data.dividends[index],
  }));

  return (
    <div style={{ height: "400px" }}>
      <h3 className="text-center">Dividend Breakdown by Month</h3>
      <ResponsiveContainer width="100%" height="100%">
        {chartType === "Bar Plot" ? (
          <BarChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="month" />
            <YAxis />
            <Tooltip
              formatter={(value) => [`$${value.toFixed(2)}`, "Dividends"]}
            />
            <Legend />
            <Bar dataKey="dividends" fill="#8884d8" />
          </BarChart>
        ) : chartType === "Line Graph" ? (
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="month" />
            <YAxis />
            <Tooltip
              formatter={(value) => [`$${value.toFixed(2)}`, "Dividends"]}
            />
            <Legend />
            <Line
              type="monotone"
              dataKey="dividends"
              stroke="#8884d8"
              activeDot={{ r: 8 }}
            />
          </LineChart>
        ) : (
          <ScatterChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="month" />
            <YAxis />
            <Tooltip
              formatter={(value) => [`$${value.toFixed(2)}`, "Dividends"]}
            />
            <Legend />
            <Scatter name="Dividends" dataKey="dividends" fill="#8884d8" />
          </ScatterChart>
        )}
      </ResponsiveContainer>
    </div>
  );
};

export default DividendChart;
