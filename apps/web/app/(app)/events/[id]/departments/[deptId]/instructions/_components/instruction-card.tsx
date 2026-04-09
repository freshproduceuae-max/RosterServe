import type { EventInstruction } from "@/lib/instructions/types";
import { DeleteInstructionButton } from "./delete-instruction-button";

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(isoDate: string): string {
  return new Date(isoDate).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

interface InstructionCardProps {
  instruction: EventInstruction;
  eventId: string;
  deptId: string;
  canDelete: boolean;
}

export function InstructionCard({
  instruction,
  eventId,
  deptId,
  canDelete,
}: InstructionCardProps) {
  const scope = instruction.team_name
    ? instruction.team_name
    : "All teams";

  return (
    <div className="flex flex-col gap-200 rounded-200 border border-neutral-300 bg-neutral-0 p-300">
      {/* Header row */}
      <div className="flex items-start justify-between gap-200">
        <div className="flex flex-col gap-50">
          <p className="font-display text-h3 text-neutral-950">
            {instruction.title}
          </p>
          <p className="text-body-sm text-neutral-500">
            {scope} · {instruction.creator_name ?? "Unknown"} ·{" "}
            {formatDate(instruction.created_at)}
          </p>
        </div>
        {canDelete && (
          <DeleteInstructionButton
            instructionId={instruction.id}
            eventId={eventId}
            deptId={deptId}
          />
        )}
      </div>

      {/* Body text */}
      {instruction.body && (
        <p className="text-body text-neutral-800 whitespace-pre-wrap">
          {instruction.body}
        </p>
      )}

      {/* Attachment */}
      {instruction.attachment_name && instruction.attachment_signed_url && (
        <div className="flex items-center gap-150">
          <a
            href={instruction.attachment_signed_url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-body-sm font-medium text-brand-calm-600 underline-offset-2 hover:underline"
          >
            {instruction.attachment_name}
          </a>
          {instruction.attachment_size_bytes !== null && (
            <span className="text-body-sm text-neutral-400">
              ({formatBytes(instruction.attachment_size_bytes)})
            </span>
          )}
        </div>
      )}
    </div>
  );
}
