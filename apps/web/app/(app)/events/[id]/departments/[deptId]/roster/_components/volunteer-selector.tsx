"use client";

import { useState } from "react";
import type { VolunteerForAssignment } from "@/lib/assignments/types";

interface VolunteerSelectorProps {
  volunteers: VolunteerForAssignment[];
  selectedId: string | null;
  onChange: (id: string) => void;
}

export function VolunteerSelector({
  volunteers,
  selectedId,
  onChange,
}: VolunteerSelectorProps) {
  const [filter, setFilter] = useState("");

  const filtered = filter.trim()
    ? volunteers.filter((v) =>
        v.display_name.toLowerCase().includes(filter.toLowerCase()),
      )
    : volunteers;

  if (volunteers.length === 0) {
    return (
      <p className="text-body-sm text-neutral-500">
        No eligible volunteers found. Volunteers must have an approved interest
        in this department before they can be assigned.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-200">
      <input
        type="text"
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
        placeholder="Search volunteers…"
        className="rounded-200 border border-neutral-300 px-300 py-200 text-body-sm text-neutral-950 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-brand-calm-600/30"
      />
      <ul className="flex flex-col gap-100 rounded-200 border border-neutral-200 bg-neutral-0 py-100">
        {filtered.length === 0 ? (
          <li className="px-300 py-200 text-body-sm text-neutral-400">
            No volunteers match your search.
          </li>
        ) : (
          filtered.map((v) => {
            const isSelected = v.id === selectedId;
            const disabled = v.already_assigned;
            return (
              <li key={v.id}>
                <button
                  type="button"
                  disabled={disabled}
                  onClick={() => !disabled && onChange(v.id)}
                  className={[
                    "flex w-full flex-col gap-100 px-300 py-200 text-left transition-colors duration-fast",
                    disabled
                      ? "cursor-not-allowed opacity-50"
                      : isSelected
                        ? "bg-brand-calm-600/5 outline outline-1 outline-brand-calm-600"
                        : "hover:bg-surface-cool",
                  ].join(" ")}
                >
                  <div className="flex items-center gap-200">
                    <span
                      className={`text-body-sm font-medium ${disabled ? "text-neutral-400" : "text-neutral-950"}`}
                    >
                      {v.display_name}
                    </span>
                    {disabled && (
                      <span className="text-body-sm text-neutral-400">
                        (already assigned)
                      </span>
                    )}
                    {/* Availability chip */}
                    <span
                      className={`ml-auto inline-flex items-center rounded-full px-150 py-25 text-body-sm font-medium ${
                        v.is_available
                          ? "bg-semantic-success/10 text-semantic-success"
                          : "bg-semantic-warning/10 text-semantic-warning"
                      }`}
                    >
                      {v.is_available ? "Available" : "Blocked"}
                    </span>
                  </div>
                  {v.approved_skills.length > 0 && (
                    <div className="flex flex-wrap gap-100">
                      {v.approved_skills.map((skill) => (
                        <span
                          key={skill}
                          className="rounded-full border border-neutral-300 bg-surface-cool px-150 py-25 text-body-sm text-neutral-700"
                        >
                          {skill}
                        </span>
                      ))}
                    </div>
                  )}
                </button>
              </li>
            );
          })
        )}
      </ul>
    </div>
  );
}
