"use server";

import { redirect } from "next/navigation";
import { getSessionWithProfile } from "@/lib/auth/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin-client";

export async function requestAccountDeletion(): Promise<{ error?: string }> {
  const session = await getSessionWithProfile();
  if (!session) return { error: "Unauthorized" };

  const supabase = await createSupabaseServerClient();
  const userId = session.profile.id;

  // Soft-delete the profile
  const { error: profileError } = await supabase
    .from("profiles")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", userId);

  if (profileError) return { error: "Failed to process deletion request. Please try again." };

  // Record the deletion request. The partial unique index (WHERE status='pending')
  // enforces at most one pending request per user. On retry, the insert hits the
  // conflict and returns error code 23505 — treat that as success (idempotent).
  const { error: requestError } = await supabase
    .from("account_deletion_requests")
    .insert({ user_id: userId });

  if (requestError && requestError.code !== "23505") {
    // Roll back the soft-delete on genuine errors only
    const { error: rollbackError } = await supabase
      .from("profiles")
      .update({ deleted_at: null })
      .eq("id", userId);

    if (rollbackError) {
      // Profile is soft-deleted but no request was recorded — admin intervention needed
      console.error("requestAccountDeletion: rollback failed", rollbackError);
      return { error: "Deletion request failed and profile state could not be restored. Please contact support." };
    }

    return { error: "Failed to process deletion request. Please try again." };
  }

  // Sign out must be awaited before redirect
  await supabase.auth.signOut();

  redirect("/sign-in");
}

export async function approveAccountDeletion(
  userId: string,
  requestId: string,
): Promise<{ error?: string; success?: boolean }> {
  const session = await getSessionWithProfile();
  if (!session || session.profile.role !== "super_admin") {
    return { error: "Unauthorized" };
  }

  const adminClient = createSupabaseAdminClient();
  if (!adminClient) {
    return { error: "Service role key not configured. Cannot hard-delete auth user." };
  }

  const supabase = await createSupabaseServerClient();

  // Stamp the audit record FIRST — profile CASCADE will delete it if we delete profile first
  const { error: updateError } = await supabase
    .from("account_deletion_requests")
    .update({
      status: "approved",
      reviewed_at: new Date().toISOString(),
      reviewed_by: session.profile.id,
    })
    .eq("id", requestId);

  if (updateError) return { error: "Failed to record approval. No data has been deleted." };

  // Hard-delete the profile row (CASCADE deletes the now-stamped request row)
  const { error: profileError } = await supabase
    .from("profiles")
    .delete()
    .eq("id", userId);

  if (profileError) return { error: "Failed to delete profile." };

  // Hard-delete the Supabase Auth user
  const { error: authError } = await adminClient.auth.admin.deleteUser(userId);
  if (authError) return { error: "Profile deleted but auth user removal failed." };

  return { success: true };
}

export async function rejectAccountDeletion(
  userId: string,
  requestId: string,
): Promise<{ error?: string; success?: boolean }> {
  const session = await getSessionWithProfile();
  if (!session || session.profile.role !== "super_admin") {
    return { error: "Unauthorized" };
  }

  const supabase = await createSupabaseServerClient();

  // Restore the profile soft-delete
  const { error: restoreError } = await supabase
    .from("profiles")
    .update({ deleted_at: null })
    .eq("id", userId);

  if (restoreError) return { error: "Failed to restore profile." };

  // Mark the request as rejected
  const { error: updateError } = await supabase
    .from("account_deletion_requests")
    .update({
      status: "rejected",
      reviewed_at: new Date().toISOString(),
      reviewed_by: session.profile.id,
    })
    .eq("id", requestId);

  if (updateError) return { error: "Profile restored but request status not updated." };

  return { success: true };
}
