import Link from "next/link";

export const metadata = {
  title: "Privacy Notice — RosterServe",
};

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-neutral-50 py-900 px-400">
      <div className="mx-auto max-w-prose">
        <h1 className="font-display text-h1 text-neutral-950">Privacy Notice</h1>
        <p className="mt-200 text-body-sm text-neutral-500">Last updated: April 2026</p>

        <div className="mt-600 flex flex-col gap-500 text-body text-neutral-800">
          <section className="flex flex-col gap-200">
            <h2 className="font-display text-h2 text-neutral-950">What data we collect</h2>
            <p>
              When you create an account on RosterServe we collect your display name, email
              address, and the role assigned to you by your organisation. During use of the
              platform we also collect your availability preferences, skill claims, department
              interest requests, and service assignment records.
            </p>
          </section>

          <section className="flex flex-col gap-200">
            <h2 className="font-display text-h2 text-neutral-950">Why we collect it</h2>
            <p>
              This information is used solely to operate the rostering service — matching
              volunteers to events, communicating assignments, and enabling leaders to plan
              their teams. We do not sell your data or use it for advertising.
            </p>
          </section>

          <section className="flex flex-col gap-200">
            <h2 className="font-display text-h2 text-neutral-950">Who can see your data</h2>
            <p>
              Your name and role are visible to leaders within your organisation (department
              heads, team heads, and administrators). Your contact email is used only for
              service notifications and is not displayed to other volunteers. Administrators
              with the Super Admin role can access all records within the organisation.
            </p>
          </section>

          <section className="flex flex-col gap-200">
            <h2 className="font-display text-h2 text-neutral-950">How to export or delete your data</h2>
            <p>
              If you have an account, you can download a copy of your data or request account
              deletion from your{" "}
              <Link href="/settings/account" className="text-brand-calm-600 hover:underline">
                Account settings
              </Link>
              . Deletion requests are reviewed by a Super Admin. After approval, your profile
              and all associated records will be permanently removed.
            </p>
          </section>

          <section className="flex flex-col gap-200">
            <h2 className="font-display text-h2 text-neutral-950">Contact</h2>
            <p>
              If you have questions about how your data is handled, contact the administrator
              of your organisation&apos;s RosterServe instance.
            </p>
          </section>
        </div>

        <div className="mt-800">
          <Link
            href="/sign-in"
            className="text-body-sm text-brand-calm-600 hover:underline"
          >
            ← Back to sign in
          </Link>
        </div>
      </div>
    </div>
  );
}
