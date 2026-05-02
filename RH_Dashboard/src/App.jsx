import { useCallback, useEffect, useMemo, useState } from "react";
import { Form } from "react-bootstrap";
import {
  Building2,
  CalendarDays,
  CircleDollarSign,
  Landmark,
  TrendingUp,
  WalletCards,
} from "lucide-react";
import HoldingsPieChart, { HoldingsTable } from "./Components/HoldingsPieChart";
import DividendChart from "./Components/DividendChart";
import PortfolioSummary from "./Components/PortfolioSummary";
import PortfolioOverview from "./Components/PortfolioOverview";
import IncomeProjection from "./Components/IncomeProjection";
import IncomeCalendar from "./Components/IncomeCalendar";
import LoginPage from "./Components/LoginPage";
import AppShell from "./Components/Shell/AppShell";
import MetricCard from "./Components/Shell/MetricCard";
import StatusCards from "./Components/Shell/StatusCards";
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
const DASHBOARD_VIEWS = ["overview", "portfolio", "dividends", "holdings", "analytics"];
const CHART_TYPES = ["Bar Plot", "Scatter Plot", "Line Graph"];
const PAGE_COPY = {
  overview: {
    title: "Portfolio Dashboard",
    subtitle: "Track allocation, performance, and dividend income",
  },
  portfolio: {
    title: "Portfolio",
    subtitle: "Monitor holdings, allocation, and performance",
  },
  dividends: {
    title: "Dividends",
    subtitle: "Track dividend income, trends, and performance",
  },
  holdings: {
    title: "Holdings",
    subtitle: "Review individual positions, weights, and cost basis",
  },
  analytics: {
    title: "Dividend Income Outlook",
    subtitle: "Forecast dividend payments and compare yearly income",
  },
};

