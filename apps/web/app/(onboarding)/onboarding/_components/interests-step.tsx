"use client";

import { useActionState, useEffect } from "react";
import { saveVolunteerInterests } from "@/lib/onboarding/actions";
import type { DepartmentForInterests, VolunteerInterest } from "@/lib/onboarding/types";
import { StepIndicator } from "./step-indicator";

interface InterestsStepProps {
  departments: DepartmentForInterests[];
  existing: VolunteerInterest[];
  onAdvance: () => void;
}

export function InterestsStep({ departments, existing, onAdvance }: InterestsStepProps) {
  const [state, formAction, isPending] = useActionState(
    saveVolunteerInterests,
    undefined
  );

  useEffect(() => {
    if (state && "success" in state) {
      onAdvance();
    }
  }, [state, onAdvance]);

  const existingDeptIds = new Set(existing.map((i) => i.department_id));

  return (
    <div className="mx-auto w-full max-w-md px-300 py-700">
      <div className="mb-400 text-center">
        <span className="font-display text-h3 text-neutral-950">RosterServe</span>
      </div>

      <StepIndicator currentStep={2} totalSteps={3} />

      <h1 className="mb-100 font-display text-h2 text-neutral-950">
        Where would you like to serve?
      </h1>
      <p className="mb-500 text-body text-neutral-600">
        Select any areas you&apos;re interested in. You can always update this later.
      </p>

      {departments.length === 0 ? (
        <div className="mb-500 rounded-300 border border-neutral-300 bg-neutral-0 p-400">
          <p className="text-body text-neutral-600">
            No serving areas are set up yet. You can come back and update your interests later.
          </p>
        </div>
      ) : (
        <form action={formAction} className="mb-400 flex flex-col gap-500">
          <div className="flex flex-col gap-200">
            {departments.map((dept) => (
              <label key={dept.id} className="flex cursor-pointer items-center gap-200">
                <input
                  type="checkbox"
                  name="department_id"
                  value={dept.id}
                  defaultChecked={existingDeptIds.has(dept.id)}
                  className="h-400 w-400 shrink-0 rounded-200 border-neutral-300 accent-brand-warm-500"
                />
                <span className="text-body text-neutral-950">{dept.name}</span>
              </label>
            ))}
          </div>

          {state && "error" in state && (
            <p className="text-body-sm text-semantic-error">{state.error}</p>
          )}

          <button
            type="submit"
            disabled={isPending}
            className="rounded-pill bg-brand-warm-500 px-500 py-200 text-body font-semibold text-neutral-950 transition-colors duration-fast hover:bg-brand-warm-500/90 disabled:opacity-50"
          >
            {isPending ? "Saving…" : "Save & Continue"}
          </button>
        </form>
      )}

      <button
        type="button"
        onClick={onAdvance}
        className="text-body-sm text-neutral-600 underline underline-offset-2 transition-colors duration-fast hover:text-neutral-950"
      >
        Skip for now
      </button>
    </div>
  );
}
