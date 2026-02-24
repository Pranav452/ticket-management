import { createClient } from "@/lib/supabase/server";
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

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const isAdmin = user?.email === "pranavnairop090@gmail.com";

  return <WorkOrderBoardClient slug={slug} isAdmin={isAdmin} />;
}
