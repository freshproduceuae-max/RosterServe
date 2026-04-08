"use client";

import { useState, useTransition } from "react";
import { withdrawInterest } from "@/lib/interests/actions";
import type { InterestWithDepartment, InterestStatus } from "@/lib/interests/types";

function StatusBadge({ status }: { status: InterestStatus }) {
  const styles = {
    pending:
      "bg-semantic-warning/10 text-semantic-warning border border-semantic-warning/20",
    approved:
      "bg-semantic-success/10 text-semantic-success border border-semantic-success/20",
    rejected:
      "bg-semantic-error/10 text-semantic-error border border-semantic-error/20",
  };
  const labels = {
    pending: "Pending review",
    approved: "Approved",
    rejected: "Rejected",
  };
  return (
    <span
      className={`inline-flex items-center rounded-full px-200 py-50 text-body-sm font-medium ${styles[status]}`}
    >
      {labels[status]}
    </span>
  );
}

function InterestRow({ interest }: { interest: InterestWithDepartment }) {
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleWithdraw() {
    setError(null);
    startTransition(async () => {
      const result = await withdrawInterest(interest.id);
      if (result?.error) {
        setError(result.error);
        setConfirming(false);
      }
    });
  }

  return (
    <li className="flex flex-col gap-100 rounded-200 border border-neutral-300 bg-neutral-0 p-300 sm:flex-row sm:items-start sm:justify-between">
      <div className="flex flex-col gap-50">
        <span className="text-body font-semibold text-neutral-950">
          {interest.department_name}
        </span>
        <StatusBadge status={interest.status} />
        {error && (
          <span className="text-body-sm text-semantic-error">{error}</span>
        )}
      </div>

      {interest.status === "pending" && (
        <div className="flex items-center gap-200 self-start">
          {confirming ? (
            <>
              <span className="text-body-sm text-neutral-600">
                Withdraw this request?
              </span>
              <button
                onClick={handleWithdraw}
                disabled={isPending}
                className="text-body-sm font-semibold text-semantic-error underline underline-offset-2 transition-opacity duration-fast hover:opacity-70 disabled:opacity-50"
              >
                {isPending ? "Withdrawing…" : "Confirm"}
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
              Withdraw
            </button>
          )}
        </div>
      )}
    </li>
  );
}

export function InterestStatusList({
  interests,
}: {
  interests: InterestWithDepartment[];
}) {
  if (interests.length === 0) {
    return (
      <div className="rounded-200 border border-neutral-300 bg-neutral-0 p-400 text-center">
        <p className="text-body-sm text-neutral-600">
          You have not submitted any interest requests yet.
        </p>
      </div>
    );
  }

  return (
    <ul className="flex flex-col gap-200">
      {interests.map((interest) => (
        <InterestRow key={interest.id} interest={interest} />
      ))}
    </ul>
  );
}
