import { createClient } from "@/lib/supabase/server";
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
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  return (
    <div className="min-h-full bg-neutral-950 px-8 py-8">
      <div className="max-w-2xl">
        <Link
          href={`/bajaj/boards/${moduleSlug ?? "vipar"}`}
          className="flex items-center gap-1.5 text-sm text-neutral-500 hover:text-neutral-300 transition-colors mb-6"
        >
          <ArrowLeft className="size-4" />
          Back to board
        </Link>

        <h1 className="text-2xl font-bold text-neutral-100 mb-1">Import from Excel</h1>
        <p className="text-sm text-neutral-500 mb-8">
          Upload your &quot;Bajaj Auto Shipment Data.xlsx&quot; file. We&apos;ll automatically
          read the Color Coding Legend sheet to set up status columns and convert
          each data row into a work order.
        </p>

        <ImportDropzone
          defaultModule={moduleSlug}
          userId={user?.id ?? ""}
        />
      </div>
    </div>
  );
}
