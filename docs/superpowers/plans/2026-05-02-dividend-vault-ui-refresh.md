# Dividend Vault UI Refresh Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the Dividend Vault shell, authenticated dashboard views, holdings search, and redesigned login page from the approved design spec.

**Architecture:** Keep data loading and auth state in `RH_Dashboard/src/App.jsx`, but move visual shell primitives into focused components under `RH_Dashboard/src/Components/Shell/`. Existing domain components continue rendering charts, calendars, projection data, and holdings details, with small prop additions for search and view-specific layout.

**Tech Stack:** React 19, Vite, React Bootstrap, Recharts, Vitest, Testing Library, and `lucide-react` for icons.

---

## File Structure

- Create `RH_Dashboard/src/Components/Shell/BrandMark.jsx`: reusable CSS logo plus wordmark.
- Create `RH_Dashboard/src/Components/Shell/AppShell.jsx`: layout wrapper for sidebar, top header, mobile nav, and main content.
- Create `RH_Dashboard/src/Components/Shell/MetricCard.jsx`: reusable metric/status card.
- Create `RH_Dashboard/src/Components/Shell/StatusCards.jsx`: session, last updated, data status, and source cards.
- Modify `RH_Dashboard/src/App.jsx`: replace tab UI with shell view state and page render helpers.
- Modify `RH_Dashboard/src/Components/HoldingsPieChart.jsx`: add holdings table search query support and cleaner sort labels.
- Modify `RH_Dashboard/src/Components/LoginPage.jsx`: implement split-screen Dividend Vault login while preserving current form behavior.
- Modify `RH_Dashboard/src/App.css`: replace old dashboard visual styling with shell, page, table, chart, and login styling.
- Modify `RH_Dashboard/src/index.css`: reset global button/link defaults so shell styling is predictable.
- Modify `RH_Dashboard/src/App.test.jsx`: cover shell landing view, navigation, disabled nav, and preference persistence.
- Modify `RH_Dashboard/src/LoginPage.test.jsx`: keep login/MFA behavior coverage under the redesigned UI.
- Modify `RH_Dashboard/package.json` and `RH_Dashboard/package-lock.json`: add `lucide-react`.

## Task 1: Add Dependency And Behavioral Tests

**Files:**
- Modify: `RH_Dashboard/package.json`
- Modify: `RH_Dashboard/src/App.test.jsx`
- Modify: `RH_Dashboard/src/LoginPage.test.jsx`

- [ ] **Step 1: Add `lucide-react` dependency**

Run:

```powershell
cd RH_Dashboard
npm install lucide-react
```

Expected: `package.json` and `package-lock.json` update with `lucide-react`.

- [ ] **Step 2: Replace App shell tests with expected new behavior**

Update `RH_Dashboard/src/App.test.jsx` so the mocked authenticated dashboard verifies:

```jsx
expect(await screen.findByRole("heading", { name: "Portfolio Dashboard" })).toBeInTheDocument();
expect(screen.getByRole("button", { name: "Overview" })).toHaveAttribute("aria-current", "page");
await user.click(screen.getByRole("button", { name: "Dividends" }));
expect(screen.getByRole("heading", { name: "Dividends" })).toBeInTheDocument();
await user.click(screen.getByRole("button", { name: "Reports" }));
expect(screen.getByRole("button", { name: "Reports" })).toBeDisabled();
```

Also keep the preference assertion for dividend chart type and compare toggle after navigating to `Dividends`.

- [ ] **Step 3: Add holdings search expectation**

In the App test dashboard fixture, add a second holding such as `MSFT`. After navigating to `Holdings`, search for `schwab` and assert the holdings table mock receives filtered data or the rendered table shows only `SCHD`.

Expected test intent:

```jsx
await user.click(screen.getByRole("button", { name: "Holdings" }));
await user.type(screen.getByLabelText("Search holdings"), "schwab");
expect(screen.getByTestId("holdings-table")).toHaveTextContent("SCHD");
expect(screen.getByTestId("holdings-table")).not.toHaveTextContent("MSFT");
```

- [ ] **Step 4: Preserve login behavior tests with new labels**

Keep the existing login assertions but update labels to the redesigned copy:

