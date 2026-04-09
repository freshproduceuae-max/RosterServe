"use client";

import { useRef, useState, useTransition } from "react";
import { createInstruction } from "@/lib/instructions/actions";

interface Team {
  id: string;
  name: string;
}

interface CreateInstructionFormProps {
  eventId: string;
  deptId: string;
  teams: Team[];
  allowDeptLevel: boolean;
}

export function CreateInstructionForm({
  eventId,
  deptId,
  teams,
  allowDeptLevel,
}: CreateInstructionFormProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const formData = new FormData(e.currentTarget);
    startTransition(async () => {
      const result = await createInstruction(eventId, deptId, formData);
      if ("error" in result) {
        setError(result.error);
      } else {
        formRef.current?.reset();
        setIsOpen(false);
      }
    });
  }

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="self-start rounded-200 bg-brand-calm-600 px-300 py-150 text-body-sm font-semibold text-neutral-0 transition-opacity duration-fast hover:opacity-90"
      >
        + Post instruction
      </button>
    );
  }

  return (
    <form
      ref={formRef}
      onSubmit={handleSubmit}
      className="flex flex-col gap-300 rounded-200 border border-neutral-300 bg-neutral-0 p-300"
    >
      {/* Title */}
      <div className="flex flex-col gap-100">
        <label
          htmlFor="instr-title"
          className="text-body-sm font-medium text-neutral-700"
        >
          Title *
        </label>
        <input
          id="instr-title"
          name="title"
          required
          maxLength={200}
          placeholder="e.g. Sound setup notes"
          className="rounded-200 border border-neutral-300 px-300 py-150 text-body placeholder:text-neutral-400 focus:border-brand-calm-600 focus:outline-none"
        />
      </div>

      {/* Scope selector — only shown when teams exist */}
      {teams.length > 0 && (
        <div className="flex flex-col gap-100">
          <label
            htmlFor="instr-team"
            className="text-body-sm font-medium text-neutral-700"
          >
            Who sees this?
          </label>
          <select
            id="instr-team"
            name="team_id"
            className="rounded-200 border border-neutral-300 px-300 py-150 text-body focus:border-brand-calm-600 focus:outline-none"
          >
            {allowDeptLevel && (
              <option value="">All teams (department-wide)</option>
            )}
            {teams.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name} only
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Body */}
      <div className="flex flex-col gap-100">
        <label
          htmlFor="instr-body"
          className="text-body-sm font-medium text-neutral-700"
        >
          Notes
          <span className="ml-100 font-normal text-neutral-500">
            (optional, max 2000 characters)
          </span>
        </label>
        <textarea
          id="instr-body"
          name="body"
          rows={4}
          maxLength={2000}
          placeholder="Add any notes or instructions here…"
          className="resize-none rounded-200 border border-neutral-300 px-300 py-150 text-body placeholder:text-neutral-400 focus:border-brand-calm-600 focus:outline-none"
        />
      </div>

      {/* File attachment */}
      <div className="flex flex-col gap-100">
        <label
          htmlFor="instr-attachment"
          className="text-body-sm font-medium text-neutral-700"
        >
          Attachment
          <span className="ml-100 font-normal text-neutral-500">
            (optional — image or PDF/Word, max 25 MB)
          </span>
        </label>
        <input
          id="instr-attachment"
          name="attachment"
          type="file"
          accept="image/*,.pdf,.doc,.docx,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
          className="text-body-sm text-neutral-700 file:mr-200 file:rounded-200 file:border-0 file:bg-neutral-100 file:px-200 file:py-100 file:text-body-sm file:font-medium file:text-neutral-700 hover:file:bg-neutral-200"
        />
      </div>

      {error && (
        <p className="text-body-sm text-semantic-error">{error}</p>
      )}

      <div className="flex items-center gap-200">
        <button
          type="submit"
          disabled={isPending}
          className="rounded-200 bg-brand-calm-600 px-300 py-150 text-body-sm font-semibold text-neutral-0 transition-opacity duration-fast hover:opacity-90 disabled:opacity-50"
        >
          {isPending ? "Posting…" : "Post instruction"}
        </button>
        <button
          type="button"
          onClick={() => {
            setIsOpen(false);
            setError(null);
          }}
          className="text-body-sm text-neutral-600 hover:text-neutral-950"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
