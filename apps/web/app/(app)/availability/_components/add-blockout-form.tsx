"use client";

import { useActionState } from "react";
import { addBlockout } from "@/lib/availability/actions";

type State = { error?: string; success?: boolean } | null;

export function AddBlockoutForm() {
  const [state, formAction, isPending] = useActionState<State, FormData>(addBlockout, null);

  return (
    <form action={formAction} className="flex flex-col gap-300">
      <h2 className="text-h3 text-neutral-950">Add a blockout</h2>
      <p className="text-body-sm text-neutral-600">
        Record a date when you cannot serve. You can always remove it later.
      </p>

      <div className="flex flex-col gap-100">
        <label htmlFor="blockout-date" className="text-label text-neutral-800">
          Date
        </label>
        <input
          id="blockout-date"
          name="date"
          type="date"
          required
          disabled={isPending}
          className="rounded-200 border border-neutral-300 bg-neutral-0 px-300 py-200 text-body text-neutral-950 focus:border-brand-calm-600 focus:outline-none focus:ring-2 focus:ring-brand-calm-600/20 disabled:opacity-50"
        />
        {state?.error && (
          <p className="text-body-sm text-semantic-error">{state.error}</p>
        )}
      </div>

      <div className="flex flex-col gap-100">
        <label htmlFor="blockout-reason" className="text-label text-neutral-800">
          Reason{" "}
          <span className="font-normal text-neutral-600">(optional)</span>
        </label>
        <textarea
          id="blockout-reason"
          name="reason"
          rows={2}
          maxLength={200}
          disabled={isPending}
          placeholder="e.g. Away on holiday"
          className="rounded-200 border border-neutral-300 bg-neutral-0 px-300 py-200 text-body text-neutral-950 placeholder:text-neutral-600 focus:border-brand-calm-600 focus:outline-none focus:ring-2 focus:ring-brand-calm-600/20 disabled:opacity-50"
        />
      </div>

      <button
        type="submit"
        disabled={isPending}
        className="self-start rounded-200 bg-brand-calm-600 px-400 py-200 text-body font-semibold text-neutral-0 transition-colors duration-fast hover:bg-brand-calm-600/90 disabled:opacity-50"
      >
        {isPending ? "Saving…" : "Add blockout"}
      </button>
    </form>
  );
}
