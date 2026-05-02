const MetricCard = ({
  icon: Icon,
  tone = "green",
  label,
  value,
  trend,
  footnote,
}) => (
  <article className="vault-card metric-card">
    {Icon && (
      <span className={`metric-icon metric-icon-${tone}`} aria-hidden="true">
        <Icon size={24} />
      </span>
    )}
    <div className="metric-card-copy">
      <span className="summary-label">{label}</span>
      <strong className="summary-value">{value}</strong>
      {trend && (
        <span className={`metric-footnote ${trend.className || ""}`}>
          {trend.text}
        </span>
      )}
      {footnote && <span className="metric-footnote">{footnote}</span>}
    </div>
  </article>
);

export default MetricCard;
