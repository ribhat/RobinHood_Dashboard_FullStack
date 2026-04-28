import { useCallback, useEffect, useState } from "react";
import { Button, Card, Col, Container, Form, Row } from "react-bootstrap";
import HoldingsPieChart, { HoldingsTable } from "./Components/HoldingsPieChart";
import DividendChart from "./Components/DividendChart";
import PortfolioSummary from "./Components/PortfolioSummary";
import IncomeProjection from "./Components/IncomeProjection";
import IncomeCalendar from "./Components/IncomeCalendar";
import LoginPage from "./Components/LoginPage";
import { fetchJson, postJson } from "./api";
import "bootstrap/dist/css/bootstrap.min.css";
import "./App.css";

const createDashboardLoadingState = () => ({
  portfolio: true,
  holdings: true,
  dividends: true,
  incomeProjection: true,
  incomeCalendar: true,
  dividendComparison: false,
});

const createDashboardIdleState = () => ({
  portfolio: false,
  holdings: false,
  dividends: false,
  incomeProjection: false,
  incomeCalendar: false,
  dividendComparison: false,
});

function App() {
  const currentYear = new Date().getFullYear();
  const yearOptions = Array.from({ length: 6 }, (_, index) => currentYear - index);
  const [authStatus, setAuthStatus] = useState("checking");
  const [authError, setAuthError] = useState(null);
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
  const [loading, setLoading] = useState(createDashboardLoadingState);
  const [errors, setErrors] = useState({});

  const clearDashboardState = useCallback(() => {
    setPortfolioData(null);
    setHoldingsData(null);
    setYearlyDividendData(null);
    setLoadedDividendYear(null);
    setPreviousYearDividendData(null);
    setIncomeProjectionData(null);
    setIncomeCalendarData(null);
    setDashboardError(null);
    setErrors({});
  }, []);

  const handleUnauthenticatedError = useCallback((error) => {
    if (error.status !== 401) {
      return false;
    }

    setAuthStatus("unauthenticated");
    setAuthError(error.message);
    clearDashboardState();
    setInitialDashboardLoaded(false);
    setLoading(createDashboardIdleState());
    return true;
  }, [clearDashboardState]);

  useEffect(() => {
    let ignoreResponse = false;

    const fetchAuthStatus = async () => {
      try {
        const data = await fetchJson("/api/auth/status");

        if (ignoreResponse) {
          return;
        }

        if (data.authenticated) {
          setAuthStatus("authenticated");
          setAuthError(null);
          setLoading(createDashboardLoadingState());
        } else {
          setAuthStatus("unauthenticated");
          setAuthError(data.error || null);
          setLoading(createDashboardIdleState());
        }
      } catch (error) {
        if (!ignoreResponse) {
          setAuthStatus("unauthenticated");
          setAuthError(error.message);
          setLoading(createDashboardIdleState());
        }
      }
    };

    fetchAuthStatus();

    return () => {
      ignoreResponse = true;
    };
  }, []);

  useEffect(() => {
    if (authStatus !== "authenticated") {
      return undefined;
    }

    let ignoreResponse = false;
    let authFailed = false;

    const fetchDashboardSnapshot = async () => {
      setLoading(createDashboardLoadingState());
      setInitialDashboardLoaded(false);

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

        authFailed = handleUnauthenticatedError(error);
        if (authFailed) {
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
        if (!ignoreResponse && !authFailed) {
          setLoading(createDashboardIdleState());
          setInitialDashboardLoaded(true);
        }
      }
    };

    fetchDashboardSnapshot();

    return () => {
      ignoreResponse = true;
    };
  }, [authStatus, currentYear, handleUnauthenticatedError]);

  useEffect(() => {
    if (authStatus !== "authenticated" || !initialDashboardLoaded) {
      return undefined;
    }

    if (selectedYear === loadedDividendYear && yearlyDividendData) {
      return undefined;
    }

    let ignoreResponse = false;
    let authFailed = false;

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
          authFailed = handleUnauthenticatedError(error);
          if (authFailed) {
            return;
          }

          setYearlyDividendData(null);
          setErrors((currentErrors) => ({
            ...currentErrors,
            dividends: error.message,
          }));
        }
      } finally {
        if (!ignoreResponse && !authFailed) {
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
  }, [
    authStatus,
    handleUnauthenticatedError,
    initialDashboardLoaded,
    loadedDividendYear,
    selectedYear,
    yearlyDividendData,
  ]);

  useEffect(() => {
    if (authStatus !== "authenticated") {
      return undefined;
    }

    let ignoreResponse = false;
    let authFailed = false;

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
          authFailed = handleUnauthenticatedError(error);
          if (authFailed) {
            return;
          }

          setPreviousYearDividendData(null);
          setErrors((currentErrors) => ({
            ...currentErrors,
            dividendComparison: error.message,
          }));
        }
      } finally {
        if (!ignoreResponse && !authFailed) {
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
  }, [authStatus, comparePreviousYear, handleUnauthenticatedError, selectedYear]);

  const handleLogin = async (credentials) => {
    const data = await postJson("/api/auth/login", credentials);

    if (!data.authenticated) {
      throw new Error("Unable to start a Robinhood session.");
    }

    clearDashboardState();
    setInitialDashboardLoaded(false);
    setLoading(createDashboardLoadingState());
    setAuthError(null);
    setAuthStatus("authenticated");
  };

  const handleLogout = async () => {
    try {
      await postJson("/api/auth/logout");
      setAuthError(null);
    } catch (error) {
      setAuthError(error.message);
    } finally {
      clearDashboardState();
      setInitialDashboardLoaded(false);
      setLoading(createDashboardIdleState());
      setAuthStatus("unauthenticated");
    }
  };

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

  if (authStatus === "checking") {
    return (
      <Container fluid className="dashboard-container auth-check-container">
        <div className="auth-checking-state">
          <div className="loading-ring" aria-hidden="true" />
          <span>Checking Robinhood session...</span>
        </div>
      </Container>
    );
  }

  if (authStatus === "unauthenticated") {
    return <LoginPage error={authError} onLogin={handleLogin} />;
  }

  return (
    <Container fluid className="dashboard-container">
      <Row className="justify-content-center dashboard-header">
        <Col md={10}>
          <div className="dashboard-header-content">
            <div className="dashboard-title-block">
              <h1 className="dashboard-title">Dividend Dashboard</h1>
              <p className="dashboard-subtitle">Track your investments and dividend income</p>
            </div>
            <Button
              className="logout-button"
              onClick={handleLogout}
              size="sm"
              type="button"
              variant="outline-secondary"
            >
              Logout
            </Button>
          </div>
        </Col>
      </Row>

      {dashboardError && (
        <Row className="dashboard-status-row">
          <Col md={12}>
            <div
              className={`connection-banner ${
                dashboardError.status === 401 ? "auth-banner" : "error-banner"
              }`}
              role="status"
            >
              <strong>
                {dashboardError.status === 401
                  ? "Robinhood login required"
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

      <Row className="dashboard-holdings-row">
        <Col md={12}>
          <Card className="chart-card holdings-table-card">
            <Card.Body>
              <Card.Title className="chart-title">Holdings Details</Card.Title>
              {renderPanelState(
                "holdings",
                holdingsData && <HoldingsTable data={holdingsData} />
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
