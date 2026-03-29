import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionWithProfile } from "@/lib/auth/session";
import { UserProvider } from "@/lib/auth/user-context";
import { AppNav } from "./app-nav";

export default async function AppLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await getSessionWithProfile();

  // Primary auth gate — defense in depth behind middleware
  if (!session) {
    redirect("/sign-in");
  }

  // Volunteer onboarding gate — send incomplete volunteers to the onboarding flow
  if (session.profile.role === "volunteer" && !session.profile.onboarding_complete) {
    redirect("/onboarding");
  }

  return (
    <UserProvider session={session}>
      <div className="min-h-screen bg-neutral-100">
        <header className="border-b border-neutral-300 bg-neutral-0">
          <div className="mx-auto flex max-w-shell items-center justify-between px-300 py-200 sm:px-500">
            <div className="flex items-center gap-400">
              <Link href="/dashboard" className="font-display text-h3 text-neutral-950">
                RosterServe
              </Link>
              <AppNav role={session.profile.role} />
            </div>
            <form action="/auth/sign-out" method="POST">
              <button
                type="submit"
                className="rounded-200 border border-neutral-300 bg-neutral-0 px-300 py-100 text-body-sm text-neutral-600 transition-colors duration-fast hover:bg-neutral-100 hover:text-neutral-950"
              >
                Sign out
              </button>
            </form>
          </div>
        </header>
        <main className="mx-auto max-w-shell px-300 py-500 sm:px-500">
          {children}
        </main>
      </div>
    </UserProvider>
  );
}
