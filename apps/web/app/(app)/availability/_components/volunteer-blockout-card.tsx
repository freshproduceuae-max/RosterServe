import type { AvailabilityBlockout } from "@/lib/availability/types";

function formatDate(isoDate: string): string {
  const [year, month, day] = isoDate.split("-").map(Number);
  return new Date(year, month - 1, day).toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function VolunteerBlockoutCard({
  displayName,
  departmentName,
  blockouts,
}: {
  displayName: string;
  departmentName: string;
  blockouts: AvailabilityBlockout[];
}) {
  return (
    <div className="rounded-200 border border-neutral-300 bg-neutral-0 p-300">
      <div className="flex flex-col gap-50">
        <span className="text-body font-semibold text-neutral-950">{displayName}</span>
        {departmentName && (
          <span className="text-body-sm text-neutral-600">{departmentName}</span>
        )}
      </div>

      {blockouts.length === 0 ? (
        <p className="mt-200 text-body-sm text-neutral-600">No blockouts recorded.</p>
      ) : (
        <ul className="mt-200 flex flex-col gap-100">
          {blockouts.map((b) => (
            <li key={b.id} className="flex flex-col gap-50">
              <span className="font-mono text-mono text-neutral-800">
                {formatDate(b.date)}
              </span>
              {b.reason && (
                <span className="text-body-sm text-neutral-600">{b.reason}</span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
