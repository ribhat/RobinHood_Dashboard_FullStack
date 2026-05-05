import {
  currentYear,
  currentYearDividends,
  dashboardData,
  previousYearDividends,
} from "../fixtures/dashboardData";

const corsHeaders = {
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "Content-Type",
  "access-control-allow-methods": "GET,POST,OPTIONS",
};

const fulfillJson = (route, body, status = 200) =>
  route.fulfill({
    status,
    headers: corsHeaders,
    contentType: "application/json",
    body: JSON.stringify(body),
  });

const fulfillPreflight = (route) =>
  route.fulfill({
    status: 204,
    headers: corsHeaders,
  });

const parseJsonBody = (request) => {
  const rawBody = request.postData();

  if (!rawBody) {
    return null;
  }

  try {
    return JSON.parse(rawBody);
  } catch {
    return rawBody;
  }
};

const getRequestYear = (request) => {
  const url = new URL(request.url());
  const year = Number(url.pathname.split("/").pop() || url.searchParams.get("year"));

  return Number.isInteger(year) ? year : currentYear;
};

export async function mockApi(page, options = {}) {
  const state = {
    authenticated: options.authenticated ?? true,
    mfaRequired: options.mfaRequired ?? false,
    dashboard: options.dashboard ?? dashboardData,
    login: options.login ?? {
      status: 200,
      body: { authenticated: true },
    },
    yearlyDividendsByYear: {
      [currentYear]: currentYearDividends,
      [currentYear - 1]: previousYearDividends,
      ...(options.yearlyDividendsByYear || {}),
    },
  };
  const calls = {
    authStatus: [],
    dashboard: [],
    yearlyDividends: [],
    login: [],
    logout: [],
  };

  await page.route("**/api/auth/status", (route) => {
    const request = route.request();

    if (request.method() === "OPTIONS") {
      return fulfillPreflight(route);
    }

    calls.authStatus.push(request.url());

    return fulfillJson(route, {
      authenticated: state.authenticated,
      mfa_required: state.mfaRequired,
      error: state.authenticated ? null : options.authError || null,
    });
  });

  await page.route("**/api/dashboard?year=*", (route) => {
    const request = route.request();

    if (request.method() === "OPTIONS") {
      return fulfillPreflight(route);
    }

    const requestedYear = Number(new URL(request.url()).searchParams.get("year"));
    calls.dashboard.push(requestedYear);

    if (!state.authenticated) {
      return fulfillJson(route, { error: "Robinhood login required." }, 401);
    }

    return fulfillJson(route, {
      ...state.dashboard,
      selected_year: Number.isInteger(requestedYear) ? requestedYear : currentYear,
    });
  });

  await page.route("**/api/dividends/yearly/*", (route) => {
    const request = route.request();

    if (request.method() === "OPTIONS") {
      return fulfillPreflight(route);
    }

    const requestedYear = getRequestYear(request);
    calls.yearlyDividends.push(requestedYear);

    if (!state.authenticated) {
      return fulfillJson(route, { error: "Robinhood login required." }, 401);
    }

    return fulfillJson(
      route,
      state.yearlyDividendsByYear[requestedYear] || currentYearDividends
    );
  });

  await page.route("**/api/auth/login", (route) => {
    const request = route.request();

    if (request.method() === "OPTIONS") {
      return fulfillPreflight(route);
    }

    calls.login.push(parseJsonBody(request));

    if (state.login.status < 400 && state.login.body?.authenticated) {
      state.authenticated = true;
      state.mfaRequired = false;
    }

    return fulfillJson(route, state.login.body, state.login.status);
  });

  await page.route("**/api/auth/logout", (route) => {
    const request = route.request();

    if (request.method() === "OPTIONS") {
      return fulfillPreflight(route);
    }

    calls.logout.push(parseJsonBody(request));
    state.authenticated = false;

    return fulfillJson(route, { authenticated: false });
  });

  return { calls, state };
}
