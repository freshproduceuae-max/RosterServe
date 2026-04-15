import { z } from "zod";
import { EVENT_TYPES, EVENT_STATUSES, RECURRENCE_RULES } from "./types";

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
  isRecurring: z.boolean().default(false),
  recurrenceRule: z.enum(RECURRENCE_RULES).optional(),
}).refine(
  (data) => !data.isRecurring || !!data.recurrenceRule,
  { message: "Please select a recurrence pattern.", path: ["recurrenceRule"] }
);

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
  isRecurring: z.boolean().default(false),
  recurrenceRule: z.enum(RECURRENCE_RULES).optional(),
}).refine(
  (data) => !data.isRecurring || !!data.recurrenceRule,
  { message: "Please select a recurrence pattern.", path: ["recurrenceRule"] }
);

export const transitionStatusSchema = z.object({
  id: z.string().uuid("Invalid event ID."),
  newStatus: z.enum(EVENT_STATUSES, {
    error: "Invalid status.",
  }),
});

export const copyEventSchema = z.object({
  sourceEventId: z.string().uuid("Invalid source event ID."),
});

export type CreateEventValues = z.infer<typeof createEventSchema>;
export type UpdateEventValues = z.infer<typeof updateEventSchema>;
