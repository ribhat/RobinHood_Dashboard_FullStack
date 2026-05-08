const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:5000";
const INVALID_API_RESPONSE_MESSAGE =
  "The API returned an invalid response. Please try again.";

const parseJsonResponse = async (response) => {
  const responseText = await response.text();

  if (!responseText) {
    return {};
  }

  try {
    return JSON.parse(responseText);
  } catch (parseError) {
    const error = new Error(INVALID_API_RESPONSE_MESSAGE);
    error.status = response.status;
    error.code = "invalid_api_response";
    error.responseText = responseText;
    error.cause = parseError;
    throw error;
  }
};

/**
 * @template T
 * @param {string} path
 * @param {RequestInit & { headers?: HeadersInit }} [options]
 * @returns {Promise<T>}
 */
export async function fetchJson(path, options = {}) {
  const { headers, ...fetchOptions } = options;
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...fetchOptions,
    headers: {
      "Content-Type": "application/json",
      ...(headers || {}),
    },
  });
  const data = await parseJsonResponse(response);

  if (!response.ok) {
    const error = new Error(data.error || "Unable to load dashboard data.");
    error.status = response.status;
    error.data = data;
    error.code = data.code;
    error.mfaRequired = Boolean(data.mfa_required);
    error.mfaCodeRequired = Boolean(data.mfa_code_required);
    error.rateLimited = response.status === 429 || data.code === "rate_limited";
    error.retryAfter = response.headers?.get?.("Retry-After") || data.retry_after;
    throw error;
  }

  return data;
}

export async function postJson(path, body = {}) {
  return fetchJson(path, {
    method: "POST",
    body: JSON.stringify(body),
  });
}
