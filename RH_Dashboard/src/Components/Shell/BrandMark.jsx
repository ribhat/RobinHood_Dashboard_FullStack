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
