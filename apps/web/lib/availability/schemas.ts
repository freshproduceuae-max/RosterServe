import { z } from "zod";

export const addBlockoutSchema = z.object({
  date: z.string().date("Please enter a valid date"),
  reason: z.string().max(200, "Reason must be 200 characters or fewer").optional(),
});

export type AddBlockoutInput = z.infer<typeof addBlockoutSchema>;