```jsx
await user.type(screen.getByLabelText(/email or username/i), "user@example.com");
await user.type(screen.getByLabelText(/password/i), "secret-password");
await user.click(screen.getByRole("button", { name: /sign in/i }));
```

- [ ] **Step 5: Run tests and confirm failures**

Run:

```powershell
cd RH_Dashboard
npm test -- App.test.jsx LoginPage.test.jsx
```

Expected: tests fail because shell components, login redesign labels, and holdings search are not implemented yet.

## Task 2: Build Shell Components

**Files:**
- Create: `RH_Dashboard/src/Components/Shell/BrandMark.jsx`
- Create: `RH_Dashboard/src/Components/Shell/MetricCard.jsx`
- Create: `RH_Dashboard/src/Components/Shell/StatusCards.jsx`
- Create: `RH_Dashboard/src/Components/Shell/AppShell.jsx`

- [ ] **Step 1: Create `BrandMark.jsx`**

Implement a CSS-driven logo:

```jsx
const BrandMark = ({ compact = false }) => (
  <div className={`brand-mark ${compact ? "brand-mark-compact" : ""}`}>
    <span className="brand-bars" aria-hidden="true">
      <span />
      <span />
      <span />
    </span>
    {!compact && (
      <span className="brand-copy">
        <strong>Dividend Vault</strong>
        <span>Invest With Income</span>
      </span>
    )}
  </div>
);

export default BrandMark;
```

- [ ] **Step 2: Create `MetricCard.jsx`**

Implement a card that accepts icon, tone, label, value, trend, and footnote:

```jsx
const MetricCard = ({ icon: Icon, tone = "green", label, value, trend, footnote }) => (
  <article className="vault-card metric-card">
    {Icon && (
      <span className={`metric-icon metric-icon-${tone}`} aria-hidden="true">
        <Icon size={24} />
      </span>
    )}
    <div>
      <span className="summary-label">{label}</span>
      <strong className="summary-value">{value}</strong>
      {trend && <span className={`metric-footnote ${trend.className || ""}`}>{trend.text}</span>}
      {footnote && <span className="metric-footnote">{footnote}</span>}
    </div>
  </article>
);

export default MetricCard;
```

- [ ] **Step 3: Create `StatusCards.jsx`**

Render four status cards from current metadata:

```jsx
const StatusCards = ({ generatedAt, dataStatus, sourceNotes }) => (
  <section className="status-card-grid" aria-label="Dashboard status">
    {[
      ["Session", "Robinhood connected", "Connected"],
      ["Last Updated", generatedAt, "Just now"],
      ["Data Status", dataStatus, dataStatus],
      ["Sources", sourceNotes.join(" / "), "Robinhood data"],
    ].map(([label, value, pill]) => (
      <article className="vault-card status-card" key={label}>
        <span className="summary-label">{label}</span>
        <strong>{value}</strong>
        <span className="status-pill">{pill}</span>
      </article>
    ))}
  </section>
);

export default StatusCards;
```

- [ ] **Step 4: Create `AppShell.jsx`**

Use `lucide-react` icons for nav and actions. Functional nav buttons call `onNavigate`; disabled nav buttons render `disabled` and a coming-soon title.

Key props:

```jsx
const AppShell = ({
  activeView,
  views,
  onNavigate,
  pageTitle,
  pageSubtitle,
  isBusy,
  onRefresh,
  onLogout,
  children,
}) => (
  <div className="vault-shell">
    <aside className="vault-sidebar">brand, nav, market snapshot, support</aside>
    <div className="vault-main">
      <header className="vault-topbar">page title, refresh, logout</header>
      <main className="vault-content">{children}</main>
    </div>
  </div>
);
```

- [ ] **Step 5: Run shell tests**

Run:

```powershell
cd RH_Dashboard
npm test -- App.test.jsx
```

Expected: failures move from missing imports toward missing App integration.

## Task 3: Integrate Authenticated Views

**Files:**
- Modify: `RH_Dashboard/src/App.jsx`

- [ ] **Step 1: Replace `activeTab` with `activeView`**

Use view ids:

```js
const DASHBOARD_VIEWS = ["overview", "portfolio", "dividends", "holdings", "analytics"];
const DASHBOARD_PREFERENCES_KEY = "rh-dashboard:preferences";
```

Store `activeView` in preferences, defaulting to `overview`.

