import { createElement } from "react";
import {
  BarChart3,
  Briefcase,
  ChevronDown,
  CircleDollarSign,
  FileText,
  HelpCircle,
  LayoutDashboard,
  LogOut,
  PieChart,
  RefreshCw,
  Settings,
  Star,
} from "lucide-react";
import BrandMark from "./BrandMark";

const navItems = [
  { id: "overview", label: "Overview", icon: LayoutDashboard },
  { id: "portfolio", label: "Portfolio", icon: PieChart },
  { id: "dividends", label: "Dividends", icon: CircleDollarSign },
  { id: "holdings", label: "Holdings", icon: Briefcase },
  { id: "analytics", label: "Analytics", icon: BarChart3 },
  { id: "watchlist", label: "Watchlist", icon: Star, disabled: true },
  { id: "reports", label: "Reports", icon: FileText, disabled: true },
  { id: "settings", label: "Settings", icon: Settings, disabled: true },
];

const AppShell = ({
  activeView,
  onNavigate,
  pageTitle,
  pageSubtitle,
  isBusy,
  onRefresh,
  onLogout,
  children,
}) => (
  <div className="vault-shell">
    <aside className="vault-sidebar">
      <BrandMark />

      <nav className="vault-nav" aria-label="Dashboard navigation">
        {navItems.map(({ id, label, icon, disabled }) => (
          <button
            aria-current={activeView === id ? "page" : undefined}
            className={`vault-nav-button ${activeView === id ? "active" : ""}`}
            disabled={disabled}
            key={id}
            onClick={() => !disabled && onNavigate(id)}
            title={disabled ? `${label} coming soon` : label}
            type="button"
          >
            {createElement(icon, { size: 20, "aria-hidden": true })}
            <span>{label}</span>
          </button>
        ))}
      </nav>

      <section className="market-snapshot" aria-label="Market snapshot">
        <div>
          <strong>Market Snapshot</strong>
          <span>Unavailable</span>
        </div>
        <p>Live market index data is not connected yet.</p>
      </section>

      <button className="support-button" type="button">
        <HelpCircle size={18} aria-hidden="true" />
        <span>Support</span>
      </button>
    </aside>

    <div className="vault-main">
      <header className="vault-topbar">
        <div className="page-heading">
          <BrandMark compact />
          <div>
            <h1>{pageTitle}</h1>
            <p>{pageSubtitle}</p>
          </div>
        </div>
        <div className="vault-actions">
          <button
            className="vault-action-button refresh-action"
            disabled={isBusy}
            onClick={onRefresh}
            type="button"
          >
            <RefreshCw size={18} aria-hidden="true" />
            <span>{isBusy ? "Refreshing" : "Refresh"}</span>
            <ChevronDown size={15} aria-hidden="true" />
          </button>
          <button
            className="vault-action-button logout-action"
            onClick={onLogout}
            type="button"
          >
            <LogOut size={18} aria-hidden="true" />
            <span>Logout</span>
          </button>
        </div>
      </header>

      <main className="vault-content">{children}</main>
    </div>
  </div>
);

export default AppShell;
