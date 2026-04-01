import type { AssignmentStatus } from "@/lib/assignments/types";

const styles: Record<AssignmentStatus, string> = {
  invited:
    "bg-neutral-100 text-neutral-600 border border-neutral-300",
  accepted:
    "bg-semantic-success/10 text-semantic-success border border-semantic-success/20",
  declined:
    "bg-semantic-error/10 text-semantic-error border border-semantic-error/20",
  served:
    "bg-neutral-100 text-neutral-500 border border-neutral-200",
};

const labels: Record<AssignmentStatus, string> = {
  invited: "Invited",
  accepted: "Accepted",
  declined: "Declined",
  served: "Served",
};

export function AssignmentStatusBadge({ status }: { status: AssignmentStatus }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-200 py-50 text-body-sm font-medium ${styles[status]}`}
    >
      {labels[status]}
    </span>
  );
}
