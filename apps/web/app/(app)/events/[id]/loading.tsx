export default function EventDetailLoading() {
  return (
    <div className="flex flex-col gap-400">
      {/* Back link skeleton */}
      <div className="h-300 w-700 animate-pulse rounded-200 bg-neutral-300" />

      {/* Detail card skeleton */}
      <div className="flex flex-col gap-300 rounded-300 border border-neutral-300 bg-neutral-0 p-500">
        <div className="h-400 w-3/4 animate-pulse rounded-200 bg-neutral-300" />
        <div className="h-300 w-500 animate-pulse rounded-pill bg-neutral-300" />
        <div className="grid grid-cols-1 gap-300 sm:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex flex-col gap-100">
              <div className="h-200 w-500 animate-pulse rounded-200 bg-neutral-300" />
              <div className="h-300 w-700 animate-pulse rounded-200 bg-neutral-300" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
