"use client";

import { useState, useTransition } from "react";
import { sendBugReport } from "@/lib/support/actions";

export function BugReportForm() {
  const [open, setOpen] = useState(false);
  const [description, setDescription] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    startTransition(async () => {
      const result = await sendBugReport(description);
      if (result.error) {
        setFormError(result.error);
      } else {
        setSubmitted(true);
        setDescription("");
      }
    });
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="text-body-sm text-neutral-500 underline underline-offset-2 hover:text-neutral-950"
      >
        Report a bug
      </button>
    );
  }

  if (submitted) {
    return (
      <div className="rounded-200 border border-neutral-200 bg-neutral-50 px-300 py-200">
        <p className="text-body-sm text-neutral-700">
          Thanks — your report has been sent.
        </p>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col gap-200 rounded-200 border border-neutral-200 bg-neutral-50 px-300 py-300"
    >
      <p className="text-body-sm font-semibold text-neutral-950">
        Describe what went wrong
      </p>
      <textarea
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder="What were you trying to do? What happened instead?"
        rows={4}
        maxLength={2000}
        className="rounded-200 border border-neutral-300 bg-neutral-0 px-300 py-200 text-body-sm text-neutral-950 placeholder:text-neutral-400 focus:border-neutral-950 focus:outline-none"
      />
      {formError && (
        <p className="text-body-sm text-semantic-error">{formError}</p>
      )}
      <div className="flex items-center gap-200">
        <button
          type="submit"
          disabled={isPending || !description.trim()}
          className="rounded-200 bg-neutral-950 px-300 py-150 text-body-sm font-semibold text-neutral-0 transition-opacity duration-fast hover:opacity-80 disabled:opacity-50"
        >
          {isPending ? "Sending…" : "Send report"}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="text-body-sm text-neutral-500 hover:text-neutral-950"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
