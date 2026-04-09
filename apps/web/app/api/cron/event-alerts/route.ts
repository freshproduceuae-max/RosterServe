import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createSupabaseAdminClient } from "@/lib/supabase/admin-client";
import { sendPreEventLeaderAlert } from "@/lib/email/send";
import { getPublicEnv } from "@/lib/env";

/**
 * GET /api/cron/event-alerts
 *
 * Secured by Authorization: Bearer <CRON_SECRET>.
 * Finds all published events whose event_date is exactly 2 or 5 days from
 * today (UTC). For each event+department, fetches the dept_head email and
 * sends a pre-event roster-health alert.
 *
 * Returns JSON: { processed: number, skipped: number, errors: number }
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    return NextResponse.json({ error: "CRON_SECRET not configured" }, { status: 500 });
  }
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const adminClient = createSupabaseAdminClient();
  if (!adminClient) {
    return NextResponse.json(
      { error: "Admin client unavailable — SUPABASE_SERVICE_ROLE_KEY not set" },
      { status: 500 },
    );
  }

  const now = new Date();
  const toDateString = (offsetDays: number): string => {
    const d = new Date(now);
    d.setUTCDate(d.getUTCDate() + offsetDays);
    return d.toISOString().slice(0, 10);
  };
  const date2 = toDateString(2);
  const date5 = toDateString(5);

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  const db = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: events, error: eventsError } = await db
    .from("events")
    .select("id, title, event_date")
    .in("event_date", [date2, date5])
    .eq("status", "published")
    .is("deleted_at", null);

  if (eventsError) {
    console.error("[cron/event-alerts] events query failed:", eventsError);
    return NextResponse.json({ error: "Events query failed" }, { status: 500 });
  }

  if (!events || events.length === 0) {
    return NextResponse.json({ processed: 0, skipped: 0, errors: 0 });
  }

  const { siteUrl } = getPublicEnv();
  let processed = 0;
  let skipped = 0;
  let errors = 0;

  for (const event of events as { id: string; title: string; event_date: string }[]) {
    const daysUntil: 2 | 5 = event.event_date === date2 ? 2 : 5;

    const { data: deptRows, error: deptError } = await db
      .from("assignments")
      .select("department_id")
      .eq("event_id", event.id)
      .is("deleted_at", null);

    if (deptError) {
      console.error("[cron/event-alerts] dept query failed for event", event.id, deptError);
      errors++;
      continue;
    }

    const departmentIds = [
      ...new Set(
        (deptRows ?? []).map((r: { department_id: string }) => r.department_id),
      ),
    ];

    for (const deptId of departmentIds) {
      try {
        const { data: deptRow } = await db
          .from("departments")
          .select("owner_id")
          .eq("id", deptId)
          .is("deleted_at", null)
          .single();

        if (!deptRow?.owner_id) {
          skipped++;
          continue;
        }

        const { data: ownerAuth } = await adminClient.auth.admin.getUserById(deptRow.owner_id);
        const deptHeadEmail = ownerAuth?.user?.email;
        if (!deptHeadEmail) {
          skipped++;
          continue;
        }

        const { data: counts } = await db
          .from("assignments")
          .select("status")
          .eq("event_id", event.id)
          .eq("department_id", deptId)
          .is("deleted_at", null);

        const statusRows = (counts ?? []) as { status: string }[];
        const accepted = statusRows.filter((r) => r.status === "accepted").length;
        const pending = statusRows.filter((r) => r.status === "invited").length;
        const declined = statusRows.filter((r) => r.status === "declined").length;

        await sendPreEventLeaderAlert(deptHeadEmail, {
          eventTitle: event.title,
          eventDate: event.event_date,
          daysUntil,
          accepted,
          pending,
          declined,
          siteUrl,
        });

        processed++;
      } catch (err) {
        console.error(
          "[cron/event-alerts] alert failed for event",
          event.id,
          "dept",
          deptId,
          err,
        );
        errors++;
      }
    }
  }

  return NextResponse.json({ processed, skipped, errors });
}
