import { fetchJson } from "./api";

describe("api helpers", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns parsed JSON for successful API responses", async () => {
    fetch.mockResolvedValue({
      ok: true,
      status: 200,
      text: () => Promise.resolve('{"ok":true}'),
    });

    await expect(fetchJson("/api/example")).resolves.toEqual({ ok: true });
  });

  it("throws a user-friendly error for invalid JSON responses", async () => {
    fetch.mockResolvedValue({
      ok: true,
      status: 200,
      text: () => Promise.resolve("<html>not json</html>"),
    });

    await expect(fetchJson("/api/example")).rejects.toMatchObject({
      message: "The API returned an invalid response. Please try again.",
      code: "invalid_api_response",
      status: 200,
      responseText: "<html>not json</html>",
    });
  });

  it("preserves backend error details", async () => {
    fetch.mockResolvedValue({
      ok: false,
      status: 409,
      text: () =>
        Promise.resolve(
          JSON.stringify({
            error: "MFA required",
            code: "mfa_required",
            mfa_required: true,
          })
        ),
    });

    await expect(fetchJson("/api/auth/login")).rejects.toMatchObject({
      message: "MFA required",
      status: 409,
      code: "mfa_required",
      mfaRequired: true,
    });
  });

  it("marks rate-limited API responses", async () => {
    fetch.mockResolvedValue({
      ok: false,
      status: 429,
      headers: {
        get: (headerName) => (headerName === "Retry-After" ? "60" : null),
      },
      text: () =>
        Promise.resolve(
          JSON.stringify({
            error: "Too many API requests. Please wait before trying again.",
            code: "rate_limited",
          })
        ),
    });

    await expect(fetchJson("/api/auth/login")).rejects.toMatchObject({
      message: "Too many API requests. Please wait before trying again.",
      status: 429,
      code: "rate_limited",
      rateLimited: true,
      retryAfter: "60",
    });
  });
});
