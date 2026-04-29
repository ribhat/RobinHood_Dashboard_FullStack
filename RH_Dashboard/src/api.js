const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:5000";

export async function fetchJson(path, options = {}) {
  const { headers, ...fetchOptions } = options;
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...fetchOptions,
    headers: {
      "Content-Type": "application/json",
      ...(headers || {}),
    },
  });
  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const error = new Error(data.error || "Unable to load dashboard data.");
    error.status = response.status;
    error.data = data;
    error.code = data.code;
    error.mfaRequired = Boolean(data.mfa_required);
    error.mfaCodeRequired = Boolean(data.mfa_code_required);
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
