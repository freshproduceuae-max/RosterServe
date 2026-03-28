"use client";

import { useActionState, useEffect } from "react";
import { saveAvailabilityPreferences } from "@/lib/onboarding/actions";
import { DAYS, TIMES } from "@/lib/onboarding/schemas";
import type { AvailabilityPreferences } from "@/lib/onboarding/types";
import { StepIndicator } from "./step-indicator";

const DAY_LABELS: Record<(typeof DAYS)[number], string> = {
  monday: "Monday",
  tuesday: "Tuesday",
  wednesday: "Wednesday",
  thursday: "Thursday",
  friday: "Friday",
  saturday: "Saturday",
  sunday: "Sunday",
};

const TIME_LABELS: Record<(typeof TIMES)[number], string> = {
  morning: "Morning",
  afternoon: "Afternoon",
  evening: "Evening",
};

interface AvailabilityStepProps {
  existing: AvailabilityPreferences | null;
  onAdvance: () => void;
}

export function AvailabilityStep({ existing, onAdvance }: AvailabilityStepProps) {
  const [state, formAction, isPending] = useActionState(
    saveAvailabilityPreferences,
    undefined
  );

  useEffect(() => {
    if (state && "success" in state) {
      onAdvance();
    }
  }, [state, onAdvance]);

  return (
    <div className="mx-auto w-full max-w-md px-300 py-700">
      <div className="mb-400 text-center">
        <span className="font-display text-h3 text-neutral-950">RosterServe</span>
      </div>

      <StepIndicator currentStep={1} totalSteps={3} />

      <h1 className="mb-100 font-display text-h2 text-neutral-950">
        When are you available?
      </h1>
      <p className="mb-500 text-body text-neutral-600">
        When are you generally available to serve? You can always update this later.
      </p>

      <form action={formAction} className="flex flex-col gap-500">
        <fieldset>
          <legend className="mb-200 text-label font-semibold text-neutral-950">
            PREFERRED DAYS
          </legend>
          <div className="flex flex-col gap-200">
            {DAYS.map((day) => (
              <label key={day} className="flex cursor-pointer items-center gap-200">
                <input
                  type="checkbox"
                  name="preferred_days"
                  value={day}
                  defaultChecked={existing?.preferred_days.includes(day) ?? false}
                  className="h-400 w-400 rounded-200 border-neutral-300 accent-brand-warm-500"
                />
                <span className="text-body text-neutral-950">{DAY_LABELS[day]}</span>
              </label>
            ))}
          </div>
        </fieldset>

        <fieldset>
          <legend className="mb-200 text-label font-semibold text-neutral-950">
            PREFERRED TIMES
          </legend>
          <div className="flex flex-col gap-200">
            {TIMES.map((time) => (
              <label key={time} className="flex cursor-pointer items-center gap-200">
                <input
                  type="checkbox"
                  name="preferred_times"
                  value={time}
                  defaultChecked={existing?.preferred_times.includes(time) ?? false}
                  className="h-400 w-400 rounded-200 border-neutral-300 accent-brand-warm-500"
                />
                <span className="text-body text-neutral-950">{TIME_LABELS[time]}</span>
              </label>
            ))}
          </div>
        </fieldset>

        {state && "error" in state && (
          <p className="text-body-sm text-semantic-error">{state.error}</p>
        )}

        <button
          type="submit"
          disabled={isPending}
          className="rounded-pill bg-brand-warm-500 px-500 py-200 text-body font-semibold text-neutral-950 transition-colors duration-fast hover:bg-brand-warm-500/90 disabled:opacity-50"
        >
          {isPending ? "Saving…" : "Next"}
        </button>
      </form>
    </div>
  );
}
