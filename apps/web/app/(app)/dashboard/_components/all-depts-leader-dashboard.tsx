interface AllDeptsLeaderDashboardProps {
  displayName: string;
}

export function AllDeptsLeaderDashboard({ displayName }: AllDeptsLeaderDashboardProps) {
  return (
    <div className="flex flex-col gap-400">
      <div className="rounded-300 bg-surface-cool px-400 py-400">
        <h1 className="font-display text-h1 text-neutral-950">
          Hi, {displayName.split(" ")[0]}
        </h1>
      </div>

      <div className="rounded-200 border border-neutral-300 bg-neutral-0 p-500">
        <p className="text-body text-neutral-600">
          All Departments Leader dashboard is coming soon.
        </p>
      </div>
    </div>
  );
}
