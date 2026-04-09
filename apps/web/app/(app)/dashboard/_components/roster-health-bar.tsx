interface RosterHealthBarProps {
  invited: number;
  accepted: number;
  declined: number;
  gapCount: number;
  pendingTeamHeads?: number;
}

export function RosterHealthBar({
  invited,
  accepted,
  declined,
  gapCount,
  pendingTeamHeads = 0,
}: RosterHealthBarProps) {
  return (
    <div className="flex flex-wrap items-center gap-150">
      {accepted > 0 && (
        <span className="rounded-full border border-semantic-success bg-semantic-success/10 px-200 py-50 text-body-sm font-medium text-semantic-success">
          {accepted} confirmed
        </span>
      )}
      {invited > 0 && (
        <span className="rounded-full border border-neutral-300 px-200 py-50 text-body-sm font-medium text-neutral-600">
          {invited} invited
        </span>
      )}
      {declined > 0 && (
        <span className="rounded-full border border-semantic-error bg-semantic-error/10 px-200 py-50 text-body-sm font-medium text-semantic-error">
          {declined} declined
        </span>
      )}
      {pendingTeamHeads > 0 && (
        <span className="rounded-full border border-semantic-warning bg-semantic-warning/10 px-200 py-50 text-body-sm font-medium text-semantic-warning">
          {pendingTeamHeads === 1
            ? "1 team head pending"
            : `${pendingTeamHeads} team heads pending`}
        </span>
      )}
      {gapCount > 0 && (
        <span className="rounded-full border border-semantic-warning bg-semantic-warning/10 px-200 py-50 text-body-sm font-medium text-semantic-warning">
          {gapCount === 1 ? "1 skill gap" : `${gapCount} skill gaps`}
        </span>
      )}
    </div>
  );
}
