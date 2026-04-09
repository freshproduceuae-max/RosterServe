"use server";

import { getResendClient } from "@/lib/email/client";

export async function sendBugReport(
  description: string,
): Promise<{ error?: string; success?: boolean }> {
  if (!description.trim()) return { error: "Please describe the issue." };
  if (description.length > 2000) return { error: "Description is too long." };

  const resend = getResendClient();
  if (!resend) {
    console.error("[sendBugReport] Bug report (Resend not configured):", description);
    return { success: true };
  }

  const developerEmail = process.env.DEVELOPER_EMAIL;
  if (!developerEmail) {
    console.error("[sendBugReport] DEVELOPER_EMAIL not set. Bug report:", description);
    return { success: true };
  }

  try {
    await resend.emails.send({
      from: "RosterServe <notifications@rosterserve.app>",
      to: developerEmail,
      subject: "RosterServe bug report",
      html: `
        <p><strong>Bug report received</strong></p>
        <p>${description.replace(/\n/g, "<br>")}</p>
        <p><em>Submitted via the in-app bug report form.</em></p>
      `,
    });
  } catch (err) {
    console.error("[sendBugReport] Resend failed:", err);
  }

  return { success: true };
}
