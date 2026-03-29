import type { AvailabilityBlockout } from "@/lib/availability/types";
import type { AvailabilityPreferences } from "@/lib/onboarding/types";
import { BlockoutList } from "./blockout-list";
import { AddBlockoutForm } from "./add-blockout-form";

const DAY_LABELS: Record<string, string> = {
  monday: "Mon",
  tuesday: "Tue",
  wednesday: "Wed",
  thursday: "Thu",
  friday: "Fri",
  saturday: "Sat",
  sunday: "Sun",
};

const TIME_LABELS: Record<string, string> = {
  morning: "Mornings",
  afternoon: "Afternoons",
  evening: "Evenings",
};

export function VolunteerAvailabilityView({
  blockouts,
  preferences,
}: {
  blockouts: AvailabilityBlockout[];
  preferences: AvailabilityPreferences | null;
}) {
  const hasDays = (preferences?.preferred_days?.length ?? 0) > 0;
  const hasTimes = (preferences?.preferred_times?.length ?? 0) > 0;
  const hasPreferences = hasDays || hasTimes;

  return (
    <div className="flex flex-col gap-500">
      <div>
        <h1 className="text-h1 text-neutral-950">Your availability</h1>
        <p className="mt-100 text-body-sm text-neutral-600">
          Record dates when you cannot serve so leaders can plan around you.
        </p>
      </div>

      {hasPreferences && (
        <div className="rounded-200 border border-neutral-300 bg-neutral-0 p-300">
          <p className="text-label uppercase text-neutral-600">General preferences</p>
          <div className="mt-200 flex flex-wrap gap-100">
            {hasDays &&
              preferences!.preferred_days.map((day) => (
                <span
                  key={day}
                  className="rounded-200 bg-surface-warm px-200 py-50 text-body-sm text-neutral-800"
                >
                  {DAY_LABELS[day] ?? day}
                </span>
              ))}
            {hasTimes &&
              preferences!.preferred_times.map((time) => (
                <span
                  key={time}
                  className="rounded-200 bg-surface-warm px-200 py-50 text-body-sm text-neutral-800"
                >
                  {TIME_LABELS[time] ?? time}
                </span>
              ))}
          </div>
          <p className="mt-200 text-body-sm text-neutral-600">
            Update your general preferences from your profile settings.
          </p>
        </div>
      )}

      <div className="flex flex-col gap-300">
        <h2 className="text-h2 text-neutral-950">Blockout dates</h2>
        <BlockoutList blockouts={blockouts} />
      </div>

      <div className="rounded-300 border border-neutral-300 bg-neutral-0 p-400">
        <AddBlockoutForm />
      </div>
    </div>
  );
}
