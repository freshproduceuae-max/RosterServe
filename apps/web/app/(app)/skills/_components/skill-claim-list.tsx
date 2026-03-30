"use client";

import { useState, useTransition } from "react";
import { withdrawSkillClaim } from "@/lib/skills/actions";
import type { SkillClaimWithDepartment } from "@/lib/skills/types";
import { StatusBadge } from "./status-badge";

function ClaimRow({ claim }: { claim: SkillClaimWithDepartment }) {
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const isLegacy = claim.department_id === null;
  const skillLabel = isLegacy ? (claim.name ?? "Unnamed skill") : (claim.skill_name ?? claim.name);

  function handleWithdraw() {
    setError(null);
    startTransition(async () => {
      const result = await withdrawSkillClaim(claim.id);
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
          {skillLabel}
        </span>
        {isLegacy ? (
          <span className="text-body-sm text-neutral-500">
            Legacy — no department link
          </span>
        ) : (
          <span className="text-body-sm text-neutral-600">
            {claim.department_name}
          </span>
        )}
        <StatusBadge status={claim.status} />
        {error && (
          <span className="text-body-sm text-semantic-error">{error}</span>
        )}
      </div>
      {claim.status === "pending" && (
        <div className="flex items-center gap-200 self-start">
          {confirming ? (
            <>
              <span className="text-body-sm text-neutral-600">
                Withdraw this claim?
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

export function SkillClaimList({
  claims,
}: {
  claims: SkillClaimWithDepartment[];
}) {
  if (claims.length === 0) {
    return (
      <div className="rounded-200 border border-neutral-300 bg-neutral-0 p-400 text-center">
        <p className="text-body-sm text-neutral-600">
          You haven&apos;t claimed any skills yet.
        </p>
      </div>
    );
  }
  return (
    <ul className="flex flex-col gap-200">
      {claims.map((claim) => (
        <ClaimRow key={claim.id} claim={claim} />
      ))}
    </ul>
  );
}
