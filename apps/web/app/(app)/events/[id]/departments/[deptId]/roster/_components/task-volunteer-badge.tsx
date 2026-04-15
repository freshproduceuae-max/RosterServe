import type { TaskBadge } from "@/lib/tasks/types";

export function TaskVolunteerBadge({ badge }: { badge: TaskBadge }) {
  if (badge === "skill_match") {
    return (
      <span className="rounded-full border border-semantic-success bg-semantic-success/10 px-200 py-50 text-body-sm font-medium text-semantic-success">
        Skill match
      </span>
    );
  }
  if (badge === "skill_gap") {
    return (
      <span className="rounded-full border border-semantic-warning bg-semantic-warning/10 px-200 py-50 text-body-sm font-medium text-semantic-warning">
        Skill gap
      </span>
    );
  }
  if (badge === "availability_conflict") {
    return (
      <span className="rounded-full border border-semantic-error bg-semantic-error/10 px-200 py-50 text-body-sm font-medium text-semantic-error">
        Unavailable
      </span>
    );
  }
  return null; // unassigned — no badge on the slot row itself
}
