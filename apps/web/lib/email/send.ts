import { getResendClient } from "./client";

const FROM_ADDRESS = "RosterServe <notifications@rosterserve.app>";

/**
 * sendInvitationEmail
 *
 * Sent to a volunteer or team_head when they receive a new assignment invitation.
 * Silent no-op when Resend client is unavailable.
 */
export async function sendInvitationEmail(
  to: string,
  params: {
    eventTitle: string;
    eventDate: string;
    departmentName: string;
    siteUrl: string;
  },
): Promise<void> {
  const resend = getResendClient();
  if (!resend) return;

  const { eventTitle, eventDate, departmentName, siteUrl } = params;

  try {
    await resend.emails.send({
      from: FROM_ADDRESS,
      to,
      subject: `You've been invited to serve at ${eventTitle}`,
      html: `
        <p>Hi,</p>
        <p>You have been invited to serve in the <strong>${departmentName}</strong> department at <strong>${eventTitle}</strong> on <strong>${eventDate}</strong>.</p>
        <p>Please log in to accept or decline your invitation:</p>
        <p><a href="${siteUrl}/assignments">View your assignments</a></p>
        <p>— RosterServe</p>
      `,
    });
  } catch (err) {
    console.error("[sendInvitationEmail] failed:", err);
  }
}

/**
 * sendResponseEmail
 *
 * Sent to the dept_head when a volunteer or team_head accepts or declines.
 * Silent no-op when Resend client is unavailable.
 */
export async function sendResponseEmail(
  to: string,
  params: {
    volunteerName: string;
    eventTitle: string;
    eventDate: string;
    response: "accepted" | "declined";
    siteUrl: string;
  },
): Promise<void> {
  const resend = getResendClient();
  if (!resend) return;

  const { volunteerName, eventTitle, eventDate, response, siteUrl } = params;
  const verb = response === "accepted" ? "accepted" : "declined";
  const subject =
    response === "accepted"
      ? `${volunteerName} accepted their service request for ${eventTitle}`
      : `${volunteerName} declined their service request for ${eventTitle}`;

  try {
    await resend.emails.send({
      from: FROM_ADDRESS,
      to,
      subject,
      html: `
        <p>Hi,</p>
        <p><strong>${volunteerName}</strong> has <strong>${verb}</strong> their service request for <strong>${eventTitle}</strong> on <strong>${eventDate}</strong>.</p>
        <p><a href="${siteUrl}/events">View event roster</a></p>
        <p>— RosterServe</p>
      `,
    });
  } catch (err) {
    console.error("[sendResponseEmail] failed:", err);
  }
}

/**
 * sendPreEventLeaderAlert
 *
 * Sent to a dept_head 2 or 5 days before an event with current roster counts.
 * Silent no-op when Resend client is unavailable.
 */
export async function sendPreEventLeaderAlert(
  to: string,
  params: {
    eventTitle: string;
    eventDate: string;
    daysUntil: 2 | 5;
    accepted: number;
    pending: number;
    declined: number;
    siteUrl: string;
  },
): Promise<void> {
  const resend = getResendClient();
  if (!resend) return;

  const { eventTitle, eventDate, daysUntil, accepted, pending, declined, siteUrl } = params;

  try {
    await resend.emails.send({
      from: FROM_ADDRESS,
      to,
      subject: `Reminder: ${eventTitle} is in ${daysUntil} days — roster update`,
      html: `
        <p>Hi,</p>
        <p>This is a reminder that <strong>${eventTitle}</strong> is happening on <strong>${eventDate}</strong> — that's <strong>${daysUntil} days away</strong>.</p>
        <p><strong>Current roster status:</strong></p>
        <ul>
          <li>Accepted: ${accepted}</li>
          <li>Pending (invited, no response): ${pending}</li>
          <li>Declined: ${declined}</li>
        </ul>
        <p><a href="${siteUrl}/events">View and manage your roster</a></p>
        <p>— RosterServe</p>
      `,
    });
  } catch (err) {
    console.error("[sendPreEventLeaderAlert] failed:", err);
  }
}
