import React, { useState, useEffect } from "react";
import { Container, Row, Col, Dropdown, Card } from "react-bootstrap";
import HoldingsPieChart from "./Components/HoldingsPieChart";
import DividendChart from "./Components/DividendChart";
import PortfolioSummary from "./Components/PortfolioSummary";
import "bootstrap/dist/css/bootstrap.min.css";
import "./App.css"; // We'll create this for custom styles

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
    <Container fluid className="dashboard-container">
      {/* Header Section */}
      <Row className="justify-content-center my-4">
        <Col md={10} className="text-center">
          <h1 className="dashboard-title">Dividend Dashboard</h1>
          <p className="text-muted">
            Track your investments and dividend income
          </p>
        </Col>
      </Row>

      {/* Main Content Section */}
      <Row className="mb-4">
        {/* Holdings Chart Card */}
        <Col md={6} className="mb-4">
          <Card className="h-100 chart-card">
            <Card.Body>
              <Card.Title className="text-center">
                Portfolio Holdings
              </Card.Title>
              {holdingsData && <HoldingsPieChart data={holdingsData} />}
            </Card.Body>
          </Card>
        </Col>

        {/* Dividend Chart Card */}
        <Col md={6} className="mb-4">
          <Card className="h-100 chart-card">
            <Card.Body>
              <div className="d-flex justify-content-between align-items-center mb-3">
                <Card.Title>Dividend Performance</Card.Title>
                <Dropdown>
                  <Dropdown.Toggle
                    variant="outline-primary"
                    id="dropdown-basic"
                  >
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
              </div>
              {yearlyDividendData && (
                <DividendChart
                  data={yearlyDividendData}
                  chartType={chartType}
                />
              )}
            </Card.Body>
          </Card>
        </Col>
      </Row>

      {/* Portfolio Summary Section */}
      {portfolioData && (
        <Row className="mb-5">
          <Col md={12}>
            <PortfolioSummary
              equity={portfolioData.equity}
              dividendsThisMonth={portfolioData.dividends_this_month}
              dividendsThisYear={portfolioData.dividends_this_year}
            />
          </Col>
        </Row>
      )}
    </Container>
  );
}

export default App;
