"use client";

import type { SkillClaimWithVolunteer } from "@/lib/skills/types";
import type { DepartmentSkillWithName } from "@/lib/skills/queries";
import { DepartmentSkillCatalog } from "./department-skill-catalog";
import { SkillClaimCard } from "./skill-claim-card";

export function LeaderSkillsView({
  catalogSkills,
  claims,
}: {
  catalogSkills: DepartmentSkillWithName[];
  claims: SkillClaimWithVolunteer[];
}) {
  const deptSkills = catalogSkills.reduce<
    Record<string, DepartmentSkillWithName[]>
  >((acc, s) => {
    const key = s.department_name;
    acc[key] = [...(acc[key] ?? []), s];
    return acc;
  }, {});

  const deptClaims = claims.reduce<Record<string, SkillClaimWithVolunteer[]>>(
    (acc, c) => {
      const key = c.department_name;
      acc[key] = [...(acc[key] ?? []), c];
      return acc;
    },
    {},
  );

  const allDepts = Array.from(
    new Set([...Object.keys(deptSkills), ...Object.keys(deptClaims)]),
  ).sort();

  if (allDepts.length === 0) {
    return (
      <div className="flex flex-col gap-500">
        <div>
          <h1 className="text-h2 text-neutral-950">Department skills</h1>
          <p className="mt-100 text-body-sm text-neutral-600">
            Manage skill catalogs and review volunteer skill claims for your
            departments.
          </p>
        </div>
        <div className="rounded-300 border border-neutral-300 bg-neutral-0 p-500 text-center">
          <p className="text-h3 text-neutral-950">
            No department skills have been defined yet.
          </p>
        </div>
      </div>
    );
  }

  // Build a map of department_name → { id, name } for catalog rendering
  const deptMeta = catalogSkills.reduce<Record<string, { id: string; name: string }>>(
    (acc, s) => {
      if (!acc[s.department_name]) {
        acc[s.department_name] = { id: s.department_id, name: s.department_name };
      }
      return acc;
    },
    {},
  );

  // For departments that only appear in claims (no catalog skills yet),
  // derive department_id from the claims data
  const claimDeptMeta = claims.reduce<Record<string, { id: string; name: string }>>(
    (acc, c) => {
      if (!acc[c.department_name] && c.department_id) {
        acc[c.department_name] = { id: c.department_id, name: c.department_name };
      }
      return acc;
    },
    {},
  );

  const mergedDeptMeta = { ...claimDeptMeta, ...deptMeta };

  return (
    <div className="flex flex-col gap-500">
      <div>
        <h1 className="text-h2 text-neutral-950">Department skills</h1>
        <p className="mt-100 text-body-sm text-neutral-600">
          Manage skill catalogs and review volunteer skill claims for your
          departments.
        </p>
      </div>
      <div className="flex flex-col gap-600">
        {allDepts.map((dept) => {
          const skills = deptSkills[dept] ?? [];
          const deptClaiming = deptClaims[dept] ?? [];
          const pendingCount = deptClaiming.filter(
            (c) => c.status === "pending",
          ).length;
          const meta = mergedDeptMeta[dept];

          return (
            <section key={dept} className="flex flex-col gap-400">
              <div className="flex items-baseline gap-200">
                <h2 className="text-h3 text-neutral-950">{dept}</h2>
                <span className="text-body-sm text-neutral-600">
                  {pendingCount === 0
                    ? "All reviewed"
                    : `${pendingCount} pending`}
                </span>
              </div>
              {meta && (
                <DepartmentSkillCatalog
                  departmentId={meta.id}
                  departmentName={meta.name}
                  skills={skills}
                />
              )}
              <div className="flex flex-col gap-300">
                <h3 className="text-body font-semibold text-neutral-700">
                  Skill claims
                </h3>
                {deptClaiming.length === 0 ? (
                  <p className="text-body-sm text-neutral-600">
                    No skill claims for this department yet.
                  </p>
                ) : (
                  <div className="grid gap-300 sm:grid-cols-2 lg:grid-cols-3">
                    {deptClaiming.map((claim) => (
                      <SkillClaimCard key={claim.id} claim={claim} />
                    ))}
                  </div>
                )}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
