import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { SessionWithProfile, Profile } from "./types";

export async function getSessionWithProfile(): Promise<SessionWithProfile | null> {
  const supabase = await createSupabaseServerClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) return null;

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .is("deleted_at", null)
    .single<Profile>();

  if (profileError || !profile) return null;

  return {
    user: { id: user.id, email: user.email ?? "" },
    profile,
  };
}
