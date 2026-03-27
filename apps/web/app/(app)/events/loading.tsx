export default function EventsLoading() {
  return (
    <div className="flex flex-col gap-400">
      {/* Header skeleton */}
      <div className="flex items-center justify-between">
        <div className="h-400 w-700 animate-pulse rounded-200 bg-neutral-300" />
        <div className="h-400 w-700 animate-pulse rounded-200 bg-neutral-300" />
      </div>

      {/* Filter tabs skeleton */}
      <div className="flex gap-100">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="h-400 w-500 animate-pulse rounded-200 bg-neutral-300"
          />
        ))}
      </div>

      {/* Table rows skeleton */}
      <div className="flex flex-col gap-200">
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            key={i}
            className="h-500 animate-pulse rounded-300 bg-neutral-300/50"
          />
        ))}
      </div>
    </div>
  );
}
