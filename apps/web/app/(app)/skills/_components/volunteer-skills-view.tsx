"use client";

import type { SkillClaimWithDepartment } from "@/lib/skills/types";
import type { DepartmentSkillWithName } from "@/lib/skills/queries";
import { SkillClaimList } from "./skill-claim-list";
import { ClaimSkillForm } from "./claim-skill-form";

export function VolunteerSkillsView({
  claims,
  catalogSkills,
}: {
  claims: SkillClaimWithDepartment[];
  catalogSkills: DepartmentSkillWithName[];
}) {
  return (
    <div className="flex flex-col gap-600">
      <div>
        <h1 className="text-h2 text-neutral-950">Your skills</h1>
        <p className="mt-100 text-body-sm text-neutral-600">
          Claim skills from your approved departments to be considered for
          rostering.
        </p>
      </div>
      <section className="flex flex-col gap-300">
        <h2 className="text-h3 text-neutral-950">Claimed skills</h2>
        <SkillClaimList claims={claims} />
      </section>
      <section className="flex flex-col gap-300">
        <h2 className="text-h3 text-neutral-950">Claim a new skill</h2>
        <ClaimSkillForm catalogSkills={catalogSkills} />
      </section>
    </div>
  );
}
