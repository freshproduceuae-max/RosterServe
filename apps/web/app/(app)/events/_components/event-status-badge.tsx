import { EVENT_STATUS_LABELS, type EventStatus } from "@/lib/events/types";

const STATUS_STYLES: Record<EventStatus, string> = {
  draft: "bg-neutral-100 text-neutral-600 border-neutral-300",
  published: "bg-surface-cool text-brand-calm-600 border-brand-calm-600/20",
  completed: "bg-semantic-success/10 text-semantic-success border-semantic-success/20",
};

export function EventStatusBadge({ status }: { status: EventStatus }) {
  return (
    <span
      className={`inline-block rounded-pill border px-200 py-100 font-mono text-mono uppercase ${STATUS_STYLES[status]}`}
    >
      {EVENT_STATUS_LABELS[status]}
    </span>
  );
}
