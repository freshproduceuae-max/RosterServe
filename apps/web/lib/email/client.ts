import { Resend } from "resend";

/**
 * getResendClient
 *
 * Returns a Resend instance when RESEND_API_KEY is present, or null when absent.
 * Callers handle the null case — no email is sent and no error is thrown.
 *
 * Use ONLY in server-side code (Server Actions, Route Handlers, lib layer).
 */
export function getResendClient(): Resend | null {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return null;
  return new Resend(apiKey);
}
