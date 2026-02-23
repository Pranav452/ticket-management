import Image from "next/image";

export const dynamic = "force-dynamic";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-dvh bg-neutral-900">
      {/* Left branding panel */}
      <div className="hidden lg:flex lg:w-1/2 flex-col items-center justify-center bg-neutral-950 p-12 border-r border-neutral-800">
        <div className="flex flex-col items-center gap-6 text-center">
          <div className="size-24 rounded-full overflow-hidden bg-white p-2 ring-4 ring-violet-500/30">
            <Image
              src="/logo.png"
              alt="Manilal logo"
              width={88}
              height={88}
              className="size-full object-contain"
            />
          </div>
          <div>
            <h2 className="text-3xl font-bold text-neutral-50">Manilal</h2>
            <p className="mt-2 text-neutral-400">
              Ticket Management System
            </p>
          </div>
          <div className="mt-8 grid gap-3 text-left w-full max-w-xs">
            {[
              "Raise and track issues in real-time",
              "Prioritized kanban workflow for devs",
              "Built-in ticket chat system",
              "File attachments — images, videos, docs",
            ].map((feature) => (
              <div
                key={feature}
                className="flex items-center gap-3 text-sm text-neutral-400"
              >
                <span className="size-1.5 rounded-full bg-violet-500 shrink-0" />
                {feature}
              </div>
            ))}
          </div>
        </div>
        <p className="mt-auto text-xs text-neutral-600">
          © 2026 Manilal. All rights reserved.
        </p>
      </div>

      {/* Right auth form */}
      <div className="flex flex-1 items-center justify-center p-8">
        {children}
      </div>
    </div>
  );
}
