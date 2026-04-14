import type { AppRole } from "@/lib/auth/types";
import type { AvailabilityBlockout, VolunteerInScope } from "@/lib/availability/types";
import { VolunteerBlockoutCard } from "./volunteer-blockout-card";

export function LeaderAvailabilityView({
  volunteersInScope,
  blockouts,
  role,
}: {
  volunteersInScope: VolunteerInScope[];
  blockouts: AvailabilityBlockout[];
  role: AppRole;
}) {
  const subtitle =
    role === "team_head"
      ? "Showing blockout dates for volunteers in your teams."
      : "Showing blockout dates for volunteers in your departments.";

  if (volunteersInScope.length === 0) {
    return (
      <div className="flex flex-col gap-500">
        <div>
          <h1 className="text-h1 text-neutral-950">Volunteer availability</h1>
          <p className="mt-100 text-body-sm text-neutral-600">{subtitle}</p>
        </div>
        <div className="rounded-300 border border-neutral-300 bg-neutral-0 p-500 text-center">
          <p className="text-h3 text-neutral-950">No volunteers in scope</p>
          <p className="mt-200 text-body-sm text-neutral-600">
            No volunteers have expressed interest in your departments yet.
          </p>
        </div>
      </div>
    );
  }

  // Deduplicate volunteers by id; keep the first department name found
  const volunteerMap = new Map<string, { displayName: string; departmentName: string }>();
  for (const v of volunteersInScope) {
    if (!volunteerMap.has(v.id)) {
      volunteerMap.set(v.id, {
        displayName: v.display_name,
        departmentName: v.department_name,
      });
    }
  }

  // Index blockouts by volunteer_id
  const blockoutsByVolunteer = new Map<string, AvailabilityBlockout[]>();
  for (const b of blockouts) {
    const existing = blockoutsByVolunteer.get(b.volunteer_id) ?? [];
    blockoutsByVolunteer.set(b.volunteer_id, [...existing, b]);
  }

  const volunteerEntries = Array.from(volunteerMap.entries()).sort(([, a], [, b]) =>
    a.displayName.localeCompare(b.displayName)
  );

  return (
    <div className="flex flex-col gap-500">
      <div>
        <h1 className="text-h1 text-neutral-950">Volunteer availability</h1>
        <p className="mt-100 text-body-sm text-neutral-600">{subtitle}</p>
      </div>

      <div className="grid gap-300 sm:grid-cols-2 lg:grid-cols-3">
        {volunteerEntries.map(([volunteerId, { displayName, departmentName }]) => (
          <VolunteerBlockoutCard
            key={volunteerId}
            displayName={displayName}
            departmentName={departmentName}
            blockouts={blockoutsByVolunteer.get(volunteerId) ?? []}
          />
        ))}
      </div>
    </div>
  );
}
