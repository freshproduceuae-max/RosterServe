"use client";

import { useState, useTransition } from "react";
import type { SkillClaimWithVolunteer } from "@/lib/skills/types";
import { approveSkillClaim, rejectSkillClaim } from "@/lib/skills/actions";
import { StatusBadge } from "./status-badge";
import { formatLongDate } from "@/lib/format-date";

function ActionControls({ claimId }: { claimId: string }) {
  const [rejecting, setRejecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleApprove() {
    setError(null);
    startTransition(async () => {
      const result = await approveSkillClaim(claimId);
      if (result?.error) setError(result.error);
    });
  }

  function handleReject() {
    setError(null);
    startTransition(async () => {
      const result = await rejectSkillClaim(claimId);
      if (result?.error) setError(result.error);
      else setRejecting(false);
    });
  }

  return (
    <div className="flex flex-col gap-100">
      {rejecting ? (
        <div className="flex items-center gap-200">
          <span className="text-body-sm text-neutral-600">
            Reject this claim?
          </span>
          <button
            onClick={handleReject}
            disabled={isPending}
            className="text-body-sm font-semibold text-semantic-error underline underline-offset-2 transition-opacity duration-fast hover:opacity-70 disabled:opacity-50"
          >
            {isPending ? "Rejecting…" : "Confirm"}
          </button>
          <button
            onClick={() => setRejecting(false)}
            disabled={isPending}
            className="text-body-sm text-neutral-600 underline underline-offset-2 transition-colors duration-fast hover:text-neutral-950 disabled:opacity-50"
          >
            Cancel
          </button>
        </div>
      ) : (
        <div className="flex items-center gap-200">
          <button
            onClick={handleApprove}
            disabled={isPending}
            className="rounded-200 bg-brand-calm-600 px-300 py-150 text-body-sm font-semibold text-neutral-0 transition-colors duration-fast hover:bg-brand-calm-600/90 disabled:opacity-50"
          >
            {isPending ? "Saving…" : "Approve"}
          </button>
          <button
            onClick={() => setRejecting(true)}
            disabled={isPending}
            className="rounded-200 border border-neutral-300 px-300 py-150 text-body-sm text-neutral-700 transition-colors duration-fast hover:border-neutral-400 hover:text-neutral-950 disabled:opacity-50"
          >
            Reject
          </button>
        </div>
      )}
      {error && <p className="text-body-sm text-semantic-error">{error}</p>}
    </div>
  );
}

export function SkillClaimCard({
  claim,
  readOnly = false,
}: {
  claim: SkillClaimWithVolunteer;
  readOnly?: boolean;
}) {
  return (
    <div className="flex flex-col gap-200 rounded-200 border border-neutral-300 bg-neutral-0 p-300">
      <div className="flex items-start justify-between gap-200">
        <div className="flex flex-col gap-50">
          <span className="text-body font-semibold text-neutral-950">
            {claim.volunteer_display_name}
          </span>
          <span className="text-body-sm text-neutral-600">
            {claim.skill_name}
          </span>
          <span className="text-body-sm text-neutral-600">
            {claim.department_name}
          </span>
        </div>
        <StatusBadge status={claim.status} />
      </div>
      <p className="text-body-sm text-neutral-600">
        Claimed {formatLongDate(claim.created_at)}
      </p>
      {!readOnly && claim.status === "pending" && (
        <ActionControls claimId={claim.id} />
      )}
    </div>
  );
}
