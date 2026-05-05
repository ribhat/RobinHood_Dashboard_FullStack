import { expect, test } from "@playwright/test";
import { currentYear } from "./fixtures/dashboardData";
import { mockApi } from "./support/mockApi";

const clearDashboardPreferences = async (page) => {
  await page.addInitScript(() => {
    window.localStorage.clear();
  });
};

const expectNoHorizontalOverflow = async (page) => {
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          document.documentElement.scrollWidth <=
          document.documentElement.clientWidth + 1
      )
    )
    .toBe(true);
};

const expectPageTitle = async (page, title) => {
  await expect(page.locator(".page-heading h1")).toHaveText(title);
};

const loadAuthenticatedDashboard = async (page) => {
  await clearDashboardPreferences(page);
  const api = await mockApi(page, { authenticated: true });

  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Portfolio Dashboard" })
  ).toBeVisible();
  await expect(page.getByText("Polygon fallback supplied dividend schedules for O.")).toBeVisible();

  return api;
};

test.describe("Dividend Vault browser smoke", () => {
  test("renders unauthenticated login and MFA-required validation", async ({ page }) => {
    await clearDashboardPreferences(page);
    const api = await mockApi(page, {
      authenticated: false,
      login: {
        status: 409,
        body: {
          error: "Robinhood needs phone approval.",
          code: "mfa_required",
          mfa_required: true,
        },
      },
    });

    await page.goto("/");

    await expect(page.getByRole("heading", { name: /Track your portfolio/i })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
    await expect(page.getByText("Dividend income tracking")).toBeVisible();
    await expect(page.getByLabel("Email or username")).toBeVisible();
    await expect(page.getByLabel("Password")).toBeVisible();
    await expect(page.getByLabel("MFA code")).toBeVisible();
    await expect(page.getByRole("button", { name: "Sign In" })).toBeVisible();
    await expectNoHorizontalOverflow(page);

    await page.getByRole("button", { name: "Sign In" }).click();
    await expect(
      page.getByText("Enter your Robinhood username and password.")
    ).toBeVisible();

    await page.getByLabel("Email or username").fill("qa@example.com");
    await page.getByLabel("Password").fill("not-a-real-password");
    await page.getByRole("button", { name: "Sign In" }).click();

    await expect(page.getByText(/Robinhood needs phone approval/i)).toBeVisible();
    expect(api.calls.login).toHaveLength(1);
  });

  test("renders authenticated overview with status, warnings, and disabled reports nav", async ({
    page,
  }) => {
    await loadAuthenticatedDashboard(page);

    await expect(page.getByLabel("Dashboard status")).toContainText("Robinhood connected");
    await expect(page.getByLabel("Dashboard status")).toContainText("Ready");
    await expect(page.getByRole("status")).toContainText("Data notes");
    await expect(page.getByLabel("Portfolio overview")).toContainText("Portfolio Value");
    await expect(page.getByRole("heading", { name: "Portfolio Allocation" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Reports" })).toBeDisabled();
    await expectNoHorizontalOverflow(page);
  });

  test("switches enabled dashboard navigation and ignores disabled nav", async ({ page }) => {
    await loadAuthenticatedDashboard(page);

    const expectedViews = [
      ["Portfolio", "Portfolio"],
      ["Dividends", "Dividends"],
      ["Holdings", "Holdings"],
      ["Analytics", "Dividend Income Outlook"],
    ];

    for (const [navLabel, heading] of expectedViews) {
      await page.getByRole("button", { name: navLabel }).click();
      await expectPageTitle(page, heading);
      await expect(page.getByRole("button", { name: navLabel })).toHaveAttribute(
        "aria-current",
        "page"
      );
    }

    await page.getByRole("button", { name: "Reports" }).click({ force: true });
    await expectPageTitle(page, "Dividend Income Outlook");
    await expect(page.getByRole("button", { name: "Analytics" })).toHaveAttribute(
      "aria-current",
      "page"
    );

    const analyticsCards = page.locator(".analytics-payment-cards");
    await expect(analyticsCards).toContainText("$86.70");
    await expect(analyticsCards).toContainText("SCHD on Jun 24");
    await expect(analyticsCards).toContainText("$28.44");
    await expect(analyticsCards).toContainText("$471.73");
    await expect(page.getByText("Modeled in calendar")).toHaveCount(0);
    await expect(page.getByText("See income calendar")).toHaveCount(0);
    await expect(page.getByText("See projection")).toHaveCount(0);
    await expect(page.locator(".income-calendar-summary")).toHaveCount(0);
  });

  test("filters holdings by company name", async ({ page }) => {
    await loadAuthenticatedDashboard(page);

    await page.getByRole("button", { name: "Holdings" }).click();
    await expect(
      page.getByRole("heading", { name: "Holdings", exact: true })
    ).toBeVisible();
    await expect(page.locator(".holdings-table tbody tr").filter({ hasText: "SCHD" })).toHaveCount(1);
    await expect(page.locator(".holdings-table tbody tr").filter({ hasText: "MSFT" })).toHaveCount(1);
    await expectNoHorizontalOverflow(page);

    await page.getByLabel("Search holdings").fill("schwab");

    await expect(page.locator(".holdings-table tbody tr")).toHaveCount(1);
    await expect(page.locator(".holdings-table tbody tr").filter({ hasText: "SCHD" })).toHaveCount(1);
    await expect(page.locator(".holdings-table tbody tr").filter({ hasText: "MSFT" })).toHaveCount(0);
  });

  test("loads previous-year dividend comparison when enabled", async ({ page }) => {
    const api = await loadAuthenticatedDashboard(page);

    await page.getByRole("button", { name: "Dividends" }).click();
    await expect(page.getByRole("heading", { name: "Dividends" })).toBeVisible();
    await page.getByLabel("Dividend chart type").selectOption("Line Graph");
    await page.getByLabel("Compare Previous Year").check();

    await expect
      .poll(() => api.calls.yearlyDividends.filter((year) => year === currentYear - 1).length)
      .toBe(1);
    await expect(page.getByText(`${currentYear - 1} Total`)).toBeVisible();
    await expect(page.getByText("$262.70")).toBeVisible();
    await expectNoHorizontalOverflow(page);
  });
});
