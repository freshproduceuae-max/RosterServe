"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import type { RotationEntry } from "@/lib/departments/types";
import type { RotatableTeamRecord } from "@/lib/departments/queries";
import { setRotationOverride, clearRotationOverride } from "@/lib/departments/actions";

interface RotationScheduleSectionProps {
  entries: RotationEntry[];
  /** Plain object (JSON-safe) — rotatable teams keyed by department_id. */
  teamsByDept: Record<string, RotatableTeamRecord[]>;
}

function formatEventDate(isoDate: string): string {
  const date = new Date(`${isoDate}T00:00:00`);
  return date.toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function LabelBadge({ label }: { label: string }) {
  return (
    <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-brand-calm-600 text-[11px] font-semibold text-neutral-0">
      {label}
    </span>
  );
}

export function RotationScheduleSection({
  entries,
  teamsByDept,
}: RotationScheduleSectionProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [pendingKey, setPendingKey] = useState<string | null>(null);
  const [errorKey, setErrorKey] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  function handleOverride(eventId: string, deptId: string, teamId: string) {
    const key = `${eventId}::${deptId}`;
    setPendingKey(key);
    setErrorKey(null);
    setErrorMessage(null);
    startTransition(async () => {
      const result = await setRotationOverride(eventId, deptId, teamId);
      setPendingKey(null);
      if (result.error) {
        setErrorKey(key);
        setErrorMessage(result.error);
      } else {
        router.refresh();
      }
    });
  }

  function handleClear(eventId: string, deptId: string) {
    const key = `${eventId}::${deptId}`;
    setPendingKey(key);
    setErrorKey(null);
    setErrorMessage(null);
    startTransition(async () => {
      const result = await clearRotationOverride(eventId, deptId);
      setPendingKey(null);
      if (result.error) {
        setErrorKey(key);
        setErrorMessage(result.error);
      } else {
        router.refresh();
      }
    });
  }

  return (
    <section className="flex flex-col gap-300">
      <h2 className="font-display text-h2 text-neutral-950">Team rotation</h2>
      <div className="flex flex-col gap-300">
        {entries.map((entry) => {
          const entryKey = `${entry.eventId}::${entry.departmentId}`;
          const isEntryPending = pendingKey === entryKey && isPending;
          const entryError = errorKey === entryKey ? errorMessage : null;
          const teams = (teamsByDept[entry.departmentId] ?? []).filter(
            (t) => t.rotation_label !== null,
          );

          const activeTeam = entry.override
            ? {
                teamId: entry.override.teamId,
                teamName: entry.override.teamName,
                teamLabel: entry.override.teamLabel,
              }
            : entry.suggestedTeam
            ? {
                teamId: entry.suggestedTeam.id,
                teamName: entry.suggestedTeam.name,
                teamLabel: entry.suggestedTeam.label,
              }
            : null;

          const isOverridden = entry.override !== null;

          return (
            <div
              key={entryKey}
              className="flex flex-col gap-150 rounded-200 border border-neutral-300 bg-neutral-0 p-300"
            >
              <div className="flex flex-col gap-50">
                <p className="font-display text-h3 text-neutral-950">{entry.eventTitle}</p>
                <p className="text-body-sm text-neutral-600">{formatEventDate(entry.eventDate)}</p>
                <p className="text-body-sm text-neutral-600">{entry.departmentName}</p>
              </div>

              {activeTeam ? (
                <div className="flex items-center gap-150">
                  <LabelBadge label={activeTeam.teamLabel} />
                  <span className="text-body-sm font-medium text-neutral-800">
                    {activeTeam.teamName}
                  </span>
                  {isOverridden ? (
                    <span className="rounded-100 bg-brand-warm-500/20 px-150 py-50 text-[11px] font-medium text-neutral-800">
                      Override
                    </span>
                  ) : (
                    <span className="rounded-100 bg-neutral-100 px-150 py-50 text-[11px] font-medium text-neutral-600">
                      Auto
                    </span>
                  )}
                </div>
              ) : (
                <p className="text-body-sm text-neutral-600">
                  No rotatable team available for this label.
                </p>
              )}

              <div className="flex flex-wrap items-center gap-200">
                {teams.length > 0 && (
                  <div className="flex items-center gap-100">
                    <label
                      className="text-body-sm text-neutral-600"
                      htmlFor={`override-${entry.eventId}-${entry.departmentId}`}
                    >
                      Override:
                    </label>
                    <select
                      id={`override-${entry.eventId}-${entry.departmentId}`}
                      className="rounded-100 border border-neutral-300 bg-neutral-0 px-150 py-50 text-body-sm text-neutral-800 focus:outline-none focus:ring-2 focus:ring-brand-calm-600 disabled:opacity-50"
                      defaultValue=""
                      disabled={isEntryPending}
                      onChange={(e) => {
                        if (e.target.value) {
                          handleOverride(entry.eventId, entry.departmentId, e.target.value);
                          e.target.value = "";
                        }
                      }}
                    >
                      <option value="" disabled>
                        Select team…
                      </option>
                      {teams.map((t) => (
                        <option key={t.id} value={t.id}>
                          Team {t.rotation_label} — {t.name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {isOverridden && (
                  <button
                    type="button"
                    disabled={isEntryPending}
                    onClick={() => handleClear(entry.eventId, entry.departmentId)}
                    className="text-body-sm text-semantic-error underline-offset-2 hover:underline disabled:opacity-50"
                  >
                    Clear override
                  </button>
                )}

                {isEntryPending && (
                  <span className="text-body-sm text-neutral-600">Saving…</span>
                )}
              </div>

              {entryError && (
                <p className="text-body-sm text-semantic-error">{entryError}</p>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
