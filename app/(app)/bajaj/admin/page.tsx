import { AdminPanel } from "@/components/bajaj/AdminPanel";

export const dynamic = "force-dynamic";
export const metadata = { title: "Admin — Bajaj Logistics" };

export default function BajajAdminPage() {
  return (
    <div className="flex flex-col h-full overflow-hidden bg-neutral-950">
      {/* Header */}
      <div className="flex items-center gap-3 px-6 py-4 border-b border-neutral-800 bg-[#0a0a0a] flex-shrink-0">
        <div className="flex size-7 items-center justify-center rounded-md bg-neutral-800">
          <span className="text-sm">🛡</span>
        </div>
        <div>
          <h1 className="text-[15px] font-semibold text-neutral-100 leading-none">Admin</h1>
          <p className="text-[11px] text-neutral-600 leading-none mt-0.5">
            User access · Audit log
          </p>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto">
        <AdminPanel />
      </div>
    </div>
  );
}
