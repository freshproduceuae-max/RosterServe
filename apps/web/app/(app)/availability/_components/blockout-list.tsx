"use client";

import { useState, useTransition } from "react";
import { removeBlockout } from "@/lib/availability/actions";
import type { AvailabilityBlockout } from "@/lib/availability/types";
import { formatMediumDate } from "@/lib/format-date";

function BlockoutRow({ blockout }: { blockout: AvailabilityBlockout }) {
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleRemove() {
    setError(null);
    startTransition(async () => {
      const result = await removeBlockout(blockout.id);
      if (result?.error) {
        setError(result.error);
        setConfirming(false);
      }
    });
  }

  return (
    <li className="flex flex-col gap-100 rounded-200 border border-neutral-300 bg-neutral-0 p-300 sm:flex-row sm:items-start sm:justify-between">
      <div className="flex flex-col gap-50">
        <span className="font-mono text-mono text-neutral-950">
          {formatMediumDate(blockout.date)}
        </span>
        {blockout.reason && (
          <span className="text-body-sm text-neutral-600">{blockout.reason}</span>
        )}
        {error && <span className="text-body-sm text-semantic-error">{error}</span>}
      </div>

      <div className="flex items-center gap-200 self-start">
        {confirming ? (
          <>
            <span className="text-body-sm text-neutral-600">Remove this blockout?</span>
            <button
              onClick={handleRemove}
              disabled={isPending}
              className="text-body-sm font-semibold text-semantic-error underline underline-offset-2 transition-opacity duration-fast hover:opacity-70 disabled:opacity-50"
            >
              {isPending ? "Removing…" : "Confirm"}
            </button>
            <button
              onClick={() => setConfirming(false)}
              disabled={isPending}
              className="text-body-sm text-neutral-600 underline underline-offset-2 transition-opacity duration-fast hover:opacity-70 disabled:opacity-50"
            >
              Cancel
            </button>
          </>
        ) : (
          <button
            onClick={() => setConfirming(true)}
            className="text-body-sm text-neutral-600 underline underline-offset-2 transition-colors duration-fast hover:text-neutral-950"
          >
            Remove
          </button>
        )}
      </div>
    </li>
  );
}

export function BlockoutList({ blockouts }: { blockouts: AvailabilityBlockout[] }) {
  if (blockouts.length === 0) {
    return (
      <div className="rounded-200 border border-neutral-300 bg-neutral-0 p-400 text-center">
        <p className="text-body-sm text-neutral-600">
          No blockouts yet — add a date below when you cannot serve.
        </p>
      </div>
    );
  }

  return (
    <ul className="flex flex-col gap-200">
      {blockouts.map((b) => (
        <BlockoutRow key={b.id} blockout={b} />
      ))}
    </ul>
  );
}
