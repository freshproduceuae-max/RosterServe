"use client";

import { useActionState, useRef } from "react";
import type { DepartmentActionResult } from "@/lib/departments/actions";

interface DeleteConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  entityName: string;
  consequenceText: string;
  action: (
    prev: DepartmentActionResult,
    formData: FormData
  ) => Promise<DepartmentActionResult>;
  hiddenFields: Record<string, string>;
}

export function DeleteConfirmModal({
  isOpen,
  onClose,
  entityName,
  consequenceText,
  action,
  hiddenFields,
}: DeleteConfirmModalProps) {
  const [state, formAction, isPending] = useActionState(action, undefined);
  const formRef = useRef<HTMLFormElement>(null);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-neutral-950/40 px-300">
      <div className="w-full max-w-md rounded-300 border border-neutral-300 bg-neutral-0 p-500 shadow-sm">
        <h2 className="font-display text-h3 text-neutral-950">
          Delete {entityName}?
        </h2>
        <p className="mt-200 text-body text-neutral-600">{consequenceText}</p>

        {state && "error" in state && (
          <p className="mt-300 text-body-sm text-semantic-error">{state.error}</p>
        )}

        <form ref={formRef} action={formAction} className="mt-400 flex gap-200">
          {Object.entries(hiddenFields).map(([name, value]) => (
            <input key={name} type="hidden" name={name} value={value} />
          ))}
          <button
            type="submit"
            disabled={isPending}
            className="rounded-200 bg-semantic-error px-400 py-200 text-body font-semibold text-neutral-0 transition-colors duration-fast hover:bg-semantic-error/90 disabled:opacity-50"
          >
            {isPending ? `Deleting ${entityName}…` : `Delete ${entityName}`}
          </button>
          <button
            type="button"
            onClick={onClose}
            disabled={isPending}
            className="rounded-200 border border-neutral-300 bg-neutral-0 px-400 py-200 text-body text-neutral-600 transition-colors duration-fast hover:bg-neutral-100 hover:text-neutral-950 disabled:opacity-50"
          >
            Cancel
          </button>
        </form>
      </div>
    </div>
  );
}
