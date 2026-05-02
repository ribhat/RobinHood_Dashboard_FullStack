import { createElement } from "react";
import { Clock3, Database, Layers3, Link2 } from "lucide-react";

const statusConfig = [
  {
    label: "Session",
    tone: "green",
    icon: Link2,
    value: "Robinhood connected",
    pill: "Connected",
  },
  {
    label: "Last Updated",
    tone: "blue",
    icon: Clock3,
  },
  {
    label: "Data Status",
    tone: "orange",
    icon: Database,
  },
  {
    label: "Sources",
    tone: "purple",
    icon: Layers3,
  },
];

const StatusCards = ({ generatedAt, dataStatus, sourceNotes }) => {
  const values = {
    "Last Updated": generatedAt,
    "Data Status": dataStatus,
    Sources: sourceNotes.join(" / "),
  };
  const pills = {
    "Last Updated": generatedAt === "Not loaded yet" ? "Pending" : "Just now",
    "Data Status": dataStatus,
    Sources: "Robinhood data",
  };

  return (
    <section className="status-card-grid" aria-label="Dashboard status">
      {statusConfig.map(({ label, tone, icon, value, pill }) => (
        <article className="vault-card status-card" key={label}>
          <span className={`metric-icon metric-icon-${tone}`} aria-hidden="true">
            {createElement(icon, { size: 22 })}
          </span>
          <div>
            <span className="summary-label">{label}</span>
            <strong>{value || values[label]}</strong>
            <span className={`status-pill status-pill-${tone}`}>
              {pill || pills[label]}
            </span>
          </div>
        </article>
      ))}
    </section>
  );
};

export default StatusCards;
