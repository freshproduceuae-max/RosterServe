import { redirect } from "next/navigation";
import { getSessionWithProfile } from "@/lib/auth/session";
import { isLeaderRole } from "@/lib/auth/roles";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getMyBlockouts, getBlockoutsForScope, getVolunteersInScope } from "@/lib/availability/queries";
import type { AvailabilityPreferences } from "@/lib/onboarding/types";
import { VolunteerAvailabilityView } from "./_components/volunteer-availability-view";
import { LeaderAvailabilityView } from "./_components/leader-availability-view";

export default async function AvailabilityPage() {
  const session = await getSessionWithProfile();
  if (!session) redirect("/sign-in");

  const { profile } = session;

  if (profile.role === "volunteer") {
    const supabase = await createSupabaseServerClient();
    const [blockouts, preferencesRes] = await Promise.all([
      getMyBlockouts(profile.id),
      supabase
        .from("availability_preferences")
        .select("*")
        .eq("volunteer_id", profile.id)
        .maybeSingle<AvailabilityPreferences>(),
    ]);

    return (
      <div className="mx-auto max-w-prose">
        <VolunteerAvailabilityView
          blockouts={blockouts}
          preferences={preferencesRes.data ?? null}
        />
      </div>
    );
  }

  if (profile.role === "supporter") {
    const supabase = await createSupabaseServerClient();
    const [blockouts, preferencesRes] = await Promise.all([
      getMyBlockouts(profile.id),
      supabase
        .from("availability_preferences")
        .select("*")
        .eq("volunteer_id", profile.id)
        .maybeSingle<AvailabilityPreferences>(),
    ]);
    return (
      <div className="mx-auto max-w-prose">
        <VolunteerAvailabilityView
          blockouts={blockouts}
          preferences={preferencesRes.data ?? null}
        />
      </div>
    );
  }

  if (isLeaderRole(profile.role)) {
    const [volunteersInScope, blockouts] = await Promise.all([
      getVolunteersInScope(),
      getBlockoutsForScope(),
    ]);

    return (
      <LeaderAvailabilityView
        volunteersInScope={volunteersInScope}
        blockouts={blockouts}
        role={profile.role}
      />
    );
  }

  redirect("/dashboard");
}
