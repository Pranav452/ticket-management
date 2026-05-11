import { ImportDropzone } from "@/components/bajaj/ImportDropzone";
import Link from "next/link";
import { ArrowLeft, Upload } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function BajajImportPage({
  searchParams,
}: {
  searchParams: Promise<{ module?: string }>;
}) {
  const { module: moduleSlug } = await searchParams;
  const slug = moduleSlug ?? "vipar";

  return (
    <div className="flex flex-col h-full overflow-hidden" style={{ background: "#F5F5F5" }}>

      {/* Header */}
      <div className="flex items-center gap-4 px-6 py-4 border-b bg-white flex-shrink-0" style={{ borderColor: "#E5E7EB" }}>
        <Link
          href={`/bajaj/boards/${slug}`}
          className="flex items-center gap-1.5 text-[13px] text-gray-400 hover:text-gray-700 transition-colors"
        >
          <ArrowLeft className="size-4" />
          Board
        </Link>
        <span className="text-gray-200">/</span>
        <div className="flex items-center gap-2">
          <div className="flex size-7 items-center justify-center rounded-md bg-amber-50">
            <Upload className="size-3.5 text-amber-500" />
          </div>
          <div>
            <h1 className="text-[15px] font-semibold text-gray-900 leading-none">
              Import Dispatch Plan
            </h1>
            <p className="text-[11px] text-gray-400 leading-none mt-0.5">
              Paste from Bajaj email · Upload Excel · Manual entry
            </p>
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto px-6 py-6">
        <div className="max-w-4xl mx-auto">
          <ImportDropzone defaultModule={slug} userId="system" />
        </div>
      </div>
    </div>
  );
}
