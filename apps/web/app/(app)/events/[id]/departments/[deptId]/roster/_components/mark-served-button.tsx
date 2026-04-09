"use client";

import { useTransition } from "react";
import { markAssignmentServed } from "@/lib/assignments/actions";

interface MarkServedButtonProps {
  assignmentId: string;
  eventId: string;
  deptId: string;
}

export function MarkServedButton({
  assignmentId,
  eventId,
  deptId,
}: MarkServedButtonProps) {
  const [isPending, startTransition] = useTransition();

  function handleClick() {
    if (!confirm("Mark this assignment as served?")) return;
    startTransition(async () => {
      await markAssignmentServed(assignmentId, eventId, deptId);
    });
  }

  return (
    <button
      onClick={handleClick}
      disabled={isPending}
      className="rounded-200 bg-neutral-950 px-300 py-150 text-body-sm font-semibold text-neutral-0 transition-opacity duration-fast hover:opacity-80 disabled:opacity-50"
    >
      {isPending ? "Saving…" : "Mark served"}
    </button>
  );
}
