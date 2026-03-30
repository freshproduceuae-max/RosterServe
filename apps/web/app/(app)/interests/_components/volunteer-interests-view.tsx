"use client";

import type {
  InterestWithDepartment,
  DepartmentForInterestSubmit,
} from "@/lib/interests/types";
import { InterestStatusList } from "./interest-status-list";
import { SubmitInterestForm } from "./submit-interest-form";

export function VolunteerInterestsView({
  interests,
  availableDepartments,
}: {
  interests: InterestWithDepartment[];
  availableDepartments: DepartmentForInterestSubmit[];
}) {
  return (
    <div className="flex flex-col gap-600">
      <div>
        <h1 className="text-h2 text-neutral-950">Your department interests</h1>
        <p className="mt-100 text-body-sm text-neutral-600">
          Submit interest in a department to be considered for rostering.
        </p>
      </div>

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
