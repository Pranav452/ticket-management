import { WorkOrderBoardClient } from "@/components/bajaj/WorkOrderBoardClient";

export const dynamic = "force-dynamic";

const VALID_SLUGS = ["vipar", "srilanka", "nigeria", "bangladesh", "triumph"];

export default async function BajajBoardPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  if (!VALID_SLUGS.includes(slug)) {
    return (
      <div className="flex h-full items-center justify-center text-neutral-500">
        Board not found.
      </div>
    );
  }

  // In demo mode we always show the board and treat the viewer as admin.
  return <WorkOrderBoardClient slug={slug} isAdmin />;
}
