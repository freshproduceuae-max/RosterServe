"use server";

import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSessionWithProfile } from "@/lib/auth/session";
import { canManageEvents } from "@/lib/auth/roles";
import { createEventSchema, updateEventSchema, transitionStatusSchema } from "./schemas";

export type EventActionResult = { error: string } | { success: true } | undefined;

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
      created_by: session.user.id,
    })
    .select("id")
    .single();

  if (error) {
    return { error: "This event could not be created. Please try again." };
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
    })
    .eq("id", parsed.data.id)
    .is("deleted_at", null);

  if (error) {
    return { error: "This event could not be saved. Please try again." };
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

  redirect("/events");
}
