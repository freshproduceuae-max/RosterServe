"use client";

import { useActionState } from "react";
import { grantEventCreation, revokeEventCreation } from "@/lib/events/grants";
import type { GrantableUser, GrantActionResult } from "@/lib/events/grants";
import { ROLE_LABELS } from "@/lib/auth/roles";

function GrantToggle({ user }: { user: GrantableUser }) {
  const action = user.can_create_events ? revokeEventCreation : grantEventCreation;
  const [state, formAction, isPending] = useActionState<
    GrantActionResult | undefined,
    FormData
  >(action, undefined);

  const error = state && "error" in state ? state.error : null;

  return (
    <div className="flex items-center justify-between gap-300 border-b border-neutral-200 py-300 last:border-b-0">
      <div className="flex flex-col gap-050">
        <span className="text-body font-medium text-neutral-950">
          {user.display_name}
        </span>
        <span className="font-mono text-mono uppercase text-neutral-500">
          {ROLE_LABELS[user.role]}
        </span>
        {error && (
          <span className="text-body-sm text-semantic-error">{error}</span>
        )}
      </div>
      <form action={formAction}>
        <input type="hidden" name="userId" value={user.id} />
        <button
          type="submit"
          disabled={isPending}
          className={
            user.can_create_events
              ? "rounded-200 border border-semantic-error/30 bg-neutral-0 px-300 py-150 text-body-sm text-semantic-error transition-colors duration-fast hover:bg-semantic-error/5 disabled:opacity-60"
              : "rounded-200 bg-brand-calm-600 px-300 py-150 text-body-sm font-semibold text-neutral-0 transition-colors duration-fast hover:bg-brand-calm-600/90 disabled:opacity-60"
          }
        >
          {isPending
            ? user.can_create_events
              ? "Revoking…"
              : "Granting…"
            : user.can_create_events
              ? "Revoke"
              : "Grant"}
        </button>
      </form>
    </div>
  );
}

export function GrantList({ users }: { users: GrantableUser[] }) {
  if (users.length === 0) {
    return (
      <div className="rounded-300 border border-neutral-300 bg-neutral-0 p-500 shadow-soft">
        <p className="text-body text-neutral-600">
          No Dept Heads or Team Heads found.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-300 border border-neutral-300 bg-neutral-0 shadow-soft">
      <div className="flex flex-col px-500">
        {users.map((user) => (
          <GrantToggle key={user.id} user={user} />
        ))}
      </div>
    </div>
  );
}
