"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createAssignment } from "@/lib/assignments/actions";
import type { CrossTeamSuggestion } from "@/lib/assignments/queries";

interface CrossTeamSuggestionsPanelProps {
  eventId: string;
  deptId: string;
  initialSuggestions: CrossTeamSuggestion[];
}

export function CrossTeamSuggestionsPanel({
  eventId,
  deptId,
  initialSuggestions,
}: CrossTeamSuggestionsPanelProps) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [suggestions, setSuggestions] = useState<CrossTeamSuggestion[]>(initialSuggestions);
  const [pendingVolunteerId, setPendingVolunteerId] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [, startTransition] = useTransition();

  if (initialSuggestions.length === 0 && suggestions.length === 0) {
    return null;
  }

  function handleAssign(volunteerId: string) {
    setErrors((prev) => {
      const next = { ...prev };
      delete next[volunteerId];
      return next;
    });
    setPendingVolunteerId(volunteerId);
    startTransition(async () => {
      const result = await createAssignment(eventId, deptId, volunteerId, "volunteer");
      setPendingVolunteerId(null);
      if (result.error) {
        setErrors((prev) => ({ ...prev, [volunteerId]: result.error! }));
      } else {
        setSuggestions((prev) => prev.filter((s) => s.volunteerId !== volunteerId));
        router.refresh();
      }
    });
  }

  return (
    <section className="flex flex-col gap-200 rounded-300 border border-neutral-200 bg-neutral-0 p-400">
      {/* Collapsible header */}
      <button
        type="button"
        onClick={() => setIsOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-200 text-left"
        aria-expanded={isOpen}
      >
        <h2 className="font-display text-h2 text-neutral-950">
          Suggestions from other teams{" "}
          <span className="ml-100 inline-flex items-center rounded-full border border-neutral-200 bg-neutral-100 px-200 py-50 text-body-sm font-medium text-neutral-600">
            {suggestions.length}
          </span>
        </h2>
        <span
          className={`text-neutral-500 transition-transform duration-fast ${isOpen ? "rotate-180" : "rotate-0"}`}
          aria-hidden="true"
        >
          ▾
        </span>
      </button>

      {isOpen && (
        <div className="flex flex-col gap-200">
          {suggestions.length === 0 ? (
            <p className="text-body-sm text-neutral-500">
              No suggestions available. All volunteers from other teams are already assigned or
              the department has no other teams.
            </p>
          ) : (
            suggestions.map((suggestion) => (
              <SuggestionRow
                key={suggestion.volunteerId}
                suggestion={suggestion}
                isPending={pendingVolunteerId === suggestion.volunteerId}
                error={errors[suggestion.volunteerId] ?? null}
                onAssign={handleAssign}
              />
            ))
          )}
        </div>
      )}
    </section>
  );
}

function SuggestionRow({
  suggestion,
  isPending,
  error,
  onAssign,
}: {
  suggestion: CrossTeamSuggestion;
  isPending: boolean;
  error: string | null;
  onAssign: (volunteerId: string) => void;
}) {
  return (
    <div className="flex flex-col gap-100 rounded-200 border border-neutral-200 bg-neutral-0 p-300">
      <div className="flex items-start justify-between gap-200">
        <div className="flex flex-col gap-100">
          <div className="flex items-center gap-100">
            <p className="text-body-sm font-medium text-neutral-950">{suggestion.displayName}</p>
            {!suggestion.isAvailable && (
              <span className="rounded-100 border border-semantic-warning/30 bg-semantic-warning/10 px-150 py-50 text-[11px] font-medium text-neutral-700">
                Unavailable
              </span>
            )}
          </div>
          <p className="text-body-sm text-neutral-500">{suggestion.currentTeamName}</p>
          {suggestion.matchedSkills.length > 0 && (
            <div className="flex flex-wrap gap-100">
              {suggestion.matchedSkills.map((skill) => (
                <span
                  key={skill}
                  className="inline-flex items-center rounded-full border border-brand-calm-200 bg-brand-calm-50 px-200 py-50 text-body-sm font-medium text-brand-calm-700"
                >
                  {skill}
                </span>
              ))}
            </div>
          )}
        </div>
        <button
          type="button"
          disabled={isPending}
          onClick={() => onAssign(suggestion.volunteerId)}
          className="shrink-0 rounded-200 bg-brand-calm-600 px-300 py-150 text-body-sm font-semibold text-neutral-0 transition-colors duration-fast hover:bg-brand-calm-600/90 disabled:opacity-50"
        >
          {isPending ? "Assigning…" : "Assign"}
        </button>
      </div>
      {error && <p className="text-body-sm text-semantic-error">{error}</p>}
    </div>
  );
}
