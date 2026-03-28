"use client";

import { useActionState } from "react";
import type { DepartmentActionResult } from "@/lib/departments/actions";
import type { Department, OwnerProfile } from "@/lib/departments/types";

interface DepartmentFormProps {
  eventId: string;
  ownerProfiles: OwnerProfile[];
  action: (
    prev: DepartmentActionResult,
    formData: FormData
  ) => Promise<DepartmentActionResult>;
  existing?: Department;
}

export function DepartmentForm({
  eventId,
  ownerProfiles,
  action,
  existing,
}: DepartmentFormProps) {
  const [state, formAction, isPending] = useActionState(action, undefined);
  const isEdit = !!existing;

  return (
    <form action={formAction} className="flex flex-col gap-400">
      <input type="hidden" name="eventId" value={eventId} />
      {isEdit && <input type="hidden" name="id" value={existing.id} />}

      {/* Name */}
      <div className="flex flex-col gap-100">
        <label htmlFor="name" className="text-label font-semibold text-neutral-950">
          Department name
        </label>
        <input
          id="name"
          name="name"
          type="text"
          required
          maxLength={100}
          defaultValue={existing?.name ?? ""}
          placeholder="e.g. Worship Team"
          className="rounded-200 border border-neutral-300 bg-neutral-0 px-300 py-200 text-body text-neutral-950 outline-none transition-colors duration-fast focus:border-brand-calm-600 focus:ring-2 focus:ring-brand-calm-600/20"
        />
      </div>

      {/* Owner */}
      <div className="flex flex-col gap-100">
        <label htmlFor="ownerId" className="text-label font-semibold text-neutral-950">
          Department head <span className="font-normal text-neutral-600">(optional)</span>
        </label>
        <select
          id="ownerId"
          name="ownerId"
          defaultValue={existing?.owner_id ?? ""}
          className="rounded-200 border border-neutral-300 bg-neutral-0 px-300 py-200 text-body text-neutral-950 outline-none transition-colors duration-fast focus:border-brand-calm-600 focus:ring-2 focus:ring-brand-calm-600/20"
        >
          <option value="">No owner assigned</option>
          {ownerProfiles.map((p) => (
            <option key={p.id} value={p.id}>
              {p.display_name}
            </option>
          ))}
        </select>
      </div>

      {/* Error */}
      {state && "error" in state && (
        <p className="text-body-sm text-semantic-error">{state.error}</p>
      )}

      {/* Actions */}
      <div className="flex gap-200">
        <button
          type="submit"
          disabled={isPending}
          className="rounded-200 bg-brand-calm-600 px-400 py-200 text-body font-semibold text-neutral-0 transition-colors duration-fast hover:bg-brand-calm-600/90 disabled:opacity-50"
        >
          {isPending ? "Saving…" : isEdit ? "Save changes" : "Create department"}
        </button>
      </div>
    </form>
  );
}
