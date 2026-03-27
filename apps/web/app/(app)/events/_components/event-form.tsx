"use client";

import { useActionState } from "react";
import {
  createEvent,
  updateEvent,
  type EventActionResult,
} from "@/lib/events/actions";
import {
  EVENT_TYPES,
  EVENT_TYPE_LABELS,
  type Event,
} from "@/lib/events/types";

const INPUT_CLASS =
  "rounded-200 border border-neutral-300 bg-neutral-0 px-300 py-200 text-body text-neutral-950 outline-none transition-colors duration-fast focus:border-brand-calm-600 focus:ring-2 focus:ring-brand-calm-600/20";

export function EventForm({ event }: { event?: Event }) {
  const isEdit = !!event;
  const action = isEdit ? updateEvent : createEvent;

  const [state, formAction, isPending] = useActionState<
    EventActionResult,
    FormData
  >(action, undefined);

  const errorMessage = state && "error" in state ? state.error : null;

  return (
    <form action={formAction} className="flex flex-col gap-300">
      {isEdit && <input type="hidden" name="id" value={event.id} />}

      <div className="flex flex-col gap-100">
        <label
          htmlFor="title"
          className="text-body-sm font-semibold text-neutral-800"
        >
          Event title
        </label>
        <input
          id="title"
          name="title"
          type="text"
          required
          maxLength={200}
          defaultValue={event?.title ?? ""}
          placeholder="e.g. Sunday Service — April 6"
          className={INPUT_CLASS}
        />
      </div>

      <div className="flex flex-col gap-100">
        <label
          htmlFor="eventType"
          className="text-body-sm font-semibold text-neutral-800"
        >
          Event type
        </label>
        <select
          id="eventType"
          name="eventType"
          required
          defaultValue={event?.event_type ?? ""}
          className={INPUT_CLASS}
        >
          <option value="" disabled>
            Select event type
          </option>
          {EVENT_TYPES.map((type) => (
            <option key={type} value={type}>
              {EVENT_TYPE_LABELS[type]}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-100">
        <label
          htmlFor="eventDate"
          className="text-body-sm font-semibold text-neutral-800"
        >
          Event date
        </label>
        <input
          id="eventDate"
          name="eventDate"
          type="date"
          required
          defaultValue={event?.event_date ?? ""}
          className={INPUT_CLASS}
        />
      </div>

      {errorMessage && (
        <p className="text-body-sm text-semantic-error">{errorMessage}</p>
      )}

      <button
        type="submit"
        disabled={isPending}
        className="rounded-200 bg-brand-calm-600 px-400 py-200 text-body font-semibold text-neutral-0 transition-colors duration-fast hover:bg-brand-calm-600/90 disabled:opacity-60"
      >
        {isPending
          ? isEdit
            ? "Saving\u2026"
            : "Creating\u2026"
          : isEdit
            ? "Save changes"
            : "Create event"}
      </button>
    </form>
  );
}
