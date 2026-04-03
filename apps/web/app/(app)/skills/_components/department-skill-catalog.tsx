"use client";

import { useState, useTransition } from "react";
import { createDepartmentSkill, deleteDepartmentSkill, setSkillRequired } from "@/lib/skills/actions";
import type { DepartmentSkillWithName } from "@/lib/skills/queries";

function SkillRow({ skill }: { skill: DepartmentSkillWithName }) {
  const [confirming, setConfirming] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [isRequired, setIsRequired] = useState(skill.is_required);
  const [togglePending, startToggleTransition] = useTransition();

  function handleDelete() {
    setError(null);
    startTransition(async () => {
      const result = await deleteDepartmentSkill(skill.id);
      if (result?.error) {
        setError(result.error);
        setConfirming(false);
      }
    });
  }

  function handleToggleRequired() {
    const next = !isRequired;
    setIsRequired(next); // optimistic
    startToggleTransition(async () => {
      const result = await setSkillRequired(skill.id, next);
      if (result?.error) {
        setIsRequired(!next); // revert on error
      }
    });
  }

  return (
    <li className="flex items-center justify-between gap-200 rounded-200 border border-neutral-300 bg-neutral-0 px-300 py-200">
      <span className="text-body text-neutral-950">{skill.name}</span>
      <button
        onClick={handleToggleRequired}
        disabled={togglePending}
        aria-pressed={isRequired}
        className={`rounded-full border px-200 py-50 text-body-sm font-medium transition-colors duration-fast disabled:opacity-50 ${
          isRequired
            ? "border-semantic-warning bg-semantic-warning/10 text-semantic-warning"
            : "border-neutral-300 text-neutral-600 hover:border-neutral-400 hover:text-neutral-950"
        }`}
      >
        {isRequired ? "Required" : "Set required"}
      </button>
      <div className="flex items-center gap-200">
        {error && (
          <span className="text-body-sm text-semantic-error">{error}</span>
        )}
        {confirming ? (
          <>
            <span className="text-body-sm text-neutral-600">
              Remove this skill?
            </span>
            <button
              onClick={handleDelete}
              disabled={isPending}
              className="text-body-sm font-semibold text-semantic-error underline underline-offset-2 transition-opacity duration-fast hover:opacity-70 disabled:opacity-50"
            >
              {isPending ? "Removing…" : "Confirm"}
            </button>
            <button
              onClick={() => setConfirming(false)}
              disabled={isPending}
              className="text-body-sm text-neutral-600 underline underline-offset-2 transition-opacity duration-fast hover:opacity-70 disabled:opacity-50"
            >
              Cancel
            </button>
          </>
        ) : (
          <button
            onClick={() => setConfirming(true)}
            className="text-body-sm text-neutral-600 underline underline-offset-2 transition-colors duration-fast hover:text-neutral-950"
          >
            Remove
          </button>
        )}
      </div>
    </li>
  );
}

export function DepartmentSkillCatalog({
  departmentId,
  departmentName,
  skills,
}: {
  departmentId: string;
  departmentName: string;
  skills: DepartmentSkillWithName[];
}) {
  const [name, setName] = useState("");
  const [addError, setAddError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleAdd(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setAddError(null);
    startTransition(async () => {
      const result = await createDepartmentSkill(departmentId, name.trim());
      if (result?.error) {
        setAddError(result.error);
      } else {
        setName("");
      }
    });
  }

  return (
    <div className="flex flex-col gap-300">
      <h3 className="text-body font-semibold text-neutral-700">
        Skills catalog — {departmentName}
      </h3>
      {skills.length === 0 ? (
        <p className="text-body-sm text-neutral-600">
          No skills defined for this department yet.
        </p>
      ) : (
        <ul className="flex flex-col gap-200">
          {skills.map((skill) => (
            <SkillRow key={skill.id} skill={skill} />
          ))}
        </ul>
      )}
      <form onSubmit={handleAdd} className="flex items-start gap-200">
        <div className="flex flex-1 flex-col gap-100">
          <input
            type="text"
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              setAddError(null);
            }}
            disabled={isPending}
            placeholder="New skill name"
            className="rounded-200 border border-neutral-300 bg-neutral-0 px-300 py-200 text-body text-neutral-950 placeholder:text-neutral-400 focus:border-brand-calm-600 focus:outline-none focus:ring-2 focus:ring-brand-calm-600/20 disabled:opacity-50"
          />
          {addError && (
            <p className="text-body-sm text-semantic-error">{addError}</p>
          )}
        </div>
        <button
          type="submit"
          disabled={name.trim() === "" || isPending}
          className="rounded-200 border border-neutral-300 px-300 py-200 text-body-sm font-medium text-neutral-700 transition-colors duration-fast hover:border-neutral-400 hover:text-neutral-950 disabled:opacity-50"
        >
          {isPending ? "Adding…" : "Add skill"}
        </button>
      </form>
    </div>
  );
}
