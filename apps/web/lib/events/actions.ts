"use server";

import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin-client";
import { getSessionWithProfile } from "@/lib/auth/session";
import { canManageEvents } from "@/lib/auth/roles";
import {
  createEventSchema,
  updateEventSchema,
  transitionStatusSchema,
  copyEventSchema,
} from "./schemas";
import { computeStubDates } from "./recurrence";
import type { RecurrenceRule } from "./types";

export type EventActionResult = { error: string } | { success: true } | undefined;

// ---------------------------------------------------------------------------
// Private helper — NOT exported
// ---------------------------------------------------------------------------

async function generateStubs(
  parentEventId: string,
  parentTitle: string,
  parentEventType: string,
  parentEventDate: string,
  recurrenceRule: RecurrenceRule,
  createdBy: string
): Promise<void> {
  const adminClient = createSupabaseAdminClient();
  if (!adminClient) {
    console.error("[generateStubs] Admin client unavailable — stubs not generated for", parentEventId);
    return;
  }

  // Collect existing active stub dates to avoid duplicates
  const { data: existing } = await adminClient
    .from("events")
    .select("event_date")
    .eq("parent_event_id", parentEventId)
    .eq("is_stub", true)
    .is("deleted_at", null);

  const existingDates = new Set((existing ?? []).map((r: { event_date: string }) => r.event_date));

  const stubDates = computeStubDates(parentEventDate, recurrenceRule, 12);
  const newDates = stubDates.filter((d) => !existingDates.has(d));

  if (newDates.length === 0) return;

  const stubs = newDates.map((date) => ({
    title: parentTitle,
    event_type: parentEventType,
    event_date: date,
    status: "draft" as const,
    is_recurring: true,
    recurrence_rule: recurrenceRule,
    parent_event_id: parentEventId,
    is_stub: true,
    created_by: createdBy,
  }));

  const { data: insertedStubs, error: stubError } = await adminClient
    .from("events")
    .insert(stubs)
    .select("id, event_date");

  if (stubError) {
    console.error("[generateStubs] Stub insert failed:", stubError);
    return;
  }

  // Inherit event_departments from parent
  const { data: parentDepts } = await adminClient
    .from("event_departments")
    .select("department_id")
    .eq("event_id", parentEventId);

  const deptIds = (parentDepts ?? []).map((r: { department_id: string }) => r.department_id);

  if (deptIds.length > 0 && insertedStubs && insertedStubs.length > 0) {
    const edRows = (insertedStubs as { id: string }[]).flatMap((stub) =>
      deptIds.map((deptId: string) => ({
        event_id: stub.id,
        department_id: deptId,
      }))
    );
    const { error: edError } = await adminClient.from("event_departments").insert(edRows);
    if (edError) {
      console.error("[generateStubs] event_departments insert failed:", edError);
    }
  }
}

// ---------------------------------------------------------------------------
// Public server actions
// ---------------------------------------------------------------------------

