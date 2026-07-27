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

  // Edit/drag rights are derived client-side from the signed-in user's role
  // (admin/superadmin edit; everyone else read-only) and enforced server-side.
  return <WorkOrderBoardClient slug={slug} />;
}
