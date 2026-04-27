import { useState, useEffect } from "react";
import { Container, Row, Col, Card, Form } from "react-bootstrap";
import HoldingsPieChart from "./Components/HoldingsPieChart";
import DividendChart from "./Components/DividendChart";
import PortfolioSummary from "./Components/PortfolioSummary";
import IncomeProjection from "./Components/IncomeProjection";
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
  const [previousYearDividendData, setPreviousYearDividendData] = useState(null);
  const [incomeProjectionData, setIncomeProjectionData] = useState(null);
  const [loading, setLoading] = useState({
    portfolio: true,
    holdings: true,
    dividends: true,
    incomeProjection: true,
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

    fetchSection("portfolio", "/api/portfolio", setPortfolioData);
    fetchSection("holdings", "/api/holdings", setHoldingsData);
  }, []);

  useEffect(() => {
    let ignoreResponse = false;

    const fetchIncomeProjection = async () => {
      setLoading((currentLoading) => ({
        ...currentLoading,
        incomeProjection: true,
      }));
      setErrors((currentErrors) => {
        const nextErrors = { ...currentErrors };
        delete nextErrors.incomeProjection;
        return nextErrors;
      });

      try {
        const [currentYearData, baselineYearData] = await Promise.all([
          fetchJson(`/api/dividends/yearly/${currentYear}`),
          fetchJson(`/api/dividends/yearly/${currentYear - 1}`),
        ]);

        if (!ignoreResponse) {
          setIncomeProjectionData({
            currentYear,
            currentYearTotal: currentYearData.total,
            baselineYear: currentYear - 1,
            baselineTotal: baselineYearData.total,
          });
        }
      } catch (error) {
        if (!ignoreResponse) {
          setIncomeProjectionData(null);
          setErrors((currentErrors) => ({
            ...currentErrors,
            incomeProjection: error.message,
          }));
        }
      } finally {
        if (!ignoreResponse) {
          setLoading((currentLoading) => ({
            ...currentLoading,
            incomeProjection: false,
          }));
        }
      }
    };

    fetchIncomeProjection();

    return () => {
      ignoreResponse = true;
    };
  }, [currentYear]);

  useEffect(() => {
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
  }, [selectedYear]);

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

      <Row className="dashboard-projection-row">
        <Col md={12}>
          {renderPanelState(
            "incomeProjection",
            incomeProjectionData && (
              <IncomeProjection
                currentYear={incomeProjectionData.currentYear}
                currentYearTotal={incomeProjectionData.currentYearTotal}
                baselineYear={incomeProjectionData.baselineYear}
                baselineTotal={incomeProjectionData.baselineTotal}
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