const getStoredDashboardPreferences = (currentYear) => {
  const defaults = {
    activeView: "overview",
    selectedYear: currentYear,
    chartType: "Bar Plot",
    comparePreviousYear: false,
  };

  try {
    const storedPreferences = JSON.parse(
      window.localStorage.getItem(DASHBOARD_PREFERENCES_KEY) || "{}"
    );
    const selectedYear = Number(storedPreferences.selectedYear);
    const storedView = storedPreferences.activeView || storedPreferences.activeTab;

    return {
      activeView: DASHBOARD_VIEWS.includes(storedView)
        ? storedView
        : defaults.activeView,
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

const hasValue = (value) => value !== null && value !== undefined;

const formatCurrency = (value) =>
  hasValue(value) ? `$${Number(value).toFixed(2)}` : "Unavailable";

const formatSignedCurrency = (value) => {
  if (!hasValue(value)) {
    return "Unavailable";
  }

  const amount = Number(value);
  const prefix = amount > 0 ? "+" : amount < 0 ? "-" : "";
  return `${prefix}$${Math.abs(amount).toFixed(2)}`;
};

const formatPercent = (value) =>
  hasValue(value) ? `${Number(value).toFixed(2)}%` : "Unavailable";

const getToneClass = (value) => {
  if (!hasValue(value) || Number(value) === 0) {
    return "";
  }

  return Number(value) > 0 ? "positive-metric" : "negative-metric";
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

const filterHoldingsBySearch = (holdings, searchQuery) => {
  const query = searchQuery.trim().toLowerCase();

  if (!query || !holdings) {
    return holdings;
  }

  return Object.fromEntries(
    Object.entries(holdings).filter(([ticker, details]) => {
      const name = details?.name || "";
      return (
        ticker.toLowerCase().includes(query) ||
        name.toLowerCase().includes(query)
      );
    })
  );
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
  const [activeView, setActiveView] = useState(initialPreferences.activeView);
  const [selectedYear, setSelectedYear] = useState(initialPreferences.selectedYear);
  const [comparePreviousYear, setComparePreviousYear] = useState(
    initialPreferences.comparePreviousYear
  );
  const [holdingsSearch, setHoldingsSearch] = useState("");
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
        activeView,
        selectedYear,
        chartType,
        comparePreviousYear,
      })
    );
  }, [activeView, chartType, comparePreviousYear, selectedYear]);

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

  const filteredHoldingsData = useMemo(
    () => filterHoldingsBySearch(holdingsData, holdingsSearch),
    [holdingsData, holdingsSearch]
  );

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
    setActiveView("overview");
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
  const generatedAt = formatGeneratedAt(dashboardMetadata?.generatedAt);

  const renderStatusCards = () => (
    <StatusCards
      generatedAt={generatedAt}
      dataStatus={dashboardDataStatus}
      sourceNotes={sourceNotes}
    />
  );

  const renderDashboardError = () =>
    dashboardError && (
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
    );

  const renderWarnings = () =>
    dashboardWarnings.length > 0 && (
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
    );

  const renderPortfolioMetrics = () =>
    portfolioOverviewData && (
      <div className="portfolio-metric-grid">
        <MetricCard
          icon={CircleDollarSign}
          label="Portfolio Value"
          value={formatCurrency(portfolioOverviewData.total_equity)}
          tone="green"
          footnote={`${portfolioOverviewData.position_count || 0} positions`}
        />
        <MetricCard
          icon={TrendingUp}
          label="Unrealized Gain / Loss"
          value={formatSignedCurrency(portfolioOverviewData.unrealized_gain_loss)}
          tone="red"
          trend={{
            className: getToneClass(portfolioOverviewData.unrealized_return_percent),
            text: formatPercent(portfolioOverviewData.unrealized_return_percent),
          }}
          footnote="Total return"
        />
        <MetricCard
          icon={WalletCards}
          label="Estimated Annual Dividends"
          value={formatCurrency(portfolioOverviewData.estimated_annual_dividend_income)}
          tone="orange"
          footnote={`${formatPercent(portfolioOverviewData.estimated_dividend_yield_percent)} dividend yield`}
        />
        <MetricCard
          icon={Building2}
          label="Largest Position"
          value={portfolioOverviewData.largest_position?.ticker || "None"}
          tone="blue"
          footnote={`${formatPercent(portfolioOverviewData.largest_position_weight_percent)} of portfolio`}
        />
      </div>
    );

  const renderAllocationPanel = () => (
    <section className="vault-panel">
      <div className="vault-panel-header">
        <h2>Portfolio Allocation</h2>
      </div>
      {renderPanelState(
        "holdings",
        holdingsData && <HoldingsPieChart data={holdingsData} />
      )}
    </section>
  );

  const renderHoldingsTablePanel = ({ searchable = false } = {}) => (
    <section className="vault-panel holdings-table-panel">
      <div className="vault-panel-header vault-toolbar">
        <h2>Holdings Details</h2>
        {searchable && (
          <input
            aria-label="Search holdings"
            className="vault-search-input"
            onChange={(event) => setHoldingsSearch(event.target.value)}
            placeholder="Search by ticker or company"
            type="search"
            value={holdingsSearch}
          />
        )}
      </div>
      {renderPanelState(
        "holdings",
        (searchable ? filteredHoldingsData : holdingsData) && (
          <HoldingsTable
            data={searchable ? filteredHoldingsData : holdingsData}
            searchQuery={searchable ? holdingsSearch : ""}
            showPerformance
          />
        )
      )}
    </section>
  );

  const renderOverviewView = () => (
    <div className="dashboard-view overview-view">
      {renderStatusCards()}
      {renderDashboardError()}
      {renderPanelState(
        "portfolioOverview",
        portfolioOverviewData && <PortfolioOverview data={portfolioOverviewData} />
      )}
      {renderWarnings()}
      {renderAllocationPanel()}
    </div>
  );

  const renderPortfolioView = () => (
    <div className="dashboard-view portfolio-view">
      {renderStatusCards()}
      {renderDashboardError()}
      {renderPanelState("portfolioOverview", renderPortfolioMetrics())}
      <div className="dashboard-page-grid two-column-grid">
        {renderAllocationPanel()}
        {renderPanelState(
          "portfolioOverview",
          portfolioOverviewData && <PortfolioOverview data={portfolioOverviewData} />
        )}
      </div>
      {renderWarnings()}
      {renderHoldingsTablePanel()}
    </div>
  );

  const renderDividendsView = () => (
    <div className="dashboard-view dividends-view">
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

      <section className="vault-panel">
        <div className="vault-panel-header dividend-panel-header">
          <h2>Dividend Performance</h2>
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
              label="Compare Previous Year"
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
      </section>
    </div>
  );

  const renderHoldingsView = () => (
    <div className="dashboard-view holdings-view">
      {renderStatusCards()}
      {renderDashboardError()}
      {renderPanelState(
        "portfolioOverview",
        portfolioOverviewData && <PortfolioOverview data={portfolioOverviewData} />
      )}
      {renderWarnings()}
      {renderHoldingsTablePanel({ searchable: true })}
    </div>
  );

  const renderAnalyticsView = () => (
    <div className="dashboard-view analytics-view">
      {renderStatusCards()}
      <div className="analytics-payment-cards">
        <MetricCard
          icon={CalendarDays}
          label="Next Expected Payment"
          value="Modeled in calendar"
          tone="green"
          footnote="Received and estimated"
        />
        <MetricCard
          icon={WalletCards}
          label="Current Month Income"
          value="See income calendar"
          tone="blue"
          footnote="Live from dividend model"
        />
        <MetricCard
          icon={Landmark}
          label="Remaining Estimated Annual Income"
          value="See projection"
          tone="orange"
          footnote="Based on current holdings"
        />
      </div>
      {renderPanelState(
        "incomeCalendar",
        incomeCalendarData && <IncomeCalendar data={incomeCalendarData} />
      )}
      {renderPanelState(
        "incomeProjection",
        incomeProjectionData && <IncomeProjection data={incomeProjectionData} />
      )}
    </div>
  );

  const renderDashboardView = () => {
    const viewRenderers = {
      overview: renderOverviewView,
      portfolio: renderPortfolioView,
      dividends: renderDividendsView,
      holdings: renderHoldingsView,
      analytics: renderAnalyticsView,
    };

    return (viewRenderers[activeView] || renderOverviewView)();
  };

  if (authStatus === "checking") {
    return (
      <main className="dashboard-container auth-check-container">
        <div className="auth-checking-state">
          <div className="loading-ring" aria-hidden="true" />
          <span>Checking Robinhood session...</span>
        </div>
      </main>
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

  const pageCopy = PAGE_COPY[activeView] || PAGE_COPY.overview;

  return (
    <AppShell
      activeView={activeView}
      isBusy={isDashboardBusy}
      onLogout={handleLogout}
      onNavigate={setActiveView}
      onRefresh={handleRefreshDashboard}
      pageSubtitle={pageCopy.subtitle}
      pageTitle={pageCopy.title}
    >
      {renderDashboardView()}
    </AppShell>
  );
}

export default App;