export async function createEvent(
  _prev: EventActionResult,
  formData: FormData
): Promise<EventActionResult> {
  const session = await getSessionWithProfile();
  if (!session || !canManageEvents(session.profile)) {
    return { error: "You do not have permission to create events." };
  }

  const parsed = createEventSchema.safeParse({
    title: formData.get("title"),
    eventType: formData.get("eventType"),
    eventDate: formData.get("eventDate"),
    isRecurring: formData.get("isRecurring") === "true",
    recurrenceRule: formData.get("recurrenceRule") || undefined,
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("events")
    .insert({
      title: parsed.data.title,
      event_type: parsed.data.eventType,
      event_date: parsed.data.eventDate,
      is_recurring: parsed.data.isRecurring,
      recurrence_rule: parsed.data.recurrenceRule ?? null,
      created_by: session.user.id,
    })
    .select("id")
    .single();

  if (error) {
    return { error: "This event could not be created. Please try again." };
  }

  if (parsed.data.isRecurring && parsed.data.recurrenceRule) {
    await generateStubs(
      data.id,
      parsed.data.title,
      parsed.data.eventType,
      parsed.data.eventDate,
      parsed.data.recurrenceRule,
      session.user.id
    );
  }

  redirect(`/events/${data.id}`);
}

export async function updateEvent(
  _prev: EventActionResult,
  formData: FormData
): Promise<EventActionResult> {
  const session = await getSessionWithProfile();
  if (!session || !canManageEvents(session.profile)) {
    return { error: "You do not have permission to edit events." };
  }

  const parsed = updateEventSchema.safeParse({
    id: formData.get("id"),
    title: formData.get("title"),
    eventType: formData.get("eventType"),
    eventDate: formData.get("eventDate"),
    isRecurring: formData.get("isRecurring") === "true",
    recurrenceRule: formData.get("recurrenceRule") || undefined,
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("events")
    .update({
      title: parsed.data.title,
      event_type: parsed.data.eventType,
      event_date: parsed.data.eventDate,
      is_recurring: parsed.data.isRecurring,
      recurrence_rule: parsed.data.recurrenceRule ?? null,
    })
    .eq("id", parsed.data.id)
    .is("deleted_at", null);

  if (error) {
    return { error: "This event could not be saved. Please try again." };
  }

  // Re-run stub generation for the updated date if still recurring.
  // generateStubs skips dates already in existingDates, so this is safe on every update.
  if (parsed.data.isRecurring && parsed.data.recurrenceRule) {
    await generateStubs(
      parsed.data.id,
      parsed.data.title,
      parsed.data.eventType,
      parsed.data.eventDate,
      parsed.data.recurrenceRule,
      session.user.id
    );
  }

  redirect(`/events/${parsed.data.id}`);
}

export async function transitionEventStatus(
  _prev: EventActionResult,
  formData: FormData
): Promise<EventActionResult> {
  const session = await getSessionWithProfile();
  if (!session || !canManageEvents(session.profile)) {
    return { error: "You do not have permission to change event status." };
  }

  const parsed = transitionStatusSchema.safeParse({
    id: formData.get("id"),
    newStatus: formData.get("newStatus"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("events")
    .update({ status: parsed.data.newStatus })
    .eq("id", parsed.data.id)
    .is("deleted_at", null);

  if (error) {
    // The database trigger raises an exception for invalid transitions
    if (error.message?.includes("Invalid event status transition")) {
      return { error: "This status change is not allowed." };
    }
    return { error: "Could not update event status. Please try again." };
  }

  redirect(`/events/${parsed.data.id}`);
}

export async function softDeleteEvent(
  _prev: EventActionResult,
  formData: FormData
): Promise<EventActionResult> {
  const session = await getSessionWithProfile();
  if (!session || !canManageEvents(session.profile)) {
    return { error: "You do not have permission to delete events." };
  }

  const id = formData.get("id");
  if (typeof id !== "string" || !id) {
    return { error: "Invalid event ID." };
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("events")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id)
    .is("deleted_at", null);

  if (error) {
    return { error: "Could not delete event. Please try again." };
  }

  // Cascade soft-delete to draft stubs only.
  // Completed/published stubs represent served history and must not be touched.
  // TODO: Consider a DB-level cascade trigger in a follow-up if admin client is unavailable.
  const adminClient = createSupabaseAdminClient();
  if (adminClient) {
    await adminClient
      .from("events")
      .update({ deleted_at: new Date().toISOString() })
      .eq("parent_event_id", id)
      .eq("is_stub", true)
      .eq("status", "draft")
      .is("deleted_at", null);
  }

  redirect("/events");
}

export async function copyEvent(
  _prev: EventActionResult,
  formData: FormData
): Promise<EventActionResult> {
  const session = await getSessionWithProfile();
  if (!session || !canManageEvents(session.profile)) {
    return { error: "You do not have permission to copy events." };
  }

  const parsed = copyEventSchema.safeParse({ sourceEventId: formData.get("sourceEventId") });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const supabase = await createSupabaseServerClient();

  // Fetch source event
  const { data: source, error: fetchError } = await supabase
    .from("events")
    .select("title, event_type, event_date")
    .eq("id", parsed.data.sourceEventId)
    .is("deleted_at", null)
    .single();

  if (fetchError || !source) return { error: "Source event not found." };

  // Insert copy — standalone, not recurring, not a stub
  const { data: copy, error: insertError } = await supabase
    .from("events")
    .insert({
      title: `${source.title} (copy)`,
      event_type: source.event_type,
      event_date: source.event_date,
      status: "draft",
      is_recurring: false,
      created_by: session.user.id,
    })
    .select("id")
    .single();

  if (insertError || !copy) return { error: "Could not copy event. Please try again." };

  // Copy event_departments rows
  const adminClient = createSupabaseAdminClient();
  if (adminClient) {
    const { data: srcDepts } = await adminClient
      .from("event_departments")
      .select("department_id")
      .eq("event_id", parsed.data.sourceEventId);

    if (srcDepts && srcDepts.length > 0) {
      await adminClient.from("event_departments").insert(
        srcDepts.map((r: { department_id: string }) => ({
          event_id: copy.id,
          department_id: r.department_id,
        }))
      );
    }
  }

  redirect(`/events/${copy.id}`);
}

export async function addEventDepartment(
  _prev: EventActionResult,
  formData: FormData
): Promise<EventActionResult> {
  const session = await getSessionWithProfile();
  if (!session || !canManageEvents(session.profile)) {
    return { error: "You do not have permission to manage event departments." };
  }

  const eventId = formData.get("eventId");
  const departmentId = formData.get("departmentId");
  if (typeof eventId !== "string" || typeof departmentId !== "string") {
    return { error: "Invalid input." };
  }

  // Verify the event is visible to this user (respects RLS — confirms existence + access)
  const supabase = await createSupabaseServerClient();
  const { data: eventCheck } = await supabase
    .from("events")
    .select("id, created_by")
    .eq("id", eventId)
    .is("deleted_at", null)
    .maybeSingle();
  if (!eventCheck) return { error: "Event not found or access denied." };

  // For dept_head: also verify they own the department they're linking
  if (session.profile.role === "dept_head") {
    const { data: deptCheck } = await supabase
      .from("departments")
      .select("id")
      .eq("id", departmentId)
      .eq("owner_id", session.profile.id)
      .is("deleted_at", null)
      .maybeSingle();
    if (!deptCheck) return { error: "You do not own this department." };
  }

  // Use admin client to insert into event_departments (bypasses RLS for stubs)
  const adminClient = createSupabaseAdminClient();
  if (!adminClient) return { error: "Service unavailable." };

  // Insert for the parent event
  const { error } = await adminClient
    .from("event_departments")
    .insert({ event_id: eventId, department_id: departmentId });

  if (error && error.code !== "23505") { // 23505 = unique violation (already linked)
    return { error: "Could not link department to event." };
  }

  // Cascade to active draft stubs
  const { data: stubs } = await adminClient
    .from("events")
    .select("id")
    .eq("parent_event_id", eventId)
    .eq("is_stub", true)
    .eq("status", "draft")
    .is("deleted_at", null);

  if (stubs && stubs.length > 0) {
    const stubRows = (stubs as { id: string }[]).map((s) => ({
      event_id: s.id,
      department_id: departmentId,
    }));
    await adminClient
      .from("event_departments")
      .upsert(stubRows, { onConflict: "event_id,department_id", ignoreDuplicates: true });
  }

  return { success: true };
}
