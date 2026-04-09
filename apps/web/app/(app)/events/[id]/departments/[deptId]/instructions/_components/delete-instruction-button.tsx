"use client";

import { useTransition } from "react";
import { deleteInstruction } from "@/lib/instructions/actions";

interface DeleteInstructionButtonProps {
  instructionId: string;
  eventId: string;
  deptId: string;
}

export function DeleteInstructionButton({
  instructionId,
  eventId,
  deptId,
}: DeleteInstructionButtonProps) {
  const [isPending, startTransition] = useTransition();

  function handleDelete() {
    if (!confirm("Delete this instruction? This cannot be undone.")) return;
    startTransition(async () => {
      await deleteInstruction(instructionId, eventId, deptId);
    });
  }

  return (
    <button
      onClick={handleDelete}
      disabled={isPending}
      className="shrink-0 text-body-sm text-semantic-error underline-offset-2 hover:underline disabled:opacity-50"
    >
      {isPending ? "Deleting…" : "Delete"}
    </button>
  );
}
