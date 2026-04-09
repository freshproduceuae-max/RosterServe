import { createClient } from "@supabase/supabase-js";

/**
 * createSupabaseAdminClient
 *
 * Returns a Supabase client authenticated with the service role key.
 * Use ONLY in server-side code (Server Actions, Route Handlers, lib layer).
 * Never import from client components.
 *
 * Returns null when SUPABASE_SERVICE_ROLE_KEY is not set so callers can
 * degrade gracefully (e.g. email lookup fails silently).
 */
export function createSupabaseAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    return null;
  }

  return createClient(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
