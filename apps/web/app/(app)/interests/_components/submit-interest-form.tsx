"use client";

import { useState, useTransition } from "react";
import { submitInterest } from "@/lib/interests/actions";
import type { DepartmentForInterestSubmit } from "@/lib/interests/types";

export function SubmitInterestForm({
  availableDepartments,
}: {
  availableDepartments: DepartmentForInterestSubmit[];
}) {
  const [departmentId, setDepartmentId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [isPending, startTransition] = useTransition();

  if (availableDepartments.length === 0) {
    return (
      <p className="text-body-sm text-neutral-600">
        You have submitted interest in all available departments.
      </p>
    );
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSuccess(false);
    startTransition(async () => {
      const result = await submitInterest(departmentId);
      if (result?.error) {
        setError(result.error);
      } else {
        setSuccess(true);
        setDepartmentId("");
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-300">
      <h3 className="text-h3 text-neutral-950">Join a department</h3>

      <select
        value={departmentId}
        onChange={(e) => {
          setDepartmentId(e.target.value);
          setError(null);
          setSuccess(false);
        }}
        disabled={isPending}
        className="rounded-200 border border-neutral-300 bg-neutral-0 px-300 py-200 text-body text-neutral-950 focus:border-brand-calm-600 focus:outline-none focus:ring-2 focus:ring-brand-calm-600/20 disabled:opacity-50"
      >
        <option value="" disabled>
          Select a department
        </option>
        {availableDepartments.map((dept) => (
          <option key={dept.id} value={dept.id}>
            {dept.name}
          </option>
        ))}
      </select>

      {error && <p className="text-body-sm text-semantic-error">{error}</p>}
      {success && (
        <p className="text-body-sm text-neutral-600">
          Your interest has been submitted.
        </p>
      )}

      <button
        type="submit"
        disabled={departmentId === "" || isPending}
        className="self-start rounded-200 bg-brand-calm-600 px-400 py-200 text-body font-semibold text-neutral-0 transition-colors duration-fast hover:bg-brand-calm-600/90 disabled:opacity-50"
      >
        {isPending ? "Submitting…" : "Submit interest"}
      </button>
    </form>
  );
}
