import Link from "next/link";
import type { AssignmentWithEventContext } from "@/lib/dashboard/types";
import { formatEventDate } from "@/lib/format-date";

const STATUS_CLASSES: Record<string, string> = {
  invited: "border-neutral-300 text-neutral-600",
  accepted: "border-semantic-success bg-semantic-success/10 text-semantic-success",
  declined: "border-semantic-error bg-semantic-error/10 text-semantic-error",
  served: "border-neutral-300 bg-neutral-100 text-neutral-600",
};

const STATUS_LABELS: Record<string, string> = {
  invited: "Invited",
  accepted: "Confirmed",
  declined: "Declined",
  served: "Served",
};

interface AssignmentCardProps {
  assignment: AssignmentWithEventContext;
}

export function AssignmentCard({ assignment }: AssignmentCardProps) {
  const {
    event_title,
    event_date,
    department_name,
    sub_team_name,
    role,
    status,
  } = assignment;

  const formattedDate = formatEventDate(event_date);
  const roleLabel = role === "team_head" ? "Team Head" : "Volunteer";
  const statusClass = STATUS_CLASSES[status] ?? STATUS_CLASSES.invited;
  const statusLabel = STATUS_LABELS[status] ?? status;

  return (
    <div className="rounded-200 border border-neutral-300 bg-neutral-0 p-300">
      <div className="flex items-start justify-between gap-200">
        <div className="flex flex-col gap-50">
          <p className="font-display text-h3 text-neutral-950">{event_title}</p>
          <p className="text-body-sm text-neutral-600">{formattedDate}</p>
        </div>
        <span
          className={[
            "shrink-0 rounded-full border px-200 py-50 text-body-sm font-medium",
            statusClass,
          ].join(" ")}
        >
          {statusLabel}
        </span>
      </div>
      <div className="mt-200 flex flex-wrap gap-150 text-body-sm text-neutral-600">
        <span>{department_name}</span>
        {sub_team_name && (
          <>
            <span aria-hidden>·</span>
            <span>{sub_team_name}</span>
          </>
        )}
        <span aria-hidden>·</span>
        <span>{roleLabel}</span>
      </div>
      <div className="mt-200">
        <Link
          href={`/events/${assignment.event_id}/departments/${assignment.department_id}/instructions`}
          className="text-body-sm text-brand-calm-600 underline-offset-2 hover:underline"
        >
          View instructions
        </Link>
      </div>
    </div>
  );
}
