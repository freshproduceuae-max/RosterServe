"use client";

import { useEffect, useRef } from "react";
import type { EventStatus } from "@/lib/events/types";

const TRANSITION_DESCRIPTIONS: Record<string, string> = {
  "draft-published":
    "This will publish the event and make it visible for planning.",
  "draft-completed":
    "This will mark the event as completed. This action cannot be undone.",
  "published-completed":
    "This will mark the event as completed. This action cannot be undone.",
};

const CONFIRM_LABELS: Record<string, string> = {
  published: "Publish event",
  completed: "Mark completed",
};

export function StatusTransitionModal({
  isOpen,
  onClose,
  onConfirm,
  fromStatus,
  toStatus,
  eventTitle,
  isPending,
}: {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  fromStatus: EventStatus;
  toStatus: EventStatus;
  eventTitle: string;
  isPending: boolean;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (isOpen && !dialog.open) {
      dialog.showModal();
    } else if (!isOpen && dialog.open) {
      dialog.close();
    }
  }, [isOpen]);

  const description =
    TRANSITION_DESCRIPTIONS[`${fromStatus}-${toStatus}`] ?? "Are you sure?";
  const confirmLabel = CONFIRM_LABELS[toStatus] ?? "Confirm";
  return (
    <dialog
      ref={dialogRef}
      onClose={onClose}
      className="m-auto max-w-md rounded-300 border border-neutral-300 bg-neutral-0 p-500 shadow-panel backdrop:bg-neutral-950/40"
    >
      <div className="flex flex-col gap-300">
        <div>
          <h2 className="font-display text-h3 text-neutral-950">
            {confirmLabel}
          </h2>
          <p className="mt-100 text-body-sm text-neutral-600">
            <span className="font-semibold text-neutral-800">{eventTitle}</span>
          </p>
        </div>

        <p className="text-body text-neutral-800">{description}</p>

        <div className="flex gap-200 justify-end">
          <button
            type="button"
            onClick={onClose}
            disabled={isPending}
            className="rounded-200 border border-neutral-300 bg-neutral-0 px-300 py-200 text-body-sm text-neutral-600 transition-colors duration-fast hover:bg-neutral-100 hover:text-neutral-950 disabled:opacity-60"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isPending}
            className="rounded-200 bg-brand-calm-600 px-300 py-200 text-body-sm font-semibold text-neutral-0 transition-colors duration-fast hover:bg-brand-calm-600/90 disabled:opacity-60"
          >
            {isPending ? "Processing\u2026" : confirmLabel}
          </button>
        </div>
      </div>
    </dialog>
  );
}

export function DeleteEventModal({
  isOpen,
  onClose,
  onConfirm,
  eventTitle,
  isPending,
}: {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  eventTitle: string;
  isPending: boolean;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (isOpen && !dialog.open) {
      dialog.showModal();
    } else if (!isOpen && dialog.open) {
      dialog.close();
    }
  }, [isOpen]);

  return (
    <dialog
      ref={dialogRef}
      onClose={onClose}
      className="m-auto max-w-md rounded-300 border border-neutral-300 bg-neutral-0 p-500 shadow-panel backdrop:bg-neutral-950/40"
    >
      <div className="flex flex-col gap-300">
        <div>
          <h2 className="font-display text-h3 text-neutral-950">
            Delete event
          </h2>
          <p className="mt-100 text-body-sm text-neutral-600">
            <span className="font-semibold text-neutral-800">{eventTitle}</span>
          </p>
        </div>

        <p className="text-body text-neutral-800">
          This event will be removed from all views and sent for admin review
          before permanent deletion.
        </p>

        <div className="flex gap-200 justify-end">
          <button
            type="button"
            onClick={onClose}
            disabled={isPending}
            className="rounded-200 border border-neutral-300 bg-neutral-0 px-300 py-200 text-body-sm text-neutral-600 transition-colors duration-fast hover:bg-neutral-100 hover:text-neutral-950 disabled:opacity-60"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isPending}
            className="rounded-200 bg-semantic-error px-300 py-200 text-body-sm font-semibold text-neutral-0 transition-colors duration-fast hover:bg-semantic-error/90 disabled:opacity-60"
          >
            {isPending ? "Deleting\u2026" : "Delete event"}
          </button>
        </div>
      </div>
    </dialog>
  );
}
