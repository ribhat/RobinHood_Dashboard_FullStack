import { useState, useEffect } from "react";
import { Container, Row, Col, Card, Form } from "react-bootstrap";
import HoldingsPieChart from "./Components/HoldingsPieChart";
import DividendChart from "./Components/DividendChart";
import PortfolioSummary from "./Components/PortfolioSummary";
import IncomeProjection from "./Components/IncomeProjection";
import IncomeCalendar from "./Components/IncomeCalendar";
import { fetchJson } from "./api";
import "bootstrap/dist/css/bootstrap.min.css";
import "./App.css"; // We'll create this for custom styles

function App() {
  const currentYear = new Date().getFullYear();
  const yearOptions = Array.from({ length: 6 }, (_, index) => currentYear - index);
  const [chartType, setChartType] = useState("Bar Plot");
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [comparePreviousYear, setComparePreviousYear] = useState(false);
  const [portfolioData, setPortfolioData] = useState(null);
  const [holdingsData, setHoldingsData] = useState(null);
  const [yearlyDividendData, setYearlyDividendData] = useState(null);
  const [loadedDividendYear, setLoadedDividendYear] = useState(null);
  const [previousYearDividendData, setPreviousYearDividendData] = useState(null);
  const [incomeProjectionData, setIncomeProjectionData] = useState(null);
  const [incomeCalendarData, setIncomeCalendarData] = useState(null);
  const [dashboardError, setDashboardError] = useState(null);
  const [initialDashboardLoaded, setInitialDashboardLoaded] = useState(false);
  const [loading, setLoading] = useState({
    portfolio: true,
    holdings: true,
    dividends: true,
    incomeProjection: true,
    incomeCalendar: true,
  });
  const [errors, setErrors] = useState({});

  useEffect(() => {
    let ignoreResponse = false;

    const fetchDashboardSnapshot = async () => {
      try {
        const data = await fetchJson(`/api/dashboard?year=${currentYear}`);

        if (ignoreResponse) {
          return;
        }

        setPortfolioData(data.portfolio);
        setHoldingsData(data.holdings);
        setYearlyDividendData(data.yearly_dividends);
        setLoadedDividendYear(data.selected_year);
        setIncomeProjectionData(data.income_projection);
        setIncomeCalendarData(data.income_calendar);
        setDashboardError(null);
        setErrors({});
      } catch (error) {
        if (ignoreResponse) {
          return;
        }

        setDashboardError({
          message: error.message,
          status: error.status,
        });
        setPortfolioData(null);
        setHoldingsData(null);
        setYearlyDividendData(null);
        setLoadedDividendYear(null);
        setIncomeProjectionData(null);
        setIncomeCalendarData(null);
        setErrors({
          portfolio: error.message,
          holdings: error.message,
          dividends: error.message,
          incomeProjection: error.message,
          incomeCalendar: error.message,
        });
      } finally {
        if (!ignoreResponse) {
          setLoading({
            portfolio: false,
            holdings: false,
            dividends: false,
            incomeProjection: false,
            incomeCalendar: false,
            dividendComparison: false,
          });
          setInitialDashboardLoaded(true);
        }
      }
    };

    fetchDashboardSnapshot();

    return () => {
      ignoreResponse = true;
    };
  }, [currentYear]);

  useEffect(() => {
    if (!initialDashboardLoaded) {
      return undefined;
    }

    if (selectedYear === loadedDividendYear && yearlyDividendData) {
      return undefined;
    }

    let ignoreResponse = false;

    const fetchDividendYear = async () => {
      setLoading((currentLoading) => ({
        ...currentLoading,
        dividends: true,
      }));
      setErrors((currentErrors) => {
        const nextErrors = { ...currentErrors };
        delete nextErrors.dividends;
        return nextErrors;
      });

      try {
        const data = await fetchJson(`/api/dividends/yearly/${selectedYear}`);

        if (!ignoreResponse) {
          setYearlyDividendData(data);
          setLoadedDividendYear(selectedYear);
        }
      } catch (error) {
        if (!ignoreResponse) {
          setYearlyDividendData(null);
          setErrors((currentErrors) => ({
            ...currentErrors,
            dividends: error.message,
          }));
        }
      } finally {
        if (!ignoreResponse) {
          setLoading((currentLoading) => ({
            ...currentLoading,
            dividends: false,
          }));
        }
      }
    };

    fetchDividendYear();

    return () => {
      ignoreResponse = true;
    };
  }, [initialDashboardLoaded, loadedDividendYear, selectedYear, yearlyDividendData]);

  useEffect(() => {
    let ignoreResponse = false;

    const fetchComparisonYear = async () => {
      if (!comparePreviousYear) {
        setPreviousYearDividendData(null);
        setLoading((currentLoading) => ({
          ...currentLoading,
          dividendComparison: false,
        }));
        setErrors((currentErrors) => {
          const nextErrors = { ...currentErrors };
          delete nextErrors.dividendComparison;
          return nextErrors;
        });
        return;
      }

      setLoading((currentLoading) => ({
        ...currentLoading,
        dividendComparison: true,
      }));
      setErrors((currentErrors) => {
        const nextErrors = { ...currentErrors };
        delete nextErrors.dividendComparison;
        return nextErrors;
      });

      try {
        const data = await fetchJson(`/api/dividends/yearly/${selectedYear - 1}`);

        if (!ignoreResponse) {
          setPreviousYearDividendData(data);
        }
      } catch (error) {
        if (!ignoreResponse) {
          setPreviousYearDividendData(null);
          setErrors((currentErrors) => ({
            ...currentErrors,
            dividendComparison: error.message,
          }));
        }
      } finally {
        if (!ignoreResponse) {
          setLoading((currentLoading) => ({
            ...currentLoading,
            dividendComparison: false,
          }));
        }
      }
    };

    fetchComparisonYear();

    return () => {
      ignoreResponse = true;
    };
  }, [comparePreviousYear, selectedYear]);

  const handleYearChange = (event) => {
    setSelectedYear(Number(event.target.value));
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
      <Row className="justify-content-center dashboard-header">
        <Col md={10} className="text-center">
          <h1 className="dashboard-title">Dividend Dashboard</h1>
          <p className="dashboard-subtitle">Track your investments and dividend income</p>
        </Col>
      </Row>

      {dashboardError && (
        <Row className="dashboard-status-row">
          <Col md={12}>
            <div
              className={`connection-banner ${
                dashboardError.status === 503 ? "auth-banner" : "error-banner"
              }`}
              role="status"
            >
              <strong>
                {dashboardError.status === 503
                  ? "Robinhood connection unavailable"
                  : "Dashboard data unavailable"}
              </strong>
              <span>{dashboardError.message}</span>
            </div>
          </Col>
        </Row>
      )}

      <Row className="dashboard-main-row">
        <Col lg={5} className="mb-4">
          <Card className="h-100 chart-card">
            <Card.Body>
              <Card.Title className="chart-title">Portfolio Allocation</Card.Title>
              {renderPanelState(
                "holdings",
                holdingsData && <HoldingsPieChart data={holdingsData} />
              )}
            </Card.Body>
          </Card>
        </Col>

        <Col lg={7} className="mb-4">
          <Card className="h-100 chart-card">
            <Card.Body>
              <div className="chart-card-header">
                <Card.Title className="chart-title mb-0">Dividend Performance</Card.Title>
                <div className="dividend-controls">
                  <Form.Select
                    aria-label="Dividend year"
                    className="year-select"
                    size="sm"
                    value={selectedYear}
                    onChange={handleYearChange}
                  >
                    {yearOptions.map((year) => (
                      <option key={year} value={year}>
                        {year}
                      </option>
                    ))}
                  </Form.Select>
                  <Form.Select
                    aria-label="Dividend chart type"
                    className="chart-type-select"
                    size="sm"
                    value={chartType}
                    onChange={(event) => setChartType(event.target.value)}
                  >
                    <option value="Bar Plot">Bar Plot</option>
                    <option value="Scatter Plot">Scatter Plot</option>
                    <option value="Line Graph">Line Graph</option>
                  </Form.Select>
                  <Form.Check
                    type="switch"
                    id="compare-year-switch"
                    label={`Compare ${selectedYear - 1}`}
                    checked={comparePreviousYear}
                    onChange={() => setComparePreviousYear((currentValue) => !currentValue)}
                  />
                </div>
              </div>
              {errors.dividendComparison && !loading.dividendComparison && (
                <div className="comparison-error">{errors.dividendComparison}</div>
              )}
              {renderPanelState(
                "dividends",
                yearlyDividendData && (
                  <DividendChart
                    data={yearlyDividendData}
                    comparisonData={previousYearDividendData}
                    chartType={chartType}
                    selectedYear={selectedYear}
                    comparePreviousYear={comparePreviousYear}
                    isComparisonLoading={loading.dividendComparison}
                  />
                )
              )}
            </Card.Body>
          </Card>
        </Col>
      </Row>

      <Row className="dashboard-calendar-row">
        <Col md={12}>
          {renderPanelState(
            "incomeCalendar",
            incomeCalendarData && (
              <IncomeCalendar
                data={incomeCalendarData}
              />
            )
          )}
        </Col>
      </Row>

      <Row className="dashboard-projection-row">
        <Col md={12}>
          {renderPanelState(
            "incomeProjection",
            incomeProjectionData && (
              <IncomeProjection
                data={incomeProjectionData}
              />
            )
          )}
        </Col>
      </Row>

      <Row className="dashboard-summary-row">
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
