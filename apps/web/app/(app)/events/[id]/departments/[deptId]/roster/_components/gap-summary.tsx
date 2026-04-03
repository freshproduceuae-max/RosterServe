import type { RosterGapSummary } from "@/lib/skills/gap-types";

export function GapSummary({ summary }: { summary: RosterGapSummary }) {
  // Render nothing when no required skills are defined
  if (summary.state === "no_requirements") return null;

  const isFullyCovered = summary.state === "fully_covered";

  return (
    <div className="rounded-200 border border-neutral-300 bg-surface-cool p-300">
      <p className="mb-200 text-body-sm font-semibold text-neutral-700">
        Skill coverage
      </p>
      <div className="flex flex-wrap gap-150">
        {summary.required.map((skill) => {
          const covered = !summary.gaps.includes(skill);
          return (
            <span
              key={skill}
              className={`rounded-full border px-200 py-50 font-mono text-body-sm font-medium ${
                covered
                  ? "border-semantic-success bg-semantic-success/10 text-semantic-success"
                  : "border-semantic-warning bg-semantic-warning/10 text-semantic-warning"
              }`}
            >
              <span aria-hidden="true">{covered ? "✓ " : "✗ "}</span>
              <span className="sr-only">{covered ? "covered: " : "missing: "}</span>
              {skill}
            </span>
          );
        })}
      </div>
      {isFullyCovered && (
        <p className="mt-200 text-body-sm text-semantic-success">
          All required skills are covered.
        </p>
      )}
      {!isFullyCovered && (
        <p className="mt-200 text-body-sm text-semantic-warning">
          {summary.gaps.length === 1
            ? "1 required skill is not yet covered."
            : `${summary.gaps.length} required skills are not yet covered.`}
        </p>
      )}
    </div>
  );
}
