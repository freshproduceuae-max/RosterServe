"use client";

import { useActionState, startTransition, useEffect } from "react";
import type { DepartmentActionResult } from "@/lib/departments/actions";

interface DeleteConfirmModalProps {
  entityName: string;
  consequenceText: string;
  hiddenFields: Record<string, string>;
  action: (prev: DepartmentActionResult, fd: FormData) => Promise<DepartmentActionResult>;
  onCancel: () => void;
}

export function DeleteConfirmModal({
  entityName,
  consequenceText,
  hiddenFields,
  action,
  onCancel,
}: DeleteConfirmModalProps) {
  const [state, dispatch, isPending] = useActionState(action, undefined);

  // Close modal on success (redirect() is the normal path, but guard against
  // edge cases where success is returned without a redirect)
  useEffect(() => {
    if (state && "success" in state) onCancel();
  }, [state, onCancel]);

  function handleConfirm() {
    const fd = new FormData();
    for (const [key, value] of Object.entries(hiddenFields)) {
      fd.set(key, value);
    }
    startTransition(() => dispatch(fd));
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-neutral-950/40 p-400">
      <div className="w-full max-w-md rounded-300 border border-neutral-300 bg-neutral-0 p-500 shadow-lg">
        <h2 className="font-display text-h3 text-neutral-950">
          Delete {entityName}?
        </h2>
        <p className="mt-200 text-body text-neutral-700">{consequenceText}</p>
        {state && "error" in state && (
          <p className="mt-200 text-body-sm text-semantic-error">{state.error}</p>
        )}
        <div className="mt-400 flex gap-200">
          <button
            type="button"
            onClick={onCancel}
            disabled={isPending}
            className="rounded-200 border border-neutral-300 bg-neutral-0 px-400 py-200 text-body text-neutral-700 transition-colors duration-fast hover:bg-neutral-100 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={isPending}
            className="rounded-200 bg-semantic-error px-400 py-200 text-body font-semibold text-neutral-0 transition-colors duration-fast hover:bg-semantic-error/90 disabled:opacity-50"
          >
            {isPending ? "Deleting…" : "Delete"}
          </button>
        </div>
      </div>
    </div>
  );
}
