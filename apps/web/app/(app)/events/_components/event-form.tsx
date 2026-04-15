"use client";

import { useActionState, useState } from "react";
import {
  createEvent,
  updateEvent,
  type EventActionResult,
} from "@/lib/events/actions";
import {
  EVENT_TYPES,
  EVENT_TYPE_LABELS,
  RECURRENCE_RULES,
  RECURRENCE_RULE_LABELS,
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

  const [isRecurring, setIsRecurring] = useState(event?.is_recurring ?? false);

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

      {/* Hidden input carries boolean as string for FormData compatibility */}
      <input type="hidden" name="isRecurring" value={isRecurring ? "true" : "false"} />

      <div className="flex items-center gap-200">
        <input
          id="isRecurring"
          type="checkbox"
          checked={isRecurring}
          onChange={(e) => setIsRecurring(e.target.checked)}
          disabled={isEdit && !!event?.is_recurring}
          className="h-400 w-400 rounded-100 border-neutral-300 accent-brand-calm-600 disabled:cursor-not-allowed disabled:opacity-60"
        />
        <label htmlFor="isRecurring" className="text-body-sm font-semibold text-neutral-800">
          Recurring event
        </label>
      </div>

      {isRecurring && (
        <div className="flex flex-col gap-100">
          <label htmlFor="recurrenceRule" className="text-body-sm font-semibold text-neutral-800">
            Recurrence pattern
          </label>
          {isEdit && event?.recurrence_rule ? (
            <>
              {/* Read-only display when stubs already exist — changing rule is non-goal for RS-F020 */}
              <input type="hidden" name="recurrenceRule" value={event.recurrence_rule} />
              <p className="rounded-200 border border-neutral-300 bg-neutral-100 px-300 py-200 text-body text-neutral-600">
                {RECURRENCE_RULE_LABELS[event.recurrence_rule]}
              </p>
              <p className="text-body-sm text-neutral-500">
                Recurrence pattern cannot be changed after stubs have been generated.
              </p>
            </>
          ) : (
            <select
              id="recurrenceRule"
              name="recurrenceRule"
              required
              defaultValue={event?.recurrence_rule ?? ""}
              className={INPUT_CLASS}
            >
              <option value="" disabled>Select pattern</option>
              {RECURRENCE_RULES.map((rule) => (
                <option key={rule} value={rule}>
                  {RECURRENCE_RULE_LABELS[rule]}
                </option>
              ))}
            </select>
          )}
        </div>
      )}

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