- [ ] **Step 2: Add page metadata**

Define titles/subtitles:

```js
const PAGE_COPY = {
  overview: ["Portfolio Dashboard", "Track allocation, performance, and dividend income"],
  portfolio: ["Portfolio", "Monitor holdings, allocation, and performance"],
  dividends: ["Dividends", "Track dividend income, trends, and performance"],
  holdings: ["Holdings", "Review individual positions, weights, and cost basis"],
  analytics: ["Dividend Income Outlook", "Forecast dividend payments and compare yearly income"],
};
```

- [ ] **Step 3: Add holdings search state**

Add:

```js
const [holdingsSearch, setHoldingsSearch] = useState("");
```

Pass it into `HoldingsTable`.

- [ ] **Step 4: Render views through `AppShell`**

Replace old tabs with:

```jsx
<AppShell
  activeView={activeView}
  views={SHELL_VIEWS}
  onNavigate={setActiveView}
  pageTitle={pageTitle}
  pageSubtitle={pageSubtitle}
  isBusy={isDashboardBusy}
  onRefresh={handleRefreshDashboard}
  onLogout={handleLogout}
>
  {renderDashboardView()}
</AppShell>
```

- [ ] **Step 5: Create view render helpers**

Implement `renderOverviewView`, `renderPortfolioView`, `renderDividendsView`, `renderHoldingsView`, and `renderAnalyticsView` using existing `renderPanelState` and components.

- [ ] **Step 6: Run App tests**

Run:

```powershell
cd RH_Dashboard
npm test -- App.test.jsx
```

Expected: App tests pass or fail only on styling-independent text adjustments.

## Task 4: Add Holdings Search

**Files:**
- Modify: `RH_Dashboard/src/Components/HoldingsPieChart.jsx`
- Modify: `RH_Dashboard/src/App.jsx`

- [ ] **Step 1: Add `searchQuery` prop**

Change:

```jsx
export const HoldingsTable = ({ data, showPerformance = false, searchQuery = "" }) => {
```

- [ ] **Step 2: Filter rows before sorting**

Inside `useMemo`, after creating rows:

```js
const normalizedQuery = searchQuery.trim().toLowerCase();
const filteredRows = normalizedQuery
  ? rows.filter((row) =>
      row.ticker.toLowerCase().includes(normalizedQuery) ||
      row.name.toLowerCase().includes(normalizedQuery)
    )
  : rows;

return filteredRows.sort((a, b) => {
  const aValue = a[sortConfig.key];
  const bValue = b[sortConfig.key];
  const direction = sortConfig.direction === "asc" ? 1 : -1;
  if (aValue === null && bValue === null) return 0;
  if (aValue === null) return 1;
  if (bValue === null) return -1;
  if (typeof aValue === "string") return aValue.localeCompare(bValue) * direction;
  return (aValue - bValue) * direction;
});
```

- [ ] **Step 3: Add empty search state**

If `holdingsRows.length === 0`, show:

```jsx
No holdings match the current search.
```

when `searchQuery` is non-empty.

- [ ] **Step 4: Add search input in Holdings view**

In `App.jsx`, render:

```jsx
<input
  aria-label="Search holdings"
  className="vault-search-input"
  onChange={(event) => setHoldingsSearch(event.target.value)}
  placeholder="Search by ticker or company"
  type="search"
  value={holdingsSearch}
/>
```

- [ ] **Step 5: Run tests**

Run:

```powershell
cd RH_Dashboard
npm test -- App.test.jsx
```

Expected: holdings search test passes.

## Task 5: Redesign Login Page

**Files:**
- Modify: `RH_Dashboard/src/Components/LoginPage.jsx`
- Modify: `RH_Dashboard/src/LoginPage.test.jsx`

- [ ] **Step 1: Import icons and brand mark**

Use:

```jsx
import { Lock, ShieldCheck, TrendingUp, User, WalletCards } from "lucide-react";
import BrandMark from "./Shell/BrandMark";
```

- [ ] **Step 2: Replace login markup**

Render:

