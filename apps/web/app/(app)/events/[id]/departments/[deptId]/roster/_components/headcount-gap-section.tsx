import type { HeadcountGapSummary } from "@/lib/skills/gap-types";

export function HeadcountGapSection({
  summary,
}: {
  summary: HeadcountGapSummary;
}) {
  if (summary.state === "no_requirements" || summary.teams.length === 0) {
    return null;
  }

  return (
    <div className="rounded-200 border border-neutral-300 bg-surface-cool p-300">
      <p className="mb-200 text-body-sm font-semibold text-neutral-700">
        Headcount
      </p>
      <div className="flex flex-col gap-150">
        {summary.teams.map((team) => (
          <div
            key={team.team_id}
            className="flex items-center justify-between gap-200"
          >
            <span className="text-body-sm text-neutral-700">{team.team_name}</span>
            <div className="flex items-center gap-150">
              <span
                className={`text-body-sm font-medium tabular-nums ${
                  team.state === "met"
                    ? "text-semantic-success"
                    : "text-semantic-warning"
                }`}
              >
                {team.confirmed}/{team.required}
              </span>
              {team.state === "short" && (
                <span className="rounded-full border border-semantic-warning bg-semantic-warning/10 px-200 py-50 text-body-sm font-medium text-semantic-warning">
                  {team.gap === 1 ? "short by 1" : `short by ${team.gap}`}
                </span>
              )}
              {team.state === "met" && (
                <span className="rounded-full border border-semantic-success bg-semantic-success/10 px-200 py-50 text-body-sm font-medium text-semantic-success">
                  ✓ met
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
      {summary.state === "all_met" && (
        <p className="mt-200 text-body-sm text-semantic-success">
          All headcount requirements are met.
        </p>
      )}
      {summary.state === "gaps" && (
        <p className="mt-200 text-body-sm text-semantic-warning">
          {summary.teams.filter((t) => t.state === "short").length === 1
            ? "1 team is short on headcount."
            : `${summary.teams.filter((t) => t.state === "short").length} teams are short on headcount.`}
        </p>
      )}
    </div>
  );
}
