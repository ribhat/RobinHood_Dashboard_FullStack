import React, { useState, useEffect } from "react";
import { Container, Row, Col, Dropdown } from "react-bootstrap";
import HoldingsPieChart from "./Components/HoldingsPieChart";
import DividendChart from "./Components/DividendChart";
import PortfolioSummary from "./Components/PortfolioSummary";
import "bootstrap/dist/css/bootstrap.min.css";

function App() {
  const [chartType, setChartType] = useState("Bar Plot");
  const [portfolioData, setPortfolioData] = useState(null);
  const [holdingsData, setHoldingsData] = useState(null);
  const [dividendData, setDividendData] = useState(null);
  const [yearlyDividendData, setYearlyDividendData] = useState(null);

  useEffect(() => {
    // Fetch all data when component mounts
    fetchPortfolioData();
    fetchHoldingsData();
    fetchDividendData();
    fetchYearlyDividendData();
  }, []);

  const fetchPortfolioData = async () => {
    const response = await fetch("http://localhost:5000/api/portfolio");
    console.log(response);
    const data = await response.json();
    setPortfolioData(data);
  };

  const fetchHoldingsData = async () => {
    const response = await fetch("http://localhost:5000/api/holdings");
    console.log(response);
    const data = await response.json();
    setHoldingsData(data);
  };

  const fetchDividendData = async () => {
    const response = await fetch("http://localhost:5000/api/dividends");
    const data = await response.json();
    setDividendData(data);
  };

  const fetchYearlyDividendData = async () => {
    const currentYear = new Date().getFullYear();
    const response = await fetch(
      `http://localhost:5000/api/dividends/yearly/${currentYear}`
    );
    const data = await response.json();
    setYearlyDividendData(data);
  };

  const handleChartTypeChange = (type) => {
    setChartType(type);
  };

  return (
    <Container fluid>
      <Row className="justify-content-center mt-3">
        <Col md={8} className="text-center">
          <h1>Dividend Dashboard</h1>
        </Col>
      </Row>

      <Row className="mt-4">
        <Col md={6}>
          {holdingsData && <HoldingsPieChart data={holdingsData} />}
        </Col>
        <Col md={6}>
          {yearlyDividendData && (
            <>
              <Dropdown className="float-right mb-2">
                <Dropdown.Toggle variant="primary" id="dropdown-basic">
                  {chartType}
                </Dropdown.Toggle>
                <Dropdown.Menu>
                  <Dropdown.Item
                    onClick={() => handleChartTypeChange("Bar Plot")}
                  >
                    Bar Plot
                  </Dropdown.Item>
                  <Dropdown.Item
                    onClick={() => handleChartTypeChange("Scatter Plot")}
                  >
                    Scatter Plot
                  </Dropdown.Item>
                  <Dropdown.Item
                    onClick={() => handleChartTypeChange("Line Graph")}
                  >
                    Line Graph
                  </Dropdown.Item>
                </Dropdown.Menu>
              </Dropdown>
              <DividendChart data={yearlyDividendData} chartType={chartType} />
            </>
          )}
        </Col>
      </Row>

      {portfolioData && (
        <PortfolioSummary
          equity={portfolioData.equity}
          dividendsThisMonth={portfolioData.dividends_this_month}
          dividendsThisYear={portfolioData.dividends_this_year}
        />
      )}
    </Container>
  );
}

export default App;
