"use client";

import { useState, useTransition } from "react";
import { claimSkill } from "@/lib/skills/actions";
import type { DepartmentSkillWithName } from "@/lib/skills/queries";

export function ClaimSkillForm({
  catalogSkills,
}: {
  catalogSkills: DepartmentSkillWithName[];
}) {
  const [step, setStep] = useState<1 | 2>(1);
  const [selectedDeptId, setSelectedDeptId] = useState("");
  const [selectedSkillId, setSelectedSkillId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [isPending, startTransition] = useTransition();

  if (catalogSkills.length === 0) {
    return (
      <p className="text-body-sm text-neutral-600">
        No skills are available to claim yet. You need an approved department
        interest before skills can be claimed.
      </p>
    );
  }

  // Build unique departments from catalogSkills
  const departmentsMap = new Map<string, string>();
  for (const skill of catalogSkills) {
    if (!departmentsMap.has(skill.department_id)) {
      departmentsMap.set(skill.department_id, skill.department_name);
    }
  }
  const departments = Array.from(departmentsMap.entries()).sort((a, b) =>
    a[1].localeCompare(b[1]),
  );

  const skillsForDept = catalogSkills.filter(
    (s) => s.department_id === selectedDeptId,
  );

  function handleDeptChange(deptId: string) {
    setSelectedDeptId(deptId);
    setSelectedSkillId("");
    setError(null);
    setSuccess(false);
  }

  function handleBack() {
    setStep(1);
    setSelectedDeptId("");
    setSelectedSkillId("");
    setError(null);
    setSuccess(false);
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSuccess(false);
    startTransition(async () => {
      const result = await claimSkill(selectedSkillId);
      if (result?.error) {
        setError(result.error);
      } else {
        setSuccess(true);
        setStep(1);
        setSelectedDeptId("");
        setSelectedSkillId("");
      }
    });
  }

  if (step === 1) {
    return (
      <div className="flex flex-col gap-300">
        <h3 className="text-h3 text-neutral-950">Select a department</h3>
        <select
          value={selectedDeptId}
          onChange={(e) => handleDeptChange(e.target.value)}
          className="rounded-200 border border-neutral-300 bg-neutral-0 px-300 py-200 text-body text-neutral-950 focus:border-brand-calm-600 focus:outline-none focus:ring-2 focus:ring-brand-calm-600/20"
        >
          <option value="" disabled>
            Select a department
          </option>
          {departments.map(([id, name]) => (
            <option key={id} value={id}>
              {name}
            </option>
          ))}
        </select>
        {success && (
          <p className="text-body-sm text-neutral-600">
            Skill claimed — pending approval.
          </p>
        )}
        <button
          type="button"
          disabled={selectedDeptId === ""}
          onClick={() => setStep(2)}
          className="self-start rounded-200 bg-brand-calm-600 px-400 py-200 text-body font-semibold text-neutral-0 transition-colors duration-fast hover:bg-brand-calm-600/90 disabled:opacity-50"
        >
          Next
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-300">
      <h3 className="text-h3 text-neutral-950">Select a skill</h3>
      <p className="text-body-sm text-neutral-600">
        {departmentsMap.get(selectedDeptId)}
      </p>
      <select
        value={selectedSkillId}
        onChange={(e) => {
          setSelectedSkillId(e.target.value);
          setError(null);
        }}
        disabled={isPending}
        className="rounded-200 border border-neutral-300 bg-neutral-0 px-300 py-200 text-body text-neutral-950 focus:border-brand-calm-600 focus:outline-none focus:ring-2 focus:ring-brand-calm-600/20 disabled:opacity-50"
      >
        <option value="" disabled>
          Select a skill
        </option>
        {skillsForDept.map((skill) => (
          <option key={skill.id} value={skill.id}>
            {skill.name}
          </option>
        ))}
      </select>
      {error && <p className="text-body-sm text-semantic-error">{error}</p>}
      <div className="flex items-center gap-300">
        <button
          type="button"
          onClick={handleBack}
          disabled={isPending}
          className="text-body-sm text-neutral-600 underline underline-offset-2 transition-colors duration-fast hover:text-neutral-950 disabled:opacity-50"
        >
          Back
        </button>
        <button
          type="submit"
          disabled={selectedSkillId === "" || isPending}
          className="rounded-200 bg-brand-calm-600 px-400 py-200 text-body font-semibold text-neutral-0 transition-colors duration-fast hover:bg-brand-calm-600/90 disabled:opacity-50"
        >
          {isPending ? "Claiming…" : "Claim skill"}
        </button>
      </div>
    </form>
  );
}
