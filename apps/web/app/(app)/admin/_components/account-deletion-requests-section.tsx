"use client";

import { useTransition, useState } from "react";
import { approveAccountDeletion, rejectAccountDeletion } from "@/lib/actions/account";
import type { AccountDeletionRequest } from "@/lib/admin/queries";

export function AccountDeletionRequestsSection({
  requests,
}: {
  requests: AccountDeletionRequest[];
}) {
  return (
    <section className="flex flex-col gap-300">
      <div>
        <h2 className="font-display text-h2 text-neutral-950">Account deletion requests</h2>
        <p className="mt-100 text-body-sm text-neutral-600">
          Users who have requested their account be deleted. Approve to permanently remove
          all their data, or reject to restore their account.
        </p>
      </div>

      {requests.length === 0 ? (
        <p className="text-body-sm text-neutral-500">No pending deletion requests.</p>
      ) : (
        <div className="flex flex-col gap-200">
          {requests.map((req) => (
            <DeletionRequestRow key={req.id} request={req} />
          ))}
        </div>
      )}
    </section>
  );
}

function DeletionRequestRow({ request }: { request: AccountDeletionRequest }) {
  const [isPending, startTransition] = useTransition();
  const [action, setAction] = useState<"approve" | "reject" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  if (done) {
    return (
      <div className="rounded-200 border border-neutral-200 bg-neutral-0 px-300 py-250">
        <p className="text-body-sm text-neutral-500">Request processed.</p>
      </div>
    );
  }

  function handleAction(type: "approve" | "reject") {
    setError(null);
    setAction(type);
    startTransition(async () => {
      const result =
        type === "approve"
          ? await approveAccountDeletion(request.userId, request.id)
          : await rejectAccountDeletion(request.userId, request.id);

      if (result.error) {
        setError(result.error);
        setAction(null);
      } else {
        setDone(true);
      }
    });
  }

  return (
    <div className="flex items-center justify-between gap-300 rounded-200 border border-neutral-200 bg-neutral-0 px-300 py-250">
      <div className="flex flex-col gap-50">
        <p className="text-body-sm font-semibold text-neutral-950">{request.userName}</p>
        <p className="text-label text-neutral-500">
          Requested {new Date(request.requestedAt).toLocaleDateString()}
        </p>
        {error && <p className="text-label text-semantic-error">{error}</p>}
      </div>

      <div className="flex items-center gap-200 shrink-0">
        <button
          onClick={() => handleAction("reject")}
          disabled={isPending}
          className="rounded-200 border border-neutral-300 bg-neutral-0 px-300 py-150 text-body-sm font-medium text-neutral-700 transition-colors duration-fast hover:border-neutral-400 disabled:opacity-50"
        >
          {action === "reject" && isPending ? "Rejecting…" : "Reject"}
        </button>
        <button
          onClick={() => handleAction("approve")}
          disabled={isPending}
          className="rounded-200 bg-semantic-error px-300 py-150 text-body-sm font-semibold text-neutral-0 transition-opacity duration-fast hover:opacity-90 disabled:opacity-50"
        >
          {action === "approve" && isPending ? "Deleting…" : "Approve & delete"}
        </button>
      </div>
    </div>
  );
}
