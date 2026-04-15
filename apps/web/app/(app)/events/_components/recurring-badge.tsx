import { RECURRENCE_RULE_LABELS, type RecurrenceRule } from "@/lib/events/types";

export function RecurringBadge({ rule }: { rule: RecurrenceRule }) {
  return (
    <span className="inline-flex items-center rounded-100 border border-brand-calm-600/30 bg-brand-calm-600/10 px-200 py-50 font-mono text-mono text-brand-calm-600 uppercase">
      {RECURRENCE_RULE_LABELS[rule]}
    </span>
  );
}
