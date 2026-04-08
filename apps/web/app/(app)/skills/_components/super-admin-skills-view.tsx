"use client";

import { useState, useTransition } from "react";
import type { SkillClaimWithVolunteer } from "@/lib/skills/types";
import type { DepartmentSkillWithName } from "@/lib/skills/queries";
import { createDepartmentSkill, bulkCreateSkills } from "@/lib/skills/actions";
import { LeaderSkillsView } from "./leader-skills-view";

// ---------------------------------------------------------------------------
// SkillCreationForm
// Provides a department selector, a single-skill text input, and a toggle to
// switch to a bulk textarea (one skill name per line).
// ---------------------------------------------------------------------------
function SkillCreationForm({
  allDepartments,
}: {
  allDepartments: { id: string; name: string }[];
}) {
  const [departmentId, setDepartmentId] = useState(
    allDepartments[0]?.id ?? "",
  );
  const [name, setName] = useState("");
  const [bulkMode, setBulkMode] = useState(false);
  const [bulkText, setBulkText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSingleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);
    startTransition(async () => {
      const result = await createDepartmentSkill(departmentId, name.trim());
      if (result?.error) {
        setError(result.error);
      } else {
        setName("");
        setSuccessMsg("Skill created.");
      }
    });
  }

  function handleBulkSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);
    const names = bulkText
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l.length > 0);
    if (names.length === 0) {
      setError("Enter at least one skill name.");
      return;
    }
    startTransition(async () => {
      const result = await bulkCreateSkills(departmentId, names);
      if (result?.error) {
        setError(result.error);
      } else {
        setBulkText("");
        setSuccessMsg(
          `Done — ${result.created} created, ${result.skipped} skipped (duplicates).`,
        );
      }
    });
  }

  if (allDepartments.length === 0) {
    return (
      <p className="text-body-sm text-neutral-600">
        No active departments. Create a department before adding skills.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-300 rounded-300 border border-neutral-300 bg-neutral-0 p-400">
      <div className="flex items-center justify-between gap-200">
        <h2 className="text-h3 text-neutral-950">Create skills</h2>
        <button
          type="button"
          onClick={() => {
            setBulkMode((prev) => !prev);
            setError(null);
            setSuccessMsg(null);
          }}
          className="text-body-sm text-brand-calm-600 underline underline-offset-2 transition-opacity duration-fast hover:opacity-70"
        >
          {bulkMode ? "Switch to single entry" : "Switch to bulk entry"}
        </button>
      </div>

      {/* Department selector — shared between modes */}
      <div className="flex flex-col gap-100">
        <label
          htmlFor="dept-select"
          className="text-body-sm font-medium text-neutral-700"
        >
          Department
        </label>
        <select
          id="dept-select"
          value={departmentId}
          onChange={(e) => setDepartmentId(e.target.value)}
          disabled={isPending}
          className="rounded-200 border border-neutral-300 bg-neutral-0 px-300 py-200 text-body text-neutral-950 focus:border-brand-calm-600 focus:outline-none focus:ring-2 focus:ring-brand-calm-600/20 disabled:opacity-50"
        >
          {allDepartments.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
        </select>
      </div>

      {bulkMode ? (
        <form onSubmit={handleBulkSubmit} className="flex flex-col gap-200">
          <div className="flex flex-col gap-100">
            <label
              htmlFor="bulk-textarea"
              className="text-body-sm font-medium text-neutral-700"
            >
              Skill names (one per line)
            </label>
            <textarea
              id="bulk-textarea"
              value={bulkText}
              onChange={(e) => {
                setBulkText(e.target.value);
                setError(null);
                setSuccessMsg(null);
              }}
              disabled={isPending}
              rows={6}
              placeholder={"Piano\nGuitar\nSound mixing"}
              className="rounded-200 border border-neutral-300 bg-neutral-0 px-300 py-200 text-body text-neutral-950 placeholder:text-neutral-400 focus:border-brand-calm-600 focus:outline-none focus:ring-2 focus:ring-brand-calm-600/20 disabled:opacity-50"
            />
          </div>
          {error && <p className="text-body-sm text-semantic-error">{error}</p>}
          {successMsg && (
            <p className="text-body-sm text-semantic-success">{successMsg}</p>
          )}
          <button
            type="submit"
            disabled={bulkText.trim() === "" || isPending}
            className="self-start rounded-200 bg-brand-calm-600 px-400 py-200 text-body-sm font-semibold text-neutral-0 transition-colors duration-fast hover:bg-brand-calm-600/90 disabled:opacity-50"
          >
            {isPending ? "Uploading…" : "Upload skills"}
          </button>
        </form>
      ) : (
        <form onSubmit={handleSingleSubmit} className="flex items-start gap-200">
          <div className="flex flex-1 flex-col gap-100">
            <input
              type="text"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setError(null);
                setSuccessMsg(null);
              }}
              disabled={isPending}
              placeholder="New skill name"
              className="rounded-200 border border-neutral-300 bg-neutral-0 px-300 py-200 text-body text-neutral-950 placeholder:text-neutral-400 focus:border-brand-calm-600 focus:outline-none focus:ring-2 focus:ring-brand-calm-600/20 disabled:opacity-50"
            />
            {error && (
              <p className="text-body-sm text-semantic-error">{error}</p>
            )}
            {successMsg && (
              <p className="text-body-sm text-semantic-success">{successMsg}</p>
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
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// SuperAdminSkillsView
// ---------------------------------------------------------------------------
export function SuperAdminSkillsView({
  catalogSkills,
  claims,
  allDepartments,
}: {
  catalogSkills: DepartmentSkillWithName[];
  claims: SkillClaimWithVolunteer[];
  allDepartments: { id: string; name: string }[];
}) {
  return (
    <div className="flex flex-col gap-600">
      <div>
        <h1 className="text-h1 text-neutral-950">Skills administration</h1>
        <p className="mt-100 text-body-sm text-neutral-600">
          Create and manage skill catalogs across all departments, and review
          volunteer skill claims.
        </p>
      </div>
      <SkillCreationForm allDepartments={allDepartments} />
      <LeaderSkillsView catalogSkills={catalogSkills} claims={claims} />
    </div>
  );
}
