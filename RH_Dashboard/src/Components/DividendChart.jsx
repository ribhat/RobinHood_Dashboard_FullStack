import React, { useState, useEffect } from "react";
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
import { Form } from "react-bootstrap";
import { fetchJson } from "../api";

const DividendChart = ({ data, chartType }) => {
  const [comparePreviousYear, setComparePreviousYear] = useState(false);
  const [previousYearData, setPreviousYearData] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const currentYear = new Date().getFullYear();
  const previousYear = currentYear - 1;

  useEffect(() => {
    const fetchPreviousYearData = async () => {
      setIsLoading(true);
      try {
        const data = await fetchJson(`/api/dividends/yearly/${previousYear}`);
        setPreviousYearData(data);
      } catch (error) {
        console.error("Error fetching previous year data:", error);
      } finally {
        setIsLoading(false);
      }
    };

    if (comparePreviousYear && !previousYearData) {
      fetchPreviousYearData();
    }
  }, [comparePreviousYear, previousYear, previousYearData]);

  // Prepare chart data
  const chartData = data.months.map((month, index) => {
    const monthData = {
      month,
      [`${currentYear}`]: data.dividends[index],
    };

    if (comparePreviousYear && previousYearData) {
      monthData[`${previousYear}`] = previousYearData.dividends[index];
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
      <div className="chart-card-header">
        <h3 className="text-center mb-0">Dividend Breakdown by Month</h3>
        <Form.Check
          type="switch"
          id="compare-year-switch"
          label={`Compare with ${previousYear}`}
          checked={comparePreviousYear}
          onChange={() => setComparePreviousYear(!comparePreviousYear)}
          disabled={isLoading}
        />
      </div>
      {isLoading ? (
        <div className="chart-loading-state compact-loading-state">
          Loading previous year data...
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
                  dataKey={`${currentYear}`}
                  fill="#8884d8"
                  name={`${currentYear}`}
                />
                {comparePreviousYear && previousYearData && (
                  <Bar
                    dataKey={`${previousYear}`}
                    fill="#82ca9d"
                    name={`${previousYear}`}
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
                  dataKey={`${currentYear}`}
                  stroke="#8884d8"
                  activeDot={{ r: 8 }}
                  name={`${currentYear}`}
                />
                {comparePreviousYear && previousYearData && (
                  <Line
                    type="monotone"
                    dataKey={`${previousYear}`}
                    stroke="#82ca9d"
                    activeDot={{ r: 8 }}
                    name={`${previousYear}`}
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
                  name={`${currentYear}`}
                  dataKey={`${currentYear}`}
                  fill="#8884d8"
                />
                {comparePreviousYear && previousYearData && (
                  <Scatter
                    name={`${previousYear}`}
                    dataKey={`${previousYear}`}
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
