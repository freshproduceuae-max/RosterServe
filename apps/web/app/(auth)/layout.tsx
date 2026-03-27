export default function AuthLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-neutral-100 px-300">
      <div className="mb-400 text-center">
        <span className="font-display text-h3 text-neutral-950">RosterServe</span>
      </div>
      <div className="w-full max-w-md rounded-300 border border-neutral-300 bg-neutral-0 p-500 shadow-panel">
        {children}
      </div>
    </div>
  );
}
