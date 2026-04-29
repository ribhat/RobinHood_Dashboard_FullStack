import { useCallback, useEffect, useState } from "react";
import { Button, Card, Col, Container, Form, Row } from "react-bootstrap";
import HoldingsPieChart, { HoldingsTable } from "./Components/HoldingsPieChart";
import DividendChart from "./Components/DividendChart";
import PortfolioSummary from "./Components/PortfolioSummary";
import PortfolioOverview from "./Components/PortfolioOverview";
import IncomeProjection from "./Components/IncomeProjection";
import IncomeCalendar from "./Components/IncomeCalendar";
import LoginPage from "./Components/LoginPage";
import { fetchJson, postJson } from "./api";
import "bootstrap/dist/css/bootstrap.min.css";
import "./App.css";

const createDashboardLoadingState = () => ({
  portfolio: true,
  portfolioOverview: true,
  holdings: true,
  dividends: true,
  incomeProjection: true,
  incomeCalendar: true,
  dividendComparison: false,
});

const createDashboardIdleState = () => ({
  portfolio: false,
  portfolioOverview: false,
  holdings: false,
  dividends: false,
  incomeProjection: false,
  incomeCalendar: false,
  dividendComparison: false,
});

const DASHBOARD_PREFERENCES_KEY = "rh-dashboard:preferences";
const DASHBOARD_TABS = ["portfolio", "dividends"];
const CHART_TYPES = ["Bar Plot", "Scatter Plot", "Line Graph"];

const getStoredDashboardPreferences = (currentYear) => {
  const defaults = {
    activeTab: "portfolio",
    selectedYear: currentYear,
    chartType: "Bar Plot",
    comparePreviousYear: false,
  };

  try {
    const storedPreferences = JSON.parse(
      window.localStorage.getItem(DASHBOARD_PREFERENCES_KEY) || "{}"
    );
    const selectedYear = Number(storedPreferences.selectedYear);

    return {
      activeTab: DASHBOARD_TABS.includes(storedPreferences.activeTab)
        ? storedPreferences.activeTab
        : defaults.activeTab,
      selectedYear:
        Number.isInteger(selectedYear) &&
        selectedYear <= currentYear &&
        selectedYear >= currentYear - 5
          ? selectedYear
          : defaults.selectedYear,
      chartType: CHART_TYPES.includes(storedPreferences.chartType)
        ? storedPreferences.chartType
        : defaults.chartType,
      comparePreviousYear: Boolean(storedPreferences.comparePreviousYear),
    };
  } catch {
    return defaults;
  }
};

