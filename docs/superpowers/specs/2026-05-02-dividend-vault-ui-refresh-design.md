# Dividend Vault UI Refresh Design

Date: 2026-05-02
Branch: `codex-ui-mockup-refresh`

## Goal

Refresh the authenticated dashboard and login experience to match the supplied Dividend Vault mockups as a design direction, while keeping the current live Robinhood-backed data contracts and avoiding fake interactive features.

## Approved Direction

Use the **Shell Refactor** approach:

- Rebrand the app as **Dividend Vault** with the tagline `Invest With Income`.
- Build a persistent authenticated app shell with a dark left sidebar, dark top page header, and main content region.
- Default the authenticated landing view to `Overview`.
- Treat mockups as design direction rather than pixel-perfect requirements.
- Add `lucide-react` for clean line icons.
- Use a CSS-built brand mark instead of a generated image asset.
- Keep the current backend/API behavior intact.

## Navigation Scope

Functional views for this pass:

- `Overview`
- `Portfolio`
- `Dividends`
- `Holdings`
- `Analytics`

Visible but disabled or coming-soon nav items:

- `Watchlist`
- `Reports`
- `Settings`

`Analytics` maps to the Dividend Income Outlook screen from the mockups.

## Authenticated Shell

The authenticated UI will use a shared shell made from small reusable components:

- `AppShell`
- `BrandMark`
- `Sidebar`
- `PageHeader`
- `MetricCard`
- `StatusCards`

The shell includes:

- Dark sidebar with brand, nav, unavailable Market Snapshot card, and Support.
- Dark top header with active page title/subtitle plus `Refresh` and `Logout`.
- Main content area with white card surfaces, compact dashboard density, and consistent status/metric styling.

State remains local in `App.jsx` for now:

- Auth status and login flow.
- Active dashboard view.
- Dashboard refresh.
- Dividend year, chart type, and compare toggle.
- Holdings search and sort.

No router is required for this pass.

## View Mapping

### Overview

Matches the supplied overview mockup direction:

- Status cards.
- Portfolio value, unrealized gain/loss, estimated dividends, and largest position metrics.
- Top movers.
- Concentration panel.
- Data warning banner.
- Portfolio allocation summary.

### Portfolio

Matches the portfolio mockup direction:

- Status cards.
- Portfolio metric cards.
- Allocation chart and concentration panel.
- Data warning banner.
- Holdings details table.

### Dividends

Matches the dividend performance mockup direction:

- Portfolio/dividend summary cards.
- Dividend performance chart.
- Year, chart type, and compare previous year controls.

### Holdings

Matches the holdings mockup direction:

- Session/data status cards.
- Concentration and top holdings panels.
- Data warning banner.
- Larger holdings table with real search and existing sort behavior.

Search should filter by ticker or company name. Filters, export, pagination, row menus, and ticker logos are out of scope unless already supported by current data.

### Analytics

Matches the income outlook mockup direction:

- Dividend payment summary cards.
- Income calendar.
- Income projection.
- Modeled dividend schedule.

## Login Page

Redesign the unauthenticated login page to match the supplied login mockup direction:

- Split-screen layout.
- Dark left brand/benefits panel.
- Bright sign-in card on the right.
- CSS Dividend Vault brand mark.
- Polished username, password, and optional MFA fields.
- Preserve current Robinhood username/password submission, optional MFA code, phone approval guidance, pending state, and error handling.

Do not implement SSO. Also omit nonfunctional `Remember me` and `Forgot password` controls because the app does not store credentials and does not provide a local password-reset flow.

## Honest Data And Disabled Features

The UI should not imply unavailable live data or unsupported actions.

- Market Snapshot appears visually in the sidebar but is marked unavailable or coming soon.
- Disabled nav items use disabled styling and do not navigate.
- No fake market numbers.
- No fake ticker logos.
- No fake export, pagination, or report generation behavior.

## Responsive Behavior

Desktop should follow the mockup shell closely.

For tablet and mobile:

- Collapse the sidebar into compact navigation.
- Stack metric cards and panels.
- Keep charts at stable readable heights.
- Let large tables scroll horizontally.
- Avoid shrinking dense financial data into unreadable grids.

## Testing And Verification

Implementation should include focused test updates for:

- Landing on `Overview` after authentication.
- Switching between functional shell views.
- Disabled nav behavior.
- Dividend preference persistence where current tests already cover it.
- Login form behavior and MFA messaging after the visual redesign.
- Holdings search behavior after adding the search control.

Verification should run:

- Frontend tests.
- Frontend build.
- Local dev server visual check in the in-app browser at desktop and narrow widths.

## Out Of Scope

- Backend API changes.
- Live market index data.
- Watchlist, reports, and settings features.
- URL routing.
- SSO.
- Credential storage.
- Export/pagination/row-menu behavior for holdings.
- Pixel-perfect reproduction of every mockup value, row, and control.
