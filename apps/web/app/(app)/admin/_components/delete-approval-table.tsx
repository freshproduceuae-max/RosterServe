"use client";

import { useTransition, useState } from "react";
import { restoreRecord, hardDeleteRecord } from "@/lib/admin/actions";
import type { SoftDeletedEntity } from "@/lib/admin/queries";

interface DeleteApprovalTableProps {
  records: SoftDeletedEntity[];
  sectionTitle: string;
}

export function DeleteApprovalTable({
  records,
  sectionTitle,
}: DeleteApprovalTableProps) {
  const [isPending, startTransition] = useTransition();
  const [actionError, setActionError] = useState<string | null>(null);

  if (records.length === 0) return null;

  function handleRestore(kind: SoftDeletedEntity["kind"], id: string) {
    setActionError(null);
    startTransition(async () => {
      const result = await restoreRecord(kind, id);
      if (result.error) setActionError(result.error);
    });
  }

  function handleHardDelete(kind: SoftDeletedEntity["kind"], id: string, name: string) {
    if (
      !window.confirm(
        `Permanently delete "${name}"? This cannot be undone and will remove all associated data.`,
      )
    ) {
      return;
    }
    setActionError(null);
    startTransition(async () => {
      const result = await hardDeleteRecord(kind, id);
      if (result.error) setActionError(result.error);
    });
  }

  return (
    <section className="flex flex-col gap-200">
      <h2 className="font-display text-h2 text-neutral-950">{sectionTitle}</h2>
      {actionError && (
        <p className="text-body-sm text-semantic-error">{actionError}</p>
      )}
      <div className="flex flex-col gap-150">
        {records.map((record) => (
          <div
            key={record.id}
            className="flex items-center justify-between gap-200 rounded-200 border border-neutral-200 bg-neutral-0 px-300 py-200"
          >
            <div className="flex flex-col gap-100">
              <p className="text-body-sm font-medium text-neutral-950">
                {record.name}
              </p>
              {"departmentName" in record && (
                <p className="text-body-sm text-neutral-500">
                  {record.departmentName}
                </p>
              )}
              <p className="text-body-sm text-neutral-400">
                Deleted{" "}
                {new Date(record.deletedAt).toLocaleDateString("en-GB", {
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                })}
              </p>
            </div>
            <div className="flex items-center gap-200">
              <button
                onClick={() => handleRestore(record.kind, record.id)}
                disabled={isPending}
                className="rounded-200 border border-neutral-300 bg-neutral-0 px-300 py-150 text-body-sm font-semibold text-neutral-950 transition-opacity duration-fast hover:opacity-80 disabled:opacity-50"
              >
                Restore
              </button>
              <button
                onClick={() => handleHardDelete(record.kind, record.id, record.name)}
                disabled={isPending}
                className="rounded-200 bg-semantic-error px-300 py-150 text-body-sm font-semibold text-neutral-0 transition-opacity duration-fast hover:opacity-80 disabled:opacity-50"
              >
                Delete permanently
              </button>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
