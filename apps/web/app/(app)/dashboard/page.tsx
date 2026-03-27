import { redirect } from "next/navigation";
import { getSessionWithProfile } from "@/lib/auth/session";
import { isLeaderRole, ROLE_LABELS } from "@/lib/auth/roles";

export default async function DashboardPage() {
  const session = await getSessionWithProfile();

  if (!session) {
    redirect("/sign-in");
  }

  const { profile } = session;
  const leader = isLeaderRole(profile.role);

  return (
    <div className="flex flex-col gap-300">
      <article
        className={[
          "rounded-300 border border-neutral-300 p-500 shadow-soft",
          leader ? "bg-surface-cool" : "bg-surface-warm",
        ].join(" ")}
      >
        <p className="font-mono text-mono uppercase text-neutral-600">
          {ROLE_LABELS[profile.role]}
        </p>
        <h2 className="mt-200 font-display text-h2 text-neutral-950">
          {profile.display_name || "Welcome"}
        </h2>
        <p className="mt-200 text-body-sm text-neutral-600">
          {leader
            ? "Your leadership dashboard will appear here as features are built."
            : "Your volunteer dashboard will appear here as features are built."}
        </p>
      </article>
    </div>
  );
}
