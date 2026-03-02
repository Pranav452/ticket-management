import { ImportDropzone } from "@/components/bajaj/ImportDropzone";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function BajajImportPage({
  searchParams,
}: {
  searchParams: Promise<{ module?: string }>;
}) {
  const { module: moduleSlug } = await searchParams;

  return (
    <div className="min-h-full bg-neutral-950 px-8 py-8">
      <div className="max-w-6xl mx-auto h-full flex flex-col">
        <Link
          href={`/bajaj/boards/${moduleSlug ?? "vipar"}`}
          className="flex items-center gap-1.5 text-sm text-neutral-500 hover:text-neutral-300 transition-colors mb-6"
        >
          <ArrowLeft className="size-4" />
          Back to board
        </Link>

        <div className="mb-6">
          <h1 className="text-2xl font-bold text-neutral-100 mb-1">Import & Create Work Orders</h1>
          <p className="text-sm text-neutral-500">
            For demo mode, you can either analyse an Excel file layout or add shipments manually.
          </p>
        </div>

        <div className="flex-1 min-h-0">
          <ImportDropzone
            defaultModule={moduleSlug}
            userId="demo-user-1"
          />
        </div>
      </div>
    </div>
  );
}
