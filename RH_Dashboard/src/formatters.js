export const hasValue = (value) => value !== null && value !== undefined;

export const formatCurrency = (value, fallback = "Unavailable") =>
  hasValue(value) ? `$${Number(value).toFixed(2)}` : fallback;

export const formatSignedCurrency = (value, fallback = "Unavailable") => {
  if (!hasValue(value)) {
    return fallback;
  }

  const amount = Number(value);
  const prefix = amount > 0 ? "+" : amount < 0 ? "-" : "";
  return `${prefix}$${Math.abs(amount).toFixed(2)}`;
};

export const formatPercent = (value, fallback = "Unavailable") =>
  hasValue(value) ? `${Number(value).toFixed(2)}%` : fallback;

export const getToneClass = (value) => {
  if (!hasValue(value) || Number(value) === 0) {
    return "";
  }

  return Number(value) > 0 ? "positive-metric" : "negative-metric";
};

export const formatShortDate = (dateText) =>
  new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
  }).format(new Date(`${dateText}T00:00:00`));