```jsx
<main className="login-page vault-login-page">
  <section className="login-story-panel">
    <BrandMark />
    <h1>Track your portfolio. Understand your <span>dividend income.</span></h1>
    <div className="login-benefits">
      <article><TrendingUp /><strong>Portfolio allocation and performance</strong></article>
      <article><WalletCards /><strong>Dividend income tracking</strong></article>
      <article><ShieldCheck /><strong>Secure Robinhood data sync</strong></article>
    </div>
  </section>
  <section className="login-form-panel">
    <Card className="login-card vault-login-card">
      <Card.Body>
        <BrandMark compact />
        <h1>Sign in</h1>
        <p>Access your Dividend Vault dashboard</p>
        <Form onSubmit={handleSubmit}>username, password, optional MFA, submit button</Form>
      </Card.Body>
    </Card>
  </section>
</main>
```

Keep the same `handleSubmit`, form state, and `onLogin` payload.

- [ ] **Step 3: Update labels**

Use:

```jsx
<Form.Label>Email or username</Form.Label>
<Form.Label>Password</Form.Label>
<Form.Label>MFA code</Form.Label>
```

Submit button text should be `Sign In`, `Signing in`, or `Waiting for approval`.

- [ ] **Step 4: Run login tests**

Run:

```powershell
cd RH_Dashboard
npm test -- LoginPage.test.jsx
```

Expected: login tests pass.

## Task 6: Replace Visual Styling

**Files:**
- Modify: `RH_Dashboard/src/App.css`
- Modify: `RH_Dashboard/src/index.css`

- [ ] **Step 1: Reset global button styles**

Make `index.css` defer button styling to components:

```css
button {
  font: inherit;
}
```

- [ ] **Step 2: Add shell CSS**

Add styles for:

- `.vault-shell`
- `.vault-sidebar`
- `.vault-main`
- `.vault-topbar`
- `.vault-content`
- `.vault-nav-button`
- `.market-snapshot`
- `.brand-mark`

- [ ] **Step 3: Add card and page CSS**

Add styles for:

- `.vault-card`
- `.metric-card`
- `.status-card-grid`
- `.dashboard-page-grid`
- `.vault-panel`
- `.vault-toolbar`
- `.vault-search-input`

- [ ] **Step 4: Add login CSS**

Add styles for:

- `.vault-login-page`
- `.login-story-panel`
- `.login-benefits`
- `.login-form-panel`
- `.vault-login-card`

- [ ] **Step 5: Add responsive CSS**

Use breakpoints:

```css
@media (max-width: 980px) {
  .vault-shell { grid-template-columns: 1fr; }
  .vault-sidebar { position: static; width: 100%; min-height: auto; }
}
@media (max-width: 640px) {
  .vault-login-page { grid-template-columns: 1fr; }
  .status-card-grid, .portfolio-metric-grid, .summary-grid { grid-template-columns: 1fr; }
}
```

- [ ] **Step 6: Run build**

Run:

```powershell
cd RH_Dashboard
npm run build
```

Expected: Vite build succeeds.

## Task 7: Full Verification And Cleanup

**Files:**
- Modify: `RH_Dashboard/src/App.jsx`
- Modify: `RH_Dashboard/src/App.css`
- Modify: `RH_Dashboard/src/index.css`
- Modify: `RH_Dashboard/src/App.test.jsx`
- Modify: `RH_Dashboard/src/LoginPage.test.jsx`

- [ ] **Step 1: Run all frontend tests**

Run:

```powershell
cd RH_Dashboard
npm test
```

Expected: all Vitest tests pass.

- [ ] **Step 2: Run frontend build**

Run:

```powershell
cd RH_Dashboard
npm run build
```

Expected: Vite build succeeds.

- [ ] **Step 3: Start dev server**

Run:

```powershell
cd RH_Dashboard
npm run dev -- --host 127.0.0.1
```

Expected: Vite prints a local URL, usually `http://127.0.0.1:5173/`.

- [ ] **Step 4: Browser visual check**

Open the dev URL in the in-app browser and verify:

- Login page uses split-screen Dividend Vault design.
- Authenticated shell renders dark sidebar/topbar.
- Overview, Portfolio, Dividends, Holdings, and Analytics views switch correctly.
- Disabled nav items are visibly disabled.
- Holdings search filters visible rows.
- Narrow viewport stacks content without overlapping.

- [ ] **Step 5: Final git status**

Run:

```powershell
git status --short
```

Expected: only intentional implementation files are modified.
