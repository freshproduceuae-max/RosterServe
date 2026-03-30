export function StatusBadge({ status }: { status: "pending" | "approved" | "rejected" }) {
  const styles: Record<"pending" | "approved" | "rejected", string> = {
    pending:
      "bg-semantic-warning/10 text-semantic-warning border border-semantic-warning/20",
    approved:
      "bg-semantic-success/10 text-semantic-success border border-semantic-success/20",
    rejected:
      "bg-semantic-error/10 text-semantic-error border border-semantic-error/20",
  };
  const labels: Record<"pending" | "approved" | "rejected", string> = {
    pending: "Pending review",
    approved: "Approved",
    rejected: "Rejected",
  };
  return (
    <span
      className={`inline-flex items-center rounded-full px-200 py-50 text-body-sm font-medium ${styles[status]}`}
    >
      {labels[status]}
    </span>
  );
}
