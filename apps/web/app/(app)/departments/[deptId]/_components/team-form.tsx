"use client";

import { useActionState, startTransition } from "react";
import type { DepartmentActionResult } from "@/lib/departments/actions";
import type { OwnerProfile, Team } from "@/lib/departments/types";

interface TeamFormProps {
  mode: "create" | "edit";
  departmentId: string;
  existing?: Team;
  teamHeadProfiles: OwnerProfile[];
  action: (prev: DepartmentActionResult, fd: FormData) => Promise<DepartmentActionResult>;
}

export function TeamForm({
  mode,
  departmentId,
  existing,
  teamHeadProfiles,
  action,
}: TeamFormProps) {
  const [state, dispatch, isPending] = useActionState(action, undefined);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    startTransition(() => dispatch(fd));
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-400 max-w-lg">
      <input type="hidden" name="departmentId" value={departmentId} />
      {existing && <input type="hidden" name="id" value={existing.id} />}

      <div className="flex flex-col gap-100">
        <label htmlFor="name" className="text-body font-semibold text-neutral-950">
          Team name
        </label>
        <input
          id="name"
          name="name"
          type="text"
          defaultValue={existing?.name ?? ""}
          required
          maxLength={100}
          className="rounded-200 border border-neutral-300 bg-neutral-0 px-300 py-200 text-body text-neutral-950 focus:border-brand-calm-600 focus:outline-none"
          placeholder="e.g. Production Team"
        />
      </div>

      <div className="flex flex-col gap-100">
        <label htmlFor="rotationLabel" className="text-body font-semibold text-neutral-950">
          Rotation label (optional)
        </label>
        <select
          id="rotationLabel"
          name="rotationLabel"
          defaultValue={existing?.rotation_label ?? ""}
          className="rounded-200 border border-neutral-300 bg-neutral-0 px-300 py-200 text-body text-neutral-950 focus:border-brand-calm-600 focus:outline-none"
        >
          <option value="">No rotation label</option>
          <option value="A">A</option>
          <option value="B">B</option>
          <option value="C">C</option>
        </select>
        <p className="text-body-sm text-neutral-600">
          Used for automatic rotation scheduling across events.
        </p>
      </div>

      <div className="flex flex-col gap-100">
        <label htmlFor="ownerId" className="text-body font-semibold text-neutral-950">
          Team Head (optional)
        </label>
        <select
          id="ownerId"
          name="ownerId"
          defaultValue={existing?.owner_id ?? ""}
          className="rounded-200 border border-neutral-300 bg-neutral-0 px-300 py-200 text-body text-neutral-950 focus:border-brand-calm-600 focus:outline-none"
        >
          <option value="">No Team Head assigned</option>
          {teamHeadProfiles.map((p) => (
            <option key={p.id} value={p.id}>
              {p.display_name}
            </option>
          ))}
        </select>
      </div>

      {state && "error" in state && (
        <p className="text-body-sm text-semantic-error">{state.error}</p>
      )}

      <div className="flex gap-200">
        <button
          type="submit"
          disabled={isPending}
          className="rounded-200 bg-brand-calm-600 px-400 py-200 text-body font-semibold text-neutral-0 transition-colors duration-fast hover:bg-brand-calm-600/90 disabled:opacity-50"
        >
          {isPending ? "Saving…" : mode === "create" ? "Create team" : "Save changes"}
        </button>
      </div>
    </form>
  );
}
