"use client";

import { useTransition, useState } from "react";
import { requestAccountDeletion } from "@/lib/actions/account";

export default function AccountSettingsPage() {
  const [deleteConfirm, setDeleteConfirm] = useState("");
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleDelete() {
    setError(null);
    startTransition(async () => {
      const result = await requestAccountDeletion();
      if (result?.error) setError(result.error);
    });
  }

  return (
    <div className="flex flex-col gap-500 max-w-prose">
      <div>
        <h1 className="font-display text-h1 text-neutral-950">Account</h1>
        <p className="mt-100 text-body-sm text-neutral-600">
          Manage your personal data and account.
        </p>
      </div>

      {/* Download my data */}
      <div className="rounded-200 border border-neutral-200 bg-neutral-0 p-400 flex flex-col gap-200">
        <div>
          <h2 className="font-display text-h2 text-neutral-950">Download my data</h2>
          <p className="mt-100 text-body-sm text-neutral-600">
            Export a copy of your profile, service requests, skills, and interest records as JSON.
          </p>
        </div>
        <a
          href="/api/export/my-data"
          download="my-rosterserve-data.json"
          className="inline-flex w-fit items-center rounded-200 border border-neutral-300 bg-neutral-0 px-300 py-150 text-body-sm font-semibold text-neutral-950 transition-colors duration-fast hover:bg-neutral-100"
        >
          Download my data
        </a>
      </div>

      {/* Delete my account */}
      <div className="rounded-200 border border-semantic-error/20 bg-semantic-error/5 p-400 flex flex-col gap-300">
        <div>
          <h2 className="font-display text-h2 text-neutral-950">Delete my account</h2>
          <p className="mt-100 text-body-sm text-neutral-600">
            Your account will be flagged for deletion and reviewed by an admin. You will be signed
            out immediately. This action cannot be undone.
          </p>
        </div>

        <div className="flex flex-col gap-100">
          <label
            htmlFor="deleteConfirm"
            className="text-body-sm font-semibold text-neutral-800"
          >
            Type DELETE to confirm
          </label>
          <input
            id="deleteConfirm"
            type="text"
            value={deleteConfirm}
            onChange={(e) => setDeleteConfirm(e.target.value)}
            placeholder="DELETE"
            className="w-fit rounded-200 border border-neutral-300 bg-neutral-0 px-300 py-200 text-body text-neutral-950 outline-none transition-colors duration-fast focus:border-semantic-error focus:ring-2 focus:ring-semantic-error/20"
          />
        </div>

        {error && <p className="text-body-sm text-semantic-error">{error}</p>}

        <button
          onClick={handleDelete}
          disabled={deleteConfirm !== "DELETE" || isPending}
          className="w-fit rounded-200 bg-semantic-error px-400 py-200 text-body font-semibold text-neutral-0 transition-opacity duration-fast hover:opacity-90 disabled:opacity-40"
        >
          {isPending ? "Processing…" : "Delete my account"}
        </button>
      </div>
    </div>
  );
}
