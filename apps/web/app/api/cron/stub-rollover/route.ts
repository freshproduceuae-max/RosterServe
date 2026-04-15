import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin-client";
import { computeStubDates } from "@/lib/events/recurrence";
import type { RecurrenceRule } from "@/lib/events/types";

/**
 * GET /api/cron/stub-rollover
 *
 * Secured by Authorization: Bearer <CRON_SECRET>.
 * For each active recurring parent event, checks whether the furthest-future
 * active stub is within 14 days of today. If so, appends one new stub to
 * keep the 12-occurrence horizon rolling forward.
 *
 * Returns JSON: { created: number, skipped: number, errors: number }
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    return NextResponse.json({ error: "CRON_SECRET not configured" }, { status: 500 });
  }
  if (request.headers.get("authorization") !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const adminClient = createSupabaseAdminClient();
  if (!adminClient) {
    return NextResponse.json(
      { error: "Admin client unavailable — SUPABASE_SERVICE_ROLE_KEY not set" },
      { status: 500 }
    );
  }

  const horizon = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  // Find recurring parent events that have stubs whose max date <= horizon
  const { data: parents, error: parentError } = await adminClient
    .from("events")
    .select("id, title, event_type, event_date, recurrence_rule, created_by")
    .eq("is_recurring", true)
    .eq("is_stub", false)
    .is("deleted_at", null);

  if (parentError) {
    return NextResponse.json({ error: "Parent query failed" }, { status: 500 });
  }

  let created = 0, skipped = 0, errors = 0;

  for (const parent of (parents ?? []) as {
    id: string; title: string; event_type: string;
    event_date: string; recurrence_rule: RecurrenceRule; created_by: string;
  }[]) {
    try {
      const { data: stubs } = await adminClient
        .from("events")
        .select("event_date")
        .eq("parent_event_id", parent.id)
        .eq("is_stub", true)
        .is("deleted_at", null)
        .order("event_date", { ascending: false })
        .limit(1);

      const latestStubDate = stubs?.[0]?.event_date ?? parent.event_date;

      if (latestStubDate > horizon) {
        skipped++;
        continue;
      }

      // Generate one new stub from the latest existing stub date
      const [nextDate] = computeStubDates(latestStubDate, parent.recurrence_rule, 1);

      const { data: inserted, error: insertError } = await adminClient
        .from("events")
        .insert({
          title: parent.title,
          event_type: parent.event_type,
          event_date: nextDate,
          status: "draft",
          is_recurring: true,
          recurrence_rule: parent.recurrence_rule,
          parent_event_id: parent.id,
          is_stub: true,
          created_by: parent.created_by,
        })
        .select("id")
        .single();

      if (insertError || !inserted) {
        errors++;
        continue;
      }

      // Inherit departments
      const { data: parentDepts } = await adminClient
        .from("event_departments")
        .select("department_id")
        .eq("event_id", parent.id);

      const deptIds = (parentDepts ?? []).map((r: { department_id: string }) => r.department_id);
      if (deptIds.length > 0) {
        await adminClient.from("event_departments").insert(
          deptIds.map((deptId: string) => ({
            event_id: (inserted as { id: string }).id,
            department_id: deptId,
          }))
        );
      }

      created++;
    } catch (err) {
      console.error("[cron/stub-rollover] error for parent", parent.id, err);
      errors++;
    }
  }

  return NextResponse.json({ created, skipped, errors });
}
