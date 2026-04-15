import Link from "next/link";
import { RecurringBadge } from "./recurring-badge";
import { formatEventDate } from "@/lib/format-date";
import { EVENT_TYPE_LABELS } from "@/lib/events/types";
import type { ForecastEvent } from "@/lib/events/queries";

export function ForecastTab({ events }: { events: ForecastEvent[] }) {
  if (events.length === 0) {
    return (
      <div className="rounded-300 border border-dashed border-neutral-300 p-500 text-center">
        <p className="text-body text-neutral-600">No upcoming recurring events in the next 12 weeks.</p>
        <p className="mt-100 text-body-sm text-neutral-500">
          Mark an event as recurring when creating it to see stubs here.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-200">
      {events.map((event) => (
        <Link
          key={event.id}
          href={`/events/${event.id}`}
          className="flex flex-col gap-100 rounded-300 border border-neutral-300 bg-neutral-0 p-300 transition-colors duration-fast hover:border-brand-calm-600/30"
        >
          <div className="flex flex-wrap items-center justify-between gap-200">
            <span className="text-body font-semibold text-neutral-950">{event.title}</span>
            <span className="rounded-100 border border-neutral-300 px-200 py-50 font-mono text-mono text-neutral-600 uppercase">
              Draft stub
            </span>
          </div>
          <div className="flex flex-wrap gap-300 text-body-sm text-neutral-600">
            <span>{formatEventDate(event.event_date)}</span>
            <span>{EVENT_TYPE_LABELS[event.event_type]}</span>
            {event.is_recurring && event.recurrence_rule && (
              <RecurringBadge rule={event.recurrence_rule} />
            )}
            {event.departmentCount > 0 && (
              <span>{event.departmentCount} dept{event.departmentCount !== 1 ? "s" : ""} planned</span>
            )}
          </div>
        </Link>
      ))}
    </div>
  );
}
