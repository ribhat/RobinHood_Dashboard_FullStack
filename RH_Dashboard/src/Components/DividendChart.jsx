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

const DividendChart = ({
  data,
  comparisonData,
  chartType,
  selectedYear,
  comparePreviousYear,
  isComparisonLoading,
}) => {
  const comparisonYear = selectedYear - 1;
  const selectedYearTotal = data.total ?? data.dividends.reduce((sum, value) => sum + value, 0);
  const today = new Date();
  const currentYear = today.getFullYear();
  const elapsedMonths = selectedYear === currentYear
    ? Math.min(today.getMonth() + 1, data.dividends.length)
    : data.dividends.length;
  const averageMonthCount = Math.max(elapsedMonths, 1);
  const selectedYearAverage = selectedYearTotal / averageMonthCount;
  const comparisonTotal = comparisonData?.total ?? null;

  const chartData = data.months.map((month, index) => {
    const monthData = {
      month,
      [`${selectedYear}`]: data.dividends[index],
    };

    if (comparePreviousYear && comparisonData) {
      monthData[`${comparisonYear}`] = comparisonData.dividends[index];
    }

    return monthData;
  });

  const hasDividendData = data.dividends.some((value) => value > 0);

  if (!hasDividendData) {
    return (
      <div className="chart-shell dividend-chart-shell">
        <div className="panel-state">No dividend data available for this year.</div>
      </div>
    );
  }

  return (
    <div className="chart-shell dividend-chart-shell">
      <div className="dividend-chart-summary">
        <div>
          <span className="metric-kicker">{selectedYear} Total</span>
          <strong>${selectedYearTotal.toFixed(2)}</strong>
        </div>
        <div>
          <span className="metric-kicker">Monthly Average</span>
          <strong>${selectedYearAverage.toFixed(2)}</strong>
        </div>
        {comparePreviousYear && comparisonTotal !== null && (
          <div>
            <span className="metric-kicker">{comparisonYear} Total</span>
            <strong>${comparisonTotal.toFixed(2)}</strong>
          </div>
        )}
      </div>
      {isComparisonLoading ? (
        <div className="chart-loading-state compact-loading-state">
          Loading comparison data...
        </div>
      ) : (
        <div className="chart-content">
          <ResponsiveContainer width="100%" height="100%">
            {chartType === "Bar Plot" ? (
              <BarChart
                data={chartData}
                margin={{ top: 12, right: 20, bottom: 34, left: 4 }}
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis />
                <Tooltip
                  formatter={(value) => [`$${value.toFixed(2)}`, "Dividends"]}
                />
                <Legend verticalAlign="bottom" height={36} />
                <Bar
                  dataKey={`${selectedYear}`}
                  fill="#8884d8"
                  name={`${selectedYear}`}
                />
                {comparePreviousYear && comparisonData && (
                  <Bar
                    dataKey={`${comparisonYear}`}
                    fill="#82ca9d"
                    name={`${comparisonYear}`}
                  />
                )}
              </BarChart>
            ) : chartType === "Line Graph" ? (
              <LineChart
                data={chartData}
                margin={{ top: 12, right: 20, bottom: 34, left: 4 }}
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis />
                <Tooltip
                  formatter={(value) => [`$${value.toFixed(2)}`, "Dividends"]}
                />
                <Legend verticalAlign="bottom" height={36} />
                <Line
                  type="monotone"
                  dataKey={`${selectedYear}`}
                  stroke="#8884d8"
                  activeDot={{ r: 8 }}
                  name={`${selectedYear}`}
                />
                {comparePreviousYear && comparisonData && (
                  <Line
                    type="monotone"
                    dataKey={`${comparisonYear}`}
                    stroke="#82ca9d"
                    activeDot={{ r: 8 }}
                    name={`${comparisonYear}`}
                  />
                )}
              </LineChart>
            ) : (
              <ScatterChart
                data={chartData}
                margin={{ top: 12, right: 20, bottom: 34, left: 4 }}
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis />
                <Tooltip
                  formatter={(value) => [`$${value.toFixed(2)}`, "Dividends"]}
                />
                <Legend verticalAlign="bottom" height={36} />
                <Scatter
                  name={`${selectedYear}`}
                  dataKey={`${selectedYear}`}
                  fill="#8884d8"
                />
                {comparePreviousYear && comparisonData && (
                  <Scatter
                    name={`${comparisonYear}`}
                    dataKey={`${comparisonYear}`}
                    fill="#82ca9d"
                  />
                )}
              </ScatterChart>
            )}
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
};

export default DividendChart;
