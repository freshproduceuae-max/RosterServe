import Link from "next/link";
import { EventStatusBadge } from "./event-status-badge";
import { RecurringBadge } from "./recurring-badge";
import { EVENT_TYPE_LABELS, type Event } from "@/lib/events/types";
import { formatEventDate } from "@/lib/format-date";

export function EventListTable({ events }: { events: Event[] }) {
  return (
    <>
      {/* Desktop: dense table from lg breakpoint */}
      <div className="hidden lg:block">
        <table className="w-full">
          <thead>
            <tr className="border-b border-neutral-300">
              <th className="py-200 pr-300 text-left font-mono text-mono uppercase text-neutral-600">
                Title
              </th>
              <th className="py-200 pr-300 text-left font-mono text-mono uppercase text-neutral-600">
                Type
              </th>
              <th className="py-200 pr-300 text-left font-mono text-mono uppercase text-neutral-600">
                Date
              </th>
              <th className="py-200 pr-300 text-left font-mono text-mono uppercase text-neutral-600">
                Status
              </th>
              <th className="py-200 pr-300 text-left font-mono text-mono uppercase text-neutral-600">
                Recurring
              </th>
            </tr>
          </thead>
          <tbody>
            {events.map((event) => (
              <tr
                key={event.id}
                className="border-b border-neutral-300/50 transition-colors duration-fast hover:bg-surface-cool/50"
              >
                <td className="py-300 pr-300">
                  <Link
                    href={`/events/${event.id}`}
                    className="text-body font-semibold text-neutral-950 hover:text-brand-calm-600"
                  >
                    {event.title}
                  </Link>
                </td>
                <td className="py-300 pr-300 text-body-sm text-neutral-600">
                  {EVENT_TYPE_LABELS[event.event_type]}
                </td>
                <td className="py-300 pr-300 text-body-sm text-neutral-800">
                  {formatEventDate(event.event_date)}
                </td>
                <td className="py-300 pr-300">
                  <EventStatusBadge status={event.status} />
                </td>
                <td className="py-300 pr-300">
                  {event.is_recurring && event.recurrence_rule && (
                    <RecurringBadge rule={event.recurrence_rule} />
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile/tablet: stacked cards below lg */}
      <div className="flex flex-col gap-200 lg:hidden">
        {events.map((event) => (
          <Link
            key={event.id}
            href={`/events/${event.id}`}
            className="flex flex-col gap-100 rounded-300 border border-neutral-300 bg-neutral-0 p-300 transition-colors duration-fast hover:border-brand-calm-600/30"
          >
            <div className="flex items-center justify-between gap-200">
              <span className="text-body font-semibold text-neutral-950">
                {event.title}
              </span>
              <EventStatusBadge status={event.status} />
            </div>
            <div className="flex flex-wrap gap-300 text-body-sm text-neutral-600">
              <span>{EVENT_TYPE_LABELS[event.event_type]}</span>
              <span>{formatEventDate(event.event_date)}</span>
              {event.is_recurring && event.recurrence_rule && (
                <RecurringBadge rule={event.recurrence_rule} />
              )}
            </div>
          </Link>
        ))}
      </div>
    </>
  );
}
