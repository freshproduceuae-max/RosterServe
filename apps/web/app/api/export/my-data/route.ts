import { NextResponse } from "next/server";
import { getSessionWithProfile } from "@/lib/auth/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET() {
  const session = await getSessionWithProfile();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = await createSupabaseServerClient();
  const userId = session.profile.id;

  const [profileResult, assignmentsResult, skillClaimsResult, interestRequestsResult] =
    await Promise.all([
      supabase
        .from("profiles")
        .select("id, display_name, role, created_at")
        .eq("id", userId)
        .single(),

      supabase
        .from("assignments")
        .select("id, event_id, department_id, sub_team_id, status, created_at")
        .eq("volunteer_id", userId)
        .is("deleted_at", null)
        .order("created_at", { ascending: false }),

      supabase
        .from("skill_claims")
        .select("id, skill_id, status, created_at")
        .eq("volunteer_id", userId)
        .is("deleted_at", null)
        .order("created_at", { ascending: false }),

      supabase
        .from("interest_requests")
        .select("id, department_id, status, created_at")
        .eq("volunteer_id", userId)
        .is("deleted_at", null)
        .order("created_at", { ascending: false }),
    ]);

  const data = {
    exported_at: new Date().toISOString(),
    profile: profileResult.data ?? null,
    assignments: assignmentsResult.data ?? [],
    skill_claims: skillClaimsResult.data ?? [],
    interest_requests: interestRequestsResult.data ?? [],
  };

  return new Response(JSON.stringify(data, null, 2), {
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": 'attachment; filename="my-rosterserve-data.json"',
    },
  });
}
