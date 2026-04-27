import { useState, useEffect } from "react";
import { Container, Row, Col, Dropdown, Card } from "react-bootstrap";
import HoldingsPieChart from "./Components/HoldingsPieChart";
import DividendChart from "./Components/DividendChart";
import PortfolioSummary from "./Components/PortfolioSummary";
import { fetchJson } from "./api";
import "bootstrap/dist/css/bootstrap.min.css";
import "./App.css"; // We'll create this for custom styles

function App() {
  const [chartType, setChartType] = useState("Bar Plot");
  const [portfolioData, setPortfolioData] = useState(null);
  const [holdingsData, setHoldingsData] = useState(null);
  const [yearlyDividendData, setYearlyDividendData] = useState(null);
  const [loading, setLoading] = useState({
    portfolio: true,
    holdings: true,
    dividends: true,
  });
  const [errors, setErrors] = useState({});

  useEffect(() => {
    const fetchSection = async (section, path, onSuccess) => {
      try {
        const data = await fetchJson(path);
        onSuccess(data);
      } catch (error) {
        setErrors((currentErrors) => ({
          ...currentErrors,
          [section]: error.message,
        }));
      } finally {
        setLoading((currentLoading) => ({
          ...currentLoading,
          [section]: false,
        }));
      }
    };

    const currentYear = new Date().getFullYear();

    fetchSection("portfolio", "/api/portfolio", setPortfolioData);
    fetchSection("holdings", "/api/holdings", setHoldingsData);
    fetchSection(
      "dividends",
      `/api/dividends/yearly/${currentYear}`,
      setYearlyDividendData
    );
  }, []);

  const handleChartTypeChange = (type) => {
    setChartType(type);
  };

  const renderLoadingState = (section) => {
    if (section === "portfolio") {
      return (
        <div className="summary-placeholder-grid">
          <div className="summary-placeholder-card">
            <span className="placeholder-label">Portfolio Value</span>
            <span className="placeholder-line" />
          </div>
          <div className="summary-placeholder-card">
            <span className="placeholder-label">Dividends This Month</span>
            <span className="placeholder-line" />
          </div>
          <div className="summary-placeholder-card">
            <span className="placeholder-label">Dividends This Year</span>
            <span className="placeholder-line" />
          </div>
        </div>
      );
    }

    return (
      <div className="chart-loading-state">
        <div className="loading-ring" aria-hidden="true" />
        <span>Loading dashboard data...</span>
      </div>
    );
  };

  const renderPanelState = (section, children) => {
    if (loading[section]) {
      return renderLoadingState(section);
    }

    if (errors[section]) {
      return <div className="panel-state error-state">{errors[section]}</div>;
    }

    return children;
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
              <Card.Title className="chart-title text-center">
                Portfolio Holdings
              </Card.Title>
              {renderPanelState(
                "holdings",
                holdingsData && <HoldingsPieChart data={holdingsData} />
              )}
            </Card.Body>
          </Card>
        </Col>

        {/* Dividend Chart Card */}
        <Col md={6} className="mb-4">
          <Card className="h-100 chart-card">
            <Card.Body>
              <div className="chart-card-header">
                <Card.Title className="chart-title mb-0">
                  Dividend Performance
                </Card.Title>
                <Dropdown>
                  <Dropdown.Toggle
                    variant="outline-primary"
                    size="sm"
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
              {renderPanelState(
                "dividends",
                yearlyDividendData && (
                  <DividendChart
                    data={yearlyDividendData}
                    chartType={chartType}
                  />
                )
              )}
            </Card.Body>
          </Card>
        </Col>
      </Row>

      {/* Portfolio Summary Section */}
      <Row className="mb-5">
        <Col md={12}>
          {renderPanelState(
            "portfolio",
            portfolioData && (
              <PortfolioSummary
                equity={portfolioData.equity}
                dividendsThisMonth={portfolioData.dividends_this_month}
                dividendsThisYear={portfolioData.dividends_this_year}
              />
            )
          )}
        </Col>
      </Row>
    </Container>
  );
}

export default App;
