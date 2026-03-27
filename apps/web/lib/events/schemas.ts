import { z } from "zod";
import { EVENT_TYPES, EVENT_STATUSES } from "./types";

export const createEventSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, "Title is required.")
    .max(200, "Title must be under 200 characters."),
  eventType: z.enum(EVENT_TYPES, {
    error: "Please select an event type.",
  }),
  eventDate: z.string().min(1, "Event date is required.").refine(
    (val) => !isNaN(Date.parse(val)),
    { message: "Please enter a valid date." }
  ),
});

export const updateEventSchema = z.object({
  id: z.string().uuid("Invalid event ID."),
  title: z
    .string()
    .trim()
    .min(1, "Title is required.")
    .max(200, "Title must be under 200 characters."),
  eventType: z.enum(EVENT_TYPES, {
    error: "Please select an event type.",
  }),
  eventDate: z.string().min(1, "Event date is required.").refine(
    (val) => !isNaN(Date.parse(val)),
    { message: "Please enter a valid date." }
  ),
});

export const transitionStatusSchema = z.object({
  id: z.string().uuid("Invalid event ID."),
  newStatus: z.enum(EVENT_STATUSES, {
    error: "Invalid status.",
  }),
});

export type CreateEventValues = z.infer<typeof createEventSchema>;
export type UpdateEventValues = z.infer<typeof updateEventSchema>;
