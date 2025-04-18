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

const DividendChart = ({ data, chartType }) => {
  const [comparePreviousYear, setComparePreviousYear] = useState(false);
  const [previousYearData, setPreviousYearData] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const currentYear = new Date().getFullYear();
  const previousYear = currentYear - 1;

  useEffect(() => {
    if (comparePreviousYear && !previousYearData) {
      fetchPreviousYearData();
    }
  }, [comparePreviousYear]);

  const fetchPreviousYearData = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(
        `http://localhost:5000/api/dividends/yearly/${previousYear}`
      );
      const data = await response.json();
      setPreviousYearData(data);
    } catch (error) {
      console.error("Error fetching previous year data:", error);
    } finally {
      setIsLoading(false);
    }
  };

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

  return (
    <div style={{ height: "400px" }}>
      <div className="d-flex justify-content-between align-items-center mb-3">
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
        <div className="text-center mt-4">Loading previous year data...</div>
      ) : (
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
            <ScatterChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" />
              <YAxis />
              <Tooltip
                formatter={(value) => [`$${value.toFixed(2)}`, "Dividends"]}
              />
              <Legend />
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
      )}
    </div>
  );
};

export default DividendChart;