const formatGeneratedAt = (generatedAt) => {
  if (!generatedAt) {
    return "Not loaded yet";
  }

  const generatedDate = new Date(generatedAt);

  if (Number.isNaN(generatedDate.getTime())) {
    return "Recently updated";
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(generatedDate);
};

const getPanelEmptyStateMessage = (section) => {
  const messages = {
    portfolio: "Portfolio metrics will appear after the dashboard refresh completes.",
    portfolioOverview: "Portfolio health metrics are not available yet.",
    holdings: "No holdings were returned for the current Robinhood session.",
    dividends: "No dividend payments were found for the selected year.",
    incomeProjection: "Dividend projections need holdings and dividend history to model income.",
    incomeCalendar: "No received or estimated dividend payments are available yet.",
  };

  return messages[section] || "No dashboard data is available yet.";
};

const getSourceNotes = (dataSources) => {
  const sources = dataSources || {};
  const notes = [];

  if (sources.robinhood?.enabled) {
    notes.push("Robinhood portfolio, holdings, and dividend history");
  }

  if (sources.polygon?.enabled) {
    const usedTickers = sources.polygon.used_for_tickers || [];
    notes.push(
      usedTickers.length > 0
        ? `Polygon fallback used for ${usedTickers.join(", ")}`
        : "Polygon fallback ready"
    );
  } else {
    notes.push("Polygon fallback not configured");
  }

  return notes;
};

function App() {
  const currentYear = new Date().getFullYear();
  const yearOptions = Array.from({ length: 6 }, (_, index) => currentYear - index);
  const [initialPreferences] = useState(() =>
    getStoredDashboardPreferences(currentYear)
  );
  const [authStatus, setAuthStatus] = useState("checking");
  const [authError, setAuthError] = useState(null);
  const [authMfaRequired, setAuthMfaRequired] = useState(false);
  const [chartType, setChartType] = useState(initialPreferences.chartType);
  const [activeTab, setActiveTab] = useState(initialPreferences.activeTab);
  const [selectedYear, setSelectedYear] = useState(initialPreferences.selectedYear);
  const [comparePreviousYear, setComparePreviousYear] = useState(
    initialPreferences.comparePreviousYear
  );
  const [portfolioData, setPortfolioData] = useState(null);
  const [portfolioOverviewData, setPortfolioOverviewData] = useState(null);
  const [holdingsData, setHoldingsData] = useState(null);
  const [yearlyDividendData, setYearlyDividendData] = useState(null);
  const [loadedDividendYear, setLoadedDividendYear] = useState(null);
  const [previousYearDividendData, setPreviousYearDividendData] = useState(null);
  const [incomeProjectionData, setIncomeProjectionData] = useState(null);
  const [incomeCalendarData, setIncomeCalendarData] = useState(null);
  const [dashboardMetadata, setDashboardMetadata] = useState(null);
  const [dashboardError, setDashboardError] = useState(null);
  const [initialDashboardLoaded, setInitialDashboardLoaded] = useState(false);
  const [loading, setLoading] = useState(createDashboardLoadingState);
  const [errors, setErrors] = useState({});
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    window.localStorage.setItem(
      DASHBOARD_PREFERENCES_KEY,
      JSON.stringify({
        activeTab,
        selectedYear,
        chartType,
        comparePreviousYear,
      })
    );
  }, [activeTab, chartType, comparePreviousYear, selectedYear]);

  const applyDashboardSnapshot = useCallback((data) => {
    setPortfolioData(data.portfolio);
    setPortfolioOverviewData(data.portfolio_overview);
    setHoldingsData(data.holdings);
    setYearlyDividendData(data.yearly_dividends);
    setLoadedDividendYear(data.selected_year);
    setIncomeProjectionData(data.income_projection);
    setIncomeCalendarData(data.income_calendar);
    setDashboardMetadata({
      generatedAt: data.generated_at,
      warnings: data.warnings || [],
      dataSources: data.data_sources || {},
      partialDataAvailable: Boolean(data.partial_data_available),
    });
    setDashboardError(null);
    setErrors({});
  }, []);

  const clearDashboardState = useCallback(() => {
    setPortfolioData(null);
    setPortfolioOverviewData(null);
    setHoldingsData(null);
    setYearlyDividendData(null);
    setLoadedDividendYear(null);
    setPreviousYearDividendData(null);
    setIncomeProjectionData(null);
    setIncomeCalendarData(null);
    setDashboardMetadata(null);
    setDashboardError(null);
    setErrors({});
  }, []);

  const handleUnauthenticatedError = useCallback((error) => {
    if (error.status !== 401) {
      return false;
    }

    setAuthStatus("unauthenticated");
    setAuthError(error.message);
    setAuthMfaRequired(Boolean(error.mfaRequired));
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
          setAuthMfaRequired(false);
          setLoading(createDashboardLoadingState());
        } else {
          setAuthStatus("unauthenticated");
          setAuthError(data.error || null);
          setAuthMfaRequired(Boolean(data.mfa_required));
          setLoading(createDashboardIdleState());
        }
      } catch (error) {
        if (!ignoreResponse) {
          setAuthStatus("unauthenticated");
          setAuthError(error.message);
          setAuthMfaRequired(false);
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

        applyDashboardSnapshot(data);
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
        setPortfolioOverviewData(null);
        setHoldingsData(null);
        setYearlyDividendData(null);
        setLoadedDividendYear(null);
        setIncomeProjectionData(null);
        setIncomeCalendarData(null);
        setErrors({
          portfolio: error.message,
          portfolioOverview: error.message,
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
  }, [
    applyDashboardSnapshot,
    authStatus,
    currentYear,
    handleUnauthenticatedError,
    refreshKey,
  ]);

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
    setAuthMfaRequired(false);

    const checkPendingLoginStatus = async () => {
      try {
        const status = await fetchJson("/api/auth/status");
        if (status.mfa_required) {
          setAuthMfaRequired(true);
        }
      } catch {
        // Keep the login attempt focused on its own result.
      }
    };

    const loginStatusInterval = window.setInterval(checkPendingLoginStatus, 1500);

    let data;
    try {
      data = await postJson("/api/auth/login", credentials);
    } catch (error) {
      setAuthMfaRequired(Boolean(error.mfaRequired));
      throw error;
    } finally {
      window.clearInterval(loginStatusInterval);
    }

    if (!data.authenticated) {
      setAuthMfaRequired(Boolean(data.mfa_required));
      throw new Error("Unable to start a Robinhood session.");
    }

    clearDashboardState();
    setInitialDashboardLoaded(false);
    setLoading(createDashboardLoadingState());
    setAuthError(null);
    setAuthMfaRequired(false);
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
      setAuthMfaRequired(false);
      setAuthStatus("unauthenticated");
    }
  };

  const handleRefreshDashboard = () => {
    setLoadedDividendYear(null);
    setPreviousYearDividendData(null);
    setRefreshKey((currentKey) => currentKey + 1);
  };

  const handleYearChange = (event) => {
    setSelectedYear(Number(event.target.value));
  };

  const renderLoadingState = (section) => {
    if (section === "portfolio" || section === "portfolioOverview") {
      return (
        <div className="summary-placeholder-grid">
          <div className="summary-placeholder-card">
            <span className="placeholder-label">Portfolio Value</span>
            <span className="placeholder-line" />
          </div>
          <div className="summary-placeholder-card">
            <span className="placeholder-label">
              {section === "portfolioOverview" ? "Unrealized Gain/Loss" : "Dividends This Month"}
            </span>
            <span className="placeholder-line" />
          </div>
          <div className="summary-placeholder-card">
            <span className="placeholder-label">
              {section === "portfolioOverview" ? "Estimated Dividend Yield" : "Dividends This Year"}
            </span>
            <span className="placeholder-line" />
          </div>
          {section === "portfolioOverview" && (
            <div className="summary-placeholder-card">
              <span className="placeholder-label">Largest Position</span>
              <span className="placeholder-line" />
            </div>
          )}
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

    if (!children) {
      return (
        <div className="panel-state empty-state">
          {getPanelEmptyStateMessage(section)}
        </div>
      );
    }

    return children;
  };

  const isDashboardBusy = Object.values(loading).some(Boolean);
  const dashboardWarnings = dashboardMetadata?.warnings || [];
  const sourceNotes = dashboardMetadata
    ? getSourceNotes(dashboardMetadata.dataSources)
    : ["Waiting for dashboard data"];
  const dashboardDataStatus = !dashboardMetadata
    ? "Loading"
    : dashboardMetadata.partialDataAvailable
    ? "Partial data"
    : "Ready";

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
    return (
      <LoginPage
        error={authError}
        mfaRequired={authMfaRequired}
        onLogin={handleLogin}
      />
    );
  }

  return (
    <Container fluid className="dashboard-container">
      <Row className="justify-content-center dashboard-header">
        <Col md={12}>
          <div className="dashboard-header-content">
            <div className="dashboard-title-block">
              <h1 className="dashboard-title">Portfolio Dashboard</h1>
              <p className="dashboard-subtitle">
                Track allocation, performance, and dividend income
              </p>
            </div>
            <div className="dashboard-header-actions">
              <Button
                className="refresh-button"
                disabled={isDashboardBusy}
                onClick={handleRefreshDashboard}
                size="sm"
                type="button"
                variant="primary"
              >
                {isDashboardBusy ? "Refreshing" : "Refresh"}
              </Button>
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
          </div>
        </Col>
      </Row>

      <Row className="dashboard-status-row">
        <Col md={12}>
          <div className="dashboard-status-strip" aria-label="Dashboard status">
            <div className="dashboard-status-item">
              <span className="metric-kicker">Session</span>
              <strong>Robinhood connected</strong>
            </div>
            <div className="dashboard-status-item">
              <span className="metric-kicker">Last Updated</span>
              <strong>{formatGeneratedAt(dashboardMetadata?.generatedAt)}</strong>
            </div>
            <div className="dashboard-status-item">
              <span className="metric-kicker">Data Status</span>
              <strong>{dashboardDataStatus}</strong>
            </div>
            <div className="dashboard-status-item dashboard-source-item">
              <span className="metric-kicker">Sources</span>
              <strong>{sourceNotes.join(" / ")}</strong>
            </div>
          </div>
        </Col>
      </Row>

      <Row className="dashboard-tabs-row">
        <Col md={12}>
          <div className="dashboard-tabs" role="tablist" aria-label="Dashboard views">
            <button
              aria-controls="portfolio-panel"
              aria-selected={activeTab === "portfolio"}
              className={`dashboard-tab ${activeTab === "portfolio" ? "active" : ""}`}
              id="portfolio-tab"
              onClick={() => setActiveTab("portfolio")}
              role="tab"
              type="button"
            >
              Portfolio
            </button>
            <button
              aria-controls="dividends-panel"
              aria-selected={activeTab === "dividends"}
              className={`dashboard-tab ${activeTab === "dividends" ? "active" : ""}`}
              id="dividends-tab"
              onClick={() => setActiveTab("dividends")}
              role="tab"
              type="button"
            >
              Dividends
            </button>
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

      {dashboardWarnings.length > 0 && (
        <Row className="dashboard-status-row">
          <Col md={12}>
            <div className="connection-banner warning-banner" role="status">
              <strong>Data notes</strong>
              <ul className="dashboard-warning-list">
                {dashboardWarnings.map((warning) => (
                  <li key={`${warning.code}-${warning.message}`}>
                    {warning.message}
                  </li>
                ))}
              </ul>
            </div>
          </Col>
        </Row>
      )}

      <section
        aria-labelledby="portfolio-tab"
        className="dashboard-tab-panel"
        hidden={activeTab !== "portfolio"}
        id="portfolio-panel"
        role="tabpanel"
      >
        <Row className="dashboard-overview-row">
          <Col md={12}>
            {renderPanelState(
              "portfolioOverview",
              portfolioOverviewData && <PortfolioOverview data={portfolioOverviewData} />
            )}
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
            <Card className="h-100 chart-card holdings-table-card">
              <Card.Body>
                <Card.Title className="chart-title">Holdings Details</Card.Title>
                {renderPanelState(
                  "holdings",
                  holdingsData && <HoldingsTable data={holdingsData} showPerformance />
                )}
              </Card.Body>
            </Card>
          </Col>
        </Row>
      </section>

      <section
        aria-labelledby="dividends-tab"
        className="dashboard-tab-panel"
        hidden={activeTab !== "dividends"}
        id="dividends-panel"
        role="tabpanel"
      >
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

        <Row className="dashboard-main-row">
          <Col md={12} className="mb-4">
            <Card className="chart-card">
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
      </section>
    </Container>
  );
}

export default App;
