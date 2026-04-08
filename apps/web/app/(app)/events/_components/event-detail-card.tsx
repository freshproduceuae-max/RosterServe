"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { EventStatusBadge } from "./event-status-badge";
import { StatusTransitionModal, DeleteEventModal } from "./status-transition-modal";
import {
  transitionEventStatus,
  softDeleteEvent,
  type EventActionResult,
} from "@/lib/events/actions";
import {
  EVENT_TYPE_LABELS,
  EVENT_STATUS_LABELS,
  VALID_STATUS_TRANSITIONS,
  type Event,
  type EventStatus,
} from "@/lib/events/types";

function formatDate(dateStr: string): string {
  return new Date(dateStr + "T00:00:00").toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function formatTimestamp(ts: string): string {
  return new Date(ts).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

const TRANSITION_BUTTON_LABELS: Record<EventStatus, string> = {
  draft: "",
  published: "Publish event",
  completed: "Mark completed",
};

export function EventDetailCard({
  event,
  canManage,
}: {
  event: Event;
  canManage: boolean;
}) {
  const [transitionTarget, setTransitionTarget] = useState<EventStatus | null>(
    null
  );
  const [showDelete, setShowDelete] = useState(false);

  const [transitionState, transitionAction, transitionPending] =
    useActionState<EventActionResult, FormData>(
      transitionEventStatus,
      undefined
    );

  const [deleteState, deleteAction, deletePending] = useActionState<
    EventActionResult,
    FormData
  >(softDeleteEvent, undefined);

  const nextStatuses = VALID_STATUS_TRANSITIONS[event.status];
  const canEdit = canManage && event.status !== "completed";

  const transitionError =
    transitionState && "error" in transitionState
      ? transitionState.error
      : null;
  const deleteError =
    deleteState && "error" in deleteState ? deleteState.error : null;

  function handleTransitionConfirm() {
    if (!transitionTarget) return;
    const fd = new FormData();
    fd.set("id", event.id);
    fd.set("newStatus", transitionTarget);
    transitionAction(fd);
    setTransitionTarget(null);
  }

  function handleDeleteConfirm() {
    const fd = new FormData();
    fd.set("id", event.id);
    deleteAction(fd);
    setShowDelete(false);
  }

  return (
    <article className="rounded-300 border border-neutral-300 bg-neutral-0 shadow-soft">
      <div className="flex flex-col gap-300 p-500">
        {/* Header */}
        <div className="flex flex-col gap-200 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex flex-col gap-100">
            <h1 className="font-display text-h1 text-neutral-950">
              {event.title}
            </h1>
            <EventStatusBadge status={event.status} />
          </div>
          {canEdit && (
            <Link
              href={`/events/${event.id}/edit`}
              className="rounded-200 border border-neutral-300 bg-neutral-0 px-300 py-200 text-body-sm text-neutral-600 transition-colors duration-fast hover:bg-neutral-100 hover:text-neutral-950"
            >
              Edit event
            </Link>
          )}
        </div>

        {/* Details grid */}
        <div className="grid grid-cols-1 gap-300 sm:grid-cols-2">
          <div>
            <p className="font-mono text-mono uppercase text-neutral-600">
              Event type
            </p>
            <p className="mt-100 text-body text-neutral-950">
              {EVENT_TYPE_LABELS[event.event_type]}
            </p>
          </div>
          <div>
            <p className="font-mono text-mono uppercase text-neutral-600">
              Event date
            </p>
            <p className="mt-100 text-body text-neutral-950">
              {formatDate(event.event_date)}
            </p>
          </div>
          <div>
            <p className="font-mono text-mono uppercase text-neutral-600">
              Status
            </p>
            <p className="mt-100 text-body text-neutral-950">
              {EVENT_STATUS_LABELS[event.status]}
            </p>
          </div>
          <div>
            <p className="font-mono text-mono uppercase text-neutral-600">
              Created
            </p>
            <p className="mt-100 text-body-sm text-neutral-800">
              {formatTimestamp(event.created_at)}
            </p>
          </div>
        </div>

        {/* Errors */}
        {transitionError && (
          <p className="text-body-sm text-semantic-error">{transitionError}</p>
        )}
        {deleteError && (
          <p className="text-body-sm text-semantic-error">{deleteError}</p>
        )}

        {/* Actions */}
        {canManage && (
          <div className="flex flex-wrap gap-200 border-t border-neutral-300 pt-300">
            {nextStatuses.map((next) => (
              <button
                key={next}
                type="button"
                onClick={() => setTransitionTarget(next)}
                disabled={transitionPending}
                className="rounded-200 bg-brand-calm-600 px-300 py-200 text-body-sm font-semibold text-neutral-0 transition-colors duration-fast hover:bg-brand-calm-600/90 disabled:opacity-60"
              >
                {TRANSITION_BUTTON_LABELS[next]}
              </button>
            ))}
            {event.status !== "completed" && (
              <button
                type="button"
                onClick={() => setShowDelete(true)}
                disabled={deletePending}
                className="rounded-200 border border-semantic-error/30 bg-neutral-0 px-300 py-200 text-body-sm text-semantic-error transition-colors duration-fast hover:bg-semantic-error/5 disabled:opacity-60"
              >
                Delete event
              </button>
            )}
          </div>
        )}
      </div>

      {/* Modals */}
      {transitionTarget && (
        <StatusTransitionModal
          isOpen={!!transitionTarget}
          onClose={() => setTransitionTarget(null)}
          onConfirm={handleTransitionConfirm}
          fromStatus={event.status}
          toStatus={transitionTarget}
          eventTitle={event.title}
          isPending={transitionPending}
        />
      )}
      <DeleteEventModal
        isOpen={showDelete}
        onClose={() => setShowDelete(false)}
        onConfirm={handleDeleteConfirm}
        eventTitle={event.title}
        isPending={deletePending}
      />
    </article>
  );
}
