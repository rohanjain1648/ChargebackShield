import { formatDate } from "@/lib/format";

type ActivityEvent = {
  id: string;
  event_type: string;
  message: string;
  created_date: string;
};

export function ActivityTimeline({ events }: { events: ActivityEvent[] }) {
  if (!events.length) {
    return <p style={{ color: "var(--text-dim)", fontSize: 13.5 }}>No activity yet.</p>;
  }
  return (
    <div className="timeline">
      {events.map((e) => (
        <div className="timeline-item" key={e.id}>
          <div className="time">{formatDate(e.created_date)}</div>
          <div>{e.message}</div>
        </div>
      ))}
    </div>
  );
}
