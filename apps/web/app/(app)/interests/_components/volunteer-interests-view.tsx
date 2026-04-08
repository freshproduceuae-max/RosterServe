"use client";

import type {
  InterestWithDepartment,
  DepartmentForInterestSubmit,
} from "@/lib/interests/types";
import type { MemberWithDepartment } from "@/lib/memberships/types";
import { InterestStatusList } from "./interest-status-list";
import { SubmitInterestForm } from "./submit-interest-form";

function MembershipList({ memberships }: { memberships: MemberWithDepartment[] }) {
  if (memberships.length === 0) return null;
  return (
    <ul className="flex flex-col gap-200">
      {memberships.map((m) => (
        <li
          key={m.id}
          className="flex flex-col gap-50 rounded-200 border border-neutral-300 bg-neutral-0 p-300"
        >
          <span className="text-body font-semibold text-neutral-950">
            {m.department_name}
          </span>
          {m.team_name ? (
            <span className="text-body-sm text-neutral-600">Team: {m.team_name}</span>
          ) : (
            <span className="text-body-sm text-neutral-600">Department level</span>
          )}
          <span className="inline-flex w-fit items-center rounded-full border border-semantic-success/20 bg-semantic-success/10 px-200 py-50 text-body-sm font-medium text-semantic-success">
            Active member
          </span>
        </li>
      ))}
    </ul>
  );
}

export function VolunteerInterestsView({
  interests,
  availableDepartments,
  memberships,
}: {
  interests: InterestWithDepartment[];
  availableDepartments: DepartmentForInterestSubmit[];
  memberships: MemberWithDepartment[];
}) {
  return (
    <div className="flex flex-col gap-600">
      <div>
        <h1 className="text-h2 text-neutral-950">Your department interests</h1>
        <p className="mt-100 text-body-sm text-neutral-600">
          Submit interest in a department to be considered for rostering.
        </p>
      </div>

      {memberships.length > 0 && (
        <section className="flex flex-col gap-300">
          <h2 className="text-h3 text-neutral-950">Active memberships</h2>
          <MembershipList memberships={memberships} />
        </section>
      )}

      <section className="flex flex-col gap-300">
        <h2 className="text-h3 text-neutral-950">Current requests</h2>
        <InterestStatusList interests={interests} />
      </section>

      <section className="flex flex-col gap-300">
        <SubmitInterestForm availableDepartments={availableDepartments} />
      </section>
    </div>
  );
}
