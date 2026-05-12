import { AdminPanel } from "@/components/bajaj/AdminPanel";

export const dynamic = "force-dynamic";
export const metadata = { title: "Admin — Bajaj Logistics" };

export default function BajajAdminPage() {
  return (
    <div className="flex flex-col h-full overflow-hidden" style={{ background: "#F5F5F5" }}>
      {/* Header */}
      <div className="flex items-center gap-3 px-6 py-4 border-b bg-white flex-shrink-0" style={{ borderColor: "#E5E7EB" }}>
        <div className="flex size-7 items-center justify-center rounded-md bg-amber-50">
          <span className="text-sm">🛡</span>
        </div>
        <div>
          <h1 className="text-[15px] font-semibold text-gray-900 leading-none">Admin</h1>
          <p className="text-[11px] text-gray-400 leading-none mt-0.5">User access · Audit log</p>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto">
        <AdminPanel />
      </div>
    </div>
  );
}
